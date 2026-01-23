/**
 * WorkingMemory class - manages indexed working memory for TaskAgent
 */

import EventEmitter from 'eventemitter3';
import { IMemoryStorage } from '../../domain/interfaces/IMemoryStorage.js';
import { WorkingMemoryAccess } from '../../domain/interfaces/IToolContext.js';
import {
  MemoryIndex,
  MemoryScope,
  WorkingMemoryConfig,
  DEFAULT_MEMORY_CONFIG,
} from '../../domain/entities/Memory.js';

export interface WorkingMemoryEvents {
  stored: { key: string; description: string };
  retrieved: { key: string };
  deleted: { key: string };
  limit_warning: { utilizationPercent: number };
}

/**
 * WorkingMemory manages the agent's indexed working memory.
 *
 * Features:
 * - Store/retrieve with descriptions for index
 * - Scoped memory (task vs persistent)
 * - LRU eviction when approaching limits
 * - Event emission for monitoring
 */
export class WorkingMemory extends EventEmitter<WorkingMemoryEvents> {
  private storage: IMemoryStorage;
  private config: WorkingMemoryConfig;

  constructor(storage: IMemoryStorage, config: WorkingMemoryConfig = DEFAULT_MEMORY_CONFIG) {
    super();
    this.storage = storage;
    this.config = config;
  }

  /**
   * Store a value in working memory
   */
  async store(
    key: string,
    description: string,
    value: unknown,
    scope: MemoryScope = 'task'
  ): Promise<void> {
    const { createMemoryEntry } = await import('../../domain/entities/Memory.js');

    // Validate and create entry
    const entry = createMemoryEntry({ key, description, value, scope }, this.config);

    // Check size limit
    const currentSize = await this.storage.getTotalSize();
    const existing = await this.storage.get(key);
    const existingSize = existing?.sizeBytes ?? 0;
    const newTotalSize = currentSize - existingSize + entry.sizeBytes;

    const limit = this.getLimit();

    if (newTotalSize > limit) {
      throw new Error(`Memory limit exceeded: ${newTotalSize} bytes > ${limit} bytes`);
    }

    // Check soft limit warning
    const utilization = (newTotalSize / limit) * 100;
    if (utilization > this.config.softLimitPercent) {
      this.emit('limit_warning', { utilizationPercent: utilization });
    }

    // Store entry
    await this.storage.set(key, entry);

    this.emit('stored', { key, description });
  }

  /**
   * Retrieve a value from working memory
   */
  async retrieve(key: string): Promise<unknown> {
    const entry = await this.storage.get(key);
    if (!entry) {
      return undefined;
    }

    // Update access stats
    entry.lastAccessedAt = Date.now();
    entry.accessCount += 1;
    await this.storage.set(key, entry);

    this.emit('retrieved', { key });

    return entry.value;
  }

  /**
   * Retrieve multiple values
   */
  async retrieveMany(keys: string[]): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    for (const key of keys) {
      const value = await this.retrieve(key);
      if (value !== undefined) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Delete a value from working memory
   */
  async delete(key: string): Promise<void> {
    await this.storage.delete(key);
    this.emit('deleted', { key });
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  /**
   * Promote a task-scoped entry to persistent
   */
  async persist(key: string): Promise<void> {
    const entry = await this.storage.get(key);
    if (!entry) {
      throw new Error(`Key "${key}" not found in memory`);
    }

    if (entry.scope !== 'persistent') {
      entry.scope = 'persistent';
      await this.storage.set(key, entry);
    }
  }

  /**
   * Clear all entries of a specific scope
   */
  async clearScope(scope: MemoryScope): Promise<void> {
    await this.storage.clearScope(scope);
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    await this.storage.clear();
  }

  /**
   * Get memory index
   */
  async getIndex(): Promise<MemoryIndex> {
    const { formatSizeHuman } = await import('../../domain/entities/Memory.js');

    const entries = await this.storage.getAll();
    const totalSizeBytes = await this.storage.getTotalSize();
    const limitBytes = this.getLimit();

    // Sort by scope (persistent first)
    const sortedEntries = entries.sort((a, b) => {
      if (a.scope === 'persistent' && b.scope !== 'persistent') return -1;
      if (a.scope !== 'persistent' && b.scope === 'persistent') return 1;
      return 0;
    });

    const indexEntries = sortedEntries.map((entry) => ({
      key: entry.key,
      description: entry.description,
      size: formatSizeHuman(entry.sizeBytes),
      scope: entry.scope,
    }));

    return {
      entries: indexEntries,
      totalSizeBytes,
      totalSizeHuman: formatSizeHuman(totalSizeBytes),
      limitBytes,
      limitHuman: formatSizeHuman(limitBytes),
      utilizationPercent: (totalSizeBytes / limitBytes) * 100,
    };
  }

  /**
   * Format index for context injection
   */
  async formatIndex(): Promise<string> {
    const { formatMemoryIndex } = await import('../../domain/entities/Memory.js');
    const index = await this.getIndex();
    return formatMemoryIndex(index);
  }

  /**
   * Evict least recently used entries
   */
  async evictLRU(count: number): Promise<string[]> {
    const entries = await this.storage.getAll();

    // Only evict task-scoped entries
    const evictable = entries
      .filter((entry) => entry.scope === 'task')
      .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

    const toEvict = evictable.slice(0, count);
    const evictedKeys: string[] = [];

    for (const entry of toEvict) {
      await this.storage.delete(entry.key);
      evictedKeys.push(entry.key);
    }

    return evictedKeys;
  }

  /**
   * Evict largest entries first
   */
  async evictBySize(count: number): Promise<string[]> {
    const entries = await this.storage.getAll();

    // Only evict task-scoped entries
    const evictable = entries
      .filter((entry) => entry.scope === 'task')
      .sort((a, b) => b.sizeBytes - a.sizeBytes);

    const toEvict = evictable.slice(0, count);
    const evictedKeys: string[] = [];

    for (const entry of toEvict) {
      await this.storage.delete(entry.key);
      evictedKeys.push(entry.key);
    }

    return evictedKeys;
  }

  /**
   * Get limited memory access for tools
   */
  getAccess(): WorkingMemoryAccess {
    return {
      get: async (key: string) => this.retrieve(key),
      set: async (key: string, description: string, value: unknown) =>
        this.store(key, description, value),
      delete: async (key: string) => this.delete(key),
      has: async (key: string) => this.has(key),
      list: async () => {
        const index = await this.getIndex();
        return index.entries.map((e) => ({ key: e.key, description: e.description }));
      },
    };
  }

  /**
   * Get the configured memory limit
   */
  getLimit(): number {
    return this.config.maxSizeBytes ?? 512 * 1024; // Default 512KB
  }
}

export { WorkingMemoryConfig, DEFAULT_MEMORY_CONFIG };
