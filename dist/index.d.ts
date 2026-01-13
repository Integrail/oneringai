import { I as IDisposable, P as ProviderRegistry, a as InputItem, L as LLMResponse, b as ProvidersConfig, c as ProviderCapabilities, T as TokenUsage, d as ToolCall, S as StreamEvent, e as StreamEventType, M as MessageRole, f as ToolFunction } from './ProviderRegistry-_Vu3HZs_.js';
export { A as AgentResponse, a8 as AnthropicConfig, B as BuiltInTool, n as CompactionItem, g as Content, C as ContentType, H as ErrorEvent, F as FunctionToolDefinition, ae as GenericOpenAIConfig, a9 as GoogleConfig, ac as GrokConfig, ab as GroqConfig, a4 as IAsyncDisposable, $ as IImageProvider, X as IProvider, Y as ITextProvider, a1 as ImageEditOptions, a0 as ImageGenerateOptions, a3 as ImageResponse, a2 as ImageVariationOptions, i as InputImageContent, h as InputTextContent, E as IterationCompleteEvent, J as JSONSchema, l as Message, _ as ModelCapabilities, a7 as OpenAIConfig, m as OutputItem, O as OutputTextContent, u as OutputTextDeltaEvent, v as OutputTextDoneEvent, a6 as ProviderConfig, R as ReasoningItem, G as ResponseCompleteEvent, s as ResponseCreatedEvent, t as ResponseInProgressEvent, Z as TextGenerateOptions, ad as TogetherAIConfig, p as Tool, x as ToolCallArgumentsDeltaEvent, y as ToolCallArgumentsDoneEvent, w as ToolCallStartEvent, o as ToolCallState, r as ToolExecutionContext, D as ToolExecutionDoneEvent, z as ToolExecutionStartEvent, q as ToolResult, k as ToolResultContent, j as ToolUseContent, aa as VertexAIConfig, a5 as assertNotDestroyed, W as isErrorEvent, N as isOutputTextDelta, V as isResponseComplete, K as isStreamEvent, Q as isToolCallArgumentsDelta, U as isToolCallArgumentsDone } from './ProviderRegistry-_Vu3HZs_.js';
import { A as AgentManager } from './index-CoFvGwpY.js';
export { h as AfterToolContext, a as Agent, b as AgentConfig, d as AgenticLoopEventName, c as AgenticLoopEvents, k as ApprovalResult, i as ApproveToolContext, n as AuditEntry, B as BeforeToolContext, E as ExecutionContext, m as ExecutionMetrics, l as HistoryMode, g as Hook, e as HookConfig, H as HookManager, f as HookName, I as IToolExecutor, M as ModifyingHook, j as ToolModification, T as ToolRegistry } from './index-CoFvGwpY.js';
import { ImageManager } from './capabilities/images/index.js';
import 'eventemitter3';

/**
 * Common shared types
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
interface Logger {
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
}
interface RequestMetadata {
    requestId?: string;
    userId?: string;
    timestamp?: number;
    [key: string]: any;
}

/**
 * Text generation manager - simple text generation without tools
 *
 * Implements IDisposable for proper resource cleanup
 */

interface SimpleTextOptions {
    provider: string;
    model: string;
    instructions?: string;
    temperature?: number;
    max_output_tokens?: number;
    response_format?: {
        type: 'text' | 'json_object' | 'json_schema';
        json_schema?: any;
    };
}
declare class TextManager implements IDisposable {
    private registry;
    private _isDestroyed;
    get isDestroyed(): boolean;
    constructor(registry: ProviderRegistry);
    /**
     * Generate text response
     */
    generate(input: string | InputItem[], options: SimpleTextOptions): Promise<string>;
    /**
     * Generate structured JSON output
     */
    generateJSON<T = any>(input: string | InputItem[], options: SimpleTextOptions & {
        schema: any;
    }): Promise<T>;
    /**
     * Get full response object (not just text)
     */
    generateRaw(input: string | InputItem[], options: SimpleTextOptions): Promise<LLMResponse>;
    /**
     * Extract text from response
     */
    private extractTextFromResponse;
    /**
     * Destroy the manager and release resources
     * Safe to call multiple times (idempotent)
     */
    destroy(): void;
}

/**
 * Main client class - entry point for the library
 *
 * Implements IDisposable for proper resource cleanup
 */

interface OneRingAIConfig {
    providers: ProvidersConfig;
    defaultProvider?: string;
    logLevel?: LogLevel;
}
declare class OneRingAI implements IDisposable {
    private registry;
    private _agents?;
    private _text?;
    private _images?;
    private _isDestroyed;
    get isDestroyed(): boolean;
    constructor(config: OneRingAIConfig);
    /**
     * Access agent capability (with tool calling)
     */
    get agents(): AgentManager;
    /**
     * Access simple text generation capability
     */
    get text(): TextManager;
    /**
     * Access image generation capability
     */
    get images(): ImageManager;
    /**
     * List all configured providers
     */
    listProviders(): string[];
    /**
     * Get provider capabilities
     * Now async to support race-condition-free provider loading
     */
    getProviderCapabilities(providerName: string): Promise<ProviderCapabilities>;
    /**
     * Check if a provider is configured
     */
    hasProvider(providerName: string): boolean;
    /**
     * Destroy the client and release all resources
     * Safe to call multiple times (idempotent)
     */
    destroy(): void;
}

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
 * OAuth Provider Registry - Global singleton for managing OAuth providers
 * Register providers once, use everywhere with authenticated fetch and tools
 */

interface RegisteredProvider {
    name: string;
    displayName: string;
    description: string;
    baseURL: string;
    oauthManager: OAuthManager;
}
interface ProviderRegistrationConfig {
    displayName: string;
    description: string;
    baseURL: string;
    oauth: OAuthConfig | OAuthManager;
}
declare class OAuthRegistry {
    private static instance;
    private providers;
    private constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): OAuthRegistry;
    /**
     * Register an OAuth provider
     *
     * @param name - Unique provider identifier (e.g., 'microsoft', 'google')
     * @param config - Provider configuration
     */
    register(name: string, config: ProviderRegistrationConfig): void;
    /**
     * Get provider by name
     *
     * @throws Error if provider not found
     */
    get(name: string): RegisteredProvider;
    /**
     * Check if provider exists
     */
    has(name: string): boolean;
    /**
     * Get all registered provider names
     */
    listProviderNames(): string[];
    /**
     * Get all registered providers with full metadata
     */
    listProviders(): RegisteredProvider[];
    /**
     * Get provider descriptions formatted for tool parameters
     * Returns a string suitable for including in tool descriptions
     */
    getProviderDescriptionsForTools(): string;
    /**
     * Get provider names and descriptions as an object (for documentation)
     */
    getProviderInfo(): Record<string, {
        displayName: string;
        description: string;
        baseURL: string;
    }>;
    /**
     * Unregister a provider
     */
    unregister(name: string): boolean;
    /**
     * Clear all providers (useful for testing)
     */
    clear(): void;
    /**
     * Get number of registered providers
     */
    size(): number;
}
/**
 * Singleton instance - use this in your code
 */
declare const oauthRegistry: OAuthRegistry;

/**
 * JavaScript Execution Tool
 * Executes JavaScript in a sandboxed VM with OAuth integration
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
 * Create an execute_javascript tool with the current OAuth registry state
 * Use this factory when you need the tool to reflect currently registered providers
 */
declare function createExecuteJavaScriptTool(registry?: OAuthRegistry): ToolFunction<ExecuteJSArgs, ExecuteJSResult>;
/**
 * Default executeJavaScript tool (uses global oauthRegistry)
 * NOTE: The description is generated at module load time. If you register
 * providers after importing this, use createExecuteJavaScriptTool() instead.
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
 * OAuth Tool Generator - Auto-generate tools for registered OAuth providers
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
 * Generate a secure random encryption key
 * Use this to generate OAUTH_ENCRYPTION_KEY for your .env file
 */
declare function generateEncryptionKey(): string;

export { AIError, AgentManager, type ClipboardImageResult, IDisposable, type ITokenStorage as IOAuthTokenStorage, ImageManager, InputItem, InvalidConfigError, InvalidToolArgumentsError, LLMResponse, type LogLevel, type Logger, MessageBuilder, MessageRole, ModelNotSupportedError, type OAuthConfig, FileStorage as OAuthFileStorage, type FileStorageConfig as OAuthFileStorageConfig, type OAuthFlow, OAuthManager, MemoryStorage as OAuthMemoryStorage, OneRingAI, type OneRingAIConfig, ProviderAuthError, ProviderCapabilities, ProviderContextLengthError, ProviderError, ProviderNotFoundError, ProviderRateLimitError, ProvidersConfig, type RegisteredProvider, type RequestMetadata, type SimpleTextOptions, StreamEvent, StreamEventType, StreamHelpers, StreamState, TextManager, ToolCall, type ToolCallBuffer, ToolExecutionError, ToolFunction, ToolNotFoundError, ToolTimeoutError, authenticatedFetch, createAuthenticatedFetch, createExecuteJavaScriptTool, createMessageWithImages, createTextMessage, generateEncryptionKey, generateWebAPITool, hasClipboardImage, oauthRegistry, readClipboardImage, index as tools };
