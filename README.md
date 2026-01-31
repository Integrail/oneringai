# @oneringai/agents

> **A unified AI agent library with multi-provider support for text generation, image/video generation, audio (TTS/STT), and agentic workflows.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## Features

- ✨ **Unified API** - One interface for 10+ AI providers (OpenAI, Anthropic, Google, Groq, DeepSeek, and more)
- 🔑 **Connector-First Architecture** - Single auth system with support for multiple keys per vendor
- 📊 **Model Registry** - Complete metadata for 23+ latest (2026) models with pricing and features
- 🎤 **Audio Capabilities** - Text-to-Speech (TTS) and Speech-to-Text (STT) with OpenAI and Groq
- 🖼️ **Image Generation** - DALL-E 3, gpt-image-1, Google Imagen 4 with editing and variations
- 🎬 **Video Generation** - NEW: OpenAI Sora 2 and Google Veo 3 for AI video creation
- 🔍 **Web Search** - Connector-based search with Serper, Brave, Tavily, and RapidAPI providers
- 🤖 **Universal Agent** - Unified agent combining chat, planning, and execution in one interface
- 🎛️ **Dynamic Tool Management** - Enable/disable tools at runtime, namespaces, priority-based selection
- 💾 **Session Persistence** - Save and resume conversations for all agent types
- 🤖 **Task Agents** - Autonomous agents with working memory, context management, and state persistence
- 🔬 **Research Agent** - NEW: Generic research agent with pluggable sources (web, vector, file, API)
- 🎯 **Context Management** - Smart strategies (proactive, aggressive, lazy, rolling-window, adaptive)
- 📌 **InContextMemory** - NEW: Live key-value storage directly in LLM context for instant access
- 📝 **Persistent Instructions** - NEW: Agent-level custom instructions that persist across sessions on disk
- 🛠️ **Agentic Workflows** - Built-in tool calling and multi-turn conversations
- 🔧 **Developer Tools** - NEW: Filesystem and shell tools for coding assistants (read, write, edit, grep, glob, bash)
- 🔌 **MCP Integration** - NEW: Model Context Protocol client for seamless tool discovery from local and remote servers
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

### Audio (NEW)

```typescript
import { TextToSpeech, SpeechToText } from '@oneringai/agents';

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
import { ImageGeneration } from '@oneringai/agents';

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
import { VideoGeneration } from '@oneringai/agents';

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

### Web Search

Connector-based web search with multiple providers:

```typescript
import { Connector, SearchProvider, Services, webSearch, Agent } from '@oneringai/agents';

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

// Option 2: Use with Agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [webSearch],
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
import { Connector, ScrapeProvider, Services, webScrape, Agent } from '@oneringai/agents';

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

// Option 2: Use webScrape tool with Agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [webScrape],
});

// webScrape auto-falls back: native → JS → API
await agent.run('Scrape https://example.com and summarize');
```

**Supported Scrape Providers:**
- **ZenRows** - Enterprise scraping with JS rendering, residential proxies, anti-bot bypass

## Supported Providers

| Provider | Text | Vision | TTS | STT | Image | Video | Tools | Context |
|----------|------|--------|-----|-----|-------|-------|-------|---------|
| **OpenAI** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 128K |
| **Anthropic (Claude)** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | 200K |
| **Google (Gemini)** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | 1M |
| **Google Vertex AI** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | 1M |
| **Grok (xAI)** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | 128K |
| **Groq** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | 128K |
| **Together AI** | ✅ | Some | ❌ | ❌ | ❌ | ❌ | ✅ | 128K |
| **DeepSeek** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | 64K |
| **Mistral** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | 32K |
| **Ollama** | ✅ | Varies | ❌ | ❌ | ❌ | ❌ | ✅ | Varies |
| **Custom** | ✅ | Varies | ❌ | ❌ | ❌ | ❌ | ✅ | Varies |

## Key Features

### 1. Universal Agent (NEW)

Combines interactive chat, planning, and task execution in one powerful agent:

```typescript
import { UniversalAgent, FileSessionStorage } from '@oneringai/agents';

const agent = UniversalAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, emailTool],
  planning: {
    enabled: true,
    autoDetect: true,        // Auto-detect complex tasks
    requireApproval: true,   // Require approval before execution
  },
  session: {
    storage: new FileSessionStorage({ directory: './sessions' }),
    autoSave: true,
  },
});

// Chat - handles mode transitions automatically
const response = await agent.chat('Check weather and email me the report');
console.log(response.text);
console.log('Mode:', response.mode);  // 'interactive' | 'planning' | 'executing'

// Get current state
const mode = agent.getMode();
const plan = agent.getPlan();
const progress = agent.getProgress();
```

**Features:**
- 🔄 **Auto-mode switching** - Seamlessly transitions between interactive, planning, and executing
- 🧠 **Complexity detection** - LLM detects when tasks need planning
- ✏️ **Dynamic plans** - Users can modify plans mid-execution
- 💾 **Session persistence** - Resume conversations across restarts
- ⚙️ **Runtime configuration** - Change approval requirements on the fly

### 2. Dynamic Tool Management (NEW)

Control tools at runtime for all agent types. **AgentContext is the single source of truth** - `agent.tools` and `agent.context.tools` are the same ToolManager instance:

```typescript
import { Agent } from '@oneringai/agents';

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

### 3. Session Persistence (NEW)

Save and resume full context state including conversation history and memory:

```typescript
import { AgentContext, createFileContextStorage } from '@oneringai/agents';

// Create storage for the agent
const storage = createFileContextStorage('my-assistant');

// Create context with storage
const ctx = AgentContext.create({
  model: 'gpt-4',
  features: { memory: true, history: true },
  storage,
});

// Build up state
ctx.addMessageSync('user', 'Remember: my favorite color is blue');
ctx.addMessageSync('assistant', 'I\'ll remember that your favorite color is blue.');
await ctx.memory!.store('user_color', 'User favorite color', 'blue');

// Save session with metadata
await ctx.save('session-001', { title: 'User Preferences' });

// Later... load session
const ctx2 = AgentContext.create({ model: 'gpt-4', storage });
const loaded = await ctx2.load('session-001');

if (loaded) {
  // Full state restored: history, memory entries, tool state, etc.
  const color = await ctx2.memory!.retrieve('user_color');
  console.log(color); // 'blue'
}
```

**What's Persisted:**
- Complete conversation history
- All WorkingMemory entries (full values, not just index)
- Tool enable/disable state
- Permission approvals
- Plugin states (InContextMemory, etc.)

**Storage Location:** `~/.oneringai/agents/<agentId>/sessions/<sessionId>.json`

### 4. Task Agents

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
- 📝 **Working Memory** - Store and retrieve data with priority-based eviction, task-aware scoping, and pinning
- 🏗️ **Hierarchical Memory** - Raw → Summary → Findings pattern for research tasks
- 🧠 **Context Management** - Automatic handling of context limits with LLM summarization
- ⏸️ **State Persistence** - Resume after crashes or long waits
- 🔗 **External Dependencies** - Wait for webhooks, polling, manual input
- 🔄 **Tool Idempotency** - Prevent duplicate side effects
- 🔬 **Task Types** - Optimized prompts and priorities for research, coding, and analysis

### 5. Research Agent (NEW)

A specialized agent for multi-source research with pluggable data sources:

```typescript
import { ResearchAgent, createWebSearchSource, createFileSearchSource } from '@oneringai/agents';

// Create research sources
const webSource = createWebSearchSource('serper-main');
const fileSource = createFileSearchSource('./docs');

// Create research agent
const agent = await ResearchAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  sources: [webSource, fileSource],
  autoSpill: {
    sizeThreshold: 10 * 1024, // Auto-spill outputs > 10KB
  },
});

// Execute research
const result = await agent.research({
  topic: 'AI developments in 2026',
  queries: ['latest AI breakthroughs', 'AI regulation updates'],
  maxResultsPerQuery: 10,
});

console.log(result.findings); // Processed research findings
```

**Features:**
- 🔌 **Pluggable Sources** - Web search, vector databases, file systems, custom APIs
- 📊 **Auto-Spill** - Large tool outputs automatically stored in memory with tracking
- 🗑️ **Smart Cleanup** - Raw data evicted after summarization
- 📦 **Batch Retrieval** - Efficient `memory_retrieve_batch` for synthesis
- 🏗️ **Tiered Memory** - Raw → Summary → Findings workflow
- 📈 **25MB Default Memory** - Configurable for large research tasks

**Built-in Sources:**
- `createWebSearchSource(connector)` - Web search via SearchProvider
- `createFileSearchSource(path)` - File system search with glob/grep

**Custom Sources:**
```typescript
// Implement IResearchSource for custom data sources
const vectorSource: IResearchSource = {
  name: 'vector-db',
  type: 'knowledge',
  async search(query, options) { /* ... */ },
  async fetch(reference, options) { /* ... */ },
  // ...
};
```

### 6. Context Management

**AgentContext** is the unified "swiss army knife" for managing agent state. It provides a simple, coordinated API for all context-related operations:

```typescript
import { Agent, AgentContext } from '@oneringai/agents';

// Option 1: Use AgentContext directly (standalone)
const ctx = AgentContext.create({
  model: 'gpt-4',
  systemPrompt: 'You are a helpful assistant.',
  tools: [weatherTool, searchTool],
});

await ctx.addMessage('user', 'What is the weather in Paris?');  // async with auto-compaction
await ctx.executeTool('get_weather', { location: 'Paris' });
const prepared = await ctx.prepare(); // Ready for LLM call

// Option 2: Enable context tracking in Agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: { // Enables AgentContext-based tracking
    strategy: 'adaptive', // proactive, aggressive, lazy, rolling-window, adaptive
    autoCompact: true,
  },
});

// Agent auto-tracks messages, tool calls, and manages context
await agent.run('Check the weather');
const metrics = await agent.context?.getMetrics();
```

#### Feature Configuration (NEW)

Enable/disable AgentContext features independently. Disabled features = no associated tools registered:

```typescript
// Minimal stateless agent (no memory, no history)
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    features: { memory: false, history: false }
  }
});

// Full-featured research agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  context: {
    features: { memory: true, inContextMemory: true, history: true }
  }
});

// Check feature status
console.log(agent.context.isFeatureEnabled('memory')); // false
console.log(agent.context.memory);                     // null (disabled)
```

**Available Features:**
| Feature | Default | Components | Associated Tools |
|---------|---------|------------|------------------|
| `memory` | `true` | WorkingMemory + IdempotencyCache | `memory_*`, `cache_stats` |
| `inContextMemory` | `false` | InContextMemoryPlugin | `context_set/get/delete/list` |
| `persistentInstructions` | `false` | PersistentInstructionsPlugin | `instructions_set/get/append/clear` |
| `history` | `true` | Conversation tracking | (affects context preparation) |
| `permissions` | `true` | ToolPermissionManager | (affects tool execution) |

**AgentContext composes:**
- **ToolManager** - Tool registration, execution, circuit breakers
- **WorkingMemory** - Key-value store with eviction
- **IdempotencyCache** - Tool result caching
- **ToolPermissionManager** - Approval workflows
- **Built-in history** - Conversation tracking

**Five compaction strategies** for different use cases:
- **proactive** (default) - Balanced, compact at 75%
- **aggressive** - Early compaction at 60%, for long conversations
- **lazy** - Minimal compaction at 90%, for short tasks
- **rolling-window** - Fixed message window, zero overhead
- **adaptive** - Self-optimizing based on usage patterns

**Auto-Compaction Guard (NEW):** Context overflow is prevented proactively:
```typescript
// addMessage() is now async and checks capacity for large content
await ctx.addMessage('tool', largeWebFetchResult);  // Auto-compacts if needed

// Sync version for small messages (no capacity check)
ctx.addMessageSync('user', 'Hello');

// Helper for tool results with metadata
await ctx.addToolResult(output, { tool: 'web_fetch' });

// Manual capacity check
const canFit = await ctx.ensureCapacity(estimatedTokens);
```

**Three compactors** for content reduction:
- **TruncateCompactor** - Simple truncation for tool outputs
- **SummarizeCompactor** - LLM-based intelligent summarization (preserves key facts)
- **MemoryEvictionCompactor** - Priority-based memory eviction

**Task type detection** automatically optimizes context for:
- **research** - Preserves tool outputs, summarizes conversation early
- **coding** - Preserves code context, truncates verbose outputs
- **analysis** - Balanced data and reasoning preservation

### 7. InContextMemory (NEW)

Store key-value pairs **directly in context** for instant LLM access without retrieval calls:

```typescript
import { AgentContext, setupInContextMemory } from '@oneringai/agents';

const ctx = AgentContext.create({ model: 'gpt-4' });
const inContextMemory = setupInContextMemory(ctx, { maxEntries: 20 });

// Store data - immediately visible to LLM
inContextMemory.set('current_state', 'Task processing state', { step: 2, status: 'active' });
inContextMemory.set('user_prefs', 'User preferences', { verbose: true }, 'high');

// LLM can use context_set/context_get/context_delete/context_list tools
// Or access directly via plugin API
const state = inContextMemory.get('current_state');  // { step: 2, status: 'active' }
```

**Key Difference from WorkingMemory:**
- **WorkingMemory**: External storage + index → requires `memory_retrieve()` for values
- **InContextMemory**: Full values in context → instant access, no retrieval needed

**Use cases:** Session state, user preferences, counters, flags, small accumulated results.

### 8. Persistent Instructions (NEW)

Store agent-level custom instructions that persist across sessions on disk:

```typescript
import { Agent } from '@oneringai/agents';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  agentId: 'my-assistant',  // Used for storage path
  context: {
    features: {
      persistentInstructions: true,
    },
  },
});

// LLM can now use instructions_set/append/get/clear tools
// Instructions persist to ~/.oneringai/agents/my-assistant/custom_instructions.md
```

**Key Features:**
- 📁 **Disk Persistence** - Instructions survive process restarts and sessions
- 🔧 **LLM-Modifiable** - Agent can update its own instructions during execution
- 🔄 **Auto-Load** - Instructions loaded automatically on agent start
- 🛡️ **Never Compacted** - Critical instructions always preserved in context

**Available Tools:**
- `instructions_set` - Replace all custom instructions
- `instructions_append` - Add a new section to existing instructions
- `instructions_get` - Read current instructions
- `instructions_clear` - Remove all instructions (requires confirmation)

**Use cases:** Agent personality/behavior, user preferences, learned rules, tool usage patterns.

### 9. Direct LLM Access (NEW)

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
| Overhead | Full AgentContext | Minimal |

**Use cases:** Quick one-off queries, embeddings-like simplicity, testing, hybrid workflows.

### 10. Audio Capabilities (NEW)

Text-to-Speech and Speech-to-Text with multiple providers:

```typescript
import { TextToSpeech, SpeechToText } from '@oneringai/agents';

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

### 11. Model Registry

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

### 12. Streaming

Real-time responses:

```typescript
import { StreamHelpers } from '@oneringai/agents';

for await (const text of StreamHelpers.textOnly(agent.stream('Hello'))) {
  process.stdout.write(text);
}
```

### 13. OAuth for External APIs

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

### 14. Developer Tools (NEW)

File system and shell tools for building coding assistants:

```typescript
import { developerTools } from '@oneringai/agents';

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

### 15. External API Integration (NEW)

Connect your AI agents to 35+ external services with enterprise-grade resilience:

```typescript
import { Connector, ConnectorTools, Services, Agent } from '@oneringai/agents';

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
const tools = ConnectorTools.for('github');

// Use with an agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: tools,
});

await agent.run('List all open issues in owner/repo');
```

**Supported Services (35+):**
- **Communication**: Slack, Discord, Microsoft Teams, Twilio
- **Development**: GitHub, GitLab, Jira, Linear, Bitbucket
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

## MCP (Model Context Protocol) Integration

Connect to MCP servers for automatic tool discovery and seamless integration:

```typescript
import { MCPRegistry, Agent, Connector, Vendor } from '@oneringai/agents';

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

## Documentation

📖 **[Complete User Guide](./USER_GUIDE.md)** - Comprehensive guide covering all features

### Additional Resources

- **[MCP_INTEGRATION.md](./MCP_INTEGRATION.md)** - Model Context Protocol integration guide
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

# Audio examples
npm run example:audio              # TTS and STT demo

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
**Last Updated:** 2026-01-31

For detailed documentation on all features, see the **[Complete User Guide](./USER_GUIDE.md)**.

For internal development and architecture improvement plans, see **[IMPROVEMENT_PLAN.md](./IMPROVEMENT_PLAN.md)**.
