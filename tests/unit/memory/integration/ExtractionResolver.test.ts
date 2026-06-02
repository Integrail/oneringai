/**
 * ExtractionResolver tests — end-to-end from raw LLM output → resolved facts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import { ExtractionResolver } from '@/memory/integration/ExtractionResolver.js';
import type { ExtractionOutput } from '@/memory/integration/ExtractionResolver.js';
import type { ScopeFilter } from '@/memory/types.js';

describe('ExtractionResolver', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;
  let resolver: ExtractionResolver;
  const scope: ScopeFilter = { userId: 'test-user' };

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
    resolver = new ExtractionResolver(mem);
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  const johnMicrosoftQ3: ExtractionOutput = {
    mentions: {
      m1: {
        surface: 'John Doe',
        type: 'person',
        identifiers: [{ kind: 'email', value: 'john@microsoft.com' }],
      },
      m2: {
        surface: 'Microsoft',
        type: 'organization',
        identifiers: [{ kind: 'domain', value: 'microsoft.com' }],
        aliases: ['MSFT', 'Microsoft Inc.'],
      },
      m3: { surface: 'Q3 Planning', type: 'project' },
    },
    facts: [
      { subject: 'm1', predicate: 'works_at', object: 'm2', confidence: 0.95, importance: 1.0 },
      { subject: 'm1', predicate: 'leads', object: 'm3', confidence: 0.8 },
      {
        subject: 'm1',
        predicate: 'mentioned_topic',
        value: 'erp_renewal',
        details: 'John expressed frustration with Oracle timeline',
        contextIds: ['m2', 'm3'],
        importance: 0.7,
      },
    ],
  };

  it('resolves 3 mentions to 3 distinct entities + writes 3 facts', async () => {
    const result = await resolver.resolveAndIngest(johnMicrosoftQ3, 'signal_123', scope);

    expect(result.entities).toHaveLength(3);
    expect(result.entities.every((e) => !e.resolved)).toBe(true); // all new
    expect(result.facts).toHaveLength(3);
    expect(result.unresolved).toEqual([]);
  });

  it('attaches sourceSignalId to every written fact', async () => {
    const result = await resolver.resolveAndIngest(johnMicrosoftQ3, 'signal_abc', scope);
    for (const f of result.facts) {
      expect(f.sourceSignalId).toBe('signal_abc');
    }
  });

  it('forwards evidenceQuote from ExtractionFactSpec onto the stored fact', async () => {
    const out: ExtractionOutput = {
      mentions: {
        m1: { surface: 'Alice', type: 'person' },
      },
      facts: [
        {
          subject: 'm1',
          predicate: 'committed_to',
          value: 'ship-by-eoq',
          evidenceQuote: '"we will ship by end of quarter"',
        },
      ],
    };
    const result = await resolver.resolveAndIngest(out, 'sig_eq', scope);
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.evidenceQuote).toBe('"we will ship by end of quarter"');
  });

  it('translates mention labels to real entity IDs in facts', async () => {
    const result = await resolver.resolveAndIngest(johnMicrosoftQ3, 'signal_1', scope);
    const john = result.entities.find((e) => e.label === 'm1')!;
    const microsoft = result.entities.find((e) => e.label === 'm2')!;
    const q3 = result.entities.find((e) => e.label === 'm3')!;

    const worksAt = result.facts.find((f) => f.predicate === 'works_at')!;
    expect(worksAt.subjectId).toBe(john.entity.id);
    expect(worksAt.objectId).toBe(microsoft.entity.id);

    const leads = result.facts.find((f) => f.predicate === 'leads')!;
    expect(leads.subjectId).toBe(john.entity.id);
    expect(leads.objectId).toBe(q3.entity.id);

    const topic = result.facts.find((f) => f.predicate === 'mentioned_topic')!;
    expect(topic.subjectId).toBe(john.entity.id);
    expect(topic.contextIds!.sort()).toEqual([microsoft.entity.id, q3.entity.id].sort());
  });

  it('preserves confidence + importance on facts', async () => {
    const result = await resolver.resolveAndIngest(johnMicrosoftQ3, 'signal_2', scope);
    const worksAt = result.facts.find((f) => f.predicate === 'works_at')!;
    expect(worksAt.confidence).toBe(0.95);
    expect(worksAt.importance).toBe(1.0);
  });

  it('on repeat ingest, resolves existing entities instead of duplicating', async () => {
    await resolver.resolveAndIngest(johnMicrosoftQ3, 'signal_1', scope);
    const second = await resolver.resolveAndIngest(johnMicrosoftQ3, 'signal_2', scope);

    // All three entities should be resolved (not created).
    expect(second.entities.every((e) => e.resolved)).toBe(true);
  });

  it('accumulates aliases on re-ingest with variant surface forms', async () => {
    await resolver.resolveAndIngest(johnMicrosoftQ3, 'signal_1', scope);

    const secondOutput: ExtractionOutput = {
      mentions: {
        m1: {
          surface: 'Microsoft Corporation',  // fresh variant not already in aliases
          type: 'organization',
          identifiers: [{ kind: 'domain', value: 'microsoft.com' }],
        },
      },
      facts: [],
    };
    const second = await resolver.resolveAndIngest(secondOutput, 'signal_2', scope);
    expect(second.entities[0]!.resolved).toBe(true);

    // Filter by organization type to avoid matching John's email.
    const entities = await store.searchEntities('Microsoft', { types: ['organization'] }, scope);
    const microsoft = entities.items[0]!;
    expect(microsoft.aliases).toBeDefined();
    // Aliases should contain the originally-supplied variants AND the new "Microsoft Corporation".
    expect(microsoft.aliases!).toContain('MSFT');
    expect(microsoft.aliases!).toContain('Microsoft Inc.');
    expect(microsoft.aliases!).toContain('Microsoft Corporation');
  });

  it('records fact targeting undefined mention label as unresolved', async () => {
    const bad: ExtractionOutput = {
      mentions: {
        m1: {
          surface: 'John',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'john@x.com' }],
        },
      },
      facts: [
        // object label "m2" never declared
        { subject: 'm1', predicate: 'knows', object: 'm2' },
        // good fact should still be written
        { subject: 'm1', predicate: 'note', value: 'hello' },
      ],
    };
    const result = await resolver.resolveAndIngest(bad, 'signal_x', scope);
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.predicate).toBe('note');
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0]!.reason).toMatch(/object label "m2"/);
  });

  it('records fact with bad subject label as unresolved', async () => {
    const bad: ExtractionOutput = {
      mentions: {
        m1: {
          surface: 'John',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'john@x.com' }],
        },
      },
      facts: [{ subject: 'unknown_label', predicate: 'note', value: 'x' }],
    };
    const result = await resolver.resolveAndIngest(bad, 'signal', scope);
    expect(result.facts).toHaveLength(0);
    expect(result.unresolved[0]!.reason).toMatch(/subject label/);
  });

  it('records bad contextId label as unresolved but still writes the fact (C2)', async () => {
    const bad: ExtractionOutput = {
      mentions: {
        m1: {
          surface: 'John',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'j@x.com' }],
        },
      },
      facts: [
        {
          subject: 'm1',
          predicate: 'note',
          value: 'x',
          contextIds: ['undefined_label'],
        },
      ],
    };
    const result = await resolver.resolveAndIngest(bad, 'signal', scope);
    // Prior behaviour dropped the entire fact on one missing contextId. New
    // behaviour: surface the drop in `unresolved`, keep the fact with the
    // labels that did resolve (here: none, so contextIds is undefined).
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.contextIds).toBeUndefined();
    expect(result.unresolved[0]!.reason).toMatch(/context label/);
  });

  it('preserves resolved contextIds when one label is missing', async () => {
    const mixed: ExtractionOutput = {
      mentions: {
        m1: {
          surface: 'John',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'j@x.com' }],
        },
        m2: {
          surface: 'Q3 Planning',
          type: 'topic',
        },
      },
      facts: [
        {
          subject: 'm1',
          predicate: 'note',
          value: 'x',
          contextIds: ['m2', 'hallucinated_label'],
        },
      ],
    };
    const result = await resolver.resolveAndIngest(mixed, 'signal', scope);
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]!.contextIds).toHaveLength(1);
    expect(result.unresolved[0]!.reason).toMatch(/hallucinated_label/);
  });

  it('surfaces mergeCandidates when alias-tier match is below autoResolveThreshold (host-configured)', async () => {
    // Phase A Commit 4 raised the default alias-tier confidence from 0.85 to
    // 0.90. To preserve the original behavior — alias-only matches surface as
    // merge candidates rather than auto-resolving — a host can opt into the
    // pre-0.8.0 confidence via `aliasMatchConfidence: 0.85`. This test
    // verifies the configurable knob works.
    const store2 = new InMemoryAdapter();
    const mem2 = new MemorySystem({
      store: store2,
      entityResolution: { aliasMatchConfidence: 0.85 },
    });
    const resolver2 = new ExtractionResolver(mem2);

    // Pre-seed Microsoft with an alias "MSFT".
    await mem2.upsertEntityBySurface(
      {
        surface: 'Microsoft',
        type: 'organization',
        identifiers: [{ kind: 'domain', value: 'microsoft.com' }],
        aliases: ['MSFT'],
      },
      scope,
    );

    // Extract "MSFT" — alias tier returns 0.85 (configured), below the
    // default 0.90 autoResolveThreshold → new entity created, existing
    // Microsoft surfaces as a merge candidate.
    const output: ExtractionOutput = {
      mentions: {
        m1: { surface: 'MSFT', type: 'organization' },
      },
      facts: [],
    };
    const result = await resolver2.resolveAndIngest(output, 'signal_merge', scope);
    expect(result.mergeCandidates.length).toBeGreaterThanOrEqual(1);
    mem2.destroy();
  });

  it('empty mentions + empty facts → empty result', async () => {
    const result = await resolver.resolveAndIngest(
      { mentions: {}, facts: [] },
      'signal_empty',
      scope,
    );
    expect(result.entities).toEqual([]);
    expect(result.facts).toEqual([]);
    expect(result.unresolved).toEqual([]);
  });

  it('handles task-as-entity — task entity + state attribute fact', async () => {
    const output: ExtractionOutput = {
      mentions: {
        m1: {
          surface: 'John',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'j@acme.com' }],
        },
        m2: { surface: 'Send Q3 budget proposal', type: 'task' },
      },
      facts: [
        { subject: 'm1', predicate: 'committed_to', object: 'm2', confidence: 0.9 },
        {
          subject: 'm2',
          predicate: 'due_date',
          value: '2026-04-30',
          importance: 0.8,
        },
      ],
    };
    const result = await resolver.resolveAndIngest(output, 'signal_task', scope);
    expect(result.facts).toHaveLength(2);
    const task = result.entities.find((e) => e.entity.type === 'task');
    expect(task).toBeDefined();
    expect(task!.entity.displayName).toBe('Send Q3 budget proposal');
  });

  it('parses ISO date strings in observedAt/validFrom/validUntil', async () => {
    const output: ExtractionOutput = {
      mentions: {
        m1: {
          surface: 'John',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'jd@x.com' }],
        },
      },
      facts: [
        {
          subject: 'm1',
          predicate: 'title',
          value: 'CTO',
          validFrom: '2026-01-01',
          validUntil: '2026-12-31',
          observedAt: '2026-02-15',
        },
      ],
    };
    const result = await resolver.resolveAndIngest(output, 'signal_dates', scope);
    const fact = result.facts[0]!;
    expect(fact.validFrom).toBeInstanceOf(Date);
    expect(fact.validFrom!.getFullYear()).toBe(2026);
    expect(fact.observedAt).toBeInstanceOf(Date);
  });

  describe('label translation in mention.metadata', () => {
    it('translates event.attendeeIds labels → entity ids', async () => {
      const output: ExtractionOutput = {
        mentions: {
          m1: {
            surface: 'Alice',
            type: 'person',
            identifiers: [{ kind: 'email', value: 'alice@acme.com' }],
          },
          m2: {
            surface: 'Bob',
            type: 'person',
            identifiers: [{ kind: 'email', value: 'bob@acme.com' }],
          },
          evt: {
            surface: 'Q3 sync',
            type: 'event',
            metadata: {
              startTime: '2026-05-01T10:00:00Z',
              attendeeIds: ['m1', 'm2'],
            },
          },
        },
        facts: [],
      };
      const result = await resolver.resolveAndIngest(output, 'signal_evt', scope);
      const evt = result.entities.find((e) => e.label === 'evt');
      expect(evt).toBeDefined();
      const md = evt!.entity.metadata as Record<string, unknown>;
      const aliceId = result.entities.find((e) => e.label === 'm1')!.entity.id;
      const bobId = result.entities.find((e) => e.label === 'm2')!.entity.id;
      expect(md.attendeeIds).toEqual([aliceId, bobId]);
      expect(result.unresolved).toEqual([]);
    });

    it('translates task.assigneeId label → entity id', async () => {
      const output: ExtractionOutput = {
        mentions: {
          john: {
            surface: 'John',
            type: 'person',
            identifiers: [{ kind: 'email', value: 'j@acme.com' }],
          },
          t1: {
            surface: 'Send budget',
            type: 'task',
            metadata: { state: 'proposed', assigneeId: 'john' },
          },
        },
        facts: [],
      };
      const result = await resolver.resolveAndIngest(output, 'signal_task', scope);
      const task = result.entities.find((e) => e.label === 't1')!;
      const johnId = result.entities.find((e) => e.label === 'john')!.entity.id;
      const md = task.entity.metadata as Record<string, unknown>;
      expect(md.assigneeId).toBe(johnId);
      expect(md.state).toBe('proposed'); // unchanged passthrough
      expect(result.unresolved).toEqual([]);
    });

    it('drops unresolved labels in attendeeIds and surfaces them in unresolved[]', async () => {
      const output: ExtractionOutput = {
        mentions: {
          m1: {
            surface: 'Alice',
            type: 'person',
            identifiers: [{ kind: 'email', value: 'alice@acme.com' }],
          },
          evt: {
            surface: 'Sync',
            type: 'event',
            metadata: { attendeeIds: ['m1', 'ghost', 'm1'] },
          },
        },
        facts: [],
      };
      const result = await resolver.resolveAndIngest(output, 'signal', scope);
      const evt = result.entities.find((e) => e.label === 'evt')!;
      const aliceId = result.entities.find((e) => e.label === 'm1')!.entity.id;
      const md = evt.entity.metadata as Record<string, unknown>;
      expect(md.attendeeIds).toEqual([aliceId, aliceId]);
      const drops = result.unresolved.filter((u) =>
        u.where.includes('mention:evt.metadata.attendeeIds'),
      );
      expect(drops).toHaveLength(1);
      expect(drops[0]!.reason).toContain('"ghost"');
    });

    it('drops unresolved single-value label and logs to unresolved[]', async () => {
      const output: ExtractionOutput = {
        mentions: {
          t1: {
            surface: 'Do thing',
            type: 'task',
            metadata: { assigneeId: 'ghost' },
          },
        },
        facts: [],
      };
      const result = await resolver.resolveAndIngest(output, 'signal', scope);
      const task = result.entities.find((e) => e.label === 't1')!;
      const md = task.entity.metadata as Record<string, unknown>;
      // Field is set to undefined (shallow merge), not a stale label.
      expect(md.assigneeId).toBeUndefined();
      const drops = result.unresolved.filter((u) =>
        u.where.includes('mention:t1.metadata.assigneeId'),
      );
      expect(drops).toHaveLength(1);
      expect(drops[0]!.reason).toContain('"ghost"');
    });

    it('translates pre-resolved labels (e.g. m_self) inside attendeeIds', async () => {
      const selfSeed = await mem.upsertEntityBySurface(
        {
          surface: 'Anton',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'anton@everworker.ai' }],
        },
        scope,
      );
      const output: ExtractionOutput = {
        mentions: {
          evt: {
            surface: '1:1',
            type: 'event',
            metadata: { attendeeIds: ['m_self'] },
          },
        },
        facts: [],
      };
      const result = await resolver.resolveAndIngest(output, 'signal', scope, {
        preResolved: { m_self: selfSeed.entity.id },
      });
      const evt = result.entities.find((e) => e.label === 'evt')!;
      const md = evt.entity.metadata as Record<string, unknown>;
      expect(md.attendeeIds).toEqual([selfSeed.entity.id]);
      expect(result.unresolved).toEqual([]);
    });

    it('leaves metadata untouched when no translatable fields are present', async () => {
      const output: ExtractionOutput = {
        mentions: {
          evt: {
            surface: 'Sync',
            type: 'event',
            metadata: { startTime: '2026-05-01T10:00:00Z', location: 'Zoom' },
          },
        },
        facts: [],
      };
      const result = await resolver.resolveAndIngest(output, 'signal', scope);
      const evt = result.entities.find((e) => e.label === 'evt')!;
      const md = evt.entity.metadata as Record<string, unknown>;
      expect(md.location).toBe('Zoom');
      expect(md.attendeeIds).toBeUndefined();
      expect(result.unresolved).toEqual([]);
    });

    it('preserves existing event.attendeeIds on re-extraction (fillMissing)', async () => {
      // Seed three real entities + an event whose attendeeIds are real ids.
      const alice = await mem.upsertEntityBySurface(
        {
          surface: 'Alice',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'alice@acme.com' }],
        },
        scope,
      );
      const bob = await mem.upsertEntityBySurface(
        {
          surface: 'Bob',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'bob@acme.com' }],
        },
        scope,
      );
      const evtSeed = await mem.upsertEntityBySurface(
        {
          surface: 'Q3 sync',
          type: 'event',
          identifiers: [{ kind: 'canonical', value: 'evt:q3-sync' }],
          metadata: { attendeeIds: [alice.entity.id, bob.entity.id] },
        },
        scope,
      );

      // Re-extract with LLM labels — without the fillMissing guard this would
      // clobber [aliceId, bobId] down to [aliceId].
      const output: ExtractionOutput = {
        mentions: {
          m1: {
            surface: 'Alice',
            type: 'person',
            identifiers: [{ kind: 'email', value: 'alice@acme.com' }],
          },
          evt: {
            surface: 'Q3 sync',
            type: 'event',
            identifiers: [{ kind: 'canonical', value: 'evt:q3-sync' }],
            metadata: { attendeeIds: ['m1'] },
          },
        },
        facts: [],
      };
      const result = await resolver.resolveAndIngest(output, 'signal_re', scope);
      const evt = result.entities.find((e) => e.label === 'evt')!;
      expect(evt.entity.id).toBe(evtSeed.entity.id);
      expect(evt.resolved).toBe(true);
      const md = evt.entity.metadata as Record<string, unknown>;
      expect(md.attendeeIds).toEqual([alice.entity.id, bob.entity.id]);
      const skips = result.unresolved.filter((u) =>
        u.where.includes('mention:evt.metadata.attendeeIds'),
      );
      expect(skips).toHaveLength(1);
      expect(skips[0]!.reason).toContain('fillMissing');
    });

    it('preserves existing task.assigneeId on re-extraction (fillMissing)', async () => {
      const john = await mem.upsertEntityBySurface(
        {
          surface: 'John',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'john@acme.com' }],
        },
        scope,
      );
      const taskSeed = await mem.upsertEntityBySurface(
        {
          surface: 'Send budget',
          type: 'task',
          identifiers: [{ kind: 'canonical', value: 'task:send-budget' }],
          metadata: { state: 'in_progress', assigneeId: john.entity.id },
        },
        scope,
      );

      const output: ExtractionOutput = {
        mentions: {
          m_other: {
            surface: 'Mary',
            type: 'person',
            identifiers: [{ kind: 'email', value: 'mary@acme.com' }],
          },
          t1: {
            surface: 'Send budget',
            type: 'task',
            identifiers: [{ kind: 'canonical', value: 'task:send-budget' }],
            metadata: { assigneeId: 'm_other' },
          },
        },
        facts: [],
      };
      const result = await resolver.resolveAndIngest(output, 'signal_task_re', scope);
      const task = result.entities.find((e) => e.label === 't1')!;
      expect(task.entity.id).toBe(taskSeed.entity.id);
      expect(task.resolved).toBe(true);
      const md = task.entity.metadata as Record<string, unknown>;
      expect(md.assigneeId).toBe(john.entity.id);
      const skips = result.unresolved.filter((u) =>
        u.where.includes('mention:t1.metadata.assigneeId'),
      );
      expect(skips).toHaveLength(1);
      expect(skips[0]!.reason).toContain('fillMissing');
    });

    it('translates labels on resolved entity when the field was unset', async () => {
      // Seed an event WITHOUT attendeeIds. Re-extraction should fill the
      // field with translated ids — fillMissing did write the LLM's labels
      // because the existing field was missing, so translation is safe.
      const alice = await mem.upsertEntityBySurface(
        {
          surface: 'Alice',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'alice@acme.com' }],
        },
        scope,
      );
      const evtSeed = await mem.upsertEntityBySurface(
        {
          surface: 'Q3 sync',
          type: 'event',
          identifiers: [{ kind: 'canonical', value: 'evt:q3-sync' }],
          metadata: { startTime: '2026-05-01T10:00:00Z' },
        },
        scope,
      );

      const output: ExtractionOutput = {
        mentions: {
          m1: {
            surface: 'Alice',
            type: 'person',
            identifiers: [{ kind: 'email', value: 'alice@acme.com' }],
          },
          evt: {
            surface: 'Q3 sync',
            type: 'event',
            identifiers: [{ kind: 'canonical', value: 'evt:q3-sync' }],
            metadata: { attendeeIds: ['m1'] },
          },
        },
        facts: [],
      };
      const result = await resolver.resolveAndIngest(output, 'signal_fill', scope);
      const evt = result.entities.find((e) => e.label === 'evt')!;
      expect(evt.entity.id).toBe(evtSeed.entity.id);
      expect(evt.resolved).toBe(true);
      const md = evt.entity.metadata as Record<string, unknown>;
      expect(md.attendeeIds).toEqual([alice.entity.id]);
      expect(result.unresolved).toEqual([]);
    });
  });

  describe('preResolved bindings', () => {
    it('uses pre-resolved entity id without calling upsertEntityBySurface', async () => {
      const antonSeed = await mem.upsertEntityBySurface(
        {
          surface: 'Anton Antich',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'anton@everworker.ai' }],
        },
        scope,
      );

      const countBefore = (await store.listEntities({}, { limit: 100 }, scope)).items.length;

      const output: ExtractionOutput = {
        mentions: {
          m2: {
            surface: 'Acme Corp',
            type: 'organization',
            identifiers: [{ kind: 'domain', value: 'acme.com' }],
          },
        },
        facts: [{ subject: 'm1', predicate: 'works_at', object: 'm2', confidence: 0.95 }],
      };

      const result = await resolver.resolveAndIngest(output, 'signal_seed', scope, {
        preResolved: { m1: antonSeed.entity.id },
      });

      expect(result.facts).toHaveLength(1);
      expect(result.facts[0]!.subjectId).toBe(antonSeed.entity.id);
      expect(result.unresolved).toEqual([]);

      const countAfter = (await store.listEntities({}, { limit: 100 }, scope)).items.length;
      expect(countAfter).toBe(countBefore + 1);
    });

    it('ignores a mention that redeclares a pre-resolved label', async () => {
      const antonSeed = await mem.upsertEntityBySurface(
        {
          surface: 'Anton Antich',
          type: 'person',
          identifiers: [{ kind: 'email', value: 'anton@everworker.ai' }],
        },
        scope,
      );

      const output: ExtractionOutput = {
        mentions: {
          m1: {
            surface: 'Anton',
            type: 'person',
            identifiers: [{ kind: 'email', value: 'anton@everworker.ai' }],
          },
          m2: {
            surface: 'Acme',
            type: 'organization',
            identifiers: [{ kind: 'domain', value: 'acme.com' }],
          },
        },
        facts: [{ subject: 'm1', predicate: 'works_at', object: 'm2' }],
      };

      const result = await resolver.resolveAndIngest(output, 'signal_redeclare', scope, {
        preResolved: { m1: antonSeed.entity.id },
      });

      expect(result.facts).toHaveLength(1);
      expect(result.facts[0]!.subjectId).toBe(antonSeed.entity.id);

      const m1Entries = result.entities.filter((e) => e.label === 'm1');
      expect(m1Entries.length).toBeLessThanOrEqual(1);
      const m2 = result.entities.find((e) => e.label === 'm2')!;
      expect(m2).toBeDefined();
    });

    it('pre-resolved labels work as contextIds too', async () => {
      const dealSeed = await mem.upsertEntityBySurface(
        { surface: 'Acme Deal', type: 'topic', identifiers: [{ kind: 'domain', value: 'acme.com/deal-42' }] },
        scope,
      );

      const output: ExtractionOutput = {
        mentions: {
          m1: {
            surface: 'John',
            type: 'person',
            identifiers: [{ kind: 'email', value: 'john@acme.com' }],
          },
        },
        facts: [
          {
            subject: 'm1',
            predicate: 'mentioned_topic',
            value: 'pricing',
            contextIds: ['m_deal'],
          },
        ],
      };

      const result = await resolver.resolveAndIngest(output, 'signal_ctx', scope, {
        preResolved: { m_deal: dealSeed.entity.id },
      });

      expect(result.unresolved).toEqual([]);
      expect(result.facts[0]!.contextIds).toEqual([dealSeed.entity.id]);
    });
  });

  describe('unknownPredicatePolicy (H5)', () => {
    it('fuzzy-maps a near-miss to the closest registered predicate', async () => {
      const { PredicateRegistry } = await import('@/memory/predicates/PredicateRegistry.js');
      const mem2 = new MemorySystem({
        store: new InMemoryAdapter(),
        predicates: PredicateRegistry.standard(),
        // default policy is 'fuzzy_map'
      });
      const resolver2 = new ExtractionResolver(mem2);
      const out: ExtractionOutput = {
        mentions: {
          m1: {
            surface: 'John',
            type: 'person',
            identifiers: [{ kind: 'email', value: 'j@x.com' }],
          },
          m2: {
            surface: 'Acme',
            type: 'organization',
            identifiers: [{ kind: 'domain', value: 'acme.com' }],
          },
        },
        facts: [
          // `work_at` is a 1-char typo of the registered `works_at`.
          { subject: 'm1', predicate: 'work_at', object: 'm2' },
        ],
      };
      const result = await resolver2.resolveAndIngest(out, 'sig', scope);
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0]!.predicate).toBe('works_at');
      // Mapping surfaces in newPredicates for audit.
      expect(result.newPredicates).toContain('work_at→works_at');
      await mem2.shutdown();
    });

    it('drop policy skips the fact entirely', async () => {
      const { PredicateRegistry } = await import('@/memory/predicates/PredicateRegistry.js');
      const mem2 = new MemorySystem({
        store: new InMemoryAdapter(),
        predicates: PredicateRegistry.standard(),
        unknownPredicatePolicy: 'drop',
      });
      const resolver2 = new ExtractionResolver(mem2);
      const out: ExtractionOutput = {
        mentions: {
          m1: { surface: 'X', type: 'topic' },
        },
        facts: [
          { subject: 'm1', predicate: 'wildly_invented_predicate', value: 'v' },
        ],
      };
      const result = await resolver2.resolveAndIngest(out, 'sig', scope);
      expect(result.facts).toHaveLength(0);
      expect(result.unresolved[0]!.reason).toMatch(/unknownPredicatePolicy='drop'/);
      expect(result.newPredicates).toContain('wildly_invented_predicate');
      await mem2.shutdown();
    });

    it('keep policy writes the unknown predicate verbatim', async () => {
      const { PredicateRegistry } = await import('@/memory/predicates/PredicateRegistry.js');
      const mem2 = new MemorySystem({
        store: new InMemoryAdapter(),
        predicates: PredicateRegistry.standard(),
        unknownPredicatePolicy: 'keep',
      });
      const resolver2 = new ExtractionResolver(mem2);
      const out: ExtractionOutput = {
        mentions: {
          m1: { surface: 'X', type: 'topic' },
        },
        facts: [
          { subject: 'm1', predicate: 'something_brand_new', value: 'v' },
        ],
      };
      const result = await resolver2.resolveAndIngest(out, 'sig', scope);
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0]!.predicate).toBe('something_brand_new');
      expect(result.newPredicates).toContain('something_brand_new');
      await mem2.shutdown();
    });
  });

  describe('defaultAcl (v13)', () => {
    // ACL principals are opaque strings the host materialises (e.g. v25's
    // `entity:<personId>`). Use a couple of literal tokens for the tests.
    const PARTICIPANT_ACL = [
      { principal: 'entity:person_a', actions: ['read'] as ('read' | 'write')[] },
      { principal: 'entity:person_b', actions: ['read'] as ('read' | 'write')[] },
    ];

    it('stamps the acl on every NEW fact, materializing readPrincipals', async () => {
      const out: ExtractionOutput = {
        mentions: {
          m1: { surface: 'Alice', type: 'person' },
          m2: { surface: 'Acme', type: 'organization' },
        },
        facts: [
          { subject: 'm1', predicate: 'works_at', object: 'm2', confidence: 0.9 },
        ],
      };
      const result = await resolver.resolveAndIngest(out, 'sig_acl_1', scope, {
        defaultAcl: PARTICIPANT_ACL,
      });
      expect(result.facts).toHaveLength(1);
      const f = result.facts[0]!;
      // Library stamps the acl verbatim …
      expect(f.acl).toEqual(PARTICIPANT_ACL);
      // … and materializes the principal tokens into readPrincipals.
      expect(f.readPrincipals).toContain('entity:person_a');
      expect(f.readPrincipals).toContain('entity:person_b');
    });

    it('stamps the acl on entities created this extraction', async () => {
      const out: ExtractionOutput = {
        mentions: {
          m_task: {
            surface: 'Send Q3 budget by Friday',
            type: 'task',
            identifiers: [
              { kind: 'canonical', value: 'task:send-q3-budget-2026-04-30' },
            ],
          },
        },
        facts: [],
      };
      const result = await resolver.resolveAndIngest(out, 'sig_acl_2', scope, {
        defaultAcl: PARTICIPANT_ACL,
      });
      expect(result.entities).toHaveLength(1);
      const task = result.entities[0]!.entity;
      expect(task.acl).toEqual(PARTICIPANT_ACL);
      expect(task.readPrincipals).toContain('entity:person_a');
      expect(task.readPrincipals).toContain('entity:person_b');
    });

    it('does NOT clobber pre-existing entity acl on re-resolve', async () => {
      // First extraction stamps an initial ACL on a Person entity.
      const FIRST_ACL = [
        { principal: 'entity:person_a', actions: ['read'] as ('read' | 'write')[] },
      ];
      const out1: ExtractionOutput = {
        mentions: {
          m1: {
            surface: 'Carol',
            type: 'person',
            identifiers: [{ kind: 'email', value: 'carol@acme.com' }],
          },
        },
        facts: [],
      };
      const res1 = await resolver.resolveAndIngest(out1, 'sig_1', scope, {
        defaultAcl: FIRST_ACL,
      });
      const personId = res1.entities[0]!.entity.id;
      expect(res1.entities[0]!.entity.acl).toEqual(FIRST_ACL);

      // Second extraction re-resolves the SAME Person (same identifier) with a
      // DIFFERENT defaultAcl. Pre-existing acl must survive untouched —
      // resolve-side never narrows access state.
      const SECOND_ACL = [
        { principal: 'entity:person_z', actions: ['read'] as ('read' | 'write')[] },
      ];
      const out2: ExtractionOutput = {
        mentions: {
          m1: {
            surface: 'Carol',
            type: 'person',
            identifiers: [{ kind: 'email', value: 'carol@acme.com' }],
          },
        },
        facts: [],
      };
      const res2 = await resolver.resolveAndIngest(out2, 'sig_2', scope, {
        defaultAcl: SECOND_ACL,
      });
      expect(res2.entities[0]!.entity.id).toBe(personId);
      expect(res2.entities[0]!.resolved).toBe(true);
      // The re-resolved entity still carries the FIRST ACL (host must use
      // memory.setAccess for explicit updates — resolver path never narrows).
      const fetched = await mem.getEntity(personId, scope);
      expect(fetched?.acl).toEqual(FIRST_ACL);
    });

    it('omitted defaultAcl leaves facts/entities with no acl (pre-v13 behavior)', async () => {
      const out: ExtractionOutput = {
        mentions: {
          m1: { surface: 'Dave', type: 'person' },
        },
        facts: [
          { subject: 'm1', predicate: 'works_at', value: 'somewhere' },
        ],
      };
      const result = await resolver.resolveAndIngest(out, 'sig_acl_3', scope);
      expect(result.entities[0]!.entity.acl).toBeUndefined();
      expect(result.facts[0]!.acl).toBeUndefined();
    });
  });

  describe('anchorIds passthrough (v13)', () => {
    // Pre-create a real "priority" entity so we can use its id as a raw anchor.
    // In production these are stamped by the host's priority pipeline; here we
    // mint one inline so the test exercises only the resolver fallback path.
    async function mintPriority(label: string) {
      const res = await mem.upsertEntityBySurface(
        { surface: label, type: 'priority', identifiers: [] },
        scope,
      );
      return res.entity.id;
    }

    it('raw anchor id in fact.contextIds passes through when listed in anchorIds[]', async () => {
      const priorityId = await mintPriority('Q3 Budget');

      const out: ExtractionOutput = {
        mentions: {
          m1: { surface: 'John', type: 'person' },
        },
        facts: [
          {
            subject: 'm1',
            predicate: 'expressed_concern',
            value: 'Oracle pricing',
            // Raw entity id — NOT a mention label. v12 would silently drop
            // this; v13's anchorIds allowlist permits passthrough.
            contextIds: [priorityId],
            confidence: 0.85,
            importance: 0.7,
          },
        ],
      };
      const result = await resolver.resolveAndIngest(out, 'sig_anchor_1', scope, {
        anchorIds: [priorityId],
      });

      expect(result.facts).toHaveLength(1);
      expect(result.facts[0]!.contextIds).toEqual([priorityId]);
      // No "context label not found" entry should appear.
      const dropMessages = result.unresolved
        .filter((u) => u.where === 'fact:0')
        .map((u) => u.reason);
      expect(dropMessages).toEqual([]);
    });

    it('raw id NOT in anchorIds[] is dropped (current pre-v13 behavior for unknowns)', async () => {
      const out: ExtractionOutput = {
        mentions: {
          m1: { surface: 'John', type: 'person' },
        },
        facts: [
          {
            subject: 'm1',
            predicate: 'expressed_concern',
            value: 'something',
            contextIds: ['some_random_priority_id_that_is_not_allowlisted'],
          },
        ],
      };
      // No anchorIds passed → fallback is empty set → the raw id drops.
      const result = await resolver.resolveAndIngest(out, 'sig_anchor_2', scope);
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0]!.contextIds).toBeUndefined();
      expect(result.unresolved.some((u) => /not found in mentions/.test(u.reason))).toBe(true);
    });

    it('servesAnchorId on task metadata accepts raw anchor id via the same allowlist', async () => {
      const priorityId = await mintPriority('Q3 Launch');

      const out: ExtractionOutput = {
        mentions: {
          t1: {
            surface: 'Send Q3 status update',
            type: 'task',
            identifiers: [
              { kind: 'canonical', value: 'task:send-q3-status-2026-06-30' },
            ],
            // Raw anchor id — pre-v13 would silently drop because the
            // translator only consulted labelToEntityId.
            metadata: {
              state: 'proposed',
              servesAnchorId: priorityId,
            },
          },
        },
        facts: [],
      };
      const result = await resolver.resolveAndIngest(out, 'sig_anchor_3', scope, {
        anchorIds: [priorityId],
      });

      expect(result.entities).toHaveLength(1);
      const task = result.entities[0]!.entity as { metadata?: { servesAnchorId?: string } };
      expect(task.metadata?.servesAnchorId).toBe(priorityId);
    });

    it('stale anchor id (not visible in scope) is dropped + reported via unresolved', async () => {
      // No priority is minted. Caller passes a plausible-looking but unknown id.
      const STALE_ID = 'priority_that_does_not_exist_12345';

      const out: ExtractionOutput = {
        mentions: {
          m1: { surface: 'John', type: 'person' },
        },
        facts: [
          {
            subject: 'm1',
            predicate: 'expressed_concern',
            value: 'pricing',
            contextIds: [STALE_ID],
          },
        ],
      };
      const result = await resolver.resolveAndIngest(out, 'sig_anchor_stale', scope, {
        anchorIds: [STALE_ID],
      });

      // The validating pre-pass logs a clearly-labeled unresolved entry.
      expect(
        result.unresolved.some(
          (u) =>
            u.where === 'options.anchorIds' &&
            u.reason.includes('not visible in caller scope'),
        ),
      ).toBe(true);
      // And because the id never enters knownAnchorIds, the fact's contextIds
      // ALSO drop it through the normal fact-contextIds reporting path.
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0]!.contextIds).toBeUndefined();
    });

    it('non-string anchor id input is rejected with a clear unresolved entry', async () => {
      const result = await resolver.resolveAndIngest(
        { mentions: { m1: { surface: 'X', type: 'person' } }, facts: [] },
        'sig_anchor_typed',
        scope,
        {
          // Cast through any to model a caller passing junk despite the types.
          anchorIds: [123, null, ''] as unknown as string[],
        },
      );
      const rejections = result.unresolved.filter((u) => u.where === 'options.anchorIds');
      // 123 and null get the "non-string" rejection; "" is falsy and also rejected.
      expect(rejections.length).toBeGreaterThanOrEqual(2);
      expect(rejections.every((r) => /non-string anchor id rejected/.test(r.reason))).toBe(true);
    });
  });
});
