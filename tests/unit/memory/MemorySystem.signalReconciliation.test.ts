/**
 * Signal-reconciliation pass (SECOND pass) — `applyReconciliationOps` +
 * `signalReconciliationPrompt` + `parseSignalReconciliationOpsWithStatus`.
 *
 * Covers the task-op extension: `task_update` mutates tasks in place, marks
 * them done/cancelled, and stamps AI-resolution provenance; fact ops continue
 * to supersede via archive (create rejected, hallucinated ids rejected).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import {
  signalReconciliationPrompt,
  parseSignalReconciliationOpsWithStatus,
} from '@/memory/integration/index.js';
import type { ScopeFilter, SignalReconciliationOp } from '@/memory/index.js';

const scope: ScopeFilter = { userId: 'user-1' };

async function seedPerson(mem: MemorySystem, name: string) {
  const { entity } = await mem.upsertEntity(
    {
      type: 'person',
      displayName: name,
      identifiers: [{ kind: 'canonical', value: `person:${name.toLowerCase()}` }],
    },
    scope,
  );
  return entity;
}

async function seedTask(mem: MemorySystem, name: string, state: string) {
  const { entity } = await mem.upsertEntity(
    {
      type: 'task',
      displayName: name,
      identifiers: [{ kind: 'canonical', value: `task:${name.toLowerCase().replace(/\s+/g, '-')}` }],
      metadata: { state },
    },
    scope,
  );
  return entity;
}

describe('applyReconciliationOps — fact supersession', () => {
  let mem: MemorySystem;
  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
  });
  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('archives a prior fact (supersession) and counts it', async () => {
    const person = await seedPerson(mem, 'Pavel');
    const fact = await mem.addFact(
      { subjectId: person.id, predicate: 'current_status', kind: 'atomic', value: 'blocked' },
      scope,
    );
    const ops: SignalReconciliationOp[] = [
      { op: 'archive', factId: fact.id, evidenceQuote: 'unblocked now', reason: 'new email says resolved' },
    ];
    const outcome = await mem.applyReconciliationOps(ops, { priorFacts: [fact], priorTasks: [] }, scope);
    expect(outcome.archives).toBe(1);
    const after = await mem.getFact(fact.id, scope);
    expect(after?.archived).toBe(true);
  });

  it('rejects a create op (reconcile pass does not create) and a hallucinated factId', async () => {
    const person = await seedPerson(mem, 'Roman');
    const fact = await mem.addFact(
      { subjectId: person.id, predicate: 'current_title', kind: 'atomic', value: 'VP' },
      scope,
    );
    const ops: SignalReconciliationOp[] = [
      { op: 'create', subject: 'X', predicate: 'p', kind: 'atomic' },
      { op: 'archive', factId: 'fact-does-not-exist', reason: 'x', evidenceQuote: 'y' },
    ];
    const outcome = await mem.applyReconciliationOps(ops, { priorFacts: [fact], priorTasks: [] }, scope);
    expect(outcome.archives).toBe(0);
    expect(outcome.rejectedHallucinated).toBe(2);
    const after = await mem.getFact(fact.id, scope);
    expect(after?.archived).toBeFalsy();
  });
});

describe('applyReconciliationOps — task update / resolution', () => {
  let mem: MemorySystem;
  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
  });
  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('marks a task done and stamps AI-resolution provenance', async () => {
    const task = await seedTask(mem, 'Walk Joon through new functionality', 'proposed');
    const at = new Date('2026-05-12T20:00:00Z');
    const ops: SignalReconciliationOp[] = [
      {
        op: 'task_update',
        taskId: task.id,
        newState: 'done',
        evidenceQuote: 'Great call earlier, mobile app is enabled',
        reason: 'Follow-up email confirms the walkthrough happened',
      },
    ];
    const outcome = await mem.applyReconciliationOps(
      ops,
      { priorFacts: [], priorTasks: [task] },
      scope,
      { at, sourceSignalId: 'sig-9' },
    );
    expect(outcome.taskUpdates).toBe(1);
    expect(outcome.taskResolves).toBe(1);

    const after = await mem.getEntity(task.id, scope);
    const md = after?.metadata as Record<string, unknown>;
    expect(md.state).toBe('done');
    expect(md.completedAt).toEqual(at);
    expect(md.aiResolved).toBe(true);
    expect(md.aiResolutionReason).toBe('Follow-up email confirms the walkthrough happened');
    expect(md.aiResolutionEvidenceQuote).toBe('Great call earlier, mobile app is enabled');
    expect(md.aiResolvedAt).toEqual(at);
    // stateHistory written by the canonical transition path.
    expect(Array.isArray(md.stateHistory)).toBe(true);
  });

  it('updates narrative only (no state change) without AI-resolution provenance', async () => {
    const task = await seedTask(mem, 'Prep board deck', 'in_progress');
    const ops: SignalReconciliationOp[] = [
      { op: 'task_update', taskId: task.id, narrative: 'Deck draft shared; awaiting CFO numbers.' },
    ];
    const outcome = await mem.applyReconciliationOps(ops, { priorFacts: [], priorTasks: [task] }, scope);
    expect(outcome.taskUpdates).toBe(1);
    expect(outcome.taskResolves).toBe(0);

    const after = await mem.getEntity(task.id, scope);
    const md = after?.metadata as Record<string, unknown>;
    expect(md.state).toBe('in_progress');
    expect(md.narrative).toBe('Deck draft shared; awaiting CFO numbers.');
    expect(md.aiResolved).toBeUndefined();
  });

  it('rejects a hallucinated taskId', async () => {
    const task = await seedTask(mem, 'Real task', 'proposed');
    const ops: SignalReconciliationOp[] = [
      { op: 'task_update', taskId: 'task-ghost', newState: 'done', reason: 'r', evidenceQuote: 'e' },
    ];
    const outcome = await mem.applyReconciliationOps(ops, { priorFacts: [], priorTasks: [task] }, scope);
    expect(outcome.taskUpdates).toBe(0);
    expect(outcome.rejectedHallucinated).toBe(1);
  });

  it('skepticFilter drops an op', async () => {
    const task = await seedTask(mem, 'Filtered task', 'proposed');
    const ops: SignalReconciliationOp[] = [
      { op: 'task_update', taskId: task.id, newState: 'done', reason: 'weak', evidenceQuote: '' },
    ];
    const outcome = await mem.applyReconciliationOps(
      ops,
      { priorFacts: [], priorTasks: [task] },
      scope,
      { skepticFilter: () => false },
    );
    expect(outcome.taskUpdates).toBe(0);
    expect(outcome.rejectedSkeptic).toBe(1);
    const after = await mem.getEntity(task.id, scope);
    expect((after?.metadata as Record<string, unknown>).state).toBe('proposed');
  });
});

describe('parseSignalReconciliationOpsWithStatus', () => {
  it('parses mixed fact + task ops and drops no-op task ops', () => {
    const raw = JSON.stringify({
      operations: [
        { op: 'archive', factId: 'f1', reason: 'r', evidenceQuote: 'e' },
        { op: 'task_update', taskId: 't1', newState: 'done', reason: 'r', evidenceQuote: 'e' },
        { op: 'task_update', taskId: 't2' }, // no mutating field → dropped
        { op: 'task_update', reason: 'r' }, // no taskId → dropped
      ],
    });
    const result = parseSignalReconciliationOpsWithStatus(raw);
    expect(result.status).toBe('ok');
    expect(result.operations).toHaveLength(2);
    expect(result.operations[0]!.op).toBe('archive');
    expect(result.operations[1]).toMatchObject({ op: 'task_update', taskId: 't1', newState: 'done' });
  });

  it('returns empty operations for {} (silence)', () => {
    const result = parseSignalReconciliationOpsWithStatus('{}');
    expect(result.status).toBe('ok');
    expect(result.operations).toEqual([]);
  });

  it('flags non-array operations as shape_error', () => {
    const result = parseSignalReconciliationOpsWithStatus('{"operations": "nope"}');
    expect(result.status).toBe('shape_error');
  });
});

describe('signalReconciliationPrompt', () => {
  it('renders prior fact + task ids the LLM must reference', () => {
    const prompt = signalReconciliationPrompt({
      newFacts: [{ predicate: 'decision_made', value: 'Going with Oracle', evidenceQuote: 'we chose Oracle' }],
      newTasks: [{ title: 'Send contract', state: 'proposed' }],
      priorFacts: [
        {
          id: 'fact-123',
          subjectId: 's1',
          predicate: 'current_status',
          kind: 'atomic',
          value: 'evaluating',
          observedAt: new Date('2026-05-01T00:00:00Z'),
        } as never,
      ],
      priorTasks: [
        {
          id: 'task-456',
          type: 'task',
          displayName: 'Choose ERP vendor',
          metadata: { state: 'in_progress' },
        } as never,
      ],
    });
    expect(prompt).toContain('F[fact-123]');
    expect(prompt).toContain('T[task-456]');
    expect(prompt).toContain('task_update');
    expect(prompt).toContain('archive');
    // new context surfaced
    expect(prompt).toContain('Going with Oracle');
    expect(prompt).toContain('Send contract');
  });
});
