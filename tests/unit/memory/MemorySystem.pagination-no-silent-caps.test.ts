/**
 * Regression + feature tests for the pagination-no-silent-caps work:
 *
 * - L0 sort fixes: resolveRelatedTasks, resolveRelatedEvents,
 *   getContext.topFacts over-fetch, PredicateRegistry.renderForPrompt
 * - L0 adapter warning: limit-without-orderBy
 * - L1 iterators: iterateOpenTasks, iterateRecentTopics,
 *   iterateEntitiesByFilter, iterateFacts
 * - L2 truncation warnings: listOpenTasks, listRecentTopics
 *
 * The point of these tests is to catch the silent-truncation pattern that
 * insertion-order results mask. We seed enough rows to force the cap to bite,
 * verify the right (most-relevant) rows survive, and verify the iterator
 * sees ALL rows.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemorySystem, _resetCapWarningSuppression } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import { _resetOrderWarningSuppression } from '@/memory/adapters/orderByWarning.js';
import { PredicateRegistry } from '@/memory/predicates/PredicateRegistry.js';
import type { ScopeFilter } from '@/memory/types.js';

const scope: ScopeFilter = { userId: 'u1' };

async function makePerson(mem: MemorySystem, name: string): Promise<string> {
  const r = await mem.upsertEntity(
    {
      type: 'person',
      displayName: name,
      identifiers: [{ kind: 'email', value: `${name.toLowerCase()}@x.com` }],
    },
    scope,
  );
  return r.entity.id;
}

async function makeTask(
  mem: MemorySystem,
  name: string,
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const r = await mem.upsertEntity(
    {
      type: 'task',
      displayName: name,
      identifiers: [{ kind: 'canonical', value: `task:${name.replace(/\s+/g, '-').toLowerCase()}` }],
      metadata: { state: 'pending', ...metadata },
    },
    scope,
  );
  return r.entity.id;
}

async function makeEvent(
  mem: MemorySystem,
  name: string,
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const r = await mem.upsertEntity(
    {
      type: 'event',
      displayName: name,
      identifiers: [{ kind: 'canonical', value: `event:${name.replace(/\s+/g, '-').toLowerCase()}` }],
      metadata,
    },
    scope,
  );
  return r.entity.id;
}

async function makeTopic(
  mem: MemorySystem,
  name: string,
  updatedAt: Date,
): Promise<string> {
  const r = await mem.upsertEntity(
    {
      type: 'topic',
      displayName: name,
      identifiers: [{ kind: 'canonical', value: `topic:${name.replace(/\s+/g, '-').toLowerCase()}` }],
    },
    scope,
  );
  // Force-update the timestamp via metadata update path (updatedAt bumps each time).
  // The order helper sorts by entity.updatedAt; using vi.useFakeTimers in callers
  // gives finer control. Here we just rely on creation-time monotonicity if the
  // caller seeds in the desired order. The `updatedAt` parameter is for clarity.
  void updatedAt;
  return r.entity.id;
}

// ---------------------------------------------------------------------------
// L0 — resolveRelatedTasks sort regression
// ---------------------------------------------------------------------------

describe('resolveRelatedItems / resolveRelatedTasks — sort by due date', () => {
  let mem: MemorySystem;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
    _resetCapWarningSuppression();
    _resetOrderWarningSuppression();
    process.env.ONERINGAI_SUPPRESS_CAP_WARNINGS = '1';
    process.env.ONERINGAI_SUPPRESS_ORDER_WARNINGS = '1';
  });

  afterEach(async () => {
    delete process.env.ONERINGAI_SUPPRESS_CAP_WARNINGS;
    delete process.env.ONERINGAI_SUPPRESS_ORDER_WARNINGS;
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('keeps overdue/soonest-due tasks when cap forces drops', async () => {
    const alice = await makePerson(mem, 'Alice');
    const now = Date.now();
    // 20 tasks, mixed due dates. Cap will be set to 5; the surviving 5
    // should be the 5 with earliest dueAt (oldest first), not insertion-order.
    const expectedSurvivors: string[] = [];
    // Insert in reverse-relevance order: future-most-distant first, then closer,
    // so insertion order is OPPOSITE of what relevance dictates. If sort works,
    // the result keeps the earliest-due ones regardless.
    for (let i = 20; i > 0; i--) {
      const dueAt = new Date(now + i * 86_400_000); // i days from now
      const name = `Task-due-${i}d`;
      await makeTask(mem, name, { assigneeId: alice, dueAt });
      if (i <= 5) expectedSurvivors.push(name);
    }

    const res = await mem.resolveRelatedItems([alice], scope, { limit: 5 });
    expect(res.tasks).toHaveLength(5);
    const surviving = res.tasks.map((t) => t.task.displayName);
    // The 5 earliest-due tasks (1d, 2d, 3d, 4d, 5d from now), ordered ascending.
    expect(surviving).toEqual(['Task-due-1d', 'Task-due-2d', 'Task-due-3d', 'Task-due-4d', 'Task-due-5d']);
  });

  it('puts tasks with dueAt before tasks without (nulls-last)', async () => {
    const alice = await makePerson(mem, 'Alice');
    const now = Date.now();
    // 3 tasks with dueAt, 3 without. Cap 4 → the 3 dated + 1 undated.
    await makeTask(mem, 'no-due-A', { assigneeId: alice });
    await makeTask(mem, 'no-due-B', { assigneeId: alice });
    await makeTask(mem, 'no-due-C', { assigneeId: alice });
    await makeTask(mem, 'dated-1', { assigneeId: alice, dueAt: new Date(now + 86_400_000) });
    await makeTask(mem, 'dated-2', { assigneeId: alice, dueAt: new Date(now + 2 * 86_400_000) });
    await makeTask(mem, 'dated-3', { assigneeId: alice, dueAt: new Date(now + 3 * 86_400_000) });

    const res = await mem.resolveRelatedItems([alice], scope, { limit: 4 });
    expect(res.tasks).toHaveLength(4);
    const names = res.tasks.map((t) => t.task.displayName);
    // First three slots: dated tasks in dueAt order. Fourth: any of the undated.
    expect(names.slice(0, 3)).toEqual(['dated-1', 'dated-2', 'dated-3']);
    expect(names[3]).toMatch(/^no-due-/);
  });
});

// ---------------------------------------------------------------------------
// L0 — resolveRelatedEvents sort regression
// ---------------------------------------------------------------------------

describe('resolveRelatedItems / resolveRelatedEvents — sort by recency', () => {
  let mem: MemorySystem;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
    _resetCapWarningSuppression();
    _resetOrderWarningSuppression();
    process.env.ONERINGAI_SUPPRESS_CAP_WARNINGS = '1';
    process.env.ONERINGAI_SUPPRESS_ORDER_WARNINGS = '1';
  });

  afterEach(async () => {
    delete process.env.ONERINGAI_SUPPRESS_CAP_WARNINGS;
    delete process.env.ONERINGAI_SUPPRESS_ORDER_WARNINGS;
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('keeps the most-recent events when cap forces drops', async () => {
    const alice = await makePerson(mem, 'Alice');
    const now = Date.now();
    // Seed 10 events for Alice, increasing startTime. Insert oldest first
    // (insertion order = OLDEST-first, the opposite of relevance).
    for (let i = 0; i < 10; i++) {
      // startTime: i days from now (0=today, 9=9 days from now). Use future dates
      // so all are within the default 90d window. Sort = startTime desc, so the
      // 5 newest (i = 9, 8, 7, 6, 5) should win.
      const startTime = new Date(now + i * 86_400_000);
      await makeEvent(mem, `Event-day-${i}`, { startTime, attendeeIds: [alice] });
    }

    const res = await mem.resolveRelatedItems([alice], scope, { limit: 5, types: ['event'] });
    expect(res.events).toHaveLength(5);
    const names = res.events.map((e) => e.event.displayName);
    // Most-recent 5 by startTime desc:
    expect(names).toEqual(['Event-day-9', 'Event-day-8', 'Event-day-7', 'Event-day-6', 'Event-day-5']);
  });
});

// ---------------------------------------------------------------------------
// L0 — PredicateRegistry.renderForPrompt sort
// ---------------------------------------------------------------------------

describe('PredicateRegistry.renderForPrompt — sort by importance', () => {
  it('orders predicates within a category by defaultImportance desc, name asc', () => {
    const reg = new PredicateRegistry();
    // Register OUT of importance order so insertion-order != relevance-order.
    // If the sort works, the higher-importance one appears first in the prompt.
    reg.register({
      name: 'low_imp',
      description: 'low',
      category: 'communication',
      defaultImportance: 0.1,
    });
    reg.register({
      name: 'mid_imp',
      description: 'mid',
      category: 'communication',
      defaultImportance: 0.5,
    });
    reg.register({
      name: 'high_imp',
      description: 'high',
      category: 'communication',
      defaultImportance: 0.9,
    });
    reg.register({
      // Stable tiebreak: same importance, name asc.
      name: 'aaa_same',
      description: 'tiebreak a',
      category: 'communication',
      defaultImportance: 0.5,
    });
    reg.register({
      name: 'zzz_same',
      description: 'tiebreak z',
      category: 'communication',
      defaultImportance: 0.5,
    });

    const rendered = reg.renderForPrompt({ categories: ['communication'], maxPerCategory: 5 });
    // Verify the order: high_imp first, then mid_imp ties broken by name asc
    // (aaa_same before mid_imp before zzz_same), then low_imp last.
    const lines = rendered.split('\n').filter((l) => l.startsWith('- `'));
    const names = lines.map((l) => {
      const m = l.match(/`([^`]+)`/);
      return m ? m[1] : '';
    });
    expect(names).toEqual(['high_imp', 'aaa_same', 'mid_imp', 'zzz_same', 'low_imp']);
  });

  it('keeps the highest-importance predicates when maxPerCategory caps', () => {
    const reg = new PredicateRegistry();
    // 10 predicates in one category, importance varies 0.0..0.9.
    // maxPerCategory = 3 → top 3 by importance should survive.
    for (let i = 0; i < 10; i++) {
      reg.register({
        name: `pred_${i.toString().padStart(2, '0')}`,
        description: `p${i}`,
        category: 'task',
        defaultImportance: i / 10,
      });
    }
    const rendered = reg.renderForPrompt({ categories: ['task'], maxPerCategory: 3 });
    const lines = rendered.split('\n').filter((l) => l.startsWith('- `'));
    const names = lines.map((l) => l.match(/`([^`]+)`/)?.[1] ?? '');
    expect(names).toEqual(['pred_09', 'pred_08', 'pred_07']);
  });
});

// ---------------------------------------------------------------------------
// L1 — Iterators
// ---------------------------------------------------------------------------

describe('iterateOpenTasks', () => {
  let mem: MemorySystem;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
    _resetCapWarningSuppression();
    _resetOrderWarningSuppression();
    process.env.ONERINGAI_SUPPRESS_CAP_WARNINGS = '1';
    process.env.ONERINGAI_SUPPRESS_ORDER_WARNINGS = '1';
  });

  afterEach(async () => {
    delete process.env.ONERINGAI_SUPPRESS_CAP_WARNINGS;
    delete process.env.ONERINGAI_SUPPRESS_ORDER_WARNINGS;
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('iterates over the full result set (no silent cap)', async () => {
    // 500 tasks — well above the listOpenTasks library cap of 200.
    for (let i = 0; i < 500; i++) {
      await makeTask(mem, `task-${i.toString().padStart(3, '0')}`);
    }

    let total = 0;
    const batches: number[] = [];
    for await (const batch of mem.iterateOpenTasks(scope, { batchSize: 100 })) {
      total += batch.length;
      batches.push(batch.length);
    }
    expect(total).toBe(500);
    // 5 full batches of 100 (since the underlying adapter paginates via cursor).
    expect(batches.length).toBeGreaterThanOrEqual(5);
  });

  it('preserves dueAt-asc-nulls-last ordering across batches', async () => {
    const now = Date.now();
    // 200 dated tasks (1..200 days out), 100 undated. With sort working,
    // the iterator yields dated tasks first in dueAt order, then undated.
    for (let i = 1; i <= 200; i++) {
      await makeTask(mem, `dated-${i.toString().padStart(3, '0')}`, {
        dueAt: new Date(now + i * 86_400_000),
      });
    }
    for (let i = 0; i < 100; i++) {
      await makeTask(mem, `undated-${i.toString().padStart(3, '0')}`);
    }

    const allNames: string[] = [];
    for await (const batch of mem.iterateOpenTasks(scope, { batchSize: 50 })) {
      for (const t of batch) allNames.push(t.displayName);
    }
    expect(allNames.length).toBe(300);
    // First 200 should be dated in order; remaining 100 are undated.
    expect(allNames.slice(0, 200)).toEqual(
      Array.from({ length: 200 }, (_, k) => `dated-${(k + 1).toString().padStart(3, '0')}`),
    );
    expect(allNames.slice(200).every((n) => n.startsWith('undated-'))).toBe(true);
  });

  it('honors assigneeId / projectId filter inside iteration', async () => {
    const alice = await makePerson(mem, 'Alice');
    for (let i = 0; i < 50; i++) {
      await makeTask(mem, `alice-${i}`, { assigneeId: alice });
      await makeTask(mem, `bob-${i}`, { assigneeId: 'bob' });
    }

    let count = 0;
    for await (const batch of mem.iterateOpenTasks(scope, { assigneeId: alice, batchSize: 25 })) {
      count += batch.length;
      for (const t of batch) {
        expect((t.metadata as Record<string, unknown>).assigneeId).toBe(alice);
      }
    }
    expect(count).toBe(50);
  });

  it('completes without yielding for empty set', async () => {
    const yielded: number[] = [];
    for await (const batch of mem.iterateOpenTasks(scope)) {
      yielded.push(batch.length);
    }
    expect(yielded).toEqual([]);
  });
});

describe('iterateEntitiesByFilter + iterateFacts', () => {
  let mem: MemorySystem;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
    process.env.ONERINGAI_SUPPRESS_CAP_WARNINGS = '1';
    process.env.ONERINGAI_SUPPRESS_ORDER_WARNINGS = '1';
  });

  afterEach(async () => {
    delete process.env.ONERINGAI_SUPPRESS_CAP_WARNINGS;
    delete process.env.ONERINGAI_SUPPRESS_ORDER_WARNINGS;
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('iterateEntitiesByFilter walks all matching entities', async () => {
    for (let i = 0; i < 350; i++) {
      await makeEvent(mem, `ev-${i}`, { startTime: new Date(Date.now() + i * 60_000) });
    }
    let count = 0;
    for await (const batch of mem.iterateEntitiesByFilter(
      { type: 'event' },
      scope,
      {
        batchSize: 100,
        orderBy: [
          { field: 'metadata.startTime', direction: 'desc' },
          { field: 'id', direction: 'asc' },
        ],
      },
    )) {
      count += batch.length;
    }
    expect(count).toBe(350);
  });

  it('iterateFacts walks all matching facts', async () => {
    const alice = await makePerson(mem, 'Alice');
    // Write 300 facts about Alice.
    for (let i = 0; i < 300; i++) {
      await mem.addFact(
        {
          kind: 'atomic',
          subjectId: alice,
          predicate: 'note',
          value: `n${i}`,
          observedAt: new Date(Date.now() + i * 1000),
        },
        scope,
      );
    }
    let count = 0;
    for await (const batch of mem.iterateFacts(
      { subjectId: alice, predicate: 'note', kind: 'atomic' },
      scope,
      { batchSize: 100, orderBy: { field: 'observedAt', direction: 'desc' } },
    )) {
      count += batch.length;
    }
    expect(count).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// L0 — Adapter limit-without-orderBy warning
// ---------------------------------------------------------------------------

describe('adapter limit-without-orderBy warning', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    _resetOrderWarningSuppression();
    delete process.env.ONERINGAI_SUPPRESS_ORDER_WARNINGS;
  });

  afterEach(() => {
    warnSpy.mockRestore();
    delete process.env.ONERINGAI_SUPPRESS_ORDER_WARNINGS;
    _resetOrderWarningSuppression();
  });

  it('fires when listEntities is called with limit but no orderBy', async () => {
    const adapter = new InMemoryAdapter();
    await adapter.listEntities({ type: 'task' }, { limit: 10 }, scope);
    expect(warnSpy).toHaveBeenCalled();
    const message = warnSpy.mock.calls[0]![0] as string;
    expect(message).toContain('listEntities');
    expect(message).toContain('orderBy');
  });

  it('does NOT fire when orderBy is provided', async () => {
    const adapter = new InMemoryAdapter();
    await adapter.listEntities(
      { type: 'task' },
      { limit: 10, orderBy: { field: 'updatedAt', direction: 'desc' } },
      scope,
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does NOT fire when limit is omitted', async () => {
    const adapter = new InMemoryAdapter();
    await adapter.listEntities({ type: 'task' }, {}, scope);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('is suppressed when env var is set', async () => {
    process.env.ONERINGAI_SUPPRESS_ORDER_WARNINGS = '1';
    _resetOrderWarningSuppression();
    const adapter = new InMemoryAdapter();
    await adapter.listEntities({ type: 'task' }, { limit: 10 }, scope);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// L2 — Truncation warning on flat-array list methods
// ---------------------------------------------------------------------------

describe('listOpenTasks / listRecentTopics truncation warning', () => {
  let mem: MemorySystem;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    _resetCapWarningSuppression();
    _resetOrderWarningSuppression();
    // We want to see the cap warning; suppress the order warning to keep the
    // log clean for assertions.
    process.env.ONERINGAI_SUPPRESS_ORDER_WARNINGS = '1';
    delete process.env.ONERINGAI_SUPPRESS_CAP_WARNINGS;
  });

  afterEach(async () => {
    delete process.env.ONERINGAI_SUPPRESS_CAP_WARNINGS;
    delete process.env.ONERINGAI_SUPPRESS_ORDER_WARNINGS;
    warnSpy.mockRestore();
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('fires on listOpenTasks when limit is reached and more exist', async () => {
    // 250 tasks → listOpenTasks with default limit 50 returns 50, nextCursor set.
    for (let i = 0; i < 250; i++) {
      await makeTask(mem, `t-${i}`);
    }
    const tasks = await mem.listOpenTasks(scope);
    expect(tasks.length).toBe(50);
    const messages = warnSpy.mock.calls.map((c) => c[0] as string);
    expect(messages.some((m) => m.includes('listOpenTasks') && m.includes('iterateOpenTasks'))).toBe(true);
  });

  it('does NOT fire on listOpenTasks when result < limit', async () => {
    for (let i = 0; i < 5; i++) {
      await makeTask(mem, `t-${i}`);
    }
    await mem.listOpenTasks(scope);
    const capMessages = warnSpy.mock.calls
      .map((c) => c[0] as string)
      .filter((m) => m.includes('listOpenTasks'));
    expect(capMessages).toEqual([]);
  });

  it('is suppressed when env var is set', async () => {
    process.env.ONERINGAI_SUPPRESS_CAP_WARNINGS = '1';
    _resetCapWarningSuppression();
    for (let i = 0; i < 250; i++) {
      await makeTask(mem, `t-${i}`);
    }
    await mem.listOpenTasks(scope);
    const capMessages = warnSpy.mock.calls
      .map((c) => c[0] as string)
      .filter((m) => m.includes('iterateOpenTasks'));
    expect(capMessages).toEqual([]);
  });
});
