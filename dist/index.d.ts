import { C as Connector, A as AudioFormat, I as IBaseModelDescription, V as VendorOptionSchema, a as Vendor, b as IImageProvider, c as ITokenStorage, S as StoredToken$1, d as ConnectorConfig, e as ConnectorConfigResult } from './ImageModel-B_-3MdrA.js';
export { l as APIKeyConnectorAuth, B as AspectRatio, k as ConnectorAuth, m as IImageModelDescription, p as IMAGE_MODELS, q as IMAGE_MODEL_REGISTRY, E as ISourceLinks, x as ImageEditOptions, w as ImageGenerateOptions, g as ImageGeneration, h as ImageGenerationCreateOptions, n as ImageModelCapabilities, o as ImageModelPricing, z as ImageResponse, y as ImageVariationOptions, J as JWTConnectorAuth, O as OAuthConnectorAuth, D as OutputFormat, Q as QualityLevel, j as SimpleGenerateOptions, f as VENDORS, v as calculateImageCost, t as getActiveImageModels, r as getImageModelInfo, s as getImageModelsByVendor, u as getImageModelsWithFeature, i as isVendor } from './ImageModel-B_-3MdrA.js';
import EventEmitter$2, { EventEmitter as EventEmitter$1 } from 'eventemitter3';
import { EventEmitter } from 'events';
import { T as ToolFunction, a as ToolPermissionConfig, S as SerializedApprovalState, A as AgenticLoopEvents, b as ToolPermissionManager, H as HookConfig, c as HistoryMode, d as AgentPermissionsConfig, I as InputItem, e as AgentResponse, f as StreamEvent, E as ExecutionContext, g as ExecutionMetrics, h as AuditEntry, C as CircuitState, i as CircuitBreakerMetrics, j as ITextProvider, k as TokenUsage, l as ToolCall, L as LLMResponse, m as StreamEventType, n as CircuitBreaker, o as TextGenerateOptions, M as ModelCapabilities, p as MessageRole } from './index-CuHIYAT9.js';
export { x as APPROVAL_STATE_VERSION, aq as AfterToolContext, al as AgenticLoopEventName, r as ApprovalCacheEntry, u as ApprovalDecision, at as ApprovalResult, ar as ApproveToolContext, ap as BeforeToolContext, Y as BuiltInTool, aw as CircuitBreakerConfig, ax as CircuitBreakerEvents, av as CircuitOpenError, Q as CompactionItem, z as Content, y as ContentType, ay as DEFAULT_CIRCUIT_BREAKER_CONFIG, D as DEFAULT_PERMISSION_CONFIG, ab as ErrorEvent, X as FunctionToolDefinition, an as Hook, ak as HookManager, am as HookName, au as IToolExecutor, F as InputImageContent, B as InputTextContent, a9 as IterationCompleteEvent, $ as JSONSchema, K as Message, ao as ModifyingHook, N as OutputItem, O as OutputTextContent, a2 as OutputTextDeltaEvent, a3 as OutputTextDoneEvent, v as PermissionCheckContext, t as PermissionCheckResult, w as PermissionManagerEvent, P as PermissionScope, U as ReasoningItem, aa as ResponseCompleteEvent, a0 as ResponseCreatedEvent, a1 as ResponseInProgressEvent, R as RiskLevel, s as SerializedApprovalEntry, W as Tool, a5 as ToolCallArgumentsDeltaEvent, a6 as ToolCallArgumentsDoneEvent, a4 as ToolCallStartEvent, V as ToolCallState, _ as ToolExecutionContext, a8 as ToolExecutionDoneEvent, a7 as ToolExecutionStartEvent, as as ToolModification, q as ToolPermissionConfig, aj as ToolRegistry, Z as ToolResult, J as ToolResultContent, G as ToolUseContent, ai as isErrorEvent, ad as isOutputTextDelta, ah as isResponseComplete, ac as isStreamEvent, af as isToolCallArgumentsDelta, ag as isToolCallArgumentsDone, ae as isToolCallStart } from './index-CuHIYAT9.js';
import { I as IProvider, P as ProviderCapabilities } from './IProvider-BP49c93d.js';

/**
 * ToolManager - Dynamic tool management for agents
 *
 * Provides advanced tool management capabilities:
 * - Enable/disable tools at runtime without removing them
 * - Namespace grouping for organizing related tools
 * - Priority-based selection
 * - Context-aware tool selection
 * - Usage statistics
 *
 * Backward compatible: Works with existing ToolFunction interface
 */

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
declare class ToolManager extends EventEmitter {
    private registry;
    private namespaceIndex;
    constructor();
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
    scope: 'task' | 'persistent';
    sizeBytes: number;
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
type SessionManagerEvent = 'session:created' | 'session:saved' | 'session:loaded' | 'session:deleted' | 'session:error';
interface SessionManagerConfig {
    storage: ISessionStorage;
    /** Default metadata for new sessions */
    defaultMetadata?: Partial<SessionMetadata>;
}
declare class SessionManager extends EventEmitter {
    private storage;
    private defaultMetadata;
    private autoSaveTimers;
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
 * Session configuration for Agent
 */
interface AgentSessionConfig {
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
    /** Session configuration for persistence (opt-in) */
    session?: AgentSessionConfig;
    /** Provide a pre-configured ToolManager (advanced) */
    toolManager?: ToolManager;
    /**
     * Permission configuration for tool execution approval.
     * Controls allowlist/blocklist, default scopes, and approval callbacks.
     */
    permissions?: AgentPermissionsConfig;
}
/**
 * Agent class - represents an AI assistant with tool calling capabilities
 */
declare class Agent extends EventEmitter$1<AgenticLoopEvents> implements IDisposable {
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
    private _toolManager;
    private _permissionManager;
    private _sessionManager;
    private _session;
    private _pendingSessionLoad;
    get isDestroyed(): boolean;
    /**
     * Advanced tool management. Returns ToolManager for fine-grained control.
     * For simple cases, use addTool/removeTool instead.
     */
    get tools(): ToolManager;
    /**
     * Permission management. Returns ToolPermissionManager for approval control.
     * Use for runtime permission management, approval caching, and allowlist/blocklist.
     */
    get permissions(): ToolPermissionManager;
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
    /**
     * Internal method to load session
     */
    private loadSessionInternal;
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
     * List registered tools (returns enabled tool names)
     */
    listTools(): string[];
    /**
     * Replace all tools with a new array
     */
    setTools(tools: ToolFunction[]): void;
    /**
     * Approve a tool for the current session.
     * Tool will not require further approval until session ends or approval is revoked.
     */
    approveToolForSession(toolName: string): void;
    /**
     * Revoke a tool's session approval.
     * Tool will require approval again on next use.
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
     * Get the current session ID (if session is enabled)
     */
    getSessionId(): string | null;
    /**
     * Check if this agent has session support enabled
     */
    hasSession(): boolean;
    /**
     * Save the current session to storage
     * @throws Error if session is not enabled
     */
    saveSession(): Promise<void>;
    /**
     * Get the current session (for advanced use)
     */
    getSession(): Session | null;
    /**
     * Update session custom data
     */
    updateSessionData(key: string, value: unknown): void;
    /**
     * Get session custom data
     */
    getSessionData<T = unknown>(key: string): T | undefined;
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
declare class ContextManager$1 extends EventEmitter$2<ContextManagerEvents$1> {
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
declare class WorkingMemory extends EventEmitter$2<WorkingMemoryEvents> {
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
declare class ExternalDependencyHandler extends EventEmitter$2<ExternalDependencyEvents> {
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
declare class PlanExecutor extends EventEmitter$2<PlanExecutorEvents> {
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
 * Session configuration for TaskAgent
 */
interface TaskAgentSessionConfig {
    /** Storage backend for sessions */
    storage: ISessionStorage;
    /** Resume existing session by ID */
    id?: string;
    /** Auto-save session after each task completion */
    autoSave?: boolean;
    /** Auto-save interval in milliseconds */
    autoSaveIntervalMs?: number;
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
    /** Storage for persistence (agent state, checkpoints) */
    storage?: IAgentStorage;
    /** Memory configuration */
    memoryConfig?: WorkingMemoryConfig;
    /** Hooks for customization */
    hooks?: TaskAgentHooks;
    /** Session configuration for persistence (opt-in) */
    session?: TaskAgentSessionConfig;
    /** Provide a pre-configured ToolManager (advanced) */
    toolManager?: ToolManager;
    /**
     * Permission configuration for tool execution approval.
     * Controls allowlist/blocklist, default scopes, and approval callbacks.
     * Passed through to the internal Agent.
     */
    permissions?: AgentPermissionsConfig;
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
declare class TaskAgent extends EventEmitter$2<TaskAgentEvents> {
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
    protected _tools: ToolFunction[];
    protected _toolManager: ToolManager;
    protected config: TaskAgentConfig;
    protected _sessionManager: SessionManager | null;
    protected _session: Session | null;
    private eventCleanupFunctions;
    /**
     * Advanced tool management. Returns ToolManager for fine-grained control.
     */
    get tools(): ToolManager;
    /**
     * Permission management. Returns ToolPermissionManager for approval control.
     * Delegates to internal Agent's permission manager.
     */
    get permissions(): ToolPermissionManager | undefined;
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
     * Get the current session ID (if session is enabled)
     */
    getSessionId(): string | null;
    /**
     * Check if this agent has session support enabled
     */
    hasSession(): boolean;
    /**
     * Save the current session to storage
     * @throws Error if session is not enabled
     */
    saveSession(): Promise<void>;
    /**
     * Get the current session (for advanced use)
     */
    getSession(): Session | null;
    /**
     * Update session custom data
     */
    updateSessionData(key: string, value: unknown): void;
    /**
     * Get session custom data
     */
    getSessionData<T = unknown>(key: string): T | undefined;
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
declare class ContextManager extends EventEmitter$2<ContextManagerEvents> {
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

type AgentMode = 'interactive' | 'planning' | 'executing';
interface UniversalAgentSessionConfig {
    /** Storage backend for sessions */
    storage: ISessionStorage;
    /** Resume existing session by ID */
    id?: string;
    /** Auto-save session after each interaction */
    autoSave?: boolean;
    /** Auto-save interval in milliseconds */
    autoSaveIntervalMs?: number;
}
interface UniversalAgentPlanningConfig {
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
interface UniversalAgentConfig {
    connector: string | Connector;
    model: string;
    name?: string;
    tools?: ToolFunction[];
    instructions?: string;
    temperature?: number;
    maxIterations?: number;
    planning?: UniversalAgentPlanningConfig;
    session?: UniversalAgentSessionConfig;
    memoryConfig?: WorkingMemoryConfig;
    toolManager?: ToolManager;
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
}
declare class UniversalAgent extends EventEmitter {
    readonly name: string;
    readonly connector: Connector;
    readonly model: string;
    private config;
    private agent;
    private _toolManager;
    private modeManager;
    private planningAgent?;
    private workingMemory;
    private _sessionManager;
    private _session;
    private currentPlan;
    private executionHistory;
    private isDestroyed;
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
    private buildInstructions;
    private buildTaskPrompt;
    private formatPlanSummary;
    private formatProgress;
    private getTaskProgress;
    getSessionId(): string | null;
    hasSession(): boolean;
    saveSession(): Promise<void>;
    private loadSession;
    getSession(): Session | null;
    getMode(): AgentMode;
    getPlan(): Plan | null;
    getProgress(): TaskProgress | null;
    get toolManager(): ToolManager;
    /**
     * Permission management. Returns ToolPermissionManager for approval control.
     * Delegates to internal Agent's permission manager.
     */
    get permissions(): ToolPermissionManager;
    setAutoApproval(value: boolean): void;
    setPlanningEnabled(value: boolean): void;
    private _isPaused;
    pause(): void;
    resume(): void;
    cancel(): void;
    isRunning(): boolean;
    isPaused(): boolean;
    onCleanup(callback: () => void): void;
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

export { AIError, AdaptiveStrategy, Agent, type AgentConfig$1 as AgentConfig, type AgentHandle, type AgentMetrics, type AgentMode, AgentPermissionsConfig, AgentResponse, type AgentSessionConfig, type AgentState, type AgentStatus, AgenticLoopEvents, AggressiveCompactionStrategy, ApproximateTokenEstimator, AudioFormat, AuditEntry, type BackoffConfig, type BackoffStrategyType, BaseMediaProvider, BaseProvider, BaseTextProvider, CONNECTOR_CONFIG_VERSION, type CacheStats, CheckpointManager, type CheckpointStrategy, CircuitBreaker, CircuitBreakerMetrics, CircuitState, type ClipboardImageResult, Connector, ConnectorConfig, ConnectorConfigResult, ConnectorConfigStore, ConsoleMetrics, type ContextBudget, ContextManager, type ContextManagerConfig, type ConversationMessage, DEFAULT_BACKOFF_CONFIG, DEFAULT_CHECKPOINT_STRATEGY, DEFAULT_CONTEXT_CONFIG, DEFAULT_HISTORY_CONFIG, DEFAULT_IDEMPOTENCY_CONFIG, DEFAULT_MEMORY_CONFIG, type ErrorContext, ExecutionContext, ExecutionMetrics, type ExecutionResult, type ExternalDependency, type ExternalDependencyEvents, ExternalDependencyHandler, FileConnectorStorage, type FileConnectorStorageConfig, FileSessionStorage, type FileSessionStorageConfig, FileStorage, type FileStorageConfig, FrameworkLogger, HistoryManager, type HistoryManagerConfig, HistoryMode, HookConfig, type IAgentStateStorage, type IAgentStorage, type IAsyncDisposable, IBaseModelDescription, type IConnectorConfigStorage, type IContextCompactor, type IContextComponent, type IContextProvider, type IContextStrategy, type IDisposable, IImageProvider, type ILLMDescription, type IMemoryStorage, type IPlanStorage, IProvider, type ISTTModelDescription, type ISessionStorage, type ISpeechToTextProvider, type ITTSModelDescription, ITextProvider, type ITextToSpeechProvider, type ITokenEstimator, ITokenStorage, type IVideoModelDescription, type IVideoProvider, type IVoiceInfo, IdempotencyCache, type IdempotencyCacheConfig, InMemoryAgentStateStorage, InMemoryMetrics, InMemoryPlanStorage, InMemorySessionStorage, InMemoryStorage, InputItem, type IntentAnalysis, InvalidConfigError, InvalidToolArgumentsError, LLMResponse, LLM_MODELS, LazyCompactionStrategy, type LogEntry, type LogLevel, type LoggerConfig, META_TOOL_NAMES, MODEL_REGISTRY, MemoryConnectorStorage, type MemoryEntry, MemoryEvictionCompactor, type MemoryIndex, type MemoryIndexEntry, type MemoryScope, MemoryStorage, MessageBuilder, MessageRole, type MetricTags, type MetricsCollector, type MetricsCollectorType, ModeManager, type ModeManagerEvents, type ModeState, ModelCapabilities, ModelNotSupportedError, NoOpMetrics, type OAuthConfig, type OAuthFlow, OAuthManager, type Plan, type PlanChange, type PlanConcurrency, type PlanExecutionResult, PlanExecutor, type PlanExecutorConfig, type PlanExecutorEvents, type PlanInput, type PlanResult, type PlanStatus, type PlanUpdates, type PreparedContext, ProactiveCompactionStrategy, ProviderAuthError, ProviderCapabilities, ProviderConfigAgent, ProviderContextLengthError, ProviderError, ProviderErrorMapper, ProviderNotFoundError, ProviderRateLimitError, RollingWindowStrategy, type STTModelCapabilities, type STTOptions, type STTOutputFormat$1 as STTOutputFormat, type STTResponse, STT_MODELS, STT_MODEL_REGISTRY, type SegmentTimestamp, SerializedApprovalState, type SerializedHistory, type SerializedHistoryEntry, type SerializedMemory, type SerializedMemoryEntry, type SerializedPlan, type SerializedToolState, type Session, type SessionFilter, SessionManager, type SessionManagerConfig, type SessionManagerEvent, type SessionMetadata, type SessionMetrics, type SessionSummary, type SimpleVideoGenerateOptions, SpeechToText, type SpeechToTextConfig, type StoredConnectorConfig, type StoredToken, StreamEvent, StreamEventType, StreamHelpers, StreamState, SummarizeCompactor, type TTSModelCapabilities, type TTSOptions, type TTSResponse, TTS_MODELS, TTS_MODEL_REGISTRY, type Task, TaskAgent, type TaskAgentConfig, TaskAgentContextProvider, type TaskAgentHooks, type TaskAgentSessionConfig, type AgentConfig as TaskAgentStateConfig, type TaskCondition, type TaskContext, type TaskExecution, type TaskInput, type TaskProgress, type TaskResult, type TaskStatus, type ToolContext as TaskToolContext, TextGenerateOptions, TextToSpeech, type TextToSpeechConfig, ToolCall, type ToolCondition, ToolExecutionError, ToolFunction, ToolManager, type ToolManagerEvent, type ToolManagerStats, type ToolMetadata, ToolNotFoundError, type ToolOptions, ToolPermissionManager, type ToolRegistration, type ToolSelectionContext, ToolTimeoutError, TruncateCompactor, UniversalAgent, type UniversalAgentConfig, type UniversalAgentEvents, type UniversalAgentPlanningConfig, type UniversalAgentSessionConfig, type UniversalEvent, type UniversalResponse, type ToolCallResult as UniversalToolCallResult, VIDEO_MODELS, VIDEO_MODEL_REGISTRY, Vendor, VendorOptionSchema, type VideoExtendOptions, type VideoGenerateOptions, VideoGeneration, type VideoGenerationCreateOptions, type VideoJob, type VideoModelCapabilities, type VideoModelPricing, type VideoResponse, type VideoStatus, type WordTimestamp, WorkingMemory, type WorkingMemoryAccess, type WorkingMemoryConfig, type WorkingMemoryEvents, addHistoryEntry, addJitter, assertNotDestroyed, authenticatedFetch, backoffSequence, backoffWait, calculateBackoff, calculateCost, calculateSTTCost, calculateTTSCost, calculateVideoCost, createAgentStorage, createAuthenticatedFetch, createEmptyHistory, createEmptyMemory, createEstimator, createExecuteJavaScriptTool, createImageProvider, createMemoryTools, createMessageWithImages, createMetricsCollector, createProvider, createStrategy, createTextMessage, createVideoProvider, generateEncryptionKey, generateWebAPITool, getActiveModels, getActiveSTTModels, getActiveTTSModels, getActiveVideoModels, getMetaTools, getModelInfo, getModelsByVendor, getSTTModelInfo, getSTTModelsByVendor, getSTTModelsWithFeature, getTTSModelInfo, getTTSModelsByVendor, getTTSModelsWithFeature, getVideoModelInfo, getVideoModelsByVendor, getVideoModelsWithAudio, getVideoModelsWithFeature, hasClipboardImage, isMetaTool, logger, metrics, readClipboardImage, retryWithBackoff, setMetricsCollector, index as tools };
