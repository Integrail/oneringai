# @everworker/oneringai

> **A unified AI agent library with multi-provider support for text generation, image/video generation, audio (TTS/STT), and agentic workflows.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start) — Installation, basic usage, tools, vision, audio, images, video, search, scraping
- [Supported Providers](#supported-providers)
- [Key Features](#key-features)
  - [1. Agent with Plugins](#1-agent-with-plugins)
  - [2. Dynamic Tool Management](#2-dynamic-tool-management-new)
  - [3. Tool Execution Plugins](#3-tool-execution-plugins-new)
  - [4. Session Persistence](#4-session-persistence)
  - [5. Working Memory](#5-working-memory)
  - [6. Research with Search Tools](#6-research-with-search-tools)
  - [7. Context Management](#7-context-management)
  - [8. InContextMemory](#8-incontextmemory)
  - [9. Persistent Instructions](#9-persistent-instructions)
  - [10. Direct LLM Access](#10-direct-llm-access)
  - [11. Audio Capabilities](#11-audio-capabilities)
  - [12. Model Registry](#12-model-registry)
  - [13. Streaming](#13-streaming)
  - [14. OAuth for External APIs](#14-oauth-for-external-apis)
  - [15. Developer Tools](#15-developer-tools)
  - [16. Document Reader](#16-document-reader-new) — PDF, DOCX, XLSX, PPTX, CSV, HTML, images
  - [17. External API Integration](#17-external-api-integration) — Scoped Registry, Vendor Templates, Tool Discovery
- [MCP Integration](#mcp-model-context-protocol-integration)
- [Documentation](#documentation)
- [Examples](#examples)
- [Development](#development)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

<!-- For in-depth guides and full API reference, see the docs section below -->

## Documentation

> **Start here if you're looking for detailed docs or the full API reference.**

| Document | Description |
|----------|-------------|
| **[User Guide](./USER_GUIDE.md)** | Comprehensive guide covering every feature with examples — connectors, agents, context, plugins, audio, video, search, MCP, OAuth, and more |
| **[API Reference](./API_REFERENCE.md)** | Auto-generated reference for all 600+ public exports — classes, interfaces, types, and functions with signatures |
| [CHANGELOG](./CHANGELOG.md) | Version history and migration notes |
| [MCP Integration](./MCP_INTEGRATION.md) | Model Context Protocol setup and usage |
| [Architecture (CLAUDE.md)](./CLAUDE.md) | Internal architecture guide |
| [Testing Guide](./TESTING.md) | How to run and write tests |

---

## HOSEA APP
We realize that library alone in these times is not enough to get you excited, so we built a FREE FOREVER desktop app on top of this library to showcase its power! It's as easy to start using as cloning this library's repo, and then `cd apps/hosea` and then `npm install` and then `npm run dev`. Or watch the video first:

[![Watch the demo](https://img.youtube.com/vi/_LzDiuOQD8Y/maxresdefault.jpg)](https://www.youtube.com/watch?v=_LzDiuOQD8Y)

Or read the more detailed installation / setup instructions [here](https://github.com/Integrail/oneringai/blob/main/apps/hosea/README.md)

Better to see once and then dig in the code! :)

## Features

- ✨ **Unified API** - One interface for 10+ AI providers (OpenAI, Anthropic, Google, Groq, DeepSeek, and more)
- 🔑 **Connector-First Architecture** - Single auth system with support for multiple keys per vendor
- 📊 **Model Registry** - Complete metadata for 23+ latest (2026) models with pricing and features
- 🎤 **Audio Capabilities** - Text-to-Speech (TTS) and Speech-to-Text (STT) with OpenAI and Groq
- 🖼️ **Image Generation** - DALL-E 3, gpt-image-1, Google Imagen 4 with editing and variations
- 🎬 **Video Generation** - NEW: OpenAI Sora 2 and Google Veo 3 for AI video creation
- 🔍 **Web Search** - Connector-based search with Serper, Brave, Tavily, and RapidAPI providers
- 🔌 **NextGen Context** - Clean, plugin-based context management with `AgentContextNextGen`
- 🎛️ **Dynamic Tool Management** - Enable/disable tools at runtime, namespaces, priority-based selection
- 🔌 **Tool Execution Plugins** - NEW: Pluggable pipeline for logging, analytics, UI updates, custom behavior
- 💾 **Session Persistence** - Save and resume conversations with full state restoration
- 👤 **Multi-User Support** - Set `userId` once, flows automatically to all tool executions and session metadata
- 🔒 **Connector Allowlist** - Restrict agents to a named subset of connectors, composable with access policies
- 🤖 **Universal Agent** - ⚠️ *Deprecated* - Use `Agent` with plugins instead
- 🤖 **Task Agents** - ⚠️ *Deprecated* - Use `Agent` with `WorkingMemoryPluginNextGen`
- 🔬 **Research Agent** - ⚠️ *Deprecated* - Use `Agent` with search tools
- 🎯 **Context Management** - Algorithmic compaction with tool-result-to-memory offloading
- 📌 **InContextMemory** - Live key-value storage directly in LLM context with optional UI display (`showInUI`)
- 📝 **Persistent Instructions** - NEW: Agent-level custom instructions that persist across sessions on disk
- 🛠️ **Agentic Workflows** - Built-in tool calling and multi-turn conversations
- 🔧 **Developer Tools** - NEW: Filesystem and shell tools for coding assistants (read, write, edit, grep, glob, bash)
- 🖥️ **Desktop Automation** - NEW: OS-level computer use — screenshot, mouse, keyboard, and window control for vision-driven agent loops
- 📄 **Document Reader** - NEW: Universal file-to-text converter — PDF, DOCX, XLSX, PPTX, CSV, HTML, images auto-converted to markdown
- 🔌 **MCP Integration** - NEW: Model Context Protocol client for seamless tool discovery from local and remote servers
- 👁️ **Vision Support** - Analyze images with AI across all providers
- 📋 **Clipboard Integration** - Paste screenshots directly (like Claude Code!)
- 🔐 **Scoped Connector Registry** - NEW: Pluggable access control for multi-tenant connector isolation
- 🔐 **OAuth 2.0** - Full OAuth support for external APIs with encrypted token storage
- 📦 **Vendor Templates** - NEW: Pre-configured auth templates for 43+ services (GitHub, Slack, Stripe, etc.)
- 🔄 **Streaming** - Real-time responses with event streams
- 📝 **TypeScript** - Full type safety and IntelliSense support

> **v0.2.0 — Multi-User Support:** Set `userId` once on an agent and it automatically flows to all tool executions, OAuth token retrieval, session metadata, and connector scoping. Combine with `connectors` allowlist and access policies for complete multi-tenant isolation. See [Multi-User Support](#multi-user-support-userid) and [Connector Allowlist](#connector-allowlist-connectors) in the User Guide.

## Quick Start

### Installation

```bash
npm install @everworker/oneringai
```

### Basic Usage

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

// 3. Run
const response = await agent.run('What is the capital of France?');
console.log(response.output_text);
// Output: "The capital of France is Paris."
```

### With Tools

```typescript
import { ToolFunction } from '@everworker/oneringai';

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
import { createMessageWithImages } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4o',
});

const response = await agent.run(
  createMessageWithImages('What is in this image?', ['./photo.jpg'])
);
```

### Audio (NEW)

```typescript
import { TextToSpeech, SpeechToText } from '@everworker/oneringai';

// Text-to-Speech
const tts = TextToSpeech.create({
  connector: 'openai',
  model: 'tts-1-hd',
  voice: 'nova',
});

await tts.toFile('Hello, world!', './output.mp3');

// Speech-to-Text
const stt = SpeechToText.create({
  connector: 'openai',
  model: 'whisper-1',
});

const result = await stt.transcribeFile('./audio.mp3');
console.log(result.text);
```

### Image Generation (NEW)

```typescript
import { ImageGeneration } from '@everworker/oneringai';

// OpenAI DALL-E
const imageGen = ImageGeneration.create({ connector: 'openai' });

const result = await imageGen.generate({
  prompt: 'A futuristic city at sunset',
  model: 'dall-e-3',
  size: '1024x1024',
  quality: 'hd',
});

// Save to file
const buffer = Buffer.from(result.data[0].b64_json!, 'base64');
await fs.writeFile('./output.png', buffer);

// Google Imagen
const googleGen = ImageGeneration.create({ connector: 'google' });

const googleResult = await googleGen.generate({
  prompt: 'A colorful butterfly in a garden',
  model: 'imagen-4.0-generate-001',
});
```

### Video Generation (NEW)

```typescript
import { VideoGeneration } from '@everworker/oneringai';

// OpenAI Sora
const videoGen = VideoGeneration.create({ connector: 'openai' });

// Start video generation (async - returns a job)
const job = await videoGen.generate({
  prompt: 'A cinematic shot of a sunrise over mountains',
  model: 'sora-2',
  duration: 8,
  resolution: '1280x720',
});

// Wait for completion
const result = await videoGen.waitForCompletion(job.jobId);

// Download the video
const videoBuffer = await videoGen.download(job.jobId);
await fs.writeFile('./output.mp4', videoBuffer);

// Google Veo
const googleVideo = VideoGeneration.create({ connector: 'google' });

const veoJob = await googleVideo.generate({
  prompt: 'A butterfly flying through a garden',
  model: 'veo-3.0-generate-001',
  duration: 8,
});
```

### Document Reader (NEW)

Read any document format — agents automatically get markdown text from PDFs, Word docs, spreadsheets, and more:

```typescript
import { Agent, developerTools } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: developerTools,
});

// read_file auto-converts binary documents to markdown
await agent.run('Read /path/to/report.pdf and summarize the key findings');
await agent.run('Read /path/to/data.xlsx and describe the trends');
await agent.run('Read /path/to/presentation.pptx and list all slides');
```

**Programmatic usage:**

```typescript
import { DocumentReader, readDocumentAsContent } from '@everworker/oneringai';

// Read any file to markdown pieces
const reader = DocumentReader.create();
const result = await reader.read('/path/to/report.pdf');
console.log(result.pieces); // DocumentPiece[] (text + images)

// One-call conversion to LLM Content[] (for multimodal input)
const content = await readDocumentAsContent('/path/to/slides.pptx', {
  imageFilter: { minWidth: 100, minHeight: 100 },
  imageDetail: 'auto',
});

const response = await agent.run([
  { type: 'input_text', text: 'Analyze this document:' },
  ...content,
]);
```

**Supported Formats:**
- **Office**: DOCX, PPTX, ODT, ODP, ODS, RTF (via `officeparser`)
- **Spreadsheets**: XLSX, CSV (via `exceljs`)
- **PDF** (via `unpdf`)
- **HTML** (via Readability + Turndown)
- **Text**: TXT, MD, JSON, XML, YAML
- **Images**: PNG, JPG, GIF, WEBP, SVG (pass-through as base64)

### Web Search

Connector-based web search with multiple providers:

```typescript
import { Connector, SearchProvider, ConnectorTools, Services, Agent, tools } from '@everworker/oneringai';

// Create search connector
Connector.create({
  name: 'serper-main',
  serviceType: Services.Serper,
  auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY! },
  baseURL: 'https://google.serper.dev',
});

// Option 1: Use SearchProvider directly
const search = SearchProvider.create({ connector: 'serper-main' });
const results = await search.search('latest AI developments 2026', {
  numResults: 10,
  country: 'us',
  language: 'en',
});

// Option 2: Use with Agent via ConnectorTools
const searchTools = ConnectorTools.for('serper-main');

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [...searchTools, tools.webFetch],
});

await agent.run('Search for quantum computing news and summarize');
```

**Supported Search Providers:**
- **Serper** - Google search via Serper.dev (2,500 free queries)
- **Brave** - Independent search index (privacy-focused)
- **Tavily** - AI-optimized search with summaries
- **RapidAPI** - Real-time web search (various pricing)

### Web Scraping

Enterprise web scraping with automatic fallback and bot protection bypass:

```typescript
import { Connector, ScrapeProvider, ConnectorTools, Services, Agent, tools } from '@everworker/oneringai';

// Create ZenRows connector for bot-protected sites
Connector.create({
  name: 'zenrows',
  serviceType: Services.Zenrows,
  auth: { type: 'api_key', apiKey: process.env.ZENROWS_API_KEY! },
  baseURL: 'https://api.zenrows.com/v1',
});

// Option 1: Use ScrapeProvider directly
const scraper = ScrapeProvider.create({ connector: 'zenrows' });
const result = await scraper.scrape('https://protected-site.com', {
  includeMarkdown: true,
  vendorOptions: {
    jsRender: true,        // JavaScript rendering
    premiumProxy: true,    // Residential IPs
  },
});

// Option 2: Use web_scrape tool with Agent via ConnectorTools
const scrapeTools = ConnectorTools.for('zenrows');

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [...scrapeTools, tools.webFetch],
});

// web_scrape auto-falls back: native → API
await agent.run('Scrape https://example.com and summarize');
```

**Supported Scrape Providers:**
- **ZenRows** - Enterprise scraping with JS rendering, residential proxies, anti-bot bypass
- **Jina Reader** - Clean content extraction with AI-powered readability
- **Firecrawl** - Web scraping with JavaScript rendering
- **ScrapingBee** - Headless browser scraping with proxy rotation

## Supported Providers

| Provider | Text | Vision | TTS | STT | Image | Video | Tools | Context |
|----------|------|--------|-----|-----|-------|-------|-------|---------|
| **OpenAI** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 128K |
| **Anthropic (Claude)** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | 200K |
| **Google (Gemini)** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | 1M |
| **Google Vertex AI** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | 1M |
| **Grok (xAI)** | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | 128K |
| **Groq** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | 128K |
| **Together AI** | ✅ | Some | ❌ | ❌ | ❌ | ❌ | ✅ | 128K |
| **DeepSeek** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | 64K |
| **Mistral** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | 32K |
| **Ollama** | ✅ | Varies | ❌ | ❌ | ❌ | ❌ | ✅ | Varies |
| **Custom** | ✅ | Varies | ❌ | ❌ | ❌ | ❌ | ✅ | Varies |

## Key Features

### 1. Agent with Plugins

The **Agent** class is the primary agent type, supporting all features through composable plugins:

```typescript
import { Agent, createFileContextStorage } from '@everworker/oneringai';

// Create storage for session persistence
const storage = createFileContextStorage('my-assistant');

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  userId: 'user-123',            // Flows to all tool executions automatically
  connectors: ['github', 'slack'], // Only these connectors visible to tools
  tools: [weatherTool, emailTool],
  context: {
    features: {
      workingMemory: true,      // Store/retrieve data across turns
      inContextMemory: true,    // Key-value pairs directly in context
      persistentInstructions: true,  // Agent instructions that persist to disk
    },
    agentId: 'my-assistant',
    storage,
  },
});

// Run the agent
const response = await agent.run('Check weather and email me the report');
console.log(response.output_text);

// Save session for later
await agent.context.save('session-001');
```

**Features:**
- 🔧 **Plugin Architecture** - Enable/disable features via `context.features`
- 💾 **Session Persistence** - Save/load full state with `ctx.save()` and `ctx.load()`
- 📝 **Working Memory** - Store findings with automatic eviction
- 📌 **InContextMemory** - Key-value pairs visible directly to LLM
- 🔄 **Persistent Instructions** - Agent instructions that persist across sessions

### 2. Dynamic Tool Management (NEW)

Control tools at runtime. **AgentContextNextGen is the single source of truth** - `agent.tools` and `agent.context.tools` are the same ToolManager instance:

```typescript
import { Agent } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, emailTool, databaseTool],
});

// Disable tool temporarily
agent.tools.disable('database_tool');

// Enable later
agent.tools.enable('database_tool');

// UNIFIED ACCESS: Both paths access the same ToolManager
console.log(agent.tools === agent.context.tools);  // true

// Changes via either path are immediately reflected
agent.context.tools.disable('email_tool');
console.log(agent.tools.listEnabled().includes('email_tool'));  // false

// Context-aware selection
const selected = agent.tools.selectForContext({
  mode: 'interactive',
  priority: 'high',
});

// Backward compatible
agent.addTool(newTool);        // Still works!
agent.removeTool('old_tool');  // Still works!
```

### 3. Tool Execution Plugins (NEW)

Extend tool execution with custom behavior through a pluggable pipeline architecture. Add logging, analytics, UI updates, permission prompts, or any custom logic:

```typescript
import { Agent, LoggingPlugin, type IToolExecutionPlugin } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool],
});

// Add built-in logging plugin
agent.tools.executionPipeline.use(new LoggingPlugin());

// Create a custom plugin
const analyticsPlugin: IToolExecutionPlugin = {
  name: 'analytics',
  priority: 100,

  async beforeExecute(ctx) {
    console.log(`Starting ${ctx.toolName}`);
  },

  async afterExecute(ctx, result) {
    const duration = Date.now() - ctx.startTime;
    trackToolUsage(ctx.toolName, duration);
    return result; // Must return result (can transform it)
  },

  async onError(ctx, error) {
    reportError(ctx.toolName, error);
    return undefined; // Let error propagate (or return value to recover)
  },
};

agent.tools.executionPipeline.use(analyticsPlugin);
```

**Plugin Lifecycle:**
1. `beforeExecute` - Modify args, abort execution, or pass through
2. Tool execution
3. `afterExecute` - Transform results (runs in reverse priority order)
4. `onError` - Handle/recover from errors

**Plugin Context (`PluginExecutionContext`):**
```typescript
interface PluginExecutionContext {
  toolName: string;           // Name of the tool being executed
  args: unknown;              // Original arguments (read-only)
  mutableArgs: unknown;       // Modifiable arguments
  metadata: Map<string, unknown>; // Share data between plugins
  startTime: number;          // Execution start timestamp
  tool: ToolFunction;         // The tool being executed
  executionId: string;        // Unique ID for this execution
}
```

**Built-in Plugins:**
- `LoggingPlugin` - Logs tool execution with timing and result summaries

**Pipeline Management:**
```typescript
// Add plugin
agent.tools.executionPipeline.use(myPlugin);

// Remove plugin
agent.tools.executionPipeline.remove('plugin-name');

// Check if registered
agent.tools.executionPipeline.has('plugin-name');

// Get plugin
const plugin = agent.tools.executionPipeline.get('plugin-name');

// List all plugins
const plugins = agent.tools.executionPipeline.list();
```

### 4. Session Persistence

Save and resume full context state including conversation history and plugin states:

```typescript
import { AgentContextNextGen, createFileContextStorage } from '@everworker/oneringai';

// Create storage for the agent
const storage = createFileContextStorage('my-assistant');

// Create context with storage
const ctx = AgentContextNextGen.create({
  model: 'gpt-4',
  features: { workingMemory: true },
  storage,
});

// Build up state
ctx.addUserMessage('Remember: my favorite color is blue');
await ctx.memory?.store('user_color', 'User favorite color', 'blue');

// Save session with metadata
await ctx.save('session-001', { title: 'User Preferences' });

// Later... load session
const ctx2 = AgentContextNextGen.create({ model: 'gpt-4', storage });
const loaded = await ctx2.load('session-001');

if (loaded) {
  // Full state restored: conversation, plugin states, etc.
  const color = await ctx2.memory?.retrieve('user_color');
  console.log(color); // 'blue'
}
```

**What's Persisted:**
- Complete conversation history
- All plugin states (WorkingMemory entries, InContextMemory, etc.)
- System prompt

**Storage Location:** `~/.oneringai/agents/<agentId>/sessions/<sessionId>.json`

### 5. Working Memory

Use the `WorkingMemoryPluginNextGen` for agents that need to store and retrieve data:

```typescript
import { Agent } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, emailTool],
  context: {
    features: { workingMemory: true },
  },
});

// Agent now has memory_store, memory_retrieve, memory_delete, memory_list tools
await agent.run('Check weather for SF and remember the result');
```

**Features:**
- 📝 **Working Memory** - Store and retrieve data with priority-based eviction
- 🏗️ **Hierarchical Memory** - Raw → Summary → Findings tiers for research tasks
- 🧠 **Context Management** - Automatic handling of context limits
- 💾 **Session Persistence** - Save/load via `ctx.save()` and `ctx.load()`

### 6. Research with Search Tools

Use `Agent` with search tools and `WorkingMemoryPluginNextGen` for research workflows:

```typescript
import { Agent, ConnectorTools, Connector, Services, tools } from '@everworker/oneringai';

// Setup search connector
Connector.create({
  name: 'serper-main',
  serviceType: Services.Serper,
  auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY! },
  baseURL: 'https://google.serper.dev',
});

// Create agent with search and memory
const searchTools = ConnectorTools.for('serper-main');

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [...searchTools, tools.webFetch],
  context: {
    features: { workingMemory: true },
  },
});

// Agent can search and store findings in memory
await agent.run('Research AI developments in 2026 and store key findings');
```

**Features:**
- 🔍 **Web Search** - SearchProvider with Serper, Brave, Tavily, RapidAPI
- 📝 **Working Memory** - Store findings with priority-based eviction
- 🏗️ **Tiered Memory** - Raw → Summary → Findings pattern

### 7. Context Management

**AgentContextNextGen** is the modern, plugin-based context manager. It provides clean separation of concerns with composable plugins:

```typescript
import { Agent, AgentContextNextGen } from '@everworker/oneringai';

// Option 1: Use AgentContextNextGen directly (standalone)
const ctx = AgentContextNextGen.create({
  model: 'gpt-4',
  systemPrompt: 'You are a helpful assistant.',
  features: { workingMemory: true, inContextMemory: true },
});

ctx.addUserMessage('What is the weather in Paris?');
const { input, budget } = await ctx.prepare(); // Ready for LLM call

// Option 2: Via Agent.create
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    features: { workingMemory: true },
  },
});

// Agent uses AgentContextNextGen internally
await agent.run('Check the weather');
```

#### Feature Configuration

Enable/disable features independently. Disabled features = no associated tools registered:

```typescript
// Minimal stateless agent (no memory)
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    features: { workingMemory: false }
  }
});

// Full-featured agent with all plugins
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    features: {
      workingMemory: true,
      inContextMemory: true,
      persistentInstructions: true
    },
    agentId: 'my-assistant',  // Required for persistentInstructions
  }
});
```

**Available Features:**
| Feature | Default | Plugin | Associated Tools |
|---------|---------|--------|------------------|
| `workingMemory` | `true` | WorkingMemoryPluginNextGen | `memory_store/retrieve/delete/list` |
| `inContextMemory` | `false` | InContextMemoryPluginNextGen | `context_set/delete/list` |
| `persistentInstructions` | `false` | PersistentInstructionsPluginNextGen | `instructions_set/remove/list/clear` |

**AgentContextNextGen architecture:**
- **Plugin-first design** - All features are composable plugins
- **ToolManager** - Tool registration, execution, circuit breakers
- **Single system message** - All context components combined
- **Smart compaction** - Happens once, right before LLM call

**Compaction strategy:**
- **algorithmic** (default) - Moves large tool results to Working Memory, limits tool pairs, applies rolling window. Triggers at 75% context usage.

**Context preparation:**
```typescript
const { input, budget, compacted, compactionLog } = await ctx.prepare();

console.log(budget.totalUsed);           // Total tokens used
console.log(budget.available);           // Remaining tokens
console.log(budget.utilizationPercent);  // Usage percentage
```

### 8. InContextMemory

Store key-value pairs **directly in context** for instant LLM access without retrieval calls:

```typescript
import { AgentContextNextGen } from '@everworker/oneringai';

const ctx = AgentContextNextGen.create({
  model: 'gpt-4',
  features: { inContextMemory: true },
  plugins: {
    inContextMemory: { maxEntries: 20 },
  },
});

// Access the plugin
const plugin = ctx.getPlugin('in_context_memory');

// Store data - immediately visible to LLM
plugin.set('current_state', 'Task processing state', { step: 2, status: 'active' });
plugin.set('user_prefs', 'User preferences', { verbose: true }, 'high');

// Store data with UI display - shown in the host app's sidebar panel
plugin.set('dashboard', 'Progress dashboard', '## Progress\n- [x] Step 1\n- [ ] Step 2', 'normal', true);

// LLM can use context_set/context_delete/context_list tools
// Or access directly via plugin API
const state = plugin.get('current_state');  // { step: 2, status: 'active' }
```

**Key Difference from WorkingMemory:**
- **WorkingMemory**: External storage + index → requires `memory_retrieve()` for values
- **InContextMemory**: Full values in context → instant access, no retrieval needed

**UI Display (`showInUI`):** Entries with `showInUI: true` are displayed in the host application's sidebar panel with full markdown rendering (code blocks, tables, charts, diagrams, etc.). The LLM sets this via the `context_set` tool. Users can also pin specific entries to always display them regardless of the agent's setting. See the [User Guide](./USER_GUIDE.md#ui-display-showInUI) for details.

**Use cases:** Session state, user preferences, counters, flags, small accumulated results, live dashboards.

### 9. Persistent Instructions

Store agent-level custom instructions that persist across sessions on disk:

```typescript
import { Agent } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    agentId: 'my-assistant',  // Required for storage path
    features: {
      persistentInstructions: true,
    },
  },
});

// LLM can now use instructions_set/remove/list/clear tools
// Instructions persist to ~/.oneringai/agents/my-assistant/custom_instructions.json
```

**Key Features:**
- 📁 **Disk Persistence** - Instructions survive process restarts and sessions
- 🔧 **LLM-Modifiable** - Agent can update its own instructions during execution
- 🔄 **Auto-Load** - Instructions loaded automatically on agent start
- 🛡️ **Never Compacted** - Critical instructions always preserved in context

**Available Tools:**
- `instructions_set` - Add or update a single instruction by key
- `instructions_remove` - Remove a single instruction by key
- `instructions_list` - List all instructions with keys and content
- `instructions_clear` - Remove all instructions (requires confirmation)

**Use cases:** Agent personality/behavior, user preferences, learned rules, tool usage patterns.

### 10. Direct LLM Access

Bypass all context management for simple, stateless LLM calls:

```typescript
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });

// Direct call - no history tracking, no memory, no context preparation
const response = await agent.runDirect('What is 2 + 2?');
console.log(response.output_text);  // "4"

// With options
const response = await agent.runDirect('Summarize this', {
  instructions: 'Be concise',
  temperature: 0.5,
  maxOutputTokens: 100,
});

// Multimodal (text + image)
const response = await agent.runDirect([
  { type: 'message', role: 'user', content: [
    { type: 'input_text', text: 'What is in this image?' },
    { type: 'input_image', image_url: 'https://example.com/image.png' }
  ]}
]);

// Streaming
for await (const event of agent.streamDirect('Tell me a story')) {
  if (event.type === 'output_text_delta') {
    process.stdout.write(event.delta);
  }
}
```

**Comparison:**

| Aspect | `run()` / `chat()` | `runDirect()` |
|--------|-------------------|---------------|
| History tracking | ✅ | ❌ |
| Memory/Cache | ✅ | ❌ |
| Context preparation | ✅ | ❌ |
| Agentic loop (tool execution) | ✅ | ❌ |
| Overhead | Full context management | Minimal |

**Use cases:** Quick one-off queries, embeddings-like simplicity, testing, hybrid workflows.

### 11. Audio Capabilities

Text-to-Speech and Speech-to-Text with multiple providers:

```typescript
import { TextToSpeech, SpeechToText } from '@everworker/oneringai';

// === Text-to-Speech ===
const tts = TextToSpeech.create({
  connector: 'openai',
  model: 'tts-1-hd',       // or 'gpt-4o-mini-tts' for instruction steering
  voice: 'nova',
});

// Synthesize to file
await tts.toFile('Hello, world!', './output.mp3');

// Synthesize with options
const audio = await tts.synthesize('Speak slowly', {
  format: 'wav',
  speed: 0.75,
});

// Introspection
const voices = await tts.listVoices();
const models = tts.listAvailableModels();

// === Speech-to-Text ===
const stt = SpeechToText.create({
  connector: 'openai',
  model: 'whisper-1',      // or 'gpt-4o-transcribe'
});

// Transcribe
const result = await stt.transcribeFile('./audio.mp3');
console.log(result.text);

// With timestamps
const detailed = await stt.transcribeWithTimestamps(audioBuffer, 'word');
console.log(detailed.words);  // [{ word, start, end }, ...]

// Translation
const english = await stt.translate(frenchAudio);
```

**Available Models:**
- **TTS**: OpenAI (`tts-1`, `tts-1-hd`, `gpt-4o-mini-tts`), Google (`gemini-tts`)
- **STT**: OpenAI (`whisper-1`, `gpt-4o-transcribe`), Groq (`whisper-large-v3` - 12x cheaper!)

### 12. Model Registry

Complete metadata for 23+ models:

```typescript
import { getModelInfo, calculateCost, LLM_MODELS, Vendor } from '@everworker/oneringai';

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

### 13. Streaming

Real-time responses:

```typescript
import { StreamHelpers } from '@everworker/oneringai';

for await (const text of StreamHelpers.textOnly(agent.stream('Hello'))) {
  process.stdout.write(text);
}
```

### 14. OAuth for External APIs

```typescript
import { OAuthManager, FileStorage } from '@everworker/oneringai';

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

### 15. Developer Tools

File system and shell tools for building coding assistants:

```typescript
import { developerTools } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: developerTools, // Includes all 7 tools
});

// Agent can now:
// - Read files (read_file)
// - Write files (write_file)
// - Edit files with surgical precision (edit_file)
// - Search files by pattern (glob)
// - Search content with regex (grep)
// - List directories (list_directory)
// - Execute shell commands (bash)

await agent.run('Read package.json and tell me the dependencies');
await agent.run('Find all TODO comments in the src directory');
await agent.run('Run npm test and report any failures');
```

**Available Tools:**
- **read_file** - Read file contents with line numbers
- **write_file** - Create/overwrite files
- **edit_file** - Surgical find/replace edits
- **glob** - Find files by pattern (`**/*.ts`)
- **grep** - Search content with regex
- **list_directory** - List directory contents
- **bash** - Execute shell commands with safety guards

**Safety Features:**
- Blocked dangerous commands (`rm -rf /`, fork bombs)
- Configurable blocked directories (`node_modules`, `.git`)
- Timeout protection (default 2 min)
- Output truncation for large outputs

### 16. Desktop Automation Tools (NEW)

OS-level desktop automation for building "computer use" agents — screenshot the screen, send to a vision model, receive tool calls (click, type, etc.), execute them, repeat:

```typescript
import { desktopTools } from '@everworker/oneringai';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: desktopTools, // All 11 desktop tools
});

// Agent can now see and interact with the desktop:
await agent.run('Take a screenshot and describe what you see');
await agent.run('Open Safari and search for "weather forecast"');
```

**Available Tools:**
- **desktop_screenshot** - Capture full screen or region (returns image to vision model)
- **desktop_mouse_move** - Move cursor to position
- **desktop_mouse_click** - Click (left/right/middle, single/double/triple)
- **desktop_mouse_drag** - Drag from one position to another
- **desktop_mouse_scroll** - Scroll wheel (vertical and horizontal)
- **desktop_get_cursor** - Get current cursor position
- **desktop_keyboard_type** - Type text
- **desktop_keyboard_key** - Press shortcuts (e.g., `ctrl+c`, `cmd+shift+s`, `enter`)
- **desktop_get_screen_size** - Get screen dimensions and scale factor
- **desktop_window_list** - List visible windows
- **desktop_window_focus** - Bring a window to the foreground

**Key Design:**
- All coordinates are in **physical pixel space** (same as screenshot pixels) — no manual Retina scaling needed
- Screenshots use the `__images` convention for automatic multimodal handling across all providers (Anthropic, OpenAI, Google)
- Requires `@nut-tree-fork/nut-js` as an optional peer dependency: `npm install @nut-tree-fork/nut-js`

### 17. Document Reader (NEW)

Universal file-to-LLM-content converter. Reads arbitrary document formats and produces clean markdown text with optional image extraction:

```typescript
import { DocumentReader, mergeTextPieces } from '@everworker/oneringai';

const reader = DocumentReader.create({
  defaults: {
    maxTokens: 50_000,
    extractImages: true,
    imageFilter: { minWidth: 100, minHeight: 100 },
  },
});

// Read from file path, URL, Buffer, or Blob
const result = await reader.read('/path/to/report.pdf');
const result = await reader.read('https://example.com/doc.xlsx');
const result = await reader.read({ type: 'buffer', buffer: myBuffer, filename: 'doc.docx' });

// Get merged markdown text
const markdown = mergeTextPieces(result.pieces);

// Metadata
console.log(result.metadata.format);          // 'pdf'
console.log(result.metadata.estimatedTokens); // 12500
console.log(result.metadata.processingTimeMs); // 234
```

**Automatic Integration — No Code Changes Needed:**
- **`read_file` tool** — Agents calling `read_file` on a PDF, DOCX, or XLSX get markdown text automatically
- **`web_fetch` tool** — Documents downloaded from URLs are auto-converted to markdown

**Content Bridge for Multimodal Input:**

```typescript
import { readDocumentAsContent } from '@everworker/oneringai';

// Convert document directly to Content[] for LLM input
const content = await readDocumentAsContent('/path/to/slides.pptx', {
  extractImages: true,
  imageDetail: 'auto',
  maxImages: 20,
});

// Use in agent.run() with text + images
await agent.run([
  { type: 'input_text', text: 'Analyze this presentation:' },
  ...content,
]);
```

**Pluggable Architecture:**
- 6 built-in format handlers (Office, Excel, PDF, HTML, Text, Image)
- 3 default transformers (header, table formatting, truncation)
- Custom handlers and transformers via `DocumentReader.create({ handlers, ... })`
- All heavy dependencies lazy-loaded (officeparser, exceljs, unpdf)

**Image Filtering:**
- Configurable min dimensions, min size, max count, pattern exclusions
- Automatically removes junk images (logos, icons, tiny backgrounds)
- Applied both at extraction time and at content conversion time

See the [User Guide](./USER_GUIDE.md#document-reader) for complete API reference and configuration options.

### 18. External API Integration

Connect your AI agents to 35+ external services with enterprise-grade resilience:

```typescript
import { Connector, ConnectorTools, Services, Agent } from '@everworker/oneringai';

// Create a connector for an external service
Connector.create({
  name: 'github',
  serviceType: Services.Github,
  auth: { type: 'api_key', apiKey: process.env.GITHUB_TOKEN! },
  baseURL: 'https://api.github.com',

  // Enterprise resilience features
  timeout: 30000,
  retry: { maxRetries: 3, baseDelayMs: 1000 },
  circuitBreaker: { enabled: true, failureThreshold: 5 },
});

// Generate tools from the connector
// GitHub connectors get 7 dedicated tools + generic API automatically:
// search_files, search_code, read_file, get_pr, pr_files, pr_comments, create_pr
const tools = ConnectorTools.for('github');

// Use with an agent — userId flows to all tools automatically
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  userId: 'user-123',  // All tool API calls use this user's OAuth tokens
  tools: tools,
});

await agent.run('Find all TypeScript files in src/ and show me the entry point');
await agent.run('Show me PR #42 and summarize the review comments');
```

**Supported Services (35+):**
- **Communication**: Slack, Discord, Microsoft Teams, Twilio
- **Development**: GitHub *(7 built-in tools)*, GitLab, Jira, Linear, Bitbucket
- **Productivity**: Notion, Asana, Monday, Airtable, Trello
- **CRM**: Salesforce, HubSpot, Zendesk, Intercom
- **Payments**: Stripe, PayPal, Square
- **Cloud**: AWS, Azure, GCP, DigitalOcean
- And more...

**Enterprise Features:**
- 🔄 **Automatic retry** with exponential backoff
- ⚡ **Circuit breaker** for failing services
- ⏱️ **Configurable timeout**
- 📊 **Metrics tracking** (requests, latency, success rate)
- 🔐 **Protected auth headers** (cannot be overridden)

```typescript
// Direct fetch with connector
const connector = Connector.get('github');
const data = await connector.fetchJSON('/repos/owner/repo/issues');

// Metrics
const metrics = connector.getMetrics();
console.log(`Success rate: ${metrics.successCount / metrics.requestCount * 100}%`);
```

#### Scoped Connector Registry (NEW)

Limit connector visibility by user, group, or tenant in multi-user systems:

```typescript
import { Connector, ScopedConnectorRegistry } from '@everworker/oneringai';
import type { IConnectorAccessPolicy } from '@everworker/oneringai';

// Define an access policy
const policy: IConnectorAccessPolicy = {
  canAccess: (connector, context) => {
    const tags = connector.config.tags as string[] | undefined;
    return !!tags && tags.includes(context.tenantId as string);
  },
};

// Set the global policy
Connector.setAccessPolicy(policy);

// Create a scoped view for a specific tenant
const registry = Connector.scoped({ tenantId: 'acme-corp' });

// Only connectors tagged with 'acme-corp' are visible
registry.list();           // ['acme-openai', 'acme-slack']
registry.get('other-co');  // throws "not found" (no info leakage)

// Use with Agent
const agent = Agent.create({
  connector: 'acme-openai',
  model: 'gpt-4',
  registry,  // Agent resolves connectors through the scoped view
});

// Use with ConnectorTools
const tools = ConnectorTools.for('acme-slack', undefined, { registry });
const allTools = ConnectorTools.discoverAll(undefined, { registry });
```

**Features:**
- Pluggable `IConnectorAccessPolicy` interface — bring your own access logic
- Opaque context object (`{ userId, tenantId, roles, ... }`) — library imposes no structure
- Denied connectors get the same "not found" error — no information leakage
- Zero changes to existing API — scoping is entirely opt-in
- Works with `Agent.create()`, `ConnectorTools.for()`, and `ConnectorTools.discoverAll()`

#### Vendor Templates (NEW)

Quickly set up connectors for 43+ services with pre-configured authentication templates:

```typescript
import {
  createConnectorFromTemplate,
  listVendors,
  getVendorTemplate,
  ConnectorTools
} from '@everworker/oneringai';

// List all available vendors
const vendors = listVendors();
// [{ id: 'github', name: 'GitHub', authMethods: ['pat', 'oauth-user', 'github-app'], ... }]

// Create connector from template (just provide credentials!)
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

**Supported Categories (43 vendors):**
| Category | Vendors |
|----------|---------|
| Communication | Slack, Discord, Telegram, Microsoft Teams |
| Development | GitHub, GitLab, Bitbucket, Jira, Linear, Asana, Trello |
| Productivity | Notion, Airtable, Google Workspace, Microsoft 365, Confluence |
| CRM | Salesforce, HubSpot, Pipedrive |
| Payments | Stripe, PayPal |
| Cloud | AWS, GCP, Azure |
| Storage | Dropbox, Box, Google Drive, OneDrive |
| Email | SendGrid, Mailchimp, Postmark |
| Monitoring | Datadog, PagerDuty, Sentry |
| Search | Serper, Brave, Tavily, RapidAPI |
| Scrape | ZenRows |
| Other | Twilio, Zendesk, Intercom, Shopify |

Each vendor includes:
- **Credentials setup URL** - Direct link to where you create API keys
- **Multiple auth methods** - API keys, OAuth, service accounts
- **Pre-configured URLs** - Authorization, token endpoints pre-filled
- **Common scopes** - Recommended scopes for each auth method

See the [User Guide](./USER_GUIDE.md#vendor-templates) for complete vendor reference.

**Vendor Logos:**
```typescript
import { getVendorLogo, getVendorLogoSvg, getVendorColor } from '@everworker/oneringai';

// Get logo with metadata
const logo = getVendorLogo('github');
if (logo) {
  console.log(logo.svg);           // SVG content
  console.log(logo.hex);           // Brand color: "181717"
  console.log(logo.isPlaceholder); // false (has official icon)
}

// Get just the SVG (with optional color override)
const svg = getVendorLogoSvg('slack', 'FFFFFF');  // White icon

// Get brand color
const color = getVendorColor('stripe');  // "635BFF"
```

#### Tool Discovery with ToolRegistry

For UIs or tool inventory, use `ToolRegistry` to get all available tools:

```typescript
import { ToolRegistry } from '@everworker/oneringai';

const allTools = ToolRegistry.getAllTools();

for (const tool of allTools) {
  if (ToolRegistry.isConnectorTool(tool)) {
    console.log(`API: ${tool.displayName} (${tool.connectorName})`);
  } else {
    console.log(`Built-in: ${tool.displayName}`);
  }
}
```

## MCP (Model Context Protocol) Integration

Connect to MCP servers for automatic tool discovery and seamless integration:

```typescript
import { MCPRegistry, Agent, Connector, Vendor } from '@everworker/oneringai';

// Setup authentication
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Connect to local MCP server (stdio)
const fsClient = MCPRegistry.create({
  name: 'filesystem',
  transport: 'stdio',
  transportConfig: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
  },
});

// Connect to remote MCP server (HTTP/HTTPS)
const remoteClient = MCPRegistry.create({
  name: 'remote-api',
  transport: 'https',
  transportConfig: {
    url: 'https://mcp.example.com/api',
    token: process.env.MCP_TOKEN,
  },
});

// Connect and discover tools
await fsClient.connect();
await remoteClient.connect();

// Create agent and register MCP tools
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });
fsClient.registerTools(agent.tools);
remoteClient.registerTools(agent.tools);

// Agent can now use tools from both MCP servers!
await agent.run('List files and analyze them');
```

**Features:**
- 🔌 **Stdio & HTTP/HTTPS transports** - Local and remote server support
- 🔍 **Automatic tool discovery** - Tools are discovered and registered automatically
- 🏷️ **Namespaced tools** - `mcp:{server}:{tool}` prevents conflicts
- 🔄 **Auto-reconnect** - Exponential backoff with configurable retry
- 📊 **Session management** - Persistent connections with session IDs
- 🔐 **Permission integration** - All MCP tools require user approval
- ⚙️ **Configuration file** - Declare servers in `oneringai.config.json`

**Available MCP Servers:**
- [@modelcontextprotocol/server-filesystem](https://github.com/modelcontextprotocol/servers) - File system access
- [@modelcontextprotocol/server-github](https://github.com/modelcontextprotocol/servers) - GitHub API
- [@modelcontextprotocol/server-google-drive](https://github.com/modelcontextprotocol/servers) - Google Drive
- [@modelcontextprotocol/server-slack](https://github.com/modelcontextprotocol/servers) - Slack integration
- [@modelcontextprotocol/server-postgres](https://github.com/modelcontextprotocol/servers) - PostgreSQL database
- [And many more...](https://github.com/modelcontextprotocol/servers)

See [MCP_INTEGRATION.md](./MCP_INTEGRATION.md) for complete documentation.

## Examples

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
- ✅ Scoped registry for multi-tenant access control

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

**Version:** 0.2.1 | **Last Updated:** 2026-02-17 | **[User Guide](./USER_GUIDE.md)** | **[API Reference](./API_REFERENCE.md)** | **[Changelog](./CHANGELOG.md)**
