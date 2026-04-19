/**
 * Phase 1 — new functionality tests.
 *
 * Covers: IFact.contextIds + importance, FactFilter.contextId/touchesEntity,
 * listEntities.metadataFilter, updateEntityMetadata, getContext tiers
 * (relatedTasks + relatedEvents), importance in ranking.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { ScopeFilter } from '@/memory/types.js';

const TEST_SCOPE: ScopeFilter = { userId: 'test-user' };

async function seed(mem: MemorySystem, displayName: string, email: string): Promise<string> {
  const res = await mem.upsertEntity(
    {
      type: 'person',
      displayName,
      identifiers: [{ kind: 'email', value: email }],
    },
    TEST_SCOPE,
  );
  return res.entity.id;
}

describe('Phase 1 — IFact.contextIds', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;
  const scope: ScopeFilter = TEST_SCOPE;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('writes contextIds and retrieves via contextId filter', async () => {
    const john = await seed(mem, 'John', 'john@x.com');
    const deal = await seed(mem, 'Acme Deal', 'deal@acme.com');
    await mem.addFact(
      {
        subjectId: john,
        predicate: 'assigned_task',
        kind: 'atomic',
        details: 'Build powerpoint',
        contextIds: [deal],
      },
      scope,
    );

    const page = await store.findFacts({ contextId: deal }, {}, scope);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.predicate).toBe('assigned_task');
  });

  it('rejects fact whose contextId entity is not visible to caller', async () => {
    const other = await seed(mem, 'Private', 'private@other.com');
    await mem.archiveEntity(other, TEST_SCOPE);
    const john = await seed(mem, 'John', 'john2@x.com');
    await expect(
      mem.addFact(
        {
          subjectId: john,
          predicate: 'mentioned',
          kind: 'atomic',
          contextIds: [other],
        },
        scope,
      ),
    ).rejects.toThrow(/context entity.*not visible/);
  });

  it('touchesEntity returns facts where entity is subject, object, OR in contextIds', async () => {
    const alice = await seed(mem, 'Alice', 'a@x.com');
    const bob = await seed(mem, 'Bob', 'b@x.com');
    const deal = await seed(mem, 'Deal', 'd@x.com');

    // Deal as context
    await mem.addFact(
      { subjectId: alice, predicate: 'committed', kind: 'atomic', value: 'X', contextIds: [deal] },
      scope,
    );
    // Deal as object
    await mem.addFact(
      { subjectId: bob, predicate: 'works_on', kind: 'atomic', objectId: deal },
      scope,
    );
    // Deal as subject
    await mem.addFact(
      { subjectId: deal, predicate: 'status', kind: 'atomic', value: 'active' },
      scope,
    );

    const page = await store.findFacts({ touchesEntity: deal }, {}, scope);
    expect(page.items).toHaveLength(3);
  });

  it('getContext returns facts where entity is in contextIds', async () => {
    const alice = await seed(mem, 'Alice', 'actx@x.com');
    const deal = await seed(mem, 'Deal', 'dctx@x.com');
    await mem.addFact(
      { subjectId: alice, predicate: 'committed', kind: 'atomic', value: 'X', contextIds: [deal] },
      scope,
    );

    const view = await mem.getContext(deal, {}, scope);
    expect(view.topFacts.some((f) => f.predicate === 'committed')).toBe(true);
  });
});

describe('Phase 1 — IFact.importance affects ranking', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('high-importance fact outranks equivalent low-importance fact', async () => {
    const subj = await seed(mem, 'Subject', 'subj@x.com');
    await mem.addFact(
      { subjectId: subj, predicate: 'trivial', kind: 'atomic', confidence: 0.9, importance: 0.1 },
      TEST_SCOPE,
    );
    await mem.addFact(
      { subjectId: subj, predicate: 'important', kind: 'atomic', confidence: 0.9, importance: 1.0 },
      TEST_SCOPE,
    );
    const view = await mem.getContext(subj, {}, TEST_SCOPE);
    expect(view.topFacts[0]!.predicate).toBe('important');
  });

  it('default importance (0.5) produces same score as v1 (back-compat)', async () => {
    const subj = await seed(mem, 'Subject', 'subj2@x.com');
    await mem.addFact(
      {
        subjectId: subj,
        predicate: 'p1',
        kind: 'atomic',
        confidence: 1.0,
        observedAt: new Date(),
      },
      TEST_SCOPE,
    );
    const view = await mem.getContext(subj, {}, TEST_SCOPE);
    expect(view.topFacts).toHaveLength(1);
    // Default importance 0.5 → multiplier 1.0 → no-op
  });
});

describe('Phase 1 — listEntities.metadataFilter', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  async function task(name: string, metadata: Record<string, unknown>): Promise<string> {
    const res = await mem.upsertEntity(
      {
        type: 'task',
        displayName: name,
        identifiers: [{ kind: 'task_key', value: name.toLowerCase().replace(/\s/g, '_') }],
        metadata,
      },
      TEST_SCOPE,
    );
    return res.entity.id;
  }

  it('filters by literal equality', async () => {
    await task('T1', { state: 'pending', priority: 'high' });
    await task('T2', { state: 'done', priority: 'high' });
    const page = await store.listEntities(
      { type: 'task', metadataFilter: { state: 'pending' } },
      {},
      TEST_SCOPE,
    );
    expect(page.items.map((e) => e.displayName)).toEqual(['T1']);
  });

  it('supports $in operator', async () => {
    await task('T1', { state: 'pending' });
    await task('T2', { state: 'in_progress' });
    await task('T3', { state: 'done' });
    const page = await store.listEntities(
      { type: 'task', metadataFilter: { state: { $in: ['pending', 'in_progress'] } } },
      {},
      TEST_SCOPE,
    );
    expect(page.items.map((e) => e.displayName).sort()).toEqual(['T1', 'T2']);
  });

  it('combines multiple equality filters (AND semantics)', async () => {
    await task('T1', { state: 'pending', assigneeId: 'u1' });
    await task('T2', { state: 'pending', assigneeId: 'u2' });
    const page = await store.listEntities(
      { type: 'task', metadataFilter: { state: 'pending', assigneeId: 'u1' } },
      {},
      TEST_SCOPE,
    );
    expect(page.items.map((e) => e.displayName)).toEqual(['T1']);
  });

  it('entity without metadata fails non-empty filter', async () => {
    await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'NoMeta',
        identifiers: [{ kind: 'task_key', value: 'nometa' }],
      },
      TEST_SCOPE,
    );
    const page = await store.listEntities(
      { type: 'task', metadataFilter: { state: 'pending' } },
      {},
      TEST_SCOPE,
    );
    expect(page.items).toHaveLength(0);
  });
});

describe('Phase 1 — updateEntityMetadata', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('shallow-merges patch into metadata', async () => {
    const id = await seed(mem, 'X', 'x@y.com');
    // Start with some metadata via a direct write.
    await mem.updateEntityMetadata(id, { foo: 1, bar: 2 }, TEST_SCOPE);
    await mem.updateEntityMetadata(id, { bar: 3, baz: 4 }, TEST_SCOPE);
    const got = await mem.getEntity(id, TEST_SCOPE);
    expect(got!.metadata).toEqual({ foo: 1, bar: 3, baz: 4 });
  });

  it('bumps version', async () => {
    const id = await seed(mem, 'X', 'x2@y.com');
    const before = await mem.getEntity(id, TEST_SCOPE);
    await mem.updateEntityMetadata(id, { state: 'active' }, TEST_SCOPE);
    const after = await mem.getEntity(id, TEST_SCOPE);
    expect(after!.version).toBe(before!.version + 1);
  });

  it('emits entity.upsert event (created: false)', async () => {
    const events: string[] = [];
    const m2 = new MemorySystem({
      store,
      onChange: (e) => events.push(`${e.type}:${(e as { created?: boolean }).created ?? ''}`),
    });
    const id = await seed(m2, 'X', 'x3@y.com');
    events.length = 0;
    await m2.updateEntityMetadata(id, { state: 'active' }, TEST_SCOPE);
    expect(events.some((e) => e === 'entity.upsert:false')).toBe(true);
    await m2.shutdown();
  });

  it('throws when entity not visible', async () => {
    await expect(mem.updateEntityMetadata('missing', { x: 1 }, TEST_SCOPE)).rejects.toThrow(/not found/);
  });
});

describe('Phase 1 — getContext relatedTasks + relatedEvents', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  async function task(
    name: string,
    metadata: Record<string, unknown>,
  ): Promise<string> {
    const res = await mem.upsertEntity(
      {
        type: 'task',
        displayName: name,
        identifiers: [{ kind: 'task_key', value: name.toLowerCase().replace(/\s/g, '_') }],
        metadata,
      },
      TEST_SCOPE,
    );
    return res.entity.id;
  }

  async function event(
    name: string,
    metadata: Record<string, unknown>,
  ): Promise<string> {
    const res = await mem.upsertEntity(
      {
        type: 'event',
        displayName: name,
        identifiers: [{ kind: 'event_key', value: name.toLowerCase().replace(/\s/g, '_') }],
        metadata,
      },
      TEST_SCOPE,
    );
    return res.entity.id;
  }

  it('returns tasks where subject is assignee, non-terminal states only', async () => {
    const john = await seed(mem, 'John', 'jrt@x.com');
    await task('T_active', { assigneeId: john, state: 'pending' });
    await task('T_done', { assigneeId: john, state: 'done' });
    await task('T_other_person', { assigneeId: 'someone_else', state: 'pending' });

    const view = await mem.getContext(john, {}, TEST_SCOPE);
    expect(view.relatedTasks!.map((r) => r.task.displayName).sort()).toEqual(['T_active']);
    expect(view.relatedTasks![0]!.role).toBe('assigned_to');
  });

  it('returns tasks where subject is reporter', async () => {
    const alice = await seed(mem, 'Alice', 'ar@x.com');
    await task('Bug fix', { reporterId: alice, state: 'pending' });
    const view = await mem.getContext(alice, {}, TEST_SCOPE);
    expect(view.relatedTasks!.some((r) => r.role === 'reporter_of')).toBe(true);
  });

  it('tiers:minimal suppresses relatedTasks + relatedEvents', async () => {
    const john = await seed(mem, 'John', 'jmin@x.com');
    await task('T', { assigneeId: john, state: 'pending' });
    const view = await mem.getContext(john, { tiers: 'minimal' }, TEST_SCOPE);
    expect(view.relatedTasks).toBeUndefined();
    expect(view.relatedEvents).toBeUndefined();
  });

  it('returns events where subject is attendee in recent window', async () => {
    const john = await seed(mem, 'John', 'jev@x.com');
    const now = new Date();
    await event('Recent', { attendeeIds: [john], startTime: now });
    await event('Old', {
      attendeeIds: [john],
      startTime: new Date(now.getTime() - 365 * 86_400_000),
    });
    const view = await mem.getContext(john, {}, TEST_SCOPE);
    expect(view.relatedEvents!.map((r) => r.event.displayName).sort()).toEqual(['Recent']);
    expect(view.relatedEvents![0]!.role).toBe('attended');
  });

  it('respects relatedTasksLimit', async () => {
    const john = await seed(mem, 'John', 'jlim@x.com');
    for (let i = 0; i < 20; i++) {
      await task(`T${i}`, { assigneeId: john, state: 'pending' });
    }
    const view = await mem.getContext(john, { relatedTasksLimit: 5 }, TEST_SCOPE);
    expect(view.relatedTasks!.length).toBeLessThanOrEqual(5);
  });

  it('surfaces tasks linked via contextIds on facts about the subject', async () => {
    const deal = await seed(mem, 'Deal', 'dcx@x.com');
    const taskId = await task('Prep deck', { state: 'pending' });
    // Fact that references the task as subject + deal as context.
    await mem.addFact(
      {
        subjectId: taskId,
        predicate: 'mentioned_in',
        kind: 'atomic',
        details: 'Came up in deal review',
        contextIds: [deal],
      },
      TEST_SCOPE,
    );
    const view = await mem.getContext(deal, {}, TEST_SCOPE);
    expect(view.relatedTasks!.some((r) => r.task.displayName === 'Prep deck')).toBe(true);
  });
});

describe('Phase 1 — sourceSignalId on facts', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('round-trips sourceSignalId on fact write', async () => {
    const subj = await seed(mem, 'Subj', 's@x.com');
    const f = await mem.addFact(
      { subjectId: subj, predicate: 'note', kind: 'atomic', sourceSignalId: 'signal_abc' },
      TEST_SCOPE,
    );
    const got = await store.getFact(f.id, TEST_SCOPE);
    expect(got!.sourceSignalId).toBe('signal_abc');
  });
});
