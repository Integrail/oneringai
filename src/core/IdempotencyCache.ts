/**
 * IdempotencyCache - caches tool call results for deduplication
 *
 * General-purpose cache for tool results. Used by AgentContext to avoid
 * duplicate tool calls with the same arguments.
 *
 * Features:
 * - Cache based on tool name + args hash
 * - Custom key generation per tool (via tool.idempotency.keyFn)
 * - TTL-based expiration
 * - Max entries eviction (LRU)
 */

import { ToolFunction } from '../domain/entities/Tool.js';

/**
 * Cache configuration
 */
export interface IdempotencyCacheConfig {
  /** Default TTL for cached entries */
  defaultTtlMs: number;

  /** Max entries before eviction */
  maxEntries: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  entries: number;
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * Default configuration
 */
export const DEFAULT_IDEMPOTENCY_CONFIG: IdempotencyCacheConfig = {
  defaultTtlMs: 3600000, // 1 hour
  maxEntries: 1000,
};

/**
 * IdempotencyCache handles tool call result caching.
 *
 * Features:
 * - Cache based on tool name + args
 * - Custom key generation per tool
 * - TTL-based expiration
 * - Max entries eviction
 */
export class IdempotencyCache {
  private config: IdempotencyCacheConfig;
  private cache = new Map<string, { value: unknown; expiresAt: number }>();
  private hits = 0;
  private misses = 0;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: IdempotencyCacheConfig = DEFAULT_IDEMPOTENCY_CONFIG) {
    this.config = config;

    // Start background cleanup (every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.pruneExpired();
    }, 300000);
  }

  /**
   * Check if a tool's results should be cached.
   * Prefers 'cacheable' field, falls back to inverted 'safe' for backward compatibility.
   *
   * Logic:
   * - If 'cacheable' is defined, use it directly
   * - If only 'safe' is defined, cache when safe=false (backward compat)
   * - If neither defined, don't cache
   */
  private shouldCache(tool: ToolFunction): boolean {
    const idempotency = tool.idempotency;
    if (!idempotency) return false;

    // Prefer 'cacheable' if defined
    if (idempotency.cacheable !== undefined) {
      return idempotency.cacheable;
    }

    // Fall back to deprecated 'safe' (cache when safe=false)
    if (idempotency.safe !== undefined) {
      return !idempotency.safe;
    }

    return false;
  }

  /**
   * Get cached result for tool call
   */
  async get(tool: ToolFunction, args: Record<string, unknown>): Promise<unknown> {
    // Don't cache if tool doesn't need caching
    if (!this.shouldCache(tool)) {
      this.misses++;
      return undefined;
    }

    const key = this.generateKey(tool, args);
    const cached = this.cache.get(key);

    if (!cached) {
      this.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return cached.value;
  }

  /**
   * Cache result for tool call
   */
  async set(tool: ToolFunction, args: Record<string, unknown>, result: unknown): Promise<void> {
    // Don't cache if tool doesn't need caching
    if (!this.shouldCache(tool)) {
      return;
    }

    const key = this.generateKey(tool, args);
    const ttl = tool.idempotency?.ttlMs ?? this.config.defaultTtlMs;
    const expiresAt = Date.now() + ttl;

    this.cache.set(key, { value: result, expiresAt });

    // Evict oldest if over max entries
    if (this.cache.size > this.config.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * Check if tool call is cached
   */
  async has(tool: ToolFunction, args: Record<string, unknown>): Promise<boolean> {
    // Don't check cache if tool doesn't need caching
    if (!this.shouldCache(tool)) {
      return false;
    }

    const key = this.generateKey(tool, args);
    const cached = this.cache.get(key);

    if (!cached) {
      return false;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Invalidate cached result
   */
  async invalidate(tool: ToolFunction, args: Record<string, unknown>): Promise<void> {
    if (!tool.idempotency) {
      return;
    }

    const key = this.generateKey(tool, args);
    this.cache.delete(key);
  }

  /**
   * Invalidate all cached results for a tool
   */
  async invalidateTool(tool: ToolFunction): Promise<void> {
    const toolName = tool.definition.function.name;

    // Find all keys for this tool
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${toolName}:`)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Prune expired entries from cache
   */
  pruneExpired(): number {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.cache.delete(key));
    return toDelete.length;
  }

  /**
   * Clear all cached results
   */
  async clear(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      entries: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }

  /**
   * Generate cache key for tool + args
   */
  generateKey(tool: ToolFunction, args: Record<string, unknown>): string {
    const toolName = tool.definition.function.name;

    // Use custom key function if provided
    if (tool.idempotency?.keyFn) {
      return `${toolName}:${tool.idempotency.keyFn(args)}`;
    }

    // Default: hash of sorted args
    const sortedArgs = Object.keys(args)
      .sort()
      .reduce((obj, key) => {
        obj[key] = args[key];
        return obj;
      }, {} as Record<string, unknown>);

    const argsHash = this.hashObject(sortedArgs);
    return `${toolName}:${argsHash}`;
  }

  /**
   * Simple hash function for objects
   */
  private hashObject(obj: unknown): string {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}
