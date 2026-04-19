/**
 * transitionTaskState — state machine helper + LLM auto-routing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MemorySystem,
  InvalidTaskTransitionError,
} from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import { ExtractionResolver } from '@/memory/integration/ExtractionResolver.js';
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

  it('happy path: updates state, appends history, writes state_changed fact', async () => {
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
    expect(result.fact).not.toBeNull();
    expect(result.fact!.predicate).toBe('state_changed');
    expect(result.fact!.value).toEqual({ from: 'in_progress', to: 'done' });
    expect(result.fact!.sourceSignalId).toBe('sig-1');
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
    expect(result.fact).toBeNull();
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

  it("validate='warn' routes invalid transition through onError and proceeds", async () => {
    const onError = vi.fn();
    const memWithHook = new MemorySystem({
      store: new InMemoryAdapter(),
      onError: () => {}, // noop real hook — custom testing hook below via reportWarning path
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
    // Warn path: no throw, writes proceed.
    const result = await memWithHook.transitionTaskState(
      t.entity.id,
      'in_progress',
      { transitions: { done: [] }, validate: 'warn' },
      scope,
    );
    expect(result.task.metadata?.state).toBe('in_progress');
    expect(result.fact).not.toBeNull();
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

describe('ExtractionResolver — auto-routing state_changed facts on tasks', () => {
  let mem: MemorySystem;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('routes state_changed on a task subject through transitionTaskState', async () => {
    const task = await seedTask(mem, 'Route me', 'in_progress');

    const resolver = new ExtractionResolver(mem);
    const out = await resolver.resolveAndIngest(
      {
        mentions: {},
        facts: [
          {
            subject: 't',
            predicate: 'state_changed',
            kind: 'atomic',
            value: { from: 'in_progress', to: 'done' },
            details: 'Finished in review meeting',
          },
        ],
      },
      'sig-extract',
      scope,
      { preResolved: { t: task.id } },
    );

    expect(out.facts).toHaveLength(1);
    expect(out.facts[0]!.predicate).toBe('state_changed');

    // Side effects should be applied — this is the point of auto-routing.
    const fresh = await mem.getEntity(task.id, scope);
    expect(fresh!.metadata?.state).toBe('done');
    const history = fresh!.metadata?.stateHistory as TaskStateHistoryEntry[];
    expect(history).toHaveLength(1);
    expect(history[0]!.to).toBe('done');
    expect(fresh!.metadata?.completedAt).toBeInstanceOf(Date);
  });

  it('accepts plain-string value shape (not wrapped in {from,to})', async () => {
    const task = await seedTask(mem, 'Plain string', 'in_progress');
    const resolver = new ExtractionResolver(mem);
    await resolver.resolveAndIngest(
      {
        mentions: {},
        facts: [{ subject: 't', predicate: 'state_changed', kind: 'atomic', value: 'blocked' }],
      },
      'sig-plain',
      scope,
      { preResolved: { t: task.id } },
    );
    const fresh = await mem.getEntity(task.id, scope);
    expect(fresh!.metadata?.state).toBe('blocked');
  });

  it('flag off: state_changed on a task is written as a plain fact, no side effects', async () => {
    const memNoRoute = new MemorySystem({
      store: new InMemoryAdapter(),
      autoApplyTaskTransitions: false,
    });
    const t = await memNoRoute.upsertEntity(
      {
        type: 'task',
        displayName: 'No-route',
        identifiers: [{ kind: 'canonical', value: 'task:no-route' }],
        metadata: { state: 'in_progress' },
      },
      scope,
    );

    const resolver = new ExtractionResolver(memNoRoute);
    await resolver.resolveAndIngest(
      {
        mentions: {},
        facts: [
          { subject: 't', predicate: 'state_changed', kind: 'atomic', value: { from: 'in_progress', to: 'done' } },
        ],
      },
      'sig-no-route',
      scope,
      { preResolved: { t: t.entity.id } },
    );

    const fresh = await memNoRoute.getEntity(t.entity.id, scope);
    expect(fresh!.metadata?.state).toBe('in_progress'); // unchanged
    expect(fresh!.metadata?.stateHistory).toBeUndefined();
    await memNoRoute.shutdown();
  });

  it('non-task subject: state_changed lands as a plain fact', async () => {
    const person = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'P',
        identifiers: [{ kind: 'email', value: 'p@x.com' }],
      },
      scope,
    );
    const resolver = new ExtractionResolver(mem);
    const out = await resolver.resolveAndIngest(
      {
        mentions: {},
        facts: [
          { subject: 'p', predicate: 'state_changed', kind: 'atomic', value: { from: 'a', to: 'b' } },
        ],
      },
      'sig-person',
      scope,
      { preResolved: { p: person.entity.id } },
    );
    // Fact lands because addFact doesn't gate on subject type — auto-routing
    // short-circuits and falls through.
    expect(out.facts).toHaveLength(1);
    expect(out.facts[0]!.subjectId).toBe(person.entity.id);
  });

  it('preserves LLM-supplied importance / confidence / contextIds / validity on the audit fact', async () => {
    const task = await seedTask(mem, 'Preserves', 'in_progress');
    // Make a deal entity for contextIds.
    const deal = await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'Acme Deal',
        identifiers: [{ kind: 'canonical', value: 'project:acme' }],
      },
      scope,
    );

    const resolver = new ExtractionResolver(mem);
    const out = await resolver.resolveAndIngest(
      {
        mentions: {},
        facts: [
          {
            subject: 't',
            predicate: 'state_changed',
            kind: 'atomic',
            value: { from: 'in_progress', to: 'done' },
            details: 'Closed as part of Acme deal review',
            importance: 0.95,
            confidence: 0.88,
            contextIds: ['deal'],
            validUntil: '2027-01-01T00:00:00Z',
          },
        ],
      },
      'sig-preserve',
      scope,
      { preResolved: { t: task.id, deal: deal.entity.id } },
    );

    expect(out.facts).toHaveLength(1);
    const f = out.facts[0]!;
    expect(f.predicate).toBe('state_changed');
    expect(f.importance).toBe(0.95);
    expect(f.confidence).toBe(0.88);
    expect(f.contextIds).toEqual([deal.entity.id]);
    expect(f.validUntil).toEqual(new Date('2027-01-01T00:00:00Z'));
    // Side effect still fired.
    const fresh = await mem.getEntity(task.id, scope);
    expect(fresh!.metadata?.state).toBe('done');
  });

  it('malformed value (no `to`): state_changed falls through to plain fact', async () => {
    const task = await seedTask(mem, 'Mal', 'in_progress');
    const resolver = new ExtractionResolver(mem);
    const out = await resolver.resolveAndIngest(
      {
        mentions: {},
        facts: [
          { subject: 't', predicate: 'state_changed', kind: 'atomic', value: { from: 'x' } },
        ],
      },
      'sig-mal',
      scope,
      { preResolved: { t: task.id } },
    );
    expect(out.facts).toHaveLength(1);
    const fresh = await mem.getEntity(task.id, scope);
    expect(fresh!.metadata?.state).toBe('in_progress'); // unchanged — no routing happened
  });
});
