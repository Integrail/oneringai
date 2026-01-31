/**
 * MemoryEviction Mock Tests
 *
 * Deterministic tests for memory eviction behavior:
 * - Eviction order: pinned never, critical never, low→normal→high
 * - LRU within same priority
 * - Eviction events and triggers
 * - Memory size limits
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkingMemory } from '@/capabilities/taskAgent/WorkingMemory.js';
import { InMemoryStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import { MEMORY_PRIORITY_VALUES } from '@/domain/entities/Memory.js';
import { createContextWithFeatures, FEATURE_PRESETS } from '../../helpers/contextTestHelpers.js';

// ============================================================================
// WorkingMemory Eviction Tests
// ============================================================================

describe('WorkingMemory Eviction', () => {
  let memory: WorkingMemory;
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    memory = new WorkingMemory(storage);
  });

  afterEach(() => {
    memory.destroy();
  });

  // ============================================================================
  // Priority-Based Eviction Order
  // ============================================================================

  describe('Priority-Based Eviction Order', () => {
    it('should NEVER evict pinned entries', async () => {
      await memory.store('pinned_entry', 'Pinned', { data: 'important' });
      await memory.store('normal_entry', 'Normal', { data: 'regular' });

      await memory.pin('pinned_entry');

      // Evict 1 entry
      const evicted = await memory.evict(1, 'lru');

      expect(evicted).toContain('normal_entry');
      expect(evicted).not.toContain('pinned_entry');
      expect(await memory.has('pinned_entry')).toBe(true);
    });

    it('should NEVER evict critical priority entries', async () => {
      // Store with tier that gives critical priority
      await memory.storeFindings('critical', 'Critical data', { data: 'vital' });
      await memory.store('normal', 'Normal data', { data: 'regular' });

      // Evict 1 entry
      const evicted = await memory.evict(1, 'lru');

      expect(evicted).toContain('normal');
      expect(evicted).not.toContain('findings.critical');
    });

    it('should evict LOW priority entries first', async () => {
      await memory.storeRaw('raw_data', 'Raw', { data: 'low' });
      await memory.store('normal_data', 'Normal', { data: 'normal' });
      await memory.storeSummary('summary_data', 'Summary', { data: 'high' });

      // Evict 1 entry
      const evicted = await memory.evict(1, 'lru');

      // Raw tier has lowest priority
      expect(evicted[0]).toContain('raw_data');
    });

    it('should evict NORMAL priority before HIGH', async () => {
      // Only normal and high priority entries (no low)
      await memory.store('normal_data', 'Normal', { data: 'normal' }, { tier: 'intermediate' });
      await memory.storeSummary('summary_data', 'Summary', { data: 'high' });

      // Evict 1 entry
      const evicted = await memory.evict(1, 'lru');

      // Intermediate (normal) should be evicted before summary (high)
      expect(evicted[0]).toContain('normal_data');
    });

    it('should evict entries in order: low → normal → high (never critical)', async () => {
      // Create entries at different priority levels
      await memory.storeRaw('raw1', 'Raw 1', 'r1');
      await memory.store('normal1', 'Normal 1', 'n1', { priority: 'normal' });
      await memory.storeSummary('sum1', 'Summary 1', 's1', 'raw.raw1');
      await memory.storeFindings('find1', 'Findings 1', 'f1');

      // Evict 3 entries (should not touch findings)
      const evicted = await memory.evict(3, 'lru');

      expect(evicted).toHaveLength(3);
      expect(evicted).toContain('raw.raw1');
      expect(evicted).toContain('normal1');
      expect(evicted).toContain('summary.sum1');
      expect(evicted).not.toContain('findings.find1');
    });
  });

  // ============================================================================
  // LRU Within Same Priority
  // ============================================================================

  describe('LRU Within Same Priority', () => {
    it('should evict oldest entry first when priorities are equal', async () => {
      // Store entries with same priority (all raw tier)
      await memory.storeRaw('old', 'Oldest', 'old_data');
      await new Promise(r => setTimeout(r, 10));
      await memory.storeRaw('mid', 'Middle', 'mid_data');
      await new Promise(r => setTimeout(r, 10));
      await memory.storeRaw('new', 'Newest', 'new_data');

      // Evict 1 entry
      const evicted = await memory.evict(1, 'lru');

      expect(evicted).toContain('raw.old');
    });

    it('should update LRU order on retrieve', async () => {
      await memory.storeRaw('first', 'First', 'f');
      await new Promise(r => setTimeout(r, 10));
      await memory.storeRaw('second', 'Second', 's');
      await new Promise(r => setTimeout(r, 10));

      // Access first entry to update its access time
      await memory.retrieve('raw.first');
      await new Promise(r => setTimeout(r, 10));

      // Now 'second' is the least recently accessed
      const evicted = await memory.evict(1, 'lru');

      expect(evicted).toContain('raw.second');
    });

    it('should respect LRU across multiple evictions', async () => {
      await memory.storeRaw('a', 'A', 'a');
      await new Promise(r => setTimeout(r, 5));
      await memory.storeRaw('b', 'B', 'b');
      await new Promise(r => setTimeout(r, 5));
      await memory.storeRaw('c', 'C', 'c');

      // Evict one at a time
      const evicted1 = await memory.evict(1, 'lru');
      const evicted2 = await memory.evict(1, 'lru');

      expect(evicted1).toContain('raw.a'); // Oldest
      expect(evicted2).toContain('raw.b'); // Next oldest
    });
  });

  // ============================================================================
  // Size-Based Eviction
  // ============================================================================

  describe('Size-Based Eviction', () => {
    it('should evict largest entries first when using size strategy', async () => {
      await memory.storeRaw('small', 'Small', 'x');
      await memory.storeRaw('large', 'Large', 'x'.repeat(1000));
      await memory.storeRaw('medium', 'Medium', 'x'.repeat(100));

      // Evict 1 entry using size strategy
      const evicted = await memory.evict(1, 'size');

      expect(evicted).toContain('raw.large');
    });

    it('should still respect priority when using size strategy', async () => {
      // High priority but large
      await memory.storeSummary('large_high', 'Large High', 'x'.repeat(1000));
      // Low priority but small
      await memory.storeRaw('small_low', 'Small Low', 'x');

      // Evict 1 entry
      const evicted = await memory.evict(1, 'size');

      // Should evict low priority even though high priority is larger
      expect(evicted).toContain('raw.small_low');
    });
  });

  // ============================================================================
  // Eviction Events
  // ============================================================================

  describe('Eviction Events', () => {
    it('should emit evicted event with keys and reason', async () => {
      const eventHandler = vi.fn();
      memory.on('evicted', eventHandler);

      await memory.store('entry1', 'Entry 1', 'v1');
      await memory.store('entry2', 'Entry 2', 'v2');

      await memory.evict(1, 'lru');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          keys: expect.any(Array),
          reason: 'lru',
        })
      );
    });

    it('should NOT emit event when no entries evicted', async () => {
      const eventHandler = vi.fn();
      memory.on('evicted', eventHandler);

      // Try to evict from empty memory
      await memory.evict(5, 'lru');

      expect(eventHandler).not.toHaveBeenCalled();
    });

    it('should emit event with size reason when using size strategy', async () => {
      const eventHandler = vi.fn();
      memory.on('evicted', eventHandler);

      await memory.store('entry', 'Entry', 'value');
      await memory.evict(1, 'size');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'size' })
      );
    });
  });

  // ============================================================================
  // Memory Size Limits
  // ============================================================================

  describe('Memory Size Limits', () => {
    it('should track total size', async () => {
      await memory.store('key1', 'Desc 1', { data: 'x'.repeat(100) });
      await memory.store('key2', 'Desc 2', { data: 'y'.repeat(100) });

      const stats = await memory.getStats();
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
    });

    it('should emit limit_warning when approaching limit', async () => {
      const smallMemory = new WorkingMemory(storage, {
        maxSizeBytes: 1000,
        softLimitPercent: 80,
      });

      const eventHandler = vi.fn();
      smallMemory.on('limit_warning', eventHandler);

      // Fill up to above soft limit
      await smallMemory.store('large', 'Large', { data: 'x'.repeat(900) });

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ utilizationPercent: expect.any(Number) })
      );

      smallMemory.destroy();
    });

    it('should calculate utilization percent correctly', async () => {
      const smallMemory = new WorkingMemory(storage, {
        maxSizeBytes: 1000,
      });

      // Store some data
      await smallMemory.store('data', 'Data', { content: 'x'.repeat(100) });

      const stats = await smallMemory.getStats();
      expect(stats.utilizationPercent).toBeGreaterThan(0);
      expect(stats.utilizationPercent).toBeLessThanOrEqual(100);

      smallMemory.destroy();
    });
  });

  // ============================================================================
  // Tier-Based Eviction (raw cleanup via delete)
  // ============================================================================

  describe('Tier-Based Eviction (Raw Cleanup)', () => {
    it('should delete raw tier entries selectively', async () => {
      await memory.storeRaw('raw1', 'Raw 1', 'r1');
      await memory.storeRaw('raw2', 'Raw 2', 'r2');
      await memory.storeSummary('sum1', 'Summary 1', 's1');
      await memory.storeFindings('find1', 'Findings 1', 'f1');

      // Delete raw entries manually (like cleanup tool would)
      await memory.delete('raw.raw1');
      await memory.delete('raw.raw2');

      // Non-raw entries should remain
      expect(await memory.has('raw.raw1')).toBe(false);
      expect(await memory.has('raw.raw2')).toBe(false);
      expect(await memory.has('summary.sum1')).toBe(true);
      expect(await memory.has('findings.find1')).toBe(true);
    });

    it('should allow deleting unpinned entries', async () => {
      await memory.storeRaw('pinned_raw', 'Pinned Raw', 'pr');
      await memory.pin('raw.pinned_raw');
      await memory.storeRaw('normal_raw', 'Normal Raw', 'nr');

      // Can still delete unpinned entry
      await memory.delete('raw.normal_raw');

      expect(await memory.has('raw.normal_raw')).toBe(false);
      expect(await memory.has('raw.pinned_raw')).toBe(true); // Pinned still exists
    });
  });

  // ============================================================================
  // Eviction Count Limits
  // ============================================================================

  describe('Eviction Count Limits', () => {
    it('should evict exactly the requested count', async () => {
      for (let i = 0; i < 10; i++) {
        await memory.store(`key_${i}`, `Desc ${i}`, `value_${i}`);
      }

      const evicted = await memory.evict(3, 'lru');

      expect(evicted).toHaveLength(3);
    });

    it('should not exceed available entries to evict', async () => {
      await memory.store('key1', 'Desc 1', 'v1');
      await memory.store('key2', 'Desc 2', 'v2');

      // Request more than available
      const evicted = await memory.evict(10, 'lru');

      expect(evicted).toHaveLength(2);
    });

    it('should handle evict count of 0', async () => {
      await memory.store('key1', 'Desc', 'value');

      const evicted = await memory.evict(0, 'lru');

      expect(evicted).toHaveLength(0);
      expect(await memory.has('key1')).toBe(true);
    });
  });
});

// ============================================================================
// AgentContext Memory Eviction Integration
// ============================================================================

describe('AgentContext Memory Eviction', () => {
  it('should have eviction functionality available via context.memory', async () => {
    const ctx = createContextWithFeatures(FEATURE_PRESETS.memoryOnly);

    expect(ctx.memory).not.toBeNull();
    expect(typeof ctx.memory!.evict).toBe('function');
    expect(typeof ctx.memory!.delete).toBe('function');

    ctx.destroy();
  });

  it('should trigger eviction via memory_cleanup_raw tool', async () => {
    const ctx = createContextWithFeatures(FEATURE_PRESETS.memoryOnly);

    // Store raw entries
    await ctx.memory!.storeRaw('raw1', 'Raw 1', 'data1');
    await ctx.memory!.storeRaw('raw2', 'Raw 2', 'data2');
    await ctx.memory!.storeSummary('sum1', 'Summary 1', 'summary');

    // Execute cleanup tool with specific keys
    const result = await ctx.tools.execute('memory_cleanup_raw', {
      keys: ['raw.raw1', 'raw.raw2'],
    });

    expect(result.deleted).toBe(2);
    expect(await ctx.memory!.has('summary.sum1')).toBe(true);

    ctx.destroy();
  });
});

// ============================================================================
// Priority Values Tests
// ============================================================================

describe('Priority Values', () => {
  it('should have correct priority ordering', () => {
    // Lower value = evicted first
    expect(MEMORY_PRIORITY_VALUES.low).toBeLessThan(MEMORY_PRIORITY_VALUES.normal);
    expect(MEMORY_PRIORITY_VALUES.normal).toBeLessThan(MEMORY_PRIORITY_VALUES.high);
    expect(MEMORY_PRIORITY_VALUES.high).toBeLessThan(MEMORY_PRIORITY_VALUES.critical);
  });

  it('should have expected values', () => {
    expect(MEMORY_PRIORITY_VALUES).toEqual({
      low: 1,
      normal: 2,
      high: 3,
      critical: 4,
    });
  });
});
