/**
 * MeteorMongoCollection — unit tests for the id ↔ _id translation behavior.
 * Meteor uses string _ids natively (Random.id()), so no ObjectId conversion.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MeteorMongoCollection } from '@/memory/adapters/mongo/MeteorMongoCollection.js';
import type { MeteorCollectionLike } from '@/memory/adapters/mongo/MeteorMongoCollection.js';
import type { MongoFilter, MongoUpdate } from '@/memory/adapters/mongo/IMongoCollectionLike.js';

/**
 * Fake Meteor Collection — captures async API calls and simulates Meteor's
 * behavior: string-based _id, Random.id() assignment.
 */
class FakeMeteorCollection<T extends { id?: string; _id?: string }>
  implements MeteorCollectionLike<T>
{
  docs: T[] = [];
  lastSelector?: MongoFilter;
  lastModifier?: MongoUpdate;
  private seq = 0;

  async insertAsync(doc: T): Promise<string> {
    const _id = `meteor_${++this.seq}`;
    this.docs.push({ ...doc, _id } as T);
    return _id;
  }

  async updateAsync(selector: MongoFilter, modifier: MongoUpdate): Promise<number> {
    this.lastSelector = selector;
    this.lastModifier = modifier;
    return 1;
  }

  async removeAsync(selector: MongoFilter): Promise<number> {
    this.lastSelector = selector;
    return 1;
  }

  async findOneAsync(selector: MongoFilter): Promise<T | null> {
    this.lastSelector = selector;
    return this.docs[0] ?? null;
  }

  find(selector: MongoFilter): {
    fetchAsync(): Promise<T[]>;
    countAsync(): Promise<number>;
  } {
    this.lastSelector = selector;
    return {
      fetchAsync: async () => [...this.docs],
      countAsync: async () => this.docs.length,
    };
  }

  rawCollection(): {
    aggregate(pipeline: unknown[]): { toArray(): Promise<unknown[]> };
    createIndex(spec: Record<string, 1 | -1>, opts?: unknown): Promise<string>;
  } {
    return {
      aggregate: () => ({ toArray: async () => this.docs }),
      createIndex: async () => 'ok',
    };
  }
}

interface TestDoc {
  id: string;
  name: string;
  _id?: string;
}

describe('MeteorMongoCollection — id ↔ _id translation (string-based)', () => {
  let col: FakeMeteorCollection<TestDoc>;
  let wrapper: MeteorMongoCollection<TestDoc>;

  beforeEach(() => {
    col = new FakeMeteorCollection<TestDoc>();
    wrapper = new MeteorMongoCollection<TestDoc>(col);
  });

  describe('insertOne', () => {
    it('strips incoming id and returns Meteor-assigned string id', async () => {
      const id = await wrapper.insertOne({ id: 'ignored', name: 'A' } as TestDoc);
      expect(id).toBe('meteor_1');
      expect(col.docs[0]).not.toHaveProperty('id');
    });
  });

  describe('filter translation — string _id (no ObjectId cast)', () => {
    it('translates top-level id to _id as a plain string', async () => {
      await wrapper.findOne({ id: 'abc' });
      expect(col.lastSelector).toEqual({ _id: 'abc' });
    });

    it('translates id inside $and clauses', async () => {
      await wrapper.findOne({ $and: [{ id: 'x' }, { name: 'Foo' }] });
      const sel = col.lastSelector as { $and: Array<{ _id?: string; name?: string }> };
      expect(sel.$and[0]!._id).toBe('x');
      expect(sel.$and[1]!.name).toBe('Foo');
    });

    it('translates id inside $or clauses', async () => {
      await wrapper.findOne({ $or: [{ id: 'a' }, { id: 'b' }] });
      const sel = col.lastSelector as { $or: Array<{ _id?: string }> };
      expect(sel.$or[0]!._id).toBe('a');
      expect(sel.$or[1]!._id).toBe('b');
    });

    it('passes $in through without transformation on values', async () => {
      await wrapper.findOne({ id: { $in: ['a', 'b'] } });
      const sel = col.lastSelector as { _id: { $in: string[] } };
      expect(sel._id.$in).toEqual(['a', 'b']);
    });
  });

  describe('update $set id stripping', () => {
    it('strips id from $set', async () => {
      await wrapper.updateOne(
        { id: 'abc' },
        { $set: { id: 'should-not', name: 'updated' } },
      );
      const mod = col.lastModifier as { $set: Record<string, unknown> };
      expect(mod.$set).not.toHaveProperty('id');
      expect(mod.$set.name).toBe('updated');
    });
  });

  describe('document revival', () => {
    it('findOne returns document with id mapped from _id', async () => {
      col.docs.push({ name: 'A', _id: 'meteor_abc' } as TestDoc);
      const got = await wrapper.findOne({});
      expect(got).toEqual({ name: 'A', id: 'meteor_abc' });
      expect(got).not.toHaveProperty('_id');
    });

    it('find returns array of revived documents', async () => {
      col.docs.push({ name: 'A', _id: 'meteor_1' } as TestDoc);
      col.docs.push({ name: 'B', _id: 'meteor_2' } as TestDoc);
      const got = await wrapper.find({});
      expect(got).toHaveLength(2);
      expect(got[0]!.id).toBe('meteor_1');
      expect(got[1]!.id).toBe('meteor_2');
    });
  });

  // Regression guard for the permission-aware scopeToFilter output. The filter
  // walker must preserve $or + nested $and + $ne operators while translating
  // any embedded `id` keys. If walkFilter ever treats $ne as a logical op or
  // skips recursion into $and inside $or branches, permission enforcement at
  // the Meteor adapter layer silently breaks.
  describe('permission-aware scope filter translation', () => {
    it('preserves $or with nested $and + $ne (shape produced by scopeToFilter)', async () => {
      // Shape mirrors scopeToFilter({ userId: 'u1', groupId: 'g1' }):
      //   $or: [
      //     { ownerId: 'u1' },
      //     { $and: [{ groupId: 'g1' }, { $or: [...] }] },     // group branch
      //     { $and: [{ groupId: { $ne: 'g1' } }, { $or: [...] }] },  // world branch
      //   ]
      const permissionFilter = {
        $or: [
          { ownerId: 'u1' },
          {
            $and: [
              { groupId: 'g1' },
              {
                $or: [
                  { 'permissions.group': { $exists: false } },
                  { 'permissions.group': { $ne: 'none' } },
                ],
              },
            ],
          },
          {
            $and: [
              { groupId: { $ne: 'g1' } },
              {
                $or: [
                  { 'permissions.world': { $exists: false } },
                  { 'permissions.world': { $ne: 'none' } },
                ],
              },
            ],
          },
        ],
      };
      await wrapper.findOne(permissionFilter);
      // The Meteor wrapper should hand this filter to Meteor unchanged (no id
      // fields to translate). Deep equality confirms structure is preserved.
      expect(col.lastSelector).toEqual(permissionFilter);
    });

    it('translates id fields inside deeply-nested $and branches of a permission $or', async () => {
      // Caller-side: memory combines a permission-aware scope filter with an
      // id constraint via $and (the real mergeFilters path).
      const merged = {
        $and: [
          {
            $or: [{ ownerId: 'u1' }, { $and: [{ groupId: 'g1' }, { something: 1 }] }],
          },
          { id: 'the-id' },
        ],
      };
      await wrapper.findOne(merged);
      const sel = col.lastSelector as {
        $and: [
          { $or: Array<Record<string, unknown>> },
          { _id?: string; id?: string },
        ];
      };
      // Top-level id → _id.
      expect(sel.$and[1]!._id).toBe('the-id');
      expect(sel.$and[1]!.id).toBeUndefined();
      // Nested permission-shaped branches untouched (no id inside them).
      expect(sel.$and[0]!.$or[0]!.ownerId).toBe('u1');
    });

    it('$ne operator is a value operator, not a logical one (no accidental recursion)', async () => {
      // The filter walker must NOT descend into $ne's value and transform
      // keys; $ne carries a scalar, not another filter.
      await wrapper.findOne({ groupId: { $ne: 'g1' } });
      expect(col.lastSelector).toEqual({ groupId: { $ne: 'g1' } });
    });
  });
});
