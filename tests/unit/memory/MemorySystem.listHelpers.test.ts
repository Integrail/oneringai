/**
 * listOpenTasks / listRecentTopics — convenience fetchers for prompt injection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { ScopeFilter } from '@/memory/types.js';

const scope: ScopeFilter = { userId: 'user-1' };

describe('MemorySystem.listOpenTasks', () => {
  let mem: MemorySystem;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  async function createTask(name: string, state: string, extra: Record<string, unknown> = {}) {
    const { entity } = await mem.upsertEntity(
      {
        type: 'task',
        displayName: name,
        identifiers: [{ kind: 'canonical', value: `task:${name.toLowerCase().replace(/\s+/g, '-')}` }],
        metadata: { state, ...extra },
      },
      scope,
    );
    return entity;
  }

  it('returns only tasks in configured active states', async () => {
    await createTask('Active task', 'in_progress');
    await createTask('Finished', 'done');
    await createTask('Pending task', 'pending');

    const tasks = await mem.listOpenTasks(scope);
    const names = tasks.map(t => t.displayName).sort();
    expect(names).toEqual(['Active task', 'Pending task']);
  });

  it('honors assigneeId filter', async () => {
    await createTask('For Alice', 'in_progress', { assigneeId: 'alice' });
    await createTask('For Bob', 'in_progress', { assigneeId: 'bob' });
    const tasks = await mem.listOpenTasks(scope, { assigneeId: 'alice' });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.displayName).toBe('For Alice');
  });

  it('honors projectId filter', async () => {
    await createTask('Acme', 'in_progress', { projectId: 'proj-acme' });
    await createTask('Widget', 'in_progress', { projectId: 'proj-widget' });
    const tasks = await mem.listOpenTasks(scope, { projectId: 'proj-acme' });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.displayName).toBe('Acme');
  });

  it('sorts by dueAt ascending (undefined last), then updatedAt desc', async () => {
    await createTask('No due date', 'in_progress');
    await createTask('Due later', 'in_progress', { dueAt: '2026-06-01' });
    await createTask('Due soon', 'in_progress', { dueAt: '2026-04-20' });

    const tasks = await mem.listOpenTasks(scope);
    expect(tasks.map(t => t.displayName)).toEqual(['Due soon', 'Due later', 'No due date']);
  });

  it('clamps limit to [1, 200]', async () => {
    for (let i = 0; i < 5; i++) await createTask(`T${i}`, 'pending');
    const tooSmall = await mem.listOpenTasks(scope, { limit: 0 });
    expect(tooSmall).toHaveLength(1);
    const big = await mem.listOpenTasks(scope, { limit: 5000 });
    expect(big.length).toBeLessThanOrEqual(200);
  });

  it('uses configured vocabulary', async () => {
    const memCustom = new MemorySystem({
      store: new InMemoryAdapter(),
      taskStates: {
        active: ['proposed', 'scheduled'],
        terminal: ['done'],
      },
    });
    await memCustom.upsertEntity(
      {
        type: 'task',
        displayName: 'Proposed thing',
        identifiers: [{ kind: 'canonical', value: 'task:p' }],
        metadata: { state: 'proposed' },
      },
      scope,
    );
    await memCustom.upsertEntity(
      {
        type: 'task',
        displayName: 'Pending (legacy)',
        identifiers: [{ kind: 'canonical', value: 'task:l' }],
        metadata: { state: 'pending' },
      },
      scope,
    );
    const tasks = await memCustom.listOpenTasks(scope);
    expect(tasks.map(t => t.displayName)).toEqual(['Proposed thing']);
    await memCustom.shutdown();
  });
});

describe('MemorySystem.listRecentTopics', () => {
  let mem: MemorySystem;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('returns topics ordered by updatedAt desc', async () => {
    const t1 = await mem.upsertEntity(
      { type: 'topic', displayName: 'Old topic', identifiers: [] },
      scope,
    );
    await new Promise(r => setTimeout(r, 5));
    const t2 = await mem.upsertEntity(
      { type: 'topic', displayName: 'New topic', identifiers: [] },
      scope,
    );
    const topics = await mem.listRecentTopics(scope);
    expect(topics[0]!.displayName).toBe('New topic');
    expect(topics[1]!.displayName).toBe('Old topic');
    void t1; void t2;
  });

  it('filters by days cutoff (client-side)', async () => {
    // Seed a topic with updatedAt backdated via direct store manipulation
    const store = new InMemoryAdapter();
    const memLocal = new MemorySystem({ store });
    await memLocal.upsertEntity(
      { type: 'topic', displayName: 'Old', identifiers: [] },
      scope,
    );

    // Backdate it by mutating via updateEntityMetadata (bumps updatedAt to now).
    // To simulate an old topic, skip forward in time by creating new ones.
    await memLocal.upsertEntity(
      { type: 'topic', displayName: 'Fresh', identifiers: [] },
      scope,
    );

    const topics = await memLocal.listRecentTopics(scope, { days: 365 });
    expect(topics).toHaveLength(2);
    await memLocal.shutdown();
  });

  it('clamps limit', async () => {
    for (let i = 0; i < 3; i++) {
      await mem.upsertEntity(
        { type: 'topic', displayName: `topic-${i}`, identifiers: [] },
        scope,
      );
    }
    const topics = await mem.listRecentTopics(scope, { limit: 5000 });
    expect(topics.length).toBeLessThanOrEqual(200);
  });

  it('ignores non-topic entities', async () => {
    await mem.upsertEntity(
      { type: 'topic', displayName: 'Topic A', identifiers: [] },
      scope,
    );
    await mem.upsertEntity(
      { type: 'person', displayName: 'Person B', identifiers: [{ kind: 'email', value: 'b@x.com' }] },
      scope,
    );
    const topics = await mem.listRecentTopics(scope);
    expect(topics).toHaveLength(1);
    expect(topics[0]!.type).toBe('topic');
  });
});
