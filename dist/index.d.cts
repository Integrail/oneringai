import EventEmitter$1, { EventEmitter } from 'eventemitter3';
import { A as AgenticLoopEvents, T as ToolFunction, H as HookConfig, a as HistoryMode, I as InputItem, b as AgentResponse, S as StreamEvent, E as ExecutionContext, c as ExecutionMetrics, d as AuditEntry, C as CircuitState, e as CircuitBreakerMetrics, f as ITextProvider, g as TokenUsage, h as ToolCall, L as LLMResponse, i as StreamEventType, j as IProvider, P as ProviderCapabilities, k as CircuitBreaker, l as TextGenerateOptions, M as ModelCapabilities, m as MessageRole } from './index-BElN4ALe.cjs';
export { ac as AfterToolContext, a7 as AgenticLoopEventName, af as ApprovalResult, ad as ApproveToolContext, ab as BeforeToolContext, B as BuiltInTool, ai as CircuitBreakerConfig, aj as CircuitBreakerEvents, ah as CircuitOpenError, v as CompactionItem, o as Content, n as ContentType, ak as DEFAULT_CIRCUIT_BREAKER_CONFIG, _ as ErrorEvent, F as FunctionToolDefinition, a9 as Hook, a6 as HookManager, a8 as HookName, ag as IToolExecutor, q as InputImageContent, p as InputTextContent, Y as IterationCompleteEvent, J as JSONSchema, t as Message, aa as ModifyingHook, u as OutputItem, O as OutputTextContent, K as OutputTextDeltaEvent, N as OutputTextDoneEvent, R as ReasoningItem, Z as ResponseCompleteEvent, D as ResponseCreatedEvent, G as ResponseInProgressEvent, x as Tool, U as ToolCallArgumentsDeltaEvent, V as ToolCallArgumentsDoneEvent, Q as ToolCallStartEvent, w as ToolCallState, z as ToolExecutionContext, X as ToolExecutionDoneEvent, W as ToolExecutionStartEvent, ae as ToolModification, a5 as ToolRegistry, y as ToolResult, s as ToolResultContent, r as ToolUseContent, a4 as isErrorEvent, a0 as isOutputTextDelta, a3 as isResponseComplete, $ as isStreamEvent, a1 as isToolCallArgumentsDelta, a2 as isToolCallArgumentsDone } from './index-BElN4ALe.cjs';

/**
 * Supported AI Vendors
 *
 * Use this enum instead of string literals for type safety.
 * These map to specific provider implementations.
 */
declare const Vendor: {
    readonly OpenAI: "openai";
    readonly Anthropic: "anthropic";
    readonly Google: "google";
    readonly GoogleVertex: "google-vertex";
    readonly Groq: "groq";
    readonly Together: "together";
    readonly Perplexity: "perplexity";
    readonly Grok: "grok";
    readonly DeepSeek: "deepseek";
    readonly Mistral: "mistral";
    readonly Ollama: "ollama";
    readonly Custom: "custom";
};
type Vendor = (typeof Vendor)[keyof typeof Vendor];
/**
 * All vendor values as array (useful for validation)
 */
declare const VENDORS: ("openai" | "anthropic" | "google" | "google-vertex" | "groq" | "together" | "perplexity" | "grok" | "deepseek" | "mistral" | "ollama" | "custom")[];
/**
 * Check if a string is a valid vendor
 */
declare function isVendor(value: string): value is Vendor;

/**
 * Connector - Represents authenticated connection to ANY API
 *
 * Connectors handle authentication for:
 * - AI providers (OpenAI, Anthropic, Google, etc.)
 * - External APIs (GitHub, Microsoft, Salesforce, etc.)
 *
 * This is the SINGLE source of truth for authentication.
 */

/**
 * Connector authentication configuration
 * Supports OAuth 2.0, API keys, and JWT bearer tokens
 */
type ConnectorAuth = OAuthConnectorAuth | APIKeyConnectorAuth | JWTConnectorAuth;
/**
 * OAuth 2.0 authentication for connectors
 * Supports multiple OAuth flows
 */
interface OAuthConnectorAuth {
    type: 'oauth';
    flow: 'authorization_code' | 'client_credentials' | 'jwt_bearer';
    clientId: string;
    clientSecret?: string;
    tokenUrl: string;
    authorizationUrl?: string;
    redirectUri?: string;
    scope?: string;
    usePKCE?: boolean;
    privateKey?: string;
    privateKeyPath?: string;
    issuer?: string;
    subject?: string;
    audience?: string;
    refreshBeforeExpiry?: number;
    storageKey?: string;
}
/**
 * Static API key authentication
 * For services like OpenAI, Anthropic, many SaaS APIs
 */
interface APIKeyConnectorAuth {
    type: 'api_key';
    apiKey: string;
    headerName?: string;
    headerPrefix?: string;
}
/**
 * JWT Bearer token authentication
 * For service accounts (Google, Salesforce)
 */
interface JWTConnectorAuth {
    type: 'jwt';
    privateKey: string;
    privateKeyPath?: string;
    tokenUrl: string;
    clientId: string;
    scope?: string;
    issuer?: string;
    subject?: string;
    audience?: string;
}
/**
 * Complete connector configuration
 * Used for BOTH AI providers AND external APIs
 */
interface ConnectorConfig {
    name?: string;
    vendor?: Vendor;
    auth: ConnectorAuth;
    displayName?: string;
    description?: string;
    baseURL?: string;
    defaultModel?: string;
    apiVersion?: string;
    rateLimit?: {
        requestsPerMinute?: number;
        requestsPerDay?: number;
    };
    documentation?: string;
    tags?: string[];
    options?: {
        timeout?: number;
        maxRetries?: number;
        organization?: string;
        project?: string;
        anthropicVersion?: string;
        location?: string;
        projectId?: string;
        [key: string]: unknown;
    };
}
/**
 * Result from ProviderConfigAgent
 * Includes setup instructions and environment variables
 */
interface ConnectorConfigResult {
    name: string;
    config: ConnectorConfig;
    setupInstructions: string;
    envVariables: string[];
    setupUrl?: string;
}

/**
 * Token storage interface (Clean Architecture - Domain Layer)
 * All implementations must encrypt tokens at rest
 */
interface StoredToken$1 {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope?: string;
    obtained_at: number;
}
/**
 * Token storage interface
 * All implementations MUST encrypt tokens before storing
 */
interface ITokenStorage {
    /**
     * Store token (must be encrypted by implementation)
     *
     * @param key - Unique identifier for this token
     * @param token - Token data to store
     */
    storeToken(key: string, token: StoredToken$1): Promise<void>;
    /**
     * Retrieve token (must be decrypted by implementation)
     *
     * @param key - Unique identifier for the token
     * @returns Decrypted token or null if not found
     */
    getToken(key: string): Promise<StoredToken$1 | null>;
    /**
     * Delete token
     *
     * @param key - Unique identifier for the token
     */
    deleteToken(key: string): Promise<void>;
    /**
     * Check if token exists
     *
     * @param key - Unique identifier for the token
     * @returns True if token exists
     */
    hasToken(key: string): Promise<boolean>;
}

/**
 * Connector - The single source of truth for authentication
 *
 * Manages authenticated connections to:
 * - AI providers (OpenAI, Anthropic, Google, etc.)
 * - External APIs (GitHub, Salesforce, etc.)
 */

/**
 * Connector class - represents a single authenticated connection
 */
declare class Connector {
    private static registry;
    private static defaultStorage;
    /**
     * Create and register a new connector
     * @param config - Must include `name` field
     */
    static create(config: ConnectorConfig & {
        name: string;
    }): Connector;
    /**
     * Get a connector by name
     */
    static get(name: string): Connector;
    /**
     * Check if a connector exists
     */
    static has(name: string): boolean;
    /**
     * List all registered connector names
     */
    static list(): string[];
    /**
     * Remove a connector
     */
    static remove(name: string): boolean;
    /**
     * Clear all connectors (useful for testing)
     */
    static clear(): void;
    /**
     * Set default token storage for OAuth connectors
     */
    static setDefaultStorage(storage: ITokenStorage): void;
    /**
     * Get all registered connectors
     */
    static listAll(): Connector[];
    /**
     * Get number of registered connectors
     */
    static size(): number;
    /**
     * Get connector descriptions formatted for tool parameters
     * Useful for generating dynamic tool descriptions
     */
    static getDescriptionsForTools(): string;
    /**
     * Get connector info (for tools and documentation)
     */
    static getInfo(): Record<string, {
        displayName: string;
        description: string;
        baseURL: string;
    }>;
    readonly name: string;
    readonly vendor?: Vendor;
    readonly config: ConnectorConfig;
    private oauthManager?;
    private disposed;
    private constructor();
    /**
     * Human-readable display name
     */
    get displayName(): string;
    /**
     * API base URL for this connector
     */
    get baseURL(): string;
    /**
     * Get the API key (for api_key auth type)
     */
    getApiKey(): string;
    /**
     * Get the current access token (for OAuth, JWT, or API key)
     * Handles automatic refresh if needed
     */
    getToken(userId?: string): Promise<string>;
    /**
     * Start OAuth authorization flow
     * Returns the URL to redirect the user to
     */
    startAuth(userId?: string): Promise<string>;
    /**
     * Handle OAuth callback
     * Call this after user is redirected back from OAuth provider
     */
    handleCallback(callbackUrl: string, userId?: string): Promise<void>;
    /**
     * Check if the connector has a valid token
     */
    hasValidToken(userId?: string): Promise<boolean>;
    /**
     * Get vendor-specific options from config
     */
    getOptions(): Record<string, unknown>;
    /**
     * Dispose of resources
     */
    dispose(): void;
    private initOAuthManager;
    private initJWTManager;
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
 * Agent configuration - new simplified interface
 */
interface AgentConfig$1 {
    connector: string | Connector;
    model: string;
    name?: string;
    instructions?: string;
    tools?: ToolFunction[];
    temperature?: number;
    maxIterations?: number;
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
 */
declare class Agent extends EventEmitter<AgenticLoopEvents> implements IDisposable {
    readonly name: string;
    readonly connector: Connector;
    readonly model: string;
    private config;
    private provider;
    private toolRegistry;
    private agenticLoop;
    private cleanupCallbacks;
    private boundListeners;
    private _isDestroyed;
    private logger;
    get isDestroyed(): boolean;
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
    private constructor();
    /**
     * Run the agent with input
     */
    run(input: string | InputItem[]): Promise<AgentResponse>;
    /**
     * Stream response from the agent
     */
    stream(input: string | InputItem[]): AsyncIterableIterator<StreamEvent>;
    /**
     * Add a tool to the agent
     */
    addTool(tool: ToolFunction): void;
    /**
     * Remove a tool from the agent
     */
    removeTool(toolName: string): void;
    /**
     * List registered tools
     */
    listTools(): string[];
    /**
     * Replace all tools with a new array
     */
    setTools(tools: ToolFunction[]): void;
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
    onCleanup(callback: () => void): void;
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
 * Task and Plan entities for TaskAgent
 *
 * Defines the data structures for task-based autonomous agents.
 */
/**
 * Task status lifecycle
 */
type TaskStatus = 'pending' | 'blocked' | 'in_progress' | 'waiting_external' | 'completed' | 'failed' | 'skipped' | 'cancelled';
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
    /** Optional expected output description */
    expectedOutput?: string;
    /** Result after completion */
    result?: {
        success: boolean;
        output?: unknown;
        error?: string;
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
 * Memory entities for TaskAgent working memory
 *
 * This file defines the data structures for the indexed working memory system.
 */
/**
 * Scope determines memory lifecycle
 */
type MemoryScope = 'task' | 'persistent';
/**
 * Single memory entry stored in working memory
 */
interface MemoryEntry {
    key: string;
    description: string;
    value: unknown;
    sizeBytes: number;
    scope: MemoryScope;
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
 * Default configuration values
 */
declare const DEFAULT_MEMORY_CONFIG: WorkingMemoryConfig;

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
 * ContextManager - manages context window size and compaction
 */

/**
 * Context manager configuration
 */
interface ContextManagerConfig$1 {
    /** Model's max context tokens */
    maxContextTokens: number;
    /** Trigger compaction at this % of max */
    compactionThreshold: number;
    /** Hard limit - must compact before LLM call */
    hardLimit: number;
    /** Reserve space for response */
    responseReserve: number;
    /** Token estimator method */
    tokenEstimator: 'approximate' | 'tiktoken';
}
/**
 * Compaction strategy configuration
 */
interface CompactionStrategy {
    /** Priority order for compaction */
    priority: Array<'toolOutputs' | 'history' | 'memory'>;
    /** Strategy for history compaction */
    historyStrategy: 'summarize' | 'truncate' | 'sliding-window';
    /** Strategy for memory eviction */
    memoryStrategy: 'lru' | 'largest-first' | 'oldest-first';
    /** Max tokens for tool outputs */
    toolOutputMaxSize: number;
}
/**
 * Context components that make up the full context
 */
interface ContextComponents {
    systemPrompt: string;
    instructions: string;
    memoryIndex: string;
    conversationHistory: Array<{
        role: string;
        content: string;
    }>;
    currentInput: string;
}
/**
 * Context budget breakdown
 */
interface ContextBudget$1 {
    total: number;
    reserved: number;
    used: number;
    available: number;
    utilizationPercent: number;
    status: 'ok' | 'warning' | 'critical';
    breakdown: {
        systemPrompt: number;
        instructions: number;
        memoryIndex: number;
        conversationHistory: number;
        currentInput: number;
    };
}
/**
 * Prepared context result
 */
interface PreparedContext$1 {
    components: ContextComponents;
    budget: ContextBudget$1;
    compacted: boolean;
    compactionLog?: string[];
}
/**
 * Memory manager interface (for compaction)
 */
interface IMemoryManager {
    evictLRU(count: number): Promise<string[]>;
    formatIndex?(): Promise<string>;
    getIndex?(): Promise<{
        entries: any[];
    }>;
}
/**
 * History manager interface (for compaction)
 */
interface IHistoryManager {
    summarize(): Promise<void>;
    truncate?(messages: any[], limit: number): Promise<any[]>;
}
interface ContextManagerEvents$1 {
    compacting: {
        reason: string;
    };
    compacted: {
        log: string[];
    };
}
/**
 * ContextManager handles context window management.
 *
 * Features:
 * - Token estimation (approximate or tiktoken)
 * - Proactive compaction before overflow
 * - Configurable compaction strategies
 * - Tool output truncation
 */
declare class ContextManager$1 extends EventEmitter$1<ContextManagerEvents$1> {
    private config;
    private strategy;
    private lastBudget?;
    constructor(config?: ContextManagerConfig$1, strategy?: CompactionStrategy);
    /**
     * Estimate token count for text
     */
    estimateTokens(text: string): number;
    /**
     * Estimate budget for context components
     */
    estimateBudget(components: ContextComponents): ContextBudget$1;
    /**
     * Prepare context, compacting if necessary
     */
    prepareContext(components: ContextComponents, memory: IMemoryManager, history: IHistoryManager): Promise<PreparedContext$1>;
    /**
     * Truncate tool outputs in conversation history
     */
    private truncateToolOutputsInHistory;
    /**
     * Truncate tool output to fit within limit
     */
    truncateToolOutput(output: unknown, maxTokens: number): unknown;
    /**
     * Create summary of large output
     */
    createOutputSummary(output: unknown, maxTokens: number): string;
    /**
     * Check if output should be auto-stored in memory
     */
    shouldAutoStore(output: unknown, threshold: number): boolean;
    /**
     * Get current context budget
     */
    getCurrentBudget(): ContextBudget$1 | null;
    /**
     * Get current configuration
     */
    getConfig(): ContextManagerConfig$1;
    /**
     * Get current compaction strategy
     */
    getStrategy(): CompactionStrategy;
    /**
     * Update configuration
     */
    updateConfig(updates: Partial<ContextManagerConfig$1>): void;
}

/**
 * IdempotencyCache - caches tool call results for deduplication
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
 * Tool context interface - passed to tools during execution
 */

/**
 * Limited memory access for tools
 */
interface WorkingMemoryAccess {
    get(key: string): Promise<unknown>;
    set(key: string, description: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
    has(key: string): Promise<boolean>;
    list(): Promise<Array<{
        key: string;
        description: string;
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
    contextManager?: ContextManager$1;
    /** Idempotency cache (if running in TaskAgent) */
    idempotencyCache?: IdempotencyCache;
    /** Abort signal for cancellation */
    signal?: AbortSignal;
}

/**
 * WorkingMemory class - manages indexed working memory for TaskAgent
 */

interface WorkingMemoryEvents {
    stored: {
        key: string;
        description: string;
    };
    retrieved: {
        key: string;
    };
    deleted: {
        key: string;
    };
    limit_warning: {
        utilizationPercent: number;
    };
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
declare class WorkingMemory extends EventEmitter$1<WorkingMemoryEvents> {
    private storage;
    private config;
    constructor(storage: IMemoryStorage, config?: WorkingMemoryConfig);
    /**
     * Store a value in working memory
     */
    store(key: string, description: string, value: unknown, scope?: MemoryScope): Promise<void>;
    /**
     * Retrieve a value from working memory
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
     * Promote a task-scoped entry to persistent
     */
    persist(key: string): Promise<void>;
    /**
     * Clear all entries of a specific scope
     */
    clearScope(scope: MemoryScope): Promise<void>;
    /**
     * Clear all entries
     */
    clear(): Promise<void>;
    /**
     * Get memory index
     */
    getIndex(): Promise<MemoryIndex>;
    /**
     * Format index for context injection
     */
    formatIndex(): Promise<string>;
    /**
     * Evict least recently used entries
     */
    evictLRU(count: number): Promise<string[]>;
    /**
     * Evict largest entries first
     */
    evictBySize(count: number): Promise<string[]>;
    /**
     * Get limited memory access for tools
     */
    getAccess(): WorkingMemoryAccess;
    /**
     * Get the configured memory limit
     */
    getLimit(): number;
}

/**
 * HistoryManager - manages conversation history with compaction
 */

interface HistoryManagerConfig {
    /** Max messages to keep in full detail */
    maxDetailedMessages: number;
    /** Strategy for older messages */
    compressionStrategy: 'summarize' | 'truncate' | 'drop';
    /** For summarize: how many messages per summary */
    summarizeBatchSize: number;
    /** Max total tokens for history (estimated) */
    maxHistoryTokens?: number;
    /** Keep all tool calls/results or summarize them too */
    preserveToolCalls: boolean;
}
declare const DEFAULT_HISTORY_CONFIG: HistoryManagerConfig;
/**
 * Manages conversation history with automatic compaction
 */
declare class HistoryManager {
    private messages;
    private summaries;
    private config;
    constructor(config?: HistoryManagerConfig);
    /**
     * Add a message to history
     */
    addMessage(role: 'user' | 'assistant' | 'system', content: string): void;
    /**
     * Get all messages (including summaries as system messages)
     */
    getMessages(): ConversationMessage[];
    /**
     * Get recent messages only (no summaries)
     */
    getRecentMessages(): ConversationMessage[];
    /**
     * Compact history (summarize or truncate old messages)
     */
    private compact;
    /**
     * Summarize history (requires LLM - placeholder)
     */
    summarize(): Promise<void>;
    /**
     * Truncate messages to a limit
     */
    truncate(messages: ConversationMessage[], limit: number): Promise<ConversationMessage[]>;
    /**
     * Clear all history
     */
    clear(): void;
    /**
     * Get total message count
     */
    getMessageCount(): number;
    /**
     * Get history state for persistence
     */
    getState(): {
        messages: ConversationMessage[];
        summaries: Array<{
            content: string;
            coversMessages: number;
            timestamp: number;
        }>;
    };
    /**
     * Restore history from state
     */
    restoreState(state: {
        messages: ConversationMessage[];
        summaries: Array<{
            content: string;
            coversMessages: number;
            timestamp: number;
        }>;
    }): void;
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
declare class ExternalDependencyHandler extends EventEmitter$1<ExternalDependencyEvents> {
    private activePolls;
    private activeScheduled;
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
     * Start polling for a task
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
 */

interface PlanExecutorConfig {
    maxIterations: number;
    taskTimeout?: number;
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
    'task:waiting_external': {
        task: Task;
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
declare class PlanExecutor extends EventEmitter$1<PlanExecutorEvents> {
    private agent;
    private memory;
    private contextManager;
    private idempotencyCache;
    private historyManager;
    private externalHandler;
    private checkpointManager;
    private hooks;
    private config;
    private abortController;
    private currentMetrics;
    private currentState;
    constructor(agent: Agent, memory: WorkingMemory, contextManager: ContextManager$1, idempotencyCache: IdempotencyCache, historyManager: HistoryManager, externalHandler: ExternalDependencyHandler, checkpointManager: CheckpointManager, hooks: TaskAgentHooks | undefined, config: PlanExecutorConfig);
    /**
     * Execute a plan
     */
    execute(plan: Plan, state: AgentState): Promise<PlanExecutionResult>;
    /**
     * Execute a single task
     */
    private executeTask;
    /**
     * Build system prompt for task execution
     */
    private buildSystemPrompt;
    /**
     * Build prompt for a specific task
     */
    private buildTaskPrompt;
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
}

/**
 * TaskAgent - autonomous task-based agent
 */

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
 * Plan update options
 */
interface PlanUpdates {
    addTasks?: TaskInput[];
    updateTasks?: Array<{
        id: string;
    } & Partial<Task>>;
    removeTasks?: string[];
}
/**
 * TaskAgent configuration
 */
interface TaskAgentConfig {
    connector: string | Connector;
    model: string;
    tools?: ToolFunction[];
    instructions?: string;
    temperature?: number;
    maxIterations?: number;
    /** Storage for persistence */
    storage?: IAgentStorage;
    /** Memory configuration */
    memoryConfig?: WorkingMemoryConfig;
    /** Hooks for customization */
    hooks?: TaskAgentHooks;
}
/**
 * TaskAgent events
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
    'agent:resumed': {};
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
}
/**
 * TaskAgent - autonomous task-based agent.
 *
 * Features:
 * - Plan-driven execution
 * - Working memory with indexed access
 * - External dependency handling (webhooks, polling, manual)
 * - Suspend/resume capability
 * - State persistence for long-running agents
 */
declare class TaskAgent extends EventEmitter$1<TaskAgentEvents> {
    readonly id: string;
    protected state: AgentState;
    protected storage: IAgentStorage;
    protected memory: WorkingMemory;
    protected hooks?: TaskAgentHooks;
    protected executionPromise?: Promise<PlanResult>;
    protected agent?: Agent;
    protected contextManager?: ContextManager$1;
    protected idempotencyCache?: IdempotencyCache;
    protected historyManager?: HistoryManager;
    protected externalHandler?: ExternalDependencyHandler;
    protected planExecutor?: PlanExecutor;
    protected checkpointManager?: CheckpointManager;
    protected tools: ToolFunction[];
    protected config: TaskAgentConfig;
    private eventCleanupFunctions;
    protected constructor(id: string, state: AgentState, storage: IAgentStorage, memory: WorkingMemory, config: TaskAgentConfig, hooks?: TaskAgentHooks);
    /**
     * Create a new TaskAgent
     */
    static create(config: TaskAgentConfig): TaskAgent;
    /**
     * Wrap a tool with idempotency cache and enhanced context
     */
    private wrapToolWithCache;
    /**
     * Initialize internal components
     */
    private initializeComponents;
    /**
     * Resume an existing agent from storage
     */
    static resume(agentId: string, options: {
        storage: IAgentStorage;
        tools?: ToolFunction[];
        hooks?: TaskAgentHooks;
    }): Promise<TaskAgent>;
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
     * Update the plan
     */
    updatePlan(updates: PlanUpdates): Promise<void>;
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
 * Abstract interface for token estimation
 */
interface ITokenEstimator {
    /**
     * Estimate token count for text
     */
    estimateTokens(text: string, model?: string): number;
    /**
     * Estimate tokens for structured data
     */
    estimateDataTokens(data: unknown, model?: string): number;
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
declare class ContextManager extends EventEmitter$1<ContextManagerEvents> {
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
 * Proactive Compaction Strategy
 *
 * - Monitors context budget continuously
 * - Compacts proactively when reaching threshold
 * - Follows priority-based compaction order
 */

declare class ProactiveCompactionStrategy implements IContextStrategy {
    readonly name = "proactive";
    private metrics;
    shouldCompact(budget: ContextBudget, _config: ContextManagerConfig): boolean;
    compact(components: IContextComponent[], budget: ContextBudget, compactors: IContextCompactor[], estimator: ITokenEstimator): Promise<{
        components: IContextComponent[];
        log: string[];
        tokensFreed: number;
    }>;
    private estimateComponent;
    getMetrics(): {
        compactionCount: number;
        totalTokensFreed: number;
        avgTokensFreedPerCompaction: number;
    };
}

/**
 * Aggressive Compaction Strategy
 *
 * - Compacts earlier (60% threshold instead of 75%)
 * - Targets lower usage (50% instead of 65%)
 * - More aggressive per-component reduction
 * - Good for: Long-running agents, constrained context
 */

interface AggressiveStrategyOptions {
    /** Threshold to trigger compaction (default: 0.60) */
    threshold?: number;
    /** Target utilization after compaction (default: 0.50) */
    target?: number;
}
declare class AggressiveCompactionStrategy implements IContextStrategy {
    private options;
    readonly name = "aggressive";
    constructor(options?: AggressiveStrategyOptions);
    shouldCompact(budget: ContextBudget, _config: ContextManagerConfig): boolean;
    compact(components: IContextComponent[], budget: ContextBudget, compactors: IContextCompactor[], estimator: ITokenEstimator): Promise<{
        components: IContextComponent[];
        log: string[];
        tokensFreed: number;
    }>;
    private estimateComponent;
}

/**
 * Lazy Compaction Strategy
 *
 * - Only compacts when absolutely necessary (>90%)
 * - Minimal compaction (just enough to fit)
 * - Preserves as much context as possible
 * - Good for: High-context models, short conversations
 */

declare class LazyCompactionStrategy implements IContextStrategy {
    readonly name = "lazy";
    shouldCompact(budget: ContextBudget, _config: ContextManagerConfig): boolean;
    compact(components: IContextComponent[], budget: ContextBudget, compactors: IContextCompactor[], estimator: ITokenEstimator): Promise<{
        components: IContextComponent[];
        log: string[];
        tokensFreed: number;
    }>;
    private estimateComponent;
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
 * Strategy factory
 */
declare function createStrategy(name: string, options?: Record<string, unknown>): IContextStrategy;

/**
 * Context provider for TaskAgent
 */

interface TaskAgentContextProviderConfig {
    model: string;
    instructions?: string;
    plan: Plan;
    memory: WorkingMemory;
    historyManager: HistoryManager;
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
     */
    private extractToolOutputs;
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
 * Uses simple heuristic: 1 token ≈ 4 characters
 * Fast and good enough for most use cases
 */

declare class ApproximateTokenEstimator implements ITokenEstimator {
    /**
     * Estimate tokens for text using 4 chars per token heuristic
     */
    estimateTokens(text: string, _model?: string): number;
    /**
     * Estimate tokens for structured data
     */
    estimateDataTokens(data: unknown, _model?: string): number;
}

/**
 * Token estimators
 */

/**
 * Create token estimator from name
 */
declare function createEstimator(name: string): ITokenEstimator;

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
 */
declare const LLM_MODELS: {
    readonly openai: {
        readonly GPT_5_2_INSTANT: "gpt-5.2-instant";
        readonly GPT_5_2_THINKING: "gpt-5.2-thinking";
        readonly GPT_5_2_PRO: "gpt-5.2-pro";
        readonly GPT_5_2_CODEX: "gpt-5.2-codex";
        readonly GPT_5_1: "gpt-5.1";
        readonly GPT_5: "gpt-5";
        readonly GPT_5_MINI: "gpt-5-mini";
        readonly GPT_5_NANO: "gpt-5-nano";
        readonly GPT_4_1: "gpt-4.1";
        readonly GPT_4_1_MINI: "gpt-4.1-mini";
        readonly O3_MINI: "o3-mini";
    };
    readonly anthropic: {
        readonly CLAUDE_OPUS_4_5: "claude-opus-4-5-20251101";
        readonly CLAUDE_SONNET_4_5: "claude-sonnet-4-5-20250929";
        readonly CLAUDE_HAIKU_4_5: "claude-haiku-4-5-20251001";
        readonly CLAUDE_OPUS_4_1: "claude-opus-4-1-20250805";
        readonly CLAUDE_SONNET_4: "claude-sonnet-4-20250514";
    };
    readonly google: {
        readonly GEMINI_3_FLASH_PREVIEW: "gemini-3-flash-preview";
        readonly GEMINI_3_PRO: "gemini-3-pro";
        readonly GEMINI_3_PRO_IMAGE: "gemini-3-pro-image";
        readonly GEMINI_2_5_PRO: "gemini-2.5-pro";
        readonly GEMINI_2_5_FLASH: "gemini-2.5-flash";
        readonly GEMINI_2_5_FLASH_LITE: "gemini-2.5-flash-lite";
        readonly GEMINI_2_5_FLASH_IMAGE: "gemini-2.5-flash-image";
    };
};
/**
 * Complete model registry with all model metadata
 * Updated: January 2026
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
 * Provider configuration types
 */
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
 * Serper.dev search provider
 * Fast Google search results via API
 */
interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    position: number;
}

/**
 * Web Search Tool - Multi-provider web search
 * Supports Serper.dev (default), Brave, and Tavily
 */

interface WebSearchArgs {
    query: string;
    numResults?: number;
    provider?: 'serper' | 'brave' | 'tavily';
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
 * Pre-built tools for agents
 *
 * Import and use with your agents:
 *
 * ```typescript
 * import { tools } from '@oneringai/agents';
 *
 * const agent = client.agents.create({
 *   provider: 'openai',
 *   model: 'gpt-4',
 *   tools: [tools.jsonManipulator, tools.webSearch, tools.webFetch]
 * });
 * ```
 */

declare const index_createExecuteJavaScriptTool: typeof createExecuteJavaScriptTool;
declare const index_executeJavaScript: typeof executeJavaScript;
declare const index_jsonManipulator: typeof jsonManipulator;
declare const index_webFetch: typeof webFetch;
declare const index_webFetchJS: typeof webFetchJS;
declare const index_webSearch: typeof webSearch;
declare namespace index {
  export { index_createExecuteJavaScriptTool as createExecuteJavaScriptTool, index_executeJavaScript as executeJavaScript, index_jsonManipulator as jsonManipulator, index_webFetch as webFetch, index_webFetchJS as webFetchJS, index_webSearch as webSearch };
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

export { AIError, type APIKeyConnectorAuth, AdaptiveStrategy, Agent, type AgentConfig$1 as AgentConfig, type AgentHandle, type AgentMetrics, AgentResponse, type AgentState, type AgentStatus, AgenticLoopEvents, AggressiveCompactionStrategy, ApproximateTokenEstimator, AuditEntry, type BackoffConfig, type BackoffStrategyType, BaseProvider, BaseTextProvider, CONNECTOR_CONFIG_VERSION, type CacheStats, CheckpointManager, type CheckpointStrategy, CircuitBreaker, CircuitBreakerMetrics, CircuitState, type ClipboardImageResult, Connector, type ConnectorAuth, type ConnectorConfig, type ConnectorConfigResult, ConnectorConfigStore, ConsoleMetrics, type ContextBudget, ContextManager, type ContextManagerConfig, type ConversationMessage, DEFAULT_BACKOFF_CONFIG, DEFAULT_CHECKPOINT_STRATEGY, DEFAULT_CONTEXT_CONFIG, DEFAULT_HISTORY_CONFIG, DEFAULT_IDEMPOTENCY_CONFIG, DEFAULT_MEMORY_CONFIG, type ErrorContext, ExecutionContext, ExecutionMetrics, type ExternalDependency, type ExternalDependencyEvents, ExternalDependencyHandler, FileConnectorStorage, type FileConnectorStorageConfig, FileStorage, type FileStorageConfig, FrameworkLogger, HistoryManager, type HistoryManagerConfig, HistoryMode, HookConfig, type IAgentStateStorage, type IAgentStorage, type IAsyncDisposable, type IConnectorConfigStorage, type IContextCompactor, type IContextComponent, type IContextProvider, type IContextStrategy, type IDisposable, type ILLMDescription, type IMemoryStorage, type IPlanStorage, IProvider, ITextProvider, type ITokenEstimator, type ITokenStorage, IdempotencyCache, type IdempotencyCacheConfig, InMemoryAgentStateStorage, InMemoryMetrics, InMemoryPlanStorage, InMemoryStorage, InputItem, InvalidConfigError, InvalidToolArgumentsError, type JWTConnectorAuth, LLMResponse, LLM_MODELS, LazyCompactionStrategy, type LogEntry, type LogLevel, type LoggerConfig, MODEL_REGISTRY, MemoryConnectorStorage, type MemoryEntry, MemoryEvictionCompactor, type MemoryIndex, type MemoryIndexEntry, type MemoryScope, MemoryStorage, MessageBuilder, MessageRole, type MetricTags, type MetricsCollector, type MetricsCollectorType, ModelCapabilities, ModelNotSupportedError, NoOpMetrics, type OAuthConfig, type OAuthConnectorAuth, type OAuthFlow, OAuthManager, type Plan, type PlanConcurrency, type PlanExecutionResult, PlanExecutor, type PlanExecutorConfig, type PlanExecutorEvents, type PlanInput, type PlanResult, type PlanStatus, type PlanUpdates, type PreparedContext, ProactiveCompactionStrategy, ProviderAuthError, ProviderCapabilities, ProviderConfigAgent, ProviderContextLengthError, ProviderError, ProviderErrorMapper, ProviderNotFoundError, ProviderRateLimitError, RollingWindowStrategy, type StoredConnectorConfig, type StoredToken, StreamEvent, StreamEventType, StreamHelpers, StreamState, SummarizeCompactor, type Task, TaskAgent, type TaskAgentConfig, TaskAgentContextProvider, type TaskAgentHooks, type AgentConfig as TaskAgentStateConfig, type TaskCondition, type TaskContext, type TaskExecution, type TaskInput, type TaskResult, type TaskStatus, type ToolContext as TaskToolContext, TextGenerateOptions, ToolCall, ToolExecutionError, ToolFunction, ToolNotFoundError, ToolTimeoutError, TruncateCompactor, VENDORS, Vendor, WorkingMemory, type WorkingMemoryAccess, type WorkingMemoryConfig, type WorkingMemoryEvents, addJitter, assertNotDestroyed, authenticatedFetch, backoffSequence, backoffWait, calculateBackoff, calculateCost, createAgentStorage, createAuthenticatedFetch, createEstimator, createExecuteJavaScriptTool, createMemoryTools, createMessageWithImages, createMetricsCollector, createProvider, createStrategy, createTextMessage, generateEncryptionKey, generateWebAPITool, getActiveModels, getModelInfo, getModelsByVendor, hasClipboardImage, isVendor, logger, metrics, readClipboardImage, retryWithBackoff, setMetricsCollector, index as tools };
