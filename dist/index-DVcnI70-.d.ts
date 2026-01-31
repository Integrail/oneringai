import { EventEmitter } from 'eventemitter3';
import { I as IProvider } from './IProvider-BP49c93d.js';

/**
 * Core types for context management system
 */
/**
 * Context component that can be compacted
 */
interface IContextComponent {
    /** Unique name for this component */
    name: string;
    /** The actual content (string or structured data) */
    content: string | unknown;
    /** Priority for compaction (higher = compact first) */
    priority: number;
    /** Whether this component can be compacted */
    compactable: boolean;
    /** Additional metadata for compaction strategies */
    metadata?: Record<string, unknown>;
}
/**
 * Context budget information
 */
interface ContextBudget {
    /** Total available tokens */
    total: number;
    /** Reserved tokens for response */
    reserved: number;
    /** Currently used tokens */
    used: number;
    /** Available tokens remaining */
    available: number;
    /** Utilization percentage (used / (total - reserved)) */
    utilizationPercent: number;
    /** Budget status */
    status: 'ok' | 'warning' | 'critical';
    /** Token breakdown by component */
    breakdown: Record<string, number>;
}
/**
 * Context preparation result
 */
interface PreparedContext {
    /** Prepared components */
    components: IContextComponent[];
    /** Current budget */
    budget: ContextBudget;
    /** Whether compaction occurred */
    compacted: boolean;
    /** Compaction log if compacted */
    compactionLog?: string[];
}
/**
 * Context manager configuration
 */
interface ContextManagerConfig {
    /** Maximum context tokens for the model */
    maxContextTokens: number;
    /** Threshold to trigger compaction (0.0 - 1.0) */
    compactionThreshold: number;
    /** Hard limit - must compact before this (0.0 - 1.0) */
    hardLimit: number;
    /** Reserve space for response (0.0 - 1.0) */
    responseReserve: number;
    /** Token estimator to use */
    estimator: 'approximate' | 'tiktoken' | ITokenEstimator;
    /** Enable automatic compaction */
    autoCompact: boolean;
    /** Strategy to use */
    strategy?: 'proactive' | 'aggressive' | 'lazy' | 'rolling-window' | 'adaptive' | IContextStrategy;
    /** Strategy-specific options */
    strategyOptions?: Record<string, unknown>;
}
/**
 * Default configuration
 */
declare const DEFAULT_CONTEXT_CONFIG: ContextManagerConfig;
/**
 * Abstract interface for providing context components.
 * Each agent type implements this to define what goes into context.
 */
interface IContextProvider {
    /**
     * Get current context components
     */
    getComponents(): Promise<IContextComponent[]>;
    /**
     * Update components after compaction
     */
    applyCompactedComponents(components: IContextComponent[]): Promise<void>;
    /**
     * Get max context size for this agent/model
     */
    getMaxContextSize(): number;
}
/**
 * Content type for more accurate token estimation
 * Named differently from TokenContentType in Content.ts to avoid conflicts
 */
type TokenContentType = 'code' | 'prose' | 'mixed';
/**
 * Abstract interface for token estimation
 */
interface ITokenEstimator {
    /**
     * Estimate token count for text
     *
     * @param text - The text to estimate
     * @param contentType - Type of content for more accurate estimation:
     *   - 'code': Code is typically denser (~3 chars/token)
     *   - 'prose': Natural language text (~4 chars/token)
     *   - 'mixed': Mix of code and prose (~3.5 chars/token)
     */
    estimateTokens(text: string, contentType?: TokenContentType): number;
    /**
     * Estimate tokens for structured data
     */
    estimateDataTokens(data: unknown, contentType?: TokenContentType): number;
}
/**
 * Hook context for beforeCompaction callback
 */
interface CompactionHookContext {
    /** Agent identifier (if available) */
    agentId?: string;
    /** Current context budget info */
    currentBudget: ContextBudget;
    /** Compaction strategy being used */
    strategy: string;
    /** Current context components (read-only summaries) */
    components: ReadonlyArray<{
        name: string;
        priority: number;
        compactable: boolean;
    }>;
    /** Estimated tokens to be freed */
    estimatedTokensToFree: number;
}
/**
 * Hooks for context management events
 */
interface ContextManagerHooks {
    /**
     * Called before compaction occurs.
     * Use this to save important data before it gets compacted.
     * This is the last chance to preserve critical information.
     */
    beforeCompaction?: (context: CompactionHookContext) => Promise<void>;
}
/**
 * Abstract interface for compaction strategies
 */
interface IContextCompactor {
    /** Compactor name */
    readonly name: string;
    /** Priority order (lower = run first) */
    readonly priority: number;
    /**
     * Check if this compactor can handle the component
     */
    canCompact(component: IContextComponent): boolean;
    /**
     * Compact the component to target size
     */
    compact(component: IContextComponent, targetTokens: number): Promise<IContextComponent>;
    /**
     * Estimate savings from compaction
     */
    estimateSavings(component: IContextComponent): number;
}
/**
 * Context management strategy - defines the overall approach to managing context
 */
interface IContextStrategy {
    /** Strategy name */
    readonly name: string;
    /**
     * Decide if compaction is needed based on current budget
     */
    shouldCompact(budget: ContextBudget, config: ContextManagerConfig): boolean;
    /**
     * Execute compaction using available compactors
     */
    compact(components: IContextComponent[], budget: ContextBudget, compactors: IContextCompactor[], estimator: ITokenEstimator): Promise<{
        components: IContextComponent[];
        log: string[];
        tokensFreed: number;
    }>;
    /**
     * Optional: Prepare components before budget calculation
     * Use this for strategies that pre-process context (e.g., rolling window)
     */
    prepareComponents?(components: IContextComponent[]): Promise<IContextComponent[]>;
    /**
     * Optional: Post-process after compaction
     * Use this for strategies that need cleanup or optimization
     */
    postProcess?(components: IContextComponent[], budget: ContextBudget): Promise<IContextComponent[]>;
    /**
     * Optional: Get strategy-specific metrics
     */
    getMetrics?(): Record<string, unknown>;
}

/**
 * ContextManager - Universal context management with strategy support
 */

/**
 * Context manager events
 */
interface ContextManagerEvents {
    compacting: {
        reason: string;
        currentBudget: ContextBudget;
        strategy: string;
    };
    compacted: {
        log: string[];
        newBudget: ContextBudget;
        tokensFreed: number;
    };
    budget_warning: {
        budget: ContextBudget;
    };
    budget_critical: {
        budget: ContextBudget;
    };
    strategy_switched: {
        from: string;
        to: string;
        reason: string;
    };
}
/**
 * Universal Context Manager
 *
 * Works with any agent type through the IContextProvider interface.
 * Supports multiple compaction strategies that can be switched at runtime.
 */
declare class ContextManager extends EventEmitter<ContextManagerEvents> {
    private config;
    private provider;
    private estimator;
    private compactors;
    private strategy;
    private lastBudget?;
    private hooks;
    private agentId?;
    constructor(provider: IContextProvider, config?: Partial<ContextManagerConfig>, compactors?: IContextCompactor[], estimator?: ITokenEstimator, strategy?: IContextStrategy, hooks?: ContextManagerHooks, agentId?: string);
    /**
     * Set hooks at runtime
     */
    setHooks(hooks: ContextManagerHooks): void;
    /**
     * Set agent ID at runtime
     */
    setAgentId(agentId: string): void;
    /**
     * Prepare context for LLM call
     * Returns prepared components, automatically compacting if needed
     */
    prepare(): Promise<PreparedContext>;
    /**
     * Compact using the current strategy
     */
    private compactWithStrategy;
    /**
     * Calculate budget for components
     */
    private calculateBudget;
    /**
     * Estimate tokens for a component
     */
    private estimateComponent;
    /**
     * Switch to a different strategy at runtime
     */
    setStrategy(strategy: 'proactive' | 'aggressive' | 'lazy' | 'rolling-window' | 'adaptive' | IContextStrategy): void;
    /**
     * Get current strategy
     */
    getStrategy(): IContextStrategy;
    /**
     * Get strategy metrics
     */
    getStrategyMetrics(): Record<string, unknown>;
    /**
     * Get current budget
     */
    getCurrentBudget(): ContextBudget | null;
    /**
     * Get configuration
     */
    getConfig(): ContextManagerConfig;
    /**
     * Update configuration
     */
    updateConfig(updates: Partial<ContextManagerConfig>): void;
    /**
     * Add compactor
     */
    addCompactor(compactor: IContextCompactor): void;
    /**
     * Get all compactors
     */
    getCompactors(): IContextCompactor[];
    /**
     * Create estimator from name
     */
    private createEstimator;
    /**
     * Create strategy from name or config
     */
    private createStrategy;
}

/**
 * Interface for objects that manage resources and need explicit cleanup.
 *
 * Implementing classes should release all resources (event listeners, timers,
 * connections, etc.) when destroy() is called. After destruction, the instance
 * should not be used.
 */
interface IDisposable {
    /**
     * Releases all resources held by this instance.
     *
     * After calling destroy():
     * - All event listeners should be removed
     * - All timers/intervals should be cleared
     * - All internal state should be cleaned up
     * - The instance should not be reused
     *
     * Multiple calls to destroy() should be safe (idempotent).
     */
    destroy(): void;
    /**
     * Returns true if destroy() has been called.
     * Methods should check this before performing operations.
     */
    readonly isDestroyed: boolean;
}
/**
 * Async version of IDisposable for resources requiring async cleanup.
 */
interface IAsyncDisposable {
    /**
     * Asynchronously releases all resources held by this instance.
     */
    destroy(): Promise<void>;
    /**
     * Returns true if destroy() has been called.
     */
    readonly isDestroyed: boolean;
}
/**
 * Helper to check if an object is destroyed and throw if so.
 * @param obj - The disposable object to check
 * @param operation - Name of the operation being attempted
 */
declare function assertNotDestroyed(obj: IDisposable | IAsyncDisposable, operation: string): void;

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
 *
 * Implements IDisposable for proper lifecycle management.
 */

/**
 * Cache configuration
 */
interface IdempotencyCacheConfig {
    /** Default TTL for cached entries */
    defaultTtlMs: number;
    /** Max entries before eviction */
    maxEntries: number;
}
/**
 * Cache statistics
 */
interface CacheStats {
    entries: number;
    hits: number;
    misses: number;
    hitRate: number;
}
/**
 * Default configuration
 */
declare const DEFAULT_IDEMPOTENCY_CONFIG: IdempotencyCacheConfig;
/**
 * IdempotencyCache handles tool call result caching.
 *
 * Features:
 * - Cache based on tool name + args
 * - Custom key generation per tool
 * - TTL-based expiration
 * - Max entries eviction
 *
 * Implements IDisposable for proper resource cleanup.
 * Call destroy() when done to clear the background cleanup interval.
 */
declare class IdempotencyCache implements IDisposable {
    private config;
    private cache;
    private hits;
    private misses;
    private cleanupInterval?;
    private _isDestroyed;
    constructor(config?: IdempotencyCacheConfig);
    /**
     * Returns true if destroy() has been called.
     * Operations on a destroyed cache are no-ops.
     */
    get isDestroyed(): boolean;
    /**
     * Releases all resources held by this cache.
     * Clears the background cleanup interval and all cached entries.
     * Safe to call multiple times (idempotent).
     */
    destroy(): void;
    /**
     * Check if a tool's results should be cached.
     * Prefers 'cacheable' field, falls back to inverted 'safe' for backward compatibility.
     *
     * Logic:
     * - If 'cacheable' is defined, use it directly
     * - If only 'safe' is defined, cache when safe=false (backward compat)
     * - If neither defined, don't cache
     */
    private shouldCache;
    /**
     * Get cached result for tool call
     */
    get(tool: ToolFunction, args: Record<string, unknown>): Promise<unknown>;
    /**
     * Cache result for tool call
     */
    set(tool: ToolFunction, args: Record<string, unknown>, result: unknown): Promise<void>;
    /**
     * Check if tool call is cached
     */
    has(tool: ToolFunction, args: Record<string, unknown>): Promise<boolean>;
    /**
     * Invalidate cached result
     */
    invalidate(tool: ToolFunction, args: Record<string, unknown>): Promise<void>;
    /**
     * Invalidate all cached results for a tool
     */
    invalidateTool(tool: ToolFunction): Promise<void>;
    /**
     * Prune expired entries from cache
     */
    pruneExpired(): number;
    /**
     * Clear all cached results and stop background cleanup.
     * @deprecated Use destroy() instead for explicit lifecycle management.
     *             This method is kept for backward compatibility.
     */
    clear(): Promise<void>;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Generate cache key for tool + args
     */
    generateKey(tool: ToolFunction, args: Record<string, unknown>): string;
    /**
     * Simple hash function for objects
     */
    private hashObject;
}

/**
 * Memory entities for WorkingMemory
 *
 * This module provides a GENERIC memory system that works across all agent types:
 * - Basic Agent: Simple session/persistent scoping with static priority
 * - TaskAgent: Task-aware scoping with dynamic priority based on task states
 * - UniversalAgent: Mode-aware, switches strategy based on current mode
 *
 * The key abstraction is PriorityCalculator - a pluggable strategy that
 * determines entry priority for eviction decisions.
 */
/**
 * Simple scope for basic agents - just a lifecycle label
 */
type SimpleScope = 'session' | 'persistent';
/**
 * Task-aware scope for TaskAgent/UniversalAgent
 */
type TaskAwareScope = {
    type: 'task';
    taskIds: string[];
} | {
    type: 'plan';
} | {
    type: 'persistent';
};
/**
 * Union type - memory system accepts both
 */
type MemoryScope = SimpleScope | TaskAwareScope;
/**
 * Type guard: is this a task-aware scope?
 */
declare function isTaskAwareScope(scope: MemoryScope): scope is TaskAwareScope;
/**
 * Type guard: is this a simple scope?
 */
declare function isSimpleScope(scope: MemoryScope): scope is SimpleScope;
/**
 * Compare two scopes for equality
 * Handles both simple scopes (string comparison) and task-aware scopes (deep comparison)
 */
declare function scopeEquals(a: MemoryScope, b: MemoryScope): boolean;
/**
 * Check if a scope matches a filter scope
 * More flexible than scopeEquals - supports partial matching for task scopes
 */
declare function scopeMatches(entryScope: MemoryScope, filterScope: MemoryScope): boolean;
/**
 * Priority determines eviction order (lower priority evicted first)
 *
 * - critical: Never evicted (pinned, or actively in use)
 * - high: Important data, evicted only when necessary
 * - normal: Default priority
 * - low: Candidate for eviction (stale data, completed task data)
 */
type MemoryPriority = 'critical' | 'high' | 'normal' | 'low';
/**
 * Priority values for comparison (higher = more important, less likely to evict)
 */
declare const MEMORY_PRIORITY_VALUES: Record<MemoryPriority, number>;
/**
 * Memory tier for hierarchical data management
 *
 * The tier system provides a structured approach to managing research/analysis data:
 * - raw: Original data, low priority, first to be evicted
 * - summary: Processed summaries, normal priority
 * - findings: Final conclusions/insights, high priority, kept longest
 *
 * Workflow: raw → summary → findings (data gets more refined, priority increases)
 */
type MemoryTier = 'raw' | 'summary' | 'findings';
/**
 * Context passed to priority calculator - varies by agent type
 */
interface PriorityContext {
    /** For TaskAgent: map of taskId → current status */
    taskStates?: Map<string, TaskStatusForMemory>;
    /** For UniversalAgent: current mode */
    mode?: 'interactive' | 'planning' | 'executing';
    /** Custom context for extensions */
    [key: string]: unknown;
}
/**
 * Task status values for priority calculation
 */
type TaskStatusForMemory = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'cancelled';
/**
 * Check if a task status is terminal (task will not progress further)
 */
declare function isTerminalMemoryStatus(status: TaskStatusForMemory): boolean;
/**
 * Priority calculator function type.
 * Given an entry and optional context, returns the effective priority.
 */
type PriorityCalculator = (entry: MemoryEntry, context?: PriorityContext) => MemoryPriority;
/**
 * Reason why an entry became stale
 */
type StaleReason = 'task_completed' | 'task_failed' | 'unused' | 'scope_cleared';
/**
 * Information about a stale entry for LLM notification
 */
interface StaleEntryInfo {
    key: string;
    description: string;
    reason: StaleReason;
    previousPriority: MemoryPriority;
    newPriority: MemoryPriority;
    taskIds?: string[];
}
/**
 * Single memory entry stored in working memory
 */
interface MemoryEntry {
    key: string;
    description: string;
    value: unknown;
    sizeBytes: number;
    scope: MemoryScope;
    basePriority: MemoryPriority;
    pinned: boolean;
    createdAt: number;
    lastAccessedAt: number;
    accessCount: number;
}
/**
 * Index entry (lightweight, always in context)
 */
interface MemoryIndexEntry {
    key: string;
    description: string;
    size: string;
    scope: MemoryScope;
    effectivePriority: MemoryPriority;
    pinned: boolean;
}
/**
 * Full memory index with metadata
 */
interface MemoryIndex {
    entries: MemoryIndexEntry[];
    totalSizeBytes: number;
    totalSizeHuman: string;
    limitBytes: number;
    limitHuman: string;
    utilizationPercent: number;
}
/**
 * Configuration for working memory
 */
interface WorkingMemoryConfig {
    /** Max memory size in bytes. If not set, calculated from model context */
    maxSizeBytes?: number;
    /** Max description length */
    descriptionMaxLength: number;
    /** Percentage at which to warn agent */
    softLimitPercent: number;
    /** Percentage of model context to allocate to memory */
    contextAllocationPercent: number;
}
/**
 * Input for creating a memory entry
 */
interface MemoryEntryInput {
    key: string;
    description: string;
    value: unknown;
    /** Scope - defaults to 'session' for basic agents */
    scope?: MemoryScope;
    /** Base priority - may be overridden by dynamic calculation */
    priority?: MemoryPriority;
    /** If true, entry is never evicted */
    pinned?: boolean;
}
/**
 * Create a task-scoped memory entry input
 */
declare function forTasks(key: string, description: string, value: unknown, taskIds: string[], options?: {
    priority?: MemoryPriority;
    pinned?: boolean;
}): MemoryEntryInput;
/**
 * Create a plan-scoped memory entry input
 */
declare function forPlan(key: string, description: string, value: unknown, options?: {
    priority?: MemoryPriority;
    pinned?: boolean;
}): MemoryEntryInput;
/**
 * Default configuration values
 */
declare const DEFAULT_MEMORY_CONFIG: WorkingMemoryConfig;
/**
 * Calculate the size of a value in bytes (JSON serialization)
 * Uses Buffer.byteLength for accurate UTF-8 byte count
 */
declare function calculateEntrySize(value: unknown): number;

/**
 * IContextPlugin - Interface for context plugins
 *
 * Plugins extend AgentContext with custom context components.
 * Built-in plugins: PlanPlugin, MemoryPlugin, ToolOutputPlugin
 * Users can create custom plugins for domain-specific context.
 */

/**
 * Context plugin interface
 *
 * Plugins add custom components to the context (e.g., Plan, Memory, Tool Outputs).
 * Each plugin is responsible for:
 * - Providing its context component
 * - Handling compaction when space is needed
 * - Serializing/restoring state for sessions
 */
interface IContextPlugin {
    /**
     * Unique name for this plugin (used as component name)
     * Should be lowercase with underscores (e.g., 'plan', 'memory_index', 'tool_outputs')
     */
    readonly name: string;
    /**
     * Compaction priority (higher number = compact first)
     * - 0: Never compact (system_prompt, instructions, current_input)
     * - 1-3: Critical (plan, core instructions)
     * - 4-7: Important (conversation history)
     * - 8-10: Expendable (memory index, tool outputs)
     */
    readonly priority: number;
    /**
     * Whether this plugin's content can be compacted
     * If false, the component will never be reduced
     */
    readonly compactable: boolean;
    /**
     * Get this plugin's context component
     * Return null if plugin has no content for this turn
     *
     * @returns The component to include in context, or null if none
     */
    getComponent(): Promise<IContextComponent | null>;
    /**
     * Called when this plugin's content needs compaction
     * Plugin is responsible for reducing its size to fit within budget
     *
     * @param targetTokens - Target token count to reduce to (approximate)
     * @param estimator - Token estimator to use for calculations
     * @returns Number of tokens actually freed
     */
    compact?(targetTokens: number, estimator: ITokenEstimator): Promise<number>;
    /**
     * Called after context is prepared (opportunity for cleanup/logging)
     * Can be used to track context usage metrics
     *
     * @param budget - The final context budget after preparation
     */
    onPrepared?(budget: ContextBudget): Promise<void>;
    /**
     * Called when the context manager is being destroyed/cleaned up
     * Use for releasing resources
     */
    destroy?(): void;
    /**
     * Get state for session serialization
     * Return undefined if plugin has no state to persist
     */
    getState?(): unknown;
    /**
     * Restore from serialized state
     * Called when resuming a session
     *
     * @param state - Previously serialized state from getState()
     */
    restoreState?(state: unknown): void;
}
/**
 * Base class for context plugins with common functionality
 * Plugins can extend this or implement IContextPlugin directly
 */
declare abstract class BaseContextPlugin implements IContextPlugin {
    abstract readonly name: string;
    abstract readonly priority: number;
    abstract readonly compactable: boolean;
    abstract getComponent(): Promise<IContextComponent | null>;
    compact(_targetTokens: number, _estimator: ITokenEstimator): Promise<number>;
    onPrepared(_budget: ContextBudget): Promise<void>;
    destroy(): void;
    getState(): unknown;
    restoreState(_state: unknown): void;
}

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

/**
 * Priority levels for in-context memory entries
 */
type InContextPriority = 'low' | 'normal' | 'high' | 'critical';
/**
 * An entry stored in InContextMemory
 */
interface InContextEntry {
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
interface InContextMemoryConfig {
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
interface SerializedInContextMemoryState {
    entries: InContextEntry[];
    config: InContextMemoryConfig;
}
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
declare class InContextMemoryPlugin extends BaseContextPlugin {
    readonly name = "in_context_memory";
    readonly priority = 5;
    readonly compactable = true;
    private entries;
    private config;
    private destroyed;
    /**
     * Create an InContextMemoryPlugin
     *
     * @param config - Configuration options
     */
    constructor(config?: InContextMemoryConfig);
    /**
     * Check if plugin is destroyed
     */
    get isDestroyed(): boolean;
    /**
     * Store or update a key-value pair
     *
     * @param key - Unique key for this entry
     * @param description - Human-readable description (shown in context)
     * @param value - The value to store (any JSON-serializable data)
     * @param priority - Eviction priority (default from config)
     */
    set(key: string, description: string, value: unknown, priority?: InContextPriority): void;
    /**
     * Get a value by key
     *
     * @param key - The key to retrieve
     * @returns The value, or undefined if not found
     */
    get(key: string): unknown | undefined;
    /**
     * Check if a key exists
     *
     * @param key - The key to check
     */
    has(key: string): boolean;
    /**
     * Delete an entry by key
     *
     * @param key - The key to delete
     * @returns true if the key existed and was deleted
     */
    delete(key: string): boolean;
    /**
     * List all entries with metadata
     *
     * @returns Array of entry metadata (without full values)
     */
    list(): Array<{
        key: string;
        description: string;
        priority: InContextPriority;
        updatedAt: number;
    }>;
    /**
     * Clear all entries
     */
    clear(): void;
    /**
     * Get the number of entries
     */
    get size(): number;
    /**
     * Get the context component for this plugin
     */
    getComponent(): Promise<IContextComponent | null>;
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
    compact(targetTokens: number, estimator: ITokenEstimator): Promise<number>;
    /**
     * Get serialized state for session persistence
     */
    getState(): SerializedInContextMemoryState;
    /**
     * Restore state from serialization
     *
     * @param state - Previously serialized state
     */
    restoreState(state: unknown): void;
    /**
     * Clean up resources
     */
    destroy(): void;
    /**
     * Format entries as markdown for context
     */
    private formatContent;
    /**
     * Get entries sorted by eviction priority (lowest priority first, then oldest)
     */
    private getSortedEntriesForEviction;
    /**
     * Enforce max entries limit by evicting lowest-priority entries
     */
    private enforceMaxEntries;
    /**
     * Assert that the plugin hasn't been destroyed
     */
    private assertNotDestroyed;
}

/**
 * IPersistentInstructionsStorage - Storage interface for persistent instructions
 *
 * Abstracted storage interface following Clean Architecture principles.
 * Implementations can use file system, database, or any other storage backend.
 */
/**
 * Storage interface for persistent agent instructions
 *
 * Implementations handle the actual storage mechanism while the plugin
 * handles the business logic.
 */
interface IPersistentInstructionsStorage {
    /**
     * Load instructions from storage
     *
     * @returns The stored instructions content, or null if none exist
     */
    load(): Promise<string | null>;
    /**
     * Save instructions to storage
     *
     * @param content - The instructions content to save
     */
    save(content: string): Promise<void>;
    /**
     * Delete instructions from storage
     */
    delete(): Promise<void>;
    /**
     * Check if instructions exist in storage
     *
     * @returns true if instructions exist
     */
    exists(): Promise<boolean>;
    /**
     * Get the storage path (for display/debugging)
     *
     * @returns Human-readable path to the storage location
     */
    getPath(): string;
}

/**
 * PersistentInstructionsPlugin - Store agent-level custom instructions in files
 *
 * Unlike InContextMemory (volatile key-value pairs), this plugin stores
 * INSTRUCTIONS that persist across sessions in files on disk.
 *
 * Use cases:
 * - Agent personality/behavior customization
 * - User-specific preferences
 * - Accumulated knowledge/rules
 * - Custom tool usage guidelines
 *
 * Storage: ~/.oneringai/agents/<agentId>/custom_instructions.md
 *
 * Key Behaviors:
 * - Loaded automatically when feature is enabled
 * - Never compacted (priority 0)
 * - Session serialization tracks dirty state
 */

/**
 * Configuration for PersistentInstructionsPlugin
 */
interface PersistentInstructionsConfig {
    /** Agent ID - used to determine storage path */
    agentId: string;
    /** Custom storage implementation (default: FilePersistentInstructionsStorage) */
    storage?: IPersistentInstructionsStorage;
    /** Maximum instructions length in characters (default: 50000) */
    maxLength?: number;
}
/**
 * Serialized state for session persistence
 */
interface SerializedPersistentInstructionsState {
    content: string | null;
    dirty: boolean;
    agentId: string;
}
/**
 * PersistentInstructionsPlugin - Persists custom instructions across sessions
 *
 * This plugin manages custom instructions that:
 * - Are stored on disk (survive process restarts)
 * - Can be modified by the LLM during execution
 * - Are never compacted (always included in context)
 * - Support append operations for incremental updates
 */
declare class PersistentInstructionsPlugin extends BaseContextPlugin {
    readonly name = "persistent_instructions";
    readonly priority = 0;
    readonly compactable = false;
    private _content;
    private _dirty;
    private _initialized;
    private _destroyed;
    private readonly storage;
    private readonly maxLength;
    private readonly agentId;
    /**
     * Create a PersistentInstructionsPlugin
     *
     * @param config - Configuration options (agentId is required)
     */
    constructor(config: PersistentInstructionsConfig);
    /**
     * Check if plugin is destroyed
     */
    get isDestroyed(): boolean;
    /**
     * Check if plugin has been initialized (loaded from disk)
     */
    get isInitialized(): boolean;
    /**
     * Check if content has been modified since last save
     */
    get isDirty(): boolean;
    /**
     * Initialize by loading instructions from storage
     * Called lazily on first getComponent() call
     */
    initialize(): Promise<void>;
    /**
     * Set the entire instructions content (replaces existing)
     *
     * @param content - New instructions content
     * @returns true if set successfully, false if content exceeds max length
     */
    set(content: string): Promise<boolean>;
    /**
     * Append a section to existing instructions
     *
     * @param section - Section to append (will add newlines before)
     * @returns true if appended successfully, false if would exceed max length
     */
    append(section: string): Promise<boolean>;
    /**
     * Get current instructions content
     *
     * @returns Instructions content, or null if none
     */
    get(): string | null;
    /**
     * Check if instructions exist
     */
    has(): boolean;
    /**
     * Clear all instructions
     */
    clear(): Promise<void>;
    /**
     * Get storage path (for display/debugging)
     */
    getPath(): string;
    /**
     * Get agent ID
     */
    getAgentId(): string;
    /**
     * Get current content length
     */
    getLength(): number;
    /**
     * Get maximum allowed content length
     */
    getMaxLength(): number;
    /**
     * Get the context component for this plugin
     * Performs lazy initialization on first call
     */
    getComponent(): Promise<IContextComponent | null>;
    /**
     * Compact - not applicable (compactable is false)
     */
    compact(_targetTokens: number, _estimator: ITokenEstimator): Promise<number>;
    /**
     * Get serialized state for session persistence
     */
    getState(): SerializedPersistentInstructionsState;
    /**
     * Restore state from serialization
     * Note: This restores in-memory state, not disk state
     */
    restoreState(state: unknown): void;
    /**
     * Clean up resources
     */
    destroy(): void;
    /**
     * Assert that the plugin hasn't been destroyed
     */
    private assertNotDestroyed;
}

/**
 * Tool context interface - passed to tools during execution
 */

/**
 * Limited memory access for tools
 *
 * This interface is designed to work with all agent types:
 * - Basic agents: Use simple scopes ('session', 'persistent')
 * - TaskAgent: Use task-aware scopes ({ type: 'task', taskIds: [...] })
 * - UniversalAgent: Switches between simple and task-aware based on mode
 */
interface WorkingMemoryAccess {
    get(key: string): Promise<unknown>;
    /**
     * Store a value in memory
     *
     * @param key - Unique key for the entry
     * @param description - Short description (max 150 chars)
     * @param value - Data to store
     * @param options - Optional scope, priority, and pinning
     */
    set(key: string, description: string, value: unknown, options?: {
        /** Scope determines lifecycle - defaults to 'session' */
        scope?: MemoryScope;
        /** Base priority for eviction ordering */
        priority?: MemoryPriority;
        /** If true, entry is never evicted */
        pinned?: boolean;
    }): Promise<void>;
    delete(key: string): Promise<void>;
    has(key: string): Promise<boolean>;
    /**
     * List all memory entries
     * Returns key, description, and computed priority info
     */
    list(): Promise<Array<{
        key: string;
        description: string;
        effectivePriority?: MemoryPriority;
        pinned?: boolean;
    }>>;
}
/**
 * Context passed to tool execute function
 */
interface ToolContext {
    /** Agent ID (for logging/tracing) */
    agentId: string;
    /** Task ID (if running in TaskAgent) */
    taskId?: string;
    /** Working memory access (if running in TaskAgent) */
    memory?: WorkingMemoryAccess;
    /** Context manager (if running in TaskAgent) */
    contextManager?: ContextManager;
    /** Idempotency cache (if running in TaskAgent) */
    idempotencyCache?: IdempotencyCache;
    /** In-context memory plugin (if set up with setupInContextMemory) */
    inContextMemory?: InContextMemoryPlugin;
    /** Persistent instructions plugin (if features.persistentInstructions is enabled) */
    persistentInstructions?: PersistentInstructionsPlugin;
    /** Abort signal for cancellation */
    signal?: AbortSignal;
}

/**
 * Tool entities with blocking/non-blocking execution support
 */

interface JSONSchema {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
}
interface FunctionToolDefinition {
    type: 'function';
    function: {
        name: string;
        description?: string;
        parameters?: JSONSchema;
        strict?: boolean;
    };
    blocking?: boolean;
    timeout?: number;
}
interface BuiltInTool {
    type: 'web_search' | 'file_search' | 'computer_use' | 'code_interpreter';
    blocking?: boolean;
}
type Tool = FunctionToolDefinition | BuiltInTool;
declare enum ToolCallState {
    PENDING = "pending",// Tool call identified, not yet executed
    EXECUTING = "executing",// Currently executing
    COMPLETED = "completed",// Successfully completed
    FAILED = "failed",// Execution failed
    TIMEOUT = "timeout"
}
interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
    blocking: boolean;
    state: ToolCallState;
    startTime?: Date;
    endTime?: Date;
    error?: string;
}
interface ToolResult {
    tool_use_id: string;
    content: any;
    error?: string;
    executionTime?: number;
    state: ToolCallState;
}
/**
 * Tool execution context - tracks all tool calls in a generation
 */
interface ToolExecutionContext {
    executionId: string;
    toolCalls: Map<string, ToolCall>;
    pendingNonBlocking: Set<string>;
    completedResults: Map<string, ToolResult>;
}
/**
 * Output handling hints for context management
 */
interface ToolOutputHints {
    expectedSize?: 'small' | 'medium' | 'large' | 'variable';
    summarize?: (output: unknown) => string;
}
/**
 * Idempotency configuration for tool caching
 */
interface ToolIdempotency {
    /**
     * @deprecated Use 'cacheable' instead. Will be removed in a future version.
     * If true, tool is naturally idempotent (e.g., read-only) and doesn't need caching.
     * If false, tool results should be cached based on arguments.
     */
    safe?: boolean;
    /**
     * If true, tool results can be cached based on arguments.
     * Use this for tools that return deterministic results for the same inputs.
     * Takes precedence over the deprecated 'safe' field.
     * @default false
     */
    cacheable?: boolean;
    keyFn?: (args: Record<string, unknown>) => string;
    ttlMs?: number;
}
/**
 * Permission configuration for a tool
 *
 * Controls when approval is required for tool execution.
 * Used by the ToolPermissionManager.
 */
interface ToolPermissionConfig$1 {
    /**
     * When approval is required.
     * - 'once' - Require approval for each call
     * - 'session' - Approve once per session
     * - 'always' - Auto-approve (no prompts)
     * - 'never' - Always blocked
     * @default 'once'
     */
    scope?: 'once' | 'session' | 'always' | 'never';
    /**
     * Risk level classification.
     * @default 'low'
     */
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    /**
     * Custom message shown in approval UI.
     */
    approvalMessage?: string;
    /**
     * Argument names that should be highlighted as sensitive.
     */
    sensitiveArgs?: string[];
    /**
     * TTL for session approvals (milliseconds).
     */
    sessionTTLMs?: number;
}
/**
 * User-provided tool function
 */
interface ToolFunction<TArgs = any, TResult = any> {
    definition: FunctionToolDefinition;
    execute: (args: TArgs, context?: ToolContext) => Promise<TResult>;
    idempotency?: ToolIdempotency;
    output?: ToolOutputHints;
    /** Permission settings for this tool. If not set, defaults are used. */
    permission?: ToolPermissionConfig$1;
    /**
     * Returns a human-readable description of a tool call.
     * Used for logging, UI display, and debugging.
     *
     * @param args - The arguments passed to the tool
     * @returns A concise description (e.g., "reading /path/to/file.ts")
     *
     * If not implemented, use `defaultDescribeCall()` as a fallback.
     *
     * @example
     * // For read_file tool:
     * describeCall: (args) => args.file_path
     *
     * @example
     * // For bash tool:
     * describeCall: (args) => args.command.length > 50
     *   ? args.command.slice(0, 47) + '...'
     *   : args.command
     */
    describeCall?: (args: TArgs) => string;
}
/**
 * Default implementation for describeCall.
 * Shows the first meaningful argument value.
 *
 * @param args - Tool arguments object
 * @param maxLength - Maximum length before truncation (default: 60)
 * @returns Human-readable description
 *
 * @example
 * defaultDescribeCall({ file_path: '/path/to/file.ts' })
 * // Returns: '/path/to/file.ts'
 *
 * @example
 * defaultDescribeCall({ query: 'search term', limit: 10 })
 * // Returns: 'search term'
 */
declare function defaultDescribeCall(args: Record<string, unknown>, maxLength?: number): string;
/**
 * Get a human-readable description of a tool call.
 * Uses the tool's describeCall method if available, otherwise falls back to default.
 *
 * @param tool - The tool function
 * @param args - The arguments passed to the tool
 * @returns Human-readable description
 */
declare function getToolCallDescription<TArgs>(tool: ToolFunction<TArgs>, args: TArgs): string;

/**
 * Tool executor interface
 */

interface IToolExecutor {
    /**
     * Execute a tool function
     * @param toolName - Name of the tool to execute
     * @param args - Parsed arguments object
     * @returns Tool execution result
     */
    execute(toolName: string, args: any): Promise<any>;
    /**
     * Check if tool is available
     */
    hasToolFunction(toolName: string): boolean;
    /**
     * Get tool definition
     */
    getToolDefinition(toolName: string): Tool | undefined;
    /**
     * Register a new tool
     */
    registerTool(tool: ToolFunction): void;
    /**
     * Unregister a tool
     */
    unregisterTool(toolName: string): void;
    /**
     * List all registered tools
     */
    listTools(): string[];
}

/**
 * Tool Permission Types
 *
 * Defines permission scopes, risk levels, and approval state for tool execution control.
 *
 * Works with ALL agent types:
 * - Agent (basic)
 * - TaskAgent (task-based)
 * - UniversalAgent (mode-fluid)
 */

/**
 * Permission scope defines when approval is required for a tool
 *
 * - `once` - Require approval for each tool call (most restrictive)
 * - `session` - Approve once, valid for entire session
 * - `always` - Auto-approve (allowlisted, no prompts)
 * - `never` - Always blocked (blocklisted, tool cannot execute)
 */
type PermissionScope = 'once' | 'session' | 'always' | 'never';
/**
 * Risk level classification for tools
 *
 * Used to help users understand the potential impact of approving a tool.
 * Can be used by UI to show different approval dialogs.
 */
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
/**
 * Permission configuration for a tool
 *
 * Can be set on the tool definition or overridden at registration time.
 */
interface ToolPermissionConfig {
    /**
     * When approval is required.
     * @default 'once'
     */
    scope?: PermissionScope;
    /**
     * Risk classification for the tool.
     * @default 'low'
     */
    riskLevel?: RiskLevel;
    /**
     * Custom message shown in approval UI.
     * Should explain what the tool does and any potential risks.
     */
    approvalMessage?: string;
    /**
     * Argument names that should be highlighted in approval UI.
     * E.g., ['path', 'url'] for file/network operations.
     */
    sensitiveArgs?: string[];
    /**
     * Optional expiration time for session approvals (milliseconds).
     * If set, session approvals expire after this duration.
     */
    sessionTTLMs?: number;
}
/**
 * Context passed to approval callbacks/hooks
 */
interface PermissionCheckContext {
    /** The tool call being checked */
    toolCall: ToolCall;
    /** Parsed arguments (for display/inspection) */
    parsedArgs: Record<string, unknown>;
    /** The tool's permission config */
    config: ToolPermissionConfig;
    /** Current execution context ID */
    executionId: string;
    /** Current iteration (if in agentic loop) */
    iteration: number;
    /** Agent type (for context-specific handling) */
    agentType: 'agent' | 'task-agent' | 'universal-agent';
    /** Optional task name (for TaskAgent/UniversalAgent) */
    taskName?: string;
}
/**
 * Entry in the approval cache representing an approved tool
 */
interface ApprovalCacheEntry {
    /** Name of the approved tool */
    toolName: string;
    /** The scope that was approved */
    scope: PermissionScope;
    /** When the approval was granted */
    approvedAt: Date;
    /** Optional identifier of who approved (for audit) */
    approvedBy?: string;
    /** When this approval expires (for session/TTL approvals) */
    expiresAt?: Date;
    /** Arguments hash if approval was for specific arguments */
    argsHash?: string;
}
/**
 * Serialized approval state for session persistence
 */
interface SerializedApprovalState {
    /** Version for future migrations */
    version: number;
    /** Map of tool name to approval entry */
    approvals: Record<string, SerializedApprovalEntry>;
    /** Tools that are always blocked (persisted blocklist) */
    blocklist: string[];
    /** Tools that are always allowed (persisted allowlist) */
    allowlist: string[];
}
/**
 * Serialized version of ApprovalCacheEntry (with ISO date strings)
 */
interface SerializedApprovalEntry {
    toolName: string;
    scope: PermissionScope;
    approvedAt: string;
    approvedBy?: string;
    expiresAt?: string;
    argsHash?: string;
}
/**
 * Result of checking if a tool needs approval
 */
interface PermissionCheckResult {
    /** Whether the tool can execute without prompting */
    allowed: boolean;
    /** Whether approval is needed (user should be prompted) */
    needsApproval: boolean;
    /** Whether the tool is blocked (cannot execute at all) */
    blocked: boolean;
    /** Reason for the decision */
    reason: string;
    /** The tool's permission config (for UI display) */
    config?: ToolPermissionConfig;
}
/**
 * Result from approval UI/hook
 */
interface ApprovalDecision {
    /** Whether the tool was approved */
    approved: boolean;
    /** Scope of the approval (may differ from requested) */
    scope?: PermissionScope;
    /** Reason for denial (if not approved) */
    reason?: string;
    /** Optional identifier of who approved */
    approvedBy?: string;
    /** Whether to remember this decision for future calls */
    remember?: boolean;
}
/**
 * Permission configuration for any agent type.
 *
 * Used in:
 * - Agent.create({ permissions: {...} })
 * - TaskAgent.create({ permissions: {...} })
 * - UniversalAgent.create({ permissions: {...} })
 */
interface AgentPermissionsConfig {
    /**
     * Default permission scope for tools without explicit config.
     * @default 'once'
     */
    defaultScope?: PermissionScope;
    /**
     * Default risk level for tools without explicit config.
     * @default 'low'
     */
    defaultRiskLevel?: RiskLevel;
    /**
     * Tools that are always allowed (never prompt).
     * Array of tool names.
     */
    allowlist?: string[];
    /**
     * Tools that are always blocked (cannot execute).
     * Array of tool names.
     */
    blocklist?: string[];
    /**
     * Per-tool permission overrides.
     * Keys are tool names, values are permission configs.
     */
    tools?: Record<string, ToolPermissionConfig>;
    /**
     * Callback invoked when a tool needs approval.
     * Return an ApprovalDecision to approve/deny.
     *
     * If not provided, the existing `approve:tool` hook system is used.
     * This callback runs BEFORE hooks, providing a first-pass check.
     */
    onApprovalRequired?: (context: PermissionCheckContext) => Promise<ApprovalDecision>;
    /**
     * Whether to inherit permission state from parent session.
     * Only applies when resuming from a session.
     * @default true
     */
    inheritFromSession?: boolean;
}
/**
 * Events emitted by ToolPermissionManager
 */
type PermissionManagerEvent = 'tool:approved' | 'tool:denied' | 'tool:blocked' | 'tool:revoked' | 'allowlist:added' | 'allowlist:removed' | 'blocklist:added' | 'blocklist:removed' | 'session:cleared';
/**
 * Current version of serialized approval state
 */
declare const APPROVAL_STATE_VERSION = 1;
/**
 * Default permission config applied when no config is specified
 */
declare const DEFAULT_PERMISSION_CONFIG: Required<Pick<ToolPermissionConfig, 'scope' | 'riskLevel'>>;
/**
 * Default allowlist - tools that never require user confirmation.
 *
 * These tools are safe to execute without user approval:
 * - Read-only operations (filesystem reads, searches)
 * - Internal state management (memory tools)
 * - Introspection tools (context/cache stats)
 * - Meta-tools for agent coordination
 *
 * All other tools (write operations, shell commands, external requests)
 * require explicit user approval by default.
 */
declare const DEFAULT_ALLOWLIST: readonly string[];
/**
 * Type for default allowlisted tools
 */
type DefaultAllowlistedTool = (typeof DEFAULT_ALLOWLIST)[number];

/**
 * ToolPermissionManager - Core class for managing tool permissions
 *
 * Features:
 * - Approval caching (once, session, always, never scopes)
 * - Allowlist/blocklist management
 * - Session state persistence
 * - Event emission for audit trails
 *
 * Works with ALL agent types:
 * - Agent (basic)
 * - TaskAgent (task-based)
 * - UniversalAgent (mode-fluid)
 */

declare class ToolPermissionManager extends EventEmitter {
    private approvalCache;
    private allowlist;
    private blocklist;
    private toolConfigs;
    private defaultScope;
    private defaultRiskLevel;
    private onApprovalRequired?;
    constructor(config?: AgentPermissionsConfig);
    /**
     * Check if a tool needs approval before execution
     *
     * @param toolName - Name of the tool
     * @param _args - Optional arguments (for args-specific approval, reserved for future use)
     * @returns PermissionCheckResult with allowed/needsApproval/blocked status
     */
    checkPermission(toolName: string, _args?: Record<string, unknown>): PermissionCheckResult;
    /**
     * Check if a tool call needs approval (uses ToolCall object)
     */
    needsApproval(toolCall: ToolCall): boolean;
    /**
     * Check if a tool is blocked
     */
    isBlocked(toolName: string): boolean;
    /**
     * Check if a tool is approved (either allowlisted or session-approved)
     */
    isApproved(toolName: string): boolean;
    /**
     * Approve a tool (record approval)
     *
     * @param toolName - Name of the tool
     * @param decision - Approval decision with scope
     */
    approve(toolName: string, decision?: Partial<ApprovalDecision>): void;
    /**
     * Approve a tool for the entire session
     */
    approveForSession(toolName: string, approvedBy?: string): void;
    /**
     * Revoke a tool's approval
     */
    revoke(toolName: string): void;
    /**
     * Deny a tool execution (for audit trail)
     */
    deny(toolName: string, reason: string): void;
    /**
     * Check if a tool has been approved for the current session
     */
    isApprovedForSession(toolName: string): boolean;
    /**
     * Add a tool to the allowlist (always allowed)
     */
    allowlistAdd(toolName: string): void;
    /**
     * Remove a tool from the allowlist
     */
    allowlistRemove(toolName: string): void;
    /**
     * Check if a tool is in the allowlist
     */
    isAllowlisted(toolName: string): boolean;
    /**
     * Get all allowlisted tools
     */
    getAllowlist(): string[];
    /**
     * Add a tool to the blocklist (always blocked)
     */
    blocklistAdd(toolName: string): void;
    /**
     * Remove a tool from the blocklist
     */
    blocklistRemove(toolName: string): void;
    /**
     * Check if a tool is in the blocklist
     */
    isBlocklisted(toolName: string): boolean;
    /**
     * Get all blocklisted tools
     */
    getBlocklist(): string[];
    /**
     * Set permission config for a specific tool
     */
    setToolConfig(toolName: string, config: ToolPermissionConfig): void;
    /**
     * Get permission config for a specific tool
     */
    getToolConfig(toolName: string): ToolPermissionConfig | undefined;
    /**
     * Get effective config (tool-specific or defaults)
     */
    getEffectiveConfig(toolName: string): ToolPermissionConfig;
    /**
     * Request approval for a tool call
     *
     * If an onApprovalRequired callback is set, it will be called.
     * Otherwise, this auto-approves for backward compatibility.
     *
     * NOTE: If you want to require explicit approval, you MUST either:
     * 1. Set onApprovalRequired callback in AgentPermissionsConfig
     * 2. Register an 'approve:tool' hook in the AgenticLoop
     * 3. Add tools to the blocklist if they should never run
     *
     * This auto-approval behavior preserves backward compatibility with
     * existing code that doesn't use the permission system.
     */
    requestApproval(context: PermissionCheckContext): Promise<ApprovalDecision>;
    /**
     * Get all tools that have session approvals
     */
    getApprovedTools(): string[];
    /**
     * Get the approval entry for a tool
     */
    getApprovalEntry(toolName: string): ApprovalCacheEntry | undefined;
    /**
     * Clear all session approvals
     */
    clearSession(): void;
    /**
     * Serialize approval state for persistence
     */
    getState(): SerializedApprovalState;
    /**
     * Load approval state from persistence
     */
    loadState(state: SerializedApprovalState): void;
    /**
     * Get defaults
     */
    getDefaults(): {
        scope: PermissionScope;
        riskLevel: RiskLevel;
    };
    /**
     * Set defaults
     */
    setDefaults(defaults: {
        scope?: PermissionScope;
        riskLevel?: RiskLevel;
    }): void;
    /**
     * Get summary statistics
     */
    getStats(): {
        approvedCount: number;
        allowlistedCount: number;
        blocklistedCount: number;
        configuredCount: number;
    };
    /**
     * Reset to initial state
     */
    reset(): void;
}

/**
 * Content types based on OpenAI Responses API format
 */
declare enum ContentType {
    INPUT_TEXT = "input_text",
    INPUT_IMAGE_URL = "input_image_url",
    INPUT_FILE = "input_file",
    OUTPUT_TEXT = "output_text",
    TOOL_USE = "tool_use",
    TOOL_RESULT = "tool_result"
}
interface BaseContent {
    type: ContentType;
}
interface InputTextContent extends BaseContent {
    type: ContentType.INPUT_TEXT;
    text: string;
}
interface InputImageContent extends BaseContent {
    type: ContentType.INPUT_IMAGE_URL;
    image_url: {
        url: string;
        detail?: 'auto' | 'low' | 'high';
    };
}
interface InputFileContent extends BaseContent {
    type: ContentType.INPUT_FILE;
    file_id: string;
}
interface OutputTextContent extends BaseContent {
    type: ContentType.OUTPUT_TEXT;
    text: string;
    annotations?: any[];
}
interface ToolUseContent extends BaseContent {
    type: ContentType.TOOL_USE;
    id: string;
    name: string;
    arguments: string;
}
interface ToolResultContent extends BaseContent {
    type: ContentType.TOOL_RESULT;
    tool_use_id: string;
    content: string | any;
    error?: string;
}
type Content = InputTextContent | InputImageContent | InputFileContent | OutputTextContent | ToolUseContent | ToolResultContent;

/**
 * Message entity based on OpenAI Responses API format
 */

declare enum MessageRole {
    USER = "user",
    ASSISTANT = "assistant",
    DEVELOPER = "developer"
}
interface Message {
    type: 'message';
    id?: string;
    role: MessageRole;
    content: Content[];
}
interface CompactionItem {
    type: 'compaction';
    id: string;
    encrypted_content: string;
}
interface ReasoningItem {
    type: 'reasoning';
    id: string;
    effort?: 'low' | 'medium' | 'high';
    summary?: string;
    encrypted_content?: string;
}
type InputItem = Message | CompactionItem;
type OutputItem = Message | CompactionItem | ReasoningItem;

/**
 * LLM Response entity based on OpenAI Responses API format
 */

/**
 * Token usage statistics
 */
interface TokenUsage {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    output_tokens_details?: {
        reasoning_tokens: number;
    };
}
interface LLMResponse {
    id: string;
    object: 'response';
    created_at: number;
    status: 'completed' | 'failed' | 'in_progress' | 'cancelled' | 'queued' | 'incomplete';
    model: string;
    output: OutputItem[];
    output_text?: string;
    usage: TokenUsage;
    error?: {
        type: string;
        message: string;
    };
    metadata?: Record<string, string>;
}
type AgentResponse = LLMResponse;

/**
 * Streaming event types for real-time LLM responses
 * Based on OpenAI Responses API event format as the internal standard
 */

/**
 * Stream event type enum
 */
declare enum StreamEventType {
    RESPONSE_CREATED = "response.created",
    RESPONSE_IN_PROGRESS = "response.in_progress",
    OUTPUT_TEXT_DELTA = "response.output_text.delta",
    OUTPUT_TEXT_DONE = "response.output_text.done",
    TOOL_CALL_START = "response.tool_call.start",
    TOOL_CALL_ARGUMENTS_DELTA = "response.tool_call_arguments.delta",
    TOOL_CALL_ARGUMENTS_DONE = "response.tool_call_arguments.done",
    TOOL_EXECUTION_START = "response.tool_execution.start",
    TOOL_EXECUTION_DONE = "response.tool_execution.done",
    ITERATION_COMPLETE = "response.iteration.complete",
    RESPONSE_COMPLETE = "response.complete",
    ERROR = "response.error"
}
/**
 * Base interface for all stream events
 */
interface BaseStreamEvent {
    type: StreamEventType;
    response_id: string;
}
/**
 * Response created - first event in stream
 */
interface ResponseCreatedEvent extends BaseStreamEvent {
    type: StreamEventType.RESPONSE_CREATED;
    model: string;
    created_at: number;
}
/**
 * Response in progress
 */
interface ResponseInProgressEvent extends BaseStreamEvent {
    type: StreamEventType.RESPONSE_IN_PROGRESS;
}
/**
 * Text delta - incremental text output
 */
interface OutputTextDeltaEvent extends BaseStreamEvent {
    type: StreamEventType.OUTPUT_TEXT_DELTA;
    item_id: string;
    output_index: number;
    content_index: number;
    delta: string;
    sequence_number: number;
}
/**
 * Text output complete for this item
 */
interface OutputTextDoneEvent extends BaseStreamEvent {
    type: StreamEventType.OUTPUT_TEXT_DONE;
    item_id: string;
    output_index: number;
    text: string;
}
/**
 * Tool call detected and starting
 */
interface ToolCallStartEvent extends BaseStreamEvent {
    type: StreamEventType.TOOL_CALL_START;
    item_id: string;
    tool_call_id: string;
    tool_name: string;
}
/**
 * Tool call arguments delta - incremental JSON
 */
interface ToolCallArgumentsDeltaEvent extends BaseStreamEvent {
    type: StreamEventType.TOOL_CALL_ARGUMENTS_DELTA;
    item_id: string;
    tool_call_id: string;
    tool_name: string;
    delta: string;
    sequence_number: number;
}
/**
 * Tool call arguments complete
 */
interface ToolCallArgumentsDoneEvent extends BaseStreamEvent {
    type: StreamEventType.TOOL_CALL_ARGUMENTS_DONE;
    tool_call_id: string;
    tool_name: string;
    arguments: string;
    incomplete?: boolean;
}
/**
 * Tool execution starting
 */
interface ToolExecutionStartEvent extends BaseStreamEvent {
    type: StreamEventType.TOOL_EXECUTION_START;
    tool_call_id: string;
    tool_name: string;
    arguments: any;
}
/**
 * Tool execution complete
 */
interface ToolExecutionDoneEvent extends BaseStreamEvent {
    type: StreamEventType.TOOL_EXECUTION_DONE;
    tool_call_id: string;
    tool_name: string;
    result: any;
    execution_time_ms: number;
    error?: string;
}
/**
 * Iteration complete - end of agentic loop iteration
 */
interface IterationCompleteEvent$1 extends BaseStreamEvent {
    type: StreamEventType.ITERATION_COMPLETE;
    iteration: number;
    tool_calls_count: number;
    has_more_iterations: boolean;
}
/**
 * Response complete - final event
 */
interface ResponseCompleteEvent extends BaseStreamEvent {
    type: StreamEventType.RESPONSE_COMPLETE;
    status: 'completed' | 'incomplete' | 'failed';
    usage: TokenUsage;
    iterations: number;
    duration_ms?: number;
}
/**
 * Error event
 */
interface ErrorEvent extends BaseStreamEvent {
    type: StreamEventType.ERROR;
    error: {
        type: string;
        message: string;
        code?: string;
    };
    recoverable: boolean;
}
/**
 * Union type of all stream events
 * Discriminated by 'type' field for type narrowing
 */
type StreamEvent = ResponseCreatedEvent | ResponseInProgressEvent | OutputTextDeltaEvent | OutputTextDoneEvent | ToolCallStartEvent | ToolCallArgumentsDeltaEvent | ToolCallArgumentsDoneEvent | ToolExecutionStartEvent | ToolExecutionDoneEvent | IterationCompleteEvent$1 | ResponseCompleteEvent | ErrorEvent;
/**
 * Type guard to check if event is a specific type
 */
declare function isStreamEvent<T extends StreamEvent>(event: StreamEvent, type: StreamEventType): event is T;
/**
 * Type guards for specific events
 */
declare function isOutputTextDelta(event: StreamEvent): event is OutputTextDeltaEvent;
declare function isToolCallStart(event: StreamEvent): event is ToolCallStartEvent;
declare function isToolCallArgumentsDelta(event: StreamEvent): event is ToolCallArgumentsDeltaEvent;
declare function isToolCallArgumentsDone(event: StreamEvent): event is ToolCallArgumentsDoneEvent;
declare function isResponseComplete(event: StreamEvent): event is ResponseCompleteEvent;
declare function isErrorEvent(event: StreamEvent): event is ErrorEvent;

/**
 * Text generation provider interface
 */

interface TextGenerateOptions {
    model: string;
    input: string | InputItem[];
    instructions?: string;
    tools?: Tool[];
    tool_choice?: 'auto' | 'required' | {
        type: 'function';
        function: {
            name: string;
        };
    };
    temperature?: number;
    max_output_tokens?: number;
    response_format?: {
        type: 'text' | 'json_object' | 'json_schema';
        json_schema?: any;
    };
    parallel_tool_calls?: boolean;
    previous_response_id?: string;
    metadata?: Record<string, string>;
    /** Vendor-specific options (e.g., Google's thinkingLevel, OpenAI's reasoning_effort) */
    vendorOptions?: Record<string, any>;
}
interface ModelCapabilities {
    supportsTools: boolean;
    supportsVision: boolean;
    supportsJSON: boolean;
    supportsJSONSchema: boolean;
    maxTokens: number;
    maxInputTokens?: number;
    maxOutputTokens?: number;
}
interface ITextProvider extends IProvider {
    /**
     * Generate text response
     */
    generate(options: TextGenerateOptions): Promise<LLMResponse>;
    /**
     * Stream text response with real-time events
     * Returns an async iterator of streaming events
     */
    streamGenerate(options: TextGenerateOptions): AsyncIterableIterator<StreamEvent>;
    /**
     * Get model capabilities
     */
    getModelCapabilities(model: string): ModelCapabilities;
    /**
     * List available models
     */
    listModels?(): Promise<string[]>;
}

/**
 * Execution context - tracks state, metrics, and history for agent execution
 * Includes memory safety (circular buffers) and resource limits
 */

type HistoryMode = 'none' | 'summary' | 'full';
interface ExecutionContextConfig {
    maxHistorySize?: number;
    historyMode?: HistoryMode;
    maxAuditTrailSize?: number;
}
interface IterationRecord {
    iteration: number;
    request: TextGenerateOptions;
    response: AgentResponse;
    toolCalls: ToolCall[];
    toolResults: ToolResult[];
    startTime: Date;
    endTime: Date;
}
interface IterationSummary {
    iteration: number;
    tokens: number;
    toolCount: number;
    duration: number;
    timestamp: Date;
}
interface ExecutionMetrics {
    totalDuration: number;
    llmDuration: number;
    toolDuration: number;
    hookDuration: number;
    iterationCount: number;
    toolCallCount: number;
    toolSuccessCount: number;
    toolFailureCount: number;
    toolTimeoutCount: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    errors: Array<{
        type: string;
        message: string;
        timestamp: Date;
    }>;
}
interface AuditEntry {
    timestamp: Date;
    type: 'hook_executed' | 'tool_modified' | 'tool_skipped' | 'execution_paused' | 'execution_resumed' | 'tool_approved' | 'tool_rejected' | 'tool_blocked' | 'tool_permission_approved';
    hookName?: string;
    toolName?: string;
    details: any;
}
declare class ExecutionContext {
    readonly executionId: string;
    readonly startTime: Date;
    iteration: number;
    readonly toolCalls: Map<string, ToolCall>;
    readonly toolResults: Map<string, ToolResult>;
    paused: boolean;
    pauseReason?: string;
    cancelled: boolean;
    cancelReason?: string;
    readonly metadata: Map<string, any>;
    private readonly config;
    private readonly iterations;
    private readonly iterationSummaries;
    readonly metrics: ExecutionMetrics;
    private readonly auditTrail;
    constructor(executionId: string, config?: ExecutionContextConfig);
    /**
     * Add iteration to history (memory-safe)
     */
    addIteration(record: IterationRecord): void;
    /**
     * Get iteration history
     */
    getHistory(): IterationRecord[] | IterationSummary[];
    /**
     * Add audit entry
     */
    audit(type: AuditEntry['type'], details: any, hookName?: string, toolName?: string): void;
    /**
     * Get audit trail
     */
    getAuditTrail(): readonly AuditEntry[];
    /**
     * Update metrics
     */
    updateMetrics(update: Partial<ExecutionMetrics>): void;
    /**
     * Add tool call to tracking
     */
    addToolCall(toolCall: ToolCall): void;
    /**
     * Add tool result to tracking
     */
    addToolResult(result: ToolResult): void;
    /**
     * Check resource limits
     */
    checkLimits(limits?: {
        maxExecutionTime?: number;
        maxToolCalls?: number;
        maxContextSize?: number;
    }): void;
    /**
     * Estimate memory usage (rough approximation)
     */
    private estimateSize;
    /**
     * Cleanup resources and release memory
     * Clears all internal arrays and maps to allow garbage collection
     */
    cleanup(): void;
    /**
     * Get execution summary
     */
    getSummary(): {
        executionId: string;
        startTime: Date;
        currentIteration: number;
        paused: boolean;
        cancelled: boolean;
        metrics: {
            totalDuration: number;
            llmDuration: number;
            toolDuration: number;
            hookDuration: number;
            iterationCount: number;
            toolCallCount: number;
            toolSuccessCount: number;
            toolFailureCount: number;
            toolTimeoutCount: number;
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
            errors: Array<{
                type: string;
                message: string;
                timestamp: Date;
            }>;
        };
        totalDuration: number;
    };
}

/**
 * Event types for agentic loop execution
 * These events are emitted asynchronously for notifications (UI updates, logging, etc.)
 */

interface ExecutionStartEvent {
    executionId: string;
    config: AgenticLoopConfig;
    timestamp: Date;
}
interface ExecutionCompleteEvent {
    executionId: string;
    response: AgentResponse;
    timestamp: Date;
    duration: number;
}
interface ExecutionErrorEvent {
    executionId: string;
    error: Error;
    timestamp: Date;
}
interface ExecutionPausedEvent {
    executionId: string;
    reason?: string;
    timestamp: Date;
}
interface ExecutionResumedEvent {
    executionId: string;
    timestamp: Date;
}
interface ExecutionCancelledEvent {
    executionId: string;
    reason?: string;
    timestamp: Date;
}
interface IterationStartEvent {
    executionId: string;
    iteration: number;
    timestamp: Date;
}
interface IterationCompleteEvent {
    executionId: string;
    iteration: number;
    response: AgentResponse;
    timestamp: Date;
    duration: number;
}
interface LLMRequestEvent {
    executionId: string;
    iteration: number;
    options: TextGenerateOptions;
    timestamp: Date;
}
interface LLMResponseEvent {
    executionId: string;
    iteration: number;
    response: AgentResponse;
    timestamp: Date;
    duration: number;
}
interface LLMErrorEvent {
    executionId: string;
    iteration: number;
    error: Error;
    timestamp: Date;
}
interface ToolDetectedEvent {
    executionId: string;
    iteration: number;
    toolCalls: ToolCall[];
    timestamp: Date;
}
interface ToolStartEvent {
    executionId: string;
    iteration: number;
    toolCall: ToolCall;
    timestamp: Date;
}
interface ToolCompleteEvent {
    executionId: string;
    iteration: number;
    toolCall: ToolCall;
    result: ToolResult;
    timestamp: Date;
}
interface ToolErrorEvent {
    executionId: string;
    iteration: number;
    toolCall: ToolCall;
    error: Error;
    timestamp: Date;
}
interface ToolTimeoutEvent {
    executionId: string;
    iteration: number;
    toolCall: ToolCall;
    timeout: number;
    timestamp: Date;
}
interface HookErrorEvent {
    executionId: string;
    hookName: string;
    error: Error;
    timestamp: Date;
}
interface CircuitOpenedEvent {
    executionId: string;
    breakerName: string;
    failureCount: number;
    lastError: string;
    nextRetryTime: number;
    timestamp: Date;
}
interface CircuitHalfOpenEvent {
    executionId: string;
    breakerName: string;
    timestamp: Date;
}
interface CircuitClosedEvent {
    executionId: string;
    breakerName: string;
    successCount: number;
    timestamp: Date;
}
/**
 * Map of all event names to their payload types
 */
interface AgenticLoopEvents {
    'execution:start': ExecutionStartEvent;
    'execution:complete': ExecutionCompleteEvent;
    'execution:error': ExecutionErrorEvent;
    'execution:paused': ExecutionPausedEvent;
    'execution:resumed': ExecutionResumedEvent;
    'execution:cancelled': ExecutionCancelledEvent;
    'iteration:start': IterationStartEvent;
    'iteration:complete': IterationCompleteEvent;
    'llm:request': LLMRequestEvent;
    'llm:response': LLMResponseEvent;
    'llm:error': LLMErrorEvent;
    'tool:detected': ToolDetectedEvent;
    'tool:start': ToolStartEvent;
    'tool:complete': ToolCompleteEvent;
    'tool:error': ToolErrorEvent;
    'tool:timeout': ToolTimeoutEvent;
    'hook:error': HookErrorEvent;
    'circuit:opened': CircuitOpenedEvent;
    'circuit:half-open': CircuitHalfOpenEvent;
    'circuit:closed': CircuitClosedEvent;
}
type AgenticLoopEventName = keyof AgenticLoopEvents;

/**
 * Agentic loop - handles tool calling and multi-turn conversations
 * Now with events, hooks, pause/resume, and enterprise features
 */

interface AgenticLoopConfig {
    model: string;
    input: string | InputItem[];
    instructions?: string;
    tools: Tool[];
    temperature?: number;
    maxIterations: number;
    /** Vendor-specific options (e.g., Google's thinkingLevel) */
    vendorOptions?: Record<string, any>;
    hooks?: HookConfig;
    historyMode?: HistoryMode;
    limits?: {
        maxExecutionTime?: number;
        maxToolCalls?: number;
        maxContextSize?: number;
        /** Maximum input messages to keep (prevents unbounded growth). Default: 50 */
        maxInputMessages?: number;
    };
    errorHandling?: {
        hookFailureMode?: 'fail' | 'warn' | 'ignore';
        /**
         * Tool failure handling mode:
         * - 'fail': Stop execution on first tool failure (throw error)
         * - 'continue': Execute all tools even if some fail, return all results including errors
         * @default 'continue'
         */
        toolFailureMode?: 'fail' | 'continue';
        maxConsecutiveErrors?: number;
    };
    /**
     * Tool execution timeout in milliseconds
     * @default 30000 (30 seconds)
     */
    toolTimeout?: number;
    /**
     * Permission manager for tool approval/blocking.
     * If provided, permission checks run BEFORE approve:tool hooks.
     */
    permissionManager?: ToolPermissionManager;
    /**
     * Agent type for permission context (used by TaskAgent/UniversalAgent).
     * @default 'agent'
     */
    agentType?: 'agent' | 'task-agent' | 'universal-agent';
    /**
     * Current task name (used for TaskAgent/UniversalAgent context).
     */
    taskName?: string;
}
declare class AgenticLoop extends EventEmitter<AgenticLoopEvents> {
    private provider;
    private toolExecutor;
    private hookManager;
    private context;
    private paused;
    private pausePromise;
    private resumeCallback;
    private cancelled;
    private pauseResumeMutex;
    constructor(provider: ITextProvider, toolExecutor: IToolExecutor, hookConfig?: HookConfig, errorHandling?: {
        maxConsecutiveErrors?: number;
    });
    /**
     * Execute agentic loop with tool calling
     */
    execute(config: AgenticLoopConfig): Promise<AgentResponse>;
    /**
     * Execute agentic loop with streaming and tool calling
     */
    executeStreaming(config: AgenticLoopConfig): AsyncIterableIterator<StreamEvent>;
    /**
     * Stream LLM response with hooks
     * @private
     */
    private streamGenerateWithHooks;
    /**
     * Check tool permission before execution
     * Returns true if approved, throws if blocked/rejected
     * @private
     */
    private checkToolPermission;
    /**
     * Execute single tool with hooks
     * @private
     */
    private executeToolWithHooks;
    /**
     * Generate LLM response with hooks
     */
    private generateWithHooks;
    /**
     * Execute tools with hooks
     */
    private executeToolsWithHooks;
    /**
     * Extract tool calls from response output
     */
    private extractToolCalls;
    /**
     * Execute function with timeout
     */
    private executeWithTimeout;
    /**
     * Build new messages from tool results (assistant response + tool results)
     */
    private buildNewMessages;
    /**
     * Append new messages to current context, preserving history
     * Unified logic for both execute() and executeStreaming()
     */
    private appendToContext;
    /**
     * Apply sliding window to prevent unbounded input growth
     * Preserves system/developer message at the start if present
     * IMPORTANT: Ensures tool_use and tool_result pairs are never broken
     */
    private applySlidingWindow;
    /**
     * Find a safe index to cut the message array without breaking tool call/result pairs
     * A safe boundary is one where all tool_use IDs have matching tool_result IDs
     */
    private findSafeToolBoundary;
    /**
     * Check if cutting at this index would leave tool calls/results balanced
     * Returns true if all tool_use IDs in the slice have matching tool_result IDs
     */
    private isToolBoundarySafe;
    /**
     * Pause execution (thread-safe with mutex)
     */
    pause(reason?: string): void;
    /**
     * Internal pause implementation
     */
    private _doPause;
    /**
     * Resume execution (thread-safe with mutex)
     */
    resume(): void;
    /**
     * Internal resume implementation
     */
    private _doResume;
    /**
     * Cancel execution
     */
    cancel(reason?: string): void;
    /**
     * Check if paused and wait
     */
    private checkPause;
    /**
     * Get current execution context
     */
    getContext(): ExecutionContext | null;
    /**
     * Check if currently executing
     */
    isRunning(): boolean;
    /**
     * Check if paused
     */
    isPaused(): boolean;
    /**
     * Check if cancelled
     */
    isCancelled(): boolean;
}

/**
 * Hook types for agentic loop execution
 * Hooks can modify execution flow synchronously or asynchronously
 */

/**
 * Base hook function type
 */
type Hook<TContext, TResult = any> = (context: TContext) => TResult | Promise<TResult>;
/**
 * Hook that can modify data
 */
type ModifyingHook<TContext, TModification> = Hook<TContext, TModification>;
interface BeforeExecutionContext {
    executionId: string;
    config: AgenticLoopConfig;
    timestamp: Date;
}
interface AfterExecutionContext {
    executionId: string;
    response: AgentResponse;
    context: ExecutionContext;
    timestamp: Date;
    duration: number;
}
interface BeforeLLMContext {
    executionId: string;
    iteration: number;
    options: TextGenerateOptions;
    context: ExecutionContext;
    timestamp: Date;
}
interface AfterLLMContext {
    executionId: string;
    iteration: number;
    response: AgentResponse;
    context: ExecutionContext;
    timestamp: Date;
    duration: number;
}
interface BeforeToolContext {
    executionId: string;
    iteration: number;
    toolCall: ToolCall;
    context: ExecutionContext;
    timestamp: Date;
}
interface AfterToolContext {
    executionId: string;
    iteration: number;
    toolCall: ToolCall;
    result: ToolResult;
    context: ExecutionContext;
    timestamp: Date;
}
interface ApproveToolContext {
    executionId: string;
    iteration: number;
    toolCall: ToolCall;
    context: ExecutionContext;
    timestamp: Date;
}
interface PauseCheckContext {
    executionId: string;
    iteration: number;
    context: ExecutionContext;
    timestamp: Date;
}
interface LLMModification {
    modified?: Partial<TextGenerateOptions>;
    skip?: boolean;
    reason?: string;
}
interface ToolModification {
    modified?: Partial<ToolCall>;
    skip?: boolean;
    mockResult?: any;
    reason?: string;
}
interface ToolResultModification {
    modified?: Partial<ToolResult>;
    retry?: boolean;
    reason?: string;
}
interface ApprovalResult {
    approved: boolean;
    reason?: string;
    modifiedArgs?: any;
}
interface PauseDecision {
    shouldPause: boolean;
    reason?: string;
}
interface HookConfig {
    'before:execution'?: Hook<BeforeExecutionContext, void>;
    'after:execution'?: Hook<AfterExecutionContext, void>;
    'before:llm'?: ModifyingHook<BeforeLLMContext, LLMModification>;
    'after:llm'?: ModifyingHook<AfterLLMContext, {}>;
    'before:tool'?: ModifyingHook<BeforeToolContext, ToolModification>;
    'after:tool'?: ModifyingHook<AfterToolContext, ToolResultModification>;
    'approve:tool'?: Hook<ApproveToolContext, ApprovalResult>;
    'pause:check'?: Hook<PauseCheckContext, PauseDecision>;
    hookTimeout?: number;
    parallelHooks?: boolean;
}
type HookName = keyof Omit<HookConfig, 'hookTimeout' | 'parallelHooks'>;
/**
 * Map of hook names to their context and result types
 */
interface HookSignatures {
    'before:execution': {
        context: BeforeExecutionContext;
        result: void;
    };
    'after:execution': {
        context: AfterExecutionContext;
        result: void;
    };
    'before:llm': {
        context: BeforeLLMContext;
        result: LLMModification;
    };
    'after:llm': {
        context: AfterLLMContext;
        result: {};
    };
    'before:tool': {
        context: BeforeToolContext;
        result: ToolModification;
    };
    'after:tool': {
        context: AfterToolContext;
        result: ToolResultModification;
    };
    'approve:tool': {
        context: ApproveToolContext;
        result: ApprovalResult;
    };
    'pause:check': {
        context: PauseCheckContext;
        result: PauseDecision;
    };
}

/**
 * Hook manager - handles hook registration and execution
 * Includes error isolation, timeouts, and optional parallel execution
 */

declare class HookManager {
    private hooks;
    private timeout;
    private parallel;
    private hookErrorCounts;
    private disabledHooks;
    private maxConsecutiveErrors;
    private emitter;
    constructor(config: HookConfig | undefined, emitter: EventEmitter, errorHandling?: {
        maxConsecutiveErrors?: number;
    });
    /**
     * Register hooks from configuration
     */
    private registerFromConfig;
    /**
     * Register a hook
     */
    register(name: HookName, hook: Hook<any, any>): void;
    /**
     * Execute hooks for a given name
     */
    executeHooks<K extends HookName>(name: K, context: HookSignatures[K]['context'], defaultResult: HookSignatures[K]['result']): Promise<HookSignatures[K]['result']>;
    /**
     * Execute hooks sequentially
     */
    private executeHooksSequential;
    /**
     * Execute hooks in parallel
     */
    private executeHooksParallel;
    /**
     * Generate unique key for a hook
     */
    private getHookKey;
    /**
     * Execute single hook with error isolation and timeout (with per-hook error tracking)
     */
    private executeHookSafely;
    /**
     * Check if there are any hooks registered
     */
    hasHooks(name: HookName): boolean;
    /**
     * Get hook count
     */
    getHookCount(name?: HookName): number;
    /**
     * Clear all hooks and reset error tracking
     */
    clear(): void;
    /**
     * Re-enable a disabled hook
     */
    enableHook(hookKey: string): void;
    /**
     * Get list of disabled hooks
     */
    getDisabledHooks(): string[];
}

export { type TextGenerateOptions as $, type AgentPermissionsConfig as A, type AgenticLoopEvents as B, type ContextBudget as C, type AgentResponse as D, ExecutionContext as E, type FunctionToolDefinition as F, type ExecutionMetrics as G, type HookConfig as H, type IToolExecutor as I, type AuditEntry as J, type ITextProvider as K, type LLMResponse as L, type MemoryScope as M, BaseContextPlugin as N, type IContextComponent as O, type PriorityCalculator as P, type ITokenEstimator as Q, type IContextStrategy as R, type SerializedApprovalState as S, type ToolContext as T, type ContextManagerConfig as U, type IContextCompactor as V, type WorkingMemoryConfig as W, type IPersistentInstructionsStorage as X, type TokenUsage as Y, type ToolCall as Z, StreamEventType as _, type IDisposable as a, isStreamEvent as a$, type ModelCapabilities as a0, MessageRole as a1, type PermissionScope as a2, type RiskLevel as a3, type ToolPermissionConfig as a4, type ApprovalCacheEntry as a5, type SerializedApprovalEntry as a6, type PermissionCheckResult as a7, type ApprovalDecision as a8, type PermissionCheckContext as a9, type InputImageContent as aA, type OutputTextContent as aB, type ToolUseContent as aC, type ToolResultContent as aD, type Message as aE, type OutputItem as aF, type CompactionItem as aG, type ReasoningItem as aH, ToolCallState as aI, defaultDescribeCall as aJ, getToolCallDescription as aK, type BuiltInTool as aL, type ToolResult as aM, type ToolExecutionContext as aN, type JSONSchema as aO, type ResponseCreatedEvent as aP, type ResponseInProgressEvent as aQ, type OutputTextDeltaEvent as aR, type OutputTextDoneEvent as aS, type ToolCallStartEvent as aT, type ToolCallArgumentsDeltaEvent as aU, type ToolCallArgumentsDoneEvent as aV, type ToolExecutionStartEvent as aW, type ToolExecutionDoneEvent as aX, type IterationCompleteEvent$1 as aY, type ResponseCompleteEvent as aZ, type ErrorEvent as a_, type PermissionManagerEvent as aa, APPROVAL_STATE_VERSION as ab, DEFAULT_PERMISSION_CONFIG as ac, DEFAULT_ALLOWLIST as ad, type DefaultAllowlistedTool as ae, DEFAULT_IDEMPOTENCY_CONFIG as af, ContextManager as ag, type IContextProvider as ah, DEFAULT_CONTEXT_CONFIG as ai, type MemoryEntryInput as aj, type MemoryIndexEntry as ak, type TaskAwareScope as al, type SimpleScope as am, DEFAULT_MEMORY_CONFIG as an, forTasks as ao, forPlan as ap, scopeEquals as aq, scopeMatches as ar, isSimpleScope as as, isTaskAwareScope as at, isTerminalMemoryStatus as au, calculateEntrySize as av, MEMORY_PRIORITY_VALUES as aw, ContentType as ax, type Content as ay, type InputTextContent as az, type ToolFunction as b, isOutputTextDelta as b0, isToolCallStart as b1, isToolCallArgumentsDelta as b2, isToolCallArgumentsDone as b3, isResponseComplete as b4, isErrorEvent as b5, HookManager as b6, type AgenticLoopEventName as b7, type HookName as b8, type Hook as b9, type ModifyingHook as ba, type BeforeToolContext as bb, type AfterToolContext as bc, type ApproveToolContext as bd, type ToolModification as be, type ApprovalResult as bf, type IAsyncDisposable as bg, assertNotDestroyed as bh, type InContextEntry as bi, type InContextPriority as bj, type SerializedInContextMemoryState as bk, type SerializedPersistentInstructionsState as bl, AgenticLoop as bm, type AgenticLoopConfig as bn, type ExecutionStartEvent as bo, type ExecutionCompleteEvent as bp, type ToolStartEvent as bq, type ToolCompleteEvent as br, type LLMRequestEvent as bs, type LLMResponseEvent as bt, type ToolPermissionConfig$1 as c, type Tool as d, type MemoryPriority as e, type MemoryEntry as f, type StaleEntryInfo as g, type PriorityContext as h, type MemoryIndex as i, type TaskStatusForMemory as j, type WorkingMemoryAccess as k, type MemoryTier as l, type IdempotencyCacheConfig as m, type InContextMemoryConfig as n, type PersistentInstructionsConfig as o, IdempotencyCache as p, ToolPermissionManager as q, InContextMemoryPlugin as r, PersistentInstructionsPlugin as s, type IContextPlugin as t, type PreparedContext as u, type TokenContentType as v, type CacheStats as w, type InputItem as x, type StreamEvent as y, type HistoryMode as z };
