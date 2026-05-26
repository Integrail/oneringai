/**
 * Phase A — Commit 5 tests.
 *
 * Verifies the bare-form `upsertEntity` (no identifiers OR no identifier
 * matches) falls through to the normalized-name path. Counterpart to
 * `tryAtomicCreateOrResolve` exercised via `upsertEntityBySurface` in
 * Commit 3.
 *
 * Behavior change: prior to 0.8.0, two `upsertEntity({displayName:'X',
 * identifiers:[]})` calls produced two rows. Now they converge.
 *
 * Carve-out: callers that DO provide identifiers (even if none match a
 * stored row) still get the historical behavior — identifiers are
 * authoritative, the caller is expressing a distinct entity.
 */

import { describe, it, expect, vi } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { ChangeEvent } from '@/memory/types.js';

const SCOPE = { userId: 'u1' } as const;

function makeMem(opts?: { onChange?: (e: ChangeEvent) => void }) {
  const store = new InMemoryAdapter();
  const mem = new MemorySystem({ store, onChange: opts?.onChange });
  return { mem, store };
}

describe('upsertEntity bare form (no identifiers) — normalized-name dedup (Commit 5)', () => {
  it('two bare upsertEntity calls with same displayName converge', async () => {
    const { mem } = makeMem();
    const a = await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    const b = await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    expect(a.entity.id).toBe(b.entity.id);
  });

  it('concurrent bare upsertEntity converges via atomic primitive', async () => {
    const { mem } = makeMem();
    const results = await Promise.all([
      mem.upsertEntity(
        { type: 'project', displayName: 'Pavel', identifiers: [] },
        SCOPE,
      ),
      mem.upsertEntity(
        { type: 'project', displayName: 'Pavel', identifiers: [] },
        SCOPE,
      ),
      mem.upsertEntity(
        { type: 'project', displayName: 'Pavel', identifiers: [] },
        SCOPE,
      ),
    ]);
    const ids = new Set(results.map((r) => r.entity.id));
    expect(ids.size).toBe(1);
  });

  it('CARVE-OUT: caller-supplied identifiers preserve distinct-entity semantics', async () => {
    const { mem } = makeMem();
    // Two people both named "Test", different emails. Identifiers DO NOT
    // match (a@x vs b@x), so the caller is asserting "distinct entities,
    // sharing a displayName". Commit 5 must NOT merge them.
    const a = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Test',
        identifiers: [{ kind: 'email', value: 'a@x.com' }],
      },
      SCOPE,
    );
    const b = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Test',
        identifiers: [{ kind: 'email', value: 'b@x.com' }],
      },
      SCOPE,
    );
    expect(a.entity.id).not.toBe(b.entity.id);
  });

  it('subsequent bare upsertEntity merges aliases onto winner', async () => {
    const { mem } = makeMem();
    const a = await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'Acme',
        aliases: ['Acme Corp'],
        identifiers: [],
      },
      SCOPE,
    );
    const b = await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'Acme',
        aliases: ['Acme Industries'],
        identifiers: [],
      },
      SCOPE,
    );
    expect(b.entity.id).toBe(a.entity.id);
    const winner = await mem.getEntity(a.entity.id, SCOPE);
    const aliases = new Set(winner?.aliases ?? []);
    expect(aliases.has('Acme Corp')).toBe(true);
    expect(aliases.has('Acme Industries')).toBe(true);
  });

  it('pure-punctuation displayName falls through to plain createEntity (no normalized form)', async () => {
    const { mem } = makeMem();
    const a = await mem.upsertEntity(
      { type: 'project', displayName: '!!!', identifiers: [] },
      SCOPE,
    );
    const b = await mem.upsertEntity(
      { type: 'project', displayName: '!!!', identifiers: [] },
      SCOPE,
    );
    expect(a.entity.id).not.toBe(b.entity.id);
  });

  it('emits entity.upsert.ambiguous when legacy data has multiple matches', async () => {
    const events: ChangeEvent[] = [];
    const { mem, store } = makeMem({ onChange: (e) => events.push(e) });
    // Seed two pre-existing dups via the adapter directly (legacy data
    // signature — same normalized displayName, no identifiers).
    await store.createEntity({
      type: 'project',
      displayName: 'ICOS',
      identifiers: [],
      ownerId: 'u1',
    });
    await store.createEntity({
      type: 'project',
      displayName: 'ICOS Inc.',
      identifiers: [],
      ownerId: 'u1',
    });
    // Both rows have normalizedDisplayName === 'icos'. A bare upsert now
    // sees TWO matches → emits ambiguous event + creates a NEW row (does
    // NOT arbitrarily merge into either pre-existing dup).
    events.length = 0;
    const r = await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    expect(r.created).toBe(true);
    const ambiguous = events.find((e) => e.type === 'entity.upsert.ambiguous');
    expect(ambiguous).toBeDefined();
    if (ambiguous && ambiguous.type === 'entity.upsert.ambiguous') {
      expect(ambiguous.normalizedDisplayName).toBe('icos');
      expect(ambiguous.candidates.length).toBe(2);
      expect(ambiguous.createdId).toBe(r.entity.id);
    }
  });
});
