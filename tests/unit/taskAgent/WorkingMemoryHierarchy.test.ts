/**
 * WorkingMemory Hierarchy Tests
 * Tests for hierarchical memory tiers: raw → summary → findings
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkingMemory } from '@/capabilities/taskAgent/WorkingMemory.js';
import { IMemoryStorage } from '@/domain/interfaces/IMemoryStorage.js';
import { InMemoryStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import { TIER_PRIORITIES, getTierFromKey, addTierPrefix, stripTierPrefix } from '@/domain/entities/Memory.js';
import type { WorkingMemoryConfig } from '@/domain/entities/Memory.js';

describe('WorkingMemory Hierarchy', () => {
  let storage: IMemoryStorage;
  let memory: WorkingMemory;

  const defaultConfig: WorkingMemoryConfig = {
    maxSizeBytes: 50 * 1024, // 50KB for testing
    descriptionMaxLength: 150,
    softLimitPercent: 80,
    contextAllocationPercent: 20,
  };

  beforeEach(() => {
    storage = new InMemoryStorage();
    memory = new WorkingMemory(storage, defaultConfig);
  });

  describe('TIER_PRIORITIES', () => {
    it('should have correct priority mappings', () => {
      expect(TIER_PRIORITIES.raw).toBe('low');
      expect(TIER_PRIORITIES.summary).toBe('normal');
      expect(TIER_PRIORITIES.findings).toBe('high');
    });
  });

  describe('getTierFromKey', () => {
    it('should extract raw tier from key', () => {
      expect(getTierFromKey('raw.search_results')).toBe('raw');
    });

    it('should extract summary tier from key', () => {
      expect(getTierFromKey('summary.ai_trends')).toBe('summary');
    });

    it('should extract findings tier from key', () => {
      expect(getTierFromKey('findings.main_conclusion')).toBe('findings');
    });

    it('should return undefined for non-tiered key', () => {
      expect(getTierFromKey('user.profile')).toBeUndefined();
    });

    it('should return undefined for empty key', () => {
      expect(getTierFromKey('')).toBeUndefined();
    });
  });

  describe('addTierPrefix', () => {
    it('should add raw prefix', () => {
      expect(addTierPrefix('search_results', 'raw')).toBe('raw.search_results');
    });

    it('should add summary prefix', () => {
      expect(addTierPrefix('ai_trends', 'summary')).toBe('summary.ai_trends');
    });

    it('should add findings prefix', () => {
      expect(addTierPrefix('conclusion', 'findings')).toBe('findings.conclusion');
    });

    it('should not double-prefix already prefixed key', () => {
      expect(addTierPrefix('raw.data', 'raw')).toBe('raw.data');
    });
  });

  describe('stripTierPrefix', () => {
    it('should strip raw prefix', () => {
      expect(stripTierPrefix('raw.search_results')).toBe('search_results');
    });

    it('should strip summary prefix', () => {
      expect(stripTierPrefix('summary.ai_trends')).toBe('ai_trends');
    });

    it('should strip findings prefix', () => {
      expect(stripTierPrefix('findings.conclusion')).toBe('conclusion');
    });

    it('should return unchanged for non-tiered key', () => {
      expect(stripTierPrefix('user.profile')).toBe('user.profile');
    });
  });

  describe('storeRaw', () => {
    it('should store with raw prefix and low priority', async () => {
      await memory.storeRaw('search_results', 'Raw search data', { results: ['a', 'b'] });

      const value = await memory.retrieve('raw.search_results');
      expect(value).toEqual({ results: ['a', 'b'] });

      const entry = await storage.get('raw.search_results');
      expect(entry?.basePriority).toBe('low');
      // Tier is inferred from key prefix, not stored in metadata
      expect(getTierFromKey(entry!.key)).toBe('raw');
    });

    it('should allow task-scoped raw data', async () => {
      await memory.storeRaw('temp_data', 'Temporary', { temp: true }, { taskIds: ['task-1'] });

      const entry = await storage.get('raw.temp_data');
      expect(entry?.scope).toEqual({ type: 'task', taskIds: ['task-1'] });
    });

    it('should emit stored event with tier info', async () => {
      const onStored = vi.fn();
      memory.on('stored', onStored);

      await memory.storeRaw('data', 'Data', { v: 1 });

      expect(onStored).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'raw.data',
        })
      );
    });
  });

  describe('storeSummary', () => {
    it('should store with summary prefix and normal priority', async () => {
      await memory.storeRaw('search_1', 'Search 1', { data: 'raw1' });
      await memory.storeSummary('ai_trends', 'Summary of AI trends', { summary: 'AI is growing' }, ['raw.search_1']);

      const value = await memory.retrieve('summary.ai_trends');
      expect(value).toEqual({ summary: 'AI is growing' });

      const entry = await storage.get('summary.ai_trends');
      expect(entry?.basePriority).toBe('normal');
      // Tier is inferred from key prefix
      expect(getTierFromKey(entry!.key)).toBe('summary');
    });

    it('should accept single derivedFrom key (string)', async () => {
      await memory.storeRaw('source', 'Source', { data: 1 });
      // Note: derivedFrom is accepted but not stored in metadata in current implementation
      // It could be used for tracking data lineage in future enhancements
      await memory.storeSummary('result', 'Result', { v: 1 }, 'raw.source');

      const value = await memory.retrieve('summary.result');
      expect(value).toEqual({ v: 1 });

      const entry = await storage.get('summary.result');
      expect(entry?.basePriority).toBe('normal');
    });

    it('should accept multiple derivedFrom keys (array)', async () => {
      await memory.storeRaw('source1', 'Source 1', { data: 1 });
      await memory.storeRaw('source2', 'Source 2', { data: 2 });
      await memory.storeSummary('combined', 'Combined', { v: 1 }, ['raw.source1', 'raw.source2']);

      const value = await memory.retrieve('summary.combined');
      expect(value).toEqual({ v: 1 });

      const entry = await storage.get('summary.combined');
      expect(entry?.basePriority).toBe('normal');
    });
  });

  describe('storeFindings', () => {
    it('should store with findings prefix and high priority', async () => {
      await memory.storeFindings('main_conclusion', 'Main research conclusion', { finding: 'AI will transform industries' });

      const value = await memory.retrieve('findings.main_conclusion');
      expect(value).toEqual({ finding: 'AI will transform industries' });

      const entry = await storage.get('findings.main_conclusion');
      expect(entry?.basePriority).toBe('high');
      // Tier is inferred from key prefix
      expect(getTierFromKey(entry!.key)).toBe('findings');
    });

    it('should default to plan scope', async () => {
      await memory.storeFindings('conclusion', 'Conclusion', { v: 1 });

      const entry = await storage.get('findings.conclusion');
      expect(entry?.scope).toEqual({ type: 'plan' });
    });

    it('should allow pinning findings', async () => {
      await memory.storeFindings('critical', 'Critical finding', { v: 1 }, undefined, { pinned: true });

      const entry = await storage.get('findings.critical');
      expect(entry?.pinned).toBe(true);
    });

    it('should store findings even when derivedFrom is provided', async () => {
      // Note: current implementation doesn't store derivedFrom in metadata
      // but the parameter is available for future use
      await memory.storeSummary('sum1', 'Summary 1', { v: 1 }, []);
      await memory.storeFindings('conclusion', 'Conclusion', { v: 1 }, 'summary.sum1');

      // Verify findings was stored correctly
      const value = await memory.retrieve('findings.conclusion');
      expect(value).toEqual({ v: 1 });

      const entry = await storage.get('findings.conclusion');
      expect(entry?.basePriority).toBe('high');
    });
  });

  describe('cleanupRawData', () => {
    it('should delete raw tier entries from derivedFrom list', async () => {
      await memory.storeRaw('source1', 'Source 1', { data: 1 });
      await memory.storeRaw('source2', 'Source 2', { data: 2 });

      // Verify they exist
      expect(await memory.has('raw.source1')).toBe(true);
      expect(await memory.has('raw.source2')).toBe(true);

      // Cleanup
      await memory.cleanupRawData(['raw.source1', 'raw.source2']);

      // Verify deleted
      expect(await memory.has('raw.source1')).toBe(false);
      expect(await memory.has('raw.source2')).toBe(false);
    });

    it('should not delete non-raw tier entries', async () => {
      await memory.storeSummary('sum', 'Summary', { v: 1 }, []);
      await memory.storeFindings('finding', 'Finding', { v: 1 });

      await memory.cleanupRawData(['summary.sum', 'findings.finding']);

      // Should still exist (not raw tier)
      expect(await memory.has('summary.sum')).toBe(true);
      expect(await memory.has('findings.finding')).toBe(true);
    });

    it('should return count of deleted entries', async () => {
      await memory.storeRaw('a', 'A', 1);
      await memory.storeRaw('b', 'B', 2);
      await memory.storeSummary('c', 'C', 3, []);

      const deleted = await memory.cleanupRawData(['raw.a', 'raw.b', 'summary.c']);

      expect(deleted).toBe(2);
    });

    it('should handle non-existent keys gracefully', async () => {
      const deleted = await memory.cleanupRawData(['raw.nonexistent1', 'raw.nonexistent2']);
      expect(deleted).toBe(0);
    });
  });

  describe('getByTier', () => {
    beforeEach(async () => {
      await memory.storeRaw('r1', 'Raw 1', { v: 1 });
      await memory.storeRaw('r2', 'Raw 2', { v: 2 });
      await memory.storeSummary('s1', 'Summary 1', { v: 3 }, []);
      await memory.storeFindings('f1', 'Finding 1', { v: 4 });
      await memory.store('user.data', 'User data', { v: 5 }); // Non-tiered
    });

    it('should return only raw tier entries', async () => {
      const rawEntries = await memory.getByTier('raw');

      expect(rawEntries).toHaveLength(2);
      expect(rawEntries.map((e) => e.key)).toContain('raw.r1');
      expect(rawEntries.map((e) => e.key)).toContain('raw.r2');
    });

    it('should return only summary tier entries', async () => {
      const summaryEntries = await memory.getByTier('summary');

      expect(summaryEntries).toHaveLength(1);
      expect(summaryEntries[0].key).toBe('summary.s1');
    });

    it('should return only findings tier entries', async () => {
      const findingsEntries = await memory.getByTier('findings');

      expect(findingsEntries).toHaveLength(1);
      expect(findingsEntries[0].key).toBe('findings.f1');
    });

    it('should return empty array for empty tier', async () => {
      const mem = new WorkingMemory(new InMemoryStorage(), defaultConfig);
      const entries = await mem.getByTier('raw');

      expect(entries).toHaveLength(0);
    });
  });

  describe('promote', () => {
    it('should promote raw to summary tier by creating new key', async () => {
      await memory.storeRaw('data', 'Data', { v: 1 });

      const newKey = await memory.promote('raw.data', 'summary');

      // Old key should be deleted
      expect(await memory.has('raw.data')).toBe(false);

      // New key should exist with updated tier prefix and priority
      expect(newKey).toBe('summary.data');
      expect(await memory.has('summary.data')).toBe(true);

      const entry = await storage.get('summary.data');
      expect(entry?.basePriority).toBe('normal');
    });

    it('should promote summary to findings tier', async () => {
      await memory.storeSummary('result', 'Result', { v: 1 }, []);

      const newKey = await memory.promote('summary.result', 'findings');

      // Old key should be deleted
      expect(await memory.has('summary.result')).toBe(false);

      // New key should exist
      expect(newKey).toBe('findings.result');
      expect(await memory.has('findings.result')).toBe(true);

      const entry = await storage.get('findings.result');
      expect(entry?.basePriority).toBe('high');
    });

    it('should throw for non-existent key', async () => {
      await expect(memory.promote('nonexistent', 'findings')).rejects.toThrow('not found');
    });

    it('should return same key if already in target tier', async () => {
      await memory.storeFindings('data', 'Data', { v: 1 });

      const result = await memory.promote('findings.data', 'findings');

      expect(result).toBe('findings.data');
      expect(await memory.has('findings.data')).toBe(true);
    });
  });

  describe('getTierStats', () => {
    beforeEach(async () => {
      await memory.storeRaw('r1', 'Raw 1', { data: 'x'.repeat(100) });
      await memory.storeRaw('r2', 'Raw 2', { data: 'y'.repeat(200) });
      await memory.storeSummary('s1', 'Summary 1', { data: 'z'.repeat(50) }, []);
      await memory.storeFindings('f1', 'Finding 1', { data: 'w'.repeat(30) });
    });

    it('should return count and size by tier', async () => {
      const stats = await memory.getTierStats();

      expect(stats.raw.count).toBe(2);
      expect(stats.raw.sizeBytes).toBeGreaterThan(0);

      expect(stats.summary.count).toBe(1);
      expect(stats.summary.sizeBytes).toBeGreaterThan(0);

      expect(stats.findings.count).toBe(1);
      expect(stats.findings.sizeBytes).toBeGreaterThan(0);
    });

    it('should return zero for empty tiers', async () => {
      const mem = new WorkingMemory(new InMemoryStorage(), defaultConfig);
      const stats = await mem.getTierStats();

      expect(stats.raw.count).toBe(0);
      expect(stats.raw.sizeBytes).toBe(0);
      expect(stats.summary.count).toBe(0);
      expect(stats.findings.count).toBe(0);
    });
  });

  describe('Eviction behavior with tiers', () => {
    it('should evict raw tier before summary tier', async () => {
      // Store raw and summary data
      await memory.storeRaw('raw_data', 'Raw data', { v: 1 });
      await new Promise((r) => setTimeout(r, 10));
      await memory.storeSummary('summary_data', 'Summary', { v: 2 }, []);

      // Evict one entry
      const evicted = await memory.evictLRU(1);

      // Should evict raw (lower priority) even if both are LRU candidates
      expect(evicted).toContain('raw.raw_data');
      expect(await memory.has('summary.summary_data')).toBe(true);
    });

    it('should evict summary tier before findings tier', async () => {
      await memory.storeSummary('sum', 'Summary', { v: 1 }, []);
      await new Promise((r) => setTimeout(r, 10));
      await memory.storeFindings('find', 'Finding', { v: 2 });

      const evicted = await memory.evictLRU(1);

      expect(evicted).toContain('summary.sum');
      expect(await memory.has('findings.find')).toBe(true);
    });
  });

  describe('Research workflow integration', () => {
    it('should support full research workflow: raw → summary → findings → cleanup', async () => {
      // Step 1: Store raw search results
      await memory.storeRaw('search.google', 'Google search results', { results: ['result1', 'result2'] });
      await memory.storeRaw('search.bing', 'Bing search results', { results: ['result3'] });

      // Step 2: Create summary from raw data
      await memory.storeSummary(
        'ai_research',
        'Summary of AI research findings',
        { keyPoints: ['point1', 'point2'] },
        ['raw.search.google', 'raw.search.bing']
      );

      // Step 3: Create findings from summary
      await memory.storeFindings(
        'main_conclusion',
        'Main research conclusion',
        { conclusion: 'AI is transforming industries' },
        'summary.ai_research'
      );

      // Step 4: Cleanup raw data
      const deleted = await memory.cleanupRawData(['raw.search.google', 'raw.search.bing']);

      // Verify state
      expect(deleted).toBe(2);
      expect(await memory.has('raw.search.google')).toBe(false);
      expect(await memory.has('raw.search.bing')).toBe(false);
      expect(await memory.has('summary.ai_research')).toBe(true);
      expect(await memory.has('findings.main_conclusion')).toBe(true);

      // Verify tier stats
      const stats = await memory.getTierStats();
      expect(stats.raw.count).toBe(0);
      expect(stats.summary.count).toBe(1);
      expect(stats.findings.count).toBe(1);
    });
  });
});
