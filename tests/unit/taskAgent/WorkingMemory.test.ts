/**
 * WorkingMemory Tests
 * Tests for the WorkingMemory class that manages agent memory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkingMemory } from '@/capabilities/taskAgent/WorkingMemory.js';
import { IMemoryStorage } from '@/domain/interfaces/IMemoryStorage.js';
import { InMemoryStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import type { WorkingMemoryConfig } from '@/domain/entities/Memory.js';
import { DEFAULT_MEMORY_CONFIG } from '@/domain/entities/Memory.js';

describe('WorkingMemory', () => {
  let storage: IMemoryStorage;
  let memory: WorkingMemory;

  const defaultConfig: WorkingMemoryConfig = {
    maxSizeBytes: 10 * 1024, // 10KB for testing
    descriptionMaxLength: 150,
    softLimitPercent: 80,
    contextAllocationPercent: 20,
  };

  beforeEach(() => {
    storage = new InMemoryStorage();
    memory = new WorkingMemory(storage, defaultConfig);
  });

  describe('constructor', () => {
    it('should create instance with storage and config', () => {
      expect(memory).toBeDefined();
    });

    it('should use default config when not provided', () => {
      const mem = new WorkingMemory(storage);
      expect(mem).toBeDefined();
    });
  });

  describe('store', () => {
    it('should store entry and update index', async () => {
      await memory.store('user.profile', 'User profile data', { name: 'John' });

      const index = await memory.getIndex();
      expect(index.entries).toHaveLength(1);
      expect(index.entries[0].key).toBe('user.profile');
      expect(index.entries[0].description).toBe('User profile data');
    });

    it('should reject description over max length', async () => {
      const longDesc = 'a'.repeat(200);

      await expect(memory.store('key', longDesc, {})).rejects.toThrow(
        'Description exceeds maximum length'
      );
    });

    it('should update existing entry', async () => {
      await memory.store('key', 'Original', { v: 1 });
      await memory.store('key', 'Updated', { v: 2 });

      const value = await memory.retrieve('key');
      expect(value).toEqual({ v: 2 });

      const index = await memory.getIndex();
      expect(index.entries).toHaveLength(1);
      expect(index.entries[0].description).toBe('Updated');
    });

    it('should track size correctly', async () => {
      await memory.store('small', 'Small data', 'hello');
      await memory.store('large', 'Large data', { data: 'x'.repeat(1000) });

      const index = await memory.getIndex();
      expect(index.totalSizeBytes).toBeGreaterThan(1000);
    });

    it('should emit warning at soft limit', async () => {
      const onWarning = vi.fn();
      memory.on('limit_warning', onWarning);

      // Fill to 85% of 10KB
      await memory.store('big', 'Big data', { data: 'x'.repeat(8500) });

      expect(onWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          utilizationPercent: expect.any(Number),
        })
      );
    });

    it('should reject store when over hard limit', async () => {
      // Fill completely
      await memory.store('full', 'Full', { data: 'x'.repeat(9000) });

      // Try to add more
      await expect(memory.store('overflow', 'Overflow', { data: 'x'.repeat(2000) })).rejects.toThrow(
        'Memory limit exceeded'
      );
    });

    it('should set default scope as task', async () => {
      await memory.store('test', 'Test', { v: 1 });

      const entry = await storage.get('test');
      expect(entry?.scope).toBe('task');
    });

    it('should allow specifying scope', async () => {
      await memory.store('test', 'Test', { v: 1 }, 'persistent');

      const entry = await storage.get('test');
      expect(entry?.scope).toBe('persistent');
    });

    it('should validate key format', async () => {
      await expect(memory.store('', 'Test', {})).rejects.toThrow();
      await expect(memory.store('.invalid', 'Test', {})).rejects.toThrow();
      await expect(memory.store('invalid key', 'Test', {})).rejects.toThrow();
    });

    it('should store complex nested objects', async () => {
      const complex = {
        user: {
          name: 'John',
          orders: [
            { id: 1, items: ['a', 'b'] },
            { id: 2, items: ['c', 'd'] },
          ],
        },
        metadata: { created: Date.now() },
      };

      await memory.store('complex', 'Complex nested data', complex);
      const retrieved = await memory.retrieve('complex');

      expect(retrieved).toEqual(complex);
    });

    it('should store arrays', async () => {
      const arr = [1, 2, 3, { nested: true }];

      await memory.store('array', 'Array data', arr);
      const retrieved = await memory.retrieve('array');

      expect(retrieved).toEqual(arr);
    });

    it('should store primitive values', async () => {
      await memory.store('string', 'String value', 'hello');
      await memory.store('number', 'Number value', 42);
      await memory.store('boolean', 'Boolean value', true);

      expect(await memory.retrieve('string')).toBe('hello');
      expect(await memory.retrieve('number')).toBe(42);
      expect(await memory.retrieve('boolean')).toBe(true);
    });
  });

  describe('retrieve', () => {
    it('should retrieve stored value', async () => {
      await memory.store('key', 'Test', { value: 42 });

      const result = await memory.retrieve('key');
      expect(result).toEqual({ value: 42 });
    });

    it('should return undefined for missing key', async () => {
      const result = await memory.retrieve('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should update access time and count', async () => {
      await memory.store('key', 'Test', { value: 1 });

      const before = await storage.get('key');
      await memory.retrieve('key');
      await memory.retrieve('key');
      const after = await storage.get('key');

      expect(after!.accessCount).toBe(2);
      expect(after!.lastAccessedAt).toBeGreaterThanOrEqual(before!.lastAccessedAt);
    });

    it('should not throw for invalid key format', async () => {
      // Should just return undefined, not throw
      const result = await memory.retrieve('any-key-format');
      expect(result).toBeUndefined();
    });
  });

  describe('retrieveMany', () => {
    it('should retrieve multiple values', async () => {
      await memory.store('a', 'A', 1);
      await memory.store('b', 'B', 2);
      await memory.store('c', 'C', 3);

      const result = await memory.retrieveMany(['a', 'c']);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should skip missing keys', async () => {
      await memory.store('a', 'A', 1);

      const result = await memory.retrieveMany(['a', 'missing']);
      expect(result).toEqual({ a: 1 });
    });

    it('should return empty object for all missing keys', async () => {
      const result = await memory.retrieveMany(['missing1', 'missing2']);
      expect(result).toEqual({});
    });

    it('should update access stats for all retrieved keys', async () => {
      await memory.store('a', 'A', 1);
      await memory.store('b', 'B', 2);

      await memory.retrieveMany(['a', 'b']);

      const entryA = await storage.get('a');
      const entryB = await storage.get('b');

      expect(entryA!.accessCount).toBe(1);
      expect(entryB!.accessCount).toBe(1);
    });
  });

  describe('delete', () => {
    it('should delete entry', async () => {
      await memory.store('key', 'Test', { value: 1 });
      await memory.delete('key');

      const result = await memory.retrieve('key');
      expect(result).toBeUndefined();

      const index = await memory.getIndex();
      expect(index.entries).toHaveLength(0);
    });

    it('should not throw for missing key', async () => {
      await expect(memory.delete('nonexistent')).resolves.not.toThrow();
    });

    it('should update size after delete', async () => {
      await memory.store('key', 'Test', { data: 'x'.repeat(1000) });
      const before = await memory.getIndex();

      await memory.delete('key');
      const after = await memory.getIndex();

      expect(after.totalSizeBytes).toBeLessThan(before.totalSizeBytes);
    });
  });

  describe('has', () => {
    it('should return true for existing key', async () => {
      await memory.store('key', 'Test', { value: 1 });
      expect(await memory.has('key')).toBe(true);
    });

    it('should return false for missing key', async () => {
      expect(await memory.has('nonexistent')).toBe(false);
    });
  });

  describe('persist', () => {
    it('should change scope from task to persistent', async () => {
      await memory.store('key', 'Test', { value: 1 });

      const before = await storage.get('key');
      expect(before!.scope).toBe('task');

      await memory.persist('key');

      const after = await storage.get('key');
      expect(after!.scope).toBe('persistent');
    });

    it('should throw for nonexistent key', async () => {
      await expect(memory.persist('nonexistent')).rejects.toThrow();
    });

    it('should be idempotent', async () => {
      await memory.store('key', 'Test', { value: 1 }, 'persistent');

      // Should not throw when already persistent
      await expect(memory.persist('key')).resolves.not.toThrow();

      const entry = await storage.get('key');
      expect(entry!.scope).toBe('persistent');
    });
  });

  describe('clearScope', () => {
    it('should clear only task-scoped entries', async () => {
      await memory.store('task1', 'Task 1', 1);
      await memory.store('task2', 'Task 2', 2);
      await memory.store('persist1', 'Persist', 3, 'persistent');

      await memory.clearScope('task');

      expect(await memory.retrieve('task1')).toBeUndefined();
      expect(await memory.retrieve('task2')).toBeUndefined();
      expect(await memory.retrieve('persist1')).toBe(3);
    });

    it('should clear only persistent entries', async () => {
      await memory.store('task1', 'Task 1', 1);
      await memory.store('persist1', 'Persist 1', 2, 'persistent');
      await memory.store('persist2', 'Persist 2', 3, 'persistent');

      await memory.clearScope('persistent');

      expect(await memory.retrieve('task1')).toBe(1);
      expect(await memory.retrieve('persist1')).toBeUndefined();
      expect(await memory.retrieve('persist2')).toBeUndefined();
    });

    it('should update index after clear', async () => {
      await memory.store('task1', 'Task 1', 1);
      await memory.store('task2', 'Task 2', 2);

      await memory.clearScope('task');

      const index = await memory.getIndex();
      expect(index.entries).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await memory.store('task1', 'Task 1', 1);
      await memory.store('persist1', 'Persist', 2, 'persistent');

      await memory.clear();

      expect(await memory.retrieve('task1')).toBeUndefined();
      expect(await memory.retrieve('persist1')).toBeUndefined();

      const index = await memory.getIndex();
      expect(index.entries).toHaveLength(0);
    });
  });

  describe('getIndex', () => {
    it('should return formatted index', async () => {
      await memory.store('user.profile', 'User data', { name: 'John' });
      await memory.store('order.items', 'Order items', [1, 2, 3]);

      const index = await memory.getIndex();

      expect(index.entries).toHaveLength(2);
      expect(index.totalSizeHuman).toMatch(/^\d+(\.\d+)?[KMG]?B$/);
      expect(index.limitHuman).toBe('10KB');
      expect(index.utilizationPercent).toBeGreaterThan(0);
    });

    it('should sort by scope (persistent first)', async () => {
      await memory.store('task1', 'Task', 1);
      await memory.store('persist1', 'Persist', 2, 'persistent');

      const index = await memory.getIndex();

      expect(index.entries[0].scope).toBe('persistent');
      expect(index.entries[1].scope).toBe('task');
    });

    it('should include human-readable sizes', async () => {
      await memory.store('test', 'Test data', { data: 'x'.repeat(100) });

      const index = await memory.getIndex();

      expect(index.entries[0].size).toMatch(/^\d+(\.\d+)?[KMG]?B$/);
    });
  });

  describe('evictLRU', () => {
    it('should evict least recently used entries', async () => {
      // Store entries with time gaps
      await memory.store('old', 'Old', { v: 1 });
      await new Promise((r) => setTimeout(r, 10));
      await memory.store('new', 'New', { v: 2 });

      // Access 'new' to make it recently used
      await memory.retrieve('new');

      // Force eviction of 1 entry
      const evicted = await memory.evictLRU(1);

      expect(evicted).toEqual(['old']);
      expect(await memory.retrieve('old')).toBeUndefined();
      expect(await memory.retrieve('new')).toEqual({ v: 2 });
    });

    it('should not evict persistent entries during LRU eviction', async () => {
      await memory.store('persistent', 'Persist', { v: 1 }, 'persistent');
      await memory.store('task', 'Task', { v: 2 });

      const evicted = await memory.evictLRU(1);

      expect(evicted).toEqual(['task']);
      expect(await memory.retrieve('persistent')).toEqual({ v: 1 });
    });

    it('should evict multiple entries when requested', async () => {
      await memory.store('a', 'A', 1);
      await new Promise((r) => setTimeout(r, 5));
      await memory.store('b', 'B', 2);
      await new Promise((r) => setTimeout(r, 5));
      await memory.store('c', 'C', 3);

      const evicted = await memory.evictLRU(2);

      expect(evicted).toHaveLength(2);
      expect(evicted).toContain('a');
      expect(evicted).toContain('b');
      expect(await memory.retrieve('c')).toBe(3);
    });

    it('should return empty array when nothing to evict', async () => {
      const evicted = await memory.evictLRU(1);
      expect(evicted).toEqual([]);
    });

    it('should return fewer entries if not enough available', async () => {
      await memory.store('only', 'Only one', 1);

      const evicted = await memory.evictLRU(5);

      expect(evicted).toEqual(['only']);
    });
  });

  describe('evictBySize', () => {
    it('should evict largest entries first', async () => {
      await memory.store('small', 'Small', 'x');
      await memory.store('large', 'Large', { data: 'x'.repeat(1000) });
      await memory.store('medium', 'Medium', { data: 'x'.repeat(100) });

      const evicted = await memory.evictBySize(1);

      expect(evicted).toEqual(['large']);
    });

    it('should not evict persistent entries', async () => {
      await memory.store('large', 'Large', { data: 'x'.repeat(1000) }, 'persistent');
      await memory.store('small', 'Small', 'x');

      const evicted = await memory.evictBySize(1);

      expect(evicted).toEqual(['small']);
      expect(await memory.retrieve('large')).toBeDefined();
    });
  });

  describe('getAccess', () => {
    it('should return limited memory access for tools', async () => {
      const access = memory.getAccess();

      expect(typeof access.get).toBe('function');
      expect(typeof access.set).toBe('function');
      expect(typeof access.delete).toBe('function');
    });

    it('should allow get through access', async () => {
      await memory.store('key', 'Test', { v: 1 });

      const access = memory.getAccess();
      const value = await access.get('key');

      expect(value).toEqual({ v: 1 });
    });

    it('should allow set through access', async () => {
      const access = memory.getAccess();
      await access.set('key', 'Test', { v: 1 });

      const value = await memory.retrieve('key');
      expect(value).toEqual({ v: 1 });
    });

    it('should allow delete through access', async () => {
      await memory.store('key', 'Test', { v: 1 });

      const access = memory.getAccess();
      await access.delete('key');

      expect(await memory.retrieve('key')).toBeUndefined();
    });
  });

  describe('events', () => {
    it('should emit stored event', async () => {
      const onStored = vi.fn();
      memory.on('stored', onStored);

      await memory.store('key', 'Test', { v: 1 });

      expect(onStored).toHaveBeenCalledWith({ key: 'key', description: 'Test' });
    });

    it('should emit retrieved event', async () => {
      await memory.store('key', 'Test', { v: 1 });

      const onRetrieved = vi.fn();
      memory.on('retrieved', onRetrieved);

      await memory.retrieve('key');

      expect(onRetrieved).toHaveBeenCalledWith({ key: 'key' });
    });

    it('should emit deleted event', async () => {
      await memory.store('key', 'Test', { v: 1 });

      const onDeleted = vi.fn();
      memory.on('deleted', onDeleted);

      await memory.delete('key');

      expect(onDeleted).toHaveBeenCalledWith({ key: 'key' });
    });

    it('should emit limit_warning when approaching limit', async () => {
      const onWarning = vi.fn();
      memory.on('limit_warning', onWarning);

      // Store data to exceed soft limit (80%)
      await memory.store('big', 'Big', { data: 'x'.repeat(8500) });

      expect(onWarning).toHaveBeenCalled();
    });
  });

  describe('formatIndex', () => {
    it('should return formatted string for context injection', async () => {
      await memory.store('user.profile', 'User data with name and email', { name: 'John' });
      await memory.store('order.items', 'Current order items', [1, 2, 3]);

      const formatted = await memory.formatIndex();

      expect(formatted).toContain('Working Memory');
      expect(formatted).toContain('user.profile');
      expect(formatted).toContain('User data with name and email');
      expect(formatted).toContain('order.items');
      expect(formatted).toContain('memory_retrieve');
    });
  });

  describe('calculateLimit', () => {
    it('should use explicit maxSizeBytes when provided', () => {
      const mem = new WorkingMemory(storage, { ...defaultConfig, maxSizeBytes: 50000 });
      expect(mem.getLimit()).toBe(50000);
    });

    it('should calculate limit from model context size when not provided', () => {
      const mem = new WorkingMemory(storage, {
        ...DEFAULT_MEMORY_CONFIG,
        // No maxSizeBytes
      });

      // Should fall back to some default
      expect(mem.getLimit()).toBeGreaterThan(0);
    });
  });
});
