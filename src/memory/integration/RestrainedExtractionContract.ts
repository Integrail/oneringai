/**
 * RestrainedExtractionContract — applies an `EagernessProfile` to the parsed
 * extraction output, dropping items that violate the configured discipline.
 *
 * What the contract enforces (depending on the profile):
 *   - **whyActionable**: when `requireJustification` is on and output is non-empty,
 *     missing `whyActionable` is a violation — output is suppressed (treated as empty)
 *     and a `justification_missing` event is emitted.
 *   - **evidenceQuote**: under `requireEvidenceQuote = 'strict'`, every fact must
 *     carry a verbatim quote. Facts missing it are dropped + logged as
 *     `evidence_missing`. Under `'soft'`, missing quotes pass through silently.
 *   - **priority binding**: tasks ALWAYS extract regardless of mode. Binding
 *     status is annotated via emitted events so the host can score unbound
 *     tasks lower (typically FYI) without losing them from the knowledge
 *     graph. Event reason codes by case:
 *       - valid `servesAnchorId` → `priority_bound`
 *       - missing binding, strict mode → `priority_unbound` (still kept)
 *       - missing binding, soft mode → `priority_unbound_soft` (still kept)
 *       - stale/unknown binding, strict mode → `priority_stale`
 *       - stale/unknown binding, soft mode → `priority_stale_soft`
 *       - no active anchors → `no_anchors` (informational; still kept)
 *
 *     Pre-v10 behavior dropped task mentions in strict mode. v10 dropped that
 *     gate — extraction must surface what was said; downstream scoring decides
 *     visibility on the Decision Queue.
 *
 * **Every decision emits a `RestraintEvent`** — no silent disappearance. Events
 * are returned in the result and (if `onDecision` is provided) streamed live.
 *
 * The contract does NOT call any LLM — pure refinement. For LLM-based veto
 * see `SkepticPass`.
 */

import type {
  ExtractionFactSpec,
  ExtractionMention,
  ExtractionOutput,
} from './ExtractionResolver.js';
import type { EagernessProfile } from './EagernessProfile.js';
import type { Anchor } from './AnchorRegistry.js';
import {
  emitRestraintEvent,
  type RestraintEvent,
  type RestraintEventListener,
  type RestraintStage,
} from './RestraintEvent.js';

export interface RestrainedExtractionInput {
  /** Mention map keyed by local label, as produced by the parser. */
  mentions: Record<string, ExtractionMention>;
  /** Fact spec list, as produced by the parser. */
  facts: ExtractionFactSpec[];
  /** Top-level justification, as parsed (`undefined` if absent). */
  whyActionable?: string;
}

export interface RestrainedExtractionOptions {
  profile: EagernessProfile;
  /** Stage label for emitted events. Default `signalExtraction`. */
  stage?: RestraintStage;
  /** Active anchors to validate `servesAnchorId` against. Empty / undefined ⇒
   *  no active anchors (matters under strict priority binding). */
  anchors?: Anchor[];
  /** Live event listener — fires once per decision (kept and dropped). */
  onDecision?: RestraintEventListener;
}

export interface RestrainedExtractionResult extends ExtractionOutput {
  /** Justification preserved when present. */
  whyActionable?: string;
  /** The full decision log, including kept items. */
  events: RestraintEvent[];
  /** Counts derived from `events` for quick assertions. */
  summary: {
    factsKept: number;
    factsDropped: number;
    mentionsKept: number;
    mentionsDropped: number;
    /** Set when output was suppressed wholesale (e.g. `whyActionable` missing). */
    suppressed: boolean;
  };
}

/**
 * Apply restraint refinements to a parsed extraction output. Pure — no I/O.
 *
 * Returns a NEW `ExtractionOutput` plus the decision log. The input is not
 * mutated. Mentions that were referenced only by dropped facts ARE retained —
 * the LLM may have introduced them for entity resolution alone, and dropping
 * them here would lose entity merge candidates. Tasks are never dropped by
 * this contract for priority reasons (v10+) — binding state is surfaced via
 * `reasonCode` on emitted `kept` events so downstream scoring can demote
 * unbound tasks without losing them from the graph.
 */
export function applyRestrainedExtractionContract(
  input: RestrainedExtractionInput,
  opts: RestrainedExtractionOptions,
): RestrainedExtractionResult {
  const stage = opts.stage ?? 'signalExtraction';
  const profile = opts.profile;
  const events: RestraintEvent[] = [];

  const inputFacts = input.facts ?? [];
  const inputMentionsEntries = Object.entries(input.mentions ?? {});
  const isNonEmpty = inputFacts.length > 0 || inputMentionsEntries.length > 0;

  // --- Justification check ----------------------------------------------------
  if (profile.requireJustification && isNonEmpty) {
    const trimmed = (input.whyActionable ?? '').trim();
    if (trimmed.length === 0) {
      emitRestraintEvent(events, opts.onDecision, {
        kind: 'justification_missing',
        stage,
        itemRef: 'output',
        reasonCode: 'justification_missing',
        reasonText:
          'Output had mentions or facts but no `whyActionable` justification. Suppressed under requireJustification.',
        meta: { mentionCount: inputMentionsEntries.length, factCount: inputFacts.length },
      });
      return {
        mentions: {},
        facts: [],
        events,
        summary: {
          factsKept: 0,
          factsDropped: inputFacts.length,
          mentionsKept: 0,
          mentionsDropped: inputMentionsEntries.length,
          suppressed: true,
        },
      };
    }
  }

  // --- Priority binding on task mentions --------------------------------------
  // v10+: tasks ALWAYS extract. Binding state is annotated via emitted events
  // so the host can score unbound tasks at lower priority (typically FYI)
  // without losing them from the knowledge graph. Pre-v10 strict mode dropped
  // unbound tasks here; that produced "orphan" task-shaped facts upstream and
  // hid genuine commitments from users whose priorities weren't yet set.
  const keptMentions: Record<string, ExtractionMention> = {};
  for (const [label, mention] of inputMentionsEntries) {
    keptMentions[label] = mention;
  }
  if (profile.requirePriorityBinding !== 'off') {
    const anchors = opts.anchors ?? [];
    const activeIds = new Set(anchors.map((a) => a.id));
    const isStrict = profile.requirePriorityBinding === 'strict';

    for (const [label, mention] of inputMentionsEntries) {
      if (mention.type !== 'task') continue;
      const md = (mention.metadata ?? {}) as Record<string, unknown>;
      const servesId = typeof md.servesAnchorId === 'string' ? md.servesAnchorId : undefined;

      if (anchors.length === 0) {
        // No active anchors at all. Informational event only — task is kept.
        emitRestraintEvent(events, opts.onDecision, {
          kind: 'kept',
          stage,
          itemRef: `mention:${label}`,
          reasonCode: 'no_anchors',
          reasonText:
            'No active anchors for this extraction context; task kept without binding for downstream FYI scoring.',
          meta: { surface: mention.surface },
        });
        continue;
      }

      if (servesId && activeIds.has(servesId)) {
        emitRestraintEvent(events, opts.onDecision, {
          kind: 'kept',
          stage,
          itemRef: `mention:${label}`,
          reasonCode: 'priority_bound',
          reasonText: `Task bound to anchor ${servesId}.`,
          meta: { servesAnchorId: servesId },
        });
        continue;
      }

      // Either no binding attempted or binding points to an inactive anchor.
      // Same outcome (task kept) in both modes; the reason code distinguishes
      // them so downstream scoring + operator dashboards can tell stale
      // bindings from missing bindings.
      const isStale = servesId !== undefined;
      const reasonCode = isStrict
        ? isStale
          ? 'priority_stale'
          : 'priority_unbound'
        : isStale
          ? 'priority_stale_soft'
          : 'priority_unbound_soft';
      const reasonText = isStale
        ? `Task references unknown anchor "${servesId}" (not in active set); kept for FYI scoring.`
        : 'Task kept without anchor binding — host will score as FYI / lower priority.';
      emitRestraintEvent(events, opts.onDecision, {
        kind: 'kept',
        stage,
        itemRef: `mention:${label}`,
        reasonCode,
        reasonText,
        meta: {
          surface: mention.surface,
          ...(isStale ? { servesAnchorIdProvided: servesId } : {}),
          activeAnchorIds: [...activeIds],
        },
      });
    }
  }

  // --- Evidence quote on facts ------------------------------------------------
  // v10+: tasks are no longer dropped by priority binding, so there are no
  // "orphan" facts to scrub — the prior `droppedTaskLabels` filter became a
  // no-op and is removed.
  const keptFacts: ExtractionFactSpec[] = [];
  let factsDropped = 0;

  for (let i = 0; i < inputFacts.length; i++) {
    const spec = inputFacts[i]!;
    const itemRef = `fact:${i}`;

    // Evidence-quote check.
    if (profile.requireEvidenceQuote === 'strict') {
      const q = (spec.evidenceQuote ?? '').trim();
      if (q.length === 0) {
        factsDropped++;
        emitRestraintEvent(events, opts.onDecision, {
          kind: 'evidence_missing',
          stage,
          itemRef,
          reasonCode: 'evidence_missing',
          reasonText:
            'Fact dropped under requireEvidenceQuote=strict — no verbatim source quote provided.',
          meta: { predicate: spec.predicate, subject: spec.subject },
        });
        continue;
      }
    }

    keptFacts.push(spec);
    emitRestraintEvent(events, opts.onDecision, {
      kind: 'kept',
      stage,
      itemRef,
      reasonCode: 'kept',
      reasonText: 'Fact passed all restraint refinements.',
      meta: { predicate: spec.predicate },
    });
  }

  return {
    mentions: keptMentions,
    facts: keptFacts,
    ...(input.whyActionable !== undefined ? { whyActionable: input.whyActionable } : {}),
    events,
    summary: {
      factsKept: keptFacts.length,
      factsDropped,
      mentionsKept: Object.keys(keptMentions).length,
      mentionsDropped: inputMentionsEntries.length - Object.keys(keptMentions).length,
      suppressed: false,
    },
  };
}
