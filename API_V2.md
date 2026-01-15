# OneRingAI v2 - Public API Reference

## Installation

```bash
npm install @oneringai/agents
```

---

## Quick Start

```typescript
import { Connector, Agent } from '@oneringai/agents';

// 1. Create a connector (authenticated connection)
Connector.create({
  name: 'openai',
  vendor: 'openai',
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! }
});

// 2. Create an agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4'
});

// 3. Run the agent
const response = await agent.run('Hello, world!');
console.log(response.output);
```

---

## Connector API

### `Connector.create(config)`

Creates and registers a new connector.

```typescript
const connector = Connector.create({
  name: 'openai-main',          // Required: unique identifier
  vendor: 'openai',             // Required: vendor type
  auth: { ... },                // Required: authentication config
  baseURL: '...',               // Optional: override default URL
  displayName: 'Main OpenAI',   // Optional: human-readable name
  defaultModel: 'gpt-4',        // Optional: default model
  options: { ... }              // Optional: vendor-specific options
});
```

**Returns:** `Connector` instance

**Throws:** `Error` if name already exists

### `Connector.get(name)`

Retrieves a connector by name.

```typescript
const connector = Connector.get('openai-main');
```

**Returns:** `Connector` instance

**Throws:** `Error` if not found

### `Connector.has(name)`

Checks if a connector exists.

```typescript
if (Connector.has('openai-main')) {
  // ...
}
```

**Returns:** `boolean`

### `Connector.list()`

Lists all registered connector names.

```typescript
const names = Connector.list();  // ['openai-main', 'anthropic', ...]
```

**Returns:** `string[]`

### `Connector.clear()`

Removes all registered connectors. Useful for testing.

```typescript
Connector.clear();
```

### `connector.fetch(path, options?, userId?)`

Makes an authenticated HTTP request.

```typescript
const response = await connector.fetch('/v1/models');
const data = await response.json();
```

**Parameters:**
- `path` - API path (appended to baseURL)
- `options` - Standard `RequestInit` options
- `userId` - Optional user ID for multi-user OAuth

**Returns:** `Promise<Response>`

### `connector.getToken(userId?)`

Gets the current authentication token.

```typescript
const token = await connector.getToken();
```

**Returns:** `Promise<string>`

---

## Agent API

### `Agent.create(config)`

Creates a new agent.

```typescript
const agent = Agent.create({
  connector: 'openai',          // Required: connector name or instance
  model: 'gpt-4',               // Required: model identifier
  name: 'my-agent',             // Optional: agent name
  instructions: '...',          // Optional: system instructions
  tools: [...],                 // Optional: available tools
  maxTokens: 4096,              // Optional: max response tokens
  temperature: 0.7              // Optional: sampling temperature
});
```

**Returns:** `Agent` instance

### `agent.run(input)`

Runs a single conversation turn.

```typescript
// Simple string input
const response = await agent.run('What is 2+2?');

// Structured input
const response = await agent.run([
  { type: 'message', role: 'user', content: [{ type: 'text', text: 'Hello' }] }
]);
```

**Returns:** `Promise<LLMResponse>`

### `agent.stream(input)`

Streams a response.

```typescript
for await (const chunk of agent.stream('Tell me a story')) {
  process.stdout.write(chunk.text);
}
```

**Returns:** `AsyncGenerator<StreamChunk>`

### `agent.setModel(model)`

Changes the model at runtime.

```typescript
agent.setModel('gpt-4-turbo');
```

### `agent.setTemperature(temperature)`

Changes the temperature at runtime.

```typescript
agent.setTemperature(0.9);
```

### `agent.getTemperature()`

Gets the current temperature.

```typescript
const temp = agent.getTemperature();  // 0.7 or undefined
```

**Returns:** `number | undefined`

### `agent.setTools(tools)`

Replaces all tools with a new array.

```typescript
agent.setTools([weatherTool, searchTool]);
```

### `agent.addTool(tool)`

Adds a single tool.

```typescript
agent.addTool(newTool);
```

### `agent.removeTool(name)`

Removes a tool by name.

```typescript
agent.removeTool('get_weather');
```

### `agent.listTools()`

Lists all registered tool names.

```typescript
const tools = agent.listTools();  // ['get_weather', 'search']
```

**Returns:** `string[]`

### `agent.reset()`

Clears conversation history.

```typescript
agent.reset();
```

### `agent.getHistory()`

Gets conversation history.

```typescript
const history = agent.getHistory();
```

**Returns:** `InputItem[]`

### `agent.destroy()`

Destroys the agent, cancels any running operations, and runs cleanup callbacks.

```typescript
agent.destroy();
```

---

## Authentication Types

### API Key

```typescript
Connector.create({
  name: 'openai',
  vendor: 'openai',
  auth: {
    type: 'api_key',
    apiKey: 'sk-...'
  }
});
```

### OAuth 2.0 - Authorization Code

```typescript
Connector.create({
  name: 'github',
  vendor: 'custom',
  baseURL: 'https://api.github.com',
  auth: {
    type: 'oauth',
    flow: 'authorization_code',
    clientId: 'xxx',
    clientSecret: 'xxx',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'user'],
    redirectUri: 'http://localhost:3000/callback'
  }
});

// Start auth flow
const authUrl = await github.startAuth('user-123');
// User visits authUrl, authorizes, gets redirected back
await github.handleCallback(callbackUrl, 'user-123');
```

### OAuth 2.0 - Client Credentials

```typescript
Connector.create({
  name: 'service',
  vendor: 'custom',
  baseURL: 'https://api.example.com',
  auth: {
    type: 'oauth',
    flow: 'client_credentials',
    clientId: 'xxx',
    clientSecret: 'xxx',
    tokenUrl: 'https://auth.example.com/token',
    scopes: ['read', 'write']
  }
});
```

### Service Account (Google)

```typescript
Connector.create({
  name: 'vertex',
  vendor: 'google-vertex',
  auth: {
    type: 'service_account',
    keyFile: './service-account.json',
    projectId: 'my-project'
  }
});
```

---

## Vendor Types

| Vendor | Description | Default Base URL |
|--------|-------------|------------------|
| `openai` | OpenAI API | `https://api.openai.com/v1` |
| `anthropic` | Anthropic Claude | `https://api.anthropic.com` |
| `google` | Google AI (Gemini) | `https://generativelanguage.googleapis.com/v1` |
| `google-vertex` | Google Vertex AI | `https://{region}-aiplatform.googleapis.com/v1` |
| `groq` | Groq | `https://api.groq.com/openai/v1` |
| `together` | Together AI | `https://api.together.xyz/v1` |
| `perplexity` | Perplexity | `https://api.perplexity.ai` |
| `grok` | xAI Grok | `https://api.x.ai/v1` |
| `ollama` | Ollama (local) | `http://localhost:11434/api` |
| `custom` | OpenAI-compatible | (must specify baseURL) |

---

## Tools

### Defining Tools

```typescript
import { ToolFunction } from '@oneringai/agents';

const weatherTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' }
        },
        required: ['location']
      }
    }
  },
  execute: async (args) => {
    // Fetch weather data
    return { temperature: 72, condition: 'sunny' };
  }
};

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool]
});
```

### Using Connectors in Tools

```typescript
const githubSearchTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'search_repos',
      description: 'Search GitHub repositories',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' }
        },
        required: ['query']
      }
    }
  },
  execute: async (args, context) => {
    const github = Connector.get('github');
    const response = await github.fetch(
      `/search/repositories?q=${encodeURIComponent(args.query)}`,
      {},
      context.userId  // Pass through user context
    );
    return response.json();
  }
};
```

---

## Response Types

### LLMResponse

```typescript
interface LLMResponse {
  output: OutputItem[];          // Response content
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string;                 // Model used
  stopReason?: StopReason;       // Why generation stopped
}
```

### OutputItem

```typescript
type OutputItem =
  | { type: 'message'; role: 'assistant'; content: Content[] }
  | { type: 'tool_call'; id: string; name: string; arguments: string }
  | { type: 'reasoning'; content: string };  // For models with reasoning
```

### Content

```typescript
type Content =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; content: string };
```

---

## Environment Variables

The library respects these environment variables:

| Variable | Used By |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI vendor |
| `ANTHROPIC_API_KEY` | Anthropic vendor |
| `GOOGLE_API_KEY` | Google vendor |
| `GROQ_API_KEY` | Groq vendor |
| `TOGETHER_API_KEY` | Together vendor |
| `PERPLEXITY_API_KEY` | Perplexity vendor |
| `XAI_API_KEY` | Grok vendor |

### Helper for Environment Variables

```typescript
// Auto-create connector from environment variable
Connector.fromEnv('openai');
// Equivalent to:
// Connector.create({ name: 'openai', vendor: 'openai', auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY }})

// With custom name
Connector.fromEnv('openai', { name: 'openai-production' });
```

---

## Error Handling

```typescript
import {
  ConnectorNotFoundError,
  AuthenticationError,
  RateLimitError,
  ModelNotFoundError,
  ToolExecutionError
} from '@oneringai/agents';

try {
  const response = await agent.run('Hello');
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof ToolExecutionError) {
    console.error(`Tool failed: ${error.toolName}`);
  }
}
```

---

## Full Example

```typescript
import { Connector, Agent, ToolFunction } from '@oneringai/agents';

// Setup connectors
Connector.create({
  name: 'openai',
  vendor: 'openai',
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! }
});

Connector.create({
  name: 'github',
  vendor: 'custom',
  baseURL: 'https://api.github.com',
  auth: { type: 'api_key', apiKey: process.env.GITHUB_TOKEN! }
});

// Define tools
const searchRepos: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'search_repos',
      description: 'Search GitHub repositories',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' }
        },
        required: ['query']
      }
    }
  },
  execute: async (args) => {
    const github = Connector.get('github');
    const res = await github.fetch(`/search/repositories?q=${args.query}&per_page=5`);
    const data = await res.json();
    return data.items.map((r: any) => ({
      name: r.full_name,
      description: r.description,
      stars: r.stargazers_count
    }));
  }
};

// Create agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  instructions: 'You are a helpful assistant that can search GitHub.',
  tools: [searchRepos]
});

// Run conversation
const response = await agent.run('Find popular TypeScript AI libraries');

// Extract text response
const text = response.output
  .filter(item => item.type === 'message')
  .flatMap(item => item.content)
  .filter(c => c.type === 'text')
  .map(c => c.text)
  .join('');

console.log(text);
```

---

## Exports Summary

```typescript
// Main classes
export { Connector } from './Connector.js';
export { Agent } from './Agent.js';

// Types
export type { ConnectorConfig, AuthConfig, Vendor } from './types.js';
export type { AgentConfig } from './Agent.js';
export type { ToolFunction, ToolCall, ToolResult } from './domain/entities/Tool.js';
export type { LLMResponse, OutputItem, Content } from './domain/entities/Response.js';
export type { InputItem, Message, MessageRole } from './domain/entities/Message.js';

// Enums (as values for runtime use)
export { MessageRole } from './domain/entities/Message.js';
export { ContentType } from './domain/entities/Content.js';

// Errors
export {
  ConnectorNotFoundError,
  AuthenticationError,
  RateLimitError,
  ModelNotFoundError,
  ToolExecutionError
} from './domain/errors/index.js';

// Utilities
export { MessageBuilder } from './utils/MessageBuilder.js';
```
