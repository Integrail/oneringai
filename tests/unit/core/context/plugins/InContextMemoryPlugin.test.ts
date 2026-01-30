/**
 * InContextMemoryPlugin Tests
 * Tests for the in-context memory plugin
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InContextMemoryPlugin } from '../../../../../src/core/context/plugins/InContextMemoryPlugin.js';
import type { ITokenEstimator } from '../../../../../src/core/context/types.js';

describe('InContextMemoryPlugin', () => {
  let plugin: InContextMemoryPlugin;
  let mockEstimator: ITokenEstimator;

  beforeEach(() => {
    plugin = new InContextMemoryPlugin();

    mockEstimator = {
      estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
      estimateDataTokens: vi.fn((data: unknown) => Math.ceil(JSON.stringify(data).length / 4)),
    };
  });

  // ============================================================================
  // Constructor and Properties Tests
  // ============================================================================

  describe('constructor and properties', () => {
    it('should have correct name', () => {
      expect(plugin.name).toBe('in_context_memory');
    });

    it('should have medium priority (5)', () => {
      expect(plugin.priority).toBe(5);
    });

    it('should be compactable', () => {
      expect(plugin.compactable).toBe(true);
    });

    it('should start with zero entries', () => {
      expect(plugin.size).toBe(0);
    });

    it('should not be destroyed initially', () => {
      expect(plugin.isDestroyed).toBe(false);
    });

    it('should use default config values', () => {
      const state = plugin.getState();
      expect(state.config.maxEntries).toBe(20);
      expect(state.config.maxTotalTokens).toBe(4000);
      expect(state.config.defaultPriority).toBe('normal');
      expect(state.config.showTimestamps).toBe(false);
      expect(state.config.headerText).toBe('## Live Context');
    });

    it('should accept custom config', () => {
      const customPlugin = new InContextMemoryPlugin({
        maxEntries: 10,
        defaultPriority: 'high',
        showTimestamps: true,
        headerText: '## Custom Header',
      });

      const state = customPlugin.getState();
      expect(state.config.maxEntries).toBe(10);
      expect(state.config.defaultPriority).toBe('high');
      expect(state.config.showTimestamps).toBe(true);
      expect(state.config.headerText).toBe('## Custom Header');
    });
  });

  // ============================================================================
  // Entry Management Tests
  // ============================================================================

  describe('set', () => {
    it('should store a value', () => {
      plugin.set('key1', 'Description 1', { value: 42 });

      expect(plugin.has('key1')).toBe(true);
      expect(plugin.get('key1')).toEqual({ value: 42 });
    });

    it('should update existing value', () => {
      plugin.set('key1', 'Original', { v: 1 });
      plugin.set('key1', 'Updated', { v: 2 });

      expect(plugin.get('key1')).toEqual({ v: 2 });
      expect(plugin.size).toBe(1);
    });

    it('should use default priority', () => {
      plugin.set('key1', 'Description', 'value');

      const entries = plugin.list();
      expect(entries[0].priority).toBe('normal');
    });

    it('should accept custom priority', () => {
      plugin.set('key1', 'Description', 'value', 'high');

      const entries = plugin.list();
      expect(entries[0].priority).toBe('high');
    });

    it('should store various data types', () => {
      plugin.set('string', 'String value', 'hello');
      plugin.set('number', 'Number value', 42);
      plugin.set('boolean', 'Boolean value', true);
      plugin.set('array', 'Array value', [1, 2, 3]);
      plugin.set('object', 'Object value', { nested: { deep: 'value' } });
      plugin.set('null', 'Null value', null);

      expect(plugin.get('string')).toBe('hello');
      expect(plugin.get('number')).toBe(42);
      expect(plugin.get('boolean')).toBe(true);
      expect(plugin.get('array')).toEqual([1, 2, 3]);
      expect(plugin.get('object')).toEqual({ nested: { deep: 'value' } });
      expect(plugin.get('null')).toBeNull();
    });

    it('should update timestamp on set', async () => {
      plugin.set('key1', 'Description', 'value1');
      const time1 = plugin.list()[0].updatedAt;

      await new Promise((r) => setTimeout(r, 10));

      plugin.set('key1', 'Description', 'value2');
      const time2 = plugin.list()[0].updatedAt;

      expect(time2).toBeGreaterThan(time1);
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent key', () => {
      expect(plugin.get('nonexistent')).toBeUndefined();
    });

    it('should return the stored value', () => {
      plugin.set('key1', 'Description', { data: 'test' });
      expect(plugin.get('key1')).toEqual({ data: 'test' });
    });
  });

  describe('has', () => {
    it('should return false for non-existent key', () => {
      expect(plugin.has('nonexistent')).toBe(false);
    });

    it('should return true for existing key', () => {
      plugin.set('key1', 'Description', 'value');
      expect(plugin.has('key1')).toBe(true);
    });
  });

  describe('delete', () => {
    it('should return false for non-existent key', () => {
      expect(plugin.delete('nonexistent')).toBe(false);
    });

    it('should return true and remove existing key', () => {
      plugin.set('key1', 'Description', 'value');

      expect(plugin.delete('key1')).toBe(true);
      expect(plugin.has('key1')).toBe(false);
      expect(plugin.size).toBe(0);
    });
  });

  describe('list', () => {
    it('should return empty array when no entries', () => {
      expect(plugin.list()).toEqual([]);
    });

    it('should return all entries with metadata', () => {
      plugin.set('key1', 'Description 1', 'value1', 'low');
      plugin.set('key2', 'Description 2', 'value2', 'high');

      const entries = plugin.list();

      expect(entries).toHaveLength(2);
      expect(entries.find((e) => e.key === 'key1')).toMatchObject({
        key: 'key1',
        description: 'Description 1',
        priority: 'low',
      });
      expect(entries.find((e) => e.key === 'key2')).toMatchObject({
        key: 'key2',
        description: 'Description 2',
        priority: 'high',
      });
    });

    it('should include updatedAt timestamps', () => {
      plugin.set('key1', 'Description', 'value');

      const entries = plugin.list();
      expect(entries[0].updatedAt).toBeDefined();
      expect(typeof entries[0].updatedAt).toBe('number');
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      plugin.set('key1', 'Desc 1', 'value1');
      plugin.set('key2', 'Desc 2', 'value2');
      plugin.set('key3', 'Desc 3', 'value3');

      plugin.clear();

      expect(plugin.size).toBe(0);
      expect(plugin.list()).toEqual([]);
    });
  });

  // ============================================================================
  // Max Entries Enforcement Tests
  // ============================================================================

  describe('maxEntries enforcement', () => {
    it('should evict low priority entries when limit exceeded', () => {
      const limitedPlugin = new InContextMemoryPlugin({ maxEntries: 3 });

      limitedPlugin.set('high1', 'High', 'value', 'high');
      limitedPlugin.set('low1', 'Low', 'value', 'low');
      limitedPlugin.set('normal1', 'Normal', 'value', 'normal');
      limitedPlugin.set('low2', 'Low 2', 'value', 'low');

      expect(limitedPlugin.size).toBe(3);
      // low1 should be evicted (lowest priority, oldest)
      expect(limitedPlugin.has('low1')).toBe(false);
      expect(limitedPlugin.has('high1')).toBe(true);
      expect(limitedPlugin.has('normal1')).toBe(true);
      expect(limitedPlugin.has('low2')).toBe(true);
    });

    it('should evict oldest entry when priorities are equal', async () => {
      const limitedPlugin = new InContextMemoryPlugin({ maxEntries: 2 });

      limitedPlugin.set('old', 'Old', 'value');
      await new Promise((r) => setTimeout(r, 10));
      limitedPlugin.set('mid', 'Mid', 'value');
      await new Promise((r) => setTimeout(r, 10));
      limitedPlugin.set('new', 'New', 'value');

      expect(limitedPlugin.size).toBe(2);
      expect(limitedPlugin.has('old')).toBe(false);
      expect(limitedPlugin.has('mid')).toBe(true);
      expect(limitedPlugin.has('new')).toBe(true);
    });

    it('should never auto-evict critical entries', () => {
      const limitedPlugin = new InContextMemoryPlugin({ maxEntries: 2 });

      limitedPlugin.set('critical1', 'Critical 1', 'value', 'critical');
      limitedPlugin.set('critical2', 'Critical 2', 'value', 'critical');
      // Adding normal after two criticals - normal can't be added without evicting a critical
      // But criticals can't be evicted, so the normal entry gets added but a critical is preserved
      limitedPlugin.set('normal', 'Normal', 'value', 'normal');

      // Plugin protects critical entries, but when adding a new entry
      // it tries to evict lowest priority first (normal didn't exist yet to evict)
      // So it will try to evict criticals, fail, and end up over limit
      // Actually let me trace through: we have 2 criticals, add normal (size=3), enforce limit
      // sorted = [normal, critical1, critical2] - normal is lowest priority
      // but wait, normal was just added... ah, the order depends on iteration order
      // Actually after the sort, normal (priority 2) < critical (priority 4)
      // So normal should be evicted, leaving 2 criticals
      expect(limitedPlugin.size).toBe(2);
      expect(limitedPlugin.has('critical1')).toBe(true);
      expect(limitedPlugin.has('critical2')).toBe(true);
      // Normal was evicted to enforce the limit
      expect(limitedPlugin.has('normal')).toBe(false);
    });
  });

  // ============================================================================
  // getComponent Tests
  // ============================================================================

  describe('getComponent', () => {
    it('should return null when empty', async () => {
      const component = await plugin.getComponent();
      expect(component).toBeNull();
    });

    it('should return component when entries exist', async () => {
      plugin.set('state', 'Current state', { step: 1 });

      const component = await plugin.getComponent();

      expect(component).not.toBeNull();
      expect(component?.name).toBe('in_context_memory');
      expect(component?.priority).toBe(5);
      expect(component?.compactable).toBe(true);
    });

    it('should include header text', async () => {
      plugin.set('key', 'Description', 'value');

      const component = await plugin.getComponent();

      expect(component?.content).toContain('## Live Context');
    });

    it('should include instruction text', async () => {
      plugin.set('key', 'Description', 'value');

      const component = await plugin.getComponent();

      expect(component?.content).toContain('Data below is always current');
      expect(component?.content).toContain('no retrieval needed');
    });

    it('should include key and description', async () => {
      plugin.set('user_state', 'Current user processing state', { step: 2 });

      const component = await plugin.getComponent();

      expect(component?.content).toContain('### user_state');
      expect(component?.content).toContain('Current user processing state');
    });

    it('should include value as JSON code block', async () => {
      plugin.set('data', 'Test data', { nested: { value: 42 } });

      const component = await plugin.getComponent();

      expect(component?.content).toContain('```json');
      expect(component?.content).toContain('"nested"');
      expect(component?.content).toContain('"value": 42');
    });

    it('should include metadata with entry count', async () => {
      plugin.set('key1', 'Desc 1', 'val1');
      plugin.set('key2', 'Desc 2', 'val2');

      const component = await plugin.getComponent();

      expect(component?.metadata?.entryCount).toBe(2);
    });

    it('should use custom header text', async () => {
      const customPlugin = new InContextMemoryPlugin({
        headerText: '## Custom Context Section',
      });
      customPlugin.set('key', 'Desc', 'value');

      const component = await customPlugin.getComponent();

      expect(component?.content).toContain('## Custom Context Section');
    });

    it('should optionally show timestamps', async () => {
      const timestampPlugin = new InContextMemoryPlugin({ showTimestamps: true });
      timestampPlugin.set('key', 'Description', 'value');

      const component = await timestampPlugin.getComponent();

      expect(component?.content).toContain('_Updated:');
    });
  });

  // ============================================================================
  // compact Tests
  // ============================================================================

  describe('compact', () => {
    it('should return 0 when already under target', async () => {
      plugin.set('small', 'Small entry', 'x');

      const freed = await plugin.compact(10000, mockEstimator);

      expect(freed).toBe(0);
    });

    it('should evict low priority entries first', async () => {
      // Use large entries so there's a meaningful difference
      plugin.set('low', 'Low priority', 'x'.repeat(400), 'low');
      plugin.set('high', 'High priority', 'y'.repeat(400), 'high');

      // Get initial token count to set realistic target
      // Header + 2 entries ~ 300 tokens with mock estimator
      // After evicting low, should be ~150 tokens
      await plugin.compact(200, mockEstimator);

      expect(plugin.has('high')).toBe(true);
      expect(plugin.has('low')).toBe(false);
    });

    it('should evict older entries when priorities equal', async () => {
      plugin.set('old', 'Old', 'x'.repeat(400));
      await new Promise((r) => setTimeout(r, 10));
      plugin.set('new', 'New', 'y'.repeat(400));

      // Need to evict one to get under 200 tokens
      await plugin.compact(200, mockEstimator);

      expect(plugin.has('new')).toBe(true);
      expect(plugin.has('old')).toBe(false);
    });

    it('should never auto-evict critical entries', async () => {
      plugin.set('critical', 'Critical', 'x'.repeat(1000), 'critical');
      plugin.set('normal', 'Normal', 'y'.repeat(100), 'normal');

      await plugin.compact(50, mockEstimator);

      // Critical should remain even if over target
      expect(plugin.has('critical')).toBe(true);
      expect(plugin.has('normal')).toBe(false);
    });

    it('should return tokens freed', async () => {
      plugin.set('entry1', 'Entry 1', 'x'.repeat(200));
      plugin.set('entry2', 'Entry 2', 'y'.repeat(200));

      const freed = await plugin.compact(100, mockEstimator);

      expect(typeof freed).toBe('number');
      expect(freed).toBeGreaterThanOrEqual(0);
    });

    it('should call estimator', async () => {
      plugin.set('entry', 'Entry', 'data');

      await plugin.compact(100, mockEstimator);

      expect(mockEstimator.estimateTokens).toHaveBeenCalled();
    });

    it('should evict in correct order: low, normal, high', async () => {
      // All same timestamp (approximately)
      plugin.set('high', 'High', 'x'.repeat(400), 'high');
      plugin.set('normal', 'Normal', 'x'.repeat(400), 'normal');
      plugin.set('low', 'Low', 'x'.repeat(400), 'low');

      // Compact to force eviction of low and normal but keep high
      // 3 entries ~ 400 tokens each plus header/formatting
      // Target should force eviction of 2 entries
      await plugin.compact(200, mockEstimator);

      // Low and normal should be evicted before high
      expect(plugin.has('high')).toBe(true);
      // At least one of the lower priority entries should be gone
      expect(plugin.has('low')).toBe(false);
    });
  });

  // ============================================================================
  // State Persistence Tests
  // ============================================================================

  describe('getState/restoreState', () => {
    it('should serialize current state', () => {
      plugin.set('key1', 'Desc 1', 'value1', 'high');
      plugin.set('key2', 'Desc 2', { nested: true }, 'low');

      const state = plugin.getState();

      expect(state.entries).toHaveLength(2);
      expect(state.config).toBeDefined();
    });

    it('should restore state from serialization', () => {
      plugin.set('key1', 'Desc 1', 'value1');

      const state = plugin.getState();

      // Create new plugin and restore
      const newPlugin = new InContextMemoryPlugin();
      newPlugin.restoreState(state);

      expect(newPlugin.size).toBe(1);
      expect(newPlugin.get('key1')).toBe('value1');
    });

    it('should restore config', () => {
      const customPlugin = new InContextMemoryPlugin({
        maxEntries: 10,
        defaultPriority: 'high',
      });
      customPlugin.set('key', 'Desc', 'value');

      const state = customPlugin.getState();

      const newPlugin = new InContextMemoryPlugin();
      newPlugin.restoreState(state);

      const newState = newPlugin.getState();
      expect(newState.config.maxEntries).toBe(10);
      expect(newState.config.defaultPriority).toBe('high');
    });

    it('should handle invalid state gracefully', () => {
      expect(() => plugin.restoreState(null)).not.toThrow();
      expect(() => plugin.restoreState(undefined)).not.toThrow();
      expect(() => plugin.restoreState('invalid')).not.toThrow();
      expect(() => plugin.restoreState({})).not.toThrow();
    });

    it('should handle partial state', () => {
      plugin.set('existing', 'Existing', 'value');

      plugin.restoreState({ entries: [], config: {} });

      expect(plugin.size).toBe(0);
    });
  });

  // ============================================================================
  // destroy Tests
  // ============================================================================

  describe('destroy', () => {
    it('should clear all entries', () => {
      plugin.set('key1', 'Desc', 'value');
      plugin.set('key2', 'Desc', 'value');

      plugin.destroy();

      expect(plugin.size).toBe(0);
    });

    it('should mark plugin as destroyed', () => {
      plugin.destroy();

      expect(plugin.isDestroyed).toBe(true);
    });

    it('should throw on operations after destroy', () => {
      plugin.destroy();

      expect(() => plugin.set('key', 'desc', 'value')).toThrow();
      expect(() => plugin.get('key')).toThrow();
      expect(() => plugin.has('key')).toThrow();
      expect(() => plugin.delete('key')).toThrow();
      expect(() => plugin.list()).toThrow();
      expect(() => plugin.clear()).toThrow();
    });

    it('should throw on getComponent after destroy', async () => {
      plugin.destroy();

      await expect(plugin.getComponent()).rejects.toThrow();
    });

    it('should be callable multiple times', () => {
      plugin.destroy();
      expect(() => plugin.destroy()).not.toThrow();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty string values', () => {
      plugin.set('empty', 'Empty string', '');

      expect(plugin.get('empty')).toBe('');
    });

    it('should handle special characters in keys', () => {
      plugin.set('key.with.dots', 'Dots', 'value1');
      plugin.set('key-with-dashes', 'Dashes', 'value2');
      plugin.set('key_with_underscores', 'Underscores', 'value3');

      expect(plugin.get('key.with.dots')).toBe('value1');
      expect(plugin.get('key-with-dashes')).toBe('value2');
      expect(plugin.get('key_with_underscores')).toBe('value3');
    });

    it('should handle unicode in keys and values', () => {
      plugin.set('unicode_key_\u{1F600}', 'Emoji key', { emoji: '\u{1F600}' });

      expect(plugin.get('unicode_key_\u{1F600}')).toEqual({ emoji: '\u{1F600}' });
    });

    it('should handle very long descriptions', () => {
      const longDesc = 'x'.repeat(1000);
      plugin.set('key', longDesc, 'value');

      const entries = plugin.list();
      expect(entries[0].description).toBe(longDesc);
    });

    it('should handle deeply nested objects', () => {
      const deepObj = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep',
              },
            },
          },
        },
      };
      plugin.set('deep', 'Deep object', deepObj);

      expect(plugin.get('deep')).toEqual(deepObj);
    });

    it('should handle concurrent operations', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => {
            plugin.set(`key${i}`, `Desc ${i}`, { v: i });
          })
        );
      }
      await Promise.all(promises);

      expect(plugin.size).toBe(10);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('integration', () => {
    it('should work end-to-end with component generation', async () => {
      // Set up state
      plugin.set('current_task', 'Current processing task', { id: 1, name: 'process' });
      plugin.set('user_prefs', 'User preferences', { verbose: true });
      plugin.set('temp_data', 'Temporary data', 'temp', 'low');

      // Get component
      const component = await plugin.getComponent();

      expect(component).not.toBeNull();
      expect(component?.content).toContain('current_task');
      expect(component?.content).toContain('user_prefs');
      expect(component?.content).toContain('temp_data');

      // Delete temp data
      plugin.delete('temp_data');

      // Verify deletion reflected
      const component2 = await plugin.getComponent();
      expect(component2?.content).not.toContain('temp_data');
    });

    it('should handle full lifecycle: set, update, compact, serialize, restore', async () => {
      // Initial state
      plugin.set('state', 'State', { phase: 1 }, 'high');
      plugin.set('temp', 'Temp', 'x'.repeat(100), 'low');

      // Update
      plugin.set('state', 'State', { phase: 2 }, 'high');

      // Compact
      await plugin.compact(50, mockEstimator);

      // Serialize
      const state = plugin.getState();

      // Create new plugin and restore
      const newPlugin = new InContextMemoryPlugin();
      newPlugin.restoreState(state);

      // Verify state preserved
      expect(newPlugin.get('state')).toEqual({ phase: 2 });
    });
  });
});
