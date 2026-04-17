/**
 * RawMongoCollection — wraps a native mongodb-driver Collection.
 *
 * No runtime dependency on the `mongodb` package: we use structural typing so
 * callers can pass any object that matches the narrow interface. This keeps
 * `mongodb` an optional peer dependency and prevents build/compile coupling.
 */

import type {
  IMongoCollectionLike,
  MongoBulkOp,
  MongoFilter,
  MongoFindOptions,
  MongoUpdate,
  MongoUpdateOptions,
  MongoUpdateResult,
} from './IMongoCollectionLike.js';

/**
 * Structural shape of the subset of mongodb-driver's Collection we use.
 * Intentionally minimal — matches mongodb@5+ and mongodb@6+ Collection surface.
 */
export interface RawMongoDriverCollection<T> {
  insertOne(doc: T): Promise<unknown>;
  insertMany(docs: T[]): Promise<unknown>;
  updateOne(
    filter: MongoFilter,
    update: MongoUpdate,
    opts?: { upsert?: boolean },
  ): Promise<MongoUpdateResult>;
  deleteOne(filter: MongoFilter): Promise<unknown>;
  deleteMany(filter: MongoFilter): Promise<unknown>;
  findOne(filter: MongoFilter, opts?: MongoFindOptions): Promise<T | null>;
  find(filter: MongoFilter, opts?: MongoFindOptions): {
    toArray(): Promise<T[]>;
  };
  countDocuments(filter: MongoFilter): Promise<number>;
  aggregate(pipeline: unknown[]): { toArray(): Promise<unknown[]> };
  createIndex(spec: Record<string, 1 | -1>, opts?: unknown): Promise<string>;
  bulkWrite(ops: unknown[]): Promise<unknown>;
}

/** Optional client surface for sessions/transactions. */
export interface RawMongoClientLike {
  startSession(): {
    withTransaction<R>(fn: () => Promise<R>): Promise<R>;
    endSession(): Promise<void> | void;
  };
}

export class RawMongoCollection<T extends { id: string }> implements IMongoCollectionLike<T> {
  constructor(
    private col: RawMongoDriverCollection<T>,
    private client?: RawMongoClientLike,
  ) {}

  async insertOne(doc: T): Promise<void> {
    await this.col.insertOne(doc);
  }

  async insertMany(docs: T[]): Promise<void> {
    if (docs.length === 0) return;
    await this.col.insertMany(docs);
  }

  async updateOne(
    filter: MongoFilter,
    update: MongoUpdate,
    opts?: MongoUpdateOptions,
  ): Promise<MongoUpdateResult> {
    const res = await this.col.updateOne(filter, update, opts);
    return {
      matchedCount: res.matchedCount ?? 0,
      modifiedCount: res.modifiedCount ?? 0,
      upsertedCount: res.upsertedCount ?? 0,
    };
  }

  async deleteOne(filter: MongoFilter): Promise<void> {
    await this.col.deleteOne(filter);
  }

  async deleteMany(filter: MongoFilter): Promise<void> {
    await this.col.deleteMany(filter);
  }

  async bulkWrite(ops: Array<MongoBulkOp<T>>): Promise<void> {
    if (ops.length === 0) return;
    await this.col.bulkWrite(ops as unknown[]);
  }

  findOne(filter: MongoFilter, opts?: MongoFindOptions): Promise<T | null> {
    return this.col.findOne(filter, opts);
  }

  async find(filter: MongoFilter, opts?: MongoFindOptions): Promise<T[]> {
    return this.col.find(filter, opts).toArray();
  }

  countDocuments(filter: MongoFilter): Promise<number> {
    return this.col.countDocuments(filter);
  }

  async aggregate(pipeline: unknown[]): Promise<unknown[]> {
    return this.col.aggregate(pipeline).toArray();
  }

  async createIndex(
    spec: Record<string, 1 | -1>,
    opts?: { unique?: boolean; name?: string },
  ): Promise<void> {
    await this.col.createIndex(spec, opts);
  }

  async withTransaction<R>(fn: () => Promise<R>): Promise<R> {
    if (!this.client) return fn();
    const session = this.client.startSession();
    try {
      return await session.withTransaction(fn);
    } finally {
      await session.endSession();
    }
  }
}
