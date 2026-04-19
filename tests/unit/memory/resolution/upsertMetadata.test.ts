/**
 * upsertEntityBySurface with metadata — conservative-merge contract.
 *
 * Covers:
 *   - create: metadata set verbatim
 *   - resolve + fillMissing (default): existing keys untouched, missing keys set
 *   - resolve + overwrite: shallow-merge, incoming wins
 *   - ExtractionMention.metadata flows through
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import { ExtractionResolver } from '@/memory/integration/ExtractionResolver.js';
import type { ScopeFilter } from '@/memory/types.js';

const scope: ScopeFilter = { userId: 'test-user' };

describe('upsertEntityBySurface — metadata', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('create: metadata is set verbatim on the new entity', async () => {
    const res = await mem.upsertEntityBySurface(
      {
        surface: 'Send budget by Friday',
        type: 'task',
        identifiers: [{ kind: 'canonical', value: 'task:alice:budget' }],
        metadata: { state: 'proposed', dueAt: '2026-04-30', assigneeId: 'alice' },
      },
      scope,
    );
    expect(res.resolved).toBe(false);
    expect(res.entity.metadata).toEqual({
      state: 'proposed',
      dueAt: '2026-04-30',
      assigneeId: 'alice',
    });
  });

  it('resolve + fillMissing (default): existing keys untouched, missing keys set', async () => {
    const first = await mem.upsertEntityBySurface(
      {
        surface: 'Send budget',
        type: 'task',
        identifiers: [{ kind: 'canonical', value: 'task:alice:budget' }],
        metadata: { state: 'in_progress', dueAt: '2026-04-30' },
      },
      scope,
    );

    // Second upsert hits the canonical identifier → resolve path.
    const res = await mem.upsertEntityBySurface(
      {
        surface: 'Send the budget',
        type: 'task',
        identifiers: [{ kind: 'canonical', value: 'task:alice:budget' }],
        metadata: {
          state: 'done',          // SHOULD NOT overwrite — existing 'in_progress' wins
          priority: 'high',       // SHOULD be added — key was missing
        },
      },
      scope,
    );
    expect(res.resolved).toBe(true);
    expect(res.entity.id).toBe(first.entity.id);
    expect(res.entity.metadata).toEqual({
      state: 'in_progress',
      dueAt: '2026-04-30',
      priority: 'high',
    });
  });

  it('resolve + overwrite: shallow-merge with incoming winning', async () => {
    const first = await mem.upsertEntityBySurface(
      {
        surface: 'Send budget',
        type: 'task',
        identifiers: [{ kind: 'canonical', value: 'task:alice:budget' }],
        metadata: { state: 'in_progress', dueAt: '2026-04-30' },
      },
      scope,
    );

    const res = await mem.upsertEntityBySurface(
      {
        surface: 'Send budget',
        type: 'task',
        identifiers: [{ kind: 'canonical', value: 'task:alice:budget' }],
        metadata: { state: 'done', priority: 'high' },
      },
      scope,
      { metadataMerge: 'overwrite' },
    );
    expect(res.entity.id).toBe(first.entity.id);
    expect(res.entity.metadata).toEqual({
      state: 'done',
      dueAt: '2026-04-30',
      priority: 'high',
    });
  });

  it('resolve without metadata: existing metadata untouched, no version bump just for metadata', async () => {
    const first = await mem.upsertEntityBySurface(
      {
        surface: 'Task A',
        type: 'task',
        identifiers: [{ kind: 'canonical', value: 'task:a' }],
        metadata: { state: 'in_progress' },
      },
      scope,
    );
    const versionAfterCreate = first.entity.version;

    const res = await mem.upsertEntityBySurface(
      {
        surface: 'Task A',
        type: 'task',
        identifiers: [{ kind: 'canonical', value: 'task:a' }],
      },
      scope,
    );
    expect(res.entity.metadata).toEqual({ state: 'in_progress' });
    expect(res.entity.version).toBe(versionAfterCreate);
  });

  it('ExtractionMention.metadata flows through ExtractionResolver', async () => {
    const resolver = new ExtractionResolver(mem);
    const out = await resolver.resolveAndIngest(
      {
        mentions: {
          t1: {
            surface: 'Review Q3 plan',
            type: 'task',
            identifiers: [{ kind: 'canonical', value: 'task:review-q3-plan' }],
            metadata: { state: 'proposed', dueAt: '2026-05-01' },
          },
        },
        facts: [],
      },
      'signal-1',
      scope,
    );
    expect(out.entities).toHaveLength(1);
    expect(out.entities[0]!.entity.metadata).toEqual({
      state: 'proposed',
      dueAt: '2026-05-01',
    });
  });

  it('fillMissing drops undefined values without flipping dirty', async () => {
    const first = await mem.upsertEntityBySurface(
      {
        surface: 'Task B',
        type: 'task',
        identifiers: [{ kind: 'canonical', value: 'task:b' }],
        metadata: { state: 'pending' },
      },
      scope,
    );
    const vBefore = first.entity.version;
    const res = await mem.upsertEntityBySurface(
      {
        surface: 'Task B',
        type: 'task',
        identifiers: [{ kind: 'canonical', value: 'task:b' }],
        metadata: { state: undefined, priority: undefined },
      },
      scope,
    );
    expect(res.entity.version).toBe(vBefore);
    expect(res.entity.metadata).toEqual({ state: 'pending' });
  });
});
