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
interface ProvidersConfig {
    openai?: OpenAIConfig;
    anthropic?: AnthropicConfig;
    google?: GoogleConfig;
    'vertex-ai'?: VertexAIConfig;
    'google-vertex'?: VertexAIConfig;
    groq?: GroqConfig;
    grok?: GrokConfig;
    'together-ai'?: TogetherAIConfig;
    perplexity?: GenericOpenAIConfig;
    [key: string]: ProviderConfig | undefined;
}

/**
 * Base provider interface
 */
interface ProviderCapabilities {
    text: boolean;
    images: boolean;
    videos: boolean;
    audio: boolean;
}
interface IProvider {
    readonly name: string;
    readonly capabilities: ProviderCapabilities;
    /**
     * Validate that the provider configuration is correct
     */
    validateConfig(): Promise<boolean>;
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
 * User-provided tool function
 */
interface ToolFunction<TArgs = any, TResult = any> {
    definition: FunctionToolDefinition;
    execute: (args: TArgs) => Promise<TResult>;
}

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
interface IterationCompleteEvent extends BaseStreamEvent {
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
type StreamEvent = ResponseCreatedEvent | ResponseInProgressEvent | OutputTextDeltaEvent | OutputTextDoneEvent | ToolCallStartEvent | ToolCallArgumentsDeltaEvent | ToolCallArgumentsDoneEvent | ToolExecutionStartEvent | ToolExecutionDoneEvent | IterationCompleteEvent | ResponseCompleteEvent | ErrorEvent;
/**
 * Type guard to check if event is a specific type
 */
declare function isStreamEvent<T extends StreamEvent>(event: StreamEvent, type: StreamEventType): event is T;
/**
 * Type guards for specific events
 */
declare function isOutputTextDelta(event: StreamEvent): event is OutputTextDeltaEvent;
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
 * Image generation provider interface
 */

interface ImageGenerateOptions {
    model: string;
    prompt: string;
    size?: string;
    quality?: 'standard' | 'hd';
    style?: 'vivid' | 'natural';
    n?: number;
    response_format?: 'url' | 'b64_json';
}
interface ImageEditOptions {
    model: string;
    image: Buffer | string;
    prompt: string;
    mask?: Buffer | string;
    size?: string;
    n?: number;
    response_format?: 'url' | 'b64_json';
}
interface ImageVariationOptions {
    model: string;
    image: Buffer | string;
    n?: number;
    size?: string;
    response_format?: 'url' | 'b64_json';
}
interface ImageResponse {
    created: number;
    data: Array<{
        url?: string;
        b64_json?: string;
        revised_prompt?: string;
    }>;
}
interface IImageProvider extends IProvider {
    /**
     * Generate images from text prompt
     */
    generateImage(options: ImageGenerateOptions): Promise<ImageResponse>;
    /**
     * Edit an existing image (optional - not all providers support)
     */
    editImage?(options: ImageEditOptions): Promise<ImageResponse>;
    /**
     * Create variations of an image (optional)
     */
    createVariation?(options: ImageVariationOptions): Promise<ImageResponse>;
    /**
     * List available models
     */
    listModels?(): Promise<string[]>;
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
 * Provider registry - manages provider configurations and instances
 *
 * Implements IDisposable for proper resource cleanup and uses
 * promise-based locking to prevent race conditions during lazy loading.
 */

declare class ProviderRegistry implements IDisposable {
    private configs;
    private textProviders;
    private imageProviders;
    private textProviderPromises;
    private imageProviderPromises;
    private _isDestroyed;
    get isDestroyed(): boolean;
    constructor(providersConfig: ProvidersConfig);
    /**
     * Register a provider configuration
     */
    private registerConfig;
    /**
     * Get a text provider instance (lazy loaded and cached)
     * Uses promise-based locking to prevent race conditions
     */
    getTextProvider(name: string): Promise<ITextProvider>;
    /**
     * Get a text provider instance synchronously (for backward compatibility)
     * WARNING: This method may create duplicate providers under concurrent access.
     * Prefer getTextProvider() (async) for new code.
     * @deprecated Use async getTextProvider() instead to prevent race conditions
     */
    getTextProviderSync(name: string): ITextProvider;
    /**
     * Get an image provider instance (lazy loaded and cached)
     * Uses promise-based locking to prevent race conditions
     */
    getImageProvider(name: string): Promise<IImageProvider>;
    /**
     * Async wrapper for text provider creation
     */
    private createTextProviderAsync;
    /**
     * Async wrapper for image provider creation
     */
    private createImageProviderAsync;
    /**
     * Factory method to create text provider
     */
    private createTextProvider;
    /**
     * Factory method to create image provider
     */
    private createImageProvider;
    /**
     * Check if a provider is registered
     */
    hasProvider(name: string): boolean;
    /**
     * List all registered provider names
     */
    listProviders(): string[];
    /**
     * Get provider configuration
     */
    getConfig(name: string): ProviderConfig | undefined;
    /**
     * Destroy the registry and release all resources
     * Safe to call multiple times (idempotent)
     */
    destroy(): void;
}

export { type IImageProvider as $, type AgentResponse as A, type BuiltInTool as B, ContentType as C, type ToolExecutionDoneEvent as D, type IterationCompleteEvent as E, type FunctionToolDefinition as F, type ResponseCompleteEvent as G, type ErrorEvent as H, type IDisposable as I, type JSONSchema as J, isStreamEvent as K, type LLMResponse as L, MessageRole as M, isOutputTextDelta as N, type OutputTextContent as O, ProviderRegistry as P, isToolCallArgumentsDelta as Q, type ReasoningItem as R, type StreamEvent as S, type TokenUsage as T, isToolCallArgumentsDone as U, isResponseComplete as V, isErrorEvent as W, type IProvider as X, type ITextProvider as Y, type TextGenerateOptions as Z, type ModelCapabilities as _, type InputItem as a, type ImageGenerateOptions as a0, type ImageEditOptions as a1, type ImageVariationOptions as a2, type ImageResponse as a3, type IAsyncDisposable as a4, assertNotDestroyed as a5, type ProviderConfig as a6, type OpenAIConfig as a7, type AnthropicConfig as a8, type GoogleConfig as a9, type VertexAIConfig as aa, type GroqConfig as ab, type GrokConfig as ac, type TogetherAIConfig as ad, type GenericOpenAIConfig as ae, type ProvidersConfig as b, type ProviderCapabilities as c, type ToolCall as d, StreamEventType as e, type ToolFunction as f, type Content as g, type InputTextContent as h, type InputImageContent as i, type ToolUseContent as j, type ToolResultContent as k, type Message as l, type OutputItem as m, type CompactionItem as n, ToolCallState as o, type Tool as p, type ToolResult as q, type ToolExecutionContext as r, type ResponseCreatedEvent as s, type ResponseInProgressEvent as t, type OutputTextDeltaEvent as u, type OutputTextDoneEvent as v, type ToolCallStartEvent as w, type ToolCallArgumentsDeltaEvent as x, type ToolCallArgumentsDoneEvent as y, type ToolExecutionStartEvent as z };
