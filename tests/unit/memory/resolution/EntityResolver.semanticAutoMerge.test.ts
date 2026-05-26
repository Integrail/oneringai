/**
 * PR v0.9.1 — semantic auto-resolve at creation.
 *
 * Calibrated against production cosine data (see CHANGELOG):
 * within-cluster median 0.89-1.00, cross-cluster max 0.86. Default cap
 * raised 0.89 → 0.95 for non-person types so cosine actually clears the
 * 0.90 auto-resolve threshold. Persons stay at 0.89 (advisory only).
 *
 * Covers: event emission, config knobs, default ON behavior, raw cosine
 * surfacing for audit logs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { ChangeEvent, ScopeFilter } from '@/memory/types.js';

const scope: ScopeFilter = { userId: 'v091-test-user' };

function buildKeyedEmbedder(map: Record<string, number[]>, dims = 4) {
  const zero = Array.from({ length: dims }, () => 0);
  return {
    dimensions: dims,
    embed: async (text: string): Promise<number[]> => {
      const key = text.toLowerCase();
      if (map[key]) return [...map[key]];
      for (const k of Object.keys(map)) {
        if (key.includes(k)) return [...map[k]];
      }
      return [...zero];
    },
  };
}

describe('v0.9.1 — semantic auto-resolve at creation', () => {
  describe('default behavior', () => {
    it('enableSemanticResolution is ON by default in 0.9.1', async () => {
      // No explicit `entityResolution` config — the new default should
      // make Tier 4 fire. Note: normalizeSurface strips Corp/Inc/LLC/Company
      // suffixes — use names without those for predictable test embedder lookup.
      const embedder = buildKeyedEmbedder({
        'acme solutions': [1, 0, 0, 0],
        'akme solutions': [0.99, 0.01, 0, 0],
      });
      const store = new InMemoryAdapter();
      const mem = new MemorySystem({ store, embedder });

      await mem.upsertEntity(
        { type: 'organization', displayName: 'Acme Solutions', identifiers: [] },
        scope,
      );
      await mem.flushEmbeddings();

      const candidates = await mem.resolveEntity(
        { surface: 'Akme Solutions', type: 'organization' },
        scope,
      );
      expect(candidates.length).toBe(1);
      expect(candidates[0]!.matchedOn).toBe('embedding');
      await mem.shutdown();
    });
  });

  describe('emit entity.upsert.semantic_automerge event', () => {
    it('fires when Tier 4 drives an auto-resolve', async () => {
      const events: ChangeEvent[] = [];
      const embedder = buildKeyedEmbedder({
        'foo industries': [1, 0, 0, 0],
        'fooo industries': [0.99, 0.01, 0, 0],
      });
      const store = new InMemoryAdapter();
      const mem = new MemorySystem({ store, embedder, onChange: (e) => events.push(e) });

      const seeded = await mem.upsertEntity(
        { type: 'organization', displayName: 'Foo Industries', identifiers: [] },
        scope,
      );
      await mem.flushEmbeddings();

      const result = await mem.upsertEntityBySurface(
        { surface: 'Fooo Industries', type: 'organization' },
        scope,
      );
      expect(result.resolved).toBe(true);
      expect(result.entity.id).toBe(seeded.entity.id);

      const semanticEvents = events.filter((e) => e.type === 'entity.upsert.semantic_automerge');
      expect(semanticEvents.length).toBe(1);
      const ev = semanticEvents[0] as Extract<
        ChangeEvent,
        { type: 'entity.upsert.semantic_automerge' }
      >;
      expect(ev.entityId).toBe(seeded.entity.id);
      expect(ev.mergedSurface).toBe('Fooo Industries');
      expect(ev.cosine).toBeGreaterThan(0.95);
      await mem.shutdown();
    });

    it('does NOT fire for Tier 1/2/3 resolves', async () => {
      const events: ChangeEvent[] = [];
      const embedder = buildKeyedEmbedder({
        'foo industries': [1, 0, 0, 0],
      });
      const store = new InMemoryAdapter();
      const mem = new MemorySystem({ store, embedder, onChange: (e) => events.push(e) });

      await mem.upsertEntity(
        {
          type: 'organization',
          displayName: 'Foo Industries',
          identifiers: [{ kind: 'domain', value: 'foo.com' }],
        },
        scope,
      );
      await mem.flushEmbeddings();

      // Identifier hit — Tier 1, NOT Tier 4.
      await mem.upsertEntityBySurface(
        {
          surface: 'whatever',
          type: 'organization',
          identifiers: [{ kind: 'domain', value: 'foo.com' }],
        },
        scope,
      );

      const semanticEvents = events.filter((e) => e.type === 'entity.upsert.semantic_automerge');
      expect(semanticEvents.length).toBe(0);
      await mem.shutdown();
    });
  });

  describe('configurable knobs', () => {
    it('semanticConfidenceCap can be overridden', async () => {
      // With cap lowered to 0.85, even a 0.99 cosine produces confidence
      // 0.85 — below 0.90 auto-resolve threshold → no auto-merge.
      const embedder = buildKeyedEmbedder({
        bar: [1, 0, 0, 0],
        baar: [0.99, 0.01, 0, 0],
      });
      const store = new InMemoryAdapter();
      const mem = new MemorySystem({
        store,
        embedder,
        entityResolution: { semanticConfidenceCap: 0.85 },
      });

      const seeded = await mem.upsertEntity(
        { type: 'organization', displayName: 'Bar Org Holdings', identifiers: [] },
        scope,
      );
      await mem.flushEmbeddings();

      const result = await mem.upsertEntityBySurface(
        { surface: 'Baar Org Holdings', type: 'organization' },
        scope,
      );
      expect(result.resolved).toBe(false);
      expect(result.entity.id).not.toBe(seeded.entity.id);
      await mem.shutdown();
    });

    it('semanticAutoResolveTypes — caller can include type=person to opt person back in', async () => {
      // Reverses the default — semantic auto-resolve fires for persons.
      // Use multi-token to bypass the single-token-no-identifier rule.
      const embedder = buildKeyedEmbedder({
        'pavel khasanov': [1, 0, 0, 0],
        'pavel khasanof': [0.99, 0.01, 0, 0],
      });
      const store = new InMemoryAdapter();
      const mem = new MemorySystem({
        store,
        embedder,
        entityResolution: {
          semanticAutoResolveTypes: ['person', 'organization', 'project', 'event', 'topic', 'task'],
        },
      });

      const seeded = await mem.upsertEntity(
        { type: 'person', displayName: 'Pavel Khasanov', identifiers: [] },
        scope,
      );
      await mem.flushEmbeddings();

      const result = await mem.upsertEntityBySurface(
        { surface: 'Pavel Khasanof', type: 'person' },
        scope,
      );
      expect(result.resolved).toBe(true);
      expect(result.entity.id).toBe(seeded.entity.id);
      expect(result.matchedOn).toBe('embedding');
      await mem.shutdown();
    });

    it('semanticAutoResolveTypes empty array disables auto-resolve for ALL types', async () => {
      const embedder = buildKeyedEmbedder({
        'qux holdings': [1, 0, 0, 0],
        'qooks holdings': [0.99, 0.01, 0, 0],
      });
      const store = new InMemoryAdapter();
      const mem = new MemorySystem({
        store,
        embedder,
        entityResolution: { semanticAutoResolveTypes: [] },
      });

      const seeded = await mem.upsertEntity(
        { type: 'organization', displayName: 'Qux Holdings', identifiers: [] },
        scope,
      );
      await mem.flushEmbeddings();

      const result = await mem.upsertEntityBySurface(
        { surface: 'Qooks Holdings', type: 'organization' },
        scope,
      );
      // Empty list → org now uses advisory cap (0.89) → below 0.90 threshold.
      expect(result.resolved).toBe(false);
      // But the semantic candidate is still in mergeCandidates.
      expect(result.mergeCandidates.some((c) => c.matchedOn === 'embedding')).toBe(true);
      await mem.shutdown();
    });
  });

  describe('raw cosine surfacing for audit logs', () => {
    it('rawSemanticScore exposes the un-capped cosine on the candidate', async () => {
      const embedder = buildKeyedEmbedder({
        'widget solutions': [1, 0, 0, 0],
        'widjit solutions': [0.992, 0.01, 0, 0],
      });
      const store = new InMemoryAdapter();
      const mem = new MemorySystem({ store, embedder });

      await mem.upsertEntity(
        { type: 'organization', displayName: 'Widget Solutions', identifiers: [] },
        scope,
      );
      await mem.flushEmbeddings();

      const candidates = await mem.resolveEntity(
        { surface: 'Widjit Solutions', type: 'organization' },
        scope,
      );
      expect(candidates[0]!.matchedOn).toBe('embedding');
      // capped at 0.95 for orgs
      expect(candidates[0]!.confidence).toBe(0.95);
      // raw is preserved
      expect(candidates[0]!.rawSemanticScore).toBeGreaterThan(0.95);
      expect(candidates[0]!.rawSemanticScore).toBeLessThan(1.0);
      await mem.shutdown();
    });

    it('rawSemanticScore + matchedOn surface on UpsertBySurfaceResult after auto-merge', async () => {
      const embedder = buildKeyedEmbedder({
        'zap holdings': [1, 0, 0, 0],
        'zapp holdings': [0.99, 0.01, 0, 0],
      });
      const store = new InMemoryAdapter();
      const mem = new MemorySystem({ store, embedder });

      const seeded = await mem.upsertEntity(
        { type: 'organization', displayName: 'Zap Holdings', identifiers: [] },
        scope,
      );
      await mem.flushEmbeddings();

      const result = await mem.upsertEntityBySurface(
        { surface: 'Zapp Holdings', type: 'organization' },
        scope,
      );
      expect(result.resolved).toBe(true);
      expect(result.entity.id).toBe(seeded.entity.id);
      expect(result.matchedOn).toBe('embedding');
      expect(result.rawSemanticScore).toBeGreaterThan(0.95);
      await mem.shutdown();
    });
  });

  describe('tier priority — semantic never overrides exact match on the same entity', () => {
    it('Tier 2 displayName equality wins over Tier 4 even when cap > displayName confidence', async () => {
      const embedder = buildKeyedEmbedder({
        'microsoft corp': [1, 0, 0, 0],
      });
      const store = new InMemoryAdapter();
      const mem = new MemorySystem({ store, embedder });

      await mem.upsertEntity(
        { type: 'organization', displayName: 'Microsoft Corp', identifiers: [] },
        scope,
      );
      await mem.flushEmbeddings();

      // Exact surface match — Tier 2 should fire.
      const candidates = await mem.resolveEntity(
        { surface: 'Microsoft Corp', type: 'organization' },
        scope,
      );
      expect(candidates[0]!.matchedOn).toBe('displayName');
      expect(candidates[0]!.confidence).toBe(0.9);
      // The same entity also has a Tier 4 hit (capped at 0.95) — but tier
      // priority means displayName wins, not the higher numeric confidence.
      await mem.shutdown();
    });
  });
});
