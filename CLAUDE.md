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

## OAuth: Vendor Refresh Strategy

Every authorization_code vendor template MUST declare a `refreshStrategy: RefreshStrategy` (validated at registry-init time — `initVendorRegistry` throws on missing). Drives whether the library force-merges anything into the authorize URL to guarantee refresh-capable tokens.

**Variants** (`src/connectors/vendors/types.ts`):
- `{ kind: 'scope', scope: '<token>' }` — vendor requires this scope for refresh-token issuance. Force-merged into `scope` AND stamped on `OAuthConnectorAuth.requiredScope` so reconstitution-from-DB paths re-apply it. Microsoft / Atlassian → `offline_access`, Salesforce → `refresh_token`, Twitter/X → `offline.access` (dot, not underscore!).
- `{ kind: 'auth_param', key, value }` — vendor requires an authorize-URL query param. Merged into `authorizationParams` without clobbering operator-set keys. Google → `access_type=offline`, Dropbox → `token_access_type=offline`.
- `{ kind: 'automatic' }` — vendor issues `refresh_token` unconditionally. No-op (Discord, Asana, HubSpot, Stripe, QuickBooks, Box, Zoom, Pipedrive, Ramp, Bitbucket, Airtable, GitLab, PagerDuty, Sentry).
- `{ kind: 'never_expires' }` — vendor's tokens don't expire; refresh n/a (Notion, Linear, Slack default, Trello, Mailchimp, Zendesk, Intercom, Shopify, GitHub OAuth Apps).
- `{ kind: 'manual_setup', description }` — refresh requires out-of-band IdP/app config the library can't enforce (e.g. GitHub App "expire user tokens" toggle, Slack token rotation enable). No-op on the wire; surface the description to operators.

**Defensive backfill:** `Connector.setRefreshStrategyBackfill(...)` is registered by `vendors/index.ts` at boot. When a Connector is reconstructed from a persisted config that pre-dates the `requiredScope` annotation, `initOAuthManager` looks up the vendor template by `serviceType` and re-applies the strategy. **No migration required for existing saved connectors.**

**Persistence:** `requiredScope` lives on `OAuthConnectorAuth` and survives encryption/decryption (spread-preserved by `ConnectorConfigStore`). Hosts that bypass `buildAuthConfig` (e.g. v25's `GroupScopedConnectorRegistry`) get the right behavior via the backfill.

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

`RunOptions`: `thinking` (vendor-agnostic), `temperature`, `vendorOptions`, `responseFormat` — override per call.

**Direct LLM access:** `agent.runDirect()` / `agent.streamDirect()` — bypasses context management. Options: `instructions`, `includeTools`, `temperature`, `maxOutputTokens`, `responseFormat`, `thinking`, `vendorOptions`

**Structured (JSON) output (`src/core/StructuredOutput.ts`):** vendor-agnostic `responseFormat: ResponseFormat` = `{type:'json_object'}` | `{type:'json_schema', schema, name?, description?, strict?}`. `resolveStructuredStrategy(format, caps, vendor, hasTools)` picks `'native'` vs `'prompt'` from `provider.getModelCapabilities(model).supportsJSON/supportsJSONSchema`: native maps to OpenAI `text.format` / Google-Vertex `responseJsonSchema`. **Anthropic routes to prompt fallback** — `AnthropicTextProvider` forces `supportsJSONSchema:false` because the registry's `structuredOutput` flag over-flags older Claude models (e.g. claude-3-7-sonnet) that would 400 on `output_config.format`; re-enable native only behind an accurate per-model gate. **Validation contract: parse-only** — native path is vendor-enforced; prompt-fallback guarantees *parseable* JSON (via `parseJsonPermissive`) but does NOT validate schema conformance (deliberate: no validator dep). Result attached to `response.output_parsed`. Shared `BaseAgent.coerceStructuredOutput(candidate, format, reask)` drives both `runDirect()` (candidate = direct response) and `run()` (candidate = loop's final answer, `reask` = `_generateStructuredToolFree` tool-free pass) — one re-ask (`STRUCTURED_OUTPUT_MAX_REPAIR_ATTEMPTS=1`), mutates candidate in place + merges usage, then throws `StructuredOutputError` (logged, never silent). Inline native applied in the loop only when native+tool-compatible (OpenAI); Google/Vertex are format-vs-tools exclusive so they use the final tool-free pass. When the reformat pass changes the answer, `run()` calls `ctx.replaceLastAssistantResponse(output)` so persisted history / save-load / continuation match the returned JSON. **`stream()` enforces only inline** (native, or prompt-no-tools) — it has no reformat pass, so prompt-fallback + tools streaming is not guaranteed JSON (logs a warning; use `run()`), and `output_parsed` is not attached on streams. JSON only.

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
| **MemoryPluginNextGen** (feature flag `memory`) | — (no KV) | Self-learning knowledge store (read-side). Bootstraps `person:<userId>` + `agent:<agentId>` entities; injects the user profile + any user-specific behavior rules for this agent into the system message; ships **5 read-only** `memory_*` tools. Requires `plugins.memory.memory: MemorySystem` + `userId`. |
| **MemoryWritePluginNextGen** (feature flag `memoryWrite`) | — (no KV) | Lightweight sidecar — adds the **6 write** `memory_*` tools. No system-message content of its own. Requires `memory: true` (piggy-backs on its bootstrap via a `getOwnSubjectIds` callback). Enable when the agent should mutate memory directly; otherwise use a background extractor like `SessionIngestorPluginNextGen`. |

**WorkingMemory vs InContextMemory:** WorkingMemory stores externally with index in context (needs retrieval). InContextMemory stores values directly in context.

**Memory tools (11 total — split by plugin):**
- **Read (always via MemoryPluginNextGen):** `memory_recall`, `memory_graph`, `memory_search`, `memory_find_entity` (actions: `find` | `list`), `memory_list_facts`.
- **Write (via MemoryWritePluginNextGen):** `memory_remember`, `memory_link`, `memory_upsert_entity`, `memory_forget`, `memory_restore`, `memory_set_agent_rule`.
- **Tool-name migration:** `memory_find_entity` with `action: 'upsert'` was split into a standalone **`memory_upsert_entity`** tool (v0.5.6+). `memory_find_entity` is now read-only.
- **`memory_set_agent_rule({rule, replaces?})`** — narrow-trigger tool for user-driven agent behavior directives (tone / style / format / language / interaction rules). Writes a fact with `subjectId = agentEntityId`, `predicate = agent_behavior_rule`, private visibility. Rendered back into the system message under `## User-specific instructions for this agent` — per-user-per-agent scoped via `ownerId`. See `MemoryWritePluginNextGen.WRITE_INSTRUCTIONS` for the narrow trigger rules (YES: "be terse"; NO: task requests, calendar actions, factual corrections, user statements).

`SubjectRef` accepts id | `"me"` | `"this_agent"` | `{id}` | `{identifier:{kind,value}}` | `{surface}`. All caller-supplied limits are clamped (maxDepth≤5, topK≤100, limit≤200, etc.). `groupId` flows from plugin config (trusted), never from LLM tool args.

**Assembling tools without plugins:** `createMemoryReadTools(...)` and `createMemoryWriteTools(...)` export the bundles directly; `createMemoryTools(...)` is a convenience wrapper returning all 11. All three factories share the same `CreateMemoryToolsArgs`.

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
- `adapters/mongo/` — `MongoMemoryAdapter` + `RawMongoCollection` (mongodb driver) + `MeteorMongoCollection` (Meteor-reactive writes). Configurable collection names, optional `$graphLookup` + Atlas Vector Search fast paths for both facts and entities. Vector indexes **must** be created via `ensureVectorSearchIndexes()` — the helper declares the filter-path schema required for scope/permission filters to take effect. Manual UI creation is discouraged (see deployment checklist).

**Integration** (`src/memory/integration/`):
- `ConnectorEmbedder` + `ConnectorProfileGenerator` — wire oneringai Connectors into memory's `IEmbedder`/`IProfileGenerator`.
- `createMemorySystemWithConnectors({ store, connectors: { embedding: {connector, model, dimensions}, profile: {connector, model} } })` — one-call setup.
- `ExtractionResolver` + `defaultExtractionPrompt` — raw LLM output (`{mentions, facts}`) → resolved entities + facts with `sourceSignalId` attached. Supports `preResolved: {label → entityId}` to bypass upsert for labels bound upstream.
- `signals/` — high-level facts-producing API: `SignalIngestor` orchestrates adapter → deterministic seed phase → prompt (with locked labels) → `IExtractor` LLM call → `ExtractionResolver`. Ships `PlainTextAdapter`, `EmailSignalAdapter` (seeds from/to/cc + non-free domains, drops BCC), `ConnectorExtractor` (default LLM via Connector). Custom `SignalSourceAdapter` + `IExtractor` are the extension points.

**Agent integration** (`src/core/context-nextgen/plugins/Memory{,Write}PluginNextGen.ts` + `src/tools/memory/`):
- `MemoryPluginNextGen` — read-side context plugin. Injects the user profile + top facts + any user-specific behavior rules for this agent into the system message; ships the **5 read** `memory_*` LLM tools; drives self-learning via incremental user-profile regen. Agent-profile auto-render was removed (global agent personality lives on `Agent.create({instructions})`; `agentProfileInjection` config is kept for backward-compat but is a no-op). Feature flag: `memory` (default off). Requires `plugins.memory.memory: MemorySystem` + `userId`.
- `MemoryWritePluginNextGen` — write-side sidecar. Ships the **6 write** `memory_*` LLM tools (`memory_remember`, `memory_link`, `memory_upsert_entity`, `memory_forget`, `memory_restore`, `memory_set_agent_rule`) and its own instruction block; no system-message content. Feature flag: `memoryWrite` (requires `memory: true`). Shares the read plugin's bootstrapped user/agent entity ids via a `getOwnSubjectIds` callback (wired automatically when both are feature-flagged).
- `createMemoryReadTools(...)` / `createMemoryWriteTools(...)` / `createMemoryTools(...)` — assemble tools without the plugins. All three share the same `CreateMemoryToolsArgs`. `defaultGroupId` is trusted (from host auth layer); tools never accept a `groupId` arg from the LLM. All numeric limits are clamped (maxDepth≤5, topK≤100, limit≤200, etc.).
- **Background ingestion alternative:** `SessionIngestorPluginNextGen` (also exported) fires `onBeforePrepare`, extracts facts from the accumulated conversation via a (usually cheaper) dedicated connector+model, and writes them directly to the `MemorySystem`. Pair it with `memory: true` only (no `memoryWrite`) to get a retrieval-only agent whose memory updates happen behind the scenes.
- **Incremental profile regen:** `IProfileGenerator.generate` takes a single `ProfileGeneratorInput` with `newFacts` (observed since prior), `priorProfile`, `invalidatedFactIds` (supersession + archivals). Generator evolves the prior profile from deltas rather than rewriting from all facts.

**Content embedding composers** (`src/memory/composers/`):
- **Two-axis embedding model:** `IEntity.identityEmbedding` (narrow: displayName+aliases+identifiers, drives `EntityResolver` Tier 4) vs `IEntity.contentEmbedding` (rich: type-specific metadata + resolved-displayName references, drives `findSimilarOpenTasks` + `searchDocuments` + any `semanticSearchEntities({embeddingField:'content'})` caller). Never conflated — content text never bleeds into resolver identity tier.
- **`EntityContentComposer` / `FactContentComposer`** — pluggable per-type strategies. Library ships defaults for `task`, `event`, `person`, `organization`, `topic`, `project`, `document`, `cluster` + a fact composer that resolves subject/object ids to displayNames. Override via `MemorySystemConfig.entityContentComposers` / `factContentComposer`.
- **Re-embed triggers:** every entity mutation site (`createEntity`, `upsertEntity`, `appendAliasesAndIdentifiers`, `mergeEntities`, `updateEntityMetadata`, `transitionTaskState`, `addEntityContextIds`, document CRUD) composes the new text, diffs against `IEntity.contentEmbeddingText` (stored alongside the vector), and enqueues only when different. **Cascade-on-rename is intentionally NOT done** — when a referenced entity is renamed, dependent embeddings go stale until next mutation. Run `MemorySystem.backfillContentEmbeddings(scope)` after rename campaigns if needed.
- **80-char gate dropped for atomic facts.** Pre-composer: short atomic facts (details < 80 chars) had `isSemantic=false` and were never embedded. Composer-driven: every atomic fact composes to `"subject.displayName predicate (object.displayName | value)"` plus optional details — embed-eligible. Caller opt-out via `isSemantic: false`.
- **`findSimilarOpenTasks` now searches `contentEmbedding`** (not `identityEmbedding`). Pushes state/assignee/project filters into the vector pipeline via `EntitySemanticSearchFilter.{states,assigneeId,reporterId,projectId,dueAtRange}` — requires the new `metadata.{state,assigneeId,reporterId,projectId,dueAt}` filter paths in the Atlas index (now declared by default — see deployment checklist).
- **Backfill migration:** `MemorySystem.backfillContentEmbeddings(scope, {types?, batchSize?, onProgress?})` for entities; `MemorySystem.backfillFactEmbeddings(scope, {predicates?, kind?, ...})` for facts. Idempotent, resumable, bounded by scope.
- **Cross-scope visibility caveat:** composers run with the writer's `ScopeFilter`. If two writers with different visibility update the same entity, the stored `contentEmbedding` may flap between their respective composed texts. Rare in practice (referenced entities are usually co-visible with their referent), but a real semantic gap to know about for hosts that share write access across split-visibility scopes.
- **Composer-removal staleness:** removing a composer from `entityContentComposers` (or downgrading the library) leaves existing entities with stale `contentEmbedding` / `contentEmbeddingText` indefinitely — the mutation-site guard short-circuits when there's no composer, and `backfillContentEmbeddings` skips composer-less types. To fully drop the stale state, run a custom one-off that clears the fields on the affected type.
- **Fact embedding fields:** `IFact.embeddingText` (library-owned, mirrors `IEntity.contentEmbeddingText`) is the diff anchor — the queue writes both `embedding` and `embeddingText` after every fact embed. `IFact.summaryForEmbedding` stays caller-owned: document facts use it as the embed input (preferred over `details`), atomic facts honor it as an explicit override of the composed surface form. Hosts that pre-populate atomic-fact narrative text via `summaryForEmbedding` keep that exact text in the embedding.

**Resolution** (`src/memory/resolution/`):
- `EntityResolver` translates surface forms ("Microsoft", "Q3 Planning") to entity IDs. Tiers: identifier (1.0) → exact displayName (default 0.9) → exact alias (default **0.9 since 0.8.0**, was 0.85) → **semantic** via `identityEmbedding` (capped at 0.89, **opt-in** via `entityResolution.enableSemanticResolution`). All confidences configurable via `entityResolution.displayNameMatchConfidence` / `aliasMatchConfidence`. Conservative default auto-resolve threshold 0.9; configurable via `entityResolution.autoResolveThreshold`. **Tier 2/3 backed by `IMemoryStore.findEntitiesByNormalizedName` (O(1) indexed exact-match, 0.8.0+)** — replaces the legacy substring-then-filter path. Semantic tier calls `IMemoryStore.semanticSearchEntities`; cap ensures enabling the flag alone never auto-merges — caller must also lower `autoResolveThreshold` (e.g. to 0.75) to trust semantic matches.
- **`IMemoryStore.atomicCreateOrFindByNormalizedName` (0.8.0+)** — load-bearing atomic find-or-create keyed on `(type, normalizedDisplayName, scope)`. Used by `upsertEntityBySurface` to converge concurrent inserts of the same surface. InMemory uses JS event-loop semantics; Mongo uses optimistic find-then-insert + E11000 recovery, gated on the host-installed unique partial index from `ensureNormalizedNameUniqueIndex(entities)`. Mongo deployment migration: backfill via `MemorySystem.backfillNormalizedFields(scope)` → dedup pass → install unique index.
- `fuzzy.ts` — normalized Levenshtein (strips Inc/Corp/LLC, case-insensitive, punctuation-tolerant).

**Entity type conventions** (see `types.ts` header):
- `person`, `organization`, `topic`: minimal metadata.
- `task`: `metadata.{state, dueAt, priority, assigneeId, reporterId, projectId}`. State history via supersession facts.
- `event`: `metadata.{startTime, endTime, attendeeIds, location, kind}`.
- `project`, `cluster`: extensible.
- **`canonical` identifier kind** — library-blessed deterministic id for entities without a natural external key. Build via `canonicalIdentifier(type, parts)` from `src/memory/identifiers.ts`. Tier-1 identifier match means re-extractions converge on the same entity across signals.
- **Task-state vocabulary is configurable** via `MemorySystemConfig.taskStates: { active, terminal }`. Default legacy vocab: `active: ['pending','in_progress','blocked','deferred']`, `terminal: ['done','cancelled']`. Drives `getContext.relatedTasks` filtering. Arrays must be disjoint + non-empty.
- **`upsertEntityBySurface` accepts `metadata`** — on create, set verbatim; on resolve, conservative `fillMissing` merge (existing keys NEVER overwritten). Opt into shallow-overwrite via `UpsertBySurfaceOptions.metadataMerge: 'overwrite'`. LLM-driven re-extraction cannot flip `state` or `dueAt` by mistake. `ExtractionMention.metadata` flows through the extractor.
- **`transitionTaskState(taskId, newState, opts, scope)`** — canonical task-state mutator. Sets `metadata.state`, appends `metadata.stateHistory` (capped via `stateHistoryCap`, default 200), sets `completedAt` on terminal. No audit fact is written — `stateHistory` is the only trail. `validate: 'strict'|'warn'|'none'`. No-op when `from === to`. **Host-driven only** — there is no LLM auto-routing; extraction prompts must not emit `state_changed` (that predicate is gone, see consolidation note below).
- **`listOpenTasks` / `listRecentTopics`** — convenience fetchers for prompt injection. `listOpenTasks` filters by configured `taskStates.active`, supports `assigneeId`/`projectId`, sorts by `dueAt` asc / `updatedAt` desc. Both clamp limit to `[1, 200]`.
- **Prompt v7 (`DEFAULT_EXTRACTION_PROMPT_VERSION = 7`)** — Parsimony section (1 fact per knowledge, zero-fact valid), metadata-on-mentions replaces attribute facts for `task.state`/`dueAt` + `event.startTime`/etc, task transitions are host-driven (no `state_changed` fact). Type-aware `knownEntities` rendering.
- **Predicate consolidation (2026-05-25, BREAKING)** — deleted `approved`, `assigned_task`, `delegated_to`, `state_changed`, `has_status`, `current_status`. New `decision_made` predicate (`decision` category) subsumes `approved` and captures choices/agreements first-class. Task assignment lives on `task.metadata.assigneeId`; lineage on `committed_to(person, task)`. Status narratives belong on entity metadata. Standard set: **45 predicates across 10 categories** (authoritative count in `src/memory/predicates/standard.ts` header).
- **`SignalIngestorConfig.contextHints`** — opt-in auto-inject of open tasks + recent topics into the prompt. `{ openTasks: true | { limit }, recentTopics: true | { days?, limit? } }`. Off by default (token guardrail). Fetched via `memory.listOpenTasks` / `listRecentTopics`, merged after caller-supplied `knownEntities` with id-dedupe.
- **`CalendarSignalAdapter`** — reference adapter for calendar events. Emits event entity (canonical id + metadata), person seeds for organizer + attendees, `hosted`/`attended` `seedFacts` written deterministically by SignalIngestor. Declined attendees skip `attended` fact. Re-ingestion converges via canonical id.
- **`ParticipantSeed.metadata`** + **`SeedFact`** + **`ExtractedSignal.seedFacts`** — adapters can now emit type-specific metadata on seeds and deterministic relational facts. SignalIngestor writes seedFacts after seed resolution, one per role-pair.
- **Standard predicate registry: `attended` + `hosted`** in new `event` category. `resolveRelatedEvents` extended with a third tier that walks `attended`/`hosted` facts so events surface for attendees even without `attendeeIds` metadata duplication.
- **`IEntity.contextIds?: EntityId[]` (entity-level multi-entity binding, top-level field).** Mirrors `IFact.contextIds` but lives on the entity. Set on `task` / `event` / `topic` mentions to bind them to project/deal/meeting anchors. Surfaces via the new `EntityListFilter.contextId` filter, tier-1.5 path in `resolveRelatedTasks` / `resolveRelatedEvents`, and `findSimilarOpenTasks({contextId})`. **Union merge on resolve** — re-extraction never overwrites; `MemorySystem.addEntityContextIds(id, additions, scope)` is the canonical mutator (visibility-validates, dedupes, drops self-references, RMW with optimistic-concurrency retry). `mergeEntities` rewrites entity-level contextIds (loser → winner). `archiveEntity`/`deleteEntity` follow tombstone semantics — references untouched, resolve to `null`. Prompt v11 emits at top of mention object, NOT inside `metadata`. `ExtractionResolver` Pass 1.6 translates labels → ids two-pass so forward references work. Migration helper: `MemorySystem.hoistContextIdsFromFactsToEntities({predicate, entitySide, entityType?, ...})` — generic; reference recipe `{predicate: 'committed_to', entitySide: 'object', entityType: 'task'}` hoists v10-era linkage.

**Key invariants:**
- `IFact`: `contextIds?` for multi-entity binding (one fact about multiple entities); `importance?` (0..1, default 0.5) multiplies into ranking; `sourceSignalId?` opaque (library user owns the signal store).
- `IEntity`: `contextIds?` for entity-level multi-entity binding (one entity within multiple contexts). Distinct from `IFact.contextIds` and from the resolution-time `disambiguationEntityIds` (formerly `contextEntityIds` — deprecated alias kept).
- `getContext` returns profile + topFacts (subject OR object OR contextIds) + relatedTasks + relatedEvents by default. Pass `tiers: 'minimal'` to suppress.
- **Owner required:** every entity + fact MUST have `ownerId`. `OwnerRequiredError` thrown at creation when absent from both input and `scope.userId`. Admins can set `ownerId` to any user id (no equality check vs `scope.userId`).
- **Permissions (three-principal):** every record carries optional `permissions: { group?, world? }` with `AccessLevel = 'none'|'read'|'write'`. Owner always has full access. Defaults: `group='read'`, `world='read'` (public-read, owner-write). See `src/memory/AccessControl.ts` + `docs/MEMORY_PERMISSIONS.md`.
- **Read vs write enforcement:** reads are filtered at storage (adapter translates `canAccess(..., 'read')` into native query). Writes are checked at MemorySystem (`assertCanAccess(..., 'write')` throws `PermissionDeniedError`).
- Scope visibility: `(groupId, ownerId)` absent = global; both match for user-within-group. Layered under permissions — scope defines the principal; permissions define the level.
- Tests: 728 memory unit tests (40 files). Mongo real-DB integration gated on `mongodb` + `mongodb-memory-server` optional peer deps.

**Mongo deployment checklist (client app responsibility, not library):**
- Call `memorySystem.ensureAdapterIndexes()` from your migration — creates the performance + correctness indexes documented in `src/memory/adapters/mongo/indexes.ts`. Idempotent. No-op for `InMemoryAdapter`.
- **Additionally** create a unique index on `{identifiers.kind: 1, identifiers.value: 1}` for the entities collection (partial, filtered on documents that actually have that identifier). Required to prevent cross-process bootstrap races in `MemoryPluginNextGen` — two containers upserting the same user/agent entity simultaneously produce duplicates otherwise. Not created automatically: adding a unique index to a collection with existing duplicates fails; build + verify it explicitly in a migration.
- Atlas Vector Search indexes live outside `ensureAdapterIndexes()` because they need runtime parameters (`dimensions`, `similarity`). **Create them programmatically — not through the Atlas UI.**
  - **Programmatic (required):** `await (adapter as MongoMemoryAdapter).ensureVectorSearchIndexes({ dimensions: embedder.dimensions, entitiesContentIndexName: 'entities_content_vector' })`. Idempotent, fire-and-forget — Atlas builds the index asynchronously in 30–60s; runs during startup migrations so the index is ready before real traffic. Creates the facts-level (`embedding`) and entities-identity (`identityEmbedding`, used by `EntityResolver` Tier 4) indexes; pass `entitiesContentIndexName` (or set `entityContentVectorIndexName` on the adapter) to also create the **entities-content** index over `contentEmbedding` — required for `findSimilarOpenTasks`, document search, and any composer-driven retrieval. Defaults to the adapter's configured `vectorIndexName` / `entityVectorIndexName` / `entityContentVectorIndexName`; pass `null` to skip any of them. Requires mongodb node driver v6.6+ and Atlas Server v6.0.11+. **Drift caveat:** when an existing index's definition has drifted (e.g. the library added a filter path), the call drops + recreates it, and the drop blocks synchronously for up to `vectorIndexDrainTimeoutMs` (adapter option, default 120s; poll interval `vectorIndexDrainPollMs`, default 2s) while Atlas drains the old index — so a single call reliably reconciles drift instead of throwing and relying on next-boot retry. On drain timeout it falls through to create (never hangs).
  - **Filter paths declared on the entity indexes (both identity + content):** `groupId, ownerId, permissions.{group,world}, archived, type, contextIds, metadata.role, metadata.state, metadata.assigneeId, metadata.reporterId, metadata.projectId, metadata.dueAt`. The task-metadata paths drive `findSimilarOpenTasks`'s vector-pipeline-level filtering. Adding more filter fields requires updating `ENTITIES_FILTER_PATHS` in `MongoMemoryAdapter.ts` AND `entitySemanticFilterToMongo` translator — Atlas silently drops filter clauses on un-declared paths.
  - **⚠️ Manual UI creation (strongly discouraged — security footgun):** Atlas `$vectorSearch` silently ignores `filter:` clauses for any path not declared as `type:'filter'` in the index. A UI-created index that omits `groupId` / `ownerId` / `permissions.group` / `permissions.world` / `archived` gives you a cross-owner read leak with **no error at query time**. If you truly must create manually, declare every path listed in `FACTS_FILTER_PATHS` / `ENTITIES_FILTER_PATHS` in `MongoMemoryAdapter.ts` as `type:'filter'`, and verify by running `ensureVectorSearchIndexes()` afterward (it's idempotent and will flag drift). The programmatic path is the supported one — treat manual UI creation as unsupported.

---

**Version**: 0.10.1 | **Last Updated**: 2026-07-03 | **Architecture**: Connector-First + NextGen Context
