/**
 * WorkingMemoryPluginNextGen - Working memory plugin for NextGen context
 *
 * Provides external storage with an INDEX shown in context.
 * LLM sees descriptions but must use memory_retrieve() to get full values.
 *
 * Features:
 * - Hierarchical tiers: raw → summary → findings
 * - Priority-based eviction
 * - Task-aware scoping (optional)
 * - Automatic tier-based priorities
 */

import type { IContextPluginNextGen, ITokenEstimator } from '../types.js';
import type { ToolFunction } from '../../../domain/entities/Tool.js';
import type { IMemoryStorage } from '../../../domain/interfaces/IMemoryStorage.js';
import { InMemoryStorage } from '../../../infrastructure/storage/InMemoryStorage.js';
import { simpleTokenEstimator } from '../BasePluginNextGen.js';
import { StorageRegistry } from '../../StorageRegistry.js';

import type {
  MemoryEntry,
  MemoryScope,
  MemoryPriority,
  MemoryTier,
  WorkingMemoryConfig,
  PriorityCalculator,
  PriorityContext,
} from '../../../domain/entities/Memory.js';

import {
  DEFAULT_MEMORY_CONFIG,
  staticPriorityCalculator,
  MEMORY_PRIORITY_VALUES,
  createMemoryEntry,
  formatMemoryIndex,
  formatSizeHuman,
  TIER_PRIORITIES,
  getTierFromKey,
  addTierPrefix,
} from '../../../domain/entities/Memory.js';

import type { MemoryIndex, MemoryIndexEntry } from '../../../domain/entities/Memory.js';

// Tool definitions (inline for full control)
const memoryStoreDefinition = {
  type: 'function' as const,
  function: {
    name: 'memory_store',
    description: `Store data in working memory. Use this to save important information.

TIER SYSTEM (for research/analysis):
- "raw": Low priority, evicted first. Unprocessed data.
- "summary": Normal priority. Processed summaries.
- "findings": High priority, kept longest. Final conclusions.`,
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Namespaced key (e.g., "user.profile")' },
        description: { type: 'string', description: 'Brief description (max 150 chars)' },
        value: { description: 'Data to store (any JSON value)' },
        tier: {
          type: 'string',
          enum: ['raw', 'summary', 'findings'],
          description: 'Memory tier (sets priority automatically)',
        },
        scope: {
          type: 'string',
          enum: ['session', 'plan', 'persistent'],
          description: 'Lifecycle scope (default: session)',
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'critical'],
          description: 'Override priority (ignored if tier is set)',
        },
        pinned: { type: 'boolean', description: 'Never evict this entry' },
      },
      required: ['key', 'description', 'value'],
    },
  },
};

const memoryRetrieveDefinition = {
  type: 'function' as const,
  function: {
    name: 'memory_retrieve',
    description: 'Retrieve full data from working memory by key.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to retrieve' },
      },
      required: ['key'],
    },
  },
};

const memoryDeleteDefinition = {
  type: 'function' as const,
  function: {
    name: 'memory_delete',
    description: 'Delete data from working memory.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to delete' },
      },
      required: ['key'],
    },
  },
};

const memoryQueryDefinition = {
  type: 'function' as const,
  function: {
    name: 'memory_query',
    description: `Query working memory. List, search, or retrieve values.

Examples:
- memory_query() → list all keys
- memory_query({ pattern: "findings.*" }) → match pattern
- memory_query({ tier: "raw", includeValues: true }) → get raw tier values`,
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern (e.g., "raw.*")' },
        tier: { type: 'string', enum: ['raw', 'summary', 'findings'], description: 'Filter by tier' },
        includeValues: { type: 'boolean', description: 'Include values (default: false)' },
        includeStats: { type: 'boolean', description: 'Include memory stats' },
      },
      required: [],
    },
  },
};

const memoryCleanupRawDefinition = {
  type: 'function' as const,
  function: {
    name: 'memory_cleanup_raw',
    description: 'Delete ALL entries in the raw tier. Use after creating summaries.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

// ============================================================================
// Types
// ============================================================================

export interface SerializedWorkingMemoryState {
  version: number;
  entries: Array<{
    key: string;
    description: string;
    value: unknown;
    scope: MemoryScope;
    sizeBytes: number;
    basePriority?: MemoryPriority;
    pinned?: boolean;
  }>;
}

export type EvictionStrategy = 'lru' | 'size';

export interface WorkingMemoryPluginConfig {
  /** Memory configuration */
  config?: WorkingMemoryConfig;
  /** Storage backend (default: InMemoryStorage) */
  storage?: IMemoryStorage;
  /** Priority calculator (default: staticPriorityCalculator) */
  priorityCalculator?: PriorityCalculator;
}

// ============================================================================
// Instructions
// ============================================================================

const WORKING_MEMORY_INSTRUCTIONS = `Working Memory stores data EXTERNALLY with an index shown below.
You see descriptions but must use memory_retrieve(key) to get full values.

**Tier System** (for research/analysis):
- \`raw\`: Low priority, evicted first. Unprocessed data to summarize later.
- \`summary\`: Normal priority. Processed summaries of raw data.
- \`findings\`: High priority, kept longest. Final conclusions and insights.

**Workflow:**
1. Store raw data: \`memory_store({ key: "topic", tier: "raw", ... })\`
2. Process and summarize: \`memory_store({ key: "topic", tier: "summary", ... })\`
3. Extract findings: \`memory_store({ key: "topic", tier: "findings", ... })\`
4. Clean up raw: \`memory_cleanup_raw()\` or \`memory_delete(key)\`

**Tools:** memory_store, memory_retrieve, memory_delete, memory_query, memory_cleanup_raw`;

// ============================================================================
// Plugin Implementation
// ============================================================================

export class WorkingMemoryPluginNextGen implements IContextPluginNextGen {
  readonly name = 'working_memory';

  private storage: IMemoryStorage;
  private config: WorkingMemoryConfig;
  private priorityCalculator: PriorityCalculator;
  private priorityContext: PriorityContext = {};
  private estimator: ITokenEstimator = simpleTokenEstimator;

  private _destroyed = false;
  private _tokenCache: number | null = null;
  private _instructionsTokenCache: number | null = null;

  /**
   * Synchronous snapshot of entries for getState() serialization.
   * Updated on every mutation (store, delete, evict, cleanupRaw, restoreState).
   * Solves the async/sync mismatch: IMemoryStorage.getAll() is async but
   * IContextPluginNextGen.getState() must be sync.
   */
  private _syncEntries: Map<string, SerializedWorkingMemoryState['entries'][number]> = new Map();

  constructor(pluginConfig: WorkingMemoryPluginConfig = {}) {
    const registryFactory = StorageRegistry.get('workingMemory');
    this.storage = pluginConfig.storage ?? registryFactory?.(StorageRegistry.getContext()) ?? new InMemoryStorage();
    this.config = pluginConfig.config ?? DEFAULT_MEMORY_CONFIG;
    this.priorityCalculator = pluginConfig.priorityCalculator ?? staticPriorityCalculator;
  }

  // ============================================================================
  // IContextPluginNextGen Implementation
  // ============================================================================

  getInstructions(): string {
    return WORKING_MEMORY_INSTRUCTIONS;
  }

  async getContent(): Promise<string | null> {
    const entries = await this.storage.getAll();
    if (entries.length === 0) {
      return null;
    }

    // Build MemoryIndex from entries
    const index = this.buildMemoryIndex(entries);

    // Format as index (descriptions only, not full values)
    const formatted = formatMemoryIndex(index);
    this._tokenCache = this.estimator.estimateTokens(formatted);
    return formatted;
  }

  getContents(): unknown {
    // Return raw entries for inspection
    return this.storage.getAll();
  }

  getTokenSize(): number {
    return this._tokenCache ?? 0;
  }

  getInstructionsTokenSize(): number {
    if (this._instructionsTokenCache === null) {
      this._instructionsTokenCache = this.estimator.estimateTokens(WORKING_MEMORY_INSTRUCTIONS);
    }
    return this._instructionsTokenCache;
  }

  isCompactable(): boolean {
    return true;
  }

  async compact(_targetTokensToFree: number): Promise<number> {
    // TODO: Implement smart compaction based on targetTokensToFree
    // For now, use simple LRU eviction
    const before = this.getTokenSize();
    await this.evict(3, 'lru');
    const content = await this.getContent();
    const after = content ? this.estimator.estimateTokens(content) : 0;
    return Math.max(0, before - after);
  }

  getTools(): ToolFunction[] {
    return [
      this.createMemoryStoreTool(),
      this.createMemoryRetrieveTool(),
      this.createMemoryDeleteTool(),
      this.createMemoryQueryTool(),
      this.createMemoryCleanupRawTool(),
    ];
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._tokenCache = null;
  }

  getState(): SerializedWorkingMemoryState {
    return {
      version: 1,
      entries: Array.from(this._syncEntries.values()),
    };
  }

  restoreState(state: unknown): void {
    const s = state as SerializedWorkingMemoryState;
    if (!s || !s.entries) return;

    // Clear sync snapshot and rebuild
    this._syncEntries.clear();

    // Restore entries to both storage and sync snapshot
    for (const entry of s.entries) {
      const memEntry = createMemoryEntry({
        key: entry.key,
        description: entry.description,
        value: entry.value,
        scope: entry.scope,
        priority: entry.basePriority,
        pinned: entry.pinned,
      }, this.config);
      this.storage.set(entry.key, memEntry);
      this._syncEntries.set(entry.key, {
        key: entry.key,
        description: entry.description,
        value: entry.value,
        scope: entry.scope,
        sizeBytes: entry.sizeBytes,
        basePriority: entry.basePriority,
        pinned: entry.pinned,
      });
    }
    this._tokenCache = null;
  }

  // ============================================================================
  // Memory Operations (Core Implementation)
  // ============================================================================

  /**
   * Store a value in memory
   */
  async store(
    key: string,
    description: string,
    value: unknown,
    options?: {
      scope?: MemoryScope;
      priority?: MemoryPriority;
      tier?: MemoryTier;
      pinned?: boolean;
    }
  ): Promise<{ key: string; sizeBytes: number }> {
    this.assertNotDestroyed();

    // Apply tier prefix and priority if tier specified
    let finalKey = key;
    let finalPriority = options?.priority;

    if (options?.tier) {
      finalKey = addTierPrefix(key, options.tier);
      finalPriority = TIER_PRIORITIES[options.tier];
    }

    // Convert simple scope strings to task-aware format
    let scope: MemoryScope = options?.scope ?? 'session';

    const entry = createMemoryEntry({
      key: finalKey,
      description,
      value,
      scope,
      priority: finalPriority,
      pinned: options?.pinned,
    }, this.config);

    // Check size limits
    await this.ensureCapacity(entry.sizeBytes);

    await this.storage.set(finalKey, entry);
    this._syncEntries.set(finalKey, {
      key: finalKey,
      description,
      value,
      scope,
      sizeBytes: entry.sizeBytes,
      basePriority: finalPriority,
      pinned: options?.pinned,
    });
    this._tokenCache = null; // Invalidate cache

    return { key: finalKey, sizeBytes: entry.sizeBytes };
  }

  /**
   * Retrieve a value from memory
   */
  async retrieve(key: string): Promise<unknown | undefined> {
    this.assertNotDestroyed();
    const entry = await this.storage.get(key);
    if (entry) {
      entry.lastAccessedAt = Date.now();
      entry.accessCount++;
      await this.storage.set(key, entry);
      return entry.value;
    }
    return undefined;
  }

  /**
   * Delete a key from memory
   */
  async delete(key: string): Promise<boolean> {
    this.assertNotDestroyed();
    const exists = await this.storage.has(key);
    if (exists) {
      await this.storage.delete(key);
      this._syncEntries.delete(key);
      this._tokenCache = null;
      return true;
    }
    return false;
  }

  /**
   * Query memory entries
   */
  async query(options?: {
    pattern?: string;
    tier?: MemoryTier;
    includeValues?: boolean;
    includeStats?: boolean;
  }): Promise<{
    entries: Array<{
      key: string;
      description: string;
      tier?: MemoryTier;
      value?: unknown;
    }>;
    stats?: { count: number; totalBytes: number };
  }> {
    this.assertNotDestroyed();

    let entries = await this.storage.getAll();

    // Filter by tier
    if (options?.tier) {
      entries = entries.filter(e => getTierFromKey(e.key) === options.tier);
    }

    // Filter by pattern
    if (options?.pattern && options.pattern !== '*') {
      const regex = new RegExp(
        '^' + options.pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
      );
      entries = entries.filter(e => regex.test(e.key));
    }

    const result: Array<{
      key: string;
      description: string;
      tier?: MemoryTier;
      value?: unknown;
    }> = entries.map(e => ({
      key: e.key,
      description: e.description,
      tier: getTierFromKey(e.key),
      ...(options?.includeValues ? { value: e.value } : {}),
    }));

    if (options?.includeStats) {
      return {
        entries: result,
        stats: {
          count: entries.length,
          totalBytes: entries.reduce((sum, e) => sum + e.sizeBytes, 0),
        },
      };
    }

    return { entries: result };
  }

  /**
   * Format memory index for context
   */
  async formatIndex(): Promise<string> {
    const entries = await this.storage.getAll();
    const index = this.buildMemoryIndex(entries);
    return formatMemoryIndex(index);
  }

  /**
   * Evict entries to free space
   */
  async evict(count: number, strategy: EvictionStrategy = 'lru'): Promise<string[]> {
    const entries = await this.storage.getAll();

    // Get evictable entries (not pinned, not critical)
    const evictable = entries
      .filter(e => !e.pinned && this.computePriority(e) !== 'critical')
      .sort((a, b) => {
        const priorityDiff =
          MEMORY_PRIORITY_VALUES[this.computePriority(a)] -
          MEMORY_PRIORITY_VALUES[this.computePriority(b)];
        if (priorityDiff !== 0) return priorityDiff;

        if (strategy === 'lru') {
          return a.lastAccessedAt - b.lastAccessedAt;
        } else {
          return b.sizeBytes - a.sizeBytes;
        }
      });

    const toEvict = evictable.slice(0, count);
    const evictedKeys: string[] = [];

    for (const entry of toEvict) {
      await this.storage.delete(entry.key);
      this._syncEntries.delete(entry.key);
      evictedKeys.push(entry.key);
    }

    if (evictedKeys.length > 0) {
      this._tokenCache = null;
    }

    return evictedKeys;
  }

  /**
   * Cleanup raw tier entries
   */
  async cleanupRaw(): Promise<{ deleted: number; keys: string[] }> {
    const entries = await this.storage.getAll();
    const rawEntries = entries.filter(e => getTierFromKey(e.key) === 'raw');

    const keys: string[] = [];
    for (const entry of rawEntries) {
      await this.storage.delete(entry.key);
      this._syncEntries.delete(entry.key);
      keys.push(entry.key);
    }

    if (keys.length > 0) {
      this._tokenCache = null;
    }

    return { deleted: keys.length, keys };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private computePriority(entry: MemoryEntry): MemoryPriority {
    return this.priorityCalculator(entry, this.priorityContext);
  }

  /**
   * Build a MemoryIndex from raw entries
   */
  private buildMemoryIndex(entries: MemoryEntry[]): MemoryIndex {
    const maxSize = this.config.maxSizeBytes ?? DEFAULT_MEMORY_CONFIG.maxSizeBytes!;
    const maxIndexEntries = this.config.maxIndexEntries ?? DEFAULT_MEMORY_CONFIG.maxIndexEntries!;
    const totalSize = entries.reduce((sum, e) => sum + e.sizeBytes, 0);

    // Sort by priority (highest first), then by last access (most recent first)
    const sorted = [...entries].sort((a, b) => {
      const priorityDiff =
        MEMORY_PRIORITY_VALUES[this.computePriority(b)] -
        MEMORY_PRIORITY_VALUES[this.computePriority(a)];
      if (priorityDiff !== 0) return priorityDiff;
      return b.lastAccessedAt - a.lastAccessedAt;
    });

    // Limit entries for display
    const displayed = sorted.slice(0, maxIndexEntries);
    const omittedCount = Math.max(0, entries.length - maxIndexEntries);

    const indexEntries: MemoryIndexEntry[] = displayed.map(e => ({
      key: e.key,
      description: e.description,
      size: formatSizeHuman(e.sizeBytes),
      scope: e.scope,
      effectivePriority: this.computePriority(e),
      pinned: e.pinned,
    }));

    return {
      entries: indexEntries,
      totalSizeBytes: totalSize,
      totalSizeHuman: formatSizeHuman(totalSize),
      limitBytes: maxSize,
      limitHuman: formatSizeHuman(maxSize),
      utilizationPercent: maxSize > 0 ? (totalSize / maxSize) * 100 : 0,
      totalEntryCount: entries.length,
      omittedCount,
    };
  }

  private async ensureCapacity(neededBytes: number): Promise<void> {
    const entries = await this.storage.getAll();
    const currentSize = entries.reduce((sum, e) => sum + e.sizeBytes, 0);
    const maxSize = this.config.maxSizeBytes ?? DEFAULT_MEMORY_CONFIG.maxSizeBytes!;
    const maxEntries = this.config.maxIndexEntries ?? DEFAULT_MEMORY_CONFIG.maxIndexEntries!;

    const needsSizeEviction = currentSize + neededBytes > maxSize;
    const needsCountEviction = entries.length >= maxEntries;

    if (!needsSizeEviction && !needsCountEviction) return;

    // Sort evictable entries by priority (lowest first), then by LRU
    const evictable = entries
      .filter(e => !e.pinned && this.computePriority(e) !== 'critical')
      .sort((a, b) => {
        const priorityDiff =
          MEMORY_PRIORITY_VALUES[this.computePriority(a)] -
          MEMORY_PRIORITY_VALUES[this.computePriority(b)];
        if (priorityDiff !== 0) return priorityDiff;
        return a.lastAccessedAt - b.lastAccessedAt;
      });

    // Calculate eviction targets
    const bytesToFree = needsSizeEviction ? currentSize + neededBytes - maxSize * 0.8 : 0;
    const entriesToFree = needsCountEviction ? entries.length - maxEntries + 1 : 0; // +1 for incoming

    let freedBytes = 0;
    let freedCount = 0;

    for (const entry of evictable) {
      if (freedBytes >= bytesToFree && freedCount >= entriesToFree) break;
      await this.storage.delete(entry.key);
      this._syncEntries.delete(entry.key);
      freedBytes += entry.sizeBytes;
      freedCount++;
    }
  }

  private assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('WorkingMemoryPluginNextGen is destroyed');
    }
  }

  // ============================================================================
  // Tool Factories
  // ============================================================================

  private createMemoryStoreTool(): ToolFunction {
    return {
      definition: memoryStoreDefinition,
      execute: async (args: Record<string, unknown>) => {
        const result = await this.store(
          args.key as string,
          args.description as string,
          args.value,
          {
            tier: args.tier as MemoryTier | undefined,
            scope: args.scope as MemoryScope | undefined,
            priority: args.priority as MemoryPriority | undefined,
            pinned: args.pinned as boolean | undefined,
          }
        );
        return { success: true, ...result };
      },
      permission: { scope: 'always', riskLevel: 'low' },
      describeCall: (args) => `store ${args.key}`,
    };
  }

  private createMemoryRetrieveTool(): ToolFunction {
    return {
      definition: memoryRetrieveDefinition,
      execute: async (args: Record<string, unknown>) => {
        const value = await this.retrieve(args.key as string);
        if (value === undefined) {
          return { found: false, key: args.key };
        }
        return { found: true, key: args.key, value };
      },
      permission: { scope: 'always', riskLevel: 'low' },
      describeCall: (args) => `retrieve ${args.key}`,
    };
  }

  private createMemoryDeleteTool(): ToolFunction {
    return {
      definition: memoryDeleteDefinition,
      execute: async (args: Record<string, unknown>) => {
        const deleted = await this.delete(args.key as string);
        return { deleted, key: args.key };
      },
      permission: { scope: 'always', riskLevel: 'low' },
      describeCall: (args) => `delete ${args.key}`,
    };
  }

  private createMemoryQueryTool(): ToolFunction {
    return {
      definition: memoryQueryDefinition,
      execute: async (args: Record<string, unknown>) => {
        return await this.query({
          pattern: args.pattern as string | undefined,
          tier: args.tier as MemoryTier | undefined,
          includeValues: args.includeValues as boolean | undefined,
          includeStats: args.includeStats as boolean | undefined,
        });
      },
      permission: { scope: 'always', riskLevel: 'low' },
      describeCall: (args) => args.pattern ? `query ${args.pattern}` : 'query all',
    };
  }

  private createMemoryCleanupRawTool(): ToolFunction {
    return {
      definition: memoryCleanupRawDefinition,
      execute: async () => {
        return await this.cleanupRaw();
      },
      permission: { scope: 'always', riskLevel: 'low' },
      describeCall: () => 'cleanup raw tier',
    };
  }
}
