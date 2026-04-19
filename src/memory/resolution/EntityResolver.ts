/**
 * EntityResolver — translate surface forms ("Microsoft", "Q3 Planning", "John")
 * to existing entity IDs, creating new entities when nothing matches confidently.
 *
 * Matching hierarchy (first pass that produces a candidate wins the tier):
 *   1. Strong identifier match        → confidence 1.0
 *   2. Exact displayName (case-insensitive) → confidence 0.90
 *   3. Exact alias match              → confidence 0.85
 *   4. Fuzzy displayName/alias        → confidence 0.5–0.8 (via normalized Levenshtein)
 *   5. Semantic match via identityEmbedding → confidence 0.4–0.8 (via cosine)
 *
 * Context-aware disambiguation: when multiple candidates pass threshold,
 * prefer the one that shares the most `contextEntityIds` with already-
 * resolved mentions in the same signal.
 *
 * Alias accumulation: `upsertBySurface` records the incoming surface + any
 * supplied identifiers on the matched entity, so the system gets better with
 * use — future mentions of the same surface hit the exact-alias match.
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
import { normalizedLevenshteinRatio, normalizeSurface } from './fuzzy.js';

const DEFAULT_AUTO_RESOLVE_THRESHOLD = 0.9;
const DEFAULT_MIN_FUZZY_RATIO = 0.85;
const DEFAULT_THRESHOLD = 0.5;
const DEFAULT_LIMIT = 5;
const DEFAULT_SEMANTIC_TOP_K = 5;

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
  /** Patches an existing entity with additional aliases/identifiers (no-op if already present). */
  appendAliasesAndIdentifiers: (
    id: EntityId,
    aliases: string[],
    identifiers: Identifier[],
    scope: ScopeFilter,
  ) => Promise<IEntity>;
}

export class EntityResolver {
  private readonly autoResolveThreshold: number;
  private readonly minFuzzyRatio: number;
  private readonly identityEmbeddingEnabled: boolean;

  constructor(
    private readonly hooks: ResolverMemoryHooks,
    config?: EntityResolutionConfig,
  ) {
    this.autoResolveThreshold = config?.autoResolveThreshold ?? DEFAULT_AUTO_RESOLVE_THRESHOLD;
    this.minFuzzyRatio = config?.minFuzzyRatio ?? DEFAULT_MIN_FUZZY_RATIO;
    this.identityEmbeddingEnabled = config?.enableIdentityEmbedding ?? true;
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

    // ---- Tier 2 + 3: exact displayName + alias match via searchEntities ----
    // searchEntities does substring matching — exact matches hit here.
    const surface = query.surface.trim();
    if (surface.length > 0) {
      const page = await this.hooks.store.searchEntities(
        surface,
        { types: query.type ? [query.type] : undefined, limit: 20 },
        scope,
      );
      for (const entity of page.items) {
        const tier = exactMatchTier(entity, surface);
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

      // ---- Tiers 2/3/4 over a broader candidate pool ----
      // searchEntities is substring-based — it misses cases like
      // "Microsoft Inc." (not a substring of "Microsoft") and typos like
      // "Microsft" vs "Microsoft". Pull a broader pool via listEntities,
      // bounded by type, and run both exact-after-normalization and fuzzy
      // matching over it.
      const fuzzyCandidatePool = await this.hooks.store.listEntities(
        { type: query.type },
        { limit: 500 },
        scope,
      );
      for (const entity of fuzzyCandidatePool.items) {
        if (seen.has(entity.id)) continue; // already resolved via tier 1 or substring hit
        // First try tier 2/3 — exact after normalization (handles "Inc.", case, punctuation).
        const tier = exactMatchTier(entity, surface);
        if (tier !== null) {
          seen.set(entity.id, {
            entity,
            confidence: tier.confidence,
            matchedOn: tier.matchedOn,
          });
          continue;
        }
        // Then tier 4 — fuzzy ratio.
        const fuzzyScore = bestFuzzyScore(entity, surface);
        if (fuzzyScore >= this.minFuzzyRatio) {
          // Map fuzzy ratio [minFuzzyRatio, 1.0] → [0.6, 0.84].
          // 0.6 lower bound so the "aggressive auto-resolve" threshold that
          // users choose (0.6) fires for near-matches; 0.84 upper avoids
          // collision with exact-alias tier (0.85).
          const confidence =
            0.6 + ((fuzzyScore - this.minFuzzyRatio) / (1 - this.minFuzzyRatio)) * 0.24;
          seen.set(entity.id, { entity, confidence, matchedOn: 'fuzzy' });
        }
      }
    }

    // ---- Tier 5: semantic embedding fallback ----
    if (this.identityEmbeddingEnabled && this.hooks.embedQuery && this.hooks.store.semanticSearch) {
      try {
        const queryVec = await this.hooks.embedQuery(
          buildIdentityString({
            type: query.type ?? 'entity',
            displayName: query.surface,
            aliases: [],
            identifiers: query.identifiers ?? [],
          }),
        );
        // We deliberately use semanticSearch on facts to find entities via their profile embedding.
        // But for identity embedding matching, callers can also provide a custom path — here we fall
        // back to a best-effort cosine over entities we've already seen's embeddings.
        // Proper vector search on entities would require a store-level API; v1 uses just the
        // fuzzy/string path as the main fallback.
        // So this tier only contributes when an entity's identityEmbedding is already loaded
        // among the `seen` set candidates (or we extend the store to support entity vector
        // search). For now: compute cosine against already-seen entities' identityEmbeddings.
        for (const candidate of seen.values()) {
          const ie = candidate.entity.identityEmbedding;
          if (!ie || ie.length !== queryVec.length) continue;
          const score = cosine(queryVec, ie);
          // Reweight: entities with strong semantic match but no string match get a lift.
          const semConfidence = 0.4 + score * 0.4; // 0 → 0.4, 1 → 0.8
          if (candidate.matchedOn === 'fuzzy' && semConfidence > candidate.confidence) {
            seen.set(candidate.entity.id, {
              entity: candidate.entity,
              confidence: semConfidence,
              matchedOn: 'embedding',
            });
          }
        }
      } catch {
        // Embedding failures never break resolution — we just fall back.
      }
    }

    // ---- Context-aware disambiguation ----
    if (query.contextEntityIds && query.contextEntityIds.length > 0 && seen.size > 1) {
      const contextSet = new Set(query.contextEntityIds);
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
        contextEntityIds: input.contextEntityIds,
      },
      scope,
      { limit: 5, threshold: 0.5 },
    );

    const top = candidates[0];
    if (top && top.confidence >= threshold) {
      // Accumulate new aliases + identifiers on the matched entity.
      const newAliases = [input.surface, ...(input.aliases ?? [])];
      const entity = await this.hooks.appendAliasesAndIdentifiers(
        top.entity.id,
        newAliases,
        input.identifiers ?? [],
        scope,
      );
      const mergeCandidates = candidates.slice(1);
      return { entity, resolved: true, mergeCandidates };
    }

    // Create new entity.
    const { entity } = await this.hooks.upsertEntity(
      {
        type: input.type,
        displayName: input.surface,
        aliases: input.aliases,
        identifiers: input.identifiers ?? [],
      },
      scope,
    );
    return { entity, resolved: false, mergeCandidates: candidates };
  }
}

// =============================================================================
// Private helpers
// =============================================================================

function exactMatchTier(
  entity: IEntity,
  surface: string,
): { confidence: number; matchedOn: 'displayName' | 'alias' } | null {
  const normSurface = normalizeSurface(surface);
  if (!normSurface) return null;
  if (normalizeSurface(entity.displayName) === normSurface) {
    return { confidence: 0.9, matchedOn: 'displayName' };
  }
  if (entity.aliases) {
    for (const a of entity.aliases) {
      if (normalizeSurface(a) === normSurface) {
        return { confidence: 0.85, matchedOn: 'alias' };
      }
    }
  }
  return null;
}

function bestFuzzyScore(entity: IEntity, surface: string): number {
  let best = normalizedLevenshteinRatio(entity.displayName, surface);
  if (entity.aliases) {
    for (const a of entity.aliases) {
      const r = normalizedLevenshteinRatio(a, surface);
      if (r > best) best = r;
    }
  }
  return best;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Short string embedded for identity matching. Composed of displayName,
 * top aliases, and primary identifier values. See MemorySystem.ensureIdentityEmbedding.
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
  minFuzzyRatio: DEFAULT_MIN_FUZZY_RATIO,
  threshold: DEFAULT_THRESHOLD,
  limit: DEFAULT_LIMIT,
  semanticTopK: DEFAULT_SEMANTIC_TOP_K,
} as const;
