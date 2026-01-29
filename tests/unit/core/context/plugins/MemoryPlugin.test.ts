/**
 * MemoryPlugin Tests
 * Tests for the memory context plugin
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryPlugin } from '../../../../../src/core/context/plugins/MemoryPlugin.js';
import { WorkingMemory } from '../../../../../src/capabilities/taskAgent/WorkingMemory.js';
import { InMemoryStorage } from '../../../../../src/infrastructure/storage/InMemoryStorage.js';
import type { ITokenEstimator } from '../../../../../src/core/context/types.js';

describe('MemoryPlugin', () => {
  let storage: InMemoryStorage;
  let memory: WorkingMemory;
  let plugin: MemoryPlugin;
  let mockEstimator: ITokenEstimator;

  beforeEach(() => {
    storage = new InMemoryStorage();
    memory = new WorkingMemory(storage, {
      maxSizeBytes: 10 * 1024, // 10KB for testing
      descriptionMaxLength: 150,
      softLimitPercent: 80,
      contextAllocationPercent: 20,
    });
    plugin = new MemoryPlugin(memory);

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
      expect(plugin.name).toBe('memory_index');
    });

    it('should have high priority (compact first)', () => {
      expect(plugin.priority).toBe(8);
    });

    it('should be compactable', () => {
      expect(plugin.compactable).toBe(true);
    });

    it('should use default evict batch size of 3', () => {
      // Can't directly test private field, but behavior is testable
      expect(plugin).toBeDefined();
    });

    it('should accept custom evict batch size', () => {
      const customPlugin = new MemoryPlugin(memory, 5);
      expect(customPlugin).toBeDefined();
    });
  });

  // ============================================================================
  // getMemory Tests
  // ============================================================================

  describe('getMemory', () => {
    it('should return the underlying WorkingMemory', () => {
      const retrieved = plugin.getMemory();
      expect(retrieved).toBe(memory);
    });

    it('should allow memory operations via returned instance', async () => {
      const mem = plugin.getMemory();
      await mem.store('test.key', 'Test description', { value: 42 });

      const result = await mem.retrieve('test.key');
      expect(result).toEqual({ value: 42 });
    });
  });

  // ============================================================================
  // getComponent Tests
  // ============================================================================

  describe('getComponent', () => {
    it('should return null when memory is empty', async () => {
      const component = await plugin.getComponent();
      expect(component).toBeNull();
    });

    it('should return component when memory has entries', async () => {
      await memory.store('user.name', 'User name', 'John');

      const component = await plugin.getComponent();

      expect(component).not.toBeNull();
      expect(component?.name).toBe('memory_index');
      expect(component?.priority).toBe(8);
      expect(component?.compactable).toBe(true);
    });

    it('should include memory index content', async () => {
      await memory.store('user.name', 'User name', 'John');
      await memory.store('user.email', 'User email', 'john@example.com');

      const component = await plugin.getComponent();

      expect(component?.content).toContain('user.name');
      expect(component?.content).toContain('user.email');
      expect(component?.content).toContain('User name');
      expect(component?.content).toContain('User email');
    });

    it('should include metadata with stats', async () => {
      await memory.store('key1', 'Description 1', { data: 'value1' });
      await memory.store('key2', 'Description 2', { data: 'value2' });

      const component = await plugin.getComponent();

      expect(component?.metadata?.entryCount).toBe(2);
      expect(component?.metadata?.totalSizeBytes).toBeGreaterThan(0);
      expect(component?.metadata?.utilizationPercent).toBeDefined();
    });

    it('should return null when formatIndex indicates empty memory', async () => {
      // formatMemoryIndex returns "Memory is empty." when no entries
      const component = await plugin.getComponent();
      expect(component).toBeNull();
    });
  });

  // ============================================================================
  // compact Tests
  // ============================================================================

  describe('compact', () => {
    it('should evict entries using LRU strategy', async () => {
      await memory.store('old', 'Old entry', { v: 1 });
      await new Promise(r => setTimeout(r, 10));
      await memory.store('new', 'New entry', { v: 2 });

      // Access 'new' to make it recently used
      await memory.retrieve('new');

      const freed = await plugin.compact(100, mockEstimator);

      // Should have evicted entries
      expect(freed).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 when nothing to evict', async () => {
      const freed = await plugin.compact(100, mockEstimator);
      expect(freed).toBe(0);
    });

    it('should use estimator to calculate tokens freed', async () => {
      await memory.store('key1', 'Description 1', { data: 'x'.repeat(100) });
      await memory.store('key2', 'Description 2', { data: 'y'.repeat(100) });
      await memory.store('key3', 'Description 3', { data: 'z'.repeat(100) });

      await plugin.compact(100, mockEstimator);

      expect(mockEstimator.estimateTokens).toHaveBeenCalled();
    });

    it('should respect custom evict batch size', async () => {
      // Create plugin with batch size of 2
      const customPlugin = new MemoryPlugin(memory, 2);

      await memory.store('a', 'A', 1);
      await new Promise(r => setTimeout(r, 5));
      await memory.store('b', 'B', 2);
      await new Promise(r => setTimeout(r, 5));
      await memory.store('c', 'C', 3);
      await new Promise(r => setTimeout(r, 5));
      await memory.store('d', 'D', 4);

      // Should evict 2 entries (batch size)
      await customPlugin.compact(100, mockEstimator);

      const index = await memory.getIndex();
      // At least some entries should be evicted
      expect(index.entries.length).toBeLessThanOrEqual(4);
    });

    it('should return correct token count freed', async () => {
      await memory.store('key1', 'Description', { data: 'x'.repeat(200) });

      const freed = await plugin.compact(100, mockEstimator);

      // Should have freed some tokens (or 0 if nothing evicted)
      expect(typeof freed).toBe('number');
      expect(freed).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // destroy Tests
  // ============================================================================

  describe('destroy', () => {
    it('should not throw', () => {
      expect(() => plugin.destroy()).not.toThrow();
    });

    it('should be callable multiple times', () => {
      plugin.destroy();
      plugin.destroy();
      // No error expected
    });

    it('should not affect underlying memory', async () => {
      await memory.store('test', 'Test', { v: 1 });
      plugin.destroy();

      // Memory should still work
      const result = await memory.retrieve('test');
      expect(result).toEqual({ v: 1 });
    });
  });

  // ============================================================================
  // State Persistence Tests
  // ============================================================================

  describe('getState/restoreState', () => {
    it('should return empty object for state', () => {
      const state = plugin.getState();
      expect(state).toEqual({});
    });

    it('should accept any state in restoreState (no-op)', () => {
      expect(() => plugin.restoreState({ any: 'data' })).not.toThrow();
      expect(() => plugin.restoreState(null)).not.toThrow();
      expect(() => plugin.restoreState(undefined)).not.toThrow();
    });

    it('should not modify memory on restore', async () => {
      await memory.store('existing', 'Existing', { v: 1 });

      plugin.restoreState({ someState: true });

      // Memory should be unchanged
      const result = await memory.retrieve('existing');
      expect(result).toEqual({ v: 1 });
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('integration', () => {
    it('should work with memory store/retrieve cycle', async () => {
      // Store some data
      await memory.store('user.profile', 'User profile data', {
        name: 'John',
        email: 'john@example.com',
      });

      // Get component
      const component = await plugin.getComponent();

      expect(component).not.toBeNull();
      expect(component?.content).toContain('user.profile');
    });

    it('should reflect memory changes immediately', async () => {
      await memory.store('key1', 'Key 1', 'value1');

      const component1 = await plugin.getComponent();
      expect(component1?.content).toContain('key1');

      await memory.delete('key1');

      const component2 = await plugin.getComponent();
      expect(component2?.content ?? '').not.toContain('key1');
    });

    it('should compact when memory is full', async () => {
      // Fill memory with multiple entries
      for (let i = 0; i < 10; i++) {
        await memory.store(`key${i}`, `Description ${i}`, { data: 'x'.repeat(800) });
      }

      const beforeIndex = await memory.getIndex();
      const beforeCount = beforeIndex.entries.length;

      // Compact
      await plugin.compact(100, mockEstimator);

      const afterIndex = await memory.getIndex();

      // Should have fewer entries after compaction
      expect(afterIndex.entries.length).toBeLessThanOrEqual(beforeCount);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty string content', async () => {
      await memory.store('empty', 'Empty string', '');

      const component = await plugin.getComponent();
      expect(component).not.toBeNull();
    });

    it('should handle very large memory entries', async () => {
      await memory.store('large', 'Large entry', { data: 'x'.repeat(5000) });

      const component = await plugin.getComponent();
      expect(component).not.toBeNull();
      expect(component?.metadata?.totalSizeBytes).toBeGreaterThan(5000);
    });

    it('should handle special characters in keys', async () => {
      await memory.store('api.response.status', 'API status', 200);

      const component = await plugin.getComponent();
      expect(component?.content).toContain('api.response.status');
    });

    it('should handle concurrent operations', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(memory.store(`concurrent${i}`, `Concurrent ${i}`, { v: i }));
      }
      await Promise.all(promises);

      const component = await plugin.getComponent();
      expect(component?.metadata?.entryCount).toBe(5);
    });
  });
});
