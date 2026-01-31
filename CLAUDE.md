# Claude Development Guide

## Project Overview

**Name**: `@oneringai/agents`
**Purpose**: Unified AI agent library with multi-vendor support for text, image, video, audio, and agentic workflows
**Language**: TypeScript (strict mode) | **Runtime**: Node.js 18+ | **Package**: ESM

## Architecture: Connector-First Design

```
User Code → Connector Registry → Agent → Provider Factory → ITextProvider
```

**Key Principles:**
1. **Connectors are single source of truth** for auth - no dual systems
2. **Named connectors** - multiple keys per vendor (`openai-main`, `openai-backup`)
3. **Explicit vendor** - uses `Vendor` enum, no auto-detection
4. **Unified tool management** - `agent.tools === agent.context.tools` (same instance)

## Core Classes

### Connector (`src/core/Connector.ts`)
Static registry for authentication. Supports API keys, OAuth, resilience (retry, circuit breaker, timeout).

```typescript
Connector.create({ name: 'openai', vendor: Vendor.OpenAI, auth: { type: 'api_key', apiKey: '...' } });
const connector = Connector.get('openai');
```

### Agent (`src/core/Agent.ts`)
Main agent class extending BaseAgent. Creates provider from connector, runs agentic loop.

```typescript
const agent = Agent.create({ connector: 'openai', model: 'gpt-4', tools: [myTool] });
const response = await agent.run('Hello!');
```

### AgentContext (`src/core/AgentContext.ts`)
**"Swiss Army Knife"** - unified facade composing ToolManager, WorkingMemory, IdempotencyCache, ToolPermissionManager. Always created by BaseAgent.

```typescript
await ctx.addMessage('user', 'Hello');     // Async with auto-compaction for large content
ctx.addMessageSync('user', 'Hi');          // Sync for small messages (no capacity check)
await ctx.addToolResult(output, metadata); // Helper for tool outputs
await ctx.ensureCapacity(tokens);          // Manual capacity check
const result = await ctx.executeTool('tool_name', args);
const prepared = await ctx.prepare(); // Assembles context, handles compaction
```

#### AgentContext Feature Configuration (NEW)

Features can be individually enabled/disabled. When disabled, associated tools are not registered:

```typescript
interface AgentContextFeatures {
  memory?: boolean;                 // WorkingMemory + IdempotencyCache (default: true)
  inContextMemory?: boolean;        // InContextMemoryPlugin (default: false, opt-in)
  persistentInstructions?: boolean; // PersistentInstructionsPlugin (default: false, opt-in)
  history?: boolean;                // Conversation tracking (default: true)
  permissions?: boolean;            // ToolPermissionManager (default: true)
}

export const DEFAULT_FEATURES = { memory: true, inContextMemory: false, persistentInstructions: false, history: true, permissions: true };
```

**Usage:**
```typescript
// Minimal stateless agent
const ctx = AgentContext.create({ features: { memory: false, history: false } });

// Full-featured agent
const ctx = AgentContext.create({ features: { memory: true, inContextMemory: true } });

// Via Agent.create
const agent = Agent.create({
  connector: 'openai', model: 'gpt-4',
  context: { features: { memory: false } },  // Inline config
});
```

**Feature-aware APIs:**
```typescript
ctx.isFeatureEnabled('memory');        // Check if feature is on
ctx.requireMemory();                   // Throws if memory disabled
ctx.requireCache();                    // Throws if memory disabled
ctx.requirePermissions();              // Throws if permissions disabled
ctx.memory;                            // WorkingMemory | null
ctx.cache;                             // IdempotencyCache | null
ctx.permissions;                       // ToolPermissionManager | null
ctx.persistentInstructions;            // PersistentInstructionsPlugin | null
ctx.agentId;                           // string (auto-generated or from config)
```

**Tool Auto-Registration:**
- AgentContext automatically registers feature-aware tools during construction
- All agent types (Agent, TaskAgent, UniversalAgent) get consistent tools automatically
- Tools registered based on features:
  - Always: `context_inspect`, `context_breakdown`
  - memory=true (default): `memory_store`, `memory_retrieve`, `memory_delete`, `memory_list`, `memory_cleanup_raw`, `memory_retrieve_batch`, `memory_stats`, `cache_stats`
  - inContextMemory=true: `context_set`, `context_get`, `context_delete`, `context_list`
  - persistentInstructions=true: `instructions_set`, `instructions_append`, `instructions_get`, `instructions_clear`
- Disabled features = no associated tools registered = cleaner LLM experience

### ToolManager (`src/core/ToolManager.ts`)
Unified tool management + execution. Implements `IToolExecutor`, `IDisposable`. Per-tool circuit breakers.

```typescript
toolManager.register(tool, { namespace: 'weather', priority: 10 });
toolManager.disable('tool_name');
const result = await toolManager.execute('tool_name', args);
```

### Vendor (`src/core/Vendor.ts`)
```typescript
const Vendor = { OpenAI, Anthropic, Google, GoogleVertex, Groq, Together, Grok, DeepSeek, Mistral, Perplexity, Ollama, Custom };
```

## Agent Types

| Type | Purpose | File |
|------|---------|------|
| **Agent** | Basic agentic loop | `src/core/Agent.ts` |
| **TaskAgent** | Task-based with plans, memory, checkpoints | `src/capabilities/taskAgent/TaskAgent.ts` |
| **UniversalAgent** | Interactive + planning + executing modes | `src/capabilities/universalAgent/UniversalAgent.ts` |
| **ResearchAgent** | Generic research with pluggable sources | `src/capabilities/researchAgent/ResearchAgent.ts` |

All extend **BaseAgent** and share unified tool management (`agent.tools === agent.context.tools`).

### Direct LLM Access (NEW)

All agents inherit `runDirect()` and `streamDirect()` from BaseAgent - bypasses all context management:

```typescript
// Direct call - no history, no memory, no context preparation
const response = await agent.runDirect('Quick question');
const response = await agent.runDirect('Summarize', { instructions: 'Be concise', temperature: 0.5 });

// Streaming
for await (const event of agent.streamDirect('Tell me a story')) { ... }

// Multimodal
await agent.runDirect([{ type: 'message', role: 'user', content: [...] }]);
```

**DirectCallOptions:** `instructions`, `includeTools`, `temperature`, `maxOutputTokens`, `responseFormat`, `vendorOptions`

**Use cases:** Quick one-off queries, testing, hybrid workflows (mix `run()` and `runDirect()`).

## Directory Structure

```
src/
├── index.ts                    # Main exports (~300 items)
├── core/                       # Core architecture
│   ├── Agent.ts, BaseAgent.ts  # Agent classes
│   ├── AgentContext.ts         # Unified context facade
│   ├── ToolManager.ts          # Tool management + execution
│   ├── IdempotencyCache.ts     # Tool result caching
│   ├── Connector.ts            # Auth registry
│   ├── Vendor.ts               # Vendor enum
│   ├── constants.ts            # All default values
│   ├── SessionManager.ts       # Session persistence
│   ├── TextToSpeech.ts, SpeechToText.ts
│   ├── createProvider.ts, createAudioProvider.ts, createImageProvider.ts, createVideoProvider.ts
│   ├── context/                # Context management
│   │   ├── types.ts            # Context types (IContextStrategy, ContextBudget, etc.)
│   │   ├── strategies/         # Proactive, Aggressive, Lazy, RollingWindow, Adaptive
│   │   └── plugins/            # MemoryPlugin, PlanPlugin, ToolOutputPlugin, AutoSpillPlugin, InContextMemoryPlugin
│   ├── history/                # History interfaces (IHistoryManager)
│   ├── permissions/            # ToolPermissionManager
│   └── mcp/                    # MCPClient, MCPRegistry
├── domain/
│   ├── entities/               # Model.ts (23 LLMs), TTSModel, STTModel, ImageModel, VideoModel
│   │                           # Tool.ts, Message.ts, Memory.ts, Task.ts, Services.ts (35+)
│   ├── interfaces/             # ITextProvider, IAudioProvider, IToolExecutor, IDisposable, etc.
│   ├── types/                  # SharedTypes.ts
│   └── errors/                 # AIErrors.ts, MCPError.ts
├── capabilities/
│   ├── agents/                 # AgenticLoop.ts, HookManager.ts
│   ├── taskAgent/              # TaskAgent, WorkingMemory, PlanExecutor, memoryTools
│   ├── universalAgent/         # UniversalAgent, ModeManager, metaTools
│   ├── researchAgent/          # ResearchAgent, IResearchSource, WebSearchSource, FileSearchSource
│   ├── search/                 # SearchProvider (Serper, Brave, Tavily, RapidAPI)
│   ├── scrape/                 # ScrapeProvider (ZenRows)
│   ├── images/                 # ImageGeneration
│   └── video/                  # VideoGeneration
├── infrastructure/
│   ├── providers/              # OpenAI, Anthropic, Google, Generic
│   │   └── base/               # BaseProvider, BaseTextProvider, BaseMediaProvider
│   ├── context/compactors/     # Truncate, Summarize, MemoryEviction
│   ├── resilience/             # CircuitBreaker, BackoffStrategy, RateLimiter
│   ├── observability/          # Logger, Metrics
│   └── storage/                # InMemory, File session/history storage
├── tools/
│   ├── filesystem/             # readFile, writeFile, editFile, glob, grep, listDirectory
│   ├── shell/                  # bash
│   ├── web/                    # webFetch, webFetchJS, webSearch, webScrape
│   ├── connector/              # ConnectorTools (generic API from connector)
│   ├── code/                   # executeJavaScript
│   └── json/                   # jsonManipulator
├── connectors/
│   ├── oauth/                  # OAuthManager, flows
│   └── storage/                # ConnectorConfigStore
└── utils/                      # messageBuilder, clipboardImage, jsonExtractor
```

## Key Patterns

### IDisposable Pattern
Classes with resources implement `destroy(): void` and `isDestroyed: boolean`.
- ToolManager, AgentContext, IdempotencyCache, ModeManager, WorkingMemory

### Composition Over Inheritance
- AgentContext composes ToolManager, WorkingMemory, IdempotencyCache, ToolPermissionManager
- Agents extend BaseAgent (creates AgentContext in constructor)

### Registry Pattern
- `Connector.create()` / `Connector.get()` - static auth registry
- `MCPRegistry.create()` / `MCPRegistry.get()` - MCP server registry
- `ScrapeProvider` / `SearchProvider` - service-based registries

### Circuit Breaker
Per-tool failure protection in ToolManager:
```typescript
toolManager.setCircuitBreakerConfig('tool', { failureThreshold: 3, resetTimeoutMs: 60000 });
```

## Centralized Constants (`src/core/constants.ts`)

| Group | Key Constants |
|-------|---------------|
| TASK_DEFAULTS | TIMEOUT_MS=300000, MAX_RETRIES=3 |
| CONTEXT_DEFAULTS | MAX_TOKENS=128000, COMPACTION_THRESHOLD=0.75 |
| AGENT_DEFAULTS | MAX_ITERATIONS=10, DEFAULT_TEMPERATURE=0.7 |
| CIRCUIT_BREAKER_DEFAULTS | FAILURE_THRESHOLD=5, RESET_TIMEOUT_MS=60000 |
| MEMORY_DEFAULTS | MAX_SIZE_BYTES=25MB, SOFT_LIMIT_PERCENT=80 |

## Context Management Strategies

| Strategy | Threshold | Use Case |
|----------|-----------|----------|
| **proactive** | 75% | Default, balanced |
| **aggressive** | 60% | Memory-constrained |
| **lazy** | 90% | Preserve context |
| **rolling-window** | N messages | Fixed window |
| **adaptive** | Learns | Auto-adjusts |

## Tool Permissions

Default allowlist (no approval needed): `read_file`, `glob`, `grep`, `list_directory`, `memory_*`, `context_set`, `context_get`, `context_delete`, `context_list`, `cache_stats`, `_start_planning`, `_modify_plan`, `_report_progress`, `_request_approval`

Require approval: `write_file`, `edit_file`, `bash`, `web_*`, `execute_javascript`, custom tools

## Working Memory Scopes

```typescript
type SimpleScope = 'session' | 'persistent';
type TaskAwareScope = { type: 'session' } | { type: 'plan' } | { type: 'persistent' } | { type: 'task'; taskIds: string[] };
```

## Model Registry (`src/domain/entities/Model.ts`)

23+ models with pricing, context windows, feature flags:
- **OpenAI**: GPT-5.2 series, GPT-5 family, GPT-4.1, o3-mini
- **Anthropic**: Claude 4.5 (Opus, Sonnet, Haiku), Claude 4.x
- **Google**: Gemini 3 series, Gemini 2.5 series

```typescript
const info = getModelInfo('gpt-5.2');
const cost = calculateCost('gpt-5.2-thinking', inputTokens, outputTokens);
```

## ResearchAgent (NEW)

Generic research agent supporting any data sources (web, vector, file, API, etc.):

```typescript
import { ResearchAgent, createWebSearchSource, createFileSearchSource } from '@oneringai/agents';

// Create sources (implements IResearchSource)
const webSource = createWebSearchSource('serper-main');
const fileSource = createFileSearchSource('./docs');

// Create research agent
const agent = ResearchAgent.create({
  connector: 'openai',
  model: 'gpt-4-turbo',
  sources: [webSource, fileSource],
});

// Built-in research tools: research_search, research_fetch, research_store_finding, research_list_sources
```

### IResearchSource Interface

```typescript
interface IResearchSource {
  name: string;
  description: string;
  type: 'web' | 'vector' | 'file' | 'api' | 'database' | 'custom';
  search(query: string, options?: SearchOptions): Promise<SearchResponse>;
  fetch(reference: string, options?: FetchOptions): Promise<FetchedContent>;
}
```

### AutoSpillPlugin

Automatically spills large tool outputs to memory:

```typescript
const autoSpill = new AutoSpillPlugin(memory, {
  sizeThreshold: 10 * 1024,  // 10KB
  toolPatterns: [/^web_fetch/, /^research_/],
});

// Integrated with ResearchAgent automatically
// Manual usage: autoSpill.onToolOutput(toolName, output)
// Cleanup: await autoSpill.cleanupConsumed()
```

### memory_retrieve_batch Tool

Efficient batch retrieval of memory entries:

```typescript
// Pattern matching
await memory_retrieve_batch({ pattern: 'findings.*' });

// By tier
await memory_retrieve_batch({ tier: 'findings', includeMetadata: true });
```

## InContextMemory (NEW)

In-context memory for frequently-accessed state stored **directly in context** (not just an index).

**Key Difference from WorkingMemory:**
- **WorkingMemory**: Stores data externally, provides an **index** in context, requires `memory_retrieve()` for values
- **InContextMemory**: Stores data **directly in context**, LLM sees full values immediately

### Setup

```typescript
import { AgentContext, setupInContextMemory, createInContextMemory } from '@oneringai/agents';

// Option 1: Quick setup with helper
const ctx = AgentContext.create({ model: 'gpt-4' });
const plugin = setupInContextMemory(ctx, { maxEntries: 15 });

// Option 2: Manual setup
const { plugin, tools } = createInContextMemory({ maxEntries: 20 });
ctx.registerPlugin(plugin);
for (const tool of tools) ctx.tools.register(tool);
```

### Configuration

```typescript
interface InContextMemoryConfig {
  maxEntries?: number;        // Default: 20
  maxTotalTokens?: number;    // Default: 4000
  defaultPriority?: 'low' | 'normal' | 'high' | 'critical';
  showTimestamps?: boolean;   // Default: false
  headerText?: string;        // Default: '## Live Context'
}
```

### Tools

| Tool | Purpose |
|------|---------|
| `context_set` | Store/update key-value pair |
| `context_get` | Read value (for verification) |
| `context_delete` | Remove entry to free space |
| `context_list` | List all entries with metadata |

### Priority-Based Eviction

When space is needed, entries are evicted by priority: `low` → `normal` → `high` (oldest first within priority). **Critical** entries are never auto-evicted.

### Direct API Access

```typescript
plugin.set('state', 'Current state', { step: 1 }, 'high');
plugin.get('state');        // { step: 1 }
plugin.has('state');        // true
plugin.delete('state');     // true
plugin.list();              // [{ key, description, priority, updatedAt }]
plugin.clear();             // Remove all
```

### Use Cases

- Current state/status that changes during execution
- User preferences for the session
- Small accumulated results
- Counters, flags, control variables

**Do NOT use for:** Large data (use WorkingMemory), rarely accessed reference data.

## MCP Integration

```typescript
const client = MCPRegistry.create({ name: 'fs', transport: 'stdio', transportConfig: { command: 'npx', args: [...] } });
await client.connect();
client.registerTools(agent.tools);
```

Supports: stdio (local), HTTP/HTTPS (remote) transports.

## Important Conventions

### Import Extensions
Always use `.js` extension:
```typescript
import { Agent } from './Agent.js';  // Correct
```

### Type Exports
```typescript
export { MessageRole } from './Message.js';  // Enum (runtime value)
export type { Message } from './Message.js';  // Interface (type-only)
```

### Error Handling
Use custom error classes from `src/domain/errors/AIErrors.ts`:
```typescript
throw new ProviderAuthError('openai', 'Invalid API key');
throw new ToolExecutionError('tool_name', 'Reason');
```

## Build Commands

```bash
npm run build          # Build with tsup
npm run dev            # Watch mode
npm run typecheck      # Type check
npm run lint           # ESLint
npm test               # All tests
npm run test:unit      # Unit tests only
npm run test:integration  # Integration tests (requires API keys)
```

## Key Interfaces

| Interface | Purpose | File |
|-----------|---------|------|
| ITextProvider | Text generation | `src/domain/interfaces/ITextProvider.ts` |
| IToolExecutor | Tool execution | `src/domain/interfaces/IToolExecutor.ts` |
| IDisposable | Resource cleanup | `src/domain/interfaces/IDisposable.ts` |
| IHistoryManager | History management | `src/domain/interfaces/IHistoryManager.ts` |

## Services Registry (`src/domain/entities/Services.ts`)

35+ external services with metadata: Slack, GitHub, Stripe, Salesforce, Zendesk, etc.

```typescript
Connector.create({ name: 'github', serviceType: Services.Github, auth: {...}, baseURL: 'https://api.github.com' });
const tools = ConnectorTools.for('github');  // Generic API tool
```

## Lifecycle Hooks

```typescript
const agent = Agent.create({
  connector: 'openai', model: 'gpt-4',
  lifecycleHooks: {
    beforeToolExecution: async (ctx) => { /* can throw to block */ },
    afterToolExecution: async (result) => { /* logging */ },
    beforeCompaction: async (ctx) => { /* save important data */ },
    onError: async (error, ctx) => { /* alerting */ },
  },
});
```

## Adding New Vendors

1. Add to `Vendor` enum (`src/core/Vendor.ts`)
2. Create provider (`src/infrastructure/providers/newvendor/NewVendorTextProvider.ts`)
3. Register in factory (`src/core/createProvider.ts`)

## ToolFunction Definition

```typescript
const myTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'tool_name',
      description: 'What it does',
      parameters: { type: 'object', properties: {...}, required: [...] },
    },
  },
  execute: async (args) => ({ result: 'value' }),
  describeCall: (args) => args.key,  // For logging
};
```

---

**Version**: 0.2.0 | **Last Updated**: 2026-01-31 | **Architecture**: Connector-First (v2)
