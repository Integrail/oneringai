# @everworker/oneringai - Complete User Guide

**Version:** 0.1.4
**Last Updated:** 2026-02-08

A comprehensive guide to using all features of the @everworker/oneringai library.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Core Concepts](#core-concepts)
3. [Basic Text Generation](#basic-text-generation)
4. [Connectors & Authentication](#connectors--authentication)
5. [Agent Features](#agent-features)
   - Multi-User Support (`userId`)
   - Connector Allowlist (`connectors`)
6. [Session Persistence](#session-persistence)
7. [Context Management](#context-management)
   - Strategy Deep Dive (Algorithmic, Custom)
   - Token Estimation
   - Lifecycle Hooks
8. [InContextMemory](#in-context-memory)
   - Setup and Configuration
   - Priority-Based Eviction
   - Tools (context_set, context_delete, context_list)
   - UI Display (`showInUI`) and User Pinning
   - Use Cases and Best Practices
9. [Persistent Instructions](#persistent-instructions)
   - Setup and Configuration
   - Tools (instructions_set, instructions_remove, instructions_list, instructions_clear)
   - Storage and Persistence
   - Use Cases and Best Practices
10. [Tools & Function Calling](#tools--function-calling)
    - Built-in Tools Overview (27+ tools across 7 categories)
    - Developer Tools (Filesystem & Shell)
    - Web Tools (webFetch, web_search via ConnectorTools, web_scrape via ConnectorTools)
    - JSON Tool
    - GitHub Connector Tools (search_files, search_code, read_file, get_pr, pr_files, pr_comments, create_pr)
11. [Dynamic Tool Management](#dynamic-tool-management)
12. [MCP (Model Context Protocol)](#mcp-model-context-protocol)
13. [Multimodal (Vision)](#multimodal-vision)
14. [Audio (TTS/STT)](#audio-ttsstt)
15. [Image Generation](#image-generation)
16. [Video Generation](#video-generation)
17. [Custom Media Storage](#custom-media-storage)
    - IMediaStorage Interface
    - Custom S3 Backend Example
    - FileMediaStorage Default
18. [Web Search](#web-search)
19. [Streaming](#streaming)
20. [External API Integration](#external-api-integration)
21. [Vendor Templates](#vendor-templates)
    - Quick Setup for 43+ Services
    - Authentication Methods
    - Complete Vendor Reference
22. [OAuth for External APIs](#oauth-for-external-apis)
23. [Model Registry](#model-registry)
24. [Scoped Connector Registry](#scoped-connector-registry)
    - Access Control Policies
    - Multi-Tenant Isolation
    - Using with Agent and ConnectorTools
25. [Advanced Features](#advanced-features)
26. [Production Deployment](#production-deployment)

---

## Getting Started

### Installation

```bash
npm install @everworker/oneringai
```

### Environment Setup

Create a `.env` file in your project root:

```env
# AI Provider Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
GROQ_API_KEY=...

# Optional: OAuth encryption key for external APIs
OAUTH_ENCRYPTION_KEY=your-32-byte-hex-key
```

### First Agent

```typescript
import { Connector, Agent, Vendor } from '@everworker/oneringai';

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

// 3. Run the agent
const response = await agent.run('What is the capital of France?');
console.log(response.output_text);
// Output: "The capital of France is Paris."
```

---

## Core Concepts

### Connector-First Architecture

The library uses a **Connector-First Architecture** where **Connectors** are the single source of truth for authentication.

```
User Code → Connector Registry → Agent → Provider → LLM
```

**Key Benefits:**
- **One auth system** for both AI providers AND external APIs
- **Multiple keys per vendor** (e.g., `openai-main`, `openai-backup`)
- **Named connectors** for easy reference
- **No API key management in agent code**

### The Three Core Classes

1. **Connector** - Manages authentication
2. **Agent** - Orchestrates LLM interactions
3. **Vendor** - Enum of supported AI providers

---

## Basic Text Generation

### Simple Question/Answer

```typescript
import { Connector, Agent, Vendor } from '@everworker/oneringai';

// Setup
Connector.create({
  name: 'anthropic',
  vendor: Vendor.Anthropic,
  auth: { type: 'api_key', apiKey: process.env.ANTHROPIC_API_KEY! },
});

const agent = Agent.create({
  connector: 'anthropic',
  model: 'claude-opus-4-5-20251101',
});

// Ask a question
const response = await agent.run('Explain quantum computing in simple terms.');
console.log(response.output_text);
```

### Multi-Turn Conversations

Agents maintain conversation history automatically:

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
});

// First turn
await agent.run('My favorite color is blue.');

// Second turn (agent remembers)
const response = await agent.run('What is my favorite color?');
console.log(response.output_text);
// Output: "Your favorite color is blue."
```

### Configuration Options

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',

  // Optional settings
  temperature: 0.7,          // Randomness (0.0 - 1.0)
  maxIterations: 50,         // Max tool calling rounds (default: 50)
  maxOutputTokens: 2000,     // Max response length

  instructions: `You are a helpful assistant.
                 Always be concise and professional.`,
});
```

### Runtime Configuration

Change settings during execution:

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
});

// Change model
agent.setModel('gpt-4-turbo');

// Change temperature
agent.setTemperature(0.9);

// Get current settings
console.log(agent.getTemperature()); // 0.9
```

---

## Connectors & Authentication

### Creating Connectors

```typescript
import { Connector, Vendor } from '@everworker/oneringai';

// API Key Authentication
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// With custom base URL
Connector.create({
  name: 'openai-custom',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
  baseURL: 'https://custom-proxy.example.com/v1',
});

// With vendor-specific options
Connector.create({
  name: 'anthropic',
  vendor: Vendor.Anthropic,
  auth: { type: 'api_key', apiKey: process.env.ANTHROPIC_API_KEY! },
  options: {
    defaultHeaders: {
      'anthropic-dangerous-direct-browser-access': 'true'
    }
  },
});
```

### Multiple Keys Per Vendor

Use different keys for different purposes:

```typescript
// Main production key
Connector.create({
  name: 'openai-main',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_KEY_MAIN! },
});

// Backup key
Connector.create({
  name: 'openai-backup',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_KEY_BACKUP! },
});

// Use main key
const agent1 = Agent.create({ connector: 'openai-main', model: 'gpt-4' });

// Use backup key
const agent2 = Agent.create({ connector: 'openai-backup', model: 'gpt-4' });
```

### Managing Connectors

```typescript
// Check if connector exists
if (Connector.has('openai')) {
  console.log('OpenAI connector configured');
}

// Get a connector
const connector = Connector.get('openai');
console.log(connector.vendor); // 'openai'

// List all connectors
const names = Connector.list();
console.log(names); // ['openai', 'anthropic', 'google']

// Clear all (useful for testing)
Connector.clear();

// Get an IConnectorRegistry interface (unfiltered)
const registry = Connector.asRegistry();

// Create a scoped (filtered) view — see Scoped Connector Registry section
Connector.setAccessPolicy(myPolicy);
const scopedView = Connector.scoped({ tenantId: 'acme' });
```

### Supported Vendors

```typescript
import { Vendor } from '@everworker/oneringai';

Vendor.OpenAI        // OpenAI (GPT-4, GPT-5, o3-mini)
Vendor.Anthropic     // Anthropic (Claude)
Vendor.Google        // Google AI (Gemini)
Vendor.GoogleVertex  // Google Vertex AI
Vendor.Groq          // Groq (ultra-fast inference)
Vendor.Together      // Together AI
Vendor.Grok          // xAI (Grok)
Vendor.DeepSeek      // DeepSeek
Vendor.Mistral       // Mistral AI
Vendor.Perplexity    // Perplexity
Vendor.Ollama        // Ollama (local models)
Vendor.Custom        // Custom OpenAI-compatible endpoints
```

---

## Agent Features

### Instructions (System Prompt)

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  instructions: `You are a Python programming expert.

                 Rules:
                 - Always provide working code examples
                 - Use type hints
                 - Include docstrings
                 - Follow PEP 8 style guide`,
});

const response = await agent.run('How do I read a CSV file?');
// Agent will provide Python code with all the rules applied
```

### Control Methods

```typescript
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });

// Pause execution
agent.pause();

// Resume execution
agent.resume();

// Cancel current execution
agent.cancel();

// Check status
if (agent.isRunning()) {
  console.log('Agent is processing...');
}

if (agent.isPaused()) {
  console.log('Agent is paused');
}
```

### Metrics & Audit Trail

```typescript
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });

await agent.run('Hello!');

// Get execution metrics
const metrics = agent.getMetrics();
console.log(metrics.totalCalls);        // 1
console.log(metrics.totalTokens);       // 150
console.log(metrics.averageLatency);    // 1200ms

// Get audit trail
const audit = agent.getAuditTrail();
audit.forEach(entry => {
  console.log(`${entry.timestamp}: ${entry.type} - ${entry.message}`);
});
```

### Cleanup

```typescript
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });

// Register cleanup callback
agent.onCleanup(() => {
  console.log('Cleaning up resources...');
});

// Destroy agent
agent.destroy();
```

### Multi-User Support (`userId`)

For multi-user systems, set `userId` once at agent creation and it automatically flows to all tool executions via `ToolContext.userId` — no need to manually thread it through every call:

```typescript
// Set userId at creation
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  userId: 'user-123',
  tools: [myTool],
});

// All tool executions automatically receive userId in their context
const myTool: ToolFunction = {
  definition: { /* ... */ },
  execute: async (args, context) => {
    console.log(context?.userId);  // 'user-123'
    // Use for per-user storage, OAuth tokens, audit trails, etc.
  },
};

// Change userId at runtime (e.g., when reusing agent across users)
agent.userId = 'user-456';

// Also accessible via context
console.log(agent.context.userId);  // 'user-456'
```

**What userId enables:**
- **Tool context** — Every `tool.execute(args, context)` receives `context.userId`
- **Session metadata** — `userId` is automatically included when saving sessions
- **OAuth tokens** — ConnectorTools created with userId use per-user OAuth tokens
- **Per-user storage** — Multimedia tools organize output by userId when set

**Setting userId at different levels:**
```typescript
// Option 1: At agent level (recommended)
const agent = Agent.create({ connector: 'openai', model: 'gpt-4', userId: 'user-123' });

// Option 2: At context level
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: { userId: 'user-123' },
});

// Option 3: At runtime
agent.userId = 'user-123';
```

### Connector Allowlist (`connectors`)

Restrict an agent to a subset of registered connectors. Only listed connectors appear in tool descriptions (e.g., `execute_javascript`) and are accessible in sandbox execution:

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  userId: 'user-123',
  connectors: ['github', 'slack'],  // Only these connectors available to tools
  tools: [executeJavaScript],
});

// Tools only see github and slack — stripe, etc. are invisible
// This works with userId scoping: allowlist filters on top of access-policy view

// Change at runtime
agent.connectors = ['github', 'slack', 'stripe'];

// Remove restriction (all visible connectors available)
agent.connectors = undefined;
```

**How it composes with access policies:**
1. Access policy filters connectors by userId (if set)
2. `connectors` allowlist further restricts to named subset
3. Result: only connectors in the allowlist AND visible to the user

**Available via `ToolContext.connectorRegistry`** — tools that need connector access (like `execute_javascript`) read the pre-built, scoped registry directly from their execution context.

---

## Session Persistence

Save and resume agent conversations across restarts using `AgentContextNextGen` and `FileContextStorage`.

### Quick Start

```typescript
import { AgentContextNextGen, createFileContextStorage } from '@everworker/oneringai';

// Create storage for the agent
const storage = createFileContextStorage('my-assistant');
// Sessions stored at: ~/.oneringai/agents/my-assistant/sessions/

// Create context with storage
const ctx = AgentContextNextGen.create({
  model: 'gpt-4',
  features: { workingMemory: true },
  storage,
});

// Build up state
ctx.addUserMessage('Remember: my name is Alice');
await ctx.memory?.store('user_name', 'User name', 'Alice');

// Save session
await ctx.save('session-001', { title: 'User Session' });

// Later... load session
const ctx2 = AgentContextNextGen.create({ model: 'gpt-4', storage });
const loaded = await ctx2.load('session-001');

if (loaded) {
  // Full state restored
  const name = await ctx2.memory?.retrieve('user_name');
  console.log(name); // 'Alice'
}
```

### Storage Backend: FileContextStorage

```typescript
import { FileContextStorage, createFileContextStorage } from '@everworker/oneringai';

// Simple: use helper function
const storage = createFileContextStorage('my-agent');

// Advanced: custom config
const storage = new FileContextStorage({
  agentId: 'my-agent',
  baseDirectory: '/custom/path/agents',  // Override default ~/.oneringai/agents
  prettyPrint: true,  // Human-readable JSON
});
```

**Storage Location:** `~/.oneringai/agents/<agentId>/sessions/<sessionId>.json`

### Custom Storage

Implement `IContextStorage` interface:

```typescript
import type { IContextStorage, StoredContextSession } from '@everworker/oneringai';

class DatabaseContextStorage implements IContextStorage {
  async save(sessionId: string, state: SerializedContextState, metadata?) { /* ... */ }
  async load(sessionId: string): Promise<StoredContextSession | null> { /* ... */ }
  async delete(sessionId: string) { /* ... */ }
  async exists(sessionId: string) { /* ... */ }
  async list(options?) { /* ... */ }
  getPath() { return 'database://...'; }
}
```

### Session Management APIs

```typescript
// Check if session exists
const exists = await ctx.sessionExists('session-001');

// Delete session
await ctx.deleteSession('session-001');

// Get current session ID
console.log(ctx.sessionId);  // 'session-001' or null

// List all sessions for this agent
const sessions = await storage.list();
for (const s of sessions) {
  console.log(`${s.sessionId}: ${s.metadata?.title} (${s.messageCount} messages)`);
}
```

### Using with Agent

```typescript
import { Agent, createFileContextStorage } from '@everworker/oneringai';

const storage = createFileContextStorage('my-agent');

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    agentId: 'my-agent',
    features: { workingMemory: true },
    storage,
  },
});

// Run agent
await agent.run('Remember: my favorite color is blue');

// Save session
await agent.context.save('session-001');

// Later... load session
await agent.context.load('session-001');
await agent.run('What is my favorite color?');
// Output: "Your favorite color is blue."
```

### What Gets Persisted

| Component | Persisted? | Notes |
|-----------|------------|-------|
| Conversation history | ✅ | All messages with timestamps |
| WorkingMemory entries | ✅ | Full values, not just index |
| InContextMemory entries | ✅ | Via plugin state |
| Tool enable/disable state | ✅ | Per-tool settings |
| System prompt | ✅ | |


### AgentContextNextGen Session Persistence

The recommended approach to session persistence using `AgentContextNextGen`:

```typescript
import { AgentContextNextGen, createFileContextStorage } from '@everworker/oneringai';

// Create storage for the agent
const storage = createFileContextStorage('my-assistant');
// Sessions stored at: ~/.oneringai/agents/my-assistant/sessions/

// Create context with storage
const ctx = AgentContextNextGen.create({
  model: 'gpt-4',
  features: { workingMemory: true, inContextMemory: true },
  storage,
});

// Build up state
ctx.addUserMessage('My name is Alice and I prefer dark mode.');
ctx.addAssistantResponse({ output_text: 'Nice to meet you, Alice!' });
await ctx.memory?.store('user_name', 'User name', 'Alice');
await ctx.memory?.store('user_pref', 'User preferences', { theme: 'dark' });

// Save session with metadata
await ctx.save('session-001', {
  title: 'Alice Support Chat',
  tags: ['support', 'vip'],
});

console.log(ctx.sessionId);  // 'session-001'
```

#### Loading Sessions

```typescript
// Create new context and load
const ctx2 = AgentContextNextGen.create({
  model: 'gpt-4',
  features: { workingMemory: true, inContextMemory: true },
  storage,
});

const loaded = await ctx2.load('session-001');

if (loaded) {
  // Everything is restored:
  const conversation = ctx2.getConversation();
  console.log(conversation[0]);  // User message about Alice

  const name = await ctx2.memory?.retrieve('user_name');
  console.log(name);  // 'Alice'

  const prefs = await ctx2.memory?.retrieve('user_pref');
  console.log(prefs);  // { theme: 'dark' }
}
```

#### What Gets Persisted

| Component | Persisted? | Notes |
|-----------|------------|-------|
| Conversation history | ✅ | All messages with timestamps |
| WorkingMemory entries | ✅ | **Full values**, not just index |
| Tool enable/disable state | ✅ | Per-tool settings |
| Permission approvals | ✅ | Session approvals |
| InContextMemory entries | ✅ | Via plugin state |
| System prompt | ✅ | |
| Instructions | ✅ | |

#### Session Management APIs

```typescript
// Check if session exists
const exists = await ctx.sessionExists('session-001');

// Delete session
await ctx.deleteSession('session-001');

// Delete current session
await ctx.deleteSession();  // Uses ctx.sessionId

// List all sessions for this agent
const sessions = await storage.list();
for (const s of sessions) {
  console.log(`${s.sessionId}: ${s.metadata?.title} (${s.messageCount} messages)`);
}

// List with filtering
const recentSessions = await storage.list({
  savedAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),  // Last week
  tags: ['support'],
  limit: 10,
});
```

#### Storage Backends

**FileContextStorage** (default):
```typescript
import { FileContextStorage, createFileContextStorage } from '@everworker/oneringai';

// Simple: use helper
const storage = createFileContextStorage('my-agent');

// Advanced: custom config
const storage = new FileContextStorage({
  agentId: 'my-agent',
  baseDirectory: '/custom/path/agents',  // Override default ~/.oneringai/agents
  prettyPrint: true,  // Human-readable JSON
});
```

**Custom Storage** (implement `IContextStorage`):
```typescript
import type { IContextStorage, StoredContextSession } from '@everworker/oneringai';

class RedisContextStorage implements IContextStorage {
  async save(sessionId: string, state: SerializedAgentContextState, metadata?) { /* ... */ }
  async load(sessionId: string): Promise<StoredContextSession | null> { /* ... */ }
  async delete(sessionId: string) { /* ... */ }
  async exists(sessionId: string) { /* ... */ }
  async list(options?) { /* ... */ }
  getPath() { return 'redis://...'; }
}
```

### Agent Definition Persistence (NEW)

Store agent **configuration** separately from sessions for easy instantiation:

```typescript
import { Agent, createFileAgentDefinitionStorage } from '@everworker/oneringai';

const defStorage = createFileAgentDefinitionStorage();
// Stores at: ~/.oneringai/agents/<agentId>/definition.json

// Create and configure agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  instructions: 'You are a helpful support assistant.',
  context: {
    agentId: 'support-bot',
    features: { workingMemory: true, persistentInstructions: true }
  }
});

// Save definition with metadata
await agent.saveDefinition(defStorage, {
  description: 'Customer support chatbot',
  tags: ['support', 'production'],
  author: 'Team A'
});
```

#### Loading Agents from Definitions

```typescript
// Later: recreate agent from stored definition
const restored = await Agent.fromStorage('support-bot', defStorage);

if (restored) {
  // Agent has same model, instructions, features as when saved
  const response = await restored.run('Hello!');
}

// With config overrides
const devAgent = await Agent.fromStorage('support-bot', defStorage, {
  model: 'gpt-3.5-turbo',  // Override model for development
});
```

#### Listing Agent Definitions

```typescript
const definitions = await defStorage.list();

for (const def of definitions) {
  console.log(`${def.agentId}: ${def.name}`);
  console.log(`  Type: ${def.agentType}, Model: ${def.model}`);
  console.log(`  Created: ${def.createdAt}`);
}

// Filter by type
const taskAgents = await defStorage.list({ agentType: 'task-agent' });
```

#### Storage Structure

```
~/.oneringai/agents/
├── support-bot/
│   ├── definition.json          # Agent configuration
│   ├── custom_instructions.json  # Persistent instructions (if enabled)
│   └── sessions/
│       ├── _index.json          # Session index for fast listing
│       ├── session-001.json     # Full session state
│       └── session-002.json
├── research-bot/
│   ├── definition.json
│   └── sessions/
│       └── ...
└── _agents_index.json           # Agent definitions index
```


## Context Management

The library includes a **powerful, universal context management system** that automatically handles the complexity of managing LLM context windows. `AgentContextNextGen` is the primary context manager with a clean, plugin-based architecture.

### AgentContextNextGen - The Modern API

**AgentContextNextGen** is the modern, plugin-first context manager. It provides clean separation of concerns with composable plugins:

```typescript
import { AgentContextNextGen } from '@everworker/oneringai';

// Create a context instance
const ctx = AgentContextNextGen.create({
  model: 'gpt-4',
  systemPrompt: 'You are a helpful assistant.',
  features: {
    workingMemory: true,      // WorkingMemoryPluginNextGen
    inContextMemory: true,    // InContextMemoryPluginNextGen
    persistentInstructions: false,
  },
  strategy: 'algorithmic', // Default strategy (75% threshold)
});

// Add user message
ctx.addUserMessage('What is the weather in Paris?');

// Prepare context for LLM call (handles compaction if needed)
const { input, budget, compacted } = await ctx.prepare();

// After LLM call, add response
ctx.addAssistantResponse(response.output);

// Add tool results
ctx.addToolResults([{ tool_use_id: '...', content: '...' }]);

// Access plugins
const memory = ctx.memory;  // WorkingMemoryPluginNextGen | null
await memory?.store('key', 'description', value);

// Access tools
ctx.tools.disable('risky_tool');

// Budget information
console.log(`Tokens: ${budget.totalUsed}/${budget.maxTokens}`);
console.log(`Utilization: ${budget.utilizationPercent}%`);
console.log(`Available: ${budget.available}`);
```

### Context Structure

AgentContextNextGen organizes context into clear sections:

```
[Developer Message - All glued together]
  # System Prompt
  # Persistent Instructions (if plugin enabled)
  # Plugin Instructions (for enabled plugins)
  # In-Context Memory (if plugin enabled)
  # Working Memory Index (if plugin enabled)

[Conversation History]
  ... messages including tool_use/tool_result pairs ...

[Current Input]
  User message OR tool results (newest, never compacted)
```

#### AgentContextNextGen Components

AgentContextNextGen uses a plugin architecture with these core components:

| Component | Access | Purpose |
|-----------|--------|---------|
| **ToolManager** | `ctx.tools` | Tool registration, execution, circuit breakers |
| **WorkingMemoryPluginNextGen** | `ctx.getPlugin('working-memory')` | Tiered memory (raw/summary/findings) |
| **InContextMemoryPluginNextGen** | `ctx.getPlugin('in-context-memory')` | Live key-value storage in context |
| **PersistentInstructionsPluginNextGen** | `ctx.getPlugin('persistent-instructions')` | Disk-persisted agent instructions |
| **Conversation** | `ctx.getConversation()` | Built-in conversation tracking (Message[]) |

#### Using AgentContextNextGen with Agent

**AgentContextNextGen is always available** - BaseAgent creates it in the constructor, making it the single source of truth for ToolManager:

```typescript
import { Agent, AgentContextNextGen } from '@everworker/oneringai';

// AgentContextNextGen is auto-created with default config
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool],
  context: {
    strategy: 'algorithmic',    // Default strategy: algorithmic compaction at 75% threshold
    features: { workingMemory: true },
  },
});

// UNIFIED TOOL MANAGEMENT: agent.tools and agent.context.tools are the SAME instance
console.log(agent.tools === agent.context.tools);  // true
console.log(agent.hasContext());  // Always true

// Tool changes via either path are immediately reflected
agent.tools.disable('weather_tool');
console.log(agent.context.tools.listEnabled().includes('weather_tool'));  // false

agent.context.tools.enable('weather_tool');
console.log(agent.tools.listEnabled().includes('weather_tool'));  // true

// Agent automatically tracks messages and tool calls
await agent.run('What is the weather?');

// Access the context (never null)
const ctx = agent.context;
const conversation = ctx.getConversation(); // Message[] - NextGen API
const { budget } = await ctx.prepare();
console.log(`Used: ${budget.used}/${budget.total} tokens`);

// Option 2: Pass existing AgentContextNextGen instance
const sharedContext = AgentContextNextGen.create({ model: 'gpt-4' });
const agent1 = Agent.create({ connector: 'openai', model: 'gpt-4', context: sharedContext });
const agent2 = Agent.create({ connector: 'anthropic', model: 'claude', context: sharedContext });
// Both agents share the same context state and ToolManager!
```

#### AgentContextNextGen Configuration

```typescript
interface AgentContextNextGenConfig {
  /** Model name (used for token limits) */
  model?: string;

  /** Max context tokens (overrides model default) */
  maxContextTokens?: number;

  /** Response token reserve in tokens (default: 4096) */
  responseReserve?: number;

  /** System prompt */
  systemPrompt?: string;

  /** Agent ID (used for persistent storage paths) */
  agentId?: string;

  /** Tools to register */
  tools?: ToolFunction[];

  /** Feature flags for enabling/disabling plugins */
  features?: ContextFeatures;

  /** Compaction strategy */
  strategy?: string;  // 'algorithmic' (default, 75%) or custom registered strategy name

  /** Token estimator (default: simpleTokenEstimator) */
  tokenEstimator?: ITokenEstimator;

  /** Context storage for session persistence */
  storage?: IContextStorage;

  /** Plugin configurations */
  plugins?: PluginConfigs;
}

interface ContextFeatures {
  /** Enable WorkingMemoryPluginNextGen (default: true) */
  workingMemory?: boolean;

  /** Enable InContextMemoryPluginNextGen (default: false) */
  inContextMemory?: boolean;

  /** Enable PersistentInstructionsPluginNextGen (default: false) */
  persistentInstructions?: boolean;
}
```

#### Feature Configuration

AgentContextNextGen features enable plugins independently. When a feature is disabled, its associated tools are **not registered**, giving the LLM a cleaner tool set:

```typescript
import { AgentContextNextGen, DEFAULT_FEATURES } from '@everworker/oneringai';

// View default feature settings
console.log(DEFAULT_FEATURES);
// { workingMemory: true, inContextMemory: false, persistentInstructions: false }
```

**Available Features:**

| Feature | Default | Plugin | When Disabled |
|---------|---------|--------|---------------|
| `workingMemory` | `true` | WorkingMemoryPluginNextGen - tiered memory (raw/summary/findings) | `memory_*` tools not registered; `ctx.memory` returns `null` |
| `inContextMemory` | `false` | InContextMemoryPluginNextGen - live key-value storage directly in context | `context_set/delete/list` tools not registered |
| `persistentInstructions` | `false` | PersistentInstructionsPluginNextGen - agent instructions persisted to disk (KVP entries) | `instructions_*` tools not registered |

**Usage Examples:**

```typescript
// 1. Minimal stateless agent (no working memory)
const ctx = AgentContextNextGen.create({
  model: 'gpt-4',
  features: { workingMemory: false },  // Disable working memory
});

console.log(ctx.memory);  // null

// 2. Full-featured agent with all capabilities
const ctx = AgentContextNextGen.create({
  model: 'gpt-4',
  features: {
    workingMemory: true,          // default: true
    inContextMemory: true,        // default: false
    persistentInstructions: true, // default: false
  },
});

// 3. Via Agent.create() - inline config
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    features: { workingMemory: false },  // Disable working memory
  },
});

// 4. Agent with all features
const fullAgent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    agentId: 'my-agent',
    features: {
      workingMemory: true,
      inContextMemory: true,
      persistentInstructions: true,
    },
  },
});
```

**Feature-Aware APIs:**

```typescript
// Check if a feature is enabled
ctx.features.workingMemory;           // boolean
ctx.features.inContextMemory;         // boolean
ctx.features.persistentInstructions;  // boolean
ctx.isFeatureEnabled('permissions');

// Get read-only feature configuration
ctx.features; // { memory, inContextMemory, persistentInstructions, history, permissions, toolOutputTracking, autoSpill, toolResultEviction }

// Access nullable components
ctx.memory;         // WorkingMemory | null
ctx.cache;          // IdempotencyCache | null
ctx.permissions;    // ToolPermissionManager | null
ctx.inContextMemory; // InContextMemoryPlugin | null

// Require component (throws if disabled)
const memory = ctx.requireMemory();         // WorkingMemory (throws if memory disabled)
const cache = ctx.requireCache();           // IdempotencyCache (throws if memory disabled)
const perms = ctx.requirePermissions();     // ToolPermissionManager (throws if permissions disabled)
```

**Tool Auto-Registration:**

AgentContextNextGen automatically registers feature-aware tools based on enabled features:

```typescript
import { AgentContextNextGen } from '@everworker/oneringai';

// With workingMemory enabled (default)
const ctx = AgentContextNextGen.create({ model: 'gpt-4' });
console.log(ctx.tools.has('memory_store'));     // true

// With workingMemory disabled - no memory tools registered
const ctx2 = AgentContextNextGen.create({
  model: 'gpt-4',
  features: { workingMemory: false },
});
console.log(ctx2.tools.has('memory_store'));    // false
```

**Tools registered by feature:**
- **workingMemory=true** (default): `memory_store`, `memory_retrieve`, `memory_delete`, `memory_list`
- **inContextMemory=true**: `context_set`, `context_delete`, `context_list`
- **persistentInstructions=true**: `instructions_set`, `instructions_remove`, `instructions_list`, `instructions_clear`

**Backward Compatibility:**

- Default features: `workingMemory: true`, `inContextMemory: false`, `persistentInstructions: false`
- Code not using `features` config works unchanged

#### Conversation Management

AgentContextNextGen provides a simple API for managing conversation history:

```typescript
import { AgentContextNextGen } from '@everworker/oneringai';

const ctx = AgentContextNextGen.create({ model: 'gpt-4' });

// Add user message
ctx.addUserMessage('Hello!');

// Prepare for LLM call (handles compaction if needed)
const { input, budget } = await ctx.prepare();

// ... call LLM with input ...

// Add assistant response
ctx.addAssistantResponse(response.output);

// Add tool results
ctx.addToolResults([
  { call_id: 'call_123', output: JSON.stringify({ result: 'success' }) }
]);

// Get conversation history
const conversation = ctx.getConversation();

// Clear conversation
ctx.clearConversation('Starting fresh');
```

**Compaction:**

Compaction happens automatically during `prepare()` when context utilization exceeds the strategy threshold:

| Strategy | Threshold | Description |
|----------|-----------|-------------|
| `algorithmic` | 75% | Moves large tool results to Working Memory, limits tool pairs, applies rolling window (default) |

Custom strategies can be registered via `StrategyRegistry.register()`.

**Context Budget:**

```typescript
const { input, budget, compacted } = await ctx.prepare();

console.log(budget.utilizationPercent);  // Current usage %
console.log(budget.available);           // Remaining tokens
console.log(compacted);                  // true if compaction occurred
```

#### Session Persistence

AgentContextNextGen supports saving and loading sessions:

```typescript
import { AgentContextNextGen, createFileContextStorage } from '@everworker/oneringai';

// Create storage
const storage = createFileContextStorage('my-agent');

// Create context with storage
const ctx = AgentContextNextGen.create({
  model: 'gpt-4',
  features: { workingMemory: true },
  storage,
});

// Add messages and data
ctx.addUserMessage('Hello');

// Save session
await ctx.save('session-001', { title: 'My Session' });

// Later: Load session
const ctx2 = AgentContextNextGen.create({ model: 'gpt-4', storage });
await ctx2.load('session-001');
// ctx2 now has full conversation and plugin states restored
```

#### Plugin System (NextGen)

Extend AgentContextNextGen with custom plugins:

```typescript
import { IContextPluginNextGen, BasePluginNextGen, AgentContextNextGen } from '@everworker/oneringai';

// Create a custom plugin by extending BasePluginNextGen
class MyPlugin extends BasePluginNextGen {
  readonly name = 'my-plugin';

  private data: string[] = [];

  // Return content to be included in context
  getContent(): string {
    if (this.data.length === 0) return '';
    return `## My Plugin Data\n${this.data.join('\n')}`;
  }

  // Return estimated token count
  getTokens(): number {
    return this.estimateTokens(this.getContent());
  }

  addData(item: string) {
    this.data.push(item);
  }

  // Compact: reduce content to fit within targetTokens
  async compact(targetTokens: number): Promise<number> {
    const before = this.getTokens();
    // Keep only recent data to fit target
    while (this.getTokens() > targetTokens && this.data.length > 1) {
      this.data.shift();
    }
    return before - this.getTokens();
  }

  // Serialize state for persistence
  serialize(): Record<string, unknown> {
    return { data: this.data };
  }

  // Deserialize state
  deserialize(state: Record<string, unknown>): void {
    this.data = (state.data as string[]) || [];
  }
}

// Use the plugin
const ctx = AgentContextNextGen.create({ model: 'gpt-4' });
const plugin = new MyPlugin();
ctx.registerPlugin(plugin);
plugin.addData('Custom data');
```

#### Events

Monitor AgentContextNextGen activity:

```typescript
const ctx = AgentContextNextGen.create({ model: 'gpt-4' });

// Message events
ctx.on('message:added', ({ message }) => {
  console.log(`New ${message.role} message`);
});

// Compaction events
ctx.on('compacted', ({ tokensFreed }) => {
  console.log(`Freed ${tokensFreed} tokens`);
});

// Budget events
ctx.on('budget:warning', ({ budget }) => {
  console.log(`Context at ${Math.round(budget.used / budget.total * 100)}%`);
});

// Context prepared event
ctx.on('prepared', ({ budget }) => {
  console.log(`Context prepared: ${budget.used}/${budget.total} tokens`);
});
```

#### Accessing Context in Agent

Agent uses **AgentContextNextGen** with plugins for extended functionality:

```typescript
import { Agent, AgentContextNextGen, WorkingMemoryPluginNextGen } from '@everworker/oneringai';

// Create Agent with NextGen context
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],
  context: {
    features: { workingMemory: true, inContextMemory: true },
  },
});

// Access AgentContextNextGen directly
agent.context.addUserMessage('Hello');
const { input, budget } = await agent.context.prepare();
agent.context.addAssistantResponse(response);

// Get conversation
const conversation = agent.context.getConversation();  // Message[]

// Access WorkingMemory via plugin
const memoryPlugin = agent.context.getPlugin('working-memory') as WorkingMemoryPluginNextGen;
await memoryPlugin.store('key', 'description', value);

// Access tools via context
agent.context.tools.disable('tool_name');
```

**AgentContextNextGen API:**
```typescript
// AgentContextNextGen provides clean context management:
ctx.addUserMessage(content);              // Set current user input
ctx.addAssistantResponse(response);       // Add response to conversation
await ctx.prepare();                      // Prepare context for LLM call, returns { input, budget }
ctx.getConversation();                    // Get conversation history
ctx.registerPlugin(plugin);               // Register context plugin
ctx.getPlugin(name);                      // Get registered plugin by name
await ctx.compact(targetTokens);          // Manual compaction
await ctx.save(sessionId);                // Save session (if storage configured)
await ctx.load(sessionId);                // Load session (if storage configured)

// Access ToolManager:
ctx.tools;                                // ToolManager instance
```

**NextGen Plugin System:**

Use NextGen plugins to extend AgentContextNextGen:

```typescript
import { BasePluginNextGen, WorkingMemoryPluginNextGen, InContextMemoryPluginNextGen } from '@everworker/oneringai';

// Built-in NextGen plugins:
// - WorkingMemoryPluginNextGen: Tiered memory (raw/summary/findings)
// - InContextMemoryPluginNextGen: Live key-value storage in context
// - PersistentInstructionsPluginNextGen: Disk-persisted instructions

// Custom plugin example:
class MyPlugin extends BasePluginNextGen {
  readonly name = 'my-plugin';

  getContent(): string {
    return 'Custom context content';
  }

  getTokens(): number {
    return this.estimateTokens(this.getContent());
  }
}

ctx.registerPlugin(new MyPlugin());
```

---

### Why Context Management Matters

LLMs have fixed context windows (e.g., 128K tokens for GPT-4, 200K for Claude). As conversations grow, you must:
- **Track usage** to avoid hitting limits
- **Prioritize content** (instructions vs history vs memory)
- **Compact intelligently** when approaching limits
- **Preserve critical information** while freeing space

The context management system handles all of this automatically.

### Basic Context Management

Context management is **automatic** with AgentContextNextGen:

```typescript
import { Agent } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],
  context: {
    strategy: 'algorithmic',  // Default: compact at 75% utilization
    features: { workingMemory: true },
  },
});

// AgentContextNextGen will automatically:
// 1. Track context usage across all plugins
// 2. Compact when approaching limits (at prepare() time)
// 3. Evict low-priority memory entries when needed
// 4. Call plugin compact() methods in priority order
// 5. Emit events for monitoring
```

### Architecture Overview

The context management system is built around **AgentContextNextGen** - the clean, plugin-first context manager:

```
┌─────────────────────────────────────────────────────┐
│               AgentContextNextGen                    │
│  - Plugin-first architecture                        │
│  - Clean message flow (addUserMessage → prepare)    │
│  - Single compaction point (right before LLM call)  │
└─────────────────┬───────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌─────────┐ ┌──────────┐ ┌───────────────┐
│ Strategy│ │ Plugins  │ │ Context       │
│ (when)  │ │ (what)   │ │ Structure     │
└─────────┘ └──────────┘ └───────────────┘

Strategy: Decides WHEN to compact (algorithmic: 75% threshold, or custom)
Plugins: WorkingMemoryPluginNextGen, InContextMemoryPluginNextGen, etc.
Context: Developer Message → Conversation History → Current Input
```

### Manual Context Management

For advanced use cases, use **AgentContextNextGen** with plugins:

```typescript
import {
  AgentContextNextGen,
  WorkingMemoryPluginNextGen,
  InContextMemoryPluginNextGen,
  simpleTokenEstimator,
} from '@everworker/oneringai';

// Create AgentContextNextGen with configuration
const ctx = AgentContextNextGen.create({
  model: 'gpt-4',
  systemPrompt: 'Your system instructions',
  maxContextTokens: 128000,    // Model's context window
  responseReserve: 4096,       // Reserve tokens for response
  strategy: 'algorithmic',     // Default compaction strategy (75% threshold)
  features: {
    workingMemory: true,       // Enable WorkingMemoryPluginNextGen
    inContextMemory: true,     // Enable InContextMemoryPluginNextGen
  },
});

// Plugins are auto-registered when features are enabled
// Access them via getPlugin():
const memoryPlugin = ctx.getPlugin('working-memory') as WorkingMemoryPluginNextGen;
const inContextPlugin = ctx.getPlugin('in-context-memory') as InContextMemoryPluginNextGen;

// Add user message (sets _currentInput)
ctx.addUserMessage('Current task description');

// Prepare context before each LLM call
const { input, budget } = await ctx.prepare();
console.log(`Context: ${budget.used}/${budget.total} tokens`);
console.log(`Utilization: ${(budget.used / budget.total * 100).toFixed(1)}%`);

// After LLM response, add it to conversation
ctx.addAssistantResponse(llmResponse);

// Get conversation history
const conversation = ctx.getConversation();  // Message[]
```

### Compactors Deep Dive

Compactors determine **how** content is reduced during compaction. Each compactor handles components with a matching `strategy` metadata.

#### Available Compactors

| Compactor | Strategy | Priority | What It Does |
|-----------|----------|----------|--------------|
| **TruncateCompactor** | `truncate` | 10 | Removes content from the end |
| **MemoryEvictionCompactor** | `evict` | 8 | Evicts low-priority memory entries |
| **SummarizeCompactor** | `summarize` | 5 | Uses LLM to create intelligent summaries |

**Lower priority number = runs earlier** (summarize before truncate).

#### SummarizeCompactor (LLM-Based)

The `SummarizeCompactor` uses an LLM to intelligently summarize content, preserving key information while reducing token count.

```typescript
import { SummarizeCompactor, ApproximateTokenEstimator } from '@everworker/oneringai';

const estimator = new ApproximateTokenEstimator();

// Create summarize compactor with LLM
const summarizeCompactor = new SummarizeCompactor(estimator, {
  textProvider: myTextProvider,     // Required: LLM for summarization
  model: 'gpt-4o-mini',             // Optional: model to use (default: same as agent)
  maxSummaryTokens: 500,            // Optional: max tokens for summary
  preserveStructure: true,          // Optional: keep headings/lists (default: true)
  fallbackToTruncate: true,         // Optional: truncate if LLM fails (default: true)
});

// Components with strategy: 'summarize' will use this compactor
const component = {
  name: 'conversation_history',
  content: longConversation,
  priority: 6,
  compactable: true,
  metadata: { strategy: 'summarize' },  // Uses SummarizeCompactor
};
```

**What SummarizeCompactor Preserves:**

For **conversation history**:
- Key decisions made
- Important facts discovered
- User preferences expressed
- Unresolved questions

For **tool outputs** (search/scrape results):
- Key findings relevant to the task
- Source URLs and main points
- Factual data (numbers, dates, names)
- Contradictions between sources

```typescript
// Example: Research task with summarization
// AgentContextNextGen is the unified context manager - configure via Agent.create()
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    features: { workingMemory: true },
  },
});

// Access context management via agent.context (AgentContextNextGen instance)
const { budget } = await agent.context.prepare();
```

#### MemoryEvictionCompactor

Evicts low-priority memory entries based on the `avgEntrySize` metadata.

```typescript
import { MemoryEvictionCompactor } from '@everworker/oneringai';

const evictionCompactor = new MemoryEvictionCompactor(estimator);

// Components with strategy: 'evict' will use this compactor
const memoryComponent = {
  name: 'memory_index',
  content: memoryIndex,
  priority: 8,
  compactable: true,
  metadata: {
    strategy: 'evict',
    avgEntrySize: 100,                    // Average tokens per entry
    evict: async (count) => { ... },      // Callback to evict entries
    getUpdatedContent: async () => { ... }, // Get content after eviction
  },
};
```

### Pre-Compaction Hooks

The `beforeCompaction` lifecycle hook allows agents to save important data before compaction occurs. This is critical for research tasks where tool outputs may contain valuable information.

```typescript
import { Agent, BeforeCompactionContext } from '@everworker/oneringai';

// Define lifecycle hooks when creating the agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  lifecycleHooks: {
    beforeCompaction: async (context: BeforeCompactionContext) => {
      console.log(`Agent ${context.agentId}: Compaction starting`);
      console.log(`Current usage: ${context.currentBudget.used}/${context.currentBudget.total}`);
      console.log(`Need to free: ${context.estimatedTokensToFree} tokens`);
      console.log(`Strategy: ${context.strategy}`);
      console.log(`Components to compact: ${context.components.length}`);

      // Example: Save important tool outputs before they're compacted
      for (const component of context.components) {
        if (component.name === 'tool_outputs' && component.compactable) {
          // Extract key findings and save to memory
          await saveKeyFindings(component.content);
        }
      }
    },
  },
});

// AgentContextNextGen handles all context management internally
// No separate ContextManager needed
```

#### BeforeCompactionContext

The hook receives detailed context about the upcoming compaction:

```typescript
interface BeforeCompactionContext {
  /** Agent ID (set via setAgentId) */
  agentId: string;

  /** Current context budget */
  currentBudget: ContextBudget;

  /** Strategy being used (e.g. 'algorithmic') */
  strategy: string;

  /** Components about to be compacted */
  components: ReadonlyArray<IContextComponent>;

  /** Estimated tokens that need to be freed */
  estimatedTokensToFree: number;
}
```

#### Error Handling in Hooks

Hooks are designed to be resilient - errors are logged but don't prevent compaction:

```typescript
const hooks = {
  beforeCompaction: async (context) => {
    // Even if this throws, compaction will continue
    throw new Error('Hook error');
  },
};

// Compaction proceeds, error is logged to console
```

### Context Strategies Deep Dive

AgentContextNextGen uses a **strategy-based compaction system** with the `ICompactionStrategy` interface. The strategy controls when and how context is compacted.

#### Built-in Strategies

| Strategy | Threshold | Description |
|----------|-----------|-------------|
| **algorithmic** (default) | 75% | Moves large tool results to Working Memory, limits tool pairs to 10, applies rolling window. Best for tool-heavy agents. |

The `algorithmic` strategy is the recommended default. It requires the `working_memory` plugin to be enabled (which it is by default).

```typescript
// Default - uses algorithmic strategy automatically
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: { features: { workingMemory: true } },
});

// Explicit strategy selection
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: { strategy: 'algorithmic' },
});
```

---

### Creating Custom Strategies

For specialized use cases, implement `ICompactionStrategy` and register it via `StrategyRegistry`:

```typescript
import {
  ICompactionStrategy,
  CompactionContext,
  CompactionResult,
  ConsolidationResult,
  StrategyRegistry,
  Agent,
} from '@everworker/oneringai';

// Implement the ICompactionStrategy interface
class TimeBasedStrategy implements ICompactionStrategy {
  readonly name = 'time-based';
  readonly displayName = 'Time-Based';
  readonly description = 'Adjusts compaction threshold based on time of day';

  get threshold(): number {
    const hour = new Date().getHours();
    const isBusinessHours = hour >= 9 && hour <= 17;
    return isBusinessHours ? 0.60 : 0.85;
  }

  async compact(context: CompactionContext): Promise<CompactionResult> {
    const log: string[] = [];
    let tokensFreed = 0;

    // Remove old messages from conversation
    const messages = context.getConversation();
    const toRemove = Math.floor(messages.length * 0.3);
    for (let i = 0; i < toRemove; i++) {
      context.removeMessage(i);
      tokensFreed += 100; // Approximate
    }

    log.push(`Time-based: removed ${toRemove} old messages`);
    return { tokensFreed, log };
  }

  async consolidate(context: CompactionContext): Promise<ConsolidationResult> {
    // Post-cycle cleanup (optional)
    return { tokensFreed: 0, log: [] };
  }
}

  getTargetUtilization(): number {
    return 0.55;
  }

// Register the custom strategy
StrategyRegistry.register(TimeBasedStrategy);

// Use your custom strategy via Agent.create()
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    strategy: 'time-based',  // Uses your registered strategy
  },
});

// Or provide a strategy instance directly
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    compactionStrategy: new TimeBasedStrategy(),
  },
});
```

### Using Strategies

```typescript
// Default - algorithmic strategy (recommended for most use cases)
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  // strategy defaults to 'algorithmic' (75% threshold)
});

// Custom registered strategy
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: { strategy: 'time-based' },  // Your registered strategy
});
```

### Token Estimation

The `ApproximateTokenEstimator` provides content-type-aware estimation:

```typescript
import { ApproximateTokenEstimator } from '@everworker/oneringai';

const estimator = new ApproximateTokenEstimator();

// Basic estimation (mixed content assumed)
const tokens1 = estimator.estimateTokens('Hello, world!');

// Content-type-aware estimation for better accuracy
const codeTokens = estimator.estimateTokens(sourceCode, 'code');    // ~3 chars/token
const proseTokens = estimator.estimateTokens(essay, 'prose');       // ~4 chars/token
const mixedTokens = estimator.estimateTokens(readme, 'mixed');      // ~3.5 chars/token

// Estimate structured data
const dataTokens = estimator.estimateDataTokens({ users: [...], config: {...} });
```

**Why content type matters:**
- Code has more special characters and shorter words → fewer chars/token
- Prose has longer words and punctuation → more chars/token
- Accurate estimation prevents over/under-compaction

### Context Budget Monitoring

```typescript
// Get budget from prepare() call
const { input, budget, compacted } = await agent.context.prepare();

console.log(`Max tokens: ${budget.maxTokens}`);
console.log(`Used tokens: ${budget.totalUsed}`);
console.log(`Available: ${budget.available}`);
console.log(`Utilization: ${budget.utilizationPercent.toFixed(1)}%`);

// Check if compaction occurred
if (compacted) {
  console.log('Context was compacted to make room');
}

// Detailed breakdown
console.log('Breakdown:');
console.log(`  System prompt: ${budget.breakdown.systemPrompt} tokens`);
console.log(`  Plugin instructions: ${budget.breakdown.pluginInstructions} tokens`);
console.log(`  Conversation: ${budget.breakdown.conversation} tokens`);
console.log(`  Current input: ${budget.breakdown.currentInput} tokens`);
```

### Agent Lifecycle Hooks for Context

Use lifecycle hooks to integrate context management with your application:

```typescript
import { AgentLifecycleHooks } from '@everworker/oneringai';

const hooks: AgentLifecycleHooks = {
  // Called before context is prepared for LLM call
  beforeContextPrepare: async (agentId) => {
    console.log(`[${agentId}] Preparing context...`);
    // Could switch strategy based on task type
  },

  // Called after compaction completes
  afterCompaction: async (log, tokensFreed) => {
    // Log to monitoring system
    await monitoring.record({
      event: 'context_compaction',
      tokensFreed,
      logEntries: log,
    });

    console.log(`Compaction freed ${tokensFreed} tokens`);
  },

  // Called before each tool execution
  beforeToolExecution: async (context) => {
    const budget = context.contextManager?.getCurrentBudget();
    if (budget && budget.utilizationPercent > 80) {
      console.warn(`High context usage before tool: ${budget.utilizationPercent}%`);
    }
  },

  // Called after tool execution
  afterToolExecution: async (result) => {
    // Could trigger compaction if tool output was large
    if (result.output && JSON.stringify(result.output).length > 10000) {
      console.log('Large tool output detected');
    }
  },

  // Error handling
  onError: async (error, context) => {
    if (context.phase === 'context_preparation') {
      console.error('Context preparation failed:', error);
      // Could adjust strategy or retry
    }
  },
};

// Apply hooks to agent
agent.setLifecycleHooks(hooks);
```

### Best Practices for Context Management

#### 1. Use the Default Strategy

The `algorithmic` strategy (default, 75% threshold) works well for most use cases. It automatically offloads large tool results to Working Memory and manages conversation history:

```typescript
import { Agent } from '@everworker/oneringai';

// Default algorithmic strategy - recommended for most use cases
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: { features: { workingMemory: true } },
});

// For custom compaction behavior, register a custom strategy via StrategyRegistry
```

#### 2. Monitor in Production

```typescript
// Set up monitoring with AgentContextNextGen events
const ctx = agent.context;

ctx.on('compacted', async ({ tokensFreed }) => {
  await metrics.gauge('context.tokens_freed', tokensFreed);
});

ctx.on('prepared', async ({ budget }) => {
  await metrics.gauge('context.usage', budget.used);
  await metrics.gauge('context.total', budget.total);
});

ctx.on('budget:warning', async ({ budget }) => {
  const utilization = Math.round(budget.used / budget.total * 100);
  await alerts.warn(`Context warning: ${utilization}%`);
});
```

#### 3. Use WorkingMemory Tiers

```typescript
// Store data in appropriate tiers based on importance
const memoryPlugin = ctx.getPlugin('working-memory') as WorkingMemoryPluginNextGen;

// Raw tier: Large, unprocessed data (evicted first)
await memoryPlugin.storeRaw('search.results', 'Raw search results', largeResults);

// Summary tier: Condensed information
await memoryPlugin.storeSummary('search.summary', 'Search summary', summaryData);

// Findings tier: Key insights (evicted last)
await memoryPlugin.storeFindings('search.findings', 'Key findings', findings);
```

#### 4. Plan for Compaction

```typescript
// Structure data for efficient compaction using tiers
const memoryPlugin = ctx.getPlugin('working-memory') as WorkingMemoryPluginNextGen;

// BAD: Single large object in findings (won't be evicted easily)
await memoryPlugin.storeFindings('all.data', 'All data', hugeObject);

// GOOD: Split by importance using tiers
// Raw tier: Evicted first during compaction
await memoryPlugin.storeRaw('data.raw', 'Raw data', rawData);

// Summary tier: Evicted second
await memoryPlugin.storeSummary('data.summary', 'Summarized data', summaryData);

// Findings tier: Evicted last (most important)
await memoryPlugin.storeFindings('data.findings', 'Key findings', findings);
```

---

## InContextMemory (NextGen Plugin)

**InContextMemoryPluginNextGen** is a context plugin that stores key-value pairs **directly in the LLM context** (not just an index like WorkingMemory). This is ideal for small, frequently-updated state that the LLM needs instant access to without retrieval calls.

### Key Difference from WorkingMemory

| Feature | WorkingMemory | InContextMemory |
|---------|---------------|-----------------|
| **Storage** | External (in-memory or file) | Directly in LLM context |
| **Context visibility** | Index only (keys + descriptions) | Full values visible |
| **Access pattern** | Requires `memory_retrieve()` call | Immediate - no retrieval needed |
| **UI display** | No | Yes — `showInUI` flag renders entries in host app sidebar |
| **Best for** | Large data, rarely accessed info | Small state, frequently updated, live dashboards |
| **Default capacity** | 25MB | 20 entries, 4000 tokens |

### Quick Setup

```typescript
import { AgentContextNextGen, InContextMemoryPluginNextGen } from '@everworker/oneringai';

const ctx = AgentContextNextGen.create({
  model: 'gpt-4',
  features: { inContextMemory: true },  // Enables InContextMemoryPluginNextGen
});

// Plugin is automatically registered when feature is enabled
// Access it via the plugin registry
const plugin = ctx.getPlugin('in-context-memory') as InContextMemoryPluginNextGen;
plugin.set('state', 'Current processing state', { step: 1, status: 'active' });
```

### Manual Setup

For more control, you can set up the plugin manually:

```typescript
import { AgentContextNextGen, InContextMemoryPluginNextGen } from '@everworker/oneringai';

const ctx = AgentContextNextGen.create({ model: 'gpt-4' });

// Create and configure plugin
const plugin = new InContextMemoryPluginNextGen({
  maxEntries: 20,
  maxTotalTokens: 4000,
  defaultPriority: 'normal',
  showTimestamps: false,
  headerText: '## Live Context',
});

// Register plugin with context
ctx.registerPlugin(plugin);
```

### Configuration Options

```typescript
interface InContextMemoryConfig {
  /** Maximum number of entries (default: 20) */
  maxEntries?: number;

  /** Maximum total tokens for all entries (default: 4000) */
  maxTotalTokens?: number;

  /** Default priority for new entries (default: 'normal') */
  defaultPriority?: 'low' | 'normal' | 'high' | 'critical';

  /** Whether to show timestamps in output (default: false) */
  showTimestamps?: boolean;

  /** Header text for the context section (default: '## Live Context') */
  headerText?: string;

  /** Callback fired when entries change (set/delete/clear/restore). Debounced at 100ms. */
  onEntriesChanged?: (entries: InContextEntry[]) => void;
}
```

### Available Tools

The LLM has access to three tools for managing in-context memory (values are always visible directly in context, so no `get` tool is needed):

#### context_set

Store or update a key-value pair in the live context:

```typescript
// Tool call from LLM
{
  "name": "context_set",
  "arguments": {
    "key": "current_state",
    "description": "Processing state for current task",
    "value": { "step": 3, "status": "active", "errors": [] },
    "priority": "high",    // optional: low, normal, high, critical
    "showInUI": true        // optional: display in host app sidebar (default: false)
  }
}
```

#### context_delete

Remove an entry to free space:

```typescript
// Tool call from LLM
{
  "name": "context_delete",
  "arguments": {
    "key": "temp_data"
  }
}
// Returns: { "success": true, "existed": true }
```

#### context_list

List all entries with metadata:

```typescript
// Tool call from LLM
{
  "name": "context_list",
  "arguments": {}
}
// Returns: {
//   "entries": [
//     { "key": "current_state", "description": "...", "priority": "high", "showInUI": true, "updatedAt": "2026-01-30T..." },
//     { "key": "user_prefs", "description": "...", "priority": "normal", "showInUI": false, "updatedAt": "2026-01-30T..." }
//   ],
//   "count": 2
// }
```

### Direct API Access

The plugin provides a programmatic API for direct manipulation:

```typescript
const plugin = setupInContextMemory(ctx);

// Store entries
plugin.set('state', 'Current state', { step: 1 });
plugin.set('prefs', 'User preferences', { verbose: true }, 'high');
plugin.set('temp', 'Temporary data', 'xyz', 'low');

// Store with UI display (5th argument)
plugin.set('dashboard', 'Live dashboard', '## Status\n- OK', 'normal', true);

// Retrieve
const state = plugin.get('state');        // { step: 1 }
const missing = plugin.get('nonexistent'); // undefined

// Check existence
plugin.has('state');  // true
plugin.has('missing'); // false

// Delete
plugin.delete('temp');  // true (existed and deleted)
plugin.delete('missing'); // false (didn't exist)

// List all entries
const entries = plugin.list();
// [{ key: 'state', description: '...', priority: 'normal', showInUI: false, updatedAt: 1706... }, ...]

// Get entry count
console.log(plugin.size);  // 2

// Clear all
plugin.clear();
```

### Priority-Based Eviction

When space is needed (either due to `maxEntries` or `compact()` being called), entries are evicted in this order:

1. **Priority**: `low` → `normal` → `high` (lowest first)
2. **Age**: Within the same priority, oldest entries (by `updatedAt`) are evicted first
3. **Critical**: Entries with `priority: 'critical'` are **never** auto-evicted

```typescript
// Example: limited to 3 entries
const plugin = setupInContextMemory(ctx, { maxEntries: 3 });

plugin.set('critical1', 'Critical data', 'value', 'critical');
plugin.set('high1', 'High priority', 'value', 'high');
plugin.set('normal1', 'Normal data', 'value', 'normal');
plugin.set('low1', 'Low priority', 'value', 'low');  // Triggers eviction

// 'normal1' is evicted (lowest priority among non-critical)
console.log(plugin.has('critical1')); // true
console.log(plugin.has('high1'));     // true
console.log(plugin.has('low1'));      // true (just added)
console.log(plugin.has('normal1'));   // false (evicted)
```

### Context Output Format

When the LLM context is prepared, InContextMemory adds a formatted section:

```markdown
## Live Context
Data below is always current. Use directly - no retrieval needed.

### current_state
Processing state for current task
```json
{"step": 3, "status": "active", "errors": []}
```

### user_preferences
User preferences for this session
```json
{"theme": "dark", "verbose": true}
```
```

The LLM can read this section directly without making any tool calls.

### UI Display (`showInUI`)

Each InContextMemory entry has an optional `showInUI` boolean flag. When set to `true`, the entry is displayed in the host application's UI (e.g., HOSEA's "Dynamic UI" sidebar panel) with full rich markdown rendering — the same rendering capabilities as the chat window (code blocks, tables, LaTeX math, Mermaid diagrams, Vega-Lite charts, mindmaps, etc.).

This enables agents to create **live dashboards**, **progress displays**, and **structured results** that the user can see at a glance without scrolling through chat history.

#### How It Works

1. **Agent sets `showInUI: true`** via the `context_set` tool (or the direct `set()` API)
2. **Host app receives updates** via the `onEntriesChanged` callback (debounced at 100ms)
3. **Entries render as cards** in the sidebar with markdown-rendered values
4. **Users can pin entries** to always show them, overriding the agent's `showInUI` setting

#### Via Tool (LLM)

```typescript
// Agent creates a visible dashboard entry
{
  "name": "context_set",
  "arguments": {
    "key": "progress",
    "description": "Task progress dashboard",
    "value": "## Research Progress\n\n| Topic | Status |\n|-------|--------|\n| API Design | Done |\n| Implementation | In Progress |\n\n**Next:** Write tests",
    "priority": "high",
    "showInUI": true
  }
}
```

#### Via Direct API

```typescript
// Show a progress dashboard in the UI
plugin.set(
  'progress',
  'Task progress',
  '## Progress\n- [x] Step 1: Research\n- [x] Step 2: Design\n- [ ] Step 3: Implement',
  'high',
  true  // showInUI
);

// Update it later (showInUI persists with the entry)
plugin.set('progress', 'Task progress',
  '## Progress\n- [x] Step 1\n- [x] Step 2\n- [x] Step 3: Implement',
  'high',
  true
);

// Hide from UI
plugin.set('progress', 'Task progress', value, 'high', false);
```

#### Real-Time Updates with `onEntriesChanged`

Host applications can subscribe to entry changes to update their UI in real time:

```typescript
const plugin = new InContextMemoryPluginNextGen({
  maxEntries: 20,
  onEntriesChanged: (entries) => {
    // Called whenever entries are set, deleted, cleared, or restored
    // Debounced at 100ms to avoid excessive updates during batch operations
    const visibleEntries = entries.filter(e => e.showInUI);
    updateSidebarUI(visibleEntries);
  },
});
```

The callback fires on: `set()`, `delete()`, `clear()`, `restoreState()`, and `compact()`.

#### User Pinning

Users can **pin** specific entries to always show them in the UI, regardless of the agent's `showInUI` setting. This is useful when:

- An agent stores useful state but doesn't mark it as `showInUI`
- The user wants to monitor a specific key during a session
- The agent sets `showInUI: false` on an entry the user still wants to see

Pinned keys are persisted per-agent (in HOSEA: `~/.oneringai/agents/<agentId>/ui_config.json`), so they survive app restarts.

#### Rendering

Displayed entries support the **same rich markdown** as the chat window:

- **Code blocks** with syntax highlighting
- **Tables** with alignment
- **LaTeX math** (`$inline$` and `$$block$$`)
- **Mermaid diagrams** (flowcharts, sequence diagrams, etc.)
- **Vega-Lite charts** (bar, line, pie, etc.)
- **Markmap mindmaps**
- **Checklists**, **blockquotes**, **images**, and more

Values that are objects or arrays are automatically rendered as formatted JSON code blocks. Primitive values (numbers, booleans) are rendered as plain text.

### Session Persistence

InContextMemoryPluginNextGen supports full state serialization for session persistence:

```typescript
// Save state
const state = plugin.serialize();
// state = { entries: [...], config: {...} }

// Later, restore state
const newPlugin = new InContextMemoryPluginNextGen();
newPlugin.deserialize(state);
```

When using with `AgentContextNextGen`, the state is automatically included:

```typescript
// AgentContextNextGen automatically serializes plugin state
const ctxState = await ctx.serialize();

// Restore entire context (including InContextMemory)
const newCtx = AgentContextNextGen.create({
  model: 'gpt-4',
  features: { inContextMemory: true },
});
await newCtx.deserialize(ctxState);  // Plugins are restored automatically
```

### Use Cases

**Ideal for:**
- **Current state/status** that changes during task execution
- **User preferences** for the session (theme, verbosity, etc.)
- **Counters and flags** (iteration count, feature flags)
- **Small accumulated results** (running totals, collected IDs)
- **Control variables** (abort flags, mode switches)
- **Live dashboards** (with `showInUI: true`) — progress trackers, status displays, structured results

**Not ideal for (use WorkingMemory instead):**
- Large data (documents, API responses, search results)
- Rarely accessed reference data
- Historical data that doesn't need instant access
- Data that exceeds 4000 tokens

### Best Practices

#### 1. Use Appropriate Priorities

```typescript
// Critical: Never evicted - for essential state
plugin.set('session_id', 'Session identifier', 'sess_123', 'critical');

// High: Kept as long as possible - important state
plugin.set('user_context', 'User context', { name: 'Alice' }, 'high');

// Normal (default): Standard data
plugin.set('current_step', 'Current step', 3);

// Low: Can be evicted - temporary/reconstructable data
plugin.set('last_check', 'Last health check', Date.now(), 'low');
```

#### 2. Keep Values Small

```typescript
// GOOD: Small, focused values
plugin.set('state', 'Task state', { step: 2, status: 'active' });

// BAD: Large objects (use WorkingMemory instead)
plugin.set('results', 'All results', hugeArrayOfResults);  // Don't do this!
```

#### 3. Clean Up When Done

```typescript
// Delete temporary entries when no longer needed
plugin.delete('temp_calculation');
plugin.delete('iteration_data');

// Or use low priority for auto-cleanup
plugin.set('temp', 'Temporary', value, 'low');
```

#### 4. Combine with WorkingMemory

Use both systems for their strengths:

```typescript
// Large data goes to WorkingMemoryPluginNextGen (index-based)
const memoryPlugin = ctx.getPlugin('working-memory') as WorkingMemoryPluginNextGen;
await memoryPlugin.store('search_results', 'Web search results', largeResults);

// Small, frequently-accessed state goes to InContextMemoryPluginNextGen (full values)
const inContextPlugin = ctx.getPlugin('in-context-memory') as InContextMemoryPluginNextGen;
inContextPlugin.set('search_status', 'Search status', { completed: 3, pending: 2 });

// LLM sees:
// - Memory Index: "search_results: Web search results" (needs memory_retrieve)
// - Live Context: Full search_status value (instant access)
```

---

## Persistent Instructions (NextGen Plugin)

**PersistentInstructionsPluginNextGen** is a context plugin that stores agent-level custom instructions on disk as **individually keyed entries**. Unlike InContextMemory (volatile key-value pairs), persistent instructions survive process restarts and are automatically loaded when the agent starts.

### Key Difference from InContextMemory

| Feature | InContextMemory | Persistent Instructions |
|---------|-----------------|------------------------|
| **Storage** | In-memory (volatile) | Disk (persistent JSON) |
| **Survives restarts** | No | Yes |
| **Best for** | Session state, counters, flags | Agent personality, learned rules |
| **LLM can modify** | Yes (context_set) | Yes (instructions_set/remove) |
| **Auto-loaded** | Via session restore | Always on agent start |
| **Default capacity** | 20 entries, 4000 tokens | 50 entries, 50,000 chars total |

### Quick Setup

```typescript
import { Agent } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    agentId: 'my-assistant',  // Used for storage path
    features: {
      persistentInstructions: true,  // Enables PersistentInstructionsPluginNextGen
    },
  },
});

// Plugin is accessible via ctx.getPlugin('persistent_instructions')
// Instructions are automatically loaded from disk on first context prepare
```

### Manual Setup

For more control, you can set up the plugin manually:

```typescript
import { AgentContextNextGen, PersistentInstructionsPluginNextGen } from '@everworker/oneringai';

const ctx = AgentContextNextGen.create({ model: 'gpt-4' });

// Create and configure plugin
const plugin = new PersistentInstructionsPluginNextGen({
  agentId: 'my-assistant',
  maxTotalLength: 100000,  // Characters across all entries, default is 50000
  maxEntries: 50,          // Maximum number of keyed entries, default is 50
});

// Register with context
ctx.registerPlugin(plugin);

// Set instructions programmatically (keyed entries)
await plugin.set('personality', 'Always respond in a friendly tone.');
await plugin.set('formatting', 'Prefer bullet points for lists.');
```

### Configuration Options

```typescript
interface PersistentInstructionsConfig {
  /** Agent ID - used to determine storage path (required) */
  agentId: string;

  /** Custom storage implementation (default: FilePersistentInstructionsStorage) */
  storage?: IPersistentInstructionsStorage;

  /** Maximum total content length across all entries in characters (default: 50000) */
  maxTotalLength?: number;

  /** Maximum number of entries (default: 50) */
  maxEntries?: number;
}
```

### Storage Path

Instructions are stored at:
- **Unix/macOS**: `~/.oneringai/agents/<agentId>/custom_instructions.json`
- **Windows**: `%APPDATA%/oneringai/agents/<agentId>/custom_instructions.json`

The agent ID is sanitized to be filesystem-safe (lowercase, special chars replaced with underscores).

### Available Tools

The LLM has access to four tools for managing persistent instructions:

#### instructions_set

Add or update a single instruction by key:

```typescript
// Tool call from LLM
{
  "name": "instructions_set",
  "arguments": {
    "key": "personality",
    "content": "Always be friendly and helpful. Use clear, simple language."
  }
}
// Returns: { "success": true, "message": "Instruction 'personality' added", "key": "personality", "contentLength": 57 }
```

#### instructions_remove

Remove a single instruction by key:

```typescript
// Tool call from LLM
{
  "name": "instructions_remove",
  "arguments": {
    "key": "personality"
  }
}
// Returns: { "success": true, "message": "Instruction 'personality' removed", "key": "personality" }
```

#### instructions_list

List all instructions with their keys and content:

```typescript
// Tool call from LLM
{
  "name": "instructions_list",
  "arguments": {}
}
// Returns: {
//   "count": 2,
//   "entries": [
//     { "key": "personality", "content": "Always be friendly...", "contentLength": 57, "createdAt": ..., "updatedAt": ... },
//     { "key": "formatting", "content": "Use bullet points...", "contentLength": 35, "createdAt": ..., "updatedAt": ... }
//   ],
//   "agentId": "my-assistant"
// }
```

#### instructions_clear

Remove all instructions (requires confirmation):

```typescript
// Tool call from LLM
{
  "name": "instructions_clear",
  "arguments": {
    "confirm": true  // Must be true, otherwise rejected
  }
}
// Returns: { "success": true, "message": "All custom instructions cleared" }
```

### Direct API Access

The plugin provides a programmatic API for direct manipulation:

```typescript
const plugin = ctx.getPlugin<PersistentInstructionsPluginNextGen>('persistent_instructions')!;

// Add/update entry by key
await plugin.set('personality', 'Always be friendly and helpful.');
await plugin.set('formatting', 'Use bullet points for lists.');

// Get single entry by key
const entry = await plugin.get('personality');  // InstructionEntry | null
// entry = { id: 'personality', content: '...', createdAt: ..., updatedAt: ... }

// Get all entries (sorted by createdAt)
const all = await plugin.get();  // InstructionEntry[] | null

// List metadata for all entries
const list = await plugin.list();
// [{ key: 'personality', contentLength: 35, createdAt: ..., updatedAt: ... }, ...]

// Remove a single entry
await plugin.remove('formatting');  // true if found, false if not

// Clear all
await plugin.clear();
```

### Context Output Format

When the LLM context is prepared, persistent instruction entries are rendered as markdown sections:

```markdown
### personality
Always be friendly and helpful. Use clear, simple language.

### formatting
- Use bullet points for lists
- Keep responses concise

### user_preferences
The user prefers dark mode and verbose explanations.
```

### Session Persistence

PersistentInstructionsPluginNextGen supports state serialization. The state format includes all entries:

```typescript
// State includes all entries
const state = plugin.getState();
// state = { entries: [...], agentId: "my-assistant", version: 2 }

// Restore state (useful for in-memory state sync)
plugin.restoreState(state);
// Also handles legacy format: { content: string | null, agentId: string }
```

### Use Cases

**Ideal for:**
- **Agent personality/behavior** - Tone, style, expertise areas
- **User preferences** - Formatting, verbosity, topics of interest
- **Learned rules** - Patterns discovered during conversation
- **Tool usage guidelines** - When to use specific tools
- **Custom instructions** - Domain-specific knowledge

**Example: Building a Learning Assistant**

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  systemPrompt: `You are a learning assistant. When the user expresses preferences or
gives feedback about your responses, use instructions_set to remember them for
future sessions. Use descriptive keys like "user_preferences", "response_style", etc.
Review your instructions with instructions_list at the start of each conversation.`,
  context: {
    agentId: 'learning-assistant',
    features: { persistentInstructions: true },
  },
});

// User: "I prefer when you explain things with analogies"
// Agent calls: instructions_set({ key: "response_style", content: "Explain concepts using analogies when possible" })
// Next session, agent sees this in context automatically
```

### Best Practices

#### 1. Use Descriptive Keys

```typescript
// GOOD: Descriptive, categorical keys
await plugin.set('personality', 'Be friendly and approachable');
await plugin.set('formatting_rules', 'Use bullet points for lists');
await plugin.set('domain_knowledge', 'User works in fintech');

// AVOID: Generic or numbered keys
await plugin.set('rule1', '...');  // Not descriptive
await plugin.set('misc', '...');   // Too vague
```

#### 2. One Concern Per Entry

```typescript
// GOOD: Each entry covers one topic
await plugin.set('tone', 'Use formal language');
await plugin.set('code_style', 'Use TypeScript, follow existing patterns');
await plugin.set('response_length', 'Keep responses concise, 2-3 paragraphs max');

// AVOID: Mixing concerns in one entry
await plugin.set('rules', 'Be formal. Use TypeScript. Keep it short.');
```

#### 3. Combine with InContextMemory

Use both systems for their strengths:

```typescript
// Persistent instructions for long-term knowledge
// - Agent personality
// - User preferences
// - Learned rules

// InContextMemory for session-specific state
// - Current task progress
// - Temporary flags
// - Running totals
```

#### 4. Set Reasonable Limits

```typescript
// For simple agents
const agent = Agent.create({
  context: {
    features: { persistentInstructions: true },
    plugins: { persistentInstructions: { maxTotalLength: 10000, maxEntries: 20 } },
  },
});

// For complex agents with lots of learned rules
const agent = Agent.create({
  context: {
    features: { persistentInstructions: true },
    plugins: { persistentInstructions: { maxTotalLength: 100000, maxEntries: 100 } },
  },
});
```

### Upgrade Guide (from single-string to KVP)

If upgrading from the previous single-string persistent instructions:

1. **File storage**: Auto-migrated. Legacy `custom_instructions.md` files are read as a single `legacy_instructions` entry and converted to `custom_instructions.json` on next save. No action needed.
2. **Custom storage backends**: Update `load()` to return `InstructionEntry[] | null` and `save()` to accept `InstructionEntry[]` instead of `string`.
3. **Tool API**: `instructions_append` is removed — use `instructions_set(key, content)` to add new entries. `instructions_get` is removed — use `instructions_list()` to see all entries.
4. **Programmatic API**: `plugin.set(content)` → `plugin.set(key, content)`. `plugin.append(section)` → `plugin.set(newKey, section)`. `plugin.get()` now returns `InstructionEntry[] | null` (or a single `InstructionEntry` when called with a key).
5. **Session state**: Existing saved sessions with old format (`{ content: string | null }`) are auto-migrated on `restoreState()`.

---

## Tool Result Eviction (NEW)

**Tool Result Eviction** is a context plugin that automatically evicts old tool results from the conversation history to WorkingMemory. This frees up context space for new content while preserving the ability to retrieve evicted results when needed.

### Key Benefits

| Problem | Solution |
|---------|----------|
| **Context Overflow** | Old tool results are automatically moved to memory |
| **Lost Data** | Evicted results remain retrievable via `memory_retrieve` |
| **Manual Management** | Automatic eviction based on age, size, and count |
| **Tool Pair Integrity** | Both `tool_use` AND `tool_result` messages are evicted together |

### How It Works

1. **Tracking**: When a tool returns a result, the plugin tracks it with metadata (size, age, tool name)
2. **Iteration Counting**: Each agent loop iteration advances the counter
3. **Eviction Triggers**:
   - **Count**: More than `maxFullResults` results tracked (default: 5)
   - **Size**: Total tracked size exceeds `maxTotalSizeBytes` (default: 100KB)
   - **Age**: Results older than `maxAgeIterations` (default: 3)
4. **Storage**: Evicted results are stored in WorkingMemory's raw tier
5. **Removal**: Both `tool_use` and `tool_result` messages are removed from conversation

### Quick Setup

Tool Result Eviction is **enabled by default** when memory is enabled:

```typescript
import { Agent } from '@everworker/oneringai';

// Enabled by default
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
});

// Access the plugin
const plugin = agent.context.toolResultEvictionPlugin;
console.log(plugin?.getStats());
// { count: 0, totalSizeBytes: 0, oldestAge: 0, currentIteration: 0, totalEvicted: 0, totalTokensFreed: 0 }
```

### Configuration

```typescript
import { Agent } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    toolResultEviction: {
      // Maximum number of tool result pairs to keep in conversation
      maxFullResults: 5,  // default: 5

      // Maximum age in iterations before eviction
      maxAgeIterations: 3,  // default: 3

      // Minimum size (bytes) for a result to be eligible for eviction
      minSizeToEvict: 1024,  // default: 1KB

      // Maximum total size of tracked results before triggering eviction
      maxTotalSizeBytes: 100 * 1024,  // default: 100KB

      // Per-tool iteration retention overrides
      toolRetention: {
        read_file: 10,    // Keep file content longer (often referenced)
        bash: 8,          // Keep shell output longer
        grep: 8,          // Keep search results longer
        web_fetch: 3,     // Short retention (can re-fetch)
      },

      // Key prefix for evicted results in memory
      keyPrefix: 'tool_result',  // default: 'tool_result'
    },
  },
});
```

### Default Tool Retention

Different tools have different default retention values based on typical usage patterns:

| Tool | Default Retention | Reason |
|------|-------------------|--------|
| `read_file` | 10 iterations | Often referenced later |
| `bash` | 8 iterations | Shell output often needed for debugging |
| `grep` | 8 iterations | Search results referenced multiple times |
| `glob` | 6 iterations | File lists useful for planning |
| `edit_file` | 6 iterations | Edit context important |
| `memory_retrieve` | 5 iterations | Retrieved data may be re-used |
| `list_directory` | 5 iterations | Directory listings for navigation |
| `web_fetch` | 3 iterations | Can re-fetch if needed |
| (other tools) | 3 iterations | Default retention |

### Evicted Results Storage

Evicted results are stored in WorkingMemory with the key format:

```
tool_result.{toolName}.{toolUseId}
```

For example: `tool_result.read_file.call_abc123`

### Retrieving Evicted Results

The agent can retrieve evicted results using the standard memory tools:

```typescript
// Agent can use memory_retrieve to get evicted results
// Tool call from LLM:
{
  "name": "memory_retrieve",
  "arguments": {
    "key": "raw.tool_result.read_file.call_abc123"
  }
}

// Or use memory_query to find all evicted results
{
  "name": "memory_query",
  "arguments": {
    "pattern": "raw.tool_result.*",
    "includeValues": true
  }
}
```

### Plugin API

```typescript
const plugin = agent.context.toolResultEvictionPlugin;

// Get statistics
const stats = plugin.getStats();
// { count, totalSizeBytes, oldestAge, currentIteration, totalEvicted, totalTokensFreed }

// Get all tracked results
const tracked = plugin.getTracked();
// [{ toolUseId, toolName, result, sizeBytes, addedAtIteration, messageIndex, timestamp }, ...]

// Check if a specific result is tracked
plugin.isTracked('call_abc123');  // true/false

// Get tracked result info
plugin.getTrackedResult('call_abc123');  // TrackedResult | undefined

// Get current iteration
plugin.getCurrentIteration();  // number

// Manual eviction (usually automatic)
const result = await plugin.evictOldResults();
// { evicted: 2, tokensFreed: 1500, memoryKeys: ['tool_result.read_file.call_xyz', ...], log: [...] }
```

### Events

```typescript
const plugin = agent.context.toolResultEvictionPlugin;

// When a result is tracked
plugin.on('tracked', ({ toolUseId, toolName, sizeBytes }) => {
  console.log(`Tracked ${toolName} result: ${sizeBytes} bytes`);
});

// When results are evicted
plugin.on('evicted', ({ count, tokensFreed, keys }) => {
  console.log(`Evicted ${count} results, freed ${tokensFreed} tokens`);
  console.log(`Memory keys: ${keys.join(', ')}`);
});

// When iteration advances
plugin.on('iteration', ({ current }) => {
  console.log(`Iteration ${current}`);
});
```

### Disabling Tool Result Eviction

```typescript
// Disable for a specific agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    features: {
      toolResultEviction: false,  // Disable
    },
  },
});

// Note: If you disable memory, you must also disable toolResultEviction
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    features: {
      memory: false,
      autoSpill: false,
      toolResultEviction: false,  // Required when memory is disabled
    },
  },
});
```

### Best Practices

#### 1. Let Defaults Work

The default settings are tuned for typical agentic workflows:

```typescript
// Usually just use defaults
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  // toolResultEviction is on by default with sensible settings
});
```

#### 2. Tune Retention for Your Use Case

```typescript
// Research agent - keep web content shorter, file content longer
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    toolResultEviction: {
      toolRetention: {
        web_fetch: 2,      // Very short for web content
        read_file: 15,     // Keep file content much longer
        grep: 12,
      },
    },
  },
});

// Coding agent - keep all developer tool output longer
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    toolResultEviction: {
      maxAgeIterations: 5,  // Keep everything longer
      toolRetention: {
        read_file: 20,
        bash: 15,
        grep: 15,
        edit_file: 12,
      },
    },
  },
});
```

#### 3. Monitor Eviction

```typescript
agent.context.toolResultEvictionPlugin?.on('evicted', ({ count, tokensFreed }) => {
  console.log(`[ToolResultEviction] Evicted ${count} results, freed ${tokensFreed} tokens`);
});
```

#### 4. Combine with AutoSpill

Tool Result Eviction and AutoSpill complement each other:

- **AutoSpill**: Immediately spills large outputs (>10KB) to memory with a reference
- **Tool Result Eviction**: Evicts old tool results after N iterations

Both are enabled by default and work together automatically.

---

## Direct LLM Access

Agent inherits `runDirect()` and `streamDirect()` methods from BaseAgent. These methods bypass all context management for simple, stateless LLM calls.

### When to Use Direct Access

| Use Case | Recommended Method |
|----------|-------------------|
| Conversational agent with history | `run()` / `chat()` |
| Task with memory and tools | `run()` with context features |
| Quick one-off query | `runDirect()` |
| Embedding-like simplicity | `runDirect()` |
| Testing/debugging | `runDirect()` |
| Hybrid workflows | Mix both |

### Basic Usage

```typescript
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });

// Direct call - bypasses all context management
const response = await agent.runDirect('What is 2 + 2?');
console.log(response.output_text);  // "4"

// Conversation is NOT affected
console.log(agent.context.getConversation().length);  // 0
```

### DirectCallOptions

```typescript
interface DirectCallOptions {
  /** System instructions */
  instructions?: string;

  /** Include registered tools (default: false) */
  includeTools?: boolean;

  /** Temperature for generation */
  temperature?: number;

  /** Maximum output tokens */
  maxOutputTokens?: number;

  /** Response format */
  responseFormat?: {
    type: 'text' | 'json_object' | 'json_schema';
    json_schema?: unknown;
  };

  /** Vendor-specific options */
  vendorOptions?: Record<string, unknown>;
}
```

### Examples

```typescript
// With options
const response = await agent.runDirect('Summarize this text', {
  instructions: 'Be concise. Use bullet points.',
  temperature: 0.5,
  maxOutputTokens: 200,
});

// JSON response
const response = await agent.runDirect('List 3 fruits', {
  responseFormat: { type: 'json_object' },
  instructions: 'Return a JSON array of fruit names',
});

// Multimodal (text + image)
const response = await agent.runDirect([
  {
    type: 'message',
    role: 'user',
    content: [
      { type: 'input_text', text: 'What is in this image?' },
      { type: 'input_image', image_url: 'https://example.com/image.png' }
    ]
  }
]);

// With tools (single call - you handle tool calls manually)
const response = await agent.runDirect('Get the weather in Paris', {
  includeTools: true,
});
// If response contains tool_calls, you must execute them yourself
if (response.output.some(item => item.type === 'function_call')) {
  // Handle tool calls manually
}
```

### Streaming

```typescript
// Stream responses for real-time output
for await (const event of agent.streamDirect('Tell me a story')) {
  if (event.type === 'output_text_delta') {
    process.stdout.write(event.delta);
  }
}

// With options
for await (const event of agent.streamDirect('Explain quantum computing', {
  instructions: 'Use simple terms',
  temperature: 0.7,
})) {
  // Handle events...
}
```

### Comparison: run() vs runDirect()

| Aspect | `run()` / `chat()` | `runDirect()` |
|--------|-------------------|---------------|
| History tracking | ✅ Automatic | ❌ None |
| WorkingMemory | ✅ Available | ❌ Not used |
| IdempotencyCache | ✅ Caches tool results | ❌ Not used |
| Context preparation | ✅ Full preparation | ❌ None |
| Agentic loop | ✅ Executes tools automatically | ❌ Single call only |
| Compaction | ✅ Auto-compacts when needed | ❌ None |
| Overhead | Full context management | Minimal |

### Hybrid Workflows

You can mix both approaches in the same agent:

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, searchTool],
});

// Use run() for complex interactions with tool use
await agent.run('Search for the latest news and summarize');

// Use runDirect() for quick follow-ups that don't need context
const clarification = await agent.runDirect(
  'What is a good synonym for "excellent"?',
  { temperature: 0.3 }
);

// Back to run() for continued conversation
await agent.run('Now tell me more about the first item');
```

---

## Tools & Function Calling

### Defining Tools

```typescript
import { ToolFunction } from '@everworker/oneringai';

const weatherTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name, e.g., "San Francisco"',
          },
          units: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'Temperature units',
          },
        },
        required: ['location'],
      },
    },
  },
  execute: async (args) => {
    // Your implementation
    const { location, units = 'fahrenheit' } = args;

    // Call weather API
    const temp = 72; // Example

    return {
      location,
      temperature: temp,
      units,
      conditions: 'sunny',
    };
  },
};
```

### Using Tools

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, calculatorTool, searchTool],
});

const response = await agent.run('What is the weather in Paris?');

// Agent will:
// 1. Recognize it needs weather data
// 2. Call weatherTool with { location: "Paris" }
// 3. Receive result
// 4. Generate natural language response

console.log(response.output_text);
// "The current weather in Paris is 72°F and sunny."
```

### Tool Management

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [tool1, tool2],
});

// Add a tool
agent.addTool(newTool);

// Remove a tool
agent.removeTool('tool_name');

// Replace all tools
agent.setTools([tool1, tool2, tool3]);

// List available tools
const toolNames = agent.listTools();
console.log(toolNames); // ['get_weather', 'calculate', 'search']
```

### Tool Execution Context

Tools receive a context object with useful information:

```typescript
const myTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'my_tool',
      description: 'Example tool',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string' },
        },
        required: ['input'],
      },
    },
  },
  execute: async (args, context) => {
    // Identity context (auto-populated from agent config):
    console.log(context?.agentId);  // Agent identifier
    console.log(context?.userId);   // User ID (if set via agent.userId or config)

    // Working memory access (when workingMemory feature is enabled):
    if (context?.memory) {
      const data = await context.memory.get('some_key');
    }

    // Cancellation support:
    if (context?.signal?.aborted) {
      return { error: 'Cancelled' };
    }

    return { result: 'done' };
  },
};
```

### Built-in Tools Overview

The library ships with 27+ built-in tools across 7 categories:

| Category | Tools | Description |
|----------|-------|-------------|
| **Memory** | `memory_store`, `memory_retrieve`, `memory_delete`, `memory_list` | Working memory for agents (auto-registered when feature enabled) |
| **In-Context Memory** | `context_set`, `context_delete`, `context_list` | Key-value store visible directly in context (auto-registered) |
| **Persistent Instructions** | `instructions_set`, `instructions_remove`, `instructions_list`, `instructions_clear` | Cross-session agent instructions (auto-registered) |
| **Filesystem** | `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `list_directory` | Local file operations |
| **Shell** | `bash` | Shell command execution with safety guards |
| **Web** | `webFetch` (built-in), `web_search` / `web_scrape` (ConnectorTools) | Web content retrieval, search, and scraping |
| **Code** | `executeJavaScript` | Sandboxed JavaScript execution |
| **JSON** | `jsonManipulator` | JSON object manipulation (add, delete, replace fields) |
| **GitHub** | `search_files`, `search_code`, `read_file`, `get_pr`, `pr_files`, `pr_comments`, `create_pr` | GitHub API operations (auto-registered for GitHub connectors) |
| **Multimedia** | `generate_image`, `generate_video`, `text_to_speech`, `speech_to_text` | Media generation (auto-registered for AI vendor connectors) |

Memory, In-Context Memory, and Persistent Instructions tools are documented in their respective sections above. Multimedia tools are documented in the Audio, Image, and Video sections. The rest are documented below.

#### Memory Tools

Available when `workingMemory` feature is enabled:

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: { features: { workingMemory: true } },
});

// The LLM can use these tools automatically:
// - memory_store: Store key-value pair
// - memory_retrieve: Retrieve value by key
// - memory_delete: Delete entry
// - memory_list: List all entries

// Programmatic access:
const memory = agent.context.memory;
await memory.store('user.profile', 'User profile', { name: 'Alice' }, 'high');
const profile = await memory.retrieve('user.profile');
```

#### In-Context Memory Tools

Available when `inContextMemory` feature is enabled:

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: { features: { inContextMemory: true } },
});

// The LLM can use these tools automatically:
// - context_set: Store/update entry (appears directly in context; set showInUI: true to display in sidebar)
// - context_delete: Remove entry
// - context_list: List all entries (includes showInUI status)
```

#### Context Budget

Access context budget information via `prepare()`:

```typescript
const { input, budget } = await agent.context.prepare();

console.log(budget);
// {
//   maxTokens: 128000,
//   totalUsed: 45000,
//   available: 63800,
//   utilizationPercent: 35.2,
//   breakdown: {
//     systemPrompt: 500,
//     pluginInstructions: 800,
//     conversation: 38000,
//     currentInput: 200,
//   }
// }
```

### Code Execution Tool

```typescript
import { createExecuteJavaScriptTool } from '@everworker/oneringai';

const jsTool = createExecuteJavaScriptTool();

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [jsTool],
});

const response = await agent.run('Calculate the sum of numbers from 1 to 100');

// Agent will:
// 1. Generate JavaScript code
// 2. Execute: executeJavaScript({ code: 'Array(100).fill(0).map((_, i) => i+1).reduce((a,b) => a+b)' })
// 3. Return result: 5050
```

### Developer Tools (Filesystem & Shell)

A comprehensive set of tools for file system operations and shell command execution, inspired by Claude Code. Perfect for building coding assistants, DevOps agents, or any agent that needs to interact with the local filesystem.

#### Quick Start

```typescript
import { developerTools } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: developerTools, // All 7 tools included
});

// Agent can now read, write, edit files, search, and run commands
await agent.run('Read the package.json and tell me the version');
```

#### Individual Tools

You can also import and configure tools individually:

```typescript
import {
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createGlobTool,
  createGrepTool,
  createListDirectoryTool,
  createBashTool,
} from '@everworker/oneringai';

// Create tools with custom configuration
const readFile = createReadFileTool({
  workingDirectory: '/path/to/project',
  maxFileSize: 5 * 1024 * 1024, // 5MB
});

const bash = createBashTool({
  workingDirectory: '/path/to/project',
  defaultTimeout: 60000, // 1 minute
  allowBackground: true,
});
```

#### Filesystem Tools

##### read_file

Read file contents with line numbers.

```typescript
read_file({
  file_path: '/path/to/file.ts',
  offset: 50,    // Start at line 50 (optional)
  limit: 100,    // Read 100 lines (optional)
});
// Returns: { success: true, content: "1\tconst x = 1;...", lines: 100 }
```

##### write_file

Create or overwrite files. Automatically creates parent directories.

```typescript
write_file({
  file_path: '/path/to/new/file.ts',
  content: 'export const hello = "world";',
});
// Returns: { success: true, created: true, bytesWritten: 29 }
```

##### edit_file

Surgical find-and-replace edits. Ensures uniqueness to prevent unintended changes.

```typescript
edit_file({
  file_path: '/path/to/file.ts',
  old_string: 'const x = 1;',
  new_string: 'const x = 42;',
  replace_all: false, // Fails if old_string is not unique (default)
});
// Returns: { success: true, replacements: 1 }
```

##### glob

Find files by pattern.

```typescript
glob({
  pattern: '**/*.ts',
  path: '/path/to/project', // Optional, defaults to cwd
});
// Returns: { success: true, files: ['src/index.ts', 'src/utils.ts', ...], count: 15 }
```

##### grep

Search file contents with regex.

```typescript
grep({
  pattern: 'function\\s+\\w+',
  path: '/path/to/project',
  type: 'ts',                      // Filter by file type
  output_mode: 'content',          // 'content', 'files_with_matches', 'count'
  case_insensitive: true,
  context_before: 2,               // Lines before match
  context_after: 2,                // Lines after match
});
// Returns: { success: true, matches: [...], filesMatched: 5, totalMatches: 23 }
```

##### list_directory

List directory contents with metadata.

```typescript
list_directory({
  path: '/path/to/project',
  recursive: true,
  filter: 'files',     // 'files' or 'directories'
  max_depth: 3,
});
// Returns: { success: true, entries: [...], count: 42 }
```

#### Shell Tool

##### bash

Execute shell commands with timeout and safety features.

```typescript
bash({
  command: 'npm install',
  timeout: 300000,        // 5 minutes
  description: 'Install dependencies',
  run_in_background: false,
});
// Returns: { success: true, stdout: '...', exitCode: 0, duration: 5234 }
```

**Safety Features:**
- Blocks dangerous commands (`rm -rf /`, fork bombs, etc.)
- Configurable timeout (default 2 min, max 10 min)
- Output truncation for large outputs
- Background execution support

**Blocked Commands:**
- `rm -rf /` and `rm -rf /*`
- Fork bombs (`:(){:|:&};:`)
- `/dev/sda` writes
- Dangerous git operations

#### Configuration Options

All filesystem tools share common configuration:

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

Shell tool configuration:

```typescript
interface ShellToolConfig {
  workingDirectory?: string;       // Working directory
  defaultTimeout?: number;         // Default timeout (default: 120000ms)
  maxTimeout?: number;             // Max timeout (default: 600000ms)
  maxOutputSize?: number;          // Max output size (default: 100KB)
  allowBackground?: boolean;       // Allow background execution (default: false)
  shell?: string;                  // Shell to use (default: /bin/bash)
  env?: Record<string, string>;    // Environment variables
}
```

#### Best Practices

1. **Use edit_file for code changes** - Never rewrite entire files; use surgical edits
2. **Prefer glob over bash find** - More efficient and safer
3. **Prefer grep over bash grep** - Better output formatting and safety
4. **Set working directory** - Restrict operations to project directory
5. **Configure blockedDirectories** - Prevent accidental access to sensitive directories

### Web Tools

Tools for fetching web content, searching the web, and scraping pages. These are standalone tools (not connector-dependent).

#### webFetch

Fetch and process web content. Converts HTML to markdown for easy consumption by LLMs.

```typescript
import { webFetch } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [webFetch],
});

await agent.run('Fetch https://example.com and summarize it');
```

**Parameters:**
- `url` (required) — URL to fetch
- `prompt` — What to extract from the page
- `format` — Output format: `"markdown"` (default) or `"text"`

#### web_search (ConnectorTools)

Web search via ConnectorTools pattern. Create a connector with a search service type, then use `ConnectorTools.for()` to get the tools.

**Supported service types:** `serper`, `brave-search`, `tavily`, `rapidapi-search`

```typescript
import { Connector, ConnectorTools, Agent, tools } from '@everworker/oneringai';

// Create a search connector
Connector.create({
  name: 'serper',
  serviceType: 'serper',
  auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY! },
  baseURL: 'https://google.serper.dev',
});

// Get search tools from the connector
const searchTools = ConnectorTools.for('serper');

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [tools.webFetch, ...searchTools],
});

await agent.run('Search for the latest Node.js release');
```

**Parameters:**
- `query` (required) — Search query
- `numResults` — Number of results (default: 10)
- `country` — Country/region code (e.g., "us", "gb")
- `language` — Language code (e.g., "en", "fr")

#### web_scrape (ConnectorTools)

Web scraping via ConnectorTools pattern. Tries native fetch first, falls back to the bound scrape provider.

**Supported service types:** `zenrows`, `jina-reader`, `firecrawl`, `scrapingbee`

```typescript
import { Connector, ConnectorTools } from '@everworker/oneringai';

Connector.create({
  name: 'zenrows',
  serviceType: 'zenrows',
  auth: { type: 'api_key', apiKey: process.env.ZENROWS_API_KEY! },
  baseURL: 'https://api.zenrows.com',
});

const scrapeTools = ConnectorTools.for('zenrows');
```

**Parameters:**
- `url` (required) — URL to scrape
- `includeMarkdown` — Convert to markdown
- `includeLinks` — Extract links
- `includeHtml` — Include raw HTML
- `waitForSelector` — CSS selector to wait for
- `timeout` — Timeout in milliseconds

### JSON Tool

#### jsonManipulator

Manipulate JSON objects — add, delete, or replace fields.

```typescript
import { jsonManipulator } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [jsonManipulator],
});

await agent.run('Add a "version" field set to "2.0" to this JSON: {"name": "app"}');
```

**Parameters:**
- `json` (required) — JSON string to manipulate
- `operation` (required) — `"add"`, `"delete"`, or `"replace"`
- `path` (required) — JSON path (dot notation, e.g., `"config.debug"`)
- `value` — Value for add/replace operations

### GitHub Connector Tools

When a GitHub connector is configured, `ConnectorTools.for('github')` automatically includes 7 dedicated tools alongside the generic API tool. These mirror the local filesystem tools for remote GitHub repositories.

#### Quick Start

```typescript
import { Connector, ConnectorTools, Services, Agent } from '@everworker/oneringai';

// Create a GitHub connector
Connector.create({
  name: 'github',
  serviceType: Services.Github,
  auth: { type: 'api_key', apiKey: process.env.GITHUB_TOKEN! },
  baseURL: 'https://api.github.com',
  options: {
    defaultRepository: 'myorg/myrepo', // Optional: default repo for all tools
  },
});

// Get all GitHub tools (generic API + 7 dedicated tools)
const tools = ConnectorTools.for('github');

// Use with an agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: tools,
});

// Agent can now search files, read code, analyze PRs, and create PRs
await agent.run('Find all TypeScript files in src/ and show me the main entry point');
await agent.run('Show me PR #42 and summarize the changes');
```

#### Repository Resolution

All GitHub tools accept an optional `repository` parameter. Resolution order:

1. **Explicit parameter**: `{ "repository": "owner/repo" }` or `{ "repository": "https://github.com/owner/repo" }`
2. **Connector default**: `connector.options.defaultRepository`
3. **Error**: If neither is available

This means you can configure a default repo once on the connector and all tools use it automatically.

#### search_files

Search for files by glob pattern in a repository. Mirrors the local `glob` tool.

```typescript
// Find TypeScript files
{ "pattern": "**/*.ts" }

// Search in specific path
{ "pattern": "src/components/**/*.tsx", "repository": "facebook/react" }

// Search specific branch
{ "pattern": "**/*.test.ts", "ref": "develop" }
```

**Parameters:**
- `repository` — Repository in `"owner/repo"` format or GitHub URL (optional if connector has default)
- `pattern` (required) — Glob pattern (`**/*.ts`, `src/**/*.tsx`, etc.)
- `ref` — Branch, tag, or commit SHA (defaults to default branch)

**Returns:** `{ files: [{ path, size, type }], count, truncated }`

#### search_code

Search code content across a repository. Mirrors the local `grep` tool.

```typescript
// Find function usage
{ "query": "handleAuth", "language": "typescript" }

// Search in specific path
{ "query": "TODO", "path": "src/utils", "extension": "ts" }
```

**Parameters:**
- `repository` — Repository (optional)
- `query` (required) — Search term
- `language` — Filter by language (`"typescript"`, `"python"`, etc.)
- `path` — Filter by path prefix (`"src/"`)
- `extension` — Filter by extension (`"ts"`, `"py"`)
- `limit` — Max results (default: 30, max: 100)

**Returns:** `{ matches: [{ file, fragment }], count, truncated }`

> **Note:** GitHub's code search API is rate-limited to 30 requests per minute.

#### read_file (GitHub)

Read file content from a repository with line range support. Mirrors the local `read_file` tool.

```typescript
// Read entire file
{ "path": "src/index.ts" }

// Read specific lines
{ "path": "src/app.ts", "offset": 100, "limit": 50 }

// Read from specific branch
{ "path": "README.md", "ref": "develop" }
```

**Parameters:**
- `repository` — Repository (optional)
- `path` (required) — File path within the repo
- `ref` — Branch, tag, or SHA
- `offset` — Start line (1-indexed)
- `limit` — Number of lines (default: 2000)

**Returns:** `{ content: "1\tline one\n2\tline two...", lines, size, truncated, sha }`

Output is formatted with line numbers matching the local `read_file` format. Files larger than 1MB are automatically fetched via the Git Blob API.

#### get_pr

Get full details of a pull request.

```typescript
{ "pull_number": 42 }
{ "pull_number": 42, "repository": "owner/repo" }
```

**Parameters:**
- `repository` — Repository (optional)
- `pull_number` (required) — PR number

**Returns:** `{ data: { number, title, body, state, draft, author, labels, reviewers, mergeable, head, base, url, created_at, updated_at, additions, deletions, changed_files } }`

#### pr_files

Get files changed in a PR with diffs.

```typescript
{ "pull_number": 42 }
```

**Parameters:**
- `repository` — Repository (optional)
- `pull_number` (required) — PR number

**Returns:** `{ files: [{ filename, status, additions, deletions, changes, patch }], count }`

The `status` field is one of: `added`, `modified`, `removed`, `renamed`. The `patch` field contains the unified diff.

#### pr_comments

Get all comments and reviews on a PR, merged from three GitHub API endpoints into a unified format.

```typescript
{ "pull_number": 42 }
```

**Parameters:**
- `repository` — Repository (optional)
- `pull_number` (required) — PR number

**Returns:** `{ comments: [{ id, type, author, body, created_at, path?, line?, state? }], count }`

Comment types:
- `review_comment` — Line-level comments on code (includes `path` and `line`)
- `review` — Full reviews (approve/request changes/comment, includes `state`)
- `comment` — General PR comments

All entries are sorted by creation date (oldest first).

#### create_pr

Create a pull request.

```typescript
// Basic PR
{ "title": "Add feature", "head": "feature-branch", "base": "main" }

// Draft PR with description
{
  "title": "WIP: Refactor auth",
  "body": "## Changes\n- Refactored auth flow\n- Added tests",
  "head": "refactor/auth",
  "base": "main",
  "draft": true
}
```

**Parameters:**
- `repository` — Repository (optional)
- `title` (required) — PR title
- `body` — PR description (Markdown supported)
- `head` (required) — Source branch name
- `base` (required) — Target branch name
- `draft` — Create as draft (default: false)

**Returns:** `{ data: { number, url, state, title } }`

> **Permission:** This tool has `riskLevel: 'medium'` since it creates external state.

#### Using Individual GitHub Tool Factories

You can also create GitHub tools individually for custom setups:

```typescript
import {
  createSearchFilesTool,
  createSearchCodeTool,
  createGitHubReadFileTool,
  createGetPRTool,
  createPRFilesTool,
  createPRCommentsTool,
  createCreatePRTool,
  parseRepository,
} from '@everworker/oneringai';

// Create individual tools from a connector
const connector = Connector.get('github');
const searchFiles = createSearchFilesTool(connector);
const readFile = createGitHubReadFileTool(connector);

// Use parseRepository for URL resolution
const { owner, repo } = parseRepository('https://github.com/facebook/react');
```

---

## Dynamic Tool Management

Control tools at runtime for all agent types. Enable, disable, organize, and select tools dynamically.

### Unified Tool Management Architecture

**AgentContextNextGen is the single source of truth** for ToolManager. All agents access tools through a single ToolManager instance owned by the context:

- `agent.tools === agent.context.tools` - Same ToolManager instance
- Tool changes via either API are immediately reflected in the other
- No duplicate tool storage or sync issues

### Quick Start

```typescript
import { Agent } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, emailTool, databaseTool],
});

// UNIFIED: agent.tools and agent.context.tools are the SAME instance
console.log(agent.tools === agent.context.tools);  // true

// Disable tool temporarily
agent.tools.disable('database_tool');

// Changes via agent.context.tools are immediately reflected
agent.context.tools.enable('database_tool');
console.log(agent.tools.listEnabled().includes('database_tool'));  // true

// Run without database access
agent.tools.disable('database_tool');
await agent.run('Check weather and email me');

// Re-enable later
agent.tools.enable('database_tool');
```

### ToolManager API

Every agent has a `tools` property that returns the ToolManager owned by the context. Both `agent.tools` and `agent.context.tools` return the same instance:

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [tool1, tool2],
});

// UNIFIED: Both access paths return the same ToolManager instance
console.log(agent.tools === agent.context.tools);  // true

// Access ToolManager via either path
const toolManager = agent.tools;
// OR: const toolManager = agent.context.tools;  // Same instance!

// Register new tool
toolManager.register(tool3, {
  namespace: 'data',
  priority: 10,
  enabled: true,
});

// Unregister tool
toolManager.unregister('tool_name');

// Enable/disable
toolManager.enable('tool_name');
toolManager.disable('tool_name');

// Check if enabled
const isEnabled = toolManager.isEnabled('tool_name');

// List tools
const all = toolManager.list();           // All tools
const enabled = toolManager.listEnabled(); // Only enabled
```

### Tool Options

```typescript
interface ToolOptions {
  /** Namespace for organizing tools */
  namespace?: string;

  /** Priority for selection (higher = preferred) */
  priority?: number;

  /** Initial enabled state */
  enabled?: boolean;

  /** Condition function for context-aware enabling */
  condition?: (context: ToolSelectionContext) => boolean;

  /** Tool metadata */
  metadata?: Record<string, unknown>;
}
```

#### Namespaces

Organize tools by category:

```typescript
// Register tools with namespaces
agent.tools.register(weatherTool, { namespace: 'external-api' });
agent.tools.register(emailTool, { namespace: 'communication' });
agent.tools.register(databaseReadTool, { namespace: 'database' });
agent.tools.register(databaseWriteTool, { namespace: 'database' });

// Disable all database tools
for (const name of agent.tools.list()) {
  const tool = agent.tools.get(name);
  if (tool?.metadata?.namespace === 'database') {
    agent.tools.disable(name);
  }
}
```

#### Priority

Control tool selection order:

```typescript
agent.tools.register(primaryWeatherTool, {
  priority: 100,  // High priority
});

agent.tools.register(fallbackWeatherTool, {
  priority: 10,   // Low priority (fallback)
});

// LLM sees high-priority tools first
```

#### Conditions

Dynamic enabling based on context:

```typescript
agent.tools.register(adminTool, {
  condition: (context) => context.user?.role === 'admin',
});

// Tool only available when condition is met
const selected = agent.tools.selectForContext({
  user: { role: 'admin' },
});
```

### Context-Aware Selection

```typescript
interface ToolSelectionContext {
  /** Current agent mode */
  mode?: 'interactive' | 'planning' | 'executing';

  /** Current task name */
  taskName?: string;

  /** User role/permissions */
  user?: {
    role?: string;
    permissions?: string[];
  };

  /** Environment */
  environment?: 'development' | 'staging' | 'production';

  /** Custom context */
  [key: string]: unknown;
}
```

```typescript
// Select tools based on context
const tools = agent.tools.selectForContext({
  mode: 'executing',
  environment: 'production',
  user: { role: 'admin', permissions: ['write'] },
});

// Only tools matching context are selected
```

### State Persistence

Save and restore tool configuration:

```typescript
// Get current state
const state = agent.tools.getState();

// Save to file
await fs.writeFile('./tool-config.json', JSON.stringify(state));

// Later... load state
const savedState = JSON.parse(await fs.readFile('./tool-config.json', 'utf-8'));
agent.tools.loadState(savedState);

// All tool registrations, priorities, and enabled states restored
```

### Events

Listen to tool changes:

```typescript
agent.tools.on('tool:registered', ({ name, options }) => {
  console.log(`Tool registered: ${name}`);
});

agent.tools.on('tool:unregistered', ({ name }) => {
  console.log(`Tool unregistered: ${name}`);
});

agent.tools.on('tool:enabled', ({ name }) => {
  console.log(`Tool enabled: ${name}`);
});

agent.tools.on('tool:disabled', ({ name }) => {
  console.log(`Tool disabled: ${name}`);
});
```

### Advanced Patterns

#### Environment-Based Tools

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

agent.tools.register(debugTool, {
  enabled: isDevelopment,
  namespace: 'debug',
});

agent.tools.register(productionTool, {
  enabled: !isDevelopment,
  namespace: 'production',
});
```

#### Permission-Based Tools

```typescript
function createAgentWithPermissions(userRole: string) {
  const agent = Agent.create({
    connector: 'openai',
    model: 'gpt-4',
  });

  // Register all tools
  agent.tools.register(readTool, {
    namespace: 'data',
    priority: 100,
  });

  agent.tools.register(writeTool, {
    namespace: 'data',
    priority: 90,
    enabled: userRole === 'admin',  // Only for admins
  });

  agent.tools.register(deleteTool, {
    namespace: 'data',
    priority: 80,
    enabled: userRole === 'super-admin',  // Only for super admins
  });

  return agent;
}
```

#### Rate-Limited Tools

```typescript
class RateLimitedToolManager {
  private calls = new Map<string, number>();
  private limits = new Map<string, number>();

  constructor(private agent: Agent) {}

  registerWithLimit(tool: ToolFunction, limit: number) {
    this.agent.tools.register(tool);
    this.limits.set(tool.definition.function.name, limit);
    this.calls.set(tool.definition.function.name, 0);
  }

  async execute(name: string, args: unknown) {
    const count = this.calls.get(name) || 0;
    const limit = this.limits.get(name);

    if (limit && count >= limit) {
      throw new Error(`Rate limit exceeded for ${name}`);
    }

    this.calls.set(name, count + 1);
    return await this.agent.tools.get(name)?.execute(args);
  }
}
```

#### Dynamic Tool Loading

```typescript
class PluginManager {
  constructor(private agent: Agent) {}

  async loadPlugin(pluginPath: string) {
    const plugin = await import(pluginPath);

    for (const tool of plugin.tools) {
      this.agent.tools.register(tool, {
        namespace: plugin.name,
        metadata: { plugin: plugin.name, version: plugin.version },
      });
    }

    console.log(`Loaded plugin: ${plugin.name}`);
  }

  unloadPlugin(pluginName: string) {
    for (const name of this.agent.tools.list()) {
      const tool = this.agent.tools.get(name);
      if (tool?.metadata?.plugin === pluginName) {
        this.agent.tools.unregister(name);
      }
    }

    console.log(`Unloaded plugin: ${pluginName}`);
  }
}
```

### Backward Compatibility

The old API still works:

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [tool1, tool2],  // Still works!
});

// Old methods still work
agent.addTool(tool3);        // Still works!
agent.removeTool('tool1');   // Still works!
agent.setTools([newTools]);  // Still works!
agent.listTools();           // Still works!

// New API via .tools property
agent.tools.disable('tool2');  // NEW!
agent.tools.enable('tool2');   // NEW!
```

### Best Practices

#### 1. Use Namespaces for Organization

```typescript
// Good
agent.tools.register(githubTool, { namespace: 'github' });
agent.tools.register(slackTool, { namespace: 'slack' });
agent.tools.register(databaseTool, { namespace: 'database' });

// Bad
agent.tools.register(githubTool);  // Hard to organize later
```

#### 2. Set Priorities for Fallbacks

```typescript
// Good
agent.tools.register(primaryAPI, { priority: 100 });
agent.tools.register(fallbackAPI, { priority: 50 });

// Bad - no priority, random selection
agent.tools.register(primaryAPI);
agent.tools.register(fallbackAPI);
```

#### 3. Disable Destructive Tools by Default

```typescript
// Good
agent.tools.register(deleteTool, {
  enabled: false,  // Disabled by default
  namespace: 'destructive',
});

// Enable only when needed
function enableDestructiveMode() {
  agent.tools.enable('delete_tool');
}
```

#### 4. Use Conditions for Complex Logic

```typescript
// Good
agent.tools.register(adminTool, {
  condition: (ctx) => ctx.user?.role === 'admin' && ctx.environment === 'production',
});

// Bad - manual checking everywhere
if (user.role === 'admin') {
  agent.tools.enable('admin_tool');
} else {
  agent.tools.disable('admin_tool');
}
```

#### 5. Persist Tool State for Sessions

```typescript
// Save tool state with session
const toolState = agent.tools.getState();
session.customData = { ...session.customData, toolState };
await sessionManager.save(session);

// Restore tool state
const loaded = await sessionManager.load(sessionId);
if (loaded?.customData?.toolState) {
  agent.tools.loadState(loaded.customData.toolState);
}
```

### Circuit Breaker Protection

ToolManager includes built-in circuit breaker protection for each tool. When a tool fails repeatedly, the circuit breaker prevents further calls to avoid cascading failures.

```typescript
// Get circuit breaker states for all tools
const states = agent.tools.getCircuitBreakerStates();
// Returns: Map<toolName, { state: 'closed' | 'open' | 'half-open', failures: number, lastFailure: Date }>

for (const [toolName, state] of states) {
  console.log(`${toolName}: ${state.state} (${state.failures} failures)`);
}

// Get metrics for a specific tool
const metrics = agent.tools.getToolCircuitBreakerMetrics('risky_tool');
console.log(`Successes: ${metrics.successCount}, Failures: ${metrics.failureCount}`);

// Manually reset a circuit breaker
agent.tools.resetToolCircuitBreaker('risky_tool');
```

**Configure circuit breaker per tool:**

```typescript
agent.tools.setCircuitBreakerConfig('external_api', {
  failureThreshold: 3,     // Open after 3 failures
  successThreshold: 2,     // Close after 2 successes in half-open
  resetTimeoutMs: 60000,   // Try half-open after 60s
  windowMs: 300000,        // Track failures in 5 min window
});
```

**Circuit breaker states:**
- **Closed** (normal) - Tool executes normally
- **Open** (tripped) - Tool calls fail immediately without execution
- **Half-Open** (testing) - One call allowed to test recovery

### Tool Execution

ToolManager implements `IToolExecutor` for direct tool execution:

```typescript
// Execute tool directly (used internally by agentic loop)
const result = await agent.tools.execute('get_weather', { location: 'Paris' });

// Execute returns the tool's result or throws on error
```

---

## Tool Execution Plugins

The Tool Execution Plugin System provides a pluggable architecture for extending tool execution with custom behavior. This enables applications to add logging, analytics, UI updates, permission prompts, caching, or any custom logic to the tool execution lifecycle.

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     ToolManager (existing)                       │
│  - Tool registration                                             │
│  - Tool lookup                                                   │
│  - Circuit breaker per tool                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ToolExecutionPipeline                          │
│  - Orchestrates plugin chain                                     │
│  - Manages execution lifecycle                                   │
│  - Provides execution context                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
    ┌───────────┐       ┌───────────┐       ┌───────────┐
    │  Plugin 1 │       │  Plugin 2 │       │  Plugin N │
    │ (Logging) │       │(Analytics)│       │ (Custom)  │
    └───────────┘       └───────────┘       └───────────┘
```

### Basic Usage

```typescript
import { Agent, LoggingPlugin, type IToolExecutionPlugin } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool],
});

// Add the built-in logging plugin
agent.tools.executionPipeline.use(new LoggingPlugin());

// Now all tool executions will be logged with timing info
const response = await agent.run('What is the weather in Paris?');
```

### Plugin Interface

Every plugin must implement the `IToolExecutionPlugin` interface:

```typescript
interface IToolExecutionPlugin {
  /** Unique plugin name */
  readonly name: string;

  /** Priority (lower = runs earlier in beforeExecute, later in afterExecute). Default: 100 */
  readonly priority?: number;

  /**
   * Called before tool execution.
   * Can modify args, abort execution, or pass through.
   */
  beforeExecute?(ctx: PluginExecutionContext): Promise<BeforeExecuteResult>;

  /**
   * Called after successful tool execution.
   * Can modify the result before returning to caller.
   * Note: Runs in REVERSE priority order for proper unwinding.
   */
  afterExecute?(ctx: PluginExecutionContext, result: unknown): Promise<unknown>;

  /**
   * Called when tool execution fails.
   * Can recover (return a value), re-throw, or transform the error.
   */
  onError?(ctx: PluginExecutionContext, error: Error): Promise<unknown>;

  /** Called when plugin is registered (optional setup) */
  onRegister?(pipeline: IToolExecutionPipeline): void;

  /** Called when plugin is unregistered (optional cleanup) */
  onUnregister?(): void;
}
```

### Execution Context

The `PluginExecutionContext` provides all information about the current tool execution:

```typescript
interface PluginExecutionContext {
  /** Name of the tool being executed */
  toolName: string;

  /** Original arguments (read-only) */
  readonly args: unknown;

  /** Mutable arguments - modify this to change tool input */
  mutableArgs: unknown;

  /** Metadata map for passing data between plugins */
  metadata: Map<string, unknown>;

  /** Timestamp when execution started */
  startTime: number;

  /** The tool function being executed */
  tool: ToolFunction;

  /** Unique ID for this execution (for tracing) */
  executionId: string;
}
```

### BeforeExecute Results

The `beforeExecute` hook can return different values to control execution:

```typescript
type BeforeExecuteResult =
  | void                           // Continue with original args
  | undefined                      // Continue with original args
  | { abort: true; result: unknown } // Abort and return this result
  | { modifiedArgs: unknown };      // Continue with modified args
```

### Creating Custom Plugins

#### Analytics Plugin Example

```typescript
const analyticsPlugin: IToolExecutionPlugin = {
  name: 'analytics',
  priority: 50, // Run early

  async beforeExecute(ctx) {
    // Record start time in metadata
    ctx.metadata.set('analytics:start', Date.now());
    console.log(`[Analytics] Starting ${ctx.toolName}`);
  },

  async afterExecute(ctx, result) {
    const startTime = ctx.metadata.get('analytics:start') as number;
    const duration = Date.now() - startTime;

    // Track metrics
    trackToolUsage({
      tool: ctx.toolName,
      duration,
      executionId: ctx.executionId,
      success: true,
    });

    return result; // Must return the result
  },

  async onError(ctx, error) {
    const startTime = ctx.metadata.get('analytics:start') as number;
    const duration = Date.now() - startTime;

    trackToolUsage({
      tool: ctx.toolName,
      duration,
      executionId: ctx.executionId,
      success: false,
      error: error.message,
    });

    return undefined; // Let error propagate
  },
};

agent.tools.executionPipeline.use(analyticsPlugin);
```

#### Caching Plugin Example

```typescript
const cachePlugin: IToolExecutionPlugin = {
  name: 'cache',
  priority: 10, // Run very early to short-circuit

  private cache = new Map<string, { result: unknown; expiry: number }>();

  async beforeExecute(ctx) {
    const key = `${ctx.toolName}:${JSON.stringify(ctx.args)}`;
    const cached = this.cache.get(key);

    if (cached && cached.expiry > Date.now()) {
      console.log(`[Cache] HIT for ${ctx.toolName}`);
      return { abort: true, result: cached.result };
    }

    ctx.metadata.set('cache:key', key);
    return undefined; // Continue with execution
  },

  async afterExecute(ctx, result) {
    const key = ctx.metadata.get('cache:key') as string;
    if (key) {
      this.cache.set(key, {
        result,
        expiry: Date.now() + 60000, // 1 minute TTL
      });
      console.log(`[Cache] Stored result for ${ctx.toolName}`);
    }
    return result;
  },
};
```

#### Args Transformation Plugin Example

```typescript
const sanitizePlugin: IToolExecutionPlugin = {
  name: 'sanitize-args',
  priority: 20,

  async beforeExecute(ctx) {
    // Sanitize string arguments
    const args = ctx.mutableArgs as Record<string, unknown>;
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        args[key] = value.trim().slice(0, 1000); // Trim and limit length
      }
    }
    return { modifiedArgs: args };
  },
};
```

### Pipeline Management

```typescript
// Add a plugin
agent.tools.executionPipeline.use(myPlugin);

// Remove a plugin by name
agent.tools.executionPipeline.remove('my-plugin');

// Check if a plugin is registered
if (agent.tools.executionPipeline.has('logging')) {
  console.log('Logging is enabled');
}

// Get a specific plugin
const loggingPlugin = agent.tools.executionPipeline.get('logging');

// List all registered plugins
const plugins = agent.tools.executionPipeline.list();
console.log('Registered plugins:', plugins.map(p => p.name));
```

### Plugin Priority

Plugins are sorted by priority (lower number = higher priority):

- **beforeExecute**: Runs in priority order (lower first)
- **afterExecute**: Runs in REVERSE priority order (higher first)
- **onError**: Runs in priority order (lower first)

This ensures proper "unwinding" behavior, similar to middleware stacks.

```typescript
// Example priority ordering:
const earlyPlugin: IToolExecutionPlugin = { name: 'early', priority: 10 };
const defaultPlugin: IToolExecutionPlugin = { name: 'default' }; // priority: 100
const latePlugin: IToolExecutionPlugin = { name: 'late', priority: 200 };

// beforeExecute order: early → default → late
// afterExecute order: late → default → early
```

### Built-in Plugins

#### LoggingPlugin

Logs all tool executions with timing and result information:

```typescript
import { LoggingPlugin } from '@everworker/oneringai';

// Use with default settings (info level)
agent.tools.executionPipeline.use(new LoggingPlugin());

// Configure log level
agent.tools.executionPipeline.use(new LoggingPlugin({
  level: 'debug', // 'debug' | 'info' | 'warn' | 'error'
}));
```

Output example:
```
[Tool] get_weather starting with args: {"location":"Paris"}
[Tool] get_weather completed in 234ms
[Tool] get_weather result: {"temp":72,"conditions":"sunny"}
```

### Use Cases

1. **Logging & Observability**: Track all tool executions for debugging
2. **Analytics**: Measure tool usage, latency, and success rates
3. **Permission Prompts**: Ask for user approval before dangerous tools
4. **Caching**: Cache expensive tool results
5. **Rate Limiting**: Limit tool calls per minute
6. **UI Updates**: Emit events for frontend updates (like browser tool views)
7. **Audit Logging**: Record all tool executions for compliance
8. **Mocking**: Replace tools with mocks for testing
9. **Retry Logic**: Automatically retry failed tool calls
10. **Transformation**: Sanitize inputs or transform outputs

### Integration with Hosea

The Hosea desktop app uses the plugin system to emit Dynamic UI content when browser tools execute:

```typescript
// apps/hosea/src/main/plugins/HoseaUIPlugin.ts
import type { IToolExecutionPlugin, PluginExecutionContext } from '@everworker/oneringai';

export class HoseaUIPlugin implements IToolExecutionPlugin {
  readonly name = 'hosea-ui';
  readonly priority = 200; // Run late

  constructor(private options: {
    emitDynamicUI: (instanceId: string, content: DynamicUIContent) => void;
    getInstanceId: () => string;
  }) {}

  async beforeExecute(ctx: PluginExecutionContext) {
    if (this.isBrowserTool(ctx.toolName)) {
      ctx.metadata.set('instanceId', this.options.getInstanceId());
    }
  }

  async afterExecute(ctx: PluginExecutionContext, result: unknown) {
    if (this.isBrowserTool(ctx.toolName)) {
      const instanceId = ctx.metadata.get('instanceId') as string;
      const typedResult = result as { success?: boolean; url?: string };

      if (typedResult?.success) {
        this.options.emitDynamicUI(instanceId, {
          type: 'display',
          title: 'Browser',
          elements: [{ type: 'browser', instanceId, currentUrl: typedResult.url }],
        });
      }
    }
    return result;
  }

  private isBrowserTool(name: string): boolean {
    return ['browser_navigate', 'browser_reload'].includes(name);
  }
}

// Register with agent
agent.tools.executionPipeline.use(new HoseaUIPlugin({
  emitDynamicUI: (id, content) => mainWindow?.send('dynamic-ui', id, content),
  getInstanceId: () => currentInstanceId,
}));
```

---

## MCP (Model Context Protocol)

The Model Context Protocol (MCP) is an open standard that enables seamless integration between AI applications and external data sources and tools. The library provides a complete MCP client implementation with support for both local (stdio) and remote (HTTP/HTTPS) servers.

### Overview

MCP allows you to:
- **Discover tools automatically** from MCP servers
- **Connect to local servers** via stdio (process spawning)
- **Connect to remote servers** via HTTP/HTTPS (StreamableHTTP)
- **Manage multiple servers** simultaneously
- **Auto-reconnect** with exponential backoff
- **Namespace tools** to prevent conflicts
- **Session persistence** for stateful connections

### Quick Start

#### 1. Install MCP SDK

```bash
npm install @modelcontextprotocol/sdk zod
```

#### 2. Connect to a Local MCP Server

```typescript
import { MCPRegistry, Agent, Connector, Vendor } from '@everworker/oneringai';

// Setup connector for LLM
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Create MCP client for filesystem server
const client = MCPRegistry.create({
  name: 'filesystem',
  transport: 'stdio',
  transportConfig: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
  },
});

// Connect to the server
await client.connect();
console.log(`Connected! Available tools: ${client.tools.length}`);

// Create agent and register MCP tools
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });
client.registerTools(agent.tools);

// Agent can now use MCP tools
const response = await agent.run('List all TypeScript files in the current directory');
console.log(response.output_text);
```

#### 3. Connect to a Remote MCP Server

```typescript
// Create HTTP/HTTPS MCP client
const remoteClient = MCPRegistry.create({
  name: 'remote-api',
  transport: 'https',
  transportConfig: {
    url: 'https://mcp.example.com/api',
    token: process.env.MCP_TOKEN,
    headers: {
      'X-Client-Version': '1.0.0',
    },
    reconnection: {
      maxRetries: 5,
      initialReconnectionDelay: 1000,
      maxReconnectionDelay: 30000,
    },
  },
});

await remoteClient.connect();
remoteClient.registerTools(agent.tools);
```

### Configuration File

Create `oneringai.config.json` to declare MCP servers:

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
          "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
        },
        "autoConnect": true,
        "toolNamespace": "mcp:fs",
        "permissions": {
          "defaultScope": "session",
          "defaultRiskLevel": "medium"
        }
      },
      {
        "name": "github",
        "displayName": "GitHub API",
        "transport": "https",
        "transportConfig": {
          "url": "https://mcp.example.com/github",
          "token": "${GITHUB_TOKEN}"
        },
        "autoConnect": false,
        "toolNamespace": "mcp:github"
      }
    ]
  }
}
```

Load and use the configuration:

```typescript
import { Config, MCPRegistry, Agent } from '@everworker/oneringai';

// Load configuration
await Config.load('./oneringai.config.json');

// Create all MCP clients from config
const clients = MCPRegistry.createFromConfig(Config.getSection('mcp')!);

// Connect all servers with autoConnect enabled
await MCPRegistry.connectAll();

// Create agent and register tools
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });
for (const client of clients) {
  if (client.isConnected()) {
    client.registerTools(agent.tools);
  }
}
```

### MCPRegistry API

The static registry manages all MCP client connections:

```typescript
// Create a client
const client = MCPRegistry.create({
  name: 'my-server',
  transport: 'stdio',
  transportConfig: { /* ... */ },
});

// Get a client
const client = MCPRegistry.get('my-server');

// Check if exists
if (MCPRegistry.has('my-server')) {
  // ...
}

// List all servers
const serverNames = MCPRegistry.list();

// Get server info
const info = MCPRegistry.getInfo('my-server');
// { name, state, connected, toolCount }

// Get all server info
const allInfo = MCPRegistry.getAllInfo();

// Lifecycle management
await MCPRegistry.connectAll();
await MCPRegistry.disconnectAll();
MCPRegistry.destroyAll();
```

### MCPClient API

Each client manages a connection to one MCP server:

#### Connection Management

```typescript
// Connect to server
await client.connect();

// Disconnect
await client.disconnect();

// Reconnect
await client.reconnect();

// Check connection status
const isConnected = client.isConnected();

// Ping server (health check)
const alive = await client.ping();
```

#### Tool Operations

```typescript
// List available tools
const tools = await client.listTools();
console.log(tools.map(t => `${t.name}: ${t.description}`));

// Call a tool directly
const result = await client.callTool('read_file', {
  path: './README.md'
});
console.log(result.content);

// Register tools with agent
client.registerTools(agent.tools);

// Unregister tools
client.unregisterTools(agent.tools);
```

#### Resource Operations

```typescript
// List available resources
const resources = await client.listResources();

// Read a resource
const content = await client.readResource('file:///path/to/file');
console.log(content.text);

// Subscribe to resource updates (if supported)
if (client.capabilities?.resources?.subscribe) {
  client.on('resource:updated', (uri) => {
    console.log(`Resource updated: ${uri}`);
  });

  await client.subscribeResource('file:///watch/this/file');
}

// Unsubscribe
await client.unsubscribeResource('file:///watch/this/file');
```

#### Prompt Operations

```typescript
// List available prompts
const prompts = await client.listPrompts();

// Get a prompt
const promptResult = await client.getPrompt('summarize', {
  length: 'short',
});

// Use prompt messages
for (const msg of promptResult.messages) {
  console.log(`${msg.role}: ${msg.content.text}`);
}
```

### Event Monitoring

Listen to connection and execution events:

```typescript
// Connection events
client.on('connected', () => {
  console.log('Connected to MCP server');
});

client.on('disconnected', () => {
  console.log('Disconnected from MCP server');
});

client.on('reconnecting', (attempt) => {
  console.log(`Reconnecting... attempt ${attempt}`);
});

client.on('failed', (error) => {
  console.error('Connection failed:', error);
});

// Tool execution events
client.on('tool:called', (name, args) => {
  console.log(`Tool called: ${name}`, args);
});

client.on('tool:result', (name, result) => {
  console.log(`Tool result: ${name}`, result);
});

// Resource events
client.on('resource:updated', (uri) => {
  console.log(`Resource updated: ${uri}`);
});

// Error events
client.on('error', (error) => {
  console.error('MCP error:', error);
});
```

### Transport Types

#### Stdio Transport

For local MCP servers (spawns a process):

```typescript
const client = MCPRegistry.create({
  name: 'local-server',
  transport: 'stdio',
  transportConfig: {
    command: 'npx',                                    // or 'node', 'python', etc.
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path'],
    env: {
      NODE_ENV: 'production',
      CUSTOM_VAR: 'value',
    },
    cwd: '/working/directory',                        // Optional working directory
  },
});
```

**Best for:**
- Local file system access
- Database connections (PostgreSQL, SQLite)
- Development and testing

#### HTTP/HTTPS Transport

For remote MCP servers (StreamableHTTP with SSE):

```typescript
const client = MCPRegistry.create({
  name: 'remote-server',
  transport: 'https',
  transportConfig: {
    url: 'https://mcp.example.com/api',
    token: process.env.MCP_TOKEN,                      // Bearer token
    headers: {
      'X-Client-Version': '1.0.0',
      'X-Custom-Header': 'value',
    },
    timeoutMs: 30000,                                  // Request timeout (default: 30000)
    sessionId: 'optional-session-id',                  // For reconnection
    reconnection: {
      maxReconnectionDelay: 30000,                     // Max delay between retries (default: 30000)
      initialReconnectionDelay: 1000,                  // Initial delay (default: 1000)
      reconnectionDelayGrowFactor: 1.5,                // Backoff factor (default: 1.5)
      maxRetries: 5,                                   // Max attempts (default: 2)
    },
  },
});
```

**Best for:**
- Cloud-hosted services
- Production deployments
- Team collaboration
- Remote API access

### Tool Namespacing

MCP tools are automatically namespaced to prevent conflicts:

```typescript
// Default namespace: mcp:{server-name}:{tool-name}
// Example: mcp:filesystem:read_file, mcp:github:create_issue

// Custom namespace
const client = MCPRegistry.create({
  name: 'fs',
  toolNamespace: 'files',
  // ...
});
// Tools: files:read_file, files:write_file, etc.

// Check registered tools
const toolNames = agent.listTools();
console.log(toolNames.filter(name => name.startsWith('mcp:')));
```

### Multi-Server Example

Connect to multiple MCP servers simultaneously:

```typescript
import { MCPRegistry, Agent, Connector, Vendor } from '@everworker/oneringai';

// Setup connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Create multiple clients
const fsClient = MCPRegistry.create({
  name: 'filesystem',
  transport: 'stdio',
  transportConfig: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
  },
});

const githubClient = MCPRegistry.create({
  name: 'github',
  transport: 'https',
  transportConfig: {
    url: 'https://mcp.example.com/github',
    token: process.env.GITHUB_TOKEN,
  },
});

const dbClient = MCPRegistry.create({
  name: 'postgres',
  transport: 'stdio',
  transportConfig: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    env: {
      DATABASE_URL: process.env.DATABASE_URL!,
    },
  },
});

// Connect all
await Promise.all([
  fsClient.connect(),
  githubClient.connect(),
  dbClient.connect(),
]);

// Create agent and register all tools
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });
fsClient.registerTools(agent.tools);
githubClient.registerTools(agent.tools);
dbClient.registerTools(agent.tools);

console.log(`Total tools: ${agent.listTools().length}`);

// Agent can now use tools from all servers
await agent.run('Query the database, analyze files, and create a GitHub issue with the results');
```

### Available MCP Servers

Official MCP servers from [@modelcontextprotocol](https://github.com/modelcontextprotocol/servers):

- **@modelcontextprotocol/server-filesystem** - File system operations
- **@modelcontextprotocol/server-github** - GitHub API integration
- **@modelcontextprotocol/server-google-drive** - Google Drive access
- **@modelcontextprotocol/server-slack** - Slack workspace integration
- **@modelcontextprotocol/server-postgres** - PostgreSQL database access
- **@modelcontextprotocol/server-sqlite** - SQLite database access
- **@modelcontextprotocol/server-memory** - Simple in-memory key-value store
- **@modelcontextprotocol/server-brave-search** - Brave Search API
- **@modelcontextprotocol/server-fetch** - HTTP requests and web scraping

Community servers:
- Browse at [mcpservers.org](https://mcpservers.org/)
- [Awesome MCP Servers](https://github.com/wong2/awesome-mcp-servers)
- [Awesome MCP Servers (punkpeye)](https://github.com/punkpeye/awesome-mcp-servers)

### Error Handling

```typescript
import {
  MCPError,
  MCPConnectionError,
  MCPTimeoutError,
  MCPProtocolError,
  MCPToolError,
  MCPResourceError,
} from '@everworker/oneringai';

try {
  await client.connect();
} catch (error) {
  if (error instanceof MCPConnectionError) {
    console.error('Failed to connect:', error.message);
    // Retry or use fallback
  } else if (error instanceof MCPTimeoutError) {
    console.error('Connection timed out:', error.timeoutMs);
  } else if (error instanceof MCPToolError) {
    console.error('Tool execution failed:', error.toolName);
  } else if (error instanceof MCPProtocolError) {
    console.error('Protocol error:', error.message);
  }
}
```

### State Persistence

Save and restore MCP client state:

```typescript
// Get current state
const state = client.getState();
console.log(state);
// {
//   name: 'filesystem',
//   state: 'connected',
//   capabilities: {...},
//   subscribedResources: ['file:///watch'],
//   lastConnectedAt: 1234567890,
//   connectionAttempts: 0
// }

// Save to storage
await storage.save('mcp-state', state);

// Load and restore
const savedState = await storage.load('mcp-state');
const newClient = MCPRegistry.create(config);
newClient.loadState(savedState);
await newClient.connect(); // Resumes with saved subscriptions
```

### Best Practices

1. **Use Configuration Files** - Declare servers in `oneringai.config.json` for easier management
2. **Handle Reconnection** - Enable `autoReconnect` for production deployments
3. **Monitor Events** - Listen to connection events for observability
4. **Use Namespaces** - Set custom `toolNamespace` to organize tools clearly
5. **Error Handling** - Always wrap MCP operations in try/catch
6. **Clean Up** - Call `client.disconnect()` when done
7. **Health Checks** - Use `client.ping()` for monitoring
8. **Permission Control** - Set appropriate `defaultScope` for security

### Troubleshooting

#### Connection Issues

```typescript
// Enable detailed error logging
client.on('error', (error) => {
  console.error('MCP Error:', error);
  console.error('Stack:', error.stack);
});

// Check connection state
console.log('State:', client.state);
console.log('Connected:', client.isConnected());

// Manual reconnect
if (!client.isConnected()) {
  await client.reconnect();
}
```

#### Tool Discovery

```typescript
// List all discovered tools
const tools = await client.listTools();
console.log('Available tools:');
tools.forEach(tool => {
  console.log(`  ${tool.name}: ${tool.description}`);
  console.log('  Input schema:', JSON.stringify(tool.inputSchema, null, 2));
});

// Check server capabilities
console.log('Capabilities:', client.capabilities);
```

#### Debug Mode

```typescript
// Log all tool calls
client.on('tool:called', (name, args) => {
  console.log(`[DEBUG] Tool called: ${name}`);
  console.log('[DEBUG] Args:', JSON.stringify(args, null, 2));
});

client.on('tool:result', (name, result) => {
  console.log(`[DEBUG] Tool result: ${name}`);
  console.log('[DEBUG] Result:', JSON.stringify(result, null, 2));
});
```

### Advanced: Custom Transports

While stdio and HTTP/HTTPS cover most use cases, you can implement custom transports by creating a class that implements the SDK's `Transport` interface:

```typescript
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

class CustomTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  async start(): Promise<void> {
    // Initialize your custom transport
  }

  async close(): Promise<void> {
    // Clean up resources
  }

  async send(message: JSONRPCMessage): Promise<void> {
    // Send message to server
  }
}
```

---

## Multimodal (Vision)

### Analyzing Images

```typescript
import { Agent, createMessageWithImages } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4-vision',
});

// From file path
const response1 = await agent.run(
  createMessageWithImages('What is in this image?', ['./photo.jpg'])
);

// From URL
const response2 = await agent.run(
  createMessageWithImages('Describe this image', [
    'https://example.com/image.jpg'
  ])
);

// From base64
const base64Image = Buffer.from(imageData).toString('base64');
const response3 = await agent.run(
  createMessageWithImages('Analyze this', [
    `data:image/jpeg;base64,${base64Image}`
  ])
);

// Multiple images
const response4 = await agent.run(
  createMessageWithImages(
    'Compare these two images',
    ['./image1.jpg', './image2.jpg']
  )
);
```

### Clipboard Images

Paste images directly from clipboard (like Claude Code!):

```typescript
import { Agent, readClipboardImage, hasClipboardImage } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'anthropic',
  model: 'claude-opus-4-5-20251101',
});

// Check if clipboard has an image
if (await hasClipboardImage()) {
  // Read clipboard image
  const result = await readClipboardImage();

  if (result.success && result.base64) {
    const response = await agent.run(
      createMessageWithImages('What is in this screenshot?', [
        `data:${result.mimeType};base64,${result.base64}`
      ])
    );

    console.log(response.output_text);
  }
}
```

### Vision with Tools

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4-vision',
  tools: [extractTextTool, identifyObjectsTool],
});

const response = await agent.run(
  createMessageWithImages(
    'Extract all text from this receipt and calculate the total',
    ['./receipt.jpg']
  )
);

// Agent will:
// 1. Analyze image
// 2. Call extractTextTool to extract text
// 3. Parse numbers
// 4. Calculate total
```

---

## Audio (TTS/STT)

The library provides comprehensive Text-to-Speech (TTS) and Speech-to-Text (STT) capabilities.

### Text-to-Speech

#### Basic Usage

```typescript
import { Connector, TextToSpeech, Vendor } from '@everworker/oneringai';

// Setup connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Create TTS instance
const tts = TextToSpeech.create({
  connector: 'openai',
  model: 'tts-1-hd',      // High-quality model
  voice: 'nova',          // Female voice
});

// Synthesize to Buffer
const response = await tts.synthesize('Hello, world!');
console.log(response.audio);   // Buffer
console.log(response.format);  // 'mp3'

// Synthesize to file
await tts.toFile('Hello, world!', './output.mp3');
```

#### Voice Options

```typescript
// Available voices
const voices = await tts.listVoices();
// [
//   { id: 'alloy', name: 'Alloy', gender: 'neutral', isDefault: true },
//   { id: 'echo', name: 'Echo', gender: 'male' },
//   { id: 'fable', name: 'Fable', gender: 'male' },
//   { id: 'onyx', name: 'Onyx', gender: 'male' },
//   { id: 'nova', name: 'Nova', gender: 'female' },
//   { id: 'shimmer', name: 'Shimmer', gender: 'female' },
//   ...
// ]

// Synthesize with specific voice
const audio = await tts.synthesize('Hello', { voice: 'echo' });
```

#### Audio Formats

```typescript
// Supported formats: mp3, opus, aac, flac, wav, pcm
const mp3 = await tts.synthesize('Hello', { format: 'mp3' });
const wav = await tts.synthesize('Hello', { format: 'wav' });
const flac = await tts.synthesize('Hello', { format: 'flac' });
```

#### Speed Control

```typescript
// Speed range: 0.25 (slow) to 4.0 (fast)
const slow = await tts.synthesize('Speaking slowly', { speed: 0.5 });
const normal = await tts.synthesize('Normal speed', { speed: 1.0 });
const fast = await tts.synthesize('Speaking fast', { speed: 2.0 });
```

#### Instruction Steering (gpt-4o-mini-tts)

The `gpt-4o-mini-tts` model supports instruction steering for emotional control:

```typescript
const tts = TextToSpeech.create({
  connector: 'openai',
  model: 'gpt-4o-mini-tts',
  voice: 'nova',
});

const audio = await tts.synthesize('I\'m so happy to see you!', {
  vendorOptions: {
    instructions: 'Speak with enthusiasm and joy, like greeting an old friend.',
  },
});
```

#### Model Introspection

```typescript
// Get model information
const info = tts.getModelInfo();
console.log(info.capabilities.features.instructionSteering); // true for gpt-4o-mini-tts

// Check feature support
const canSteer = tts.supportsFeature('instructionSteering');
const canStream = tts.supportsFeature('streaming');

// Get supported formats
const formats = tts.getSupportedFormats();  // ['mp3', 'opus', 'aac', ...]

// List available models
const models = tts.listAvailableModels();
```

### Speech-to-Text

#### Basic Usage

```typescript
import { Connector, SpeechToText, Vendor } from '@everworker/oneringai';

// Setup connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Create STT instance
const stt = SpeechToText.create({
  connector: 'openai',
  model: 'whisper-1',
});

// Transcribe from file path
const result = await stt.transcribeFile('./audio.mp3');
console.log(result.text);

// Transcribe from Buffer
import * as fs from 'fs/promises';
const audioBuffer = await fs.readFile('./audio.mp3');
const result2 = await stt.transcribe(audioBuffer);
```

#### Timestamps

```typescript
// Word-level timestamps
const withWords = await stt.transcribeWithTimestamps(audioBuffer, 'word');
console.log(withWords.words);
// [
//   { word: 'Hello', start: 0.0, end: 0.5 },
//   { word: 'world', start: 0.6, end: 1.1 },
// ]

// Segment-level timestamps
const withSegments = await stt.transcribeWithTimestamps(audioBuffer, 'segment');
console.log(withSegments.segments);
// [
//   { id: 0, text: 'Hello world.', start: 0.0, end: 1.5 },
// ]
```

#### Translation

Translate audio to English:

```typescript
const stt = SpeechToText.create({
  connector: 'openai',
  model: 'whisper-1',
});

// Translate French audio to English
const english = await stt.translate(frenchAudioBuffer);
console.log(english.text);  // English translation
```

#### Output Formats

```typescript
// JSON (default)
const json = await stt.transcribe(audio, { outputFormat: 'json' });

// Plain text
const text = await stt.transcribe(audio, { outputFormat: 'text' });

// Subtitles (SRT format)
const srt = await stt.transcribe(audio, { outputFormat: 'srt' });

// WebVTT format
const vtt = await stt.transcribe(audio, { outputFormat: 'vtt' });

// Verbose JSON (includes all metadata)
const verbose = await stt.transcribe(audio, { outputFormat: 'verbose_json' });
```

#### Language Hints

```typescript
// Provide language hint for better accuracy
const result = await stt.transcribe(audio, { language: 'fr' });  // French
const result2 = await stt.transcribe(audio, { language: 'es' }); // Spanish
```

#### Model Introspection

```typescript
// Get model information
const info = stt.getModelInfo();
console.log(info.capabilities.features.diarization);  // Speaker identification

// Check feature support
const supportsTranslation = stt.supportsFeature('translation');
const supportsDiarization = stt.supportsFeature('diarization');

// Get supported formats
const inputFormats = stt.getSupportedInputFormats();
const outputFormats = stt.getSupportedOutputFormats();

// Get timestamp granularities
const granularities = stt.getTimestampGranularities();  // ['word', 'segment']
```

### Available Models

#### TTS Models

| Model | Provider | Features | Price/1k chars |
|-------|----------|----------|----------------|
| `tts-1` | OpenAI | Fast, low-latency | $0.015 |
| `tts-1-hd` | OpenAI | High-quality audio | $0.030 |
| `gpt-4o-mini-tts` | OpenAI | Instruction steering, emotions | $0.015 |
| `gemini-2.5-flash-preview-tts` | Google | Low latency, 30 voices | - |
| `gemini-2.5-pro-preview-tts` | Google | High quality, 30 voices | - |

#### STT Models

| Model | Provider | Features | Price/minute |
|-------|----------|----------|--------------|
| `whisper-1` | OpenAI | General-purpose, 50+ languages | $0.006 |
| `gpt-4o-transcribe` | OpenAI | Superior accuracy | $0.006 |
| `gpt-4o-transcribe-diarize` | OpenAI | Speaker identification | $0.012 |
| `whisper-large-v3` | Groq | Ultra-fast (12x cheaper!) | $0.0005 |
| `distil-whisper-large-v3-en` | Groq | English-only, fastest | $0.00033 |

### Voice Assistant Pipeline

Combine TTS and STT for a voice assistant:

```typescript
import { Connector, Agent, TextToSpeech, SpeechToText, Vendor } from '@everworker/oneringai';

// Setup
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

const stt = SpeechToText.create({ connector: 'openai', model: 'whisper-1' });
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });
const tts = TextToSpeech.create({ connector: 'openai', model: 'tts-1-hd', voice: 'nova' });

// Voice assistant pipeline
async function voiceAssistant(audioInput: Buffer): Promise<Buffer> {
  // 1. Speech → Text
  const transcription = await stt.transcribe(audioInput);
  console.log('User said:', transcription.text);

  // 2. Text → AI Response
  const response = await agent.run(transcription.text);
  console.log('Agent response:', response.output_text);

  // 3. Text → Speech
  const audioResponse = await tts.synthesize(response.output_text);
  return audioResponse.audio;
}
```

### Cost Estimation

```typescript
import { calculateTTSCost, calculateSTTCost } from '@everworker/oneringai';

// TTS cost (per 1,000 characters)
const ttsCost = calculateTTSCost('tts-1-hd', 5000);  // 5000 characters
console.log(`TTS cost: $${ttsCost}`);  // $0.15

// STT cost (per minute)
const sttCost = calculateSTTCost('whisper-1', 300);  // 5 minutes
console.log(`STT cost: $${sttCost}`);  // $0.03

// Groq is much cheaper for STT
const groqCost = calculateSTTCost('whisper-large-v3', 300);  // 5 minutes
console.log(`Groq STT cost: $${groqCost}`);  // $0.0025
```

---

## Image Generation

The library provides comprehensive image generation capabilities with support for OpenAI (DALL-E) and Google (Imagen).

### Basic Usage

```typescript
import { Connector, ImageGeneration, Vendor } from '@everworker/oneringai';
import * as fs from 'fs/promises';

// Setup connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Create image generator
const imageGen = ImageGeneration.create({ connector: 'openai' });

// Generate an image
const result = await imageGen.generate({
  prompt: 'A futuristic city at sunset with flying cars',
  model: 'dall-e-3',
  size: '1024x1024',
  quality: 'hd',
});

// Save to file
const buffer = Buffer.from(result.data[0].b64_json!, 'base64');
await fs.writeFile('./output.png', buffer);
```

### OpenAI DALL-E

```typescript
// DALL-E 3 (recommended for quality)
const result = await imageGen.generate({
  prompt: 'A serene mountain landscape',
  model: 'dall-e-3',
  size: '1024x1024',      // 1024x1024, 1024x1792, 1792x1024
  quality: 'hd',           // standard or hd
  style: 'vivid',          // vivid or natural
});

// DALL-E 3 often revises prompts for better results
console.log('Revised prompt:', result.data[0].revised_prompt);

// DALL-E 2 (faster, supports multiple images)
const multiResult = await imageGen.generate({
  prompt: 'A colorful abstract pattern',
  model: 'dall-e-2',
  size: '512x512',         // 256x256, 512x512, 1024x1024
  n: 4,                    // Generate up to 10 images
});

// Process all generated images
for (let i = 0; i < multiResult.data.length; i++) {
  const buffer = Buffer.from(multiResult.data[i].b64_json!, 'base64');
  await fs.writeFile(`./output-${i}.png`, buffer);
}
```

### Google Imagen

```typescript
// Setup Google connector
Connector.create({
  name: 'google',
  vendor: Vendor.Google,
  auth: { type: 'api_key', apiKey: process.env.GOOGLE_API_KEY! },
});

const googleGen = ImageGeneration.create({ connector: 'google' });

// Imagen 4.0 (standard quality)
const result = await googleGen.generate({
  prompt: 'A beautiful butterfly in a garden',
  model: 'imagen-4.0-generate-001',
  n: 2,  // Up to 4 images
});

// Imagen 4.0 Fast (optimized for speed)
const fastResult = await googleGen.generate({
  prompt: 'A simple geometric pattern',
  model: 'imagen-4.0-fast-generate-001',
});

// Imagen 4.0 Ultra (highest quality)
const ultraResult = await googleGen.generate({
  prompt: 'A photorealistic portrait',
  model: 'imagen-4.0-ultra-generate-001',
});
```

### Available Models

#### OpenAI Image Models

| Model | Features | Max Images | Sizes | Price/Image |
|-------|----------|------------|-------|-------------|
| `dall-e-3` | HD quality, style control, prompt revision | 1 | 1024², 1024x1792, 1792x1024 | $0.04-0.08 |
| `dall-e-2` | Fast, multiple images, editing, variations | 10 | 256², 512², 1024² | $0.02 |
| `gpt-image-1` | Latest model, transparency support | 1 | 1024², 1024x1536, 1536x1024 | $0.01-0.04 |

#### Google Image Models

| Model | Features | Max Images | Price/Image |
|-------|----------|------------|-------------|
| `imagen-4.0-generate-001` | Standard quality, aspect ratios | 4 | $0.04 |
| `imagen-4.0-ultra-generate-001` | Highest quality | 4 | $0.08 |
| `imagen-4.0-fast-generate-001` | Speed optimized | 4 | $0.02 |

### Model Introspection

```typescript
// List available models
const models = await imageGen.listModels();
console.log('Available models:', models);

// Get model information
const info = imageGen.getModelInfo('dall-e-3');
console.log('Max images:', info.capabilities.maxImagesPerRequest);
console.log('Supported sizes:', info.capabilities.sizes);
console.log('Has style control:', info.capabilities.features.styleControl);
```

### Cost Estimation

```typescript
import { calculateImageCost } from '@everworker/oneringai';

// Standard quality
const standardCost = calculateImageCost('dall-e-3', 5, 'standard');
console.log(`5 standard images: $${standardCost}`);  // $0.20

// HD quality
const hdCost = calculateImageCost('dall-e-3', 5, 'hd');
console.log(`5 HD images: $${hdCost}`);  // $0.40

// Google Imagen
const imagenCost = calculateImageCost('imagen-4.0-generate-001', 4);
console.log(`4 Imagen images: $${imagenCost}`);  // $0.16
```

---

## Video Generation

The library provides comprehensive video generation capabilities with support for OpenAI (Sora) and Google (Veo). Video generation is **asynchronous** - you start a job and poll for completion.

### Basic Usage

```typescript
import { Connector, VideoGeneration, Vendor } from '@everworker/oneringai';
import * as fs from 'fs/promises';

// Setup connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Create video generator
const videoGen = VideoGeneration.create({ connector: 'openai' });

// Start video generation (returns immediately with job ID)
const job = await videoGen.generate({
  prompt: 'A cinematic shot of a sunrise over mountains with clouds rolling',
  model: 'sora-2',
  duration: 8,           // 8 seconds
  resolution: '1280x720', // 720p landscape
});

console.log('Job started:', job.jobId);
console.log('Status:', job.status);  // 'pending'

// Wait for completion (polls every 10 seconds, default 10-minute timeout)
const result = await videoGen.waitForCompletion(job.jobId);

// Download the completed video
const videoBuffer = await videoGen.download(job.jobId);
await fs.writeFile('./output.mp4', videoBuffer);
```

### Understanding the Async Model

Video generation takes significant time (often minutes). The API uses an async job model:

```typescript
// 1. Start generation - returns immediately
const job = await videoGen.generate({ prompt: '...', duration: 8 });
// job.status = 'pending'

// 2. Poll for status (optional - if you want progress updates)
const status = await videoGen.getStatus(job.jobId);
// status.status = 'processing', status.progress = 45

// 3. Wait for completion (blocks until done or timeout)
const result = await videoGen.waitForCompletion(job.jobId);
// result.status = 'completed'

// 4. Download the video
const buffer = await videoGen.download(job.jobId);
```

Or use the convenience method:

```typescript
// Generate and wait in one call
const result = await videoGen.generateAndWait({
  prompt: 'A butterfly flying through a garden',
  duration: 4,
});

const buffer = await videoGen.download(result.jobId);
```

### Video Response Structure

The API returns a `VideoResponse` object:

```typescript
interface VideoResponse {
  jobId: string;              // Unique job identifier
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created: number;            // Unix timestamp
  progress?: number;          // 0-100 percentage (when processing)
  video?: {
    url?: string;             // Download URL (if available)
    duration?: number;        // Actual duration in seconds
    resolution?: string;      // Actual resolution
    format?: string;          // 'mp4' typically
  };
  error?: string;             // Error message if failed
}
```

### Viewing Your Generated Video

After downloading, the video is a standard MP4 file that can be:

```typescript
// Save to file
await fs.writeFile('./output.mp4', videoBuffer);

// Open with default player (Node.js)
import { exec } from 'child_process';
exec('open ./output.mp4');  // macOS
exec('xdg-open ./output.mp4');  // Linux
exec('start ./output.mp4');  // Windows

// Serve via web server
import express from 'express';
const app = express();
app.get('/video', (req, res) => {
  res.setHeader('Content-Type', 'video/mp4');
  res.send(videoBuffer);
});

// Convert to base64 for embedding
const base64 = videoBuffer.toString('base64');
const dataUrl = `data:video/mp4;base64,${base64}`;
```

### OpenAI Sora

```typescript
// Sora 2 (standard quality, good value)
const result = await videoGen.generate({
  prompt: 'A futuristic city at sunset with flying cars',
  model: 'sora-2',
  duration: 8,              // 4, 8, or 12 seconds
  resolution: '1280x720',   // 720p landscape
  seed: 42,                 // For reproducibility
});

// Sora 2 Pro (higher quality, more options)
const proResult = await videoGen.generate({
  prompt: 'A photorealistic ocean wave crashing',
  model: 'sora-2-pro',
  duration: 12,
  resolution: '1920x1080',  // Full HD
  seed: 42,
});

// Image-to-video (animate a still image)
const imageBuffer = await fs.readFile('./photo.jpg');
const animated = await videoGen.generate({
  prompt: 'Gentle camera pan across the landscape',
  image: imageBuffer,       // Reference image
  model: 'sora-2',
  duration: 4,
});
```

### Google Veo

```typescript
// Setup Google connector
Connector.create({
  name: 'google',
  vendor: Vendor.Google,
  auth: { type: 'api_key', apiKey: process.env.GOOGLE_API_KEY! },
});

const googleVideo = VideoGeneration.create({ connector: 'google' });

// Veo 2.0 (budget-friendly at $0.03/sec)
const veo2 = await googleVideo.generate({
  prompt: 'A colorful butterfly landing on a flower',
  model: 'veo-2.0-generate-001',
  duration: 5,
  vendorOptions: {
    negativePrompt: 'blurry, low quality',  // What to avoid
  },
});

// Veo 3.0 (with audio support)
const veo3 = await googleVideo.generate({
  prompt: 'A thunderstorm over a city with lightning',
  model: 'veo-3-generate-preview',
  duration: 8,
  vendorOptions: {
    personGeneration: 'dont_allow',  // Safety setting
  },
});

// Veo 3.1 (latest features, 4K support)
const veo31 = await googleVideo.generate({
  prompt: 'A drone shot flying over mountains',
  model: 'veo-3.1-generate-preview',
  duration: 8,
  resolution: '4k',
});

// Veo 3.1 Fast (optimized for speed)
const fast = await googleVideo.generate({
  prompt: 'Simple animation of bouncing balls',
  model: 'veo-3.1-fast-generate-preview',
  duration: 4,
});
```

### Video Extension

Extend an existing video (not all models support this):

```typescript
const videoGen = VideoGeneration.create({ connector: 'openai' });

// First, create a video
const original = await videoGen.generateAndWait({
  prompt: 'A rocket launching',
  duration: 4,
});

// Download the original
const originalBuffer = await videoGen.download(original.jobId);

// Extend it
const extended = await videoGen.extend({
  video: originalBuffer,
  prompt: 'The rocket continues into space',
  extendDuration: 4,        // Add 4 more seconds
  direction: 'end',         // Extend from the end
});

await videoGen.waitForCompletion(extended.jobId);
```

### Available Models

#### OpenAI Sora Models

| Model | Features | Durations | Resolutions | Price/Second |
|-------|----------|-----------|-------------|--------------|
| `sora-2` | Text/image-to-video, audio, seed | 4, 8, 12s | 720p, custom | $0.15 |
| `sora-2-pro` | + HD, upscaling, style control | 4, 8, 12s | 720p-1080p | $0.40 |

#### Google Veo Models

| Model | Features | Durations | Resolutions | Price/Second |
|-------|----------|-----------|-------------|--------------|
| `veo-2.0-generate-001` | Image-to-video, negative prompts | 5-8s | 768x1408 | $0.03 |
| `veo-3-generate-preview` | + Audio, extension, style | 4-8s | 720p-1080p | $0.75 |
| `veo-3.1-fast-generate-preview` | Fast inference, audio | 4-8s | 720p | $0.75 |
| `veo-3.1-generate-preview` | Full features, 4K | 4-8s | 720p-4K | $0.75 |

### Model Introspection

```typescript
// List available models
const models = await videoGen.listModels();
console.log('Available models:', models);

// Get model information
const info = videoGen.getModelInfo('sora-2');
console.log('Durations:', info.capabilities.durations);       // [4, 8, 12]
console.log('Resolutions:', info.capabilities.resolutions);   // ['720x1280', ...]
console.log('Has audio:', info.capabilities.audio);           // true
console.log('Image-to-video:', info.capabilities.imageToVideo); // true
console.log('Style control:', info.capabilities.features.styleControl); // false
```

### Cost Estimation

```typescript
import { calculateVideoCost } from '@everworker/oneringai';

// Sora 2: $0.15/second
const soraCost = calculateVideoCost('sora-2', 8);  // 8 seconds
console.log(`Sora 2 (8s): $${soraCost}`);  // $1.20

// Sora 2 Pro: $0.40/second
const proCost = calculateVideoCost('sora-2-pro', 12);  // 12 seconds
console.log(`Sora 2 Pro (12s): $${proCost}`);  // $4.80

// Veo 2.0: $0.03/second (budget option)
const veo2Cost = calculateVideoCost('veo-2.0-generate-001', 8);
console.log(`Veo 2.0 (8s): $${veo2Cost}`);  // $0.24

// Veo 3.1: $0.75/second
const veo3Cost = calculateVideoCost('veo-3.1-generate-preview', 8);
console.log(`Veo 3.1 (8s): $${veo3Cost}`);  // $6.00
```

### Error Handling

```typescript
try {
  const job = await videoGen.generate({
    prompt: 'A video',
    duration: 8,
  });

  const result = await videoGen.waitForCompletion(job.jobId, 300000); // 5 min timeout

  if (result.status === 'completed') {
    const buffer = await videoGen.download(result.jobId);
    await fs.writeFile('./output.mp4', buffer);
  }
} catch (error) {
  if (error.message.includes('timed out')) {
    console.error('Video generation took too long');
  } else if (error.message.includes('failed')) {
    console.error('Video generation failed:', error.message);
  } else if (error.message.includes('policy')) {
    console.error('Content policy violation');
  } else {
    console.error('Error:', error.message);
  }
}
```

### Job Management

```typescript
// Cancel a pending job
const job = await videoGen.generate({ prompt: '...', duration: 8 });

// Changed your mind? Cancel it
const cancelled = await videoGen.cancel(job.jobId);
console.log('Cancelled:', cancelled);  // true
```

---

## Custom Media Storage

By default, multimedia tools (image generation, video generation, TTS, STT) save outputs to the local filesystem via `FileMediaStorage`. You can plug in custom storage backends (S3, GCS, Azure Blob, etc.) by implementing the `IMediaStorage` interface.

### The IMediaStorage Interface

```typescript
import type { IMediaStorage, MediaStorageMetadata, MediaStorageResult } from '@everworker/oneringai';

interface IMediaStorage {
  save(data: Buffer, metadata: MediaStorageMetadata): Promise<MediaStorageResult>;
  read(location: string): Promise<Buffer | null>;
  delete(location: string): Promise<void>;
  exists(location: string): Promise<boolean>;
  list?(options?: MediaStorageListOptions): Promise<MediaStorageEntry[]>;  // optional
  getPath(): string;
}
```

**`MediaStorageMetadata`** describes the media being saved:
- `type`: `'image' | 'video' | 'audio'`
- `format`: file extension (e.g., `'png'`, `'mp4'`, `'mp3'`)
- `model`: model name used for generation
- `vendor`: vendor that produced the output
- `index?`: index for multi-image results
- `suggestedFilename?`: optional filename hint

**`MediaStorageResult`** returned by `save()`:
- `location`: where the file was stored (path, URL, S3 key, etc.)
- `mimeType`: MIME type of the saved file
- `size`: file size in bytes

### Custom S3 Backend Example

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import type { IMediaStorage, MediaStorageMetadata, MediaStorageResult } from '@everworker/oneringai';

class S3MediaStorage implements IMediaStorage {
  private s3: S3Client;
  private bucket: string;

  constructor(bucket: string, region: string) {
    this.s3 = new S3Client({ region });
    this.bucket = bucket;
  }

  async save(data: Buffer, metadata: MediaStorageMetadata): Promise<MediaStorageResult> {
    const key = `media/${metadata.type}/${Date.now()}_${Math.random().toString(36).slice(2)}.${metadata.format}`;
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: this.getMimeType(metadata.format),
    }));
    return { location: key, mimeType: this.getMimeType(metadata.format), size: data.length };
  }

  async read(location: string): Promise<Buffer | null> {
    try {
      const response = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: location }));
      return Buffer.from(await response.Body!.transformToByteArray());
    } catch (err: any) {
      if (err.name === 'NoSuchKey') return null;
      throw err;
    }
  }

  async delete(location: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: location }));
  }

  async exists(location: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: location }));
      return true;
    } catch { return false; }
  }

  getPath(): string { return `s3://${this.bucket}/media/`; }

  private getMimeType(format: string): string {
    const map: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', mp4: 'video/mp4', mp3: 'audio/mpeg' };
    return map[format] ?? 'application/octet-stream';
  }
}
```

### Setting the Global Storage

```typescript
import { setMediaStorage } from '@everworker/oneringai';

// Set globally before creating agents - all multimedia tools will use this
setMediaStorage(new S3MediaStorage('my-bucket', 'us-east-1'));
```

All multimedia tools (`generate_image`, `generate_video`, `text_to_speech`, `speech_to_text`) automatically use the global storage handler.

### FileMediaStorage Default

The built-in `FileMediaStorage` saves files to `os.tmpdir()/oneringai-media/` by default:

```typescript
import { FileMediaStorage, createFileMediaStorage } from '@everworker/oneringai';

// Use defaults (saves to /tmp/oneringai-media/)
const storage = createFileMediaStorage();

// Custom output directory
const storage = createFileMediaStorage({ outputDir: '/data/media-outputs' });
```

### Per-Tool-Factory Storage

For advanced use cases, you can pass a storage instance directly to individual tool factories:

```typescript
import { createImageGenerationTool } from '@everworker/oneringai';

const connector = Connector.get('openai');
const tool = createImageGenerationTool(connector, myCustomStorage);
```

---

## Web Search

Web search capabilities with Connector-based authentication. Supports multiple providers: Serper, Brave, Tavily, and RapidAPI.

### Quick Start

```typescript
import { Connector, SearchProvider, Services } from '@everworker/oneringai';

// Create search connector
Connector.create({
  name: 'serper-main',
  serviceType: Services.Serper,
  auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY! },
  baseURL: 'https://google.serper.dev',
});

// Create search provider
const search = SearchProvider.create({ connector: 'serper-main' });

// Perform search
const results = await search.search('latest AI developments 2026', {
  numResults: 10,
  country: 'us',
  language: 'en',
});

if (results.success) {
  console.log(`Found ${results.count} results:`);
  results.results.forEach((result, i) => {
    console.log(`${i + 1}. ${result.title}`);
    console.log(`   ${result.url}`);
    console.log(`   ${result.snippet}\n`);
  });
}
```

### Search Providers

#### Serper (Google Search)

Fast Google search results via Serper.dev API:

```typescript
Connector.create({
  name: 'serper-main',
  serviceType: Services.Serper,
  auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY! },
  baseURL: 'https://google.serper.dev',
});

const search = SearchProvider.create({ connector: 'serper-main' });
const results = await search.search('query', {
  numResults: 10,
  country: 'us',
  language: 'en',
});
```

**Features:**
- Fast (1-2 second response time)
- 2,500 free queries, then $0.30/1k
- Google search quality
- Up to 100 results per query

#### Brave Search

Independent search index (privacy-focused):

```typescript
Connector.create({
  name: 'brave-main',
  serviceType: Services.BraveSearch,
  auth: { type: 'api_key', apiKey: process.env.BRAVE_API_KEY! },
  baseURL: 'https://api.search.brave.com/res/v1',
});

const search = SearchProvider.create({ connector: 'brave-main' });
const results = await search.search('query', {
  numResults: 10,
});
```

**Features:**
- Privacy-focused (no Google)
- Independent search index
- 2,000 free queries, then $3/1k
- Up to 20 results per query

#### Tavily

AI-optimized search with summaries:

```typescript
Connector.create({
  name: 'tavily-main',
  serviceType: Services.Tavily,
  auth: { type: 'api_key', apiKey: process.env.TAVILY_API_KEY! },
  baseURL: 'https://api.tavily.com',
});

const search = SearchProvider.create({ connector: 'tavily-main' });
const results = await search.search('query', {
  numResults: 10,
  vendorOptions: {
    search_depth: 'advanced',  // 'basic' or 'advanced'
    include_answer: true,
    include_raw_content: false,
  },
});
```

**Features:**
- AI-optimized for LLMs
- Includes summaries
- 1,000 free queries, then $1/1k
- Up to 20 results per query

#### RapidAPI

Real-time web search via RapidAPI:

```typescript
Connector.create({
  name: 'rapidapi-search',
  serviceType: Services.RapidapiSearch,
  auth: { type: 'api_key', apiKey: process.env.RAPIDAPI_KEY! },
  baseURL: 'https://real-time-web-search.p.rapidapi.com',
});

const search = SearchProvider.create({ connector: 'rapidapi-search' });
const results = await search.search('query', {
  numResults: 50,
  country: 'us',
  language: 'en',
  vendorOptions: {
    start: 0,                  // Pagination offset
    fetch_ai_overviews: false,
    deduplicate: false,
    nfpr: 0,                   // No auto-correct
    tbs: 'qdr:d',             // Time-based search (d=day, w=week, m=month, y=year)
    location: 'New York',      // Search origin
  },
});
```

**Features:**
- Real-time web results
- Up to 100 results per query
- Advanced filtering options
- Various pricing plans

### Using with Agent (ConnectorTools)

Search tools are registered via ConnectorTools. Create a connector, then get the tools:

```typescript
import { Agent, Connector, ConnectorTools, tools } from '@everworker/oneringai';

// Create a search connector
Connector.create({
  name: 'serper',
  serviceType: 'serper',
  auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY! },
  baseURL: 'https://google.serper.dev',
});

// Get search tools from the connector
const searchTools = ConnectorTools.for('serper');

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [tools.webFetch, ...searchTools],
});

const response = await agent.run(
  'Search for the latest AI news from 2026 and summarize the top 3 results'
);
```

**Tool Parameters:**
- `query` (required) - Search query string
- `numResults` - Number of results (default: 10, max: 100)
- `country` - Country/region code (e.g., 'us', 'gb')
- `language` - Language code (e.g., 'en', 'fr')

**Note:** Tools are prefixed with the connector name (e.g., `serper_web_search`).

### Multiple Keys (Failover)

Support for backup keys:

```typescript
// Main connector
Connector.create({
  name: 'serper-main',
  serviceType: Services.Serper,
  auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY_MAIN! },
  baseURL: 'https://google.serper.dev',
});

// Backup connector
Connector.create({
  name: 'serper-backup',
  serviceType: Services.Serper,
  auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY_BACKUP! },
  baseURL: 'https://google.serper.dev',
});

// Use with failover
try {
  const search = SearchProvider.create({ connector: 'serper-main' });
  const results = await search.search('query');
} catch (error) {
  console.log('Main failed, trying backup...');
  const backup = SearchProvider.create({ connector: 'serper-backup' });
  const results = await backup.search('query');
}
```

### Enterprise Resilience

All Connector features automatically apply:

```typescript
Connector.create({
  name: 'serper-main',
  serviceType: Services.Serper,
  auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY! },
  baseURL: 'https://google.serper.dev',

  // Resilience features
  timeout: 30000,  // 30 second timeout
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

const search = SearchProvider.create({ connector: 'serper-main' });
// Automatically includes retry, circuit breaker, and timeout!
const results = await search.search('query');
```

### Metrics and Monitoring

```typescript
const connector = Connector.get('serper-main');

// Get metrics
const metrics = connector.getMetrics();
console.log(`Requests: ${metrics.requestCount}`);
console.log(`Success rate: ${(metrics.successRate * 100).toFixed(1)}%`);
console.log(`Avg latency: ${metrics.avgLatencyMs.toFixed(0)}ms`);

// Circuit breaker state
const cbState = connector.getCircuitBreakerState();
console.log(`Circuit breaker: ${cbState}`);  // 'closed' | 'open' | 'half-open'
```

### Best Practices

1. **Use Connectors** - Preferred over environment variables
2. **Setup Backup Keys** - For production resilience
3. **Monitor Metrics** - Track usage and performance
4. **Cache Results** - Reduce API costs by caching
5. **Handle Errors** - Always check `results.success`
6. **Respect Rate Limits** - Each provider has different limits

### Error Handling

```typescript
const results = await search.search('query');

if (!results.success) {
  console.error('Search failed:', results.error);

  // Check error type
  if (results.error?.includes('API key')) {
    console.error('Authentication failed - check API key');
  } else if (results.error?.includes('429')) {
    console.error('Rate limit exceeded - try backup connector');
  } else if (results.error?.includes('timeout')) {
    console.error('Request timed out - increase timeout setting');
  }
} else {
  console.log(`Success: ${results.count} results`);
}
```

---

## Web Scraping

The library provides enterprise web scraping with automatic fallback chains and bot protection bypass.

### Quick Start

```typescript
import { Connector, ScrapeProvider, Services } from '@everworker/oneringai';

// Create ZenRows connector
Connector.create({
  name: 'zenrows',
  serviceType: Services.Zenrows,
  auth: { type: 'api_key', apiKey: process.env.ZENROWS_API_KEY! },
  baseURL: 'https://api.zenrows.com/v1',
});

// Create scrape provider
const scraper = ScrapeProvider.create({ connector: 'zenrows' });

// Scrape a URL
const result = await scraper.scrape('https://example.com', {
  includeMarkdown: true,
  includeLinks: true,
});

if (result.success) {
  console.log(result.result?.title);
  console.log(result.result?.content);
  console.log(result.finalUrl);
}
```

### ZenRows Provider

ZenRows provides enterprise-grade scraping with:
- JavaScript rendering for SPAs
- Premium proxies (residential IPs)
- Anti-bot and CAPTCHA bypass
- Markdown conversion
- Screenshot capture

```typescript
import { ScrapeProvider, ZenRowsOptions } from '@everworker/oneringai';

const scraper = ScrapeProvider.create({ connector: 'zenrows' });

// Full control with ZenRows options
const result = await scraper.scrape('https://protected-site.com', {
  includeMarkdown: true,
  includeScreenshot: true,
  vendorOptions: {
    jsRender: true,           // Enable JS rendering (default: true)
    premiumProxy: true,       // Use residential IPs (default: true)
    wait: 5000,               // Wait 5s before scraping
    waitFor: '.content',      // Wait for CSS selector
    device: 'mobile',         // Mobile user agent
    proxyCountry: 'us',       // Use US proxies
    autoparse: true,          // Auto-structure data
  } as ZenRowsOptions,
});
```

### Using web_scrape Tool with Agent (ConnectorTools)

The web_scrape tool is available via ConnectorTools. It tries native fetch first, then falls back to the bound scrape provider:

```typescript
import { Agent, Connector, ConnectorTools, tools } from '@everworker/oneringai';

// Create scrape connector
Connector.create({
  name: 'zenrows',
  serviceType: 'zenrows',
  auth: { type: 'api_key', apiKey: process.env.ZENROWS_API_KEY! },
  baseURL: 'https://api.zenrows.com',
});

const scrapeTools = ConnectorTools.for('zenrows');

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [tools.webFetch, ...scrapeTools],
});

// Agent uses automatic fallback: native → API
await agent.run('Scrape https://example.com and summarize');
```

### Tool Parameters

The `web_scrape` tool accepts:
- `url` (required) — URL to scrape
- `timeout` — Timeout in milliseconds (default: 30000)
- `includeHtml` — Include raw HTML (default: false)
- `includeMarkdown` — Convert to markdown (recommended for LLMs)
- `includeLinks` — Extract links
- `waitForSelector` — Wait for CSS selector (for JS-heavy sites)

**Note:** The tool automatically detects available scrape connectors by serviceType.
Scraping strategy is handled internally - the tool will use the best available method.

### Best Practices

1. **Configure a connector** - Set up ZenRows or similar for protected sites
2. **Request markdown** - Cleaner output for LLM processing
3. **Handle errors** - Check `result.success` and `result.error`
4. **Use waitForSelector** - For JavaScript-heavy sites that need time to render

---

## Streaming

### Basic Streaming

```typescript
import { Agent, isOutputTextDelta } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
});

// Stream response
for await (const event of agent.stream('Tell me a story')) {
  if (isOutputTextDelta(event)) {
    process.stdout.write(event.delta);
  }
}
```

### Stream Helpers

```typescript
import { StreamHelpers } from '@everworker/oneringai';

// Text only (filters to just text deltas)
for await (const text of StreamHelpers.textOnly(agent.stream('Hello'))) {
  process.stdout.write(text);
}

// All events
for await (const event of agent.stream('Hello')) {
  switch (event.type) {
    case 'response_created':
      console.log('🔄 Starting...');
      break;

    case 'output_text_delta':
      process.stdout.write(event.delta);
      break;

    case 'tool_call_start':
      console.log(`\n🔧 Calling ${event.toolName}...`);
      break;

    case 'tool_execution_done':
      console.log(`✅ Tool complete`);
      break;

    case 'response_complete':
      console.log('\n✓ Done');
      break;

    case 'error':
      console.error('Error:', event.error);
      break;
  }
}
```

### Streaming with Tools

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, calculatorTool],
});

for await (const event of agent.stream('What is the weather in Paris?')) {
  if (event.type === 'tool_call_start') {
    console.log(`🔧 Calling ${event.toolName}...`);
  }

  if (event.type === 'tool_execution_done') {
    console.log(`✅ Tool result: ${JSON.stringify(event.result)}`);
  }

  if (event.type === 'output_text_delta') {
    process.stdout.write(event.delta);
  }
}
```

---

## External API Integration

Connect your AI agents to 35+ external services with enterprise-grade resilience. The library provides both connector-based tools and direct fetch capabilities.

### Overview

External API integration uses the **Connector-First Architecture** - the same pattern used for AI providers. This means:
- Single source of truth for authentication
- Built-in resilience (retry, timeout, circuit breaker)
- Automatic tool generation for any service

### Quick Start

```typescript
import { Connector, ConnectorTools, Services, Agent } from '@everworker/oneringai';

// 1. Create a connector for an external service
Connector.create({
  name: 'github',
  serviceType: Services.Github,
  auth: { type: 'api_key', apiKey: process.env.GITHUB_TOKEN! },
  baseURL: 'https://api.github.com',
});

// 2. Generate tools from the connector
const tools = ConnectorTools.for('github');

// 3. Use with an agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: tools,
});

// 4. Agent can now call the GitHub API
await agent.run('List all open issues in owner/repo');
```

### Connector Configuration

#### Basic Configuration

```typescript
Connector.create({
  name: 'slack',
  serviceType: Services.Slack,  // Optional: explicit service type
  auth: { type: 'api_key', apiKey: process.env.SLACK_TOKEN! },
  baseURL: 'https://slack.com/api',
});
```

#### Enterprise Resilience Features

```typescript
Connector.create({
  name: 'stripe',
  serviceType: Services.Stripe,
  auth: { type: 'api_key', apiKey: process.env.STRIPE_SECRET_KEY! },
  baseURL: 'https://api.stripe.com/v1',

  // Timeout
  timeout: 30000,  // 30 seconds (default)

  // Retry with exponential backoff
  retry: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableStatuses: [429, 500, 502, 503, 504],
  },

  // Circuit breaker
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,      // Open after 5 failures
    successThreshold: 2,      // Close after 2 successes
    resetTimeoutMs: 60000,    // Try again after 60s
  },

  // Logging
  logging: {
    enabled: true,
    logBody: false,           // Don't log request/response bodies
    logHeaders: false,        // Don't log headers
  },
});
```

### Supported Services (35+)

The library includes built-in definitions for 35+ popular services:

| Category | Services |
|----------|----------|
| **Communication** | Slack, Discord, Microsoft Teams, Twilio, Zoom |
| **Development** | GitHub, GitLab, Jira, Linear, Bitbucket, CircleCI |
| **Productivity** | Notion, Asana, Monday, Airtable, Trello, Confluence |
| **CRM** | Salesforce, HubSpot, Zendesk, Intercom, Freshdesk |
| **Payments** | Stripe, PayPal, Square, Braintree |
| **Cloud** | AWS, Azure, GCP, DigitalOcean, Vercel, Netlify |
| **Storage** | Dropbox, Box, Google Drive, OneDrive |
| **Email** | SendGrid, Mailchimp, Mailgun, Postmark |
| **Monitoring** | Datadog, PagerDuty, Sentry, New Relic |

```typescript
import { Services, getServiceInfo, getServicesByCategory } from '@everworker/oneringai';

// Use service constants
Connector.create({
  name: 'my-slack',
  serviceType: Services.Slack,  // Type-safe
  // ...
});

// Get service metadata
const info = getServiceInfo('slack');
console.log(info?.name);        // 'Slack'
console.log(info?.category);    // 'communication'
console.log(info?.docsURL);     // 'https://api.slack.com/methods'
console.log(info?.commonScopes); // ['chat:write', 'channels:read', ...]

// Filter by category
const devServices = getServicesByCategory('development');
// Returns: github, gitlab, jira, linear, bitbucket, ...
```

### Using Connector.fetch()

For direct API calls without tools:

```typescript
const connector = Connector.get('github');

// Basic fetch
const response = await connector.fetch('/repos/owner/repo/issues', {
  method: 'GET',
  queryParams: { state: 'open', per_page: '10' },
});

// JSON helper with automatic parsing
const issues = await connector.fetchJSON<Issue[]>('/repos/owner/repo/issues');

// POST with body
const newIssue = await connector.fetchJSON('/repos/owner/repo/issues', {
  method: 'POST',
  body: {
    title: 'New Issue',
    body: 'Issue description',
    labels: ['bug'],
  },
});

// Per-request options
const urgent = await connector.fetch('/chat.postMessage', {
  method: 'POST',
  body: { channel: 'C123', text: 'Urgent!' },
  timeout: 5000,           // Override timeout
  skipRetry: true,         // Skip retry for this request
  skipCircuitBreaker: true, // Bypass circuit breaker
});
```

### ConnectorTools API

#### Generate Tools for a Connector

```typescript
import { ConnectorTools } from '@everworker/oneringai';

// Get all tools for a connector (generic API + any registered service tools)
const tools = ConnectorTools.for('github');
const tools = ConnectorTools.for(connector);  // Can pass instance too

// With scoped registry (access control)
const registry = Connector.scoped({ tenantId: 'acme' });
const tools = ConnectorTools.for('github', undefined, { registry });

// Get only the generic API tool
const apiTool = ConnectorTools.genericAPI('github');

// Custom tool name
const customTool = ConnectorTools.genericAPI('github', {
  toolName: 'github_api',
});
```

#### Tool Naming Convention

All tools generated by `ConnectorTools.for()` are prefixed with the connector name to prevent naming collisions when multiple connectors provide tools with the same base name:

| Tool type | Naming pattern | Example |
|-----------|---------------|---------|
| Generic API | `{connectorName}_api` | `github_api`, `slack_api` |
| Service-specific | `{connectorName}_{toolName}` | `github_search_files`, `google_generate_image`, `main-openai_text_to_speech` |

**Services with built-in tools:**
- **GitHub** — 7 tools: `search_files`, `search_code`, `read_file`, `get_pr`, `pr_files`, `pr_comments`, `create_pr` (see [GitHub Connector Tools](#github-connector-tools))
- **AI Vendors** (OpenAI, Google, Grok) — Multimedia tools: `generate_image`, `generate_video`, `text_to_speech`, `speech_to_text`

This ensures that tools from different vendors (e.g., `google_generate_image` vs `main-openai_generate_image`) never collide, and are clearly identified by connector in UIs and agent configs.

`ToolRegistry` automatically derives clean display names from these prefixed names using vendor metadata (e.g., `google_generate_image` displays as "Google Generate Image").

#### The Generic API Tool

Every connector with a `baseURL` gets a generic API tool that allows the agent to make any API call:

```typescript
// Tool schema:
{
  name: 'github_api',  // {connectorName}_api
  description: 'Make API requests to api.github.com',
  parameters: {
    method: { enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
    endpoint: { type: 'string' },          // API path, e.g., '/repos/owner/repo'
    body: { type: 'object' },              // JSON request body (POST/PUT/PATCH)
    queryParams: { type: 'object' },       // URL query parameters (GET filtering/pagination)
    headers: { type: 'object' },           // Additional headers (auth headers are protected)
  }
}
```

**Important:** For `POST`/`PUT`/`PATCH` requests, data must be passed in the `body` parameter as a JSON object — **not** as query string parameters in the endpoint URL. The body is sent as `application/json`. For example, to post a Slack message:

```typescript
// Correct: data in body
{ method: 'POST', endpoint: '/chat.postMessage', body: { channel: 'C123', text: 'Hello!' } }

// Wrong: data in query string — many APIs will reject this
{ method: 'POST', endpoint: '/chat.postMessage?channel=C123&text=Hello!' }
```

**Security:** Authorization headers cannot be overridden by the agent.

#### Register Custom Service Tools

For frequently-used operations, register service-specific tools. Note that tool names returned by the factory use generic names — `ConnectorTools.for()` automatically prefixes them with the connector name:

```typescript
import { ConnectorTools, ToolFunction } from '@everworker/oneringai';

// Register tools for a service type
ConnectorTools.registerService('slack', (connector) => {
  const listChannels: ToolFunction = {
    definition: {
      type: 'function',
      function: {
        name: 'slack_list_channels',
        description: 'List all Slack channels',
        parameters: {
          type: 'object',
          properties: {
            types: {
              type: 'string',
              description: 'Filter by channel types',
              enum: ['public_channel', 'private_channel'],
            },
            limit: { type: 'number', description: 'Max results' },
          },
        },
      },
    },
    execute: async (args) => {
      return connector.fetchJSON('/conversations.list', {
        queryParams: { types: args.types, limit: String(args.limit || 100) },
      });
    },
    describeCall: (args) => `List ${args.types || 'all'} channels`,
  };

  const postMessage: ToolFunction = {
    definition: {
      type: 'function',
      function: {
        name: 'slack_post_message',
        description: 'Post a message to a Slack channel',
        parameters: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel ID' },
            text: { type: 'string', description: 'Message text' },
          },
          required: ['channel', 'text'],
        },
      },
    },
    execute: async (args) => {
      return connector.fetchJSON('/chat.postMessage', {
        method: 'POST',
        body: { channel: args.channel, text: args.text },
      });
    },
    describeCall: (args) => `Post to ${args.channel}`,
    permission: { riskLevel: 'medium', scope: 'session' },
  };

  return [listChannels, postMessage];
});

// Now ConnectorTools.for('slack-connector') returns both generic + custom tools
```

#### Discover All Connectors

```typescript
// Get tools for all connectors with serviceType
const allTools = ConnectorTools.discoverAll();
// Returns: Map<connectorName, ToolFunction[]>

for (const [name, tools] of allTools) {
  console.log(`${name}: ${tools.length} tools`);
}

// Find connector by service type
const slackConnector = ConnectorTools.findConnector(Services.Slack);

// Find all connectors for a service type
const allSlackConnectors = ConnectorTools.findConnectors(Services.Slack);

// Check if service has custom tools
if (ConnectorTools.hasServiceTools('slack')) {
  // ...
}

// List all services with custom tools registered
const services = ConnectorTools.listSupportedServices();
```

### ToolRegistry API

Unified view of all tools (built-in + connector-generated). Use this for UI tool pickers, inventory screens, or any code that needs to enumerate available tools.

#### Basic Usage

```typescript
import { ToolRegistry } from '@everworker/oneringai';

// Get ALL tools (main API for UIs)
const allTools = ToolRegistry.getAllTools();

// Built-in tools only (filesystem, shell, web, code, json)
const builtInTools = ToolRegistry.getBuiltInTools();

// All connector-generated tools
const connectorTools = ToolRegistry.getAllConnectorTools();

// Tools for a specific connector
const githubTools = ToolRegistry.getConnectorTools('github');

// Filter by service type
const slackTools = ToolRegistry.getToolsByService('slack');

// Filter by connector name
const myApiTools = ToolRegistry.getToolsByConnector('my-api');
```

#### Type Guard

Use `isConnectorTool()` to distinguish built-in from connector tools:

```typescript
for (const tool of ToolRegistry.getAllTools()) {
  if (ToolRegistry.isConnectorTool(tool)) {
    // ConnectorToolEntry - has connectorName, serviceType
    console.log(`API: ${tool.displayName} (${tool.connectorName})`);
  } else {
    // ToolRegistryEntry - built-in tool
    console.log(`Built-in: ${tool.displayName}`);
  }
}
```

#### Methods Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `getAllTools()` | `(ToolRegistryEntry \| ConnectorToolEntry)[]` | All tools (main API) |
| `getBuiltInTools()` | `ToolRegistryEntry[]` | Built-in tools only |
| `getAllConnectorTools()` | `ConnectorToolEntry[]` | All connector tools |
| `getConnectorTools(name)` | `ConnectorToolEntry[]` | Tools for specific connector |
| `getToolsByService(type)` | `ConnectorToolEntry[]` | Filter by service type |
| `getToolsByConnector(name)` | `ConnectorToolEntry[]` | Filter by connector name |
| `isConnectorTool(entry)` | `boolean` | Type guard for ConnectorToolEntry |

#### Entry Properties

**ToolRegistryEntry** (built-in tools):

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Tool name (e.g., `read_file`) |
| `displayName` | `string` | Human-readable name (e.g., `Read File`) |
| `category` | `ToolCategory` | `filesystem`, `shell`, `web`, `code`, `json` |
| `description` | `string` | Brief description |
| `safeByDefault` | `boolean` | Whether safe without approval |
| `tool` | `ToolFunction` | The actual tool function |
| `requiresConnector` | `boolean?` | If tool needs a connector |
| `connectorServiceTypes` | `string[]?` | Supported service types |

**ConnectorToolEntry** extends ToolRegistryEntry with:

| Property | Type | Description |
|----------|------|-------------|
| `connectorName` | `string` | Source connector name |
| `serviceType` | `string?` | Detected service type (e.g., `github`) |

### Service Detection

Services are detected from URL patterns or explicit `serviceType`:

```typescript
import { detectServiceFromURL, Services } from '@everworker/oneringai';

// Automatic detection from URL
detectServiceFromURL('https://api.github.com/repos');     // 'github'
detectServiceFromURL('https://slack.com/api/chat');       // 'slack'
detectServiceFromURL('https://api.stripe.com/v1');        // 'stripe'
detectServiceFromURL('https://company.atlassian.net');    // 'jira'

// Explicit serviceType takes precedence
Connector.create({
  name: 'custom',
  serviceType: Services.Jira,                        // Explicit
  baseURL: 'https://api.github.com',                 // Ignored for detection
});
```

### Metrics and Monitoring

```typescript
const connector = Connector.get('github');

// Get metrics
const metrics = connector.getMetrics();
console.log(`Requests: ${metrics.requestCount}`);
console.log(`Success: ${metrics.successCount}`);
console.log(`Failures: ${metrics.failureCount}`);
console.log(`Avg Latency: ${metrics.avgLatencyMs}ms`);
console.log(`Circuit: ${metrics.circuitBreakerState}`);

// Reset circuit breaker manually
connector.resetCircuitBreaker();

// Check if connector is disposed
if (connector.isDisposed()) {
  // Recreate connector
}
```

### Complete Example

```typescript
import { Connector, ConnectorTools, Services, Agent, Vendor } from '@everworker/oneringai';

// Setup AI connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Setup GitHub connector with resilience
Connector.create({
  name: 'github',
  serviceType: Services.Github,
  auth: { type: 'api_key', apiKey: process.env.GITHUB_TOKEN! },
  baseURL: 'https://api.github.com',
  timeout: 15000,
  retry: { maxRetries: 2, baseDelayMs: 500 },
  circuitBreaker: { enabled: true, failureThreshold: 3 },
});

// Setup Slack connector
Connector.create({
  name: 'slack',
  serviceType: Services.Slack,
  auth: { type: 'api_key', apiKey: process.env.SLACK_TOKEN! },
  baseURL: 'https://slack.com/api',
});

// Create agent with external API tools
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [
    ...ConnectorTools.for('github'),
    ...ConnectorTools.for('slack'),
  ],
});

// Agent can now interact with both services
await agent.run(`
  Check if there are any critical issues in owner/repo,
  and if so, post a summary to the #alerts Slack channel.
`);
```

---

## Vendor Templates

Quickly set up connectors for 43+ services with pre-configured authentication templates. No need to look up URLs, headers, or scopes - just provide your credentials!

### Quick Start

```typescript
import {
  createConnectorFromTemplate,
  listVendors,
  getVendorTemplate,
  ConnectorTools
} from '@everworker/oneringai';

// Create GitHub connector with Personal Access Token
const connector = createConnectorFromTemplate(
  'my-github',           // Connector name
  'github',              // Vendor ID
  'pat',                 // Auth method
  { apiKey: process.env.GITHUB_TOKEN! }
);

// Get tools for the connector
const tools = ConnectorTools.for('my-github');

// Use with agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools,
});

await agent.run('List my GitHub repositories');
```

### Discovering Available Vendors

```typescript
import { listVendors, getVendorTemplate, getVendorInfo } from '@everworker/oneringai';

// List all available vendors
const vendors = listVendors();
console.log(vendors.length);  // 43

// Get specific vendor info
const github = getVendorInfo('github');
console.log(github);
// {
//   id: 'github',
//   name: 'GitHub',
//   category: 'development',
//   docsURL: 'https://docs.github.com/en/rest',
//   credentialsSetupURL: 'https://github.com/settings/developers',
//   authMethods: [
//     { id: 'pat', name: 'Personal Access Token', type: 'api_key', ... },
//     { id: 'oauth-user', name: 'OAuth App (User Authorization)', type: 'oauth', ... },
//     { id: 'github-app', name: 'GitHub App (Installation Token)', type: 'oauth', ... }
//   ]
// }

// Filter by category
import { listVendorsByCategory, listVendorsByAuthType } from '@everworker/oneringai';

const devVendors = listVendorsByCategory('development');
// [github, gitlab, bitbucket, jira, linear, asana, trello]

const apiKeyVendors = listVendorsByAuthType('api_key');
// All vendors that support API key authentication
```

### Vendor Logos

Access vendor logos for use in UIs. Logos come from the Simple Icons library where available, with branded placeholders for others:

```typescript
import {
  getVendorLogo,
  getVendorLogoSvg,
  getVendorColor,
  hasVendorLogo,
  listVendorsWithLogos,
  getAllVendorLogos
} from '@everworker/oneringai';

// Check if logo is available
if (hasVendorLogo('github')) {
  const logo = getVendorLogo('github');
  console.log(logo.svg);           // Full SVG content
  console.log(logo.hex);           // Brand color: "181717"
  console.log(logo.isPlaceholder); // false (has official icon)
}

// Get just the SVG content
const svg = getVendorLogoSvg('slack');

// Get SVG with custom color
const whiteSvg = getVendorLogoSvg('github', 'FFFFFF');

// Get brand color
const stripeColor = getVendorColor('stripe');  // "635BFF"

// List all vendors with logos
const vendorsWithLogos = listVendorsWithLogos();  // 43 vendors

// Get all logos at once
const allLogos = getAllVendorLogos();  // Map<vendorId, VendorLogo>
```

**VendorLogo Interface:**
```typescript
interface VendorLogo {
  vendorId: string;          // e.g., 'github'
  svg: string;               // Full SVG content
  hex: string;               // Brand color (without #)
  isPlaceholder: boolean;    // true if using generated placeholder
  simpleIconsSlug?: string;  // Simple Icons slug if available
}
```

### Authentication Methods

Each vendor template includes one or more authentication methods:

#### API Key

Simple token-based authentication:

```typescript
// GitHub Personal Access Token
createConnectorFromTemplate('my-github', 'github', 'pat', {
  apiKey: process.env.GITHUB_TOKEN!
});

// Slack Bot Token
createConnectorFromTemplate('my-slack', 'slack', 'bot-token', {
  apiKey: process.env.SLACK_BOT_TOKEN!
});

// Stripe Secret Key
createConnectorFromTemplate('my-stripe', 'stripe', 'api-key', {
  apiKey: process.env.STRIPE_SECRET_KEY!
});
```

#### OAuth (User Authorization)

For apps where users grant permissions:

```typescript
// GitHub OAuth App
createConnectorFromTemplate('my-github-oauth', 'github', 'oauth-user', {
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  redirectUri: 'https://myapp.com/callback',
  scope: 'repo read:user'  // Optional - uses template defaults
});

// Google Workspace OAuth
createConnectorFromTemplate('my-google', 'google-workspace', 'oauth-user', {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'https://myapp.com/google/callback',
});
```

#### Service Account (JWT Bearer)

For server-to-server authentication:

```typescript
// Google Service Account
createConnectorFromTemplate('my-gcp', 'gcp', 'service-account', {
  clientId: process.env.GOOGLE_SERVICE_CLIENT_ID!,
  privateKey: process.env.GOOGLE_SERVICE_PRIVATE_KEY!,
  scope: 'https://www.googleapis.com/auth/cloud-platform'
});

// Salesforce JWT Bearer
createConnectorFromTemplate('my-salesforce', 'salesforce', 'jwt-bearer', {
  clientId: process.env.SF_CLIENT_ID!,
  privateKey: process.env.SF_PRIVATE_KEY!,
  username: process.env.SF_USERNAME!
});
```

#### Client Credentials

For app-level authentication:

```typescript
// Microsoft 365 App-Only
createConnectorFromTemplate('my-m365', 'microsoft-365', 'client-credentials', {
  clientId: process.env.AZURE_CLIENT_ID!,
  clientSecret: process.env.AZURE_CLIENT_SECRET!,
  tenantId: process.env.AZURE_TENANT_ID!
});

// PayPal
createConnectorFromTemplate('my-paypal', 'paypal', 'oauth-client-credentials', {
  clientId: process.env.PAYPAL_CLIENT_ID!,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET!
});
```

### Getting Credentials Setup URLs

Each vendor template includes the URL where you create credentials:

```typescript
import { getCredentialsSetupURL, getDocsURL } from '@everworker/oneringai';

// Get where to create credentials
const setupUrl = getCredentialsSetupURL('github');
// 'https://github.com/settings/developers'

// Get API documentation
const docsUrl = getDocsURL('github');
// 'https://docs.github.com/en/rest'
```

### Configuration Options

Override defaults when creating connectors:

```typescript
createConnectorFromTemplate(
  'my-github',
  'github',
  'pat',
  { apiKey: process.env.GITHUB_TOKEN! },
  {
    // Override baseURL (e.g., for GitHub Enterprise)
    baseURL: 'https://github.mycompany.com/api/v3',

    // Add description
    description: 'GitHub connector for CI/CD automation',

    // Set display name
    displayName: 'GitHub (Production)',

    // Configure timeout
    timeout: 30000,

    // Enable logging
    logging: true,
  }
);
```

### Complete Vendor Reference

#### Communication (4 vendors)

| Vendor | ID | Auth Methods | Credentials URL |
|--------|-----|-------------|-----------------|
| Slack | `slack` | `bot-token`, `oauth-user` | [api.slack.com/apps](https://api.slack.com/apps) |
| Discord | `discord` | `bot-token`, `oauth-user` | [discord.com/developers](https://discord.com/developers/applications) |
| Telegram | `telegram` | `bot-token` | [t.me/BotFather](https://t.me/BotFather) |
| Microsoft Teams | `microsoft-teams` | `oauth-user`, `client-credentials` | [Azure Portal](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps) |

#### Development (7 vendors)

| Vendor | ID | Auth Methods | Credentials URL |
|--------|-----|-------------|-----------------|
| GitHub | `github` | `pat`, `oauth-user`, `github-app` | [github.com/settings/developers](https://github.com/settings/developers) |
| GitLab | `gitlab` | `pat`, `oauth-user` | [gitlab.com/-/profile/personal_access_tokens](https://gitlab.com/-/profile/personal_access_tokens) |
| Bitbucket | `bitbucket` | `app-password`, `oauth-user` | [bitbucket.org/account/settings/app-passwords](https://bitbucket.org/account/settings/app-passwords/) |
| Jira | `jira` | `api-token`, `oauth-3lo` | [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |
| Linear | `linear` | `api-key`, `oauth-user` | [linear.app/settings/api](https://linear.app/settings/api) |
| Asana | `asana` | `pat`, `oauth-user` | [app.asana.com/0/developer-console](https://app.asana.com/0/developer-console) |
| Trello | `trello` | `api-key`, `oauth-user` | [trello.com/power-ups/admin](https://trello.com/power-ups/admin) |

#### Productivity (5 vendors)

| Vendor | ID | Auth Methods | Credentials URL |
|--------|-----|-------------|-----------------|
| Notion | `notion` | `internal-token`, `oauth-user` | [notion.so/my-integrations](https://www.notion.so/my-integrations) |
| Airtable | `airtable` | `pat`, `oauth-user` | [airtable.com/create/tokens](https://airtable.com/create/tokens) |
| Google Workspace | `google-workspace` | `oauth-user`, `service-account` | [GCP Console](https://console.cloud.google.com/apis/credentials) |
| Microsoft 365 | `microsoft-365` | `oauth-user`, `client-credentials` | [Azure Portal](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps) |
| Confluence | `confluence` | `api-token`, `oauth-3lo` | [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |

#### CRM (3 vendors)

| Vendor | ID | Auth Methods | Credentials URL |
|--------|-----|-------------|-----------------|
| Salesforce | `salesforce` | `oauth-user`, `jwt-bearer` | [Salesforce Connected Apps](https://login.salesforce.com/lightning/setup/ConnectedApplication) |
| HubSpot | `hubspot` | `api-key`, `oauth-user` | [developers.hubspot.com](https://developers.hubspot.com/get-started) |
| Pipedrive | `pipedrive` | `api-token`, `oauth-user` | [app.pipedrive.com/settings/api](https://app.pipedrive.com/settings/api) |

#### Payments (2 vendors)

| Vendor | ID | Auth Methods | Credentials URL |
|--------|-----|-------------|-----------------|
| Stripe | `stripe` | `api-key`, `oauth-connect` | [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) |
| PayPal | `paypal` | `oauth-client-credentials` | [developer.paypal.com/dashboard](https://developer.paypal.com/dashboard/applications) |

#### Cloud (3 vendors)

| Vendor | ID | Auth Methods | Credentials URL |
|--------|-----|-------------|-----------------|
| AWS | `aws` | `access-key` | [AWS IAM Console](https://console.aws.amazon.com/iam/home#/security_credentials) |
| GCP | `gcp` | `service-account` | [GCP Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) |
| Azure | `azure` | `client-credentials` | [Azure Portal](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps) |

#### Storage (4 vendors)

| Vendor | ID | Auth Methods | Credentials URL |
|--------|-----|-------------|-----------------|
| Dropbox | `dropbox` | `oauth-user` | [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps) |
| Box | `box` | `oauth-user`, `client-credentials` | [developer.box.com/console](https://developer.box.com/console) |
| Google Drive | `google-drive` | `oauth-user`, `service-account` | [GCP Console](https://console.cloud.google.com/apis/credentials) |
| OneDrive | `onedrive` | `oauth-user` | [Azure Portal](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps) |

#### Email (3 vendors)

| Vendor | ID | Auth Methods | Credentials URL |
|--------|-----|-------------|-----------------|
| SendGrid | `sendgrid` | `api-key` | [app.sendgrid.com/settings/api_keys](https://app.sendgrid.com/settings/api_keys) |
| Mailchimp | `mailchimp` | `api-key`, `oauth-user` | [admin.mailchimp.com/account/api](https://admin.mailchimp.com/account/api/) |
| Postmark | `postmark` | `server-token`, `account-token` | [account.postmarkapp.com/api_tokens](https://account.postmarkapp.com/api_tokens) |

#### Monitoring (3 vendors)

| Vendor | ID | Auth Methods | Credentials URL |
|--------|-----|-------------|-----------------|
| Datadog | `datadog` | `api-key` | [app.datadoghq.com/organization-settings/api-keys](https://app.datadoghq.com/organization-settings/api-keys) |
| PagerDuty | `pagerduty` | `api-key`, `oauth-user` | [PagerDuty API Keys](https://support.pagerduty.com/main/docs/api-access-keys) |
| Sentry | `sentry` | `auth-token`, `oauth-user` | [sentry.io/settings/account/api/auth-tokens](https://sentry.io/settings/account/api/auth-tokens/) |

#### Search (4 vendors)

| Vendor | ID | Auth Methods | Credentials URL |
|--------|-----|-------------|-----------------|
| Serper | `serper` | `api-key` | [serper.dev/api-key](https://serper.dev/api-key) |
| Brave Search | `brave-search` | `api-key` | [brave.com/search/api](https://brave.com/search/api/) |
| Tavily | `tavily` | `api-key` | [tavily.com/#api](https://tavily.com/#api) |
| RapidAPI Search | `rapidapi-search` | `api-key` | [rapidapi.com/developer/dashboard](https://rapidapi.com/developer/dashboard) |

#### Scrape (1 vendor)

| Vendor | ID | Auth Methods | Credentials URL |
|--------|-----|-------------|-----------------|
| ZenRows | `zenrows` | `api-key` | [zenrows.com/register](https://www.zenrows.com/register) |

#### Other (4 vendors)

| Vendor | ID | Auth Methods | Credentials URL |
|--------|-----|-------------|-----------------|
| Twilio | `twilio` | `api-key`, `api-key-sid` | [Twilio Console](https://console.twilio.com/us1/account/keys-credentials/api-keys) |
| Zendesk | `zendesk` | `api-token`, `oauth-user` | [Zendesk API Tokens](https://support.zendesk.com/hc/en-us/articles/4408889192858) |
| Intercom | `intercom` | `access-token`, `oauth-user` | [developers.intercom.com](https://developers.intercom.com/docs/build-an-integration) |
| Shopify | `shopify` | `access-token`, `oauth-user` | [partners.shopify.com](https://partners.shopify.com/) |

### Template vs Manual Configuration

**Use templates when:**
- Setting up a well-known service
- You want sensible defaults for headers, URLs, and scopes
- You want the credentials setup URL handy

**Use manual Connector.create() when:**
- Connecting to a custom API not in the template list
- You need complete control over configuration
- The service has non-standard authentication

```typescript
// Template approach (recommended for supported vendors)
createConnectorFromTemplate('my-github', 'github', 'pat', {
  apiKey: process.env.GITHUB_TOKEN!
});

// Manual approach (for custom/unsupported APIs)
Connector.create({
  name: 'my-custom-api',
  serviceType: 'custom',
  auth: {
    type: 'api_key',
    apiKey: process.env.CUSTOM_API_KEY!,
    headerName: 'X-Custom-Auth',
    headerPrefix: '',
  },
  baseURL: 'https://api.custom-service.com/v1',
});
```

---

## OAuth for External APIs

The library includes full OAuth 2.0 support for external APIs.

### Basic OAuth Setup

```typescript
import { OAuthManager, FileStorage } from '@everworker/oneringai';

const oauth = new OAuthManager({
  flow: 'authorization_code',
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  redirectUri: 'http://localhost:3000/callback',
  scope: 'repo user',

  // Token storage
  storage: new FileStorage({
    directory: './tokens',
    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY,
  }),
});

// Start OAuth flow
const authUrl = await oauth.startAuthFlow('user-123');
console.log('Visit:', authUrl);

// After user authorizes and you receive the code:
const token = await oauth.handleCallback('user-123', code);

// Use token
const userToken = await oauth.getToken('user-123');
```

### Authenticated Fetch

```typescript
import { createAuthenticatedFetch } from '@everworker/oneringai';

// Create connector for external API
Connector.create({
  name: 'github',
  vendor: Vendor.Custom,
  auth: {
    type: 'oauth',
    flow: 'authorization_code',
    accessToken: userToken.access_token,
    refreshToken: userToken.refresh_token,
    expiresAt: userToken.expires_at,
  },
});

// Create authenticated fetch
const githubFetch = createAuthenticatedFetch('github');

// Make API calls (automatically refreshes tokens)
const response = await githubFetch('https://api.github.com/user/repos');
const repos = await response.json();
```

### OAuth as a Connector

```typescript
// Create connector with OAuth
Connector.create({
  name: 'microsoft-graph',
  vendor: Vendor.Custom,
  baseURL: 'https://graph.microsoft.com/v1.0',
  auth: {
    type: 'oauth',
    flow: 'authorization_code',
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  },
});

// Use in tools
const listEmailsTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'list_emails',
      description: 'List user emails',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  execute: async () => {
    const fetch = createAuthenticatedFetch('microsoft-graph');
    const response = await fetch('/me/messages');
    return await response.json();
  },
};

// Use with agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [listEmailsTool],
});

await agent.run('Show me my recent emails');
```

---

## Model Registry

The library includes a comprehensive model registry with metadata for 23+ models.

### Using the Model Registry

```typescript
import {
  getModelInfo,
  calculateCost,
  getModelsByVendor,
  getActiveModels,
  LLM_MODELS,
  Vendor,
} from '@everworker/oneringai';

// Get model information
const model = getModelInfo('gpt-5.2-thinking');
console.log(model.vendor);                    // 'openai'
console.log(model.features.input.tokens);     // 400000
console.log(model.features.output.tokens);    // 128000
console.log(model.features.reasoning);        // true
console.log(model.features.vision);           // true
console.log(model.features.input.cpm);        // 1.75 (cost per million)
console.log(model.features.output.cpm);       // 14

// Calculate API costs
const cost = calculateCost('gpt-5.2-thinking', 50000, 2000);
console.log(`Cost: $${cost}`); // $0.1155

// With caching (90% discount)
const cachedCost = calculateCost('gpt-5.2-thinking', 50000, 2000, {
  useCachedInput: true
});
console.log(`Cached: $${cachedCost}`); // $0.0293

// Get all models for a vendor
const openaiModels = getModelsByVendor(Vendor.OpenAI);
console.log(openaiModels.map(m => m.name));
// ['gpt-5.2-thinking', 'gpt-5.2-instant', 'gpt-5.1', ...]

// Get all active models
const activeModels = getActiveModels();
console.log(activeModels.length); // 23

// Use model constants
const model = LLM_MODELS[Vendor.OpenAI].GPT_5_2_THINKING;
console.log(model); // 'gpt-5.2-thinking'
```

### Model Information

```typescript
interface ILLMDescription {
  name: string;
  vendor: string;
  releaseDate: string;
  knowledgeCutoff?: string;
  active: boolean;

  features: {
    input: {
      tokens: number;
      cpm: number;
      cachedCpm?: number;
    };
    output: {
      tokens: number;
      cpm: number;
    };

    // Feature flags
    reasoning: boolean;
    streaming: boolean;
    structuredOutput: boolean;
    functionCalling: boolean;
    vision: boolean;
    audio: boolean;
    video: boolean;
    extendedThinking: boolean;
    batchAPI: boolean;
    promptCaching: boolean;
  };
}
```

### Available Models

**OpenAI (11 models):**
- GPT-5.2: thinking, instant, pro, codex
- GPT-5: standard, 5.1, mini, nano
- GPT-4.1: standard, mini
- o3-mini

**Anthropic (5 models):**
- Claude 4.5: Opus, Sonnet, Haiku
- Claude 4.x: Opus 4.1, Sonnet 4

**Google (7 models):**
- Gemini 3: Flash preview, Pro, Pro Image
- Gemini 2.5: Pro, Flash, Flash-Lite, Flash Image

---

## Scoped Connector Registry

In multi-user or multi-tenant systems, you often need to limit which connectors are visible to which users. The **Scoped Connector Registry** provides a pluggable access control layer over the Connector registry — a lightweight filtered view gated by a user-provided policy predicate. Zero changes to the existing API; scoping is entirely opt-in.

### Access Control Policies

Define a policy that determines which connectors a given context can access:

```typescript
import { Connector, ScopedConnectorRegistry } from '@everworker/oneringai';
import type { IConnectorAccessPolicy, ConnectorAccessContext } from '@everworker/oneringai';

// Tag-based policy: connector must have a matching tenant tag
const tenantPolicy: IConnectorAccessPolicy = {
  canAccess: (connector, context) => {
    const tags = connector.config.tags as string[] | undefined;
    const tenantId = context.tenantId as string;
    return !!tags && tags.includes(tenantId);
  },
};

// Role-based policy
const rolePolicy: IConnectorAccessPolicy = {
  canAccess: (connector, context) => {
    const roles = context.roles as string[];
    if (roles.includes('admin')) return true;
    // Non-admins can only see connectors in their department
    const dept = connector.config.tags as string[] | undefined;
    return !!dept && dept.includes(context.department as string);
  },
};
```

**Policy rules:**
- `canAccess()` is **synchronous** — access checks must be fast, policy data should be in-memory
- `context` is an opaque `Record<string, unknown>` — the library imposes no structure
- The policy receives the full `Connector` instance so it can inspect `config.tags`, `vendor`, `serviceType`, `baseURL`, etc.

### Setting a Global Policy

```typescript
// Set the policy (required before calling Connector.scoped())
Connector.setAccessPolicy(tenantPolicy);

// Check current policy
const current = Connector.getAccessPolicy(); // IConnectorAccessPolicy | null

// Clear the policy
Connector.setAccessPolicy(null);
```

### Creating Scoped Views

```typescript
// Create a scoped view for tenant "acme"
const acmeRegistry = Connector.scoped({ tenantId: 'acme' });

// Only connectors tagged with "acme" are visible
acmeRegistry.list();       // ['acme-openai', 'acme-slack']
acmeRegistry.size();       // 2
acmeRegistry.has('other'); // false

// Accessing a denied connector gives the same "not found" error
// as a truly non-existent one — no information leakage
acmeRegistry.get('competitor-key');
// throws: "Connector 'competitor-key' not found. Available: acme-openai, acme-slack"
```

You can also create a `ScopedConnectorRegistry` directly with any policy (not just the global one):

```typescript
import { ScopedConnectorRegistry } from '@everworker/oneringai';

const custom = new ScopedConnectorRegistry(myPolicy, { userId: 'user-123' });
```

### Unfiltered Admin View

When your code accepts `IConnectorRegistry` but you want the full, unfiltered view:

```typescript
import type { IConnectorRegistry } from '@everworker/oneringai';

// Returns an IConnectorRegistry that delegates to Connector static methods
const adminRegistry: IConnectorRegistry = Connector.asRegistry();

// Full access, no filtering
adminRegistry.list(); // all connectors
```

### Using with Agent

Pass a scoped registry to `Agent.create()` via the `registry` option:

```typescript
const registry = Connector.scoped({ tenantId: 'acme' });

const agent = Agent.create({
  connector: 'acme-openai',  // Resolved via scoped registry
  model: 'gpt-4',
  registry,
});

// The agent can only see connectors accessible to 'acme'
```

If the connector name isn't accessible through the scoped registry, agent creation throws the standard "Connector not found" error listing only visible connectors.

### Using with ConnectorTools

All major `ConnectorTools` methods accept an optional `{ registry }` option:

```typescript
const registry = Connector.scoped({ tenantId: 'acme' });

// Get tools for a specific connector (resolved via scoped registry)
const tools = ConnectorTools.for('acme-slack', undefined, { registry });

// Discover tools for all accessible connectors
const allTools = ConnectorTools.discoverAll(undefined, { registry });

// Find connectors by service type (searches only accessible connectors)
const github = ConnectorTools.findConnector('github', { registry });
const allGithubs = ConnectorTools.findConnectors('github', { registry });
```

### Multi-Tenant Example

```typescript
import { Connector, Agent, Vendor, ConnectorTools } from '@everworker/oneringai';
import type { IConnectorAccessPolicy } from '@everworker/oneringai';

// 1. Create connectors with tenant tags
Connector.create({
  name: 'acme-openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.ACME_OPENAI_KEY! },
  tags: ['acme'],
});

Connector.create({
  name: 'globex-openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.GLOBEX_OPENAI_KEY! },
  tags: ['globex'],
});

Connector.create({
  name: 'acme-github',
  auth: { type: 'api_key', apiKey: process.env.ACME_GITHUB_TOKEN! },
  baseURL: 'https://api.github.com',
  tags: ['acme'],
});

// 2. Set up the policy
const policy: IConnectorAccessPolicy = {
  canAccess: (connector, ctx) => {
    const tags = connector.config.tags as string[] | undefined;
    return !!tags && tags.includes(ctx.tenantId as string);
  },
};
Connector.setAccessPolicy(policy);

// 3. Per-request: create a scoped view
function handleRequest(tenantId: string) {
  const registry = Connector.scoped({ tenantId });

  // This tenant can only see their own connectors
  const agent = Agent.create({
    connector: `${tenantId}-openai`,
    model: 'gpt-4',
    registry,
  });

  // Discover tools only for this tenant's connectors
  const tools = ConnectorTools.discoverAll(undefined, { registry });

  return { agent, tools };
}

// Acme sees: acme-openai, acme-github
handleRequest('acme');

// Globex sees: globex-openai
handleRequest('globex');
```

### IConnectorRegistry Interface

The `IConnectorRegistry` interface covers the read-only subset of Connector static methods:

| Method | Description |
|--------|-------------|
| `get(name)` | Get connector by name (throws if not found/denied) |
| `has(name)` | Check if connector exists and is accessible |
| `list()` | List accessible connector names |
| `listAll()` | List accessible connector instances |
| `size()` | Count of accessible connectors |
| `getDescriptionsForTools()` | Formatted descriptions for LLM tool parameters |
| `getInfo()` | Connector info map for UI/documentation |

---

## Advanced Features

### Hooks & Lifecycle Events

#### Lifecycle Hooks (via AgentConfig)

Intercept tool execution, compaction, and error events:

```typescript
import { Agent } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],

  // Lifecycle hooks
  lifecycleHooks: {
    beforeToolExecution: async (context) => {
      console.log(`About to call: ${context.toolName}`);
      // Throw to prevent execution
    },
    afterToolExecution: async (result) => {
      console.log(`Tool ${result.toolName} completed in ${result.durationMs}ms`);
    },
    beforeCompaction: async (context) => {
      console.log(`Compaction starting for agent ${context.agentId}`);
    },
    afterCompaction: async (log, tokensFreed) => {
      console.log(`Compaction freed ${tokensFreed} tokens`);
    },
    onError: async (error, context) => {
      console.error(`Error in ${context.phase}: ${error.message}`);
    },
  },
});
```

#### Execution Hooks (via HookConfig)

For finer control over the agentic loop, use the `hooks` config with named hook points:

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  hooks: {
    'before:tool': async (context) => {
      console.log(`Calling ${context.tool.name}`);
      return context.args; // Return modified args
    },
    'after:tool': async (context) => {
      console.log(`Result: ${JSON.stringify(context.result)}`);
      return context.result; // Return modified result
    },
    'approve:tool': async (context) => {
      // Return approval decision
      return { approved: true, message: 'Approved' };
    },
  },
});
```

#### Context Events

Subscribe to context events for monitoring (as used in the hosea reference app):

```typescript
const ctx = agent.context;

ctx.on('compaction:starting', ({ timestamp, targetTokensToFree }) => {
  console.log(`Compaction starting: need to free ~${targetTokensToFree} tokens`);
});

ctx.on('context:compacted', ({ tokensFreed }) => {
  console.log(`Compaction complete: freed ${tokensFreed} tokens`);
});
```

### Circuit Breaker

Protect external services:

```typescript
import { CircuitBreaker } from '@everworker/oneringai';

const breaker = new CircuitBreaker({
  failureThreshold: 5,        // Open after 5 failures
  successThreshold: 2,        // Close after 2 successes
  timeout: 5000,              // 5 second timeout
  resetTimeout: 30000,        // Try again after 30 seconds
});

// Wrap API calls
const result = await breaker.execute(async () => {
  return await externalAPI.call();
});

// Monitor state
breaker.on('stateChange', ({ from, to }) => {
  console.log(`Circuit: ${from} → ${to}`);
});

// Get metrics
const metrics = breaker.getMetrics();
console.log(metrics);
// {
//   state: 'closed',
//   failures: 0,
//   successes: 10,
//   totalCalls: 10,
//   consecutiveFailures: 0
// }
```

### Retry with Backoff

```typescript
import { retryWithBackoff } from '@everworker/oneringai';

const result = await retryWithBackoff(
  async () => {
    // Your operation
    return await apiCall();
  },
  {
    maxAttempts: 5,
    initialDelay: 1000,     // Start with 1 second
    maxDelay: 30000,        // Cap at 30 seconds
    backoffFactor: 2,       // Double each time
    jitter: true,           // Add randomness
  }
);
```

### Logging

```typescript
import { logger } from '@everworker/oneringai';

// Set log level
logger.setLevel('debug'); // 'debug' | 'info' | 'warn' | 'error'

// Log messages
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');

// Structured logging
logger.info('User action', { userId: '123', action: 'login' });
```

### Metrics

```typescript
import { metrics, setMetricsCollector, ConsoleMetrics } from '@everworker/oneringai';

// Use console metrics
setMetricsCollector(new ConsoleMetrics());

// Track metrics
metrics.counter('requests', 1, { endpoint: '/api/chat' });
metrics.gauge('active_connections', 42);
metrics.histogram('response_time', 125.5, { endpoint: '/api/chat' });

// Custom metrics collector
class CustomMetrics {
  counter(name: string, value: number, tags?: Record<string, string>) {
    // Send to your metrics service
  }

  gauge(name: string, value: number, tags?: Record<string, string>) {
    // Send to your metrics service
  }

  histogram(name: string, value: number, tags?: Record<string, string>) {
    // Send to your metrics service
  }
}

setMetricsCollector(new CustomMetrics());
```

---

## Production Deployment

### Environment Variables

```env
# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# OAuth (32-byte hex key)
OAUTH_ENCRYPTION_KEY=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789

# Optional: Base URLs for proxies
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Optional: Timeouts
REQUEST_TIMEOUT=30000
```

### Error Handling

```typescript
import {
  Agent,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderContextLengthError,
  ToolExecutionError,
} from '@everworker/oneringai';

const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });

try {
  const response = await agent.run('Hello');
} catch (error) {
  if (error instanceof ProviderAuthError) {
    console.error('Authentication failed:', error.message);
    // Check API key
  } else if (error instanceof ProviderRateLimitError) {
    console.error('Rate limit exceeded:', error.message);
    // Retry with backoff
  } else if (error instanceof ProviderContextLengthError) {
    console.error('Context too long:', error.message);
    // Use context management
  } else if (error instanceof ToolExecutionError) {
    console.error('Tool failed:', error.message);
    // Handle tool error
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Best Practices

#### 1. Use Named Connectors

```typescript
// Good: Named connectors
Connector.create({ name: 'openai-main', vendor: Vendor.OpenAI, auth: { ... } });
Connector.create({ name: 'openai-backup', vendor: Vendor.OpenAI, auth: { ... } });

const agent = Agent.create({ connector: 'openai-main', model: 'gpt-4' });

// Bad: Passing keys directly
const agent = Agent.create({
  connector: { vendor: Vendor.OpenAI, auth: { apiKey: '...' } },
  model: 'gpt-4'
});
```

#### 2. Handle Rate Limits

```typescript
import { retryWithBackoff } from '@everworker/oneringai';

const response = await retryWithBackoff(
  () => agent.run(input),
  {
    maxAttempts: 3,
    initialDelay: 1000,
    backoffFactor: 2,
  }
);
```

#### 3. Monitor Context Usage

```typescript
// Monitor context budget
const { budget } = await agent.context.prepare();
if (budget.utilizationPercent > 80) {
  console.warn(`Context at ${budget.utilizationPercent}%`);
}
```

#### 4. Use Circuit Breakers

```typescript
import { CircuitBreaker } from '@everworker/oneringai';

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000,
});

const safeTool: ToolFunction = {
  // ...
  execute: async (args) => {
    return await breaker.execute(() => externalAPI.call(args));
  },
};
```

#### 5. Secure OAuth Tokens

```typescript
// Always use encryption for OAuth tokens
const oauth = new OAuthManager({
  // ...
  storage: new FileStorage({
    directory: './tokens',
    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY, // Required!
  }),
});
```

#### 6. Clean Up Resources (IDisposable Pattern)

The library uses the **IDisposable pattern** for proper resource cleanup. All major classes implement this pattern with:
- `destroy(): void` - Releases all resources (safe to call multiple times)
- `isDestroyed: boolean` - Check if already destroyed

```typescript
// Agent - cascades to AgentContextNextGen → ToolManager → CircuitBreakers
const agent = Agent.create({ ... });
agent.onCleanup(() => {
  console.log('Cleaning up...');
});
agent.destroy();  // Cleans up all child resources

// Standalone ToolManager
const toolManager = new ToolManager();
toolManager.destroy();  // Cleans up circuit breakers and listeners

// Check before use
if (!toolManager.isDestroyed) {
  await toolManager.execute('my_tool', args);
}
```

**Classes implementing IDisposable:**
- `Agent`
- `AgentContextNextGen`
- `ToolManager`
- `WorkingMemoryPluginNextGen`

### Performance Tips

1. **Use appropriate models:**
   - GPT-4.1-nano/Claude Haiku 4.5 for simple tasks
   - GPT-4.1/Claude Sonnet 4.5 for complex tasks
   - GPT-5.2/Claude Opus 4.5 for critical tasks

2. **Leverage caching:**
   - Prompt caching (Anthropic/OpenAI)

3. **Use streaming:**
   - Better user experience
   - Lower perceived latency

4. **Manage context:**
   - The default `algorithmic` strategy (75% threshold) handles most use cases
   - Enable `workingMemory` for automatic tool result offloading
   - Register custom strategies via `StrategyRegistry` for specialized needs

5. **Batch requests:**
   - Batch API calls where possible

---

## Examples

### Complete Examples

See the `examples/` directory:

```bash
# Basic examples
npm run example:text               # Simple text generation
npm run example:agent              # Basic agent with tools
npm run example:conversation       # Multi-turn conversation
npm run example:chat               # Interactive chat
npm run example:vision             # Image analysis
npm run example:providers          # Multi-provider comparison

# Tools and hooks
npm run example:json-tool          # JSON manipulation tool
npm run example:hooks              # Agent lifecycle hooks
npm run example:web                # Web research agent

# OAuth examples
npm run example:oauth              # OAuth demo
npm run example:oauth-registry     # OAuth registry
```

### Quick Recipes

#### Multi-Provider Setup

```typescript
// Configure all providers
Connector.create({ name: 'openai', vendor: Vendor.OpenAI, auth: { ... } });
Connector.create({ name: 'anthropic', vendor: Vendor.Anthropic, auth: { ... } });
Connector.create({ name: 'google', vendor: Vendor.Google, auth: { ... } });

// Create agents for each
const openaiAgent = Agent.create({ connector: 'openai', model: 'gpt-4' });
const claudeAgent = Agent.create({ connector: 'anthropic', model: 'claude-opus-4-5-20251101' });
const geminiAgent = Agent.create({ connector: 'google', model: 'gemini-3-flash-preview' });

// Compare responses
const [r1, r2, r3] = await Promise.all([
  openaiAgent.run(prompt),
  claudeAgent.run(prompt),
  geminiAgent.run(prompt),
]);
```

#### RAG (Retrieval-Augmented Generation)

```typescript
const searchTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description: 'Search internal knowledge base',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    },
  },
  execute: async (args) => {
    // Search your vector database
    const results = await vectorDB.search(args.query);
    return { results };
  },
};

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [searchTool],
  instructions: `You are a helpful assistant with access to a knowledge base.
                 Always search the knowledge base before answering questions.`,
});

const response = await agent.run('What is our return policy?');
```

#### Research Agent with Memory

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [searchTool, scrapeWebTool],
  context: {
    features: { workingMemory: true },
  },
});

// Agent uses memory tools to store research findings
const response = await agent.run(`
  Research our top 5 competitors.
  For each competitor:
  1. Search for their information
  2. Scrape their website
  3. Store key findings in memory
  4. Create a comprehensive report
`);
```

---

## Support & Resources

- **GitHub:** https://github.com/Integrail/oneringai
- **Issues:** https://github.com/Integrail/oneringai/issues
- **Examples:** `/examples` directory in repo
- **TypeScript Docs:** Full IntelliSense support

---

## License

MIT License - see LICENSE file for details.

---

**Last Updated:** 2026-02-07
**Version:** 0.1.3
