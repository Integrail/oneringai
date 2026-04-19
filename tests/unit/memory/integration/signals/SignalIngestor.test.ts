/**
 * SignalIngestor end-to-end tests — raw signal → pre-resolved participants →
 * prompt rendered → mock IExtractor returns JSON → ExtractionResolver writes
 * facts. Asserts each stage of the pipeline behaves correctly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import { SignalIngestor } from '@/memory/integration/signals/SignalIngestor.js';
import { EmailSignalAdapter } from '@/memory/integration/signals/adapters/EmailSignalAdapter.js';
import { PlainTextAdapter } from '@/memory/integration/signals/adapters/PlainTextAdapter.js';
import type {
  IExtractor,
  ParticipantSeed,
} from '@/memory/integration/signals/types.js';
import type { ExtractionOutput } from '@/memory/integration/ExtractionResolver.js';
import type { ScopeFilter } from '@/memory/types.js';

// -----------------------------------------------------------------------------
// Helper — mock extractor that records the prompt it received and returns a
// caller-supplied fixture.
// -----------------------------------------------------------------------------

function makeExtractor(fixture: ExtractionOutput): IExtractor & {
  calls: string[];
  setFixture: (f: ExtractionOutput) => void;
} {
  const state = { fixture };
  const calls: string[] = [];
  return {
    calls,
    setFixture(f) {
      state.fixture = f;
    },
    async extract(prompt: string) {
      calls.push(prompt);
      return state.fixture;
    },
  };
}

// -----------------------------------------------------------------------------

describe('SignalIngestor', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;
  const scope: ScopeFilter = { userId: 'test-user' };

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('throws when ingest is called with an unknown kind', async () => {
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor: makeExtractor({ mentions: {}, facts: [] }),
    });
    await expect(
      ingestor.ingest({ kind: 'slack', raw: {}, sourceSignalId: 's1', scope }),
    ).rejects.toThrow(/no adapter registered for kind 'slack'/);
  });

  it('seeds participants before the LLM call and binds them as m1, m2 …', async () => {
    const extractor = makeExtractor({
      mentions: {
        m3: { surface: 'Q3 Planning', type: 'project' },
      },
      facts: [
        { subject: 'm1', predicate: 'works_at', object: 'm2', importance: 1.0 },
        { subject: 'm1', predicate: 'leads', object: 'm3' },
      ],
    });
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor,
      adapters: [new EmailSignalAdapter({ seedOrganizations: false })],
    });

    const result = await ingestor.ingest({
      kind: 'email',
      raw: {
        from: { email: 'anton@everworker.ai', name: 'Anton Antich' },
        to: [{ email: 'sarah@acme.com', name: 'Sarah Chen' }],
        subject: 'Planning',
        body: 'Planning chat.',
      },
      sourceSignalId: 'email_1',
      scope,
    });

    expect(extractor.calls).toHaveLength(1);
    const prompt = extractor.calls[0]!;
    expect(prompt).toContain('## Pre-resolved labels');
    expect(prompt).toMatch(/`m1` — from: person "Anton Antich"/);
    expect(prompt).toMatch(/`m2` — to: person "Sarah Chen"/);

    const labels = result.entities.map((e) => e.label).sort();
    expect(labels).toEqual(['m1', 'm2', 'm3']);

    const m1 = result.entities.find((e) => e.label === 'm1')!;
    expect(m1.resolved).toBe(true);
    expect(m1.entity.identifiers[0]!.value).toBe('anton@everworker.ai');

    const worksAt = result.facts.find((f) => f.predicate === 'works_at')!;
    expect(worksAt.subjectId).toBe(m1.entity.id);

    for (const f of result.facts) expect(f.sourceSignalId).toBe('email_1');
  });

  it('ingestText works without any adapter and supports optional participants', async () => {
    const extractor = makeExtractor({
      mentions: {
        m2: { surface: 'Widgets', type: 'topic' },
      },
      facts: [{ subject: 'm1', predicate: 'mentioned_topic', object: 'm2' }],
    });
    const ingestor = new SignalIngestor({ memory: mem, extractor });

    const participants: ParticipantSeed[] = [
      {
        role: 'author',
        type: 'person',
        identifiers: [{ kind: 'email', value: 'dave@example.com' }],
        displayName: 'Dave',
      },
    ];

    const result = await ingestor.ingestText({
      text: 'Dave discussed Widgets with the team.',
      participants,
      sourceSignalId: 'note_1',
      scope,
    });

    expect(result.facts).toHaveLength(1);
    const m1 = result.entities.find((e) => e.label === 'm1')!;
    expect(m1.entity.identifiers[0]!.value).toBe('dave@example.com');
    expect(result.facts[0]!.subjectId).toBe(m1.entity.id);
  });

  it('records a seed error when a participant has no identifiers', async () => {
    const extractor = makeExtractor({ mentions: {}, facts: [] });
    const ingestor = new SignalIngestor({ memory: mem, extractor });

    const result = await ingestor.ingestText({
      text: 'body',
      participants: [{ role: 'from', identifiers: [] }],
      sourceSignalId: 's',
      scope,
    });

    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0]!.where).toBe('seed:0');
    expect(result.unresolved[0]!.reason).toMatch(/no strong identifiers/);
  });

  it('reuses an existing seeded entity on a second ingest', async () => {
    const extractor = makeExtractor({ mentions: {}, facts: [] });
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor,
      adapters: [new EmailSignalAdapter({ seedOrganizations: false })],
    });

    const first = await ingestor.ingest({
      kind: 'email',
      raw: {
        from: { email: 'a@example.com', name: 'Alice' },
        body: 'hi',
      },
      sourceSignalId: 's1',
      scope,
    });

    const second = await ingestor.ingest({
      kind: 'email',
      raw: {
        from: { email: 'a@example.com', name: 'Alice' },
        body: 'hi again',
      },
      sourceSignalId: 's2',
      scope,
    });

    const firstId = first.entities.find((e) => e.label === 'm1')!.entity.id;
    const secondId = second.entities.find((e) => e.label === 'm1')!.entity.id;
    expect(secondId).toBe(firstId);
  });

  it('PlainTextAdapter works end-to-end with no seeds', async () => {
    const extractor = makeExtractor({
      mentions: {
        m1: {
          surface: 'Jane',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'jane@x.com' }],
        },
      },
      facts: [{ subject: 'm1', predicate: 'title', value: 'CTO' }],
    });
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor,
      adapters: [new PlainTextAdapter()],
    });

    const result = await ingestor.ingest({
      kind: 'text',
      raw: { text: 'Jane is our CTO.' },
      sourceSignalId: 'note_9',
      scope,
    });

    expect(result.facts).toHaveLength(1);
    const prompt = extractor.calls[0]!;
    expect(prompt).not.toContain('## Pre-resolved labels');
  });

  it('registerAdapter adds an adapter after construction', async () => {
    const extractor = makeExtractor({ mentions: {}, facts: [] });
    const ingestor = new SignalIngestor({ memory: mem, extractor });
    expect(ingestor.hasAdapter('email')).toBe(false);
    ingestor.registerAdapter(new EmailSignalAdapter({ seedOrganizations: false }));
    expect(ingestor.hasAdapter('email')).toBe(true);
  });

  it('passes predicateRegistry to the prompt when supplied', async () => {
    const spy = vi.fn(() => 'mocked-prompt');
    const extractor = makeExtractor({ mentions: {}, facts: [] });
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor,
      promptTemplate: spy,
    });
    await ingestor.ingestText({ text: 'hi', sourceSignalId: 's', scope });
    expect(spy).toHaveBeenCalledOnce();
    const ctx = spy.mock.calls[0]![0];
    expect(ctx.signalText).toBe('hi');
  });
});
