/**
 * transitionTaskState — state machine helper.
 *
 * The library no longer writes an audit fact on transition (the `state_changed`
 * predicate was removed); `metadata.stateHistory` is the audit trail.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MemorySystem,
  InvalidTaskTransitionError,
} from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type {
  ScopeFilter,
  TaskStateHistoryEntry,
} from '@/memory/index.js';

const scope: ScopeFilter = { userId: 'user-1' };

async function seedTask(
  mem: MemorySystem,
  name: string,
  state: string,
  extra: Record<string, unknown> = {},
) {
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

describe('transitionTaskState', () => {
  let mem: MemorySystem;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('happy path: updates state and appends history', async () => {
    const task = await seedTask(mem, 'Review budget', 'in_progress');
    const result = await mem.transitionTaskState(
      task.id,
      'done',
      { signalId: 'sig-1', reason: 'Completed ahead of schedule' },
      scope,
    );
    expect(result.task.metadata?.state).toBe('done');
    const history = result.task.metadata?.stateHistory as TaskStateHistoryEntry[];
    expect(history).toHaveLength(1);
    expect(history[0]!.from).toBe('in_progress');
    expect(history[0]!.to).toBe('done');
    expect(history[0]!.signalId).toBe('sig-1');
    expect(history[0]!.reason).toBe('Completed ahead of schedule');
  });

  it('transition to terminal state sets completedAt (when unset)', async () => {
    const task = await seedTask(mem, 'A', 'in_progress');
    const at = new Date('2026-04-15T12:00:00Z');
    const result = await mem.transitionTaskState(task.id, 'done', { at }, scope);
    expect(result.task.metadata?.completedAt).toEqual(at);
  });

  it('transition to terminal does NOT overwrite existing completedAt', async () => {
    const existing = new Date('2026-01-01T00:00:00Z');
    const task = await seedTask(mem, 'B', 'in_progress', { completedAt: existing });
    const result = await mem.transitionTaskState(task.id, 'done', {}, scope);
    expect(result.task.metadata?.completedAt).toEqual(existing);
  });

  it('appends successive history entries without capping', async () => {
    const task = await seedTask(mem, 'C', 'pending');
    await mem.transitionTaskState(task.id, 'in_progress', { signalId: 's1' }, scope);
    await mem.transitionTaskState(task.id, 'blocked', { signalId: 's2' }, scope);
    const after = await mem.transitionTaskState(task.id, 'in_progress', { signalId: 's3' }, scope);
    const history = after.task.metadata?.stateHistory as TaskStateHistoryEntry[];
    expect(history.map(h => h.to)).toEqual(['in_progress', 'blocked', 'in_progress']);
  });

  it('no-op when from === to (same state)', async () => {
    const task = await seedTask(mem, 'D', 'in_progress');
    const result = await mem.transitionTaskState(task.id, 'in_progress', {}, scope);
    expect(result.task.version).toBe(task.version); // no write
  });

  it("validate='strict' throws on out-of-matrix transition and does NOT write", async () => {
    const task = await seedTask(mem, 'E', 'done');
    await expect(
      mem.transitionTaskState(
        task.id,
        'in_progress',
        {
          validate: 'strict',
          transitions: { pending: ['in_progress'], in_progress: ['done', 'blocked'], done: [] },
        },
        scope,
      ),
    ).rejects.toBeInstanceOf(InvalidTaskTransitionError);
    const fresh = await mem.getEntity(task.id, scope);
    expect(fresh!.metadata?.state).toBe('done');
  });

  it("validate='warn' proceeds even on out-of-matrix transitions", async () => {
    const onError = vi.fn();
    const memWithHook = new MemorySystem({
      store: new InMemoryAdapter(),
      onError: () => {},
    });
    const t = await memWithHook.upsertEntity(
      {
        type: 'task',
        displayName: 'T',
        identifiers: [{ kind: 'canonical', value: 'task:t' }],
        metadata: { state: 'done' },
      },
      scope,
    );
    const result = await memWithHook.transitionTaskState(
      t.entity.id,
      'in_progress',
      { transitions: { done: [] }, validate: 'warn' },
      scope,
    );
    expect(result.task.metadata?.state).toBe('in_progress');
    await memWithHook.shutdown();
    void onError;
  });

  it('throws when entity is not a task', async () => {
    const person = await mem.upsertEntity(
      { type: 'person', displayName: 'P', identifiers: [{ kind: 'email', value: 'p@x.com' }] },
      scope,
    );
    await expect(
      mem.transitionTaskState(person.entity.id, 'done', {}, scope),
    ).rejects.toThrow(/expected 'task'/);
  });

  it('throws on empty newState', async () => {
    const task = await seedTask(mem, 'F', 'pending');
    await expect(
      mem.transitionTaskState(task.id, '', {}, scope),
    ).rejects.toThrow(/non-empty/);
  });

  it('uses configured terminal vocabulary for completedAt logic', async () => {
    const memCustom = new MemorySystem({
      store: new InMemoryAdapter(),
      taskStates: {
        active: ['proposed', 'scheduled', 'in_progress'],
        terminal: ['shipped', 'cancelled'],
      },
    });
    const t = await memCustom.upsertEntity(
      {
        type: 'task',
        displayName: 'Custom',
        identifiers: [{ kind: 'canonical', value: 'task:custom' }],
        metadata: { state: 'in_progress' },
      },
      scope,
    );
    const result = await memCustom.transitionTaskState(t.entity.id, 'shipped', {}, scope);
    expect(result.task.metadata?.completedAt).toBeInstanceOf(Date);
    await memCustom.shutdown();
  });
});
