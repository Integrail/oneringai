/**
 * InMemoryAdapter — semanticSearchEntities embeddingField flag.
 *
 * The adapter must strictly select the requested embedding (identity vs
 * content) — never silently fall back to the other field. This is the
 * security contract documented in IMemoryStore.semanticSearchEntities.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { NewEntity, ScopeFilter } from '@/memory/types.js';

const scope: ScopeFilter = { userId: 'u1' };

/** Build a NewEntity (adapter assigns id/version/createdAt/updatedAt). */
function entity(partial: Partial<NewEntity> & Pick<NewEntity, 'displayName'>): NewEntity {
  return {
    type: 'document',
    aliases: [],
    identifiers: [],
    ownerId: 'u1',
    ...partial,
  } as NewEntity;
}

describe('InMemoryAdapter semanticSearchEntities — embeddingField', () => {
  let adapter: InMemoryAdapter | undefined;

  afterEach(() => {
    adapter?.destroy();
    adapter = undefined;
  });

  it('defaults to identity embedding (backward-compat)', async () => {
    adapter = new InMemoryAdapter();
    await adapter.createEntity(
      entity({ displayName: 'Alice', identityEmbedding: [1, 0, 0, 0] }),
    );
    const hits = await adapter.semanticSearchEntities!(
      [1, 0, 0, 0],
      { type: 'document' },
      { topK: 5 },
      scope,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]!.entity.displayName).toBe('Alice');
  });

  it('embeddingField:"content" only matches contentEmbedding — never falls back to identity', async () => {
    adapter = new InMemoryAdapter();
    await adapter.createEntity(
      entity({
        displayName: 'identity-only',
        identityEmbedding: [1, 0, 0, 0],
        // no contentEmbedding
      }),
    );
    await adapter.createEntity(
      entity({
        displayName: 'content-only',
        contentEmbedding: [1, 0, 0, 0],
      }),
    );
    const hits = await adapter.semanticSearchEntities!(
      [1, 0, 0, 0],
      { type: 'document' },
      { topK: 5, embeddingField: 'content' },
      scope,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]!.entity.displayName).toBe('content-only');
  });

  it('embeddingField:"identity" only matches identityEmbedding — never falls back to content', async () => {
    adapter = new InMemoryAdapter();
    await adapter.createEntity(
      entity({
        displayName: 'identity-only',
        identityEmbedding: [1, 0, 0, 0],
      }),
    );
    await adapter.createEntity(
      entity({
        displayName: 'content-only',
        contentEmbedding: [1, 0, 0, 0],
      }),
    );
    const hits = await adapter.semanticSearchEntities!(
      [1, 0, 0, 0],
      { type: 'document' },
      { topK: 5, embeddingField: 'identity' },
      scope,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]!.entity.displayName).toBe('identity-only');
  });

  it('archived entities excluded regardless of embeddingField', async () => {
    adapter = new InMemoryAdapter();
    await adapter.createEntity(
      entity({
        displayName: 'archived doc',
        contentEmbedding: [1, 0, 0, 0],
        archived: true,
      }),
    );
    await adapter.createEntity(
      entity({ displayName: 'live doc', contentEmbedding: [1, 0, 0, 0] }),
    );
    const hits = await adapter.semanticSearchEntities!(
      [1, 0, 0, 0],
      { type: 'document' },
      { topK: 5, embeddingField: 'content' },
      scope,
    );
    expect(hits.map((h) => h.entity.displayName)).toEqual(['live doc']);
  });
});
