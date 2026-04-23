/**
 * CalendarSignalAdapter — event seed with deterministic canonical id,
 * organizer/attendee person seeds, and hosted/attended seed facts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import { CalendarSignalAdapter } from '@/memory/integration/signals/adapters/CalendarSignalAdapter.js';
import { SignalIngestor } from '@/memory/integration/signals/SignalIngestor.js';
import type { IExtractor } from '@/memory/integration/signals/types.js';
import type { ScopeFilter } from '@/memory/types.js';

const scope: ScopeFilter = { userId: 'test-user' };

const emptyExtractor: IExtractor = {
  async extract() {
    return { mentions: {}, facts: [] };
  },
};

describe('CalendarSignalAdapter.extract (pure — no I/O)', () => {
  const adapter = new CalendarSignalAdapter();

  const base = {
    id: 'cal_evt_001',
    source: 'gcal' as const,
    title: 'Q3 Planning Review',
    description: 'Go through Q3 priorities.',
    startTime: new Date('2026-05-01T10:00:00Z'),
    endTime: new Date('2026-05-01T11:00:00Z'),
    location: 'Conf Room A',
    kind: 'meeting' as const,
    organizer: { email: 'alice@acme.com', name: 'Alice' },
    attendees: [
      { email: 'bob@acme.com', name: 'Bob' },
      { email: 'carol@acme.com', name: 'Carol', rsvpStatus: 'accepted' as const },
    ],
  };

  it('emits event participant with canonical identifier + metadata', () => {
    const out = adapter.extract(base);
    const event = out.participants.find((p) => p.type === 'event');
    expect(event).toBeDefined();
    expect(event!.identifiers).toHaveLength(1);
    expect(event!.identifiers[0]!.kind).toBe('canonical');
    expect(event!.identifiers[0]!.value).toMatch(/^event:gcal:/);
    expect(event!.metadata).toMatchObject({
      startTime: base.startTime,
      endTime: base.endTime,
      location: 'Conf Room A',
      kind: 'meeting',
    });
    expect(event!.displayName).toBe('Q3 Planning Review');
    expect(event!.role).toBe('event');
  });

  it('canonical id is stable across calls for the same input', () => {
    const a = adapter.extract(base).participants.find((p) => p.type === 'event')!;
    const b = adapter.extract(base).participants.find((p) => p.type === 'event')!;
    expect(a.identifiers[0]!.value).toBe(b.identifiers[0]!.value);
  });

  it('canonical id differs when external id changes', () => {
    const a = adapter.extract(base).participants.find((p) => p.type === 'event')!;
    const b = adapter.extract({ ...base, id: 'different_id' }).participants.find((p) => p.type === 'event')!;
    expect(a.identifiers[0]!.value).not.toBe(b.identifiers[0]!.value);
  });

  it('seeds organizer + attendees as person participants with distinct roles', () => {
    const out = adapter.extract(base);
    const people = out.participants.filter((p) => p.type === 'person');
    expect(people).toHaveLength(3);
    const roles = people.map((p) => p.role);
    expect(roles).toContain('organizer');
    expect(roles.filter((r) => r.startsWith('attendee_'))).toHaveLength(2);
  });

  it('dedupes attendees sharing email with organizer', () => {
    const out = adapter.extract({
      ...base,
      attendees: [{ email: 'alice@acme.com' }, { email: 'bob@acme.com' }],
    });
    const emails = out.participants
      .filter((p) => p.type === 'person')
      .map((p) => p.identifiers[0]!.value);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('emits hosted + attended seed facts', () => {
    const out = adapter.extract(base);
    expect(out.seedFacts).toBeDefined();
    const predicates = out.seedFacts!.map((sf) => sf.predicate);
    expect(predicates).toContain('hosted');
    const attendedCount = predicates.filter((p) => p === 'attended').length;
    expect(attendedCount).toBe(2);
  });

  it('declined attendees: dropped entirely (no seed, no seedFact, not in signalText)', () => {
    const out = adapter.extract({
      ...base,
      attendees: [
        { email: 'declined@acme.com', rsvpStatus: 'declined' },
        { email: 'accepted@acme.com', rsvpStatus: 'accepted' },
      ],
    });
    const emails = out.participants.filter((p) => p.type === 'person').map((p) => p.identifiers[0]!.value);
    // Declined attendee must not appear anywhere the LLM would see them —
    // mere presence is enough for the extractor to infer attendance.
    expect(emails).not.toContain('declined@acme.com');
    expect(emails).toContain('accepted@acme.com');
    expect(out.signalText).not.toContain('declined@acme.com');
    expect(out.signalText).toContain('accepted@acme.com');
    const attended = out.seedFacts!.filter((sf) => sf.predicate === 'attended');
    expect(attended).toHaveLength(1);
  });

  it('skipDeclinedAttendance=false: declined attendees seeded and listed, no attended seedFact', () => {
    const permissive = new CalendarSignalAdapter({ skipDeclinedAttendance: false });
    const out = permissive.extract({
      ...base,
      attendees: [
        { email: 'declined@acme.com', rsvpStatus: 'declined' },
        { email: 'accepted@acme.com', rsvpStatus: 'accepted' },
      ],
    });
    const emails = out.participants.filter((p) => p.type === 'person').map((p) => p.identifiers[0]!.value);
    expect(emails).toContain('declined@acme.com');
    expect(emails).toContain('accepted@acme.com');
    expect(out.signalText).toContain('declined@acme.com');
    // Both attendees get attended seed facts when the flag is off — the caller
    // has opted into the old behavior.
    const attended = out.seedFacts!.filter((sf) => sf.predicate === 'attended');
    expect(attended).toHaveLength(2);
  });

  it('signalText includes title + start + attendee emails + description', () => {
    const out = adapter.extract(base);
    expect(out.signalText).toContain('Q3 Planning Review');
    expect(out.signalText).toContain('2026-05-01T10:00:00');
    expect(out.signalText).toContain('alice@acme.com');
    expect(out.signalText).toContain('bob@acme.com');
    expect(out.signalText).toContain('Go through Q3 priorities');
  });

  it('falls back to title+start when no external id given', () => {
    const out = adapter.extract({ ...base, id: undefined });
    const event = out.participants.find((p) => p.type === 'event')!;
    expect(event.identifiers[0]!.value).toMatch(/^event:/);
  });
});

describe('CalendarSignalAdapter via SignalIngestor', () => {
  let mem: MemorySystem;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('seeds event entity with metadata persisted', async () => {
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor: emptyExtractor,
      adapters: [new CalendarSignalAdapter()],
    });
    const start = new Date('2026-05-01T10:00:00Z');
    const result = await ingestor.ingest({
      kind: 'calendar',
      raw: {
        id: 'cal_001',
        title: 'Q3 Planning',
        startTime: start,
        endTime: new Date('2026-05-01T11:00:00Z'),
        organizer: { email: 'alice@acme.com' },
        attendees: [{ email: 'bob@acme.com' }],
      },
      sourceSignalId: 'sig-cal-1',
      scope,
    });
    const eventEntry = result.entities.find((e) => e.entity.type === 'event');
    expect(eventEntry).toBeDefined();
    expect(eventEntry!.entity.metadata).toMatchObject({ startTime: start });
    expect(eventEntry!.entity.displayName).toBe('Q3 Planning');
  });

  it('writes hosted + attended seed facts deterministically', async () => {
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor: emptyExtractor,
      adapters: [new CalendarSignalAdapter()],
    });
    const result = await ingestor.ingest({
      kind: 'calendar',
      raw: {
        id: 'cal_002',
        title: 'Standup',
        startTime: new Date('2026-05-02T09:00:00Z'),
        organizer: { email: 'alice@acme.com' },
        attendees: [{ email: 'bob@acme.com' }, { email: 'carol@acme.com' }],
      },
      sourceSignalId: 'sig-cal-2',
      scope,
    });
    const predicates = result.facts.map((f) => f.predicate).sort();
    expect(predicates).toEqual(['attended', 'attended', 'hosted']);
    // sourceSignalId is attached to every seed fact.
    for (const f of result.facts) {
      expect(f.sourceSignalId).toBe('sig-cal-2');
    }
  });

  it('repeated ingestion is idempotent: seedFact count does NOT grow (dedup)', async () => {
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor: emptyExtractor,
      adapters: [new CalendarSignalAdapter()],
    });
    const raw = {
      id: 'cal_dedup',
      title: 'Daily standup',
      startTime: new Date('2026-05-05T09:00:00Z'),
      organizer: { email: 'alice@acme.com' },
      attendees: [{ email: 'bob@acme.com' }, { email: 'carol@acme.com' }],
    };
    // First ingest: 1 hosted + 2 attended = 3 seed facts.
    await ingestor.ingest({ kind: 'calendar', raw, sourceSignalId: 'sig-1', scope });
    // Second ingest: same signal. Without dedup, this would double the count.
    await ingestor.ingest({ kind: 'calendar', raw, sourceSignalId: 'sig-2', scope });
    // Third for good measure.
    await ingestor.ingest({ kind: 'calendar', raw, sourceSignalId: 'sig-3', scope });

    const alice = (
      await mem.upsertEntityBySurface(
        {
          surface: 'Alice',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'alice@acme.com' }],
        },
        scope,
      )
    ).entity;
    const bob = (
      await mem.upsertEntityBySurface(
        {
          surface: 'Bob',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'bob@acme.com' }],
        },
        scope,
      )
    ).entity;

    const hostedFacts = await mem.findFacts(
      { subjectId: alice.id, predicate: 'hosted' },
      {},
      scope,
    );
    const attendedByBob = await mem.findFacts(
      { subjectId: bob.id, predicate: 'attended' },
      {},
      scope,
    );
    expect(hostedFacts.items).toHaveLength(1);
    expect(attendedByBob.items).toHaveLength(1);
  });

  it('re-ingest with changed startTime/endTime/location updates event metadata (overwrite)', async () => {
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor: emptyExtractor,
      adapters: [new CalendarSignalAdapter()],
    });
    const originalStart = new Date('2026-06-01T15:00:00Z');
    const originalEnd = new Date('2026-06-01T16:00:00Z');
    const rescheduledStart = new Date('2026-06-01T16:00:00Z');
    const rescheduledEnd = new Date('2026-06-01T17:00:00Z');

    const first = await ingestor.ingest({
      kind: 'calendar',
      raw: {
        id: 'cal_reschedule',
        title: 'Design review',
        startTime: originalStart,
        endTime: originalEnd,
        location: 'Room A',
        organizer: { email: 'alice@acme.com' },
      },
      sourceSignalId: 'sig-orig',
      scope,
    });
    const originalEvent = first.entities.find((e) => e.entity.type === 'event')!;
    expect(originalEvent.entity.metadata).toMatchObject({
      startTime: originalStart,
      endTime: originalEnd,
      location: 'Room A',
    });

    // Meeting moved — same canonical id (same source + external id), new schedule.
    const second = await ingestor.ingest({
      kind: 'calendar',
      raw: {
        id: 'cal_reschedule',
        title: 'Design review',
        startTime: rescheduledStart,
        endTime: rescheduledEnd,
        location: 'Room B',
        organizer: { email: 'alice@acme.com' },
      },
      sourceSignalId: 'sig-resched',
      scope,
    });
    const updatedEvent = second.entities.find((e) => e.entity.type === 'event')!;
    // Same entity id (canonical-id match).
    expect(updatedEvent.entity.id).toBe(originalEvent.entity.id);
    // Metadata actually reflects the new schedule — this is the bug fix.
    expect(updatedEvent.entity.metadata).toMatchObject({
      startTime: rescheduledStart,
      endTime: rescheduledEnd,
      location: 'Room B',
    });
  });

  it('person seeds stay on fillMissing — a signal does not rename an existing person', async () => {
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor: emptyExtractor,
      adapters: [new CalendarSignalAdapter()],
    });
    // Pre-create Alice with a displayName the user cares about + custom metadata.
    await mem.upsertEntityBySurface(
      {
        surface: 'Alice Lovelace',
        type: 'person',
        identifiers: [{ kind: 'email', value: 'alice@acme.com' }],
        metadata: { role: 'CTO' },
      },
      scope,
    );

    await ingestor.ingest({
      kind: 'calendar',
      raw: {
        id: 'cal_person_preserve',
        title: 'Sync',
        startTime: new Date('2026-06-02T10:00:00Z'),
        // Calendar signal carries a shorter display + no role metadata.
        organizer: { email: 'alice@acme.com', name: 'Alice' },
      },
      sourceSignalId: 'sig-person',
      scope,
    });

    const alice = (
      await mem.upsertEntityBySurface(
        {
          surface: 'alice@acme.com',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'alice@acme.com' }],
        },
        scope,
      )
    ).entity;
    // displayName preserved (aliases accumulate, not replace).
    expect(alice.displayName).toBe('Alice Lovelace');
    // Pre-existing metadata untouched (fillMissing default on person seed).
    expect(alice.metadata).toMatchObject({ role: 'CTO' });
  });

  it('same calendar event ingested twice converges on the same entity', async () => {
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor: emptyExtractor,
      adapters: [new CalendarSignalAdapter()],
    });
    const raw = {
      id: 'cal_conv',
      title: 'Repeating meeting',
      startTime: new Date('2026-05-03T10:00:00Z'),
      organizer: { email: 'alice@acme.com' },
    };
    const a = await ingestor.ingest({ kind: 'calendar', raw, sourceSignalId: 'sig-a', scope });
    const b = await ingestor.ingest({ kind: 'calendar', raw, sourceSignalId: 'sig-b', scope });
    const eventA = a.entities.find((e) => e.entity.type === 'event')!;
    const eventB = b.entities.find((e) => e.entity.type === 'event')!;
    expect(eventA.entity.id).toBe(eventB.entity.id);
  });

  it('event surfaces as relatedEvent for attendees (via fact tier — no attendeeIds metadata)', async () => {
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor: emptyExtractor,
      adapters: [new CalendarSignalAdapter()],
    });
    const startTime = new Date();
    await ingestor.ingest({
      kind: 'calendar',
      raw: {
        id: 'cal_surfaces',
        title: 'Budget Review',
        startTime,
        organizer: { email: 'alice@acme.com' },
        attendees: [{ email: 'bob@acme.com' }],
      },
      sourceSignalId: 'sig-surfaces',
      scope,
    });
    const bob = (
      await mem.upsertEntityBySurface(
        {
          surface: 'Bob',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'bob@acme.com' }],
        },
        scope,
      )
    ).entity;
    const view = await mem.getContext(bob.id, {}, scope);
    expect(view.relatedEvents).toBeDefined();
    const eventNames = view.relatedEvents!.map((e) => e.event.displayName);
    expect(eventNames).toContain('Budget Review');
    const budgetEvent = view.relatedEvents!.find((e) => e.event.displayName === 'Budget Review')!;
    expect(budgetEvent.role).toBe('attended');
  });

  it('organizer surfaces with role=hosted', async () => {
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor: emptyExtractor,
      adapters: [new CalendarSignalAdapter()],
    });
    await ingestor.ingest({
      kind: 'calendar',
      raw: {
        id: 'cal_host',
        title: 'All-hands',
        startTime: new Date(),
        organizer: { email: 'ceo@acme.com' },
      },
      sourceSignalId: 'sig-host',
      scope,
    });
    const ceo = (
      await mem.upsertEntityBySurface(
        {
          surface: 'CEO',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'ceo@acme.com' }],
        },
        scope,
      )
    ).entity;
    const view = await mem.getContext(ceo.id, {}, scope);
    const allHands = view.relatedEvents!.find((e) => e.event.displayName === 'All-hands');
    expect(allHands).toBeDefined();
    expect(allHands!.role).toBe('hosted');
  });
});
