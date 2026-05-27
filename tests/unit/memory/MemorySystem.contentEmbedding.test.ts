/**
 * Content-embedding lifecycle tests — verifies that every entity mutation
 * path enqueues content embedding when the composed text changes, and that
 * `findSimilarOpenTasks` ranks by metadata-aware composed text rather than
 * raw displayName-only identity embedding.
 *
 * The deterministic token-axis embedder lets us assert ordering: two tasks
 * with identical titles but different assignees should produce semantically
 * distinct embeddings.
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

describe('content embedding — populated on create', () => {
  let mem: MemorySystem;
  let embedder: ReturnType<typeof makeEmbedder>;

  beforeEach(() => {
    embedder = makeEmbedder();
    mem = new MemorySystem({ store: new InMemoryAdapter(), embedder });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('createEntity (task) populates contentEmbedding + contentEmbeddingText', async () => {
    const res = await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Deploy frontend',
        identifiers: [{ kind: 'canonical', value: 'task:deploy-fe' }],
        metadata: { state: 'pending', priority: 'high' },
      },
      scope,
    );
    await mem.flushEmbeddings();
    const refreshed = await mem.getEntity(res.entity.id, scope);
    expect(refreshed?.contentEmbedding).toBeDefined();
    expect(refreshed?.contentEmbedding!.length).toBe(TOKEN_DIM);
    expect(refreshed?.contentEmbeddingText).toContain('task: Deploy frontend');
    expect(refreshed?.contentEmbeddingText).toContain('State: pending');
    expect(refreshed?.contentEmbeddingText).toContain('Priority: high');
  });

  it('person entity also gets contentEmbedding (not document-only anymore)', async () => {
    const res = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Sarah Chen',
        identifiers: [{ kind: 'email', value: 'sarah@acme.com' }],
        metadata: { role: 'Senior Engineer' },
      },
      scope,
    );
    await mem.flushEmbeddings();
    const refreshed = await mem.getEntity(res.entity.id, scope);
    expect(refreshed?.contentEmbedding).toBeDefined();
    expect(refreshed?.contentEmbeddingText).toContain('person: Sarah Chen');
    expect(refreshed?.contentEmbeddingText).toContain('Role: Senior Engineer');
  });

  it('skips content embedding for unregistered entity types', async () => {
    const res = await mem.upsertEntity(
      {
        type: 'unregistered-type',
        displayName: 'X',
        identifiers: [{ kind: 'canonical', value: 'x:1' }],
      },
      scope,
    );
    await mem.flushEmbeddings();
    const refreshed = await mem.getEntity(res.entity.id, scope);
    expect(refreshed?.contentEmbedding).toBeUndefined();
    expect(refreshed?.contentEmbeddingText).toBeUndefined();
    // Identity embedding still populated (always-on for any type with an embedder).
    expect(refreshed?.identityEmbedding).toBeDefined();
  });
});

describe('content embedding — re-embed on metadata change', () => {
  let mem: MemorySystem;
  let embedder: ReturnType<typeof makeEmbedder>;

  beforeEach(() => {
    embedder = makeEmbedder();
    mem = new MemorySystem({ store: new InMemoryAdapter(), embedder });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  async function createTask(name: string, metadata: Record<string, unknown> = {}) {
    const r = await mem.upsertEntity(
      {
        type: 'task',
        displayName: name,
        identifiers: [{ kind: 'canonical', value: `task:${name}` }],
        metadata: { state: 'pending', ...metadata },
      },
      scope,
    );
    await mem.flushEmbeddings();
    return r.entity.id;
  }

  it('updateEntityMetadata triggers re-embed when composed text changes', async () => {
    const id = await createTask('Investigate bug');
    const beforeCalls = embedder.embed.mock.calls.length;

    await mem.updateEntityMetadata(id, { priority: 'critical', description: 'P0 outage' }, scope);
    await mem.flushEmbeddings();

    const afterCalls = embedder.embed.mock.calls.length;
    expect(afterCalls).toBeGreaterThan(beforeCalls);

    const refreshed = await mem.getEntity(id, scope);
    expect(refreshed?.contentEmbeddingText).toContain('Priority: critical');
    expect(refreshed?.contentEmbeddingText).toContain('Description: P0 outage');
  });

  it('transitionTaskState triggers re-embed (state appears in composed text)', async () => {
    const id = await createTask('Ship feature');
    const beforeCalls = embedder.embed.mock.calls.length;

    await mem.transitionTaskState(id, 'in_progress', {}, scope);
    await mem.flushEmbeddings();

    const afterCalls = embedder.embed.mock.calls.length;
    expect(afterCalls).toBeGreaterThan(beforeCalls);

    const refreshed = await mem.getEntity(id, scope);
    expect(refreshed?.contentEmbeddingText).toContain('State: in_progress');
  });

  it('addEntityContextIds triggers re-embed (contextIds composed into text)', async () => {
    const id = await createTask('Generic task');
    const projectRes = await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'Q3 Release',
        identifiers: [{ kind: 'canonical', value: 'proj:q3' }],
      },
      scope,
    );
    await mem.flushEmbeddings();

    const beforeCalls = embedder.embed.mock.calls.length;
    await mem.addEntityContextIds(id, [projectRes.entity.id], scope);
    await mem.flushEmbeddings();

    const afterCalls = embedder.embed.mock.calls.length;
    expect(afterCalls).toBeGreaterThan(beforeCalls);

    const refreshed = await mem.getEntity(id, scope);
    expect(refreshed?.contentEmbeddingText).toContain('Context: Q3 Release');
  });

  it('does NOT re-embed when metadata change produces identical composed text', async () => {
    const id = await createTask('Stable task', { state: 'pending' });
    const beforeCalls = embedder.embed.mock.calls.length;

    // Same metadata → updateEntityMetadata still bumps version, but the
    // composer output is identical, so we should NOT pay for an embed.
    await mem.updateEntityMetadata(id, { state: 'pending' }, scope);
    await mem.flushEmbeddings();

    const afterCalls = embedder.embed.mock.calls.length;
    expect(afterCalls).toBe(beforeCalls);
  });

  it('terminal state transition embeds completedAt — so semantic search no longer ranks the task', async () => {
    const id = await createTask('Old task');
    await mem.transitionTaskState(id, 'done', {}, scope);
    await mem.flushEmbeddings();

    const refreshed = await mem.getEntity(id, scope);
    expect(refreshed?.contentEmbeddingText).toContain('State: done');
    expect(refreshed?.contentEmbeddingText).toContain('Completed:');
  });
});

describe('content embedding — semantic search is metadata-aware', () => {
  let mem: MemorySystem;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter(), embedder: makeEmbedder() });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('findSimilarOpenTasks now uses contentEmbedding (not identity)', async () => {
    // Two tasks share identical title — only distinguishable by metadata.
    const aliceId = (
      await mem.upsertEntity(
        {
          type: 'person',
          displayName: 'Alice Anderson',
          identifiers: [{ kind: 'email', value: 'alice@x.com' }],
        },
        scope,
      )
    ).entity.id;
    const bobId = (
      await mem.upsertEntity(
        {
          type: 'person',
          displayName: 'Bob Baker',
          identifiers: [{ kind: 'email', value: 'bob@x.com' }],
        },
        scope,
      )
    ).entity.id;

    await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Follow up',
        identifiers: [{ kind: 'canonical', value: 'task:fu1' }],
        metadata: { state: 'pending', assigneeId: aliceId },
      },
      scope,
    );
    await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Follow up',
        identifiers: [{ kind: 'canonical', value: 'task:fu2' }],
        metadata: { state: 'pending', assigneeId: bobId },
      },
      scope,
    );
    await mem.flushEmbeddings();

    // Query mentions Alice — should rank the Alice-assigned task above the Bob one.
    const res = await mem.findSimilarOpenTasks('Alice Anderson follow up', scope, {
      topK: 2,
    });
    expect(res.length).toBe(2);
    const aliceTask = res.find((r) => {
      const m = r.task.metadata as Record<string, unknown> | undefined;
      return m?.assigneeId === aliceId;
    });
    const bobTask = res.find((r) => {
      const m = r.task.metadata as Record<string, unknown> | undefined;
      return m?.assigneeId === bobId;
    });
    expect(aliceTask).toBeDefined();
    expect(bobTask).toBeDefined();
    // Alice should outrank Bob given the query mentions her.
    expect(aliceTask!.score).toBeGreaterThan(bobTask!.score);
  });

  it('terminal tasks excluded via state pre-filter', async () => {
    const t1 = await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Open work',
        identifiers: [{ kind: 'canonical', value: 't:1' }],
        metadata: { state: 'pending' },
      },
      scope,
    );
    const t2 = await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Old work',
        identifiers: [{ kind: 'canonical', value: 't:2' }],
        metadata: { state: 'pending' },
      },
      scope,
    );
    await mem.flushEmbeddings();
    await mem.transitionTaskState(t2.entity.id, 'done', {}, scope);
    await mem.flushEmbeddings();

    const res = await mem.findSimilarOpenTasks('work', scope, { topK: 5 });
    const ids = res.map((r) => r.task.id);
    expect(ids).toContain(t1.entity.id);
    expect(ids).not.toContain(t2.entity.id);
  });

  it('assigneeId narrow constrains semantic search to specific user', async () => {
    const aliceId = (
      await mem.upsertEntity(
        {
          type: 'person',
          displayName: 'Alice',
          identifiers: [{ kind: 'email', value: 'alice@x.com' }],
        },
        scope,
      )
    ).entity.id;
    const bobId = (
      await mem.upsertEntity(
        {
          type: 'person',
          displayName: 'Bob',
          identifiers: [{ kind: 'email', value: 'bob@x.com' }],
        },
        scope,
      )
    ).entity.id;
    await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Alice task',
        identifiers: [{ kind: 'canonical', value: 't:a' }],
        metadata: { state: 'pending', assigneeId: aliceId },
      },
      scope,
    );
    await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Bob task',
        identifiers: [{ kind: 'canonical', value: 't:b' }],
        metadata: { state: 'pending', assigneeId: bobId },
      },
      scope,
    );
    await mem.flushEmbeddings();

    const res = await mem.findSimilarOpenTasks('task', scope, {
      topK: 5,
      assigneeId: aliceId,
    });
    expect(res.length).toBe(1);
    expect(res[0]!.task.displayName).toBe('Alice task');
  });
});

describe('fact embedding — composer drives every fact, no more 80-char gate', () => {
  let mem: MemorySystem;
  let embedder: ReturnType<typeof makeEmbedder>;

  beforeEach(() => {
    embedder = makeEmbedder();
    mem = new MemorySystem({ store: new InMemoryAdapter(), embedder });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('short atomic fact (Sarah works_at Acme) gets embedded', async () => {
    const sarah = (
      await mem.upsertEntity(
        {
          type: 'person',
          displayName: 'Sarah Chen',
          identifiers: [{ kind: 'email', value: 'sarah@acme.com' }],
        },
        scope,
      )
    ).entity.id;
    const acme = (
      await mem.upsertEntity(
        {
          type: 'organization',
          displayName: 'Acme Corp',
          identifiers: [{ kind: 'domain', value: 'acme.com' }],
        },
        scope,
      )
    ).entity.id;
    const fact = await mem.addFact(
      { subjectId: sarah, predicate: 'works_at', kind: 'atomic', objectId: acme },
      scope,
    );
    await mem.flushEmbeddings();

    const refreshed = (await mem.getEntity(sarah, scope))!;
    expect(refreshed).toBeDefined();
    // The fact itself should now be embedded — pre-composer the 80-char gate
    // skipped this fact entirely. The composed text is recorded in the
    // library-owned `embeddingText` field (NOT `summaryForEmbedding`, which
    // is caller-owned and stays undefined unless the caller supplied it).
    const fetched = await mem.getFact(fact.id, scope);
    expect(fetched?.embedding).toBeDefined();
    expect(fetched?.embeddingText).toContain('Sarah Chen works_at Acme Corp');
    expect(fetched?.summaryForEmbedding).toBeUndefined();
  });

  it('isSemantic: false opt-out still suppresses embedding', async () => {
    const sarah = (
      await mem.upsertEntity(
        {
          type: 'person',
          displayName: 'Sarah',
          identifiers: [{ kind: 'email', value: 's@x.com' }],
        },
        scope,
      )
    ).entity.id;
    const fact = await mem.addFact(
      {
        subjectId: sarah,
        predicate: 'observed_at',
        kind: 'atomic',
        value: '2026-05-27',
        isSemantic: false,
      },
      scope,
    );
    await mem.flushEmbeddings();

    const fetched = await mem.getFact(fact.id, scope);
    expect(fetched?.embedding).toBeUndefined();
  });

  it('updateFact value change triggers re-embed (composer reads value)', async () => {
    const subj = (
      await mem.upsertEntity(
        {
          type: 'person',
          displayName: 'Sarah',
          identifiers: [{ kind: 'email', value: 's@x.com' }],
        },
        scope,
      )
    ).entity.id;
    const fact = await mem.addFact(
      { subjectId: subj, predicate: 'has_role', kind: 'atomic', value: 'Engineer' },
      scope,
    );
    await mem.flushEmbeddings();

    const beforeCalls = embedder.embed.mock.calls.length;
    const beforeText = (await mem.getFact(fact.id, scope))?.embeddingText;
    expect(beforeText).toContain('Engineer');

    await mem.updateFact(fact.id, { value: 'Senior Engineer' }, scope);
    await mem.flushEmbeddings();

    const afterCalls = embedder.embed.mock.calls.length;
    expect(afterCalls).toBeGreaterThan(beforeCalls);
    const afterText = (await mem.getFact(fact.id, scope))?.embeddingText;
    expect(afterText).toContain('Senior Engineer');
  });

  it('caller-supplied summaryForEmbedding on atomic fact survives the embed round-trip', async () => {
    const subj = (
      await mem.upsertEntity(
        {
          type: 'person',
          displayName: 'Sarah',
          identifiers: [{ kind: 'email', value: 's@x.com' }],
        },
        scope,
      )
    ).entity.id;
    const callerSummary = 'Sarah leads the payments-platform team and owns checkout reliability.';
    const fact = await mem.addFact(
      {
        subjectId: subj,
        predicate: 'role_narrative',
        kind: 'atomic',
        value: 'lead',
        summaryForEmbedding: callerSummary,
      },
      scope,
    );
    await mem.flushEmbeddings();

    const fetched = await mem.getFact(fact.id, scope);
    // Caller's summary is preserved untouched.
    expect(fetched?.summaryForEmbedding).toBe(callerSummary);
    // Library-owned diff anchor records exactly what was embedded.
    expect(fetched?.embeddingText).toBe(callerSummary);
    expect(fetched?.embedding).toBeDefined();
  });

  it('updateFact details-only patch preserves caller-supplied summaryForEmbedding', async () => {
    const subj = (
      await mem.upsertEntity(
        {
          type: 'person',
          displayName: 'Sarah',
          identifiers: [{ kind: 'email', value: 's@x.com' }],
        },
        scope,
      )
    ).entity.id;
    const callerSummary = 'Custom override text from caller.';
    const fact = await mem.addFact(
      {
        subjectId: subj,
        predicate: 'note',
        kind: 'atomic',
        value: 'x',
        details: 'initial details',
        summaryForEmbedding: callerSummary,
      },
      scope,
    );
    await mem.flushEmbeddings();

    await mem.updateFact(fact.id, { details: 'updated details' }, scope);
    await mem.flushEmbeddings();

    const fetched = await mem.getFact(fact.id, scope);
    // Caller's summary survives — only library-owned embeddingText is overwritten.
    expect(fetched?.summaryForEmbedding).toBe(callerSummary);
    // Composer still returns the caller override, so embeddingText matches it.
    expect(fetched?.embeddingText).toBe(callerSummary);
  });
});

describe('content embedding — backfillContentEmbeddings', () => {
  let mem: MemorySystem;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter(), embedder: makeEmbedder() });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('queues content embedding for entities with missing/stale embeddings', async () => {
    // Create entities normally (which already populates content embedding on create).
    await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'T1',
        identifiers: [{ kind: 'canonical', value: 't:1' }],
        metadata: { state: 'pending' },
      },
      scope,
    );
    await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'T2',
        identifiers: [{ kind: 'canonical', value: 't:2' }],
        metadata: { state: 'pending' },
      },
      scope,
    );
    await mem.flushEmbeddings();

    // Re-running backfill should skip already-correct entries.
    const res = await mem.backfillContentEmbeddings(scope, { types: ['task'] });
    expect(res.scanned).toBe(2);
    expect(res.queued).toBe(0); // both already up-to-date
    expect(res.skipped).toBe(2);
  });

  it('rejects when no embedder configured', async () => {
    const noEmbedMem = new MemorySystem({ store: new InMemoryAdapter() });
    try {
      await expect(noEmbedMem.backfillContentEmbeddings(scope)).rejects.toThrow(
        /no embedder configured/,
      );
    } finally {
      await noEmbedMem.shutdown();
    }
  });
});
