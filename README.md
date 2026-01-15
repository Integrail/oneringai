# @oneringai/agents

> **A unified AI agent library with multi-provider support for text generation, image analysis, and agentic workflows.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## Features

- **Unified API** - One interface for 10+ AI providers
- **Connector-First Architecture** - Single auth system for AI providers AND external APIs
- **Multiple Keys Per Vendor** - Support for multiple API keys per vendor (e.g., `openai-main`, `openai-backup`)
- **Model Registry** - Complete metadata for 23+ latest (2026) models with pricing, features, and capabilities
- **Agentic Workflows** - Built-in tool calling and multi-turn conversations
- **Vision Support** - Analyze images with AI across all providers
- **Clipboard Paste** - Ctrl+V screenshots directly (just like Claude Code!)
- **OAuth 2.0** - Full OAuth support for external APIs with multi-user support
- **Type-Safe** - Full TypeScript support
- **Clean Architecture** - Domain-driven design

## Supported AI Providers

| Provider | Text | Vision | Tools | JSON Schema | Context |
|----------|------|--------|-------|-------------|---------|
| **OpenAI** | Yes | Yes | Yes | Native | 128K |
| **Anthropic (Claude)** | Yes | Yes | Yes | Prompt | 200K |
| **Google (Gemini)** | Yes | Yes | Yes | Prompt | 1M |
| **Google Vertex AI** | Yes | Yes | Yes | Prompt | 1M |
| **Grok (xAI)** | Yes | Yes | Yes | No | 128K |
| **Groq** | Yes | No | Yes | No | 128K |
| **Together AI** | Yes | Some | Yes | No | 128K |
| **DeepSeek** | Yes | No | Yes | No | 64K |
| **Mistral** | Yes | No | Yes | No | 32K |
| **Ollama** | Yes | Varies | Yes | No | Varies |
| **Custom** | Yes | Varies | Yes | Varies | Varies |

---

## Quick Start

### 1. Installation

```bash
npm install @oneringai/agents
```

### 2. Setup

Create a `.env` file:

```bash
OPENAI_API_KEY=sk-your-key-here
# Optional providers
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
```

### 3. Basic Usage

```typescript
import { Connector, Agent, Vendor } from '@oneringai/agents';

// Step 1: Create a connector (auth configuration)
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Step 2: Create an agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
});

// Step 3: Run
const response = await agent.run('What is AI?');
console.log(response.output_text);
```

---

## Core Concepts

### Connectors

A **Connector** is a named authentication configuration. Create connectors once, use them everywhere:

```typescript
import { Connector, Vendor } from '@oneringai/agents';

// Create connectors for different providers
Connector.create({
  name: 'openai-main',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

Connector.create({
  name: 'anthropic',
  vendor: Vendor.Anthropic,
  auth: { type: 'api_key', apiKey: process.env.ANTHROPIC_API_KEY! },
});

// Multiple keys for the same vendor!
Connector.create({
  name: 'openai-backup',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_BACKUP_KEY! },
});
```

### Agents

An **Agent** is created from a connector and can run tasks:

```typescript
import { Agent } from '@oneringai/agents';

const agent = Agent.create({
  connector: 'openai-main',  // Reference connector by name
  model: 'gpt-4',
  instructions: 'You are a helpful assistant.',
  temperature: 0.7,
});

const response = await agent.run('Hello!');
```

### Model Registry

Access comprehensive metadata for 23+ latest (2026) models from OpenAI, Anthropic, and Google:

```typescript
import { MODEL_REGISTRY, LLM_MODELS, Vendor, getModelInfo, calculateCost } from '@oneringai/agents';

// Get model information
const gpt52 = getModelInfo(LLM_MODELS[Vendor.OpenAI].GPT_5_2_THINKING);
console.log(`Context window: ${gpt52.features.input.tokens} tokens`);
console.log(`Supports vision: ${gpt52.features.vision}`);
console.log(`Pricing: $${gpt52.features.input.cpm}/$${gpt52.features.output.cpm} per M tokens`);

// Calculate API costs
const cost = calculateCost('gpt-5.2-thinking', 50_000, 2_000);
console.log(`Cost for 50K input + 2K output: $${cost?.toFixed(4)}`); // $0.1155

// Calculate with cache discount (90% off for cached input)
const cachedCost = calculateCost('gpt-5.2-thinking', 50_000, 2_000, { useCachedInput: true });
console.log(`With caching: $${cachedCost?.toFixed(4)}`); // $0.0293

// Filter models by vendor
const anthropicModels = getModelsByVendor(Vendor.Anthropic);
console.log(`Anthropic has ${anthropicModels.length} models`); // 5

// List all available models
Object.keys(MODEL_REGISTRY).forEach(name => {
  const model = MODEL_REGISTRY[name];
  console.log(`${name}: $${model.features.input.cpm}/$${model.features.output.cpm}`);
});
```

**Available Models (2026):**
- **OpenAI (11)**: GPT-5.2 series (instant, thinking, pro, codex), GPT-5 family (5, 5.1, mini, nano), GPT-4.1 series, o3-mini
- **Anthropic (5)**: Claude Opus 4.5, Sonnet 4.5, Haiku 4.5, Opus 4.1, Sonnet 4
- **Google (7)**: Gemini 3 (Flash, Pro, Pro-Image), Gemini 2.5 (Pro, Flash, Flash-Lite, Flash-Image)

All models include: pricing (input/output/cached), context windows, feature flags (reasoning, vision, tools, streaming, etc.).

---

## Usage Guide

### Simple Text Generation

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
  temperature: 0.7,
});

const response = await agent.run('Explain quantum computing in one sentence.');
console.log(response.output_text);
```

### Agents with Tools

```typescript
import { Connector, Agent, Vendor, ToolFunction } from '@oneringai/agents';

// Define a tool
const weatherTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
        },
        required: ['location'],
      },
    },
  },
  execute: async (args: { location: string }) => {
    return { temperature: 72, conditions: 'sunny', location: args.location };
  },
};

// Create connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Create agent with tools
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool],
  instructions: 'You are a helpful weather assistant.',
});

const result = await agent.run('What is the weather in Paris?');
console.log(result.output_text);
```

### Vision / Image Analysis

```typescript
import { Connector, Agent, Vendor, createMessageWithImages } from '@oneringai/agents';

Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4o',
});

const input = createMessageWithImages(
  'What do you see in this image?',
  ['https://example.com/photo.jpg']
);

const response = await agent.run(input);
console.log(response.output_text);
```

### Streaming

```typescript
import { Connector, Agent, Vendor, isOutputTextDelta, StreamHelpers } from '@oneringai/agents';

Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
});

// Option 1: Manual iteration
for await (const event of agent.stream('Write a haiku about AI.')) {
  if (isOutputTextDelta(event)) {
    process.stdout.write(event.delta);
  }
}

// Option 2: Use StreamHelpers
for await (const text of StreamHelpers.textOnly(agent.stream('Hello'))) {
  process.stdout.write(text);
}

// Option 3: Accumulate complete text
const text = await StreamHelpers.accumulateText(agent.stream('Hello'));
```

### Multi-Provider Comparison

```typescript
import { Connector, Agent, Vendor } from '@oneringai/agents';

// Create connectors for each provider
const providers = [
  { name: 'openai', vendor: Vendor.OpenAI, model: 'gpt-4o', key: process.env.OPENAI_API_KEY! },
  { name: 'anthropic', vendor: Vendor.Anthropic, model: 'claude-sonnet-4-5-20250929', key: process.env.ANTHROPIC_API_KEY! },
  { name: 'google', vendor: Vendor.Google, model: 'gemini-2.0-flash', key: process.env.GOOGLE_API_KEY! },
];

for (const p of providers) {
  if (!p.key) continue;

  Connector.create({
    name: p.name,
    vendor: p.vendor,
    auth: { type: 'api_key', apiKey: p.key },
  });

  const agent = Agent.create({ connector: p.name, model: p.model });
  const response = await agent.run('What is 2 + 2?');
  console.log(`${p.name}: ${response.output_text}`);
}
```

### Multi-Turn Conversations

```typescript
import { Connector, Agent, Vendor, InputItem, MessageRole, ContentType } from '@oneringai/agents';

Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  instructions: 'You are a knowledgeable tour guide.',
});

const history: InputItem[] = [];

// Turn 1
history.push({
  type: 'message',
  role: MessageRole.USER,
  content: [{ type: ContentType.INPUT_TEXT, text: 'Tell me about the Eiffel Tower' }],
});

const response1 = await agent.run(history);
history.push(...response1.output.filter((item): item is InputItem =>
  item.type === 'message' || item.type === 'compaction'
));

// Turn 2 (follow-up)
history.push({
  type: 'message',
  role: MessageRole.USER,
  content: [{ type: ContentType.INPUT_TEXT, text: 'When was it built?' }],
});

const response2 = await agent.run(history);
console.log(response2.output_text);
```

---

## Vendor Configuration

### OpenAI

```typescript
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
  options: {
    organization: 'org-...', // Optional
    project: 'proj-...',     // Optional
  },
});
// Models: gpt-4o, gpt-4o-mini, gpt-4-turbo, o1-preview
```

### Anthropic (Claude)

```typescript
Connector.create({
  name: 'anthropic',
  vendor: Vendor.Anthropic,
  auth: { type: 'api_key', apiKey: process.env.ANTHROPIC_API_KEY! },
});
// Models: claude-sonnet-4-5-20250929, claude-3-5-sonnet, claude-3-opus
```

### Google (Gemini)

```typescript
Connector.create({
  name: 'google',
  vendor: Vendor.Google,
  auth: { type: 'api_key', apiKey: process.env.GOOGLE_API_KEY! },
});
// Models: gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash
```

### Google Vertex AI

```typescript
Connector.create({
  name: 'vertex',
  vendor: Vendor.GoogleVertex,
  auth: { type: 'api_key', apiKey: '' }, // Uses ADC
  options: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT!,
    location: 'us-central1',
  },
});
```

### Groq (Fast Llama)

```typescript
Connector.create({
  name: 'groq',
  vendor: Vendor.Groq,
  auth: { type: 'api_key', apiKey: process.env.GROQ_API_KEY! },
});
// Models: llama-3.1-70b-versatile, mixtral-8x7b-32768
```

### Together AI

```typescript
Connector.create({
  name: 'together',
  vendor: Vendor.Together,
  auth: { type: 'api_key', apiKey: process.env.TOGETHER_API_KEY! },
});
// Models: meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo
```

### DeepSeek

```typescript
Connector.create({
  name: 'deepseek',
  vendor: Vendor.DeepSeek,
  auth: { type: 'api_key', apiKey: process.env.DEEPSEEK_API_KEY! },
});
// Models: deepseek-chat, deepseek-reasoner
```

### Ollama (Local)

```typescript
Connector.create({
  name: 'ollama',
  vendor: Vendor.Ollama,
  auth: { type: 'api_key', apiKey: '' }, // No key needed
  baseURL: 'http://localhost:11434/v1',
});
// Models: llama2, codellama, mistral
```

### Custom OpenAI-Compatible

```typescript
Connector.create({
  name: 'custom',
  vendor: Vendor.Custom,
  auth: { type: 'api_key', apiKey: 'your-key' },
  baseURL: 'https://api.custom-provider.com/v1',
});
```

---

## Hooks & Events

Control agent execution with hooks and events:

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],
});

// Events (async notifications)
agent.on('tool:start', ({ toolCall }) => {
  console.log(`Tool starting: ${toolCall.function.name}`);
});

agent.on('tool:complete', ({ result }) => {
  console.log(`Tool completed in ${result.executionTime}ms`);
});

// Run with hooks
const response = await agent.run('Do something');

// Get metrics
const metrics = agent.getMetrics();
console.log('Total tokens:', metrics.totalTokens);
```

See [HOOKS.md](./HOOKS.md) for full documentation.

---

## OAuth for External APIs

Use OAuth to authenticate with external APIs like GitHub, Microsoft, Google:

```typescript
import { OAuthManager, FileStorage, generateEncryptionKey } from '@oneringai/agents';

const oauth = new OAuthManager({
  flow: 'authorization_code',
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  redirectUri: 'http://localhost:3000/callback',
  scope: 'user:email repo',
  storage: new FileStorage({
    directory: './tokens',
    encryptionKey: generateEncryptionKey(),
  }),
});

// Start OAuth flow
const authUrl = await oauth.startAuthFlow('user123');
console.log('Visit:', authUrl);

// After callback, get token
const token = await oauth.getToken('user123');
```

See [OAUTH.md](./OAUTH.md) for full documentation.

---

## Examples

```bash
# Interactive chat with vision
npm run example:chat

# Agent with tools
npm run example:agent

# Simple text generation
npm run example:text

# Streaming
npm run example:streaming

# Multi-provider comparison
npm run example:providers

# Multi-turn conversation
npm run example:conversation

# Hooks & events
npm run example:hooks

# OAuth demo
npm run example:oauth
```

---

## API Reference

### Connector

```typescript
// Create a connector
Connector.create({
  name: string,              // Unique name
  vendor: Vendor,            // Vendor enum value
  auth: ConnectorAuth,       // Authentication config
  baseURL?: string,          // Custom API URL
  options?: object,          // Vendor-specific options
});

// Get an existing connector
const connector = Connector.get('openai');

// Check if connector exists
if (Connector.has('openai')) { ... }

// List all connector names
const names = Connector.list();
```

### Agent

```typescript
// Create an agent
const agent = Agent.create({
  connector: string | Connector, // Connector name or instance
  model: string,                 // Model name
  instructions?: string,         // System instructions
  tools?: ToolFunction[],        // Tools to use
  temperature?: number,          // 0-1
  maxIterations?: number,        // Max tool call iterations
  maxOutputTokens?: number,      // Max output tokens
});

// Run agent
const response = await agent.run(input: string | InputItem[]);

// Stream response
for await (const event of agent.stream(input)) { ... }

// Configuration (runtime changes)
agent.setModel('gpt-4-turbo');       // Change model
agent.setTemperature(0.9);           // Change temperature
agent.getTemperature();              // Get current temperature

// Tool management
agent.addTool(tool);                 // Add a tool
agent.removeTool('tool_name');       // Remove a tool
agent.setTools([tool1, tool2]);      // Replace all tools
agent.listTools();                   // List tool names

// Events
agent.on('tool:start', handler);
agent.on('tool:complete', handler);

// Metrics & introspection
const metrics = agent.getMetrics();
agent.isRunning();                   // Check if running
agent.isPaused();                    // Check if paused

// Cleanup
agent.destroy();                     // Destroy agent
```

### Vendor Enum

```typescript
import { Vendor } from '@oneringai/agents';

Vendor.OpenAI       // 'openai'
Vendor.Anthropic    // 'anthropic'
Vendor.Google       // 'google'
Vendor.GoogleVertex // 'google-vertex'
Vendor.Groq         // 'groq'
Vendor.Together     // 'together'
Vendor.Grok         // 'grok'
Vendor.DeepSeek     // 'deepseek'
Vendor.Mistral      // 'mistral'
Vendor.Perplexity   // 'perplexity'
Vendor.Ollama       // 'ollama'
Vendor.Custom       // 'custom'
```

### Model Registry

```typescript
import { MODEL_REGISTRY, LLM_MODELS, getModelInfo, calculateCost, getModelsByVendor, getActiveModels } from '@oneringai/agents';

// Model constants (organized by vendor)
LLM_MODELS[Vendor.OpenAI].GPT_5_2_THINKING      // 'gpt-5.2-thinking'
LLM_MODELS[Vendor.Anthropic].CLAUDE_OPUS_4_5    // 'claude-opus-4-5-20251101'
LLM_MODELS[Vendor.Google].GEMINI_3_FLASH_PREVIEW // 'gemini-3-flash-preview'

// Get model information
const model = getModelInfo('gpt-5.2-thinking');
// Returns: ILLMDescription with pricing, features, context window, etc.

// Calculate costs
const cost = calculateCost(
  'gpt-5.2-thinking',           // model name
  1_000_000,                    // input tokens
  1_000_000,                    // output tokens
  { useCachedInput: true }      // optional: use cached pricing
);
// Returns: number (cost in dollars) or null if model not found

// Filter models by vendor
const openaiModels = getModelsByVendor(Vendor.OpenAI);
// Returns: ILLMDescription[]

// Get all active models
const activeModels = getActiveModels();
// Returns: ILLMDescription[] (currently 23 models)

// Access full registry
const allModels = MODEL_REGISTRY;
// Returns: Record<string, ILLMDescription>
```

**ILLMDescription Interface:**
```typescript
interface ILLMDescription {
  name: string;
  provider: string;
  description?: string;
  isActive: boolean;
  releaseDate?: string;
  knowledgeCutoff?: string;
  features: {
    reasoning?: boolean;
    streaming: boolean;
    structuredOutput?: boolean;
    functionCalling?: boolean;
    vision?: boolean;
    audio?: boolean;
    video?: boolean;
    extendedThinking?: boolean;  // Claude
    batchAPI?: boolean;
    promptCaching?: boolean;
    input: {
      tokens: number;             // Max context window
      text: boolean;
      image?: boolean;
      audio?: boolean;
      video?: boolean;
      cpm: number;                // Cost per million tokens
      cpmCached?: number;         // Cached input cost
    };
    output: {
      tokens: number;             // Max output tokens
      text: boolean;
      image?: boolean;
      audio?: boolean;
      cpm: number;                // Cost per million tokens
    };
  };
}
```

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Type check
npm run typecheck

# Run tests
npm test
```

---

## Troubleshooting

### "Connector not found"
Make sure you created the connector with `Connector.create()` before using it.

### "Invalid API key"
Check your `.env` file and ensure the key is correct for that vendor.

### "Model not found"
Each vendor has different model names. Check vendor documentation.

### Vision not working
Use a vision-capable model: `gpt-4o`, `claude-3-5-sonnet`, `gemini-1.5-pro`.

---

## Documentation

- **[HOOKS.md](./HOOKS.md)** - Hooks & events system
- **[OAUTH.md](./OAUTH.md)** - OAuth 2.0 integration
- **[PROVIDERS.md](./PROVIDERS.md)** - Provider details
- **[EXTENSIBILITY.md](./EXTENSIBILITY.md)** - Custom implementations
- **[CLAUDE.md](./CLAUDE.md)** - Architecture guide for AI assistants

---

## License

MIT License - See [LICENSE](./LICENSE) file.

---

**Version**: 0.2.0
**Last Updated**: 2026-01-15
