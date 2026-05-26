/**
 * Phase A — Commit 2 tests.
 *
 * Verifies EntityResolver Tier 2/3 uses the indexed `findEntitiesByNormalizedName`
 * lookup instead of the legacy substring-then-filter path. The headline check
 * is the brief's bug-B repro: 1 bare entity + 600 substring-prefix siblings,
 * the resolver still surfaces the bare entity at confidence ≥ 0.90.
 *
 * Confidence levels remain unchanged at this commit (still 0.90 displayName /
 * 0.85 alias). Commit 4 makes them configurable.
 */

import { describe, it, expect } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';

const SCOPE = { userId: 'u1' } as const;

function makeMem(): MemorySystem {
  return new MemorySystem({ store: new InMemoryAdapter() });
}

describe('EntityResolver Tier 2/3 indexed lookup', () => {
  it('Tier 2: exact displayName match returns confidence 0.90', async () => {
    const mem = makeMem();
    await mem.upsertEntity(
      { type: 'organization', displayName: 'Microsoft', identifiers: [] },
      SCOPE,
    );
    const candidates = await mem.resolveEntity(
      { surface: 'Microsoft', type: 'organization' },
      SCOPE,
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.confidence).toBe(0.9);
    expect(candidates[0]!.matchedOn).toBe('displayName');
  });

  it('Tier 3: exact alias match returns confidence 0.85', async () => {
    const mem = makeMem();
    await mem.upsertEntity(
      {
        type: 'organization',
        displayName: 'Microsoft',
        aliases: ['MSFT'],
        identifiers: [],
      },
      SCOPE,
    );
    const candidates = await mem.resolveEntity(
      { surface: 'MSFT', type: 'organization' },
      SCOPE,
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.confidence).toBe(0.85);
    expect(candidates[0]!.matchedOn).toBe('alias');
  });

  it('handles corp-suffix normalization (Microsoft Inc. vs Microsoft)', async () => {
    const mem = makeMem();
    await mem.upsertEntity(
      { type: 'organization', displayName: 'Microsoft', identifiers: [] },
      SCOPE,
    );
    const candidates = await mem.resolveEntity(
      { surface: 'Microsoft Inc.', type: 'organization' },
      SCOPE,
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.matchedOn).toBe('displayName');
  });

  it('bug-B repro: 1 bare entity + 600 substring-prefix siblings — bare resolves', async () => {
    const mem = makeMem();
    const bare = await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    for (let i = 0; i < 600; i++) {
      await mem.upsertEntity(
        { type: 'project', displayName: `ICOS prefix ${i}`, identifiers: [] },
        SCOPE,
      );
    }
    const candidates = await mem.resolveEntity(
      { surface: 'ICOS', type: 'project' },
      SCOPE,
    );
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.entity.id).toBe(bare.entity.id);
    expect(candidates[0]!.confidence).toBe(0.9);
  }, 30_000);

  it('skips Tier 2/3 entirely when surface is empty', async () => {
    const mem = makeMem();
    await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    const candidates = await mem.resolveEntity(
      { surface: '', type: 'project' },
      SCOPE,
    );
    expect(candidates).toEqual([]);
  });

  it('skips Tier 2/3 when surface normalizes to empty (pure punctuation)', async () => {
    const mem = makeMem();
    await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    const candidates = await mem.resolveEntity(
      { surface: '!!!', type: 'project' },
      SCOPE,
    );
    expect(candidates).toEqual([]);
  });

  it('type-less query (no query.type) still resolves via the index — preserves resolveEntity({surface}) contract', async () => {
    const mem = makeMem();
    const ent = await mem.upsertEntity(
      { type: 'person', displayName: 'Bob Smith', identifiers: [] },
      SCOPE,
    );
    const candidates = await mem.resolveEntity(
      { surface: 'Bob Smith' },
      SCOPE,
    );
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.entity.id).toBe(ent.entity.id);
    expect(candidates[0]!.confidence).toBe(0.9);
  });

  it('legacy entities (no normalizedDisplayName) are skipped (needs backfill)', async () => {
    const store = new InMemoryAdapter();
    const mem = new MemorySystem({ store });
    const r = await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    // Simulate pre-0.8.0 stored data by stripping the field. The adapter
    // recomputes on every write so any update would re-stamp; we mutate the
    // raw map directly here to model "legacy data that hasn't been touched
    // since upgrade".
    const raw = (store as unknown as {
      entitiesById: Map<string, { normalizedDisplayName?: string }>;
    }).entitiesById.get(r.entity.id);
    if (raw) delete raw.normalizedDisplayName;
    const candidates = await mem.resolveEntity(
      { surface: 'ICOS', type: 'project' },
      SCOPE,
    );
    expect(candidates).toEqual([]);
  });
});
