/**
 * MemorySystem.listEntities — read-side ISO-string coercion at the public
 * boundary. LLM tools (notably `memory_find_entity`) pass `metadataFilter`
 * values as JSON-friendly ISO-8601 strings. Without coercion, range queries
 * against Date-typed metadata fields (`startTime`, `dueAt`, `endTime`, etc.)
 * silently return zero rows because Mongo and the InMemory comparator treat
 * String and Date as distinct types.
 *
 * Coercion lives in `MemorySystem.listEntities` so it applies uniformly across
 * every adapter (InMemory, Mongo, future ones) — DRY, single point of
 * responsibility. These tests exercise the boundary against the InMemory
 * adapter; the Mongo adapter inherits the same behavior because it receives
 * the already-coerced filter.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { ScopeFilter } from '@/memory/types.js';

const scope: ScopeFilter = { userId: 'user-1' };

describe('MemorySystem.listEntities — ISO-string coercion (read boundary)', () => {
  let mem: MemorySystem;

  beforeEach(async () => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
    // Seed four tasks with Date-typed dueAt spaced across April 2026.
    // Use UTC to make ISO-string ranges reason about cleanly in tests.
    const seeds = [
      { name: 'T-low', dueAt: new Date('2026-04-01T00:00:00Z'), state: 'pending', priority: 1 },
      { name: 'T-midA', dueAt: new Date('2026-04-03T00:00:00Z'), state: 'pending', priority: 3 },
      { name: 'T-midB', dueAt: new Date('2026-04-05T00:00:00Z'), state: 'in_progress', priority: 4 },
      { name: 'T-high', dueAt: new Date('2026-04-07T00:00:00Z'), state: 'pending', priority: 7 },
    ];
    for (const s of seeds) {
      await mem.upsertEntity(
        {
          type: 'task',
          displayName: s.name,
          identifiers: [{ kind: 'canonical', value: `task:${s.name.toLowerCase()}` }],
          metadata: { dueAt: s.dueAt, state: s.state, priority: s.priority },
        },
        scope,
      );
    }
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('coerces ISO-string $lt against Date-typed metadata.dueAt', async () => {
    const page = await mem.listEntities(
      { type: 'task', metadataFilter: { dueAt: { $lt: '2026-04-04T00:00:00Z' } } },
      {},
      scope,
    );
    expect(page.items.map((e) => e.displayName).sort()).toEqual(['T-low', 'T-midA']);
  });

  it('coerces ISO-string $gte + $lt half-open range', async () => {
    const page = await mem.listEntities(
      {
        type: 'task',
        metadataFilter: {
          dueAt: { $gte: '2026-04-02T00:00:00Z', $lt: '2026-04-06T00:00:00Z' },
        },
      },
      {},
      scope,
    );
    expect(page.items.map((e) => e.displayName).sort()).toEqual(['T-midA', 'T-midB']);
  });

  it('coerces ISO strings inside $in arrays (Date-typed enum)', async () => {
    // $in against a Date metadata field: every element should be coerced.
    const page = await mem.listEntities(
      {
        type: 'task',
        metadataFilter: {
          dueAt: { $in: ['2026-04-01T00:00:00Z', '2026-04-07T00:00:00Z'] },
        },
      },
      {},
      scope,
    );
    expect(page.items.map((e) => e.displayName).sort()).toEqual(['T-high', 'T-low']);
  });

  it('leaves literal string scalars untouched (state stays a string match)', async () => {
    // `state` is a string field; ISO regex doesn't match "pending", so coercion
    // is a no-op here. Equality filter must still find the pending rows.
    const page = await mem.listEntities(
      { type: 'task', metadataFilter: { state: 'pending' } },
      {},
      scope,
    );
    expect(page.items.map((e) => e.displayName).sort()).toEqual(['T-high', 'T-low', 'T-midA']);
  });

  it('Date values pass through unchanged (caller already coerced)', async () => {
    const page = await mem.listEntities(
      { type: 'task', metadataFilter: { dueAt: { $lt: new Date('2026-04-04T00:00:00Z') } } },
      {},
      scope,
    );
    expect(page.items.map((e) => e.displayName).sort()).toEqual(['T-low', 'T-midA']);
  });

  it('orderBy on Date-typed metadata path still ranks correctly with ISO-string filter', async () => {
    const page = await mem.listEntities(
      {
        type: 'task',
        metadataFilter: { dueAt: { $gte: '2026-04-02T00:00:00Z' } },
      },
      { orderBy: [{ field: 'metadata.dueAt', direction: 'asc' }] },
      scope,
    );
    expect(page.items.map((e) => e.displayName)).toEqual(['T-midA', 'T-midB', 'T-high']);
  });

  it('does not mutate the caller-supplied filter object', async () => {
    const filter = { type: 'task', metadataFilter: { dueAt: { $lt: '2026-04-04T00:00:00Z' } } };
    const original = JSON.parse(JSON.stringify(filter));
    await mem.listEntities(filter, {}, scope);
    expect(JSON.parse(JSON.stringify(filter))).toEqual(original);
  });
});
