/**
 * Task-state vocabulary configuration — drives which states getContext
 * surfaces as open in relatedTasks.
 */

import { describe, it, expect } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { ScopeFilter } from '@/memory/types.js';

const scope: ScopeFilter = { userId: 'user-1' };

describe('MemorySystemConfig.taskStates', () => {
  it('default vocabulary preserves legacy behavior', () => {
    const mem = new MemorySystem({ store: new InMemoryAdapter() });
    expect(mem.taskStates.active).toEqual(['pending', 'in_progress', 'blocked', 'deferred']);
    expect(mem.taskStates.terminal).toEqual(['done', 'cancelled']);
  });

  it('accepts custom vocabulary', () => {
    const mem = new MemorySystem({
      store: new InMemoryAdapter(),
      taskStates: {
        active: ['proposed', 'scheduled', 'in_progress'],
        terminal: ['done', 'cancelled'],
      },
    });
    expect(mem.taskStates.active).toContain('proposed');
  });

  it('rejects empty active', () => {
    expect(() =>
      new MemorySystem({
        store: new InMemoryAdapter(),
        taskStates: { active: [], terminal: ['done'] },
      }),
    ).toThrow(/active/);
  });

  it('rejects empty terminal', () => {
    expect(() =>
      new MemorySystem({
        store: new InMemoryAdapter(),
        taskStates: { active: ['open'], terminal: [] },
      }),
    ).toThrow(/terminal/);
  });

  it('rejects overlap between active and terminal', () => {
    expect(() =>
      new MemorySystem({
        store: new InMemoryAdapter(),
        taskStates: { active: ['open', 'done'], terminal: ['done'] },
      }),
    ).toThrow(/disjoint/);
  });

  it('rejects duplicates within active', () => {
    expect(() =>
      new MemorySystem({
        store: new InMemoryAdapter(),
        taskStates: { active: ['open', 'open'], terminal: ['done'] },
      }),
    ).toThrow(/duplicates/);
  });

  it('taskStates getter returns a copy (mutation does not affect behavior)', () => {
    const mem = new MemorySystem({ store: new InMemoryAdapter() });
    const snapshot = mem.taskStates;
    snapshot.active.push('mutated');
    expect(mem.taskStates.active).not.toContain('mutated');
  });

  it('getContext uses configured active states for relatedTasks', async () => {
    const store = new InMemoryAdapter();
    const mem = new MemorySystem({
      store,
      taskStates: {
        active: ['proposed', 'scheduled', 'in_progress'],
        terminal: ['done', 'cancelled'],
      },
    });

    const person = await mem.upsertEntity(
      { type: 'person', displayName: 'Alice', identifiers: [{ kind: 'email', value: 'a@x.com' }] },
      scope,
    );

    // Task with v25-style state 'proposed' — should surface under new config
    await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Review budget',
        identifiers: [{ kind: 'canonical', value: 'task:review-budget' }],
        metadata: { state: 'proposed', assigneeId: person.entity.id },
      },
      scope,
    );

    // Task with legacy state — should NOT surface since it's not in active
    await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Old legacy task',
        identifiers: [{ kind: 'canonical', value: 'task:old' }],
        metadata: { state: 'pending', assigneeId: person.entity.id },
      },
      scope,
    );

    const view = await mem.getContext(person.entity.id, {}, scope);
    const taskNames = (view.relatedTasks ?? []).map(t => t.task.displayName);
    expect(taskNames).toContain('Review budget');
    expect(taskNames).not.toContain('Old legacy task');

    await mem.shutdown();
  });

  it('default config surfaces pending tasks (regression — legacy behavior preserved)', async () => {
    const store = new InMemoryAdapter();
    const mem = new MemorySystem({ store });
    const person = await mem.upsertEntity(
      { type: 'person', displayName: 'B', identifiers: [{ kind: 'email', value: 'b@x.com' }] },
      scope,
    );
    await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'T',
        identifiers: [{ kind: 'canonical', value: 'task:t' }],
        metadata: { state: 'pending', assigneeId: person.entity.id },
      },
      scope,
    );
    const view = await mem.getContext(person.entity.id, {}, scope);
    expect(view.relatedTasks).toHaveLength(1);
    await mem.shutdown();
  });
});
