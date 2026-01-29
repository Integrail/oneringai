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
ctx.addMessage('user', 'Hello');
const result = await ctx.executeTool('tool_name', args);
const prepared = await ctx.prepare(); // Assembles context, handles compaction
```

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

All extend **BaseAgent** and share unified tool management (`agent.tools === agent.context.tools`).

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
│   │   ├── ContextManager.ts, types.ts
│   │   ├── strategies/         # Proactive, Aggressive, Lazy, RollingWindow, Adaptive
│   │   └── plugins/            # MemoryPlugin, PlanPlugin, ToolOutputPlugin
│   ├── history/                # ConversationHistoryManager
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
| MEMORY_DEFAULTS | MAX_SIZE_BYTES=1MB, SOFT_LIMIT_PERCENT=80 |

## Context Management Strategies

| Strategy | Threshold | Use Case |
|----------|-----------|----------|
| **proactive** | 75% | Default, balanced |
| **aggressive** | 60% | Memory-constrained |
| **lazy** | 90% | Preserve context |
| **rolling-window** | N messages | Fixed window |
| **adaptive** | Learns | Auto-adjusts |

## Tool Permissions

Default allowlist (no approval needed): `read_file`, `glob`, `grep`, `list_directory`, `memory_*`, `context_*`, `cache_stats`, `_start_planning`, `_modify_plan`, `_report_progress`, `_request_approval`

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

**Version**: 0.2.0 | **Last Updated**: 2026-01-29 | **Architecture**: Connector-First (v2)
