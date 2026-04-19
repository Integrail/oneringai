/**
 * SignalIngestor.contextHints — auto-inject open tasks + recent topics into
 * the extraction prompt.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import { SignalIngestor } from '@/memory/integration/signals/SignalIngestor.js';
import { PlainTextAdapter } from '@/memory/integration/signals/adapters/PlainTextAdapter.js';
import type { IExtractor } from '@/memory/integration/signals/types.js';
import type { ExtractionOutput } from '@/memory/integration/ExtractionResolver.js';
import type { ScopeFilter } from '@/memory/types.js';

const scope: ScopeFilter = { userId: 'user-hints' };

function makeExtractor(): IExtractor & { lastPrompt: string | null } {
  const empty: ExtractionOutput = { mentions: {}, facts: [] };
  const obj = {
    lastPrompt: null as string | null,
    async extract(prompt: string): Promise<ExtractionOutput> {
      obj.lastPrompt = prompt;
      return empty;
    },
  };
  return obj;
}

describe('SignalIngestor.contextHints', () => {
  let mem: MemorySystem;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  async function seedOpenTask(name: string, state: string, extra: Record<string, unknown> = {}) {
    await mem.upsertEntity(
      {
        type: 'task',
        displayName: name,
        identifiers: [{ kind: 'canonical', value: `task:${name.toLowerCase().replace(/\s+/g, '-')}` }],
        metadata: { state, ...extra },
      },
      scope,
    );
  }

  async function seedTopic(name: string) {
    await mem.upsertEntity(
      { type: 'topic', displayName: name, identifiers: [] },
      scope,
    );
  }

  it('flag off: no context hints rendered in the prompt', async () => {
    await seedOpenTask('Hidden task', 'in_progress');
    const extractor = makeExtractor();
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor,
      adapters: [new PlainTextAdapter()],
    });
    await ingestor.ingest({
      kind: 'text',
      raw: { text: 'hello' },
      sourceSignalId: 's1',
      scope,
    });
    expect(extractor.lastPrompt).not.toContain('Hidden task');
  });

  it('openTasks: true → library fetches + renders open tasks in prompt', async () => {
    await seedOpenTask('Send Q3 budget', 'in_progress', { dueAt: '2026-04-30' });
    const extractor = makeExtractor();
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor,
      adapters: [new PlainTextAdapter()],
      contextHints: { openTasks: true },
    });
    await ingestor.ingest({
      kind: 'text',
      raw: { text: 'hello' },
      sourceSignalId: 's1',
      scope,
    });
    expect(extractor.lastPrompt).toContain('Send Q3 budget');
    expect(extractor.lastPrompt).toContain('state: in_progress');
    expect(extractor.lastPrompt).toContain('due: 2026-04-30');
  });

  it('openTasks only surfaces tasks in active states', async () => {
    await seedOpenTask('Active one', 'in_progress');
    await seedOpenTask('Done one', 'done');
    const extractor = makeExtractor();
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor,
      adapters: [new PlainTextAdapter()],
      contextHints: { openTasks: true },
    });
    await ingestor.ingest({
      kind: 'text',
      raw: { text: 'hello' },
      sourceSignalId: 's1',
      scope,
    });
    expect(extractor.lastPrompt).toContain('Active one');
    expect(extractor.lastPrompt).not.toContain('Done one');
  });

  it('recentTopics: true → fetches + renders recent topics', async () => {
    await seedTopic('ERP Renewal');
    await seedTopic('Q3 Strategy');
    const extractor = makeExtractor();
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor,
      adapters: [new PlainTextAdapter()],
      contextHints: { recentTopics: true },
    });
    await ingestor.ingest({
      kind: 'text',
      raw: { text: 'hello' },
      sourceSignalId: 's1',
      scope,
    });
    expect(extractor.lastPrompt).toContain('ERP Renewal');
    expect(extractor.lastPrompt).toContain('Q3 Strategy');
  });

  it('caller-supplied knownEntities appear before library-fetched hints', async () => {
    await seedOpenTask('Library-fetched', 'in_progress');
    const caller = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Caller-supplied Alice',
        identifiers: [{ kind: 'email', value: 'alice@x.com' }],
      },
      scope,
    );
    const extractor = makeExtractor();
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor,
      adapters: [new PlainTextAdapter()],
      contextHints: { openTasks: true },
    });
    await ingestor.ingest({
      kind: 'text',
      raw: { text: 'hi' },
      sourceSignalId: 's1',
      scope,
      knownEntities: [caller.entity],
    });
    const prompt = extractor.lastPrompt!;
    const callerIdx = prompt.indexOf('Caller-supplied Alice');
    const libIdx = prompt.indexOf('Library-fetched');
    expect(callerIdx).toBeGreaterThan(-1);
    expect(libIdx).toBeGreaterThan(-1);
    expect(callerIdx).toBeLessThan(libIdx);
  });

  it('dedupes by entity id — a task already supplied by caller is not re-added', async () => {
    const task = await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Shared task',
        identifiers: [{ kind: 'canonical', value: 'task:shared' }],
        metadata: { state: 'in_progress' },
      },
      scope,
    );
    const extractor = makeExtractor();
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor,
      adapters: [new PlainTextAdapter()],
      contextHints: { openTasks: true },
    });
    await ingestor.ingest({
      kind: 'text',
      raw: { text: 'hi' },
      sourceSignalId: 's1',
      scope,
      knownEntities: [task.entity],
    });
    const prompt = extractor.lastPrompt!;
    const occurrences = prompt.split('Shared task').length - 1;
    expect(occurrences).toBe(1);
  });

  it('openTasks with custom limit is honored', async () => {
    for (let i = 0; i < 5; i++) {
      await seedOpenTask(`task-${i}`, 'pending');
    }
    const extractor = makeExtractor();
    const ingestor = new SignalIngestor({
      memory: mem,
      extractor,
      adapters: [new PlainTextAdapter()],
      contextHints: { openTasks: { limit: 2 } },
    });
    await ingestor.ingest({
      kind: 'text',
      raw: { text: 'hi' },
      sourceSignalId: 's1',
      scope,
    });
    const prompt = extractor.lastPrompt!;
    // Each rendered task appears twice: once as `"task-X"` (displayName) and
    // once inside the canonical identifier (`canonical=task:task-X`). Count
    // the quoted displayNames to get unique task count.
    const count = prompt.match(/"task-\d"/g)?.length ?? 0;
    expect(count).toBe(2);
  });
});
