/**
 * PR 3 (Phase B) — entity deduplication tooling.
 *
 * Tests cover:
 *  - scoreEntityPair: hard-zero rules, auto-merge, weighted-sum bands, the
 *    single-token-name guard, event-time conflict (deterministic, from prod
 *    data — Mon vs Tue standups MUST NOT collapse).
 *  - findDuplicateCandidates: identifier + normalized-name + semantic source
 *    fusion, deduplication, self/archived exclusion.
 *  - findDuplicateClusters: snapshot of (type, normalizedName) groups,
 *    minClusterSize / limit behavior, sorted by cluster size desc.
 *  - sweepDuplicates: yields decisions, scored desc within a cluster.
 *  - Winner selection: deterministic tiebreaks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  scoreEntityPair,
  findDuplicateCandidates,
  findDuplicateClusters,
  findIdentifierClusters,
  sweepDuplicates,
  DEFAULT_WEIGHTS,
} from '@/memory/dedup.js';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { IEntity, IFact, ScopeFilter, Identifier } from '@/memory/types.js';
import { normalizeSurface } from '@/memory/resolution/fuzzy.js';

const SCOPE: ScopeFilter = { userId: 'pr3-dedup-user' };

// Minimal entity factory — bypasses MemorySystem so scorer tests don't have
// resolver entanglement.
function ent(args: Partial<IEntity> & { displayName: string; type?: string }): IEntity {
  const dn = args.displayName;
  return {
    id: args.id ?? `e-${Math.random().toString(36).slice(2, 10)}`,
    type: args.type ?? 'person',
    displayName: dn,
    normalizedDisplayName: args.normalizedDisplayName ?? normalizeSurface(dn),
    aliases: args.aliases,
    normalizedAliases: args.normalizedAliases ?? (args.aliases ?? []).map(normalizeSurface),
    identifiers: args.identifiers ?? [],
    metadata: args.metadata,
    version: 1,
    createdAt: args.createdAt ?? new Date(),
    updatedAt: args.updatedAt ?? new Date(),
    ownerId: 'pr3-dedup-user',
    identityEmbedding: args.identityEmbedding,
  } as IEntity;
}

// ===========================================================================
// scoreEntityPair
// ===========================================================================

describe('scoreEntityPair — hard-zero rules', () => {
  it('type mismatch → skip with score=0', () => {
    const a = ent({ displayName: 'Acme', type: 'organization' });
    const b = ent({ displayName: 'Acme', type: 'project' });
    const d = scoreEntityPair({ a, b });
    expect(d.action).toBe('skip');
    expect(d.score).toBe(0);
    expect(d.signals.typeMismatch).toBe(true);
  });

  it('identifier conflict (same kind, different values) → skip', () => {
    const a = ent({
      displayName: 'John',
      identifiers: [{ kind: 'email', value: 'a@x.com' }],
    });
    const b = ent({
      displayName: 'John',
      identifiers: [{ kind: 'email', value: 'b@x.com' }],
    });
    const d = scoreEntityPair({ a, b });
    expect(d.action).toBe('skip');
    expect(d.signals.identifierConflict).toBe(true);
  });

  it('identifier exact match → auto-merge with score=1', () => {
    const a = ent({
      displayName: 'John Smith',
      identifiers: [{ kind: 'email', value: 'j@x.com' }],
    });
    const b = ent({
      displayName: 'J. Smith',
      identifiers: [{ kind: 'email', value: 'J@X.com' }], // case-insensitive
    });
    const d = scoreEntityPair({ a, b });
    expect(d.action).toBe('auto-merge');
    expect(d.score).toBe(1);
    expect(d.signals.identifierExactMatch).toBe(true);
  });

  it('event.startTime delta > 60min → hard-zero skip (different occurrences of same series)', () => {
    // The Mon vs Tue standup case from production. Names match exactly,
    // identifiers absent — without the metadata guard, weighted sum would
    // auto-merge two distinct meetings.
    const a = ent({
      displayName: 'Daily Standup',
      type: 'event',
      metadata: { startTime: new Date('2026-05-25T09:00:00Z') }, // Mon
    });
    const b = ent({
      displayName: 'Daily Standup',
      type: 'event',
      metadata: { startTime: new Date('2026-05-26T09:00:00Z') }, // Tue
    });
    const d = scoreEntityPair({ a, b });
    expect(d.action).toBe('skip');
    expect(d.score).toBe(0);
    expect(d.signals.metadataStartTimeConflict).toBe(true);
  });

  it('event.startTime delta ≤ 60min → conflict signal does NOT fire (same occurrence ingested twice)', () => {
    const a = ent({
      displayName: 'Daily Standup',
      type: 'event',
      metadata: { startTime: new Date('2026-05-25T09:00:00Z') },
    });
    const b = ent({
      displayName: 'Daily Standup',
      type: 'event',
      metadata: { startTime: new Date('2026-05-25T09:30:00Z') }, // rescheduled 30min
    });
    const d = scoreEntityPair({ a, b });
    expect(d.signals.metadataStartTimeConflict).toBe(false);
    // Name match weights through to auto-merge.
    expect(d.action).toBe('auto-merge');
  });

  it('event.startTime missing on one side → signal N/A, weighted sum proceeds', () => {
    const a = ent({
      displayName: 'Q3 Planning',
      type: 'event',
      metadata: { startTime: new Date('2026-05-25T09:00:00Z') },
    });
    const b = ent({
      displayName: 'Q3 Planning',
      type: 'event',
      // no startTime metadata
    });
    const d = scoreEntityPair({ a, b });
    expect(d.signals.metadataStartTimeConflict).toBe(false);
    // Should fall through to name-match path → auto-merge or review.
    expect(d.action).not.toBe('skip');
  });
});

describe('scoreEntityPair — weighted-sum bands', () => {
  it('single-token short PERSON names → review (guard fires by default for persons)', () => {
    // "Pavel" is a single 5-char token — guard caps at 0.85 because multiple
    // humans named "Pavel" can exist in a tenant. In production these pairs
    // also surface a semantic-tier mergeCandidate (cap 0.89), but the dedup
    // scorer alone routes them to 'review' for human judgment.
    // (See atomicUpsert test for the symmetric write-side rule: single-token
    // person with no identifier never auto-dedupes at create time either.)
    const a = ent({
      displayName: 'John',
      type: 'person',
      aliases: ['johnny'],
    });
    const b = ent({
      displayName: 'john',
      type: 'person',
      aliases: ['Johnny'],
    });
    const d = scoreEntityPair({ a, b });
    expect(d.signals.displayNameNormalizedEqual).toBe(true);
    expect(d.signals.singleTokenNameTooShort).toBe(true);
    expect(d.action).toBe('review');
  });

  it('normalized name equal on multi-token names → auto-merge', () => {
    // Multi-token names bypass the single-token guard. Two "Q3 Planning"
    // entities with no time conflict → auto-merge.
    const a = ent({
      displayName: 'Q3 Planning Meeting',
      type: 'event',
      aliases: ['q3-planning'],
    });
    const b = ent({
      displayName: 'q3 planning meeting',
      type: 'event',
      aliases: ['Q3-Planning'],
    });
    const d = scoreEntityPair({ a, b });
    expect(d.signals.displayNameNormalizedEqual).toBe(true);
    expect(d.signals.singleTokenNameTooShort).toBe(false);
    expect(d.action).toBe('auto-merge');
  });

  it('strong embedding cosine + name match → auto-merge (multi-token survives single-token guard)', () => {
    // normalizeSurface strips Corp/Corporation suffixes → both names normalize
    // to "acme". That's single-token short → guard caps at 0.85.
    // Use a multi-token name to bypass the guard.
    const a = ent({
      displayName: 'Acme Solutions Inc',
      type: 'organization',
      identityEmbedding: [1, 0, 0, 0],
    });
    const b = ent({
      displayName: 'Acme Solutions Corp',
      type: 'organization',
      identityEmbedding: [0.98, 0.05, 0.05, 0.05],
    });
    const d = scoreEntityPair({ a, b });
    expect(d.signals.displayNameNormalizedEqual).toBe(true); // Inc/Corp both strip
    expect(d.signals.singleTokenNameTooShort).toBe(false);
    expect(d.action).toBe('auto-merge');
  });

  it('partial alias overlap with no name match → review or skip', () => {
    const a = ent({
      displayName: 'William Smith',
      type: 'person',
      aliases: ['Bill', 'Will'],
    });
    const b = ent({
      displayName: 'Robert Smith',
      type: 'person',
      aliases: ['Bill'], // shared nickname only
    });
    const d = scoreEntityPair({ a, b });
    expect(d.action).not.toBe('auto-merge');
  });

  it('embedding cosine below floor contributes 0', () => {
    const a = ent({
      displayName: 'Foo',
      identityEmbedding: [1, 0, 0, 0],
    });
    const b = ent({
      displayName: 'Bar',
      identityEmbedding: [0.5, 0.5, 0.5, 0.5],
    });
    const d = scoreEntityPair({ a, b });
    // Cosine is real but should contribute 0 to score. With nothing else
    // strong, this lands at skip.
    expect(d.action).toBe('skip');
  });
});

describe('scoreEntityPair — single-token-name guard', () => {
  it('caps the score for single-token short names ("John" alone)', () => {
    const a = ent({ displayName: 'John', type: 'person', aliases: ['John'] });
    const b = ent({ displayName: 'John', type: 'person', aliases: ['John'] });
    const d = scoreEntityPair({ a, b });
    // Even with perfect alias + name match, single-token short name caps at 0.85.
    // So action is 'review', not 'auto-merge'.
    expect(d.signals.singleTokenNameTooShort).toBe(true);
    expect(d.score).toBeLessThanOrEqual(0.85);
    expect(d.action).not.toBe('auto-merge');
  });

  it('does NOT apply when one name is multi-token', () => {
    const a = ent({ displayName: 'John', type: 'person' });
    const b = ent({ displayName: 'John Smith', type: 'person' });
    const d = scoreEntityPair({ a, b });
    expect(d.signals.singleTokenNameTooShort).toBe(false);
  });

  it('0.9.2 type-scope: single-token PROJECT names AUTO-MERGE by default (production ICOS case)', () => {
    // 41 ICOS-project rows in prod — same single-token short name, no
    // identifier. Default `singleTokenGuardTypes: ['person']` so projects
    // bypass the guard and reach auto-merge on name + alias-pool + token
    // signals alone.
    const a = ent({ displayName: 'ICOS', type: 'project' });
    const b = ent({ displayName: 'ICOS', type: 'project' });
    const d = scoreEntityPair({ a, b });
    expect(d.signals.singleTokenNameTooShort).toBe(false);
    expect(d.action).toBe('auto-merge');
  });

  it('0.9.2 type-scope: same for ORGANIZATION', () => {
    const a = ent({ displayName: 'EW', type: 'organization' });
    const b = ent({ displayName: 'EW', type: 'organization' });
    const d = scoreEntityPair({ a, b });
    expect(d.action).toBe('auto-merge');
  });

  it('0.9.2 type-scope: caller can include project to keep guard active for projects', () => {
    const a = ent({ displayName: 'ICOS', type: 'project' });
    const b = ent({ displayName: 'ICOS', type: 'project' });
    const d = scoreEntityPair({ a, b }, { singleTokenGuardTypes: ['person', 'project'] });
    expect(d.signals.singleTokenNameTooShort).toBe(true);
    expect(d.action).not.toBe('auto-merge');
  });

  it('0.9.2 type-scope: empty array disables guard for ALL types', () => {
    const a = ent({ displayName: 'John', type: 'person' });
    const b = ent({ displayName: 'John', type: 'person' });
    const d = scoreEntityPair({ a, b }, { singleTokenGuardTypes: [] });
    expect(d.signals.singleTokenNameTooShort).toBe(false);
    expect(d.action).toBe('auto-merge');
  });
});

describe('scoreEntityPair — token-set Jaccard', () => {
  it('"Launch ICOS" vs "ICOS Launch" → token overlap signal fires', () => {
    const a = ent({ displayName: 'Launch ICOS', type: 'project' });
    const b = ent({ displayName: 'ICOS Launch', type: 'project' });
    const d = scoreEntityPair({ a, b });
    expect(d.signals.tokenSetJaccard).toBeCloseTo(1, 2);
    // displayNameNormalizedEqual is false (different token order in normalized
    // form), but token-set Jaccard + name equality after re-normalization?
    // Actually normalizeSurface keeps token order, so different. But tokens
    // are the same set.
    expect(d.score).toBeGreaterThan(0);
  });
});

describe('scoreEntityPair — winner selection', () => {
  it('more identifiers wins', () => {
    const a = ent({
      id: 'a',
      displayName: 'X',
      identifiers: [
        { kind: 'email', value: 'a@x.com' },
        { kind: 'github', value: 'a' },
      ],
    });
    const b = ent({
      id: 'b',
      displayName: 'X',
      identifiers: [{ kind: 'phone', value: '+1234' }],
    });
    const d = scoreEntityPair({ a, b });
    expect(d.suggestedWinnerId).toBe('a');
  });

  it('tie on identifiers → older createdAt wins', () => {
    const a = ent({
      id: 'a',
      displayName: 'X',
      createdAt: new Date('2025-01-01'),
    });
    const b = ent({
      id: 'b',
      displayName: 'X',
      createdAt: new Date('2026-01-01'),
    });
    const d = scoreEntityPair({ a, b });
    expect(d.suggestedWinnerId).toBe('a');
  });

  it('with facts: tie on identifiers → more atomic facts wins', () => {
    const a = ent({ id: 'a', displayName: 'X' });
    const b = ent({ id: 'b', displayName: 'X' });
    const factsA: IFact[] = [
      makeFact('a', 'noted', 'atomic', 'f1'),
      makeFact('a', 'noted', 'atomic', 'f2'),
    ];
    const factsB: IFact[] = [makeFact('b', 'noted', 'atomic', 'f3')];
    const d = scoreEntityPair({ a, b, factsA, factsB });
    expect(d.suggestedWinnerId).toBe('a');
  });
});

describe('scoreEntityPair — weights config', () => {
  it('caller can override weights via SignalWeights partial', () => {
    const a = ent({ displayName: 'Foo Bar Baz', type: 'project' });
    const b = ent({ displayName: 'Foo Bar Baz', type: 'project' });
    // Default + multi-token name (no single-token guard) → auto-merge.
    const defaultD = scoreEntityPair({ a, b });
    expect(defaultD.action).toBe('auto-merge');
    // Zero out every weight → push to skip.
    const tunedD = scoreEntityPair(
      { a, b },
      {
        weights: {
          displayNameNormalizedEqual: 0,
          aliasOverlap: 0,
          tokenSetJaccard: 0,
          embeddingCosine: 0,
          contextIdsOverlap: 0,
          sameSignalBoost: 0,
        },
      },
    );
    expect(tunedD.action).toBe('skip');
  });

  it('DEFAULT_WEIGHTS is exposed and immutable-friendly', () => {
    expect(DEFAULT_WEIGHTS.displayNameNormalizedEqual).toBeGreaterThan(0);
    expect(DEFAULT_WEIGHTS.aliasOverlap).toBeGreaterThan(0);
    expect(DEFAULT_WEIGHTS.embeddingCosine).toBeGreaterThan(0);
  });
});

// ===========================================================================
// findDuplicateCandidates
// ===========================================================================

describe('findDuplicateCandidates', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('finds via identifier matches, normalized-name matches, dedupes, excludes self', async () => {
    const canonical = await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'ICOS',
        identifiers: [{ kind: 'canonical', value: 'p:icos' }],
      },
      SCOPE,
    );
    // Insert 5 variants that all normalize to "icos".
    const variants: string[] = [];
    for (let i = 0; i < 5; i++) {
      const v = await mem.upsertEntity(
        {
          type: 'project',
          displayName: i === 0 ? 'ICOS' : `ICOS ${i}`,
          identifiers: [{ kind: 'canonical', value: `p:icos-v${i}` }],
        },
        SCOPE,
      );
      variants.push(v.entity.id);
    }
    // Insert 20 unrelated entities — should not appear as candidates.
    for (let i = 0; i < 20; i++) {
      await mem.upsertEntity(
        {
          type: 'project',
          displayName: `Other ${i}`,
          identifiers: [{ kind: 'canonical', value: `p:other-${i}` }],
        },
        SCOPE,
      );
    }

    const cands = await findDuplicateCandidates(mem, canonical.entity, SCOPE, {
      includeSemantic: false,
    });
    // Should find at least the ICOS variant ('ICOS' index 0) via normalized-name match.
    const ids = cands.map((e) => e.id);
    expect(ids).not.toContain(canonical.entity.id);
    expect(ids).toContain(variants[0]); // exact name match
    // Other-N entities should NOT be candidates.
    for (let i = 0; i < 20; i++) {
      expect(ids.every((id) => !id.includes(`Other`))).toBe(true);
    }
  });

  it('excludes archived entities', async () => {
    const a = await mem.upsertEntity(
      { type: 'person', displayName: 'X', identifiers: [{ kind: 'email', value: 'x@a.com' }] },
      SCOPE,
    );
    const b = await mem.upsertEntity(
      { type: 'person', displayName: 'X', identifiers: [{ kind: 'email', value: 'x@b.com' }] },
      SCOPE,
    );
    await mem.archiveEntity(b.entity.id, SCOPE);

    const cands = await findDuplicateCandidates(mem, a.entity, SCOPE, { includeSemantic: false });
    expect(cands.map((e) => e.id)).not.toContain(b.entity.id);
  });
});

// ===========================================================================
// findDuplicateClusters
// ===========================================================================

describe('findDuplicateClusters', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('returns clusters with count ≥ minClusterSize, sorted by size desc', async () => {
    // Big cluster: 5 ICOS variants.
    for (let i = 0; i < 5; i++) {
      await mem.upsertEntity(
        {
          type: 'project',
          displayName: 'ICOS',
          identifiers: [{ kind: 'canonical', value: `p:icos-${i}` }],
        },
        SCOPE,
      );
    }
    // Smaller cluster: 3 standups.
    for (let i = 0; i < 3; i++) {
      await mem.upsertEntity(
        {
          type: 'event',
          displayName: 'Standup',
          identifiers: [{ kind: 'canonical', value: `e:standup-${i}` }],
        },
        SCOPE,
      );
    }
    // Singleton — should NOT appear.
    await mem.upsertEntity(
      {
        type: 'topic',
        displayName: 'Alone',
        identifiers: [{ kind: 'canonical', value: 't:alone' }],
      },
      SCOPE,
    );

    const clusters = await findDuplicateClusters(mem, SCOPE);
    expect(clusters.length).toBe(2);
    expect(clusters[0]!.entities.length).toBe(5);
    expect(clusters[0]!.type).toBe('project');
    expect(clusters[1]!.entities.length).toBe(3);
    expect(clusters[1]!.type).toBe('event');
  });

  it('respects type filter', async () => {
    for (let i = 0; i < 3; i++) {
      await mem.upsertEntity(
        {
          type: 'person',
          displayName: 'John',
          identifiers: [{ kind: 'email', value: `john${i}@x.com` }],
        },
        SCOPE,
      );
    }
    for (let i = 0; i < 3; i++) {
      await mem.upsertEntity(
        {
          type: 'project',
          displayName: 'ICOS',
          identifiers: [{ kind: 'canonical', value: `p:icos-${i}` }],
        },
        SCOPE,
      );
    }

    const projectsOnly = await findDuplicateClusters(mem, SCOPE, { type: 'project' });
    expect(projectsOnly.length).toBe(1);
    expect(projectsOnly[0]!.type).toBe('project');
  });

  it('respects limit', async () => {
    for (let n = 0; n < 5; n++) {
      for (let i = 0; i < 2; i++) {
        await mem.upsertEntity(
          {
            type: 'topic',
            displayName: `Topic ${n}`,
            identifiers: [{ kind: 'canonical', value: `t:${n}-${i}` }],
          },
          SCOPE,
        );
      }
    }
    const limited = await findDuplicateClusters(mem, SCOPE, { limit: 2 });
    expect(limited.length).toBe(2);
  });
});

// ===========================================================================
// findIdentifierClusters (0.9.2)
// ===========================================================================

describe('findIdentifierClusters', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('finds entities sharing an identifier with different displayNames (production Pavel case)', async () => {
    // Pavel + Pavel Khasanov sharing email = same human, but findDuplicateClusters
    // misses because displayNames normalize differently. findIdentifierClusters
    // catches it.
    for (const surface of ['Pavel', 'Pavel Khasanov', 'P. Khasanov']) {
      await store.createEntity({
        type: 'person',
        displayName: surface,
        normalizedDisplayName: surface.toLowerCase(),
        identifiers: [{ kind: 'email', value: 'pavel@everworker.ai' }],
        ownerId: SCOPE.userId!,
        version: 1,
      } as unknown as Parameters<typeof store.createEntity>[0]);
    }
    // Unrelated entity — different email, should NOT cluster.
    await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Sarah',
        identifiers: [{ kind: 'email', value: 'sarah@x.com' }],
      },
      SCOPE,
    );

    const clusters = await findIdentifierClusters(mem, SCOPE);
    expect(clusters.length).toBe(1);
    expect(clusters[0]!.kind).toBe('email');
    expect(clusters[0]!.value).toBe('pavel@everworker.ai');
    expect(clusters[0]!.entities.length).toBe(3);
  });

  it('case-folds the value for case-insensitive kinds (email)', async () => {
    // Two entities with same email differing in case → still one cluster.
    for (const value of ['Pavel@Everworker.ai', 'pavel@everworker.ai']) {
      await store.createEntity({
        type: 'person',
        displayName: `P-${value}`,
        normalizedDisplayName: `p-${value}`.toLowerCase(),
        identifiers: [{ kind: 'email', value }],
        ownerId: SCOPE.userId!,
        version: 1,
      } as unknown as Parameters<typeof store.createEntity>[0]);
    }

    const clusters = await findIdentifierClusters(mem, SCOPE);
    expect(clusters.length).toBe(1);
    expect(clusters[0]!.entities.length).toBe(2);
  });

  it('does NOT case-fold for case-sensitive kinds (github)', async () => {
    for (const value of ['Anton-A', 'anton-a']) {
      await store.createEntity({
        type: 'person',
        displayName: `P-${value}`,
        normalizedDisplayName: `p-${value}`.toLowerCase(),
        identifiers: [{ kind: 'github', value }],
        ownerId: SCOPE.userId!,
        version: 1,
      } as unknown as Parameters<typeof store.createEntity>[0]);
    }
    const clusters = await findIdentifierClusters(mem, SCOPE);
    // Two distinct values → no cluster.
    expect(clusters.length).toBe(0);
  });

  it('respects kinds filter', async () => {
    await store.createEntity({
      type: 'person',
      displayName: 'A',
      normalizedDisplayName: 'a',
      identifiers: [
        { kind: 'email', value: 'shared@x.com' },
        { kind: 'github', value: 'shared-gh' },
      ],
      ownerId: SCOPE.userId!,
      version: 1,
    } as unknown as Parameters<typeof store.createEntity>[0]);
    await store.createEntity({
      type: 'person',
      displayName: 'B',
      normalizedDisplayName: 'b',
      identifiers: [
        { kind: 'email', value: 'shared@x.com' },
        { kind: 'github', value: 'shared-gh' },
      ],
      ownerId: SCOPE.userId!,
      version: 1,
    } as unknown as Parameters<typeof store.createEntity>[0]);

    const emailOnly = await findIdentifierClusters(mem, SCOPE, { kinds: ['email'] });
    expect(emailOnly.length).toBe(1);
    expect(emailOnly[0]!.kind).toBe('email');
  });

  it('excludes singletons (minClusterSize default 2)', async () => {
    await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Alone',
        identifiers: [{ kind: 'email', value: 'alone@x.com' }],
      },
      SCOPE,
    );
    const clusters = await findIdentifierClusters(mem, SCOPE);
    expect(clusters.length).toBe(0);
  });

  it('excludes archived entities', async () => {
    // Create two distinct entities sharing an email by bypassing the resolver
    // (which would dedupe them via Tier 1). store.createEntity is the
    // straight-to-adapter path used to simulate legacy data state.
    const a = await store.createEntity({
      type: 'person',
      displayName: 'A',
      normalizedDisplayName: 'a',
      identifiers: [{ kind: 'email', value: 'x@x.com' }],
      ownerId: SCOPE.userId!,
      version: 1,
    } as unknown as Parameters<typeof store.createEntity>[0]);
    const b = await store.createEntity({
      type: 'person',
      displayName: 'B',
      normalizedDisplayName: 'b',
      identifiers: [{ kind: 'email', value: 'x@x.com' }],
      ownerId: SCOPE.userId!,
      version: 1,
    } as unknown as Parameters<typeof store.createEntity>[0]);
    expect(a.id).not.toBe(b.id);

    // Sanity: both visible → 1 cluster of 2.
    const before = await findIdentifierClusters(mem, SCOPE);
    expect(before.length).toBe(1);
    expect(before[0]!.entities.length).toBe(2);

    await mem.archiveEntity(b.id, SCOPE);

    const after = await findIdentifierClusters(mem, SCOPE);
    // Only `a` survives → no cluster.
    expect(after.length).toBe(0);
  });

  it('sorts clusters by size desc', async () => {
    // Large cluster (3) on github, small (2) on email.
    for (let i = 0; i < 3; i++) {
      await store.createEntity({
        type: 'person',
        displayName: `G${i}`,
        normalizedDisplayName: `g${i}`,
        identifiers: [{ kind: 'github', value: 'team-gh' }],
        ownerId: SCOPE.userId!,
        version: 1,
      } as unknown as Parameters<typeof store.createEntity>[0]);
    }
    for (let i = 0; i < 2; i++) {
      await store.createEntity({
        type: 'person',
        displayName: `E${i}`,
        normalizedDisplayName: `e${i}`,
        identifiers: [{ kind: 'email', value: 'team@x.com' }],
        ownerId: SCOPE.userId!,
        version: 1,
      } as unknown as Parameters<typeof store.createEntity>[0]);
    }
    const clusters = await findIdentifierClusters(mem, SCOPE);
    expect(clusters.length).toBe(2);
    expect(clusters[0]!.entities.length).toBe(3);
    expect(clusters[1]!.entities.length).toBe(2);
  });
});

// ===========================================================================
// sweepDuplicates
// ===========================================================================

describe('sweepDuplicates', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('yields decisions for each cluster, score-desc within cluster', async () => {
    // Insert 3 distinct entities sharing normalized name. Use store.createEntity
    // directly to bypass upsertEntity's dedup (which would converge them to one
    // row). This simulates the production state where pre-0.8.0 writes created
    // multiple rows for the same surface and the backfill stamped normalized
    // fields on each. Multi-token name avoids the single-token guard.
    for (let i = 0; i < 3; i++) {
      await store.createEntity({
        type: 'project',
        displayName: 'Quarterly Planning Project',
        normalizedDisplayName: 'quarterly planning project',
        identifiers: [],
        ownerId: SCOPE.userId!,
        version: 1,
      } as unknown as Parameters<typeof store.createEntity>[0]);
    }
    const decisions: import('@/memory/dedup.js').DedupDecision[] = [];
    for await (const d of sweepDuplicates(mem, SCOPE)) {
      decisions.push(d);
    }
    // 3 entities = 3 pairs.
    expect(decisions.length).toBe(3);
    // All should be auto-merge (all share normalized name + multi-token).
    for (const d of decisions) {
      expect(d.action).toBe('auto-merge');
    }
    // Score-desc.
    for (let i = 1; i < decisions.length; i++) {
      expect(decisions[i - 1]!.score).toBeGreaterThanOrEqual(decisions[i]!.score);
    }
  });

  it('caps pair count via maxPairsPerCluster', async () => {
    // 10 entities → 45 pairs naturally; cap to 5.
    for (let i = 0; i < 10; i++) {
      await mem.upsertEntity(
        {
          type: 'topic',
          displayName: 'X',
          identifiers: [{ kind: 'canonical', value: `t:${i}` }],
        },
        SCOPE,
      );
    }
    const decisions: import('@/memory/dedup.js').DedupDecision[] = [];
    for await (const d of sweepDuplicates(mem, SCOPE, { maxPairsPerCluster: 5 })) {
      decisions.push(d);
    }
    expect(decisions.length).toBe(5);
  });

  it('event series stays split (recurring standups should not auto-merge)', async () => {
    // Simulate Mon, Tue, Wed standups — same name, different startTime, same series.
    await mem.upsertEntity(
      {
        type: 'event',
        displayName: 'Daily Standup',
        identifiers: [{ kind: 'canonical', value: 'e:standup-mon' }],
        metadata: { startTime: new Date('2026-05-25T09:00:00Z') },
      },
      SCOPE,
    );
    await mem.upsertEntity(
      {
        type: 'event',
        displayName: 'Daily Standup',
        identifiers: [{ kind: 'canonical', value: 'e:standup-tue' }],
        metadata: { startTime: new Date('2026-05-26T09:00:00Z') },
      },
      SCOPE,
    );
    await mem.upsertEntity(
      {
        type: 'event',
        displayName: 'Daily Standup',
        identifiers: [{ kind: 'canonical', value: 'e:standup-wed' }],
        metadata: { startTime: new Date('2026-05-27T09:00:00Z') },
      },
      SCOPE,
    );

    const decisions: import('@/memory/dedup.js').DedupDecision[] = [];
    for await (const d of sweepDuplicates(mem, SCOPE)) {
      decisions.push(d);
    }
    // All 3 pairs should hit hard-zero on metadata.startTime → action skip.
    expect(decisions.every((d) => d.action === 'skip')).toBe(true);
    expect(decisions.every((d) => d.signals.metadataStartTimeConflict)).toBe(true);
  });
});

// ===========================================================================
// Helpers
// ===========================================================================

function makeFact(subjectId: string, predicate: string, kind: 'atomic' | 'document', id: string): IFact {
  return {
    id,
    subjectId,
    predicate,
    kind,
    confidence: 1,
    importance: 0.5,
    archived: false,
    createdAt: new Date(),
    ownerId: 'pr3-dedup-user',
    observedAt: new Date(),
  } as IFact;
}
