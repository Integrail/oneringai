/**
 * WorkingMemoryPluginNextGen Unit Tests
 *
 * Tests for the NextGen working memory plugin covering:
 * - Core CRUD operations (store, retrieve, delete)
 * - Tier system (raw, summary, findings)
 * - Priority-based eviction
 * - Compaction
 * - Serialization/deserialization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkingMemoryPluginNextGen } from '@/core/context-nextgen/plugins/WorkingMemoryPluginNextGen.js';
import type { WorkingMemoryPluginConfig } from '@/core/context-nextgen/plugins/WorkingMemoryPluginNextGen.js';

describe('WorkingMemoryPluginNextGen', () => {
  let plugin: WorkingMemoryPluginNextGen;

  beforeEach(() => {
    plugin = new WorkingMemoryPluginNextGen();
  });

  afterEach(() => {
    plugin.destroy();
  });

  describe('Plugin Interface', () => {
    it('should have correct name', () => {
      expect(plugin.name).toBe('working_memory');
    });

    it('should provide instructions', () => {
      const instructions = plugin.getInstructions();
      expect(instructions).toContain('Working Memory');
      expect(instructions).toContain('memory_retrieve');
    });

    it('should be compactable', () => {
      expect(plugin.isCompactable()).toBe(true);
    });

    it('should provide 5 tools', () => {
      const tools = plugin.getTools();
      expect(tools).toHaveLength(5);

      const toolNames = tools.map(t => t.definition.function.name);
      expect(toolNames).toContain('memory_store');
      expect(toolNames).toContain('memory_retrieve');
      expect(toolNames).toContain('memory_delete');
      expect(toolNames).toContain('memory_query');
      expect(toolNames).toContain('memory_cleanup_raw');
    });
  });

  describe('Basic Store/Retrieve/Delete', () => {
    it('should store and retrieve a value', async () => {
      await plugin.store('test_key', 'Test description', { data: 'value' });

      const value = await plugin.retrieve('test_key');
      expect(value).toEqual({ data: 'value' });
    });

    it('should return undefined for non-existent key', async () => {
      const value = await plugin.retrieve('non_existent');
      expect(value).toBeUndefined();
    });

    it('should delete a key', async () => {
      await plugin.store('to_delete', 'Will be deleted', { temp: true });

      const deleted = await plugin.delete('to_delete');
      expect(deleted).toBe(true);

      const value = await plugin.retrieve('to_delete');
      expect(value).toBeUndefined();
    });

    it('should return false when deleting non-existent key', async () => {
      const deleted = await plugin.delete('non_existent');
      expect(deleted).toBe(false);
    });

    it('should update existing key', async () => {
      await plugin.store('key', 'Initial', { version: 1 });
      await plugin.store('key', 'Updated', { version: 2 });

      const value = await plugin.retrieve('key');
      expect(value).toEqual({ version: 2 });
    });
  });

  describe('Tier System', () => {
    it('should add tier prefix when storing with tier', async () => {
      const result = await plugin.store('data', 'Raw data', { raw: true }, { tier: 'raw' });
      expect(result.key).toBe('raw.data');
    });

    it('should set priority based on tier', async () => {
      await plugin.store('raw_item', 'Raw tier', {}, { tier: 'raw' });
      await plugin.store('summary_item', 'Summary tier', {}, { tier: 'summary' });
      await plugin.store('findings_item', 'Findings tier', {}, { tier: 'findings' });

      const queryResult = await plugin.query({ includeValues: false });
      expect(queryResult.entries).toHaveLength(3);

      // Check tiers are assigned correctly
      const rawEntry = queryResult.entries.find(e => e.key === 'raw.raw_item');
      const summaryEntry = queryResult.entries.find(e => e.key === 'summary.summary_item');
      const findingsEntry = queryResult.entries.find(e => e.key === 'findings.findings_item');

      expect(rawEntry?.tier).toBe('raw');
      expect(summaryEntry?.tier).toBe('summary');
      expect(findingsEntry?.tier).toBe('findings');
    });

    it('should filter by tier in query', async () => {
      await plugin.store('item1', 'Raw 1', {}, { tier: 'raw' });
      await plugin.store('item2', 'Raw 2', {}, { tier: 'raw' });
      await plugin.store('item3', 'Summary', {}, { tier: 'summary' });

      const rawOnly = await plugin.query({ tier: 'raw' });
      expect(rawOnly.entries).toHaveLength(2);

      const summaryOnly = await plugin.query({ tier: 'summary' });
      expect(summaryOnly.entries).toHaveLength(1);
    });

    it('should cleanup raw tier', async () => {
      await plugin.store('item1', 'Raw', {}, { tier: 'raw' });
      await plugin.store('item2', 'Raw', {}, { tier: 'raw' });
      await plugin.store('item3', 'Summary', {}, { tier: 'summary' });

      const result = await plugin.cleanupRaw();
      expect(result.deleted).toBe(2);
      expect(result.keys).toContain('raw.item1');
      expect(result.keys).toContain('raw.item2');

      // Summary should remain
      const remaining = await plugin.query();
      expect(remaining.entries).toHaveLength(1);
      expect(remaining.entries[0]?.key).toBe('summary.item3');
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      await plugin.store('user.profile', 'User profile', { name: 'John' });
      await plugin.store('user.settings', 'User settings', { theme: 'dark' });
      await plugin.store('cache.data', 'Cached data', { temp: true });
    });

    it('should list all keys without pattern', async () => {
      const result = await plugin.query();
      expect(result.entries).toHaveLength(3);
    });

    it('should filter by pattern', async () => {
      const result = await plugin.query({ pattern: 'user.*' });
      expect(result.entries).toHaveLength(2);
      expect(result.entries.map(e => e.key)).toContain('user.profile');
      expect(result.entries.map(e => e.key)).toContain('user.settings');
    });

    it('should include values when requested', async () => {
      const result = await plugin.query({ pattern: 'user.profile', includeValues: true });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.value).toEqual({ name: 'John' });
    });

    it('should include stats when requested', async () => {
      const result = await plugin.query({ includeStats: true });
      expect(result.stats).toBeDefined();
      expect(result.stats?.count).toBe(3);
      expect(result.stats?.totalBytes).toBeGreaterThan(0);
    });
  });

  describe('Priority and Scopes', () => {
    it('should respect pinned entries during eviction', async () => {
      await plugin.store('normal', 'Normal entry', {});
      await plugin.store('pinned', 'Pinned entry', {}, { pinned: true });

      const evicted = await plugin.evict(1);

      // Should evict normal entry, not pinned
      expect(evicted).toHaveLength(1);
      expect(evicted[0]).toBe('normal');

      // Pinned should remain
      const pinned = await plugin.retrieve('pinned');
      expect(pinned).toBeDefined();
    });

    it('should respect priority during eviction', async () => {
      await plugin.store('low', 'Low priority', {}, { priority: 'low' });
      await plugin.store('high', 'High priority', {}, { priority: 'high' });

      const evicted = await plugin.evict(1);

      // Should evict low priority first
      expect(evicted[0]).toBe('low');
    });

    it('should store with session scope by default', async () => {
      await plugin.store('key', 'Description', { data: 1 });

      const state = plugin.getState();
      const entry = state.entries.find(e => e.key === 'key');
      expect(entry?.scope).toBe('session');
    });
  });

  describe('Compaction', () => {
    it('should evict entries during compaction', async () => {
      // Store several entries
      for (let i = 0; i < 10; i++) {
        await plugin.store(`key${i}`, `Entry ${i}`, { index: i });
      }

      // Populate token cache before compacting
      await plugin.getContent();
      const freed = await plugin.compact(100);

      expect(freed).toBeGreaterThan(0);
    });

    it('should not evict critical or pinned entries during compaction', async () => {
      await plugin.store('normal', 'Normal', {}, { priority: 'low' });
      await plugin.store('critical', 'Critical', {}, { priority: 'critical' });
      await plugin.store('pinned', 'Pinned', {}, { pinned: true });

      await plugin.compact(1000);

      // Critical and pinned should remain
      expect(await plugin.retrieve('critical')).toBeDefined();
      expect(await plugin.retrieve('pinned')).toBeDefined();
    });
  });

  describe('Entry Count Eviction', () => {
    it('should auto-evict when entry count exceeds maxIndexEntries', async () => {
      // Create plugin with maxIndexEntries = 5
      const limitedPlugin = new WorkingMemoryPluginNextGen({
        config: {
          maxIndexEntries: 5,
          maxSizeBytes: 25 * 1024 * 1024,
          descriptionMaxLength: 150,
          softLimitPercent: 80,
          contextAllocationPercent: 20,
        },
      });

      // Store 5 entries (at limit)
      for (let i = 0; i < 5; i++) {
        await limitedPlugin.store(`key${i}`, `Entry ${i}`, { index: i });
      }

      let result = await limitedPlugin.query();
      expect(result.entries).toHaveLength(5);

      // Store 6th entry - should trigger eviction
      await limitedPlugin.store('key5', 'Entry 5', { index: 5 });

      result = await limitedPlugin.query();
      expect(result.entries).toHaveLength(5); // Still 5, oldest evicted

      limitedPlugin.destroy();
    });

    it('should evict lowest priority entries first when count exceeded', async () => {
      const limitedPlugin = new WorkingMemoryPluginNextGen({
        config: {
          maxIndexEntries: 3,
          maxSizeBytes: 25 * 1024 * 1024,
          descriptionMaxLength: 150,
          softLimitPercent: 80,
          contextAllocationPercent: 20,
        },
      });

      // Store entries with different priorities
      await limitedPlugin.store('low1', 'Low priority 1', {}, { priority: 'low' });
      await limitedPlugin.store('high1', 'High priority', {}, { priority: 'high' });
      await limitedPlugin.store('low2', 'Low priority 2', {}, { priority: 'low' });

      // All 3 fit
      let result = await limitedPlugin.query();
      expect(result.entries).toHaveLength(3);

      // Add 4th - should evict a low priority entry
      await limitedPlugin.store('normal1', 'Normal priority', {}, { priority: 'normal' });

      result = await limitedPlugin.query();
      expect(result.entries).toHaveLength(3);

      // High priority should remain
      expect(await limitedPlugin.retrieve('high1')).toBeDefined();

      // One of the low priority entries should be evicted
      const lowCount = result.entries.filter(e =>
        e.key === 'low1' || e.key === 'low2'
      ).length;
      expect(lowCount).toBe(1);

      limitedPlugin.destroy();
    });

    it('should not evict pinned entries when count exceeded', async () => {
      const limitedPlugin = new WorkingMemoryPluginNextGen({
        config: {
          maxIndexEntries: 2,
          maxSizeBytes: 25 * 1024 * 1024,
          descriptionMaxLength: 150,
          softLimitPercent: 80,
          contextAllocationPercent: 20,
        },
      });

      await limitedPlugin.store('pinned', 'Pinned entry', {}, { pinned: true });
      await limitedPlugin.store('normal', 'Normal entry', {});

      // At limit with 2 entries
      let result = await limitedPlugin.query();
      expect(result.entries).toHaveLength(2);

      // Add 3rd - should evict normal, not pinned
      await limitedPlugin.store('new', 'New entry', {});

      result = await limitedPlugin.query();
      expect(result.entries).toHaveLength(2);

      // Pinned should remain
      expect(await limitedPlugin.retrieve('pinned')).toBeDefined();
      // Normal should be evicted
      expect(await limitedPlugin.retrieve('normal')).toBeUndefined();

      limitedPlugin.destroy();
    });
  });

  describe('Content for Context', () => {
    it('should return null when empty', async () => {
      const content = await plugin.getContent();
      expect(content).toBeNull();
    });

    it('should return formatted index when entries exist', async () => {
      await plugin.store('key1', 'Description 1', { value: 1 });
      await plugin.store('key2', 'Description 2', { value: 2 });

      const content = await plugin.getContent();
      expect(content).toBeDefined();
      expect(content).toContain('key1');
      expect(content).toContain('Description 1');
    });

    it('should track token size', async () => {
      expect(plugin.getTokenSize()).toBe(0);

      await plugin.store('key', 'Description', { data: 'some value' });
      await plugin.getContent(); // Triggers token calculation

      expect(plugin.getTokenSize()).toBeGreaterThan(0);
    });
  });

  describe('Serialization', () => {
    it('should serialize state', async () => {
      await plugin.store('key1', 'Desc 1', { value: 1 });
      await plugin.store('key2', 'Desc 2', { value: 2 }, { tier: 'findings' });

      const state = plugin.getState();

      expect(state.version).toBe(1);
      expect(state.entries).toHaveLength(2);
      expect(state.entries[0]).toHaveProperty('key');
      expect(state.entries[0]).toHaveProperty('description');
      expect(state.entries[0]).toHaveProperty('value');
    });

    it('should restore state', async () => {
      await plugin.store('key1', 'Desc 1', { original: true });
      const state = plugin.getState();

      // Create new plugin and restore
      const newPlugin = new WorkingMemoryPluginNextGen();
      newPlugin.restoreState(state);

      const value = await newPlugin.retrieve('key1');
      expect(value).toEqual({ original: true });

      newPlugin.destroy();
    });
  });

  describe('Lifecycle', () => {
    it('should throw when destroyed', async () => {
      plugin.destroy();

      await expect(plugin.store('key', 'desc', {})).rejects.toThrow('destroyed');
      await expect(plugin.retrieve('key')).rejects.toThrow('destroyed');
    });
  });

  describe('Tool Execution', () => {
    it('should execute memory_store tool', async () => {
      const tools = plugin.getTools();
      const storeTool = tools.find(t => t.definition.function.name === 'memory_store')!;

      const result = await storeTool.execute({
        key: 'tool_test',
        description: 'Test from tool',
        value: { fromTool: true },
      });

      expect(result.success).toBe(true);
      expect(result.key).toBe('tool_test');

      const value = await plugin.retrieve('tool_test');
      expect(value).toEqual({ fromTool: true });
    });

    it('should execute memory_retrieve tool', async () => {
      await plugin.store('existing', 'Exists', { data: 123 });

      const tools = plugin.getTools();
      const retrieveTool = tools.find(t => t.definition.function.name === 'memory_retrieve')!;

      const result = await retrieveTool.execute({ key: 'existing' });
      expect(result.found).toBe(true);
      expect(result.value).toEqual({ data: 123 });

      const notFound = await retrieveTool.execute({ key: 'non_existent' });
      expect(notFound.found).toBe(false);
    });

    it('should execute memory_delete tool', async () => {
      await plugin.store('to_delete', 'Will be deleted', {});

      const tools = plugin.getTools();
      const deleteTool = tools.find(t => t.definition.function.name === 'memory_delete')!;

      const result = await deleteTool.execute({ key: 'to_delete' });
      expect(result.deleted).toBe(true);
    });

    it('should execute memory_query tool', async () => {
      await plugin.store('key1', 'Entry 1', {});
      await plugin.store('key2', 'Entry 2', {});

      const tools = plugin.getTools();
      const queryTool = tools.find(t => t.definition.function.name === 'memory_query')!;

      const result = await queryTool.execute({});
      expect(result.entries).toHaveLength(2);
    });

    it('should execute memory_cleanup_raw tool', async () => {
      await plugin.store('item1', 'Raw', {}, { tier: 'raw' });
      await plugin.store('item2', 'Summary', {}, { tier: 'summary' });

      const tools = plugin.getTools();
      const cleanupTool = tools.find(t => t.definition.function.name === 'memory_cleanup_raw')!;

      const result = await cleanupTool.execute({});
      expect(result.deleted).toBe(1);
      expect(result.keys).toContain('raw.item1');
    });
  });
});
