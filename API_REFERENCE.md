# @oneringai/agents - API Reference

**Generated:** 2026-01-30
**Mode:** public

This document provides a complete reference for the public API of `@oneringai/agents`.

For usage examples and tutorials, see the [User Guide](./USER_GUIDE.md).

> **Note:** This documentation is auto-generated from source code. Items marked with `@internal` are excluded.

## Table of Contents

- [Core](#core) (20 items)
- [Text-to-Speech (TTS)](#text-to-speech-tts-) (9 items)
- [Speech-to-Text (STT)](#speech-to-text-stt-) (11 items)
- [Image Generation](#image-generation) (21 items)
- [Video Generation](#video-generation) (17 items)
- [Task Agents](#task-agents) (103 items)
- [Universal Agent](#universal-agent) (17 items)
- [Context Management](#context-management) (23 items)
- [Session Management](#session-management) (22 items)
- [Tools & Function Calling](#tools-function-calling) (72 items)
- [Streaming](#streaming) (15 items)
- [Model Registry](#model-registry) (9 items)
- [OAuth & External APIs](#oauth-external-apis) (10 items)
- [Resilience & Observability](#resilience-observability) (33 items)
- [Errors](#errors) (18 items)
- [Utilities](#utilities) (6 items)
- [Interfaces](#interfaces) (23 items)
- [Base Classes](#base-classes) (3 items)
- [Other](#other) (151 items)

## Core

Core classes for authentication, agents, and providers

### Agent `class`

📍 [`src/core/Agent.ts:84`](src/core/Agent.ts)

Agent class - represents an AI assistant with tool calling capabilities

Extends BaseAgent to inherit:
- Connector resolution
- Tool manager initialization
- Permission manager initialization
- Session management
- Lifecycle/cleanup

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
private constructor(config: AgentConfig)
```

**Parameters:**
- `config`: `AgentConfig`

</details>

<details>
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Create a new agent

```typescript
static create(config: AgentConfig): Agent
```

**Parameters:**
- `config`: `AgentConfig`

**Returns:** `Agent`

#### `static resume()`

Resume an agent from a saved session

```typescript
static async resume(
    sessionId: string,
    config: Omit&lt;AgentConfig, 'session'&gt; &
```

**Parameters:**
- `sessionId`: `string`
- `config`: `Omit&lt;AgentConfig, "session"&gt; & { session: { storage: ISessionStorage; }; }`

**Returns:** `Promise&lt;Agent&gt;`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `getAgentType()`

```typescript
protected getAgentType(): 'agent' | 'task-agent' | 'universal-agent'
```

**Returns:** `"agent" | "task-agent" | "universal-agent"`

#### `prepareSessionState()`

```typescript
protected prepareSessionState(): void
```

**Returns:** `void`

#### `hasContext()`

Check if context management is enabled.
Always returns true since AgentContext is always created by BaseAgent.

```typescript
hasContext(): boolean
```

**Returns:** `boolean`

#### `getContextState()`

Get context state for session persistence.

```typescript
async getContextState(): Promise&lt;SerializedAgentContextState&gt;
```

**Returns:** `Promise&lt;SerializedAgentContextState&gt;`

#### `restoreContextState()`

Restore context from saved state.

```typescript
async restoreContextState(state: SerializedAgentContextState): Promise&lt;void&gt;
```

**Parameters:**
- `state`: `SerializedAgentContextState`

**Returns:** `Promise&lt;void&gt;`

#### `run()`

Run the agent with input

```typescript
async run(input: string | InputItem[]): Promise&lt;AgentResponse&gt;
```

**Parameters:**
- `input`: `string | InputItem[]`

**Returns:** `Promise&lt;LLMResponse&gt;`

#### `stream()`

Stream response from the agent

```typescript
async *stream(input: string | InputItem[]): AsyncIterableIterator&lt;StreamEvent&gt;
```

**Parameters:**
- `input`: `string | InputItem[]`

**Returns:** `AsyncIterableIterator&lt;StreamEvent&gt;`

#### `approveToolForSession()`

Approve a tool for the current session.

```typescript
approveToolForSession(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `revokeToolApproval()`

Revoke a tool's session approval.

```typescript
revokeToolApproval(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `getApprovedTools()`

Get list of tools that have been approved for this session.

```typescript
getApprovedTools(): string[]
```

**Returns:** `string[]`

#### `toolNeedsApproval()`

Check if a tool needs approval before execution.

```typescript
toolNeedsApproval(toolName: string): boolean
```

**Parameters:**
- `toolName`: `string`

**Returns:** `boolean`

#### `toolIsBlocked()`

Check if a tool is blocked (cannot execute at all).

```typescript
toolIsBlocked(toolName: string): boolean
```

**Parameters:**
- `toolName`: `string`

**Returns:** `boolean`

#### `allowlistTool()`

Add a tool to the allowlist (always allowed, no approval needed).

```typescript
allowlistTool(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `blocklistTool()`

Add a tool to the blocklist (always blocked, cannot execute).

```typescript
blocklistTool(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `setModel()`

Change the model

```typescript
setModel(model: string): void
```

**Parameters:**
- `model`: `string`

**Returns:** `void`

#### `getTemperature()`

Get current temperature

```typescript
getTemperature(): number | undefined
```

**Returns:** `number | undefined`

#### `setTemperature()`

Change the temperature

```typescript
setTemperature(temperature: number): void
```

**Parameters:**
- `temperature`: `number`

**Returns:** `void`

#### `pause()`

```typescript
pause(reason?: string): void
```

**Parameters:**
- `reason`: `string | undefined` *(optional)*

**Returns:** `void`

#### `resume()`

```typescript
resume(): void
```

**Returns:** `void`

#### `cancel()`

```typescript
cancel(reason?: string): void
```

**Parameters:**
- `reason`: `string | undefined` *(optional)*

**Returns:** `void`

#### `getContext()`

```typescript
getContext(): ExecutionContext | null
```

**Returns:** `ExecutionContext | null`

#### `getMetrics()`

```typescript
getMetrics()
```

**Returns:** `ExecutionMetrics | null`

#### `getSummary()`

```typescript
getSummary()
```

**Returns:** `{ executionId: string; startTime: Date; currentIteration: number; paused: boolean; cancelled: boolean; metrics: { totalDuration: number; llmDuration: number; toolDuration: number; hookDuration: number; iterationCount: number; toolCallCount: number; toolSuccessCount: number; toolFailureCount: number; toolTimeoutCount: number; inputTokens: number; outputTokens: number; totalTokens: number; errors: { type: string; message: string; timestamp: Date; }[]; }; totalDuration: number; } | null`

#### `getAuditTrail()`

```typescript
getAuditTrail()
```

**Returns:** `readonly AuditEntry[]`

#### `getProviderCircuitBreakerMetrics()`

Get circuit breaker metrics for LLM provider

```typescript
getProviderCircuitBreakerMetrics()
```

**Returns:** `any`

#### `getToolCircuitBreakerStates()`

Get circuit breaker states for all tools

```typescript
getToolCircuitBreakerStates()
```

**Returns:** `Map&lt;string, CircuitState&gt;`

#### `getToolCircuitBreakerMetrics()`

Get circuit breaker metrics for a specific tool

```typescript
getToolCircuitBreakerMetrics(toolName: string)
```

**Parameters:**
- `toolName`: `string`

**Returns:** `CircuitBreakerMetrics | undefined`

#### `resetToolCircuitBreaker()`

Manually reset a tool's circuit breaker

```typescript
resetToolCircuitBreaker(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `isRunning()`

```typescript
isRunning(): boolean
```

**Returns:** `boolean`

#### `isPaused()`

```typescript
isPaused(): boolean
```

**Returns:** `boolean`

#### `isCancelled()`

```typescript
isCancelled(): boolean
```

**Returns:** `boolean`

#### `destroy()`

```typescript
destroy(): void
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `provider` | `provider: ITextProvider` | - |
| `agenticLoop` | `agenticLoop: AgenticLoop` | - |
| `boundListeners` | `boundListeners: Map&lt;keyof AgenticLoopEvents, (...args: any[]) =&gt; void&gt;` | - |

</details>

---

### AgentContext `class`

📍 [`src/core/AgentContext.ts:404`](src/core/AgentContext.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
private constructor(config: AgentContextConfig =
```

**Parameters:**
- `config`: `AgentContextConfig` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Create a new AgentContext

```typescript
static create(config: AgentContextConfig =
```

**Parameters:**
- `config`: `AgentContextConfig` *(optional)* (default: `{}`)

**Returns:** `AgentContext`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `isFeatureEnabled()`

Check if a specific feature is enabled

```typescript
isFeatureEnabled(feature: keyof AgentContextFeatures): boolean
```

**Parameters:**
- `feature`: `keyof AgentContextFeatures`

**Returns:** `boolean`

#### `requireMemory()`

Get memory, throwing if disabled
Use when memory is required for an operation

```typescript
requireMemory(): WorkingMemory
```

**Returns:** `WorkingMemory`

#### `requireCache()`

Get cache, throwing if disabled
Use when cache is required for an operation

```typescript
requireCache(): IdempotencyCache
```

**Returns:** `IdempotencyCache`

#### `requirePermissions()`

Get permissions, throwing if disabled
Use when permissions is required for an operation

```typescript
requirePermissions(): ToolPermissionManager
```

**Returns:** `ToolPermissionManager`

#### `setCurrentInput()`

Set current input for this turn

```typescript
setCurrentInput(input: string): void
```

**Parameters:**
- `input`: `string`

**Returns:** `void`

#### `getCurrentInput()`

Get current input

```typescript
getCurrentInput(): string
```

**Returns:** `string`

#### `setTaskType()`

Set explicit task type (overrides auto-detection)

```typescript
setTaskType(type: TaskType): void
```

**Parameters:**
- `type`: `TaskType`

**Returns:** `void`

#### `clearTaskType()`

Clear explicit task type (re-enables auto-detection)

```typescript
clearTaskType(): void
```

**Returns:** `void`

#### `getTaskType()`

Get current task type
Priority: explicit > auto-detected > 'general'

```typescript
getTaskType(): TaskType
```

**Returns:** `TaskType`

#### `getTaskTypePrompt()`

Get task-type-specific system prompt addition

```typescript
getTaskTypePrompt(): string
```

**Returns:** `string`

#### `addMessage()`

Add a message to history with automatic capacity management.

This async version checks if adding the message would exceed context budget
and triggers compaction BEFORE adding if needed. Use this for large content
like tool outputs.

```typescript
async addMessage(
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string,
    metadata?: Record&lt;string, unknown&gt;
  ): Promise&lt;HistoryMessage | null&gt;
```

**Parameters:**
- `role`: `"user" | "assistant" | "system" | "tool"`
- `content`: `string`
- `metadata`: `Record&lt;string, unknown&gt; | undefined` *(optional)*

**Returns:** `Promise&lt;HistoryMessage | null&gt;`

#### `addMessageSync()`

Add a message to history synchronously (without capacity checking).

Use this when you need synchronous behavior or for small messages where
capacity checking overhead is not worth it. For large content (tool outputs,
fetched documents), prefer the async `addMessage()` instead.

```typescript
addMessageSync(
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string,
    metadata?: Record&lt;string, unknown&gt;
  ): HistoryMessage | null
```

**Parameters:**
- `role`: `"user" | "assistant" | "system" | "tool"`
- `content`: `string`
- `metadata`: `Record&lt;string, unknown&gt; | undefined` *(optional)*

**Returns:** `HistoryMessage | null`

#### `addToolResult()`

Add a tool result to context with automatic capacity management.

This is a convenience method for adding tool outputs. It:
- Stringifies non-string results
- Checks capacity and triggers compaction if needed
- Adds as a 'tool' role message

Use this for large tool outputs like web_fetch results, file contents, etc.

```typescript
async addToolResult(
    result: unknown,
    metadata?: Record&lt;string, unknown&gt;
  ): Promise&lt;HistoryMessage | null&gt;
```

**Parameters:**
- `result`: `unknown`
- `metadata`: `Record&lt;string, unknown&gt; | undefined` *(optional)*

**Returns:** `Promise&lt;HistoryMessage | null&gt;`

#### `getHistory()`

Get all history messages

```typescript
getHistory(): HistoryMessage[]
```

**Returns:** `HistoryMessage[]`

#### `getRecentHistory()`

Get recent N messages

```typescript
getRecentHistory(count: number): HistoryMessage[]
```

**Parameters:**
- `count`: `number`

**Returns:** `HistoryMessage[]`

#### `getMessageCount()`

Get message count

```typescript
getMessageCount(): number
```

**Returns:** `number`

#### `clearHistory()`

Clear history

```typescript
clearHistory(reason?: string): void
```

**Parameters:**
- `reason`: `string | undefined` *(optional)*

**Returns:** `void`

#### `getToolCalls()`

Get all tool call records

```typescript
getToolCalls(): ToolCallRecord[]
```

**Returns:** `ToolCallRecord[]`

#### `executeTool()`

Execute a tool with automatic caching

This is the recommended way to execute tools - it integrates:
- Permission checking
- Result caching (if tool is cacheable and memory feature enabled)
- History recording
- Metrics tracking

```typescript
async executeTool(
    toolName: string,
    args: Record&lt;string, unknown&gt;,
    context?: Partial&lt;ToolContext&gt;
  ): Promise&lt;unknown&gt;
```

**Parameters:**
- `toolName`: `string`
- `args`: `Record&lt;string, unknown&gt;`
- `context`: `Partial&lt;ToolContext&gt; | undefined` *(optional)*

**Returns:** `Promise&lt;unknown&gt;`

#### `registerPlugin()`

Register a context plugin

```typescript
registerPlugin(plugin: IContextPlugin): void
```

**Parameters:**
- `plugin`: `IContextPlugin`

**Returns:** `void`

#### `unregisterPlugin()`

Unregister a plugin

```typescript
unregisterPlugin(name: string): boolean
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

#### `getPlugin()`

Get a plugin by name

```typescript
getPlugin&lt;T extends IContextPlugin&gt;(name: string): T | undefined
```

**Parameters:**
- `name`: `string`

**Returns:** `T | undefined`

#### `listPlugins()`

List all registered plugins

```typescript
listPlugins(): string[]
```

**Returns:** `string[]`

#### `prepare()`

Prepare context for LLM call

Assembles all components:
- System prompt, instructions
- Conversation history
- Memory index
- Plugin components
- Current input

Handles compaction automatically if budget is exceeded.

```typescript
async prepare(): Promise&lt;PreparedContext&gt;
```

**Returns:** `Promise&lt;PreparedContext&gt;`

#### `getBudget()`

Get current budget without full preparation

```typescript
async getBudget(): Promise&lt;ContextBudget&gt;
```

**Returns:** `Promise&lt;ContextBudget&gt;`

#### `compact()`

Force compaction

```typescript
async compact(): Promise&lt;PreparedContext&gt;
```

**Returns:** `Promise&lt;PreparedContext&gt;`

#### `setStrategy()`

Set compaction strategy

```typescript
setStrategy(strategy: 'proactive' | 'aggressive' | 'lazy' | 'rolling-window' | 'adaptive'): void
```

**Parameters:**
- `strategy`: `"proactive" | "aggressive" | "lazy" | "rolling-window" | "adaptive"`

**Returns:** `void`

#### `getMaxContextTokens()`

Get max context tokens

```typescript
getMaxContextTokens(): number
```

**Returns:** `number`

#### `setMaxContextTokens()`

Set max context tokens

```typescript
setMaxContextTokens(tokens: number): void
```

**Parameters:**
- `tokens`: `number`

**Returns:** `void`

#### `setCacheEnabled()`

Enable/disable caching

```typescript
setCacheEnabled(enabled: boolean): void
```

**Parameters:**
- `enabled`: `boolean`

**Returns:** `void`

#### `isCacheEnabled()`

Check if caching is enabled

```typescript
isCacheEnabled(): boolean
```

**Returns:** `boolean`

#### `estimateTokens()`

Estimate tokens for content

```typescript
estimateTokens(content: string, type?: TokenContentType): number
```

**Parameters:**
- `content`: `string`
- `type`: `TokenContentType | undefined` *(optional)*

**Returns:** `number`

#### `getUtilization()`

Get utilization percentage

```typescript
getUtilization(): number
```

**Returns:** `number`

#### `getLastBudget()`

Get last calculated budget

```typescript
getLastBudget(): ContextBudget | null
```

**Returns:** `ContextBudget | null`

#### `ensureCapacity()`

Ensure there's enough capacity for new content.
If adding the estimated tokens would exceed budget, triggers compaction first.

This method enables proactive compaction BEFORE content is added, preventing
context overflow. It uses the configured strategy to determine when to compact.

```typescript
async ensureCapacity(estimatedTokens: number): Promise&lt;boolean&gt;
```

**Parameters:**
- `estimatedTokens`: `number`

**Returns:** `Promise&lt;boolean&gt;`

#### `getMetrics()`

Get comprehensive metrics

```typescript
async getMetrics(): Promise&lt;AgentContextMetrics&gt;
```

**Returns:** `Promise&lt;AgentContextMetrics&gt;`

#### `getState()`

Get state for session persistence

Serializes ALL state:
- History and tool calls
- Tool enable/disable state
- Memory state (if enabled)
- Permission state (if enabled)
- Plugin state
- Feature configuration

```typescript
async getState(): Promise&lt;SerializedAgentContextState&gt;
```

**Returns:** `Promise&lt;SerializedAgentContextState&gt;`

#### `restoreState()`

Restore from saved state

Restores ALL state from a previous session.

```typescript
async restoreState(state: SerializedAgentContextState): Promise&lt;void&gt;
```

**Parameters:**
- `state`: `SerializedAgentContextState`

**Returns:** `Promise&lt;void&gt;`

#### `destroy()`

Destroy the context and release resources

```typescript
destroy(): void
```

**Returns:** `void`

</details>

---

### Connector `class`

📍 [`src/core/Connector.ts:49`](src/core/Connector.ts)

Connector class - represents a single authenticated connection

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
private constructor(config: ConnectorConfig &
```

**Parameters:**
- `config`: `ConnectorConfig & { name: string; }`

</details>

<details>
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Create and register a new connector

```typescript
static create(config: ConnectorConfig &
```

**Parameters:**
- `config`: `ConnectorConfig & { name: string; }`

**Returns:** `Connector`

#### `static get()`

Get a connector by name

```typescript
static get(name: string): Connector
```

**Parameters:**
- `name`: `string`

**Returns:** `Connector`

#### `static has()`

Check if a connector exists

```typescript
static has(name: string): boolean
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

#### `static list()`

List all registered connector names

```typescript
static list(): string[]
```

**Returns:** `string[]`

#### `static remove()`

Remove a connector

```typescript
static remove(name: string): boolean
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

#### `static clear()`

Clear all connectors (useful for testing)

```typescript
static clear(): void
```

**Returns:** `void`

#### `static setDefaultStorage()`

Set default token storage for OAuth connectors

```typescript
static setDefaultStorage(storage: ITokenStorage): void
```

**Parameters:**
- `storage`: `ITokenStorage`

**Returns:** `void`

#### `static listAll()`

Get all registered connectors

```typescript
static listAll(): Connector[]
```

**Returns:** `Connector[]`

#### `static size()`

Get number of registered connectors

```typescript
static size(): number
```

**Returns:** `number`

#### `static getDescriptionsForTools()`

Get connector descriptions formatted for tool parameters
Useful for generating dynamic tool descriptions

```typescript
static getDescriptionsForTools(): string
```

**Returns:** `string`

#### `static getInfo()`

Get connector info (for tools and documentation)

```typescript
static getInfo(): Record&lt;string,
```

**Returns:** `Record&lt;string, { displayName: string; description: string; baseURL: string; }&gt;`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `getApiKey()`

Get the API key (for api_key auth type)

```typescript
getApiKey(): string
```

**Returns:** `string`

#### `getToken()`

Get the current access token (for OAuth, JWT, or API key)
Handles automatic refresh if needed

```typescript
async getToken(userId?: string): Promise&lt;string&gt;
```

**Parameters:**
- `userId`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;string&gt;`

#### `startAuth()`

Start OAuth authorization flow
Returns the URL to redirect the user to

```typescript
async startAuth(userId?: string): Promise&lt;string&gt;
```

**Parameters:**
- `userId`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;string&gt;`

#### `handleCallback()`

Handle OAuth callback
Call this after user is redirected back from OAuth provider

```typescript
async handleCallback(callbackUrl: string, userId?: string): Promise&lt;void&gt;
```

**Parameters:**
- `callbackUrl`: `string`
- `userId`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `hasValidToken()`

Check if the connector has a valid token

```typescript
async hasValidToken(userId?: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `userId`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;boolean&gt;`

#### `getOptions()`

Get vendor-specific options from config

```typescript
getOptions(): Record&lt;string, unknown&gt;
```

**Returns:** `Record&lt;string, unknown&gt;`

#### `getMetrics()`

Get connector metrics

```typescript
getMetrics():
```

**Returns:** `{ requestCount: number; successCount: number; failureCount: number; avgLatencyMs: number; circuitBreakerState?: string | undefined; }`

#### `resetCircuitBreaker()`

Reset circuit breaker (force close)

```typescript
resetCircuitBreaker(): void
```

**Returns:** `void`

#### `fetch()`

Make an authenticated fetch request using this connector
This is the foundation for all vendor-dependent tools

Features:
- Timeout with AbortController
- Circuit breaker protection
- Retry with exponential backoff
- Request/response logging

```typescript
async fetch(
    endpoint: string,
    options?: ConnectorFetchOptions,
    userId?: string
  ): Promise&lt;Response&gt;
```

**Parameters:**
- `endpoint`: `string`
- `options`: `ConnectorFetchOptions | undefined` *(optional)*
- `userId`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;Response&gt;`

#### `fetchJSON()`

Make an authenticated fetch request and parse JSON response
Throws on non-OK responses

```typescript
async fetchJSON&lt;T = unknown&gt;(
    endpoint: string,
    options?: ConnectorFetchOptions,
    userId?: string
  ): Promise&lt;T&gt;
```

**Parameters:**
- `endpoint`: `string`
- `options`: `ConnectorFetchOptions | undefined` *(optional)*
- `userId`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;T&gt;`

#### `dispose()`

Dispose of resources

```typescript
dispose(): void
```

**Returns:** `void`

#### `isDisposed()`

Check if connector is disposed

```typescript
isDisposed(): boolean
```

**Returns:** `boolean`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `registry` | `registry: Map&lt;string, Connector&gt;` | - |
| `defaultStorage` | `defaultStorage: ITokenStorage` | - |
| `name` | `name: string` | - |
| `vendor?` | `vendor: Vendor | undefined` | - |
| `config` | `config: ConnectorConfig` | - |
| `oauthManager?` | `oauthManager: OAuthManager | undefined` | - |
| `circuitBreaker?` | `circuitBreaker: CircuitBreaker&lt;any&gt; | undefined` | - |
| `disposed` | `disposed: boolean` | - |
| `requestCount` | `requestCount: number` | - |
| `successCount` | `successCount: number` | - |
| `failureCount` | `failureCount: number` | - |
| `totalLatencyMs` | `totalLatencyMs: number` | - |

</details>

---

### AgentConfig `interface`

📍 [`src/core/Agent.ts:33`](src/core/Agent.ts)

Agent configuration - extends BaseAgentConfig with Agent-specific options

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `instructions?` | `instructions?: string;` | System instructions for the agent |
| `temperature?` | `temperature?: number;` | Temperature for generation |
| `maxIterations?` | `maxIterations?: number;` | Maximum iterations for tool calling loop |
| `vendorOptions?` | `vendorOptions?: Record&lt;string, any&gt;;` | Vendor-specific options (e.g., Google's thinkingLevel: 'low' | 'high') |
| `context?` | `context?: AgentContext | AgentContextConfig;` | Optional unified context management.
When provided (as AgentContext instance or config), Agent will:
- Track conversation history
- Cache tool results (if enabled)
- Provide unified memory access
- Support session persistence via context

Pass an AgentContext instance or AgentContextConfig to enable. |
| `hooks?` | `hooks?: HookConfig;` | - |
| `historyMode?` | `historyMode?: HistoryMode;` | - |
| `limits?` | `limits?: {
    maxExecutionTime?: number;
    maxToolCalls?: number;
    maxContextSize?: number;
    maxInputMessages?: number;
  };` | - |
| `errorHandling?` | `errorHandling?: {
    hookFailureMode?: 'fail' | 'warn' | 'ignore';
    toolFailureMode?: 'fail' | 'continue';
    maxConsecutiveErrors?: number;
  };` | - |

</details>

---

### AgentContextConfig `interface`

📍 [`src/core/AgentContext.ts:245`](src/core/AgentContext.ts)

AgentContext configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `model?` | `model?: string;` | Model name (used for token limits) |
| `maxContextTokens?` | `maxContextTokens?: number;` | Max context tokens (overrides model default) |
| `systemPrompt?` | `systemPrompt?: string;` | System prompt |
| `instructions?` | `instructions?: string;` | Instructions |
| `tools?` | `tools?: ToolFunction[];` | Tools to register |
| `features?` | `features?: AgentContextFeatures;` | Feature configuration - enable/disable AgentContext features independently
Each feature controls component creation and tool registration |
| `permissions?` | `permissions?: AgentPermissionsConfig;` | Tool permissions configuration |
| `memory?` | `memory?: Partial&lt;WorkingMemoryConfig&gt; & {
    /** Custom storage backend (default: InMemoryStorage) */
    storage?: IMemoryStorage;
  };` | Memory configuration |
| `cache?` | `cache?: Partial&lt;IdempotencyCacheConfig&gt; & {
    /** Enable caching (default: true) */
    enabled?: boolean;
  };` | Cache configuration |
| `inContextMemory?` | `inContextMemory?: InContextMemoryPluginConfig;` | InContextMemory configuration (only used if features.inContextMemory is true) |
| `history?` | `history?: {
    /** Max messages before compaction */
    maxMessages?: number;
    /** Messages to preserve during compaction */
    preserveRecent?: number;
  };` | History configuration |
| `strategy?` | `strategy?: 'proactive' | 'aggressive' | 'lazy' | 'rolling-window' | 'adaptive';` | Compaction strategy |
| `responseReserve?` | `responseReserve?: number;` | Response token reserve (0.0 - 1.0) |
| `autoCompact?` | `autoCompact?: boolean;` | Enable auto-compaction |
| `taskType?` | `taskType?: TaskType;` | Task type for priority profiles (default: auto-detect from plan) |
| `autoDetectTaskType?` | `autoDetectTaskType?: boolean;` | Auto-detect task type from plan (default: true) |

</details>

---

### AgentContextEvents `interface`

📍 [`src/core/AgentContext.ts:375`](src/core/AgentContext.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'message:added'` | `'message:added': { message: HistoryMessage };` | - |
| `'history:cleared'` | `'history:cleared': { reason?: string };` | - |
| `'history:compacted'` | `'history:compacted': { removedCount: number };` | - |
| `'tool:registered'` | `'tool:registered': { name: string };` | - |
| `'tool:executed'` | `'tool:executed': { record: ToolCallRecord };` | - |
| `'tool:cached'` | `'tool:cached': { name: string; args: Record&lt;string, unknown&gt; };` | - |
| `'context:preparing'` | `'context:preparing': { componentCount: number };` | - |
| `'context:prepared'` | `'context:prepared': { budget: ContextBudget; compacted: boolean };` | - |
| `'compacted'` | `'compacted': { log: string[]; tokensFreed: number };` | - |
| `'budget:warning'` | `'budget:warning': { budget: ContextBudget };` | - |
| `'budget:critical'` | `'budget:critical': { budget: ContextBudget };` | - |
| `'plugin:registered'` | `'plugin:registered': { name: string };` | - |
| `'plugin:unregistered'` | `'plugin:unregistered': { name: string };` | - |

</details>

---

### AgentContextFeatures `interface`

📍 [`src/core/AgentContext.ts:167`](src/core/AgentContext.ts)

AgentContext feature configuration - controls which features are enabled

Each feature can be enabled/disabled independently. When a feature is disabled:
- Its components are not created (saves memory)
- Its tools are not registered (cleaner LLM tool list)
- Related context preparation is skipped

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `memory?` | `memory?: boolean;` | Enable WorkingMemory + IdempotencyCache
When enabled: memory storage, tool result caching, memory_* tools, cache_stats tool
When disabled: no memory/cache, tools not registered |
| `inContextMemory?` | `inContextMemory?: boolean;` | Enable InContextMemoryPlugin for in-context key-value storage
When enabled: context_set/get/delete/list tools |
| `history?` | `history?: boolean;` | Enable conversation history tracking
When disabled: addMessage() is no-op, history not in context |
| `permissions?` | `permissions?: boolean;` | Enable ToolPermissionManager for approval workflow
When disabled: all tools auto-approved |

</details>

---

### AgentContextMetrics `interface`

📍 [`src/core/AgentContext.ts:358`](src/core/AgentContext.ts)

Context metrics

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `historyMessageCount` | `historyMessageCount: number;` | - |
| `toolCallCount` | `toolCallCount: number;` | - |
| `cacheStats` | `cacheStats: CacheStats;` | - |
| `memoryStats` | `memoryStats: {
    totalEntries: number;
    totalSizeBytes: number;
    utilizationPercent: number;
  };` | - |
| `pluginCount` | `pluginCount: number;` | - |
| `utilizationPercent` | `utilizationPercent: number;` | - |

</details>

---

### ConnectorFetchOptions `interface`

📍 [`src/core/Connector.ts:37`](src/core/Connector.ts)

Fetch options with additional connector-specific settings

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `timeout?` | `timeout?: number;` | Override timeout for this request |
| `skipRetry?` | `skipRetry?: boolean;` | Skip retry for this request |
| `skipCircuitBreaker?` | `skipCircuitBreaker?: boolean;` | Skip circuit breaker for this request |

</details>

---

### HistoryMessage `interface`

📍 [`src/core/AgentContext.ts:220`](src/core/AgentContext.ts)

History message

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | - |
| `role` | `role: 'user' | 'assistant' | 'system' | 'tool';` | - |
| `content` | `content: string;` | - |
| `timestamp` | `timestamp: number;` | - |
| `metadata?` | `metadata?: Record&lt;string, unknown&gt;;` | - |

</details>

---

### SerializedAgentContextState `interface`

📍 [`src/core/AgentContext.ts:331`](src/core/AgentContext.ts)

Serialized state for session persistence

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `version` | `version: number;` | - |
| `core` | `core: {
    systemPrompt: string;
    instructions: string;
    history: HistoryMessage[];
    toolCalls: ToolCallRecord[];
  };` | - |
| `tools` | `tools: SerializedToolState;` | - |
| `memoryStats?` | `memoryStats?: {
    entryCount: number;
    sizeBytes: number;
  };` | - |
| `permissions` | `permissions: SerializedApprovalState;` | - |
| `plugins` | `plugins: Record&lt;string, unknown&gt;;` | - |
| `config` | `config: {
    model: string;
    maxContextTokens: number;
    strategy: string;
  };` | - |

</details>

---

### ToolCallRecord `interface`

📍 [`src/core/AgentContext.ts:231`](src/core/AgentContext.ts)

Tool call record (stored in history)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | - |
| `name` | `name: string;` | - |
| `args` | `args: Record&lt;string, unknown&gt;;` | - |
| `result?` | `result?: unknown;` | - |
| `error?` | `error?: string;` | - |
| `durationMs?` | `durationMs?: number;` | - |
| `cached?` | `cached?: boolean;` | - |
| `timestamp` | `timestamp: number;` | - |

</details>

---

### AgentSessionConfig `type`

📍 [`src/core/Agent.ts:28`](src/core/Agent.ts)

Session configuration for Agent (same as BaseSessionConfig)

```typescript
type AgentSessionConfig = BaseSessionConfig
```

---

### Vendor `type`

📍 [`src/core/Vendor.ts:22`](src/core/Vendor.ts)

```typescript
type Vendor = (typeof Vendor)[keyof typeof Vendor]
```

---

### createProvider `function`

📍 [`src/core/createProvider.ts:23`](src/core/createProvider.ts)

Create a text provider from a connector

```typescript
export function createProvider(connector: Connector): ITextProvider
```

---

### getAgentContextTools `function` ⚠️ DEPRECATED

📍 [`src/core/AgentContextTools.ts:55`](src/core/AgentContextTools.ts)

> **Deprecated:** Tools are now auto-registered by AgentContext constructor. You no longer need to call this function manually. All agent types (Agent, TaskAgent, UniversalAgent) automatically get the correct tools based on enabled features.

Get tools based on enabled features in AgentContext

```typescript
export function getAgentContextTools(context: AgentContext): ToolFunction[]
```

**Migration:**

```typescript
// OLD (no longer needed):
const ctx = AgentContext.create({ model: 'gpt-4' });
const tools = getAgentContextTools(ctx);
for (const tool of tools) {
  ctx.tools.register(tool);
}

// NEW (tools auto-registered):
const ctx = AgentContext.create({ model: 'gpt-4' });
// Tools are already registered! Just use them:
console.log(ctx.tools.has('memory_store')); // true
```

---

### getBasicIntrospectionTools `function`

📍 [`src/core/AgentContextTools.ts:88`](src/core/AgentContextTools.ts)

Get only the basic introspection tools (always available)

```typescript
export function getBasicIntrospectionTools(): ToolFunction[]
```

---

### getMemoryTools `function`

📍 [`src/core/AgentContextTools.ts:95`](src/core/AgentContextTools.ts)

Get only memory-related tools (requires memory feature)

```typescript
export function getMemoryTools(): ToolFunction[]
```

---

### isVendor `function`

📍 [`src/core/Vendor.ts:32`](src/core/Vendor.ts)

Check if a string is a valid vendor

```typescript
export function isVendor(value: string): value is Vendor
```

---

### DEFAULT_FEATURES `const`

📍 [`src/core/AgentContext.ts:206`](src/core/AgentContext.ts)

Default feature configuration

- memory: true (includes WorkingMemory + IdempotencyCache)
- inContextMemory: false (opt-in)
- history: true
- permissions: true

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `memory` | `true` | - |
| `inContextMemory` | `false` | - |
| `history` | `true` | - |
| `permissions` | `true` | - |

</details>

---

## Text-to-Speech (TTS)

Convert text to spoken audio

### TextToSpeech `class`

📍 [`src/core/TextToSpeech.ts:49`](src/core/TextToSpeech.ts)

TextToSpeech capability class
Provides text-to-speech synthesis with model introspection

**Example:**

```typescript
const tts = TextToSpeech.create({
  connector: 'openai',
  model: 'tts-1-hd',
  voice: 'nova',
});

const audio = await tts.synthesize('Hello, world!');
await tts.toFile('Hello', './output.mp3');
```

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
private constructor(config: TextToSpeechConfig)
```

**Parameters:**
- `config`: `TextToSpeechConfig`

</details>

<details>
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Create a new TextToSpeech instance

```typescript
static create(config: TextToSpeechConfig): TextToSpeech
```

**Parameters:**
- `config`: `TextToSpeechConfig`

**Returns:** `TextToSpeech`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `synthesize()`

Synthesize speech from text

```typescript
async synthesize(
    text: string,
    options?: Partial&lt;Omit&lt;TTSOptions, 'model' | 'input'&gt;&gt;
  ): Promise&lt;TTSResponse&gt;
```

**Parameters:**
- `text`: `string`
- `options`: `Partial&lt;Omit&lt;TTSOptions, "model" | "input"&gt;&gt; | undefined` *(optional)*

**Returns:** `Promise&lt;TTSResponse&gt;`

#### `toFile()`

Synthesize speech and save to file

```typescript
async toFile(
    text: string,
    filePath: string,
    options?: Partial&lt;Omit&lt;TTSOptions, 'model' | 'input'&gt;&gt;
  ): Promise&lt;void&gt;
```

**Parameters:**
- `text`: `string`
- `filePath`: `string`
- `options`: `Partial&lt;Omit&lt;TTSOptions, "model" | "input"&gt;&gt; | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `getModelInfo()`

Get model information for current or specified model

```typescript
getModelInfo(model?: string): ITTSModelDescription
```

**Parameters:**
- `model`: `string | undefined` *(optional)*

**Returns:** `ITTSModelDescription`

#### `getModelCapabilities()`

Get model capabilities

```typescript
getModelCapabilities(model?: string)
```

**Parameters:**
- `model`: `string | undefined` *(optional)*

**Returns:** `TTSModelCapabilities`

#### `listVoices()`

List all available voices for current model
For dynamic voice providers (e.g., ElevenLabs), fetches from API
For static providers (e.g., OpenAI), returns from registry

```typescript
async listVoices(model?: string): Promise&lt;IVoiceInfo[]&gt;
```

**Parameters:**
- `model`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;IVoiceInfo[]&gt;`

#### `listAvailableModels()`

List all available models for this provider's vendor

```typescript
listAvailableModels(): ITTSModelDescription[]
```

**Returns:** `ITTSModelDescription[]`

#### `supportsFeature()`

Check if a specific feature is supported by the model

```typescript
supportsFeature(
    feature: keyof ITTSModelDescription['capabilities']['features'],
    model?: string
  ): boolean
```

**Parameters:**
- `feature`: `"streaming" | "ssml" | "emotions" | "voiceCloning" | "wordTimestamps" | "instructionSteering"`
- `model`: `string | undefined` *(optional)*

**Returns:** `boolean`

#### `getSupportedFormats()`

Get supported audio formats for the model

```typescript
getSupportedFormats(model?: string): readonly AudioFormat[] | AudioFormat[]
```

**Parameters:**
- `model`: `string | undefined` *(optional)*

**Returns:** `readonly AudioFormat[] | AudioFormat[]`

#### `getSupportedLanguages()`

Get supported languages for the model

```typescript
getSupportedLanguages(model?: string): readonly string[] | string[]
```

**Parameters:**
- `model`: `string | undefined` *(optional)*

**Returns:** `string[] | readonly string[]`

#### `supportsSpeedControl()`

Check if speed control is supported

```typescript
supportsSpeedControl(model?: string): boolean
```

**Parameters:**
- `model`: `string | undefined` *(optional)*

**Returns:** `boolean`

#### `setModel()`

Update default model

```typescript
setModel(model: string): void
```

**Parameters:**
- `model`: `string`

**Returns:** `void`

#### `setVoice()`

Update default voice

```typescript
setVoice(voice: string): void
```

**Parameters:**
- `voice`: `string`

**Returns:** `void`

#### `setFormat()`

Update default format

```typescript
setFormat(format: AudioFormat): void
```

**Parameters:**
- `format`: `AudioFormat`

**Returns:** `void`

#### `setSpeed()`

Update default speed

```typescript
setSpeed(speed: number): void
```

**Parameters:**
- `speed`: `number`

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `provider` | `provider: ITextToSpeechProvider` | - |
| `config` | `config: TextToSpeechConfig` | - |

</details>

---

### ITTSModelDescription `interface`

📍 [`src/domain/entities/TTSModel.ts:78`](src/domain/entities/TTSModel.ts)

Complete TTS model description

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `capabilities` | `capabilities: TTSModelCapabilities;` | - |
| `pricing?` | `pricing?: TTSModelPricing;` | - |

</details>

---

### TextToSpeechConfig `interface`

📍 [`src/core/TextToSpeech.ts:16`](src/core/TextToSpeech.ts)

Configuration for TextToSpeech capability

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `connector` | `connector: string | Connector;` | Connector name or instance |
| `model?` | `model?: string;` | Default model to use |
| `voice?` | `voice?: string;` | Default voice to use |
| `format?` | `format?: AudioFormat;` | Default audio format |
| `speed?` | `speed?: number;` | Default speed (0.25 to 4.0) |

</details>

---

### TTSModelCapabilities `interface`

📍 [`src/domain/entities/TTSModel.ts:20`](src/domain/entities/TTSModel.ts)

TTS model capabilities

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `voices` | `voices: IVoiceInfo[];` | Available voices (empty array means fetch dynamically via API) |
| `formats` | `formats: readonly AudioFormat[] | AudioFormat[];` | Supported output formats |
| `languages` | `languages: readonly string[] | string[];` | Supported languages (ISO-639-1 codes) |
| `speed` | `speed: {
    supported: boolean;
    min?: number;
    max?: number;
    default?: number;
  };` | Speed control support |
| `features` | `features: {
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
  };` | Feature support flags |
| `limits` | `limits: {
    /** Maximum input length in characters */
    maxInputLength: number;
    /** Rate limit (requests per minute) */
    maxRequestsPerMinute?: number;
  };` | Model limits |
| `vendorOptions?` | `vendorOptions?: Record&lt;string, VendorOptionSchema&gt;;` | Vendor-specific options schema |

</details>

---

### TTSOptions `interface`

📍 [`src/domain/interfaces/IAudioProvider.ts:16`](src/domain/interfaces/IAudioProvider.ts)

Options for text-to-speech synthesis

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `model` | `model: string;` | Model to use (e.g., 'tts-1', 'gpt-4o-mini-tts') |
| `input` | `input: string;` | Text to synthesize |
| `voice` | `voice: string;` | Voice ID to use |
| `format?` | `format?: AudioFormat;` | Audio output format |
| `speed?` | `speed?: number;` | Speech speed (0.25 to 4.0, vendor-dependent) |
| `vendorOptions?` | `vendorOptions?: Record&lt;string, unknown&gt;;` | Vendor-specific options passthrough |

</details>

---

### TTSResponse `interface`

📍 [`src/domain/interfaces/IAudioProvider.ts:39`](src/domain/interfaces/IAudioProvider.ts)

Response from text-to-speech synthesis

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `audio` | `audio: Buffer;` | Audio data as Buffer |
| `format` | `format: AudioFormat;` | Format of the audio |
| `durationSeconds?` | `durationSeconds?: number;` | Duration in seconds (if available) |
| `charactersUsed?` | `charactersUsed?: number;` | Number of characters used (for billing) |

</details>

---

### calculateTTSCost `function`

📍 [`src/domain/entities/TTSModel.ts:297`](src/domain/entities/TTSModel.ts)

Calculate estimated cost for TTS

```typescript
export function calculateTTSCost(modelName: string, characterCount: number): number | null
```

---

### getTTSModelsWithFeature `function`

📍 [`src/domain/entities/TTSModel.ts:286`](src/domain/entities/TTSModel.ts)

Get TTS models that support a specific feature

```typescript
export function getTTSModelsWithFeature(
  feature: keyof ITTSModelDescription['capabilities']['features']
): ITTSModelDescription[]
```

---

### TTS_MODEL_REGISTRY `const`

📍 [`src/domain/entities/TTSModel.ts:126`](src/domain/entities/TTSModel.ts)

Complete TTS model registry
Last full audit: January 2026

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'gpt-4o-mini-tts'` | `{
    name: 'gpt-4o-mini-tts',
    displayName: 'GPT-4o Mini TTS',
    provider: Vendor.OpenAI,
    description: 'Instruction-steerable TTS with emotional control via prompts',
    isActive: true,
    releaseDate: '2025-03-01',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/text-to-speech',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      ...OPENAI_TTS_BASE,
      features: {
        streaming: false, // Not implementing streaming in v1
        ssml: false,
        emotions: true, // Via instruction steering
        voiceCloning: true,
        wordTimestamps: false,
        instructionSteering: true,
      },
      limits: { maxInputLength: 2000 },
      vendorOptions: {
        instructions: {
          type: 'string',
          description: 'Natural language instructions for voice style (e.g., "speak like a calm meditation guide")',
        },
      },
    },
    pricing: { per1kCharacters: 0.015, currency: 'USD' },
  }` | - |
| `'tts-1'` | `{
    name: 'tts-1',
    displayName: 'TTS-1',
    provider: Vendor.OpenAI,
    description: 'Fast, low-latency text-to-speech optimized for real-time use',
    isActive: true,
    releaseDate: '2023-11-06',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/text-to-speech',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      ...OPENAI_TTS_BASE,
      features: {
        streaming: false, // Not implementing streaming in v1
        ssml: false,
        emotions: false,
        voiceCloning: false,
        wordTimestamps: false,
      },
      limits: { maxInputLength: 4096 },
    },
    pricing: { per1kCharacters: 0.015, currency: 'USD' },
  }` | - |
| `'tts-1-hd'` | `{
    name: 'tts-1-hd',
    displayName: 'TTS-1 HD',
    provider: Vendor.OpenAI,
    description: 'High-definition text-to-speech with improved audio quality',
    isActive: true,
    releaseDate: '2023-11-06',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/text-to-speech',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      ...OPENAI_TTS_BASE,
      features: {
        streaming: false, // Not implementing streaming in v1
        ssml: false,
        emotions: false,
        voiceCloning: false,
        wordTimestamps: false,
      },
      limits: { maxInputLength: 4096 },
    },
    pricing: { per1kCharacters: 0.030, currency: 'USD' },
  }` | - |
| `'gemini-2.5-flash-preview-tts'` | `{
    name: 'gemini-2.5-flash-preview-tts',
    displayName: 'Gemini 2.5 Flash TTS',
    provider: Vendor.Google,
    description: 'Google Gemini 2.5 Flash TTS - optimized for low latency',
    isActive: true,
    releaseDate: '2025-01-01',
    sources: {
      documentation: 'https://ai.google.dev/gemini-api/docs/speech-generation',
      pricing: 'https://ai.google.dev/pricing',
      lastVerified: '2026-01-25',
    },
    capabilities: {
      voices: GEMINI_VOICES,
      formats: ['wav'] as const, // PCM output, 24kHz 16-bit mono
      languages: [...GEMINI_TTS_LANGUAGES],
      speed: { supported: false }, // Speed not directly configurable
      features: {
        streaming: false, // Not implementing streaming in v1
        ssml: false,
        emotions: true, // Supports affective dialogue
        voiceCloning: false,
        wordTimestamps: false,
      },
      limits: { maxInputLength: 32000 }, // 32k tokens
    },
  }` | - |
| `'gemini-2.5-pro-preview-tts'` | `{
    name: 'gemini-2.5-pro-preview-tts',
    displayName: 'Gemini 2.5 Pro TTS',
    provider: Vendor.Google,
    description: 'Google Gemini 2.5 Pro TTS - optimized for quality',
    isActive: true,
    releaseDate: '2025-01-01',
    sources: {
      documentation: 'https://ai.google.dev/gemini-api/docs/speech-generation',
      pricing: 'https://ai.google.dev/pricing',
      lastVerified: '2026-01-25',
    },
    capabilities: {
      voices: GEMINI_VOICES,
      formats: ['wav'] as const, // PCM output, 24kHz 16-bit mono
      languages: [...GEMINI_TTS_LANGUAGES],
      speed: { supported: false }, // Speed not directly configurable
      features: {
        streaming: false, // Not implementing streaming in v1
        ssml: false,
        emotions: true, // Supports affective dialogue
        voiceCloning: false,
        wordTimestamps: false,
      },
      limits: { maxInputLength: 32000 }, // 32k tokens
    },
  }` | - |

</details>

---

## Speech-to-Text (STT)

Transcribe audio to text

### SpeechToText `class`

📍 [`src/core/SpeechToText.ts:47`](src/core/SpeechToText.ts)

SpeechToText capability class
Provides speech-to-text transcription with model introspection

**Example:**

```typescript
const stt = SpeechToText.create({
  connector: 'openai',
  model: 'whisper-1',
});

const result = await stt.transcribe(audioBuffer);
console.log(result.text);

const detailed = await stt.transcribeWithTimestamps(audioBuffer, 'word');
console.log(detailed.words);
```

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
private constructor(config: SpeechToTextConfig)
```

**Parameters:**
- `config`: `SpeechToTextConfig`

</details>

<details>
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Create a new SpeechToText instance

```typescript
static create(config: SpeechToTextConfig): SpeechToText
```

**Parameters:**
- `config`: `SpeechToTextConfig`

**Returns:** `SpeechToText`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `transcribe()`

Transcribe audio to text

```typescript
async transcribe(
    audio: Buffer | string,
    options?: Partial&lt;Omit&lt;STTOptions, 'model' | 'audio'&gt;&gt;
  ): Promise&lt;STTResponse&gt;
```

**Parameters:**
- `audio`: `string | Buffer&lt;ArrayBufferLike&gt;`
- `options`: `Partial&lt;Omit&lt;STTOptions, "model" | "audio"&gt;&gt; | undefined` *(optional)*

**Returns:** `Promise&lt;STTResponse&gt;`

#### `transcribeFile()`

Transcribe audio file by path

```typescript
async transcribeFile(
    filePath: string,
    options?: Partial&lt;Omit&lt;STTOptions, 'model' | 'audio'&gt;&gt;
  ): Promise&lt;STTResponse&gt;
```

**Parameters:**
- `filePath`: `string`
- `options`: `Partial&lt;Omit&lt;STTOptions, "model" | "audio"&gt;&gt; | undefined` *(optional)*

**Returns:** `Promise&lt;STTResponse&gt;`

#### `transcribeWithTimestamps()`

Transcribe audio with word or segment timestamps

```typescript
async transcribeWithTimestamps(
    audio: Buffer | string,
    granularity: 'word' | 'segment' = 'segment',
    options?: Partial&lt;Omit&lt;STTOptions, 'model' | 'audio' | 'includeTimestamps' | 'timestampGranularity'&gt;&gt;
  ): Promise&lt;STTResponse&gt;
```

**Parameters:**
- `audio`: `string | Buffer&lt;ArrayBufferLike&gt;`
- `granularity`: `"word" | "segment"` *(optional)* (default: `'segment'`)
- `options`: `Partial&lt;Omit&lt;STTOptions, "model" | "audio" | "includeTimestamps" | "timestampGranularity"&gt;&gt; | undefined` *(optional)*

**Returns:** `Promise&lt;STTResponse&gt;`

#### `translate()`

Translate audio to English text
Note: Only supported by some models (e.g., Whisper)

```typescript
async translate(
    audio: Buffer | string,
    options?: Partial&lt;Omit&lt;STTOptions, 'model' | 'audio'&gt;&gt;
  ): Promise&lt;STTResponse&gt;
```

**Parameters:**
- `audio`: `string | Buffer&lt;ArrayBufferLike&gt;`
- `options`: `Partial&lt;Omit&lt;STTOptions, "model" | "audio"&gt;&gt; | undefined` *(optional)*

**Returns:** `Promise&lt;STTResponse&gt;`

#### `getModelInfo()`

Get model information for current or specified model

```typescript
getModelInfo(model?: string): ISTTModelDescription
```

**Parameters:**
- `model`: `string | undefined` *(optional)*

**Returns:** `ISTTModelDescription`

#### `getModelCapabilities()`

Get model capabilities

```typescript
getModelCapabilities(model?: string)
```

**Parameters:**
- `model`: `string | undefined` *(optional)*

**Returns:** `STTModelCapabilities`

#### `listAvailableModels()`

List all available models for this provider's vendor

```typescript
listAvailableModels(): ISTTModelDescription[]
```

**Returns:** `ISTTModelDescription[]`

#### `supportsFeature()`

Check if a specific feature is supported by the model

```typescript
supportsFeature(
    feature: keyof ISTTModelDescription['capabilities']['features'],
    model?: string
  ): boolean
```

**Parameters:**
- `feature`: `"translation" | "diarization" | "streaming" | "punctuation" | "profanityFilter"`
- `model`: `string | undefined` *(optional)*

**Returns:** `boolean`

#### `getSupportedInputFormats()`

Get supported input audio formats

```typescript
getSupportedInputFormats(model?: string): readonly string[] | string[]
```

**Parameters:**
- `model`: `string | undefined` *(optional)*

**Returns:** `string[] | readonly string[]`

#### `getSupportedOutputFormats()`

Get supported output formats

```typescript
getSupportedOutputFormats(model?: string): readonly string[]
```

**Parameters:**
- `model`: `string | undefined` *(optional)*

**Returns:** `readonly string[]`

#### `getSupportedLanguages()`

Get supported languages (empty array = auto-detect all)

```typescript
getSupportedLanguages(model?: string): readonly string[]
```

**Parameters:**
- `model`: `string | undefined` *(optional)*

**Returns:** `readonly string[]`

#### `supportsTimestamps()`

Check if timestamps are supported

```typescript
supportsTimestamps(model?: string): boolean
```

**Parameters:**
- `model`: `string | undefined` *(optional)*

**Returns:** `boolean`

#### `supportsTranslation()`

Check if translation is supported

```typescript
supportsTranslation(model?: string): boolean
```

**Parameters:**
- `model`: `string | undefined` *(optional)*

**Returns:** `boolean`

#### `supportsDiarization()`

Check if speaker diarization is supported

```typescript
supportsDiarization(model?: string): boolean
```

**Parameters:**
- `model`: `string | undefined` *(optional)*

**Returns:** `boolean`

#### `getTimestampGranularities()`

Get timestamp granularities supported

```typescript
getTimestampGranularities(model?: string): ('word' | 'segment')[] | undefined
```

**Parameters:**
- `model`: `string | undefined` *(optional)*

**Returns:** `("word" | "segment")[] | undefined`

#### `setModel()`

Update default model

```typescript
setModel(model: string): void
```

**Parameters:**
- `model`: `string`

**Returns:** `void`

#### `setLanguage()`

Update default language

```typescript
setLanguage(language: string): void
```

**Parameters:**
- `language`: `string`

**Returns:** `void`

#### `setTemperature()`

Update default temperature

```typescript
setTemperature(temperature: number): void
```

**Parameters:**
- `temperature`: `number`

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `provider` | `provider: ISpeechToTextProvider` | - |
| `config` | `config: SpeechToTextConfig` | - |

</details>

---

### ISTTModelDescription `interface`

📍 [`src/domain/entities/STTModel.ts:76`](src/domain/entities/STTModel.ts)

Complete STT model description

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `capabilities` | `capabilities: STTModelCapabilities;` | - |
| `pricing?` | `pricing?: STTModelPricing;` | - |

</details>

---

### SpeechToTextConfig `interface`

📍 [`src/core/SpeechToText.ts:15`](src/core/SpeechToText.ts)

Configuration for SpeechToText capability

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `connector` | `connector: string | Connector;` | Connector name or instance |
| `model?` | `model?: string;` | Default model to use |
| `language?` | `language?: string;` | Default language (ISO-639-1 code) |
| `temperature?` | `temperature?: number;` | Default temperature for sampling |

</details>

---

### STTModelCapabilities `interface`

📍 [`src/domain/entities/STTModel.ts:22`](src/domain/entities/STTModel.ts)

STT model capabilities

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `inputFormats` | `inputFormats: readonly string[] | string[];` | Supported input audio formats |
| `outputFormats` | `outputFormats: STTOutputFormat[];` | Supported output formats |
| `languages` | `languages: string[];` | Supported languages (empty = auto-detect all) |
| `timestamps` | `timestamps: {
    supported: boolean;
    granularities?: ('word' | 'segment')[];
  };` | Timestamp support |
| `features` | `features: {
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
  };` | Feature support flags |
| `limits` | `limits: {
    /** Maximum file size in MB */
    maxFileSizeMB: number;
    /** Maximum duration in seconds */
    maxDurationSeconds?: number;
  };` | Model limits |
| `vendorOptions?` | `vendorOptions?: Record&lt;string, VendorOptionSchema&gt;;` | Vendor-specific options schema |

</details>

---

### STTOptions `interface`

📍 [`src/domain/interfaces/IAudioProvider.ts:80`](src/domain/interfaces/IAudioProvider.ts)

Options for speech-to-text transcription

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `model` | `model: string;` | Model to use (e.g., 'whisper-1', 'gpt-4o-transcribe') |
| `audio` | `audio: Buffer | string;` | Audio data as Buffer or file path |
| `language?` | `language?: string;` | Language code (ISO-639-1), optional for auto-detection |
| `outputFormat?` | `outputFormat?: STTOutputFormat;` | Output format |
| `includeTimestamps?` | `includeTimestamps?: boolean;` | Include word/segment timestamps |
| `timestampGranularity?` | `timestampGranularity?: 'word' | 'segment';` | Timestamp granularity if timestamps enabled |
| `prompt?` | `prompt?: string;` | Optional prompt to guide the model |
| `temperature?` | `temperature?: number;` | Temperature for sampling (0-1) |
| `vendorOptions?` | `vendorOptions?: Record&lt;string, unknown&gt;;` | Vendor-specific options passthrough |

</details>

---

### STTResponse `interface`

📍 [`src/domain/interfaces/IAudioProvider.ts:132`](src/domain/interfaces/IAudioProvider.ts)

Response from speech-to-text transcription

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `text` | `text: string;` | Transcribed text |
| `language?` | `language?: string;` | Detected or specified language |
| `durationSeconds?` | `durationSeconds?: number;` | Audio duration in seconds |
| `words?` | `words?: WordTimestamp[];` | Word-level timestamps (if requested) |
| `segments?` | `segments?: SegmentTimestamp[];` | Segment-level timestamps (if requested) |

</details>

---

### STTOutputFormat `type`

📍 [`src/domain/entities/STTModel.ts:17`](src/domain/entities/STTModel.ts)

STT output format types

```typescript
type STTOutputFormat = 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json'
```

---

### STTOutputFormat `type`

📍 [`src/domain/interfaces/IAudioProvider.ts:75`](src/domain/interfaces/IAudioProvider.ts)

STT output format types

```typescript
type STTOutputFormat = 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json'
```

---

### calculateSTTCost `function`

📍 [`src/domain/entities/STTModel.ts:300`](src/domain/entities/STTModel.ts)

Calculate estimated cost for STT

```typescript
export function calculateSTTCost(modelName: string, durationSeconds: number): number | null
```

---

### getSTTModelsWithFeature `function`

📍 [`src/domain/entities/STTModel.ts:289`](src/domain/entities/STTModel.ts)

Get STT models that support a specific feature

```typescript
export function getSTTModelsWithFeature(
  feature: keyof ISTTModelDescription['capabilities']['features']
): ISTTModelDescription[]
```

---

### STT_MODEL_REGISTRY `const`

📍 [`src/domain/entities/STTModel.ts:124`](src/domain/entities/STTModel.ts)

Complete STT model registry
Last full audit: January 2026

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'gpt-4o-transcribe'` | `{
    name: 'gpt-4o-transcribe',
    displayName: 'GPT-4o Transcribe',
    provider: Vendor.OpenAI,
    description: 'GPT-4o based transcription with superior accuracy and context understanding',
    isActive: true,
    releaseDate: '2025-04-01',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/speech-to-text',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      ...WHISPER_BASE_CAPABILITIES,
      features: {
        translation: true,
        diarization: false,
        streaming: false, // Not implementing streaming in v1
        punctuation: true,
        profanityFilter: false,
      },
      limits: { maxFileSizeMB: 25, maxDurationSeconds: 7200 },
    },
    pricing: { perMinute: 0.006, currency: 'USD' },
  }` | - |
| `'gpt-4o-transcribe-diarize'` | `{
    name: 'gpt-4o-transcribe-diarize',
    displayName: 'GPT-4o Transcribe + Diarization',
    provider: Vendor.OpenAI,
    description: 'GPT-4o transcription with speaker identification',
    isActive: true,
    releaseDate: '2025-04-01',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/speech-to-text',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      ...WHISPER_BASE_CAPABILITIES,
      outputFormats: ['json', 'verbose_json'],
      features: {
        translation: true,
        diarization: true, // Built-in speaker identification
        streaming: false,
        punctuation: true,
        profanityFilter: false,
      },
      limits: { maxFileSizeMB: 25, maxDurationSeconds: 7200 },
      vendorOptions: {
        max_speakers: {
          type: 'number',
          description: 'Maximum number of speakers to detect',
          min: 2,
          max: 10,
          default: 4,
        },
      },
    },
    pricing: { perMinute: 0.012, currency: 'USD' }, // 2x for diarization
  }` | - |
| `'whisper-1'` | `{
    name: 'whisper-1',
    displayName: 'Whisper',
    provider: Vendor.OpenAI,
    description: "OpenAI's general-purpose speech recognition model",
    isActive: true,
    releaseDate: '2023-03-01',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/speech-to-text',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      ...WHISPER_BASE_CAPABILITIES,
      inputFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'],
      features: {
        translation: true,
        diarization: false,
        streaming: false,
        punctuation: true,
        profanityFilter: false,
      },
      limits: { maxFileSizeMB: 25 },
    },
    pricing: { perMinute: 0.006, currency: 'USD' },
  }` | - |
| `'whisper-large-v3'` | `{
    name: 'whisper-large-v3',
    displayName: 'Whisper Large v3 (Groq)',
    provider: Vendor.Groq,
    description: 'Ultra-fast Whisper on Groq LPUs - 12x cheaper than OpenAI',
    isActive: true,
    releaseDate: '2024-04-01',
    sources: {
      documentation: 'https://console.groq.com/docs/speech-text',
      pricing: 'https://groq.com/pricing/',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      ...WHISPER_BASE_CAPABILITIES,
      timestamps: { supported: true, granularities: ['segment'] },
      outputFormats: ['json', 'text', 'verbose_json'],
      features: {
        translation: true,
        diarization: false,
        streaming: false,
        punctuation: true,
        profanityFilter: false,
      },
      limits: { maxFileSizeMB: 25 },
    },
    pricing: { perMinute: 0.0005, currency: 'USD' }, // 12x cheaper!
  }` | - |
| `'distil-whisper-large-v3-en'` | `{
    name: 'distil-whisper-large-v3-en',
    displayName: 'Distil Whisper (Groq)',
    provider: Vendor.Groq,
    description: 'Faster English-only Whisper variant on Groq',
    isActive: true,
    releaseDate: '2024-04-01',
    sources: {
      documentation: 'https://console.groq.com/docs/speech-text',
      pricing: 'https://groq.com/pricing/',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      inputFormats: AUDIO_FORMATS.STT_INPUT,
      outputFormats: ['json', 'text', 'verbose_json'],
      languages: ['en'], // English only
      timestamps: { supported: true, granularities: ['segment'] },
      features: {
        translation: false,
        diarization: false,
        streaming: false,
        punctuation: true,
        profanityFilter: false,
      },
      limits: { maxFileSizeMB: 25 },
    },
    pricing: { perMinute: 0.00033, currency: 'USD' },
  }` | - |

</details>

---

## Image Generation

Generate images from text prompts

### ImageGeneration `class`

📍 [`src/capabilities/images/ImageGeneration.ts:73`](src/capabilities/images/ImageGeneration.ts)

ImageGeneration capability class

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
private constructor(connector: Connector)
```

**Parameters:**
- `connector`: `Connector`

</details>

<details>
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Create an ImageGeneration instance

```typescript
static create(options: ImageGenerationCreateOptions): ImageGeneration
```

**Parameters:**
- `options`: `ImageGenerationCreateOptions`

**Returns:** `ImageGeneration`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `generate()`

Generate images from a text prompt

```typescript
async generate(options: SimpleGenerateOptions): Promise&lt;ImageResponse&gt;
```

**Parameters:**
- `options`: `SimpleGenerateOptions`

**Returns:** `Promise&lt;ImageResponse&gt;`

#### `edit()`

Edit an existing image
Note: Not all models/vendors support this

```typescript
async edit(options: ImageEditOptions): Promise&lt;ImageResponse&gt;
```

**Parameters:**
- `options`: `ImageEditOptions`

**Returns:** `Promise&lt;ImageResponse&gt;`

#### `createVariation()`

Create variations of an existing image
Note: Only DALL-E 2 supports this

```typescript
async createVariation(options: ImageVariationOptions): Promise&lt;ImageResponse&gt;
```

**Parameters:**
- `options`: `ImageVariationOptions`

**Returns:** `Promise&lt;ImageResponse&gt;`

#### `listModels()`

List available models for this provider

```typescript
async listModels(): Promise&lt;string[]&gt;
```

**Returns:** `Promise&lt;string[]&gt;`

#### `getModelInfo()`

Get information about a specific model

```typescript
getModelInfo(modelName: string)
```

**Parameters:**
- `modelName`: `string`

**Returns:** `IImageModelDescription | undefined`

#### `getProvider()`

Get the underlying provider

```typescript
getProvider(): IImageProvider
```

**Returns:** `IImageProvider`

#### `getConnector()`

Get the current connector

```typescript
getConnector(): Connector
```

**Returns:** `Connector`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `provider` | `provider: IImageProvider` | - |
| `connector` | `connector: Connector` | - |
| `defaultModel` | `defaultModel: string` | - |

</details>

---

### ClipboardImageResult `interface`

📍 [`src/utils/clipboardImage.ts:27`](src/utils/clipboardImage.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `dataUri?` | `dataUri?: string;` | - |
| `error?` | `error?: string;` | - |
| `format?` | `format?: string;` | - |

</details>

---

### IImageModelDescription `interface`

📍 [`src/domain/entities/ImageModel.ts:93`](src/domain/entities/ImageModel.ts)

Complete image model description

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `capabilities` | `capabilities: ImageModelCapabilities;` | - |
| `pricing?` | `pricing?: ImageModelPricing;` | - |

</details>

---

### IImageProvider `interface`

📍 [`src/domain/interfaces/IImageProvider.ts:44`](src/domain/interfaces/IImageProvider.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `generateImage()`

Generate images from text prompt

```typescript
generateImage(options: ImageGenerateOptions): Promise&lt;ImageResponse&gt;;
```

**Parameters:**
- `options`: `ImageGenerateOptions`

**Returns:** `Promise&lt;ImageResponse&gt;`

#### `editImage()?`

Edit an existing image (optional - not all providers support)

```typescript
editImage?(options: ImageEditOptions): Promise&lt;ImageResponse&gt;;
```

**Parameters:**
- `options`: `ImageEditOptions`

**Returns:** `Promise&lt;ImageResponse&gt;`

#### `createVariation()?`

Create variations of an image (optional)

```typescript
createVariation?(options: ImageVariationOptions): Promise&lt;ImageResponse&gt;;
```

**Parameters:**
- `options`: `ImageVariationOptions`

**Returns:** `Promise&lt;ImageResponse&gt;`

#### `listModels()?`

List available models

```typescript
listModels?(): Promise&lt;string[]&gt;;
```

**Returns:** `Promise&lt;string[]&gt;`

</details>

---

### ImageEditOptions `interface`

📍 [`src/domain/interfaces/IImageProvider.ts:17`](src/domain/interfaces/IImageProvider.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `model` | `model: string;` | - |
| `image` | `image: Buffer | string;` | - |
| `prompt` | `prompt: string;` | - |
| `mask?` | `mask?: Buffer | string;` | - |
| `size?` | `size?: string;` | - |
| `n?` | `n?: number;` | - |
| `response_format?` | `response_format?: 'url' | 'b64_json';` | - |

</details>

---

### ImageGenerateOptions `interface`

📍 [`src/domain/interfaces/IImageProvider.ts:7`](src/domain/interfaces/IImageProvider.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `model` | `model: string;` | - |
| `prompt` | `prompt: string;` | - |
| `size?` | `size?: string;` | - |
| `quality?` | `quality?: 'standard' | 'hd';` | - |
| `style?` | `style?: 'vivid' | 'natural';` | - |
| `n?` | `n?: number;` | - |
| `response_format?` | `response_format?: 'url' | 'b64_json';` | - |

</details>

---

### ImageGenerationCreateOptions `interface`

📍 [`src/capabilities/images/ImageGeneration.ts:45`](src/capabilities/images/ImageGeneration.ts)

Options for creating an ImageGeneration instance

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `connector` | `connector: string | Connector;` | Connector name or instance |

</details>

---

### ImageModelCapabilities `interface`

📍 [`src/domain/entities/ImageModel.ts:34`](src/domain/entities/ImageModel.ts)

Image model capabilities

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `sizes` | `sizes: readonly ImageSize[];` | Supported image sizes |
| `aspectRatios?` | `aspectRatios?: readonly AspectRatio[];` | Supported aspect ratios (Google) |
| `maxImagesPerRequest` | `maxImagesPerRequest: number;` | Maximum number of images per request |
| `outputFormats` | `outputFormats: readonly string[];` | Supported output formats |
| `features` | `features: {
    /** Text-to-image generation */
    generation: boolean;
    /** Image editing/inpainting */
    editing: boolean;
    /** Image variations */
    variations: boolean;
    /** Style control */
    styleControl: boolean;
    /** Quality control (standard/hd) */
    qualityControl: boolean;
    /** Transparent backgrounds */
    transparency: boolean;
    /** Prompt revision/enhancement */
    promptRevision: boolean;
  };` | Feature support flags |
| `limits` | `limits: {
    /** Maximum prompt length in characters */
    maxPromptLength: number;
    /** Rate limit (requests per minute) */
    maxRequestsPerMinute?: number;
  };` | Model limits |
| `vendorOptions?` | `vendorOptions?: Record&lt;string, VendorOptionSchema&gt;;` | Vendor-specific options schema |

</details>

---

### ImageModelPricing `interface`

📍 [`src/domain/entities/ImageModel.ts:80`](src/domain/entities/ImageModel.ts)

Image model pricing

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `perImageStandard?` | `perImageStandard?: number;` | Cost per image at standard quality |
| `perImageHD?` | `perImageHD?: number;` | Cost per image at HD quality |
| `perImage?` | `perImage?: number;` | Cost per image (flat rate) |
| `currency` | `currency: 'USD';` | - |

</details>

---

### ImageResponse `interface`

📍 [`src/domain/interfaces/IImageProvider.ts:35`](src/domain/interfaces/IImageProvider.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `created` | `created: number;` | - |
| `data` | `data: Array&lt;{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }&gt;;` | - |

</details>

---

### ImageVariationOptions `interface`

📍 [`src/domain/interfaces/IImageProvider.ts:27`](src/domain/interfaces/IImageProvider.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `model` | `model: string;` | - |
| `image` | `image: Buffer | string;` | - |
| `n?` | `n?: number;` | - |
| `size?` | `size?: string;` | - |
| `response_format?` | `response_format?: 'url' | 'b64_json';` | - |

</details>

---

### InputImageContent `interface`

📍 [`src/domain/entities/Content.ts:23`](src/domain/entities/Content.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: ContentType.INPUT_IMAGE_URL;` | - |
| `image_url` | `image_url: {
    url: string; // HTTP URL or data URI
    detail?: 'auto' | 'low' | 'high';
  };` | - |

</details>

---

### SimpleGenerateOptions `interface`

📍 [`src/capabilities/images/ImageGeneration.ts:53`](src/capabilities/images/ImageGeneration.ts)

Simplified options for quick generation

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `prompt` | `prompt: string;` | Text prompt describing the image |
| `model?` | `model?: string;` | Model to use (defaults to vendor's best model) |
| `size?` | `size?: string;` | Image size |
| `quality?` | `quality?: 'standard' | 'hd';` | Quality setting |
| `style?` | `style?: 'vivid' | 'natural';` | Style setting (DALL-E 3 only) |
| `n?` | `n?: number;` | Number of images to generate |
| `response_format?` | `response_format?: 'url' | 'b64_json';` | Response format |

</details>

---

### AspectRatio `type`

📍 [`src/domain/entities/ImageModel.ts:29`](src/domain/entities/ImageModel.ts)

Supported aspect ratios (Google Imagen)

```typescript
type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9'
```

---

### calculateImageCost `function`

📍 [`src/domain/entities/ImageModel.ts:392`](src/domain/entities/ImageModel.ts)

Calculate estimated cost for image generation

```typescript
export function calculateImageCost(
  modelName: string,
  imageCount: number,
  quality: 'standard' | 'hd' = 'standard'
): number | null
```

---

### createImageProvider `function`

📍 [`src/core/createImageProvider.ts:15`](src/core/createImageProvider.ts)

Create an Image Generation provider from a connector

```typescript
export function createImageProvider(connector: Connector): IImageProvider
```

---

### createMessageWithImages `function`

📍 [`src/utils/messageBuilder.ts:140`](src/utils/messageBuilder.ts)

Helper function to create a message with images

```typescript
export function createMessageWithImages(
  text: string,
  imageUrls: string[],
  role: MessageRole = MessageRole.USER
): InputItem
```

---

### getImageModelsWithFeature `function`

📍 [`src/domain/entities/ImageModel.ts:381`](src/domain/entities/ImageModel.ts)

Get image models that support a specific feature

```typescript
export function getImageModelsWithFeature(
  feature: keyof IImageModelDescription['capabilities']['features']
): IImageModelDescription[]
```

---

### hasClipboardImage `function`

📍 [`src/utils/clipboardImage.ts:221`](src/utils/clipboardImage.ts)

Check if clipboard contains an image (quick check)

```typescript
export async function hasClipboardImage(): Promise&lt;boolean&gt;
```

---

### readClipboardImage `function`

📍 [`src/utils/clipboardImage.ts:37`](src/utils/clipboardImage.ts)

Read image from clipboard and convert to data URI

```typescript
export async function readClipboardImage(): Promise&lt;ClipboardImageResult&gt;
```

---

### IMAGE_MODEL_REGISTRY `const`

📍 [`src/domain/entities/ImageModel.ts:129`](src/domain/entities/ImageModel.ts)

Complete image model registry
Last full audit: January 2026

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'gpt-image-1'` | `{
    name: 'gpt-image-1',
    displayName: 'GPT-Image-1',
    provider: Vendor.OpenAI,
    description: 'OpenAI latest image generation model with best quality and features',
    isActive: true,
    releaseDate: '2025-04-01',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/images',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-25',
    },
    capabilities: {
      sizes: ['1024x1024', '1024x1536', '1536x1024', 'auto'],
      maxImagesPerRequest: 1,
      outputFormats: ['png', 'webp', 'jpeg'],
      features: {
        generation: true,
        editing: true,
        variations: false,
        styleControl: false,
        qualityControl: true,
        transparency: true,
        promptRevision: false,
      },
      limits: { maxPromptLength: 32000 },
      vendorOptions: {
        background: {
          type: 'string',
          description: 'Background setting: transparent, opaque, or auto',
        },
        output_format: {
          type: 'string',
          description: 'Output format: png, webp, or jpeg',
        },
      },
    },
    pricing: {
      perImageStandard: 0.011,
      perImageHD: 0.042,
      currency: 'USD',
    },
  }` | - |
| `'dall-e-3'` | `{
    name: 'dall-e-3',
    displayName: 'DALL-E 3',
    provider: Vendor.OpenAI,
    description: 'High quality image generation with prompt revision',
    isActive: true,
    releaseDate: '2023-11-06',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/images',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-25',
    },
    capabilities: {
      sizes: ['1024x1024', '1024x1792', '1792x1024'],
      maxImagesPerRequest: 1,
      outputFormats: ['png', 'url'],
      features: {
        generation: true,
        editing: false,
        variations: false,
        styleControl: true,
        qualityControl: true,
        transparency: false,
        promptRevision: true,
      },
      limits: { maxPromptLength: 4000 },
      vendorOptions: {
        style: {
          type: 'string',
          description: 'Style: vivid (hyper-real) or natural (more natural)',
        },
      },
    },
    pricing: {
      perImageStandard: 0.040,
      perImageHD: 0.080,
      currency: 'USD',
    },
  }` | - |
| `'dall-e-2'` | `{
    name: 'dall-e-2',
    displayName: 'DALL-E 2',
    provider: Vendor.OpenAI,
    description: 'Fast image generation with editing and variation support',
    isActive: true,
    releaseDate: '2022-11-03',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/images',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-25',
    },
    capabilities: {
      sizes: ['256x256', '512x512', '1024x1024'],
      maxImagesPerRequest: 10,
      outputFormats: ['png', 'url'],
      features: {
        generation: true,
        editing: true,
        variations: true,
        styleControl: false,
        qualityControl: false,
        transparency: false,
        promptRevision: false,
      },
      limits: { maxPromptLength: 1000 },
    },
    pricing: {
      perImage: 0.020,
      currency: 'USD',
    },
  }` | - |
| `'imagen-4.0-generate-001'` | `{
    name: 'imagen-4.0-generate-001',
    displayName: 'Imagen 4.0 Generate',
    provider: Vendor.Google,
    description: 'Google Imagen 4.0 - standard quality image generation',
    isActive: true,
    releaseDate: '2025-06-01',
    sources: {
      documentation: 'https://ai.google.dev/gemini-api/docs/imagen',
      pricing: 'https://ai.google.dev/pricing',
      lastVerified: '2026-01-25',
    },
    capabilities: {
      sizes: ['1024x1024'],
      aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
      maxImagesPerRequest: 4,
      outputFormats: ['png', 'jpeg'],
      features: {
        generation: true,
        editing: false,
        variations: false,
        styleControl: false,
        qualityControl: false,
        transparency: false,
        promptRevision: false,
      },
      limits: { maxPromptLength: 480 },
      vendorOptions: {
        negativePrompt: {
          type: 'string',
          description: 'Description of what to avoid in the image',
        },
        seed: {
          type: 'number',
          description: 'Random seed for reproducible generation',
        },
        aspectRatio: {
          type: 'string',
          description: 'Aspect ratio: 1:1, 3:4, 4:3, 9:16, or 16:9',
        },
      },
    },
    pricing: {
      perImage: 0.04,
      currency: 'USD',
    },
  }` | - |
| `'imagen-4.0-ultra-generate-001'` | `{
    name: 'imagen-4.0-ultra-generate-001',
    displayName: 'Imagen 4.0 Ultra',
    provider: Vendor.Google,
    description: 'Google Imagen 4.0 Ultra - highest quality image generation',
    isActive: true,
    releaseDate: '2025-06-01',
    sources: {
      documentation: 'https://ai.google.dev/gemini-api/docs/imagen',
      pricing: 'https://ai.google.dev/pricing',
      lastVerified: '2026-01-25',
    },
    capabilities: {
      sizes: ['1024x1024'],
      aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
      maxImagesPerRequest: 4,
      outputFormats: ['png', 'jpeg'],
      features: {
        generation: true,
        editing: false,
        variations: false,
        styleControl: false,
        qualityControl: true,
        transparency: false,
        promptRevision: false,
      },
      limits: { maxPromptLength: 480 },
    },
    pricing: {
      perImage: 0.08,
      currency: 'USD',
    },
  }` | - |
| `'imagen-4.0-fast-generate-001'` | `{
    name: 'imagen-4.0-fast-generate-001',
    displayName: 'Imagen 4.0 Fast',
    provider: Vendor.Google,
    description: 'Google Imagen 4.0 Fast - optimized for speed',
    isActive: true,
    releaseDate: '2025-06-01',
    sources: {
      documentation: 'https://ai.google.dev/gemini-api/docs/imagen',
      pricing: 'https://ai.google.dev/pricing',
      lastVerified: '2026-01-25',
    },
    capabilities: {
      sizes: ['1024x1024'],
      aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
      maxImagesPerRequest: 4,
      outputFormats: ['png', 'jpeg'],
      features: {
        generation: true,
        editing: false,
        variations: false,
        styleControl: false,
        qualityControl: false,
        transparency: false,
        promptRevision: false,
      },
      limits: { maxPromptLength: 480 },
    },
    pricing: {
      perImage: 0.02,
      currency: 'USD',
    },
  }` | - |

</details>

---

## Video Generation

Generate videos from text prompts

### VideoGeneration `class`

📍 [`src/capabilities/video/VideoGeneration.ts:79`](src/capabilities/video/VideoGeneration.ts)

VideoGeneration capability class

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
private constructor(connector: Connector)
```

**Parameters:**
- `connector`: `Connector`

</details>

<details>
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Create a VideoGeneration instance

```typescript
static create(options: VideoGenerationCreateOptions): VideoGeneration
```

**Parameters:**
- `options`: `VideoGenerationCreateOptions`

**Returns:** `VideoGeneration`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `generate()`

Generate a video from a text prompt
Returns a job that can be polled for completion

```typescript
async generate(options: SimpleVideoGenerateOptions): Promise&lt;VideoResponse&gt;
```

**Parameters:**
- `options`: `SimpleVideoGenerateOptions`

**Returns:** `Promise&lt;VideoResponse&gt;`

#### `getStatus()`

Get the status of a video generation job

```typescript
async getStatus(jobId: string): Promise&lt;VideoResponse&gt;
```

**Parameters:**
- `jobId`: `string`

**Returns:** `Promise&lt;VideoResponse&gt;`

#### `waitForCompletion()`

Wait for a video generation job to complete

```typescript
async waitForCompletion(jobId: string, timeoutMs: number = 600000): Promise&lt;VideoResponse&gt;
```

**Parameters:**
- `jobId`: `string`
- `timeoutMs`: `number` *(optional)* (default: `600000`)

**Returns:** `Promise&lt;VideoResponse&gt;`

#### `download()`

Download a completed video

```typescript
async download(jobId: string): Promise&lt;Buffer&gt;
```

**Parameters:**
- `jobId`: `string`

**Returns:** `Promise&lt;Buffer&lt;ArrayBufferLike&gt;&gt;`

#### `generateAndWait()`

Generate and wait for completion in one call

```typescript
async generateAndWait(
    options: SimpleVideoGenerateOptions,
    timeoutMs: number = 600000
  ): Promise&lt;VideoResponse&gt;
```

**Parameters:**
- `options`: `SimpleVideoGenerateOptions`
- `timeoutMs`: `number` *(optional)* (default: `600000`)

**Returns:** `Promise&lt;VideoResponse&gt;`

#### `extend()`

Extend an existing video
Note: Not all models/vendors support this

```typescript
async extend(options: VideoExtendOptions): Promise&lt;VideoResponse&gt;
```

**Parameters:**
- `options`: `VideoExtendOptions`

**Returns:** `Promise&lt;VideoResponse&gt;`

#### `cancel()`

Cancel a pending video generation job

```typescript
async cancel(jobId: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `jobId`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `listModels()`

List available models for this provider

```typescript
async listModels(): Promise&lt;string[]&gt;
```

**Returns:** `Promise&lt;string[]&gt;`

#### `getModelInfo()`

Get information about a specific model

```typescript
getModelInfo(modelName: string)
```

**Parameters:**
- `modelName`: `string`

**Returns:** `IVideoModelDescription | undefined`

#### `getProvider()`

Get the underlying provider

```typescript
getProvider(): IVideoProvider
```

**Returns:** `IVideoProvider`

#### `getConnector()`

Get the current connector

```typescript
getConnector(): Connector
```

**Returns:** `Connector`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `provider` | `provider: IVideoProvider` | - |
| `connector` | `connector: Connector` | - |
| `defaultModel` | `defaultModel: string` | - |

</details>

---

### IVideoModelDescription `interface`

📍 [`src/domain/entities/VideoModel.ts:56`](src/domain/entities/VideoModel.ts)

Video model description

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `capabilities` | `capabilities: VideoModelCapabilities;` | - |
| `pricing?` | `pricing?: VideoModelPricing;` | - |

</details>

---

### IVideoProvider `interface`

📍 [`src/domain/interfaces/IVideoProvider.ts:105`](src/domain/interfaces/IVideoProvider.ts)

Video provider interface

<details>
<summary><strong>Methods</strong></summary>

#### `generateVideo()`

Generate a video from a text prompt
Returns a job that can be polled for completion

```typescript
generateVideo(options: VideoGenerateOptions): Promise&lt;VideoResponse&gt;;
```

**Parameters:**
- `options`: `VideoGenerateOptions`

**Returns:** `Promise&lt;VideoResponse&gt;`

#### `getVideoStatus()`

Get the status of a video generation job

```typescript
getVideoStatus(jobId: string): Promise&lt;VideoResponse&gt;;
```

**Parameters:**
- `jobId`: `string`

**Returns:** `Promise&lt;VideoResponse&gt;`

#### `downloadVideo()?`

Download a completed video

```typescript
downloadVideo?(jobId: string): Promise&lt;Buffer&gt;;
```

**Parameters:**
- `jobId`: `string`

**Returns:** `Promise&lt;Buffer&lt;ArrayBufferLike&gt;&gt;`

#### `extendVideo()?`

Extend an existing video (optional)

```typescript
extendVideo?(options: VideoExtendOptions): Promise&lt;VideoResponse&gt;;
```

**Parameters:**
- `options`: `VideoExtendOptions`

**Returns:** `Promise&lt;VideoResponse&gt;`

#### `listModels()?`

List available video models

```typescript
listModels?(): Promise&lt;string[]&gt;;
```

**Returns:** `Promise&lt;string[]&gt;`

#### `cancelJob()?`

Cancel a pending video generation job

```typescript
cancelJob?(jobId: string): Promise&lt;boolean&gt;;
```

**Parameters:**
- `jobId`: `string`

**Returns:** `Promise&lt;boolean&gt;`

</details>

---

### SimpleVideoGenerateOptions `interface`

📍 [`src/capabilities/video/VideoGeneration.ts:57`](src/capabilities/video/VideoGeneration.ts)

Simplified options for quick generation

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `prompt` | `prompt: string;` | Text prompt describing the video |
| `model?` | `model?: string;` | Model to use (defaults to vendor's best model) |
| `duration?` | `duration?: number;` | Duration in seconds |
| `resolution?` | `resolution?: string;` | Output resolution (e.g., '1280x720', '1920x1080') |
| `aspectRatio?` | `aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';` | Aspect ratio (alternative to resolution) |
| `image?` | `image?: Buffer | string;` | Reference image for image-to-video |
| `seed?` | `seed?: number;` | Seed for reproducibility |
| `vendorOptions?` | `vendorOptions?: Record&lt;string, unknown&gt;;` | Vendor-specific options |

</details>

---

### VideoExtendOptions `interface`

📍 [`src/domain/interfaces/IVideoProvider.ts:32`](src/domain/interfaces/IVideoProvider.ts)

Options for extending an existing video

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `model` | `model: string;` | Model to use |
| `video` | `video: Buffer | string;` | The video to extend |
| `prompt?` | `prompt?: string;` | Optional prompt for the extension |
| `extendDuration` | `extendDuration: number;` | Duration to add in seconds |
| `direction?` | `direction?: 'start' | 'end';` | Extend from beginning or end |

</details>

---

### VideoGenerateOptions `interface`

📍 [`src/domain/interfaces/IVideoProvider.ts:10`](src/domain/interfaces/IVideoProvider.ts)

Options for generating a video

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `model` | `model: string;` | Model to use |
| `prompt` | `prompt: string;` | Text prompt describing the video |
| `duration?` | `duration?: number;` | Duration in seconds |
| `resolution?` | `resolution?: string;` | Output resolution (e.g., '1280x720', '1920x1080') |
| `aspectRatio?` | `aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';` | Aspect ratio (alternative to resolution) |
| `image?` | `image?: Buffer | string;` | Reference image for image-to-video |
| `seed?` | `seed?: number;` | Seed for reproducibility |
| `vendorOptions?` | `vendorOptions?: Record&lt;string, unknown&gt;;` | Vendor-specific options |

</details>

---

### VideoGenerationCreateOptions `interface`

📍 [`src/capabilities/video/VideoGeneration.ts:49`](src/capabilities/video/VideoGeneration.ts)

Options for creating a VideoGeneration instance

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `connector` | `connector: string | Connector;` | Connector name or instance |

</details>

---

### VideoJob `interface`

📍 [`src/domain/interfaces/IVideoProvider.ts:53`](src/domain/interfaces/IVideoProvider.ts)

Video generation job

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | Job ID |
| `status` | `status: VideoStatus;` | Current status |
| `createdAt` | `createdAt: number;` | Timestamp when created |
| `completedAt?` | `completedAt?: number;` | Timestamp when completed (if applicable) |
| `error?` | `error?: string;` | Error message if failed |
| `progress?` | `progress?: number;` | Progress percentage (0-100) |

</details>

---

### VideoModelCapabilities `interface`

📍 [`src/domain/entities/VideoModel.ts:15`](src/domain/entities/VideoModel.ts)

Video model capabilities

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `durations` | `durations: number[];` | Supported durations in seconds |
| `resolutions` | `resolutions: string[];` | Supported resolutions (e.g., '720x1280', '1080x1920') |
| `maxFps` | `maxFps: number;` | Maximum frames per second |
| `audio` | `audio: boolean;` | Whether the model supports audio generation |
| `imageToVideo` | `imageToVideo: boolean;` | Whether the model supports image-to-video |
| `videoExtension` | `videoExtension: boolean;` | Whether the model supports video extension |
| `frameControl` | `frameControl: boolean;` | Whether the model supports first/last frame specification |
| `features` | `features: {
    /** Supports upscaling output */
    upscaling: boolean;
    /** Supports style/mood control */
    styleControl: boolean;
    /** Supports negative prompts */
    negativePrompt: boolean;
    /** Supports seed for reproducibility */
    seed: boolean;
  };` | Additional features |

</details>

---

### VideoModelPricing `interface`

📍 [`src/domain/entities/VideoModel.ts:46`](src/domain/entities/VideoModel.ts)

Video model pricing

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `perSecond` | `perSecond: number;` | Cost per second of generated video |
| `currency` | `currency: string;` | Currency |

</details>

---

### VideoResponse `interface`

📍 [`src/domain/interfaces/IVideoProvider.ts:71`](src/domain/interfaces/IVideoProvider.ts)

Video generation response

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `jobId` | `jobId: string;` | Job ID for tracking |
| `status` | `status: VideoStatus;` | Current status |
| `created` | `created: number;` | Timestamp when created |
| `progress?` | `progress?: number;` | Progress percentage (0-100) |
| `video?` | `video?: {
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
  };` | Generated video data (when complete) |
| `audio?` | `audio?: {
    url?: string;
    b64_json?: string;
  };` | Audio track info (if separate) |
| `error?` | `error?: string;` | Error if failed |

</details>

---

### VideoStatus `type`

📍 [`src/domain/interfaces/IVideoProvider.ts:48`](src/domain/interfaces/IVideoProvider.ts)

Video generation status (for async operations)

```typescript
type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed'
```

---

### calculateVideoCost `function`

📍 [`src/domain/entities/VideoModel.ts:310`](src/domain/entities/VideoModel.ts)

Calculate video generation cost

```typescript
export function calculateVideoCost(modelName: string, durationSeconds: number): number | null
```

---

### createVideoProvider `function`

📍 [`src/core/createVideoProvider.ts:14`](src/core/createVideoProvider.ts)

Create a video provider from a connector

```typescript
export function createVideoProvider(connector: Connector): IVideoProvider
```

---

### getVideoModelsWithAudio `function`

📍 [`src/domain/entities/VideoModel.ts:303`](src/domain/entities/VideoModel.ts)

Get models that support audio

```typescript
export function getVideoModelsWithAudio(): IVideoModelDescription[]
```

---

### getVideoModelsWithFeature `function`

📍 [`src/domain/entities/VideoModel.ts:294`](src/domain/entities/VideoModel.ts)

Get models with a specific feature

```typescript
export function getVideoModelsWithFeature(feature: keyof VideoModelCapabilities['features']): IVideoModelDescription[]
```

---

### VIDEO_MODEL_REGISTRY `const`

📍 [`src/domain/entities/VideoModel.ts:101`](src/domain/entities/VideoModel.ts)

Video Model Registry

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'sora-2'` | `{
    name: 'sora-2',
    displayName: 'Sora 2',
    provider: Vendor.OpenAI,
    isActive: true,
    sources: OPENAI_SOURCES,
    capabilities: {
      durations: [4, 8, 12],
      resolutions: ['720x1280', '1280x720', '1024x1792', '1792x1024'],
      maxFps: 30,
      audio: true,
      imageToVideo: true,
      videoExtension: true,
      frameControl: false,
      features: {
        upscaling: false,
        styleControl: false,
        negativePrompt: false,
        seed: true,
      },
    },
    pricing: {
      perSecond: 0.15,
      currency: 'USD',
    },
  }` | - |
| `'sora-2-pro'` | `{
    name: 'sora-2-pro',
    displayName: 'Sora 2 Pro',
    provider: Vendor.OpenAI,
    isActive: true,
    sources: OPENAI_SOURCES,
    capabilities: {
      durations: [4, 8, 12],
      resolutions: ['720x1280', '1280x720', '1024x1792', '1792x1024', '1920x1080', '1080x1920'],
      maxFps: 30,
      audio: true,
      imageToVideo: true,
      videoExtension: true,
      frameControl: true,
      features: {
        upscaling: true,
        styleControl: true,
        negativePrompt: false,
        seed: true,
      },
    },
    pricing: {
      perSecond: 0.40,
      currency: 'USD',
    },
  }` | - |
| `'veo-2.0-generate-001'` | `{
    name: 'veo-2.0-generate-001',
    displayName: 'Veo 2.0',
    provider: Vendor.Google,
    isActive: true,
    sources: GOOGLE_SOURCES,
    capabilities: {
      durations: [5, 6, 7, 8],
      resolutions: ['768x1408', '1408x768', '1024x1024'],
      maxFps: 24,
      audio: false,
      imageToVideo: true,
      videoExtension: false,
      frameControl: true,
      features: {
        upscaling: false,
        styleControl: false,
        negativePrompt: true,
        seed: true,
      },
    },
    pricing: {
      perSecond: 0.03,
      currency: 'USD',
    },
  }` | - |
| `'veo-3-generate-preview'` | `{
    name: 'veo-3-generate-preview',
    displayName: 'Veo 3.0',
    provider: Vendor.Google,
    isActive: true,
    sources: GOOGLE_SOURCES,
    capabilities: {
      durations: [4, 6, 8],
      resolutions: ['720p', '1080p', '768x1408', '1408x768'],
      maxFps: 30,
      audio: true,
      imageToVideo: true,
      videoExtension: true,
      frameControl: true,
      features: {
        upscaling: true,
        styleControl: true,
        negativePrompt: true,
        seed: true,
      },
    },
    pricing: {
      perSecond: 0.75,
      currency: 'USD',
    },
  }` | - |
| `'veo-3.1-fast-generate-preview'` | `{
    name: 'veo-3.1-fast-generate-preview',
    displayName: 'Veo 3.1 Fast',
    provider: Vendor.Google,
    isActive: true,
    sources: GOOGLE_SOURCES,
    capabilities: {
      durations: [4, 6, 8],
      resolutions: ['720p', '768x1408', '1408x768'],
      maxFps: 24,
      audio: true,
      imageToVideo: true,
      videoExtension: false,
      frameControl: false,
      features: {
        upscaling: false,
        styleControl: false,
        negativePrompt: true,
        seed: true,
      },
    },
    pricing: {
      perSecond: 0.75,
      currency: 'USD',
    },
  }` | - |
| `'veo-3.1-generate-preview'` | `{
    name: 'veo-3.1-generate-preview',
    displayName: 'Veo 3.1',
    provider: Vendor.Google,
    isActive: true,
    sources: GOOGLE_SOURCES,
    capabilities: {
      durations: [4, 6, 8],
      resolutions: ['720p', '1080p', '4k', '768x1408', '1408x768'],
      maxFps: 30,
      audio: true,
      imageToVideo: true,
      videoExtension: true,
      frameControl: true,
      features: {
        upscaling: true,
        styleControl: true,
        negativePrompt: true,
        seed: true,
      },
    },
    pricing: {
      perSecond: 0.75,
      currency: 'USD',
    },
  }` | - |

</details>

---

## Task Agents

Autonomous agents with planning and memory

### CheckpointManager `class`

📍 [`src/capabilities/taskAgent/CheckpointManager.ts:36`](src/capabilities/taskAgent/CheckpointManager.ts)

Manages state checkpointing for persistence and recovery

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(storage: IAgentStorage, strategy: CheckpointStrategy = DEFAULT_CHECKPOINT_STRATEGY)
```

**Parameters:**
- `storage`: `IAgentStorage`
- `strategy`: `CheckpointStrategy` *(optional)* (default: `DEFAULT_CHECKPOINT_STRATEGY`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `setCurrentState()`

Set the current agent state (for interval checkpointing)

```typescript
setCurrentState(state: AgentState): void
```

**Parameters:**
- `state`: `AgentState`

**Returns:** `void`

#### `onToolCall()`

Record a tool call (may trigger checkpoint)

```typescript
async onToolCall(state: AgentState): Promise&lt;void&gt;
```

**Parameters:**
- `state`: `AgentState`

**Returns:** `Promise&lt;void&gt;`

#### `onLLMCall()`

Record an LLM call (may trigger checkpoint)

```typescript
async onLLMCall(state: AgentState): Promise&lt;void&gt;
```

**Parameters:**
- `state`: `AgentState`

**Returns:** `Promise&lt;void&gt;`

#### `checkpoint()`

Force a checkpoint

```typescript
async checkpoint(state: AgentState, reason: string): Promise&lt;void&gt;
```

**Parameters:**
- `state`: `AgentState`
- `reason`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `flush()`

Wait for all pending checkpoints to complete

```typescript
async flush(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `cleanup()`

Cleanup resources

```typescript
async cleanup(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `storage` | `storage: IAgentStorage` | - |
| `strategy` | `strategy: CheckpointStrategy` | - |
| `toolCallsSinceCheckpoint` | `toolCallsSinceCheckpoint: number` | - |
| `llmCallsSinceCheckpoint` | `llmCallsSinceCheckpoint: number` | - |
| `intervalTimer?` | `intervalTimer: NodeJS.Timeout | undefined` | - |
| `pendingCheckpoints` | `pendingCheckpoints: Set&lt;Promise&lt;void&gt;&gt;` | - |
| `currentState` | `currentState: AgentState | null` | - |

</details>

---

### ExternalDependencyHandler `class`

📍 [`src/capabilities/taskAgent/ExternalDependencyHandler.ts:21`](src/capabilities/taskAgent/ExternalDependencyHandler.ts)

Handles external task dependencies

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(tools: ToolFunction[] = [])
```

**Parameters:**
- `tools`: `ToolFunction&lt;any, any&gt;[]` *(optional)* (default: `[]`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `startWaiting()`

Start handling a task's external dependency

```typescript
async startWaiting(task: Task): Promise&lt;void&gt;
```

**Parameters:**
- `task`: `Task`

**Returns:** `Promise&lt;void&gt;`

#### `stopWaiting()`

Stop waiting on a task's external dependency

```typescript
stopWaiting(task: Task): void
```

**Parameters:**
- `task`: `Task`

**Returns:** `void`

#### `triggerWebhook()`

Trigger a webhook

```typescript
async triggerWebhook(webhookId: string, data: unknown): Promise&lt;void&gt;
```

**Parameters:**
- `webhookId`: `string`
- `data`: `unknown`

**Returns:** `Promise&lt;void&gt;`

#### `completeManual()`

Complete a manual task

```typescript
async completeManual(taskId: string, data: unknown): Promise&lt;void&gt;
```

**Parameters:**
- `taskId`: `string`
- `data`: `unknown`

**Returns:** `Promise&lt;void&gt;`

#### `cleanup()`

Cleanup all active dependencies

```typescript
cleanup(): void
```

**Returns:** `void`

#### `updateTools()`

Update available tools

```typescript
updateTools(tools: ToolFunction[]): void
```

**Parameters:**
- `tools`: `ToolFunction&lt;any, any&gt;[]`

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `activePolls` | `activePolls: Map&lt;string, NodeJS.Timeout&gt;` | - |
| `activeScheduled` | `activeScheduled: Map&lt;string, NodeJS.Timeout&gt;` | - |
| `cancelledPolls` | `cancelledPolls: Set&lt;string&gt;` | - |
| `tools` | `tools: Map&lt;string, ToolFunction&lt;any, any&gt;&gt;` | - |

</details>

---

### InContextMemoryPlugin `class`

📍 [`src/core/context/plugins/InContextMemoryPlugin.ts:96`](src/core/context/plugins/InContextMemoryPlugin.ts)

InContextMemoryPlugin - Stores key-value pairs directly in LLM context

Use this for:
- Current state/status that changes frequently
- User preferences during a session
- Small accumulated results
- Counters, flags, or control variables

Do NOT use this for:
- Large data (use WorkingMemory instead)
- Data that doesn't need instant access
- Rarely accessed reference data

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

Create an InContextMemoryPlugin

```typescript
constructor(config: InContextMemoryConfig =
```

**Parameters:**
- `config`: `InContextMemoryConfig` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `set()`

Store or update a key-value pair

```typescript
set(key: string, description: string, value: unknown, priority?: InContextPriority): void
```

**Parameters:**
- `key`: `string`
- `description`: `string`
- `value`: `unknown`
- `priority`: `InContextPriority | undefined` *(optional)*

**Returns:** `void`

#### `get()`

Get a value by key

```typescript
get(key: string): unknown | undefined
```

**Parameters:**
- `key`: `string`

**Returns:** `unknown`

#### `has()`

Check if a key exists

```typescript
has(key: string): boolean
```

**Parameters:**
- `key`: `string`

**Returns:** `boolean`

#### `delete()`

Delete an entry by key

```typescript
delete(key: string): boolean
```

**Parameters:**
- `key`: `string`

**Returns:** `boolean`

#### `list()`

List all entries with metadata

```typescript
list(): Array&lt;
```

**Returns:** `{ key: string; description: string; priority: InContextPriority; updatedAt: number; }[]`

#### `clear()`

Clear all entries

```typescript
clear(): void
```

**Returns:** `void`

#### `getComponent()`

Get the context component for this plugin

```typescript
async getComponent(): Promise&lt;IContextComponent | null&gt;
```

**Returns:** `Promise&lt;IContextComponent | null&gt;`

#### `compact()`

Compact by evicting low-priority entries

Eviction order: low → normal → high (critical is never auto-evicted)
Within same priority, oldest entries are evicted first

```typescript
override async compact(targetTokens: number, estimator: ITokenEstimator): Promise&lt;number&gt;
```

**Parameters:**
- `targetTokens`: `number`
- `estimator`: `ITokenEstimator`

**Returns:** `Promise&lt;number&gt;`

#### `getState()`

Get serialized state for session persistence

```typescript
override getState(): SerializedInContextMemoryState
```

**Returns:** `SerializedInContextMemoryState`

#### `restoreState()`

Restore state from serialization

```typescript
override restoreState(state: unknown): void
```

**Parameters:**
- `state`: `unknown`

**Returns:** `void`

#### `destroy()`

Clean up resources

```typescript
override destroy(): void
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "in_context_memory"` | - |
| `priority` | `priority: 5` | - |
| `compactable` | `compactable: true` | - |
| `entries` | `entries: Map&lt;string, InContextEntry&gt;` | - |
| `config` | `config: Required&lt;InContextMemoryConfig&gt;` | - |
| `destroyed` | `destroyed: boolean` | - |

</details>

---

### InMemoryAgentStateStorage `class`

📍 [`src/infrastructure/storage/InMemoryStorage.ts:140`](src/infrastructure/storage/InMemoryStorage.ts)

In-memory implementation of IAgentStateStorage

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

```typescript
async save(state: AgentState): Promise&lt;void&gt;
```

**Parameters:**
- `state`: `AgentState`

**Returns:** `Promise&lt;void&gt;`

#### `load()`

```typescript
async load(agentId: string): Promise&lt;AgentState | undefined&gt;
```

**Parameters:**
- `agentId`: `string`

**Returns:** `Promise&lt;AgentState | undefined&gt;`

#### `delete()`

```typescript
async delete(agentId: string): Promise&lt;void&gt;
```

**Parameters:**
- `agentId`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `list()`

```typescript
async list(filter?:
```

**Parameters:**
- `filter`: `{ status?: AgentStatus[] | undefined; } | undefined` *(optional)*

**Returns:** `Promise&lt;AgentState[]&gt;`

#### `patch()`

```typescript
async patch(agentId: string, updates: Partial&lt;AgentState&gt;): Promise&lt;void&gt;
```

**Parameters:**
- `agentId`: `string`
- `updates`: `Partial&lt;AgentState&gt;`

**Returns:** `Promise&lt;void&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agents` | `agents: Map&lt;string, AgentState&gt;` | - |

</details>

---

### InMemoryHistoryStorage `class`

📍 [`src/infrastructure/storage/InMemoryHistoryStorage.ts:17`](src/infrastructure/storage/InMemoryHistoryStorage.ts)

In-memory history storage implementation

<details>
<summary><strong>Methods</strong></summary>

#### `addMessage()`

```typescript
async addMessage(message: HistoryMessage): Promise&lt;void&gt;
```

**Parameters:**
- `message`: `HistoryMessage`

**Returns:** `Promise&lt;void&gt;`

#### `getMessages()`

```typescript
async getMessages(): Promise&lt;HistoryMessage[]&gt;
```

**Returns:** `Promise&lt;HistoryMessage[]&gt;`

#### `getRecentMessages()`

```typescript
async getRecentMessages(count: number): Promise&lt;HistoryMessage[]&gt;
```

**Parameters:**
- `count`: `number`

**Returns:** `Promise&lt;HistoryMessage[]&gt;`

#### `removeMessage()`

```typescript
async removeMessage(id: string): Promise&lt;void&gt;
```

**Parameters:**
- `id`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `removeOlderThan()`

```typescript
async removeOlderThan(timestamp: number): Promise&lt;number&gt;
```

**Parameters:**
- `timestamp`: `number`

**Returns:** `Promise&lt;number&gt;`

#### `clear()`

```typescript
async clear(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `getCount()`

```typescript
async getCount(): Promise&lt;number&gt;
```

**Returns:** `Promise&lt;number&gt;`

#### `getState()`

```typescript
async getState(): Promise&lt;SerializedHistoryState&gt;
```

**Returns:** `Promise&lt;SerializedHistoryState&gt;`

#### `restoreState()`

```typescript
async restoreState(state: SerializedHistoryState): Promise&lt;void&gt;
```

**Parameters:**
- `state`: `SerializedHistoryState`

**Returns:** `Promise&lt;void&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `messages` | `messages: HistoryMessage[]` | - |
| `summaries` | `summaries: { content: string; coversCount: number; timestamp: number; }[]` | - |

</details>

---

### InMemoryMetrics `class`

📍 [`src/infrastructure/observability/Metrics.ts:83`](src/infrastructure/observability/Metrics.ts)

In-memory metrics aggregator (testing/development)

<details>
<summary><strong>Methods</strong></summary>

#### `increment()`

```typescript
increment(metric: string, value: number = 1, tags?: MetricTags): void
```

**Parameters:**
- `metric`: `string`
- `value`: `number` *(optional)* (default: `1`)
- `tags`: `MetricTags | undefined` *(optional)*

**Returns:** `void`

#### `gauge()`

```typescript
gauge(metric: string, value: number, tags?: MetricTags): void
```

**Parameters:**
- `metric`: `string`
- `value`: `number`
- `tags`: `MetricTags | undefined` *(optional)*

**Returns:** `void`

#### `timing()`

```typescript
timing(metric: string, duration: number, tags?: MetricTags): void
```

**Parameters:**
- `metric`: `string`
- `duration`: `number`
- `tags`: `MetricTags | undefined` *(optional)*

**Returns:** `void`

#### `histogram()`

```typescript
histogram(metric: string, value: number, tags?: MetricTags): void
```

**Parameters:**
- `metric`: `string`
- `value`: `number`
- `tags`: `MetricTags | undefined` *(optional)*

**Returns:** `void`

#### `getMetrics()`

Get all metrics (for testing)

```typescript
getMetrics():
```

**Returns:** `{ counters: Map&lt;string, number&gt;; gauges: Map&lt;string, number&gt;; timings: Map&lt;string, number[]&gt;; histograms: Map&lt;string, number[]&gt;; }`

#### `clear()`

Clear all metrics

```typescript
clear(): void
```

**Returns:** `void`

#### `getTimingStats()`

Get summary statistics for timings

```typescript
getTimingStats(metric: string, tags?: MetricTags):
```

**Parameters:**
- `metric`: `string`
- `tags`: `MetricTags | undefined` *(optional)*

**Returns:** `{ count: number; min: number; max: number; mean: number; p50: number; p95: number; p99: number; } | null`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `counters` | `counters: Map&lt;string, number&gt;` | - |
| `gauges` | `gauges: Map&lt;string, number&gt;` | - |
| `timings` | `timings: Map&lt;string, number[]&gt;` | - |
| `histograms` | `histograms: Map&lt;string, number[]&gt;` | - |

</details>

---

### InMemoryPlanStorage `class`

📍 [`src/infrastructure/storage/InMemoryStorage.ts:70`](src/infrastructure/storage/InMemoryStorage.ts)

In-memory implementation of IPlanStorage

<details>
<summary><strong>Methods</strong></summary>

#### `savePlan()`

```typescript
async savePlan(plan: Plan): Promise&lt;void&gt;
```

**Parameters:**
- `plan`: `Plan`

**Returns:** `Promise&lt;void&gt;`

#### `getPlan()`

```typescript
async getPlan(planId: string): Promise&lt;Plan | undefined&gt;
```

**Parameters:**
- `planId`: `string`

**Returns:** `Promise&lt;Plan | undefined&gt;`

#### `updateTask()`

```typescript
async updateTask(planId: string, task: Task): Promise&lt;void&gt;
```

**Parameters:**
- `planId`: `string`
- `task`: `Task`

**Returns:** `Promise&lt;void&gt;`

#### `addTask()`

```typescript
async addTask(planId: string, task: Task): Promise&lt;void&gt;
```

**Parameters:**
- `planId`: `string`
- `task`: `Task`

**Returns:** `Promise&lt;void&gt;`

#### `deletePlan()`

```typescript
async deletePlan(planId: string): Promise&lt;void&gt;
```

**Parameters:**
- `planId`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `listPlans()`

```typescript
async listPlans(filter?:
```

**Parameters:**
- `filter`: `{ status?: PlanStatus[] | undefined; } | undefined` *(optional)*

**Returns:** `Promise&lt;Plan[]&gt;`

#### `findByWebhookId()`

```typescript
async findByWebhookId(webhookId: string): Promise&lt;
```

**Parameters:**
- `webhookId`: `string`

**Returns:** `Promise&lt;{ plan: Plan; task: Task; } | undefined&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `plans` | `plans: Map&lt;string, Plan&gt;` | - |

</details>

---

### InMemorySessionStorage `class`

📍 [`src/infrastructure/storage/InMemorySessionStorage.ts:15`](src/infrastructure/storage/InMemorySessionStorage.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

```typescript
async save(session: Session): Promise&lt;void&gt;
```

**Parameters:**
- `session`: `Session`

**Returns:** `Promise&lt;void&gt;`

#### `load()`

```typescript
async load(sessionId: string): Promise&lt;Session | null&gt;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;Session | null&gt;`

#### `delete()`

```typescript
async delete(sessionId: string): Promise&lt;void&gt;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `exists()`

```typescript
async exists(sessionId: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `list()`

```typescript
async list(filter?: SessionFilter): Promise&lt;SessionSummary[]&gt;
```

**Parameters:**
- `filter`: `SessionFilter | undefined` *(optional)*

**Returns:** `Promise&lt;SessionSummary[]&gt;`

#### `search()`

```typescript
async search(query: string, filter?: SessionFilter): Promise&lt;SessionSummary[]&gt;
```

**Parameters:**
- `query`: `string`
- `filter`: `SessionFilter | undefined` *(optional)*

**Returns:** `Promise&lt;SessionSummary[]&gt;`

#### `clear()`

Clear all sessions (useful for testing)

```typescript
clear(): void
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `sessions` | `sessions: Map&lt;string, Session&gt;` | - |

</details>

---

### InMemoryStorage `class`

📍 [`src/infrastructure/storage/InMemoryStorage.ts:15`](src/infrastructure/storage/InMemoryStorage.ts)

In-memory implementation of IMemoryStorage

<details>
<summary><strong>Methods</strong></summary>

#### `get()`

```typescript
async get(key: string): Promise&lt;MemoryEntry | undefined&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;MemoryEntry | undefined&gt;`

#### `set()`

```typescript
async set(key: string, entry: MemoryEntry): Promise&lt;void&gt;
```

**Parameters:**
- `key`: `string`
- `entry`: `MemoryEntry`

**Returns:** `Promise&lt;void&gt;`

#### `delete()`

```typescript
async delete(key: string): Promise&lt;void&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `has()`

```typescript
async has(key: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `getAll()`

```typescript
async getAll(): Promise&lt;MemoryEntry[]&gt;
```

**Returns:** `Promise&lt;MemoryEntry[]&gt;`

#### `getByScope()`

```typescript
async getByScope(scope: MemoryScope): Promise&lt;MemoryEntry[]&gt;
```

**Parameters:**
- `scope`: `MemoryScope`

**Returns:** `Promise&lt;MemoryEntry[]&gt;`

#### `clearScope()`

```typescript
async clearScope(scope: MemoryScope): Promise&lt;void&gt;
```

**Parameters:**
- `scope`: `MemoryScope`

**Returns:** `Promise&lt;void&gt;`

#### `clear()`

```typescript
async clear(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `getTotalSize()`

```typescript
async getTotalSize(): Promise&lt;number&gt;
```

**Returns:** `Promise&lt;number&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `store` | `store: Map&lt;string, MemoryEntry&gt;` | - |

</details>

---

### MemoryConnectorStorage `class`

📍 [`src/connectors/storage/MemoryConnectorStorage.ts:20`](src/connectors/storage/MemoryConnectorStorage.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

```typescript
async save(name: string, stored: StoredConnectorConfig): Promise&lt;void&gt;
```

**Parameters:**
- `name`: `string`
- `stored`: `StoredConnectorConfig`

**Returns:** `Promise&lt;void&gt;`

#### `get()`

```typescript
async get(name: string): Promise&lt;StoredConnectorConfig | null&gt;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;StoredConnectorConfig | null&gt;`

#### `delete()`

```typescript
async delete(name: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `has()`

```typescript
async has(name: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `list()`

```typescript
async list(): Promise&lt;string[]&gt;
```

**Returns:** `Promise&lt;string[]&gt;`

#### `listAll()`

```typescript
async listAll(): Promise&lt;StoredConnectorConfig[]&gt;
```

**Returns:** `Promise&lt;StoredConnectorConfig[]&gt;`

#### `clear()`

Clear all stored configs (useful for testing)

```typescript
clear(): void
```

**Returns:** `void`

#### `size()`

Get the number of stored configs

```typescript
size(): number
```

**Returns:** `number`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `configs` | `configs: Map&lt;string, StoredConnectorConfig&gt;` | - |

</details>

---

### MemoryEvictionCompactor `class`

📍 [`src/infrastructure/context/compactors/MemoryEvictionCompactor.ts:10`](src/infrastructure/context/compactors/MemoryEvictionCompactor.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(private estimator: ITokenEstimator)
```

**Parameters:**
- `estimator`: `ITokenEstimator`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `canCompact()`

```typescript
canCompact(component: IContextComponent): boolean
```

**Parameters:**
- `component`: `IContextComponent`

**Returns:** `boolean`

#### `compact()`

```typescript
async compact(component: IContextComponent, targetTokens: number): Promise&lt;IContextComponent&gt;
```

**Parameters:**
- `component`: `IContextComponent`
- `targetTokens`: `number`

**Returns:** `Promise&lt;IContextComponent&gt;`

#### `estimateSavings()`

```typescript
estimateSavings(component: IContextComponent): number
```

**Parameters:**
- `component`: `IContextComponent`

**Returns:** `number`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "memory-eviction"` | - |
| `priority` | `priority: 8` | - |

</details>

---

### MemoryStorage `class`

📍 [`src/connectors/oauth/infrastructure/storage/MemoryStorage.ts:9`](src/connectors/oauth/infrastructure/storage/MemoryStorage.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `storeToken()`

```typescript
async storeToken(key: string, token: StoredToken): Promise&lt;void&gt;
```

**Parameters:**
- `key`: `string`
- `token`: `StoredToken`

**Returns:** `Promise&lt;void&gt;`

#### `getToken()`

```typescript
async getToken(key: string): Promise&lt;StoredToken | null&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;StoredToken | null&gt;`

#### `deleteToken()`

```typescript
async deleteToken(key: string): Promise&lt;void&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `hasToken()`

```typescript
async hasToken(key: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `clearAll()`

Clear all tokens (useful for testing)

```typescript
clearAll(): void
```

**Returns:** `void`

#### `size()`

Get number of stored tokens

```typescript
size(): number
```

**Returns:** `number`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `tokens` | `tokens: Map&lt;string, string&gt;` | - |

</details>

---

### ParallelTasksError `class`

📍 [`src/domain/errors/AIErrors.ts:244`](src/domain/errors/AIErrors.ts)

Error thrown when multiple tasks fail in parallel execution (fail-all mode)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    /** Array of task failures */
    public readonly failures: TaskFailure[]
  )
```

**Parameters:**
- `failures`: `TaskFailure[]`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `getErrors()`

Get all failure errors

```typescript
getErrors(): Error[]
```

**Returns:** `Error[]`

#### `getFailedTaskIds()`

Get failed task IDs

```typescript
getFailedTaskIds(): string[]
```

**Returns:** `string[]`

</details>

---

### PlanExecutor `class`

📍 [`src/capabilities/taskAgent/PlanExecutor.ts:78`](src/capabilities/taskAgent/PlanExecutor.ts)

Executes a plan using LLM and tools

NOTE: Memory and cache are accessed via agentContext (single source of truth)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    agent: Agent,
    agentContext: AgentContext,
    planPlugin: PlanPlugin,
    externalHandler: ExternalDependencyHandler,
    checkpointManager: CheckpointManager,
    hooks: TaskAgentHooks | undefined,
    config: PlanExecutorConfig
  )
```

**Parameters:**
- `agent`: `Agent`
- `agentContext`: `AgentContext`
- `planPlugin`: `PlanPlugin`
- `externalHandler`: `ExternalDependencyHandler`
- `checkpointManager`: `CheckpointManager`
- `hooks`: `TaskAgentHooks | undefined`
- `config`: `PlanExecutorConfig`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `execute()`

Execute a plan

```typescript
async execute(plan: Plan, state: AgentState): Promise&lt;PlanExecutionResult&gt;
```

**Parameters:**
- `plan`: `Plan`
- `state`: `AgentState`

**Returns:** `Promise&lt;PlanExecutionResult&gt;`

#### `cancel()`

Cancel execution

```typescript
cancel(): void
```

**Returns:** `void`

#### `cleanup()`

Cleanup resources (alias for destroy, kept for backward compatibility)

```typescript
cleanup(): void
```

**Returns:** `void`

#### `destroy()`

Destroy the PlanExecutor instance
Removes all event listeners and clears internal state

```typescript
destroy(): void
```

**Returns:** `void`

#### `getIdempotencyCache()`

Get idempotency cache
Returns null if memory feature is disabled

```typescript
getIdempotencyCache(): IdempotencyCache | null
```

**Returns:** `IdempotencyCache | null`

#### `getRateLimiterMetrics()`

Get rate limiter metrics (if rate limiting is enabled)

```typescript
getRateLimiterMetrics():
```

**Returns:** `{ totalRequests: number; throttledRequests: number; totalWaitMs: number; avgWaitMs: number; } | null`

#### `resetRateLimiter()`

Reset rate limiter state (for testing or manual control)

```typescript
resetRateLimiter(): void
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agent` | `agent: Agent` | - |
| `agentContext` | `agentContext: AgentContext` | - |
| `planPlugin` | `planPlugin: PlanPlugin` | - |
| `externalHandler` | `externalHandler: ExternalDependencyHandler` | - |
| `checkpointManager` | `checkpointManager: CheckpointManager` | - |
| `hooks` | `hooks: TaskAgentHooks | undefined` | - |
| `config` | `config: PlanExecutorConfig` | - |
| `abortController` | `abortController: AbortController` | - |
| `rateLimiter?` | `rateLimiter: TokenBucketRateLimiter | undefined` | - |
| `currentMetrics` | `currentMetrics: { totalLLMCalls: number; totalToolCalls: number; totalTokensUsed: number; totalCost: number; }` | - |
| `currentState` | `currentState: AgentState | null` | - |

</details>

---

### PlanningAgent `class`

📍 [`src/capabilities/taskAgent/PlanningAgent.ts:90`](src/capabilities/taskAgent/PlanningAgent.ts)

PlanningAgent class

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
private constructor(config: PlanningAgentConfig)
```

**Parameters:**
- `config`: `PlanningAgentConfig`

</details>

<details>
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Create a new PlanningAgent

```typescript
static create(config: PlanningAgentConfig): PlanningAgent
```

**Parameters:**
- `config`: `PlanningAgentConfig`

**Returns:** `PlanningAgent`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `generatePlan()`

Generate a plan from a goal

```typescript
async generatePlan(input:
```

**Parameters:**
- `input`: `{ goal: string; context?: string | undefined; constraints?: string[] | undefined; }`

**Returns:** `Promise&lt;GeneratedPlan&gt;`

#### `refinePlan()`

Validate and refine an existing plan

```typescript
async refinePlan(plan: Plan, feedback: string): Promise&lt;GeneratedPlan&gt;
```

**Parameters:**
- `plan`: `Plan`
- `feedback`: `string`

**Returns:** `Promise&lt;GeneratedPlan&gt;`

#### `getCurrentTasks()`

Get current tasks (for tool access)

```typescript
getCurrentTasks(): TaskInput[]
```

**Returns:** `TaskInput[]`

#### `addTask()`

Add task (called by planning tools)

```typescript
addTask(task: TaskInput): void
```

**Parameters:**
- `task`: `TaskInput`

**Returns:** `void`

#### `updateTask()`

Update task (called by planning tools)

```typescript
updateTask(name: string, updates: Partial&lt;TaskInput&gt;): void
```

**Parameters:**
- `name`: `string`
- `updates`: `Partial&lt;TaskInput&gt;`

**Returns:** `void`

#### `removeTask()`

Remove task (called by planning tools)

```typescript
removeTask(name: string): void
```

**Parameters:**
- `name`: `string`

**Returns:** `void`

#### `finalizePlanning()`

Mark planning as complete

```typescript
finalizePlanning(): void
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agent` | `agent: Agent` | - |
| `config` | `config: PlanningAgentConfig` | - |
| `currentTasks` | `currentTasks: TaskInput[]` | - |
| `planningComplete` | `planningComplete: boolean` | - |

</details>

---

### TaskAgent `class`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:250`](src/capabilities/taskAgent/TaskAgent.ts)

TaskAgent - autonomous task-based agent.

Extends BaseAgent to inherit connector resolution, tool management,
permission management, session management, and lifecycle.

Features:
- Plan-driven execution
- Working memory with indexed access
- External dependency handling (webhooks, polling, manual)
- Suspend/resume capability
- State persistence for long-running agents

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
protected constructor(
    id: string,
    state: AgentState,
    agentStorage: IAgentStorage,
    config: TaskAgentConfig,
    hooks?: TaskAgentHooks
  )
```

**Parameters:**
- `id`: `string`
- `state`: `AgentState`
- `agentStorage`: `IAgentStorage`
- `config`: `TaskAgentConfig`
- `hooks`: `TaskAgentHooks | undefined` *(optional)*

</details>

<details>
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Create a new TaskAgent

```typescript
static create(config: TaskAgentConfig): TaskAgent
```

**Parameters:**
- `config`: `TaskAgentConfig`

**Returns:** `TaskAgent`

#### `static resume()`

Resume an existing agent from storage

```typescript
static async resume(
    agentId: string,
    options:
```

**Parameters:**
- `agentId`: `string`
- `options`: `{ storage: IAgentStorage; tools?: ToolFunction&lt;any, any&gt;[] | undefined; hooks?: TaskAgentHooks | undefined; session?: { storage: ISessionStorage; } | undefined; }`

**Returns:** `Promise&lt;TaskAgent&gt;`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `getAgentType()`

```typescript
protected getAgentType(): 'agent' | 'task-agent' | 'universal-agent'
```

**Returns:** `"agent" | "task-agent" | "universal-agent"`

#### `prepareSessionState()`

```typescript
protected prepareSessionState(): void
```

**Returns:** `void`

#### `restoreSessionState()`

```typescript
protected async restoreSessionState(session: Session): Promise&lt;void&gt;
```

**Parameters:**
- `session`: `Session`

**Returns:** `Promise&lt;void&gt;`

#### `getSerializedPlan()`

```typescript
protected getSerializedPlan(): SerializedPlan | undefined
```

**Returns:** `SerializedPlan | undefined`

#### `getSerializedMemory()`

```typescript
protected getSerializedMemory(): SerializedMemory | undefined
```

**Returns:** `SerializedMemory | undefined`

#### `saveSession()`

```typescript
async saveSession(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `hasContext()`

Check if context is available (components initialized).
Always true since AgentContext is created by BaseAgent constructor.

```typescript
hasContext(): boolean
```

**Returns:** `boolean`

#### `start()`

Start executing a plan

```typescript
async start(planInput: PlanInput): Promise&lt;AgentHandle&gt;
```

**Parameters:**
- `planInput`: `PlanInput`

**Returns:** `Promise&lt;AgentHandle&gt;`

#### `pause()`

Pause execution

```typescript
async pause(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `resume()`

Resume execution after pause
Note: Named resumeExecution to avoid conflict with BaseAgent if any

```typescript
async resume(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `cancel()`

Cancel execution

```typescript
async cancel(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `triggerExternal()`

Trigger external dependency completion

```typescript
async triggerExternal(webhookId: string, data: unknown): Promise&lt;void&gt;
```

**Parameters:**
- `webhookId`: `string`
- `data`: `unknown`

**Returns:** `Promise&lt;void&gt;`

#### `completeTaskManually()`

Manually complete a task

```typescript
async completeTaskManually(taskId: string, result: unknown): Promise&lt;void&gt;
```

**Parameters:**
- `taskId`: `string`
- `result`: `unknown`

**Returns:** `Promise&lt;void&gt;`

#### `updatePlan()`

Update the plan with validation

```typescript
async updatePlan(updates: PlanUpdates, options?: PlanUpdateOptions): Promise&lt;void&gt;
```

**Parameters:**
- `updates`: `PlanUpdates`
- `options`: `PlanUpdateOptions | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `getState()`

Get current agent state

```typescript
getState(): AgentState
```

**Returns:** `AgentState`

#### `getPlan()`

Get current plan

```typescript
getPlan(): Plan
```

**Returns:** `Plan`

#### `getMemory()`

Get working memory (from AgentContext - single source of truth)
Returns null if memory feature is disabled

```typescript
getMemory(): WorkingMemory | null
```

**Returns:** `WorkingMemory | null`

#### `executePlan()`

Execute the plan (internal)

```typescript
protected async executePlan(): Promise&lt;PlanResult&gt;
```

**Returns:** `Promise&lt;PlanResult&gt;`

#### `destroy()`

Cleanup resources

```typescript
async destroy(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string` | - |
| `state` | `state: AgentState` | - |
| `agentStorage` | `agentStorage: IAgentStorage` | - |
| `hooks?` | `hooks: TaskAgentHooks | undefined` | - |
| `executionPromise?` | `executionPromise: Promise&lt;PlanResult&gt; | undefined` | - |
| `agent?` | `agent: Agent | undefined` | - |
| `externalHandler?` | `externalHandler: ExternalDependencyHandler | undefined` | - |
| `planExecutor?` | `planExecutor: PlanExecutor | undefined` | - |
| `checkpointManager?` | `checkpointManager: CheckpointManager | undefined` | - |
| `eventCleanupFunctions` | `eventCleanupFunctions: (() =&gt; void)[]` | - |

</details>

---

### TaskTimeoutError `class`

📍 [`src/domain/errors/AIErrors.ts:197`](src/domain/errors/AIErrors.ts)

Error thrown when a task execution times out

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    public readonly taskId: string,
    public readonly taskName: string,
    public readonly timeoutMs: number
  )
```

**Parameters:**
- `taskId`: `string`
- `taskName`: `string`
- `timeoutMs`: `number`

</details>

---

### TaskValidationError `class`

📍 [`src/domain/errors/AIErrors.ts:216`](src/domain/errors/AIErrors.ts)

Error thrown when task completion validation fails

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    public readonly taskId: string,
    public readonly taskName: string,
    public readonly reason: string
  )
```

**Parameters:**
- `taskId`: `string`
- `taskName`: `string`
- `reason`: `string`

</details>

---

### WorkingMemory `class`

📍 [`src/capabilities/taskAgent/WorkingMemory.ts:80`](src/capabilities/taskAgent/WorkingMemory.ts)

WorkingMemory manages the agent's indexed working memory.

Features:
- Store/retrieve with descriptions for index
- Scoped memory (simple or task-aware)
- Priority-based eviction (respects pinned, priority, then LRU)
- Pluggable priority calculation via PriorityCalculator strategy
- Task completion detection and stale entry notification
- Event emission for monitoring

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

Create a WorkingMemory instance

```typescript
constructor(
    storage: IMemoryStorage,
    config: WorkingMemoryConfig = DEFAULT_MEMORY_CONFIG,
    priorityCalculator: PriorityCalculator = staticPriorityCalculator
  )
```

**Parameters:**
- `storage`: `IMemoryStorage`
- `config`: `WorkingMemoryConfig` *(optional)* (default: `DEFAULT_MEMORY_CONFIG`)
- `priorityCalculator`: `PriorityCalculator` *(optional)* (default: `staticPriorityCalculator`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `setPriorityCalculator()`

Set the priority calculator (for switching strategies at runtime)

```typescript
setPriorityCalculator(calculator: PriorityCalculator): void
```

**Parameters:**
- `calculator`: `PriorityCalculator`

**Returns:** `void`

#### `setPriorityContext()`

Update priority context (e.g., task states for TaskAgent)

```typescript
setPriorityContext(context: PriorityContext): void
```

**Parameters:**
- `context`: `PriorityContext`

**Returns:** `void`

#### `getPriorityContext()`

Get the current priority context

```typescript
getPriorityContext(): PriorityContext
```

**Returns:** `PriorityContext`

#### `store()`

Store a value in working memory

```typescript
async store(
    key: string,
    description: string,
    value: unknown,
    options?:
```

**Parameters:**
- `key`: `string`
- `description`: `string`
- `value`: `unknown`
- `options`: `{ scope?: MemoryScope | undefined; priority?: MemoryPriority | undefined; pinned?: boolean | undefined; } | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `storeForTasks()`

Store a value scoped to specific tasks
Convenience method for task-aware memory

```typescript
async storeForTasks(
    key: string,
    description: string,
    value: unknown,
    taskIds: string[],
    options?:
```

**Parameters:**
- `key`: `string`
- `description`: `string`
- `value`: `unknown`
- `taskIds`: `string[]`
- `options`: `{ priority?: MemoryPriority | undefined; pinned?: boolean | undefined; } | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `storeForPlan()`

Store a value scoped to the entire plan
Convenience method for plan-scoped memory

```typescript
async storeForPlan(
    key: string,
    description: string,
    value: unknown,
    options?:
```

**Parameters:**
- `key`: `string`
- `description`: `string`
- `value`: `unknown`
- `options`: `{ priority?: MemoryPriority | undefined; pinned?: boolean | undefined; } | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `retrieve()`

Retrieve a value from working memory

Note: Access stats update is not strictly atomic. Under very high concurrency,
accessCount may be slightly inaccurate. This is acceptable for memory management
purposes where exact counts are not critical.

```typescript
async retrieve(key: string): Promise&lt;unknown&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;unknown&gt;`

#### `retrieveMany()`

Retrieve multiple values

```typescript
async retrieveMany(keys: string[]): Promise&lt;Record&lt;string, unknown&gt;&gt;
```

**Parameters:**
- `keys`: `string[]`

**Returns:** `Promise&lt;Record&lt;string, unknown&gt;&gt;`

#### `delete()`

Delete a value from working memory

```typescript
async delete(key: string): Promise&lt;void&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `has()`

Check if key exists

```typescript
async has(key: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `persist()`

Promote an entry to persistent scope
Works with both simple and task-aware scopes

```typescript
async persist(key: string): Promise&lt;void&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `pin()`

Pin an entry (never evicted)

```typescript
async pin(key: string): Promise&lt;void&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `unpin()`

Unpin an entry

```typescript
async unpin(key: string, newPriority: MemoryPriority = 'normal'): Promise&lt;void&gt;
```

**Parameters:**
- `key`: `string`
- `newPriority`: `MemoryPriority` *(optional)* (default: `'normal'`)

**Returns:** `Promise&lt;void&gt;`

#### `setPriority()`

Set the base priority of an entry

```typescript
async setPriority(key: string, priority: MemoryPriority): Promise&lt;void&gt;
```

**Parameters:**
- `key`: `string`
- `priority`: `MemoryPriority`

**Returns:** `Promise&lt;void&gt;`

#### `updateScope()`

Update the scope of an entry without re-storing the value

```typescript
async updateScope(key: string, scope: MemoryScope): Promise&lt;void&gt;
```

**Parameters:**
- `key`: `string`
- `scope`: `MemoryScope`

**Returns:** `Promise&lt;void&gt;`

#### `addTasksToScope()`

Add task IDs to an existing task-scoped entry
If entry is not task-scoped, converts it to task-scoped

```typescript
async addTasksToScope(key: string, taskIds: string[]): Promise&lt;void&gt;
```

**Parameters:**
- `key`: `string`
- `taskIds`: `string[]`

**Returns:** `Promise&lt;void&gt;`

#### `clearScope()`

Clear all entries of a specific scope

```typescript
async clearScope(scope: MemoryScope): Promise&lt;void&gt;
```

**Parameters:**
- `scope`: `MemoryScope`

**Returns:** `Promise&lt;void&gt;`

#### `clear()`

Clear all entries

```typescript
async clear(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `getIndex()`

Get memory index with computed effective priorities

```typescript
async getIndex(): Promise&lt;MemoryIndex&gt;
```

**Returns:** `Promise&lt;MemoryIndex&gt;`

#### `formatIndex()`

Format index for context injection

```typescript
async formatIndex(): Promise&lt;string&gt;
```

**Returns:** `Promise&lt;string&gt;`

#### `evict()`

Evict entries using specified strategy

Eviction order:
1. Never evict pinned entries
2. Evict low priority first, then normal, then high (never critical)
3. Within same priority, use strategy (LRU or largest size)

```typescript
async evict(count: number, strategy: EvictionStrategy = 'lru'): Promise&lt;string[]&gt;
```

**Parameters:**
- `count`: `number`
- `strategy`: `EvictionStrategy` *(optional)* (default: `'lru'`)

**Returns:** `Promise&lt;string[]&gt;`

#### `evictLRU()`

Evict entries using priority-aware LRU algorithm

```typescript
async evictLRU(count: number): Promise&lt;string[]&gt;
```

**Parameters:**
- `count`: `number`

**Returns:** `Promise&lt;string[]&gt;`

#### `evictBySize()`

Evict largest entries first (priority-aware)

```typescript
async evictBySize(count: number): Promise&lt;string[]&gt;
```

**Parameters:**
- `count`: `number`

**Returns:** `Promise&lt;string[]&gt;`

#### `onTaskComplete()`

Handle task completion - detect and notify about stale entries

Call this when a task completes to:
1. Update priority context with new task state
2. Detect entries that became stale
3. Emit event to notify LLM about stale entries

```typescript
async onTaskComplete(
    taskId: string,
    taskStates: Map&lt;string, TaskStatusForMemory&gt;
  ): Promise&lt;StaleEntryInfo[]&gt;
```

**Parameters:**
- `taskId`: `string`
- `taskStates`: `Map&lt;string, TaskStatusForMemory&gt;`

**Returns:** `Promise&lt;StaleEntryInfo[]&gt;`

#### `evictCompletedTaskEntries()`

Evict entries for completed tasks

Removes entries that were scoped only to completed tasks.
Use after onTaskComplete() if you want automatic cleanup.

```typescript
async evictCompletedTaskEntries(
    taskStates: Map&lt;string, TaskStatusForMemory&gt;
  ): Promise&lt;string[]&gt;
```

**Parameters:**
- `taskStates`: `Map&lt;string, TaskStatusForMemory&gt;`

**Returns:** `Promise&lt;string[]&gt;`

#### `getAccess()`

Get limited memory access for tools

This provides a simplified interface for tools to interact with memory
without exposing the full WorkingMemory API.

```typescript
getAccess(): WorkingMemoryAccess
```

**Returns:** `WorkingMemoryAccess`

#### `storeRaw()`

Store raw data (low priority, first to be evicted)

Use this for original/unprocessed data that should be summarized.
Raw data is automatically evicted first when memory pressure is high.

```typescript
async storeRaw(
    key: string,
    description: string,
    value: unknown,
    options?:
```

**Parameters:**
- `key`: `string`
- `description`: `string`
- `value`: `unknown`
- `options`: `{ taskIds?: string[] | undefined; scope?: MemoryScope | undefined; } | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `storeSummary()`

Store a summary derived from raw data (normal priority)

Use this for processed/summarized data that extracts key information.
Links back to source data for cleanup tracking.

```typescript
async storeSummary(
    key: string,
    description: string,
    value: unknown,
    derivedFrom: string | string[],
    options?:
```

**Parameters:**
- `key`: `string`
- `description`: `string`
- `value`: `unknown`
- `derivedFrom`: `string | string[]`
- `options`: `{ taskIds?: string[] | undefined; scope?: MemoryScope | undefined; } | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `storeFindings()`

Store final findings (high priority, kept longest)

Use this for conclusions, insights, or final results that should be preserved.
These are the last to be evicted and typically span the entire plan.

```typescript
async storeFindings(
    key: string,
    description: string,
    value: unknown,
    _derivedFrom?: string | string[],
    options?:
```

**Parameters:**
- `key`: `string`
- `description`: `string`
- `value`: `unknown`
- `_derivedFrom`: `string | string[] | undefined` *(optional)*
- `options`: `{ taskIds?: string[] | undefined; scope?: MemoryScope | undefined; pinned?: boolean | undefined; } | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `cleanupRawData()`

Clean up raw data after summary/findings are created

Call this after creating summaries to free up memory used by raw data.
Only deletes entries in the 'raw' tier.

```typescript
async cleanupRawData(derivedFromKeys: string[]): Promise&lt;number&gt;
```

**Parameters:**
- `derivedFromKeys`: `string[]`

**Returns:** `Promise&lt;number&gt;`

#### `getByTier()`

Get all entries by tier

```typescript
async getByTier(tier: MemoryTier): Promise&lt;MemoryEntry[]&gt;
```

**Parameters:**
- `tier`: `MemoryTier`

**Returns:** `Promise&lt;MemoryEntry[]&gt;`

#### `promote()`

Promote an entry to a higher tier

Changes the key prefix and updates priority.
Use this when raw data becomes more valuable (e.g., frequently accessed).

```typescript
async promote(key: string, toTier: MemoryTier): Promise&lt;string&gt;
```

**Parameters:**
- `key`: `string`
- `toTier`: `MemoryTier`

**Returns:** `Promise&lt;string&gt;`

#### `getTierStats()`

Get tier statistics

```typescript
async getTierStats(): Promise&lt;Record&lt;MemoryTier,
```

**Returns:** `Promise&lt;Record&lt;MemoryTier, { count: number; sizeBytes: number; }&gt;&gt;`

#### `getStats()`

Get statistics about memory usage

```typescript
async getStats(): Promise&lt;
```

**Returns:** `Promise&lt;{ totalEntries: number; totalSizeBytes: number; utilizationPercent: number; byPriority: Record&lt;MemoryPriority, number&gt;; pinnedCount: number; }&gt;`

#### `getLimit()`

Get the configured memory limit

```typescript
getLimit(): number
```

**Returns:** `number`

#### `destroy()`

Destroy the WorkingMemory instance
Removes all event listeners and clears internal state

```typescript
destroy(): void
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `storage` | `storage: IMemoryStorage` | - |
| `config` | `config: WorkingMemoryConfig` | - |
| `priorityCalculator` | `priorityCalculator: PriorityCalculator` | - |
| `priorityContext` | `priorityContext: PriorityContext` | - |

</details>

---

### AgentHandle `interface`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:143`](src/capabilities/taskAgent/TaskAgent.ts)

Agent handle returned from start()

<details>
<summary><strong>Methods</strong></summary>

#### `wait()`

Wait for completion

```typescript
wait(): Promise&lt;PlanResult&gt;;
```

**Returns:** `Promise&lt;PlanResult&gt;`

#### `status()`

Get current status

```typescript
status(): AgentStatus;
```

**Returns:** `AgentStatus`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agentId` | `agentId: string;` | - |
| `planId` | `planId: string;` | - |

</details>

---

### CheckpointStrategy `interface`

📍 [`src/capabilities/taskAgent/CheckpointManager.ts:8`](src/capabilities/taskAgent/CheckpointManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `afterToolCalls?` | `afterToolCalls?: number;` | Checkpoint after every N tool calls |
| `afterLLMCalls?` | `afterLLMCalls?: number;` | Checkpoint after every N LLM calls |
| `intervalMs?` | `intervalMs?: number;` | Checkpoint on time interval |
| `beforeExternalWait` | `beforeExternalWait: boolean;` | Always checkpoint before external wait |
| `mode` | `mode: 'sync' | 'async';` | Checkpoint mode |

</details>

---

### ErrorContext `interface`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:119`](src/capabilities/taskAgent/TaskAgent.ts)

Error context

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `task?` | `task?: Task;` | - |
| `error` | `error: Error;` | - |
| `phase` | `phase: 'tool' | 'llm' | 'execution';` | - |

</details>

---

### ExternalDependency `interface`

📍 [`src/domain/entities/Task.ts:70`](src/domain/entities/Task.ts)

External dependency configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'webhook' | 'poll' | 'manual' | 'scheduled';` | - |
| `webhookId?` | `webhookId?: string;` | For webhook: unique ID to match incoming webhook |
| `pollConfig?` | `pollConfig?: {
    toolName: string;
    toolArgs: Record&lt;string, unknown&gt;;
    intervalMs: number;
    maxAttempts: number;
  };` | For poll: how to check if complete |
| `scheduledAt?` | `scheduledAt?: number;` | For scheduled: when to resume |
| `manualDescription?` | `manualDescription?: string;` | For manual: description of what's needed |
| `timeoutMs?` | `timeoutMs?: number;` | Timeout for all types |
| `state` | `state: 'waiting' | 'received' | 'timeout';` | Current state |
| `receivedData?` | `receivedData?: unknown;` | Data received from external source |
| `receivedAt?` | `receivedAt?: number;` | - |

</details>

---

### ExternalDependencyEvents `interface`

📍 [`src/capabilities/taskAgent/ExternalDependencyHandler.ts:10`](src/capabilities/taskAgent/ExternalDependencyHandler.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'webhook:received'` | `'webhook:received': { webhookId: string; data: unknown };` | - |
| `'poll:success'` | `'poll:success': { taskId: string; data: unknown };` | - |
| `'poll:timeout'` | `'poll:timeout': { taskId: string };` | - |
| `'scheduled:triggered'` | `'scheduled:triggered': { taskId: string };` | - |
| `'manual:completed'` | `'manual:completed': { taskId: string; data: unknown };` | - |

</details>

---

### GeneratedPlan `interface`

📍 [`src/capabilities/taskAgent/PlanningAgent.ts:36`](src/capabilities/taskAgent/PlanningAgent.ts)

Generated plan with metadata

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `plan` | `plan: Plan;` | - |
| `reasoning` | `reasoning: string;` | - |
| `estimated_duration?` | `estimated_duration?: string;` | - |
| `complexity?` | `complexity?: 'low' | 'medium' | 'high';` | - |

</details>

---

### IMemoryStorage `interface`

📍 [`src/domain/interfaces/IMemoryStorage.ts:14`](src/domain/interfaces/IMemoryStorage.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `get()`

Get entry by key

```typescript
get(key: string): Promise&lt;MemoryEntry | undefined&gt;;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;MemoryEntry | undefined&gt;`

#### `set()`

Set/update entry

```typescript
set(key: string, entry: MemoryEntry): Promise&lt;void&gt;;
```

**Parameters:**
- `key`: `string`
- `entry`: `MemoryEntry`

**Returns:** `Promise&lt;void&gt;`

#### `delete()`

Delete entry

```typescript
delete(key: string): Promise&lt;void&gt;;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `has()`

Check if key exists

```typescript
has(key: string): Promise&lt;boolean&gt;;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `getAll()`

Get all entries

```typescript
getAll(): Promise&lt;MemoryEntry[]&gt;;
```

**Returns:** `Promise&lt;MemoryEntry[]&gt;`

#### `getByScope()`

Get entries by scope

```typescript
getByScope(scope: MemoryScope): Promise&lt;MemoryEntry[]&gt;;
```

**Parameters:**
- `scope`: `MemoryScope`

**Returns:** `Promise&lt;MemoryEntry[]&gt;`

#### `clearScope()`

Clear all entries with given scope

```typescript
clearScope(scope: MemoryScope): Promise&lt;void&gt;;
```

**Parameters:**
- `scope`: `MemoryScope`

**Returns:** `Promise&lt;void&gt;`

#### `clear()`

Clear everything

```typescript
clear(): Promise&lt;void&gt;;
```

**Returns:** `Promise&lt;void&gt;`

#### `getTotalSize()`

Get total size in bytes

```typescript
getTotalSize(): Promise&lt;number&gt;;
```

**Returns:** `Promise&lt;number&gt;`

</details>

---

### InContextMemoryConfig `interface`

📍 [`src/core/context/plugins/InContextMemoryPlugin.ts:40`](src/core/context/plugins/InContextMemoryPlugin.ts)

Configuration for InContextMemoryPlugin

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxEntries?` | `maxEntries?: number;` | Maximum number of entries (default: 20) |
| `maxTotalTokens?` | `maxTotalTokens?: number;` | Maximum total tokens for all entries (default: 4000) |
| `defaultPriority?` | `defaultPriority?: InContextPriority;` | Default priority for new entries (default: 'normal') |
| `showTimestamps?` | `showTimestamps?: boolean;` | Whether to show timestamps in output (default: false) |
| `headerText?` | `headerText?: string;` | Header text for the context section (default: '## Live Context') |

</details>

---

### IPlanStorage `interface`

📍 [`src/domain/interfaces/IPlanStorage.ts:8`](src/domain/interfaces/IPlanStorage.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `savePlan()`

Save or update a plan

```typescript
savePlan(plan: Plan): Promise&lt;void&gt;;
```

**Parameters:**
- `plan`: `Plan`

**Returns:** `Promise&lt;void&gt;`

#### `getPlan()`

Get plan by ID

```typescript
getPlan(planId: string): Promise&lt;Plan | undefined&gt;;
```

**Parameters:**
- `planId`: `string`

**Returns:** `Promise&lt;Plan | undefined&gt;`

#### `updateTask()`

Update a specific task within a plan

```typescript
updateTask(planId: string, task: Task): Promise&lt;void&gt;;
```

**Parameters:**
- `planId`: `string`
- `task`: `Task`

**Returns:** `Promise&lt;void&gt;`

#### `addTask()`

Add a new task to a plan (for dynamic task creation)

```typescript
addTask(planId: string, task: Task): Promise&lt;void&gt;;
```

**Parameters:**
- `planId`: `string`
- `task`: `Task`

**Returns:** `Promise&lt;void&gt;`

#### `deletePlan()`

Delete a plan

```typescript
deletePlan(planId: string): Promise&lt;void&gt;;
```

**Parameters:**
- `planId`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `listPlans()`

List plans by status

```typescript
listPlans(filter?: { status?: PlanStatus[] }): Promise&lt;Plan[]&gt;;
```

**Parameters:**
- `filter`: `{ status?: PlanStatus[] | undefined; } | undefined` *(optional)*

**Returns:** `Promise&lt;Plan[]&gt;`

#### `findByWebhookId()`

Find plans with tasks waiting on a specific webhook

```typescript
findByWebhookId(webhookId: string): Promise&lt;{ plan: Plan; task: Task } | undefined&gt;;
```

**Parameters:**
- `webhookId`: `string`

**Returns:** `Promise&lt;{ plan: Plan; task: Task; } | undefined&gt;`

</details>

---

### MemoryEntry `interface`

📍 [`src/domain/entities/Memory.ts:380`](src/domain/entities/Memory.ts)

Single memory entry stored in working memory

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `key` | `key: string;` | - |
| `description` | `description: string;` | - |
| `value` | `value: unknown;` | - |
| `sizeBytes` | `sizeBytes: number;` | - |
| `scope` | `scope: MemoryScope;` | - |
| `basePriority` | `basePriority: MemoryPriority;` | - |
| `pinned` | `pinned: boolean;` | - |
| `createdAt` | `createdAt: number;` | - |
| `lastAccessedAt` | `lastAccessedAt: number;` | - |
| `accessCount` | `accessCount: number;` | - |

</details>

---

### MemoryEntryInput `interface`

📍 [`src/domain/entities/Memory.ts:437`](src/domain/entities/Memory.ts)

Input for creating a memory entry

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `key` | `key: string;` | - |
| `description` | `description: string;` | - |
| `value` | `value: unknown;` | - |
| `scope?` | `scope?: MemoryScope;` | Scope - defaults to 'session' for basic agents |
| `priority?` | `priority?: MemoryPriority;` | Base priority - may be overridden by dynamic calculation |
| `pinned?` | `pinned?: boolean;` | If true, entry is never evicted |

</details>

---

### MemoryIndex `interface`

📍 [`src/domain/entities/Memory.ts:408`](src/domain/entities/Memory.ts)

Full memory index with metadata

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `entries` | `entries: MemoryIndexEntry[];` | - |
| `totalSizeBytes` | `totalSizeBytes: number;` | - |
| `totalSizeHuman` | `totalSizeHuman: string;` | - |
| `limitBytes` | `limitBytes: number;` | - |
| `limitHuman` | `limitHuman: string;` | - |
| `utilizationPercent` | `utilizationPercent: number;` | - |

</details>

---

### MemoryIndexEntry `interface`

📍 [`src/domain/entities/Memory.ts:396`](src/domain/entities/Memory.ts)

Index entry (lightweight, always in context)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `key` | `key: string;` | - |
| `description` | `description: string;` | - |
| `size` | `size: string;` | - |
| `scope` | `scope: MemoryScope;` | - |
| `effectivePriority` | `effectivePriority: MemoryPriority;` | - |
| `pinned` | `pinned: boolean;` | - |

</details>

---

### Plan `interface`

📍 [`src/domain/entities/Task.ts:305`](src/domain/entities/Task.ts)

Execution plan - a goal with steps to achieve it

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | - |
| `goal` | `goal: string;` | - |
| `context?` | `context?: string;` | - |
| `tasks` | `tasks: Task[];` | - |
| `concurrency?` | `concurrency?: PlanConcurrency;` | Concurrency settings |
| `allowDynamicTasks` | `allowDynamicTasks: boolean;` | Can agent modify the plan? |
| `status` | `status: PlanStatus;` | Plan status |
| `suspendedReason?` | `suspendedReason?: {
    type: 'waiting_external' | 'manual_pause' | 'error';
    taskId?: string;
    message?: string;
  };` | Why is the plan suspended? |
| `createdAt` | `createdAt: number;` | Timestamps |
| `startedAt?` | `startedAt?: number;` | - |
| `completedAt?` | `completedAt?: number;` | - |
| `lastUpdatedAt` | `lastUpdatedAt: number;` | - |
| `currentTaskId?` | `currentTaskId?: string;` | For resume: which task to continue from |
| `metadata?` | `metadata?: Record&lt;string, unknown&gt;;` | Metadata |

</details>

---

### PlanChange `interface`

📍 [`src/capabilities/universalAgent/types.ts:174`](src/capabilities/universalAgent/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'task_added' | 'task_removed' | 'task_updated' | 'task_reordered';` | - |
| `taskId?` | `taskId?: string;` | - |
| `taskName?` | `taskName?: string;` | - |
| `details?` | `details?: string;` | - |

</details>

---

### PlanConcurrency `interface`

📍 [`src/domain/entities/Task.ts:289`](src/domain/entities/Task.ts)

Plan concurrency settings

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxParallelTasks` | `maxParallelTasks: number;` | - |
| `strategy` | `strategy: 'fifo' | 'priority' | 'shortest-first';` | - |
| `failureMode?` | `failureMode?: 'fail-fast' | 'continue' | 'fail-all';` | How to handle failures when executing tasks in parallel
- 'fail-fast': Stop on first failure (Promise.all behavior) - DEFAULT
- 'continue': Continue other tasks on failure, mark failed ones
- 'fail-all': Wait for all to complete, then report all failures together |

</details>

---

### PlanExecutionResult `interface`

📍 [`src/capabilities/taskAgent/PlanExecutor.ts:59`](src/capabilities/taskAgent/PlanExecutor.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `status` | `status: 'completed' | 'failed' | 'suspended';` | - |
| `completedTasks` | `completedTasks: number;` | - |
| `failedTasks` | `failedTasks: number;` | - |
| `skippedTasks` | `skippedTasks: number;` | - |
| `error?` | `error?: Error;` | - |
| `metrics` | `metrics: {
    totalLLMCalls: number;
    totalToolCalls: number;
    totalTokensUsed: number;
    totalCost: number;
  };` | - |

</details>

---

### PlanExecutorConfig `interface`

📍 [`src/capabilities/taskAgent/PlanExecutor.ts:29`](src/capabilities/taskAgent/PlanExecutor.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxIterations` | `maxIterations: number;` | - |
| `taskTimeout?` | `taskTimeout?: number;` | - |
| `rateLimiter?` | `rateLimiter?: {
    /** Max requests per minute (default: 60) */
    maxRequestsPerMinute?: number;
    /** What to do when rate limited: 'wait' or 'throw' (default: 'wait') */
    onLimit?: 'wait' | 'throw';
    /** Max wait time in ms (for 'wait' mode, default: 60000) */
    maxWaitMs?: number;
  };` | Rate limiting configuration for LLM calls |

</details>

---

### PlanExecutorEvents `interface`

📍 [`src/capabilities/taskAgent/PlanExecutor.ts:44`](src/capabilities/taskAgent/PlanExecutor.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'task:start'` | `'task:start': { task: Task };` | - |
| `'task:complete'` | `'task:complete': { task: Task; result: any };` | - |
| `'task:failed'` | `'task:failed': { task: Task; error: Error };` | - |
| `'task:skipped'` | `'task:skipped': { task: Task; reason: string };` | - |
| `'task:timeout'` | `'task:timeout': { task: Task; timeoutMs: number };` | - |
| `'task:validation_failed'` | `'task:validation_failed': { task: Task; validation: TaskValidationResult };` | - |
| `'task:validation_uncertain'` | `'task:validation_uncertain': { task: Task; validation: TaskValidationResult };` | - |
| `'task:waiting_external'` | `'task:waiting_external': { task: Task };` | - |
| `'memory:stale_entries'` | `'memory:stale_entries': { entries: StaleEntryInfo[]; taskId: string };` | - |
| `'llm:call'` | `'llm:call': { iteration: number };` | - |
| `'tool:call'` | `'tool:call': { toolName: string; args: any };` | - |
| `'tool:result'` | `'tool:result': { toolName: string; result: any };` | - |

</details>

---

### PlanInput `interface`

📍 [`src/domain/entities/Task.ts:344`](src/domain/entities/Task.ts)

Input for creating a plan

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `goal` | `goal: string;` | - |
| `context?` | `context?: string;` | - |
| `tasks` | `tasks: TaskInput[];` | - |
| `concurrency?` | `concurrency?: PlanConcurrency;` | - |
| `allowDynamicTasks?` | `allowDynamicTasks?: boolean;` | - |
| `metadata?` | `metadata?: Record&lt;string, unknown&gt;;` | - |
| `skipCycleCheck?` | `skipCycleCheck?: boolean;` | Skip dependency cycle detection (default: false) |

</details>

---

### PlanningAgentConfig `interface`

📍 [`src/capabilities/taskAgent/PlanningAgent.ts:16`](src/capabilities/taskAgent/PlanningAgent.ts)

PlanningAgent configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `connector` | `connector: string | Connector;` | Connector for LLM access |
| `model` | `model: string;` | Model to use for planning (can be different/cheaper than execution) |
| `maxPlanningIterations?` | `maxPlanningIterations?: number;` | Max planning iterations |
| `planningTemperature?` | `planningTemperature?: number;` | Temperature for planning (lower = more deterministic) |
| `availableTools?` | `availableTools?: ToolFunction[];` | Tools available for the plan (used to inform planning) |

</details>

---

### PlanResult `interface`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:128`](src/capabilities/taskAgent/TaskAgent.ts)

Plan result

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `status` | `status: 'completed' | 'failed' | 'cancelled';` | - |
| `output?` | `output?: unknown;` | - |
| `error?` | `error?: string;` | - |
| `metrics` | `metrics: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    skippedTasks: number;
  };` | - |

</details>

---

### PlanUpdateOptions `interface`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:166`](src/capabilities/taskAgent/TaskAgent.ts)

Options for plan update validation

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `allowRemoveActiveTasks?` | `allowRemoveActiveTasks?: boolean;` | Allow removing tasks that are currently in_progress. |
| `validateCycles?` | `validateCycles?: boolean;` | Validate that no dependency cycles exist after the update. |

</details>

---

### PlanUpdates `interface`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:157`](src/capabilities/taskAgent/TaskAgent.ts)

Plan updates specification

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `addTasks?` | `addTasks?: TaskInput[];` | - |
| `updateTasks?` | `updateTasks?: Array&lt;{ id: string } & Partial&lt;Task&gt;&gt;;` | - |
| `removeTasks?` | `removeTasks?: string[];` | - |

</details>

---

### ResearchPlan `interface`

📍 [`src/capabilities/researchAgent/types.ts:179`](src/capabilities/researchAgent/types.ts)

Research plan for systematic research

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `goal` | `goal: string;` | Research goal/question |
| `queries` | `queries: ResearchQuery[];` | Queries to execute |
| `sources?` | `sources?: string[];` | Sources to use (empty = all available) |
| `maxResultsPerQuery?` | `maxResultsPerQuery?: number;` | Maximum results per query |
| `maxTotalFindings?` | `maxTotalFindings?: number;` | Maximum total findings |

</details>

---

### SerializedInContextMemoryState `interface`

📍 [`src/core/context/plugins/InContextMemoryPlugin.ts:56`](src/core/context/plugins/InContextMemoryPlugin.ts)

Serialized state for session persistence

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `entries` | `entries: InContextEntry[];` | - |
| `config` | `config: InContextMemoryConfig;` | - |

</details>

---

### SerializedMemory `interface`

📍 [`src/core/SessionManager.ts:149`](src/core/SessionManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `version` | `version: number;` | Memory format version |
| `entries` | `entries: SerializedMemoryEntry[];` | Serialized memory entries |

</details>

---

### SerializedMemoryEntry `interface`

📍 [`src/core/SessionManager.ts:156`](src/core/SessionManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `key` | `key: string;` | - |
| `description` | `description: string;` | - |
| `value` | `value: unknown;` | - |
| `scope` | `scope: MemoryScope;` | - |
| `sizeBytes` | `sizeBytes: number;` | - |
| `basePriority?` | `basePriority?: MemoryPriority;` | - |
| `pinned?` | `pinned?: boolean;` | - |

</details>

---

### SerializedPlan `interface`

📍 [`src/core/SessionManager.ts:166`](src/core/SessionManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `version` | `version: number;` | Plan format version |
| `data` | `data: unknown;` | Plan data |

</details>

---

### Task `interface`

📍 [`src/domain/entities/Task.ts:220`](src/domain/entities/Task.ts)

A single unit of work

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | - |
| `name` | `name: string;` | - |
| `description` | `description: string;` | - |
| `status` | `status: TaskStatus;` | - |
| `dependsOn` | `dependsOn: string[];` | Tasks that must complete before this one (task IDs) |
| `externalDependency?` | `externalDependency?: ExternalDependency;` | External dependency (if waiting on external event) |
| `condition?` | `condition?: TaskCondition;` | Condition for execution |
| `execution?` | `execution?: TaskExecution;` | Execution settings |
| `validation?` | `validation?: TaskValidation;` | Completion validation settings |
| `expectedOutput?` | `expectedOutput?: string;` | Optional expected output description |
| `result?` | `result?: {
    success: boolean;
    output?: unknown;
    error?: string;
    /** Validation score (0-100) if validation was performed */
    validationScore?: number;
    /** Explanation of validation result */
    validationExplanation?: string;
  };` | Result after completion |
| `createdAt` | `createdAt: number;` | Timestamps |
| `startedAt?` | `startedAt?: number;` | - |
| `completedAt?` | `completedAt?: number;` | - |
| `lastUpdatedAt` | `lastUpdatedAt: number;` | - |
| `attempts` | `attempts: number;` | Retry tracking |
| `maxAttempts` | `maxAttempts: number;` | - |
| `metadata?` | `metadata?: Record&lt;string, unknown&gt;;` | Metadata for extensions |

</details>

---

### TaskAgentConfig `interface`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:190`](src/capabilities/taskAgent/TaskAgent.ts)

TaskAgent configuration - extends BaseAgentConfig

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `instructions?` | `instructions?: string;` | System instructions for the agent |
| `temperature?` | `temperature?: number;` | Temperature for generation |
| `maxIterations?` | `maxIterations?: number;` | Maximum iterations for tool calling loop |
| `storage?` | `storage?: IAgentStorage;` | Storage for persistence (agent state, checkpoints) |
| `memoryConfig?` | `memoryConfig?: WorkingMemoryConfig;` | Memory configuration |
| `hooks?` | `hooks?: TaskAgentHooks;` | Hooks for customization |
| `session?` | `session?: TaskAgentSessionConfig;` | Session configuration - extends base type |
| `permissions?` | `permissions?: AgentPermissionsConfig;` | Permission configuration for tool execution approval |

</details>

---

### TaskAgentHooks `interface`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:50`](src/capabilities/taskAgent/TaskAgent.ts)

TaskAgent hooks for customization

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `onStart?` | `onStart?: (agent: TaskAgent, plan: Plan) =&gt; Promise&lt;void&gt;;` | Before agent starts executing |
| `beforeTask?` | `beforeTask?: (task: Task, context: TaskContext) =&gt; Promise&lt;void | 'skip'&gt;;` | Before each task starts |
| `afterTask?` | `afterTask?: (task: Task, result: TaskResult) =&gt; Promise&lt;void&gt;;` | After each task completes |
| `validateTask?` | `validateTask?: (
    task: Task,
    result: TaskResult,
    memory: WorkingMemory
  ) =&gt; Promise&lt;TaskValidationResult | boolean | string&gt;;` | Validate task completion with custom logic.
Called after task execution to verify the task achieved its goal.

Return values:
- `TaskValidationResult`: Full validation result with score and details
- `true`: Task is complete
- `false`: Task failed validation (will use default error message)
- `string`: Task failed validation with custom reason

If not provided, the default LLM self-reflection validation is used
(when task.validation is configured). |
| `beforeLLMCall?` | `beforeLLMCall?: (messages: any[], options: any) =&gt; Promise&lt;any[]&gt;;` | Before each LLM call |
| `afterLLMCall?` | `afterLLMCall?: (response: any) =&gt; Promise&lt;void&gt;;` | After each LLM response |
| `beforeTool?` | `beforeTool?: (tool: ToolFunction, args: unknown) =&gt; Promise&lt;unknown&gt;;` | Before each tool execution |
| `afterTool?` | `afterTool?: (tool: ToolFunction, args: unknown, result: unknown) =&gt; Promise&lt;unknown&gt;;` | After tool execution |
| `onError?` | `onError?: (error: Error, context: ErrorContext) =&gt; Promise&lt;'retry' | 'fail' | 'skip'&gt;;` | On any error |
| `onComplete?` | `onComplete?: (result: PlanResult) =&gt; Promise&lt;void&gt;;` | On agent completion |

</details>

---

### TaskAgentSessionConfig `interface`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:183`](src/capabilities/taskAgent/TaskAgent.ts)

Session configuration for TaskAgent - extends BaseSessionConfig

---

### TaskCondition `interface`

📍 [`src/domain/entities/Task.ts:60`](src/domain/entities/Task.ts)

Task condition - evaluated before execution

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `memoryKey` | `memoryKey: string;` | - |
| `operator` | `operator: ConditionOperator;` | - |
| `value?` | `value?: unknown;` | - |
| `onFalse` | `onFalse: 'skip' | 'fail' | 'wait';` | - |

</details>

---

### TaskContext `interface`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:101`](src/capabilities/taskAgent/TaskAgent.ts)

Task execution context

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `taskId` | `taskId: string;` | - |
| `taskName` | `taskName: string;` | - |
| `attempt` | `attempt: number;` | - |

</details>

---

### TaskExecution `interface`

📍 [`src/domain/entities/Task.ts:104`](src/domain/entities/Task.ts)

Task execution settings

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `parallel?` | `parallel?: boolean;` | Can run in parallel with other parallel tasks |
| `maxConcurrency?` | `maxConcurrency?: number;` | Max concurrent if this spawns sub-work |
| `priority?` | `priority?: number;` | Priority (higher = executed first) |
| `raceProtection?` | `raceProtection?: boolean;` | If true (default), re-check condition immediately before LLM call
to protect against race conditions when parallel tasks modify memory.
Set to false to skip re-check for performance if you know condition won't change. |

</details>

---

### TaskFailure `interface`

📍 [`src/domain/errors/AIErrors.ts:235`](src/domain/errors/AIErrors.ts)

Task failure info for parallel execution

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `taskId` | `taskId: string;` | - |
| `taskName` | `taskName: string;` | - |
| `error` | `error: Error;` | - |

</details>

---

### TaskInput `interface`

📍 [`src/domain/entities/Task.ts:272`](src/domain/entities/Task.ts)

Input for creating a task

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id?` | `id?: string;` | - |
| `name` | `name: string;` | - |
| `description` | `description: string;` | - |
| `dependsOn?` | `dependsOn?: string[];` | - |
| `externalDependency?` | `externalDependency?: ExternalDependency;` | - |
| `condition?` | `condition?: TaskCondition;` | - |
| `execution?` | `execution?: TaskExecution;` | - |
| `validation?` | `validation?: TaskValidation;` | - |
| `expectedOutput?` | `expectedOutput?: string;` | - |
| `maxAttempts?` | `maxAttempts?: number;` | - |
| `metadata?` | `metadata?: Record&lt;string, unknown&gt;;` | - |

</details>

---

### TaskProgress `interface`

📍 [`src/capabilities/universalAgent/types.ts:82`](src/capabilities/universalAgent/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `completed` | `completed: number;` | - |
| `total` | `total: number;` | - |
| `current?` | `current?: Task;` | - |
| `failed` | `failed: number;` | - |
| `skipped` | `skipped: number;` | - |

</details>

---

### TaskResult `interface`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:110`](src/capabilities/taskAgent/TaskAgent.ts)

Task result

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `output?` | `output?: unknown;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### TaskValidation `interface`

📍 [`src/domain/entities/Task.ts:131`](src/domain/entities/Task.ts)

Task completion validation settings

Used to verify that a task actually achieved its goal before marking it complete.
Supports multiple validation approaches:
- Programmatic checks (memory keys, hooks)
- LLM self-reflection with completeness scoring
- Natural language criteria evaluation

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `completionCriteria?` | `completionCriteria?: string[];` | Natural language completion criteria.
These are evaluated by LLM self-reflection to determine if the task is complete.
Examples:
- "The response contains at least 3 specific examples"
- "User's email has been validated and stored in memory"
- "All requested data fields are present in the output"

This is the RECOMMENDED approach for flexible, intelligent validation. |
| `minCompletionScore?` | `minCompletionScore?: number;` | Minimum completeness score (0-100) to consider task successful.
LLM self-reflection returns a score; if below this threshold:
- If requireUserApproval is set, ask user
- Otherwise, follow the mode setting (strict = fail, warn = continue)
Default: 80 |
| `requireUserApproval?` | `requireUserApproval?: 'never' | 'uncertain' | 'always';` | When to require user approval:
- 'never': Never ask user, use automated decision (default)
- 'uncertain': Ask user when score is between minCompletionScore and minCompletionScore + 15
- 'always': Always ask user to confirm task completion |
| `requiredMemoryKeys?` | `requiredMemoryKeys?: string[];` | Memory keys that must exist after task completion.
If the task should store data in memory, list the required keys here.
This is a hard requirement checked BEFORE LLM reflection. |
| `customValidator?` | `customValidator?: string;` | Custom validation function name (registered via validateTask hook).
The hook will be called with this identifier to dispatch to the right validator.
Runs AFTER LLM reflection, can override the result. |
| `mode?` | `mode?: 'strict' | 'warn';` | Validation mode:
- 'strict': Validation failure marks task as failed (default)
- 'warn': Validation failure logs warning but task still completes |
| `skipReflection?` | `skipReflection?: boolean;` | Skip LLM self-reflection validation.
Set to true if you only want programmatic validation (memory keys, hooks).
Default: false (reflection is enabled when completionCriteria is set) |

</details>

---

### TaskValidationResult `interface`

📍 [`src/domain/entities/Task.ts:193`](src/domain/entities/Task.ts)

Result of task validation (returned by LLM reflection)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `isComplete` | `isComplete: boolean;` | Whether the task is considered complete |
| `completionScore` | `completionScore: number;` | Completeness score from 0-100 |
| `explanation` | `explanation: string;` | LLM's explanation of why the task is/isn't complete |
| `criteriaResults?` | `criteriaResults?: Array&lt;{
    criterion: string;
    met: boolean;
    evidence?: string;
  }&gt;;` | Per-criterion evaluation results |
| `requiresUserApproval` | `requiresUserApproval: boolean;` | Whether user approval is needed |
| `approvalReason?` | `approvalReason?: string;` | Reason for requiring user approval |

</details>

---

### UniversalAgentPlanningConfig `interface`

📍 [`src/capabilities/universalAgent/types.ts:33`](src/capabilities/universalAgent/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `enabled?` | `enabled?: boolean;` | Enable planning mode. Default: true |
| `model?` | `model?: string;` | Model to use for planning (can be different from execution model) |
| `autoDetect?` | `autoDetect?: boolean;` | Auto-detect complex tasks and switch to planning mode. Default: true |
| `requireApproval?` | `requireApproval?: boolean;` | Require user approval before executing plan. Default: true |
| `maxTasksBeforeApproval?` | `maxTasksBeforeApproval?: number;` | Maximum tasks before requiring approval (if requireApproval is false). Default: 3 |

</details>

---

### UniversalAgentPlanningConfig `interface`

📍 [`src/capabilities/universalAgent/UniversalAgent.ts:61`](src/capabilities/universalAgent/UniversalAgent.ts)

Planning configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `enabled?` | `enabled?: boolean;` | Whether planning is enabled (default: true) |
| `autoDetect?` | `autoDetect?: boolean;` | Whether to auto-detect complex tasks (default: true) |
| `model?` | `model?: string;` | Model to use for planning (defaults to agent model) |
| `requireApproval?` | `requireApproval?: boolean;` | Whether approval is required (default: true) |

</details>

---

### WorkingMemoryAccess `interface`

📍 [`src/domain/interfaces/IToolContext.ts:18`](src/domain/interfaces/IToolContext.ts)

Limited memory access for tools

This interface is designed to work with all agent types:
- Basic agents: Use simple scopes ('session', 'persistent')
- TaskAgent: Use task-aware scopes ({ type: 'task', taskIds: [...] })
- UniversalAgent: Switches between simple and task-aware based on mode

<details>
<summary><strong>Methods</strong></summary>

#### `get()`

```typescript
get(key: string): Promise&lt;unknown&gt;;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;unknown&gt;`

#### `set()`

Store a value in memory

```typescript
set(
    key: string,
    description: string,
    value: unknown,
    options?: {
      /** Scope determines lifecycle - defaults to 'session' */
      scope?: MemoryScope;
      /** Base priority for eviction ordering */
      priority?: MemoryPriority;
      /** If true, entry is never evicted */
      pinned?: boolean;
    }
  ): Promise&lt;void&gt;;
```

**Parameters:**
- `key`: `string`
- `description`: `string`
- `value`: `unknown`
- `options`: `{ scope?: MemoryScope | undefined; priority?: MemoryPriority | undefined; pinned?: boolean | undefined; } | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `delete()`

```typescript
delete(key: string): Promise&lt;void&gt;;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `has()`

```typescript
has(key: string): Promise&lt;boolean&gt;;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `list()`

List all memory entries
Returns key, description, and computed priority info

```typescript
list(): Promise&lt;
    Array&lt;{
      key: string;
      description: string;
      effectivePriority?: MemoryPriority;
      pinned?: boolean;
    }&gt;
  &gt;;
```

**Returns:** `Promise&lt;{ key: string; description: string; effectivePriority?: MemoryPriority | undefined; pinned?: boolean | undefined; }[]&gt;`

</details>

---

### WorkingMemoryConfig `interface`

📍 [`src/domain/entities/Memory.ts:420`](src/domain/entities/Memory.ts)

Configuration for working memory

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxSizeBytes?` | `maxSizeBytes?: number;` | Max memory size in bytes. If not set, calculated from model context |
| `descriptionMaxLength` | `descriptionMaxLength: number;` | Max description length |
| `softLimitPercent` | `softLimitPercent: number;` | Percentage at which to warn agent |
| `contextAllocationPercent` | `contextAllocationPercent: number;` | Percentage of model context to allocate to memory |

</details>

---

### WorkingMemoryEvents `interface`

📍 [`src/capabilities/taskAgent/WorkingMemory.ts:60`](src/capabilities/taskAgent/WorkingMemory.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `stored` | `stored: { key: string; description: string; scope: MemoryScope };` | - |
| `retrieved` | `retrieved: { key: string };` | - |
| `deleted` | `deleted: { key: string };` | - |
| `evicted` | `evicted: { keys: string[]; reason: 'lru' | 'size' | 'task_completed' };` | - |
| `limit_warning` | `limit_warning: { utilizationPercent: number };` | - |
| `stale_entries` | `stale_entries: { entries: StaleEntryInfo[] };` | - |

</details>

---

### EvictionStrategy `type`

📍 [`src/capabilities/taskAgent/WorkingMemory.ts:50`](src/capabilities/taskAgent/WorkingMemory.ts)

Eviction strategy type

```typescript
type EvictionStrategy = 'lru' | 'size'
```

---

### MemoryPriority `type`

📍 [`src/domain/entities/Memory.ts:110`](src/domain/entities/Memory.ts)

Priority determines eviction order (lower priority evicted first)

- critical: Never evicted (pinned, or actively in use)
- high: Important data, evicted only when necessary
- normal: Default priority
- low: Candidate for eviction (stale data, completed task data)

```typescript
type MemoryPriority = 'critical' | 'high' | 'normal' | 'low'
```

---

### MemoryScope `type`

📍 [`src/domain/entities/Memory.ts:33`](src/domain/entities/Memory.ts)

Union type - memory system accepts both

```typescript
type MemoryScope = SimpleScope | TaskAwareScope
```

---

### PlanStatus `type`

📍 [`src/domain/entities/Task.ts:37`](src/domain/entities/Task.ts)

Plan status

```typescript
type PlanStatus = | 'pending'
  | 'running'
  | 'suspended'
  | 'completed'
  | 'failed'
  | 'cancelled'
```

---

### SimpleScope `type`

📍 [`src/domain/entities/Memory.ts:20`](src/domain/entities/Memory.ts)

Memory entities for WorkingMemory

This module provides a GENERIC memory system that works across all agent types:
- Basic Agent: Simple session/persistent scoping with static priority
- TaskAgent: Task-aware scoping with dynamic priority based on task states
- UniversalAgent: Mode-aware, switches strategy based on current mode

The key abstraction is PriorityCalculator - a pluggable strategy that
determines entry priority for eviction decisions.

```typescript
type SimpleScope = 'session' | 'persistent'
```

---

### TaskAwareScope `type`

📍 [`src/domain/entities/Memory.ts:25`](src/domain/entities/Memory.ts)

Task-aware scope for TaskAgent/UniversalAgent

```typescript
type TaskAwareScope = | { type: 'task'; taskIds: string[] }   // Needed for specific task(s)
  | { type: 'plan' }                       // Needed throughout plan execution
  | { type: 'persistent' }
```

---

### TaskStatus `type`

📍 [`src/domain/entities/Task.ts:12`](src/domain/entities/Task.ts)

Task status lifecycle

```typescript
type TaskStatus = | 'pending'           // Not started
  | 'blocked'           // Dependencies not met
  | 'in_progress'       // Currently executing
  | 'waiting_external'  // Waiting on external event
  | 'completed'         // Successfully finished
  | 'failed'            // Failed after max retries
  | 'skipped'           // Skipped (condition not met)
  | 'cancelled'
```

---

### TaskStatusForMemory `type`

📍 [`src/domain/entities/Memory.ts:219`](src/domain/entities/Memory.ts)

Task status values for priority calculation

```typescript
type TaskStatusForMemory = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'cancelled'
```

---

### calculateEntrySize `function`

📍 [`src/domain/entities/Memory.ts:531`](src/domain/entities/Memory.ts)

Calculate the size of a value in bytes (JSON serialization)
Uses Buffer.byteLength for accurate UTF-8 byte count

```typescript
export function calculateEntrySize(value: unknown): number
```

---

### canTaskExecute `function`

📍 [`src/domain/entities/Task.ts:461`](src/domain/entities/Task.ts)

Check if a task can be executed (dependencies met, status is pending)

```typescript
export function canTaskExecute(task: Task, allTasks: Task[]): boolean
```

---

### createContextTools `function`

📍 [`src/capabilities/taskAgent/contextTools.ts:236`](src/capabilities/taskAgent/contextTools.ts)

Create all context inspection tools (backward compatibility)
Note: Tools are now auto-registered by AgentContext - manual registration is no longer needed.

```typescript
export function createContextTools(): ToolFunction[]
```

---

### createEmptyMemory `function`

📍 [`src/core/SessionManager.ts:792`](src/core/SessionManager.ts)

Create an empty serialized memory

```typescript
export function createEmptyMemory(): SerializedMemory
```

---

### createInContextMemory `function`

📍 [`src/core/context/plugins/inContextMemoryTools.ts:266`](src/core/context/plugins/inContextMemoryTools.ts)

Create an InContextMemory plugin with its tools

```typescript
export function createInContextMemory(config?: InContextMemoryConfig):
```

**Example:**

```typescript
const { plugin, tools } = createInContextMemory({ maxEntries: 15 });
ctx.registerPlugin(plugin);
for (const tool of tools) {
  ctx.tools.register(tool);
}
```

---

### createInContextMemoryTools `function`

📍 [`src/core/context/plugins/inContextMemoryTools.ts:140`](src/core/context/plugins/inContextMemoryTools.ts)

Create all in-context memory tools

```typescript
export function createInContextMemoryTools(): ToolFunction[]
```

---

### createMemoryTools `function`

📍 [`src/capabilities/taskAgent/memoryTools.ts:524`](src/capabilities/taskAgent/memoryTools.ts)

Create all memory tools (convenience function for backward compatibility)

```typescript
export function createMemoryTools(): ToolFunction[]
```

---

### createPlan `function`

📍 [`src/domain/entities/Task.ts:394`](src/domain/entities/Task.ts)

Create a plan with tasks

```typescript
export function createPlan(input: PlanInput): Plan
```

---

### createTask `function`

📍 [`src/domain/entities/Task.ts:367`](src/domain/entities/Task.ts)

Create a task with defaults

```typescript
export function createTask(input: TaskInput): Task
```

---

### detectDependencyCycle `function`

📍 [`src/domain/entities/Task.ts:668`](src/domain/entities/Task.ts)

Detect dependency cycles in tasks using depth-first search

```typescript
export function detectDependencyCycle(tasks: Task[]): string[] | null
```

---

### evaluateCondition `function`

📍 [`src/domain/entities/Task.ts:525`](src/domain/entities/Task.ts)

Evaluate a task condition against memory

```typescript
export async function evaluateCondition(
  condition: TaskCondition,
  memory: ConditionMemoryAccess
): Promise&lt;boolean&gt;
```

---

### forPlan `function`

📍 [`src/domain/entities/Memory.ts:480`](src/domain/entities/Memory.ts)

Create a plan-scoped memory entry input

```typescript
export function forPlan(
  key: string,
  description: string,
  value: unknown,
  options?:
```

---

### forTasks `function`

📍 [`src/domain/entities/Memory.ts:460`](src/domain/entities/Memory.ts)

Create a task-scoped memory entry input

```typescript
export function forTasks(
  key: string,
  description: string,
  value: unknown,
  taskIds: string[],
  options?:
```

---

### generateSimplePlan `function`

📍 [`src/capabilities/taskAgent/PlanningAgent.ts:438`](src/capabilities/taskAgent/PlanningAgent.ts)

Simple plan generation without tools (fallback)

```typescript
export async function generateSimplePlan(
  goal: string,
  context?: string
): Promise&lt;Plan&gt;
```

---

### getNextExecutableTasks `function`

📍 [`src/domain/entities/Task.ts:483`](src/domain/entities/Task.ts)

Get the next tasks that can be executed

```typescript
export function getNextExecutableTasks(plan: Plan): Task[]
```

---

### getTaskDependencies `function`

📍 [`src/domain/entities/Task.ts:622`](src/domain/entities/Task.ts)

Get the dependency tasks for a task

```typescript
export function getTaskDependencies(task: Task, allTasks: Task[]): Task[]
```

---

### isSimpleScope `function`

📍 [`src/domain/entities/Memory.ts:45`](src/domain/entities/Memory.ts)

Type guard: is this a simple scope?

```typescript
export function isSimpleScope(scope: MemoryScope): scope is SimpleScope
```

---

### isTaskAwareScope `function`

📍 [`src/domain/entities/Memory.ts:38`](src/domain/entities/Memory.ts)

Type guard: is this a task-aware scope?

```typescript
export function isTaskAwareScope(scope: MemoryScope): scope is TaskAwareScope
```

---

### isTaskBlocked `function`

📍 [`src/domain/entities/Task.ts:601`](src/domain/entities/Task.ts)

Check if a task is blocked by dependencies

```typescript
export function isTaskBlocked(task: Task, allTasks: Task[]): boolean
```

---

### isTerminalMemoryStatus `function`

📍 [`src/domain/entities/Memory.ts:229`](src/domain/entities/Memory.ts)

Check if a task status is terminal (task will not progress further)

```typescript
export function isTerminalMemoryStatus(status: TaskStatusForMemory): boolean
```

---

### isTerminalStatus `function`

📍 [`src/domain/entities/Task.ts:30`](src/domain/entities/Task.ts)

Check if a task status is terminal (task will not progress further)

```typescript
export function isTerminalStatus(status: TaskStatus): boolean
```

---

### resolveDependencies `function`

📍 [`src/domain/entities/Task.ts:636`](src/domain/entities/Task.ts)

Resolve task name dependencies to task IDs
Modifies taskInputs in place

```typescript
export function resolveDependencies(taskInputs: TaskInput[], tasks: Task[]): void
```

---

### scopeEquals `function`

📍 [`src/domain/entities/Memory.ts:53`](src/domain/entities/Memory.ts)

Compare two scopes for equality
Handles both simple scopes (string comparison) and task-aware scopes (deep comparison)

```typescript
export function scopeEquals(a: MemoryScope, b: MemoryScope): boolean
```

---

### scopeMatches `function`

📍 [`src/domain/entities/Memory.ts:83`](src/domain/entities/Memory.ts)

Check if a scope matches a filter scope
More flexible than scopeEquals - supports partial matching for task scopes

```typescript
export function scopeMatches(entryScope: MemoryScope, filterScope: MemoryScope): boolean
```

---

### setupInContextMemory `function`

📍 [`src/core/context/plugins/inContextMemoryTools.ts:294`](src/core/context/plugins/inContextMemoryTools.ts)

Set up InContextMemory on an AgentContext

Registers both the plugin and its tools on the context.

```typescript
export function setupInContextMemory(
  agentContext: AgentContext,
  config?: InContextMemoryConfig
): InContextMemoryPlugin
```

**Example:**

```typescript
const ctx = AgentContext.create({ model: 'gpt-4' });
const plugin = setupInContextMemory(ctx, { maxEntries: 10 });

// Plugin is accessible through ctx.inContextMemory
plugin.set('state', 'Current processing state', { step: 1 });
```

---

### updateTaskStatus `function`

📍 [`src/domain/entities/Task.ts:573`](src/domain/entities/Task.ts)

Update task status and timestamps

```typescript
export function updateTaskStatus(task: Task, status: TaskStatus): Task
```

---

### DEFAULT_CHECKPOINT_STRATEGY `const`

📍 [`src/capabilities/taskAgent/CheckpointManager.ts:25`](src/capabilities/taskAgent/CheckpointManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `afterToolCalls` | `1` | - |
| `afterLLMCalls` | `1` | - |
| `intervalMs` | `30000` | - |
| `beforeExternalWait` | `true` | - |
| `mode` | `'async'` | - |

</details>

---

### DEFAULT_MEMORY_CONFIG `const`

📍 [`src/domain/entities/Memory.ts:499`](src/domain/entities/Memory.ts)

Default configuration values

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxSizeBytes` | `25 * 1024 * 1024` | - |
| `descriptionMaxLength` | `150` | - |
| `softLimitPercent` | `80` | - |
| `contextAllocationPercent` | `20` | - |

</details>

---

### MEMORY_PRIORITY_VALUES `const`

📍 [`src/domain/entities/Memory.ts:115`](src/domain/entities/Memory.ts)

Priority values for comparison (higher = more important, less likely to evict)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `critical` | `4` | - |
| `high` | `3` | - |
| `normal` | `2` | - |
| `low` | `1` | - |

</details>

---

## Universal Agent

Unified agent combining chat, planning, and execution

### ModeManager `class`

📍 [`src/capabilities/universalAgent/ModeManager.ts:22`](src/capabilities/universalAgent/ModeManager.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(initialMode: AgentMode = 'interactive')
```

**Parameters:**
- `initialMode`: `AgentMode` *(optional)* (default: `'interactive'`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `destroy()`

Releases all resources held by this ModeManager.
Removes all event listeners.
Safe to call multiple times (idempotent).

```typescript
destroy(): void
```

**Returns:** `void`

#### `getMode()`

Get current mode

```typescript
getMode(): AgentMode
```

**Returns:** `AgentMode`

#### `getState()`

Get full mode state

```typescript
getState(): ModeState
```

**Returns:** `ModeState`

#### `canTransition()`

Check if a transition is allowed

```typescript
canTransition(to: AgentMode): boolean
```

**Parameters:**
- `to`: `AgentMode`

**Returns:** `boolean`

#### `transition()`

Transition to a new mode

```typescript
transition(to: AgentMode, reason: string): boolean
```

**Parameters:**
- `to`: `AgentMode`
- `reason`: `string`

**Returns:** `boolean`

#### `enterPlanning()`

Enter planning mode with a goal

```typescript
enterPlanning(reason: string = 'user_request'): boolean
```

**Parameters:**
- `reason`: `string` *(optional)* (default: `'user_request'`)

**Returns:** `boolean`

#### `enterExecuting()`

Enter executing mode (plan must be approved)

```typescript
enterExecuting(_plan: Plan, reason: string = 'plan_approved'): boolean
```

**Parameters:**
- `_plan`: `Plan`
- `reason`: `string` *(optional)* (default: `'plan_approved'`)

**Returns:** `boolean`

#### `returnToInteractive()`

Return to interactive mode

```typescript
returnToInteractive(reason: string = 'completed'): boolean
```

**Parameters:**
- `reason`: `string` *(optional)* (default: `'completed'`)

**Returns:** `boolean`

#### `setPendingPlan()`

Set pending plan (in planning mode)

```typescript
setPendingPlan(plan: Plan): void
```

**Parameters:**
- `plan`: `Plan`

**Returns:** `void`

#### `getPendingPlan()`

Get pending plan

```typescript
getPendingPlan(): Plan | undefined
```

**Returns:** `Plan | undefined`

#### `approvePlan()`

Approve the pending plan

```typescript
approvePlan(): boolean
```

**Returns:** `boolean`

#### `isPlanApproved()`

Check if plan is approved

```typescript
isPlanApproved(): boolean
```

**Returns:** `boolean`

#### `setCurrentTaskIndex()`

Update current task index (in executing mode)

```typescript
setCurrentTaskIndex(index: number): void
```

**Parameters:**
- `index`: `number`

**Returns:** `void`

#### `getCurrentTaskIndex()`

Get current task index

```typescript
getCurrentTaskIndex(): number
```

**Returns:** `number`

#### `pauseExecution()`

Pause execution

```typescript
pauseExecution(reason: string): void
```

**Parameters:**
- `reason`: `string`

**Returns:** `void`

#### `resumeExecution()`

Resume execution

```typescript
resumeExecution(): void
```

**Returns:** `void`

#### `isPaused()`

Check if paused

```typescript
isPaused(): boolean
```

**Returns:** `boolean`

#### `getPauseReason()`

Get pause reason

```typescript
getPauseReason(): string | undefined
```

**Returns:** `string | undefined`

#### `recommendMode()`

Determine recommended mode based on intent analysis

```typescript
recommendMode(intent: IntentAnalysis, _currentPlan?: Plan): AgentMode | null
```

**Parameters:**
- `intent`: `IntentAnalysis`
- `_currentPlan`: `Plan | undefined` *(optional)*

**Returns:** `AgentMode | null`

#### `getHistory()`

Get transition history

```typescript
getHistory(): Array&lt;
```

**Returns:** `{ from: AgentMode; to: AgentMode; at: Date; reason: string; }[]`

#### `clearHistory()`

Clear transition history

```typescript
clearHistory(): void
```

**Returns:** `void`

#### `getTimeInCurrentMode()`

Get time spent in current mode

```typescript
getTimeInCurrentMode(): number
```

**Returns:** `number`

#### `serialize()`

Serialize state for session persistence

```typescript
serialize():
```

**Returns:** `{ mode: AgentMode; enteredAt: string; reason: string; pendingPlan?: Plan | undefined; planApproved?: boolean | undefined; currentTaskIndex?: number | undefined; }`

#### `restore()`

Restore state from serialized data

```typescript
restore(data: ReturnType&lt;ModeManager['serialize']&gt;): void
```

**Parameters:**
- `data`: `{ mode: AgentMode; enteredAt: string; reason: string; pendingPlan?: Plan | undefined; planApproved?: boolean | undefined; currentTaskIndex?: number | undefined; }`

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `state` | `state: ModeState` | - |
| `transitionHistory` | `transitionHistory: { from: AgentMode; to: AgentMode; at: Date; reason: string; }[]` | - |

</details>

---

### UniversalAgent `class`

📍 [`src/capabilities/universalAgent/UniversalAgent.ts:125`](src/capabilities/universalAgent/UniversalAgent.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
private constructor(config: UniversalAgentConfig)
```

**Parameters:**
- `config`: `UniversalAgentConfig`

</details>

<details>
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Create a new UniversalAgent

```typescript
static create(config: UniversalAgentConfig): UniversalAgent
```

**Parameters:**
- `config`: `UniversalAgentConfig`

**Returns:** `UniversalAgent`

#### `static resume()`

Resume an agent from a saved session

```typescript
static async resume(
    sessionId: string,
    config: Omit&lt;UniversalAgentConfig, 'session'&gt; &
```

**Parameters:**
- `sessionId`: `string`
- `config`: `Omit&lt;UniversalAgentConfig, "session"&gt; & { session: { storage: ISessionStorage; }; }`

**Returns:** `Promise&lt;UniversalAgent&gt;`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `getAgentType()`

```typescript
protected getAgentType(): 'agent' | 'task-agent' | 'universal-agent'
```

**Returns:** `"agent" | "task-agent" | "universal-agent"`

#### `prepareSessionState()`

```typescript
protected prepareSessionState(): void
```

**Returns:** `void`

#### `restoreSessionState()`

```typescript
protected async restoreSessionState(session: Session): Promise&lt;void&gt;
```

**Parameters:**
- `session`: `Session`

**Returns:** `Promise&lt;void&gt;`

#### `getSerializedPlan()`

```typescript
protected getSerializedPlan(): SerializedPlan | undefined
```

**Returns:** `SerializedPlan | undefined`

#### `saveSession()`

```typescript
async saveSession(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `chat()`

Chat with the agent - the main entry point

```typescript
async chat(input: string): Promise&lt;UniversalResponse&gt;
```

**Parameters:**
- `input`: `string`

**Returns:** `Promise&lt;UniversalResponse&gt;`

#### `stream()`

Stream chat response

```typescript
async *stream(input: string): AsyncIterableIterator&lt;UniversalEvent&gt;
```

**Parameters:**
- `input`: `string`

**Returns:** `AsyncIterableIterator&lt;UniversalEvent&gt;`

#### `getMode()`

```typescript
getMode(): AgentMode
```

**Returns:** `AgentMode`

#### `getPlan()`

```typescript
getPlan(): Plan | null
```

**Returns:** `Plan | null`

#### `getProgress()`

```typescript
getProgress(): TaskProgress | null
```

**Returns:** `TaskProgress | null`

#### `hasContext()`

Check if context is available (always true since AgentContext is created by BaseAgent)

```typescript
hasContext(): boolean
```

**Returns:** `boolean`

#### `setAutoApproval()`

```typescript
setAutoApproval(value: boolean): void
```

**Parameters:**
- `value`: `boolean`

**Returns:** `void`

#### `setPlanningEnabled()`

```typescript
setPlanningEnabled(value: boolean): void
```

**Parameters:**
- `value`: `boolean`

**Returns:** `void`

#### `pause()`

```typescript
pause(): void
```

**Returns:** `void`

#### `resume()`

```typescript
resume(): void
```

**Returns:** `void`

#### `cancel()`

```typescript
cancel(): void
```

**Returns:** `void`

#### `isRunning()`

```typescript
isRunning(): boolean
```

**Returns:** `boolean`

#### `isPaused()`

```typescript
isPaused(): boolean
```

**Returns:** `boolean`

#### `destroy()`

```typescript
destroy(): void
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agent` | `agent: Agent` | - |
| `executionAgent?` | `executionAgent: Agent | undefined` | - |
| `modeManager` | `modeManager: ModeManager` | - |
| `planningAgent?` | `planningAgent: PlanningAgent | undefined` | - |
| `currentPlan` | `currentPlan: Plan | null` | - |
| `executionHistory` | `executionHistory: { input: string; response: UniversalResponse; timestamp: Date; }[]` | - |

</details>

---

### ExecutionResult `interface`

📍 [`src/capabilities/universalAgent/types.ts:181`](src/capabilities/universalAgent/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `status` | `status: 'completed' | 'failed' | 'cancelled' | 'paused';` | - |
| `completedTasks` | `completedTasks: number;` | - |
| `totalTasks` | `totalTasks: number;` | - |
| `failedTasks` | `failedTasks: number;` | - |
| `skippedTasks` | `skippedTasks: number;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### IntentAnalysis `interface`

📍 [`src/capabilities/universalAgent/types.ts:194`](src/capabilities/universalAgent/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'simple' | 'complex' | 'plan_modify' | 'status_query' | 'approval' | 'rejection' | 'feedback' | 'interrupt' | 'question';` | Detected intent type |
| `confidence` | `confidence: number;` | Confidence score (0-1) |
| `complexity?` | `complexity?: 'low' | 'medium' | 'high';` | For complex tasks |
| `estimatedSteps?` | `estimatedSteps?: number;` | - |
| `modification?` | `modification?: {
    action: 'add_task' | 'remove_task' | 'skip_task' | 'reorder' | 'update_task';
    taskName?: string;
    details?: string;
  };` | For plan modifications |
| `feedback?` | `feedback?: string;` | For approvals/rejections |
| `reasoning?` | `reasoning?: string;` | Raw reasoning from analysis |

</details>

---

### ModeManagerEvents `interface`

📍 [`src/capabilities/universalAgent/ModeManager.ts:17`](src/capabilities/universalAgent/ModeManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'mode:changed'` | `'mode:changed': { from: AgentMode; to: AgentMode; reason: string };` | - |
| `'mode:transition_blocked'` | `'mode:transition_blocked': { from: AgentMode; to: AgentMode; reason: string };` | - |

</details>

---

### ModeState `interface`

📍 [`src/capabilities/universalAgent/types.ts:219`](src/capabilities/universalAgent/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `mode` | `mode: AgentMode;` | - |
| `enteredAt` | `enteredAt: Date;` | - |
| `reason` | `reason: string;` | - |
| `pendingPlan?` | `pendingPlan?: Plan;` | - |
| `planApproved?` | `planApproved?: boolean;` | - |
| `currentTaskIndex?` | `currentTaskIndex?: number;` | - |
| `pausedAt?` | `pausedAt?: Date;` | - |
| `pauseReason?` | `pauseReason?: string;` | - |

</details>

---

### ToolCallResult `interface`

📍 [`src/capabilities/universalAgent/types.ts:123`](src/capabilities/universalAgent/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string;` | - |
| `args` | `args: unknown;` | - |
| `result` | `result: unknown;` | - |
| `error?` | `error?: string;` | - |
| `durationMs` | `durationMs: number;` | - |

</details>

---

### UniversalAgentConfig `interface`

📍 [`src/capabilities/universalAgent/types.ts:46`](src/capabilities/universalAgent/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `connector` | `connector: string | Connector;` | - |
| `model` | `model: string;` | - |
| `name?` | `name?: string;` | - |
| `tools?` | `tools?: ToolFunction[];` | - |
| `instructions?` | `instructions?: string;` | - |
| `temperature?` | `temperature?: number;` | - |
| `maxIterations?` | `maxIterations?: number;` | - |
| `planning?` | `planning?: UniversalAgentPlanningConfig;` | - |
| `session?` | `session?: UniversalAgentSessionConfig;` | - |
| `memoryConfig?` | `memoryConfig?: WorkingMemoryConfig;` | - |
| `toolManager?` | `toolManager?: ToolManager;` | - |
| `permissions?` | `permissions?: import('../../core/permissions/types.js').AgentPermissionsConfig;` | Permission configuration for tool execution approval. |
| `context?` | `context?: Partial&lt;import('../../core/AgentContext.js').AgentContextConfig&gt;;` | AgentContext configuration (optional overrides) |

</details>

---

### UniversalAgentConfig `interface`

📍 [`src/capabilities/universalAgent/UniversalAgent.ts:75`](src/capabilities/universalAgent/UniversalAgent.ts)

UniversalAgent configuration - extends BaseAgentConfig

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `instructions?` | `instructions?: string;` | System instructions for the agent |
| `temperature?` | `temperature?: number;` | Temperature for generation |
| `maxIterations?` | `maxIterations?: number;` | Maximum iterations for tool calling loop |
| `planning?` | `planning?: UniversalAgentPlanningConfig;` | Planning configuration |
| `memoryConfig?` | `memoryConfig?: WorkingMemoryConfig;` | Memory configuration |
| `session?` | `session?: UniversalAgentSessionConfig;` | Session configuration - extends base type |
| `permissions?` | `permissions?: AgentPermissionsConfig;` | Permission configuration for tool execution approval |
| `context?` | `context?: Partial&lt;AgentContextConfig&gt;;` | AgentContext configuration (optional) |

</details>

---

### UniversalAgentEvents `interface`

📍 [`src/capabilities/universalAgent/UniversalAgent.ts:105`](src/capabilities/universalAgent/UniversalAgent.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'mode:changed'` | `'mode:changed': { from: AgentMode; to: AgentMode; reason: string };` | - |
| `'plan:created'` | `'plan:created': { plan: Plan };` | - |
| `'plan:modified'` | `'plan:modified': { plan: Plan; changes: PlanChange[] };` | - |
| `'plan:approved'` | `'plan:approved': { plan: Plan };` | - |
| `'task:started'` | `'task:started': { task: Task };` | - |
| `'task:completed'` | `'task:completed': { task: Task; result: unknown };` | - |
| `'task:failed'` | `'task:failed': { task: Task; error: string };` | - |
| `'execution:completed'` | `'execution:completed': { result: ExecutionResult };` | - |
| `'error'` | `'error': { error: Error; recoverable: boolean };` | - |
| `'session:saved'` | `'session:saved': { sessionId: string };` | - |
| `'session:loaded'` | `'session:loaded': { sessionId: string };` | - |
| `destroyed` | `destroyed: void;` | - |

</details>

---

### UniversalAgentSessionConfig `interface`

📍 [`src/capabilities/universalAgent/types.ts:22`](src/capabilities/universalAgent/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `storage` | `storage: ISessionStorage;` | Storage backend for sessions |
| `id?` | `id?: string;` | Resume existing session by ID |
| `autoSave?` | `autoSave?: boolean;` | Auto-save session after each interaction |
| `autoSaveIntervalMs?` | `autoSaveIntervalMs?: number;` | Auto-save interval in milliseconds |

</details>

---

### UniversalAgentSessionConfig `interface`

📍 [`src/capabilities/universalAgent/UniversalAgent.ts:54`](src/capabilities/universalAgent/UniversalAgent.ts)

Session configuration for UniversalAgent - extends BaseSessionConfig

---

### UniversalResponse `interface`

📍 [`src/capabilities/universalAgent/types.ts:90`](src/capabilities/universalAgent/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `text` | `text: string;` | Human-readable response text |
| `mode` | `mode: AgentMode;` | Current mode after this response |
| `plan?` | `plan?: Plan;` | Plan (if created or modified) |
| `planStatus?` | `planStatus?: 'pending_approval' | 'approved' | 'executing' | 'completed' | 'failed';` | Plan status |
| `taskProgress?` | `taskProgress?: TaskProgress;` | Task progress (if executing) |
| `toolCalls?` | `toolCalls?: ToolCallResult[];` | Tool calls made during this interaction |
| `usage?` | `usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };` | Token usage |
| `needsUserAction?` | `needsUserAction?: boolean;` | Whether user action is needed |
| `userActionType?` | `userActionType?: 'approve_plan' | 'provide_input' | 'clarify';` | What action is needed |

</details>

---

### AgentMode `type`

📍 [`src/capabilities/universalAgent/types.ts:16`](src/capabilities/universalAgent/types.ts)

```typescript
type AgentMode = 'interactive' | 'planning' | 'executing'
```

---

### UniversalEvent `type`

📍 [`src/capabilities/universalAgent/types.ts:135`](src/capabilities/universalAgent/types.ts)

```typescript
type UniversalEvent = | { type: 'text:delta'; delta: string }
  | { type: 'text:done'; text: string }

  // Mode transitions
  | { type: 'mode:changed'; from: AgentMode; to: AgentMode; reason: string }

  // Planning
  | { type: 'plan:analyzing'; goal: string }
  | { type: 'plan:created'; plan: Plan }
  | { type: 'plan:modified'; plan: Plan; changes: PlanChange[] }
  | { type: 'plan:awaiting_approval'; plan: Plan }
  | { type: 'plan:approved'; plan: Plan }
  | { type: 'plan:rejected'; plan: Plan; reason?: string }

  // Execution
  | { type: 'task:started'; task: Task }
  | { type: 'task:progress'; task: Task; status: string }
  | { type: 'task:completed'; task: Task; result: unknown }
  | { type: 'task:failed'; task: Task; error: string }
  | { type: 'task:skipped'; task: Task; reason: string }
  | { type: 'execution:done'; result: ExecutionResult }
  | { type: 'execution:paused'; reason: string }
  | { type: 'execution:resumed' }

  // Tools
  | { type: 'tool:start'; name: string; args: unknown }
  | { type: 'tool:complete'; name: string; result: unknown; durationMs: number }
  | { type: 'tool:error'; name: string; error: string }

  // User interaction
  | { type: 'needs:approval'; plan: Plan }
  | { type: 'needs:input'; prompt: string }
  | { type: 'needs:clarification'; question: string; options?: string[] }

  // Errors
  | { type: 'error'; error: string; recoverable: boolean }
```

---

### getMetaTools `function`

📍 [`src/capabilities/universalAgent/metaTools.ts:151`](src/capabilities/universalAgent/metaTools.ts)

Get all meta-tools

```typescript
export function getMetaTools(): ToolFunction[]
```

---

### isMetaTool `function`

📍 [`src/capabilities/universalAgent/metaTools.ts:163`](src/capabilities/universalAgent/metaTools.ts)

Check if a tool name is a meta-tool

```typescript
export function isMetaTool(toolName: string): boolean
```

---

## Context Management

Manage context windows and compaction strategies

### AdaptiveStrategy `class`

📍 [`src/core/context/strategies/AdaptiveStrategy.ts:30`](src/core/context/strategies/AdaptiveStrategy.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(private options: AdaptiveStrategyOptions =
```

**Parameters:**
- `options`: `AdaptiveStrategyOptions` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `shouldCompact()`

```typescript
shouldCompact(budget: ContextBudget, config: ContextManagerConfig): boolean
```

**Parameters:**
- `budget`: `ContextBudget`
- `config`: `ContextManagerConfig`

**Returns:** `boolean`

#### `compact()`

```typescript
async compact(
    components: IContextComponent[],
    budget: ContextBudget,
    compactors: IContextCompactor[],
    estimator: ITokenEstimator
  ): Promise&lt;
```

**Parameters:**
- `components`: `IContextComponent[]`
- `budget`: `ContextBudget`
- `compactors`: `IContextCompactor[]`
- `estimator`: `ITokenEstimator`

**Returns:** `Promise&lt;{ components: IContextComponent[]; log: string[]; tokensFreed: number; }&gt;`

#### `getMetrics()`

```typescript
getMetrics()
```

**Returns:** `{ currentStrategy: string; avgUtilization: number; compactionFrequency: number; lastCompactions: number[]; }`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "adaptive"` | - |
| `currentStrategy` | `currentStrategy: IContextStrategy` | - |
| `metrics` | `metrics: { avgUtilization: number; compactionFrequency: number; lastCompactions: number[]; }` | - |

</details>

---

### AggressiveCompactionStrategy `class`

📍 [`src/core/context/strategies/AggressiveStrategy.ts:37`](src/core/context/strategies/AggressiveStrategy.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(options: AggressiveStrategyOptions =
```

**Parameters:**
- `options`: `AggressiveStrategyOptions` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `shouldCompact()`

```typescript
shouldCompact(budget: ContextBudget, _config: ContextManagerConfig): boolean
```

**Parameters:**
- `budget`: `ContextBudget`
- `_config`: `ContextManagerConfig`

**Returns:** `boolean`

#### `calculateTargetSize()`

```typescript
calculateTargetSize(beforeSize: number, _round: number): number
```

**Parameters:**
- `beforeSize`: `number`
- `_round`: `number`

**Returns:** `number`

#### `getTargetUtilization()`

```typescript
getTargetUtilization(): number
```

**Returns:** `number`

#### `getLogPrefix()`

```typescript
protected getLogPrefix(): string
```

**Returns:** `string`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "aggressive"` | - |
| `options` | `options: Required&lt;AggressiveStrategyOptions&gt;` | - |

</details>

---

### ApproximateTokenEstimator `class`

📍 [`src/infrastructure/context/estimators/ApproximateEstimator.ts:14`](src/infrastructure/context/estimators/ApproximateEstimator.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `estimateTokens()`

Estimate tokens for text with content-type awareness

```typescript
estimateTokens(text: string, contentType: TokenContentType = 'mixed'): number
```

**Parameters:**
- `text`: `string`
- `contentType`: `TokenContentType` *(optional)* (default: `'mixed'`)

**Returns:** `number`

#### `estimateDataTokens()`

Estimate tokens for structured data (always uses 'mixed' estimation)

```typescript
estimateDataTokens(data: unknown, contentType: TokenContentType = 'mixed'): number
```

**Parameters:**
- `data`: `unknown`
- `contentType`: `TokenContentType` *(optional)* (default: `'mixed'`)

**Returns:** `number`

</details>

---

### ContextManager `class`

📍 [`src/core/context/ContextManager.ts:38`](src/core/context/ContextManager.ts)

Universal Context Manager

Works with any agent type through the IContextProvider interface.
Supports multiple compaction strategies that can be switched at runtime.

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    provider: IContextProvider,
    config: Partial&lt;ContextManagerConfig&gt; =
```

**Parameters:**
- `provider`: `IContextProvider`
- `config`: `Partial&lt;ContextManagerConfig&gt;` *(optional)* (default: `{}`)
- `compactors`: `IContextCompactor[]` *(optional)* (default: `[]`)
- `estimator`: `ITokenEstimator | undefined` *(optional)*
- `strategy`: `IContextStrategy | undefined` *(optional)*
- `hooks`: `ContextManagerHooks | undefined` *(optional)*
- `agentId`: `string | undefined` *(optional)*

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `setHooks()`

Set hooks at runtime

```typescript
setHooks(hooks: ContextManagerHooks): void
```

**Parameters:**
- `hooks`: `ContextManagerHooks`

**Returns:** `void`

#### `setAgentId()`

Set agent ID at runtime

```typescript
setAgentId(agentId: string): void
```

**Parameters:**
- `agentId`: `string`

**Returns:** `void`

#### `prepare()`

Prepare context for LLM call
Returns prepared components, automatically compacting if needed

```typescript
async prepare(): Promise&lt;PreparedContext&gt;
```

**Returns:** `Promise&lt;PreparedContext&gt;`

#### `setStrategy()`

Switch to a different strategy at runtime

```typescript
setStrategy(
    strategy: 'proactive' | 'aggressive' | 'lazy' | 'rolling-window' | 'adaptive' | IContextStrategy
  ): void
```

**Parameters:**
- `strategy`: `"proactive" | "aggressive" | "lazy" | "rolling-window" | "adaptive" | IContextStrategy`

**Returns:** `void`

#### `getStrategy()`

Get current strategy

```typescript
getStrategy(): IContextStrategy
```

**Returns:** `IContextStrategy`

#### `getStrategyMetrics()`

Get strategy metrics

```typescript
getStrategyMetrics(): Record&lt;string, unknown&gt;
```

**Returns:** `Record&lt;string, unknown&gt;`

#### `getCurrentBudget()`

Get current budget

```typescript
getCurrentBudget(): ContextBudget | null
```

**Returns:** `ContextBudget | null`

#### `getConfig()`

Get configuration

```typescript
getConfig(): ContextManagerConfig
```

**Returns:** `ContextManagerConfig`

#### `updateConfig()`

Update configuration

```typescript
updateConfig(updates: Partial&lt;ContextManagerConfig&gt;): void
```

**Parameters:**
- `updates`: `Partial&lt;ContextManagerConfig&gt;`

**Returns:** `void`

#### `addCompactor()`

Add compactor

```typescript
addCompactor(compactor: IContextCompactor): void
```

**Parameters:**
- `compactor`: `IContextCompactor`

**Returns:** `void`

#### `getCompactors()`

Get all compactors

```typescript
getCompactors(): IContextCompactor[]
```

**Returns:** `IContextCompactor[]`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `config` | `config: ContextManagerConfig` | - |
| `provider` | `provider: IContextProvider` | - |
| `estimator` | `estimator: ITokenEstimator` | - |
| `compactors` | `compactors: IContextCompactor[]` | - |
| `strategy` | `strategy: IContextStrategy` | - |
| `lastBudget?` | `lastBudget: ContextBudget | undefined` | - |
| `hooks` | `hooks: ContextManagerHooks` | - |
| `agentId?` | `agentId: string | undefined` | - |

</details>

---

### LazyCompactionStrategy `class`

📍 [`src/core/context/strategies/LazyStrategy.ts:34`](src/core/context/strategies/LazyStrategy.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(options: LazyStrategyOptions =
```

**Parameters:**
- `options`: `LazyStrategyOptions` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `shouldCompact()`

```typescript
shouldCompact(budget: ContextBudget, _config: ContextManagerConfig): boolean
```

**Parameters:**
- `budget`: `ContextBudget`
- `_config`: `ContextManagerConfig`

**Returns:** `boolean`

#### `calculateTargetSize()`

```typescript
calculateTargetSize(beforeSize: number, _round: number): number
```

**Parameters:**
- `beforeSize`: `number`
- `_round`: `number`

**Returns:** `number`

#### `getTargetUtilization()`

```typescript
getTargetUtilization(): number
```

**Returns:** `number`

#### `getLogPrefix()`

```typescript
protected getLogPrefix(): string
```

**Returns:** `string`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "lazy"` | - |
| `options` | `options: Required&lt;LazyStrategyOptions&gt;` | - |

</details>

---

### ProactiveCompactionStrategy `class`

📍 [`src/core/context/strategies/ProactiveStrategy.ts:40`](src/core/context/strategies/ProactiveStrategy.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(options: ProactiveStrategyOptions =
```

**Parameters:**
- `options`: `ProactiveStrategyOptions` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `shouldCompact()`

```typescript
shouldCompact(budget: ContextBudget, _config: ContextManagerConfig): boolean
```

**Parameters:**
- `budget`: `ContextBudget`
- `_config`: `ContextManagerConfig`

**Returns:** `boolean`

#### `calculateTargetSize()`

```typescript
calculateTargetSize(beforeSize: number, round: number): number
```

**Parameters:**
- `beforeSize`: `number`
- `round`: `number`

**Returns:** `number`

#### `getTargetUtilization()`

```typescript
getTargetUtilization(): number
```

**Returns:** `number`

#### `getMaxRounds()`

```typescript
protected getMaxRounds(): number
```

**Returns:** `number`

#### `getLogPrefix()`

```typescript
protected getLogPrefix(): string
```

**Returns:** `string`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "proactive"` | - |
| `options` | `options: Required&lt;ProactiveStrategyOptions&gt;` | - |

</details>

---

### RollingWindowStrategy `class`

📍 [`src/core/context/strategies/RollingWindowStrategy.ts:25`](src/core/context/strategies/RollingWindowStrategy.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(private options: RollingWindowOptions =
```

**Parameters:**
- `options`: `RollingWindowOptions` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `shouldCompact()`

```typescript
shouldCompact(_budget: ContextBudget, _config: ContextManagerConfig): boolean
```

**Parameters:**
- `_budget`: `ContextBudget`
- `_config`: `ContextManagerConfig`

**Returns:** `boolean`

#### `prepareComponents()`

```typescript
async prepareComponents(components: IContextComponent[]): Promise&lt;IContextComponent[]&gt;
```

**Parameters:**
- `components`: `IContextComponent[]`

**Returns:** `Promise&lt;IContextComponent[]&gt;`

#### `compact()`

```typescript
async compact(): Promise&lt;
```

**Returns:** `Promise&lt;{ components: IContextComponent[]; log: string[]; tokensFreed: number; }&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "rolling-window"` | - |

</details>

---

### SummarizeCompactor `class`

📍 [`src/infrastructure/context/compactors/SummarizeCompactor.ts:108`](src/infrastructure/context/compactors/SummarizeCompactor.ts)

SummarizeCompactor - LLM-based context compaction

Uses AI to intelligently summarize content, preserving semantic meaning
while significantly reducing token count.

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(estimator: ITokenEstimator, config: SummarizeCompactorConfig)
```

**Parameters:**
- `estimator`: `ITokenEstimator`
- `config`: `SummarizeCompactorConfig`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `canCompact()`

Check if this compactor can handle the component

```typescript
canCompact(component: IContextComponent): boolean
```

**Parameters:**
- `component`: `IContextComponent`

**Returns:** `boolean`

#### `compact()`

Compact the component by summarizing its content

```typescript
async compact(
    component: IContextComponent,
    targetTokens: number
  ): Promise&lt;IContextComponent&gt;
```

**Parameters:**
- `component`: `IContextComponent`
- `targetTokens`: `number`

**Returns:** `Promise&lt;IContextComponent&gt;`

#### `estimateSavings()`

Estimate how many tokens could be saved by summarization

```typescript
estimateSavings(component: IContextComponent): number
```

**Parameters:**
- `component`: `IContextComponent`

**Returns:** `number`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "summarize"` | - |
| `priority` | `priority: 5` | - |
| `config` | `config: Required&lt;SummarizeCompactorConfig&gt;` | - |
| `estimator` | `estimator: ITokenEstimator` | - |

</details>

---

### TruncateCompactor `class`

📍 [`src/infrastructure/context/compactors/TruncateCompactor.ts:11`](src/infrastructure/context/compactors/TruncateCompactor.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(private estimator: ITokenEstimator)
```

**Parameters:**
- `estimator`: `ITokenEstimator`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `canCompact()`

```typescript
canCompact(component: IContextComponent): boolean
```

**Parameters:**
- `component`: `IContextComponent`

**Returns:** `boolean`

#### `compact()`

```typescript
async compact(component: IContextComponent, targetTokens: number): Promise&lt;IContextComponent&gt;
```

**Parameters:**
- `component`: `IContextComponent`
- `targetTokens`: `number`

**Returns:** `Promise&lt;IContextComponent&gt;`

#### `estimateSavings()`

```typescript
estimateSavings(component: IContextComponent): number
```

**Parameters:**
- `component`: `IContextComponent`

**Returns:** `number`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "truncate"` | - |
| `priority` | `priority: 10` | - |

</details>

---

### ContextBudget `interface`

📍 [`src/core/context/types.ts:28`](src/core/context/types.ts)

Context budget information

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `total` | `total: number;` | Total available tokens |
| `reserved` | `reserved: number;` | Reserved tokens for response |
| `used` | `used: number;` | Currently used tokens |
| `available` | `available: number;` | Available tokens remaining |
| `utilizationPercent` | `utilizationPercent: number;` | Utilization percentage (used / (total - reserved)) |
| `status` | `status: 'ok' | 'warning' | 'critical';` | Budget status |
| `breakdown` | `breakdown: Record&lt;string, number&gt;;` | Token breakdown by component |

</details>

---

### ContextManagerConfig `interface`

📍 [`src/core/context/types.ts:71`](src/core/context/types.ts)

Context manager configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxContextTokens` | `maxContextTokens: number;` | Maximum context tokens for the model |
| `compactionThreshold` | `compactionThreshold: number;` | Threshold to trigger compaction (0.0 - 1.0) |
| `hardLimit` | `hardLimit: number;` | Hard limit - must compact before this (0.0 - 1.0) |
| `responseReserve` | `responseReserve: number;` | Reserve space for response (0.0 - 1.0) |
| `estimator` | `estimator: 'approximate' | 'tiktoken' | ITokenEstimator;` | Token estimator to use |
| `autoCompact` | `autoCompact: boolean;` | Enable automatic compaction |
| `strategy?` | `strategy?: 'proactive' | 'aggressive' | 'lazy' | 'rolling-window' | 'adaptive' | IContextStrategy;` | Strategy to use |
| `strategyOptions?` | `strategyOptions?: Record&lt;string, unknown&gt;;` | Strategy-specific options |

</details>

---

### IContextCompactor `interface`

📍 [`src/core/context/types.ts:194`](src/core/context/types.ts)

Abstract interface for compaction strategies

<details>
<summary><strong>Methods</strong></summary>

#### `canCompact()`

Check if this compactor can handle the component

```typescript
canCompact(component: IContextComponent): boolean;
```

**Parameters:**
- `component`: `IContextComponent`

**Returns:** `boolean`

#### `compact()`

Compact the component to target size

```typescript
compact(component: IContextComponent, targetTokens: number): Promise&lt;IContextComponent&gt;;
```

**Parameters:**
- `component`: `IContextComponent`
- `targetTokens`: `number`

**Returns:** `Promise&lt;IContextComponent&gt;`

#### `estimateSavings()`

Estimate savings from compaction

```typescript
estimateSavings(component: IContextComponent): number;
```

**Parameters:**
- `component`: `IContextComponent`

**Returns:** `number`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `readonly name: string;` | Compactor name |
| `priority` | `readonly priority: number;` | Priority order (lower = run first) |

</details>

---

### IContextComponent `interface`

📍 [`src/core/context/types.ts:8`](src/core/context/types.ts)

Core types for context management system

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string;` | Unique name for this component |
| `content` | `content: string | unknown;` | The actual content (string or structured data) |
| `priority` | `priority: number;` | Priority for compaction (higher = compact first) |
| `compactable` | `compactable: boolean;` | Whether this component can be compacted |
| `metadata?` | `metadata?: Record&lt;string, unknown&gt;;` | Additional metadata for compaction strategies |

</details>

---

### IContextProvider `interface`

📍 [`src/core/context/types.ts:115`](src/core/context/types.ts)

Abstract interface for providing context components.
Each agent type implements this to define what goes into context.

<details>
<summary><strong>Methods</strong></summary>

#### `getComponents()`

Get current context components

```typescript
getComponents(): Promise&lt;IContextComponent[]&gt;;
```

**Returns:** `Promise&lt;IContextComponent[]&gt;`

#### `applyCompactedComponents()`

Update components after compaction

```typescript
applyCompactedComponents(components: IContextComponent[]): Promise&lt;void&gt;;
```

**Parameters:**
- `components`: `IContextComponent[]`

**Returns:** `Promise&lt;void&gt;`

#### `getMaxContextSize()`

Get max context size for this agent/model

```typescript
getMaxContextSize(): number;
```

**Returns:** `number`

</details>

---

### IContextStrategy `interface`

📍 [`src/core/context/types.ts:220`](src/core/context/types.ts)

Context management strategy - defines the overall approach to managing context

<details>
<summary><strong>Methods</strong></summary>

#### `shouldCompact()`

Decide if compaction is needed based on current budget

```typescript
shouldCompact(budget: ContextBudget, config: ContextManagerConfig): boolean;
```

**Parameters:**
- `budget`: `ContextBudget`
- `config`: `ContextManagerConfig`

**Returns:** `boolean`

#### `compact()`

Execute compaction using available compactors

```typescript
compact(
    components: IContextComponent[],
    budget: ContextBudget,
    compactors: IContextCompactor[],
    estimator: ITokenEstimator
  ): Promise&lt;{
    components: IContextComponent[];
    log: string[];
    tokensFreed: number;
  }&gt;;
```

**Parameters:**
- `components`: `IContextComponent[]`
- `budget`: `ContextBudget`
- `compactors`: `IContextCompactor[]`
- `estimator`: `ITokenEstimator`

**Returns:** `Promise&lt;{ components: IContextComponent[]; log: string[]; tokensFreed: number; }&gt;`

#### `prepareComponents()?`

Optional: Prepare components before budget calculation
Use this for strategies that pre-process context (e.g., rolling window)

```typescript
prepareComponents?(components: IContextComponent[]): Promise&lt;IContextComponent[]&gt;;
```

**Parameters:**
- `components`: `IContextComponent[]`

**Returns:** `Promise&lt;IContextComponent[]&gt;`

#### `postProcess()?`

Optional: Post-process after compaction
Use this for strategies that need cleanup or optimization

```typescript
postProcess?(
    components: IContextComponent[],
    budget: ContextBudget
  ): Promise&lt;IContextComponent[]&gt;;
```

**Parameters:**
- `components`: `IContextComponent[]`
- `budget`: `ContextBudget`

**Returns:** `Promise&lt;IContextComponent[]&gt;`

#### `getMetrics()?`

Optional: Get strategy-specific metrics

```typescript
getMetrics?(): Record&lt;string, unknown&gt;;
```

**Returns:** `Record&lt;string, unknown&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `readonly name: string;` | Strategy name |

</details>

---

### InContextEntry `interface`

📍 [`src/core/context/plugins/InContextMemoryPlugin.ts:24`](src/core/context/plugins/InContextMemoryPlugin.ts)

An entry stored in InContextMemory

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `key` | `key: string;` | Unique key for this entry |
| `description` | `description: string;` | Human-readable description |
| `value` | `value: unknown;` | The actual value (any JSON-serializable data) |
| `updatedAt` | `updatedAt: number;` | When this entry was last updated |
| `priority` | `priority: InContextPriority;` | Eviction priority (low entries are evicted first) |

</details>

---

### ITokenEstimator `interface`

📍 [`src/core/context/types.ts:141`](src/core/context/types.ts)

Abstract interface for token estimation

<details>
<summary><strong>Methods</strong></summary>

#### `estimateTokens()`

Estimate token count for text

```typescript
estimateTokens(text: string, contentType?: TokenContentType): number;
```

**Parameters:**
- `text`: `string`
- `contentType`: `TokenContentType | undefined` *(optional)*

**Returns:** `number`

#### `estimateDataTokens()`

Estimate tokens for structured data

```typescript
estimateDataTokens(data: unknown, contentType?: TokenContentType): number;
```

**Parameters:**
- `data`: `unknown`
- `contentType`: `TokenContentType | undefined` *(optional)*

**Returns:** `number`

</details>

---

### PreparedContext `interface`

📍 [`src/core/context/types.ts:54`](src/core/context/types.ts)

Context preparation result

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `components` | `components: IContextComponent[];` | Prepared components |
| `budget` | `budget: ContextBudget;` | Current budget |
| `compacted` | `compacted: boolean;` | Whether compaction occurred |
| `compactionLog?` | `compactionLog?: string[];` | Compaction log if compacted |

</details>

---

### InContextPriority `type`

📍 [`src/core/context/plugins/InContextMemoryPlugin.ts:19`](src/core/context/plugins/InContextMemoryPlugin.ts)

Priority levels for in-context memory entries

```typescript
type InContextPriority = 'low' | 'normal' | 'high' | 'critical'
```

---

### TokenContentType `type`

📍 [`src/core/context/types.ts:136`](src/core/context/types.ts)

Content type for more accurate token estimation
Named differently from TokenContentType in Content.ts to avoid conflicts

```typescript
type TokenContentType = 'code' | 'prose' | 'mixed'
```

---

### createEstimator `function`

📍 [`src/infrastructure/context/estimators/index.ts:11`](src/infrastructure/context/estimators/index.ts)

Create token estimator from name

```typescript
export function createEstimator(name: string): ITokenEstimator
```

---

### createStrategy `function`

📍 [`src/core/context/strategies/index.ts:29`](src/core/context/strategies/index.ts)

Strategy factory - creates a strategy by name with options

```typescript
export function createStrategy(
  name: string,
  options: Record&lt;string, unknown&gt; =
```

---

### DEFAULT_CONTEXT_CONFIG `const`

📍 [`src/core/context/types.ts:100`](src/core/context/types.ts)

Default configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxContextTokens` | `128000` | - |
| `compactionThreshold` | `0.75` | - |
| `hardLimit` | `0.9` | - |
| `responseReserve` | `0.15` | - |
| `estimator` | `'approximate'` | - |
| `autoCompact` | `true` | - |
| `strategy` | `'proactive'` | - |
| `strategyOptions` | `{}` | - |

</details>

---

## Session Management

Persist and resume agent conversations

### ConnectorConfigStore `class`

📍 [`src/connectors/storage/ConnectorConfigStore.ts:31`](src/connectors/storage/ConnectorConfigStore.ts)

ConnectorConfigStore - manages connector configs with automatic encryption

Usage:
```typescript
const storage = new MemoryConnectorStorage();
const store = new ConnectorConfigStore(storage, process.env.ENCRYPTION_KEY!);

await store.save('openai', { auth: { type: 'api_key', apiKey: 'sk-xxx' } });
const config = await store.get('openai'); // apiKey is decrypted
```

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    private storage: IConnectorConfigStorage,
    private encryptionKey: string
  )
```

**Parameters:**
- `storage`: `IConnectorConfigStorage`
- `encryptionKey`: `string`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

Save a connector configuration (secrets are encrypted automatically)

```typescript
async save(name: string, config: ConnectorConfig): Promise&lt;void&gt;
```

**Parameters:**
- `name`: `string`
- `config`: `ConnectorConfig`

**Returns:** `Promise&lt;void&gt;`

#### `get()`

Retrieve a connector configuration (secrets are decrypted automatically)

```typescript
async get(name: string): Promise&lt;ConnectorConfig | null&gt;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;ConnectorConfig | null&gt;`

#### `delete()`

Delete a connector configuration

```typescript
async delete(name: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `has()`

Check if a connector configuration exists

```typescript
async has(name: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `list()`

List all connector names

```typescript
async list(): Promise&lt;string[]&gt;
```

**Returns:** `Promise&lt;string[]&gt;`

#### `listAll()`

Get all connector configurations (secrets are decrypted automatically)

```typescript
async listAll(): Promise&lt;ConnectorConfig[]&gt;
```

**Returns:** `Promise&lt;ConnectorConfig[]&gt;`

#### `getMetadata()`

Get stored metadata for a connector

```typescript
async getMetadata(
    name: string
  ): Promise&lt;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;{ createdAt: number; updatedAt: number; version: number; } | null&gt;`

</details>

---

### FileConnectorStorage `class`

📍 [`src/connectors/storage/FileConnectorStorage.ts:30`](src/connectors/storage/FileConnectorStorage.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: FileConnectorStorageConfig)
```

**Parameters:**
- `config`: `FileConnectorStorageConfig`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

```typescript
async save(name: string, stored: StoredConnectorConfig): Promise&lt;void&gt;
```

**Parameters:**
- `name`: `string`
- `stored`: `StoredConnectorConfig`

**Returns:** `Promise&lt;void&gt;`

#### `get()`

```typescript
async get(name: string): Promise&lt;StoredConnectorConfig | null&gt;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;StoredConnectorConfig | null&gt;`

#### `delete()`

```typescript
async delete(name: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `has()`

```typescript
async has(name: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `list()`

```typescript
async list(): Promise&lt;string[]&gt;
```

**Returns:** `Promise&lt;string[]&gt;`

#### `listAll()`

```typescript
async listAll(): Promise&lt;StoredConnectorConfig[]&gt;
```

**Returns:** `Promise&lt;StoredConnectorConfig[]&gt;`

#### `clear()`

Clear all stored configs (useful for testing)

```typescript
async clear(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `directory` | `directory: string` | - |
| `indexPath` | `indexPath: string` | - |
| `initialized` | `initialized: boolean` | - |

</details>

---

### FileSessionStorage `class`

📍 [`src/infrastructure/storage/FileSessionStorage.ts:51`](src/infrastructure/storage/FileSessionStorage.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: FileSessionStorageConfig)
```

**Parameters:**
- `config`: `FileSessionStorageConfig`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

```typescript
async save(session: Session): Promise&lt;void&gt;
```

**Parameters:**
- `session`: `Session`

**Returns:** `Promise&lt;void&gt;`

#### `load()`

```typescript
async load(sessionId: string): Promise&lt;Session | null&gt;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;Session | null&gt;`

#### `delete()`

```typescript
async delete(sessionId: string): Promise&lt;void&gt;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `exists()`

```typescript
async exists(sessionId: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `list()`

```typescript
async list(filter?: SessionFilter): Promise&lt;SessionSummary[]&gt;
```

**Parameters:**
- `filter`: `SessionFilter | undefined` *(optional)*

**Returns:** `Promise&lt;SessionSummary[]&gt;`

#### `search()`

```typescript
async search(query: string, filter?: SessionFilter): Promise&lt;SessionSummary[]&gt;
```

**Parameters:**
- `query`: `string`
- `filter`: `SessionFilter | undefined` *(optional)*

**Returns:** `Promise&lt;SessionSummary[]&gt;`

#### `rebuildIndex()`

Rebuild the index by scanning all session files
Useful for recovery or migration

```typescript
async rebuildIndex(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `getDirectory()`

Get the storage directory path

```typescript
getDirectory(): string
```

**Returns:** `string`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `directory` | `directory: string` | - |
| `prettyPrint` | `prettyPrint: boolean` | - |
| `extension` | `extension: string` | - |
| `indexPath` | `indexPath: string` | - |
| `index` | `index: SessionIndex | null` | - |

</details>

---

### FileStorage `class`

📍 [`src/connectors/oauth/infrastructure/storage/FileStorage.ts:17`](src/connectors/oauth/infrastructure/storage/FileStorage.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: FileStorageConfig)
```

**Parameters:**
- `config`: `FileStorageConfig`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `storeToken()`

```typescript
async storeToken(key: string, token: StoredToken): Promise&lt;void&gt;
```

**Parameters:**
- `key`: `string`
- `token`: `StoredToken`

**Returns:** `Promise&lt;void&gt;`

#### `getToken()`

```typescript
async getToken(key: string): Promise&lt;StoredToken | null&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;StoredToken | null&gt;`

#### `deleteToken()`

```typescript
async deleteToken(key: string): Promise&lt;void&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `hasToken()`

```typescript
async hasToken(key: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `listTokens()`

List all token keys (for debugging)

```typescript
async listTokens(): Promise&lt;string[]&gt;
```

**Returns:** `Promise&lt;string[]&gt;`

#### `clearAll()`

Clear all tokens

```typescript
async clearAll(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `directory` | `directory: string` | - |
| `encryptionKey` | `encryptionKey: string` | - |

</details>

---

### SessionManager `class`

📍 [`src/core/SessionManager.ts:456`](src/core/SessionManager.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: SessionManagerConfig)
```

**Parameters:**
- `config`: `SessionManagerConfig`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `create()`

Create a new session

```typescript
create(agentType: string, metadata?: SessionMetadata): Session
```

**Parameters:**
- `agentType`: `string`
- `metadata`: `SessionMetadata | undefined` *(optional)*

**Returns:** `Session`

#### `save()`

Save a session to storage

```typescript
async save(session: Session): Promise&lt;void&gt;
```

**Parameters:**
- `session`: `Session`

**Returns:** `Promise&lt;void&gt;`

#### `load()`

Load a session from storage

```typescript
async load(sessionId: string): Promise&lt;Session | null&gt;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;Session | null&gt;`

#### `delete()`

Delete a session from storage

```typescript
async delete(sessionId: string): Promise&lt;void&gt;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `exists()`

Check if a session exists

```typescript
async exists(sessionId: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `list()`

List sessions with optional filtering

```typescript
async list(filter?: SessionFilter): Promise&lt;SessionSummary[]&gt;
```

**Parameters:**
- `filter`: `SessionFilter | undefined` *(optional)*

**Returns:** `Promise&lt;SessionSummary[]&gt;`

#### `search()`

Search sessions by query string

```typescript
async search(query: string, filter?: SessionFilter): Promise&lt;SessionSummary[]&gt;
```

**Parameters:**
- `query`: `string`
- `filter`: `SessionFilter | undefined` *(optional)*

**Returns:** `Promise&lt;SessionSummary[]&gt;`

#### `fork()`

Fork a session (create a copy with new ID)

```typescript
async fork(sessionId: string, newMetadata?: Partial&lt;SessionMetadata&gt;): Promise&lt;Session&gt;
```

**Parameters:**
- `sessionId`: `string`
- `newMetadata`: `Partial&lt;SessionMetadata&gt; | undefined` *(optional)*

**Returns:** `Promise&lt;Session&gt;`

#### `updateMetadata()`

Update session metadata

```typescript
async updateMetadata(
    sessionId: string,
    metadata: Partial&lt;SessionMetadata&gt;
  ): Promise&lt;void&gt;
```

**Parameters:**
- `sessionId`: `string`
- `metadata`: `Partial&lt;SessionMetadata&gt;`

**Returns:** `Promise&lt;void&gt;`

#### `enableAutoSave()`

Enable auto-save for a session

```typescript
enableAutoSave(
    session: Session,
    intervalMs: number,
    onSave?: (session: Session) =&gt; void
  ): void
```

**Parameters:**
- `session`: `Session`
- `intervalMs`: `number`
- `onSave`: `((session: Session) =&gt; void) | undefined` *(optional)*

**Returns:** `void`

#### `stopAutoSave()`

Disable auto-save for a session

```typescript
stopAutoSave(sessionId: string): void
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `void`

#### `stopAllAutoSave()`

Stop all auto-save timers

```typescript
stopAllAutoSave(): void
```

**Returns:** `void`

#### `destroy()`

Cleanup resources

```typescript
destroy(): void
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `storage` | `storage: ISessionStorage` | - |
| `defaultMetadata` | `defaultMetadata: Partial&lt;SessionMetadata&gt;` | - |
| `autoSaveTimers` | `autoSaveTimers: Map&lt;string, NodeJS.Timeout&gt;` | - |
| `validateOnLoad` | `validateOnLoad: boolean` | - |
| `autoMigrate` | `autoMigrate: boolean` | - |
| `savesInFlight` | `savesInFlight: Set&lt;string&gt;` | - |
| `pendingSaves` | `pendingSaves: Set&lt;string&gt;` | - |

</details>

---

### FileConnectorStorageConfig `interface`

📍 [`src/connectors/storage/FileConnectorStorage.ts:20`](src/connectors/storage/FileConnectorStorage.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `directory` | `directory: string;` | Directory to store connector files |

</details>

---

### FileSessionStorageConfig `interface`

📍 [`src/infrastructure/storage/FileSessionStorage.ts:23`](src/infrastructure/storage/FileSessionStorage.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `directory` | `directory: string;` | Directory to store session files |
| `prettyPrint?` | `prettyPrint?: boolean;` | Pretty-print JSON (default: false for production) |
| `extension?` | `extension?: string;` | File extension (default: .json) |

</details>

---

### FileStorageConfig `interface`

📍 [`src/connectors/oauth/infrastructure/storage/FileStorage.ts:12`](src/connectors/oauth/infrastructure/storage/FileStorage.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `directory` | `directory: string;` | - |
| `encryptionKey` | `encryptionKey: string;` | - |

</details>

---

### IAgentStorage `interface`

📍 [`src/infrastructure/storage/InMemoryStorage.ts:182`](src/infrastructure/storage/InMemoryStorage.ts)

Unified agent storage interface

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `memory` | `memory: IMemoryStorage;` | - |
| `plan` | `plan: IPlanStorage;` | - |
| `agent` | `agent: IAgentStateStorage;` | - |

</details>

---

### ISessionStorage `interface`

📍 [`src/core/SessionManager.ts:205`](src/core/SessionManager.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

Save a session (create or update)

```typescript
save(session: Session): Promise&lt;void&gt;;
```

**Parameters:**
- `session`: `Session`

**Returns:** `Promise&lt;void&gt;`

#### `load()`

Load a session by ID

```typescript
load(sessionId: string): Promise&lt;Session | null&gt;;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;Session | null&gt;`

#### `delete()`

Delete a session by ID

```typescript
delete(sessionId: string): Promise&lt;void&gt;;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `exists()`

Check if a session exists

```typescript
exists(sessionId: string): Promise&lt;boolean&gt;;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `list()`

List sessions with optional filtering

```typescript
list(filter?: SessionFilter): Promise&lt;SessionSummary[]&gt;;
```

**Parameters:**
- `filter`: `SessionFilter | undefined` *(optional)*

**Returns:** `Promise&lt;SessionSummary[]&gt;`

#### `search()?`

Search sessions by query string (searches title, tags, metadata)

```typescript
search?(query: string, filter?: SessionFilter): Promise&lt;SessionSummary[]&gt;;
```

**Parameters:**
- `query`: `string`
- `filter`: `SessionFilter | undefined` *(optional)*

**Returns:** `Promise&lt;SessionSummary[]&gt;`

</details>

---

### SerializedHistory `interface`

📍 [`src/core/SessionManager.ts:135`](src/core/SessionManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `version` | `version: number;` | History format version |
| `entries` | `entries: SerializedHistoryEntry[];` | Serialized history entries |

</details>

---

### SerializedHistoryEntry `interface`

📍 [`src/core/SessionManager.ts:142`](src/core/SessionManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'user' | 'assistant' | 'tool_result' | 'system' | 'task_event' | 'plan_event';` | - |
| `content` | `content: unknown;` | - |
| `timestamp` | `timestamp: string;` | - |
| `metadata?` | `metadata?: Record&lt;string, unknown&gt;;` | - |

</details>

---

### Session `interface`

📍 [`src/core/SessionManager.ts:77`](src/core/SessionManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | Unique session identifier |
| `agentType` | `agentType: 'agent' | 'task-agent' | 'universal-agent' | string;` | Type of agent that owns this session |
| `createdAt` | `createdAt: Date;` | When the session was created |
| `lastActiveAt` | `lastActiveAt: Date;` | Last activity timestamp |
| `history` | `history: SerializedHistory;` | Serialized conversation history |
| `toolState` | `toolState: SerializedToolState;` | Tool enabled/disabled state |
| `memory?` | `memory?: SerializedMemory;` | Working memory contents (TaskAgent, UniversalAgent) |
| `plan?` | `plan?: SerializedPlan;` | Current plan (TaskAgent, UniversalAgent) |
| `mode?` | `mode?: string;` | Current mode (UniversalAgent) |
| `metrics?` | `metrics?: SessionMetrics;` | Execution metrics |
| `approvalState?` | `approvalState?: SerializedApprovalState;` | Tool permission approval state (all agent types) |
| `custom` | `custom: Record&lt;string, unknown&gt;;` | Agent-specific custom data |
| `metadata` | `metadata: SessionMetadata;` | - |

</details>

---

### SessionFilter `interface`

📍 [`src/core/SessionManager.ts:173`](src/core/SessionManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agentType?` | `agentType?: string;` | Filter by agent type |
| `userId?` | `userId?: string;` | Filter by user ID |
| `tags?` | `tags?: string[];` | Filter by tags (any match) |
| `createdAfter?` | `createdAfter?: Date;` | Filter by creation date range |
| `createdBefore?` | `createdBefore?: Date;` | - |
| `activeAfter?` | `activeAfter?: Date;` | Filter by last active date range |
| `activeBefore?` | `activeBefore?: Date;` | - |
| `limit?` | `limit?: number;` | Limit results |
| `offset?` | `offset?: number;` | Offset for pagination |

</details>

---

### SessionManagerConfig `interface`

📍 [`src/core/SessionManager.ts:250`](src/core/SessionManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `storage` | `storage: ISessionStorage;` | - |
| `defaultMetadata?` | `defaultMetadata?: Partial&lt;SessionMetadata&gt;;` | Default metadata for new sessions |
| `validateOnLoad?` | `validateOnLoad?: boolean;` | Validate sessions on load (default: true) |
| `autoMigrate?` | `autoMigrate?: boolean;` | Auto-migrate sessions with fixable issues (default: true) |

</details>

---

### SessionMetadata `interface`

📍 [`src/core/SessionManager.ts:117`](src/core/SessionManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `userId?` | `userId?: string;` | Optional user identifier |
| `title?` | `title?: string;` | Human-readable title |
| `tags?` | `tags?: string[];` | Tags for filtering |

</details>

---

### SessionMetrics `interface`

📍 [`src/core/SessionManager.ts:128`](src/core/SessionManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `totalMessages` | `totalMessages: number;` | - |
| `totalToolCalls` | `totalToolCalls: number;` | - |
| `totalTokens` | `totalTokens: number;` | - |
| `totalDurationMs` | `totalDurationMs: number;` | - |

</details>

---

### SessionSummary `interface`

📍 [`src/core/SessionManager.ts:192`](src/core/SessionManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | - |
| `agentType` | `agentType: string;` | - |
| `createdAt` | `createdAt: Date;` | - |
| `lastActiveAt` | `lastActiveAt: Date;` | - |
| `metadata` | `metadata: SessionMetadata;` | - |
| `messageCount` | `messageCount: number;` | - |

</details>

---

### SessionManagerEvent `type`

📍 [`src/core/SessionManager.ts:241`](src/core/SessionManager.ts)

```typescript
type SessionManagerEvent = | 'session:created'
  | 'session:saved'
  | 'session:loaded'
  | 'session:deleted'
  | 'session:error'
  | 'session:warning'
  | 'session:migrated'
```

---

### addHistoryEntry `function`

📍 [`src/core/SessionManager.ts:799`](src/core/SessionManager.ts)

Add an entry to serialized history

```typescript
export function addHistoryEntry(
  history: SerializedHistory,
  type: SerializedHistoryEntry['type'],
  content: unknown,
  metadata?: Record&lt;string, unknown&gt;
): void
```

---

### createAgentStorage `function`

📍 [`src/infrastructure/storage/InMemoryStorage.ts:191`](src/infrastructure/storage/InMemoryStorage.ts)

Create agent storage with defaults

```typescript
export function createAgentStorage(options:
```

---

### createEmptyHistory `function`

📍 [`src/core/SessionManager.ts:785`](src/core/SessionManager.ts)

Create an empty serialized history

```typescript
export function createEmptyHistory(): SerializedHistory
```

---

## Tools & Function Calling

Define and execute tools for agents

### ConnectorTools `class`

📍 [`src/tools/connector/ConnectorTools.ts:110`](src/tools/connector/ConnectorTools.ts)

ConnectorTools - Main API for vendor-dependent tools

Usage:
```typescript
// Get all tools for a connector
const tools = ConnectorTools.for('slack');

// Get just the generic API tool
const apiTool = ConnectorTools.genericAPI('github');

// Discover all available connector tools
const allTools = ConnectorTools.discoverAll();
```

<details>
<summary><strong>Static Methods</strong></summary>

#### `static clearCache()`

Clear all caches (useful for testing or when connectors change)

```typescript
static clearCache(): void
```

**Returns:** `void`

#### `static invalidateCache()`

Invalidate cache for a specific connector

```typescript
static invalidateCache(connectorName: string): void
```

**Parameters:**
- `connectorName`: `string`

**Returns:** `void`

#### `static registerService()`

Register a tool factory for a service type

```typescript
static registerService(serviceType: string, factory: ServiceToolFactory): void
```

**Parameters:**
- `serviceType`: `string`
- `factory`: `ServiceToolFactory`

**Returns:** `void`

#### `static unregisterService()`

Unregister a service tool factory

```typescript
static unregisterService(serviceType: string): boolean
```

**Parameters:**
- `serviceType`: `string`

**Returns:** `boolean`

#### `static for()`

Get ALL tools for a connector (generic API + service-specific)
This is the main entry point

```typescript
static for(connectorOrName: Connector | string, userId?: string): ToolFunction[]
```

**Parameters:**
- `connectorOrName`: `string | Connector`
- `userId`: `string | undefined` *(optional)*

**Returns:** `ToolFunction&lt;any, any&gt;[]`

#### `static genericAPI()`

Get just the generic API tool for a connector

```typescript
static genericAPI(
    connectorOrName: Connector | string,
    options?: GenericAPIToolOptions
  ): ToolFunction&lt;GenericAPICallArgs, GenericAPICallResult&gt;
```

**Parameters:**
- `connectorOrName`: `string | Connector`
- `options`: `GenericAPIToolOptions | undefined` *(optional)*

**Returns:** `ToolFunction&lt;GenericAPICallArgs, GenericAPICallResult&gt;`

#### `static serviceTools()`

Get only service-specific tools (no generic API tool)

```typescript
static serviceTools(connectorOrName: Connector | string, userId?: string): ToolFunction[]
```

**Parameters:**
- `connectorOrName`: `string | Connector`
- `userId`: `string | undefined` *(optional)*

**Returns:** `ToolFunction&lt;any, any&gt;[]`

#### `static discoverAll()`

Discover tools for ALL registered connectors with external services
Skips AI provider connectors (those with vendor but no serviceType)

```typescript
static discoverAll(userId?: string): Map&lt;string, ToolFunction[]&gt;
```

**Parameters:**
- `userId`: `string | undefined` *(optional)*

**Returns:** `Map&lt;string, ToolFunction&lt;any, any&gt;[]&gt;`

#### `static findConnector()`

Find a connector by service type
Returns the first connector matching the service type

```typescript
static findConnector(serviceType: string): Connector | undefined
```

**Parameters:**
- `serviceType`: `string`

**Returns:** `Connector | undefined`

#### `static findConnectors()`

Find all connectors for a service type
Useful when you have multiple connectors for the same service

```typescript
static findConnectors(serviceType: string): Connector[]
```

**Parameters:**
- `serviceType`: `string`

**Returns:** `Connector[]`

#### `static listSupportedServices()`

List services that have registered tool factories

```typescript
static listSupportedServices(): string[]
```

**Returns:** `string[]`

#### `static hasServiceTools()`

Check if a service has dedicated tool factory

```typescript
static hasServiceTools(serviceType: string): boolean
```

**Parameters:**
- `serviceType`: `string`

**Returns:** `boolean`

#### `static detectService()`

Detect the service type for a connector
Uses explicit serviceType if set, otherwise infers from baseURL
Results are cached for performance

```typescript
static detectService(connector: Connector): string | undefined
```

**Parameters:**
- `connector`: `Connector`

**Returns:** `string | undefined`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `factories` | `factories: Map&lt;string, ServiceToolFactory&gt;` | Registry of service-specific tool factories |
| `serviceTypeCache` | `serviceTypeCache: Map&lt;string, string | undefined&gt;` | Cache for detected service types (connector name -> service type) |
| `toolCache` | `toolCache: Map&lt;string, ToolFunction&lt;any, any&gt;[]&gt;` | Cache for generated tools (cacheKey -> tools) |
| `MAX_CACHE_SIZE` | `MAX_CACHE_SIZE: 100` | Maximum cache size to prevent memory issues |

</details>

---

### InvalidToolArgumentsError `class`

📍 [`src/domain/errors/AIErrors.ts:137`](src/domain/errors/AIErrors.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    toolName: string,
    public readonly rawArguments: string,
    public readonly parseError?: Error
  )
```

**Parameters:**
- `toolName`: `string`
- `rawArguments`: `string`
- `parseError`: `Error | undefined` *(optional)*

</details>

---

### MCPToolError `class`

📍 [`src/domain/errors/MCPError.ts:62`](src/domain/errors/MCPError.ts)

Tool execution errors (tool not found, tool execution failed)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    message: string,
    public readonly toolName: string,
    serverName?: string,
    cause?: Error
  )
```

**Parameters:**
- `message`: `string`
- `toolName`: `string`
- `serverName`: `string | undefined` *(optional)*
- `cause`: `Error | undefined` *(optional)*

</details>

---

### ToolExecutionError `class`

📍 [`src/domain/errors/AIErrors.ts:73`](src/domain/errors/AIErrors.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    toolName: string,
    message: string,
    public readonly originalError?: Error
  )
```

**Parameters:**
- `toolName`: `string`
- `message`: `string`
- `originalError`: `Error | undefined` *(optional)*

</details>

---

### ToolManager `class`

📍 [`src/core/ToolManager.ts:122`](src/core/ToolManager.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor()
```

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `destroy()`

Releases all resources held by this ToolManager.
Cleans up circuit breaker listeners and removes all event listeners.
Safe to call multiple times (idempotent).

```typescript
destroy(): void
```

**Returns:** `void`

#### `setToolContext()`

Set tool context for execution (called by agent before runs)

```typescript
setToolContext(context: ToolContext | undefined): void
```

**Parameters:**
- `context`: `ToolContext | undefined`

**Returns:** `void`

#### `getToolContext()`

Get current tool context

```typescript
getToolContext(): ToolContext | undefined
```

**Returns:** `ToolContext | undefined`

#### `register()`

Register a tool with optional configuration

```typescript
register(tool: ToolFunction, options: ToolOptions =
```

**Parameters:**
- `tool`: `ToolFunction&lt;any, any&gt;`
- `options`: `ToolOptions` *(optional)* (default: `{}`)

**Returns:** `void`

#### `registerMany()`

Register multiple tools at once

```typescript
registerMany(tools: ToolFunction[], options: Omit&lt;ToolOptions, 'conditions'&gt; =
```

**Parameters:**
- `tools`: `ToolFunction&lt;any, any&gt;[]`
- `options`: `Omit&lt;ToolOptions, "conditions"&gt;` *(optional)* (default: `{}`)

**Returns:** `void`

#### `unregister()`

Unregister a tool by name

```typescript
unregister(name: string): boolean
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

#### `clear()`

Clear all tools and their circuit breakers.
Does NOT remove event listeners from this ToolManager (use destroy() for full cleanup).

```typescript
clear(): void
```

**Returns:** `void`

#### `enable()`

Enable a tool by name

```typescript
enable(name: string): boolean
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

#### `disable()`

Disable a tool by name (keeps it registered but inactive)

```typescript
disable(name: string): boolean
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

#### `toggle()`

Toggle a tool's enabled state

```typescript
toggle(name: string): boolean
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

#### `isEnabled()`

Check if a tool is enabled

```typescript
isEnabled(name: string): boolean
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

#### `setEnabled()`

Set enabled state for multiple tools

```typescript
setEnabled(names: string[], enabled: boolean): void
```

**Parameters:**
- `names`: `string[]`
- `enabled`: `boolean`

**Returns:** `void`

#### `setNamespace()`

Set the namespace for a tool

```typescript
setNamespace(toolName: string, namespace: string): boolean
```

**Parameters:**
- `toolName`: `string`
- `namespace`: `string`

**Returns:** `boolean`

#### `enableNamespace()`

Enable all tools in a namespace

```typescript
enableNamespace(namespace: string): void
```

**Parameters:**
- `namespace`: `string`

**Returns:** `void`

#### `disableNamespace()`

Disable all tools in a namespace

```typescript
disableNamespace(namespace: string): void
```

**Parameters:**
- `namespace`: `string`

**Returns:** `void`

#### `getNamespaces()`

Get all namespace names

```typescript
getNamespaces(): string[]
```

**Returns:** `string[]`

#### `createNamespace()`

Create a namespace with tools

```typescript
createNamespace(namespace: string, tools: ToolFunction[], options: Omit&lt;ToolOptions, 'namespace'&gt; =
```

**Parameters:**
- `namespace`: `string`
- `tools`: `ToolFunction&lt;any, any&gt;[]`
- `options`: `Omit&lt;ToolOptions, "namespace"&gt;` *(optional)* (default: `{}`)

**Returns:** `void`

#### `setPriority()`

Set priority for a tool

```typescript
setPriority(name: string, priority: number): boolean
```

**Parameters:**
- `name`: `string`
- `priority`: `number`

**Returns:** `boolean`

#### `getPriority()`

Get priority for a tool

```typescript
getPriority(name: string): number | undefined
```

**Parameters:**
- `name`: `string`

**Returns:** `number | undefined`

#### `getPermission()`

Get permission config for a tool

```typescript
getPermission(name: string): ToolPermissionConfig | undefined
```

**Parameters:**
- `name`: `string`

**Returns:** `ToolPermissionConfig | undefined`

#### `setPermission()`

Set permission config for a tool

```typescript
setPermission(name: string, permission: ToolPermissionConfig): boolean
```

**Parameters:**
- `name`: `string`
- `permission`: `ToolPermissionConfig`

**Returns:** `boolean`

#### `get()`

Get a tool by name

```typescript
get(name: string): ToolFunction | undefined
```

**Parameters:**
- `name`: `string`

**Returns:** `ToolFunction&lt;any, any&gt; | undefined`

#### `has()`

Check if a tool exists

```typescript
has(name: string): boolean
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

#### `getEnabled()`

Get all enabled tools (sorted by priority)

```typescript
getEnabled(): ToolFunction[]
```

**Returns:** `ToolFunction&lt;any, any&gt;[]`

#### `getAll()`

Get all tools (enabled and disabled)

```typescript
getAll(): ToolFunction[]
```

**Returns:** `ToolFunction&lt;any, any&gt;[]`

#### `getByNamespace()`

Get tools by namespace

```typescript
getByNamespace(namespace: string): ToolFunction[]
```

**Parameters:**
- `namespace`: `string`

**Returns:** `ToolFunction&lt;any, any&gt;[]`

#### `getRegistration()`

Get tool registration info

```typescript
getRegistration(name: string): ToolRegistration | undefined
```

**Parameters:**
- `name`: `string`

**Returns:** `ToolRegistration | undefined`

#### `list()`

List all tool names

```typescript
list(): string[]
```

**Returns:** `string[]`

#### `listEnabled()`

List enabled tool names

```typescript
listEnabled(): string[]
```

**Returns:** `string[]`

#### `selectForContext()`

Select tools based on context (uses conditions and smart filtering)

```typescript
selectForContext(context: ToolSelectionContext): ToolFunction[]
```

**Parameters:**
- `context`: `ToolSelectionContext`

**Returns:** `ToolFunction&lt;any, any&gt;[]`

#### `selectByCapability()`

Select tools by matching capability description

```typescript
selectByCapability(description: string): ToolFunction[]
```

**Parameters:**
- `description`: `string`

**Returns:** `ToolFunction&lt;any, any&gt;[]`

#### `selectWithinBudget()`

Filter tools to fit within a token budget

```typescript
selectWithinBudget(budget: number): ToolFunction[]
```

**Parameters:**
- `budget`: `number`

**Returns:** `ToolFunction&lt;any, any&gt;[]`

#### `recordExecution()`

Record tool execution (called by agent/loop)

```typescript
recordExecution(
    name: string,
    executionMs: number,
    success: boolean
  ): void
```

**Parameters:**
- `name`: `string`
- `executionMs`: `number`
- `success`: `boolean`

**Returns:** `void`

#### `getStats()`

Get comprehensive statistics

```typescript
getStats(): ToolManagerStats
```

**Returns:** `ToolManagerStats`

#### `execute()`

Execute a tool function with circuit breaker protection
Implements IToolExecutor interface

```typescript
async execute(toolName: string, args: any): Promise&lt;any&gt;
```

**Parameters:**
- `toolName`: `string`
- `args`: `any`

**Returns:** `Promise&lt;any&gt;`

#### `hasToolFunction()`

Check if tool is available (IToolExecutor interface)

```typescript
hasToolFunction(toolName: string): boolean
```

**Parameters:**
- `toolName`: `string`

**Returns:** `boolean`

#### `getToolDefinition()`

Get tool definition (IToolExecutor interface)

```typescript
getToolDefinition(toolName: string): Tool | undefined
```

**Parameters:**
- `toolName`: `string`

**Returns:** `Tool | undefined`

#### `registerTool()`

Register a tool (IToolExecutor interface - delegates to register())

```typescript
registerTool(tool: ToolFunction): void
```

**Parameters:**
- `tool`: `ToolFunction&lt;any, any&gt;`

**Returns:** `void`

#### `unregisterTool()`

Unregister a tool (IToolExecutor interface - delegates to unregister())

```typescript
unregisterTool(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `listTools()`

List all registered tool names (IToolExecutor interface - delegates to list())

```typescript
listTools(): string[]
```

**Returns:** `string[]`

#### `getCircuitBreakerStates()`

Get circuit breaker states for all tools

```typescript
getCircuitBreakerStates(): Map&lt;string, CircuitState&gt;
```

**Returns:** `Map&lt;string, CircuitState&gt;`

#### `getToolCircuitBreakerMetrics()`

Get circuit breaker metrics for a specific tool

```typescript
getToolCircuitBreakerMetrics(toolName: string)
```

**Parameters:**
- `toolName`: `string`

**Returns:** `CircuitBreakerMetrics | undefined`

#### `resetToolCircuitBreaker()`

Manually reset a tool's circuit breaker

```typescript
resetToolCircuitBreaker(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `setCircuitBreakerConfig()`

Configure circuit breaker for a tool

```typescript
setCircuitBreakerConfig(toolName: string, config: CircuitBreakerConfig): boolean
```

**Parameters:**
- `toolName`: `string`
- `config`: `CircuitBreakerConfig`

**Returns:** `boolean`

#### `getState()`

Get serializable state (for session persistence)

```typescript
getState(): SerializedToolState
```

**Returns:** `SerializedToolState`

#### `loadState()`

Load state (restores enabled/disabled, namespaces, priorities, permissions)
Note: Tools must be re-registered separately (they contain functions)

```typescript
loadState(state: SerializedToolState): void
```

**Parameters:**
- `state`: `SerializedToolState`

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `registry` | `registry: Map&lt;string, ToolRegistration&gt;` | - |
| `namespaceIndex` | `namespaceIndex: Map&lt;string, Set&lt;string&gt;&gt;` | - |
| `circuitBreakers` | `circuitBreakers: Map&lt;string, CircuitBreaker&lt;any&gt;&gt;` | - |
| `toolLogger` | `toolLogger: FrameworkLogger` | - |

</details>

---

### ToolNotFoundError `class`

📍 [`src/domain/errors/AIErrors.ts:105`](src/domain/errors/AIErrors.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(toolName: string)
```

**Parameters:**
- `toolName`: `string`

</details>

---

### ToolPermissionManager `class`

📍 [`src/core/permissions/ToolPermissionManager.ts:56`](src/core/permissions/ToolPermissionManager.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config?: AgentPermissionsConfig)
```

**Parameters:**
- `config`: `AgentPermissionsConfig | undefined` *(optional)*

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `checkPermission()`

Check if a tool needs approval before execution

```typescript
checkPermission(toolName: string, _args?: Record&lt;string, unknown&gt;): PermissionCheckResult
```

**Parameters:**
- `toolName`: `string`
- `_args`: `Record&lt;string, unknown&gt; | undefined` *(optional)*

**Returns:** `PermissionCheckResult`

#### `needsApproval()`

Check if a tool call needs approval (uses ToolCall object)

```typescript
needsApproval(toolCall: ToolCall): boolean
```

**Parameters:**
- `toolCall`: `ToolCall`

**Returns:** `boolean`

#### `isBlocked()`

Check if a tool is blocked

```typescript
isBlocked(toolName: string): boolean
```

**Parameters:**
- `toolName`: `string`

**Returns:** `boolean`

#### `isApproved()`

Check if a tool is approved (either allowlisted or session-approved)

```typescript
isApproved(toolName: string): boolean
```

**Parameters:**
- `toolName`: `string`

**Returns:** `boolean`

#### `approve()`

Approve a tool (record approval)

```typescript
approve(toolName: string, decision?: Partial&lt;ApprovalDecision&gt;): void
```

**Parameters:**
- `toolName`: `string`
- `decision`: `Partial&lt;ApprovalDecision&gt; | undefined` *(optional)*

**Returns:** `void`

#### `approveForSession()`

Approve a tool for the entire session

```typescript
approveForSession(toolName: string, approvedBy?: string): void
```

**Parameters:**
- `toolName`: `string`
- `approvedBy`: `string | undefined` *(optional)*

**Returns:** `void`

#### `revoke()`

Revoke a tool's approval

```typescript
revoke(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `deny()`

Deny a tool execution (for audit trail)

```typescript
deny(toolName: string, reason: string): void
```

**Parameters:**
- `toolName`: `string`
- `reason`: `string`

**Returns:** `void`

#### `isApprovedForSession()`

Check if a tool has been approved for the current session

```typescript
isApprovedForSession(toolName: string): boolean
```

**Parameters:**
- `toolName`: `string`

**Returns:** `boolean`

#### `allowlistAdd()`

Add a tool to the allowlist (always allowed)

```typescript
allowlistAdd(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `allowlistRemove()`

Remove a tool from the allowlist

```typescript
allowlistRemove(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `isAllowlisted()`

Check if a tool is in the allowlist

```typescript
isAllowlisted(toolName: string): boolean
```

**Parameters:**
- `toolName`: `string`

**Returns:** `boolean`

#### `getAllowlist()`

Get all allowlisted tools

```typescript
getAllowlist(): string[]
```

**Returns:** `string[]`

#### `blocklistAdd()`

Add a tool to the blocklist (always blocked)

```typescript
blocklistAdd(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `blocklistRemove()`

Remove a tool from the blocklist

```typescript
blocklistRemove(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `isBlocklisted()`

Check if a tool is in the blocklist

```typescript
isBlocklisted(toolName: string): boolean
```

**Parameters:**
- `toolName`: `string`

**Returns:** `boolean`

#### `getBlocklist()`

Get all blocklisted tools

```typescript
getBlocklist(): string[]
```

**Returns:** `string[]`

#### `setToolConfig()`

Set permission config for a specific tool

```typescript
setToolConfig(toolName: string, config: ToolPermissionConfig): void
```

**Parameters:**
- `toolName`: `string`
- `config`: `ToolPermissionConfig`

**Returns:** `void`

#### `getToolConfig()`

Get permission config for a specific tool

```typescript
getToolConfig(toolName: string): ToolPermissionConfig | undefined
```

**Parameters:**
- `toolName`: `string`

**Returns:** `ToolPermissionConfig | undefined`

#### `getEffectiveConfig()`

Get effective config (tool-specific or defaults)

```typescript
getEffectiveConfig(toolName: string): ToolPermissionConfig
```

**Parameters:**
- `toolName`: `string`

**Returns:** `ToolPermissionConfig`

#### `requestApproval()`

Request approval for a tool call

If an onApprovalRequired callback is set, it will be called.
Otherwise, this auto-approves for backward compatibility.

NOTE: If you want to require explicit approval, you MUST either:
1. Set onApprovalRequired callback in AgentPermissionsConfig
2. Register an 'approve:tool' hook in the AgenticLoop
3. Add tools to the blocklist if they should never run

This auto-approval behavior preserves backward compatibility with
existing code that doesn't use the permission system.

```typescript
async requestApproval(context: PermissionCheckContext): Promise&lt;ApprovalDecision&gt;
```

**Parameters:**
- `context`: `PermissionCheckContext`

**Returns:** `Promise&lt;ApprovalDecision&gt;`

#### `getApprovedTools()`

Get all tools that have session approvals

```typescript
getApprovedTools(): string[]
```

**Returns:** `string[]`

#### `getApprovalEntry()`

Get the approval entry for a tool

```typescript
getApprovalEntry(toolName: string): ApprovalCacheEntry | undefined
```

**Parameters:**
- `toolName`: `string`

**Returns:** `ApprovalCacheEntry | undefined`

#### `clearSession()`

Clear all session approvals

```typescript
clearSession(): void
```

**Returns:** `void`

#### `getState()`

Serialize approval state for persistence

```typescript
getState(): SerializedApprovalState
```

**Returns:** `SerializedApprovalState`

#### `loadState()`

Load approval state from persistence

```typescript
loadState(state: SerializedApprovalState): void
```

**Parameters:**
- `state`: `SerializedApprovalState`

**Returns:** `void`

#### `getDefaults()`

Get defaults

```typescript
getDefaults():
```

**Returns:** `{ scope: PermissionScope; riskLevel: RiskLevel; }`

#### `setDefaults()`

Set defaults

```typescript
setDefaults(defaults:
```

**Parameters:**
- `defaults`: `{ scope?: PermissionScope | undefined; riskLevel?: RiskLevel | undefined; }`

**Returns:** `void`

#### `getStats()`

Get summary statistics

```typescript
getStats():
```

**Returns:** `{ approvedCount: number; allowlistedCount: number; blocklistedCount: number; configuredCount: number; }`

#### `reset()`

Reset to initial state

```typescript
reset(): void
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `approvalCache` | `approvalCache: Map&lt;string, ApprovalCacheEntry&gt;` | - |
| `allowlist` | `allowlist: Set&lt;string&gt;` | - |
| `blocklist` | `blocklist: Set&lt;string&gt;` | - |
| `toolConfigs` | `toolConfigs: Map&lt;string, ToolPermissionConfig&gt;` | - |
| `defaultScope` | `defaultScope: PermissionScope` | - |
| `defaultRiskLevel` | `defaultRiskLevel: RiskLevel` | - |
| `onApprovalRequired?` | `onApprovalRequired: ((context: PermissionCheckContext) =&gt; Promise&lt;ApprovalDecision&gt;) | undefined` | - |

</details>

---

### ToolTimeoutError `class`

📍 [`src/domain/errors/AIErrors.ts:90`](src/domain/errors/AIErrors.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    toolName: string,
    public readonly timeoutMs: number
  )
```

**Parameters:**
- `toolName`: `string`
- `timeoutMs`: `number`

</details>

---

### AfterToolContext `interface`

📍 [`src/capabilities/agents/types/HookTypes.ts:65`](src/capabilities/agents/types/HookTypes.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `executionId` | `executionId: string;` | - |
| `iteration` | `iteration: number;` | - |
| `toolCall` | `toolCall: ToolCall;` | - |
| `result` | `result: ToolResult;` | - |
| `context` | `context: ExecutionContext;` | - |
| `timestamp` | `timestamp: Date;` | - |

</details>

---

### ApproveToolContext `interface`

📍 [`src/capabilities/agents/types/HookTypes.ts:74`](src/capabilities/agents/types/HookTypes.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `executionId` | `executionId: string;` | - |
| `iteration` | `iteration: number;` | - |
| `toolCall` | `toolCall: ToolCall;` | - |
| `context` | `context: ExecutionContext;` | - |
| `timestamp` | `timestamp: Date;` | - |

</details>

---

### BeforeToolContext `interface`

📍 [`src/capabilities/agents/types/HookTypes.ts:57`](src/capabilities/agents/types/HookTypes.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `executionId` | `executionId: string;` | - |
| `iteration` | `iteration: number;` | - |
| `toolCall` | `toolCall: ToolCall;` | - |
| `context` | `context: ExecutionContext;` | - |
| `timestamp` | `timestamp: Date;` | - |

</details>

---

### BuiltInTool `interface`

📍 [`src/domain/entities/Tool.ts:30`](src/domain/entities/Tool.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'web_search' | 'file_search' | 'computer_use' | 'code_interpreter';` | - |
| `blocking?` | `blocking?: boolean;` | - |

</details>

---

### FilesystemToolConfig `interface`

📍 [`src/tools/filesystem/types.ts:13`](src/tools/filesystem/types.ts)

Configuration for filesystem tools

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `workingDirectory?` | `workingDirectory?: string;` | Base working directory for all operations.
All paths will be resolved relative to this directory.
Defaults to process.cwd() |
| `allowedDirectories?` | `allowedDirectories?: string[];` | Allowed directories for file operations.
If specified, operations outside these directories will be blocked.
Paths can be absolute or relative to workingDirectory. |
| `blockedDirectories?` | `blockedDirectories?: string[];` | Blocked directories (e.g., node_modules, .git).
Operations in these directories will be blocked. |
| `maxFileSize?` | `maxFileSize?: number;` | Maximum file size to read (in bytes).
Default: 10MB |
| `maxResults?` | `maxResults?: number;` | Maximum number of results for glob/grep operations.
Default: 1000 |
| `followSymlinks?` | `followSymlinks?: boolean;` | Whether to follow symlinks.
Default: false |
| `excludeExtensions?` | `excludeExtensions?: string[];` | File extensions to exclude from search.
Default: common binary extensions |

</details>

---

### FunctionToolDefinition `interface`

📍 [`src/domain/entities/Tool.ts:18`](src/domain/entities/Tool.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'function';` | - |
| `function` | `function: {
    name: string;
    description?: string;
    parameters?: JSONSchema;
    strict?: boolean; // Enforce schema strictly
  };` | - |
| `blocking?` | `blocking?: boolean;` | - |
| `timeout?` | `timeout?: number;` | - |

</details>

---

### GenericAPICallArgs `interface`

📍 [`src/tools/connector/ConnectorTools.ts:77`](src/tools/connector/ConnectorTools.ts)

Arguments for the generic API call tool

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `method` | `method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';` | - |
| `endpoint` | `endpoint: string;` | - |
| `body?` | `body?: Record&lt;string, unknown&gt;;` | - |
| `queryParams?` | `queryParams?: Record&lt;string, string | number | boolean&gt;;` | - |
| `headers?` | `headers?: Record&lt;string, string&gt;;` | - |

</details>

---

### GenericAPICallResult `interface`

📍 [`src/tools/connector/ConnectorTools.ts:88`](src/tools/connector/ConnectorTools.ts)

Result from the generic API call tool

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `status?` | `status?: number;` | - |
| `data?` | `data?: unknown;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### GenericAPIToolOptions `interface`

📍 [`src/tools/connector/ConnectorTools.ts:63`](src/tools/connector/ConnectorTools.ts)

Options for generating the generic API tool

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `toolName?` | `toolName?: string;` | Override the tool name (default: `${connectorName}_api`) |
| `description?` | `description?: string;` | Override the description |
| `userId?` | `userId?: string;` | User ID for multi-user OAuth |
| `permission?` | `permission?: ToolPermissionConfig;` | Permission config for the tool |

</details>

---

### IToolExecutor `interface`

📍 [`src/domain/interfaces/IToolExecutor.ts:7`](src/domain/interfaces/IToolExecutor.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `execute()`

Execute a tool function

```typescript
execute(toolName: string, args: any): Promise&lt;any&gt;;
```

**Parameters:**
- `toolName`: `string`
- `args`: `any`

**Returns:** `Promise&lt;any&gt;`

#### `hasToolFunction()`

Check if tool is available

```typescript
hasToolFunction(toolName: string): boolean;
```

**Parameters:**
- `toolName`: `string`

**Returns:** `boolean`

#### `getToolDefinition()`

Get tool definition

```typescript
getToolDefinition(toolName: string): Tool | undefined;
```

**Parameters:**
- `toolName`: `string`

**Returns:** `Tool | undefined`

#### `registerTool()`

Register a new tool

```typescript
registerTool(tool: ToolFunction): void;
```

**Parameters:**
- `tool`: `ToolFunction&lt;any, any&gt;`

**Returns:** `void`

#### `unregisterTool()`

Unregister a tool

```typescript
unregisterTool(toolName: string): void;
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `listTools()`

List all registered tools

```typescript
listTools(): string[];
```

**Returns:** `string[]`

</details>

---

### JSONSchema `interface`

📍 [`src/domain/entities/Tool.ts:11`](src/domain/entities/Tool.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: string;` | - |
| `properties?` | `properties?: Record&lt;string, any&gt;;` | - |
| `required?` | `required?: string[];` | - |

</details>

---

### MCPTool `interface`

📍 [`src/domain/entities/MCPTypes.ts:11`](src/domain/entities/MCPTypes.ts)

MCP Domain Types

Core types for MCP tools, resources, and prompts.
These are simplified wrappers around the SDK types.

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string;` | Tool name |
| `description?` | `description?: string;` | Tool description |
| `inputSchema` | `inputSchema: {
    type: 'object';
    properties?: Record&lt;string, unknown&gt;;
    required?: string[];
    [key: string]: unknown;
  };` | JSON Schema for tool input |

</details>

---

### MCPToolResult `interface`

📍 [`src/domain/entities/MCPTypes.ts:28`](src/domain/entities/MCPTypes.ts)

MCP Tool call result

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `content` | `content: Array&lt;{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }&gt;;` | Result content |
| `isError?` | `isError?: boolean;` | Whether the tool call resulted in an error |

</details>

---

### SerializedToolState `interface`

📍 [`src/core/ToolManager.ts:101`](src/core/ToolManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `enabled: Record&lt;string, boolean&gt;;` | - |
| `namespaces` | `namespaces: Record&lt;string, string&gt;;` | - |
| `priorities` | `priorities: Record&lt;string, number&gt;;` | - |
| `permissions?` | `permissions?: Record&lt;string, ToolPermissionConfig&gt;;` | Permission configs by tool name |

</details>

---

### ShellToolConfig `interface`

📍 [`src/tools/shell/types.ts:10`](src/tools/shell/types.ts)

Shell Tools - Shared Types

Common types and configuration for shell command execution.

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `workingDirectory?` | `workingDirectory?: string;` | Working directory for command execution.
Defaults to process.cwd() |
| `defaultTimeout?` | `defaultTimeout?: number;` | Default timeout for commands in milliseconds.
Default: 120000 (2 minutes) |
| `maxTimeout?` | `maxTimeout?: number;` | Maximum timeout allowed in milliseconds.
Default: 600000 (10 minutes) |
| `shell?` | `shell?: string;` | Shell to use for command execution.
Default: '/bin/bash' on Unix, 'cmd.exe' on Windows |
| `env?` | `env?: Record&lt;string, string&gt;;` | Environment variables to add to command execution. |
| `blockedCommands?` | `blockedCommands?: string[];` | Commands that are blocked from execution.
Default: dangerous commands like rm -rf / |
| `blockedPatterns?` | `blockedPatterns?: RegExp[];` | Patterns that if matched will block the command.
Default: patterns that could cause data loss |
| `maxOutputSize?` | `maxOutputSize?: number;` | Maximum output size in characters before truncation.
Default: 100000 (100KB) |
| `allowBackground?` | `allowBackground?: boolean;` | Whether to allow running commands in background.
Default: true |

</details>

---

### ToolCall `interface`

📍 [`src/domain/entities/Tool.ts:45`](src/domain/entities/Tool.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | - |
| `type` | `type: 'function';` | - |
| `function` | `function: {
    name: string;
    arguments: string; // JSON string
  };` | - |
| `blocking` | `blocking: boolean;` | - |
| `state` | `state: ToolCallState;` | - |
| `startTime?` | `startTime?: Date;` | - |
| `endTime?` | `endTime?: Date;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### ToolCallArgumentsDeltaEvent `interface`

📍 [`src/domain/entities/StreamEvent.ts:85`](src/domain/entities/StreamEvent.ts)

Tool call arguments delta - incremental JSON

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: StreamEventType.TOOL_CALL_ARGUMENTS_DELTA;` | - |
| `item_id` | `item_id: string;` | - |
| `tool_call_id` | `tool_call_id: string;` | - |
| `tool_name` | `tool_name: string;` | - |
| `delta` | `delta: string;` | - |
| `sequence_number` | `sequence_number: number;` | - |

</details>

---

### ToolCallArgumentsDoneEvent `interface`

📍 [`src/domain/entities/StreamEvent.ts:97`](src/domain/entities/StreamEvent.ts)

Tool call arguments complete

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: StreamEventType.TOOL_CALL_ARGUMENTS_DONE;` | - |
| `tool_call_id` | `tool_call_id: string;` | - |
| `tool_name` | `tool_name: string;` | - |
| `arguments` | `arguments: string;` | - |
| `incomplete?` | `incomplete?: boolean;` | - |

</details>

---

### ToolCallStartEvent `interface`

📍 [`src/domain/entities/StreamEvent.ts:75`](src/domain/entities/StreamEvent.ts)

Tool call detected and starting

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: StreamEventType.TOOL_CALL_START;` | - |
| `item_id` | `item_id: string;` | - |
| `tool_call_id` | `tool_call_id: string;` | - |
| `tool_name` | `tool_name: string;` | - |

</details>

---

### ToolCondition `interface`

📍 [`src/core/ToolManager.ts:48`](src/core/ToolManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'mode' | 'context' | 'custom';` | - |
| `predicate` | `predicate: (context: ToolSelectionContext) =&gt; boolean;` | - |

</details>

---

### ToolContext `interface`

📍 [`src/domain/interfaces/IToolContext.ts:63`](src/domain/interfaces/IToolContext.ts)

Context passed to tool execute function

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agentId` | `agentId: string;` | Agent ID (for logging/tracing) |
| `taskId?` | `taskId?: string;` | Task ID (if running in TaskAgent) |
| `memory?` | `memory?: WorkingMemoryAccess;` | Working memory access (if running in TaskAgent) |
| `contextManager?` | `contextManager?: ContextManager;` | Context manager (if running in TaskAgent) |
| `idempotencyCache?` | `idempotencyCache?: IdempotencyCache;` | Idempotency cache (if running in TaskAgent) |
| `inContextMemory?` | `inContextMemory?: InContextMemoryPlugin;` | In-context memory plugin (if set up with setupInContextMemory) |
| `signal?` | `signal?: AbortSignal;` | Abort signal for cancellation |

</details>

---

### ToolExecutionContext `interface`

📍 [`src/domain/entities/Tool.ts:70`](src/domain/entities/Tool.ts)

Tool execution context - tracks all tool calls in a generation

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `executionId` | `executionId: string;` | - |
| `toolCalls` | `toolCalls: Map&lt;string, ToolCall&gt;;` | - |
| `pendingNonBlocking` | `pendingNonBlocking: Set&lt;string&gt;;` | - |
| `completedResults` | `completedResults: Map&lt;string, ToolResult&gt;;` | - |

</details>

---

### ToolExecutionDoneEvent `interface`

📍 [`src/domain/entities/StreamEvent.ts:118`](src/domain/entities/StreamEvent.ts)

Tool execution complete

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: StreamEventType.TOOL_EXECUTION_DONE;` | - |
| `tool_call_id` | `tool_call_id: string;` | - |
| `tool_name` | `tool_name: string;` | - |
| `result` | `result: any;` | - |
| `execution_time_ms` | `execution_time_ms: number;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### ToolExecutionStartEvent `interface`

📍 [`src/domain/entities/StreamEvent.ts:108`](src/domain/entities/StreamEvent.ts)

Tool execution starting

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: StreamEventType.TOOL_EXECUTION_START;` | - |
| `tool_call_id` | `tool_call_id: string;` | - |
| `tool_name` | `tool_name: string;` | - |
| `arguments` | `arguments: any;` | - |

</details>

---

### ToolFunction `interface`

📍 [`src/domain/entities/Tool.ts:153`](src/domain/entities/Tool.ts)

User-provided tool function

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `definition` | `definition: FunctionToolDefinition;` | - |
| `execute` | `execute: (args: TArgs, context?: ToolContext) =&gt; Promise&lt;TResult&gt;;` | - |
| `idempotency?` | `idempotency?: ToolIdempotency;` | - |
| `output?` | `output?: ToolOutputHints;` | - |
| `permission?` | `permission?: ToolPermissionConfig;` | Permission settings for this tool. If not set, defaults are used. |
| `describeCall?` | `describeCall?: (args: TArgs) =&gt; string;` | Returns a human-readable description of a tool call.
Used for logging, UI display, and debugging. |

</details>

---

### ToolManagerStats `interface`

📍 [`src/core/ToolManager.ts:91`](src/core/ToolManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `totalTools` | `totalTools: number;` | - |
| `enabledTools` | `enabledTools: number;` | - |
| `disabledTools` | `disabledTools: number;` | - |
| `namespaces` | `namespaces: string[];` | - |
| `toolsByNamespace` | `toolsByNamespace: Record&lt;string, number&gt;;` | - |
| `mostUsed` | `mostUsed: Array&lt;{ name: string; count: number }&gt;;` | - |
| `totalExecutions` | `totalExecutions: number;` | - |

</details>

---

### ToolMetadata `interface`

📍 [`src/core/ToolManager.ts:81`](src/core/ToolManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `registeredAt` | `registeredAt: Date;` | - |
| `usageCount` | `usageCount: number;` | - |
| `lastUsed?` | `lastUsed?: Date;` | - |
| `totalExecutionMs` | `totalExecutionMs: number;` | - |
| `avgExecutionMs` | `avgExecutionMs: number;` | - |
| `successCount` | `successCount: number;` | - |
| `failureCount` | `failureCount: number;` | - |

</details>

---

### ToolModification `interface`

📍 [`src/capabilities/agents/types/HookTypes.ts:97`](src/capabilities/agents/types/HookTypes.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `modified?` | `modified?: Partial&lt;ToolCall&gt;;` | - |
| `skip?` | `skip?: boolean;` | - |
| `mockResult?` | `mockResult?: any;` | - |
| `reason?` | `reason?: string;` | - |

</details>

---

### ToolOptions `interface`

📍 [`src/core/ToolManager.ts:35`](src/core/ToolManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `enabled?` | `enabled?: boolean;` | Whether the tool is enabled. Default: true |
| `namespace?` | `namespace?: string;` | Namespace for grouping related tools. Default: 'default' |
| `priority?` | `priority?: number;` | Priority for selection ordering. Higher = preferred. Default: 0 |
| `conditions?` | `conditions?: ToolCondition[];` | Conditions for auto-enable/disable |
| `permission?` | `permission?: ToolPermissionConfig;` | Permission configuration override. If not set, uses tool's config or defaults. |

</details>

---

### ToolPermissionConfig `interface`

📍 [`src/core/permissions/types.ts:45`](src/core/permissions/types.ts)

Permission configuration for a tool

Can be set on the tool definition or overridden at registration time.

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `scope?` | `scope?: PermissionScope;` | When approval is required. |
| `riskLevel?` | `riskLevel?: RiskLevel;` | Risk classification for the tool. |
| `approvalMessage?` | `approvalMessage?: string;` | Custom message shown in approval UI.
Should explain what the tool does and any potential risks. |
| `sensitiveArgs?` | `sensitiveArgs?: string[];` | Argument names that should be highlighted in approval UI.
E.g., ['path', 'url'] for file/network operations. |
| `sessionTTLMs?` | `sessionTTLMs?: number;` | Optional expiration time for session approvals (milliseconds).
If set, session approvals expire after this duration. |

</details>

---

### ToolPermissionConfig `interface`

📍 [`src/domain/entities/Tool.ts:117`](src/domain/entities/Tool.ts)

Permission configuration for a tool

Controls when approval is required for tool execution.
Used by the ToolPermissionManager.

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `scope?` | `scope?: 'once' | 'session' | 'always' | 'never';` | When approval is required.
- 'once' - Require approval for each call
- 'session' - Approve once per session
- 'always' - Auto-approve (no prompts)
- 'never' - Always blocked |
| `riskLevel?` | `riskLevel?: 'low' | 'medium' | 'high' | 'critical';` | Risk level classification. |
| `approvalMessage?` | `approvalMessage?: string;` | Custom message shown in approval UI. |
| `sensitiveArgs?` | `sensitiveArgs?: string[];` | Argument names that should be highlighted as sensitive. |
| `sessionTTLMs?` | `sessionTTLMs?: number;` | TTL for session approvals (milliseconds). |

</details>

---

### ToolRegistration `interface`

📍 [`src/core/ToolManager.ts:68`](src/core/ToolManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `tool` | `tool: ToolFunction;` | - |
| `enabled` | `enabled: boolean;` | - |
| `namespace` | `namespace: string;` | - |
| `priority` | `priority: number;` | - |
| `conditions` | `conditions: ToolCondition[];` | - |
| `metadata` | `metadata: ToolMetadata;` | - |
| `permission?` | `permission?: ToolPermissionConfig;` | Effective permission config (merged from tool.permission and options.permission) |
| `circuitBreakerConfig?` | `circuitBreakerConfig?: Partial&lt;CircuitBreakerConfig&gt;;` | Circuit breaker configuration for this tool (uses shared CircuitBreakerConfig from resilience) |

</details>

---

### ToolRegistryEntry `interface`

📍 [`src/tools/registry.generated.ts:30`](src/tools/registry.generated.ts)

Metadata for a tool in the registry

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string;` | Tool name (matches definition.function.name) |
| `exportName` | `exportName: string;` | Export variable name |
| `displayName` | `displayName: string;` | Human-readable display name |
| `category` | `category: ToolCategory;` | Category for grouping |
| `description` | `description: string;` | Brief description |
| `tool` | `tool: ToolFunction;` | The actual tool function |
| `safeByDefault` | `safeByDefault: boolean;` | Whether this tool is safe without explicit approval |
| `requiresConnector?` | `requiresConnector?: boolean;` | Whether this tool requires a connector |
| `connectorServiceTypes?` | `connectorServiceTypes?: string[];` | Supported connector service types (if requiresConnector) |

</details>

---

### ToolResult `interface`

📍 [`src/domain/entities/Tool.ts:59`](src/domain/entities/Tool.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `tool_use_id` | `tool_use_id: string;` | - |
| `content` | `content: any;` | - |
| `error?` | `error?: string;` | - |
| `executionTime?` | `executionTime?: number;` | - |
| `state` | `state: ToolCallState;` | - |

</details>

---

### ToolResultContent `interface`

📍 [`src/domain/entities/Content.ts:49`](src/domain/entities/Content.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: ContentType.TOOL_RESULT;` | - |
| `tool_use_id` | `tool_use_id: string;` | - |
| `content` | `content: string | any;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### ToolSelectionContext `interface`

📍 [`src/core/ToolManager.ts:53`](src/core/ToolManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `input?` | `input?: string;` | Current user input or task description |
| `mode?` | `mode?: string;` | Current agent mode (for UniversalAgent) |
| `currentTask?` | `currentTask?: string;` | Current task name (for TaskAgent) |
| `recentTools?` | `recentTools?: string[];` | Recently used tools (to avoid repetition) |
| `tokenBudget?` | `tokenBudget?: number;` | Token budget for tool definitions |
| `custom?` | `custom?: Record&lt;string, unknown&gt;;` | Custom context data |

</details>

---

### ToolUseContent `interface`

📍 [`src/domain/entities/Content.ts:42`](src/domain/entities/Content.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: ContentType.TOOL_USE;` | - |
| `id` | `id: string;` | - |
| `name` | `name: string;` | - |
| `arguments` | `arguments: string;` | - |

</details>

---

### ToolCallState `enum`

📍 [`src/domain/entities/Tool.ts:37`](src/domain/entities/Tool.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `PENDING` | `pending` | - |
| `EXECUTING` | `executing` | - |
| `COMPLETED` | `completed` | - |
| `FAILED` | `failed` | - |
| `TIMEOUT` | `timeout` | - |

</details>

---

### DefaultAllowlistedTool `type`

📍 [`src/core/permissions/types.ts:343`](src/core/permissions/types.ts)

Type for default allowlisted tools

```typescript
type DefaultAllowlistedTool = (typeof DEFAULT_ALLOWLIST)[number]
```

---

### ServiceToolFactory `type`

📍 [`src/tools/connector/ConnectorTools.ts:58`](src/tools/connector/ConnectorTools.ts)

Factory function type for creating service-specific tools
Takes a Connector and returns an array of tools that use it

```typescript
type ServiceToolFactory = (connector: Connector, userId?: string) =&gt; ToolFunction[]
```

---

### Tool `type`

📍 [`src/domain/entities/Tool.ts:35`](src/domain/entities/Tool.ts)

```typescript
type Tool = FunctionToolDefinition | BuiltInTool
```

---

### ToolCategory `type`

📍 [`src/tools/registry.generated.ts:27`](src/tools/registry.generated.ts)

Tool category for grouping

```typescript
type ToolCategory = 'filesystem' | 'shell' | 'web' | 'code' | 'json' | 'connector' | 'other'
```

---

### ToolManagerEvent `type`

📍 [`src/core/ToolManager.ts:109`](src/core/ToolManager.ts)

```typescript
type ToolManagerEvent = | 'tool:registered'
  | 'tool:unregistered'
  | 'tool:enabled'
  | 'tool:disabled'
  | 'tool:executed'
  | 'namespace:enabled'
  | 'namespace:disabled'
```

---

### createBashTool `function`

📍 [`src/tools/shell/bash.ts:51`](src/tools/shell/bash.ts)

Create a Bash tool with the given configuration

```typescript
export function createBashTool(config: ShellToolConfig =
```

---

### createEditFileTool `function`

📍 [`src/tools/filesystem/editFile.ts:42`](src/tools/filesystem/editFile.ts)

Create an Edit File tool with the given configuration

```typescript
export function createEditFileTool(config: FilesystemToolConfig =
```

---

### createExecuteJavaScriptTool `function`

📍 [`src/tools/code/executeJavaScript.ts:107`](src/tools/code/executeJavaScript.ts)

Create an execute_javascript tool with the current connector state
Use this factory when you need the tool to reflect currently registered connectors

```typescript
export function createExecuteJavaScriptTool(): ToolFunction&lt;ExecuteJSArgs, ExecuteJSResult&gt;
```

---

### createGlobTool `function`

📍 [`src/tools/filesystem/glob.ts:123`](src/tools/filesystem/glob.ts)

Create a Glob tool with the given configuration

```typescript
export function createGlobTool(config: FilesystemToolConfig =
```

---

### createGrepTool `function`

📍 [`src/tools/filesystem/grep.ts:191`](src/tools/filesystem/grep.ts)

Create a Grep tool with the given configuration

```typescript
export function createGrepTool(config: FilesystemToolConfig =
```

---

### createListDirectoryTool `function`

📍 [`src/tools/filesystem/listDirectory.ts:137`](src/tools/filesystem/listDirectory.ts)

Create a List Directory tool with the given configuration

```typescript
export function createListDirectoryTool(config: FilesystemToolConfig =
```

---

### createReadFileTool `function`

📍 [`src/tools/filesystem/readFile.ts:40`](src/tools/filesystem/readFile.ts)

Create a Read File tool with the given configuration

```typescript
export function createReadFileTool(config: FilesystemToolConfig =
```

---

### createResearchTools `function`

📍 [`src/capabilities/researchAgent/ResearchAgent.ts:532`](src/capabilities/researchAgent/ResearchAgent.ts)

Create research-specific tools for source interaction
These tools use closure over the sources and config rather than accessing agent from context

```typescript
function createResearchTools(sources: IResearchSource[]): ToolFunction[]
```

---

### createWriteFileTool `function`

📍 [`src/tools/filesystem/writeFile.ts:38`](src/tools/filesystem/writeFile.ts)

Create a Write File tool with the given configuration

```typescript
export function createWriteFileTool(config: FilesystemToolConfig =
```

---

### defaultDescribeCall `function`

📍 [`src/domain/entities/Tool.ts:203`](src/domain/entities/Tool.ts)

Default implementation for describeCall.
Shows the first meaningful argument value.

```typescript
export function defaultDescribeCall(
  args: Record&lt;string, unknown&gt;,
  maxLength = 60
): string
```

**Example:**

```typescript
defaultDescribeCall({ file_path: '/path/to/file.ts' })
// Returns: '/path/to/file.ts'
```
```typescript
defaultDescribeCall({ query: 'search term', limit: 10 })
// Returns: 'search term'
```

---

### generateWebAPITool `function`

📍 [`src/connectors/toolGenerator.ts:33`](src/connectors/toolGenerator.ts)

Generate a universal API request tool for all registered OAuth providers

This tool allows the AI agent to make authenticated requests to any registered API.
The tool description is dynamically generated based on registered providers.

```typescript
export function generateWebAPITool(): ToolFunction&lt;APIRequestArgs, APIRequestResult&gt;
```

---

### getAllBuiltInTools `function`

📍 [`src/tools/registry.generated.ts:177`](src/tools/registry.generated.ts)

Get all built-in tools as ToolFunction array

```typescript
export function getAllBuiltInTools(): ToolFunction[]
```

---

### getToolByName `function`

📍 [`src/tools/registry.generated.ts:192`](src/tools/registry.generated.ts)

Get tool by name

```typescript
export function getToolByName(name: string): ToolRegistryEntry | undefined
```

---

### getToolCallDescription `function`

📍 [`src/domain/entities/Tool.ts:255`](src/domain/entities/Tool.ts)

Get a human-readable description of a tool call.
Uses the tool's describeCall method if available, otherwise falls back to default.

```typescript
export function getToolCallDescription&lt;TArgs&gt;(
  tool: ToolFunction&lt;TArgs&gt;,
  args: TArgs
): string
```

---

### getToolCategories `function`

📍 [`src/tools/registry.generated.ts:202`](src/tools/registry.generated.ts)

Get all unique category names

```typescript
export function getToolCategories(): ToolCategory[]
```

---

### getToolRegistry `function`

📍 [`src/tools/registry.generated.ts:182`](src/tools/registry.generated.ts)

Get full tool registry with metadata

```typescript
export function getToolRegistry(): ToolRegistryEntry[]
```

---

### getToolsByCategory `function`

📍 [`src/tools/registry.generated.ts:187`](src/tools/registry.generated.ts)

Get tools by category

```typescript
export function getToolsByCategory(category: ToolCategory): ToolRegistryEntry[]
```

---

### getToolsRequiringConnector `function`

📍 [`src/tools/registry.generated.ts:197`](src/tools/registry.generated.ts)

Get tools that require connector configuration

```typescript
export function getToolsRequiringConnector(): ToolRegistryEntry[]
```

---

### isToolCallArgumentsDelta `function`

📍 [`src/domain/entities/StreamEvent.ts:200`](src/domain/entities/StreamEvent.ts)

```typescript
export function isToolCallArgumentsDelta(
  event: StreamEvent
): event is ToolCallArgumentsDeltaEvent
```

---

### isToolCallArgumentsDone `function`

📍 [`src/domain/entities/StreamEvent.ts:206`](src/domain/entities/StreamEvent.ts)

```typescript
export function isToolCallArgumentsDone(
  event: StreamEvent
): event is ToolCallArgumentsDoneEvent
```

---

### isToolCallStart `function`

📍 [`src/domain/entities/StreamEvent.ts:196`](src/domain/entities/StreamEvent.ts)

```typescript
export function isToolCallStart(event: StreamEvent): event is ToolCallStartEvent
```

---

## Streaming

Real-time streaming of agent responses

### StreamHelpers `class`

📍 [`src/capabilities/agents/StreamHelpers.ts:18`](src/capabilities/agents/StreamHelpers.ts)

Helper class for consuming and processing streams

<details>
<summary><strong>Static Methods</strong></summary>

#### `static collectResponse()`

Collect complete response from stream
Accumulates all events and reconstructs final LLMResponse

```typescript
static async collectResponse(
    stream: AsyncIterableIterator&lt;StreamEvent&gt;
  ): Promise&lt;LLMResponse&gt;
```

**Parameters:**
- `stream`: `AsyncIterableIterator&lt;StreamEvent&gt;`

**Returns:** `Promise&lt;LLMResponse&gt;`

#### `static textOnly()`

Get only text deltas from stream (for simple text streaming)
Filters out all other event types

```typescript
static async *textOnly(
    stream: AsyncIterableIterator&lt;StreamEvent&gt;
  ): AsyncIterableIterator&lt;string&gt;
```

**Parameters:**
- `stream`: `AsyncIterableIterator&lt;StreamEvent&gt;`

**Returns:** `AsyncIterableIterator&lt;string&gt;`

#### `static filterByType()`

Filter stream events by type

```typescript
static async *filterByType&lt;T extends StreamEvent&gt;(
    stream: AsyncIterableIterator&lt;StreamEvent&gt;,
    eventType: StreamEventType
  ): AsyncIterableIterator&lt;T&gt;
```

**Parameters:**
- `stream`: `AsyncIterableIterator&lt;StreamEvent&gt;`
- `eventType`: `StreamEventType`

**Returns:** `AsyncIterableIterator&lt;T&gt;`

#### `static accumulateText()`

Accumulate text from stream into a single string

```typescript
static async accumulateText(
    stream: AsyncIterableIterator&lt;StreamEvent&gt;
  ): Promise&lt;string&gt;
```

**Parameters:**
- `stream`: `AsyncIterableIterator&lt;StreamEvent&gt;`

**Returns:** `Promise&lt;string&gt;`

#### `static bufferEvents()`

Buffer stream events into batches

```typescript
static async *bufferEvents(
    stream: AsyncIterableIterator&lt;StreamEvent&gt;,
    batchSize: number
  ): AsyncIterableIterator&lt;StreamEvent[]&gt;
```

**Parameters:**
- `stream`: `AsyncIterableIterator&lt;StreamEvent&gt;`
- `batchSize`: `number`

**Returns:** `AsyncIterableIterator&lt;StreamEvent[]&gt;`

#### `static tap()`

Tap into stream without consuming it
Useful for logging or side effects

```typescript
static async *tap(
    stream: AsyncIterableIterator&lt;StreamEvent&gt;,
    callback: (event: StreamEvent) =&gt; void | Promise&lt;void&gt;
  ): AsyncIterableIterator&lt;StreamEvent&gt;
```

**Parameters:**
- `stream`: `AsyncIterableIterator&lt;StreamEvent&gt;`
- `callback`: `(event: StreamEvent) =&gt; void | Promise&lt;void&gt;`

**Returns:** `AsyncIterableIterator&lt;StreamEvent&gt;`

#### `static take()`

Take first N events from stream

```typescript
static async *take(
    stream: AsyncIterableIterator&lt;StreamEvent&gt;,
    count: number
  ): AsyncIterableIterator&lt;StreamEvent&gt;
```

**Parameters:**
- `stream`: `AsyncIterableIterator&lt;StreamEvent&gt;`
- `count`: `number`

**Returns:** `AsyncIterableIterator&lt;StreamEvent&gt;`

#### `static skip()`

Skip first N events from stream

```typescript
static async *skip(
    stream: AsyncIterableIterator&lt;StreamEvent&gt;,
    count: number
  ): AsyncIterableIterator&lt;StreamEvent&gt;
```

**Parameters:**
- `stream`: `AsyncIterableIterator&lt;StreamEvent&gt;`
- `count`: `number`

**Returns:** `AsyncIterableIterator&lt;StreamEvent&gt;`

</details>

---

### StreamState `class`

📍 [`src/domain/entities/StreamState.ts:21`](src/domain/entities/StreamState.ts)

StreamState tracks all accumulated data during streaming

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(responseId: string, model: string, createdAt?: number)
```

**Parameters:**
- `responseId`: `string`
- `model`: `string`
- `createdAt`: `number | undefined` *(optional)*

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `accumulateTextDelta()`

Accumulate text delta for a specific item

```typescript
accumulateTextDelta(itemId: string, delta: string): void
```

**Parameters:**
- `itemId`: `string`
- `delta`: `string`

**Returns:** `void`

#### `getCompleteText()`

Get complete accumulated text for an item

```typescript
getCompleteText(itemId: string): string
```

**Parameters:**
- `itemId`: `string`

**Returns:** `string`

#### `getAllText()`

Get all accumulated text (all items concatenated)

```typescript
getAllText(): string
```

**Returns:** `string`

#### `startToolCall()`

Start accumulating tool call arguments

```typescript
startToolCall(toolCallId: string, toolName: string): void
```

**Parameters:**
- `toolCallId`: `string`
- `toolName`: `string`

**Returns:** `void`

#### `accumulateToolArguments()`

Accumulate tool argument delta

```typescript
accumulateToolArguments(toolCallId: string, delta: string): void
```

**Parameters:**
- `toolCallId`: `string`
- `delta`: `string`

**Returns:** `void`

#### `completeToolCall()`

Mark tool call arguments as complete

```typescript
completeToolCall(toolCallId: string): void
```

**Parameters:**
- `toolCallId`: `string`

**Returns:** `void`

#### `getCompleteToolArguments()`

Get complete tool arguments (joined chunks)

```typescript
getCompleteToolArguments(toolCallId: string): string
```

**Parameters:**
- `toolCallId`: `string`

**Returns:** `string`

#### `isToolCallComplete()`

Check if tool call is complete

```typescript
isToolCallComplete(toolCallId: string): boolean
```

**Parameters:**
- `toolCallId`: `string`

**Returns:** `boolean`

#### `getToolName()`

Get tool name for a tool call

```typescript
getToolName(toolCallId: string): string | undefined
```

**Parameters:**
- `toolCallId`: `string`

**Returns:** `string | undefined`

#### `addCompletedToolCall()`

Add completed tool call

```typescript
addCompletedToolCall(toolCall: ToolCall): void
```

**Parameters:**
- `toolCall`: `ToolCall`

**Returns:** `void`

#### `getCompletedToolCalls()`

Get all completed tool calls

```typescript
getCompletedToolCalls(): ToolCall[]
```

**Returns:** `ToolCall[]`

#### `setToolResult()`

Store tool execution result

```typescript
setToolResult(toolCallId: string, result: any): void
```

**Parameters:**
- `toolCallId`: `string`
- `result`: `any`

**Returns:** `void`

#### `getToolResult()`

Get tool execution result

```typescript
getToolResult(toolCallId: string): any
```

**Parameters:**
- `toolCallId`: `string`

**Returns:** `any`

#### `updateUsage()`

Update token usage (replaces values, doesn't accumulate)

```typescript
updateUsage(usage: Partial&lt;TokenUsage&gt;): void
```

**Parameters:**
- `usage`: `Partial&lt;TokenUsage&gt;`

**Returns:** `void`

#### `accumulateUsage()`

Accumulate token usage (adds to existing values)

```typescript
accumulateUsage(usage: Partial&lt;TokenUsage&gt;): void
```

**Parameters:**
- `usage`: `Partial&lt;TokenUsage&gt;`

**Returns:** `void`

#### `markComplete()`

Mark stream as complete

```typescript
markComplete(status: 'completed' | 'incomplete' | 'failed' = 'completed'): void
```

**Parameters:**
- `status`: `"completed" | "failed" | "incomplete"` *(optional)* (default: `'completed'`)

**Returns:** `void`

#### `getDuration()`

Get duration in milliseconds

```typescript
getDuration(): number
```

**Returns:** `number`

#### `incrementIteration()`

Increment iteration counter

```typescript
incrementIteration(): void
```

**Returns:** `void`

#### `getStatistics()`

Get summary statistics

```typescript
getStatistics()
```

**Returns:** `{ responseId: string; model: string; status: "completed" | "failed" | "in_progress" | "incomplete"; iterations: number; totalChunks: number; totalTextDeltas: number; totalToolCalls: number; textItemsCount: number; toolCallBuffersCount: number; completedToolCallsCount: number; durationMs: number; usage: { input_tokens: number; output_tokens: number; total_tokens: number; output_tokens_details?: { reasoning_tokens: number; } | undefined; }; }`

#### `hasText()`

Check if stream has any accumulated text

```typescript
hasText(): boolean
```

**Returns:** `boolean`

#### `hasToolCalls()`

Check if stream has any tool calls

```typescript
hasToolCalls(): boolean
```

**Returns:** `boolean`

#### `clear()`

Clear all buffers (for memory management)

```typescript
clear(): void
```

**Returns:** `void`

#### `createSnapshot()`

Create a snapshot for checkpointing (error recovery)

```typescript
createSnapshot()
```

**Returns:** `{ responseId: string; model: string; createdAt: number; textBuffers: Map&lt;string, string[]&gt;; toolCallBuffers: Map&lt;string, ToolCallBuffer&gt;; completedToolCalls: ToolCall[]; toolResults: Map&lt;string, any&gt;; currentIteration: number; usage: { input_tokens: number; output_tokens: number; total_tokens: number; output_tokens_details?: { reasoning_tokens: number; } | undefined; }; status: "completed" | "failed" | "in_progress" | "incomplete"; startTime: Date; endTime: Date | undefined; }`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `responseId` | `responseId: string` | - |
| `model` | `model: string` | - |
| `createdAt` | `createdAt: number` | - |
| `textBuffers` | `textBuffers: Map&lt;string, string[]&gt;` | - |
| `toolCallBuffers` | `toolCallBuffers: Map&lt;string, ToolCallBuffer&gt;` | - |
| `completedToolCalls` | `completedToolCalls: ToolCall[]` | - |
| `toolResults` | `toolResults: Map&lt;string, any&gt;` | - |
| `currentIteration` | `currentIteration: number` | - |
| `usage` | `usage: TokenUsage` | - |
| `status` | `status: "completed" | "failed" | "in_progress" | "incomplete"` | - |
| `startTime` | `startTime: Date` | - |
| `endTime?` | `endTime: Date | undefined` | - |
| `totalChunks` | `totalChunks: number` | - |
| `totalTextDeltas` | `totalTextDeltas: number` | - |
| `totalToolCalls` | `totalToolCalls: number` | - |

</details>

---

### ErrorEvent `interface`

📍 [`src/domain/entities/StreamEvent.ts:151`](src/domain/entities/StreamEvent.ts)

Error event

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: StreamEventType.ERROR;` | - |
| `error` | `error: {
    type: string;
    message: string;
    code?: string;
  };` | - |
| `recoverable` | `recoverable: boolean;` | - |

</details>

---

### IterationCompleteEvent `interface`

📍 [`src/domain/entities/StreamEvent.ts:130`](src/domain/entities/StreamEvent.ts)

Iteration complete - end of agentic loop iteration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: StreamEventType.ITERATION_COMPLETE;` | - |
| `iteration` | `iteration: number;` | - |
| `tool_calls_count` | `tool_calls_count: number;` | - |
| `has_more_iterations` | `has_more_iterations: boolean;` | - |

</details>

---

### OutputTextDeltaEvent `interface`

📍 [`src/domain/entities/StreamEvent.ts:53`](src/domain/entities/StreamEvent.ts)

Text delta - incremental text output

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: StreamEventType.OUTPUT_TEXT_DELTA;` | - |
| `item_id` | `item_id: string;` | - |
| `output_index` | `output_index: number;` | - |
| `content_index` | `content_index: number;` | - |
| `delta` | `delta: string;` | - |
| `sequence_number` | `sequence_number: number;` | - |

</details>

---

### OutputTextDoneEvent `interface`

📍 [`src/domain/entities/StreamEvent.ts:65`](src/domain/entities/StreamEvent.ts)

Text output complete for this item

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: StreamEventType.OUTPUT_TEXT_DONE;` | - |
| `item_id` | `item_id: string;` | - |
| `output_index` | `output_index: number;` | - |
| `text` | `text: string;` | - |

</details>

---

### ResponseCompleteEvent `interface`

📍 [`src/domain/entities/StreamEvent.ts:140`](src/domain/entities/StreamEvent.ts)

Response complete - final event

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: StreamEventType.RESPONSE_COMPLETE;` | - |
| `status` | `status: 'completed' | 'incomplete' | 'failed';` | - |
| `usage` | `usage: TokenUsage;` | - |
| `iterations` | `iterations: number;` | - |
| `duration_ms?` | `duration_ms?: number;` | - |

</details>

---

### ResponseCreatedEvent `interface`

📍 [`src/domain/entities/StreamEvent.ts:37`](src/domain/entities/StreamEvent.ts)

Response created - first event in stream

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: StreamEventType.RESPONSE_CREATED;` | - |
| `model` | `model: string;` | - |
| `created_at` | `created_at: number;` | - |

</details>

---

### ResponseInProgressEvent `interface`

📍 [`src/domain/entities/StreamEvent.ts:46`](src/domain/entities/StreamEvent.ts)

Response in progress

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: StreamEventType.RESPONSE_IN_PROGRESS;` | - |

</details>

---

### StreamEventType `enum`

📍 [`src/domain/entities/StreamEvent.ts:11`](src/domain/entities/StreamEvent.ts)

Stream event type enum

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `RESPONSE_CREATED` | `response.created` | - |
| `RESPONSE_IN_PROGRESS` | `response.in_progress` | - |
| `OUTPUT_TEXT_DELTA` | `response.output_text.delta` | - |
| `OUTPUT_TEXT_DONE` | `response.output_text.done` | - |
| `TOOL_CALL_START` | `response.tool_call.start` | - |
| `TOOL_CALL_ARGUMENTS_DELTA` | `response.tool_call_arguments.delta` | - |
| `TOOL_CALL_ARGUMENTS_DONE` | `response.tool_call_arguments.done` | - |
| `TOOL_EXECUTION_START` | `response.tool_execution.start` | - |
| `TOOL_EXECUTION_DONE` | `response.tool_execution.done` | - |
| `ITERATION_COMPLETE` | `response.iteration.complete` | - |
| `RESPONSE_COMPLETE` | `response.complete` | - |
| `ERROR` | `response.error` | - |

</details>

---

### StreamEvent `type`

📍 [`src/domain/entities/StreamEvent.ts:165`](src/domain/entities/StreamEvent.ts)

Union type of all stream events
Discriminated by 'type' field for type narrowing

```typescript
type StreamEvent = | ResponseCreatedEvent
  | ResponseInProgressEvent
  | OutputTextDeltaEvent
  | OutputTextDoneEvent
  | ToolCallStartEvent
  | ToolCallArgumentsDeltaEvent
  | ToolCallArgumentsDoneEvent
  | ToolExecutionStartEvent
  | ToolExecutionDoneEvent
  | IterationCompleteEvent
  | ResponseCompleteEvent
  | ErrorEvent
```

---

### isErrorEvent `function`

📍 [`src/domain/entities/StreamEvent.ts:216`](src/domain/entities/StreamEvent.ts)

```typescript
export function isErrorEvent(event: StreamEvent): event is ErrorEvent
```

---

### isOutputTextDelta `function`

📍 [`src/domain/entities/StreamEvent.ts:192`](src/domain/entities/StreamEvent.ts)

Type guards for specific events

```typescript
export function isOutputTextDelta(event: StreamEvent): event is OutputTextDeltaEvent
```

---

### isResponseComplete `function`

📍 [`src/domain/entities/StreamEvent.ts:212`](src/domain/entities/StreamEvent.ts)

```typescript
export function isResponseComplete(event: StreamEvent): event is ResponseCompleteEvent
```

---

### isStreamEvent `function`

📍 [`src/domain/entities/StreamEvent.ts:182`](src/domain/entities/StreamEvent.ts)

Type guard to check if event is a specific type

```typescript
export function isStreamEvent&lt;T extends StreamEvent&gt;(
  event: StreamEvent,
  type: StreamEventType
): event is T
```

---

## Model Registry

Model metadata, pricing, and capabilities

### ModelNotSupportedError `class`

📍 [`src/domain/errors/AIErrors.ts:117`](src/domain/errors/AIErrors.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(providerName: string, model: string, capability: string)
```

**Parameters:**
- `providerName`: `string`
- `model`: `string`
- `capability`: `string`

</details>

---

### IBaseModelDescription `interface`

📍 [`src/domain/types/SharedTypes.ts:72`](src/domain/types/SharedTypes.ts)

Base model description - shared by all registries
Every model registry (Image, TTS, STT, Video) extends this

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string;` | Model identifier (e.g., "dall-e-3", "tts-1") |
| `displayName` | `displayName: string;` | Display name for UI (e.g., "DALL-E 3", "TTS-1") |
| `provider` | `provider: VendorType;` | Vendor/provider |
| `description?` | `description?: string;` | Model description |
| `isActive` | `isActive: boolean;` | Whether the model is currently available |
| `releaseDate?` | `releaseDate?: string;` | Release date (YYYY-MM-DD) |
| `deprecationDate?` | `deprecationDate?: string;` | Deprecation date if scheduled (YYYY-MM-DD) |
| `sources` | `sources: ISourceLinks;` | Documentation/pricing links for maintenance |

</details>

---

### ILLMDescription `interface`

📍 [`src/domain/entities/Model.ts:7`](src/domain/entities/Model.ts)

Complete description of an LLM model including capabilities, pricing, and features

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string;` | Model identifier (e.g., "gpt-5.2-instant") |
| `provider` | `provider: string;` | Vendor/provider (Vendor.OpenAI, Vendor.Anthropic, etc.) |
| `description?` | `description?: string;` | Optional description of the model |
| `isActive` | `isActive: boolean;` | Whether the model is currently available for use |
| `releaseDate?` | `releaseDate?: string;` | Release date (YYYY-MM-DD format) |
| `knowledgeCutoff?` | `knowledgeCutoff?: string;` | Knowledge cutoff date |
| `features` | `features: {
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
  };` | Model capabilities and pricing |

</details>

---

### ModelCapabilities `interface`

📍 [`src/domain/interfaces/ITextProvider.ts:30`](src/domain/interfaces/ITextProvider.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `supportsTools` | `supportsTools: boolean;` | - |
| `supportsVision` | `supportsVision: boolean;` | - |
| `supportsJSON` | `supportsJSON: boolean;` | - |
| `supportsJSONSchema` | `supportsJSONSchema: boolean;` | - |
| `maxTokens` | `maxTokens: number;` | - |
| `maxInputTokens?` | `maxInputTokens?: number;` | - |
| `maxOutputTokens?` | `maxOutputTokens?: number;` | - |

</details>

---

### calculateCost `function`

📍 [`src/domain/entities/Model.ts:1190`](src/domain/entities/Model.ts)

Calculate the cost for a given model and token usage

```typescript
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  options?:
```

---

### getActiveModels `function`

📍 [`src/domain/entities/Model.ts:1178`](src/domain/entities/Model.ts)

Get all currently active models

```typescript
export function getActiveModels(): ILLMDescription[]
```

---

### getModelInfo `function`

📍 [`src/domain/entities/Model.ts:1161`](src/domain/entities/Model.ts)

Get model information by name

```typescript
export function getModelInfo(modelName: string): ILLMDescription | undefined
```

---

### getModelsByVendor `function`

📍 [`src/domain/entities/Model.ts:1170`](src/domain/entities/Model.ts)

Get all models for a specific vendor

```typescript
export function getModelsByVendor(vendor: VendorType): ILLMDescription[]
```

---

### MODEL_REGISTRY `const`

📍 [`src/domain/entities/Model.ts:176`](src/domain/entities/Model.ts)

Complete model registry with all model metadata
Updated: January 2026 - Verified from official vendor documentation

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'gpt-5.2'` | `{
    name: 'gpt-5.2',
    provider: Vendor.OpenAI,
    description: 'Flagship model for coding and agentic tasks. Reasoning.effort: none, low, medium, high, xhigh',
    isActive: true,
    releaseDate: '2025-12-01',
    knowledgeCutoff: '2025-08-31',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false,
      },
      input: {
        tokens: 400000,
        text: true,
        image: true,
        cpm: 1.75,
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 14,
      },
    },
  }` | - |
| `'gpt-5.2-pro'` | `{
    name: 'gpt-5.2-pro',
    provider: Vendor.OpenAI,
    description: 'GPT-5.2 pro produces smarter and more precise responses. Reasoning.effort: medium, high, xhigh',
    isActive: true,
    releaseDate: '2025-12-01',
    knowledgeCutoff: '2025-08-31',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false,
      },
      input: {
        tokens: 400000,
        text: true,
        image: true,
        cpm: 21,
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 168,
      },
    },
  }` | - |
| `'gpt-5'` | `{
    name: 'gpt-5',
    provider: Vendor.OpenAI,
    description: 'Previous intelligent reasoning model for coding and agentic tasks. Reasoning.effort: minimal, low, medium, high',
    isActive: true,
    releaseDate: '2025-08-01',
    knowledgeCutoff: '2024-09-30',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false,
      },
      input: {
        tokens: 400000,
        text: true,
        image: true,
        cpm: 1.25,
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 10,
      },
    },
  }` | - |
| `'gpt-5-mini'` | `{
    name: 'gpt-5-mini',
    provider: Vendor.OpenAI,
    description: 'Faster, cost-efficient version of GPT-5 for well-defined tasks and precise prompts',
    isActive: true,
    releaseDate: '2025-08-01',
    knowledgeCutoff: '2024-05-31',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false,
      },
      input: {
        tokens: 400000,
        text: true,
        image: true,
        cpm: 0.25,
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 2,
      },
    },
  }` | - |
| `'gpt-5-nano'` | `{
    name: 'gpt-5-nano',
    provider: Vendor.OpenAI,
    description: 'Fastest, most cost-efficient GPT-5. Great for summarization and classification tasks',
    isActive: true,
    releaseDate: '2025-08-01',
    knowledgeCutoff: '2024-05-31',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false,
      },
      input: {
        tokens: 400000,
        text: true,
        image: true,
        cpm: 0.05,
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 0.4,
      },
    },
  }` | - |
| `'gpt-4.1'` | `{
    name: 'gpt-4.1',
    provider: Vendor.OpenAI,
    description: 'GPT-4.1 specialized for coding with 1M token context window',
    isActive: true,
    releaseDate: '2025-04-14',
    knowledgeCutoff: '2025-04-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        cpm: 2,
      },
      output: {
        tokens: 32768,
        text: true,
        cpm: 8,
      },
    },
  }` | - |
| `'gpt-4.1-mini'` | `{
    name: 'gpt-4.1-mini',
    provider: Vendor.OpenAI,
    description: 'Efficient GPT-4.1 model, beats GPT-4o in many benchmarks at 83% lower cost',
    isActive: true,
    releaseDate: '2025-04-14',
    knowledgeCutoff: '2025-04-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        cpm: 0.4,
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 1.6,
      },
    },
  }` | - |
| `'gpt-4.1-nano'` | `{
    name: 'gpt-4.1-nano',
    provider: Vendor.OpenAI,
    description: 'Fastest and cheapest model with 1M context. 80.1% MMLU, ideal for classification/autocompletion',
    isActive: true,
    releaseDate: '2025-04-14',
    knowledgeCutoff: '2025-04-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        cpm: 0.1,
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 0.4,
      },
    },
  }` | - |
| `'gpt-4o'` | `{
    name: 'gpt-4o',
    provider: Vendor.OpenAI,
    description: 'Versatile omni model with audio support. Legacy but still available',
    isActive: true,
    releaseDate: '2024-05-13',
    knowledgeCutoff: '2024-04-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: true,
      realtime: true,
      vision: true,
      audio: true,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 128000,
        text: true,
        image: true,
        audio: true,
        cpm: 2.5,
      },
      output: {
        tokens: 16384,
        text: true,
        audio: true,
        cpm: 10,
      },
    },
  }` | - |
| `'gpt-4o-mini'` | `{
    name: 'gpt-4o-mini',
    provider: Vendor.OpenAI,
    description: 'Fast, affordable omni model with audio support',
    isActive: true,
    releaseDate: '2024-07-18',
    knowledgeCutoff: '2024-04-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: true,
      predictedOutputs: false,
      realtime: true,
      vision: true,
      audio: true,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 128000,
        text: true,
        image: true,
        audio: true,
        cpm: 0.15,
      },
      output: {
        tokens: 16384,
        text: true,
        audio: true,
        cpm: 0.6,
      },
    },
  }` | - |
| `'o3-mini'` | `{
    name: 'o3-mini',
    provider: Vendor.OpenAI,
    description: 'Fast reasoning model tailored for coding, math, and science',
    isActive: true,
    releaseDate: '2025-01-31',
    knowledgeCutoff: '2024-10-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: false,
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false,
      },
      input: {
        tokens: 200000,
        text: true,
        image: true,
        cpm: 1.1,
      },
      output: {
        tokens: 100000,
        text: true,
        cpm: 4.4,
      },
    },
  }` | - |
| `'o1'` | `{
    name: 'o1',
    provider: Vendor.OpenAI,
    description: 'Advanced reasoning model for complex problems',
    isActive: true,
    releaseDate: '2024-12-17',
    knowledgeCutoff: '2024-10-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: false,
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false,
      },
      input: {
        tokens: 200000,
        text: true,
        image: true,
        cpm: 15,
      },
      output: {
        tokens: 100000,
        text: true,
        cpm: 60,
      },
    },
  }` | - |
| `'claude-opus-4-5-20251101'` | `{
    name: 'claude-opus-4-5-20251101',
    provider: Vendor.Anthropic,
    description: 'Premium model combining maximum intelligence with practical performance',
    isActive: true,
    releaseDate: '2025-11-01',
    knowledgeCutoff: '2025-05-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 200000,
        text: true,
        image: true,
        cpm: 5,
        cpmCached: 0.5,
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 25,
      },
    },
  }` | - |
| `'claude-sonnet-4-5-20250929'` | `{
    name: 'claude-sonnet-4-5-20250929',
    provider: Vendor.Anthropic,
    description: 'Smart model for complex agents and coding. Best balance of intelligence, speed, cost',
    isActive: true,
    releaseDate: '2025-09-29',
    knowledgeCutoff: '2025-01-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 200000,
        text: true,
        image: true,
        cpm: 3,
        cpmCached: 0.3,
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 15,
      },
    },
  }` | - |
| `'claude-haiku-4-5-20251001'` | `{
    name: 'claude-haiku-4-5-20251001',
    provider: Vendor.Anthropic,
    description: 'Fastest model with near-frontier intelligence. Matches Sonnet 4 on coding',
    isActive: true,
    releaseDate: '2025-10-01',
    knowledgeCutoff: '2025-02-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 200000,
        text: true,
        image: true,
        cpm: 1,
        cpmCached: 0.1,
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 5,
      },
    },
  }` | - |
| `'claude-opus-4-1-20250805'` | `{
    name: 'claude-opus-4-1-20250805',
    provider: Vendor.Anthropic,
    description: 'Legacy Opus 4.1 focused on agentic tasks, real-world coding, and reasoning',
    isActive: true,
    releaseDate: '2025-08-05',
    knowledgeCutoff: '2025-01-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 200000,
        text: true,
        image: true,
        cpm: 15,
        cpmCached: 1.5,
      },
      output: {
        tokens: 32000,
        text: true,
        cpm: 75,
      },
    },
  }` | - |
| `'claude-sonnet-4-20250514'` | `{
    name: 'claude-sonnet-4-20250514',
    provider: Vendor.Anthropic,
    description: 'Legacy Sonnet 4. Default for most users, supports 1M context beta',
    isActive: true,
    releaseDate: '2025-05-14',
    knowledgeCutoff: '2025-01-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 200000, // 1M with beta header
        text: true,
        image: true,
        cpm: 3,
        cpmCached: 0.3,
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 15,
      },
    },
  }` | - |
| `'claude-3-7-sonnet-20250219'` | `{
    name: 'claude-3-7-sonnet-20250219',
    provider: Vendor.Anthropic,
    description: 'Claude 3.7 Sonnet with extended thinking, supports 128K output beta',
    isActive: true,
    releaseDate: '2025-02-19',
    knowledgeCutoff: '2024-10-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 200000,
        text: true,
        image: true,
        cpm: 3,
        cpmCached: 0.3,
      },
      output: {
        tokens: 64000, // 128K with beta header
        text: true,
        cpm: 15,
      },
    },
  }` | - |
| `'claude-3-haiku-20240307'` | `{
    name: 'claude-3-haiku-20240307',
    provider: Vendor.Anthropic,
    description: 'Fast legacy model. Recommend migrating to Haiku 4.5',
    isActive: true,
    releaseDate: '2024-03-07',
    knowledgeCutoff: '2023-08-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 200000,
        text: true,
        image: true,
        cpm: 0.25,
        cpmCached: 0.03,
      },
      output: {
        tokens: 4096,
        text: true,
        cpm: 1.25,
      },
    },
  }` | - |
| `'gemini-3-flash-preview'` | `{
    name: 'gemini-3-flash-preview',
    provider: Vendor.Google,
    description: 'Pro-grade reasoning with Flash-level latency and efficiency',
    isActive: true,
    releaseDate: '2025-11-18',
    knowledgeCutoff: '2025-08-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: true,
      video: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 0.15,
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.6,
      },
    },
  }` | - |
| `'gemini-3-pro-preview'` | `{
    name: 'gemini-3-pro-preview',
    provider: Vendor.Google,
    description: 'Most advanced reasoning Gemini model for complex tasks',
    isActive: true,
    releaseDate: '2025-11-18',
    knowledgeCutoff: '2025-08-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: true,
      video: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 1.25,
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 10,
      },
    },
  }` | - |
| `'gemini-3-pro-image-preview'` | `{
    name: 'gemini-3-pro-image-preview',
    provider: Vendor.Google,
    description: 'Highest quality image generation model',
    isActive: true,
    releaseDate: '2025-11-18',
    knowledgeCutoff: '2025-08-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: false,
      functionCalling: false,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        cpm: 1.25,
      },
      output: {
        tokens: 65536,
        text: true,
        image: true,
        cpm: 10,
      },
    },
  }` | - |
| `'gemini-2.5-pro'` | `{
    name: 'gemini-2.5-pro',
    provider: Vendor.Google,
    description: 'Advanced multimodal model built for deep reasoning and agents',
    isActive: true,
    releaseDate: '2025-03-01',
    knowledgeCutoff: '2025-01-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: true,
      video: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 1.25,
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 10,
      },
    },
  }` | - |
| `'gemini-2.5-flash'` | `{
    name: 'gemini-2.5-flash',
    provider: Vendor.Google,
    description: 'Fast, cost-effective model with excellent reasoning',
    isActive: true,
    releaseDate: '2025-06-17',
    knowledgeCutoff: '2025-01-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: true,
      video: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 0.15,
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.6,
      },
    },
  }` | - |
| `'gemini-2.5-flash-lite'` | `{
    name: 'gemini-2.5-flash-lite',
    provider: Vendor.Google,
    description: 'Lowest latency for high-volume tasks, summarization, classification',
    isActive: true,
    releaseDate: '2025-06-17',
    knowledgeCutoff: '2025-01-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: true,
      video: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 0.075,
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.3,
      },
    },
  }` | - |
| `'gemini-2.5-flash-image'` | `{
    name: 'gemini-2.5-flash-image',
    provider: Vendor.Google,
    description: 'Image generation and editing model',
    isActive: true,
    releaseDate: '2025-09-01',
    knowledgeCutoff: '2025-01-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: false,
      functionCalling: false,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        cpm: 0.15,
      },
      output: {
        tokens: 65536,
        text: true,
        image: true,
        cpm: 0.6,
      },
    },
  }` | - |

</details>

---

## OAuth & External APIs

OAuth 2.0 authentication for external services

### OAuthManager `class`

📍 [`src/connectors/oauth/OAuthManager.ts:12`](src/connectors/oauth/OAuthManager.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: OAuthConfig)
```

**Parameters:**
- `config`: `OAuthConfig`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `getToken()`

Get valid access token
Automatically refreshes if expired

```typescript
async getToken(userId?: string): Promise&lt;string&gt;
```

**Parameters:**
- `userId`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;string&gt;`

#### `refreshToken()`

Force refresh the token

```typescript
async refreshToken(userId?: string): Promise&lt;string&gt;
```

**Parameters:**
- `userId`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;string&gt;`

#### `isTokenValid()`

Check if current token is valid

```typescript
async isTokenValid(userId?: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `userId`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;boolean&gt;`

#### `startAuthFlow()`

Start authorization flow (Authorization Code only)
Returns URL for user to visit

```typescript
async startAuthFlow(userId?: string): Promise&lt;string&gt;
```

**Parameters:**
- `userId`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;string&gt;`

#### `handleCallback()`

Handle OAuth callback (Authorization Code only)
Call this with the callback URL after user authorizes

```typescript
async handleCallback(callbackUrl: string, userId?: string): Promise&lt;void&gt;
```

**Parameters:**
- `callbackUrl`: `string`
- `userId`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `revokeToken()`

Revoke token (if supported by provider)

```typescript
async revokeToken(revocationUrl?: string, userId?: string): Promise&lt;void&gt;
```

**Parameters:**
- `revocationUrl`: `string | undefined` *(optional)*
- `userId`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `flow` | `flow: AuthCodePKCEFlow | ClientCredentialsFlow | JWTBearerFlow | StaticTokenFlow` | - |

</details>

---

### ITokenStorage `interface`

📍 [`src/connectors/oauth/domain/ITokenStorage.ts:19`](src/connectors/oauth/domain/ITokenStorage.ts)

Token storage interface
All implementations MUST encrypt tokens before storing

<details>
<summary><strong>Methods</strong></summary>

#### `storeToken()`

Store token (must be encrypted by implementation)

```typescript
storeToken(key: string, token: StoredToken): Promise&lt;void&gt;;
```

**Parameters:**
- `key`: `string`
- `token`: `StoredToken`

**Returns:** `Promise&lt;void&gt;`

#### `getToken()`

Retrieve token (must be decrypted by implementation)

```typescript
getToken(key: string): Promise&lt;StoredToken | null&gt;;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;StoredToken | null&gt;`

#### `deleteToken()`

Delete token

```typescript
deleteToken(key: string): Promise&lt;void&gt;;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `hasToken()`

Check if token exists

```typescript
hasToken(key: string): Promise&lt;boolean&gt;;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;boolean&gt;`

</details>

---

### OAuthConfig `interface`

📍 [`src/connectors/oauth/types.ts:9`](src/connectors/oauth/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `flow` | `flow: OAuthFlow;` | - |
| `tokenUrl` | `tokenUrl: string;` | - |
| `clientId` | `clientId: string;` | - |
| `authorizationUrl?` | `authorizationUrl?: string;` | - |
| `redirectUri?` | `redirectUri?: string;` | - |
| `scope?` | `scope?: string;` | - |
| `usePKCE?` | `usePKCE?: boolean;` | - |
| `clientSecret?` | `clientSecret?: string;` | - |
| `privateKey?` | `privateKey?: string;` | - |
| `privateKeyPath?` | `privateKeyPath?: string;` | - |
| `tokenSigningAlg?` | `tokenSigningAlg?: string;` | - |
| `audience?` | `audience?: string;` | - |
| `staticToken?` | `staticToken?: string;` | - |
| `autoRefresh?` | `autoRefresh?: boolean;` | - |
| `refreshBeforeExpiry?` | `refreshBeforeExpiry?: number;` | - |
| `storage?` | `storage?: ITokenStorage;` | - |
| `storageKey?` | `storageKey?: string;` | - |

</details>

---

### OAuthConnectorAuth `interface`

📍 [`src/domain/entities/Connector.ts:34`](src/domain/entities/Connector.ts)

OAuth 2.0 authentication for connectors
Supports multiple OAuth flows

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'oauth';` | - |
| `flow` | `flow: 'authorization_code' | 'client_credentials' | 'jwt_bearer';` | - |
| `clientId` | `clientId: string;` | - |
| `clientSecret?` | `clientSecret?: string;` | - |
| `tokenUrl` | `tokenUrl: string;` | - |
| `authorizationUrl?` | `authorizationUrl?: string;` | - |
| `redirectUri?` | `redirectUri?: string;` | - |
| `scope?` | `scope?: string;` | - |
| `usePKCE?` | `usePKCE?: boolean;` | - |
| `privateKey?` | `privateKey?: string;` | - |
| `privateKeyPath?` | `privateKeyPath?: string;` | - |
| `issuer?` | `issuer?: string;` | - |
| `subject?` | `subject?: string;` | - |
| `audience?` | `audience?: string;` | - |
| `refreshBeforeExpiry?` | `refreshBeforeExpiry?: number;` | - |
| `storageKey?` | `storageKey?: string;` | - |

</details>

---

### StoredToken `interface`

📍 [`src/connectors/oauth/types.ts:50`](src/connectors/oauth/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `access_token` | `access_token: string;` | - |
| `refresh_token?` | `refresh_token?: string;` | - |
| `expires_in` | `expires_in: number;` | - |
| `token_type` | `token_type: string;` | - |
| `scope?` | `scope?: string;` | - |
| `obtained_at` | `obtained_at: number;` | - |

</details>

---

### StoredToken `interface`

📍 [`src/connectors/oauth/domain/ITokenStorage.ts:6`](src/connectors/oauth/domain/ITokenStorage.ts)

Token storage interface (Clean Architecture - Domain Layer)
All implementations must encrypt tokens at rest

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `access_token` | `access_token: string;` | - |
| `refresh_token?` | `refresh_token?: string;` | - |
| `expires_in` | `expires_in: number;` | - |
| `token_type` | `token_type: string;` | - |
| `scope?` | `scope?: string;` | - |
| `obtained_at` | `obtained_at: number;` | - |

</details>

---

### OAuthFlow `type`

📍 [`src/connectors/oauth/types.ts:7`](src/connectors/oauth/types.ts)

```typescript
type OAuthFlow = 'authorization_code' | 'client_credentials' | 'jwt_bearer' | 'static_token'
```

---

### authenticatedFetch `function`

📍 [`src/connectors/authenticatedFetch.ts:40`](src/connectors/authenticatedFetch.ts)

Fetch with automatic OAuth authentication

Same API as standard fetch(), but with additional authProvider and optional userId parameters.
The OAuth token is automatically retrieved and injected into the Authorization header.

```typescript
export async function authenticatedFetch(
  url: string | URL,
  options: RequestInit | undefined,
  authProvider: string,
  userId?: string
): Promise&lt;Response&gt;
```

**Example:**

Single-user mode:
```typescript
const response = await authenticatedFetch(
'https://graph.microsoft.com/v1.0/me',
{ method: 'GET' },
'microsoft'
);
const data = await response.json();
```
Multi-user mode:
```typescript
const response = await authenticatedFetch(
'https://api.github.com/user/repos',
{ method: 'GET' },
'github',
'user123'  // Get token for specific user
);
const repos = await response.json();
```

---

### createAuthenticatedFetch `function`

📍 [`src/connectors/authenticatedFetch.ts:109`](src/connectors/authenticatedFetch.ts)

Create an authenticated fetch function bound to a specific provider and optionally a user

Useful for creating reusable fetch functions for a specific API and/or user.

```typescript
export function createAuthenticatedFetch(
  authProvider: string,
  userId?: string
): (url: string | URL, options?: RequestInit) =&gt; Promise&lt;Response&gt;
```

**Example:**

Single-user mode:
```typescript
const msftFetch = createAuthenticatedFetch('microsoft');

// Use like normal fetch (auth automatic)
const me = await msftFetch('https://graph.microsoft.com/v1.0/me');
const emails = await msftFetch('https://graph.microsoft.com/v1.0/me/messages');
```
Multi-user mode (bound to specific user):
```typescript
// Create fetch function for Alice
const aliceFetch = createAuthenticatedFetch('github', 'user123');

// All calls automatically use Alice's token
const repos = await aliceFetch('https://api.github.com/user/repos');
const issues = await aliceFetch('https://api.github.com/user/issues');

// Create fetch function for Bob (separate tokens!)
const bobFetch = createAuthenticatedFetch('github', 'user456');
const bobRepos = await bobFetch('https://api.github.com/user/repos');
```
Multi-user mode (userId per-call):
```typescript
// Create fetch function NOT bound to a user
const githubFetch = createAuthenticatedFetch('github');

// Specify userId at call time
const aliceRepos = await githubFetch(
'https://api.github.com/user/repos',
{ userId: 'user123' }  // Pass as custom option
);
```

---

### generateEncryptionKey `function`

📍 [`src/connectors/oauth/utils/encryption.ts:107`](src/connectors/oauth/utils/encryption.ts)

Generate a secure random encryption key
Use this to generate OAUTH_ENCRYPTION_KEY for your .env file

```typescript
export function generateEncryptionKey(): string
```

---

## Resilience & Observability

Circuit breakers, retries, logging, and metrics

### CircuitBreaker `class`

📍 [`src/infrastructure/resilience/CircuitBreaker.ts:114`](src/infrastructure/resilience/CircuitBreaker.ts)

Generic circuit breaker for any async operation

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    public readonly name: string,
    config: Partial&lt;CircuitBreakerConfig&gt; =
```

**Parameters:**
- `name`: `string`
- `config`: `Partial&lt;CircuitBreakerConfig&gt;` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `execute()`

Execute function with circuit breaker protection

```typescript
async execute(fn: () =&gt; Promise&lt;T&gt;): Promise&lt;T&gt;
```

**Parameters:**
- `fn`: `() =&gt; Promise&lt;T&gt;`

**Returns:** `Promise&lt;T&gt;`

#### `getState()`

Get current state

```typescript
getState(): CircuitState
```

**Returns:** `CircuitState`

#### `getMetrics()`

Get current metrics

```typescript
getMetrics(): CircuitBreakerMetrics
```

**Returns:** `CircuitBreakerMetrics`

#### `reset()`

Manually reset circuit breaker (force close)

```typescript
reset(): void
```

**Returns:** `void`

#### `isOpen()`

Check if circuit is allowing requests

```typescript
isOpen(): boolean
```

**Returns:** `boolean`

#### `getConfig()`

Get configuration

```typescript
getConfig(): CircuitBreakerConfig
```

**Returns:** `CircuitBreakerConfig`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `state` | `state: CircuitState` | - |
| `config` | `config: CircuitBreakerConfig` | - |
| `failures` | `failures: FailureRecord[]` | - |
| `lastError` | `lastError: string` | - |
| `consecutiveSuccesses` | `consecutiveSuccesses: number` | - |
| `openedAt?` | `openedAt: number | undefined` | - |
| `lastStateChange` | `lastStateChange: number` | - |
| `totalRequests` | `totalRequests: number` | - |
| `successCount` | `successCount: number` | - |
| `failureCount` | `failureCount: number` | - |
| `rejectedCount` | `rejectedCount: number` | - |
| `lastFailureTime?` | `lastFailureTime: number | undefined` | - |
| `lastSuccessTime?` | `lastSuccessTime: number | undefined` | - |

</details>

---

### CircuitOpenError `class`

📍 [`src/infrastructure/resilience/CircuitBreaker.ts:94`](src/infrastructure/resilience/CircuitBreaker.ts)

Circuit breaker error - thrown when circuit is open

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    public readonly breakerName: string,
    public readonly nextRetryTime: number,
    public readonly failureCount: number,
    public readonly lastError: string
  )
```

**Parameters:**
- `breakerName`: `string`
- `nextRetryTime`: `number`
- `failureCount`: `number`
- `lastError`: `string`

</details>

---

### ConsoleMetrics `class`

📍 [`src/infrastructure/observability/Metrics.ts:50`](src/infrastructure/observability/Metrics.ts)

Console metrics collector (development/debugging)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(prefix: string = 'oneringai')
```

**Parameters:**
- `prefix`: `string` *(optional)* (default: `'oneringai'`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `increment()`

```typescript
increment(metric: string, value: number = 1, tags?: MetricTags): void
```

**Parameters:**
- `metric`: `string`
- `value`: `number` *(optional)* (default: `1`)
- `tags`: `MetricTags | undefined` *(optional)*

**Returns:** `void`

#### `gauge()`

```typescript
gauge(metric: string, value: number, tags?: MetricTags): void
```

**Parameters:**
- `metric`: `string`
- `value`: `number`
- `tags`: `MetricTags | undefined` *(optional)*

**Returns:** `void`

#### `timing()`

```typescript
timing(metric: string, duration: number, tags?: MetricTags): void
```

**Parameters:**
- `metric`: `string`
- `duration`: `number`
- `tags`: `MetricTags | undefined` *(optional)*

**Returns:** `void`

#### `histogram()`

```typescript
histogram(metric: string, value: number, tags?: MetricTags): void
```

**Parameters:**
- `metric`: `string`
- `value`: `number`
- `tags`: `MetricTags | undefined` *(optional)*

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `prefix` | `prefix: string` | - |

</details>

---

### FrameworkLogger `class`

📍 [`src/infrastructure/observability/Logger.ts:158`](src/infrastructure/observability/Logger.ts)

Framework logger

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: LoggerConfig =
```

**Parameters:**
- `config`: `LoggerConfig` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `child()`

Create child logger with additional context

```typescript
child(context: Record&lt;string, any&gt;): FrameworkLogger
```

**Parameters:**
- `context`: `Record&lt;string, any&gt;`

**Returns:** `FrameworkLogger`

#### `trace()`

Trace log

```typescript
trace(obj: Record&lt;string, any&gt; | string, msg?: string): void
```

**Parameters:**
- `obj`: `string | Record&lt;string, any&gt;`
- `msg`: `string | undefined` *(optional)*

**Returns:** `void`

#### `debug()`

Debug log

```typescript
debug(obj: Record&lt;string, any&gt; | string, msg?: string): void
```

**Parameters:**
- `obj`: `string | Record&lt;string, any&gt;`
- `msg`: `string | undefined` *(optional)*

**Returns:** `void`

#### `info()`

Info log

```typescript
info(obj: Record&lt;string, any&gt; | string, msg?: string): void
```

**Parameters:**
- `obj`: `string | Record&lt;string, any&gt;`
- `msg`: `string | undefined` *(optional)*

**Returns:** `void`

#### `warn()`

Warn log

```typescript
warn(obj: Record&lt;string, any&gt; | string, msg?: string): void
```

**Parameters:**
- `obj`: `string | Record&lt;string, any&gt;`
- `msg`: `string | undefined` *(optional)*

**Returns:** `void`

#### `error()`

Error log

```typescript
error(obj: Record&lt;string, any&gt; | string, msg?: string): void
```

**Parameters:**
- `obj`: `string | Record&lt;string, any&gt;`
- `msg`: `string | undefined` *(optional)*

**Returns:** `void`

#### `updateConfig()`

Update configuration

```typescript
updateConfig(config: Partial&lt;LoggerConfig&gt;): void
```

**Parameters:**
- `config`: `Partial&lt;LoggerConfig&gt;`

**Returns:** `void`

#### `close()`

Cleanup resources (call before process exit)

```typescript
close(): void
```

**Returns:** `void`

#### `getLevel()`

Get current log level

```typescript
getLevel(): LogLevel
```

**Returns:** `LogLevel`

#### `isLevelEnabled()`

Check if level is enabled

```typescript
isLevelEnabled(level: LogLevel): boolean
```

**Parameters:**
- `level`: `LogLevel`

**Returns:** `boolean`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `config` | `config: LoggerConfig` | - |
| `context` | `context: Record&lt;string, any&gt;` | - |
| `levelValue` | `levelValue: number` | - |
| `fileStream?` | `fileStream: WriteStream | undefined` | - |

</details>

---

### NoOpMetrics `class`

📍 [`src/infrastructure/observability/Metrics.ts:40`](src/infrastructure/observability/Metrics.ts)

No-op metrics collector (default - zero overhead)

<details>
<summary><strong>Methods</strong></summary>

#### `increment()`

```typescript
increment(): void
```

**Returns:** `void`

#### `gauge()`

```typescript
gauge(): void
```

**Returns:** `void`

#### `timing()`

```typescript
timing(): void
```

**Returns:** `void`

#### `histogram()`

```typescript
histogram(): void
```

**Returns:** `void`

</details>

---

### RateLimitError `class`

📍 [`src/infrastructure/resilience/RateLimiter.ts:13`](src/infrastructure/resilience/RateLimiter.ts)

Error thrown when rate limit is exceeded and onLimit is 'throw'

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    public readonly retryAfterMs: number,
    message?: string
  )
```

**Parameters:**
- `retryAfterMs`: `number`
- `message`: `string | undefined` *(optional)*

</details>

---

### TokenBucketRateLimiter `class`

📍 [`src/infrastructure/resilience/RateLimiter.ts:71`](src/infrastructure/resilience/RateLimiter.ts)

Token bucket rate limiter implementation

Uses a sliding window approach where tokens are refilled completely
when the time window expires.

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: Partial&lt;RateLimiterConfig&gt; =
```

**Parameters:**
- `config`: `Partial&lt;RateLimiterConfig&gt;` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `acquire()`

Acquire a token (request permission to make an LLM call)

```typescript
async acquire(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `tryAcquire()`

Try to acquire without waiting

```typescript
tryAcquire(): boolean
```

**Returns:** `boolean`

#### `getAvailableTokens()`

Get current available tokens

```typescript
getAvailableTokens(): number
```

**Returns:** `number`

#### `getWaitTime()`

Get time until next token is available

```typescript
getWaitTime(): number
```

**Returns:** `number`

#### `getMetrics()`

Get rate limiter metrics

```typescript
getMetrics(): RateLimiterMetrics
```

**Returns:** `RateLimiterMetrics`

#### `reset()`

Reset the rate limiter state

```typescript
reset(): void
```

**Returns:** `void`

#### `resetMetrics()`

Reset metrics

```typescript
resetMetrics(): void
```

**Returns:** `void`

#### `getConfig()`

Get the current configuration

```typescript
getConfig(): Required&lt;RateLimiterConfig&gt;
```

**Returns:** `Required&lt;RateLimiterConfig&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `tokens` | `tokens: number` | - |
| `lastRefill` | `lastRefill: number` | - |
| `config` | `config: Required&lt;RateLimiterConfig&gt;` | - |
| `waitQueue` | `waitQueue: { resolve: () =&gt; void; reject: (e: Error) =&gt; void; timeout?: NodeJS.Timeout | undefined; }[]` | - |
| `totalRequests` | `totalRequests: number` | - |
| `throttledRequests` | `throttledRequests: number` | - |
| `totalWaitMs` | `totalWaitMs: number` | - |

</details>

---

### AgentMetrics `interface`

📍 [`src/domain/entities/AgentState.ts:43`](src/domain/entities/AgentState.ts)

Agent execution metrics

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `totalLLMCalls` | `totalLLMCalls: number;` | - |
| `totalToolCalls` | `totalToolCalls: number;` | - |
| `totalTokensUsed` | `totalTokensUsed: number;` | - |
| `totalCost` | `totalCost: number;` | - |

</details>

---

### BackoffConfig `interface`

📍 [`src/infrastructure/resilience/BackoffStrategy.ts:13`](src/infrastructure/resilience/BackoffStrategy.ts)

Backoff configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `strategy` | `strategy: BackoffStrategyType;` | Strategy type |
| `initialDelayMs` | `initialDelayMs: number;` | Initial delay in ms |
| `maxDelayMs` | `maxDelayMs: number;` | Maximum delay in ms |
| `multiplier?` | `multiplier?: number;` | Multiplier for exponential (default: 2) |
| `incrementMs?` | `incrementMs?: number;` | Increment for linear (default: 1000ms) |
| `jitter?` | `jitter?: boolean;` | Add random jitter to prevent thundering herd |
| `jitterFactor?` | `jitterFactor?: number;` | Jitter factor (0-1, default: 0.1 = ±10%) |
| `isRetryable?` | `isRetryable?: (error: Error) =&gt; boolean;` | Classify errors - return true if error should be retried |

</details>

---

### CircuitBreakerConfig `interface`

📍 [`src/infrastructure/resilience/CircuitBreaker.ts:26`](src/infrastructure/resilience/CircuitBreaker.ts)

Circuit breaker configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `failureThreshold` | `failureThreshold: number;` | Number of failures before opening circuit |
| `successThreshold` | `successThreshold: number;` | Number of successes to close from half-open |
| `resetTimeoutMs` | `resetTimeoutMs: number;` | Time to wait in open state before trying half-open (ms) |
| `windowMs` | `windowMs: number;` | Time window for counting failures (ms) |
| `isRetryable?` | `isRetryable?: (error: Error) =&gt; boolean;` | Classify errors - return true if error should count as failure |

</details>

---

### CircuitBreakerEvents `interface`

📍 [`src/infrastructure/resilience/CircuitBreaker.ts:74`](src/infrastructure/resilience/CircuitBreaker.ts)

Circuit breaker events

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `opened` | `opened: { name: string; failureCount: number; lastError: string; nextRetryTime: number };` | - |
| `'half-open'` | `'half-open': { name: string; timestamp: number };` | - |
| `closed` | `closed: { name: string; successCount: number; timestamp: number };` | - |

</details>

---

### CircuitBreakerMetrics `interface`

📍 [`src/infrastructure/resilience/CircuitBreaker.ts:46`](src/infrastructure/resilience/CircuitBreaker.ts)

Circuit breaker metrics

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string;` | - |
| `state` | `state: CircuitState;` | - |
| `totalRequests` | `totalRequests: number;` | - |
| `successCount` | `successCount: number;` | - |
| `failureCount` | `failureCount: number;` | - |
| `rejectedCount` | `rejectedCount: number;` | - |
| `recentFailures` | `recentFailures: number;` | - |
| `consecutiveSuccesses` | `consecutiveSuccesses: number;` | - |
| `lastFailureTime?` | `lastFailureTime?: number;` | - |
| `lastSuccessTime?` | `lastSuccessTime?: number;` | - |
| `lastStateChange` | `lastStateChange: number;` | - |
| `nextRetryTime?` | `nextRetryTime?: number;` | - |
| `failureRate` | `failureRate: number;` | - |
| `successRate` | `successRate: number;` | - |

</details>

---

### ExecutionMetrics `interface`

📍 [`src/capabilities/agents/ExecutionContext.ts:36`](src/capabilities/agents/ExecutionContext.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `totalDuration` | `totalDuration: number;` | - |
| `llmDuration` | `llmDuration: number;` | - |
| `toolDuration` | `toolDuration: number;` | - |
| `hookDuration` | `hookDuration: number;` | - |
| `iterationCount` | `iterationCount: number;` | - |
| `toolCallCount` | `toolCallCount: number;` | - |
| `toolSuccessCount` | `toolSuccessCount: number;` | - |
| `toolFailureCount` | `toolFailureCount: number;` | - |
| `toolTimeoutCount` | `toolTimeoutCount: number;` | - |
| `inputTokens` | `inputTokens: number;` | - |
| `outputTokens` | `outputTokens: number;` | - |
| `totalTokens` | `totalTokens: number;` | - |
| `errors` | `errors: Array&lt;{ type: string; message: string; timestamp: Date }&gt;;` | - |

</details>

---

### LogEntry `interface`

📍 [`src/infrastructure/observability/Logger.ts:148`](src/infrastructure/observability/Logger.ts)

Log entry

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `level` | `level: LogLevel;` | - |
| `time` | `time: number;` | - |
| `msg` | `msg: string;` | - |

</details>

---

### LoggerConfig `interface`

📍 [`src/infrastructure/observability/Logger.ts:128`](src/infrastructure/observability/Logger.ts)

Logger configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `level?` | `level?: LogLevel;` | Log level |
| `pretty?` | `pretty?: boolean;` | Pretty print for development |
| `context?` | `context?: Record&lt;string, any&gt;;` | Base context added to all logs |
| `destination?` | `destination?: 'console' | 'stdout' | 'stderr';` | Custom destination (default: console) |
| `filePath?` | `filePath?: string;` | File path for file logging |

</details>

---

### MetricsCollector `interface`

📍 [`src/infrastructure/observability/Metrics.ts:15`](src/infrastructure/observability/Metrics.ts)

Metrics collector interface

<details>
<summary><strong>Methods</strong></summary>

#### `increment()`

Increment a counter

```typescript
increment(metric: string, value?: number, tags?: MetricTags): void;
```

**Parameters:**
- `metric`: `string`
- `value`: `number | undefined` *(optional)*
- `tags`: `MetricTags | undefined` *(optional)*

**Returns:** `void`

#### `gauge()`

Set a gauge value

```typescript
gauge(metric: string, value: number, tags?: MetricTags): void;
```

**Parameters:**
- `metric`: `string`
- `value`: `number`
- `tags`: `MetricTags | undefined` *(optional)*

**Returns:** `void`

#### `timing()`

Record a timing/duration

```typescript
timing(metric: string, duration: number, tags?: MetricTags): void;
```

**Parameters:**
- `metric`: `string`
- `duration`: `number`
- `tags`: `MetricTags | undefined` *(optional)*

**Returns:** `void`

#### `histogram()`

Record a histogram value

```typescript
histogram(metric: string, value: number, tags?: MetricTags): void;
```

**Parameters:**
- `metric`: `string`
- `value`: `number`
- `tags`: `MetricTags | undefined` *(optional)*

**Returns:** `void`

</details>

---

### RateLimiterConfig `interface`

📍 [`src/infrastructure/resilience/RateLimiter.ts:27`](src/infrastructure/resilience/RateLimiter.ts)

Configuration for the rate limiter

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxRequests` | `maxRequests: number;` | Max requests allowed in window |
| `windowMs?` | `windowMs?: number;` | Time window in ms (default: 60000 = 1 minute) |
| `onLimit` | `onLimit: 'wait' | 'throw';` | What to do when rate limited |
| `maxWaitMs?` | `maxWaitMs?: number;` | Max wait time in ms (for 'wait' mode, default: 60000) |

</details>

---

### RateLimiterMetrics `interface`

📍 [`src/infrastructure/resilience/RateLimiter.ts:54`](src/infrastructure/resilience/RateLimiter.ts)

Rate limiter metrics

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `totalRequests` | `totalRequests: number;` | Total requests made |
| `throttledRequests` | `throttledRequests: number;` | Total requests throttled |
| `totalWaitMs` | `totalWaitMs: number;` | Total wait time in ms |
| `avgWaitMs` | `avgWaitMs: number;` | Average wait time in ms |

</details>

---

### BackoffStrategyType `type`

📍 [`src/infrastructure/resilience/BackoffStrategy.ts:8`](src/infrastructure/resilience/BackoffStrategy.ts)

Backoff strategies for retry logic

```typescript
type BackoffStrategyType = 'exponential' | 'linear' | 'constant'
```

---

### CircuitState `type`

📍 [`src/infrastructure/resilience/CircuitBreaker.ts:13`](src/infrastructure/resilience/CircuitBreaker.ts)

Circuit breaker states

```typescript
type CircuitState = 'closed' | 'open' | 'half-open'
```

---

### LogLevel `type`

📍 [`src/infrastructure/observability/Logger.ts:19`](src/infrastructure/observability/Logger.ts)

Log level

```typescript
type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'
```

---

### MetricsCollectorType `type`

📍 [`src/infrastructure/observability/Metrics.ts:187`](src/infrastructure/observability/Metrics.ts)

Metrics collector type

```typescript
type MetricsCollectorType = 'noop' | 'console' | 'inmemory'
```

---

### MetricTags `type`

📍 [`src/infrastructure/observability/Metrics.ts:10`](src/infrastructure/observability/Metrics.ts)

Metrics collection infrastructure

Pluggable metrics system with support for various backends.

```typescript
type MetricTags = Record&lt;string, string | number | boolean&gt;
```

---

### addJitter `function`

📍 [`src/infrastructure/resilience/BackoffStrategy.ts:92`](src/infrastructure/resilience/BackoffStrategy.ts)

Add random jitter to a delay

```typescript
export function addJitter(delay: number, factor: number = 0.1): number
```

---

### backoffSequence `function`

📍 [`src/infrastructure/resilience/BackoffStrategy.ts:116`](src/infrastructure/resilience/BackoffStrategy.ts)

Backoff iterator - generates delays for each attempt

```typescript
export function* backoffSequence(
  config: BackoffConfig = DEFAULT_BACKOFF_CONFIG,
  maxAttempts?: number
): Generator&lt;number, void, unknown&gt;
```

---

### backoffWait `function`

📍 [`src/infrastructure/resilience/BackoffStrategy.ts:105`](src/infrastructure/resilience/BackoffStrategy.ts)

Wait for backoff delay

```typescript
export async function backoffWait(attempt: number, config: BackoffConfig = DEFAULT_BACKOFF_CONFIG): Promise&lt;number&gt;
```

---

### calculateBackoff `function`

📍 [`src/infrastructure/resilience/BackoffStrategy.ts:54`](src/infrastructure/resilience/BackoffStrategy.ts)

Calculate backoff delay for given attempt

```typescript
export function calculateBackoff(attempt: number, config: BackoffConfig = DEFAULT_BACKOFF_CONFIG): number
```

---

### createMetricsCollector `function`

📍 [`src/infrastructure/observability/Metrics.ts:192`](src/infrastructure/observability/Metrics.ts)

Create metrics collector from type

```typescript
export function createMetricsCollector(type?: MetricsCollectorType, prefix?: string): MetricsCollector
```

---

### retryWithBackoff `function`

📍 [`src/infrastructure/resilience/BackoffStrategy.ts:140`](src/infrastructure/resilience/BackoffStrategy.ts)

Retry with backoff

```typescript
export async function retryWithBackoff&lt;T&gt;(
  fn: () =&gt; Promise&lt;T&gt;,
  config: BackoffConfig = DEFAULT_BACKOFF_CONFIG,
  maxAttempts?: number
): Promise&lt;T&gt;
```

---

### setMetricsCollector `function`

📍 [`src/infrastructure/observability/Metrics.ts:216`](src/infrastructure/observability/Metrics.ts)

Update global metrics collector

```typescript
export function setMetricsCollector(collector: MetricsCollector): void
```

---

### DEFAULT_BACKOFF_CONFIG `const`

📍 [`src/infrastructure/resilience/BackoffStrategy.ts:42`](src/infrastructure/resilience/BackoffStrategy.ts)

Default backoff configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `strategy` | `'exponential'` | - |
| `initialDelayMs` | `1000` | - |
| `maxDelayMs` | `30000` | - |
| `multiplier` | `2` | - |
| `jitter` | `true` | - |
| `jitterFactor` | `0.1` | - |

</details>

---

### DEFAULT_CIRCUIT_BREAKER_CONFIG `const`

📍 [`src/infrastructure/resilience/CircuitBreaker.ts:83`](src/infrastructure/resilience/CircuitBreaker.ts)

Default configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `failureThreshold` | `5` | - |
| `successThreshold` | `2` | - |
| `resetTimeoutMs` | `30000` | - |
| `windowMs` | `60000` | - |
| `isRetryable` | `() =&gt; true` | - |

</details>

---

### DEFAULT_RATE_LIMITER_CONFIG `const`

📍 [`src/infrastructure/resilience/RateLimiter.ts:44`](src/infrastructure/resilience/RateLimiter.ts)

Default rate limiter configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxRequests` | `60` | - |
| `windowMs` | `60000` | - |
| `onLimit` | `'wait'` | - |
| `maxWaitMs` | `60000` | - |

</details>

---

## Errors

Error types and handling

### AIError `class`

📍 [`src/domain/errors/AIErrors.ts:5`](src/domain/errors/AIErrors.ts)

Custom error classes for the AI library

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error
  )
```

**Parameters:**
- `message`: `string`
- `code`: `string`
- `statusCode`: `number | undefined` *(optional)*
- `originalError`: `Error | undefined` *(optional)*

</details>

---

### DependencyCycleError `class`

📍 [`src/domain/errors/AIErrors.ts:177`](src/domain/errors/AIErrors.ts)

Error thrown when a dependency cycle is detected in a plan

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    /** Task IDs forming the cycle (e.g., ['A', 'B', 'C', 'A']) */
    public readonly cycle: string[],
    /** Plan ID where the cycle was detected */
    public readonly planId?: string
  )
```

**Parameters:**
- `cycle`: `string[]`
- `planId`: `string | undefined` *(optional)*

</details>

---

### ErrorHandler `class`

📍 [`src/core/ErrorHandler.ts:122`](src/core/ErrorHandler.ts)

Centralized error handling for all agent types.

Features:
- Consistent error logging with context
- Automatic retry with exponential backoff
- Error classification (recoverable vs fatal)
- Metrics collection
- Event emission for monitoring

**Example:**

```typescript
const errorHandler = new ErrorHandler({
  maxRetries: 3,
  logErrors: true,
});

// Handle an error
errorHandler.handle(error, {
  agentType: 'agent',
  operation: 'run',
});

// Execute with retry
const result = await errorHandler.executeWithRetry(
  () => riskyOperation(),
  { agentType: 'agent', operation: 'riskyOperation' }
);
```

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: ErrorHandlerConfig =
```

**Parameters:**
- `config`: `ErrorHandlerConfig` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `handle()`

Handle an error with context.
Logs the error, emits events, and records metrics.

```typescript
handle(error: Error, context: ErrorContext): void
```

**Parameters:**
- `error`: `Error`
- `context`: `ErrorContext`

**Returns:** `void`

#### `executeWithRetry()`

Execute a function with automatic retry on retryable errors.

```typescript
async executeWithRetry&lt;T&gt;(
    fn: () =&gt; Promise&lt;T&gt;,
    context: ErrorContext
  ): Promise&lt;T&gt;
```

**Parameters:**
- `fn`: `() =&gt; Promise&lt;T&gt;`
- `context`: `ErrorContext`

**Returns:** `Promise&lt;T&gt;`

#### `wrap()`

Wrap a function with error handling (no retry).
Useful for wrapping methods that already have their own retry logic.

```typescript
wrap&lt;TArgs extends unknown[], TResult&gt;(
    fn: (...args: TArgs) =&gt; Promise&lt;TResult&gt;,
    contextFactory: (...args: TArgs) =&gt; ErrorContext
  ): (...args: TArgs) =&gt; Promise&lt;TResult&gt;
```

**Parameters:**
- `fn`: `(...args: TArgs) =&gt; Promise&lt;TResult&gt;`
- `contextFactory`: `(...args: TArgs) =&gt; ErrorContext`

**Returns:** `(...args: TArgs) =&gt; Promise&lt;TResult&gt;`

#### `isRecoverable()`

Check if an error is recoverable (can be retried or handled gracefully).

```typescript
isRecoverable(error: Error): boolean
```

**Parameters:**
- `error`: `Error`

**Returns:** `boolean`

#### `isRetryable()`

Check if an error should be retried.

```typescript
isRetryable(error: Error): boolean
```

**Parameters:**
- `error`: `Error`

**Returns:** `boolean`

#### `addRetryablePattern()`

Add a retryable pattern.

```typescript
addRetryablePattern(pattern: string): void
```

**Parameters:**
- `pattern`: `string`

**Returns:** `void`

#### `removeRetryablePattern()`

Remove a retryable pattern.

```typescript
removeRetryablePattern(pattern: string): void
```

**Parameters:**
- `pattern`: `string`

**Returns:** `void`

#### `getConfig()`

Get current configuration (read-only).

```typescript
getConfig(): Readonly&lt;Required&lt;ErrorHandlerConfig&gt;&gt;
```

**Returns:** `Readonly&lt;Required&lt;ErrorHandlerConfig&gt;&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `config` | `config: Required&lt;ErrorHandlerConfig&gt;` | - |
| `logger` | `logger: FrameworkLogger` | - |

</details>

---

### InvalidConfigError `class`

📍 [`src/domain/errors/AIErrors.ts:129`](src/domain/errors/AIErrors.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(message: string)
```

**Parameters:**
- `message`: `string`

</details>

---

### MCPConnectionError `class`

📍 [`src/domain/errors/MCPError.ts:27`](src/domain/errors/MCPError.ts)

Connection-related errors (failed to connect, disconnected unexpectedly)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(message: string, serverName?: string, cause?: Error)
```

**Parameters:**
- `message`: `string`
- `serverName`: `string | undefined` *(optional)*
- `cause`: `Error | undefined` *(optional)*

</details>

---

### MCPError `class`

📍 [`src/domain/errors/MCPError.ts:10`](src/domain/errors/MCPError.ts)

MCP Error Classes

Error hierarchy for MCP-related failures.

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    message: string,
    public readonly serverName?: string,
    public readonly cause?: Error
  )
```

**Parameters:**
- `message`: `string`
- `serverName`: `string | undefined` *(optional)*
- `cause`: `Error | undefined` *(optional)*

</details>

---

### MCPProtocolError `class`

📍 [`src/domain/errors/MCPError.ts:52`](src/domain/errors/MCPError.ts)

Protocol-level errors (invalid message, unsupported capability)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(message: string, serverName?: string, cause?: Error)
```

**Parameters:**
- `message`: `string`
- `serverName`: `string | undefined` *(optional)*
- `cause`: `Error | undefined` *(optional)*

</details>

---

### MCPResourceError `class`

📍 [`src/domain/errors/MCPError.ts:77`](src/domain/errors/MCPError.ts)

Resource-related errors (resource not found, subscription failed)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    message: string,
    public readonly resourceUri: string,
    serverName?: string,
    cause?: Error
  )
```

**Parameters:**
- `message`: `string`
- `resourceUri`: `string`
- `serverName`: `string | undefined` *(optional)*
- `cause`: `Error | undefined` *(optional)*

</details>

---

### MCPTimeoutError `class`

📍 [`src/domain/errors/MCPError.ts:37`](src/domain/errors/MCPError.ts)

Timeout errors (request timeout, connection timeout)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    message: string,
    public readonly timeoutMs: number,
    serverName?: string,
    cause?: Error
  )
```

**Parameters:**
- `message`: `string`
- `timeoutMs`: `number`
- `serverName`: `string | undefined` *(optional)*
- `cause`: `Error | undefined` *(optional)*

</details>

---

### ProviderAuthError `class`

📍 [`src/domain/errors/AIErrors.ts:30`](src/domain/errors/AIErrors.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(providerName: string, message: string = 'Authentication failed')
```

**Parameters:**
- `providerName`: `string`
- `message`: `string` *(optional)* (default: `'Authentication failed'`)

</details>

---

### ProviderContextLengthError `class`

📍 [`src/domain/errors/AIErrors.ts:57`](src/domain/errors/AIErrors.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    providerName: string,
    public readonly maxTokens: number,
    public readonly requestedTokens?: number
  )
```

**Parameters:**
- `providerName`: `string`
- `maxTokens`: `number`
- `requestedTokens`: `number | undefined` *(optional)*

</details>

---

### ProviderError `class`

📍 [`src/domain/errors/AIErrors.ts:154`](src/domain/errors/AIErrors.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    public readonly providerName: string,
    message: string,
    statusCode?: number,
    originalError?: Error
  )
```

**Parameters:**
- `providerName`: `string`
- `message`: `string`
- `statusCode`: `number | undefined` *(optional)*
- `originalError`: `Error | undefined` *(optional)*

</details>

---

### ProviderErrorMapper `class`

📍 [`src/infrastructure/providers/base/ProviderErrorMapper.ts:22`](src/infrastructure/providers/base/ProviderErrorMapper.ts)

Maps provider-specific errors to our unified error types

<details>
<summary><strong>Static Methods</strong></summary>

#### `static mapError()`

Map any provider error to our standard error types

```typescript
static mapError(error: any, context: ProviderErrorContext): AIError
```

**Parameters:**
- `error`: `any`
- `context`: `ProviderErrorContext`

**Returns:** `AIError`

</details>

---

### ProviderNotFoundError `class`

📍 [`src/domain/errors/AIErrors.ts:18`](src/domain/errors/AIErrors.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(providerName: string)
```

**Parameters:**
- `providerName`: `string`

</details>

---

### ProviderRateLimitError `class`

📍 [`src/domain/errors/AIErrors.ts:42`](src/domain/errors/AIErrors.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    providerName: string,
    public readonly retryAfter?: number
  )
```

**Parameters:**
- `providerName`: `string`
- `retryAfter`: `number | undefined` *(optional)*

</details>

---

### ErrorContext `interface`

📍 [`src/core/ErrorHandler.ts:15`](src/core/ErrorHandler.ts)

Context information for error handling

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agentType` | `agentType: 'agent' | 'task-agent' | 'universal-agent';` | Type of agent |
| `agentId?` | `agentId?: string;` | Optional agent identifier |
| `operation` | `operation: string;` | Operation that failed |
| `input?` | `input?: unknown;` | Input that caused the error (optional, for debugging) |
| `metadata?` | `metadata?: Record&lt;string, unknown&gt;;` | Additional metadata |

</details>

---

### ErrorHandlerConfig `interface`

📍 [`src/core/ErrorHandler.ts:35`](src/core/ErrorHandler.ts)

Configuration for ErrorHandler

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `logErrors?` | `logErrors?: boolean;` | Log errors to console/logger. Default: true |
| `includeStackTrace?` | `includeStackTrace?: boolean;` | Include stack traces in logs. Default: true in development, false in production |
| `transformError?` | `transformError?: (error: Error, context: ErrorContext) =&gt; Error;` | Custom error transformer |
| `retryablePatterns?` | `retryablePatterns?: string[];` | Error codes/messages that should be retried |
| `maxRetries?` | `maxRetries?: number;` | Maximum retry attempts. Default: 3 |
| `baseRetryDelayMs?` | `baseRetryDelayMs?: number;` | Base delay for exponential backoff in ms. Default: 100 |
| `maxRetryDelayMs?` | `maxRetryDelayMs?: number;` | Maximum retry delay in ms. Default: 5000 |

</details>

---

### ErrorHandlerEvents `interface`

📍 [`src/core/ErrorHandler.ts:61`](src/core/ErrorHandler.ts)

Events emitted by ErrorHandler

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `error` | `error: { error: Error; context: ErrorContext; recoverable: boolean };` | Emitted when an error is handled |
| `'error:retrying'` | `'error:retrying': { error: Error; context: ErrorContext; attempt: number; delayMs: number };` | Emitted when retrying after an error |
| `'error:fatal'` | `'error:fatal': { error: Error; context: ErrorContext };` | Emitted when an error is fatal (no recovery possible) |

</details>

---

## Utilities

Helper functions and utilities

### MessageBuilder `class`

📍 [`src/utils/messageBuilder.ts:12`](src/utils/messageBuilder.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `addUserMessage()`

Add a user text message

```typescript
addUserMessage(text: string): this
```

**Parameters:**
- `text`: `string`

**Returns:** `this`

#### `addUserMessageWithImages()`

Add a user message with text and images

```typescript
addUserMessageWithImages(text: string, imageUrls: string[]): this
```

**Parameters:**
- `text`: `string`
- `imageUrls`: `string[]`

**Returns:** `this`

#### `addAssistantMessage()`

Add an assistant message (for conversation history)

```typescript
addAssistantMessage(text: string): this
```

**Parameters:**
- `text`: `string`

**Returns:** `this`

#### `addDeveloperMessage()`

Add a system/developer message

```typescript
addDeveloperMessage(text: string): this
```

**Parameters:**
- `text`: `string`

**Returns:** `this`

#### `build()`

Build and return the messages array

```typescript
build(): InputItem[]
```

**Returns:** `InputItem[]`

#### `clear()`

Clear all messages

```typescript
clear(): this
```

**Returns:** `this`

#### `count()`

Get the current message count

```typescript
count(): number
```

**Returns:** `number`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `messages` | `messages: InputItem[]` | - |

</details>

---

### JSONExtractionResult `interface`

📍 [`src/utils/jsonExtractor.ts:11`](src/utils/jsonExtractor.ts)

JSON Extractor Utilities

Extracts JSON from LLM responses that may contain markdown formatting,
code blocks, or other text mixed with JSON data.

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | Whether extraction was successful |
| `data?` | `data?: T;` | Extracted and parsed data (if successful) |
| `rawJson?` | `rawJson?: string;` | Raw JSON string that was parsed (if found) |
| `error?` | `error?: string;` | Error message (if failed) |
| `method?` | `method?: 'code_block' | 'inline' | 'raw';` | How the JSON was found |

</details>

---

### createTextMessage `function`

📍 [`src/utils/messageBuilder.ts:124`](src/utils/messageBuilder.ts)

Helper function to create a simple text message

```typescript
export function createTextMessage(text: string, role: MessageRole = MessageRole.USER): InputItem
```

---

### extractJSON `function`

📍 [`src/utils/jsonExtractor.ts:49`](src/utils/jsonExtractor.ts)

Extract JSON from a string that may contain markdown code blocks or other formatting.

Tries multiple extraction strategies in order:
1. JSON inside markdown code blocks (```json ... ``` or ``` ... ```)
2. First complete JSON object/array found in text
3. Raw string as JSON

```typescript
export function extractJSON&lt;T = unknown&gt;(text: string): JSONExtractionResult&lt;T&gt;
```

**Example:**

```typescript
const response = `Here's the result:
\`\`\`json
{"score": 85, "valid": true}
\`\`\`
That's the answer.`;

const result = extractJSON<{score: number, valid: boolean}>(response);
if (result.success) {
  console.log(result.data.score); // 85
}
```

---

### extractJSONField `function`

📍 [`src/utils/jsonExtractor.ts:258`](src/utils/jsonExtractor.ts)

Safely extract a specific field from JSON embedded in text

```typescript
export function extractJSONField&lt;T&gt;(
  text: string,
  field: string,
  defaultValue: T
): T
```

**Example:**

```typescript
const score = extractJSONField<number>(llmResponse, 'completionScore', 50);
```

---

### extractNumber `function`

📍 [`src/utils/jsonExtractor.ts:283`](src/utils/jsonExtractor.ts)

Extract a number from text, trying JSON first, then regex patterns

```typescript
export function extractNumber(
  text: string,
  patterns: RegExp[] = [
    /(\d
```

**Example:**

```typescript
const score = extractNumber(llmResponse, [/(\d{1,3})%?\s*complete/i], 50);
```

---

## Interfaces

TypeScript interfaces for extensibility

### HistoryManagerEvents `interface`

📍 [`src/domain/interfaces/IHistoryManager.ts:24`](src/domain/interfaces/IHistoryManager.ts)

Events emitted by IHistoryManager implementations

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'message:added'` | `'message:added': { message: HistoryMessage };` | - |
| `'message:removed'` | `'message:removed': { messageId: string };` | - |
| `'history:cleared'` | `'history:cleared': { reason?: string };` | - |
| `'history:compacted'` | `'history:compacted': { removedCount: number; strategy: string };` | - |
| `'history:restored'` | `'history:restored': { messageCount: number };` | - |

</details>

---

### HistoryMessage `interface`

📍 [`src/domain/interfaces/IHistoryManager.ts:13`](src/domain/interfaces/IHistoryManager.ts)

A single message in conversation history

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | - |
| `role` | `role: 'user' | 'assistant' | 'system';` | - |
| `content` | `content: string;` | - |
| `timestamp` | `timestamp: number;` | - |
| `metadata?` | `metadata?: Record&lt;string, unknown&gt;;` | - |

</details>

---

### IAgentStateStorage `interface`

📍 [`src/domain/interfaces/IAgentStateStorage.ts:8`](src/domain/interfaces/IAgentStateStorage.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

Save agent state

```typescript
save(state: AgentState): Promise&lt;void&gt;;
```

**Parameters:**
- `state`: `AgentState`

**Returns:** `Promise&lt;void&gt;`

#### `load()`

Load agent state

```typescript
load(agentId: string): Promise&lt;AgentState | undefined&gt;;
```

**Parameters:**
- `agentId`: `string`

**Returns:** `Promise&lt;AgentState | undefined&gt;`

#### `delete()`

Delete agent state

```typescript
delete(agentId: string): Promise&lt;void&gt;;
```

**Parameters:**
- `agentId`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `list()`

List agents by status

```typescript
list(filter?: { status?: AgentStatus[] }): Promise&lt;AgentState[]&gt;;
```

**Parameters:**
- `filter`: `{ status?: AgentStatus[] | undefined; } | undefined` *(optional)*

**Returns:** `Promise&lt;AgentState[]&gt;`

#### `patch()`

Update specific fields (partial update for efficiency)

```typescript
patch(agentId: string, updates: Partial&lt;AgentState&gt;): Promise&lt;void&gt;;
```

**Parameters:**
- `agentId`: `string`
- `updates`: `Partial&lt;AgentState&gt;`

**Returns:** `Promise&lt;void&gt;`

</details>

---

### IAsyncDisposable `interface`

📍 [`src/domain/interfaces/IDisposable.ts:33`](src/domain/interfaces/IDisposable.ts)

Async version of IDisposable for resources requiring async cleanup.

<details>
<summary><strong>Methods</strong></summary>

#### `destroy()`

Asynchronously releases all resources held by this instance.

```typescript
destroy(): Promise&lt;void&gt;;
```

**Returns:** `Promise&lt;void&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `isDestroyed` | `readonly isDestroyed: boolean;` | Returns true if destroy() has been called. |

</details>

---

### IConnectorConfigStorage `interface`

📍 [`src/domain/interfaces/IConnectorConfigStorage.ts:35`](src/domain/interfaces/IConnectorConfigStorage.ts)

Storage interface for ConnectorConfig persistence

Implementations should:
- Store data as-is (encryption is handled by ConnectorConfigStore)
- Use appropriate file permissions for file-based storage
- Hash names for filenames to prevent enumeration attacks

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

Save a connector configuration

```typescript
save(name: string, stored: StoredConnectorConfig): Promise&lt;void&gt;;
```

**Parameters:**
- `name`: `string`
- `stored`: `StoredConnectorConfig`

**Returns:** `Promise&lt;void&gt;`

#### `get()`

Retrieve a connector configuration by name

```typescript
get(name: string): Promise&lt;StoredConnectorConfig | null&gt;;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;StoredConnectorConfig | null&gt;`

#### `delete()`

Delete a connector configuration

```typescript
delete(name: string): Promise&lt;boolean&gt;;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `has()`

Check if a connector configuration exists

```typescript
has(name: string): Promise&lt;boolean&gt;;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `list()`

List all connector names

```typescript
list(): Promise&lt;string[]&gt;;
```

**Returns:** `Promise&lt;string[]&gt;`

#### `listAll()`

Get all stored connector configurations

```typescript
listAll(): Promise&lt;StoredConnectorConfig[]&gt;;
```

**Returns:** `Promise&lt;StoredConnectorConfig[]&gt;`

</details>

---

### IDisposable `interface`

📍 [`src/domain/interfaces/IDisposable.ts:9`](src/domain/interfaces/IDisposable.ts)

Interface for objects that manage resources and need explicit cleanup.

Implementing classes should release all resources (event listeners, timers,
connections, etc.) when destroy() is called. After destruction, the instance
should not be used.

<details>
<summary><strong>Methods</strong></summary>

#### `destroy()`

Releases all resources held by this instance.

After calling destroy():
- All event listeners should be removed
- All timers/intervals should be cleared
- All internal state should be cleaned up
- The instance should not be reused

Multiple calls to destroy() should be safe (idempotent).

```typescript
destroy(): void;
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `isDestroyed` | `readonly isDestroyed: boolean;` | Returns true if destroy() has been called.
Methods should check this before performing operations. |

</details>

---

### IHistoryManager `interface`

📍 [`src/domain/interfaces/IHistoryManager.ts:114`](src/domain/interfaces/IHistoryManager.ts)

Interface for history manager
Manages conversation history with compaction and persistence support

<details>
<summary><strong>Methods</strong></summary>

#### `addMessage()`

Add a message to history

```typescript
addMessage(role: 'user' | 'assistant' | 'system', content: string, metadata?: Record&lt;string, unknown&gt;): Promise&lt;HistoryMessage&gt;;
```

**Parameters:**
- `role`: `"user" | "assistant" | "system"`
- `content`: `string`
- `metadata`: `Record&lt;string, unknown&gt; | undefined` *(optional)*

**Returns:** `Promise&lt;HistoryMessage&gt;`

#### `getMessages()`

Get all messages (may include summaries as system messages)

```typescript
getMessages(): Promise&lt;HistoryMessage[]&gt;;
```

**Returns:** `Promise&lt;HistoryMessage[]&gt;`

#### `getRecentMessages()`

Get recent messages only

```typescript
getRecentMessages(count?: number): Promise&lt;HistoryMessage[]&gt;;
```

**Parameters:**
- `count`: `number | undefined` *(optional)*

**Returns:** `Promise&lt;HistoryMessage[]&gt;`

#### `formatForContext()`

Get formatted history for LLM context

```typescript
formatForContext(options?: { maxTokens?: number; includeMetadata?: boolean }): Promise&lt;string&gt;;
```

**Parameters:**
- `options`: `{ maxTokens?: number | undefined; includeMetadata?: boolean | undefined; } | undefined` *(optional)*

**Returns:** `Promise&lt;string&gt;`

#### `compact()`

Compact history (apply compaction strategy)

```typescript
compact(): Promise&lt;void&gt;;
```

**Returns:** `Promise&lt;void&gt;`

#### `clear()`

Clear all history

```typescript
clear(): Promise&lt;void&gt;;
```

**Returns:** `Promise&lt;void&gt;`

#### `getMessageCount()`

Get message count

```typescript
getMessageCount(): Promise&lt;number&gt;;
```

**Returns:** `Promise&lt;number&gt;`

#### `getState()`

Get state for session persistence

```typescript
getState(): Promise&lt;SerializedHistoryState&gt;;
```

**Returns:** `Promise&lt;SerializedHistoryState&gt;`

#### `restoreState()`

Restore from saved state

```typescript
restoreState(state: SerializedHistoryState): Promise&lt;void&gt;;
```

**Parameters:**
- `state`: `SerializedHistoryState`

**Returns:** `Promise&lt;void&gt;`

#### `getConfig()`

Get current configuration

```typescript
getConfig(): IHistoryManagerConfig;
```

**Returns:** `IHistoryManagerConfig`

</details>

---

### IHistoryManagerConfig `interface`

📍 [`src/domain/interfaces/IHistoryManager.ts:35`](src/domain/interfaces/IHistoryManager.ts)

Configuration for history management

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxMessages?` | `maxMessages?: number;` | Maximum messages to keep (for sliding window) |
| `maxTokens?` | `maxTokens?: number;` | Maximum tokens to keep (estimated) |
| `compactionStrategy?` | `compactionStrategy?: 'truncate' | 'summarize' | 'sliding-window';` | Compaction strategy when limits are reached |
| `preserveRecentCount?` | `preserveRecentCount?: number;` | Number of recent messages to always preserve |

</details>

---

### IHistoryStorage `interface`

📍 [`src/domain/interfaces/IHistoryManager.ts:63`](src/domain/interfaces/IHistoryManager.ts)

Interface for history storage backends
Implement this to use custom storage (Redis, PostgreSQL, file, etc.)

<details>
<summary><strong>Methods</strong></summary>

#### `addMessage()`

Store a message

```typescript
addMessage(message: HistoryMessage): Promise&lt;void&gt;;
```

**Parameters:**
- `message`: `HistoryMessage`

**Returns:** `Promise&lt;void&gt;`

#### `getMessages()`

Get all messages

```typescript
getMessages(): Promise&lt;HistoryMessage[]&gt;;
```

**Returns:** `Promise&lt;HistoryMessage[]&gt;`

#### `getRecentMessages()`

Get recent N messages

```typescript
getRecentMessages(count: number): Promise&lt;HistoryMessage[]&gt;;
```

**Parameters:**
- `count`: `number`

**Returns:** `Promise&lt;HistoryMessage[]&gt;`

#### `removeMessage()`

Remove a message by ID

```typescript
removeMessage(id: string): Promise&lt;void&gt;;
```

**Parameters:**
- `id`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `removeOlderThan()`

Remove messages older than timestamp

```typescript
removeOlderThan(timestamp: number): Promise&lt;number&gt;;
```

**Parameters:**
- `timestamp`: `number`

**Returns:** `Promise&lt;number&gt;`

#### `clear()`

Clear all messages

```typescript
clear(): Promise&lt;void&gt;;
```

**Returns:** `Promise&lt;void&gt;`

#### `getCount()`

Get message count

```typescript
getCount(): Promise&lt;number&gt;;
```

**Returns:** `Promise&lt;number&gt;`

#### `getState()`

Get serialized state for session persistence

```typescript
getState(): Promise&lt;SerializedHistoryState&gt;;
```

**Returns:** `Promise&lt;SerializedHistoryState&gt;`

#### `restoreState()`

Restore from serialized state

```typescript
restoreState(state: SerializedHistoryState): Promise&lt;void&gt;;
```

**Parameters:**
- `state`: `SerializedHistoryState`

**Returns:** `Promise&lt;void&gt;`

</details>

---

### IMCPClient `interface`

📍 [`src/domain/interfaces/IMCPClient.ts:34`](src/domain/interfaces/IMCPClient.ts)

MCP Client interface

<details>
<summary><strong>Methods</strong></summary>

#### `connect()`

Connect to the MCP server

```typescript
connect(): Promise&lt;void&gt;;
```

**Returns:** `Promise&lt;void&gt;`

#### `disconnect()`

Disconnect from the MCP server

```typescript
disconnect(): Promise&lt;void&gt;;
```

**Returns:** `Promise&lt;void&gt;`

#### `reconnect()`

Reconnect to the MCP server

```typescript
reconnect(): Promise&lt;void&gt;;
```

**Returns:** `Promise&lt;void&gt;`

#### `isConnected()`

Check if connected

```typescript
isConnected(): boolean;
```

**Returns:** `boolean`

#### `ping()`

Ping the server to check health

```typescript
ping(): Promise&lt;boolean&gt;;
```

**Returns:** `Promise&lt;boolean&gt;`

#### `listTools()`

List available tools from the server

```typescript
listTools(): Promise&lt;MCPTool[]&gt;;
```

**Returns:** `Promise&lt;MCPTool[]&gt;`

#### `callTool()`

Call a tool on the server

```typescript
callTool(name: string, args: Record&lt;string, unknown&gt;): Promise&lt;MCPToolResult&gt;;
```

**Parameters:**
- `name`: `string`
- `args`: `Record&lt;string, unknown&gt;`

**Returns:** `Promise&lt;MCPToolResult&gt;`

#### `registerTools()`

Register all tools with a ToolManager

```typescript
registerTools(toolManager: ToolManager): void;
```

**Parameters:**
- `toolManager`: `ToolManager`

**Returns:** `void`

#### `unregisterTools()`

Unregister all tools from a ToolManager

```typescript
unregisterTools(toolManager: ToolManager): void;
```

**Parameters:**
- `toolManager`: `ToolManager`

**Returns:** `void`

#### `listResources()`

List available resources from the server

```typescript
listResources(): Promise&lt;MCPResource[]&gt;;
```

**Returns:** `Promise&lt;MCPResource[]&gt;`

#### `readResource()`

Read a resource from the server

```typescript
readResource(uri: string): Promise&lt;MCPResourceContent&gt;;
```

**Parameters:**
- `uri`: `string`

**Returns:** `Promise&lt;MCPResourceContent&gt;`

#### `subscribeResource()`

Subscribe to resource updates

```typescript
subscribeResource(uri: string): Promise&lt;void&gt;;
```

**Parameters:**
- `uri`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `unsubscribeResource()`

Unsubscribe from resource updates

```typescript
unsubscribeResource(uri: string): Promise&lt;void&gt;;
```

**Parameters:**
- `uri`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `listPrompts()`

List available prompts from the server

```typescript
listPrompts(): Promise&lt;MCPPrompt[]&gt;;
```

**Returns:** `Promise&lt;MCPPrompt[]&gt;`

#### `getPrompt()`

Get a prompt from the server

```typescript
getPrompt(name: string, args?: Record&lt;string, unknown&gt;): Promise&lt;MCPPromptResult&gt;;
```

**Parameters:**
- `name`: `string`
- `args`: `Record&lt;string, unknown&gt; | undefined` *(optional)*

**Returns:** `Promise&lt;MCPPromptResult&gt;`

#### `getState()`

Get current state for serialization

```typescript
getState(): MCPClientState;
```

**Returns:** `MCPClientState`

#### `loadState()`

Load state from serialization

```typescript
loadState(state: MCPClientState): void;
```

**Parameters:**
- `state`: `MCPClientState`

**Returns:** `void`

#### `destroy()`

Destroy the client and clean up resources

```typescript
destroy(): void;
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `readonly name: string;` | Server name |
| `state` | `readonly state: MCPClientConnectionState;` | Current connection state |
| `capabilities?` | `readonly capabilities?: MCPServerCapabilities;` | Server capabilities (available after connection) |
| `tools` | `readonly tools: MCPTool[];` | Currently available tools |

</details>

---

### IProvider `interface`

📍 [`src/domain/interfaces/IProvider.ts:14`](src/domain/interfaces/IProvider.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `validateConfig()`

Validate that the provider configuration is correct

```typescript
validateConfig(): Promise&lt;boolean&gt;;
```

**Returns:** `Promise&lt;boolean&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `readonly name: string;` | - |
| `vendor?` | `readonly vendor?: string;` | - |
| `capabilities` | `readonly capabilities: ProviderCapabilities;` | - |

</details>

---

### ISpeechToTextProvider `interface`

📍 [`src/domain/interfaces/IAudioProvider.ts:152`](src/domain/interfaces/IAudioProvider.ts)

Speech-to-Text provider interface

<details>
<summary><strong>Methods</strong></summary>

#### `transcribe()`

Transcribe audio to text

```typescript
transcribe(options: STTOptions): Promise&lt;STTResponse&gt;;
```

**Parameters:**
- `options`: `STTOptions`

**Returns:** `Promise&lt;STTResponse&gt;`

#### `translate()?`

Translate audio to English text (optional, Whisper-specific)

```typescript
translate?(options: STTOptions): Promise&lt;STTResponse&gt;;
```

**Parameters:**
- `options`: `STTOptions`

**Returns:** `Promise&lt;STTResponse&gt;`

</details>

---

### ITextProvider `interface`

📍 [`src/domain/interfaces/ITextProvider.ts:40`](src/domain/interfaces/ITextProvider.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `generate()`

Generate text response

```typescript
generate(options: TextGenerateOptions): Promise&lt;LLMResponse&gt;;
```

**Parameters:**
- `options`: `TextGenerateOptions`

**Returns:** `Promise&lt;LLMResponse&gt;`

#### `streamGenerate()`

Stream text response with real-time events
Returns an async iterator of streaming events

```typescript
streamGenerate(options: TextGenerateOptions): AsyncIterableIterator&lt;StreamEvent&gt;;
```

**Parameters:**
- `options`: `TextGenerateOptions`

**Returns:** `AsyncIterableIterator&lt;StreamEvent&gt;`

#### `getModelCapabilities()`

Get model capabilities

```typescript
getModelCapabilities(model: string): ModelCapabilities;
```

**Parameters:**
- `model`: `string`

**Returns:** `ModelCapabilities`

#### `listModels()?`

List available models

```typescript
listModels?(): Promise&lt;string[]&gt;;
```

**Returns:** `Promise&lt;string[]&gt;`

</details>

---

### ITextToSpeechProvider `interface`

📍 [`src/domain/interfaces/IAudioProvider.ts:56`](src/domain/interfaces/IAudioProvider.ts)

Text-to-Speech provider interface

<details>
<summary><strong>Methods</strong></summary>

#### `synthesize()`

Synthesize speech from text

```typescript
synthesize(options: TTSOptions): Promise&lt;TTSResponse&gt;;
```

**Parameters:**
- `options`: `TTSOptions`

**Returns:** `Promise&lt;TTSResponse&gt;`

#### `listVoices()?`

List available voices (optional - some providers return static list)

```typescript
listVoices?(): Promise&lt;IVoiceInfo[]&gt;;
```

**Returns:** `Promise&lt;IVoiceInfo[]&gt;`

</details>

---

### ProviderCapabilities `interface`

📍 [`src/domain/interfaces/IProvider.ts:5`](src/domain/interfaces/IProvider.ts)

Base provider interface

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `text` | `text: boolean;` | - |
| `images` | `images: boolean;` | - |
| `videos` | `videos: boolean;` | - |
| `audio` | `audio: boolean;` | - |
| `features?` | `features?: Record&lt;string, boolean&gt;;` | Optional feature flags for specific capabilities |

</details>

---

### SegmentTimestamp `interface`

📍 [`src/domain/interfaces/IAudioProvider.ts:121`](src/domain/interfaces/IAudioProvider.ts)

Segment-level timestamp

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: number;` | - |
| `text` | `text: string;` | - |
| `start` | `start: number;` | - |
| `end` | `end: number;` | - |
| `tokens?` | `tokens?: number[];` | - |

</details>

---

### SerializedHistoryState `interface`

📍 [`src/domain/interfaces/IHistoryManager.ts:52`](src/domain/interfaces/IHistoryManager.ts)

Serialized history state for persistence

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `version` | `version: number;` | - |
| `messages` | `messages: HistoryMessage[];` | - |
| `summaries?` | `summaries?: Array&lt;{ content: string; coversCount: number; timestamp: number }&gt;;` | - |
| `metadata?` | `metadata?: Record&lt;string, unknown&gt;;` | - |

</details>

---

### StoredConnectorConfig `interface`

📍 [`src/domain/interfaces/IConnectorConfigStorage.ts:13`](src/domain/interfaces/IConnectorConfigStorage.ts)

Wrapper for stored connector configuration with metadata

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `config` | `config: ConnectorConfig;` | The connector configuration (may contain encrypted fields) |
| `createdAt` | `createdAt: number;` | Timestamp when the config was first stored |
| `updatedAt` | `updatedAt: number;` | Timestamp when the config was last updated |
| `version` | `version: number;` | Schema version for future migrations |

</details>

---

### TextGenerateOptions `interface`

📍 [`src/domain/interfaces/ITextProvider.ts:11`](src/domain/interfaces/ITextProvider.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `model` | `model: string;` | - |
| `input` | `input: string | InputItem[];` | - |
| `instructions?` | `instructions?: string;` | - |
| `tools?` | `tools?: Tool[];` | - |
| `tool_choice?` | `tool_choice?: 'auto' | 'required' | { type: 'function'; function: { name: string } };` | - |
| `temperature?` | `temperature?: number;` | - |
| `max_output_tokens?` | `max_output_tokens?: number;` | - |
| `response_format?` | `response_format?: {
    type: 'text' | 'json_object' | 'json_schema';
    json_schema?: any;
  };` | - |
| `parallel_tool_calls?` | `parallel_tool_calls?: boolean;` | - |
| `previous_response_id?` | `previous_response_id?: string;` | - |
| `metadata?` | `metadata?: Record&lt;string, string&gt;;` | - |
| `vendorOptions?` | `vendorOptions?: Record&lt;string, any&gt;;` | Vendor-specific options (e.g., Google's thinkingLevel, OpenAI's reasoning_effort) |

</details>

---

### WordTimestamp `interface`

📍 [`src/domain/interfaces/IAudioProvider.ts:112`](src/domain/interfaces/IAudioProvider.ts)

Word-level timestamp

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `word` | `word: string;` | - |
| `start` | `start: number;` | - |
| `end` | `end: number;` | - |

</details>

---

### MCPClientConnectionState `type`

📍 [`src/domain/interfaces/IMCPClient.ts:24`](src/domain/interfaces/IMCPClient.ts)

MCP Client connection states

```typescript
type MCPClientConnectionState = | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
```

---

### assertNotDestroyed `function`

📍 [`src/domain/interfaces/IDisposable.ts:50`](src/domain/interfaces/IDisposable.ts)

Helper to check if an object is destroyed and throw if so.

```typescript
export function assertNotDestroyed(obj: IDisposable | IAsyncDisposable, operation: string): void
```

---

### DEFAULT_HISTORY_MANAGER_CONFIG `const`

📍 [`src/domain/interfaces/IHistoryManager.ts:169`](src/domain/interfaces/IHistoryManager.ts)

Default configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxMessages` | `50` | - |
| `maxTokens` | `32000` | - |
| `compactionStrategy` | `'sliding-window'` | - |
| `preserveRecentCount` | `10` | - |

</details>

---

## Base Classes

Base classes for custom provider implementations

### BaseMediaProvider `class`

📍 [`src/infrastructure/providers/base/BaseMediaProvider.ts:16`](src/infrastructure/providers/base/BaseMediaProvider.ts)

Base class for all media providers (Image, Audio, Video)
Follows the same patterns as BaseTextProvider for consistency

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: any)
```

**Parameters:**
- `config`: `any`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `executeWithCircuitBreaker()`

Execute operation with circuit breaker protection
Automatically records metrics and handles errors

```typescript
protected async executeWithCircuitBreaker&lt;TResult&gt;(
    operation: () =&gt; Promise&lt;TResult&gt;,
    operationName: string,
    metadata?: Record&lt;string, unknown&gt;
  ): Promise&lt;TResult&gt;
```

**Parameters:**
- `operation`: `() =&gt; Promise&lt;TResult&gt;`
- `operationName`: `string`
- `metadata`: `Record&lt;string, unknown&gt; | undefined` *(optional)*

**Returns:** `Promise&lt;TResult&gt;`

#### `logOperationStart()`

Log operation start with context
Useful for logging before async operations

```typescript
protected logOperationStart(operation: string, context: Record&lt;string, unknown&gt;): void
```

**Parameters:**
- `operation`: `string`
- `context`: `Record&lt;string, unknown&gt;`

**Returns:** `void`

#### `logOperationComplete()`

Log operation completion with context

```typescript
protected logOperationComplete(operation: string, context: Record&lt;string, unknown&gt;): void
```

**Parameters:**
- `operation`: `string`
- `context`: `Record&lt;string, unknown&gt;`

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `circuitBreaker?` | `circuitBreaker: CircuitBreaker&lt;any&gt; | undefined` | - |
| `logger` | `logger: FrameworkLogger` | - |

</details>

---

### BaseProvider `class`

📍 [`src/infrastructure/providers/base/BaseProvider.ts:9`](src/infrastructure/providers/base/BaseProvider.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(protected config: ProviderConfig)
```

**Parameters:**
- `config`: `ProviderConfig`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `validateConfig()`

Validate provider configuration
Returns validation result with details

```typescript
async validateConfig(): Promise&lt;boolean&gt;
```

**Returns:** `Promise&lt;boolean&gt;`

#### `validateApiKey()`

Validate API key format and presence
Can be overridden by providers with specific key formats

```typescript
protected validateApiKey():
```

**Returns:** `{ isValid: boolean; warning?: string | undefined; }`

#### `validateProviderSpecificKeyFormat()`

Override this method in provider implementations for specific key format validation

```typescript
protected validateProviderSpecificKeyFormat(_apiKey: string):
```

**Parameters:**
- `_apiKey`: `string`

**Returns:** `{ isValid: boolean; warning?: string | undefined; }`

#### `assertValidConfig()`

Validate config and throw if invalid

```typescript
protected assertValidConfig(): void
```

**Returns:** `void`

#### `getApiKey()`

Get API key from config

```typescript
protected getApiKey(): string
```

**Returns:** `string`

#### `getBaseURL()`

Get base URL if configured

```typescript
protected getBaseURL(): string | undefined
```

**Returns:** `string | undefined`

#### `getTimeout()`

Get timeout configuration

```typescript
protected getTimeout(): number
```

**Returns:** `number`

#### `getMaxRetries()`

Get max retries configuration

```typescript
protected getMaxRetries(): number
```

**Returns:** `number`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string` | - |
| `capabilities` | `capabilities: ProviderCapabilities` | - |

</details>

---

### BaseTextProvider `class`

📍 [`src/infrastructure/providers/base/BaseTextProvider.ts:13`](src/infrastructure/providers/base/BaseTextProvider.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: any)
```

**Parameters:**
- `config`: `any`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `initializeObservability()`

DEPRECATED: No longer needed, kept for backward compatibility
Observability is now auto-initialized on first use

```typescript
protected initializeObservability(_providerName: string): void
```

**Parameters:**
- `_providerName`: `string`

**Returns:** `void`

#### `generate()`

```typescript
abstract generate(options: TextGenerateOptions): Promise&lt;LLMResponse&gt;;
```

**Parameters:**
- `options`: `TextGenerateOptions`

**Returns:** `Promise&lt;LLMResponse&gt;`

#### `streamGenerate()`

```typescript
abstract streamGenerate(options: TextGenerateOptions): AsyncIterableIterator&lt;StreamEvent&gt;;
```

**Parameters:**
- `options`: `TextGenerateOptions`

**Returns:** `AsyncIterableIterator&lt;StreamEvent&gt;`

#### `getModelCapabilities()`

```typescript
abstract getModelCapabilities(model: string): ModelCapabilities;
```

**Parameters:**
- `model`: `string`

**Returns:** `ModelCapabilities`

#### `executeWithCircuitBreaker()`

Execute with circuit breaker protection (helper for subclasses)

```typescript
protected async executeWithCircuitBreaker&lt;TResult&gt;(
    operation: () =&gt; Promise&lt;TResult&gt;,
    model?: string
  ): Promise&lt;TResult&gt;
```

**Parameters:**
- `operation`: `() =&gt; Promise&lt;TResult&gt;`
- `model`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;TResult&gt;`

#### `getCircuitBreakerMetrics()`

Get circuit breaker metrics

```typescript
getCircuitBreakerMetrics()
```

**Returns:** `CircuitBreakerMetrics | null`

#### `normalizeInputToString()`

Normalize input to string (helper for providers that don't support complex input)

```typescript
protected normalizeInputToString(input: string | any[]): string
```

**Parameters:**
- `input`: `string | any[]`

**Returns:** `string`

#### `destroy()`

Clean up provider resources (circuit breaker listeners, etc.)
Should be called when the provider is no longer needed.

```typescript
destroy(): void
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `circuitBreaker?` | `circuitBreaker: CircuitBreaker&lt;any&gt; | undefined` | - |
| `logger` | `logger: FrameworkLogger` | - |

</details>

---

## Other

### BraveProvider `class`

📍 [`src/capabilities/search/providers/BraveProvider.ts:15`](src/capabilities/search/providers/BraveProvider.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(readonly connector: Connector)
```

**Parameters:**
- `connector`: `Connector`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `search()`

```typescript
async search(query: string, options: SearchOptions =
```

**Parameters:**
- `query`: `string`
- `options`: `SearchOptions` *(optional)* (default: `{}`)

**Returns:** `Promise&lt;SearchResponse&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "brave"` | - |

</details>

---

### ConversationHistoryManager `class`

📍 [`src/core/history/ConversationHistoryManager.ts:35`](src/core/history/ConversationHistoryManager.ts)

Default conversation history manager implementation

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: ConversationHistoryManagerConfig =
```

**Parameters:**
- `config`: `ConversationHistoryManagerConfig` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `addMessage()`

Add a message to history

```typescript
async addMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record&lt;string, unknown&gt;
  ): Promise&lt;HistoryMessage&gt;
```

**Parameters:**
- `role`: `"user" | "assistant" | "system"`
- `content`: `string`
- `metadata`: `Record&lt;string, unknown&gt; | undefined` *(optional)*

**Returns:** `Promise&lt;HistoryMessage&gt;`

#### `getMessages()`

Get all messages

```typescript
async getMessages(): Promise&lt;HistoryMessage[]&gt;
```

**Returns:** `Promise&lt;HistoryMessage[]&gt;`

#### `getRecentMessages()`

Get recent messages

```typescript
async getRecentMessages(count?: number): Promise&lt;HistoryMessage[]&gt;
```

**Parameters:**
- `count`: `number | undefined` *(optional)*

**Returns:** `Promise&lt;HistoryMessage[]&gt;`

#### `formatForContext()`

Format history for LLM context

```typescript
async formatForContext(options?:
```

**Parameters:**
- `options`: `{ maxTokens?: number | undefined; includeMetadata?: boolean | undefined; } | undefined` *(optional)*

**Returns:** `Promise&lt;string&gt;`

#### `compact()`

Compact history based on strategy

```typescript
async compact(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `clear()`

Clear all history

```typescript
async clear(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `getMessageCount()`

Get message count

```typescript
async getMessageCount(): Promise&lt;number&gt;
```

**Returns:** `Promise&lt;number&gt;`

#### `getState()`

Get state for persistence

```typescript
async getState(): Promise&lt;SerializedHistoryState&gt;
```

**Returns:** `Promise&lt;SerializedHistoryState&gt;`

#### `restoreState()`

Restore from saved state

```typescript
async restoreState(state: SerializedHistoryState): Promise&lt;void&gt;
```

**Parameters:**
- `state`: `SerializedHistoryState`

**Returns:** `Promise&lt;void&gt;`

#### `getConfig()`

Get configuration

```typescript
getConfig(): IHistoryManagerConfig
```

**Returns:** `IHistoryManagerConfig`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `storage` | `storage: IHistoryStorage` | - |
| `config` | `config: Required&lt;IHistoryManagerConfig&gt;` | - |

</details>

---

### ExecutionContext `class`

📍 [`src/capabilities/agents/ExecutionContext.ts:76`](src/capabilities/agents/ExecutionContext.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    executionId: string,
    config: ExecutionContextConfig =
```

**Parameters:**
- `executionId`: `string`
- `config`: `ExecutionContextConfig` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `addIteration()`

Add iteration to history (memory-safe)

```typescript
addIteration(record: IterationRecord): void
```

**Parameters:**
- `record`: `IterationRecord`

**Returns:** `void`

#### `getHistory()`

Get iteration history

```typescript
getHistory(): IterationRecord[] | IterationSummary[]
```

**Returns:** `IterationRecord[] | IterationSummary[]`

#### `audit()`

Add audit entry

```typescript
audit(type: AuditEntry['type'], details: any, hookName?: string, toolName?: string): void
```

**Parameters:**
- `type`: `"hook_executed" | "tool_modified" | "tool_skipped" | "execution_paused" | "execution_resumed" | "tool_approved" | "tool_rejected" | "tool_blocked" | "tool_permission_approved"`
- `details`: `any`
- `hookName`: `string | undefined` *(optional)*
- `toolName`: `string | undefined` *(optional)*

**Returns:** `void`

#### `getAuditTrail()`

Get audit trail

```typescript
getAuditTrail(): readonly AuditEntry[]
```

**Returns:** `readonly AuditEntry[]`

#### `updateMetrics()`

Update metrics

```typescript
updateMetrics(update: Partial&lt;ExecutionMetrics&gt;): void
```

**Parameters:**
- `update`: `Partial&lt;ExecutionMetrics&gt;`

**Returns:** `void`

#### `addToolCall()`

Add tool call to tracking

```typescript
addToolCall(toolCall: ToolCall): void
```

**Parameters:**
- `toolCall`: `ToolCall`

**Returns:** `void`

#### `addToolResult()`

Add tool result to tracking

```typescript
addToolResult(result: ToolResult): void
```

**Parameters:**
- `result`: `ToolResult`

**Returns:** `void`

#### `checkLimits()`

Check resource limits

```typescript
checkLimits(limits?:
```

**Parameters:**
- `limits`: `{ maxExecutionTime?: number | undefined; maxToolCalls?: number | undefined; maxContextSize?: number | undefined; } | undefined` *(optional)*

**Returns:** `void`

#### `cleanup()`

Cleanup resources and release memory
Clears all internal arrays and maps to allow garbage collection

```typescript
cleanup(): void
```

**Returns:** `void`

#### `getSummary()`

Get execution summary

```typescript
getSummary()
```

**Returns:** `{ executionId: string; startTime: Date; currentIteration: number; paused: boolean; cancelled: boolean; metrics: { totalDuration: number; llmDuration: number; toolDuration: number; hookDuration: number; iterationCount: number; toolCallCount: number; toolSuccessCount: number; toolFailureCount: number; toolTimeoutCount: number; inputTokens: number; outputTokens: number; totalTokens: number; errors: { type: string; message: string; timestamp: Date; }[]; }; totalDuration: number; }`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `executionId` | `executionId: string` | - |
| `startTime` | `startTime: Date` | - |
| `iteration` | `iteration: number` | - |
| `toolCalls` | `toolCalls: Map&lt;string, ToolCall&gt;` | - |
| `toolResults` | `toolResults: Map&lt;string, ToolResult&gt;` | - |
| `paused` | `paused: boolean` | - |
| `pauseReason?` | `pauseReason: string | undefined` | - |
| `cancelled` | `cancelled: boolean` | - |
| `cancelReason?` | `cancelReason: string | undefined` | - |
| `metadata` | `metadata: Map&lt;string, any&gt;` | - |
| `config` | `config: ExecutionContextConfig` | - |
| `iterations` | `iterations: IterationRecord[]` | - |
| `iterationSummaries` | `iterationSummaries: IterationSummary[]` | - |
| `metrics` | `metrics: ExecutionMetrics` | - |
| `auditTrail` | `auditTrail: AuditEntry[]` | - |

</details>

---

### FileSearchSource `class`

📍 [`src/capabilities/researchAgent/sources/FileSearchSource.ts:44`](src/capabilities/researchAgent/sources/FileSearchSource.ts)

FileSearchSource - Search and read files

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: FileSearchSourceConfig)
```

**Parameters:**
- `config`: `FileSearchSourceConfig`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `search()`

```typescript
async search(query: string, options?: SearchOptions): Promise&lt;SearchResponse&gt;
```

**Parameters:**
- `query`: `string`
- `options`: `SearchOptions | undefined` *(optional)*

**Returns:** `Promise&lt;SearchResponse&gt;`

#### `fetch()`

```typescript
async fetch(reference: string, options?: FetchOptions): Promise&lt;FetchedContent&gt;
```

**Parameters:**
- `reference`: `string`
- `options`: `FetchOptions | undefined` *(optional)*

**Returns:** `Promise&lt;FetchedContent&gt;`

#### `isAvailable()`

```typescript
async isAvailable(): Promise&lt;boolean&gt;
```

**Returns:** `Promise&lt;boolean&gt;`

#### `getCapabilities()`

```typescript
getCapabilities(): SourceCapabilities
```

**Returns:** `SourceCapabilities`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string` | - |
| `description` | `description: string` | - |
| `type` | `type: "file"` | - |
| `basePath` | `basePath: string` | - |
| `includePatterns` | `includePatterns: string[]` | - |
| `excludePatterns` | `excludePatterns: string[]` | - |
| `maxFileSize` | `maxFileSize: number` | - |
| `searchMode` | `searchMode: "filename" | "content" | "both"` | - |

</details>

---

### HookManager `class`

📍 [`src/capabilities/agents/HookManager.ts:14`](src/capabilities/agents/HookManager.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    config: HookConfig =
```

**Parameters:**
- `config`: `HookConfig` *(optional)* (default: `{}`)
- `emitter`: `EventEmitter&lt;string | symbol, any&gt;`
- `errorHandling`: `{ maxConsecutiveErrors?: number | undefined; } | undefined` *(optional)*

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `register()`

Register a hook

```typescript
register(name: HookName, hook: Hook&lt;any, any&gt;): void
```

**Parameters:**
- `name`: `"before:execution" | "after:execution" | "before:llm" | "after:llm" | "before:tool" | "after:tool" | "approve:tool" | "pause:check"`
- `hook`: `Hook&lt;any, any&gt;`

**Returns:** `void`

#### `executeHooks()`

Execute hooks for a given name

```typescript
async executeHooks&lt;K extends HookName&gt;(
    name: K,
    context: HookSignatures[K]['context'],
    defaultResult: HookSignatures[K]['result']
  ): Promise&lt;HookSignatures[K]['result']&gt;
```

**Parameters:**
- `name`: `K`
- `context`: `HookSignatures[K]["context"]`
- `defaultResult`: `HookSignatures[K]["result"]`

**Returns:** `Promise&lt;HookSignatures[K]["result"]&gt;`

#### `hasHooks()`

Check if there are any hooks registered

```typescript
hasHooks(name: HookName): boolean
```

**Parameters:**
- `name`: `"before:execution" | "after:execution" | "before:llm" | "after:llm" | "before:tool" | "after:tool" | "approve:tool" | "pause:check"`

**Returns:** `boolean`

#### `getHookCount()`

Get hook count

```typescript
getHookCount(name?: HookName): number
```

**Parameters:**
- `name`: `"before:execution" | "after:execution" | "before:llm" | "after:llm" | "before:tool" | "after:tool" | "approve:tool" | "pause:check" | undefined` *(optional)*

**Returns:** `number`

#### `clear()`

Clear all hooks and reset error tracking

```typescript
clear(): void
```

**Returns:** `void`

#### `enableHook()`

Re-enable a disabled hook

```typescript
enableHook(hookKey: string): void
```

**Parameters:**
- `hookKey`: `string`

**Returns:** `void`

#### `getDisabledHooks()`

Get list of disabled hooks

```typescript
getDisabledHooks(): string[]
```

**Returns:** `string[]`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `hooks` | `hooks: Map&lt;"before:execution" | "after:execution" | "before:llm" | "after:llm" | "before:tool" | "after:tool" | "approve:tool" | "pause:check", Hook&lt;any, any&gt;[]&gt;` | - |
| `timeout` | `timeout: number` | - |
| `parallel` | `parallel: boolean` | - |
| `hookErrorCounts` | `hookErrorCounts: Map&lt;string, number&gt;` | - |
| `disabledHooks` | `disabledHooks: Set&lt;string&gt;` | - |
| `maxConsecutiveErrors` | `maxConsecutiveErrors: number` | - |
| `emitter` | `emitter: EventEmitter&lt;string | symbol, any&gt;` | - |

</details>

---

### IdempotencyCache `class`

📍 [`src/core/IdempotencyCache.ts:60`](src/core/IdempotencyCache.ts)

IdempotencyCache handles tool call result caching.

Features:
- Cache based on tool name + args
- Custom key generation per tool
- TTL-based expiration
- Max entries eviction

Implements IDisposable for proper resource cleanup.
Call destroy() when done to clear the background cleanup interval.

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: IdempotencyCacheConfig = DEFAULT_IDEMPOTENCY_CONFIG)
```

**Parameters:**
- `config`: `IdempotencyCacheConfig` *(optional)* (default: `DEFAULT_IDEMPOTENCY_CONFIG`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `destroy()`

Releases all resources held by this cache.
Clears the background cleanup interval and all cached entries.
Safe to call multiple times (idempotent).

```typescript
destroy(): void
```

**Returns:** `void`

#### `get()`

Get cached result for tool call

```typescript
async get(tool: ToolFunction, args: Record&lt;string, unknown&gt;): Promise&lt;unknown&gt;
```

**Parameters:**
- `tool`: `ToolFunction&lt;any, any&gt;`
- `args`: `Record&lt;string, unknown&gt;`

**Returns:** `Promise&lt;unknown&gt;`

#### `set()`

Cache result for tool call

```typescript
async set(tool: ToolFunction, args: Record&lt;string, unknown&gt;, result: unknown): Promise&lt;void&gt;
```

**Parameters:**
- `tool`: `ToolFunction&lt;any, any&gt;`
- `args`: `Record&lt;string, unknown&gt;`
- `result`: `unknown`

**Returns:** `Promise&lt;void&gt;`

#### `has()`

Check if tool call is cached

```typescript
async has(tool: ToolFunction, args: Record&lt;string, unknown&gt;): Promise&lt;boolean&gt;
```

**Parameters:**
- `tool`: `ToolFunction&lt;any, any&gt;`
- `args`: `Record&lt;string, unknown&gt;`

**Returns:** `Promise&lt;boolean&gt;`

#### `invalidate()`

Invalidate cached result

```typescript
async invalidate(tool: ToolFunction, args: Record&lt;string, unknown&gt;): Promise&lt;void&gt;
```

**Parameters:**
- `tool`: `ToolFunction&lt;any, any&gt;`
- `args`: `Record&lt;string, unknown&gt;`

**Returns:** `Promise&lt;void&gt;`

#### `invalidateTool()`

Invalidate all cached results for a tool

```typescript
async invalidateTool(tool: ToolFunction): Promise&lt;void&gt;
```

**Parameters:**
- `tool`: `ToolFunction&lt;any, any&gt;`

**Returns:** `Promise&lt;void&gt;`

#### `pruneExpired()`

Prune expired entries from cache

```typescript
pruneExpired(): number
```

**Returns:** `number`

#### `clear()`

Clear all cached results and stop background cleanup.

```typescript
async clear(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `getStats()`

Get cache statistics

```typescript
getStats(): CacheStats
```

**Returns:** `CacheStats`

#### `generateKey()`

Generate cache key for tool + args

```typescript
generateKey(tool: ToolFunction, args: Record&lt;string, unknown&gt;): string
```

**Parameters:**
- `tool`: `ToolFunction&lt;any, any&gt;`
- `args`: `Record&lt;string, unknown&gt;`

**Returns:** `string`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `config` | `config: IdempotencyCacheConfig` | - |
| `cache` | `cache: Map&lt;string, { value: unknown; expiresAt: number; }&gt;` | - |
| `hits` | `hits: number` | - |
| `misses` | `misses: number` | - |
| `cleanupInterval?` | `cleanupInterval: NodeJS.Timeout | undefined` | - |

</details>

---

### MCPClient `class`

📍 [`src/core/mcp/MCPClient.ts:51`](src/core/mcp/MCPClient.ts)

MCP Client class

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: MCPServerConfig, defaults?: MCPConfiguration['defaults'])
```

**Parameters:**
- `config`: `MCPServerConfig`
- `defaults`: `{ autoConnect?: boolean | undefined; autoReconnect?: boolean | undefined; reconnectIntervalMs?: number | undefined; maxReconnectAttempts?: number | undefined; requestTimeoutMs?: number | undefined; healthCheckIntervalMs?: number | undefined; } | undefined` *(optional)*

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `connect()`

```typescript
async connect(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `disconnect()`

```typescript
async disconnect(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `reconnect()`

```typescript
async reconnect(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `isConnected()`

```typescript
isConnected(): boolean
```

**Returns:** `boolean`

#### `ping()`

```typescript
async ping(): Promise&lt;boolean&gt;
```

**Returns:** `Promise&lt;boolean&gt;`

#### `listTools()`

```typescript
async listTools(): Promise&lt;MCPTool[]&gt;
```

**Returns:** `Promise&lt;MCPTool[]&gt;`

#### `callTool()`

```typescript
async callTool(name: string, args: Record&lt;string, unknown&gt;): Promise&lt;MCPToolResult&gt;
```

**Parameters:**
- `name`: `string`
- `args`: `Record&lt;string, unknown&gt;`

**Returns:** `Promise&lt;MCPToolResult&gt;`

#### `registerTools()`

```typescript
registerTools(toolManager: ToolManager): void
```

**Parameters:**
- `toolManager`: `ToolManager`

**Returns:** `void`

#### `unregisterTools()`

```typescript
unregisterTools(toolManager: ToolManager): void
```

**Parameters:**
- `toolManager`: `ToolManager`

**Returns:** `void`

#### `listResources()`

```typescript
async listResources(): Promise&lt;MCPResource[]&gt;
```

**Returns:** `Promise&lt;MCPResource[]&gt;`

#### `readResource()`

```typescript
async readResource(uri: string): Promise&lt;MCPResourceContent&gt;
```

**Parameters:**
- `uri`: `string`

**Returns:** `Promise&lt;MCPResourceContent&gt;`

#### `subscribeResource()`

```typescript
async subscribeResource(uri: string): Promise&lt;void&gt;
```

**Parameters:**
- `uri`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `unsubscribeResource()`

```typescript
async unsubscribeResource(uri: string): Promise&lt;void&gt;
```

**Parameters:**
- `uri`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `listPrompts()`

```typescript
async listPrompts(): Promise&lt;MCPPrompt[]&gt;
```

**Returns:** `Promise&lt;MCPPrompt[]&gt;`

#### `getPrompt()`

```typescript
async getPrompt(name: string, args?: Record&lt;string, unknown&gt;): Promise&lt;MCPPromptResult&gt;
```

**Parameters:**
- `name`: `string`
- `args`: `Record&lt;string, unknown&gt; | undefined` *(optional)*

**Returns:** `Promise&lt;MCPPromptResult&gt;`

#### `getState()`

```typescript
getState(): MCPClientState
```

**Returns:** `MCPClientState`

#### `loadState()`

```typescript
loadState(state: MCPClientState): void
```

**Parameters:**
- `state`: `MCPClientState`

**Returns:** `void`

#### `destroy()`

```typescript
destroy(): void
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string` | - |
| `config` | `config: Required&lt;Omit&lt;MCPServerConfig, "permissions" | "displayName" | "description" | "toolNamespace"&gt;&gt; & { displayName?: string | undefined; description?: string | undefined; permissions?: { defaultScope?: "session" | "once" | "always" | "never" | undefined; defaultRiskLevel?: "critical" | "high" | "low" | "medium" | undefined; } | undefined; toolNamespace: string; }` | - |
| `client` | `client: Client&lt;{ method: string; params?: { [x: string]: unknown; _meta?: { [x: string]: unknown; progressToken?: string | number | undefined; "io.modelcontextprotocol/related-task"?: { taskId: string; } | undefined; } | undefined; } | undefined; }, { method: string; params?: { [x: string]: unknown; _meta?: { [x: string]: unknown; progressToken?: string | number | undefined; "io.modelcontextprotocol/related-task"?: { taskId: string; } | undefined; } | undefined; } | undefined; }, { [x: string]: unknown; _meta?: { [x: string]: unknown; progressToken?: string | number | undefined; "io.modelcontextprotocol/related-task"?: { taskId: string; } | undefined; } | undefined; }&gt; | null` | - |
| `transport` | `transport: Transport | null` | - |
| `reconnectAttempts` | `reconnectAttempts: number` | - |
| `reconnectTimer?` | `reconnectTimer: NodeJS.Timeout | undefined` | - |
| `healthCheckTimer?` | `healthCheckTimer: NodeJS.Timeout | undefined` | - |
| `subscribedResources` | `subscribedResources: Set&lt;string&gt;` | - |
| `registeredToolNames` | `registeredToolNames: Set&lt;string&gt;` | - |

</details>

---

### MCPRegistry `class`

📍 [`src/core/mcp/MCPRegistry.ts:18`](src/core/mcp/MCPRegistry.ts)

MCP Registry - static registry for MCP clients

<details>
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Create and register an MCP client

```typescript
static create(config: MCPServerConfig, defaults?: MCPConfiguration['defaults']): IMCPClient
```

**Parameters:**
- `config`: `MCPServerConfig`
- `defaults`: `{ autoConnect?: boolean | undefined; autoReconnect?: boolean | undefined; reconnectIntervalMs?: number | undefined; maxReconnectAttempts?: number | undefined; requestTimeoutMs?: number | undefined; healthCheckIntervalMs?: number | undefined; } | undefined` *(optional)*

**Returns:** `IMCPClient`

#### `static get()`

Get a registered MCP client

```typescript
static get(name: string): IMCPClient
```

**Parameters:**
- `name`: `string`

**Returns:** `IMCPClient`

#### `static has()`

Check if an MCP client is registered

```typescript
static has(name: string): boolean
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

#### `static list()`

List all registered MCP client names

```typescript
static list(): string[]
```

**Returns:** `string[]`

#### `static getInfo()`

Get info about a registered MCP client

```typescript
static getInfo(name: string):
```

**Parameters:**
- `name`: `string`

**Returns:** `{ name: string; state: string; connected: boolean; toolCount: number; }`

#### `static getAllInfo()`

Get info about all registered MCP clients

```typescript
static getAllInfo(): Array&lt;
```

**Returns:** `{ name: string; state: string; connected: boolean; toolCount: number; }[]`

#### `static createFromConfig()`

Create multiple clients from MCP configuration

```typescript
static createFromConfig(config: MCPConfiguration): IMCPClient[]
```

**Parameters:**
- `config`: `MCPConfiguration`

**Returns:** `IMCPClient[]`

#### `static loadFromConfigFile()`

Load MCP configuration from file and create clients

```typescript
static async loadFromConfigFile(path: string): Promise&lt;IMCPClient[]&gt;
```

**Parameters:**
- `path`: `string`

**Returns:** `Promise&lt;IMCPClient[]&gt;`

#### `static connectAll()`

Connect all servers with autoConnect enabled

```typescript
static async connectAll(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `static disconnectAll()`

Disconnect all servers

```typescript
static async disconnectAll(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `static destroyAll()`

Destroy all clients and clear registry

```typescript
static destroyAll(): void
```

**Returns:** `void`

#### `static clear()`

Clear the registry (for testing)

```typescript
static clear(): void
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `clients` | `clients: Map&lt;string, IMCPClient&gt;` | - |

</details>

---

### ProviderConfigAgent `class`

📍 [`src/agents/ProviderConfigAgent.ts:16`](src/agents/ProviderConfigAgent.ts)

Built-in agent for generating OAuth provider configurations

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

Create a provider config agent

```typescript
constructor(connectorName: string = 'openai')
```

**Parameters:**
- `connectorName`: `string` *(optional)* (default: `'openai'`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `run()`

Start interactive configuration session
AI will ask questions and generate the connector config

```typescript
async run(initialInput?: string): Promise&lt;string | ConnectorConfigResult&gt;
```

**Parameters:**
- `initialInput`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;string | ConnectorConfigResult&gt;`

#### `continue()`

Continue conversation (for multi-turn interaction)

```typescript
async continue(userMessage: string): Promise&lt;string | ConnectorConfigResult&gt;
```

**Parameters:**
- `userMessage`: `string`

**Returns:** `Promise&lt;string | ConnectorConfigResult&gt;`

#### `reset()`

Reset conversation

```typescript
reset(): void
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agent` | `agent: Agent | null` | - |
| `conversationHistory` | `conversationHistory: InputItem[]` | - |
| `connectorName` | `connectorName: string` | - |

</details>

---

### RapidAPIProvider `class`

📍 [`src/capabilities/search/providers/RapidAPIProvider.ts:18`](src/capabilities/search/providers/RapidAPIProvider.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(readonly connector: Connector)
```

**Parameters:**
- `connector`: `Connector`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `search()`

```typescript
async search(query: string, options: SearchOptions =
```

**Parameters:**
- `query`: `string`
- `options`: `SearchOptions` *(optional)* (default: `{}`)

**Returns:** `Promise&lt;SearchResponse&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "rapidapi"` | - |

</details>

---

### ResearchAgent `class`

📍 [`src/capabilities/researchAgent/ResearchAgent.ts:78`](src/capabilities/researchAgent/ResearchAgent.ts)

ResearchAgent - extends TaskAgent with research capabilities

<details>
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Create a new ResearchAgent

```typescript
static override create(config: ResearchAgentConfig): ResearchAgent
```

**Parameters:**
- `config`: `ResearchAgentConfig`

**Returns:** `ResearchAgent`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `getSources()`

Get all registered sources

```typescript
getSources(): IResearchSource[]
```

**Returns:** `IResearchSource[]`

#### `getSource()`

Get a specific source by name

```typescript
getSource(name: string): IResearchSource | undefined
```

**Parameters:**
- `name`: `string`

**Returns:** `IResearchSource | undefined`

#### `addSource()`

Add a source at runtime

```typescript
addSource(source: IResearchSource): void
```

**Parameters:**
- `source`: `IResearchSource`

**Returns:** `void`

#### `removeSource()`

Remove a source

```typescript
removeSource(name: string): boolean
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

#### `searchSources()`

Search across all sources (or specified sources)

```typescript
async searchSources(
    query: string,
    options?: SearchOptions &
```

**Parameters:**
- `query`: `string`
- `options`: `(SearchOptions & { sources?: string[] | undefined; }) | undefined` *(optional)*

**Returns:** `Promise&lt;Map&lt;string, SearchResponse&gt;&gt;`

#### `fetchFromSource()`

Fetch content from a specific source

```typescript
async fetchFromSource(
    sourceName: string,
    reference: string,
    options?: FetchOptions
  ): Promise&lt;ReturnType&lt;IResearchSource['fetch']&gt;&gt;
```

**Parameters:**
- `sourceName`: `string`
- `reference`: `string`
- `options`: `FetchOptions | undefined` *(optional)*

**Returns:** `Promise&lt;Promise&lt;FetchedContent&gt;&gt;`

#### `storeFinding()`

Store a research finding in memory
Requires memory feature to be enabled

```typescript
async storeFinding(
    key: string,
    finding: ResearchFinding
  ): Promise&lt;void&gt;
```

**Parameters:**
- `key`: `string`
- `finding`: `ResearchFinding`

**Returns:** `Promise&lt;void&gt;`

#### `getFindings()`

Get all stored findings
Returns empty object if memory feature is disabled

```typescript
async getFindings(): Promise&lt;Record&lt;string, ResearchFinding&gt;&gt;
```

**Returns:** `Promise&lt;Record&lt;string, ResearchFinding&gt;&gt;`

#### `cleanupProcessedRaw()`

Cleanup raw data that has been processed
Call this after creating summaries/findings from raw content

```typescript
async cleanupProcessedRaw(rawKeys: string[]): Promise&lt;number&gt;
```

**Parameters:**
- `rawKeys`: `string[]`

**Returns:** `Promise&lt;number&gt;`

#### `executeResearchPlan()`

Execute a research plan
This is a high-level orchestration method that can be used
for structured research, or the LLM can drive research via tools

```typescript
async executeResearchPlan(plan: ResearchPlan): Promise&lt;ResearchResult&gt;
```

**Parameters:**
- `plan`: `ResearchPlan`

**Returns:** `Promise&lt;ResearchResult&gt;`

#### `getAutoSpillStats()`

Get auto-spill statistics

```typescript
getAutoSpillStats():
```

**Returns:** `{ totalSpilled: number; consumed: number; unconsumed: number; totalSizeBytes: number; }`

#### `destroy()`

```typescript
override async destroy(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `sources` | `sources: Map&lt;string, IResearchSource&gt;` | - |
| `autoSpillPlugin?` | `autoSpillPlugin: AutoSpillPlugin | undefined` | - |
| `researchHooks?` | `researchHooks: ResearchAgentHooks | undefined` | - |
| `defaultSearchOptions` | `defaultSearchOptions: SearchOptions` | - |
| `defaultFetchOptions` | `defaultFetchOptions: FetchOptions` | - |

</details>

---

### ScrapeProvider `class`

📍 [`src/capabilities/scrape/ScrapeProvider.ts:205`](src/capabilities/scrape/ScrapeProvider.ts)

ScrapeProvider factory

Creates the appropriate provider based on Connector's serviceType.
Use createWithFallback() for automatic fallback on failure.

<details>
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Create a scrape provider from a connector

```typescript
static create(config: ScrapeProviderConfig): IScrapeProvider
```

**Parameters:**
- `config`: `ScrapeProviderConfig`

**Returns:** `IScrapeProvider`

#### `static hasProvider()`

Check if a service type has a registered provider

```typescript
static hasProvider(serviceType: string): boolean
```

**Parameters:**
- `serviceType`: `string`

**Returns:** `boolean`

#### `static listProviders()`

List all registered provider service types

```typescript
static listProviders(): string[]
```

**Returns:** `string[]`

#### `static createWithFallback()`

Create a scrape provider with fallback chain

Returns a provider that will try each connector in order until one succeeds.

```typescript
static createWithFallback(config: ScrapeProviderFallbackConfig): IScrapeProvider
```

**Parameters:**
- `config`: `ScrapeProviderFallbackConfig`

**Returns:** `IScrapeProvider`

</details>

---

### SearchProvider `class`

📍 [`src/capabilities/search/SearchProvider.ts:91`](src/capabilities/search/SearchProvider.ts)

SearchProvider factory

<details>
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Create a search provider from a connector

```typescript
static create(config: SearchProviderConfig): ISearchProvider
```

**Parameters:**
- `config`: `SearchProviderConfig`

**Returns:** `ISearchProvider`

</details>

---

### SerperProvider `class`

📍 [`src/capabilities/search/providers/SerperProvider.ts:15`](src/capabilities/search/providers/SerperProvider.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(readonly connector: Connector)
```

**Parameters:**
- `connector`: `Connector`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `search()`

```typescript
async search(query: string, options: SearchOptions =
```

**Parameters:**
- `query`: `string`
- `options`: `SearchOptions` *(optional)* (default: `{}`)

**Returns:** `Promise&lt;SearchResponse&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "serper"` | - |

</details>

---

### TavilyProvider `class`

📍 [`src/capabilities/search/providers/TavilyProvider.ts:15`](src/capabilities/search/providers/TavilyProvider.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(readonly connector: Connector)
```

**Parameters:**
- `connector`: `Connector`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `search()`

```typescript
async search(query: string, options: SearchOptions =
```

**Parameters:**
- `query`: `string`
- `options`: `SearchOptions` *(optional)* (default: `{}`)

**Returns:** `Promise&lt;SearchResponse&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "tavily"` | - |

</details>

---

### WebSearchSource `class`

📍 [`src/capabilities/researchAgent/sources/WebSearchSource.ts:39`](src/capabilities/researchAgent/sources/WebSearchSource.ts)

WebSearchSource - Uses SearchProvider for web search

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: WebSearchSourceConfig)
```

**Parameters:**
- `config`: `WebSearchSourceConfig`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `search()`

```typescript
async search(query: string, options?: SearchOptions): Promise&lt;SearchResponse&gt;
```

**Parameters:**
- `query`: `string`
- `options`: `SearchOptions | undefined` *(optional)*

**Returns:** `Promise&lt;SearchResponse&gt;`

#### `fetch()`

```typescript
async fetch(reference: string, options?: FetchOptions): Promise&lt;FetchedContent&gt;
```

**Parameters:**
- `reference`: `string`
- `options`: `FetchOptions | undefined` *(optional)*

**Returns:** `Promise&lt;FetchedContent&gt;`

#### `isAvailable()`

```typescript
async isAvailable(): Promise&lt;boolean&gt;
```

**Returns:** `Promise&lt;boolean&gt;`

#### `getCapabilities()`

```typescript
getCapabilities(): SourceCapabilities
```

**Returns:** `SourceCapabilities`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string` | - |
| `description` | `description: string` | - |
| `type` | `type: "web"` | - |
| `searchProvider` | `searchProvider: ISearchProvider` | - |
| `defaultCountry?` | `defaultCountry: string | undefined` | - |
| `defaultLanguage?` | `defaultLanguage: string | undefined` | - |

</details>

---

### AgentConfig `interface`

📍 [`src/domain/entities/AgentState.ts:23`](src/domain/entities/AgentState.ts)

Agent configuration (needed for resume)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `connectorName` | `connectorName: string;` | - |
| `model` | `model: string;` | - |
| `temperature?` | `temperature?: number;` | - |
| `maxIterations?` | `maxIterations?: number;` | - |
| `toolNames` | `toolNames: string[];` | - |

</details>

---

### AgenticLoopEvents `interface`

📍 [`src/capabilities/agents/types/EventTypes.ts:153`](src/capabilities/agents/types/EventTypes.ts)

Map of all event names to their payload types

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'execution:start'` | `'execution:start': ExecutionStartEvent;` | - |
| `'execution:complete'` | `'execution:complete': ExecutionCompleteEvent;` | - |
| `'execution:error'` | `'execution:error': ExecutionErrorEvent;` | - |
| `'execution:paused'` | `'execution:paused': ExecutionPausedEvent;` | - |
| `'execution:resumed'` | `'execution:resumed': ExecutionResumedEvent;` | - |
| `'execution:cancelled'` | `'execution:cancelled': ExecutionCancelledEvent;` | - |
| `'iteration:start'` | `'iteration:start': IterationStartEvent;` | - |
| `'iteration:complete'` | `'iteration:complete': IterationCompleteEvent;` | - |
| `'llm:request'` | `'llm:request': LLMRequestEvent;` | - |
| `'llm:response'` | `'llm:response': LLMResponseEvent;` | - |
| `'llm:error'` | `'llm:error': LLMErrorEvent;` | - |
| `'tool:detected'` | `'tool:detected': ToolDetectedEvent;` | - |
| `'tool:start'` | `'tool:start': ToolStartEvent;` | - |
| `'tool:complete'` | `'tool:complete': ToolCompleteEvent;` | - |
| `'tool:error'` | `'tool:error': ToolErrorEvent;` | - |
| `'tool:timeout'` | `'tool:timeout': ToolTimeoutEvent;` | - |
| `'hook:error'` | `'hook:error': HookErrorEvent;` | - |
| `'circuit:opened'` | `'circuit:opened': CircuitOpenedEvent;` | - |
| `'circuit:half-open'` | `'circuit:half-open': CircuitHalfOpenEvent;` | - |
| `'circuit:closed'` | `'circuit:closed': CircuitClosedEvent;` | - |

</details>

---

### AgentPermissionsConfig `interface`

📍 [`src/core/permissions/types.ts:219`](src/core/permissions/types.ts)

Permission configuration for any agent type.

Used in:
- Agent.create({ permissions: {...} })
- TaskAgent.create({ permissions: {...} })
- UniversalAgent.create({ permissions: {...} })

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `defaultScope?` | `defaultScope?: PermissionScope;` | Default permission scope for tools without explicit config. |
| `defaultRiskLevel?` | `defaultRiskLevel?: RiskLevel;` | Default risk level for tools without explicit config. |
| `allowlist?` | `allowlist?: string[];` | Tools that are always allowed (never prompt).
Array of tool names. |
| `blocklist?` | `blocklist?: string[];` | Tools that are always blocked (cannot execute).
Array of tool names. |
| `tools?` | `tools?: Record&lt;string, ToolPermissionConfig&gt;;` | Per-tool permission overrides.
Keys are tool names, values are permission configs. |
| `onApprovalRequired?` | `onApprovalRequired?: (context: PermissionCheckContext) =&gt; Promise&lt;ApprovalDecision&gt;;` | Callback invoked when a tool needs approval.
Return an ApprovalDecision to approve/deny.

If not provided, the existing `approve:tool` hook system is used.
This callback runs BEFORE hooks, providing a first-pass check. |
| `inheritFromSession?` | `inheritFromSession?: boolean;` | Whether to inherit permission state from parent session.
Only applies when resuming from a session. |

</details>

---

### AgentState `interface`

📍 [`src/domain/entities/AgentState.ts:53`](src/domain/entities/AgentState.ts)

Full agent state - everything needed to resume

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | - |
| `status` | `status: AgentStatus;` | - |
| `config` | `config: AgentConfig;` | Configuration |
| `plan` | `plan: Plan;` | Current plan |
| `memoryId` | `memoryId: string;` | Working memory reference |
| `conversationHistory` | `conversationHistory: ConversationMessage[];` | Conversation history (for context continuity) |
| `createdAt` | `createdAt: number;` | Timestamps |
| `startedAt?` | `startedAt?: number;` | - |
| `suspendedAt?` | `suspendedAt?: number;` | - |
| `completedAt?` | `completedAt?: number;` | - |
| `lastActivityAt` | `lastActivityAt: number;` | - |
| `metrics` | `metrics: AgentMetrics;` | Metrics |

</details>

---

### APIKeyConnectorAuth `interface`

📍 [`src/domain/entities/Connector.ts:65`](src/domain/entities/Connector.ts)

Static API key authentication
For services like OpenAI, Anthropic, many SaaS APIs

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'api_key';` | - |
| `apiKey` | `apiKey: string;` | - |
| `headerName?` | `headerName?: string;` | - |
| `headerPrefix?` | `headerPrefix?: string;` | - |

</details>

---

### ApprovalCacheEntry `interface`

📍 [`src/core/permissions/types.ts:114`](src/core/permissions/types.ts)

Entry in the approval cache representing an approved tool

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `toolName` | `toolName: string;` | Name of the approved tool |
| `scope` | `scope: PermissionScope;` | The scope that was approved |
| `approvedAt` | `approvedAt: Date;` | When the approval was granted |
| `approvedBy?` | `approvedBy?: string;` | Optional identifier of who approved (for audit) |
| `expiresAt?` | `expiresAt?: Date;` | When this approval expires (for session/TTL approvals) |
| `argsHash?` | `argsHash?: string;` | Arguments hash if approval was for specific arguments |

</details>

---

### ApprovalDecision `interface`

📍 [`src/core/permissions/types.ts:190`](src/core/permissions/types.ts)

Result from approval UI/hook

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `approved` | `approved: boolean;` | Whether the tool was approved |
| `scope?` | `scope?: PermissionScope;` | Scope of the approval (may differ from requested) |
| `reason?` | `reason?: string;` | Reason for denial (if not approved) |
| `approvedBy?` | `approvedBy?: string;` | Optional identifier of who approved |
| `remember?` | `remember?: boolean;` | Whether to remember this decision for future calls |

</details>

---

### ApprovalResult `interface`

📍 [`src/capabilities/agents/types/HookTypes.ts:110`](src/capabilities/agents/types/HookTypes.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `approved` | `approved: boolean;` | - |
| `reason?` | `reason?: string;` | - |
| `modifiedArgs?` | `modifiedArgs?: any;` | - |

</details>

---

### AuditEntry `interface`

📍 [`src/capabilities/agents/ExecutionContext.ts:59`](src/capabilities/agents/ExecutionContext.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `timestamp` | `timestamp: Date;` | - |
| `type` | `type:
    | 'hook_executed'
    | 'tool_modified'
    | 'tool_skipped'
    | 'execution_paused'
    | 'execution_resumed'
    | 'tool_approved'
    | 'tool_rejected'
    | 'tool_blocked'
    | 'tool_permission_approved';` | - |
| `hookName?` | `hookName?: string;` | - |
| `toolName?` | `toolName?: string;` | - |
| `details` | `details: any;` | - |

</details>

---

### BaseProviderConfig `interface`

📍 [`src/capabilities/shared/types.ts:16`](src/capabilities/shared/types.ts)

Base configuration for all capability providers

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `connector` | `connector: string | Connector;` | Connector name or instance |

</details>

---

### BaseProviderConfig `interface`

📍 [`src/domain/types/ProviderConfig.ts:13`](src/domain/types/ProviderConfig.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `apiKey` | `apiKey: string;` | - |
| `baseURL?` | `baseURL?: string;` | - |
| `organization?` | `organization?: string;` | - |
| `timeout?` | `timeout?: number;` | - |
| `maxRetries?` | `maxRetries?: number;` | - |

</details>

---

### BaseProviderResponse `interface`

📍 [`src/capabilities/shared/types.ts:24`](src/capabilities/shared/types.ts)

Base response for all capability providers

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | Whether the operation succeeded |
| `provider` | `provider: string;` | Provider name |
| `error?` | `error?: string;` | Error message if failed |

</details>

---

### BashResult `interface`

📍 [`src/tools/shell/types.ts:96`](src/tools/shell/types.ts)

Result of a bash command execution

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `stdout?` | `stdout?: string;` | - |
| `stderr?` | `stderr?: string;` | - |
| `exitCode?` | `exitCode?: number;` | - |
| `signal?` | `signal?: string;` | - |
| `duration?` | `duration?: number;` | - |
| `truncated?` | `truncated?: boolean;` | - |
| `error?` | `error?: string;` | - |
| `backgroundId?` | `backgroundId?: string;` | - |

</details>

---

### CacheStats `interface`

📍 [`src/core/IdempotencyCache.ts:33`](src/core/IdempotencyCache.ts)

Cache statistics

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `entries` | `entries: number;` | - |
| `hits` | `hits: number;` | - |
| `misses` | `misses: number;` | - |
| `hitRate` | `hitRate: number;` | - |

</details>

---

### CompactionItem `interface`

📍 [`src/domain/entities/Message.ts:20`](src/domain/entities/Message.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'compaction';` | - |
| `id` | `id: string;` | - |
| `encrypted_content` | `encrypted_content: string;` | - |

</details>

---

### ConnectorConfig `interface`

📍 [`src/domain/entities/Connector.ts:92`](src/domain/entities/Connector.ts)

Complete connector configuration
Used for BOTH AI providers AND external APIs

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name?` | `name?: string;` | - |
| `vendor?` | `vendor?: Vendor;` | - |
| `serviceType?` | `serviceType?: string;` | - |
| `auth` | `auth: ConnectorAuth;` | - |
| `displayName?` | `displayName?: string;` | - |
| `description?` | `description?: string;` | - |
| `baseURL?` | `baseURL?: string;` | - |
| `defaultModel?` | `defaultModel?: string;` | - |
| `apiVersion?` | `apiVersion?: string;` | - |
| `rateLimit?` | `rateLimit?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
  };` | - |
| `documentation?` | `documentation?: string;` | - |
| `tags?` | `tags?: string[];` | - |
| `options?` | `options?: {
    organization?: string; // OpenAI
    project?: string; // OpenAI
    anthropicVersion?: string;
    location?: string; // Google Vertex
    projectId?: string; // Google Vertex
    [key: string]: unknown;
  };` | - |
| `timeout?` | `timeout?: number;` | Request timeout in milliseconds |
| `retry?` | `retry?: {
    /** Maximum number of retry attempts @default 3 */
    maxRetries?: number;
    /** HTTP status codes that trigger retry @default [429, 500, 502, 503, 504] */
    retryableStatuses?: number[];
    /** Base delay in ms for exponential backoff @default 1000 */
    baseDelayMs?: number;
    /** Maximum delay in ms @default 30000 */
    maxDelayMs?: number;
  };` | Retry configuration for transient failures |
| `circuitBreaker?` | `circuitBreaker?: {
    /** Enable circuit breaker @default true */
    enabled?: boolean;
    /** Number of failures before opening circuit @default 5 */
    failureThreshold?: number;
    /** Number of successes to close circuit @default 2 */
    successThreshold?: number;
    /** Time in ms before attempting to close circuit @default 30000 */
    resetTimeoutMs?: number;
  };` | Circuit breaker configuration for failing services |
| `logging?` | `logging?: {
    /** Enable request/response logging @default false */
    enabled?: boolean;
    /** Log request/response bodies (security risk) @default false */
    logBody?: boolean;
    /** Log request/response headers (security risk) @default false */
    logHeaders?: boolean;
  };` | Logging configuration for requests/responses |

</details>

---

### ConnectorConfigResult `interface`

📍 [`src/domain/entities/Connector.ts:189`](src/domain/entities/Connector.ts)

Result from ProviderConfigAgent
Includes setup instructions and environment variables

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string;` | - |
| `config` | `config: ConnectorConfig;` | - |
| `setupInstructions` | `setupInstructions: string;` | - |
| `envVariables` | `envVariables: string[];` | - |
| `setupUrl?` | `setupUrl?: string;` | - |

</details>

---

### ConversationHistoryManagerConfig `interface`

📍 [`src/core/history/ConversationHistoryManager.ts:27`](src/core/history/ConversationHistoryManager.ts)

Configuration for ConversationHistoryManager

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `storage?` | `storage?: IHistoryStorage;` | Storage backend (defaults to in-memory) |

</details>

---

### ConversationMessage `interface`

📍 [`src/domain/entities/AgentState.ts:34`](src/domain/entities/AgentState.ts)

Conversation message in history

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `role` | `role: 'user' | 'assistant' | 'system';` | - |
| `content` | `content: string;` | - |
| `timestamp` | `timestamp: number;` | - |

</details>

---

### DirectCallOptions `interface`

📍 [`src/core/BaseAgent.ts:228`](src/core/BaseAgent.ts)

Options for direct LLM calls (bypassing AgentContext).

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `instructions?` | `instructions?: string;` | System instructions (optional) |
| `includeTools?` | `includeTools?: boolean;` | Include registered tools in the call. Default: false |
| `temperature?` | `temperature?: number;` | Temperature for generation |
| `maxOutputTokens?` | `maxOutputTokens?: number;` | Maximum output tokens |
| `responseFormat?` | `responseFormat?: {
    type: 'text' | 'json_object' | 'json_schema';
    json_schema?: unknown;
  };` | Response format (text, json_object, json_schema) |
| `vendorOptions?` | `vendorOptions?: Record&lt;string, unknown&gt;;` | Vendor-specific options |

</details>

---

### EditFileResult `interface`

📍 [`src/tools/filesystem/types.ts:107`](src/tools/filesystem/types.ts)

Result of a file edit operation

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `path?` | `path?: string;` | - |
| `replacements?` | `replacements?: number;` | - |
| `error?` | `error?: string;` | - |
| `diff?` | `diff?: string;` | - |

</details>

---

### ExtendedFetchOptions `interface`

📍 [`src/capabilities/shared/types.ts:49`](src/capabilities/shared/types.ts)

Extended fetch options with JSON body and query params support
Usable by any capability that makes HTTP requests via Connector

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `body?` | `body?: Record&lt;string, any&gt;;` | JSON body (will be stringified automatically) |
| `queryParams?` | `queryParams?: Record&lt;string, string | number | boolean&gt;;` | Query parameters (will be appended to URL automatically) |

</details>

---

### FetchedContent `interface`

📍 [`src/capabilities/researchAgent/types.ts:51`](src/capabilities/researchAgent/types.ts)

Fetched content from a source

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | Whether fetch succeeded |
| `reference` | `reference: string;` | Reference that was fetched |
| `content` | `content: unknown;` | The actual content |
| `contentType?` | `contentType?: string;` | Content type hint (text, html, json, binary, etc.) |
| `sizeBytes?` | `sizeBytes?: number;` | Size in bytes |
| `error?` | `error?: string;` | Error message if failed |
| `metadata?` | `metadata?: Record&lt;string, unknown&gt;;` | Source-specific metadata |

</details>

---

### FetchOptions `interface`

📍 [`src/capabilities/researchAgent/types.ts:83`](src/capabilities/researchAgent/types.ts)

Options for fetch operations

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxSize?` | `maxSize?: number;` | Maximum content size to fetch (bytes) |
| `timeoutMs?` | `timeoutMs?: number;` | Timeout in milliseconds |
| `sourceOptions?` | `sourceOptions?: Record&lt;string, unknown&gt;;` | Source-specific options |

</details>

---

### FileSearchSourceConfig `interface`

📍 [`src/capabilities/researchAgent/sources/FileSearchSource.ts:24`](src/capabilities/researchAgent/sources/FileSearchSource.ts)

File search source configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string;` | Source name |
| `description?` | `description?: string;` | Description |
| `basePath` | `basePath: string;` | Base directory for searches |
| `includePatterns?` | `includePatterns?: string[];` | File patterns to include (glob) |
| `excludePatterns?` | `excludePatterns?: string[];` | File patterns to exclude (glob) |
| `maxFileSize?` | `maxFileSize?: number;` | Maximum file size to read (bytes) |
| `searchMode?` | `searchMode?: 'filename' | 'content' | 'both';` | Search mode: 'filename' (match filenames), 'content' (grep-like), 'both' |

</details>

---

### GlobResult `interface`

📍 [`src/tools/filesystem/types.ts:118`](src/tools/filesystem/types.ts)

Result of a glob operation

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `files?` | `files?: string[];` | - |
| `count?` | `count?: number;` | - |
| `truncated?` | `truncated?: boolean;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### GrepMatch `interface`

📍 [`src/tools/filesystem/types.ts:129`](src/tools/filesystem/types.ts)

A single grep match

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `file` | `file: string;` | - |
| `line` | `line: number;` | - |
| `column?` | `column?: number;` | - |
| `content` | `content: string;` | - |
| `context?` | `context?: {
    before: string[];
    after: string[];
  };` | - |

</details>

---

### GrepResult `interface`

📍 [`src/tools/filesystem/types.ts:143`](src/tools/filesystem/types.ts)

Result of a grep operation

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `matches?` | `matches?: GrepMatch[];` | - |
| `filesSearched?` | `filesSearched?: number;` | - |
| `filesMatched?` | `filesMatched?: number;` | - |
| `totalMatches?` | `totalMatches?: number;` | - |
| `truncated?` | `truncated?: boolean;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### HookConfig `interface`

📍 [`src/capabilities/agents/types/HookTypes.ts:123`](src/capabilities/agents/types/HookTypes.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'before:execution'?` | `'before:execution'?: Hook&lt;BeforeExecutionContext, void&gt;;` | - |
| `'after:execution'?` | `'after:execution'?: Hook&lt;AfterExecutionContext, void&gt;;` | - |
| `'before:llm'?` | `'before:llm'?: ModifyingHook&lt;BeforeLLMContext, LLMModification&gt;;` | - |
| `'after:llm'?` | `'after:llm'?: ModifyingHook&lt;AfterLLMContext, {}&gt;;` | - |
| `'before:tool'?` | `'before:tool'?: ModifyingHook&lt;BeforeToolContext, ToolModification&gt;;` | - |
| `'after:tool'?` | `'after:tool'?: ModifyingHook&lt;AfterToolContext, ToolResultModification&gt;;` | - |
| `'approve:tool'?` | `'approve:tool'?: Hook&lt;ApproveToolContext, ApprovalResult&gt;;` | - |
| `'pause:check'?` | `'pause:check'?: Hook&lt;PauseCheckContext, PauseDecision&gt;;` | - |
| `hookTimeout?` | `hookTimeout?: number;` | - |
| `parallelHooks?` | `parallelHooks?: boolean;` | - |

</details>

---

### HTTPTransportConfig `interface`

📍 [`src/domain/entities/MCPConfig.ts:29`](src/domain/entities/MCPConfig.ts)

HTTP/HTTPS transport configuration (StreamableHTTP)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `url` | `url: string;` | HTTP(S) endpoint URL |
| `token?` | `token?: string;` | Authentication token (supports ${ENV_VAR} interpolation) |
| `headers?` | `headers?: Record&lt;string, string&gt;;` | Additional HTTP headers |
| `timeoutMs?` | `timeoutMs?: number;` | Request timeout in milliseconds |
| `sessionId?` | `sessionId?: string;` | Session ID for reconnection |
| `reconnection?` | `reconnection?: {
    /** Max reconnection delay in ms (default: 30000) */
    maxReconnectionDelay?: number;
    /** Initial reconnection delay in ms (default: 1000) */
    initialReconnectionDelay?: number;
    /** Reconnection delay growth factor (default: 1.5) */
    reconnectionDelayGrowFactor?: number;
    /** Max retry attempts (default: 2) */
    maxRetries?: number;
  };` | Reconnection options |

</details>

---

### ICapabilityProvider `interface`

📍 [`src/capabilities/shared/types.ts:36`](src/capabilities/shared/types.ts)

Base interface for all capability providers

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `readonly name: string;` | Provider name |
| `connector` | `readonly connector: Connector;` | Connector used for authentication |

</details>

---

### IdempotencyCacheConfig `interface`

📍 [`src/core/IdempotencyCache.ts:22`](src/core/IdempotencyCache.ts)

Cache configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `defaultTtlMs` | `defaultTtlMs: number;` | Default TTL for cached entries |
| `maxEntries` | `maxEntries: number;` | Max entries before eviction |

</details>

---

### InputTextContent `interface`

📍 [`src/domain/entities/Content.ts:18`](src/domain/entities/Content.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: ContentType.INPUT_TEXT;` | - |
| `text` | `text: string;` | - |

</details>

---

### IResearchSource `interface`

📍 [`src/capabilities/researchAgent/types.ts:101`](src/capabilities/researchAgent/types.ts)

Generic research source interface

Implement this interface to add any data source to ResearchAgent:
- Web: search queries, fetch URLs
- Vector DB: similarity search, fetch documents
- File system: glob patterns, read files
- API: query endpoints, fetch resources

<details>
<summary><strong>Methods</strong></summary>

#### `search()`

Search this source for relevant results

```typescript
search(query: string, options?: SearchOptions): Promise&lt;SearchResponse&gt;;
```

**Parameters:**
- `query`: `string`
- `options`: `SearchOptions | undefined` *(optional)*

**Returns:** `Promise&lt;SearchResponse&gt;`

#### `fetch()`

Fetch full content for a result

```typescript
fetch(reference: string, options?: FetchOptions): Promise&lt;FetchedContent&gt;;
```

**Parameters:**
- `reference`: `string`
- `options`: `FetchOptions | undefined` *(optional)*

**Returns:** `Promise&lt;FetchedContent&gt;`

#### `isAvailable()?`

Optional: Check if source is available/configured

```typescript
isAvailable?(): Promise&lt;boolean&gt;;
```

**Returns:** `Promise&lt;boolean&gt;`

#### `getCapabilities()?`

Optional: Get source capabilities

```typescript
getCapabilities?(): SourceCapabilities;
```

**Returns:** `SourceCapabilities`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `readonly name: string;` | Unique name for this source |
| `description` | `readonly description: string;` | Human-readable description |
| `type` | `readonly type: 'web' | 'vector' | 'file' | 'api' | 'database' | 'custom';` | Type of source (for categorization) |

</details>

---

### IScrapeProvider `interface`

📍 [`src/capabilities/scrape/ScrapeProvider.ts:105`](src/capabilities/scrape/ScrapeProvider.ts)

Base ScrapeProvider interface
All scraping providers must implement this interface

<details>
<summary><strong>Methods</strong></summary>

#### `scrape()`

Scrape a URL and extract content

```typescript
scrape(url: string, options?: ScrapeOptions): Promise&lt;ScrapeResponse&gt;;
```

**Parameters:**
- `url`: `string`
- `options`: `ScrapeOptions | undefined` *(optional)*

**Returns:** `Promise&lt;ScrapeResponse&gt;`

#### `supportsFeature()?`

Check if this provider supports a specific feature

```typescript
supportsFeature?(feature: ScrapeFeature): boolean;
```

**Parameters:**
- `feature`: `ScrapeFeature`

**Returns:** `boolean`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `readonly name: string;` | Provider name (e.g., 'jina', 'firecrawl', 'scrapingbee') |
| `connector` | `readonly connector: Connector;` | Connector used for authentication |

</details>

---

### ISearchProvider `interface`

📍 [`src/capabilities/search/SearchProvider.ts:65`](src/capabilities/search/SearchProvider.ts)

Base SearchProvider interface

<details>
<summary><strong>Methods</strong></summary>

#### `search()`

Search the web

```typescript
search(query: string, options?: SearchOptions): Promise&lt;SearchResponse&gt;;
```

**Parameters:**
- `query`: `string`
- `options`: `SearchOptions | undefined` *(optional)*

**Returns:** `Promise&lt;SearchResponse&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `readonly name: string;` | Provider name |
| `connector` | `readonly connector: Connector;` | Connector used for authentication |

</details>

---

### ISourceLinks `interface`

📍 [`src/domain/types/SharedTypes.ts:41`](src/domain/types/SharedTypes.ts)

Source links for model documentation and maintenance
Used to track where information came from and when it was last verified

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `documentation` | `documentation: string;` | Official documentation URL |
| `pricing?` | `pricing?: string;` | Pricing page URL |
| `apiReference?` | `apiReference?: string;` | API reference URL |
| `additional?` | `additional?: string;` | Additional reference (e.g., blog post, announcement) |
| `lastVerified` | `lastVerified: string;` | Last verified date (YYYY-MM-DD) |

</details>

---

### IterationCompleteEvent `interface`

📍 [`src/capabilities/agents/types/EventTypes.ts:53`](src/capabilities/agents/types/EventTypes.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `executionId` | `executionId: string;` | - |
| `iteration` | `iteration: number;` | - |
| `response` | `response: AgentResponse;` | - |
| `timestamp` | `timestamp: Date;` | - |
| `duration` | `duration: number;` | - |

</details>

---

### IVoiceInfo `interface`

📍 [`src/domain/entities/SharedVoices.ts:10`](src/domain/entities/SharedVoices.ts)

Shared voice definitions and language constants
Eliminates duplication across TTS model registries

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | - |
| `name` | `name: string;` | - |
| `language` | `language: string;` | - |
| `gender` | `gender: 'male' | 'female' | 'neutral';` | - |
| `style?` | `style?: string;` | - |
| `previewUrl?` | `previewUrl?: string;` | - |
| `isDefault?` | `isDefault?: boolean;` | - |
| `accent?` | `accent?: string;` | - |
| `age?` | `age?: 'child' | 'young' | 'adult' | 'senior';` | - |

</details>

---

### JWTConnectorAuth `interface`

📍 [`src/domain/entities/Connector.ts:76`](src/domain/entities/Connector.ts)

JWT Bearer token authentication
For service accounts (Google, Salesforce)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'jwt';` | - |
| `privateKey` | `privateKey: string;` | - |
| `privateKeyPath?` | `privateKeyPath?: string;` | - |
| `tokenUrl` | `tokenUrl: string;` | - |
| `clientId` | `clientId: string;` | - |
| `scope?` | `scope?: string;` | - |
| `issuer?` | `issuer?: string;` | - |
| `subject?` | `subject?: string;` | - |
| `audience?` | `audience?: string;` | - |

</details>

---

### LLMResponse `interface`

📍 [`src/domain/entities/Response.ts:22`](src/domain/entities/Response.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | - |
| `object` | `object: 'response';` | - |
| `created_at` | `created_at: number;` | - |
| `status` | `status: 'completed' | 'failed' | 'in_progress' | 'cancelled' | 'queued' | 'incomplete';` | - |
| `model` | `model: string;` | - |
| `output` | `output: OutputItem[];` | - |
| `output_text?` | `output_text?: string;` | - |
| `usage` | `usage: TokenUsage;` | - |
| `error?` | `error?: {
    type: string;
    message: string;
  };` | - |
| `metadata?` | `metadata?: Record&lt;string, string&gt;;` | - |

</details>

---

### MCPClientState `interface`

📍 [`src/domain/entities/MCPTypes.ts:126`](src/domain/entities/MCPTypes.ts)

MCP Client state (for serialization)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string;` | Server name |
| `state` | `state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';` | Connection state |
| `capabilities?` | `capabilities?: MCPServerCapabilities;` | Server capabilities |
| `subscribedResources` | `subscribedResources: string[];` | Subscribed resource URIs |
| `lastConnectedAt?` | `lastConnectedAt?: number;` | Last connected timestamp |
| `connectionAttempts` | `connectionAttempts: number;` | Connection attempt count |

</details>

---

### MCPConfiguration `interface`

📍 [`src/domain/entities/MCPConfig.ts:98`](src/domain/entities/MCPConfig.ts)

MCP global configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `servers` | `servers: MCPServerConfig[];` | List of MCP servers |
| `defaults?` | `defaults?: {
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
  };` | Default settings for all servers |

</details>

---

### MCPPrompt `interface`

📍 [`src/domain/entities/MCPTypes.ts:72`](src/domain/entities/MCPTypes.ts)

MCP Prompt definition

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string;` | Prompt name |
| `description?` | `description?: string;` | Prompt description |
| `arguments?` | `arguments?: Array&lt;{
    name: string;
    description?: string;
    required?: boolean;
  }&gt;;` | Prompt arguments schema |

</details>

---

### MCPPromptResult `interface`

📍 [`src/domain/entities/MCPTypes.ts:88`](src/domain/entities/MCPTypes.ts)

MCP Prompt result

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `description?` | `description?: string;` | Prompt description |
| `messages` | `messages: Array&lt;{
    role: 'user' | 'assistant';
    content: {
      type: 'text' | 'image' | 'resource';
      text?: string;
      data?: string;
      mimeType?: string;
      uri?: string;
    };
  }&gt;;` | Prompt messages |

</details>

---

### MCPResource `interface`

📍 [`src/domain/entities/MCPTypes.ts:44`](src/domain/entities/MCPTypes.ts)

MCP Resource definition

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `uri` | `uri: string;` | Resource URI |
| `name` | `name: string;` | Resource name |
| `description?` | `description?: string;` | Resource description |
| `mimeType?` | `mimeType?: string;` | MIME type |

</details>

---

### MCPResourceContent `interface`

📍 [`src/domain/entities/MCPTypes.ts:58`](src/domain/entities/MCPTypes.ts)

MCP Resource content

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `uri` | `uri: string;` | Resource URI |
| `mimeType?` | `mimeType?: string;` | MIME type |
| `text?` | `text?: string;` | Text content |
| `blob?` | `blob?: string;` | Binary content (base64) |

</details>

---

### MCPServerCapabilities `interface`

📍 [`src/domain/entities/MCPTypes.ts:107`](src/domain/entities/MCPTypes.ts)

MCP Server capabilities

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `tools?` | `tools?: Record&lt;string, unknown&gt;;` | Tools capability |
| `resources?` | `resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };` | Resources capability |
| `prompts?` | `prompts?: {
    listChanged?: boolean;
  };` | Prompts capability |
| `logging?` | `logging?: Record&lt;string, unknown&gt;;` | Logging capability |

</details>

---

### MCPServerConfig `interface`

📍 [`src/domain/entities/MCPConfig.ts:61`](src/domain/entities/MCPConfig.ts)

MCP server configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string;` | Unique identifier for the server |
| `displayName?` | `displayName?: string;` | Human-readable display name |
| `description?` | `description?: string;` | Server description |
| `transport` | `transport: MCPTransportType;` | Transport type |
| `transportConfig` | `transportConfig: TransportConfig;` | Transport-specific configuration |
| `autoConnect?` | `autoConnect?: boolean;` | Auto-connect on startup (default: false) |
| `autoReconnect?` | `autoReconnect?: boolean;` | Auto-reconnect on failure (default: true) |
| `reconnectIntervalMs?` | `reconnectIntervalMs?: number;` | Reconnect interval in milliseconds (default: 5000) |
| `maxReconnectAttempts?` | `maxReconnectAttempts?: number;` | Maximum reconnect attempts (default: 10) |
| `requestTimeoutMs?` | `requestTimeoutMs?: number;` | Request timeout in milliseconds (default: 30000) |
| `healthCheckIntervalMs?` | `healthCheckIntervalMs?: number;` | Health check interval in milliseconds (default: 60000) |
| `toolNamespace?` | `toolNamespace?: string;` | Tool namespace prefix (default: 'mcp:{name}') |
| `permissions?` | `permissions?: {
    /** Default permission scope */
    defaultScope?: 'once' | 'session' | 'always' | 'never';
    /** Default risk level */
    defaultRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
  };` | Permission configuration for tools from this server |

</details>

---

### Message `interface`

📍 [`src/domain/entities/Message.ts:13`](src/domain/entities/Message.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'message';` | - |
| `id?` | `id?: string;` | - |
| `role` | `role: MessageRole;` | - |
| `content` | `content: Content[];` | - |

</details>

---

### OutputTextContent `interface`

📍 [`src/domain/entities/Content.ts:36`](src/domain/entities/Content.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: ContentType.OUTPUT_TEXT;` | - |
| `text` | `text: string;` | - |
| `annotations?` | `annotations?: any[];` | - |

</details>

---

### PermissionCheckContext `interface`

📍 [`src/core/permissions/types.ts:84`](src/core/permissions/types.ts)

Context passed to approval callbacks/hooks

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `toolCall` | `toolCall: ToolCall;` | The tool call being checked |
| `parsedArgs` | `parsedArgs: Record&lt;string, unknown&gt;;` | Parsed arguments (for display/inspection) |
| `config` | `config: ToolPermissionConfig;` | The tool's permission config |
| `executionId` | `executionId: string;` | Current execution context ID |
| `iteration` | `iteration: number;` | Current iteration (if in agentic loop) |
| `agentType` | `agentType: 'agent' | 'task-agent' | 'universal-agent';` | Agent type (for context-specific handling) |
| `taskName?` | `taskName?: string;` | Optional task name (for TaskAgent/UniversalAgent) |

</details>

---

### PermissionCheckResult `interface`

📍 [`src/core/permissions/types.ts:170`](src/core/permissions/types.ts)

Result of checking if a tool needs approval

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `allowed` | `allowed: boolean;` | Whether the tool can execute without prompting |
| `needsApproval` | `needsApproval: boolean;` | Whether approval is needed (user should be prompted) |
| `blocked` | `blocked: boolean;` | Whether the tool is blocked (cannot execute at all) |
| `reason` | `reason: string;` | Reason for the decision |
| `config?` | `config?: ToolPermissionConfig;` | The tool's permission config (for UI display) |

</details>

---

### ReadFileResult `interface`

📍 [`src/tools/filesystem/types.ts:82`](src/tools/filesystem/types.ts)

Result of a file read operation

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `content?` | `content?: string;` | - |
| `lines?` | `lines?: number;` | - |
| `truncated?` | `truncated?: boolean;` | - |
| `encoding?` | `encoding?: string;` | - |
| `size?` | `size?: number;` | - |
| `error?` | `error?: string;` | - |
| `path?` | `path?: string;` | - |

</details>

---

### ReasoningItem `interface`

📍 [`src/domain/entities/Message.ts:26`](src/domain/entities/Message.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'reasoning';` | - |
| `id` | `id: string;` | - |
| `effort?` | `effort?: 'low' | 'medium' | 'high';` | - |
| `summary?` | `summary?: string;` | - |
| `encrypted_content?` | `encrypted_content?: string;` | - |

</details>

---

### ResearchAgentConfig `interface`

📍 [`src/capabilities/researchAgent/ResearchAgent.ts:52`](src/capabilities/researchAgent/ResearchAgent.ts)

ResearchAgent configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `sources` | `sources: IResearchSource[];` | Research sources to use |
| `defaultSearchOptions?` | `defaultSearchOptions?: SearchOptions;` | Default search options for all sources |
| `defaultFetchOptions?` | `defaultFetchOptions?: FetchOptions;` | Default fetch options for all sources |
| `autoSpill?` | `autoSpill?: AutoSpillConfig;` | Auto-spill configuration |
| `hooks?` | `hooks?: ResearchAgentHooks;` | Research-specific hooks |
| `autoSummarizeThreshold?` | `autoSummarizeThreshold?: number;` | Auto-summarize fetched content above this size (bytes). Default: 20KB |
| `includeResearchTools?` | `includeResearchTools?: boolean;` | Include research-specific tools. Default: true |

</details>

---

### ResearchAgentHooks `interface`

📍 [`src/capabilities/researchAgent/ResearchAgent.ts:35`](src/capabilities/researchAgent/ResearchAgent.ts)

Research-specific hooks

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `onSearchComplete?` | `onSearchComplete?: (source: string, query: string, resultCount: number) =&gt; Promise&lt;void&gt;;` | Called when a source search completes |
| `onContentFetched?` | `onContentFetched?: (source: string, reference: string, sizeBytes: number) =&gt; Promise&lt;void&gt;;` | Called when content is fetched |
| `onFindingStored?` | `onFindingStored?: (key: string, finding: ResearchFinding) =&gt; Promise&lt;void&gt;;` | Called when a finding is stored |
| `onProgress?` | `onProgress?: (progress: ResearchProgress) =&gt; Promise&lt;void&gt;;` | Called on research progress updates |

</details>

---

### ResearchFinding `interface`

📍 [`src/capabilities/researchAgent/types.ts:159`](src/capabilities/researchAgent/types.ts)

Research finding stored in memory

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `source` | `source: string;` | Source that provided this finding |
| `query` | `query: string;` | Original query that found this |
| `summary` | `summary: string;` | Key insight or summary |
| `details?` | `details?: string;` | Supporting details |
| `references` | `references: string[];` | References used |
| `confidence?` | `confidence?: number;` | Confidence level (0-1) |
| `timestamp` | `timestamp: number;` | When this was found |

</details>

---

### ResearchProgress `interface`

📍 [`src/capabilities/researchAgent/types.ts:236`](src/capabilities/researchAgent/types.ts)

Research progress event

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `phase` | `phase: 'searching' | 'processing' | 'synthesizing' | 'complete';` | - |
| `currentQuery?` | `currentQuery?: string;` | - |
| `currentSource?` | `currentSource?: string;` | - |
| `queriesCompleted` | `queriesCompleted: number;` | - |
| `totalQueries` | `totalQueries: number;` | - |
| `resultsProcessed` | `resultsProcessed: number;` | - |
| `totalResults` | `totalResults: number;` | - |
| `findingsGenerated` | `findingsGenerated: number;` | - |

</details>

---

### ResearchQuery `interface`

📍 [`src/capabilities/researchAgent/types.ts:195`](src/capabilities/researchAgent/types.ts)

A query in the research plan

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `query` | `query: string;` | Query string |
| `sources?` | `sources?: string[];` | Specific sources for this query (empty = all) |
| `priority?` | `priority?: number;` | Priority (higher = more important) |

</details>

---

### ResearchResult `interface`

📍 [`src/capabilities/researchAgent/types.ts:207`](src/capabilities/researchAgent/types.ts)

Research execution result

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | Whether research completed successfully |
| `goal` | `goal: string;` | Original goal |
| `queriesExecuted` | `queriesExecuted: number;` | Queries executed |
| `resultsFound` | `resultsFound: number;` | Results found |
| `resultsProcessed` | `resultsProcessed: number;` | Results processed |
| `findingsCount` | `findingsCount: number;` | Findings generated |
| `synthesis?` | `synthesis?: string;` | Final synthesis (if generated) |
| `error?` | `error?: string;` | Error if failed |
| `metrics?` | `metrics?: {
    totalDurationMs: number;
    searchDurationMs: number;
    processDurationMs: number;
    synthesizeDurationMs: number;
  };` | Execution metrics |

</details>

---

### ScrapeOptions `interface`

📍 [`src/capabilities/scrape/ScrapeProvider.ts:58`](src/capabilities/scrape/ScrapeProvider.ts)

Scrape options

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `timeout?` | `timeout?: number;` | Timeout in milliseconds (default: 30000) |
| `waitForJS?` | `waitForJS?: boolean;` | Whether to wait for JavaScript to render (if supported) |
| `waitForSelector?` | `waitForSelector?: string;` | CSS selector to wait for before scraping |
| `includeHtml?` | `includeHtml?: boolean;` | Whether to include raw HTML in response |
| `includeMarkdown?` | `includeMarkdown?: boolean;` | Whether to convert to markdown (if supported) |
| `includeLinks?` | `includeLinks?: boolean;` | Whether to extract links |
| `includeScreenshot?` | `includeScreenshot?: boolean;` | Whether to take a screenshot (if supported) |
| `headers?` | `headers?: Record&lt;string, string&gt;;` | Custom headers to send |
| `vendorOptions?` | `vendorOptions?: Record&lt;string, any&gt;;` | Vendor-specific options |

</details>

---

### ScrapeProviderConfig `interface`

📍 [`src/capabilities/scrape/ScrapeProvider.ts:180`](src/capabilities/scrape/ScrapeProvider.ts)

ScrapeProvider factory configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `connector` | `connector: string | Connector;` | Connector name or instance |

</details>

---

### ScrapeProviderFallbackConfig `interface`

📍 [`src/capabilities/scrape/ScrapeProvider.ts:188`](src/capabilities/scrape/ScrapeProvider.ts)

Fallback chain configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `primary` | `primary: string | Connector;` | Primary connector to try first |
| `fallbacks?` | `fallbacks?: Array&lt;string | Connector&gt;;` | Fallback connectors to try in order |
| `tryNativeFirst?` | `tryNativeFirst?: boolean;` | Whether to try native fetch before API providers |

</details>

---

### ScrapeResponse `interface`

📍 [`src/capabilities/scrape/ScrapeProvider.ts:82`](src/capabilities/scrape/ScrapeProvider.ts)

Scrape response

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `url` | `url: string;` | The URL that was scraped |
| `finalUrl?` | `finalUrl?: string;` | Final URL after redirects |
| `result?` | `result?: ScrapeResult;` | Scraped content |
| `statusCode?` | `statusCode?: number;` | HTTP status code |
| `durationMs?` | `durationMs?: number;` | Time taken in milliseconds |
| `requiredJS?` | `requiredJS?: boolean;` | Whether the content required JavaScript rendering |
| `suggestedFallback?` | `suggestedFallback?: string;` | Suggested fallback if this provider failed |

</details>

---

### ScrapeResult `interface`

📍 [`src/capabilities/scrape/ScrapeProvider.ts:30`](src/capabilities/scrape/ScrapeProvider.ts)

Scraped content result

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `title` | `title: string;` | Page title |
| `content` | `content: string;` | Extracted text content (cleaned) |
| `html?` | `html?: string;` | Raw HTML (if available) |
| `markdown?` | `markdown?: string;` | Markdown version (if provider supports it) |
| `metadata?` | `metadata?: {
    description?: string;
    author?: string;
    publishedDate?: string;
    siteName?: string;
    favicon?: string;
    ogImage?: string;
    [key: string]: any;
  };` | Metadata extracted from the page |
| `screenshot?` | `screenshot?: string;` | Screenshot as base64 (if requested and supported) |
| `links?` | `links?: Array&lt;{ url: string; text: string }&gt;;` | Links found on the page |

</details>

---

### SearchOptions `interface`

📍 [`src/capabilities/researchAgent/types.ts:71`](src/capabilities/researchAgent/types.ts)

Options for search operations

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxResults?` | `maxResults?: number;` | Maximum results to return |
| `minRelevance?` | `minRelevance?: number;` | Minimum relevance score (0-1) |
| `sourceOptions?` | `sourceOptions?: Record&lt;string, unknown&gt;;` | Source-specific options |

</details>

---

### SearchOptions `interface`

📍 [`src/capabilities/search/SearchProvider.ts:31`](src/capabilities/search/SearchProvider.ts)

Search options

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `numResults?` | `numResults?: number;` | Number of results to return (default: 10, max provider-specific) |
| `language?` | `language?: string;` | Language code (e.g., 'en', 'fr') |
| `country?` | `country?: string;` | Country/region code (e.g., 'us', 'gb') |
| `timeRange?` | `timeRange?: string;` | Time range filter (e.g., 'day', 'week', 'month', 'year') |
| `vendorOptions?` | `vendorOptions?: Record&lt;string, any&gt;;` | Vendor-specific options |

</details>

---

### SearchProviderConfig `interface`

📍 [`src/capabilities/search/SearchProvider.ts:83`](src/capabilities/search/SearchProvider.ts)

SearchProvider factory configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `connector` | `connector: string | Connector;` | Connector name or instance |

</details>

---

### SearchResponse `interface`

📍 [`src/capabilities/researchAgent/types.ts:33`](src/capabilities/researchAgent/types.ts)

Response from a search operation

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | Whether the search succeeded |
| `query` | `query: string;` | Original query |
| `results` | `results: SourceResult[];` | Results found |
| `totalResults?` | `totalResults?: number;` | Total results available (may be more than returned) |
| `error?` | `error?: string;` | Error message if failed |
| `metadata?` | `metadata?: Record&lt;string, unknown&gt;;` | Source-specific metadata |

</details>

---

### SearchResponse `interface`

📍 [`src/capabilities/search/SearchProvider.ts:47`](src/capabilities/search/SearchProvider.ts)

Search response

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | Whether the search succeeded |
| `query` | `query: string;` | Search query |
| `provider` | `provider: string;` | Provider name |
| `results` | `results: SearchResult[];` | Search results |
| `count` | `count: number;` | Number of results |
| `error?` | `error?: string;` | Error message if failed |

</details>

---

### SearchResult `interface`

📍 [`src/capabilities/search/SearchProvider.ts:17`](src/capabilities/search/SearchProvider.ts)

Search result interface

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `title` | `title: string;` | Page title |
| `url` | `url: string;` | Direct URL to the page |
| `snippet` | `snippet: string;` | Short description/excerpt |
| `position` | `position: number;` | Search ranking position |

</details>

---

### SearchResult `interface`

📍 [`src/tools/web/searchProviders/serper.ts:6`](src/tools/web/searchProviders/serper.ts)

Serper.dev search provider
Fast Google search results via API

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `title` | `title: string;` | - |
| `url` | `url: string;` | - |
| `snippet` | `snippet: string;` | - |
| `position` | `position: number;` | - |

</details>

---

### SerializedApprovalEntry `interface`

📍 [`src/core/permissions/types.ts:154`](src/core/permissions/types.ts)

Serialized version of ApprovalCacheEntry (with ISO date strings)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `toolName` | `toolName: string;` | - |
| `scope` | `scope: PermissionScope;` | - |
| `approvedAt` | `approvedAt: string;` | - |
| `approvedBy?` | `approvedBy?: string;` | - |
| `expiresAt?` | `expiresAt?: string;` | - |
| `argsHash?` | `argsHash?: string;` | - |

</details>

---

### SerializedApprovalState `interface`

📍 [`src/core/permissions/types.ts:137`](src/core/permissions/types.ts)

Serialized approval state for session persistence

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `version` | `version: number;` | Version for future migrations |
| `approvals` | `approvals: Record&lt;string, SerializedApprovalEntry&gt;;` | Map of tool name to approval entry |
| `blocklist` | `blocklist: string[];` | Tools that are always blocked (persisted blocklist) |
| `allowlist` | `allowlist: string[];` | Tools that are always allowed (persisted allowlist) |

</details>

---

### ServiceDefinition `interface`

📍 [`src/domain/entities/Services.ts:28`](src/domain/entities/Services.ts)

Complete service definition - single source of truth

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | Unique identifier (e.g., 'slack', 'github') |
| `name` | `name: string;` | Human-readable name (e.g., 'Slack', 'GitHub') |
| `category` | `category: ServiceCategory;` | Service category |
| `urlPattern` | `urlPattern: RegExp;` | URL pattern for auto-detection from baseURL |
| `baseURL` | `baseURL: string;` | Default base URL for API calls |
| `docsURL?` | `docsURL?: string;` | Documentation URL |
| `commonScopes?` | `commonScopes?: string[];` | Common OAuth scopes |

</details>

---

### ServiceInfo `interface`

📍 [`src/domain/entities/Services.ts:476`](src/domain/entities/Services.ts)

Service info lookup (derived from SERVICE_DEFINITIONS)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | - |
| `name` | `name: string;` | - |
| `category` | `category: ServiceCategory;` | - |
| `baseURL` | `baseURL: string;` | - |
| `docsURL?` | `docsURL?: string;` | - |
| `commonScopes?` | `commonScopes?: string[];` | - |

</details>

---

### SourceCapabilities `interface`

📍 [`src/capabilities/researchAgent/types.ts:143`](src/capabilities/researchAgent/types.ts)

Source capabilities for discovery

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `canSearch` | `canSearch: boolean;` | Whether source supports search |
| `canFetch` | `canFetch: boolean;` | Whether source supports fetch |
| `hasRelevanceScores` | `hasRelevanceScores: boolean;` | Whether results include relevance scores |
| `maxResultsPerSearch?` | `maxResultsPerSearch?: number;` | Maximum results per search |
| `contentTypes?` | `contentTypes?: string[];` | Supported content types |

</details>

---

### SourceResult `interface`

📍 [`src/capabilities/researchAgent/types.ts:15`](src/capabilities/researchAgent/types.ts)

ResearchAgent Types

Generic interfaces for research sources that work with any data provider:
- Web search (Serper, Brave, Tavily)
- Vector databases (Pinecone, Weaviate, Qdrant)
- File systems (local, S3, GCS)
- APIs (REST, GraphQL)
- Databases (SQL, MongoDB)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | Unique identifier for this result |
| `title` | `title: string;` | Human-readable title |
| `snippet` | `snippet: string;` | Brief description or snippet |
| `reference` | `reference: string;` | Reference for fetching full content (URL, path, ID, etc.) |
| `relevance?` | `relevance?: number;` | Relevance score (0-1, higher is better) |
| `metadata?` | `metadata?: Record&lt;string, unknown&gt;;` | Source-specific metadata |

</details>

---

### StdioTransportConfig `interface`

📍 [`src/domain/entities/MCPConfig.ts:15`](src/domain/entities/MCPConfig.ts)

Stdio transport configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `command` | `command: string;` | Command to execute (e.g., 'npx', 'node') |
| `args?` | `args?: string[];` | Command arguments |
| `env?` | `env?: Record&lt;string, string&gt;;` | Environment variables |
| `cwd?` | `cwd?: string;` | Working directory for the process |

</details>

---

### VendorOptionSchema `interface`

📍 [`src/domain/types/SharedTypes.ts:58`](src/domain/types/SharedTypes.ts)

Vendor-specific option schema for validation and documentation
Used to describe vendor-specific options that fall outside semantic options

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'string' | 'number' | 'boolean' | 'enum' | 'array';` | - |
| `description` | `description: string;` | - |
| `required?` | `required?: boolean;` | - |
| `enum?` | `enum?: string[];` | - |
| `min?` | `min?: number;` | - |
| `max?` | `max?: number;` | - |
| `default?` | `default?: unknown;` | - |

</details>

---

### WebSearchSourceConfig `interface`

📍 [`src/capabilities/researchAgent/sources/WebSearchSource.ts:21`](src/capabilities/researchAgent/sources/WebSearchSource.ts)

Web search source configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string;` | Source name (e.g., 'web-serper', 'web-brave') |
| `description?` | `description?: string;` | Description |
| `searchConnector` | `searchConnector: string | Connector;` | Connector name or instance for search |
| `fetchConnector?` | `fetchConnector?: string | Connector;` | Optional: Connector for fetching (if different from search) |
| `defaultCountry?` | `defaultCountry?: string;` | Default country code |
| `defaultLanguage?` | `defaultLanguage?: string;` | Default language |

</details>

---

### WriteFileResult `interface`

📍 [`src/tools/filesystem/types.ts:96`](src/tools/filesystem/types.ts)

Result of a file write operation

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `path?` | `path?: string;` | - |
| `bytesWritten?` | `bytesWritten?: number;` | - |
| `created?` | `created?: boolean;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### ContentType `enum`

📍 [`src/domain/entities/Content.ts:5`](src/domain/entities/Content.ts)

Content types based on OpenAI Responses API format

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `INPUT_TEXT` | `input_text` | - |
| `INPUT_IMAGE_URL` | `input_image_url` | - |
| `INPUT_FILE` | `input_file` | - |
| `OUTPUT_TEXT` | `output_text` | - |
| `TOOL_USE` | `tool_use` | - |
| `TOOL_RESULT` | `tool_result` | - |

</details>

---

### MessageRole `enum`

📍 [`src/domain/entities/Message.ts:7`](src/domain/entities/Message.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `USER` | `user` | - |
| `ASSISTANT` | `assistant` | - |
| `DEVELOPER` | `developer` | - |

</details>

---

### AgenticLoopEventName `type`

📍 [`src/capabilities/agents/types/EventTypes.ts:181`](src/capabilities/agents/types/EventTypes.ts)

```typescript
type AgenticLoopEventName = keyof AgenticLoopEvents
```

---

### AgentResponse `type`

📍 [`src/domain/entities/Response.ts:38`](src/domain/entities/Response.ts)

```typescript
type AgentResponse = LLMResponse
```

---

### AgentStatus `type`

📍 [`src/domain/entities/AgentState.ts:12`](src/domain/entities/AgentState.ts)

Agent execution status

```typescript
type AgentStatus = | 'idle'         // Created but not started
  | 'running'      // Actively executing
  | 'suspended'    // Paused, can be resumed
  | 'completed'    // Plan finished successfully
  | 'failed'       // Plan failed
  | 'cancelled'
```

---

### AspectRatio `type`

📍 [`src/domain/types/SharedTypes.ts:15`](src/domain/types/SharedTypes.ts)

Aspect ratios - normalized across all visual modalities (images, video)

```typescript
type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '3:2' | '2:3'
```

---

### AudioFormat `type`

📍 [`src/domain/types/SharedTypes.ts:26`](src/domain/types/SharedTypes.ts)

Audio output formats

```typescript
type AudioFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm' | 'ogg'
```

---

### ConnectorAuth `type`

📍 [`src/domain/entities/Connector.ts:24`](src/domain/entities/Connector.ts)

Connector authentication configuration
Supports OAuth 2.0, API keys, JWT bearer tokens, and none (for testing)

```typescript
type ConnectorAuth = | OAuthConnectorAuth
  | APIKeyConnectorAuth
  | JWTConnectorAuth
  | NoneConnectorAuth
```

---

### Content `type`

📍 [`src/domain/entities/Content.ts:56`](src/domain/entities/Content.ts)

```typescript
type Content = | InputTextContent
  | InputImageContent
  | InputFileContent
  | OutputTextContent
  | ToolUseContent
  | ToolResultContent
```

---

### HistoryMode `type`

📍 [`src/capabilities/agents/ExecutionContext.ts:10`](src/capabilities/agents/ExecutionContext.ts)

```typescript
type HistoryMode = 'none' | 'summary' | 'full'
```

---

### Hook `type`

📍 [`src/capabilities/agents/types/HookTypes.ts:15`](src/capabilities/agents/types/HookTypes.ts)

Base hook function type

```typescript
type Hook = (
  context: TContext
) =&gt; TResult | Promise&lt;TResult&gt;
```

---

### HookName `type`

📍 [`src/capabilities/agents/types/HookTypes.ts:145`](src/capabilities/agents/types/HookTypes.ts)

```typescript
type HookName = keyof Omit&lt;HookConfig, 'hookTimeout' | 'parallelHooks'&gt;
```

---

### InputItem `type`

📍 [`src/domain/entities/Message.ts:34`](src/domain/entities/Message.ts)

```typescript
type InputItem = Message | CompactionItem
```

---

### LogLevel `type`

📍 [`src/domain/types/CommonTypes.ts:5`](src/domain/types/CommonTypes.ts)

Common shared types

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'
```

---

### MCPTransportType `type`

📍 [`src/domain/entities/MCPConfig.ts:10`](src/domain/entities/MCPConfig.ts)

MCP Configuration Types

Defines configuration structures for MCP servers and global library configuration.

```typescript
type MCPTransportType = 'stdio' | 'http' | 'https'
```

---

### ModifyingHook `type`

📍 [`src/capabilities/agents/types/HookTypes.ts:22`](src/capabilities/agents/types/HookTypes.ts)

Hook that can modify data

```typescript
type ModifyingHook = Hook&lt;TContext, TModification&gt;
```

---

### OutputFormat `type`

📍 [`src/domain/types/SharedTypes.ts:31`](src/domain/types/SharedTypes.ts)

Output format preference for media

```typescript
type OutputFormat = 'url' | 'base64' | 'buffer'
```

---

### OutputItem `type`

📍 [`src/domain/entities/Message.ts:35`](src/domain/entities/Message.ts)

```typescript
type OutputItem = Message | CompactionItem | ReasoningItem
```

---

### PermissionManagerEvent `type`

📍 [`src/core/permissions/types.ts:274`](src/core/permissions/types.ts)

Events emitted by ToolPermissionManager

```typescript
type PermissionManagerEvent = | 'tool:approved'
  | 'tool:denied'
  | 'tool:blocked'
  | 'tool:revoked'
  | 'allowlist:added'
  | 'allowlist:removed'
  | 'blocklist:added'
  | 'blocklist:removed'
  | 'session:cleared'
```

---

### PermissionScope `type`

📍 [`src/core/permissions/types.ts:26`](src/core/permissions/types.ts)

Permission scope defines when approval is required for a tool

- `once` - Require approval for each tool call (most restrictive)
- `session` - Approve once, valid for entire session
- `always` - Auto-approve (allowlisted, no prompts)
- `never` - Always blocked (blocklisted, tool cannot execute)

```typescript
type PermissionScope = 'once' | 'session' | 'always' | 'never'
```

---

### QualityLevel `type`

📍 [`src/domain/types/SharedTypes.ts:21`](src/domain/types/SharedTypes.ts)

Quality levels - normalized across vendors
Providers map these to vendor-specific quality settings

```typescript
type QualityLevel = 'draft' | 'standard' | 'high' | 'ultra'
```

---

### RiskLevel `type`

📍 [`src/core/permissions/types.ts:34`](src/core/permissions/types.ts)

Risk level classification for tools

Used to help users understand the potential impact of approving a tool.
Can be used by UI to show different approval dialogs.

```typescript
type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
```

---

### ScrapeFeature `type`

📍 [`src/capabilities/scrape/ScrapeProvider.ts:130`](src/capabilities/scrape/ScrapeProvider.ts)

Features that scrape providers may support

```typescript
type ScrapeFeature = | 'javascript'      // Can render JavaScript
  | 'markdown'        // Can convert to markdown
  | 'screenshot'      // Can take screenshots
  | 'links'           // Can extract links
  | 'metadata'        // Can extract metadata
  | 'proxy'           // Uses proxy rotation
  | 'stealth'         // Has anti-bot detection bypass
  | 'pdf'             // Can scrape PDFs
  | 'dynamic'
```

---

### ServiceCategory `type`

📍 [`src/domain/entities/Services.ts:11`](src/domain/entities/Services.ts)

Services - Single source of truth for external service definitions

All service metadata is defined in one place (SERVICE_DEFINITIONS).
Other exports are derived from this to maintain DRY principles.

```typescript
type ServiceCategory = | 'communication'
  | 'development'
  | 'productivity'
  | 'crm'
  | 'payments'
  | 'cloud'
  | 'storage'
  | 'email'
  | 'monitoring'
  | 'search'
  | 'scrape'
  | 'other'
```

---

### ServiceType `type`

📍 [`src/domain/entities/Services.ts:447`](src/domain/entities/Services.ts)

Service type - union of all service IDs

```typescript
type ServiceType = (typeof SERVICE_DEFINITIONS)[number]['id']
```

---

### TransportConfig `type`

📍 [`src/domain/entities/MCPConfig.ts:56`](src/domain/entities/MCPConfig.ts)

Transport configuration union type

```typescript
type TransportConfig = StdioTransportConfig | HTTPTransportConfig
```

---

### buildEndpointWithQuery `function`

📍 [`src/capabilities/shared/types.ts:106`](src/capabilities/shared/types.ts)

Build endpoint URL with query parameters

```typescript
export function buildEndpointWithQuery(
  endpoint: string,
  queryParams?: Record&lt;string, string | number | boolean&gt;
): string
```

---

### buildQueryString `function`

📍 [`src/capabilities/shared/types.ts:63`](src/capabilities/shared/types.ts)

Build query string from params

```typescript
export function buildQueryString(params: Record&lt;string, string | number | boolean&gt;): string
```

---

### createFileSearchSource `function`

📍 [`src/capabilities/researchAgent/sources/FileSearchSource.ts:302`](src/capabilities/researchAgent/sources/FileSearchSource.ts)

Create a file search source

```typescript
export function createFileSearchSource(
  basePath: string,
  options?: Partial&lt;FileSearchSourceConfig&gt;
): FileSearchSource
```

---

### createWebSearchSource `function`

📍 [`src/capabilities/researchAgent/sources/WebSearchSource.ts:191`](src/capabilities/researchAgent/sources/WebSearchSource.ts)

Create a web search source from a connector name

```typescript
export function createWebSearchSource(
  connectorName: string,
  options?: Partial&lt;WebSearchSourceConfig&gt;
): WebSearchSource
```

---

### detectServiceFromURL `function`

📍 [`src/domain/entities/Services.ts:525`](src/domain/entities/Services.ts)

Detect service type from a URL

```typescript
export function detectServiceFromURL(url: string): string | undefined
```

---

### findConnectorByServiceTypes `function`

📍 [`src/capabilities/shared/types.ts:162`](src/capabilities/shared/types.ts)

Find a connector by supported service types
Used by tools to auto-detect available external API connectors

This is the GENERIC utility for all external API-dependent tools.
Tools define which service types they support, this function finds
the first available connector matching any of those types.

```typescript
export function findConnectorByServiceTypes(serviceTypes: string[]): Connector | null
```

**Example:**

```typescript
// In web_search tool
const SEARCH_SERVICE_TYPES = ['serper', 'brave-search', 'tavily', 'rapidapi-search'];
const connector = findConnectorByServiceTypes(SEARCH_SERVICE_TYPES);

// In web_scrape tool
const SCRAPE_SERVICE_TYPES = ['zenrows', 'jina-reader', 'firecrawl', 'scrapingbee'];
const connector = findConnectorByServiceTypes(SCRAPE_SERVICE_TYPES);
```

---

### getAllServiceIds `function`

📍 [`src/domain/entities/Services.ts:561`](src/domain/entities/Services.ts)

Get all service IDs

```typescript
export function getAllServiceIds(): string[]
```

---

### getBackgroundOutput `function`

📍 [`src/tools/shell/bash.ts:285`](src/tools/shell/bash.ts)

Get output from a background process

```typescript
export function getBackgroundOutput(bgId: string):
```

---

### getRegisteredScrapeProviders `function`

📍 [`src/capabilities/scrape/ScrapeProvider.ts:171`](src/capabilities/scrape/ScrapeProvider.ts)

Get registered service types

```typescript
export function getRegisteredScrapeProviders(): string[]
```

---

### getServiceDefinition `function`

📍 [`src/domain/entities/Services.ts:547`](src/domain/entities/Services.ts)

Get service definition by service type

```typescript
export function getServiceDefinition(serviceType: string): ServiceDefinition | undefined
```

---

### getServiceInfo `function`

📍 [`src/domain/entities/Services.ts:540`](src/domain/entities/Services.ts)

Get service info by service type

```typescript
export function getServiceInfo(serviceType: string): ServiceInfo | undefined
```

---

### getServicesByCategory `function`

📍 [`src/domain/entities/Services.ts:554`](src/domain/entities/Services.ts)

Get all services in a category

```typescript
export function getServicesByCategory(category: ServiceCategory): ServiceDefinition[]
```

---

### isBlockedCommand `function`

📍 [`src/tools/shell/types.ts:111`](src/tools/shell/types.ts)

Check if a command should be blocked

```typescript
export function isBlockedCommand(
  command: string,
  config: ShellToolConfig =
```

---

### isExcludedExtension `function`

📍 [`src/tools/filesystem/types.ts:242`](src/tools/filesystem/types.ts)

Check if a file extension should be excluded

```typescript
export function isExcludedExtension(
  filePath: string,
  excludeExtensions: string[] = DEFAULT_FILESYSTEM_CONFIG.excludeExtensions
): boolean
```

---

### isKnownService `function`

📍 [`src/domain/entities/Services.ts:568`](src/domain/entities/Services.ts)

Check if a service ID is known

```typescript
export function isKnownService(serviceId: string): boolean
```

---

### killBackgroundProcess `function`

📍 [`src/tools/shell/bash.ts:301`](src/tools/shell/bash.ts)

Kill a background process

```typescript
export function killBackgroundProcess(bgId: string): boolean
```

---

### listConnectorsByServiceTypes `function`

📍 [`src/capabilities/shared/types.ts:192`](src/capabilities/shared/types.ts)

List all available connectors for given service types
Useful for tools that want to show what's available or support fallback chains

```typescript
export function listConnectorsByServiceTypes(serviceTypes: string[]): string[]
```

---

### registerScrapeProvider `function`

📍 [`src/capabilities/scrape/ScrapeProvider.ts:161`](src/capabilities/scrape/ScrapeProvider.ts)

Register a scrape provider for a service type
Called by provider implementations to register themselves

```typescript
export function registerScrapeProvider(
  serviceType: string,
  providerClass: ProviderConstructor
): void
```

---

### resolveConnector `function`

📍 [`src/capabilities/shared/types.ts:128`](src/capabilities/shared/types.ts)

Resolve connector from config (name or instance)
Shared logic for all provider factories

```typescript
export function resolveConnector(connectorOrName: string | Connector): Connector
```

---

### toConnectorOptions `function`

📍 [`src/capabilities/shared/types.ts:80`](src/capabilities/shared/types.ts)

Convert ExtendedFetchOptions to standard ConnectorFetchOptions
Handles body stringification and query param building

```typescript
export function toConnectorOptions(options: ExtendedFetchOptions): ConnectorFetchOptions
```

---

### validatePath `function`

📍 [`src/tools/filesystem/types.ts:156`](src/tools/filesystem/types.ts)

Validate and resolve a path within allowed boundaries

```typescript
export function validatePath(
  inputPath: string,
  config: FilesystemToolConfig =
```

---

### validatePath `function`

📍 [`src/tools/json/pathUtils.ts:177`](src/tools/json/pathUtils.ts)

Validate path format

```typescript
export function validatePath(path: string): boolean
```

---

### DEFAULT_FILESYSTEM_CONFIG `const`

📍 [`src/tools/filesystem/types.ts:62`](src/tools/filesystem/types.ts)

Default configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `workingDirectory` | `process.cwd()` | - |
| `allowedDirectories` | `[]` | - |
| `blockedDirectories` | `['node_modules', '.git', '.svn', '.hg', '__pycache__', '.cache']` | - |
| `maxFileSize` | `10 * 1024 * 1024` | - |
| `maxResults` | `1000` | - |
| `followSymlinks` | `false` | - |
| `excludeExtensions` | `[
    '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a',
    '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
    '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
  ]` | - |

</details>

---

### DEFAULT_IDEMPOTENCY_CONFIG `const`

📍 [`src/core/IdempotencyCache.ts:43`](src/core/IdempotencyCache.ts)

Default configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `defaultTtlMs` | `3600000` | - |
| `maxEntries` | `1000` | - |

</details>

---

### DEFAULT_PERMISSION_CONFIG `const`

📍 [`src/core/permissions/types.ts:297`](src/core/permissions/types.ts)

Default permission config applied when no config is specified

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `scope` | `'once'` | - |
| `riskLevel` | `'low'` | - |

</details>

---

### DEFAULT_SHELL_CONFIG `const`

📍 [`src/tools/shell/types.ts:68`](src/tools/shell/types.ts)

Default configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `workingDirectory` | `process.cwd()` | - |
| `defaultTimeout` | `120000` | - |
| `maxTimeout` | `600000` | - |
| `shell` | `process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'` | - |
| `env` | `{}` | - |
| `blockedCommands` | `[
    'rm -rf /',
    'rm -rf /*',
    'rm -rf ~',
    'rm -rf ~/*',
    'mkfs',
    'dd if=/dev/zero',
    ':(){:|:&};:', // Fork bomb
  ]` | - |
| `blockedPatterns` | `[
    /rm\s+(-rf?|--recursive)\s+\/(?!\S)/i, // rm -rf / variations
    /&gt;\s*\/dev\/sd[a-z]/i, // Writing to disk devices
    /mkfs/i,
    /dd\s+.*of=\/dev\//i, // dd to devices
  ]` | - |
| `maxOutputSize` | `100000` | - |
| `allowBackground` | `true` | - |

</details>

---
