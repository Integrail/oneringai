/**
 * Memory Entity Tests
 * Tests for MemoryEntry, MemoryIndex, and related utilities
 */

import { describe, it, expect } from 'vitest';
import {
  MemoryEntry,
  MemoryIndex,
  MemoryIndexEntry,
  MemoryScope,
  WorkingMemoryConfig,
  createMemoryEntry,
  calculateEntrySize,
  formatMemoryIndex,
  formatSizeHuman,
  validateMemoryKey,
  DEFAULT_MEMORY_CONFIG,
} from '@/domain/entities/Memory.js';

describe('Memory Entities', () => {
  describe('createMemoryEntry', () => {
    it('should create entry with required fields', () => {
      const entry = createMemoryEntry({
        key: 'user.profile',
        description: 'User profile data',
        value: { id: '123', name: 'John' },
      });

      expect(entry.key).toBe('user.profile');
      expect(entry.description).toBe('User profile data');
      expect(entry.value).toEqual({ id: '123', name: 'John' });
      expect(entry.scope).toBe('session'); // default
      expect(entry.sizeBytes).toBeGreaterThan(0);
      expect(entry.createdAt).toBeDefined();
      expect(entry.lastAccessedAt).toBeDefined();
      expect(entry.accessCount).toBe(0);
    });

    it('should enforce description max length', () => {
      const longDescription = 'a'.repeat(200);

      expect(() =>
        createMemoryEntry({
          key: 'test',
          description: longDescription,
          value: {},
        })
      ).toThrow('Description exceeds maximum length of 150 characters');
    });

    it('should allow custom max length via config', () => {
      const longDescription = 'a'.repeat(200);

      // Should not throw with higher limit
      expect(() =>
        createMemoryEntry(
          {
            key: 'test',
            description: longDescription,
            value: {},
          },
          { ...DEFAULT_MEMORY_CONFIG, descriptionMaxLength: 250 }
        )
      ).not.toThrow();
    });

    it('should set scope correctly', () => {
      const taskEntry = createMemoryEntry({
        key: 'temp',
        description: 'test',
        value: {},
        scope: 'task',
      });

      const persistentEntry = createMemoryEntry({
        key: 'config',
        description: 'test',
        value: {},
        scope: 'persistent',
      });

      expect(taskEntry.scope).toBe('task');
      expect(persistentEntry.scope).toBe('persistent');
    });

    it('should calculate size correctly', () => {
      const entry = createMemoryEntry({
        key: 'test',
        description: 'test',
        value: { data: 'hello world' },
      });

      // Size should be based on JSON serialization of value
      const expectedSize = JSON.stringify({ data: 'hello world' }).length;
      expect(entry.sizeBytes).toBe(expectedSize);
    });

    it('should set timestamps', () => {
      const before = Date.now();
      const entry = createMemoryEntry({
        key: 'test',
        description: 'test',
        value: {},
      });
      const after = Date.now();

      expect(entry.createdAt).toBeGreaterThanOrEqual(before);
      expect(entry.createdAt).toBeLessThanOrEqual(after);
      expect(entry.lastAccessedAt).toBe(entry.createdAt);
    });

    it('should initialize accessCount to 0', () => {
      const entry = createMemoryEntry({
        key: 'test',
        description: 'test',
        value: {},
      });

      expect(entry.accessCount).toBe(0);
    });
  });

  describe('validateMemoryKey', () => {
    it('should accept valid simple keys', () => {
      expect(() => validateMemoryKey('simple')).not.toThrow();
      expect(() => validateMemoryKey('with_underscore')).not.toThrow();
      expect(() => validateMemoryKey('with-dash')).not.toThrow();
      expect(() => validateMemoryKey('withNumber123')).not.toThrow();
    });

    it('should accept valid namespaced keys', () => {
      expect(() => validateMemoryKey('user.profile')).not.toThrow();
      expect(() => validateMemoryKey('order.items.123')).not.toThrow();
      expect(() => validateMemoryKey('api.response.data')).not.toThrow();
    });

    it('should reject empty keys', () => {
      expect(() => validateMemoryKey('')).toThrow('Memory key cannot be empty');
    });

    it('should reject keys starting with dot', () => {
      expect(() => validateMemoryKey('.invalid')).toThrow('Invalid memory key format');
    });

    it('should reject keys ending with dot', () => {
      expect(() => validateMemoryKey('invalid.')).toThrow('Invalid memory key format');
    });

    it('should reject keys with consecutive dots', () => {
      expect(() => validateMemoryKey('invalid..key')).toThrow('Invalid memory key format');
    });

    it('should reject keys with spaces', () => {
      expect(() => validateMemoryKey('invalid key')).toThrow('Invalid memory key format');
    });

    it('should reject keys with special characters', () => {
      expect(() => validateMemoryKey('invalid@key')).toThrow('Invalid memory key format');
      expect(() => validateMemoryKey('invalid#key')).toThrow('Invalid memory key format');
      expect(() => validateMemoryKey('invalid$key')).toThrow('Invalid memory key format');
    });
  });

  describe('calculateEntrySize', () => {
    it('should calculate size for primitive values', () => {
      expect(calculateEntrySize('hello')).toBe(7); // "hello" with quotes
      expect(calculateEntrySize(12345)).toBe(5);
      expect(calculateEntrySize(true)).toBe(4);
      expect(calculateEntrySize(false)).toBe(5);
      expect(calculateEntrySize(null)).toBe(4);
    });

    it('should calculate size for objects', () => {
      const obj = { name: 'John', age: 30 };
      const size = calculateEntrySize(obj);
      expect(size).toBe(JSON.stringify(obj).length);
    });

    it('should calculate size for arrays', () => {
      const arr = [1, 2, 3, 4, 5];
      const size = calculateEntrySize(arr);
      expect(size).toBe(JSON.stringify(arr).length);
    });

    it('should handle nested structures', () => {
      const nested = {
        user: { name: 'John', orders: [{ id: 1 }, { id: 2 }] },
      };
      const size = calculateEntrySize(nested);
      expect(size).toBe(JSON.stringify(nested).length);
    });

    it('should handle undefined', () => {
      expect(calculateEntrySize(undefined)).toBe(0);
    });

    it('should handle empty objects', () => {
      expect(calculateEntrySize({})).toBe(2); // {}
    });

    it('should handle empty arrays', () => {
      expect(calculateEntrySize([])).toBe(2); // []
    });

    it('should handle large objects', () => {
      const large = { data: 'x'.repeat(10000) };
      const size = calculateEntrySize(large);
      expect(size).toBeGreaterThan(10000);
    });
  });

  describe('formatSizeHuman', () => {
    it('should format bytes', () => {
      expect(formatSizeHuman(0)).toBe('0B');
      expect(formatSizeHuman(100)).toBe('100B');
      expect(formatSizeHuman(999)).toBe('999B');
    });

    it('should format kilobytes', () => {
      expect(formatSizeHuman(1024)).toBe('1KB');
      expect(formatSizeHuman(1536)).toBe('1.5KB');
      expect(formatSizeHuman(10240)).toBe('10KB');
    });

    it('should format megabytes', () => {
      expect(formatSizeHuman(1048576)).toBe('1MB');
      expect(formatSizeHuman(1572864)).toBe('1.5MB');
    });

    it('should format with appropriate precision', () => {
      expect(formatSizeHuman(1234)).toBe('1.2KB');
      expect(formatSizeHuman(12345)).toBe('12.1KB');
    });
  });

  describe('formatMemoryIndex', () => {
    it('should format empty index', () => {
      const index: MemoryIndex = {
        entries: [],
        totalSizeBytes: 0,
        totalSizeHuman: '0B',
        limitBytes: 1024 * 1024,
        limitHuman: '1MB',
        utilizationPercent: 0,
      };

      const formatted = formatMemoryIndex(index);
      expect(formatted).toContain('Working Memory');
      expect(formatted).toContain('0B / 1MB');
      expect(formatted).toContain('0%');
      expect(formatted).toContain('empty');
    });

    it('should format index with entries', () => {
      const index: MemoryIndex = {
        entries: [
          { key: 'user.profile', description: 'User data', size: '1.2KB', scope: 'persistent', effectivePriority: 'high', pinned: false },
          { key: 'order.current', description: 'Current order', size: '3.5KB', scope: 'session', effectivePriority: 'normal', pinned: false },
        ],
        totalSizeBytes: 4812,
        totalSizeHuman: '4.7KB',
        limitBytes: 1024 * 1024,
        limitHuman: '1MB',
        utilizationPercent: 0.47,
      };

      const formatted = formatMemoryIndex(index);
      expect(formatted).toContain('user.profile');
      expect(formatted).toContain('User data');
      expect(formatted).toContain('1.2KB');
      expect(formatted).toContain('persistent');
      expect(formatted).toContain('order.current');
      expect(formatted).toContain('session');
    });

    it('should group by priority with higher priority first', () => {
      const index: MemoryIndex = {
        entries: [
          { key: 'low1', description: 'Low', size: '100B', scope: 'session', effectivePriority: 'low', pinned: false },
          { key: 'high1', description: 'High', size: '200B', scope: 'session', effectivePriority: 'high', pinned: false },
        ],
        totalSizeBytes: 300,
        totalSizeHuman: '300B',
        limitBytes: 1024,
        limitHuman: '1KB',
        utilizationPercent: 29.3,
      };

      const formatted = formatMemoryIndex(index);
      const highIndex = formatted.indexOf('High priority');
      const lowIndex = formatted.indexOf('Low priority');
      expect(highIndex).toBeLessThan(lowIndex);
    });

    it('should put pinned entries first', () => {
      const index: MemoryIndex = {
        entries: [
          { key: 'normal', description: 'Normal', size: '100B', scope: 'session', effectivePriority: 'normal', pinned: false },
          { key: 'pinned', description: 'Pinned', size: '200B', scope: 'session', effectivePriority: 'critical', pinned: true },
        ],
        totalSizeBytes: 300,
        totalSizeHuman: '300B',
        limitBytes: 1024,
        limitHuman: '1KB',
        utilizationPercent: 29.3,
      };

      const formatted = formatMemoryIndex(index);
      const pinnedIndex = formatted.indexOf('Pinned (never evicted)');
      const normalIndex = formatted.indexOf('Normal priority');
      expect(pinnedIndex).toBeLessThan(normalIndex);
    });

    it('should include utilization percentage', () => {
      const index: MemoryIndex = {
        entries: [{ key: 'test', description: 'Test', size: '512KB', scope: 'session', effectivePriority: 'normal', pinned: false }],
        totalSizeBytes: 524288,
        totalSizeHuman: '512KB',
        limitBytes: 1048576,
        limitHuman: '1MB',
        utilizationPercent: 50,
      };

      const formatted = formatMemoryIndex(index);
      expect(formatted).toContain('50%');
    });

    it('should show warning when utilization is high', () => {
      const index: MemoryIndex = {
        entries: [{ key: 'test', description: 'Test', size: '900KB', scope: 'task' }],
        totalSizeBytes: 921600,
        totalSizeHuman: '900KB',
        limitBytes: 1048576,
        limitHuman: '1MB',
        utilizationPercent: 88,
      };

      const formatted = formatMemoryIndex(index);
      expect(formatted).toMatch(/warning|high|approaching limit/i);
    });

    it('should include retrieve instruction', () => {
      const index: MemoryIndex = {
        entries: [{ key: 'test', description: 'Test', size: '100B', scope: 'task' }],
        totalSizeBytes: 100,
        totalSizeHuman: '100B',
        limitBytes: 1024,
        limitHuman: '1KB',
        utilizationPercent: 10,
      };

      const formatted = formatMemoryIndex(index);
      expect(formatted).toContain('memory_retrieve');
    });
  });

  describe('MemoryScope type', () => {
    it('should only allow valid scopes', () => {
      const taskScope: MemoryScope = 'task';
      const persistentScope: MemoryScope = 'persistent';

      expect(taskScope).toBe('task');
      expect(persistentScope).toBe('persistent');
    });
  });

  describe('DEFAULT_MEMORY_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_MEMORY_CONFIG.descriptionMaxLength).toBe(150);
      expect(DEFAULT_MEMORY_CONFIG.softLimitPercent).toBe(80);
      expect(DEFAULT_MEMORY_CONFIG.contextAllocationPercent).toBe(20);
    });
  });

  describe('WorkingMemoryConfig type', () => {
    it('should allow all configuration options', () => {
      const config: WorkingMemoryConfig = {
        maxSizeBytes: 1024 * 1024,
        descriptionMaxLength: 200,
        softLimitPercent: 75,
        contextAllocationPercent: 25,
      };

      expect(config.maxSizeBytes).toBe(1024 * 1024);
      expect(config.descriptionMaxLength).toBe(200);
      expect(config.softLimitPercent).toBe(75);
      expect(config.contextAllocationPercent).toBe(25);
    });

    it('should allow optional maxSizeBytes', () => {
      const config: WorkingMemoryConfig = {
        descriptionMaxLength: 150,
        softLimitPercent: 80,
        contextAllocationPercent: 20,
      };

      expect(config.maxSizeBytes).toBeUndefined();
    });
  });
});
