/**
 * Tests for the public `MemorySystem.semanticSearchEntities` (L1) and the
 * `touchesAnyOf` multi-anchor vector filter (L2), exercised end-to-end through
 * the InMemoryAdapter's content-embedding path.
 *
 * Deterministic token-axis embedder (same pattern as
 * MemorySystem.contentEmbedding.test.ts): each lowercase token maps to one of
 * TOKEN_DIM axes, so a query that shares tokens with an entity's composed text
 * scores higher. Lets us assert ranking + filter behavior without a real model.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { IEmbedder, ScopeFilter } from '@/memory/types.js';

const scope: ScopeFilter = { userId: 'u1' };

const TOKEN_DIM = 64;
function tokenAxis(token: string): number {
  let h = 0;
  for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) >>> 0;
  return h % TOKEN_DIM;
}
function makeEmbedder(): IEmbedder & { embed: ReturnType<typeof vi.fn> } {
  const embed = vi.fn(async (text: string) => {
    const v = new Array(TOKEN_DIM).fill(0);
    const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
    for (const t of tokens) v[tokenAxis(t)] += 1;
    return v;
  });
  return { embed, dimensions: TOKEN_DIM };
}

describe('MemorySystem.semanticSearchEntities (L1 — public entity vector search)', () => {
  let mem: MemorySystem;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter(), embedder: makeEmbedder() });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('ranks arbitrary entity types by content embedding', async () => {
    const launch = await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'Northstar launch',
        identifiers: [{ kind: 'canonical', value: 'proj:northstar' }],
        metadata: { description: 'European market expansion launch' },
      },
      scope,
    );
    const migration = await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'Database migration',
        identifiers: [{ kind: 'canonical', value: 'proj:dbmig' }],
        metadata: { description: 'Move Postgres to Aurora' },
      },
      scope,
    );
    await mem.flushEmbeddings();

    const res = await mem.semanticSearchEntities(
      'European launch expansion',
      { type: 'project' },
      scope,
      { topK: 5 },
    );
    expect(res.length).toBe(2);
    expect(res[0]!.entity.id).toBe(launch.entity.id);
    const migrationHit = res.find((r) => r.entity.id === migration.entity.id);
    expect(migrationHit).toBeDefined();
    expect(res[0]!.score).toBeGreaterThan(migrationHit!.score);
  });

  it('honors the type narrow — other types excluded', async () => {
    await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'Alpha',
        identifiers: [{ kind: 'canonical', value: 'proj:alpha' }],
        metadata: { description: 'shared word alpha' },
      },
      scope,
    );
    const personId = (
      await mem.upsertEntity(
        {
          type: 'person',
          displayName: 'Alpha',
          identifiers: [{ kind: 'email', value: 'alpha@x.com' }],
          metadata: { description: 'shared word alpha' },
        },
        scope,
      )
    ).entity.id;
    await mem.flushEmbeddings();

    const res = await mem.semanticSearchEntities('alpha', { type: 'project' }, scope, {
      topK: 5,
    });
    expect(res.every((r) => r.entity.type === 'project')).toBe(true);
    expect(res.map((r) => r.entity.id)).not.toContain(personId);
  });

  it('honors the minScore floor', async () => {
    await mem.upsertEntity(
      {
        type: 'topic',
        displayName: 'Quarterly revenue review',
        identifiers: [{ kind: 'canonical', value: 'topic:rev' }],
        metadata: { description: 'quarterly revenue numbers' },
      },
      scope,
    );
    await mem.flushEmbeddings();

    // Query shares no tokens with the topic → cosine 0 → excluded by floor.
    const res = await mem.semanticSearchEntities(
      'zzz unrelated gibberish',
      { type: 'topic' },
      scope,
      { topK: 5, minScore: 0.5 },
    );
    expect(res.length).toBe(0);
  });

  it('returns [] for a string query when no embedder is configured', async () => {
    const noEmbed = new MemorySystem({ store: new InMemoryAdapter() });
    try {
      const res = await noEmbed.semanticSearchEntities('anything', { type: 'project' }, scope, {
        topK: 5,
      });
      expect(res).toEqual([]);
    } finally {
      if (!noEmbed.isDestroyed) await noEmbed.shutdown();
    }
  });

  it('accepts a precomputed vector (skips re-embed) and matches the string path', async () => {
    const launch = await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'Northstar launch',
        identifiers: [{ kind: 'canonical', value: 'proj:ns2' }],
        metadata: { description: 'European market expansion launch' },
      },
      scope,
    );
    await mem.flushEmbeddings();

    const vector = await mem.embedQuery('European launch expansion');
    const res = await mem.semanticSearchEntities(vector, { type: 'project' }, scope, { topK: 5 });
    expect(res[0]!.entity.id).toBe(launch.entity.id);
  });
});

describe('touchesAnyOf (L2 — multi-anchor vector filter)', () => {
  let mem: MemorySystem;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter(), embedder: makeEmbedder() });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  async function person(name: string, email: string): Promise<string> {
    return (
      await mem.upsertEntity(
        { type: 'person', displayName: name, identifiers: [{ kind: 'email', value: email }] },
        scope,
      )
    ).entity.id;
  }

  it('findSimilarOpenTasks surfaces tasks touched by ANY anchor, excludes others', async () => {
    const alice = await person('Alice', 'alice@x.com');
    const bob = await person('Bob', 'bob@x.com');
    const carol = await person('Carol', 'carol@x.com');

    const ta = (
      await mem.upsertEntity(
        {
          type: 'task',
          displayName: 'Review proposal',
          identifiers: [{ kind: 'canonical', value: 't:a' }],
          metadata: { state: 'pending', assigneeId: alice },
        },
        scope,
      )
    ).entity.id;
    const tb = (
      await mem.upsertEntity(
        {
          type: 'task',
          displayName: 'Review proposal',
          identifiers: [{ kind: 'canonical', value: 't:b' }],
          metadata: { state: 'pending', reporterId: bob },
        },
        scope,
      )
    ).entity.id;
    const tc = (
      await mem.upsertEntity(
        {
          type: 'task',
          displayName: 'Review proposal',
          identifiers: [{ kind: 'canonical', value: 't:c' }],
          metadata: { state: 'pending', assigneeId: carol },
        },
        scope,
      )
    ).entity.id;
    await mem.flushEmbeddings();

    const res = await mem.findSimilarOpenTasks('review proposal', scope, {
      topK: 10,
      touchesAnyOf: [alice, bob],
    });
    const ids = new Set(res.map((r) => r.task.id));
    expect(ids.has(ta)).toBe(true);
    expect(ids.has(tb)).toBe(true);
    expect(ids.has(tc)).toBe(false);
  });

  it('semanticSearchEntities honors touchesAnyOf via contextIds for non-task types', async () => {
    const dealX = (
      await mem.upsertEntity(
        { type: 'deal', displayName: 'Deal X', identifiers: [{ kind: 'canonical', value: 'd:x' }] },
        scope,
      )
    ).entity.id;
    const dealY = (
      await mem.upsertEntity(
        { type: 'deal', displayName: 'Deal Y', identifiers: [{ kind: 'canonical', value: 'd:y' }] },
        scope,
      )
    ).entity.id;

    const onX = (
      await mem.upsertEntity(
        {
          type: 'topic',
          displayName: 'Pricing concern',
          identifiers: [{ kind: 'canonical', value: 'topic:px' }],
          metadata: { description: 'pricing concern' },
          contextIds: [dealX],
        },
        scope,
      )
    ).entity.id;
    const onY = (
      await mem.upsertEntity(
        {
          type: 'topic',
          displayName: 'Pricing concern',
          identifiers: [{ kind: 'canonical', value: 'topic:py' }],
          metadata: { description: 'pricing concern' },
          contextIds: [dealY],
        },
        scope,
      )
    ).entity.id;
    await mem.flushEmbeddings();

    // touchesAnyOf lives on the filter argument (EntitySemanticSearchFilter),
    // not on opts. For a non-task type it matches contextIds membership only.
    const scoped = await mem.semanticSearchEntities(
      'pricing concern',
      { type: 'topic', touchesAnyOf: [dealX] },
      scope,
      { topK: 10 },
    );
    const ids = new Set(scoped.map((r) => r.entity.id));
    expect(ids.has(onX)).toBe(true);
    expect(ids.has(onY)).toBe(false);
  });

  it('InMemory now honors single touchesEntity for entity semantic search (parity fix)', async () => {
    const alice = await person('Alice', 'alice2@x.com');
    const bob = await person('Bob', 'bob2@x.com');

    const ta = (
      await mem.upsertEntity(
        {
          type: 'task',
          displayName: 'Sync',
          identifiers: [{ kind: 'canonical', value: 't:sync-a' }],
          metadata: { state: 'pending', assigneeId: alice },
        },
        scope,
      )
    ).entity.id;
    await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Sync',
        identifiers: [{ kind: 'canonical', value: 't:sync-b' }],
        metadata: { state: 'pending', assigneeId: bob },
      },
      scope,
    );
    await mem.flushEmbeddings();

    const res = await mem.findSimilarOpenTasks('sync', scope, {
      topK: 10,
      touchesEntity: alice,
    });
    expect(res.map((r) => r.task.id)).toEqual([ta]);
  });

  it('touchesEntity AND touchesAnyOf intersect when both are set (not union)', async () => {
    const alice = await person('Alice', 'alice3@x.com');
    const carol = await person('Carol', 'carol3@x.com');
    const projX = (
      await mem.upsertEntity(
        { type: 'project', displayName: 'Project X', identifiers: [{ kind: 'canonical', value: 'proj:x' }] },
        scope,
      )
    ).entity.id;

    // Touched by alice AND projX — the only task that satisfies the AND.
    const both = (
      await mem.upsertEntity(
        {
          type: 'task',
          displayName: 'Plan',
          identifiers: [{ kind: 'canonical', value: 't:both' }],
          metadata: { state: 'pending', assigneeId: alice },
          contextIds: [projX],
        },
        scope,
      )
    ).entity.id;
    // Touched by alice only — must be excluded (fails the touchesAnyOf arm).
    await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Plan',
        identifiers: [{ kind: 'canonical', value: 't:alice-only' }],
        metadata: { state: 'pending', assigneeId: alice },
      },
      scope,
    );
    // Touched by projX only — must be excluded (fails the touchesEntity arm).
    await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Plan',
        identifiers: [{ kind: 'canonical', value: 't:projx-only' }],
        metadata: { state: 'pending', assigneeId: carol },
        contextIds: [projX],
      },
      scope,
    );
    await mem.flushEmbeddings();

    const res = await mem.findSimilarOpenTasks('plan', scope, {
      topK: 10,
      touchesEntity: alice,
      touchesAnyOf: [projX],
    });
    // AND semantics: only the task touched by BOTH anchors survives. A union
    // (the prior in-memory bug) would have returned all three.
    expect(res.map((r) => r.task.id)).toEqual([both]);
  });
});
