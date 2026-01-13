# @oneringai/agents

> **A unified AI agent library with multi-provider support for text generation, image analysis, and agentic workflows.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## Features

- 🎯 **Unified API** - One interface for 6+ AI providers
- 🤖 **Agentic Workflows** - Built-in tool calling and multi-turn conversations
- 🖼️ **Vision Support** - Analyze images with AI across all providers
- 📸 **Clipboard Paste** - Ctrl+V screenshots directly (just like Claude Code!)
- 🔧 **Extensible** - Easy to add new providers and capabilities
- 📦 **Type-Safe** - Full TypeScript support
- 🏗️ **Clean Architecture** - Domain-driven design

## Supported Providers

| Provider | Text | Vision | Tools | JSON Schema | Context |
|----------|------|--------|-------|-------------|---------|
| **OpenAI** | ✅ | ✅ | ✅ | ✅ Native | 128K |
| **Anthropic (Claude)** | ✅ | ✅ | ✅ | ⚠️ Prompt | 200K |
| **Google (Gemini)** | ✅ | ✅ | ✅ | ⚠️ Prompt | 1M |
| **Google Vertex AI** | ✅ | ✅ | ✅ | ⚠️ Prompt | 1M |
| **Grok (xAI)** | ✅ | ✅ | ✅ | ❌ | 128K |
| **Groq** | ✅ | ❌ | ✅ | ❌ | 128K |
| **Together AI** | ✅ | ⚠️ Some | ✅ | ❌ | 128K |
| **Custom** | ✅ | Varies | ✅ | Varies | Varies |

> **Note**: Google Vertex AI provides enterprise features (SLA, IAM, tuning, caching) not available in the regular Gemini API.

---

## Quick Start

### 1. Installation

```bash
npm install @oneringai/agents

# Or install from GitHub (if not published to npm yet)
npm install github:your-username/oneringai

# Or for local development
npm link  # in oneringai directory
npm link @oneringai/agents  # in your project
```

### 2. Setup

Create a `.env` file:

```bash
# Minimum (for OpenAI)
OPENAI_API_KEY=sk-your-key-here

# Optional (add as needed)
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
GROQ_API_KEY=gsk_...
TOGETHER_API_KEY=...
```

### 3. Basic Usage

```typescript
import { OneRingAI } from '@oneringai/agents';

const client = new OneRingAI({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY }
  }
});

// Simple text generation
const response = await client.text.generate('What is AI?', {
  provider: 'openai',
  model: 'gpt-4'
});

console.log(response);
```

---

## Usage Guide

### Text Generation

```typescript
import { OneRingAI } from '@oneringai/agents';

const client = new OneRingAI({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY }
  }
});

// Simple text
const text = await client.text.generate('Explain quantum computing', {
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7,
  max_output_tokens: 200
});

// Structured JSON
const recipe = await client.text.generateJSON(
  'Give me a pasta recipe',
  {
    provider: 'openai',
    model: 'gpt-4',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        ingredients: { type: 'array', items: { type: 'string' } },
        steps: { type: 'array', items: { type: 'string' } }
      }
    }
  }
);
```

### Agents with Tools

```typescript
import { OneRingAI, ToolFunction } from '@oneringai/agents';

const weatherTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' }
        },
        required: ['location']
      }
    },
    blocking: true  // Wait for result (default)
  },
  execute: async (args: { location: string }) => {
    // Your implementation
    return { temperature: 72, conditions: 'sunny' };
  }
};

const agent = await client.agents.create({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  tools: [weatherTool],
  instructions: 'You are a helpful assistant.'
});

const result = await agent.run('What is the weather in Paris?');
console.log(result.output_text);
```

### Vision / Image Analysis

```typescript
import { OneRingAI, createMessageWithImages } from '@oneringai/agents';

const client = new OneRingAI({
  providers: {
    google: { apiKey: process.env.GOOGLE_API_KEY }
  }
});

// Analyze an image
const input = createMessageWithImages(
  'What do you see in this image?',
  ['https://example.com/photo.jpg']
);

const response = await client.text.generateRaw([input], {
  provider: 'google',
  model: 'gemini-1.5-pro-latest'
});

console.log(response.output_text);
```

### Multi-Provider Setup

```typescript
const client = new OneRingAI({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY },
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
    google: { apiKey: process.env.GOOGLE_API_KEY },
    groq: {
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1'
    }
  }
});

// Same code, different providers!
const providers = ['openai', 'anthropic', 'google', 'groq'];

for (const provider of providers) {
  const response = await client.text.generate('What is AI?', {
    provider,
    model: getModelFor(provider)
  });
  console.log(`${provider}: ${response}`);
}
```

---

## Interactive Chat with Vision

### Try It Now!

```bash
npm run example:chat
```

### Features

- 💬 **Real-time chat** with any AI provider
- 📸 **Screenshot paste** - Press Ctrl+V (Cmd+V on Mac) to paste images!
- 🖼️ **Vision support** - AI can see and analyze your images
- 📋 **Multiple image methods** - Clipboard, URLs, file paths
- 💾 **Full conversation history** - Context preserved across turns
- 📊 **Token tracking** - See usage after each message

### Screenshot Workflow

1. **Take a screenshot**: Cmd+Ctrl+Shift+4 (Mac) or Win+Shift+S (Windows)
2. **Press Cmd+V** in the chat (or Ctrl+V)
3. **See**: `📎 [image #1] Pasted from clipboard (128KB PNG)`
4. **Type your question**: "What do you see in this screenshot?"
5. **Get AI analysis** with vision!

### Setup (Mac - Optional)

For best experience on Mac:
```bash
brew install pngpaste
```

Without it, works with AppleScript (slightly slower).

### Commands

| Command | Description |
|---------|-------------|
| **Cmd+V / Ctrl+V** | Paste screenshot from clipboard |
| `/paste` | Paste image URL from clipboard |
| `[img:URL]` | Attach image inline |
| `/images` | Show pending images |
| `/history` | View conversation |
| `/clear` | Clear history |
| `/exit` | Exit chat |
| `/help` | Show help |

---

## Provider Configuration

### OpenAI

```typescript
const client = new OneRingAI({
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      organization: 'org-...', // Optional
    }
  }
});

// Models: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
```

Get API key: https://platform.openai.com/api-keys

### Anthropic (Claude)

```typescript
const client = new OneRingAI({
  providers: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
    }
  }
});

// Models: claude-sonnet-4-20250514, claude-3-5-sonnet-20240620, claude-3-opus, claude-3-haiku
```

Get API key: https://console.anthropic.com/

### Google (Gemini)

```typescript
const client = new OneRingAI({
  providers: {
    google: {
      apiKey: process.env.GOOGLE_API_KEY,
    }
  }
});

// Models: gemini-2.0-flash-exp, gemini-1.5-pro-latest, gemini-1.5-flash-latest
```

Get API key: https://makersuite.google.com/app/apikey

### Google Vertex AI (Enterprise)

```typescript
const client = new OneRingAI({
  providers: {
    'vertex-ai': {
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION, // e.g., 'us-central1'
      // credentials: optional service account JSON
    }
  }
});

// Models: gemini-3-flash-preview, gemini-3-pro-preview, gemini-2.5-flash, gemini-2.5-pro
```

**Setup Required**:
1. Create GCP project at https://console.cloud.google.com
2. Enable Vertex AI API
3. Set up authentication:
   ```bash
   gcloud auth application-default login
   ```
   OR set service account:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   ```
4. Set environment variables:
   ```bash
   GOOGLE_CLOUD_PROJECT=your-project-id
   GOOGLE_CLOUD_LOCATION=us-central1
   ```

**Enterprise Features**:
- SLA guarantees
- IAM controls & audit logging
- Model tuning & customization
- Context caching
- RAG Engine
- Grounding with Google Search

### Groq (Fast Llama)

```typescript
const client = new OneRingAI({
  providers: {
    groq: {
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1' // Auto-configured
    }
  }
});

// Models: llama-3.1-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768
```

Get API key: https://console.groq.com/

### Together AI (Llama & More)

```typescript
const client = new OneRingAI({
  providers: {
    'together-ai': {
      apiKey: process.env.TOGETHER_API_KEY,
      baseURL: 'https://api.together.xyz/v1' // Auto-configured
    }
  }
});

// Models: meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo, Llama-3.2-90B-Vision-Instruct
```

Get API key: https://api.together.xyz/settings/api-keys

### Custom OpenAI-Compatible

```typescript
const client = new OneRingAI({
  providers: {
    'my-provider': {
      apiKey: 'your-key',
      baseURL: 'https://api.custom-provider.com/v1'
    }
  }
});

// Works with: Perplexity, Fireworks, OpenRouter, local models, etc.
```

---

## Examples

### Run the Examples

```bash
# Interactive chat with vision support
npm run example:chat

# Agent with tool calling
npm run example:agent

# Simple text generation
npm run example:text

# Vision/image analysis
npm run example:vision

# Multi-provider comparison
npm run example:providers

# Multi-turn conversation
npm run example:conversation

# JSON manipulation tool
npm run example:json-tool

# Hooks & events (NEW!)
npm run example:hooks
```

### Example 1: Simple Agent

```typescript
import { OneRingAI, ToolFunction } from '@oneringai/agents';

const searchTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' }
        },
        required: ['query']
      }
    }
  },
  execute: async (args: { query: string }) => {
    // Your implementation
    return { results: ['...'] };
  }
};

const agent = await client.agents.create({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  tools: [searchTool]
});

const result = await agent.run('Search for the latest AI news');
console.log(result.output_text);
```

### Example 2: Vision with MessageBuilder

```typescript
import { MessageBuilder } from '@oneringai/agents';

const builder = new MessageBuilder();

// Add message with images
builder.addUserMessageWithImages(
  'Compare these two images',
  ['https://example.com/img1.jpg', 'https://example.com/img2.jpg']
);

const response = await client.text.generateRaw(builder.build(), {
  provider: 'google',
  model: 'gemini-1.5-pro-latest'
});
```

### Example 3: Multi-Provider Comparison

```typescript
const question = 'What is the capital of France?';

// Ask all providers the same question
const providers = ['openai', 'anthropic', 'google', 'groq'];

for (const provider of providers) {
  const response = await client.text.generate(question, {
    provider,
    model: getModelFor(provider)
  });
  console.log(`${provider}: ${response}`);
}
```

---

## API Reference

### OneRingAI Client

```typescript
const client = new OneRingAI({
  providers: {
    openai?: { apiKey: string, organization?: string },
    anthropic?: { apiKey: string },
    google?: { apiKey: string },
    groq?: { apiKey: string, baseURL?: string },
    'together-ai'?: { apiKey: string, baseURL?: string },
    [key: string]: ProviderConfig // Custom providers
  },
  defaultProvider?: string,
  logLevel?: 'debug' | 'info' | 'warn' | 'error'
});
```

### Capabilities

#### `client.agents` - Agentic Text Generation

```typescript
// Agent.create() is async and returns Promise<Agent>
const agent = await client.agents.create({
  provider: string,
  model: string,
  instructions?: string,
  tools?: ToolFunction[],
  temperature?: number,
  maxIterations?: number
});

const response = await agent.run(input: string | InputItem[]);
```

#### `client.text` - Simple Text Generation

```typescript
// Text generation
const text = await client.text.generate(input, {
  provider: string,
  model: string,
  instructions?: string,
  temperature?: number,
  max_output_tokens?: number
});

// JSON generation
const json = await client.text.generateJSON(input, {
  provider: string,
  model: string,
  schema: JSONSchema
});

// Raw response (full LLMResponse object)
const response = await client.text.generateRaw(input, options);
```

#### `client.images` - Image Generation (Future)

```typescript
const image = await client.images.generate({
  provider: string,
  model: string,
  prompt: string
});
```

### Utilities

```typescript
// Message building
import { MessageBuilder, createMessageWithImages } from '@oneringai/agents';

const builder = new MessageBuilder();
builder.addUserMessage('Hello');
builder.addUserMessageWithImages('Analyze these', ['img1.jpg', 'img2.jpg']);
builder.addAssistantMessage('Here is my analysis');

// Or use helper
const input = createMessageWithImages('Describe this', ['image.jpg']);

// Clipboard
import { readClipboardImage } from '@oneringai/agents';
const result = await readClipboardImage();
if (result.success) {
  console.log(result.dataUri); // base64 data URI
}
```

---

## Vision & Images

### Image Input Methods

#### 1. Ctrl+V / Cmd+V (Interactive Chat)

Take a screenshot and paste it directly:

```bash
npm run example:chat

# In the chat:
# 1. Press Cmd+Ctrl+Shift+4 (Mac) or Win+Shift+S (Windows)
# 2. Press Cmd+V in the chat
# 3. Type your question
```

#### 2. Image URLs

```typescript
import { createMessageWithImages } from '@oneringai/agents';

const input = createMessageWithImages(
  'What is in this image?',
  ['https://example.com/photo.jpg']
);

const response = await client.text.generateRaw([input], {
  provider: 'openai',
  model: 'gpt-4o'
});
```

#### 3. Local Files

```typescript
// Files are auto-converted to base64
const input = createMessageWithImages(
  'Analyze this',
  ['./photos/vacation.jpg']
);
```

#### 4. MessageBuilder

```typescript
import { MessageBuilder } from '@oneringai/agents';

const builder = new MessageBuilder();
builder.addUserMessageWithImages(
  'Compare these screenshots',
  ['screenshot1.png', 'screenshot2.png']
);

const messages = builder.build();
```

### Vision-Capable Models

| Provider | Models |
|----------|--------|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo |
| Anthropic | claude-3-5-sonnet, claude-3-opus, claude-3-sonnet, claude-3-haiku |
| Google | gemini-1.5-pro-latest, gemini-1.5-flash-latest, gemini-2.0-flash |
| Grok | grok-2-vision |
| Together AI | meta-llama/Llama-3.2-90B-Vision-Instruct |

### Image Formats

- ✅ URLs: `https://example.com/image.jpg`
- ✅ Data URIs: `data:image/png;base64,...`
- ✅ Local files: `./path/to/image.jpg` (auto-converted)
- ✅ Formats: JPG, PNG, GIF, WebP

---

## Provider Comparison

### Speed

| Provider | Typical Latency | Best For |
|----------|----------------|----------|
| **Groq** | ⚡⚡⚡⚡⚡ 100-300ms | Speed-critical apps |
| **Together AI** | ⚡⚡⚡⚡ 500-1000ms | Fast + cost-effective |
| **OpenAI** | ⚡⚡⚡ 1-3s | General purpose |
| **Anthropic** | ⚡⚡⚡ 1-3s | Coding, analysis |
| **Google** | ⚡⚡ 2-5s | Long context |

### Cost (Approximate per 1M tokens)

| Provider | Model | Input | Output |
|----------|-------|-------|--------|
| OpenAI | gpt-4o-mini | $0.15 | $0.60 |
| Google | gemini-1.5-flash-latest | $0.075 | $0.30 |
| Anthropic | claude-3-haiku | $0.25 | $1.25 |
| Groq | llama-3.1-70b | Free tier | Free tier |

### Best Use Cases

- **Coding**: Anthropic Claude 3.5 Sonnet
- **Speed**: Groq Llama 3.1
- **Cost**: Google Gemini Flash
- **Long context**: Google Gemini (1M) or Anthropic Claude (200K)
- **Vision**: OpenAI GPT-4o or Anthropic Claude 3.5
- **General**: OpenAI GPT-4o (best balance)

---

## Advanced Features

### Hooks & Events (Enterprise Control)

Control agent execution with hooks (modify behavior) and events (monitoring).

#### Events (Async Notifications)

Listen to execution events for logging, UI updates, monitoring:

```typescript
const agent = await client.agents.create({ ... });

// Listen to tool execution
agent.on('tool:start', ({ toolCall }) => {
  console.log(`Tool starting: ${toolCall.function.name}`);
  websocket.send({ type: 'tool-progress', status: 'executing' });
});

agent.on('tool:complete', ({ result }) => {
  console.log(`Tool completed in ${result.executionTime}ms`);
  websocket.send({ type: 'tool-progress', status: 'completed' });
});

// Listen to LLM calls
agent.on('llm:request', ({ options }) => {
  console.log(`Calling ${options.model}...`);
});

// Listen to errors
agent.on('tool:error', ({ error }) => {
  logger.error('Tool failed:', error);
});

const response = await agent.run('Do something');
```

**Available Events**:
- `execution:start`, `execution:complete`, `execution:error`
- `execution:paused`, `execution:resumed`, `execution:cancelled`
- `iteration:start`, `iteration:complete`
- `llm:request`, `llm:response`, `llm:error`
- `tool:detected`, `tool:start`, `tool:complete`, `tool:error`, `tool:timeout`
- `hook:error`

#### Hooks (Sync/Async Control)

Modify execution flow with hooks - approve tools, cache results, add retry logic:

```typescript
const agent = await client.agents.create({
  provider: 'openai',
  model: 'gpt-4',
  tools: [dangerousTool],

  hooks: {
    // Approve tools before execution (human-in-the-loop)
    'approve:tool': async ({ toolCall }) => {
      if (toolCall.function.name === 'delete_database') {
        const approved = await askUser('Execute delete_database?');
        return { approved };
      }
      return { approved: true };
    },

    // Cache tool results
    'before:tool': async ({ toolCall }) => {
      const cached = await cache.get(toolCall.id);
      if (cached) {
        return { skip: true, mockResult: cached };
      }
      return {};
    },

    'after:tool': async ({ toolCall, result }) => {
      await cache.set(toolCall.id, result);
      return {};
    }
  }
});
```

**Available Hooks**:
- `before:execution`, `after:execution` - Lifecycle
- `before:llm`, `after:llm` - Modify LLM calls
- `before:tool`, `after:tool` - Intercept tool execution
- `approve:tool` - Approve/reject tools
- `pause:check` - Custom pause logic

#### Pause/Resume/Cancel

Control execution flow:

```typescript
const agent = await client.agents.create({ ... });

// Start execution (async)
const responsePromise = agent.run('Long task');

// Pause from another thread/callback
setTimeout(() => {
  agent.pause('User requested pause');
}, 1000);

// Resume later
setTimeout(() => {
  agent.resume();
}, 5000);

// Or cancel
agent.cancel('User cancelled');

const response = await responsePromise;
```

#### Metrics & Introspection

Get detailed execution metrics:

```typescript
const agent = await client.agents.create({ ... });
const response = await agent.run('Process data');

// Get metrics
const metrics = agent.getMetrics();
console.log('Tool success rate:', metrics.toolSuccessCount / metrics.toolCallCount);
console.log('Total duration:', metrics.totalDuration);
console.log('Tokens used:', metrics.totalTokens);

// Get audit trail
const audit = agent.getAuditTrail();
console.log('Last 10 actions:', audit.slice(-10));

// Check state
console.log('Is running:', agent.isRunning());
console.log('Is paused:', agent.isPaused());

// Cleanup
agent.destroy();
```

#### Enterprise Configuration

```typescript
const agent = await client.agents.create({
  provider: 'openai',
  model: 'gpt-4',
  tools: [myTool],

  // Resource limits (prevent runaway execution)
  limits: {
    maxExecutionTime: 300000,  // 5 minutes
    maxToolCalls: 100,
    maxContextSize: 10485760,  // 10MB
  },

  // History mode (memory management)
  historyMode: 'summary',  // 'none' | 'summary' | 'full'

  // Error handling
  errorHandling: {
    hookFailureMode: 'warn',      // Continue on hook errors
    toolFailureMode: 'fail',      // Stop on tool errors
    maxConsecutiveErrors: 3
  },

  // Hooks for control
  hooks: { ... }
});
```

**Full Documentation**: See [HOOKS.md](./HOOKS.md) for:
- Complete event reference
- All hook examples
- Pause/resume patterns
- Metrics and audit trails
- Production best practices

**Try it**: `npm run example:hooks`

### OAuth 2.0 Authentication & API Registry

Authenticate with OAuth-protected APIs AND static API key services using the unified OAuth plugin.

**4 Flows Supported**:
- Authorization Code (with PKCE) - User authentication ⭐ **Multi-user ready!**
- Client Credentials - Service-to-service
- JWT Bearer - Service accounts
- **Static Token** - API keys (OpenAI, Anthropic, any API)

```typescript
import { OAuthManager, OAuthFileStorage } from '@oneringai/agents';

// Client Credentials (simplest)
const oauth = new OAuthManager({
  flow: 'client_credentials',
  clientId: process.env.CLIENT_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
  tokenUrl: 'https://api.example.com/oauth/token',

  // Optional: encrypted file storage
  storage: new OAuthFileStorage({
    directory: './tokens',
    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY!
  })
});

const token = await oauth.getToken();  // Automatically cached & refreshed
```

**Security**:
- ✅ AES-256-GCM encryption (all tokens encrypted at rest)
- ✅ PBKDF2 key derivation (100,000 iterations)
- ✅ File permissions: 0o600 (owner only)
- ✅ Clean Architecture (pluggable storage)

**Storage Backends**:
- MemoryStorage (default, encrypted in memory)
- FileStorage (encrypted files)
- Custom (implement `IOAuthTokenStorage`)

**Unified Registry** - Register ALL your APIs in one place:
```typescript
import { oauthRegistry, authenticatedFetch, generateWebAPITool, createExecuteJavaScriptTool } from '@oneringai/agents';

// Register OAuth providers
oauthRegistry.register('microsoft', { flow: 'authorization_code', ... });

// Register static token providers
oauthRegistry.register('openai-api', {
  flow: 'static_token',
  staticToken: process.env.OPENAI_API_KEY!,
  // ...
});

// Use unified fetch for ANY provider
await authenticatedFetch(url, options, 'microsoft');
await authenticatedFetch(url, options, 'openai-api');

// Multi-user support: pass userId for user-specific tokens
await authenticatedFetch(url, options, 'github', 'user123');  // Alice's token
await authenticatedFetch(url, options, 'github', 'user456');  // Bob's token

// Or generate universal API tool
const apiTool = generateWebAPITool();  // Works with all providers!

// Create JavaScript execution tool with current OAuth providers
// IMPORTANT: Use createExecuteJavaScriptTool() AFTER registering providers
// to ensure the tool description includes all available OAuth providers
const jsTool = createExecuteJavaScriptTool(oauthRegistry);
const agent = await client.agents.create({
  provider: 'openai',
  model: 'gpt-4',
  tools: [jsTool]  // Tool will show all registered OAuth providers to the AI
});
```

**Multi-User Support** 🆕:
```typescript
// ONE OAuthManager handles multiple users automatically!
const authUrl1 = await oauth.startAuthFlow('alice_123');  // Alice's auth
const authUrl2 = await oauth.startAuthFlow('bob_456');    // Bob's auth

// Each user gets isolated, encrypted tokens
const aliceToken = await oauth.getToken('alice_123');
const bobToken = await oauth.getToken('bob_456');

// Use in API calls
await authenticatedFetch(url, options, 'github', 'alice_123');  // Alice's token
await authenticatedFetch(url, options, 'github', 'bob_456');    // Bob's token
```

**Full Documentation**: See [OAUTH.md](./OAUTH.md) for:
- Complete API configurations (Microsoft, Google, GitHub, Salesforce, OpenAI, etc.)
- User OAuth vs App Token vs Static Token flows
- **Multi-user OAuth architecture** 🆕
- Production setup guide
- Custom storage examples (MongoDB, Redis)
- Unified registry examples

**Try it**:
- `npm run example:oauth-static` - Static token APIs
- `npm run example:oauth-multi-user` - Multi-user patterns 🆕

---

## Development

### Build the Library

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint
```

### Project Structure

```
src/
├── index.ts                    # Main entry point
├── client/                     # Client infrastructure
│   ├── OneRingAI.ts
│   └── ProviderRegistry.ts
├── domain/                     # Core business logic
│   ├── entities/              # Message, Content, Tool, Response
│   ├── interfaces/            # IProvider, ITextProvider, etc.
│   ├── types/                 # Configuration types
│   └── errors/                # Error classes
├── capabilities/              # Feature modules
│   ├── agents/               # Agentic workflows
│   ├── text/                 # Simple text generation
│   └── images/               # Image generation (future)
├── infrastructure/           # Provider implementations
│   └── providers/
│       ├── openai/          # OpenAI implementation
│       ├── anthropic/       # Anthropic + converter
│       ├── google/          # Google + converter
│       └── generic/         # Generic OpenAI-compatible
└── utils/                   # Utilities
    ├── messageBuilder.ts
    ├── clipboardImage.ts
    └── imageUtils.ts
```

### Architecture

The library follows **Clean Architecture** principles:

- **Domain Layer**: Core entities, interfaces, business rules
- **Application Layer**: Use cases, services (AgentManager, TextManager)
- **Infrastructure Layer**: Provider implementations, external dependencies

### Adding a New Provider

See `CLAUDE.md` for detailed instructions on adding providers with converters.

---

## Troubleshooting

### "Provider not found"
Make sure you configured the provider in the OneRingAI constructor.

### "Invalid API key"
- Check your `.env` file exists
- Ensure the key is correct for that provider
- Check for typos in environment variable names

### "Model not found"
Each provider has different model names. Check provider documentation:
- OpenAI: https://platform.openai.com/docs/models
- Anthropic: https://docs.anthropic.com/en/docs/models-overview
- Google: https://ai.google.dev/models/gemini

### Vision not working
Make sure you're using a vision-capable model:
- OpenAI: `gpt-4o`, `gpt-4-turbo`
- Anthropic: Claude 3+ models
- Google: `gemini-1.5-pro-latest`, `gemini-1.5-flash-latest`

### Tool calling not working
Most modern models support tools. Legacy models (GPT-3.5, Claude 2) may not.

### Clipboard paste not working (Mac)
Install pngpaste for best experience:
```bash
brew install pngpaste
```

---

## Advanced Topics

### Tool System

Define tools that agents can call:

```typescript
interface ToolFunction {
  definition: {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: JSONSchema;
    };
    blocking?: boolean;  // Default: true
    timeout?: number;    // Default: 30000ms
  };
  execute: (args: any) => Promise<any>;
}
```

### Multi-Turn Conversations

```typescript
import { MessageBuilder, MessageRole, ContentType } from '@oneringai/agents';

const builder = new MessageBuilder();

// Turn 1
builder.addUserMessage('What is the Eiffel Tower?');
let response = await client.text.generateRaw(builder.build(), options);
builder.addAssistantMessage(response.output_text);

// Turn 2
builder.addUserMessage('When was it built?');
response = await client.text.generateRaw(builder.build(), options);
```

### Error Handling

```typescript
import { ProviderAuthError, ProviderRateLimitError } from '@oneringai/agents';

try {
  const response = await client.text.generate('Hello', options);
} catch (error) {
  if (error instanceof ProviderAuthError) {
    console.error('Invalid API key');
  } else if (error instanceof ProviderRateLimitError) {
    console.error('Rate limited, retry after:', error.retryAfter);
  }
}
```

### Image Detail Control

```typescript
import { InputItem, MessageRole, ContentType } from '@oneringai/agents';

const input: InputItem[] = [{
  type: 'message',
  role: MessageRole.USER,
  content: [
    { type: ContentType.INPUT_TEXT, text: 'Describe this' },
    {
      type: ContentType.INPUT_IMAGE_URL,
      image_url: {
        url: 'https://example.com/image.jpg',
        detail: 'low'  // 'low' (~85 tokens), 'high' (~170-340), 'auto'
      }
    }
  ]
}];
```

---

## Installation Methods

### From npm (When Published)

```bash
npm install @oneringai/agents
```

### From GitHub

```bash
# Latest from main branch
npm install github:your-username/oneringai

# Specific branch/tag
npm install github:your-username/oneringai#develop
npm install github:your-username/oneringai#v0.1.0
```

### Local Development (npm link)

```bash
# In oneringai directory
npm link

# In your project
npm link @oneringai/agents

# Unlink when done
npm unlink @oneringai/agents
```

### Local File Path

```bash
# Absolute path
npm install /Users/aantich/dev/oneringai

# Relative path
npm install ../oneringai
```

---

## Documentation Files

- **`README.md`** (this file) - Complete guide
- **`HOOKS.md`** - Comprehensive hooks & events guide
- **`PROVIDERS.md`** - Detailed provider comparison and configuration
- **`CLAUDE.md`** - For AI assistants (architecture, development guide)
- **`.env.example`** - Environment variable template

---

## Contributing

This is currently a private project. For questions or contributions, contact the maintainer.

## License

MIT License - See [LICENSE](./LICENSE) file for details.

## Support

For detailed documentation:
- **Provider Guide**: See `PROVIDERS.md`
- **Architecture**: See `CLAUDE.md`
- **Examples**: Run `npm run example:*` commands

---

## Quick Reference

### Basic Commands

```bash
# Build
npm run build

# Run examples
npm run example:chat        # Interactive chat
npm run example:agent       # Agent with tools
npm run example:vision      # Vision examples
npm run example:providers   # Compare all providers

# Development
npm run dev                 # Watch mode
npm run typecheck          # Type check
```

### Code Templates

**Simple text:**
```typescript
const text = await client.text.generate('Question?', { provider: 'openai', model: 'gpt-4' });
```

**Agent with tools:**
```typescript
const agent = await client.agents.create({ provider: 'anthropic', model: 'claude-sonnet-4-20250514', tools: [...] });
const result = await agent.run('Do something');
```

**Vision:**
```typescript
const input = createMessageWithImages('Describe this', ['image.jpg']);
const response = await client.text.generateRaw([input], { provider: 'google', model: 'gemini-1.5-pro-latest' });
```

---

**Version**: 0.1.0
**Last Updated**: 2026-01-12
**Supported Providers**: 6+ (OpenAI, Anthropic, Google, Grok, Groq, Together AI, Custom)

**Recent Changes**:
- **BREAKING**: `client.agents.create()` is now async and returns `Promise<Agent>` (add `await`)
- 🆕 **Multi-user OAuth support** - All OAuth methods accept optional `userId` parameter
- 🆕 `createExecuteJavaScriptTool(oauthRegistry)` for dynamic OAuth provider support
- 🆕 `authenticatedFetch(url, options, provider, userId?)` supports multi-user
- Completed Phases 1-6 of improvement plan (memory safety, error handling, concurrency)
