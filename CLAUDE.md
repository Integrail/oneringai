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
│   │   └── Response.ts               # LLMResponse
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
│   ├── code/
│   └── json/
└── utils/                            # Utilities
    ├── messageBuilder.ts
    └── clipboardImage.ts
```

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
- **Working Memory** - Indexed key-value store with lazy loading
- **Context Management** - Automatic compaction with strategies
- **Tool Idempotency** - Cache tool results to prevent duplicates
- **State Persistence** - Resume after crashes
- **External Dependencies** - Wait for webhooks, polling, manual input

**See:** `USER_GUIDE.md` for complete TaskAgent documentation.

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
18. `src/capabilities/agents/AgenticLoop.ts` - Tool calling loop
19. `src/capabilities/taskAgent/` - Task agent implementation
20. `src/capabilities/universalAgent/` - Universal agent
21. `src/capabilities/images/` - Image generation capability
22. `src/capabilities/video/` - Video generation capability
23. `src/infrastructure/providers/` - LLM, audio, image, and video provider implementations
24. `src/infrastructure/context/` - Context strategies, compactors, providers
25. `src/infrastructure/storage/` - Session and data storage

---

**Version**: 0.2.0
**Last Updated**: 2026-01-25
**Architecture**: Connector-First (v2)
