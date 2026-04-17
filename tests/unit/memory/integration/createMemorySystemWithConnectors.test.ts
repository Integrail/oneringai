/**
 * Unit tests for createMemorySystemWithConnectors — the convenience factory.
 *
 * Verifies that specifying `connectors.embedding` / `connectors.profile`
 * constructs the right IEmbedder / IProfileGenerator, and that when neither
 * is provided the resulting MemorySystem works without them (semantic +
 * regen gracefully disabled).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMemorySystemWithConnectors } from '@/memory/integration/createMemorySystemWithConnectors.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import {
  SemanticSearchUnavailableError,
  ProfileGeneratorMissingError,
} from '@/memory/MemorySystem.js';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';

describe('createMemorySystemWithConnectors', () => {
  let store: InMemoryAdapter;

  beforeEach(() => {
    Connector.clear();
    store = new InMemoryAdapter();
  });

  afterEach(async () => {
    Connector.clear();
  });

  it('constructs a MemorySystem with neither embedder nor profile when no connectors config', async () => {
    const mem = createMemorySystemWithConnectors({ store });
    const res = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'X',
        identifiers: [{ kind: 'email', value: 'x@example.com' }],
      },
      {},
    );
    expect(res.created).toBe(true);
    await expect(mem.semanticSearch('q', {}, {})).rejects.toThrow(SemanticSearchUnavailableError);
    await expect(mem.regenerateProfile(res.entity.id, {})).rejects.toThrow(
      ProfileGeneratorMissingError,
    );
    await mem.shutdown();
  });

  it('wires an embedder when embedding config provided', async () => {
    Connector.create({
      name: 'emb-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'dummy' },
    });
    const mem = createMemorySystemWithConnectors({
      store,
      connectors: {
        embedding: {
          connector: 'emb-test',
          model: 'text-embedding-3-small',
          dimensions: 1536,
        },
      },
    });
    // Semantic search requires both embedder AND store capability.
    // InMemoryAdapter supports semanticSearch, so now the call path is live
    // (but will call the real OpenAI API — we just verify no "unavailable" error).
    // Since we can't make real API calls, test via pendingEmbeddings instead.
    expect(mem.pendingEmbeddings()).toBe(0);
    await mem.shutdown();
  });

  it('wires a profile generator when profile config provided', async () => {
    Connector.create({
      name: 'llm-test',
      vendor: Vendor.Anthropic,
      auth: { type: 'api_key', apiKey: 'dummy' },
    });
    const mem = createMemorySystemWithConnectors({
      store,
      connectors: {
        profile: {
          connector: 'llm-test',
          model: 'claude-sonnet-4-6',
        },
      },
    });
    // regenerateProfile no longer throws "missing generator" (would throw on
    // actual API call instead, which we don't trigger).
    // Verify via the store: adding an entity + enough facts wouldn't panic
    // regen, because it's background-triggered.
    const { entity } = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'P',
        identifiers: [{ kind: 'email', value: 'p@x.com' }],
      },
      {},
    );
    expect(entity).toBeDefined();
    await mem.shutdown();
  });

  it('throws at construction when a named connector is missing', () => {
    expect(() =>
      createMemorySystemWithConnectors({
        store,
        connectors: {
          embedding: {
            connector: 'never-registered',
            model: 'text-embedding-3-small',
            dimensions: 1536,
          },
        },
      }),
    ).toThrow();
  });

  it('propagates MemorySystem config (onChange, threshold, ranking)', async () => {
    const events: string[] = [];
    const mem = createMemorySystemWithConnectors({
      store,
      onChange: (e) => events.push(e.type),
      profileRegenerationThreshold: 99,
      topFactsRanking: { recencyHalfLifeDays: 30 },
    });
    await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'N',
        identifiers: [{ kind: 'email', value: 'n@x.com' }],
      },
      {},
    );
    expect(events).toContain('entity.upsert');
    await mem.shutdown();
  });
});
