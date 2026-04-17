/**
 * MongoMemoryAdapter unit tests — exercised against an in-memory FakeMongoCollection
 * that implements the subset of Mongo operators the adapter emits. Covers the
 * IMemoryStore contract end-to-end plus Mongo-specific behaviors (optimistic
 * concurrency, bulk writes, scope filter pushdown, capability detection).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MongoMemoryAdapter,
  MongoOptimisticConcurrencyError,
} from '@/memory/adapters/mongo/MongoMemoryAdapter.js';
import { ensureIndexes } from '@/memory/adapters/mongo/indexes.js';
import type { IEntity, IFact, Identifier } from '@/memory/types.js';
import { FakeMongoCollection, MinimalFakeMongoCollection } from './FakeMongoCollection.js';

function entity(overrides: Partial<IEntity> = {}): IEntity {
  const now = new Date();
  return {
    id: overrides.id ?? 'ent_1',
    type: overrides.type ?? 'person',
    displayName: overrides.displayName ?? 'Test Person',
    aliases: overrides.aliases,
    identifiers: overrides.identifiers ?? [],
    metadata: overrides.metadata,
    archived: overrides.archived,
    version: overrides.version ?? 1,
    groupId: overrides.groupId,
    ownerId: overrides.ownerId,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function fact(overrides: Partial<IFact> = {}): IFact {
  const now = new Date();
  return {
    id: overrides.id ?? 'fact_1',
    subjectId: overrides.subjectId ?? 'ent_1',
    predicate: overrides.predicate ?? 'works_at',
    kind: overrides.kind ?? 'atomic',
    objectId: overrides.objectId,
    value: overrides.value,
    details: overrides.details,
    summaryForEmbedding: overrides.summaryForEmbedding,
    embedding: overrides.embedding,
    isSemantic: overrides.isSemantic,
    confidence: overrides.confidence,
    supersedes: overrides.supersedes,
    archived: overrides.archived,
    isAggregate: overrides.isAggregate,
    observedAt: overrides.observedAt ?? now,
    validFrom: overrides.validFrom,
    validUntil: overrides.validUntil,
    metadata: overrides.metadata,
    groupId: overrides.groupId,
    ownerId: overrides.ownerId,
    createdAt: overrides.createdAt ?? now,
  };
}

describe('MongoMemoryAdapter', () => {
  let entColl: FakeMongoCollection<IEntity>;
  let factColl: FakeMongoCollection<IFact>;
  let adapter: MongoMemoryAdapter;

  beforeEach(() => {
    entColl = new FakeMongoCollection<IEntity>('entities');
    factColl = new FakeMongoCollection<IFact>('facts');
    adapter = new MongoMemoryAdapter({
      entities: entColl,
      facts: factColl,
      factsCollectionName: 'facts',
    });
  });

  afterEach(() => {
    if (!adapter.isDestroyed) adapter.destroy();
  });

  // ==========================================================================
  // Entities
  // ==========================================================================

  describe('entities', () => {
    it('inserts a new entity (version=1)', async () => {
      await adapter.putEntity(entity({ id: 'a' }));
      const got = await adapter.getEntity('a', {});
      expect(got?.displayName).toBe('Test Person');
    });

    it('throws MongoOptimisticConcurrencyError when inserting duplicate id with version=1', async () => {
      await adapter.putEntity(entity({ id: 'a' }));
      await expect(adapter.putEntity(entity({ id: 'a' }))).rejects.toThrow(
        MongoOptimisticConcurrencyError,
      );
    });

    it('accepts version bump (N → N+1)', async () => {
      await adapter.putEntity(entity({ id: 'a', version: 1, displayName: 'A' }));
      await adapter.putEntity(entity({ id: 'a', version: 2, displayName: 'B' }));
      expect((await adapter.getEntity('a', {}))?.displayName).toBe('B');
    });

    it('rejects out-of-order version bump', async () => {
      await adapter.putEntity(entity({ id: 'a', version: 1 }));
      await expect(adapter.putEntity(entity({ id: 'a', version: 3 }))).rejects.toThrow(
        MongoOptimisticConcurrencyError,
      );
    });

    it('putEntities stores multiple', async () => {
      await adapter.putEntities([entity({ id: 'a' }), entity({ id: 'b' })]);
      expect(await adapter.getEntity('a', {})).not.toBeNull();
      expect(await adapter.getEntity('b', {})).not.toBeNull();
    });

    it('archiveEntity hides from getEntity', async () => {
      await adapter.putEntity(entity({ id: 'a' }));
      await adapter.archiveEntity('a', {});
      expect(await adapter.getEntity('a', {})).toBeNull();
    });

    it('deleteEntity removes the document', async () => {
      await adapter.putEntity(entity({ id: 'a' }));
      await adapter.deleteEntity('a', {});
      expect(await adapter.getEntity('a', {})).toBeNull();
      expect(entColl.all).toHaveLength(0);
    });

    describe('findEntitiesByIdentifier', () => {
      const ident = (kind: string, value: string): Identifier => ({ kind, value });

      it('finds by (kind, value)', async () => {
        await adapter.putEntity(
          entity({ id: 'a', identifiers: [ident('email', 'a@example.com')] }),
        );
        const found = await adapter.findEntitiesByIdentifier('email', 'a@example.com', {});
        expect(found).toHaveLength(1);
        expect(found[0]!.id).toBe('a');
      });

      it('is case-insensitive on value', async () => {
        await adapter.putEntity(
          entity({ id: 'a', identifiers: [ident('email', 'Alice@X.com')] }),
        );
        const found = await adapter.findEntitiesByIdentifier('email', 'ALICE@x.com', {});
        expect(found).toHaveLength(1);
      });

      it('scope-filters', async () => {
        await adapter.putEntity(
          entity({ id: 'a', groupId: 'g1', identifiers: [ident('email', 'shared@x.com')] }),
        );
        await adapter.putEntity(
          entity({ id: 'b', groupId: 'g2', identifiers: [ident('email', 'shared@x.com')] }),
        );
        const found = await adapter.findEntitiesByIdentifier('email', 'shared@x.com', {
          groupId: 'g1',
        });
        expect(found.map((e) => e.id)).toEqual(['a']);
      });
    });

    describe('searchEntities', () => {
      beforeEach(async () => {
        await adapter.putEntities([
          entity({
            id: 'a',
            displayName: 'Alice Anderson',
            aliases: ['Ali'],
            identifiers: [{ kind: 'email', value: 'alice@acme.com' }],
          }),
          entity({ id: 'b', displayName: 'Bob Builder' }),
          entity({ id: 'c', displayName: 'Acme Corp', type: 'organization' }),
        ]);
      });

      it('matches displayName', async () => {
        const res = await adapter.searchEntities('alice', {}, {});
        expect(res.items.map((e) => e.id)).toEqual(['a']);
      });

      it('matches alias', async () => {
        const res = await adapter.searchEntities('ali', {}, {});
        expect(res.items.map((e) => e.id)).toContain('a');
      });

      it('respects type filter', async () => {
        const res = await adapter.searchEntities('', { types: ['organization'] }, {});
        expect(res.items.map((e) => e.id)).toEqual(['c']);
      });

      it('paginates via cursor', async () => {
        const p1 = await adapter.searchEntities('', { limit: 2 }, {});
        expect(p1.items).toHaveLength(2);
        expect(p1.nextCursor).toBeDefined();
        const p2 = await adapter.searchEntities('', { limit: 2, cursor: p1.nextCursor }, {});
        expect(p2.items.length + p1.items.length).toBe(3);
      });
    });

    describe('listEntities', () => {
      beforeEach(async () => {
        for (let i = 0; i < 4; i++) {
          await adapter.putEntity(entity({ id: `e${i}` }));
        }
      });

      it('paginates', async () => {
        const p1 = await adapter.listEntities({}, { limit: 2 }, {});
        expect(p1.items).toHaveLength(2);
        const p2 = await adapter.listEntities({}, { limit: 2, cursor: p1.nextCursor }, {});
        expect(p2.items).toHaveLength(2);
      });

      it('filters by ids', async () => {
        const res = await adapter.listEntities({ ids: ['e0', 'e2'] }, {}, {});
        expect(res.items.map((e) => e.id).sort()).toEqual(['e0', 'e2']);
      });

      it('archived:true returns only archived', async () => {
        await adapter.archiveEntity('e0', {});
        const res = await adapter.listEntities({ archived: true }, {}, {});
        expect(res.items.map((e) => e.id)).toEqual(['e0']);
      });
    });
  });

  // ==========================================================================
  // Facts
  // ==========================================================================

  describe('facts', () => {
    beforeEach(async () => {
      await adapter.putEntities([entity({ id: 'a' }), entity({ id: 'b' }), entity({ id: 'c' })]);
    });

    it('put/get round-trip', async () => {
      await adapter.putFact(fact({ id: 'f1', subjectId: 'a' }));
      const got = await adapter.getFact('f1', {});
      expect(got?.subjectId).toBe('a');
    });

    it('putFacts uses bulkWrite when available', async () => {
      await adapter.putFacts([
        fact({ id: 'f1', subjectId: 'a' }),
        fact({ id: 'f2', subjectId: 'a' }),
      ]);
      expect(factColl.bulkWriteCalls).toBe(1);
    });

    it('putFacts falls back when bulkWrite absent', async () => {
      const minimal = new MinimalFakeMongoCollection<IFact>();
      const minimalAdapter = new MongoMemoryAdapter({
        entities: entColl,
        facts: minimal,
      });
      await minimalAdapter.putFacts([
        fact({ id: 'f1', subjectId: 'a' }),
        fact({ id: 'f2', subjectId: 'a' }),
      ]);
      // Still stored (via sequential insertOne path).
      expect(await minimalAdapter.getFact('f1', {})).not.toBeNull();
      expect(await minimalAdapter.getFact('f2', {})).not.toBeNull();
      minimalAdapter.destroy();
    });

    it('idempotent putFact overwrites existing', async () => {
      await adapter.putFact(fact({ id: 'f1', subjectId: 'a', confidence: 0.5 }));
      await adapter.putFact(fact({ id: 'f1', subjectId: 'a', confidence: 0.9 }));
      const got = await adapter.getFact('f1', {});
      expect(got?.confidence).toBe(0.9);
    });

    it('updateFact patches fields', async () => {
      await adapter.putFact(fact({ id: 'f1', subjectId: 'a' }));
      await adapter.updateFact('f1', { archived: true }, {});
      const got = await adapter.getFact('f1', {});
      expect(got?.archived).toBe(true);
    });

    it('findFacts by subjectId', async () => {
      await adapter.putFacts([
        fact({ id: 'f1', subjectId: 'a' }),
        fact({ id: 'f2', subjectId: 'b' }),
      ]);
      const res = await adapter.findFacts({ subjectId: 'a' }, {}, {});
      expect(res.items.map((f) => f.id)).toEqual(['f1']);
    });

    it('findFacts by predicates[]', async () => {
      await adapter.putFacts([
        fact({ id: 'f1', subjectId: 'a', predicate: 'knows' }),
        fact({ id: 'f2', subjectId: 'a', predicate: 'works_at' }),
        fact({ id: 'f3', subjectId: 'a', predicate: 'other' }),
      ]);
      const res = await adapter.findFacts({ predicates: ['knows', 'works_at'] }, {}, {});
      expect(res.items.map((f) => f.id).sort()).toEqual(['f1', 'f2']);
    });

    it('findFacts hides archived by default', async () => {
      await adapter.putFacts([
        fact({ id: 'live', subjectId: 'a' }),
        fact({ id: 'archived', subjectId: 'a', archived: true }),
      ]);
      const res = await adapter.findFacts({ subjectId: 'a' }, {}, {});
      expect(res.items.map((f) => f.id)).toEqual(['live']);
    });

    it('findFacts archived:true returns only archived', async () => {
      await adapter.putFacts([
        fact({ id: 'live', subjectId: 'a' }),
        fact({ id: 'archived', subjectId: 'a', archived: true }),
      ]);
      const res = await adapter.findFacts({ subjectId: 'a', archived: true }, {}, {});
      expect(res.items.map((f) => f.id)).toEqual(['archived']);
    });

    it('findFacts minConfidence — missing confidence treated as 1.0', async () => {
      await adapter.putFacts([
        fact({ id: 'f1', subjectId: 'a', confidence: 0.3 }),
        fact({ id: 'f2', subjectId: 'a', confidence: 0.9 }),
        fact({ id: 'f3', subjectId: 'a' }), // no confidence → 1.0
      ]);
      const res = await adapter.findFacts({ minConfidence: 0.5 }, {}, {});
      expect(res.items.map((f) => f.id).sort()).toEqual(['f2', 'f3']);
    });

    it('findFacts asOf filters by validity window', async () => {
      const day = (n: number) => new Date(2026, 0, n);
      await adapter.putFact(
        fact({
          id: 'future',
          subjectId: 'a',
          createdAt: day(5),
          validFrom: day(10),
        }),
      );
      const early = await adapter.findFacts({ subjectId: 'a', asOf: day(5) }, {}, {});
      expect(early.items).toHaveLength(0);
      const later = await adapter.findFacts({ subjectId: 'a', asOf: day(15) }, {}, {});
      expect(later.items).toHaveLength(1);
    });

    it('countFacts matches findFacts count', async () => {
      await adapter.putFacts([
        fact({ id: 'f1', subjectId: 'a' }),
        fact({ id: 'f2', subjectId: 'a' }),
      ]);
      expect(await adapter.countFacts({ subjectId: 'a' }, {})).toBe(2);
    });

    it('findFacts pagination with cursor', async () => {
      for (let i = 0; i < 5; i++) {
        await adapter.putFact(fact({ id: `f${i}`, subjectId: 'a' }));
      }
      const p1 = await adapter.findFacts({ subjectId: 'a' }, { limit: 2 }, {});
      expect(p1.items).toHaveLength(2);
      const p2 = await adapter.findFacts(
        { subjectId: 'a' },
        { limit: 2, cursor: p1.nextCursor },
        {},
      );
      expect(p2.items).toHaveLength(2);
      const p3 = await adapter.findFacts(
        { subjectId: 'a' },
        { limit: 2, cursor: p2.nextCursor },
        {},
      );
      expect(p3.items).toHaveLength(1);
      expect(p3.nextCursor).toBeUndefined();
    });

    it('findFacts orderBy observedAt desc', async () => {
      const day = (n: number) => new Date(2026, 0, n);
      await adapter.putFacts([
        fact({ id: 'f1', subjectId: 'a', observedAt: day(1) }),
        fact({ id: 'f2', subjectId: 'a', observedAt: day(3) }),
        fact({ id: 'f3', subjectId: 'a', observedAt: day(2) }),
      ]);
      const res = await adapter.findFacts(
        { subjectId: 'a' },
        { orderBy: { field: 'observedAt', direction: 'desc' } },
        {},
      );
      expect(res.items.map((f) => f.id)).toEqual(['f2', 'f3', 'f1']);
    });
  });

  // ==========================================================================
  // Scope visibility
  // ==========================================================================

  describe('scope visibility pushed to Mongo filter', () => {
    it('global record visible to every scope', async () => {
      await adapter.putEntity(entity({ id: 'g' }));
      expect(await adapter.getEntity('g', {})).not.toBeNull();
      expect(await adapter.getEntity('g', { groupId: 'any' })).not.toBeNull();
      expect(await adapter.getEntity('g', { userId: 'u1' })).not.toBeNull();
    });

    it('group-scoped record only visible to matching groupId', async () => {
      await adapter.putEntity(entity({ id: 'a', groupId: 'g1' }));
      expect(await adapter.getEntity('a', { groupId: 'g1' })).not.toBeNull();
      expect(await adapter.getEntity('a', { groupId: 'g2' })).toBeNull();
      expect(await adapter.getEntity('a', {})).toBeNull();
    });

    it('user+group requires both to match', async () => {
      await adapter.putEntity(entity({ id: 'a', groupId: 'g1', ownerId: 'u1' }));
      expect(await adapter.getEntity('a', { groupId: 'g1', userId: 'u1' })).not.toBeNull();
      expect(await adapter.getEntity('a', { groupId: 'g1', userId: 'u2' })).toBeNull();
      expect(await adapter.getEntity('a', { groupId: 'g2', userId: 'u1' })).toBeNull();
    });
  });

  // ==========================================================================
  // Semantic search — cursor-cosine fallback path
  // ==========================================================================

  describe('semanticSearch fallback', () => {
    beforeEach(async () => {
      await adapter.putEntity(entity({ id: 'a' }));
      await adapter.putFacts([
        fact({ id: 'match', subjectId: 'a', embedding: [1, 0, 0] }),
        fact({ id: 'opposite', subjectId: 'a', embedding: [0, 0, 1] }),
        fact({ id: 'bad_dim', subjectId: 'a', embedding: [1, 0] }),
        fact({ id: 'no_embed', subjectId: 'a' }),
      ]);
    });

    it('ranks by cosine similarity (no vectorIndexName)', async () => {
      const res = await adapter.semanticSearch([1, 0, 0], {}, { topK: 2 }, {});
      expect(res[0]!.fact.id).toBe('match');
      expect(res[0]!.score).toBeCloseTo(1, 5);
    });

    it('skips wrong-dim + unembedded', async () => {
      const res = await adapter.semanticSearch([1, 0, 0], {}, { topK: 10 }, {});
      const ids = res.map((r) => r.fact.id);
      expect(ids).not.toContain('bad_dim');
      expect(ids).not.toContain('no_embed');
    });
  });

  // ==========================================================================
  // Graph traverse — iterative fallback (native graphLookup covered separately)
  // ==========================================================================

  describe('traverse (iterative fallback)', () => {
    it('walks out edges', async () => {
      await adapter.putEntities([entity({ id: 'a' }), entity({ id: 'b' })]);
      await adapter.putFact(
        fact({ id: 'f1', subjectId: 'a', predicate: 'knows', objectId: 'b' }),
      );
      const n = await adapter.traverse('a', { direction: 'out', maxDepth: 1 }, {});
      expect(n.nodes.map((x) => x.entity.id).sort()).toEqual(['a', 'b']);
      expect(n.edges).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  describe('lifecycle', () => {
    it('destroy flips flag and blocks further operations', async () => {
      adapter.destroy();
      expect(adapter.isDestroyed).toBe(true);
      await expect(adapter.getEntity('x', {})).rejects.toThrow(/destroyed/);
    });

    it('shutdown calls destroy', async () => {
      await adapter.shutdown();
      expect(adapter.isDestroyed).toBe(true);
    });

    it('collection lifecycle is caller-owned (destroy does not clear collection)', async () => {
      await adapter.putEntity(entity({ id: 'a' }));
      adapter.destroy();
      expect(entColl.all).toHaveLength(1);
    });
  });

  // ==========================================================================
  // ensureIndexes
  // ==========================================================================

  describe('ensureIndexes', () => {
    it('creates the expected indexes when collections support createIndex', async () => {
      await ensureIndexes({ entities: entColl, facts: factColl });
      const entIdx = entColl.createdIndexes.map((i) => i.name);
      const factIdx = factColl.createdIndexes.map((i) => i.name);
      expect(entIdx).toContain('memory_ent_ident');
      expect(entIdx).toContain('memory_ent_list');
      expect(entIdx).toContain('memory_ent_pk');
      expect(factIdx).toContain('memory_fact_by_subject');
      expect(factIdx).toContain('memory_fact_by_object');
      expect(factIdx).toContain('memory_fact_recent_pred');
      expect(factIdx).toContain('memory_fact_pk');
    });

    it('is a no-op on collections without createIndex', async () => {
      const minimal = new MinimalFakeMongoCollection<IEntity>();
      const minimalF = new MinimalFakeMongoCollection<IFact>();
      await expect(
        ensureIndexes({ entities: minimal, facts: minimalF }),
      ).resolves.toBeUndefined();
    });
  });
});
