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
5. `src/capabilities/agents/AgenticLoop.ts` - Tool calling
6. `src/infrastructure/providers/` - Provider implementations

---

**Version**: 0.2.0
**Last Updated**: 2026-01-15
**Architecture**: Connector-First (v2)
