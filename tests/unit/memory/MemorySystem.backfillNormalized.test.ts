/**
 * Phase A — Commit 6 tests.
 *
 * Verifies `MemorySystem.backfillNormalizedFields` populates pre-0.8.0
 * legacy entities (missing the normalized fields) without disturbing
 * entities that are already up-to-date.
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

/** Strip the normalized fields from a stored entity (simulates legacy data). */
function makeLegacy(store: InMemoryAdapter, id: string): void {
  const raw = (store as unknown as {
    entitiesById: Map<string, { normalizedDisplayName?: string; normalizedAliases?: string[] }>;
  }).entitiesById.get(id);
  if (raw) {
    delete raw.normalizedDisplayName;
    delete raw.normalizedAliases;
  }
}

describe('backfillNormalizedFields', () => {
  it('populates entities missing the normalized fields', async () => {
    const { mem, store } = makeMem();
    const a = await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'ICOS Inc.',
        aliases: ['ICOS', 'ICOS Corp'],
        identifiers: [],
      },
      SCOPE,
    );
    const b = await mem.upsertEntity(
      { type: 'topic', displayName: 'Q3 plan', identifiers: [] },
      SCOPE,
    );
    makeLegacy(store, a.entity.id);
    makeLegacy(store, b.entity.id);

    const result = await mem.backfillNormalizedFields(SCOPE);
    expect(result.scanned).toBeGreaterThanOrEqual(2);
    expect(result.updated).toBeGreaterThanOrEqual(2);

    const aAfter = await store.getEntity(a.entity.id, SCOPE);
    const bAfter = await store.getEntity(b.entity.id, SCOPE);
    expect(aAfter?.normalizedDisplayName).toBe('icos');
    expect(aAfter?.normalizedAliases).toEqual(['icos']);
    expect(bAfter?.normalizedDisplayName).toBe('q3 plan');
  });

  it('idempotent — re-run is all skipped', async () => {
    const { mem, store } = makeMem();
    const e = await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    makeLegacy(store, e.entity.id);
    const first = await mem.backfillNormalizedFields(SCOPE);
    expect(first.updated).toBe(1);
    const second = await mem.backfillNormalizedFields(SCOPE);
    expect(second.updated).toBe(0);
    expect(second.skipped).toBe(1);
  });

  it('force: true rewrites entities even when current value already matches', async () => {
    const { mem } = makeMem();
    await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    // First call without force — no work needed.
    const noForce = await mem.backfillNormalizedFields(SCOPE);
    expect(noForce.updated).toBe(0);
    expect(noForce.skipped).toBe(1);
    // Force rewrites regardless.
    const forced = await mem.backfillNormalizedFields(SCOPE, { force: true });
    expect(forced.updated).toBe(1);
    expect(forced.skipped).toBe(0);
  });

  it('respects scope visibility — does not touch entities in other groups', async () => {
    const { mem, store } = makeMem();
    const visible = await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'ICOS',
        identifiers: [],
        groupId: 'g1',
        permissions: { world: 'none' },
      },
      { groupId: 'g1', userId: 'u1' },
    );
    const hidden = await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'ICOS',
        identifiers: [],
        groupId: 'g2',
        permissions: { world: 'none' },
        ownerId: 'u2',
      },
      { groupId: 'g2', userId: 'u2' },
    );
    makeLegacy(store, visible.entity.id);
    makeLegacy(store, hidden.entity.id);

    const result = await mem.backfillNormalizedFields({ groupId: 'g1', userId: 'u1' });
    // Only g1's entity was scanned + backfilled.
    expect(result.updated).toBe(1);

    // Raw map probe: g2's entity should still be missing the field.
    const hiddenAfter = (store as unknown as {
      entitiesById: Map<string, { normalizedDisplayName?: string }>;
    }).entitiesById.get(hidden.entity.id);
    expect(hiddenAfter?.normalizedDisplayName).toBeUndefined();
  });

  it('paginates — batchSize 2 over 5 entities processes them all', async () => {
    const { mem, store } = makeMem();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await mem.upsertEntity(
        { type: 'project', displayName: `Entity ${i}`, identifiers: [] },
        SCOPE,
      );
      ids.push(r.entity.id);
      makeLegacy(store, r.entity.id);
    }
    const result = await mem.backfillNormalizedFields(SCOPE, { batchSize: 2 });
    expect(result.scanned).toBe(5);
    expect(result.updated).toBe(5);
  });
});
