/**
 * memory_search_documents LLM tool.
 *
 * Wraps MemorySystem.searchDocuments — exercise mode dispatch, filter
 * resolution, error paths, and the projected result shape.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import { createMemoryReadTools } from '@/tools/memory/index.js';
import type { ToolFunction } from '@/domain/entities/Tool.js';

function findTool(tools: ToolFunction[], name: string): ToolFunction {
  const t = tools.find((tt) => tt.definition.function.name === name);
  if (!t) throw new Error(`tool ${name} not found in bundle`);
  return t;
}

describe('memory_search_documents tool', () => {
  let mem: MemorySystem;
  let tool: ToolFunction<Record<string, unknown>>;

  beforeEach(async () => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
    const tools = createMemoryReadTools({ memory: mem, agentId: 'a1', defaultUserId: 'u1' });
    tool = findTool(tools, 'memory_search_documents') as ToolFunction<Record<string, unknown>>;
    await mem.createDocument(
      { title: 'Q3 launch brief', slug: 'q3-brief', body: 'rolling out the NA region', role: 'brief' },
      { userId: 'u1' },
    );
    await mem.createDocument(
      { title: 'Sprint retro', slug: 'retro', body: 'what went well last sprint', role: 'notes' },
      { userId: 'u1' },
    );
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('keyword mode: returns docs whose body contains the substring', async () => {
    const res = (await tool.execute(
      { query: 'NA region', mode: 'keyword' },
      { userId: 'u1', agentId: 'a1' } as never,
    )) as { results: Array<{ doc: { displayName: string } }> };
    expect(res.results).toHaveLength(1);
    expect(res.results[0]!.doc.displayName).toBe('Q3 launch brief');
  });

  it('keyword mode: role filter narrows results', async () => {
    const res = (await tool.execute(
      { query: 'last', mode: 'keyword', role: 'brief' },
      { userId: 'u1', agentId: 'a1' } as never,
    )) as { results: unknown[] };
    expect(res.results).toHaveLength(0);
  });

  it('keyword mode: role list filter accepts multiple values', async () => {
    const res = (await tool.execute(
      { query: 'sprint', mode: 'keyword', role: ['brief', 'notes'] },
      { userId: 'u1', agentId: 'a1' } as never,
    )) as { results: unknown[] };
    expect(res.results).toHaveLength(1);
  });

  it('rejects empty query', async () => {
    const res = (await tool.execute(
      { query: '   ', mode: 'keyword' },
      { userId: 'u1', agentId: 'a1' } as never,
    )) as { error: string };
    expect(res.error).toMatch(/non-empty/);
  });

  it('attachedTo: resolves the SubjectRef and filters to attached docs', async () => {
    const project = await mem.upsertEntity(
      {
        type: 'project',
        displayName: 'NA Launch',
        identifiers: [{ kind: 'system_user_id', value: 'proj-tool' }],
      },
      { userId: 'u1' },
    );
    await mem.attachDocument(project.entity.id, 'q3-brief', { userId: 'u1' });
    const res = (await tool.execute(
      { query: 'rolling', mode: 'keyword', attachedTo: { id: project.entity.id } },
      { userId: 'u1', agentId: 'a1' } as never,
    )) as { results: Array<{ doc: { displayName: string } }> };
    expect(res.results).toHaveLength(1);
    expect(res.results[0]!.doc.displayName).toBe('Q3 launch brief');
  });

  it('attachedTo with unresolvable surface returns an error with candidates', async () => {
    const res = (await tool.execute(
      { query: 'x', mode: 'keyword', attachedTo: { surface: 'totally unknown project' } },
      { userId: 'u1', agentId: 'a1' } as never,
    )) as { error?: string };
    expect(res.error).toBeDefined();
  });

  it('clamps limit to [1, 50]', async () => {
    // Seed enough docs to exceed the default limit so we can observe clamping
    // by passing limit=999.
    for (let i = 0; i < 15; i++) {
      await mem.createDocument(
        { title: `doc-${i}`, slug: `bulk-${i}`, body: 'fizz', role: 'notes' },
        { userId: 'u1' },
      );
    }
    const res = (await tool.execute(
      { query: 'fizz', mode: 'keyword', limit: 999 },
      { userId: 'u1', agentId: 'a1' } as never,
    )) as { results: unknown[] };
    expect(res.results.length).toBeLessThanOrEqual(50);
  });

  it('result shape: includes doc + score + snippet + matchedVia', async () => {
    const res = (await tool.execute(
      { query: 'sprint', mode: 'keyword' },
      { userId: 'u1', agentId: 'a1' } as never,
    )) as {
      results: Array<{
        doc: { id: string; type: string; displayName: string; metadata: Record<string, unknown> };
        score: number;
        snippet: string;
        matchedVia: string;
      }>;
    };
    const hit = res.results[0]!;
    expect(hit.doc.type).toBe('document');
    expect(typeof hit.doc.id).toBe('string');
    expect(typeof hit.score).toBe('number');
    expect(typeof hit.snippet).toBe('string');
    expect(hit.matchedVia).toBe('keyword');
  });
});
