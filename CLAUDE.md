# Claude Development Guide

This document provides context for AI assistants (like Claude) to continue development of the `@oneringai/agents` library.

## Project Overview

**Name**: `@oneringai/agents`
**Purpose**: Unified AI agent library with multi-vendor support for text generation, image analysis, and agentic workflows
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
const model = getModelInfo('gpt-5.2-thinking');
console.log(model.features.input.tokens);   // 400000
console.log(model.features.output.tokens);  // 128000
console.log(model.features.input.cpm);      // 1.75
console.log(model.features.output.cpm);     // 14
console.log(model.features.reasoning);      // true
console.log(model.features.vision);         // true

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

## Directory Structure

```
src/
├── index.ts                          # Main exports
├── core/                             # NEW: Core architecture
│   ├── index.ts                      # Core exports
│   ├── Vendor.ts                     # Vendor enum
│   ├── Connector.ts                  # Connector registry
│   ├── Agent.ts                      # Agent class
│   └── createProvider.ts             # Provider factory
├── domain/                           # Domain layer
│   ├── entities/                     # Data structures
│   │   ├── Message.ts                # InputItem, OutputItem
│   │   ├── Content.ts                # ContentType
│   │   ├── Tool.ts                   # ToolFunction, ToolCall
│   │   ├── Connector.ts              # ConnectorConfig types
│   │   ├── Model.ts                  # Model registry (23+ models)
│   │   └── Response.ts               # LLMResponse
│   ├── interfaces/                   # Contracts
│   │   ├── IProvider.ts
│   │   ├── ITextProvider.ts
│   │   └── IToolExecutor.ts
│   ├── types/                        # Shared types
│   └── errors/                       # Error classes
├── capabilities/                     # Feature modules
│   └── agents/                       # Agentic workflows
│       ├── Agent.ts                  # Legacy Agent (still used)
│       ├── AgenticLoop.ts            # Tool calling loop
│       └── ToolExecutor.ts           # Tool execution
├── infrastructure/                   # Provider implementations
│   └── providers/
│       ├── openai/
│       ├── anthropic/
│       ├── google/
│       └── generic/                  # OpenAI-compatible
├── connectors/                       # External API auth (OAuth)
│   ├── oauth/                        # OAuth 2.0 implementation
│   └── authenticatedFetch.ts         # Authenticated fetch using Connector
├── tools/                            # Built-in tools
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
npm test               # Run tests
```

## Key Files

1. `src/core/Connector.ts` - Connector registry
2. `src/core/Agent.ts` - Agent creation
3. `src/core/createProvider.ts` - Provider factory
4. `src/core/Vendor.ts` - Vendor enum
5. `src/domain/entities/Model.ts` - Model registry (23+ models with pricing, features)
6. `src/capabilities/agents/AgenticLoop.ts` - Tool calling
7. `src/infrastructure/providers/` - Provider implementations

---

**Version**: 0.2.0
**Last Updated**: 2026-01-15
**Architecture**: Connector-First (v2)
