/**
 * Entity deduplication tooling — generic primitives for finding, scoring,
 * and surveying duplicate clusters in a `MemorySystem`.
 *
 * Type-agnostic by design: no `if (type === 'X')` branches anywhere. Every
 * signal keys off entity properties (identifiers, normalized name, aliases,
 * identityEmbedding, metadata.startTime). Hosts choose how to route the
 * resulting `DedupDecision`s — auto-merge, queue for human review, or skip
 * — based on `action` + their own policy.
 *
 * Four public surfaces:
 *
 *  - **`scoreEntityPair`** — given two entities (and optionally their atomic
 *    facts), produce a `DedupDecision` with an action verdict, the underlying
 *    signal breakdown, and a deterministic winner pick. Hard-zero rules
 *    (identifier conflict, type mismatch, event-time conflict) short-circuit
 *    weighted-sum scoring.
 *
 *  - **`findDuplicateCandidates`** — for one entity, return the small set of
 *    entities in scope that are plausible matches. Combines identifier-driven
 *    lookups, normalized-name + alias matching, and optional semantic search.
 *
 *  - **`findDuplicateClusters`** — snapshot of `(type, normalizedDisplayName)`
 *    groups with `count >= minClusterSize`. The "where are the dups" admin
 *    primitive; no scoring.
 *
 *  - **`sweepDuplicates`** — async iterator over scored dup decisions across
 *    the entire scope. Wraps `findDuplicateClusters` + `scoreEntityPair` and
 *    yields decisions in score-descending order. Hosts consume and route.
 *
 * Scorer rules (from PR 3 plan + production-data calibration):
 *
 *   Hard zero (action='skip'):
 *     - identifierConflict: any (kind, value) pair where both entities have
 *       the same identifier kind but DIFFERENT values. Same kind + different
 *       values means the host's identity contract says they're distinct.
 *     - typeMismatch: a.type !== b.type. Type carries semantic weight.
 *     - metadataStartTimeConflict: both entities carry `metadata.startTime`
 *       and the absolute delta exceeds `eventStartTimeDeltaMinutes` (default
 *       60). Critical for events — Mon and Tue standups must NOT collapse.
 *       Both-sides-required guard: if either is missing the signal is N/A,
 *       not a conflict.
 *
 *   Auto-merge short-circuit (action='auto-merge', score=1.0):
 *     - identifierExactMatch: at least one (kind, value) pair matches
 *       case-insensitive for kinds the library marks case-insensitive (email,
 *       domain, phone, url_host), exact otherwise.
 *
 *   Weighted-sum signals (action computed from final score):
 *     - displayNameNormalizedEqual: bool * weights.displayNameNormalizedEqual
 *     - aliasOverlap: |A ∩ B| / max(|A|, |B|) * weights.aliasOverlap (both
 *       normalized; alias and displayName surfaces are pooled per entity so
 *       "Bill" in A's displayName matching "Bill" in B's aliases counts).
 *     - embeddingCosine: linear ramp from cos=0.70 (contributes 0) to
 *       cos=0.95 (contributes full weight). Below 0.70: 0. Above 0.95: full.
 *     - tokenSetJaccard: |tokens(A) ∩ tokens(B)| / |tokens(A) ∪ tokens(B)| *
 *       weights.tokenSetJaccard. Tokens come from the normalized displayName,
 *       split on whitespace. Helps "John Smith" vs "Smith John" and project
 *       name reordering; near-useless for "Microsoft" vs "MSFT".
 *     - contextIdsOverlap (when factsA/factsB provided): how many distinct
 *       fact-contextIds appear on both sides, capped at 10, normalized to
 *       0..1. Captures co-occurrence in the knowledge graph.
 *     - sameSignalBoost (when factsA/factsB provided): +weights.sameSignalBoost
 *       if any fact on each side shares the same `sourceSignalId` within 60
 *       minutes. Captures "extracted from the same email" co-occurrence.
 *
 *   Single-token-name guard:
 *     - If both entities' normalizedDisplayName is a single token AND that
 *       token has length < 5, clamp final score to ≤ 0.85. "John" alone is
 *       not enough — wait for an identifier or alias overlap.
 *
 * Winner selection (deterministic):
 *   1. More identifiers wins.
 *   2. Tie → more atomic facts as subject wins (when factsA/factsB given).
 *   3. Tie → has profile fact (`predicate === 'profile' && kind === 'document'`).
 *   4. Tie → older `createdAt` wins (stable history beats new arrivals).
 *
 * Thresholds: score ≥ auto (default 0.92) → 'auto-merge'; score ≥ review
 * (default 0.75) → 'review'; else 'skip'.
 */

import type { MemorySystem } from './MemorySystem.js';
import type { EntityId, IEntity, IFact, ScopeFilter } from './types.js';
import { normalizeSurface } from './resolution/fuzzy.js';
import { identifierValuesEqual, normalizeIdentifierValue } from './identifiers.js';

// ===========================================================================
// Types
// ===========================================================================

export interface SignalBreakdown {
  /** True if any (kind, value) identifier matched. */
  identifierExactMatch: boolean;
  /** True if same identifier kind exists on both with different values. */
  identifierConflict: boolean;
  /** True if both entities have different `type`. */
  typeMismatch: boolean;
  /** True if both have `metadata.startTime` and the delta exceeds threshold. */
  metadataStartTimeConflict: boolean;
  /** Both normalizedDisplayName strings non-empty and equal. */
  displayNameNormalizedEqual: boolean;
  /** Jaccard overlap of normalized alias-pool (alias ∪ displayName) (0..1). */
  aliasOverlap: number;
  /** Raw cosine in [-1, 1]. NaN if either entity lacks identityEmbedding. */
  embeddingCosine: number;
  /** Jaccard over whitespace-tokenized normalizedDisplayName (0..1). */
  tokenSetJaccard: number;
  /** Count of distinct contextIds appearing on both sides, capped at 10. */
  contextIdsOverlap: number;
  /** Minutes apart between any same-`sourceSignalId` fact pair; null if none. */
  sameSignalWithin: number | null;
  /** Both names are a single token < 5 chars — too weak to auto-merge alone. */
  singleTokenNameTooShort: boolean;
}

export interface SignalWeights {
  displayNameNormalizedEqual: number;
  aliasOverlap: number;
  embeddingCosine: number;
  tokenSetJaccard: number;
  contextIdsOverlap: number;
  sameSignalBoost: number;
}

export const DEFAULT_WEIGHTS: SignalWeights = {
  displayNameNormalizedEqual: 0.55,
  aliasOverlap: 0.3,
  embeddingCosine: 0.3,
  tokenSetJaccard: 0.2,
  contextIdsOverlap: 0.15,
  sameSignalBoost: 0.1,
};

export interface ScoreThresholds {
  /** Score ≥ this → action 'auto-merge'. Default 0.92. */
  auto?: number;
  /** Score ≥ this (and < auto) → action 'review'. Default 0.75. */
  review?: number;
  /** Partial weight overrides. */
  weights?: Partial<SignalWeights>;
  /**
   * Threshold for the event-time hard-zero rule (`metadataStartTimeConflict`).
   * Default 60 minutes. Both entities must carry `metadata.startTime` for the
   * rule to fire — missing on either side → not a conflict, signal N/A.
   */
  eventStartTimeDeltaMinutes?: number;
  /** Below this cosine value, embedding contribution is 0. Default 0.70. */
  embeddingCosineFloor?: number;
  /** At this cosine value, embedding contribution is full weight. Default 0.95. */
  embeddingCosineCeiling?: number;
  /**
   * Entity types where the single-token-short-name guard applies. Default
   * `['person']`. The guard caps a pair's final score at 0.85 (below the
   * 0.92 auto-merge threshold) when BOTH entities have a single-token
   * normalized name of length < 5 — reflecting that "John" / "Pavel" / "Vlad"
   * alone do not uniquely identify a person inside a tenant.
   *
   * **Why type-scoped (0.9.2):** persons need the guard (multiple humans
   * can share a first name). Projects / organizations / events with names
   * like "ICOS" / "EW" / "Prep" are tenant-unique by convention — the guard
   * was blocking 41 ICOS-project dups from auto-merging in production. Types
   * NOT in this list bypass the guard, letting name + alias + embedding
   * signals reach `auto-merge` on identical short names.
   *
   * Pass `[]` to disable the guard entirely.
   */
  singleTokenGuardTypes?: string[];
}

export interface DedupDecision {
  action: 'auto-merge' | 'review' | 'skip';
  /** 0..1 — final composite score after weighted sum + guards. */
  score: number;
  signals: SignalBreakdown;
  /** The id the scorer recommends keeping. */
  suggestedWinnerId: EntityId;
  /** The id the scorer recommends archiving. */
  suggestedLoserId: EntityId;
  /** One-sentence human-readable rationale. */
  reason: string;
}

export interface FindCandidatesOptions {
  /** Maximum candidates per source. Default 20. */
  k?: number;
  /** Include semantic-tier matches via identityEmbedding. Default true. */
  includeSemantic?: boolean;
  /** Minimum cosine for a semantic-tier match. Default 0.70. */
  minSemanticScore?: number;
}

export interface FindClustersOptions {
  /** Only return clusters for this `entity.type`. Default: all types. */
  type?: string;
  /** Minimum cluster size to return. Default 2 (anything with a duplicate). */
  minClusterSize?: number;
  /** Maximum number of clusters to return. Default 100. */
  limit?: number;
  /** Pagination through `listEntities`. Default 500. */
  pageSize?: number;
}

export interface DuplicateCluster {
  type: string;
  normalizedDisplayName: string;
  entities: IEntity[];
}

export interface FindIdentifierClustersOptions {
  /** Restrict to specific identifier kinds. Default: all kinds. */
  kinds?: string[];
  /** Only return clusters of this entity type. Default: all types. */
  type?: string;
  /** Minimum cluster size to return. Default 2. */
  minClusterSize?: number;
  /** Maximum clusters returned. Default 100. */
  limit?: number;
  /** Pagination through `listEntities`. Default 500. */
  pageSize?: number;
}

export interface IdentifierCluster {
  kind: string;
  value: string;
  entities: IEntity[];
}

export interface SweepOptions {
  /** Narrow to one entity type. Default: all. */
  type?: string;
  /** Cap on clusters processed. Default: no cap (caller bounds via consumer). */
  maxClusters?: number;
  /** Pair cap inside a single cluster (cluster.length choose 2 can explode). Default 50. */
  maxPairsPerCluster?: number;
  /** Per-pair scorer thresholds + weights. */
  thresholds?: ScoreThresholds;
  /** Include semantic-tier signals (skipped by default to avoid LLM-grade ops). */
  includeSemantic?: boolean;
  /** `listEntities` page size when enumerating clusters. */
  pageSize?: number;
}

// ===========================================================================
// scoreEntityPair
// ===========================================================================

/**
 * Score a pair of entities for likely duplication. Hard-zero rules short-circuit
 * the weighted sum and yield action='skip' with score=0. Identifier exact match
 * short-circuits to action='auto-merge' with score=1.0.
 *
 * Pass `factsA`/`factsB` (caller's choice — atomic-only for performance) to
 * enable the contextIds-overlap and same-signal-boost signals; omit for a
 * cheaper structural-only score.
 */
export function scoreEntityPair(
  inputs: { a: IEntity; b: IEntity; factsA?: IFact[]; factsB?: IFact[] },
  thresholds?: ScoreThresholds,
): DedupDecision {
  const { a, b } = inputs;
  const weights = { ...DEFAULT_WEIGHTS, ...(thresholds?.weights ?? {}) };
  const auto = thresholds?.auto ?? 0.92;
  const review = thresholds?.review ?? 0.75;
  const startTimeDeltaMin = thresholds?.eventStartTimeDeltaMinutes ?? 60;
  const cosFloor = thresholds?.embeddingCosineFloor ?? 0.7;
  const cosCeil = thresholds?.embeddingCosineCeiling ?? 0.95;
  const singleTokenGuardTypes = new Set(thresholds?.singleTokenGuardTypes ?? ['person']);

  const signals: SignalBreakdown = {
    identifierExactMatch: false,
    identifierConflict: false,
    typeMismatch: a.type !== b.type,
    metadataStartTimeConflict: false,
    displayNameNormalizedEqual: false,
    aliasOverlap: 0,
    embeddingCosine: Number.NaN,
    tokenSetJaccard: 0,
    contextIdsOverlap: 0,
    sameSignalWithin: null,
    singleTokenNameTooShort: false,
  };

  // -------------------------------------------------------------------------
  // Identifier matching + conflict detection. Done in one pass.
  // -------------------------------------------------------------------------
  const idsA = a.identifiers ?? [];
  const idsB = b.identifiers ?? [];
  for (const ida of idsA) {
    for (const idb of idsB) {
      if (ida.kind !== idb.kind) continue;
      if (identifierValuesEqual(ida.kind, ida.value, idb.kind, idb.value)) {
        signals.identifierExactMatch = true;
      } else {
        signals.identifierConflict = true;
      }
    }
  }

  // -------------------------------------------------------------------------
  // metadata.startTime conflict — events on different occasions must NOT
  // collapse even with matching names.
  // -------------------------------------------------------------------------
  const startA = readDateMetadata(a, 'startTime');
  const startB = readDateMetadata(b, 'startTime');
  if (startA && startB) {
    const deltaMin = Math.abs(startA.getTime() - startB.getTime()) / 60000;
    if (deltaMin > startTimeDeltaMin) {
      signals.metadataStartTimeConflict = true;
    }
  }

  // -------------------------------------------------------------------------
  // Hard-zero short-circuits.
  // -------------------------------------------------------------------------
  if (signals.typeMismatch) {
    return makeDecision(a, b, 0, signals, 'skip', 'type mismatch', inputs.factsA, inputs.factsB);
  }
  if (signals.identifierConflict) {
    return makeDecision(
      a,
      b,
      0,
      signals,
      'skip',
      'identifier conflict (same kind, different values)',
      inputs.factsA,
      inputs.factsB,
    );
  }
  if (signals.metadataStartTimeConflict) {
    return makeDecision(
      a,
      b,
      0,
      signals,
      'skip',
      `metadata.startTime delta exceeds ${startTimeDeltaMin}min`,
      inputs.factsA,
      inputs.factsB,
    );
  }
  if (signals.identifierExactMatch) {
    return makeDecision(
      a,
      b,
      1,
      signals,
      'auto-merge',
      'identifier exact match',
      inputs.factsA,
      inputs.factsB,
    );
  }

  // -------------------------------------------------------------------------
  // Weighted-sum signals.
  // -------------------------------------------------------------------------
  const nameA = a.normalizedDisplayName ?? normalizeSurface(a.displayName);
  const nameB = b.normalizedDisplayName ?? normalizeSurface(b.displayName);
  signals.displayNameNormalizedEqual = nameA.length > 0 && nameA === nameB;

  const aliasPoolA = pooledAliasSet(a);
  const aliasPoolB = pooledAliasSet(b);
  signals.aliasOverlap = jaccardSets(aliasPoolA, aliasPoolB);

  const tokensA = new Set(nameA.split(' ').filter((t) => t.length > 0));
  const tokensB = new Set(nameB.split(' ').filter((t) => t.length > 0));
  signals.tokenSetJaccard = jaccardSets(tokensA, tokensB);

  if (
    a.identityEmbedding &&
    b.identityEmbedding &&
    a.identityEmbedding.length === b.identityEmbedding.length &&
    a.identityEmbedding.length > 0
  ) {
    signals.embeddingCosine = cosine(a.identityEmbedding, b.identityEmbedding);
  }

  if (inputs.factsA && inputs.factsB) {
    const ctxA = collectContextIdSet(inputs.factsA, a.id, b.id);
    const ctxB = collectContextIdSet(inputs.factsB, a.id, b.id);
    let overlap = 0;
    for (const cid of ctxA) if (ctxB.has(cid)) overlap++;
    signals.contextIdsOverlap = Math.min(overlap, 10);
    signals.sameSignalWithin = sameSignalProximityMinutes(inputs.factsA, inputs.factsB);
  }

  // Single-token weak-signal guard. "John" / "Pavel" / "Vlad" alone are too
  // ambiguous to auto-merge purely on name + Jaccard overlap because
  // multiple humans share each. Type-scoped via `singleTokenGuardTypes` —
  // default `['person']`. Projects / orgs / events with names like "ICOS" /
  // "EW" / "Prep" are tenant-unique by convention so the guard would
  // wrongly block their auto-merge (41 ICOS-project dups in production
  // would all land at score 0.85 → 'review' otherwise).
  //
  // a.type === b.type already enforced by the type-mismatch hard-zero.
  const guardAppliesToType = singleTokenGuardTypes.has(a.type);
  const singleTokenA = tokensA.size === 1 && nameA.length < 5;
  const singleTokenB = tokensB.size === 1 && nameB.length < 5;
  signals.singleTokenNameTooShort = guardAppliesToType && singleTokenA && singleTokenB;

  // -------------------------------------------------------------------------
  // Score: weighted sum, capped at 1.
  // -------------------------------------------------------------------------
  let score = 0;
  if (signals.displayNameNormalizedEqual) score += weights.displayNameNormalizedEqual;
  score += weights.aliasOverlap * signals.aliasOverlap;
  score += weights.tokenSetJaccard * signals.tokenSetJaccard;
  score += weights.contextIdsOverlap * (signals.contextIdsOverlap / 10);
  if (signals.sameSignalWithin !== null && signals.sameSignalWithin <= 60) {
    score += weights.sameSignalBoost;
  }
  if (!Number.isNaN(signals.embeddingCosine)) {
    const ramp = linearRamp(signals.embeddingCosine, cosFloor, cosCeil);
    score += weights.embeddingCosine * ramp;
  }
  score = Math.min(1, Math.max(0, score));

  // Single-token-name guard: cap final score so a weak-name pair can't reach
  // auto-merge purely on name + Jaccard overlap.
  if (signals.singleTokenNameTooShort) {
    score = Math.min(score, 0.85);
  }

  let action: DedupDecision['action'];
  let reason: string;
  if (score >= auto) {
    action = 'auto-merge';
    reason = describeStrongMatch(signals);
  } else if (score >= review) {
    action = 'review';
    reason = describeMediumMatch(signals);
  } else {
    action = 'skip';
    reason = 'insufficient overlap';
  }

  return makeDecision(a, b, score, signals, action, reason, inputs.factsA, inputs.factsB);
}

// ===========================================================================
// findDuplicateCandidates
// ===========================================================================

/**
 * For one entity, return the small set of in-scope entities that are plausible
 * duplicate candidates. Combines three lookup sources:
 *  1. Identifier matches (per identifier).
 *  2. `findEntitiesByNormalizedName` (matchAliases: true).
 *  3. Optional: `semanticSearchEntities` via identityEmbedding.
 *
 * Returns deduped, archived-excluded, self-excluded entities.
 */
export async function findDuplicateCandidates(
  memory: MemorySystem,
  entity: IEntity,
  scope: ScopeFilter,
  opts: FindCandidatesOptions = {},
): Promise<IEntity[]> {
  const k = opts.k ?? 20;
  const includeSemantic = opts.includeSemantic !== false; // default true
  const minSemanticScore = opts.minSemanticScore ?? 0.7;

  // Use a Map so we dedupe by id while preserving insertion order (identifier
  // matches first — they're the highest-signal candidates).
  const seen = new Map<EntityId, IEntity>();
  const add = (e: IEntity): void => {
    if (e.id === entity.id) return;
    if (e.archived === true) return;
    if (!seen.has(e.id)) seen.set(e.id, e);
  };

  // 1. Identifier-driven matches.
  for (const ident of entity.identifiers ?? []) {
    const matches = await memory.findEntitiesByIdentifier(ident.kind, ident.value, scope);
    for (const m of matches) add(m);
    if (seen.size >= k) break;
  }

  // 2. Normalized-name + alias match. Skip when the entity has no normalized
  // displayName (legacy pre-0.8.0 data without `backfillNormalizedFields`).
  const normalized = entity.normalizedDisplayName ?? normalizeSurface(entity.displayName);
  if (normalized) {
    const store = (memory as unknown as { store: import('./types.js').IMemoryStore }).store;
    const nameMatches = await store.findEntitiesByNormalizedName(entity.type, normalized, scope, {
      matchAliases: true,
      limit: k,
    });
    for (const m of nameMatches) add(m);
  }

  // 3. Semantic tier (opt-out).
  if (includeSemantic && entity.identityEmbedding && entity.identityEmbedding.length > 0) {
    const store = (memory as unknown as { store: import('./types.js').IMemoryStore }).store;
    if (typeof store.semanticSearchEntities === 'function') {
      try {
        const hits = await store.semanticSearchEntities(
          entity.identityEmbedding,
          { type: entity.type },
          { topK: k, minScore: minSemanticScore, embeddingField: 'identity' },
          scope,
        );
        for (const h of hits) add(h.entity);
      } catch (err) {
        // Embedder/adapter problems should not crash a dedup-candidate scan.
        // Log loudly — silent semantic-skip would let production dedup tooling
        // silently degrade. Same surfacing pattern as MemorySystem's other
        // background-failure warnings.
        // eslint-disable-next-line no-console
        console.warn('[oneringai dedup] semanticSearchEntities failed; identifier+name candidates only', {
          entityId: entity.id,
          type: entity.type,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return Array.from(seen.values()).slice(0, k);
}

// ===========================================================================
// findDuplicateClusters
// ===========================================================================

/**
 * Enumerate `(type, normalizedDisplayName)` clusters with `count >= minClusterSize`
 * in the given scope. Pure snapshot — no scoring. The "where are the dups?"
 * admin primitive; pair with `scoreEntityPair` to decide what to do about each.
 *
 * Implementation note: paginates through `listEntities` and groups
 * client-side. For tenants up to ~10k entities this is fast on either adapter.
 * Adapters wanting a native aggregation can override.
 */
export async function findDuplicateClusters(
  memory: MemorySystem,
  scope: ScopeFilter,
  opts: FindClustersOptions = {},
): Promise<DuplicateCluster[]> {
  const minClusterSize = opts.minClusterSize ?? 2;
  const limit = opts.limit ?? 100;
  const pageSize = opts.pageSize ?? 500;
  const filter = opts.type ? { type: opts.type } : {};
  const store = (memory as unknown as { store: import('./types.js').IMemoryStore }).store;

  // Group by (type, normalizedDisplayName). Entities lacking normalizedDisplayName
  // are skipped — legacy pre-0.8.0 data must be backfilled first.
  const groups = new Map<string, IEntity[]>();
  let cursor: string | undefined;
  do {
    const page = await store.listEntities(filter, { limit: pageSize, cursor }, scope);
    for (const e of page.items) {
      if (e.archived === true) continue;
      const n = e.normalizedDisplayName;
      if (!n) continue;
      const key = `${e.type}\x00${n}`;
      const bucket = groups.get(key) ?? [];
      bucket.push(e);
      groups.set(key, bucket);
    }
    cursor = page.nextCursor;
  } while (cursor);

  const clusters: DuplicateCluster[] = [];
  for (const [key, entities] of groups) {
    if (entities.length < minClusterSize) continue;
    const sep = key.indexOf('\x00');
    clusters.push({
      type: key.slice(0, sep),
      normalizedDisplayName: key.slice(sep + 1),
      entities,
    });
    if (clusters.length >= limit) break;
  }

  // Largest clusters first — that's where the most cleanup value lives.
  clusters.sort((x, y) => y.entities.length - x.entities.length);
  return clusters;
}

// ===========================================================================
// findIdentifierClusters
// ===========================================================================

/**
 * Enumerate `(identifier.kind, identifier.value)` clusters where ≥
 * `minClusterSize` entities share an identifier. Complements
 * `findDuplicateClusters` (which pivots on name) — catches the dup pattern
 * where two entities share an email/slack_id/github handle but have
 * different displayNames ("Pavel" + "Pavel Khasanov" sharing
 * `email: pavel@everworker.ai`).
 *
 * Implementation: paginates `listEntities`, groups by `(kind,
 * normalizedValue)` using `identifierValuesEqual`'s case-folding contract
 * (email/domain/phone/url_host fold to lowercase; everything else exact).
 * Same client-side scale envelope as `findDuplicateClusters` — fast under
 * ~10k entities, slower beyond.
 */
export async function findIdentifierClusters(
  memory: MemorySystem,
  scope: ScopeFilter,
  opts: FindIdentifierClustersOptions = {},
): Promise<IdentifierCluster[]> {
  const minClusterSize = opts.minClusterSize ?? 2;
  const limit = opts.limit ?? 100;
  const pageSize = opts.pageSize ?? 500;
  const filter = opts.type ? { type: opts.type } : {};
  const kindFilter = opts.kinds ? new Set(opts.kinds) : null;
  const store = (memory as unknown as { store: import('./types.js').IMemoryStore }).store;

  // Map<`${kind}\x00${normalizedValue}`, IEntity[]>. Normalization mirrors
  // `identifierValuesEqual` — case-fold only the kinds the library marks
  // case-insensitive; preserve case otherwise so `github:Anton` !== `github:anton`.
  const groups = new Map<string, IEntity[]>();
  let cursor: string | undefined;
  do {
    const page = await store.listEntities(filter, { limit: pageSize, cursor }, scope);
    for (const e of page.items) {
      if (e.archived === true) continue;
      const idents = e.identifiers ?? [];
      for (const id of idents) {
        if (kindFilter && !kindFilter.has(id.kind)) continue;
        const normalizedValue = normalizeIdentifierValue(id.kind, id.value);
        const key = `${id.kind}\x00${normalizedValue}`;
        const bucket = groups.get(key) ?? [];
        // Dedupe by entity id — an entity with two same-kind identifiers of
        // the same value (rare but legal) shouldn't appear twice in its own
        // cluster.
        if (!bucket.some((x) => x.id === e.id)) bucket.push(e);
        groups.set(key, bucket);
      }
    }
    cursor = page.nextCursor;
  } while (cursor);

  const clusters: IdentifierCluster[] = [];
  for (const [key, entities] of groups) {
    if (entities.length < minClusterSize) continue;
    const sep = key.indexOf('\x00');
    clusters.push({
      kind: key.slice(0, sep),
      value: key.slice(sep + 1),
      entities,
    });
    if (clusters.length >= limit) break;
  }

  clusters.sort((x, y) => y.entities.length - x.entities.length);
  return clusters;
}

// ===========================================================================
// sweepDuplicates
// ===========================================================================

/**
 * Async iterator yielding `DedupDecision`s across the scope. Wraps
 * `findDuplicateClusters` + `scoreEntityPair`. Caller routes each yielded
 * decision (auto-merge / queue / skip) per their policy.
 *
 * The sweeper deliberately does NOT call `mergeEntities` — separation of
 * concerns. v25's dedup engine consumes decisions; this library produces them.
 *
 * Decisions are yielded **largest-cluster first**, and within a cluster
 * **highest-score first** — so hosts processing the stream see the most
 * impactful merges first and can stop early.
 */
export async function* sweepDuplicates(
  memory: MemorySystem,
  scope: ScopeFilter,
  opts: SweepOptions = {},
): AsyncIterable<DedupDecision> {
  const maxPairsPerCluster = opts.maxPairsPerCluster ?? 50;
  const clusters = await findDuplicateClusters(memory, scope, {
    type: opts.type,
    minClusterSize: 2,
    // Pull all clusters; sweep can be expensive but at least it's
    // user-bounded via the iterator semantics (break when done).
    limit: opts.maxClusters ?? 1000,
    pageSize: opts.pageSize,
  });

  for (const cluster of clusters) {
    const decisions: DedupDecision[] = [];
    // Pair every entity with every other in the cluster (O(N^2) but bounded
    // by maxPairsPerCluster).
    let pairs = 0;
    for (let i = 0; i < cluster.entities.length && pairs < maxPairsPerCluster; i++) {
      for (let j = i + 1; j < cluster.entities.length && pairs < maxPairsPerCluster; j++) {
        const d = scoreEntityPair(
          { a: cluster.entities[i]!, b: cluster.entities[j]! },
          opts.thresholds,
        );
        decisions.push(d);
        pairs++;
      }
    }
    decisions.sort((x, y) => y.score - x.score);
    for (const d of decisions) yield d;
  }
}

// ===========================================================================
// Helpers — kept private to this module.
// ===========================================================================

function makeDecision(
  a: IEntity,
  b: IEntity,
  score: number,
  signals: SignalBreakdown,
  action: DedupDecision['action'],
  reason: string,
  factsA?: IFact[],
  factsB?: IFact[],
): DedupDecision {
  const winnerFirst = pickWinner(a, b, factsA, factsB);
  return {
    action,
    score,
    signals,
    suggestedWinnerId: winnerFirst.winner.id,
    suggestedLoserId: winnerFirst.loser.id,
    reason,
  };
}

/**
 * Deterministic winner pick.
 *  1. More identifiers.
 *  2. Tie → more atomic facts as subject.
 *  3. Tie → has profile fact (profile predicate + document kind).
 *  4. Tie → older createdAt.
 */
function pickWinner(
  a: IEntity,
  b: IEntity,
  factsA?: IFact[],
  factsB?: IFact[],
): { winner: IEntity; loser: IEntity } {
  const idsA = (a.identifiers ?? []).length;
  const idsB = (b.identifiers ?? []).length;
  if (idsA !== idsB) return idsA > idsB ? { winner: a, loser: b } : { winner: b, loser: a };

  if (factsA && factsB) {
    const atomicA = factsA.filter((f) => f.kind === 'atomic' && f.subjectId === a.id).length;
    const atomicB = factsB.filter((f) => f.kind === 'atomic' && f.subjectId === b.id).length;
    if (atomicA !== atomicB) {
      return atomicA > atomicB ? { winner: a, loser: b } : { winner: b, loser: a };
    }
    const profileA = factsA.some(
      (f) => f.predicate === 'profile' && f.kind === 'document' && f.subjectId === a.id,
    );
    const profileB = factsB.some(
      (f) => f.predicate === 'profile' && f.kind === 'document' && f.subjectId === b.id,
    );
    if (profileA !== profileB) return profileA ? { winner: a, loser: b } : { winner: b, loser: a };
  }

  const ageA = a.createdAt?.getTime?.() ?? 0;
  const ageB = b.createdAt?.getTime?.() ?? 0;
  if (ageA !== ageB) return ageA < ageB ? { winner: a, loser: b } : { winner: b, loser: a };

  // Stable final fallback: lexicographic on id.
  return a.id < b.id ? { winner: a, loser: b } : { winner: b, loser: a };
}

/** Returns the pooled normalized alias set (alias entries ∪ displayName). */
function pooledAliasSet(e: IEntity): Set<string> {
  const out = new Set<string>();
  const dn = e.normalizedDisplayName ?? normalizeSurface(e.displayName);
  if (dn) out.add(dn);
  const aliases = e.normalizedAliases ?? (e.aliases ?? []).map(normalizeSurface);
  for (const a of aliases) if (a) out.add(a);
  return out;
}

function jaccardSets<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return Number.NaN;
  return dot / Math.sqrt(na * nb);
}

function linearRamp(value: number, floor: number, ceiling: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= floor) return 0;
  if (value >= ceiling) return 1;
  return (value - floor) / (ceiling - floor);
}

function readDateMetadata(e: IEntity, key: string): Date | null {
  const meta = e.metadata as Record<string, unknown> | undefined;
  if (!meta) return null;
  const raw = meta[key];
  if (raw instanceof Date) return raw;
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === 'number') return new Date(raw);
  return null;
}

function collectContextIdSet(facts: IFact[], excludeA: EntityId, excludeB: EntityId): Set<EntityId> {
  const out = new Set<EntityId>();
  for (const f of facts) {
    const cids = f.contextIds;
    if (!cids) continue;
    for (const c of cids) {
      // Exclude the entities themselves — self-context isn't a co-occurrence signal.
      if (c === excludeA || c === excludeB) continue;
      out.add(c);
    }
  }
  return out;
}

function sameSignalProximityMinutes(factsA: IFact[], factsB: IFact[]): number | null {
  // Hash factsA by sourceSignalId for an O(1) lookup against factsB.
  const bySignalA = new Map<string, IFact[]>();
  for (const f of factsA) {
    if (!f.sourceSignalId) continue;
    const bucket = bySignalA.get(f.sourceSignalId) ?? [];
    bucket.push(f);
    bySignalA.set(f.sourceSignalId, bucket);
  }
  let bestMin: number | null = null;
  for (const f of factsB) {
    if (!f.sourceSignalId) continue;
    const peers = bySignalA.get(f.sourceSignalId);
    if (!peers) continue;
    for (const p of peers) {
      const ta = (p.observedAt ?? p.createdAt)?.getTime?.();
      const tb = (f.observedAt ?? f.createdAt)?.getTime?.();
      if (typeof ta !== 'number' || typeof tb !== 'number') continue;
      const deltaMin = Math.abs(ta - tb) / 60000;
      if (bestMin === null || deltaMin < bestMin) bestMin = deltaMin;
    }
  }
  return bestMin;
}

function describeStrongMatch(s: SignalBreakdown): string {
  const parts: string[] = [];
  if (s.displayNameNormalizedEqual) parts.push('normalized name equal');
  if (s.aliasOverlap >= 0.5) parts.push(`alias overlap ${s.aliasOverlap.toFixed(2)}`);
  if (!Number.isNaN(s.embeddingCosine) && s.embeddingCosine >= 0.85) {
    parts.push(`embedding cos ${s.embeddingCosine.toFixed(2)}`);
  }
  if (s.contextIdsOverlap >= 3) parts.push(`${s.contextIdsOverlap} shared contexts`);
  return parts.length > 0 ? parts.join(' + ') : 'composite signal';
}

function describeMediumMatch(s: SignalBreakdown): string {
  const parts: string[] = [];
  if (s.displayNameNormalizedEqual) parts.push('name equal but weak');
  if (s.aliasOverlap > 0 && s.aliasOverlap < 0.5) parts.push('partial alias overlap');
  if (s.tokenSetJaccard > 0.5) parts.push(`token overlap ${s.tokenSetJaccard.toFixed(2)}`);
  if (!Number.isNaN(s.embeddingCosine) && s.embeddingCosine >= 0.7 && s.embeddingCosine < 0.85) {
    parts.push(`embedding cos ${s.embeddingCosine.toFixed(2)}`);
  }
  return parts.length > 0 ? `review: ${parts.join(', ')}` : 'review: ambiguous';
}
