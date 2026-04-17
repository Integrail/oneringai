/**
 * MeteorMongoCollection — wraps a Meteor Mongo.Collection.
 *
 * Material writes flow through Meteor's async collection API (insertAsync,
 * updateAsync, removeAsync), which triggers reactive publications on the wire.
 * Complex reads ($graphLookup, $vectorSearch) drop to the raw mongodb driver
 * via `rawCollection()`, bypassing reactivity (which is fine — reads don't
 * mutate anyway).
 *
 * No runtime import of 'meteor/mongo'. Callers pass any object matching the
 * structural shape below; Meteor's real Collection object satisfies it.
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
 * Structural shape of a Meteor Mongo.Collection. The real Meteor class adds
 * many more methods, but this is what the adapter uses.
 */
export interface MeteorCollectionLike<T> {
  insertAsync(doc: T): Promise<string>;
  updateAsync(
    selector: MongoFilter,
    modifier: MongoUpdate,
    opts?: { multi?: boolean; upsert?: boolean },
  ): Promise<number>;
  removeAsync(selector: MongoFilter): Promise<number>;
  findOneAsync(selector: MongoFilter, opts?: MongoFindOptions): Promise<T | null>;
  find(
    selector: MongoFilter,
    opts?: MongoFindOptions,
  ): { fetchAsync(): Promise<T[]>; countAsync(): Promise<number> };
  rawCollection(): {
    aggregate(pipeline: unknown[]): { toArray(): Promise<unknown[]> };
    createIndex(spec: Record<string, 1 | -1>, opts?: unknown): Promise<string>;
  };
}

export class MeteorMongoCollection<T extends { id: string }> implements IMongoCollectionLike<T> {
  constructor(private col: MeteorCollectionLike<T>) {}

  // ----- Writes: Meteor API (reactive-safe) -----

  async insertOne(doc: T): Promise<void> {
    await this.col.insertAsync(doc);
  }

  async insertMany(docs: T[]): Promise<void> {
    for (const d of docs) await this.col.insertAsync(d);
  }

  async updateOne(
    filter: MongoFilter,
    update: MongoUpdate,
    opts?: MongoUpdateOptions,
  ): Promise<MongoUpdateResult> {
    const n = await this.col.updateAsync(filter, update, { upsert: opts?.upsert });
    // Meteor's updateAsync returns modified count; we can't distinguish upsert
    // vs update from its return. For our adapter's needs, matched=modified.
    return { matchedCount: n, modifiedCount: n, upsertedCount: 0 };
  }

  async deleteOne(filter: MongoFilter): Promise<void> {
    await this.col.removeAsync(filter);
  }

  async deleteMany(filter: MongoFilter): Promise<void> {
    await this.col.removeAsync(filter);
  }

  async bulkWrite(ops: Array<MongoBulkOp<T>>): Promise<void> {
    // Meteor doesn't expose bulkWrite through the reactive API — fallback is
    // sequential writes. Users who need true bulkWrite can drop to rawCollection().
    for (const op of ops) {
      if ('insertOne' in op) await this.col.insertAsync(op.insertOne.document);
      else if ('updateOne' in op) {
        await this.col.updateAsync(op.updateOne.filter, op.updateOne.update, {
          upsert: op.updateOne.upsert,
        });
      } else if ('deleteOne' in op) {
        await this.col.removeAsync(op.deleteOne.filter);
      }
    }
  }

  // ----- Reads -----

  findOne(filter: MongoFilter, opts?: MongoFindOptions): Promise<T | null> {
    return this.col.findOneAsync(filter, opts);
  }

  async find(filter: MongoFilter, opts?: MongoFindOptions): Promise<T[]> {
    return this.col.find(filter, opts).fetchAsync();
  }

  async countDocuments(filter: MongoFilter): Promise<number> {
    return this.col.find(filter).countAsync();
  }

  async aggregate(pipeline: unknown[]): Promise<unknown[]> {
    return this.col.rawCollection().aggregate(pipeline).toArray();
  }

  async createIndex(
    spec: Record<string, 1 | -1>,
    opts?: { unique?: boolean; name?: string },
  ): Promise<void> {
    await this.col.rawCollection().createIndex(spec, opts);
  }

  // No withTransaction — Meteor + transactions is fragile; callers that need
  // it can use RawMongoCollection against the same collection alongside.
}
