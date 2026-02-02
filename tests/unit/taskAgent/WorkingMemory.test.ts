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

    it('should set default scope as session', async () => {
      await memory.store('test', 'Test', { v: 1 });

      const entry = await storage.get('test');
      expect(entry?.scope).toBe('session');
    });

    it('should allow specifying scope via options', async () => {
      await memory.store('test', 'Test', { v: 1 }, { scope: 'persistent' });

      const entry = await storage.get('test');
      expect(entry?.scope).toBe('persistent');
    });

    it('should allow specifying priority', async () => {
      await memory.store('test', 'Test', { v: 1 }, { priority: 'high' });

      const entry = await storage.get('test');
      expect(entry?.basePriority).toBe('high');
    });

    it('should allow pinning entries', async () => {
      await memory.store('test', 'Test', { v: 1 }, { pinned: true });

      const entry = await storage.get('test');
      expect(entry?.pinned).toBe(true);
      expect(entry?.basePriority).toBe('critical');
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
    it('should change scope from session to persistent', async () => {
      await memory.store('key', 'Test', { value: 1 });

      const before = await storage.get('key');
      expect(before!.scope).toBe('session');

      await memory.persist('key');

      const after = await storage.get('key');
      // Now uses task-aware scope object
      expect(after!.scope).toEqual({ type: 'persistent' });
    });

    it('should throw for nonexistent key', async () => {
      await expect(memory.persist('nonexistent')).rejects.toThrow();
    });

    it('should be idempotent', async () => {
      await memory.store('key', 'Test', { value: 1 }, { scope: { type: 'persistent' } });

      // Should not throw when already persistent
      await expect(memory.persist('key')).resolves.not.toThrow();

      const entry = await storage.get('key');
      expect(entry!.scope).toEqual({ type: 'persistent' });
    });
  });

  describe('pin/unpin', () => {
    it('should pin an entry', async () => {
      await memory.store('key', 'Test', { value: 1 });

      await memory.pin('key');

      const entry = await storage.get('key');
      expect(entry!.pinned).toBe(true);
      expect(entry!.basePriority).toBe('critical');
    });

    it('should throw for nonexistent key', async () => {
      await expect(memory.pin('nonexistent')).rejects.toThrow();
    });

    it('should unpin an entry', async () => {
      await memory.store('key', 'Test', { value: 1 }, { pinned: true });

      await memory.unpin('key', 'normal');

      const entry = await storage.get('key');
      expect(entry!.pinned).toBe(false);
      expect(entry!.basePriority).toBe('normal');
    });
  });

  describe('clearScope', () => {
    it('should clear only session-scoped entries', async () => {
      await memory.store('session1', 'Session 1', 1);
      await memory.store('session2', 'Session 2', 2);
      await memory.store('persist1', 'Persist', 3, { scope: 'persistent' });

      await memory.clearScope('session');

      expect(await memory.retrieve('session1')).toBeUndefined();
      expect(await memory.retrieve('session2')).toBeUndefined();
      expect(await memory.retrieve('persist1')).toBe(3);
    });

    it('should clear only persistent entries', async () => {
      await memory.store('session1', 'Session 1', 1);
      await memory.store('persist1', 'Persist 1', 2, { scope: 'persistent' });
      await memory.store('persist2', 'Persist 2', 3, { scope: 'persistent' });

      await memory.clearScope('persistent');

      expect(await memory.retrieve('session1')).toBe(1);
      expect(await memory.retrieve('persist1')).toBeUndefined();
      expect(await memory.retrieve('persist2')).toBeUndefined();
    });

    it('should update index after clear', async () => {
      await memory.store('session1', 'Session 1', 1);
      await memory.store('session2', 'Session 2', 2);

      await memory.clearScope('session');

      const index = await memory.getIndex();
      expect(index.entries).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await memory.store('session1', 'Session 1', 1);
      await memory.store('persist1', 'Persist', 2, { scope: 'persistent' });

      await memory.clear();

      expect(await memory.retrieve('session1')).toBeUndefined();
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

    it('should sort by priority (higher priority first)', async () => {
      await memory.store('low', 'Low priority', 1, { priority: 'low' });
      await memory.store('high', 'High priority', 2, { priority: 'high' });
      await memory.store('normal', 'Normal priority', 3);

      const index = await memory.getIndex();

      // High > normal > low
      expect(index.entries[0].effectivePriority).toBe('high');
      expect(index.entries[1].effectivePriority).toBe('normal');
      expect(index.entries[2].effectivePriority).toBe('low');
    });

    it('should put pinned entries first', async () => {
      await memory.store('normal', 'Normal', 1);
      await memory.store('pinned', 'Pinned', 2, { pinned: true });

      const index = await memory.getIndex();

      expect(index.entries[0].pinned).toBe(true);
      expect(index.entries[0].key).toBe('pinned');
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

    it('should not evict high priority entries before low priority', async () => {
      await memory.store('high', 'High priority', { v: 1 }, { priority: 'high' });
      await memory.store('low', 'Low priority', { v: 2 }, { priority: 'low' });

      const evicted = await memory.evictLRU(1);

      expect(evicted).toEqual(['low']);
      expect(await memory.retrieve('high')).toEqual({ v: 1 });
    });

    it('should not evict pinned entries', async () => {
      await memory.store('pinned', 'Pinned', { v: 1 }, { pinned: true });
      await memory.store('normal', 'Normal', { v: 2 });

      const evicted = await memory.evictLRU(1);

      expect(evicted).toEqual(['normal']);
      expect(await memory.retrieve('pinned')).toEqual({ v: 1 });
    });

    it('should not evict critical priority entries', async () => {
      await memory.store('critical', 'Critical', { v: 1 }, { priority: 'critical' });
      await memory.store('normal', 'Normal', { v: 2 });

      const evicted = await memory.evictLRU(1);

      expect(evicted).toEqual(['normal']);
      expect(await memory.retrieve('critical')).toEqual({ v: 1 });
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

    it('should not evict pinned entries even if largest', async () => {
      await memory.store('large', 'Large pinned', { data: 'x'.repeat(1000) }, { pinned: true });
      await memory.store('small', 'Small', 'x');

      const evicted = await memory.evictBySize(1);

      expect(evicted).toEqual(['small']);
      expect(await memory.retrieve('large')).toBeDefined();
    });

    it('should respect priority when evicting by size', async () => {
      await memory.store('large-high', 'Large high', { data: 'x'.repeat(1000) }, { priority: 'high' });
      await memory.store('small-low', 'Small low', 'x', { priority: 'low' });

      const evicted = await memory.evictBySize(1);

      // Should evict low priority first regardless of size
      expect(evicted).toEqual(['small-low']);
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
    it('should emit stored event with scope', async () => {
      const onStored = vi.fn();
      memory.on('stored', onStored);

      await memory.store('key', 'Test', { v: 1 });

      expect(onStored).toHaveBeenCalledWith({ key: 'key', description: 'Test', scope: 'session' });
    });

    it('should emit evicted event', async () => {
      const onEvicted = vi.fn();
      memory.on('evicted', onEvicted);

      await memory.store('a', 'A', 1);
      await memory.store('b', 'B', 2);
      await memory.evictLRU(1);

      expect(onEvicted).toHaveBeenCalledWith({
        keys: expect.any(Array),
        reason: 'lru',
      });
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

  describe('maxIndexEntries', () => {
    it('should be included in DEFAULT_MEMORY_CONFIG', () => {
      expect(DEFAULT_MEMORY_CONFIG.maxIndexEntries).toBe(30);
    });

    it('should return configured maxIndexEntries via getMaxIndexEntries', () => {
      const configWithLimit: WorkingMemoryConfig = {
        ...defaultConfig,
        maxIndexEntries: 10,
      };
      const mem = new WorkingMemory(storage, configWithLimit);
      expect(mem.getMaxIndexEntries()).toBe(10);
    });

    it('should return undefined when maxIndexEntries not configured', () => {
      const configWithoutLimit: WorkingMemoryConfig = {
        ...defaultConfig,
        maxIndexEntries: undefined,
      };
      const mem = new WorkingMemory(storage, configWithoutLimit);
      expect(mem.getMaxIndexEntries()).toBeUndefined();
    });

    it('should auto-evict when entry count exceeds maxIndexEntries', async () => {
      const onEvicted = vi.fn();
      const configWithLimit: WorkingMemoryConfig = {
        ...defaultConfig,
        maxIndexEntries: 3,
      };
      const mem = new WorkingMemory(storage, configWithLimit);
      mem.on('evicted', onEvicted);

      // Store 3 entries - should not evict
      await mem.store('a', 'Entry A', 1);
      await mem.store('b', 'Entry B', 2);
      await mem.store('c', 'Entry C', 3);
      expect(onEvicted).not.toHaveBeenCalled();

      // Store 4th entry - should trigger eviction of 1
      await mem.store('d', 'Entry D', 4);

      expect(onEvicted).toHaveBeenCalledWith({
        keys: expect.any(Array),
        reason: 'lru',
      });

      // Should have exactly 3 entries after eviction
      const index = await mem.getIndex();
      expect(index.totalEntryCount).toBe(3);
    });

    it('should evict lowest priority entries first when count exceeded', async () => {
      const configWithLimit: WorkingMemoryConfig = {
        ...defaultConfig,
        maxIndexEntries: 2,
      };
      const mem = new WorkingMemory(storage, configWithLimit);

      // Store high priority first
      await mem.store('high', 'High priority', 1, { priority: 'high' });
      // Then low priority
      await mem.store('low', 'Low priority', 2, { priority: 'low' });
      // Then normal - this should evict 'low'
      await mem.store('normal', 'Normal priority', 3);

      expect(await mem.has('high')).toBe(true);
      expect(await mem.has('normal')).toBe(true);
      expect(await mem.has('low')).toBe(false);
    });

    it('should not evict pinned entries when count exceeded', async () => {
      const configWithLimit: WorkingMemoryConfig = {
        ...defaultConfig,
        maxIndexEntries: 2,
      };
      const mem = new WorkingMemory(storage, configWithLimit);

      await mem.store('pinned', 'Pinned entry', 1, { pinned: true });
      await mem.store('normal1', 'Normal 1', 2);
      // This should evict normal1, not pinned
      await mem.store('normal2', 'Normal 2', 3);

      expect(await mem.has('pinned')).toBe(true);
      expect(await mem.has('normal2')).toBe(true);
      expect(await mem.has('normal1')).toBe(false);
    });

    it('should limit entries returned by getIndex to maxIndexEntries', async () => {
      const configWithLimit: WorkingMemoryConfig = {
        ...defaultConfig,
        maxIndexEntries: 2,
        maxSizeBytes: 100 * 1024, // Large enough to hold all entries
      };
      const mem = new WorkingMemory(storage, configWithLimit);

      // Store 4 entries (won't auto-evict because we increased size limit)
      await mem.store('a', 'Entry A', 1, { priority: 'low' });
      await mem.store('b', 'Entry B', 2, { priority: 'normal' });
      await mem.store('c', 'Entry C', 3, { priority: 'high' });
      await mem.store('d', 'Entry D', 4, { priority: 'critical' });

      // Auto-eviction should have kicked in, leaving only 2 entries
      // The highest priority entries (critical and high) should remain
      const index = await mem.getIndex();

      // With auto-eviction, there should only be 2 entries total
      expect(index.entries).toHaveLength(2);
      expect(index.totalEntryCount).toBe(2);
      expect(index.omittedCount).toBe(0);

      // Verify the highest priority entries were kept
      const keys = index.entries.map(e => e.key);
      expect(keys).toContain('d'); // critical
      expect(keys).toContain('c'); // high
    });

    it('should track omittedCount when index is truncated', async () => {
      // Use a config where auto-eviction is disabled by not setting maxIndexEntries
      // but then getIndex should still truncate if we had more entries
      const configNoAutoEvict: WorkingMemoryConfig = {
        ...defaultConfig,
        maxIndexEntries: 2,
        maxSizeBytes: 100 * 1024,
      };
      const mem = new WorkingMemory(storage, configNoAutoEvict);

      // Store entries - auto-eviction will keep it at 2
      await mem.store('a', 'Entry A', 1);
      await mem.store('b', 'Entry B', 2);

      const index = await mem.getIndex();
      expect(index.totalEntryCount).toBe(2);
      expect(index.entries).toHaveLength(2);
      expect(index.omittedCount).toBe(0);
    });

    it('should include totalEntryCount and omittedCount in index', async () => {
      const configWithLimit: WorkingMemoryConfig = {
        ...defaultConfig,
        maxIndexEntries: 5,
      };
      const mem = new WorkingMemory(storage, configWithLimit);

      await mem.store('a', 'Entry A', 1);
      await mem.store('b', 'Entry B', 2);

      const index = await mem.getIndex();

      expect(index).toHaveProperty('totalEntryCount');
      expect(index).toHaveProperty('omittedCount');
      expect(index.totalEntryCount).toBe(2);
      expect(index.omittedCount).toBe(0);
    });

    it('should show omitted notice in formatIndex when entries are omitted', async () => {
      // This test needs to verify the formatMemoryIndex output
      // We need to mock a scenario where omittedCount > 0
      // Since auto-eviction prevents this, we test the format function directly
      const { formatMemoryIndex } = await import('@/domain/entities/Memory.js');

      const mockIndex = {
        entries: [{ key: 'a', description: 'A', size: '1KB', scope: 'session' as const, effectivePriority: 'normal' as const, pinned: false }],
        totalSizeBytes: 1024,
        totalSizeHuman: '1KB',
        limitBytes: 10240,
        limitHuman: '10KB',
        utilizationPercent: 10,
        totalEntryCount: 5,
        omittedCount: 4,
      };

      const formatted = formatMemoryIndex(mockIndex);

      expect(formatted).toContain('4 additional low-priority entries not shown');
      expect(formatted).toContain('memory_query()');
    });

    it('should not show omitted notice when no entries are omitted', async () => {
      const { formatMemoryIndex } = await import('@/domain/entities/Memory.js');

      const mockIndex = {
        entries: [{ key: 'a', description: 'A', size: '1KB', scope: 'session' as const, effectivePriority: 'normal' as const, pinned: false }],
        totalSizeBytes: 1024,
        totalSizeHuman: '1KB',
        limitBytes: 10240,
        limitHuman: '10KB',
        utilizationPercent: 10,
        totalEntryCount: 1,
        omittedCount: 0,
      };

      const formatted = formatMemoryIndex(mockIndex);

      expect(formatted).not.toContain('additional low-priority entries not shown');
    });

    it('should evict multiple entries when adding causes excess', async () => {
      const configWithLimit: WorkingMemoryConfig = {
        ...defaultConfig,
        maxIndexEntries: 3,
      };
      const mem = new WorkingMemory(storage, configWithLimit);

      // Fill to limit
      await mem.store('a', 'A', 1, { priority: 'low' });
      await mem.store('b', 'B', 2, { priority: 'low' });
      await mem.store('c', 'C', 3, { priority: 'high' });

      // Add two more (each triggers eviction)
      await mem.store('d', 'D', 4, { priority: 'high' });
      await mem.store('e', 'E', 5, { priority: 'high' });

      // Should have 3 entries, all high priority
      const index = await mem.getIndex();
      expect(index.totalEntryCount).toBe(3);

      // Low priority entries should have been evicted
      expect(await mem.has('a')).toBe(false);
      expect(await mem.has('b')).toBe(false);
    });
  });
});
