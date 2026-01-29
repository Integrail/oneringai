/**
 * MemoryPlugin - Provides working memory index for TaskAgent and UniversalAgent
 *
 * The memory index shows the LLM what data is stored in working memory.
 * This is compactable - when space is needed, entries can be evicted.
 */

import { BaseContextPlugin } from './IContextPlugin.js';
import type { IContextComponent, ITokenEstimator } from '../types.js';
import type { WorkingMemory } from '../../../capabilities/taskAgent/WorkingMemory.js';

/**
 * Serialized memory plugin state
 * Note: The actual memory content is stored by WorkingMemory itself,
 * this plugin just holds a reference.
 */
export interface SerializedMemoryPluginState {
  // Memory plugin doesn't have its own state - WorkingMemory handles persistence
}

/**
 * Memory plugin for context management
 *
 * Provides the working memory index as a context component.
 * When compaction is needed, it evicts least-important entries.
 */
export class MemoryPlugin extends BaseContextPlugin {
  readonly name = 'memory_index';
  readonly priority = 8; // Higher = more likely to compact
  readonly compactable = true;

  private memory: WorkingMemory;
  private evictBatchSize: number;

  /**
   * Create a memory plugin
   *
   * @param memory - The WorkingMemory instance to wrap
   * @param evictBatchSize - How many entries to evict per compaction round (default: 3)
   */
  constructor(memory: WorkingMemory, evictBatchSize: number = 3) {
    super();
    this.memory = memory;
    this.evictBatchSize = evictBatchSize;
  }

  /**
   * Get the underlying WorkingMemory
   */
  getMemory(): WorkingMemory {
    return this.memory;
  }

  /**
   * Get component for context
   */
  async getComponent(): Promise<IContextComponent | null> {
    const index = await this.memory.formatIndex();

    // Return null if memory is empty (formatMemoryIndex returns "Memory is empty." when no entries)
    if (!index || index.trim().length === 0 || index.includes('Memory is empty.')) {
      return null;
    }

    const stats = await this.memory.getStats();

    return {
      name: this.name,
      content: index,
      priority: this.priority,
      compactable: this.compactable,
      metadata: {
        entryCount: stats.totalEntries,
        totalSizeBytes: stats.totalSizeBytes,
        utilizationPercent: stats.utilizationPercent,
      },
    };
  }

  /**
   * Compact by evicting least-important entries
   */
  override async compact(_targetTokens: number, estimator: ITokenEstimator): Promise<number> {
    // Get current token count
    const beforeIndex = await this.memory.formatIndex();
    const beforeTokens = estimator.estimateTokens(beforeIndex);

    // Evict entries using LRU strategy
    const evictedKeys = await this.memory.evict(this.evictBatchSize, 'lru');

    if (evictedKeys.length === 0) {
      return 0; // Nothing to evict
    }

    // Calculate tokens freed
    const afterIndex = await this.memory.formatIndex();
    const afterTokens = estimator.estimateTokens(afterIndex);

    return Math.max(0, beforeTokens - afterTokens);
  }

  /**
   * Clean up
   */
  override destroy(): void {
    // Memory cleanup is handled by WorkingMemory itself
  }

  // Memory state is managed by WorkingMemory, not this plugin
  override getState(): SerializedMemoryPluginState {
    return {};
  }

  override restoreState(_state: unknown): void {
    // No-op - memory state is managed by WorkingMemory
  }
}
