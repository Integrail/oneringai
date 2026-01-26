import EventEmitter$2, { EventEmitter as EventEmitter$1 } from 'eventemitter3';
import { I as IProvider } from './IProvider-BP49c93d.js';
import { EventEmitter } from 'events';

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
 * Tool context - passed to tools during execution (optional, for TaskAgent)
 */
interface ToolContext {
    agentId: string;
    taskId?: string;
    memory?: any;
    signal?: AbortSignal;
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
    safe: boolean;
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
declare class AgenticLoop extends EventEmitter$1<AgenticLoopEvents> {
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
declare class CircuitBreaker<T = any> extends EventEmitter$2<CircuitBreakerEvents> {
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

declare class ToolRegistry implements IToolExecutor {
    private tools;
    private circuitBreakers;
    private logger;
    constructor();
    /**
     * Register a new tool
     */
    registerTool(tool: ToolFunction): void;
    /**
     * Unregister a tool
     */
    unregisterTool(toolName: string): void;
    /**
     * Get or create circuit breaker for a tool
     */
    private getCircuitBreaker;
    /**
     * Execute a tool function
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
     * List all registered tools
     */
    listTools(): string[];
    /**
     * Clear all registered tools
     */
    clear(): void;
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
    constructor(config: HookConfig | undefined, emitter: EventEmitter$1, errorHandling?: {
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

export { type FunctionToolDefinition as $, type AgenticLoopEvents as A, ContentType as B, type CircuitState as C, DEFAULT_PERMISSION_CONFIG as D, ExecutionContext as E, type Content as F, type InputTextContent as G, type HookConfig as H, type InputItem as I, type InputImageContent as J, type ToolUseContent as K, type LLMResponse as L, type ModelCapabilities as M, type ToolResultContent as N, type OutputTextContent as O, type PermissionScope as P, type Message as Q, type RiskLevel as R, type SerializedApprovalState as S, type ToolFunction as T, type OutputItem as U, type CompactionItem as V, type ReasoningItem as W, ToolCallState as X, defaultDescribeCall as Y, getToolCallDescription as Z, type Tool as _, type ToolPermissionConfig$1 as a, type BuiltInTool as a0, type ToolResult as a1, type ToolExecutionContext as a2, type JSONSchema as a3, type ResponseCreatedEvent as a4, type ResponseInProgressEvent as a5, type OutputTextDeltaEvent as a6, type OutputTextDoneEvent as a7, type ToolCallStartEvent as a8, type ToolCallArgumentsDeltaEvent as a9, type CircuitBreakerConfig as aA, type CircuitBreakerEvents as aB, DEFAULT_CIRCUIT_BREAKER_CONFIG as aC, AgenticLoop as aD, type AgenticLoopConfig as aE, type ExecutionStartEvent as aF, type ExecutionCompleteEvent as aG, type ToolStartEvent as aH, type ToolCompleteEvent as aI, type LLMRequestEvent as aJ, type LLMResponseEvent as aK, type ToolCallArgumentsDoneEvent as aa, type ToolExecutionStartEvent as ab, type ToolExecutionDoneEvent as ac, type IterationCompleteEvent$1 as ad, type ResponseCompleteEvent as ae, type ErrorEvent as af, isStreamEvent as ag, isOutputTextDelta as ah, isToolCallStart as ai, isToolCallArgumentsDelta as aj, isToolCallArgumentsDone as ak, isResponseComplete as al, isErrorEvent as am, ToolRegistry as an, HookManager as ao, type AgenticLoopEventName as ap, type HookName as aq, type Hook as ar, type ModifyingHook as as, type BeforeToolContext as at, type AfterToolContext as au, type ApproveToolContext as av, type ToolModification as aw, type ApprovalResult as ax, type IToolExecutor as ay, CircuitOpenError as az, ToolPermissionManager as b, type HistoryMode as c, type AgentPermissionsConfig as d, type AgentResponse as e, type StreamEvent as f, type ExecutionMetrics as g, type AuditEntry as h, type CircuitBreakerMetrics as i, type ITextProvider as j, type TokenUsage as k, type ToolCall as l, StreamEventType as m, CircuitBreaker as n, type TextGenerateOptions as o, MessageRole as p, type ToolPermissionConfig as q, type ApprovalCacheEntry as r, type SerializedApprovalEntry as s, type PermissionCheckResult as t, type ApprovalDecision as u, type PermissionCheckContext as v, type PermissionManagerEvent as w, APPROVAL_STATE_VERSION as x, DEFAULT_ALLOWLIST as y, type DefaultAllowlistedTool as z };
