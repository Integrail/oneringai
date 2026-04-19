/**
 * RawMongoCollection — unit tests for the id ↔ _id translation behavior.
 * Uses a fake driver-level Collection to avoid needing real Mongo.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RawMongoCollection } from '@/memory/adapters/mongo/RawMongoCollection.js';
import type {
  ObjectIdLike,
  RawMongoDriverCollection,
} from '@/memory/adapters/mongo/RawMongoCollection.js';
import type { MongoFilter, MongoUpdate } from '@/memory/adapters/mongo/IMongoCollectionLike.js';

/**
 * Minimal fake ObjectId — stores a hex string, implements toHexString().
 */
class FakeObjectId implements ObjectIdLike {
  constructor(public hex: string) {}
  toHexString(): string {
    return this.hex;
  }
}

const makeObjectId = (hex: string) => new FakeObjectId(hex);

/**
 * Fake driver-level Collection that captures filter + update arguments so we
 * can assert on translation behavior.
 */
class FakeDriverCollection<T extends { id?: string; _id?: ObjectIdLike }> {
  docs: T[] = [];
  lastFilter?: MongoFilter;
  lastUpdate?: MongoUpdate;
  private seq = 0;

  async insertOne(doc: T): Promise<{ insertedId: ObjectIdLike }> {
    const _id = makeObjectId(`oid_${++this.seq}`);
    this.docs.push({ ...doc, _id } as T);
    return { insertedId: _id };
  }

  async insertMany(docs: T[]): Promise<{ insertedIds: Record<number, ObjectIdLike> }> {
    const ids: Record<number, ObjectIdLike> = {};
    docs.forEach((d, i) => {
      const _id = makeObjectId(`oid_${++this.seq}`);
      ids[i] = _id;
      this.docs.push({ ...d, _id } as T);
    });
    return { insertedIds: ids };
  }

  async updateOne(
    filter: MongoFilter,
    update: MongoUpdate,
  ): Promise<{ matchedCount: number; modifiedCount: number; upsertedCount: number }> {
    this.lastFilter = filter;
    this.lastUpdate = update;
    return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
  }

  async deleteOne(filter: MongoFilter): Promise<unknown> {
    this.lastFilter = filter;
    return {};
  }

  async deleteMany(filter: MongoFilter): Promise<unknown> {
    this.lastFilter = filter;
    return {};
  }

  async findOne(filter: MongoFilter): Promise<T | null> {
    this.lastFilter = filter;
    return this.docs[0] ?? null;
  }

  find(filter: MongoFilter): { toArray(): Promise<T[]> } {
    this.lastFilter = filter;
    return { toArray: async () => [...this.docs] };
  }

  async countDocuments(filter: MongoFilter): Promise<number> {
    this.lastFilter = filter;
    return this.docs.length;
  }

  aggregate(pipeline: unknown[]): { toArray(): Promise<unknown[]> } {
    this.lastFilter = (pipeline[0] as { $match?: MongoFilter })?.$match;
    return { toArray: async () => this.docs };
  }

  async createIndex(): Promise<string> {
    return 'ok';
  }
}

interface TestDoc {
  id: string;
  name: string;
  _id?: ObjectIdLike;
}

describe('RawMongoCollection — id ↔ _id translation', () => {
  let driver: FakeDriverCollection<TestDoc>;
  let wrapper: RawMongoCollection<TestDoc>;

  beforeEach(() => {
    driver = new FakeDriverCollection<TestDoc>();
    wrapper = new RawMongoCollection<TestDoc>(
      driver as unknown as RawMongoDriverCollection<TestDoc>,
      makeObjectId,
    );
  });

  describe('insertOne', () => {
    it('strips incoming id from the doc before inserting', async () => {
      await wrapper.insertOne({ id: 'should-be-ignored', name: 'A' } as TestDoc);
      // The doc stored by the driver does not have `id` on it.
      expect(driver.docs[0]).not.toHaveProperty('id');
      expect(driver.docs[0]!.name).toBe('A');
    });

    it('returns the assigned hex-string id', async () => {
      const id = await wrapper.insertOne({ id: '', name: 'A' } as TestDoc);
      expect(id).toBe('oid_1');
    });
  });

  describe('insertMany', () => {
    it('returns ids in input order', async () => {
      const ids = await wrapper.insertMany([
        { id: '', name: 'A' } as TestDoc,
        { id: '', name: 'B' } as TestDoc,
      ]);
      expect(ids).toEqual(['oid_1', 'oid_2']);
    });
  });

  describe('filter translation', () => {
    it('translates top-level id to _id with ObjectId', async () => {
      await wrapper.findOne({ id: 'abc' });
      const f = driver.lastFilter as { _id?: ObjectIdLike };
      expect(f._id).toBeDefined();
      expect((f._id as ObjectIdLike).toHexString()).toBe('abc');
    });

    it('translates id inside $and clauses', async () => {
      await wrapper.findOne({ $and: [{ id: 'x' }, { name: 'Foo' }] });
      const f = driver.lastFilter as { $and: Array<{ _id?: ObjectIdLike; name?: string }> };
      expect(f.$and[0]!._id).toBeDefined();
      expect((f.$and[0]!._id as ObjectIdLike).toHexString()).toBe('x');
      expect(f.$and[1]!.name).toBe('Foo');
    });

    it('translates id inside $or clauses', async () => {
      await wrapper.findOne({ $or: [{ id: 'a' }, { id: 'b' }] });
      const f = driver.lastFilter as { $or: Array<{ _id?: ObjectIdLike }> };
      expect(f.$or).toHaveLength(2);
      expect((f.$or[0]!._id as ObjectIdLike).toHexString()).toBe('a');
      expect((f.$or[1]!._id as ObjectIdLike).toHexString()).toBe('b');
    });

    it('translates id inside $in operator', async () => {
      await wrapper.findOne({ id: { $in: ['a', 'b'] } });
      const f = driver.lastFilter as { _id: { $in: ObjectIdLike[] } };
      expect(f._id.$in).toHaveLength(2);
      expect((f._id.$in[0] as ObjectIdLike).toHexString()).toBe('a');
    });

    it('does NOT translate fields named similarly (subjectId, contextIds)', async () => {
      await wrapper.findOne({ subjectId: 'abc', contextIds: 'ctx' });
      const f = driver.lastFilter as Record<string, unknown>;
      expect(f.subjectId).toBe('abc');
      expect(f.contextIds).toBe('ctx');
      expect(f._id).toBeUndefined();
    });

    it('leaves filters with no id unchanged', async () => {
      await wrapper.findOne({ name: 'Foo', archived: false });
      expect(driver.lastFilter).toEqual({ name: 'Foo', archived: false });
    });
  });

  describe('update $set id stripping', () => {
    it('strips id from $set', async () => {
      await wrapper.updateOne(
        { id: 'abc' },
        { $set: { id: 'shouldnotbeallowed', name: 'updated' } },
      );
      const update = driver.lastUpdate as { $set: Record<string, unknown> };
      expect(update.$set).not.toHaveProperty('id');
      expect(update.$set.name).toBe('updated');
    });

    it('strips id from $setOnInsert', async () => {
      await wrapper.updateOne(
        { id: 'abc' },
        { $setOnInsert: { id: 'x', created: new Date() } },
      );
      const update = driver.lastUpdate as { $setOnInsert: Record<string, unknown> };
      expect(update.$setOnInsert).not.toHaveProperty('id');
    });

    it('preserves $inc and other operators', async () => {
      await wrapper.updateOne({ id: 'abc' }, { $inc: { version: 1 } });
      const update = driver.lastUpdate as { $inc: Record<string, number> };
      expect(update.$inc.version).toBe(1);
    });
  });

  describe('document revival', () => {
    it('findOne returns document with id (not _id)', async () => {
      driver.docs.push({ name: 'A', _id: makeObjectId('oid_99') } as TestDoc);
      const got = await wrapper.findOne({});
      expect(got).toEqual({ name: 'A', id: 'oid_99' });
      expect(got).not.toHaveProperty('_id');
    });

    it('find returns array of revived documents', async () => {
      driver.docs.push({ name: 'A', _id: makeObjectId('oid_1') } as TestDoc);
      driver.docs.push({ name: 'B', _id: makeObjectId('oid_2') } as TestDoc);
      const got = await wrapper.find({});
      expect(got).toHaveLength(2);
      expect(got[0]!.id).toBe('oid_1');
      expect(got[1]!.id).toBe('oid_2');
    });
  });
});
