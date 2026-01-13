import { d as ToolCall, q as ToolResult, Z as TextGenerateOptions, A as AgentResponse, p as Tool, f as ToolFunction, a as InputItem, Y as ITextProvider, S as StreamEvent, I as IDisposable, P as ProviderRegistry } from './ProviderRegistry-_Vu3HZs_.js';
import { EventEmitter } from 'eventemitter3';

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
    type: 'hook_executed' | 'tool_modified' | 'tool_skipped' | 'execution_paused' | 'execution_resumed' | 'tool_approved' | 'tool_rejected';
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
 * Tool registry - manages tool registration and execution
 */

declare class ToolRegistry implements IToolExecutor {
    private tools;
    /**
     * Register a new tool
     */
    registerTool(tool: ToolFunction): void;
    /**
     * Unregister a tool
     */
    unregisterTool(toolName: string): void;
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
        toolFailureMode?: 'fail' | 'warn' | 'continue';
        maxConsecutiveErrors?: number;
    };
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
     * Build input with tool results
     */
    private buildInputWithToolResults;
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

interface AgentConfig {
    provider: string;
    model: string;
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
        /** Maximum number of input messages to keep (prevents unbounded context growth) */
        maxInputMessages?: number;
    };
    errorHandling?: {
        hookFailureMode?: 'fail' | 'warn' | 'ignore';
        toolFailureMode?: 'fail' | 'warn' | 'continue';
        maxConsecutiveErrors?: number;
    };
}
declare class Agent extends EventEmitter<AgenticLoopEvents> implements IDisposable {
    private config;
    private toolRegistry;
    private agenticLoop;
    private cleanupCallbacks;
    private boundListeners;
    private _isDestroyed;
    get isDestroyed(): boolean;
    constructor(config: AgentConfig, textProvider: ITextProvider, toolRegistry: ToolRegistry);
    /**
     * Run the agent with input
     * @throws Error if agent has been destroyed
     */
    run(input: string | InputItem[]): Promise<AgentResponse>;
    /**
     * Stream response from the agent with real-time events
     * Returns an async iterator of streaming events
     * Supports full agentic loop with tool calling
     * @throws Error if agent has been destroyed
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
     * Get current execution context
     */
    getContext(): ExecutionContext | null;
    /**
     * Get execution metrics
     */
    getMetrics(): ExecutionMetrics | null;
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
    } | null;
    /**
     * Get audit trail
     */
    getAuditTrail(): readonly AuditEntry[];
    /**
     * Check if currently running
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
    /**
     * Register cleanup callback
     */
    onCleanup(callback: () => void): void;
    /**
     * Destroy agent and cleanup resources
     * Safe to call multiple times (idempotent)
     */
    destroy(): void;
}

/**
 * Agent manager - creates and manages agents with tool calling
 *
 * Implements IDisposable for proper resource cleanup
 */

declare class AgentManager implements IDisposable {
    private registry;
    private toolRegistry;
    private agents;
    private _isDestroyed;
    get isDestroyed(): boolean;
    constructor(registry: ProviderRegistry);
    /**
     * Create a new agent instance
     * @returns Promise<Agent> - async to support race-condition-free provider loading
     */
    create(config: AgentConfig): Promise<Agent>;
    /**
     * Convenience method for one-off agent calls
     */
    run(config: AgentConfig & {
        input: string | any[];
    }): Promise<any>;
    /**
     * Get the number of active agents
     */
    getActiveAgentCount(): number;
    /**
     * Destroy the manager and all managed agents
     * Safe to call multiple times (idempotent)
     */
    destroy(): void;
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

export { AgentManager as A, type BeforeToolContext as B, ExecutionContext as E, HookManager as H, type IToolExecutor as I, type LLMRequestEvent as L, type ModifyingHook as M, ToolRegistry as T, Agent as a, type AgentConfig as b, type AgenticLoopEvents as c, type AgenticLoopEventName as d, type HookConfig as e, type HookName as f, type Hook as g, type AfterToolContext as h, type ApproveToolContext as i, type ToolModification as j, type ApprovalResult as k, type HistoryMode as l, type ExecutionMetrics as m, type AuditEntry as n, AgenticLoop as o, type AgenticLoopConfig as p, type ExecutionStartEvent as q, type ExecutionCompleteEvent as r, type ToolStartEvent as s, type ToolCompleteEvent as t, type LLMResponseEvent as u };
