import { I as IConnectorRegistry, e as IProvider } from './IProvider-Br817mKc.cjs';
import { EventEmitter } from 'eventemitter3';

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
    /**
     * Images extracted from tool results via the __images convention.
     * Stored separately from `content` so they don't inflate text-based token counts.
     * Provider converters read this field to inject native multimodal image blocks.
     */
    __images?: Array<{
        base64: string;
        mediaType: string;
    }>;
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
    /** Total entry count (before any truncation for display) */
    totalEntryCount: number;
    /** Number of entries omitted from display due to maxIndexEntries limit */
    omittedCount: number;
}
/**
 * Configuration for working memory
 */
interface WorkingMemoryConfig {
    /** Max memory size in bytes. If not set, calculated from model context */
    maxSizeBytes?: number;
    /** Max number of entries in the memory index. Excess entries are auto-evicted via LRU. Default: 30 */
    maxIndexEntries?: number;
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
 *
 * This is a SIMPLE interface. Tools receive only what they need:
 * - agentId: For logging/tracing
 * - taskId: For task-aware operations
 * - memory: For storing/retrieving data
 * - signal: For cancellation
 *
 * Plugins and context management are NOT exposed to tools.
 * Tools should be self-contained and not depend on framework internals.
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
 *
 * Simple and clean - only what tools actually need.
 */
interface ToolContext {
    /** Agent ID (for logging/tracing) */
    agentId?: string;
    /** Task ID (if running in TaskAgent) */
    taskId?: string;
    /** User ID — auto-populated from Agent config (userId). Also settable manually via agent.tools.setToolContext(). */
    userId?: string;
    /** Connector registry scoped to this agent's allowed connectors and userId */
    connectorRegistry?: IConnectorRegistry;
    /** Working memory access (if agent has memory feature enabled) */
    memory?: WorkingMemoryAccess;
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
    tool_name?: string;
    tool_args?: Record<string, unknown>;
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
interface ToolPermissionConfig {
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
    permission?: ToolPermissionConfig;
    /**
     * Dynamic description generator for the tool.
     * If provided, this function is called when tool definitions are serialized for the LLM,
     * allowing the description to reflect current state (e.g., available connectors).
     *
     * The returned string replaces definition.function.description when sending to LLM.
     * The static description in definition.function.description serves as a fallback.
     *
     * @param context - Current ToolContext (includes userId, agentId, etc.)
     * @returns The current tool description
     *
     * @example
     * // Tool with dynamic connector list scoped to current user:
     * descriptionFactory: (context) => {
     *   const connectors = getConnectorsForUser(context?.userId);
     *   return `Execute API calls. Available connectors: ${connectors.map(c => c.name).join(', ')}`;
     * }
     */
    descriptionFactory?: (context?: ToolContext) => string;
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
 * Event types for agent execution
 * These events are emitted asynchronously for notifications (UI updates, logging, etc.)
 */

/**
 * Minimal config type for execution start events.
 * This captures the essential info without importing full AgentConfig.
 */
interface ExecutionConfig {
    model: string;
    instructions?: string;
    temperature?: number;
    maxIterations?: number;
}
interface ExecutionStartEvent {
    executionId: string;
    config: ExecutionConfig;
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
interface ExecutionMaxIterationsEvent {
    executionId: string;
    iteration: number;
    maxIterations: number;
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
    'execution:maxIterations': ExecutionMaxIterationsEvent;
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
 * Agent events - alias for AgenticLoopEvents for cleaner API
 * This is the preferred export name going forward.
 */
type AgentEvents = AgenticLoopEvents;
type AgentEventName = AgenticLoopEventName;

/**
 * Hook types for agent execution
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
    config: ExecutionConfig;
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
     * Unregister a specific hook function by reference.
     * Returns true if the hook was found and removed.
     */
    unregister(name: HookName, hook: Hook<any, any>): boolean;
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

export { type InputTextContent as $, type AgentEvents as A, type AgenticLoopEventName as B, type Content as C, type AgenticLoopEvents as D, ExecutionContext as E, type FunctionToolDefinition as F, type ApprovalResult as G, type HookConfig as H, type InputItem as I, type ApproveToolContext as J, type BeforeToolContext as K, type LLMResponse as L, type MemoryEntry as M, type BuiltInTool as N, type OutputItem as O, type PriorityCalculator as P, type CompactionItem as Q, ContentType as R, type StreamEvent as S, type ToolFunction as T, DEFAULT_MEMORY_CONFIG as U, type ErrorEvent as V, type WorkingMemoryConfig as W, type ExecutionConfig as X, type Hook as Y, HookManager as Z, type InputImageContent as _, type MemoryScope as a, type IterationCompleteEvent$1 as a0, type JSONSchema as a1, MEMORY_PRIORITY_VALUES as a2, type MemoryEntryInput as a3, type MemoryIndexEntry as a4, type Message as a5, type ModifyingHook as a6, type OutputTextContent as a7, type OutputTextDeltaEvent as a8, type OutputTextDoneEvent as a9, isTaskAwareScope as aA, isTerminalMemoryStatus as aB, isToolCallArgumentsDelta as aC, isToolCallArgumentsDone as aD, isToolCallStart as aE, scopeEquals as aF, scopeMatches as aG, type ExecutionCompleteEvent as aH, type ExecutionStartEvent as aI, type LLMRequestEvent as aJ, type LLMResponseEvent as aK, type ToolCompleteEvent as aL, type ToolStartEvent as aM, type ReasoningItem as aa, type ResponseCompleteEvent as ab, type ResponseCreatedEvent as ac, type ResponseInProgressEvent as ad, type SimpleScope as ae, type TaskAwareScope as af, type ToolCallArgumentsDeltaEvent as ag, type ToolCallArgumentsDoneEvent as ah, type ToolCallStartEvent as ai, ToolCallState as aj, type ToolExecutionContext as ak, type ToolExecutionDoneEvent as al, type ToolExecutionStartEvent as am, type ToolModification as an, type ToolResultContent as ao, type ToolUseContent as ap, calculateEntrySize as aq, defaultDescribeCall as ar, forPlan as as, forTasks as at, getToolCallDescription as au, isErrorEvent as av, isOutputTextDelta as aw, isResponseComplete as ax, isSimpleScope as ay, isStreamEvent as az, type Tool as b, type ToolContext as c, type ToolPermissionConfig as d, type ToolCall as e, type MemoryPriority as f, type MemoryTier as g, type ToolResult as h, type ITextProvider as i, type HistoryMode as j, type AgentResponse as k, type ExecutionMetrics as l, type AuditEntry as m, type HookName as n, type StaleEntryInfo as o, type PriorityContext as p, type MemoryIndex as q, type TaskStatusForMemory as r, type WorkingMemoryAccess as s, type TokenUsage as t, StreamEventType as u, type TextGenerateOptions as v, type ModelCapabilities as w, MessageRole as x, type AfterToolContext as y, type AgentEventName as z };
