/**
 * EntityResolver — translate surface forms ("Microsoft", "Q3 Planning", "John")
 * to existing entity IDs, creating new entities when nothing matches confidently.
 *
 * Matching hierarchy:
 *   1. Strong identifier match (email, domain, …) → confidence 1.0
 *   2. Exact displayName, normalized (case, "Inc.", punctuation) → confidence 0.90
 *   3. Exact alias, normalized → confidence 0.85
 *   4. Semantic match via `identityEmbedding` (opt-in, off by default) →
 *      confidence = min(cosine, 0.89). Capped strictly below the default
 *      auto-resolve threshold (0.90) so enabling the tier alone never
 *      auto-merges entities — the LLM sees candidates and decides, or the
 *      caller lowers `autoResolveThreshold` to trust the scoring.
 *
 * Enable semantic by setting `EntityResolutionConfig.enableSemanticResolution:
 * true`. Requires an embedder AND an adapter implementing
 * `IMemoryStore.semanticSearchEntities` (`InMemoryAdapter`, `MongoMemoryAdapter`).
 * Identity embeddings are populated whenever `enableIdentityEmbedding` is on
 * (default true) — turning this flag on is a drop-in change.
 *
 * Context-aware disambiguation: when multiple candidates pass threshold,
 * prefer the one that shares the most `disambiguationEntityIds` (formerly
 * `contextEntityIds` — alias kept for back-compat) with already-resolved
 * mentions in the same signal. Distinct from the persistent
 * `IEntity.contextIds` field — disambiguation is resolution-time only.
 * Runs on top of all tiers, including semantic.
 *
 * Alias accumulation: `upsertBySurface` records the incoming surface + any
 * supplied identifiers on the matched entity, so the system gets better with
 * use — future mentions of the same surface hit the exact-alias match (even
 * if it arrived via the semantic tier).
 */

import type {
  EntityCandidate,
  EntityId,
  EntityResolutionConfig,
  IEntity,
  IMemoryStore,
  Identifier,
  ResolveEntityOptions,
  ResolveEntityQuery,
  ScopeFilter,
  UpsertBySurfaceInput,
  UpsertBySurfaceOptions,
  UpsertBySurfaceResult,
} from '../types.js';
import { normalizeSurface } from './fuzzy.js';
import { logger } from '../../infrastructure/observability/Logger.js';

const DEFAULT_AUTO_RESOLVE_THRESHOLD = 0.9;
const DEFAULT_THRESHOLD = 0.5;
const DEFAULT_LIMIT = 5;
const DEFAULT_DISPLAY_NAME_CONFIDENCE = 0.9;
const DEFAULT_ALIAS_CONFIDENCE = 0.9;

/**
 * Semantic tier parameters.
 *
 * **0.9.1 calibration** — was: `MIN_SCORE=0.75, CONFIDENCE_CAP=0.89` (cap
 * strictly below auto-resolve threshold → semantic was advisory-only). New
 * default cap = `0.95` for types in `semanticAutoResolveTypes` so cosine can
 * actually clear `autoResolveThreshold` (0.90) → auto-merge at write time.
 *
 * Production-data calibration (one tenant, text-embedding-3-small, 1536d):
 *   - Within-cluster (known dups): median cosine 0.89–1.00 across all types.
 *   - Cross-cluster (distinct entities, same type): max 0.86 (projects, the
 *     noisiest); persons max 0.81; orgs max 0.77.
 *   - Threshold 0.88 lives in the clean gap between cross-cluster max and
 *     within-cluster median for every type.
 *   - Persons EXCLUDED from auto-resolve by default — first-name collisions
 *     are common in real tenants. Persons stay capped at the legacy 0.89
 *     (below auto-resolve threshold) so semantic remains advisory.
 *
 * `SEMANTIC_TOP_K`: small enough to stay cheap, large enough to survive
 * context-disambiguation tiebreaks. Kept at 10 across calibrations.
 */
const DEFAULT_SEMANTIC_MIN_SCORE = 0.75;
const DEFAULT_SEMANTIC_CONFIDENCE_CAP = 0.95;
const PERSON_ADVISORY_CONFIDENCE_CAP = 0.89;
const SEMANTIC_TOP_K = 10;
const DEFAULT_SEMANTIC_AUTO_RESOLVE_TYPES: readonly string[] = Object.freeze([
  'organization',
  'project',
  'event',
  'topic',
  'task',
  'cluster',
]);

/**
 * Narrow hook used by EntityResolver — lets it query + upsert without pulling
 * in the full MemorySystem surface (keeps the resolver easy to test).
 */
export interface ResolverMemoryHooks {
  store: IMemoryStore;
  embedQuery?: (text: string) => Promise<number[]>;
  upsertEntity: (
    input: Partial<IEntity> & {
      identifiers: Identifier[];
      displayName: string;
      type: string;
    },
    scope: ScopeFilter,
  ) => Promise<{ entity: IEntity; created: boolean }>;
  /**
   * Atomically create OR resolve by `(type, normalizedDisplayName, scope)`,
   * applying alias accumulation when an existing row is returned. Used by
   * `upsertBySurface` when resolver Tier 1-3 didn't match — replaces the
   * naive `upsertEntity` call that raced past concurrent inserts of the
   * same surface. See `MemorySystem.tryAtomicCreateOrResolve` for the wiring.
   */
  atomicCreateOrResolve: (
    input: Partial<IEntity> & {
      identifiers: Identifier[];
      displayName: string;
      type: string;
      /** Surface + any caller-supplied aliases (used for alias accumulation on race-loss). */
      aliasesForMerge?: string[];
      metadataMerge?: 'fillMissing' | 'overwrite';
      /** Persistent multi-entity binding — written to `IEntity.contextIds`. */
      contextIds?: EntityId[];
    },
    scope: ScopeFilter,
  ) => Promise<{ entity: IEntity; created: boolean }>;
  /**
   * Patches an existing entity with additional aliases/identifiers (no-op if already present).
   * When `opts.metadata` is supplied, merges per `opts.metadataMerge`:
   *  - `'fillMissing'` (default): only keys absent from stored metadata are set.
   *  - `'overwrite'`: shallow-merge (incoming keys win).
   * When `opts.contextIdsToUnion` is supplied, the helper unions those entity
   * ids into `IEntity.contextIds` (dedupe + self-reference filter). Caller is
   * responsible for visibility-validating the additions.
   */
  appendAliasesAndIdentifiers: (
    id: EntityId,
    aliases: string[],
    identifiers: Identifier[],
    scope: ScopeFilter,
    opts?: {
      metadata?: Record<string, unknown>;
      metadataMerge?: 'fillMissing' | 'overwrite';
      contextIdsToUnion?: EntityId[];
    },
  ) => Promise<IEntity>;
}

export class EntityResolver {
  private readonly autoResolveThreshold: number;
  private readonly semanticEnabled: boolean;
  private readonly displayNameConfidence: number;
  private readonly aliasConfidence: number;
  private readonly semanticAutoResolveTypes: ReadonlySet<string>;
  private readonly semanticConfidenceCap: number;
  private readonly semanticMinScore: number;

  constructor(
    private readonly hooks: ResolverMemoryHooks,
    config?: EntityResolutionConfig,
  ) {
    this.autoResolveThreshold = config?.autoResolveThreshold ?? DEFAULT_AUTO_RESOLVE_THRESHOLD;
    // Default flipped to true in 0.9.1 — see types.ts:EntityResolutionConfig.enableSemanticResolution.
    this.semanticEnabled = config?.enableSemanticResolution !== false;
    this.displayNameConfidence =
      config?.displayNameMatchConfidence ?? DEFAULT_DISPLAY_NAME_CONFIDENCE;
    this.aliasConfidence = config?.aliasMatchConfidence ?? DEFAULT_ALIAS_CONFIDENCE;
    this.semanticAutoResolveTypes = new Set(
      config?.semanticAutoResolveTypes ?? DEFAULT_SEMANTIC_AUTO_RESOLVE_TYPES,
    );
    this.semanticConfidenceCap =
      config?.semanticConfidenceCap ?? DEFAULT_SEMANTIC_CONFIDENCE_CAP;
    this.semanticMinScore = config?.semanticMinScore ?? DEFAULT_SEMANTIC_MIN_SCORE;
  }

  /**
   * Per-type confidence cap for the semantic tier.
   *
   * Types in `semanticAutoResolveTypes` get the full cap (default 0.95) — high
   * enough to clear `autoResolveThreshold` (0.90) → auto-merge at write time.
   * Other types (notably `person`) stay at 0.89 — strictly below auto-resolve,
   * so semantic remains advisory: candidates surface in `mergeCandidates` but
   * never silently merge. Enforces the "people only merge by name + identifier
   * equality" rule structurally.
   */
  private semanticCapFor(type: string | undefined): number {
    if (type && this.semanticAutoResolveTypes.has(type)) {
      return this.semanticConfidenceCap;
    }
    return PERSON_ADVISORY_CONFIDENCE_CAP;
  }

  /**
   * Find candidate entities for a surface form. Returns ranked by confidence.
   * Empty array if nothing clears `opts.threshold` (default 0.5).
   */
  async resolve(
    query: ResolveEntityQuery,
    scope: ScopeFilter,
    opts?: ResolveEntityOptions,
  ): Promise<EntityCandidate[]> {
    const threshold = opts?.threshold ?? DEFAULT_THRESHOLD;
    const limit = opts?.limit ?? DEFAULT_LIMIT;
    const seen = new Map<EntityId, EntityCandidate>();

    // ---- Tier 1: strong identifier match ----
    if (query.identifiers && query.identifiers.length > 0) {
      for (const ident of query.identifiers) {
        const matches = await this.hooks.store.findEntitiesByIdentifier(
          ident.kind,
          ident.value,
          scope,
        );
        for (const entity of matches) {
          if (query.type && entity.type !== query.type) continue;
          const existing = seen.get(entity.id);
          const candidate: EntityCandidate = {
            entity,
            confidence: 1.0,
            matchedOn: 'identifier',
          };
          if (!existing || existing.confidence < candidate.confidence) {
            seen.set(entity.id, candidate);
          }
        }
      }
    }

    // ---- Tier 2 + 3: exact normalized displayName / alias match ----
    // Indexed exact-match via `findEntitiesByNormalizedName`. Replaces the
    // legacy `searchEntities(q, {limit:50})` substring-then-filter path,
    // which had two structural defects:
    //   (1) Order-sensitive — Mongo's `oversamplePool = max(500, skip + limit*5)`
    //       could truncate the candidate set when a surface had >500 substring
    //       siblings, dropping an exact match outside the ranked top-50.
    //   (2) Substring noise — every entity containing the surface as a substring
    //       was a candidate, then filtered down via `normalizeSurface(...) === ...`
    //       in process. Wasted bandwidth + memory at scale.
    //
    // `query.type` flows through to the adapter — when undefined, the adapter
    // matches across all types (less selective, but preserves the type-less
    // resolveEntity contract used by `createSubjectResolver`).
    const surface = query.surface.trim();
    if (surface.length > 0) {
      const normalized = normalizeSurface(surface);
      // Person-specific rule: Tier 2 (displayName) and Tier 3 (alias) ONLY
      // auto-resolve when the normalized surface carries ≥2 tokens. Single-
      // token first-name-only surfaces like "Pavel" / "John" / "Vlad" do NOT
      // identify a unique person inside a tenant — multiple humans share each.
      // Skipping the exact-tier lookup entirely lets the request fall through
      // to Tier 4 (semantic, capped at 0.89 advisory for persons) or, if no
      // semantic candidate clears 0.5, to a new-entity create. Operators can
      // still merge later via the dedup tooling; the resolver refuses to do
      // it silently. Enforces the "people only merge by first+last name
      // equality or identifier equality" rule structurally.
      const isSingleTokenPersonSurface =
        query.type === 'person' && normalized.split(' ').filter((t) => t.length > 0).length < 2;
      if (normalized.length > 0 && !isSingleTokenPersonSurface) {
        // Single call covers both Tier 2 (displayName) and Tier 3 (alias) —
        // `exactMatchTier` decides which one fired per entity. We still
        // recompute the tier per candidate because the adapter returns
        // matches via EITHER field when `matchAliases:true`, and the
        // resolver needs the confidence distinction.
        const hits = await this.hooks.store.findEntitiesByNormalizedName(
          query.type,
          normalized,
          scope,
          { matchAliases: true, limit: 50 },
        );
        for (const entity of hits) {
          if (query.type && entity.type !== query.type) continue;
          const tier = exactMatchTier(entity, surface, {
            displayNameConfidence: this.displayNameConfidence,
            aliasConfidence: this.aliasConfidence,
          });
          if (tier === null) continue;
          const candidate: EntityCandidate = {
            entity,
            confidence: tier.confidence,
            matchedOn: tier.matchedOn,
          };
          const existing = seen.get(entity.id);
          if (!existing || existing.confidence < candidate.confidence) {
            seen.set(entity.id, candidate);
          }
        }
      }
    }

    // ---- Tier 4: semantic match over identityEmbedding ----
    // Opt-in (`enableSemanticResolution: true`). Runs only when:
    //   - feature flag on,
    //   - an embedder is wired (we need to embed the query surface),
    //   - the store implements `semanticSearchEntities`,
    //   - the surface is non-empty.
    // Skipped when a tier-1 identifier match already produced a 1.0 candidate
    // — identifiers are authoritative and we don't want to waste the embed.
    if (
      this.semanticEnabled &&
      this.hooks.embedQuery &&
      this.hooks.store.semanticSearchEntities &&
      surface.length > 0
    ) {
      const topIdentifierMatch = [...seen.values()].some(
        (c) => c.matchedOn === 'identifier' && c.confidence >= 1.0,
      );
      const normalizedForEmbed = normalizeSurface(surface);
      // Skip when normalization collapses to empty (pure punctuation / whitespace) —
      // no signal to embed, and the raw surface would just be noise.
      if (!topIdentifierMatch && normalizedForEmbed) {
        try {
          const queryVec = await this.hooks.embedQuery(normalizedForEmbed);
          const results = await this.hooks.store.semanticSearchEntities(
            queryVec,
            query.type ? { type: query.type } : {},
            { topK: SEMANTIC_TOP_K, minScore: this.semanticMinScore },
            scope,
          );
          for (const { entity, score } of results) {
            if (query.type && entity.type !== query.type) continue;
            // Per-type cap: types in `semanticAutoResolveTypes` reach the full
            // semantic cap (default 0.95, clears 0.90 auto-resolve). Other
            // types (notably `person`) stay capped below auto-resolve so the
            // candidate surfaces in `mergeCandidates` for review.
            const cap = this.semanticCapFor(entity.type);
            const confidence = Math.min(score, cap);
            const candidate: EntityCandidate = {
              entity,
              confidence,
              matchedOn: 'embedding',
              rawSemanticScore: score,
            };
            const existing = seen.get(entity.id);
            // Strict tier priority — Tier 4 (semantic) NEVER replaces an
            // exact-tier hit (identifier/displayName/alias) on the same entity
            // regardless of capped confidence. Pre-0.9.1 this fell out of the
            // numeric comparison because the semantic cap (0.89) sat below
            // Tier 2/3 confidence (0.90). With the cap raised to 0.95 in 0.9.1,
            // the numeric check would silently let semantic overwrite a
            // displayName match — and `matchedOn` would lie to the audit log.
            if (existing && existing.matchedOn !== 'embedding') continue;
            if (!existing || existing.confidence < candidate.confidence) {
              seen.set(entity.id, candidate);
            }
          }
        } catch (err) {
          // Graceful degradation: log the failure (no silent errors per CLAUDE.md)
          // and fall through with tier 1-3 results only. The embedder or the
          // adapter might be temporarily unavailable; resolver still returns
          // useful exact matches.
          logger.warn(
            {
              component: 'EntityResolver',
              tier: 'semantic',
              surface,
              type: query.type,
              error: err instanceof Error ? err.message : String(err),
            },
            'semantic tier failed — falling through to tier 1-3 candidates',
          );
        }
      }
    }

    // ---- Context-aware disambiguation ----
    // Accept both `disambiguationEntityIds` (the new name) and `contextEntityIds`
    // (the deprecated alias). New name wins on collision; deprecation removal
    // will be a future major.
    const disambiguationIds =
      query.disambiguationEntityIds && query.disambiguationEntityIds.length > 0
        ? query.disambiguationEntityIds
        : query.contextEntityIds;
    if (disambiguationIds && disambiguationIds.length > 0 && seen.size > 1) {
      const contextSet = new Set(disambiguationIds);
      const topConfidence = Math.max(...[...seen.values()].map((c) => c.confidence));
      if (topConfidence < 1.0) {
        // Only disambiguate when top is not already a perfect identifier match.
        // Boost candidates with context-proximity by re-fetching their outbound
        // connections and counting overlaps with contextEntityIds.
        for (const candidate of seen.values()) {
          const facts = await this.hooks.store.findFacts(
            { touchesEntity: candidate.entity.id },
            { limit: 50 },
            scope,
          );
          let overlap = 0;
          for (const f of facts.items) {
            if (contextSet.has(f.subjectId)) overlap++;
            if (f.objectId && contextSet.has(f.objectId)) overlap++;
            if (f.contextIds) {
              for (const cid of f.contextIds) if (contextSet.has(cid)) overlap++;
            }
          }
          if (overlap > 0) {
            candidate.confidence = Math.min(1.0, candidate.confidence + overlap * 0.05);
          }
        }
      }
    }

    return [...seen.values()]
      .filter((c) => c.confidence >= threshold)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * Upsert-or-resolve: resolves the surface to an existing entity if top
   * candidate clears autoResolveThreshold, else creates a new entity.
   * Accumulates aliases + identifiers on matches — the system gets better
   * at recognizing the same entity across variant surface forms over time.
   */
  async upsertBySurface(
    input: UpsertBySurfaceInput,
    scope: ScopeFilter,
    opts?: UpsertBySurfaceOptions,
  ): Promise<UpsertBySurfaceResult> {
    const threshold = opts?.autoResolveThreshold ?? this.autoResolveThreshold;
    const candidates = await this.resolve(
      {
        surface: input.surface,
        type: input.type,
        identifiers: input.identifiers,
        disambiguationEntityIds:
          input.disambiguationEntityIds ?? input.contextEntityIds,
      },
      scope,
      { limit: 5, threshold: 0.5 },
    );

    const top = candidates[0];
    if (top && top.confidence >= threshold) {
      // Accumulate new aliases + identifiers on the matched entity. Metadata
      // defaults to fillMissing merge — re-upsert should never overwrite an
      // existing task.state, event.startTime, etc. Callers who want to mutate
      // deliberately should use updateEntityMetadata / transitionTaskState.
      //
      // contextIds, by contrast, ALWAYS unions — the multi-entity binding is
      // strictly additive over time as new signals reveal more anchors. The
      // helper visibility-checks each addition before writing.
      const newAliases = [input.surface, ...(input.aliases ?? [])];
      const hasContextIds = !!input.contextIds && input.contextIds.length > 0;
      const entity = await this.hooks.appendAliasesAndIdentifiers(
        top.entity.id,
        newAliases,
        input.identifiers ?? [],
        scope,
        input.metadata || hasContextIds
          ? {
              metadata: input.metadata,
              metadataMerge: opts?.metadataMerge ?? 'fillMissing',
              contextIdsToUnion: input.contextIds,
            }
          : undefined,
      );
      const mergeCandidates = candidates.slice(1);

      // Audit hook for Tier-4-driven auto-merges. The library historically
      // produced a NEW entity in this code path (semantic cap was 0.89 <
      // 0.90 threshold). Now that 0.9.1 allows semantic auto-resolve for
      // non-person types, hosts need visibility into silent merges that
      // would have produced duplicate rows under the old behavior.
      //
      // Log at warn level (per CLAUDE.md: no silent decisions). MemorySystem
      // also emits a structured `entity.upsert.semantic_automerge` event so
      // hosts can route to an activity log without parsing console output.
      if (top.matchedOn === 'embedding') {
        logger.warn(
          {
            component: 'EntityResolver',
            event: 'semantic_automerge',
            entityId: top.entity.id,
            entityType: top.entity.type,
            surface: input.surface,
            cosine: top.rawSemanticScore,
            confidence: top.confidence,
            otherCandidates: mergeCandidates.length,
          },
          'auto-resolved via Tier-4 semantic match — caller did not need to create a new entity',
        );
      }

      return {
        entity,
        resolved: true,
        mergeCandidates,
        matchedOn: top.matchedOn,
        rawSemanticScore: top.rawSemanticScore,
      };
    }

    // No candidate cleared the threshold. Use the atomic create-or-resolve
    // primitive — guards against two concurrent extractions of the same
    // surface both reaching here on an empty DB and each inserting. The
    // primitive returns `created: false` when a racer (or a now-visible
    // entity that resolve() missed for some adapter-specific reason) wins;
    // in that case the helper has already accumulated our aliases /
    // identifiers / metadata onto the winner.
    const aliasesForMerge = [input.surface, ...(input.aliases ?? [])];
    const { entity, created } = await this.hooks.atomicCreateOrResolve(
      {
        type: input.type,
        displayName: input.surface,
        aliases: input.aliases,
        identifiers: input.identifiers ?? [],
        metadata: input.metadata,
        contextIds: input.contextIds,
        aliasesForMerge,
        metadataMerge: opts?.metadataMerge ?? 'fillMissing',
        // CREATE-only acl stamp: `tryAtomicCreateOrResolve` plumbs this into
        // `NewEntity` → `createEntity`. On race-loss / pre-existing match, the
        // helper falls into the alias-accumulation path which IGNORES `acl` —
        // pre-existing entity access state is never narrowed by a later
        // resolve. See `UpsertBySurfaceInput.acl` doc.
        acl: input.acl,
      },
      scope,
    );
    // `resolved: false` only when we genuinely created. A race-loss returns
    // `created: false` — semantically the same as a resolver hit, so signal
    // `resolved: true` to callers (ExtractionResolver, etc) that branch on it.
    return {
      entity,
      resolved: !created,
      mergeCandidates: candidates,
    };
  }
}

// =============================================================================
// Private helpers
// =============================================================================

function exactMatchTier(
  entity: IEntity,
  surface: string,
  confidences: { displayNameConfidence: number; aliasConfidence: number },
): { confidence: number; matchedOn: 'displayName' | 'alias' } | null {
  const normSurface = normalizeSurface(surface);
  if (!normSurface) return null;
  if (normalizeSurface(entity.displayName) === normSurface) {
    return { confidence: confidences.displayNameConfidence, matchedOn: 'displayName' };
  }
  if (entity.aliases) {
    for (const a of entity.aliases) {
      if (normalizeSurface(a) === normSurface) {
        return { confidence: confidences.aliasConfidence, matchedOn: 'alias' };
      }
    }
  }
  return null;
}

/**
 * Short string embedded for identity matching. Composed of displayName,
 * top aliases, and primary identifier values. Populated on every entity
 * write when an embedder is configured; consumed by the future entity-level
 * semantic search tier (not yet wired — see file header).
 */
export function buildIdentityString(args: {
  type: string;
  displayName: string;
  aliases: string[];
  identifiers: Identifier[];
}): string {
  const primaryIds = args.identifiers
    .filter((i) => i.isPrimary)
    .slice(0, 3)
    .map((i) => `${i.kind}:${i.value}`);
  const otherIds = args.identifiers
    .filter((i) => !i.isPrimary)
    .slice(0, 2)
    .map((i) => `${i.kind}:${i.value}`);
  const allIds = [...primaryIds, ...otherIds].slice(0, 3);
  const aliasStr = args.aliases.slice(0, 3).join(', ');
  return `${args.type}: ${args.displayName}${aliasStr ? ' | aliases: ' + aliasStr : ''}${
    allIds.length > 0 ? ' | ids: ' + allIds.join(', ') : ''
  }`;
}

// Re-export defaults so MemorySystem can keep consistent thresholds.
export const RESOLUTION_DEFAULTS = {
  autoResolveThreshold: DEFAULT_AUTO_RESOLVE_THRESHOLD,
  threshold: DEFAULT_THRESHOLD,
  limit: DEFAULT_LIMIT,
} as const;
