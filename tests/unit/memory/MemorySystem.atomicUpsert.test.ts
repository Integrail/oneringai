/**
 * Phase A — Commit 3 tests.
 *
 * Verifies that `MemorySystem.upsertEntityBySurface` converges concurrent
 * inserts of the same surface form via the atomic primitive
 * `IMemoryStore.atomicCreateOrFindByNormalizedName`. Also exercises the
 * race-loss-merge path: when a second writer's normalized name matches an
 * already-inserted entity, the second writer's aliases/identifiers/metadata
 * accumulate onto the winner.
 *
 * InMemory only — the Mongo equivalent lives in the integration test under
 * the same name. The atomic guarantee depends on (a) JS event-loop semantics
 * for InMemory, (b) a unique partial index on Mongo (`ensureNormalizedNameUniqueIndex`).
 */

import { describe, it, expect } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';

const SCOPE = { userId: 'u1' } as const;

function makeMem(): { mem: MemorySystem; store: InMemoryAdapter } {
  const store = new InMemoryAdapter();
  const mem = new MemorySystem({ store });
  return { mem, store };
}

describe('atomicCreateOrFindByNormalizedName — adapter contract', () => {
  it('first call inserts; second call with the same normalized name returns the existing entity', async () => {
    const { store } = makeMem();
    const first = await store.atomicCreateOrFindByNormalizedName(
      { type: 'project', displayName: 'ICOS', identifiers: [], ownerId: 'u1' },
      SCOPE,
    );
    const second = await store.atomicCreateOrFindByNormalizedName(
      { type: 'project', displayName: 'ICOS', identifiers: [], ownerId: 'u1' },
      SCOPE,
    );
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.entity.id).toBe(first.entity.id);
  });

  it('returns existing match even when displayName casing / corp suffix differs (normalized form same)', async () => {
    const { store } = makeMem();
    const first = await store.atomicCreateOrFindByNormalizedName(
      { type: 'project', displayName: 'ICOS Inc.', identifiers: [], ownerId: 'u1' },
      SCOPE,
    );
    const second = await store.atomicCreateOrFindByNormalizedName(
      { type: 'project', displayName: 'icos', identifiers: [], ownerId: 'u1' },
      SCOPE,
    );
    expect(second.created).toBe(false);
    expect(second.entity.id).toBe(first.entity.id);
  });

  it('different types do not collide', async () => {
    const { store } = makeMem();
    const a = await store.atomicCreateOrFindByNormalizedName(
      { type: 'project', displayName: 'ICOS', identifiers: [], ownerId: 'u1' },
      SCOPE,
    );
    const b = await store.atomicCreateOrFindByNormalizedName(
      { type: 'topic', displayName: 'ICOS', identifiers: [], ownerId: 'u1' },
      SCOPE,
    );
    expect(a.created).toBe(true);
    expect(b.created).toBe(true);
    expect(a.entity.id).not.toBe(b.entity.id);
  });

  it('different scopes do not collide (different group)', async () => {
    const { store } = makeMem();
    await store.atomicCreateOrFindByNormalizedName(
      {
        type: 'project',
        displayName: 'ICOS',
        identifiers: [],
        groupId: 'g1',
        ownerId: 'u1',
        permissions: { world: 'none' },
      },
      { groupId: 'g1', userId: 'u1' },
    );
    const b = await store.atomicCreateOrFindByNormalizedName(
      {
        type: 'project',
        displayName: 'ICOS',
        identifiers: [],
        groupId: 'g2',
        ownerId: 'u2',
        permissions: { world: 'none' },
      },
      { groupId: 'g2', userId: 'u2' },
    );
    expect(b.created).toBe(true);
  });

  it('empty normalized form (pure punctuation displayName) falls back to plain create', async () => {
    const { store } = makeMem();
    const a = await store.atomicCreateOrFindByNormalizedName(
      { type: 'project', displayName: '!!!', identifiers: [], ownerId: 'u1' },
      SCOPE,
    );
    const b = await store.atomicCreateOrFindByNormalizedName(
      { type: 'project', displayName: '!!!', identifiers: [], ownerId: 'u1' },
      SCOPE,
    );
    expect(a.created).toBe(true);
    expect(b.created).toBe(true);
    expect(a.entity.id).not.toBe(b.entity.id);
  });
});

describe('upsertEntityBySurface — concurrency convergence', () => {
  it('Promise.all of 2 concurrent upserts → 1 entity', async () => {
    const { mem } = makeMem();
    const [a, b] = await Promise.all([
      mem.upsertEntityBySurface(
        { surface: 'ICOS', type: 'project', identifiers: [] },
        SCOPE,
      ),
      mem.upsertEntityBySurface(
        { surface: 'ICOS', type: 'project', identifiers: [] },
        SCOPE,
      ),
    ]);
    expect(a.entity.id).toBe(b.entity.id);
    const page = await mem.listEntities({ type: 'project' }, {}, SCOPE);
    expect(page.items.length).toBe(1);
  });

  it('Promise.all of 20 concurrent upserts → 1 entity', async () => {
    const { mem } = makeMem();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        mem.upsertEntityBySurface(
          { surface: 'Pavel', type: 'person', identifiers: [] },
          SCOPE,
        ),
      ),
    );
    const ids = new Set(results.map((r) => r.entity.id));
    expect(ids.size).toBe(1);
    const page = await mem.listEntities({ type: 'person' }, {}, SCOPE);
    expect(page.items.length).toBe(1);
  });

  it('race-loss merges aliases onto the winner (union of seen surfaces)', async () => {
    const { mem } = makeMem();
    // Both calls normalize to "icos" (corp suffix stripped + lowercased).
    // Whichever fires first becomes the winner; the other's surface enters
    // as an alias on the winner.
    const [a, b] = await Promise.all([
      mem.upsertEntityBySurface(
        { surface: 'ICOS', type: 'project', identifiers: [] },
        SCOPE,
      ),
      mem.upsertEntityBySurface(
        { surface: 'ICOS Inc.', type: 'project', identifiers: [] },
        SCOPE,
      ),
    ]);
    expect(a.entity.id).toBe(b.entity.id);
    // Fetch the winner — should have BOTH surfaces represented (one as
    // displayName, the other in aliases). Order is determined by which
    // microtask landed first.
    const winner = await mem.getEntity(a.entity.id, SCOPE);
    expect(winner).not.toBeNull();
    const seen = new Set([
      winner!.displayName.toLowerCase(),
      ...(winner!.aliases ?? []).map((x) => x.toLowerCase()),
    ]);
    expect(seen.has('icos')).toBe(true);
    expect(seen.has('icos inc.')).toBe(true);
  });

  it('race-loss merges identifiers onto the winner (additive, no overwrite)', async () => {
    const { mem } = makeMem();
    const [a, b] = await Promise.all([
      mem.upsertEntityBySurface(
        {
          surface: 'Acme',
          type: 'organization',
          identifiers: [{ kind: 'domain', value: 'acme.com' }],
        },
        SCOPE,
      ),
      mem.upsertEntityBySurface(
        {
          surface: 'Acme',
          type: 'organization',
          identifiers: [{ kind: 'ticker', value: 'ACME' }],
        },
        SCOPE,
      ),
    ]);
    expect(a.entity.id).toBe(b.entity.id);
    const winner = await mem.getEntity(a.entity.id, SCOPE);
    const kinds = (winner?.identifiers ?? []).map((i) => i.kind).sort();
    expect(kinds).toEqual(['domain', 'ticker']);
  });

  it('race-loss applies fillMissing metadata merge by default (existing values preserved)', async () => {
    const { mem } = makeMem();
    const [a, b] = await Promise.all([
      mem.upsertEntityBySurface(
        {
          surface: 'budget',
          type: 'task',
          identifiers: [],
          metadata: { state: 'pending', priority: 'high' },
        },
        SCOPE,
      ),
      mem.upsertEntityBySurface(
        {
          surface: 'budget',
          type: 'task',
          identifiers: [],
          metadata: { state: 'done', dueAt: new Date('2026-06-01') },
        },
        SCOPE,
      ),
    ]);
    expect(a.entity.id).toBe(b.entity.id);
    const winner = await mem.getEntity(a.entity.id, SCOPE);
    const meta = (winner?.metadata ?? {}) as Record<string, unknown>;
    // fillMissing: the loser's `state: 'done'` does NOT overwrite the
    // winner's `state: 'pending'`. The loser's `dueAt` (absent on winner)
    // fills in. The winner's `priority` survives.
    expect(meta.state).toBe('pending');
    expect(meta.priority).toBe('high');
    expect(meta.dueAt).toBeInstanceOf(Date);
  });
});
