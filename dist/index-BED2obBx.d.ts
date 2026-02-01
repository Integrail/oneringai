import { EventEmitter } from 'eventemitter3';
import { I as IProvider } from './IProvider-BP49c93d.js';

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
    /** Working memory access (if agent has memory feature enabled) */
    memory?: WorkingMemoryAccess;
    /**
     * AgentContext - THE source of truth for all context management
     * Use this to access budget info, prepare context, manage history, etc.
     */
    agentContext?: AgentContext;
    /** Idempotency cache (if agent has memory feature enabled) */
    idempotencyCache?: IdempotencyCache;
    /** In-context memory plugin (if features.inContextMemory is enabled) */
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
 * - Introspection tools (context stats)
 * - In-context memory tools
 * - Persistent instructions tools
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
 * Memory storage interface for working memory persistence.
 *
 * Implement this interface to provide custom persistence:
 * - Redis for distributed agents
 * - Database for durability
 * - File system for simple persistence
 *
 * Default implementation: InMemoryStorage (no persistence)
 */

interface IMemoryStorage {
    /**
     * Get entry by key
     */
    get(key: string): Promise<MemoryEntry | undefined>;
    /**
     * Set/update entry
     */
    set(key: string, entry: MemoryEntry): Promise<void>;
    /**
     * Delete entry
     */
    delete(key: string): Promise<void>;
    /**
     * Check if key exists
     */
    has(key: string): Promise<boolean>;
    /**
     * Get all entries
     */
    getAll(): Promise<MemoryEntry[]>;
    /**
     * Get entries by scope
     */
    getByScope(scope: MemoryScope): Promise<MemoryEntry[]>;
    /**
     * Clear all entries with given scope
     */
    clearScope(scope: MemoryScope): Promise<void>;
    /**
     * Clear everything
     */
    clear(): Promise<void>;
    /**
     * Get total size in bytes
     */
    getTotalSize(): Promise<number>;
}

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

/**
 * Serialized memory state for persistence
 */
interface SerializedMemory {
    /** Memory format version */
    version: number;
    /** Serialized memory entries */
    entries: SerializedMemoryEntry[];
}
/**
 * Serialized memory entry
 */
interface SerializedMemoryEntry {
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
type EvictionStrategy = 'lru' | 'size';
interface WorkingMemoryEvents {
    stored: {
        key: string;
        description: string;
        scope: MemoryScope;
    };
    retrieved: {
        key: string;
    };
    deleted: {
        key: string;
    };
    evicted: {
        keys: string[];
        reason: 'lru' | 'size' | 'task_completed';
    };
    limit_warning: {
        utilizationPercent: number;
    };
    stale_entries: {
        entries: StaleEntryInfo[];
    };
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
declare class WorkingMemory extends EventEmitter<WorkingMemoryEvents> implements IDisposable {
    private storage;
    private config;
    private priorityCalculator;
    private priorityContext;
    private _isDestroyed;
    /**
     * Create a WorkingMemory instance
     *
     * @param storage - Storage backend for memory entries
     * @param config - Memory configuration (limits, etc.)
     * @param priorityCalculator - Strategy for computing effective priority (default: static)
     */
    constructor(storage: IMemoryStorage, config?: WorkingMemoryConfig, priorityCalculator?: PriorityCalculator);
    /**
     * Set the priority calculator (for switching strategies at runtime)
     */
    setPriorityCalculator(calculator: PriorityCalculator): void;
    /**
     * Update priority context (e.g., task states for TaskAgent)
     */
    setPriorityContext(context: PriorityContext): void;
    /**
     * Get the current priority context
     */
    getPriorityContext(): PriorityContext;
    /**
     * Compute effective priority for an entry using the current calculator
     */
    private computeEffectivePriority;
    /**
     * Get all entries with their computed effective priorities
     * This is a performance optimization to avoid repeated getAll() + map() calls
     */
    private getEntriesWithPriority;
    /**
     * Get evictable entries sorted by eviction priority
     * Filters out pinned and critical entries, sorts by priority then by strategy
     */
    private getEvictableEntries;
    /**
     * Store a value in working memory
     *
     * @param key - Unique key for the entry
     * @param description - Short description for the index (max 150 chars)
     * @param value - The data to store
     * @param options - Optional scope, priority, and pinned settings
     */
    store(key: string, description: string, value: unknown, options?: {
        scope?: MemoryScope;
        priority?: MemoryPriority;
        pinned?: boolean;
    }): Promise<void>;
    /**
     * Store a value scoped to specific tasks
     * Convenience method for task-aware memory
     */
    storeForTasks(key: string, description: string, value: unknown, taskIds: string[], options?: {
        priority?: MemoryPriority;
        pinned?: boolean;
    }): Promise<void>;
    /**
     * Store a value scoped to the entire plan
     * Convenience method for plan-scoped memory
     */
    storeForPlan(key: string, description: string, value: unknown, options?: {
        priority?: MemoryPriority;
        pinned?: boolean;
    }): Promise<void>;
    /**
     * Retrieve a value from working memory
     *
     * Note: Access stats update is not strictly atomic. Under very high concurrency,
     * accessCount may be slightly inaccurate. This is acceptable for memory management
     * purposes where exact counts are not critical.
     */
    retrieve(key: string): Promise<unknown>;
    /**
     * Retrieve multiple values
     */
    retrieveMany(keys: string[]): Promise<Record<string, unknown>>;
    /**
     * Delete a value from working memory
     */
    delete(key: string): Promise<void>;
    /**
     * Check if key exists
     */
    has(key: string): Promise<boolean>;
    /**
     * Promote an entry to persistent scope
     * Works with both simple and task-aware scopes
     */
    persist(key: string): Promise<void>;
    /**
     * Pin an entry (never evicted)
     */
    pin(key: string): Promise<void>;
    /**
     * Unpin an entry
     */
    unpin(key: string, newPriority?: MemoryPriority): Promise<void>;
    /**
     * Set the base priority of an entry
     */
    setPriority(key: string, priority: MemoryPriority): Promise<void>;
    /**
     * Update the scope of an entry without re-storing the value
     */
    updateScope(key: string, scope: MemoryScope): Promise<void>;
    /**
     * Add task IDs to an existing task-scoped entry
     * If entry is not task-scoped, converts it to task-scoped
     */
    addTasksToScope(key: string, taskIds: string[]): Promise<void>;
    /**
     * Clear all entries of a specific scope
     */
    clearScope(scope: MemoryScope): Promise<void>;
    /**
     * Clear all entries
     */
    clear(): Promise<void>;
    /**
     * Get memory index with computed effective priorities
     */
    getIndex(): Promise<MemoryIndex>;
    /**
     * Format index for context injection
     */
    formatIndex(): Promise<string>;
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
    evict(count: number, strategy?: EvictionStrategy): Promise<string[]>;
    /**
     * Evict entries using priority-aware LRU algorithm
     * @deprecated Use evict(count, 'lru') instead
     */
    evictLRU(count: number): Promise<string[]>;
    /**
     * Evict largest entries first (priority-aware)
     * @deprecated Use evict(count, 'size') instead
     */
    evictBySize(count: number): Promise<string[]>;
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
    onTaskComplete(taskId: string, taskStates: Map<string, TaskStatusForMemory>): Promise<StaleEntryInfo[]>;
    /**
     * Evict entries for completed tasks
     *
     * Removes entries that were scoped only to completed tasks.
     * Use after onTaskComplete() if you want automatic cleanup.
     *
     * @param taskStates - Current task states map
     * @returns Keys of evicted entries
     */
    evictCompletedTaskEntries(taskStates: Map<string, TaskStatusForMemory>): Promise<string[]>;
    /**
     * Get limited memory access for tools
     *
     * This provides a simplified interface for tools to interact with memory
     * without exposing the full WorkingMemory API.
     */
    getAccess(): WorkingMemoryAccess;
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
    storeRaw(key: string, description: string, value: unknown, options?: {
        taskIds?: string[];
        scope?: MemoryScope;
    }): Promise<void>;
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
    storeSummary(key: string, description: string, value: unknown, derivedFrom: string | string[], options?: {
        taskIds?: string[];
        scope?: MemoryScope;
    }): Promise<void>;
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
    storeFindings(key: string, description: string, value: unknown, _derivedFrom?: string | string[], options?: {
        taskIds?: string[];
        scope?: MemoryScope;
        pinned?: boolean;
    }): Promise<void>;
    /**
     * Clean up raw data after summary/findings are created
     *
     * Call this after creating summaries to free up memory used by raw data.
     * Only deletes entries in the 'raw' tier.
     *
     * @param derivedFromKeys - Keys to delete (typically from derivedFrom metadata)
     * @returns Number of entries deleted
     */
    cleanupRawData(derivedFromKeys: string[]): Promise<number>;
    /**
     * Get all entries by tier
     *
     * @param tier - The tier to filter by
     * @returns Array of entries in that tier
     */
    getByTier(tier: MemoryTier): Promise<MemoryEntry[]>;
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
    promote(key: string, toTier: MemoryTier): Promise<string>;
    /**
     * Get tier statistics
     *
     * @returns Count and size by tier
     */
    getTierStats(): Promise<Record<MemoryTier, {
        count: number;
        sizeBytes: number;
    }>>;
    /**
     * Get statistics about memory usage
     */
    getStats(): Promise<{
        totalEntries: number;
        totalSizeBytes: number;
        utilizationPercent: number;
        byPriority: Record<MemoryPriority, number>;
        pinnedCount: number;
    }>;
    /**
     * Get the configured memory limit
     */
    getLimit(): number;
    /**
     * Check if the WorkingMemory instance has been destroyed
     */
    get isDestroyed(): boolean;
    /**
     * Destroy the WorkingMemory instance
     * Removes all event listeners and clears internal state
     */
    destroy(): void;
    /**
     * Serialize all memory entries for persistence
     *
     * Returns a serializable representation of all memory entries
     * that can be saved to storage and restored later.
     *
     * @returns Serialized memory state
     */
    serialize(): Promise<SerializedMemory>;
    /**
     * Restore memory entries from serialized state
     *
     * Clears existing memory and repopulates from the serialized state.
     * Timestamps are reset to current time.
     *
     * @param state - Previously serialized memory state
     */
    restore(state: SerializedMemory): Promise<void>;
}

/**
 * IContextStorage - Storage interface for AgentContext persistence
 *
 * Provides persistence operations for AgentContext sessions.
 * Implementations can use filesystem, database, cloud storage, etc.
 *
 * This follows Clean Architecture - the interface is in domain layer,
 * implementations are in infrastructure layer.
 */

/**
 * Session summary for listing (lightweight, no full state)
 */
interface ContextSessionSummary {
    /** Session identifier */
    sessionId: string;
    /** When the session was created */
    createdAt: Date;
    /** When the session was last saved */
    lastSavedAt: Date;
    /** Number of messages in history */
    messageCount: number;
    /** Number of memory entries */
    memoryEntryCount: number;
    /** Optional metadata */
    metadata?: ContextSessionMetadata;
}
/**
 * Session metadata (stored with session)
 */
interface ContextSessionMetadata {
    /** Human-readable title */
    title?: string;
    /** Auto-generated or user-provided description */
    description?: string;
    /** Tags for filtering */
    tags?: string[];
    /** Custom key-value data */
    [key: string]: unknown;
}
/**
 * Full session state wrapper (includes metadata)
 */
interface StoredContextSession {
    /** Format version for migration support */
    version: number;
    /** Session identifier */
    sessionId: string;
    /** When the session was created */
    createdAt: string;
    /** When the session was last saved */
    lastSavedAt: string;
    /** The serialized AgentContext state */
    state: SerializedAgentContextState;
    /** Session metadata */
    metadata: ContextSessionMetadata;
}
/**
 * Current format version for stored sessions
 */
declare const CONTEXT_SESSION_FORMAT_VERSION = 1;
/**
 * Storage interface for AgentContext persistence
 *
 * Implementations:
 * - FileContextStorage: File-based storage at ~/.oneringai/agents/<agentId>/sessions/
 * - (Future) RedisContextStorage, PostgresContextStorage, S3ContextStorage, etc.
 */
interface IContextStorage {
    /**
     * Save context state to a session
     *
     * @param sessionId - Unique session identifier
     * @param state - Serialized AgentContext state
     * @param metadata - Optional session metadata
     */
    save(sessionId: string, state: SerializedAgentContextState, metadata?: ContextSessionMetadata): Promise<void>;
    /**
     * Load context state from a session
     *
     * @param sessionId - Session identifier to load
     * @returns The stored session, or null if not found
     */
    load(sessionId: string): Promise<StoredContextSession | null>;
    /**
     * Delete a session
     *
     * @param sessionId - Session identifier to delete
     */
    delete(sessionId: string): Promise<void>;
    /**
     * Check if a session exists
     *
     * @param sessionId - Session identifier to check
     */
    exists(sessionId: string): Promise<boolean>;
    /**
     * List all sessions (summaries only, not full state)
     *
     * @param options - Optional filtering and pagination
     * @returns Array of session summaries, sorted by lastSavedAt descending
     */
    list(options?: ContextStorageListOptions): Promise<ContextSessionSummary[]>;
    /**
     * Update session metadata without loading full state
     *
     * @param sessionId - Session identifier
     * @param metadata - Metadata to merge (existing keys preserved unless overwritten)
     */
    updateMetadata?(sessionId: string, metadata: Partial<ContextSessionMetadata>): Promise<void>;
    /**
     * Get the storage path/location (for display/debugging)
     */
    getPath(): string;
}
/**
 * Options for listing sessions
 */
interface ContextStorageListOptions {
    /** Filter by tags (any match) */
    tags?: string[];
    /** Filter by creation date range */
    createdAfter?: Date;
    createdBefore?: Date;
    /** Filter by last saved date range */
    savedAfter?: Date;
    savedBefore?: Date;
    /** Maximum number of results */
    limit?: number;
    /** Offset for pagination */
    offset?: number;
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
 * ToolOutputPlugin - Tracks recent tool outputs for context
 *
 * Tool outputs are the most expendable context - they can be truncated
 * or removed when space is needed. Recent outputs are kept for reference.
 */

/**
 * A single tool output entry
 */
interface ToolOutput {
    /** Tool name */
    tool: string;
    /** Tool result (may be truncated) */
    output: unknown;
    /** When the tool was called */
    timestamp: number;
    /** Whether output was truncated */
    truncated?: boolean;
}
/**
 * Serialized tool output state
 */
interface SerializedToolOutputState {
    outputs: ToolOutput[];
}
/**
 * Tool output plugin configuration
 */
interface ToolOutputPluginConfig {
    /** Maximum outputs to keep (default: 10) */
    maxOutputs?: number;
    /** Maximum tokens per individual output (default: 1000) */
    maxTokensPerOutput?: number;
    /** Whether to include timestamps in context (default: false) */
    includeTimestamps?: boolean;
}
/**
 * Tool output plugin for context management
 *
 * Provides recent tool outputs as a context component.
 * Highest compaction priority - first to be reduced when space is needed.
 */
declare class ToolOutputPlugin extends BaseContextPlugin {
    readonly name = "tool_outputs";
    readonly priority = 10;
    readonly compactable = true;
    private outputs;
    private config;
    constructor(config?: ToolOutputPluginConfig);
    /**
     * Add a tool output
     */
    addOutput(toolName: string, result: unknown): void;
    /**
     * Get recent outputs
     */
    getOutputs(): ToolOutput[];
    /**
     * Clear all outputs
     */
    clear(): void;
    /**
     * Get component for context
     */
    getComponent(): Promise<IContextComponent | null>;
    /**
     * Compact by removing oldest outputs and truncating large ones
     */
    compact(_targetTokens: number, estimator: ITokenEstimator): Promise<number>;
    /**
     * Format outputs for context
     */
    private formatOutputs;
    /**
     * Safely stringify output
     */
    private stringifyOutput;
    getState(): SerializedToolOutputState;
    restoreState(state: unknown): void;
}

/**
 * AutoSpillPlugin - Automatically spills large tool outputs to memory
 *
 * This plugin monitors tool outputs and automatically stores large results
 * in working memory's raw tier. This prevents context overflow while keeping
 * data available for later retrieval.
 *
 * Features:
 * - Configurable size threshold for auto-spill
 * - Tracks spilled entries with source metadata
 * - Provides cleanup methods (manual and auto on summarization)
 * - Integrates with WorkingMemory's hierarchical tier system
 */

/**
 * Spilled entry metadata
 */
interface SpilledEntry {
    /** Memory key where the entry is stored */
    key: string;
    /** Tool that produced the output */
    sourceTool: string;
    /** Original size in bytes */
    sizeBytes: number;
    /** When the entry was spilled */
    timestamp: number;
    /** Whether this entry has been consumed (summarized) */
    consumed: boolean;
    /** Keys of summaries derived from this entry */
    derivedSummaries: string[];
}
/**
 * Auto-spill configuration
 */
interface AutoSpillConfig {
    /** Minimum size (bytes) to trigger auto-spill. Default: 10KB */
    sizeThreshold?: number;
    /** Tools to auto-spill. If not provided, uses toolPatterns or spills all large outputs */
    tools?: string[];
    /** Regex patterns for tools to auto-spill (e.g., /^web_/ for all web tools) */
    toolPatterns?: RegExp[];
    /** Maximum entries to track (oldest are cleaned up). Default: 100 */
    maxTrackedEntries?: number;
    /** Auto-cleanup consumed entries after this many iterations. Default: 5 */
    autoCleanupAfterIterations?: number;
    /** Key prefix for spilled entries. Default: 'autospill' */
    keyPrefix?: string;
}
/**
 * Serialized plugin state
 */
interface SerializedAutoSpillState {
    entries: SpilledEntry[];
    iterationsSinceCleanup: number;
}
/**
 * Events emitted by AutoSpillPlugin
 */
interface AutoSpillEvents {
    spilled: {
        key: string;
        tool: string;
        sizeBytes: number;
    };
    consumed: {
        key: string;
        summaryKey: string;
    };
    cleaned: {
        keys: string[];
        reason: 'manual' | 'auto' | 'consumed';
    };
}
/**
 * AutoSpillPlugin - Monitors tool outputs and auto-stores large ones in memory
 *
 * Usage:
 * ```typescript
 * const autoSpill = new AutoSpillPlugin(memory, {
 *   sizeThreshold: 10 * 1024, // 10KB
 *   tools: ['web_fetch', 'web_scrape'],
 * });
 * agentContext.registerPlugin(autoSpill);
 *
 * // Call this from afterToolExecution hook
 * autoSpill.onToolOutput('web_fetch', largeHtmlContent);
 *
 * // When agent creates summary, mark the raw data as consumed
 * autoSpill.markConsumed('autospill_web_fetch_123', 'summary.search1');
 *
 * // Cleanup consumed entries
 * await autoSpill.cleanupConsumed();
 * ```
 */
declare class AutoSpillPlugin extends BaseContextPlugin {
    readonly name = "auto_spill_tracker";
    readonly priority = 9;
    readonly compactable = true;
    private memory;
    private config;
    private entries;
    private iterationsSinceCleanup;
    private entryCounter;
    private events;
    constructor(memory: WorkingMemory, config?: AutoSpillConfig);
    /**
     * Subscribe to events
     */
    on<K extends keyof AutoSpillEvents>(event: K, listener: (...args: any[]) => void): this;
    /**
     * Check if a tool should be auto-spilled
     */
    shouldSpill(toolName: string, outputSize: number): boolean;
    /**
     * Called when a tool produces output
     * Should be called from afterToolExecution hook
     *
     * @param toolName - Name of the tool
     * @param output - Tool output
     * @returns The memory key if spilled, undefined otherwise
     */
    onToolOutput(toolName: string, output: unknown): Promise<string | undefined>;
    /**
     * Mark a spilled entry as consumed (summarized)
     * Call this when the agent creates a summary from raw data
     *
     * @param rawKey - Key of the spilled raw entry
     * @param summaryKey - Key of the summary created from it
     */
    markConsumed(rawKey: string, summaryKey: string): void;
    /**
     * Get all tracked spilled entries
     */
    getEntries(): SpilledEntry[];
    /**
     * Get unconsumed entries (not yet summarized)
     */
    getUnconsumed(): SpilledEntry[];
    /**
     * Get consumed entries (ready for cleanup)
     */
    getConsumed(): SpilledEntry[];
    /**
     * Cleanup consumed entries from memory
     *
     * @returns Keys that were deleted
     */
    cleanupConsumed(): Promise<string[]>;
    /**
     * Cleanup specific entries
     *
     * @param keys - Keys to cleanup
     * @returns Keys that were actually deleted
     */
    cleanup(keys: string[]): Promise<string[]>;
    /**
     * Cleanup all tracked entries
     */
    cleanupAll(): Promise<string[]>;
    /**
     * Called after each agent iteration
     * Handles automatic cleanup if configured
     */
    onIteration(): Promise<void>;
    /**
     * Get spill info for a specific key
     */
    getSpillInfo(key: string): SpilledEntry | undefined;
    getComponent(): Promise<IContextComponent | null>;
    compact(_targetTokens: number, _estimator: ITokenEstimator): Promise<number>;
    getState(): SerializedAutoSpillState;
    restoreState(state: unknown): void;
    destroy(): void;
    private pruneOldEntries;
}

/**
 * AgentContext - The "Swiss Army Knife" for Agent State Management
 *
 * Unified facade that composes all context-related managers:
 * - History: Conversation tracking (built-in)
 * - Tools: Tool management via ToolManager (composed)
 * - Memory: Working memory via WorkingMemory (composed)
 * - Cache: Tool result caching via IdempotencyCache (composed)
 * - Permissions: Tool permissions via ToolPermissionManager (composed)
 *
 * Design Principles:
 * - DRY: Reuses existing managers, doesn't duplicate
 * - Simple API: One import, one object
 * - Maximum Power: Full access to sub-managers when needed
 * - Coordinated: prepare(), save(), load() handle everything
 *
 * Usage:
 * ```typescript
 * const ctx = AgentContext.create({
 *   model: 'gpt-4',
 *   tools: [readFile, writeFile],
 * });
 *
 * ctx.addMessage('user', 'Hello');
 * await ctx.tools.execute('read_file', { path: './file.txt' });
 * ctx.memory.store('key', 'description', value);
 * const prepared = await ctx.prepare();
 * await ctx.save();
 * ```
 */

/**
 * Task type determines compaction priorities and system prompt additions
 */
type TaskType = 'research' | 'coding' | 'analysis' | 'general';
/**
 * AgentContext feature configuration - controls which features are enabled
 *
 * Each feature can be enabled/disabled independently. When a feature is disabled:
 * - Its components are not created (saves memory)
 * - Its tools are not registered (cleaner LLM tool list)
 * - Related context preparation is skipped
 */
interface AgentContextFeatures {
    /**
     * Enable WorkingMemory + IdempotencyCache
     * When enabled: memory storage, tool result caching, memory_* tools, cache_stats tool
     * When disabled: no memory/cache, tools not registered
     * @default true
     */
    memory?: boolean;
    /**
     * Enable InContextMemoryPlugin for in-context key-value storage
     * When enabled: context_set/get/delete/list tools
     * @default false (opt-in)
     */
    inContextMemory?: boolean;
    /**
     * Enable conversation history tracking
     * When disabled: addMessage() is no-op, history not in context
     * @default true
     */
    history?: boolean;
    /**
     * Enable ToolPermissionManager for approval workflow
     * When disabled: all tools auto-approved
     * @default true
     */
    permissions?: boolean;
    /**
     * Enable PersistentInstructionsPlugin for disk-persisted custom instructions
     * When enabled: instructions_set/get/append/clear tools
     * Requires agentId in config
     * @default false (opt-in)
     */
    persistentInstructions?: boolean;
    /**
     * Enable ToolOutputPlugin for tracking recent tool outputs in context
     * When enabled: Tool outputs are tracked and can be compacted
     * @default true
     */
    toolOutputTracking?: boolean;
    /**
     * Enable AutoSpillPlugin for auto-spilling large tool outputs to memory
     * When enabled: Large outputs are automatically stored in WorkingMemory's raw tier
     * Requires memory feature to be enabled
     * @default true
     */
    autoSpill?: boolean;
}
/**
 * Default feature configuration
 *
 * - memory: true (includes WorkingMemory + IdempotencyCache)
 * - inContextMemory: false (opt-in)
 * - history: true
 * - permissions: true
 * - toolOutputTracking: true (NEW)
 * - autoSpill: true (NEW)
 */
declare const DEFAULT_FEATURES: Required<AgentContextFeatures>;
/**
 * History message - LEGACY FORMAT
 * @deprecated Use InputItem from Message.ts instead.
 * This interface is kept ONLY for backward compatibility with:
 * - v1 session deserialization
 * - Legacy addMessage()/addMessageSync() return types
 * New code should use InputItem[] exclusively.
 */
interface HistoryMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}
/**
 * Message metadata for conversation tracking
 */
interface MessageMetadata {
    timestamp: number;
    tokenCount: number;
    iteration?: number;
    /** Original legacy role (for backward compatibility with 'tool' role) */
    legacyRole?: 'user' | 'assistant' | 'system' | 'tool';
}
/**
 * Prepared conversation result from prepareConversation()
 * @deprecated Use PreparedResult instead
 */
interface PreparedConversation {
    /** InputItem[] ready for LLM */
    input: InputItem[];
    /** Current budget */
    budget: ContextBudget;
    /** Whether compaction occurred */
    compacted: boolean;
    /** Compaction log if compacted */
    compactionLog: string[];
}
/**
 * Options for prepareConversation()
 * @deprecated Use PrepareOptions instead
 */
interface PrepareConversationOptions {
    /** Override instructions for this call only */
    instructionOverride?: string;
}
/**
 * Options for the unified prepare() method
 */
interface PrepareOptions {
    /** Override instructions for this call only */
    instructionOverride?: string;
    /**
     * Return format:
     * - 'llm-input': Returns LLM-ready InputItem[] (default)
     * - 'components': Returns raw context components for custom assembly
     */
    returnFormat?: 'llm-input' | 'components';
}
/**
 * Result from unified prepare() method
 */
interface PreparedResult {
    /** Current budget */
    budget: ContextBudget;
    /** Whether compaction occurred */
    compacted: boolean;
    /** Compaction log if compacted */
    compactionLog: string[];
    /** LLM-ready input (when returnFormat='llm-input') */
    input?: InputItem[];
    /** Raw context components (when returnFormat='components') */
    components?: IContextComponent[];
}
/**
 * Tool call record (stored in history)
 */
interface ToolCallRecord {
    id: string;
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
    error?: string;
    durationMs?: number;
    cached?: boolean;
    timestamp: number;
}
/**
 * AgentContext configuration
 */
interface AgentContextConfig {
    /** Model name (used for token limits) */
    model?: string;
    /** Max context tokens (overrides model default) */
    maxContextTokens?: number;
    /** System prompt */
    systemPrompt?: string;
    /** Instructions */
    instructions?: string;
    /** Tools to register */
    tools?: ToolFunction[];
    /**
     * Feature configuration - enable/disable AgentContext features independently
     * Each feature controls component creation and tool registration
     */
    features?: AgentContextFeatures;
    /** Tool permissions configuration */
    permissions?: AgentPermissionsConfig;
    /** Memory configuration */
    memory?: Partial<WorkingMemoryConfig> & {
        /** Custom storage backend (default: InMemoryStorage) */
        storage?: IMemoryStorage;
    };
    /** Cache configuration */
    cache?: Partial<IdempotencyCacheConfig> & {
        /** Enable caching (default: true) */
        enabled?: boolean;
    };
    /** InContextMemory configuration (only used if features.inContextMemory is true) */
    inContextMemory?: InContextMemoryConfig;
    /**
     * PersistentInstructions configuration (only used if features.persistentInstructions is true)
     * If not provided, agentId will be auto-generated
     */
    persistentInstructions?: Omit<PersistentInstructionsConfig, 'agentId'> & {
        /** Override the agent ID (default: auto-generated or from agent name) */
        agentId?: string;
    };
    /**
     * ToolOutputPlugin configuration (only used if features.toolOutputTracking is true)
     */
    toolOutputTracking?: ToolOutputPluginConfig;
    /**
     * AutoSpillPlugin configuration (only used if features.autoSpill is true)
     * Requires features.memory to be true
     */
    autoSpill?: AutoSpillConfig;
    /**
     * Agent ID - used for persistent storage paths and identification
     * If not provided, will be auto-generated
     */
    agentId?: string;
    /** History configuration */
    history?: {
        /** Max messages before compaction */
        maxMessages?: number;
        /** Messages to preserve during compaction */
        preserveRecent?: number;
    };
    /** Compaction strategy */
    strategy?: 'proactive' | 'aggressive' | 'lazy' | 'rolling-window' | 'adaptive';
    /** Response token reserve (0.0 - 1.0) */
    responseReserve?: number;
    /** Enable auto-compaction */
    autoCompact?: boolean;
    /** Task type for priority profiles (default: auto-detect from plan) */
    taskType?: TaskType;
    /** Auto-detect task type from plan (default: true) */
    autoDetectTaskType?: boolean;
    /**
     * Storage backend for session persistence.
     * If provided, enables save()/load() methods.
     */
    storage?: IContextStorage;
    /**
     * Session ID to load on creation.
     * If provided with storage, the session will be automatically loaded.
     */
    sessionId?: string;
    /**
     * Session metadata (used when saving new sessions).
     */
    sessionMetadata?: ContextSessionMetadata;
}
/**
 * Serialized state for session persistence
 * Version 2: Stores conversation as InputItem[] instead of HistoryMessage[]
 */
interface SerializedAgentContextState {
    version: number;
    core: {
        systemPrompt: string;
        instructions: string;
        /** @deprecated Use conversation instead (v2) */
        history?: HistoryMessage[];
        /** NEW in v2: Full conversation as InputItem[] */
        conversation?: InputItem[];
        /** NEW in v2: Message metadata */
        messageMetadata?: Record<string, MessageMetadata>;
        toolCalls: ToolCallRecord[];
    };
    tools: SerializedToolState;
    /** Full WorkingMemory state (if memory feature enabled) */
    memory?: SerializedMemory;
    permissions: SerializedApprovalState;
    plugins: Record<string, unknown>;
    /**
     * Agent-specific state (not context state).
     * This is for agent-level data like ModeManager state that doesn't belong in plugins.
     * Populated by agent subclasses via getContextState() override.
     */
    agentState?: Record<string, unknown>;
    config: {
        model: string;
        maxContextTokens: number;
        strategy: string;
        features?: AgentContextFeatures;
    };
}
/**
 * Context metrics
 */
interface AgentContextMetrics {
    historyMessageCount: number;
    toolCallCount: number;
    cacheStats: CacheStats;
    memoryStats: {
        totalEntries: number;
        totalSizeBytes: number;
        utilizationPercent: number;
    };
    pluginCount: number;
    utilizationPercent: number;
}
interface AgentContextEvents {
    'message:added': {
        item: InputItem;
        index: number;
    };
    'message:user': {
        item: InputItem;
    };
    'message:assistant': {
        item: InputItem;
    };
    'history:cleared': {
        reason?: string;
    };
    'history:compacted': {
        removedCount: number;
    };
    'tool:registered': {
        name: string;
    };
    'tool:executed': {
        record: ToolCallRecord;
    };
    'tool:cached': {
        name: string;
        args: Record<string, unknown>;
    };
    'context:preparing': {
        componentCount: number;
    };
    'context:prepared': {
        budget: ContextBudget;
        compacted: boolean;
    };
    'compacted': {
        log: string[];
        tokensFreed: number;
    };
    'budget:warning': {
        budget: ContextBudget;
    };
    'budget:critical': {
        budget: ContextBudget;
    };
    'plugin:registered': {
        name: string;
    };
    'plugin:unregistered': {
        name: string;
    };
}
declare class AgentContext extends EventEmitter<AgentContextEvents> {
    private readonly _tools;
    private readonly _memory;
    private readonly _cache;
    private readonly _permissions;
    private _inContextMemory;
    private _persistentInstructions;
    private _toolOutputPlugin;
    private _autoSpillPlugin;
    private readonly _agentId;
    private readonly _features;
    private _systemPrompt;
    private _instructions;
    private _toolCalls;
    private _currentInput;
    private _historyEnabled;
    /** Conversation stored as InputItem[] - THE source of truth */
    private _conversation;
    /** Metadata for each message (keyed by message ID) */
    private _messageMetadata;
    /** Messages at or after this index cannot be compacted (current iteration protection) */
    private _protectedFromIndex;
    private _plugins;
    private _config;
    private _maxContextTokens;
    private _strategy;
    private _estimator;
    private _cacheEnabled;
    private _compactionCount;
    private _totalTokensFreed;
    private _lastBudget;
    private _explicitTaskType?;
    private _autoDetectedTaskType?;
    private _autoDetectTaskType;
    private _storage;
    private _sessionId;
    private _sessionMetadata;
    private constructor();
    /**
     * Create a new AgentContext
     */
    static create(config?: AgentContextConfig): AgentContext;
    /** Tool manager - register, enable/disable, execute tools */
    get tools(): ToolManager;
    /** Working memory - store/retrieve agent state (null if memory feature disabled) */
    get memory(): WorkingMemory | null;
    /** Tool result cache - automatic deduplication (null if memory feature disabled) */
    get cache(): IdempotencyCache | null;
    /** Tool permissions - approval workflow (null if permissions feature disabled) */
    get permissions(): ToolPermissionManager | null;
    /** InContextMemory plugin (null if inContextMemory feature disabled) */
    get inContextMemory(): InContextMemoryPlugin | null;
    /** PersistentInstructions plugin (null if persistentInstructions feature disabled) */
    get persistentInstructions(): PersistentInstructionsPlugin | null;
    /** ToolOutputPlugin (null if toolOutputTracking feature disabled) */
    get toolOutputPlugin(): ToolOutputPlugin | null;
    /** AutoSpillPlugin (null if autoSpill feature disabled or memory disabled) */
    get autoSpillPlugin(): AutoSpillPlugin | null;
    /** Agent ID (auto-generated or from config) */
    get agentId(): string;
    /** Current session ID (null if no session loaded/saved) */
    get sessionId(): string | null;
    /** Storage backend for session persistence (null if not configured) */
    get storage(): IContextStorage | null;
    /**
     * Get the resolved feature configuration
     */
    get features(): Readonly<Required<AgentContextFeatures>>;
    /**
     * Check if a specific feature is enabled
     */
    isFeatureEnabled(feature: keyof AgentContextFeatures): boolean;
    /**
     * Get memory, throwing if disabled
     * Use when memory is required for an operation
     */
    requireMemory(): WorkingMemory;
    /**
     * Get cache, throwing if disabled
     * Use when cache is required for an operation
     */
    requireCache(): IdempotencyCache;
    /**
     * Get permissions, throwing if disabled
     * Use when permissions is required for an operation
     */
    requirePermissions(): ToolPermissionManager;
    /**
     * Validate feature dependencies and warn about potential issues
     * Called during construction after feature resolution
     */
    private validateFeatures;
    /** Get/set system prompt */
    get systemPrompt(): string;
    set systemPrompt(value: string);
    /** Get/set instructions */
    get instructions(): string;
    set instructions(value: string);
    /** Set current input for this turn */
    setCurrentInput(input: string): void;
    /** Get current input */
    getCurrentInput(): string;
    /**
     * Add user message to conversation.
     *
     * @param content - String or Content[] for the message
     * @returns Message ID
     */
    addUserMessage(content: string | Content[]): string;
    /**
     * Add raw InputItem[] to conversation (for complex inputs with images, files, etc.)
     *
     * @param items - InputItem[] to add
     */
    addInputItems(items: InputItem[]): void;
    /**
     * Add assistant response to conversation (including tool calls).
     *
     * @param output - OutputItem[] from LLM response
     * @returns Array of message IDs added
     */
    addAssistantResponse(output: OutputItem[]): string[];
    /**
     * Add tool results to conversation.
     *
     * @param results - ToolResult[] from tool execution
     * @returns Message ID of the tool results message
     */
    addToolResults(results: ToolResult[]): string;
    /**
     * Mark current position as protected from compaction.
     * Messages at or after this index cannot be compacted.
     * Called at the start of each iteration by AgenticLoop.
     */
    protectFromCompaction(): void;
    /**
     * Get conversation (read-only).
     */
    getConversation(): ReadonlyArray<InputItem>;
    /**
     * Get conversation length.
     */
    getConversationLength(): number;
    /**
     * Clear conversation.
     */
    clearConversation(reason?: string): void;
    /**
     * Unified context preparation method.
     *
     * Handles everything for preparing context before LLM calls:
     * 1. Marks current position as protected from compaction
     * 2. Calculates token usage
     * 3. Compacts if needed (respecting protection & tool pairs)
     * 4. Builds final output based on returnFormat option
     *
     * @param options - Preparation options
     * @returns PreparedResult with budget, compaction info, and either input or components
     *
     * @example
     * ```typescript
     * // For LLM calls (default)
     * const { input, budget } = await ctx.prepare();
     *
     * // For component inspection/custom assembly
     * const { components, budget } = await ctx.prepare({ returnFormat: 'components' });
     * ```
     */
    prepare(options?: PrepareOptions): Promise<PreparedResult>;
    /**
     * Prepare conversation for LLM call.
     * @deprecated Use prepare() instead. This is a thin wrapper for backward compatibility.
     */
    prepareConversation(options?: PrepareConversationOptions): Promise<PreparedConversation>;
    /**
     * Set explicit task type (overrides auto-detection)
     */
    setTaskType(type: TaskType): void;
    /**
     * Clear explicit task type (re-enables auto-detection)
     */
    clearTaskType(): void;
    /**
     * Get current task type
     * Priority: explicit > auto-detected > 'general'
     */
    getTaskType(): TaskType;
    /**
     * Get task-type-specific system prompt addition
     */
    getTaskTypePrompt(): string;
    /**
     * Register feature-aware tools based on enabled features.
     * Called once during construction to ensure ALL agent types have consistent tools.
     *
     * This is the SINGLE source of truth for context-related tool registration.
     * All agent types (Agent, TaskAgent, UniversalAgent) automatically get these tools.
     *
     * Consolidated tools (Phase 1):
     * - Always: context_stats (unified introspection - gracefully handles disabled features)
     * - When memory feature enabled: memory_store, memory_retrieve, memory_delete, memory_query, memory_cleanup_raw
     * - InContextMemory (context_set, context_delete, context_list) & PersistentInstructions tools
     *   are registered separately in the constructor when those features are enabled.
     */
    private _registerFeatureTools;
    /**
     * Auto-detect task type from plan (if PlanPlugin is registered)
     * Uses keyword matching - NO LLM calls
     */
    private detectTaskTypeFromPlan;
    /**
     * Add a message to history with automatic capacity management.
     *
     * This async version checks if adding the message would exceed context budget
     * and triggers compaction BEFORE adding if needed. Use this for large content
     * like tool outputs.
     *
     * @param role - Message role (user, assistant, system, tool)
     * @param content - Message content
     * @param metadata - Optional metadata
     * @returns The added message, or null if history feature is disabled
     *
     * @deprecated Use addUserMessage() or addAssistantResponse() instead
     *
     * @example
     * ```typescript
     * // For large tool outputs, capacity is checked automatically
     * await ctx.addMessage('tool', largeWebFetchResult);
     *
     * // For small messages, same API but less overhead
     * await ctx.addMessage('user', 'Hello');
     * ```
     */
    addMessage(role: 'user' | 'assistant' | 'system' | 'tool', content: string, metadata?: Record<string, unknown>): Promise<HistoryMessage | null>;
    /**
     * Add a message to history synchronously (without capacity checking).
     *
     * Use this when you need synchronous behavior or for small messages where
     * capacity checking overhead is not worth it. For large content (tool outputs,
     * fetched documents), prefer the async `addMessage()` instead.
     *
     * @param role - Message role (user, assistant, system, tool)
     * @param content - Message content
     * @param metadata - Optional metadata
     * @returns The added message, or null if history feature is disabled
     *
     * @deprecated Use addUserMessage() or addAssistantResponse() instead
     */
    addMessageSync(role: 'user' | 'assistant' | 'system' | 'tool', content: string, metadata?: Record<string, unknown>): HistoryMessage | null;
    /**
     * Add a tool result to context with automatic capacity management.
     *
     * This is a convenience method for adding tool outputs. It:
     * - Stringifies non-string results
     * - Checks capacity and triggers compaction if needed
     * - Adds as a 'tool' role message
     *
     * Use this for large tool outputs like web_fetch results, file contents, etc.
     *
     * @param result - The tool result (will be stringified for token estimation)
     * @param metadata - Optional metadata (e.g., tool name, duration)
     * @returns The added message, or null if history feature is disabled
     *
     * @deprecated Use addToolResults() with ToolResult[] instead
     *
     * @example
     * ```typescript
     * // Add large web fetch result
     * const html = await webFetch('https://example.com');
     * await ctx.addToolResult(html, { tool: 'web_fetch', url: 'https://example.com' });
     *
     * // Add structured data
     * await ctx.addToolResult({ items: [...], count: 100 }, { tool: 'search' });
     * ```
     */
    addToolResult(result: unknown, metadata?: Record<string, unknown>): Promise<HistoryMessage | null>;
    /**
     * Get all history messages as InputItem[]
     * @deprecated Use getConversation() instead - this is an alias
     */
    getHistory(): ReadonlyArray<InputItem>;
    /**
     * Get recent N messages as InputItem[]
     * @deprecated Use getConversation().slice(-count) instead
     */
    getRecentHistory(count: number): InputItem[];
    /**
     * Get message count
     * @deprecated Use getConversationLength() instead
     */
    getMessageCount(): number;
    /**
     * Clear history
     * @deprecated Use clearConversation() instead
     */
    clearHistory(reason?: string): void;
    /**
     * Get all tool call records
     */
    getToolCalls(): ToolCallRecord[];
    /**
     * Execute a tool with automatic caching
     *
     * This is the recommended way to execute tools - it integrates:
     * - Permission checking
     * - Result caching (if tool is cacheable and memory feature enabled)
     * - History recording
     * - Metrics tracking
     */
    executeTool(toolName: string, args: Record<string, unknown>, context?: Partial<ToolContext>): Promise<unknown>;
    /**
     * Register a context plugin
     */
    registerPlugin(plugin: IContextPlugin): void;
    /**
     * Unregister a plugin
     */
    unregisterPlugin(name: string): boolean;
    /**
     * Get a plugin by name
     */
    getPlugin<T extends IContextPlugin>(name: string): T | undefined;
    /**
     * List all registered plugins
     */
    listPlugins(): string[];
    /**
     * Get context components for custom assembly.
     * @deprecated Use prepare({ returnFormat: 'components' }) instead.
     */
    prepareComponents(): Promise<PreparedContext>;
    /**
     * Get current budget without full preparation
     */
    getBudget(): Promise<ContextBudget>;
    /**
     * Force compaction
     */
    compact(): Promise<PreparedContext>;
    /**
     * Set compaction strategy
     */
    setStrategy(strategy: 'proactive' | 'aggressive' | 'lazy' | 'rolling-window' | 'adaptive'): void;
    /**
     * Get max context tokens
     */
    getMaxContextTokens(): number;
    /**
     * Set max context tokens
     */
    setMaxContextTokens(tokens: number): void;
    /**
     * Enable/disable caching
     */
    setCacheEnabled(enabled: boolean): void;
    /**
     * Check if caching is enabled
     */
    isCacheEnabled(): boolean;
    /**
     * Estimate tokens for content
     */
    estimateTokens(content: string, type?: TokenContentType): number;
    /**
     * Get utilization percentage
     */
    getUtilization(): number;
    /**
     * Get last calculated budget
     */
    getLastBudget(): ContextBudget | null;
    /**
     * Ensure there's enough capacity for new content.
     * If adding the estimated tokens would exceed budget, triggers compaction first.
     *
     * This method enables proactive compaction BEFORE content is added, preventing
     * context overflow. It uses the configured strategy to determine when to compact.
     *
     * @param estimatedTokens - Estimated tokens of content to be added
     * @returns true if capacity is available (after potential compaction), false if cannot make room
     *
     * @example
     * ```typescript
     * const tokens = ctx.estimateTokens(largeToolOutput);
     * const hasRoom = await ctx.ensureCapacity(tokens);
     * if (hasRoom) {
     *   await ctx.addMessage('tool', largeToolOutput);
     * } else {
     *   // Handle overflow - truncate or summarize
     * }
     * ```
     */
    ensureCapacity(estimatedTokens: number): Promise<boolean>;
    /**
     * Get comprehensive metrics
     */
    getMetrics(): Promise<AgentContextMetrics>;
    /**
     * Get state for session persistence
     *
     * Serializes ALL state:
     * - History and tool calls
     * - Tool enable/disable state
     * - Memory entries (if enabled)
     * - Permission state (if enabled)
     * - Plugin state
     * - Feature configuration
     */
    getState(): Promise<SerializedAgentContextState>;
    /**
     * Restore from saved state
     *
     * Restores ALL state from a previous session.
     * Handles both v1 (HistoryMessage[]) and v2 (InputItem[]) formats.
     */
    restoreState(state: SerializedAgentContextState): Promise<void>;
    /**
     * Save the current context state to storage.
     *
     * @param sessionId - Session ID to save as. If not provided, uses the current sessionId.
     * @param metadata - Optional metadata to merge with existing session metadata.
     * @throws Error if no storage is configured or no sessionId is available.
     *
     * @example
     * ```typescript
     * // Save to a new session
     * await ctx.save('my-session-001', { title: 'Research on AI' });
     *
     * // Save to current session (must have been loaded or saved before)
     * await ctx.save();
     * ```
     */
    save(sessionId?: string, metadata?: ContextSessionMetadata, stateOverride?: SerializedAgentContextState): Promise<void>;
    /**
     * Load a session from storage and restore its state.
     *
     * @param sessionId - Session ID to load.
     * @returns true if the session was found and loaded, false if not found.
     * @throws Error if no storage is configured.
     *
     * @example
     * ```typescript
     * const loaded = await ctx.load('my-session-001');
     * if (loaded) {
     *   console.log('Session restored!');
     * } else {
     *   console.log('Session not found, starting fresh.');
     * }
     * ```
     */
    load(sessionId: string): Promise<boolean>;
    /**
     * Load session state from storage without restoring it.
     * Useful for agents that need to process state before restoring (e.g., to restore agentState).
     *
     * @param sessionId - Session ID to load.
     * @returns The stored state and metadata, or null if not found.
     */
    loadRaw(sessionId: string): Promise<{
        state: SerializedAgentContextState;
        metadata: ContextSessionMetadata;
    } | null>;
    /**
     * Check if a session exists in storage.
     *
     * @param sessionId - Session ID to check.
     * @returns true if the session exists.
     * @throws Error if no storage is configured.
     */
    sessionExists(sessionId: string): Promise<boolean>;
    /**
     * Delete a session from storage.
     *
     * @param sessionId - Session ID to delete. If not provided, deletes the current session.
     * @throws Error if no storage is configured or no sessionId is available.
     */
    deleteSession(sessionId?: string): Promise<void>;
    /**
     * Destroy the context and release resources
     */
    destroy(): void;
    /**
     * Build all context components
     * Uses task-type-aware priority profiles for compaction ordering
     * Conditionally includes components based on enabled features
     */
    private buildComponents;
    /**
     * Build task-type prompt adjusted for enabled features
     */
    private buildTaskTypePromptForFeatures;
    /**
     * Calculate budget
     */
    private calculateBudget;
    /**
     * Perform compaction
     */
    private doCompaction;
    /**
     * Compact history (legacy - calls new compactConversation)
     */
    private compactHistory;
    /**
     * Compact memory
     */
    private compactMemory;
    /**
     * Create token estimator
     */
    private createEstimator;
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Extract text content from Content array
     */
    private extractTextFromContent;
    /**
     * Estimate tokens for a single InputItem
     */
    private estimateMessageTokens;
    /**
     * Estimate total tokens for conversation
     */
    private estimateConversationTokens;
    /**
     * Estimate system tokens (prompts, instructions, plugins)
     */
    private estimateSystemTokens;
    /**
     * Calculate budget from token usage
     */
    private calculateBudgetFromTokens;
    /**
     * Find tool_use/tool_result pairs in conversation
     * Returns Map<tool_use_id, message_index>
     */
    private findToolPairs;
    /**
     * Compact conversation respecting tool pairs and protected messages
     */
    private compactConversation;
    /**
     * Build final InputItem[] for LLM call
     */
    private buildLLMInput;
    /**
     * Format conversation for context (backward compat for buildComponents)
     */
    private formatConversationForContext;
}

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
 * Generic Circuit Breaker implementation
 *
 * Prevents cascading failures by failing fast when a system is down.
 * Works for any async operation (LLM calls, tool execution, etc.)
 */

/**
 * Circuit breaker states
 */
type CircuitState = 'closed' | 'open' | 'half-open';
/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
    /** Number of failures before opening circuit */
    failureThreshold: number;
    /** Number of successes to close from half-open */
    successThreshold: number;
    /** Time to wait in open state before trying half-open (ms) */
    resetTimeoutMs: number;
    /** Time window for counting failures (ms) */
    windowMs: number;
    /** Classify errors - return true if error should count as failure */
    isRetryable?: (error: Error) => boolean;
}
/**
 * Circuit breaker metrics
 */
interface CircuitBreakerMetrics {
    name: string;
    state: CircuitState;
    totalRequests: number;
    successCount: number;
    failureCount: number;
    rejectedCount: number;
    recentFailures: number;
    consecutiveSuccesses: number;
    lastFailureTime?: number;
    lastSuccessTime?: number;
    lastStateChange: number;
    nextRetryTime?: number;
    failureRate: number;
    successRate: number;
}
/**
 * Circuit breaker events
 */
interface CircuitBreakerEvents {
    opened: {
        name: string;
        failureCount: number;
        lastError: string;
        nextRetryTime: number;
    };
    'half-open': {
        name: string;
        timestamp: number;
    };
    closed: {
        name: string;
        successCount: number;
        timestamp: number;
    };
}
/**
 * Default configuration
 */
declare const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig;
/**
 * Circuit breaker error - thrown when circuit is open
 */
declare class CircuitOpenError extends Error {
    readonly breakerName: string;
    readonly nextRetryTime: number;
    readonly failureCount: number;
    readonly lastError: string;
    constructor(breakerName: string, nextRetryTime: number, failureCount: number, lastError: string);
}
/**
 * Generic circuit breaker for any async operation
 */
declare class CircuitBreaker<T = any> extends EventEmitter<CircuitBreakerEvents> {
    readonly name: string;
    private state;
    private config;
    private failures;
    private lastError;
    private consecutiveSuccesses;
    private openedAt?;
    private lastStateChange;
    private totalRequests;
    private successCount;
    private failureCount;
    private rejectedCount;
    private lastFailureTime?;
    private lastSuccessTime?;
    constructor(name: string, config?: Partial<CircuitBreakerConfig>);
    /**
     * Execute function with circuit breaker protection
     */
    execute(fn: () => Promise<T>): Promise<T>;
    /**
     * Record successful execution
     */
    private recordSuccess;
    /**
     * Record failed execution
     */
    private recordFailure;
    /**
     * Transition to new state
     */
    private transitionTo;
    /**
     * Remove failures outside the time window
     */
    private pruneOldFailures;
    /**
     * Get current state
     */
    getState(): CircuitState;
    /**
     * Get current metrics
     */
    getMetrics(): CircuitBreakerMetrics;
    /**
     * Manually reset circuit breaker (force close)
     */
    reset(): void;
    /**
     * Check if circuit is allowing requests
     */
    isOpen(): boolean;
    /**
     * Get configuration
     */
    getConfig(): CircuitBreakerConfig;
}

interface ToolOptions {
    /** Whether the tool is enabled. Default: true */
    enabled?: boolean;
    /** Namespace for grouping related tools. Default: 'default' */
    namespace?: string;
    /** Priority for selection ordering. Higher = preferred. Default: 0 */
    priority?: number;
    /** Conditions for auto-enable/disable */
    conditions?: ToolCondition[];
    /** Permission configuration override. If not set, uses tool's config or defaults. */
    permission?: ToolPermissionConfig$1;
}
interface ToolCondition {
    type: 'mode' | 'context' | 'custom';
    predicate: (context: ToolSelectionContext) => boolean;
}
interface ToolSelectionContext {
    /** Current user input or task description */
    input?: string;
    /** Current agent mode (for UniversalAgent) */
    mode?: string;
    /** Current task name (for TaskAgent) */
    currentTask?: string;
    /** Recently used tools (to avoid repetition) */
    recentTools?: string[];
    /** Token budget for tool definitions */
    tokenBudget?: number;
    /** Custom context data */
    custom?: Record<string, unknown>;
}
interface ToolRegistration {
    tool: ToolFunction;
    enabled: boolean;
    namespace: string;
    priority: number;
    conditions: ToolCondition[];
    metadata: ToolMetadata;
    /** Effective permission config (merged from tool.permission and options.permission) */
    permission?: ToolPermissionConfig$1;
    /** Circuit breaker configuration for this tool (uses shared CircuitBreakerConfig from resilience) */
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
}
interface ToolMetadata {
    registeredAt: Date;
    usageCount: number;
    lastUsed?: Date;
    totalExecutionMs: number;
    avgExecutionMs: number;
    successCount: number;
    failureCount: number;
}
interface ToolManagerStats {
    totalTools: number;
    enabledTools: number;
    disabledTools: number;
    namespaces: string[];
    toolsByNamespace: Record<string, number>;
    mostUsed: Array<{
        name: string;
        count: number;
    }>;
    totalExecutions: number;
}
interface SerializedToolState {
    enabled: Record<string, boolean>;
    namespaces: Record<string, string>;
    priorities: Record<string, number>;
    /** Permission configs by tool name */
    permissions?: Record<string, ToolPermissionConfig$1>;
}
type ToolManagerEvent = 'tool:registered' | 'tool:unregistered' | 'tool:enabled' | 'tool:disabled' | 'tool:executed' | 'namespace:enabled' | 'namespace:disabled';
declare class ToolManager extends EventEmitter implements IToolExecutor, IDisposable {
    private registry;
    private namespaceIndex;
    private circuitBreakers;
    private toolLogger;
    private _isDestroyed;
    /** Optional tool context for execution (set by agent before runs) */
    private _toolContext;
    /**
     * Parent AgentContext reference for auto-building ToolContext
     * This ensures tools always have access to agentContext, memory, cache, etc.
     * even when execute() is called directly (e.g., by AgenticLoop)
     */
    private _parentContext;
    constructor();
    /**
     * Returns true if destroy() has been called.
     */
    get isDestroyed(): boolean;
    /**
     * Releases all resources held by this ToolManager.
     * Cleans up circuit breaker listeners and removes all event listeners.
     * Safe to call multiple times (idempotent).
     */
    destroy(): void;
    /**
     * Set tool context for execution (called by agent before runs)
     */
    setToolContext(context: ToolContext | undefined): void;
    /**
     * Get current tool context
     */
    getToolContext(): ToolContext | undefined;
    /**
     * Set parent AgentContext for automatic context building
     * Called by AgentContext after construction to enable auto-context in execute()
     *
     * This is the KEY to making tools work correctly:
     * - When AgenticLoop calls ToolManager.execute() directly, we auto-build context
     * - When AgentContext.executeTool() is used, it sets explicit _toolContext
     *
     * @param context - The parent AgentContext that owns this ToolManager
     */
    setParentContext(context: AgentContext | null): void;
    /**
     * Get current parent context
     */
    getParentContext(): AgentContext | null;
    /**
     * Build ToolContext from parent AgentContext
     * Used when execute() is called directly without explicit context
     * @private
     */
    private _buildContextFromParent;
    /**
     * Register a tool with optional configuration
     */
    register(tool: ToolFunction, options?: ToolOptions): void;
    /**
     * Register multiple tools at once
     */
    registerMany(tools: ToolFunction[], options?: Omit<ToolOptions, 'conditions'>): void;
    /**
     * Unregister a tool by name
     */
    unregister(name: string): boolean;
    /**
     * Clear all tools and their circuit breakers.
     * Does NOT remove event listeners from this ToolManager (use destroy() for full cleanup).
     */
    clear(): void;
    /**
     * Enable a tool by name
     */
    enable(name: string): boolean;
    /**
     * Disable a tool by name (keeps it registered but inactive)
     */
    disable(name: string): boolean;
    /**
     * Toggle a tool's enabled state
     */
    toggle(name: string): boolean;
    /**
     * Check if a tool is enabled
     */
    isEnabled(name: string): boolean;
    /**
     * Set enabled state for multiple tools
     */
    setEnabled(names: string[], enabled: boolean): void;
    /**
     * Set the namespace for a tool
     */
    setNamespace(toolName: string, namespace: string): boolean;
    /**
     * Enable all tools in a namespace
     */
    enableNamespace(namespace: string): void;
    /**
     * Disable all tools in a namespace
     */
    disableNamespace(namespace: string): void;
    /**
     * Get all namespace names
     */
    getNamespaces(): string[];
    /**
     * Create a namespace with tools
     */
    createNamespace(namespace: string, tools: ToolFunction[], options?: Omit<ToolOptions, 'namespace'>): void;
    /**
     * Set priority for a tool
     */
    setPriority(name: string, priority: number): boolean;
    /**
     * Get priority for a tool
     */
    getPriority(name: string): number | undefined;
    /**
     * Get permission config for a tool
     */
    getPermission(name: string): ToolPermissionConfig$1 | undefined;
    /**
     * Set permission config for a tool
     */
    setPermission(name: string, permission: ToolPermissionConfig$1): boolean;
    /**
     * Get a tool by name
     */
    get(name: string): ToolFunction | undefined;
    /**
     * Check if a tool exists
     */
    has(name: string): boolean;
    /**
     * Get all enabled tools (sorted by priority)
     */
    getEnabled(): ToolFunction[];
    /**
     * Get all tools (enabled and disabled)
     */
    getAll(): ToolFunction[];
    /**
     * Get tools by namespace
     */
    getByNamespace(namespace: string): ToolFunction[];
    /**
     * Get tool registration info
     */
    getRegistration(name: string): ToolRegistration | undefined;
    /**
     * List all tool names
     */
    list(): string[];
    /**
     * List enabled tool names
     */
    listEnabled(): string[];
    /**
     * Get count of registered tools
     */
    get size(): number;
    /**
     * Select tools based on context (uses conditions and smart filtering)
     */
    selectForContext(context: ToolSelectionContext): ToolFunction[];
    /**
     * Select tools by matching capability description
     */
    selectByCapability(description: string): ToolFunction[];
    /**
     * Filter tools to fit within a token budget
     */
    selectWithinBudget(budget: number): ToolFunction[];
    /**
     * Record tool execution (called by agent/loop)
     */
    recordExecution(name: string, executionMs: number, success: boolean): void;
    /**
     * Summarize tool result for logging (handles various result types)
     */
    private summarizeResult;
    /**
     * Get comprehensive statistics
     */
    getStats(): ToolManagerStats;
    /**
     * Execute a tool function with circuit breaker protection
     * Implements IToolExecutor interface
     */
    execute(toolName: string, args: any): Promise<any>;
    /**
     * Check if tool is available (IToolExecutor interface)
     */
    hasToolFunction(toolName: string): boolean;
    /**
     * Get tool definition (IToolExecutor interface)
     */
    getToolDefinition(toolName: string): Tool | undefined;
    /**
     * Register a tool (IToolExecutor interface - delegates to register())
     */
    registerTool(tool: ToolFunction): void;
    /**
     * Unregister a tool (IToolExecutor interface - delegates to unregister())
     */
    unregisterTool(toolName: string): void;
    /**
     * List all registered tool names (IToolExecutor interface - delegates to list())
     */
    listTools(): string[];
    /**
     * Get or create circuit breaker for a tool
     */
    private getOrCreateCircuitBreaker;
    /**
     * Get circuit breaker states for all tools
     */
    getCircuitBreakerStates(): Map<string, CircuitState>;
    /**
     * Get circuit breaker metrics for a specific tool
     */
    getToolCircuitBreakerMetrics(toolName: string): CircuitBreakerMetrics | undefined;
    /**
     * Manually reset a tool's circuit breaker
     */
    resetToolCircuitBreaker(toolName: string): void;
    /**
     * Configure circuit breaker for a tool
     */
    setCircuitBreakerConfig(toolName: string, config: CircuitBreakerConfig): boolean;
    /**
     * Get serializable state (for session persistence)
     */
    getState(): SerializedToolState;
    /**
     * Load state (restores enabled/disabled, namespaces, priorities, permissions)
     * Note: Tools must be re-registered separately (they contain functions)
     */
    loadState(state: SerializedToolState): void;
    private getToolName;
    private getSortedByPriority;
    private addToNamespace;
    private removeFromNamespace;
    private moveToNamespace;
    private filterByTokenBudget;
    private estimateToolTokens;
}

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
    /**
     * AgentContext for unified context management.
     * When provided, AgenticLoop delegates ALL context management to AgentContext:
     * - Uses prepareConversation() before each LLM call
     * - Uses addAssistantResponse() and addToolResults() after each iteration
     * - Skips internal sliding window (AgentContext handles compaction)
     */
    agentContext?: AgentContext;
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

export { type InContextMemoryConfig as $, type AgentPermissionsConfig as A, BaseContextPlugin as B, type ContextSessionMetadata as C, type ContextManagerConfig as D, ExecutionContext as E, type FunctionToolDefinition as F, type IContextCompactor as G, type HookConfig as H, type IContextStorage as I, type TokenContentType as J, type IPersistentInstructionsStorage as K, type LLMResponse as L, type MemoryEntry as M, type StoredContextSession as N, type ContextStorageListOptions as O, type ContextSessionSummary as P, type TokenUsage as Q, type ToolCall as R, type SerializedAgentContextState as S, type ToolFunction as T, StreamEventType as U, CircuitBreaker as V, WorkingMemory as W, type TextGenerateOptions as X, type ModelCapabilities as Y, type ToolPermissionConfig$1 as Z, MessageRole as _, ToolManager as a, type WorkingMemoryAccess as a$, InContextMemoryPlugin as a0, type PersistentInstructionsConfig as a1, PersistentInstructionsPlugin as a2, DEFAULT_FEATURES as a3, type AgentContextEvents as a4, type AgentContextMetrics as a5, type HistoryMessage as a6, type ToolCallRecord as a7, type PrepareOptions as a8, type PreparedResult as a9, type DefaultAllowlistedTool as aA, CONTEXT_SESSION_FORMAT_VERSION as aB, type WorkingMemoryEvents as aC, type EvictionStrategy as aD, type IdempotencyCacheConfig as aE, type CacheStats as aF, DEFAULT_IDEMPOTENCY_CONFIG as aG, type PreparedContext as aH, DEFAULT_CONTEXT_CONFIG as aI, type MemoryEntryInput as aJ, type MemoryIndex as aK, type MemoryIndexEntry as aL, type MemoryPriority as aM, type TaskAwareScope as aN, type SimpleScope as aO, type TaskStatusForMemory as aP, DEFAULT_MEMORY_CONFIG as aQ, forTasks as aR, forPlan as aS, scopeEquals as aT, scopeMatches as aU, isSimpleScope as aV, isTaskAwareScope as aW, isTerminalMemoryStatus as aX, calculateEntrySize as aY, MEMORY_PRIORITY_VALUES as aZ, type ToolContext as a_, ToolOutputPlugin as aa, AutoSpillPlugin as ab, type ToolOutputPluginConfig as ac, type ToolOutput as ad, type SpilledEntry as ae, type ToolOptions as af, type ToolCondition as ag, type ToolSelectionContext as ah, type ToolRegistration as ai, type ToolMetadata as aj, type ToolManagerStats as ak, type SerializedToolState as al, type ToolManagerEvent as am, type PermissionScope as an, type RiskLevel as ao, type ToolPermissionConfig as ap, type ApprovalCacheEntry as aq, type SerializedApprovalState as ar, type SerializedApprovalEntry as as, type PermissionCheckResult as at, type ApprovalDecision as au, type PermissionCheckContext as av, type PermissionManagerEvent as aw, APPROVAL_STATE_VERSION as ax, DEFAULT_PERMISSION_CONFIG as ay, DEFAULT_ALLOWLIST as az, AgentContext as b, type ToolStartEvent as b$, ContentType as b0, type Content as b1, type InputTextContent as b2, type InputImageContent as b3, type OutputTextContent as b4, type ToolUseContent as b5, type ToolResultContent as b6, type Message as b7, type OutputItem as b8, type CompactionItem as b9, isResponseComplete as bA, isErrorEvent as bB, HookManager as bC, type AgenticLoopEventName as bD, type HookName as bE, type Hook as bF, type ModifyingHook as bG, type BeforeToolContext as bH, type AfterToolContext as bI, type ApproveToolContext as bJ, type ToolModification as bK, type ApprovalResult as bL, type IToolExecutor as bM, type IAsyncDisposable as bN, assertNotDestroyed as bO, CircuitOpenError as bP, type CircuitBreakerConfig as bQ, type CircuitBreakerEvents as bR, DEFAULT_CIRCUIT_BREAKER_CONFIG as bS, type InContextEntry as bT, type InContextPriority as bU, type SerializedInContextMemoryState as bV, type SerializedPersistentInstructionsState as bW, AgenticLoop as bX, type AgenticLoopConfig as bY, type ExecutionStartEvent as bZ, type ExecutionCompleteEvent as b_, type ReasoningItem as ba, ToolCallState as bb, defaultDescribeCall as bc, getToolCallDescription as bd, type Tool as be, type BuiltInTool as bf, type ToolResult as bg, type ToolExecutionContext as bh, type JSONSchema as bi, type ResponseCreatedEvent as bj, type ResponseInProgressEvent as bk, type OutputTextDeltaEvent as bl, type OutputTextDoneEvent as bm, type ToolCallStartEvent as bn, type ToolCallArgumentsDeltaEvent as bo, type ToolCallArgumentsDoneEvent as bp, type ToolExecutionStartEvent as bq, type ToolExecutionDoneEvent as br, type IterationCompleteEvent$1 as bs, type ResponseCompleteEvent as bt, type ErrorEvent as bu, isStreamEvent as bv, isOutputTextDelta as bw, isToolCallStart as bx, isToolCallArgumentsDelta as by, isToolCallArgumentsDone as bz, type AgentContextConfig as c, type ToolCompleteEvent as c0, type LLMRequestEvent as c1, type LLMResponseEvent as c2, ToolPermissionManager as d, type InputItem as e, type StreamEvent as f, type AgentContextFeatures as g, type HistoryMode as h, type AgenticLoopEvents as i, type IDisposable as j, type AgentResponse as k, type ExecutionMetrics as l, type AuditEntry as m, type CircuitState as n, type CircuitBreakerMetrics as o, type IContextComponent as p, type ITextProvider as q, type IMemoryStorage as r, type MemoryScope as s, type ITokenEstimator as t, type StaleEntryInfo as u, IdempotencyCache as v, type WorkingMemoryConfig as w, type AutoSpillConfig as x, type IContextStrategy as y, type ContextBudget as z };
