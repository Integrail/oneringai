/**
 * WorkingMemory class - manages indexed working memory for TaskAgent
 *
 * This is a GENERIC implementation that works across all agent types:
 * - Basic Agent: Uses staticPriorityCalculator with simple scopes
 * - TaskAgent: Uses taskAwarePriorityCalculator with task-aware scopes
 * - UniversalAgent: Can switch calculators based on mode
 *
 * The PriorityCalculator strategy pattern allows different agents to have
 * different eviction behaviors without changing the core WorkingMemory logic.
 */

import { EventEmitter } from 'eventemitter3';
import { IMemoryStorage } from '../../domain/interfaces/IMemoryStorage.js';
import { WorkingMemoryAccess } from '../../domain/interfaces/IToolContext.js';
import { IDisposable } from '../../domain/interfaces/IDisposable.js';
import type {
  MemoryIndex,
  MemoryScope,
  MemoryPriority,
  MemoryEntry,
  MemoryEntryInput,
  WorkingMemoryConfig,
  PriorityCalculator,
  PriorityContext,
  StaleEntryInfo,
  TaskStatusForMemory,
} from '../../domain/entities/Memory.js';
import {
  DEFAULT_MEMORY_CONFIG,
  staticPriorityCalculator,
  MEMORY_PRIORITY_VALUES,
  isSimpleScope,
  isTaskAwareScope,
  detectStaleEntries,
  createMemoryEntry,
  formatSizeHuman,
  formatMemoryIndex,
  isTerminalMemoryStatus,
  TIER_PRIORITIES,
  TIER_KEY_PREFIXES,
  getTierFromKey,
  addTierPrefix,
} from '../../domain/entities/Memory.js';
import type { MemoryTier, HierarchyMetadata } from '../../domain/entities/Memory.js';

/**
 * Serialized memory state for persistence
 */
export interface SerializedMemory {
  /** Memory format version */
  version: number;
  /** Serialized memory entries */
  entries: SerializedMemoryEntry[];
}

/**
 * Serialized memory entry
 */
export interface SerializedMemoryEntry {
  key: string;
  description: string;
  value: unknown;
  scope: MemoryScope;
  sizeBytes: number;
  basePriority?: MemoryPriority;
  pinned?: boolean;
}

/**
 * Eviction strategy type
 */
export type EvictionStrategy = 'lru' | 'size';

/**
 * Entry with computed effective priority
 */
interface EntryWithPriority {
  entry: MemoryEntry;
  effectivePriority: MemoryPriority;
}

export interface WorkingMemoryEvents {
  stored: { key: string; description: string; scope: MemoryScope };
  retrieved: { key: string };
  deleted: { key: string };
  evicted: { keys: string[]; reason: 'lru' | 'size' | 'task_completed' };
  limit_warning: { utilizationPercent: number };
  stale_entries: { entries: StaleEntryInfo[] };
}

/**
 * WorkingMemory manages the agent's indexed working memory.
 *
 * Features:
 * - Store/retrieve with descriptions for index
 * - Scoped memory (simple or task-aware)
 * - Priority-based eviction (respects pinned, priority, then LRU)
 * - Pluggable priority calculation via PriorityCalculator strategy
 * - Task completion detection and stale entry notification
 * - Event emission for monitoring
 */
export class WorkingMemory extends EventEmitter<WorkingMemoryEvents> implements IDisposable {
  private storage: IMemoryStorage;
  private config: WorkingMemoryConfig;
  private priorityCalculator: PriorityCalculator;
  private priorityContext: PriorityContext;
  private _isDestroyed = false;

  /**
   * Create a WorkingMemory instance
   *
   * @param storage - Storage backend for memory entries
   * @param config - Memory configuration (limits, etc.)
   * @param priorityCalculator - Strategy for computing effective priority (default: static)
   */
  constructor(
    storage: IMemoryStorage,
    config: WorkingMemoryConfig = DEFAULT_MEMORY_CONFIG,
    priorityCalculator: PriorityCalculator = staticPriorityCalculator
  ) {
    super();
    this.storage = storage;
    this.config = config;
    this.priorityCalculator = priorityCalculator;
    this.priorityContext = {};
  }

  /**
   * Set the priority calculator (for switching strategies at runtime)
   */
  setPriorityCalculator(calculator: PriorityCalculator): void {
    this.priorityCalculator = calculator;
  }

  /**
   * Update priority context (e.g., task states for TaskAgent)
   */
  setPriorityContext(context: PriorityContext): void {
    this.priorityContext = context;
  }

  /**
   * Get the current priority context
   */
  getPriorityContext(): PriorityContext {
    return this.priorityContext;
  }

  /**
   * Compute effective priority for an entry using the current calculator
   */
  private computeEffectivePriority(entry: MemoryEntry): MemoryPriority {
    return this.priorityCalculator(entry, this.priorityContext);
  }

  /**
   * Get all entries with their computed effective priorities
   * This is a performance optimization to avoid repeated getAll() + map() calls
   */
  private async getEntriesWithPriority(): Promise<EntryWithPriority[]> {
    const entries = await this.storage.getAll();
    return entries.map((entry) => ({
      entry,
      effectivePriority: this.computeEffectivePriority(entry),
    }));
  }

  /**
   * Get evictable entries sorted by eviction priority
   * Filters out pinned and critical entries, sorts by priority then by strategy
   */
  private getEvictableEntries(
    entriesWithPriority: EntryWithPriority[],
    strategy: EvictionStrategy
  ): EntryWithPriority[] {
    return entriesWithPriority
      .filter(({ entry, effectivePriority }) => {
        // Never evict pinned
        if (entry.pinned) return false;
        // Never evict critical priority
        if (effectivePriority === 'critical') return false;
        return true;
      })
      .sort((a, b) => {
        // Sort by priority first (lowest priority = evicted first)
        const priorityDiff =
          MEMORY_PRIORITY_VALUES[a.effectivePriority] -
          MEMORY_PRIORITY_VALUES[b.effectivePriority];
        if (priorityDiff !== 0) return priorityDiff;

        // Then by strategy
        if (strategy === 'lru') {
          return a.entry.lastAccessedAt - b.entry.lastAccessedAt;
        } else {
          // size: largest first
          return b.entry.sizeBytes - a.entry.sizeBytes;
        }
      });
  }

  /**
   * Store a value in working memory
   *
   * @param key - Unique key for the entry
   * @param description - Short description for the index (max 150 chars)
   * @param value - The data to store
   * @param options - Optional scope, priority, and pinned settings
   */
  async store(
    key: string,
    description: string,
    value: unknown,
    options?: {
      scope?: MemoryScope;
      priority?: MemoryPriority;
      pinned?: boolean;
    }
  ): Promise<void> {
    const input: MemoryEntryInput = {
      key,
      description,
      value,
      scope: options?.scope ?? 'session',
      priority: options?.priority,
      pinned: options?.pinned,
    };

    // Validate and create entry
    const entry = createMemoryEntry(input, this.config);

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

    this.emit('stored', { key, description, scope: entry.scope });
  }

  /**
   * Store a value scoped to specific tasks
   * Convenience method for task-aware memory
   */
  async storeForTasks(
    key: string,
    description: string,
    value: unknown,
    taskIds: string[],
    options?: { priority?: MemoryPriority; pinned?: boolean }
  ): Promise<void> {
    await this.store(key, description, value, {
      scope: { type: 'task', taskIds },
      priority: options?.priority,
      pinned: options?.pinned,
    });
  }

  /**
   * Store a value scoped to the entire plan
   * Convenience method for plan-scoped memory
   */
  async storeForPlan(
    key: string,
    description: string,
    value: unknown,
    options?: { priority?: MemoryPriority; pinned?: boolean }
  ): Promise<void> {
    await this.store(key, description, value, {
      scope: { type: 'plan' },
      priority: options?.priority,
      pinned: options?.pinned,
    });
  }

  /**
   * Retrieve a value from working memory
   *
   * Note: Access stats update is not strictly atomic. Under very high concurrency,
   * accessCount may be slightly inaccurate. This is acceptable for memory management
   * purposes where exact counts are not critical.
   */
  async retrieve(key: string): Promise<unknown> {
    const entry = await this.storage.get(key);
    if (!entry) {
      return undefined;
    }

    // Capture value before async operations to reduce race window
    const value = entry.value;

    // Update access stats - do this in background to not block retrieval
    // Re-fetch to minimize race condition window
    const freshEntry = await this.storage.get(key);
    if (freshEntry) {
      freshEntry.lastAccessedAt = Date.now();
      freshEntry.accessCount += 1;
      await this.storage.set(key, freshEntry);
    }

    this.emit('retrieved', { key });

    return value;
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
   * Promote an entry to persistent scope
   * Works with both simple and task-aware scopes
   */
  async persist(key: string): Promise<void> {
    const entry = await this.storage.get(key);
    if (!entry) {
      throw new Error(`Key "${key}" not found in memory`);
    }

    // Check if already persistent
    const isPersistent = isSimpleScope(entry.scope)
      ? entry.scope === 'persistent'
      : isTaskAwareScope(entry.scope) && entry.scope.type === 'persistent';

    if (!isPersistent) {
      entry.scope = { type: 'persistent' };
      await this.storage.set(key, entry);
    }
  }

  /**
   * Pin an entry (never evicted)
   */
  async pin(key: string): Promise<void> {
    const entry = await this.storage.get(key);
    if (!entry) {
      throw new Error(`Key "${key}" not found in memory`);
    }

    if (!entry.pinned) {
      entry.pinned = true;
      entry.basePriority = 'critical';
      await this.storage.set(key, entry);
    }
  }

  /**
   * Unpin an entry
   */
  async unpin(key: string, newPriority: MemoryPriority = 'normal'): Promise<void> {
    const entry = await this.storage.get(key);
    if (!entry) {
      throw new Error(`Key "${key}" not found in memory`);
    }

    if (entry.pinned) {
      entry.pinned = false;
      entry.basePriority = newPriority;
      await this.storage.set(key, entry);
    }
  }

  /**
   * Set the base priority of an entry
   */
  async setPriority(key: string, priority: MemoryPriority): Promise<void> {
    const entry = await this.storage.get(key);
    if (!entry) {
      throw new Error(`Key "${key}" not found in memory`);
    }

    entry.basePriority = priority;
    await this.storage.set(key, entry);
  }

  /**
   * Update the scope of an entry without re-storing the value
   */
  async updateScope(key: string, scope: MemoryScope): Promise<void> {
    const entry = await this.storage.get(key);
    if (!entry) {
      throw new Error(`Key "${key}" not found in memory`);
    }

    entry.scope = scope;
    await this.storage.set(key, entry);
  }

  /**
   * Add task IDs to an existing task-scoped entry
   * If entry is not task-scoped, converts it to task-scoped
   */
  async addTasksToScope(key: string, taskIds: string[]): Promise<void> {
    const entry = await this.storage.get(key);
    if (!entry) {
      throw new Error(`Key "${key}" not found in memory`);
    }

    if (isTaskAwareScope(entry.scope) && entry.scope.type === 'task') {
      // Merge task IDs, removing duplicates
      const existingIds = new Set(entry.scope.taskIds);
      for (const id of taskIds) {
        existingIds.add(id);
      }
      entry.scope = { type: 'task', taskIds: Array.from(existingIds) };
    } else {
      // Convert to task-scoped
      entry.scope = { type: 'task', taskIds };
    }

    await this.storage.set(key, entry);
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
   * Get memory index with computed effective priorities
   */
  async getIndex(): Promise<MemoryIndex> {
    const entriesWithPriority = await this.getEntriesWithPriority();
    const totalSizeBytes = await this.storage.getTotalSize();
    const limitBytes = this.getLimit();

    // Sort by: pinned first, then by priority (critical > high > normal > low), then by LRU
    const sortedEntries = [...entriesWithPriority].sort((a, b) => {
      // Pinned first
      if (a.entry.pinned && !b.entry.pinned) return -1;
      if (!a.entry.pinned && b.entry.pinned) return 1;

      // Then by effective priority (higher priority first)
      const priorityDiff =
        MEMORY_PRIORITY_VALUES[b.effectivePriority] -
        MEMORY_PRIORITY_VALUES[a.effectivePriority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by last access time (most recent first)
      return b.entry.lastAccessedAt - a.entry.lastAccessedAt;
    });

    const indexEntries = sortedEntries.map(({ entry, effectivePriority }) => ({
      key: entry.key,
      description: entry.description,
      size: formatSizeHuman(entry.sizeBytes),
      scope: entry.scope,
      effectivePriority,
      pinned: entry.pinned,
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
    const index = await this.getIndex();
    return formatMemoryIndex(index);
  }

  /**
   * Evict entries using specified strategy
   *
   * Eviction order:
   * 1. Never evict pinned entries
   * 2. Evict low priority first, then normal, then high (never critical)
   * 3. Within same priority, use strategy (LRU or largest size)
   *
   * @param count - Number of entries to evict
   * @param strategy - Eviction strategy ('lru' or 'size')
   * @returns Keys of evicted entries
   */
  async evict(count: number, strategy: EvictionStrategy = 'lru'): Promise<string[]> {
    const entriesWithPriority = await this.getEntriesWithPriority();
    const evictable = this.getEvictableEntries(entriesWithPriority, strategy);

    const toEvict = evictable.slice(0, count);
    const evictedKeys: string[] = [];

    for (const { entry } of toEvict) {
      await this.storage.delete(entry.key);
      evictedKeys.push(entry.key);
    }

    if (evictedKeys.length > 0) {
      this.emit('evicted', { keys: evictedKeys, reason: strategy });
    }

    return evictedKeys;
  }

  /**
   * Evict entries using priority-aware LRU algorithm
   * @deprecated Use evict(count, 'lru') instead
   */
  async evictLRU(count: number): Promise<string[]> {
    return this.evict(count, 'lru');
  }

  /**
   * Evict largest entries first (priority-aware)
   * @deprecated Use evict(count, 'size') instead
   */
  async evictBySize(count: number): Promise<string[]> {
    return this.evict(count, 'size');
  }

  /**
   * Handle task completion - detect and notify about stale entries
   *
   * Call this when a task completes to:
   * 1. Update priority context with new task state
   * 2. Detect entries that became stale
   * 3. Emit event to notify LLM about stale entries
   *
   * @param taskId - The completed task ID
   * @param taskStates - Current task states map
   * @returns Information about stale entries
   */
  async onTaskComplete(
    taskId: string,
    taskStates: Map<string, TaskStatusForMemory>
  ): Promise<StaleEntryInfo[]> {
    // Update priority context
    this.priorityContext.taskStates = taskStates;

    // Get all entries
    const entries = await this.storage.getAll();

    // Detect stale entries
    const staleEntries = detectStaleEntries(entries, taskId, taskStates);

    // Emit event if there are stale entries
    if (staleEntries.length > 0) {
      this.emit('stale_entries', { entries: staleEntries });
    }

    return staleEntries;
  }

  /**
   * Evict entries for completed tasks
   *
   * Removes entries that were scoped only to completed tasks.
   * Use after onTaskComplete() if you want automatic cleanup.
   *
   * @param taskStates - Current task states map
   * @returns Keys of evicted entries
   */
  async evictCompletedTaskEntries(
    taskStates: Map<string, TaskStatusForMemory>
  ): Promise<string[]> {
    const entries = await this.storage.getAll();
    const evictedKeys: string[] = [];

    for (const entry of entries) {
      // Skip pinned
      if (entry.pinned) continue;

      // Only check task-scoped entries
      if (!isTaskAwareScope(entry.scope) || entry.scope.type !== 'task') continue;

      // Check if ALL tasks for this entry are terminal
      const allTerminal = entry.scope.taskIds.every((taskId) => {
        const status = taskStates.get(taskId);
        return status ? isTerminalMemoryStatus(status) : false;
      });

      if (allTerminal) {
        await this.storage.delete(entry.key);
        evictedKeys.push(entry.key);
      }
    }

    if (evictedKeys.length > 0) {
      this.emit('evicted', { keys: evictedKeys, reason: 'task_completed' });
    }

    return evictedKeys;
  }

  /**
   * Get limited memory access for tools
   *
   * This provides a simplified interface for tools to interact with memory
   * without exposing the full WorkingMemory API.
   */
  getAccess(): WorkingMemoryAccess {
    return {
      get: async (key: string) => this.retrieve(key),
      set: async (key: string, description: string, value: unknown, options?: {
        scope?: MemoryScope;
        priority?: MemoryPriority;
        pinned?: boolean;
      }) => this.store(key, description, value, options),
      delete: async (key: string) => this.delete(key),
      has: async (key: string) => this.has(key),
      list: async () => {
        const index = await this.getIndex();
        return index.entries.map((e) => ({
          key: e.key,
          description: e.description,
          effectivePriority: e.effectivePriority,
          pinned: e.pinned,
        }));
      },
    };
  }

  // ============================================================================
  // HIERARCHICAL MEMORY HELPERS
  // ============================================================================

  /**
   * Store raw data (low priority, first to be evicted)
   *
   * Use this for original/unprocessed data that should be summarized.
   * Raw data is automatically evicted first when memory pressure is high.
   *
   * @param key - Key without tier prefix (prefix is added automatically)
   * @param description - Brief description for the index
   * @param value - The raw data to store
   * @param options - Optional scope and task IDs
   */
  async storeRaw(
    key: string,
    description: string,
    value: unknown,
    options?: { taskIds?: string[]; scope?: MemoryScope }
  ): Promise<void> {
    const fullKey = addTierPrefix(key, 'raw');
    const scope = options?.taskIds
      ? { type: 'task' as const, taskIds: options.taskIds }
      : options?.scope ?? 'session';

    await this.store(fullKey, description, value, {
      scope,
      priority: TIER_PRIORITIES.raw,
    });
  }

  /**
   * Store a summary derived from raw data (normal priority)
   *
   * Use this for processed/summarized data that extracts key information.
   * Links back to source data for cleanup tracking.
   *
   * @param key - Key without tier prefix (prefix is added automatically)
   * @param description - Brief description for the index
   * @param value - The summary data
   * @param derivedFrom - Key(s) this summary was derived from
   * @param options - Optional scope and task IDs
   */
  async storeSummary(
    key: string,
    description: string,
    value: unknown,
    derivedFrom: string | string[],
    options?: { taskIds?: string[]; scope?: MemoryScope }
  ): Promise<void> {
    const fullKey = addTierPrefix(key, 'summary');
    const sourceKeys = Array.isArray(derivedFrom) ? derivedFrom : [derivedFrom];
    const scope = options?.taskIds
      ? { type: 'task' as const, taskIds: options.taskIds }
      : options?.scope ?? { type: 'plan' as const };

    await this.store(fullKey, description, value, {
      scope,
      priority: TIER_PRIORITIES.summary,
    });

    // Update source entries with derivedTo reference (best effort)
    for (const sourceKey of sourceKeys) {
      try {
        const sourceEntry = await this.storage.get(sourceKey);
        if (sourceEntry) {
          const metadata = (sourceEntry.value as Record<string, unknown>)?.metadata as HierarchyMetadata | undefined;
          const existingDerivedTo = metadata?.derivedTo ?? [];
          if (!existingDerivedTo.includes(fullKey)) {
            // We can't easily update metadata without re-storing the value
            // This is a limitation - we track derivedFrom on the child instead
          }
        }
      } catch {
        // Ignore errors updating source - it may have been evicted
      }
    }
  }

  /**
   * Store final findings (high priority, kept longest)
   *
   * Use this for conclusions, insights, or final results that should be preserved.
   * These are the last to be evicted and typically span the entire plan.
   *
   * @param key - Key without tier prefix (prefix is added automatically)
   * @param description - Brief description for the index
   * @param value - The findings data
   * @param derivedFrom - Optional key(s) these findings were derived from
   * @param options - Optional scope, task IDs, and pinned flag
   */
  async storeFindings(
    key: string,
    description: string,
    value: unknown,
    _derivedFrom?: string | string[],
    options?: { taskIds?: string[]; scope?: MemoryScope; pinned?: boolean }
  ): Promise<void> {
    const fullKey = addTierPrefix(key, 'findings');
    const scope = options?.scope ?? { type: 'plan' as const };

    // Note: _derivedFrom is available for future metadata tracking if needed
    await this.store(fullKey, description, value, {
      scope,
      priority: TIER_PRIORITIES.findings,
      pinned: options?.pinned,
    });
  }

  /**
   * Clean up raw data after summary/findings are created
   *
   * Call this after creating summaries to free up memory used by raw data.
   * Only deletes entries in the 'raw' tier.
   *
   * @param derivedFromKeys - Keys to delete (typically from derivedFrom metadata)
   * @returns Number of entries deleted
   */
  async cleanupRawData(derivedFromKeys: string[]): Promise<number> {
    let deletedCount = 0;

    for (const key of derivedFromKeys) {
      // Only delete if it's actually a raw tier entry
      const tier = getTierFromKey(key);
      if (tier === 'raw') {
        const exists = await this.has(key);
        if (exists) {
          await this.delete(key);
          deletedCount++;
        }
      }
    }

    return deletedCount;
  }

  /**
   * Get all entries by tier
   *
   * @param tier - The tier to filter by
   * @returns Array of entries in that tier
   */
  async getByTier(tier: MemoryTier): Promise<MemoryEntry[]> {
    const entries = await this.storage.getAll();
    const prefix = TIER_KEY_PREFIXES[tier];
    return entries.filter((e) => e.key.startsWith(prefix));
  }

  /**
   * Promote an entry to a higher tier
   *
   * Changes the key prefix and updates priority.
   * Use this when raw data becomes more valuable (e.g., frequently accessed).
   *
   * @param key - Current key (with tier prefix)
   * @param toTier - Target tier to promote to
   * @returns New key with updated prefix
   */
  async promote(key: string, toTier: MemoryTier): Promise<string> {
    const currentTier = getTierFromKey(key);
    if (currentTier === toTier) {
      return key; // Already in target tier
    }

    const entry = await this.storage.get(key);
    if (!entry) {
      throw new Error(`Key "${key}" not found in memory`);
    }

    // Create new entry with new tier
    const newKey = addTierPrefix(key, toTier);
    const newPriority = TIER_PRIORITIES[toTier];

    // Store with new key and priority
    await this.store(newKey, entry.description, entry.value, {
      scope: entry.scope,
      priority: newPriority,
      pinned: entry.pinned,
    });

    // Delete old entry
    await this.delete(key);

    return newKey;
  }

  /**
   * Get tier statistics
   *
   * @returns Count and size by tier
   */
  async getTierStats(): Promise<Record<MemoryTier, { count: number; sizeBytes: number }>> {
    const entries = await this.storage.getAll();
    const stats: Record<MemoryTier, { count: number; sizeBytes: number }> = {
      raw: { count: 0, sizeBytes: 0 },
      summary: { count: 0, sizeBytes: 0 },
      findings: { count: 0, sizeBytes: 0 },
    };

    for (const entry of entries) {
      const tier = getTierFromKey(entry.key);
      if (tier) {
        stats[tier].count++;
        stats[tier].sizeBytes += entry.sizeBytes;
      }
    }

    return stats;
  }

  /**
   * Get statistics about memory usage
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalSizeBytes: number;
    utilizationPercent: number;
    byPriority: Record<MemoryPriority, number>;
    pinnedCount: number;
  }> {
    const entriesWithPriority = await this.getEntriesWithPriority();
    const totalSizeBytes = await this.storage.getTotalSize();
    const limit = this.getLimit();

    const byPriority: Record<MemoryPriority, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
    };

    let pinnedCount = 0;

    for (const { entry, effectivePriority } of entriesWithPriority) {
      byPriority[effectivePriority]++;
      if (entry.pinned) pinnedCount++;
    }

    return {
      totalEntries: entriesWithPriority.length,
      totalSizeBytes,
      utilizationPercent: (totalSizeBytes / limit) * 100,
      byPriority,
      pinnedCount,
    };
  }

  /**
   * Get the configured memory limit
   */
  getLimit(): number {
    return this.config.maxSizeBytes ?? 25 * 1024 * 1024; // Default 25MB
  }

  /**
   * Check if the WorkingMemory instance has been destroyed
   */
  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  /**
   * Destroy the WorkingMemory instance
   * Removes all event listeners and clears internal state
   */
  destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    this.removeAllListeners();
    this.priorityContext = {};
  }

  // ============================================================================
  // Serialization (for session persistence)
  // ============================================================================

  /**
   * Serialize all memory entries for persistence
   *
   * Returns a serializable representation of all memory entries
   * that can be saved to storage and restored later.
   *
   * @returns Serialized memory state
   */
  async serialize(): Promise<SerializedMemory> {
    const entries = await this.storage.getAll();

    const serializedEntries: SerializedMemoryEntry[] = entries.map((entry) => ({
      key: entry.key,
      description: entry.description,
      value: entry.value,
      scope: entry.scope,
      sizeBytes: entry.sizeBytes,
      basePriority: entry.basePriority,
      pinned: entry.pinned,
      // Note: createdAt, lastAccessedAt, accessCount are not persisted
      // They will be reset on restore (entries start fresh)
    }));

    return {
      version: 1,
      entries: serializedEntries,
    };
  }

  /**
   * Restore memory entries from serialized state
   *
   * Clears existing memory and repopulates from the serialized state.
   * Timestamps are reset to current time.
   *
   * @param state - Previously serialized memory state
   */
  async restore(state: SerializedMemory): Promise<void> {
    // Validate version
    if (state.version !== 1) {
      throw new Error(`Unsupported memory serialization version: ${state.version}`);
    }

    // Clear existing entries
    await this.storage.clear();

    // Restore each entry
    const now = Date.now();
    for (const entry of state.entries) {
      const fullEntry: MemoryEntry = {
        key: entry.key,
        description: entry.description,
        value: entry.value,
        scope: entry.scope,
        sizeBytes: entry.sizeBytes,
        basePriority: entry.basePriority ?? 'normal',
        pinned: entry.pinned ?? false,
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0,
      };

      await this.storage.set(entry.key, fullEntry);
    }
  }
}

export type { WorkingMemoryConfig, PriorityCalculator, PriorityContext, StaleEntryInfo, MemoryTier, HierarchyMetadata };
export {
  DEFAULT_MEMORY_CONFIG,
  staticPriorityCalculator,
  MEMORY_PRIORITY_VALUES,
  TIER_PRIORITIES,
  TIER_KEY_PREFIXES,
  getTierFromKey,
  addTierPrefix,
};
