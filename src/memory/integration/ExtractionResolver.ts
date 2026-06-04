/**
 * ExtractionResolver — given a raw LLM extraction output {mentions, facts},
 * translates it into resolved entities + persisted facts.
 *
 * Four-pass flow:
 *   1. For each mention: call memory.upsertEntityBySurface → map local label → entity id.
 *   2. Translate label references inside mention.metadata (e.g.
 *      `event.attendeeIds = ['m_self','m1']`, `task.assigneeId = 'm_john'`)
 *      to real entity ids and patch the entity. Unresolved labels are dropped
 *      and logged. Without this, downstream readers (resolveRelatedEvents,
 *      task-by-assignee queries) see prompt placeholders instead of ids.
 *   3. For each fact: translate subject/object/contextIds, attach sourceSignalId,
 *      call memory.addFact.
 *   4. Return result with resolved entities, written facts, merge candidates,
 *      and unresolved references (e.g., facts pointing to undefined mention labels).
 *
 * One bad mention or fact doesn't abort the whole ingest — errors are collected
 * per-item and surfaced in the result for caller review.
 */

import type { ACLEntry } from '../../access/principals.js';
import { logger } from '../../infrastructure/observability/Logger.js';
import type { MemorySystem } from '../MemorySystem.js';
import type {
  EntityCandidate,
  EntityId,
  FactId,
  FactKind,
  IEntity,
  IFact,
  Identifier,
  ScopeFilter,
} from '../types.js';

// =============================================================================
// Input / output shapes — these mirror the default extraction prompt's JSON format.
// =============================================================================

export interface ExtractionMention {
  surface: string;
  type: string;
  identifiers?: Identifier[];
  aliases?: string[];
  /**
   * Type-specific fields the LLM extracted alongside the mention (e.g.
   * `{ state: 'proposed', dueAt: '2026-04-30', assigneeId: 'm1' }` for a task).
   * Flows through `upsertEntityBySurface.metadata` — on create, set verbatim;
   * on resolve, conservative `fillMissing` merge (never overwrites existing).
   */
  metadata?: Record<string, unknown>;
  /**
   * Multi-entity binding labels — local mention labels (e.g. `["m_acme",
   * "t_q3_meeting"]`) the entity "lives within". Translated to entity ids in
   * Pass 1.6 of `resolveAndIngest` (after all mentions have been resolved so
   * forward references work) and **unioned** into the entity's
   * `IEntity.contextIds` field via `MemorySystem.addEntityContextIds`.
   *
   * Conventional consumers: task/event/topic mentions. The LLM emits at the
   * top level of the mention object, NOT inside `metadata` (which would
   * collide with the `metadata.contextIds` path the older prompt suggested
   * and persist label placeholders).
   *
   * Unresolved labels are silently dropped (logged in `unresolved[]`).
   * Self-references and duplicates are filtered. Visibility is enforced
   * downstream by `addEntityContextIds`.
   */
  contextIds?: string[];
}

export interface ExtractionFactSpec {
  subject: string;                  // local mention label
  predicate: string;
  object?: string;                  // local mention label
  value?: unknown;
  details?: string;
  summaryForEmbedding?: string;
  confidence?: number;
  importance?: number;
  contextIds?: string[];            // local mention labels
  kind?: FactKind;                  // default 'atomic'
  validFrom?: string | Date;
  validUntil?: string | Date;
  observedAt?: string | Date;
  /**
   * Verbatim quote from the source signal supporting this fact. Required
   * under `EagernessProfile.requireEvidenceQuote = 'strict'` (filtered by
   * `RestrainedExtractionContract`); pass-through otherwise. Stored on the
   * written fact as `IFact.evidenceQuote`.
   */
  evidenceQuote?: string;
}

/**
 * Reconciliation operations emitted by the LLM in per-conversation
 * reconciliation mode (when `priorFacts` is passed to the prompt). Each op is
 * dispatched against the existing fact graph: `create` adds, `update` mutates
 * in place, `archive` flips `archived: true`. The factId on `update`/`archive`
 * MUST be one of the priorFact ids; hallucinated ids are rejected.
 */
export type ReconciliationOp =
  | {
      op: 'create';
      subject: string;
      predicate: string;
      kind: FactKind;
      object?: string;
      objectId?: string;
      value?: unknown;
      details?: string;
      contextIds?: string[];
      evidenceQuote?: string;
      importance?: number;
      confidence?: number;
    }
  | {
      op: 'update';
      factId: FactId;
      newValue?: unknown;
      details?: string;
      evidenceQuote?: string;
      reason?: string;
    }
  | {
      op: 'archive';
      factId: FactId;
      evidenceQuote?: string;
      reason?: string;
    };

/** Counts of operations applied/rejected by the resolver. */
export interface OperationOutcome {
  creates: number;
  updates: number;
  archives: number;
  rejectedHallucinated: number;
  rejectedSkeptic: number;
}

/**
 * Task reconciliation operation — the signal-reconciliation pass (a SECOND LLM
 * pass that runs after extraction). Distinct from the fact ops above: tasks are
 * MUTABLE entities, so reconciliation UPDATES them in place (state, narrative,
 * dueAt, assignee) instead of the archive+create supersession used for
 * immutable facts.
 *
 * `taskId` MUST be one of the prior task ids passed to
 * `MemorySystem.applyReconciliationOps`; hallucinated ids are rejected.
 *
 * When `newState` moves the task into a TERMINAL state, the dispatcher stamps
 * AI-resolution provenance onto the task metadata (see `AIResolutionProvenance`)
 * so the host can distinguish "auto-resolved by AI reconciliation" from "closed
 * by the user". `reason` is REQUIRED whenever `newState` is set.
 */
export interface TaskReconciliationOp {
  op: 'task_update';
  taskId: EntityId;
  /** New task state, e.g. `'in_progress' | 'done' | 'cancelled'`. Optional. */
  newState?: string;
  /** Refreshed task narrative / card body. Optional. */
  narrative?: string;
  /** ISO date string for a (re)scheduled due date. Optional. */
  dueAt?: string;
  /** Reassigned owner entity id. Optional. */
  assigneeId?: string;
  /** Verbatim quote from the signal content justifying the change. */
  evidenceQuote?: string;
  /** Brief reasoning — REQUIRED when `newState` is set (the provenance trail). */
  reason?: string;
}

/**
 * Combined op type emitted by the signal-reconciliation pass: fact ops (reusing
 * the existing `ReconciliationOp` shapes — `create` is rejected at dispatch, the
 * pass only supersedes) plus task ops.
 */
export type SignalReconciliationOp = ReconciliationOp | TaskReconciliationOp;

/**
 * AI-resolution provenance stamped on a task's `metadata` when a reconciliation
 * `task_update` op moves the task into a terminal state. Lets the host surface
 * "marked done by AI — <reason>" and audit auto-resolutions. `aiResolved === true`
 * with the task's terminal `state === 'done'` is the "was marked done by AI" flag.
 */
export interface AIResolutionProvenance {
  /** True when AI reconciliation moved this task into a terminal state. */
  aiResolved: true;
  /** Brief reasoning for the auto-resolution (from the op's `reason`). */
  aiResolutionReason: string;
  /** Verbatim evidence quote from the signal, when the op supplied one. */
  aiResolutionEvidenceQuote?: string;
  /** When the AI resolution happened. */
  aiResolvedAt: Date;
}

/** Outcome of `MemorySystem.applyReconciliationOps` — fact counts + task counts. */
export interface SignalReconciliationOutcome extends OperationOutcome {
  /** `task_update` ops applied (any field changed). */
  taskUpdates: number;
  /** Subset of `taskUpdates` that moved a task into a terminal (AI-resolved) state. */
  taskResolves: number;
}

export interface ExtractionOutput {
  mentions: Record<string, ExtractionMention>;
  facts: ExtractionFactSpec[];
  /** Reconciliation ops — populated when LLM ran in reconciliation mode. */
  operations?: ReconciliationOp[];
}

export interface IngestionResolvedEntity {
  label: string;
  entity: IEntity;
  resolved: boolean;
  mergeCandidates: EntityCandidate[];
}

export interface IngestionError {
  /** Which mention label / fact index failed. */
  where: string;
  reason: string;
}

export interface IngestionResult {
  entities: IngestionResolvedEntity[];
  facts: IFact[];
  /** Entities that matched existing records with mid-confidence candidates. */
  mergeCandidates: Array<{ label: string; surface: string; candidates: EntityCandidate[] }>;
  /** Mention labels or facts that couldn't be resolved/written. */
  unresolved: IngestionError[];
  /**
   * Canonicalized predicates in the LLM output that are NOT in the memory
   * system's predicate registry. Useful for detecting vocabulary drift —
   * periodically review and either promote to the registry or refine the
   * prompt. Empty when no registry is configured.
   * Deduped.
   */
  newPredicates: string[];
  /**
   * Op-level counts from reconciliation dispatch. Populated when the caller
   * passed `priorFacts` AND the LLM emitted `operations`. Undefined otherwise.
   */
  operationsApplied?: OperationOutcome;
}

export interface ExtractionResolverOptions {
  /** Override per-upsert threshold (default: memory system's config). */
  autoResolveThreshold?: number;
  /**
   * Pre-bound `label → entityId` map. When the LLM output references any of
   * these labels (as subject/object/contextId/mention), the resolver skips
   * upsert and uses the provided entity id directly. Intended for signal-level
   * metadata (email headers, calendar attendees) where identities are already
   * resolved upstream via strong identifiers — no need to round-trip through
   * the LLM.
   *
   * If the LLM output also contains a mention with the same label (e.g. it
   * ignored the prompt instruction not to redeclare), the pre-resolved binding
   * wins and the mention is skipped silently.
   */
  preResolved?: Record<string, EntityId>;
  /**
   * Prior facts that were rendered into the prompt for reconciliation. When
   * set, the resolver:
   *   - validates every `update`/`archive` op's `factId` against this set
   *     (rejecting hallucinated ids);
   *   - dispatches the surviving ops through `memory.updateFact`;
   *   - passes `dedup: true` to every `create` op so retries don't duplicate.
   *
   * Leave undefined when calling extraction in fresh (non-reconciliation)
   * mode — the resolver then ignores any `operations` the LLM may have
   * emitted erroneously.
   */
  priorFacts?: IFact[];
  /**
   * Optional skeptic-pass hook. When set, the resolver passes every
   * reconciliation op through this callback before dispatch. Return `true`
   * to accept, `false` to drop (counted as `rejectedSkeptic`). The host
   * normally implements skeptic-pass at a higher level — this hook lets the
   * library route ops through the same gate.
   */
  skepticFilter?: (op: ReconciliationOp) => boolean;
  /**
   * Authoritative observation timestamp for every fact written from this
   * extraction. Set to the SIGNAL'S source date — email `Date` header,
   * calendar event `startTime`, meeting transcript `createdDateTime`, doc
   * `createdAt`. NOT `Date.now()`.
   *
   * When set, this wins over any `observedAt` the LLM may emit and over the
   * `MemorySystem.addFact` `?? now` fallback. It's also used to anchor
   * `validUntil` for ephemeral predicates (`committed_to`, `expressed_concern`,
   * etc.) so commitments observed in historical content expire on the right
   * schedule instead of looking fresh for 90 more days.
   *
   * Strongly recommended whenever extracting from a signal that has a known
   * source timestamp. When undefined, the resolver logs a warning (once per
   * resolver instance) and falls back to the legacy behavior (LLM-emitted
   * observedAt, then `Date.now()`). For reconciliation `update` ops the
   * fallback is `Date.now()` only — `ReconciliationOp` of kind `update`
   * doesn't carry an `observedAt` field, so there's nothing to honor.
   */
  sourceObservedAt?: Date;
  /**
   * Allowlist of raw entity ids the LLM may reference directly inside facts'
   * `contextIds` (and inside task metadata's `servesAnchorId`) without going
   * through the mention/pre-resolved label vocabulary. Designed for ANCHORS
   * (priorities, OKRs, focus areas) that the prompt's "Active priorities"
   * block exposes by raw id — the LLM is told to echo those ids verbatim,
   * so the resolver must accept them as legitimate.
   *
   * Behavior:
   *  - Fact `contextIds` translation: when an entry is NOT in the local
   *    label map AND IS in this allowlist, the entry passes through as a
   *    raw entity id (no upsert, no resolve). Entries not in the label map
   *    AND not in this allowlist are dropped to `unresolved` (current behavior).
   *  - Mention `metadata.servesAnchorId` (task): same fallback — fixes the
   *    pre-v13 silent-drop bug where the LLM emitted raw anchor ids per the
   *    prompt's `<anchor_id>` placeholder but the translator only looked up
   *    label-bound ids.
   *
   * The caller is responsible for membership integrity — typically this is
   * `anchors.map(a => a.id)` from `ExtractionPromptContext.anchors[]`, kept
   * in lock-step so the LLM sees the same ids the resolver accepts.
   *
   * Empty or omitted → pre-v13 behavior (label translation only).
   */
  anchorIds?: string[];
  /**
   * Default `acl` stamped on every newly-created fact AND every newly-created
   * entity produced by this extraction. The library passes it through verbatim
   * to `memory.addFact` and `memory.upsertEntityBySurface` — both write paths
   * already accept `acl`; `materializePrincipals` unions it with owner/group/
   * world so adding ACL grants never narrows existing visibility.
   *
   * Designed for the host's "grant by signal participants" policy: an email
   * extracted by user A creates Task/Topic entities AND facts visible to every
   * tenant participant (sender + recipients + cc), letting other ICOS users
   * on the same thread read the same content without re-extracting.
   *
   * Semantics:
   *  - **Facts:** applied uniformly to every fact newly written by this
   *    extraction (Pass 2 creates + reconciliation `create` ops). There is no
   *    per-fact `acl` channel today — `ExtractionFactSpec` has no `acl` field
   *    and the LLM never emits one. If per-fact granularity is needed later,
   *    add `acl?: ACLEntry[]` to `ExtractionFactSpec` and switch the write
   *    site to `spec.acl ?? opts.defaultAcl`; until then this option is the
   *    sole source of fact-level ACL stamping.
   *  - **Entities — new only:** applied to each entity that the resolver
   *    creates this extraction (`resolved: false`). Existing-entity matches
   *    are NOT modified — pre-existing `acl` on a re-resolved entity stays
   *    intact (resolver never clobbers cross-signal access state).
   *  - **Reconciliation `update`/`archive`:** unaffected. Those ops patch
   *    value/details/archived without touching `acl`/`readPrincipals`, so
   *    facts retain their creation-time ACL across the lifetime.
   *
   * Pass `undefined` (or omit) to keep pre-0.x behavior — facts and entities
   * inherit only the legacy owner/group/world principals from their scope.
   *
   * The host is responsible for building the ACL — typically via a helper like
   * v25's `buildParticipantReadAcl(participantPersonIds)` which produces
   * `{ principal: entity:<personId>, actions: ['read'] }` entries.
   */
  defaultAcl?: ACLEntry[];
}

// =============================================================================
// Metadata label translation
// =============================================================================
//
// The default extraction prompt instructs the LLM to reference other mentions
// by local label inside type-specific metadata fields (e.g. event.attendeeIds,
// task.assigneeId, task.reporterId, task.servesAnchorId — see
// `defaultExtractionPrompt.ts`).
// `upsertEntityBySurface` writes those labels through verbatim, so without
// post-translation entity metadata ends up containing prompt placeholders like
// `'m_self'` / `'m1'` instead of real entity ids — and readers that query by
// these fields (`MemorySystem.resolveRelatedEvents`, task-by-assignee paths)
// silently miss every record.
//
// Translation is keyed by entity type. Adding a new label-bearing metadata
// field → add it here. Values that aren't in `labelToEntityId` are treated as
// unresolved labels and dropped (with an entry in `unresolved[]`) — there is
// no LLM-emitted code path that would put a real entity id here.

interface MetadataLabelFields {
  /** Single-string label fields — translate value or drop if unresolved. */
  readonly single: readonly string[];
  /** Array-of-string label fields — translate each item, drop unresolved. */
  readonly arrays: readonly string[];
}

const TRANSLATABLE_METADATA_FIELDS: Readonly<Record<string, MetadataLabelFields>> = {
  task: { single: ['assigneeId', 'reporterId', 'servesAnchorId'], arrays: [] },
  event: { single: [], arrays: ['attendeeIds'] },
};

// =============================================================================
// ExtractionResolver
// =============================================================================

export class ExtractionResolver {
  constructor(private readonly memory: MemorySystem) {}

  /**
   * Latched after the first `sourceObservedAt`-missing warning so callers
   * don't drown logs on steady-state ingest. The first warning is the
   * actionable one; the next 10k aren't.
   */
  private warnedNoSourceObservedAt = false;

  /**
   * Ingest a raw LLM extraction output. Resolves mentions to entities (upsert
   * if missing), translates facts from label-space to id-space, writes them.
   * Attaches `sourceSignalId` to every written fact.
   */
  async resolveAndIngest(
    output: ExtractionOutput,
    sourceSignalId: string,
    scope: ScopeFilter,
    opts?: ExtractionResolverOptions,
  ): Promise<IngestionResult> {
    const entities: IngestionResolvedEntity[] = [];
    const mergeCandidates: IngestionResult['mergeCandidates'] = [];
    const unresolved: IngestionError[] = [];
    const labelToEntityId = new Map<string, EntityId>();

    // observedAt anchoring: without sourceObservedAt the resolver can only
    // honor LLM-emitted dates (rarely supplied) or fall back to Date.now()
    // inside addFact. The latter is dangerous: facts from historical content
    // (old transcript, archived doc, replayed email) get stamped as if
    // observed today, which (a) breaks recency filters and (b) re-anchors
    // the `validUntil` window for ephemeral predicates so commitments from
    // last year look valid for 90 more days. Warn once per resolver instance
    // — the first warning is the actionable signal.
    if (!opts?.sourceObservedAt && !this.warnedNoSourceObservedAt) {
      this.warnedNoSourceObservedAt = true;
      logger.warn(
        {
          component: 'ExtractionResolver.resolveAndIngest',
          sourceSignalId,
        },
        'sourceObservedAt not provided — facts will be stamped with Date.now(). ' +
          'Callers extracting from dated signals (emails, calendar events, ' +
          'transcripts) should pass the signal/content date to anchor observedAt ' +
          'and the validUntil window for ephemeral predicates. ' +
          '(Further occurrences suppressed for this resolver instance.)',
      );
    }

    // ----- Pass 0: pre-resolved bindings (no LLM involvement) -----
    // Seed the label→id map with caller-supplied bindings. If the LLM output
    // later contains a mention for one of these labels, the pre-resolved id
    // wins and the mention is skipped.
    if (opts?.preResolved) {
      for (const [label, entityId] of Object.entries(opts.preResolved)) {
        labelToEntityId.set(label, entityId);
      }
    }

    // Anchor-id allowlist for the contextIds + metadata.servesAnchorId
    // passthrough. See `ExtractionResolverOptions.anchorIds` for the contract.
    //
    // PRE-VALIDATE against memory: callers can in principle pass stale or
    // mistyped ids (an anchor that was archived between the prompt render and
    // the resolver call, a typo on a hand-curated test). Without validation
    // those would persist as raw entity references on facts and as
    // `metadata.servesAnchorId` on task entities — both bypass the storage
    // layer's normal "context entity must exist + be visible" check because
    // anchor passthrough is the explicit unchecked path.
    //
    // Validation cost is one `getEntity` per anchor (typically 1–5 per tick).
    // Invalid ids drop with an `unresolved` entry so callers can detect drift;
    // valid ids land in the Set used by every downstream loop. Empty input →
    // empty Set (no DB calls).
    const knownAnchorIds = new Set<EntityId>();
    if (opts?.anchorIds && opts.anchorIds.length > 0) {
      for (const aid of opts.anchorIds) {
        if (!aid || typeof aid !== 'string') {
          unresolved.push({
            where: 'options.anchorIds',
            reason: `non-string anchor id rejected: ${JSON.stringify(aid)}`,
          });
          continue;
        }
        if (knownAnchorIds.has(aid)) continue; // dedupe
        try {
          const ent = await this.memory.getEntity(aid, scope);
          if (ent) {
            knownAnchorIds.add(aid);
          } else {
            unresolved.push({
              where: 'options.anchorIds',
              reason: `anchor id "${aid}" not visible in caller scope — passthrough denied`,
            });
          }
        } catch (err) {
          unresolved.push({
            where: 'options.anchorIds',
            reason: `anchor id "${aid}" lookup failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    }

    // ----- Pass 1: mentions → entities -----
    // Resolve in two sub-phases so disambiguationEntityIds can include already-
    // resolved sibling labels (improves disambiguation).
    const mentionEntries = Object.entries(output.mentions ?? {});

    for (const [label, mention] of mentionEntries) {
      // Skip redeclared labels — pre-resolved binding wins defensively.
      if (opts?.preResolved && label in opts.preResolved) {
        continue;
      }
      try {
        const disambiguationEntityIds = [...labelToEntityId.values()];
        const result = await this.memory.upsertEntityBySurface(
          {
            surface: mention.surface,
            type: mention.type,
            identifiers: mention.identifiers ?? [],
            aliases: mention.aliases ?? [],
            disambiguationEntityIds,
            metadata: mention.metadata,
            // Per `ExtractionResolverOptions.defaultAcl`: stamped on CREATE only.
            // `upsertEntityBySurface` ignores `acl` when matching an existing
            // entity (see EntityResolver) so a re-resolved cross-tenant Person
            // is not narrowed by an inbound participant grant.
            ...(opts?.defaultAcl && opts.defaultAcl.length > 0
              ? { acl: opts.defaultAcl }
              : {}),
          },
          scope,
          { autoResolveThreshold: opts?.autoResolveThreshold },
        );
        labelToEntityId.set(label, result.entity.id);
        entities.push({
          label,
          entity: result.entity,
          resolved: result.resolved,
          mergeCandidates: result.mergeCandidates,
        });
        if (result.mergeCandidates.length > 0) {
          mergeCandidates.push({
            label,
            surface: mention.surface,
            candidates: result.mergeCandidates,
          });
        }
      } catch (err) {
        unresolved.push({
          where: `mention:${label}`,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ----- Pass 1.5: translate label references inside mention.metadata -----
    // Pass 1 wrote `mention.metadata` verbatim, which means label-bearing
    // fields (event.attendeeIds, task.assigneeId, …) still hold prompt
    // placeholders like 'm_self'/'m1'. Resolve them now that the full
    // labelToEntityId map exists, and patch the entity. Skipping this leaves
    // resolveRelatedEvents and assignee queries blind to LLM-emitted entities.
    //
    // fillMissing semantics: `upsertEntityBySurface` preserves pre-existing
    // metadata fields on resolve. If the entity's current value differs from
    // the LLM's label spec, fillMissing kept a real value — translating would
    // clobber it. Detection: the entity's current metadata field equals the
    // LLM's spec exactly (post-Pass-1) iff Pass 1 wrote the label (new entity
    // OR resolved-with-missing-field). Anything else means real data was
    // preserved; skip translation and surface a note.
    for (const resolved of entities) {
      const meta = output.mentions[resolved.label]?.metadata;
      if (!meta) continue;
      const config = TRANSLATABLE_METADATA_FIELDS[resolved.entity.type];
      if (!config) continue;

      const currentMeta = (resolved.entity.metadata ?? {}) as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      let changed = false;

      for (const key of config.single) {
        const llmVal = meta[key];
        if (typeof llmVal !== 'string' || llmVal.length === 0) continue;

        if (currentMeta[key] !== llmVal) {
          unresolved.push({
            where: `mention:${resolved.label}.metadata.${key}`,
            reason: `existing entity has different ${key}; LLM-emitted label "${llmVal}" ignored (fillMissing)`,
          });
          continue;
        }

        // Same resolution order as fact-contextIds: local label map first;
        // anchor-id allowlist fallback so raw anchor ids the LLM is told to
        // echo (servesAnchorId) pass through without hitting the silent-drop
        // pre-v13 path. See `ExtractionResolverOptions.anchorIds`.
        const id =
          labelToEntityId.get(llmVal) ?? (knownAnchorIds.has(llmVal) ? llmVal : undefined);
        if (id) {
          patch[key] = id;
          changed = true;
        } else {
          // LLM hallucinated a label that has no mention — drop the field.
          // In-memory adapter keeps an `undefined` value here; Mongo strips at
          // BSON serialization. So `'key' in metadata` is unreliable downstream
          // — readers must check `metadata[key] != null`, not `in`.
          patch[key] = undefined;
          changed = true;
          unresolved.push({
            where: `mention:${resolved.label}.metadata.${key}`,
            reason: `metadata label "${llmVal}" not found in mentions (field dropped)`,
          });
        }
      }

      for (const key of config.arrays) {
        const llmArr = meta[key];
        if (!Array.isArray(llmArr)) continue;

        if (!isShallowArrayEqual(currentMeta[key], llmArr)) {
          unresolved.push({
            where: `mention:${resolved.label}.metadata.${key}`,
            reason: `existing entity has different ${key}; LLM-emitted labels ignored (fillMissing)`,
          });
          continue;
        }

        const translated: EntityId[] = [];
        for (const item of llmArr) {
          if (typeof item !== 'string' || item.length === 0) continue;
          const id = labelToEntityId.get(item);
          if (id) {
            translated.push(id);
          } else {
            unresolved.push({
              where: `mention:${resolved.label}.metadata.${key}`,
              reason: `metadata label "${item}" not found in mentions (item dropped)`,
            });
          }
        }
        patch[key] = translated;
        changed = true;
      }

      if (!changed) continue;

      try {
        const updated = await this.memory.updateEntityMetadata(
          resolved.entity.id,
          patch,
          scope,
        );
        // Reflect the patched metadata back into the result so callers don't
        // see the pre-translation state.
        resolved.entity = updated;
      } catch (err) {
        unresolved.push({
          where: `mention:${resolved.label}.metadata`,
          reason: `metadata-label patch failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    // ----- Pass 1.6: union mention-level contextIds onto entities -----
    // The LLM emits `mention.contextIds` as a list of LOCAL labels. Pass 1
    // created/resolved every mention; Pass 1.5 translated metadata labels.
    // Now we know every label's entity id and can translate the contextIds
    // labels. Calls `addEntityContextIds`, which:
    //   - skips empty / self-reference / already-present additions,
    //   - visibility-validates each addition,
    //   - retries on optimistic-concurrency mismatch (two extractions
    //     unioning different anchors onto the same canonical task converge).
    //
    // Unresolved labels are silently dropped (logged in `unresolved[]`).
    // Two-pass design: a forward reference (mention.contextIds → label that
    // appears later in the mentions list) is resolved here even though
    // upsertEntityBySurface couldn't see it during Pass 1.
    //
    // Pre-resolved mentions are handled too — the LLM may emit `contextIds`
    // on a redeclaration of a pre-bound label. The mention itself is skipped
    // in Pass 1 (pre-resolved binding wins), but its contextIds are still
    // valid intent and need to be unioned onto the pre-bound entity.
    interface ContextIdsJob {
      entityId: EntityId;
      labels: readonly string[];
      mentionLabel: string;
      // Index into `entities[]` so we can write the updated entity back;
      // undefined for pre-resolved mentions that aren't in entities[].
      entitiesIndex?: number;
    }
    const contextIdJobs: ContextIdsJob[] = [];
    // Jobs from regular upserts.
    for (let i = 0; i < entities.length; i++) {
      const resolvedEntity = entities[i]!;
      const mention = output.mentions[resolvedEntity.label];
      const labels = mention?.contextIds;
      if (!labels || labels.length === 0) continue;
      contextIdJobs.push({
        entityId: resolvedEntity.entity.id,
        labels,
        mentionLabel: resolvedEntity.label,
        entitiesIndex: i,
      });
    }
    // Jobs from pre-resolved mentions the LLM redeclared with contextIds.
    if (opts?.preResolved) {
      const coveredByEntities = new Set(entities.map((e) => e.label));
      for (const [label, entityId] of Object.entries(opts.preResolved)) {
        if (coveredByEntities.has(label)) continue; // covered by upsert path
        const mention = output.mentions[label];
        const labels = mention?.contextIds;
        if (!labels || labels.length === 0) continue;
        contextIdJobs.push({ entityId, labels, mentionLabel: label });
      }
    }
    for (const job of contextIdJobs) {
      const translated: EntityId[] = [];
      for (const cidLabel of job.labels) {
        const id = labelToEntityId.get(cidLabel);
        if (!id) {
          unresolved.push({
            where: `mention:${job.mentionLabel}.contextIds`,
            reason: `contextId label "${cidLabel}" not found in mentions (dropped)`,
          });
          continue;
        }
        if (id === job.entityId) {
          // Self-reference — silently drop. Not surfaced in `unresolved`
          // because it's an LLM benign mistake, not actionable.
          continue;
        }
        translated.push(id);
      }
      if (translated.length === 0) continue;
      try {
        const result = await this.memory.addEntityContextIds(
          job.entityId,
          translated,
          scope,
        );
        if (job.entitiesIndex !== undefined) {
          entities[job.entitiesIndex]!.entity = result.entity;
        }
      } catch (err) {
        unresolved.push({
          where: `mention:${job.mentionLabel}.contextIds`,
          reason: `addEntityContextIds failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    // ----- Pass 2: facts → written facts -----
    const writtenFacts: IFact[] = [];
    const factSpecs = output.facts ?? [];
    const hasRegistry = this.memory.hasPredicateRegistry();
    const newPredicatesSet = new Set<string>();

    for (let i = 0; i < factSpecs.length; i++) {
      const spec = factSpecs[i]!;
      try {
        const subjectId = labelToEntityId.get(spec.subject);
        if (!subjectId) {
          unresolved.push({
            where: `fact:${i}`,
            reason: `subject label "${spec.subject}" not found in mentions`,
          });
          continue;
        }
        let objectId: EntityId | undefined;
        if (spec.object) {
          objectId = labelToEntityId.get(spec.object);
          if (!objectId) {
            unresolved.push({
              where: `fact:${i}`,
              reason: `object label "${spec.object}" not found in mentions`,
            });
            continue;
          }
        }

        // Partial context is still useful: drop only the missing labels,
        // keep the fact with whatever resolved. Previously an entire fact was
        // discarded on one missing context label — that silently lost every
        // multi-context fact where the LLM referenced one hallucinated label.
        // Missing labels are still surfaced via `unresolved[]` so the caller
        // can log/tighten the prompt.
        let contextIds: EntityId[] | undefined;
        if (spec.contextIds && spec.contextIds.length > 0) {
          const resolvedIds: EntityId[] = [];
          for (const cid of spec.contextIds) {
            // Resolution order: (1) local label map (mention or pre-resolved
            // binding), then (2) the caller's anchor-id allowlist for raw
            // entity ids the LLM is permitted to reference directly (e.g.
            // priorities echoed from the "Active priorities" block).
            const resolved =
              labelToEntityId.get(cid) ?? (knownAnchorIds.has(cid) ? cid : undefined);
            if (!resolved) {
              unresolved.push({
                where: `fact:${i}`,
                reason: `context label "${cid}" not found in mentions (dropped from contextIds; fact still written)`,
              });
              continue;
            }
            resolvedIds.push(resolved);
          }
          contextIds = resolvedIds.length > 0 ? resolvedIds : undefined;
        }

        // Canonicalize the predicate and apply the configured H5 drift policy
        // when the result isn't in the registry. Strict-mode rejection happens
        // inside addFact and lands in `unresolved` via the surrounding
        // try/catch.
        let predicate = this.memory.canonicalizePredicate(spec.predicate);
        if (hasRegistry && !this.memory.getPredicateDefinition(predicate)) {
          const decision = this.memory.resolveUnknownPredicate(predicate);
          if (decision.policy === 'drop') {
            unresolved.push({
              where: `fact:${i}`,
              reason: `unknown predicate "${predicate}" — fact dropped (unknownPredicatePolicy='drop')`,
            });
            newPredicatesSet.add(predicate);
            continue;
          }
          if (decision.policy === 'fuzzy_map' && decision.mappedTo) {
            // Record the mapping so operators see "predicate X was snapped
            // onto Y" rather than just "X showed up".
            newPredicatesSet.add(`${predicate}→${decision.mappedTo}`);
            predicate = decision.mappedTo;
          } else {
            // 'keep' or 'fuzzy_map' with no close match — write verbatim.
            newPredicatesSet.add(predicate);
          }
        }

        // Kind validation — the prompt restricts to 'atomic' | 'document',
        // but LLMs hallucinate. Coerce unknown values to 'atomic' and record
        // the drift in `unresolved` (same shape as the newPredicates channel)
        // so callers can monitor and refine the prompt.
        let kind: FactKind;
        if (spec.kind === 'atomic' || spec.kind === 'document') {
          kind = spec.kind;
        } else if (spec.kind === undefined) {
          kind = 'atomic';
        } else {
          kind = 'atomic';
          unresolved.push({
            where: `fact:${i}`,
            reason: `unknown kind "${String(spec.kind)}", coerced to "atomic"`,
          });
        }

        const fact = await this.memory.addFact(
          {
            subjectId,
            predicate,
            kind,
            objectId,
            value: spec.value,
            details: spec.details,
            summaryForEmbedding: spec.summaryForEmbedding,
            confidence: spec.confidence,
            importance: spec.importance,
            contextIds,
            // Host-supplied source date wins over LLM-emitted dates — the
            // host knows the signal timestamp authoritatively and the LLM
            // often omits this field (it's not in the default prompt schema).
            // Note: `observedAt` is the SYSTEM observation time, not the
            // event time. Event time belongs on `validFrom`/`validUntil`,
            // so overriding any LLM-emitted observedAt with the signal date
            // is semantically correct even when the LLM mentions a past
            // event from within current content.
            observedAt: opts?.sourceObservedAt ?? toDate(spec.observedAt),
            validFrom: toDate(spec.validFrom),
            validUntil: toDate(spec.validUntil),
            sourceSignalId,
            evidenceQuote: spec.evidenceQuote,
            // Per `ExtractionResolverOptions.defaultAcl`: applied uniformly to
            // every fact newly written by this extraction. No per-fact acl
            // channel exists today (`ExtractionFactSpec` has no acl field;
            // the prompt doesn't surface it to the LLM).
            ...(opts?.defaultAcl && opts.defaultAcl.length > 0
              ? { acl: opts.defaultAcl }
              : {}),
          },
          scope,
        );
        writtenFacts.push(fact);
      } catch (err) {
        unresolved.push({
          where: `fact:${i}`,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ----- Pass 3: reconciliation operations -----
    // When the caller passed `priorFacts`, dispatch any LLM-emitted ops
    // against the existing fact graph. Hallucinated factIds are rejected;
    // surviving ops are routed through addFact / updateFact.
    let operationsApplied: OperationOutcome | undefined;
    if (opts?.priorFacts && (output.operations?.length ?? 0) > 0) {
      operationsApplied = await this.dispatchReconciliationOps(
        output.operations!,
        opts.priorFacts,
        labelToEntityId,
        sourceSignalId,
        scope,
        unresolved,
        opts.skepticFilter,
        opts.sourceObservedAt,
        opts.defaultAcl,
        knownAnchorIds,
      );
      // Capture newly created facts so callers see them in the result.
      // (dispatchReconciliationOps pushes onto writtenFacts directly.)
    }

    return {
      entities,
      facts: writtenFacts,
      mergeCandidates,
      unresolved,
      newPredicates: Array.from(newPredicatesSet).sort(),
      ...(operationsApplied ? { operationsApplied } : {}),
    };
  }

  /**
   * Dispatch reconciliation ops emitted by the LLM. Returns op-level counts.
   *
   * Validation rules:
   * - `update`/`archive` factId must exist in `priorFacts` (case-sensitive).
   *   Hallucinated ids → counted as `rejectedHallucinated`, op skipped.
   * - `skepticFilter` (when provided) can drop ops with weak evidence → counted
   *   as `rejectedSkeptic`.
   * - `update` with no `newValue` AND no `details` is silently dropped (parser
   *   already filtered, defence in depth).
   *
   * Side effects:
   * - `create` → `memory.addFact({...}, scope)` with `dedup: true` (idempotent
   *   under retry).
   * - `update` → `memory.updateFact(factId, {value|details, observedAt, ...evidence}, scope)`.
   * - `archive` → `memory.updateFact(factId, {archived: true}, scope)`.
   * - Each accepted op appends to `writtenFacts` (creates) / pushes a touched-fact
   *   entry; callers can also read the returned outcome.
   */
  private async dispatchReconciliationOps(
    ops: ReconciliationOp[],
    priorFacts: IFact[],
    labelToEntityId: Map<string, EntityId>,
    sourceSignalId: string,
    scope: ScopeFilter,
    unresolved: IngestionError[],
    skepticFilter: ((op: ReconciliationOp) => boolean) | undefined,
    sourceObservedAt: Date | undefined,
    defaultAcl: ACLEntry[] | undefined,
    knownAnchorIds: Set<EntityId>,
  ): Promise<OperationOutcome> {
    const outcome: OperationOutcome = {
      creates: 0,
      updates: 0,
      archives: 0,
      rejectedHallucinated: 0,
      rejectedSkeptic: 0,
    };
    const priorFactIds = new Set(priorFacts.map((f) => f.id));
    const priorById = new Map(priorFacts.map((f) => [f.id, f]));

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i]!;

      if (skepticFilter && !skepticFilter(op)) {
        outcome.rejectedSkeptic++;
        logger.info(
          {
            component: 'ExtractionResolver.reconcile',
            op: op.op,
            factId: 'factId' in op ? op.factId : undefined,
            sourceSignalId,
          },
          'reconciliation op rejected by skeptic filter',
        );
        continue;
      }

      if (op.op === 'create') {
        try {
          const subjectId = labelToEntityId.get(op.subject);
          if (!subjectId) {
            unresolved.push({
              where: `op:${i}`,
              reason: `create: subject label "${op.subject}" not found in mentions`,
            });
            continue;
          }
          let objectId: EntityId | undefined;
          if (op.objectId) {
            objectId = labelToEntityId.get(op.objectId);
            if (!objectId) {
              unresolved.push({
                where: `op:${i}`,
                reason: `create: objectId label "${op.objectId}" not found in mentions`,
              });
              continue;
            }
          } else if (op.object) {
            objectId = labelToEntityId.get(op.object);
            if (!objectId) {
              unresolved.push({
                where: `op:${i}`,
                reason: `create: object label "${op.object}" not found in mentions`,
              });
              continue;
            }
          }
          // Mirror Pass 2's fact-contextIds behavior: explicitly log every
          // drop to `unresolved` so caller / LLM drift on reconciliation
          // creates is debuggable. Resolution order matches Pass 2: local
          // label map → anchor-id allowlist → drop.
          let contextIds: EntityId[] | undefined;
          if (op.contextIds && op.contextIds.length > 0) {
            const resolved: EntityId[] = [];
            for (const c of op.contextIds) {
              const id =
                labelToEntityId.get(c) ?? (knownAnchorIds.has(c) ? c : undefined);
              if (!id) {
                unresolved.push({
                  where: `op:${i}`,
                  reason: `create: context label "${c}" not found in mentions (dropped from contextIds; fact still written)`,
                });
                continue;
              }
              resolved.push(id);
            }
            contextIds = resolved.length > 0 ? resolved : undefined;
          }
          await this.memory.addFact(
            {
              subjectId,
              predicate: op.predicate,
              kind: op.kind,
              objectId,
              value: op.value,
              details: op.details,
              contextIds,
              importance: op.importance,
              confidence: op.confidence,
              sourceSignalId,
              evidenceQuote: op.evidenceQuote,
              observedAt: sourceObservedAt,
              dedup: true,
              // Reconciliation creates respect the extraction-level ACL — a
              // brand-new fact emitted as a reconciliation op should be as
              // readable as a fresh-extraction fact.
              ...(defaultAcl && defaultAcl.length > 0 ? { acl: defaultAcl } : {}),
            },
            scope,
          );
          outcome.creates++;
        } catch (err) {
          unresolved.push({
            where: `op:${i}`,
            reason: `create: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
        continue;
      }

      // update / archive — factId must be a prior fact id.
      if (!priorFactIds.has(op.factId)) {
        outcome.rejectedHallucinated++;
        logger.warn(
          {
            component: 'ExtractionResolver.reconcile',
            op: op.op,
            factId: op.factId,
            sourceSignalId,
          },
          'reconciliation op references unknown factId — rejected',
        );
        unresolved.push({
          where: `op:${i}`,
          reason: `${op.op}: factId "${op.factId}" not in priorFacts (hallucinated)`,
        });
        continue;
      }

      if (op.op === 'update') {
        try {
          const target = priorById.get(op.factId)!;
          // Write newValue to whichever field the original fact used. `value`
          // for atomic facts; `details` for document facts; if both undefined,
          // default to value.
          const patch: Partial<IFact> = {
            // Anchor on the signal's date — extraction time would falsely
            // refresh observedAt on every reprocess of historical content.
            observedAt: sourceObservedAt ?? new Date(),
            sourceSignalId,
          };
          if (op.newValue !== undefined) {
            if (target.kind === 'document' && op.details === undefined) {
              // newValue routed to details for document facts (LLM may pass
              // either field for a doc-kind update; prefer explicit details).
              patch.details = typeof op.newValue === 'string'
                ? op.newValue
                : JSON.stringify(op.newValue);
            } else {
              patch.value = op.newValue;
            }
          }
          if (op.details !== undefined) {
            patch.details = op.details;
          }
          if (op.evidenceQuote !== undefined) {
            patch.evidenceQuote = op.evidenceQuote;
          }
          await this.memory.updateFact(op.factId, patch, scope);
          outcome.updates++;
        } catch (err) {
          unresolved.push({
            where: `op:${i}`,
            reason: `update: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
        continue;
      }

      if (op.op === 'archive') {
        try {
          await this.memory.archiveFact(op.factId, scope);
          outcome.archives++;
        } catch (err) {
          unresolved.push({
            where: `op:${i}`,
            reason: `archive: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
        continue;
      }
    }

    return outcome;
  }

}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function toDate(v: string | Date | undefined): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Position-sensitive shallow equality for two arrays. Used in Pass 1.5 to
 * detect whether the entity's current metadata array still matches the LLM's
 * label spec — only then is it safe to translate (otherwise fillMissing has
 * preserved real data and we'd clobber it).
 */
function isShallowArrayEqual(a: unknown, b: readonly unknown[]): boolean {
  if (!Array.isArray(a)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
