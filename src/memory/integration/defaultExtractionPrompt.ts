/**
 * Default prompt template for signal → memory extraction.
 *
 * **Prompt version: 13** — bump this number whenever the prompt surface
 * changes materially so callers pinning snapshots notice.
 *   - v13: extraction surface tightened. New `ExtractionPromptContext.extractableEntityTypes`
 *          allowlist parameterises the mention schema's `type` field, the
 *          intro list, the type-specific entity-metadata example block, Rule
 *          4's bullets, and the subject-of section + example. Hosts can shrink
 *          the LLM's mention vocabulary without forking the prompt (default
 *          keeps the prior 7 types; `task` is still required by template
 *          contract — see the option JSDoc). New `ExtractionResolverOptions.anchorIds`
 *          allowlist + a one-line fallback in fact-`contextIds` resolution and
 *          in `TRANSLATABLE_METADATA_FIELDS` single-value translation lets the
 *          LLM reference raw anchor entity ids (echoed verbatim from the
 *          "Active priorities" block) inside `contextIds` and inside
 *          `task.metadata.servesAnchorId` — fixes the latent v12 silent-drop
 *          on `servesAnchorId` for free. Anchor ids are validated against
 *          memory once per `resolveAndIngest` call; stale ids drop with an
 *          `unresolved` entry. Examples re-grounded on predicates that exist
 *          in `standard.ts` (`discussed_topic`/`employee_count`/`raised_concern`
 *          /`learned_pattern`/`meeting_recap` removed; doc-kind examples use
 *          `research_note`/`meeting_notes`/`memo`). New "The world isn't a fact"
 *          posture paragraph explicitly bans participation/presence/vague-
 *          affect emissions ("attended", "mentioned", "interested", "engaged")
 *          that the host already tracks via the signal envelope or entity
 *          metadata. New explicit rule: `expressed_concern` / `expressed_interest`
 *          are valid ONLY when the subject's concern/interest touches a
 *          tracked Priority — the priority's RAW ANCHOR ID (from the "Active
 *          priorities" block, accepted via the new `anchorIds` allowlist) must
 *          appear in the fact's `contextIds`. Promotes the v10 "tasks ARE the
 *          commitment record" rule to a top-level instruction now that
 *          `committed_to` is deprecated from the extraction vocabulary. New
 *          `ExtractionResolverOptions.defaultAcl` stamps a uniform `acl` on
 *          every newly-created fact AND every newly-created entity, for the
 *          host's "grant by signal participants" pattern.
 *   - v12: task mentions teach `reporterId` (library-native task metadata
 *          field — see `MemorySystem.RELATIONAL_TASK_FIELDS`). Set when the
 *          person who committed/assigned the task is DIFFERENT from the
 *          assignee — e.g. transcript "Anton: Sarah will own the deck",
 *          email "I'm asking John to follow up". Replaces the v10/11-era
 *          `committed_to(committer, task)` fact for the third-party-
 *          assignment case: the relationship now lives on the task entity
 *          itself, making `resolveRelatedTasks(committerId)` return the
 *          task natively without a fact-walk fallback. Self-commitments
 *          ("I'll send the budget" — committer === assignee) leave
 *          `reporterId` undefined; `assigneeId` alone is enough. Resolver
 *          translates `reporterId` mention labels → entity ids via the
 *          existing `TRANSLATABLE_METADATA_FIELDS.task.single` path.
 *   - v11: task/event/topic mentions can carry a top-level `contextIds: ["m_..."]`
 *          array referencing other mention labels. Translates to
 *          `IEntity.contextIds` (union merge) via ExtractionResolver Pass 1.6.
 *          Replaces the v10-era pattern of stuffing the same multi-entity
 *          binding into fact-level `contextIds` (which now only covers
 *          per-fact context — e.g. a decision touching multiple deals).
 *          Surfaces on `getContext.relatedTasks` / `.relatedEvents` via the
 *          tier-1.5 entity-contextIds path, indexed in Mongo.
 *   - v10: dropped `committed_to(person, task)` as a parallel emission alongside
 *          extracted task mentions — a task entity is self-sufficient
 *          (`assigneeId` carries who-executes, mention-level `evidenceQuote`
 *          carries the verbatim grounding). `committed_to` retained in the
 *          predicate registry for backward compat but flagged
 *          `excludeFromExtractionPrompt`. Strict-no-priorities branch no
 *          longer suppresses task extraction — priority binding is a scoring
 *          input, not an extraction gate. Anchor metadata (weight / horizon /
 *          deadline) rendered alongside the id in the priority-binding block.
 *          Added "semantic, not lexical" alignment sentence to priority
 *          binding so hosts no longer have to append the equivalent paragraph.
 *   - v9: anchor binding hardened — strict-mode contract rejects task mentions
 *         lacking `servesAnchorId`; constant exported as 9.
 *   - v8: removed mention of `completed` from the "relational facts about a
 *         task" guidance; entire `temporal` category (`occurred_on`,
 *         `scheduled_for`, `started_on`, `ended_on`) removed in the round-2
 *         predicate consolidation. Pure single-entity attributes — completion,
 *         due date, priority, scheduling, creation — now route to entity
 *         metadata; only relationships-between-two-entities remain as facts.
 *   - v7: removed `state_changed` / `has_status` / `current_status` guidance.
 *         Task state lives on `task.metadata.state` (set at mention creation);
 *         transitions are host-driven via `MemorySystem.transitionTaskState`.
 *         Removed `approved` (use `decision_made`) and the
 *         `assigned_task` / `delegated_to` predicates (assignment lives on
 *         `task.metadata.assigneeId`; use `committed_to` for lineage).
 *   - v6: explicit "Do NOT emit per-message communication noise" rule in
 *         Parsimony; lifecycle-aware Validity period note (system auto-stamps
 *         validUntil for ephemeral/episodic predicates from registry). Paired
 *         with predicate registry's `excludeFromExtractionPrompt` filter that
 *         removes noise predicates from the vocabulary by default.
 *   - v5: restraint posture controls (`EagernessProfile`) — optional
 *         `whyActionable`, optional per-fact `evidenceQuote`, optional
 *         priority/anchor binding, configurable negative-example slot.
 *         Backward-compatible: omit `eagerness` to keep v4 behavior.
 *   - v4: nonce-wrapped `<signal_content_*>` delimiters (prompt-injection defense).
 *   - v3: closed predicate vocabulary warning when a registry is present.
 *   - v2: "## Parsimony" section (zero-fact is valid, expected fact counts, neg/pos example);
 *         metadata-on-mentions for task/event structural fields.
 *
 * The LLM is instructed to return JSON with:
 *   - `mentions`: map of local labels → entity surface forms (+ optional metadata)
 *   - `facts`: triples referencing mention labels (not entity IDs)
 *   - `whyActionable` (optional, required by `requireJustification`): one-sentence
 *     justification — only present when output is non-empty
 *
 * The memory layer's `ExtractionResolver` then translates mention labels into
 * entity IDs (via `upsertEntityBySurface`) and writes the facts.
 *
 * Override via `ExtractionResolverOptions.promptTemplate` for custom behavior
 * (domain-specific predicate vocabularies, extra metadata, etc.).
 */

export const DEFAULT_EXTRACTION_PROMPT_VERSION = 13;

/**
 * Default entity-mention types the prompt offers to the LLM when the caller
 * does NOT pass an explicit `extractableEntityTypes` allowlist. Kept identical
 * to pre-v13 behavior so existing callers see no change. Hosts that want to
 * tighten the vocabulary pass their own list (e.g. `['person','organization',
 * 'task','topic']` — see `ExtractionPromptContext.extractableEntityTypes`).
 *
 * Source of truth for the prompt's mention-schema enum AND the intro line.
 */
export const DEFAULT_EXTRACTABLE_ENTITY_TYPES = [
  'person',
  'organization',
  'project',
  'task',
  'event',
  'topic',
  'cluster',
] as const;

import type { PredicateRegistry } from '../predicates/PredicateRegistry.js';
import type { IEntity, IFact, ScopeFields } from '../types.js';
import type { Anchor } from './AnchorRegistry.js';
import type { EagernessProfile } from './EagernessProfile.js';

/**
 * A label already bound to an entity before the LLM runs. Typically produced
 * from signal metadata (email headers, calendar attendees, Slack user list) —
 * strong identifiers let us resolve deterministically and hand the LLM a
 * pre-bound vocabulary so it can reference `m1`, `m2` directly in its output
 * without re-declaring them as mentions.
 */
export interface PreResolvedBinding {
  /** Stable local label (e.g. `m1`). The LLM must use this verbatim in facts. */
  label: string;
  /** Resolved entity — surfaced in the prompt as a human-readable hint. */
  entity: IEntity;
  /** Source role (e.g. `from`, `to`, `cc`, `author`, `attendee`). Free-form. */
  role?: string;
}

/**
 * One message inside a multi-signal conversation thread. When the caller passes
 * a `signalThread`, the prompt renders the messages chronologically in a single
 * nonce-wrapped block — replacing the single `signalText` path entirely for
 * that call. Used by per-conversation reconciliation (V25 Jarvis pipeline) so
 * the LLM sees the whole conversation, not one message at a time.
 */
export interface SignalThreadMessage {
  /** Stable signal id — referenced back in `evidenceQuote`/op `reason` fields. */
  id: string;
  /** When this message was observed (rendered as the per-message header). */
  observedAt: Date;
  /** Optional sender label ("From: ..."). */
  sender?: string;
  /** Message body. Caller is expected to have already stripped quoted replies. */
  body: string;
}

export interface ExtractionPromptContext {
  /**
   * Raw text of the signal (email body, transcript, doc content, …).
   *
   * Required when `signalThread` is not provided. When `signalThread` is set
   * (per-conversation reconciliation mode), this field is ignored — the
   * thread rendering replaces the single-signal block.
   */
  signalText?: string;
  /**
   * Multi-signal conversation input. When set, the prompt renders these
   * messages chronologically in place of `signalText`. Use this for
   * per-conversation reconciliation; leave undefined for single-signal
   * extraction (current behavior, unchanged for backward compat).
   */
  signalThread?: SignalThreadMessage[];
  /** Optional hint describing where this came from, e.g. "email from john@acme.com". */
  signalSourceDescription?: string;
  /** Scope the extractor should treat as target — guides the LLM's privacy judgment. */
  targetScope?: ScopeFields;
  /** Optional pre-loaded entity candidates the extractor can reference by name. */
  knownEntities?: IEntity[];
  /** Reference date for interpreting relative dates ("next Friday"). Defaults to today. */
  referenceDate?: Date;
  /**
   * When present, the registry's vocabulary is rendered into the prompt so the
   * LLM learns the canonical predicate names + aliases + examples. The LLM may
   * still invent new predicates; unknowns canonicalize at write time and land
   * in `IngestionResult.newPredicates` for review.
   */
  predicateRegistry?: PredicateRegistry;
  /** Cap on predicates shown per category (keeps prompt token budget bounded). Default 5. */
  maxPredicatesPerCategory?: number;
  /**
   * Labels already bound to entities upstream (typically by signal metadata
   * extraction). The prompt renders them as a locked vocabulary and instructs
   * the LLM to reference them directly in facts without redeclaring them.
   */
  preResolvedBindings?: PreResolvedBinding[];

  /**
   * Restraint posture. When present, the prompt renders the corresponding
   * "Restraint" section that turns silence into the easy answer:
   *   - `requireJustification` → adds a top-level `whyActionable` field that
   *     is required *only* when output is non-empty.
   *   - `requireEvidenceQuote` → adds `evidenceQuote` to each fact (soft:
   *     advised; strict: required).
   *   - `requirePriorityBinding` → renders the active anchors and asks for
   *     `servesAnchorId` per task mention.
   *   - `negativeExamplesCount` → controls how many entries from
   *     `negativeExamples` are rendered as "do NOT do this" patterns.
   *
   * Omit `eagerness` to keep the v4 behavior (no Restraint section).
   */
  eagerness?: EagernessProfile;

  /**
   * Active anchors (priorities, OKRs, focus areas) for the current extraction
   * context. Hosts may pass one user's anchors, a project/team anchor set, or
   * a merged participant-priority set for shared source processing. Surfaced
   * in the prompt only when `eagerness.requirePriorityBinding !== 'off'`. Each
   * anchor's `id` is what the LLM should echo back as `servesAnchorId`.
   */
  anchors?: Anchor[];

  /**
   * Human-readable description of what `anchors` represent. Defaults to a
   * source-neutral phrase so shared-source processors do not have to pretend
   * the anchors belong to a single claimant user.
   *
   * Example: "The active priorities for ICOS users participating in this email".
   */
  anchorContextDescription?: string;

  /**
   * Recent dismissals to inject as negative examples. Rendered up to
   * `eagerness.negativeExamplesCount`. Each entry is a short snippet the user
   * already chose to ignore — strong calibration signal.
   */
  negativeExamples?: Array<{ snippet: string; reason?: string }>;

  /**
   * Prior conversation context (e.g. earlier emails in the same thread,
   * earlier turns in a transcript) that has ALREADY been extracted in
   * previous pipeline runs. Rendered as a clearly-labeled "DO NOT extract"
   * background block — the LLM must use it for grounding (resolving "she",
   * binding follow-up commitments to the original task) but MUST NOT emit
   * facts or mentions whose source is exclusively this prior content.
   *
   * Each entry is a short header (e.g. `From Anton at 2026-05-06T08:44Z`)
   * plus the message body, ideally already de-quoted by the host so the
   * same sentence doesn't appear repeatedly across nested replies.
   *
   * Pair with the existing canonical-id rule for tasks: a commitment seen
   * in the delta that was already extracted from a prior message MUST yield
   * the SAME canonical id, so the resolver merges into the existing entity
   * instead of creating a duplicate.
   *
   * Superseded by `signalThread` + `priorFacts` (reconciliation mode); kept
   * for backward compat with callers that still use single-signal extraction
   * with thread background.
   */
  priorThreadContext?: Array<{ header: string; body: string }>;

  /**
   * Facts already extracted from PRIOR signals on this same conversation/thread,
   * surfaced so the LLM can RECONCILE them against new content. When non-empty,
   * the prompt renders a "Prior facts to reconcile" block and instructs the
   * LLM to emit `operations` (create / update / archive) in addition to the
   * usual `facts` array.
   *
   * Use this for per-conversation reconciliation: the LLM sees what's already
   * known and decides what the new messages imply (status changed → update,
   * reply needed → archive, brand-new commitment → create) without leaving
   * tombstone-chain churn behind.
   *
   * Each fact MUST be referenceable by `id` — the output `operations` array
   * cites these ids. Hallucinated ids are rejected at resolve time.
   */
  priorFacts?: IFact[];

  /**
   * Allowlist of entity types the LLM may emit as mentions. Renders into the
   * mention-schema's `type` field AND the prompt intro's "entities of (…)"
   * list, so the LLM never sees types its host has dropped. Default keeps the
   * v12 surface (`DEFAULT_EXTRACTABLE_ENTITY_TYPES`).
   *
   * Coverage notes — what is and isn't gated:
   *  - **Type-specific BULLETS** in the entity-metadata example block (`task: {...}`,
   *    `event: {...}`) and Rule 4's `Task` / `Event` / `Topic` bullet rows ARE
   *    gated. Drop `event` and the event bullets disappear; drop `topic` and
   *    its bullet disappears.
   *  - **Type-specific RELATIONAL hints** like `prepares_for(task↔event)` are
   *    gated on `event` membership.
   *  - **Subject-of section + project-as-subject example** ARE gated: removed
   *    entirely when no non-person subject is allowed; the example falls
   *    through `project → organization → topic` based on what's allowed.
   *
   * **CONTRACT — this prompt template assumes `task` is in the allowlist.**
   * Task-specific guidance — "Tasks ARE the commitment record," the canonical-id
   * requirement, `reporterId` / `state` / `assigneeId` rules, the
   * `committed_to`-suppression instruction, and the over-decomposition negative
   * example — is rendered UNCONDITIONALLY. Hosts wanting an extraction surface
   * without Tasks should fork this template (the Decision-Queue product
   * posture is baked in too deeply for a runtime gate to clean up).
   *
   * Pruning here is necessary but not sufficient — the host must also remove
   * the same types from its predicate registry's `subjectTypes` / `objectTypes`
   * so the predicate vocabulary stays coherent (a `partners_with` predicate
   * with `subjectTypes:['organization']` is fine even if `project` is dropped,
   * but a hypothetical `funded_by` with `subjectTypes:['project']` would be
   * dead weight).
   */
  extractableEntityTypes?: readonly string[];

  /**
   * Opt into non-person-subject extraction guidance. Default false.
   *
   * Production data shows the default extraction style is heavily
   * person-biased: most facts emerge as `(person, predicate, otherEntity)`,
   * which starves projects, organizations, and events of descriptive content
   * about themselves. With ~zero atomic facts per organization in a real
   * tenant, the profile-regen threshold can never fire — extraction is the
   * structural bottleneck, not the threshold.
   *
   * When `true`:
   *  - The predicate registry renders grouped by `subjectTypes` (so the LLM
   *    sees a "When the subject is a `project`" bucket).
   *  - A "Subjects beyond persons" guidance section appears explaining when
   *    to emit a subject-of fact, with restraint still mandatory.
   *  - A positive example shows project-as-subject extraction.
   *
   * The registry MUST tag its predicates with `subjectTypes` for the grouping
   * to be useful — predicates without `subjectTypes` fall into a `generic`
   * bucket. Hosts that haven't tagged their registry yet should leave this
   * flag off; turning it on with a flat registry costs prompt tokens for
   * no extraction-quality gain.
   */
  subjectOfHintsEnabled?: boolean;
}

export function defaultExtractionPrompt(ctx: ExtractionPromptContext): string {
  const {
    signalText,
    signalThread,
    signalSourceDescription,
    targetScope,
    knownEntities,
    referenceDate = new Date(),
    predicateRegistry,
    maxPredicatesPerCategory = 5,
    preResolvedBindings,
    eagerness,
    anchors,
    anchorContextDescription,
    negativeExamples,
    priorThreadContext,
    priorFacts,
    subjectOfHintsEnabled,
    extractableEntityTypes,
  } = ctx;
  const allowedTypes =
    extractableEntityTypes && extractableEntityTypes.length > 0
      ? extractableEntityTypes
      : DEFAULT_EXTRACTABLE_ENTITY_TYPES;
  // Pre-format both surfaces so the schema block and the human-readable intro
  // are guaranteed to stay in sync (single source of truth = `allowedTypes`).
  const allowedTypesEnum = allowedTypes.join(' | ');
  const allowedTypesIntro = humanJoin(allowedTypes.map(pluralize));
  // Per-type membership predicate. Used to gate prompt sections that teach
  // type-specific patterns (event metadata, task-and-event guideline, project-
  // as-subject example) — hiding them keeps the LLM from inventing emissions
  // the host has explicitly removed from the vocabulary.
  const allowedSet = new Set(allowedTypes);
  const allows = (t: string): boolean => allowedSet.has(t);

  // ---- Schema-block fragments gated by allowedTypes ----
  // The schema's `contextIds` hint list which types CAN bind to anchors. Only
  // mention the types the host allows; hide the field comment entirely if no
  // anchor-capable types remain (degenerate but defendable).
  const anchorBindingTypes = (['task', 'event', 'topic'] as const).filter(allows);
  const contextIdsSchemaHint =
    anchorBindingTypes.length > 0
      ? `      "contextIds": ["<local_label>"],   // for ${anchorBindingTypes.join('/')}: project / deal / meeting anchors — see rule 4\n`
      : '';
  // The metadata example comment block. Each line teaches type-specific
  // structural fields; we only render lines whose type is allowed.
  const metadataExampleLines: string[] = [];
  if (allows('task')) {
    metadataExampleLines.push(
      '        // task:  { "state": "proposed", "dueAt": "2026-04-30", "assigneeId": "<label>", "reporterId": "<label-when-committer≠assignee>", "priority": "high", "servesAnchorId": "<anchor_id>", "evidenceQuote": "<verbatim ≤200 char phrase from signal>" }',
    );
  }
  if (allows('event')) {
    metadataExampleLines.push(
      '        // event: { "startTime": "2026-05-01T10:00:00Z", "endTime": "...", "location": "...", "attendeeIds": ["<label>"] }',
    );
  }
  const metadataExamplesBlock =
    metadataExampleLines.length > 0
      ? `${metadataExampleLines.join('\n')}\n        // NOTE: do NOT put \`contextIds\` here — it's a top-level field on the mention.`
      : "        // No type-specific metadata fields apply to the allowed mention types in this run.";

  // ---- Guideline rule 4 gated by allowedTypes ----
  // The rule currently teaches "Tasks AND events are entities with metadata".
  // Soften the heading + drop bullet lines for types the host disallowed.
  const ruleFourTypes = (['task', 'event', 'topic'] as const).filter(allows);
  // Heading uses 'and' between Tasks/Events/Topics that ARE allowed. Single
  // type → "Tasks are entities with metadata" / "Events are …" / "Topics are
  // entities" etc. We capitalize pluralised forms locally so the heading reads
  // grammatically without per-type maps.
  const ruleFourHeadingNouns = ruleFourTypes.map((t) => {
    const plural = pluralize(t);
    return plural.charAt(0).toUpperCase() + plural.slice(1);
  });
  const ruleFourHeading =
    ruleFourHeadingNouns.length === 0
      ? null
      : ruleFourHeadingNouns.length === 1
        ? `${ruleFourHeadingNouns[0]} are entities with metadata — NOT a pile of facts.`
        : `${humanJoin(ruleFourHeadingNouns)} are entities with metadata — NOT a pile of facts.`;
  const ruleFourBullets: string[] = [];
  if (allows('task')) {
    ruleFourBullets.push(
      '   - **Task**: `{ type: "task", surface: "Send budget", identifiers: [{ "kind": "canonical", "value": "task:send-budget-2026-04-30" }], contextIds: ["<deal_label>", "<project_label>"], metadata: { "state": "proposed", "dueAt": "2026-04-30", "assigneeId": "<assignee_label>", "reporterId": "<committer_label-only-when-different-from-assignee>", "priority": "high", "evidenceQuote": "I\'ll get the budget over to you by Friday" } }`',
    );
  }
  if (allows('event')) {
    ruleFourBullets.push(
      '   - **Event**: `{ type: "event", surface: "Q3 Planning", contextIds: ["<project_label>"], metadata: { "startTime": "2026-05-01T10:00:00Z", "endTime": "...", "location": "...", "attendeeIds": ["<label>"] } }`',
    );
  }
  if (allows('topic')) {
    ruleFourBullets.push(
      '   - **Topic**: `{ type: "topic", surface: "ERP Renewal", contextIds: ["<parent_topic_or_project_label>"] }`',
    );
  }

  const source = signalSourceDescription ? `Source: ${signalSourceDescription}\n` : '';
  const scopeDescription = describeScope(targetScope ?? {});
  const preResolvedSection = renderPreResolvedBindings(preResolvedBindings);
  const knownSection = renderKnownEntities(knownEntities);
  const restraintSection = renderRestraintSection(
    eagerness,
    anchors,
    negativeExamples,
    anchorContextDescription,
  );
  const reconciliationMode = !!priorFacts && priorFacts.length > 0;
  const reconciliationSection = renderReconciliationSection(priorFacts);
  const factSchemaSuffix = eagerness ? renderFactSchemaSuffix(eagerness) : '';
  const topLevelJustification = eagerness?.requireJustification
    ? ',\n  "whyActionable": "<one sentence — REQUIRED only when mentions or facts are non-empty>"'
    : '';
  // Nonce-wrapped delimiters prevent signal-body injection. A raw `</signal_content>`
  // inside an attacker-controlled email body would otherwise close the tag and let
  // the rest of the body read as prompt instructions.
  const nonce = makeNonce();
  const openTag = `signal_content_${nonce}`;
  const closeTag = `/signal_content_${nonce}`;
  const priorOpenTag = `prior_thread_context_${nonce}`;
  const priorCloseTag = `/prior_thread_context_${nonce}`;
  const priorThreadSection = renderPriorThreadContext(
    priorThreadContext,
    priorOpenTag,
    priorCloseTag,
  );
  // Pick which signal-body rendering to use. `signalThread` (multi-signal) wins
  // when set; `signalText` (single-signal) is the default. Callers must pass
  // at least one — otherwise the prompt has no extraction target.
  const signalBody = signalThread && signalThread.length > 0
    ? renderSignalThread(signalThread, openTag, closeTag)
    : `<${openTag}>\n${signalText ?? ''}\n<${closeTag}>`;
  const operationsSchemaField = reconciliationMode
    ? ',\n  "operations": [\n' +
      '    // Reconciliation ops against `priorFacts`. Required when prior facts apply.\n' +
      '    { "op": "create", "subject": "<local_label>", "predicate": "...", "kind": "atomic|document", "value": "...", "objectId": "<local_label>", "details": "...", "evidenceQuote": "<verbatim quote from NEW content>" },\n' +
      '    { "op": "update", "factId": "<F-id from priorFacts>", "newValue": "<replacement value>", "evidenceQuote": "<verbatim quote>", "reason": "<short reason>" },\n' +
      '    { "op": "archive", "factId": "<F-id from priorFacts>", "evidenceQuote": "<verbatim quote>", "reason": "<short reason>" }\n' +
      '  ]'
    : '';
  // v3 (H5): when a registry is present, explicitly tell the LLM the
  // vocabulary is closed. The server still applies a fuzzy-mapping fallback
  // for near-misses, but the instruction here prevents most drift from ever
  // reaching the resolver.
  const predicateSection = predicateRegistry
    ? '\n\n' +
      predicateRegistry.renderForPrompt({
        maxPerCategory: maxPredicatesPerCategory,
        groupBy: subjectOfHintsEnabled ? 'subjectType' : 'category',
      }) +
      '\n\n**Use ONLY the predicates listed above. Do NOT invent new ones.** ' +
      'If no listed predicate is a perfect fit, pick the closest match and put ' +
      'the nuance in `details`. Unknown predicates are either auto-mapped to the ' +
      'nearest known name (possibly incorrectly) or dropped.'
    : '';

  // The subject-of section teaches non-person-subject extraction. Its
  // intro lists the kinds of subjects that benefit from this (projects /
  // organizations / events) — render only the kinds the host allows. The
  // positive example below uses whichever non-person subject is allowed:
  //   - `project` (preferred — strongest "subject-of" case)
  //   - else `organization`
  //   - else `topic`
  // If none of those are allowed, hide the section entirely (the LLM has no
  // non-person subject to teach about).
  const subjectOfSubjectKinds = (['project', 'organization', 'event', 'topic'] as const).filter(
    allows,
  );
  const subjectOfExampleType: 'project' | 'organization' | 'topic' | null =
    allows('project')
      ? 'project'
      : allows('organization')
        ? 'organization'
        : allows('topic')
          ? 'topic'
          : null;
  const subjectOfHintsSection =
    subjectOfHintsEnabled && subjectOfSubjectKinds.length > 0 && subjectOfExampleType
      ? `

## Subjects beyond persons

The default extraction style is \`(person, predicate, otherEntity)\`. That covers most work but starves ${humanJoin(subjectOfSubjectKinds.map(pluralize))} of descriptive content about THEMSELVES. When the signal contains durable information ABOUT the entity itself — its status, scope, character, evolving narrative — emit facts where that entity is the subject.

The predicate vocabulary above is grouped by subject type so you can see which predicates apply when (e.g. \`part_of\` for org structure, plus any subject-of predicates your host's registry adds). Predicates under \`generic\` accept any subject.

Restraint still applies. A casual mention of "ICOS" in passing does NOT warrant a fact whose subject is ICOS. Emit a subject-of fact only when the signal carries decision-relevant content ABOUT the entity itself — a status shift, a scope change, a capability statement, a learned characteristic. The bar is the same as for person-subject facts: durable knowledge, not chatter.

### Positive example — ${subjectOfExampleType} as subject

${
  subjectOfExampleType === 'project'
    ? `Signal: "The ICOS launch slipped to Q3 because we couldn't get the Microsoft connector through compliance review."

Correct extraction (one fact, project as subject):
\`\`\`json
{
  "mentions": {},
  "facts": [
    {
      "subject": "m_icos",
      "predicate": "status_summary",
      "value": "Launch slipped to Q3 due to Microsoft connector compliance review",
      "contextIds": ["m_microsoft"],
      "importance": 0.8,
      "confidence": 0.9,
      "kind": "atomic"
    }
  ]
}
\`\`\``
    : subjectOfExampleType === 'organization'
      ? `Signal: "Microsoft moved Acme from evaluating to active customer after the Q2 expansion."

Correct extraction (one fact, organization as subject):
\`\`\`json
{
  "mentions": {},
  "facts": [
    {
      "subject": "m_acme",
      "predicate": "current_engagement",
      "value": "active customer (Q2 expansion)",
      "contextIds": ["m_microsoft"],
      "importance": 0.8,
      "confidence": 0.9,
      "kind": "atomic"
    }
  ]
}
\`\`\``
      : `Signal: "The ERP renewal topic resurfaced — Oracle's pricing remains the open question."

Correct extraction (one fact, topic as subject):
\`\`\`json
{
  "mentions": {},
  "facts": [
    {
      "subject": "m_erp_renewal",
      "predicate": "status_summary",
      "value": "Open: Oracle pricing remains the blocker",
      "importance": 0.7,
      "confidence": 0.9,
      "kind": "atomic"
    }
  ]
}
\`\`\``
}

NOT — do not decompose into separate attribute facts (\`delayed_to: Q3\`, \`blocked_by: microsoft_connector\`, etc.). One subject-of fact with the narrative in \`value\`/\`details\`.`
      : '';

  return `You are extracting structured memory from a signal (email, message, document excerpt, etc.).
Your output populates a knowledge graph of entities (${allowedTypesIntro}) and facts (triples) about them.

## Signal
${source}Reference date: ${referenceDate.toISOString().slice(0, 10)}
Target scope: ${scopeDescription}
${priorThreadSection}${reconciliationSection}
${signalBody}
${preResolvedSection}${knownSection}${restraintSection}

## Output format
Return JSON with the following top-level keys:

{
  "mentions": {
    "<local_label>": {
      "surface": "<verbatim text as it appeared>",
      "type": "<${allowedTypesEnum}>",
      "identifiers": [{ "kind": "<email|domain|slack_id|phone|github|canonical|...>", "value": "..." }],
      "aliases": ["<alternate form nearby in text>"],
${contextIdsSchemaHint}      "metadata": {
        // Optional type-specific fields. ONLY set on first observation; the
        // resolver will NOT overwrite existing values on re-extraction.
${metadataExamplesBlock}
      }
    }
  },
  "facts": [
    {
      "subject": "<local_label>",
      "predicate": "<snake_case_relation>",
      "object": "<local_label>",          // for relational facts; set EITHER object OR value, never both
      "value": "<any JSON>",                // for attribute facts
      "details": "<optional free-text narrative>",
      "confidence": 0.0-1.0,
      "importance": 0.0-1.0,                // how much this matters long-term (0.5 default)
      "contextIds": ["<local_label>"],      // other entities this fact is "about"
      "kind": "atomic",                     // MUST be exactly "atomic" OR "document" — see Fact kinds below
      "validFrom": "YYYY-MM-DDTHH:MM:SSZ",  // ISO-8601; optional — see Validity period below
      "validUntil": "YYYY-MM-DDTHH:MM:SSZ", // ISO-8601; optional${factSchemaSuffix}
    }
  ]${operationsSchemaField}${topLevelJustification}
}

## Parsimony (most important)
Output AT MOST ONE fact per distinct piece of knowledge gained. Narrative context goes in \`details\` of that single fact, not into separate facts.

If the signal conveys nothing substantive (pleasantry, acknowledgment, auto-reply, routing banner), output empty arrays. **Zero facts is a valid — often correct — output.**

Expected fact counts by signal type:
- **Trivial** ("thanks!", "got it", calendar auto-reply): **0 facts**
- **Substantive single-topic** (one commitment, one decision, one observation): **1 fact**
- **Multi-topic** (two distinct commitments, a decision + a concern): **2 facts**
- **Long transcript / meeting recap**: **3–6 facts** — the salient decisions and commitments, NOT every sentence

### The world isn't a fact — do NOT emit participation, presence, or vague affect
The fact that an email/message/meeting exists at all is metadata the host already tracks — re-extracting it pollutes the graph with envelope noise. NEVER emit:
- "John emailed / cc-ed / messaged / called / met with / attended / hosted" — envelope and event-attendance data, captured elsewhere.
- "John mentioned X" / "John responded to Y" — per-message participation noise.
- "John acknowledged" / "John noted" / "John observed" / "John was engaged" / "John was thoughtful" — vague affect with no actionable content.

A fact must enable a decision. If you can't finish the sentence "the exec will use this to ___", drop it.

Extract only what carries durable knowledge that moves a tracked project, deal, or priority forward: **decisions, commitments (as Task entities), status changes, preferences, identity claims, substantive observations bound to a tracked priority**. The communication act itself is not a fact. The CONTENT of the communication — what was decided, promised, asked, or learned — is.

### Tasks ARE the commitment record
When the signal carries a commitment ("I'll send the budget Friday", "Sarah will own the launch deck"), emit it as a **Task mention** with the right \`assigneeId\` (and \`reporterId\` when the committer ≠ assignee). Do NOT also emit a separate "committed_to(person, task)" fact alongside the task — the Task entity IS the lineage record (canonical id + assignee + due + evidenceQuote). One commitment → one Task entity → zero parallel facts.

### Concerns and interests must bind to a tracked priority
\`expressed_concern\` / \`expressed_interest\` carry weight ONLY when the subject's concern/interest touches something the user is tracking (an active priority, a deal-shaped topic). Emit one of these facts ONLY when you can list the priority's anchor id (verbatim, from the "Active priorities" block above when shown) in the fact's \`contextIds\` — the resolver accepts raw anchor ids in \`contextIds\` alongside mention labels. Random venting, soft sentiment, or generic "they seem interested" → drop the fact entirely. The host's restraint guard enforces this and silently drops un-bound concern/interest facts.

## Tasks: ONE commitment = ONE task (do NOT decompose)
A single commitment, decision, or unblock-request becomes a SINGLE task — even when it spans multiple sub-actions, integrations, or deliverables. The Decision Queue is a tool for the executive: 7 cards for one conversation is rejection territory.

- "Set up Microsoft, Google, Slack, and Zoom integrations on test/staging" → ONE task, not four.
- "Grant Ekaterina access so she can configure the integrations" → ONE task ("Grant Ekaterina access to test/staging"), not three (one per integration + one for access + one for verification).
- "Merge Jovan's PRs and run the EKE demo" → if both fall under the same person/timeline, ONE task ("Prepare EKE demo: merge PRs and run"). Two genuinely independent commitments → two tasks.

The narrative or evidence quote captures the sub-actions inside the task body; the task surface names the decision. Sub-action detail belongs in the task mention's \`metadata.evidenceQuote\` (verbatim grounding) and the downstream narrative — NOT in additional task mentions or parallel facts.

### Negative example — TASK OVER-DECOMPOSITION (frequent failure mode)
Signal (single email): "Ekaterina will set up Microsoft, Google, Slack, and Zoom integrations on test and staging as soon as Vitaly grants her access."

BAD output (5 tasks for one commitment):
- \`task: Set up Microsoft integration on test/staging\`
- \`task: Set up Google integration on test/staging\`
- \`task: Set up Slack integration on test/staging\`
- \`task: Set up Zoom integration on test/staging\`
- \`task: Grant Ekaterina access\`

CORRECT output (one actionable task — the unblock):
- \`task: Grant Ekaterina test/staging access (so she can configure Microsoft/Google/Slack/Zoom integrations)\`

The thing the EXEC can act on is granting access. The integrations are downstream of that and belong in the task narrative, not as separate cards.

### Negative example — DO NOT DO THIS
Signal: "Hi Sarah, we need to discuss ERP renewal. Worried Oracle's pricing won't work for our Q3 budget priority. Can we meet Thursday? – John"

BAD output (4 facts where the Task entity is already the record):
- \`(john, met_with, sarah)\`              ← envelope/event metadata; not a fact
- \`(john, mentioned, oracle)\`             ← per-message participation noise
- \`(john, expressed_concern, "Oracle pricing")\` ← MISSING priority \`contextIds\` link → dropped
- \`(john, acknowledged, sarah)\`           ← vague affect with no actionable content

### Positive example
Same signal. CORRECT output:
\`\`\`json
{
  "mentions": {
    "t1": {
      "surface": "Meet Sarah about ERP renewal",
      "type": "task",
      "identifiers": [{ "kind": "canonical", "value": "task:meet-sarah-erp-renewal-2026-THU" }],
      "contextIds": ["m_sarah", "topic_erp_renewal_label"],
      "metadata": { "state": "proposed", "assigneeId": "m_john", "dueAt": "2026-THU" }
    }
  },
  "facts": [
    {
      "subject": "m_john",
      "predicate": "expressed_concern",
      "value": "Oracle pricing won't work for the ERP renewal under the Q3 budget priority",
      "contextIds": ["<priority_anchor_id_from_active_priorities>"],
      "importance": 0.7,
      "confidence": 0.85,
      "kind": "atomic"
    }
  ]
}
\`\`\`

One Task entity (the actionable decision) and one fact (the concern, BOUND to the tracked priority via \`contextIds\`). The narrative (proposal + scheduling) lives in the task's metadata — no parallel \`met_with\` or \`mentioned\` facts. Fact-level \`contextIds\` here is doing real work: the concern only earns its place because it ties to something the user tracks. A concern not tied to any priority → drop the fact entirely.${subjectOfHintsSection}

## Fact kinds
Every fact must set \`kind\` to **exactly one** of these two values — no others are accepted by the storage layer:

- **"atomic"** — a single triple (subject, predicate, value | object). Short, structured, scalar. DEFAULT choice.
  - attributes: \`{predicate: "current_title", value: "CFO"}\`
  - relations: \`{predicate: "reports_to", object: "m3"}\`
  - short observations (when priority-bound — see rule above): \`{predicate: "expressed_concern", details: "timeline risk on Q3 launch", contextIds: ["<priority_anchor_id_from_active_priorities>"]}\`

- **"document"** — long-form narrative about the subject (multi-sentence prose: a procedure, rationale, research finding, meeting recap). Use when the content is a coherent piece of text rather than a discrete datum.
  - \`{predicate: "research_note", details: "When users ask for tax calculations, always clarify the jurisdiction before quoting rates because …", kind: "document"}\`
  - \`{predicate: "meeting_notes", details: "Attendees agreed on Q3 launch date; Alice owns …", kind: "document"}\`
  - \`{predicate: "memo", details: "Short rationale, decision context, or guidance worth keeping on the subject entity.", kind: "document"}\`

Do **NOT** invent other values (e.g. "note", "observation", "insight"). Unknown kinds are rejected or silently coerced to "atomic" downstream — you lose control either way.

## Validity period
Facts carry time-boxed relevance. Set \`validUntil\` when the fact stops being true; leave it undefined for timeless facts. \`validFrom\` defaults to the fact's observation time — only set it explicitly when the fact becomes true in the FUTURE or had a start date in the past distinct from observation.

Calibration:
- **Ephemeral** (today-only, session-bounded): \`validUntil\` = end of today. Examples: "working from home today", "out of office until 5pm".
- **Task-bounded**: \`validUntil\` = expected completion / due date. Examples: "owns" (for a time-boxed project role), "blocked_by" (clears when the blocking task completes).
- **Project/quarter-bounded**: \`validUntil\` = project or quarter end. Examples: "rotating_oncall", "Q3 priority".
- **Identity / employment / long-lived**: leave \`validUntil\` undefined. Examples: "works_at", "current_title", "located_in" (unless the user qualified it).
- **Superseded by a later fact** (role change, preference change): leave \`validUntil\` undefined here — use \`supersedes\` in the new fact.

When unsure, PREFER leaving \`validUntil\` undefined over guessing — a too-early expiry silently hides the fact from queries. Queries that filter by \`asOf\` treat "no validUntil" as "valid forever".

Note: the storage layer auto-stamps a default \`validUntil\` for known ephemeral/episodic predicates (commitments, scheduled events, expressed concerns, attendance) based on their registered lifecycle. Setting \`validUntil\` here only overrides that default — needed when you have a specific deadline ("by Friday") or want to keep an ephemeral fact alive longer than the default.

## Guidelines
1. **Mentions, not IDs.** The LLM never sees entity IDs. Use local labels like "m1", "m2" to reference entities within this extraction. The system will resolve labels to existing entities or create new ones. If the prompt contains a "Pre-resolved labels" block, those labels are already bound — reference them directly in \`facts\` and DO NOT redeclare them in \`mentions\`.
2. **Strong identifiers.** Extract every strong identifier you can (email, domain, slack_id, github). These are the best signal for deduplication.
3. **Capture surface variants.** If the text uses "Microsoft" and "MSFT" for the same org, include both under the mention's \`aliases\`.
4. **${ruleFourHeading ?? 'Entities with metadata, NOT a pile of facts.'}**
   Mention-level \`metadata\` carries the structural fields. Do NOT restate them as separate facts.
${ruleFourBullets.join('\n')}
   A task entity is self-sufficient: WHO will execute (\`assigneeId\`), WHEN it's due (\`dueAt\`), what state (\`state\`), priority (\`priority\`), the verbatim grounding (\`evidenceQuote\`), AND the multi-entity binding (\`contextIds\`) all live on the task. The originating signal is stamped automatically by the host. Do NOT emit a separate \`committed_to(person, task)\` fact alongside an extracted task — the task entity IS the record.

   **Multi-entity binding via \`contextIds\` (${anchorBindingTypes.join(' / ')}):** when the task lives within a larger context — a deal, a project, a meeting, a parent topic — list those mention labels in the task's top-level \`contextIds\` array. The resolver translates labels to entity ids and unions them onto the task's persistent contextIds. Re-extraction of the same canonical task with new contextIds *adds* to the existing set (never overwrites). The task then surfaces on \`getContext\` queries about ANY of those anchors. Use this instead of fact-level contextIds for entity-to-entity "lives within" bindings — fact-level contextIds is reserved for binding a single FACT to multiple anchors (e.g. "approved Q3 budget" touching both the JPM and Microsoft deals).

   **Third-party commitments via \`reporterId\`:** when the person who *committed* the task is DIFFERENT from the person who will *execute* it, set \`metadata.reporterId\` to the committer's mention label and \`metadata.assigneeId\` to the executor's. Examples:
   - Transcript: "Anton: Sarah will own the launch deck." → \`assigneeId: m_sarah\`, \`reporterId: m_anton\`.
   - Email from John: "I've asked Lily to draft the brief by Friday." → \`assigneeId: m_lily\`, \`reporterId: m_john\`.
   - Self-commitment: "I'll send the budget tomorrow." → \`assigneeId: m_self\`, OMIT \`reporterId\`.
   This makes \`resolveRelatedTasks(committerId)\` return the task natively (library queries both \`assigneeId\` and \`reporterId\`) — no separate \`committed_to(person, task)\` fact needed. Omit \`reporterId\` when committer === assignee.

   **Task state lives on \`metadata.state\`.** Set it on the mention at creation time (\`"state": "proposed" | "in_progress" | "blocked" | "done" | "cancelled" | ...\`). Do NOT emit a state-transition fact for a task — transitions are host-driven via \`MemorySystem.transitionTaskState\`. Re-extractions of the same task do not overwrite an existing state (the metadata merge is conservative \`fillMissing\`).

   Inter-entity relational facts — \`blocked_by\` (task↔task)${allows('event') ? ', `prepares_for` (task↔event)' : ''}, \`depends_on\` (task↔task) — remain the right shape because they relate TWO entities and cannot live on either side's metadata alone. Single-entity attributes (state, due date, priority, creation, completion timestamp, evidence quote, assignee) belong on the entity, not as facts. Cancellation cause is NOT a fact — it is deterministic pipeline state recorded on the cancelled task's metadata, not LLM-extracted.

   **REQUIRED canonical identifier on every task mention.** Tasks have no natural strong identifier (unlike a person's email or a domain). Without a canonical id, the same commitment seen across multiple signals (thread replies, transcripts, follow-ups) creates duplicate task entities — a known production bug pattern. So every \`type: "task"\` mention MUST include:

   \`\`\`
   "identifiers": [{ "kind": "canonical", "value": "task:<verb>-<key-noun>-<YYYY-MM-DD>" }]
   \`\`\`

   - \`<verb>\`: short imperative — \`grant\`, \`merge\`, \`send\`, \`review\`, \`schedule\`, \`unblock\`, \`prep\`.
   - \`<key-noun>\`: the most identifying object phrase, lowercased and hyphen-separated, ≤ 4 words. The PERSON, ORG, or ARTIFACT that uniquely identifies the commitment — NOT every detail.
   - \`<YYYY-MM-DD>\`: the task's due date if known; otherwise the date this commitment was first made (typically the signal's reference date).

   Examples:
   - "Grant Ekaterina access to test/staging" (made 2026-05-06) → \`task:grant-ekaterina-access-2026-05-06\`
   - "Send Q3 budget to Sarah by Apr 30" → \`task:send-q3-budget-2026-04-30\`
   - "Merge Jovan's PRs for EKE demo" (made 2026-05-06) → \`task:merge-jovan-prs-2026-05-06\`

   Same commitment surfaced across multiple signals MUST yield the SAME canonical id — that's how the resolver dedupes. If the second signal merely re-references an existing commitment (a thread reply, a meeting follow-up), produce the SAME canonical id you'd produce from the original; the system will merge into the existing task entity.
5. **Fact-level \`contextIds\` vs. entity-level \`contextIds\` — pick the right level.**
   - **Entity-level** (\`mention.contextIds\`, top of the mention object): the *entity itself* lives within these anchors. Set on task/event/topic mentions when they have a parent deal/project/meeting/topic. Example: a task created during a deal's negotiation gets the deal's label on \`mention.contextIds\`. **This is the default for binding a task to its surrounding work.**
   - **Fact-level** (\`fact.contextIds\`, on a fact): a *single fact* is about multiple entities at once — e.g. "(Anton, approved, Q3 Budget)" with \`contextIds: ["jpm_deal", "ms_deal"]\` because the approval is materially about both deals. Rare; usually only when one decision/observation legitimately spans multiple anchors that aren't subject or object.
   When in doubt, prefer entity-level. The task entity surfaces on a deal's view either way; doubling up adds noise.
6. **Importance calibration.**
   - 1.0: identity-level facts ("X is CEO", "X works at Y")
   - 0.7: significant decisions, commitments, state changes
   - 0.5: default / observed topics
   - 0.2: trivial / ephemeral observations
7. **Confidence** reflects how sure you are the fact is TRUE, not how important it is.
8. **One observation = one fact.** If the same fact is stated multiple times, emit it once.
9. **Skip pleasantries, greetings, boilerplate.** Extract only what carries knowledge.
10. **Output ONLY the JSON.** No surrounding prose, no code fences.${predicateSection}`;
}

// -------------------------------------------------------------------------

/**
 * English pluralisation good enough for the intro list — entity-type names are
 * short, lowercase, ASCII, and curated by the caller. Handles the few endings
 * that come up in practice ("organization" → "organizations", "person" →
 * "people", "story" → "stories"). Unknown ending → naive `+ "s"`.
 */
function pluralize(word: string): string {
  if (word === 'person') return 'people';
  if (word.endsWith('y')) return `${word.slice(0, -1)}ies`;
  if (word.endsWith('s')) return `${word}es`;
  return `${word}s`;
}

/** Join a list with Oxford-comma "a, b, and c". For the intro line. */
function humanJoin(words: readonly string[]): string {
  if (words.length === 0) return '';
  if (words.length === 1) return words[0] ?? '';
  if (words.length === 2) return `${words[0] ?? ''} and ${words[1] ?? ''}`;
  return `${words.slice(0, -1).join(', ')}, and ${words[words.length - 1] ?? ''}`;
}

function describeScope(scope: ScopeFields): string {
  if (!scope.groupId && !scope.ownerId) return 'global (visible to all)';
  if (scope.ownerId && !scope.groupId) return `user-private (owner=${scope.ownerId})`;
  if (scope.groupId && !scope.ownerId) return `group-wide (group=${scope.groupId})`;
  return `user-private within group (group=${scope.groupId}, owner=${scope.ownerId})`;
}

/**
 * Render the prior-thread context block — earlier messages in the same thread
 * whose facts have already been extracted in prior pipeline runs. The LLM
 * must use this as background ONLY (resolving "she", binding follow-ups to
 * already-extracted commitments via canonical id) and MUST NOT extract from
 * it. Wrapped in a nonce-tagged delimiter to defend against the same
 * prompt-injection class as the main signal body.
 */
function renderPriorThreadContext(
  context: Array<{ header: string; body: string }> | undefined,
  openTag: string,
  closeTag: string,
): string {
  if (!context || context.length === 0) return '';
  const blocks = context
    .map((c) => `--- ${c.header} ---\n${c.body.trim()}`)
    .join('\n\n');
  return `\n## Prior thread context (background only — DO NOT extract from this)
The messages below are earlier turns in the SAME conversation. Their facts have ALREADY been extracted in prior pipeline runs. Treat them as background ONLY:

- Use them to resolve pronouns ("she", "the deal", "that PR") in the new message.
- Use them to recognise that a commitment in the new message is a follow-up to an existing task — emit the SAME canonical id you'd produce from the original (per rule 4), so the resolver merges into the existing entity instead of creating a duplicate.
- Do NOT emit facts or task mentions whose source is exclusively this prior content. The signal_content block (further below) is the extraction target. The prior_thread_context block is reference material.

<${openTag}>
${blocks}
<${closeTag}>
`;
}

function renderPreResolvedBindings(bindings?: PreResolvedBinding[]): string {
  if (!bindings || bindings.length === 0) return '';
  const lines = bindings.map((b) => {
    const idStr = b.entity.identifiers
      .slice(0, 2)
      .map((i) => `${i.kind}=${i.value}`)
      .join(', ');
    const role = b.role ? `${b.role}: ` : '';
    const identity = idStr ? ` (${idStr})` : '';
    return `- \`${b.label}\` — ${role}${b.entity.type} "${b.entity.displayName}"${identity}`;
  });
  const maxIndex = bindings
    .map((b) => {
      const m = /^m(\d+)$/.exec(b.label);
      return m ? Number(m[1]) : 0;
    })
    .reduce((a, b) => (b > a ? b : a), 0);
  const nextHint =
    maxIndex > 0
      ? `When introducing NEW entities from the signal body, start labels at \`m${maxIndex + 1}\`.`
      : 'When introducing NEW entities from the signal body, choose labels that do not collide with the ones above.';
  return `\n## Pre-resolved labels
The following local labels are ALREADY bound to entities in the knowledge graph. Reference them directly in \`facts\`. DO NOT redeclare them in \`mentions\`.

${lines.join('\n')}

${nextHint}\n`;
}

/**
 * Render the "Known entities" block with type-aware details. Tasks surface
 * `state` + `dueAt`; events surface `startTime` + `endTime`; other types get
 * the generic type + identifier rendering.
 *
 * The rendered block instructs the LLM to reuse these entities' surface forms
 * so the resolver converges on existing rows rather than creating duplicates.
 */
/**
 * Prompt render budget for the `knownEntities` block. Callers MUST pass
 * entities already ranked by relevance — this is the renderer cap, not the
 * retrieval cap. The list still slices for absolute safety, but if the
 * caller hasn't ranked, the top of the slice is whatever order they passed.
 *
 * Bumped 40 → 60 (2026-05-28) — see icos `feedback_no_silent_truncation`:
 * 40 was too tight for executive-scale graphs where deterministic baseline
 * (participants, priorities, lineage) plus semantic top-K easily exceeds 40.
 */
const KNOWN_ENTITIES_RENDER_BUDGET = 60;

function renderKnownEntities(entities?: IEntity[]): string {
  if (!entities || entities.length === 0) return '';
  const lines = entities.slice(0, KNOWN_ENTITIES_RENDER_BUDGET).map(formatKnownEntity).join('\n');
  return `\n## Known entities (reuse their surface forms when referring to them — the resolver will converge on the existing row)\n${lines}\n`;
}

function formatKnownEntity(e: IEntity): string {
  const idStr = e.identifiers
    .slice(0, 2)
    .map((i) => `${i.kind}=${i.value}`)
    .join(', ');
  const md = (e.metadata ?? {}) as Record<string, unknown>;
  const detail = typeSpecificDetail(e.type, md);
  const parts: string[] = [];
  if (detail) parts.push(detail);
  if (idStr) parts.push(idStr);
  const suffix = parts.length > 0 ? ` (${parts.join(' | ')})` : '';
  return `- ${e.type}: "${e.displayName}"${suffix}`;
}

function typeSpecificDetail(type: string, md: Record<string, unknown>): string | null {
  if (type === 'task') {
    const bits: string[] = [];
    if (typeof md.state === 'string') bits.push(`state: ${md.state}`);
    const due = md.dueAt;
    if (due) bits.push(`due: ${formatDateMaybe(due)}`);
    return bits.join(', ') || null;
  }
  if (type === 'event') {
    const bits: string[] = [];
    const start = md.startTime;
    if (start) bits.push(`start: ${formatDateMaybe(start)}`);
    const end = md.endTime;
    if (end) bits.push(`end: ${formatDateMaybe(end)}`);
    return bits.join(', ') || null;
  }
  return null;
}

function formatDateMaybe(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 16) + 'Z';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return new Date(v).toISOString().slice(0, 16) + 'Z';
  return String(v);
}

/** Short random token — makes delimiter tags unguessable so attacker-controlled
 *  signal text cannot close them. Not a security boundary on its own; the
 *  prompt still leans on the model following instructions. */
function makeNonce(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Render the v5 "Restraint" section. Only emits when an `EagernessProfile` is
 * supplied — chatty/no-eagerness callers see the v4 prompt unchanged.
 *
 * The section reframes the LLM's job: silence is the easy answer; output
 * requires explicit justification, evidence, and (when configured) a binding
 * to an active priority anchor.
 */
function renderRestraintSection(
  eagerness: EagernessProfile | undefined,
  anchors: Anchor[] | undefined,
  negativeExamples: Array<{ snippet: string; reason?: string }> | undefined,
  anchorContextDescription: string | undefined,
): string {
  if (!eagerness) return '';

  // Skip the section entirely when no flag is gating anything — otherwise
  // chatty callers that pass `EAGERNESS_PRESETS.chatty` get the preamble
  // for no reason and burn tokens on every call. The "chatty" preset is
  // semantically equivalent to "no eagerness profile".
  const nCount = Math.max(0, Math.min(5, eagerness.negativeExamplesCount | 0));
  const willRenderNegatives =
    nCount > 0 && !!negativeExamples && negativeExamples.length > 0;
  const hasAnyRestraint =
    eagerness.requireJustification ||
    eagerness.requireEvidenceQuote !== 'off' ||
    eagerness.requirePriorityBinding !== 'off' ||
    willRenderNegatives;
  if (!hasAnyRestraint) return '';

  const lines: string[] = [];
  lines.push('');
  lines.push('## Restraint posture');
  lines.push(
    'Silence is the **easy answer**. Output requires evidence and (where configured) a binding to an active priority anchor. Acting needs justification; skipping does not. If the signal is thin or noisy, prefer empty arrays.',
  );

  if (eagerness.requireJustification) {
    lines.push('');
    lines.push(
      '- `whyActionable` (top-level): when `mentions` or `facts` is non-empty, write ONE short sentence (≤ 25 words) saying why this is worth the user\'s attention. Omit when both are empty. Padding triggers rejection.',
    );
  }

  if (eagerness.requireEvidenceQuote === 'soft') {
    lines.push(
      '- `evidenceQuote` (per fact, recommended): a verbatim phrase from the signal supporting the fact. Improves auditability; absence is allowed but discouraged.',
    );
  } else if (eagerness.requireEvidenceQuote === 'strict') {
    lines.push(
      '- `evidenceQuote` (per fact, REQUIRED): a verbatim phrase (≤ 200 chars) from the signal that directly supports the fact. Facts without an evidence quote will be DROPPED. Do not paraphrase. Do not synthesize. Quote the source.',
    );
  }

  if (eagerness.requirePriorityBinding !== 'off' && anchors && anchors.length > 0) {
    lines.push('');
    lines.push(
      eagerness.requirePriorityBinding === 'strict'
        ? "### Priority binding (REQUIRED for task mentions)"
        : '### Priority binding (preferred for task mentions)',
    );
    const anchorContext = sanitizeInlineString(
      anchorContextDescription ?? 'The active priorities for this extraction context',
    );
    lines.push(
      `${anchorContext}. For every \`task\` mention, include \`metadata.servesAnchorId\` set to one of these ids:`,
    );
    for (const a of anchors) {
      const kind = a.kind ? ` [${sanitizeInlineString(a.kind)}]` : '';
      const meta = renderAnchorMetadata(a.metadata);
      // Anchor labels often originate from user-editable settings or free
      // text. Sanitize to defang headings/code-fences that could prematurely
      // close the prompt structure or inject pseudo-instructions.
      lines.push(
        `- \`${sanitizeInlineString(a.id)}\`${kind} — ${sanitizeInlineString(a.label)}${meta}`,
      );
    }
    lines.push('');
    lines.push(
      'Bind by SEMANTIC alignment: completing the task must MATERIALLY ADVANCE the priority\'s stated outcome. Sharing a person, organization, topic, deal, project, domain, or keyword with a priority is NOT alignment.',
    );
    if (eagerness.requirePriorityBinding === 'strict') {
      lines.push(
        'When a task semantically advances a priority, set `servesAnchorId`. When it does not, OMIT the field — the host will score the task as FYI but keep it in the knowledge graph.',
      );
    } else {
      lines.push(
        'When a task plausibly serves a priority, set `servesAnchorId`. When it does not, omit the field — do not invent a binding.',
      );
    }
  } else if (eagerness.requirePriorityBinding === 'strict') {
    // Strict binding requested but no anchors available. Priority binding is
    // a SCORING input downstream, not an extraction gate — tasks always
    // extract. The host renders unbound tasks at lower urgency/importance
    // (typically FYI quadrant) but keeps them in the knowledge graph so
    // they're available when priorities later land.
    lines.push('');
    lines.push('### No active priorities');
    lines.push(
      'This extraction context has no active priorities right now. Extract tasks normally — omit `metadata.servesAnchorId` since there are no priorities to bind to. Unbound tasks still belong in the knowledge graph; the host scores them at lower priority.',
    );
  }

  if (willRenderNegatives && negativeExamples) {
    lines.push('');
    lines.push('### Calibration — items the user has DISMISSED before');
    lines.push(
      'Patterns matching these recent dismissals are LOW value for this user. If a candidate task closely resembles them, drop it.',
    );
    // Negative examples come from prior LLM-extracted dismissals, which can
    // ultimately trace back to attacker-controlled signal bodies (emails,
    // scraped pages). Sanitize before splicing into the system prompt so a
    // crafted snippet can't open a fake instruction block.
    for (const ex of negativeExamples.slice(0, nCount)) {
      const reasonStr = ex.reason
        ? `  (reason: ${sanitizeInlineString(ex.reason)})`
        : '';
      lines.push(`- "${sanitizeInlineString(ex.snippet)}"${reasonStr}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Schema-suffix appended inside each fact object. Adds an `evidenceQuote`
 * field comment when the profile asks for it. Empty string under chatty mode.
 */
function renderFactSchemaSuffix(eagerness: EagernessProfile): string {
  if (eagerness.requireEvidenceQuote === 'off') return '';
  const requirement =
    eagerness.requireEvidenceQuote === 'strict'
      ? '<verbatim phrase from the signal — REQUIRED, ≤200 chars>'
      : '<verbatim phrase from the signal — recommended>';
  return `\n      "evidenceQuote": "${requirement}"`;
}

/**
 * Defang a single-line string before splicing into the prompt. Caps length,
 * collapses newlines (so a crafted multi-line snippet can't open a fake
 * heading or code fence on a fresh line), strips backticks (which would
 * close our inline `code` spans), and removes the markdown heading prefix
 * `#` at line start. Not a security boundary — the LLM still has to follow
 * instructions — but raises the bar for prompt-injection via
 * attacker-derived strings (anchor labels, negative-example snippets).
 */
function sanitizeInlineString(s: unknown): string {
  // Runtime guard: callers pass anchor labels / negative-example snippets /
  // `f.details` from `renderReconciliationSection`, all typed `string` — but
  // MongoDB-sourced data can legitimately violate that. Deterministic writers
  // (e.g. event-change diffs) store structured `details` objects, and older
  // facts can carry `undefined`. Coerce defensively so one non-string field
  // never kills prompt construction (mirrors `escapeQuotes` in
  // entityReconciliationPrompt.ts).
  const str =
    typeof s === 'string' ? s : s === undefined || s === null ? '' : safeStringify(s);
  const noBreaks = str.replace(/[\r\n]+/g, ' ');
  const noFences = noBreaks.replace(/`/g, "'");
  const noHeading = noFences.replace(/^[\s>#]+/, '').trimStart();
  return noHeading.trim();
}

function safeStringify(s: unknown): string {
  try {
    return JSON.stringify(s);
  } catch {
    return String(s);
  }
}

/**
 * Render anchor metadata (weight / horizon / deadline) as a parenthesized
 * fragment for inline appending to the anchor's prompt line. Returns an empty
 * string when no recognized fields are present. Defangs string values through
 * `sanitizeInlineString` because anchor labels and metadata trace back to
 * user-controlled settings text.
 *
 * Schema (loose — anchor metadata is `Record<string, unknown>`):
 *   weight:   number, finite — rendered as `weight=0.85`
 *   horizon:  string         — rendered as `horizon=Q` (capped 8 chars)
 *   deadline: ISO date string — rendered as `deadline=2026-06-30` (capped 30 chars)
 */
function renderAnchorMetadata(md: Record<string, unknown> | undefined): string {
  if (!md) return '';
  const parts: string[] = [];
  if (typeof md.weight === 'number' && Number.isFinite(md.weight)) {
    parts.push(`weight=${md.weight.toFixed(2)}`);
  }
  if (md.horizon !== undefined && md.horizon !== null) {
    parts.push(`horizon=${sanitizeInlineString(String(md.horizon)).slice(0, 8)}`);
  }
  if (md.deadline !== undefined && md.deadline !== null) {
    parts.push(`deadline=${sanitizeInlineString(String(md.deadline)).slice(0, 30)}`);
  }
  if (parts.length === 0) return '';
  return `  (${parts.join(', ')})`;
}

/**
 * Render a multi-signal conversation thread inside a single nonce-wrapped
 * block. Each message gets a header line so the LLM can cite individual
 * messages in evidenceQuote/reason fields.
 */
function renderSignalThread(
  thread: SignalThreadMessage[],
  openTag: string,
  closeTag: string,
): string {
  const blocks = thread.map((m) => {
    const from = m.sender ? `, from ${m.sender}` : '';
    const ts = m.observedAt instanceof Date ? m.observedAt.toISOString() : String(m.observedAt);
    return `--- signal:${m.id} (${ts}${from}) ---\n${m.body.trim()}`;
  });
  return `<${openTag}>\n${blocks.join('\n\n')}\n<${closeTag}>`;
}

/**
 * Render the reconciliation block. Emitted when `priorFacts` is non-empty.
 * Tells the LLM that the listed facts are PRIOR knowledge and instructs it to
 * emit `operations` (create / update / archive) reconciling those facts against
 * the new signal content.
 */
function renderReconciliationSection(priorFacts: IFact[] | undefined): string {
  if (!priorFacts || priorFacts.length === 0) return '';

  const lines: string[] = [];
  lines.push('');
  lines.push('## Prior facts to reconcile');
  lines.push(
    'The following facts were already extracted from EARLIER signals on this same conversation/thread.',
  );
  lines.push(
    'Decide what the NEW signal content (in `<signal_content_*>`) implies for each:',
  );
  lines.push('');
  lines.push('- **archive** — fact is now resolved/closed/contradicted by the new content.');
  lines.push('- **update** — fact\'s value changed (in-place mutation, no tombstone).');
  lines.push('- **create** — brand-new fact that isn\'t covered by any prior. (Use the regular `facts` array OR an `operations.create` op.)');
  lines.push('');
  lines.push('If a prior fact is still accurate, emit NO operation for it. Silence = "still true".');
  lines.push('Every `archive`/`update` op MUST cite a verbatim quote from NEW content as `evidenceQuote` and a short `reason`.');
  lines.push('Hallucinated factIds (not in the list below) will be REJECTED. Use the literal `id` values shown.');
  lines.push('');

  for (const f of priorFacts) {
    const valueOrObject = f.objectId
      ? ` object=${f.objectId}`
      : f.value !== undefined
        ? ` value=${truncateInline(stringifyForPrompt(f.value), 120)}`
        : '';
    const detailsBit = f.details
      ? ` details="${truncateInline(sanitizeInlineString(f.details), 100)}"`
      : '';
    const evidenceBit = f.evidenceQuote
      ? ` evidence="${truncateInline(sanitizeInlineString(f.evidenceQuote), 80)}"`
      : '';
    const observedBit = f.observedAt instanceof Date
      ? ` observed=${f.observedAt.toISOString().slice(0, 10)}`
      : '';
    lines.push(
      `- F[${f.id}] subject=${f.subjectId} predicate=${f.predicate}${valueOrObject}${detailsBit}${observedBit}${evidenceBit}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

function stringifyForPrompt(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function truncateInline(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
