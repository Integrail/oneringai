/**
 * MongoMemoryAdapter — implements IMemoryStore on top of two Mongo-like
 * collections (entities + facts). Works identically with the raw mongodb
 * driver and Meteor's Mongo.Collection via the two provided wrappers.
 *
 * Design notes:
 *   - Scope filtering is pushed into every query (never post-filtered in app).
 *   - Optimistic concurrency is enforced via a `version` guard in the filter.
 *   - Bulk writes use `bulkWrite` when the collection supports it, else fall
 *     back to sequential writes.
 *   - `traverse` has two modes: iterative (always works) or native `$graphLookup`
 *     (faster, requires `aggregate` capability + `useNativeGraphLookup: true`).
 *   - `semanticSearch` has two modes: cursor-scan cosine (always works) or
 *     Atlas Vector Search (requires `aggregate` + `vectorIndexName`).
 */

import type {
  EntityEmbeddingField,
  EntityId,
  EntityListFilter,
  EntitySearchOptions,
  EntitySemanticSearchFilter,
  FactFilter,
  FactId,
  FactQueryOptions,
  IEntity,
  IFact,
  IMemoryStore,
  ListOptions,
  Neighborhood,
  NewEntity,
  NewFact,
  Page,
  ScopeFilter,
  SemanticSearchOptions,
  TraversalOptions,
} from '../../types.js';
import { coerceFactTemporalFields, coerceMetadataDates } from '../../dateCoercion.js';
import { genericTraverse } from '../../GenericTraversal.js';
import { normalizeIdentifierValue } from '../../identifiers.js';
import { computeNormalizedFields } from '../../normalize.js';
import type {
  IMongoCollectionLike,
  MongoFilter,
  MongoSort,
  SearchIndexDefinition,
} from './IMongoCollectionLike.js';
import { mergeFilters, scopeToFilter } from './scopeFilter.js';
import { ensureIndexes } from './indexes.js';
import { warnIfLimitWithoutOrder } from '../orderByWarning.js';
import {
  factFilterToMongo,
  formatCursor,
  orderByToSort,
  parseCursor,
} from './queries.js';

// =============================================================================
// Errors
// =============================================================================

export class MongoOptimisticConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MongoOptimisticConcurrencyError';
  }
}

// =============================================================================
// Options
// =============================================================================

export interface MongoMemoryAdapterOptions {
  entities: IMongoCollectionLike<IEntity>;
  facts: IMongoCollectionLike<IFact>;

  /**
   * Optional archive collection for facts. When provided, the adapter
   * switches to **move-on-archive** semantics:
   *
   *   - `updateFact(id, {archived: true}, scope)` moves the doc from
   *     `facts` to `factsArchive` (stamping `archivedAt`) instead of
   *     setting `archived: true` in place.
   *   - `updateFact(id, {archived: false}, scope)` (restoreFact) moves
   *     the doc back from `factsArchive` to `facts`.
   *   - `getFact(id)` falls back to `factsArchive` when the id isn't in
   *     `facts` — supersession-chain walks and audit reads of archived
   *     facts keep working.
   *   - `findFacts(filter)` with `filter.archived === true` queries
   *     `factsArchive`; otherwise queries `facts` (which stays live-only).
   *   - `countFacts(...)` uses the same routing.
   *
   * Benefits at scale: the live (primary) collection stays small even when
   * archive history is large; indexes don't carry archived rows; the
   * `archived: false / $exists: false` read filter becomes redundant on the
   * primary collection (every doc there is live by construction) and can be
   * dropped by callers.
   *
   * When omitted, behaviour is unchanged — archived docs stay in the
   * primary collection with `archived: true` (legacy mode).
   */
  factsArchive?: IMongoCollectionLike<IFact>;

  /**
   * When true, `scopeToFilter` omits the "world" branch
   * (`groupId: {$ne: caller.groupId} ∧ permissions.world !== 'none'`) from
   * the produced read filter. Use this in deployments where cross-tenant
   * world-readable visibility is not used — the `$ne` predicate is
   * fundamentally not sargable and forces a wide collection scan on every
   * branch-equipped query (subject lookups, identifier lookups, traversal),
   * dwarfing any potential benefit when no docs actually carry
   * `permissions.world: 'read'`. Default false (backwards-compatible).
   *
   * **Security note:** enabling this changes the visibility contract. Any
   * record carrying `permissions.world: 'read'` becomes invisible to
   * cross-group callers — silently from the caller's perspective. The
   * adapter emits a one-time `console.warn` at construction so the
   * trade-off isn't fully silent operationally; pass a `logger` to route
   * the warning through your own infrastructure instead.
   */
  disableWorldVisibility?: boolean;

  /**
   * Optional logger used for boot-time advisories (currently: the
   * `disableWorldVisibility` security trade-off warning). Defaults to
   * `console.warn`. Pass your app's logger to redirect into structured
   * logging.
   */
  logger?: { warn(msg: string): void };

  /**
   * When true AND `facts.aggregate` is present, `traverse()` uses a single
   * native `$graphLookup` pipeline per direction instead of iterative BFS.
   * Default: false.
   */
  useNativeGraphLookup?: boolean;

  /**
   * When set AND `facts.aggregate` is present, `semanticSearch()` uses Atlas
   * Vector Search via `$vectorSearch` against this index name. Otherwise
   * falls back to cursor-scan cosine.
   */
  vectorIndexName?: string;

  /**
   * When set AND `entities.aggregate` is present, `semanticSearchEntities()`
   * uses Atlas Vector Search via `$vectorSearch` against this index name.
   * Otherwise falls back to cursor-scan cosine over `entity.identityEmbedding`.
   *
   * Index is NOT auto-created by `ensureIndexes()` (which only handles regular
   * b-tree indexes). Create it via `ensureVectorSearchIndexes()` (programmatic,
   * requires mongodb node driver v6.6+ + Atlas Server v6.0.11+) or via the
   * Atlas UI / admin API. See `ensureVectorSearchIndexes` JSDoc for details.
   */
  entityVectorIndexName?: string;

  /**
   * Atlas Vector Search index for `entity.contentEmbedding` — used when
   * `semanticSearchEntities` is called with `opts.embeddingField:'content'`
   * (currently consumed by `MemorySystem.searchDocuments`). Distinct from
   * `entityVectorIndexName` so identity matches never leak into content
   * search and vice versa. Same auto-creation rules as the identity index:
   * not built by `ensureIndexes()`; create via `ensureVectorSearchIndexes()`.
   */
  entityContentVectorIndexName?: string;

  /**
   * Number of vector candidates to ask Atlas Vector Search to consider before
   * returning topK. Used by both `semanticSearch` (facts) and
   * `semanticSearchEntities` when the corresponding index name is set.
   * Default: topK * 10.
   */
  vectorCandidateMultiplier?: number;

  /**
   * Name of the facts collection — required by `$graphLookup` (it needs the
   * collection name to recurse over). If omitted, `useNativeGraphLookup` is
   * disabled and iterative BFS is used instead.
   */
  factsCollectionName?: string;

  /** Default page size when a caller doesn't specify `limit`. */
  defaultPageSize?: number;
}

// =============================================================================
// Adapter
// =============================================================================

const DEFAULT_PAGE_SIZE = 100;
const ARCHIVED_HIDDEN: MongoFilter = {
  $or: [{ archived: false }, { archived: { $exists: false } }],
};

export class MongoMemoryAdapter implements IMemoryStore {
  private readonly entities: IMongoCollectionLike<IEntity>;
  private readonly facts: IMongoCollectionLike<IFact>;
  private readonly factsArchive?: IMongoCollectionLike<IFact>;
  private readonly disableWorldVisibility: boolean;
  private readonly useNativeGraphLookup: boolean;
  private readonly vectorIndexName?: string;
  private readonly entityVectorIndexName?: string;
  private readonly entityContentVectorIndexName?: string;
  private readonly vectorCandidateMultiplier: number;
  private readonly factsCollectionName?: string;
  private readonly defaultPageSize: number;
  private destroyed = false;

  constructor(opts: MongoMemoryAdapterOptions) {
    this.entities = opts.entities;
    this.facts = opts.facts;
    this.factsArchive = opts.factsArchive;
    this.disableWorldVisibility = !!opts.disableWorldVisibility;
    this.useNativeGraphLookup =
      !!opts.useNativeGraphLookup && !!opts.facts.aggregate && !!opts.factsCollectionName;
    this.vectorIndexName = opts.vectorIndexName;
    this.entityVectorIndexName = opts.entityVectorIndexName;
    this.entityContentVectorIndexName = opts.entityContentVectorIndexName;
    this.vectorCandidateMultiplier = opts.vectorCandidateMultiplier ?? 10;
    this.factsCollectionName = opts.factsCollectionName;
    this.defaultPageSize = opts.defaultPageSize ?? DEFAULT_PAGE_SIZE;

    // H1: surface the disableWorldVisibility security trade-off at boot.
    // Silent toggling of read visibility would violate the project's
    // "never silent errors / never silent data mutations" rules — operators
    // need to see the contract change in their logs.
    if (this.disableWorldVisibility) {
      const logger = opts.logger ?? console;
      logger.warn(
        'MongoMemoryAdapter: disableWorldVisibility=true — the world-read branch ' +
          'of scope filtering is disabled. Any record carrying ' +
          "`permissions.world: 'read'` will NOT be returned to cross-group callers. " +
          'Use only when your deployment never relies on world-readable records.',
      );
    }
  }

  /**
   * Scope filter helper — honors the `disableWorldVisibility` option.
   * Always use this in place of bare `this.scope(scope)` inside the
   * adapter so the toggle propagates uniformly.
   */
  private scope(scope: ScopeFilter): MongoFilter {
    return scopeToFilter(scope, { disableWorld: this.disableWorldVisibility });
  }

  /**
   * H7: ensure the recommended indexes exist. Idempotent — Mongo's
   * `createIndex` is a no-op when the index is already present with matching
   * specification. Callers integrate this into their migration system; the
   * adapter does NOT call it automatically (indexes are the client app's
   * responsibility, not a library concern).
   *
   * Invokes the shared `ensureIndexes(...)` function against this adapter's
   * collections. See `indexes.ts` for the index list and why each exists.
   */
  async ensureIndexes(): Promise<void> {
    this.assertLive();
    await ensureIndexes({
      entities: this.entities,
      facts: this.facts,
      factsArchive: this.factsArchive,
    });
  }

  // ==========================================================================
  // Entities
  // ==========================================================================

  async createEntity(input: NewEntity): Promise<IEntity> {
    this.assertLive();
    const now = new Date();
    const doc = normalizeNewEntityForStorage({
      ...input,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    const id = await this.entities.insertOne(doc as unknown as IEntity);
    return reviveEntity({ ...doc, id } as IEntity);
  }

  async createEntities(inputs: NewEntity[]): Promise<IEntity[]> {
    this.assertLive();
    if (inputs.length === 0) return [];
    const now = new Date();
    const docs = inputs.map((input) =>
      normalizeNewEntityForStorage({
        ...input,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
    const ids = await this.entities.insertMany(docs as unknown as IEntity[]);
    return docs.map((d, i) => reviveEntity({ ...d, id: ids[i]! } as IEntity));
  }

  async updateEntity(entity: IEntity): Promise<void> {
    this.assertLive();
    if (entity.version < 2) {
      throw new MongoOptimisticConcurrencyError(
        `Entity ${entity.id}: update requires version >= 2 (got ${entity.version})`,
      );
    }
    const normalized = normalizeEntityForStorage(entity);
    const res = await this.entities.updateOne(
      { id: entity.id, version: entity.version - 1 },
      { $set: normalized },
    );
    if (res.matchedCount === 0) {
      throw new MongoOptimisticConcurrencyError(
        `Entity ${entity.id}: version mismatch (expected stored version = ${entity.version - 1})`,
      );
    }
  }

  async getEntity(id: EntityId, scope: ScopeFilter): Promise<IEntity | null> {
    this.assertLive();
    const filter = mergeFilters(this.scope(scope), ARCHIVED_HIDDEN, { id });
    const doc = await this.entities.findOne(filter);
    return doc ? reviveEntity(doc) : null;
  }

  async getEntities(ids: EntityId[], scope: ScopeFilter): Promise<Array<IEntity | null>> {
    this.assertLive();
    if (ids.length === 0) return [];
    const filter = mergeFilters(this.scope(scope), ARCHIVED_HIDDEN, {
      id: { $in: ids },
    });
    // Single batch query — one round-trip regardless of ids.length.
    const docs = await this.entities.find(filter, { limit: ids.length });
    const byId = new Map<string, IEntity>();
    for (const d of docs) {
      const e = reviveEntity(d);
      byId.set(e.id, e);
    }
    // Preserve input order; null for missing / scope-filtered-out.
    return ids.map((id) => byId.get(id) ?? null);
  }

  async findEntitiesByIdentifier(
    kind: string,
    value: string,
    scope: ScopeFilter,
  ): Promise<IEntity[]> {
    this.assertLive();
    const filter = mergeFilters(this.scope(scope), ARCHIVED_HIDDEN, {
      identifiers: {
        $elemMatch: { kind, value: normalizeIdentifierValue(kind, value) },
      },
    });
    const docs = await this.entities.find(filter, { limit: 50 });
    return docs.map(reviveEntity);
  }

  /**
   * Atomic find-or-create by `(type, normalizedDisplayName, scope)`. See the
   * interface contract.
   *
   * Implementation: optimistic find-then-insert with duplicate-key recovery.
   * Cross-process atomicity depends on the unique partial index on
   * `{groupId, ownerId, type, normalizedDisplayName}` being installed —
   * without it, a racing insert succeeds and produces duplicates. The library
   * exports `ensureNormalizedNameUniqueIndex` for hosts to install in their
   * migration (not auto-installed because adding a unique index to a
   * collection containing duplicates fails).
   */
  async atomicCreateOrFindByNormalizedName(
    input: NewEntity,
    scope: ScopeFilter,
  ): Promise<{ entity: IEntity; created: boolean }> {
    this.assertLive();
    const norm = computeNormalizedFields({
      displayName: input.displayName,
      aliases: input.aliases,
    });
    if (!norm.normalizedDisplayName) {
      return { entity: await this.createEntity(input), created: true };
    }
    const filter = mergeFilters(this.scope(scope), ARCHIVED_HIDDEN, {
      type: input.type,
      normalizedDisplayName: norm.normalizedDisplayName,
    });
    // Optimistic path — most calls find an existing entity, no insert needed.
    const found = await this.entities.findOne(filter);
    if (found) return { entity: reviveEntity(found), created: false };
    try {
      const entity = await this.createEntity(input);
      return { entity, created: true };
    } catch (err) {
      // E11000 — unique partial index rejected our insert because a racer
      // inserted first. Refetch the winner.
      if (!isDuplicateKeyError(err)) throw err;
      const winner = await this.entities.findOne(filter);
      if (!winner) throw err;
      return { entity: reviveEntity(winner), created: false };
    }
  }

  async findEntitiesByNormalizedName(
    type: string | undefined,
    normalized: string,
    scope: ScopeFilter,
    opts?: { matchAliases?: boolean; limit?: number },
  ): Promise<IEntity[]> {
    this.assertLive();
    // Empty normalized: same rationale as the InMemory implementation —
    // matching `''` would over-match any entity lacking the field, so we
    // shortcut to empty.
    if (!normalized) return [];
    const limit = opts?.limit ?? 20;
    const matchAliases = opts?.matchAliases === true;
    const nameClause: MongoFilter = matchAliases
      ? {
          $or: [
            { normalizedDisplayName: normalized },
            { normalizedAliases: normalized },
          ],
        }
      : { normalizedDisplayName: normalized };
    // Type-less queries (e.g. `MemorySystem.resolveEntity({surface})` without
    // a hint) drop the `type` clause and lean on the normalized-name index
    // prefix. Less selective than the typed path but materially cheaper than
    // the legacy substring scan, and avoids surprising callers who passed
    // no type.
    const filter =
      type !== undefined
        ? mergeFilters(this.scope(scope), ARCHIVED_HIDDEN, { type }, nameClause)
        : mergeFilters(this.scope(scope), ARCHIVED_HIDDEN, nameClause);
    const docs = await this.entities.find(filter, { limit });
    return docs.map(reviveEntity);
  }

  async searchEntities(
    query: string,
    opts: EntitySearchOptions,
    scope: ScopeFilter,
  ): Promise<Page<IEntity>> {
    this.assertLive();
    const q = query.trim();
    const qLower = q.toLowerCase();
    const clauses: MongoFilter[] = [this.scope(scope), ARCHIVED_HIDDEN];

    if (opts.types && opts.types.length > 0) {
      clauses.push({ type: { $in: opts.types } });
    }
    if (q.length > 0) {
      // Case-insensitive substring match on displayName, aliases, identifier values.
      const escaped = escapeRegex(q);
      clauses.push({
        $or: [
          { displayName: { $regex: escaped, $options: 'i' } },
          { aliases: { $regex: escaped, $options: 'i' } },
          { 'identifiers.value': { $regex: escaped, $options: 'i' } },
        ],
      });
    }
    const filter = mergeFilters(...clauses);

    const skip = parseCursor(opts.cursor);
    const limit = opts.limit ?? this.defaultPageSize;

    // Oversample so we can rank client-side, then paginate by skip/limit over
    // the ranked list. Cap at a reasonable total pool to bound work.
    const oversamplePool = Math.max(500, skip + limit * 5);
    const docs = await this.entities.find(filter, { limit: oversamplePool });
    const revived = docs.map(reviveEntity);

    // Rank by relevance when q is non-empty; otherwise preserve fetch order.
    if (qLower.length > 0) {
      const scored = revived.map((entity) => ({
        entity,
        score: entityRelevance(entity, qLower),
      }));
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.entity.displayName.localeCompare(b.entity.displayName);
      });
      const items = scored.slice(skip, skip + limit).map((s) => s.entity);
      return {
        items,
        nextCursor: formatCursor(skip, limit, items.length),
      };
    }

    const items = revived.slice(skip, skip + limit);
    return {
      items,
      nextCursor: formatCursor(skip, limit, items.length),
    };
  }

  async listEntities(
    filter: EntityListFilter,
    opts: ListOptions,
    scope: ScopeFilter,
  ): Promise<Page<IEntity>> {
    this.assertLive();
    warnIfLimitWithoutOrder('MongoMemoryAdapter', 'listEntities', opts);
    const clauses: MongoFilter[] = [this.scope(scope)];
    if (filter.archived === true) clauses.push({ archived: true });
    else if (filter.archived === false) clauses.push(ARCHIVED_HIDDEN);
    else clauses.push(ARCHIVED_HIDDEN);
    if (filter.type) clauses.push({ type: filter.type });
    if (filter.ids && filter.ids.length > 0) clauses.push({ id: { $in: filter.ids } });
    if (filter.contextId !== undefined) {
      // Top-level `contextIds` array — entity "lives within" the given anchor.
      // Mongo's implicit array-element match: `{contextIds: x}` matches docs
      // where contextIds includes x. Backed by the
      // `{groupId, type, contextIds}` and `{ownerId, type, contextIds}`
      // indexes installed by `ensureIndexes`.
      clauses.push({ contextIds: filter.contextId });
    }
    if (filter.metadataFilter) {
      clauses.push(metadataFilterToMongo(filter.metadataFilter));
    }
    const mongoFilter = mergeFilters(...clauses);

    const skip = parseCursor(opts.cursor);
    const limit = opts.limit ?? this.defaultPageSize;
    const sort = entityOrderByToSort(opts.orderBy);
    const projection = selectToProjection(opts.select);
    const docs = await this.entities.find(mongoFilter, { limit, skip, sort, projection });
    return {
      items: docs.map(reviveEntity),
      nextCursor: formatCursor(skip, limit, docs.length),
    };
  }

  async archiveEntity(id: EntityId, scope: ScopeFilter): Promise<void> {
    this.assertLive();
    const filter = mergeFilters(this.scope(scope), { id });
    await this.entities.updateOne(filter, {
      $set: { archived: true, updatedAt: new Date() },
      $inc: { version: 1 },
    });
  }

  async deleteEntity(id: EntityId, scope: ScopeFilter): Promise<void> {
    this.assertLive();
    const filter = mergeFilters(this.scope(scope), { id });
    await this.entities.deleteOne(filter);
  }

  // ==========================================================================
  // Facts
  // ==========================================================================

  async createFact(input: NewFact): Promise<IFact> {
    this.assertLive();
    const now = new Date();
    const doc = normalizeNewFactForStorage({ ...input, createdAt: now });
    const id = await this.facts.insertOne(doc as unknown as IFact);
    return reviveFact({ ...doc, id } as IFact);
  }

  async createFacts(inputs: NewFact[]): Promise<IFact[]> {
    this.assertLive();
    if (inputs.length === 0) return [];
    const now = new Date();
    const docs = inputs.map((input) => normalizeNewFactForStorage({ ...input, createdAt: now }));
    const ids = await this.facts.insertMany(docs as unknown as IFact[]);
    return docs.map((d, i) => reviveFact({ ...d, id: ids[i]! } as IFact));
  }

  async getFact(id: FactId, scope: ScopeFilter): Promise<IFact | null> {
    this.assertLive();
    const filter = mergeFilters(this.scope(scope), { id });
    const doc = await this.facts.findOne(filter);
    if (doc) return reviveFact(doc);
    // Move-on-archive fallback: an archived fact still needs to be
    // findable by id (supersession chain traversal, audit reads). Try
    // the archive collection when the primary returns null.
    if (this.factsArchive) {
      const archived = await this.factsArchive.findOne(filter);
      if (archived) return reviveFact(archived);
    }
    return null;
  }

  async findFacts(
    filter: FactFilter,
    opts: FactQueryOptions,
    scope: ScopeFilter,
  ): Promise<Page<IFact>> {
    this.assertLive();
    warnIfLimitWithoutOrder('MongoMemoryAdapter', 'findFacts', opts);
    const target = this.pickFactsCollection(filter);
    const mongoFilter = factFilterToMongo(filter, scope, {
      disableWorld: this.disableWorldVisibility,
    });
    const sort: MongoSort | undefined = orderByToSort(opts.orderBy);
    const skip = parseCursor(opts.cursor);
    const limit = opts.limit ?? this.defaultPageSize;
    const docs = await target.find(mongoFilter, { limit, skip, sort });
    return {
      items: docs.map(reviveFact),
      nextCursor: formatCursor(skip, limit, docs.length),
    };
  }

  async updateFact(id: FactId, patch: Partial<IFact>, scope: ScopeFilter): Promise<void> {
    this.assertLive();
    const { id: _ignoreId, ...rest } = patch;
    void _ignoreId;
    const cleanPatch = normalizePartialFactForStorage(rest);

    // Move-on-archive logic. Three cases:
    //   1. archived: true → move primary → archive
    //   2. archived: false (restoreFact) → move archive → primary
    //   3. anything else → in-place update on whichever collection holds
    //      the doc (primary first; fall back to archive)
    if (this.factsArchive) {
      const archivedValue = cleanPatch.archived;
      if (archivedValue === true) {
        await this.moveToArchive(id, scope, cleanPatch);
        return;
      }
      if (archivedValue === false) {
        await this.restoreFromArchive(id, scope, cleanPatch);
        return;
      }
    }

    // Default path — in-place update.
    const filter = mergeFilters(this.scope(scope), { id });
    const res = await this.facts.updateOne(filter, { $set: cleanPatch });
    if (res.matchedCount === 0 && this.factsArchive) {
      // Doc may live in archive (e.g. metadata write on an already-archived
      // fact). Apply the patch there.
      await this.factsArchive.updateOne(filter, { $set: cleanPatch });
    }
  }

  async countFacts(filter: FactFilter, scope: ScopeFilter): Promise<number> {
    this.assertLive();
    const target = this.pickFactsCollection(filter);
    return target.countDocuments(
      factFilterToMongo(filter, scope, { disableWorld: this.disableWorldVisibility }),
    );
  }

  /**
   * Route reads to the appropriate facts collection based on the
   * caller-supplied filter. When `archived === true` is requested and the
   * archive collection is wired up, hit the archive. Otherwise hit primary
   * (which holds only live docs once move-on-archive is active).
   */
  private pickFactsCollection(filter: FactFilter): IMongoCollectionLike<IFact> {
    if (filter.archived === true && this.factsArchive) return this.factsArchive;
    return this.facts;
  }

  /**
   * Move a doc from primary → archive, applying the caller's patch and
   * stamping `archivedAt`. Idempotent: if the doc is already in archive
   * (concurrent archive race, or repeated call) the function is a no-op
   * beyond ensuring the doc reflects the patch.
   *
   * The scope filter is applied to the read so callers can't archive docs
   * they don't have write access to.
   */
  private async moveToArchive(
    id: FactId,
    scope: ScopeFilter,
    patch: Partial<IFact>,
  ): Promise<void> {
    if (!this.factsArchive) return;
    const filter = mergeFilters(this.scope(scope), { id });
    const doc = await this.facts.findOne(filter);
    if (!doc) {
      // Already in archive (or never existed under this scope). Apply the
      // patch to the archive copy so callers that re-archive get expected
      // metadata updates.
      await this.factsArchive.updateOne(filter, { $set: patch });
      return;
    }
    const stamped: Record<string, unknown> = {
      ...(doc as unknown as Record<string, unknown>),
      ...patch,
      archived: true,
      archivedAt: (patch as Record<string, unknown>).archivedAt ?? new Date(),
    };
    // The id is on the doc; insertOne strips it (the collection wrapper
    // assigns the primary key). We need to PRESERVE the original id on the
    // archive side so subsequent getFact(id) finds it. Use updateOne with
    // upsert against `{id}` to write the doc body keyed by the original id.
    const { id: _strip, ...body } = stamped as { id?: string } & Record<string, unknown>;
    void _strip;
    await this.factsArchive.updateOne(
      { id },
      { $set: body },
      { upsert: true },
    );
    await this.facts.deleteOne(filter);
  }

  /**
   * Reverse of `moveToArchive` — move from archive → primary. Used by
   * `restoreFact`. The `archived` field is dropped on restore and
   * `archivedAt` cleared.
   */
  private async restoreFromArchive(
    id: FactId,
    scope: ScopeFilter,
    patch: Partial<IFact>,
  ): Promise<void> {
    if (!this.factsArchive) return;
    const filter = mergeFilters(this.scope(scope), { id });
    const doc = await this.factsArchive.findOne(filter);
    if (!doc) {
      // Already in primary. Apply the non-archive patch fields.
      const { archived: _drop, ...rest } = patch as Record<string, unknown>;
      void _drop;
      if (Object.keys(rest).length > 0) {
        await this.facts.updateOne(filter, { $set: rest });
      }
      return;
    }
    // Build the restored primary-side doc. Strip archive markers; apply
    // caller's patch (minus the `archived` flag, which we control here).
    const { archived: _omitFromPatch, ...patchRest } = patch as Record<string, unknown>;
    void _omitFromPatch;
    const restored: Record<string, unknown> = {
      ...(doc as unknown as Record<string, unknown>),
      ...patchRest,
      archived: false,
      archivedAt: undefined,
    };
    const { id: _strip, ...body } = restored as { id?: string } & Record<string, unknown>;
    void _strip;
    await this.facts.updateOne({ id }, { $set: body }, { upsert: true });
    await this.factsArchive.deleteOne(filter);
  }

  // ==========================================================================
  // Graph traversal
  // ==========================================================================

  async traverse(
    startId: EntityId,
    opts: TraversalOptions,
    scope: ScopeFilter,
  ): Promise<Neighborhood> {
    this.assertLive();

    // `direction: 'both'` requires per-hop direction flipping — at each node,
    // BOTH outbound and inbound edges are considered and may extend the
    // frontier. A single `$graphLookup` pipeline fixes the direction for the
    // whole chain (`connectFromField` / `connectToField` are static) — firing
    // one out + one in pipeline walks two PURE chains, which misses the
    // common "co-subject" pattern ("who works at the same company as X?"
    // reaches X → Company via out, then Company → co-workers via in — the
    // direction flip at Company is lost). Generic BFS handles the flip
    // correctly, so for `both` we fall back to it. Pure `out` / `in` stay on
    // the native fast path.
    if (opts.direction === 'both') {
      return genericTraverse(this, startId, opts, scope);
    }

    if (this.useNativeGraphLookup && this.facts.aggregate && this.factsCollectionName) {
      return this.nativeGraphTraverse(startId, opts, scope);
    }
    return genericTraverse(this, startId, opts, scope);
  }

  private async nativeGraphTraverse(
    startId: EntityId,
    opts: TraversalOptions,
    scope: ScopeFilter,
  ): Promise<Neighborhood> {
    const startEntity = await this.getEntity(startId, scope);
    if (!startEntity) return { nodes: [], edges: [] };

    // asOf — push the same three clauses factFilterToMongo uses, so the
    // native path behaves identically to the generic path for point-in-time
    // queries. Previously these were silently dropped.
    const asOfClauses = buildAsOfClauses(opts.asOf);
    const predicateClause: MongoFilter =
      opts.predicates && opts.predicates.length > 0
        ? { predicate: { $in: opts.predicates } }
        : {};
    const restrict: MongoFilter = mergeFilters(
      this.scope(scope),
      ARCHIVED_HIDDEN,
      predicateClause,
      ...asOfClauses,
    );

    type EdgeAccum = { from: EntityId; to: EntityId; fact: IFact; depth: number };
    const edgesOut: EdgeAccum[] = [];
    const edgesIn: EdgeAccum[] = [];

    // Off-by-one: $graphLookup.maxDepth=N returns (N+1) levels of documents
    // (0..N). The outer $match already emits depth-1 edges, so $graphLookup
    // should produce at most (opts.maxDepth - 1) additional levels, i.e.
    // maxDepth in mongo = opts.maxDepth - 2. When opts.maxDepth <= 1, we
    // skip $graphLookup entirely — the outer $match is sufficient.
    const useGraphLookup = opts.maxDepth >= 2;
    const graphLookupMaxDepth = Math.max(0, opts.maxDepth - 2);

    // Outbound — match subjectId=start, then (optionally) recurse object→subject chains.
    if (opts.direction === 'out') {
      const match: MongoFilter = mergeFilters(
        this.scope(scope),
        ARCHIVED_HIDDEN,
        { subjectId: startId },
        predicateClause,
        ...asOfClauses,
      );
      const pipeline: unknown[] = [{ $match: match }];
      if (useGraphLookup) {
        pipeline.push({
          $graphLookup: {
            from: this.factsCollectionName!,
            startWith: '$objectId',
            connectFromField: 'objectId',
            connectToField: 'subjectId',
            as: 'descendants',
            maxDepth: graphLookupMaxDepth,
            depthField: 'depth',
            restrictSearchWithMatch: restrict,
          },
        });
      }
      const rows = (await this.facts.aggregate!(pipeline)) as Array<
        IFact & { descendants?: Array<IFact & { depth: number }> }
      >;
      for (const row of rows) {
        if (!row.objectId) continue;
        edgesOut.push({ from: row.subjectId, to: row.objectId, fact: reviveFact(row), depth: 1 });
        for (const d of row.descendants ?? []) {
          if (!d.objectId) continue;
          edgesOut.push({
            from: d.subjectId,
            to: d.objectId,
            fact: reviveFact(d),
            depth: (d.depth ?? 0) + 2,
          });
        }
      }
    }

    // Inbound — mirror.
    if (opts.direction === 'in') {
      const match: MongoFilter = mergeFilters(
        this.scope(scope),
        ARCHIVED_HIDDEN,
        { objectId: startId },
        predicateClause,
        ...asOfClauses,
      );
      const pipeline: unknown[] = [{ $match: match }];
      if (useGraphLookup) {
        pipeline.push({
          $graphLookup: {
            from: this.factsCollectionName!,
            startWith: '$subjectId',
            connectFromField: 'subjectId',
            connectToField: 'objectId',
            as: 'ancestors',
            maxDepth: graphLookupMaxDepth,
            depthField: 'depth',
            restrictSearchWithMatch: restrict,
          },
        });
      }
      const rows = (await this.facts.aggregate!(pipeline)) as Array<
        IFact & { ancestors?: Array<IFact & { depth: number }> }
      >;
      for (const row of rows) {
        if (!row.objectId) continue;
        edgesIn.push({ from: row.subjectId, to: row.objectId, fact: reviveFact(row), depth: 1 });
        for (const a of row.ancestors ?? []) {
          if (!a.objectId) continue;
          edgesIn.push({
            from: a.subjectId,
            to: a.objectId,
            fact: reviveFact(a),
            depth: (a.depth ?? 0) + 2,
          });
        }
      }
    }

    // Apply edge limit BEFORE resolving nodes — the `opts.limit` contract
    // caps edges. Sort by depth first so that under a tight limit we keep
    // the nearest (shallowest) edges — matches BFS-ordering users expect and
    // the behavior of `genericTraverse` for parity across backends.
    const edgeLimit = opts.limit ?? Infinity;
    const allEdges = [...edgesOut, ...edgesIn]
      .sort((a, b) => a.depth - b.depth)
      .slice(0, edgeLimit);

    // Resolve entities for every node referenced by the (already-limited)
    // edges — no separate node cap. Node count is naturally bounded at
    // 2*edgeLimit + 1 via the edge cap above, so every returned edge is
    // guaranteed to have both endpoints present in `nodes`.
    const visited = new Map<EntityId, number>();
    visited.set(startId, 0);
    for (const e of allEdges) {
      const prev1 = visited.get(e.from);
      if (prev1 === undefined || prev1 > e.depth) visited.set(e.from, e.depth);
      const prev2 = visited.get(e.to);
      if (prev2 === undefined || prev2 > e.depth) visited.set(e.to, e.depth);
    }

    const nodes: Neighborhood['nodes'] = [];
    for (const [id, depth] of visited) {
      const ent = await this.getEntity(id, scope);
      if (ent) nodes.push({ entity: ent, depth });
    }

    return {
      nodes,
      edges: allEdges.map((e) => ({ fact: e.fact, from: e.from, to: e.to, depth: e.depth })),
    };
  }

  // ==========================================================================
  // Semantic search
  // ==========================================================================

  async semanticSearch(
    queryVector: number[],
    filter: FactFilter,
    opts: SemanticSearchOptions,
    scope: ScopeFilter,
  ): Promise<Array<{ fact: IFact; score: number }>> {
    this.assertLive();
    if (this.vectorIndexName && this.facts.aggregate) {
      return this.atlasVectorSearch(queryVector, filter, opts, scope);
    }
    return this.cursorCosine(queryVector, filter, opts, scope);
  }

  private async atlasVectorSearch(
    queryVector: number[],
    filter: FactFilter,
    opts: SemanticSearchOptions,
    scope: ScopeFilter,
  ): Promise<Array<{ fact: IFact; score: number }>> {
    const pipeline = [
      {
        $vectorSearch: {
          index: this.vectorIndexName!,
          path: 'embedding',
          queryVector,
          numCandidates: opts.topK * this.vectorCandidateMultiplier,
          limit: opts.topK,
          filter: factFilterToMongo(filter, scope, { disableWorld: this.disableWorldVisibility }),
        },
      },
      { $addFields: { score: { $meta: 'vectorSearchScore' } } },
    ];
    const rows = (await this.facts.aggregate!(pipeline)) as Array<IFact & { score?: number }>;
    return rows.map((r) => ({ fact: reviveFact(r), score: r.score ?? 0 }));
  }

  private async cursorCosine(
    queryVector: number[],
    filter: FactFilter,
    opts: SemanticSearchOptions,
    scope: ScopeFilter,
  ): Promise<Array<{ fact: IFact; score: number }>> {
    // Fall back: scan facts matching the filter + scope, cosine in memory.
    // Only consider facts with an embedding of matching dimension.
    const mongoFilter = mergeFilters(factFilterToMongo(filter, scope, { disableWorld: this.disableWorldVisibility }), {
      embedding: { $exists: true },
    });
    const docs = await this.facts.find(mongoFilter, { limit: 5000 });
    const scored: Array<{ fact: IFact; score: number }> = [];
    for (const doc of docs) {
      if (!doc.embedding || doc.embedding.length !== queryVector.length) continue;
      const score = cosine(queryVector, doc.embedding);
      scored.push({ fact: reviveFact(doc), score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, opts.topK);
  }

  // ==========================================================================
  // Semantic entity search (identityEmbedding)
  // ==========================================================================

  async semanticSearchEntities(
    queryVector: number[],
    filter: EntitySemanticSearchFilter,
    opts: SemanticSearchOptions & { minScore?: number; embeddingField?: EntityEmbeddingField },
    scope: ScopeFilter,
  ): Promise<Array<{ entity: IEntity; score: number }>> {
    this.assertLive();
    const field: EntityEmbeddingField = opts.embeddingField ?? 'identity';
    const indexName =
      field === 'content' ? this.entityContentVectorIndexName : this.entityVectorIndexName;
    const path = field === 'content' ? 'contentEmbedding' : 'identityEmbedding';
    if (indexName && this.entities.aggregate) {
      return this.atlasVectorSearchEntities(queryVector, filter, opts, scope, indexName, path);
    }
    return this.cursorCosineEntities(queryVector, filter, opts, scope, path);
  }

  private async atlasVectorSearchEntities(
    queryVector: number[],
    filter: EntitySemanticSearchFilter,
    opts: SemanticSearchOptions & { minScore?: number },
    scope: ScopeFilter,
    indexName: string,
    path: 'identityEmbedding' | 'contentEmbedding',
  ): Promise<Array<{ entity: IEntity; score: number }>> {
    const vectorFilter = mergeFilters(
      this.scope(scope),
      ARCHIVED_HIDDEN,
      entitySemanticFilterToMongo(filter),
    );
    const pipeline = [
      {
        $vectorSearch: {
          index: indexName,
          path,
          queryVector,
          numCandidates: opts.topK * this.vectorCandidateMultiplier,
          limit: opts.topK,
          filter: vectorFilter,
        },
      },
      { $addFields: { score: { $meta: 'vectorSearchScore' } } },
    ];
    const rows = (await this.entities.aggregate!(pipeline)) as Array<IEntity & { score?: number }>;
    const minScore = opts.minScore;
    const scored = rows
      .map((r) => ({ entity: reviveEntity(r), score: r.score ?? 0 }))
      .filter((r) => (minScore === undefined ? true : r.score >= minScore));
    return scored;
  }

  private async cursorCosineEntities(
    queryVector: number[],
    filter: EntitySemanticSearchFilter,
    opts: SemanticSearchOptions & { minScore?: number },
    scope: ScopeFilter,
    path: 'identityEmbedding' | 'contentEmbedding',
  ): Promise<Array<{ entity: IEntity; score: number }>> {
    const mongoFilter = mergeFilters(
      this.scope(scope),
      ARCHIVED_HIDDEN,
      entitySemanticFilterToMongo(filter),
      { [path]: { $exists: true } },
    );
    // Cap at 5000 to match fact-level cursor scan — scope + type narrows early.
    const docs = await this.entities.find(mongoFilter, { limit: 5000 });
    const minScore = opts.minScore;
    const scored: Array<{ entity: IEntity; score: number }> = [];
    for (const doc of docs) {
      const vec = path === 'contentEmbedding' ? doc.contentEmbedding : doc.identityEmbedding;
      if (!vec || vec.length !== queryVector.length) continue;
      const score = cosine(queryVector, vec);
      if (minScore !== undefined && score < minScore) continue;
      scored.push({ entity: reviveEntity(doc), score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, opts.topK);
  }

  // ==========================================================================
  // Atlas Search / Vector Search index management
  // ==========================================================================

  /**
   * Create the Atlas Vector Search indexes for facts and/or entities if they
   * aren't already present. Separate from `ensureIndexes()` because vector
   * indexes need runtime parameters (`dimensions`, `similarity`) and take
   * longer to build — callers shouldn't pay that cost unless they use
   * semantic search.
   *
   * Requires:
   *   - Atlas Server v6.0.11+ and mongodb node driver v6.6+ (the driver
   *     exposes `createSearchIndex` / `listSearchIndexes`).
   *   - The `IMongoCollectionLike` wrapper must implement `createSearchIndex`
   *     (both bundled wrappers do; custom wrappers may need updating).
   *
   * Idempotent — re-running is safe: existing indexes with the configured
   * name are detected via `listSearchIndexes` and skipped. Concurrent-create
   * races (two migrations running at once) are absorbed: if
   * `createSearchIndex` fails but the index is present on re-check, we
   * treat it as "another process won" and continue.
   *
   * Fire-and-forget: returns as soon as Atlas accepts the create request.
   * The index builds asynchronously on Atlas (30–60s typical). Runs during
   * startup migrations, so the index is ready well before real traffic.
   * The typical first query lands minutes after the migration, not seconds —
   * no readiness wait needed.
   *
   * **Index names come from the adapter's config by default.** If the adapter
   * was constructed with `vectorIndexName: 'custom_facts'` (or
   * `entityVectorIndexName: 'custom_entities'`), this helper creates indexes
   * under those names automatically. Callers can still override via
   * `factsIndexName` / `entitiesIndexName`, but the default is the safe
   * choice — runtime queries and helper output always agree.
   *
   * **Filter fields are auto-declared in the index definition.** Atlas
   * `$vectorSearch` silently ignores `filter` clauses whose paths aren't
   * declared as `type: 'filter'` in the index. We declare scope + archived
   * + discriminator paths for both collections so scope enforcement works
   * on the `$vectorSearch` fast path. See the field lists in
   * `FACTS_FILTER_PATHS` / `ENTITIES_FILTER_PATHS` below — manual Atlas-UI
   * creators must match or the filter is silently ignored (scope bypass).
   */
  async ensureVectorSearchIndexes(opts: {
    /** Embedding dimensionality — MUST match your embedder. Must be a positive integer. */
    dimensions: number;
    /** Default: 'cosine'. Match the similarity your embedder was trained for. */
    similarity?: 'cosine' | 'dotProduct' | 'euclidean';
    /**
     * Atlas index name for facts. Default: the adapter's own `vectorIndexName`
     * option, or `'facts_vector'` when that's also unset. Pass `null` to skip
     * the facts index entirely.
     */
    factsIndexName?: string | null;
    /**
     * Atlas index name for entities (identityEmbedding). Default: the
     * adapter's own `entityVectorIndexName` option, or `'entities_vector'`
     * when unset. Pass `null` to skip.
     */
    entitiesIndexName?: string | null;
    /**
     * Atlas index name for entity content (contentEmbedding) — used by
     * document semantic search. **Opt-in.** Default: the adapter's own
     * `entityContentVectorIndexName` option, or **`null` (skip)** when that's
     * also unset. Hosts that use documents should either set the adapter's
     * `entityContentVectorIndexName` (so the runtime path and this helper
     * agree on the name) or pass `entitiesContentIndexName` explicitly here.
     *
     * Default-skip is deliberate: adding a third Atlas index automatically
     * on `ensureVectorSearchIndexes()` would silently bill existing
     * deployments that aren't using documents.
     */
    entitiesContentIndexName?: string | null;
  }): Promise<void> {
    this.assertLive();
    if (!Number.isInteger(opts.dimensions) || opts.dimensions <= 0) {
      throw new Error(
        `ensureVectorSearchIndexes: dimensions must be a positive integer (got ${String(opts.dimensions)})`,
      );
    }
    const similarity = opts.similarity ?? 'cosine';

    // Name resolution: explicit arg > adapter config > literal default.
    // `null` explicitly skips; `undefined` falls through to adapter config.
    const factsName =
      opts.factsIndexName === undefined
        ? (this.vectorIndexName ?? 'facts_vector')
        : opts.factsIndexName;
    const entitiesName =
      opts.entitiesIndexName === undefined
        ? (this.entityVectorIndexName ?? 'entities_vector')
        : opts.entitiesIndexName;
    // Content index is opt-in: skip unless the caller passed a name OR the
    // adapter was constructed with `entityContentVectorIndexName`. See the
    // option's JSDoc for the rationale (avoid silent Atlas billing).
    const entitiesContentName =
      opts.entitiesContentIndexName === undefined
        ? (this.entityContentVectorIndexName ?? null)
        : opts.entitiesContentIndexName;

    if (factsName !== null) {
      await ensureOneVectorSearchIndex({
        collection: this.facts as unknown as IMongoCollectionLike<{ id: string }>,
        name: factsName,
        path: 'embedding',
        dimensions: opts.dimensions,
        similarity,
        filterPaths: FACTS_FILTER_PATHS,
      });
    }
    if (entitiesName !== null) {
      await ensureOneVectorSearchIndex({
        collection: this.entities as unknown as IMongoCollectionLike<{ id: string }>,
        name: entitiesName,
        path: 'identityEmbedding',
        dimensions: opts.dimensions,
        similarity,
        filterPaths: ENTITIES_FILTER_PATHS,
      });
    }
    if (entitiesContentName !== null) {
      await ensureOneVectorSearchIndex({
        collection: this.entities as unknown as IMongoCollectionLike<{ id: string }>,
        name: entitiesContentName,
        path: 'contentEmbedding',
        dimensions: opts.dimensions,
        similarity,
        filterPaths: ENTITIES_FILTER_PATHS,
      });
    }
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  destroy(): void {
    this.destroyed = true;
    // Collection lifecycle is the caller's concern — they own the client/
    // Mongo.Collection. We deliberately do not close anything.
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  async shutdown(): Promise<void> {
    this.destroy();
  }

  // ==========================================================================
  // Internal
  // ==========================================================================

  private assertLive(): void {
    if (this.destroyed) throw new Error('MongoMemoryAdapter: instance has been destroyed');
  }
}

// =============================================================================
// Duplicate-key detection
// =============================================================================

/**
 * Detect a Mongo dup-key (E11000) error. Tolerant of driver-version variance:
 * `err.code === 11000` is the stable, decade-old contract. Some wrappers
 * (Meteor's, certain Atlas Edge versions) attach the code on a nested object;
 * we walk a couple of common shapes.
 */
function isDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; errorResponse?: { code?: unknown }; result?: { code?: unknown } };
  if (e.code === 11000) return true;
  if (e.errorResponse?.code === 11000) return true;
  if (e.result?.code === 11000) return true;
  return false;
}

// =============================================================================
// Normalization — store `null` (not undefined) for scope fields so indexes hit
// consistently across records.
// =============================================================================

function normalizeEntityForStorage(entity: IEntity): IEntity {
  // Stamp normalized-name fields on every write — single source of truth lives
  // in computeNormalizedFields (src/memory/normalize.ts). Recomputing every
  // time is cheap and ensures `{...existing, displayName: 'new'}` spreads
  // can't carry stale normalized values into storage.
  const norm = computeNormalizedFields({
    displayName: entity.displayName,
    aliases: entity.aliases,
  });
  return {
    ...entity,
    groupId: entity.groupId ?? (null as unknown as undefined),
    ownerId: entity.ownerId ?? (null as unknown as undefined),
    // Kind-aware case normalization: only case-insensitive kinds (email, domain,
    // phone, url_host) are lowercased. Case-sensitive kinds (system_user_id,
    // canonical, slack_id, etc.) are preserved as-given. See
    // src/memory/identifiers.ts for the kind set + rationale.
    identifiers: entity.identifiers.map((i) => ({
      ...i,
      value: normalizeIdentifierValue(i.kind, i.value),
    })),
    // Belt-and-suspenders: re-coerce metadata at the storage boundary so
    // bypass paths (direct adapter use) can't smuggle ISO strings into BSON.
    metadata: coerceMetadataDates(entity.metadata),
    normalizedDisplayName: norm.normalizedDisplayName,
    normalizedAliases: norm.normalizedAliases,
  };
}

/** Same as normalizeEntityForStorage but for records without id (pre-insert). */
function normalizeNewEntityForStorage(
  input: NewEntity & { version: number; createdAt: Date; updatedAt: Date },
): Omit<IEntity, 'id'> {
  const norm = computeNormalizedFields({
    displayName: input.displayName,
    aliases: input.aliases,
  });
  return {
    ...input,
    groupId: input.groupId ?? (null as unknown as undefined),
    ownerId: input.ownerId ?? (null as unknown as undefined),
    identifiers: input.identifiers.map((i) => ({
      ...i,
      value: normalizeIdentifierValue(i.kind, i.value),
    })),
    metadata: coerceMetadataDates(input.metadata),
    normalizedDisplayName: norm.normalizedDisplayName,
    normalizedAliases: norm.normalizedAliases,
  };
}

function normalizeNewFactForStorage(
  input: NewFact & { createdAt: Date },
): Omit<IFact, 'id'> {
  // Belt-and-suspenders: enforce Date typing on temporal fields + nested
  // metadata at the storage boundary.
  const coerced = coerceFactTemporalFields(input);
  return {
    ...coerced,
    groupId: coerced.groupId ?? (null as unknown as undefined),
    ownerId: coerced.ownerId ?? (null as unknown as undefined),
  };
}

function normalizePartialFactForStorage(patch: Partial<IFact>): Partial<IFact> {
  // Coerce ISO-string temporal fields to `Date` so $set patches don't smuggle
  // strings into BSON. `IFact` types these as `Date | undefined`; a string
  // here means a caller violated the contract.
  return coerceFactTemporalFields(patch);
}

function reviveEntity(doc: IEntity): IEntity {
  return {
    ...doc,
    groupId: nullToUndefined(doc.groupId),
    ownerId: nullToUndefined(doc.ownerId),
    createdAt: toDate(doc.createdAt),
    updatedAt: toDate(doc.updatedAt),
  };
}

function reviveFact(doc: IFact): IFact {
  return {
    ...doc,
    groupId: nullToUndefined(doc.groupId),
    ownerId: nullToUndefined(doc.ownerId),
    createdAt: toDate(doc.createdAt),
    observedAt: doc.observedAt ? toDate(doc.observedAt) : undefined,
    validFrom: doc.validFrom ? toDate(doc.validFrom) : undefined,
    validUntil: doc.validUntil ? toDate(doc.validUntil) : undefined,
  };
}

function nullToUndefined<T>(v: T | null | undefined): T | undefined {
  return v === null ? undefined : (v as T | undefined);
}

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') return new Date(v);
  return new Date(0);
}

/**
 * Clauses pushed into native traversal filters so point-in-time queries
 * behave the same on Mongo as on the generic BFS path. Mirrors the asOf
 * handling in `queries.ts:factFilterToMongo` — kept inline here to avoid
 * pulling the full fact-filter machinery into the traversal path.
 */
function buildAsOfClauses(asOf: Date | undefined): MongoFilter[] {
  if (!(asOf instanceof Date)) return [];
  return [
    { createdAt: { $lte: asOf } },
    { $or: [{ validFrom: { $exists: false } }, { validFrom: { $lte: asOf } }] },
    { $or: [{ validUntil: { $exists: false } }, { validUntil: { $gte: asOf } }] },
  ];
}

// =============================================================================
// Helpers
// =============================================================================

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
 * Relevance score for searchEntities ranking. Higher = better match.
 * Mirrored from InMemoryAdapter so behavior is consistent across adapters.
 */
function entityRelevance(entity: IEntity, q: string): number {
  if (!q) return 0;
  const dn = entity.displayName.toLowerCase();
  if (dn === q) return 4;
  if (entity.aliases) {
    for (const a of entity.aliases) if (a.toLowerCase() === q) return 3;
  }
  if (dn.includes(q)) return 2;
  if (entity.aliases) {
    for (const a of entity.aliases) if (a.toLowerCase().includes(q)) return 1;
  }
  for (const ident of entity.identifiers) {
    if (ident.value.toLowerCase().includes(q)) return 1;
  }
  return 0;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Translate
 *   { state: 'pending', 'jarvis.importance': { $gte: 70 }, dueAt: { $lt: d } }
 * into
 *   { 'metadata.state': 'pending',
 *     'metadata.jarvis.importance': { $gte: 70 },
 *     'metadata.dueAt': { $lt: d } }.
 *
 * Hardened against operator injection:
 *  - Keys may use dot-notation for nested paths, but NO path segment may start
 *    with `$` — blocks `$where`, `a.$function`, etc.
 *  - Values must be one of: literal scalar / Date / array of those / one
 *    allowed operator object. Allowed operators: `$in`, `$lt`, `$lte`, `$gt`,
 *    `$gte`. Range ops may be combined (e.g. `{ $gte: 10, $lt: 20 }`).
 *  - Anything else (bare object, unknown operator keys, `$regex`, `$where`)
 *    throws.
 *
 * Callers who forward untrusted input into `metadataFilter` get defense in
 * depth: a user can't smuggle `{$where: "..."}` through even by accident.
 */
function metadataFilterToMongo(filter: Record<string, unknown>): MongoFilter {
  // Date coercion on `filter` happens once at the MemorySystem boundary
  // (`MemorySystem.listEntities`) — adapter receives Date-typed range/equality
  // values, validator below accepts strings/numbers/booleans/Date.
  const out: MongoFilter = {};
  for (const [key, expected] of Object.entries(filter)) {
    assertAllowedMetadataKey(key);
    const path = `metadata.${key}`;
    assertAllowedMetadataValue(key, expected);
    out[path] = expected;
  }
  return out;
}

function assertAllowedMetadataKey(key: string): void {
  assertAllowedFieldPath('metadataFilter', key);
}

/**
 * Shared path validator for any LLM-reachable field reference — metadataFilter
 * keys, `orderBy.field`, `select` projection paths. Rejects empty / trailing /
 * consecutive dots and any segment starting with `$`. Defense-in-depth:
 *  - `$natural` as a sort key is valid Mongo but forces a full collection scan
 *    (index-bypass DoS).
 *  - `$where`, `$function`, `$expr` segments aren't evaluated in sort/projection
 *    keys, but the library contract is "no `$`-prefixed segments anywhere a
 *    caller controls the path" — consistent with metadataFilter hardening.
 */
function assertAllowedFieldPath(context: string, path: string): void {
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error(`${context}: empty path`);
  }
  const segments = path.split('.');
  for (const seg of segments) {
    if (seg.length === 0) {
      throw new Error(
        `${context}: invalid path '${path}' — empty path segment (leading/trailing or consecutive dots)`,
      );
    }
    if (seg.startsWith('$')) {
      throw new Error(
        `${context}: invalid path '${path}' — path segments must not start with '$'`,
      );
    }
  }
}

/** Range operators permitted on metadata values. */
const RANGE_OPS = new Set(['$lt', '$lte', '$gt', '$gte']);

function assertAllowedMetadataValue(key: string, value: unknown): void {
  if (value === null || value === undefined) return;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return;
  if (value instanceof Date) return;
  if (Array.isArray(value)) {
    // Only arrays of primitives / Dates are allowed.
    for (const v of value) {
      const tv = typeof v;
      if (
        v !== null &&
        v !== undefined &&
        tv !== 'string' &&
        tv !== 'number' &&
        tv !== 'boolean' &&
        !(v instanceof Date)
      ) {
        throw new Error(
          `metadataFilter['${key}']: array must contain only primitives or Dates`,
        );
      }
    }
    return;
  }
  if (t === 'object') {
    const opKeys = Object.keys(value as Record<string, unknown>);
    if (opKeys.length === 0) {
      throw new Error(
        `metadataFilter['${key}']: empty operator object — use a literal or one of {$in, $lt, $lte, $gt, $gte}`,
      );
    }
    // $in must stand alone (array value). Range ops may combine.
    if (opKeys.includes('$in')) {
      if (opKeys.length !== 1) {
        throw new Error(
          `metadataFilter['${key}']: $in cannot be combined with other operators`,
        );
      }
      const inArr = (value as { $in: unknown }).$in;
      if (!Array.isArray(inArr)) {
        throw new Error(`metadataFilter['${key}']: $in must be an array`);
      }
      assertAllowedMetadataValue(key, inArr);
      return;
    }
    // Range-ops path: every key must be a range op; every RHS must be scalar/Date.
    for (const op of opKeys) {
      if (!RANGE_OPS.has(op)) {
        throw new Error(
          `metadataFilter['${key}']: unsupported operator '${op}' ` +
            `(allowed: $in, $lt, $lte, $gt, $gte)`,
        );
      }
      const rhs = (value as Record<string, unknown>)[op];
      const rt = typeof rhs;
      if (
        rhs === null ||
        rhs === undefined ||
        !(rt === 'string' || rt === 'number' || rt === 'boolean' || rhs instanceof Date)
      ) {
        throw new Error(
          `metadataFilter['${key}']: range operator '${op}' requires a scalar or Date value`,
        );
      }
    }
    return;
  }
  throw new Error(`metadataFilter['${key}']: unsupported value type '${t}'`);
}

/**
 * Translate `EntityOrderBy | EntityOrderBy[]` to a Mongo sort spec. Preserves
 * insertion order so multi-key sorts behave predictably. Paths are used
 * verbatim — callers pre-dotted (e.g. `'metadata.jarvis.importance'`).
 */
function entityOrderByToSort(
  orderBy: import('../../types.js').EntityOrderBy | import('../../types.js').EntityOrderBy[] | undefined,
): MongoSort | undefined {
  if (!orderBy) return undefined;
  const keys = Array.isArray(orderBy) ? orderBy : [orderBy];
  if (keys.length === 0) return undefined;
  const sort: MongoSort = {};
  for (const k of keys) {
    if (!k.field || k.field.length === 0) continue;
    assertAllowedFieldPath('orderBy.field', k.field);
    sort[k.field] = k.direction === 'asc' ? 1 : -1;
  }
  return Object.keys(sort).length > 0 ? sort : undefined;
}

/**
 * Fields the caller ALWAYS receives on a projected `listEntities` result.
 * These are the identity + scope + lifecycle columns — without them the
 * returned object isn't interpretable (reviveEntity needs createdAt/updatedAt;
 * scope filtering needs ownerId/groupId; identity needs id/type/displayName;
 * optimistic concurrency needs version).
 */
const REQUIRED_PROJECTION_FIELDS: readonly string[] = Object.freeze([
  'id',
  'type',
  'displayName',
  'version',
  'createdAt',
  'updatedAt',
  'ownerId',
  'groupId',
  'archived',
]);

/**
 * Translate a caller `select: string[]` into a Mongo projection doc. Always
 * merges `REQUIRED_PROJECTION_FIELDS` so the result remains a valid `IEntity`.
 */
function selectToProjection(
  select: string[] | undefined,
): Record<string, 0 | 1> | undefined {
  if (!select || select.length === 0) return undefined;
  const projection: Record<string, 0 | 1> = {};
  for (const f of REQUIRED_PROJECTION_FIELDS) projection[f] = 1;
  for (const f of select) {
    if (typeof f !== 'string' || f.length === 0) continue;
    assertAllowedFieldPath('select', f);
    projection[f] = 1;
  }
  return projection;
}

// =============================================================================
// Entity semantic search helpers
// =============================================================================

/**
 * Translate the narrow `EntitySemanticSearchFilter` into a Mongo filter clause.
 *
 * Every field that produces a clause MUST also be declared in
 * `ENTITIES_FILTER_PATHS` — otherwise Atlas Vector Search silently drops the
 * clause and the filter never narrows the result set. Keep these two in sync
 * when adding new fields.
 */
function entitySemanticFilterToMongo(filter: EntitySemanticSearchFilter): MongoFilter {
  const clauses: MongoFilter[] = [];
  if (filter.type !== undefined) clauses.push({ type: filter.type });
  else if (filter.types && filter.types.length > 0) clauses.push({ type: { $in: filter.types } });
  if (filter.contextId !== undefined) {
    // Mongo's implicit array-element-match: `{contextIds: x}` matches docs
    // where contextIds includes x. Atlas Vector Search honors this clause
    // only when 'contextIds' is declared as `type:'filter'` on the index
    // — see ENTITIES_FILTER_PATHS above.
    clauses.push({ contextIds: filter.contextId });
  }
  if (filter.states && filter.states.length > 0) {
    // task-state vocabulary narrow — `metadata.state ∈ {states}`.
    clauses.push({ 'metadata.state': { $in: filter.states } });
  }
  if (filter.assigneeId !== undefined) {
    clauses.push({ 'metadata.assigneeId': filter.assigneeId });
  }
  if (filter.reporterId !== undefined) {
    clauses.push({ 'metadata.reporterId': filter.reporterId });
  }
  if (filter.projectId !== undefined) {
    clauses.push({ 'metadata.projectId': filter.projectId });
  }
  if (filter.dueAtRange) {
    const range: Record<string, Date> = {};
    if (filter.dueAtRange.from instanceof Date) range.$gte = filter.dueAtRange.from;
    if (filter.dueAtRange.to instanceof Date) range.$lte = filter.dueAtRange.to;
    if (Object.keys(range).length > 0) {
      clauses.push({ 'metadata.dueAt': range });
    }
  }
  if (filter.touchesEntity !== undefined) {
    // Type-keyed OR-wildcard. Symmetric with FactFilter.touchesEntity but the
    // expansion is per-type because relational role fields are per-type.
    // Keep this switch in sync with the library's per-type role enumerations
    // (`RELATIONAL_TASK_FIELDS` in MemorySystem.ts and the parallel concepts
    // for events). Every path referenced here MUST be declared in
    // `ENTITIES_FILTER_PATHS` — otherwise Atlas silently drops the clause.
    //
    // The "is this task-scoped?" check accepts BOTH the singular `type: 'task'`
    // form and the single-element `types: ['task']` array form. Without the
    // array form, a caller using `semanticSearchEntities({types:['task'], touchesEntity})`
    // would silently collapse to `contextIds`-only — Atlas returns a strict
    // subset with no error, and the caller never sees that role-touching
    // matches were dropped. Footgun-prone enough to handle here.
    const id = filter.touchesEntity;
    const isTaskScoped =
      filter.type === 'task' ||
      (filter.types !== undefined &&
        filter.types.length === 1 &&
        filter.types[0] === 'task');
    const orPaths: MongoFilter[] = isTaskScoped
      ? [
          { 'metadata.assigneeId': id },
          { 'metadata.reporterId': id },
          { 'metadata.projectId': id },
          { contextIds: id },
        ]
      : [{ contextIds: id }];
    // Single-arm $or is unnecessary syntactic noise; emit the bare clause
    // when only one path applies (currently the non-task fallback).
    clauses.push(orPaths.length === 1 ? orPaths[0]! : { $or: orPaths });
  }
  if (filter.touchesAnyOf !== undefined && filter.touchesAnyOf.length > 0) {
    // Multi-anchor OR-wildcard — the set-valued analog of `touchesEntity`.
    // Same type-keyed role enumeration, but each path matches membership in
    // the anchor set via `$in`. One compound `$or` keeps every anchor-touching
    // candidate in a single ranked vector query (vs. N per-anchor top-K cuts
    // unioned client-side). Every path here is declared in
    // `ENTITIES_FILTER_PATHS`; nothing new is required for Atlas.
    const ids = filter.touchesAnyOf;
    const isTaskScoped =
      filter.type === 'task' ||
      (filter.types !== undefined &&
        filter.types.length === 1 &&
        filter.types[0] === 'task');
    const orPaths: MongoFilter[] = isTaskScoped
      ? [
          { 'metadata.assigneeId': { $in: ids } },
          { 'metadata.reporterId': { $in: ids } },
          { 'metadata.projectId': { $in: ids } },
          { contextIds: { $in: ids } },
        ]
      : [{ contextIds: { $in: ids } }];
    clauses.push(orPaths.length === 1 ? orPaths[0]! : { $or: orPaths });
  }
  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0]!;
  return { $and: clauses };
}

// =============================================================================
// Atlas Vector Search index management
// =============================================================================

/**
 * Filter paths declared as `type:'filter'` in the entities vector-search
 * index. Any path that `$vectorSearch.filter` might reference MUST be here,
 * otherwise Atlas silently ignores the filter clause — a scope bypass.
 *
 * Derived from `scopeToFilter` (scope + permission enforcement),
 * `ARCHIVED_HIDDEN`, and `entitySemanticFilterToMongo` (type narrow).
 */
const ENTITIES_FILTER_PATHS: readonly string[] = [
  'groupId',
  'ownerId',
  'permissions.group',
  'permissions.world',
  'archived',
  'type',
  // Used by document search (semanticSearchEntities with embeddingField:'content')
  // to narrow by role within the document type. Declared as a filter path so
  // Atlas Vector Search actually honours role-scoped queries instead of
  // silently ignoring them.
  'metadata.role',
  // Top-level entity-graph edge. Required for `findSimilarOpenTasks({contextId})`
  // and any future `semanticSearchEntities` call that narrows by the entity's
  // contextIds anchor. Same hard-earned rule as `contextIds` in FACTS_FILTER_PATHS
  // below: Atlas silently drops `$vectorSearch.filter` clauses for paths not
  // declared `type:'filter'`, which would let cross-context tasks leak into
  // scoped queries. Symmetric with the facts-side declaration.
  'contextIds',
  // Task-specific metadata filter paths — required for `findSimilarOpenTasks`
  // and any caller of `semanticSearchEntities` with task-state /
  // assignee / project / due-date narrows. Pushing the state filter into the
  // vector pipeline replaces the post-fetch JS filter loop (which becomes
  // belt-and-suspenders) — meaningful win at scale, since the overFetch
  // multiplier exists only because the post-filter can starve `topK`.
  'metadata.state',
  'metadata.assigneeId',
  'metadata.reporterId',
  'metadata.projectId',
  'metadata.dueAt',
];

/**
 * Filter paths declared as `type:'filter'` in the facts vector-search index.
 * Derived from `scopeToFilter`, `ARCHIVED_HIDDEN`, and the subset of
 * `factFilterToMongo` paths commonly passed to `$vectorSearch.filter`
 * (subject, object, contextIds, predicate, kind). Temporal filters
 * (`createdAt`, `validFrom`, `validUntil`) are post-filtered by MemorySystem
 * rather than pushed into the vector pipeline, so they're omitted here.
 *
 * `contextIds` is required for `FactFilter.touchesEntity` and
 * `FactFilter.contextId` to work on the `$vectorSearch` fast path.
 * `touchesEntity` expands to `$or: [subjectId, objectId, contextIds]` in
 * `factFilterToMongo`; without `contextIds` declared here, Atlas errors with
 * `"Path 'contextIds' needs to be indexed as filter"` (modern Atlas) or
 * silently drops the contextIds clause (older versions), causing a scope
 * bypass for any caller doing semantic search anchored on an entity.
 */
const FACTS_FILTER_PATHS: readonly string[] = [
  'groupId',
  'ownerId',
  'permissions.group',
  'permissions.world',
  'archived',
  'subjectId',
  'objectId',
  'contextIds',
  'predicate',
  'kind',
];

interface EnsureVectorIndexArgs {
  collection: IMongoCollectionLike<{ id: string }>;
  name: string;
  path: string;
  dimensions: number;
  similarity: 'cosine' | 'dotProduct' | 'euclidean';
  filterPaths: readonly string[];
}

/**
 * Ensure a single Atlas Vector Search index exists on a collection.
 * - List existing indexes; if our name is present, skip creation.
 * - Otherwise create with the given path/dimensions/similarity plus the
 *   filter paths declared in `filterPaths`.
 * - Concurrent-create races are absorbed: if `createSearchIndex` throws but
 *   the index shows up on re-check, another process won — continue.
 *
 * Fire-and-forget: returns as soon as Atlas accepts the create request. The
 * index builds asynchronously on Atlas (30–60s typical); runs during
 * startup migrations so it's ready well before real traffic arrives.
 *
 * Throws if the wrapper does not implement `createSearchIndex` /
 * `listSearchIndexes` (non-Atlas Mongo, older driver, custom wrapper).
 */
async function ensureOneVectorSearchIndex(args: EnsureVectorIndexArgs): Promise<void> {
  const { collection, name } = args;
  if (!collection.createSearchIndex || !collection.listSearchIndexes) {
    throw new Error(
      `ensureVectorSearchIndexes: collection wrapper does not implement createSearchIndex / listSearchIndexes. ` +
        `Atlas Vector Search requires mongodb node driver v6.6+ and Atlas Server v6.0.11+.`,
    );
  }
  const desiredFields: SearchIndexFieldArray = [
    {
      type: 'vector',
      path: args.path,
      numDimensions: args.dimensions,
      similarity: args.similarity,
    },
    ...args.filterPaths.map((path) => ({ type: 'filter' as const, path })),
  ];
  const definition: SearchIndexDefinition = {
    name,
    type: 'vectorSearch',
    definition: { fields: desiredFields },
  };

  const existing = await collection.listSearchIndexes(name);
  const current = existing.find((i) => i.name === name);
  if (current) {
    // Drift check: Atlas does not support in-place edits to vector-search
    // index definitions. If our desired definition differs from what's
    // currently stored (e.g. the library added a new filter path in a
    // subsequent version), we must drop + recreate. Compare field-set
    // structurally — vector field by (type, path, numDimensions,
    // similarity); filter fields by set of paths.
    if (!searchIndexDefinitionsMatch(current.latestDefinition, desiredFields)) {
      if (!collection.dropSearchIndex) {
        throw new Error(
          `ensureVectorSearchIndexes: existing index "${name}" has stale definition ` +
            `but collection wrapper does not implement dropSearchIndex — cannot reconcile. ` +
            `Drop the index manually and restart, or upgrade the wrapper.`,
        );
      }
      console.warn(
        `[oneringai] ensureVectorSearchIndexes: search index "${name}" has a stale ` +
          `definition — dropping and recreating with current spec. Queries will fall ` +
          `back to cursor-scan cosine until Atlas finishes rebuilding (~30s typical).`,
      );
      // Concurrent-drop race: two processes detecting drift simultaneously
      // will both call dropSearchIndex; the second one races Atlas's
      // accept/ack window and may throw "index not found." Re-list to
      // confirm the index is gone (or already in DELETING) before treating
      // the drop as fatal.
      try {
        await collection.dropSearchIndex(name);
      } catch (dropErr) {
        const afterDrop = await collection.listSearchIndexes(name);
        const stillThere = afterDrop.find(
          (i) => i.name === name && i.status !== 'DELETING',
        );
        if (stillThere) throw dropErr;
      }
      // After drop, Atlas removes the index asynchronously. listSearchIndexes
      // may still return it for some seconds with `status: 'DELETING'`. The
      // catch block on createSearchIndex below distinguishes "old still
      // draining" from "peer created the new definition" by comparing the
      // retry's latestDefinition against ours.
    } else {
      return;
    }
  }

  try {
    await collection.createSearchIndex(definition);
  } catch (err) {
    // Two distinct races can land us here:
    //   (a) Concurrent-create — another process created the index with the
    //       same desired definition in the gap between our listSearchIndexes
    //       and createSearchIndex calls. Absorb.
    //   (b) Post-drop draining — we just dropped a stale index, Atlas hasn't
    //       finished draining, and createSearchIndex rejected the new spec
    //       because the old one is still present. Surface it so the next
    //       startup retries; otherwise we'd silently linger with the OLD
    //       definition for this process's lifetime.
    // Distinguish by checking whether the retry sees the DESIRED definition,
    // not just "an index with that name."
    const retry = await collection.listSearchIndexes(name);
    const found = retry.find((i) => i.name === name);
    if (!found || !searchIndexDefinitionsMatch(found.latestDefinition, desiredFields)) {
      throw err;
    }
  }
}

/** Field-array shape used inside SearchIndexDefinition.definition.fields. */
type SearchIndexFieldArray = NonNullable<SearchIndexDefinition['definition']['fields']>;

/**
 * Compare a stored Atlas index definition (echoed from `listSearchIndexes`)
 * against the desired field array. Returns true when they describe the same
 * vector + filter shape, false on any structural drift.
 *
 * Stored shape from Atlas (`SearchIndexInfo.latestDefinition`) is a loose
 * `Record<string, unknown>` — we navigate defensively. Any unexpected shape
 * is treated as "doesn't match" (safe: triggers drop + recreate, which
 * Atlas re-validates).
 */
function searchIndexDefinitionsMatch(
  stored: Record<string, unknown> | undefined,
  desired: SearchIndexFieldArray,
): boolean {
  if (!stored) return false;
  const fields = stored.fields;
  if (!Array.isArray(fields)) return false;

  // Vector field: there must be exactly one with type 'vector' and matching
  // path/dims/similarity.
  const desiredVector = desired.find((f) => f.type === 'vector');
  const storedVector = fields.find(
    (f): f is { type: 'vector'; path: string; numDimensions: number; similarity: string } =>
      typeof f === 'object' && f !== null && (f as { type?: unknown }).type === 'vector',
  );
  if (!desiredVector || desiredVector.type !== 'vector') return false;
  if (!storedVector) return false;
  if (
    storedVector.path !== desiredVector.path ||
    storedVector.numDimensions !== desiredVector.numDimensions ||
    storedVector.similarity !== desiredVector.similarity
  ) {
    return false;
  }

  // Filter fields: set of paths must match exactly. Order-insensitive — Atlas
  // doesn't guarantee echo order.
  const desiredFilterPaths = new Set(
    desired.filter((f) => f.type === 'filter').map((f) => (f as { path: string }).path),
  );
  const storedFilterPaths = new Set(
    fields
      .filter(
        (f): f is { type: 'filter'; path: string } =>
          typeof f === 'object' && f !== null && (f as { type?: unknown }).type === 'filter',
      )
      .map((f) => f.path),
  );
  if (desiredFilterPaths.size !== storedFilterPaths.size) return false;
  for (const p of desiredFilterPaths) {
    if (!storedFilterPaths.has(p)) return false;
  }
  return true;
}
