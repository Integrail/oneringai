import { EventEmitter } from 'eventemitter3';
import { A as AgenticLoopEvents, T as ToolFunction, H as HookConfig, a as HistoryMode, I as InputItem, b as AgentResponse, S as StreamEvent, E as ExecutionContext, c as ExecutionMetrics, d as AuditEntry, e as ITextProvider, f as TokenUsage, g as ToolCall, L as LLMResponse, h as StreamEventType, i as IProvider, P as ProviderCapabilities, j as TextGenerateOptions, M as ModelCapabilities, k as MessageRole } from './index-DYzJIe1v.js';
export { a9 as AfterToolContext, a4 as AgenticLoopEventName, ac as ApprovalResult, aa as ApproveToolContext, a8 as BeforeToolContext, B as BuiltInTool, s as CompactionItem, l as Content, C as ContentType, X as ErrorEvent, F as FunctionToolDefinition, a6 as Hook, a3 as HookManager, a5 as HookName, ad as IToolExecutor, n as InputImageContent, m as InputTextContent, V as IterationCompleteEvent, J as JSONSchema, q as Message, a7 as ModifyingHook, r as OutputItem, O as OutputTextContent, z as OutputTextDeltaEvent, D as OutputTextDoneEvent, R as ReasoningItem, W as ResponseCompleteEvent, x as ResponseCreatedEvent, y as ResponseInProgressEvent, u as Tool, K as ToolCallArgumentsDeltaEvent, N as ToolCallArgumentsDoneEvent, G as ToolCallStartEvent, t as ToolCallState, w as ToolExecutionContext, U as ToolExecutionDoneEvent, Q as ToolExecutionStartEvent, ab as ToolModification, a2 as ToolRegistry, v as ToolResult, p as ToolResultContent, o as ToolUseContent, a1 as isErrorEvent, Z as isOutputTextDelta, a0 as isResponseComplete, Y as isStreamEvent, _ as isToolCallArgumentsDelta, $ as isToolCallArgumentsDone } from './index-DYzJIe1v.js';

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
 * Token storage interface (Clean Architecture - Domain Layer)
 * All implementations must encrypt tokens at rest
 */
interface StoredToken {
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
    storeToken(key: string, token: StoredToken): Promise<void>;
    /**
     * Retrieve token (must be decrypted by implementation)
     *
     * @param key - Unique identifier for the token
     * @returns Decrypted token or null if not found
     */
    getToken(key: string): Promise<StoredToken | null>;
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
    readonly name: string;
    readonly vendor?: Vendor;
    readonly config: ConnectorConfig;
    private oauthManager?;
    private disposed;
    private constructor();
    /**
     * Get the API key (for api_key auth type)
     */
    getApiKey(): string;
    /**
     * Get the current access token (for OAuth)
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
interface AgentConfig {
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
    static create(config: AgentConfig): Agent;
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
 * Base text provider with common text generation functionality
 */

declare abstract class BaseTextProvider extends BaseProvider implements ITextProvider {
    abstract generate(options: TextGenerateOptions): Promise<LLMResponse>;
    abstract streamGenerate(options: TextGenerateOptions): AsyncIterableIterator<StreamEvent>;
    abstract getModelCapabilities(model: string): ModelCapabilities;
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
 * Connector Interface
 *
 * Represents an authenticated connection to an external system API
 * (GitHub, Microsoft, Salesforce, Slack, etc.)
 *
 * IMPORTANT: This is DIFFERENT from IProvider (OpenAI, Anthropic)
 * - Providers: AI capabilities (text generation, vision, etc.)
 * - Connectors: External system authentication and API access
 */

/**
 * Connector interface for external system authentication
 */
interface IConnector {
    /**
     * Unique connector name (e.g., "github", "microsoft")
     */
    readonly name: string;
    /**
     * Human-readable display name (e.g., "GitHub API")
     */
    readonly displayName: string;
    /**
     * API base URL
     */
    readonly baseURL: string;
    /**
     * Connector configuration
     */
    readonly config: ConnectorConfig;
    /**
     * Get valid access token for API calls
     * Automatically refreshes if expired (for OAuth)
     *
     * @param userId - Optional user identifier for multi-user support
     * @returns Access token for API authorization
     */
    getToken(userId?: string): Promise<string>;
    /**
     * Check if current token is valid
     *
     * @param userId - Optional user identifier for multi-user support
     * @returns True if token is valid and not expired
     */
    isTokenValid(userId?: string): Promise<boolean>;
    /**
     * Force refresh the token
     * Only applicable for OAuth flows with refresh tokens
     *
     * @param userId - Optional user identifier for multi-user support
     * @returns New access token
     */
    refreshToken(userId?: string): Promise<string>;
    /**
     * Start OAuth authorization flow (OAuth connectors only)
     * Generates authorization URL for user to visit
     *
     * @param userId - User identifier for multi-user support
     * @returns Authorization URL for user to visit
     */
    startAuthFlow?(userId?: string): Promise<string>;
    /**
     * Handle OAuth callback (OAuth connectors only)
     * Exchanges authorization code for access token
     *
     * @param callbackUrl - Full callback URL with code and state
     * @param userId - Optional user identifier (can be extracted from state)
     */
    handleCallback?(callbackUrl: string, userId?: string): Promise<void>;
    /**
     * Revoke token (if supported by connector)
     *
     * @param revocationUrl - Optional revocation endpoint
     * @param userId - Optional user identifier
     */
    revokeToken?(revocationUrl?: string, userId?: string): Promise<void>;
    /**
     * Get connector metadata (rate limits, API version, etc.)
     */
    getMetadata?(): {
        apiVersion?: string;
        rateLimit?: {
            requestsPerMinute?: number;
            requestsPerDay?: number;
        };
        documentation?: string;
    };
}

/**
 * Connector Registry - Global singleton for managing external system connectors
 *
 * Connectors provide authenticated access to external APIs (GitHub, Microsoft, Salesforce, etc.)
 * This is DIFFERENT from Providers (OpenAI, Anthropic) which provide AI capabilities.
 *
 * Register connectors once, use everywhere with authenticatedFetch and tools
 */

/**
 * Connector registration config
 */
type ConnectorRegistrationConfig = ConnectorConfig;
/**
 * Connector Registry - manages all external system connectors
 */
declare class ConnectorRegistry {
    private static instance;
    private connectors;
    private constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): ConnectorRegistry;
    /**
     * Register a connector for external system access
     *
     * @param name - Unique connector identifier (e.g., 'microsoft', 'google', 'github')
     * @param config - Connector configuration
     *
     * @example
     * ```typescript
     * connectorRegistry.register('github', {
     *   displayName: 'GitHub API',
     *   description: 'Access GitHub repos and user data',
     *   baseURL: 'https://api.github.com',
     *   auth: {
     *     type: 'oauth',
     *     flow: 'authorization_code',
     *     clientId: process.env.GITHUB_CLIENT_ID!,
     *     clientSecret: process.env.GITHUB_CLIENT_SECRET,
     *     tokenUrl: 'https://github.com/login/oauth/access_token',
     *     authorizationUrl: 'https://github.com/login/oauth/authorize',
     *     scope: 'user:email repo'
     *   }
     * });
     * ```
     */
    register(name: string, config: ConnectorRegistrationConfig): void;
    /**
     * Get connector by name
     *
     * @throws Error if connector not found
     */
    get(name: string): IConnector;
    /**
     * Get OAuthManager for a connector (for internal use)
     * @internal
     */
    getManager(name: string): OAuthManager;
    /**
     * Check if connector exists
     */
    has(name: string): boolean;
    /**
     * Get all registered connector names
     */
    listConnectorNames(): string[];
    /**
     * Get all registered connectors
     */
    listConnectors(): IConnector[];
    /**
     * Get connector descriptions formatted for tool parameters
     */
    getConnectorDescriptionsForTools(): string;
    /**
     * Get connector info (for tools and documentation)
     */
    getConnectorInfo(): Record<string, {
        displayName: string;
        description: string;
        baseURL: string;
    }>;
    /**
     * Unregister a connector
     */
    unregister(name: string): boolean;
    /**
     * Clear all connectors (useful for testing)
     */
    clear(): void;
    /**
     * Get number of registered connectors
     */
    size(): number;
    /**
     * Create OAuthManager from ConnectorAuth format
     */
    private createOAuthManagerFromConnectorAuth;
}

/**
 * In-memory token storage (default)
 * Tokens are encrypted in memory using AES-256-GCM
 */

declare class MemoryStorage implements ITokenStorage {
    private tokens;
    storeToken(key: string, token: StoredToken): Promise<void>;
    getToken(key: string): Promise<StoredToken | null>;
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
    storeToken(key: string, token: StoredToken): Promise<void>;
    getToken(key: string): Promise<StoredToken | null>;
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
 * Generate a secure random encryption key
 * Use this to generate OAUTH_ENCRYPTION_KEY for your .env file
 */
declare function generateEncryptionKey(): string;

/**
 * Connectors - Authenticated access to external system APIs
 *
 * Provides unified interface for authentication across different systems:
 * - GitHub, Microsoft, Google, Salesforce, etc.
 *
 * Supports multiple authentication methods:
 * - OAuth 2.0 (Authorization Code + PKCE, Client Credentials, JWT Bearer)
 * - API Keys
 * - SAML (future)
 * - Kerberos (future)
 */

declare const connectorRegistry: ConnectorRegistry;

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
 * Create an execute_javascript tool with the current connector registry state
 * Use this factory when you need the tool to reflect currently registered connectors
 *
 * @param registry - ConnectorRegistry instance (defaults to global connectorRegistry)
 */
declare function createExecuteJavaScriptTool(registry?: ConnectorRegistry): ToolFunction<ExecuteJSArgs, ExecuteJSResult>;
/**
 * Default executeJavaScript tool (uses global connectorRegistry)
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

export { AIError, type APIKeyConnectorAuth, Agent, type AgentConfig, AgentResponse, AgenticLoopEvents, AuditEntry, BaseProvider, BaseTextProvider, type ClipboardImageResult, Connector, type ConnectorAuth, type ConnectorConfig, ConnectorRegistry, ExecutionContext, ExecutionMetrics, FileStorage, type FileStorageConfig, HistoryMode, HookConfig, type IAsyncDisposable, type IDisposable, IProvider, ITextProvider, type ITokenStorage, InputItem, InvalidConfigError, InvalidToolArgumentsError, type JWTConnectorAuth, LLMResponse, MemoryStorage, MessageBuilder, MessageRole, ModelCapabilities, ModelNotSupportedError, type OAuthConfig, type OAuthConnectorAuth, type OAuthFlow, OAuthManager, ProviderAuthError, ProviderCapabilities, ProviderContextLengthError, ProviderError, ProviderErrorMapper, ProviderNotFoundError, ProviderRateLimitError, StreamEvent, StreamEventType, StreamHelpers, StreamState, TextGenerateOptions, ToolCall, ToolExecutionError, ToolFunction, ToolNotFoundError, ToolTimeoutError, VENDORS, Vendor, assertNotDestroyed, authenticatedFetch, connectorRegistry, createAuthenticatedFetch, createExecuteJavaScriptTool, createMessageWithImages, createProvider, createTextMessage, generateEncryptionKey, hasClipboardImage, isVendor, readClipboardImage, index as tools };
