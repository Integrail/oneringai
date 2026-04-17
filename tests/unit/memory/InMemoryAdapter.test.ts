/**
 * Unit tests for memory/adapters/InMemoryAdapter.ts — full contract coverage:
 * entity CRUD + optimistic concurrency, fact CRUD + filtering + pagination,
 * scope visibility, vector search, graph traversal delegation, lifecycle.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  InMemoryAdapter,
  OptimisticConcurrencyError,
  ScopeViolationError,
} from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { IEntity, IFact, Identifier } from '@/memory/types.js';

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

describe('InMemoryAdapter', () => {
  let store: InMemoryAdapter;

  beforeEach(() => {
    store = new InMemoryAdapter();
  });

  afterEach(() => {
    if (!store.isDestroyed) store.destroy();
  });

  // ==========================================================================
  // Entities
  // ==========================================================================

  describe('entities — put/get', () => {
    it('round-trips a basic entity', async () => {
      const e = entity({ id: 'a', displayName: 'Alice' });
      await store.putEntity(e);
      const got = await store.getEntity('a', {});
      expect(got).not.toBeNull();
      expect(got!.displayName).toBe('Alice');
    });

    it('returns a cloned object, not a reference', async () => {
      const e = entity({ id: 'a' });
      await store.putEntity(e);
      const got = await store.getEntity('a', {});
      got!.displayName = 'Mutated';
      const got2 = await store.getEntity('a', {});
      expect(got2!.displayName).not.toBe('Mutated');
    });

    it('returns null for missing entity', async () => {
      expect(await store.getEntity('missing', {})).toBeNull();
    });

    it('putEntities batch stores all', async () => {
      await store.putEntities([entity({ id: 'a' }), entity({ id: 'b' })]);
      expect(await store.getEntity('a', {})).not.toBeNull();
      expect(await store.getEntity('b', {})).not.toBeNull();
    });
  });

  describe('entities — optimistic concurrency', () => {
    it('accepts version=1 for a new entity', async () => {
      await expect(store.putEntity(entity({ id: 'a', version: 1 }))).resolves.toBeUndefined();
    });

    it('rejects version !== 1 for a new entity', async () => {
      await expect(store.putEntity(entity({ id: 'a', version: 2 }))).rejects.toThrow(
        OptimisticConcurrencyError,
      );
    });

    it('accepts version=N+1 for an existing entity', async () => {
      await store.putEntity(entity({ id: 'a', version: 1 }));
      await expect(
        store.putEntity(entity({ id: 'a', version: 2, displayName: 'Bob' })),
      ).resolves.toBeUndefined();
      const got = await store.getEntity('a', {});
      expect(got!.displayName).toBe('Bob');
    });

    it('rejects non-consecutive version bumps', async () => {
      await store.putEntity(entity({ id: 'a', version: 1 }));
      await expect(store.putEntity(entity({ id: 'a', version: 3 }))).rejects.toThrow(
        OptimisticConcurrencyError,
      );
      await expect(store.putEntity(entity({ id: 'a', version: 1 }))).rejects.toThrow(
        OptimisticConcurrencyError,
      );
    });
  });

  describe('entities — archive / delete', () => {
    it('archiveEntity hides from getEntity', async () => {
      await store.putEntity(entity({ id: 'a' }));
      await store.archiveEntity('a', {});
      expect(await store.getEntity('a', {})).toBeNull();
    });

    it('archiveEntity ignores missing ids silently', async () => {
      await expect(store.archiveEntity('missing', {})).resolves.toBeUndefined();
    });

    it('archiveEntity throws ScopeViolationError when not visible', async () => {
      await store.putEntity(entity({ id: 'a', groupId: 'g1' }));
      await expect(store.archiveEntity('a', { groupId: 'other' })).rejects.toThrow(
        ScopeViolationError,
      );
    });

    it('deleteEntity removes completely', async () => {
      await store.putEntity(entity({ id: 'a' }));
      await store.deleteEntity('a', {});
      expect(await store.getEntity('a', {})).toBeNull();
      // Removing identifier index too — putting a new one with same id works with version 1.
      await expect(store.putEntity(entity({ id: 'a', version: 1 }))).resolves.toBeUndefined();
    });
  });

  describe('entities — identifier lookup', () => {
    const ident = (kind: string, value: string): Identifier => ({ kind, value });

    it('finds by (kind, value)', async () => {
      await store.putEntity(
        entity({
          id: 'a',
          identifiers: [ident('email', 'a@example.com')],
        }),
      );
      const found = await store.findEntitiesByIdentifier('email', 'a@example.com', {});
      expect(found).toHaveLength(1);
      expect(found[0]!.id).toBe('a');
    });

    it('is case-insensitive on value', async () => {
      await store.putEntity(
        entity({
          id: 'a',
          identifiers: [ident('email', 'A@Example.com')],
        }),
      );
      const found = await store.findEntitiesByIdentifier('email', 'a@example.com', {});
      expect(found).toHaveLength(1);
    });

    it('scope-filters results', async () => {
      await store.putEntity(
        entity({
          id: 'a',
          groupId: 'g1',
          identifiers: [ident('email', 'x@example.com')],
        }),
      );
      await store.putEntity(
        entity({
          id: 'b',
          groupId: 'g2',
          identifiers: [ident('email', 'x@example.com')],
        }),
      );
      const found = await store.findEntitiesByIdentifier('email', 'x@example.com', {
        groupId: 'g1',
      });
      expect(found.map((e) => e.id)).toEqual(['a']);
    });

    it('returns empty when no match', async () => {
      const found = await store.findEntitiesByIdentifier('email', 'none', {});
      expect(found).toEqual([]);
    });
  });

  describe('entities — searchEntities', () => {
    beforeEach(async () => {
      await store.putEntities([
        entity({
          id: 'a',
          displayName: 'Alice Anderson',
          aliases: ['Ali'],
          identifiers: [{ kind: 'email', value: 'alice@acme.com' }],
          type: 'person',
        }),
        entity({
          id: 'b',
          displayName: 'Bob Builder',
          type: 'person',
        }),
        entity({
          id: 'c',
          displayName: 'Acme Corp',
          type: 'organization',
        }),
      ]);
    });

    it('matches by displayName substring', async () => {
      const result = await store.searchEntities('alice', {}, {});
      expect(result.items.map((e) => e.id)).toEqual(['a']);
    });

    it('matches by alias', async () => {
      const result = await store.searchEntities('ali', {}, {});
      expect(result.items.map((e) => e.id).sort()).toContain('a');
    });

    it('matches by identifier value', async () => {
      const result = await store.searchEntities('acme.com', {}, {});
      expect(result.items.map((e) => e.id)).toContain('a');
    });

    it('respects type filter', async () => {
      const result = await store.searchEntities('', { types: ['organization'] }, {});
      expect(result.items.map((e) => e.id)).toEqual(['c']);
    });

    it('empty query returns all visible entities', async () => {
      const result = await store.searchEntities('', {}, {});
      expect(result.items.map((e) => e.id).sort()).toEqual(['a', 'b', 'c']);
    });
  });

  describe('entities — listEntities pagination', () => {
    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        await store.putEntity(entity({ id: `e${i}`, displayName: `E${i}` }));
      }
    });

    it('paginates via cursor', async () => {
      const page1 = await store.listEntities({}, { limit: 2 }, {});
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).toBeDefined();

      const page2 = await store.listEntities({}, { limit: 2, cursor: page1.nextCursor }, {});
      expect(page2.items).toHaveLength(2);

      const page3 = await store.listEntities({}, { limit: 2, cursor: page2.nextCursor }, {});
      expect(page3.items).toHaveLength(1);
      expect(page3.nextCursor).toBeUndefined();
    });

    it('filters by ids', async () => {
      const result = await store.listEntities({ ids: ['e0', 'e2'] }, {}, {});
      expect(result.items.map((e) => e.id).sort()).toEqual(['e0', 'e2']);
    });

    it('archived: true returns only archived', async () => {
      await store.archiveEntity('e0', {});
      const result = await store.listEntities({ archived: true }, {}, {});
      expect(result.items.map((e) => e.id)).toEqual(['e0']);
    });
  });

  // ==========================================================================
  // Facts
  // ==========================================================================

  describe('facts — CRUD', () => {
    beforeEach(async () => {
      await store.putEntities([entity({ id: 'a' }), entity({ id: 'b' })]);
    });

    it('put/get round-trip', async () => {
      const f = fact({ id: 'f1', subjectId: 'a' });
      await store.putFact(f);
      const got = await store.getFact('f1', {});
      expect(got).not.toBeNull();
      expect(got!.subjectId).toBe('a');
    });

    it('returns a cloned object', async () => {
      await store.putFact(fact({ id: 'f1', subjectId: 'a', details: 'original' }));
      const got = await store.getFact('f1', {});
      got!.details = 'mutated';
      const got2 = await store.getFact('f1', {});
      expect(got2!.details).toBe('original');
    });

    it('putFacts batch', async () => {
      await store.putFacts([
        fact({ id: 'f1', subjectId: 'a' }),
        fact({ id: 'f2', subjectId: 'a' }),
      ]);
      expect((await store.findFacts({ subjectId: 'a' }, {}, {})).items).toHaveLength(2);
    });

    it('updateFact applies patch', async () => {
      await store.putFact(fact({ id: 'f1', subjectId: 'a', confidence: 0.5 }));
      await store.updateFact('f1', { confidence: 0.9 }, {});
      const got = await store.getFact('f1', {});
      expect(got!.confidence).toBe(0.9);
    });

    it('updateFact on missing id is silent', async () => {
      await expect(store.updateFact('missing', { confidence: 1 }, {})).resolves.toBeUndefined();
    });
  });

  describe('facts — findFacts filters', () => {
    beforeEach(async () => {
      await store.putEntities([entity({ id: 'a' }), entity({ id: 'b' }), entity({ id: 'c' })]);
      await store.putFacts([
        fact({ id: 'f1', subjectId: 'a', predicate: 'works_at', objectId: 'b', confidence: 0.9 }),
        fact({ id: 'f2', subjectId: 'a', predicate: 'knows', objectId: 'c', confidence: 0.3 }),
        fact({
          id: 'f3',
          subjectId: 'b',
          predicate: 'works_at',
          objectId: 'c',
          confidence: 0.7,
          kind: 'atomic',
        }),
        fact({ id: 'f4', subjectId: 'a', predicate: 'bio', kind: 'document', details: 'long' }),
      ]);
    });

    it('by subjectId', async () => {
      const page = await store.findFacts({ subjectId: 'a' }, {}, {});
      expect(page.items.map((f) => f.id).sort()).toEqual(['f1', 'f2', 'f4']);
    });

    it('by objectId', async () => {
      const page = await store.findFacts({ objectId: 'c' }, {}, {});
      expect(page.items.map((f) => f.id).sort()).toEqual(['f2', 'f3']);
    });

    it('by predicate', async () => {
      const page = await store.findFacts({ predicate: 'works_at' }, {}, {});
      expect(page.items.map((f) => f.id).sort()).toEqual(['f1', 'f3']);
    });

    it('by predicates[]', async () => {
      const page = await store.findFacts({ predicates: ['knows', 'bio'] }, {}, {});
      expect(page.items.map((f) => f.id).sort()).toEqual(['f2', 'f4']);
    });

    it('by kind', async () => {
      const page = await store.findFacts({ kind: 'document' }, {}, {});
      expect(page.items.map((f) => f.id)).toEqual(['f4']);
    });

    it('by minConfidence (facts without confidence default to 1.0)', async () => {
      const page = await store.findFacts({ minConfidence: 0.5 }, {}, {});
      // f4 has no confidence set → treated as 1.0 → passes min 0.5.
      expect(page.items.map((f) => f.id).sort()).toEqual(['f1', 'f3', 'f4']);
    });

    it('combined filters (AND semantics)', async () => {
      const page = await store.findFacts(
        { subjectId: 'a', predicate: 'works_at' },
        {},
        {},
      );
      expect(page.items.map((f) => f.id)).toEqual(['f1']);
    });
  });

  describe('facts — archived handling', () => {
    beforeEach(async () => {
      await store.putEntity(entity({ id: 'a' }));
      await store.putFacts([
        fact({ id: 'live', subjectId: 'a' }),
        fact({ id: 'archived', subjectId: 'a', archived: true }),
      ]);
    });

    it('default (undefined) hides archived', async () => {
      const page = await store.findFacts({ subjectId: 'a' }, {}, {});
      expect(page.items.map((f) => f.id)).toEqual(['live']);
    });

    it('archived:true shows only archived', async () => {
      const page = await store.findFacts({ subjectId: 'a', archived: true }, {}, {});
      expect(page.items.map((f) => f.id)).toEqual(['archived']);
    });

    it('archived:false shows only non-archived', async () => {
      const page = await store.findFacts({ subjectId: 'a', archived: false }, {}, {});
      expect(page.items.map((f) => f.id)).toEqual(['live']);
    });
  });

  describe('facts — temporal', () => {
    const yesterday = new Date('2026-04-16');
    const today = new Date('2026-04-17');
    const tomorrow = new Date('2026-04-18');

    beforeEach(async () => {
      await store.putEntity(entity({ id: 'a' }));
    });

    it('observedAfter / observedBefore filter', async () => {
      await store.putFacts([
        fact({ id: 'old', subjectId: 'a', observedAt: yesterday, createdAt: yesterday }),
        fact({ id: 'new', subjectId: 'a', observedAt: tomorrow, createdAt: tomorrow }),
      ]);
      const beforePage = await store.findFacts(
        { subjectId: 'a', observedBefore: today },
        {},
        {},
      );
      expect(beforePage.items.map((f) => f.id)).toEqual(['old']);
      const afterPage = await store.findFacts(
        { subjectId: 'a', observedAfter: today },
        {},
        {},
      );
      expect(afterPage.items.map((f) => f.id)).toEqual(['new']);
    });

    it('asOf respects validFrom/validUntil + createdAt', async () => {
      await store.putFact(
        fact({ id: 'future', subjectId: 'a', createdAt: today, validFrom: tomorrow }),
      );
      expect(
        (await store.findFacts({ subjectId: 'a', asOf: today }, {}, {})).items,
      ).toEqual([]);
      expect(
        (await store.findFacts({ subjectId: 'a', asOf: tomorrow }, {}, {})).items.map(
          (f) => f.id,
        ),
      ).toEqual(['future']);
    });

    it('asOf filters expired facts (past validUntil)', async () => {
      await store.putFact(
        fact({
          id: 'expired',
          subjectId: 'a',
          createdAt: yesterday,
          validFrom: yesterday,
          validUntil: yesterday,
        }),
      );
      const page = await store.findFacts({ subjectId: 'a', asOf: today }, {}, {});
      expect(page.items).toEqual([]);
    });
  });

  describe('facts — pagination + ordering', () => {
    beforeEach(async () => {
      await store.putEntity(entity({ id: 'a' }));
      for (let i = 0; i < 5; i++) {
        await store.putFact(
          fact({
            id: `f${i}`,
            subjectId: 'a',
            confidence: i / 10,
            observedAt: new Date(2026, 0, i + 1),
          }),
        );
      }
    });

    it('orderBy observedAt desc', async () => {
      const page = await store.findFacts(
        { subjectId: 'a' },
        { orderBy: { field: 'observedAt', direction: 'desc' } },
        {},
      );
      expect(page.items.map((f) => f.id)).toEqual(['f4', 'f3', 'f2', 'f1', 'f0']);
    });

    it('orderBy confidence asc', async () => {
      const page = await store.findFacts(
        { subjectId: 'a' },
        { orderBy: { field: 'confidence', direction: 'asc' } },
        {},
      );
      expect(page.items.map((f) => f.id)).toEqual(['f0', 'f1', 'f2', 'f3', 'f4']);
    });

    it('paginates with cursor', async () => {
      const p1 = await store.findFacts({ subjectId: 'a' }, { limit: 2 }, {});
      expect(p1.items).toHaveLength(2);
      const p2 = await store.findFacts({ subjectId: 'a' }, { limit: 2, cursor: p1.nextCursor }, {});
      expect(p2.items).toHaveLength(2);
      const p3 = await store.findFacts({ subjectId: 'a' }, { limit: 2, cursor: p2.nextCursor }, {});
      expect(p3.items).toHaveLength(1);
      expect(p3.nextCursor).toBeUndefined();
    });
  });

  describe('facts — countFacts', () => {
    beforeEach(async () => {
      await store.putEntity(entity({ id: 'a' }));
      await store.putFacts([
        fact({ id: 'f1', subjectId: 'a' }),
        fact({ id: 'f2', subjectId: 'a', archived: true }),
        fact({ id: 'f3', subjectId: 'a' }),
      ]);
    });

    it('matches findFacts default (excludes archived)', async () => {
      expect(await store.countFacts({ subjectId: 'a' }, {})).toBe(2);
    });

    it('counts only archived when archived:true', async () => {
      expect(await store.countFacts({ subjectId: 'a', archived: true }, {})).toBe(1);
    });
  });

  // ==========================================================================
  // Scope visibility
  // ==========================================================================

  describe('scope — visibility matrix', () => {
    it('global entity visible to every scope', async () => {
      await store.putEntity(entity({ id: 'g' }));
      expect(await store.getEntity('g', {})).not.toBeNull();
      expect(await store.getEntity('g', { groupId: 'anything' })).not.toBeNull();
      expect(await store.getEntity('g', { userId: 'u1' })).not.toBeNull();
    });

    it('group-scoped entity only visible to matching groupId', async () => {
      await store.putEntity(entity({ id: 'a', groupId: 'g1' }));
      expect(await store.getEntity('a', { groupId: 'g1' })).not.toBeNull();
      expect(await store.getEntity('a', { groupId: 'g2' })).toBeNull();
      expect(await store.getEntity('a', {})).toBeNull();
    });

    it('user-scoped entity only visible to matching userId', async () => {
      await store.putEntity(entity({ id: 'a', ownerId: 'u1' }));
      expect(await store.getEntity('a', { userId: 'u1' })).not.toBeNull();
      expect(await store.getEntity('a', { userId: 'u2' })).toBeNull();
    });

    it('group+user scoped entity requires BOTH to match', async () => {
      await store.putEntity(entity({ id: 'a', groupId: 'g1', ownerId: 'u1' }));
      expect(await store.getEntity('a', { groupId: 'g1', userId: 'u1' })).not.toBeNull();
      expect(await store.getEntity('a', { groupId: 'g1', userId: 'u2' })).toBeNull();
      expect(await store.getEntity('a', { groupId: 'g2', userId: 'u1' })).toBeNull();
    });

    it('fact scope is independent of entity scope for visibility checks', async () => {
      await store.putEntity(entity({ id: 'a' })); // global entity
      await store.putFact(fact({ id: 'f', subjectId: 'a', groupId: 'g1' }));
      expect(await store.getFact('f', { groupId: 'g1' })).not.toBeNull();
      expect(await store.getFact('f', { groupId: 'g2' })).toBeNull();
    });
  });

  // ==========================================================================
  // Graph + Vector
  // ==========================================================================

  describe('traverse', () => {
    it('delegates to genericTraverse and returns neighborhood', async () => {
      await store.putEntities([entity({ id: 'a' }), entity({ id: 'b' })]);
      await store.putFact(fact({ id: 'f1', subjectId: 'a', predicate: 'works_at', objectId: 'b' }));
      const result = await store.traverse('a', { direction: 'out', maxDepth: 1 }, {});
      expect(result.nodes.map((n) => n.entity.id).sort()).toEqual(['a', 'b']);
    });
  });

  describe('semanticSearch', () => {
    beforeEach(async () => {
      await store.putEntity(entity({ id: 'a' }));
      await store.putFact(
        fact({ id: 'f1', subjectId: 'a', details: 'matches', embedding: [1, 0, 0] }),
      );
      await store.putFact(
        fact({ id: 'f2', subjectId: 'a', details: 'opposite', embedding: [0, 0, 1] }),
      );
      await store.putFact(fact({ id: 'f3', subjectId: 'a', details: 'unembedded' }));
    });

    it('ranks by cosine similarity', async () => {
      const results = await store.semanticSearch([1, 0, 0], {}, { topK: 2 }, {});
      expect(results[0]!.fact.id).toBe('f1');
      expect(results[0]!.score).toBeCloseTo(1, 5);
    });

    it('skips facts without embedding', async () => {
      const results = await store.semanticSearch([1, 0, 0], {}, { topK: 10 }, {});
      expect(results.map((r) => r.fact.id)).not.toContain('f3');
    });

    it('skips facts with wrong embedding dimension', async () => {
      await store.putFact(
        fact({ id: 'f4', subjectId: 'a', embedding: [1, 0] }), // wrong dim
      );
      const results = await store.semanticSearch([1, 0, 0], {}, { topK: 10 }, {});
      expect(results.map((r) => r.fact.id)).not.toContain('f4');
    });

    it('respects filter + scope', async () => {
      await store.putEntity(entity({ id: 'b', groupId: 'g2' }));
      await store.putFact(
        fact({ id: 'fb', subjectId: 'b', groupId: 'g2', embedding: [1, 0, 0] }),
      );
      const results = await store.semanticSearch([1, 0, 0], {}, { topK: 10 }, { groupId: 'g1' });
      expect(results.map((r) => r.fact.id)).not.toContain('fb');
    });
  });

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  describe('lifecycle', () => {
    it('destroy flips isDestroyed and clears data', async () => {
      await store.putEntity(entity({ id: 'a' }));
      store.destroy();
      expect(store.isDestroyed).toBe(true);
      await expect(store.getEntity('a', {})).rejects.toThrow();
    });

    it('destroy is idempotent', () => {
      store.destroy();
      expect(() => store.destroy()).not.toThrow();
    });
  });

  describe('seed data', () => {
    it('accepts entities + facts in constructor', async () => {
      const seeded = new InMemoryAdapter({
        entities: [entity({ id: 'a' })],
        facts: [fact({ id: 'f1', subjectId: 'a' })],
      });
      expect(await seeded.getEntity('a', {})).not.toBeNull();
      expect(await seeded.getFact('f1', {})).not.toBeNull();
      seeded.destroy();
    });
  });
});
