/**
 * Unit tests for memory/GenericTraversal.ts — BFS fallback over IMemoryStore.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { genericTraverse } from '@/memory/GenericTraversal.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { IEntity, NewEntity, NewFact, ScopeFilter } from '@/memory/types.js';

function entityInput(name: string, overrides: Partial<NewEntity> = {}): NewEntity {
  return {
    type: overrides.type ?? 'person',
    displayName: name,
    identifiers: [],
    groupId: overrides.groupId,
    ownerId: overrides.ownerId,
    permissions: overrides.permissions,
  };
}

function factInput(
  subjectId: string,
  predicate: string,
  objectId: string,
  overrides: Partial<NewFact> = {},
): NewFact {
  const now = new Date();
  return {
    subjectId,
    objectId,
    predicate,
    kind: 'atomic',
    observedAt: overrides.observedAt ?? now,
    archived: overrides.archived,
    validFrom: overrides.validFrom,
    validUntil: overrides.validUntil,
    groupId: overrides.groupId,
    ownerId: overrides.ownerId,
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
    const a = await store.createEntity(entityInput('A'));
    const b = await store.createEntity(entityInput('B'));
    await store.createFact(factInput(a.id, 'works_with', b.id));

    const result = await genericTraverse(
      store,
      a.id,
      { direction: 'both', maxDepth: 0 },
      global,
    );
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.entity.id).toBe(a.id);
    expect(result.edges).toHaveLength(0);
  });

  it('direction=out walks subject → object', async () => {
    const a = await store.createEntity(entityInput('A'));
    const b = await store.createEntity(entityInput('B'));
    await store.createFact(factInput(a.id, 'works_at', b.id));

    const result = await genericTraverse(
      store,
      a.id,
      { direction: 'out', maxDepth: 1 },
      global,
    );
    expect(result.nodes.map((n) => n.entity.id).sort()).toEqual([a.id, b.id].sort());
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.from).toBe(a.id);
    expect(result.edges[0]!.to).toBe(b.id);
  });

  it('direction=in walks object → subject (reverse edges)', async () => {
    const a = await store.createEntity(entityInput('A'));
    const b = await store.createEntity(entityInput('B'));
    await store.createFact(factInput(a.id, 'works_at', b.id));

    const result = await genericTraverse(
      store,
      b.id,
      { direction: 'in', maxDepth: 1 },
      global,
    );
    expect(result.nodes.map((n) => n.entity.id).sort()).toEqual([a.id, b.id].sort());
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.from).toBe(a.id);
  });

  it('direction=both walks both ways', async () => {
    const a = await store.createEntity(entityInput('A'));
    const b = await store.createEntity(entityInput('B'));
    const c = await store.createEntity(entityInput('C'));
    await store.createFact(factInput(a.id, 'works_at', b.id));
    await store.createFact(factInput(c.id, 'manages', a.id));

    const result = await genericTraverse(
      store,
      a.id,
      { direction: 'both', maxDepth: 1 },
      global,
    );
    expect(result.nodes.map((n) => n.entity.id).sort()).toEqual([a.id, b.id, c.id].sort());
    expect(result.edges).toHaveLength(2);
  });

  it('respects maxDepth bound', async () => {
    const a = await store.createEntity(entityInput('A'));
    const b = await store.createEntity(entityInput('B'));
    const c = await store.createEntity(entityInput('C'));
    const d = await store.createEntity(entityInput('D'));
    await store.createFact(factInput(a.id, 'knows', b.id));
    await store.createFact(factInput(b.id, 'knows', c.id));
    await store.createFact(factInput(c.id, 'knows', d.id));

    const r2 = await genericTraverse(store, a.id, { direction: 'out', maxDepth: 2 }, global);
    expect(r2.nodes.map((n) => n.entity.id).sort()).toEqual([a.id, b.id, c.id].sort());

    const r3 = await genericTraverse(store, a.id, { direction: 'out', maxDepth: 3 }, global);
    expect(r3.nodes.map((n) => n.entity.id).sort()).toEqual([a.id, b.id, c.id, d.id].sort());
  });

  it('respects limit on nodes returned', async () => {
    const a = await store.createEntity(entityInput('A'));
    const b = await store.createEntity(entityInput('B'));
    const c = await store.createEntity(entityInput('C'));
    const d = await store.createEntity(entityInput('D'));
    await store.createFact(factInput(a.id, 'knows', b.id));
    await store.createFact(factInput(a.id, 'knows', c.id));
    await store.createFact(factInput(a.id, 'knows', d.id));

    const result = await genericTraverse(
      store,
      a.id,
      { direction: 'out', maxDepth: 1, limit: 2 },
      global,
    );
    expect(result.nodes.length).toBeLessThanOrEqual(2);
  });

  it('filters edges by predicate', async () => {
    const a = await store.createEntity(entityInput('A'));
    const b = await store.createEntity(entityInput('B'));
    const c = await store.createEntity(entityInput('C'));
    await store.createFact(factInput(a.id, 'works_at', b.id));
    await store.createFact(factInput(a.id, 'knows', c.id));

    const result = await genericTraverse(
      store,
      a.id,
      { direction: 'out', maxDepth: 1, predicates: ['works_at'] },
      global,
    );
    expect(result.nodes.map((n) => n.entity.id).sort()).toEqual([a.id, b.id].sort());
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.fact.predicate).toBe('works_at');
  });

  it('visits each node once even with cycles', async () => {
    const a = await store.createEntity(entityInput('A'));
    const b = await store.createEntity(entityInput('B'));
    await store.createFact(factInput(a.id, 'knows', b.id));
    await store.createFact(factInput(b.id, 'knows', a.id));

    const result = await genericTraverse(
      store,
      a.id,
      { direction: 'both', maxDepth: 5 },
      global,
    );
    const ids = result.nodes.map((n) => n.entity.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it('skips archived facts in traversal', async () => {
    const a = await store.createEntity(entityInput('A'));
    const b = await store.createEntity(entityInput('B'));
    await store.createFact(factInput(a.id, 'works_at', b.id, { archived: true }));

    const result = await genericTraverse(
      store,
      a.id,
      { direction: 'out', maxDepth: 1 },
      global,
    );
    expect(result.nodes).toHaveLength(1); // only A
    expect(result.edges).toHaveLength(0);
  });

  it('respects asOf on edges via validFrom/validUntil', async () => {
    const today = new Date('2026-04-17');
    const tomorrow = new Date('2026-04-18');
    const farFuture = new Date(Date.now() + 100 * 86_400_000);

    const a = await store.createEntity(entityInput('A'));
    const b = await store.createEntity(entityInput('B'));
    await store.createFact(
      factInput(a.id, 'works_at', b.id, { validFrom: tomorrow }),
    );

    const result = await genericTraverse(
      store,
      a.id,
      { direction: 'out', maxDepth: 1, asOf: today },
      global,
    );
    expect(result.edges).toHaveLength(0);

    const later = await genericTraverse(
      store,
      a.id,
      { direction: 'out', maxDepth: 1, asOf: farFuture },
      global,
    );
    expect(later.edges).toHaveLength(1);
  });

  it('enforces scope — invisible neighbors excluded', async () => {
    const a = await store.createEntity(entityInput('A', { groupId: 'g1' }));
    const b = await store.createEntity(
      entityInput('B', { groupId: 'g2', permissions: { world: 'none' } }),
    );
    await store.createFact({
      ...factInput(a.id, 'knows', b.id),
      groupId: 'g1',
    });

    const result = await genericTraverse(
      store,
      a.id,
      { direction: 'out', maxDepth: 1 },
      { groupId: 'g1' },
    );
    // b is in g2, invisible to g1 caller
    expect(result.nodes.map((n) => n.entity.id)).toEqual([a.id]);
  });
});
