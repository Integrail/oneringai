/**
 * MemorySystem — predicate lifecycle integration.
 *
 * Covers:
 *   - addFact auto-stamps `validUntil` from registry `defaultValidityDays`.
 *   - Caller-supplied `validUntil` overrides the registry default.
 *   - Predicates without a lifecycle window (stable / stateful) get no auto-stamp.
 *   - expireFacts archives only facts whose `validUntil < asOf`.
 *   - expireFacts respects scope and predicate filter.
 *   - expireFacts emits `fact.expire` change events.
 *   - PredicateRegistry.renderForPrompt omits excluded predicates by default
 *     but includes them when `includeExcluded: true`.
 */

import { describe, it, expect } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import { PredicateRegistry } from '@/memory/predicates/index.js';
import type { ChangeEvent } from '@/memory/types.js';

const USER = 'u1';
const DAY_MS = 86_400_000;

function makeMem(): { mem: MemorySystem; events: ChangeEvent[] } {
  const events: ChangeEvent[] = [];
  const mem = new MemorySystem({
    store: new InMemoryAdapter(),
    predicates: PredicateRegistry.standard(),
    onChange: (e) => events.push(e),
  });
  return { mem, events };
}

async function makePerson(mem: MemorySystem, email = 'a@x'): Promise<string> {
  const r = await mem.upsertEntity(
    { type: 'person', displayName: 'Anton', identifiers: [{ kind: 'email', value: email }] },
    { userId: USER },
  );
  return r.entity.id;
}

async function makeTask(mem: MemorySystem, surface: string): Promise<string> {
  const r = await mem.upsertEntity(
    {
      type: 'task',
      displayName: surface,
      identifiers: [{ kind: 'canonical', value: `task:${surface}` }],
      metadata: { state: 'proposed' },
    },
    { userId: USER },
  );
  return r.entity.id;
}

describe('addFact — predicate lifecycle auto-stamping', () => {
  it('ephemeral predicate (committed_to, 90d) stamps validUntil ≈ observedAt + 90d', async () => {
    const { mem } = makeMem();
    const personId = await makePerson(mem);
    const taskId = await makeTask(mem, 'send-budget');
    const observedAt = new Date('2026-01-01T00:00:00Z');

    const fact = await mem.addFact(
      {
        subjectId: personId,
        objectId: taskId,
        predicate: 'committed_to',
        kind: 'atomic',
        observedAt,
      },
      { userId: USER },
    );

    expect(fact.validUntil).toBeInstanceOf(Date);
    const expected = new Date(observedAt.getTime() + 90 * DAY_MS);
    expect(fact.validUntil!.getTime()).toBe(expected.getTime());
  });

  it('episodic predicate (attended, 90d) stamps validUntil ≈ observedAt + 90d', async () => {
    const { mem } = makeMem();
    const personId = await makePerson(mem);
    const eventR = await mem.upsertEntity(
      { type: 'event', displayName: 'Q3 review', identifiers: [{ kind: 'canonical', value: 'evt:q3' }] },
      { userId: USER },
    );
    const observedAt = new Date('2026-01-01T00:00:00Z');

    const fact = await mem.addFact(
      {
        subjectId: personId,
        objectId: eventR.entity.id,
        predicate: 'attended',
        kind: 'atomic',
        observedAt,
      },
      { userId: USER },
    );

    expect(fact.validUntil!.getTime()).toBe(observedAt.getTime() + 90 * DAY_MS);
  });

  it('stable predicate (works_at) does NOT auto-stamp validUntil', async () => {
    const { mem } = makeMem();
    const personId = await makePerson(mem);
    const orgR = await mem.upsertEntity(
      { type: 'organization', displayName: 'Acme', identifiers: [{ kind: 'domain', value: 'acme.com' }] },
      { userId: USER },
    );

    const fact = await mem.addFact(
      {
        subjectId: personId,
        objectId: orgR.entity.id,
        predicate: 'works_at',
        kind: 'atomic',
      },
      { userId: USER },
    );

    expect(fact.validUntil).toBeUndefined();
  });

  it('stateful predicate (current_title) does NOT auto-stamp validUntil', async () => {
    const { mem } = makeMem();
    const personId = await makePerson(mem);

    const fact = await mem.addFact(
      {
        subjectId: personId,
        predicate: 'current_title',
        kind: 'atomic',
        value: 'VP Eng',
      },
      { userId: USER },
    );

    expect(fact.validUntil).toBeUndefined();
  });

  it('caller-supplied validUntil overrides the registry default', async () => {
    const { mem } = makeMem();
    const personId = await makePerson(mem);
    const taskId = await makeTask(mem, 'send-deck');
    const explicit = new Date('2026-02-15T00:00:00Z');

    const fact = await mem.addFact(
      {
        subjectId: personId,
        objectId: taskId,
        predicate: 'committed_to',
        kind: 'atomic',
        validUntil: explicit,
      },
      { userId: USER },
    );

    expect(fact.validUntil!.getTime()).toBe(explicit.getTime());
  });
});

describe('expireFacts', () => {
  it('archives only facts whose validUntil < asOf', async () => {
    const { mem, events } = makeMem();
    const personId = await makePerson(mem);
    const taskA = await makeTask(mem, 'a');
    const taskB = await makeTask(mem, 'b');

    // Past — should expire
    const past = await mem.addFact(
      {
        subjectId: personId,
        objectId: taskA,
        predicate: 'committed_to',
        kind: 'atomic',
        validUntil: new Date('2026-01-01T00:00:00Z'),
      },
      { userId: USER },
    );

    // Future — should NOT expire
    const future = await mem.addFact(
      {
        subjectId: personId,
        objectId: taskB,
        predicate: 'committed_to',
        kind: 'atomic',
        validUntil: new Date('2099-01-01T00:00:00Z'),
      },
      { userId: USER },
    );

    const result = await mem.expireFacts(
      { asOf: new Date('2026-05-01T00:00:00Z') },
      { userId: USER },
    );

    expect(result.archived).toBe(1);
    const pastReloaded = await mem.findFacts(
      { subjectId: personId, predicate: 'committed_to', archived: true },
      {},
      { userId: USER },
    );
    expect(pastReloaded.items.find((f) => f.id === past.id)?.archived).toBe(true);

    const liveReloaded = await mem.findFacts(
      { subjectId: personId, predicate: 'committed_to', archived: false },
      {},
      { userId: USER },
    );
    expect(liveReloaded.items.find((f) => f.id === future.id)).toBeDefined();

    const expireEvents = events.filter((e) => e.type === 'fact.expire');
    expect(expireEvents.length).toBe(1);
  });

  it('never expires facts without validUntil (stable predicates are forever)', async () => {
    const { mem } = makeMem();
    const personId = await makePerson(mem);
    const orgR = await mem.upsertEntity(
      { type: 'organization', displayName: 'Acme', identifiers: [{ kind: 'domain', value: 'acme.com' }] },
      { userId: USER },
    );

    await mem.addFact(
      {
        subjectId: personId,
        objectId: orgR.entity.id,
        predicate: 'works_at',
        kind: 'atomic',
      },
      { userId: USER },
    );

    const result = await mem.expireFacts(
      { asOf: new Date('2099-01-01T00:00:00Z') },
      { userId: USER },
    );

    expect(result.archived).toBe(0);
  });

  it('predicate filter narrows the sweep', async () => {
    const { mem } = makeMem();
    const personId = await makePerson(mem);
    const taskA = await makeTask(mem, 'aa');
    const taskB = await makeTask(mem, 'bb');

    // Both expired; only one matches the predicate filter.
    await mem.addFact(
      {
        subjectId: personId,
        objectId: taskA,
        predicate: 'committed_to',
        kind: 'atomic',
        validUntil: new Date('2026-01-01'),
      },
      { userId: USER },
    );
    await mem.addFact(
      {
        subjectId: personId,
        objectId: taskB,
        predicate: 'assigned_task',
        kind: 'atomic',
        validUntil: new Date('2026-01-01'),
      },
      { userId: USER },
    );

    const result = await mem.expireFacts(
      { asOf: new Date('2026-06-01'), predicates: ['committed_to'] },
      { userId: USER },
    );

    expect(result.archived).toBe(1);
  });

  it('empty predicates array short-circuits to 0', async () => {
    const { mem } = makeMem();
    const personId = await makePerson(mem);
    const taskA = await makeTask(mem, 'cc');
    await mem.addFact(
      {
        subjectId: personId,
        objectId: taskA,
        predicate: 'committed_to',
        kind: 'atomic',
        validUntil: new Date('2026-01-01'),
      },
      { userId: USER },
    );

    const result = await mem.expireFacts(
      { asOf: new Date('2026-06-01'), predicates: [] },
      { userId: USER },
    );
    expect(result.archived).toBe(0);
  });

  it('limit caps the sweep', async () => {
    const { mem } = makeMem();
    const personId = await makePerson(mem);
    for (let i = 0; i < 5; i++) {
      const taskId = await makeTask(mem, `t${i}`);
      await mem.addFact(
        {
          subjectId: personId,
          objectId: taskId,
          predicate: 'committed_to',
          kind: 'atomic',
          validUntil: new Date('2026-01-01'),
        },
        { userId: USER },
      );
    }

    const result = await mem.expireFacts(
      { asOf: new Date('2026-06-01'), limit: 2 },
      { userId: USER },
    );
    expect(result.archived).toBe(2);
  });
});

describe('PredicateRegistry.renderForPrompt — excludeFromExtractionPrompt', () => {
  it('omits excluded predicates by default', () => {
    const reg = PredicateRegistry.standard();
    const out = reg.renderForPrompt();
    // Per-message comms noise — tagged excludeFromExtractionPrompt: true
    expect(out).not.toContain('`emailed`');
    expect(out).not.toContain('`cc_ed`');
    expect(out).not.toContain('`mentioned`');
    expect(out).not.toContain('`responded_to`');
    // Substantive predicates remain visible
    expect(out).toContain('`committed_to`');
    expect(out).toContain('`works_at`');
  });

  it('includeExcluded: true surfaces them', () => {
    const reg = PredicateRegistry.standard();
    // Bump maxPerCategory above the communication-category size so the
    // importance-based sort doesn't trim lower-importance entries (mentioned
    // sits at 0.3, below the 0.4-tier emailed/called/messaged/responded_to).
    // The test's intent is that includeExcluded surfaces excludeFromExtractionPrompt
    // predicates, not to validate the cap behavior.
    const out = reg.renderForPrompt({ includeExcluded: true, maxPerCategory: 50 });
    expect(out).toContain('`emailed`');
    expect(out).toContain('`mentioned`');
  });

  it('list() always returns every registered definition', () => {
    const reg = PredicateRegistry.standard();
    // Sanity — both excluded and non-excluded predicates present.
    const names = reg.list().map((d) => d.name);
    expect(names).toContain('emailed');
    expect(names).toContain('committed_to');
  });
});
