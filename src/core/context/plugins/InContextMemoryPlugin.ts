/**
 * InContextMemoryPlugin - In-context memory for frequently-accessed state
 *
 * Unlike WorkingMemory (which stores data externally with an index in context),
 * InContextMemory stores key-value pairs DIRECTLY in the LLM context.
 * This is for small, frequently-updated state that the LLM needs instant access to.
 *
 * Key Difference:
 * - WorkingMemory: External storage + index in context → requires memory_retrieve()
 * - InContextMemory: Full values in context → instant access, no retrieval needed
 */

import { BaseContextPlugin } from './IContextPlugin.js';
import type { IContextComponent, ITokenEstimator } from '../types.js';

/**
 * Priority levels for in-context memory entries
 */
export type InContextPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * An entry stored in InContextMemory
 */
export interface InContextEntry {
  /** Unique key for this entry */
  key: string;
  /** Human-readable description */
  description: string;
  /** The actual value (any JSON-serializable data) */
  value: unknown;
  /** When this entry was last updated */
  updatedAt: number;
  /** Eviction priority (low entries are evicted first) */
  priority: InContextPriority;
}

/**
 * Configuration for InContextMemoryPlugin
 */
export interface InContextMemoryConfig {
  /** Maximum number of entries (default: 20) */
  maxEntries?: number;
  /** Maximum total tokens for all entries (default: 4000) */
  maxTotalTokens?: number;
  /** Default priority for new entries (default: 'normal') */
  defaultPriority?: InContextPriority;
  /** Whether to show timestamps in output (default: false) */
  showTimestamps?: boolean;
  /** Header text for the context section (default: '## Live Context') */
  headerText?: string;
}

/**
 * Serialized state for session persistence
 */
export interface SerializedInContextMemoryState {
  entries: InContextEntry[];
  config: InContextMemoryConfig;
}

/**
 * Priority values for sorting (lower = evict first)
 */
const PRIORITY_VALUES: Record<InContextPriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4,
};

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<InContextMemoryConfig> = {
  maxEntries: 20,
  maxTotalTokens: 4000,
  defaultPriority: 'normal',
  showTimestamps: false,
  headerText: '## Live Context',
};

/**
 * InContextMemoryPlugin - Stores key-value pairs directly in LLM context
 *
 * Use this for:
 * - Current state/status that changes frequently
 * - User preferences during a session
 * - Small accumulated results
 * - Counters, flags, or control variables
 *
 * Do NOT use this for:
 * - Large data (use WorkingMemory instead)
 * - Data that doesn't need instant access
 * - Rarely accessed reference data
 */
export class InContextMemoryPlugin extends BaseContextPlugin {
  readonly name = 'in_context_memory';
  readonly priority = 5; // Medium priority for compaction
  readonly compactable = true;

  private entries: Map<string, InContextEntry> = new Map();
  private config: Required<InContextMemoryConfig>;
  private destroyed = false;

  /**
   * Create an InContextMemoryPlugin
   *
   * @param config - Configuration options
   */
  constructor(config: InContextMemoryConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if plugin is destroyed
   */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  // ============ Entry Management ============

  /**
   * Store or update a key-value pair
   *
   * @param key - Unique key for this entry
   * @param description - Human-readable description (shown in context)
   * @param value - The value to store (any JSON-serializable data)
   * @param priority - Eviction priority (default from config)
   */
  set(key: string, description: string, value: unknown, priority?: InContextPriority): void {
    this.assertNotDestroyed();

    const entry: InContextEntry = {
      key,
      description,
      value,
      updatedAt: Date.now(),
      priority: priority ?? this.config.defaultPriority,
    };

    this.entries.set(key, entry);

    // Enforce max entries limit (evict if necessary)
    this.enforceMaxEntries();
  }

  /**
   * Get a value by key
   *
   * @param key - The key to retrieve
   * @returns The value, or undefined if not found
   */
  get(key: string): unknown | undefined {
    this.assertNotDestroyed();
    return this.entries.get(key)?.value;
  }

  /**
   * Check if a key exists
   *
   * @param key - The key to check
   */
  has(key: string): boolean {
    this.assertNotDestroyed();
    return this.entries.has(key);
  }

  /**
   * Delete an entry by key
   *
   * @param key - The key to delete
   * @returns true if the key existed and was deleted
   */
  delete(key: string): boolean {
    this.assertNotDestroyed();
    return this.entries.delete(key);
  }

  /**
   * List all entries with metadata
   *
   * @returns Array of entry metadata (without full values)
   */
  list(): Array<{ key: string; description: string; priority: InContextPriority; updatedAt: number }> {
    this.assertNotDestroyed();
    return Array.from(this.entries.values()).map((e) => ({
      key: e.key,
      description: e.description,
      priority: e.priority,
      updatedAt: e.updatedAt,
    }));
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.assertNotDestroyed();
    this.entries.clear();
  }

  /**
   * Get the number of entries
   */
  get size(): number {
    return this.entries.size;
  }

  // ============ IContextPlugin Implementation ============

  /**
   * Get the context component for this plugin
   */
  async getComponent(): Promise<IContextComponent | null> {
    this.assertNotDestroyed();

    if (this.entries.size === 0) {
      return null;
    }

    const content = this.formatContent();

    return {
      name: this.name,
      content,
      priority: this.priority,
      compactable: this.compactable,
      metadata: {
        entryCount: this.entries.size,
      },
    };
  }

  /**
   * Compact by evicting low-priority entries
   *
   * Eviction order: low → normal → high (critical is never auto-evicted)
   * Within same priority, oldest entries are evicted first
   *
   * @param targetTokens - Target token count to reduce to
   * @param estimator - Token estimator
   * @returns Number of tokens freed
   */
  override async compact(targetTokens: number, estimator: ITokenEstimator): Promise<number> {
    this.assertNotDestroyed();

    const beforeContent = this.formatContent();
    const beforeTokens = estimator.estimateTokens(beforeContent);

    if (beforeTokens <= targetTokens) {
      return 0; // Already under target
    }

    // Sort entries by eviction priority (lowest first, then oldest)
    const sortedEntries = this.getSortedEntriesForEviction();

    // Evict entries until we're under target
    for (const entry of sortedEntries) {
      // Never auto-evict critical entries
      if (entry.priority === 'critical') {
        break;
      }

      this.entries.delete(entry.key);

      const currentContent = this.formatContent();
      const currentTokens = estimator.estimateTokens(currentContent);

      if (currentTokens <= targetTokens) {
        break;
      }
    }

    const afterContent = this.formatContent();
    const afterTokens = estimator.estimateTokens(afterContent);

    return Math.max(0, beforeTokens - afterTokens);
  }

  /**
   * Get serialized state for session persistence
   */
  override getState(): SerializedInContextMemoryState {
    return {
      entries: Array.from(this.entries.values()),
      config: this.config,
    };
  }

  /**
   * Restore state from serialization
   *
   * @param state - Previously serialized state
   */
  override restoreState(state: unknown): void {
    this.assertNotDestroyed();

    if (!state || typeof state !== 'object') {
      return;
    }

    const typedState = state as SerializedInContextMemoryState;

    if (typedState.entries && Array.isArray(typedState.entries)) {
      this.entries.clear();
      for (const entry of typedState.entries) {
        if (entry.key && typeof entry.key === 'string') {
          this.entries.set(entry.key, entry);
        }
      }
    }

    if (typedState.config && typeof typedState.config === 'object') {
      this.config = { ...DEFAULT_CONFIG, ...typedState.config };
    }
  }

  /**
   * Clean up resources
   */
  override destroy(): void {
    this.entries.clear();
    this.destroyed = true;
  }

  // ============ Private Methods ============

  /**
   * Format entries as markdown for context
   */
  private formatContent(): string {
    if (this.entries.size === 0) {
      return '';
    }

    const lines: string[] = [
      this.config.headerText,
      'Data below is always current. Use directly - no retrieval needed.',
      '',
    ];

    for (const entry of this.entries.values()) {
      lines.push(`### ${entry.key}`);
      lines.push(entry.description);

      // Format value as JSON code block
      const valueStr = typeof entry.value === 'string'
        ? entry.value
        : JSON.stringify(entry.value, null, 2);

      lines.push('```json');
      lines.push(valueStr);
      lines.push('```');

      if (this.config.showTimestamps) {
        const date = new Date(entry.updatedAt);
        lines.push(`_Updated: ${date.toISOString()}_`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get entries sorted by eviction priority (lowest priority first, then oldest)
   */
  private getSortedEntriesForEviction(): InContextEntry[] {
    return Array.from(this.entries.values()).sort((a, b) => {
      // First by priority (lower value = evict first)
      const priorityDiff = PRIORITY_VALUES[a.priority] - PRIORITY_VALUES[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      // Then by age (older first)
      return a.updatedAt - b.updatedAt;
    });
  }

  /**
   * Enforce max entries limit by evicting lowest-priority entries
   */
  private enforceMaxEntries(): void {
    if (this.entries.size <= this.config.maxEntries) {
      return;
    }

    const sorted = this.getSortedEntriesForEviction();

    while (this.entries.size > this.config.maxEntries && sorted.length > 0) {
      const toEvict = sorted.shift()!;

      // Don't evict critical entries even for max limit
      if (toEvict.priority === 'critical') {
        break;
      }

      this.entries.delete(toEvict.key);
    }
  }

  /**
   * Assert that the plugin hasn't been destroyed
   */
  private assertNotDestroyed(): void {
    if (this.destroyed) {
      throw new Error('InContextMemoryPlugin has been destroyed');
    }
  }
}
