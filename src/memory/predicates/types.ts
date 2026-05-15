/**
 * Predicate library — types.
 *
 * A `PredicateDefinition` describes one predicate in the vocabulary: its
 * canonical name, description, category, and optional write-time behavior
 * (defaultImportance, auto-supersession for single-valued predicates,
 * aggregate semantics) plus ranking weight and LLM-prompt metadata.
 *
 * The registry is *optional*. When no registry is configured on MemorySystem,
 * predicates remain free-form strings — nothing in the memory layer breaks.
 */

/**
 * Temporal/relevance class for a predicate. Governs default `validUntil`
 * stamping on `addFact` and (optionally) extraction-prompt rendering.
 *
 * - 'stable'    — identity / structural / decision facts that remain true
 *                  indefinitely. No `defaultValidityDays`. Examples:
 *                  works_at, knows, profile, tracks_priority.
 *
 * - 'stateful'  — current-value snapshot, expected to be replaced by a newer
 *                  one over time. Typically `singleValued: true`. No
 *                  `defaultValidityDays` — supersession handles obsolescence.
 *                  Examples: current_title, has_status, has_due_date.
 *
 * - 'ephemeral' — time-bounded assertion (a commitment, a scheduled event,
 *                  an expressed concern). `defaultValidityDays` should be set
 *                  so the fact auto-expires when the window passes.
 *                  Examples: committed_to, scheduled_for, expressed_concern.
 *
 * - 'episodic'  — transient observation about a moment (per-message comms,
 *                  passing mentions). Cheap to capture, cheap to lose.
 *                  Short `defaultValidityDays`; often
 *                  `excludeFromExtractionPrompt: true` to keep extractors
 *                  from emitting them in the first place.
 *                  Examples: emailed, cc_ed, mentioned, noted.
 *
 * Lifecycle is optional — predicates without one behave exactly as before.
 */
export type PredicateLifecycle = 'stable' | 'stateful' | 'ephemeral' | 'episodic';

export interface PredicateDefinition {
  /** Canonical snake_case name — the id. */
  name: string;

  /** One-line description shown in the LLM prompt + docs. */
  description: string;

  /** Grouping used for prompt chunking (e.g. 'identity', 'task', 'communication'). */
  category: string;

  /**
   * What shape of payload this predicate expects. Informational — memory
   * layer does not enforce it (permissive by design).
   */
  payloadKind?: 'relational' | 'attribute' | 'narrative';

  /** Typing hint surfaced in the LLM prompt. Not enforced at write time. */
  subjectTypes?: string[];
  objectTypes?: string[];

  /** Reverse predicate (e.g. 'reports_to' ↔ 'manages'). Informational only. */
  inverse?: string;

  /**
   * Other surface forms that canonicalize to this predicate. Lowercased at
   * register time; lookup is case-insensitive.
   */
  aliases?: string[];

  /** 0..1. Applied to IFact.importance when the writer omits it. */
  defaultImportance?: number;

  /**
   * Multiplier in Ranking.scoreFact. Folded into RankingConfig.predicateWeights
   * by PredicateRegistry.toRankingWeights. User-supplied weights always win.
   */
  rankingWeight?: number;

  /**
   * Aggregate predicates (counters, sums) — update in place, never supersede.
   * Mutually exclusive with singleValued.
   */
  isAggregate?: boolean;

  /**
   * Single-valued predicates (e.g. current_title). Writing a new fact
   * auto-supersedes the prior visible one for (subject, predicate). Can be
   * disabled globally via MemorySystemConfig.predicateAutoSupersede:false.
   * Mutually exclusive with isAggregate.
   */
  singleValued?: boolean;

  /** Shown to the LLM in the prompt to disambiguate. Keep ≤ 2 per predicate. */
  examples?: string[];

  /**
   * Temporal/relevance class. Drives `addFact`'s `validUntil` auto-stamping
   * and extraction-prompt rendering. See `PredicateLifecycle` for semantics.
   * Optional — undefined means "no automatic lifecycle behavior."
   */
  lifecycle?: PredicateLifecycle;

  /**
   * When set, `addFact` stamps `validUntil = (observedAt ?? now) + days`
   * on facts of this predicate that the caller did not provide a `validUntil`
   * for. Callers can always override by passing `validUntil` explicitly.
   *
   * Use with care: a too-short window silently archives facts that callers
   * may still want surfaced. Pair with `lifecycle: 'ephemeral' | 'episodic'`.
   */
  defaultValidityDays?: number;

  /**
   * When `true`, `PredicateRegistry.renderForPrompt` omits this predicate
   * from the LLM-facing vocabulary by default. The predicate remains valid
   * for direct callers (extractors that already know the name, code paths
   * that emit it programmatically); only the LLM's view of the vocabulary
   * narrows. Pass `{ includeExcluded: true }` to render everything.
   *
   * Use for predicates the library considers extraction noise (per-message
   * communication metadata, vague observations) that should be derived from
   * source metadata aggregation rather than re-extracted into facts.
   */
  excludeFromExtractionPrompt?: boolean;
}
