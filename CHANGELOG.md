# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Microsoft Graph Connector Tools** — 6 new ConnectorTools for Microsoft Graph API, auto-registered for connectors with `serviceType: 'microsoft'` or `baseURL` matching `graph.microsoft.com`. Tools: `create_draft_email` (new draft or reply draft), `send_email` (send or reply), `create_meeting` (calendar event with optional Teams link), `edit_meeting` (partial update), `get_meeting_transcript` (Teams transcript as plain text), `find_meeting_slots` (availability-based scheduling). Supports both delegated (`/me`) and application (`/users/{id}`) permission modes via `getUserPathPrefix()` helper. All tools follow the ConnectorTools pattern — use `ConnectorTools.for('my-microsoft-connector')` to get all tools.
- **RoutineDefinition Storage** — New `IRoutineDefinitionStorage` interface and `FileRoutineDefinitionStorage` implementation for persisting routine definitions to disk. Per-user isolation via optional `userId` (defaults to `'default'`). Stored at `~/.oneringai/users/<userId>/routines/<id>.json` with index file for fast filtering. Supports tag/search filtering and pagination. Integrated into `StorageRegistry` as `routineDefinitions` factory.
- **Routine Runner** — New `executeRoutine()` function (`src/core/routineRunner.ts`) that executes a `RoutineDefinition` end-to-end. Creates an Agent with working memory + in-context memory, runs tasks in dependency order, validates completion via LLM self-reflection, and clears conversation between tasks while preserving memory plugins as the data bridge. Supports configurable prompts (system, task, validation), retry with max attempts, `fail-fast` / `continue` failure modes, and `onTaskComplete` / `onTaskFailed` callbacks. Exported as `executeRoutine`, `ExecuteRoutineOptions`, and `ValidationContext`.
- **Routine Validation Context** — Task validation now receives a full `ValidationContext` (not just the agent's text output). The validator sees: the agent's response text, the in-context memory state, the working memory index, and a formatted log of all tool calls made during the task. This allows the LLM validator to verify what actually happened (e.g., "key findings stored in memory") rather than relying on the agent's claims.
- **UserInfo Plugin** — New `UserInfoPluginNextGen` for storing user-specific preferences and context. Data is user-scoped (not agent-scoped), allowing different agents to share the same user data. Storage path: `~/.oneringai/users/<userId>/user_info.json` (defaults to `~/.oneringai/users/default/user_info.json` when no userId). Enable via `features: { userInfo: true }`. Includes 4 tools: `user_info_set`, `user_info_get`, `user_info_remove`, `user_info_clear` (all allowlisted by default). **userId is optional** — tools work without it, defaulting to the `'default'` user. User info is automatically injected into the LLM context as markdown — no need to call `user_info_get` every turn.
- **IUserInfoStorage interface** — Storage abstraction for user information with file-based implementation (`FileUserInfoStorage`). UserId is optional (`string | undefined`), defaults to `'default'`. Supports multi-user scenarios via `StorageRegistry` pattern with optional `StorageContext`.
- **userInfo feature flag** — Added to `ContextFeatures` interface. Default: `false`.
- **userInfo storage factory** — Added to `StorageConfig` interface as context-aware factory: `userInfo: (context?: StorageContext) => IUserInfoStorage`.

### Changed

- **Custom Tools Storage - Optional Per-User Isolation** — Custom tools storage now supports optional per-user isolation for multi-tenant scenarios. `ICustomToolStorage` interface updated to accept optional `userId` parameter in all methods: `save(userId?, definition)`, `load(userId?, name)`, `delete(userId?, name)`, `exists(userId?, name)`, `list(userId?, options)`, `updateMetadata(userId?, name, metadata)`, `getPath(userId?)`. When `userId` is not provided, defaults to `'default'` user. File storage path changed from `~/.oneringai/custom-tools/` to `~/.oneringai/users/<userId>/custom-tools/` (defaults to `~/.oneringai/users/default/custom-tools/`). **Backwards compatible** - existing code works without changes. Opt-in to multi-user isolation by providing `userId: 'user-id'` when creating agents.

### Migration Guide: Custom Tools Storage

**No migration required for existing applications!** Custom tools storage is fully backwards compatible.

**For Custom Storage Implementers:**

If you have a custom `ICustomToolStorage` implementation, update methods to accept optional `userId`:

```typescript
// Before (0.3.1 and earlier)
class MyCustomToolStorage implements ICustomToolStorage {
  async save(definition: CustomToolDefinition): Promise<void> {
    await this.db.insert(definition);
  }
  async load(name: string): Promise<CustomToolDefinition | null> {
    return this.db.findOne({ name });
  }
}

// After (0.4.0+) - userId is optional
class MyCustomToolStorage implements ICustomToolStorage {
  async save(userId: string | undefined, definition: CustomToolDefinition): Promise<void> {
    const user = userId || 'default';
    await this.db.insert({ userId: user, ...definition });
  }
  async load(userId: string | undefined, name: string): Promise<CustomToolDefinition | null> {
    const user = userId || 'default';
    return this.db.findOne({ userId: user, name });
  }
}
```

**For Existing Custom Tools:**

Custom tools at `~/.oneringai/custom-tools/` will be moved automatically on first access to `~/.oneringai/users/default/custom-tools/`. No manual migration needed.

**For Multi-Tenant Applications (Optional):**

To enable per-user isolation, provide `userId` when creating agents:

```typescript
// Single-user app (no changes needed)
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  // No userId - defaults to 'default' user
});

// Multi-tenant app (opt-in)
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  userId: currentUser.id,  // Each user gets isolated custom tools
});

// OR set globally
StorageRegistry.setContext({ userId: currentUser.id });
```

## [0.3.1] - 2026-02-18

### Fixed

- **ConnectorTools invalid tool names** — Connector names with spaces or special characters (e.g., "Microsoft Graph API") now produce valid tool names (`Microsoft_Graph_API_api`) instead of invalid ones that break LLM provider APIs. Added shared `sanitizeToolName()` utility and deduplicated the existing MCP adapter sanitizer.

### Added

- **`sanitizeToolName()`** — Exported utility that sanitizes arbitrary strings to valid tool names matching `^[a-zA-Z0-9_-]+$`.

## [0.3.0] - 2026-02-18

### Fixed

- **Registry-driven model capabilities** — All 5 text providers (OpenAI, Anthropic, Google, Vertex AI, Generic) now resolve model capabilities from the centralized `MODEL_REGISTRY` instead of hardcoded string matching. Models like GPT-5.2 (400K context) now correctly report their limits instead of falling through to provider defaults (e.g., 4096 tokens). Error messages for context length exceeded now report the actual model's limit.

### Added

- **`resolveModelCapabilities()`** — New helper that maps any model identifier to `ModelCapabilities` using the centralized registry, with vendor-specific fallbacks for unregistered models.
- **`resolveMaxContextTokens()`** — New helper for accurate context limit resolution in error messages.
- **StorageRegistry** — Centralized storage backend registry (`StorageRegistry` class in `src/core/StorageRegistry.ts`). Provides a single `configure()` call to swap all storage backends (custom tools, media, sessions, persistent instructions, working memory, OAuth tokens, etc.) at init time. All subsystems resolve storage lazily at execution time via `StorageRegistry.resolve()`, with file-based defaults as fallback. No breaking changes — existing `setMediaStorage()`, `Connector.setDefaultStorage()`, and explicit constructor params continue to work.
- **StorageContext** — Multi-tenant support for `StorageRegistry`. All factory functions (`customTools`, `sessions`, `persistentInstructions`, `workingMemory`) now accept an optional opaque `StorageContext` (same pattern as `ConnectorAccessContext`). Set globally via `StorageRegistry.setContext({ userId, tenantId })` or auto-derived from `AgentContextNextGen.userId`. Enables storage partitioning by user, tenant, or any custom dimension.
- **`customTools` is now a context-aware factory** — `StorageConfig.customTools` changed from `ICustomToolStorage` to `(context?: StorageContext) => ICustomToolStorage`. Custom tool meta-tools (`custom_tool_save/list/load/delete`) receive `ToolContext` at execution time and forward `userId` to the factory for per-user storage isolation. All 6 meta-tools remain in the built-in tool registry.
- **`Agent.saveDefinition()` and `Agent.fromStorage()` now resolve from StorageRegistry** — The `storage` parameter is now optional. If omitted, resolves from `StorageRegistry.get('agentDefinitions')`.
- **`ConnectorConfigStore.create()` factory** — New static factory that resolves `IConnectorConfigStorage` from `StorageRegistry.get('connectorConfig')` when no explicit storage is provided.
- **xAI Grok models** — 9 Grok models added to the model registry: Grok 4.1 (fast reasoning/non-reasoning, 2M context), Grok 4 (fast reasoning/non-reasoning, flagship 0709), Grok Code Fast 1, Grok 3/3-mini, Grok 2 Vision.

### Changed

- **SDK Upgrades** — Updated all LLM vendor SDKs to latest versions:
  - `@anthropic-ai/sdk` 0.30.1 → 0.76.0 (eliminates 6 deprecated transitive dependencies: node-fetch, node-domexception, formdata-node, abort-controller, agentkeepalive, web-streams-polyfill)
  - `openai` 6.16.0 → 6.22.0
  - `@google/genai` 1.34.0 → 1.41.0
  - `@modelcontextprotocol/sdk` 1.25.3 → 1.26.0 (security fix)
- **Anthropic Provider** — Removed type assertion hacks for URL-based images (now officially supported in SDK)

## [0.2.3] - 2026-02-17

### Added

- **Custom Tool Generation System** *(Highlight)* — A complete meta-tool system that enables any agent to **create, test, iterate, and persist reusable custom tools at runtime**. 6 new tools in the `custom-tools` category:
  - `custom_tool_draft` — Validates name, schema, and code syntax. Dynamic description shows full sandbox API + all registered connectors
  - `custom_tool_test` — Executes code in the VM sandbox with test input. Dynamic description with sandbox API + connector list
  - `custom_tool_save` — Persists validated tool to `~/.oneringai/custom-tools/` with tags, category, and connector metadata
  - `custom_tool_list` — Searches saved tools by name, description, tags, or category with pagination
  - `custom_tool_load` — Retrieves full definition including code for inspection or modification
  - `custom_tool_delete` — Removes a tool from storage
  - `hydrateCustomTool()` — Converts a saved `CustomToolDefinition` into a live `ToolFunction` ready for `ToolManager.register()`
  - `createCustomToolMetaTools()` — Bundle factory that creates all 6 tools with shared storage
  - All 6 tools are auto-registered in the tool registry and visible in Hosea's tool catalog
- **Custom Tool Storage** — `ICustomToolStorage` domain interface with `FileCustomToolStorage` implementation. Supports CRUD, search (case-insensitive substring on name + description), tag/category filtering, and pagination. Atomic writes with `.tmp` + rename pattern and index-based listing. Pluggable — implement `ICustomToolStorage` for MongoDB, S3, or any backend.
- **ToolManager metadata fields** — `tags`, `category`, and `source` fields on `ToolOptions`, `ToolRegistration`, and `SerializedToolState`. Enables tracking tool provenance (`built-in`, `connector`, `custom`, `mcp`) and categorization. Persisted through `getState()`/`loadState()`.
- **Exported `executeInVM`** — The VM sandbox executor from `executeJavaScript.ts` is now a public export, enabling reuse by custom tool meta-tools and external code.
- **OAuth Scope Selector** — New `ScopeSelector` component replaces the plain-text scope input field with a checkbox-based selector. Shows template-defined scopes with human-readable descriptions, all pre-checked by default. Users can toggle scopes on/off and add custom scopes. Falls back to plain text input when no template scopes are available.
- **Scope descriptions for vendor templates** — Added `scopeDescriptions` field to `AuthTemplate` type. Enriched 15+ vendor templates with comprehensive scope lists and descriptions: Microsoft (21 Graph scopes), Google (9 scopes), GitHub (9 scopes), Slack (10 scopes), Discord (7 scopes), HubSpot (8 scopes), Atlassian/Jira/Confluence/Bitbucket (expanded), Salesforce (6 scopes), Shopify (10 scopes), Box (4 scopes), PagerDuty (2 scopes), Sentry (5 scopes), Dropbox (7 scopes), GitLab, Zendesk, Trello.
- **QuickBooks vendor template** — OAuth 2.0 authorization_code flow template for QuickBooks Online API (Intuit). Includes sandbox support and company/realm ID notes.
- **Ramp vendor template** — Dual OAuth flow template for Ramp financial API: client_credentials (app-level access) and authorization_code (user-level access).

### Fixed

- **OAuth public client fallback** — AuthCodePKCE flow now auto-retries token exchange and refresh without `client_secret` when the provider rejects it for public clients (e.g., Microsoft/Entra ID error AADSTS700025). Prevents failures when a `clientSecret` is configured but the app registration is set to "public client".
- **Documentation cleanup** — Fixed multiple outdated sections in README.md and USER_GUIDE.md:
  - Replaced non-existent `webSearch`/`webScrape` standalone imports with correct `ConnectorTools.for()` pattern in README
  - Added missing scrape providers (Jina Reader, Firecrawl, ScrapingBee) to README
  - Fixed Grok provider capabilities (now shows Image ✅ and Video ✅)
  - Removed non-existent "Tool Result Eviction" section from USER_GUIDE (feature doesn't exist in codebase)
  - Removed non-existent `IdempotencyCache` from Direct LLM comparison table
  - Fixed Feature-Aware APIs section referencing old AgentContext properties (`ctx.cache`, `ctx.permissions`, `requireMemory()`, etc.) to match actual AgentContextNextGen API
  - Fixed `setupInContextMemory()` references to use correct `ctx.getPlugin()` API
  - Fixed Web Tools description to correctly note web_search/web_scrape are connector-dependent

## [0.2.1] - 2026-02-11

### Added

- **Desktop Automation Tools** — 11 new `desktop_*` tools for OS-level desktop automation, enabling "computer use" agent loops (screenshot → vision model → tool calls → repeat). Tools: `desktop_screenshot`, `desktop_mouse_move`, `desktop_mouse_click`, `desktop_mouse_drag`, `desktop_mouse_scroll`, `desktop_get_cursor`, `desktop_keyboard_type`, `desktop_keyboard_key`, `desktop_get_screen_size`, `desktop_window_list`, `desktop_window_focus`. All coordinates use physical pixel space (screenshot space); the driver handles Retina/HiDPI scaling internally. Uses `@nut-tree-fork/nut-js` as an optional peer dependency. Convenience bundle: `tools.desktopTools`.

- **`__images` convention for multimodal tool results** — Tool results containing an `__images` array (e.g., from `desktop_screenshot`) are automatically converted to native multimodal content by provider converters: Anthropic (image blocks in tool_result), OpenAI (follow-up user message with input_image), Google (inlineData parts). Images are separated from text content at the context layer (`addToolResults()`), stored on a dedicated `__images` field on `ToolResultContent`, and counted as image tokens (~85-2000 depending on dimensions) rather than text tokens. This prevents large screenshots from blowing the context budget or being rejected as binary.

- **Hosea: DesktopToolProvider** — New tool provider for Hosea that exposes all desktop automation tools in the unified tool catalog under the "Desktop Automation" category.

- **Document Reader** — Universal file-to-LLM-content converter. New `DocumentReader` class reads arbitrary file formats (Office, PDF, spreadsheets, HTML, text, images) from any source (file path, URL, Buffer, Blob) and produces `DocumentPiece[]` (markdown text + base64 images) with metadata. Pluggable architecture with 6 format handlers (Office via `officeparser`, Excel via `exceljs`, PDF via `unpdf`, HTML, text, images) and a configurable transformer pipeline (header, table formatting, truncation). All heavy dependencies are lazy-loaded.

- **`read_file` auto-detects document formats** — The `read_file` tool now automatically converts binary document formats (PDF, DOCX, XLSX, PPTX, ODT, ODP, ODS, RTF, PNG, JPG, GIF, WEBP) to markdown text. No schema change — binary documents are returned as markdown in the existing `content` field. Agents can now `read_file({ file_path: "/path/to/report.pdf" })` and it just works.

- **`web_fetch` auto-detects document downloads** — The `web_fetch` tool now detects document Content-Types (application/pdf, Office MIME types) and URL extensions, automatically converting downloaded documents to markdown. Returns `contentType: 'document'` with optional `documentMetadata`.

- **`readDocumentAsContent()` bridge** — New utility function in `src/utils/documentContentBridge.ts` converts `DocumentResult` → `Content[]` for direct LLM input. Includes `documentToContent()` for conversion and `readDocumentAsContent()` as a one-call convenience. Supports image filtering, detail level, and adjacent text merging.

- **Image filtering** — Configurable image filtering removes small/junk images (logos, icons, backgrounds) from extracted documents. Filter by `minWidth`, `minHeight`, `minSizeBytes`, `maxImages`, and `excludePatterns`. Applied both at extraction time and at content conversion time.

- **New error classes** — `DocumentReadError` and `UnsupportedFormatError` in `src/domain/errors/AIErrors.ts`.

- **New constants** — `DOCUMENT_DEFAULTS` in `src/core/constants.ts` with all configurable defaults (max tokens, image filters, Excel limits, etc.).

### Changed

- **Hosea: Non-blocking startup** — The Hosea app window now appears immediately (~1-2 seconds) instead of waiting ~20 seconds for all connectors, tools, and agents to load. Heavy initialization (connector loading, tool discovery, EW profile sync, agent loading) now runs in the background after the window is visible. A "Starting HOSEA..." spinner shows while loading completes. IPC handlers that require full initialization automatically wait via `readyHandler` wrapper. Added `AgentService.createFast()` factory method and `isReady`/`whenReady()` readiness tracking API. Renderer listens for `service:ready` event before running app initialization logic.

- **`excludeExtensions` updated** — Removed `.pdf`, `.docx`, `.xlsx`, `.pptx` from the default filesystem tool exclusion list since DocumentReader now handles these formats.

- **Image token estimation** — `estimateItemTokens()` now uses `estimateImageTokens()` (tile-based model matching OpenAI pricing) instead of a hardcoded 200-token flat estimate. `ITokenEstimator` interface extended with optional `estimateImageTokens(width?, height?, detail?)` method. Both `simpleTokenEstimator` and `ApproximateTokenEstimator` implement it. `INPUT_IMAGE_URL` respects `detail` level. `TOOL_RESULT` with `__images` counted as image tokens (~1000 default) rather than text tokens on the base64 string.

### Fixed

- **`web_scrape` swallowing real API errors** — When both native fetch and external API (e.g., ZenRows) failed, the tool returned a generic "All scraping methods failed. Site may have bot protection." message, hiding the actual error details (e.g., `AUTH004: Usage exceeded`, `HTTP 402`, quota limits). Now propagates specific errors from each attempted method: `"All scraping methods failed. native: <error> | api(zenrows): ZenRows API error (402): ..."`.

- **Screenshots rejected as "binary content too large"** — Tool results with `__images` (e.g., desktop screenshots) were being counted as text tokens (~300K tokens for a 1MB base64 string), triggering the oversized input handler which replaced the entire result with a rejection message. The model never saw the image. Fixed by: (1) separating `__images` from the text content in `addToolResults()`, (2) counting images using `estimateImageTokens()` instead of text estimation, (3) preserving `__images` through emergency truncation. All three provider converters (Anthropic, OpenAI, Google) updated to read `__images` from the Content object first (with JSON-parsing fallback for backward compatibility).

- **Desktop mouse operations** — `mouse.setPosition()` in `@nut-tree-fork/nut-js` silently no-ops (reports success but doesn't move the cursor). All mouse operations now use `mouse.move(straightTo(...))` with `mouseSpeed=10000` for near-instant movement (22-49ms, ±1px precision). Mouse speed and animation delays disabled on driver initialization. `desktop_mouse_move` and `desktop_mouse_click` now return the **actual** cursor position after the operation for verification. `desktop_screenshot` description updated to warn about region coordinate offsets and now returns `regionOffsetX`/`regionOffsetY` in the result.

- **`desktop_window_focus` not working** — `focusWindow()` was matching windows by `win.processId` which doesn't exist on nut-tree Window objects (always `undefined`). Fixed to use the actual `windowHandle` property — the unique OS window identifier. `getWindowList()` now returns `windowHandle` as the `id` and caches Window objects for efficient `focusWindow()` lookup.

## [0.2.0] - 2026-02-09

**Multi-User Support** — This release introduces uniform multi-user support across the entire framework. Set `userId` once on an agent and it automatically flows to all tool executions, connector API calls (OAuth tokens), session metadata, and dynamic tool descriptions. Combined with the new `connectors` allowlist and scoped connector registry on `ToolContext`, this provides a complete foundation for building multi-user and multi-tenant AI agent systems.

### Added

- **`userId` auto-threading through Agent → Context → ToolContext** — Set `userId` once at agent creation (`Agent.create({ userId: 'user-123' })`) or at runtime (`agent.userId = 'user-456'`) and it automatically flows to all tool executions via `ToolContext.userId`. Also persisted in session metadata on save. No breaking changes — `userId` is optional everywhere.

- **`connectors` allowlist on Agent/Context** — Restrict an agent to a subset of registered connectors via `Agent.create({ connectors: ['github', 'slack'] })`. Only listed connectors appear in tool descriptions and sandbox execution. Combines with userId scoping: allowlist is applied on top of the access-policy-filtered view. Available as `agent.connectors` getter/setter at runtime. `ToolContext.connectorRegistry` now provides the resolved registry to all tools.

- **`@everworker/oneringai/shared` Subpath Export** — New lightweight subpath export containing only pure data constants and types (Vendor, MODEL_REGISTRY, SERVICE_DEFINITIONS) with zero Node.js dependencies. Safe for Cloudflare Workers, Deno, and browser environments.

### Changed

- **`execute_javascript` tool: userId-scoped connectors, improved description, configurable timeout** — The tool now auto-injects `userId` from ToolContext into all `authenticatedFetch` calls. Connector listing (both in description and sandbox) is scoped to the current user via the global access policy when set. `descriptionFactory` now receives `ToolContext` so descriptions always reflect the connectors visible to the current user. The tool description is significantly improved with better usage guidance, more examples, and shows service type/vendor for each connector. Sandbox globals expanded (URL, URLSearchParams, RegExp, Map, Set, TextEncoder, TextDecoder). Factory accepts `maxTimeout` and `defaultTimeout` options via `createExecuteJavaScriptTool({ maxTimeout: 60000 })`.

- **Consistent userId handling across all tools** — All tools now read `userId` from `ToolContext` at execution time (auto-populated by `Agent.create({ userId })`). ConnectorTools generic API tool, all 7 GitHub tools, and multimedia tools use `effectiveUserId = context?.userId ?? closureUserId` for backward compatibility. Removed unused `_userId` parameters from web search, web scrape, and speech-to-text tool factories.

- **`web_search` and `web_scrape` migrated to ConnectorTools pattern** — `webSearch` and `webScrape` are no longer built-in singleton tools. They are now ConnectorTools-registered factories (`createWebSearchTool`, `createWebScrapeTool`) that bind to a specific connector. Use `ConnectorTools.for('my-serper')` to get prefixed search tools, or call the factory directly. Search service types: `serper`, `brave-search`, `tavily`, `rapidapi-search`. Scrape service types: `zenrows`, `jina-reader`, `firecrawl`, `scrapingbee`. The legacy env-var fallback (`SERPER_API_KEY`, etc.) has been removed — all auth goes through connectors.

### Removed

- **`webFetchJS` tool and Puppeteer dependency** — Removed the `web_fetch_js` tool (`tools.webFetchJS`) and the `puppeteer` optional dependency. The `webScrape` tool's fallback chain now goes directly from native fetch to external API providers. Sites requiring JavaScript rendering should use the `web_scrape` tool with an external scraping provider (ZenRows, Jina Reader, etc.) instead.

- **`tools.webSearch` and `tools.webScrape` singleton exports** — Replaced by `createWebSearchTool(connector)` and `createWebScrapeTool(connector)` factory functions. The old env-var-based search providers (`src/tools/web/searchProviders/`) have been removed.

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
