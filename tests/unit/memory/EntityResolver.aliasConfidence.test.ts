/**
 * Phase A — Commit 4 tests.
 *
 * Verifies `EntityResolutionConfig.aliasMatchConfidence` and
 * `displayNameMatchConfidence` are honored. Default behavior (alias 0.90)
 * is covered by the existing resolver tests.
 */

import { describe, it, expect } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';

const SCOPE = { userId: 'u1' } as const;

function makeMem(config?: ConstructorParameters<typeof MemorySystem>[0]['entityResolution']) {
  return new MemorySystem({
    store: new InMemoryAdapter(),
    entityResolution: config,
  });
}

describe('EntityResolutionConfig — alias / displayName confidence knobs', () => {
  it('default: alias tier returns 0.90 (auto-resolves at default threshold)', async () => {
    const mem = makeMem();
    const seed = await mem.upsertEntity(
      {
        type: 'organization',
        displayName: 'Microsoft',
        aliases: ['MSFT'],
        identifiers: [],
      },
      SCOPE,
    );
    const result = await mem.upsertEntityBySurface(
      { surface: 'MSFT', type: 'organization', identifiers: [] },
      SCOPE,
    );
    expect(result.entity.id).toBe(seed.entity.id);
    expect(result.resolved).toBe(true);
  });

  it('aliasMatchConfidence: 0.85 restores pre-0.8.0 behavior (alias does not auto-resolve)', async () => {
    const mem = makeMem({ aliasMatchConfidence: 0.85 });
    const seed = await mem.upsertEntity(
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
    expect(candidates[0]!.confidence).toBe(0.85);
    expect(candidates[0]!.matchedOn).toBe('alias');
    // upsertBySurface: 0.85 < default 0.9 threshold → race-loss may
    // converge via the atomic upsert path, OR a new entity is created.
    // The atomic primitive keys on normalizedDisplayName only, so the
    // surface 'MSFT' has its own key separate from 'microsoft' → a new
    // entity gets created.
    const result = await mem.upsertEntityBySurface(
      { surface: 'MSFT', type: 'organization', identifiers: [] },
      SCOPE,
    );
    expect(result.entity.id).not.toBe(seed.entity.id);
    expect(result.resolved).toBe(false);
  });

  it('displayNameMatchConfidence: 0.95 lifts the tier-2 score above semantic-cap defaults', async () => {
    const mem = makeMem({ displayNameMatchConfidence: 0.95 });
    await mem.upsertEntity(
      { type: 'organization', displayName: 'Microsoft', identifiers: [] },
      SCOPE,
    );
    const candidates = await mem.resolveEntity(
      { surface: 'Microsoft', type: 'organization' },
      SCOPE,
    );
    expect(candidates[0]!.confidence).toBe(0.95);
    expect(candidates[0]!.matchedOn).toBe('displayName');
  });

  it('both knobs combine: 0.95 displayName + 0.7 alias', async () => {
    const mem = makeMem({
      displayNameMatchConfidence: 0.95,
      aliasMatchConfidence: 0.7,
    });
    await mem.upsertEntity(
      {
        type: 'organization',
        displayName: 'Microsoft',
        aliases: ['MSFT'],
        identifiers: [],
      },
      SCOPE,
    );
    const display = await mem.resolveEntity(
      { surface: 'Microsoft', type: 'organization' },
      SCOPE,
    );
    expect(display[0]!.confidence).toBe(0.95);
    const alias = await mem.resolveEntity(
      { surface: 'MSFT', type: 'organization' },
      SCOPE,
    );
    expect(alias[0]!.confidence).toBe(0.7);
  });
});
