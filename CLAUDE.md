# Claude Development Guide

This document provides context for AI assistants (like Claude) to continue development of the `@oneringai/agents` library.

## Project Overview

**Name**: `@oneringai/agents`
**Purpose**: Unified AI agent library with multi-vendor support for text generation, image/video generation, audio (TTS/STT), and agentic workflows
**Language**: TypeScript (strict mode)
**Runtime**: Node.js 18+
**Package Type**: ESM (ES Modules)

## Architecture: Connector-First Design

The library uses a **Connector-First Architecture** where Connectors are the single source of truth for authentication.

```
┌─────────────────────────────────────────┐
│              User Code                   │
│  Connector.create() → Agent.create()    │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│           Connector Registry             │
│   Static registry of named connectors   │
│   Supports multiple keys per vendor     │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│              Agent Class                 │
│   Creates provider from connector       │
│   Runs agentic loop with tools          │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│         Provider Factory                 │
│   createProvider(connector) → provider  │
│   Maps Vendor enum to provider class    │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│        ITextProvider Implementations     │
│   OpenAI, Anthropic, Google, etc.       │
└─────────────────────────────────────────┘
```

### Key Design Principles

1. **Connectors are the single source of truth** - No more dual auth systems
2. **Named connectors** - Multiple keys per vendor (e.g., `openai-main`, `openai-backup`)
3. **Explicit vendor** - Uses `Vendor` enum, no auto-detection
4. **Static registry** - `Connector.create()` stores in global registry
5. **Simple API** - Give a connector, get an agent

## Core Classes

### Connector (`src/core/Connector.ts`)

Static registry for authentication configurations:

```typescript
import { Connector, Vendor } from '@oneringai/agents';

// Create a connector (stored in global registry)
Connector.create({
  name: 'openai',           // Unique name
  vendor: Vendor.OpenAI,    // Vendor enum
  auth: { type: 'api_key', apiKey: '...' },
  baseURL?: string,         // Optional custom URL
  options?: object,         // Vendor-specific options
});

// Get a connector
const connector = Connector.get('openai');

// Check if exists
if (Connector.has('openai')) { ... }

// List all
const names = Connector.list();

// Clear all (for testing)
Connector.clear();
```

#### Connector Fetch (External API Integration)

Connectors can make authenticated HTTP requests to external services:

```typescript
import { Connector, Services } from '@oneringai/agents';

// Create a connector for an external service
Connector.create({
  name: 'slack',
  serviceType: Services.Slack,  // Optional: explicit service type
  auth: { type: 'api_key', apiKey: process.env.SLACK_TOKEN! },
  baseURL: 'https://slack.com/api',

  // Optional: Enterprise resilience features
  timeout: 30000,  // 30s timeout (default)
  retry: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableStatuses: [429, 500, 502, 503, 504],
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    resetTimeoutMs: 60000,
  },
});

const connector = Connector.get('slack');

// Make authenticated requests
const response = await connector.fetch('/conversations.list', {
  method: 'GET',
  queryParams: { limit: '100' },
});

// JSON helper with automatic parsing
const data = await connector.fetchJSON<SlackResponse>('/users.list');

// Per-request options
const urgent = await connector.fetch('/chat.postMessage', {
  method: 'POST',
  body: { channel: 'C123', text: 'Hello!' },
  timeout: 5000,      // Override timeout
  skipRetry: true,    // Skip retry for this request
});

// Metrics and introspection
const metrics = connector.getMetrics();
console.log(metrics.requestCount, metrics.avgLatencyMs);

// Manual circuit breaker control
connector.resetCircuitBreaker();
```

**Resilience Features:**
- **Timeout** - AbortController-based with configurable timeout
- **Retry** - Exponential backoff with jitter for 429/5xx errors
- **Circuit Breaker** - Fail-fast when service is unhealthy
- **Metrics** - Request count, success/failure rate, latency tracking

### Services (`src/domain/entities/Services.ts`)

Well-known external service definitions (35+ services):

```typescript
import { Services, detectServiceFromURL, getServiceInfo, getServicesByCategory } from '@oneringai/agents';

// Service constants for type-safe configuration
Connector.create({
  name: 'github',
  serviceType: Services.Github,  // 'github'
  // ...
});

// Auto-detect service from URL
const service = detectServiceFromURL('https://api.github.com/repos');  // 'github'

// Get service metadata
const info = getServiceInfo('slack');
console.log(info?.name);       // 'Slack'
console.log(info?.category);   // 'communication'
console.log(info?.docsURL);    // 'https://api.slack.com/methods'

// Filter by category
const devServices = getServicesByCategory('development');  // github, jira, gitlab, etc.
```

**Service Categories:**
- `communication` - Slack, Discord, Microsoft Teams, Twilio
- `development` - GitHub, GitLab, Jira, Linear, Bitbucket
- `productivity` - Notion, Asana, Monday, Airtable, Trello
- `crm` - Salesforce, HubSpot, Zendesk, Intercom
- `payments` - Stripe, PayPal, Square, Braintree
- `cloud` - AWS, Azure, GCP, DigitalOcean
- `storage` - Dropbox, Box, Google Drive, OneDrive
- `email` - SendGrid, Mailchimp, Mailgun, Postmark
- `monitoring` - Datadog, PagerDuty, Sentry, New Relic

### ConnectorTools (`src/tools/connector/ConnectorTools.ts`)

Generate AI agent tools from Connectors:

```typescript
import { Agent, Connector, ConnectorTools, Services } from '@oneringai/agents';

// Create a connector
Connector.create({
  name: 'github',
  serviceType: Services.Github,
  auth: { type: 'api_key', apiKey: process.env.GITHUB_TOKEN! },
  baseURL: 'https://api.github.com',
});

// Get tools for the connector
const tools = ConnectorTools.for('github');

// Use with an agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: tools,  // Agent can now call GitHub API
});

await agent.run('List all open issues in repo owner/name');
```

**Generic API Tool:**

Every connector with a `baseURL` gets a generic API tool:

```typescript
const tool = ConnectorTools.genericAPI('github');

// Tool allows agent to make any API call:
// - method: GET, POST, PUT, PATCH, DELETE
// - endpoint: /repos/owner/name/issues
// - queryParams: { state: 'open' }
// - body: { title: 'New issue' }
// - headers: { 'X-Custom': 'value' } (auth headers protected)
```

**Custom Tool Factory:**

Register service-specific tools:

```typescript
import { ConnectorTools, ToolFunction } from '@oneringai/agents';

// Register a factory for Slack-specific tools
ConnectorTools.registerService('slack', (connector) => {
  const listChannels: ToolFunction = {
    definition: {
      type: 'function',
      function: {
        name: 'slack_list_channels',
        description: 'List Slack channels',
        parameters: { type: 'object', properties: {} },
      },
    },
    execute: async () => {
      return connector.fetchJSON('/conversations.list');
    },
    describeCall: () => 'List Slack channels',
  };

  return [listChannels];
});

// Now ConnectorTools.for('slack-connector') returns both generic + custom tools
```

**Discovery and Introspection:**

```typescript
// Discover all connectors with serviceType
const allTools = ConnectorTools.discoverAll();
// Returns: Map<connectorName, ToolFunction[]>

// Find connector by service
const slackConnector = ConnectorTools.findConnector(Services.Slack);

// Check if service has custom tools
if (ConnectorTools.hasServiceTools('slack')) {
  // ...
}

// List all services with custom tools
const services = ConnectorTools.listSupportedServices();
```

**Security Features:**
- Auth headers (Authorization, X-API-Key) cannot be overridden
- Safe JSON stringify handles circular references
- Service detection caching for performance

### Agent (`src/core/Agent.ts`)

Creates agents from connectors:

```typescript
import { Agent } from '@oneringai/agents';

const agent = Agent.create({
  connector: 'openai',      // Name or Connector instance
  model: 'gpt-4',
  instructions?: string,
  tools?: ToolFunction[],
  temperature?: number,
  maxIterations?: number,
  maxOutputTokens?: number,
});

// Run
const response = await agent.run('Hello');
const response = await agent.run(inputItems);

// Stream
for await (const event of agent.stream('Hello')) { ... }

// Events
agent.on('tool:start', handler);
agent.on('tool:complete', handler);

// Configuration (runtime changes)
agent.setModel('gpt-4-turbo');       // Change model
agent.setTemperature(0.9);           // Change temperature
agent.getTemperature();              // Get current temperature

// Tool management
agent.addTool(tool);                 // Add a single tool
agent.removeTool('tool_name');       // Remove a tool by name
agent.setTools([tool1, tool2]);      // Replace all tools
agent.listTools();                   // Get array of tool names

// Control
agent.pause();                       // Pause execution
agent.resume();                      // Resume execution
agent.cancel();                      // Cancel execution

// Introspection
agent.isRunning();                   // Check if running
agent.isPaused();                    // Check if paused
agent.getMetrics();                  // Get execution metrics
agent.getAuditTrail();               // Get audit trail

// Cleanup
agent.onCleanup(() => { ... });      // Register cleanup callback
agent.destroy();                     // Destroy agent
```

### Vendor (`src/core/Vendor.ts`)

Enum of supported AI vendors:

```typescript
export const Vendor = {
  OpenAI: 'openai',
  Anthropic: 'anthropic',
  Google: 'google',
  GoogleVertex: 'google-vertex',
  Groq: 'groq',
  Together: 'together',
  Grok: 'grok',
  DeepSeek: 'deepseek',
  Mistral: 'mistral',
  Perplexity: 'perplexity',
  Ollama: 'ollama',
  Custom: 'custom',
} as const;
```

### Model Registry (`src/domain/entities/Model.ts`)

Comprehensive model metadata registry with 23+ latest (2026) models:

```typescript
import { MODEL_REGISTRY, LLM_MODELS, Vendor, getModelInfo, calculateCost, getModelsByVendor } from '@oneringai/agents';

// Access model constants (organized by vendor)
const gpt52 = LLM_MODELS[Vendor.OpenAI].GPT_5_2_THINKING;        // 'gpt-5.2-thinking'
const claude = LLM_MODELS[Vendor.Anthropic].CLAUDE_OPUS_4_5;     // 'claude-opus-4-5-20251101'
const gemini = LLM_MODELS[Vendor.Google].GEMINI_3_FLASH_PREVIEW; // 'gemini-3-flash-preview'

// Get model information
const model = getModelInfo('gpt-5.2');
console.log(model.features.input.tokens);   // 400000
console.log(model.features.output.tokens);  // 128000
console.log(model.features.input.cpm);      // 1.75
console.log(model.features.output.cpm);     // 14
console.log(model.features.reasoning);      // true
console.log(model.features.vision);         // true

// Check parameter support (reasoning models don't support temperature)
console.log(model.features.parameters?.temperature);  // false (GPT-5 is reasoning model)

// Calculate API costs
const cost = calculateCost('gpt-5.2-thinking', 50_000, 2_000);
console.log(`Cost: $${cost}`); // 0.1155

// Calculate with cache discount (90% for OpenAI, 90% for Anthropic, standard for Google)
const cachedCost = calculateCost('gpt-5.2-thinking', 50_000, 2_000, { useCachedInput: true });
console.log(`Cached: $${cachedCost}`); // 0.0293

// Filter models by vendor
const anthropicModels = getModelsByVendor(Vendor.Anthropic);  // 5 models
const openaiModels = getModelsByVendor(Vendor.OpenAI);        // 11 models
const googleModels = getModelsByVendor(Vendor.Google);        // 7 models

// Get all active models
const activeModels = getActiveModels();  // All 23 currently active models
```

**Registry Contents (23 models total):**
- **OpenAI (11 models)**: GPT-5.2 series (instant, thinking, pro, codex), GPT-5 family (5, 5.1, mini, nano), GPT-4.1 (standard, mini), o3-mini
- **Anthropic (5 models)**: Claude 4.5 series (Opus, Sonnet, Haiku), Claude 4.x legacy (Opus 4.1, Sonnet 4)
- **Google (7 models)**: Gemini 3 series (Flash preview, Pro, Pro Image), Gemini 2.5 series (Pro, Flash, Flash-Lite, Flash Image)

**Model Metadata (ILLMDescription):**
- Pricing: Input/output CPM (cost per million tokens), cached input pricing
- Context windows: Max input/output tokens
- Feature flags: reasoning, streaming, structuredOutput, functionCalling, vision, audio, video, extendedThinking, batchAPI, promptCaching
- **Parameter support**: Indicates which sampling parameters are supported by the model (temperature, topP, frequencyPenalty, presencePenalty)
  - Reasoning models (GPT-5 series, o1, o3) don't support sampling parameters
  - If not specified, all parameters are assumed supported (backward compatibility)
- Release date and knowledge cutoff dates
- Active status

**Use Cases:**
- Cost estimation for API calls
- Model selection based on capabilities
- Feature availability checking
- Pricing comparison across vendors
- Documentation and tooling

### createProvider (`src/core/createProvider.ts`)

Factory that creates ITextProvider from Connector:

```typescript
import { createProvider } from '@oneringai/agents';

const provider = createProvider(connector);
// Returns: OpenAITextProvider, AnthropicTextProvider, etc.
```

### Audio Capabilities (NEW)

#### TextToSpeech (`src/core/TextToSpeech.ts`)

High-level Text-to-Speech synthesis:

```typescript
import { TextToSpeech } from '@oneringai/agents';

const tts = TextToSpeech.create({
  connector: 'openai',
  model: 'tts-1-hd',      // or 'tts-1', 'gpt-4o-mini-tts'
  voice: 'nova',          // alloy, echo, fable, onyx, nova, shimmer
});

// Synthesize to Buffer
const response = await tts.synthesize('Hello, world!');
console.log(response.audio);  // Buffer
console.log(response.format); // 'mp3'

// Synthesize to file
await tts.toFile('Hello, world!', './output.mp3');

// With options
const audio = await tts.synthesize('Speak slowly', {
  voice: 'alloy',
  format: 'wav',
  speed: 0.75,  // 0.25 to 4.0
});

// Introspection
const voices = await tts.listVoices();
const models = tts.listAvailableModels();
const supportsInstructions = tts.supportsFeature('instructionSteering');
```

#### SpeechToText (`src/core/SpeechToText.ts`)

High-level Speech-to-Text transcription:

```typescript
import { SpeechToText } from '@oneringai/agents';

const stt = SpeechToText.create({
  connector: 'openai',
  model: 'whisper-1',  // or 'gpt-4o-transcribe'
});

// Transcribe from file path
const result = await stt.transcribeFile('./audio.mp3');
console.log(result.text);

// Transcribe from Buffer
const audioBuffer = await fs.readFile('./audio.mp3');
const result = await stt.transcribe(audioBuffer);

// With timestamps
const detailed = await stt.transcribeWithTimestamps(audioBuffer, 'word');
console.log(detailed.words);  // [{ word, start, end }, ...]

// Translation (to English)
const english = await stt.translate(frenchAudioBuffer);

// Introspection
const supportsDiarization = stt.supportsFeature('diarization');
const granularities = stt.getTimestampGranularities();
```

#### TTS Model Registry (`src/domain/entities/TTSModel.ts`)

```typescript
import { getTTSModelInfo, TTS_MODELS, Vendor } from '@oneringai/agents';

// Access model constants
const model = TTS_MODELS[Vendor.OpenAI].TTS_1_HD;  // 'tts-1-hd'

// Get model info
const info = getTTSModelInfo('gpt-4o-mini-tts');
console.log(info.capabilities.features.instructionSteering);  // true
console.log(info.pricing.per1kCharacters);  // 0.015
```

**Available TTS Models:**
- **OpenAI**: `tts-1`, `tts-1-hd`, `gpt-4o-mini-tts` (instruction-steerable)
- **Google**: `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts`

#### STT Model Registry (`src/domain/entities/STTModel.ts`)

```typescript
import { getSTTModelInfo, STT_MODELS, Vendor } from '@oneringai/agents';

// Access model constants
const model = STT_MODELS[Vendor.OpenAI].WHISPER_1;  // 'whisper-1'

// Get model info
const info = getSTTModelInfo('gpt-4o-transcribe-diarize');
console.log(info.capabilities.features.diarization);  // true
console.log(info.pricing.perMinute);  // 0.012
```

**Available STT Models:**
- **OpenAI**: `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-transcribe-diarize`
- **Groq**: `whisper-large-v3`, `distil-whisper-large-v3-en` (12x cheaper!)

### Image Generation (NEW)

#### ImageGeneration (`src/capabilities/images/ImageGeneration.ts`)

High-level image generation with OpenAI DALL-E and Google Imagen:

```typescript
import { ImageGeneration } from '@oneringai/agents';

const imageGen = ImageGeneration.create({ connector: 'openai' });

// Generate image
const result = await imageGen.generate({
  prompt: 'A futuristic city at sunset',
  model: 'dall-e-3',
  size: '1024x1024',
  quality: 'hd',
  style: 'vivid',  // or 'natural'
});

// Access result
const base64 = result.data[0].b64_json;
const revisedPrompt = result.data[0].revised_prompt;

// Save to file
const buffer = Buffer.from(base64!, 'base64');
await fs.writeFile('./output.png', buffer);

// Google Imagen
const googleGen = ImageGeneration.create({ connector: 'google' });
const googleResult = await googleGen.generate({
  prompt: 'A colorful butterfly',
  model: 'imagen-4.0-generate-001',
  n: 2,
});
```

#### Image Model Registry (`src/domain/entities/ImageModel.ts`)

```typescript
import { getImageModelInfo, IMAGE_MODELS, Vendor, calculateImageCost } from '@oneringai/agents';

// Access model constants
const dalle3 = IMAGE_MODELS[Vendor.OpenAI].DALL_E_3;  // 'dall-e-3'
const imagen = IMAGE_MODELS[Vendor.Google].IMAGEN_4_GENERATE;  // 'imagen-4.0-generate-001'

// Get model info
const info = getImageModelInfo('dall-e-3');
console.log(info.capabilities.features.styleControl);  // true
console.log(info.capabilities.features.promptRevision);  // true

// Calculate cost
const cost = calculateImageCost('dall-e-3', 5, 'hd');  // 5 HD images
console.log(`Cost: $${cost}`);  // $0.40
```

**Available Image Models:**
- **OpenAI**: `dall-e-3`, `dall-e-2`, `gpt-image-1`
- **Google**: `imagen-4.0-generate-001`, `imagen-4.0-ultra-generate-001`, `imagen-4.0-fast-generate-001`

### Video Generation (NEW)

#### VideoGeneration (`src/capabilities/video/VideoGeneration.ts`)

High-level video generation with OpenAI Sora and Google Veo:

```typescript
import { VideoGeneration } from '@oneringai/agents';

const videoGen = VideoGeneration.create({ connector: 'openai' });

// Start video generation (async - returns job)
const job = await videoGen.generate({
  prompt: 'A cinematic shot of a sunrise over mountains',
  model: 'sora-2',
  duration: 8,
  resolution: '1280x720',
});

// Wait for completion (polls every 10s)
const result = await videoGen.waitForCompletion(job.jobId);

// Download the video
const videoBuffer = await videoGen.download(job.jobId);
await fs.writeFile('./output.mp4', videoBuffer);

// Or use convenience method
const completed = await videoGen.generateAndWait({
  prompt: 'A butterfly flying',
  duration: 4,
});

// Google Veo
const googleVideo = VideoGeneration.create({ connector: 'google' });
const veoJob = await googleVideo.generate({
  prompt: 'A thunderstorm over a city',
  model: 'veo-3.1-generate-preview',
  duration: 8,
  vendorOptions: {
    negativePrompt: 'blurry, low quality',
  },
});
```

#### Video Model Registry (`src/domain/entities/VideoModel.ts`)

```typescript
import { getVideoModelInfo, VIDEO_MODELS, Vendor, calculateVideoCost } from '@oneringai/agents';

// Access model constants
const sora = VIDEO_MODELS[Vendor.OpenAI].SORA_2;  // 'sora-2'
const veo = VIDEO_MODELS[Vendor.Google].VEO_3_1;  // 'veo-3.1-generate-preview'

// Get model info
const info = getVideoModelInfo('sora-2');
console.log(info.capabilities.durations);  // [4, 8, 12]
console.log(info.capabilities.audio);  // true
console.log(info.capabilities.imageToVideo);  // true

// Calculate cost
const cost = calculateVideoCost('sora-2', 8);  // 8 seconds
console.log(`Cost: $${cost}`);  // $1.20
```

**Available Video Models:**
- **OpenAI**: `sora-2`, `sora-2-pro`
- **Google**: `veo-2.0-generate-001`, `veo-3-generate-preview`, `veo-3.1-fast-generate-preview`, `veo-3.1-generate-preview`

## Directory Structure

```
src/
├── index.ts                          # Main exports
├── core/                             # Core architecture
│   ├── index.ts                      # Core exports
│   ├── Vendor.ts                     # Vendor enum
│   ├── Connector.ts                  # Connector registry
│   ├── Agent.ts                      # Agent class
│   ├── ToolManager.ts                # Dynamic tool management
│   ├── SessionManager.ts             # Unified session persistence
│   ├── createProvider.ts             # Provider factory (text)
│   ├── createAudioProvider.ts        # Provider factory (audio)
│   ├── createImageProvider.ts        # Provider factory (image)
│   ├── createVideoProvider.ts        # Provider factory (video)
│   ├── TextToSpeech.ts               # TTS capability class
│   ├── SpeechToText.ts               # STT capability class
│   └── context/                      # Universal context management
│       ├── ContextManager.ts         # Strategy-based context manager
│       ├── types.ts                  # Core interfaces
│       └── strategies/               # Compaction strategies
│           ├── ProactiveStrategy.ts
│           ├── AggressiveStrategy.ts
│           ├── LazyStrategy.ts
│           ├── RollingWindowStrategy.ts
│           └── AdaptiveStrategy.ts
├── domain/                           # Domain layer
│   ├── entities/                     # Data structures
│   │   ├── Message.ts                # InputItem, OutputItem
│   │   ├── Content.ts                # ContentType
│   │   ├── Tool.ts                   # ToolFunction, ToolCall
│   │   ├── Connector.ts              # ConnectorConfig types
│   │   ├── Model.ts                  # LLM model registry (23+ models)
│   │   ├── TTSModel.ts               # TTS model registry
│   │   ├── STTModel.ts               # STT model registry
│   │   ├── ImageModel.ts             # Image model registry
│   │   ├── VideoModel.ts             # Video model registry
│   │   ├── SharedVoices.ts           # Voice/language constants
│   │   ├── RegistryUtils.ts          # Generic registry helpers
│   │   ├── Task.ts                   # Task & Plan entities
│   │   ├── Memory.ts                 # Memory entities
│   │   ├── Response.ts               # LLMResponse
│   │   └── Services.ts               # External service definitions (35+)
│   ├── interfaces/                   # Contracts
│   │   ├── IProvider.ts
│   │   ├── ITextProvider.ts
│   │   ├── IAudioProvider.ts         # TTS/STT interfaces
│   │   ├── IVideoProvider.ts         # Video generation interface
│   │   ├── IToolExecutor.ts
│   │   ├── IMemoryStorage.ts
│   │   └── IToolContext.ts
│   ├── types/                        # Shared types
│   │   └── SharedTypes.ts            # NEW: Audio/image shared types
│   └── errors/                       # Error classes
├── capabilities/                     # Feature modules
│   ├── agents/                       # Agentic workflows
│   │   ├── AgenticLoop.ts            # Tool calling loop
│   │   └── ToolExecutor.ts           # Tool execution
│   ├── taskAgent/                    # Task-based agents
│   │   ├── TaskAgent.ts              # Main orchestrator
│   │   ├── WorkingMemory.ts          # Memory management
│   │   ├── HistoryManager.ts         # Conversation tracking
│   │   ├── IdempotencyCache.ts       # Tool call caching
│   │   ├── PlanExecutor.ts           # Plan execution
│   │   ├── CheckpointManager.ts      # State persistence
│   │   ├── PlanningAgent.ts          # AI-driven planning
│   │   ├── memoryTools.ts            # Built-in memory tools
│   │   └── contextTools.ts           # Context inspection tools
│   ├── universalAgent/               # Universal agent
│   │   ├── UniversalAgent.ts         # Main unified agent
│   │   ├── ModeManager.ts            # Mode state machine
│   │   ├── metaTools.ts              # Meta-tools for mode transitions
│   │   ├── types.ts                  # Type definitions
│   │   └── index.ts                  # Exports
│   └── video/                        # Video generation capability
│       ├── VideoGeneration.ts        # High-level video API
│       └── index.ts                  # Exports
├── infrastructure/                   # Infrastructure implementations
│   ├── providers/                    # LLM providers
│   │   ├── base/                     # NEW: Base provider classes
│   │   │   └── BaseMediaProvider.ts  # Circuit breaker, logging, metrics
│   │   ├── openai/
│   │   │   ├── OpenAITextProvider.ts
│   │   │   ├── OpenAITTSProvider.ts  # TTS
│   │   │   ├── OpenAISTTProvider.ts  # STT
│   │   │   ├── OpenAIImageProvider.ts # Image generation
│   │   │   └── OpenAISoraProvider.ts # Video generation
│   │   ├── anthropic/
│   │   ├── google/
│   │   │   ├── GoogleTextProvider.ts
│   │   │   ├── GoogleTTSProvider.ts  # TTS
│   │   │   ├── GoogleImagenProvider.ts # Image generation
│   │   │   └── GoogleVeoProvider.ts  # Video generation
│   │   └── generic/                  # OpenAI-compatible
│   ├── context/                      # NEW: Context infrastructure
│   │   ├── providers/                # Context providers
│   │   │   └── TaskAgentContextProvider.ts
│   │   ├── compactors/               # Compaction implementations
│   │   │   ├── TruncateCompactor.ts
│   │   │   ├── SummarizeCompactor.ts
│   │   │   └── MemoryEvictionCompactor.ts
│   │   └── estimators/               # Token estimation
│   │       └── ApproximateEstimator.ts
│   └── storage/                      # Persistence
│       ├── InMemoryStorage.ts        # Memory storage (Task data)
│       ├── InMemorySessionStorage.ts # NEW: Session storage (in-memory)
│       └── FileSessionStorage.ts     # NEW: Session storage (file-based)
├── connectors/                       # External API auth (OAuth)
│   ├── oauth/                        # OAuth 2.0 implementation
│   └── authenticatedFetch.ts         # Authenticated fetch using Connector
├── tools/                            # Built-in tools
│   ├── filesystem/                   # File system tools
│   │   ├── index.ts                  # Exports all filesystem tools
│   │   ├── types.ts                  # Shared types and config
│   │   ├── readFile.ts               # read_file tool
│   │   ├── writeFile.ts              # write_file tool
│   │   ├── editFile.ts               # edit_file tool
│   │   ├── glob.ts                   # glob tool
│   │   ├── grep.ts                   # grep tool
│   │   └── listDirectory.ts          # list_directory tool
│   ├── shell/                        # Shell execution tools
│   │   ├── index.ts                  # Exports shell tools
│   │   ├── types.ts                  # Shell config and blocked commands
│   │   └── bash.ts                   # bash tool
│   ├── connector/                    # Connector-based tools (external APIs)
│   │   ├── index.ts                  # Exports connector tools
│   │   └── ConnectorTools.ts         # Generic API tool + service registry
│   ├── code/
│   └── json/
└── utils/                            # Utilities
    ├── messageBuilder.ts
    └── clipboardImage.ts
```

## MCP (Model Context Protocol) Integration

The library provides seamless integration with Model Context Protocol (MCP) servers, enabling automatic discovery and registration of external tools.

### Architecture

MCP integration follows the existing Connector-First pattern:

```
┌─────────────────────────────────────────────────────┐
│              Config.load() / Manual Setup           │
│  MCPRegistry.create() → Agent.create()             │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│           MCPRegistry (Static Registry)             │
│  Pattern: Like Connector registry                  │
│  Manages MCP client connections                    │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│               MCPClient (Wrapper)                   │
│  Wraps @modelcontextprotocol/sdk Client           │
│  - Connection lifecycle & auto-reconnect          │
│  - Tool/resource/prompt discovery                 │
│  - Auto-register with ToolManager                 │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│        @modelcontextprotocol/sdk (Official)        │
│  - JSON-RPC 2.0 protocol                          │
│  - Stdio/SSE/WebSocket transports                 │
│  - MCP specification implementation               │
└────────────────────────────────────────────────────┘
```

**Key Features:**
- Official `@modelcontextprotocol/sdk` for protocol implementation
- Static MCPRegistry for managing connections
- Automatic tool discovery and registration
- **Transport support**: Stdio (local) and HTTP/HTTPS (remote) transports
- Auto-reconnect with exponential backoff
- Health checks and connection monitoring
- Namespace-based tool organization (`mcp:{server}:{tool}`)
- Permission integration (all MCP tools require approval)

### MCPRegistry (`src/core/mcp/MCPRegistry.ts`)

Static registry for MCP client connections:

```typescript
import { MCPRegistry } from '@oneringai/agents';

// Create and register an MCP client
const client = MCPRegistry.create({
  name: 'filesystem',
  transport: 'stdio',
  transportConfig: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir'],
  },
  autoConnect: true,
  toolNamespace: 'mcp:fs',
});

// Get a registered client
const client = MCPRegistry.get('filesystem');

// Check if exists
if (MCPRegistry.has('filesystem')) { ... }

// List all
const names = MCPRegistry.list();

// Get server info
const info = MCPRegistry.getInfo('filesystem');
// { name, state, connected, toolCount }

// Load from config file
const clients = await MCPRegistry.loadFromConfigFile('./oneringai.config.json');

// Connect/disconnect all
await MCPRegistry.connectAll();
await MCPRegistry.disconnectAll();

// Cleanup
MCPRegistry.destroyAll();
```

### MCPClient (`src/core/mcp/MCPClient.ts`)

High-level MCP client wrapper:

```typescript
import { MCPClient } from '@oneringai/agents';

// Connection lifecycle
await client.connect();
await client.disconnect();
await client.reconnect();
const isConnected = client.isConnected();
const alive = await client.ping();

// Tool operations
const tools = await client.listTools();
const result = await client.callTool('read_file', { path: './README.md' });

// Register with ToolManager
client.registerTools(agent.tools);
client.unregisterTools(agent.tools);

// Resource operations
const resources = await client.listResources();
const content = await client.readResource('file:///path/to/file');
await client.subscribeResource('file:///watch');
await client.unsubscribeResource('file:///watch');

// Prompt operations
const prompts = await client.listPrompts();
const prompt = await client.getPrompt('summarize', { length: 'short' });

// State management
const state = client.getState();
client.loadState(state);

// Events
client.on('connected', () => console.log('Connected'));
client.on('disconnected', () => console.log('Disconnected'));
client.on('reconnecting', (attempt) => console.log(`Reconnecting (${attempt})...`));
client.on('failed', (error) => console.error('Failed:', error));
client.on('tool:called', (name, args) => console.log(`Tool called: ${name}`));
client.on('tool:result', (name, result) => console.log(`Tool result: ${name}`));
client.on('resource:updated', (uri) => console.log(`Resource updated: ${uri}`));
client.on('error', (error) => console.error('Error:', error));

// Cleanup
client.destroy();
```

### Configuration (`oneringai.config.json`)

Global configuration file for MCP servers and library settings:

```json
{
  "version": "1.0",
  "mcp": {
    "servers": [
      {
        "name": "filesystem",
        "displayName": "Filesystem Server",
        "transport": "stdio",
        "transportConfig": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
          "env": { "NODE_ENV": "production" }
        },
        "autoConnect": true,
        "toolNamespace": "mcp:fs",
        "permissions": {
          "defaultScope": "session",
          "defaultRiskLevel": "medium"
        }
      }
    ],
    "defaults": {
      "autoConnect": false,
      "autoReconnect": true,
      "reconnectIntervalMs": 5000,
      "maxReconnectAttempts": 10,
      "requestTimeoutMs": 30000,
      "healthCheckIntervalMs": 60000
    }
  }
}
```

**Configuration Sections:**
- `mcp` - MCP server configurations
- `tools` - Global tool permission defaults
- `session` - Session storage configuration
- `context` - Context management settings

**Environment Variable Interpolation:**
Use `${ENV_VAR}` in config values:
```json
{
  "transportConfig": {
    "token": "${GITHUB_TOKEN}"
  }
}
```

### Config Loader (`src/core/Config.ts`)

Global configuration singleton:

```typescript
import { Config } from '@oneringai/agents';

// Load from file
const config = await Config.load('./oneringai.config.json');

// Load synchronously
const config = Config.loadSync();

// Get current config
const config = Config.get();

// Get specific section
const mcpConfig = Config.getSection('mcp');
const sessionConfig = Config.getSection('session');

// Check if loaded
if (Config.isLoaded()) { ... }

// Reload
await Config.reload();

// Set programmatically
Config.set({ version: '1.0', mcp: {...} });

// Clear (for testing)
Config.clear();
```

**Default Search Paths:**
1. `./oneringai.config.json` (current directory)
2. `~/.oneringai/config.json` (home directory)

### MCP Types

**MCPServerConfig:**
```typescript
interface MCPServerConfig {
  name: string;                    // Unique identifier
  displayName?: string;            // Human-readable name
  description?: string;            // Server description
  transport: 'stdio' | 'sse' | 'websocket';
  transportConfig: TransportConfig;
  autoConnect?: boolean;           // Connect on startup (default: false)
  autoReconnect?: boolean;         // Reconnect on failure (default: true)
  reconnectIntervalMs?: number;    // Reconnect delay (default: 5000)
  maxReconnectAttempts?: number;   // Max attempts (default: 10)
  requestTimeoutMs?: number;       // Request timeout (default: 30000)
  healthCheckIntervalMs?: number;  // Health check interval (default: 60000)
  toolNamespace?: string;          // Tool prefix (default: 'mcp:{name}')
  permissions?: {
    defaultScope?: 'once' | 'session' | 'always' | 'never';
    defaultRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
  };
}
```

**Transport Configs:**
```typescript
// Stdio transport (process spawning for local servers)
interface StdioTransportConfig {
  command: string;      // e.g., 'npx', 'node', 'python'
  args?: string[];      // Command arguments
  env?: Record<string, string>;    // Environment variables
  cwd?: string;         // Working directory
}

// HTTP/HTTPS transport (StreamableHTTP for remote servers)
interface HTTPTransportConfig {
  url: string;          // HTTP(S) endpoint URL
  token?: string;       // Bearer token (supports ${ENV_VAR})
  headers?: Record<string, string>;  // Additional headers
  timeoutMs?: number;   // Request timeout (default: 30000)
  sessionId?: string;   // Session ID for reconnection
  reconnection?: {
    maxReconnectionDelay?: number;         // Max delay (default: 30000)
    initialReconnectionDelay?: number;     // Initial delay (default: 1000)
    reconnectionDelayGrowFactor?: number;  // Growth factor (default: 1.5)
    maxRetries?: number;                   // Max retries (default: 2)
  };
}
```

**MCP Tool:**
```typescript
interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}
```

**MCP Tool Result:**
```typescript
interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
  isError?: boolean;
}
```

### Error Types

```typescript
import {
  MCPError,
  MCPConnectionError,
  MCPTimeoutError,
  MCPProtocolError,
  MCPToolError,
  MCPResourceError,
} from '@oneringai/agents';

// Base error
throw new MCPError('Something went wrong', 'server-name');

// Connection errors
throw new MCPConnectionError('Failed to connect', 'server-name');

// Timeout errors
throw new MCPTimeoutError('Request timed out', 30000, 'server-name');

// Protocol errors
throw new MCPProtocolError('Invalid message', 'server-name');

// Tool execution errors
throw new MCPToolError('Tool failed', 'tool-name', 'server-name');

// Resource errors
throw new MCPResourceError('Resource not found', 'uri', 'server-name');
```

### Available MCP Servers

Official MCP servers from `@modelcontextprotocol`:

- **@modelcontextprotocol/server-filesystem** - File system access
- **@modelcontextprotocol/server-github** - GitHub API integration
- **@modelcontextprotocol/server-google-drive** - Google Drive access
- **@modelcontextprotocol/server-slack** - Slack workspace integration
- **@modelcontextprotocol/server-postgres** - PostgreSQL database access
- And many more community servers...

See https://github.com/modelcontextprotocol for full list.

## Usage Patterns

### Basic Text Generation

```typescript
import { Connector, Agent, Vendor } from '@oneringai/agents';

Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
});

const response = await agent.run('Hello!');
console.log(response.output_text);
```

### Agent with Tools

```typescript
import { Connector, Agent, Vendor, ToolFunction } from '@oneringai/agents';

const weatherTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get weather for a location',
      parameters: {
        type: 'object',
        properties: { location: { type: 'string' } },
        required: ['location'],
      },
    },
  },
  execute: async (args) => ({ temp: 72, location: args.location }),
  // Optional: Human-readable description for logging/UI
  describeCall: (args) => args.location,
};

Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool],
});

const response = await agent.run('What is the weather in Paris?');
```

### Multiple Keys Per Vendor

```typescript
// Main API key
Connector.create({
  name: 'openai-main',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_KEY_MAIN! },
});

// Backup API key
Connector.create({
  name: 'openai-backup',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_KEY_BACKUP! },
});

// Use different keys
const agent1 = Agent.create({ connector: 'openai-main', model: 'gpt-4' });
const agent2 = Agent.create({ connector: 'openai-backup', model: 'gpt-4' });
```

### Streaming

```typescript
import { isOutputTextDelta, StreamHelpers } from '@oneringai/agents';

// Manual iteration
for await (const event of agent.stream('Hello')) {
  if (isOutputTextDelta(event)) {
    process.stdout.write(event.delta);
  }
}

// Helper functions
for await (const text of StreamHelpers.textOnly(agent.stream('Hello'))) {
  process.stdout.write(text);
}
```

### MCP Integration

Use MCP servers to extend agent capabilities:

```typescript
import { Connector, Agent, Vendor, MCPRegistry } from '@oneringai/agents';

// Setup connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Create MCP client
const client = MCPRegistry.create({
  name: 'filesystem',
  transport: 'stdio',
  transportConfig: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
  },
});

// Connect to server
await client.connect();

// Create agent and register MCP tools
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
});

client.registerTools(agent.tools);

// Agent can now use MCP tools
const response = await agent.run('List files in the current directory');
```

**Load from Configuration File:**

```typescript
import { Config, MCPRegistry, Agent } from '@oneringai/agents';

// Load config
await Config.load('./oneringai.config.json');

// Create all MCP clients from config
const clients = MCPRegistry.createFromConfig(Config.getSection('mcp')!);

// Connect all with autoConnect enabled
await MCPRegistry.connectAll();

// Create agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
});

// Register tools from all servers
for (const client of clients) {
  if (client.isConnected()) {
    client.registerTools(agent.tools);
  }
}

// Check what tools are available
console.log(`Available tools: ${agent.listTools().join(', ')}`);
```

**Tool Namespacing:**

MCP tools are namespaced to prevent conflicts:
```typescript
// Default namespace: mcp:{server-name}:{tool-name}
client.tools.forEach(tool => {
  console.log(tool.name);  // e.g., 'mcp:filesystem:read_file'
});

// Custom namespace
MCPRegistry.create({
  name: 'fs',
  toolNamespace: 'files',
  // ...
});
// Tools will be: files:read_file, files:write_file, etc.
```

**Event Monitoring:**

```typescript
client.on('connected', () => console.log('MCP server connected'));
client.on('disconnected', () => console.log('MCP server disconnected'));
client.on('reconnecting', (attempt) => console.log(`Reconnecting (${attempt})...`));
client.on('tool:called', (name, args) => {
  console.log(`Tool called: ${name}`, args);
});
client.on('tool:result', (name, result) => {
  console.log(`Tool result: ${name}`, result);
});
client.on('error', (error) => console.error('MCP error:', error));
```

### Developer Tools (Filesystem & Shell)

Built-in tools for file system operations and shell command execution:

```typescript
import { developerTools } from '@oneringai/agents';

// Use all developer tools at once
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: developerTools,
});

// Agent can now read, write, edit files, search, and execute commands
await agent.run('Find all TODO comments in src/**/*.ts');
```

**Available Tools:**
- `read_file` - Read file contents with line numbers
- `write_file` - Create/overwrite files with auto parent directory creation
- `edit_file` - Surgical find/replace (ensures uniqueness to prevent mistakes)
- `glob` - Find files by pattern (`**/*.ts`, `src/**/*.{ts,tsx}`)
- `grep` - Search content with regex (supports context lines, file type filtering)
- `list_directory` - List directory contents with recursive support
- `bash` - Execute shell commands with timeout and safety guards

**Configuration:**

```typescript
import { createReadFileTool, createBashTool } from '@oneringai/agents';

// Customize tools
const readFile = createReadFileTool({
  workingDirectory: '/path/to/project',
  blockedDirectories: ['node_modules', '.git', 'dist'],
  maxFileSize: 5 * 1024 * 1024, // 5MB
});

const bash = createBashTool({
  workingDirectory: '/path/to/project',
  defaultTimeout: 60000, // 1 minute
  env: { NODE_ENV: 'development' },
});
```

**Safety Features:**
- Blocks dangerous commands (`rm -rf /`, fork bombs, `/dev/sda` writes)
- Configurable blocked directories (default: `node_modules`, `.git`)
- Timeout protection (default 2 min, max 10 min)
- Output truncation for large outputs

### Tool Call Descriptions

Tools can provide human-readable descriptions of their invocations for logging and UI display:

```typescript
import { ToolFunction, defaultDescribeCall, getToolCallDescription } from '@oneringai/agents';

// Implement describeCall in your tool
const myTool: ToolFunction = {
  definition: { ... },
  execute: async (args) => { ... },

  // Optional: Returns a concise description for logging/UI
  describeCall: (args) => {
    if (args.verbose) {
      return `${args.file_path} (verbose mode)`;
    }
    return args.file_path;
  },
};

// Use defaultDescribeCall as a fallback for tools without describeCall
const description = defaultDescribeCall({ file_path: '/path/to/file.ts', limit: 100 });
// Returns: '/path/to/file.ts'

// Or use getToolCallDescription which tries describeCall first, then falls back
const desc = getToolCallDescription(myTool, args);
```

**Built-in Tool Descriptions:**

| Tool | Example Output |
|------|----------------|
| `read_file` | `/path/to/file.ts` or `/path/to/file.ts [lines 100-200]` |
| `write_file` | `/path/to/file.ts` or `/path/to/file.ts (5KB)` |
| `edit_file` | `/path/to/file.ts` or `/path/to/file.ts (replace all)` |
| `glob` | `**/*.ts` or `**/*.ts in /project` |
| `grep` | `"pattern"` or `"pattern" in *.ts` |
| `list_directory` | `/path` or `/path (recursive, files)` |
| `bash` | `npm install` or `[bg] npm run build` |

**defaultDescribeCall Priority:**
1. Checks common argument names: `file_path`, `path`, `command`, `query`, `pattern`, `url`, `key`, `name`, `message`, `content`, `expression`, `prompt`
2. Falls back to first string argument
3. Falls back to `key=value` format for other types
4. Truncates to 60 characters

## Adding New Vendors

1. **Add to Vendor enum** (`src/core/Vendor.ts`):

```typescript
export const Vendor = {
  // ... existing
  NewVendor: 'new-vendor',
} as const;
```

2. **Create provider** (`src/infrastructure/providers/newvendor/`):

```typescript
export class NewVendorTextProvider extends BaseTextProvider {
  readonly name = 'new-vendor';

  async generate(options: TextGenerateOptions): Promise<LLMResponse> {
    // Implementation
  }
}
```

3. **Register in factory** (`src/core/createProvider.ts`):

```typescript
case Vendor.NewVendor:
  return new NewVendorTextProvider({ ... });
```

## OAuth for External APIs

The library also supports OAuth for external APIs (GitHub, Microsoft, etc.):

```typescript
import { OAuthManager, FileStorage } from '@oneringai/agents';

const oauth = new OAuthManager({
  flow: 'authorization_code',
  clientId: '...',
  clientSecret: '...',
  authorizationUrl: '...',
  tokenUrl: '...',
  redirectUri: '...',
  scope: '...',
  storage: new FileStorage({ directory: './tokens' }),
});

const authUrl = await oauth.startAuthFlow('user123');
const token = await oauth.getToken('user123');
```

## Important Conventions

### Import Extensions

Always use `.js` extension in imports:

```typescript
// Correct
import { Agent } from './Agent.js';

// Wrong
import { Agent } from './Agent';
```

### Type Exports

Export enums as values, not types:

```typescript
// Correct - enum used at runtime
export { MessageRole } from './Message.js';

// Correct - interface is type-only
export type { Message } from './Message.js';
```

### Error Handling

Use custom error classes:

```typescript
import { ProviderAuthError } from '@oneringai/agents';

if (error.status === 401) {
  throw new ProviderAuthError('openai', 'Invalid API key');
}
```

## Build Commands

```bash
npm run build          # Build with tsup
npm run dev            # Watch mode
npm run typecheck      # Type check
npm run lint           # ESLint
npm test               # Run all tests (unit + integration)
npm run test:unit      # Run only unit tests
npm run test:integration  # Run only integration tests (requires API keys)
```

## Context Management (NEW)

The library includes a universal context management system with multiple strategies:

```typescript
import {
  ContextManager,
  TaskAgentContextProvider,
  ApproximateTokenEstimator,
  TruncateCompactor,
} from '@oneringai/agents';

// Create context provider (agent-specific)
const provider = new TaskAgentContextProvider({
  model: 'gpt-4',
  plan: plan,
  memory: workingMemory,
  historyManager: historyManager,
  currentInput: 'Task prompt',
});

// Create context manager with strategy
const contextManager = new ContextManager(
  provider,
  {
    maxContextTokens: 128000,
    strategy: 'adaptive',  // or 'proactive', 'aggressive', 'lazy', 'rolling-window'
    strategyOptions: { learningWindow: 50 },
  },
  [new TruncateCompactor(new ApproximateTokenEstimator())],
  new ApproximateTokenEstimator()
);

// Use before LLM calls
const prepared = await contextManager.prepare();

// Switch strategy at runtime
contextManager.setStrategy('aggressive');
```

**Available Strategies:**
- `proactive` - Default, balanced (compact at 75%)
- `aggressive` - Early compaction (compact at 60%)
- `lazy` - Minimal compaction (compact at 90%)
- `rolling-window` - Fixed-size window, no compaction
- `adaptive` - Learns and adapts based on usage

**Token Estimation with Content Type:**

The `estimateTokens` method supports content-type-aware estimation:

```typescript
// Estimate with content type for better accuracy
contextManager.estimateTokens(codeString, 'code');    // ~3 chars/token
contextManager.estimateTokens(proseText, 'prose');    // ~4 chars/token
contextManager.estimateTokens(mixedContent, 'mixed'); // ~3.5 chars/token (default)
```

**See:** `USER_GUIDE.md` for complete documentation.

## Task Agents

TaskAgents provide autonomous execution with:

```typescript
import { TaskAgent } from '@oneringai/agents';

const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, emailTool],
});

await agent.start({
  goal: 'Check weather and notify user',
  tasks: [
    { name: 'fetch_weather', description: 'Get weather' },
    { name: 'send_email', description: 'Email user', dependsOn: ['fetch_weather'] },
  ],
});
```

**Features:**
- **Working Memory** - Indexed key-value store with priority-based eviction
- **Context Management** - Automatic compaction with strategies
- **Tool Idempotency** - Cache tool results to prevent duplicates
- **State Persistence** - Resume after crashes with tool validation
- **External Dependencies** - Wait for webhooks, polling (with exponential backoff), manual input
- **Plan Updates** - Dynamic plan modification with validation options

### Plan Update Validation

Update plans safely with validation options:

```typescript
export interface PlanUpdateOptions {
  /** Allow removing in_progress tasks. Default: false */
  allowRemoveActiveTasks?: boolean;
  /** Validate no dependency cycles after update. Default: true */
  validateCycles?: boolean;
}

// Update plan with safety checks
await agent.updatePlan({
  addTasks: [{ name: 'new_task', description: 'New task' }],
  removeTasks: ['old_task'],
}, {
  allowRemoveActiveTasks: false,  // Throws if trying to remove active tasks
  validateCycles: true,           // Throws if update creates dependency cycle
});
```

### Resume Validation

When resuming a TaskAgent, tool availability is validated:

```typescript
// Resume validates tool names
const resumed = await TaskAgent.resume(agentId, {
  storage,
  tools: [weatherTool], // Warning logged if savedState had emailTool
});

// Console output:
// [TaskAgent.resume] Warning: Missing tools from saved state: email_tool. Tasks requiring these tools may fail.
// [TaskAgent.resume] Info: New tools not in saved state: new_tool
```

**See:** `USER_GUIDE.md` for complete TaskAgent documentation.

## Working Memory

### WorkingMemory (`src/capabilities/taskAgent/WorkingMemory.ts`)

Indexed key-value memory store with priority-based eviction, task-aware scoping, and lazy loading.

```typescript
import { WorkingMemory, forTasks, forPlan } from '@oneringai/agents';

// Create memory instance
const memory = new WorkingMemory(storage, {
  maxSizeBytes: 1024 * 1024,  // 1MB limit
  softLimitPercent: 80,       // Warn at 80%
});

// Store with full options
await memory.set('user.profile', 'User profile data', userData, {
  scope: { type: 'task', taskIds: ['task-1', 'task-2'] },
  priority: 'high',
  pinned: false,
});

// Factory functions for common patterns
const taskEntry = forTasks('temp', 'Temp data', value, ['task-1']);
const planEntry = forPlan('config', 'Plan config', config);

// Retrieve and delete
const data = await memory.get('user.profile');
await memory.delete('user.profile');

// Update scope dynamically
await memory.updateScope('key', { type: 'plan' });
await memory.addTasksToScope('key', ['task-3']);

// Eviction
await memory.evict(5, 'lru');   // Evict 5 least-recently-used
await memory.evict(5, 'size');  // Evict 5 largest entries

// Cleanup
memory.destroy();
```

### Memory Scopes

```typescript
// Simple scopes (for basic agents)
type SimpleScope = 'session' | 'persistent';

// Task-aware scopes (for TaskAgent)
type TaskAwareScope =
  | { type: 'session' }           // Cleared when agent ends
  | { type: 'plan' }              // Kept for entire plan
  | { type: 'persistent' }        // Never auto-cleaned
  | { type: 'task'; taskIds: string[] }; // Cleaned when tasks complete
```

### Memory Priority

Priority levels control eviction order (lowest priority evicted first):

```typescript
type MemoryPriority = 'low' | 'normal' | 'high' | 'critical';

// Priority values (higher = harder to evict)
// low: 1, normal: 2, high: 3, critical: 4
```

### Memory Tools (for LLM)

The `memory_store` tool exposes all options to the LLM:

```typescript
// Tool parameters
{
  key: string;           // Required: namespaced key
  description: string;   // Required: what the data contains
  value: any;            // Required: the data to store
  neededForTasks?: string[];  // Optional: task IDs that need this data
  scope?: 'session' | 'plan' | 'persistent';  // Optional: lifecycle
  priority?: 'low' | 'normal' | 'high' | 'critical';  // Optional: eviction priority
  pinned?: boolean;      // Optional: never evict if true
}
```

**Error Handling:** Memory tools throw `ToolExecutionError` when called without TaskAgent context:

```typescript
import { ToolExecutionError } from '@oneringai/agents';

// Memory tools require TaskAgent context
// Throws: ToolExecutionError('memory_store', 'Memory tools require TaskAgent context')
```

### Scope Utilities

```typescript
import {
  scopeEquals,
  scopeMatches,
  isSimpleScope,
  isTaskAwareScope,
  calculateEntrySize,
  isTerminalStatus,
  isTerminalMemoryStatus,
} from '@oneringai/agents';

// Compare scopes (order-independent for taskIds)
scopeEquals({ type: 'task', taskIds: ['a', 'b'] },
            { type: 'task', taskIds: ['b', 'a'] }); // true

// Match scope against filter (type-based matching)
scopeMatches(entryScope, filterScope);

// Type guards
isSimpleScope('session');  // true
isTaskAwareScope({ type: 'task', taskIds: [] });  // true

// Calculate UTF-8 byte size
const bytes = calculateEntrySize({ data: 'hello' });  // Correct for multi-byte chars
```

### Events

```typescript
memory.on('evicted', ({ keys, reason }) => {
  console.log(`Evicted ${keys.length} entries (${reason})`);
});

// PlanExecutor emits stale entry notifications
executor.on('memory:stale_entries', ({ entries, taskId }) => {
  console.log(`${entries.length} entries became stale after task ${taskId}`);
});
```

## Tool Management (NEW)

### ToolManager (`src/core/ToolManager.ts`)

Dynamic tool management for all agent types. Provides runtime enable/disable, namespaces, priority, and context-aware selection.

```typescript
import { ToolManager } from '@oneringai/agents';

const toolManager = new ToolManager();

// Register tools
toolManager.register(weatherTool, {
  namespace: 'weather',
  priority: 10,
  enabled: true,
});

// Enable/disable at runtime
toolManager.disable('get_weather');
toolManager.enable('get_weather');

// Get enabled tools
const enabled = toolManager.getEnabled();

// Context-aware selection
const selected = toolManager.selectForContext({
  mode: 'interactive',
  taskName: 'weather_check',
});

// State persistence
const state = toolManager.getState();
toolManager.loadState(state);
```

**Features:**
- **Dynamic registration** - Add/remove tools at runtime
- **Enable/disable** - Toggle tools without unregistering
- **Namespaces** - Organize tools by category
- **Priority** - Control tool selection order
- **Context-aware** - Select tools based on current context
- **State serialization** - Persist tool configuration

**Integration with Agent:**

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, emailTool],  // Still works!
});

// Access ToolManager
agent.tools.disable('email_tool');
agent.tools.enable('email_tool');

// Backward compatible methods still work
agent.addTool(newTool);
agent.removeTool('old_tool');
agent.listTools();
```

## Tool Permissions (NEW)

### ToolPermissionManager (`src/core/permissions/ToolPermissionManager.ts`)

Comprehensive permission system for controlling tool execution. Provides approval workflows, allowlists, blocklists, and session-based caching.

```typescript
import { Agent, ToolPermissionManager } from '@oneringai/agents';

// Create agent with permissions
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [readFile, writeFile, bash],
  permissions: {
    defaultScope: 'session',      // Require approval once per session
    blocklist: ['dangerous_tool'], // Never allow
    allowlist: ['safe_tool'],      // Always allow
    onApprovalRequired: async (context) => {
      // Custom approval logic
      console.log(`Approve ${context.toolCall.function.name}?`);
      return { approved: true, scope: 'session' };
    },
  },
});
```

**Default Allowlist (No Approval Required):**

The following tools are **automatically allowlisted** and never require user confirmation:

**Filesystem (Read-Only):**
- `read_file` - Read file contents
- `glob` - Find files by pattern
- `grep` - Search file contents
- `list_directory` - List directory

**Memory Management (Internal State):**
- `memory_store` - Store in working memory
- `memory_retrieve` - Retrieve from memory
- `memory_delete` - Delete from memory
- `memory_list` - List memory keys

**Context Introspection (Read-Only):**
- `context_inspect` - Get context budget
- `context_breakdown` - Get token breakdown
- `cache_stats` - Get cache statistics
- `memory_stats` - Get memory statistics

**Meta-Tools (Internal Coordination):**
- `_start_planning` - Start planning mode (UniversalAgent)
- `_modify_plan` - Modify plan (UniversalAgent)
- `_report_progress` - Report progress (UniversalAgent)
- `_request_approval` - Request approval (CRITICAL - prevents circular dependency!)

**Tools Requiring Approval (By Default):**
- `write_file`, `edit_file` - File modifications
- `bash` - Shell command execution
- `web_fetch`, `web_search` - External requests
- `execute_javascript` - Code execution
- Any custom tools not in the default allowlist

**Permission Scopes:**
- `once` - Require approval for each call (most secure)
- `session` - Approve once per session
- `always` - Auto-approve (add to allowlist)
- `never` - Always block (add to blocklist)

**Permission Configuration:**

```typescript
// Per-tool configuration
agent.permissions.setToolConfig('write_file', {
  scope: 'session',
  riskLevel: 'high',
  approvalMessage: 'This will modify files on disk',
  sensitiveArgs: ['path', 'content'],
});

// Runtime management
agent.permissions.allowlistAdd('trusted_tool');
agent.permissions.blocklistAdd('dangerous_tool');
agent.permissions.approveForSession('write_file');

// Check permissions
const result = agent.permissions.checkPermission('bash');
if (result.needsApproval) {
  // Show approval UI
}

// State persistence
const state = agent.permissions.getState();
agent.permissions.loadState(state);
```

**Features:**
- **Default allowlist** - Safe tools (read-only, introspection) auto-allowed
- **Approval caching** - Once, session, or always scopes
- **Allowlist/blocklist** - Fine-grained control
- **Session persistence** - Resume with approval state
- **Event emission** - Audit trails for compliance
- **Risk levels** - low, medium, high, critical classifications

**Integration with Agents:**

All agent types support permissions:
```typescript
// Basic Agent
const agent = Agent.create({ permissions: {...} });

// TaskAgent
const taskAgent = TaskAgent.create({ permissions: {...} });

// UniversalAgent
const uniAgent = UniversalAgent.create({ permissions: {...} });
```

## Session Management (NEW)

### SessionManager (`src/core/SessionManager.ts`)

Unified session persistence for all agent types (Agent, TaskAgent, UniversalAgent). Supports pluggable storage backends.

```typescript
import { SessionManager, InMemorySessionStorage, FileSessionStorage } from '@oneringai/agents';

// In-memory storage
const memoryStorage = new InMemorySessionStorage();
const sessionManager = new SessionManager({ storage: memoryStorage });

// File storage
const fileStorage = new FileSessionStorage({ directory: './sessions' });
const sessionManager = new SessionManager({ storage: fileStorage });

// Create session
const session = sessionManager.create('agent', {
  name: 'My Agent',
  tags: ['production'],
});

// Save session
await sessionManager.save(session);

// Load session
const loaded = await sessionManager.load(session.id);

// List sessions
const sessions = await sessionManager.list({ agentType: 'agent' });

// Auto-save
sessionManager.enableAutoSave(session, 30000); // Every 30s
```

**Session Structure:**
```typescript
interface Session {
  id: string;
  agentType: string;
  createdAt: number;
  lastAccessedAt: number;
  metadata: SessionMetadata;

  // Conversation
  history: SerializedHistory;

  // Memory (for TaskAgent)
  memory?: SerializedMemory;

  // Plan (for TaskAgent/UniversalAgent)
  plan?: SerializedPlan;

  // Metrics
  metrics: SessionMetrics;

  // Custom data
  customData?: Record<string, unknown>;
}
```

**Integration with Agent:**

```typescript
// Create agent with session support
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  session: {
    storage: new FileSessionStorage({ directory: './sessions' }),
    autoSave: true,
    autoSaveIntervalMs: 30000,
  },
});

// Session methods
const sessionId = agent.getSessionId();
const hasSession = agent.hasSession();
await agent.saveSession();

// Resume from session
const resumed = await Agent.resume(sessionId, {
  storage: new FileSessionStorage({ directory: './sessions' }),
});
```

**Storage Implementations:**
- **InMemorySessionStorage** - Fast, non-persistent (testing)
- **FileSessionStorage** - JSON files with index (production)
- **Custom** - Implement `ISessionStorage` interface

## Universal Agent (NEW)

### UniversalAgent (`src/capabilities/universalAgent/UniversalAgent.ts`)

A unified agent that combines interactive chat, planning, and task execution in one powerful interface.

```typescript
import { UniversalAgent } from '@oneringai/agents';

const agent = UniversalAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, emailTool],
  planning: {
    enabled: true,
    autoDetect: true,         // Auto-detect complex tasks
    requireApproval: true,    // Require approval before execution
  },
  session: {
    storage: new FileSessionStorage({ directory: './sessions' }),
    autoSave: true,
  },
});

// Chat - automatically handles mode transitions
const response = await agent.chat('Check weather in Paris and email me');
// Response includes mode, plan, progress, etc.

// Stream responses
for await (const event of agent.stream('What is 2+2?')) {
  if (event.type === 'text:delta') {
    process.stdout.write(event.delta);
  } else if (event.type === 'plan:created') {
    console.log('Plan created:', event.plan);
  }
}

// Configure at runtime
agent.setAutoApproval(false);
agent.setPlanningEnabled(true);

// Introspection
const mode = agent.getMode();           // 'interactive' | 'planning' | 'executing'
const plan = agent.getPlan();           // Current plan
const progress = agent.getProgress();   // Task progress
```

**Modes:**

1. **Interactive Mode** - Direct conversation, immediate tool execution
2. **Planning Mode** - Creates multi-step plans for complex tasks
3. **Executing Mode** - Executes plan tasks with user intervention support

**Features:**
- **Auto-detect complexity** - LLM detects when tasks need planning
- **Dynamic plan modification** - User can modify plans mid-execution
- **Configurable approval** - Control when approval is required
- **Session persistence** - Resume conversations seamlessly
- **Event streaming** - Real-time updates on plan/task progress
- **Intent analysis** - Pattern-based understanding of user intent

**Mode Transitions:**

```
interactive ←→ planning ←→ executing
```

Agent automatically transitions based on:
- User input patterns (approval, rejection, status query)
- Task complexity detection
- Plan completion
- User interrupts

**Meta-tools:**

UniversalAgent uses special meta-tools internally:
- `_start_planning` - Transition to planning mode
- `_modify_plan` - Modify current plan
- `_report_progress` - Report current status
- `_request_approval` - Request user approval

These are handled internally and don't require manual implementation.

## Key Files

1. `src/core/Connector.ts` - Connector registry
2. `src/core/Agent.ts` - Agent creation
3. `src/core/ToolManager.ts` - Dynamic tool management
4. `src/core/SessionManager.ts` - Unified session persistence
5. `src/core/createProvider.ts` - Provider factory (text)
6. `src/core/createAudioProvider.ts` - Provider factory (audio)
7. `src/core/createImageProvider.ts` - Provider factory (image)
8. `src/core/createVideoProvider.ts` - Provider factory (video)
9. `src/core/TextToSpeech.ts` - TTS capability class
10. `src/core/SpeechToText.ts` - STT capability class
11. `src/core/Vendor.ts` - Vendor enum
12. `src/core/context/` - Universal context management
13. `src/domain/entities/Model.ts` - LLM model registry (23+ models)
14. `src/domain/entities/TTSModel.ts` - TTS model registry
15. `src/domain/entities/STTModel.ts` - STT model registry
16. `src/domain/entities/ImageModel.ts` - Image model registry
17. `src/domain/entities/VideoModel.ts` - Video model registry (6 models)
18. `src/domain/entities/Memory.ts` - Memory entities, scopes, priorities, utilities
19. `src/domain/entities/Services.ts` - External service definitions (35+ services)
20. `src/tools/connector/ConnectorTools.ts` - Connector-based tools for external APIs
21. `src/capabilities/agents/AgenticLoop.ts` - Tool calling loop
22. `src/capabilities/taskAgent/` - Task agent implementation (WorkingMemory, PlanExecutor, etc.)
23. `src/capabilities/universalAgent/` - Universal agent
24. `src/capabilities/images/` - Image generation capability
25. `src/capabilities/video/` - Video generation capability
26. `src/infrastructure/providers/` - LLM, audio, image, and video provider implementations
27. `src/infrastructure/context/` - Context strategies, compactors, providers
28. `src/infrastructure/storage/` - Session and data storage

---

**Version**: 0.2.0
**Last Updated**: 2026-01-28
**Architecture**: Connector-First (v2)
