/**
 * Mongo-adapter specifics of the principal model:
 *  - scopeToFilter principal branch (presence-authoritative, empty → nothing,
 *    disableWorld strips the world token).
 *  - ensureIndexes never builds a forbidden two-array (parallel-array) compound.
 *  - updateFact recomputes principal arrays when an access field is patched.
 */

import { describe, it, expect } from 'vitest';
import { MongoMemoryAdapter } from '@/memory/adapters/mongo/MongoMemoryAdapter.js';
import { scopeToFilter } from '@/memory/adapters/mongo/scopeFilter.js';
import { orderByToSort } from '@/memory/adapters/mongo/queries.js';
import { ensureIndexes } from '@/memory/adapters/mongo/indexes.js';
import type { IEntity, IFact, NewFact } from '@/memory/types.js';
import { FakeMongoCollection } from './FakeMongoCollection.js';

describe('scopeToFilter — principal model', () => {
  it('present principals → single readPrincipals $in branch', () => {
    expect(
      scopeToFilter({ userId: 'u', groupId: 'g', principals: ['user:u', 'group:g', 'world'] }),
    ).toEqual({ readPrincipals: { $in: ['user:u', 'group:g', 'world'] } });
  });

  it('empty principals → match nothing (authoritative empty)', () => {
    expect(scopeToFilter({ principals: [] })).toEqual({ _id: { $exists: false } });
  });

  it('disableWorld strips the world token from the principal branch', () => {
    expect(scopeToFilter({ principals: ['user:u', 'world'] }, { disableWorld: true })).toEqual({
      readPrincipals: { $in: ['user:u'] },
    });
  });

  it('disableWorld + only world → match nothing', () => {
    expect(scopeToFilter({ principals: ['world'] }, { disableWorld: true })).toEqual({
      _id: { $exists: false },
    });
  });

  it('absent principals → legacy owner/group/world path (unchanged)', () => {
    const f = scopeToFilter({ userId: 'u', groupId: 'g' });
    expect(JSON.stringify(f)).toContain('ownerId');
  });
});

describe('orderByToSort — _id is a unique total order for exact pagination', () => {
  // backfillAccessPrincipals must touch every fact exactly once. createdAt ties
  // for bulk-ingested facts and Mongo's tie order isn't stable across paged
  // queries, so the fact backfill sorts by `_id` instead.
  it('maps _id to a sargable {_id: dir} sort', () => {
    expect(orderByToSort({ field: '_id', direction: 'asc' })).toEqual({ _id: 1 });
    expect(orderByToSort({ field: '_id', direction: 'desc' })).toEqual({ _id: -1 });
  });

  it('still maps the semantic fields', () => {
    expect(orderByToSort({ field: 'createdAt', direction: 'asc' })).toEqual({ createdAt: 1 });
    expect(orderByToSort({ field: 'observedAt', direction: 'desc' })).toEqual({ observedAt: -1 });
    expect(orderByToSort({ field: 'confidence', direction: 'asc' })).toEqual({ confidence: 1 });
  });
});

describe('ensureIndexes — no parallel-array (two-array compound) indexes', () => {
  // MongoDB forbids compound indexes over two array fields ("cannot index
  // parallel arrays", error 171). FakeMongoCollection doesn't enforce this, so
  // this static check guards the regression that real Mongo would reject.
  const ARRAY_FIELDS = new Set([
    'readPrincipals',
    'writePrincipals',
    'contextIds',
    'normalizedAliases',
    'aliases',
    'identifiers',
  ]);

  it('never compounds two array fields on entities or facts', async () => {
    const entities = new FakeMongoCollection<IEntity>('entities');
    const facts = new FakeMongoCollection<IFact>('facts');
    const factsArchive = new FakeMongoCollection<IFact>('facts_archive');
    await ensureIndexes({ entities, facts, factsArchive });

    const offenders: string[] = [];
    for (const coll of [entities, facts, factsArchive]) {
      for (const idx of coll.createdIndexes) {
        const arrays = Object.keys(idx.spec).filter((k) => ARRAY_FIELDS.has(k));
        if (arrays.length > 1) offenders.push(`${idx.name ?? '?'}: ${arrays.join('+')}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('does build a principal-led subject index (single array field is fine)', async () => {
    const entities = new FakeMongoCollection<IEntity>('entities');
    const facts = new FakeMongoCollection<IFact>('facts');
    await ensureIndexes({ entities, facts });
    const names = facts.createdIndexes.map((i) => i.name);
    expect(names).toContain('memory_fact_principals_subject');
    expect(names).not.toContain('memory_fact_principals_context');
  });
});

describe('MongoMemoryAdapter.updateFact recompute', () => {
  it('recomputes principal arrays when acl is patched', async () => {
    const entities = new FakeMongoCollection<IEntity>('entities');
    const facts = new FakeMongoCollection<IFact>('facts');
    const adapter = new MongoMemoryAdapter({ entities, facts, factsCollectionName: 'facts' });
    try {
      const f = await adapter.createFact({
        subjectId: 's',
        predicate: 'p',
        kind: 'atomic',
        ownerId: 'u1',
        permissions: { group: 'none', world: 'none' },
      } as NewFact);
      expect(f.readPrincipals).toEqual(['user:u1']);

      await adapter.updateFact(
        f.id,
        { acl: [{ principal: 'entity:bob', actions: ['read'] }] },
        { userId: 'u1' },
      );
      const got = (await adapter.getFact(f.id, { userId: 'u1' }))!;
      expect([...got.readPrincipals!].sort()).toEqual(['entity:bob', 'user:u1']);
    } finally {
      adapter.destroy();
    }
  });
});
