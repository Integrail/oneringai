import { C as Connector, A as AudioFormat, I as IBaseModelDescription, V as VendorOptionSchema, a as Vendor, b as IImageProvider, c as ConnectorFetchOptions, d as ITokenStorage, S as StoredToken$1, e as ConnectorConfig, f as ConnectorConfigResult } from './ImageModel-BkWFy986.js';
export { m as APIKeyConnectorAuth, D as AspectRatio, l as ConnectorAuth, L as DEFAULT_BASE_DELAY_MS, G as DEFAULT_CONNECTOR_TIMEOUT, M as DEFAULT_MAX_DELAY_MS, H as DEFAULT_MAX_RETRIES, K as DEFAULT_RETRYABLE_STATUSES, n as IImageModelDescription, q as IMAGE_MODELS, r as IMAGE_MODEL_REGISTRY, F as ISourceLinks, y as ImageEditOptions, x as ImageGenerateOptions, h as ImageGeneration, j as ImageGenerationCreateOptions, o as ImageModelCapabilities, p as ImageModelPricing, B as ImageResponse, z as ImageVariationOptions, J as JWTConnectorAuth, O as OAuthConnectorAuth, E as OutputFormat, Q as QualityLevel, k as SimpleGenerateOptions, g as VENDORS, w as calculateImageCost, u as getActiveImageModels, s as getImageModelInfo, t as getImageModelsByVendor, v as getImageModelsWithFeature, i as isVendor } from './ImageModel-BkWFy986.js';
import { T as ToolFunction, I as IToolExecutor, a as ToolPermissionConfig, b as Tool, S as SerializedApprovalState, A as AgentPermissionsConfig, c as ToolPermissionManager, F as FunctionToolDefinition, H as HookConfig, d as HistoryMode, e as AgenticLoopEvents, f as InputItem, g as AgentResponse, h as StreamEvent, E as ExecutionContext, i as ExecutionMetrics, j as AuditEntry, k as ITextProvider, l as TokenUsage, m as ToolCall, L as LLMResponse, n as StreamEventType, o as TextGenerateOptions, M as ModelCapabilities, p as MessageRole } from './index-CGaZn76e.js';
export { x as APPROVAL_STATE_VERSION, ar as AfterToolContext, am as AgenticLoopEventName, r as ApprovalCacheEntry, u as ApprovalDecision, au as ApprovalResult, as as ApproveToolContext, aq as BeforeToolContext, _ as BuiltInTool, V as CompactionItem, B as Content, C as ContentType, y as DEFAULT_ALLOWLIST, D as DEFAULT_PERMISSION_CONFIG, z as DefaultAllowlistedTool, ad as ErrorEvent, ao as Hook, al as HookManager, an as HookName, J as InputImageContent, G as InputTextContent, ab as IterationCompleteEvent, a1 as JSONSchema, Q as Message, ap as ModifyingHook, U as OutputItem, O as OutputTextContent, a4 as OutputTextDeltaEvent, a5 as OutputTextDoneEvent, v as PermissionCheckContext, t as PermissionCheckResult, w as PermissionManagerEvent, P as PermissionScope, W as ReasoningItem, ac as ResponseCompleteEvent, a2 as ResponseCreatedEvent, a3 as ResponseInProgressEvent, R as RiskLevel, s as SerializedApprovalEntry, a7 as ToolCallArgumentsDeltaEvent, a8 as ToolCallArgumentsDoneEvent, a6 as ToolCallStartEvent, X as ToolCallState, a0 as ToolExecutionContext, aa as ToolExecutionDoneEvent, a9 as ToolExecutionStartEvent, at as ToolModification, q as ToolPermissionConfig, $ as ToolResult, N as ToolResultContent, K as ToolUseContent, Y as defaultDescribeCall, Z as getToolCallDescription, ak as isErrorEvent, af as isOutputTextDelta, aj as isResponseComplete, ae as isStreamEvent, ah as isToolCallArgumentsDelta, ai as isToolCallArgumentsDone, ag as isToolCallStart } from './index-CGaZn76e.js';
import { EventEmitter } from 'eventemitter3';
import { I as IProvider, P as ProviderCapabilities } from './IProvider-BP49c93d.js';

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
    constructor(provider: IContextProvider, config?: Partial<ContextManagerConfig>, compactors?: IContextCompactor[], estimator?: ITokenEstimator, strategy?: IContextStrategy);
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
 */
declare class IdempotencyCache {
    private config;
    private cache;
    private hits;
    private misses;
    private cleanupInterval?;
    constructor(config?: IdempotencyCacheConfig);
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
     * Clear all cached results
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
    /** Abort signal for cancellation */
    signal?: AbortSignal;
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
    permission?: ToolPermissionConfig;
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
    permission?: ToolPermissionConfig;
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
    permissions?: Record<string, ToolPermissionConfig>;
}
type ToolManagerEvent = 'tool:registered' | 'tool:unregistered' | 'tool:enabled' | 'tool:disabled' | 'tool:executed' | 'namespace:enabled' | 'namespace:disabled';
declare class ToolManager extends EventEmitter implements IToolExecutor {
    private registry;
    private namespaceIndex;
    private circuitBreakers;
    private toolLogger;
    /** Optional tool context for execution (set by agent before runs) */
    private _toolContext;
    constructor();
    /**
     * Set tool context for execution (called by agent before runs)
     */
    setToolContext(context: ToolContext | undefined): void;
    /**
     * Get current tool context
     */
    getToolContext(): ToolContext | undefined;
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
     * Clear all tools
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
    getPermission(name: string): ToolPermissionConfig | undefined;
    /**
     * Set permission config for a tool
     */
    setPermission(name: string, permission: ToolPermissionConfig): boolean;
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
 * SessionManager - Unified session persistence for all agent types
 *
 * Provides session management capabilities:
 * - Create, save, load, delete sessions
 * - Auto-save functionality
 * - Session metadata and filtering
 * - Pluggable storage backends
 *
 * Works with Agent, TaskAgent, and UniversalAgent
 */

interface Session {
    /** Unique session identifier */
    id: string;
    /** Type of agent that owns this session */
    agentType: 'agent' | 'task-agent' | 'universal-agent' | string;
    /** When the session was created */
    createdAt: Date;
    /** Last activity timestamp */
    lastActiveAt: Date;
    /** Serialized conversation history */
    history: SerializedHistory;
    /** Tool enabled/disabled state */
    toolState: SerializedToolState;
    /** Working memory contents (TaskAgent, UniversalAgent) */
    memory?: SerializedMemory;
    /** Current plan (TaskAgent, UniversalAgent) */
    plan?: SerializedPlan;
    /** Current mode (UniversalAgent) */
    mode?: string;
    /** Execution metrics */
    metrics?: SessionMetrics;
    /** Tool permission approval state (all agent types) */
    approvalState?: SerializedApprovalState;
    /** Agent-specific custom data */
    custom: Record<string, unknown>;
    metadata: SessionMetadata;
}
interface SessionMetadata {
    /** Optional user identifier */
    userId?: string;
    /** Human-readable title */
    title?: string;
    /** Tags for filtering */
    tags?: string[];
    /** Custom metadata */
    [key: string]: unknown;
}
interface SessionMetrics {
    totalMessages: number;
    totalToolCalls: number;
    totalTokens: number;
    totalDurationMs: number;
}
interface SerializedHistory {
    /** History format version */
    version: number;
    /** Serialized history entries */
    entries: SerializedHistoryEntry[];
}
interface SerializedHistoryEntry {
    type: 'user' | 'assistant' | 'tool_result' | 'system' | 'task_event' | 'plan_event';
    content: unknown;
    timestamp: string;
    metadata?: Record<string, unknown>;
}
interface SerializedMemory {
    /** Memory format version */
    version: number;
    /** Serialized memory entries */
    entries: SerializedMemoryEntry[];
}
interface SerializedMemoryEntry {
    key: string;
    description: string;
    value: unknown;
    scope: MemoryScope;
    sizeBytes: number;
    basePriority?: MemoryPriority;
    pinned?: boolean;
}
interface SerializedPlan {
    /** Plan format version */
    version: number;
    /** Plan data */
    data: unknown;
}
interface SessionFilter {
    /** Filter by agent type */
    agentType?: string;
    /** Filter by user ID */
    userId?: string;
    /** Filter by tags (any match) */
    tags?: string[];
    /** Filter by creation date range */
    createdAfter?: Date;
    createdBefore?: Date;
    /** Filter by last active date range */
    activeAfter?: Date;
    activeBefore?: Date;
    /** Limit results */
    limit?: number;
    /** Offset for pagination */
    offset?: number;
}
interface SessionSummary {
    id: string;
    agentType: string;
    createdAt: Date;
    lastActiveAt: Date;
    metadata: SessionMetadata;
    messageCount: number;
}
interface ISessionStorage {
    /**
     * Save a session (create or update)
     */
    save(session: Session): Promise<void>;
    /**
     * Load a session by ID
     */
    load(sessionId: string): Promise<Session | null>;
    /**
     * Delete a session by ID
     */
    delete(sessionId: string): Promise<void>;
    /**
     * Check if a session exists
     */
    exists(sessionId: string): Promise<boolean>;
    /**
     * List sessions with optional filtering
     */
    list(filter?: SessionFilter): Promise<SessionSummary[]>;
    /**
     * Search sessions by query string (searches title, tags, metadata)
     */
    search?(query: string, filter?: SessionFilter): Promise<SessionSummary[]>;
}
type SessionManagerEvent = 'session:created' | 'session:saved' | 'session:loaded' | 'session:deleted' | 'session:error' | 'session:warning' | 'session:migrated';
interface SessionManagerConfig {
    storage: ISessionStorage;
    /** Default metadata for new sessions */
    defaultMetadata?: Partial<SessionMetadata>;
    /** Validate sessions on load (default: true) */
    validateOnLoad?: boolean;
    /** Auto-migrate sessions with fixable issues (default: true) */
    autoMigrate?: boolean;
}
declare class SessionManager extends EventEmitter {
    private storage;
    private defaultMetadata;
    private autoSaveTimers;
    private validateOnLoad;
    private autoMigrate;
    private savesInFlight;
    private pendingSaves;
    constructor(config: SessionManagerConfig);
    /**
     * Create a new session
     */
    create(agentType: string, metadata?: SessionMetadata): Session;
    /**
     * Save a session to storage
     */
    save(session: Session): Promise<void>;
    /**
     * Load a session from storage
     */
    load(sessionId: string): Promise<Session | null>;
    /**
     * Delete a session from storage
     */
    delete(sessionId: string): Promise<void>;
    /**
     * Check if a session exists
     */
    exists(sessionId: string): Promise<boolean>;
    /**
     * List sessions with optional filtering
     */
    list(filter?: SessionFilter): Promise<SessionSummary[]>;
    /**
     * Search sessions by query string
     */
    search(query: string, filter?: SessionFilter): Promise<SessionSummary[]>;
    /**
     * Fork a session (create a copy with new ID)
     */
    fork(sessionId: string, newMetadata?: Partial<SessionMetadata>): Promise<Session>;
    /**
     * Update session metadata
     */
    updateMetadata(sessionId: string, metadata: Partial<SessionMetadata>): Promise<void>;
    /**
     * Enable auto-save for a session
     */
    enableAutoSave(session: Session, intervalMs: number, onSave?: (session: Session) => void): void;
    /**
     * Disable auto-save for a session
     */
    stopAutoSave(sessionId: string): void;
    /**
     * Stop all auto-save timers
     */
    stopAllAutoSave(): void;
    /**
     * Generate a unique session ID
     */
    private generateId;
    /**
     * Cleanup resources
     */
    destroy(): void;
}
/**
 * Create an empty serialized history
 */
declare function createEmptyHistory(): SerializedHistory;
/**
 * Create an empty serialized memory
 */
declare function createEmptyMemory(): SerializedMemory;
/**
 * Add an entry to serialized history
 */
declare function addHistoryEntry(history: SerializedHistory, type: SerializedHistoryEntry['type'], content: unknown, metadata?: Record<string, unknown>): void;

/**
 * Structured logging infrastructure
 *
 * Provides framework-wide structured logging with context propagation.
 * Supports console output (default) with optional file output.
 *
 * Environment variables:
 * - LOG_LEVEL: trace|debug|info|warn|error|silent (default: info)
 * - LOG_FILE: Path to log file (optional, default: console output)
 * - LOG_PRETTY: true|false (default: true in development)
 */
/**
 * Log level
 */
type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';
/**
 * Logger configuration
 */
interface LoggerConfig {
    /** Log level */
    level?: LogLevel;
    /** Pretty print for development */
    pretty?: boolean;
    /** Base context added to all logs */
    context?: Record<string, any>;
    /** Custom destination (default: console) */
    destination?: 'console' | 'stdout' | 'stderr';
    /** File path for file logging */
    filePath?: string;
}
/**
 * Log entry
 */
interface LogEntry {
    level: LogLevel;
    time: number;
    msg: string;
    [key: string]: any;
}
/**
 * Framework logger
 */
declare class FrameworkLogger {
    private config;
    private context;
    private levelValue;
    private fileStream?;
    constructor(config?: LoggerConfig);
    /**
     * Initialize file stream for logging
     */
    private initFileStream;
    /**
     * Create child logger with additional context
     */
    child(context: Record<string, any>): FrameworkLogger;
    /**
     * Trace log
     */
    trace(obj: Record<string, any> | string, msg?: string): void;
    /**
     * Debug log
     */
    debug(obj: Record<string, any> | string, msg?: string): void;
    /**
     * Info log
     */
    info(obj: Record<string, any> | string, msg?: string): void;
    /**
     * Warn log
     */
    warn(obj: Record<string, any> | string, msg?: string): void;
    /**
     * Error log
     */
    error(obj: Record<string, any> | string, msg?: string): void;
    /**
     * Internal log method
     */
    private log;
    /**
     * Output log entry
     */
    private output;
    /**
     * Pretty print for development
     */
    private prettyPrint;
    /**
     * JSON print for production
     */
    private jsonPrint;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<LoggerConfig>): void;
    /**
     * Close file stream
     */
    private closeFileStream;
    /**
     * Cleanup resources (call before process exit)
     */
    close(): void;
    /**
     * Get current log level
     */
    getLevel(): LogLevel;
    /**
     * Check if level is enabled
     */
    isLevelEnabled(level: LogLevel): boolean;
}
/**
 * Global logger singleton
 */
declare const logger: FrameworkLogger;

/**
 * Options for tool registration
 */
interface ToolRegistrationOptions {
    /** Namespace for the tool (e.g., 'user', '_meta', 'mcp:fs') */
    namespace?: string;
    /** Whether the tool is enabled by default */
    enabled?: boolean;
}
/**
 * Base session configuration (shared by all agent types)
 */
interface BaseSessionConfig {
    /** Storage backend for sessions */
    storage: ISessionStorage;
    /** Resume existing session by ID */
    id?: string;
    /** Auto-save session after each interaction */
    autoSave?: boolean;
    /** Auto-save interval in milliseconds */
    autoSaveIntervalMs?: number;
}
/**
 * Tool execution context passed to lifecycle hooks
 */
interface ToolExecutionHookContext {
    /** Name of the tool being executed */
    toolName: string;
    /** Arguments passed to the tool */
    args: Record<string, unknown>;
    /** Agent ID */
    agentId: string;
    /** Task ID (if running in TaskAgent) */
    taskId?: string;
}
/**
 * Tool execution result passed to afterToolExecution hook
 */
interface ToolExecutionResult {
    /** Name of the tool that was executed */
    toolName: string;
    /** Result returned by the tool */
    result: unknown;
    /** Execution duration in milliseconds */
    durationMs: number;
    /** Whether the execution was successful */
    success: boolean;
    /** Error if execution failed */
    error?: Error;
}
/**
 * Agent lifecycle hooks for customization.
 * These hooks allow external code to observe and modify agent behavior
 * at key points in the execution lifecycle.
 */
interface AgentLifecycleHooks {
    /**
     * Called before a tool is executed.
     * Can be used for logging, validation, or rate limiting.
     * Throw an error to prevent tool execution.
     *
     * @param context - Tool execution context
     * @returns Promise that resolves when hook completes
     */
    beforeToolExecution?: (context: ToolExecutionHookContext) => Promise<void>;
    /**
     * Called after a tool execution completes (success or failure).
     * Can be used for logging, metrics, or cleanup.
     *
     * @param result - Tool execution result
     * @returns Promise that resolves when hook completes
     */
    afterToolExecution?: (result: ToolExecutionResult) => Promise<void>;
    /**
     * Called before context is prepared for LLM call.
     * Can be used to inject additional context or modify components.
     *
     * @param agentId - Agent identifier
     * @returns Promise that resolves when hook completes
     */
    beforeContextPrepare?: (agentId: string) => Promise<void>;
    /**
     * Called after context compaction occurs.
     * Can be used for logging or monitoring context management.
     *
     * @param log - Compaction log messages
     * @param tokensFreed - Number of tokens freed
     * @returns Promise that resolves when hook completes
     */
    afterCompaction?: (log: string[], tokensFreed: number) => Promise<void>;
    /**
     * Called when agent encounters an error.
     * Can be used for custom error handling or recovery logic.
     *
     * @param error - The error that occurred
     * @param context - Additional context about where the error occurred
     * @returns Promise that resolves when hook completes
     */
    onError?: (error: Error, context: {
        phase: string;
        agentId: string;
    }) => Promise<void>;
}
/**
 * Base configuration shared by all agent types
 */
interface BaseAgentConfig {
    /** Connector name or instance */
    connector: string | Connector;
    /** Model identifier */
    model: string;
    /** Agent name (optional, auto-generated if not provided) */
    name?: string;
    /** Tools available to the agent */
    tools?: ToolFunction[];
    /** Provide a pre-configured ToolManager (advanced) */
    toolManager?: ToolManager;
    /** Session configuration */
    session?: BaseSessionConfig;
    /** Permission configuration */
    permissions?: AgentPermissionsConfig;
    /** Lifecycle hooks for customization */
    lifecycleHooks?: AgentLifecycleHooks;
}
/**
 * Base events emitted by all agent types.
 * Agent subclasses typically extend their own event interfaces.
 */
interface BaseAgentEvents {
    'session:saved': {
        sessionId: string;
    };
    'session:loaded': {
        sessionId: string;
    };
    destroyed: void;
}
/**
 * Abstract base class for all agent types.
 *
 * @internal This class is not exported in the public API.
 *
 * Note: TEvents is not constrained to BaseAgentEvents to allow subclasses
 * to define their own event interfaces (e.g., AgenticLoopEvents for Agent).
 */
declare abstract class BaseAgent<TConfig extends BaseAgentConfig = BaseAgentConfig, TEvents extends Record<string, any> = BaseAgentEvents> extends EventEmitter<TEvents> {
    readonly name: string;
    readonly connector: Connector;
    readonly model: string;
    protected _config: TConfig;
    protected _toolManager: ToolManager;
    protected _permissionManager: ToolPermissionManager;
    protected _sessionManager: SessionManager | null;
    protected _session: Session | null;
    protected _pendingSessionLoad: Promise<void> | null;
    protected _isDestroyed: boolean;
    protected _cleanupCallbacks: Array<() => void | Promise<void>>;
    protected _logger: FrameworkLogger;
    protected _lifecycleHooks: AgentLifecycleHooks;
    constructor(config: TConfig, loggerComponent: string);
    /**
     * Get the agent type identifier for session serialization
     */
    protected abstract getAgentType(): 'agent' | 'task-agent' | 'universal-agent';
    /**
     * Prepare session state before saving.
     * Subclasses override to add their specific state (plan, memory, etc.)
     *
     * Default implementation does nothing - override in subclasses.
     */
    protected prepareSessionState(): void;
    /**
     * Restore session state after loading.
     * Subclasses override to restore their specific state (plan, memory, etc.)
     * Called after tool state and approval state are restored.
     *
     * Default implementation does nothing - override in subclasses.
     */
    protected restoreSessionState(_session: Session): Promise<void>;
    /**
     * Get plan state for session serialization.
     * Subclasses with plans override this.
     */
    protected getSerializedPlan(): SerializedPlan | undefined;
    /**
     * Get memory state for session serialization.
     * Subclasses with working memory override this.
     */
    protected getSerializedMemory(): SerializedMemory | undefined;
    /**
     * Resolve connector from string name or instance
     */
    protected resolveConnector(ref: string | Connector): Connector;
    /**
     * Initialize tool manager with provided tools
     */
    protected initializeToolManager(existingManager?: ToolManager, tools?: ToolFunction[], options?: ToolRegistrationOptions): ToolManager;
    /**
     * Register multiple tools with the tool manager
     * Utility method to avoid code duplication across agent types
     */
    protected registerTools(manager: ToolManager, tools: ToolFunction[], options?: ToolRegistrationOptions): void;
    /**
     * Initialize permission manager
     */
    protected initializePermissionManager(config?: AgentPermissionsConfig, tools?: ToolFunction[]): ToolPermissionManager;
    /**
     * Initialize session management (call from subclass constructor after other setup)
     */
    protected initializeSession(sessionConfig?: BaseSessionConfig): void;
    /**
     * Ensure any pending session load is complete
     */
    protected ensureSessionLoaded(): Promise<void>;
    /**
     * Internal method to load session
     */
    protected loadSessionInternal(sessionId: string): Promise<void>;
    /**
     * Get the current session ID (if session is enabled)
     */
    getSessionId(): string | null;
    /**
     * Check if this agent has session support enabled
     */
    hasSession(): boolean;
    /**
     * Get the current session (for advanced use)
     */
    getSession(): Session | null;
    /**
     * Save the current session to storage
     * @throws Error if session is not enabled
     */
    saveSession(): Promise<void>;
    /**
     * Update session custom data
     */
    updateSessionData(key: string, value: unknown): void;
    /**
     * Get session custom data
     */
    getSessionData<T = unknown>(key: string): T | undefined;
    /**
     * Advanced tool management. Returns ToolManager for fine-grained control.
     */
    get tools(): ToolManager;
    /**
     * Permission management. Returns ToolPermissionManager for approval control.
     */
    get permissions(): ToolPermissionManager;
    /**
     * Add a tool to the agent
     */
    addTool(tool: ToolFunction): void;
    /**
     * Remove a tool from the agent
     */
    removeTool(toolName: string): void;
    /**
     * List registered tools (returns enabled tool names)
     */
    listTools(): string[];
    /**
     * Replace all tools with a new array
     */
    setTools(tools: ToolFunction[]): void;
    /**
     * Get enabled tool definitions (for passing to LLM).
     * This is a helper that extracts definitions from enabled tools.
     */
    protected getEnabledToolDefinitions(): FunctionToolDefinition[];
    /**
     * Get the current lifecycle hooks configuration
     */
    get lifecycleHooks(): AgentLifecycleHooks;
    /**
     * Set or update lifecycle hooks at runtime
     */
    setLifecycleHooks(hooks: Partial<AgentLifecycleHooks>): void;
    /**
     * Invoke beforeToolExecution hook if defined.
     * Call this before executing a tool.
     *
     * @throws Error if hook throws (prevents tool execution)
     */
    protected invokeBeforeToolExecution(context: ToolExecutionHookContext): Promise<void>;
    /**
     * Invoke afterToolExecution hook if defined.
     * Call this after tool execution completes (success or failure).
     */
    protected invokeAfterToolExecution(result: ToolExecutionResult): Promise<void>;
    /**
     * Invoke beforeContextPrepare hook if defined.
     * Call this before preparing context for LLM.
     */
    protected invokeBeforeContextPrepare(): Promise<void>;
    /**
     * Invoke afterCompaction hook if defined.
     * Call this after context compaction occurs.
     */
    protected invokeAfterCompaction(log: string[], tokensFreed: number): Promise<void>;
    /**
     * Invoke onError hook if defined.
     * Call this when the agent encounters an error.
     */
    protected invokeOnError(error: Error, phase: string): Promise<void>;
    get isDestroyed(): boolean;
    /**
     * Register a cleanup callback
     */
    onCleanup(callback: () => void | Promise<void>): void;
    /**
     * Base cleanup for session and listeners.
     * Subclasses should call super.baseDestroy() in their destroy() method.
     */
    protected baseDestroy(): void;
    /**
     * Run cleanup callbacks
     */
    protected runCleanupCallbacks(): Promise<void>;
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
declare class WorkingMemory extends EventEmitter<WorkingMemoryEvents> {
    private storage;
    private config;
    private priorityCalculator;
    private priorityContext;
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
     * Destroy the WorkingMemory instance
     * Removes all event listeners and clears internal state
     */
    destroy(): void;
}

/**
 * IContextPlugin - Interface for context plugins
 *
 * Plugins extend the UnifiedContextManager with custom context components.
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
 * History message
 */
interface HistoryMessage$1 {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
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
}
/**
 * Serialized state for session persistence
 */
interface SerializedAgentContextState {
    version: number;
    core: {
        systemPrompt: string;
        instructions: string;
        history: HistoryMessage$1[];
        toolCalls: ToolCallRecord[];
    };
    tools: SerializedToolState;
    memoryStats?: {
        entryCount: number;
        sizeBytes: number;
    };
    permissions: SerializedApprovalState;
    plugins: Record<string, unknown>;
    config: {
        model: string;
        maxContextTokens: number;
        strategy: string;
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
        message: HistoryMessage$1;
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
    private _systemPrompt;
    private _instructions;
    private _history;
    private _toolCalls;
    private _currentInput;
    private _plugins;
    private _config;
    private _maxContextTokens;
    private _strategy;
    private _estimator;
    private _cacheEnabled;
    private _compactionCount;
    private _totalTokensFreed;
    private _lastBudget;
    private constructor();
    /**
     * Create a new AgentContext
     */
    static create(config?: AgentContextConfig): AgentContext;
    /** Tool manager - register, enable/disable, execute tools */
    get tools(): ToolManager;
    /** Working memory - store/retrieve agent state */
    get memory(): WorkingMemory;
    /** Tool result cache - automatic deduplication */
    get cache(): IdempotencyCache;
    /** Tool permissions - approval workflow */
    get permissions(): ToolPermissionManager;
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
     * Add a message to history
     */
    addMessage(role: 'user' | 'assistant' | 'system' | 'tool', content: string, metadata?: Record<string, unknown>): HistoryMessage$1;
    /**
     * Get all history messages
     */
    getHistory(): HistoryMessage$1[];
    /**
     * Get recent N messages
     */
    getRecentHistory(count: number): HistoryMessage$1[];
    /**
     * Get message count
     */
    getMessageCount(): number;
    /**
     * Clear history
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
     * - Result caching (if tool is cacheable)
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
     * Prepare context for LLM call
     *
     * Assembles all components:
     * - System prompt, instructions
     * - Conversation history
     * - Memory index
     * - Plugin components
     * - Current input
     *
     * Handles compaction automatically if budget is exceeded.
     */
    prepare(): Promise<PreparedContext>;
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
     * Get comprehensive metrics
     */
    getMetrics(): Promise<AgentContextMetrics>;
    /**
     * Get state for session persistence
     *
     * Serializes ALL state:
     * - History and tool calls
     * - Tool enable/disable state
     * - Memory state
     * - Permission state
     * - Plugin state
     */
    getState(): Promise<SerializedAgentContextState>;
    /**
     * Restore from saved state
     *
     * Restores ALL state from a previous session.
     */
    restoreState(state: SerializedAgentContextState): Promise<void>;
    /**
     * Destroy the context and release resources
     */
    destroy(): void;
    /**
     * Build all context components
     */
    private buildComponents;
    /**
     * Format history for context
     */
    private formatHistoryForContext;
    /**
     * Calculate budget
     */
    private calculateBudget;
    /**
     * Perform compaction
     */
    private doCompaction;
    /**
     * Compact history
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
}

/**
 * Session configuration for Agent (same as BaseSessionConfig)
 */
type AgentSessionConfig = BaseSessionConfig;
/**
 * Agent configuration - extends BaseAgentConfig with Agent-specific options
 */
interface AgentConfig$1 extends BaseAgentConfig {
    /** System instructions for the agent */
    instructions?: string;
    /** Temperature for generation */
    temperature?: number;
    /** Maximum iterations for tool calling loop */
    maxIterations?: number;
    /** Vendor-specific options (e.g., Google's thinkingLevel: 'low' | 'high') */
    vendorOptions?: Record<string, any>;
    /**
     * Optional unified context management.
     * When provided (as AgentContext instance or config), Agent will:
     * - Track conversation history
     * - Cache tool results (if enabled)
     * - Provide unified memory access
     * - Support session persistence via context
     *
     * Pass an AgentContext instance or AgentContextConfig to enable.
     */
    context?: AgentContext | AgentContextConfig;
    hooks?: HookConfig;
    historyMode?: HistoryMode;
    limits?: {
        maxExecutionTime?: number;
        maxToolCalls?: number;
        maxContextSize?: number;
        maxInputMessages?: number;
    };
    errorHandling?: {
        hookFailureMode?: 'fail' | 'warn' | 'ignore';
        toolFailureMode?: 'fail' | 'continue';
        maxConsecutiveErrors?: number;
    };
}
/**
 * Agent class - represents an AI assistant with tool calling capabilities
 *
 * Extends BaseAgent to inherit:
 * - Connector resolution
 * - Tool manager initialization
 * - Permission manager initialization
 * - Session management
 * - Lifecycle/cleanup
 */
declare class Agent extends BaseAgent<AgentConfig$1, AgenticLoopEvents> implements IDisposable {
    private provider;
    private agenticLoop;
    private boundListeners;
    private _context;
    /**
     * Create a new agent
     *
     * @example
     * ```typescript
     * const agent = Agent.create({
     *   connector: 'openai',  // or Connector instance
     *   model: 'gpt-4',
     *   instructions: 'You are a helpful assistant',
     *   tools: [myTool]
     * });
     * ```
     */
    static create(config: AgentConfig$1): Agent;
    /**
     * Resume an agent from a saved session
     *
     * @example
     * ```typescript
     * const agent = await Agent.resume('session-123', {
     *   connector: 'openai',
     *   model: 'gpt-4',
     *   session: { storage: myStorage }
     * });
     * ```
     */
    static resume(sessionId: string, config: Omit<AgentConfig$1, 'session'> & {
        session: {
            storage: ISessionStorage;
        };
    }): Promise<Agent>;
    private constructor();
    protected getAgentType(): 'agent' | 'task-agent' | 'universal-agent';
    protected prepareSessionState(): void;
    /**
     * Get the optional AgentContext (if configured).
     * Returns null if context management was not enabled.
     *
     * @example
     * ```typescript
     * const agent = Agent.create({
     *   connector: 'openai',
     *   model: 'gpt-4',
     *   context: { autoCompact: true },
     * });
     *
     * // Access context features
     * if (agent.context) {
     *   const history = agent.context.getHistory();
     *   const budget = await agent.context.getBudget();
     *   agent.context.memory.store('key', 'desc', value);
     * }
     * ```
     */
    get context(): AgentContext | null;
    /**
     * Check if context management is enabled
     */
    hasContext(): boolean;
    /**
     * Get context state for session persistence.
     * Returns null if context is not enabled.
     */
    getContextState(): Promise<SerializedAgentContextState | null>;
    /**
     * Restore context from saved state.
     * No-op if context is not enabled.
     */
    restoreContextState(state: SerializedAgentContextState): Promise<void>;
    /**
     * Run the agent with input
     */
    run(input: string | InputItem[]): Promise<AgentResponse>;
    /**
     * Stream response from the agent
     */
    stream(input: string | InputItem[]): AsyncIterableIterator<StreamEvent>;
    /**
     * Approve a tool for the current session.
     */
    approveToolForSession(toolName: string): void;
    /**
     * Revoke a tool's session approval.
     */
    revokeToolApproval(toolName: string): void;
    /**
     * Get list of tools that have been approved for this session.
     */
    getApprovedTools(): string[];
    /**
     * Check if a tool needs approval before execution.
     */
    toolNeedsApproval(toolName: string): boolean;
    /**
     * Check if a tool is blocked (cannot execute at all).
     */
    toolIsBlocked(toolName: string): boolean;
    /**
     * Add a tool to the allowlist (always allowed, no approval needed).
     */
    allowlistTool(toolName: string): void;
    /**
     * Add a tool to the blocklist (always blocked, cannot execute).
     */
    blocklistTool(toolName: string): void;
    /**
     * Change the model
     */
    setModel(model: string): void;
    /**
     * Get current temperature
     */
    getTemperature(): number | undefined;
    /**
     * Change the temperature
     */
    setTemperature(temperature: number): void;
    pause(reason?: string): void;
    resume(): void;
    cancel(reason?: string): void;
    getContext(): ExecutionContext | null;
    getMetrics(): ExecutionMetrics | null;
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
    } | null;
    getAuditTrail(): readonly AuditEntry[];
    /**
     * Get circuit breaker metrics for LLM provider
     */
    getProviderCircuitBreakerMetrics(): any;
    /**
     * Get circuit breaker states for all tools
     */
    getToolCircuitBreakerStates(): Map<string, CircuitState>;
    /**
     * Get circuit breaker metrics for a specific tool
     */
    getToolCircuitBreakerMetrics(toolName: string): CircuitBreakerMetrics | undefined;
    /**
     * Manually reset a tool's circuit breaker
     */
    resetToolCircuitBreaker(toolName: string): void;
    isRunning(): boolean;
    isPaused(): boolean;
    isCancelled(): boolean;
    destroy(): void;
    private setupEventForwarding;
}

/**
 * Provider Factory - creates the right provider from a Connector
 *
 * This is the bridge between Connectors and provider implementations.
 * It extracts credentials from the connector and instantiates the appropriate SDK.
 */

/**
 * Create a text provider from a connector
 */
declare function createProvider(connector: Connector): ITextProvider;

/**
 * Shared voice definitions and language constants
 * Eliminates duplication across TTS model registries
 */
/**
 * Voice information structure
 * Used consistently across all TTS providers
 */
interface IVoiceInfo {
    id: string;
    name: string;
    language: string;
    gender: 'male' | 'female' | 'neutral';
    style?: string;
    previewUrl?: string;
    isDefault?: boolean;
    accent?: string;
    age?: 'child' | 'young' | 'adult' | 'senior';
}

/**
 * Audio provider interfaces for Text-to-Speech and Speech-to-Text
 */

/**
 * Options for text-to-speech synthesis
 */
interface TTSOptions {
    /** Model to use (e.g., 'tts-1', 'gpt-4o-mini-tts') */
    model: string;
    /** Text to synthesize */
    input: string;
    /** Voice ID to use */
    voice: string;
    /** Audio output format */
    format?: AudioFormat;
    /** Speech speed (0.25 to 4.0, vendor-dependent) */
    speed?: number;
    /** Vendor-specific options passthrough */
    vendorOptions?: Record<string, unknown>;
}
/**
 * Response from text-to-speech synthesis
 */
interface TTSResponse {
    /** Audio data as Buffer */
    audio: Buffer;
    /** Format of the audio */
    format: AudioFormat;
    /** Duration in seconds (if available) */
    durationSeconds?: number;
    /** Number of characters used (for billing) */
    charactersUsed?: number;
}
/**
 * Text-to-Speech provider interface
 */
interface ITextToSpeechProvider extends IProvider {
    /**
     * Synthesize speech from text
     */
    synthesize(options: TTSOptions): Promise<TTSResponse>;
    /**
     * List available voices (optional - some providers return static list)
     */
    listVoices?(): Promise<IVoiceInfo[]>;
}
/**
 * STT output format types
 */
type STTOutputFormat$1 = 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';
/**
 * Options for speech-to-text transcription
 */
interface STTOptions {
    /** Model to use (e.g., 'whisper-1', 'gpt-4o-transcribe') */
    model: string;
    /** Audio data as Buffer or file path */
    audio: Buffer | string;
    /** Language code (ISO-639-1), optional for auto-detection */
    language?: string;
    /** Output format */
    outputFormat?: STTOutputFormat$1;
    /** Include word/segment timestamps */
    includeTimestamps?: boolean;
    /** Timestamp granularity if timestamps enabled */
    timestampGranularity?: 'word' | 'segment';
    /** Optional prompt to guide the model */
    prompt?: string;
    /** Temperature for sampling (0-1) */
    temperature?: number;
    /** Vendor-specific options passthrough */
    vendorOptions?: Record<string, unknown>;
}
/**
 * Word-level timestamp
 */
interface WordTimestamp {
    word: string;
    start: number;
    end: number;
}
/**
 * Segment-level timestamp
 */
interface SegmentTimestamp {
    id: number;
    text: string;
    start: number;
    end: number;
    tokens?: number[];
}
/**
 * Response from speech-to-text transcription
 */
interface STTResponse {
    /** Transcribed text */
    text: string;
    /** Detected or specified language */
    language?: string;
    /** Audio duration in seconds */
    durationSeconds?: number;
    /** Word-level timestamps (if requested) */
    words?: WordTimestamp[];
    /** Segment-level timestamps (if requested) */
    segments?: SegmentTimestamp[];
}
/**
 * Speech-to-Text provider interface
 */
interface ISpeechToTextProvider extends IProvider {
    /**
     * Transcribe audio to text
     */
    transcribe(options: STTOptions): Promise<STTResponse>;
    /**
     * Translate audio to English text (optional, Whisper-specific)
     */
    translate?(options: STTOptions): Promise<STTResponse>;
}

/**
 * Text-to-Speech model registry with comprehensive metadata
 */

/**
 * TTS model capabilities
 */
interface TTSModelCapabilities {
    /** Available voices (empty array means fetch dynamically via API) */
    voices: IVoiceInfo[];
    /** Supported output formats */
    formats: readonly AudioFormat[] | AudioFormat[];
    /** Supported languages (ISO-639-1 codes) */
    languages: readonly string[] | string[];
    /** Speed control support */
    speed: {
        supported: boolean;
        min?: number;
        max?: number;
        default?: number;
    };
    /** Feature support flags */
    features: {
        /** Real-time streaming support */
        streaming: boolean;
        /** SSML markup support */
        ssml: boolean;
        /** Emotion/style control */
        emotions: boolean;
        /** Custom voice cloning */
        voiceCloning: boolean;
        /** Word-level timestamps */
        wordTimestamps: boolean;
        /** Instruction steering (prompt-based style control) */
        instructionSteering?: boolean;
    };
    /** Model limits */
    limits: {
        /** Maximum input length in characters */
        maxInputLength: number;
        /** Rate limit (requests per minute) */
        maxRequestsPerMinute?: number;
    };
    /** Vendor-specific options schema */
    vendorOptions?: Record<string, VendorOptionSchema>;
}
/**
 * TTS model pricing
 */
interface TTSModelPricing {
    /** Cost per 1,000 characters */
    per1kCharacters: number;
    currency: 'USD';
}
/**
 * Complete TTS model description
 */
interface ITTSModelDescription extends IBaseModelDescription {
    capabilities: TTSModelCapabilities;
    pricing?: TTSModelPricing;
}
declare const TTS_MODELS: {
    readonly openai: {
        /** NEW: Instruction-steerable TTS with emotional control */
        readonly GPT_4O_MINI_TTS: "gpt-4o-mini-tts";
        /** Fast, low-latency TTS */
        readonly TTS_1: "tts-1";
        /** High-definition TTS */
        readonly TTS_1_HD: "tts-1-hd";
    };
    readonly google: {
        /** Gemini 2.5 Flash TTS (optimized for low latency) */
        readonly GEMINI_2_5_FLASH_TTS: "gemini-2.5-flash-preview-tts";
        /** Gemini 2.5 Pro TTS (optimized for quality) */
        readonly GEMINI_2_5_PRO_TTS: "gemini-2.5-pro-preview-tts";
    };
};
/**
 * Complete TTS model registry
 * Last full audit: January 2026
 */
declare const TTS_MODEL_REGISTRY: Record<string, ITTSModelDescription>;
declare const getTTSModelInfo: (modelName: string) => ITTSModelDescription | undefined;
declare const getTTSModelsByVendor: (vendor: Vendor) => ITTSModelDescription[];
declare const getActiveTTSModels: () => ITTSModelDescription[];
/**
 * Get TTS models that support a specific feature
 */
declare function getTTSModelsWithFeature(feature: keyof ITTSModelDescription['capabilities']['features']): ITTSModelDescription[];
/**
 * Calculate estimated cost for TTS
 */
declare function calculateTTSCost(modelName: string, characterCount: number): number | null;

/**
 * Configuration for TextToSpeech capability
 */
interface TextToSpeechConfig {
    /** Connector name or instance */
    connector: string | Connector;
    /** Default model to use */
    model?: string;
    /** Default voice to use */
    voice?: string;
    /** Default audio format */
    format?: AudioFormat;
    /** Default speed (0.25 to 4.0) */
    speed?: number;
}
/**
 * TextToSpeech capability class
 * Provides text-to-speech synthesis with model introspection
 *
 * @example
 * ```typescript
 * const tts = TextToSpeech.create({
 *   connector: 'openai',
 *   model: 'tts-1-hd',
 *   voice: 'nova',
 * });
 *
 * const audio = await tts.synthesize('Hello, world!');
 * await tts.toFile('Hello', './output.mp3');
 * ```
 */
declare class TextToSpeech {
    private provider;
    private config;
    /**
     * Create a new TextToSpeech instance
     */
    static create(config: TextToSpeechConfig): TextToSpeech;
    private constructor();
    /**
     * Synthesize speech from text
     *
     * @param text - Text to synthesize
     * @param options - Optional synthesis parameters
     * @returns Audio data and metadata
     */
    synthesize(text: string, options?: Partial<Omit<TTSOptions, 'model' | 'input'>>): Promise<TTSResponse>;
    /**
     * Synthesize speech and save to file
     *
     * @param text - Text to synthesize
     * @param filePath - Output file path
     * @param options - Optional synthesis parameters
     */
    toFile(text: string, filePath: string, options?: Partial<Omit<TTSOptions, 'model' | 'input'>>): Promise<void>;
    /**
     * Get model information for current or specified model
     */
    getModelInfo(model?: string): ITTSModelDescription;
    /**
     * Get model capabilities
     */
    getModelCapabilities(model?: string): TTSModelCapabilities;
    /**
     * List all available voices for current model
     * For dynamic voice providers (e.g., ElevenLabs), fetches from API
     * For static providers (e.g., OpenAI), returns from registry
     */
    listVoices(model?: string): Promise<IVoiceInfo[]>;
    /**
     * List all available models for this provider's vendor
     */
    listAvailableModels(): ITTSModelDescription[];
    /**
     * Check if a specific feature is supported by the model
     */
    supportsFeature(feature: keyof ITTSModelDescription['capabilities']['features'], model?: string): boolean;
    /**
     * Get supported audio formats for the model
     */
    getSupportedFormats(model?: string): readonly AudioFormat[] | AudioFormat[];
    /**
     * Get supported languages for the model
     */
    getSupportedLanguages(model?: string): readonly string[] | string[];
    /**
     * Check if speed control is supported
     */
    supportsSpeedControl(model?: string): boolean;
    /**
     * Update default model
     */
    setModel(model: string): void;
    /**
     * Update default voice
     */
    setVoice(voice: string): void;
    /**
     * Update default format
     */
    setFormat(format: AudioFormat): void;
    /**
     * Update default speed
     */
    setSpeed(speed: number): void;
    /**
     * Get default model (first active model for vendor)
     */
    private getDefaultModel;
    /**
     * Get default voice (first or default-marked voice)
     */
    private getDefaultVoice;
}

/**
 * Speech-to-Text model registry with comprehensive metadata
 */

/**
 * STT output format types
 */
type STTOutputFormat = 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';
/**
 * STT model capabilities
 */
interface STTModelCapabilities {
    /** Supported input audio formats */
    inputFormats: readonly string[] | string[];
    /** Supported output formats */
    outputFormats: STTOutputFormat[];
    /** Supported languages (empty = auto-detect all) */
    languages: string[];
    /** Timestamp support */
    timestamps: {
        supported: boolean;
        granularities?: ('word' | 'segment')[];
    };
    /** Feature support flags */
    features: {
        /** Translation to English */
        translation: boolean;
        /** Speaker identification */
        diarization: boolean;
        /** Real-time streaming (not implemented in v1) */
        streaming: boolean;
        /** Automatic punctuation */
        punctuation: boolean;
        /** Profanity filtering */
        profanityFilter: boolean;
    };
    /** Model limits */
    limits: {
        /** Maximum file size in MB */
        maxFileSizeMB: number;
        /** Maximum duration in seconds */
        maxDurationSeconds?: number;
    };
    /** Vendor-specific options schema */
    vendorOptions?: Record<string, VendorOptionSchema>;
}
/**
 * STT model pricing
 */
interface STTModelPricing {
    /** Cost per minute of audio */
    perMinute: number;
    currency: 'USD';
}
/**
 * Complete STT model description
 */
interface ISTTModelDescription extends IBaseModelDescription {
    capabilities: STTModelCapabilities;
    pricing?: STTModelPricing;
}
declare const STT_MODELS: {
    readonly openai: {
        /** NEW: GPT-4o based transcription */
        readonly GPT_4O_TRANSCRIBE: "gpt-4o-transcribe";
        /** NEW: GPT-4o with speaker diarization */
        readonly GPT_4O_TRANSCRIBE_DIARIZE: "gpt-4o-transcribe-diarize";
        /** Classic Whisper */
        readonly WHISPER_1: "whisper-1";
    };
    readonly groq: {
        /** Ultra-fast Whisper on Groq LPUs */
        readonly WHISPER_LARGE_V3: "whisper-large-v3";
        /** Faster English-only variant */
        readonly DISTIL_WHISPER: "distil-whisper-large-v3-en";
    };
};
/**
 * Complete STT model registry
 * Last full audit: January 2026
 */
declare const STT_MODEL_REGISTRY: Record<string, ISTTModelDescription>;
declare const getSTTModelInfo: (modelName: string) => ISTTModelDescription | undefined;
declare const getSTTModelsByVendor: (vendor: Vendor) => ISTTModelDescription[];
declare const getActiveSTTModels: () => ISTTModelDescription[];
/**
 * Get STT models that support a specific feature
 */
declare function getSTTModelsWithFeature(feature: keyof ISTTModelDescription['capabilities']['features']): ISTTModelDescription[];
/**
 * Calculate estimated cost for STT
 */
declare function calculateSTTCost(modelName: string, durationSeconds: number): number | null;

/**
 * Configuration for SpeechToText capability
 */
interface SpeechToTextConfig {
    /** Connector name or instance */
    connector: string | Connector;
    /** Default model to use */
    model?: string;
    /** Default language (ISO-639-1 code) */
    language?: string;
    /** Default temperature for sampling */
    temperature?: number;
}
/**
 * SpeechToText capability class
 * Provides speech-to-text transcription with model introspection
 *
 * @example
 * ```typescript
 * const stt = SpeechToText.create({
 *   connector: 'openai',
 *   model: 'whisper-1',
 * });
 *
 * const result = await stt.transcribe(audioBuffer);
 * console.log(result.text);
 *
 * const detailed = await stt.transcribeWithTimestamps(audioBuffer, 'word');
 * console.log(detailed.words);
 * ```
 */
declare class SpeechToText {
    private provider;
    private config;
    /**
     * Create a new SpeechToText instance
     */
    static create(config: SpeechToTextConfig): SpeechToText;
    private constructor();
    /**
     * Transcribe audio to text
     *
     * @param audio - Audio data as Buffer or file path
     * @param options - Optional transcription parameters
     * @returns Transcription result with text and metadata
     */
    transcribe(audio: Buffer | string, options?: Partial<Omit<STTOptions, 'model' | 'audio'>>): Promise<STTResponse>;
    /**
     * Transcribe audio file by path
     *
     * @param filePath - Path to audio file
     * @param options - Optional transcription parameters
     */
    transcribeFile(filePath: string, options?: Partial<Omit<STTOptions, 'model' | 'audio'>>): Promise<STTResponse>;
    /**
     * Transcribe audio with word or segment timestamps
     *
     * @param audio - Audio data as Buffer or file path
     * @param granularity - Timestamp granularity ('word' or 'segment')
     * @param options - Optional transcription parameters
     */
    transcribeWithTimestamps(audio: Buffer | string, granularity?: 'word' | 'segment', options?: Partial<Omit<STTOptions, 'model' | 'audio' | 'includeTimestamps' | 'timestampGranularity'>>): Promise<STTResponse>;
    /**
     * Translate audio to English text
     * Note: Only supported by some models (e.g., Whisper)
     *
     * @param audio - Audio data as Buffer or file path
     * @param options - Optional transcription parameters
     */
    translate(audio: Buffer | string, options?: Partial<Omit<STTOptions, 'model' | 'audio'>>): Promise<STTResponse>;
    /**
     * Get model information for current or specified model
     */
    getModelInfo(model?: string): ISTTModelDescription;
    /**
     * Get model capabilities
     */
    getModelCapabilities(model?: string): STTModelCapabilities;
    /**
     * List all available models for this provider's vendor
     */
    listAvailableModels(): ISTTModelDescription[];
    /**
     * Check if a specific feature is supported by the model
     */
    supportsFeature(feature: keyof ISTTModelDescription['capabilities']['features'], model?: string): boolean;
    /**
     * Get supported input audio formats
     */
    getSupportedInputFormats(model?: string): readonly string[] | string[];
    /**
     * Get supported output formats
     */
    getSupportedOutputFormats(model?: string): readonly string[];
    /**
     * Get supported languages (empty array = auto-detect all)
     */
    getSupportedLanguages(model?: string): readonly string[];
    /**
     * Check if timestamps are supported
     */
    supportsTimestamps(model?: string): boolean;
    /**
     * Check if translation is supported
     */
    supportsTranslation(model?: string): boolean;
    /**
     * Check if speaker diarization is supported
     */
    supportsDiarization(model?: string): boolean;
    /**
     * Get timestamp granularities supported
     */
    getTimestampGranularities(model?: string): ('word' | 'segment')[] | undefined;
    /**
     * Update default model
     */
    setModel(model: string): void;
    /**
     * Update default language
     */
    setLanguage(language: string): void;
    /**
     * Update default temperature
     */
    setTemperature(temperature: number): void;
    /**
     * Get default model (first active model for vendor)
     */
    private getDefaultModel;
}

/**
 * Factory functions for creating image providers
 */

/**
 * Create an Image Generation provider from a connector
 */
declare function createImageProvider(connector: Connector): IImageProvider;

/**
 * ErrorHandler - Centralized error handling for agents
 *
 * Provides consistent error handling, logging, and retry logic across all agent types.
 * This is an opt-in utility that agents can use for standardized error management.
 */

/**
 * Context information for error handling
 */
interface ErrorContext$1 {
    /** Type of agent */
    agentType: 'agent' | 'task-agent' | 'universal-agent';
    /** Optional agent identifier */
    agentId?: string;
    /** Operation that failed */
    operation: string;
    /** Input that caused the error (optional, for debugging) */
    input?: unknown;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Configuration for ErrorHandler
 */
interface ErrorHandlerConfig {
    /** Log errors to console/logger. Default: true */
    logErrors?: boolean;
    /** Include stack traces in logs. Default: true in development, false in production */
    includeStackTrace?: boolean;
    /** Custom error transformer */
    transformError?: (error: Error, context: ErrorContext$1) => Error;
    /** Error codes/messages that should be retried */
    retryablePatterns?: string[];
    /** Maximum retry attempts. Default: 3 */
    maxRetries?: number;
    /** Base delay for exponential backoff in ms. Default: 100 */
    baseRetryDelayMs?: number;
    /** Maximum retry delay in ms. Default: 5000 */
    maxRetryDelayMs?: number;
}
/**
 * Events emitted by ErrorHandler
 */
interface ErrorHandlerEvents {
    /** Emitted when an error is handled */
    error: {
        error: Error;
        context: ErrorContext$1;
        recoverable: boolean;
    };
    /** Emitted when retrying after an error */
    'error:retrying': {
        error: Error;
        context: ErrorContext$1;
        attempt: number;
        delayMs: number;
    };
    /** Emitted when an error is fatal (no recovery possible) */
    'error:fatal': {
        error: Error;
        context: ErrorContext$1;
    };
}
/**
 * Centralized error handling for all agent types.
 *
 * Features:
 * - Consistent error logging with context
 * - Automatic retry with exponential backoff
 * - Error classification (recoverable vs fatal)
 * - Metrics collection
 * - Event emission for monitoring
 *
 * @example
 * ```typescript
 * const errorHandler = new ErrorHandler({
 *   maxRetries: 3,
 *   logErrors: true,
 * });
 *
 * // Handle an error
 * errorHandler.handle(error, {
 *   agentType: 'agent',
 *   operation: 'run',
 * });
 *
 * // Execute with retry
 * const result = await errorHandler.executeWithRetry(
 *   () => riskyOperation(),
 *   { agentType: 'agent', operation: 'riskyOperation' }
 * );
 * ```
 */
declare class ErrorHandler extends EventEmitter<ErrorHandlerEvents> {
    private config;
    private logger;
    constructor(config?: ErrorHandlerConfig);
    /**
     * Handle an error with context.
     * Logs the error, emits events, and records metrics.
     *
     * @param error - The error to handle
     * @param context - Context information about where/how the error occurred
     */
    handle(error: Error, context: ErrorContext$1): void;
    /**
     * Execute a function with automatic retry on retryable errors.
     *
     * @param fn - The function to execute
     * @param context - Context for error handling
     * @returns The result of the function
     * @throws The last error if all retries are exhausted
     */
    executeWithRetry<T>(fn: () => Promise<T>, context: ErrorContext$1): Promise<T>;
    /**
     * Wrap a function with error handling (no retry).
     * Useful for wrapping methods that already have their own retry logic.
     *
     * @param fn - The function to wrap
     * @param contextFactory - Factory to create context from function arguments
     * @returns A wrapped function with error handling
     */
    wrap<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => Promise<TResult>, contextFactory: (...args: TArgs) => ErrorContext$1): (...args: TArgs) => Promise<TResult>;
    /**
     * Check if an error is recoverable (can be retried or handled gracefully).
     */
    isRecoverable(error: Error): boolean;
    /**
     * Check if an error should be retried.
     */
    isRetryable(error: Error): boolean;
    /**
     * Add a retryable pattern.
     */
    addRetryablePattern(pattern: string): void;
    /**
     * Remove a retryable pattern.
     */
    removeRetryablePattern(pattern: string): void;
    /**
     * Get current configuration (read-only).
     */
    getConfig(): Readonly<Required<ErrorHandlerConfig>>;
    private logError;
    private contextToLogFields;
    private recordMetrics;
    private calculateRetryDelay;
    private delay;
}
/**
 * Global error handler instance.
 * Can be used as a singleton for consistent error handling across the application.
 */
declare const globalErrorHandler: ErrorHandler;

/**
 * Video generation provider interface
 */

/**
 * Options for generating a video
 */
interface VideoGenerateOptions {
    /** Model to use */
    model: string;
    /** Text prompt describing the video */
    prompt: string;
    /** Duration in seconds */
    duration?: number;
    /** Output resolution (e.g., '1280x720', '1920x1080') */
    resolution?: string;
    /** Aspect ratio (alternative to resolution) */
    aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
    /** Reference image for image-to-video */
    image?: Buffer | string;
    /** Seed for reproducibility */
    seed?: number;
    /** Vendor-specific options */
    vendorOptions?: Record<string, unknown>;
}
/**
 * Options for extending an existing video
 */
interface VideoExtendOptions {
    /** Model to use */
    model: string;
    /** The video to extend */
    video: Buffer | string;
    /** Optional prompt for the extension */
    prompt?: string;
    /** Duration to add in seconds */
    extendDuration: number;
    /** Extend from beginning or end */
    direction?: 'start' | 'end';
}
/**
 * Video generation status (for async operations)
 */
type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed';
/**
 * Video generation job
 */
interface VideoJob {
    /** Job ID */
    id: string;
    /** Current status */
    status: VideoStatus;
    /** Timestamp when created */
    createdAt: number;
    /** Timestamp when completed (if applicable) */
    completedAt?: number;
    /** Error message if failed */
    error?: string;
    /** Progress percentage (0-100) */
    progress?: number;
}
/**
 * Video generation response
 */
interface VideoResponse {
    /** Job ID for tracking */
    jobId: string;
    /** Current status */
    status: VideoStatus;
    /** Timestamp when created */
    created: number;
    /** Progress percentage (0-100) */
    progress?: number;
    /** Generated video data (when complete) */
    video?: {
        /** URL to download the video (if available) */
        url?: string;
        /** Base64 encoded video data */
        b64_json?: string;
        /** Duration in seconds */
        duration?: number;
        /** Resolution */
        resolution?: string;
        /** Format (e.g., 'mp4', 'webm') */
        format?: string;
    };
    /** Audio track info (if separate) */
    audio?: {
        url?: string;
        b64_json?: string;
    };
    /** Error if failed */
    error?: string;
}
/**
 * Video provider interface
 */
interface IVideoProvider extends IProvider {
    /**
     * Generate a video from a text prompt
     * Returns a job that can be polled for completion
     */
    generateVideo(options: VideoGenerateOptions): Promise<VideoResponse>;
    /**
     * Get the status of a video generation job
     */
    getVideoStatus(jobId: string): Promise<VideoResponse>;
    /**
     * Download a completed video
     */
    downloadVideo?(jobId: string): Promise<Buffer>;
    /**
     * Extend an existing video (optional)
     */
    extendVideo?(options: VideoExtendOptions): Promise<VideoResponse>;
    /**
     * List available video models
     */
    listModels?(): Promise<string[]>;
    /**
     * Cancel a pending video generation job
     */
    cancelJob?(jobId: string): Promise<boolean>;
}

/**
 * Options for creating a VideoGeneration instance
 */
interface VideoGenerationCreateOptions {
    /** Connector name or instance */
    connector: string | Connector;
}
/**
 * Simplified options for quick generation
 */
interface SimpleVideoGenerateOptions {
    /** Text prompt describing the video */
    prompt: string;
    /** Model to use (defaults to vendor's best model) */
    model?: string;
    /** Duration in seconds */
    duration?: number;
    /** Output resolution (e.g., '1280x720', '1920x1080') */
    resolution?: string;
    /** Aspect ratio (alternative to resolution) */
    aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
    /** Reference image for image-to-video */
    image?: Buffer | string;
    /** Seed for reproducibility */
    seed?: number;
    /** Vendor-specific options */
    vendorOptions?: Record<string, unknown>;
}
/**
 * VideoGeneration capability class
 */
declare class VideoGeneration {
    private provider;
    private connector;
    private defaultModel;
    private constructor();
    /**
     * Create a VideoGeneration instance
     */
    static create(options: VideoGenerationCreateOptions): VideoGeneration;
    /**
     * Generate a video from a text prompt
     * Returns a job that can be polled for completion
     */
    generate(options: SimpleVideoGenerateOptions): Promise<VideoResponse>;
    /**
     * Get the status of a video generation job
     */
    getStatus(jobId: string): Promise<VideoResponse>;
    /**
     * Wait for a video generation job to complete
     */
    waitForCompletion(jobId: string, timeoutMs?: number): Promise<VideoResponse>;
    /**
     * Download a completed video
     */
    download(jobId: string): Promise<Buffer>;
    /**
     * Generate and wait for completion in one call
     */
    generateAndWait(options: SimpleVideoGenerateOptions, timeoutMs?: number): Promise<VideoResponse>;
    /**
     * Extend an existing video
     * Note: Not all models/vendors support this
     */
    extend(options: VideoExtendOptions): Promise<VideoResponse>;
    /**
     * Cancel a pending video generation job
     */
    cancel(jobId: string): Promise<boolean>;
    /**
     * List available models for this provider
     */
    listModels(): Promise<string[]>;
    /**
     * Get information about a specific model
     */
    getModelInfo(modelName: string): IVideoModelDescription | undefined;
    /**
     * Get the underlying provider
     */
    getProvider(): IVideoProvider;
    /**
     * Get the current connector
     */
    getConnector(): Connector;
    /**
     * Get the default model for this vendor
     */
    private getDefaultModel;
    /**
     * Get the model that supports video extension
     */
    private getExtendModel;
}

/**
 * Factory for creating video providers from connectors
 */

/**
 * Create a video provider from a connector
 */
declare function createVideoProvider(connector: Connector): IVideoProvider;

/**
 * SearchProvider - Unified search interface with connector support
 *
 * Provides a consistent API for web search across multiple vendors.
 * Uses Connector-First architecture for authentication.
 */

/**
 * Search result interface
 */
interface SearchResult {
    /** Page title */
    title: string;
    /** Direct URL to the page */
    url: string;
    /** Short description/excerpt */
    snippet: string;
    /** Search ranking position */
    position: number;
}
/**
 * Search options
 */
interface SearchOptions {
    /** Number of results to return (default: 10, max provider-specific) */
    numResults?: number;
    /** Language code (e.g., 'en', 'fr') */
    language?: string;
    /** Country/region code (e.g., 'us', 'gb') */
    country?: string;
    /** Time range filter (e.g., 'day', 'week', 'month', 'year') */
    timeRange?: string;
    /** Vendor-specific options */
    vendorOptions?: Record<string, any>;
}
/**
 * Search response
 */
interface SearchResponse {
    /** Whether the search succeeded */
    success: boolean;
    /** Search query */
    query: string;
    /** Provider name */
    provider: string;
    /** Search results */
    results: SearchResult[];
    /** Number of results */
    count: number;
    /** Error message if failed */
    error?: string;
}
/**
 * Base SearchProvider interface
 */
interface ISearchProvider {
    /** Provider name */
    readonly name: string;
    /** Connector used for authentication */
    readonly connector: Connector;
    /**
     * Search the web
     * @param query - Search query string
     * @param options - Search options
     */
    search(query: string, options?: SearchOptions): Promise<SearchResponse>;
}
/**
 * SearchProvider factory configuration
 */
interface SearchProviderConfig {
    /** Connector name or instance */
    connector: string | Connector;
}
/**
 * SearchProvider factory
 */
declare class SearchProvider {
    /**
     * Create a search provider from a connector
     * @param config - Provider configuration
     * @returns Search provider instance
     */
    static create(config: SearchProviderConfig): ISearchProvider;
}

/**
 * Serper.dev Search Provider
 * Google search results via Serper.dev API
 */

declare class SerperProvider implements ISearchProvider {
    readonly connector: Connector;
    readonly name = "serper";
    constructor(connector: Connector);
    search(query: string, options?: SearchOptions): Promise<SearchResponse>;
}

/**
 * Brave Search Provider
 * Independent search index (privacy-focused)
 */

declare class BraveProvider implements ISearchProvider {
    readonly connector: Connector;
    readonly name = "brave";
    constructor(connector: Connector);
    search(query: string, options?: SearchOptions): Promise<SearchResponse>;
}

/**
 * Tavily AI Search Provider
 * AI-optimized search results with summaries
 */

declare class TavilyProvider implements ISearchProvider {
    readonly connector: Connector;
    readonly name = "tavily";
    constructor(connector: Connector);
    search(query: string, options?: SearchOptions): Promise<SearchResponse>;
}

/**
 * RapidAPI Real-Time Web Search Provider
 * Real-time web search via RapidAPI
 */

declare class RapidAPIProvider implements ISearchProvider {
    readonly connector: Connector;
    readonly name = "rapidapi";
    constructor(connector: Connector);
    search(query: string, options?: SearchOptions): Promise<SearchResponse>;
}

/**
 * Shared types for Connector-based capabilities
 *
 * This module provides common types and utilities that can be reused
 * across all capabilities that use the Connector-First architecture.
 */

/**
 * Base configuration for all capability providers
 */
interface BaseProviderConfig$1 {
    /** Connector name or instance */
    connector: string | Connector;
}
/**
 * Base response for all capability providers
 */
interface BaseProviderResponse {
    /** Whether the operation succeeded */
    success: boolean;
    /** Provider name */
    provider: string;
    /** Error message if failed */
    error?: string;
}
/**
 * Base interface for all capability providers
 */
interface ICapabilityProvider {
    /** Provider name */
    readonly name: string;
    /** Connector used for authentication */
    readonly connector: Connector;
}
/**
 * Extended fetch options with JSON body and query params support
 * Usable by any capability that makes HTTP requests via Connector
 */
interface ExtendedFetchOptions extends Omit<ConnectorFetchOptions, 'body'> {
    /** JSON body (will be stringified automatically) */
    body?: Record<string, any>;
    /** Query parameters (will be appended to URL automatically) */
    queryParams?: Record<string, string | number | boolean>;
}
/**
 * Build query string from params
 * @param params - Key-value pairs to convert to query string
 * @returns URL-encoded query string (without leading ?)
 */
declare function buildQueryString(params: Record<string, string | number | boolean>): string;
/**
 * Convert ExtendedFetchOptions to standard ConnectorFetchOptions
 * Handles body stringification and query param building
 *
 * @param options - Extended options with body/queryParams
 * @returns Standard ConnectorFetchOptions ready for Connector.fetch()
 */
declare function toConnectorOptions(options: ExtendedFetchOptions): ConnectorFetchOptions;
/**
 * Build endpoint URL with query parameters
 * @param endpoint - Base endpoint path
 * @param queryParams - Query parameters to append
 * @returns Endpoint with query string
 */
declare function buildEndpointWithQuery(endpoint: string, queryParams?: Record<string, string | number | boolean>): string;
/**
 * Resolve connector from config (name or instance)
 * Shared logic for all provider factories
 *
 * @param connectorOrName - Connector name string or Connector instance
 * @returns Resolved Connector instance
 * @throws Error if connector not found
 */
declare function resolveConnector(connectorOrName: string | Connector): Connector;

/**
 * ScrapeProvider - Unified web scraping interface with connector support
 *
 * Provides a consistent API for web scraping across multiple vendors.
 * Uses Connector-First architecture for authentication.
 *
 * This is the surface API - actual scraping is delegated to vendor-specific
 * providers based on the Connector's serviceType.
 *
 * DESIGN PATTERN:
 * - IScrapeProvider: Interface all providers implement
 * - ScrapeProvider.create(): Factory that returns the right provider
 * - ScrapeProvider.createWithFallback(): Factory with fallback chain
 *
 * FALLBACK STRATEGY:
 * The webScrape tool uses this provider with a fallback chain:
 * 1. Try native fetch (webFetch) - fastest, free
 * 2. Try JS rendering (webFetchJS) - handles SPAs
 * 3. Try external API provider - handles bot protection, etc.
 */

/**
 * Scraped content result
 */
interface ScrapeResult {
    /** Page title */
    title: string;
    /** Extracted text content (cleaned) */
    content: string;
    /** Raw HTML (if available) */
    html?: string;
    /** Markdown version (if provider supports it) */
    markdown?: string;
    /** Metadata extracted from the page */
    metadata?: {
        description?: string;
        author?: string;
        publishedDate?: string;
        siteName?: string;
        favicon?: string;
        ogImage?: string;
        [key: string]: any;
    };
    /** Screenshot as base64 (if requested and supported) */
    screenshot?: string;
    /** Links found on the page */
    links?: Array<{
        url: string;
        text: string;
    }>;
}
/**
 * Scrape options
 */
interface ScrapeOptions {
    /** Timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Whether to wait for JavaScript to render (if supported) */
    waitForJS?: boolean;
    /** CSS selector to wait for before scraping */
    waitForSelector?: string;
    /** Whether to include raw HTML in response */
    includeHtml?: boolean;
    /** Whether to convert to markdown (if supported) */
    includeMarkdown?: boolean;
    /** Whether to extract links */
    includeLinks?: boolean;
    /** Whether to take a screenshot (if supported) */
    includeScreenshot?: boolean;
    /** Custom headers to send */
    headers?: Record<string, string>;
    /** Vendor-specific options */
    vendorOptions?: Record<string, any>;
}
/**
 * Scrape response
 */
interface ScrapeResponse extends BaseProviderResponse {
    /** The URL that was scraped */
    url: string;
    /** Final URL after redirects */
    finalUrl?: string;
    /** Scraped content */
    result?: ScrapeResult;
    /** HTTP status code */
    statusCode?: number;
    /** Time taken in milliseconds */
    durationMs?: number;
    /** Whether the content required JavaScript rendering */
    requiredJS?: boolean;
    /** Suggested fallback if this provider failed */
    suggestedFallback?: string;
}
/**
 * Base ScrapeProvider interface
 * All scraping providers must implement this interface
 */
interface IScrapeProvider {
    /** Provider name (e.g., 'jina', 'firecrawl', 'scrapingbee') */
    readonly name: string;
    /** Connector used for authentication */
    readonly connector: Connector;
    /**
     * Scrape a URL and extract content
     * @param url - URL to scrape
     * @param options - Scrape options
     * @returns Scrape response with content or error
     */
    scrape(url: string, options?: ScrapeOptions): Promise<ScrapeResponse>;
    /**
     * Check if this provider supports a specific feature
     * @param feature - Feature name
     */
    supportsFeature?(feature: ScrapeFeature): boolean;
}
/**
 * Features that scrape providers may support
 */
type ScrapeFeature = 'javascript' | 'markdown' | 'screenshot' | 'links' | 'metadata' | 'proxy' | 'stealth' | 'pdf' | 'dynamic';
/**
 * Provider constructor type
 */
type ProviderConstructor = new (connector: Connector) => IScrapeProvider;
/**
 * Register a scrape provider for a service type
 * Called by provider implementations to register themselves
 *
 * @param serviceType - Service type (e.g., 'jina', 'firecrawl')
 * @param providerClass - Provider constructor
 */
declare function registerScrapeProvider(serviceType: string, providerClass: ProviderConstructor): void;
/**
 * Get registered service types
 */
declare function getRegisteredScrapeProviders(): string[];
/**
 * ScrapeProvider factory configuration
 */
interface ScrapeProviderConfig {
    /** Connector name or instance */
    connector: string | Connector;
}
/**
 * Fallback chain configuration
 */
interface ScrapeProviderFallbackConfig {
    /** Primary connector to try first */
    primary: string | Connector;
    /** Fallback connectors to try in order */
    fallbacks?: Array<string | Connector>;
    /** Whether to try native fetch before API providers */
    tryNativeFirst?: boolean;
}
/**
 * ScrapeProvider factory
 *
 * Creates the appropriate provider based on Connector's serviceType.
 * Use createWithFallback() for automatic fallback on failure.
 */
declare class ScrapeProvider {
    /**
     * Create a scrape provider from a connector
     *
     * @param config - Provider configuration
     * @returns Scrape provider instance
     * @throws Error if connector not found or service type not supported
     *
     * @example
     * ```typescript
     * const scraper = ScrapeProvider.create({ connector: 'jina-main' });
     * const result = await scraper.scrape('https://example.com');
     * ```
     */
    static create(config: ScrapeProviderConfig): IScrapeProvider;
    /**
     * Check if a service type has a registered provider
     */
    static hasProvider(serviceType: string): boolean;
    /**
     * List all registered provider service types
     */
    static listProviders(): string[];
    /**
     * Create a scrape provider with fallback chain
     *
     * Returns a provider that will try each connector in order until one succeeds.
     *
     * @param config - Fallback configuration
     * @returns Scrape provider with fallback support
     *
     * @example
     * ```typescript
     * const scraper = ScrapeProvider.createWithFallback({
     *   primary: 'jina-main',
     *   fallbacks: ['firecrawl-backup', 'scrapingbee'],
     * });
     * // Will try jina first, then firecrawl, then scrapingbee
     * const result = await scraper.scrape('https://example.com');
     * ```
     */
    static createWithFallback(config: ScrapeProviderFallbackConfig): IScrapeProvider;
}

/**
 * Task and Plan entities for TaskAgent
 *
 * Defines the data structures for task-based autonomous agents.
 */
/**
 * Task status lifecycle
 */
type TaskStatus = 'pending' | 'blocked' | 'in_progress' | 'waiting_external' | 'completed' | 'failed' | 'skipped' | 'cancelled';
/**
 * Terminal statuses - task will not progress further
 */
declare const TERMINAL_TASK_STATUSES: TaskStatus[];
/**
 * Check if a task status is terminal (task will not progress further)
 */
declare function isTerminalStatus(status: TaskStatus): boolean;
/**
 * Plan status
 */
type PlanStatus = 'pending' | 'running' | 'suspended' | 'completed' | 'failed' | 'cancelled';
/**
 * Condition operators for conditional task execution
 */
type ConditionOperator = 'exists' | 'not_exists' | 'equals' | 'contains' | 'truthy' | 'greater_than' | 'less_than';
/**
 * Task condition - evaluated before execution
 */
interface TaskCondition {
    memoryKey: string;
    operator: ConditionOperator;
    value?: unknown;
    onFalse: 'skip' | 'fail' | 'wait';
}
/**
 * External dependency configuration
 */
interface ExternalDependency {
    type: 'webhook' | 'poll' | 'manual' | 'scheduled';
    /** For webhook: unique ID to match incoming webhook */
    webhookId?: string;
    /** For poll: how to check if complete */
    pollConfig?: {
        toolName: string;
        toolArgs: Record<string, unknown>;
        intervalMs: number;
        maxAttempts: number;
    };
    /** For scheduled: when to resume */
    scheduledAt?: number;
    /** For manual: description of what's needed */
    manualDescription?: string;
    /** Timeout for all types */
    timeoutMs?: number;
    /** Current state */
    state: 'waiting' | 'received' | 'timeout';
    /** Data received from external source */
    receivedData?: unknown;
    receivedAt?: number;
}
/**
 * Task execution settings
 */
interface TaskExecution {
    /** Can run in parallel with other parallel tasks */
    parallel?: boolean;
    /** Max concurrent if this spawns sub-work */
    maxConcurrency?: number;
    /** Priority (higher = executed first) */
    priority?: number;
    /**
     * If true (default), re-check condition immediately before LLM call
     * to protect against race conditions when parallel tasks modify memory.
     * Set to false to skip re-check for performance if you know condition won't change.
     */
    raceProtection?: boolean;
}
/**
 * Task completion validation settings
 *
 * Used to verify that a task actually achieved its goal before marking it complete.
 * Supports multiple validation approaches:
 * - Programmatic checks (memory keys, hooks)
 * - LLM self-reflection with completeness scoring
 * - Natural language criteria evaluation
 */
interface TaskValidation {
    /**
     * Natural language completion criteria.
     * These are evaluated by LLM self-reflection to determine if the task is complete.
     * Examples:
     * - "The response contains at least 3 specific examples"
     * - "User's email has been validated and stored in memory"
     * - "All requested data fields are present in the output"
     *
     * This is the RECOMMENDED approach for flexible, intelligent validation.
     */
    completionCriteria?: string[];
    /**
     * Minimum completeness score (0-100) to consider task successful.
     * LLM self-reflection returns a score; if below this threshold:
     * - If requireUserApproval is set, ask user
     * - Otherwise, follow the mode setting (strict = fail, warn = continue)
     * Default: 80
     */
    minCompletionScore?: number;
    /**
     * When to require user approval:
     * - 'never': Never ask user, use automated decision (default)
     * - 'uncertain': Ask user when score is between minCompletionScore and minCompletionScore + 15
     * - 'always': Always ask user to confirm task completion
     */
    requireUserApproval?: 'never' | 'uncertain' | 'always';
    /**
     * Memory keys that must exist after task completion.
     * If the task should store data in memory, list the required keys here.
     * This is a hard requirement checked BEFORE LLM reflection.
     */
    requiredMemoryKeys?: string[];
    /**
     * Custom validation function name (registered via validateTask hook).
     * The hook will be called with this identifier to dispatch to the right validator.
     * Runs AFTER LLM reflection, can override the result.
     */
    customValidator?: string;
    /**
     * Validation mode:
     * - 'strict': Validation failure marks task as failed (default)
     * - 'warn': Validation failure logs warning but task still completes
     */
    mode?: 'strict' | 'warn';
    /**
     * Skip LLM self-reflection validation.
     * Set to true if you only want programmatic validation (memory keys, hooks).
     * Default: false (reflection is enabled when completionCriteria is set)
     */
    skipReflection?: boolean;
}
/**
 * Result of task validation (returned by LLM reflection)
 */
interface TaskValidationResult {
    /** Whether the task is considered complete */
    isComplete: boolean;
    /** Completeness score from 0-100 */
    completionScore: number;
    /** LLM's explanation of why the task is/isn't complete */
    explanation: string;
    /** Per-criterion evaluation results */
    criteriaResults?: Array<{
        criterion: string;
        met: boolean;
        evidence?: string;
    }>;
    /** Whether user approval is needed */
    requiresUserApproval: boolean;
    /** Reason for requiring user approval */
    approvalReason?: string;
}
/**
 * A single unit of work
 */
interface Task {
    id: string;
    name: string;
    description: string;
    status: TaskStatus;
    /** Tasks that must complete before this one (task IDs) */
    dependsOn: string[];
    /** External dependency (if waiting on external event) */
    externalDependency?: ExternalDependency;
    /** Condition for execution */
    condition?: TaskCondition;
    /** Execution settings */
    execution?: TaskExecution;
    /** Completion validation settings */
    validation?: TaskValidation;
    /** Optional expected output description */
    expectedOutput?: string;
    /** Result after completion */
    result?: {
        success: boolean;
        output?: unknown;
        error?: string;
        /** Validation score (0-100) if validation was performed */
        validationScore?: number;
        /** Explanation of validation result */
        validationExplanation?: string;
    };
    /** Timestamps */
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    lastUpdatedAt: number;
    /** Retry tracking */
    attempts: number;
    maxAttempts: number;
    /** Metadata for extensions */
    metadata?: Record<string, unknown>;
}
/**
 * Input for creating a task
 */
interface TaskInput {
    id?: string;
    name: string;
    description: string;
    dependsOn?: string[];
    externalDependency?: ExternalDependency;
    condition?: TaskCondition;
    execution?: TaskExecution;
    validation?: TaskValidation;
    expectedOutput?: string;
    maxAttempts?: number;
    metadata?: Record<string, unknown>;
}
/**
 * Plan concurrency settings
 */
interface PlanConcurrency {
    maxParallelTasks: number;
    strategy: 'fifo' | 'priority' | 'shortest-first';
    /**
     * How to handle failures when executing tasks in parallel
     * - 'fail-fast': Stop on first failure (Promise.all behavior) - DEFAULT
     * - 'continue': Continue other tasks on failure, mark failed ones
     * - 'fail-all': Wait for all to complete, then report all failures together
     */
    failureMode?: 'fail-fast' | 'continue' | 'fail-all';
}
/**
 * Execution plan - a goal with steps to achieve it
 */
interface Plan {
    id: string;
    goal: string;
    context?: string;
    tasks: Task[];
    /** Concurrency settings */
    concurrency?: PlanConcurrency;
    /** Can agent modify the plan? */
    allowDynamicTasks: boolean;
    /** Plan status */
    status: PlanStatus;
    /** Why is the plan suspended? */
    suspendedReason?: {
        type: 'waiting_external' | 'manual_pause' | 'error';
        taskId?: string;
        message?: string;
    };
    /** Timestamps */
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    lastUpdatedAt: number;
    /** For resume: which task to continue from */
    currentTaskId?: string;
    /** Metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Input for creating a plan
 */
interface PlanInput {
    goal: string;
    context?: string;
    tasks: TaskInput[];
    concurrency?: PlanConcurrency;
    allowDynamicTasks?: boolean;
    metadata?: Record<string, unknown>;
    /** Skip dependency cycle detection (default: false) */
    skipCycleCheck?: boolean;
}
/**
 * Memory access interface for condition evaluation
 */
interface ConditionMemoryAccess {
    get(key: string): Promise<unknown>;
}
/**
 * Create a task with defaults
 */
declare function createTask(input: TaskInput): Task;
/**
 * Create a plan with tasks
 * @throws {DependencyCycleError} If circular dependencies detected (unless skipCycleCheck is true)
 */
declare function createPlan(input: PlanInput): Plan;
/**
 * Check if a task can be executed (dependencies met, status is pending)
 */
declare function canTaskExecute(task: Task, allTasks: Task[]): boolean;
/**
 * Get the next tasks that can be executed
 */
declare function getNextExecutableTasks(plan: Plan): Task[];
/**
 * Evaluate a task condition against memory
 */
declare function evaluateCondition(condition: TaskCondition, memory: ConditionMemoryAccess): Promise<boolean>;
/**
 * Update task status and timestamps
 */
declare function updateTaskStatus(task: Task, status: TaskStatus): Task;
/**
 * Check if a task is blocked by dependencies
 */
declare function isTaskBlocked(task: Task, allTasks: Task[]): boolean;
/**
 * Get the dependency tasks for a task
 */
declare function getTaskDependencies(task: Task, allTasks: Task[]): Task[];
/**
 * Resolve task name dependencies to task IDs
 * Modifies taskInputs in place
 */
declare function resolveDependencies(taskInputs: TaskInput[], tasks: Task[]): void;
/**
 * Detect dependency cycles in tasks using depth-first search
 * @param tasks Array of tasks with resolved dependencies (IDs, not names)
 * @returns Array of task IDs forming the cycle (e.g., ['A', 'B', 'C', 'A']), or null if no cycle
 */
declare function detectDependencyCycle(tasks: Task[]): string[] | null;

/**
 * Agent state entities for TaskAgent
 *
 * Defines the full agent state needed for persistence and resume.
 */

/**
 * Agent execution status
 */
type AgentStatus = 'idle' | 'running' | 'suspended' | 'completed' | 'failed' | 'cancelled';
/**
 * Agent configuration (needed for resume)
 */
interface AgentConfig {
    connectorName: string;
    model: string;
    temperature?: number;
    maxIterations?: number;
    toolNames: string[];
}
/**
 * Conversation message in history
 */
interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}
/**
 * Agent execution metrics
 */
interface AgentMetrics {
    totalLLMCalls: number;
    totalToolCalls: number;
    totalTokensUsed: number;
    totalCost: number;
}
/**
 * Full agent state - everything needed to resume
 */
interface AgentState {
    id: string;
    status: AgentStatus;
    /** Configuration */
    config: AgentConfig;
    /** Current plan */
    plan: Plan;
    /** Working memory reference */
    memoryId: string;
    /** Conversation history (for context continuity) */
    conversationHistory: ConversationMessage[];
    /** Timestamps */
    createdAt: number;
    startedAt?: number;
    suspendedAt?: number;
    completedAt?: number;
    lastActivityAt: number;
    /** Metrics */
    metrics: AgentMetrics;
}

/**
 * Plan storage interface for plan persistence.
 * Implement for long-running agent support.
 */

interface IPlanStorage {
    /**
     * Save or update a plan
     */
    savePlan(plan: Plan): Promise<void>;
    /**
     * Get plan by ID
     */
    getPlan(planId: string): Promise<Plan | undefined>;
    /**
     * Update a specific task within a plan
     */
    updateTask(planId: string, task: Task): Promise<void>;
    /**
     * Add a new task to a plan (for dynamic task creation)
     */
    addTask(planId: string, task: Task): Promise<void>;
    /**
     * Delete a plan
     */
    deletePlan(planId: string): Promise<void>;
    /**
     * List plans by status
     */
    listPlans(filter?: {
        status?: PlanStatus[];
    }): Promise<Plan[]>;
    /**
     * Find plans with tasks waiting on a specific webhook
     */
    findByWebhookId(webhookId: string): Promise<{
        plan: Plan;
        task: Task;
    } | undefined>;
}

/**
 * Agent state storage interface for full agent state persistence.
 * Required for resume capability.
 */

interface IAgentStateStorage {
    /**
     * Save agent state
     */
    save(state: AgentState): Promise<void>;
    /**
     * Load agent state
     */
    load(agentId: string): Promise<AgentState | undefined>;
    /**
     * Delete agent state
     */
    delete(agentId: string): Promise<void>;
    /**
     * List agents by status
     */
    list(filter?: {
        status?: AgentStatus[];
    }): Promise<AgentState[]>;
    /**
     * Update specific fields (partial update for efficiency)
     */
    patch(agentId: string, updates: Partial<AgentState>): Promise<void>;
}

/**
 * In-memory storage implementations (default, non-persistent)
 */

/**
 * In-memory implementation of IMemoryStorage
 */
declare class InMemoryStorage implements IMemoryStorage {
    private store;
    get(key: string): Promise<MemoryEntry | undefined>;
    set(key: string, entry: MemoryEntry): Promise<void>;
    delete(key: string): Promise<void>;
    has(key: string): Promise<boolean>;
    getAll(): Promise<MemoryEntry[]>;
    getByScope(scope: MemoryScope): Promise<MemoryEntry[]>;
    clearScope(scope: MemoryScope): Promise<void>;
    clear(): Promise<void>;
    getTotalSize(): Promise<number>;
}
/**
 * In-memory implementation of IPlanStorage
 */
declare class InMemoryPlanStorage implements IPlanStorage {
    private plans;
    savePlan(plan: Plan): Promise<void>;
    getPlan(planId: string): Promise<Plan | undefined>;
    updateTask(planId: string, task: Task): Promise<void>;
    addTask(planId: string, task: Task): Promise<void>;
    deletePlan(planId: string): Promise<void>;
    listPlans(filter?: {
        status?: PlanStatus[];
    }): Promise<Plan[]>;
    findByWebhookId(webhookId: string): Promise<{
        plan: Plan;
        task: Task;
    } | undefined>;
}
/**
 * In-memory implementation of IAgentStateStorage
 */
declare class InMemoryAgentStateStorage implements IAgentStateStorage {
    private agents;
    save(state: AgentState): Promise<void>;
    load(agentId: string): Promise<AgentState | undefined>;
    delete(agentId: string): Promise<void>;
    list(filter?: {
        status?: AgentStatus[];
    }): Promise<AgentState[]>;
    patch(agentId: string, updates: Partial<AgentState>): Promise<void>;
}
/**
 * Unified agent storage interface
 */
interface IAgentStorage {
    memory: IMemoryStorage;
    plan: IPlanStorage;
    agent: IAgentStateStorage;
}
/**
 * Create agent storage with defaults
 */
declare function createAgentStorage(options?: {
    memory?: IMemoryStorage;
    plan?: IPlanStorage;
    agent?: IAgentStateStorage;
}): IAgentStorage;

/**
 * IHistoryManager - Interface for conversation history management
 *
 * Follows the same pattern as IMemoryStorage for pluggable implementations.
 * Users can implement this interface to use Redis, PostgreSQL, file storage, etc.
 */

/**
 * A single message in conversation history
 */
interface HistoryMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}
/**
 * Events emitted by IHistoryManager implementations
 */
interface HistoryManagerEvents {
    'message:added': {
        message: HistoryMessage;
    };
    'message:removed': {
        messageId: string;
    };
    'history:cleared': {
        reason?: string;
    };
    'history:compacted': {
        removedCount: number;
        strategy: string;
    };
    'history:restored': {
        messageCount: number;
    };
}
/**
 * Configuration for history management
 */
interface IHistoryManagerConfig {
    /** Maximum messages to keep (for sliding window) */
    maxMessages?: number;
    /** Maximum tokens to keep (estimated) */
    maxTokens?: number;
    /** Compaction strategy when limits are reached */
    compactionStrategy?: 'truncate' | 'summarize' | 'sliding-window';
    /** Number of recent messages to always preserve */
    preserveRecentCount?: number;
}
/**
 * Serialized history state for persistence
 */
interface SerializedHistoryState {
    version: number;
    messages: HistoryMessage[];
    summaries?: Array<{
        content: string;
        coversCount: number;
        timestamp: number;
    }>;
    metadata?: Record<string, unknown>;
}
/**
 * Interface for history storage backends
 * Implement this to use custom storage (Redis, PostgreSQL, file, etc.)
 */
interface IHistoryStorage {
    /**
     * Store a message
     */
    addMessage(message: HistoryMessage): Promise<void>;
    /**
     * Get all messages
     */
    getMessages(): Promise<HistoryMessage[]>;
    /**
     * Get recent N messages
     */
    getRecentMessages(count: number): Promise<HistoryMessage[]>;
    /**
     * Remove a message by ID
     */
    removeMessage(id: string): Promise<void>;
    /**
     * Remove messages older than timestamp
     */
    removeOlderThan(timestamp: number): Promise<number>;
    /**
     * Clear all messages
     */
    clear(): Promise<void>;
    /**
     * Get message count
     */
    getCount(): Promise<number>;
    /**
     * Get serialized state for session persistence
     */
    getState(): Promise<SerializedHistoryState>;
    /**
     * Restore from serialized state
     */
    restoreState(state: SerializedHistoryState): Promise<void>;
}
/**
 * Interface for history manager
 * Manages conversation history with compaction and persistence support
 */
interface IHistoryManager extends EventEmitter<HistoryManagerEvents> {
    /**
     * Add a message to history
     */
    addMessage(role: 'user' | 'assistant' | 'system', content: string, metadata?: Record<string, unknown>): Promise<HistoryMessage>;
    /**
     * Get all messages (may include summaries as system messages)
     */
    getMessages(): Promise<HistoryMessage[]>;
    /**
     * Get recent messages only
     */
    getRecentMessages(count?: number): Promise<HistoryMessage[]>;
    /**
     * Get formatted history for LLM context
     */
    formatForContext(options?: {
        maxTokens?: number;
        includeMetadata?: boolean;
    }): Promise<string>;
    /**
     * Compact history (apply compaction strategy)
     */
    compact(): Promise<void>;
    /**
     * Clear all history
     */
    clear(): Promise<void>;
    /**
     * Get message count
     */
    getMessageCount(): Promise<number>;
    /**
     * Get state for session persistence
     */
    getState(): Promise<SerializedHistoryState>;
    /**
     * Restore from saved state
     */
    restoreState(state: SerializedHistoryState): Promise<void>;
    /**
     * Get current configuration
     */
    getConfig(): IHistoryManagerConfig;
}
/**
 * Default configuration
 */
declare const DEFAULT_HISTORY_MANAGER_CONFIG: Required<IHistoryManagerConfig>;

/**
 * Context provider for TaskAgent
 *
 * Provides context components for the unified ContextManager.
 * Works with IHistoryManager interface for history management.
 */

interface TaskAgentContextProviderConfig {
    model: string;
    instructions?: string;
    plan: Plan;
    memory: WorkingMemory;
    historyManager: IHistoryManager;
    currentInput?: string;
}
/**
 * Context provider for TaskAgent
 */
declare class TaskAgentContextProvider implements IContextProvider {
    private config;
    constructor(config: TaskAgentContextProviderConfig);
    getComponents(): Promise<IContextComponent[]>;
    applyCompactedComponents(components: IContextComponent[]): Promise<void>;
    getMaxContextSize(): number;
    /**
     * Update configuration (e.g., when task changes)
     */
    updateConfig(updates: Partial<TaskAgentContextProviderConfig>): void;
    /**
     * Build system prompt for TaskAgent
     */
    private buildSystemPrompt;
    /**
     * Serialize plan for context
     */
    private serializePlan;
    /**
     * Extract tool outputs from conversation history
     * Looks for tool results stored in message metadata
     */
    private extractToolOutputs;
}

/**
 * ExternalDependencyHandler - handles external dependencies
 */

interface ExternalDependencyEvents {
    'webhook:received': {
        webhookId: string;
        data: unknown;
    };
    'poll:success': {
        taskId: string;
        data: unknown;
    };
    'poll:timeout': {
        taskId: string;
    };
    'scheduled:triggered': {
        taskId: string;
    };
    'manual:completed': {
        taskId: string;
        data: unknown;
    };
}
/**
 * Handles external task dependencies
 */
declare class ExternalDependencyHandler extends EventEmitter<ExternalDependencyEvents> {
    private activePolls;
    private activeScheduled;
    private cancelledPolls;
    private tools;
    constructor(tools?: ToolFunction[]);
    /**
     * Start handling a task's external dependency
     */
    startWaiting(task: Task): Promise<void>;
    /**
     * Stop waiting on a task's external dependency
     */
    stopWaiting(task: Task): void;
    /**
     * Trigger a webhook
     */
    triggerWebhook(webhookId: string, data: unknown): Promise<void>;
    /**
     * Complete a manual task
     */
    completeManual(taskId: string, data: unknown): Promise<void>;
    /**
     * Start polling for a task with exponential backoff
     */
    private startPolling;
    /**
     * Schedule a task to trigger at a specific time
     */
    private scheduleTask;
    /**
     * Cleanup all active dependencies
     */
    cleanup(): void;
    /**
     * Update available tools
     */
    updateTools(tools: ToolFunction[]): void;
}

/**
 * CheckpointManager - manages agent state checkpointing
 */

interface CheckpointStrategy {
    /** Checkpoint after every N tool calls */
    afterToolCalls?: number;
    /** Checkpoint after every N LLM calls */
    afterLLMCalls?: number;
    /** Checkpoint on time interval */
    intervalMs?: number;
    /** Always checkpoint before external wait */
    beforeExternalWait: boolean;
    /** Checkpoint mode */
    mode: 'sync' | 'async';
}
declare const DEFAULT_CHECKPOINT_STRATEGY: CheckpointStrategy;
/**
 * Manages state checkpointing for persistence and recovery
 */
declare class CheckpointManager {
    private storage;
    private strategy;
    private toolCallsSinceCheckpoint;
    private llmCallsSinceCheckpoint;
    private intervalTimer?;
    private pendingCheckpoints;
    private currentState;
    constructor(storage: IAgentStorage, strategy?: CheckpointStrategy);
    /**
     * Set the current agent state (for interval checkpointing)
     */
    setCurrentState(state: AgentState): void;
    /**
     * Record a tool call (may trigger checkpoint)
     */
    onToolCall(state: AgentState): Promise<void>;
    /**
     * Record an LLM call (may trigger checkpoint)
     */
    onLLMCall(state: AgentState): Promise<void>;
    /**
     * Force a checkpoint
     */
    checkpoint(state: AgentState, reason: string): Promise<void>;
    /**
     * Perform the actual checkpoint
     */
    private doCheckpoint;
    /**
     * Check if interval-based checkpoint is needed
     */
    private checkIntervalCheckpoint;
    /**
     * Wait for all pending checkpoints to complete
     */
    flush(): Promise<void>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}

/**
 * PlanExecutor - executes plans with LLM integration
 *
 * Uses the unified ContextManager with TaskAgentContextProvider
 * and IHistoryManager interface for history management.
 */

interface PlanExecutorConfig {
    maxIterations: number;
    taskTimeout?: number;
    /** Rate limiting configuration for LLM calls */
    rateLimiter?: {
        /** Max requests per minute (default: 60) */
        maxRequestsPerMinute?: number;
        /** What to do when rate limited: 'wait' or 'throw' (default: 'wait') */
        onLimit?: 'wait' | 'throw';
        /** Max wait time in ms (for 'wait' mode, default: 60000) */
        maxWaitMs?: number;
    };
}
interface PlanExecutorEvents {
    'task:start': {
        task: Task;
    };
    'task:complete': {
        task: Task;
        result: any;
    };
    'task:failed': {
        task: Task;
        error: Error;
    };
    'task:skipped': {
        task: Task;
        reason: string;
    };
    'task:timeout': {
        task: Task;
        timeoutMs: number;
    };
    'task:validation_failed': {
        task: Task;
        validation: TaskValidationResult;
    };
    'task:validation_uncertain': {
        task: Task;
        validation: TaskValidationResult;
    };
    'task:waiting_external': {
        task: Task;
    };
    'memory:stale_entries': {
        entries: StaleEntryInfo[];
        taskId: string;
    };
    'llm:call': {
        iteration: number;
    };
    'tool:call': {
        toolName: string;
        args: any;
    };
    'tool:result': {
        toolName: string;
        result: any;
    };
}
interface PlanExecutionResult {
    status: 'completed' | 'failed' | 'suspended';
    completedTasks: number;
    failedTasks: number;
    skippedTasks: number;
    error?: Error;
    metrics: {
        totalLLMCalls: number;
        totalToolCalls: number;
        totalTokensUsed: number;
        totalCost: number;
    };
}
/**
 * Executes a plan using LLM and tools
 */
declare class PlanExecutor extends EventEmitter<PlanExecutorEvents> {
    private agent;
    private memory;
    private contextManager;
    private contextProvider;
    private idempotencyCache;
    private historyManager;
    private externalHandler;
    private checkpointManager;
    private hooks;
    private config;
    private abortController;
    private rateLimiter?;
    private currentMetrics;
    private currentState;
    constructor(agent: Agent, memory: WorkingMemory, contextManager: ContextManager, contextProvider: TaskAgentContextProvider, idempotencyCache: IdempotencyCache, historyManager: IHistoryManager, externalHandler: ExternalDependencyHandler, checkpointManager: CheckpointManager, hooks: TaskAgentHooks | undefined, config: PlanExecutorConfig);
    /**
     * Build a map of task states for memory priority calculation
     */
    private buildTaskStatesMap;
    /**
     * Notify memory about task completion and detect stale entries
     */
    private notifyMemoryOfTaskCompletion;
    /**
     * Execute a plan
     */
    execute(plan: Plan, state: AgentState): Promise<PlanExecutionResult>;
    /**
     * Execute tasks in parallel with configurable failure handling
     *
     * Note on failure modes:
     * - 'fail-fast' (default): Uses Promise.all - stops batch on first rejection (current behavior)
     *   Individual task failures don't reject, they just set task.status = 'failed'
     * - 'continue': Uses Promise.allSettled - all tasks run regardless of failures
     * - 'fail-all': Uses Promise.allSettled, then throws ParallelTasksError if any failed
     *
     * @param plan - The plan being executed
     * @param tasks - Tasks to execute in parallel
     * @returns Result containing succeeded and failed tasks
     */
    private executeParallelTasks;
    /**
     * Check if task condition is met
     * @returns true if condition is met or no condition exists
     */
    private checkCondition;
    /**
     * Get the timeout for a task (per-task override or config default)
     */
    private getTaskTimeout;
    /**
     * Execute a single task with timeout support
     */
    private executeTask;
    /**
     * Execute task core logic with timeout
     */
    private executeTaskWithTimeout;
    /**
     * Core task execution logic (called by executeTaskWithTimeout)
     */
    private executeTaskCore;
    /**
     * Build prompt for a specific task
     */
    private buildTaskPrompt;
    /**
     * Validate task completion using LLM self-reflection or custom hook
     *
     * @param task - The task to validate
     * @param output - The LLM response output
     * @returns TaskValidationResult with completion score and details
     */
    private validateTaskCompletion;
    /**
     * Build prompt for LLM self-reflection validation
     */
    private buildValidationPrompt;
    /**
     * Parse LLM validation response into TaskValidationResult
     */
    private parseValidationResponse;
    /**
     * Check if plan is complete
     */
    private isPlanComplete;
    /**
     * Check if plan is suspended (waiting on external)
     */
    private isPlanSuspended;
    /**
     * Cancel execution
     */
    cancel(): void;
    /**
     * Cleanup resources
     */
    cleanup(): void;
    /**
     * Get idempotency cache
     */
    getIdempotencyCache(): IdempotencyCache;
    /**
     * Get rate limiter metrics (if rate limiting is enabled)
     */
    getRateLimiterMetrics(): {
        totalRequests: number;
        throttledRequests: number;
        totalWaitMs: number;
        avgWaitMs: number;
    } | null;
    /**
     * Reset rate limiter state (for testing or manual control)
     */
    resetRateLimiter(): void;
}

/**
 * TaskAgentContextAccess provides AgentContext-compatible access
 * to TaskAgent's internal managers for unified API access.
 *
 * This allows users to interact with TaskAgent using the same
 * patterns as AgentContext without breaking TaskAgent's internal architecture.
 */
interface TaskAgentContextAccess {
    /** Working memory */
    readonly memory: WorkingMemory;
    /** Tool result cache */
    readonly cache: IdempotencyCache;
    /** History manager */
    readonly history: IHistoryManager;
    /** Context manager for LLM context preparation */
    readonly contextManager: ContextManager;
    /** Permission manager (from BaseAgent) */
    readonly permissions: ToolPermissionManager;
    /** Tool manager (from BaseAgent) */
    readonly tools: ToolManager;
    /** Add a message to history (fire and forget) */
    addMessage(role: 'user' | 'assistant' | 'system', content: string): void;
    /** Get current context budget */
    getBudget(): Promise<ContextBudget>;
    /** Get context metrics */
    getMetrics(): Promise<{
        historyMessageCount: number;
        memoryStats: {
            totalEntries: number;
            totalSizeBytes: number;
        };
        cacheStats: CacheStats;
    }>;
}
/**
 * TaskAgent hooks for customization
 */
interface TaskAgentHooks {
    /** Before agent starts executing */
    onStart?: (agent: TaskAgent, plan: Plan) => Promise<void>;
    /** Before each task starts */
    beforeTask?: (task: Task, context: TaskContext) => Promise<void | 'skip'>;
    /** After each task completes */
    afterTask?: (task: Task, result: TaskResult) => Promise<void>;
    /**
     * Validate task completion with custom logic.
     * Called after task execution to verify the task achieved its goal.
     *
     * Return values:
     * - `TaskValidationResult`: Full validation result with score and details
     * - `true`: Task is complete
     * - `false`: Task failed validation (will use default error message)
     * - `string`: Task failed validation with custom reason
     *
     * If not provided, the default LLM self-reflection validation is used
     * (when task.validation is configured).
     */
    validateTask?: (task: Task, result: TaskResult, memory: WorkingMemory) => Promise<TaskValidationResult | boolean | string>;
    /** Before each LLM call */
    beforeLLMCall?: (messages: any[], options: any) => Promise<any[]>;
    /** After each LLM response */
    afterLLMCall?: (response: any) => Promise<void>;
    /** Before each tool execution */
    beforeTool?: (tool: ToolFunction, args: unknown) => Promise<unknown>;
    /** After tool execution */
    afterTool?: (tool: ToolFunction, args: unknown, result: unknown) => Promise<unknown>;
    /** On any error */
    onError?: (error: Error, context: ErrorContext) => Promise<'retry' | 'fail' | 'skip'>;
    /** On agent completion */
    onComplete?: (result: PlanResult) => Promise<void>;
}
/**
 * Task execution context
 */
interface TaskContext {
    taskId: string;
    taskName: string;
    attempt: number;
}
/**
 * Task result
 */
interface TaskResult {
    success: boolean;
    output?: unknown;
    error?: string;
}
/**
 * Error context
 */
interface ErrorContext {
    task?: Task;
    error: Error;
    phase: 'tool' | 'llm' | 'execution';
}
/**
 * Plan result
 */
interface PlanResult {
    status: 'completed' | 'failed' | 'cancelled';
    output?: unknown;
    error?: string;
    metrics: {
        totalTasks: number;
        completedTasks: number;
        failedTasks: number;
        skippedTasks: number;
    };
}
/**
 * Agent handle returned from start()
 */
interface AgentHandle {
    agentId: string;
    planId: string;
    /** Wait for completion */
    wait(): Promise<PlanResult>;
    /** Get current status */
    status(): AgentStatus;
}
/**
 * Plan updates specification
 */
interface PlanUpdates {
    addTasks?: TaskInput[];
    updateTasks?: Array<{
        id: string;
    } & Partial<Task>>;
    removeTasks?: string[];
}
/**
 * Options for plan update validation
 */
interface PlanUpdateOptions {
    /**
     * Allow removing tasks that are currently in_progress.
     * @default false
     */
    allowRemoveActiveTasks?: boolean;
    /**
     * Validate that no dependency cycles exist after the update.
     * @default true
     */
    validateCycles?: boolean;
}
/**
 * Session configuration for TaskAgent - extends BaseSessionConfig
 */
interface TaskAgentSessionConfig extends BaseSessionConfig {
}
/**
 * TaskAgent configuration - extends BaseAgentConfig
 */
interface TaskAgentConfig extends BaseAgentConfig {
    /** System instructions for the agent */
    instructions?: string;
    /** Temperature for generation */
    temperature?: number;
    /** Maximum iterations for tool calling loop */
    maxIterations?: number;
    /** Storage for persistence (agent state, checkpoints) */
    storage?: IAgentStorage;
    /** Memory configuration */
    memoryConfig?: WorkingMemoryConfig;
    /** Hooks for customization */
    hooks?: TaskAgentHooks;
    /** Session configuration - extends base type */
    session?: TaskAgentSessionConfig;
    /** Permission configuration for tool execution approval */
    permissions?: AgentPermissionsConfig;
}
/**
 * TaskAgent events - extends BaseAgentEvents
 */
interface TaskAgentEvents {
    'task:start': {
        task: Task;
    };
    'task:complete': {
        task: Task;
        result: TaskResult;
    };
    'task:failed': {
        task: Task;
        error: Error;
    };
    'task:validation_failed': {
        task: Task;
        validation: TaskValidationResult;
    };
    'task:waiting': {
        task: Task;
        dependency: any;
    };
    'plan:updated': {
        plan: Plan;
    };
    'agent:suspended': {
        reason: string;
    };
    'agent:resumed': Record<string, never>;
    'agent:completed': {
        result: PlanResult;
    };
    'memory:stored': {
        key: string;
        description: string;
    };
    'memory:limit_warning': {
        utilization: number;
    };
    'session:saved': {
        sessionId: string;
    };
    'session:loaded': {
        sessionId: string;
    };
    destroyed: void;
}
/**
 * TaskAgent - autonomous task-based agent.
 *
 * Extends BaseAgent to inherit connector resolution, tool management,
 * permission management, session management, and lifecycle.
 *
 * Features:
 * - Plan-driven execution
 * - Working memory with indexed access
 * - External dependency handling (webhooks, polling, manual)
 * - Suspend/resume capability
 * - State persistence for long-running agents
 */
declare class TaskAgent extends BaseAgent<TaskAgentConfig, TaskAgentEvents> {
    readonly id: string;
    protected state: AgentState;
    protected agentStorage: IAgentStorage;
    protected memory: WorkingMemory;
    protected hooks?: TaskAgentHooks;
    protected executionPromise?: Promise<PlanResult>;
    protected agent?: Agent;
    protected contextManager?: ContextManager;
    protected contextProvider?: TaskAgentContextProvider;
    protected idempotencyCache?: IdempotencyCache;
    protected historyManager?: IHistoryManager;
    protected externalHandler?: ExternalDependencyHandler;
    protected planExecutor?: PlanExecutor;
    protected checkpointManager?: CheckpointManager;
    protected _allTools: ToolFunction[];
    private eventCleanupFunctions;
    /**
     * Create a new TaskAgent
     */
    static create(config: TaskAgentConfig): TaskAgent;
    /**
     * Resume an existing agent from storage
     */
    static resume(agentId: string, options: {
        storage: IAgentStorage;
        tools?: ToolFunction[];
        hooks?: TaskAgentHooks;
        session?: {
            storage: ISessionStorage;
        };
    }): Promise<TaskAgent>;
    protected constructor(id: string, state: AgentState, agentStorage: IAgentStorage, memory: WorkingMemory, config: TaskAgentConfig, hooks?: TaskAgentHooks);
    protected getAgentType(): 'agent' | 'task-agent' | 'universal-agent';
    protected prepareSessionState(): void;
    protected restoreSessionState(session: Session): Promise<void>;
    protected getSerializedPlan(): SerializedPlan | undefined;
    protected getSerializedMemory(): SerializedMemory | undefined;
    saveSession(): Promise<void>;
    /**
     * Wrap a tool with idempotency cache and enhanced context
     */
    private wrapToolWithCache;
    /**
     * Initialize internal components
     */
    private initializeComponents;
    /**
     * Setup event forwarding from PlanExecutor
     */
    private setupPlanExecutorEvents;
    /**
     * Get unified context access interface.
     *
     * Provides AgentContext-compatible access to TaskAgent's internal managers,
     * allowing users to interact with the same unified API across all agent types.
     *
     * @example
     * ```typescript
     * const taskAgent = TaskAgent.create({ ... });
     *
     * // Access context features (same API as AgentContext)
     * taskAgent.context.addMessage('user', 'Hello');
     * const budget = await taskAgent.context.getBudget();
     * const metrics = await taskAgent.context.getMetrics();
     *
     * // Direct access to managers
     * await taskAgent.context.memory.store('key', 'desc', value);
     * const cached = await taskAgent.context.cache.get(tool, args);
     * ```
     */
    get context(): TaskAgentContextAccess;
    /**
     * Check if context is available (components initialized)
     */
    hasContext(): boolean;
    /**
     * Start executing a plan
     */
    start(planInput: PlanInput): Promise<AgentHandle>;
    /**
     * Pause execution
     */
    pause(): Promise<void>;
    /**
     * Resume execution after pause
     * Note: Named resumeExecution to avoid conflict with BaseAgent if any
     */
    resume(): Promise<void>;
    /**
     * Cancel execution
     */
    cancel(): Promise<void>;
    /**
     * Trigger external dependency completion
     */
    triggerExternal(webhookId: string, data: unknown): Promise<void>;
    /**
     * Manually complete a task
     */
    completeTaskManually(taskId: string, result: unknown): Promise<void>;
    /**
     * Update the plan with validation
     *
     * @param updates - The updates to apply to the plan
     * @param options - Validation options
     * @throws Error if validation fails
     */
    updatePlan(updates: PlanUpdates, options?: PlanUpdateOptions): Promise<void>;
    /**
     * Get current agent state
     */
    getState(): AgentState;
    /**
     * Get current plan
     */
    getPlan(): Plan;
    /**
     * Get working memory
     */
    getMemory(): WorkingMemory;
    /**
     * Execute the plan (internal)
     */
    protected executePlan(): Promise<PlanResult>;
    /**
     * Cleanup resources
     */
    destroy(): Promise<void>;
}

/**
 * Memory tools - built-in tools for memory manipulation
 */

/**
 * Create all memory tools
 */
declare function createMemoryTools(): ToolFunction[];

/**
 * Result of a compaction operation
 */
interface CompactionResult {
    /** Updated components after compaction */
    components: IContextComponent[];
    /** Log of compaction actions taken */
    log: string[];
    /** Total tokens freed */
    tokensFreed: number;
}

/**
 * BaseCompactionStrategy - Abstract base class for compaction strategies
 *
 * Provides shared implementation of the compaction loop via template method pattern.
 * Concrete strategies only need to implement:
 * - shouldCompact() - when to trigger compaction
 * - calculateTargetSize() - how aggressively to compact each component
 * - getTargetUtilization() - what utilization to aim for after compaction
 */

/**
 * Base metrics tracked by all strategies.
 * Includes index signature to satisfy IContextStrategy.getMetrics() return type.
 */
interface BaseStrategyMetrics extends Record<string, unknown> {
    compactionCount: number;
    totalTokensFreed: number;
    avgTokensFreedPerCompaction: number;
}
/**
 * Abstract base class for compaction strategies.
 *
 * Uses template method pattern - subclasses implement abstract methods
 * while base class provides the common compaction loop.
 */
declare abstract class BaseCompactionStrategy implements IContextStrategy {
    abstract readonly name: string;
    protected metrics: BaseStrategyMetrics;
    /**
     * Determine if compaction should be triggered.
     * Each strategy has different thresholds.
     */
    abstract shouldCompact(budget: ContextBudget, config: ContextManagerConfig): boolean;
    /**
     * Calculate target size for a component during compaction.
     *
     * @param beforeSize - Current token count of the component
     * @param round - Current compaction round (1-based)
     * @returns Target token count after compaction
     */
    abstract calculateTargetSize(beforeSize: number, round: number): number;
    /**
     * Get the target utilization ratio after compaction (0-1).
     * Used to calculate how many tokens need to be freed.
     */
    abstract getTargetUtilization(): number;
    /**
     * Get the maximum number of compaction rounds.
     * Override in subclasses for multi-round strategies.
     */
    protected getMaxRounds(): number;
    /**
     * Get the log prefix for compaction messages.
     * Override to customize logging.
     */
    protected getLogPrefix(): string;
    /**
     * Compact components to fit within budget.
     * Uses the shared compaction loop with strategy-specific target calculation.
     */
    compact(components: IContextComponent[], budget: ContextBudget, compactors: IContextCompactor[], estimator: ITokenEstimator): Promise<CompactionResult>;
    /**
     * Update internal metrics after compaction
     */
    protected updateMetrics(tokensFreed: number): void;
    /**
     * Get strategy metrics
     */
    getMetrics(): BaseStrategyMetrics;
    /**
     * Reset metrics (useful for testing)
     */
    resetMetrics(): void;
}

/**
 * Proactive Compaction Strategy
 *
 * - Monitors context budget continuously
 * - Compacts proactively when reaching warning/critical threshold
 * - Uses multi-round compaction with increasing aggressiveness
 * - Follows priority-based compaction order
 *
 * Good for: General purpose, balanced approach
 */

/**
 * Options for ProactiveCompactionStrategy
 */
interface ProactiveStrategyOptions {
    /** Target utilization after compaction (default: 0.65) */
    targetUtilization?: number;
    /** Base reduction factor for round 1 (default: 0.50) */
    baseReductionFactor?: number;
    /** Reduction step per round (default: 0.15) */
    reductionStep?: number;
    /** Maximum compaction rounds (default: 3) */
    maxRounds?: number;
}
declare class ProactiveCompactionStrategy extends BaseCompactionStrategy {
    readonly name = "proactive";
    private options;
    constructor(options?: ProactiveStrategyOptions);
    shouldCompact(budget: ContextBudget, _config: ContextManagerConfig): boolean;
    calculateTargetSize(beforeSize: number, round: number): number;
    getTargetUtilization(): number;
    protected getMaxRounds(): number;
    protected getLogPrefix(): string;
}

/**
 * Aggressive Compaction Strategy
 *
 * - Compacts earlier (60% threshold instead of 75%)
 * - Targets lower usage (50% instead of 65%)
 * - More aggressive per-component reduction (30%)
 * - Single-round compaction
 *
 * Good for: Long-running agents, constrained context windows
 */

/**
 * Options for AggressiveCompactionStrategy
 */
interface AggressiveStrategyOptions {
    /** Threshold to trigger compaction (default: 0.60) */
    threshold?: number;
    /** Target utilization after compaction (default: 0.50) */
    targetUtilization?: number;
    /** Reduction factor - target this fraction of original size (default: 0.30) */
    reductionFactor?: number;
}
declare class AggressiveCompactionStrategy extends BaseCompactionStrategy {
    readonly name = "aggressive";
    private options;
    constructor(options?: AggressiveStrategyOptions);
    shouldCompact(budget: ContextBudget, _config: ContextManagerConfig): boolean;
    calculateTargetSize(beforeSize: number, _round: number): number;
    getTargetUtilization(): number;
    protected getLogPrefix(): string;
}

/**
 * Lazy Compaction Strategy
 *
 * - Only compacts when absolutely necessary (critical status)
 * - Minimal compaction (just enough to fit, targets 85%)
 * - Preserves as much context as possible (70% reduction factor)
 * - Single-round compaction
 *
 * Good for: High-context models, short conversations, when context preservation is critical
 */

/**
 * Options for LazyCompactionStrategy
 */
interface LazyStrategyOptions {
    /** Target utilization after compaction (default: 0.85) */
    targetUtilization?: number;
    /** Reduction factor - target this fraction of original size (default: 0.70) */
    reductionFactor?: number;
}
declare class LazyCompactionStrategy extends BaseCompactionStrategy {
    readonly name = "lazy";
    private options;
    constructor(options?: LazyStrategyOptions);
    shouldCompact(budget: ContextBudget, _config: ContextManagerConfig): boolean;
    calculateTargetSize(beforeSize: number, _round: number): number;
    getTargetUtilization(): number;
    protected getLogPrefix(): string;
}

/**
 * Rolling Window Strategy
 *
 * - Maintains fixed-size window of recent context
 * - No compaction needed - just drops old items
 * - Very fast and predictable
 * - Good for: Real-time agents, streaming conversations
 */

interface RollingWindowOptions {
    /** Maximum number of messages to keep */
    maxMessages?: number;
    /** Maximum tokens per component */
    maxTokensPerComponent?: number;
}
declare class RollingWindowStrategy implements IContextStrategy {
    private options;
    readonly name = "rolling-window";
    constructor(options?: RollingWindowOptions);
    shouldCompact(_budget: ContextBudget, _config: ContextManagerConfig): boolean;
    prepareComponents(components: IContextComponent[]): Promise<IContextComponent[]>;
    compact(): Promise<{
        components: IContextComponent[];
        log: string[];
        tokensFreed: number;
    }>;
}

/**
 * Adaptive Strategy
 *
 * - Learns from usage patterns
 * - Adjusts thresholds based on observed behavior
 * - Switches between strategies dynamically
 * - Good for: Production systems, varied workloads
 */

interface AdaptiveStrategyOptions {
    /** Number of compactions to learn from (default: 10) */
    learningWindow?: number;
    /** Compactions per minute threshold to switch to aggressive (default: 5) */
    switchThreshold?: number;
}
declare class AdaptiveStrategy implements IContextStrategy {
    private options;
    readonly name = "adaptive";
    private currentStrategy;
    private metrics;
    constructor(options?: AdaptiveStrategyOptions);
    shouldCompact(budget: ContextBudget, config: ContextManagerConfig): boolean;
    compact(components: IContextComponent[], budget: ContextBudget, compactors: IContextCompactor[], estimator: ITokenEstimator): Promise<{
        components: IContextComponent[];
        log: string[];
        tokensFreed: number;
    }>;
    private updateMetrics;
    private maybeAdapt;
    getMetrics(): {
        currentStrategy: string;
        avgUtilization: number;
        compactionFrequency: number;
        lastCompactions: number[];
    };
}

/**
 * Context management strategies
 */

/**
 * Strategy factory - creates a strategy by name with options
 *
 * @param name - Strategy name
 * @param options - Strategy-specific options
 * @returns Configured strategy instance
 */
declare function createStrategy(name: string, options?: Record<string, unknown>): IContextStrategy;

/**
 * Truncate Compactor
 *
 * Truncates content to target size by:
 * - For strings: Cut to character limit
 * - For arrays: Keep most recent items
 */

declare class TruncateCompactor implements IContextCompactor {
    private estimator;
    readonly name = "truncate";
    readonly priority = 10;
    constructor(estimator: ITokenEstimator);
    canCompact(component: IContextComponent): boolean;
    compact(component: IContextComponent, targetTokens: number): Promise<IContextComponent>;
    estimateSavings(component: IContextComponent): number;
    private truncateString;
    private truncateArray;
}

/**
 * Summarize Compactor (Placeholder)
 *
 * Uses LLM to create summaries of conversation history
 * TODO: Implement when needed
 */

declare class SummarizeCompactor implements IContextCompactor {
    private estimator;
    readonly name = "summarize";
    readonly priority = 5;
    constructor(estimator: ITokenEstimator);
    canCompact(component: IContextComponent): boolean;
    compact(component: IContextComponent, _targetTokens: number): Promise<IContextComponent>;
    estimateSavings(component: IContextComponent): number;
}

/**
 * Memory Eviction Compactor
 *
 * Evicts LRU entries from memory index
 * Works with memory components that have eviction metadata
 */

declare class MemoryEvictionCompactor implements IContextCompactor {
    private estimator;
    readonly name = "memory-eviction";
    readonly priority = 8;
    constructor(estimator: ITokenEstimator);
    canCompact(component: IContextComponent): boolean;
    compact(component: IContextComponent, targetTokens: number): Promise<IContextComponent>;
    estimateSavings(component: IContextComponent): number;
}

/**
 * Approximate Token Estimator
 *
 * Uses content-type aware heuristics:
 * - Code: ~3 chars/token (more symbols, shorter words)
 * - Prose: ~4 chars/token (natural language)
 * - Mixed: ~3.5 chars/token
 *
 * Fast and good enough for most use cases.
 */

declare class ApproximateTokenEstimator implements ITokenEstimator {
    /**
     * Estimate tokens for text with content-type awareness
     *
     * @param text - The text to estimate tokens for
     * @param contentType - Type of content:
     *   - 'code': Code is typically denser (~3 chars/token)
     *   - 'prose': Natural language text (~4 chars/token)
     *   - 'mixed': Mix of code and prose (~3.5 chars/token)
     */
    estimateTokens(text: string, contentType?: TokenContentType): number;
    /**
     * Estimate tokens for structured data (always uses 'mixed' estimation)
     */
    estimateDataTokens(data: unknown, contentType?: TokenContentType): number;
}

/**
 * Token estimators
 */

/**
 * Create token estimator from name
 */
declare function createEstimator(name: string): ITokenEstimator;

/**
 * IContextBuilder - Interface for building LLM context from multiple sources
 *
 * Allows users to customize how context is assembled from:
 * - Conversation history
 * - Plan state
 * - Working memory
 * - Custom sources
 */
/**
 * A source that can contribute to context
 */
interface ContextSource {
    /** Unique name for this source */
    name: string;
    /** Priority (higher = included first if space is limited) */
    priority: number;
    /** Whether this source is required (error if can't fit) */
    required: boolean;
    /** Get content for this source */
    getContent(): Promise<string>;
    /** Estimate tokens for this source */
    estimateTokens(): Promise<number>;
}
/**
 * Built context ready for LLM
 */
interface BuiltContext {
    /** The full context string */
    content: string;
    /** Estimated token count */
    estimatedTokens: number;
    /** Which sources were included */
    includedSources: string[];
    /** Which sources were excluded (due to space) */
    excludedSources: string[];
    /** Token breakdown by source */
    tokenBreakdown: Record<string, number>;
}
/**
 * Configuration for context building
 */
interface ContextBuilderConfig {
    /** Maximum tokens for context */
    maxTokens?: number;
    /** Reserve space for response */
    responseReserve?: number;
    /** Token estimator function */
    estimateTokens?: (text: string) => number;
    /** Header/separator between sections */
    sectionSeparator?: string;
}
/**
 * Interface for context builder
 * Assembles context from multiple sources with token budget management
 */
interface IContextBuilder {
    /**
     * Register a context source
     */
    registerSource(source: ContextSource): void;
    /**
     * Unregister a context source
     */
    unregisterSource(name: string): void;
    /**
     * Build context from all registered sources
     */
    build(input: string, options?: Partial<ContextBuilderConfig>): Promise<BuiltContext>;
    /**
     * Get registered source names
     */
    getSources(): string[];
    /**
     * Get current configuration
     */
    getConfig(): ContextBuilderConfig;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<ContextBuilderConfig>): void;
}
/**
 * Default configuration
 */
declare const DEFAULT_CONTEXT_BUILDER_CONFIG: Required<ContextBuilderConfig>;

/**
 * DefaultContextBuilder - Default implementation of IContextBuilder
 *
 * Assembles context from multiple sources with token budget management.
 * Users can extend this or implement IContextBuilder for custom behavior.
 */

/**
 * Default context builder implementation
 */
declare class DefaultContextBuilder implements IContextBuilder {
    private sources;
    private config;
    constructor(config?: Partial<ContextBuilderConfig>);
    /**
     * Register a context source
     */
    registerSource(source: ContextSource): void;
    /**
     * Unregister a context source
     */
    unregisterSource(name: string): void;
    /**
     * Build context from all sources
     */
    build(input: string, options?: Partial<ContextBuilderConfig>): Promise<BuiltContext>;
    /**
     * Get registered source names
     */
    getSources(): string[];
    /**
     * Get configuration
     */
    getConfig(): ContextBuilderConfig;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<ContextBuilderConfig>): void;
}

/**
 * ConversationHistoryManager - Default implementation of IHistoryManager
 *
 * Features:
 * - Pluggable storage via IHistoryStorage interface
 * - Event emission for all operations
 * - Configurable compaction strategies
 * - Token-aware context formatting
 */

/**
 * Configuration for ConversationHistoryManager
 */
interface ConversationHistoryManagerConfig extends IHistoryManagerConfig {
    /** Storage backend (defaults to in-memory) */
    storage?: IHistoryStorage;
}
/**
 * Default conversation history manager implementation
 */
declare class ConversationHistoryManager extends EventEmitter<HistoryManagerEvents> implements IHistoryManager {
    private storage;
    private config;
    constructor(config?: ConversationHistoryManagerConfig);
    /**
     * Add a message to history
     */
    addMessage(role: 'user' | 'assistant' | 'system', content: string, metadata?: Record<string, unknown>): Promise<HistoryMessage>;
    /**
     * Get all messages
     */
    getMessages(): Promise<HistoryMessage[]>;
    /**
     * Get recent messages
     */
    getRecentMessages(count?: number): Promise<HistoryMessage[]>;
    /**
     * Format history for LLM context
     */
    formatForContext(options?: {
        maxTokens?: number;
        includeMetadata?: boolean;
    }): Promise<string>;
    /**
     * Compact history based on strategy
     */
    compact(): Promise<void>;
    /**
     * Clear all history
     */
    clear(): Promise<void>;
    /**
     * Get message count
     */
    getMessageCount(): Promise<number>;
    /**
     * Get state for persistence
     */
    getState(): Promise<SerializedHistoryState>;
    /**
     * Restore from saved state
     */
    restoreState(state: SerializedHistoryState): Promise<void>;
    /**
     * Get configuration
     */
    getConfig(): IHistoryManagerConfig;
}

/**
 * InMemoryHistoryStorage - In-memory implementation of IHistoryStorage
 *
 * Default storage backend for conversation history.
 * For production, users can implement IHistoryStorage with Redis, PostgreSQL, etc.
 */

/**
 * In-memory history storage implementation
 */
declare class InMemoryHistoryStorage implements IHistoryStorage {
    private messages;
    private summaries;
    addMessage(message: HistoryMessage): Promise<void>;
    getMessages(): Promise<HistoryMessage[]>;
    getRecentMessages(count: number): Promise<HistoryMessage[]>;
    removeMessage(id: string): Promise<void>;
    removeOlderThan(timestamp: number): Promise<number>;
    clear(): Promise<void>;
    getCount(): Promise<number>;
    getState(): Promise<SerializedHistoryState>;
    restoreState(state: SerializedHistoryState): Promise<void>;
}

/**
 * InMemorySessionStorage - In-memory session storage implementation
 *
 * Stores sessions in memory. Data is lost when process exits.
 * Useful for testing, development, and short-lived applications.
 */

declare class InMemorySessionStorage implements ISessionStorage {
    private sessions;
    save(session: Session): Promise<void>;
    load(sessionId: string): Promise<Session | null>;
    delete(sessionId: string): Promise<void>;
    exists(sessionId: string): Promise<boolean>;
    list(filter?: SessionFilter): Promise<SessionSummary[]>;
    search(query: string, filter?: SessionFilter): Promise<SessionSummary[]>;
    /**
     * Clear all sessions (useful for testing)
     */
    clear(): void;
    /**
     * Get count of sessions
     */
    get size(): number;
    private applyFilter;
    private toSummary;
}

/**
 * FileSessionStorage - File-based session storage implementation
 *
 * Stores sessions as JSON files in a directory.
 * Each session is stored in its own file: {sessionId}.json
 *
 * Features:
 * - Persistent storage across process restarts
 * - Human-readable JSON format
 * - Optional compression for large sessions
 * - Index file for fast listing
 */

interface FileSessionStorageConfig {
    /** Directory to store session files */
    directory: string;
    /** Pretty-print JSON (default: false for production) */
    prettyPrint?: boolean;
    /** File extension (default: .json) */
    extension?: string;
}
declare class FileSessionStorage implements ISessionStorage {
    private directory;
    private prettyPrint;
    private extension;
    private indexPath;
    private index;
    constructor(config: FileSessionStorageConfig);
    save(session: Session): Promise<void>;
    load(sessionId: string): Promise<Session | null>;
    delete(sessionId: string): Promise<void>;
    exists(sessionId: string): Promise<boolean>;
    list(filter?: SessionFilter): Promise<SessionSummary[]>;
    search(query: string, filter?: SessionFilter): Promise<SessionSummary[]>;
    /**
     * Rebuild the index by scanning all session files
     * Useful for recovery or migration
     */
    rebuildIndex(): Promise<void>;
    /**
     * Get the storage directory path
     */
    getDirectory(): string;
    private getFilePath;
    private ensureDirectory;
    private loadIndex;
    private saveIndex;
    private updateIndex;
    private removeFromIndex;
    private sessionToIndexEntry;
    private indexEntryToSummary;
    private applyFilter;
}

/**
 * Complete description of an LLM model including capabilities, pricing, and features
 */
interface ILLMDescription {
    /** Model identifier (e.g., "gpt-5.2-instant") */
    name: string;
    /** Vendor/provider (Vendor.OpenAI, Vendor.Anthropic, etc.) */
    provider: string;
    /** Optional description of the model */
    description?: string;
    /** Whether the model is currently available for use */
    isActive: boolean;
    /** Release date (YYYY-MM-DD format) */
    releaseDate?: string;
    /** Knowledge cutoff date */
    knowledgeCutoff?: string;
    /** Model capabilities and pricing */
    features: {
        /** Supports extended reasoning/thinking */
        reasoning?: boolean;
        /** Supports streaming responses */
        streaming: boolean;
        /** Supports structured output (JSON mode) */
        structuredOutput?: boolean;
        /** Supports function/tool calling */
        functionCalling?: boolean;
        /** Supports fine-tuning */
        fineTuning?: boolean;
        /** Supports predicted outputs */
        predictedOutputs?: boolean;
        /** Supports realtime API */
        realtime?: boolean;
        /** Supports image input (vision) */
        vision?: boolean;
        /** Supports audio input/output */
        audio?: boolean;
        /** Supports video input */
        video?: boolean;
        /** Supports extended thinking (Claude-specific) */
        extendedThinking?: boolean;
        /** Supports batch API */
        batchAPI?: boolean;
        /** Supports prompt caching */
        promptCaching?: boolean;
        /** Parameter support - indicates which sampling parameters are supported */
        parameters?: {
            /** Supports temperature parameter */
            temperature?: boolean;
            /** Supports top_p parameter */
            topP?: boolean;
            /** Supports frequency_penalty parameter */
            frequencyPenalty?: boolean;
            /** Supports presence_penalty parameter */
            presencePenalty?: boolean;
        };
        /** Input specifications */
        input: {
            /** Maximum input context window (in tokens) */
            tokens: number;
            /** Supports text input */
            text: boolean;
            /** Supports image input */
            image?: boolean;
            /** Supports audio input */
            audio?: boolean;
            /** Supports video input */
            video?: boolean;
            /** Cost per million tokens (input) */
            cpm: number;
            /** Cost per million cached tokens (if prompt caching supported) */
            cpmCached?: number;
        };
        /** Output specifications */
        output: {
            /** Maximum output tokens */
            tokens: number;
            /** Supports text output */
            text: boolean;
            /** Supports image output */
            image?: boolean;
            /** Supports audio output */
            audio?: boolean;
            /** Cost per million tokens (output) */
            cpm: number;
        };
    };
}
/**
 * Model name constants organized by vendor
 * Updated: January 2026 - Contains only verified, currently available models
 */
declare const LLM_MODELS: {
    readonly openai: {
        readonly GPT_5_2: "gpt-5.2";
        readonly GPT_5_2_PRO: "gpt-5.2-pro";
        readonly GPT_5: "gpt-5";
        readonly GPT_5_MINI: "gpt-5-mini";
        readonly GPT_5_NANO: "gpt-5-nano";
        readonly GPT_4_1: "gpt-4.1";
        readonly GPT_4_1_MINI: "gpt-4.1-mini";
        readonly GPT_4_1_NANO: "gpt-4.1-nano";
        readonly GPT_4O: "gpt-4o";
        readonly GPT_4O_MINI: "gpt-4o-mini";
        readonly O3_MINI: "o3-mini";
        readonly O1: "o1";
    };
    readonly anthropic: {
        readonly CLAUDE_OPUS_4_5: "claude-opus-4-5-20251101";
        readonly CLAUDE_SONNET_4_5: "claude-sonnet-4-5-20250929";
        readonly CLAUDE_HAIKU_4_5: "claude-haiku-4-5-20251001";
        readonly CLAUDE_OPUS_4_1: "claude-opus-4-1-20250805";
        readonly CLAUDE_SONNET_4: "claude-sonnet-4-20250514";
        readonly CLAUDE_SONNET_3_7: "claude-3-7-sonnet-20250219";
        readonly CLAUDE_HAIKU_3: "claude-3-haiku-20240307";
    };
    readonly google: {
        readonly GEMINI_3_FLASH_PREVIEW: "gemini-3-flash-preview";
        readonly GEMINI_3_PRO_PREVIEW: "gemini-3-pro-preview";
        readonly GEMINI_3_PRO_IMAGE_PREVIEW: "gemini-3-pro-image-preview";
        readonly GEMINI_2_5_PRO: "gemini-2.5-pro";
        readonly GEMINI_2_5_FLASH: "gemini-2.5-flash";
        readonly GEMINI_2_5_FLASH_LITE: "gemini-2.5-flash-lite";
        readonly GEMINI_2_5_FLASH_IMAGE: "gemini-2.5-flash-image";
    };
};
/**
 * Complete model registry with all model metadata
 * Updated: January 2026 - Verified from official vendor documentation
 */
declare const MODEL_REGISTRY: Record<string, ILLMDescription>;
/**
 * Get model information by name
 * @param modelName The model identifier
 * @returns Model description or undefined if not found
 */
declare function getModelInfo(modelName: string): ILLMDescription | undefined;
/**
 * Get all models for a specific vendor
 * @param vendor The vendor to filter by
 * @returns Array of model descriptions for the vendor
 */
declare function getModelsByVendor(vendor: Vendor): ILLMDescription[];
/**
 * Get all currently active models
 * @returns Array of active model descriptions
 */
declare function getActiveModels(): ILLMDescription[];
/**
 * Calculate the cost for a given model and token usage
 * @param model Model name
 * @param inputTokens Number of input tokens
 * @param outputTokens Number of output tokens
 * @param options Optional calculation options
 * @returns Total cost in dollars, or null if model not found
 */
declare function calculateCost(model: string, inputTokens: number, outputTokens: number, options?: {
    useCachedInput?: boolean;
}): number | null;

/**
 * Video Model Registry
 *
 * Comprehensive registry of video generation models with capabilities and pricing.
 * Models are organized by vendor and include detailed capability information.
 */

/**
 * Video model capabilities
 */
interface VideoModelCapabilities {
    /** Supported durations in seconds */
    durations: number[];
    /** Supported resolutions (e.g., '720x1280', '1080x1920') */
    resolutions: string[];
    /** Maximum frames per second */
    maxFps: number;
    /** Whether the model supports audio generation */
    audio: boolean;
    /** Whether the model supports image-to-video */
    imageToVideo: boolean;
    /** Whether the model supports video extension */
    videoExtension: boolean;
    /** Whether the model supports first/last frame specification */
    frameControl: boolean;
    /** Additional features */
    features: {
        /** Supports upscaling output */
        upscaling: boolean;
        /** Supports style/mood control */
        styleControl: boolean;
        /** Supports negative prompts */
        negativePrompt: boolean;
        /** Supports seed for reproducibility */
        seed: boolean;
    };
}
/**
 * Video model pricing
 */
interface VideoModelPricing {
    /** Cost per second of generated video */
    perSecond: number;
    /** Currency */
    currency: string;
}
/**
 * Video model description
 */
interface IVideoModelDescription extends IBaseModelDescription {
    capabilities: VideoModelCapabilities;
    pricing?: VideoModelPricing;
}
/**
 * Video model registry type
 */
type VideoModelRegistry = Record<string, IVideoModelDescription>;
/**
 * Model constants organized by vendor
 */
declare const VIDEO_MODELS: {
    readonly openai: {
        readonly SORA_2: "sora-2";
        readonly SORA_2_PRO: "sora-2-pro";
    };
    readonly google: {
        readonly VEO_2: "veo-2.0-generate-001";
        readonly VEO_3: "veo-3-generate-preview";
        readonly VEO_3_FAST: "veo-3.1-fast-generate-preview";
        readonly VEO_3_1: "veo-3.1-generate-preview";
    };
};
/**
 * Video Model Registry
 */
declare const VIDEO_MODEL_REGISTRY: VideoModelRegistry;
/**
 * Get model information by name
 */
declare const getVideoModelInfo: (modelName: string) => IVideoModelDescription | undefined;
/**
 * Get all models for a specific vendor
 */
declare const getVideoModelsByVendor: (vendor: Vendor) => IVideoModelDescription[];
/**
 * Get all currently active models
 */
declare const getActiveVideoModels: () => IVideoModelDescription[];
/**
 * Get models with a specific feature
 */
declare function getVideoModelsWithFeature(feature: keyof VideoModelCapabilities['features']): IVideoModelDescription[];
/**
 * Get models that support audio
 */
declare function getVideoModelsWithAudio(): IVideoModelDescription[];
/**
 * Calculate video generation cost
 */
declare function calculateVideoCost(modelName: string, durationSeconds: number): number | null;

/**
 * StreamState - Accumulates streaming events to reconstruct complete response
 */

/**
 * Buffer for accumulating tool call arguments
 */
interface ToolCallBuffer {
    toolName: string;
    argumentChunks: string[];
    isComplete: boolean;
    startTime: Date;
}
/**
 * StreamState tracks all accumulated data during streaming
 */
declare class StreamState {
    responseId: string;
    model: string;
    createdAt: number;
    private textBuffers;
    private toolCallBuffers;
    private completedToolCalls;
    private toolResults;
    currentIteration: number;
    usage: TokenUsage;
    status: 'in_progress' | 'completed' | 'incomplete' | 'failed';
    startTime: Date;
    endTime?: Date;
    totalChunks: number;
    totalTextDeltas: number;
    totalToolCalls: number;
    constructor(responseId: string, model: string, createdAt?: number);
    /**
     * Accumulate text delta for a specific item
     */
    accumulateTextDelta(itemId: string, delta: string): void;
    /**
     * Get complete accumulated text for an item
     */
    getCompleteText(itemId: string): string;
    /**
     * Get all accumulated text (all items concatenated)
     */
    getAllText(): string;
    /**
     * Start accumulating tool call arguments
     */
    startToolCall(toolCallId: string, toolName: string): void;
    /**
     * Accumulate tool argument delta
     */
    accumulateToolArguments(toolCallId: string, delta: string): void;
    /**
     * Mark tool call arguments as complete
     */
    completeToolCall(toolCallId: string): void;
    /**
     * Get complete tool arguments (joined chunks)
     */
    getCompleteToolArguments(toolCallId: string): string;
    /**
     * Check if tool call is complete
     */
    isToolCallComplete(toolCallId: string): boolean;
    /**
     * Get tool name for a tool call
     */
    getToolName(toolCallId: string): string | undefined;
    /**
     * Add completed tool call
     */
    addCompletedToolCall(toolCall: ToolCall): void;
    /**
     * Get all completed tool calls
     */
    getCompletedToolCalls(): ToolCall[];
    /**
     * Store tool execution result
     */
    setToolResult(toolCallId: string, result: any): void;
    /**
     * Get tool execution result
     */
    getToolResult(toolCallId: string): any;
    /**
     * Update token usage (replaces values, doesn't accumulate)
     */
    updateUsage(usage: Partial<TokenUsage>): void;
    /**
     * Accumulate token usage (adds to existing values)
     */
    accumulateUsage(usage: Partial<TokenUsage>): void;
    /**
     * Mark stream as complete
     */
    markComplete(status?: 'completed' | 'incomplete' | 'failed'): void;
    /**
     * Get duration in milliseconds
     */
    getDuration(): number;
    /**
     * Increment iteration counter
     */
    incrementIteration(): void;
    /**
     * Get summary statistics
     */
    getStatistics(): {
        responseId: string;
        model: string;
        status: "completed" | "failed" | "in_progress" | "incomplete";
        iterations: number;
        totalChunks: number;
        totalTextDeltas: number;
        totalToolCalls: number;
        textItemsCount: number;
        toolCallBuffersCount: number;
        completedToolCallsCount: number;
        durationMs: number;
        usage: {
            input_tokens: number;
            output_tokens: number;
            total_tokens: number;
            output_tokens_details?: {
                reasoning_tokens: number;
            };
        };
    };
    /**
     * Check if stream has any accumulated text
     */
    hasText(): boolean;
    /**
     * Check if stream has any tool calls
     */
    hasToolCalls(): boolean;
    /**
     * Clear all buffers (for memory management)
     */
    clear(): void;
    /**
     * Create a snapshot for checkpointing (error recovery)
     */
    createSnapshot(): {
        responseId: string;
        model: string;
        createdAt: number;
        textBuffers: Map<string, string[]>;
        toolCallBuffers: Map<string, ToolCallBuffer>;
        completedToolCalls: ToolCall[];
        toolResults: Map<string, any>;
        currentIteration: number;
        usage: {
            input_tokens: number;
            output_tokens: number;
            total_tokens: number;
            output_tokens_details?: {
                reasoning_tokens: number;
            };
        };
        status: "completed" | "failed" | "in_progress" | "incomplete";
        startTime: Date;
        endTime: Date | undefined;
    };
}

/**
 * Stream helper utilities for consuming and processing streaming events
 */

/**
 * Helper class for consuming and processing streams
 */
declare class StreamHelpers {
    /**
     * Collect complete response from stream
     * Accumulates all events and reconstructs final LLMResponse
     */
    static collectResponse(stream: AsyncIterableIterator<StreamEvent>): Promise<LLMResponse>;
    /**
     * Get only text deltas from stream (for simple text streaming)
     * Filters out all other event types
     */
    static textOnly(stream: AsyncIterableIterator<StreamEvent>): AsyncIterableIterator<string>;
    /**
     * Filter stream events by type
     */
    static filterByType<T extends StreamEvent>(stream: AsyncIterableIterator<StreamEvent>, eventType: StreamEventType): AsyncIterableIterator<T>;
    /**
     * Accumulate text from stream into a single string
     */
    static accumulateText(stream: AsyncIterableIterator<StreamEvent>): Promise<string>;
    /**
     * Buffer stream events into batches
     */
    static bufferEvents(stream: AsyncIterableIterator<StreamEvent>, batchSize: number): AsyncIterableIterator<StreamEvent[]>;
    /**
     * Tap into stream without consuming it
     * Useful for logging or side effects
     */
    static tap(stream: AsyncIterableIterator<StreamEvent>, callback: (event: StreamEvent) => void | Promise<void>): AsyncIterableIterator<StreamEvent>;
    /**
     * Take first N events from stream
     */
    static take(stream: AsyncIterableIterator<StreamEvent>, count: number): AsyncIterableIterator<StreamEvent>;
    /**
     * Skip first N events from stream
     */
    static skip(stream: AsyncIterableIterator<StreamEvent>, count: number): AsyncIterableIterator<StreamEvent>;
    /**
     * Update StreamState from event
     * @private
     */
    private static updateStateFromEvent;
    /**
     * Reconstruct LLMResponse from StreamState
     * @private
     */
    private static reconstructLLMResponse;
    /**
     * Extract text from output items
     * @private
     */
    private static extractOutputText;
}

/**
 * Custom error classes for the AI library
 */
declare class AIError extends Error {
    readonly code: string;
    readonly statusCode?: number | undefined;
    readonly originalError?: Error | undefined;
    constructor(message: string, code: string, statusCode?: number | undefined, originalError?: Error | undefined);
}
declare class ProviderNotFoundError extends AIError {
    constructor(providerName: string);
}
declare class ProviderAuthError extends AIError {
    constructor(providerName: string, message?: string);
}
declare class ProviderRateLimitError extends AIError {
    readonly retryAfter?: number | undefined;
    constructor(providerName: string, retryAfter?: number | undefined);
}
declare class ProviderContextLengthError extends AIError {
    readonly maxTokens: number;
    readonly requestedTokens?: number | undefined;
    constructor(providerName: string, maxTokens: number, requestedTokens?: number | undefined);
}
declare class ToolExecutionError extends AIError {
    readonly originalError?: Error | undefined;
    constructor(toolName: string, message: string, originalError?: Error | undefined);
}
declare class ToolTimeoutError extends AIError {
    readonly timeoutMs: number;
    constructor(toolName: string, timeoutMs: number);
}
declare class ToolNotFoundError extends AIError {
    constructor(toolName: string);
}
declare class ModelNotSupportedError extends AIError {
    constructor(providerName: string, model: string, capability: string);
}
declare class InvalidConfigError extends AIError {
    constructor(message: string);
}
declare class InvalidToolArgumentsError extends AIError {
    readonly rawArguments: string;
    readonly parseError?: Error | undefined;
    constructor(toolName: string, rawArguments: string, parseError?: Error | undefined);
}
declare class ProviderError extends AIError {
    readonly providerName: string;
    constructor(providerName: string, message: string, statusCode?: number, originalError?: Error);
}
/**
 * Error thrown when a dependency cycle is detected in a plan
 */
declare class DependencyCycleError extends AIError {
    /** Task IDs forming the cycle (e.g., ['A', 'B', 'C', 'A']) */
    readonly cycle: string[];
    /** Plan ID where the cycle was detected */
    readonly planId?: string | undefined;
    constructor(
    /** Task IDs forming the cycle (e.g., ['A', 'B', 'C', 'A']) */
    cycle: string[], 
    /** Plan ID where the cycle was detected */
    planId?: string | undefined);
}
/**
 * Error thrown when a task execution times out
 */
declare class TaskTimeoutError extends AIError {
    readonly taskId: string;
    readonly taskName: string;
    readonly timeoutMs: number;
    constructor(taskId: string, taskName: string, timeoutMs: number);
}
/**
 * Error thrown when task completion validation fails
 */
declare class TaskValidationError extends AIError {
    readonly taskId: string;
    readonly taskName: string;
    readonly reason: string;
    constructor(taskId: string, taskName: string, reason: string);
}
/**
 * Task failure info for parallel execution
 */
interface TaskFailure {
    taskId: string;
    taskName: string;
    error: Error;
}
/**
 * Error thrown when multiple tasks fail in parallel execution (fail-all mode)
 */
declare class ParallelTasksError extends AIError {
    /** Array of task failures */
    readonly failures: TaskFailure[];
    constructor(
    /** Array of task failures */
    failures: TaskFailure[]);
    /**
     * Get all failure errors
     */
    getErrors(): Error[];
    /**
     * Get failed task IDs
     */
    getFailedTaskIds(): string[];
}

interface BaseProviderConfig {
    apiKey: string;
    baseURL?: string;
    organization?: string;
    timeout?: number;
    maxRetries?: number;
}
interface OpenAIConfig extends BaseProviderConfig {
    organization?: string;
    project?: string;
}
interface AnthropicConfig extends BaseProviderConfig {
    anthropicVersion?: string;
}
interface GoogleConfig extends BaseProviderConfig {
    apiKey: string;
}
interface VertexAIConfig extends BaseProviderConfig {
    projectId: string;
    location: string;
    credentials?: any;
}
interface GroqConfig extends BaseProviderConfig {
    baseURL?: string;
}
interface GrokConfig extends BaseProviderConfig {
    baseURL?: string;
}
interface TogetherAIConfig extends BaseProviderConfig {
    baseURL?: string;
}
interface GenericOpenAIConfig extends BaseProviderConfig {
    baseURL: string;
    providerName?: string;
}
type ProviderConfig = OpenAIConfig | AnthropicConfig | GoogleConfig | VertexAIConfig | GroqConfig | GrokConfig | TogetherAIConfig | GenericOpenAIConfig | BaseProviderConfig;

/**
 * Base provider class with common functionality
 */

declare abstract class BaseProvider implements IProvider {
    protected config: ProviderConfig;
    abstract readonly name: string;
    abstract readonly capabilities: ProviderCapabilities;
    constructor(config: ProviderConfig);
    /**
     * Validate provider configuration
     * Returns validation result with details
     */
    validateConfig(): Promise<boolean>;
    /**
     * Validate API key format and presence
     * Can be overridden by providers with specific key formats
     */
    protected validateApiKey(): {
        isValid: boolean;
        warning?: string;
    };
    /**
     * Override this method in provider implementations for specific key format validation
     */
    protected validateProviderSpecificKeyFormat(_apiKey: string): {
        isValid: boolean;
        warning?: string;
    };
    /**
     * Validate config and throw if invalid
     */
    protected assertValidConfig(): void;
    /**
     * Get API key from config
     */
    protected getApiKey(): string;
    /**
     * Get base URL if configured
     */
    protected getBaseURL(): string | undefined;
    /**
     * Get timeout configuration
     */
    protected getTimeout(): number;
    /**
     * Get max retries configuration
     */
    protected getMaxRetries(): number;
}

declare abstract class BaseTextProvider extends BaseProvider implements ITextProvider {
    protected circuitBreaker?: CircuitBreaker;
    protected logger: FrameworkLogger;
    private _isObservabilityInitialized;
    constructor(config: any);
    /**
     * Auto-initialize observability on first use (lazy initialization)
     * This is called automatically by executeWithCircuitBreaker()
     * @internal
     */
    private ensureObservabilityInitialized;
    /**
     * DEPRECATED: No longer needed, kept for backward compatibility
     * Observability is now auto-initialized on first use
     * @deprecated Initialization happens automatically
     */
    protected initializeObservability(_providerName: string): void;
    abstract generate(options: TextGenerateOptions): Promise<LLMResponse>;
    abstract streamGenerate(options: TextGenerateOptions): AsyncIterableIterator<StreamEvent>;
    abstract getModelCapabilities(model: string): ModelCapabilities;
    /**
     * Execute with circuit breaker protection (helper for subclasses)
     */
    protected executeWithCircuitBreaker<TResult>(operation: () => Promise<TResult>, model?: string): Promise<TResult>;
    /**
     * Get circuit breaker metrics
     */
    getCircuitBreakerMetrics(): CircuitBreakerMetrics | null;
    /**
     * Normalize input to string (helper for providers that don't support complex input)
     */
    protected normalizeInputToString(input: string | any[]): string;
    /**
     * List available models (optional)
     */
    listModels?(): Promise<string[]>;
    /**
     * Clean up provider resources (circuit breaker listeners, etc.)
     * Should be called when the provider is no longer needed.
     */
    destroy(): void;
}

/**
 * Base media provider with common functionality for Image, Audio, and Video providers
 * Provides circuit breaker, logging, and metrics similar to BaseTextProvider
 */

/**
 * Base class for all media providers (Image, Audio, Video)
 * Follows the same patterns as BaseTextProvider for consistency
 */
declare abstract class BaseMediaProvider extends BaseProvider implements IProvider {
    protected circuitBreaker?: CircuitBreaker;
    protected logger: FrameworkLogger;
    private _isObservabilityInitialized;
    constructor(config: any);
    /**
     * Auto-initialize observability on first use (lazy initialization)
     * This is called automatically by executeWithCircuitBreaker()
     * @internal
     */
    private ensureObservabilityInitialized;
    /**
     * Execute operation with circuit breaker protection
     * Automatically records metrics and handles errors
     *
     * @param operation - The async operation to execute
     * @param operationName - Name of the operation for metrics (e.g., 'image.generate', 'audio.synthesize')
     * @param metadata - Additional metadata to log/record
     */
    protected executeWithCircuitBreaker<TResult>(operation: () => Promise<TResult>, operationName: string, metadata?: Record<string, unknown>): Promise<TResult>;
    /**
     * Log operation start with context
     * Useful for logging before async operations
     */
    protected logOperationStart(operation: string, context: Record<string, unknown>): void;
    /**
     * Log operation completion with context
     */
    protected logOperationComplete(operation: string, context: Record<string, unknown>): void;
}

/**
 * Unified error mapper for all providers
 * Converts provider-specific errors to our standard error types
 */

interface ProviderErrorContext {
    providerName: string;
    maxContextTokens?: number;
}
/**
 * Maps provider-specific errors to our unified error types
 */
declare class ProviderErrorMapper {
    /**
     * Map any provider error to our standard error types
     */
    static mapError(error: any, context: ProviderErrorContext): AIError;
    /**
     * Extract retry-after value from error headers or body
     */
    private static extractRetryAfter;
}

/**
 * Services - Single source of truth for external service definitions
 *
 * All service metadata is defined in one place (SERVICE_DEFINITIONS).
 * Other exports are derived from this to maintain DRY principles.
 */
/**
 * Service category type
 */
type ServiceCategory = 'communication' | 'development' | 'productivity' | 'crm' | 'payments' | 'cloud' | 'storage' | 'email' | 'monitoring' | 'search' | 'scrape' | 'other';
/**
 * Complete service definition - single source of truth
 */
interface ServiceDefinition {
    /** Unique identifier (e.g., 'slack', 'github') */
    id: string;
    /** Human-readable name (e.g., 'Slack', 'GitHub') */
    name: string;
    /** Service category */
    category: ServiceCategory;
    /** URL pattern for auto-detection from baseURL */
    urlPattern: RegExp;
    /** Default base URL for API calls */
    baseURL: string;
    /** Documentation URL */
    docsURL?: string;
    /** Common OAuth scopes */
    commonScopes?: string[];
}
/**
 * Master list of all service definitions
 * This is the SINGLE SOURCE OF TRUTH - all other exports derive from this
 */
declare const SERVICE_DEFINITIONS: readonly ServiceDefinition[];
/**
 * Service type - union of all service IDs
 */
type ServiceType = (typeof SERVICE_DEFINITIONS)[number]['id'];
/**
 * Services constant object for easy access
 * Usage: Services.Slack, Services.GitHub, etc.
 */
declare const Services: { [K in string]: ServiceType; };
/**
 * URL patterns for auto-detection (derived from SERVICE_DEFINITIONS)
 */
declare const SERVICE_URL_PATTERNS: ReadonlyArray<{
    service: string;
    pattern: RegExp;
}>;
/**
 * Service info lookup (derived from SERVICE_DEFINITIONS)
 */
interface ServiceInfo {
    id: string;
    name: string;
    category: ServiceCategory;
    baseURL: string;
    docsURL?: string;
    commonScopes?: string[];
}
/**
 * Service info map (derived from SERVICE_DEFINITIONS)
 */
declare const SERVICE_INFO: Record<string, ServiceInfo>;
/**
 * Detect service type from a URL
 * @param url - Base URL or full URL to check
 * @returns Service type string or undefined if not recognized
 */
declare function detectServiceFromURL(url: string): string | undefined;
/**
 * Get service info by service type
 */
declare function getServiceInfo(serviceType: string): ServiceInfo | undefined;
/**
 * Get service definition by service type
 */
declare function getServiceDefinition(serviceType: string): ServiceDefinition | undefined;
/**
 * Get all services in a category
 */
declare function getServicesByCategory(category: ServiceCategory): ServiceDefinition[];
/**
 * Get all service IDs
 */
declare function getAllServiceIds(): string[];
/**
 * Check if a service ID is known
 */
declare function isKnownService(serviceId: string): boolean;

/**
 * ConnectorTools - Generate tools from Connectors
 *
 * This is the main API for vendor-dependent tools.
 * Tools are thin wrappers around Connector.fetch() for specific operations.
 *
 * Enterprise features:
 * - Service detection caching
 * - Tool instance caching
 * - Security: prevents auth header override
 * - Safe JSON serialization
 */

/**
 * Factory function type for creating service-specific tools
 * Takes a Connector and returns an array of tools that use it
 */
type ServiceToolFactory = (connector: Connector, userId?: string) => ToolFunction[];
/**
 * Options for generating the generic API tool
 */
interface GenericAPIToolOptions {
    /** Override the tool name (default: `${connectorName}_api`) */
    toolName?: string;
    /** Override the description */
    description?: string;
    /** User ID for multi-user OAuth */
    userId?: string;
    /** Permission config for the tool */
    permission?: ToolPermissionConfig;
}
/**
 * Arguments for the generic API call tool
 */
interface GenericAPICallArgs {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    endpoint: string;
    body?: Record<string, unknown>;
    queryParams?: Record<string, string | number | boolean>;
    headers?: Record<string, string>;
}
/**
 * Result from the generic API call tool
 */
interface GenericAPICallResult {
    success: boolean;
    status?: number;
    data?: unknown;
    error?: string;
}
/**
 * ConnectorTools - Main API for vendor-dependent tools
 *
 * Usage:
 * ```typescript
 * // Get all tools for a connector
 * const tools = ConnectorTools.for('slack');
 *
 * // Get just the generic API tool
 * const apiTool = ConnectorTools.genericAPI('github');
 *
 * // Discover all available connector tools
 * const allTools = ConnectorTools.discoverAll();
 * ```
 */
declare class ConnectorTools {
    /** Registry of service-specific tool factories */
    private static factories;
    /** Cache for detected service types (connector name -> service type) */
    private static serviceTypeCache;
    /** Cache for generated tools (cacheKey -> tools) */
    private static toolCache;
    /** Maximum cache size to prevent memory issues */
    private static readonly MAX_CACHE_SIZE;
    /**
     * Clear all caches (useful for testing or when connectors change)
     */
    static clearCache(): void;
    /**
     * Invalidate cache for a specific connector
     */
    static invalidateCache(connectorName: string): void;
    /**
     * Register a tool factory for a service type
     *
     * @param serviceType - Service identifier (e.g., 'slack', 'github')
     * @param factory - Function that creates tools from a Connector
     *
     * @example
     * ```typescript
     * ConnectorTools.registerService('slack', (connector) => [
     *   createSlackSendMessageTool(connector),
     *   createSlackListChannelsTool(connector),
     * ]);
     * ```
     */
    static registerService(serviceType: string, factory: ServiceToolFactory): void;
    /**
     * Unregister a service tool factory
     */
    static unregisterService(serviceType: string): boolean;
    /**
     * Get ALL tools for a connector (generic API + service-specific)
     * This is the main entry point
     *
     * @param connectorOrName - Connector instance or name
     * @param userId - Optional user ID for multi-user OAuth
     * @returns Array of tools
     *
     * @example
     * ```typescript
     * const tools = ConnectorTools.for('slack');
     * // Returns: [slack_api, slack_send_message, slack_list_channels, ...]
     * ```
     */
    static for(connectorOrName: Connector | string, userId?: string): ToolFunction[];
    /**
     * Get just the generic API tool for a connector
     *
     * @param connectorOrName - Connector instance or name
     * @param options - Optional configuration
     * @returns Generic API tool
     *
     * @example
     * ```typescript
     * const apiTool = ConnectorTools.genericAPI('github');
     * ```
     */
    static genericAPI(connectorOrName: Connector | string, options?: GenericAPIToolOptions): ToolFunction<GenericAPICallArgs, GenericAPICallResult>;
    /**
     * Get only service-specific tools (no generic API tool)
     *
     * @param connectorOrName - Connector instance or name
     * @param userId - Optional user ID for multi-user OAuth
     * @returns Service-specific tools only
     */
    static serviceTools(connectorOrName: Connector | string, userId?: string): ToolFunction[];
    /**
     * Discover tools for ALL registered connectors with external services
     * Skips AI provider connectors (those with vendor but no serviceType)
     *
     * @param userId - Optional user ID for multi-user OAuth
     * @returns Map of connector name to tools
     *
     * @example
     * ```typescript
     * const allTools = ConnectorTools.discoverAll();
     * for (const [name, tools] of allTools) {
     *   agent.tools.registerMany(tools, { namespace: name });
     * }
     * ```
     */
    static discoverAll(userId?: string): Map<string, ToolFunction[]>;
    /**
     * Find a connector by service type
     * Returns the first connector matching the service type
     *
     * @param serviceType - Service identifier
     * @returns Connector or undefined
     */
    static findConnector(serviceType: string): Connector | undefined;
    /**
     * Find all connectors for a service type
     * Useful when you have multiple connectors for the same service
     *
     * @param serviceType - Service identifier
     * @returns Array of matching connectors
     */
    static findConnectors(serviceType: string): Connector[];
    /**
     * List services that have registered tool factories
     */
    static listSupportedServices(): string[];
    /**
     * Check if a service has dedicated tool factory
     */
    static hasServiceTools(serviceType: string): boolean;
    /**
     * Detect the service type for a connector
     * Uses explicit serviceType if set, otherwise infers from baseURL
     * Results are cached for performance
     */
    static detectService(connector: Connector): string | undefined;
    /**
     * Maintain cache size to prevent memory leaks
     */
    private static maintainCacheSize;
    private static resolveConnector;
    private static createGenericAPITool;
}

/**
 * OAuth plugin type definitions
 */

type OAuthFlow = 'authorization_code' | 'client_credentials' | 'jwt_bearer' | 'static_token';
interface OAuthConfig {
    flow: OAuthFlow;
    tokenUrl: string;
    clientId: string;
    authorizationUrl?: string;
    redirectUri?: string;
    scope?: string;
    usePKCE?: boolean;
    clientSecret?: string;
    privateKey?: string;
    privateKeyPath?: string;
    tokenSigningAlg?: string;
    audience?: string;
    staticToken?: string;
    autoRefresh?: boolean;
    refreshBeforeExpiry?: number;
    storage?: ITokenStorage;
    storageKey?: string;
}
interface StoredToken {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope?: string;
    obtained_at: number;
}

/**
 * OAuth Manager - Main entry point for OAuth 2.0 authentication
 * Supports multiple flows: Authorization Code (with PKCE), Client Credentials, JWT Bearer, Static Token
 */

declare class OAuthManager {
    private flow;
    constructor(config: OAuthConfig);
    /**
     * Get valid access token
     * Automatically refreshes if expired
     *
     * @param userId - User identifier for multi-user support (optional)
     */
    getToken(userId?: string): Promise<string>;
    /**
     * Force refresh the token
     *
     * @param userId - User identifier for multi-user support (optional)
     */
    refreshToken(userId?: string): Promise<string>;
    /**
     * Check if current token is valid
     *
     * @param userId - User identifier for multi-user support (optional)
     */
    isTokenValid(userId?: string): Promise<boolean>;
    /**
     * Start authorization flow (Authorization Code only)
     * Returns URL for user to visit
     *
     * @param userId - User identifier for multi-user support (optional)
     * @returns Authorization URL for the user to visit
     */
    startAuthFlow(userId?: string): Promise<string>;
    /**
     * Handle OAuth callback (Authorization Code only)
     * Call this with the callback URL after user authorizes
     *
     * @param callbackUrl - Full callback URL with code and state parameters
     * @param userId - Optional user identifier (can be extracted from state if embedded)
     */
    handleCallback(callbackUrl: string, userId?: string): Promise<void>;
    /**
     * Revoke token (if supported by provider)
     *
     * @param revocationUrl - Optional revocation endpoint URL
     * @param userId - User identifier for multi-user support (optional)
     */
    revokeToken(revocationUrl?: string, userId?: string): Promise<void>;
    private validateConfig;
}

/**
 * In-memory token storage (default)
 * Tokens are encrypted in memory using AES-256-GCM
 */

declare class MemoryStorage implements ITokenStorage {
    private tokens;
    storeToken(key: string, token: StoredToken$1): Promise<void>;
    getToken(key: string): Promise<StoredToken$1 | null>;
    deleteToken(key: string): Promise<void>;
    hasToken(key: string): Promise<boolean>;
    /**
     * Clear all tokens (useful for testing)
     */
    clearAll(): void;
    /**
     * Get number of stored tokens
     */
    size(): number;
}

/**
 * File-based token storage
 * Tokens are encrypted and stored in individual files with restrictive permissions
 */

interface FileStorageConfig {
    directory: string;
    encryptionKey: string;
}
declare class FileStorage implements ITokenStorage {
    private directory;
    private encryptionKey;
    constructor(config: FileStorageConfig);
    private ensureDirectory;
    /**
     * Get file path for a token key (hashed for security)
     */
    private getFilePath;
    storeToken(key: string, token: StoredToken$1): Promise<void>;
    getToken(key: string): Promise<StoredToken$1 | null>;
    deleteToken(key: string): Promise<void>;
    hasToken(key: string): Promise<boolean>;
    /**
     * List all token keys (for debugging)
     */
    listTokens(): Promise<string[]>;
    /**
     * Clear all tokens
     */
    clearAll(): Promise<void>;
}

/**
 * Authenticated Fetch - Drop-in replacement for fetch() with OAuth authentication
 */
/**
 * Fetch with automatic OAuth authentication
 *
 * Same API as standard fetch(), but with additional authProvider and optional userId parameters.
 * The OAuth token is automatically retrieved and injected into the Authorization header.
 *
 * @param url - URL to fetch (string or URL object)
 * @param options - Standard fetch options
 * @param authProvider - Name of registered OAuth provider (e.g., 'microsoft', 'google')
 * @param userId - Optional user identifier for multi-user support (omit for single-user mode)
 * @returns Promise<Response> - Same as standard fetch
 *
 * @example Single-user mode:
 * ```typescript
 * const response = await authenticatedFetch(
 *   'https://graph.microsoft.com/v1.0/me',
 *   { method: 'GET' },
 *   'microsoft'
 * );
 * const data = await response.json();
 * ```
 *
 * @example Multi-user mode:
 * ```typescript
 * const response = await authenticatedFetch(
 *   'https://api.github.com/user/repos',
 *   { method: 'GET' },
 *   'github',
 *   'user123'  // Get token for specific user
 * );
 * const repos = await response.json();
 * ```
 */
declare function authenticatedFetch(url: string | URL, options: RequestInit | undefined, authProvider: string, userId?: string): Promise<Response>;
/**
 * Create an authenticated fetch function bound to a specific provider and optionally a user
 *
 * Useful for creating reusable fetch functions for a specific API and/or user.
 *
 * @param authProvider - Name of registered OAuth provider
 * @param userId - Optional user identifier to bind to (omit for single-user mode)
 * @returns Fetch function bound to that provider (and user)
 *
 * @example Single-user mode:
 * ```typescript
 * const msftFetch = createAuthenticatedFetch('microsoft');
 *
 * // Use like normal fetch (auth automatic)
 * const me = await msftFetch('https://graph.microsoft.com/v1.0/me');
 * const emails = await msftFetch('https://graph.microsoft.com/v1.0/me/messages');
 * ```
 *
 * @example Multi-user mode (bound to specific user):
 * ```typescript
 * // Create fetch function for Alice
 * const aliceFetch = createAuthenticatedFetch('github', 'user123');
 *
 * // All calls automatically use Alice's token
 * const repos = await aliceFetch('https://api.github.com/user/repos');
 * const issues = await aliceFetch('https://api.github.com/user/issues');
 *
 * // Create fetch function for Bob (separate tokens!)
 * const bobFetch = createAuthenticatedFetch('github', 'user456');
 * const bobRepos = await bobFetch('https://api.github.com/user/repos');
 * ```
 *
 * @example Multi-user mode (userId per-call):
 * ```typescript
 * // Create fetch function NOT bound to a user
 * const githubFetch = createAuthenticatedFetch('github');
 *
 * // Specify userId at call time
 * const aliceRepos = await githubFetch(
 *   'https://api.github.com/user/repos',
 *   { userId: 'user123' }  // Pass as custom option
 * );
 * ```
 */
declare function createAuthenticatedFetch(authProvider: string, userId?: string): (url: string | URL, options?: RequestInit) => Promise<Response>;

/**
 * Tool Generator - Auto-generate tools for registered connectors
 */

interface APIRequestArgs {
    authProvider: string;
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: any;
    headers?: Record<string, string>;
}
interface APIRequestResult {
    success: boolean;
    status: number;
    statusText: string;
    data: any;
    error?: string;
}
/**
 * Generate a universal API request tool for all registered OAuth providers
 *
 * This tool allows the AI agent to make authenticated requests to any registered API.
 * The tool description is dynamically generated based on registered providers.
 *
 * @returns ToolFunction that can call any registered OAuth API
 */
declare function generateWebAPITool(): ToolFunction<APIRequestArgs, APIRequestResult>;

/**
 * Generate a secure random encryption key
 * Use this to generate OAUTH_ENCRYPTION_KEY for your .env file
 */
declare function generateEncryptionKey(): string;

/**
 * ConnectorConfig Storage Interface (Clean Architecture - Domain Layer)
 *
 * Defines the contract for storing and retrieving ConnectorConfig objects.
 * Storage implementations do NOT handle encryption - that's done by ConnectorConfigStore.
 */

/**
 * Wrapper for stored connector configuration with metadata
 */
interface StoredConnectorConfig {
    /** The connector configuration (may contain encrypted fields) */
    config: ConnectorConfig;
    /** Timestamp when the config was first stored */
    createdAt: number;
    /** Timestamp when the config was last updated */
    updatedAt: number;
    /** Schema version for future migrations */
    version: number;
}
/**
 * Storage interface for ConnectorConfig persistence
 *
 * Implementations should:
 * - Store data as-is (encryption is handled by ConnectorConfigStore)
 * - Use appropriate file permissions for file-based storage
 * - Hash names for filenames to prevent enumeration attacks
 */
interface IConnectorConfigStorage {
    /**
     * Save a connector configuration
     *
     * @param name - Unique identifier for this connector
     * @param stored - The stored config with metadata
     */
    save(name: string, stored: StoredConnectorConfig): Promise<void>;
    /**
     * Retrieve a connector configuration by name
     *
     * @param name - Unique identifier for the connector
     * @returns The stored config or null if not found
     */
    get(name: string): Promise<StoredConnectorConfig | null>;
    /**
     * Delete a connector configuration
     *
     * @param name - Unique identifier for the connector
     * @returns True if deleted, false if not found
     */
    delete(name: string): Promise<boolean>;
    /**
     * Check if a connector configuration exists
     *
     * @param name - Unique identifier for the connector
     * @returns True if exists
     */
    has(name: string): Promise<boolean>;
    /**
     * List all connector names
     *
     * @returns Array of connector names
     */
    list(): Promise<string[]>;
    /**
     * Get all stored connector configurations
     *
     * @returns Array of all stored configs
     */
    listAll(): Promise<StoredConnectorConfig[]>;
}
/** Current schema version */
declare const CONNECTOR_CONFIG_VERSION = 1;

/**
 * ConnectorConfigStore - Domain service for storing ConnectorConfig with encryption
 *
 * Handles encryption/decryption of sensitive fields uniformly,
 * regardless of which storage backend is used.
 */

/**
 * ConnectorConfigStore - manages connector configs with automatic encryption
 *
 * Usage:
 * ```typescript
 * const storage = new MemoryConnectorStorage();
 * const store = new ConnectorConfigStore(storage, process.env.ENCRYPTION_KEY!);
 *
 * await store.save('openai', { auth: { type: 'api_key', apiKey: 'sk-xxx' } });
 * const config = await store.get('openai'); // apiKey is decrypted
 * ```
 */
declare class ConnectorConfigStore {
    private storage;
    private encryptionKey;
    constructor(storage: IConnectorConfigStorage, encryptionKey: string);
    /**
     * Save a connector configuration (secrets are encrypted automatically)
     *
     * @param name - Unique identifier for this connector
     * @param config - The connector configuration
     */
    save(name: string, config: ConnectorConfig): Promise<void>;
    /**
     * Retrieve a connector configuration (secrets are decrypted automatically)
     *
     * @param name - Unique identifier for the connector
     * @returns The decrypted config or null if not found
     */
    get(name: string): Promise<ConnectorConfig | null>;
    /**
     * Delete a connector configuration
     *
     * @param name - Unique identifier for the connector
     * @returns True if deleted, false if not found
     */
    delete(name: string): Promise<boolean>;
    /**
     * Check if a connector configuration exists
     *
     * @param name - Unique identifier for the connector
     * @returns True if exists
     */
    has(name: string): Promise<boolean>;
    /**
     * List all connector names
     *
     * @returns Array of connector names
     */
    list(): Promise<string[]>;
    /**
     * Get all connector configurations (secrets are decrypted automatically)
     *
     * @returns Array of decrypted configs
     */
    listAll(): Promise<ConnectorConfig[]>;
    /**
     * Get stored metadata for a connector
     *
     * @param name - Unique identifier for the connector
     * @returns Metadata (createdAt, updatedAt, version) or null
     */
    getMetadata(name: string): Promise<{
        createdAt: number;
        updatedAt: number;
        version: number;
    } | null>;
    /**
     * Encrypt sensitive fields in a ConnectorConfig
     * Fields encrypted: apiKey, clientSecret, privateKey
     */
    private encryptSecrets;
    /**
     * Decrypt sensitive fields in a ConnectorConfig
     */
    private decryptSecrets;
    /**
     * Encrypt secrets in ConnectorAuth based on auth type
     */
    private encryptAuthSecrets;
    /**
     * Decrypt secrets in ConnectorAuth based on auth type
     */
    private decryptAuthSecrets;
    /**
     * Encrypt a single value if not already encrypted
     */
    private encryptValue;
    /**
     * Decrypt a single value if encrypted
     */
    private decryptValue;
    /**
     * Check if a value is encrypted (has the $ENC$: prefix)
     */
    private isEncrypted;
}

/**
 * In-memory storage for ConnectorConfig
 *
 * Simple Map-based storage. No encryption logic here -
 * encryption is handled by ConnectorConfigStore.
 *
 * Useful for:
 * - Testing
 * - Short-lived processes
 * - Development
 *
 * Note: Data is lost when process exits.
 */

declare class MemoryConnectorStorage implements IConnectorConfigStorage {
    private configs;
    save(name: string, stored: StoredConnectorConfig): Promise<void>;
    get(name: string): Promise<StoredConnectorConfig | null>;
    delete(name: string): Promise<boolean>;
    has(name: string): Promise<boolean>;
    list(): Promise<string[]>;
    listAll(): Promise<StoredConnectorConfig[]>;
    /**
     * Clear all stored configs (useful for testing)
     */
    clear(): void;
    /**
     * Get the number of stored configs
     */
    size(): number;
}

/**
 * File-based storage for ConnectorConfig
 *
 * Stores each connector config as a JSON file with restrictive permissions.
 * No encryption logic here - encryption is handled by ConnectorConfigStore.
 *
 * File structure:
 * - {directory}/{hash}.connector.json - individual connector files
 * - {directory}/_index.json - maps hashes to names for list()
 */

interface FileConnectorStorageConfig {
    /** Directory to store connector files */
    directory: string;
}
declare class FileConnectorStorage implements IConnectorConfigStorage {
    private directory;
    private indexPath;
    private initialized;
    constructor(config: FileConnectorStorageConfig);
    save(name: string, stored: StoredConnectorConfig): Promise<void>;
    get(name: string): Promise<StoredConnectorConfig | null>;
    delete(name: string): Promise<boolean>;
    has(name: string): Promise<boolean>;
    list(): Promise<string[]>;
    listAll(): Promise<StoredConnectorConfig[]>;
    /**
     * Clear all stored configs (useful for testing)
     */
    clear(): Promise<void>;
    /**
     * Get file path for a connector (hashed for security)
     */
    private getFilePath;
    /**
     * Hash connector name to prevent enumeration
     */
    private hashName;
    /**
     * Ensure storage directory exists with proper permissions
     */
    private ensureDirectory;
    /**
     * Load the index file
     */
    private loadIndex;
    /**
     * Update the index file
     */
    private updateIndex;
}

/**
 * Backoff strategies for retry logic
 */
/**
 * Backoff strategy type
 */
type BackoffStrategyType = 'exponential' | 'linear' | 'constant';
/**
 * Backoff configuration
 */
interface BackoffConfig {
    /** Strategy type */
    strategy: BackoffStrategyType;
    /** Initial delay in ms */
    initialDelayMs: number;
    /** Maximum delay in ms */
    maxDelayMs: number;
    /** Multiplier for exponential (default: 2) */
    multiplier?: number;
    /** Increment for linear (default: 1000ms) */
    incrementMs?: number;
    /** Add random jitter to prevent thundering herd */
    jitter?: boolean;
    /** Jitter factor (0-1, default: 0.1 = ±10%) */
    jitterFactor?: number;
    /** Classify errors - return true if error should be retried */
    isRetryable?: (error: Error) => boolean;
}
/**
 * Default backoff configuration
 */
declare const DEFAULT_BACKOFF_CONFIG: BackoffConfig;
/**
 * Calculate backoff delay for given attempt
 */
declare function calculateBackoff(attempt: number, config?: BackoffConfig): number;
/**
 * Add random jitter to a delay
 *
 * @param delay - Base delay in ms
 * @param factor - Jitter factor (0-1), default 0.1 = ±10%
 * @returns delay with jitter applied
 */
declare function addJitter(delay: number, factor?: number): number;
/**
 * Wait for backoff delay
 */
declare function backoffWait(attempt: number, config?: BackoffConfig): Promise<number>;
/**
 * Backoff iterator - generates delays for each attempt
 */
declare function backoffSequence(config?: BackoffConfig, maxAttempts?: number): Generator<number, void, unknown>;
/**
 * Retry with backoff
 *
 * @param fn - Function to execute
 * @param config - Backoff configuration
 * @param maxAttempts - Max retry attempts (default: unlimited)
 * @returns Result of fn()
 */
declare function retryWithBackoff<T>(fn: () => Promise<T>, config?: BackoffConfig, maxAttempts?: number): Promise<T>;

/**
 * Token bucket rate limiter for LLM calls
 *
 * Implements a sliding window rate limiter to prevent hitting provider rate limits
 * during intensive plan execution.
 */

/**
 * Error thrown when rate limit is exceeded and onLimit is 'throw'
 */
declare class RateLimitError extends AIError {
    readonly retryAfterMs: number;
    constructor(retryAfterMs: number, message?: string);
}
/**
 * Configuration for the rate limiter
 */
interface RateLimiterConfig {
    /** Max requests allowed in window */
    maxRequests: number;
    /** Time window in ms (default: 60000 = 1 minute) */
    windowMs?: number;
    /** What to do when rate limited */
    onLimit: 'wait' | 'throw';
    /** Max wait time in ms (for 'wait' mode, default: 60000) */
    maxWaitMs?: number;
}
/**
 * Default rate limiter configuration
 */
declare const DEFAULT_RATE_LIMITER_CONFIG: Required<RateLimiterConfig>;
/**
 * Rate limiter metrics
 */
interface RateLimiterMetrics {
    /** Total requests made */
    totalRequests: number;
    /** Total requests throttled */
    throttledRequests: number;
    /** Total wait time in ms */
    totalWaitMs: number;
    /** Average wait time in ms */
    avgWaitMs: number;
}
/**
 * Token bucket rate limiter implementation
 *
 * Uses a sliding window approach where tokens are refilled completely
 * when the time window expires.
 */
declare class TokenBucketRateLimiter {
    private tokens;
    private lastRefill;
    private readonly config;
    private waitQueue;
    private totalRequests;
    private throttledRequests;
    private totalWaitMs;
    constructor(config?: Partial<RateLimiterConfig>);
    /**
     * Acquire a token (request permission to make an LLM call)
     * @returns Promise that resolves when token is acquired
     * @throws RateLimitError if onLimit='throw' and no tokens available
     */
    acquire(): Promise<void>;
    /**
     * Try to acquire without waiting
     * @returns true if acquired, false if rate limited
     */
    tryAcquire(): boolean;
    /**
     * Get current available tokens
     */
    getAvailableTokens(): number;
    /**
     * Get time until next token is available
     */
    getWaitTime(): number;
    /**
     * Get rate limiter metrics
     */
    getMetrics(): RateLimiterMetrics;
    /**
     * Reset the rate limiter state
     */
    reset(): void;
    /**
     * Reset metrics
     */
    resetMetrics(): void;
    /**
     * Get the current configuration
     */
    getConfig(): Required<RateLimiterConfig>;
    /**
     * Refill tokens if window has expired
     */
    private refill;
    /**
     * Wait for a token to become available
     */
    private waitForToken;
    /**
     * Process waiting requests when tokens become available
     */
    private processWaitQueue;
}

/**
 * Metrics collection infrastructure
 *
 * Pluggable metrics system with support for various backends.
 */
/**
 * Metric tags
 */
type MetricTags = Record<string, string | number | boolean>;
/**
 * Metrics collector interface
 */
interface MetricsCollector {
    /**
     * Increment a counter
     */
    increment(metric: string, value?: number, tags?: MetricTags): void;
    /**
     * Set a gauge value
     */
    gauge(metric: string, value: number, tags?: MetricTags): void;
    /**
     * Record a timing/duration
     */
    timing(metric: string, duration: number, tags?: MetricTags): void;
    /**
     * Record a histogram value
     */
    histogram(metric: string, value: number, tags?: MetricTags): void;
}
/**
 * No-op metrics collector (default - zero overhead)
 */
declare class NoOpMetrics implements MetricsCollector {
    increment(): void;
    gauge(): void;
    timing(): void;
    histogram(): void;
}
/**
 * Console metrics collector (development/debugging)
 */
declare class ConsoleMetrics implements MetricsCollector {
    private prefix;
    constructor(prefix?: string);
    increment(metric: string, value?: number, tags?: MetricTags): void;
    gauge(metric: string, value: number, tags?: MetricTags): void;
    timing(metric: string, duration: number, tags?: MetricTags): void;
    histogram(metric: string, value: number, tags?: MetricTags): void;
    private log;
}
/**
 * In-memory metrics aggregator (testing/development)
 */
declare class InMemoryMetrics implements MetricsCollector {
    private counters;
    private gauges;
    private timings;
    private histograms;
    increment(metric: string, value?: number, tags?: MetricTags): void;
    gauge(metric: string, value: number, tags?: MetricTags): void;
    timing(metric: string, duration: number, tags?: MetricTags): void;
    histogram(metric: string, value: number, tags?: MetricTags): void;
    private makeKey;
    /**
     * Get all metrics (for testing)
     */
    getMetrics(): {
        counters: Map<string, number>;
        gauges: Map<string, number>;
        timings: Map<string, number[]>;
        histograms: Map<string, number[]>;
    };
    /**
     * Clear all metrics
     */
    clear(): void;
    /**
     * Get summary statistics for timings
     */
    getTimingStats(metric: string, tags?: MetricTags): {
        count: number;
        min: number;
        max: number;
        mean: number;
        p50: number;
        p95: number;
        p99: number;
    } | null;
}
/**
 * Metrics collector type
 */
type MetricsCollectorType = 'noop' | 'console' | 'inmemory';
/**
 * Create metrics collector from type
 */
declare function createMetricsCollector(type?: MetricsCollectorType, prefix?: string): MetricsCollector;
/**
 * Global metrics singleton
 */
declare const metrics: MetricsCollector;
/**
 * Update global metrics collector
 */
declare function setMetricsCollector(collector: MetricsCollector): void;

/**
 * Message builder utilities for constructing complex inputs
 */

declare class MessageBuilder {
    private messages;
    /**
     * Add a user text message
     */
    addUserMessage(text: string): this;
    /**
     * Add a user message with text and images
     */
    addUserMessageWithImages(text: string, imageUrls: string[]): this;
    /**
     * Add an assistant message (for conversation history)
     */
    addAssistantMessage(text: string): this;
    /**
     * Add a system/developer message
     */
    addDeveloperMessage(text: string): this;
    /**
     * Build and return the messages array
     */
    build(): InputItem[];
    /**
     * Clear all messages
     */
    clear(): this;
    /**
     * Get the current message count
     */
    count(): number;
}
/**
 * Helper function to create a simple text message
 */
declare function createTextMessage(text: string, role?: MessageRole): InputItem;
/**
 * Helper function to create a message with images
 */
declare function createMessageWithImages(text: string, imageUrls: string[], role?: MessageRole): InputItem;

/**
 * Clipboard image utilities
 * Reads images from clipboard (supports Mac, Linux, Windows)
 */
interface ClipboardImageResult {
    success: boolean;
    dataUri?: string;
    error?: string;
    format?: string;
}
/**
 * Read image from clipboard and convert to data URI
 */
declare function readClipboardImage(): Promise<ClipboardImageResult>;
/**
 * Check if clipboard contains an image (quick check)
 */
declare function hasClipboardImage(): Promise<boolean>;

/**
 * JSON Extractor Utilities
 *
 * Extracts JSON from LLM responses that may contain markdown formatting,
 * code blocks, or other text mixed with JSON data.
 */
/**
 * Result of JSON extraction attempt
 */
interface JSONExtractionResult<T = unknown> {
    /** Whether extraction was successful */
    success: boolean;
    /** Extracted and parsed data (if successful) */
    data?: T;
    /** Raw JSON string that was parsed (if found) */
    rawJson?: string;
    /** Error message (if failed) */
    error?: string;
    /** How the JSON was found */
    method?: 'code_block' | 'inline' | 'raw';
}
/**
 * Extract JSON from a string that may contain markdown code blocks or other formatting.
 *
 * Tries multiple extraction strategies in order:
 * 1. JSON inside markdown code blocks (```json ... ``` or ``` ... ```)
 * 2. First complete JSON object/array found in text
 * 3. Raw string as JSON
 *
 * @param text - Text that may contain JSON
 * @returns Extraction result with parsed data or error
 *
 * @example
 * ```typescript
 * const response = `Here's the result:
 * \`\`\`json
 * {"score": 85, "valid": true}
 * \`\`\`
 * That's the answer.`;
 *
 * const result = extractJSON<{score: number, valid: boolean}>(response);
 * if (result.success) {
 *   console.log(result.data.score); // 85
 * }
 * ```
 */
declare function extractJSON<T = unknown>(text: string): JSONExtractionResult<T>;
/**
 * Safely extract a specific field from JSON embedded in text
 *
 * @param text - Text that may contain JSON
 * @param field - Field name to extract
 * @param defaultValue - Default value if extraction fails
 * @returns Extracted value or default
 *
 * @example
 * ```typescript
 * const score = extractJSONField<number>(llmResponse, 'completionScore', 50);
 * ```
 */
declare function extractJSONField<T>(text: string, field: string, defaultValue: T): T;
/**
 * Extract a number from text, trying JSON first, then regex patterns
 *
 * @param text - Text that may contain a number
 * @param patterns - Optional regex patterns to try (default: common score patterns)
 * @param defaultValue - Default value if extraction fails
 * @returns Extracted number or default
 *
 * @example
 * ```typescript
 * const score = extractNumber(llmResponse, [/(\d{1,3})%?\s*complete/i], 50);
 * ```
 */
declare function extractNumber(text: string, patterns?: RegExp[], defaultValue?: number): number;

/**
 * Shell Tools - Shared Types
 *
 * Common types and configuration for shell command execution.
 */
/**
 * Configuration for shell tools
 */
interface ShellToolConfig {
    /**
     * Working directory for command execution.
     * Defaults to process.cwd()
     */
    workingDirectory?: string;
    /**
     * Default timeout for commands in milliseconds.
     * Default: 120000 (2 minutes)
     */
    defaultTimeout?: number;
    /**
     * Maximum timeout allowed in milliseconds.
     * Default: 600000 (10 minutes)
     */
    maxTimeout?: number;
    /**
     * Shell to use for command execution.
     * Default: '/bin/bash' on Unix, 'cmd.exe' on Windows
     */
    shell?: string;
    /**
     * Environment variables to add to command execution.
     */
    env?: Record<string, string>;
    /**
     * Commands that are blocked from execution.
     * Default: dangerous commands like rm -rf /
     */
    blockedCommands?: string[];
    /**
     * Patterns that if matched will block the command.
     * Default: patterns that could cause data loss
     */
    blockedPatterns?: RegExp[];
    /**
     * Maximum output size in characters before truncation.
     * Default: 100000 (100KB)
     */
    maxOutputSize?: number;
    /**
     * Whether to allow running commands in background.
     * Default: true
     */
    allowBackground?: boolean;
}
/**
 * Default configuration
 */
declare const DEFAULT_SHELL_CONFIG: Required<ShellToolConfig>;
/**
 * Result of a bash command execution
 */
interface BashResult {
    success: boolean;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    signal?: string;
    duration?: number;
    truncated?: boolean;
    error?: string;
    backgroundId?: string;
}
/**
 * Check if a command should be blocked
 */
declare function isBlockedCommand(command: string, config?: ShellToolConfig): {
    blocked: boolean;
    reason?: string;
};

/**
 * Bash Tool
 *
 * Executes shell commands with timeout and output handling.
 * Provides safe command execution with configurable restrictions.
 *
 * Features:
 * - Configurable timeouts
 * - Output truncation for large outputs
 * - Background execution support
 * - Blocked command patterns for safety
 * - Working directory persistence
 */

/**
 * Arguments for the bash tool
 */
interface BashArgs {
    /** The command to execute */
    command: string;
    /** Optional timeout in milliseconds (up to 600000ms / 10 minutes) */
    timeout?: number;
    /** Description of what this command does (for clarity) */
    description?: string;
    /** Run the command in the background */
    run_in_background?: boolean;
}
/**
 * Create a Bash tool with the given configuration
 */
declare function createBashTool(config?: ShellToolConfig): ToolFunction<BashArgs, BashResult>;
/**
 * Get output from a background process
 */
declare function getBackgroundOutput(bgId: string): {
    found: boolean;
    output?: string;
    running?: boolean;
};
/**
 * Kill a background process
 */
declare function killBackgroundProcess(bgId: string): boolean;
/**
 * Default Bash tool instance
 */
declare const bash: ToolFunction<BashArgs, BashResult>;

/**
 * Filesystem Tools - Shared Types
 *
 * Common types and configuration for filesystem operations.
 */
/**
 * Configuration for filesystem tools
 */
interface FilesystemToolConfig {
    /**
     * Base working directory for all operations.
     * All paths will be resolved relative to this directory.
     * Defaults to process.cwd()
     */
    workingDirectory?: string;
    /**
     * Allowed directories for file operations.
     * If specified, operations outside these directories will be blocked.
     * Paths can be absolute or relative to workingDirectory.
     */
    allowedDirectories?: string[];
    /**
     * Blocked directories (e.g., node_modules, .git).
     * Operations in these directories will be blocked.
     */
    blockedDirectories?: string[];
    /**
     * Maximum file size to read (in bytes).
     * Default: 10MB
     */
    maxFileSize?: number;
    /**
     * Maximum number of results for glob/grep operations.
     * Default: 1000
     */
    maxResults?: number;
    /**
     * Whether to follow symlinks.
     * Default: false
     */
    followSymlinks?: boolean;
    /**
     * File extensions to exclude from search.
     * Default: common binary extensions
     */
    excludeExtensions?: string[];
}
/**
 * Default configuration
 */
declare const DEFAULT_FILESYSTEM_CONFIG: Required<FilesystemToolConfig>;
/**
 * Result of a file read operation
 */
interface ReadFileResult {
    success: boolean;
    content?: string;
    lines?: number;
    truncated?: boolean;
    encoding?: string;
    size?: number;
    error?: string;
    path?: string;
}
/**
 * Result of a file write operation
 */
interface WriteFileResult {
    success: boolean;
    path?: string;
    bytesWritten?: number;
    created?: boolean;
    error?: string;
}
/**
 * Result of a file edit operation
 */
interface EditFileResult {
    success: boolean;
    path?: string;
    replacements?: number;
    error?: string;
    diff?: string;
}
/**
 * Result of a glob operation
 */
interface GlobResult {
    success: boolean;
    files?: string[];
    count?: number;
    truncated?: boolean;
    error?: string;
}
/**
 * A single grep match
 */
interface GrepMatch {
    file: string;
    line: number;
    column?: number;
    content: string;
    context?: {
        before: string[];
        after: string[];
    };
}
/**
 * Result of a grep operation
 */
interface GrepResult {
    success: boolean;
    matches?: GrepMatch[];
    filesSearched?: number;
    filesMatched?: number;
    totalMatches?: number;
    truncated?: boolean;
    error?: string;
}
/**
 * Validate and resolve a path within allowed boundaries
 */
declare function validatePath(inputPath: string, config?: FilesystemToolConfig): {
    valid: boolean;
    resolvedPath: string;
    error?: string;
};
/**
 * Expand tilde (~) to the user's home directory
 */
declare function expandTilde(inputPath: string): string;
/**
 * Check if a file extension should be excluded
 */
declare function isExcludedExtension(filePath: string, excludeExtensions?: string[]): boolean;

/**
 * List Directory Tool
 *
 * Lists contents of a directory on the local filesystem.
 * Shows files and directories with metadata.
 *
 * Features:
 * - Lists files and directories
 * - Shows file sizes and modification times
 * - Supports recursive listing
 * - Filters by type (files only, directories only)
 */

/**
 * Arguments for the list directory tool
 */
interface ListDirectoryArgs {
    /** Path to the directory to list */
    path: string;
    /** Whether to list recursively */
    recursive?: boolean;
    /** Filter: "files" for files only, "directories" for directories only */
    filter?: 'files' | 'directories';
    /** Maximum depth for recursive listing (default: 3) */
    max_depth?: number;
}
/**
 * A single directory entry
 */
interface DirectoryEntry {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    modified?: string;
}
/**
 * Result of a list directory operation
 */
interface ListDirectoryResult {
    success: boolean;
    entries?: DirectoryEntry[];
    count?: number;
    truncated?: boolean;
    error?: string;
}
/**
 * Create a List Directory tool with the given configuration
 */
declare function createListDirectoryTool(config?: FilesystemToolConfig): ToolFunction<ListDirectoryArgs, ListDirectoryResult>;
/**
 * Default List Directory tool instance
 */
declare const listDirectory: ToolFunction<ListDirectoryArgs, ListDirectoryResult>;

/**
 * Grep Tool
 *
 * Powerful search tool for finding content within files.
 * Supports regex patterns, file filtering, and context lines.
 *
 * Features:
 * - Full regex syntax support
 * - File type filtering
 * - Context lines (before/after match)
 * - Multiple output modes
 * - Case-insensitive search option
 */

/**
 * Arguments for the grep tool
 */
interface GrepArgs {
    /** The regex pattern to search for in file contents */
    pattern: string;
    /** File or directory to search in. Defaults to current working directory. */
    path?: string;
    /** Glob pattern to filter files (e.g., "*.ts", "*.{ts,tsx}") */
    glob?: string;
    /** File type to search (e.g., "ts", "js", "py"). More efficient than glob for standard types. */
    type?: string;
    /** Output mode: "content" shows lines, "files_with_matches" shows only file paths, "count" shows match counts */
    output_mode?: 'content' | 'files_with_matches' | 'count';
    /** Case insensitive search */
    case_insensitive?: boolean;
    /** Number of context lines before match */
    context_before?: number;
    /** Number of context lines after match */
    context_after?: number;
    /** Limit output to first N results */
    limit?: number;
}
/**
 * Create a Grep tool with the given configuration
 */
declare function createGrepTool(config?: FilesystemToolConfig): ToolFunction<GrepArgs, GrepResult>;
/**
 * Default Grep tool instance
 */
declare const grep: ToolFunction<GrepArgs, GrepResult>;

/**
 * Glob Tool
 *
 * Fast file pattern matching for finding files by name patterns.
 * Supports standard glob patterns like **\/*.ts, src/**\/*.tsx, etc.
 *
 * Features:
 * - Standard glob pattern syntax
 * - Recursive directory traversal
 * - Results sorted by modification time
 * - Configurable result limits
 * - Excludes common non-code directories by default
 */

/**
 * Arguments for the glob tool
 */
interface GlobArgs {
    /** The glob pattern to match files against (e.g., "**\/*.ts", "src/**\/*.tsx") */
    pattern: string;
    /** The directory to search in. Defaults to current working directory. */
    path?: string;
}
/**
 * Create a Glob tool with the given configuration
 */
declare function createGlobTool(config?: FilesystemToolConfig): ToolFunction<GlobArgs, GlobResult>;
/**
 * Default Glob tool instance
 */
declare const glob: ToolFunction<GlobArgs, GlobResult>;

/**
 * Edit File Tool
 *
 * Performs surgical edits to files using exact string replacement.
 * This is the preferred way to modify existing files.
 *
 * Features:
 * - Exact string matching for precise edits
 * - Preserves file formatting and indentation
 * - Supports replace_all for bulk changes
 * - Validates uniqueness of old_string
 * - Safe: only modifies what's specified
 */

/**
 * Arguments for the edit file tool
 */
interface EditFileArgs {
    /** Absolute path to the file to edit */
    file_path: string;
    /** The exact text to find and replace */
    old_string: string;
    /** The text to replace it with (must be different from old_string) */
    new_string: string;
    /** Replace all occurrences (default: false, which requires old_string to be unique) */
    replace_all?: boolean;
}
/**
 * Create an Edit File tool with the given configuration
 */
declare function createEditFileTool(config?: FilesystemToolConfig): ToolFunction<EditFileArgs, EditFileResult>;
/**
 * Default Edit File tool instance
 */
declare const editFile: ToolFunction<EditFileArgs, EditFileResult>;

/**
 * Write File Tool
 *
 * Writes content to files on the local filesystem.
 * Can create new files or overwrite existing ones.
 *
 * Features:
 * - Create new files with content
 * - Overwrite existing files (with safety checks)
 * - Automatic directory creation
 * - Path validation for security
 */

/**
 * Arguments for the write file tool
 */
interface WriteFileArgs {
    /** Absolute path to the file to write */
    file_path: string;
    /** Content to write to the file */
    content: string;
}
/**
 * Create a Write File tool with the given configuration
 */
declare function createWriteFileTool(config?: FilesystemToolConfig): ToolFunction<WriteFileArgs, WriteFileResult>;
/**
 * Default Write File tool instance
 */
declare const writeFile: ToolFunction<WriteFileArgs, WriteFileResult>;

/**
 * Read File Tool
 *
 * Reads content from files on the local filesystem.
 * Supports text files with optional line range selection.
 *
 * Features:
 * - Read entire files or specific line ranges
 * - Automatic encoding detection
 * - Line number prefixing for easy reference
 * - Size limits to prevent memory issues
 * - Path validation for security
 */

/**
 * Arguments for the read file tool
 */
interface ReadFileArgs {
    /** Absolute path to the file to read */
    file_path: string;
    /** Line number to start reading from (1-indexed). Only provide if the file is too large. */
    offset?: number;
    /** Number of lines to read. Only provide if the file is too large. */
    limit?: number;
}
/**
 * Create a Read File tool with the given configuration
 */
declare function createReadFileTool(config?: FilesystemToolConfig): ToolFunction<ReadFileArgs, ReadFileResult>;
/**
 * Default Read File tool instance
 */
declare const readFile: ToolFunction<ReadFileArgs, ReadFileResult>;

/**
 * JSON Manipulation Tool
 *
 * Allows AI agents to manipulate JSON objects using dot notation paths.
 * Supports delete, add, and replace operations at any depth.
 */

interface JsonManipulateArgs {
    operation: 'delete' | 'add' | 'replace';
    path: string;
    value?: any;
    object: any;
}
interface JsonManipulateResult {
    success: boolean;
    result: any | null;
    message?: string;
    error?: string;
}
declare const jsonManipulator: ToolFunction<JsonManipulateArgs, JsonManipulateResult>;

/**
 * Web Fetch Tool - Simple HTTP fetch with content quality detection
 */

interface WebFetchArgs {
    url: string;
    userAgent?: string;
    timeout?: number;
}
interface WebFetchResult {
    success: boolean;
    url: string;
    title: string;
    content: string;
    html: string;
    contentType: 'html' | 'json' | 'text' | 'error';
    qualityScore: number;
    requiresJS: boolean;
    suggestedAction?: string;
    issues?: string[];
    error?: string;
}
declare const webFetch: ToolFunction<WebFetchArgs, WebFetchResult>;

/**
 * Web Fetch with JavaScript - Uses Puppeteer for JS-rendered sites
 * Optional tool - requires puppeteer to be installed
 */

interface WebFetchJSArgs {
    url: string;
    waitForSelector?: string;
    timeout?: number;
    takeScreenshot?: boolean;
}
interface WebFetchJSResult {
    success: boolean;
    url: string;
    title: string;
    content: string;
    html: string;
    screenshot?: string;
    loadTime: number;
    error?: string;
    suggestion?: string;
}
declare const webFetchJS: ToolFunction<WebFetchJSArgs, WebFetchJSResult>;

/**
 * Web Search Tool - Multi-provider web search with Connector support
 * Supports Serper.dev, Brave, Tavily, and RapidAPI
 *
 * NEW: Uses Connector-First architecture for authentication
 * Backward compatible with environment variable approach
 */

interface WebSearchArgs {
    query: string;
    numResults?: number;
    /**
     * @deprecated Use connectorName instead
     * Provider name for backward compatibility (uses environment variables)
     */
    provider?: 'serper' | 'brave' | 'tavily' | 'rapidapi';
    /**
     * Connector name to use for search
     * Example: 'serper-main', 'brave-backup', 'rapidapi-search'
     */
    connectorName?: string;
    /** Country/region code (e.g., 'us', 'gb') */
    country?: string;
    /** Language code (e.g., 'en', 'fr') */
    language?: string;
}
interface WebSearchResult {
    success: boolean;
    query: string;
    provider: string;
    results: SearchResult[];
    count: number;
    error?: string;
}
declare const webSearch: ToolFunction<WebSearchArgs, WebSearchResult>;

/**
 * JavaScript Execution Tool
 * Executes JavaScript in a sandboxed VM with connector integration
 * Connectors provide authenticated access to external APIs (GitHub, Microsoft, etc.)
 */

interface ExecuteJSArgs {
    code: string;
    input?: any;
    timeout?: number;
}
interface ExecuteJSResult {
    success: boolean;
    result: any;
    logs: string[];
    error?: string;
    executionTime: number;
}
/**
 * Create an execute_javascript tool with the current connector state
 * Use this factory when you need the tool to reflect currently registered connectors
 */
declare function createExecuteJavaScriptTool(): ToolFunction<ExecuteJSArgs, ExecuteJSResult>;
/**
 * Default executeJavaScript tool
 * NOTE: The description is generated at module load time. If you register
 * connectors after importing this, use createExecuteJavaScriptTool() instead.
 */
declare const executeJavaScript: ToolFunction<ExecuteJSArgs, ExecuteJSResult>;

/**
 * A bundle of all developer tools commonly used for coding tasks.
 * Includes: readFile, writeFile, editFile, glob, grep, listDirectory, bash
 *
 * @example
 * ```typescript
 * import { tools } from '@oneringai/agents';
 *
 * const agent = Agent.create({
 *   connector: 'openai',
 *   model: 'gpt-4',
 *   tools: tools.developerTools,
 * });
 * ```
 */
declare const developerTools: (ToolFunction<ReadFileArgs, ReadFileResult> | ToolFunction<WriteFileArgs, WriteFileResult> | ToolFunction<EditFileArgs, EditFileResult> | ToolFunction<GlobArgs, GlobResult> | ToolFunction<GrepArgs, GrepResult> | ToolFunction<ListDirectoryArgs, ListDirectoryResult> | ToolFunction<BashArgs, BashResult>)[];

type index_BashResult = BashResult;
type index_ConnectorTools = ConnectorTools;
declare const index_ConnectorTools: typeof ConnectorTools;
declare const index_DEFAULT_FILESYSTEM_CONFIG: typeof DEFAULT_FILESYSTEM_CONFIG;
declare const index_DEFAULT_SHELL_CONFIG: typeof DEFAULT_SHELL_CONFIG;
type index_EditFileResult = EditFileResult;
type index_FilesystemToolConfig = FilesystemToolConfig;
type index_GenericAPICallArgs = GenericAPICallArgs;
type index_GenericAPICallResult = GenericAPICallResult;
type index_GenericAPIToolOptions = GenericAPIToolOptions;
type index_GlobResult = GlobResult;
type index_GrepMatch = GrepMatch;
type index_GrepResult = GrepResult;
type index_ReadFileResult = ReadFileResult;
type index_ServiceToolFactory = ServiceToolFactory;
type index_ShellToolConfig = ShellToolConfig;
type index_WriteFileResult = WriteFileResult;
declare const index_bash: typeof bash;
declare const index_createBashTool: typeof createBashTool;
declare const index_createEditFileTool: typeof createEditFileTool;
declare const index_createExecuteJavaScriptTool: typeof createExecuteJavaScriptTool;
declare const index_createGlobTool: typeof createGlobTool;
declare const index_createGrepTool: typeof createGrepTool;
declare const index_createListDirectoryTool: typeof createListDirectoryTool;
declare const index_createReadFileTool: typeof createReadFileTool;
declare const index_createWriteFileTool: typeof createWriteFileTool;
declare const index_developerTools: typeof developerTools;
declare const index_editFile: typeof editFile;
declare const index_executeJavaScript: typeof executeJavaScript;
declare const index_expandTilde: typeof expandTilde;
declare const index_getBackgroundOutput: typeof getBackgroundOutput;
declare const index_glob: typeof glob;
declare const index_grep: typeof grep;
declare const index_isBlockedCommand: typeof isBlockedCommand;
declare const index_isExcludedExtension: typeof isExcludedExtension;
declare const index_jsonManipulator: typeof jsonManipulator;
declare const index_killBackgroundProcess: typeof killBackgroundProcess;
declare const index_listDirectory: typeof listDirectory;
declare const index_readFile: typeof readFile;
declare const index_validatePath: typeof validatePath;
declare const index_webFetch: typeof webFetch;
declare const index_webFetchJS: typeof webFetchJS;
declare const index_webSearch: typeof webSearch;
declare const index_writeFile: typeof writeFile;
declare namespace index {
  export { type index_BashResult as BashResult, index_ConnectorTools as ConnectorTools, index_DEFAULT_FILESYSTEM_CONFIG as DEFAULT_FILESYSTEM_CONFIG, index_DEFAULT_SHELL_CONFIG as DEFAULT_SHELL_CONFIG, type index_EditFileResult as EditFileResult, type index_FilesystemToolConfig as FilesystemToolConfig, type index_GenericAPICallArgs as GenericAPICallArgs, type index_GenericAPICallResult as GenericAPICallResult, type index_GenericAPIToolOptions as GenericAPIToolOptions, type index_GlobResult as GlobResult, type index_GrepMatch as GrepMatch, type index_GrepResult as GrepResult, type index_ReadFileResult as ReadFileResult, type index_ServiceToolFactory as ServiceToolFactory, type index_ShellToolConfig as ShellToolConfig, type index_WriteFileResult as WriteFileResult, index_bash as bash, index_createBashTool as createBashTool, index_createEditFileTool as createEditFileTool, index_createExecuteJavaScriptTool as createExecuteJavaScriptTool, index_createGlobTool as createGlobTool, index_createGrepTool as createGrepTool, index_createListDirectoryTool as createListDirectoryTool, index_createReadFileTool as createReadFileTool, index_createWriteFileTool as createWriteFileTool, index_developerTools as developerTools, index_editFile as editFile, index_executeJavaScript as executeJavaScript, index_expandTilde as expandTilde, index_getBackgroundOutput as getBackgroundOutput, index_glob as glob, index_grep as grep, index_isBlockedCommand as isBlockedCommand, index_isExcludedExtension as isExcludedExtension, index_jsonManipulator as jsonManipulator, index_killBackgroundProcess as killBackgroundProcess, index_listDirectory as listDirectory, index_readFile as readFile, index_validatePath as validatePath, index_webFetch as webFetch, index_webFetchJS as webFetchJS, index_webSearch as webSearch, index_writeFile as writeFile };
}

/**
 * Provider Config Agent
 *
 * AI-powered agent that helps users configure OAuth providers
 * Asks questions, guides setup, and generates JSON configuration
 */

/**
 * Built-in agent for generating OAuth provider configurations
 */
declare class ProviderConfigAgent {
    private agent;
    private conversationHistory;
    private connectorName;
    /**
     * Create a provider config agent
     * @param connectorName - Name of the connector to use (must be created first with Connector.create())
     */
    constructor(connectorName?: string);
    /**
     * Start interactive configuration session
     * AI will ask questions and generate the connector config
     *
     * @param initialInput - Optional initial message (e.g., "I want to connect to GitHub")
     * @returns Promise<string | ConnectorConfigResult> - Either next question or final config
     */
    run(initialInput?: string): Promise<string | ConnectorConfigResult>;
    /**
     * Continue conversation (for multi-turn interaction)
     *
     * @param userMessage - User's response
     * @returns Promise<string | ConnectorConfigResult> - Either next question or final config
     */
    continue(userMessage: string): Promise<string | ConnectorConfigResult>;
    /**
     * Get system instructions for the agent
     */
    private getSystemInstructions;
    /**
     * Extract configuration from AI response
     */
    private extractConfig;
    /**
     * Get default model
     */
    private getDefaultModel;
    /**
     * Reset conversation
     */
    reset(): void;
}

type AgentMode = 'interactive' | 'planning' | 'executing';
interface UniversalAgentSessionConfig$1 {
    /** Storage backend for sessions */
    storage: ISessionStorage;
    /** Resume existing session by ID */
    id?: string;
    /** Auto-save session after each interaction */
    autoSave?: boolean;
    /** Auto-save interval in milliseconds */
    autoSaveIntervalMs?: number;
}
interface UniversalAgentPlanningConfig$1 {
    /** Enable planning mode. Default: true */
    enabled?: boolean;
    /** Model to use for planning (can be different from execution model) */
    model?: string;
    /** Auto-detect complex tasks and switch to planning mode. Default: true */
    autoDetect?: boolean;
    /** Require user approval before executing plan. Default: true */
    requireApproval?: boolean;
    /** Maximum tasks before requiring approval (if requireApproval is false). Default: 3 */
    maxTasksBeforeApproval?: number;
}
interface UniversalAgentConfig$1 {
    connector: string | Connector;
    model: string;
    name?: string;
    tools?: ToolFunction[];
    instructions?: string;
    temperature?: number;
    maxIterations?: number;
    planning?: UniversalAgentPlanningConfig$1;
    session?: UniversalAgentSessionConfig$1;
    memoryConfig?: WorkingMemoryConfig;
    toolManager?: ToolManager;
    /**
     * Custom history manager for conversation tracking.
     * If not provided, creates a default ConversationHistoryManager.
     * Implement IHistoryManager interface for custom storage (Redis, PostgreSQL, etc.)
     */
    historyManager?: IHistoryManager;
    /**
     * Custom context builder for assembling LLM context.
     * If not provided, creates a default context builder.
     * Implement IContextBuilder interface for custom context assembly.
     */
    contextBuilder?: IContextBuilder;
    /** Permission configuration for tool execution approval. */
    permissions?: AgentPermissionsConfig;
}
interface TaskProgress {
    completed: number;
    total: number;
    current?: Task;
    failed: number;
    skipped: number;
}
interface UniversalResponse {
    /** Human-readable response text */
    text: string;
    /** Current mode after this response */
    mode: AgentMode;
    /** Plan (if created or modified) */
    plan?: Plan;
    /** Plan status */
    planStatus?: 'pending_approval' | 'approved' | 'executing' | 'completed' | 'failed';
    /** Task progress (if executing) */
    taskProgress?: TaskProgress;
    /** Tool calls made during this interaction */
    toolCalls?: ToolCallResult[];
    /** Token usage */
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
    /** Whether user action is needed */
    needsUserAction?: boolean;
    /** What action is needed */
    userActionType?: 'approve_plan' | 'provide_input' | 'clarify';
}
interface ToolCallResult {
    name: string;
    args: unknown;
    result: unknown;
    error?: string;
    durationMs: number;
}
type UniversalEvent = {
    type: 'text:delta';
    delta: string;
} | {
    type: 'text:done';
    text: string;
} | {
    type: 'mode:changed';
    from: AgentMode;
    to: AgentMode;
    reason: string;
} | {
    type: 'plan:analyzing';
    goal: string;
} | {
    type: 'plan:created';
    plan: Plan;
} | {
    type: 'plan:modified';
    plan: Plan;
    changes: PlanChange[];
} | {
    type: 'plan:awaiting_approval';
    plan: Plan;
} | {
    type: 'plan:approved';
    plan: Plan;
} | {
    type: 'plan:rejected';
    plan: Plan;
    reason?: string;
} | {
    type: 'task:started';
    task: Task;
} | {
    type: 'task:progress';
    task: Task;
    status: string;
} | {
    type: 'task:completed';
    task: Task;
    result: unknown;
} | {
    type: 'task:failed';
    task: Task;
    error: string;
} | {
    type: 'task:skipped';
    task: Task;
    reason: string;
} | {
    type: 'execution:done';
    result: ExecutionResult;
} | {
    type: 'execution:paused';
    reason: string;
} | {
    type: 'execution:resumed';
} | {
    type: 'tool:start';
    name: string;
    args: unknown;
} | {
    type: 'tool:complete';
    name: string;
    result: unknown;
    durationMs: number;
} | {
    type: 'tool:error';
    name: string;
    error: string;
} | {
    type: 'needs:approval';
    plan: Plan;
} | {
    type: 'needs:input';
    prompt: string;
} | {
    type: 'needs:clarification';
    question: string;
    options?: string[];
} | {
    type: 'error';
    error: string;
    recoverable: boolean;
};
interface PlanChange {
    type: 'task_added' | 'task_removed' | 'task_updated' | 'task_reordered';
    taskId?: string;
    taskName?: string;
    details?: string;
}
interface ExecutionResult {
    status: 'completed' | 'failed' | 'cancelled' | 'paused';
    completedTasks: number;
    totalTasks: number;
    failedTasks: number;
    skippedTasks: number;
    error?: string;
}
interface IntentAnalysis {
    /** Detected intent type */
    type: 'simple' | 'complex' | 'plan_modify' | 'status_query' | 'approval' | 'rejection' | 'feedback' | 'interrupt' | 'question';
    /** Confidence score (0-1) */
    confidence: number;
    /** For complex tasks */
    complexity?: 'low' | 'medium' | 'high';
    estimatedSteps?: number;
    /** For plan modifications */
    modification?: {
        action: 'add_task' | 'remove_task' | 'skip_task' | 'reorder' | 'update_task';
        taskName?: string;
        details?: string;
    };
    /** For approvals/rejections */
    feedback?: string;
    /** Raw reasoning from analysis */
    reasoning?: string;
}
interface ModeState {
    mode: AgentMode;
    enteredAt: Date;
    reason: string;
    pendingPlan?: Plan;
    planApproved?: boolean;
    currentTaskIndex?: number;
    pausedAt?: Date;
    pauseReason?: string;
}

/**
 * UniversalAgent - Unified agent combining interactive, planning, and task execution
 *
 * Extends BaseAgent to inherit:
 * - Connector resolution
 * - Tool manager initialization
 * - Permission manager initialization
 * - Session management
 * - Lifecycle/cleanup
 *
 * Features:
 * - Mode-fluid: Automatically switches between interactive, planning, and executing
 * - User intervention: Users can interrupt, modify plans, provide feedback
 * - Smart detection: Auto-detects complex tasks that need planning
 * - Session persistence: Save and resume conversations
 * - Dynamic tools: Enable/disable tools at runtime
 */

/**
 * UniversalAgentContextAccess provides AgentContext-compatible access
 * to UniversalAgent's internal managers for unified API access.
 */
interface UniversalAgentContextAccess {
    /** Working memory */
    readonly memory: WorkingMemory;
    /** History manager */
    readonly history: IHistoryManager;
    /** Context builder */
    readonly contextBuilder: IContextBuilder;
    /** Permission manager (from BaseAgent) */
    readonly permissions: ToolPermissionManager;
    /** Tool manager (from BaseAgent) */
    readonly tools: ToolManager;
    /** Add a message to history (fire and forget) */
    addMessage(role: 'user' | 'assistant' | 'system', content: string): void;
    /** Get context metrics */
    getMetrics(): Promise<{
        historyMessageCount: number;
        memoryStats: {
            totalEntries: number;
            totalSizeBytes: number;
        };
        mode: AgentMode;
        hasPlan: boolean;
    }>;
}
/**
 * Session configuration for UniversalAgent - extends BaseSessionConfig
 */
interface UniversalAgentSessionConfig extends BaseSessionConfig {
}
/**
 * Planning configuration
 */
interface UniversalAgentPlanningConfig {
    /** Whether planning is enabled (default: true) */
    enabled?: boolean;
    /** Whether to auto-detect complex tasks (default: true) */
    autoDetect?: boolean;
    /** Model to use for planning (defaults to agent model) */
    model?: string;
    /** Whether approval is required (default: true) */
    requireApproval?: boolean;
}
/**
 * UniversalAgent configuration - extends BaseAgentConfig
 */
interface UniversalAgentConfig extends BaseAgentConfig {
    /** System instructions for the agent */
    instructions?: string;
    /** Temperature for generation */
    temperature?: number;
    /** Maximum iterations for tool calling loop */
    maxIterations?: number;
    /** Planning configuration */
    planning?: UniversalAgentPlanningConfig;
    /** Memory configuration */
    memoryConfig?: WorkingMemoryConfig;
    /** Session configuration - extends base type */
    session?: UniversalAgentSessionConfig;
    /** Permission configuration for tool execution approval */
    permissions?: AgentPermissionsConfig;
    /** Custom history manager (optional) */
    historyManager?: IHistoryManager;
    /** Custom context builder (optional) */
    contextBuilder?: IContextBuilder;
}
interface UniversalAgentEvents {
    'mode:changed': {
        from: AgentMode;
        to: AgentMode;
        reason: string;
    };
    'plan:created': {
        plan: Plan;
    };
    'plan:modified': {
        plan: Plan;
        changes: PlanChange[];
    };
    'plan:approved': {
        plan: Plan;
    };
    'task:started': {
        task: Task;
    };
    'task:completed': {
        task: Task;
        result: unknown;
    };
    'task:failed': {
        task: Task;
        error: string;
    };
    'execution:completed': {
        result: ExecutionResult;
    };
    'error': {
        error: Error;
        recoverable: boolean;
    };
    'session:saved': {
        sessionId: string;
    };
    'session:loaded': {
        sessionId: string;
    };
    destroyed: void;
}
declare class UniversalAgent extends BaseAgent<UniversalAgentConfig, UniversalAgentEvents> {
    private agent;
    private executionAgent?;
    private modeManager;
    private planningAgent?;
    private workingMemory;
    private historyManager;
    private contextBuilder;
    private currentPlan;
    private executionHistory;
    /**
     * Create a new UniversalAgent
     */
    static create(config: UniversalAgentConfig): UniversalAgent;
    /**
     * Resume an agent from a saved session
     */
    static resume(sessionId: string, config: Omit<UniversalAgentConfig, 'session'> & {
        session: {
            storage: ISessionStorage;
        };
    }): Promise<UniversalAgent>;
    private constructor();
    protected getAgentType(): 'agent' | 'task-agent' | 'universal-agent';
    protected prepareSessionState(): void;
    protected restoreSessionState(session: Session): Promise<void>;
    protected getSerializedPlan(): SerializedPlan | undefined;
    saveSession(): Promise<void>;
    /**
     * Chat with the agent - the main entry point
     */
    chat(input: string): Promise<UniversalResponse>;
    /**
     * Stream chat response
     */
    stream(input: string): AsyncIterableIterator<UniversalEvent>;
    private handleInteractive;
    private handlePlanning;
    private handleExecuting;
    private streamInteractive;
    private streamPlanning;
    private streamExecuting;
    private streamExecution;
    private createPlan;
    private createPlanInternal;
    private approvePlan;
    private handlePlanRejection;
    private refinePlan;
    private modifyPlan;
    private continueExecution;
    private reportProgress;
    private analyzeIntent;
    private isApproval;
    private isRejection;
    private isStatusQuery;
    private isInterrupt;
    private isPlanModification;
    private parsePlanModification;
    private estimateComplexity;
    private estimateSteps;
    private shouldSwitchToPlanning;
    /**
     * Create a separate agent for task execution that doesn't have meta-tools.
     * This prevents the agent from calling _start_planning during task execution.
     */
    private createExecutionAgent;
    /**
     * Build instructions for the execution agent (task-focused)
     */
    private buildExecutionInstructions;
    /**
     * Register default context sources with the context builder
     */
    private registerDefaultContextSources;
    /**
     * Add a message to conversation history (using pluggable IHistoryManager)
     */
    private addToConversationHistory;
    /**
     * Build context about the current plan and execution state
     */
    private buildPlanContextString;
    /**
     * Build full context for the agent (using pluggable IContextBuilder)
     */
    private buildFullContext;
    private buildInstructions;
    private buildTaskPrompt;
    /**
     * Build task prompt with full context (plan goal, completed tasks, etc.)
     */
    private buildTaskPromptWithContext;
    private formatPlanSummary;
    private formatProgress;
    private getTaskProgress;
    getMode(): AgentMode;
    getPlan(): Plan | null;
    getProgress(): TaskProgress | null;
    /**
     * Access to tool manager (alias for `tools` getter from BaseAgent)
     * @deprecated Use `tools` instead for consistency with other agents
     */
    get toolManager(): ToolManager;
    /**
     * Get unified context access interface.
     *
     * Provides AgentContext-compatible access to UniversalAgent's internal managers,
     * allowing users to interact with the same unified API across all agent types.
     *
     * @example
     * ```typescript
     * const agent = UniversalAgent.create({ ... });
     *
     * // Access context features (same API as AgentContext)
     * agent.context.addMessage('user', 'Hello');
     * const metrics = await agent.context.getMetrics();
     *
     * // Direct access to managers
     * await agent.context.memory.store('key', 'desc', value);
     * ```
     */
    get context(): UniversalAgentContextAccess;
    /**
     * Check if context is available (always true for UniversalAgent)
     */
    hasContext(): boolean;
    setAutoApproval(value: boolean): void;
    setPlanningEnabled(value: boolean): void;
    private _isPaused;
    pause(): void;
    resume(): void;
    cancel(): void;
    isRunning(): boolean;
    isPaused(): boolean;
    destroy(): void;
}

/**
 * ModeManager - Manages agent mode transitions
 *
 * Handles the state machine for UniversalAgent modes:
 * - interactive: Direct conversation, immediate tool execution
 * - planning: Creating and refining plans
 * - executing: Running through a plan
 */

interface ModeManagerEvents {
    'mode:changed': {
        from: AgentMode;
        to: AgentMode;
        reason: string;
    };
    'mode:transition_blocked': {
        from: AgentMode;
        to: AgentMode;
        reason: string;
    };
}
declare class ModeManager extends EventEmitter {
    private state;
    private transitionHistory;
    constructor(initialMode?: AgentMode);
    /**
     * Get current mode
     */
    getMode(): AgentMode;
    /**
     * Get full mode state
     */
    getState(): ModeState;
    /**
     * Check if a transition is allowed
     */
    canTransition(to: AgentMode): boolean;
    /**
     * Transition to a new mode
     */
    transition(to: AgentMode, reason: string): boolean;
    /**
     * Enter planning mode with a goal
     */
    enterPlanning(reason?: string): boolean;
    /**
     * Enter executing mode (plan must be approved)
     */
    enterExecuting(_plan: Plan, reason?: string): boolean;
    /**
     * Return to interactive mode
     */
    returnToInteractive(reason?: string): boolean;
    /**
     * Set pending plan (in planning mode)
     */
    setPendingPlan(plan: Plan): void;
    /**
     * Get pending plan
     */
    getPendingPlan(): Plan | undefined;
    /**
     * Approve the pending plan
     */
    approvePlan(): boolean;
    /**
     * Check if plan is approved
     */
    isPlanApproved(): boolean;
    /**
     * Update current task index (in executing mode)
     */
    setCurrentTaskIndex(index: number): void;
    /**
     * Get current task index
     */
    getCurrentTaskIndex(): number;
    /**
     * Pause execution
     */
    pauseExecution(reason: string): void;
    /**
     * Resume execution
     */
    resumeExecution(): void;
    /**
     * Check if paused
     */
    isPaused(): boolean;
    /**
     * Get pause reason
     */
    getPauseReason(): string | undefined;
    /**
     * Determine recommended mode based on intent analysis
     */
    recommendMode(intent: IntentAnalysis, _currentPlan?: Plan): AgentMode | null;
    /**
     * Get transition history
     */
    getHistory(): Array<{
        from: AgentMode;
        to: AgentMode;
        at: Date;
        reason: string;
    }>;
    /**
     * Clear transition history
     */
    clearHistory(): void;
    /**
     * Get time spent in current mode
     */
    getTimeInCurrentMode(): number;
    /**
     * Serialize state for session persistence
     */
    serialize(): {
        mode: AgentMode;
        enteredAt: string;
        reason: string;
        pendingPlan?: Plan;
        planApproved?: boolean;
        currentTaskIndex?: number;
    };
    /**
     * Restore state from serialized data
     */
    restore(data: ReturnType<ModeManager['serialize']>): void;
}

/**
 * Meta-tools for UniversalAgent
 *
 * These tools are used internally by the agent to signal mode transitions
 * and perform meta-operations like planning and progress reporting.
 */

/**
 * Get all meta-tools
 */
declare function getMetaTools(): ToolFunction[];
/**
 * Check if a tool name is a meta-tool
 */
declare function isMetaTool(toolName: string): boolean;
/**
 * Meta-tool names
 */
declare const META_TOOL_NAMES: {
    readonly START_PLANNING: "_start_planning";
    readonly MODIFY_PLAN: "_modify_plan";
    readonly REPORT_PROGRESS: "_report_progress";
    readonly REQUEST_APPROVAL: "_request_approval";
};

export { AIError, AdaptiveStrategy, Agent, type AgentConfig$1 as AgentConfig, AgentContext, type AgentContextConfig, type AgentContextEvents, type HistoryMessage$1 as AgentContextHistoryMessage, type AgentContextMetrics, type AgentHandle, type AgentMetrics, type AgentMode, AgentPermissionsConfig, AgentResponse, type AgentSessionConfig, type AgentState, type AgentStatus, AgenticLoopEvents, AggressiveCompactionStrategy, ApproximateTokenEstimator, AudioFormat, AuditEntry, type BackoffConfig, type BackoffStrategyType, BaseMediaProvider, BaseProvider, type BaseProviderConfig$1 as BaseProviderConfig, type BaseProviderResponse, BaseTextProvider, type BashResult, BraveProvider, type BuiltContext, CONNECTOR_CONFIG_VERSION, type CacheStats, CheckpointManager, type CheckpointStrategy, CircuitBreaker, type CircuitBreakerConfig, type CircuitBreakerEvents, type CircuitBreakerMetrics, CircuitOpenError, type CircuitState, type ClipboardImageResult, Connector, ConnectorConfig, ConnectorConfigResult, ConnectorConfigStore, ConnectorFetchOptions, ConnectorTools, ConsoleMetrics, type ContextBudget, type ContextBuilderConfig, ContextManager, type ContextManagerConfig, type ContextSource, ConversationHistoryManager, type ConversationHistoryManagerConfig, type ConversationMessage, DEFAULT_BACKOFF_CONFIG, DEFAULT_CHECKPOINT_STRATEGY, DEFAULT_CIRCUIT_BREAKER_CONFIG, DEFAULT_CONTEXT_BUILDER_CONFIG, DEFAULT_CONTEXT_CONFIG, DEFAULT_FILESYSTEM_CONFIG, DEFAULT_HISTORY_MANAGER_CONFIG, DEFAULT_IDEMPOTENCY_CONFIG, DEFAULT_MEMORY_CONFIG, DEFAULT_RATE_LIMITER_CONFIG, DEFAULT_SHELL_CONFIG, DefaultContextBuilder, DependencyCycleError, type EditFileResult, type ErrorContext$1 as ErrorContext, ErrorHandler, type ErrorHandlerConfig, type ErrorHandlerEvents, type EvictionStrategy, ExecutionContext, ExecutionMetrics, type ExecutionResult, type ExtendedFetchOptions, type ExternalDependency, type ExternalDependencyEvents, ExternalDependencyHandler, FileConnectorStorage, type FileConnectorStorageConfig, FileSessionStorage, type FileSessionStorageConfig, FileStorage, type FileStorageConfig, type FilesystemToolConfig, FrameworkLogger, FunctionToolDefinition, type GenericAPICallArgs, type GenericAPICallResult, type GenericAPIToolOptions, type GlobResult, type GrepMatch, type GrepResult, type HistoryManagerEvents, type HistoryMessage, HistoryMode, HookConfig, type IAgentStateStorage, type IAgentStorage, type IAsyncDisposable, IBaseModelDescription, type ICapabilityProvider, type IConnectorConfigStorage, type IContextBuilder, type IContextCompactor, type IContextComponent, type IContextProvider, type IContextStrategy, type IDisposable, type IHistoryManager, type IHistoryManagerConfig, type IHistoryStorage, IImageProvider, type ILLMDescription, type IMemoryStorage, type IPlanStorage, IProvider, type ISTTModelDescription, type IScrapeProvider, type ISearchProvider, type ISessionStorage, type ISpeechToTextProvider, type ITTSModelDescription, ITextProvider, type ITextToSpeechProvider, type ITokenEstimator, ITokenStorage, IToolExecutor, type IVideoModelDescription, type IVideoProvider, type IVoiceInfo, IdempotencyCache, type IdempotencyCacheConfig, InMemoryAgentStateStorage, InMemoryHistoryStorage, InMemoryMetrics, InMemoryPlanStorage, InMemorySessionStorage, InMemoryStorage, InputItem, type IntentAnalysis, InvalidConfigError, InvalidToolArgumentsError, type JSONExtractionResult, LLMResponse, LLM_MODELS, LazyCompactionStrategy, type LogEntry, type LogLevel, type LoggerConfig, MEMORY_PRIORITY_VALUES, META_TOOL_NAMES, MODEL_REGISTRY, MemoryConnectorStorage, type MemoryEntry, type MemoryEntryInput, MemoryEvictionCompactor, type MemoryIndex, type MemoryIndexEntry, type MemoryPriority, type MemoryScope, MemoryStorage, MessageBuilder, MessageRole, type MetricTags, type MetricsCollector, type MetricsCollectorType, ModeManager, type ModeManagerEvents, type ModeState, ModelCapabilities, ModelNotSupportedError, NoOpMetrics, type OAuthConfig, type OAuthFlow, OAuthManager, ParallelTasksError, type Plan, type PlanChange, type PlanConcurrency, type PlanExecutionResult, PlanExecutor, type PlanExecutorConfig, type PlanExecutorEvents, type PlanInput, type PlanResult, type PlanStatus, type PlanUpdateOptions, type PlanUpdates, type PreparedContext, ProactiveCompactionStrategy, ProviderAuthError, ProviderCapabilities, ProviderConfigAgent, ProviderContextLengthError, ProviderError, ProviderErrorMapper, ProviderNotFoundError, ProviderRateLimitError, RapidAPIProvider, RateLimitError, type RateLimiterConfig, type RateLimiterMetrics, type ReadFileResult, RollingWindowStrategy, SERVICE_DEFINITIONS, SERVICE_INFO, SERVICE_URL_PATTERNS, type STTModelCapabilities, type STTOptions, type STTOutputFormat$1 as STTOutputFormat, type STTResponse, STT_MODELS, STT_MODEL_REGISTRY, type ScrapeFeature, type ScrapeOptions, ScrapeProvider, type ScrapeProviderConfig, type ScrapeProviderFallbackConfig, type ScrapeResponse, type ScrapeResult, type SearchOptions, SearchProvider, type SearchProviderConfig, type SearchResponse, type SearchResult, type SegmentTimestamp, type SerializedAgentContextState, SerializedApprovalState, type SerializedHistory, type SerializedHistoryEntry, type SerializedHistoryState, type SerializedMemory, type SerializedMemoryEntry, type SerializedPlan, type SerializedToolState, SerperProvider, type ServiceCategory, type ServiceDefinition, type ServiceInfo, type ServiceToolFactory, type ServiceType, Services, type Session, type SessionFilter, SessionManager, type SessionManagerConfig, type SessionManagerEvent, type SessionMetadata, type SessionMetrics, type SessionSummary, type ShellToolConfig, type SimpleScope, type SimpleVideoGenerateOptions, SpeechToText, type SpeechToTextConfig, type StoredConnectorConfig, type StoredToken, StreamEvent, StreamEventType, StreamHelpers, StreamState, SummarizeCompactor, TERMINAL_TASK_STATUSES, type TTSModelCapabilities, type TTSOptions, type TTSResponse, TTS_MODELS, TTS_MODEL_REGISTRY, type Task, TaskAgent, type TaskAgentConfig, type TaskAgentContextAccess, TaskAgentContextProvider, type ErrorContext as TaskAgentErrorContext, type TaskAgentHooks, type TaskAgentSessionConfig, type AgentConfig as TaskAgentStateConfig, type TaskAwareScope, type TaskCondition, type TaskContext, type TaskExecution, type TaskFailure, type TaskInput, type TaskProgress, type TaskResult, type TaskStatus, type TaskStatusForMemory, TaskTimeoutError, type ToolContext as TaskToolContext, type TaskValidation, TaskValidationError, type TaskValidationResult, TavilyProvider, TextGenerateOptions, TextToSpeech, type TextToSpeechConfig, TokenBucketRateLimiter, type TokenContentType, Tool, ToolCall, type ToolCallRecord, type ToolCondition, ToolExecutionError, ToolFunction, ToolManager, type ToolManagerEvent, type ToolManagerStats, type ToolMetadata, ToolNotFoundError, type ToolOptions, ToolPermissionManager, type ToolRegistration, type ToolSelectionContext, ToolTimeoutError, TruncateCompactor, UniversalAgent, type UniversalAgentConfig$1 as UniversalAgentConfig, type UniversalAgentContextAccess, type UniversalAgentEvents, type UniversalAgentPlanningConfig$1 as UniversalAgentPlanningConfig, type UniversalAgentSessionConfig$1 as UniversalAgentSessionConfig, type UniversalEvent, type UniversalResponse, type ToolCallResult as UniversalToolCallResult, VIDEO_MODELS, VIDEO_MODEL_REGISTRY, Vendor, VendorOptionSchema, type VideoExtendOptions, type VideoGenerateOptions, VideoGeneration, type VideoGenerationCreateOptions, type VideoJob, type VideoModelCapabilities, type VideoModelPricing, type VideoResponse, type VideoStatus, type WordTimestamp, WorkingMemory, type WorkingMemoryAccess, type WorkingMemoryConfig, type WorkingMemoryEvents, type WriteFileResult, addHistoryEntry, addJitter, assertNotDestroyed, authenticatedFetch, backoffSequence, backoffWait, bash, buildEndpointWithQuery, buildQueryString, calculateBackoff, calculateCost, calculateEntrySize, calculateSTTCost, calculateTTSCost, calculateVideoCost, canTaskExecute, createAgentStorage, createAuthenticatedFetch, createBashTool, createEditFileTool, createEmptyHistory, createEmptyMemory, createEstimator, createExecuteJavaScriptTool, createGlobTool, createGrepTool, createImageProvider, createListDirectoryTool, createMemoryTools, createMessageWithImages, createMetricsCollector, createPlan, createProvider, createReadFileTool, createStrategy, createTask, createTextMessage, createVideoProvider, createWriteFileTool, detectDependencyCycle, detectServiceFromURL, developerTools, editFile, evaluateCondition, extractJSON, extractJSONField, extractNumber, forPlan, forTasks, generateEncryptionKey, generateWebAPITool, getActiveModels, getActiveSTTModels, getActiveTTSModels, getActiveVideoModels, getAllServiceIds, getBackgroundOutput, getMetaTools, getModelInfo, getModelsByVendor, getNextExecutableTasks, getRegisteredScrapeProviders, getSTTModelInfo, getSTTModelsByVendor, getSTTModelsWithFeature, getServiceDefinition, getServiceInfo, getServicesByCategory, getTTSModelInfo, getTTSModelsByVendor, getTTSModelsWithFeature, getTaskDependencies, getVideoModelInfo, getVideoModelsByVendor, getVideoModelsWithAudio, getVideoModelsWithFeature, glob, globalErrorHandler, grep, hasClipboardImage, isBlockedCommand, isExcludedExtension, isKnownService, isMetaTool, isSimpleScope, isTaskAwareScope, isTaskBlocked, isTerminalMemoryStatus, isTerminalStatus, killBackgroundProcess, listDirectory, logger, metrics, readClipboardImage, readFile, registerScrapeProvider, resolveConnector, resolveDependencies, retryWithBackoff, scopeEquals, scopeMatches, setMetricsCollector, toConnectorOptions, index as tools, updateTaskStatus, validatePath, writeFile };
