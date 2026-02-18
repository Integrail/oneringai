# @everworker/oneringai - API Reference

**Generated:** 2026-02-18
**Mode:** public

This document provides a complete reference for the public API of `@everworker/oneringai`.

For usage examples and tutorials, see the [User Guide](./USER_GUIDE.md).

> **Note:** This documentation is auto-generated from source code. Items marked with `@internal` are excluded.

## Table of Contents

- [Core](#core) (9 items)
- [Text-to-Speech (TTS)](#text-to-speech-tts-) (9 items)
- [Speech-to-Text (STT)](#speech-to-text-stt-) (11 items)
- [Image Generation](#image-generation) (24 items)
- [Video Generation](#video-generation) (18 items)
- [Task Agents](#task-agents) (77 items)
- [Context Management](#context-management) (14 items)
- [Session Management](#session-management) (24 items)
- [Tools & Function Calling](#tools-function-calling) (119 items)
- [Streaming](#streaming) (15 items)
- [Model Registry](#model-registry) (10 items)
- [OAuth & External APIs](#oauth-external-apis) (39 items)
- [Resilience & Observability](#resilience-observability) (33 items)
- [Errors](#errors) (20 items)
- [Utilities](#utilities) (8 items)
- [Interfaces](#interfaces) (42 items)
- [Base Classes](#base-classes) (3 items)
- [Other](#other) (238 items)

## Core

Core classes for authentication, agents, and providers

### Agent `class`

📍 [`src/core/Agent.ts:130`](src/core/Agent.ts)

Agent class - represents an AI assistant with tool calling capabilities

Extends BaseAgent to inherit:
- Connector resolution
- Provider initialization
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
- `config`: `Omit&lt;AgentConfig, "session"&gt; & { session: { storage: IContextStorage; }; }`

**Returns:** `Promise&lt;Agent&gt;`

#### `static fromStorage()`

Create an agent from a stored definition

Loads agent configuration from storage and creates a new Agent instance.
The connector must be registered at runtime before calling this method.

```typescript
static async fromStorage(
    agentId: string,
    storage?: IAgentDefinitionStorage,
    overrides?: Partial&lt;AgentConfig&gt;
  ): Promise&lt;Agent | null&gt;
```

**Parameters:**
- `agentId`: `string`
- `storage`: `IAgentDefinitionStorage | undefined` *(optional)*
- `overrides`: `Partial&lt;AgentConfig&gt; | undefined` *(optional)*

**Returns:** `Promise&lt;Agent | null&gt;`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `getAgentType()`

```typescript
protected getAgentType(): 'agent' | 'task-agent' | 'universal-agent'
```

**Returns:** `"agent" | "task-agent" | "universal-agent"`

#### `hasContext()`

Check if context management is enabled.
Always returns true since AgentContext is always created by BaseAgent.

```typescript
hasContext(): boolean
```

**Returns:** `boolean`

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

#### `pause()`

Pause execution

```typescript
pause(reason?: string): void
```

**Parameters:**
- `reason`: `string | undefined` *(optional)*

**Returns:** `void`

#### `resume()`

Resume execution

```typescript
resume(): void
```

**Returns:** `void`

#### `cancel()`

Cancel execution

```typescript
cancel(reason?: string): void
```

**Parameters:**
- `reason`: `string | undefined` *(optional)*

**Returns:** `void`

#### `approveToolForSession()`

```typescript
approveToolForSession(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `revokeToolApproval()`

```typescript
revokeToolApproval(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `getApprovedTools()`

```typescript
getApprovedTools(): string[]
```

**Returns:** `string[]`

#### `toolNeedsApproval()`

```typescript
toolNeedsApproval(toolName: string): boolean
```

**Parameters:**
- `toolName`: `string`

**Returns:** `boolean`

#### `toolIsBlocked()`

```typescript
toolIsBlocked(toolName: string): boolean
```

**Parameters:**
- `toolName`: `string`

**Returns:** `boolean`

#### `allowlistTool()`

```typescript
allowlistTool(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `blocklistTool()`

```typescript
blocklistTool(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `setModel()`

```typescript
setModel(model: string): void
```

**Parameters:**
- `model`: `string`

**Returns:** `void`

#### `getTemperature()`

```typescript
getTemperature(): number | undefined
```

**Returns:** `number | undefined`

#### `setTemperature()`

```typescript
setTemperature(temperature: number): void
```

**Parameters:**
- `temperature`: `number`

**Returns:** `void`

#### `saveDefinition()`

```typescript
async saveDefinition(
    storage?: IAgentDefinitionStorage,
    metadata?: AgentDefinitionMetadata
  ): Promise&lt;void&gt;
```

**Parameters:**
- `storage`: `IAgentDefinitionStorage | undefined` *(optional)*
- `metadata`: `AgentDefinitionMetadata | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `getExecutionContext()`

```typescript
getExecutionContext(): ExecutionContext | null
```

**Returns:** `ExecutionContext | null`

#### `getContext()`

Alias for getExecutionContext() for backward compatibility

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

```typescript
getProviderCircuitBreakerMetrics()
```

**Returns:** `unknown`

#### `getToolCircuitBreakerStates()`

```typescript
getToolCircuitBreakerStates()
```

**Returns:** `Map&lt;string, CircuitState&gt;`

#### `getToolCircuitBreakerMetrics()`

```typescript
getToolCircuitBreakerMetrics(toolName: string)
```

**Parameters:**
- `toolName`: `string`

**Returns:** `CircuitBreakerMetrics | undefined`

#### `resetToolCircuitBreaker()`

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
| `hookManager` | `hookManager: HookManager` | - |
| `executionContext` | `executionContext: ExecutionContext | null` | - |

</details>

---

### Connector `class`

📍 [`src/core/Connector.ts:53`](src/core/Connector.ts)

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

#### `static setAccessPolicy()`

Set a global access policy for connector scoping.
Pass null to clear the policy.

```typescript
static setAccessPolicy(policy: IConnectorAccessPolicy | null): void
```

**Parameters:**
- `policy`: `IConnectorAccessPolicy | null`

**Returns:** `void`

#### `static getAccessPolicy()`

Get the current global access policy (or null if none set).

```typescript
static getAccessPolicy(): IConnectorAccessPolicy | null
```

**Returns:** `IConnectorAccessPolicy | null`

#### `static scoped()`

Create a scoped (filtered) view of the connector registry.
Requires a global access policy to be set via setAccessPolicy().

```typescript
static scoped(context: ConnectorAccessContext): IConnectorRegistry
```

**Parameters:**
- `context`: `ConnectorAccessContext`

**Returns:** `IConnectorRegistry`

#### `static asRegistry()`

Return the static Connector methods as an IConnectorRegistry object (unfiltered).
Useful when code accepts the interface but you want the full admin view.

```typescript
static asRegistry(): IConnectorRegistry
```

**Returns:** `IConnectorRegistry`

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

📍 [`src/core/Agent.ts:47`](src/core/Agent.ts)

Agent configuration - extends BaseAgentConfig with Agent-specific options

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `instructions?` | `instructions?: string;` | System instructions for the agent |
| `temperature?` | `temperature?: number;` | Temperature for generation |
| `maxIterations?` | `maxIterations?: number;` | Maximum iterations for tool calling loop |
| `vendorOptions?` | `vendorOptions?: Record&lt;string, unknown&gt;;` | Vendor-specific options (e.g., Google's thinkingLevel: 'low' | 'high') |
| `context?` | `context?: AgentContextNextGen | AgentContextNextGenConfig;` | Optional unified context management.
When provided (as AgentContextNextGen instance or config), Agent will:
- Track conversation history
- Provide unified memory access
- Support session persistence via context

Pass an AgentContextNextGen instance or AgentContextNextGenConfig to enable. |
| `toolExecutionTimeout?` | `toolExecutionTimeout?: number;` | Hard timeout in milliseconds for any single tool execution.
Acts as a safety net: if a tool's own timeout mechanism fails
(e.g. a spawned child process doesn't exit), this will force-resolve
with an error. Default: 0 (disabled - relies on each tool's own timeout).

Example: `toolExecutionTimeout: 300000` (5 minutes hard cap per tool call) |
| `toolTimeout?` | `toolTimeout?: number;` | - |
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

### ConnectorFetchOptions `interface`

📍 [`src/core/Connector.ts:41`](src/core/Connector.ts)

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

### AgentSessionConfig `type`

📍 [`src/core/Agent.ts:42`](src/core/Agent.ts)

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

📍 [`src/core/createProvider.ts:67`](src/core/createProvider.ts)

Create a text provider from a connector

```typescript
export function createProvider(connector: Connector): ITextProvider
```

---

### getVendorDefaultBaseURL `function`

📍 [`src/core/createProvider.ts:60`](src/core/createProvider.ts)

Get the default API base URL for a vendor.
For OpenAI/Anthropic reads from the installed SDK at runtime.
Returns undefined for Custom or unknown vendors.

```typescript
export function getVendorDefaultBaseURL(vendor: string): string | undefined
```

---

### isVendor `function`

📍 [`src/core/Vendor.ts:32`](src/core/Vendor.ts)

Check if a string is a valid vendor

```typescript
export function isVendor(value: string): value is Vendor
```

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

### DocumentImagePiece `interface`

📍 [`src/capabilities/documents/types.ts:43`](src/capabilities/documents/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'image';` | - |
| `base64` | `base64: string;` | - |
| `mimeType` | `mimeType: string;` | - |
| `width?` | `width?: number;` | - |
| `height?` | `height?: number;` | - |
| `metadata` | `metadata: PieceMetadata;` | - |

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

📍 [`src/domain/interfaces/IImageProvider.ts:45`](src/domain/interfaces/IImageProvider.ts)

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

📍 [`src/domain/interfaces/IImageProvider.ts:18`](src/domain/interfaces/IImageProvider.ts)

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

### ImageFilterOptions `interface`

📍 [`src/capabilities/documents/types.ts:108`](src/capabilities/documents/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `minWidth?` | `minWidth?: number;` | Skip images narrower than this (default: 50px) |
| `minHeight?` | `minHeight?: number;` | Skip images shorter than this (default: 50px) |
| `minSizeBytes?` | `minSizeBytes?: number;` | Skip images smaller than this in bytes (default: 1024) |
| `maxImages?` | `maxImages?: number;` | Maximum images to keep (default: 50 at extraction, 20 at content conversion) |
| `excludePatterns?` | `excludePatterns?: RegExp[];` | Exclude images whose filename/label matches these patterns |

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
| `aspectRatio?` | `aspectRatio?: string;` | - |
| `quality?` | `quality?: 'standard' | 'hd' | 'low' | 'medium' | 'high' | 'auto';` | - |
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

📍 [`src/domain/interfaces/IImageProvider.ts:36`](src/domain/interfaces/IImageProvider.ts)

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

📍 [`src/domain/interfaces/IImageProvider.ts:28`](src/domain/interfaces/IImageProvider.ts)

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

Supported aspect ratios

```typescript
type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | '3:2' | '2:3'
```

---

### calculateImageCost `function`

📍 [`src/domain/entities/ImageModel.ts:774`](src/domain/entities/ImageModel.ts)

Calculate estimated cost for image generation

```typescript
export function calculateImageCost(
  modelName: string,
  imageCount: number,
  quality: 'standard' | 'hd' = 'standard'
): number | null
```

---

### createImageGenerationTool `function`

📍 [`src/tools/multimedia/imageGeneration.ts:36`](src/tools/multimedia/imageGeneration.ts)

```typescript
export function createImageGenerationTool(
  connector: Connector,
  storage?: IMediaStorage,
  userId?: string
): ToolFunction&lt;GenerateImageArgs, GenerateImageResult&gt;
```

---

### createImageProvider `function`

📍 [`src/core/createImageProvider.ts:16`](src/core/createImageProvider.ts)

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

📍 [`src/domain/entities/ImageModel.ts:763`](src/domain/entities/ImageModel.ts)

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

📍 [`src/domain/entities/ImageModel.ts:135`](src/domain/entities/ImageModel.ts)

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
      maxImagesPerRequest: 10,
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
        quality: {
          type: 'enum',
          label: 'Quality',
          description: 'Image quality level',
          enum: ['auto', 'low', 'medium', 'high'],
          default: 'auto',
          controlType: 'select',
        },
        background: {
          type: 'enum',
          label: 'Background',
          description: 'Background transparency',
          enum: ['auto', 'transparent', 'opaque'],
          default: 'auto',
          controlType: 'select',
        },
        output_format: {
          type: 'enum',
          label: 'Output Format',
          description: 'Image file format',
          enum: ['png', 'jpeg', 'webp'],
          default: 'png',
          controlType: 'select',
        },
        output_compression: {
          type: 'number',
          label: 'Compression',
          description: 'Compression level for JPEG/WebP (0-100)',
          min: 0,
          max: 100,
          default: 75,
          controlType: 'slider',
        },
        moderation: {
          type: 'enum',
          label: 'Moderation',
          description: 'Content moderation strictness',
          enum: ['auto', 'low'],
          default: 'auto',
          controlType: 'radio',
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
    deprecationDate: '2026-05-12',
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
        quality: {
          type: 'enum',
          label: 'Quality',
          description: 'Image quality: standard or HD',
          enum: ['standard', 'hd'],
          default: 'standard',
          controlType: 'radio',
        },
        style: {
          type: 'enum',
          label: 'Style',
          description: 'Image style: vivid (hyper-real) or natural',
          enum: ['vivid', 'natural'],
          default: 'vivid',
          controlType: 'radio',
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
    deprecationDate: '2026-05-12',
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
      vendorOptions: {},
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
        aspectRatio: {
          type: 'enum',
          label: 'Aspect Ratio',
          description: 'Output image proportions',
          enum: ['1:1', '3:4', '4:3', '16:9', '9:16'],
          default: '1:1',
          controlType: 'select',
        },
        sampleImageSize: {
          type: 'enum',
          label: 'Resolution',
          description: 'Output image resolution',
          enum: ['1K', '2K'],
          default: '1K',
          controlType: 'radio',
        },
        outputMimeType: {
          type: 'enum',
          label: 'Output Format',
          description: 'Image file format',
          enum: ['image/png', 'image/jpeg'],
          default: 'image/png',
          controlType: 'select',
        },
        negativePrompt: {
          type: 'string',
          label: 'Negative Prompt',
          description: 'Elements to avoid in the generated image',
          controlType: 'textarea',
        },
        personGeneration: {
          type: 'enum',
          label: 'Person Generation',
          description: 'Controls whether people can appear in images',
          enum: ['dont_allow', 'allow_adult', 'allow_all'],
          default: 'allow_adult',
          controlType: 'select',
        },
        safetyFilterLevel: {
          type: 'enum',
          label: 'Safety Filter',
          description: 'Content safety filtering threshold',
          enum: ['block_none', 'block_only_high', 'block_medium_and_above', 'block_low_and_above'],
          default: 'block_medium_and_above',
          controlType: 'select',
        },
        enhancePrompt: {
          type: 'boolean',
          label: 'Enhance Prompt',
          description: 'Use LLM-based prompt rewriting for better quality',
          default: true,
          controlType: 'checkbox',
        },
        seed: {
          type: 'number',
          label: 'Seed',
          description: 'Random seed for reproducible generation (1-2147483647)',
          min: 1,
          max: 2147483647,
          controlType: 'text',
        },
        addWatermark: {
          type: 'boolean',
          label: 'Add Watermark',
          description: 'Add invisible SynthID watermark',
          default: true,
          controlType: 'checkbox',
        },
        language: {
          type: 'enum',
          label: 'Prompt Language',
          description: 'Language of the input prompt',
          enum: ['auto', 'en', 'zh', 'zh-CN', 'zh-TW', 'hi', 'ja', 'ko', 'pt', 'es'],
          default: 'en',
          controlType: 'select',
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
      vendorOptions: {
        aspectRatio: {
          type: 'enum',
          label: 'Aspect Ratio',
          description: 'Output image proportions',
          enum: ['1:1', '3:4', '4:3', '16:9', '9:16'],
          default: '1:1',
          controlType: 'select',
        },
        sampleImageSize: {
          type: 'enum',
          label: 'Resolution',
          description: 'Output image resolution',
          enum: ['1K', '2K'],
          default: '1K',
          controlType: 'radio',
        },
        outputMimeType: {
          type: 'enum',
          label: 'Output Format',
          description: 'Image file format',
          enum: ['image/png', 'image/jpeg'],
          default: 'image/png',
          controlType: 'select',
        },
        negativePrompt: {
          type: 'string',
          label: 'Negative Prompt',
          description: 'Elements to avoid in the generated image',
          controlType: 'textarea',
        },
        personGeneration: {
          type: 'enum',
          label: 'Person Generation',
          description: 'Controls whether people can appear in images',
          enum: ['dont_allow', 'allow_adult', 'allow_all'],
          default: 'allow_adult',
          controlType: 'select',
        },
        safetyFilterLevel: {
          type: 'enum',
          label: 'Safety Filter',
          description: 'Content safety filtering threshold',
          enum: ['block_none', 'block_only_high', 'block_medium_and_above', 'block_low_and_above'],
          default: 'block_medium_and_above',
          controlType: 'select',
        },
        enhancePrompt: {
          type: 'boolean',
          label: 'Enhance Prompt',
          description: 'Use LLM-based prompt rewriting for better quality',
          default: true,
          controlType: 'checkbox',
        },
        seed: {
          type: 'number',
          label: 'Seed',
          description: 'Random seed for reproducible generation (1-2147483647)',
          min: 1,
          max: 2147483647,
          controlType: 'text',
        },
        addWatermark: {
          type: 'boolean',
          label: 'Add Watermark',
          description: 'Add invisible SynthID watermark',
          default: true,
          controlType: 'checkbox',
        },
        language: {
          type: 'enum',
          label: 'Prompt Language',
          description: 'Language of the input prompt',
          enum: ['auto', 'en', 'zh', 'zh-CN', 'zh-TW', 'hi', 'ja', 'ko', 'pt', 'es'],
          default: 'en',
          controlType: 'select',
        },
      },
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
      vendorOptions: {
        aspectRatio: {
          type: 'enum',
          label: 'Aspect Ratio',
          description: 'Output image proportions',
          enum: ['1:1', '3:4', '4:3', '16:9', '9:16'],
          default: '1:1',
          controlType: 'select',
        },
        sampleImageSize: {
          type: 'enum',
          label: 'Resolution',
          description: 'Output image resolution',
          enum: ['1K', '2K'],
          default: '1K',
          controlType: 'radio',
        },
        outputMimeType: {
          type: 'enum',
          label: 'Output Format',
          description: 'Image file format',
          enum: ['image/png', 'image/jpeg'],
          default: 'image/png',
          controlType: 'select',
        },
        negativePrompt: {
          type: 'string',
          label: 'Negative Prompt',
          description: 'Elements to avoid in the generated image',
          controlType: 'textarea',
        },
        personGeneration: {
          type: 'enum',
          label: 'Person Generation',
          description: 'Controls whether people can appear in images',
          enum: ['dont_allow', 'allow_adult', 'allow_all'],
          default: 'allow_adult',
          controlType: 'select',
        },
        safetyFilterLevel: {
          type: 'enum',
          label: 'Safety Filter',
          description: 'Content safety filtering threshold',
          enum: ['block_none', 'block_only_high', 'block_medium_and_above', 'block_low_and_above'],
          default: 'block_medium_and_above',
          controlType: 'select',
        },
        enhancePrompt: {
          type: 'boolean',
          label: 'Enhance Prompt',
          description: 'Use LLM-based prompt rewriting for better quality',
          default: true,
          controlType: 'checkbox',
        },
        seed: {
          type: 'number',
          label: 'Seed',
          description: 'Random seed for reproducible generation (1-2147483647)',
          min: 1,
          max: 2147483647,
          controlType: 'text',
        },
        addWatermark: {
          type: 'boolean',
          label: 'Add Watermark',
          description: 'Add invisible SynthID watermark',
          default: true,
          controlType: 'checkbox',
        },
        language: {
          type: 'enum',
          label: 'Prompt Language',
          description: 'Language of the input prompt',
          enum: ['auto', 'en', 'zh', 'zh-CN', 'zh-TW', 'hi', 'ja', 'ko', 'pt', 'es'],
          default: 'en',
          controlType: 'select',
        },
      },
    },
    pricing: {
      perImage: 0.02,
      currency: 'USD',
    },
  }` | - |
| `'grok-imagine-image'` | `{
    name: 'grok-imagine-image',
    displayName: 'Grok Imagine Image',
    provider: Vendor.Grok,
    description: 'xAI Grok Imagine image generation with aspect ratio control and editing support',
    isActive: true,
    releaseDate: '2025-01-01',
    sources: {
      documentation: 'https://docs.x.ai/docs/guides/image-generation',
      pricing: 'https://docs.x.ai/docs/models',
      lastVerified: '2026-02-01',
    },
    capabilities: {
      sizes: ['1024x1024'],
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'],
      maxImagesPerRequest: 10,
      outputFormats: ['png', 'jpeg'],
      features: {
        generation: true,
        editing: true,
        variations: false,
        styleControl: false,
        qualityControl: false, // quality not supported by xAI API
        transparency: false,
        promptRevision: true,
      },
      limits: { maxPromptLength: 4096 },
      vendorOptions: {
        n: {
          type: 'number',
          label: 'Number of Images',
          description: 'Number of images to generate (1-10)',
          min: 1,
          max: 10,
          default: 1,
          controlType: 'slider',
        },
        response_format: {
          type: 'enum',
          label: 'Response Format',
          description: 'Format of the returned image',
          enum: ['url', 'b64_json'],
          default: 'url',
          controlType: 'radio',
        },
      },
    },
    pricing: {
      perImage: 0.02,
      currency: 'USD',
    },
  }` | - |
| `'grok-2-image-1212'` | `{
    name: 'grok-2-image-1212',
    displayName: 'Grok 2 Image',
    provider: Vendor.Grok,
    description: 'xAI Grok 2 image generation (text-only input, no editing)',
    isActive: true,
    releaseDate: '2024-12-12',
    sources: {
      documentation: 'https://docs.x.ai/docs/guides/image-generation',
      pricing: 'https://docs.x.ai/docs/models',
      lastVerified: '2026-02-01',
    },
    capabilities: {
      sizes: ['1024x1024'],
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'],
      maxImagesPerRequest: 10,
      outputFormats: ['png', 'jpeg'],
      features: {
        generation: true,
        editing: false,
        variations: false,
        styleControl: false,
        qualityControl: false, // quality not supported by xAI API
        transparency: false,
        promptRevision: false,
      },
      limits: { maxPromptLength: 4096 },
      vendorOptions: {
        n: {
          type: 'number',
          label: 'Number of Images',
          description: 'Number of images to generate (1-10)',
          min: 1,
          max: 10,
          default: 1,
          controlType: 'slider',
        },
        response_format: {
          type: 'enum',
          label: 'Response Format',
          description: 'Format of the returned image',
          enum: ['url', 'b64_json'],
          default: 'url',
          controlType: 'radio',
        },
      },
    },
    pricing: {
      perImage: 0.07,
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

📍 [`src/domain/entities/VideoModel.ts:58`](src/domain/entities/VideoModel.ts)

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
| `resolutions` | `resolutions: string[];` | Supported resolutions (e.g., '720p', '1080p', '720x1280') |
| `aspectRatios?` | `aspectRatios?: string[];` | Supported aspect ratios (e.g., '16:9', '9:16') - for vendors that use this instead of resolution |
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

📍 [`src/domain/entities/VideoModel.ts:48`](src/domain/entities/VideoModel.ts)

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

📍 [`src/domain/entities/VideoModel.ts:329`](src/domain/entities/VideoModel.ts)

Calculate video generation cost

```typescript
export function calculateVideoCost(modelName: string, durationSeconds: number): number | null
```

---

### createVideoProvider `function`

📍 [`src/core/createVideoProvider.ts:15`](src/core/createVideoProvider.ts)

Create a video provider from a connector

```typescript
export function createVideoProvider(connector: Connector): IVideoProvider
```

---

### createVideoTools `function`

📍 [`src/tools/multimedia/videoGeneration.ts:49`](src/tools/multimedia/videoGeneration.ts)

```typescript
export function createVideoTools(
  connector: Connector,
  storage?: IMediaStorage,
  userId?: string
): ToolFunction[]
```

---

### getVideoModelsWithAudio `function`

📍 [`src/domain/entities/VideoModel.ts:322`](src/domain/entities/VideoModel.ts)

Get models that support audio

```typescript
export function getVideoModelsWithAudio(): IVideoModelDescription[]
```

---

### getVideoModelsWithFeature `function`

📍 [`src/domain/entities/VideoModel.ts:313`](src/domain/entities/VideoModel.ts)

Get models with a specific feature

```typescript
export function getVideoModelsWithFeature(feature: keyof VideoModelCapabilities['features']): IVideoModelDescription[]
```

---

### VIDEO_MODEL_REGISTRY `const`

📍 [`src/domain/entities/VideoModel.ts:112`](src/domain/entities/VideoModel.ts)

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
      resolutions: [], // Veo 2.0 uses aspectRatio only, no resolution control
      aspectRatios: ['16:9', '9:16'],
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
| `'veo-3.1-fast-generate-preview'` | `{
    name: 'veo-3.1-fast-generate-preview',
    displayName: 'Veo 3.1 Fast',
    provider: Vendor.Google,
    isActive: true,
    sources: GOOGLE_SOURCES,
    capabilities: {
      durations: [4, 6, 8],
      resolutions: ['720p'], // Fast model only supports 720p
      aspectRatios: ['16:9', '9:16'],
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
      resolutions: ['720p', '1080p', '4k'], // 1080p and 4k require 8s duration
      aspectRatios: ['16:9', '9:16'],
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
| `'grok-imagine-video'` | `{
    name: 'grok-imagine-video',
    displayName: 'Grok Imagine Video',
    provider: Vendor.Grok,
    isActive: true,
    sources: GROK_SOURCES,
    capabilities: {
      durations: [1, 5, 8, 10, 15],
      resolutions: ['480p', '720p'],
      aspectRatios: ['16:9', '4:3', '1:1', '9:16', '3:4', '3:2', '2:3'],
      maxFps: 24,
      audio: true,
      imageToVideo: true,
      videoExtension: false,
      frameControl: false,
      features: {
        upscaling: false,
        styleControl: false,
        negativePrompt: false,
        seed: true,
      },
    },
    pricing: {
      perSecond: 0.05,
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

### InContextMemoryPluginNextGen `class`

📍 [`src/core/context-nextgen/plugins/InContextMemoryPluginNextGen.ts:159`](src/core/context-nextgen/plugins/InContextMemoryPluginNextGen.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: InContextMemoryConfig =
```

**Parameters:**
- `config`: `InContextMemoryConfig` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `getInstructions()`

```typescript
getInstructions(): string
```

**Returns:** `string`

#### `getContent()`

```typescript
async getContent(): Promise&lt;string | null&gt;
```

**Returns:** `Promise&lt;string | null&gt;`

#### `getContents()`

```typescript
getContents(): Map&lt;string, InContextEntry&gt;
```

**Returns:** `Map&lt;string, InContextEntry&gt;`

#### `getTokenSize()`

```typescript
getTokenSize(): number
```

**Returns:** `number`

#### `getInstructionsTokenSize()`

```typescript
getInstructionsTokenSize(): number
```

**Returns:** `number`

#### `isCompactable()`

```typescript
isCompactable(): boolean
```

**Returns:** `boolean`

#### `compact()`

```typescript
async compact(targetTokensToFree: number): Promise&lt;number&gt;
```

**Parameters:**
- `targetTokensToFree`: `number`

**Returns:** `Promise&lt;number&gt;`

#### `getTools()`

```typescript
getTools(): ToolFunction[]
```

**Returns:** `ToolFunction&lt;any, any&gt;[]`

#### `destroy()`

```typescript
destroy(): void
```

**Returns:** `void`

#### `getState()`

```typescript
getState(): SerializedInContextMemoryState
```

**Returns:** `SerializedInContextMemoryState`

#### `restoreState()`

```typescript
restoreState(state: unknown): void
```

**Parameters:**
- `state`: `unknown`

**Returns:** `void`

#### `set()`

Store or update a key-value pair

```typescript
set(key: string, description: string, value: unknown, priority?: InContextPriority, showInUI?: boolean): void
```

**Parameters:**
- `key`: `string`
- `description`: `string`
- `value`: `unknown`
- `priority`: `InContextPriority | undefined` *(optional)*
- `showInUI`: `boolean | undefined` *(optional)*

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

Delete an entry

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

**Returns:** `{ key: string; description: string; priority: InContextPriority; updatedAt: number; showInUI: boolean; }[]`

#### `clear()`

Clear all entries

```typescript
clear(): void
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "in_context_memory"` | - |
| `entries` | `entries: Map&lt;string, InContextEntry&gt;` | - |
| `config` | `config: { maxEntries: number; maxTotalTokens: number; defaultPriority: InContextPriority; showTimestamps: boolean; onEntriesChanged?: ((entries: InContextEntry[]) =&gt; void) | undefined; }` | - |
| `estimator` | `estimator: ITokenEstimator` | - |

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

📍 [`src/capabilities/taskAgent/WorkingMemory.ts:103`](src/capabilities/taskAgent/WorkingMemory.ts)

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

#### `getMaxIndexEntries()`

Get the configured max index entries limit

```typescript
getMaxIndexEntries(): number | undefined
```

**Returns:** `number | undefined`

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
Respects maxIndexEntries limit for context display

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

#### `serialize()`

Serialize all memory entries for persistence

Returns a serializable representation of all memory entries
that can be saved to storage and restored later.

```typescript
async serialize(): Promise&lt;SerializedMemory&gt;
```

**Returns:** `Promise&lt;SerializedMemory&gt;`

#### `restore()`

Restore memory entries from serialized state

Clears existing memory and repopulates from the serialized state.
Timestamps are reset to current time.

```typescript
async restore(state: SerializedMemory): Promise&lt;void&gt;
```

**Parameters:**
- `state`: `SerializedMemory`

**Returns:** `Promise&lt;void&gt;`

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

### WorkingMemoryPluginNextGen `class`

📍 [`src/core/context-nextgen/plugins/WorkingMemoryPluginNextGen.ts:202`](src/core/context-nextgen/plugins/WorkingMemoryPluginNextGen.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(pluginConfig: WorkingMemoryPluginConfig =
```

**Parameters:**
- `pluginConfig`: `WorkingMemoryPluginConfig` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `getInstructions()`

```typescript
getInstructions(): string
```

**Returns:** `string`

#### `getContent()`

```typescript
async getContent(): Promise&lt;string | null&gt;
```

**Returns:** `Promise&lt;string | null&gt;`

#### `getContents()`

```typescript
getContents(): unknown
```

**Returns:** `unknown`

#### `getTokenSize()`

```typescript
getTokenSize(): number
```

**Returns:** `number`

#### `getInstructionsTokenSize()`

```typescript
getInstructionsTokenSize(): number
```

**Returns:** `number`

#### `isCompactable()`

```typescript
isCompactable(): boolean
```

**Returns:** `boolean`

#### `compact()`

```typescript
async compact(_targetTokensToFree: number): Promise&lt;number&gt;
```

**Parameters:**
- `_targetTokensToFree`: `number`

**Returns:** `Promise&lt;number&gt;`

#### `getTools()`

```typescript
getTools(): ToolFunction[]
```

**Returns:** `ToolFunction&lt;any, any&gt;[]`

#### `destroy()`

```typescript
destroy(): void
```

**Returns:** `void`

#### `getState()`

```typescript
getState(): SerializedWorkingMemoryState
```

**Returns:** `SerializedWorkingMemoryState`

#### `restoreState()`

```typescript
restoreState(state: unknown): void
```

**Parameters:**
- `state`: `unknown`

**Returns:** `void`

#### `store()`

Store a value in memory

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
- `options`: `{ scope?: MemoryScope | undefined; priority?: MemoryPriority | undefined; tier?: MemoryTier | undefined; pinned?: boolean | undefined; } | undefined` *(optional)*

**Returns:** `Promise&lt;{ key: string; sizeBytes: number; }&gt;`

#### `retrieve()`

Retrieve a value from memory

```typescript
async retrieve(key: string): Promise&lt;unknown | undefined&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;unknown&gt;`

#### `delete()`

Delete a key from memory

```typescript
async delete(key: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `query()`

Query memory entries

```typescript
async query(options?:
```

**Parameters:**
- `options`: `{ pattern?: string | undefined; tier?: MemoryTier | undefined; includeValues?: boolean | undefined; includeStats?: boolean | undefined; } | undefined` *(optional)*

**Returns:** `Promise&lt;{ entries: { key: string; description: string; tier?: MemoryTier | undefined; value?: unknown; }[]; stats?: { count: number; totalBytes: number; } | undefined; }&gt;`

#### `formatIndex()`

Format memory index for context

```typescript
async formatIndex(): Promise&lt;string&gt;
```

**Returns:** `Promise&lt;string&gt;`

#### `evict()`

Evict entries to free space

```typescript
async evict(count: number, strategy: EvictionStrategy = 'lru'): Promise&lt;string[]&gt;
```

**Parameters:**
- `count`: `number`
- `strategy`: `EvictionStrategy` *(optional)* (default: `'lru'`)

**Returns:** `Promise&lt;string[]&gt;`

#### `cleanupRaw()`

Cleanup raw tier entries

```typescript
async cleanupRaw(): Promise&lt;
```

**Returns:** `Promise&lt;{ deleted: number; keys: string[]; }&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "working_memory"` | - |
| `storage` | `storage: IMemoryStorage` | - |
| `config` | `config: WorkingMemoryConfig` | - |
| `priorityCalculator` | `priorityCalculator: PriorityCalculator` | - |
| `priorityContext` | `priorityContext: PriorityContext` | - |
| `estimator` | `estimator: ITokenEstimator` | - |

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

📍 [`src/core/context-nextgen/plugins/InContextMemoryPluginNextGen.ts:38`](src/core/context-nextgen/plugins/InContextMemoryPluginNextGen.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxEntries?` | `maxEntries?: number;` | Maximum number of entries (default: 20) |
| `maxTotalTokens?` | `maxTotalTokens?: number;` | Maximum total tokens for all entries (default: 4000) |
| `defaultPriority?` | `defaultPriority?: InContextPriority;` | Default priority for new entries (default: 'normal') |
| `showTimestamps?` | `showTimestamps?: boolean;` | Whether to show timestamps in output (default: false) |
| `onEntriesChanged?` | `onEntriesChanged?: (entries: InContextEntry[]) =&gt; void;` | Callback fired when entries change. Receives all current entries. |

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

📍 [`src/domain/entities/Memory.ts:444`](src/domain/entities/Memory.ts)

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
| `totalEntryCount` | `totalEntryCount: number;` | Total entry count (before any truncation for display) |
| `omittedCount` | `omittedCount: number;` | Number of entries omitted from display due to maxIndexEntries limit |

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

📍 [`src/core/context-nextgen/plugins/InContextMemoryPluginNextGen.ts:51`](src/core/context-nextgen/plugins/InContextMemoryPluginNextGen.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `entries` | `entries: InContextEntry[];` | - |

</details>

---

### SerializedWorkingMemoryState `interface`

📍 [`src/core/context-nextgen/plugins/WorkingMemoryPluginNextGen.ts:154`](src/core/context-nextgen/plugins/WorkingMemoryPluginNextGen.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `version` | `version: number;` | - |
| `entries` | `entries: Array&lt;{
    key: string;
    description: string;
    value: unknown;
    scope: MemoryScope;
    sizeBytes: number;
    basePriority?: MemoryPriority;
    pinned?: boolean;
  }&gt;;` | - |

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

### WorkingMemoryAccess `interface`

📍 [`src/domain/interfaces/IToolContext.ts:25`](src/domain/interfaces/IToolContext.ts)

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

📍 [`src/domain/entities/Memory.ts:424`](src/domain/entities/Memory.ts)

Configuration for working memory

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxSizeBytes?` | `maxSizeBytes?: number;` | Max memory size in bytes. If not set, calculated from model context |
| `maxIndexEntries?` | `maxIndexEntries?: number;` | Max number of entries in the memory index. Excess entries are auto-evicted via LRU. Default: 30 |
| `descriptionMaxLength` | `descriptionMaxLength: number;` | Max description length |
| `softLimitPercent` | `softLimitPercent: number;` | Percentage at which to warn agent |
| `contextAllocationPercent` | `contextAllocationPercent: number;` | Percentage of model context to allocate to memory |

</details>

---

### WorkingMemoryEvents `interface`

📍 [`src/capabilities/taskAgent/WorkingMemory.ts:83`](src/capabilities/taskAgent/WorkingMemory.ts)

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

### WorkingMemoryPluginConfig `interface`

📍 [`src/core/context-nextgen/plugins/WorkingMemoryPluginNextGen.ts:169`](src/core/context-nextgen/plugins/WorkingMemoryPluginNextGen.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `config?` | `config?: WorkingMemoryConfig;` | Memory configuration |
| `storage?` | `storage?: IMemoryStorage;` | Storage backend (default: InMemoryStorage) |
| `priorityCalculator?` | `priorityCalculator?: PriorityCalculator;` | Priority calculator (default: staticPriorityCalculator) |

</details>

---

### EvictionStrategy `type`

📍 [`src/capabilities/taskAgent/WorkingMemory.ts:73`](src/capabilities/taskAgent/WorkingMemory.ts)

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

📍 [`src/domain/entities/Memory.ts:539`](src/domain/entities/Memory.ts)

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

📍 [`src/domain/entities/Memory.ts:487`](src/domain/entities/Memory.ts)

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

📍 [`src/domain/entities/Memory.ts:467`](src/domain/entities/Memory.ts)

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

📍 [`src/domain/entities/Memory.ts:506`](src/domain/entities/Memory.ts)

Default configuration values

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxSizeBytes` | `25 * 1024 * 1024` | - |
| `maxIndexEntries` | `30` | - |
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

## Context Management

Manage context windows and compaction strategies

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

#### `estimateImageTokens()`

Estimate tokens for an image using tile-based model (matches OpenAI pricing).

- detail='low': 85 tokens
- detail='high' with known dimensions: 85 + 170 per 512×512 tile
- Unknown dimensions: 1000 tokens (conservative default)

```typescript
estimateImageTokens(width?: number, height?: number, detail?: string): number
```

**Parameters:**
- `width`: `number | undefined` *(optional)*
- `height`: `number | undefined` *(optional)*
- `detail`: `string | undefined` *(optional)*

**Returns:** `number`

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

### CompactionResult `interface`

📍 [`src/core/context/utils/ContextUtils.ts:76`](src/core/context/utils/ContextUtils.ts)

Result of a compaction operation

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `components` | `components: IContextComponent[];` | Updated components after compaction |
| `log` | `log: string[];` | Log of compaction actions taken |
| `tokensFreed` | `tokensFreed: number;` | Total tokens freed |

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

📍 [`src/core/context/types.ts:184`](src/core/context/types.ts)

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

### IContextStrategy `interface`

📍 [`src/core/context/types.ts:210`](src/core/context/types.ts)

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

### ITokenEstimator `interface`

📍 [`src/core/context/types.ts:123`](src/core/context/types.ts)

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

#### `estimateImageTokens()?`

Estimate tokens for an image.

```typescript
estimateImageTokens?(width?: number, height?: number, detail?: string): number;
```

**Parameters:**
- `width`: `number | undefined` *(optional)*
- `height`: `number | undefined` *(optional)*
- `detail`: `string | undefined` *(optional)*

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

### TokenContentType `type`

📍 [`src/core/context/types.ts:118`](src/core/context/types.ts)

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

📍 [`src/connectors/storage/ConnectorConfigStore.ts:32`](src/connectors/storage/ConnectorConfigStore.ts)

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
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Factory that resolves storage from StorageRegistry when no explicit storage is provided.

```typescript
static create(encryptionKey: string, storage?: IConnectorConfigStorage): ConnectorConfigStore
```

**Parameters:**
- `encryptionKey`: `string`
- `storage`: `IConnectorConfigStorage | undefined` *(optional)*

**Returns:** `ConnectorConfigStore`

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

### FileAgentDefinitionStorage `class`

📍 [`src/infrastructure/storage/FileAgentDefinitionStorage.ts:91`](src/infrastructure/storage/FileAgentDefinitionStorage.ts)

File-based storage for agent definitions

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: FileAgentDefinitionStorageConfig =
```

**Parameters:**
- `config`: `FileAgentDefinitionStorageConfig` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

Save an agent definition

```typescript
async save(definition: StoredAgentDefinition): Promise&lt;void&gt;
```

**Parameters:**
- `definition`: `StoredAgentDefinition`

**Returns:** `Promise&lt;void&gt;`

#### `load()`

Load an agent definition

```typescript
async load(agentId: string): Promise&lt;StoredAgentDefinition | null&gt;
```

**Parameters:**
- `agentId`: `string`

**Returns:** `Promise&lt;StoredAgentDefinition | null&gt;`

#### `delete()`

Delete an agent definition

```typescript
async delete(agentId: string): Promise&lt;void&gt;
```

**Parameters:**
- `agentId`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `exists()`

Check if an agent definition exists

```typescript
async exists(agentId: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `agentId`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `list()`

List all agent definitions

```typescript
async list(options?: AgentDefinitionListOptions): Promise&lt;AgentDefinitionSummary[]&gt;
```

**Parameters:**
- `options`: `AgentDefinitionListOptions | undefined` *(optional)*

**Returns:** `Promise&lt;AgentDefinitionSummary[]&gt;`

#### `updateMetadata()`

Update metadata without loading full definition

```typescript
async updateMetadata(
    agentId: string,
    metadata: Partial&lt;AgentDefinitionMetadata&gt;
  ): Promise&lt;void&gt;
```

**Parameters:**
- `agentId`: `string`
- `metadata`: `Partial&lt;AgentDefinitionMetadata&gt;`

**Returns:** `Promise&lt;void&gt;`

#### `getPath()`

Get storage path

```typescript
getPath(): string
```

**Returns:** `string`

#### `rebuildIndex()`

Rebuild the index by scanning all agent directories

```typescript
async rebuildIndex(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `baseDirectory` | `baseDirectory: string` | - |
| `indexPath` | `indexPath: string` | - |
| `prettyPrint` | `prettyPrint: boolean` | - |
| `index` | `index: DefinitionIndex | null` | - |

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

### FileContextStorage `class`

📍 [`src/infrastructure/storage/FileContextStorage.ts:104`](src/infrastructure/storage/FileContextStorage.ts)

File-based storage for AgentContext session persistence

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: FileContextStorageConfig)
```

**Parameters:**
- `config`: `FileContextStorageConfig`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

Save context state to a session file

```typescript
async save(
    sessionId: string,
    state: SerializedContextState,
    metadata?: ContextSessionMetadata
  ): Promise&lt;void&gt;
```

**Parameters:**
- `sessionId`: `string`
- `state`: `SerializedContextState`
- `metadata`: `ContextSessionMetadata | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `load()`

Load context state from a session file

```typescript
async load(sessionId: string): Promise&lt;StoredContextSession | null&gt;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;StoredContextSession | null&gt;`

#### `delete()`

Delete a session

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

List all sessions (summaries only)

```typescript
async list(options?: ContextStorageListOptions): Promise&lt;ContextSessionSummary[]&gt;
```

**Parameters:**
- `options`: `ContextStorageListOptions | undefined` *(optional)*

**Returns:** `Promise&lt;ContextSessionSummary[]&gt;`

#### `updateMetadata()`

Update session metadata without loading full state

```typescript
async updateMetadata(
    sessionId: string,
    metadata: Partial&lt;ContextSessionMetadata&gt;
  ): Promise&lt;void&gt;
```

**Parameters:**
- `sessionId`: `string`
- `metadata`: `Partial&lt;ContextSessionMetadata&gt;`

**Returns:** `Promise&lt;void&gt;`

#### `getPath()`

Get the storage path (for display/debugging)

```typescript
getPath(): string
```

**Returns:** `string`

#### `getLocation()`

Get a human-readable storage location string (for display/debugging)

```typescript
getLocation(): string
```

**Returns:** `string`

#### `getAgentId()`

Get the agent ID

```typescript
getAgentId(): string
```

**Returns:** `string`

#### `rebuildIndex()`

Rebuild the index by scanning all session files
Useful for recovery or migration

```typescript
async rebuildIndex(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agentId` | `agentId: string` | - |
| `sessionsDirectory` | `sessionsDirectory: string` | - |
| `indexPath` | `indexPath: string` | - |
| `prettyPrint` | `prettyPrint: boolean` | - |
| `index` | `index: SessionIndex | null` | - |

</details>

---

### FileCustomToolStorage `class`

📍 [`src/infrastructure/storage/FileCustomToolStorage.ts:84`](src/infrastructure/storage/FileCustomToolStorage.ts)

File-based storage for custom tool definitions

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: FileCustomToolStorageConfig =
```

**Parameters:**
- `config`: `FileCustomToolStorageConfig` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

Save a custom tool definition

```typescript
async save(definition: CustomToolDefinition): Promise&lt;void&gt;
```

**Parameters:**
- `definition`: `CustomToolDefinition`

**Returns:** `Promise&lt;void&gt;`

#### `load()`

Load a custom tool definition by name

```typescript
async load(name: string): Promise&lt;CustomToolDefinition | null&gt;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;CustomToolDefinition | null&gt;`

#### `delete()`

Delete a custom tool definition

```typescript
async delete(name: string): Promise&lt;void&gt;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `exists()`

Check if a custom tool exists

```typescript
async exists(name: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `list()`

List custom tools (summaries only)

```typescript
async list(options?: CustomToolListOptions): Promise&lt;CustomToolSummary[]&gt;
```

**Parameters:**
- `options`: `CustomToolListOptions | undefined` *(optional)*

**Returns:** `Promise&lt;CustomToolSummary[]&gt;`

#### `updateMetadata()`

Update metadata without loading full definition

```typescript
async updateMetadata(name: string, metadata: Record&lt;string, unknown&gt;): Promise&lt;void&gt;
```

**Parameters:**
- `name`: `string`
- `metadata`: `Record&lt;string, unknown&gt;`

**Returns:** `Promise&lt;void&gt;`

#### `getPath()`

Get storage path

```typescript
getPath(): string
```

**Returns:** `string`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `baseDirectory` | `baseDirectory: string` | - |
| `indexPath` | `indexPath: string` | - |
| `prettyPrint` | `prettyPrint: boolean` | - |
| `index` | `index: CustomToolIndex | null` | - |

</details>

---

### FileMediaStorage `class`

📍 [`src/infrastructure/storage/FileMediaStorage.ts:47`](src/infrastructure/storage/FileMediaStorage.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config?: FileMediaStorageConfig)
```

**Parameters:**
- `config`: `FileMediaStorageConfig | undefined` *(optional)*

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

```typescript
async save(data: Buffer, metadata: MediaStorageMetadata): Promise&lt;MediaStorageResult&gt;
```

**Parameters:**
- `data`: `Buffer&lt;ArrayBufferLike&gt;`
- `metadata`: `MediaStorageMetadata`

**Returns:** `Promise&lt;MediaStorageResult&gt;`

#### `read()`

```typescript
async read(location: string): Promise&lt;Buffer | null&gt;
```

**Parameters:**
- `location`: `string`

**Returns:** `Promise&lt;Buffer&lt;ArrayBufferLike&gt; | null&gt;`

#### `delete()`

```typescript
async delete(location: string): Promise&lt;void&gt;
```

**Parameters:**
- `location`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `exists()`

```typescript
async exists(location: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `location`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `list()`

```typescript
async list(options?: MediaStorageListOptions): Promise&lt;MediaStorageEntry[]&gt;
```

**Parameters:**
- `options`: `MediaStorageListOptions | undefined` *(optional)*

**Returns:** `Promise&lt;MediaStorageEntry[]&gt;`

#### `getPath()`

```typescript
getPath(): string
```

**Returns:** `string`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `outputDir` | `outputDir: string` | - |
| `initialized` | `initialized: boolean` | - |

</details>

---

### FilePersistentInstructionsStorage `class`

📍 [`src/infrastructure/storage/FilePersistentInstructionsStorage.ts:79`](src/infrastructure/storage/FilePersistentInstructionsStorage.ts)

File-based storage for persistent agent instructions

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: FilePersistentInstructionsStorageConfig)
```

**Parameters:**
- `config`: `FilePersistentInstructionsStorageConfig`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `load()`

Load instruction entries from file.
Falls back to legacy .md file migration if JSON not found.

```typescript
async load(): Promise&lt;InstructionEntry[] | null&gt;
```

**Returns:** `Promise&lt;InstructionEntry[] | null&gt;`

#### `save()`

Save instruction entries to file as JSON.
Creates directory if it doesn't exist.
Cleans up legacy .md file if present.

```typescript
async save(entries: InstructionEntry[]): Promise&lt;void&gt;
```

**Parameters:**
- `entries`: `InstructionEntry[]`

**Returns:** `Promise&lt;void&gt;`

#### `delete()`

Delete instructions file (and legacy .md if exists)

```typescript
async delete(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `exists()`

Check if instructions file exists (JSON or legacy .md)

```typescript
async exists(): Promise&lt;boolean&gt;
```

**Returns:** `Promise&lt;boolean&gt;`

#### `getPath()`

Get the file path (for display/debugging)

```typescript
getPath(): string
```

**Returns:** `string`

#### `getAgentId()`

Get the agent ID

```typescript
getAgentId(): string
```

**Returns:** `string`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `directory` | `directory: string` | - |
| `filePath` | `filePath: string` | - |
| `legacyFilePath` | `legacyFilePath: string` | - |
| `agentId` | `agentId: string` | - |

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

### ContextSessionMetadata `interface`

📍 [`src/domain/interfaces/IContextStorage.ts:62`](src/domain/interfaces/IContextStorage.ts)

Session metadata (stored with session)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `title?` | `title?: string;` | Human-readable title |
| `description?` | `description?: string;` | Auto-generated or user-provided description |
| `tags?` | `tags?: string[];` | Tags for filtering |

</details>

---

### ContextSessionSummary `interface`

📍 [`src/domain/interfaces/IContextStorage.ts:39`](src/domain/interfaces/IContextStorage.ts)

Session summary for listing (lightweight, no full state)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `sessionId` | `sessionId: string;` | Session identifier |
| `createdAt` | `createdAt: Date;` | When the session was created |
| `lastSavedAt` | `lastSavedAt: Date;` | When the session was last saved |
| `messageCount` | `messageCount: number;` | Number of messages in history |
| `memoryEntryCount` | `memoryEntryCount: number;` | Number of memory entries |
| `metadata?` | `metadata?: ContextSessionMetadata;` | Optional metadata |

</details>

---

### FileAgentDefinitionStorageConfig `interface`

📍 [`src/infrastructure/storage/FileAgentDefinitionStorage.ts:31`](src/infrastructure/storage/FileAgentDefinitionStorage.ts)

Configuration for FileAgentDefinitionStorage

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `baseDirectory?` | `baseDirectory?: string;` | Override the base directory (default: ~/.oneringai/agents) |
| `prettyPrint?` | `prettyPrint?: boolean;` | Pretty-print JSON (default: true) |

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

### FileContextStorageConfig `interface`

📍 [`src/infrastructure/storage/FileContextStorage.ts:32`](src/infrastructure/storage/FileContextStorage.ts)

Configuration for FileContextStorage

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agentId` | `agentId: string;` | Agent ID (used to create unique storage path) |
| `baseDirectory?` | `baseDirectory?: string;` | Override the base directory (default: ~/.oneringai/agents) |
| `prettyPrint?` | `prettyPrint?: boolean;` | Pretty-print JSON (default: true for debugging, false in production) |

</details>

---

### FileCustomToolStorageConfig `interface`

📍 [`src/infrastructure/storage/FileCustomToolStorage.ts:24`](src/infrastructure/storage/FileCustomToolStorage.ts)

Configuration for FileCustomToolStorage

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `baseDirectory?` | `baseDirectory?: string;` | Override the base directory (default: ~/.oneringai/custom-tools) |
| `prettyPrint?` | `prettyPrint?: boolean;` | Pretty-print JSON (default: true) |

</details>

---

### FileMediaStorageConfig `interface`

📍 [`src/infrastructure/storage/FileMediaStorage.ts:42`](src/infrastructure/storage/FileMediaStorage.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `outputDir?` | `outputDir?: string;` | Directory to store media files. Defaults to `os.tmpdir()/oneringai-media/` |

</details>

---

### FilePersistentInstructionsStorageConfig `interface`

📍 [`src/infrastructure/storage/FilePersistentInstructionsStorage.ts:24`](src/infrastructure/storage/FilePersistentInstructionsStorage.ts)

Configuration for FilePersistentInstructionsStorage

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agentId` | `agentId: string;` | Agent ID (used to create unique storage path) |
| `baseDirectory?` | `baseDirectory?: string;` | Override the base directory (default: ~/.oneringai/agents) |
| `filename?` | `filename?: string;` | Override the filename (default: custom_instructions.json) |

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

### StoredContextSession `interface`

📍 [`src/domain/interfaces/IContextStorage.ts:79`](src/domain/interfaces/IContextStorage.ts)

Full session state wrapper (includes metadata)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `version` | `version: number;` | Format version for migration support |
| `sessionId` | `sessionId: string;` | Session identifier |
| `createdAt` | `createdAt: string;` | When the session was created |
| `lastSavedAt` | `lastSavedAt: string;` | When the session was last saved |
| `state` | `state: SerializedContextState;` | The serialized AgentContext state |
| `metadata` | `metadata: ContextSessionMetadata;` | Session metadata |

</details>

---

### createAgentStorage `function`

📍 [`src/infrastructure/storage/InMemoryStorage.ts:191`](src/infrastructure/storage/InMemoryStorage.ts)

Create agent storage with defaults

```typescript
export function createAgentStorage(options:
```

---

### createFileAgentDefinitionStorage `function`

📍 [`src/infrastructure/storage/FileAgentDefinitionStorage.ts:389`](src/infrastructure/storage/FileAgentDefinitionStorage.ts)

Create a FileAgentDefinitionStorage with default configuration

```typescript
export function createFileAgentDefinitionStorage(
  config?: FileAgentDefinitionStorageConfig
): FileAgentDefinitionStorage
```

---

### createFileContextStorage `function`

📍 [`src/infrastructure/storage/FileContextStorage.ts:496`](src/infrastructure/storage/FileContextStorage.ts)

Create a FileContextStorage for the given agent

```typescript
export function createFileContextStorage(
  agentId: string,
  options?: Omit&lt;FileContextStorageConfig, 'agentId'&gt;
): FileContextStorage
```

**Example:**

```typescript
const storage = createFileContextStorage('my-agent');
const ctx = AgentContext.create({
  model: 'gpt-4',
  storage,
});

// Save session
await ctx.save('session-001', { title: 'My Session' });

// Load session
await ctx.load('session-001');
```

---

### createFileCustomToolStorage `function`

📍 [`src/infrastructure/storage/FileCustomToolStorage.ts:344`](src/infrastructure/storage/FileCustomToolStorage.ts)

Create a FileCustomToolStorage with default configuration

```typescript
export function createFileCustomToolStorage(
  config?: FileCustomToolStorageConfig
): FileCustomToolStorage
```

---

### createFileMediaStorage `function`

📍 [`src/infrastructure/storage/FileMediaStorage.ts:178`](src/infrastructure/storage/FileMediaStorage.ts)

Factory function for creating FileMediaStorage instances

```typescript
export function createFileMediaStorage(config?: FileMediaStorageConfig): FileMediaStorage
```

---

## Tools & Function Calling

Define and execute tools for agents

### ConnectorTools `class`

📍 [`src/tools/connector/ConnectorTools.ts:174`](src/tools/connector/ConnectorTools.ts)

ConnectorTools - Main API for vendor-dependent tools

Usage:
```typescript
// Get all tools for a connector
const tools = ConnectorTools.for('slack');

// Get just the generic API tool
const apiTool = ConnectorTools.genericAPI('github');

// Discover all available connector tools
const allTools = ConnectorTools.discoverAll();

// With scoped registry (access control)
const registry = Connector.scoped({ tenantId: 'acme' });
const tools = ConnectorTools.for('slack', undefined, { registry });
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
static for(connectorOrName: Connector | string, userId?: string, options?: ConnectorToolsOptions): ToolFunction[]
```

**Parameters:**
- `connectorOrName`: `string | Connector`
- `userId`: `string | undefined` *(optional)*
- `options`: `ConnectorToolsOptions | undefined` *(optional)*

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
static discoverAll(userId?: string, options?: ConnectorToolsOptions): Map&lt;string, ToolFunction[]&gt;
```

**Parameters:**
- `userId`: `string | undefined` *(optional)*
- `options`: `ConnectorToolsOptions | undefined` *(optional)*

**Returns:** `Map&lt;string, ToolFunction&lt;any, any&gt;[]&gt;`

#### `static findConnector()`

Find a connector by service type
Returns the first connector matching the service type

```typescript
static findConnector(serviceType: string, options?: ConnectorToolsOptions): Connector | undefined
```

**Parameters:**
- `serviceType`: `string`
- `options`: `ConnectorToolsOptions | undefined` *(optional)*

**Returns:** `Connector | undefined`

#### `static findConnectors()`

Find all connectors for a service type
Useful when you have multiple connectors for the same service

```typescript
static findConnectors(serviceType: string, options?: ConnectorToolsOptions): Connector[]
```

**Parameters:**
- `serviceType`: `string`
- `options`: `ConnectorToolsOptions | undefined` *(optional)*

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

### ToolExecutionPipeline `class`

📍 [`src/core/tool-execution/ToolExecutionPipeline.ts:84`](src/core/tool-execution/ToolExecutionPipeline.ts)

Tool Execution Pipeline

Manages a chain of plugins that can intercept and modify tool execution.

**Example:**

```typescript
const pipeline = new ToolExecutionPipeline();

// Add plugins
pipeline.use(new LoggingPlugin());
pipeline.use(new AnalyticsPlugin());

// Execute tool
const result = await pipeline.execute(myTool, { arg: 'value' });
```

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(options: ToolExecutionPipelineOptions =
```

**Parameters:**
- `options`: `ToolExecutionPipelineOptions` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `use()`

Register a plugin with the pipeline.

If a plugin with the same name is already registered, it will be
unregistered first (calling its onUnregister hook) and replaced.

```typescript
use(plugin: IToolExecutionPlugin): this
```

**Parameters:**
- `plugin`: `IToolExecutionPlugin`

**Returns:** `this`

#### `remove()`

Remove a plugin by name.

```typescript
remove(pluginName: string): boolean
```

**Parameters:**
- `pluginName`: `string`

**Returns:** `boolean`

#### `has()`

Check if a plugin is registered.

```typescript
has(pluginName: string): boolean
```

**Parameters:**
- `pluginName`: `string`

**Returns:** `boolean`

#### `get()`

Get a registered plugin by name.

```typescript
get(pluginName: string): IToolExecutionPlugin | undefined
```

**Parameters:**
- `pluginName`: `string`

**Returns:** `IToolExecutionPlugin | undefined`

#### `list()`

List all registered plugins, sorted by priority.

```typescript
list(): IToolExecutionPlugin[]
```

**Returns:** `IToolExecutionPlugin[]`

#### `execute()`

Execute a tool through the plugin pipeline.

Execution phases:
1. beforeExecute hooks (in priority order, lowest first)
2. Tool execution (if not aborted)
3. afterExecute hooks (in reverse priority order for proper unwinding)
4. onError hooks if any phase fails

```typescript
async execute(tool: ToolFunction, args: unknown): Promise&lt;unknown&gt;
```

**Parameters:**
- `tool`: `ToolFunction&lt;any, any&gt;`
- `args`: `unknown`

**Returns:** `Promise&lt;unknown&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `plugins` | `plugins: Map&lt;string, IToolExecutionPlugin&gt;` | - |
| `sortedPlugins` | `sortedPlugins: IToolExecutionPlugin[]` | - |
| `useRandomUUID` | `useRandomUUID: boolean` | - |

</details>

---

### ToolManager `class`

📍 [`src/core/ToolManager.ts:207`](src/core/ToolManager.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config?: ToolManagerConfig)
```

**Parameters:**
- `config`: `ToolManagerConfig | undefined` *(optional)*

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

Execute a tool function with circuit breaker protection and plugin pipeline.
Implements IToolExecutor interface.

Execution flow:
1. Validate tool exists and is enabled
2. Check circuit breaker state
3. Run through plugin pipeline (beforeExecute -> execute -> afterExecute)
4. Update metrics and circuit breaker state

Simple execution - no caching, no parent context.
Context must be set via setToolContext() before calling.

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
| `pipeline` | `pipeline: ToolExecutionPipeline` | - |

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
2. Register an 'approve:tool' hook in the Agent
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

### ToolRegistry `class`

📍 [`src/tools/ToolRegistry.ts:43`](src/tools/ToolRegistry.ts)

Unified tool registry that combines built-in and connector tools

<details>
<summary><strong>Static Methods</strong></summary>

#### `static getBuiltInTools()`

Get built-in tools only (from registry.generated.ts)

```typescript
static getBuiltInTools(): ToolRegistryEntry[]
```

**Returns:** `ToolRegistryEntry[]`

#### `static getConnectorTools()`

Get tools for a specific connector

```typescript
static getConnectorTools(connectorName: string): ConnectorToolEntry[]
```

**Parameters:**
- `connectorName`: `string`

**Returns:** `ConnectorToolEntry[]`

#### `static getAllConnectorTools()`

Get all connector tools from all registered service connectors

This discovers tools from all connectors that have:
- Explicit serviceType, OR
- baseURL but no vendor (external API, not AI provider)

```typescript
static getAllConnectorTools(): ConnectorToolEntry[]
```

**Returns:** `ConnectorToolEntry[]`

#### `static getAllTools()`

Get ALL tools (built-in + connector) - main API for UIs

This is the primary method for getting a complete list of available tools.

```typescript
static getAllTools(): (ToolRegistryEntry | ConnectorToolEntry)[]
```

**Returns:** `(ToolRegistryEntry | ConnectorToolEntry)[]`

#### `static getToolsByService()`

Get tools filtered by service type

```typescript
static getToolsByService(serviceType: string): ConnectorToolEntry[]
```

**Parameters:**
- `serviceType`: `string`

**Returns:** `ConnectorToolEntry[]`

#### `static getToolsByConnector()`

Get tools filtered by connector name

```typescript
static getToolsByConnector(connectorName: string): ConnectorToolEntry[]
```

**Parameters:**
- `connectorName`: `string`

**Returns:** `ConnectorToolEntry[]`

#### `static isConnectorTool()`

Check if a tool entry is a connector tool

```typescript
static isConnectorTool(entry: ToolRegistryEntry | ConnectorToolEntry): entry is ConnectorToolEntry
```

**Parameters:**
- `entry`: `ToolRegistryEntry | ConnectorToolEntry`

**Returns:** `boolean`

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

### ConnectorToolEntry `interface`

📍 [`src/tools/ToolRegistry.ts:33`](src/tools/ToolRegistry.ts)

Extended registry entry for connector-generated tools

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `connectorName` | `connectorName: string;` | Name of the connector that generated this tool |
| `serviceType?` | `serviceType?: string;` | Service type (e.g., 'github', 'slack') if detected |

</details>

---

### ConnectorToolsOptions `interface`

📍 [`src/tools/connector/ConnectorTools.ts:150`](src/tools/connector/ConnectorTools.ts)

Options for ConnectorTools methods that accept a scoped registry

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `registry?` | `registry?: IConnectorRegistry;` | Optional scoped registry for access-controlled connector lookup |

</details>

---

### CustomToolDefinition `interface`

📍 [`src/domain/entities/CustomToolDefinition.ts:54`](src/domain/entities/CustomToolDefinition.ts)

Full custom tool definition - everything needed to hydrate into a ToolFunction

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `version` | `version: number;` | Format version for migration support |
| `name` | `name: string;` | Unique tool name (must match /^[a-z][a-z0-9_]*$/) |
| `displayName?` | `displayName?: string;` | Human-readable display name |
| `description` | `description: string;` | Description of what the tool does |
| `inputSchema` | `inputSchema: Record&lt;string, unknown&gt;;` | JSON Schema for input parameters |
| `outputSchema?` | `outputSchema?: Record&lt;string, unknown&gt;;` | JSON Schema for output (documentation only) |
| `code` | `code: string;` | JavaScript code to execute in VM sandbox |
| `createdAt` | `createdAt: string;` | When the definition was created |
| `updatedAt` | `updatedAt: string;` | When the definition was last updated |
| `metadata?` | `metadata?: CustomToolMetadata;` | Optional metadata |

</details>

---

### CustomToolListOptions `interface`

📍 [`src/domain/interfaces/ICustomToolStorage.ts:14`](src/domain/interfaces/ICustomToolStorage.ts)

Options for listing custom tools

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `tags?` | `tags?: string[];` | Filter by tags (any match) |
| `category?` | `category?: string;` | Filter by category |
| `search?` | `search?: string;` | Search string (case-insensitive substring match on name + description) |
| `limit?` | `limit?: number;` | Maximum number of results |
| `offset?` | `offset?: number;` | Offset for pagination |

</details>

---

### CustomToolMetadata `interface`

📍 [`src/domain/entities/CustomToolDefinition.ts:32`](src/domain/entities/CustomToolDefinition.ts)

Metadata for a custom tool

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `tags?` | `tags?: string[];` | Tags for categorization and search |
| `category?` | `category?: string;` | Category grouping |
| `author?` | `author?: string;` | Author/creator identifier |
| `generationPrompt?` | `generationPrompt?: string;` | The prompt that was used to generate this tool |
| `testCases?` | `testCases?: CustomToolTestCase[];` | Test cases for validation |
| `requiresConnector?` | `requiresConnector?: boolean;` | Whether this tool requires a connector to function |
| `connectorNames?` | `connectorNames?: string[];` | Connector names this tool uses |

</details>

---

### CustomToolMetaToolsOptions `interface`

📍 [`src/tools/custom-tools/factories.ts:17`](src/tools/custom-tools/factories.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `storage?` | `storage?: ICustomToolStorage;` | Custom storage backend. Default: FileCustomToolStorage |

</details>

---

### CustomToolSummary `interface`

📍 [`src/domain/entities/CustomToolDefinition.ts:80`](src/domain/entities/CustomToolDefinition.ts)

Lightweight summary of a custom tool (no code) - used for listing

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string;` | Tool name |
| `displayName?` | `displayName?: string;` | Human-readable display name |
| `description` | `description: string;` | Description |
| `createdAt` | `createdAt: string;` | When created |
| `updatedAt` | `updatedAt: string;` | When last updated |
| `metadata?` | `metadata?: CustomToolMetadata;` | Optional metadata |

</details>

---

### CustomToolTestCase `interface`

📍 [`src/domain/entities/CustomToolDefinition.ts:16`](src/domain/entities/CustomToolDefinition.ts)

Test case for a custom tool

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `label` | `label: string;` | Human-readable label for this test case |
| `input` | `input: unknown;` | Input to pass to the tool |
| `expectedOutput?` | `expectedOutput?: unknown;` | Expected output (for validation) |
| `lastResult?` | `lastResult?: unknown;` | Result from last test run |
| `lastError?` | `lastError?: string;` | Error from last test run |

</details>

---

### DesktopToolConfig `interface`

📍 [`src/tools/desktop/types.ts:91`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `driver?` | `driver?: IDesktopDriver;` | Custom driver implementation (defaults to NutTreeDriver) |
| `humanDelay?` | `humanDelay?: [number, number];` | Human-like delay range in ms added between actions.
Set to [0, 0] for instant actions.
Default: [50, 150] |
| `humanizeMovement?` | `humanizeMovement?: boolean;` | Whether to humanize mouse movements (curved path vs instant teleport).
Default: false |

</details>

---

### FilesystemToolConfig `interface`

📍 [`src/tools/filesystem/types.ts:14`](src/tools/filesystem/types.ts)

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
| `documentReaderConfig?` | `documentReaderConfig?: DocumentReaderConfig;` | Document reader config for non-text file formats (PDF, DOCX, XLSX, etc.).
When set, read_file will automatically convert binary document formats to markdown. |

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

📍 [`src/tools/connector/ConnectorTools.ts:129`](src/tools/connector/ConnectorTools.ts)

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

📍 [`src/tools/connector/ConnectorTools.ts:140`](src/tools/connector/ConnectorTools.ts)

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

📍 [`src/tools/connector/ConnectorTools.ts:115`](src/tools/connector/ConnectorTools.ts)

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

### ICustomToolStorage `interface`

📍 [`src/domain/interfaces/ICustomToolStorage.ts:33`](src/domain/interfaces/ICustomToolStorage.ts)

Storage interface for custom tool definitions

Implementations:
- FileCustomToolStorage: File-based storage at ~/.oneringai/custom-tools/

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

Save a custom tool definition

```typescript
save(definition: CustomToolDefinition): Promise&lt;void&gt;;
```

**Parameters:**
- `definition`: `CustomToolDefinition`

**Returns:** `Promise&lt;void&gt;`

#### `load()`

Load a custom tool definition by name

```typescript
load(name: string): Promise&lt;CustomToolDefinition | null&gt;;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;CustomToolDefinition | null&gt;`

#### `delete()`

Delete a custom tool definition by name

```typescript
delete(name: string): Promise&lt;void&gt;;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `exists()`

Check if a custom tool exists

```typescript
exists(name: string): Promise&lt;boolean&gt;;
```

**Parameters:**
- `name`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `list()`

List custom tools (summaries only)

```typescript
list(options?: CustomToolListOptions): Promise&lt;CustomToolSummary[]&gt;;
```

**Parameters:**
- `options`: `CustomToolListOptions | undefined` *(optional)*

**Returns:** `Promise&lt;CustomToolSummary[]&gt;`

#### `updateMetadata()?`

Update metadata without loading full definition

```typescript
updateMetadata?(name: string, metadata: Record&lt;string, unknown&gt;): Promise&lt;void&gt;;
```

**Parameters:**
- `name`: `string`
- `metadata`: `Record&lt;string, unknown&gt;`

**Returns:** `Promise&lt;void&gt;`

#### `getPath()`

Get the storage path/location (for display/debugging)

```typescript
getPath(): string;
```

**Returns:** `string`

</details>

---

### IToolExecutionPipeline `interface`

📍 [`src/core/tool-execution/types.ts:145`](src/core/tool-execution/types.ts)

Pipeline interface for managing and executing plugins.

<details>
<summary><strong>Methods</strong></summary>

#### `use()`

Register a plugin with the pipeline.
If a plugin with the same name exists, it will be replaced.

```typescript
use(plugin: IToolExecutionPlugin): this;
```

**Parameters:**
- `plugin`: `IToolExecutionPlugin`

**Returns:** `this`

#### `remove()`

Remove a plugin by name.

```typescript
remove(pluginName: string): boolean;
```

**Parameters:**
- `pluginName`: `string`

**Returns:** `boolean`

#### `has()`

Check if a plugin is registered.

```typescript
has(pluginName: string): boolean;
```

**Parameters:**
- `pluginName`: `string`

**Returns:** `boolean`

#### `get()`

Get a registered plugin by name.

```typescript
get(pluginName: string): IToolExecutionPlugin | undefined;
```

**Parameters:**
- `pluginName`: `string`

**Returns:** `IToolExecutionPlugin | undefined`

#### `list()`

List all registered plugins (sorted by priority).

```typescript
list(): IToolExecutionPlugin[];
```

**Returns:** `IToolExecutionPlugin[]`

#### `execute()`

Execute a tool through the plugin pipeline.

```typescript
execute(tool: ToolFunction, args: unknown): Promise&lt;unknown&gt;;
```

**Parameters:**
- `tool`: `ToolFunction&lt;any, any&gt;`
- `args`: `unknown`

**Returns:** `Promise&lt;unknown&gt;`

</details>

---

### IToolExecutionPlugin `interface`

📍 [`src/core/tool-execution/types.ts:78`](src/core/tool-execution/types.ts)

Plugin interface for extending tool execution.

Plugins can hook into the execution lifecycle to:
- Modify arguments before execution
- Transform results after execution
- Handle errors
- Emit side effects (logging, UI updates, analytics)

**Example:**

```typescript
class MyPlugin implements IToolExecutionPlugin {
  readonly name = 'my-plugin';
  readonly priority = 100;

  async beforeExecute(ctx: PluginExecutionContext) {
    console.log(`Starting ${ctx.toolName}`);
  }

  async afterExecute(ctx: PluginExecutionContext, result: unknown) {
    console.log(`Finished ${ctx.toolName} in ${Date.now() - ctx.startTime}ms`);
    return result;
  }
}
```

<details>
<summary><strong>Methods</strong></summary>

#### `beforeExecute()?`

Called before tool execution.

Can:
- Return void to continue with original args
- Return `{ modifiedArgs }` to continue with modified args
- Return `{ abort: true, result }` to short-circuit and return immediately

```typescript
beforeExecute?(ctx: PluginExecutionContext): Promise&lt;BeforeExecuteResult&gt;;
```

**Parameters:**
- `ctx`: `PluginExecutionContext`

**Returns:** `Promise&lt;BeforeExecuteResult&gt;`

#### `afterExecute()?`

Called after successful tool execution.

Can transform or replace the result. Must return the (possibly modified) result.
Hooks run in reverse priority order for proper stack-like unwinding.

```typescript
afterExecute?(ctx: PluginExecutionContext, result: unknown): Promise&lt;unknown&gt;;
```

**Parameters:**
- `ctx`: `PluginExecutionContext`
- `result`: `unknown`

**Returns:** `Promise&lt;unknown&gt;`

#### `onError()?`

Called when tool execution fails.

Can:
- Return undefined to let error propagate to next plugin/caller
- Return a value to recover from the error (returned as the result)
- Throw a different error

```typescript
onError?(ctx: PluginExecutionContext, error: Error): Promise&lt;unknown&gt;;
```

**Parameters:**
- `ctx`: `PluginExecutionContext`
- `error`: `Error`

**Returns:** `Promise&lt;unknown&gt;`

#### `onRegister()?`

Called when plugin is registered with a pipeline.
Use for setup that requires pipeline reference.

```typescript
onRegister?(pipeline: IToolExecutionPipeline): void;
```

**Parameters:**
- `pipeline`: `IToolExecutionPipeline`

**Returns:** `void`

#### `onUnregister()?`

Called when plugin is unregistered from a pipeline.
Use for cleanup.

```typescript
onUnregister?(): void;
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `readonly name: string;` | Unique plugin name (used for registration and lookup) |
| `priority?` | `readonly priority?: number;` | Execution priority. Lower values run earlier in beforeExecute,
later in afterExecute (for proper unwinding).
Default: 100 |

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

📍 [`src/core/ToolManager.ts:167`](src/core/ToolManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `enabled: Record&lt;string, boolean&gt;;` | - |
| `namespaces` | `namespaces: Record&lt;string, string&gt;;` | - |
| `priorities` | `priorities: Record&lt;string, number&gt;;` | - |
| `permissions?` | `permissions?: Record&lt;string, ToolPermissionConfig&gt;;` | Permission configs by tool name |
| `tags?` | `tags?: Record&lt;string, string[]&gt;;` | Tags by tool name |
| `categories?` | `categories?: Record&lt;string, string&gt;;` | Categories by tool name |
| `sources?` | `sources?: Record&lt;string, ToolSource&gt;;` | Sources by tool name |

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

📍 [`src/core/ToolManager.ts:108`](src/core/ToolManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'mode' | 'context' | 'custom';` | - |
| `predicate` | `predicate: (context: ToolSelectionContext) =&gt; boolean;` | - |

</details>

---

### ToolContext `interface`

📍 [`src/domain/interfaces/IToolContext.ts:72`](src/domain/interfaces/IToolContext.ts)

Context passed to tool execute function

Simple and clean - only what tools actually need.

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agentId?` | `agentId?: string;` | Agent ID (for logging/tracing) |
| `taskId?` | `taskId?: string;` | Task ID (if running in TaskAgent) |
| `userId?` | `userId?: string;` | User ID — auto-populated from Agent config (userId). Also settable manually via agent.tools.setToolContext(). |
| `connectorRegistry?` | `connectorRegistry?: IConnectorRegistry;` | Connector registry scoped to this agent's allowed connectors and userId |
| `memory?` | `memory?: WorkingMemoryAccess;` | Working memory access (if agent has memory feature enabled) |
| `signal?` | `signal?: AbortSignal;` | Abort signal for cancellation |

</details>

---

### ToolExecutionContext `interface`

📍 [`src/domain/entities/Tool.ts:72`](src/domain/entities/Tool.ts)

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

### ToolExecutionPipelineOptions `interface`

📍 [`src/core/tool-execution/types.ts:195`](src/core/tool-execution/types.ts)

Options for creating a ToolExecutionPipeline

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `useRandomUUID?` | `useRandomUUID?: boolean;` | Whether to generate unique execution IDs using crypto.randomUUID().
If false, uses a simpler counter-based ID.
Default: true (if crypto.randomUUID is available) |

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

📍 [`src/domain/entities/Tool.ts:155`](src/domain/entities/Tool.ts)

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
| `descriptionFactory?` | `descriptionFactory?: (context?: ToolContext) =&gt; string;` | Dynamic description generator for the tool.
If provided, this function is called when tool definitions are serialized for the LLM,
allowing the description to reflect current state (e.g., available connectors).

The returned string replaces definition.function.description when sending to LLM.
The static description in definition.function.description serves as a fallback. |
| `describeCall?` | `describeCall?: (args: TArgs) =&gt; string;` | Returns a human-readable description of a tool call.
Used for logging, UI display, and debugging. |

</details>

---

### ToolManagerConfig `interface`

📍 [`src/core/ToolManager.ts:197`](src/core/ToolManager.ts)

Configuration for ToolManager

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `toolExecutionTimeout?` | `toolExecutionTimeout?: number;` | Hard timeout in milliseconds for any single tool execution.
Acts as a safety net: if a tool's own timeout mechanism fails
(e.g. child process doesn't exit), this will force-resolve with an error.
Default: 0 (disabled - relies on tool's own timeout) |

</details>

---

### ToolManagerStats `interface`

📍 [`src/core/ToolManager.ts:157`](src/core/ToolManager.ts)

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

📍 [`src/core/ToolManager.ts:147`](src/core/ToolManager.ts)

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

📍 [`src/core/ToolManager.ts:89`](src/core/ToolManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `enabled?` | `enabled?: boolean;` | Whether the tool is enabled. Default: true |
| `namespace?` | `namespace?: string;` | Namespace for grouping related tools. Default: 'default' |
| `priority?` | `priority?: number;` | Priority for selection ordering. Higher = preferred. Default: 0 |
| `conditions?` | `conditions?: ToolCondition[];` | Conditions for auto-enable/disable |
| `permission?` | `permission?: ToolPermissionConfig;` | Permission configuration override. If not set, uses tool's config or defaults. |
| `tags?` | `tags?: string[];` | Tags for categorization and search |
| `category?` | `category?: string;` | Category grouping |
| `source?` | `source?: ToolSource;` | Source identifier (built-in, connector, custom, mcp, etc.) |

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

📍 [`src/domain/entities/Tool.ts:119`](src/domain/entities/Tool.ts)

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

📍 [`src/core/ToolManager.ts:128`](src/core/ToolManager.ts)

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
| `tags?` | `tags?: string[];` | Tags for categorization and search |
| `category?` | `category?: string;` | Category grouping |
| `source?` | `source?: ToolSource;` | Source identifier (built-in, connector, custom, mcp, etc.) |

</details>

---

### ToolRegistryEntry `interface`

📍 [`src/tools/registry.generated.ts:44`](src/tools/registry.generated.ts)

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
| `tool_name?` | `tool_name?: string;` | - |
| `tool_args?` | `tool_args?: Record&lt;string, unknown&gt;;` | - |
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
| `__images?` | `__images?: Array&lt;{ base64: string; mediaType: string }&gt;;` | Images extracted from tool results via the __images convention.
Stored separately from `content` so they don't inflate text-based token counts.
Provider converters read this field to inject native multimodal image blocks. |

</details>

---

### ToolSelectionContext `interface`

📍 [`src/core/ToolManager.ts:113`](src/core/ToolManager.ts)

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

📍 [`src/core/permissions/types.ts:354`](src/core/permissions/types.ts)

Type for default allowlisted tools

```typescript
type DefaultAllowlistedTool = (typeof DEFAULT_ALLOWLIST)[number]
```

---

### DesktopToolName `type`

📍 [`src/tools/desktop/types.ts:277`](src/tools/desktop/types.ts)

```typescript
type DesktopToolName = (typeof DESKTOP_TOOL_NAMES)[number]
```

---

### ServiceToolFactory `type`

📍 [`src/tools/connector/ConnectorTools.ts:110`](src/tools/connector/ConnectorTools.ts)

Factory function type for creating service-specific tools.
Takes a Connector and returns an array of tools that use it.

The `userId` parameter is a legacy fallback — tools should prefer reading
userId from ToolContext at execution time (auto-populated by Agent).
Factory userId is used as fallback when ToolContext is not available.

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

📍 [`src/tools/registry.generated.ts:41`](src/tools/registry.generated.ts)

Tool category for grouping

```typescript
type ToolCategory = 'filesystem' | 'shell' | 'web' | 'code' | 'json' | 'connector' | 'desktop' | 'custom-tools' | 'other'
```

---

### ToolManagerEvent `type`

📍 [`src/core/ToolManager.ts:181`](src/core/ToolManager.ts)

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

### ToolSource `type`

📍 [`src/core/ToolManager.ts:45`](src/core/ToolManager.ts)

Source identifier for a registered tool

```typescript
type ToolSource = 'built-in' | 'connector' | 'custom' | 'mcp' | string
```

---

### createBashTool `function`

📍 [`src/tools/shell/bash.ts:51`](src/tools/shell/bash.ts)

Create a Bash tool with the given configuration

```typescript
export function createBashTool(config: ShellToolConfig =
```

---

### createCreatePRTool `function`

📍 [`src/tools/github/createPR.ts:44`](src/tools/github/createPR.ts)

Create a GitHub create_pr tool

```typescript
export function createCreatePRTool(
  connector: Connector,
  userId?: string
): ToolFunction&lt;CreatePRArgs, GitHubCreatePRResult&gt;
```

---

### createCustomToolDelete `function`

📍 [`src/tools/custom-tools/customToolDelete.ts:20`](src/tools/custom-tools/customToolDelete.ts)

```typescript
export function createCustomToolDelete(storage?: ICustomToolStorage): ToolFunction&lt;DeleteArgs, DeleteResult&gt;
```

---

### createCustomToolDraft `function`

📍 [`src/tools/custom-tools/customToolDraft.ts:43`](src/tools/custom-tools/customToolDraft.ts)

```typescript
export function createCustomToolDraft(): ToolFunction&lt;DraftArgs, DraftResult&gt;
```

---

### createCustomToolList `function`

📍 [`src/tools/custom-tools/customToolList.ts:24`](src/tools/custom-tools/customToolList.ts)

```typescript
export function createCustomToolList(storage?: ICustomToolStorage): ToolFunction&lt;ListArgs, ListResult&gt;
```

---

### createCustomToolLoad `function`

📍 [`src/tools/custom-tools/customToolLoad.ts:21`](src/tools/custom-tools/customToolLoad.ts)

```typescript
export function createCustomToolLoad(storage?: ICustomToolStorage): ToolFunction&lt;LoadArgs, LoadResult&gt;
```

---

### createCustomToolMetaTools `function`

📍 [`src/tools/custom-tools/factories.ts:37`](src/tools/custom-tools/factories.ts)

Create all 6 custom tool meta-tools as an array.

```typescript
export function createCustomToolMetaTools(options?: CustomToolMetaToolsOptions): ToolFunction[]
```

**Example:**

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [
    ...createCustomToolMetaTools(),
    ...otherTools,
  ],
});
```

---

### createCustomToolSave `function`

📍 [`src/tools/custom-tools/customToolSave.ts:32`](src/tools/custom-tools/customToolSave.ts)

```typescript
export function createCustomToolSave(storage?: ICustomToolStorage): ToolFunction&lt;SaveArgs, SaveResult&gt;
```

---

### createCustomToolTest `function`

📍 [`src/tools/custom-tools/customToolTest.ts:32`](src/tools/custom-tools/customToolTest.ts)

```typescript
export function createCustomToolTest(): ToolFunction&lt;TestArgs, TestResult&gt;
```

---

### createDesktopGetCursorTool `function`

📍 [`src/tools/desktop/getCursor.ts:11`](src/tools/desktop/getCursor.ts)

```typescript
export function createDesktopGetCursorTool(config?: DesktopToolConfig): ToolFunction&lt;Record&lt;string, never&gt;, DesktopGetCursorResult&gt;
```

---

### createDesktopGetScreenSizeTool `function`

📍 [`src/tools/desktop/getScreenSize.ts:11`](src/tools/desktop/getScreenSize.ts)

```typescript
export function createDesktopGetScreenSizeTool(config?: DesktopToolConfig): ToolFunction&lt;Record&lt;string, never&gt;, DesktopGetScreenSizeResult&gt;
```

---

### createDesktopKeyboardKeyTool `function`

📍 [`src/tools/desktop/keyboardKey.ts:12`](src/tools/desktop/keyboardKey.ts)

```typescript
export function createDesktopKeyboardKeyTool(config?: DesktopToolConfig): ToolFunction&lt;DesktopKeyboardKeyArgs, DesktopKeyboardKeyResult&gt;
```

---

### createDesktopKeyboardTypeTool `function`

📍 [`src/tools/desktop/keyboardType.ts:12`](src/tools/desktop/keyboardType.ts)

```typescript
export function createDesktopKeyboardTypeTool(config?: DesktopToolConfig): ToolFunction&lt;DesktopKeyboardTypeArgs, DesktopKeyboardTypeResult&gt;
```

---

### createDesktopMouseClickTool `function`

📍 [`src/tools/desktop/mouseClick.ts:13`](src/tools/desktop/mouseClick.ts)

```typescript
export function createDesktopMouseClickTool(config?: DesktopToolConfig): ToolFunction&lt;DesktopMouseClickArgs, DesktopMouseClickResult&gt;
```

---

### createDesktopMouseDragTool `function`

📍 [`src/tools/desktop/mouseDrag.ts:12`](src/tools/desktop/mouseDrag.ts)

```typescript
export function createDesktopMouseDragTool(config?: DesktopToolConfig): ToolFunction&lt;DesktopMouseDragArgs, DesktopMouseDragResult&gt;
```

---

### createDesktopMouseMoveTool `function`

📍 [`src/tools/desktop/mouseMove.ts:13`](src/tools/desktop/mouseMove.ts)

```typescript
export function createDesktopMouseMoveTool(config?: DesktopToolConfig): ToolFunction&lt;DesktopMouseMoveArgs, DesktopMouseMoveResult&gt;
```

---

### createDesktopMouseScrollTool `function`

📍 [`src/tools/desktop/mouseScroll.ts:12`](src/tools/desktop/mouseScroll.ts)

```typescript
export function createDesktopMouseScrollTool(config?: DesktopToolConfig): ToolFunction&lt;DesktopMouseScrollArgs, DesktopMouseScrollResult&gt;
```

---

### createDesktopScreenshotTool `function`

📍 [`src/tools/desktop/screenshot.ts:12`](src/tools/desktop/screenshot.ts)

```typescript
export function createDesktopScreenshotTool(config?: DesktopToolConfig): ToolFunction&lt;DesktopScreenshotArgs, DesktopScreenshotResult&gt;
```

---

### createDesktopWindowFocusTool `function`

📍 [`src/tools/desktop/windowFocus.ts:11`](src/tools/desktop/windowFocus.ts)

```typescript
export function createDesktopWindowFocusTool(config?: DesktopToolConfig): ToolFunction&lt;DesktopWindowFocusArgs, DesktopWindowFocusResult&gt;
```

---

### createDesktopWindowListTool `function`

📍 [`src/tools/desktop/windowList.ts:11`](src/tools/desktop/windowList.ts)

```typescript
export function createDesktopWindowListTool(config?: DesktopToolConfig): ToolFunction&lt;Record&lt;string, never&gt;, DesktopWindowListResult&gt;
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

📍 [`src/tools/code/executeJavaScript.ts:165`](src/tools/code/executeJavaScript.ts)

Create an execute_javascript tool.

The tool uses `descriptionFactory` to generate a dynamic description that
always reflects the connectors available to the current user. Connector
visibility is determined by the global access policy (if set) scoped by
the agent's userId from ToolContext.

```typescript
export function createExecuteJavaScriptTool(
  options?: ExecuteJavaScriptToolOptions,
): ToolFunction&lt;ExecuteJSArgs, ExecuteJSResult&gt;
```

---

### createGetPRTool `function`

📍 [`src/tools/github/getPR.ts:29`](src/tools/github/getPR.ts)

Create a GitHub get_pr tool

```typescript
export function createGetPRTool(
  connector: Connector,
  userId?: string
): ToolFunction&lt;GetPRArgs, GitHubGetPRResult&gt;
```

---

### createGitHubReadFileTool `function`

📍 [`src/tools/github/readFile.ts:40`](src/tools/github/readFile.ts)

Create a GitHub read_file tool

```typescript
export function createGitHubReadFileTool(
  connector: Connector,
  userId?: string
): ToolFunction&lt;GitHubReadFileArgs, GitHubReadFileResult&gt;
```

---

### createGlobTool `function`

📍 [`src/tools/filesystem/glob.ts:126`](src/tools/filesystem/glob.ts)

Create a Glob tool with the given configuration

```typescript
export function createGlobTool(config: FilesystemToolConfig =
```

---

### createGrepTool `function`

📍 [`src/tools/filesystem/grep.ts:193`](src/tools/filesystem/grep.ts)

Create a Grep tool with the given configuration

```typescript
export function createGrepTool(config: FilesystemToolConfig =
```

---

### createListDirectoryTool `function`

📍 [`src/tools/filesystem/listDirectory.ts:139`](src/tools/filesystem/listDirectory.ts)

Create a List Directory tool with the given configuration

```typescript
export function createListDirectoryTool(config: FilesystemToolConfig =
```

---

### createPRCommentsTool `function`

📍 [`src/tools/github/prComments.ts:33`](src/tools/github/prComments.ts)

Create a GitHub pr_comments tool

```typescript
export function createPRCommentsTool(
  connector: Connector,
  userId?: string
): ToolFunction&lt;PRCommentsArgs, GitHubPRCommentsResult&gt;
```

---

### createPRFilesTool `function`

📍 [`src/tools/github/prFiles.ts:29`](src/tools/github/prFiles.ts)

Create a GitHub pr_files tool

```typescript
export function createPRFilesTool(
  connector: Connector,
  userId?: string
): ToolFunction&lt;PRFilesArgs, GitHubPRFilesResult&gt;
```

---

### createReadFileTool `function`

📍 [`src/tools/filesystem/readFile.ts:43`](src/tools/filesystem/readFile.ts)

Create a Read File tool with the given configuration

```typescript
export function createReadFileTool(config: FilesystemToolConfig =
```

---

### createSearchCodeTool `function`

📍 [`src/tools/github/searchCode.ts:42`](src/tools/github/searchCode.ts)

Create a GitHub search_code tool

```typescript
export function createSearchCodeTool(
  connector: Connector,
  userId?: string
): ToolFunction&lt;SearchCodeArgs, GitHubSearchCodeResult&gt;
```

---

### createSearchFilesTool `function`

📍 [`src/tools/github/searchFiles.ts:56`](src/tools/github/searchFiles.ts)

Create a GitHub search_files tool

```typescript
export function createSearchFilesTool(
  connector: Connector,
  userId?: string
): ToolFunction&lt;SearchFilesArgs, GitHubSearchFilesResult&gt;
```

---

### createSpeechToTextTool `function`

📍 [`src/tools/multimedia/speechToText.ts:31`](src/tools/multimedia/speechToText.ts)

```typescript
export function createSpeechToTextTool(
  connector: Connector,
  storage?: IMediaStorage,
): ToolFunction&lt;SpeechToTextArgs, SpeechToTextResult&gt;
```

---

### createTextToSpeechTool `function`

📍 [`src/tools/multimedia/textToSpeech.ts:32`](src/tools/multimedia/textToSpeech.ts)

```typescript
export function createTextToSpeechTool(
  connector: Connector,
  storage?: IMediaStorage,
  userId?: string
): ToolFunction&lt;TextToSpeechArgs, TextToSpeechResult&gt;
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

📍 [`src/domain/entities/Tool.ts:225`](src/domain/entities/Tool.ts)

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

📍 [`src/tools/registry.generated.ts:313`](src/tools/registry.generated.ts)

Get all built-in tools as ToolFunction array

```typescript
export function getAllBuiltInTools(): ToolFunction[]
```

---

### getConnectorTools `function`

📍 [`src/connectors/vendors/helpers.ts:259`](src/connectors/vendors/helpers.ts)

Get all tools for a connector (delegates to ConnectorTools)

```typescript
export function getConnectorTools(connectorName: string): ToolFunction[]
```

---

### getToolByName `function`

📍 [`src/tools/registry.generated.ts:328`](src/tools/registry.generated.ts)

Get tool by name

```typescript
export function getToolByName(name: string): ToolRegistryEntry | undefined
```

---

### getToolCallDescription `function`

📍 [`src/domain/entities/Tool.ts:277`](src/domain/entities/Tool.ts)

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

📍 [`src/tools/registry.generated.ts:338`](src/tools/registry.generated.ts)

Get all unique category names

```typescript
export function getToolCategories(): ToolCategory[]
```

---

### getToolRegistry `function`

📍 [`src/tools/registry.generated.ts:318`](src/tools/registry.generated.ts)

Get full tool registry with metadata

```typescript
export function getToolRegistry(): ToolRegistryEntry[]
```

---

### getToolsByCategory `function`

📍 [`src/tools/registry.generated.ts:323`](src/tools/registry.generated.ts)

Get tools by category

```typescript
export function getToolsByCategory(category: ToolCategory): ToolRegistryEntry[]
```

---

### getToolsRequiringConnector `function`

📍 [`src/tools/registry.generated.ts:333`](src/tools/registry.generated.ts)

Get tools that require connector configuration

```typescript
export function getToolsRequiringConnector(): ToolRegistryEntry[]
```

---

### hydrateCustomTool `function`

📍 [`src/tools/custom-tools/hydrate.ts:32`](src/tools/custom-tools/hydrate.ts)

Convert a stored CustomToolDefinition into an executable ToolFunction.

The resulting ToolFunction:
- Executes the definition's code through executeInVM
- Has input args passed as `input` in the VM sandbox
- Gets connector registry from ToolContext for authenticatedFetch
- Has session-scoped permission with medium risk level

```typescript
export function hydrateCustomTool(
  definition: CustomToolDefinition,
  options?: HydrateOptions,
): ToolFunction
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

### sanitizeToolName `function`

📍 [`src/utils/sanitize.ts:11`](src/utils/sanitize.ts)

Sanitize a string to be a valid tool name.
Matches the common denominator pattern across all LLM providers: ^[a-zA-Z0-9_-]+$

- Replaces invalid characters (spaces, special chars, unicode) with underscores
- Collapses consecutive underscores into one
- Strips leading/trailing underscores and hyphens
- Prepends 'n_' if the result starts with a digit
- Returns 'unnamed' if the result would be empty

```typescript
export function sanitizeToolName(name: string): string
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

**Returns:** `{ responseId: string; model: string; status: "in_progress" | "completed" | "failed" | "incomplete"; iterations: number; totalChunks: number; totalTextDeltas: number; totalToolCalls: number; textItemsCount: number; toolCallBuffersCount: number; completedToolCallsCount: number; durationMs: number; usage: { input_tokens: number; output_tokens: number; total_tokens: number; output_tokens_details?: { reasoning_tokens: number; } | undefined; }; }`

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

**Returns:** `{ responseId: string; model: string; createdAt: number; textBuffers: Map&lt;string, string[]&gt;; toolCallBuffers: Map&lt;string, ToolCallBuffer&gt;; completedToolCalls: ToolCall[]; toolResults: Map&lt;string, any&gt;; currentIteration: number; usage: { input_tokens: number; output_tokens: number; total_tokens: number; output_tokens_details?: { reasoning_tokens: number; } | undefined; }; status: "in_progress" | "completed" | "failed" | "incomplete"; startTime: Date; endTime: Date | undefined; }`

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
| `status` | `status: "in_progress" | "completed" | "failed" | "incomplete"` | - |
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

📍 [`src/domain/types/SharedTypes.ts:85`](src/domain/types/SharedTypes.ts)

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

📍 [`src/domain/entities/Model.ts:1517`](src/domain/entities/Model.ts)

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

📍 [`src/domain/entities/Model.ts:1505`](src/domain/entities/Model.ts)

Get all currently active models

```typescript
export function getActiveModels(): ILLMDescription[]
```

---

### getModelInfo `function`

📍 [`src/domain/entities/Model.ts:1488`](src/domain/entities/Model.ts)

Get model information by name

```typescript
export function getModelInfo(modelName: string): ILLMDescription | undefined
```

---

### getModelsByVendor `function`

📍 [`src/domain/entities/Model.ts:1497`](src/domain/entities/Model.ts)

Get all models for a specific vendor

```typescript
export function getModelsByVendor(vendor: VendorType): ILLMDescription[]
```

---

### resolveModelCapabilities `function`

📍 [`src/infrastructure/providers/base/ModelCapabilityResolver.ts:32`](src/infrastructure/providers/base/ModelCapabilityResolver.ts)

Resolve model capabilities from the centralized registry, falling back to vendor defaults.

```typescript
export function resolveModelCapabilities(
  model: string,
  vendorDefaults: ModelCapabilities
): ModelCapabilities
```

---

### MODEL_REGISTRY `const`

📍 [`src/domain/entities/Model.ts:192`](src/domain/entities/Model.ts)

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
| `'grok-4-1-fast-reasoning'` | `{
    name: 'grok-4-1-fast-reasoning',
    provider: Vendor.Grok,
    description: 'Fast Grok 4.1 with reasoning capabilities, 2M context window, vision support',
    isActive: true,
    releaseDate: '2025-11-01',
    knowledgeCutoff: '2024-11-01',
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
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 2000000,
        text: true,
        image: true,
        cpm: 0.20,
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.50,
      },
    },
  }` | - |
| `'grok-4-1-fast-non-reasoning'` | `{
    name: 'grok-4-1-fast-non-reasoning',
    provider: Vendor.Grok,
    description: 'Fast Grok 4.1 without reasoning, 2M context window, vision support',
    isActive: true,
    releaseDate: '2025-11-01',
    knowledgeCutoff: '2024-11-01',
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
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 2000000,
        text: true,
        image: true,
        cpm: 0.20,
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.50,
      },
    },
  }` | - |
| `'grok-code-fast-1'` | `{
    name: 'grok-code-fast-1',
    provider: Vendor.Grok,
    description: 'Specialized coding model with reasoning capabilities, 256K context',
    isActive: true,
    releaseDate: '2025-10-01',
    knowledgeCutoff: '2024-11-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: false,
      audio: false,
      video: false,
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 256000,
        text: true,
        cpm: 0.20,
      },
      output: {
        tokens: 32768,
        text: true,
        cpm: 1.50,
      },
    },
  }` | - |
| `'grok-4-fast-reasoning'` | `{
    name: 'grok-4-fast-reasoning',
    provider: Vendor.Grok,
    description: 'Fast Grok 4 with reasoning capabilities, 2M context window',
    isActive: true,
    releaseDate: '2025-09-01',
    knowledgeCutoff: '2024-11-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: false,
      audio: false,
      video: false,
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 2000000,
        text: true,
        cpm: 0.20,
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.50,
      },
    },
  }` | - |
| `'grok-4-fast-non-reasoning'` | `{
    name: 'grok-4-fast-non-reasoning',
    provider: Vendor.Grok,
    description: 'Fast Grok 4 without reasoning, 2M context window, vision support',
    isActive: true,
    releaseDate: '2025-09-01',
    knowledgeCutoff: '2024-11-01',
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
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 2000000,
        text: true,
        image: true,
        cpm: 0.20,
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.50,
      },
    },
  }` | - |
| `'grok-4-0709'` | `{
    name: 'grok-4-0709',
    provider: Vendor.Grok,
    description: 'Grok 4 flagship model (July 2025 release), 256K context, vision support',
    isActive: true,
    releaseDate: '2025-07-09',
    knowledgeCutoff: '2024-11-01',
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
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 256000,
        text: true,
        image: true,
        cpm: 3.00,
      },
      output: {
        tokens: 32768,
        text: true,
        cpm: 15.00,
      },
    },
  }` | - |
| `'grok-3-mini'` | `{
    name: 'grok-3-mini',
    provider: Vendor.Grok,
    description: 'Lightweight, cost-efficient model for simpler tasks, 131K context',
    isActive: true,
    releaseDate: '2025-06-01',
    knowledgeCutoff: '2024-11-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: false,
      audio: false,
      video: false,
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 131072,
        text: true,
        cpm: 0.30,
      },
      output: {
        tokens: 32768,
        text: true,
        cpm: 0.50,
      },
    },
  }` | - |
| `'grok-3'` | `{
    name: 'grok-3',
    provider: Vendor.Grok,
    description: 'Production model for general-purpose tasks, 131K context',
    isActive: true,
    releaseDate: '2025-06-01',
    knowledgeCutoff: '2024-11-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: false,
      audio: false,
      video: false,
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 131072,
        text: true,
        cpm: 3.00,
      },
      output: {
        tokens: 32768,
        text: true,
        cpm: 15.00,
      },
    },
  }` | - |
| `'grok-2-vision-1212'` | `{
    name: 'grok-2-vision-1212',
    provider: Vendor.Grok,
    description: 'Vision-capable model for image understanding, 32K context',
    isActive: true,
    releaseDate: '2024-12-12',
    knowledgeCutoff: '2024-11-01',
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
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 32768,
        text: true,
        image: true,
        cpm: 2.00,
      },
      output: {
        tokens: 8192,
        text: true,
        cpm: 10.00,
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

### AuthTemplate `interface`

📍 [`src/connectors/vendors/types.ts:15`](src/connectors/vendors/types.ts)

Authentication template for a vendor
Defines a single authentication method (e.g., API key, OAuth user flow)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | Unique auth method ID within vendor (e.g., 'pat', 'oauth-user', 'github-app') |
| `name` | `name: string;` | Human-readable name (e.g., 'Personal Access Token') |
| `type` | `type: 'api_key' | 'oauth';` | Auth type |
| `flow?` | `flow?: 'authorization_code' | 'client_credentials' | 'jwt_bearer';` | OAuth flow type (required when type is 'oauth') |
| `description` | `description: string;` | When to use this auth method |
| `requiredFields` | `requiredFields: AuthTemplateField[];` | Fields user must provide (e.g., ['apiKey'], ['clientId', 'clientSecret', 'redirectUri']) |
| `optionalFields?` | `optionalFields?: AuthTemplateField[];` | Optional fields user may provide |
| `defaults` | `defaults: Partial&lt;ConnectorAuth&gt;;` | Pre-filled OAuth URLs and defaults |
| `scopes?` | `scopes?: string[];` | Common scopes for this auth method |
| `scopeDescriptions?` | `scopeDescriptions?: Record&lt;string, string&gt;;` | Human-readable descriptions for scopes (key = scope ID) |

</details>

---

### CreateConnectorOptions `interface`

📍 [`src/connectors/vendors/types.ts:144`](src/connectors/vendors/types.ts)

Options for creating a connector from a template

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `baseURL?` | `baseURL?: string;` | Override the default baseURL |
| `description?` | `description?: string;` | Additional description for the connector |
| `displayName?` | `displayName?: string;` | Human-readable display name |
| `timeout?` | `timeout?: number;` | Request timeout in ms |
| `logging?` | `logging?: boolean;` | Enable request/response logging |

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
| `extra?` | `extra?: Record&lt;string, string&gt;;` | Vendor-specific extra credentials |

</details>

---

### SimpleIcon `interface`

📍 [`src/connectors/vendors/logos.ts:11`](src/connectors/vendors/logos.ts)

Simple Icons icon data structure

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `title` | `title: string;` | - |
| `slug` | `slug: string;` | - |
| `svg` | `svg: string;` | - |
| `path` | `path: string;` | - |
| `source` | `source: string;` | - |
| `hex` | `hex: string;` | - |
| `guidelines?` | `guidelines?: string;` | - |
| `license?` | `license?: {
    type: string;
    url?: string;
  };` | - |

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

### VendorInfo `interface`

📍 [`src/connectors/vendors/helpers.ts:266`](src/connectors/vendors/helpers.ts)

Get vendor template information for display

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | - |
| `name` | `name: string;` | - |
| `category` | `category: string;` | - |
| `docsURL?` | `docsURL?: string;` | - |
| `credentialsSetupURL?` | `credentialsSetupURL?: string;` | - |
| `authMethods` | `authMethods: {
    id: string;
    name: string;
    type: string;
    description: string;
    requiredFields: string[];
    scopes?: string[];
    scopeDescriptions?: Record&lt;string, string&gt;;
  }[];` | - |

</details>

---

### VendorLogo `interface`

📍 [`src/connectors/vendors/logos.ts:167`](src/connectors/vendors/logos.ts)

Vendor logo information

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `vendorId` | `vendorId: string;` | Vendor ID |
| `svg` | `svg: string;` | SVG content |
| `hex` | `hex: string;` | Brand color (hex without #) |
| `isPlaceholder` | `isPlaceholder: boolean;` | Whether this is a placeholder (no official icon) |
| `simpleIconsSlug?` | `simpleIconsSlug?: string;` | Simple Icons slug (if available) |

</details>

---

### VendorRegistryEntry `interface`

📍 [`src/connectors/vendors/types.ts:111`](src/connectors/vendors/types.ts)

Registry entry for a vendor (generated at build time)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | Vendor ID |
| `name` | `name: string;` | Human-readable name |
| `serviceType` | `serviceType: string;` | Service type for ConnectorTools integration |
| `category` | `category: ServiceCategory;` | Category from Services.ts |
| `authMethods` | `authMethods: string[];` | List of supported auth method IDs |
| `credentialsSetupURL?` | `credentialsSetupURL?: string;` | URL for credential setup |
| `template` | `template: VendorTemplate;` | Full vendor template (for programmatic access) |

</details>

---

### VendorTemplate `interface`

📍 [`src/connectors/vendors/types.ts:79`](src/connectors/vendors/types.ts)

Vendor template definition
Complete configuration for a vendor's supported authentication methods

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | Unique vendor ID (matches Services.ts id, e.g., 'github', 'slack') |
| `name` | `name: string;` | Human-readable name (e.g., 'GitHub', 'Slack') |
| `serviceType` | `serviceType: string;` | Service type for ConnectorTools integration (matches serviceType in ConnectorConfig) |
| `baseURL` | `baseURL: string;` | Default API base URL |
| `docsURL?` | `docsURL?: string;` | API documentation URL |
| `credentialsSetupURL?` | `credentialsSetupURL?: string;` | URL for setting up credentials on vendor's side |
| `authTemplates` | `authTemplates: AuthTemplate[];` | All supported authentication methods |
| `category` | `category: ServiceCategory;` | Category from Services.ts |
| `notes?` | `notes?: string;` | Additional notes about the vendor's authentication |

</details>

---

### AuthTemplateField `type`

📍 [`src/connectors/vendors/types.ts:50`](src/connectors/vendors/types.ts)

Known fields that can be required/optional in auth templates

```typescript
type AuthTemplateField = | 'apiKey'
  | 'clientId'
  | 'clientSecret'
  | 'redirectUri'
  | 'scope'
  | 'privateKey'
  | 'privateKeyPath'
  | 'appId'
  | 'installationId'
  | 'tenantId'
  | 'username'
  | 'subject'
  | 'audience'
  | 'userScope'
  | 'accountId'
  | 'subdomain'
  | 'region'
  | 'accessKeyId'
  | 'secretAccessKey'
  | 'applicationKey'
  // Vendor-specific extra fields (stored in auth.extra)
  | 'appToken'
  | 'signingSecret'
```

---

### OAuthFlow `type`

📍 [`src/connectors/oauth/types.ts:7`](src/connectors/oauth/types.ts)

```typescript
type OAuthFlow = 'authorization_code' | 'client_credentials' | 'jwt_bearer' | 'static_token'
```

---

### TemplateCredentials `type`

📍 [`src/connectors/vendors/types.ts:137`](src/connectors/vendors/types.ts)

Credentials provided by user when creating connector from template

```typescript
type TemplateCredentials = {
  [K in AuthTemplateField]?: string;
}
```

---

### authenticatedFetch `function`

📍 [`src/connectors/authenticatedFetch.ts:60`](src/connectors/authenticatedFetch.ts)

Fetch with automatic authentication using connector's configured auth scheme

Same API as standard fetch(), but with additional authProvider and optional userId parameters.
Authentication is handled automatically based on the connector's configuration:
- Bearer tokens (GitHub, Slack, Stripe)
- Bot tokens (Discord)
- Basic auth (Twilio, Zendesk)
- Custom headers (e.g., X-Shopify-Access-Token)

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
With relative URL (uses connector's baseURL):
```typescript
const response = await authenticatedFetch(
'/user/repos',  // Resolves to https://api.github.com/user/repos
{ method: 'GET' },
'github'
);
const repos = await response.json();
```
Multi-user mode:
```typescript
const response = await authenticatedFetch(
'/user/repos',
{ method: 'GET' },
'github',
'user123'  // Get token for specific user
);
const repos = await response.json();
```

---

### buildAuthConfig `function`

📍 [`src/connectors/vendors/helpers.ts:79`](src/connectors/vendors/helpers.ts)

Build ConnectorAuth from auth template and credentials

```typescript
export function buildAuthConfig(
  authTemplate: AuthTemplate,
  credentials: TemplateCredentials
): ConnectorAuth
```

---

### createAuthenticatedFetch `function`

📍 [`src/connectors/authenticatedFetch.ts:115`](src/connectors/authenticatedFetch.ts)

Create an authenticated fetch function bound to a specific connector and optionally a user

Useful for creating reusable fetch functions for a specific API and/or user.
Uses connector's configured auth scheme (Bearer, Bot, Basic, custom headers).

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
With relative URLs:
```typescript
const githubFetch = createAuthenticatedFetch('github');

// Relative URLs resolved against connector's baseURL
const repos = await githubFetch('/user/repos');
const issues = await githubFetch('/user/issues');
```
Multi-user mode:
```typescript
// Create fetch functions for different users
const aliceFetch = createAuthenticatedFetch('github', 'user123');
const bobFetch = createAuthenticatedFetch('github', 'user456');

// Each uses their own token
const aliceRepos = await aliceFetch('/user/repos');
const bobRepos = await bobFetch('/user/repos');
```

---

### createConnectorFromTemplate `function`

📍 [`src/connectors/vendors/helpers.ts:202`](src/connectors/vendors/helpers.ts)

Create a Connector from a vendor template

```typescript
export function createConnectorFromTemplate(
  name: string,
  vendorId: string,
  authTemplateId: string,
  credentials: TemplateCredentials,
  options?: CreateConnectorOptions
): Connector
```

**Example:**

```typescript
const connector = createConnectorFromTemplate(
  'my-github',
  'github',
  'pat',
  { apiKey: process.env.GITHUB_TOKEN }
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

### getAllVendorLogos `function`

📍 [`src/connectors/vendors/logos.ts:281`](src/connectors/vendors/logos.ts)

Get all available vendor logos

```typescript
export function getAllVendorLogos(): Map&lt;string, VendorLogo&gt;
```

---

### getAllVendorTemplates `function`

📍 [`src/connectors/vendors/helpers.ts:43`](src/connectors/vendors/helpers.ts)

Get all vendor templates

```typescript
export function getAllVendorTemplates(): VendorTemplate[]
```

---

### getCredentialsSetupURL `function`

📍 [`src/connectors/vendors/helpers.ts:349`](src/connectors/vendors/helpers.ts)

Get credentials setup URL for a vendor

```typescript
export function getCredentialsSetupURL(vendorId: string): string | undefined
```

---

### getDocsURL `function`

📍 [`src/connectors/vendors/helpers.ts:357`](src/connectors/vendors/helpers.ts)

Get docs URL for a vendor

```typescript
export function getDocsURL(vendorId: string): string | undefined
```

---

### getVendorAuthTemplate `function`

📍 [`src/connectors/vendors/helpers.ts:55`](src/connectors/vendors/helpers.ts)

Get auth template for a vendor

```typescript
export function getVendorAuthTemplate(
  vendorId: string,
  authId: string
): AuthTemplate | undefined
```

---

### getVendorColor `function`

📍 [`src/connectors/vendors/logos.ts:271`](src/connectors/vendors/logos.ts)

Get the brand color for a vendor

```typescript
export function getVendorColor(vendorId: string): string | undefined
```

---

### getVendorInfo `function`

📍 [`src/connectors/vendors/helpers.ts:286`](src/connectors/vendors/helpers.ts)

Get vendor information suitable for display

```typescript
export function getVendorInfo(vendorId: string): VendorInfo | undefined
```

---

### getVendorLogo `function`

📍 [`src/connectors/vendors/logos.ts:210`](src/connectors/vendors/logos.ts)

Get logo for a vendor

```typescript
export function getVendorLogo(vendorId: string): VendorLogo | undefined
```

**Example:**

```typescript
const logo = getVendorLogo('github');
if (logo) {
  console.log(logo.svg);  // SVG content
  console.log(logo.hex);  // Brand color
}
```

---

### getVendorLogoCdnUrl `function`

📍 [`src/connectors/vendors/logos.ts:313`](src/connectors/vendors/logos.ts)

Get CDN URL for a vendor's logo

```typescript
export function getVendorLogoCdnUrl(vendorId: string, color?: string): string | undefined
```

---

### getVendorLogoSvg `function`

📍 [`src/connectors/vendors/logos.ts:253`](src/connectors/vendors/logos.ts)

Get SVG content for a vendor logo

```typescript
export function getVendorLogoSvg(vendorId: string, color?: string): string | undefined
```

---

### getVendorTemplate `function`

📍 [`src/connectors/vendors/helpers.ts:31`](src/connectors/vendors/helpers.ts)

Get vendor template by ID

```typescript
export function getVendorTemplate(vendorId: string): VendorTemplate | undefined
```

---

### hasVendorLogo `function`

📍 [`src/connectors/vendors/logos.ts:183`](src/connectors/vendors/logos.ts)

Check if a vendor has a logo available

```typescript
export function hasVendorLogo(vendorId: string): boolean
```

---

### listVendorIds `function`

📍 [`src/connectors/vendors/helpers.ts:67`](src/connectors/vendors/helpers.ts)

List all vendor IDs

```typescript
export function listVendorIds(): string[]
```

---

### listVendors `function`

📍 [`src/connectors/vendors/helpers.ts:311`](src/connectors/vendors/helpers.ts)

List all vendors with basic info

```typescript
export function listVendors(): VendorInfo[]
```

---

### listVendorsByAuthType `function`

📍 [`src/connectors/vendors/helpers.ts:340`](src/connectors/vendors/helpers.ts)

List vendors that support a specific auth type

```typescript
export function listVendorsByAuthType(authType: 'api_key' | 'oauth'): VendorInfo[]
```

---

### listVendorsByCategory `function`

📍 [`src/connectors/vendors/helpers.ts:333`](src/connectors/vendors/helpers.ts)

List vendors by category

```typescript
export function listVendorsByCategory(category: string): VendorInfo[]
```

---

### listVendorsWithLogos `function`

📍 [`src/connectors/vendors/logos.ts:297`](src/connectors/vendors/logos.ts)

List vendor IDs that have logos available

```typescript
export function listVendorsWithLogos(): string[]
```

---

### VENDOR_ICON_MAP `const`

📍 [`src/connectors/vendors/logos.ts:26`](src/connectors/vendors/logos.ts)

Mapping from our vendor IDs to Simple Icons slugs

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `microsoft` | `'microsoft'` | - |
| `google` | `'google'` | - |
| `aws` | `'amazonwebservices'` | - |
| `azure` | `'microsoftazure'` | - |
| `gcp` | `'googlecloud'` | - |
| `discord` | `'discord'` | - |
| `slack` | `'slack'` | - |
| `telegram` | `'telegram'` | - |
| `'microsoft-teams'` | `'microsoftteams'` | - |
| `salesforce` | `'salesforce'` | - |
| `hubspot` | `'hubspot'` | - |
| `pipedrive` | `'pipedrive'` | - |
| `github` | `'github'` | - |
| `gitlab` | `'gitlab'` | - |
| `bitbucket` | `'bitbucket'` | - |
| `jira` | `'jira'` | - |
| `confluence` | `'confluence'` | - |
| `trello` | `'trello'` | - |
| `linear` | `'linear'` | - |
| `asana` | `'asana'` | - |
| `notion` | `'notion'` | - |
| `airtable` | `'airtable'` | - |
| `'google-workspace'` | `'google'` | - |
| `'google-drive'` | `'googledrive'` | - |
| `'microsoft-365'` | `'microsoft365'` | - |
| `onedrive` | `'onedrive'` | - |
| `stripe` | `'stripe'` | - |
| `paypal` | `'paypal'` | - |
| `quickbooks` | `'quickbooks'` | - |
| `ramp` | `null` | - |
| `sendgrid` | `'sendgrid'` | - |
| `mailchimp` | `'mailchimp'` | - |
| `postmark` | `'postmark'` | - |
| `dropbox` | `'dropbox'` | - |
| `box` | `'box'` | - |
| `datadog` | `'datadog'` | - |
| `pagerduty` | `'pagerduty'` | - |
| `sentry` | `'sentry'` | - |
| `serper` | `null` | - |
| `'brave-search'` | `'brave'` | - |
| `tavily` | `null` | - |
| `rapidapi` | `'rapidapi'` | - |
| `zenrows` | `null` | - |
| `twilio` | `'twilio'` | - |
| `zendesk` | `'zendesk'` | - |
| `intercom` | `'intercom'` | - |
| `shopify` | `'shopify'` | - |

</details>

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

### ContextOverflowError `class`

📍 [`src/domain/errors/AIErrors.ts:331`](src/domain/errors/AIErrors.ts)

Error thrown when context cannot be reduced to fit within limits
after all graceful degradation levels have been exhausted.

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    message: string,
    /** Detailed budget information for debugging */
    public readonly budget: ContextOverflowBudget
  )
```

**Parameters:**
- `message`: `string`
- `budget`: `ContextOverflowBudget`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `getDegradationSummary()`

Get a formatted summary of what was tried

```typescript
getDegradationSummary(): string
```

**Returns:** `string`

#### `getTopConsumers()`

Get the top token consumers

```typescript
getTopConsumers(count = 5): Array&lt;
```

**Parameters:**
- `count`: `number` *(optional)* (default: `5`)

**Returns:** `{ component: string; tokens: number; }[]`

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

📍 [`src/infrastructure/providers/base/ProviderErrorMapper.ts:24`](src/infrastructure/providers/base/ProviderErrorMapper.ts)

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

### ContextOverflowBudget `interface`

📍 [`src/domain/errors/AIErrors.ts:319`](src/domain/errors/AIErrors.ts)

Detailed budget information for context overflow diagnosis

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `actualTokens` | `actualTokens: number;` | - |
| `maxTokens` | `maxTokens: number;` | - |
| `overageTokens` | `overageTokens: number;` | - |
| `breakdown` | `breakdown: Record&lt;string, number&gt;;` | - |
| `degradationLog` | `degradationLog: string[];` | - |

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

### documentToContent `function`

📍 [`src/utils/documentContentBridge.ts:26`](src/utils/documentContentBridge.ts)

Convert a DocumentResult to Content[] for LLM input.

- Text pieces → InputTextContent
- Image pieces → InputImageContent (with data URI)
- Adjacent text pieces merged by default
- Additional image filtering applied

```typescript
export function documentToContent(
  result: DocumentResult,
  options: DocumentToContentOptions =
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

### readDocumentAsContent `function`

📍 [`src/utils/documentContentBridge.ts:116`](src/utils/documentContentBridge.ts)

One-call convenience: read a document and convert to Content[] for LLM input.

```typescript
export async function readDocumentAsContent(
  source: DocumentSource | string,
  options: DocumentReadOptions & DocumentToContentOptions =
```

**Example:**

```typescript
const content = await readDocumentAsContent('/path/to/doc.pdf', {
  imageFilter: { minWidth: 100, minHeight: 100 },
  imageDetail: 'auto',
});

agent.run([
  { type: 'input_text', text: 'Analyze this document:' },
  ...content,
]);
```

---

## Interfaces

TypeScript interfaces for extensibility

### AgentDefinitionListOptions `interface`

📍 [`src/domain/interfaces/IAgentDefinitionStorage.ts:177`](src/domain/interfaces/IAgentDefinitionStorage.ts)

Options for listing agent definitions

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agentType?` | `agentType?: StoredAgentType;` | Filter by agent type |
| `tags?` | `tags?: string[];` | Filter by tags (any match) |
| `limit?` | `limit?: number;` | Maximum number of results |
| `offset?` | `offset?: number;` | Offset for pagination |

</details>

---

### AgentDefinitionMetadata `interface`

📍 [`src/domain/interfaces/IAgentDefinitionStorage.ts:67`](src/domain/interfaces/IAgentDefinitionStorage.ts)

Agent definition metadata

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `description?` | `description?: string;` | Description of what this agent does |
| `tags?` | `tags?: string[];` | Tags for categorization |
| `author?` | `author?: string;` | Author/creator |

</details>

---

### AgentDefinitionSummary `interface`

📍 [`src/domain/interfaces/IAgentDefinitionStorage.ts:84`](src/domain/interfaces/IAgentDefinitionStorage.ts)

Agent definition summary for listing

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agentId` | `agentId: string;` | Agent identifier |
| `name` | `name: string;` | Agent name |
| `agentType` | `agentType: StoredAgentType;` | Agent type |
| `model` | `model: string;` | Model being used |
| `createdAt` | `createdAt: Date;` | When created |
| `updatedAt` | `updatedAt: Date;` | When last updated |
| `metadata?` | `metadata?: AgentDefinitionMetadata;` | Optional metadata |

</details>

---

### ContextStorageListOptions `interface`

📍 [`src/domain/interfaces/IContextStorage.ts:183`](src/domain/interfaces/IContextStorage.ts)

Options for listing sessions

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `tags?` | `tags?: string[];` | Filter by tags (any match) |
| `createdAfter?` | `createdAfter?: Date;` | Filter by creation date range |
| `createdBefore?` | `createdBefore?: Date;` | - |
| `savedAfter?` | `savedAfter?: Date;` | Filter by last saved date range |
| `savedBefore?` | `savedBefore?: Date;` | - |
| `limit?` | `limit?: number;` | Maximum number of results |
| `offset?` | `offset?: number;` | Offset for pagination |

</details>

---

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

### IAgentDefinitionStorage `interface`

📍 [`src/domain/interfaces/IAgentDefinitionStorage.ts:119`](src/domain/interfaces/IAgentDefinitionStorage.ts)

Storage interface for agent definitions

Implementations:
- FileAgentDefinitionStorage: File-based storage at ~/.oneringai/agents/<agentId>/
- (Future) DatabaseAgentDefinitionStorage, etc.

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

Save an agent definition

```typescript
save(definition: StoredAgentDefinition): Promise&lt;void&gt;;
```

**Parameters:**
- `definition`: `StoredAgentDefinition`

**Returns:** `Promise&lt;void&gt;`

#### `load()`

Load an agent definition

```typescript
load(agentId: string): Promise&lt;StoredAgentDefinition | null&gt;;
```

**Parameters:**
- `agentId`: `string`

**Returns:** `Promise&lt;StoredAgentDefinition | null&gt;`

#### `delete()`

Delete an agent definition

```typescript
delete(agentId: string): Promise&lt;void&gt;;
```

**Parameters:**
- `agentId`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `exists()`

Check if an agent definition exists

```typescript
exists(agentId: string): Promise&lt;boolean&gt;;
```

**Parameters:**
- `agentId`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `list()`

List all agent definitions (summaries only)

```typescript
list(options?: AgentDefinitionListOptions): Promise&lt;AgentDefinitionSummary[]&gt;;
```

**Parameters:**
- `options`: `AgentDefinitionListOptions | undefined` *(optional)*

**Returns:** `Promise&lt;AgentDefinitionSummary[]&gt;`

#### `updateMetadata()?`

Update agent definition metadata without loading full definition

```typescript
updateMetadata?(
    agentId: string,
    metadata: Partial&lt;AgentDefinitionMetadata&gt;
  ): Promise&lt;void&gt;;
```

**Parameters:**
- `agentId`: `string`
- `metadata`: `Partial&lt;AgentDefinitionMetadata&gt;`

**Returns:** `Promise&lt;void&gt;`

#### `getPath()`

Get the storage path/location (for display/debugging)

```typescript
getPath(): string;
```

**Returns:** `string`

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

### IConnectorAccessPolicy `interface`

📍 [`src/domain/interfaces/IConnectorAccessPolicy.ts:17`](src/domain/interfaces/IConnectorAccessPolicy.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `canAccess()`

Check if a connector is accessible in the given context.
Receives the full Connector instance so it can inspect
config.tags, vendor, serviceType, etc.

```typescript
canAccess(connector: Connector, context: ConnectorAccessContext): boolean;
```

**Parameters:**
- `connector`: `Connector`
- `context`: `ConnectorAccessContext`

**Returns:** `boolean`

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

### IConnectorRegistry `interface`

📍 [`src/domain/interfaces/IConnectorRegistry.ts:11`](src/domain/interfaces/IConnectorRegistry.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `get()`

Get a connector by name. Throws if not found (or not accessible).

```typescript
get(name: string): Connector;
```

**Parameters:**
- `name`: `string`

**Returns:** `Connector`

#### `has()`

Check if a connector exists (and is accessible)

```typescript
has(name: string): boolean;
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

#### `list()`

List all accessible connector names

```typescript
list(): string[];
```

**Returns:** `string[]`

#### `listAll()`

List all accessible connector instances

```typescript
listAll(): Connector[];
```

**Returns:** `Connector[]`

#### `size()`

Get number of accessible connectors

```typescript
size(): number;
```

**Returns:** `number`

#### `getDescriptionsForTools()`

Get connector descriptions formatted for tool parameters

```typescript
getDescriptionsForTools(): string;
```

**Returns:** `string`

#### `getInfo()`

Get connector info map

```typescript
getInfo(): Record&lt;string, { displayName: string; description: string; baseURL: string }&gt;;
```

**Returns:** `Record&lt;string, { displayName: string; description: string; baseURL: string; }&gt;`

</details>

---

### IContextStorage `interface`

📍 [`src/domain/interfaces/IContextStorage.ts:111`](src/domain/interfaces/IContextStorage.ts)

Storage interface for AgentContext persistence

Implementations:
- FileContextStorage: File-based storage at ~/.oneringai/agents/<agentId>/sessions/
- (Future) RedisContextStorage, PostgresContextStorage, S3ContextStorage, etc.

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

Save context state to a session

```typescript
save(
    sessionId: string,
    state: SerializedContextState,
    metadata?: ContextSessionMetadata
  ): Promise&lt;void&gt;;
```

**Parameters:**
- `sessionId`: `string`
- `state`: `SerializedContextState`
- `metadata`: `ContextSessionMetadata | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `load()`

Load context state from a session

```typescript
load(sessionId: string): Promise&lt;StoredContextSession | null&gt;;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;StoredContextSession | null&gt;`

#### `delete()`

Delete a session

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

List all sessions (summaries only, not full state)

```typescript
list(options?: ContextStorageListOptions): Promise&lt;ContextSessionSummary[]&gt;;
```

**Parameters:**
- `options`: `ContextStorageListOptions | undefined` *(optional)*

**Returns:** `Promise&lt;ContextSessionSummary[]&gt;`

#### `updateMetadata()?`

Update session metadata without loading full state

```typescript
updateMetadata?(
    sessionId: string,
    metadata: Partial&lt;ContextSessionMetadata&gt;
  ): Promise&lt;void&gt;;
```

**Parameters:**
- `sessionId`: `string`
- `metadata`: `Partial&lt;ContextSessionMetadata&gt;`

**Returns:** `Promise&lt;void&gt;`

#### `getPath()`

Get the storage path (for display/debugging)

```typescript
getPath(): string;
```

**Returns:** `string`

#### `getLocation()?`

Get a human-readable storage location string (for display/debugging).
Examples: file path, MongoDB URI, Redis key prefix, S3 bucket, etc.
Falls back to getPath() if not implemented.

```typescript
getLocation?(): string;
```

**Returns:** `string`

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

#### `registerToolsSelective()`

Register specific tools with a ToolManager (selective registration)

```typescript
registerToolsSelective(toolManager: ToolManager, toolNames?: string[]): void;
```

**Parameters:**
- `toolManager`: `ToolManager`
- `toolNames`: `string[] | undefined` *(optional)*

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

### IMediaStorage `interface`

📍 [`src/domain/interfaces/IMediaStorage.ts:86`](src/domain/interfaces/IMediaStorage.ts)

Storage interface for multimedia outputs

Implementations:
- FileMediaStorage: File-based storage (default, uses local filesystem)
- (Custom) S3MediaStorage, GCSMediaStorage, etc.

<details>
<summary><strong>Methods</strong></summary>

#### `save()`

Save media data to storage

```typescript
save(data: Buffer, metadata: MediaStorageMetadata): Promise&lt;MediaStorageResult&gt;;
```

**Parameters:**
- `data`: `Buffer&lt;ArrayBufferLike&gt;`
- `metadata`: `MediaStorageMetadata`

**Returns:** `Promise&lt;MediaStorageResult&gt;`

#### `read()`

Read media data from storage

```typescript
read(location: string): Promise&lt;Buffer | null&gt;;
```

**Parameters:**
- `location`: `string`

**Returns:** `Promise&lt;Buffer&lt;ArrayBufferLike&gt; | null&gt;`

#### `delete()`

Delete media from storage

```typescript
delete(location: string): Promise&lt;void&gt;;
```

**Parameters:**
- `location`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `exists()`

Check if media exists in storage

```typescript
exists(location: string): Promise&lt;boolean&gt;;
```

**Parameters:**
- `location`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `list()?`

List media files in storage (optional)

```typescript
list?(options?: MediaStorageListOptions): Promise&lt;MediaStorageEntry[]&gt;;
```

**Parameters:**
- `options`: `MediaStorageListOptions | undefined` *(optional)*

**Returns:** `Promise&lt;MediaStorageEntry[]&gt;`

#### `getPath()`

Get the storage path/location (for display/debugging)

```typescript
getPath(): string;
```

**Returns:** `string`

</details>

---

### InstructionEntry `interface`

📍 [`src/domain/interfaces/IPersistentInstructionsStorage.ts:15`](src/domain/interfaces/IPersistentInstructionsStorage.ts)

IPersistentInstructionsStorage - Storage interface for persistent instructions

Abstracted storage interface following Clean Architecture principles.
Implementations can use file system, database, or any other storage backend.

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: string;` | User-supplied key (e.g., "style", "code_rules") |
| `content` | `content: string;` | Instruction text (markdown) |
| `createdAt` | `createdAt: number;` | Timestamp when entry was first created |
| `updatedAt` | `updatedAt: number;` | Timestamp when entry was last updated |

</details>

---

### IPersistentInstructionsStorage `interface`

📍 [`src/domain/interfaces/IPersistentInstructionsStorage.ts:36`](src/domain/interfaces/IPersistentInstructionsStorage.ts)

Storage interface for persistent agent instructions

Implementations handle the actual storage mechanism while the plugin
handles the business logic.

<details>
<summary><strong>Methods</strong></summary>

#### `load()`

Load instruction entries from storage

```typescript
load(): Promise&lt;InstructionEntry[] | null&gt;;
```

**Returns:** `Promise&lt;InstructionEntry[] | null&gt;`

#### `save()`

Save instruction entries to storage

```typescript
save(entries: InstructionEntry[]): Promise&lt;void&gt;;
```

**Parameters:**
- `entries`: `InstructionEntry[]`

**Returns:** `Promise&lt;void&gt;`

#### `delete()`

Delete instructions from storage

```typescript
delete(): Promise&lt;void&gt;;
```

**Returns:** `Promise&lt;void&gt;`

#### `exists()`

Check if instructions exist in storage

```typescript
exists(): Promise&lt;boolean&gt;;
```

**Returns:** `Promise&lt;boolean&gt;`

#### `getPath()`

Get the storage path (for display/debugging)

```typescript
getPath(): string;
```

**Returns:** `string`

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

### MediaStorageEntry `interface`

📍 [`src/domain/interfaces/IMediaStorage.ts:50`](src/domain/interfaces/IMediaStorage.ts)

Entry returned by list()

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `location` | `location: string;` | Location of the file |
| `mimeType` | `mimeType: string;` | MIME type |
| `size` | `size: number;` | File size in bytes |
| `type?` | `type?: 'image' | 'video' | 'audio';` | Media type (image, video, audio) |
| `createdAt` | `createdAt: Date;` | When the file was created |

</details>

---

### MediaStorageListOptions `interface`

📍 [`src/domain/interfaces/IMediaStorage.ts:66`](src/domain/interfaces/IMediaStorage.ts)

Options for listing media files

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type?` | `type?: 'image' | 'video' | 'audio';` | Filter by media type |
| `limit?` | `limit?: number;` | Maximum number of results |
| `offset?` | `offset?: number;` | Offset for pagination |

</details>

---

### MediaStorageMetadata `interface`

📍 [`src/domain/interfaces/IMediaStorage.ts:18`](src/domain/interfaces/IMediaStorage.ts)

IMediaStorage - Storage interface for multimedia outputs (images, video, audio)

Provides CRUD operations for media files produced by generation tools.
Implementations can use filesystem, S3, GCS, or any other storage backend.

This follows Clean Architecture - the interface is in domain layer,
implementations are in infrastructure layer.

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'image' | 'video' | 'audio';` | Type of media being saved |
| `format` | `format: string;` | File format (png, mp4, mp3, etc.) |
| `model` | `model: string;` | Model used for generation |
| `vendor` | `vendor: string;` | Vendor that produced the output |
| `index?` | `index?: number;` | Index for multi-image results |
| `suggestedFilename?` | `suggestedFilename?: string;` | Suggested filename (without path) |
| `userId?` | `userId?: string;` | User ID — set by tool when userId is known, for per-user storage organization |

</details>

---

### MediaStorageResult `interface`

📍 [`src/domain/interfaces/IMediaStorage.ts:38`](src/domain/interfaces/IMediaStorage.ts)

Result of a save operation

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `location` | `location: string;` | Location of the saved file (file path, URL, S3 key - depends on implementation) |
| `mimeType` | `mimeType: string;` | MIME type of the saved file |
| `size` | `size: number;` | File size in bytes |

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

### SerializedContextState `interface`

📍 [`src/domain/interfaces/IContextStorage.ts:17`](src/domain/interfaces/IContextStorage.ts)

Serialized context state for persistence.
This is the canonical definition - core layer re-exports this type.

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `conversation` | `conversation: InputItem[];` | Conversation history |
| `pluginStates` | `pluginStates: Record&lt;string, unknown&gt;;` | Plugin states (keyed by plugin name) |
| `systemPrompt?` | `systemPrompt?: string;` | System prompt |
| `metadata` | `metadata: {
    savedAt: number;
    agentId?: string;
    userId?: string;
    model: string;
  };` | Metadata |
| `agentState?` | `agentState?: Record&lt;string, unknown&gt;;` | Agent-specific state (for TaskAgent, UniversalAgent, etc.) |

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

### StoredAgentDefinition `interface`

📍 [`src/domain/interfaces/IAgentDefinitionStorage.ts:21`](src/domain/interfaces/IAgentDefinitionStorage.ts)

Stored agent definition - everything needed to recreate an agent

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `version` | `version: number;` | Format version for migration support |
| `agentId` | `agentId: string;` | Unique agent identifier |
| `name` | `name: string;` | Human-readable agent name |
| `agentType` | `agentType: StoredAgentType;` | Agent type |
| `createdAt` | `createdAt: string;` | When the definition was created |
| `updatedAt` | `updatedAt: string;` | When the definition was last updated |
| `connector` | `connector: {
    /** Connector name (must be registered at runtime) */
    name: string;
    /** Model to use */
    model: string;
  };` | Connector configuration |
| `systemPrompt?` | `systemPrompt?: string;` | System prompt |
| `instructions?` | `instructions?: string;` | Instructions |
| `features?` | `features?: ContextFeatures;` | Feature configuration |
| `metadata?` | `metadata?: AgentDefinitionMetadata;` | Agent metadata |
| `typeConfig?` | `typeConfig?: Record&lt;string, unknown&gt;;` | Agent-type-specific configuration |

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

### ConnectorAccessContext `type`

📍 [`src/domain/interfaces/IConnectorAccessPolicy.ts:15`](src/domain/interfaces/IConnectorAccessPolicy.ts)

Opaque context passed to access policy checks.
Library imposes no structure — consumers define their own shape
(e.g., { userId, tenantId, roles }).

```typescript
type ConnectorAccessContext = Record&lt;string, unknown&gt;
```

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

### StoredAgentType `type`

📍 [`src/domain/interfaces/IAgentDefinitionStorage.ts:16`](src/domain/interfaces/IAgentDefinitionStorage.ts)

Agent type identifier

```typescript
type StoredAgentType = 'agent' | 'task-agent' | 'universal-agent' | 'research-agent' | string
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

### AgentContextNextGen `class`

📍 [`src/core/context-nextgen/AgentContextNextGen.ts:107`](src/core/context-nextgen/AgentContextNextGen.ts)

Next-generation context manager for AI agents.

Usage:
```typescript
const ctx = AgentContextNextGen.create({
  model: 'gpt-4',
  systemPrompt: 'You are a helpful assistant.',
  features: { workingMemory: true },
});

// Add user message
ctx.addUserMessage('Hello!');

// Prepare for LLM call (handles compaction if needed)
const { input, budget } = await ctx.prepare();

// Call LLM with input...

// Add assistant response
ctx.addAssistantResponse(response.output);
```

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
private constructor(config: AgentContextNextGenConfig)
```

**Parameters:**
- `config`: `AgentContextNextGenConfig`

</details>

<details>
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Create a new AgentContextNextGen instance.

```typescript
static create(config: AgentContextNextGenConfig): AgentContextNextGen
```

**Parameters:**
- `config`: `AgentContextNextGenConfig`

**Returns:** `AgentContextNextGen`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `setCompactionStrategy()`

Set the compaction strategy.
Can be changed at runtime to switch compaction behavior.

```typescript
setCompactionStrategy(strategy: ICompactionStrategy): void
```

**Parameters:**
- `strategy`: `ICompactionStrategy`

**Returns:** `void`

#### `setBeforeCompactionCallback()`

Set the beforeCompaction callback.
Called by Agent to wire up lifecycle hooks.

```typescript
setBeforeCompactionCallback(callback: BeforeCompactionCallback | null): void
```

**Parameters:**
- `callback`: `BeforeCompactionCallback | null`

**Returns:** `void`

#### `getLastUserMessage()`

Get the last message (most recent user message or tool results).
Used for compatibility with old code that expected a single item.

```typescript
getLastUserMessage(): InputItem | null
```

**Returns:** `InputItem | null`

#### `setCurrentInput()`

Set current input (user message).
Adds a user message to the conversation and sets it as the current input for prepare().

```typescript
setCurrentInput(content: string | Content[]): void
```

**Parameters:**
- `content`: `string | Content[]`

**Returns:** `void`

#### `addInputItems()`

Add multiple input items to conversation (legacy compatibility).

```typescript
addInputItems(items: InputItem[]): void
```

**Parameters:**
- `items`: `InputItem[]`

**Returns:** `void`

#### `prepareConversation()`

Legacy alias for prepare() - returns prepared context.

```typescript
async prepareConversation(): Promise&lt;PreparedContext&gt;
```

**Returns:** `Promise&lt;PreparedContext&gt;`

#### `addMessage()`

Add a message (legacy compatibility).
For user messages, use addUserMessage instead.
For assistant messages, use addAssistantResponse instead.

```typescript
addMessage(role: 'user' | 'assistant', content: string | Content[]): string
```

**Parameters:**
- `role`: `"user" | "assistant"`
- `content`: `string | Content[]`

**Returns:** `string`

#### `registerPlugin()`

Register a plugin.
Plugin's tools are automatically registered with ToolManager.

```typescript
registerPlugin(plugin: IContextPluginNextGen): void
```

**Parameters:**
- `plugin`: `IContextPluginNextGen`

**Returns:** `void`

#### `getPlugin()`

Get a plugin by name.

```typescript
getPlugin&lt;T extends IContextPluginNextGen&gt;(name: string): T | null
```

**Parameters:**
- `name`: `string`

**Returns:** `T | null`

#### `hasPlugin()`

Check if a plugin is registered.

```typescript
hasPlugin(name: string): boolean
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

#### `getPlugins()`

Get all registered plugins.

```typescript
getPlugins(): IContextPluginNextGen[]
```

**Returns:** `IContextPluginNextGen[]`

#### `addUserMessage()`

Add a user message.
Returns the message ID.

```typescript
addUserMessage(content: string | Content[]): string
```

**Parameters:**
- `content`: `string | Content[]`

**Returns:** `string`

#### `addAssistantResponse()`

Add assistant response (from LLM output).
Also moves current input to conversation history.
Returns the message ID.

```typescript
addAssistantResponse(output: OutputItem[]): string
```

**Parameters:**
- `output`: `OutputItem[]`

**Returns:** `string`

#### `addToolResults()`

Add tool results.
Returns the message ID.

```typescript
addToolResults(results: ToolResult[]): string
```

**Parameters:**
- `results`: `ToolResult[]`

**Returns:** `string`

#### `getConversation()`

Get conversation history (read-only).

```typescript
getConversation(): ReadonlyArray&lt;InputItem&gt;
```

**Returns:** `readonly InputItem[]`

#### `getCurrentInput()`

Get current input (read-only).

```typescript
getCurrentInput(): ReadonlyArray&lt;InputItem&gt;
```

**Returns:** `readonly InputItem[]`

#### `getConversationLength()`

Get conversation length.

```typescript
getConversationLength(): number
```

**Returns:** `number`

#### `clearConversation()`

Clear conversation history.

```typescript
clearConversation(reason?: string): void
```

**Parameters:**
- `reason`: `string | undefined` *(optional)*

**Returns:** `void`

#### `prepare()`

Prepare context for LLM call.

This method:
1. Calculates tool definition tokens (never compacted)
2. Builds the system message from all components
3. Calculates token budget
4. Handles oversized current input if needed
5. Runs compaction if needed
6. Returns final InputItem[] ready for LLM

IMPORTANT: Call this ONCE right before each LLM call!

```typescript
async prepare(): Promise&lt;PreparedContext&gt;
```

**Returns:** `Promise&lt;PreparedContext&gt;`

#### `consolidate()`

Run post-cycle consolidation.
Called by Agent after agentic cycle completes (before session save).

Delegates to the current compaction strategy's consolidate() method.
Use for more expensive operations like summarization.

```typescript
async consolidate(): Promise&lt;ConsolidationResult&gt;
```

**Returns:** `Promise&lt;ConsolidationResult&gt;`

#### `save()`

Save context state to storage.

```typescript
async save(
    sessionId?: string,
    metadata?: Record&lt;string, unknown&gt;,
    stateOverride?: SerializedContextState
  ): Promise&lt;void&gt;
```

**Parameters:**
- `sessionId`: `string | undefined` *(optional)*
- `metadata`: `Record&lt;string, unknown&gt; | undefined` *(optional)*
- `stateOverride`: `SerializedContextState | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `load()`

Load context state from storage.

```typescript
async load(sessionId: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `loadRaw()`

Load raw state from storage without restoring.
Used by BaseAgent for custom state restoration.

```typescript
async loadRaw(sessionId: string): Promise&lt;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;{ state: SerializedContextState; stored: StoredContextSession; } | null&gt;`

#### `sessionExists()`

Check if session exists in storage.

```typescript
async sessionExists(sessionId: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `sessionId`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `deleteSession()`

Delete a session from storage.

```typescript
async deleteSession(sessionId?: string): Promise&lt;void&gt;
```

**Parameters:**
- `sessionId`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `getState()`

Get serialized state for persistence.
Used by BaseAgent to inject agent-level state.

```typescript
getState(): SerializedContextState
```

**Returns:** `SerializedContextState`

#### `restoreState()`

Restore state from serialized form.
Used by BaseAgent for custom state restoration.

```typescript
restoreState(state: SerializedContextState): void
```

**Parameters:**
- `state`: `SerializedContextState`

**Returns:** `void`

#### `calculateBudget()`

Get the current token budget.

Returns the cached budget from the last prepare() call if available.
If prepare() hasn't been called yet, calculates a fresh budget.

For monitoring purposes, prefer using the `lastBudget` getter or
subscribing to the `budget:updated` event for reactive updates.

```typescript
async calculateBudget(): Promise&lt;ContextBudget&gt;
```

**Returns:** `Promise&lt;ContextBudget&gt;`

#### `destroy()`

Destroy context and release resources.

```typescript
destroy(): void
```

**Returns:** `void`

</details>

---

### BasePluginNextGen `class`

📍 [`src/core/context-nextgen/BasePluginNextGen.ts:150`](src/core/context-nextgen/BasePluginNextGen.ts)

Base class for NextGen context plugins.

Provides:
- **Token cache management** - `invalidateTokenCache()`, `updateTokenCache()`, `recalculateTokenCache()`
- **Simple token estimator** - `this.estimator` (can be overridden)
- **Default implementations** - for optional interface methods

## Implementing a Plugin

```typescript
class MyPlugin extends BasePluginNextGen {
  readonly name = 'my_plugin';
  private _data = new Map<string, string>();

  // 1. Return static instructions (cached automatically)
  getInstructions(): string {
    return '## My Plugin\n\nUse my_plugin_set to store data...';
  }

  // 2. Return formatted content (update token cache!)
  async getContent(): Promise<string | null> {
    if (this._data.size === 0) return null;
    const content = this.formatEntries();
    this.updateTokenCache(this.estimator.estimateTokens(content));
    return content;
  }

  // 3. Return raw data for inspection
  getContents(): unknown {
    return Object.fromEntries(this._data);
  }

  // 4. Invalidate cache when data changes
  set(key: string, value: string): void {
    this._data.set(key, value);
    this.invalidateTokenCache();  // <-- Important!
  }
}
```

## Token Cache Lifecycle

The token cache is used for budget calculation. Follow this pattern:

1. **When state changes** → Call `invalidateTokenCache()` to clear the cache
2. **In getContent()** → Call `updateTokenCache(tokens)` before returning
3. **For async recalc** → Use `recalculateTokenCache()` helper

```typescript
// Pattern 1: Invalidate on change, update in getContent
store(key: string, value: unknown): void {
  this._entries.set(key, value);
  this.invalidateTokenCache();  // Clear cache
}

async getContent(): Promise<string | null> {
  const content = this.formatContent();
  this.updateTokenCache(this.estimator.estimateTokens(content));  // Update cache
  return content;
}

// Pattern 2: Recalculate immediately after change
async store(key: string, value: unknown): Promise<void> {
  this._entries.set(key, value);
  await this.recalculateTokenCache();  // Recalc and cache
}
```

## Compaction Support

To make your plugin compactable:

```typescript
isCompactable(): boolean {
  return this._entries.size > 0;
}

async compact(targetTokensToFree: number): Promise<number> {
  // Remove low-priority entries
  let freed = 0;
  for (const [key, entry] of this._entries) {
    if (entry.priority !== 'critical' && freed < targetTokensToFree) {
      freed += entry.tokens;
      this._entries.delete(key);
    }
  }
  this.invalidateTokenCache();
  return freed;
}
```

<details>
<summary><strong>Methods</strong></summary>

#### `getInstructions()`

```typescript
abstract getInstructions(): string | null;
```

**Returns:** `string | null`

#### `getContent()`

```typescript
abstract getContent(): Promise&lt;string | null&gt;;
```

**Returns:** `Promise&lt;string | null&gt;`

#### `getContents()`

```typescript
abstract getContents(): unknown;
```

**Returns:** `unknown`

#### `getTokenSize()`

Get current token size of content.

Returns the cached value from the last `updateTokenCache()` call.
Returns 0 if cache is null (content hasn't been calculated yet).

**Note:** This is synchronous but `getContent()` is async. Plugins
should call `updateTokenCache()` in their `getContent()` implementation
to keep the cache accurate.

```typescript
getTokenSize(): number
```

**Returns:** `number`

#### `getInstructionsTokenSize()`

Get token size of instructions (cached after first call).

Instructions are static, so this is computed once and cached permanently.
The cache is never invalidated since instructions don't change.

```typescript
getInstructionsTokenSize(): number
```

**Returns:** `number`

#### `invalidateTokenCache()`

Invalidate the content token cache.

Call this when plugin state changes in a way that affects content size.
The next call to `getTokenSize()` will return 0 until `updateTokenCache()`
is called (typically in `getContent()`).

```typescript
protected invalidateTokenCache(): void
```

**Returns:** `void`

#### `updateTokenCache()`

Update the content token cache with a new value.

Call this in `getContent()` after formatting content, passing the
estimated token count. This keeps budget calculations accurate.

```typescript
protected updateTokenCache(tokens: number): void
```

**Parameters:**
- `tokens`: `number`

**Returns:** `void`

#### `recalculateTokenCache()`

Recalculate and cache token size from current content.

Convenience method that calls `getContent()`, estimates tokens,
and updates the cache. Use this when you need to immediately
refresh the cache after a state change.

```typescript
protected async recalculateTokenCache(): Promise&lt;number&gt;
```

**Returns:** `Promise&lt;number&gt;`

#### `isCompactable()`

Default: not compactable.

Override to return `true` if your plugin can reduce its content size
when context is tight. Also implement `compact()` to handle the actual
compaction logic.

```typescript
isCompactable(): boolean
```

**Returns:** `boolean`

#### `compact()`

Default: no compaction (returns 0).

Override to implement compaction logic. Should attempt to free
approximately `targetTokensToFree` tokens. Remember to call
`invalidateTokenCache()` after modifying content.

```typescript
async compact(_targetTokensToFree: number): Promise&lt;number&gt;
```

**Parameters:**
- `_targetTokensToFree`: `number`

**Returns:** `Promise&lt;number&gt;`

#### `getTools()`

Default: no tools (returns empty array).

Override to provide plugin-specific tools. Tools are auto-registered
with ToolManager when the plugin is added to the context.

Use a consistent naming convention: `<prefix>_<action>`
- `memory_store`, `memory_retrieve`, `memory_delete`
- `context_set`, `context_delete`, `context_list`

```typescript
getTools(): ToolFunction[]
```

**Returns:** `ToolFunction&lt;any, any&gt;[]`

#### `destroy()`

Default: no-op cleanup.

Override if your plugin has resources to release (file handles,
timers, connections, etc.). Called when context is destroyed.

```typescript
destroy(): void
```

**Returns:** `void`

#### `getState()`

Default: returns empty object.

Override to serialize plugin state for session persistence.
Return a JSON-serializable object. Consider including a version
number for future migration support.

```typescript
getState(): unknown
```

**Returns:** `unknown`

#### `restoreState()`

Default: no-op (ignores state).

Override to restore plugin state from saved session. The state
comes from a previous `getState()` call.

**IMPORTANT:** Call `invalidateTokenCache()` after restoring state
to ensure token counts are recalculated on next `getContent()` call.

```typescript
restoreState(_state: unknown): void
```

**Parameters:**
- `_state`: `unknown`

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string` | - |
| `estimator` | `estimator: ITokenEstimator` | Token estimator instance.
Override this in subclass to use a custom estimator (e.g., tiktoken). |

</details>

---

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

### DefaultCompactionStrategy `class`

📍 [`src/core/context-nextgen/strategies/DefaultCompactionStrategy.ts:42`](src/core/context-nextgen/strategies/DefaultCompactionStrategy.ts)

Default compaction strategy.

Behavior:
- compact(): First compacts plugins (in_context_memory first, then working_memory),
  then removes oldest messages from conversation while preserving tool pairs.
- consolidate(): No-op - returns performed: false

This strategy is fast and suitable for most use cases.
Default threshold is 70%.

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config?: DefaultCompactionStrategyConfig)
```

**Parameters:**
- `config`: `DefaultCompactionStrategyConfig | undefined` *(optional)*

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `compact()`

Emergency compaction when thresholds exceeded.

Strategy:
1. Compact plugins first (in_context_memory, then working_memory)
2. If still needed, remove oldest conversation messages (preserving tool pairs)

```typescript
async compact(context: CompactionContext, targetToFree: number): Promise&lt;CompactionResult&gt;
```

**Parameters:**
- `context`: `CompactionContext`
- `targetToFree`: `number`

**Returns:** `Promise&lt;CompactionResult&gt;`

#### `consolidate()`

Post-cycle consolidation.

Default strategy does nothing - override in subclasses for:
- Conversation summarization
- Memory deduplication
- Data promotion to persistent storage

```typescript
async consolidate(_context: CompactionContext): Promise&lt;ConsolidationResult&gt;
```

**Parameters:**
- `_context`: `CompactionContext`

**Returns:** `Promise&lt;ConsolidationResult&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "default"` | - |
| `displayName` | `displayName: "Dumb"` | - |
| `description` | `description: "Do not use"` | - |
| `threshold` | `threshold: number` | - |

</details>

---

### DocumentReader `class`

📍 [`src/capabilities/documents/DocumentReader.ts:37`](src/capabilities/documents/DocumentReader.ts)

Main document reader class.

**Example:**

```typescript
const reader = DocumentReader.create();
const result = await reader.read('/path/to/doc.pdf');
console.log(result.pieces); // DocumentPiece[]
```

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
private constructor(config: DocumentReaderConfig =
```

**Parameters:**
- `config`: `DocumentReaderConfig` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Static Methods</strong></summary>

#### `static create()`

Create a new DocumentReader instance

```typescript
static create(config: DocumentReaderConfig =
```

**Parameters:**
- `config`: `DocumentReaderConfig` *(optional)* (default: `{}`)

**Returns:** `DocumentReader`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `registerHandler()`

Register a custom format handler

```typescript
registerHandler(family: DocumentFamily, handler: IFormatHandler): void
```

**Parameters:**
- `family`: `DocumentFamily`
- `handler`: `IFormatHandler`

**Returns:** `void`

#### `read()`

Read a document from any source

```typescript
async read(
    source: DocumentSource | string,
    options: DocumentReadOptions =
```

**Parameters:**
- `source`: `string | DocumentSource`
- `options`: `DocumentReadOptions` *(optional)* (default: `{}`)

**Returns:** `Promise&lt;DocumentResult&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `handlers` | `handlers: Map&lt;DocumentFamily, IFormatHandler&gt;` | - |
| `config` | `config: DocumentReaderConfig` | - |

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

### FormatDetector `class`

📍 [`src/capabilities/documents/FormatDetector.ts:68`](src/capabilities/documents/FormatDetector.ts)

Static utility for detecting document formats

<details>
<summary><strong>Static Methods</strong></summary>

#### `static detect()`

Detect format from filename and optional buffer

```typescript
static detect(filename: string, _buffer?: Buffer | Uint8Array): FormatDetectionResult
```

**Parameters:**
- `filename`: `string`
- `_buffer`: `Buffer&lt;ArrayBufferLike&gt; | Uint8Array&lt;ArrayBufferLike&gt; | undefined` *(optional)*

**Returns:** `FormatDetectionResult`

#### `static isDocumentFormat()`

Check if an extension is a supported document format
Used by readFile to detect when to use DocumentReader

```typescript
static isDocumentFormat(ext: string): boolean
```

**Parameters:**
- `ext`: `string`

**Returns:** `boolean`

#### `static isBinaryDocumentFormat()`

Check if an extension is a binary document format
(i.e., cannot be read as UTF-8)

```typescript
static isBinaryDocumentFormat(ext: string): boolean
```

**Parameters:**
- `ext`: `string`

**Returns:** `boolean`

#### `static isDocumentMimeType()`

Check if a Content-Type header indicates a document format
Used by webFetch to detect downloadable documents

```typescript
static isDocumentMimeType(contentType: string): boolean
```

**Parameters:**
- `contentType`: `string`

**Returns:** `boolean`

#### `static detectFromMimeType()`

Detect format from Content-Type header

```typescript
static detectFromMimeType(contentType: string): FormatDetectionResult | null
```

**Parameters:**
- `contentType`: `string`

**Returns:** `FormatDetectionResult | null`

#### `static getSupportedExtensions()`

Get all supported document extensions

```typescript
static getSupportedExtensions(): string[]
```

**Returns:** `string[]`

#### `static getExtension()`

Get the normalized extension from a filename

```typescript
static getExtension(filename: string): string
```

**Parameters:**
- `filename`: `string`

**Returns:** `string`

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

### LoggingPlugin `class`

📍 [`src/core/tool-execution/plugins/LoggingPlugin.ts:78`](src/core/tool-execution/plugins/LoggingPlugin.ts)

LoggingPlugin - Logs tool execution lifecycle events.

**Example:**

```typescript
const pipeline = new ToolExecutionPipeline();
pipeline.use(new LoggingPlugin());
// Or with custom options:
pipeline.use(new LoggingPlugin({
  level: 'info',
  logArgs: false, // Don't log potentially sensitive args
}));
```

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(options: LoggingPluginOptions =
```

**Parameters:**
- `options`: `LoggingPluginOptions` *(optional)* (default: `{}`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `beforeExecute()`

```typescript
async beforeExecute(ctx: PluginExecutionContext): Promise&lt;BeforeExecuteResult&gt;
```

**Parameters:**
- `ctx`: `PluginExecutionContext`

**Returns:** `Promise&lt;BeforeExecuteResult&gt;`

#### `afterExecute()`

```typescript
async afterExecute(ctx: PluginExecutionContext, result: unknown): Promise&lt;unknown&gt;
```

**Parameters:**
- `ctx`: `PluginExecutionContext`
- `result`: `unknown`

**Returns:** `Promise&lt;unknown&gt;`

#### `onError()`

```typescript
async onError(ctx: PluginExecutionContext, error: Error): Promise&lt;unknown&gt;
```

**Parameters:**
- `ctx`: `PluginExecutionContext`
- `error`: `Error`

**Returns:** `Promise&lt;unknown&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "logging"` | - |
| `priority` | `priority: 5` | - |
| `logger` | `logger: FrameworkLogger` | - |
| `level` | `level: "trace" | "debug" | "info" | "warn" | "error"` | - |
| `errorLevel` | `errorLevel: "warn" | "error"` | - |
| `logArgs` | `logArgs: boolean` | - |
| `logResult` | `logResult: boolean` | - |
| `maxLogLength` | `maxLogLength: number` | - |

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

#### `registerToolsSelective()`

Register specific tools with a ToolManager (selective registration)

```typescript
registerToolsSelective(toolManager: ToolManager, toolNames?: string[]): void
```

**Parameters:**
- `toolManager`: `ToolManager`
- `toolNames`: `string[] | undefined` *(optional)*

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
| `config` | `config: Required&lt;Omit&lt;MCPServerConfig, "permissions" | "displayName" | "description" | "toolNamespace" | "connectorBindings"&gt;&gt; & { displayName?: string | undefined; description?: string | undefined; permissions?: { defaultScope?: "session" | "once" | "always" | "never" | undefined; defaultRiskLevel?: "critical" | "high" | "low" | "medium" | undefined; } | undefined; toolNamespace: string; connectorBindings?: Record&lt;string, string&gt; | undefined; }` | - |
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

#### `static remove()`

Remove and destroy a specific client from the registry

```typescript
static remove(name: string): boolean
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

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

### NutTreeDriver `class`

📍 [`src/tools/desktop/driver/NutTreeDriver.ts:133`](src/tools/desktop/driver/NutTreeDriver.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `initialize()`

```typescript
async initialize(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `screenshot()`

```typescript
async screenshot(region?:
```

**Parameters:**
- `region`: `{ x: number; y: number; width: number; height: number; } | undefined` *(optional)*

**Returns:** `Promise&lt;DesktopScreenshot&gt;`

#### `getScreenSize()`

```typescript
async getScreenSize(): Promise&lt;DesktopScreenSize&gt;
```

**Returns:** `Promise&lt;DesktopScreenSize&gt;`

#### `mouseMove()`

```typescript
async mouseMove(x: number, y: number): Promise&lt;void&gt;
```

**Parameters:**
- `x`: `number`
- `y`: `number`

**Returns:** `Promise&lt;void&gt;`

#### `mouseClick()`

```typescript
async mouseClick(x: number, y: number, button: MouseButton, clickCount: number): Promise&lt;void&gt;
```

**Parameters:**
- `x`: `number`
- `y`: `number`
- `button`: `MouseButton`
- `clickCount`: `number`

**Returns:** `Promise&lt;void&gt;`

#### `mouseDrag()`

```typescript
async mouseDrag(startX: number, startY: number, endX: number, endY: number, button: MouseButton): Promise&lt;void&gt;
```

**Parameters:**
- `startX`: `number`
- `startY`: `number`
- `endX`: `number`
- `endY`: `number`
- `button`: `MouseButton`

**Returns:** `Promise&lt;void&gt;`

#### `mouseScroll()`

```typescript
async mouseScroll(deltaX: number, deltaY: number, x?: number, y?: number): Promise&lt;void&gt;
```

**Parameters:**
- `deltaX`: `number`
- `deltaY`: `number`
- `x`: `number | undefined` *(optional)*
- `y`: `number | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `getCursorPosition()`

```typescript
async getCursorPosition(): Promise&lt;DesktopPoint&gt;
```

**Returns:** `Promise&lt;DesktopPoint&gt;`

#### `keyboardType()`

```typescript
async keyboardType(text: string, delay?: number): Promise&lt;void&gt;
```

**Parameters:**
- `text`: `string`
- `delay`: `number | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `keyboardKey()`

```typescript
async keyboardKey(keys: string): Promise&lt;void&gt;
```

**Parameters:**
- `keys`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `getWindowList()`

```typescript
async getWindowList(): Promise&lt;DesktopWindow[]&gt;
```

**Returns:** `Promise&lt;DesktopWindow[]&gt;`

#### `focusWindow()`

```typescript
async focusWindow(windowId: number): Promise&lt;void&gt;
```

**Parameters:**
- `windowId`: `number`

**Returns:** `Promise&lt;void&gt;`

</details>

---

### PersistentInstructionsPluginNextGen `class`

📍 [`src/core/context-nextgen/plugins/PersistentInstructionsPluginNextGen.ts:163`](src/core/context-nextgen/plugins/PersistentInstructionsPluginNextGen.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: PersistentInstructionsConfig)
```

**Parameters:**
- `config`: `PersistentInstructionsConfig`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `getInstructions()`

```typescript
getInstructions(): string
```

**Returns:** `string`

#### `getContent()`

```typescript
async getContent(): Promise&lt;string | null&gt;
```

**Returns:** `Promise&lt;string | null&gt;`

#### `getContents()`

```typescript
getContents(): Map&lt;string, InstructionEntry&gt;
```

**Returns:** `Map&lt;string, InstructionEntry&gt;`

#### `getTokenSize()`

```typescript
getTokenSize(): number
```

**Returns:** `number`

#### `getInstructionsTokenSize()`

```typescript
getInstructionsTokenSize(): number
```

**Returns:** `number`

#### `isCompactable()`

```typescript
isCompactable(): boolean
```

**Returns:** `boolean`

#### `compact()`

```typescript
async compact(_targetTokensToFree: number): Promise&lt;number&gt;
```

**Parameters:**
- `_targetTokensToFree`: `number`

**Returns:** `Promise&lt;number&gt;`

#### `getTools()`

```typescript
getTools(): ToolFunction[]
```

**Returns:** `ToolFunction&lt;any, any&gt;[]`

#### `destroy()`

```typescript
destroy(): void
```

**Returns:** `void`

#### `getState()`

```typescript
getState(): SerializedPersistentInstructionsState
```

**Returns:** `SerializedPersistentInstructionsState`

#### `restoreState()`

```typescript
restoreState(state: unknown): void
```

**Parameters:**
- `state`: `unknown`

**Returns:** `void`

#### `initialize()`

Initialize by loading from storage (called lazily)

```typescript
async initialize(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `set()`

Add or update an instruction entry by key

```typescript
async set(key: string, content: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `key`: `string`
- `content`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `remove()`

Remove an instruction entry by key

```typescript
async remove(key: string): Promise&lt;boolean&gt;
```

**Parameters:**
- `key`: `string`

**Returns:** `Promise&lt;boolean&gt;`

#### `get()`

Get one entry by key, or all entries if no key provided

```typescript
async get(key?: string): Promise&lt;InstructionEntry | InstructionEntry[] | null&gt;
```

**Parameters:**
- `key`: `string | undefined` *(optional)*

**Returns:** `Promise&lt;InstructionEntry | InstructionEntry[] | null&gt;`

#### `list()`

List metadata for all entries

```typescript
async list(): Promise&lt;
```

**Returns:** `Promise&lt;{ key: string; contentLength: number; createdAt: number; updatedAt: number; }[]&gt;`

#### `clear()`

Clear all instruction entries

```typescript
async clear(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "persistent_instructions"` | - |
| `storage` | `storage: IPersistentInstructionsStorage` | - |
| `maxTotalLength` | `maxTotalLength: number` | - |
| `maxEntries` | `maxEntries: number` | - |
| `agentId` | `agentId: string` | - |
| `estimator` | `estimator: ITokenEstimator` | - |

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

### ScopedConnectorRegistry `class`

📍 [`src/core/ScopedConnectorRegistry.ts:15`](src/core/ScopedConnectorRegistry.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    private readonly policy: IConnectorAccessPolicy,
    private readonly context: ConnectorAccessContext
  )
```

**Parameters:**
- `policy`: `IConnectorAccessPolicy`
- `context`: `ConnectorAccessContext`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `get()`

```typescript
get(name: string): Connector
```

**Parameters:**
- `name`: `string`

**Returns:** `Connector`

#### `has()`

```typescript
has(name: string): boolean
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

#### `list()`

```typescript
list(): string[]
```

**Returns:** `string[]`

#### `listAll()`

```typescript
listAll(): Connector[]
```

**Returns:** `Connector[]`

#### `size()`

```typescript
size(): number
```

**Returns:** `number`

#### `getDescriptionsForTools()`

```typescript
getDescriptionsForTools(): string
```

**Returns:** `string`

#### `getInfo()`

```typescript
getInfo(): Record&lt;string,
```

**Returns:** `Record&lt;string, { displayName: string; description: string; baseURL: string; }&gt;`

</details>

---

### ScrapeProvider `class`

📍 [`src/capabilities/scrape/ScrapeProvider.ts:204`](src/capabilities/scrape/ScrapeProvider.ts)

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

### StorageRegistry `class`

📍 [`src/core/StorageRegistry.ts:84`](src/core/StorageRegistry.ts)

<details>
<summary><strong>Static Methods</strong></summary>

#### `static configure()`

Configure multiple storage backends at once.

```typescript
static configure(config: Partial&lt;StorageConfig&gt;): void
```

**Parameters:**
- `config`: `Partial&lt;StorageConfig&gt;`

**Returns:** `void`

#### `static setContext()`

Set the default StorageContext.

This context is automatically passed to all per-agent factory calls
(sessions, persistentInstructions, workingMemory) when no explicit
context is provided. Typically set once at app startup with global
tenant/environment info, or per-request in multi-tenant servers.

```typescript
static setContext(context: StorageContext | undefined): void
```

**Parameters:**
- `context`: `StorageContext | undefined`

**Returns:** `void`

#### `static getContext()`

Get the current default StorageContext.

```typescript
static getContext(): StorageContext | undefined
```

**Returns:** `StorageContext | undefined`

#### `static set()`

Set a single storage backend.

```typescript
static set&lt;K extends keyof StorageConfig&gt;(key: K, value: StorageConfig[K]): void
```

**Parameters:**
- `key`: `K`
- `value`: `StorageConfig[K]`

**Returns:** `void`

#### `static get()`

Get a storage backend (or undefined if not configured).

```typescript
static get&lt;K extends keyof StorageConfig&gt;(key: K): StorageConfig[K] | undefined
```

**Parameters:**
- `key`: `K`

**Returns:** `StorageConfig[K] | undefined`

#### `static resolve()`

Resolve a storage backend, lazily creating and caching a default if needed.

If a value has been configured via `set()` or `configure()`, returns that.
Otherwise, calls `defaultFactory()`, caches the result, and returns it.

```typescript
static resolve&lt;K extends keyof StorageConfig&gt;(key: K, defaultFactory: () =&gt; StorageConfig[K]): StorageConfig[K]
```

**Parameters:**
- `key`: `K`
- `defaultFactory`: `() =&gt; StorageConfig[K]`

**Returns:** `StorageConfig[K]`

#### `static has()`

Check if a storage backend has been configured.

```typescript
static has(key: keyof StorageConfig): boolean
```

**Parameters:**
- `key`: `keyof StorageConfig`

**Returns:** `boolean`

#### `static reset()`

Clear all configured storage backends and context.
Useful for testing.

```typescript
static reset(): void
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `entries` | `entries: Map&lt;string, unknown&gt;` | Internal storage map |

</details>

---

### StrategyRegistry `class`

📍 [`src/core/context-nextgen/strategies/StrategyRegistry.ts:85`](src/core/context-nextgen/strategies/StrategyRegistry.ts)

Strategy Registry - manages compaction strategy registration and creation.

Features:
- Static registry pattern (like Connector)
- Auto-registers built-in strategy classes on first access
- Supports custom strategy class registration
- Provides UI-safe getInfo() for serialization
- Metadata (displayName, description) comes from strategy class

<details>
<summary><strong>Static Methods</strong></summary>

#### `static register()`

Register a new strategy class.

Metadata (name, displayName, description, threshold) is read from
the strategy class itself.

```typescript
static register(strategyClass: StrategyClass, options?: StrategyRegisterOptions): void
```

**Parameters:**
- `strategyClass`: `StrategyClass`
- `options`: `StrategyRegisterOptions | undefined` *(optional)*

**Returns:** `void`

#### `static get()`

Get a strategy entry by name.

```typescript
static get(name: string): StrategyRegistryEntry
```

**Parameters:**
- `name`: `string`

**Returns:** `StrategyRegistryEntry`

#### `static has()`

Check if a strategy exists.

```typescript
static has(name: string): boolean
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

#### `static list()`

List all registered strategy names.

```typescript
static list(): string[]
```

**Returns:** `string[]`

#### `static create()`

Create a strategy instance by name.

```typescript
static create(name: string, config?: unknown): ICompactionStrategy
```

**Parameters:**
- `name`: `string`
- `config`: `unknown` *(optional)*

**Returns:** `ICompactionStrategy`

#### `static getInfo()`

Get strategy information for UI display (serializable, no class refs).

Returns array of StrategyInfo objects that can be safely serialized
and sent over IPC.

```typescript
static getInfo(): StrategyInfo[]
```

**Returns:** `StrategyInfo[]`

#### `static remove()`

Remove a strategy from the registry.

```typescript
static remove(name: string): boolean
```

**Parameters:**
- `name`: `string`

**Returns:** `boolean`

#### `static getIfExists()`

Get a strategy entry without throwing.
Returns undefined if not found.

```typescript
static getIfExists(name: string): StrategyRegistryEntry | undefined
```

**Parameters:**
- `name`: `string`

**Returns:** `StrategyRegistryEntry | undefined`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `registry` | `registry: Map&lt;string, StrategyRegistryEntry&gt;` | - |
| `initialized` | `initialized: boolean` | - |

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

### AgentContextNextGenConfig `interface`

📍 [`src/core/context-nextgen/types.ts:523`](src/core/context-nextgen/types.ts)

AgentContextNextGen configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `model` | `model: string;` | Model name (used for context window lookup) |
| `maxContextTokens?` | `maxContextTokens?: number;` | Maximum context tokens (auto-detected from model if not provided) |
| `responseReserve?` | `responseReserve?: number;` | Tokens to reserve for response (default: 4096) |
| `systemPrompt?` | `systemPrompt?: string;` | System prompt provided by user |
| `strategy?` | `strategy?: string;` | Compaction strategy name (default: 'default').
Used to create strategy from StrategyRegistry if compactionStrategy not provided. |
| `compactionStrategy?` | `compactionStrategy?: ICompactionStrategy;` | Custom compaction strategy instance.
If provided, overrides the `strategy` option. |
| `features?` | `features?: ContextFeatures;` | Feature flags |
| `agentId?` | `agentId?: string;` | Agent ID (required for PersistentInstructions) |
| `userId?` | `userId?: string;` | User ID for multi-user scenarios. Automatically flows to ToolContext for all tool executions. |
| `connectors?` | `connectors?: string[];` | Restrict this agent to a subset of registered connectors (by name).
When set, only these connectors are visible in ToolContext.connectorRegistry
and in dynamic tool descriptions (e.g., execute_javascript).
When not set, all connectors visible to the current userId are available. |
| `tools?` | `tools?: ToolFunction[];` | Initial tools to register |
| `storage?` | `storage?: IContextStorageFromDomain;` | Storage for session persistence |
| `plugins?` | `plugins?: PluginConfigs;` | Plugin-specific configurations (used with features flags) |
| `toolExecutionTimeout?` | `toolExecutionTimeout?: number;` | Hard timeout in milliseconds for any single tool execution.
Acts as a safety net: if a tool's own timeout mechanism fails
(e.g. a child process doesn't exit), this will force-resolve with an error.
Default: 0 (disabled - relies on each tool's own timeout) |

</details>

---

### AgenticLoopEvents `interface`

📍 [`src/capabilities/agents/types/EventTypes.ts:170`](src/capabilities/agents/types/EventTypes.ts)

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
| `'execution:maxIterations'` | `'execution:maxIterations': ExecutionMaxIterationsEvent;` | - |
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

📍 [`src/domain/entities/Connector.ts:68`](src/domain/entities/Connector.ts)

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
| `extra?` | `extra?: Record&lt;string, string&gt;;` | Vendor-specific extra credentials beyond the primary API key.
E.g., Slack Socket Mode needs { appToken: 'xapp-...', signingSecret: '...' } |

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

### CompactionContext `interface`

📍 [`src/core/context-nextgen/types.ts:696`](src/core/context-nextgen/types.ts)

Read-only context passed to compaction strategies.
Provides access to data needed for compaction decisions and
controlled methods to modify state.

<details>
<summary><strong>Methods</strong></summary>

#### `removeMessages()`

Remove messages by indices.
Handles tool pair preservation internally.

```typescript
removeMessages(indices: number[]): Promise&lt;number&gt;;
```

**Parameters:**
- `indices`: `number[]`

**Returns:** `Promise&lt;number&gt;`

#### `compactPlugin()`

Compact a specific plugin.

```typescript
compactPlugin(pluginName: string, targetTokens: number): Promise&lt;number&gt;;
```

**Parameters:**
- `pluginName`: `string`
- `targetTokens`: `number`

**Returns:** `Promise&lt;number&gt;`

#### `estimateTokens()`

Estimate tokens for an item.

```typescript
estimateTokens(item: InputItem): number;
```

**Parameters:**
- `item`: `InputItem`

**Returns:** `number`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `budget` | `readonly budget: ContextBudget;` | Current budget (from prepare) |
| `conversation` | `readonly conversation: ReadonlyArray&lt;InputItem&gt;;` | Current conversation history (read-only) |
| `currentInput` | `readonly currentInput: ReadonlyArray&lt;InputItem&gt;;` | Current input (read-only) |
| `plugins` | `readonly plugins: ReadonlyArray&lt;IContextPluginNextGen&gt;;` | Registered plugins (for querying state) |
| `strategyName` | `readonly strategyName: string;` | Strategy name for logging |

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

### CompactionResult `interface`

📍 [`src/core/context-nextgen/types.ts:663`](src/core/context-nextgen/types.ts)

Result of compact() operation.

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `tokensFreed` | `tokensFreed: number;` | Tokens actually freed by compaction |
| `messagesRemoved` | `messagesRemoved: number;` | Number of messages removed from conversation |
| `pluginsCompacted` | `pluginsCompacted: string[];` | Names of plugins that were compacted |
| `log` | `log: string[];` | Log of actions taken during compaction |

</details>

---

### ConnectorConfig `interface`

📍 [`src/domain/entities/Connector.ts:104`](src/domain/entities/Connector.ts)

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

📍 [`src/domain/entities/Connector.ts:201`](src/domain/entities/Connector.ts)

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

### ConsolidationResult `interface`

📍 [`src/core/context-nextgen/types.ts:680`](src/core/context-nextgen/types.ts)

Result of consolidate() operation.

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `performed` | `performed: boolean;` | Whether any consolidation was performed |
| `tokensChanged` | `tokensChanged: number;` | Net token change (negative = freed, positive = added, e.g., summaries) |
| `actions` | `actions: string[];` | Description of actions taken |

</details>

---

### ContextBudget `interface`

📍 [`src/core/context-nextgen/types.ts:375`](src/core/context-nextgen/types.ts)

Token budget breakdown - clear and simple

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxTokens` | `maxTokens: number;` | Maximum context tokens for the model |
| `responseReserve` | `responseReserve: number;` | Tokens reserved for LLM response |
| `systemMessageTokens` | `systemMessageTokens: number;` | Tokens used by system message (prompt + instructions + plugin content) |
| `toolsTokens` | `toolsTokens: number;` | Tokens used by tool definitions (NEVER compacted) |
| `conversationTokens` | `conversationTokens: number;` | Tokens used by conversation history |
| `currentInputTokens` | `currentInputTokens: number;` | Tokens used by current input (user message or tool results) |
| `totalUsed` | `totalUsed: number;` | Total tokens used |
| `available` | `available: number;` | Available tokens (maxTokens - responseReserve - totalUsed) |
| `utilizationPercent` | `utilizationPercent: number;` | Usage percentage (totalUsed / (maxTokens - responseReserve)) |
| `breakdown` | `breakdown: {
    systemPrompt: number;
    persistentInstructions: number;
    pluginInstructions: number;
    pluginContents: Record&lt;string, number&gt;;
    tools: number;
    conversation: number;
    currentInput: number;
  };` | Breakdown by component for debugging |

</details>

---

### ContextEvents `interface`

📍 [`src/core/context-nextgen/types.ts:613`](src/core/context-nextgen/types.ts)

Events emitted by AgentContextNextGen

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'context:prepared'` | `'context:prepared': { budget: ContextBudget; compacted: boolean };` | Emitted when context is prepared |
| `'context:compacted'` | `'context:compacted': { tokensFreed: number; log: string[] };` | Emitted when compaction is performed |
| `'budget:updated'` | `'budget:updated': { budget: ContextBudget; timestamp: number };` | Emitted right after budget is calculated in prepare() - for reactive monitoring |
| `'budget:warning'` | `'budget:warning': { budget: ContextBudget };` | Emitted when budget reaches warning threshold (>70%) |
| `'budget:critical'` | `'budget:critical': { budget: ContextBudget };` | Emitted when budget reaches critical threshold (>90%) |
| `'compaction:starting'` | `'compaction:starting': {
    budget: ContextBudget;
    targetTokensToFree: number;
    timestamp: number;
  };` | Emitted when compaction is about to start |
| `'input:oversized'` | `'input:oversized': { result: OversizedInputResult };` | Emitted when current input is too large |
| `'message:added'` | `'message:added': { role: string; index: number };` | Emitted when a message is added |
| `'conversation:cleared'` | `'conversation:cleared': { reason?: string };` | Emitted when conversation is cleared |

</details>

---

### ContextFeatures `interface`

📍 [`src/core/context-nextgen/types.ts:470`](src/core/context-nextgen/types.ts)

Feature flags for enabling/disabling plugins

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `workingMemory?` | `workingMemory?: boolean;` | Enable WorkingMemory plugin (default: true) |
| `inContextMemory?` | `inContextMemory?: boolean;` | Enable InContextMemory plugin (default: false) |
| `persistentInstructions?` | `persistentInstructions?: boolean;` | Enable PersistentInstructions plugin (default: false) |

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

### DefaultCompactionStrategyConfig `interface`

📍 [`src/core/context-nextgen/strategies/DefaultCompactionStrategy.ts:26`](src/core/context-nextgen/strategies/DefaultCompactionStrategy.ts)

Configuration for DefaultCompactionStrategy

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `threshold?` | `threshold?: number;` | Custom threshold (default: 0.70 = 70%) |

</details>

---

### DesktopGetCursorResult `interface`

📍 [`src/tools/desktop/types.ts:203`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `x?` | `x?: number;` | - |
| `y?` | `y?: number;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### DesktopGetScreenSizeResult `interface`

📍 [`src/tools/desktop/types.ts:232`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `physicalWidth?` | `physicalWidth?: number;` | - |
| `physicalHeight?` | `physicalHeight?: number;` | - |
| `logicalWidth?` | `logicalWidth?: number;` | - |
| `logicalHeight?` | `logicalHeight?: number;` | - |
| `scaleFactor?` | `scaleFactor?: number;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### DesktopKeyboardKeyArgs `interface`

📍 [`src/tools/desktop/types.ts:222`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `keys` | `keys: string;` | - |

</details>

---

### DesktopKeyboardKeyResult `interface`

📍 [`src/tools/desktop/types.ts:226`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### DesktopKeyboardTypeArgs `interface`

📍 [`src/tools/desktop/types.ts:211`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `text` | `text: string;` | - |
| `delay?` | `delay?: number;` | - |

</details>

---

### DesktopKeyboardTypeResult `interface`

📍 [`src/tools/desktop/types.ts:216`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### DesktopMouseClickArgs `interface`

📍 [`src/tools/desktop/types.ts:159`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `x?` | `x?: number;` | - |
| `y?` | `y?: number;` | - |
| `button?` | `button?: MouseButton;` | - |
| `clickCount?` | `clickCount?: number;` | - |

</details>

---

### DesktopMouseClickResult `interface`

📍 [`src/tools/desktop/types.ts:166`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `x?` | `x?: number;` | - |
| `y?` | `y?: number;` | - |
| `button?` | `button?: MouseButton;` | - |
| `clickCount?` | `clickCount?: number;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### DesktopMouseDragArgs `interface`

📍 [`src/tools/desktop/types.ts:176`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `startX` | `startX: number;` | - |
| `startY` | `startY: number;` | - |
| `endX` | `endX: number;` | - |
| `endY` | `endY: number;` | - |
| `button?` | `button?: MouseButton;` | - |

</details>

---

### DesktopMouseDragResult `interface`

📍 [`src/tools/desktop/types.ts:184`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### DesktopMouseMoveArgs `interface`

📍 [`src/tools/desktop/types.ts:146`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `x` | `x: number;` | - |
| `y` | `y: number;` | - |

</details>

---

### DesktopMouseMoveResult `interface`

📍 [`src/tools/desktop/types.ts:151`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `x?` | `x?: number;` | - |
| `y?` | `y?: number;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### DesktopMouseScrollArgs `interface`

📍 [`src/tools/desktop/types.ts:190`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `deltaX?` | `deltaX?: number;` | - |
| `deltaY?` | `deltaY?: number;` | - |
| `x?` | `x?: number;` | - |
| `y?` | `y?: number;` | - |

</details>

---

### DesktopMouseScrollResult `interface`

📍 [`src/tools/desktop/types.ts:197`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### DesktopPoint `interface`

📍 [`src/tools/desktop/types.ts:15`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `x` | `x: number;` | - |
| `y` | `y: number;` | - |

</details>

---

### DesktopScreenshot `interface`

📍 [`src/tools/desktop/types.ts:33`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `base64` | `base64: string;` | Base64-encoded PNG image data |
| `width` | `width: number;` | Width in physical pixels |
| `height` | `height: number;` | Height in physical pixels |

</details>

---

### DesktopScreenshotArgs `interface`

📍 [`src/tools/desktop/types.ts:130`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `region?` | `region?: { x: number; y: number; width: number; height: number };` | - |

</details>

---

### DesktopScreenshotResult `interface`

📍 [`src/tools/desktop/types.ts:134`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `width?` | `width?: number;` | - |
| `height?` | `height?: number;` | - |
| `base64?` | `base64?: string;` | Base64 PNG for text summary |
| `__images?` | `__images?: Array&lt;{ base64: string; mediaType: string }&gt;;` | Image array for multimodal provider handling |
| `error?` | `error?: string;` | - |

</details>

---

### DesktopScreenSize `interface`

📍 [`src/tools/desktop/types.ts:20`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `physicalWidth` | `physicalWidth: number;` | Physical pixel width (screenshot space) |
| `physicalHeight` | `physicalHeight: number;` | Physical pixel height (screenshot space) |
| `logicalWidth` | `logicalWidth: number;` | Logical OS width |
| `logicalHeight` | `logicalHeight: number;` | Logical OS height |
| `scaleFactor` | `scaleFactor: number;` | Scale factor (physical / logical), e.g. 2.0 on Retina |

</details>

---

### DesktopWindow `interface`

📍 [`src/tools/desktop/types.ts:42`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: number;` | Window identifier (platform-specific) |
| `title` | `title: string;` | Window title |
| `appName?` | `appName?: string;` | Application name |
| `bounds?` | `bounds?: { x: number; y: number; width: number; height: number };` | Window bounds in physical pixel coords |

</details>

---

### DesktopWindowFocusArgs `interface`

📍 [`src/tools/desktop/types.ts:250`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `windowId` | `windowId: number;` | - |

</details>

---

### DesktopWindowFocusResult `interface`

📍 [`src/tools/desktop/types.ts:254`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### DesktopWindowListResult `interface`

📍 [`src/tools/desktop/types.ts:243`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `windows?` | `windows?: DesktopWindow[];` | - |
| `error?` | `error?: string;` | - |

</details>

---

### DirectCallOptions `interface`

📍 [`src/core/BaseAgent.ts:249`](src/core/BaseAgent.ts)

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

### DocumentMetadata `interface`

📍 [`src/capabilities/documents/types.ts:56`](src/capabilities/documents/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `filename` | `filename: string;` | - |
| `format` | `format: DocumentFormat;` | - |
| `family` | `family: DocumentFamily;` | - |
| `mimeType` | `mimeType: string;` | - |
| `totalPieces` | `totalPieces: number;` | - |
| `totalTextPieces` | `totalTextPieces: number;` | - |
| `totalImagePieces` | `totalImagePieces: number;` | - |
| `totalSizeBytes` | `totalSizeBytes: number;` | - |
| `estimatedTokens` | `estimatedTokens: number;` | - |
| `processingTimeMs` | `processingTimeMs: number;` | - |
| `formatSpecific?` | `formatSpecific?: Record&lt;string, unknown&gt;;` | - |

</details>

---

### DocumentReaderConfig `interface`

📍 [`src/capabilities/documents/types.ts:179`](src/capabilities/documents/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `defaults?` | `defaults?: DocumentReadOptions;` | Default options for all read() calls |
| `handlers?` | `handlers?: Map&lt;DocumentFamily, IFormatHandler&gt;;` | Custom format handlers (override built-in) |
| `maxDownloadSizeBytes?` | `maxDownloadSizeBytes?: number;` | Maximum download size for URL sources (default: 50MB) |
| `downloadTimeoutMs?` | `downloadTimeoutMs?: number;` | Download timeout for URL sources (default: 60000ms) |

</details>

---

### DocumentReadOptions `interface`

📍 [`src/capabilities/documents/types.ts:151`](src/capabilities/documents/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxTokens?` | `maxTokens?: number;` | Maximum estimated tokens in output (default: 100000) |
| `maxOutputBytes?` | `maxOutputBytes?: number;` | Maximum output size in bytes (default: 5MB) |
| `extractImages?` | `extractImages?: boolean;` | Extract images from documents (default: true) |
| `imageDetail?` | `imageDetail?: 'auto' | 'low' | 'high';` | Image detail level for LLM (default: 'auto') |
| `imageFilter?` | `imageFilter?: ImageFilterOptions;` | Image filtering options |
| `pages?` | `pages?: number[] | string[];` | Specific pages/sheets to read (format-dependent) |
| `transformers?` | `transformers?: IDocumentTransformer[];` | Additional transformers to apply |
| `skipDefaultTransformers?` | `skipDefaultTransformers?: boolean;` | Skip built-in transformers (default: false) |
| `formatOptions?` | `formatOptions?: {
    excel?: ExcelFormatOptions;
    pdf?: PDFFormatOptions;
    html?: HTMLFormatOptions;
    office?: OfficeFormatOptions;
  };` | Format-specific options |

</details>

---

### DocumentResult `interface`

📍 [`src/capabilities/documents/types.ts:70`](src/capabilities/documents/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `pieces` | `pieces: DocumentPiece[];` | - |
| `metadata` | `metadata: DocumentMetadata;` | - |
| `error?` | `error?: string;` | - |
| `warnings` | `warnings: string[];` | - |

</details>

---

### DocumentTextPiece `interface`

📍 [`src/capabilities/documents/types.ts:37`](src/capabilities/documents/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'text';` | - |
| `content` | `content: string;` | - |
| `metadata` | `metadata: PieceMetadata;` | - |

</details>

---

### DocumentToContentOptions `interface`

📍 [`src/capabilities/documents/types.ts:228`](src/capabilities/documents/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `imageDetail?` | `imageDetail?: 'auto' | 'low' | 'high';` | Image detail for LLM content (default: 'auto') |
| `imageFilter?` | `imageFilter?: ImageFilterOptions;` | Additional image filtering at content conversion time |
| `maxImages?` | `maxImages?: number;` | Maximum images in content output (default: 20) |
| `mergeAdjacentText?` | `mergeAdjacentText?: boolean;` | Merge adjacent text pieces into one (default: true) |

</details>

---

### EditFileResult `interface`

📍 [`src/tools/filesystem/types.ts:118`](src/tools/filesystem/types.ts)

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

### ExecutionConfig `interface`

📍 [`src/capabilities/agents/types/EventTypes.ts:14`](src/capabilities/agents/types/EventTypes.ts)

Minimal config type for execution start events.
This captures the essential info without importing full AgentConfig.

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `model` | `model: string;` | - |
| `instructions?` | `instructions?: string;` | - |
| `temperature?` | `temperature?: number;` | - |
| `maxIterations?` | `maxIterations?: number;` | - |

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

### FormatDetectionResult `interface`

📍 [`src/capabilities/documents/types.ts:219`](src/capabilities/documents/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `format` | `format: DocumentFormat;` | - |
| `family` | `family: DocumentFamily;` | - |
| `mimeType` | `mimeType: string;` | - |
| `confidence` | `confidence: 'high' | 'medium' | 'low';` | - |

</details>

---

### GitHubCreatePRResult `interface`

📍 [`src/tools/github/types.ts:291`](src/tools/github/types.ts)

Result from create_pr tool

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `data?` | `data?: {
    number: number;
    url: string;
    state: string;
    title: string;
  };` | - |
| `error?` | `error?: string;` | - |

</details>

---

### GitHubGetPRResult `interface`

📍 [`src/tools/github/types.ts:223`](src/tools/github/types.ts)

Result from get_pr tool

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `data?` | `data?: {
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
  };` | - |
| `error?` | `error?: string;` | - |

</details>

---

### GitHubPRCommentEntry `interface`

📍 [`src/tools/github/types.ts:267`](src/tools/github/types.ts)

A unified comment/review entry

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `id: number;` | - |
| `type` | `type: 'review' | 'comment' | 'review_comment';` | - |
| `author` | `author: string;` | - |
| `body` | `body: string;` | - |
| `created_at` | `created_at: string;` | - |
| `path?` | `path?: string;` | - |
| `line?` | `line?: number;` | - |
| `state?` | `state?: string;` | - |

</details>

---

### GitHubPRCommentsResult `interface`

📍 [`src/tools/github/types.ts:281`](src/tools/github/types.ts)

Result from pr_comments tool

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `comments?` | `comments?: GitHubPRCommentEntry[];` | - |
| `count?` | `count?: number;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### GitHubPRFilesResult `interface`

📍 [`src/tools/github/types.ts:250`](src/tools/github/types.ts)

Result from pr_files tool

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `files?` | `files?: {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
  }[];` | - |
| `count?` | `count?: number;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### GitHubReadFileResult `interface`

📍 [`src/tools/github/types.ts:209`](src/tools/github/types.ts)

Result from read_file tool (GitHub variant)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `content?` | `content?: string;` | - |
| `path?` | `path?: string;` | - |
| `size?` | `size?: number;` | - |
| `lines?` | `lines?: number;` | - |
| `truncated?` | `truncated?: boolean;` | - |
| `sha?` | `sha?: string;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### GitHubRepository `interface`

📍 [`src/tools/github/types.ts:17`](src/tools/github/types.ts)

Parsed GitHub repository reference

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `owner` | `owner: string;` | - |
| `repo` | `repo: string;` | - |

</details>

---

### GitHubSearchCodeResult `interface`

📍 [`src/tools/github/types.ts:198`](src/tools/github/types.ts)

Result from search_code tool

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `matches?` | `matches?: { file: string; fragment?: string }[];` | - |
| `count?` | `count?: number;` | - |
| `truncated?` | `truncated?: boolean;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### GitHubSearchFilesResult `interface`

📍 [`src/tools/github/types.ts:187`](src/tools/github/types.ts)

Result from search_files tool

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `success` | `success: boolean;` | - |
| `files?` | `files?: { path: string; size: number; type: string }[];` | - |
| `count?` | `count?: number;` | - |
| `truncated?` | `truncated?: boolean;` | - |
| `error?` | `error?: string;` | - |

</details>

---

### GlobResult `interface`

📍 [`src/tools/filesystem/types.ts:129`](src/tools/filesystem/types.ts)

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

📍 [`src/tools/filesystem/types.ts:140`](src/tools/filesystem/types.ts)

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

📍 [`src/tools/filesystem/types.ts:154`](src/tools/filesystem/types.ts)

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

### HydrateOptions `interface`

📍 [`src/tools/custom-tools/hydrate.ts:16`](src/tools/custom-tools/hydrate.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `defaultTimeout?` | `defaultTimeout?: number;` | Default execution timeout in ms. Default: 10000 |
| `maxTimeout?` | `maxTimeout?: number;` | Maximum execution timeout in ms. Default: 30000 |

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

### ICompactionStrategy `interface`

📍 [`src/core/context-nextgen/types.ts:751`](src/core/context-nextgen/types.ts)

Compaction strategy interface.

Strategies implement two methods:
- `compact()`: Emergency compaction when thresholds exceeded (called from prepare())
- `consolidate()`: Post-cycle cleanup and optimization (called after agentic loop)

Use `compact()` for quick, threshold-based token reduction.
Use `consolidate()` for more expensive operations like summarization.

<details>
<summary><strong>Methods</strong></summary>

#### `compact()`

Emergency compaction - triggered when context usage exceeds threshold.
Called from prepare() when utilization > threshold.

Should be fast and focus on freeing tokens quickly.

```typescript
compact(context: CompactionContext, targetToFree: number): Promise&lt;CompactionResult&gt;;
```

**Parameters:**
- `context`: `CompactionContext`
- `targetToFree`: `number`

**Returns:** `Promise&lt;CompactionResult&gt;`

#### `consolidate()`

Post-cycle consolidation - run after agentic cycle completes.
Called from Agent after run()/stream() finishes (before session save).

Use for more expensive operations:
- Summarizing long conversations
- Memory optimization and deduplication
- Promoting important data to persistent storage

```typescript
consolidate(context: CompactionContext): Promise&lt;ConsolidationResult&gt;;
```

**Parameters:**
- `context`: `CompactionContext`

**Returns:** `Promise&lt;ConsolidationResult&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `readonly name: string;` | Strategy name (unique identifier) for identification and logging |
| `displayName` | `readonly displayName: string;` | Human-readable display name for UI |
| `description` | `readonly description: string;` | Description explaining the strategy behavior |
| `threshold` | `readonly threshold: number;` | Threshold percentage (0-1) at which compact() is triggered |
| `requiredPlugins?` | `readonly requiredPlugins?: readonly string[];` | Plugin names this strategy requires to function.
Validation is performed when strategy is assigned to context.
If any required plugin is missing, an error is thrown. |

</details>

---

### IContextPluginNextGen `interface`

📍 [`src/core/context-nextgen/types.ts:143`](src/core/context-nextgen/types.ts)

Context plugin interface for NextGen context management.

## Implementing a Custom Plugin

1. **Extend BasePluginNextGen** - provides token caching helpers
2. **Implement getInstructions()** - return LLM usage guide (static, cached)
3. **Implement getContent()** - return formatted content (Markdown with `##` header)
4. **Call updateTokenCache()** - after any state change that affects content
5. **Implement getTools()** - return tools with `<plugin_prefix>_*` naming

## Plugin Contributions

Plugins provide three types of content to the system message:
1. **Instructions** - static usage guide for the LLM (NEVER compacted)
2. **Content** - dynamic plugin data/state (may be compacted)
3. **Tools** - registered with ToolManager (NEVER compacted)

## Token Cache Lifecycle

Plugins must track their own token size for budget calculation. The pattern:

```typescript
// When state changes:
this._entries.set(key, value);
this.invalidateTokenCache();  // Clear cached size

// In getContent():
const content = this.formatContent();
this.updateTokenCache(this.estimator.estimateTokens(content));  // Update cache
return content;
```

## Content Format

`getContent()` should return Markdown with a descriptive header:

```markdown
## Plugin Display Name (optional stats)

Formatted content here...
- Entry 1: value
- Entry 2: value
```

Built-in plugins use these headers:
- WorkingMemory: `## Working Memory (N entries)`
- InContextMemory: `## Live Context (N entries)`
- PersistentInstructions: No header (user's raw instructions)

## Tool Naming Convention

Use a consistent prefix based on plugin name:
- `working_memory` plugin → `memory_store`, `memory_retrieve`, `memory_delete`, `memory_list`
- `in_context_memory` plugin → `context_set`, `context_delete`, `context_list`
- `persistent_instructions` plugin → `instructions_set`, `instructions_remove`, `instructions_list`, `instructions_clear`

## State Serialization

`getState()` and `restoreState()` are **synchronous** for simplicity.
If your plugin has async data, consider:
- Storing only references/keys in state
- Using a separate async initialization method

**Example:**

```typescript
class MyPlugin extends BasePluginNextGen {
  readonly name = 'my_plugin';
  private _data = new Map<string, string>();

  getInstructions(): string {
    return '## My Plugin\n\nUse my_plugin_set to store data...';
  }

  async getContent(): Promise<string | null> {
    if (this._data.size === 0) return null;
    const lines = [...this._data].map(([k, v]) => `- ${k}: ${v}`);
    const content = `## My Plugin (${this._data.size} entries)\n\n${lines.join('\n')}`;
    this.updateTokenCache(this.estimator.estimateTokens(content));
    return content;
  }

  getTools(): ToolFunction[] {
    return [myPluginSetTool, myPluginGetTool];
  }

  getState(): unknown {
    return { data: Object.fromEntries(this._data) };
  }

  restoreState(state: unknown): void {
    const s = state as { data: Record<string, string> };
    this._data = new Map(Object.entries(s.data || {}));
    this.invalidateTokenCache();
  }
}
```

<details>
<summary><strong>Methods</strong></summary>

#### `getInstructions()`

Get usage instructions for the LLM.

Returns static text explaining how to use this plugin's tools
and data. This is placed in the system message and is NEVER
compacted - it persists throughout the conversation.

Instructions should include:
- What the plugin does
- How to use available tools
- Best practices and conventions

```typescript
getInstructions(): string | null;
```

**Returns:** `string | null`

#### `getContent()`

Get formatted content to include in system message.

Returns the plugin's current state formatted for LLM consumption.
Should be Markdown with a `## Header`. This content CAN be compacted
if `isCompactable()` returns true.

**IMPORTANT:** Call `updateTokenCache()` with the content's token size
before returning to keep budget calculations accurate.

```typescript
getContent(): Promise&lt;string | null&gt;;
```

**Returns:** `Promise&lt;string | null&gt;`

#### `getContents()`

Get the full raw contents of this plugin for inspection.

Used by library clients to programmatically inspect plugin state.
Returns the actual data structure, not the formatted string.

```typescript
getContents(): unknown;
```

**Returns:** `unknown`

#### `getTokenSize()`

Get current token size of plugin content.

Returns the cached token count from the last `updateTokenCache()` call.
This is used for budget calculation in `prepare()`.

The cache should be updated via `updateTokenCache()` whenever content
changes. If cache is null, returns 0.

```typescript
getTokenSize(): number;
```

**Returns:** `number`

#### `getInstructionsTokenSize()`

Get token size of instructions (cached after first call).

Instructions are static, so this is computed once and cached.
Used for budget calculation.

```typescript
getInstructionsTokenSize(): number;
```

**Returns:** `number`

#### `isCompactable()`

Whether this plugin's content can be compacted when context is tight.

Return true if the plugin can reduce its content size when requested.
Examples: evicting low-priority entries, summarizing, removing old data.

Return false if content cannot be reduced (e.g., critical state).

```typescript
isCompactable(): boolean;
```

**Returns:** `boolean`

#### `compact()`

Compact plugin content to free tokens.

Called by compaction strategies when context is too full.
Should attempt to free **approximately** `targetTokensToFree` tokens.

This is a **best effort** operation:
- May free more or less than requested
- May return 0 if nothing can be compacted (e.g., all entries are critical)
- Should prioritize removing lowest-priority/oldest data first

Strategies may include:
- Evicting low-priority entries
- Summarizing verbose content
- Removing oldest data
- Truncating large values

**IMPORTANT:** Call `invalidateTokenCache()` or `updateTokenCache()`
after modifying content.

```typescript
compact(targetTokensToFree: number): Promise&lt;number&gt;;
```

**Parameters:**
- `targetTokensToFree`: `number`

**Returns:** `Promise&lt;number&gt;`

#### `getTools()`

Get tools provided by this plugin.

Tools are automatically registered with ToolManager when the plugin
is added to the context. Use a consistent naming convention:
`<prefix>_<action>` (e.g., `memory_store`, `context_set`).

```typescript
getTools(): ToolFunction[];
```

**Returns:** `ToolFunction&lt;any, any&gt;[]`

#### `destroy()`

Cleanup resources when context is destroyed.

Called when AgentContextNextGen.destroy() is invoked.
Use for releasing resources, closing connections, etc.

```typescript
destroy(): void;
```

**Returns:** `void`

#### `getState()`

Serialize plugin state for session persistence.

**MUST be synchronous.** Return a JSON-serializable object representing
the plugin's current state. This is called when saving a session.

For plugins with async data (e.g., external storage), return only
references/keys here and handle async restoration separately.

```typescript
getState(): unknown;
```

**Returns:** `unknown`

#### `restoreState()`

Restore plugin state from serialized data.

Called when loading a saved session. The state comes from a previous
`getState()` call on the same plugin type.

**IMPORTANT:** Call `invalidateTokenCache()` after restoring state
to ensure token counts are recalculated.

```typescript
restoreState(state: unknown): void;
```

**Parameters:**
- `state`: `unknown`

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `readonly name: string;` | Unique plugin name (used for lookup and tool prefixing) |

</details>

---

### IDesktopDriver `interface`

📍 [`src/tools/desktop/types.ts:57`](src/tools/desktop/types.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `initialize()`

Initialize the driver (dynamic import, permission checks, scale detection)

```typescript
initialize(): Promise&lt;void&gt;;
```

**Returns:** `Promise&lt;void&gt;`

#### `screenshot()`

```typescript
screenshot(region?: { x: number; y: number; width: number; height: number }): Promise&lt;DesktopScreenshot&gt;;
```

**Parameters:**
- `region`: `{ x: number; y: number; width: number; height: number; } | undefined` *(optional)*

**Returns:** `Promise&lt;DesktopScreenshot&gt;`

#### `getScreenSize()`

```typescript
getScreenSize(): Promise&lt;DesktopScreenSize&gt;;
```

**Returns:** `Promise&lt;DesktopScreenSize&gt;`

#### `mouseMove()`

```typescript
mouseMove(x: number, y: number): Promise&lt;void&gt;;
```

**Parameters:**
- `x`: `number`
- `y`: `number`

**Returns:** `Promise&lt;void&gt;`

#### `mouseClick()`

```typescript
mouseClick(x: number, y: number, button: MouseButton, clickCount: number): Promise&lt;void&gt;;
```

**Parameters:**
- `x`: `number`
- `y`: `number`
- `button`: `MouseButton`
- `clickCount`: `number`

**Returns:** `Promise&lt;void&gt;`

#### `mouseDrag()`

```typescript
mouseDrag(startX: number, startY: number, endX: number, endY: number, button: MouseButton): Promise&lt;void&gt;;
```

**Parameters:**
- `startX`: `number`
- `startY`: `number`
- `endX`: `number`
- `endY`: `number`
- `button`: `MouseButton`

**Returns:** `Promise&lt;void&gt;`

#### `mouseScroll()`

```typescript
mouseScroll(deltaX: number, deltaY: number, x?: number, y?: number): Promise&lt;void&gt;;
```

**Parameters:**
- `deltaX`: `number`
- `deltaY`: `number`
- `x`: `number | undefined` *(optional)*
- `y`: `number | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `getCursorPosition()`

```typescript
getCursorPosition(): Promise&lt;DesktopPoint&gt;;
```

**Returns:** `Promise&lt;DesktopPoint&gt;`

#### `keyboardType()`

```typescript
keyboardType(text: string, delay?: number): Promise&lt;void&gt;;
```

**Parameters:**
- `text`: `string`
- `delay`: `number | undefined` *(optional)*

**Returns:** `Promise&lt;void&gt;`

#### `keyboardKey()`

```typescript
keyboardKey(keys: string): Promise&lt;void&gt;;
```

**Parameters:**
- `keys`: `string`

**Returns:** `Promise&lt;void&gt;`

#### `getWindowList()`

```typescript
getWindowList(): Promise&lt;DesktopWindow[]&gt;;
```

**Returns:** `Promise&lt;DesktopWindow[]&gt;`

#### `focusWindow()`

```typescript
focusWindow(windowId: number): Promise&lt;void&gt;;
```

**Parameters:**
- `windowId`: `number`

**Returns:** `Promise&lt;void&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `isInitialized` | `readonly isInitialized: boolean;` | Whether the driver is initialized |
| `scaleFactor` | `readonly scaleFactor: number;` | Current scale factor (physical / logical) |

</details>

---

### IDocumentTransformer `interface`

📍 [`src/capabilities/documents/types.ts:199`](src/capabilities/documents/types.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `transform()`

```typescript
transform(pieces: DocumentPiece[], context: TransformerContext): Promise&lt;DocumentPiece[]&gt;;
```

**Parameters:**
- `pieces`: `DocumentPiece[]`
- `context`: `TransformerContext`

**Returns:** `Promise&lt;DocumentPiece[]&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `readonly name: string;` | - |
| `appliesTo` | `readonly appliesTo: DocumentFormat[];` | - |
| `priority?` | `readonly priority?: number;` | - |

</details>

---

### IFormatHandler `interface`

📍 [`src/capabilities/documents/types.ts:206`](src/capabilities/documents/types.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `handle()`

```typescript
handle(
    buffer: Buffer,
    filename: string,
    format: DocumentFormat,
    options: DocumentReadOptions
  ): Promise&lt;DocumentPiece[]&gt;;
```

**Parameters:**
- `buffer`: `Buffer&lt;ArrayBufferLike&gt;`
- `filename`: `string`
- `format`: `DocumentFormat`
- `options`: `DocumentReadOptions`

**Returns:** `Promise&lt;DocumentPiece[]&gt;`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `readonly name: string;` | - |
| `supportedFormats` | `readonly supportedFormats: DocumentFormat[];` | - |

</details>

---

### InContextEntry `interface`

📍 [`src/core/context-nextgen/plugins/InContextMemoryPluginNextGen.ts:28`](src/core/context-nextgen/plugins/InContextMemoryPluginNextGen.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `key` | `key: string;` | - |
| `description` | `description: string;` | - |
| `value` | `value: unknown;` | - |
| `updatedAt` | `updatedAt: number;` | - |
| `priority` | `priority: InContextPriority;` | - |
| `showInUI?` | `showInUI?: boolean;` | If true, this entry is displayed in the user's side panel UI |

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

📍 [`src/capabilities/scrape/ScrapeProvider.ts:104`](src/capabilities/scrape/ScrapeProvider.ts)

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

📍 [`src/capabilities/agents/types/EventTypes.ts:70`](src/capabilities/agents/types/EventTypes.ts)

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

### ITokenEstimator `interface`

📍 [`src/core/context-nextgen/types.ts:19`](src/core/context-nextgen/types.ts)

Token estimator interface - used for conversation and input estimation
Plugins handle their own token estimation internally.

<details>
<summary><strong>Methods</strong></summary>

#### `estimateTokens()`

Estimate tokens for a string

```typescript
estimateTokens(text: string): number;
```

**Parameters:**
- `text`: `string`

**Returns:** `number`

#### `estimateDataTokens()`

Estimate tokens for arbitrary data (will be JSON stringified)

```typescript
estimateDataTokens(data: unknown): number;
```

**Parameters:**
- `data`: `unknown`

**Returns:** `number`

#### `estimateImageTokens()?`

Estimate tokens for an image. Provider-specific implementations can override.

Default heuristic (matches OpenAI's image token pricing):
- detail='low': 85 tokens
- detail='high' with known dimensions: 85 + 170 * ceil(w/512) * ceil(h/512)
- Unknown dimensions: ~1000 tokens (conservative default)

```typescript
estimateImageTokens?(width?: number, height?: number, detail?: string): number;
```

**Parameters:**
- `width`: `number | undefined` *(optional)*
- `height`: `number | undefined` *(optional)*
- `detail`: `string | undefined` *(optional)*

**Returns:** `number`

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

📍 [`src/domain/entities/Connector.ts:85`](src/domain/entities/Connector.ts)

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
| `extra?` | `extra?: Record&lt;string, string&gt;;` | Vendor-specific extra credentials |

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

### LoggingPluginOptions `interface`

📍 [`src/core/tool-execution/plugins/LoggingPlugin.ts:20`](src/core/tool-execution/plugins/LoggingPlugin.ts)

Configuration options for LoggingPlugin

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `level?` | `level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';` | Log level for start/complete messages.
Default: 'debug' |
| `errorLevel?` | `errorLevel?: 'warn' | 'error';` | Log level for error messages.
Default: 'error' |
| `logArgs?` | `logArgs?: boolean;` | Whether to include tool arguments in logs.
Set to false for tools with sensitive data.
Default: true |
| `logResult?` | `logResult?: boolean;` | Whether to include result summary in completion logs.
Default: true |
| `maxLogLength?` | `maxLogLength?: number;` | Maximum length for argument/result strings in logs.
Default: 200 |
| `logger?` | `logger?: FrameworkLogger;` | Custom logger instance. If not provided, uses framework logger. |
| `component?` | `component?: string;` | Component name for the logger.
Default: 'ToolExecution' |

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

📍 [`src/domain/entities/MCPConfig.ts:104`](src/domain/entities/MCPConfig.ts)

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
| `connectorBindings?` | `connectorBindings?: Record&lt;string, string&gt;;` | Map environment variable keys to connector names for runtime auth resolution.
When connecting, the connector's token will be injected into the env var.
Example: { 'GITHUB_PERSONAL_ACCESS_TOKEN': 'my-github-connector' } |

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

### OversizedInputResult `interface`

📍 [`src/core/context-nextgen/types.ts:443`](src/core/context-nextgen/types.ts)

Result of handling oversized current input

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `accepted` | `accepted: boolean;` | Whether the input was accepted (possibly truncated) |
| `content` | `content: string;` | Processed content (truncated if needed) |
| `error?` | `error?: string;` | Error message if rejected |
| `warning?` | `warning?: string;` | Warning message if truncated |
| `originalSize` | `originalSize: number;` | Original size in bytes |
| `finalSize` | `finalSize: number;` | Final size in bytes |

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

### PersistentInstructionsConfig `interface`

📍 [`src/core/context-nextgen/plugins/PersistentInstructionsPluginNextGen.ts:29`](src/core/context-nextgen/plugins/PersistentInstructionsPluginNextGen.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agentId` | `agentId: string;` | Agent ID - used to determine storage path (REQUIRED) |
| `storage?` | `storage?: IPersistentInstructionsStorage;` | Custom storage implementation (default: FilePersistentInstructionsStorage) |
| `maxTotalLength?` | `maxTotalLength?: number;` | Maximum total content length across all entries in characters (default: 50000) |
| `maxEntries?` | `maxEntries?: number;` | Maximum number of entries (default: 50) |

</details>

---

### PieceMetadata `interface`

📍 [`src/capabilities/documents/types.ts:27`](src/capabilities/documents/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `sourceFilename` | `sourceFilename: string;` | - |
| `format` | `format: DocumentFormat;` | - |
| `index` | `index: number;` | - |
| `section?` | `section?: string;` | - |
| `sizeBytes` | `sizeBytes: number;` | - |
| `estimatedTokens` | `estimatedTokens: number;` | - |
| `label?` | `label?: string;` | - |

</details>

---

### PluginConfigs `interface`

📍 [`src/core/context-nextgen/types.ts:499`](src/core/context-nextgen/types.ts)

Plugin configurations for auto-initialization.
When features are enabled, plugins are created with these configs.
The config shapes match each plugin's constructor parameter.

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `workingMemory?` | `workingMemory?: Record&lt;string, unknown&gt;;` | Working memory plugin config (used when features.workingMemory=true).
See WorkingMemoryPluginConfig for full options. |
| `inContextMemory?` | `inContextMemory?: Record&lt;string, unknown&gt;;` | In-context memory plugin config (used when features.inContextMemory=true).
See InContextMemoryConfig for full options. |
| `persistentInstructions?` | `persistentInstructions?: Record&lt;string, unknown&gt;;` | Persistent instructions plugin config (used when features.persistentInstructions=true).
Note: agentId is auto-filled from context config if not provided.
See PersistentInstructionsConfig for full options. |

</details>

---

### PluginExecutionContext `interface`

📍 [`src/core/tool-execution/types.ts:16`](src/core/tool-execution/types.ts)

Context passed through the execution pipeline.
Contains all information about the current tool execution.

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `toolName` | `toolName: string;` | Name of the tool being executed |
| `args` | `readonly args: unknown;` | Original arguments passed to the tool (immutable) |
| `mutableArgs` | `mutableArgs: unknown;` | Mutable arguments that plugins can modify |
| `metadata` | `metadata: Map&lt;string, unknown&gt;;` | Metadata for passing data between plugins |
| `startTime` | `startTime: number;` | Timestamp when execution started (ms since epoch) |
| `tool` | `tool: ToolFunction;` | The tool function being executed |
| `executionId` | `executionId: string;` | Unique execution ID for tracing |

</details>

---

### PreparedContext `interface`

📍 [`src/core/context-nextgen/types.ts:422`](src/core/context-nextgen/types.ts)

Result of prepare() - ready for LLM call

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `input` | `input: InputItem[];` | Final input items array for LLM |
| `budget` | `budget: ContextBudget;` | Token budget breakdown |
| `compacted` | `compacted: boolean;` | Whether compaction was performed |
| `compactionLog` | `compactionLog: string[];` | Log of compaction actions taken |

</details>

---

### ReadFileResult `interface`

📍 [`src/tools/filesystem/types.ts:93`](src/tools/filesystem/types.ts)

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

📍 [`src/capabilities/scrape/ScrapeProvider.ts:57`](src/capabilities/scrape/ScrapeProvider.ts)

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

📍 [`src/capabilities/scrape/ScrapeProvider.ts:179`](src/capabilities/scrape/ScrapeProvider.ts)

ScrapeProvider factory configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `connector` | `connector: string | Connector;` | Connector name or instance |

</details>

---

### ScrapeProviderFallbackConfig `interface`

📍 [`src/capabilities/scrape/ScrapeProvider.ts:187`](src/capabilities/scrape/ScrapeProvider.ts)

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

📍 [`src/capabilities/scrape/ScrapeProvider.ts:81`](src/capabilities/scrape/ScrapeProvider.ts)

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

📍 [`src/capabilities/scrape/ScrapeProvider.ts:29`](src/capabilities/scrape/ScrapeProvider.ts)

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

### SerializedPersistentInstructionsState `interface`

📍 [`src/core/context-nextgen/plugins/PersistentInstructionsPluginNextGen.ts:40`](src/core/context-nextgen/plugins/PersistentInstructionsPluginNextGen.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `entries` | `entries: InstructionEntry[];` | - |
| `agentId` | `agentId: string;` | - |
| `version` | `version: 2;` | - |

</details>

---

### ServiceDefinition `interface`

📍 [`src/domain/entities/Services.ts:29`](src/domain/entities/Services.ts)

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

📍 [`src/domain/entities/Services.ts:454`](src/domain/entities/Services.ts)

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

### StorageConfig `interface`

📍 [`src/core/StorageRegistry.ts:66`](src/core/StorageRegistry.ts)

Storage configuration map.

Global singletons are stored directly.
Per-agent factories are functions that accept an agentId (and optional
StorageContext for multi-tenant scenarios) and return a storage instance.

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `media` | `media: IMediaStorage;` | - |
| `agentDefinitions` | `agentDefinitions: IAgentDefinitionStorage;` | - |
| `connectorConfig` | `connectorConfig: IConnectorConfigStorage;` | - |
| `oauthTokens` | `oauthTokens: ITokenStorage;` | - |
| `customTools` | `customTools: (context?: StorageContext) =&gt; ICustomToolStorage;` | - |
| `sessions` | `sessions: (agentId: string, context?: StorageContext) =&gt; IContextStorage;` | - |
| `persistentInstructions` | `persistentInstructions: (agentId: string, context?: StorageContext) =&gt; IPersistentInstructionsStorage;` | - |
| `workingMemory` | `workingMemory: (context?: StorageContext) =&gt; IMemoryStorage;` | - |

</details>

---

### StrategyInfo `interface`

📍 [`src/core/context-nextgen/strategies/StrategyRegistry.ts:42`](src/core/context-nextgen/strategies/StrategyRegistry.ts)

Strategy information for UI display (serializable, no class reference)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: string;` | Strategy name (unique identifier) |
| `displayName` | `displayName: string;` | Human-readable name for UI |
| `description` | `description: string;` | Description explaining the strategy behavior |
| `threshold` | `threshold: number;` | Compaction threshold (0-1, e.g., 0.70 = 70%) |
| `isBuiltIn` | `isBuiltIn: boolean;` | Whether this is a built-in strategy |

</details>

---

### StrategyRegistryEntry `interface`

📍 [`src/core/context-nextgen/strategies/StrategyRegistry.ts:62`](src/core/context-nextgen/strategies/StrategyRegistry.ts)

Full strategy registry entry (includes class reference)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `strategyClass` | `strategyClass: StrategyClass;` | Strategy constructor class |

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
| `type` | `type: 'string' | 'number' | 'boolean' | 'enum' | 'array';` | Data type of the option |
| `description` | `description: string;` | Description of the option |
| `required?` | `required?: boolean;` | Whether the option is required |
| `label?` | `label?: string;` | UI display label |
| `enum?` | `enum?: string[];` | Valid values for enum/string types |
| `default?` | `default?: unknown;` | Default value |
| `min?` | `min?: number;` | Minimum value for numbers |
| `max?` | `max?: number;` | Maximum value for numbers |
| `step?` | `step?: number;` | Step value for number sliders |
| `controlType?` | `controlType?: 'select' | 'radio' | 'slider' | 'checkbox' | 'text' | 'textarea';` | UI control type hint |

</details>

---

### WriteFileResult `interface`

📍 [`src/tools/filesystem/types.ts:107`](src/tools/filesystem/types.ts)

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

### AgentEventName `type`

📍 [`src/capabilities/agents/types/EventTypes.ts:206`](src/capabilities/agents/types/EventTypes.ts)

```typescript
type AgentEventName = AgenticLoopEventName
```

---

### AgentEvents `type`

📍 [`src/capabilities/agents/types/EventTypes.ts:205`](src/capabilities/agents/types/EventTypes.ts)

Agent events - alias for AgenticLoopEvents for cleaner API
This is the preferred export name going forward.

```typescript
type AgentEvents = AgenticLoopEvents
```

---

### AgenticLoopEventName `type`

📍 [`src/capabilities/agents/types/EventTypes.ts:199`](src/capabilities/agents/types/EventTypes.ts)

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

### BeforeExecuteResult `type`

📍 [`src/core/tool-execution/types.ts:46`](src/core/tool-execution/types.ts)

Result of a plugin's beforeExecute hook.

- `void` or `undefined`: Continue execution with original args
- `{ abort: true, result: ... }`: Abort and return this result immediately
- `{ modifiedArgs: ... }`: Continue with modified arguments

```typescript
type BeforeExecuteResult = | void
  | undefined
  | { abort: true; result: unknown }
  | { modifiedArgs: unknown }
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

📍 [`src/domain/entities/Content.ts:62`](src/domain/entities/Content.ts)

```typescript
type Content = | InputTextContent
  | InputImageContent
  | InputFileContent
  | OutputTextContent
  | ToolUseContent
  | ToolResultContent
```

---

### DocumentFamily `type`

📍 [`src/capabilities/documents/types.ts:17`](src/capabilities/documents/types.ts)

```typescript
type DocumentFamily = | 'office'
  | 'spreadsheet'
  | 'pdf'
  | 'html'
  | 'text'
  | 'image'
```

---

### DocumentFormat `type`

📍 [`src/capabilities/documents/types.ts:9`](src/capabilities/documents/types.ts)

Document Reader Types

Core types for the universal file-to-LLM-content converter.

```typescript
type DocumentFormat = | 'docx' | 'pptx' | 'odt' | 'odp' | 'ods' | 'rtf'
  | 'xlsx' | 'csv'
  | 'pdf'
  | 'html'
  | 'txt' | 'md' | 'json' | 'xml' | 'yaml' | 'yml'
  | 'png' | 'jpg' | 'jpeg' | 'gif' | 'webp' | 'svg'
```

---

### DocumentPiece `type`

📍 [`src/capabilities/documents/types.ts:52`](src/capabilities/documents/types.ts)

```typescript
type DocumentPiece = DocumentTextPiece | DocumentImagePiece
```

---

### DocumentSource `type`

📍 [`src/capabilities/documents/types.ts:104`](src/capabilities/documents/types.ts)

```typescript
type DocumentSource = FileSource | URLSource | BufferSource | BlobSource
```

---

### EvictionStrategy `type`

📍 [`src/core/context-nextgen/plugins/WorkingMemoryPluginNextGen.ts:167`](src/core/context-nextgen/plugins/WorkingMemoryPluginNextGen.ts)

```typescript
type EvictionStrategy = 'lru' | 'size'
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

### InContextPriority `type`

📍 [`src/core/context-nextgen/plugins/InContextMemoryPluginNextGen.ts:26`](src/core/context-nextgen/plugins/InContextMemoryPluginNextGen.ts)

```typescript
type InContextPriority = 'low' | 'normal' | 'high' | 'critical'
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

### MouseButton `type`

📍 [`src/tools/desktop/types.ts:13`](src/tools/desktop/types.ts)

Desktop Automation Tools - Types

Interfaces and types for OS-level desktop automation (screenshot, mouse, keyboard, windows).
All coordinates are in PHYSICAL pixel space (screenshot space).
The driver converts to logical OS coords internally using scaleFactor.

```typescript
type MouseButton = 'left' | 'right' | 'middle'
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

📍 [`src/capabilities/scrape/ScrapeProvider.ts:129`](src/capabilities/scrape/ScrapeProvider.ts)

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
type ServiceCategory = | 'major-vendors'
  | 'communication'
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

📍 [`src/domain/entities/Services.ts:425`](src/domain/entities/Services.ts)

Service type - union of all service IDs

```typescript
type ServiceType = (typeof SERVICE_DEFINITIONS)[number]['id']
```

---

### StorageContext `type`

📍 [`src/core/StorageRegistry.ts:57`](src/core/StorageRegistry.ts)

Opaque context passed to per-agent storage factories.

The library imposes no structure — consumers define their own shape
(e.g., `{ userId: 'alice', tenantId: 'acme' }`).

Mirrors the `ConnectorAccessContext` pattern used by `Connector.scoped()`.

```typescript
type StorageContext = Record&lt;string, unknown&gt;
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

### detectServiceFromURL `function`

📍 [`src/domain/entities/Services.ts:503`](src/domain/entities/Services.ts)

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

📍 [`src/domain/entities/Services.ts:539`](src/domain/entities/Services.ts)

Get all service IDs

```typescript
export function getAllServiceIds(): string[]
```

---

### getBackgroundOutput `function`

📍 [`src/tools/shell/bash.ts:331`](src/tools/shell/bash.ts)

Get output from a background process

```typescript
export function getBackgroundOutput(bgId: string):
```

---

### getDesktopDriver `function`

📍 [`src/tools/desktop/getDriver.ts:18`](src/tools/desktop/getDriver.ts)

Get (or create) the desktop driver instance.
If config.driver is provided, uses that instead of the default.

```typescript
export async function getDesktopDriver(config?: DesktopToolConfig): Promise&lt;IDesktopDriver&gt;
```

---

### getMediaStorage `function`

📍 [`src/tools/multimedia/config.ts:23`](src/tools/multimedia/config.ts)

Get the global media storage (creates default FileMediaStorage on first access)

```typescript
export function getMediaStorage(): IMediaStorage
```

---

### getRegisteredScrapeProviders `function`

📍 [`src/capabilities/scrape/ScrapeProvider.ts:170`](src/capabilities/scrape/ScrapeProvider.ts)

Get registered service types

```typescript
export function getRegisteredScrapeProviders(): string[]
```

---

### getServiceDefinition `function`

📍 [`src/domain/entities/Services.ts:525`](src/domain/entities/Services.ts)

Get service definition by service type

```typescript
export function getServiceDefinition(serviceType: string): ServiceDefinition | undefined
```

---

### getServiceInfo `function`

📍 [`src/domain/entities/Services.ts:518`](src/domain/entities/Services.ts)

Get service info by service type

```typescript
export function getServiceInfo(serviceType: string): ServiceInfo | undefined
```

---

### getServicesByCategory `function`

📍 [`src/domain/entities/Services.ts:532`](src/domain/entities/Services.ts)

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

📍 [`src/tools/filesystem/types.ts:264`](src/tools/filesystem/types.ts)

Check if a file extension should be excluded

```typescript
export function isExcludedExtension(
  filePath: string,
  excludeExtensions: string[] = DEFAULT_FILESYSTEM_CONFIG.excludeExtensions
): boolean
```

---

### isKnownService `function`

📍 [`src/domain/entities/Services.ts:546`](src/domain/entities/Services.ts)

Check if a service ID is known

```typescript
export function isKnownService(serviceId: string): boolean
```

---

### killBackgroundProcess `function`

📍 [`src/tools/shell/bash.ts:347`](src/tools/shell/bash.ts)

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

### mergeTextPieces `function`

📍 [`src/capabilities/documents/DocumentReader.ts:390`](src/capabilities/documents/DocumentReader.ts)

Merge text pieces into a single markdown string

```typescript
export function mergeTextPieces(pieces: DocumentPiece[]): string
```

---

### parseKeyCombo `function`

📍 [`src/tools/desktop/driver/NutTreeDriver.ts:70`](src/tools/desktop/driver/NutTreeDriver.ts)

Parse a key combo string like "ctrl+c", "cmd+shift+s", "enter"
Returns nut-tree Key enum values.

```typescript
export function parseKeyCombo(keys: string, KeyEnum: Record&lt;string, any&gt;): any[]
```

---

### parseRepository `function`

📍 [`src/tools/github/types.ts:31`](src/tools/github/types.ts)

Parse a repository string into owner and repo.

Accepts:
- "owner/repo" format
- Full GitHub URLs: "https://github.com/owner/repo", "https://github.com/owner/repo/..."

```typescript
export function parseRepository(input: string): GitHubRepository
```

---

### registerScrapeProvider `function`

📍 [`src/capabilities/scrape/ScrapeProvider.ts:160`](src/capabilities/scrape/ScrapeProvider.ts)

Register a scrape provider for a service type
Called by provider implementations to register themselves

```typescript
export function registerScrapeProvider(
  serviceType: string,
  providerClass: ProviderConstructor
): void
```

---

### resetDefaultDriver `function`

📍 [`src/tools/desktop/getDriver.ts:42`](src/tools/desktop/getDriver.ts)

Reset the default driver (for testing).

```typescript
export function resetDefaultDriver(): void
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

### resolveMaxContextTokens `function`

📍 [`src/infrastructure/providers/base/ModelCapabilityResolver.ts:51`](src/infrastructure/providers/base/ModelCapabilityResolver.ts)

Resolve the max context token limit for a specific model.
Used primarily for accurate error messages.

```typescript
export function resolveMaxContextTokens(
  model: string | undefined,
  fallback: number
): number
```

---

### resolveRepository `function`

📍 [`src/tools/github/types.ts:71`](src/tools/github/types.ts)

Resolve a repository from tool args or connector default.

Priority:
1. Explicit `repository` parameter
2. `connector.getOptions().defaultRepository`

```typescript
export function resolveRepository(
  repository: string | undefined,
  connector: Connector
):
```

---

### setMediaStorage `function`

📍 [`src/tools/multimedia/config.ts:32`](src/tools/multimedia/config.ts)

Set a custom global media storage

Call this before agent creation to use custom storage (S3, GCS, etc.)

```typescript
export function setMediaStorage(storage: IMediaStorage): void
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

📍 [`src/tools/filesystem/types.ts:176`](src/tools/filesystem/types.ts)

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

### DEFAULT_CONFIG `const`

📍 [`src/core/context-nextgen/types.ts:586`](src/core/context-nextgen/types.ts)

Default configuration values

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `responseReserve` | `4096` | - |
| `strategy` | `'algorithmic'` | - |

</details>

---

### DEFAULT_CONFIG `const`

📍 [`src/core/context-nextgen/plugins/InContextMemoryPluginNextGen.ts:66`](src/core/context-nextgen/plugins/InContextMemoryPluginNextGen.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxEntries` | `20` | - |
| `maxTotalTokens` | `4000` | - |
| `defaultPriority` | `'normal' as InContextPriority` | - |
| `showTimestamps` | `false` | - |

</details>

---

### DEFAULT_DESKTOP_CONFIG `const`

📍 [`src/tools/desktop/types.ts:109`](src/tools/desktop/types.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `driver` | `null as unknown as IDesktopDriver` | - |
| `humanDelay` | `[50, 150]` | - |
| `humanizeMovement` | `false` | - |

</details>

---

### DEFAULT_FEATURES `const`

📍 [`src/core/context-nextgen/types.ts:484`](src/core/context-nextgen/types.ts)

Default feature configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `workingMemory` | `true` | - |
| `inContextMemory` | `false` | - |
| `persistentInstructions` | `false` | - |

</details>

---

### DEFAULT_FILESYSTEM_CONFIG `const`

📍 [`src/tools/filesystem/types.ts:72`](src/tools/filesystem/types.ts)

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
    // Note: .pdf, .docx, .xlsx, .pptx are NOT excluded — DocumentReader handles them
    '.doc', '.xls', '.ppt', // Legacy Office formats not yet supported
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
  ]` | - |

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

### simpleTokenEstimator `const`

📍 [`src/core/context-nextgen/BasePluginNextGen.ts:31`](src/core/context-nextgen/BasePluginNextGen.ts)

Simple token estimator used by plugins.

Uses character-based approximation (~3.5 chars/token) which is
accurate enough for budget management purposes. For precise
tokenization, you can provide a custom estimator via the
`estimator` protected property.

---
