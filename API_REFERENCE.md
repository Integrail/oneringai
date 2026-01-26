# @oneringai/agents - API Reference

**Generated:** 2026-01-25
**Mode:** public

This document provides a complete reference for the public API of `@oneringai/agents`.

For usage examples and tutorials, see the [User Guide](./USER_GUIDE.md).

> **Note:** This documentation is auto-generated from source code. Items marked with `@internal` are excluded.

## Table of Contents

- [Core](#core) (7 items)
- [Text-to-Speech (TTS)](#text-to-speech-tts-) (9 items)
- [Speech-to-Text (STT)](#speech-to-text-stt-) (11 items)
- [Image Generation](#image-generation) (21 items)
- [Video Generation](#video-generation) (17 items)
- [Task Agents](#task-agents) (69 items)
- [Universal Agent](#universal-agent) (15 items)
- [Context Management](#context-management) (20 items)
- [Session Management](#session-management) (22 items)
- [Tools & Function Calling](#tools-function-calling) (42 items)
- [Streaming](#streaming) (15 items)
- [Model Registry](#model-registry) (9 items)
- [OAuth & External APIs](#oauth-external-apis) (10 items)
- [Resilience & Observability](#resilience-observability) (28 items)
- [Errors](#errors) (8 items)
- [Utilities](#utilities) (2 items)
- [Interfaces](#interfaces) (14 items)
- [Base Classes](#base-classes) (3 items)
- [Other](#other) (44 items)

## Core

Core classes for authentication, agents, and providers

### Agent `class`

📍 [`src/core/Agent.ts:85`](src/core/Agent.ts)

Agent class - represents an AI assistant with tool calling capabilities

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

#### `addTool()`

Add a tool to the agent

```typescript
addTool(tool: ToolFunction): void
```

**Parameters:**
- `tool`: `ToolFunction&lt;any, any&gt;`

**Returns:** `void`

#### `removeTool()`

Remove a tool from the agent

```typescript
removeTool(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `listTools()`

List registered tools (returns enabled tool names)

```typescript
listTools(): string[]
```

**Returns:** `string[]`

#### `setTools()`

Replace all tools with a new array

```typescript
setTools(tools: ToolFunction[]): void
```

**Parameters:**
- `tools`: `ToolFunction&lt;any, any&gt;[]`

**Returns:** `void`

#### `getSessionId()`

Get the current session ID (if session is enabled)

```typescript
getSessionId(): string | null
```

**Returns:** `string | null`

#### `hasSession()`

Check if this agent has session support enabled

```typescript
hasSession(): boolean
```

**Returns:** `boolean`

#### `saveSession()`

Save the current session to storage

```typescript
async saveSession(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `getSession()`

Get the current session (for advanced use)

```typescript
getSession(): Session | null
```

**Returns:** `Session | null`

#### `updateSessionData()`

Update session custom data

```typescript
updateSessionData(key: string, value: unknown): void
```

**Parameters:**
- `key`: `string`
- `value`: `unknown`

**Returns:** `void`

#### `getSessionData()`

Get session custom data

```typescript
getSessionData&lt;T = unknown&gt;(key: string): T | undefined
```

**Parameters:**
- `key`: `string`

**Returns:** `T | undefined`

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

#### `onCleanup()`

```typescript
onCleanup(callback: () =&gt; void): void
```

**Parameters:**
- `callback`: `() =&gt; void`

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
| `connector` | `connector: Connector` | - |
| `model` | `model: string` | - |
| `config` | `config: AgentConfig` | - |
| `provider` | `provider: ITextProvider` | - |
| `toolRegistry` | `toolRegistry: ToolRegistry` | - |
| `agenticLoop` | `agenticLoop: AgenticLoop` | - |
| `cleanupCallbacks` | `cleanupCallbacks: (() =&gt; void)[]` | - |
| `boundListeners` | `boundListeners: Map&lt;keyof AgenticLoopEvents, (...args: any[]) =&gt; void&gt;` | - |
| `logger` | `logger: FrameworkLogger` | - |

</details>

---

### Connector `class`

📍 [`src/core/Connector.ts:18`](src/core/Connector.ts)

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

#### `dispose()`

Dispose of resources

```typescript
dispose(): void
```

**Returns:** `void`

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
| `disposed` | `disposed: boolean` | - |

</details>

---

### AgentConfig `interface`

📍 [`src/core/Agent.ts:44`](src/core/Agent.ts)

Agent configuration - new simplified interface

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `connector` | `connector: string | Connector;` | - |
| `model` | `model: string;` | - |
| `name?` | `name?: string;` | - |
| `instructions?` | `instructions?: string;` | - |
| `tools?` | `tools?: ToolFunction[];` | - |
| `temperature?` | `temperature?: number;` | - |
| `maxIterations?` | `maxIterations?: number;` | - |
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
| `session?` | `session?: AgentSessionConfig;` | Session configuration for persistence (opt-in) |
| `toolManager?` | `toolManager?: ToolManager;` | Provide a pre-configured ToolManager (advanced) |

</details>

---

### AgentSessionConfig `interface`

📍 [`src/core/Agent.ts:30`](src/core/Agent.ts)

Session configuration for Agent

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

### ContextManager `class`

📍 [`src/capabilities/taskAgent/ContextManager.ts:136`](src/capabilities/taskAgent/ContextManager.ts)

ContextManager handles context window management.

Features:
- Token estimation (approximate or tiktoken)
- Proactive compaction before overflow
- Configurable compaction strategies
- Tool output truncation

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    config: ContextManagerConfig = DEFAULT_CONTEXT_CONFIG,
    strategy: CompactionStrategy = DEFAULT_COMPACTION_STRATEGY
  )
```

**Parameters:**
- `config`: `ContextManagerConfig` *(optional)* (default: `DEFAULT_CONTEXT_CONFIG`)
- `strategy`: `CompactionStrategy` *(optional)* (default: `DEFAULT_COMPACTION_STRATEGY`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `estimateTokens()`

Estimate token count for text

```typescript
estimateTokens(text: string): number
```

**Parameters:**
- `text`: `string`

**Returns:** `number`

#### `estimateBudget()`

Estimate budget for context components

```typescript
estimateBudget(components: ContextComponents): ContextBudget
```

**Parameters:**
- `components`: `ContextComponents`

**Returns:** `ContextBudget`

#### `prepareContext()`

Prepare context, compacting if necessary

```typescript
async prepareContext(
    components: ContextComponents,
    memory: IMemoryManager,
    history: IHistoryManager
  ): Promise&lt;PreparedContext&gt;
```

**Parameters:**
- `components`: `ContextComponents`
- `memory`: `IMemoryManager`
- `history`: `IHistoryManager`

**Returns:** `Promise&lt;PreparedContext&gt;`

#### `truncateToolOutput()`

Truncate tool output to fit within limit

```typescript
truncateToolOutput(output: unknown, maxTokens: number): unknown
```

**Parameters:**
- `output`: `unknown`
- `maxTokens`: `number`

**Returns:** `unknown`

#### `createOutputSummary()`

Create summary of large output

```typescript
createOutputSummary(output: unknown, maxTokens: number): string
```

**Parameters:**
- `output`: `unknown`
- `maxTokens`: `number`

**Returns:** `string`

#### `shouldAutoStore()`

Check if output should be auto-stored in memory

```typescript
shouldAutoStore(output: unknown, threshold: number): boolean
```

**Parameters:**
- `output`: `unknown`
- `threshold`: `number`

**Returns:** `boolean`

#### `getCurrentBudget()`

Get current context budget

```typescript
getCurrentBudget(): ContextBudget | null
```

**Returns:** `ContextBudget | null`

#### `getConfig()`

Get current configuration

```typescript
getConfig(): ContextManagerConfig
```

**Returns:** `ContextManagerConfig`

#### `getStrategy()`

Get current compaction strategy

```typescript
getStrategy(): CompactionStrategy
```

**Returns:** `CompactionStrategy`

#### `updateConfig()`

Update configuration

```typescript
updateConfig(updates: Partial&lt;ContextManagerConfig&gt;): void
```

**Parameters:**
- `updates`: `Partial&lt;ContextManagerConfig&gt;`

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `config` | `config: ContextManagerConfig` | - |
| `strategy` | `strategy: CompactionStrategy` | - |
| `lastBudget?` | `lastBudget: ContextBudget | undefined` | - |

</details>

---

### ExternalDependencyHandler `class`

📍 [`src/capabilities/taskAgent/ExternalDependencyHandler.ts:20`](src/capabilities/taskAgent/ExternalDependencyHandler.ts)

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
| `tools` | `tools: Map&lt;string, ToolFunction&lt;any, any&gt;&gt;` | - |

</details>

---

### HistoryManager `class`

📍 [`src/capabilities/taskAgent/HistoryManager.ts:34`](src/capabilities/taskAgent/HistoryManager.ts)

Manages conversation history with automatic compaction

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: HistoryManagerConfig = DEFAULT_HISTORY_CONFIG)
```

**Parameters:**
- `config`: `HistoryManagerConfig` *(optional)* (default: `DEFAULT_HISTORY_CONFIG`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `addMessage()`

Add a message to history

```typescript
addMessage(role: 'user' | 'assistant' | 'system', content: string): void
```

**Parameters:**
- `role`: `"user" | "assistant" | "system"`
- `content`: `string`

**Returns:** `void`

#### `getMessages()`

Get all messages (including summaries as system messages)

```typescript
getMessages(): ConversationMessage[]
```

**Returns:** `ConversationMessage[]`

#### `getRecentMessages()`

Get recent messages only (no summaries)

```typescript
getRecentMessages(): ConversationMessage[]
```

**Returns:** `ConversationMessage[]`

#### `summarize()`

Summarize history (requires LLM - placeholder)

```typescript
async summarize(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `truncate()`

Truncate messages to a limit

```typescript
async truncate(messages: ConversationMessage[], limit: number): Promise&lt;ConversationMessage[]&gt;
```

**Parameters:**
- `messages`: `ConversationMessage[]`
- `limit`: `number`

**Returns:** `Promise&lt;ConversationMessage[]&gt;`

#### `clear()`

Clear all history

```typescript
clear(): void
```

**Returns:** `void`

#### `getMessageCount()`

Get total message count

```typescript
getMessageCount(): number
```

**Returns:** `number`

#### `getState()`

Get history state for persistence

```typescript
getState():
```

**Returns:** `{ messages: ConversationMessage[]; summaries: { content: string; coversMessages: number; timestamp: number; }[]; }`

#### `restoreState()`

Restore history from state

```typescript
restoreState(state:
```

**Parameters:**
- `state`: `{ messages: ConversationMessage[]; summaries: { content: string; coversMessages: number; timestamp: number; }[]; }`

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `messages` | `messages: ConversationMessage[]` | - |
| `summaries` | `summaries: { content: string; coversMessages: number; timestamp: number; }[]` | - |
| `config` | `config: HistoryManagerConfig` | - |

</details>

---

### IdempotencyCache `class`

📍 [`src/capabilities/taskAgent/IdempotencyCache.ts:45`](src/capabilities/taskAgent/IdempotencyCache.ts)

IdempotencyCache handles tool call result caching.

Features:
- Cache based on tool name + args
- Custom key generation per tool
- TTL-based expiration
- Max entries eviction

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

Clear all cached results

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

### PlanExecutor `class`

📍 [`src/capabilities/taskAgent/PlanExecutor.ts:51`](src/capabilities/taskAgent/PlanExecutor.ts)

Executes a plan using LLM and tools

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    agent: Agent,
    memory: WorkingMemory,
    contextManager: ContextManager,
    idempotencyCache: IdempotencyCache,
    historyManager: HistoryManager,
    externalHandler: ExternalDependencyHandler,
    checkpointManager: CheckpointManager,
    hooks: TaskAgentHooks | undefined,
    config: PlanExecutorConfig
  )
```

**Parameters:**
- `agent`: `Agent`
- `memory`: `WorkingMemory`
- `contextManager`: `ContextManager`
- `idempotencyCache`: `IdempotencyCache`
- `historyManager`: `HistoryManager`
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

Cleanup resources

```typescript
cleanup(): void
```

**Returns:** `void`

#### `getIdempotencyCache()`

Get idempotency cache

```typescript
getIdempotencyCache(): IdempotencyCache
```

**Returns:** `IdempotencyCache`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agent` | `agent: Agent` | - |
| `memory` | `memory: WorkingMemory` | - |
| `contextManager` | `contextManager: ContextManager` | - |
| `idempotencyCache` | `idempotencyCache: IdempotencyCache` | - |
| `historyManager` | `historyManager: HistoryManager` | - |
| `externalHandler` | `externalHandler: ExternalDependencyHandler` | - |
| `checkpointManager` | `checkpointManager: CheckpointManager` | - |
| `hooks` | `hooks: TaskAgentHooks | undefined` | - |
| `config` | `config: PlanExecutorConfig` | - |
| `abortController` | `abortController: AbortController` | - |
| `currentMetrics` | `currentMetrics: { totalLLMCalls: number; totalToolCalls: number; totalTokensUsed: number; totalCost: number; }` | - |
| `currentState` | `currentState: AgentState | null` | - |

</details>

---

### TaskAgent `class`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:197`](src/capabilities/taskAgent/TaskAgent.ts)

TaskAgent - autonomous task-based agent.

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
    storage: IAgentStorage,
    memory: WorkingMemory,
    config: TaskAgentConfig,
    hooks?: TaskAgentHooks
  )
```

**Parameters:**
- `id`: `string`
- `state`: `AgentState`
- `storage`: `IAgentStorage`
- `memory`: `WorkingMemory`
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
- `options`: `{ storage: IAgentStorage; tools?: ToolFunction&lt;any, any&gt;[] | undefined; hooks?: TaskAgentHooks | undefined; }`

**Returns:** `Promise&lt;TaskAgent&gt;`

</details>

<details>
<summary><strong>Methods</strong></summary>

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

Update the plan

```typescript
async updatePlan(updates: PlanUpdates): Promise&lt;void&gt;
```

**Parameters:**
- `updates`: `PlanUpdates`

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

Get working memory

```typescript
getMemory(): WorkingMemory
```

**Returns:** `WorkingMemory`

#### `getSessionId()`

Get the current session ID (if session is enabled)

```typescript
getSessionId(): string | null
```

**Returns:** `string | null`

#### `hasSession()`

Check if this agent has session support enabled

```typescript
hasSession(): boolean
```

**Returns:** `boolean`

#### `saveSession()`

Save the current session to storage

```typescript
async saveSession(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `getSession()`

Get the current session (for advanced use)

```typescript
getSession(): Session | null
```

**Returns:** `Session | null`

#### `updateSessionData()`

Update session custom data

```typescript
updateSessionData(key: string, value: unknown): void
```

**Parameters:**
- `key`: `string`
- `value`: `unknown`

**Returns:** `void`

#### `getSessionData()`

Get session custom data

```typescript
getSessionData&lt;T = unknown&gt;(key: string): T | undefined
```

**Parameters:**
- `key`: `string`

**Returns:** `T | undefined`

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
| `storage` | `storage: IAgentStorage` | - |
| `memory` | `memory: WorkingMemory` | - |
| `hooks?` | `hooks: TaskAgentHooks | undefined` | - |
| `executionPromise?` | `executionPromise: Promise&lt;PlanResult&gt; | undefined` | - |
| `agent?` | `agent: Agent | undefined` | - |
| `contextManager?` | `contextManager: ContextManager | undefined` | - |
| `idempotencyCache?` | `idempotencyCache: IdempotencyCache | undefined` | - |
| `historyManager?` | `historyManager: HistoryManager | undefined` | - |
| `externalHandler?` | `externalHandler: ExternalDependencyHandler | undefined` | - |
| `planExecutor?` | `planExecutor: PlanExecutor | undefined` | - |
| `checkpointManager?` | `checkpointManager: CheckpointManager | undefined` | - |
| `config` | `config: TaskAgentConfig` | - |
| `eventCleanupFunctions` | `eventCleanupFunctions: (() =&gt; void)[]` | - |

</details>

---

### TaskAgentContextProvider `class`

📍 [`src/infrastructure/context/providers/TaskAgentContextProvider.ts:23`](src/infrastructure/context/providers/TaskAgentContextProvider.ts)

Context provider for TaskAgent

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(config: TaskAgentContextProviderConfig)
```

**Parameters:**
- `config`: `TaskAgentContextProviderConfig`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `getComponents()`

```typescript
async getComponents(): Promise&lt;IContextComponent[]&gt;
```

**Returns:** `Promise&lt;IContextComponent[]&gt;`

#### `applyCompactedComponents()`

```typescript
async applyCompactedComponents(components: IContextComponent[]): Promise&lt;void&gt;
```

**Parameters:**
- `components`: `IContextComponent[]`

**Returns:** `Promise&lt;void&gt;`

#### `getMaxContextSize()`

```typescript
getMaxContextSize(): number
```

**Returns:** `number`

#### `updateConfig()`

Update configuration (e.g., when task changes)

```typescript
updateConfig(updates: Partial&lt;TaskAgentContextProviderConfig&gt;): void
```

**Parameters:**
- `updates`: `Partial&lt;TaskAgentContextProviderConfig&gt;`

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `config` | `config: TaskAgentContextProviderConfig` | - |

</details>

---

### WorkingMemory `class`

📍 [`src/capabilities/taskAgent/WorkingMemory.ts:31`](src/capabilities/taskAgent/WorkingMemory.ts)

WorkingMemory manages the agent's indexed working memory.

Features:
- Store/retrieve with descriptions for index
- Scoped memory (task vs persistent)
- LRU eviction when approaching limits
- Event emission for monitoring

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(storage: IMemoryStorage, config: WorkingMemoryConfig = DEFAULT_MEMORY_CONFIG)
```

**Parameters:**
- `storage`: `IMemoryStorage`
- `config`: `WorkingMemoryConfig` *(optional)* (default: `DEFAULT_MEMORY_CONFIG`)

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `store()`

Store a value in working memory

```typescript
async store(
    key: string,
    description: string,
    value: unknown,
    scope: MemoryScope = 'task'
  ): Promise&lt;void&gt;
```

**Parameters:**
- `key`: `string`
- `description`: `string`
- `value`: `unknown`
- `scope`: `MemoryScope` *(optional)* (default: `'task'`)

**Returns:** `Promise&lt;void&gt;`

#### `retrieve()`

Retrieve a value from working memory

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

Promote a task-scoped entry to persistent

```typescript
async persist(key: string): Promise&lt;void&gt;
```

**Parameters:**
- `key`: `string`

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

Get memory index

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

#### `evictLRU()`

Evict least recently used entries

```typescript
async evictLRU(count: number): Promise&lt;string[]&gt;
```

**Parameters:**
- `count`: `number`

**Returns:** `Promise&lt;string[]&gt;`

#### `evictBySize()`

Evict largest entries first

```typescript
async evictBySize(count: number): Promise&lt;string[]&gt;
```

**Parameters:**
- `count`: `number`

**Returns:** `Promise&lt;string[]&gt;`

#### `getAccess()`

Get limited memory access for tools

```typescript
getAccess(): WorkingMemoryAccess
```

**Returns:** `WorkingMemoryAccess`

#### `getLimit()`

Get the configured memory limit

```typescript
getLimit(): number
```

**Returns:** `number`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `storage` | `storage: IMemoryStorage` | - |
| `config` | `config: WorkingMemoryConfig` | - |

</details>

---

### AgentHandle `interface`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:108`](src/capabilities/taskAgent/TaskAgent.ts)

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

### CacheStats `interface`

📍 [`src/capabilities/taskAgent/IdempotencyCache.ts:21`](src/capabilities/taskAgent/IdempotencyCache.ts)

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

### ContextBudget `interface`

📍 [`src/capabilities/taskAgent/ContextManager.ts:58`](src/capabilities/taskAgent/ContextManager.ts)

Context budget breakdown

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `total` | `total: number;` | - |
| `reserved` | `reserved: number;` | - |
| `used` | `used: number;` | - |
| `available` | `available: number;` | - |
| `utilizationPercent` | `utilizationPercent: number;` | - |
| `status` | `status: 'ok' | 'warning' | 'critical';` | - |
| `breakdown` | `breakdown: {
    systemPrompt: number;
    instructions: number;
    memoryIndex: number;
    conversationHistory: number;
    currentInput: number;
  };` | - |

</details>

---

### ContextManagerConfig `interface`

📍 [`src/capabilities/taskAgent/ContextManager.ts:10`](src/capabilities/taskAgent/ContextManager.ts)

Context manager configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxContextTokens` | `maxContextTokens: number;` | Model's max context tokens |
| `compactionThreshold` | `compactionThreshold: number;` | Trigger compaction at this % of max |
| `hardLimit` | `hardLimit: number;` | Hard limit - must compact before LLM call |
| `responseReserve` | `responseReserve: number;` | Reserve space for response |
| `tokenEstimator` | `tokenEstimator: 'approximate' | 'tiktoken';` | Token estimator method |

</details>

---

### ErrorContext `interface`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:84`](src/capabilities/taskAgent/TaskAgent.ts)

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

📍 [`src/domain/entities/Task.ts:56`](src/domain/entities/Task.ts)

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

📍 [`src/capabilities/taskAgent/ExternalDependencyHandler.ts:9`](src/capabilities/taskAgent/ExternalDependencyHandler.ts)

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

### HistoryManagerConfig `interface`

📍 [`src/capabilities/taskAgent/HistoryManager.ts:7`](src/capabilities/taskAgent/HistoryManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxDetailedMessages` | `maxDetailedMessages: number;` | Max messages to keep in full detail |
| `compressionStrategy` | `compressionStrategy: 'summarize' | 'truncate' | 'drop';` | Strategy for older messages |
| `summarizeBatchSize` | `summarizeBatchSize: number;` | For summarize: how many messages per summary |
| `maxHistoryTokens?` | `maxHistoryTokens?: number;` | Max total tokens for history (estimated) |
| `preserveToolCalls` | `preserveToolCalls: boolean;` | Keep all tool calls/results or summarize them too |

</details>

---

### IdempotencyCacheConfig `interface`

📍 [`src/capabilities/taskAgent/IdempotencyCache.ts:10`](src/capabilities/taskAgent/IdempotencyCache.ts)

Cache configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `defaultTtlMs` | `defaultTtlMs: number;` | Default TTL for cached entries |
| `maxEntries` | `maxEntries: number;` | Max entries before eviction |

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

📍 [`src/domain/entities/Memory.ts:15`](src/domain/entities/Memory.ts)

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
| `createdAt` | `createdAt: number;` | - |
| `lastAccessedAt` | `lastAccessedAt: number;` | - |
| `accessCount` | `accessCount: number;` | - |

</details>

---

### MemoryIndex `interface`

📍 [`src/domain/entities/Memory.ts:39`](src/domain/entities/Memory.ts)

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

📍 [`src/domain/entities/Memory.ts:29`](src/domain/entities/Memory.ts)

Index entry (lightweight, always in context)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `key` | `key: string;` | - |
| `description` | `description: string;` | - |
| `size` | `size: string;` | - |
| `scope` | `scope: MemoryScope;` | - |

</details>

---

### Plan `interface`

📍 [`src/domain/entities/Task.ts:173`](src/domain/entities/Task.ts)

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

📍 [`src/capabilities/universalAgent/types.ts:167`](src/capabilities/universalAgent/types.ts)

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

📍 [`src/domain/entities/Task.ts:165`](src/domain/entities/Task.ts)

Plan concurrency settings

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxParallelTasks` | `maxParallelTasks: number;` | - |
| `strategy` | `strategy: 'fifo' | 'priority' | 'shortest-first';` | - |

</details>

---

### PlanExecutionResult `interface`

📍 [`src/capabilities/taskAgent/PlanExecutor.ts:34`](src/capabilities/taskAgent/PlanExecutor.ts)

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

📍 [`src/capabilities/taskAgent/PlanExecutor.ts:18`](src/capabilities/taskAgent/PlanExecutor.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxIterations` | `maxIterations: number;` | - |
| `taskTimeout?` | `taskTimeout?: number;` | - |

</details>

---

### PlanExecutorEvents `interface`

📍 [`src/capabilities/taskAgent/PlanExecutor.ts:23`](src/capabilities/taskAgent/PlanExecutor.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'task:start'` | `'task:start': { task: Task };` | - |
| `'task:complete'` | `'task:complete': { task: Task; result: any };` | - |
| `'task:failed'` | `'task:failed': { task: Task; error: Error };` | - |
| `'task:skipped'` | `'task:skipped': { task: Task; reason: string };` | - |
| `'task:waiting_external'` | `'task:waiting_external': { task: Task };` | - |
| `'llm:call'` | `'llm:call': { iteration: number };` | - |
| `'tool:call'` | `'tool:call': { toolName: string; args: any };` | - |
| `'tool:result'` | `'tool:result': { toolName: string; result: any };` | - |

</details>

---

### PlanInput `interface`

📍 [`src/domain/entities/Task.ts:212`](src/domain/entities/Task.ts)

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

</details>

---

### PlanResult `interface`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:93`](src/capabilities/taskAgent/TaskAgent.ts)

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

### PlanUpdates `interface`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:122`](src/capabilities/taskAgent/TaskAgent.ts)

Plan update options

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `addTasks?` | `addTasks?: TaskInput[];` | - |
| `updateTasks?` | `updateTasks?: Array&lt;{ id: string } & Partial&lt;Task&gt;&gt;;` | - |
| `removeTasks?` | `removeTasks?: string[];` | - |

</details>

---

### PreparedContext `interface`

📍 [`src/capabilities/taskAgent/ContextManager.ts:77`](src/capabilities/taskAgent/ContextManager.ts)

Prepared context result

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `components` | `components: ContextComponents;` | - |
| `budget` | `budget: ContextBudget;` | - |
| `compacted` | `compacted: boolean;` | - |
| `compactionLog?` | `compactionLog?: string[];` | - |

</details>

---

### SerializedMemory `interface`

📍 [`src/core/SessionManager.ts:90`](src/core/SessionManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `version` | `version: number;` | Memory format version |
| `entries` | `entries: SerializedMemoryEntry[];` | Serialized memory entries |

</details>

---

### SerializedMemoryEntry `interface`

📍 [`src/core/SessionManager.ts:97`](src/core/SessionManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `key` | `key: string;` | - |
| `description` | `description: string;` | - |
| `value` | `value: unknown;` | - |
| `scope` | `scope: 'task' | 'persistent';` | - |
| `sizeBytes` | `sizeBytes: number;` | - |

</details>

---

### SerializedPlan `interface`

📍 [`src/core/SessionManager.ts:105`](src/core/SessionManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `version` | `version: number;` | Plan format version |
| `data` | `data: unknown;` | Plan data |

</details>

---

### Task `interface`

📍 [`src/domain/entities/Task.ts:104`](src/domain/entities/Task.ts)

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
| `expectedOutput?` | `expectedOutput?: string;` | Optional expected output description |
| `result?` | `result?: {
    success: boolean;
    output?: unknown;
    error?: string;
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

📍 [`src/capabilities/taskAgent/TaskAgent.ts:145`](src/capabilities/taskAgent/TaskAgent.ts)

TaskAgent configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `connector` | `connector: string | Connector;` | - |
| `model` | `model: string;` | - |
| `tools?` | `tools?: ToolFunction[];` | - |
| `instructions?` | `instructions?: string;` | - |
| `temperature?` | `temperature?: number;` | - |
| `maxIterations?` | `maxIterations?: number;` | - |
| `storage?` | `storage?: IAgentStorage;` | Storage for persistence (agent state, checkpoints) |
| `memoryConfig?` | `memoryConfig?: WorkingMemoryConfig;` | Memory configuration |
| `hooks?` | `hooks?: TaskAgentHooks;` | Hooks for customization |
| `session?` | `session?: TaskAgentSessionConfig;` | Session configuration for persistence (opt-in) |
| `toolManager?` | `toolManager?: ToolManager;` | Provide a pre-configured ToolManager (advanced) |

</details>

---

### TaskAgentHooks `interface`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:34`](src/capabilities/taskAgent/TaskAgent.ts)

TaskAgent hooks for customization

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `onStart?` | `onStart?: (agent: TaskAgent, plan: Plan) =&gt; Promise&lt;void&gt;;` | Before agent starts executing |
| `beforeTask?` | `beforeTask?: (task: Task, context: TaskContext) =&gt; Promise&lt;void | 'skip'&gt;;` | Before each task starts |
| `afterTask?` | `afterTask?: (task: Task, result: TaskResult) =&gt; Promise&lt;void&gt;;` | After each task completes |
| `beforeLLMCall?` | `beforeLLMCall?: (messages: any[], options: any) =&gt; Promise&lt;any[]&gt;;` | Before each LLM call |
| `afterLLMCall?` | `afterLLMCall?: (response: any) =&gt; Promise&lt;void&gt;;` | After each LLM response |
| `beforeTool?` | `beforeTool?: (tool: ToolFunction, args: unknown) =&gt; Promise&lt;unknown&gt;;` | Before each tool execution |
| `afterTool?` | `afterTool?: (tool: ToolFunction, args: unknown, result: unknown) =&gt; Promise&lt;unknown&gt;;` | After tool execution |
| `onError?` | `onError?: (error: Error, context: ErrorContext) =&gt; Promise&lt;'retry' | 'fail' | 'skip'&gt;;` | On any error |
| `onComplete?` | `onComplete?: (result: PlanResult) =&gt; Promise&lt;void&gt;;` | On agent completion |

</details>

---

### TaskAgentSessionConfig `interface`

📍 [`src/capabilities/taskAgent/TaskAgent.ts:131`](src/capabilities/taskAgent/TaskAgent.ts)

Session configuration for TaskAgent

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `storage` | `storage: ISessionStorage;` | Storage backend for sessions |
| `id?` | `id?: string;` | Resume existing session by ID |
| `autoSave?` | `autoSave?: boolean;` | Auto-save session after each task completion |
| `autoSaveIntervalMs?` | `autoSaveIntervalMs?: number;` | Auto-save interval in milliseconds |

</details>

---

### TaskCondition `interface`

📍 [`src/domain/entities/Task.ts:46`](src/domain/entities/Task.ts)

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

📍 [`src/capabilities/taskAgent/TaskAgent.ts:66`](src/capabilities/taskAgent/TaskAgent.ts)

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

📍 [`src/domain/entities/Task.ts:90`](src/domain/entities/Task.ts)

Task execution settings

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `parallel?` | `parallel?: boolean;` | Can run in parallel with other parallel tasks |
| `maxConcurrency?` | `maxConcurrency?: number;` | Max concurrent if this spawns sub-work |
| `priority?` | `priority?: number;` | Priority (higher = executed first) |

</details>

---

### TaskInput `interface`

📍 [`src/domain/entities/Task.ts:149`](src/domain/entities/Task.ts)

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
| `expectedOutput?` | `expectedOutput?: string;` | - |
| `maxAttempts?` | `maxAttempts?: number;` | - |
| `metadata?` | `metadata?: Record&lt;string, unknown&gt;;` | - |

</details>

---

### TaskProgress `interface`

📍 [`src/capabilities/universalAgent/types.ts:75`](src/capabilities/universalAgent/types.ts)

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

📍 [`src/capabilities/taskAgent/TaskAgent.ts:75`](src/capabilities/taskAgent/TaskAgent.ts)

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

### WorkingMemoryAccess `interface`

📍 [`src/domain/interfaces/IToolContext.ts:11`](src/domain/interfaces/IToolContext.ts)

Limited memory access for tools

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

```typescript
set(key: string, description: string, value: unknown): Promise&lt;void&gt;;
```

**Parameters:**
- `key`: `string`
- `description`: `string`
- `value`: `unknown`

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

```typescript
list(): Promise&lt;Array&lt;{ key: string; description: string }&gt;&gt;;
```

**Returns:** `Promise&lt;{ key: string; description: string; }[]&gt;`

</details>

---

### WorkingMemoryConfig `interface`

📍 [`src/domain/entities/Memory.ts:51`](src/domain/entities/Memory.ts)

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

📍 [`src/capabilities/taskAgent/WorkingMemory.ts:15`](src/capabilities/taskAgent/WorkingMemory.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `stored` | `stored: { key: string; description: string };` | - |
| `retrieved` | `retrieved: { key: string };` | - |
| `deleted` | `deleted: { key: string };` | - |
| `limit_warning` | `limit_warning: { utilizationPercent: number };` | - |

</details>

---

### MemoryScope `type`

📍 [`src/domain/entities/Memory.ts:10`](src/domain/entities/Memory.ts)

Memory entities for TaskAgent working memory

This file defines the data structures for the indexed working memory system.

```typescript
type MemoryScope = 'task' | 'persistent'
```

---

### PlanStatus `type`

📍 [`src/domain/entities/Task.ts:23`](src/domain/entities/Task.ts)

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

### TaskStatus `type`

📍 [`src/domain/entities/Task.ts:10`](src/domain/entities/Task.ts)

Task and Plan entities for TaskAgent

Defines the data structures for task-based autonomous agents.

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

### createEmptyMemory `function`

📍 [`src/core/SessionManager.ts:456`](src/core/SessionManager.ts)

Create an empty serialized memory

```typescript
export function createEmptyMemory(): SerializedMemory
```

---

### createMemoryTools `function`

📍 [`src/capabilities/taskAgent/memoryTools.ts:99`](src/capabilities/taskAgent/memoryTools.ts)

Create all memory tools

```typescript
export function createMemoryTools(): ToolFunction[]
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

### DEFAULT_CONTEXT_CONFIG `const`

📍 [`src/capabilities/taskAgent/ContextManager.ts:104`](src/capabilities/taskAgent/ContextManager.ts)

Default configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxContextTokens` | `128000` | - |
| `compactionThreshold` | `0.75` | - |
| `hardLimit` | `0.9` | - |
| `responseReserve` | `0.15` | - |
| `tokenEstimator` | `'approximate'` | - |

</details>

---

### DEFAULT_HISTORY_CONFIG `const`

📍 [`src/capabilities/taskAgent/HistoryManager.ts:24`](src/capabilities/taskAgent/HistoryManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `maxDetailedMessages` | `20` | - |
| `compressionStrategy` | `'summarize'` | - |
| `summarizeBatchSize` | `10` | - |
| `preserveToolCalls` | `true` | - |

</details>

---

### DEFAULT_IDEMPOTENCY_CONFIG `const`

📍 [`src/capabilities/taskAgent/IdempotencyCache.ts:31`](src/capabilities/taskAgent/IdempotencyCache.ts)

Default configuration

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `defaultTtlMs` | `3600000` | - |
| `maxEntries` | `1000` | - |

</details>

---

### DEFAULT_MEMORY_CONFIG `const`

📍 [`src/domain/entities/Memory.ts:78`](src/domain/entities/Memory.ts)

Default configuration values

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `descriptionMaxLength` | `150` | - |
| `softLimitPercent` | `80` | - |
| `contextAllocationPercent` | `20` | - |

</details>

---

## Universal Agent

Unified agent combining chat, planning, and execution

### ModeManager `class`

📍 [`src/capabilities/universalAgent/ModeManager.ts:19`](src/capabilities/universalAgent/ModeManager.ts)

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

📍 [`src/capabilities/universalAgent/UniversalAgent.ts:56`](src/capabilities/universalAgent/UniversalAgent.ts)

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

#### `getSessionId()`

```typescript
getSessionId(): string | null
```

**Returns:** `string | null`

#### `hasSession()`

```typescript
hasSession(): boolean
```

**Returns:** `boolean`

#### `saveSession()`

```typescript
async saveSession(): Promise&lt;void&gt;
```

**Returns:** `Promise&lt;void&gt;`

#### `getSession()`

```typescript
getSession(): Session | null
```

**Returns:** `Session | null`

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

#### `onCleanup()`

```typescript
onCleanup(callback: () =&gt; void): void
```

**Parameters:**
- `callback`: `() =&gt; void`

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
| `connector` | `connector: Connector` | - |
| `model` | `model: string` | - |
| `config` | `config: UniversalAgentConfig` | - |
| `agent` | `agent: Agent` | - |
| `modeManager` | `modeManager: ModeManager` | - |
| `planningAgent?` | `planningAgent: PlanningAgent | undefined` | - |
| `workingMemory` | `workingMemory: WorkingMemory` | - |
| `currentPlan` | `currentPlan: Plan | null` | - |
| `executionHistory` | `executionHistory: { input: string; response: UniversalResponse; timestamp: Date; }[]` | - |
| `isDestroyed` | `isDestroyed: boolean` | - |

</details>

---

### ExecutionResult `interface`

📍 [`src/capabilities/universalAgent/types.ts:174`](src/capabilities/universalAgent/types.ts)

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

📍 [`src/capabilities/universalAgent/types.ts:187`](src/capabilities/universalAgent/types.ts)

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

📍 [`src/capabilities/universalAgent/ModeManager.ts:14`](src/capabilities/universalAgent/ModeManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'mode:changed'` | `'mode:changed': { from: AgentMode; to: AgentMode; reason: string };` | - |
| `'mode:transition_blocked'` | `'mode:transition_blocked': { from: AgentMode; to: AgentMode; reason: string };` | - |

</details>

---

### ModeState `interface`

📍 [`src/capabilities/universalAgent/types.ts:212`](src/capabilities/universalAgent/types.ts)

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

📍 [`src/capabilities/universalAgent/types.ts:116`](src/capabilities/universalAgent/types.ts)

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

</details>

---

### UniversalAgentEvents `interface`

📍 [`src/capabilities/universalAgent/UniversalAgent.ts:40`](src/capabilities/universalAgent/UniversalAgent.ts)

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

### UniversalResponse `interface`

📍 [`src/capabilities/universalAgent/types.ts:83`](src/capabilities/universalAgent/types.ts)

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

📍 [`src/capabilities/universalAgent/types.ts:128`](src/capabilities/universalAgent/types.ts)

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

📍 [`src/core/context/strategies/AdaptiveStrategy.ts:29`](src/core/context/strategies/AdaptiveStrategy.ts)

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

📍 [`src/core/context/strategies/AggressiveStrategy.ts:26`](src/core/context/strategies/AggressiveStrategy.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(private options: AggressiveStrategyOptions =
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

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "aggressive"` | - |

</details>

---

### ApproximateTokenEstimator `class`

📍 [`src/infrastructure/context/estimators/ApproximateEstimator.ts:10`](src/infrastructure/context/estimators/ApproximateEstimator.ts)

<details>
<summary><strong>Methods</strong></summary>

#### `estimateTokens()`

Estimate tokens for text using 4 chars per token heuristic

```typescript
estimateTokens(text: string, _model?: string): number
```

**Parameters:**
- `text`: `string`
- `_model`: `string | undefined` *(optional)*

**Returns:** `number`

#### `estimateDataTokens()`

Estimate tokens for structured data

```typescript
estimateDataTokens(data: unknown, _model?: string): number
```

**Parameters:**
- `data`: `unknown`
- `_model`: `string | undefined` *(optional)*

**Returns:** `number`

</details>

---

### ContextManager `class`

📍 [`src/core/context/ContextManager.ts:36`](src/core/context/ContextManager.ts)

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

</details>

<details>
<summary><strong>Methods</strong></summary>

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
- `strategy`: `IContextStrategy | "proactive" | "aggressive" | "lazy" | "rolling-window" | "adaptive"`

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

</details>

---

### LazyCompactionStrategy `class`

📍 [`src/core/context/strategies/LazyStrategy.ts:19`](src/core/context/strategies/LazyStrategy.ts)

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

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "lazy"` | - |

</details>

---

### ProactiveCompactionStrategy `class`

📍 [`src/core/context/strategies/ProactiveStrategy.ts:18`](src/core/context/strategies/ProactiveStrategy.ts)

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

**Returns:** `{ compactionCount: number; totalTokensFreed: number; avgTokensFreedPerCompaction: number; }`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name` | `name: "proactive"` | - |
| `metrics` | `metrics: { compactionCount: number; totalTokensFreed: number; avgTokensFreedPerCompaction: number; }` | - |

</details>

---

### RollingWindowStrategy `class`

📍 [`src/core/context/strategies/RollingWindowStrategy.ts:24`](src/core/context/strategies/RollingWindowStrategy.ts)

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

📍 [`src/infrastructure/context/compactors/SummarizeCompactor.ts:10`](src/infrastructure/context/compactors/SummarizeCompactor.ts)

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
async compact(component: IContextComponent, _targetTokens: number): Promise&lt;IContextComponent&gt;
```

**Parameters:**
- `component`: `IContextComponent`
- `_targetTokens`: `number`

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
| `name` | `name: "summarize"` | - |
| `priority` | `priority: 5` | - |

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

📍 [`src/core/context/types.ts:150`](src/core/context/types.ts)

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

📍 [`src/core/context/types.ts:176`](src/core/context/types.ts)

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

📍 [`src/core/context/types.ts:135`](src/core/context/types.ts)

Abstract interface for token estimation

<details>
<summary><strong>Methods</strong></summary>

#### `estimateTokens()`

Estimate token count for text

```typescript
estimateTokens(text: string, model?: string): number;
```

**Parameters:**
- `text`: `string`
- `model`: `string | undefined` *(optional)*

**Returns:** `number`

#### `estimateDataTokens()`

Estimate tokens for structured data

```typescript
estimateDataTokens(data: unknown, model?: string): number;
```

**Parameters:**
- `data`: `unknown`
- `model`: `string | undefined` *(optional)*

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

### createEstimator `function`

📍 [`src/infrastructure/context/estimators/index.ts:11`](src/infrastructure/context/estimators/index.ts)

Create token estimator from name

```typescript
export function createEstimator(name: string): ITokenEstimator
```

---

### createStrategy `function`

📍 [`src/core/context/strategies/index.ts:15`](src/core/context/strategies/index.ts)

Strategy factory

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

📍 [`src/core/SessionManager.ts:193`](src/core/SessionManager.ts)

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

📍 [`src/core/SessionManager.ts:144`](src/core/SessionManager.ts)

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

📍 [`src/core/SessionManager.ts:76`](src/core/SessionManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `version` | `version: number;` | History format version |
| `entries` | `entries: SerializedHistoryEntry[];` | Serialized history entries |

</details>

---

### SerializedHistoryEntry `interface`

📍 [`src/core/SessionManager.ts:83`](src/core/SessionManager.ts)

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

📍 [`src/core/SessionManager.ts:20`](src/core/SessionManager.ts)

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
| `custom` | `custom: Record&lt;string, unknown&gt;;` | Agent-specific custom data |
| `metadata` | `metadata: SessionMetadata;` | - |

</details>

---

### SessionFilter `interface`

📍 [`src/core/SessionManager.ts:112`](src/core/SessionManager.ts)

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

📍 [`src/core/SessionManager.ts:187`](src/core/SessionManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `storage` | `storage: ISessionStorage;` | - |
| `defaultMetadata?` | `defaultMetadata?: Partial&lt;SessionMetadata&gt;;` | Default metadata for new sessions |

</details>

---

### SessionMetadata `interface`

📍 [`src/core/SessionManager.ts:58`](src/core/SessionManager.ts)

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

📍 [`src/core/SessionManager.ts:69`](src/core/SessionManager.ts)

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

📍 [`src/core/SessionManager.ts:131`](src/core/SessionManager.ts)

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

📍 [`src/core/SessionManager.ts:180`](src/core/SessionManager.ts)

```typescript
type SessionManagerEvent = | 'session:created'
  | 'session:saved'
  | 'session:loaded'
  | 'session:deleted'
  | 'session:error'
```

---

### addHistoryEntry `function`

📍 [`src/core/SessionManager.ts:463`](src/core/SessionManager.ts)

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

📍 [`src/core/SessionManager.ts:449`](src/core/SessionManager.ts)

Create an empty serialized history

```typescript
export function createEmptyHistory(): SerializedHistory
```

---

## Tools & Function Calling

Define and execute tools for agents

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

📍 [`src/core/ToolManager.ts:100`](src/core/ToolManager.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor()
```

</details>

<details>
<summary><strong>Methods</strong></summary>

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

Clear all tools

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

#### `getState()`

Get serializable state (for session persistence)

```typescript
getState(): SerializedToolState
```

**Returns:** `SerializedToolState`

#### `loadState()`

Load state (restores enabled/disabled, namespaces, priorities)
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

### ToolRegistry `class`

📍 [`src/capabilities/agents/ToolRegistry.ts:12`](src/capabilities/agents/ToolRegistry.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor()
```

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `registerTool()`

Register a new tool

```typescript
registerTool(tool: ToolFunction): void
```

**Parameters:**
- `tool`: `ToolFunction&lt;any, any&gt;`

**Returns:** `void`

#### `unregisterTool()`

Unregister a tool

```typescript
unregisterTool(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `execute()`

Execute a tool function

```typescript
async execute(toolName: string, args: any): Promise&lt;any&gt;
```

**Parameters:**
- `toolName`: `string`
- `args`: `any`

**Returns:** `Promise&lt;any&gt;`

#### `hasToolFunction()`

Check if tool is available

```typescript
hasToolFunction(toolName: string): boolean
```

**Parameters:**
- `toolName`: `string`

**Returns:** `boolean`

#### `getToolDefinition()`

Get tool definition

```typescript
getToolDefinition(toolName: string): Tool | undefined
```

**Parameters:**
- `toolName`: `string`

**Returns:** `Tool | undefined`

#### `listTools()`

List all registered tools

```typescript
listTools(): string[]
```

**Returns:** `string[]`

#### `clear()`

Clear all registered tools

```typescript
clear(): void
```

**Returns:** `void`

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

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `tools` | `tools: Map&lt;string, ToolFunction&lt;any, any&gt;&gt;` | - |
| `circuitBreakers` | `circuitBreakers: Map&lt;string, CircuitBreaker&lt;any&gt;&gt;` | - |
| `logger` | `logger: FrameworkLogger` | - |

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

📍 [`src/domain/entities/Tool.ts:24`](src/domain/entities/Tool.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'web_search' | 'file_search' | 'computer_use' | 'code_interpreter';` | - |
| `blocking?` | `blocking?: boolean;` | - |

</details>

---

### FunctionToolDefinition `interface`

📍 [`src/domain/entities/Tool.ts:12`](src/domain/entities/Tool.ts)

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

📍 [`src/domain/entities/Tool.ts:5`](src/domain/entities/Tool.ts)

Tool entities with blocking/non-blocking execution support

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: string;` | - |
| `properties?` | `properties?: Record&lt;string, any&gt;;` | - |
| `required?` | `required?: string[];` | - |

</details>

---

### SerializedToolState `interface`

📍 [`src/core/ToolManager.ts:81`](src/core/ToolManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `enabled: Record&lt;string, boolean&gt;;` | - |
| `namespaces` | `namespaces: Record&lt;string, string&gt;;` | - |
| `priorities` | `priorities: Record&lt;string, number&gt;;` | - |

</details>

---

### ToolCall `interface`

📍 [`src/domain/entities/Tool.ts:39`](src/domain/entities/Tool.ts)

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

📍 [`src/core/ToolManager.ts:32`](src/core/ToolManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `type` | `type: 'mode' | 'context' | 'custom';` | - |
| `predicate` | `predicate: (context: ToolSelectionContext) =&gt; boolean;` | - |

</details>

---

### ToolContext `interface`

📍 [`src/domain/entities/Tool.ts:74`](src/domain/entities/Tool.ts)

Tool context - passed to tools during execution (optional, for TaskAgent)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agentId` | `agentId: string;` | - |
| `taskId?` | `taskId?: string;` | - |
| `memory?` | `memory?: any;` | - |
| `signal?` | `signal?: AbortSignal;` | - |

</details>

---

### ToolContext `interface`

📍 [`src/domain/interfaces/IToolContext.ts:22`](src/domain/interfaces/IToolContext.ts)

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
| `signal?` | `signal?: AbortSignal;` | Abort signal for cancellation |

</details>

---

### ToolExecutionContext `interface`

📍 [`src/domain/entities/Tool.ts:64`](src/domain/entities/Tool.ts)

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

📍 [`src/domain/entities/Tool.ts:101`](src/domain/entities/Tool.ts)

User-provided tool function

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `definition` | `definition: FunctionToolDefinition;` | - |
| `execute` | `execute: (args: TArgs, context?: ToolContext) =&gt; Promise&lt;TResult&gt;;` | - |
| `idempotency?` | `idempotency?: ToolIdempotency;` | - |
| `output?` | `output?: ToolOutputHints;` | - |

</details>

---

### ToolManagerStats `interface`

📍 [`src/core/ToolManager.ts:71`](src/core/ToolManager.ts)

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

📍 [`src/core/ToolManager.ts:61`](src/core/ToolManager.ts)

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

📍 [`src/core/ToolManager.ts:21`](src/core/ToolManager.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `enabled?` | `enabled?: boolean;` | Whether the tool is enabled. Default: true |
| `namespace?` | `namespace?: string;` | Namespace for grouping related tools. Default: 'default' |
| `priority?` | `priority?: number;` | Priority for selection ordering. Higher = preferred. Default: 0 |
| `conditions?` | `conditions?: ToolCondition[];` | Conditions for auto-enable/disable |

</details>

---

### ToolRegistration `interface`

📍 [`src/core/ToolManager.ts:52`](src/core/ToolManager.ts)

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

</details>

---

### ToolResult `interface`

📍 [`src/domain/entities/Tool.ts:53`](src/domain/entities/Tool.ts)

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

📍 [`src/core/ToolManager.ts:37`](src/core/ToolManager.ts)

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

📍 [`src/domain/entities/Tool.ts:31`](src/domain/entities/Tool.ts)

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

### Tool `type`

📍 [`src/domain/entities/Tool.ts:29`](src/domain/entities/Tool.ts)

```typescript
type Tool = FunctionToolDefinition | BuiltInTool
```

---

### ToolManagerEvent `type`

📍 [`src/core/ToolManager.ts:87`](src/core/ToolManager.ts)

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

### createExecuteJavaScriptTool `function`

📍 [`src/tools/code/executeJavaScript.ts:107`](src/tools/code/executeJavaScript.ts)

Create an execute_javascript tool with the current connector state
Use this factory when you need the tool to reflect currently registered connectors

```typescript
export function createExecuteJavaScriptTool(): ToolFunction&lt;ExecuteJSArgs, ExecuteJSResult&gt;
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

## Developer Tools (Filesystem & Shell)

Built-in tools for file system operations and shell command execution. Perfect for building coding assistants.

### developerTools `const`

📍 [`src/tools/index.ts`](src/tools/index.ts)

Array of all developer tools bundled together for convenience.

```typescript
export const developerTools: ToolFunction[]
```

**Includes:** `readFile`, `writeFile`, `editFile`, `glob`, `grep`, `listDirectory`, `bash`

---

### Filesystem Tools

#### createReadFileTool `function`

📍 [`src/tools/filesystem/readFile.ts`](src/tools/filesystem/readFile.ts)

Create a read_file tool with optional configuration.

```typescript
export function createReadFileTool(config?: FilesystemToolConfig): ToolFunction<ReadFileArgs, ReadFileResult>
```

**Tool Name:** `read_file`

**Parameters:**
- `file_path`: `string` - Absolute path to the file
- `offset`: `number` *(optional)* - Line to start reading from
- `limit`: `number` *(optional)* - Number of lines to read

---

#### createWriteFileTool `function`

📍 [`src/tools/filesystem/writeFile.ts`](src/tools/filesystem/writeFile.ts)

Create a write_file tool with optional configuration.

```typescript
export function createWriteFileTool(config?: FilesystemToolConfig): ToolFunction<WriteFileArgs, WriteFileResult>
```

**Tool Name:** `write_file`

**Parameters:**
- `file_path`: `string` - Absolute path to the file
- `content`: `string` - Content to write

---

#### createEditFileTool `function`

📍 [`src/tools/filesystem/editFile.ts`](src/tools/filesystem/editFile.ts)

Create an edit_file tool for surgical find/replace edits.

```typescript
export function createEditFileTool(config?: FilesystemToolConfig): ToolFunction<EditFileArgs, EditFileResult>
```

**Tool Name:** `edit_file`

**Parameters:**
- `file_path`: `string` - Absolute path to the file
- `old_string`: `string` - Text to replace
- `new_string`: `string` - Replacement text
- `replace_all`: `boolean` *(optional)* - Replace all occurrences (default: false)

---

#### createGlobTool `function`

📍 [`src/tools/filesystem/glob.ts`](src/tools/filesystem/glob.ts)

Create a glob tool for finding files by pattern.

```typescript
export function createGlobTool(config?: FilesystemToolConfig): ToolFunction<GlobArgs, GlobResult>
```

**Tool Name:** `glob`

**Parameters:**
- `pattern`: `string` - Glob pattern (e.g., `**/*.ts`, `src/**/*.{ts,tsx}`)
- `path`: `string` *(optional)* - Directory to search in

---

#### createGrepTool `function`

📍 [`src/tools/filesystem/grep.ts`](src/tools/filesystem/grep.ts)

Create a grep tool for searching file contents with regex.

```typescript
export function createGrepTool(config?: FilesystemToolConfig): ToolFunction<GrepArgs, GrepResult>
```

**Tool Name:** `grep`

**Parameters:**
- `pattern`: `string` - Regex pattern to search for
- `path`: `string` *(optional)* - File or directory to search
- `type`: `string` *(optional)* - File type filter (e.g., `ts`, `js`, `py`)
- `glob`: `string` *(optional)* - Glob pattern filter
- `output_mode`: `'content' | 'files_with_matches' | 'count'` *(optional)*
- `case_insensitive`: `boolean` *(optional)*
- `context_before`: `number` *(optional)* - Lines before match
- `context_after`: `number` *(optional)* - Lines after match

---

#### createListDirectoryTool `function`

📍 [`src/tools/filesystem/listDirectory.ts`](src/tools/filesystem/listDirectory.ts)

Create a list_directory tool for listing directory contents.

```typescript
export function createListDirectoryTool(config?: FilesystemToolConfig): ToolFunction<ListDirectoryArgs, ListDirectoryResult>
```

**Tool Name:** `list_directory`

**Parameters:**
- `path`: `string` - Path to the directory
- `recursive`: `boolean` *(optional)* - List recursively
- `filter`: `'files' | 'directories'` *(optional)* - Filter by type
- `max_depth`: `number` *(optional)* - Maximum recursion depth

---

### Shell Tools

#### createBashTool `function`

📍 [`src/tools/shell/bash.ts`](src/tools/shell/bash.ts)

Create a bash tool for executing shell commands.

```typescript
export function createBashTool(config?: ShellToolConfig): ToolFunction<BashArgs, BashResult>
```

**Tool Name:** `bash`

**Parameters:**
- `command`: `string` - Shell command to execute
- `timeout`: `number` *(optional)* - Timeout in milliseconds (max 600000)
- `description`: `string` *(optional)* - Description of the command
- `run_in_background`: `boolean` *(optional)* - Run in background

**Safety Features:**
- Blocks dangerous commands (`rm -rf /`, fork bombs)
- Configurable timeout (default 2 min, max 10 min)
- Output truncation for large outputs

---

### Configuration Types

#### FilesystemToolConfig `interface`

📍 [`src/tools/filesystem/types.ts`](src/tools/filesystem/types.ts)

```typescript
interface FilesystemToolConfig {
  workingDirectory?: string;       // Base directory (default: cwd)
  allowedDirectories?: string[];   // Restrict to these directories
  blockedDirectories?: string[];   // Block access (default: node_modules, .git)
  maxFileSize?: number;            // Max read size (default: 10MB)
  maxResults?: number;             // Max results for glob/grep (default: 1000)
  followSymlinks?: boolean;        // Follow symlinks (default: false)
  excludeExtensions?: string[];    // Skip binary files
}
```

---

#### ShellToolConfig `interface`

📍 [`src/tools/shell/types.ts`](src/tools/shell/types.ts)

```typescript
interface ShellToolConfig {
  workingDirectory?: string;       // Working directory
  defaultTimeout?: number;         // Default timeout (default: 120000ms)
  maxTimeout?: number;             // Max timeout (default: 600000ms)
  maxOutputSize?: number;          // Max output size (default: 100KB)
  allowBackground?: boolean;       // Allow background execution (default: false)
  shell?: string;                  // Shell to use (default: /bin/bash)
  env?: Record<string, string>;    // Environment variables
  blockedCommands?: string[];      // Additional blocked commands
  blockedPatterns?: RegExp[];      // Additional blocked patterns
}
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

**Returns:** `{ responseId: string; model: string; status: "completed" | "failed" | "incomplete" | "in_progress"; iterations: number; totalChunks: number; totalTextDeltas: number; totalToolCalls: number; textItemsCount: number; toolCallBuffersCount: number; completedToolCallsCount: number; durationMs: number; usage: { input_tokens: number; output_tokens: number; total_tokens: number; output_tokens_details?: { reasoning_tokens: number; } | undefined; }; }`

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

**Returns:** `{ responseId: string; model: string; createdAt: number; textBuffers: Map&lt;string, string[]&gt;; toolCallBuffers: Map&lt;string, ToolCallBuffer&gt;; completedToolCalls: ToolCall[]; toolResults: Map&lt;string, any&gt;; currentIteration: number; usage: { input_tokens: number; output_tokens: number; total_tokens: number; output_tokens_details?: { reasoning_tokens: number; } | undefined; }; status: "completed" | "failed" | "incomplete" | "in_progress"; startTime: Date; endTime: Date | undefined; }`

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
| `status` | `status: "completed" | "failed" | "incomplete" | "in_progress"` | - |
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

📍 [`src/domain/interfaces/ITextProvider.ts:28`](src/domain/interfaces/ITextProvider.ts)

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

📍 [`src/domain/entities/Model.ts:1010`](src/domain/entities/Model.ts)

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

📍 [`src/domain/entities/Model.ts:998`](src/domain/entities/Model.ts)

Get all currently active models

```typescript
export function getActiveModels(): ILLMDescription[]
```

---

### getModelInfo `function`

📍 [`src/domain/entities/Model.ts:981`](src/domain/entities/Model.ts)

Get model information by name

```typescript
export function getModelInfo(modelName: string): ILLMDescription | undefined
```

---

### getModelsByVendor `function`

📍 [`src/domain/entities/Model.ts:990`](src/domain/entities/Model.ts)

Get all models for a specific vendor

```typescript
export function getModelsByVendor(vendor: VendorType): ILLMDescription[]
```

---

### MODEL_REGISTRY `const`

📍 [`src/domain/entities/Model.ts:150`](src/domain/entities/Model.ts)

Complete model registry with all model metadata
Updated: January 2026

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `'gpt-5.2-instant'` | `{
    name: 'gpt-5.2-instant',
    provider: Vendor.OpenAI,
    description: 'Fast variant of GPT-5.2 with minimal reasoning step',
    isActive: true,
    releaseDate: '2025-12-11',
    knowledgeCutoff: '2025-08-31',
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
        tokens: 400000,
        text: true,
        image: true,
        cpm: 1.75,
        cpmCached: 0.025, // 90% discount
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 14,
      },
    },
  }` | - |
| `'gpt-5.2-thinking'` | `{
    name: 'gpt-5.2-thinking',
    provider: Vendor.OpenAI,
    description: 'GPT-5.2 with extended reasoning capabilities and xhigh reasoning effort',
    isActive: true,
    releaseDate: '2025-12-11',
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
      input: {
        tokens: 400000,
        text: true,
        image: true,
        cpm: 1.75,
        cpmCached: 0.025,
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
    description: 'Flagship GPT-5.2 model with advanced reasoning and highest quality',
    isActive: true,
    releaseDate: '2025-12-11',
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
      input: {
        tokens: 400000,
        text: true,
        image: true,
        cpm: 21,
        cpmCached: 0.025,
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 168,
      },
    },
  }` | - |
| `'gpt-5.2-codex'` | `{
    name: 'gpt-5.2-codex',
    provider: Vendor.OpenAI,
    description: 'Most advanced agentic coding model for complex software engineering',
    isActive: true,
    releaseDate: '2026-01-14',
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
      input: {
        tokens: 400000,
        text: true,
        image: true,
        cpm: 1.75,
        cpmCached: 0.025,
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 14,
      },
    },
  }` | - |
| `'gpt-5.1'` | `{
    name: 'gpt-5.1',
    provider: Vendor.OpenAI,
    description: 'Balanced GPT-5.1 model with expanded context window',
    isActive: true,
    releaseDate: '2025-11-13',
    knowledgeCutoff: '2025-08-31',
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
        tokens: 272000,
        text: true,
        image: true,
        cpm: 1.25,
        cpmCached: 0.025,
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 10,
      },
    },
  }` | - |
| `'gpt-5'` | `{
    name: 'gpt-5',
    provider: Vendor.OpenAI,
    description: 'Standard GPT-5 model with large context window',
    isActive: true,
    releaseDate: '2025-08-07',
    knowledgeCutoff: '2025-08-31',
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
        tokens: 400000,
        text: true,
        image: true,
        cpm: 1.25,
        cpmCached: 0.025,
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 10,
      },
    },
  }` | - |
| `'gpt-5-mini'` | `{
    name: 'gpt-5-mini',
    provider: Vendor.OpenAI,
    description: 'Fast, cost-efficient version of GPT-5',
    isActive: true,
    releaseDate: '2025-08-07',
    knowledgeCutoff: '2025-08-31',
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
        tokens: 200000,
        text: true,
        image: true,
        cpm: 0.25,
        cpmCached: 0.025,
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 2,
      },
    },
  }` | - |
| `'gpt-5-nano'` | `{
    name: 'gpt-5-nano',
    provider: Vendor.OpenAI,
    description: 'Fastest, most cost-effective version of GPT-5',
    isActive: true,
    releaseDate: '2025-08-07',
    knowledgeCutoff: '2025-08-31',
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
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 128000,
        text: true,
        cpm: 0.05,
        cpmCached: 0.025,
      },
      output: {
        tokens: 4096,
        text: true,
        cpm: 0.4,
      },
    },
  }` | - |
| `'gpt-4.1'` | `{
    name: 'gpt-4.1',
    provider: Vendor.OpenAI,
    description: 'GPT-4.1 specialized for coding with large context window',
    isActive: true,
    releaseDate: '2025-06-01',
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
        cpm: 0.5,
        cpmCached: 0.025,
      },
      output: {
        tokens: 32768,
        text: true,
        cpm: 2,
      },
    },
  }` | - |
| `'gpt-4.1-mini'` | `{
    name: 'gpt-4.1-mini',
    provider: Vendor.OpenAI,
    description: 'Efficient GPT-4.1 model with excellent instruction following',
    isActive: true,
    releaseDate: '2025-06-01',
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
        cpmCached: 0.025,
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 1.6,
      },
    },
  }` | - |
| `'o3-mini'` | `{
    name: 'o3-mini',
    provider: Vendor.OpenAI,
    description: 'Fast reasoning model tailored for coding, math, and science',
    isActive: true,
    releaseDate: '2025-01-01',
    knowledgeCutoff: '2023-10-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: false,
      functionCalling: false,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: false,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: false,
      input: {
        tokens: 200000,
        text: true,
        cpm: 0.4,
      },
      output: {
        tokens: 100000,
        text: true,
        cpm: 1.6,
      },
    },
  }` | - |
| `'claude-opus-4-5-20251101'` | `{
    name: 'claude-opus-4-5-20251101',
    provider: Vendor.Anthropic,
    description: 'Flagship Claude model with extended thinking and 80.9% SWE-bench score',
    isActive: true,
    releaseDate: '2025-11-24',
    knowledgeCutoff: '2025-03-01',
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
        cpmCached: 0.5, // 10x reduction for cache read
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
    description: 'Balanced Claude model with computer use and extended thinking',
    isActive: true,
    releaseDate: '2025-09-29',
    knowledgeCutoff: '2025-03-01',
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
    description: 'Fastest Claude model with extended thinking and lowest latency',
    isActive: true,
    releaseDate: '2025-10-01',
    knowledgeCutoff: '2025-03-01',
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
    description: 'Legacy Claude Opus 4.1 (67% more expensive than 4.5)',
    isActive: true,
    releaseDate: '2025-08-05',
    knowledgeCutoff: '2025-03-01',
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
        cpm: 15,
        cpmCached: 1.5,
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 75,
      },
    },
  }` | - |
| `'claude-sonnet-4-20250514'` | `{
    name: 'claude-sonnet-4-20250514',
    provider: Vendor.Anthropic,
    description: 'Legacy Claude Sonnet 4 with optional 1M token context',
    isActive: true,
    releaseDate: '2025-05-14',
    knowledgeCutoff: '2025-03-01',
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
        tokens: 1000000, // Up to 1M with premium pricing beyond 200K
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
        cpm: 0.5,
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 3,
      },
    },
  }` | - |
| `'gemini-3-pro'` | `{
    name: 'gemini-3-pro',
    provider: Vendor.Google,
    description: 'Most advanced reasoning Gemini model with 1M token context',
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
        cpm: 2, // $2 up to 200K, $4 beyond
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 12, // $12 up to 200K, $18 beyond
      },
    },
  }` | - |
| `'gemini-3-pro-image'` | `{
    name: 'gemini-3-pro-image',
    provider: Vendor.Google,
    description: 'Highest quality image generation model (Nano Banana Pro)',
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
        cpm: 2,
      },
      output: {
        tokens: 64000,
        text: true,
        image: true,
        cpm: 120, // For image output
      },
    },
  }` | - |
| `'gemini-2.5-pro'` | `{
    name: 'gemini-2.5-pro',
    provider: Vendor.Google,
    description: 'Balanced multimodal model built for agents',
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
        tokens: 64000,
        text: true,
        cpm: 10,
      },
    },
  }` | - |
| `'gemini-2.5-flash'` | `{
    name: 'gemini-2.5-flash',
    provider: Vendor.Google,
    description: 'Cost-effective model with upgraded reasoning',
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
        cpm: 0.1,
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 0.4,
      },
    },
  }` | - |
| `'gemini-2.5-flash-lite'` | `{
    name: 'gemini-2.5-flash-lite',
    provider: Vendor.Google,
    description: 'Lowest latency Gemini model with 1M context',
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
        cpm: 0.1,
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 0.4,
      },
    },
  }` | - |
| `'gemini-2.5-flash-image'` | `{
    name: 'gemini-2.5-flash-image',
    provider: Vendor.Google,
    description: 'State-of-the-art image generation and editing (1290 tokens per image)',
    isActive: true,
    releaseDate: '2026-01-01',
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
        cpm: 0.1,
      },
      output: {
        tokens: 64000,
        text: true,
        image: true,
        cpm: 30, // For image output
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

📍 [`src/domain/entities/Connector.ts:26`](src/domain/entities/Connector.ts)

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

📍 [`src/infrastructure/observability/Logger.ts:66`](src/infrastructure/observability/Logger.ts)

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

📍 [`src/infrastructure/observability/Logger.ts:56`](src/infrastructure/observability/Logger.ts)

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

📍 [`src/infrastructure/observability/Logger.ts:36`](src/infrastructure/observability/Logger.ts)

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

### createTextMessage `function`

📍 [`src/utils/messageBuilder.ts:124`](src/utils/messageBuilder.ts)

Helper function to create a simple text message

```typescript
export function createTextMessage(text: string, role: MessageRole = MessageRole.USER): InputItem
```

---

## Interfaces

TypeScript interfaces for extensibility

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

📍 [`src/domain/interfaces/ITextProvider.ts:38`](src/domain/interfaces/ITextProvider.ts)

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

### assertNotDestroyed `function`

📍 [`src/domain/interfaces/IDisposable.ts:50`](src/domain/interfaces/IDisposable.ts)

Helper to check if an object is destroyed and throw if so.

```typescript
export function assertNotDestroyed(obj: IDisposable | IAsyncDisposable, operation: string): void
```

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

### Agent `class`

📍 [`src/capabilities/agents/Agent.ts:46`](src/capabilities/agents/Agent.ts)

<details>
<summary><strong>Constructor</strong></summary>

#### `constructor`

```typescript
constructor(
    private config: AgentConfig,
    textProvider: ITextProvider,
    private toolRegistry: ToolRegistry
  )
```

**Parameters:**
- `config`: `AgentConfig`
- `textProvider`: `ITextProvider`
- `toolRegistry`: `ToolRegistry`

</details>

<details>
<summary><strong>Methods</strong></summary>

#### `run()`

Run the agent with input

```typescript
async run(input: string | InputItem[]): Promise&lt;AgentResponse&gt;
```

**Parameters:**
- `input`: `string | InputItem[]`

**Returns:** `Promise&lt;LLMResponse&gt;`

#### `stream()`

Stream response from the agent with real-time events
Returns an async iterator of streaming events
Supports full agentic loop with tool calling

```typescript
async *stream(input: string | InputItem[]): AsyncIterableIterator&lt;StreamEvent&gt;
```

**Parameters:**
- `input`: `string | InputItem[]`

**Returns:** `AsyncIterableIterator&lt;StreamEvent&gt;`

#### `addTool()`

Add a tool to the agent

```typescript
addTool(tool: ToolFunction): void
```

**Parameters:**
- `tool`: `ToolFunction&lt;any, any&gt;`

**Returns:** `void`

#### `removeTool()`

Remove a tool from the agent

```typescript
removeTool(toolName: string): void
```

**Parameters:**
- `toolName`: `string`

**Returns:** `void`

#### `listTools()`

List registered tools

```typescript
listTools(): string[]
```

**Returns:** `string[]`

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

#### `getContext()`

Get current execution context

```typescript
getContext(): ExecutionContext | null
```

**Returns:** `ExecutionContext | null`

#### `getMetrics()`

Get execution metrics

```typescript
getMetrics()
```

**Returns:** `ExecutionMetrics | null`

#### `getSummary()`

Get execution summary

```typescript
getSummary()
```

**Returns:** `{ executionId: string; startTime: Date; currentIteration: number; paused: boolean; cancelled: boolean; metrics: { totalDuration: number; llmDuration: number; toolDuration: number; hookDuration: number; iterationCount: number; toolCallCount: number; toolSuccessCount: number; toolFailureCount: number; toolTimeoutCount: number; inputTokens: number; outputTokens: number; totalTokens: number; errors: { type: string; message: string; timestamp: Date; }[]; }; totalDuration: number; } | null`

#### `getAuditTrail()`

Get audit trail

```typescript
getAuditTrail()
```

**Returns:** `readonly AuditEntry[]`

#### `isRunning()`

Check if currently running

```typescript
isRunning(): boolean
```

**Returns:** `boolean`

#### `isPaused()`

Check if paused

```typescript
isPaused(): boolean
```

**Returns:** `boolean`

#### `isCancelled()`

Check if cancelled

```typescript
isCancelled(): boolean
```

**Returns:** `boolean`

#### `onCleanup()`

Register cleanup callback

```typescript
onCleanup(callback: () =&gt; void): void
```

**Parameters:**
- `callback`: `() =&gt; void`

**Returns:** `void`

#### `destroy()`

Destroy agent and cleanup resources
Safe to call multiple times (idempotent)

```typescript
destroy(): void
```

**Returns:** `void`

</details>

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `agenticLoop` | `agenticLoop: AgenticLoop` | - |
| `cleanupCallbacks` | `cleanupCallbacks: (() =&gt; void)[]` | - |
| `boundListeners` | `boundListeners: Map&lt;keyof AgenticLoopEvents, (...args: any[]) =&gt; void&gt;` | - |

</details>

---

### ExecutionContext `class`

📍 [`src/capabilities/agents/ExecutionContext.ts:74`](src/capabilities/agents/ExecutionContext.ts)

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
- `type`: `"hook_executed" | "tool_modified" | "tool_skipped" | "execution_paused" | "execution_resumed" | "tool_approved" | "tool_rejected"`
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

### AgentConfig `interface`

📍 [`src/capabilities/agents/Agent.ts:21`](src/capabilities/agents/Agent.ts)

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `provider` | `provider: string;` | - |
| `model` | `model: string;` | - |
| `instructions?` | `instructions?: string;` | - |
| `tools?` | `tools?: ToolFunction[];` | - |
| `temperature?` | `temperature?: number;` | - |
| `maxIterations?` | `maxIterations?: number;` | - |
| `hooks?` | `hooks?: HookConfig;` | - |
| `historyMode?` | `historyMode?: HistoryMode;` | - |
| `limits?` | `limits?: {
    maxExecutionTime?: number;
    maxToolCalls?: number;
    maxContextSize?: number;
    /** Maximum number of input messages to keep (prevents unbounded context growth) */
    maxInputMessages?: number;
  };` | - |
| `errorHandling?` | `errorHandling?: {
    hookFailureMode?: 'fail' | 'warn' | 'ignore';
    toolFailureMode?: 'fail' | 'continue';
    maxConsecutiveErrors?: number;
  };` | - |

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

📍 [`src/domain/entities/Connector.ts:57`](src/domain/entities/Connector.ts)

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
    | 'tool_rejected';` | - |
| `hookName?` | `hookName?: string;` | - |
| `toolName?` | `toolName?: string;` | - |
| `details` | `details: any;` | - |

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

📍 [`src/domain/entities/Connector.ts:84`](src/domain/entities/Connector.ts)

Complete connector configuration
Used for BOTH AI providers AND external APIs

<details>
<summary><strong>Properties</strong></summary>

| Property | Type | Description |
|----------|------|-------------|
| `name?` | `name?: string;` | - |
| `vendor?` | `vendor?: Vendor;` | - |
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
    timeout?: number;
    maxRetries?: number;
    organization?: string; // OpenAI
    project?: string; // OpenAI
    anthropicVersion?: string;
    location?: string; // Google Vertex
    projectId?: string; // Google Vertex
    [key: string]: unknown;
  };` | - |

</details>

---

### ConnectorConfigResult `interface`

📍 [`src/domain/entities/Connector.ts:130`](src/domain/entities/Connector.ts)

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

📍 [`src/domain/entities/Connector.ts:68`](src/domain/entities/Connector.ts)

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

📍 [`src/domain/entities/Connector.ts:17`](src/domain/entities/Connector.ts)

Connector authentication configuration
Supports OAuth 2.0, API keys, and JWT bearer tokens

```typescript
type ConnectorAuth = | OAuthConnectorAuth
  | APIKeyConnectorAuth
  | JWTConnectorAuth
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

### QualityLevel `type`

📍 [`src/domain/types/SharedTypes.ts:21`](src/domain/types/SharedTypes.ts)

Quality levels - normalized across vendors
Providers map these to vendor-specific quality settings

```typescript
type QualityLevel = 'draft' | 'standard' | 'high' | 'ultra'
```

---
