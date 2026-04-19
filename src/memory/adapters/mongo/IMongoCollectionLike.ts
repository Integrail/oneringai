/**
 * Narrow collection contract the MongoMemoryAdapter depends on.
 *
 * Two implementations ship in-tree: RawMongoCollection (wraps a mongodb-driver
 * Collection) and MeteorMongoCollection (wraps a Meteor Mongo.Collection).
 * Users with different plumbing can implement this interface themselves.
 *
 * Writes are expected to trigger whatever reactivity mechanism the underlying
 * collection provides (Meteor publications, change streams) — the adapter
 * deliberately routes material updates through these methods so memory writes
 * propagate to subscribers.
 *
 * Reads are expected to run on the raw driver when complex pipelines are
 * needed (`aggregate`), which is why `aggregate` is optional — implementations
 * that can't support it gracefully disable the fast paths that depend on it.
 */

export type MongoFilter = Record<string, unknown>;
export type MongoUpdate = Record<string, unknown>;
export type MongoSort = Record<string, 1 | -1>;

export interface MongoFindOptions {
  sort?: MongoSort;
  limit?: number;
  skip?: number;
  projection?: Record<string, 0 | 1>;
}

export interface MongoUpdateOptions {
  upsert?: boolean;
}

export interface MongoUpdateResult {
  matchedCount: number;
  modifiedCount: number;
  upsertedCount: number;
}

export interface IMongoCollectionLike<T extends { id: string }> {
  // ===== Writes (route through Meteor / reactivity layer when wrapped) =====
  /**
   * Insert a document. Any `id` field on the input is IGNORED — the collection
   * assigns the primary key (Mongo: ObjectId → hex string; Meteor: Random.id()).
   * Returns the assigned id as a string.
   */
  insertOne(doc: T): Promise<string>;
  /** Batch insert. Returned ids are in the same order as input. */
  insertMany(docs: T[]): Promise<string[]>;
  /**
   * Update. `filter` may contain `id: <string>` — wrappers translate to the
   * native primary-key form (Mongo: `_id: ObjectId(...)`; Meteor: `_id: <string>`).
   * Any `id` field in the update payload is stripped (ids are immutable).
   */
  updateOne(
    filter: MongoFilter,
    update: MongoUpdate,
    opts?: MongoUpdateOptions,
  ): Promise<MongoUpdateResult>;
  deleteOne(filter: MongoFilter): Promise<void>;
  deleteMany(filter: MongoFilter): Promise<void>;

  // ===== Reads =====
  /**
   * Returned documents always have `id` populated (mapped from the native
   * primary key — `_id.toHexString()` for Mongo ObjectId, or the string form
   * for Meteor). `_id` is not present on returned documents.
   */
  findOne(filter: MongoFilter, opts?: MongoFindOptions): Promise<T | null>;
  find(filter: MongoFilter, opts?: MongoFindOptions): Promise<T[]>;
  countDocuments(filter: MongoFilter): Promise<number>;

  /**
   * Aggregation pipeline. Optional — adapters gate `$graphLookup` and
   * `$vectorSearch` fast paths on its presence.
   */
  aggregate?(pipeline: unknown[]): Promise<unknown[]>;

  /**
   * Index management hook. Optional — the adapter's `ensureIndexes()` helper
   * calls this when available; otherwise users must create indexes themselves.
   */
  createIndex?(spec: Record<string, 1 | -1>, opts?: { unique?: boolean; name?: string }): Promise<void>;

  /**
   * Transaction hook — present on raw-driver wrappers when a client is
   * available, absent on Meteor wrappers. When present, MongoMemoryAdapter
   * wraps supersession in a transaction; when absent, it relies on the
   * crash-safe ordering that MemorySystem already enforces.
   */
  withTransaction?<R>(fn: () => Promise<R>): Promise<R>;
}
