/**
 * Unit tests for memory/GenericTraversal.ts — BFS fallback over IMemoryStore.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { genericTraverse } from '@/memory/GenericTraversal.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { IEntity, IFact, ScopeFilter } from '@/memory/types.js';

function entity(id: string, type = 'person'): IEntity {
  const now = new Date();
  return {
    id,
    type,
    displayName: id,
    identifiers: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function fact(
  id: string,
  subjectId: string,
  predicate: string,
  objectId: string,
  overrides: Partial<IFact> = {},
): IFact {
  const now = new Date();
  return {
    id,
    subjectId,
    objectId,
    predicate,
    kind: 'atomic',
    createdAt: now,
    observedAt: now,
    ...overrides,
  };
}

describe('genericTraverse', () => {
  let store: InMemoryAdapter;
  const global: ScopeFilter = {};

  beforeEach(() => {
    store = new InMemoryAdapter();
  });

  afterEach(() => {
    store.destroy();
  });

  it('returns empty neighborhood when start entity is not visible', async () => {
    const result = await genericTraverse(
      store,
      'missing',
      { direction: 'both', maxDepth: 2 },
      global,
    );
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('depth=0 returns only the start node', async () => {
    await store.putEntity(entity('A'));
    await store.putEntity(entity('B'));
    await store.putFact(fact('f1', 'A', 'works_with', 'B'));

    const result = await genericTraverse(
      store,
      'A',
      { direction: 'both', maxDepth: 0 },
      global,
    );
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.entity.id).toBe('A');
    expect(result.edges).toHaveLength(0);
  });

  it('direction=out walks subject → object', async () => {
    await store.putEntities([entity('A'), entity('B')]);
    await store.putFact(fact('f1', 'A', 'works_at', 'B'));

    const result = await genericTraverse(
      store,
      'A',
      { direction: 'out', maxDepth: 1 },
      global,
    );
    expect(result.nodes.map((n) => n.entity.id).sort()).toEqual(['A', 'B']);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.from).toBe('A');
    expect(result.edges[0]!.to).toBe('B');
  });

  it('direction=in walks object → subject (reverse edges)', async () => {
    await store.putEntities([entity('A'), entity('B')]);
    await store.putFact(fact('f1', 'A', 'works_at', 'B'));

    const result = await genericTraverse(
      store,
      'B',
      { direction: 'in', maxDepth: 1 },
      global,
    );
    expect(result.nodes.map((n) => n.entity.id).sort()).toEqual(['A', 'B']);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.from).toBe('A');
  });

  it('direction=both walks both ways', async () => {
    await store.putEntities([entity('A'), entity('B'), entity('C')]);
    await store.putFact(fact('f1', 'A', 'works_at', 'B')); // A→B
    await store.putFact(fact('f2', 'C', 'manages', 'A')); // C→A

    const result = await genericTraverse(
      store,
      'A',
      { direction: 'both', maxDepth: 1 },
      global,
    );
    expect(result.nodes.map((n) => n.entity.id).sort()).toEqual(['A', 'B', 'C']);
    expect(result.edges).toHaveLength(2);
  });

  it('respects maxDepth bound', async () => {
    // Chain: A → B → C → D
    await store.putEntities([entity('A'), entity('B'), entity('C'), entity('D')]);
    await store.putFact(fact('f1', 'A', 'knows', 'B'));
    await store.putFact(fact('f2', 'B', 'knows', 'C'));
    await store.putFact(fact('f3', 'C', 'knows', 'D'));

    const r2 = await genericTraverse(
      store,
      'A',
      { direction: 'out', maxDepth: 2 },
      global,
    );
    expect(r2.nodes.map((n) => n.entity.id).sort()).toEqual(['A', 'B', 'C']);

    const r3 = await genericTraverse(
      store,
      'A',
      { direction: 'out', maxDepth: 3 },
      global,
    );
    expect(r3.nodes.map((n) => n.entity.id).sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('respects limit on nodes returned', async () => {
    await store.putEntities([entity('A'), entity('B'), entity('C'), entity('D')]);
    await store.putFact(fact('f1', 'A', 'knows', 'B'));
    await store.putFact(fact('f2', 'A', 'knows', 'C'));
    await store.putFact(fact('f3', 'A', 'knows', 'D'));

    const result = await genericTraverse(
      store,
      'A',
      { direction: 'out', maxDepth: 1, limit: 2 },
      global,
    );
    expect(result.nodes.length).toBeLessThanOrEqual(2);
  });

  it('filters edges by predicate', async () => {
    await store.putEntities([entity('A'), entity('B'), entity('C')]);
    await store.putFact(fact('f1', 'A', 'works_at', 'B'));
    await store.putFact(fact('f2', 'A', 'knows', 'C'));

    const result = await genericTraverse(
      store,
      'A',
      { direction: 'out', maxDepth: 1, predicates: ['works_at'] },
      global,
    );
    expect(result.nodes.map((n) => n.entity.id).sort()).toEqual(['A', 'B']);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.fact.predicate).toBe('works_at');
  });

  it('visits each node once even with cycles', async () => {
    await store.putEntities([entity('A'), entity('B')]);
    await store.putFact(fact('f1', 'A', 'knows', 'B'));
    await store.putFact(fact('f2', 'B', 'knows', 'A'));

    const result = await genericTraverse(
      store,
      'A',
      { direction: 'both', maxDepth: 5 },
      global,
    );
    // Each node visited once in `nodes`; edges may appear once per direction hit.
    const ids = result.nodes.map((n) => n.entity.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it('skips archived facts in traversal', async () => {
    await store.putEntities([entity('A'), entity('B')]);
    await store.putFact(fact('f1', 'A', 'works_at', 'B', { archived: true }));

    const result = await genericTraverse(
      store,
      'A',
      { direction: 'out', maxDepth: 1 },
      global,
    );
    expect(result.nodes).toHaveLength(1); // only A
    expect(result.edges).toHaveLength(0);
  });

  it('respects asOf on edges via validFrom/validUntil', async () => {
    const yesterday = new Date('2026-04-16');
    const today = new Date('2026-04-17');
    const tomorrow = new Date('2026-04-18');

    await store.putEntities([entity('A'), entity('B')]);
    await store.putFact(
      fact('f1', 'A', 'works_at', 'B', {
        validFrom: tomorrow,
      }),
    );

    const result = await genericTraverse(
      store,
      'A',
      { direction: 'out', maxDepth: 1, asOf: today },
      global,
    );
    // Fact not yet valid as of today → edge absent.
    expect(result.edges).toHaveLength(0);

    const resultLater = await genericTraverse(
      store,
      'A',
      { direction: 'out', maxDepth: 1, asOf: tomorrow },
      global,
    );
    expect(resultLater.edges).toHaveLength(1);

    // Suppress unused var warning
    expect(yesterday).toBeDefined();
  });

  it('enforces scope — invisible neighbors excluded', async () => {
    await store.putEntity({ ...entity('A'), groupId: 'g1' });
    await store.putEntity({ ...entity('B'), groupId: 'g2' });
    // A fact from a caller in g1 cannot reach B in g2.
    await store.putFact({ ...fact('f1', 'A', 'knows', 'B'), groupId: 'g1' });

    const result = await genericTraverse(
      store,
      'A',
      { direction: 'out', maxDepth: 1 },
      { groupId: 'g1' },
    );
    // Edge's object B is in g2; getEntity returns null, so B is not added to nodes.
    expect(result.nodes.map((n) => n.entity.id)).toEqual(['A']);
  });
});
