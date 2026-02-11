import { I as IConnectorRegistry, a as IConnectorAccessPolicy, C as ConnectorAccessContext, b as Connector, c as IProvider, d as ConnectorFetchOptions, P as ProviderCapabilities, e as ITokenStorage, S as StoredToken$1, f as ConnectorConfig, g as ConnectorAuth, h as ConnectorConfigResult } from './IProvider-DcYJ3YE-.js';
export { A as APIKeyConnectorAuth, k as DEFAULT_BASE_DELAY_MS, D as DEFAULT_CONNECTOR_TIMEOUT, l as DEFAULT_MAX_DELAY_MS, i as DEFAULT_MAX_RETRIES, j as DEFAULT_RETRYABLE_STATUSES, J as JWTConnectorAuth, O as OAuthConnectorAuth } from './IProvider-DcYJ3YE-.js';
import { T as Tool, a as ToolFunction, b as ToolContext, c as ToolPermissionConfig$1, d as ToolCall, I as InputItem, M as MemoryEntry, e as MemoryScope, W as WorkingMemoryConfig, P as PriorityCalculator, f as MemoryPriority, g as MemoryTier, C as Content, O as OutputItem, h as ToolResult, i as ITextProvider, F as FunctionToolDefinition, L as LLMResponse, S as StreamEvent, H as HookConfig, j as HistoryMode, A as AgentEvents, k as AgentResponse, E as ExecutionContext, l as ExecutionMetrics, m as AuditEntry, n as StaleEntryInfo, o as PriorityContext, p as MemoryIndex, q as TaskStatusForMemory, r as WorkingMemoryAccess, s as TokenUsage, t as StreamEventType, u as TextGenerateOptions, v as ModelCapabilities, w as MessageRole } from './index-DVb6vfA3.js';
export { aD as AfterToolContext, av as AgentEventName, ay as AgenticLoopEventName, ax as AgenticLoopEvents, aG as ApprovalResult, aE as ApproveToolContext, aC as BeforeToolContext, a8 as BuiltInTool, a3 as CompactionItem, Y as ContentType, D as DEFAULT_MEMORY_CONFIG, am as ErrorEvent, aw as ExecutionConfig, aA as Hook, au as HookManager, az as HookName, _ as InputImageContent, Z as InputTextContent, ak as IterationCompleteEvent, aa as JSONSchema, X as MEMORY_PRIORITY_VALUES, x as MemoryEntryInput, y as MemoryIndexEntry, a2 as Message, aB as ModifyingHook, $ as OutputTextContent, ad as OutputTextDeltaEvent, ae as OutputTextDoneEvent, a4 as ReasoningItem, al as ResponseCompleteEvent, ab as ResponseCreatedEvent, ac as ResponseInProgressEvent, B as SimpleScope, z as TaskAwareScope, ag as ToolCallArgumentsDeltaEvent, ah as ToolCallArgumentsDoneEvent, af as ToolCallStartEvent, a5 as ToolCallState, a9 as ToolExecutionContext, aj as ToolExecutionDoneEvent, ai as ToolExecutionStartEvent, aF as ToolModification, a1 as ToolResultContent, a0 as ToolUseContent, V as calculateEntrySize, a6 as defaultDescribeCall, J as forPlan, G as forTasks, a7 as getToolCallDescription, at as isErrorEvent, ao as isOutputTextDelta, as as isResponseComplete, Q as isSimpleScope, an as isStreamEvent, R as isTaskAwareScope, U as isTerminalMemoryStatus, aq as isToolCallArgumentsDelta, ar as isToolCallArgumentsDone, ap as isToolCallStart, K as scopeEquals, N as scopeMatches } from './index-DVb6vfA3.js';
import { EventEmitter } from 'eventemitter3';
import { V as Vendor } from './Vendor-DYh_bzwo.js';
export { a as VENDORS, i as isVendor } from './Vendor-DYh_bzwo.js';
import { A as AudioFormat, I as IBaseModelDescription, V as VendorOptionSchema, a as IImageProvider } from './ImageModel-BJ2mVPGV.js';
export { r as AspectRatio, d as IImageModelDescription, g as IMAGE_MODELS, h as IMAGE_MODEL_REGISTRY, s as ISourceLinks, o as ImageEditOptions, n as ImageGenerateOptions, b as ImageGeneration, c as ImageGenerationCreateOptions, e as ImageModelCapabilities, f as ImageModelPricing, q as ImageResponse, p as ImageVariationOptions, O as OutputFormat, Q as QualityLevel, S as SimpleGenerateOptions, m as calculateImageCost, k as getActiveImageModels, i as getImageModelInfo, j as getImageModelsByVendor, l as getImageModelsWithFeature } from './ImageModel-BJ2mVPGV.js';
import { ServiceCategory } from './shared/index.js';
export { ILLMDescription, LLM_MODELS, MODEL_REGISTRY, SERVICE_DEFINITIONS, SERVICE_INFO, SERVICE_URL_PATTERNS, ServiceDefinition, ServiceInfo, ServiceType, Services, calculateCost, detectServiceFromURL, getActiveModels, getAllServiceIds, getModelInfo, getModelsByVendor, getServiceDefinition, getServiceInfo, getServicesByCategory, isKnownService } from './shared/index.js';

/**
 * ScopedConnectorRegistry - Filtered view over the Connector registry
 *
 * Provides access-controlled connector lookup by delegating to
 * Connector static methods and filtering through an IConnectorAccessPolicy.
 *
 * Security: get() on a denied connector throws the same "not found" error
 * listing only visible connectors — no information leakage.
 */

declare class ScopedConnectorRegistry implements IConnectorRegistry {
    private readonly policy;
    private readonly context;
    constructor(policy: IConnectorAccessPolicy, context: ConnectorAccessContext);
    get(name: string): Connector;
    has(name: string): boolean;
    list(): string[];
    listAll(): Connector[];
    size(): number;
    getDescriptionsForTools(): string;
    getInfo(): Record<string, {
        displayName: string;
        description: string;
        baseURL: string;
    }>;
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

/**
 * Tool Execution Plugin System Types
 *
 * Provides a pluggable architecture for extending tool execution with
 * custom behavior like logging, analytics, permission prompts, UI updates, etc.
 *
 * @module tool-execution
 */

/**
 * Context passed through the execution pipeline.
 * Contains all information about the current tool execution.
 */
interface PluginExecutionContext {
    /** Name of the tool being executed */
    toolName: string;
    /** Original arguments passed to the tool (immutable) */
    readonly args: unknown;
    /** Mutable arguments that plugins can modify */
    mutableArgs: unknown;
    /** Metadata for passing data between plugins */
    metadata: Map<string, unknown>;
    /** Timestamp when execution started (ms since epoch) */
    startTime: number;
    /** The tool function being executed */
    tool: ToolFunction;
    /** Unique execution ID for tracing */
    executionId: string;
}
/**
 * Result of a plugin's beforeExecute hook.
 *
 * - `void` or `undefined`: Continue execution with original args
 * - `{ abort: true, result: ... }`: Abort and return this result immediately
 * - `{ modifiedArgs: ... }`: Continue with modified arguments
 */
type BeforeExecuteResult = void | undefined | {
    abort: true;
    result: unknown;
} | {
    modifiedArgs: unknown;
};
/**
 * Plugin interface for extending tool execution.
 *
 * Plugins can hook into the execution lifecycle to:
 * - Modify arguments before execution
 * - Transform results after execution
 * - Handle errors
 * - Emit side effects (logging, UI updates, analytics)
 *
 * @example
 * ```typescript
 * class MyPlugin implements IToolExecutionPlugin {
 *   readonly name = 'my-plugin';
 *   readonly priority = 100;
 *
 *   async beforeExecute(ctx: PluginExecutionContext) {
 *     console.log(`Starting ${ctx.toolName}`);
 *   }
 *
 *   async afterExecute(ctx: PluginExecutionContext, result: unknown) {
 *     console.log(`Finished ${ctx.toolName} in ${Date.now() - ctx.startTime}ms`);
 *     return result;
 *   }
 * }
 * ```
 */
interface IToolExecutionPlugin {
    /** Unique plugin name (used for registration and lookup) */
    readonly name: string;
    /**
     * Execution priority. Lower values run earlier in beforeExecute,
     * later in afterExecute (for proper unwinding).
     * Default: 100
     */
    readonly priority?: number;
    /**
     * Called before tool execution.
     *
     * Can:
     * - Return void to continue with original args
     * - Return `{ modifiedArgs }` to continue with modified args
     * - Return `{ abort: true, result }` to short-circuit and return immediately
     *
     * @param ctx - Execution context with tool info and mutable args
     */
    beforeExecute?(ctx: PluginExecutionContext): Promise<BeforeExecuteResult>;
    /**
     * Called after successful tool execution.
     *
     * Can transform or replace the result. Must return the (possibly modified) result.
     * Hooks run in reverse priority order for proper stack-like unwinding.
     *
     * @param ctx - Execution context
     * @param result - Result from tool execution (or previous plugin)
     * @returns The result to pass to the next plugin or return to caller
     */
    afterExecute?(ctx: PluginExecutionContext, result: unknown): Promise<unknown>;
    /**
     * Called when tool execution fails.
     *
     * Can:
     * - Return undefined to let error propagate to next plugin/caller
     * - Return a value to recover from the error (returned as the result)
     * - Throw a different error
     *
     * @param ctx - Execution context
     * @param error - The error that occurred
     * @returns Recovery value or undefined to propagate error
     */
    onError?(ctx: PluginExecutionContext, error: Error): Promise<unknown>;
    /**
     * Called when plugin is registered with a pipeline.
     * Use for setup that requires pipeline reference.
     *
     * @param pipeline - The pipeline this plugin is registered with
     */
    onRegister?(pipeline: IToolExecutionPipeline): void;
    /**
     * Called when plugin is unregistered from a pipeline.
     * Use for cleanup.
     */
    onUnregister?(): void;
}
/**
 * Pipeline interface for managing and executing plugins.
 */
interface IToolExecutionPipeline {
    /**
     * Register a plugin with the pipeline.
     * If a plugin with the same name exists, it will be replaced.
     *
     * @param plugin - Plugin to register
     * @returns this for chaining
     */
    use(plugin: IToolExecutionPlugin): this;
    /**
     * Remove a plugin by name.
     *
     * @param pluginName - Name of plugin to remove
     * @returns true if removed, false if not found
     */
    remove(pluginName: string): boolean;
    /**
     * Check if a plugin is registered.
     *
     * @param pluginName - Name of plugin to check
     */
    has(pluginName: string): boolean;
    /**
     * Get a registered plugin by name.
     *
     * @param pluginName - Name of plugin to get
     */
    get(pluginName: string): IToolExecutionPlugin | undefined;
    /**
     * List all registered plugins (sorted by priority).
     */
    list(): IToolExecutionPlugin[];
    /**
     * Execute a tool through the plugin pipeline.
     *
     * @param tool - Tool function to execute
     * @param args - Arguments for the tool
     * @returns Result from tool execution (possibly transformed by plugins)
     */
    execute(tool: ToolFunction, args: unknown): Promise<unknown>;
}
/**
 * Options for creating a ToolExecutionPipeline
 */
interface ToolExecutionPipelineOptions {
    /**
     * Whether to generate unique execution IDs using crypto.randomUUID().
     * If false, uses a simpler counter-based ID.
     * Default: true (if crypto.randomUUID is available)
     */
    useRandomUUID?: boolean;
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
/**
 * Configuration for ToolManager
 */
interface ToolManagerConfig {
    /**
     * Hard timeout in milliseconds for any single tool execution.
     * Acts as a safety net: if a tool's own timeout mechanism fails
     * (e.g. child process doesn't exit), this will force-resolve with an error.
     * Default: 0 (disabled - relies on tool's own timeout)
     */
    toolExecutionTimeout?: number;
}
declare class ToolManager extends EventEmitter implements IToolExecutor, IDisposable {
    private registry;
    private namespaceIndex;
    private circuitBreakers;
    private toolLogger;
    private _isDestroyed;
    private pipeline;
    /** Optional tool context for execution (set by agent before runs) */
    private _toolContext;
    /** Hard timeout for tool execution (0 = disabled) */
    private _toolExecutionTimeout;
    constructor(config?: ToolManagerConfig);
    /**
     * Get or set the hard tool execution timeout in milliseconds.
     * 0 = disabled (relies on tool's own timeout).
     */
    get toolExecutionTimeout(): number;
    set toolExecutionTimeout(value: number);
    /**
     * Access the execution pipeline for plugin management.
     *
     * Use this to register plugins that intercept and extend tool execution.
     *
     * @example
     * ```typescript
     * // Add logging plugin
     * toolManager.executionPipeline.use(new LoggingPlugin());
     *
     * // Add custom plugin
     * toolManager.executionPipeline.use({
     *   name: 'my-plugin',
     *   async afterExecute(ctx, result) {
     *     console.log(`${ctx.toolName} returned:`, result);
     *     return result;
     *   },
     * });
     * ```
     */
    get executionPipeline(): IToolExecutionPipeline;
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
     * Execute a tool function with circuit breaker protection and plugin pipeline.
     * Implements IToolExecutor interface.
     *
     * Execution flow:
     * 1. Validate tool exists and is enabled
     * 2. Check circuit breaker state
     * 3. Run through plugin pipeline (beforeExecute -> execute -> afterExecute)
     * 4. Update metrics and circuit breaker state
     *
     * Simple execution - no caching, no parent context.
     * Context must be set via setToolContext() before calling.
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
     * Wrap a promise with a hard timeout safety net.
     * If the promise doesn't resolve within the timeout, throws ToolExecutionError.
     */
    private withHardTimeout;
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
     * 2. Register an 'approve:tool' hook in the Agent
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
 * IContextStorage - Storage interface for AgentContext persistence
 *
 * Provides persistence operations for AgentContext sessions.
 * Implementations can use filesystem, database, cloud storage, etc.
 *
 * This follows Clean Architecture - the interface is in domain layer,
 * implementations are in infrastructure layer.
 */

/**
 * Serialized context state for persistence.
 * This is the canonical definition - core layer re-exports this type.
 */
interface SerializedContextState {
    /** Conversation history */
    conversation: InputItem[];
    /** Plugin states (keyed by plugin name) */
    pluginStates: Record<string, unknown>;
    /** System prompt */
    systemPrompt?: string;
    /** Metadata */
    metadata: {
        savedAt: number;
        agentId?: string;
        userId?: string;
        model: string;
    };
    /** Agent-specific state (for TaskAgent, UniversalAgent, etc.) */
    agentState?: Record<string, unknown>;
}
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
    state: SerializedContextState;
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
    save(sessionId: string, state: SerializedContextState, metadata?: ContextSessionMetadata): Promise<void>;
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
     * Get the storage path (for display/debugging)
     * @deprecated Use getLocation() instead - getPath() assumes filesystem storage
     */
    getPath(): string;
    /**
     * Get a human-readable storage location string (for display/debugging).
     * Examples: file path, MongoDB URI, Redis key prefix, S3 bucket, etc.
     * Falls back to getPath() if not implemented.
     */
    getLocation?(): string;
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
 * AgentContextNextGen - Type Definitions
 *
 * Clean, minimal type definitions for the next-generation context manager.
 */

/**
 * Token estimator interface - used for conversation and input estimation
 * Plugins handle their own token estimation internally.
 */
interface ITokenEstimator$1 {
    /** Estimate tokens for a string */
    estimateTokens(text: string): number;
    /** Estimate tokens for arbitrary data (will be JSON stringified) */
    estimateDataTokens(data: unknown): number;
    /**
     * Estimate tokens for an image. Provider-specific implementations can override.
     *
     * Default heuristic (matches OpenAI's image token pricing):
     * - detail='low': 85 tokens
     * - detail='high' with known dimensions: 85 + 170 * ceil(w/512) * ceil(h/512)
     * - Unknown dimensions: ~1000 tokens (conservative default)
     *
     * @param width - Image width in pixels (if known)
     * @param height - Image height in pixels (if known)
     * @param detail - Image detail level: 'low', 'high', or 'auto' (default 'auto')
     */
    estimateImageTokens?(width?: number, height?: number, detail?: string): number;
}
/**
 * Context plugin interface for NextGen context management.
 *
 * ## Implementing a Custom Plugin
 *
 * 1. **Extend BasePluginNextGen** - provides token caching helpers
 * 2. **Implement getInstructions()** - return LLM usage guide (static, cached)
 * 3. **Implement getContent()** - return formatted content (Markdown with `##` header)
 * 4. **Call updateTokenCache()** - after any state change that affects content
 * 5. **Implement getTools()** - return tools with `<plugin_prefix>_*` naming
 *
 * ## Plugin Contributions
 *
 * Plugins provide three types of content to the system message:
 * 1. **Instructions** - static usage guide for the LLM (NEVER compacted)
 * 2. **Content** - dynamic plugin data/state (may be compacted)
 * 3. **Tools** - registered with ToolManager (NEVER compacted)
 *
 * ## Token Cache Lifecycle
 *
 * Plugins must track their own token size for budget calculation. The pattern:
 *
 * ```typescript
 * // When state changes:
 * this._entries.set(key, value);
 * this.invalidateTokenCache();  // Clear cached size
 *
 * // In getContent():
 * const content = this.formatContent();
 * this.updateTokenCache(this.estimator.estimateTokens(content));  // Update cache
 * return content;
 * ```
 *
 * ## Content Format
 *
 * `getContent()` should return Markdown with a descriptive header:
 *
 * ```markdown
 * ## Plugin Display Name (optional stats)
 *
 * Formatted content here...
 * - Entry 1: value
 * - Entry 2: value
 * ```
 *
 * Built-in plugins use these headers:
 * - WorkingMemory: `## Working Memory (N entries)`
 * - InContextMemory: `## Live Context (N entries)`
 * - PersistentInstructions: No header (user's raw instructions)
 *
 * ## Tool Naming Convention
 *
 * Use a consistent prefix based on plugin name:
 * - `working_memory` plugin → `memory_store`, `memory_retrieve`, `memory_delete`, `memory_list`
 * - `in_context_memory` plugin → `context_set`, `context_delete`, `context_list`
 * - `persistent_instructions` plugin → `instructions_set`, `instructions_remove`, `instructions_list`, `instructions_clear`
 *
 * ## State Serialization
 *
 * `getState()` and `restoreState()` are **synchronous** for simplicity.
 * If your plugin has async data, consider:
 * - Storing only references/keys in state
 * - Using a separate async initialization method
 *
 * @example
 * ```typescript
 * class MyPlugin extends BasePluginNextGen {
 *   readonly name = 'my_plugin';
 *   private _data = new Map<string, string>();
 *
 *   getInstructions(): string {
 *     return '## My Plugin\n\nUse my_plugin_set to store data...';
 *   }
 *
 *   async getContent(): Promise<string | null> {
 *     if (this._data.size === 0) return null;
 *     const lines = [...this._data].map(([k, v]) => `- ${k}: ${v}`);
 *     const content = `## My Plugin (${this._data.size} entries)\n\n${lines.join('\n')}`;
 *     this.updateTokenCache(this.estimator.estimateTokens(content));
 *     return content;
 *   }
 *
 *   getTools(): ToolFunction[] {
 *     return [myPluginSetTool, myPluginGetTool];
 *   }
 *
 *   getState(): unknown {
 *     return { data: Object.fromEntries(this._data) };
 *   }
 *
 *   restoreState(state: unknown): void {
 *     const s = state as { data: Record<string, string> };
 *     this._data = new Map(Object.entries(s.data || {}));
 *     this.invalidateTokenCache();
 *   }
 * }
 * ```
 */
interface IContextPluginNextGen {
    /** Unique plugin name (used for lookup and tool prefixing) */
    readonly name: string;
    /**
     * Get usage instructions for the LLM.
     *
     * Returns static text explaining how to use this plugin's tools
     * and data. This is placed in the system message and is NEVER
     * compacted - it persists throughout the conversation.
     *
     * Instructions should include:
     * - What the plugin does
     * - How to use available tools
     * - Best practices and conventions
     *
     * @returns Instructions string or null if no instructions needed
     *
     * @example
     * ```typescript
     * getInstructions(): string {
     *   return `## Working Memory
     *
     * Use memory_store to save important data for later retrieval.
     * Use memory_retrieve to recall previously stored data.
     *
     * Best practices:
     * - Use descriptive keys like 'user_preferences' not 'data1'
     * - Store intermediate results that may be needed later`;
     * }
     * ```
     */
    getInstructions(): string | null;
    /**
     * Get formatted content to include in system message.
     *
     * Returns the plugin's current state formatted for LLM consumption.
     * Should be Markdown with a `## Header`. This content CAN be compacted
     * if `isCompactable()` returns true.
     *
     * **IMPORTANT:** Call `updateTokenCache()` with the content's token size
     * before returning to keep budget calculations accurate.
     *
     * @returns Formatted content string or null if empty
     *
     * @example
     * ```typescript
     * async getContent(): Promise<string | null> {
     *   if (this._entries.size === 0) return null;
     *
     *   const lines = this._entries.map(e => `- ${e.key}: ${e.value}`);
     *   const content = `## My Plugin (${this._entries.size} entries)\n\n${lines.join('\n')}`;
     *
     *   // IMPORTANT: Update token cache before returning
     *   this.updateTokenCache(this.estimator.estimateTokens(content));
     *   return content;
     * }
     * ```
     */
    getContent(): Promise<string | null>;
    /**
     * Get the full raw contents of this plugin for inspection.
     *
     * Used by library clients to programmatically inspect plugin state.
     * Returns the actual data structure, not the formatted string.
     *
     * @returns Raw plugin data (entries map, array, etc.)
     */
    getContents(): unknown;
    /**
     * Get current token size of plugin content.
     *
     * Returns the cached token count from the last `updateTokenCache()` call.
     * This is used for budget calculation in `prepare()`.
     *
     * The cache should be updated via `updateTokenCache()` whenever content
     * changes. If cache is null, returns 0.
     *
     * @returns Current token count (0 if no content or cache not set)
     */
    getTokenSize(): number;
    /**
     * Get token size of instructions (cached after first call).
     *
     * Instructions are static, so this is computed once and cached.
     * Used for budget calculation.
     *
     * @returns Token count for instructions (0 if no instructions)
     */
    getInstructionsTokenSize(): number;
    /**
     * Whether this plugin's content can be compacted when context is tight.
     *
     * Return true if the plugin can reduce its content size when requested.
     * Examples: evicting low-priority entries, summarizing, removing old data.
     *
     * Return false if content cannot be reduced (e.g., critical state).
     *
     * @returns true if compact() can free tokens
     */
    isCompactable(): boolean;
    /**
     * Compact plugin content to free tokens.
     *
     * Called by compaction strategies when context is too full.
     * Should attempt to free **approximately** `targetTokensToFree` tokens.
     *
     * This is a **best effort** operation:
     * - May free more or less than requested
     * - May return 0 if nothing can be compacted (e.g., all entries are critical)
     * - Should prioritize removing lowest-priority/oldest data first
     *
     * Strategies may include:
     * - Evicting low-priority entries
     * - Summarizing verbose content
     * - Removing oldest data
     * - Truncating large values
     *
     * **IMPORTANT:** Call `invalidateTokenCache()` or `updateTokenCache()`
     * after modifying content.
     *
     * @param targetTokensToFree - Approximate tokens to free (best effort)
     * @returns Actual tokens freed (may be 0 if nothing can be compacted)
     *
     * @example
     * ```typescript
     * async compact(targetTokensToFree: number): Promise<number> {
     *   const before = this.getTokenSize();
     *   let freed = 0;
     *
     *   // Remove low-priority entries until target reached
     *   const sorted = [...this._entries].sort(byPriority);
     *   for (const entry of sorted) {
     *     if (entry.priority === 'critical') continue; // Never remove critical
     *     if (freed >= targetTokensToFree) break;
     *
     *     freed += entry.tokens;
     *     this._entries.delete(entry.key);
     *   }
     *
     *   this.invalidateTokenCache();
     *   return freed;
     * }
     * ```
     */
    compact(targetTokensToFree: number): Promise<number>;
    /**
     * Get tools provided by this plugin.
     *
     * Tools are automatically registered with ToolManager when the plugin
     * is added to the context. Use a consistent naming convention:
     * `<prefix>_<action>` (e.g., `memory_store`, `context_set`).
     *
     * @returns Array of tool definitions (empty array if no tools)
     */
    getTools(): ToolFunction[];
    /**
     * Cleanup resources when context is destroyed.
     *
     * Called when AgentContextNextGen.destroy() is invoked.
     * Use for releasing resources, closing connections, etc.
     */
    destroy(): void;
    /**
     * Serialize plugin state for session persistence.
     *
     * **MUST be synchronous.** Return a JSON-serializable object representing
     * the plugin's current state. This is called when saving a session.
     *
     * For plugins with async data (e.g., external storage), return only
     * references/keys here and handle async restoration separately.
     *
     * @returns Serializable state object
     *
     * @example
     * ```typescript
     * getState(): unknown {
     *   return {
     *     entries: [...this._entries].map(([k, v]) => ({ key: k, ...v })),
     *     version: 1,  // Include version for future migrations
     *   };
     * }
     * ```
     */
    getState(): unknown;
    /**
     * Restore plugin state from serialized data.
     *
     * Called when loading a saved session. The state comes from a previous
     * `getState()` call on the same plugin type.
     *
     * **IMPORTANT:** Call `invalidateTokenCache()` after restoring state
     * to ensure token counts are recalculated.
     *
     * @param state - Previously serialized state from getState()
     *
     * @example
     * ```typescript
     * restoreState(state: unknown): void {
     *   const s = state as { entries: Array<{ key: string; value: unknown }> };
     *   this._entries.clear();
     *   for (const entry of s.entries || []) {
     *     this._entries.set(entry.key, entry);
     *   }
     *   this.invalidateTokenCache(); // IMPORTANT: refresh token cache
     * }
     * ```
     */
    restoreState(state: unknown): void;
}
/**
 * Token budget breakdown - clear and simple
 */
interface ContextBudget$1 {
    /** Maximum context tokens for the model */
    maxTokens: number;
    /** Tokens reserved for LLM response */
    responseReserve: number;
    /** Tokens used by system message (prompt + instructions + plugin content) */
    systemMessageTokens: number;
    /** Tokens used by tool definitions (NEVER compacted) */
    toolsTokens: number;
    /** Tokens used by conversation history */
    conversationTokens: number;
    /** Tokens used by current input (user message or tool results) */
    currentInputTokens: number;
    /** Total tokens used */
    totalUsed: number;
    /** Available tokens (maxTokens - responseReserve - totalUsed) */
    available: number;
    /** Usage percentage (totalUsed / (maxTokens - responseReserve)) */
    utilizationPercent: number;
    /** Breakdown by component for debugging */
    breakdown: {
        systemPrompt: number;
        persistentInstructions: number;
        pluginInstructions: number;
        pluginContents: Record<string, number>;
        tools: number;
        conversation: number;
        currentInput: number;
    };
}
/**
 * Result of prepare() - ready for LLM call
 */
interface PreparedContext {
    /** Final input items array for LLM */
    input: InputItem[];
    /** Token budget breakdown */
    budget: ContextBudget$1;
    /** Whether compaction was performed */
    compacted: boolean;
    /** Log of compaction actions taken */
    compactionLog: string[];
}
/**
 * Result of handling oversized current input
 */
interface OversizedInputResult {
    /** Whether the input was accepted (possibly truncated) */
    accepted: boolean;
    /** Processed content (truncated if needed) */
    content: string;
    /** Error message if rejected */
    error?: string;
    /** Warning message if truncated */
    warning?: string;
    /** Original size in bytes */
    originalSize: number;
    /** Final size in bytes */
    finalSize: number;
}
/**
 * Feature flags for enabling/disabling plugins
 */
interface ContextFeatures {
    /** Enable WorkingMemory plugin (default: true) */
    workingMemory?: boolean;
    /** Enable InContextMemory plugin (default: false) */
    inContextMemory?: boolean;
    /** Enable PersistentInstructions plugin (default: false) */
    persistentInstructions?: boolean;
}
/**
 * Default feature configuration
 */
declare const DEFAULT_FEATURES: Required<ContextFeatures>;
/**
 * Plugin configurations for auto-initialization.
 * When features are enabled, plugins are created with these configs.
 * The config shapes match each plugin's constructor parameter.
 */
interface PluginConfigs {
    /**
     * Working memory plugin config (used when features.workingMemory=true).
     * See WorkingMemoryPluginConfig for full options.
     */
    workingMemory?: Record<string, unknown>;
    /**
     * In-context memory plugin config (used when features.inContextMemory=true).
     * See InContextMemoryConfig for full options.
     */
    inContextMemory?: Record<string, unknown>;
    /**
     * Persistent instructions plugin config (used when features.persistentInstructions=true).
     * Note: agentId is auto-filled from context config if not provided.
     * See PersistentInstructionsConfig for full options.
     */
    persistentInstructions?: Record<string, unknown>;
}
/**
 * AgentContextNextGen configuration
 */
interface AgentContextNextGenConfig {
    /** Model name (used for context window lookup) */
    model: string;
    /** Maximum context tokens (auto-detected from model if not provided) */
    maxContextTokens?: number;
    /** Tokens to reserve for response (default: 4096) */
    responseReserve?: number;
    /** System prompt provided by user */
    systemPrompt?: string;
    /**
     * Compaction strategy name (default: 'default').
     * Used to create strategy from StrategyRegistry if compactionStrategy not provided.
     */
    strategy?: string;
    /**
     * Custom compaction strategy instance.
     * If provided, overrides the `strategy` option.
     */
    compactionStrategy?: ICompactionStrategy;
    /** Feature flags */
    features?: ContextFeatures;
    /** Agent ID (required for PersistentInstructions) */
    agentId?: string;
    /** User ID for multi-user scenarios. Automatically flows to ToolContext for all tool executions. */
    userId?: string;
    /**
     * Restrict this agent to a subset of registered connectors (by name).
     * When set, only these connectors are visible in ToolContext.connectorRegistry
     * and in dynamic tool descriptions (e.g., execute_javascript).
     * When not set, all connectors visible to the current userId are available.
     */
    connectors?: string[];
    /** Initial tools to register */
    tools?: ToolFunction[];
    /** Storage for session persistence */
    storage?: IContextStorage;
    /** Plugin-specific configurations (used with features flags) */
    plugins?: PluginConfigs;
    /**
     * Hard timeout in milliseconds for any single tool execution.
     * Acts as a safety net: if a tool's own timeout mechanism fails
     * (e.g. a child process doesn't exit), this will force-resolve with an error.
     * Default: 0 (disabled - relies on each tool's own timeout)
     */
    toolExecutionTimeout?: number;
}
/**
 * Default configuration values
 */
declare const DEFAULT_CONFIG: {
    responseReserve: number;
    strategy: string;
};

/**
 * Events emitted by AgentContextNextGen
 */
interface ContextEvents {
    /** Emitted when context is prepared */
    'context:prepared': {
        budget: ContextBudget$1;
        compacted: boolean;
    };
    /** Emitted when compaction is performed */
    'context:compacted': {
        tokensFreed: number;
        log: string[];
    };
    /** Emitted right after budget is calculated in prepare() - for reactive monitoring */
    'budget:updated': {
        budget: ContextBudget$1;
        timestamp: number;
    };
    /** Emitted when budget reaches warning threshold (>70%) */
    'budget:warning': {
        budget: ContextBudget$1;
    };
    /** Emitted when budget reaches critical threshold (>90%) */
    'budget:critical': {
        budget: ContextBudget$1;
    };
    /** Emitted when compaction is about to start */
    'compaction:starting': {
        budget: ContextBudget$1;
        targetTokensToFree: number;
        timestamp: number;
    };
    /** Emitted when current input is too large */
    'input:oversized': {
        result: OversizedInputResult;
    };
    /** Emitted when a message is added */
    'message:added': {
        role: string;
        index: number;
    };
    /** Emitted when conversation is cleared */
    'conversation:cleared': {
        reason?: string;
    };
}
/**
 * Callback type for beforeCompaction hook.
 * Called before compaction starts, allowing agents to save important data.
 */
type BeforeCompactionCallback = (info: {
    budget: ContextBudget$1;
    targetTokensToFree: number;
    strategy: string;
}) => Promise<void>;
/**
 * Result of compact() operation.
 */
interface CompactionResult {
    /** Tokens actually freed by compaction */
    tokensFreed: number;
    /** Number of messages removed from conversation */
    messagesRemoved: number;
    /** Names of plugins that were compacted */
    pluginsCompacted: string[];
    /** Log of actions taken during compaction */
    log: string[];
}
/**
 * Result of consolidate() operation.
 */
interface ConsolidationResult {
    /** Whether any consolidation was performed */
    performed: boolean;
    /** Net token change (negative = freed, positive = added, e.g., summaries) */
    tokensChanged: number;
    /** Description of actions taken */
    actions: string[];
}
/**
 * Read-only context passed to compaction strategies.
 * Provides access to data needed for compaction decisions and
 * controlled methods to modify state.
 */
interface CompactionContext {
    /** Current budget (from prepare) */
    readonly budget: ContextBudget$1;
    /** Current conversation history (read-only) */
    readonly conversation: ReadonlyArray<InputItem>;
    /** Current input (read-only) */
    readonly currentInput: ReadonlyArray<InputItem>;
    /** Registered plugins (for querying state) */
    readonly plugins: ReadonlyArray<IContextPluginNextGen>;
    /** Strategy name for logging */
    readonly strategyName: string;
    /**
     * Remove messages by indices.
     * Handles tool pair preservation internally.
     *
     * @param indices - Array of message indices to remove
     * @returns Tokens actually freed
     */
    removeMessages(indices: number[]): Promise<number>;
    /**
     * Compact a specific plugin.
     *
     * @param pluginName - Name of the plugin to compact
     * @param targetTokens - Approximate tokens to free
     * @returns Tokens actually freed
     */
    compactPlugin(pluginName: string, targetTokens: number): Promise<number>;
    /**
     * Estimate tokens for an item.
     *
     * @param item - Input item to estimate
     * @returns Estimated token count
     */
    estimateTokens(item: InputItem): number;
}
/**
 * Compaction strategy interface.
 *
 * Strategies implement two methods:
 * - `compact()`: Emergency compaction when thresholds exceeded (called from prepare())
 * - `consolidate()`: Post-cycle cleanup and optimization (called after agentic loop)
 *
 * Use `compact()` for quick, threshold-based token reduction.
 * Use `consolidate()` for more expensive operations like summarization.
 */
interface ICompactionStrategy {
    /** Strategy name (unique identifier) for identification and logging */
    readonly name: string;
    /** Human-readable display name for UI */
    readonly displayName: string;
    /** Description explaining the strategy behavior */
    readonly description: string;
    /** Threshold percentage (0-1) at which compact() is triggered */
    readonly threshold: number;
    /**
     * Plugin names this strategy requires to function.
     * Validation is performed when strategy is assigned to context.
     * If any required plugin is missing, an error is thrown.
     *
     * @example
     * ```typescript
     * readonly requiredPlugins = ['working_memory'] as const;
     * ```
     */
    readonly requiredPlugins?: readonly string[];
    /**
     * Emergency compaction - triggered when context usage exceeds threshold.
     * Called from prepare() when utilization > threshold.
     *
     * Should be fast and focus on freeing tokens quickly.
     *
     * @param context - Compaction context with controlled access to state
     * @param targetToFree - Approximate tokens to free
     * @returns Result describing what was done
     */
    compact(context: CompactionContext, targetToFree: number): Promise<CompactionResult>;
    /**
     * Post-cycle consolidation - run after agentic cycle completes.
     * Called from Agent after run()/stream() finishes (before session save).
     *
     * Use for more expensive operations:
     * - Summarizing long conversations
     * - Memory optimization and deduplication
     * - Promoting important data to persistent storage
     *
     * @param context - Compaction context with controlled access to state
     * @returns Result describing what was done
     */
    consolidate(context: CompactionContext): Promise<ConsolidationResult>;
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

interface SerializedWorkingMemoryState {
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
type EvictionStrategy$1 = 'lru' | 'size';
interface WorkingMemoryPluginConfig {
    /** Memory configuration */
    config?: WorkingMemoryConfig;
    /** Storage backend (default: InMemoryStorage) */
    storage?: IMemoryStorage;
    /** Priority calculator (default: staticPriorityCalculator) */
    priorityCalculator?: PriorityCalculator;
}
declare class WorkingMemoryPluginNextGen implements IContextPluginNextGen {
    readonly name = "working_memory";
    private storage;
    private config;
    private priorityCalculator;
    private priorityContext;
    private estimator;
    private _destroyed;
    private _tokenCache;
    private _instructionsTokenCache;
    /**
     * Synchronous snapshot of entries for getState() serialization.
     * Updated on every mutation (store, delete, evict, cleanupRaw, restoreState).
     * Solves the async/sync mismatch: IMemoryStorage.getAll() is async but
     * IContextPluginNextGen.getState() must be sync.
     */
    private _syncEntries;
    constructor(pluginConfig?: WorkingMemoryPluginConfig);
    getInstructions(): string;
    getContent(): Promise<string | null>;
    getContents(): unknown;
    getTokenSize(): number;
    getInstructionsTokenSize(): number;
    isCompactable(): boolean;
    compact(_targetTokensToFree: number): Promise<number>;
    getTools(): ToolFunction[];
    destroy(): void;
    getState(): SerializedWorkingMemoryState;
    restoreState(state: unknown): void;
    /**
     * Store a value in memory
     */
    store(key: string, description: string, value: unknown, options?: {
        scope?: MemoryScope;
        priority?: MemoryPriority;
        tier?: MemoryTier;
        pinned?: boolean;
    }): Promise<{
        key: string;
        sizeBytes: number;
    }>;
    /**
     * Retrieve a value from memory
     */
    retrieve(key: string): Promise<unknown | undefined>;
    /**
     * Delete a key from memory
     */
    delete(key: string): Promise<boolean>;
    /**
     * Query memory entries
     */
    query(options?: {
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
        stats?: {
            count: number;
            totalBytes: number;
        };
    }>;
    /**
     * Format memory index for context
     */
    formatIndex(): Promise<string>;
    /**
     * Evict entries to free space
     */
    evict(count: number, strategy?: EvictionStrategy$1): Promise<string[]>;
    /**
     * Cleanup raw tier entries
     */
    cleanupRaw(): Promise<{
        deleted: number;
        keys: string[];
    }>;
    private computePriority;
    /**
     * Build a MemoryIndex from raw entries
     */
    private buildMemoryIndex;
    private ensureCapacity;
    private assertNotDestroyed;
    private createMemoryStoreTool;
    private createMemoryRetrieveTool;
    private createMemoryDeleteTool;
    private createMemoryQueryTool;
    private createMemoryCleanupRawTool;
}

/**
 * Next-generation context manager for AI agents.
 *
 * Usage:
 * ```typescript
 * const ctx = AgentContextNextGen.create({
 *   model: 'gpt-4',
 *   systemPrompt: 'You are a helpful assistant.',
 *   features: { workingMemory: true },
 * });
 *
 * // Add user message
 * ctx.addUserMessage('Hello!');
 *
 * // Prepare for LLM call (handles compaction if needed)
 * const { input, budget } = await ctx.prepare();
 *
 * // Call LLM with input...
 *
 * // Add assistant response
 * ctx.addAssistantResponse(response.output);
 * ```
 */
declare class AgentContextNextGen extends EventEmitter<ContextEvents> {
    /** Configuration */
    private readonly _config;
    /** Maximum context tokens for the model */
    private readonly _maxContextTokens;
    /** Compaction strategy */
    private _compactionStrategy;
    /** System prompt (user-provided) */
    private _systemPrompt;
    /** Conversation history (excludes current input) */
    private _conversation;
    /** Current input (pending, will be added to conversation after LLM response) */
    private _currentInput;
    /** Registered plugins */
    private readonly _plugins;
    /** Tool manager */
    private readonly _tools;
    /** Token estimator for conversation/input */
    private readonly _estimator;
    /** Session ID (if loaded/saved) */
    private _sessionId;
    /** Agent ID */
    private readonly _agentId;
    /** User ID for multi-user scenarios */
    private _userId;
    /** Allowed connector names (when agent is restricted to a subset) */
    private _allowedConnectors;
    /** Storage backend */
    private readonly _storage?;
    /** Destroyed flag */
    private _destroyed;
    /** Cached budget from last prepare() call */
    private _cachedBudget;
    /** Callback for beforeCompaction hook (set by Agent) */
    private _beforeCompactionCallback;
    /**
     * Create a new AgentContextNextGen instance.
     */
    static create(config: AgentContextNextGenConfig): AgentContextNextGen;
    private constructor();
    /**
     * Initialize plugins based on feature flags.
     * Called automatically in constructor.
     */
    private initializePlugins;
    /**
     * Validate that a strategy's required plugins are registered.
     * @throws Error if any required plugin is missing
     */
    private validateStrategyDependencies;
    /**
     * Sync identity fields and connector registry to ToolContext.
     * Merges with existing ToolContext to preserve other fields (memory, signal, taskId).
     *
     * Connector registry resolution order:
     * 1. If `connectors` (allowed names) is set → filtered view of global registry
     * 2. If access policy + userId → scoped view via Connector.scoped()
     * 3. Otherwise → full global registry
     */
    private syncToolContext;
    /**
     * Build the connector registry appropriate for this agent's config.
     */
    private buildConnectorRegistry;
    /** Get the tool manager */
    get tools(): ToolManager;
    /** Get the model name */
    get model(): string;
    /** Get the agent ID */
    get agentId(): string;
    /** Get the current user ID */
    get userId(): string | undefined;
    /** Set user ID. Automatically updates ToolContext for all tool executions. */
    set userId(value: string | undefined);
    /** Get the allowed connector names (undefined = all visible connectors) */
    get connectors(): string[] | undefined;
    /** Set allowed connector names. Updates ToolContext.connectorRegistry. */
    set connectors(value: string[] | undefined);
    /** Get/set system prompt */
    get systemPrompt(): string | undefined;
    set systemPrompt(value: string | undefined);
    /** Get feature configuration */
    get features(): Required<ContextFeatures>;
    /** Check if destroyed */
    get isDestroyed(): boolean;
    /** Get current session ID */
    get sessionId(): string | null;
    /** Get storage (null if not configured) */
    get storage(): IContextStorage | null;
    /** Get max context tokens */
    get maxContextTokens(): number;
    /** Get response reserve tokens */
    get responseReserve(): number;
    /** Get current tools token usage (useful for debugging) */
    get toolsTokens(): number;
    /**
     * Get the cached budget from the last prepare() call.
     * Returns null if prepare() hasn't been called yet.
     */
    get lastBudget(): ContextBudget$1 | null;
    /**
     * Get the current compaction strategy.
     */
    get compactionStrategy(): ICompactionStrategy;
    /**
     * Set the compaction strategy.
     * Can be changed at runtime to switch compaction behavior.
     */
    setCompactionStrategy(strategy: ICompactionStrategy): void;
    /**
     * Set the beforeCompaction callback.
     * Called by Agent to wire up lifecycle hooks.
     */
    setBeforeCompactionCallback(callback: BeforeCompactionCallback | null): void;
    /**
     * Get working memory plugin (if registered).
     * This is a compatibility accessor for code expecting ctx.memory
     */
    get memory(): WorkingMemoryPluginNextGen | null;
    /**
     * Get the last message (most recent user message or tool results).
     * Used for compatibility with old code that expected a single item.
     */
    getLastUserMessage(): InputItem | null;
    /**
     * Set current input (user message).
     * Adds a user message to the conversation and sets it as the current input for prepare().
     */
    setCurrentInput(content: string | Content[]): void;
    /**
     * Add multiple input items to conversation (legacy compatibility).
     */
    addInputItems(items: InputItem[]): void;
    /**
     * Legacy alias for prepare() - returns prepared context.
     */
    prepareConversation(): Promise<PreparedContext>;
    /**
     * Add a message (legacy compatibility).
     * For user messages, use addUserMessage instead.
     * For assistant messages, use addAssistantResponse instead.
     */
    addMessage(role: 'user' | 'assistant', content: string | Content[]): string;
    /**
     * Register a plugin.
     * Plugin's tools are automatically registered with ToolManager.
     */
    registerPlugin(plugin: IContextPluginNextGen): void;
    /**
     * Get a plugin by name.
     */
    getPlugin<T extends IContextPluginNextGen>(name: string): T | null;
    /**
     * Check if a plugin is registered.
     */
    hasPlugin(name: string): boolean;
    /**
     * Get all registered plugins.
     */
    getPlugins(): IContextPluginNextGen[];
    /**
     * Add a user message.
     * Returns the message ID.
     */
    addUserMessage(content: string | Content[]): string;
    /**
     * Add assistant response (from LLM output).
     * Also moves current input to conversation history.
     * Returns the message ID.
     */
    addAssistantResponse(output: OutputItem[]): string;
    /**
     * Add tool results.
     * Returns the message ID.
     */
    addToolResults(results: ToolResult[]): string;
    /**
     * Get conversation history (read-only).
     */
    getConversation(): ReadonlyArray<InputItem>;
    /**
     * Get current input (read-only).
     */
    getCurrentInput(): ReadonlyArray<InputItem>;
    /**
     * Get conversation length.
     */
    getConversationLength(): number;
    /**
     * Clear conversation history.
     */
    clearConversation(reason?: string): void;
    /**
     * Prepare context for LLM call.
     *
     * This method:
     * 1. Calculates tool definition tokens (never compacted)
     * 2. Builds the system message from all components
     * 3. Calculates token budget
     * 4. Handles oversized current input if needed
     * 5. Runs compaction if needed
     * 6. Returns final InputItem[] ready for LLM
     *
     * IMPORTANT: Call this ONCE right before each LLM call!
     */
    prepare(): Promise<PreparedContext>;
    /**
     * Build the system message containing all context components.
     */
    private buildSystemMessage;
    /**
     * Format plugin name for display (e.g., 'working_memory' -> 'Working Memory')
     */
    private formatPluginName;
    /**
     * Calculate tokens used by tool definitions.
     * Tools are sent separately to the LLM and take up context space.
     */
    private calculateToolsTokens;
    /**
     * Calculate tokens for conversation history.
     */
    private calculateConversationTokens;
    /**
     * Calculate tokens for current input.
     */
    private calculateInputTokens;
    /**
     * Estimate tokens for a single InputItem.
     */
    private estimateItemTokens;
    /**
     * Estimate tokens for a single image, using the estimator's image method if available.
     */
    private _estimateImageTokens;
    /**
     * Run compaction to free up tokens.
     * Delegates to the current compaction strategy.
     * Returns total tokens freed.
     */
    private runCompaction;
    /**
     * Run post-cycle consolidation.
     * Called by Agent after agentic cycle completes (before session save).
     *
     * Delegates to the current compaction strategy's consolidate() method.
     * Use for more expensive operations like summarization.
     */
    consolidate(): Promise<ConsolidationResult>;
    /**
     * Build CompactionContext for strategy.
     * Provides controlled access to context state.
     */
    private buildCompactionContext;
    /**
     * Remove messages by indices.
     * Handles tool pair preservation internally.
     * Used by CompactionContext.removeMessages().
     */
    private removeMessagesByIndices;
    /**
     * Sanitize tool pairs in the input array.
     * Removes orphan TOOL_USE (no matching TOOL_RESULT) and
     * orphan TOOL_RESULT (no matching TOOL_USE).
     *
     * This is CRITICAL - LLM APIs require matching pairs.
     */
    private sanitizeToolPairs;
    /**
     * Handle oversized current input.
     */
    private handleOversizedInput;
    /**
     * Emergency truncation of tool results to fit in context.
     */
    private emergencyToolResultsTruncation;
    /**
     * Check if content appears to be binary (base64, etc.)
     */
    private isBinaryContent;
    /**
     * Save context state to storage.
     *
     * @param sessionId - Optional session ID (uses current or generates new)
     * @param metadata - Optional additional metadata to merge
     * @param stateOverride - Optional state override (for agent-level state injection)
     */
    save(sessionId?: string, metadata?: Record<string, unknown>, stateOverride?: SerializedContextState): Promise<void>;
    /**
     * Load context state from storage.
     */
    load(sessionId: string): Promise<boolean>;
    /**
     * Load raw state from storage without restoring.
     * Used by BaseAgent for custom state restoration.
     */
    loadRaw(sessionId: string): Promise<{
        state: SerializedContextState;
        stored: StoredContextSession;
    } | null>;
    /**
     * Check if session exists in storage.
     */
    sessionExists(sessionId: string): Promise<boolean>;
    /**
     * Delete a session from storage.
     */
    deleteSession(sessionId?: string): Promise<void>;
    /**
     * Get serialized state for persistence.
     * Used by BaseAgent to inject agent-level state.
     */
    getState(): SerializedContextState;
    /**
     * Restore state from serialized form.
     * Used by BaseAgent for custom state restoration.
     */
    restoreState(state: SerializedContextState): void;
    /**
     * Get the current token budget.
     *
     * Returns the cached budget from the last prepare() call if available.
     * If prepare() hasn't been called yet, calculates a fresh budget.
     *
     * For monitoring purposes, prefer using the `lastBudget` getter or
     * subscribing to the `budget:updated` event for reactive updates.
     *
     * @returns Current token budget breakdown
     */
    calculateBudget(): Promise<ContextBudget$1>;
    /**
     * Get the current strategy threshold (percentage at which compaction triggers).
     */
    get strategyThreshold(): number;
    /**
     * Get the current strategy name.
     */
    get strategy(): string;
    /**
     * Generate unique ID.
     */
    private generateId;
    /**
     * Assert context is not destroyed.
     */
    private assertNotDestroyed;
    /**
     * Destroy context and release resources.
     */
    destroy(): void;
}

/**
 * Session configuration using AgentContext persistence
 */
interface BaseSessionConfig {
    /** Storage backend for context sessions */
    storage: IContextStorage;
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
 * Context passed to beforeCompaction hook
 */
interface BeforeCompactionContext {
    /** Agent identifier */
    agentId: string;
    /** Current context budget info */
    currentBudget: {
        total: number;
        used: number;
        available: number;
        utilizationPercent: number;
        status: 'ok' | 'warning' | 'critical';
    };
    /** Compaction strategy being used */
    strategy: string;
    /** Current context components (read-only) */
    components: ReadonlyArray<{
        name: string;
        priority: number;
        compactable: boolean;
    }>;
    /** Estimated tokens to be freed */
    estimatedTokensToFree: number;
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
     * Called before context compaction occurs.
     * Use this hook to save important data to working memory before it's compacted.
     * This is your last chance to preserve critical information from tool outputs
     * or conversation history that would otherwise be lost.
     *
     * @param context - Compaction context with budget info and components
     * @returns Promise that resolves when hook completes
     */
    beforeCompaction?: (context: BeforeCompactionContext) => Promise<void>;
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
    /** Optional scoped connector registry for access-controlled lookup */
    registry?: IConnectorRegistry;
    /** Agent name (optional, auto-generated if not provided) */
    name?: string;
    /** User ID for multi-user scenarios. Flows to ToolContext automatically for all tool executions. */
    userId?: string;
    /**
     * Restrict this agent to a subset of registered connectors (by name).
     * Only these connectors will be visible in tool descriptions and sandbox execution.
     * When not set, all connectors visible to the current userId are available.
     */
    connectors?: string[];
    /** Tools available to the agent */
    tools?: ToolFunction[];
    /** Provide a pre-configured ToolManager (advanced) */
    toolManager?: ToolManager;
    /** Session configuration (uses AgentContext persistence) */
    session?: BaseSessionConfig;
    /** Permission configuration */
    permissions?: AgentPermissionsConfig;
    /** Lifecycle hooks for customization */
    lifecycleHooks?: AgentLifecycleHooks;
    /**
     * Hard timeout in milliseconds for any single tool execution.
     * Acts as a safety net at the ToolManager level: if a tool's own timeout
     * mechanism fails, this will force-reject with an error.
     * Default: 0 (disabled - relies on each tool's own timeout).
     */
    toolExecutionTimeout?: number;
    /**
     * Optional AgentContextNextGen configuration.
     * If provided as AgentContextNextGen instance, it will be used directly.
     * If provided as config object, a new AgentContextNextGen will be created.
     * If not provided, a default AgentContextNextGen will be created.
     */
    context?: AgentContextNextGen | AgentContextNextGenConfig;
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
 * Options for direct LLM calls (bypassing AgentContext).
 */
interface DirectCallOptions {
    /** System instructions (optional) */
    instructions?: string;
    /** Include registered tools in the call. Default: false */
    includeTools?: boolean;
    /** Temperature for generation */
    temperature?: number;
    /** Maximum output tokens */
    maxOutputTokens?: number;
    /** Response format (text, json_object, json_schema) */
    responseFormat?: {
        type: 'text' | 'json_object' | 'json_schema';
        json_schema?: unknown;
    };
    /** Vendor-specific options */
    vendorOptions?: Record<string, unknown>;
}
/**
 * Abstract base class for all agent types.
 *
 * @internal This class is not exported in the public API.
 *
 * Note: TEvents is not constrained to BaseAgentEvents to allow subclasses
 * to define their own event interfaces (e.g., AgentEvents for Agent).
 */
declare abstract class BaseAgent<TConfig extends BaseAgentConfig = BaseAgentConfig, TEvents extends Record<string, any> = BaseAgentEvents> extends EventEmitter<TEvents> {
    readonly name: string;
    readonly connector: Connector;
    readonly model: string;
    protected _config: TConfig;
    protected _agentContext: AgentContextNextGen;
    protected _permissionManager: ToolPermissionManager;
    protected _isDestroyed: boolean;
    protected _cleanupCallbacks: Array<() => void | Promise<void>>;
    protected _logger: FrameworkLogger;
    protected _lifecycleHooks: AgentLifecycleHooks;
    protected _sessionConfig: BaseSessionConfig | null;
    protected _autoSaveInterval: ReturnType<typeof setInterval> | null;
    protected _pendingSessionLoad: Promise<boolean> | null;
    /** Whether caller provided explicit instructions/systemPrompt (takes precedence over saved session) */
    protected _hasExplicitInstructions: boolean;
    protected _provider: ITextProvider;
    constructor(config: TConfig, loggerComponent: string);
    /**
     * Get the agent type identifier
     */
    protected abstract getAgentType(): 'agent' | 'task-agent' | 'universal-agent';
    /**
     * Resolve connector from string name or instance
     */
    protected resolveConnector(ref: string | Connector): Connector;
    /**
     * Initialize AgentContextNextGen (single source of truth for tools and sessions).
     * If AgentContextNextGen is provided, use it directly.
     * Otherwise, create a new one with the provided configuration.
     */
    protected initializeAgentContext(config: TConfig): AgentContextNextGen;
    /**
     * Initialize permission manager
     */
    protected initializePermissionManager(config?: AgentPermissionsConfig, tools?: ToolFunction[]): ToolPermissionManager;
    /**
     * Initialize session management (call from subclass constructor after other setup)
     * Now uses AgentContext.save()/load() for persistence.
     */
    protected initializeSession(sessionConfig?: BaseSessionConfig): void;
    /**
     * Ensure any pending session load is complete
     */
    protected ensureSessionLoaded(): Promise<void>;
    /**
     * Get the current session ID (if session is enabled)
     * Delegates to AgentContext.
     */
    getSessionId(): string | null;
    /**
     * Check if this agent has session support enabled
     */
    hasSession(): boolean;
    /**
     * Save the current session to storage.
     * Uses getContextState() to get state, allowing subclasses to inject agent-level state.
     *
     * @param sessionId - Optional session ID (uses current or generates new)
     * @param metadata - Optional session metadata
     * @throws Error if storage is not configured
     */
    saveSession(sessionId?: string, metadata?: ContextSessionMetadata): Promise<void>;
    /**
     * Load a session from storage.
     * Uses restoreContextState() to restore state, allowing subclasses to restore agent-level state.
     *
     * @param sessionId - Session ID to load
     * @returns true if session was found and loaded, false if not found
     * @throws Error if storage is not configured
     */
    loadSession(sessionId: string): Promise<boolean>;
    /**
     * Check if a session exists in storage.
     * Delegates to AgentContext.sessionExists().
     */
    sessionExists(sessionId: string): Promise<boolean>;
    /**
     * Delete a session from storage.
     * Delegates to AgentContext.deleteSession().
     */
    deleteSession(sessionId?: string): Promise<void>;
    /**
     * Get context state for session persistence.
     * Override in subclasses to include agent-specific state in agentState field.
     */
    getContextState(): Promise<SerializedContextState>;
    /**
     * Restore context from saved state.
     * Override in subclasses to restore agent-specific state from agentState field.
     * Preserves explicit instructions if caller provided them at construction time.
     */
    restoreContextState(state: SerializedContextState): Promise<void>;
    /**
     * Advanced tool management. Returns ToolManager for fine-grained control.
     * This is delegated to AgentContextNextGen.tools (single source of truth).
     */
    get tools(): ToolManager;
    /**
     * Get the AgentContextNextGen (unified context management).
     * This is the primary way to access tools, memory, and history.
     */
    get context(): AgentContextNextGen;
    /**
     * Get the current user ID. Delegates to AgentContextNextGen.
     */
    get userId(): string | undefined;
    /**
     * Set user ID at runtime. Automatically updates ToolContext for all tool executions.
     */
    set userId(value: string | undefined);
    /**
     * Get the allowed connector names (undefined = all visible connectors).
     */
    get connectors(): string[] | undefined;
    /**
     * Restrict this agent to a subset of connectors. Updates ToolContext.connectorRegistry.
     */
    set connectors(value: string[] | undefined);
    /**
     * Permission management. Returns ToolPermissionManager for approval control.
     */
    get permissions(): ToolPermissionManager;
    /**
     * Add a tool to the agent.
     * Tools are registered with AgentContext (single source of truth).
     */
    addTool(tool: ToolFunction): void;
    /**
     * Remove a tool from the agent.
     * Tools are unregistered from AgentContext (single source of truth).
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
     *
     * If a tool has a `descriptionFactory`, it's called to generate a dynamic description
     * that reflects current state (e.g., available connectors). This ensures the LLM
     * always sees up-to-date tool descriptions.
     */
    protected getEnabledToolDefinitions(): FunctionToolDefinition[];
    /**
     * Get the provider for LLM calls.
     * Returns the single shared provider instance.
     */
    protected getProvider(): ITextProvider;
    /**
     * Make a direct LLM call bypassing all context management.
     *
     * This method:
     * - Does NOT track messages in history
     * - Does NOT use AgentContext features (memory, cache, etc.)
     * - Does NOT prepare context or run compaction
     * - Does NOT go through the agentic loop (no tool execution)
     *
     * Use this for simple, stateless interactions where you want raw LLM access
     * without the overhead of context management.
     *
     * @param input - Text string or array of InputItems (supports multimodal: text + images)
     * @param options - Optional configuration for the call
     * @returns Raw LLM response
     *
     * @example
     * ```typescript
     * // Simple text call
     * const response = await agent.runDirect('What is 2 + 2?');
     * console.log(response.output_text);
     *
     * // With options
     * const response = await agent.runDirect('Summarize this', {
     *   instructions: 'Be concise',
     *   temperature: 0.5,
     * });
     *
     * // Multimodal (text + image)
     * const response = await agent.runDirect([
     *   { type: 'message', role: 'user', content: [
     *     { type: 'input_text', text: 'What is in this image?' },
     *     { type: 'input_image', image_url: 'https://...' }
     *   ]}
     * ]);
     *
     * // With tools (single call, no loop)
     * const response = await agent.runDirect('Get the weather', {
     *   includeTools: true,
     * });
     * // Note: If the LLM returns a tool call, you must handle it yourself
     * ```
     */
    runDirect(input: string | InputItem[], options?: DirectCallOptions): Promise<LLMResponse>;
    /**
     * Stream a direct LLM call bypassing all context management.
     *
     * Same as runDirect but returns a stream of events instead of waiting
     * for the complete response. Useful for real-time output display.
     *
     * @param input - Text string or array of InputItems (supports multimodal)
     * @param options - Optional configuration for the call
     * @returns Async iterator of stream events
     *
     * @example
     * ```typescript
     * for await (const event of agent.streamDirect('Tell me a story')) {
     *   if (event.type === 'output_text_delta') {
     *     process.stdout.write(event.delta);
     *   }
     * }
     * ```
     */
    streamDirect(input: string | InputItem[], options?: DirectCallOptions): AsyncIterableIterator<StreamEvent>;
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
     * Invoke beforeCompaction hook if defined.
     * Call this before context compaction occurs.
     * Gives the agent a chance to save important data to memory.
     */
    protected invokeBeforeCompaction(context: BeforeCompactionContext): Promise<void>;
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
 * IAgentDefinitionStorage - Storage interface for Agent configuration persistence
 *
 * Provides persistence operations for agent definitions (configuration, model, system prompt, etc.).
 * This allows agents to be instantiated from stored configurations.
 *
 * This follows Clean Architecture - the interface is in domain layer,
 * implementations are in infrastructure layer.
 */

/**
 * Agent type identifier
 */
type StoredAgentType = 'agent' | 'task-agent' | 'universal-agent' | 'research-agent' | string;
/**
 * Stored agent definition - everything needed to recreate an agent
 */
interface StoredAgentDefinition {
    /** Format version for migration support */
    version: number;
    /** Unique agent identifier */
    agentId: string;
    /** Human-readable agent name */
    name: string;
    /** Agent type */
    agentType: StoredAgentType;
    /** When the definition was created */
    createdAt: string;
    /** When the definition was last updated */
    updatedAt: string;
    /** Connector configuration */
    connector: {
        /** Connector name (must be registered at runtime) */
        name: string;
        /** Model to use */
        model: string;
    };
    /** System prompt */
    systemPrompt?: string;
    /** Instructions */
    instructions?: string;
    /** Feature configuration */
    features?: ContextFeatures;
    /** Agent metadata */
    metadata?: AgentDefinitionMetadata;
    /** Agent-type-specific configuration */
    typeConfig?: Record<string, unknown>;
}
/**
 * Agent definition metadata
 */
interface AgentDefinitionMetadata {
    /** Description of what this agent does */
    description?: string;
    /** Tags for categorization */
    tags?: string[];
    /** Author/creator */
    author?: string;
    /** Custom key-value data */
    [key: string]: unknown;
}
/**
 * Agent definition summary for listing
 */
interface AgentDefinitionSummary {
    /** Agent identifier */
    agentId: string;
    /** Agent name */
    name: string;
    /** Agent type */
    agentType: StoredAgentType;
    /** Model being used */
    model: string;
    /** When created */
    createdAt: Date;
    /** When last updated */
    updatedAt: Date;
    /** Optional metadata */
    metadata?: AgentDefinitionMetadata;
}
/**
 * Current format version for stored agent definitions
 */
declare const AGENT_DEFINITION_FORMAT_VERSION = 1;
/**
 * Storage interface for agent definitions
 *
 * Implementations:
 * - FileAgentDefinitionStorage: File-based storage at ~/.oneringai/agents/<agentId>/
 * - (Future) DatabaseAgentDefinitionStorage, etc.
 */
interface IAgentDefinitionStorage {
    /**
     * Save an agent definition
     *
     * @param definition - The agent definition to save
     */
    save(definition: StoredAgentDefinition): Promise<void>;
    /**
     * Load an agent definition
     *
     * @param agentId - Agent identifier to load
     * @returns The stored definition, or null if not found
     */
    load(agentId: string): Promise<StoredAgentDefinition | null>;
    /**
     * Delete an agent definition
     *
     * @param agentId - Agent identifier to delete
     */
    delete(agentId: string): Promise<void>;
    /**
     * Check if an agent definition exists
     *
     * @param agentId - Agent identifier to check
     */
    exists(agentId: string): Promise<boolean>;
    /**
     * List all agent definitions (summaries only)
     *
     * @param options - Optional filtering
     * @returns Array of agent summaries, sorted by updatedAt descending
     */
    list(options?: AgentDefinitionListOptions): Promise<AgentDefinitionSummary[]>;
    /**
     * Update agent definition metadata without loading full definition
     *
     * @param agentId - Agent identifier
     * @param metadata - Metadata to merge
     */
    updateMetadata?(agentId: string, metadata: Partial<AgentDefinitionMetadata>): Promise<void>;
    /**
     * Get the storage path/location (for display/debugging)
     */
    getPath(): string;
}
/**
 * Options for listing agent definitions
 */
interface AgentDefinitionListOptions {
    /** Filter by agent type */
    agentType?: StoredAgentType;
    /** Filter by tags (any match) */
    tags?: string[];
    /** Maximum number of results */
    limit?: number;
    /** Offset for pagination */
    offset?: number;
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
    vendorOptions?: Record<string, unknown>;
    /**
     * Optional unified context management.
     * When provided (as AgentContextNextGen instance or config), Agent will:
     * - Track conversation history
     * - Provide unified memory access
     * - Support session persistence via context
     *
     * Pass an AgentContextNextGen instance or AgentContextNextGenConfig to enable.
     */
    context?: AgentContextNextGen | AgentContextNextGenConfig;
    /**
     * Hard timeout in milliseconds for any single tool execution.
     * Acts as a safety net: if a tool's own timeout mechanism fails
     * (e.g. a spawned child process doesn't exit), this will force-resolve
     * with an error. Default: 0 (disabled - relies on each tool's own timeout).
     *
     * Example: `toolExecutionTimeout: 300000` (5 minutes hard cap per tool call)
     */
    toolExecutionTimeout?: number;
    /**
     * @deprecated Use `toolExecutionTimeout` instead.
     */
    toolTimeout?: number;
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
 * - Provider initialization
 * - Tool manager initialization
 * - Permission manager initialization
 * - Session management
 * - Lifecycle/cleanup
 */
declare class Agent extends BaseAgent<AgentConfig$1, AgentEvents> implements IDisposable {
    private hookManager;
    private executionContext;
    private _paused;
    private _cancelled;
    private _pausePromise;
    private _resumeCallback;
    private _pauseResumeMutex;
    /**
     * Create a new agent
     *
     * @example
     * ```typescript
     * const agent = Agent.create({
     *   connector: 'openai',  // or Connector instance
     *   model: 'gpt-4',
     *   userId: 'user-123',   // flows to all tool executions automatically
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
            storage: IContextStorage;
        };
    }): Promise<Agent>;
    /**
     * Create an agent from a stored definition
     *
     * Loads agent configuration from storage and creates a new Agent instance.
     * The connector must be registered at runtime before calling this method.
     *
     * @param agentId - Agent identifier to load
     * @param storage - Storage backend to load from
     * @param overrides - Optional config overrides
     * @returns Agent instance, or null if not found
     */
    static fromStorage(agentId: string, storage: IAgentDefinitionStorage, overrides?: Partial<AgentConfig$1>): Promise<Agent | null>;
    private constructor();
    protected getAgentType(): 'agent' | 'task-agent' | 'universal-agent';
    /**
     * Check if context management is enabled.
     * Always returns true since AgentContext is always created by BaseAgent.
     */
    hasContext(): boolean;
    /**
     * Prepare execution - shared setup for run() and stream()
     */
    private _prepareExecution;
    /**
     * Check iteration preconditions - pause, cancel, limits, hooks
     */
    private _checkIterationPreconditions;
    /**
     * Record iteration metrics and store iteration record
     */
    private _recordIterationMetrics;
    /**
     * Finalize successful execution - hooks, events, metrics
     */
    private _finalizeExecution;
    /**
     * Handle execution error - events, metrics, logging
     */
    private _handleExecutionError;
    /**
     * Cleanup execution resources
     */
    private _cleanupExecution;
    /**
     * Emit iteration complete event (helper for run loop)
     */
    private _emitIterationComplete;
    /**
     * Run the agent with input
     */
    run(input: string | InputItem[]): Promise<AgentResponse>;
    /**
     * Build tool calls array from accumulated map
     */
    private _buildToolCallsFromMap;
    /**
     * Build and add streaming assistant message to context
     */
    private _addStreamingAssistantMessage;
    /**
     * Build placeholder response for streaming finalization
     */
    private _buildPlaceholderResponse;
    /**
     * Stream response from the agent
     */
    stream(input: string | InputItem[]): AsyncIterableIterator<StreamEvent>;
    /**
     * Generate LLM response with hooks
     */
    private generateWithHooks;
    /**
     * Stream LLM response with hooks
     */
    private streamGenerateWithHooks;
    /**
     * Extract tool calls from response output
     */
    private extractToolCalls;
    /**
     * Execute tools with hooks
     */
    private executeToolsWithHooks;
    /**
     * Execute single tool with hooks
     */
    private executeToolWithHooks;
    /**
     * Check tool permission before execution
     */
    private checkToolPermission;
    /**
     * Pause execution
     */
    pause(reason?: string): void;
    /**
     * Resume execution
     */
    resume(): void;
    /**
     * Cancel execution
     */
    cancel(reason?: string): void;
    /**
     * Check if paused and wait
     */
    private checkPause;
    approveToolForSession(toolName: string): void;
    revokeToolApproval(toolName: string): void;
    getApprovedTools(): string[];
    toolNeedsApproval(toolName: string): boolean;
    toolIsBlocked(toolName: string): boolean;
    allowlistTool(toolName: string): void;
    blocklistTool(toolName: string): void;
    setModel(model: string): void;
    getTemperature(): number | undefined;
    setTemperature(temperature: number): void;
    saveDefinition(storage: IAgentDefinitionStorage, metadata?: AgentDefinitionMetadata): Promise<void>;
    getExecutionContext(): ExecutionContext | null;
    /**
     * Alias for getExecutionContext() for backward compatibility
     */
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
    getProviderCircuitBreakerMetrics(): unknown;
    getToolCircuitBreakerStates(): Map<string, CircuitState>;
    getToolCircuitBreakerMetrics(toolName: string): CircuitBreakerMetrics | undefined;
    resetToolCircuitBreaker(toolName: string): void;
    isRunning(): boolean;
    isPaused(): boolean;
    isCancelled(): boolean;
    destroy(): void;
}

/**
 * BasePluginNextGen - Base class for context plugins
 *
 * Provides common functionality:
 * - Token size tracking with caching
 * - Default implementations for optional methods
 * - Simple token estimation
 */

/**
 * Simple token estimator used by plugins.
 *
 * Uses character-based approximation (~3.5 chars/token) which is
 * accurate enough for budget management purposes. For precise
 * tokenization, you can provide a custom estimator via the
 * `estimator` protected property.
 *
 * @example
 * ```typescript
 * const tokens = simpleTokenEstimator.estimateTokens("Hello world");
 * // ~4 tokens
 *
 * const dataTokens = simpleTokenEstimator.estimateDataTokens({ key: "value" });
 * // Stringifies and estimates
 * ```
 */
declare const simpleTokenEstimator: ITokenEstimator$1;
/**
 * Base class for NextGen context plugins.
 *
 * Provides:
 * - **Token cache management** - `invalidateTokenCache()`, `updateTokenCache()`, `recalculateTokenCache()`
 * - **Simple token estimator** - `this.estimator` (can be overridden)
 * - **Default implementations** - for optional interface methods
 *
 * ## Implementing a Plugin
 *
 * ```typescript
 * class MyPlugin extends BasePluginNextGen {
 *   readonly name = 'my_plugin';
 *   private _data = new Map<string, string>();
 *
 *   // 1. Return static instructions (cached automatically)
 *   getInstructions(): string {
 *     return '## My Plugin\n\nUse my_plugin_set to store data...';
 *   }
 *
 *   // 2. Return formatted content (update token cache!)
 *   async getContent(): Promise<string | null> {
 *     if (this._data.size === 0) return null;
 *     const content = this.formatEntries();
 *     this.updateTokenCache(this.estimator.estimateTokens(content));
 *     return content;
 *   }
 *
 *   // 3. Return raw data for inspection
 *   getContents(): unknown {
 *     return Object.fromEntries(this._data);
 *   }
 *
 *   // 4. Invalidate cache when data changes
 *   set(key: string, value: string): void {
 *     this._data.set(key, value);
 *     this.invalidateTokenCache();  // <-- Important!
 *   }
 * }
 * ```
 *
 * ## Token Cache Lifecycle
 *
 * The token cache is used for budget calculation. Follow this pattern:
 *
 * 1. **When state changes** → Call `invalidateTokenCache()` to clear the cache
 * 2. **In getContent()** → Call `updateTokenCache(tokens)` before returning
 * 3. **For async recalc** → Use `recalculateTokenCache()` helper
 *
 * ```typescript
 * // Pattern 1: Invalidate on change, update in getContent
 * store(key: string, value: unknown): void {
 *   this._entries.set(key, value);
 *   this.invalidateTokenCache();  // Clear cache
 * }
 *
 * async getContent(): Promise<string | null> {
 *   const content = this.formatContent();
 *   this.updateTokenCache(this.estimator.estimateTokens(content));  // Update cache
 *   return content;
 * }
 *
 * // Pattern 2: Recalculate immediately after change
 * async store(key: string, value: unknown): Promise<void> {
 *   this._entries.set(key, value);
 *   await this.recalculateTokenCache();  // Recalc and cache
 * }
 * ```
 *
 * ## Compaction Support
 *
 * To make your plugin compactable:
 *
 * ```typescript
 * isCompactable(): boolean {
 *   return this._entries.size > 0;
 * }
 *
 * async compact(targetTokensToFree: number): Promise<number> {
 *   // Remove low-priority entries
 *   let freed = 0;
 *   for (const [key, entry] of this._entries) {
 *     if (entry.priority !== 'critical' && freed < targetTokensToFree) {
 *       freed += entry.tokens;
 *       this._entries.delete(key);
 *     }
 *   }
 *   this.invalidateTokenCache();
 *   return freed;
 * }
 * ```
 */
declare abstract class BasePluginNextGen implements IContextPluginNextGen {
    abstract readonly name: string;
    /**
     * Cached token size for content.
     * Updated via updateTokenCache(), cleared via invalidateTokenCache().
     */
    private _contentTokenCache;
    /**
     * Cached token size for instructions.
     * Computed once on first call to getInstructionsTokenSize().
     */
    private _instructionsTokenCache;
    /**
     * Token estimator instance.
     * Override this in subclass to use a custom estimator (e.g., tiktoken).
     *
     * @example
     * ```typescript
     * class MyPlugin extends BasePluginNextGen {
     *   protected estimator = myCustomTiktokenEstimator;
     * }
     * ```
     */
    protected estimator: ITokenEstimator$1;
    abstract getInstructions(): string | null;
    abstract getContent(): Promise<string | null>;
    abstract getContents(): unknown;
    /**
     * Get current token size of content.
     *
     * Returns the cached value from the last `updateTokenCache()` call.
     * Returns 0 if cache is null (content hasn't been calculated yet).
     *
     * **Note:** This is synchronous but `getContent()` is async. Plugins
     * should call `updateTokenCache()` in their `getContent()` implementation
     * to keep the cache accurate.
     *
     * @returns Cached token count (0 if cache not set)
     */
    getTokenSize(): number;
    /**
     * Get token size of instructions (cached after first call).
     *
     * Instructions are static, so this is computed once and cached permanently.
     * The cache is never invalidated since instructions don't change.
     *
     * @returns Token count for instructions (0 if no instructions)
     */
    getInstructionsTokenSize(): number;
    /**
     * Invalidate the content token cache.
     *
     * Call this when plugin state changes in a way that affects content size.
     * The next call to `getTokenSize()` will return 0 until `updateTokenCache()`
     * is called (typically in `getContent()`).
     *
     * @example
     * ```typescript
     * delete(key: string): boolean {
     *   const deleted = this._entries.delete(key);
     *   if (deleted) {
     *     this.invalidateTokenCache();  // Content changed
     *   }
     *   return deleted;
     * }
     * ```
     */
    protected invalidateTokenCache(): void;
    /**
     * Update the content token cache with a new value.
     *
     * Call this in `getContent()` after formatting content, passing the
     * estimated token count. This keeps budget calculations accurate.
     *
     * @param tokens - New token count to cache
     *
     * @example
     * ```typescript
     * async getContent(): Promise<string | null> {
     *   const content = this.formatEntries();
     *   this.updateTokenCache(this.estimator.estimateTokens(content));
     *   return content;
     * }
     * ```
     */
    protected updateTokenCache(tokens: number): void;
    /**
     * Recalculate and cache token size from current content.
     *
     * Convenience method that calls `getContent()`, estimates tokens,
     * and updates the cache. Use this when you need to immediately
     * refresh the cache after a state change.
     *
     * @returns Calculated token count
     *
     * @example
     * ```typescript
     * async store(key: string, value: unknown): Promise<void> {
     *   this._entries.set(key, value);
     *   await this.recalculateTokenCache();  // Refresh immediately
     * }
     * ```
     */
    protected recalculateTokenCache(): Promise<number>;
    /**
     * Default: not compactable.
     *
     * Override to return `true` if your plugin can reduce its content size
     * when context is tight. Also implement `compact()` to handle the actual
     * compaction logic.
     *
     * @returns false by default
     */
    isCompactable(): boolean;
    /**
     * Default: no compaction (returns 0).
     *
     * Override to implement compaction logic. Should attempt to free
     * approximately `targetTokensToFree` tokens. Remember to call
     * `invalidateTokenCache()` after modifying content.
     *
     * @param _targetTokensToFree - Approximate tokens to free (best effort)
     * @returns 0 by default (no tokens freed)
     *
     * @example
     * ```typescript
     * async compact(targetTokensToFree: number): Promise<number> {
     *   let freed = 0;
     *   // Remove entries by priority until target reached
     *   for (const [key, entry] of this.sortedByPriority()) {
     *     if (entry.priority === 'critical') continue;
     *     if (freed >= targetTokensToFree) break;
     *     freed += entry.tokens;
     *     this._entries.delete(key);
     *   }
     *   this.invalidateTokenCache();
     *   return freed;
     * }
     * ```
     */
    compact(_targetTokensToFree: number): Promise<number>;
    /**
     * Default: no tools (returns empty array).
     *
     * Override to provide plugin-specific tools. Tools are auto-registered
     * with ToolManager when the plugin is added to the context.
     *
     * Use a consistent naming convention: `<prefix>_<action>`
     * - `memory_store`, `memory_retrieve`, `memory_delete`
     * - `context_set`, `context_delete`, `context_list`
     *
     * @returns Empty array by default
     */
    getTools(): ToolFunction[];
    /**
     * Default: no-op cleanup.
     *
     * Override if your plugin has resources to release (file handles,
     * timers, connections, etc.). Called when context is destroyed.
     */
    destroy(): void;
    /**
     * Default: returns empty object.
     *
     * Override to serialize plugin state for session persistence.
     * Return a JSON-serializable object. Consider including a version
     * number for future migration support.
     *
     * @returns Empty object by default
     *
     * @example
     * ```typescript
     * getState(): unknown {
     *   return {
     *     version: 1,
     *     entries: [...this._entries].map(([k, v]) => ({ key: k, ...v })),
     *   };
     * }
     * ```
     */
    getState(): unknown;
    /**
     * Default: no-op (ignores state).
     *
     * Override to restore plugin state from saved session. The state
     * comes from a previous `getState()` call.
     *
     * **IMPORTANT:** Call `invalidateTokenCache()` after restoring state
     * to ensure token counts are recalculated on next `getContent()` call.
     *
     * @param _state - Previously serialized state from getState()
     *
     * @example
     * ```typescript
     * restoreState(state: unknown): void {
     *   const s = state as { entries: Array<{ key: string; value: unknown }> };
     *   this._entries.clear();
     *   for (const entry of s.entries || []) {
     *     this._entries.set(entry.key, entry);
     *   }
     *   this.invalidateTokenCache();  // Don't forget this!
     * }
     * ```
     */
    restoreState(_state: unknown): void;
}

/**
 * InContextMemoryPluginNextGen - In-context key-value storage for NextGen context
 *
 * Unlike WorkingMemory (external storage with index), InContextMemory stores
 * data DIRECTLY in the LLM context. Values are immediately visible.
 *
 * Use for:
 * - Current state/status that changes frequently
 * - User preferences during a session
 * - Small accumulated results
 * - Counters, flags, control variables
 *
 * Do NOT use for:
 * - Large data (use WorkingMemory)
 * - Rarely accessed reference data
 */

type InContextPriority = 'low' | 'normal' | 'high' | 'critical';
interface InContextEntry {
    key: string;
    description: string;
    value: unknown;
    updatedAt: number;
    priority: InContextPriority;
    /** If true, this entry is displayed in the user's side panel UI */
    showInUI?: boolean;
}
interface InContextMemoryConfig {
    /** Maximum number of entries (default: 20) */
    maxEntries?: number;
    /** Maximum total tokens for all entries (default: 4000) */
    maxTotalTokens?: number;
    /** Default priority for new entries (default: 'normal') */
    defaultPriority?: InContextPriority;
    /** Whether to show timestamps in output (default: false) */
    showTimestamps?: boolean;
    /** Callback fired when entries change. Receives all current entries. */
    onEntriesChanged?: (entries: InContextEntry[]) => void;
}
interface SerializedInContextMemoryState {
    entries: InContextEntry[];
}
declare class InContextMemoryPluginNextGen implements IContextPluginNextGen {
    readonly name = "in_context_memory";
    private entries;
    private config;
    private estimator;
    private _destroyed;
    private _tokenCache;
    private _instructionsTokenCache;
    private _notifyTimer;
    constructor(config?: InContextMemoryConfig);
    getInstructions(): string;
    getContent(): Promise<string | null>;
    getContents(): Map<string, InContextEntry>;
    getTokenSize(): number;
    getInstructionsTokenSize(): number;
    isCompactable(): boolean;
    compact(targetTokensToFree: number): Promise<number>;
    getTools(): ToolFunction[];
    destroy(): void;
    getState(): SerializedInContextMemoryState;
    restoreState(state: unknown): void;
    /**
     * Store or update a key-value pair
     */
    set(key: string, description: string, value: unknown, priority?: InContextPriority, showInUI?: boolean): void;
    /**
     * Get a value by key
     */
    get(key: string): unknown | undefined;
    /**
     * Check if a key exists
     */
    has(key: string): boolean;
    /**
     * Delete an entry
     */
    delete(key: string): boolean;
    /**
     * List all entries with metadata
     */
    list(): Array<{
        key: string;
        description: string;
        priority: InContextPriority;
        updatedAt: number;
        showInUI: boolean;
    }>;
    /**
     * Clear all entries
     */
    clear(): void;
    private formatEntries;
    private formatEntry;
    private enforceMaxEntries;
    private enforceTokenLimit;
    private estimateTotalTokens;
    /**
     * Get entries sorted by eviction priority (lowest priority, oldest first).
     * Critical entries are excluded.
     */
    private getEvictableEntries;
    /**
     * Debounced notification when entries change.
     * Calls config.onEntriesChanged with all current entries.
     */
    private notifyEntriesChanged;
    private assertNotDestroyed;
    private createContextSetTool;
    private createContextDeleteTool;
    private createContextListTool;
}

/**
 * IPersistentInstructionsStorage - Storage interface for persistent instructions
 *
 * Abstracted storage interface following Clean Architecture principles.
 * Implementations can use file system, database, or any other storage backend.
 */
/**
 * A single instruction entry, independently addressable by key.
 */
interface InstructionEntry {
    /** User-supplied key (e.g., "style", "code_rules") */
    id: string;
    /** Instruction text (markdown) */
    content: string;
    /** Timestamp when entry was first created */
    createdAt: number;
    /** Timestamp when entry was last updated */
    updatedAt: number;
}
/**
 * Storage interface for persistent agent instructions
 *
 * Implementations handle the actual storage mechanism while the plugin
 * handles the business logic.
 */
interface IPersistentInstructionsStorage {
    /**
     * Load instruction entries from storage
     *
     * @returns The stored instruction entries, or null if none exist
     */
    load(): Promise<InstructionEntry[] | null>;
    /**
     * Save instruction entries to storage
     *
     * @param entries - The instruction entries to save
     */
    save(entries: InstructionEntry[]): Promise<void>;
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
 * PersistentInstructionsPluginNextGen - Disk-persisted KVP instructions for NextGen context
 *
 * Stores custom instructions as individually keyed entries that persist across sessions on disk.
 * These are NEVER compacted - always included in context.
 *
 * Use cases:
 * - Agent personality/behavior customization
 * - User-specific preferences
 * - Accumulated knowledge/rules
 * - Custom tool usage guidelines
 *
 * Storage: ~/.oneringai/agents/<agentId>/custom_instructions.json
 */

interface PersistentInstructionsConfig {
    /** Agent ID - used to determine storage path (REQUIRED) */
    agentId: string;
    /** Custom storage implementation (default: FilePersistentInstructionsStorage) */
    storage?: IPersistentInstructionsStorage;
    /** Maximum total content length across all entries in characters (default: 50000) */
    maxTotalLength?: number;
    /** Maximum number of entries (default: 50) */
    maxEntries?: number;
}
interface SerializedPersistentInstructionsState {
    entries: InstructionEntry[];
    agentId: string;
    version: 2;
}
declare class PersistentInstructionsPluginNextGen implements IContextPluginNextGen {
    readonly name = "persistent_instructions";
    private _entries;
    private _initialized;
    private _destroyed;
    private readonly storage;
    private readonly maxTotalLength;
    private readonly maxEntries;
    private readonly agentId;
    private readonly estimator;
    private _tokenCache;
    private _instructionsTokenCache;
    constructor(config: PersistentInstructionsConfig);
    getInstructions(): string;
    getContent(): Promise<string | null>;
    getContents(): Map<string, InstructionEntry>;
    getTokenSize(): number;
    getInstructionsTokenSize(): number;
    isCompactable(): boolean;
    compact(_targetTokensToFree: number): Promise<number>;
    getTools(): ToolFunction[];
    destroy(): void;
    getState(): SerializedPersistentInstructionsState;
    restoreState(state: unknown): void;
    /**
     * Initialize by loading from storage (called lazily)
     */
    initialize(): Promise<void>;
    /**
     * Add or update an instruction entry by key
     */
    set(key: string, content: string): Promise<boolean>;
    /**
     * Remove an instruction entry by key
     */
    remove(key: string): Promise<boolean>;
    /**
     * Get one entry by key, or all entries if no key provided
     */
    get(key?: string): Promise<InstructionEntry | InstructionEntry[] | null>;
    /**
     * List metadata for all entries
     */
    list(): Promise<{
        key: string;
        contentLength: number;
        createdAt: number;
        updatedAt: number;
    }[]>;
    /**
     * Clear all instruction entries
     */
    clear(): Promise<void>;
    /**
     * Check if initialized
     */
    get isInitialized(): boolean;
    private ensureInitialized;
    private assertNotDestroyed;
    /**
     * Persist current entries to storage
     */
    private persistToStorage;
    /**
     * Calculate total content length across all entries
     */
    private calculateTotalContentLength;
    /**
     * Get entries sorted by createdAt (oldest first)
     */
    private getSortedEntries;
    /**
     * Render all entries as markdown for context injection
     */
    private renderContent;
    private createInstructionsSetTool;
    private createInstructionsRemoveTool;
    private createInstructionsListTool;
    private createInstructionsClearTool;
}

/**
 * DefaultCompactionStrategy - Standard compaction behavior
 *
 * Implements the default compaction strategy:
 * - compact(): Plugins first (by priority), then conversation history
 * - consolidate(): No-op for now (returns performed: false)
 *
 * This strategy preserves the original AgentContextNextGen behavior.
 */

/**
 * Configuration for DefaultCompactionStrategy
 */
interface DefaultCompactionStrategyConfig {
    /** Custom threshold (default: 0.70 = 70%) */
    threshold?: number;
}
/**
 * Default compaction strategy.
 *
 * Behavior:
 * - compact(): First compacts plugins (in_context_memory first, then working_memory),
 *   then removes oldest messages from conversation while preserving tool pairs.
 * - consolidate(): No-op - returns performed: false
 *
 * This strategy is fast and suitable for most use cases.
 * Default threshold is 70%.
 */
declare class DefaultCompactionStrategy implements ICompactionStrategy {
    readonly name = "default";
    readonly displayName = "Dumb";
    readonly description = "Do not use";
    readonly threshold: number;
    constructor(config?: DefaultCompactionStrategyConfig);
    /**
     * Emergency compaction when thresholds exceeded.
     *
     * Strategy:
     * 1. Compact plugins first (in_context_memory, then working_memory)
     * 2. If still needed, remove oldest conversation messages (preserving tool pairs)
     */
    compact(context: CompactionContext, targetToFree: number): Promise<CompactionResult>;
    /**
     * Post-cycle consolidation.
     *
     * Default strategy does nothing - override in subclasses for:
     * - Conversation summarization
     * - Memory deduplication
     * - Data promotion to persistent storage
     */
    consolidate(_context: CompactionContext): Promise<ConsolidationResult>;
    /**
     * Compact conversation by removing oldest messages.
     * Preserves tool pairs (tool_use + tool_result).
     */
    private compactConversation;
    /**
     * Find tool_use/tool_result pairs in conversation.
     * Returns Map<tool_use_id, array of message indices>.
     */
    private findToolPairs;
    /**
     * Get tool_use_id from an item (if it contains tool_use or tool_result).
     */
    private getToolUseId;
}

/**
 * StrategyRegistry - Centralized registry for compaction strategies
 *
 * Follows the Connector pattern: static registry with register/get/list methods.
 * Auto-registers built-in strategy classes on first access.
 *
 * Each registered entry represents an actual strategy CLASS.
 * Library users can register their own custom strategy classes.
 *
 * Strategy metadata (name, displayName, description, threshold) comes from
 * the strategy class itself via the ICompactionStrategy interface.
 *
 * @example
 * ```typescript
 * // Get available strategies for UI
 * const strategies = StrategyRegistry.getInfo();
 *
 * // Create a strategy instance
 * const strategy = StrategyRegistry.create('default');
 *
 * // Register a custom strategy class (metadata comes from the class)
 * StrategyRegistry.register(SmartCompactionStrategy);
 *
 * // Register with isBuiltIn flag
 * StrategyRegistry.register(SmartCompactionStrategy, { isBuiltIn: false });
 * ```
 */

/**
 * Strategy constructor type
 */
type StrategyClass = new (config?: any) => ICompactionStrategy;
/**
 * Strategy information for UI display (serializable, no class reference)
 */
interface StrategyInfo {
    /** Strategy name (unique identifier) */
    name: string;
    /** Human-readable name for UI */
    displayName: string;
    /** Description explaining the strategy behavior */
    description: string;
    /** Compaction threshold (0-1, e.g., 0.70 = 70%) */
    threshold: number;
    /** Whether this is a built-in strategy */
    isBuiltIn: boolean;
}
/**
 * Full strategy registry entry (includes class reference)
 */
interface StrategyRegistryEntry extends StrategyInfo {
    /** Strategy constructor class */
    strategyClass: StrategyClass;
}
/**
 * Options for registering a strategy
 */
interface StrategyRegisterOptions {
    /** Whether this is a built-in strategy (default: false) */
    isBuiltIn?: boolean;
}
/**
 * Strategy Registry - manages compaction strategy registration and creation.
 *
 * Features:
 * - Static registry pattern (like Connector)
 * - Auto-registers built-in strategy classes on first access
 * - Supports custom strategy class registration
 * - Provides UI-safe getInfo() for serialization
 * - Metadata (displayName, description) comes from strategy class
 */
declare class StrategyRegistry {
    private static registry;
    private static initialized;
    /**
     * Ensure built-in strategies are registered
     */
    private static ensureInitialized;
    /**
     * Internal registration that reads metadata from strategy instance
     */
    private static registerInternal;
    /**
     * Register a new strategy class.
     *
     * Metadata (name, displayName, description, threshold) is read from
     * the strategy class itself.
     *
     * @param strategyClass - Strategy class to register
     * @param options - Registration options (isBuiltIn defaults to false)
     * @throws Error if a strategy with this name already exists
     *
     * @example
     * ```typescript
     * // Simple registration
     * StrategyRegistry.register(SmartCompactionStrategy);
     *
     * // With options
     * StrategyRegistry.register(SmartCompactionStrategy, { isBuiltIn: false });
     * ```
     */
    static register(strategyClass: StrategyClass, options?: StrategyRegisterOptions): void;
    /**
     * Get a strategy entry by name.
     *
     * @throws Error if strategy not found
     */
    static get(name: string): StrategyRegistryEntry;
    /**
     * Check if a strategy exists.
     */
    static has(name: string): boolean;
    /**
     * List all registered strategy names.
     */
    static list(): string[];
    /**
     * Create a strategy instance by name.
     *
     * @param name - Strategy name
     * @param config - Optional configuration for the strategy
     * @throws Error if strategy not found
     */
    static create(name: string, config?: unknown): ICompactionStrategy;
    /**
     * Get strategy information for UI display (serializable, no class refs).
     *
     * Returns array of StrategyInfo objects that can be safely serialized
     * and sent over IPC.
     */
    static getInfo(): StrategyInfo[];
    /**
     * Remove a strategy from the registry.
     *
     * @param name - Strategy name to remove
     * @returns true if removed, false if not found
     * @throws Error if trying to remove a built-in strategy
     */
    static remove(name: string): boolean;
    /**
     * Get a strategy entry without throwing.
     * Returns undefined if not found.
     */
    static getIfExists(name: string): StrategyRegistryEntry | undefined;
    /**
     * Reset the registry to initial state (for testing).
     * @internal
     */
    static _reset(): void;
}

/**
 * Provider Factory - creates the right provider from a Connector
 *
 * This is the bridge between Connectors and provider implementations.
 * It extracts credentials from the connector and instantiates the appropriate SDK.
 */

/**
 * Get the default API base URL for a vendor.
 * For OpenAI/Anthropic reads from the installed SDK at runtime.
 * Returns undefined for Custom or unknown vendors.
 */
declare function getVendorDefaultBaseURL(vendor: string): string | undefined;
/**
 * Create a text provider from a connector
 */
declare function createProvider(connector: Connector): ITextProvider;

/**
 * MCP Configuration Types
 *
 * Defines configuration structures for MCP servers and global library configuration.
 */
/**
 * Transport type for MCP communication
 */
type MCPTransportType = 'stdio' | 'http' | 'https';
/**
 * Stdio transport configuration
 */
interface StdioTransportConfig {
    /** Command to execute (e.g., 'npx', 'node') */
    command: string;
    /** Command arguments */
    args?: string[];
    /** Environment variables */
    env?: Record<string, string>;
    /** Working directory for the process */
    cwd?: string;
}
/**
 * HTTP/HTTPS transport configuration (StreamableHTTP)
 */
interface HTTPTransportConfig {
    /** HTTP(S) endpoint URL */
    url: string;
    /** Authentication token (supports ${ENV_VAR} interpolation) */
    token?: string;
    /** Additional HTTP headers */
    headers?: Record<string, string>;
    /** Request timeout in milliseconds */
    timeoutMs?: number;
    /** Session ID for reconnection */
    sessionId?: string;
    /** Reconnection options */
    reconnection?: {
        /** Max reconnection delay in ms (default: 30000) */
        maxReconnectionDelay?: number;
        /** Initial reconnection delay in ms (default: 1000) */
        initialReconnectionDelay?: number;
        /** Reconnection delay growth factor (default: 1.5) */
        reconnectionDelayGrowFactor?: number;
        /** Max retry attempts (default: 2) */
        maxRetries?: number;
    };
}
/**
 * Transport configuration union type
 */
type TransportConfig = StdioTransportConfig | HTTPTransportConfig;
/**
 * MCP server configuration
 */
interface MCPServerConfig {
    /** Unique identifier for the server */
    name: string;
    /** Human-readable display name */
    displayName?: string;
    /** Server description */
    description?: string;
    /** Transport type */
    transport: MCPTransportType;
    /** Transport-specific configuration */
    transportConfig: TransportConfig;
    /** Auto-connect on startup (default: false) */
    autoConnect?: boolean;
    /** Auto-reconnect on failure (default: true) */
    autoReconnect?: boolean;
    /** Reconnect interval in milliseconds (default: 5000) */
    reconnectIntervalMs?: number;
    /** Maximum reconnect attempts (default: 10) */
    maxReconnectAttempts?: number;
    /** Request timeout in milliseconds (default: 30000) */
    requestTimeoutMs?: number;
    /** Health check interval in milliseconds (default: 60000) */
    healthCheckIntervalMs?: number;
    /** Tool namespace prefix (default: 'mcp:{name}') */
    toolNamespace?: string;
    /** Permission configuration for tools from this server */
    permissions?: {
        /** Default permission scope */
        defaultScope?: 'once' | 'session' | 'always' | 'never';
        /** Default risk level */
        defaultRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
    };
    /**
     * Map environment variable keys to connector names for runtime auth resolution.
     * When connecting, the connector's token will be injected into the env var.
     * Example: { 'GITHUB_PERSONAL_ACCESS_TOKEN': 'my-github-connector' }
     */
    connectorBindings?: Record<string, string>;
}
/**
 * MCP global configuration
 */
interface MCPConfiguration {
    /** List of MCP servers */
    servers: MCPServerConfig[];
    /** Default settings for all servers */
    defaults?: {
        /** Default auto-connect (default: false) */
        autoConnect?: boolean;
        /** Default auto-reconnect (default: true) */
        autoReconnect?: boolean;
        /** Default reconnect interval in milliseconds (default: 5000) */
        reconnectIntervalMs?: number;
        /** Default maximum reconnect attempts (default: 10) */
        maxReconnectAttempts?: number;
        /** Default request timeout in milliseconds (default: 30000) */
        requestTimeoutMs?: number;
        /** Default health check interval in milliseconds (default: 60000) */
        healthCheckIntervalMs?: number;
    };
}

/**
 * MCP Domain Types
 *
 * Core types for MCP tools, resources, and prompts.
 * These are simplified wrappers around the SDK types.
 */
/**
 * MCP Tool definition
 */
interface MCPTool {
    /** Tool name */
    name: string;
    /** Tool description */
    description?: string;
    /** JSON Schema for tool input */
    inputSchema: {
        type: 'object';
        properties?: Record<string, unknown>;
        required?: string[];
        [key: string]: unknown;
    };
}
/**
 * MCP Tool call result
 */
interface MCPToolResult {
    /** Result content */
    content: Array<{
        type: 'text' | 'image' | 'resource';
        text?: string;
        data?: string;
        mimeType?: string;
        uri?: string;
    }>;
    /** Whether the tool call resulted in an error */
    isError?: boolean;
}
/**
 * MCP Resource definition
 */
interface MCPResource {
    /** Resource URI */
    uri: string;
    /** Resource name */
    name: string;
    /** Resource description */
    description?: string;
    /** MIME type */
    mimeType?: string;
}
/**
 * MCP Resource content
 */
interface MCPResourceContent {
    /** Resource URI */
    uri: string;
    /** MIME type */
    mimeType?: string;
    /** Text content */
    text?: string;
    /** Binary content (base64) */
    blob?: string;
}
/**
 * MCP Prompt definition
 */
interface MCPPrompt {
    /** Prompt name */
    name: string;
    /** Prompt description */
    description?: string;
    /** Prompt arguments schema */
    arguments?: Array<{
        name: string;
        description?: string;
        required?: boolean;
    }>;
}
/**
 * MCP Prompt result
 */
interface MCPPromptResult {
    /** Prompt description */
    description?: string;
    /** Prompt messages */
    messages: Array<{
        role: 'user' | 'assistant';
        content: {
            type: 'text' | 'image' | 'resource';
            text?: string;
            data?: string;
            mimeType?: string;
            uri?: string;
        };
    }>;
}
/**
 * MCP Server capabilities
 */
interface MCPServerCapabilities {
    /** Tools capability */
    tools?: Record<string, unknown>;
    /** Resources capability */
    resources?: {
        subscribe?: boolean;
        listChanged?: boolean;
    };
    /** Prompts capability */
    prompts?: {
        listChanged?: boolean;
    };
    /** Logging capability */
    logging?: Record<string, unknown>;
}
/**
 * MCP Client state (for serialization)
 */
interface MCPClientState {
    /** Server name */
    name: string;
    /** Connection state */
    state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
    /** Server capabilities */
    capabilities?: MCPServerCapabilities;
    /** Subscribed resource URIs */
    subscribedResources: string[];
    /** Last connected timestamp */
    lastConnectedAt?: number;
    /** Connection attempt count */
    connectionAttempts: number;
}

/**
 * MCP Client Interface
 *
 * High-level interface for MCP client operations.
 * This wraps the @modelcontextprotocol/sdk Client class.
 */

/**
 * MCP Client connection states
 */
type MCPClientConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
/**
 * MCP Client interface
 */
interface IMCPClient extends EventEmitter {
    /** Server name */
    readonly name: string;
    /** Current connection state */
    readonly state: MCPClientConnectionState;
    /** Server capabilities (available after connection) */
    readonly capabilities?: MCPServerCapabilities;
    /** Currently available tools */
    readonly tools: MCPTool[];
    /**
     * Connect to the MCP server
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the MCP server
     */
    disconnect(): Promise<void>;
    /**
     * Reconnect to the MCP server
     */
    reconnect(): Promise<void>;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    /**
     * Ping the server to check health
     */
    ping(): Promise<boolean>;
    /**
     * List available tools from the server
     */
    listTools(): Promise<MCPTool[]>;
    /**
     * Call a tool on the server
     */
    callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult>;
    /**
     * Register all tools with a ToolManager
     */
    registerTools(toolManager: ToolManager): void;
    /**
     * Register specific tools with a ToolManager (selective registration)
     * @param toolManager - ToolManager to register with
     * @param toolNames - Optional array of tool names to register (original MCP names, not namespaced).
     *                    If not provided, registers all tools.
     */
    registerToolsSelective(toolManager: ToolManager, toolNames?: string[]): void;
    /**
     * Unregister all tools from a ToolManager
     */
    unregisterTools(toolManager: ToolManager): void;
    /**
     * List available resources from the server
     */
    listResources(): Promise<MCPResource[]>;
    /**
     * Read a resource from the server
     */
    readResource(uri: string): Promise<MCPResourceContent>;
    /**
     * Subscribe to resource updates
     */
    subscribeResource(uri: string): Promise<void>;
    /**
     * Unsubscribe from resource updates
     */
    unsubscribeResource(uri: string): Promise<void>;
    /**
     * List available prompts from the server
     */
    listPrompts(): Promise<MCPPrompt[]>;
    /**
     * Get a prompt from the server
     */
    getPrompt(name: string, args?: Record<string, unknown>): Promise<MCPPromptResult>;
    /**
     * Get current state for serialization
     */
    getState(): MCPClientState;
    /**
     * Load state from serialization
     */
    loadState(state: MCPClientState): void;
    /**
     * Destroy the client and clean up resources
     */
    destroy(): void;
}

/**
 * MCP Client Implementation
 *
 * Wrapper around @modelcontextprotocol/sdk Client with lifecycle management,
 * auto-reconnect, and integration with ToolManager.
 */

/**
 * MCP Client class
 */
declare class MCPClient extends EventEmitter implements IMCPClient, IDisposable {
    readonly name: string;
    private readonly config;
    private client;
    private transport;
    private _state;
    private _capabilities?;
    private _tools;
    private reconnectAttempts;
    private reconnectTimer?;
    private healthCheckTimer?;
    private subscribedResources;
    private registeredToolNames;
    private _isDestroyed;
    constructor(config: MCPServerConfig, defaults?: MCPConfiguration['defaults']);
    get state(): MCPClientConnectionState;
    get capabilities(): MCPServerCapabilities | undefined;
    get tools(): MCPTool[];
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    reconnect(): Promise<void>;
    isConnected(): boolean;
    ping(): Promise<boolean>;
    listTools(): Promise<MCPTool[]>;
    callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult>;
    registerTools(toolManager: ToolManager): void;
    /**
     * Register specific tools with a ToolManager (selective registration)
     * @param toolManager - ToolManager to register with
     * @param toolNames - Optional array of tool names to register (original MCP names, not namespaced).
     *                    If not provided, registers all tools.
     */
    registerToolsSelective(toolManager: ToolManager, toolNames?: string[]): void;
    unregisterTools(toolManager: ToolManager): void;
    listResources(): Promise<MCPResource[]>;
    readResource(uri: string): Promise<MCPResourceContent>;
    subscribeResource(uri: string): Promise<void>;
    unsubscribeResource(uri: string): Promise<void>;
    listPrompts(): Promise<MCPPrompt[]>;
    getPrompt(name: string, args?: Record<string, unknown>): Promise<MCPPromptResult>;
    getState(): MCPClientState;
    loadState(state: MCPClientState): void;
    /**
     * Check if the MCPClient instance has been destroyed
     */
    get isDestroyed(): boolean;
    destroy(): void;
    private createTransport;
    private ensureConnected;
    private refreshTools;
    private startHealthCheck;
    private stopHealthCheck;
    private scheduleReconnect;
    private stopReconnect;
}

/**
 * MCP Registry
 *
 * Static registry for managing MCP client connections.
 * Follows the same pattern as Connector registry.
 */

/**
 * MCP Registry - static registry for MCP clients
 */
declare class MCPRegistry {
    private static clients;
    /**
     * Create and register an MCP client
     */
    static create(config: MCPServerConfig, defaults?: MCPConfiguration['defaults']): IMCPClient;
    /**
     * Get a registered MCP client
     */
    static get(name: string): IMCPClient;
    /**
     * Check if an MCP client is registered
     */
    static has(name: string): boolean;
    /**
     * List all registered MCP client names
     */
    static list(): string[];
    /**
     * Get info about a registered MCP client
     */
    static getInfo(name: string): {
        name: string;
        state: string;
        connected: boolean;
        toolCount: number;
    };
    /**
     * Get info about all registered MCP clients
     */
    static getAllInfo(): Array<{
        name: string;
        state: string;
        connected: boolean;
        toolCount: number;
    }>;
    /**
     * Create multiple clients from MCP configuration
     */
    static createFromConfig(config: MCPConfiguration): IMCPClient[];
    /**
     * Load MCP configuration from file and create clients
     */
    static loadFromConfigFile(path: string): Promise<IMCPClient[]>;
    /**
     * Connect all servers with autoConnect enabled
     */
    static connectAll(): Promise<void>;
    /**
     * Disconnect all servers
     */
    static disconnectAll(): Promise<void>;
    /**
     * Remove and destroy a specific client from the registry
     * @param name - Name of the MCP server to remove
     * @returns true if the server was found and removed, false otherwise
     */
    static remove(name: string): boolean;
    /**
     * Destroy all clients and clear registry
     */
    static destroyAll(): void;
    /**
     * Clear the registry (for testing)
     */
    static clear(): void;
    /**
     * Interpolate environment variables in configuration
     * Replaces ${ENV_VAR} with process.env.ENV_VAR
     */
    private static interpolateEnvVars;
}

/**
 * MCP Error Classes
 *
 * Error hierarchy for MCP-related failures.
 */
/**
 * Base error for all MCP-related errors
 */
declare class MCPError extends Error {
    readonly serverName?: string | undefined;
    readonly cause?: Error | undefined;
    constructor(message: string, serverName?: string | undefined, cause?: Error | undefined);
}
/**
 * Connection-related errors (failed to connect, disconnected unexpectedly)
 */
declare class MCPConnectionError extends MCPError {
    constructor(message: string, serverName?: string, cause?: Error);
}
/**
 * Timeout errors (request timeout, connection timeout)
 */
declare class MCPTimeoutError extends MCPError {
    readonly timeoutMs: number;
    constructor(message: string, timeoutMs: number, serverName?: string, cause?: Error);
}
/**
 * Protocol-level errors (invalid message, unsupported capability)
 */
declare class MCPProtocolError extends MCPError {
    constructor(message: string, serverName?: string, cause?: Error);
}
/**
 * Tool execution errors (tool not found, tool execution failed)
 */
declare class MCPToolError extends MCPError {
    readonly toolName: string;
    constructor(message: string, toolName: string, serverName?: string, cause?: Error);
}
/**
 * Resource-related errors (resource not found, subscription failed)
 */
declare class MCPResourceError extends MCPError {
    readonly resourceUri: string;
    constructor(message: string, resourceUri: string, serverName?: string, cause?: Error);
}

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
 * ToolExecutionPipeline
 *
 * Orchestrates the execution of tools through a chain of plugins.
 * Each plugin can intercept and modify the execution at different phases:
 * - beforeExecute: Modify args, abort execution, or pass through
 * - afterExecute: Transform results
 * - onError: Handle or recover from errors
 *
 * @module tool-execution
 */

/**
 * Tool Execution Pipeline
 *
 * Manages a chain of plugins that can intercept and modify tool execution.
 *
 * @example
 * ```typescript
 * const pipeline = new ToolExecutionPipeline();
 *
 * // Add plugins
 * pipeline.use(new LoggingPlugin());
 * pipeline.use(new AnalyticsPlugin());
 *
 * // Execute tool
 * const result = await pipeline.execute(myTool, { arg: 'value' });
 * ```
 */
declare class ToolExecutionPipeline implements IToolExecutionPipeline {
    private plugins;
    private sortedPlugins;
    private useRandomUUID;
    constructor(options?: ToolExecutionPipelineOptions);
    /**
     * Register a plugin with the pipeline.
     *
     * If a plugin with the same name is already registered, it will be
     * unregistered first (calling its onUnregister hook) and replaced.
     *
     * @param plugin - Plugin to register
     * @returns this for chaining
     */
    use(plugin: IToolExecutionPlugin): this;
    /**
     * Remove a plugin by name.
     *
     * @param pluginName - Name of the plugin to remove
     * @returns true if the plugin was found and removed, false otherwise
     */
    remove(pluginName: string): boolean;
    /**
     * Check if a plugin is registered.
     *
     * @param pluginName - Name of the plugin to check
     */
    has(pluginName: string): boolean;
    /**
     * Get a registered plugin by name.
     *
     * @param pluginName - Name of the plugin to get
     */
    get(pluginName: string): IToolExecutionPlugin | undefined;
    /**
     * List all registered plugins, sorted by priority.
     */
    list(): IToolExecutionPlugin[];
    /**
     * Execute a tool through the plugin pipeline.
     *
     * Execution phases:
     * 1. beforeExecute hooks (in priority order, lowest first)
     * 2. Tool execution (if not aborted)
     * 3. afterExecute hooks (in reverse priority order for proper unwinding)
     * 4. onError hooks if any phase fails
     *
     * @param tool - Tool function to execute
     * @param args - Arguments for the tool
     * @returns Result from tool execution (possibly transformed by plugins)
     */
    execute(tool: ToolFunction, args: unknown): Promise<unknown>;
    /**
     * Rebuild the sorted plugin list after registration changes.
     */
    private rebuildSortedList;
}

/**
 * LoggingPlugin
 *
 * A tool execution plugin that logs tool execution start, completion, and errors.
 * Useful for debugging and observability.
 *
 * @module tool-execution
 */

/**
 * Configuration options for LoggingPlugin
 */
interface LoggingPluginOptions {
    /**
     * Log level for start/complete messages.
     * Default: 'debug'
     */
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    /**
     * Log level for error messages.
     * Default: 'error'
     */
    errorLevel?: 'warn' | 'error';
    /**
     * Whether to include tool arguments in logs.
     * Set to false for tools with sensitive data.
     * Default: true
     */
    logArgs?: boolean;
    /**
     * Whether to include result summary in completion logs.
     * Default: true
     */
    logResult?: boolean;
    /**
     * Maximum length for argument/result strings in logs.
     * Default: 200
     */
    maxLogLength?: number;
    /**
     * Custom logger instance. If not provided, uses framework logger.
     */
    logger?: FrameworkLogger;
    /**
     * Component name for the logger.
     * Default: 'ToolExecution'
     */
    component?: string;
}
/**
 * LoggingPlugin - Logs tool execution lifecycle events.
 *
 * @example
 * ```typescript
 * const pipeline = new ToolExecutionPipeline();
 * pipeline.use(new LoggingPlugin());
 * // Or with custom options:
 * pipeline.use(new LoggingPlugin({
 *   level: 'info',
 *   logArgs: false, // Don't log potentially sensitive args
 * }));
 * ```
 */
declare class LoggingPlugin implements IToolExecutionPlugin {
    readonly name = "logging";
    readonly priority = 5;
    private logger;
    private level;
    private errorLevel;
    private logArgs;
    private logResult;
    private maxLogLength;
    constructor(options?: LoggingPluginOptions);
    beforeExecute(ctx: PluginExecutionContext): Promise<BeforeExecuteResult>;
    afterExecute(ctx: PluginExecutionContext, result: unknown): Promise<unknown>;
    onError(ctx: PluginExecutionContext, error: Error): Promise<unknown>;
    /**
     * Log a message at the specified level.
     */
    private log;
    /**
     * Summarize a value for logging, truncating if necessary.
     */
    private summarize;
}

/**
 * ErrorHandler - Centralized error handling for agents
 *
 * Provides consistent error handling, logging, and retry logic across all agent types.
 * This is an opt-in utility that agents can use for standardized error management.
 */

/**
 * Context information for error handling
 */
interface ErrorContext {
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
    transformError?: (error: Error, context: ErrorContext) => Error;
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
        context: ErrorContext;
        recoverable: boolean;
    };
    /** Emitted when retrying after an error */
    'error:retrying': {
        error: Error;
        context: ErrorContext;
        attempt: number;
        delayMs: number;
    };
    /** Emitted when an error is fatal (no recovery possible) */
    'error:fatal': {
        error: Error;
        context: ErrorContext;
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
    handle(error: Error, context: ErrorContext): void;
    /**
     * Execute a function with automatic retry on retryable errors.
     *
     * @param fn - The function to execute
     * @param context - Context for error handling
     * @returns The result of the function
     * @throws The last error if all retries are exhausted
     */
    executeWithRetry<T>(fn: () => Promise<T>, context: ErrorContext): Promise<T>;
    /**
     * Wrap a function with error handling (no retry).
     * Useful for wrapping methods that already have their own retry logic.
     *
     * @param fn - The function to wrap
     * @param contextFactory - Factory to create context from function arguments
     * @returns A wrapped function with error handling
     */
    wrap<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => Promise<TResult>, contextFactory: (...args: TArgs) => ErrorContext): (...args: TArgs) => Promise<TResult>;
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
interface SearchOptions$1 {
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
interface SearchResponse$1 {
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
    search(query: string, options?: SearchOptions$1): Promise<SearchResponse$1>;
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
    search(query: string, options?: SearchOptions$1): Promise<SearchResponse$1>;
}

/**
 * Brave Search Provider
 * Independent search index (privacy-focused)
 */

declare class BraveProvider implements ISearchProvider {
    readonly connector: Connector;
    readonly name = "brave";
    constructor(connector: Connector);
    search(query: string, options?: SearchOptions$1): Promise<SearchResponse$1>;
}

/**
 * Tavily AI Search Provider
 * AI-optimized search results with summaries
 */

declare class TavilyProvider implements ISearchProvider {
    readonly connector: Connector;
    readonly name = "tavily";
    constructor(connector: Connector);
    search(query: string, options?: SearchOptions$1): Promise<SearchResponse$1>;
}

/**
 * RapidAPI Real-Time Web Search Provider
 * Real-time web search via RapidAPI
 */

declare class RapidAPIProvider implements ISearchProvider {
    readonly connector: Connector;
    readonly name = "rapidapi";
    constructor(connector: Connector);
    search(query: string, options?: SearchOptions$1): Promise<SearchResponse$1>;
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
 * Find a connector by supported service types
 * Used by tools to auto-detect available external API connectors
 *
 * This is the GENERIC utility for all external API-dependent tools.
 * Tools define which service types they support, this function finds
 * the first available connector matching any of those types.
 *
 * @param serviceTypes - Array of supported service types in order of preference
 * @returns Connector if found, null otherwise
 *
 * @example
 * ```typescript
 * // In web_search tool
 * const SEARCH_SERVICE_TYPES = ['serper', 'brave-search', 'tavily', 'rapidapi-search'];
 * const connector = findConnectorByServiceTypes(SEARCH_SERVICE_TYPES);
 *
 * // In web_scrape tool
 * const SCRAPE_SERVICE_TYPES = ['zenrows', 'jina-reader', 'firecrawl', 'scrapingbee'];
 * const connector = findConnectorByServiceTypes(SCRAPE_SERVICE_TYPES);
 * ```
 */
declare function findConnectorByServiceTypes(serviceTypes: string[]): Connector | null;
/**
 * List all available connectors for given service types
 * Useful for tools that want to show what's available or support fallback chains
 *
 * @param serviceTypes - Array of supported service types
 * @returns Array of connector names that match any of the service types
 */
declare function listConnectorsByServiceTypes(serviceTypes: string[]): string[];

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
 * 2. Try external API provider - handles bot protection, SPAs, etc.
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
 * Document Reader Types
 *
 * Core types for the universal file-to-LLM-content converter.
 */
type DocumentFormat = 'docx' | 'pptx' | 'odt' | 'odp' | 'ods' | 'rtf' | 'xlsx' | 'csv' | 'pdf' | 'html' | 'txt' | 'md' | 'json' | 'xml' | 'yaml' | 'yml' | 'png' | 'jpg' | 'jpeg' | 'gif' | 'webp' | 'svg';
type DocumentFamily = 'office' | 'spreadsheet' | 'pdf' | 'html' | 'text' | 'image';
interface PieceMetadata {
    sourceFilename: string;
    format: DocumentFormat;
    index: number;
    section?: string;
    sizeBytes: number;
    estimatedTokens: number;
    label?: string;
}
interface DocumentTextPiece {
    type: 'text';
    content: string;
    metadata: PieceMetadata;
}
interface DocumentImagePiece {
    type: 'image';
    base64: string;
    mimeType: string;
    width?: number;
    height?: number;
    metadata: PieceMetadata;
}
type DocumentPiece = DocumentTextPiece | DocumentImagePiece;
interface DocumentMetadata {
    filename: string;
    format: DocumentFormat;
    family: DocumentFamily;
    mimeType: string;
    totalPieces: number;
    totalTextPieces: number;
    totalImagePieces: number;
    totalSizeBytes: number;
    estimatedTokens: number;
    processingTimeMs: number;
    formatSpecific?: Record<string, unknown>;
}
interface DocumentResult {
    success: boolean;
    pieces: DocumentPiece[];
    metadata: DocumentMetadata;
    error?: string;
    warnings: string[];
}
interface FileSource {
    type: 'file';
    path: string;
}
interface URLSource {
    type: 'url';
    url: string;
    headers?: Record<string, string>;
}
interface BufferSource {
    type: 'buffer';
    buffer: Buffer | Uint8Array;
    filename: string;
    mimeType?: string;
}
interface BlobSource {
    type: 'blob';
    blob: Blob;
    filename: string;
}
type DocumentSource = FileSource | URLSource | BufferSource | BlobSource;
interface ImageFilterOptions {
    /** Skip images narrower than this (default: 50px) */
    minWidth?: number;
    /** Skip images shorter than this (default: 50px) */
    minHeight?: number;
    /** Skip images smaller than this in bytes (default: 1024) */
    minSizeBytes?: number;
    /** Maximum images to keep (default: 50 at extraction, 20 at content conversion) */
    maxImages?: number;
    /** Exclude images whose filename/label matches these patterns */
    excludePatterns?: RegExp[];
}
interface ExcelFormatOptions {
    /** Maximum rows per sheet (default: 1000) */
    maxRows?: number;
    /** Maximum columns per sheet (default: 50) */
    maxColumns?: number;
    /** Table output format (default: 'markdown') */
    tableFormat?: 'markdown' | 'csv' | 'json';
    /** Include formulas as comments (default: false) */
    includeFormulas?: boolean;
}
interface PDFFormatOptions {
    /** Include PDF metadata in output (default: true) */
    includeMetadata?: boolean;
}
interface HTMLFormatOptions {
    /** Maximum HTML length to process (default: 50000) */
    maxLength?: number;
}
interface OfficeFormatOptions {
    /** Include speaker notes for PPTX (default: true) */
    includeSpeakerNotes?: boolean;
}
interface DocumentReadOptions {
    /** Maximum estimated tokens in output (default: 100000) */
    maxTokens?: number;
    /** Maximum output size in bytes (default: 5MB) */
    maxOutputBytes?: number;
    /** Extract images from documents (default: true) */
    extractImages?: boolean;
    /** Image detail level for LLM (default: 'auto') */
    imageDetail?: 'auto' | 'low' | 'high';
    /** Image filtering options */
    imageFilter?: ImageFilterOptions;
    /** Specific pages/sheets to read (format-dependent) */
    pages?: number[] | string[];
    /** Additional transformers to apply */
    transformers?: IDocumentTransformer[];
    /** Skip built-in transformers (default: false) */
    skipDefaultTransformers?: boolean;
    /** Format-specific options */
    formatOptions?: {
        excel?: ExcelFormatOptions;
        pdf?: PDFFormatOptions;
        html?: HTMLFormatOptions;
        office?: OfficeFormatOptions;
    };
}
interface DocumentReaderConfig {
    /** Default options for all read() calls */
    defaults?: DocumentReadOptions;
    /** Custom format handlers (override built-in) */
    handlers?: Map<DocumentFamily, IFormatHandler>;
    /** Maximum download size for URL sources (default: 50MB) */
    maxDownloadSizeBytes?: number;
    /** Download timeout for URL sources (default: 60000ms) */
    downloadTimeoutMs?: number;
}
interface TransformerContext {
    filename: string;
    format: DocumentFormat;
    family: DocumentFamily;
    options: DocumentReadOptions;
}
interface IDocumentTransformer {
    readonly name: string;
    readonly appliesTo: DocumentFormat[];
    readonly priority?: number;
    transform(pieces: DocumentPiece[], context: TransformerContext): Promise<DocumentPiece[]>;
}
interface IFormatHandler {
    readonly name: string;
    readonly supportedFormats: DocumentFormat[];
    handle(buffer: Buffer, filename: string, format: DocumentFormat, options: DocumentReadOptions): Promise<DocumentPiece[]>;
}
interface FormatDetectionResult {
    format: DocumentFormat;
    family: DocumentFamily;
    mimeType: string;
    confidence: 'high' | 'medium' | 'low';
}
interface DocumentToContentOptions {
    /** Image detail for LLM content (default: 'auto') */
    imageDetail?: 'auto' | 'low' | 'high';
    /** Additional image filtering at content conversion time */
    imageFilter?: ImageFilterOptions;
    /** Maximum images in content output (default: 20) */
    maxImages?: number;
    /** Merge adjacent text pieces into one (default: true) */
    mergeAdjacentText?: boolean;
}

/**
 * Document Reader
 *
 * Universal file-to-LLM-content converter.
 * Reads arbitrary formats and produces DocumentPiece arrays.
 */

/**
 * Main document reader class.
 *
 * @example
 * ```typescript
 * const reader = DocumentReader.create();
 * const result = await reader.read('/path/to/doc.pdf');
 * console.log(result.pieces); // DocumentPiece[]
 * ```
 */
declare class DocumentReader {
    private handlers;
    private config;
    private constructor();
    /**
     * Create a new DocumentReader instance
     */
    static create(config?: DocumentReaderConfig): DocumentReader;
    /**
     * Register all default format handlers (lazy-loaded)
     */
    private registerDefaultHandlers;
    /**
     * Register a custom format handler
     */
    registerHandler(family: DocumentFamily, handler: IFormatHandler): void;
    /**
     * Read a document from any source
     */
    read(source: DocumentSource | string, options?: DocumentReadOptions): Promise<DocumentResult>;
    /**
     * Parse a string source (auto-detect path vs URL)
     */
    private parseStringSource;
    /**
     * Resolve any source to a buffer and filename
     */
    private resolveSource;
    /**
     * Extract filename from URL and response headers
     */
    private extractFilenameFromURL;
    /**
     * Get the handler for a format family, loading defaults lazily
     */
    private getHandler;
    /**
     * Filter images based on options
     */
    private filterImages;
    /**
     * Run the transformer pipeline
     */
    private runTransformers;
    /**
     * Assemble metadata from pieces
     */
    private assembleMetadata;
}
/**
 * Merge text pieces into a single markdown string
 */
declare function mergeTextPieces(pieces: DocumentPiece[]): string;

/**
 * Format Detector
 *
 * Detects document format from filename extension and optional magic bytes.
 */

/**
 * Static utility for detecting document formats
 */
declare class FormatDetector {
    /**
     * Detect format from filename and optional buffer
     */
    static detect(filename: string, _buffer?: Buffer | Uint8Array): FormatDetectionResult;
    /**
     * Check if an extension is a supported document format
     * Used by readFile to detect when to use DocumentReader
     */
    static isDocumentFormat(ext: string): boolean;
    /**
     * Check if an extension is a binary document format
     * (i.e., cannot be read as UTF-8)
     */
    static isBinaryDocumentFormat(ext: string): boolean;
    /**
     * Check if a Content-Type header indicates a document format
     * Used by webFetch to detect downloadable documents
     */
    static isDocumentMimeType(contentType: string): boolean;
    /**
     * Detect format from Content-Type header
     */
    static detectFromMimeType(contentType: string): FormatDetectionResult | null;
    /**
     * Get all supported document extensions
     */
    static getSupportedExtensions(): string[];
    /**
     * Get the normalized extension from a filename
     */
    static getExtension(filename: string): string;
}

/**
 * Document Content Bridge
 *
 * Converts DocumentResult → Content[] for LLM consumption.
 * Provides readDocumentAsContent() as a one-call convenience.
 */

/**
 * Convert a DocumentResult to Content[] for LLM input.
 *
 * - Text pieces → InputTextContent
 * - Image pieces → InputImageContent (with data URI)
 * - Adjacent text pieces merged by default
 * - Additional image filtering applied
 */
declare function documentToContent(result: DocumentResult, options?: DocumentToContentOptions): Content[];
/**
 * One-call convenience: read a document and convert to Content[] for LLM input.
 *
 * @example
 * ```typescript
 * const content = await readDocumentAsContent('/path/to/doc.pdf', {
 *   imageFilter: { minWidth: 100, minHeight: 100 },
 *   imageDetail: 'auto',
 * });
 *
 * agent.run([
 *   { type: 'input_text', text: 'Analyze this document:' },
 *   ...content,
 * ]);
 * ```
 */
declare function readDocumentAsContent(source: DocumentSource | string, options?: DocumentReadOptions & DocumentToContentOptions): Promise<Content[]>;

/**
 * IMediaStorage - Storage interface for multimedia outputs (images, video, audio)
 *
 * Provides CRUD operations for media files produced by generation tools.
 * Implementations can use filesystem, S3, GCS, or any other storage backend.
 *
 * This follows Clean Architecture - the interface is in domain layer,
 * implementations are in infrastructure layer.
 */
/**
 * Metadata about media being saved
 */
interface MediaStorageMetadata {
    /** Type of media being saved */
    type: 'image' | 'video' | 'audio';
    /** File format (png, mp4, mp3, etc.) */
    format: string;
    /** Model used for generation */
    model: string;
    /** Vendor that produced the output */
    vendor: string;
    /** Index for multi-image results */
    index?: number;
    /** Suggested filename (without path) */
    suggestedFilename?: string;
    /** User ID — set by tool when userId is known, for per-user storage organization */
    userId?: string;
}
/**
 * Result of a save operation
 */
interface MediaStorageResult {
    /** Location of the saved file (file path, URL, S3 key - depends on implementation) */
    location: string;
    /** MIME type of the saved file */
    mimeType: string;
    /** File size in bytes */
    size: number;
}
/**
 * Entry returned by list()
 */
interface MediaStorageEntry {
    /** Location of the file */
    location: string;
    /** MIME type */
    mimeType: string;
    /** File size in bytes */
    size: number;
    /** Media type (image, video, audio) */
    type?: 'image' | 'video' | 'audio';
    /** When the file was created */
    createdAt: Date;
}
/**
 * Options for listing media files
 */
interface MediaStorageListOptions {
    /** Filter by media type */
    type?: 'image' | 'video' | 'audio';
    /** Maximum number of results */
    limit?: number;
    /** Offset for pagination */
    offset?: number;
}
/**
 * Storage interface for multimedia outputs
 *
 * Implementations:
 * - FileMediaStorage: File-based storage (default, uses local filesystem)
 * - (Custom) S3MediaStorage, GCSMediaStorage, etc.
 */
interface IMediaStorage {
    /**
     * Save media data to storage
     *
     * @param data - Raw media data as Buffer
     * @param metadata - Information about the media for naming/organization
     * @returns Location and metadata of the saved file
     */
    save(data: Buffer, metadata: MediaStorageMetadata): Promise<MediaStorageResult>;
    /**
     * Read media data from storage
     *
     * @param location - Location string returned by save() or known file path
     * @returns The raw media data, or null if not found
     */
    read(location: string): Promise<Buffer | null>;
    /**
     * Delete media from storage
     *
     * @param location - Location string to delete
     * @throws Does NOT throw if the file doesn't exist
     */
    delete(location: string): Promise<void>;
    /**
     * Check if media exists in storage
     *
     * @param location - Location string to check
     */
    exists(location: string): Promise<boolean>;
    /**
     * List media files in storage (optional)
     *
     * @param options - Filtering and pagination options
     */
    list?(options?: MediaStorageListOptions): Promise<MediaStorageEntry[]>;
    /**
     * Get the storage path/location (for display/debugging)
     */
    getPath(): string;
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
     * Enforce the maxIndexEntries limit by evicting excess entries
     * Only evicts if entry count exceeds the configured limit
     */
    private enforceEntryCountLimit;
    /**
     * Get the configured max index entries limit
     */
    getMaxIndexEntries(): number | undefined;
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
     * Respects maxIndexEntries limit for context display
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
 * PlanningAgent - AI-driven plan generation
 *
 * Separates planning phase from execution phase.
 * Analyzes goals and generates task graphs with dependencies.
 */

/**
 * PlanningAgent configuration
 */
interface PlanningAgentConfig {
    /** Connector for LLM access */
    connector: string | Connector;
    /** Model to use for planning (can be different/cheaper than execution) */
    model: string;
    /** Max planning iterations */
    maxPlanningIterations?: number;
    /** Temperature for planning (lower = more deterministic) */
    planningTemperature?: number;
    /** Tools available for the plan (used to inform planning) */
    availableTools?: ToolFunction[];
}
/**
 * Generated plan with metadata
 */
interface GeneratedPlan {
    plan: Plan;
    reasoning: string;
    estimated_duration?: string;
    complexity?: 'low' | 'medium' | 'high';
}
/**
 * PlanningAgent class
 */
declare class PlanningAgent {
    private agent;
    private config;
    private currentTasks;
    private planningComplete;
    private constructor();
    /**
     * Create a new PlanningAgent
     */
    static create(config: PlanningAgentConfig): PlanningAgent;
    /**
     * Create planning tools bound to this PlanningAgent instance
     */
    private createBoundPlanningTools;
    /**
     * Generate a plan from a goal
     */
    generatePlan(input: {
        goal: string;
        context?: string;
        constraints?: string[];
    }): Promise<GeneratedPlan>;
    /**
     * Validate and refine an existing plan
     */
    refinePlan(plan: Plan, feedback: string): Promise<GeneratedPlan>;
    /**
     * Build planning prompt from input
     */
    private buildPlanningPrompt;
    /**
     * Estimate plan complexity
     */
    private estimateComplexity;
    /**
     * Get current tasks (for tool access)
     */
    getCurrentTasks(): TaskInput[];
    /**
     * Add task (called by planning tools)
     */
    addTask(task: TaskInput): void;
    /**
     * Update task (called by planning tools)
     */
    updateTask(name: string, updates: Partial<TaskInput>): void;
    /**
     * Remove task (called by planning tools)
     */
    removeTask(name: string): void;
    /**
     * Mark planning as complete
     */
    finalizePlanning(): void;
}
/**
 * Simple plan generation without tools (fallback)
 */
declare function generateSimplePlan(goal: string, context?: string): Promise<Plan>;

/**
 * ResearchAgent Types
 *
 * Generic interfaces for research sources that work with any data provider:
 * - Web search (Serper, Brave, Tavily)
 * - Vector databases (Pinecone, Weaviate, Qdrant)
 * - File systems (local, S3, GCS)
 * - APIs (REST, GraphQL)
 * - Databases (SQL, MongoDB)
 */
/**
 * A single search result from any source
 */
interface SourceResult {
    /** Unique identifier for this result */
    id: string;
    /** Human-readable title */
    title: string;
    /** Brief description or snippet */
    snippet: string;
    /** Reference for fetching full content (URL, path, ID, etc.) */
    reference: string;
    /** Relevance score (0-1, higher is better) */
    relevance?: number;
    /** Source-specific metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Response from a search operation
 */
interface SearchResponse {
    /** Whether the search succeeded */
    success: boolean;
    /** Original query */
    query: string;
    /** Results found */
    results: SourceResult[];
    /** Total results available (may be more than returned) */
    totalResults?: number;
    /** Error message if failed */
    error?: string;
    /** Source-specific metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Fetched content from a source
 */
interface FetchedContent {
    /** Whether fetch succeeded */
    success: boolean;
    /** Reference that was fetched */
    reference: string;
    /** The actual content */
    content: unknown;
    /** Content type hint (text, html, json, binary, etc.) */
    contentType?: string;
    /** Size in bytes */
    sizeBytes?: number;
    /** Error message if failed */
    error?: string;
    /** Source-specific metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Options for search operations
 */
interface SearchOptions {
    /** Maximum results to return */
    maxResults?: number;
    /** Minimum relevance score (0-1) */
    minRelevance?: number;
    /** Source-specific options */
    sourceOptions?: Record<string, unknown>;
}
/**
 * Options for fetch operations
 */
interface FetchOptions {
    /** Maximum content size to fetch (bytes) */
    maxSize?: number;
    /** Timeout in milliseconds */
    timeoutMs?: number;
    /** Source-specific options */
    sourceOptions?: Record<string, unknown>;
}
/**
 * Generic research source interface
 *
 * Implement this interface to add any data source to ResearchAgent:
 * - Web: search queries, fetch URLs
 * - Vector DB: similarity search, fetch documents
 * - File system: glob patterns, read files
 * - API: query endpoints, fetch resources
 */
interface IResearchSource {
    /** Unique name for this source */
    readonly name: string;
    /** Human-readable description */
    readonly description: string;
    /** Type of source (for categorization) */
    readonly type: 'web' | 'vector' | 'file' | 'api' | 'database' | 'custom';
    /**
     * Search this source for relevant results
     *
     * @param query - Search query (interpreted by source)
     * @param options - Search options
     * @returns Search response with results
     */
    search(query: string, options?: SearchOptions): Promise<SearchResponse>;
    /**
     * Fetch full content for a result
     *
     * @param reference - Reference from SourceResult
     * @param options - Fetch options
     * @returns Fetched content
     */
    fetch(reference: string, options?: FetchOptions): Promise<FetchedContent>;
    /**
     * Optional: Check if source is available/configured
     */
    isAvailable?(): Promise<boolean>;
    /**
     * Optional: Get source capabilities
     */
    getCapabilities?(): SourceCapabilities;
}
/**
 * Source capabilities for discovery
 */
interface SourceCapabilities {
    /** Whether source supports search */
    canSearch: boolean;
    /** Whether source supports fetch */
    canFetch: boolean;
    /** Whether results include relevance scores */
    hasRelevanceScores: boolean;
    /** Maximum results per search */
    maxResultsPerSearch?: number;
    /** Supported content types */
    contentTypes?: string[];
}
/**
 * Research finding stored in memory
 */
interface ResearchFinding {
    /** Source that provided this finding */
    source: string;
    /** Original query that found this */
    query: string;
    /** Key insight or summary */
    summary: string;
    /** Supporting details */
    details?: string;
    /** References used */
    references: string[];
    /** Confidence level (0-1) */
    confidence?: number;
    /** When this was found */
    timestamp: number;
}
/**
 * Research plan for systematic research
 */
interface ResearchPlan {
    /** Research goal/question */
    goal: string;
    /** Queries to execute */
    queries: ResearchQuery[];
    /** Sources to use (empty = all available) */
    sources?: string[];
    /** Maximum results per query */
    maxResultsPerQuery?: number;
    /** Maximum total findings */
    maxTotalFindings?: number;
}
/**
 * A query in the research plan
 */
interface ResearchQuery {
    /** Query string */
    query: string;
    /** Specific sources for this query (empty = all) */
    sources?: string[];
    /** Priority (higher = more important) */
    priority?: number;
}
/**
 * Research execution result
 */
interface ResearchResult {
    /** Whether research completed successfully */
    success: boolean;
    /** Original goal */
    goal: string;
    /** Queries executed */
    queriesExecuted: number;
    /** Results found */
    resultsFound: number;
    /** Results processed */
    resultsProcessed: number;
    /** Findings generated */
    findingsCount: number;
    /** Final synthesis (if generated) */
    synthesis?: string;
    /** Error if failed */
    error?: string;
    /** Execution metrics */
    metrics?: {
        totalDurationMs: number;
        searchDurationMs: number;
        processDurationMs: number;
        synthesizeDurationMs: number;
    };
}
/**
 * Research progress event
 */
interface ResearchProgress {
    phase: 'searching' | 'processing' | 'synthesizing' | 'complete';
    currentQuery?: string;
    currentSource?: string;
    queriesCompleted: number;
    totalQueries: number;
    resultsProcessed: number;
    totalResults: number;
    findingsGenerated: number;
}

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
    /**
     * Estimate tokens for an image.
     * @param width - Image width in pixels (if known)
     * @param height - Image height in pixels (if known)
     * @param detail - Image detail level: 'low', 'high', or 'auto'
     */
    estimateImageTokens?(width?: number, height?: number, detail?: string): number;
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
 * Summarize Compactor
 *
 * Uses LLM to create intelligent summaries of context components before compaction.
 * This preserves the semantic meaning of content while reducing token count.
 *
 * Supports different summarization strategies based on content type:
 * - Conversation history: Preserves decisions, facts, and preferences
 * - Tool outputs (search/scrape): Preserves key findings, sources, and data
 */

/**
 * Configuration for the SummarizeCompactor
 */
interface SummarizeCompactorConfig {
    /** Text provider for LLM-based summarization */
    textProvider: ITextProvider;
    /** Model to use for summarization (optional - uses provider default) */
    model?: string;
    /** Maximum tokens for the summary (default: 500) */
    maxSummaryTokens?: number;
    /** Preserve markdown structure like headings and lists (default: true) */
    preserveStructure?: boolean;
    /** Fall back to truncation if LLM summarization fails (default: true) */
    fallbackToTruncate?: boolean;
    /** Temperature for summarization (default: 0.3 for deterministic output) */
    temperature?: number;
}
/**
 * SummarizeCompactor - LLM-based context compaction
 *
 * Uses AI to intelligently summarize content, preserving semantic meaning
 * while significantly reducing token count.
 */
declare class SummarizeCompactor implements IContextCompactor {
    readonly name = "summarize";
    readonly priority = 5;
    private config;
    private estimator;
    constructor(estimator: ITokenEstimator, config: SummarizeCompactorConfig);
    /**
     * Check if this compactor can handle the component
     */
    canCompact(component: IContextComponent): boolean;
    /**
     * Compact the component by summarizing its content
     */
    compact(component: IContextComponent, targetTokens: number): Promise<IContextComponent>;
    /**
     * Estimate how many tokens could be saved by summarization
     */
    estimateSavings(component: IContextComponent): number;
    /**
     * Perform LLM-based summarization
     */
    private summarize;
    /**
     * Fallback to simple truncation when LLM fails
     */
    private truncateFallback;
    /**
     * Detect content type from component metadata or name
     */
    private detectContentType;
    /**
     * Convert content to string for processing
     */
    private stringifyContent;
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
    /**
     * Estimate tokens for an image using tile-based model (matches OpenAI pricing).
     *
     * - detail='low': 85 tokens
     * - detail='high' with known dimensions: 85 + 170 per 512×512 tile
     * - Unknown dimensions: 1000 tokens (conservative default)
     */
    estimateImageTokens(width?: number, height?: number, detail?: string): number;
}

/**
 * Token estimators
 */

/**
 * Create token estimator from name
 */
declare function createEstimator(name: string): ITokenEstimator;

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
 * FilePersistentInstructionsStorage - File-based storage for persistent instructions
 *
 * Stores custom agent instructions as a JSON file on disk.
 * Path: ~/.oneringai/agents/<agentId>/custom_instructions.json
 * Windows: %APPDATA%/oneringai/agents/<agentId>/custom_instructions.json
 *
 * Features:
 * - Cross-platform path handling
 * - Safe agent ID sanitization
 * - Atomic file operations
 * - Automatic directory creation
 * - Legacy .md file migration
 */

/**
 * Configuration for FilePersistentInstructionsStorage
 */
interface FilePersistentInstructionsStorageConfig {
    /** Agent ID (used to create unique storage path) */
    agentId: string;
    /** Override the base directory (default: ~/.oneringai/agents) */
    baseDirectory?: string;
    /** Override the filename (default: custom_instructions.json) */
    filename?: string;
}
/**
 * File-based storage for persistent agent instructions
 */
declare class FilePersistentInstructionsStorage implements IPersistentInstructionsStorage {
    private readonly directory;
    private readonly filePath;
    private readonly legacyFilePath;
    private readonly agentId;
    constructor(config: FilePersistentInstructionsStorageConfig);
    /**
     * Load instruction entries from file.
     * Falls back to legacy .md file migration if JSON not found.
     */
    load(): Promise<InstructionEntry[] | null>;
    /**
     * Save instruction entries to file as JSON.
     * Creates directory if it doesn't exist.
     * Cleans up legacy .md file if present.
     */
    save(entries: InstructionEntry[]): Promise<void>;
    /**
     * Delete instructions file (and legacy .md if exists)
     */
    delete(): Promise<void>;
    /**
     * Check if instructions file exists (JSON or legacy .md)
     */
    exists(): Promise<boolean>;
    /**
     * Get the file path (for display/debugging)
     */
    getPath(): string;
    /**
     * Get the agent ID
     */
    getAgentId(): string;
    /**
     * Ensure the directory exists
     */
    private ensureDirectory;
    /**
     * Remove legacy .md file if it exists
     */
    private removeLegacyFile;
}

/**
 * FileContextStorage - File-based storage for AgentContext session persistence
 *
 * Stores context sessions as JSON files on disk.
 * Path: ~/.oneringai/agents/<agentId>/sessions/<sessionId>.json
 * Windows: %APPDATA%/oneringai/agents/<agentId>/sessions/<sessionId>.json
 *
 * Features:
 * - Cross-platform path handling
 * - Safe session ID sanitization
 * - Atomic file operations (write to temp, then rename)
 * - Automatic directory creation
 * - Index file for fast listing
 */

/**
 * Configuration for FileContextStorage
 */
interface FileContextStorageConfig {
    /** Agent ID (used to create unique storage path) */
    agentId: string;
    /** Override the base directory (default: ~/.oneringai/agents) */
    baseDirectory?: string;
    /** Pretty-print JSON (default: true for debugging, false in production) */
    prettyPrint?: boolean;
}
/**
 * File-based storage for AgentContext session persistence
 */
declare class FileContextStorage implements IContextStorage {
    private readonly agentId;
    private readonly sessionsDirectory;
    private readonly indexPath;
    private readonly prettyPrint;
    private index;
    constructor(config: FileContextStorageConfig);
    /**
     * Save context state to a session file
     */
    save(sessionId: string, state: SerializedContextState, metadata?: ContextSessionMetadata): Promise<void>;
    /**
     * Load context state from a session file
     */
    load(sessionId: string): Promise<StoredContextSession | null>;
    /**
     * Delete a session
     */
    delete(sessionId: string): Promise<void>;
    /**
     * Check if a session exists
     */
    exists(sessionId: string): Promise<boolean>;
    /**
     * List all sessions (summaries only)
     */
    list(options?: ContextStorageListOptions): Promise<ContextSessionSummary[]>;
    /**
     * Update session metadata without loading full state
     */
    updateMetadata(sessionId: string, metadata: Partial<ContextSessionMetadata>): Promise<void>;
    /**
     * Get the storage path (for display/debugging)
     * @deprecated Use getLocation() instead
     */
    getPath(): string;
    /**
     * Get a human-readable storage location string (for display/debugging)
     */
    getLocation(): string;
    /**
     * Get the agent ID
     */
    getAgentId(): string;
    /**
     * Rebuild the index by scanning all session files
     * Useful for recovery or migration
     */
    rebuildIndex(): Promise<void>;
    private getFilePath;
    private ensureDirectory;
    private loadRaw;
    private loadIndex;
    private saveIndex;
    private updateIndex;
    private removeFromIndex;
    private storedToIndexEntry;
}
/**
 * Create a FileContextStorage for the given agent
 *
 * @param agentId - Agent ID
 * @param options - Optional configuration
 * @returns FileContextStorage instance
 *
 * @example
 * ```typescript
 * const storage = createFileContextStorage('my-agent');
 * const ctx = AgentContext.create({
 *   model: 'gpt-4',
 *   storage,
 * });
 *
 * // Save session
 * await ctx.save('session-001', { title: 'My Session' });
 *
 * // Load session
 * await ctx.load('session-001');
 * ```
 */
declare function createFileContextStorage(agentId: string, options?: Omit<FileContextStorageConfig, 'agentId'>): FileContextStorage;

/**
 * FileAgentDefinitionStorage - File-based storage for agent definitions
 *
 * Stores agent definitions as JSON files on disk.
 * Path: ~/.oneringai/agents/<agentId>/definition.json
 * Windows: %APPDATA%/oneringai/agents/<agentId>/definition.json
 *
 * Features:
 * - Cross-platform path handling
 * - Safe agent ID sanitization
 * - Atomic file operations
 * - Automatic directory creation
 * - Index file for fast listing
 */

/**
 * Configuration for FileAgentDefinitionStorage
 */
interface FileAgentDefinitionStorageConfig {
    /** Override the base directory (default: ~/.oneringai/agents) */
    baseDirectory?: string;
    /** Pretty-print JSON (default: true) */
    prettyPrint?: boolean;
}
/**
 * File-based storage for agent definitions
 */
declare class FileAgentDefinitionStorage implements IAgentDefinitionStorage {
    private readonly baseDirectory;
    private readonly indexPath;
    private readonly prettyPrint;
    private index;
    constructor(config?: FileAgentDefinitionStorageConfig);
    /**
     * Save an agent definition
     */
    save(definition: StoredAgentDefinition): Promise<void>;
    /**
     * Load an agent definition
     */
    load(agentId: string): Promise<StoredAgentDefinition | null>;
    /**
     * Delete an agent definition
     */
    delete(agentId: string): Promise<void>;
    /**
     * Check if an agent definition exists
     */
    exists(agentId: string): Promise<boolean>;
    /**
     * List all agent definitions
     */
    list(options?: AgentDefinitionListOptions): Promise<AgentDefinitionSummary[]>;
    /**
     * Update metadata without loading full definition
     */
    updateMetadata(agentId: string, metadata: Partial<AgentDefinitionMetadata>): Promise<void>;
    /**
     * Get storage path
     */
    getPath(): string;
    /**
     * Rebuild the index by scanning all agent directories
     */
    rebuildIndex(): Promise<void>;
    private ensureDirectory;
    private loadRaw;
    private loadIndex;
    private saveIndex;
    private updateIndex;
    private removeFromIndex;
    private definitionToIndexEntry;
}
/**
 * Create a FileAgentDefinitionStorage with default configuration
 */
declare function createFileAgentDefinitionStorage(config?: FileAgentDefinitionStorageConfig): FileAgentDefinitionStorage;

/**
 * FileMediaStorage - File-based media storage implementation
 *
 * Saves generated media to a configurable directory on the local filesystem.
 * Default output directory: `os.tmpdir()/oneringai-media/`
 */

interface FileMediaStorageConfig {
    /** Directory to store media files. Defaults to `os.tmpdir()/oneringai-media/` */
    outputDir?: string;
}
declare class FileMediaStorage implements IMediaStorage {
    private outputDir;
    private initialized;
    constructor(config?: FileMediaStorageConfig);
    save(data: Buffer, metadata: MediaStorageMetadata): Promise<MediaStorageResult>;
    read(location: string): Promise<Buffer | null>;
    delete(location: string): Promise<void>;
    exists(location: string): Promise<boolean>;
    list(options?: MediaStorageListOptions): Promise<MediaStorageEntry[]>;
    getPath(): string;
    private generateFilename;
    private ensureDir;
}
/**
 * Factory function for creating FileMediaStorage instances
 */
declare function createFileMediaStorage(config?: FileMediaStorageConfig): FileMediaStorage;

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
    /** Supported resolutions (e.g., '720p', '1080p', '720x1280') */
    resolutions: string[];
    /** Supported aspect ratios (e.g., '16:9', '9:16') - for vendors that use this instead of resolution */
    aspectRatios?: string[];
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
        readonly VEO_3_1_FAST: "veo-3.1-fast-generate-preview";
        readonly VEO_3_1: "veo-3.1-generate-preview";
    };
    readonly grok: {
        readonly GROK_IMAGINE_VIDEO: "grok-imagine-video";
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
        status: "in_progress" | "completed" | "failed" | "incomplete";
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
        status: "in_progress" | "completed" | "failed" | "incomplete";
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
/**
 * Detailed budget information for context overflow diagnosis
 */
interface ContextOverflowBudget {
    actualTokens: number;
    maxTokens: number;
    overageTokens: number;
    breakdown: Record<string, number>;
    degradationLog: string[];
}
/**
 * Error thrown when context cannot be reduced to fit within limits
 * after all graceful degradation levels have been exhausted.
 */
declare class ContextOverflowError extends AIError {
    /** Detailed budget information for debugging */
    readonly budget: ContextOverflowBudget;
    constructor(message: string, 
    /** Detailed budget information for debugging */
    budget: ContextOverflowBudget);
    /**
     * Get a formatted summary of what was tried
     */
    getDegradationSummary(): string;
    /**
     * Get the top token consumers
     */
    getTopConsumers(count?: number): Array<{
        component: string;
        tokens: number;
    }>;
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
 * Factory function type for creating service-specific tools.
 * Takes a Connector and returns an array of tools that use it.
 *
 * The `userId` parameter is a legacy fallback — tools should prefer reading
 * userId from ToolContext at execution time (auto-populated by Agent).
 * Factory userId is used as fallback when ToolContext is not available.
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
    permission?: ToolPermissionConfig$1;
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
 * Options for ConnectorTools methods that accept a scoped registry
 */
interface ConnectorToolsOptions {
    /** Optional scoped registry for access-controlled connector lookup */
    registry?: IConnectorRegistry;
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
 *
 * // With scoped registry (access control)
 * const registry = Connector.scoped({ tenantId: 'acme' });
 * const tools = ConnectorTools.for('slack', undefined, { registry });
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
    static for(connectorOrName: Connector | string, userId?: string, options?: ConnectorToolsOptions): ToolFunction[];
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
    static discoverAll(userId?: string, options?: ConnectorToolsOptions): Map<string, ToolFunction[]>;
    /**
     * Find a connector by service type
     * Returns the first connector matching the service type
     *
     * @param serviceType - Service identifier
     * @returns Connector or undefined
     */
    static findConnector(serviceType: string, options?: ConnectorToolsOptions): Connector | undefined;
    /**
     * Find all connectors for a service type
     * Useful when you have multiple connectors for the same service
     *
     * @param serviceType - Service identifier
     * @returns Array of matching connectors
     */
    static findConnectors(serviceType: string, options?: ConnectorToolsOptions): Connector[];
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
 * Authenticated Fetch - Drop-in replacement for fetch() with connector-based authentication
 *
 * Supports all auth schemes configured on connectors:
 * - Bearer tokens (OAuth, JWT)
 * - Bot tokens (Discord)
 * - Basic auth (Twilio, Zendesk)
 * - Custom headers (e.g., X-Shopify-Access-Token)
 */
/**
 * Fetch with automatic authentication using connector's configured auth scheme
 *
 * Same API as standard fetch(), but with additional authProvider and optional userId parameters.
 * Authentication is handled automatically based on the connector's configuration:
 * - Bearer tokens (GitHub, Slack, Stripe)
 * - Bot tokens (Discord)
 * - Basic auth (Twilio, Zendesk)
 * - Custom headers (e.g., X-Shopify-Access-Token)
 *
 * @param url - URL to fetch (string or URL object). Can be relative if connector has baseURL.
 * @param options - Standard fetch options (DO NOT set Authorization header - it's added automatically)
 * @param authProvider - Name of registered connector (e.g., 'github', 'slack')
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
 * @example With relative URL (uses connector's baseURL):
 * ```typescript
 * const response = await authenticatedFetch(
 *   '/user/repos',  // Resolves to https://api.github.com/user/repos
 *   { method: 'GET' },
 *   'github'
 * );
 * const repos = await response.json();
 * ```
 *
 * @example Multi-user mode:
 * ```typescript
 * const response = await authenticatedFetch(
 *   '/user/repos',
 *   { method: 'GET' },
 *   'github',
 *   'user123'  // Get token for specific user
 * );
 * const repos = await response.json();
 * ```
 */
declare function authenticatedFetch(url: string | URL, options: RequestInit | undefined, authProvider: string, userId?: string): Promise<Response>;
/**
 * Create an authenticated fetch function bound to a specific connector and optionally a user
 *
 * Useful for creating reusable fetch functions for a specific API and/or user.
 * Uses connector's configured auth scheme (Bearer, Bot, Basic, custom headers).
 *
 * @param authProvider - Name of registered connector
 * @param userId - Optional user identifier to bind to (omit for single-user mode)
 * @returns Fetch function bound to that connector (and user)
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
 * @example With relative URLs:
 * ```typescript
 * const githubFetch = createAuthenticatedFetch('github');
 *
 * // Relative URLs resolved against connector's baseURL
 * const repos = await githubFetch('/user/repos');
 * const issues = await githubFetch('/user/issues');
 * ```
 *
 * @example Multi-user mode:
 * ```typescript
 * // Create fetch functions for different users
 * const aliceFetch = createAuthenticatedFetch('github', 'user123');
 * const bobFetch = createAuthenticatedFetch('github', 'user456');
 *
 * // Each uses their own token
 * const aliceRepos = await aliceFetch('/user/repos');
 * const bobRepos = await bobFetch('/user/repos');
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
     * Encrypt all values in an extra Record (vendor-specific credentials)
     */
    private encryptExtra;
    /**
     * Decrypt all values in an extra Record (vendor-specific credentials)
     */
    private decryptExtra;
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
 * Vendor Templates - Type Definitions
 *
 * Types for vendor authentication templates and registry.
 * These templates provide pre-configured auth patterns for common services.
 */

/**
 * Authentication template for a vendor
 * Defines a single authentication method (e.g., API key, OAuth user flow)
 */
interface AuthTemplate {
    /** Unique auth method ID within vendor (e.g., 'pat', 'oauth-user', 'github-app') */
    id: string;
    /** Human-readable name (e.g., 'Personal Access Token') */
    name: string;
    /** Auth type */
    type: 'api_key' | 'oauth';
    /** OAuth flow type (required when type is 'oauth') */
    flow?: 'authorization_code' | 'client_credentials' | 'jwt_bearer';
    /** When to use this auth method */
    description: string;
    /** Fields user must provide (e.g., ['apiKey'], ['clientId', 'clientSecret', 'redirectUri']) */
    requiredFields: AuthTemplateField[];
    /** Optional fields user may provide */
    optionalFields?: AuthTemplateField[];
    /** Pre-filled OAuth URLs and defaults */
    defaults: Partial<ConnectorAuth>;
    /** Common scopes for this auth method */
    scopes?: string[];
}
/**
 * Known fields that can be required/optional in auth templates
 */
type AuthTemplateField = 'apiKey' | 'clientId' | 'clientSecret' | 'redirectUri' | 'scope' | 'privateKey' | 'privateKeyPath' | 'appId' | 'installationId' | 'tenantId' | 'username' | 'subject' | 'audience' | 'userScope' | 'accountId' | 'subdomain' | 'region' | 'accessKeyId' | 'secretAccessKey' | 'applicationKey' | 'appToken' | 'signingSecret';
/**
 * Vendor template definition
 * Complete configuration for a vendor's supported authentication methods
 */
interface VendorTemplate {
    /** Unique vendor ID (matches Services.ts id, e.g., 'github', 'slack') */
    id: string;
    /** Human-readable name (e.g., 'GitHub', 'Slack') */
    name: string;
    /** Service type for ConnectorTools integration (matches serviceType in ConnectorConfig) */
    serviceType: string;
    /** Default API base URL */
    baseURL: string;
    /** API documentation URL */
    docsURL?: string;
    /** URL for setting up credentials on vendor's side */
    credentialsSetupURL?: string;
    /** All supported authentication methods */
    authTemplates: AuthTemplate[];
    /** Category from Services.ts */
    category: ServiceCategory;
    /** Additional notes about the vendor's authentication */
    notes?: string;
}
/**
 * Registry entry for a vendor (generated at build time)
 */
interface VendorRegistryEntry {
    /** Vendor ID */
    id: string;
    /** Human-readable name */
    name: string;
    /** Service type for ConnectorTools integration */
    serviceType: string;
    /** Category from Services.ts */
    category: ServiceCategory;
    /** List of supported auth method IDs */
    authMethods: string[];
    /** URL for credential setup */
    credentialsSetupURL?: string;
    /** Full vendor template (for programmatic access) */
    template: VendorTemplate;
}
/**
 * Credentials provided by user when creating connector from template
 */
type TemplateCredentials = {
    [K in AuthTemplateField]?: string;
};
/**
 * Options for creating a connector from a template
 */
interface CreateConnectorOptions {
    /** Override the default baseURL */
    baseURL?: string;
    /** Additional description for the connector */
    description?: string;
    /** Human-readable display name */
    displayName?: string;
    /** Request timeout in ms */
    timeout?: number;
    /** Enable request/response logging */
    logging?: boolean;
}

/**
 * Vendor Templates - Helper Functions
 *
 * Functions for creating connectors from vendor templates.
 */

/**
 * Get vendor template by ID
 */
declare function getVendorTemplate(vendorId: string): VendorTemplate | undefined;
/**
 * Get all vendor templates
 */
declare function getAllVendorTemplates(): VendorTemplate[];
/**
 * Get auth template for a vendor
 */
declare function getVendorAuthTemplate(vendorId: string, authId: string): AuthTemplate | undefined;
/**
 * List all vendor IDs
 */
declare function listVendorIds(): string[];
/**
 * Build ConnectorAuth from auth template and credentials
 */
declare function buildAuthConfig(authTemplate: AuthTemplate, credentials: TemplateCredentials): ConnectorAuth;
/**
 * Create a Connector from a vendor template
 *
 * @param name - Unique connector name (e.g., 'my-github', 'github-work')
 * @param vendorId - Vendor ID (e.g., 'github', 'slack')
 * @param authTemplateId - Auth method ID (e.g., 'pat', 'oauth-user')
 * @param credentials - Credentials for the auth method
 * @param options - Optional configuration
 * @returns The created Connector
 *
 * @example
 * ```typescript
 * const connector = createConnectorFromTemplate(
 *   'my-github',
 *   'github',
 *   'pat',
 *   { apiKey: process.env.GITHUB_TOKEN }
 * );
 * ```
 */
declare function createConnectorFromTemplate(name: string, vendorId: string, authTemplateId: string, credentials: TemplateCredentials, options?: CreateConnectorOptions): Connector;
/**
 * Get all tools for a connector (delegates to ConnectorTools)
 *
 * @param connectorName - Name of the connector
 * @returns Array of tools for the connector
 */
declare function getConnectorTools(connectorName: string): ToolFunction[];
/**
 * Get vendor template information for display
 */
interface VendorInfo {
    id: string;
    name: string;
    category: string;
    docsURL?: string;
    credentialsSetupURL?: string;
    authMethods: {
        id: string;
        name: string;
        type: string;
        description: string;
        requiredFields: string[];
    }[];
}
/**
 * Get vendor information suitable for display
 */
declare function getVendorInfo(vendorId: string): VendorInfo | undefined;
/**
 * List all vendors with basic info
 */
declare function listVendors(): VendorInfo[];
/**
 * List vendors by category
 */
declare function listVendorsByCategory(category: string): VendorInfo[];
/**
 * List vendors that support a specific auth type
 */
declare function listVendorsByAuthType(authType: 'api_key' | 'oauth'): VendorInfo[];
/**
 * Get credentials setup URL for a vendor
 */
declare function getCredentialsSetupURL(vendorId: string): string | undefined;
/**
 * Get docs URL for a vendor
 */
declare function getDocsURL(vendorId: string): string | undefined;

/**
 * Vendor Templates - Re-export all templates
 *
 * This file exports all vendor templates for use by the registry generator
 * and for direct access.
 */

declare const allVendorTemplates: VendorTemplate[];

/**
 * Vendor Logo Utilities
 *
 * Provides access to vendor logos using the simple-icons package.
 * All icons are SVG format and can be customized with colors.
 */
/** Simple Icons icon data structure */
interface SimpleIcon {
    title: string;
    slug: string;
    svg: string;
    path: string;
    source: string;
    hex: string;
    guidelines?: string;
    license?: {
        type: string;
        url?: string;
    };
}
/** Mapping from our vendor IDs to Simple Icons slugs */
declare const VENDOR_ICON_MAP: Record<string, string | null>;
/**
 * Vendor logo information
 */
interface VendorLogo {
    /** Vendor ID */
    vendorId: string;
    /** SVG content */
    svg: string;
    /** Brand color (hex without #) */
    hex: string;
    /** Whether this is a placeholder (no official icon) */
    isPlaceholder: boolean;
    /** Simple Icons slug (if available) */
    simpleIconsSlug?: string;
}
/**
 * Check if a vendor has a logo available
 */
declare function hasVendorLogo(vendorId: string): boolean;
/**
 * Get logo for a vendor
 *
 * @param vendorId - The vendor ID (e.g., 'github', 'slack')
 * @returns VendorLogo object or undefined if not available
 *
 * @example
 * ```typescript
 * const logo = getVendorLogo('github');
 * if (logo) {
 *   console.log(logo.svg);  // SVG content
 *   console.log(logo.hex);  // Brand color
 * }
 * ```
 */
declare function getVendorLogo(vendorId: string): VendorLogo | undefined;
/**
 * Get SVG content for a vendor logo
 *
 * @param vendorId - The vendor ID
 * @param color - Optional color override (hex without #)
 * @returns SVG string or undefined
 */
declare function getVendorLogoSvg(vendorId: string, color?: string): string | undefined;
/**
 * Get the brand color for a vendor
 *
 * @param vendorId - The vendor ID
 * @returns Hex color string (without #) or undefined
 */
declare function getVendorColor(vendorId: string): string | undefined;
/**
 * Get all available vendor logos
 *
 * @returns Map of vendor ID to VendorLogo
 */
declare function getAllVendorLogos(): Map<string, VendorLogo>;
/**
 * List vendor IDs that have logos available
 */
declare function listVendorsWithLogos(): string[];
/**
 * CDN URL for Simple Icons (useful for web applications)
 */
declare const SIMPLE_ICONS_CDN = "https://cdn.simpleicons.org";
/**
 * Get CDN URL for a vendor's logo
 *
 * @param vendorId - The vendor ID
 * @param color - Optional color (hex without #)
 * @returns CDN URL or undefined if vendor doesn't have a Simple Icons entry
 */
declare function getVendorLogoCdnUrl(vendorId: string, color?: string): string | undefined;

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
    /**
     * Document reader config for non-text file formats (PDF, DOCX, XLSX, etc.).
     * When set, read_file will automatically convert binary document formats to markdown.
     */
    documentReaderConfig?: DocumentReaderConfig;
}
/**
 * Default configuration
 */
/** FilesystemToolConfig with all base fields required (documentReaderConfig remains optional) */
type FilesystemToolConfigDefaults = Required<Omit<FilesystemToolConfig, 'documentReaderConfig'>> & Pick<FilesystemToolConfig, 'documentReaderConfig'>;
declare const DEFAULT_FILESYSTEM_CONFIG: FilesystemToolConfigDefaults;
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
    contentType: 'html' | 'json' | 'text' | 'document' | 'error';
    qualityScore: number;
    requiresJS: boolean;
    suggestedAction?: string;
    issues?: string[];
    error?: string;
    excerpt?: string;
    byline?: string;
    wasReadabilityUsed?: boolean;
    wasTruncated?: boolean;
    documentMetadata?: Record<string, unknown>;
}
declare const webFetch: ToolFunction<WebFetchArgs, WebFetchResult>;

/**
 * Web Search Tool Factory
 *
 * Creates a web_search tool bound to a specific Connector.
 * Follows the ConnectorTools pattern (like GitHub tools).
 *
 * Usage:
 *   ConnectorTools.registerService('serper', (connector) => [createWebSearchTool(connector)]);
 *   // or directly:
 *   const tool = createWebSearchTool(myConnector);
 */

/**
 * Arguments for web_search tool
 */
interface WebSearchArgs {
    /** Search query string */
    query: string;
    /** Number of results to return (default: 10) */
    numResults?: number;
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
/**
 * Create a web_search tool bound to a specific connector.
 *
 * @param connector - Connector instance providing auth for the search API
 */
declare function createWebSearchTool(connector: Connector): ToolFunction<WebSearchArgs, WebSearchResult>;

/**
 * Web Scrape Tool Factory
 *
 * Creates a web_scrape tool bound to a specific Connector.
 * Follows the ConnectorTools pattern (like GitHub tools).
 *
 * Fallback chain:
 * 1. Native fetch (free/fast) via webFetch
 * 2. External API via the bound connector (e.g., ZenRows, Firecrawl)
 *
 * Usage:
 *   ConnectorTools.registerService('zenrows', (connector) => [createWebScrapeTool(connector)]);
 *   // or directly:
 *   const tool = createWebScrapeTool(myConnector);
 */

/**
 * Arguments for web_scrape tool
 */
interface WebScrapeArgs {
    /** URL to scrape */
    url: string;
    /** Timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Whether to include raw HTML in response */
    includeHtml?: boolean;
    /** Whether to convert to markdown (if supported) */
    includeMarkdown?: boolean;
    /** Whether to extract links */
    includeLinks?: boolean;
    /** CSS selector to wait for (for JS-heavy sites) */
    waitForSelector?: string;
}
interface WebScrapeResult {
    /** Whether scraping succeeded */
    success: boolean;
    /** URL that was scraped */
    url: string;
    /** Final URL after redirects */
    finalUrl?: string;
    /** Method used: 'native' or external provider name */
    method: string;
    /** Page title */
    title: string;
    /** Extracted text content */
    content: string;
    /** Raw HTML (if requested) */
    html?: string;
    /** Markdown version (if requested and supported) */
    markdown?: string;
    /** Extracted metadata */
    metadata?: ScrapeResult['metadata'];
    /** Extracted links (if requested) */
    links?: ScrapeResult['links'];
    /** Quality score (0-100) */
    qualityScore?: number;
    /** Time taken in milliseconds */
    durationMs: number;
    /** Methods attempted before success */
    attemptedMethods: string[];
    /** Error message if failed */
    error?: string;
}
/**
 * Create a web_scrape tool bound to a specific connector.
 *
 * @param connector - Connector instance providing auth for the scrape API
 */
declare function createWebScrapeTool(connector: Connector): ToolFunction<WebScrapeArgs, WebScrapeResult>;

/**
 * JavaScript Execution Tool
 * Executes JavaScript in a sandboxed VM with connector integration.
 * Connectors provide authenticated access to external APIs (GitHub, Slack, etc.)
 *
 * Key features:
 * - userId auto-injected from ToolContext into authenticatedFetch calls
 * - Connector list always scoped to current userId via global access policy
 * - Dynamic description regenerated at each LLM call with current connectors
 * - Configurable timeout per invocation
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
 * Options for creating the execute_javascript tool.
 */
interface ExecuteJavaScriptToolOptions {
    /**
     * Maximum allowed timeout in milliseconds for code execution.
     * The LLM can request up to this value via the `timeout` parameter.
     * Default: 30000 (30s). Set higher for long-running API calls.
     */
    maxTimeout?: number;
    /**
     * Default timeout in milliseconds when not specified by the LLM.
     * Default: 10000 (10s).
     */
    defaultTimeout?: number;
}
/**
 * Create an execute_javascript tool.
 *
 * The tool uses `descriptionFactory` to generate a dynamic description that
 * always reflects the connectors available to the current user. Connector
 * visibility is determined by the global access policy (if set) scoped by
 * the agent's userId from ToolContext.
 *
 * @param options - Optional configuration for timeout limits
 */
declare function createExecuteJavaScriptTool(options?: ExecuteJavaScriptToolOptions): ToolFunction<ExecuteJSArgs, ExecuteJSResult>;
/**
 * Default executeJavaScript tool instance.
 *
 * Uses the global connector registry (scoped by userId at runtime).
 * For custom timeouts, use createExecuteJavaScriptTool(options).
 */
declare const executeJavaScript: ToolFunction<ExecuteJSArgs, ExecuteJSResult>;

/**
 * Module-level configuration for multimedia output storage
 *
 * Provides a global default media storage used by all tool factories
 * when called through ConnectorTools.registerService().
 *
 * @example
 * ```typescript
 * import { setMediaStorage } from '@everworker/oneringai';
 *
 * // Use custom S3 storage before creating agents
 * setMediaStorage(myS3Storage);
 * ```
 */

/**
 * Get the global media storage (creates default FileMediaStorage on first access)
 */
declare function getMediaStorage(): IMediaStorage;
/**
 * Set a custom global media storage
 *
 * Call this before agent creation to use custom storage (S3, GCS, etc.)
 */
declare function setMediaStorage(storage: IMediaStorage): void;
/** @deprecated Use `getMediaStorage()` instead */
declare const getMediaOutputHandler: typeof getMediaStorage;
/** @deprecated Use `setMediaStorage()` instead */
declare const setMediaOutputHandler: typeof setMediaStorage;

/**
 * Image generation tool factory
 *
 * Creates a `generate_image` ToolFunction that wraps ImageGeneration capability.
 * Parameters are built dynamically from the model registry for the connector's vendor.
 */

interface GenerateImageArgs {
    prompt: string;
    model?: string;
    size?: string;
    quality?: string;
    style?: string;
    n?: number;
    aspectRatio?: string;
}
interface GenerateImageResult {
    success: boolean;
    images?: Array<{
        location: string;
        mimeType: string;
        revisedPrompt?: string;
    }>;
    error?: string;
}
declare function createImageGenerationTool(connector: Connector, storage?: IMediaStorage, userId?: string): ToolFunction<GenerateImageArgs, GenerateImageResult>;

/**
 * Video generation tool factories
 *
 * Creates `generate_video` and `video_status` ToolFunctions
 * that wrap VideoGeneration capability. Video generation is async,
 * so two tools are needed: one to start and one to check status/download.
 */

declare function createVideoTools(connector: Connector, storage?: IMediaStorage, userId?: string): ToolFunction[];

/**
 * Text-to-speech tool factory
 *
 * Creates a `text_to_speech` ToolFunction that wraps TextToSpeech capability.
 * Parameters are built dynamically from the TTS model registry for the connector's vendor.
 */

interface TextToSpeechArgs {
    text: string;
    model?: string;
    voice?: string;
    format?: string;
    speed?: number;
}
interface TextToSpeechResult {
    success: boolean;
    location?: string;
    format?: string;
    mimeType?: string;
    error?: string;
}
declare function createTextToSpeechTool(connector: Connector, storage?: IMediaStorage, userId?: string): ToolFunction<TextToSpeechArgs, TextToSpeechResult>;

/**
 * Speech-to-text tool factory
 *
 * Creates a `speech_to_text` ToolFunction that wraps SpeechToText capability.
 * Parameters are built dynamically from the STT model registry for the connector's vendor.
 */

interface SpeechToTextArgs {
    audioSource: string;
    model?: string;
    language?: string;
    prompt?: string;
}
interface SpeechToTextResult {
    success: boolean;
    text?: string;
    language?: string;
    durationSeconds?: number;
    error?: string;
}
declare function createSpeechToTextTool(connector: Connector, storage?: IMediaStorage): ToolFunction<SpeechToTextArgs, SpeechToTextResult>;

/**
 * GitHub Tools - Shared Types and Helpers
 *
 * Foundation for all GitHub connector tools.
 * Provides repository resolution, authenticated fetch, and result types.
 */

/**
 * Parsed GitHub repository reference
 */
interface GitHubRepository {
    owner: string;
    repo: string;
}
/**
 * Parse a repository string into owner and repo.
 *
 * Accepts:
 * - "owner/repo" format
 * - Full GitHub URLs: "https://github.com/owner/repo", "https://github.com/owner/repo/..."
 *
 * @throws Error if the format is not recognized
 */
declare function parseRepository(input: string): GitHubRepository;
/**
 * Resolve a repository from tool args or connector default.
 *
 * Priority:
 * 1. Explicit `repository` parameter
 * 2. `connector.getOptions().defaultRepository`
 *
 * @returns GitHubRepository or an error result
 */
declare function resolveRepository(repository: string | undefined, connector: Connector): {
    success: true;
    repo: GitHubRepository;
} | {
    success: false;
    error: string;
};
/**
 * Result from search_files tool
 */
interface GitHubSearchFilesResult {
    success: boolean;
    files?: {
        path: string;
        size: number;
        type: string;
    }[];
    count?: number;
    truncated?: boolean;
    error?: string;
}
/**
 * Result from search_code tool
 */
interface GitHubSearchCodeResult {
    success: boolean;
    matches?: {
        file: string;
        fragment?: string;
    }[];
    count?: number;
    truncated?: boolean;
    error?: string;
}
/**
 * Result from read_file tool (GitHub variant)
 */
interface GitHubReadFileResult {
    success: boolean;
    content?: string;
    path?: string;
    size?: number;
    lines?: number;
    truncated?: boolean;
    sha?: string;
    error?: string;
}
/**
 * Result from get_pr tool
 */
interface GitHubGetPRResult {
    success: boolean;
    data?: {
        number: number;
        title: string;
        body: string | null;
        state: string;
        author: string;
        labels: string[];
        reviewers: string[];
        mergeable: boolean | null;
        head: string;
        base: string;
        url: string;
        created_at: string;
        updated_at: string;
        additions: number;
        deletions: number;
        changed_files: number;
        draft: boolean;
    };
    error?: string;
}
/**
 * Result from pr_files tool
 */
interface GitHubPRFilesResult {
    success: boolean;
    files?: {
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        changes: number;
        patch?: string;
    }[];
    count?: number;
    error?: string;
}
/**
 * A unified comment/review entry
 */
interface GitHubPRCommentEntry {
    id: number;
    type: 'review' | 'comment' | 'review_comment';
    author: string;
    body: string;
    created_at: string;
    path?: string;
    line?: number;
    state?: string;
}
/**
 * Result from pr_comments tool
 */
interface GitHubPRCommentsResult {
    success: boolean;
    comments?: GitHubPRCommentEntry[];
    count?: number;
    error?: string;
}
/**
 * Result from create_pr tool
 */
interface GitHubCreatePRResult {
    success: boolean;
    data?: {
        number: number;
        url: string;
        state: string;
        title: string;
    };
    error?: string;
}

/**
 * GitHub Search Files Tool
 *
 * Search for files by glob pattern in a GitHub repository.
 * Mirrors the local `glob` tool for remote GitHub repos.
 *
 * Uses the Git Trees API to fetch the full file tree, then filters client-side.
 */

/**
 * Arguments for the search_files tool
 */
interface SearchFilesArgs {
    /** Repository in "owner/repo" format or full GitHub URL */
    repository?: string;
    /** Glob pattern to match files (e.g., "**\/*.ts", "src/**\/*.tsx") */
    pattern: string;
    /** Branch, tag, or SHA (defaults to repo's default branch) */
    ref?: string;
}
/**
 * Create a GitHub search_files tool
 */
declare function createSearchFilesTool(connector: Connector, userId?: string): ToolFunction<SearchFilesArgs, GitHubSearchFilesResult>;

/**
 * GitHub Search Code Tool
 *
 * Search for code content across a GitHub repository.
 * Mirrors the local `grep` tool for remote GitHub repos.
 *
 * Uses the GitHub Code Search API with text-match support.
 *
 * Note: GitHub's code search API has a rate limit of 30 requests/minute.
 */

/**
 * Arguments for the search_code tool
 */
interface SearchCodeArgs {
    /** Repository in "owner/repo" format or full GitHub URL */
    repository?: string;
    /** Search query (keyword or phrase) */
    query: string;
    /** Filter by programming language (e.g., "typescript", "python") */
    language?: string;
    /** Filter by file path (e.g., "src/", "lib/utils") */
    path?: string;
    /** Filter by file extension (e.g., "ts", "py") */
    extension?: string;
    /** Maximum number of results (default: 30, max: 100) */
    limit?: number;
}
/**
 * Create a GitHub search_code tool
 */
declare function createSearchCodeTool(connector: Connector, userId?: string): ToolFunction<SearchCodeArgs, GitHubSearchCodeResult>;

/**
 * GitHub Read File Tool
 *
 * Read file content from a GitHub repository.
 * Mirrors the local `read_file` tool for remote GitHub repos.
 *
 * Supports line range selection (offset/limit) and formats output
 * with line numbers matching the local read_file tool.
 */

/**
 * Arguments for the GitHub read_file tool
 */
interface GitHubReadFileArgs {
    /** Repository in "owner/repo" format or full GitHub URL */
    repository?: string;
    /** File path within the repository (e.g., "src/index.ts") */
    path: string;
    /** Branch, tag, or commit SHA. Defaults to the repository's default branch. */
    ref?: string;
    /** Line number to start reading from (1-indexed). Useful for large files. */
    offset?: number;
    /** Number of lines to read (default: 2000). */
    limit?: number;
}
/**
 * Create a GitHub read_file tool
 */
declare function createGitHubReadFileTool(connector: Connector, userId?: string): ToolFunction<GitHubReadFileArgs, GitHubReadFileResult>;

/**
 * GitHub Get PR Tool
 *
 * Get full details of a pull request from a GitHub repository.
 */

/**
 * Arguments for the get_pr tool
 */
interface GetPRArgs {
    /** Repository in "owner/repo" format or full GitHub URL */
    repository?: string;
    /** Pull request number */
    pull_number: number;
}
/**
 * Create a GitHub get_pr tool
 */
declare function createGetPRTool(connector: Connector, userId?: string): ToolFunction<GetPRArgs, GitHubGetPRResult>;

/**
 * GitHub PR Files Tool
 *
 * Get the files changed in a pull request, including diffs.
 */

/**
 * Arguments for the pr_files tool
 */
interface PRFilesArgs {
    /** Repository in "owner/repo" format or full GitHub URL */
    repository?: string;
    /** Pull request number */
    pull_number: number;
}
/**
 * Create a GitHub pr_files tool
 */
declare function createPRFilesTool(connector: Connector, userId?: string): ToolFunction<PRFilesArgs, GitHubPRFilesResult>;

/**
 * GitHub PR Comments Tool
 *
 * Get all comments and reviews on a pull request.
 * Merges three types: review comments (line-level), reviews, and issue comments.
 */

/**
 * Arguments for the pr_comments tool
 */
interface PRCommentsArgs {
    /** Repository in "owner/repo" format or full GitHub URL */
    repository?: string;
    /** Pull request number */
    pull_number: number;
}
/**
 * Create a GitHub pr_comments tool
 */
declare function createPRCommentsTool(connector: Connector, userId?: string): ToolFunction<PRCommentsArgs, GitHubPRCommentsResult>;

/**
 * GitHub Create PR Tool
 *
 * Create a pull request on a GitHub repository.
 */

/**
 * Arguments for the create_pr tool
 */
interface CreatePRArgs {
    /** Repository in "owner/repo" format or full GitHub URL */
    repository?: string;
    /** Pull request title */
    title: string;
    /** Pull request description/body (Markdown supported) */
    body?: string;
    /** Source branch name (the branch with your changes) */
    head: string;
    /** Target branch name (the branch you want to merge into) */
    base: string;
    /** Create as a draft pull request */
    draft?: boolean;
}
/**
 * Create a GitHub create_pr tool
 */
declare function createCreatePRTool(connector: Connector, userId?: string): ToolFunction<CreatePRArgs, GitHubCreatePRResult>;

/**
 * Desktop Automation Tools - Types
 *
 * Interfaces and types for OS-level desktop automation (screenshot, mouse, keyboard, windows).
 * All coordinates are in PHYSICAL pixel space (screenshot space).
 * The driver converts to logical OS coords internally using scaleFactor.
 */
type MouseButton = 'left' | 'right' | 'middle';
interface DesktopPoint {
    x: number;
    y: number;
}
interface DesktopScreenSize {
    /** Physical pixel width (screenshot space) */
    physicalWidth: number;
    /** Physical pixel height (screenshot space) */
    physicalHeight: number;
    /** Logical OS width */
    logicalWidth: number;
    /** Logical OS height */
    logicalHeight: number;
    /** Scale factor (physical / logical), e.g. 2.0 on Retina */
    scaleFactor: number;
}
interface DesktopScreenshot {
    /** Base64-encoded PNG image data */
    base64: string;
    /** Width in physical pixels */
    width: number;
    /** Height in physical pixels */
    height: number;
}
interface DesktopWindow {
    /** Window identifier (platform-specific) */
    id: number;
    /** Window title */
    title: string;
    /** Application name */
    appName?: string;
    /** Window bounds in physical pixel coords */
    bounds?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
interface IDesktopDriver {
    /** Initialize the driver (dynamic import, permission checks, scale detection) */
    initialize(): Promise<void>;
    /** Whether the driver is initialized */
    readonly isInitialized: boolean;
    /** Current scale factor (physical / logical) */
    readonly scaleFactor: number;
    screenshot(region?: {
        x: number;
        y: number;
        width: number;
        height: number;
    }): Promise<DesktopScreenshot>;
    getScreenSize(): Promise<DesktopScreenSize>;
    mouseMove(x: number, y: number): Promise<void>;
    mouseClick(x: number, y: number, button: MouseButton, clickCount: number): Promise<void>;
    mouseDrag(startX: number, startY: number, endX: number, endY: number, button: MouseButton): Promise<void>;
    mouseScroll(deltaX: number, deltaY: number, x?: number, y?: number): Promise<void>;
    getCursorPosition(): Promise<DesktopPoint>;
    keyboardType(text: string, delay?: number): Promise<void>;
    keyboardKey(keys: string): Promise<void>;
    getWindowList(): Promise<DesktopWindow[]>;
    focusWindow(windowId: number): Promise<void>;
}
interface DesktopToolConfig {
    /** Custom driver implementation (defaults to NutTreeDriver) */
    driver?: IDesktopDriver;
    /**
     * Human-like delay range in ms added between actions.
     * Set to [0, 0] for instant actions.
     * Default: [50, 150]
     */
    humanDelay?: [number, number];
    /**
     * Whether to humanize mouse movements (curved path vs instant teleport).
     * Default: false
     */
    humanizeMovement?: boolean;
}
declare const DEFAULT_DESKTOP_CONFIG: Required<DesktopToolConfig>;
/**
 * Apply a random human-like delay based on config.
 */
declare function applyHumanDelay(config: DesktopToolConfig): Promise<void>;
interface DesktopScreenshotArgs {
    region?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
interface DesktopScreenshotResult {
    success: boolean;
    width?: number;
    height?: number;
    /** Base64 PNG for text summary */
    base64?: string;
    /** Image array for multimodal provider handling */
    __images?: Array<{
        base64: string;
        mediaType: string;
    }>;
    error?: string;
}
interface DesktopMouseMoveArgs {
    x: number;
    y: number;
}
interface DesktopMouseMoveResult {
    success: boolean;
    x?: number;
    y?: number;
    error?: string;
}
interface DesktopMouseClickArgs {
    x?: number;
    y?: number;
    button?: MouseButton;
    clickCount?: number;
}
interface DesktopMouseClickResult {
    success: boolean;
    x?: number;
    y?: number;
    button?: MouseButton;
    clickCount?: number;
    error?: string;
}
interface DesktopMouseDragArgs {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    button?: MouseButton;
}
interface DesktopMouseDragResult {
    success: boolean;
    error?: string;
}
interface DesktopMouseScrollArgs {
    deltaX?: number;
    deltaY?: number;
    x?: number;
    y?: number;
}
interface DesktopMouseScrollResult {
    success: boolean;
    error?: string;
}
interface DesktopGetCursorResult {
    success: boolean;
    x?: number;
    y?: number;
    error?: string;
}
interface DesktopKeyboardTypeArgs {
    text: string;
    delay?: number;
}
interface DesktopKeyboardTypeResult {
    success: boolean;
    error?: string;
}
interface DesktopKeyboardKeyArgs {
    keys: string;
}
interface DesktopKeyboardKeyResult {
    success: boolean;
    error?: string;
}
interface DesktopGetScreenSizeResult {
    success: boolean;
    physicalWidth?: number;
    physicalHeight?: number;
    logicalWidth?: number;
    logicalHeight?: number;
    scaleFactor?: number;
    error?: string;
}
interface DesktopWindowListResult {
    success: boolean;
    windows?: DesktopWindow[];
    error?: string;
}
interface DesktopWindowFocusArgs {
    windowId: number;
}
interface DesktopWindowFocusResult {
    success: boolean;
    error?: string;
}
declare const DESKTOP_TOOL_NAMES: readonly ["desktop_screenshot", "desktop_mouse_move", "desktop_mouse_click", "desktop_mouse_drag", "desktop_mouse_scroll", "desktop_get_cursor", "desktop_keyboard_type", "desktop_keyboard_key", "desktop_get_screen_size", "desktop_window_list", "desktop_window_focus"];
type DesktopToolName = (typeof DESKTOP_TOOL_NAMES)[number];

/**
 * NutTreeDriver - Desktop automation driver using @nut-tree-fork/nut-js
 *
 * Handles:
 * - Dynamic import of @nut-tree-fork/nut-js (optional peer dep)
 * - Scale factor detection for Retina/HiDPI displays
 * - Coordinate conversion: physical pixels (screenshot space) ↔ logical OS coords
 * - PNG encoding of raw RGBA screenshots
 */

/**
 * Parse a key combo string like "ctrl+c", "cmd+shift+s", "enter"
 * Returns nut-tree Key enum values.
 */
declare function parseKeyCombo(keys: string, KeyEnum: Record<string, any>): any[];
declare class NutTreeDriver implements IDesktopDriver {
    private _isInitialized;
    private _scaleFactor;
    private _nut;
    private _windowCache;
    get isInitialized(): boolean;
    get scaleFactor(): number;
    initialize(): Promise<void>;
    private assertInitialized;
    /** Convert physical (screenshot) coords to logical (OS) coords */
    private toLogical;
    /** Convert logical (OS) coords to physical (screenshot) coords */
    private toPhysical;
    screenshot(region?: {
        x: number;
        y: number;
        width: number;
        height: number;
    }): Promise<DesktopScreenshot>;
    getScreenSize(): Promise<DesktopScreenSize>;
    mouseMove(x: number, y: number): Promise<void>;
    mouseClick(x: number, y: number, button: MouseButton, clickCount: number): Promise<void>;
    mouseDrag(startX: number, startY: number, endX: number, endY: number, button: MouseButton): Promise<void>;
    mouseScroll(deltaX: number, deltaY: number, x?: number, y?: number): Promise<void>;
    getCursorPosition(): Promise<DesktopPoint>;
    keyboardType(text: string, delay?: number): Promise<void>;
    keyboardKey(keys: string): Promise<void>;
    getWindowList(): Promise<DesktopWindow[]>;
    focusWindow(windowId: number): Promise<void>;
}

/**
 * Lazy singleton driver accessor for desktop tools.
 *
 * First call initializes the driver (dynamic import + scale detection).
 * Subsequent calls reuse the same instance.
 */

/**
 * Get (or create) the desktop driver instance.
 * If config.driver is provided, uses that instead of the default.
 */
declare function getDesktopDriver(config?: DesktopToolConfig): Promise<IDesktopDriver>;
/**
 * Reset the default driver (for testing).
 */
declare function resetDefaultDriver(): void;

/**
 * Desktop Screenshot Tool
 *
 * Captures a screenshot of the entire screen or a specific region.
 * Returns base64 PNG with __images convention for multimodal provider handling.
 */

declare function createDesktopScreenshotTool(config?: DesktopToolConfig): ToolFunction<DesktopScreenshotArgs, DesktopScreenshotResult>;
declare const desktopScreenshot: ToolFunction<DesktopScreenshotArgs, DesktopScreenshotResult>;

/**
 * Desktop Mouse Move Tool
 *
 * Moves the mouse cursor to a specific position on screen.
 * Coordinates are in physical pixel space (same as screenshot pixels).
 */

declare function createDesktopMouseMoveTool(config?: DesktopToolConfig): ToolFunction<DesktopMouseMoveArgs, DesktopMouseMoveResult>;
declare const desktopMouseMove: ToolFunction<DesktopMouseMoveArgs, DesktopMouseMoveResult>;

/**
 * Desktop Mouse Click Tool
 *
 * Clicks at the current cursor position or at specified coordinates.
 * If x/y are provided, moves to that position first, then clicks.
 */

declare function createDesktopMouseClickTool(config?: DesktopToolConfig): ToolFunction<DesktopMouseClickArgs, DesktopMouseClickResult>;
declare const desktopMouseClick: ToolFunction<DesktopMouseClickArgs, DesktopMouseClickResult>;

/**
 * Desktop Mouse Drag Tool
 *
 * Drags from one position to another (press, move, release).
 */

declare function createDesktopMouseDragTool(config?: DesktopToolConfig): ToolFunction<DesktopMouseDragArgs, DesktopMouseDragResult>;
declare const desktopMouseDrag: ToolFunction<DesktopMouseDragArgs, DesktopMouseDragResult>;

/**
 * Desktop Mouse Scroll Tool
 *
 * Scrolls the mouse wheel at the current position or at specified coordinates.
 */

declare function createDesktopMouseScrollTool(config?: DesktopToolConfig): ToolFunction<DesktopMouseScrollArgs, DesktopMouseScrollResult>;
declare const desktopMouseScroll: ToolFunction<DesktopMouseScrollArgs, DesktopMouseScrollResult>;

/**
 * Desktop Get Cursor Tool
 *
 * Returns the current cursor position in physical pixel (screenshot) coordinates.
 */

declare function createDesktopGetCursorTool(config?: DesktopToolConfig): ToolFunction<Record<string, never>, DesktopGetCursorResult>;
declare const desktopGetCursor: ToolFunction<Record<string, never>, DesktopGetCursorResult>;

/**
 * Desktop Keyboard Type Tool
 *
 * Types text as if from a physical keyboard.
 */

declare function createDesktopKeyboardTypeTool(config?: DesktopToolConfig): ToolFunction<DesktopKeyboardTypeArgs, DesktopKeyboardTypeResult>;
declare const desktopKeyboardType: ToolFunction<DesktopKeyboardTypeArgs, DesktopKeyboardTypeResult>;

/**
 * Desktop Keyboard Key Tool
 *
 * Presses keyboard shortcuts or special keys (e.g., "ctrl+c", "enter", "cmd+shift+s").
 */

declare function createDesktopKeyboardKeyTool(config?: DesktopToolConfig): ToolFunction<DesktopKeyboardKeyArgs, DesktopKeyboardKeyResult>;
declare const desktopKeyboardKey: ToolFunction<DesktopKeyboardKeyArgs, DesktopKeyboardKeyResult>;

/**
 * Desktop Get Screen Size Tool
 *
 * Returns the screen dimensions (physical, logical, and scale factor).
 */

declare function createDesktopGetScreenSizeTool(config?: DesktopToolConfig): ToolFunction<Record<string, never>, DesktopGetScreenSizeResult>;
declare const desktopGetScreenSize: ToolFunction<Record<string, never>, DesktopGetScreenSizeResult>;

/**
 * Desktop Window List Tool
 *
 * Lists all visible windows with their IDs, titles, and bounds.
 */

declare function createDesktopWindowListTool(config?: DesktopToolConfig): ToolFunction<Record<string, never>, DesktopWindowListResult>;
declare const desktopWindowList: ToolFunction<Record<string, never>, DesktopWindowListResult>;

/**
 * Desktop Window Focus Tool
 *
 * Brings a specific window to the foreground by its window ID.
 */

declare function createDesktopWindowFocusTool(config?: DesktopToolConfig): ToolFunction<DesktopWindowFocusArgs, DesktopWindowFocusResult>;
declare const desktopWindowFocus: ToolFunction<DesktopWindowFocusArgs, DesktopWindowFocusResult>;

/**
 * A bundle of all desktop automation tools.
 * Includes: screenshot, mouse (move, click, drag, scroll, getCursor),
 * keyboard (type, key), screen info, and window management.
 */
declare const desktopTools: (ToolFunction<DesktopScreenshotArgs, DesktopScreenshotResult> | ToolFunction<DesktopMouseMoveArgs, DesktopMouseMoveResult> | ToolFunction<DesktopMouseClickArgs, DesktopMouseClickResult> | ToolFunction<DesktopMouseDragArgs, DesktopMouseDragResult> | ToolFunction<DesktopMouseScrollArgs, DesktopMouseScrollResult> | ToolFunction<Record<string, never>, DesktopGetCursorResult> | ToolFunction<DesktopKeyboardTypeArgs, DesktopKeyboardTypeResult> | ToolFunction<DesktopKeyboardKeyArgs, DesktopKeyboardKeyResult> | ToolFunction<Record<string, never>, DesktopGetScreenSizeResult> | ToolFunction<Record<string, never>, DesktopWindowListResult> | ToolFunction<DesktopWindowFocusArgs, DesktopWindowFocusResult>)[];

/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 *
 * Generated by: scripts/generate-tool-registry.ts
 * Generated at: 2026-02-11T15:50:06.623Z
 *
 * To regenerate: npm run generate:tools
 */

/** Tool category for grouping */
type ToolCategory = 'filesystem' | 'shell' | 'web' | 'code' | 'json' | 'connector' | 'desktop' | 'other';
/** Metadata for a tool in the registry */
interface ToolRegistryEntry {
    /** Tool name (matches definition.function.name) */
    name: string;
    /** Export variable name */
    exportName: string;
    /** Human-readable display name */
    displayName: string;
    /** Category for grouping */
    category: ToolCategory;
    /** Brief description */
    description: string;
    /** The actual tool function */
    tool: ToolFunction;
    /** Whether this tool is safe without explicit approval */
    safeByDefault: boolean;
    /** Whether this tool requires a connector */
    requiresConnector?: boolean;
    /** Supported connector service types (if requiresConnector) */
    connectorServiceTypes?: string[];
}
/** Complete registry of all built-in tools */
declare const toolRegistry: ToolRegistryEntry[];
/** Get all built-in tools as ToolFunction array */
declare function getAllBuiltInTools(): ToolFunction[];
/** Get full tool registry with metadata */
declare function getToolRegistry(): ToolRegistryEntry[];
/** Get tools by category */
declare function getToolsByCategory(category: ToolCategory): ToolRegistryEntry[];
/** Get tool by name */
declare function getToolByName(name: string): ToolRegistryEntry | undefined;
/** Get tools that require connector configuration */
declare function getToolsRequiringConnector(): ToolRegistryEntry[];
/** Get all unique category names */
declare function getToolCategories(): ToolCategory[];

/**
 * ToolRegistry - Unified registry for all tools (built-in + connector-generated)
 *
 * This class provides a single API for discovering all available tools:
 * - Built-in tools from registry.generated.ts (filesystem, shell, web, etc.)
 * - Connector tools generated at runtime by ConnectorTools
 *
 * @example
 * ```typescript
 * import { ToolRegistry } from '@everworker/oneringai';
 *
 * // Get all tools (built-in + connector)
 * const allTools = ToolRegistry.getAllTools();
 *
 * // Get only connector tools
 * const connectorTools = ToolRegistry.getAllConnectorTools();
 *
 * // Get tools for a specific connector
 * const githubTools = ToolRegistry.getConnectorTools('github');
 * ```
 */

/**
 * Extended registry entry for connector-generated tools
 */
interface ConnectorToolEntry extends ToolRegistryEntry {
    /** Name of the connector that generated this tool */
    connectorName: string;
    /** Service type (e.g., 'github', 'slack') if detected */
    serviceType?: string;
}
/**
 * Unified tool registry that combines built-in and connector tools
 */
declare class ToolRegistry {
    /**
     * Get built-in tools only (from registry.generated.ts)
     *
     * @returns Array of built-in tool registry entries
     */
    static getBuiltInTools(): ToolRegistryEntry[];
    /**
     * Get tools for a specific connector
     *
     * @param connectorName - Name of the connector to get tools for
     * @returns Array of connector tool entries
     *
     * @example
     * ```typescript
     * const githubTools = ToolRegistry.getConnectorTools('github');
     * ```
     */
    static getConnectorTools(connectorName: string): ConnectorToolEntry[];
    /**
     * Get all connector tools from all registered service connectors
     *
     * This discovers tools from all connectors that have:
     * - Explicit serviceType, OR
     * - baseURL but no vendor (external API, not AI provider)
     *
     * @returns Array of all connector tool entries
     */
    static getAllConnectorTools(): ConnectorToolEntry[];
    /**
     * Get ALL tools (built-in + connector) - main API for UIs
     *
     * This is the primary method for getting a complete list of available tools.
     *
     * @returns Array of all tool registry entries (built-in and connector)
     *
     * @example
     * ```typescript
     * const allTools = ToolRegistry.getAllTools();
     * for (const tool of allTools) {
     *   console.log(`${tool.displayName}: ${tool.description}`);
     * }
     * ```
     */
    static getAllTools(): (ToolRegistryEntry | ConnectorToolEntry)[];
    /**
     * Get tools filtered by service type
     *
     * @param serviceType - Service type to filter by (e.g., 'github', 'slack')
     * @returns Array of connector tool entries for the service
     */
    static getToolsByService(serviceType: string): ConnectorToolEntry[];
    /**
     * Get tools filtered by connector name
     *
     * @param connectorName - Connector name to filter by
     * @returns Array of connector tool entries for the connector
     */
    static getToolsByConnector(connectorName: string): ConnectorToolEntry[];
    /**
     * Check if a tool entry is a connector tool
     *
     * @param entry - Tool registry entry to check
     * @returns True if the entry is a connector tool
     */
    static isConnectorTool(entry: ToolRegistryEntry | ConnectorToolEntry): entry is ConnectorToolEntry;
    /**
     * Convert a ToolFunction to a ConnectorToolEntry
     */
    private static toRegistryEntry;
    /**
     * Derive a human-readable display name from a tool name
     *
     * @param toolName - Full tool name (e.g., "main-openai_generate_image")
     * @param contextName - Vendor or service display name (e.g., "OpenAI")
     * @param connectorName - Connector name used as prefix (e.g., "main-openai")
     */
    private static deriveDisplayName;
}

/**
 * A bundle of all developer tools commonly used for coding tasks.
 * Includes: readFile, writeFile, editFile, glob, grep, listDirectory, bash
 *
 * @example
 * ```typescript
 * import { tools } from '@everworker/oneringai';
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
type index_ConnectorToolEntry = ConnectorToolEntry;
type index_ConnectorTools = ConnectorTools;
declare const index_ConnectorTools: typeof ConnectorTools;
declare const index_DEFAULT_DESKTOP_CONFIG: typeof DEFAULT_DESKTOP_CONFIG;
declare const index_DEFAULT_FILESYSTEM_CONFIG: typeof DEFAULT_FILESYSTEM_CONFIG;
declare const index_DEFAULT_SHELL_CONFIG: typeof DEFAULT_SHELL_CONFIG;
declare const index_DESKTOP_TOOL_NAMES: typeof DESKTOP_TOOL_NAMES;
type index_DesktopGetCursorResult = DesktopGetCursorResult;
type index_DesktopGetScreenSizeResult = DesktopGetScreenSizeResult;
type index_DesktopKeyboardKeyArgs = DesktopKeyboardKeyArgs;
type index_DesktopKeyboardKeyResult = DesktopKeyboardKeyResult;
type index_DesktopKeyboardTypeArgs = DesktopKeyboardTypeArgs;
type index_DesktopKeyboardTypeResult = DesktopKeyboardTypeResult;
type index_DesktopMouseClickArgs = DesktopMouseClickArgs;
type index_DesktopMouseClickResult = DesktopMouseClickResult;
type index_DesktopMouseDragArgs = DesktopMouseDragArgs;
type index_DesktopMouseDragResult = DesktopMouseDragResult;
type index_DesktopMouseMoveArgs = DesktopMouseMoveArgs;
type index_DesktopMouseMoveResult = DesktopMouseMoveResult;
type index_DesktopMouseScrollArgs = DesktopMouseScrollArgs;
type index_DesktopMouseScrollResult = DesktopMouseScrollResult;
type index_DesktopPoint = DesktopPoint;
type index_DesktopScreenSize = DesktopScreenSize;
type index_DesktopScreenshot = DesktopScreenshot;
type index_DesktopScreenshotArgs = DesktopScreenshotArgs;
type index_DesktopScreenshotResult = DesktopScreenshotResult;
type index_DesktopToolConfig = DesktopToolConfig;
type index_DesktopToolName = DesktopToolName;
type index_DesktopWindow = DesktopWindow;
type index_DesktopWindowFocusArgs = DesktopWindowFocusArgs;
type index_DesktopWindowFocusResult = DesktopWindowFocusResult;
type index_DesktopWindowListResult = DesktopWindowListResult;
type index_DocumentFamily = DocumentFamily;
type index_DocumentFormat = DocumentFormat;
type index_DocumentImagePiece = DocumentImagePiece;
type index_DocumentMetadata = DocumentMetadata;
type index_DocumentPiece = DocumentPiece;
type index_DocumentReadOptions = DocumentReadOptions;
type index_DocumentReader = DocumentReader;
declare const index_DocumentReader: typeof DocumentReader;
type index_DocumentReaderConfig = DocumentReaderConfig;
type index_DocumentResult = DocumentResult;
type index_DocumentSource = DocumentSource;
type index_DocumentTextPiece = DocumentTextPiece;
type index_DocumentToContentOptions = DocumentToContentOptions;
type index_EditFileResult = EditFileResult;
type index_FilesystemToolConfig = FilesystemToolConfig;
type index_FormatDetectionResult = FormatDetectionResult;
type index_FormatDetector = FormatDetector;
declare const index_FormatDetector: typeof FormatDetector;
type index_GenericAPICallArgs = GenericAPICallArgs;
type index_GenericAPICallResult = GenericAPICallResult;
type index_GenericAPIToolOptions = GenericAPIToolOptions;
type index_GitHubCreatePRResult = GitHubCreatePRResult;
type index_GitHubGetPRResult = GitHubGetPRResult;
type index_GitHubPRCommentEntry = GitHubPRCommentEntry;
type index_GitHubPRCommentsResult = GitHubPRCommentsResult;
type index_GitHubPRFilesResult = GitHubPRFilesResult;
type index_GitHubReadFileResult = GitHubReadFileResult;
type index_GitHubRepository = GitHubRepository;
type index_GitHubSearchCodeResult = GitHubSearchCodeResult;
type index_GitHubSearchFilesResult = GitHubSearchFilesResult;
type index_GlobResult = GlobResult;
type index_GrepMatch = GrepMatch;
type index_GrepResult = GrepResult;
type index_IDesktopDriver = IDesktopDriver;
type index_IDocumentTransformer = IDocumentTransformer;
type index_IFormatHandler = IFormatHandler;
type index_ImageFilterOptions = ImageFilterOptions;
type index_MouseButton = MouseButton;
type index_NutTreeDriver = NutTreeDriver;
declare const index_NutTreeDriver: typeof NutTreeDriver;
type index_ReadFileResult = ReadFileResult;
type index_SearchResult = SearchResult;
type index_ServiceToolFactory = ServiceToolFactory;
type index_ShellToolConfig = ShellToolConfig;
type index_ToolCategory = ToolCategory;
type index_ToolRegistry = ToolRegistry;
declare const index_ToolRegistry: typeof ToolRegistry;
type index_ToolRegistryEntry = ToolRegistryEntry;
type index_WriteFileResult = WriteFileResult;
declare const index_applyHumanDelay: typeof applyHumanDelay;
declare const index_bash: typeof bash;
declare const index_createBashTool: typeof createBashTool;
declare const index_createCreatePRTool: typeof createCreatePRTool;
declare const index_createDesktopGetCursorTool: typeof createDesktopGetCursorTool;
declare const index_createDesktopGetScreenSizeTool: typeof createDesktopGetScreenSizeTool;
declare const index_createDesktopKeyboardKeyTool: typeof createDesktopKeyboardKeyTool;
declare const index_createDesktopKeyboardTypeTool: typeof createDesktopKeyboardTypeTool;
declare const index_createDesktopMouseClickTool: typeof createDesktopMouseClickTool;
declare const index_createDesktopMouseDragTool: typeof createDesktopMouseDragTool;
declare const index_createDesktopMouseMoveTool: typeof createDesktopMouseMoveTool;
declare const index_createDesktopMouseScrollTool: typeof createDesktopMouseScrollTool;
declare const index_createDesktopScreenshotTool: typeof createDesktopScreenshotTool;
declare const index_createDesktopWindowFocusTool: typeof createDesktopWindowFocusTool;
declare const index_createDesktopWindowListTool: typeof createDesktopWindowListTool;
declare const index_createEditFileTool: typeof createEditFileTool;
declare const index_createExecuteJavaScriptTool: typeof createExecuteJavaScriptTool;
declare const index_createGetPRTool: typeof createGetPRTool;
declare const index_createGitHubReadFileTool: typeof createGitHubReadFileTool;
declare const index_createGlobTool: typeof createGlobTool;
declare const index_createGrepTool: typeof createGrepTool;
declare const index_createImageGenerationTool: typeof createImageGenerationTool;
declare const index_createListDirectoryTool: typeof createListDirectoryTool;
declare const index_createPRCommentsTool: typeof createPRCommentsTool;
declare const index_createPRFilesTool: typeof createPRFilesTool;
declare const index_createReadFileTool: typeof createReadFileTool;
declare const index_createSearchCodeTool: typeof createSearchCodeTool;
declare const index_createSearchFilesTool: typeof createSearchFilesTool;
declare const index_createSpeechToTextTool: typeof createSpeechToTextTool;
declare const index_createTextToSpeechTool: typeof createTextToSpeechTool;
declare const index_createVideoTools: typeof createVideoTools;
declare const index_createWebScrapeTool: typeof createWebScrapeTool;
declare const index_createWebSearchTool: typeof createWebSearchTool;
declare const index_createWriteFileTool: typeof createWriteFileTool;
declare const index_desktopGetCursor: typeof desktopGetCursor;
declare const index_desktopGetScreenSize: typeof desktopGetScreenSize;
declare const index_desktopKeyboardKey: typeof desktopKeyboardKey;
declare const index_desktopKeyboardType: typeof desktopKeyboardType;
declare const index_desktopMouseClick: typeof desktopMouseClick;
declare const index_desktopMouseDrag: typeof desktopMouseDrag;
declare const index_desktopMouseMove: typeof desktopMouseMove;
declare const index_desktopMouseScroll: typeof desktopMouseScroll;
declare const index_desktopScreenshot: typeof desktopScreenshot;
declare const index_desktopTools: typeof desktopTools;
declare const index_desktopWindowFocus: typeof desktopWindowFocus;
declare const index_desktopWindowList: typeof desktopWindowList;
declare const index_developerTools: typeof developerTools;
declare const index_editFile: typeof editFile;
declare const index_executeJavaScript: typeof executeJavaScript;
declare const index_expandTilde: typeof expandTilde;
declare const index_getAllBuiltInTools: typeof getAllBuiltInTools;
declare const index_getBackgroundOutput: typeof getBackgroundOutput;
declare const index_getDesktopDriver: typeof getDesktopDriver;
declare const index_getMediaOutputHandler: typeof getMediaOutputHandler;
declare const index_getMediaStorage: typeof getMediaStorage;
declare const index_getToolByName: typeof getToolByName;
declare const index_getToolCategories: typeof getToolCategories;
declare const index_getToolRegistry: typeof getToolRegistry;
declare const index_getToolsByCategory: typeof getToolsByCategory;
declare const index_getToolsRequiringConnector: typeof getToolsRequiringConnector;
declare const index_glob: typeof glob;
declare const index_grep: typeof grep;
declare const index_isBlockedCommand: typeof isBlockedCommand;
declare const index_isExcludedExtension: typeof isExcludedExtension;
declare const index_jsonManipulator: typeof jsonManipulator;
declare const index_killBackgroundProcess: typeof killBackgroundProcess;
declare const index_listDirectory: typeof listDirectory;
declare const index_mergeTextPieces: typeof mergeTextPieces;
declare const index_parseKeyCombo: typeof parseKeyCombo;
declare const index_parseRepository: typeof parseRepository;
declare const index_readFile: typeof readFile;
declare const index_resetDefaultDriver: typeof resetDefaultDriver;
declare const index_resolveRepository: typeof resolveRepository;
declare const index_setMediaOutputHandler: typeof setMediaOutputHandler;
declare const index_setMediaStorage: typeof setMediaStorage;
declare const index_toolRegistry: typeof toolRegistry;
declare const index_validatePath: typeof validatePath;
declare const index_webFetch: typeof webFetch;
declare const index_writeFile: typeof writeFile;
declare namespace index {
  export { type index_BashResult as BashResult, type index_ConnectorToolEntry as ConnectorToolEntry, index_ConnectorTools as ConnectorTools, index_DEFAULT_DESKTOP_CONFIG as DEFAULT_DESKTOP_CONFIG, index_DEFAULT_FILESYSTEM_CONFIG as DEFAULT_FILESYSTEM_CONFIG, index_DEFAULT_SHELL_CONFIG as DEFAULT_SHELL_CONFIG, index_DESKTOP_TOOL_NAMES as DESKTOP_TOOL_NAMES, type index_DesktopGetCursorResult as DesktopGetCursorResult, type index_DesktopGetScreenSizeResult as DesktopGetScreenSizeResult, type index_DesktopKeyboardKeyArgs as DesktopKeyboardKeyArgs, type index_DesktopKeyboardKeyResult as DesktopKeyboardKeyResult, type index_DesktopKeyboardTypeArgs as DesktopKeyboardTypeArgs, type index_DesktopKeyboardTypeResult as DesktopKeyboardTypeResult, type index_DesktopMouseClickArgs as DesktopMouseClickArgs, type index_DesktopMouseClickResult as DesktopMouseClickResult, type index_DesktopMouseDragArgs as DesktopMouseDragArgs, type index_DesktopMouseDragResult as DesktopMouseDragResult, type index_DesktopMouseMoveArgs as DesktopMouseMoveArgs, type index_DesktopMouseMoveResult as DesktopMouseMoveResult, type index_DesktopMouseScrollArgs as DesktopMouseScrollArgs, type index_DesktopMouseScrollResult as DesktopMouseScrollResult, type index_DesktopPoint as DesktopPoint, type index_DesktopScreenSize as DesktopScreenSize, type index_DesktopScreenshot as DesktopScreenshot, type index_DesktopScreenshotArgs as DesktopScreenshotArgs, type index_DesktopScreenshotResult as DesktopScreenshotResult, type index_DesktopToolConfig as DesktopToolConfig, type index_DesktopToolName as DesktopToolName, type index_DesktopWindow as DesktopWindow, type index_DesktopWindowFocusArgs as DesktopWindowFocusArgs, type index_DesktopWindowFocusResult as DesktopWindowFocusResult, type index_DesktopWindowListResult as DesktopWindowListResult, type index_DocumentFamily as DocumentFamily, type index_DocumentFormat as DocumentFormat, type index_DocumentImagePiece as DocumentImagePiece, type index_DocumentMetadata as DocumentMetadata, type index_DocumentPiece as DocumentPiece, type index_DocumentReadOptions as DocumentReadOptions, index_DocumentReader as DocumentReader, type index_DocumentReaderConfig as DocumentReaderConfig, type index_DocumentResult as DocumentResult, type index_DocumentSource as DocumentSource, type index_DocumentTextPiece as DocumentTextPiece, type index_DocumentToContentOptions as DocumentToContentOptions, type index_EditFileResult as EditFileResult, FileMediaStorage as FileMediaOutputHandler, type index_FilesystemToolConfig as FilesystemToolConfig, type index_FormatDetectionResult as FormatDetectionResult, index_FormatDetector as FormatDetector, type index_GenericAPICallArgs as GenericAPICallArgs, type index_GenericAPICallResult as GenericAPICallResult, type index_GenericAPIToolOptions as GenericAPIToolOptions, type index_GitHubCreatePRResult as GitHubCreatePRResult, type index_GitHubGetPRResult as GitHubGetPRResult, type index_GitHubPRCommentEntry as GitHubPRCommentEntry, type index_GitHubPRCommentsResult as GitHubPRCommentsResult, type index_GitHubPRFilesResult as GitHubPRFilesResult, type index_GitHubReadFileResult as GitHubReadFileResult, type index_GitHubRepository as GitHubRepository, type index_GitHubSearchCodeResult as GitHubSearchCodeResult, type index_GitHubSearchFilesResult as GitHubSearchFilesResult, type index_GlobResult as GlobResult, type index_GrepMatch as GrepMatch, type index_GrepResult as GrepResult, type index_IDesktopDriver as IDesktopDriver, type index_IDocumentTransformer as IDocumentTransformer, type index_IFormatHandler as IFormatHandler, type IMediaStorage as IMediaOutputHandler, type index_ImageFilterOptions as ImageFilterOptions, type MediaStorageMetadata as MediaOutputMetadata, type MediaStorageResult as MediaOutputResult, type index_MouseButton as MouseButton, index_NutTreeDriver as NutTreeDriver, type index_ReadFileResult as ReadFileResult, type index_SearchResult as SearchResult, type index_ServiceToolFactory as ServiceToolFactory, type index_ShellToolConfig as ShellToolConfig, type index_ToolCategory as ToolCategory, index_ToolRegistry as ToolRegistry, type index_ToolRegistryEntry as ToolRegistryEntry, type index_WriteFileResult as WriteFileResult, index_applyHumanDelay as applyHumanDelay, index_bash as bash, index_createBashTool as createBashTool, index_createCreatePRTool as createCreatePRTool, index_createDesktopGetCursorTool as createDesktopGetCursorTool, index_createDesktopGetScreenSizeTool as createDesktopGetScreenSizeTool, index_createDesktopKeyboardKeyTool as createDesktopKeyboardKeyTool, index_createDesktopKeyboardTypeTool as createDesktopKeyboardTypeTool, index_createDesktopMouseClickTool as createDesktopMouseClickTool, index_createDesktopMouseDragTool as createDesktopMouseDragTool, index_createDesktopMouseMoveTool as createDesktopMouseMoveTool, index_createDesktopMouseScrollTool as createDesktopMouseScrollTool, index_createDesktopScreenshotTool as createDesktopScreenshotTool, index_createDesktopWindowFocusTool as createDesktopWindowFocusTool, index_createDesktopWindowListTool as createDesktopWindowListTool, index_createEditFileTool as createEditFileTool, index_createExecuteJavaScriptTool as createExecuteJavaScriptTool, index_createGetPRTool as createGetPRTool, index_createGitHubReadFileTool as createGitHubReadFileTool, index_createGlobTool as createGlobTool, index_createGrepTool as createGrepTool, index_createImageGenerationTool as createImageGenerationTool, index_createListDirectoryTool as createListDirectoryTool, index_createPRCommentsTool as createPRCommentsTool, index_createPRFilesTool as createPRFilesTool, index_createReadFileTool as createReadFileTool, index_createSearchCodeTool as createSearchCodeTool, index_createSearchFilesTool as createSearchFilesTool, index_createSpeechToTextTool as createSpeechToTextTool, index_createTextToSpeechTool as createTextToSpeechTool, index_createVideoTools as createVideoTools, index_createWebScrapeTool as createWebScrapeTool, index_createWebSearchTool as createWebSearchTool, index_createWriteFileTool as createWriteFileTool, index_desktopGetCursor as desktopGetCursor, index_desktopGetScreenSize as desktopGetScreenSize, index_desktopKeyboardKey as desktopKeyboardKey, index_desktopKeyboardType as desktopKeyboardType, index_desktopMouseClick as desktopMouseClick, index_desktopMouseDrag as desktopMouseDrag, index_desktopMouseMove as desktopMouseMove, index_desktopMouseScroll as desktopMouseScroll, index_desktopScreenshot as desktopScreenshot, index_desktopTools as desktopTools, index_desktopWindowFocus as desktopWindowFocus, index_desktopWindowList as desktopWindowList, index_developerTools as developerTools, index_editFile as editFile, index_executeJavaScript as executeJavaScript, index_expandTilde as expandTilde, index_getAllBuiltInTools as getAllBuiltInTools, index_getBackgroundOutput as getBackgroundOutput, index_getDesktopDriver as getDesktopDriver, index_getMediaOutputHandler as getMediaOutputHandler, index_getMediaStorage as getMediaStorage, index_getToolByName as getToolByName, index_getToolCategories as getToolCategories, index_getToolRegistry as getToolRegistry, index_getToolsByCategory as getToolsByCategory, index_getToolsRequiringConnector as getToolsRequiringConnector, index_glob as glob, index_grep as grep, index_isBlockedCommand as isBlockedCommand, index_isExcludedExtension as isExcludedExtension, index_jsonManipulator as jsonManipulator, index_killBackgroundProcess as killBackgroundProcess, index_listDirectory as listDirectory, index_mergeTextPieces as mergeTextPieces, index_parseKeyCombo as parseKeyCombo, index_parseRepository as parseRepository, index_readFile as readFile, index_resetDefaultDriver as resetDefaultDriver, index_resolveRepository as resolveRepository, index_setMediaOutputHandler as setMediaOutputHandler, index_setMediaStorage as setMediaStorage, index_toolRegistry as toolRegistry, index_validatePath as validatePath, index_webFetch as webFetch, index_writeFile as writeFile };
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

export { AGENT_DEFINITION_FORMAT_VERSION, AIError, APPROVAL_STATE_VERSION, Agent, type AgentConfig$1 as AgentConfig, AgentContextNextGen, type AgentContextNextGenConfig, type AgentDefinitionListOptions, type AgentDefinitionMetadata, type AgentDefinitionSummary, AgentEvents, type AgentMetrics, type AgentPermissionsConfig, AgentResponse, type AgentSessionConfig, type AgentState, type AgentStatus, type ApprovalCacheEntry, type ApprovalDecision, ApproximateTokenEstimator, AudioFormat, AuditEntry, type AuthTemplate, type AuthTemplateField, type BackoffConfig, type BackoffStrategyType, BaseMediaProvider, BasePluginNextGen, BaseProvider, type BaseProviderConfig$1 as BaseProviderConfig, type BaseProviderResponse, BaseTextProvider, type BashResult, type BeforeExecuteResult, BraveProvider, CONNECTOR_CONFIG_VERSION, CONTEXT_SESSION_FORMAT_VERSION, CheckpointManager, type CheckpointStrategy, CircuitBreaker, type CircuitBreakerConfig, type CircuitBreakerEvents, type CircuitBreakerMetrics, CircuitOpenError, type CircuitState, type ClipboardImageResult, type CompactionContext, type CompactionResult, Connector, ConnectorAccessContext, ConnectorAuth, ConnectorConfig, ConnectorConfigResult, ConnectorConfigStore, ConnectorFetchOptions, type ConnectorToolEntry, ConnectorTools, type ConnectorToolsOptions, ConsoleMetrics, type ConsolidationResult, Content, type ContextBudget$1 as ContextBudget, type ContextEvents, type ContextFeatures, type ContextManagerConfig, type ContextOverflowBudget, ContextOverflowError, type ContextSessionMetadata, type ContextSessionSummary, type ContextStorageListOptions, type ConversationMessage, type CreateConnectorOptions, DEFAULT_ALLOWLIST, DEFAULT_BACKOFF_CONFIG, DEFAULT_CHECKPOINT_STRATEGY, DEFAULT_CIRCUIT_BREAKER_CONFIG, DEFAULT_CONFIG, DEFAULT_CONTEXT_CONFIG, DEFAULT_DESKTOP_CONFIG, DEFAULT_FEATURES, DEFAULT_FILESYSTEM_CONFIG, DEFAULT_HISTORY_MANAGER_CONFIG, DEFAULT_PERMISSION_CONFIG, DEFAULT_RATE_LIMITER_CONFIG, DEFAULT_SHELL_CONFIG, DESKTOP_TOOL_NAMES, type DefaultAllowlistedTool, DefaultCompactionStrategy, type DefaultCompactionStrategyConfig, DependencyCycleError, type DesktopGetCursorResult, type DesktopGetScreenSizeResult, type DesktopKeyboardKeyArgs, type DesktopKeyboardKeyResult, type DesktopKeyboardTypeArgs, type DesktopKeyboardTypeResult, type DesktopMouseClickArgs, type DesktopMouseClickResult, type DesktopMouseDragArgs, type DesktopMouseDragResult, type DesktopMouseMoveArgs, type DesktopMouseMoveResult, type DesktopMouseScrollArgs, type DesktopMouseScrollResult, type DesktopPoint, type DesktopScreenSize, type DesktopScreenshot, type DesktopScreenshotArgs, type DesktopScreenshotResult, type DesktopToolConfig, type DesktopToolName, type DesktopWindow, type DesktopWindowFocusArgs, type DesktopWindowFocusResult, type DesktopWindowListResult, type DirectCallOptions, type DocumentFamily, type DocumentFormat, type DocumentImagePiece, type DocumentMetadata, type DocumentPiece, type DocumentReadOptions, DocumentReader, type DocumentReaderConfig, type DocumentResult, type DocumentSource, type DocumentTextPiece, type DocumentToContentOptions, type EditFileResult, type ErrorContext, ErrorHandler, type ErrorHandlerConfig, type ErrorHandlerEvents, type EvictionStrategy, ExecutionContext, ExecutionMetrics, type ExtendedFetchOptions, type ExternalDependency, type ExternalDependencyEvents, ExternalDependencyHandler, type FetchedContent, FileAgentDefinitionStorage, type FileAgentDefinitionStorageConfig, FileConnectorStorage, type FileConnectorStorageConfig, FileContextStorage, type FileContextStorageConfig, FileMediaStorage as FileMediaOutputHandler, FileMediaStorage, type FileMediaStorageConfig, FilePersistentInstructionsStorage, type FilePersistentInstructionsStorageConfig, FileStorage, type FileStorageConfig, type FilesystemToolConfig, type FormatDetectionResult, FormatDetector, FrameworkLogger, FunctionToolDefinition, type GeneratedPlan, type GenericAPICallArgs, type GenericAPICallResult, type GenericAPIToolOptions, type GitHubCreatePRResult, type GitHubGetPRResult, type GitHubPRCommentEntry, type GitHubPRCommentsResult, type GitHubPRFilesResult, type GitHubReadFileResult, type GitHubRepository, type GitHubSearchCodeResult, type GitHubSearchFilesResult, type GlobResult, type GrepMatch, type GrepResult, type HTTPTransportConfig, type HistoryManagerEvents, type HistoryMessage, HistoryMode, HookConfig, type IAgentDefinitionStorage, type IAgentStateStorage, type IAgentStorage, type IAsyncDisposable, IBaseModelDescription, type ICapabilityProvider, type ICompactionStrategy, IConnectorAccessPolicy, type IConnectorConfigStorage, IConnectorRegistry, type IContextCompactor, type IContextComponent, type IContextPluginNextGen, type IContextStorage, type IContextStrategy, type IDesktopDriver, type IDisposable, type IDocumentTransformer, type IFormatHandler, type IHistoryManager, type IHistoryManagerConfig, type IHistoryStorage, IImageProvider, type IMCPClient, type IMediaStorage as IMediaOutputHandler, type IMediaStorage, type IMemoryStorage, type IPersistentInstructionsStorage, type IPlanStorage, IProvider, type IResearchSource, type ISTTModelDescription, type IScrapeProvider, type ISearchProvider, type ISpeechToTextProvider, type ITTSModelDescription, ITextProvider, type ITextToSpeechProvider, type ITokenEstimator$1 as ITokenEstimator, ITokenStorage, type IToolExecutionPipeline, type IToolExecutionPlugin, type IToolExecutor, type IVideoModelDescription, type IVideoProvider, type IVoiceInfo, type ImageFilterOptions, type InContextEntry, type InContextMemoryConfig, InContextMemoryPluginNextGen, type InContextPriority, InMemoryAgentStateStorage, InMemoryHistoryStorage, InMemoryMetrics, InMemoryPlanStorage, InMemoryStorage, InputItem, type InstructionEntry, InvalidConfigError, InvalidToolArgumentsError, type JSONExtractionResult, LLMResponse, type LogEntry, type LogLevel, type LoggerConfig, LoggingPlugin, type LoggingPluginOptions, MCPClient, type MCPClientConnectionState, type MCPClientState, type MCPConfiguration, MCPConnectionError, MCPError, type MCPPrompt, type MCPPromptResult, MCPProtocolError, MCPRegistry, type MCPResource, type MCPResourceContent, MCPResourceError, type MCPServerCapabilities, type MCPServerConfig, MCPTimeoutError, type MCPTool, MCPToolError, type MCPToolResult, type MCPTransportType, type MediaStorageMetadata as MediaOutputMetadata, type MediaStorageResult as MediaOutputResult, type MediaStorageEntry, type MediaStorageListOptions, type MediaStorageMetadata, type MediaStorageResult, MemoryConnectorStorage, MemoryEntry, MemoryEvictionCompactor, MemoryIndex, MemoryPriority, MemoryScope, MemoryStorage, MessageBuilder, MessageRole, type MetricTags, type MetricsCollector, type MetricsCollectorType, ModelCapabilities, ModelNotSupportedError, type MouseButton, type EvictionStrategy$1 as NextGenEvictionStrategy, NoOpMetrics, NutTreeDriver, type OAuthConfig, type OAuthFlow, OAuthManager, OutputItem, type OversizedInputResult, ParallelTasksError, type PermissionCheckContext, type PermissionCheckResult, type PermissionManagerEvent, type PermissionScope, type PersistentInstructionsConfig, PersistentInstructionsPluginNextGen, type PieceMetadata, type Plan, type PlanConcurrency, type PlanInput, type PlanStatus, PlanningAgent, type PlanningAgentConfig, type PluginConfigs, type PluginExecutionContext, type PreparedContext, ProviderAuthError, ProviderCapabilities, ProviderConfigAgent, ProviderContextLengthError, ProviderError, ProviderErrorMapper, ProviderNotFoundError, ProviderRateLimitError, RapidAPIProvider, RateLimitError, type RateLimiterConfig, type RateLimiterMetrics, type ReadFileResult, type FetchOptions as ResearchFetchOptions, type ResearchFinding, type ResearchPlan, type ResearchProgress, type ResearchQuery, type ResearchResult, type SearchOptions as ResearchSearchOptions, type SearchResponse as ResearchSearchResponse, type RiskLevel, SIMPLE_ICONS_CDN, type STTModelCapabilities, type STTOptions, type STTOutputFormat$1 as STTOutputFormat, type STTResponse, STT_MODELS, STT_MODEL_REGISTRY, ScopedConnectorRegistry, type ScrapeFeature, type ScrapeOptions, ScrapeProvider, type ScrapeProviderConfig, type ScrapeProviderFallbackConfig, type ScrapeResponse, type ScrapeResult, type SearchOptions$1 as SearchOptions, SearchProvider, type SearchProviderConfig, type SearchResponse$1 as SearchResponse, type SearchResult, type SegmentTimestamp, type SerializedApprovalEntry, type SerializedApprovalState, type SerializedContextState, type SerializedHistoryState, type SerializedInContextMemoryState, type SerializedPersistentInstructionsState, type SerializedToolState, type SerializedWorkingMemoryState, SerperProvider, ServiceCategory, type ServiceToolFactory, type ShellToolConfig, type SimpleIcon, type SimpleVideoGenerateOptions, type SourceCapabilities, type SourceResult, SpeechToText, type SpeechToTextConfig, type StdioTransportConfig, type StoredAgentDefinition, type StoredAgentType, type StoredConnectorConfig, type StoredContextSession, type StoredToken, type StrategyInfo, StrategyRegistry, type StrategyRegistryEntry, StreamEvent, StreamEventType, StreamHelpers, StreamState, SummarizeCompactor, TERMINAL_TASK_STATUSES, type TTSModelCapabilities, type TTSOptions, type TTSResponse, TTS_MODELS, TTS_MODEL_REGISTRY, type Task, type AgentConfig as TaskAgentStateConfig, type TaskCondition, type TaskExecution, type TaskFailure, type TaskInput, type TaskStatus, TaskStatusForMemory, TaskTimeoutError, ToolContext as TaskToolContext, type TaskValidation, TaskValidationError, type TaskValidationResult, TavilyProvider, type TemplateCredentials, TextGenerateOptions, TextToSpeech, type TextToSpeechConfig, TokenBucketRateLimiter, type TokenContentType, Tool, ToolCall, type ToolCategory, type ToolCondition, ToolContext, ToolExecutionError, ToolExecutionPipeline, type ToolExecutionPipelineOptions, ToolFunction, ToolManager, type ToolManagerConfig, type ToolManagerEvent, type ToolManagerStats, type ToolMetadata, ToolNotFoundError, type ToolOptions, type ToolPermissionConfig, ToolPermissionManager, type ToolRegistration, ToolRegistry, type ToolRegistryEntry, ToolResult, type ToolSelectionContext, ToolTimeoutError, type TransportConfig, TruncateCompactor, VENDOR_ICON_MAP, VIDEO_MODELS, VIDEO_MODEL_REGISTRY, Vendor, type VendorInfo, type VendorLogo, VendorOptionSchema, type VendorRegistryEntry, type VendorTemplate, type VideoExtendOptions, type VideoGenerateOptions, VideoGeneration, type VideoGenerationCreateOptions, type VideoJob, type VideoModelCapabilities, type VideoModelPricing, type VideoResponse, type VideoStatus, type WordTimestamp, WorkingMemory, WorkingMemoryAccess, WorkingMemoryConfig, type WorkingMemoryEvents, type WorkingMemoryPluginConfig, WorkingMemoryPluginNextGen, type WriteFileResult, addJitter, allVendorTemplates, assertNotDestroyed, authenticatedFetch, backoffSequence, backoffWait, bash, buildAuthConfig, buildEndpointWithQuery, buildQueryString, calculateBackoff, calculateSTTCost, calculateTTSCost, calculateVideoCost, canTaskExecute, createAgentStorage, createAuthenticatedFetch, createBashTool, createConnectorFromTemplate, createCreatePRTool, createDesktopGetCursorTool, createDesktopGetScreenSizeTool, createDesktopKeyboardKeyTool, createDesktopKeyboardTypeTool, createDesktopMouseClickTool, createDesktopMouseDragTool, createDesktopMouseMoveTool, createDesktopMouseScrollTool, createDesktopScreenshotTool, createDesktopWindowFocusTool, createDesktopWindowListTool, createEditFileTool, createEstimator, createExecuteJavaScriptTool, createFileAgentDefinitionStorage, createFileContextStorage, createFileMediaStorage, createGetPRTool, createGitHubReadFileTool, createGlobTool, createGrepTool, createImageGenerationTool, createImageProvider, createListDirectoryTool, createMessageWithImages, createMetricsCollector, createPRCommentsTool, createPRFilesTool, createPlan, createProvider, createReadFileTool, createSearchCodeTool, createSearchFilesTool, createSpeechToTextTool, createTask, createTextMessage, createTextToSpeechTool, createVideoProvider, createVideoTools, createWriteFileTool, desktopGetCursor, desktopGetScreenSize, desktopKeyboardKey, desktopKeyboardType, desktopMouseClick, desktopMouseDrag, desktopMouseMove, desktopMouseScroll, desktopScreenshot, desktopTools, desktopWindowFocus, desktopWindowList, detectDependencyCycle, developerTools, documentToContent, editFile, evaluateCondition, extractJSON, extractJSONField, extractNumber, findConnectorByServiceTypes, generateEncryptionKey, generateSimplePlan, generateWebAPITool, getActiveSTTModels, getActiveTTSModels, getActiveVideoModels, getAllBuiltInTools, getAllVendorLogos, getAllVendorTemplates, getBackgroundOutput, getConnectorTools, getCredentialsSetupURL, getDesktopDriver, getDocsURL, getMediaOutputHandler, getMediaStorage, getNextExecutableTasks, getRegisteredScrapeProviders, getSTTModelInfo, getSTTModelsByVendor, getSTTModelsWithFeature, getTTSModelInfo, getTTSModelsByVendor, getTTSModelsWithFeature, getTaskDependencies, getToolByName, getToolCategories, getToolRegistry, getToolsByCategory, getToolsRequiringConnector, getVendorAuthTemplate, getVendorColor, getVendorDefaultBaseURL, getVendorInfo, getVendorLogo, getVendorLogoCdnUrl, getVendorLogoSvg, getVendorTemplate, getVideoModelInfo, getVideoModelsByVendor, getVideoModelsWithAudio, getVideoModelsWithFeature, glob, globalErrorHandler, grep, hasClipboardImage, hasVendorLogo, isBlockedCommand, isExcludedExtension, isTaskBlocked, isTerminalStatus, killBackgroundProcess, listConnectorsByServiceTypes, listDirectory, listVendorIds, listVendors, listVendorsByAuthType, listVendorsByCategory, listVendorsWithLogos, logger, mergeTextPieces, metrics, parseKeyCombo, parseRepository, readClipboardImage, readDocumentAsContent, readFile, registerScrapeProvider, resetDefaultDriver, resolveConnector, resolveDependencies, resolveRepository, retryWithBackoff, setMediaOutputHandler, setMediaStorage, setMetricsCollector, simpleTokenEstimator, toConnectorOptions, toolRegistry, index as tools, updateTaskStatus, validatePath, writeFile };
