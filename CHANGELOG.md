# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`@everworker/oneringai/shared` Subpath Export** — New lightweight subpath export containing only pure data constants and types (Vendor, MODEL_REGISTRY, SERVICE_DEFINITIONS) with zero Node.js dependencies. Safe for Cloudflare Workers, Deno, and browser environments.

### Removed

- **`webFetchJS` tool and Puppeteer dependency** — Removed the `web_fetch_js` tool (`tools.webFetchJS`) and the `puppeteer` optional dependency. The `webScrape` tool's fallback chain now goes directly from native fetch to external API providers. Sites requiring JavaScript rendering should use the `web_scrape` tool with an external scraping provider (ZenRows, Jina Reader, etc.) instead.

## [0.1.4] - 2026-02-08

### Added

- **`getVendorDefaultBaseURL(vendor)` — Runtime vendor base URL resolution** — New exported function that returns the default API base URL for any supported vendor. For OpenAI/Anthropic, reads from the actual installed SDKs at runtime (`new OpenAI({apiKey:'_'}).baseURL`), ensuring URLs auto-track SDK updates. For OpenAI-compatible vendors (Groq, Together, Grok, DeepSeek, Mistral, Perplexity, Ollama) and Google/Vertex, uses known stable endpoints. Built once at module load via `ReadonlyMap` for zero per-request overhead. Primarily used by LLM proxy servers that need vendor URLs without instantiating full provider objects.

- **Google provider proxy support** — `GoogleTextProvider` now passes `config.baseURL` to the Google GenAI SDK via `httpOptions.baseUrl`, enabling transparent HTTP proxy routing. Previously, the Google SDK always connected directly to `generativelanguage.googleapis.com` regardless of the connector's `baseURL` setting.

### Fixed

- **LLM proxy: empty `baseURL` for LLM connectors** — LLM connectors stored without `baseURL` (because provider SDKs handle defaults internally) caused proxy servers to construct relative URLs like `fetch('/v1/messages')` which silently failed. The proxy now falls back to `getVendorDefaultBaseURL(vendor)` when the connector has no `baseURL`.

- **LLM proxy: vendor-specific auth headers** — Anthropic (`x-api-key`) and Google (`x-goog-api-key`) vendor-specific auth headers now take priority over a connector's generic `headerName` (e.g. `Authorization`). Previously, connectors with `headerName: 'Authorization'` would send the API key in the wrong header for these vendors, causing 401 errors.

### Changed

- **`createProvider()` refactored** — OpenAI-compatible vendor cases (Groq, Together, Perplexity, Grok, DeepSeek, Mistral, Ollama) now use `getVendorDefaultBaseURL()` instead of hardcoded URL strings, eliminating duplication and ensuring a single source of truth for vendor endpoints.

### Notes: LLM Proxy Implementation Guide

> **For implementors building LLM proxy servers** (e.g. forwarding SDK requests through a central server):
>
> 1. **Vendor URL resolution**: Use `getVendorDefaultBaseURL(connector.vendor)` as fallback when `connector.baseURL` is empty — LLM connectors typically don't store URLs since provider SDKs handle defaults internally.
>
> 2. **Auth header priority**: For Anthropic, always use `x-api-key`. For Google, always use `x-goog-api-key`. These must take priority over any generic `headerName` in the connector config.
>
> 3. **Body parser interference**: If your server uses `bodyParser.json()` middleware (Express, Meteor, etc.), it will consume the request stream before your proxy handler runs. Check `req.body` first and re-serialize with `JSON.stringify()` instead of reading the raw stream. The request body is just the prompt payload (few KB) — the response stream is unaffected.
>
> 4. **SSE streaming through Meteor/Express**: Compression middleware (e.g. Meteor's built-in `compression`) buffers entire responses before compressing. For SSE responses:
>    - Use `res.setHeader('Content-Encoding', 'identity')` **before** `writeHead()` — `setHeader()` populates the internal header map that compression checks via `getHeader()`. Passing headers only through `writeHead()` bypasses this check.
>    - Call `res.flush()` after each `res.write(chunk)` — compression middleware adds this method to force its buffer to flush immediately.
>    - Set `res.socket.setNoDelay(true)` to disable Nagle's algorithm.
>    - Set `X-Accel-Buffering: no` and `Cache-Control: no-cache` response headers.

- **`apps/api/` — Generic Extensible API Proxy** — New Cloudflare Worker (Hono) serving as a centralized API proxy for OneRingAI clients (Hosea, Amos). Full implementation includes:
  - **Auth system** — Signup, signin, JWT access/refresh tokens, PBKDF2 password hashing via Web Crypto
  - **Centralized model registry** — D1-backed model registry seeded from library `MODEL_REGISTRY`, with admin CRUD and pricing management
  - **Service registry** — Layered resolution (custom_services → service_overrides → library SERVICE_DEFINITIONS)
  - **Encrypted credential storage** — AES-GCM 256-bit encryption for user API keys
  - **Generic proxy** — Forwards requests to any configured service with auth injection, supports both buffered and SSE streaming responses
  - **Usage metering** — DB-driven pricing with platform token rates, vendor cost multipliers, or flat per-request costs. Automatic token deduction with full audit trail
  - **Billing endpoints** — Balance, subscription, transaction, and usage history
  - **Admin system** — Full admin API for user management (suspend/activate), token grants/adjustments, subscription plan changes, model registry CRUD, pricing management (per-model and bulk), service override configuration, platform key management, analytics dashboard, and audit log
  - **Integration tests** — Auth, admin, metering, and credential tests using `@cloudflare/vitest-pool-workers`

- **IMediaStorage Interface & FileMediaStorage** — Pluggable media storage following Clean Architecture.
  - New domain interface `IMediaStorage` with full CRUD: `save()`, `read()`, `delete()`, `exists()`, optional `list()`, `getPath()`
  - New infrastructure implementation `FileMediaStorage` (replaces `FileMediaOutputHandler`)
  - `setMediaStorage()` / `getMediaStorage()` replace `setMediaOutputHandler()` / `getMediaOutputHandler()`
  - `speech_to_text` tool now reads audio through storage (`handler.read()`) instead of hardcoded `fs.readFile()`
  - Tool parameter renamed: `audioFilePath` → `audioSource` in `speech_to_text`
  - Storage is threaded through `registerMultimediaTools()` and all tool factories
  - Deprecated aliases provided for all renamed exports (one version cycle)
  - Factory function `createFileMediaStorage()` for easy instantiation

- **GitHub Connector Tools** — First external service connector tools. When a GitHub connector is registered, `ConnectorTools.for('github')` automatically returns 7 dedicated tools:
  - `search_files` — Search files by glob pattern in a repository (mirrors local `glob`)
  - `search_code` — Search code content across a repository (mirrors local `grep`)
  - `read_file` — Read file content with line ranges from a repository (mirrors local `read_file`)
  - `get_pr` — Get full pull request details (title, state, author, labels, reviewers, merge status)
  - `pr_files` — Get files changed in a PR with diffs
  - `pr_comments` — Get all comments and reviews on a PR (merges review comments, reviews, issue comments)
  - `create_pr` — Create a pull request
  - Shared utilities: `parseRepository()` accepts `"owner/repo"` or full GitHub URLs, `resolveRepository()` with connector `defaultRepository` fallback
  - All tools auto-register via side-effect import following the multimedia tools pattern

### Fixed

- **Hosea: Connector tools not appearing without restart** — After creating/updating/deleting a universal connector in Hosea, `ConnectorTools.clearCache()` and tool catalog invalidation are now called so tools appear immediately without restarting the app.
- **Hosea: Connector tools grouped per-connector** — `connectorName` and `serviceType` are now passed through the full data pipeline (`OneRingToolProvider` → `UnifiedToolEntry` → IPC response) so the Agent Editor's per-connector collapsible sections render correctly instead of dumping all connector tools into a flat "API Connectors" category.
- **Generic API tool POST body handling** — Improved tool parameter descriptions to explicitly instruct LLMs to use the `body` parameter for POST/PUT/PATCH data instead of embedding request data as query string parameters in the endpoint URL. Previously, LLMs would often call e.g. `POST /chat.postMessage?channel=C123&text=hello` instead of using `body: { channel: "C123", text: "hello" }`, causing APIs like Slack to reject the request with "missing required field". The `describeCall` output now also includes truncated body content for easier debugging.

### Breaking Changes

- **Persistent Instructions Plugin - Granular KVP API** — `PersistentInstructionsPluginNextGen`
  now stores instructions as individually keyed entries instead of a single text blob.
  - **`IPersistentInstructionsStorage` interface changed**: `load()` returns `InstructionEntry[] | null`
    (was `string | null`), `save()` accepts `InstructionEntry[]` (was `string`). Custom storage
    backends (MongoDB, Redis, etc.) must be updated.
  - **Tool API changed**: `instructions_append` and `instructions_get` removed.
    Replaced with `instructions_remove` and `instructions_list`. `instructions_set` now takes
    `(key, content)` instead of `(content)`.
  - **Public API changed**: `set(content)` → `set(key, content)`, `append(section)` removed,
    `get()` → `get(key?)`, new `remove(key)` and `list()` methods.
  - **Config changed**: `maxLength` renamed to `maxTotalLength`, new `maxEntries` option.
  - **File format changed**: `custom_instructions.md` → `custom_instructions.json`.
    Legacy `.md` files are auto-migrated on first load.
  - **Session state format changed**: `restoreState()` handles both legacy and new formats.

## [0.1.3] - 2026-02-07

### Fixed

- Fix `getStateAsync is not a function` error in hosea app — updated callers to use the new synchronous `getState()` method on `WorkingMemoryPluginNextGen`

## [0.1.2] - 2026-02-06

### Added

- **Scoped Connector Registry** - Pluggable access control for multi-tenant connector isolation
  - `IConnectorRegistry` interface — read-only registry contract (`get`, `has`, `list`, `listAll`, `size`, `getDescriptionsForTools`, `getInfo`)
  - `IConnectorAccessPolicy` interface — sync predicate with opaque `ConnectorAccessContext`
  - `ScopedConnectorRegistry` class — filtered view over the Connector registry, gated by a user-provided policy
  - `Connector.setAccessPolicy()` / `Connector.getAccessPolicy()` — global policy management
  - `Connector.scoped(context)` — factory for scoped registry views
  - `Connector.asRegistry()` — unfiltered `IConnectorRegistry` adapter over static methods
  - `BaseAgentConfig.registry` — optional scoped registry for `Agent.create()`
  - `ConnectorTools.for()`, `discoverAll()`, `findConnector()`, `findConnectors()` now accept optional `{ registry }` option
  - Security: denied connectors produce the same "not found" error as missing ones (no information leakage)
  - 29 new unit tests

### Fixed

- **WorkingMemoryPluginNextGen state serialization** - `getState()` now returns actual entries instead of an empty array. Added synchronous `_syncEntries` cache to bridge the async `IMemoryStorage` with the synchronous `IContextPluginNextGen.getState()` contract. Session persistence now correctly saves and restores all Working Memory entries.
- **InContextMemory token limit enforcement** - `maxTotalTokens` config is now enforced. Added `enforceTokenLimit()` that evicts low-priority entries when total token usage exceeds the configured limit.
- **Token estimation consistency** - `simpleTokenEstimator` now uses `TOKEN_ESTIMATION.MIXED_CHARS_PER_TOKEN` from centralized constants instead of a hardcoded value.
- **System prompt precedence on session restore** - Explicit `instructions` passed to `Agent.create()` now take precedence over system prompts saved in restored sessions.

### Removed

- **Legacy compaction strategies** - Removed `src/core/context/strategies/` (ProactiveStrategy, AggressiveStrategy, LazyStrategy, AdaptiveStrategy, RollingWindowStrategy, BalancedStrategy). These legacy `IContextStrategy` implementations were dead code never imported by the NextGen context system.
- **SmartCompactor** - Removed `src/core/context/SmartCompactor.ts`. Not used by `AgentContextNextGen`.
- **ContextGuardian** - Removed `src/core/context/ContextGuardian.ts`. Not used by any production code.
- **Legacy strategy constants** - Removed `PROACTIVE_STRATEGY_DEFAULTS`, `AGGRESSIVE_STRATEGY_DEFAULTS`, `LAZY_STRATEGY_DEFAULTS`, `ADAPTIVE_STRATEGY_DEFAULTS`, `ROLLING_WINDOW_DEFAULTS`, `GUARDIAN_DEFAULTS` from `constants.ts`.
- **`WorkingMemoryPluginNextGen.getStateAsync()`** - Removed redundant async method; `getState()` now returns correct data synchronously.

### Changed

- **Documentation** - README.md, USER_GUIDE.md, and CLAUDE.md updated to reflect the actual NextGen compaction system. Replaced references to non-existent `proactive`/`balanced`/`lazy` strategy names with the actual `algorithmic` strategy (default, 75% threshold). Updated custom strategy guidance to use `ICompactionStrategy` + `StrategyRegistry`.

## [0.1.1] - 2026-02-06

### Fixed
- **Multimedia tool naming collisions** - Multiple vendors registering tools with the same base name (e.g., `generate_image`) caused only the last vendor's tools to survive deduplication in UIs. `ConnectorTools.for()` now prefixes service-specific tool names with the connector name (e.g., `google_generate_image`, `main-openai_text_to_speech`), matching the existing generic API tool pattern (`${connector.name}_api`).
- **ToolRegistry display names** - `ToolRegistry` now resolves vendor display names via `getVendorInfo()` and strips connector prefixes for clean display names (e.g., "OpenAI Generate Image", "Google Text To Speech").

### Changed
- **ConnectorTools.for()** - Service-specific tools returned by registered factories are now prefixed with `${connector.name}_`. This is a **breaking change** if you reference multimedia tool names by their old unprefixed names (e.g., `generate_image` → `google_generate_image`).
- **ToolRegistry.deriveDisplayName()** - Accepts `connectorName` parameter, strips connector prefix, prepends vendor display name.

## [0.1.0] - 2026-02-05

### Added
- Initial release of `@everworker/oneringai`
- **Connector-First Architecture** - Single auth system with named connectors
- **Multi-Provider Support** - OpenAI, Anthropic, Google, Groq, DeepSeek, Mistral, Grok, Together, Ollama
- **AgentContextNextGen** - Plugin-based context management
  - WorkingMemoryPluginNextGen - Tiered memory with automatic eviction
  - InContextMemoryPluginNextGen - Key-value storage directly in context
  - PersistentInstructionsPluginNextGen - Disk-persisted agent instructions
- **ToolManager** - Dynamic tool management with enable/disable, namespaces, circuit breakers
- **Tool Execution Plugins** - Pluggable pipeline for logging, analytics, custom behavior
- **Session Persistence** - Save/load full context state with `ctx.save()` and `ctx.load()`
- **Audio Capabilities** - Text-to-Speech and Speech-to-Text (OpenAI, Groq)
- **Image Generation** - DALL-E 3, gpt-image-1, Google Imagen 4
- **Video Generation** - OpenAI Sora 2, Google Veo 3
- **Web Search** - Serper, Brave, Tavily, RapidAPI providers
- **Web Scraping** - ZenRows with JS rendering and anti-bot bypass
- **Developer Tools** - read_file, write_file, edit_file, glob, grep, list_directory, bash
- **MCP Integration** - Model Context Protocol client for stdio and HTTP/HTTPS servers
- **OAuth 2.0** - Full OAuth support with encrypted token storage
- **Vendor Templates** - Pre-configured auth for 43+ services
- **Model Registry** - 23+ models with pricing, context windows, feature flags
- **Direct LLM Access** - `runDirect()` and `streamDirect()` bypass context management
- **Algorithmic Compaction** - Strategy-based context compaction via `StrategyRegistry`

### Providers
- OpenAI (GPT-5.2, GPT-5, GPT-4.1, o3-mini)
- Anthropic (Claude 4.5 Opus/Sonnet/Haiku, Claude 4.x)
- Google (Gemini 3, Gemini 2.5)
- Groq, DeepSeek, Mistral, Grok, Together AI, Ollama

[Unreleased]: https://github.com/Integrail/oneringai/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/Integrail/oneringai/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/Integrail/oneringai/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Integrail/oneringai/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Integrail/oneringai/releases/tag/v0.1.0
