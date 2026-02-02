/**
 * ToolResultEvictionPlugin Tests
 * Tests for automatic tool result eviction to memory
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ToolResultEvictionPlugin,
  ToolResultEvictionConfig,
  TrackedResult,
} from '@/core/context/plugins/ToolResultEvictionPlugin.js';
import { WorkingMemory } from '@/capabilities/taskAgent/WorkingMemory.js';
import { InMemoryStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import type { WorkingMemoryConfig } from '@/domain/entities/Memory.js';

describe('ToolResultEvictionPlugin', () => {
  let memory: WorkingMemory;
  let plugin: ToolResultEvictionPlugin;

  const defaultMemoryConfig: WorkingMemoryConfig = {
    maxSizeBytes: 100 * 1024, // 100KB for testing
    descriptionMaxLength: 150,
    softLimitPercent: 80,
    contextAllocationPercent: 20,
  };

  beforeEach(() => {
    const storage = new InMemoryStorage();
    memory = new WorkingMemory(storage, defaultMemoryConfig);
  });

  afterEach(() => {
    if (plugin) {
      plugin.destroy();
    }
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      plugin = new ToolResultEvictionPlugin(memory);
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('tool_result_eviction');
    });

    it('should create instance with custom config', () => {
      plugin = new ToolResultEvictionPlugin(memory, {
        maxFullResults: 10,
        maxAgeIterations: 5,
        minSizeToEvict: 500,
        maxTotalSizeBytes: 50 * 1024,
      });
      expect(plugin).toBeDefined();

      const config = plugin.getConfig();
      expect(config.maxFullResults).toBe(10);
      expect(config.maxAgeIterations).toBe(5);
      expect(config.minSizeToEvict).toBe(500);
      expect(config.maxTotalSizeBytes).toBe(50 * 1024);
    });

    it('should have correct priority', () => {
      plugin = new ToolResultEvictionPlugin(memory);
      expect(plugin.priority).toBe(8);
    });

    it('should be compactable', () => {
      plugin = new ToolResultEvictionPlugin(memory);
      expect(plugin.compactable).toBe(true);
    });

    it('should merge custom tool retention with defaults', () => {
      plugin = new ToolResultEvictionPlugin(memory, {
        toolRetention: { my_custom_tool: 15 },
      });

      const config = plugin.getConfig();
      expect(config.toolRetention.my_custom_tool).toBe(15);
      expect(config.toolRetention.read_file).toBe(10); // Default retained
    });
  });

  describe('onToolResult', () => {
    beforeEach(() => {
      plugin = new ToolResultEvictionPlugin(memory, { minSizeToEvict: 10 });
    });

    it('should track tool result', () => {
      plugin.onToolResult('call_123', 'read_file', {}, 'file content here', 0);

      expect(plugin.isTracked('call_123')).toBe(true);
      expect(plugin.getTracked().length).toBe(1);
    });

    it('should track result with correct metadata', () => {
      const result = { data: 'test data' };
      plugin.onToolResult('call_456', 'web_fetch', {}, result, 5);

      const tracked = plugin.getTrackedResult('call_456');
      expect(tracked).toBeDefined();
      expect(tracked?.toolUseId).toBe('call_456');
      expect(tracked?.toolName).toBe('web_fetch');
      expect(tracked?.result).toEqual(result);
      expect(tracked?.messageIndex).toBe(5);
      expect(tracked?.sizeBytes).toBeGreaterThan(0);
      expect(tracked?.addedAtIteration).toBe(0);
      expect(tracked?.timestamp).toBeGreaterThan(0);
    });

    it('should emit tracked event', () => {
      const onTracked = vi.fn();
      plugin.on('tracked', onTracked);

      plugin.onToolResult('call_123', 'bash', {}, 'output', 0);

      expect(onTracked).toHaveBeenCalledWith({
        toolUseId: 'call_123',
        toolName: 'bash',
        sizeBytes: expect.any(Number),
      });
    });

    it('should calculate size correctly for strings', () => {
      const content = 'x'.repeat(100);
      plugin.onToolResult('call_123', 'read_file', {}, content, 0);

      const tracked = plugin.getTrackedResult('call_123');
      expect(tracked?.sizeBytes).toBe(100);
    });

    it('should calculate size correctly for objects', () => {
      const content = { key: 'value', nested: { data: [1, 2, 3] } };
      plugin.onToolResult('call_123', 'web_fetch', {}, content, 0);

      const tracked = plugin.getTrackedResult('call_123');
      const expectedSize = Buffer.byteLength(JSON.stringify(content), 'utf8');
      expect(tracked?.sizeBytes).toBe(expectedSize);
    });

    it('should track multiple results', () => {
      plugin.onToolResult('call_1', 'tool1', {}, 'content1', 0);
      plugin.onToolResult('call_2', 'tool2', {}, 'content2', 1);
      plugin.onToolResult('call_3', 'tool3', {}, 'content3', 2);

      expect(plugin.getTracked().length).toBe(3);
    });
  });

  describe('onIteration', () => {
    beforeEach(() => {
      plugin = new ToolResultEvictionPlugin(memory);
    });

    it('should advance iteration counter', () => {
      expect(plugin.getCurrentIteration()).toBe(0);

      plugin.onIteration();
      expect(plugin.getCurrentIteration()).toBe(1);

      plugin.onIteration();
      expect(plugin.getCurrentIteration()).toBe(2);
    });

    it('should emit iteration event', () => {
      const onIteration = vi.fn();
      plugin.on('iteration', onIteration);

      plugin.onIteration();

      expect(onIteration).toHaveBeenCalledWith({ current: 1 });
    });
  });

  describe('shouldEvict', () => {
    beforeEach(() => {
      plugin = new ToolResultEvictionPlugin(memory, {
        maxFullResults: 3,
        maxAgeIterations: 2,
        minSizeToEvict: 10,
        maxTotalSizeBytes: 1000,
      });
    });

    it('should return false when no results tracked', () => {
      expect(plugin.shouldEvict()).toBe(false);
    });

    it('should return true when count exceeds maxFullResults', () => {
      plugin.onToolResult('call_1', 'tool', {}, 'x'.repeat(20), 0);
      plugin.onToolResult('call_2', 'tool', {}, 'x'.repeat(20), 1);
      plugin.onToolResult('call_3', 'tool', {}, 'x'.repeat(20), 2);
      plugin.onToolResult('call_4', 'tool', {}, 'x'.repeat(20), 3);

      expect(plugin.shouldEvict()).toBe(true);
    });

    it('should return true when total size exceeds maxTotalSizeBytes', () => {
      plugin.onToolResult('call_1', 'tool', {}, 'x'.repeat(600), 0);
      plugin.onToolResult('call_2', 'tool', {}, 'x'.repeat(600), 1);

      expect(plugin.shouldEvict()).toBe(true);
    });

    it('should return true when result age exceeds maxAgeIterations', () => {
      plugin.onToolResult('call_1', 'tool', {}, 'x'.repeat(20), 0);

      plugin.onIteration(); // iteration 1
      plugin.onIteration(); // iteration 2

      expect(plugin.shouldEvict()).toBe(true);
    });

    it('should respect per-tool retention', () => {
      plugin = new ToolResultEvictionPlugin(memory, {
        maxAgeIterations: 2,
        minSizeToEvict: 10,
        toolRetention: { long_retention_tool: 10 },
      });

      plugin.onToolResult('call_1', 'long_retention_tool', {}, 'x'.repeat(20), 0);

      plugin.onIteration(); // iteration 1
      plugin.onIteration(); // iteration 2

      // Should NOT evict because tool retention is 10
      expect(plugin.shouldEvict()).toBe(false);

      // Advance more iterations
      for (let i = 0; i < 8; i++) {
        plugin.onIteration();
      }

      // Now should evict (age = 10)
      expect(plugin.shouldEvict()).toBe(true);
    });

    it('should ignore results below minSizeToEvict for age-based eviction', () => {
      plugin = new ToolResultEvictionPlugin(memory, {
        maxAgeIterations: 2,
        minSizeToEvict: 100,
      });

      plugin.onToolResult('call_1', 'tool', {}, 'small', 0); // Small result

      plugin.onIteration();
      plugin.onIteration();
      plugin.onIteration();

      // Should NOT trigger age-based eviction for small results
      expect(plugin.shouldEvict()).toBe(false);
    });
  });

  describe('evictOldResults', () => {
    let removeCallback: ReturnType<typeof vi.fn>;
    // Use content larger than default minSizeToEvict (1024 bytes)
    const largeContent = 'x'.repeat(2000);

    beforeEach(() => {
      removeCallback = vi.fn().mockReturnValue(50); // Returns tokens freed
      plugin = new ToolResultEvictionPlugin(memory, {
        maxFullResults: 2,
        maxAgeIterations: 2,
        minSizeToEvict: 100, // Explicitly set lower threshold
      });
      plugin.setRemoveCallback(removeCallback);
    });

    it('should not evict when no eviction needed', async () => {
      plugin.onToolResult('call_1', 'tool', {}, largeContent, 0);

      const result = await plugin.evictOldResults();

      expect(result.evicted).toBe(0);
      expect(result.tokensFreed).toBe(0);
    });

    it('should correctly report shouldEvict when count exceeded', () => {
      plugin.onToolResult('call_1', 'tool', {}, largeContent, 0);
      expect(plugin.shouldEvict()).toBe(false); // 1 <= 2

      plugin.onToolResult('call_2', 'tool', {}, largeContent, 1);
      expect(plugin.shouldEvict()).toBe(false); // 2 <= 2

      plugin.onToolResult('call_3', 'tool', {}, largeContent, 2);
      expect(plugin.shouldEvict()).toBe(true); // 3 > 2
    });

    it('should evict oldest results when count exceeded', async () => {
      plugin.onToolResult('call_1', 'tool', {}, largeContent, 0);
      plugin.onToolResult('call_2', 'tool', {}, largeContent, 1);
      plugin.onToolResult('call_3', 'tool', {}, largeContent, 2);

      // Verify preconditions
      expect(plugin.getTracked().length).toBe(3);
      expect(plugin.shouldEvict()).toBe(true);

      const result = await plugin.evictOldResults();

      expect(result.evicted).toBe(1);
      expect(removeCallback).toHaveBeenCalledWith('call_1');
      expect(plugin.getTracked().length).toBe(2);
    });

    it('should store evicted results in memory', async () => {
      const fileContent = { content: 'x'.repeat(2000) }; // Large object
      plugin.onToolResult('call_1', 'read_file', {}, fileContent, 0);
      plugin.onToolResult('call_2', 'tool', {}, largeContent, 1);
      plugin.onToolResult('call_3', 'tool', {}, largeContent, 2);

      const result = await plugin.evictOldResults();

      expect(result.memoryKeys.length).toBe(1);
      expect(result.memoryKeys[0]).toBe('tool_result.read_file.call_1');

      // Verify stored in memory (storeRaw adds 'raw.' prefix)
      const retrieved = await memory.retrieve('raw.tool_result.read_file.call_1');
      expect(retrieved).toEqual(fileContent);
    });

    it('should emit evicted event', async () => {
      const onEvicted = vi.fn();
      plugin.on('evicted', onEvicted);

      plugin.onToolResult('call_1', 'tool', {}, largeContent, 0);
      plugin.onToolResult('call_2', 'tool', {}, largeContent, 1);
      plugin.onToolResult('call_3', 'tool', {}, largeContent, 2);

      await plugin.evictOldResults();

      expect(onEvicted).toHaveBeenCalledWith({
        count: 1,
        tokensFreed: 50,
        keys: ['tool_result.tool.call_1'],
      });
    });

    it('should evict stale results based on age', async () => {
      plugin.onToolResult('call_1', 'tool', {}, largeContent, 0);

      plugin.onIteration();
      plugin.onIteration();

      const result = await plugin.evictOldResults();

      expect(result.evicted).toBe(1);
      expect(plugin.isTracked('call_1')).toBe(false);
    });

    it('should not evict without removeCallback', async () => {
      plugin = new ToolResultEvictionPlugin(memory, {
        maxFullResults: 2,
        minSizeToEvict: 100,
      });
      // No setRemoveCallback called

      plugin.onToolResult('call_1', 'tool', {}, largeContent, 0);
      plugin.onToolResult('call_2', 'tool', {}, largeContent, 1);
      plugin.onToolResult('call_3', 'tool', {}, largeContent, 2);

      const result = await plugin.evictOldResults();

      expect(result.evicted).toBe(0);
      expect(result.log).toContain('Cannot evict: removeToolPairCallback not set');
    });

    it('should update stats after eviction', async () => {
      plugin.onToolResult('call_1', 'tool', {}, largeContent, 0);
      plugin.onToolResult('call_2', 'tool', {}, largeContent, 1);
      plugin.onToolResult('call_3', 'tool', {}, largeContent, 2);

      await plugin.evictOldResults();

      const stats = plugin.getStats();
      expect(stats.totalEvicted).toBe(1);
      expect(stats.totalTokensFreed).toBe(50);
    });

    it('should use custom keyPrefix', async () => {
      plugin = new ToolResultEvictionPlugin(memory, {
        maxFullResults: 2,
        minSizeToEvict: 100,
        keyPrefix: 'custom_prefix',
      });
      plugin.setRemoveCallback(removeCallback);

      plugin.onToolResult('call_1', 'tool', {}, largeContent, 0);
      plugin.onToolResult('call_2', 'tool', {}, largeContent, 1);
      plugin.onToolResult('call_3', 'tool', {}, largeContent, 2);

      const result = await plugin.evictOldResults();

      expect(result.memoryKeys[0]).toBe('custom_prefix.tool.call_1');
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      plugin = new ToolResultEvictionPlugin(memory, { minSizeToEvict: 10 });
    });

    it('should return correct initial stats', () => {
      const stats = plugin.getStats();

      expect(stats.count).toBe(0);
      expect(stats.totalSizeBytes).toBe(0);
      expect(stats.oldestAge).toBe(0);
      expect(stats.currentIteration).toBe(0);
      expect(stats.totalEvicted).toBe(0);
      expect(stats.totalTokensFreed).toBe(0);
    });

    it('should track count and size', () => {
      plugin.onToolResult('call_1', 'tool', {}, 'x'.repeat(50), 0);
      plugin.onToolResult('call_2', 'tool', {}, 'x'.repeat(30), 1);

      const stats = plugin.getStats();

      expect(stats.count).toBe(2);
      expect(stats.totalSizeBytes).toBe(80);
    });

    it('should calculate oldest age correctly', () => {
      plugin.onToolResult('call_1', 'tool', {}, 'x'.repeat(20), 0);
      plugin.onIteration();
      plugin.onToolResult('call_2', 'tool', {}, 'x'.repeat(20), 1);
      plugin.onIteration();
      plugin.onIteration();

      const stats = plugin.getStats();

      // call_1 added at iteration 0, current is 3, age = 3
      expect(stats.oldestAge).toBe(3);
    });
  });

  describe('updateMessageIndices', () => {
    beforeEach(() => {
      plugin = new ToolResultEvictionPlugin(memory, { minSizeToEvict: 10 });
    });

    it('should update indices when messages before tracked are removed', () => {
      plugin.onToolResult('call_1', 'tool', {}, 'x'.repeat(20), 5);
      plugin.onToolResult('call_2', 'tool', {}, 'x'.repeat(20), 10);

      // Remove messages at indices 0, 1, 2
      plugin.updateMessageIndices(new Set([0, 1, 2]));

      const tracked1 = plugin.getTrackedResult('call_1');
      const tracked2 = plugin.getTrackedResult('call_2');

      expect(tracked1?.messageIndex).toBe(2); // 5 - 3 = 2
      expect(tracked2?.messageIndex).toBe(7); // 10 - 3 = 7
    });

    it('should remove tracked result when its message is removed', () => {
      plugin.onToolResult('call_1', 'tool', {}, 'x'.repeat(20), 5);
      plugin.onToolResult('call_2', 'tool', {}, 'x'.repeat(20), 10);

      // Remove message at index 5 (call_1's result)
      plugin.updateMessageIndices(new Set([5]));

      expect(plugin.isTracked('call_1')).toBe(false);
      expect(plugin.isTracked('call_2')).toBe(true);
    });

    it('should update total tracked size when result is removed', () => {
      plugin.onToolResult('call_1', 'tool', {}, 'x'.repeat(50), 5);
      plugin.onToolResult('call_2', 'tool', {}, 'x'.repeat(30), 10);

      const statsBefore = plugin.getStats();
      expect(statsBefore.totalSizeBytes).toBe(80);

      plugin.updateMessageIndices(new Set([5]));

      const statsAfter = plugin.getStats();
      expect(statsAfter.totalSizeBytes).toBe(30);
    });
  });

  describe('getComponent', () => {
    const largeContent = 'x'.repeat(2000);

    beforeEach(() => {
      plugin = new ToolResultEvictionPlugin(memory, { minSizeToEvict: 100 });
    });

    it('should return null when no results tracked and none evicted', async () => {
      const component = await plugin.getComponent();
      expect(component).toBeNull();
    });

    it('should return component when results are tracked', async () => {
      plugin.onToolResult('call_1', 'tool', {}, largeContent, 0);

      const component = await plugin.getComponent();

      expect(component).not.toBeNull();
      expect(component?.name).toBe('tool_result_eviction');
      expect(component?.content).toContain('1 tracked');
    });

    it('should include eviction stats in component', async () => {
      const removeCallback = vi.fn().mockReturnValue(50);
      plugin = new ToolResultEvictionPlugin(memory, {
        maxFullResults: 2,
        minSizeToEvict: 100,
      });
      plugin.setRemoveCallback(removeCallback);

      plugin.onToolResult('call_1', 'tool', {}, largeContent, 0);
      plugin.onToolResult('call_2', 'tool', {}, largeContent, 1);
      plugin.onToolResult('call_3', 'tool', {}, largeContent, 2);

      await plugin.evictOldResults();

      const component = await plugin.getComponent();
      expect(component?.content).toContain('2 tracked');
      expect(component?.content).toContain('1 evicted');
    });
  });

  describe('compact', () => {
    let removeCallback: ReturnType<typeof vi.fn>;
    const largeContent = 'x'.repeat(2000);

    beforeEach(() => {
      removeCallback = vi.fn().mockReturnValue(50);
      plugin = new ToolResultEvictionPlugin(memory, {
        maxFullResults: 2,
        minSizeToEvict: 100,
      });
      plugin.setRemoveCallback(removeCallback);
    });

    it('should perform eviction during compaction', async () => {
      plugin.onToolResult('call_1', 'tool', {}, largeContent, 0);
      plugin.onToolResult('call_2', 'tool', {}, largeContent, 1);
      plugin.onToolResult('call_3', 'tool', {}, largeContent, 2);

      const mockEstimator = { estimateTokens: (s: string) => s.length / 4 };
      const tokensSaved = await plugin.compact(1000, mockEstimator);

      expect(tokensSaved).toBe(50);
    });
  });

  describe('getState/restoreState', () => {
    beforeEach(() => {
      plugin = new ToolResultEvictionPlugin(memory, { minSizeToEvict: 10 });
    });

    it('should serialize state correctly', () => {
      plugin.onToolResult('call_1', 'tool', {}, 'x'.repeat(20), 0);
      plugin.onIteration();
      plugin.onIteration();

      const state = plugin.getState();

      expect(state.tracked).toHaveLength(1);
      expect(state.tracked[0].toolUseId).toBe('call_1');
      expect(state.currentIteration).toBe(2);
    });

    it('should restore state correctly', () => {
      plugin.onToolResult('call_1', 'tool1', {}, 'content1', 0);
      plugin.onToolResult('call_2', 'tool2', {}, 'content2', 1);
      plugin.onIteration();
      plugin.onIteration();

      const state = plugin.getState();

      // Create new plugin and restore
      const newPlugin = new ToolResultEvictionPlugin(memory, { minSizeToEvict: 10 });
      newPlugin.restoreState(state);

      expect(newPlugin.getTracked().length).toBe(2);
      expect(newPlugin.getCurrentIteration()).toBe(2);
      expect(newPlugin.isTracked('call_1')).toBe(true);
      expect(newPlugin.isTracked('call_2')).toBe(true);
    });

    it('should restore total tracked size', () => {
      plugin.onToolResult('call_1', 'tool', {}, 'x'.repeat(50), 0);
      plugin.onToolResult('call_2', 'tool', {}, 'x'.repeat(30), 1);

      const state = plugin.getState();

      const newPlugin = new ToolResultEvictionPlugin(memory, { minSizeToEvict: 10 });
      newPlugin.restoreState(state);

      expect(newPlugin.getStats().totalSizeBytes).toBe(80);
    });

    it('should handle empty state', () => {
      const newPlugin = new ToolResultEvictionPlugin(memory, { minSizeToEvict: 10 });
      expect(() => newPlugin.restoreState({})).not.toThrow();
      expect(() => newPlugin.restoreState(null)).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should clear all state', () => {
      plugin = new ToolResultEvictionPlugin(memory, { minSizeToEvict: 10 });
      plugin.onToolResult('call_1', 'tool', {}, 'x'.repeat(20), 0);
      plugin.onIteration();

      plugin.destroy();

      expect(plugin.getTracked().length).toBe(0);
      expect(plugin.getStats().totalSizeBytes).toBe(0);
    });

    it('should remove all event listeners', () => {
      plugin = new ToolResultEvictionPlugin(memory, { minSizeToEvict: 10 });
      const listener = vi.fn();
      plugin.on('tracked', listener);

      plugin.destroy();

      // After destroy, adding a result should not call the listener
      plugin.onToolResult('call_1', 'tool', {}, 'x'.repeat(20), 0);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('eviction priority', () => {
    let removeCallback: ReturnType<typeof vi.fn>;
    const largeContent = 'x'.repeat(2000);

    beforeEach(() => {
      removeCallback = vi.fn().mockReturnValue(50);
      plugin = new ToolResultEvictionPlugin(memory, {
        maxFullResults: 2,
        minSizeToEvict: 100,
      });
      plugin.setRemoveCallback(removeCallback);
    });

    it('should evict oldest results first', async () => {
      plugin.onToolResult('call_oldest', 'tool', {}, largeContent, 0);
      await new Promise((resolve) => setTimeout(resolve, 10));
      plugin.onToolResult('call_middle', 'tool', {}, largeContent, 1);
      await new Promise((resolve) => setTimeout(resolve, 10));
      plugin.onToolResult('call_newest', 'tool', {}, largeContent, 2);

      await plugin.evictOldResults();

      expect(removeCallback).toHaveBeenCalledWith('call_oldest');
      expect(plugin.isTracked('call_oldest')).toBe(false);
      expect(plugin.isTracked('call_middle')).toBe(true);
      expect(plugin.isTracked('call_newest')).toBe(true);
    });

    it('should evict larger results first when same age', async () => {
      // All added at same iteration - sizes exceed minSizeToEvict
      // With same addedAtIteration, larger results should be evicted first
      plugin.onToolResult('call_small', 'tool', {}, 'x'.repeat(500), 0);
      plugin.onToolResult('call_large', 'tool', {}, 'x'.repeat(2000), 1);
      plugin.onToolResult('call_medium', 'tool', {}, 'x'.repeat(1000), 2);

      await plugin.evictOldResults();

      // Larger results evicted first when same age
      expect(plugin.isTracked('call_large')).toBe(false);
      expect(plugin.isTracked('call_small')).toBe(true);
      expect(plugin.isTracked('call_medium')).toBe(true);
    });
  });

  describe('integration with WorkingMemory', () => {
    let removeCallback: ReturnType<typeof vi.fn>;
    const largeContent = 'x'.repeat(2000);

    beforeEach(() => {
      removeCallback = vi.fn().mockReturnValue(50);
      plugin = new ToolResultEvictionPlugin(memory, {
        maxFullResults: 2,
        minSizeToEvict: 100,
      });
      plugin.setRemoveCallback(removeCallback);
    });

    it('should store complex objects in memory', async () => {
      // Make the complex result large enough to be evictable
      const complexResult = {
        status: 'success',
        data: {
          items: Array.from({ length: 50 }, (_, i) => ({
            id: i,
            name: `Item ${i}`,
            description: 'A'.repeat(50),
          })),
          metadata: {
            total: 50,
            page: 1,
          },
        },
      };

      plugin.onToolResult('call_1', 'api_call', {}, complexResult, 0);
      plugin.onToolResult('call_2', 'tool', {}, largeContent, 1);
      plugin.onToolResult('call_3', 'tool', {}, largeContent, 2);

      await plugin.evictOldResults();

      // storeRaw adds 'raw.' prefix
      const retrieved = await memory.retrieve('raw.tool_result.api_call.call_1');
      expect(retrieved).toEqual(complexResult);
    });

    it('should handle memory errors gracefully', async () => {
      // Create a memory that will fail on store
      const failingMemory = {
        ...memory,
        storeRaw: vi.fn().mockRejectedValue(new Error('Storage failed')),
      } as unknown as WorkingMemory;

      plugin = new ToolResultEvictionPlugin(failingMemory, {
        maxFullResults: 2,
        minSizeToEvict: 100,
      });
      plugin.setRemoveCallback(removeCallback);

      plugin.onToolResult('call_1', 'tool', {}, largeContent, 0);
      plugin.onToolResult('call_2', 'tool', {}, largeContent, 1);
      plugin.onToolResult('call_3', 'tool', {}, largeContent, 2);

      const result = await plugin.evictOldResults();

      // Should log error but not throw
      expect(result.log.some((l) => l.includes('Failed to evict'))).toBe(true);
    });
  });
});
