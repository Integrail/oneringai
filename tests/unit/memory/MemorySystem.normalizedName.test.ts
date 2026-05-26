/**
 * Phase A — Commit 1 tests.
 *
 * Verifies:
 *   - createEntity / updateEntity stamp `normalizedDisplayName` +
 *     `normalizedAliases` from the entity's displayName + aliases.
 *   - mergeEntities and appendAliasesAndIdentifiers (via upsertEntityBySurface
 *     alias accumulation) recompute the normalized fields.
 *   - findEntitiesByNormalizedName returns exact matches under the documented
 *     contract (matchAliases default off; matchAliases=true expands to alias
 *     hits; legacy entities lacking the field are skipped).
 */

import { describe, it, expect } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import { computeNormalizedFields } from '@/memory/normalize.js';

const SCOPE = { userId: 'u1' } as const;

function makeMem(): { mem: MemorySystem; store: InMemoryAdapter } {
  const store = new InMemoryAdapter();
  const mem = new MemorySystem({ store });
  return { mem, store };
}

describe('computeNormalizedFields', () => {
  it('lowercases + strips corp suffixes + drops punctuation on displayName', () => {
    const r = computeNormalizedFields({ displayName: 'ICOS Inc.' });
    expect(r.normalizedDisplayName).toBe('icos');
  });

  it('dedupes aliases under normalization (case + punctuation + corp suffix)', () => {
    const r = computeNormalizedFields({
      displayName: 'Stand-Up',
      aliases: ['Stand Up', 'STAND-UP', '  stand up  ', 'Stand Up Inc'],
    });
    expect(r.normalizedDisplayName).toBe('stand up');
    expect(r.normalizedAliases).toEqual(['stand up']);
  });

  it('drops empty / whitespace-only aliases', () => {
    const r = computeNormalizedFields({
      displayName: 'X',
      aliases: ['', '   ', '...', 'Real Alias'],
    });
    expect(r.normalizedAliases).toEqual(['real alias']);
  });

  it('returns empty normalizedDisplayName when input collapses', () => {
    const r = computeNormalizedFields({ displayName: '...' });
    expect(r.normalizedDisplayName).toBe('');
  });
});

describe('InMemoryAdapter.createEntity / updateEntity stamps normalized fields', () => {
  it('createEntity populates normalizedDisplayName + normalizedAliases', async () => {
    const { mem } = makeMem();
    const r = await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'ICOS Inc.',
        aliases: ['ICOS', 'ICOS Corp'],
        identifiers: [],
      },
      SCOPE,
    );
    expect(r.entity.normalizedDisplayName).toBe('icos');
    expect(r.entity.normalizedAliases).toEqual(['icos']);
  });

  it('updateEntity recomputes when displayName changes', async () => {
    const { mem, store } = makeMem();
    const created = await mem.upsertEntity(
      { type: 'project', displayName: 'Acme Corp', identifiers: [] },
      SCOPE,
    );
    // Direct adapter update — spreads existing then changes displayName.
    // Adapter must recompute, not carry the stale normalized value.
    await store.updateEntity({
      ...created.entity,
      displayName: 'Beta Industries',
      version: created.entity.version + 1,
    });
    const after = await store.getEntity(created.entity.id, SCOPE);
    expect(after?.normalizedDisplayName).toBe('beta industries');
  });

  it('mergeEntities recomputes normalized fields on the winner', async () => {
    const { mem } = makeMem();
    const a = await mem.upsertEntity(
      { type: 'project', displayName: 'Alpha', aliases: ['A1'], identifiers: [] },
      SCOPE,
    );
    const b = await mem.upsertEntity(
      { type: 'project', displayName: 'Beta', aliases: ['B1'], identifiers: [] },
      SCOPE,
    );
    const winner = await mem.mergeEntities(a.entity.id, b.entity.id, SCOPE);
    // Winner keeps its displayName + absorbs loser's `aliases` array.
    // `mergeIdentifiersAndAliases` currently does not promote loser.displayName
    // to a winner alias — see MemorySystem.ts:mergeEntities. Out of scope here.
    expect(winner.normalizedDisplayName).toBe('alpha');
    expect(new Set(winner.normalizedAliases ?? [])).toEqual(new Set(['a1', 'b1']));
  });

  it('upsertEntityBySurface (alias accumulation) recomputes normalized aliases', async () => {
    const { mem } = makeMem();
    const first = await mem.upsertEntityBySurface(
      { surface: 'Acme', type: 'organization', identifiers: [] },
      SCOPE,
    );
    // Re-mention with a different surface — resolves to first via Tier 2
    // (exact normalized displayName) and accumulates the new surface as an
    // alias. The adapter recomputes normalizedAliases on the underlying write.
    const second = await mem.upsertEntityBySurface(
      { surface: 'Acme Corp', type: 'organization', identifiers: [] },
      SCOPE,
    );
    expect(second.entity.id).toBe(first.entity.id);
    expect(second.entity.normalizedAliases ?? []).toContain('acme');
  });
});

describe('IMemoryStore.findEntitiesByNormalizedName', () => {
  it('exact-matches displayName (matchAliases default off)', async () => {
    const { mem, store } = makeMem();
    const ent = await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    const hits = await store.findEntitiesByNormalizedName(
      'project',
      'icos',
      SCOPE,
    );
    expect(hits.length).toBe(1);
    expect(hits[0]!.id).toBe(ent.entity.id);
  });

  it('does NOT match aliases when matchAliases is false', async () => {
    const { mem, store } = makeMem();
    await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'Project ICOS',
        aliases: ['ICOS'],
        identifiers: [],
      },
      SCOPE,
    );
    const hits = await store.findEntitiesByNormalizedName(
      'project',
      'icos',
      SCOPE,
    );
    expect(hits.length).toBe(0);
  });

  it('matches aliases when matchAliases is true', async () => {
    const { mem, store } = makeMem();
    const aliased = await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'Project ICOS',
        aliases: ['ICOS'],
        identifiers: [],
      },
      SCOPE,
    );
    const bare = await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    const hits = await store.findEntitiesByNormalizedName(
      'project',
      'icos',
      SCOPE,
      { matchAliases: true },
    );
    const ids = new Set(hits.map((h) => h.id));
    expect(ids).toEqual(new Set([aliased.entity.id, bare.entity.id]));
  });

  it('returns the bare entity even with 90 substring-prefix siblings (the dup bug repro)', async () => {
    const { mem, store } = makeMem();
    const bare = await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    for (let i = 0; i < 90; i++) {
      await mem.upsertEntity(
        { type: 'project', displayName: `ICOS prefix ${i}`, identifiers: [] },
        SCOPE,
      );
    }
    const hits = await store.findEntitiesByNormalizedName(
      'project',
      'icos',
      SCOPE,
    );
    expect(hits.length).toBe(1);
    expect(hits[0]!.id).toBe(bare.entity.id);
  });

  it('skips entities lacking normalizedDisplayName (legacy data simulation)', async () => {
    const { mem, store } = makeMem();
    const r = await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    // Drop the normalized fields to simulate a pre-0.8.0 legacy record.
    // The adapter's read path returns the underlying object via clone(), so
    // we mutate via updateEntity with the fields stripped — but the adapter
    // recomputes on every write, so we have to reach into the raw map. The
    // documented contract only requires that legacy data is skipped; here
    // we test that the contract is enforced by the find method even if the
    // field is undefined.
    const raw = (store as unknown as {
      entitiesById: Map<string, { normalizedDisplayName?: string }>;
    }).entitiesById.get(r.entity.id);
    if (raw) delete raw.normalizedDisplayName;
    const hits = await store.findEntitiesByNormalizedName(
      'project',
      'icos',
      SCOPE,
    );
    expect(hits.length).toBe(0);
  });

  it('returns empty for empty query (avoids over-match)', async () => {
    const { mem, store } = makeMem();
    await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    const hits = await store.findEntitiesByNormalizedName(
      'project',
      '',
      SCOPE,
    );
    expect(hits.length).toBe(0);
  });

  it('respects the type filter', async () => {
    const { mem, store } = makeMem();
    await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    await mem.upsertEntity(
      { type: 'topic', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    const hits = await store.findEntitiesByNormalizedName(
      'project',
      'icos',
      SCOPE,
    );
    expect(hits.length).toBe(1);
    expect(hits[0]!.type).toBe('project');
  });

  it('respects the scope filter (visibility)', async () => {
    const { mem, store } = makeMem();
    await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'ICOS',
        identifiers: [],
        ownerId: 'u-other',
        permissions: { world: 'none', group: 'none' },
      },
      { userId: 'u-other' },
    );
    const hits = await store.findEntitiesByNormalizedName(
      'project',
      'icos',
      SCOPE,
    );
    expect(hits.length).toBe(0);
  });

  it('honors the limit option', async () => {
    const { store } = makeMem();
    // Bypass MemorySystem (which post-Commit-5 dedupes bare same-name upserts)
    // and seed five distinct rows via the adapter directly — needed to verify
    // the limit clause.
    for (let i = 0; i < 5; i++) {
      await store.createEntity({
        type: 'project',
        displayName: 'ICOS',
        identifiers: [],
        ownerId: 'u1',
      });
    }
    const hits = await store.findEntitiesByNormalizedName(
      'project',
      'icos',
      SCOPE,
      { limit: 2 },
    );
    expect(hits.length).toBe(2);
  });
});
