/**
 * Content embedding composers — pluggable strategies that compose the semantic
 * text fed into `IEntity.contentEmbedding` / `IFact.embedding`.
 *
 * Two-axis design (see `IEntity.identityEmbedding` vs `IEntity.contentEmbedding`):
 *  - **identity** — narrow, name/alias/identifier-only. Drives `EntityResolver`'s
 *    semantic fallback tier. Never includes metadata or relationships; otherwise
 *    EntityResolver would merge entities with similar context.
 *  - **content** — rich, full-meaning view. Drives `findSimilarOpenTasks`,
 *    `searchDocuments`, and any future `semanticSearchEntities` retrieval flow.
 *    Includes type-specific metadata (task.state, event.attendees, etc.) and
 *    resolves referenced entity ids to displayNames so embeddings reflect
 *    meaning rather than opaque ids.
 *
 * Composers are pure with respect to their inputs (entity/fact + resolved
 * references). They produce deterministic output strings — same input → same
 * text — so the dedup-on-equal optimization in `EmbeddingQueue` works.
 *
 * Re-embedding triggers (MemorySystem-side, not composer-side): every entity
 * mutation site composes the new text, diffs against `entity.contentEmbeddingText`
 * (the text-of-record from the prior embed), and enqueues when different. Empty
 * string → skip (entity has no semantic content). Composers MUST return `''`
 * (not `null`) to skip, mirroring the document-composer convention.
 *
 * **What composers see vs. what they don't:**
 *  - Composers see the entity/fact as it WILL be after the mutation — never the
 *    prior state. The diff happens at the call site, comparing the freshly
 *    composed string to the stored `contentEmbeddingText`.
 *  - Composers do NOT see ScopeFilter. The `ComposeContext` carries a
 *    pre-bound resolver — composers only call `resolveEntity(id)` or its
 *    convenience cousins. This keeps composers framework-agnostic and prevents
 *    accidental cross-scope leakage.
 *
 * **Cascade-on-rename is intentionally NOT done** (see CLAUDE.md memory section
 * — "no cascade, eventual consistency"). When entity X is renamed, any entity
 * whose composer referenced X's displayName has a stale embedding until its
 * next mutation. Hosts that care can run `MemorySystem.backfillContentEmbeddings`
 * after a rename cascade.
 */

import type { EntityId, IEntity, IFact, ScopeFilter, IMemoryStore } from '../types.js';

/**
 * Compose the semantic content text for an entity. Return `''` to opt out of
 * semantic search for this entity (no embedding queued).
 *
 * Async because composers commonly resolve referenced entity ids (assigneeId,
 * projectId, contextIds, ...) to displayNames. The provided `ComposeContext`
 * batches + caches these lookups within a single compose call.
 */
export interface EntityContentComposer {
  compose(entity: IEntity, ctx: ComposeContext): Promise<string>;
}

/**
 * Compose the semantic content text for a fact. Same conventions as
 * `EntityContentComposer`. Receives the full `IFact` and can resolve
 * `subjectId` / `objectId` / `contextIds` to displayNames so even short
 * triples become semantically meaningful (e.g. "Sarah works_at Acme" instead
 * of "ent-abc works_at ent-xyz").
 *
 * Return `''` to skip embedding entirely — used by registries that don't want
 * to embed every atomic fact (cost guardrail).
 */
export interface FactContentComposer {
  compose(fact: IFact, ctx: ComposeContext): Promise<string>;
}

/**
 * Read-only resolver passed to every compose call. Wraps the underlying store
 * with a per-call cache so repeated lookups (e.g. a task that references the
 * same project in both `metadata.projectId` and `contextIds`) collapse into
 * one round-trip.
 *
 * Missing / scope-invisible ids resolve to `null` — composers should treat
 * this as "reference is dangling; omit from the composed text".
 */
export interface ComposeContext {
  /** Resolve a single entity to its full `IEntity`. `null` for missing / invisible. */
  resolveEntity(id: EntityId): Promise<IEntity | null>;
  /**
   * Batched fetch. Returned array aligns with `ids` positionally; missing /
   * invisible entries become `null`. Prefer this over a loop of `resolveEntity`
   * when a composer has many ids to resolve up-front.
   */
  resolveEntities(ids: EntityId[]): Promise<Array<IEntity | null>>;
  /** Convenience: resolve to displayName. `null` for missing / invisible. */
  resolveDisplayName(id: EntityId): Promise<string | null>;
  /** Convenience: batched displayName resolution. */
  resolveDisplayNames(ids: EntityId[]): Promise<Array<string | null>>;
}

/**
 * Internal implementation of `ComposeContext` — wraps an `IMemoryStore` with a
 * per-call cache. Exposed so `MemorySystem.composeEntityContent` can build one
 * per mutation without re-implementing the cache logic.
 */
export class CachedComposeContext implements ComposeContext {
  private readonly cache = new Map<EntityId, IEntity | null>();

  constructor(
    private readonly store: IMemoryStore,
    private readonly scope: ScopeFilter,
  ) {}

  async resolveEntity(id: EntityId): Promise<IEntity | null> {
    if (this.cache.has(id)) return this.cache.get(id) ?? null;
    const e = await this.store.getEntity(id, this.scope);
    this.cache.set(id, e);
    return e;
  }

  async resolveEntities(ids: EntityId[]): Promise<Array<IEntity | null>> {
    if (ids.length === 0) return [];
    const missing: EntityId[] = [];
    for (const id of ids) {
      if (!this.cache.has(id)) missing.push(id);
    }
    if (missing.length > 0) {
      const fetched = await this.store.getEntities(missing, this.scope);
      for (let i = 0; i < missing.length; i++) {
        this.cache.set(missing[i]!, fetched[i] ?? null);
      }
    }
    return ids.map((id) => this.cache.get(id) ?? null);
  }

  async resolveDisplayName(id: EntityId): Promise<string | null> {
    const e = await this.resolveEntity(id);
    return e?.displayName ?? null;
  }

  async resolveDisplayNames(ids: EntityId[]): Promise<Array<string | null>> {
    const ents = await this.resolveEntities(ids);
    return ents.map((e) => e?.displayName ?? null);
  }
}
