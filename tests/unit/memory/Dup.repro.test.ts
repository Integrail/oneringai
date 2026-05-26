/**
 * Entity-duplication repros (Step 0 of Phase A).
 *
 * Four scenarios suspected to produce duplicate entities in production:
 *   R1 — concurrent surface upserts (no atomicity)
 *   R2 — alias-tier confidence 0.85 below auto-resolve threshold 0.90
 *   R3 — searchEntities substring-cap + Mongo oversample (>500 prefix matches)
 *   R4 — bare upsertEntity skips dedup when identifiers is empty
 *
 * These are written against current main BEFORE any fix lands. The pass/fail
 * shape documented in the brief should match the observed behavior — that is
 * what justifies (or invalidates) each Phase A commit.
 *
 * R3 against Mongo lives in the integration test file (gated on the optional
 * mongodb peer dep). The InMemory variant here is a best-effort proxy: it
 * stages the same fixture (1 bare + 600 prefixed) and asserts the resolver
 * still finds the bare entity. The InMemory adapter has no oversample cap, so
 * this should pass even without the fix — that asymmetry is the report.
 */

import { describe, it, expect } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';

const SCOPE = { userId: 'u1' } as const;

function makeMem(): MemorySystem {
  return new MemorySystem({ store: new InMemoryAdapter() });
}

describe('R1 — concurrent upsertEntityBySurface for same surface (post-Commit 3)', () => {
  it('InMemory: two concurrent calls converge on ONE entity (atomic primitive)', async () => {
    const mem = makeMem();
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
    const page = await mem.listEntities({ type: 'project' }, {}, SCOPE);
    // Post-Commit 3: atomicCreateOrFindByNormalizedName converges races.
    expect(page.items.length).toBe(1);
    expect(a.entity.id).toBe(b.entity.id);
  });
});

describe('R2 — alias-tier match (0.85) is below default autoResolveThreshold (0.90)', () => {
  it('alias-only match creates a NEW entity (current behavior; should resolve post-fix)', async () => {
    const mem = makeMem();
    // Seed an entity with displayName "ICOS" + alias "ICOS launch".
    const seed = await mem.upsertEntityBySurface(
      {
        surface: 'ICOS',
        type: 'project',
        identifiers: [],
        aliases: ['ICOS launch'],
      },
      SCOPE,
    );

    // A NEW mention with surface "ICOS launch" matches the alias only
    // (Tier 3, confidence 0.85). 0.85 < default autoResolveThreshold 0.90,
    // so resolver does NOT auto-resolve → creates a new entity.
    const result = await mem.upsertEntityBySurface(
      { surface: 'ICOS launch', type: 'project', identifiers: [] },
      SCOPE,
    );
    const page = await mem.listEntities({ type: 'project' }, {}, SCOPE);

    // Documented current behavior: two distinct entities.
    expect(result.entity.id).not.toBe(seed.entity.id);
    expect(page.items.length).toBe(2);
    expect(result.resolved).toBe(false);
  });
});

describe('R3 — search-result substring cap (post-Commit 2: indexed lookup)', () => {
  it('1 bare + 600 prefixed entities — resolver returns the bare one (InMemory)', async () => {
    const mem = makeMem();
    // Seed the bare ICOS first so it's not at the end.
    await mem.upsertEntityBySurface(
      { surface: 'ICOS', type: 'project', identifiers: [] },
      SCOPE,
    );
    // Add 600 prefixed entities.
    for (let i = 0; i < 600; i++) {
      await mem.upsertEntityBySurface(
        { surface: `ICOS suffix ${i}`, type: 'project', identifiers: [] },
        SCOPE,
      );
    }

    // Resolver pass: should find the bare ICOS via Tier 2 (exact normalized
    // displayName match).
    const candidates = await mem.resolveEntity(
      { surface: 'ICOS', type: 'project' },
      SCOPE,
    );
    // Top candidate should be the bare entity (confidence ≥ 0.90).
    expect(candidates.length).toBeGreaterThan(0);
    const top = candidates[0]!;
    expect(top.entity.displayName).toBe('ICOS');
    expect(top.confidence).toBeGreaterThanOrEqual(0.9);
  }, 30_000);
});

describe('R4 — bare upsertEntity (no identifiers) skips dedup', () => {
  it('two bare upsertEntity calls with same displayName create TWO entities', async () => {
    const mem = makeMem();
    const a = await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    const b = await mem.upsertEntity(
      { type: 'project', displayName: 'ICOS', identifiers: [] },
      SCOPE,
    );
    expect(a.entity.id).not.toBe(b.entity.id);
    const page = await mem.listEntities({ type: 'project' }, {}, SCOPE);
    expect(page.items.length).toBe(2);
  });
});
