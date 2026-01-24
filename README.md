# @oneringai/agents

> **A unified AI agent library with multi-provider support for text generation, image analysis, and agentic workflows.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## Features

- ✨ **Unified API** - One interface for 10+ AI providers (OpenAI, Anthropic, Google, Groq, DeepSeek, and more)
- 🔑 **Connector-First Architecture** - Single auth system with support for multiple keys per vendor
- 📊 **Model Registry** - Complete metadata for 23+ latest (2026) models with pricing and features
- 🤖 **Task Agents** - Autonomous agents with working memory, context management, and state persistence
- 🎯 **Context Management** - Smart strategies (proactive, aggressive, lazy, rolling-window, adaptive)
- 🛠️ **Agentic Workflows** - Built-in tool calling and multi-turn conversations
- 👁️ **Vision Support** - Analyze images with AI across all providers
- 📋 **Clipboard Integration** - Paste screenshots directly (like Claude Code!)
- 🔐 **OAuth 2.0** - Full OAuth support for external APIs with encrypted token storage
- 🔄 **Streaming** - Real-time responses with event streams
- 📝 **TypeScript** - Full type safety and IntelliSense support

## Quick Start

### Installation

```bash
npm install @oneringai/agents
```

### Basic Usage

```typescript
import { Connector, Agent, Vendor } from '@oneringai/agents';

// 1. Create a connector (authentication)
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// 2. Create an agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
});

// 3. Run
const response = await agent.run('What is the capital of France?');
console.log(response.output_text);
// Output: "The capital of France is Paris."
```

### With Tools

```typescript
import { ToolFunction } from '@oneringai/agents';

const weatherTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' },
        },
        required: ['location'],
      },
    },
  },
  execute: async (args) => {
    return { temp: 72, location: args.location };
  },
};

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool],
});

await agent.run('What is the weather in Paris?');
```

### Vision

```typescript
import { createMessageWithImages } from '@oneringai/agents';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4o',
});

const response = await agent.run(
  createMessageWithImages('What is in this image?', ['./photo.jpg'])
);
```

## Supported Providers

| Provider | Text | Vision | Tools | Context |
|----------|------|--------|-------|---------|
| **OpenAI** | ✅ | ✅ | ✅ | 128K |
| **Anthropic (Claude)** | ✅ | ✅ | ✅ | 200K |
| **Google (Gemini)** | ✅ | ✅ | ✅ | 1M |
| **Google Vertex AI** | ✅ | ✅ | ✅ | 1M |
| **Grok (xAI)** | ✅ | ✅ | ✅ | 128K |
| **Groq** | ✅ | ❌ | ✅ | 128K |
| **Together AI** | ✅ | Some | ✅ | 128K |
| **DeepSeek** | ✅ | ❌ | ✅ | 64K |
| **Mistral** | ✅ | ❌ | ✅ | 32K |
| **Ollama** | ✅ | Varies | ✅ | Varies |
| **Custom** | ✅ | Varies | ✅ | Varies |

## Key Features

### 1. Task Agents

Autonomous agents for complex workflows:

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
    { name: 'fetch_weather', description: 'Get weather for SF' },
    { name: 'send_email', description: 'Email user', dependsOn: ['fetch_weather'] },
  ],
});
```

**Features:**
- 📝 **Working Memory** - Store and retrieve data across tasks
- 🧠 **Context Management** - Automatic handling of context limits
- ⏸️ **State Persistence** - Resume after crashes or long waits
- 🔗 **External Dependencies** - Wait for webhooks, polling, manual input
- 🔄 **Tool Idempotency** - Prevent duplicate side effects

### 2. Context Management

Five strategies for different use cases:

```typescript
import { ContextManager } from '@oneringai/agents';

const contextManager = new ContextManager(provider, {
  strategy: 'adaptive',  // or 'proactive', 'aggressive', 'lazy', 'rolling-window'
}, compactors, estimator);

// Automatically manages context window
// - Tracks token usage
// - Compacts when approaching limits
// - Adapts based on usage patterns
```

### 3. Model Registry

Complete metadata for 23+ models:

```typescript
import { getModelInfo, calculateCost, LLM_MODELS, Vendor } from '@oneringai/agents';

// Get model information
const model = getModelInfo('gpt-5.2-thinking');
console.log(model.features.input.tokens);  // 400000
console.log(model.features.input.cpm);     // 1.75 (cost per million)

// Calculate costs
const cost = calculateCost('gpt-5.2-thinking', 50_000, 2_000);
console.log(`Cost: $${cost}`);  // $0.1155

// With caching
const cachedCost = calculateCost('gpt-5.2-thinking', 50_000, 2_000, {
  useCachedInput: true
});
console.log(`Cached: $${cachedCost}`);  // $0.0293 (90% discount)
```

**Available Models:**
- **OpenAI (11)**: GPT-5.2 series, GPT-5 family, GPT-4.1, o3-mini
- **Anthropic (5)**: Claude 4.5 series, Claude 4.x
- **Google (7)**: Gemini 3, Gemini 2.5

### 4. Streaming

Real-time responses:

```typescript
import { StreamHelpers } from '@oneringai/agents';

for await (const text of StreamHelpers.textOnly(agent.stream('Hello'))) {
  process.stdout.write(text);
}
```

### 5. OAuth for External APIs

```typescript
import { OAuthManager, FileStorage } from '@oneringai/agents';

const oauth = new OAuthManager({
  flow: 'authorization_code',
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  storage: new FileStorage({ directory: './tokens' }),
});

const authUrl = await oauth.startAuthFlow('user123');
```

## Documentation

📖 **[Complete User Guide](./USER_GUIDE.md)** - Comprehensive guide covering all features

### Additional Resources

- **[CLAUDE.md](./CLAUDE.md)** - Architecture guide for AI assistants
- **[MULTIMODAL_ARCHITECTURE.md](./MULTIMODAL_ARCHITECTURE.md)** - Multimodal implementation details
- **[MICROSOFT_GRAPH_SETUP.md](./MICROSOFT_GRAPH_SETUP.md)** - Microsoft Graph OAuth setup
- **[TESTING.md](./TESTING.md)** - Testing guide for contributors

## Examples

```bash
# Basic examples
npm run example:basic              # Simple text generation
npm run example:streaming          # Streaming responses
npm run example:vision             # Image analysis
npm run example:tools              # Tool calling

# Task Agent examples
npm run example:task-agent         # Basic task agent
npm run example:task-agent-demo    # Full demo with memory
npm run example:planning-agent     # AI-driven planning

# Context management
npm run example:context-management # All strategies demo
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Type check
npm run typecheck
```

## Architecture

The library uses **Connector-First Architecture**:

```
User Code → Connector Registry → Agent → Provider → LLM
```

**Benefits:**
- ✅ Single source of truth for authentication
- ✅ Multiple keys per vendor
- ✅ Named connectors for easy reference
- ✅ No API key management in agent code
- ✅ Same pattern for AI providers AND external APIs

## Troubleshooting

### "Connector not found"
Make sure you created the connector with `Connector.create()` before using it.

### "Invalid API key"
Check your `.env` file and ensure the key is correct for that vendor.

### "Model not found"
Each vendor has different model names. Check the [User Guide](./USER_GUIDE.md) for supported models.

### Vision not working
Use a vision-capable model: `gpt-4o`, `claude-opus-4-5-20251101`, `gemini-3-flash-preview`.

## Contributing

Contributions are welcome! Please see our [Contributing Guide](./CONTRIBUTING.md) (coming soon).

## License

MIT License - See [LICENSE](./LICENSE) file.

---

**Version:** 0.2.0
**Last Updated:** 2026-01-24

For detailed documentation on all features, see the **[Complete User Guide](./USER_GUIDE.md)**.
