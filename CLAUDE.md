# Claude Development Guide

## Project Overview

**Name**: `@everworker/oneringai`
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

- **Connector** (`src/core/Connector.ts`) — Static auth registry. `Connector.create()` / `Connector.get()`
- **Agent** (`src/core/Agent.ts`) — Main agent extending BaseAgent. `Agent.create({ connector, model, tools })`
- **AgentContextNextGen** (`src/core/context-nextgen/AgentContextNextGen.ts`) — Plugin-first context manager
- **ToolManager** (`src/core/ToolManager.ts`) — Unified tool management + execution. `IToolExecutor`, `IDisposable`. Per-tool circuit breakers
- **Vendor** (`src/core/Vendor.ts`) — Const object: `{ OpenAI, Anthropic, Google, GoogleVertex, Groq, Together, Grok, DeepSeek, Mistral, Perplexity, Ollama, Custom }`

## AgentContextNextGen

Plugin-first context manager. Features enable/disable plugins:

```typescript
interface ContextFeatures {
  workingMemory?: boolean;         // default: true
  inContextMemory?: boolean;       // default: true
  persistentInstructions?: boolean; // default: false
  userInfo?: boolean;              // default: false
  toolCatalog?: boolean;           // default: false
  sharedWorkspace?: boolean;       // default: false
}
```

**Tool Catalog scoping:** `toolCategories` = built-in, `identities` = connector categories, `pinned` = always loaded. Plugin tools always available.

**Key APIs:** `ctx.tools`, `ctx.memory`, `ctx.features`, `ctx.registerPlugin()`, `ctx.getPlugin<T>(name)`, `ctx.addUserMessage()`, `ctx.addAssistantResponse()`, `ctx.addToolResults()`, `ctx.prepare()`, `ctx.save()`, `ctx.load()`

**Compaction:** Happens once before LLM call via `StrategyRegistry`. Default: algorithmic (75% threshold). Tool pairs always removed together.

## Agent run() / stream()

`RunOptions`: `thinking` (vendor-agnostic), `temperature`, `vendorOptions` — override per call.

**Direct LLM access:** `agent.runDirect()` / `agent.streamDirect()` — bypasses context management. Options: `instructions`, `includeTools`, `temperature`, `maxOutputTokens`, `responseFormat`, `thinking`, `vendorOptions`

## Directory Structure

```
src/
├── index.ts                    # Main exports (~300 items)
├── core/                       # Agent, BaseAgent, Connector, Vendor, ToolManager, constants
│   ├── context-nextgen/        # AgentContextNextGen + plugins
│   ├── orchestrator/           # createOrchestrator, orchestration tools
│   ├── permissions/            # PermissionPolicyManager, policies, UserPermissionRulesEngine
│   ├── mcp/                    # MCPClient, MCPRegistry
│   └── StorageRegistry.ts      # Centralized storage backend registry
├── domain/
│   ├── entities/               # Model.ts, Tool.ts, Message.ts, Memory.ts, Services.ts (35+)
│   ├── interfaces/             # ITextProvider, IAudioProvider, IToolExecutor, IDisposable, IContextStorage
│   └── errors/                 # AIErrors.ts, MCPError.ts
├── capabilities/               # search/, scrape/, images/, video/
├── infrastructure/
│   ├── providers/              # OpenAI, Anthropic, Google, Generic (+ base/)
│   ├── resilience/             # CircuitBreaker, BackoffStrategy, RateLimiter
│   └── storage/                # FileContextStorage, InMemoryStorage
├── tools/                      # filesystem/, shell/, web/, desktop/, connector/, code/, json/
├── connectors/                 # oauth/, storage/
└── utils/
```

## Unified Store Tools

All CRUD plugins share 5 generic tools routed by `StoreToolsManager`:

| Tool | Purpose |
|------|---------|
| `store_get(store, key?)` | Get entry or all entries |
| `store_set(store, key, value, ...)` | Create/update entry |
| `store_delete(store, key)` | Delete entry |
| `store_list(store, options?)` | List with optional filtering |
| `store_action(store, action, params?)` | Store-specific ops |

**Store IDs:** `"memory"`, `"context"`, `"instructions"`, `"user_info"`, `"workspace"` (+ custom `IStoreHandler` plugins)

**Custom CRUD plugin:** Implement `IContextPluginNextGen` + `IStoreHandler` with `storeId`/`storeDescription` + handle methods. Register via `ctx.registerPlugin()` — auto-detected.

## NextGen Plugins

| Plugin | Store ID | Purpose |
|--------|----------|---------|
| **WorkingMemoryPluginNextGen** | `"memory"` | Tiered storage (raw/summary/findings), auto-eviction. `ctx.memory` shortcut |
| **InContextMemoryPluginNextGen** | `"context"` | KV storage **directly in context** (no retrieval needed). Priority-based eviction (low→high, critical never evicted) |
| **PersistentInstructionsPluginNextGen** ⚠️ *deprecated* | `"instructions"` | Keyed instructions persisting to disk. Requires `agentId`. Storage: `~/.oneringai/agents/<agentId>/custom_instructions.json`. **Prefer `MemoryPluginNextGen`.** |
| **UserInfoPluginNextGen** ⚠️ *deprecated* | `"user_info"` | User-scoped data (not agent-scoped). Stateless — userId from `ToolContext.userId`. Also provides standalone `todo_add/update/remove` tools. **Prefer `MemoryPluginNextGen`.** |
| **SharedWorkspacePluginNextGen** | `"workspace"` | Multi-agent bulletin board. Versioning, author tracking, append-only log. Extra actions: `log`, `history`, `archive` |
| **MemoryPluginNextGen** (feature flag `memory`) | — (no KV) | Self-learning knowledge store. Bootstraps `person:<userId>` + `agent:<agentId>` entities; injects their profiles into system message; ships 8 LLM-callable `memory_*` tools for facts, graph, search, linking, forget/supersede. Requires `plugins.memory.memory: MemorySystem` + `userId`. |

**WorkingMemory vs InContextMemory:** WorkingMemory stores externally with index in context (needs retrieval). InContextMemory stores values directly in context.

**MemoryPluginNextGen tools:** `memory_recall`, `memory_graph`, `memory_search`, `memory_find_entity`, `memory_list_facts`, `memory_remember`, `memory_link`, `memory_forget`. `SubjectRef` accepts id | `"me"` | `"this_agent"` | `{id}` | `{identifier:{kind,value}}` | `{surface}`. All caller-supplied limits are clamped (maxDepth≤5, topK≤100, limit≤200, etc.). `groupId` flows from plugin config (trusted), never from LLM tool args.

## StorageRegistry (`src/core/StorageRegistry.ts`)

Centralized backend registry. Resolution: explicit param > `StorageRegistry.get()` > file-based default.

- **Singletons**: `media`, `agentDefinitions`, `connectorConfig`, `oauthTokens`
- **Factories**: `customTools(ctx?)`, `sessions(agentId, ctx?)`, `persistentInstructions(agentId, ctx?)`, `workingMemory(ctx?)`, `userInfo(ctx?)`
- **Multi-tenant**: `StorageContext` (opaque record) flows to factories. Set via `StorageRegistry.setContext()`.

## User-Scoped Storage (Uniform Pattern)

Both `IUserInfoStorage` and `ICustomToolStorage` take `userId: string | undefined` — **always optional**, defaults to `'default'`.
- User-scoped: `~/.oneringai/users/<userId>/custom-tools/`, `~/.oneringai/users/<userId>/user_info.json`
- Agent-scoped: `~/.oneringai/agents/<agentId>/sessions/`, `~/.oneringai/agents/<agentId>/custom_instructions.json`

**Custom tool meta-tools:** `custom_tool_save`, `custom_tool_load`, `custom_tool_list`, `custom_tool_delete`, `custom_tool_draft`, `custom_tool_test`

## Tool Permissions

3-tier evaluation in `PermissionPolicyManager.check()`:
1. **User rules** (highest, FINAL) — persistent rules with argument conditions
2. **Parent delegation** (orchestrator) — parent deny is final
3. **Policy chain** — deny short-circuits

**Tool scopes:** `'always'` (auto-allow: read-only tools, store_*, todo_*, catalog), `'session'` (ask once: write/edit, web_fetch), `'once'` (ask every: bash, execute_javascript)

**Built-in policies:** Allowlist, Blocklist, SessionApproval, PathRestriction, BashFilter, UrlAllowlist, Role, RateLimit

## Agent Orchestrator (`src/core/orchestrator/`)

`createOrchestrator()` returns a regular Agent with orchestration tools + shared workspace.

**7 tools:** `create_agent`, `list_agents`, `destroy_agent`, `assign_turn` (blocking), `assign_turn_async` (non-blocking), `assign_parallel`, `send_message`

`agent.inject(message, role)` — queue message into running agent's context.

## Key Patterns

- **IDisposable**: `destroy(): void` + `isDestroyed: boolean` on ToolManager, AgentContextNextGen, plugins
- **Registry**: Connector, MCPRegistry, StorageRegistry, ScrapeProvider, SearchProvider
- **Circuit Breaker**: Per-tool in ToolManager (`setCircuitBreakerConfig`)
- **Plugin-First**: Plugins provide instructions, content, tools. Register custom via `ctx.registerPlugin()`

## Conventions

**Imports:** Always use `.js` extension: `import { Agent } from './Agent.js'`

**Type exports:** `export type { X }` for interfaces, `export { X }` for enums/runtime values

**Errors:** Use `AIErrors.ts` classes: `ProviderAuthError`, `ToolExecutionError`, etc.

**ToolFunction definition:**
```typescript
const myTool: ToolFunction = {
  definition: { type: 'function', function: { name, description, parameters } },
  execute: async (args) => ({ result: 'value' }),
  describeCall: (args) => args.key,
};
```

**Adding vendors:** 1) Add to `Vendor` enum 2) Create provider in `infrastructure/providers/` 3) Register in `createProvider.ts`

## Build Commands

```bash
npm run build          # generate + tsup
npm run dev            # Watch mode
npm run typecheck      # Type check
npm run lint           # ESLint
npm test               # All tests
npm run test:unit      # Unit tests only
npm run test:integration  # Integration tests (requires API keys)
```

## Constants (`src/core/constants.ts`)

CONTEXT_DEFAULTS.MAX_TOKENS=128000, COMPACTION_THRESHOLD=0.75 | AGENT_DEFAULTS.MAX_ITERATIONS=50, TEMPERATURE=0.7 | CIRCUIT_BREAKER.FAILURE_THRESHOLD=5 | MEMORY.MAX_SIZE=25MB

## TemplateEngine (`src/core/TemplateEngine.ts`)

Extensible `{{COMMAND}}` / `{{COMMAND:arg}}` substitution for agent instructions. Static registry pattern.

**Two-phase processing:**
- **Static** (Agent constructor, `processSync`): AGENT_ID, AGENT_NAME, MODEL, VENDOR, USER_ID
- **Dynamic** (buildSystemMessage, `process`): DATE, TIME, DATETIME, RANDOM

**Escaping:** `{{{X}}}` → literal `{{X}}`. `{{raw}}...{{/raw}}` → verbatim block.

**Extensibility:** `TemplateEngine.register('NAME', handler, { dynamic?: boolean })`. Handlers: `(arg: string | undefined, ctx: TemplateContext) => string | Promise<string>`.

**Date format tokens:** YYYY, YY, MM, DD, HH, hh, mm, ss, A, a

## MCP Integration

`MCPRegistry.create({ name, transport, transportConfig })` → `client.connect()` → `client.registerTools(agent.tools)`. Supports stdio + HTTP/HTTPS.

## Model Registry (`src/domain/entities/Model.ts`)

23+ models: OpenAI (GPT-5.2, GPT-5, GPT-4.1, o3-mini), Anthropic (Claude 4.5/4.x), Google (Gemini 3/2.5). `getModelInfo()`, `calculateCost()`.

## Services Registry (`src/domain/entities/Services.ts`)

35+ services (Slack, GitHub, Stripe, etc.). `ConnectorTools.for(connectorName)` returns generic API tool.

## Memory Layer (`src/memory/`)

Brain-like knowledge store: **entities** (pure identity + metadata) + **facts** (triples with provenance, confidence, importance, contextIds). Self-contained — only dependency is `IDisposable`.

**Core:** `MemorySystem.ts` (facade), `Ranking.ts`, `GenericTraversal.ts`, `types.ts`.

**Adapters** (pluggable):
- `adapters/inmemory/InMemoryAdapter.ts` — zero-dep default.
- `adapters/mongo/` — `MongoMemoryAdapter` + `RawMongoCollection` (mongodb driver) + `MeteorMongoCollection` (Meteor-reactive writes). Configurable collection names, optional `$graphLookup` + Atlas Vector Search fast paths.

**Integration** (`src/memory/integration/`):
- `ConnectorEmbedder` + `ConnectorProfileGenerator` — wire oneringai Connectors into memory's `IEmbedder`/`IProfileGenerator`.
- `createMemorySystemWithConnectors({ store, connectors: { embedding: {connector, model, dimensions}, profile: {connector, model} } })` — one-call setup.
- `ExtractionResolver` + `defaultExtractionPrompt` — raw LLM output (`{mentions, facts}`) → resolved entities + facts with `sourceSignalId` attached. Supports `preResolved: {label → entityId}` to bypass upsert for labels bound upstream.
- `signals/` — high-level facts-producing API: `SignalIngestor` orchestrates adapter → deterministic seed phase → prompt (with locked labels) → `IExtractor` LLM call → `ExtractionResolver`. Ships `PlainTextAdapter`, `EmailSignalAdapter` (seeds from/to/cc + non-free domains, drops BCC), `ConnectorExtractor` (default LLM via Connector). Custom `SignalSourceAdapter` + `IExtractor` are the extension points.

**Agent integration** (`src/core/context-nextgen/plugins/MemoryPluginNextGen.ts` + `src/tools/memory/`):
- `MemoryPluginNextGen` — NextGen context plugin, injects user + agent profiles + top facts into system message; ships 8 `memory_*` LLM tools; self-learning via incremental profile regen. Feature flag: `memory` (default off). Requires `plugins.memory.memory: MemorySystem` + `userId`.
- `createMemoryTools({ memory, agentId, defaultUserId, defaultGroupId, ... })` — factory for the 8 tools without the full plugin. `defaultGroupId` is trusted (from host auth layer); tools never accept a `groupId` arg from the LLM. All numeric limits are clamped (maxDepth≤5, topK≤100, limit≤200, etc.).
- **Incremental profile regen:** `IProfileGenerator.generate` takes a single `ProfileGeneratorInput` with `newFacts` (observed since prior), `priorProfile`, `invalidatedFactIds` (supersession + archivals). Generator evolves the prior profile from deltas rather than rewriting from all facts.

**Resolution** (`src/memory/resolution/`):
- `EntityResolver` translates surface forms ("Microsoft", "Q3 Planning") to entity IDs. Tiers: identifier (1.0) → exact displayName (0.9) → exact alias (0.85) → fuzzy (0.6–0.84) → semantic (identityEmbedding). Conservative default auto-resolve threshold 0.9; configurable via `entityResolution.autoResolveThreshold`.
- `fuzzy.ts` — normalized Levenshtein (strips Inc/Corp/LLC, case-insensitive, punctuation-tolerant).

**Entity type conventions** (see `types.ts` header):
- `person`, `organization`, `topic`: minimal metadata.
- `task`: `metadata.{state, dueAt, priority, assigneeId, reporterId, projectId}`. State history via supersession facts.
- `event`: `metadata.{startTime, endTime, attendeeIds, location, kind}`.
- `project`, `cluster`: extensible.

**Key invariants:**
- `IFact`: `contextIds?` for multi-entity binding; `importance?` (0..1, default 0.5) multiplies into ranking; `sourceSignalId?` opaque (library user owns the signal store).
- `getContext` returns profile + topFacts (subject OR object OR contextIds) + relatedTasks + relatedEvents by default. Pass `tiers: 'minimal'` to suppress.
- **Owner required:** every entity + fact MUST have `ownerId`. `OwnerRequiredError` thrown at creation when absent from both input and `scope.userId`. Admins can set `ownerId` to any user id (no equality check vs `scope.userId`).
- **Permissions (three-principal):** every record carries optional `permissions: { group?, world? }` with `AccessLevel = 'none'|'read'|'write'`. Owner always has full access. Defaults: `group='read'`, `world='read'` (public-read, owner-write). See `src/memory/AccessControl.ts` + `docs/MEMORY_PERMISSIONS.md`.
- **Read vs write enforcement:** reads are filtered at storage (adapter translates `canAccess(..., 'read')` into native query). Writes are checked at MemorySystem (`assertCanAccess(..., 'write')` throws `PermissionDeniedError`).
- Scope visibility: `(groupId, ownerId)` absent = global; both match for user-within-group. Layered under permissions — scope defines the principal; permissions define the level.
- Tests: 303 unit tests, 14 files. Mongo real-DB integration gated on `mongodb` + `mongodb-memory-server` optional peer deps.

---

**Version**: 0.5.1 | **Last Updated**: 2026-04-04 | **Architecture**: Connector-First + NextGen Context
