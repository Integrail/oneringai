/**
 * ContextPlugins Mock Tests
 *
 * Deterministic tests for all context plugins:
 * - InContextMemoryPlugin: set/get/delete, priority eviction, serialization
 * - PlanPlugin: component generation, non-compactable flag
 * - MemoryPlugin: index formatting, eviction metadata
 * - PersistentInstructionsPlugin: load/append/persist
 * - AutoSpillPlugin: threshold, patterns, cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InContextMemoryPlugin } from '@/core/context/plugins/InContextMemoryPlugin.js';
import { PlanPlugin } from '@/core/context/plugins/PlanPlugin.js';
import { MemoryPlugin } from '@/core/context/plugins/MemoryPlugin.js';
import { PersistentInstructionsPlugin } from '@/core/context/plugins/PersistentInstructionsPlugin.js';
import { AutoSpillPlugin } from '@/core/context/plugins/AutoSpillPlugin.js';
import { WorkingMemory } from '@/capabilities/taskAgent/WorkingMemory.js';
import { InMemoryStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import type { Plan } from '@/domain/entities/Task.js';
import type { IPersistentInstructionsStorage } from '@/domain/interfaces/IPersistentInstructionsStorage.js';
import { createMockEstimator } from '../../helpers/contextTestHelpers.js';

// ============================================================================
// InContextMemoryPlugin Tests
// ============================================================================

describe('InContextMemoryPlugin', () => {
  let plugin: InContextMemoryPlugin;

  beforeEach(() => {
    plugin = new InContextMemoryPlugin();
  });

  afterEach(() => {
    if (!plugin.isDestroyed) {
      plugin.destroy();
    }
  });

  describe('Properties', () => {
    it('should have name "in_context_memory"', () => {
      expect(plugin.name).toBe('in_context_memory');
    });

    it('should have priority 5 (medium)', () => {
      expect(plugin.priority).toBe(5);
    });

    it('should be compactable', () => {
      expect(plugin.compactable).toBe(true);
    });
  });

  describe('set/get/delete Operations', () => {
    it('should set and get values', () => {
      plugin.set('key1', 'Description', { value: 42 });
      expect(plugin.get('key1')).toEqual({ value: 42 });
    });

    it('should update existing values', () => {
      plugin.set('key1', 'Original', 'v1');
      plugin.set('key1', 'Updated', 'v2');
      expect(plugin.get('key1')).toBe('v2');
      expect(plugin.size).toBe(1);
    });

    it('should delete values', () => {
      plugin.set('key1', 'Description', 'value');
      expect(plugin.delete('key1')).toBe(true);
      expect(plugin.has('key1')).toBe(false);
    });

    it('should return false when deleting non-existent key', () => {
      expect(plugin.delete('nonexistent')).toBe(false);
    });

    it('should list all entries with metadata', () => {
      plugin.set('key1', 'Desc 1', 'v1', 'low');
      plugin.set('key2', 'Desc 2', 'v2', 'high');

      const entries = plugin.list();
      expect(entries).toHaveLength(2);
      expect(entries.find(e => e.key === 'key1')?.priority).toBe('low');
      expect(entries.find(e => e.key === 'key2')?.priority).toBe('high');
    });
  });

  describe('Priority-Based Eviction', () => {
    it('should evict low priority entries first when reaching maxEntries', () => {
      const limitedPlugin = new InContextMemoryPlugin({ maxEntries: 3 });

      limitedPlugin.set('high1', 'High', 'v1', 'high');
      limitedPlugin.set('low1', 'Low', 'v2', 'low');
      limitedPlugin.set('normal1', 'Normal', 'v3', 'normal');
      limitedPlugin.set('low2', 'Low 2', 'v4', 'low');

      expect(limitedPlugin.size).toBe(3);
      expect(limitedPlugin.has('low1')).toBe(false); // Evicted (lowest priority)
      expect(limitedPlugin.has('high1')).toBe(true);
      expect(limitedPlugin.has('normal1')).toBe(true);
      expect(limitedPlugin.has('low2')).toBe(true);

      limitedPlugin.destroy();
    });

    it('should never evict critical entries', () => {
      const limitedPlugin = new InContextMemoryPlugin({ maxEntries: 2 });

      limitedPlugin.set('critical1', 'Critical', 'v1', 'critical');
      limitedPlugin.set('critical2', 'Critical', 'v2', 'critical');
      limitedPlugin.set('normal', 'Normal', 'v3', 'normal');

      // Normal is evicted because criticals can't be evicted
      expect(limitedPlugin.has('critical1')).toBe(true);
      expect(limitedPlugin.has('critical2')).toBe(true);
      expect(limitedPlugin.has('normal')).toBe(false);

      limitedPlugin.destroy();
    });

    it('should evict older entries when priorities are equal', async () => {
      const limitedPlugin = new InContextMemoryPlugin({ maxEntries: 2 });

      limitedPlugin.set('old', 'Old', 'v1');
      await new Promise(r => setTimeout(r, 10));
      limitedPlugin.set('mid', 'Mid', 'v2');
      await new Promise(r => setTimeout(r, 10));
      limitedPlugin.set('new', 'New', 'v3');

      expect(limitedPlugin.size).toBe(2);
      expect(limitedPlugin.has('old')).toBe(false); // Oldest evicted
      expect(limitedPlugin.has('mid')).toBe(true);
      expect(limitedPlugin.has('new')).toBe(true);

      limitedPlugin.destroy();
    });
  });

  describe('Serialization', () => {
    it('should serialize state', () => {
      plugin.set('key1', 'Desc', 'value1', 'high');
      const state = plugin.getState();

      expect(state.entries).toHaveLength(1);
      expect(state.config).toBeDefined();
    });

    it('should restore state', () => {
      plugin.set('key1', 'Desc', 'value1');
      const state = plugin.getState();

      const newPlugin = new InContextMemoryPlugin();
      newPlugin.restoreState(state);

      expect(newPlugin.get('key1')).toBe('value1');
      expect(newPlugin.size).toBe(1);

      newPlugin.destroy();
    });

    it('should handle invalid state gracefully', () => {
      expect(() => plugin.restoreState(null)).not.toThrow();
      expect(() => plugin.restoreState(undefined)).not.toThrow();
      expect(() => plugin.restoreState('invalid')).not.toThrow();
    });
  });

  describe('Component Generation', () => {
    it('should return null when empty', async () => {
      const component = await plugin.getComponent();
      expect(component).toBeNull();
    });

    it('should return component when entries exist', async () => {
      plugin.set('state', 'Current state', { step: 1 });
      const component = await plugin.getComponent();

      expect(component).not.toBeNull();
      expect(component?.name).toBe('in_context_memory');
      expect(component?.content).toContain('## Live Context');
      expect(component?.content).toContain('state');
    });
  });
});

// ============================================================================
// PlanPlugin Tests
// ============================================================================

describe('PlanPlugin', () => {
  let plugin: PlanPlugin;

  const createTestPlan = (taskCount: number = 3): Plan => ({
    goal: 'Test goal',
    tasks: Array.from({ length: taskCount }, (_, i) => ({
      id: `task-${i}`,
      name: `task_${i}`,
      description: `Task ${i} description`,
      status: 'pending' as const,
    })),
  });

  beforeEach(() => {
    plugin = new PlanPlugin();
  });

  describe('Properties', () => {
    it('should have name "plan"', () => {
      expect(plugin.name).toBe('plan');
    });

    it('should have priority 1 (critical)', () => {
      expect(plugin.priority).toBe(1);
    });

    it('should NOT be compactable', () => {
      expect(plugin.compactable).toBe(false);
    });
  });

  describe('Plan Management', () => {
    it('should set and get plan', () => {
      const plan = createTestPlan();
      plugin.setPlan(plan);
      expect(plugin.getPlan()).toBe(plan);
    });

    it('should clear plan', () => {
      plugin.setPlan(createTestPlan());
      plugin.clearPlan();
      expect(plugin.getPlan()).toBeNull();
    });

    it('should update task status', () => {
      const plan = createTestPlan();
      plugin.setPlan(plan);
      plugin.updateTaskStatus('task_0', 'completed');

      expect(plugin.getTask('task_0')?.status).toBe('completed');
    });

    it('should get task by id or name', () => {
      const plan = createTestPlan();
      plugin.setPlan(plan);

      expect(plugin.getTask('task-0')).toBeDefined(); // By id
      expect(plugin.getTask('task_0')).toBeDefined(); // By name
    });

    it('should check if plan is complete', () => {
      const plan = createTestPlan(2);
      plugin.setPlan(plan);

      expect(plugin.isComplete()).toBe(false);

      plugin.updateTaskStatus('task_0', 'completed');
      plugin.updateTaskStatus('task_1', 'completed');

      expect(plugin.isComplete()).toBe(true);
    });

    it('should consider skipped tasks as complete', () => {
      const plan = createTestPlan(2);
      plugin.setPlan(plan);

      plugin.updateTaskStatus('task_0', 'completed');
      plugin.updateTaskStatus('task_1', 'skipped');

      expect(plugin.isComplete()).toBe(true);
    });
  });

  describe('Component Generation', () => {
    it('should return null when no plan', async () => {
      const component = await plugin.getComponent();
      expect(component).toBeNull();
    });

    it('should return component with plan content', async () => {
      plugin.setPlan(createTestPlan());
      const component = await plugin.getComponent();

      expect(component).not.toBeNull();
      expect(component?.name).toBe('plan');
      expect(component?.compactable).toBe(false);
      expect(component?.content).toContain('Test goal');
      expect(component?.content).toContain('task_0');
    });

    it('should include task count in metadata', async () => {
      plugin.setPlan(createTestPlan(5));
      const component = await plugin.getComponent();

      expect(component?.metadata?.taskCount).toBe(5);
      expect(component?.metadata?.completedCount).toBe(0);
    });

    it('should update completedCount as tasks complete', async () => {
      plugin.setPlan(createTestPlan(3));
      plugin.updateTaskStatus('task_0', 'completed');
      plugin.updateTaskStatus('task_1', 'completed');

      const component = await plugin.getComponent();
      expect(component?.metadata?.completedCount).toBe(2);
    });
  });

  describe('Serialization', () => {
    it('should serialize plan state', () => {
      const plan = createTestPlan();
      plugin.setPlan(plan);
      const state = plugin.getState();

      expect(state.plan).toBe(plan);
    });

    it('should restore plan state', () => {
      const plan = createTestPlan();
      plugin.setPlan(plan);
      const state = plugin.getState();

      const newPlugin = new PlanPlugin();
      newPlugin.restoreState(state);

      expect(newPlugin.getPlan()).toEqual(plan);
    });
  });
});

// ============================================================================
// MemoryPlugin Tests
// ============================================================================

describe('MemoryPlugin', () => {
  let plugin: MemoryPlugin;
  let memory: WorkingMemory;
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    memory = new WorkingMemory(storage);
    plugin = new MemoryPlugin(memory);
  });

  afterEach(() => {
    memory.destroy();
  });

  describe('Properties', () => {
    it('should have name "memory_index"', () => {
      expect(plugin.name).toBe('memory_index');
    });

    it('should have priority 8 (higher = more likely to compact)', () => {
      expect(plugin.priority).toBe(8);
    });

    it('should be compactable', () => {
      expect(plugin.compactable).toBe(true);
    });
  });

  describe('Component Generation', () => {
    it('should return null when memory is empty', async () => {
      const component = await plugin.getComponent();
      expect(component).toBeNull();
    });

    it('should return component when memory has entries', async () => {
      await memory.store('key1', 'Description 1', { value: 1 });
      const component = await plugin.getComponent();

      expect(component).not.toBeNull();
      expect(component?.name).toBe('memory_index');
      expect(component?.compactable).toBe(true);
    });

    it('should include memory stats in metadata', async () => {
      await memory.store('key1', 'Desc', { data: 'test' });
      const component = await plugin.getComponent();

      expect(component?.metadata?.entryCount).toBe(1);
      expect(component?.metadata?.totalSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('Compaction via Eviction', () => {
    it('should evict entries during compaction', async () => {
      // Fill memory
      for (let i = 0; i < 10; i++) {
        await memory.store(`key_${i}`, `Description ${i}`, { index: i });
      }

      const estimator = createMockEstimator();
      const beforeStats = await memory.getStats();

      await plugin.compact(100, estimator);

      const afterStats = await memory.getStats();
      expect(afterStats.totalEntries).toBeLessThan(beforeStats.totalEntries);
    });

    it('should return tokens freed', async () => {
      for (let i = 0; i < 10; i++) {
        await memory.store(`key_${i}`, `Description ${i}`, { data: 'x'.repeat(100) });
      }

      const estimator = createMockEstimator();
      const tokensFreed = await plugin.compact(50, estimator);

      expect(tokensFreed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Memory Access', () => {
    it('should provide access to underlying memory', () => {
      expect(plugin.getMemory()).toBe(memory);
    });
  });
});

// ============================================================================
// PersistentInstructionsPlugin Tests
// ============================================================================

describe('PersistentInstructionsPlugin', () => {
  let plugin: PersistentInstructionsPlugin;
  let mockStorage: IPersistentInstructionsStorage;

  beforeEach(() => {
    mockStorage = {
      save: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      getPath: vi.fn().mockReturnValue('/mock/path/custom_instructions.md'),
    };

    plugin = new PersistentInstructionsPlugin({
      agentId: 'test-agent',
      storage: mockStorage,
    });
  });

  afterEach(() => {
    if (!plugin.isDestroyed) {
      plugin.destroy();
    }
  });

  describe('Properties', () => {
    it('should have name "persistent_instructions"', () => {
      expect(plugin.name).toBe('persistent_instructions');
    });

    it('should have priority 0 (critical)', () => {
      expect(plugin.priority).toBe(0);
    });

    it('should NOT be compactable', () => {
      expect(plugin.compactable).toBe(false);
    });
  });

  describe('Content Management', () => {
    it('should set instructions', async () => {
      await plugin.set('Test instructions');
      expect(plugin.get()).toBe('Test instructions');
      expect(mockStorage.save).toHaveBeenCalledWith('Test instructions');
    });

    it('should append to instructions', async () => {
      await plugin.set('Line 1');
      await plugin.append('Line 2');
      expect(plugin.get()).toBe('Line 1\n\nLine 2');
    });

    it('should clear instructions', async () => {
      await plugin.set('Content');
      await plugin.clear();
      expect(plugin.get()).toBeNull();
      expect(mockStorage.delete).toHaveBeenCalled();
    });

    it('should check if instructions exist', async () => {
      expect(plugin.has()).toBe(false);
      await plugin.set('Content');
      expect(plugin.has()).toBe(true);
    });

    it('should respect max length on set', async () => {
      const plugin = new PersistentInstructionsPlugin({
        agentId: 'test',
        storage: mockStorage,
        maxLength: 100,
      });

      const result = await plugin.set('x'.repeat(200));
      expect(result).toBe(false);
      expect(plugin.get()).toBeNull();

      plugin.destroy();
    });

    it('should respect max length on append', async () => {
      const plugin = new PersistentInstructionsPlugin({
        agentId: 'test',
        storage: mockStorage,
        maxLength: 100,
      });

      await plugin.set('x'.repeat(50));
      const result = await plugin.append('y'.repeat(60));
      expect(result).toBe(false);
      expect(plugin.get()).toBe('x'.repeat(50)); // Original unchanged

      plugin.destroy();
    });
  });

  describe('Lazy Initialization', () => {
    it('should load from storage on first getComponent', async () => {
      mockStorage.load = vi.fn().mockResolvedValue('Loaded content');

      await plugin.getComponent();

      expect(mockStorage.load).toHaveBeenCalled();
      expect(plugin.isInitialized).toBe(true);
    });

    it('should only initialize once', async () => {
      mockStorage.load = vi.fn().mockResolvedValue('Content');

      await plugin.getComponent();
      await plugin.getComponent();

      expect(mockStorage.load).toHaveBeenCalledTimes(1);
    });
  });

  describe('Component Generation', () => {
    it('should return null when no instructions', async () => {
      const component = await plugin.getComponent();
      expect(component).toBeNull();
    });

    it('should return component with instructions', async () => {
      await plugin.set('My custom instructions');
      const component = await plugin.getComponent();

      expect(component).not.toBeNull();
      expect(component?.name).toBe('persistent_instructions');
      expect(component?.content).toContain('My custom instructions');
      expect(component?.content).toContain('Custom Instructions');
    });

    it('should include storage path in content', async () => {
      await plugin.set('Instructions');
      const component = await plugin.getComponent();

      expect(component?.content).toContain('/mock/path');
    });
  });

  describe('Serialization', () => {
    it('should serialize state', async () => {
      await plugin.set('Content');
      const state = plugin.getState();

      expect(state.content).toBe('Content');
      expect(state.agentId).toBe('test-agent');
    });

    it('should restore state', async () => {
      await plugin.set('Original');
      const state = plugin.getState();

      const newPlugin = new PersistentInstructionsPlugin({
        agentId: 'test-agent',
        storage: mockStorage,
      });
      newPlugin.restoreState(state);

      expect(newPlugin.get()).toBe('Original');

      newPlugin.destroy();
    });
  });

  describe('Compaction', () => {
    it('should return 0 tokens (never compacts)', async () => {
      const estimator = createMockEstimator();
      const tokensFreed = await plugin.compact(100, estimator);
      expect(tokensFreed).toBe(0);
    });
  });
});

// ============================================================================
// AutoSpillPlugin Tests
// ============================================================================

describe('AutoSpillPlugin', () => {
  let plugin: AutoSpillPlugin;
  let memory: WorkingMemory;
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    memory = new WorkingMemory(storage);
    plugin = new AutoSpillPlugin(memory, {
      sizeThreshold: 100, // 100 bytes for testing
      keyPrefix: 'test_spill',
    });
  });

  afterEach(() => {
    plugin.destroy();
    memory.destroy();
  });

  describe('Properties', () => {
    it('should have name "auto_spill_tracker"', () => {
      expect(plugin.name).toBe('auto_spill_tracker');
    });

    it('should have priority 9', () => {
      expect(plugin.priority).toBe(9);
    });

    it('should be compactable', () => {
      expect(plugin.compactable).toBe(true);
    });
  });

  describe('Size Threshold', () => {
    it('should spill outputs exceeding threshold', async () => {
      const largeOutput = 'x'.repeat(200);
      const key = await plugin.onToolOutput('test_tool', largeOutput);

      expect(key).toBeDefined();
      expect(key).toContain('test_spill');
    });

    it('should NOT spill outputs below threshold', async () => {
      const smallOutput = 'small';
      const key = await plugin.onToolOutput('test_tool', smallOutput);

      expect(key).toBeUndefined();
    });
  });

  describe('Tool Patterns', () => {
    it('should respect specific tool list', async () => {
      const plugin = new AutoSpillPlugin(memory, {
        sizeThreshold: 10,
        tools: ['allowed_tool'],
      });

      const key1 = await plugin.onToolOutput('allowed_tool', 'x'.repeat(100));
      const key2 = await plugin.onToolOutput('other_tool', 'y'.repeat(100));

      expect(key1).toBeDefined();
      expect(key2).toBeUndefined();

      plugin.destroy();
    });

    it('should respect tool patterns', async () => {
      const plugin = new AutoSpillPlugin(memory, {
        sizeThreshold: 10,
        toolPatterns: [/^web_/],
      });

      const key1 = await plugin.onToolOutput('web_fetch', 'x'.repeat(100));
      const key2 = await plugin.onToolOutput('read_file', 'y'.repeat(100));

      expect(key1).toBeDefined();
      expect(key2).toBeUndefined();

      plugin.destroy();
    });

    it('should spill all large outputs when no tools/patterns specified', async () => {
      const plugin = new AutoSpillPlugin(memory, {
        sizeThreshold: 10,
        // No tools or patterns
      });

      const key = await plugin.onToolOutput('any_tool', 'x'.repeat(100));
      expect(key).toBeDefined();

      plugin.destroy();
    });
  });

  describe('Entry Tracking', () => {
    it('should track spilled entries', async () => {
      await plugin.onToolOutput('tool1', 'x'.repeat(200));
      await plugin.onToolOutput('tool2', 'y'.repeat(200));

      const entries = plugin.getEntries();
      expect(entries).toHaveLength(2);
    });

    it('should mark entries as consumed', async () => {
      const key = await plugin.onToolOutput('test_tool', 'x'.repeat(200));
      expect(plugin.getUnconsumed()).toHaveLength(1);

      plugin.markConsumed(key!, 'summary_key');

      expect(plugin.getConsumed()).toHaveLength(1);
      expect(plugin.getUnconsumed()).toHaveLength(0);
    });

    it('should track derived summaries', async () => {
      const key = await plugin.onToolOutput('test_tool', 'x'.repeat(200));
      plugin.markConsumed(key!, 'summary1');
      plugin.markConsumed(key!, 'summary2');

      const entry = plugin.getSpillInfo(key!);
      expect(entry?.derivedSummaries).toEqual(['summary1', 'summary2']);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup consumed entries', async () => {
      const key = await plugin.onToolOutput('test_tool', 'x'.repeat(200));
      plugin.markConsumed(key!, 'summary');

      const deleted = await plugin.cleanupConsumed();

      expect(deleted).toContain(key);
      expect(plugin.getEntries()).toHaveLength(0);
    });

    it('should cleanup specific entries', async () => {
      const key1 = await plugin.onToolOutput('tool1', 'x'.repeat(200));
      const key2 = await plugin.onToolOutput('tool2', 'y'.repeat(200));

      const deleted = await plugin.cleanup([key1!]);

      expect(deleted).toContain(key1);
      expect(plugin.getEntries()).toHaveLength(1);
    });

    it('should cleanup all entries', async () => {
      await plugin.onToolOutput('tool1', 'x'.repeat(200));
      await plugin.onToolOutput('tool2', 'y'.repeat(200));

      const deleted = await plugin.cleanupAll();

      expect(deleted).toHaveLength(2);
      expect(plugin.getEntries()).toHaveLength(0);
    });
  });

  describe('Auto-Cleanup on Iteration', () => {
    it('should cleanup after configured iterations', async () => {
      const plugin = new AutoSpillPlugin(memory, {
        sizeThreshold: 10,
        autoCleanupAfterIterations: 2,
      });

      const key = await plugin.onToolOutput('tool', 'x'.repeat(100));
      plugin.markConsumed(key!, 'summary');

      await plugin.onIteration();
      expect(plugin.getConsumed()).toHaveLength(1); // Not yet

      await plugin.onIteration();
      expect(plugin.getConsumed()).toHaveLength(0); // Cleaned

      plugin.destroy();
    });
  });

  describe('Component Generation', () => {
    it('should return null when no unconsumed entries', async () => {
      const component = await plugin.getComponent();
      expect(component).toBeNull();
    });

    it('should return component with unconsumed entry info', async () => {
      await plugin.onToolOutput('test_tool', 'x'.repeat(200));
      const component = await plugin.getComponent();

      expect(component).not.toBeNull();
      expect(component?.content).toContain('Auto-Spilled Data');
      expect(component?.content).toContain('test_tool');
      expect(component?.metadata?.unconsumedCount).toBe(1);
    });
  });

  describe('Events', () => {
    it('should emit "spilled" event', async () => {
      const handler = vi.fn();
      plugin.on('spilled', handler);

      await plugin.onToolOutput('test_tool', 'x'.repeat(200));

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        tool: 'test_tool',
      }));
    });

    it('should emit "consumed" event', async () => {
      const handler = vi.fn();
      plugin.on('consumed', handler);

      const key = await plugin.onToolOutput('test_tool', 'x'.repeat(200));
      plugin.markConsumed(key!, 'summary');

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        key,
        summaryKey: 'summary',
      }));
    });

    it('should emit "cleaned" event', async () => {
      const handler = vi.fn();
      plugin.on('cleaned', handler);

      const key = await plugin.onToolOutput('test_tool', 'x'.repeat(200));
      plugin.markConsumed(key!, 'summary');
      await plugin.cleanupConsumed();

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'consumed',
      }));
    });
  });

  describe('Serialization', () => {
    it('should serialize state', async () => {
      await plugin.onToolOutput('test_tool', 'x'.repeat(200));
      const state = plugin.getState();

      expect(state.entries).toHaveLength(1);
      expect(state.iterationsSinceCleanup).toBe(0);
    });

    it('should restore state', async () => {
      await plugin.onToolOutput('test_tool', 'x'.repeat(200));
      const state = plugin.getState();

      const newPlugin = new AutoSpillPlugin(memory, { sizeThreshold: 100 });
      newPlugin.restoreState(state);

      expect(newPlugin.getEntries()).toHaveLength(1);

      newPlugin.destroy();
    });
  });
});
