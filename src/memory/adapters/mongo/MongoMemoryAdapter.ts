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
  EntityId,
  EntityListFilter,
  EntitySearchOptions,
  FactFilter,
  FactId,
  FactQueryOptions,
  IEntity,
  IFact,
  IMemoryStore,
  ListOptions,
  Neighborhood,
  Page,
  ScopeFilter,
  SemanticSearchOptions,
  TraversalOptions,
} from '../../types.js';
import { genericTraverse } from '../../GenericTraversal.js';
import type { IMongoCollectionLike, MongoBulkOp, MongoFilter, MongoSort } from './IMongoCollectionLike.js';
import { mergeFilters, scopeToFilter } from './scopeFilter.js';
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
   * Number of vector candidates to ask Atlas Vector Search to consider before
   * returning topK. Only used when `vectorIndexName` is set. Default: topK * 10.
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
  private readonly useNativeGraphLookup: boolean;
  private readonly vectorIndexName?: string;
  private readonly vectorCandidateMultiplier: number;
  private readonly factsCollectionName?: string;
  private readonly defaultPageSize: number;
  private destroyed = false;

  constructor(opts: MongoMemoryAdapterOptions) {
    this.entities = opts.entities;
    this.facts = opts.facts;
    this.useNativeGraphLookup =
      !!opts.useNativeGraphLookup && !!opts.facts.aggregate && !!opts.factsCollectionName;
    this.vectorIndexName = opts.vectorIndexName;
    this.vectorCandidateMultiplier = opts.vectorCandidateMultiplier ?? 10;
    this.factsCollectionName = opts.factsCollectionName;
    this.defaultPageSize = opts.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  }

  // ==========================================================================
  // Entities
  // ==========================================================================

  async putEntity(entity: IEntity): Promise<void> {
    this.assertLive();
    const normalized = normalizeEntityForStorage(entity);

    if (entity.version === 1) {
      // New entity — upsert keyed on id, but only succeed if no existing row.
      // Using updateOne with a $setOnInsert is not quite right; insertOne is
      // cleaner. Duplicate key error becomes OptimisticConcurrencyError.
      try {
        await this.entities.insertOne(normalized);
        return;
      } catch (err) {
        // Existing entity — version=1 means caller thought it was new.
        if (isDuplicateKey(err)) {
          throw new MongoOptimisticConcurrencyError(
            `Entity ${entity.id}: version 1 specified but entity already exists`,
          );
        }
        throw err;
      }
    }

    // Update: match on id + version=N-1, $set the new document with version=N.
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

  async putEntities(entities: IEntity[]): Promise<void> {
    this.assertLive();
    if (entities.length === 0) return;
    // Optimistic concurrency is per-entity; bulkWrite of replaceOnes won't
    // express it cleanly. Keep correctness over throughput here — sequential.
    for (const e of entities) await this.putEntity(e);
  }

  async getEntity(id: EntityId, scope: ScopeFilter): Promise<IEntity | null> {
    this.assertLive();
    const filter = mergeFilters(scopeToFilter(scope), ARCHIVED_HIDDEN, { id });
    const doc = await this.entities.findOne(filter);
    return doc ? reviveEntity(doc) : null;
  }

  async findEntitiesByIdentifier(
    kind: string,
    value: string,
    scope: ScopeFilter,
  ): Promise<IEntity[]> {
    this.assertLive();
    const filter = mergeFilters(scopeToFilter(scope), ARCHIVED_HIDDEN, {
      identifiers: {
        $elemMatch: { kind, value: value.toLowerCase() },
      },
    });
    const docs = await this.entities.find(filter, { limit: 50 });
    return docs.map(reviveEntity);
  }

  async searchEntities(
    query: string,
    opts: EntitySearchOptions,
    scope: ScopeFilter,
  ): Promise<Page<IEntity>> {
    this.assertLive();
    const q = query.trim();
    const clauses: MongoFilter[] = [scopeToFilter(scope), ARCHIVED_HIDDEN];

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
    const docs = await this.entities.find(filter, { limit, skip });
    return {
      items: docs.map(reviveEntity),
      nextCursor: formatCursor(skip, limit, docs.length),
    };
  }

  async listEntities(
    filter: EntityListFilter,
    opts: ListOptions,
    scope: ScopeFilter,
  ): Promise<Page<IEntity>> {
    this.assertLive();
    const clauses: MongoFilter[] = [scopeToFilter(scope)];
    if (filter.archived === true) clauses.push({ archived: true });
    else if (filter.archived === false) clauses.push(ARCHIVED_HIDDEN);
    else clauses.push(ARCHIVED_HIDDEN);
    if (filter.type) clauses.push({ type: filter.type });
    if (filter.ids && filter.ids.length > 0) clauses.push({ id: { $in: filter.ids } });
    const mongoFilter = mergeFilters(...clauses);

    const skip = parseCursor(opts.cursor);
    const limit = opts.limit ?? this.defaultPageSize;
    const docs = await this.entities.find(mongoFilter, { limit, skip });
    return {
      items: docs.map(reviveEntity),
      nextCursor: formatCursor(skip, limit, docs.length),
    };
  }

  async archiveEntity(id: EntityId, scope: ScopeFilter): Promise<void> {
    this.assertLive();
    const filter = mergeFilters(scopeToFilter(scope), { id });
    await this.entities.updateOne(filter, {
      $set: { archived: true, updatedAt: new Date() },
      $inc: { version: 1 },
    });
  }

  async deleteEntity(id: EntityId, scope: ScopeFilter): Promise<void> {
    this.assertLive();
    const filter = mergeFilters(scopeToFilter(scope), { id });
    await this.entities.deleteOne(filter);
  }

  // ==========================================================================
  // Facts
  // ==========================================================================

  async putFact(fact: IFact): Promise<void> {
    this.assertLive();
    const normalized = normalizeFactForStorage(fact);
    // Idempotent upsert by id — the supersession flow expects repeated writes
    // to the same fact id to overwrite cleanly.
    await this.facts.updateOne({ id: fact.id }, { $set: normalized }, { upsert: true });
  }

  async putFacts(facts: IFact[]): Promise<void> {
    this.assertLive();
    if (facts.length === 0) return;
    if (this.facts.bulkWrite) {
      const ops: Array<MongoBulkOp<IFact>> = facts.map((f) => ({
        updateOne: {
          filter: { id: f.id },
          update: { $set: normalizeFactForStorage(f) } as Record<string, unknown>,
          upsert: true,
        },
      }));
      await this.facts.bulkWrite(ops);
      return;
    }
    for (const f of facts) await this.putFact(f);
  }

  async getFact(id: FactId, scope: ScopeFilter): Promise<IFact | null> {
    this.assertLive();
    const filter = mergeFilters(scopeToFilter(scope), { id });
    const doc = await this.facts.findOne(filter);
    return doc ? reviveFact(doc) : null;
  }

  async findFacts(
    filter: FactFilter,
    opts: FactQueryOptions,
    scope: ScopeFilter,
  ): Promise<Page<IFact>> {
    this.assertLive();
    const mongoFilter = factFilterToMongo(filter, scope);
    const sort: MongoSort | undefined = orderByToSort(opts.orderBy);
    const skip = parseCursor(opts.cursor);
    const limit = opts.limit ?? this.defaultPageSize;
    const docs = await this.facts.find(mongoFilter, { limit, skip, sort });
    return {
      items: docs.map(reviveFact),
      nextCursor: formatCursor(skip, limit, docs.length),
    };
  }

  async updateFact(id: FactId, patch: Partial<IFact>, scope: ScopeFilter): Promise<void> {
    this.assertLive();
    const filter = mergeFilters(scopeToFilter(scope), { id });
    const { id: _ignoreId, ...rest } = patch;
    void _ignoreId;
    await this.facts.updateOne(filter, { $set: normalizePartialFactForStorage(rest) });
  }

  async countFacts(filter: FactFilter, scope: ScopeFilter): Promise<number> {
    this.assertLive();
    return this.facts.countDocuments(factFilterToMongo(filter, scope));
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

    const restrict: MongoFilter = mergeFilters(
      scopeToFilter(scope),
      ARCHIVED_HIDDEN,
      opts.predicates && opts.predicates.length > 0
        ? { predicate: { $in: opts.predicates } }
        : {},
    );

    type EdgeAccum = { from: EntityId; to: EntityId; fact: IFact; depth: number };
    const edgesOut: EdgeAccum[] = [];
    const edgesIn: EdgeAccum[] = [];

    // Outbound — match subjectId=start, then recurse object->subject chains.
    if (opts.direction === 'out' || opts.direction === 'both') {
      const pipeline = [
        { $match: mergeFilters(scopeToFilter(scope), ARCHIVED_HIDDEN, { subjectId: startId }) },
        {
          $graphLookup: {
            from: this.factsCollectionName!,
            startWith: '$objectId',
            connectFromField: 'objectId',
            connectToField: 'subjectId',
            as: 'descendants',
            maxDepth: Math.max(0, opts.maxDepth - 1),
            depthField: 'depth',
            restrictSearchWithMatch: restrict,
          },
        },
      ];
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
    if (opts.direction === 'in' || opts.direction === 'both') {
      const pipeline = [
        { $match: mergeFilters(scopeToFilter(scope), ARCHIVED_HIDDEN, { objectId: startId }) },
        {
          $graphLookup: {
            from: this.factsCollectionName!,
            startWith: '$subjectId',
            connectFromField: 'subjectId',
            connectToField: 'objectId',
            as: 'ancestors',
            maxDepth: Math.max(0, opts.maxDepth - 1),
            depthField: 'depth',
            restrictSearchWithMatch: restrict,
          },
        },
      ];
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

    // Resolve entities for every node we touched.
    const allEdges = [...edgesOut, ...edgesIn];
    const visited = new Map<EntityId, number>();
    visited.set(startId, 0);
    for (const e of allEdges) {
      const prev1 = visited.get(e.from);
      if (prev1 === undefined || prev1 > e.depth) visited.set(e.from, e.depth);
      const prev2 = visited.get(e.to);
      if (prev2 === undefined || prev2 > e.depth) visited.set(e.to, e.depth);
    }

    const nodes: Neighborhood['nodes'] = [];
    const limit = opts.limit ?? Infinity;
    // Resolve in batches; respect limit.
    for (const [id, depth] of visited) {
      if (nodes.length >= limit) break;
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
          filter: factFilterToMongo(filter, scope),
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
    const mongoFilter = mergeFilters(factFilterToMongo(filter, scope), {
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
// Normalization — store `null` (not undefined) for scope fields so indexes hit
// consistently across records.
// =============================================================================

function normalizeEntityForStorage(entity: IEntity): IEntity {
  return {
    ...entity,
    groupId: entity.groupId ?? (null as unknown as undefined),
    ownerId: entity.ownerId ?? (null as unknown as undefined),
    identifiers: entity.identifiers.map((i) => ({
      ...i,
      value: i.value.toLowerCase(),
    })),
  };
}

function normalizeFactForStorage(fact: IFact): IFact {
  return {
    ...fact,
    groupId: fact.groupId ?? (null as unknown as undefined),
    ownerId: fact.ownerId ?? (null as unknown as undefined),
  };
}

function normalizePartialFactForStorage(patch: Partial<IFact>): Partial<IFact> {
  return patch;
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isDuplicateKey(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: number; codeName?: string; message?: string };
  return e.code === 11000 || e.codeName === 'DuplicateKey' || /duplicate key/i.test(e.message ?? '');
}
