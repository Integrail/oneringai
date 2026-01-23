/**
 * IdempotencyCache Tests
 * Tests for tool call caching and deduplication
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdempotencyCache, IdempotencyCacheConfig } from '@/capabilities/taskAgent/IdempotencyCache.js';
import { ToolFunction } from '@/domain/entities/Tool.js';

describe('IdempotencyCache', () => {
  let cache: IdempotencyCache;

  const defaultConfig: IdempotencyCacheConfig = {
    defaultTtlMs: 1000,
    maxEntries: 100,
  };

  beforeEach(() => {
    cache = new IdempotencyCache(defaultConfig);
  });

  const createTool = (name: string, idempotency?: ToolFunction['idempotency']): ToolFunction => ({
    definition: {
      type: 'function',
      function: {
        name,
        description: 'Test tool',
        parameters: { type: 'object', properties: {} },
      },
    },
    execute: async () => ({}),
    idempotency,
  });

  describe('constructor', () => {
    it('should create instance with config', () => {
      expect(cache).toBeDefined();
    });

    it('should use defaults when not provided', () => {
      const c = new IdempotencyCache();
      expect(c).toBeDefined();
    });
  });

  describe('get', () => {
    it('should return undefined for cache miss', async () => {
      const tool = createTool('test', { safe: false });
      const result = await cache.get(tool, { arg: 1 });
      expect(result).toBeUndefined();
    });

    it('should return cached value for cache hit', async () => {
      const tool = createTool('test', { safe: false });
      const args = { arg: 1 };
      const value = { result: 'cached' };

      await cache.set(tool, args, value);
      const result = await cache.get(tool, args);

      expect(result).toEqual(value);
    });

    it('should return undefined after TTL expires', async () => {
      const tool = createTool('test', { safe: false, ttlMs: 50 });
      await cache.set(tool, { arg: 1 }, { result: 'cached' });

      await new Promise((r) => setTimeout(r, 100));

      const result = await cache.get(tool, { arg: 1 });
      expect(result).toBeUndefined();
    });

    it('should use default TTL when tool does not specify', async () => {
      const tool = createTool('test', { safe: false }); // No ttlMs
      await cache.set(tool, { arg: 1 }, { result: 'cached' });

      // Should still be cached (default is 1000ms)
      const result = await cache.get(tool, { arg: 1 });
      expect(result).toEqual({ result: 'cached' });
    });

    it('should not return cached value for safe tools', async () => {
      const tool = createTool('test', { safe: true });

      await cache.set(tool, { arg: 1 }, { result: 'cached' });

      // Safe tools don't need caching - they're naturally idempotent
      const result = await cache.get(tool, { arg: 1 });
      expect(result).toBeUndefined();
    });

    it('should not return cached value for tools without idempotency config', async () => {
      const tool = createTool('test'); // No idempotency config

      await cache.set(tool, { arg: 1 }, { result: 'cached' });

      const result = await cache.get(tool, { arg: 1 });
      expect(result).toBeUndefined();
    });
  });

  describe('set', () => {
    it('should cache value', async () => {
      const tool = createTool('test', { safe: false });
      await cache.set(tool, { arg: 1 }, { result: 1 });

      const result = await cache.get(tool, { arg: 1 });
      expect(result).toEqual({ result: 1 });
    });

    it('should use custom key function', async () => {
      const tool = createTool('test', {
        safe: false,
        keyFn: (args) => `custom-${args.id}`,
      });

      await cache.set(tool, { id: 123, other: 'ignored' }, { result: 1 });

      // Same id, different other field - should hit cache
      const result = await cache.get(tool, { id: 123, other: 'different' });
      expect(result).toEqual({ result: 1 });
    });

    it('should use default key (hash of args) when no keyFn', async () => {
      const tool = createTool('test', { safe: false });

      await cache.set(tool, { a: 1, b: 2 }, { result: 1 });

      // Same args = cache hit
      const hit = await cache.get(tool, { a: 1, b: 2 });
      expect(hit).toEqual({ result: 1 });

      // Different args = cache miss
      const miss = await cache.get(tool, { a: 1, b: 3 });
      expect(miss).toBeUndefined();
    });

    it('should not cache safe tools', async () => {
      const tool = createTool('test', { safe: true });

      await cache.set(tool, { arg: 1 }, { result: 'should not cache' });

      // Check internal state - should not have cached
      const result = await cache.get(tool, { arg: 1 });
      expect(result).toBeUndefined();
    });

    it('should overwrite existing cached value', async () => {
      const tool = createTool('test', { safe: false });

      await cache.set(tool, { arg: 1 }, { result: 'first' });
      await cache.set(tool, { arg: 1 }, { result: 'second' });

      const result = await cache.get(tool, { arg: 1 });
      expect(result).toEqual({ result: 'second' });
    });

    it('should handle different tools with same args', async () => {
      const tool1 = createTool('tool1', { safe: false });
      const tool2 = createTool('tool2', { safe: false });

      await cache.set(tool1, { arg: 1 }, { result: 'from tool1' });
      await cache.set(tool2, { arg: 1 }, { result: 'from tool2' });

      expect(await cache.get(tool1, { arg: 1 })).toEqual({ result: 'from tool1' });
      expect(await cache.get(tool2, { arg: 1 })).toEqual({ result: 'from tool2' });
    });

    it('should cache complex result objects', async () => {
      const tool = createTool('test', { safe: false });
      const complexResult = {
        users: [{ id: 1, name: 'John' }],
        meta: { total: 1, page: 1 },
        nested: { deep: { value: true } },
      };

      await cache.set(tool, { arg: 1 }, complexResult);

      const result = await cache.get(tool, { arg: 1 });
      expect(result).toEqual(complexResult);
    });

    it('should handle null and undefined results', async () => {
      const tool = createTool('test', { safe: false });

      await cache.set(tool, { arg: 'null' }, null);
      await cache.set(tool, { arg: 'undefined' }, undefined);

      expect(await cache.get(tool, { arg: 'null' })).toBeNull();
      expect(await cache.get(tool, { arg: 'undefined' })).toBeUndefined();
    });
  });

  describe('invalidate', () => {
    it('should remove entry from cache', async () => {
      const tool = createTool('test', { safe: false });
      await cache.set(tool, { arg: 1 }, { result: 'cached' });

      await cache.invalidate(tool, { arg: 1 });

      const result = await cache.get(tool, { arg: 1 });
      expect(result).toBeUndefined();
    });

    it('should not throw for missing entry', async () => {
      const tool = createTool('test', { safe: false });
      await expect(cache.invalidate(tool, { arg: 1 })).resolves.not.toThrow();
    });

    it('should only invalidate specific entry', async () => {
      const tool = createTool('test', { safe: false });
      await cache.set(tool, { arg: 1 }, { result: 1 });
      await cache.set(tool, { arg: 2 }, { result: 2 });

      await cache.invalidate(tool, { arg: 1 });

      expect(await cache.get(tool, { arg: 1 })).toBeUndefined();
      expect(await cache.get(tool, { arg: 2 })).toEqual({ result: 2 });
    });
  });

  describe('invalidateTool', () => {
    it('should remove all entries for a tool', async () => {
      const tool = createTool('test', { safe: false });
      await cache.set(tool, { arg: 1 }, { result: 1 });
      await cache.set(tool, { arg: 2 }, { result: 2 });

      await cache.invalidateTool(tool);

      expect(await cache.get(tool, { arg: 1 })).toBeUndefined();
      expect(await cache.get(tool, { arg: 2 })).toBeUndefined();
    });

    it('should not affect other tools', async () => {
      const tool1 = createTool('tool1', { safe: false });
      const tool2 = createTool('tool2', { safe: false });

      await cache.set(tool1, { arg: 1 }, { result: 'tool1' });
      await cache.set(tool2, { arg: 1 }, { result: 'tool2' });

      await cache.invalidateTool(tool1);

      expect(await cache.get(tool1, { arg: 1 })).toBeUndefined();
      expect(await cache.get(tool2, { arg: 1 })).toEqual({ result: 'tool2' });
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      const tool = createTool('test', { safe: false });
      await cache.set(tool, { arg: 1 }, { result: 1 });
      await cache.set(tool, { arg: 2 }, { result: 2 });

      await cache.clear();

      expect(await cache.get(tool, { arg: 1 })).toBeUndefined();
      expect(await cache.get(tool, { arg: 2 })).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for cached entry', async () => {
      const tool = createTool('test', { safe: false });
      await cache.set(tool, { arg: 1 }, { result: 1 });

      expect(await cache.has(tool, { arg: 1 })).toBe(true);
    });

    it('should return false for missing entry', async () => {
      const tool = createTool('test', { safe: false });
      expect(await cache.has(tool, { arg: 1 })).toBe(false);
    });

    it('should return false after TTL expires', async () => {
      const tool = createTool('test', { safe: false, ttlMs: 50 });
      await cache.set(tool, { arg: 1 }, { result: 1 });

      await new Promise((r) => setTimeout(r, 100));

      expect(await cache.has(tool, { arg: 1 })).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const tool = createTool('test', { safe: false });
      await cache.set(tool, { arg: 1 }, { result: 1 });
      await cache.set(tool, { arg: 2 }, { result: 2 });

      const stats = cache.getStats();

      expect(stats.entries).toBe(2);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should track hits and misses', async () => {
      const tool = createTool('test', { safe: false });
      await cache.set(tool, { arg: 1 }, { result: 1 });

      await cache.get(tool, { arg: 1 }); // hit
      await cache.get(tool, { arg: 1 }); // hit
      await cache.get(tool, { arg: 2 }); // miss

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('should calculate hit rate', async () => {
      const tool = createTool('test', { safe: false });
      await cache.set(tool, { arg: 1 }, { result: 1 });

      await cache.get(tool, { arg: 1 }); // hit
      await cache.get(tool, { arg: 2 }); // miss
      await cache.get(tool, { arg: 1 }); // hit
      await cache.get(tool, { arg: 3 }); // miss

      const stats = cache.getStats();

      expect(stats.hitRate).toBe(0.5); // 2 hits / 4 total
    });
  });

  describe('maxEntries', () => {
    it('should evict oldest entries when max reached', async () => {
      const smallCache = new IdempotencyCache({ defaultTtlMs: 10000, maxEntries: 3 });
      const tool = createTool('test', { safe: false });

      await smallCache.set(tool, { arg: 1 }, { result: 1 });
      await smallCache.set(tool, { arg: 2 }, { result: 2 });
      await smallCache.set(tool, { arg: 3 }, { result: 3 });
      await smallCache.set(tool, { arg: 4 }, { result: 4 }); // Should evict arg:1

      expect(await smallCache.get(tool, { arg: 1 })).toBeUndefined();
      expect(await smallCache.get(tool, { arg: 4 })).toEqual({ result: 4 });
    });
  });

  describe('generateKey', () => {
    it('should generate consistent keys for same args', () => {
      const tool = createTool('test', { safe: false });
      const args = { a: 1, b: 2 };

      const key1 = cache.generateKey(tool, args);
      const key2 = cache.generateKey(tool, args);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different args', () => {
      const tool = createTool('test', { safe: false });

      const key1 = cache.generateKey(tool, { a: 1 });
      const key2 = cache.generateKey(tool, { a: 2 });

      expect(key1).not.toBe(key2);
    });

    it('should handle arg order consistently', () => {
      const tool = createTool('test', { safe: false });

      const key1 = cache.generateKey(tool, { a: 1, b: 2 });
      const key2 = cache.generateKey(tool, { b: 2, a: 1 });

      expect(key1).toBe(key2);
    });

    it('should use custom keyFn when provided', () => {
      const tool = createTool('test', {
        safe: false,
        keyFn: (args) => `custom:${args.id}`,
      });

      const key = cache.generateKey(tool, { id: 123, ignored: 'value' });

      expect(key).toContain('custom:123');
    });
  });
});
