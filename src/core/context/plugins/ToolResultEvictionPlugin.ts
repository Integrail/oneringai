/**
 * ToolResultEvictionPlugin - Smart eviction of old tool results from context
 *
 * This plugin automatically moves old tool results to WorkingMemory to free
 * context space while preserving retrievability. Unlike regular compaction
 * which simply removes old messages, this plugin:
 *
 * 1. Tracks tool results with age (iteration count) and size
 * 2. Stores results in WorkingMemory's raw tier before removal
 * 3. Removes BOTH tool_use AND tool_result messages (as pairs)
 * 4. Allows agent to retrieve evicted results via memory_retrieve
 *
 * Eviction Triggers:
 * - Size pressure: Total tracked results exceed maxTotalSizeBytes
 * - Count limit: Number of results exceeds maxFullResults
 * - Staleness: Any result is older than maxAgeIterations
 *
 * @example
 * ```typescript
 * const plugin = new ToolResultEvictionPlugin(memory, {
 *   maxFullResults: 5,        // Keep last 5 pairs in conversation
 *   maxAgeIterations: 3,      // Evict after 3 iterations
 *   maxTotalSizeBytes: 100 * 1024,  // 100KB total
 * });
 * agentContext.registerPlugin(plugin);
 * ```
 */

import { EventEmitter } from 'eventemitter3';
import { BaseContextPlugin } from './IContextPlugin.js';
import type { IContextComponent, ITokenEstimator, ContextBudget } from '../types.js';
import type { WorkingMemory } from '../../../capabilities/taskAgent/WorkingMemory.js';
import {
  TOOL_RESULT_EVICTION_DEFAULTS,
  DEFAULT_TOOL_RETENTION,
} from '../../constants.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Tracked tool result metadata
 */
export interface TrackedResult {
  /** Tool use ID (links tool_use and tool_result) */
  toolUseId: string;
  /** Name of the tool that was executed */
  toolName: string;
  /** The actual result content */
  result: unknown;
  /** Size of the result in bytes */
  sizeBytes: number;
  /** Iteration when this result was added */
  addedAtIteration: number;
  /** Index of the tool_result message in conversation */
  messageIndex: number;
  /** Timestamp when tracked */
  timestamp: number;
}

/**
 * Configuration for tool result eviction
 */
export interface ToolResultEvictionConfig {
  /**
   * Maximum number of full tool result pairs to keep in conversation.
   * Beyond this, oldest pairs are evicted to memory.
   * @default 5
   */
  maxFullResults?: number;

  /**
   * Maximum age in iterations before eviction.
   * Results older than this are evicted regardless of count.
   * @default 3
   */
  maxAgeIterations?: number;

  /**
   * Minimum size (bytes) for a result to be eligible for eviction.
   * Smaller results are kept in conversation.
   * @default 1024 (1KB)
   */
  minSizeToEvict?: number;

  /**
   * Maximum total size (bytes) of tracked results before triggering eviction.
   * When exceeded, oldest/largest results are evicted.
   * @default 102400 (100KB)
   */
  maxTotalSizeBytes?: number;

  /**
   * Per-tool iteration retention overrides.
   * Tools not in this map use maxAgeIterations.
   * @example { 'read_file': 10, 'web_fetch': 3 }
   */
  toolRetention?: Record<string, number>;

  /**
   * Key prefix for evicted results stored in memory.
   * Full key format: `<prefix>:<toolName>:<toolUseId>`
   * @default 'tool_result'
   */
  keyPrefix?: string;
}

/**
 * Serialized plugin state for session persistence
 */
export interface SerializedToolResultEvictionState {
  tracked: TrackedResult[];
  currentIteration: number;
  totalEvicted: number;
  totalTokensFreed: number;
}

/**
 * Events emitted by the plugin
 */
export interface ToolResultEvictionEvents {
  /** Emitted when results are evicted */
  evicted: { count: number; tokensFreed: number; keys: string[] };
  /** Emitted when a result is tracked */
  tracked: { toolUseId: string; toolName: string; sizeBytes: number };
  /** Emitted on iteration advance */
  iteration: { current: number };
}

/**
 * Result of eviction operation
 */
export interface EvictionResult {
  /** Number of tool pairs evicted */
  evicted: number;
  /** Estimated tokens freed */
  tokensFreed: number;
  /** Memory keys where results were stored */
  memoryKeys: string[];
  /** Log messages for debugging */
  log: string[];
}

// ============================================================================
// Plugin Implementation
// ============================================================================

/**
 * ToolResultEvictionPlugin - Manages automatic eviction of old tool results
 */
export class ToolResultEvictionPlugin extends BaseContextPlugin {
  readonly name = 'tool_result_eviction';
  readonly priority = 8; // Higher than tool outputs (9), lower than conversation (5)
  readonly compactable = true;

  private memory: WorkingMemory;
  private config: Required<ToolResultEvictionConfig>;
  private tracked: Map<string, TrackedResult> = new Map();
  private currentIteration = 0;
  private totalTrackedSize = 0;
  private totalEvicted = 0;
  private totalTokensFreed = 0;
  private events = new EventEmitter<ToolResultEvictionEvents>();

  /**
   * Callback to remove tool pairs from conversation.
   * Set by AgentContext during registration.
   */
  private removeToolPairCallback: ((toolUseId: string) => number) | null = null;

  constructor(memory: WorkingMemory, config: ToolResultEvictionConfig = {}) {
    super();
    this.memory = memory;
    this.config = {
      maxFullResults: config.maxFullResults ?? TOOL_RESULT_EVICTION_DEFAULTS.MAX_FULL_RESULTS,
      maxAgeIterations: config.maxAgeIterations ?? TOOL_RESULT_EVICTION_DEFAULTS.MAX_AGE_ITERATIONS,
      minSizeToEvict: config.minSizeToEvict ?? TOOL_RESULT_EVICTION_DEFAULTS.MIN_SIZE_TO_EVICT,
      maxTotalSizeBytes: config.maxTotalSizeBytes ?? TOOL_RESULT_EVICTION_DEFAULTS.MAX_TOTAL_SIZE_BYTES,
      toolRetention: { ...DEFAULT_TOOL_RETENTION, ...config.toolRetention },
      keyPrefix: config.keyPrefix ?? 'tool_result',
    };
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Subscribe to events
   */
  on<K extends keyof ToolResultEvictionEvents>(
    event: K,
    listener: (...args: any[]) => void
  ): this {
    this.events.on(event, listener as any);
    return this;
  }

  /**
   * Unsubscribe from events
   */
  off<K extends keyof ToolResultEvictionEvents>(
    event: K,
    listener: (...args: any[]) => void
  ): this {
    this.events.off(event, listener as any);
    return this;
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Set the callback for removing tool pairs from conversation.
   * This is called by AgentContext during plugin registration.
   */
  setRemoveCallback(callback: (toolUseId: string) => number): void {
    this.removeToolPairCallback = callback;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<ToolResultEvictionConfig>> {
    return this.config;
  }

  // ============================================================================
  // Tracking
  // ============================================================================

  /**
   * Track a new tool result.
   * Called by AgentContext when tool results are added to conversation.
   *
   * @param toolUseId - The tool_use ID linking request/response
   * @param toolName - Name of the executed tool
   * @param result - The tool result content
   * @param messageIndex - Index of the message in conversation
   */
  onToolResult(
    toolUseId: string,
    toolName: string,
    result: unknown,
    messageIndex: number
  ): void {
    // Calculate size
    const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
    const sizeBytes = Buffer.byteLength(resultStr, 'utf8');

    const tracked: TrackedResult = {
      toolUseId,
      toolName,
      result,
      sizeBytes,
      addedAtIteration: this.currentIteration,
      messageIndex,
      timestamp: Date.now(),
    };

    this.tracked.set(toolUseId, tracked);
    this.totalTrackedSize += sizeBytes;

    this.events.emit('tracked', { toolUseId, toolName, sizeBytes });
  }

  /**
   * Called at the start of each agent iteration.
   * Advances the iteration counter for age-based eviction.
   */
  onIteration(): void {
    this.currentIteration++;
    this.events.emit('iteration', { current: this.currentIteration });
  }

  /**
   * Get the current iteration number
   */
  getCurrentIteration(): number {
    return this.currentIteration;
  }

  // ============================================================================
  // Eviction Logic
  // ============================================================================

  /**
   * Check if eviction is needed based on current state.
   * Returns true if any eviction trigger is met.
   */
  shouldEvict(): boolean {
    const { maxFullResults, maxTotalSizeBytes, maxAgeIterations, minSizeToEvict } =
      this.config;

    // Trigger 1: Size pressure - total tracked results exceed threshold
    if (this.totalTrackedSize > maxTotalSizeBytes) {
      return true;
    }

    // Trigger 2: Count pressure - too many results tracked
    if (this.tracked.size > maxFullResults) {
      return true;
    }

    // Trigger 3: Staleness - any result exceeds age threshold (and meets size minimum)
    for (const r of this.tracked.values()) {
      if (r.sizeBytes < minSizeToEvict) continue;

      const age = this.currentIteration - r.addedAtIteration;
      const toolMaxAge = this.config.toolRetention[r.toolName] ?? maxAgeIterations;
      if (age >= toolMaxAge) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get candidates for eviction, sorted by priority.
   * Candidates are selected to bring the system under all thresholds.
   */
  private getEvictionCandidates(): TrackedResult[] {
    const { maxFullResults, maxTotalSizeBytes, maxAgeIterations, minSizeToEvict } =
      this.config;

    // Filter to only evictable results (meet size minimum)
    const evictable = [...this.tracked.values()].filter(
      (r) => r.sizeBytes >= minSizeToEvict
    );

    // Sort by priority: oldest first, then largest first within same age
    evictable.sort((a, b) => {
      const ageDiff = a.addedAtIteration - b.addedAtIteration;
      if (ageDiff !== 0) return ageDiff; // Older first
      return b.sizeBytes - a.sizeBytes; // Larger first (same age)
    });

    const candidates: TrackedResult[] = [];
    let projectedSize = this.totalTrackedSize;
    let projectedCount = this.tracked.size;

    for (const r of evictable) {
      // Stop if we're under ALL thresholds
      const underSizeLimit = projectedSize <= maxTotalSizeBytes;
      const underCountLimit = projectedCount <= maxFullResults;

      // Check if this specific result is stale
      const age = this.currentIteration - r.addedAtIteration;
      const toolMaxAge = this.config.toolRetention[r.toolName] ?? maxAgeIterations;
      const isStale = age >= toolMaxAge;

      // Continue evicting if:
      // - Over any limit, OR
      // - This result is stale
      if (!isStale && underSizeLimit && underCountLimit) {
        break;
      }

      candidates.push(r);
      projectedSize -= r.sizeBytes;
      projectedCount--;
    }

    return candidates;
  }

  /**
   * Evict old results to memory and remove from conversation.
   * This is the main eviction entry point.
   *
   * @returns Eviction result with counts and log
   */
  async evictOldResults(): Promise<EvictionResult> {
    const result: EvictionResult = {
      evicted: 0,
      tokensFreed: 0,
      memoryKeys: [],
      log: [],
    };

    if (!this.shouldEvict()) {
      return result;
    }

    if (!this.removeToolPairCallback) {
      result.log.push('Cannot evict: removeToolPairCallback not set');
      return result;
    }

    const candidates = this.getEvictionCandidates();
    if (candidates.length === 0) {
      result.log.push('No candidates for eviction (all below size threshold)');
      return result;
    }

    result.log.push(`Evicting ${candidates.length} tool result pairs`);

    for (const candidate of candidates) {
      try {
        // 1. Store in WorkingMemory raw tier
        const memoryKey = `${this.config.keyPrefix}:${candidate.toolName}:${candidate.toolUseId}`;
        await this.memory.storeRaw(
          memoryKey,
          `Evicted result from ${candidate.toolName} (${formatBytes(candidate.sizeBytes)})`,
          candidate.result
        );
        result.memoryKeys.push(memoryKey);

        // 2. Remove the tool_use/tool_result pair from conversation
        const tokensFreed = this.removeToolPairCallback(candidate.toolUseId);
        result.tokensFreed += tokensFreed;

        // 3. Update tracking
        this.totalTrackedSize -= candidate.sizeBytes;
        this.tracked.delete(candidate.toolUseId);
        result.evicted++;

        result.log.push(
          `  Evicted ${candidate.toolName}:${candidate.toolUseId} → ${memoryKey} (${tokensFreed} tokens)`
        );
      } catch (error) {
        result.log.push(
          `  Failed to evict ${candidate.toolUseId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Update totals
    this.totalEvicted += result.evicted;
    this.totalTokensFreed += result.tokensFreed;

    if (result.evicted > 0) {
      this.events.emit('evicted', {
        count: result.evicted,
        tokensFreed: result.tokensFreed,
        keys: result.memoryKeys,
      });
    }

    return result;
  }

  // ============================================================================
  // Stats and Info
  // ============================================================================

  /**
   * Get current tracking statistics
   */
  getStats(): {
    count: number;
    totalSizeBytes: number;
    oldestAge: number;
    currentIteration: number;
    totalEvicted: number;
    totalTokensFreed: number;
  } {
    let oldestAge = 0;
    for (const r of this.tracked.values()) {
      const age = this.currentIteration - r.addedAtIteration;
      if (age > oldestAge) oldestAge = age;
    }

    return {
      count: this.tracked.size,
      totalSizeBytes: this.totalTrackedSize,
      oldestAge,
      currentIteration: this.currentIteration,
      totalEvicted: this.totalEvicted,
      totalTokensFreed: this.totalTokensFreed,
    };
  }

  /**
   * Get all tracked results
   */
  getTracked(): TrackedResult[] {
    return [...this.tracked.values()];
  }

  /**
   * Check if a specific tool result is tracked
   */
  isTracked(toolUseId: string): boolean {
    return this.tracked.has(toolUseId);
  }

  /**
   * Get tracked result by ID
   */
  getTrackedResult(toolUseId: string): TrackedResult | undefined {
    return this.tracked.get(toolUseId);
  }

  // ============================================================================
  // Message Index Updates
  // ============================================================================

  /**
   * Update message indices after conversation modification.
   * Called when messages are removed from conversation.
   *
   * @param removedIndices - Set of indices that were removed
   */
  updateMessageIndices(removedIndices: Set<number>): void {
    // Calculate shift for each tracked result
    for (const tracked of this.tracked.values()) {
      if (removedIndices.has(tracked.messageIndex)) {
        // This result was removed - should also be removed from tracking
        this.totalTrackedSize -= tracked.sizeBytes;
        this.tracked.delete(tracked.toolUseId);
        continue;
      }

      // Count how many removed indices are before this one
      let shift = 0;
      for (const idx of removedIndices) {
        if (idx < tracked.messageIndex) shift++;
      }

      tracked.messageIndex -= shift;
    }
  }

  // ============================================================================
  // IContextPlugin Implementation
  // ============================================================================

  async getComponent(): Promise<IContextComponent | null> {
    // This plugin doesn't add content to context directly
    // Evicted results are visible through the memory index
    const stats = this.getStats();

    if (stats.count === 0 && stats.totalEvicted === 0) {
      return null;
    }

    // Provide minimal status info (actual results are in memory index)
    return {
      name: this.name,
      content: `Tool Result Eviction: ${stats.count} tracked, ${stats.totalEvicted} evicted to memory`,
      priority: this.priority,
      compactable: this.compactable,
      metadata: stats,
    };
  }

  async compact(_targetTokens: number, _estimator: ITokenEstimator): Promise<number> {
    // When compaction is requested, perform eviction
    const result = await this.evictOldResults();
    return result.tokensFreed;
  }

  async onPrepared(_budget: ContextBudget): Promise<void> {
    // Could log stats here if needed
  }

  override getState(): SerializedToolResultEvictionState {
    return {
      tracked: [...this.tracked.values()],
      currentIteration: this.currentIteration,
      totalEvicted: this.totalEvicted,
      totalTokensFreed: this.totalTokensFreed,
    };
  }

  override restoreState(state: unknown): void {
    const s = state as SerializedToolResultEvictionState;
    if (!s) return;

    if (Array.isArray(s.tracked)) {
      this.tracked.clear();
      this.totalTrackedSize = 0;
      for (const t of s.tracked) {
        this.tracked.set(t.toolUseId, t);
        this.totalTrackedSize += t.sizeBytes;
      }
    }

    if (typeof s.currentIteration === 'number') {
      this.currentIteration = s.currentIteration;
    }

    if (typeof s.totalEvicted === 'number') {
      this.totalEvicted = s.totalEvicted;
    }

    if (typeof s.totalTokensFreed === 'number') {
      this.totalTokensFreed = s.totalTokensFreed;
    }
  }

  override destroy(): void {
    this.events.removeAllListeners();
    this.tracked.clear();
    this.totalTrackedSize = 0;
    this.removeToolPairCallback = null;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
