# Claude Development Guide

This document provides context for AI assistants (like Claude) to continue development of the `@oneringai/agents` library.

## Project Overview

**Name**: `@oneringai/agents`
**Purpose**: Unified AI agent library with multi-vendor support for text generation, image generation, and agentic workflows
**Language**: TypeScript (strict mode)
**Runtime**: Node.js 18+
**Package Type**: ESM (ES Modules)

## Architecture Philosophy

### Clean Architecture (Domain-Driven Design)

The library follows clean architecture with three distinct layers:

```
┌─────────────────────────────────────────┐
│     Application Layer (Use Cases)       │  ← High-level business logic
│   capabilities/agents, text, images     │
├─────────────────────────────────────────┤
│       Domain Layer (Business Rules)     │  ← Core entities, interfaces
│   entities, interfaces, types, errors   │
├─────────────────────────────────────────┤
│   Infrastructure Layer (External APIs)  │  ← Provider implementations
│     providers/openai, anthropic, etc    │
└─────────────────────────────────────────┘
```

**Key Principle**: Dependencies point inward. Infrastructure depends on Domain, Application depends on Domain, but Domain depends on nothing.

## Key Design Decisions

### 1. Unified Auth with Capability Modules

**Problem Solved**: How to configure credentials once but use across multiple capabilities (text, images, video)?

**Solution**: Provider Registry pattern with lazy-loaded capability managers

```typescript
// Single configuration point
const client = new OneRingAI({
  providers: {
    openai: { apiKey: 'sk-...' },
    anthropic: { apiKey: 'sk-ant-...' }
  }
});

// Different capabilities use the same credentials
await client.agents.create({ provider: 'openai', ... });  // async (returns Promise<Agent>)
await client.images.generate({ provider: 'openai', ... });
```

**How it works**:
- `ProviderRegistry` stores all provider configs
- Each capability manager (AgentManager, TextManager, ImageManager) receives the registry
- Providers are lazy-loaded when first accessed
- Providers are cached after instantiation

**Location**: `src/client/ProviderRegistry.ts`

### 2. OpenAI Responses API as Internal Standard (Text Only)

**Why**: OpenAI's new Responses API is the most modern and comprehensive format

**Applies to**: Text generation only (not images/video)

**Format**:
```typescript
{
  input: string | InputItem[],    // NOT "messages"
  instructions: string,           // NOT role="system"
  output: OutputItem[]            // Structured output
}
```

**Key differences from Chat Completions**:
- Uses `input` instead of `messages`
- Uses `instructions` instead of system message
- Uses `developer` role instead of `system`
- Content is always an array

**Converters needed**: For non-OpenAI providers (Anthropic, Google), we convert:
- Our standard → Vendor format (in `generate()`)
- Vendor format → Our standard (in response)

**Location**: `src/infrastructure/providers/openai/OpenAITextProvider.ts` (no conversion needed)

### 3. Tool Execution Architecture

**Blocking vs Non-blocking**:
```typescript
const tool: ToolFunction = {
  definition: {
    type: 'function',
    function: { name: 'get_weather', ... },
    blocking: true,    // Wait for result (default)
    timeout: 30000     // 30 seconds
  },
  execute: async (args) => { ... }
};
```

**Current Implementation**: Only blocking tools (MVP)

**Blocking tools**: Agent waits for tool to complete before next LLM call
**Non-blocking tools** (TODO): Agent continues, tool result triggers new LLM call when ready

**Location**: `src/capabilities/agents/AgenticLoop.ts`

### 4. Type Safety Patterns

**Enums exported as values**:
```typescript
// src/index.ts
export { MessageRole } from './domain/entities/Message.js';  // NOT export type
export { ContentType } from './domain/entities/Content.js';
```

**Why**: Examples and user code use these as runtime values (`MessageRole.USER`)

**Type narrowing**:
```typescript
// Filter OutputItem to InputItem
response.output.filter((item): item is InputItem =>
  item.type === 'message' || item.type === 'compaction'
)
```

**Why**: `OutputItem` includes `ReasoningItem` which is not valid in `InputItem`

### 5. OAuth Integration with Dynamic Tool Descriptions

**Problem Solved**: How to show currently registered OAuth providers in tool descriptions when providers are registered after module load?

**Solution**: Factory pattern for tools that need dynamic descriptions

**Static export (frozen at module load)**:
```typescript
// src/tools/code/executeJavaScript.ts
export const executeJavaScript: ToolFunction = createExecuteJavaScriptTool(connectorRegistry);
// Description generated ONCE when module loads - doesn't reflect later provider registrations
```

**Factory function (generates fresh tool with current state)**:
```typescript
// After registering OAuth providers
connectorRegistry.register('microsoft', { ... });
connectorRegistry.register('google', { ... });

// Create tool with CURRENT providers (description includes microsoft and google)
const jsTool = createExecuteJavaScriptTool(connectorRegistry);

const agent = await client.agents.create({
  provider: 'openai',
  model: 'gpt-4',
  tools: [jsTool]  // Tool description will show all registered providers to the AI
});
```

**Why this matters**:
- Tool descriptions are shown to the LLM to help it decide when to use the tool
- If OAuth providers aren't listed, the LLM won't know they're available
- User reported: "what OAuth providers are available?" → AI responded "None registered" even though Microsoft was configured
- Root cause: Tool was created at import time, before provider registration

**Location**: `src/tools/code/executeJavaScript.ts`

**Exports**:
- `executeJavaScript` - Static tool (for backward compatibility, description frozen at load)
- `createExecuteJavaScriptTool(registry)` - Factory function (generates tool with current providers)

### 6. Multi-User OAuth Architecture 🆕

**Problem Solved**: How to support multiple users with the same OAuth provider, each with their own tokens?

**Solution**: User-scoped storage keys with optional `userId` parameter

**Architecture**:
```
┌─────────────────────────────────────────────────────────────┐
│                   STORAGE LAYER (Infrastructure)             │
│  ITokenStorage interface - Storage backends don't know      │
│  about users. They just store by key.                       │
│                                                              │
│  MemoryStorage  │  FileStorage  │  MongoStorage  │  Redis   │
│  All implement ITokenStorage - no changes needed!           │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Uses scoped keys
                              │
┌─────────────────────────────────────────────────────────────┐
│                    DOMAIN LAYER                              │
│  TokenStore - Generates user-scoped keys:                   │
│    getScopedKey(userId?) → "provider:clientId:userId"       │
│                                                              │
│  Single-user: "auth_code:github"                            │
│  Multi-user:  "auth_code:github:alice_123"                  │
│               "auth_code:github:bob_456"                    │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                           │
│  OAuthManager - Exposes userId parameter in all methods     │
│    getToken(userId?)                                        │
│    startAuthFlow(userId?)                                   │
│    handleCallback(url, userId?)                             │
│                                                              │
│  authenticatedFetch(url, options, provider, userId?)        │
│  createAuthenticatedFetch(provider, userId?)                │
└─────────────────────────────────────────────────────────────┘
```

**Key Design Decisions**:

1. **Clean Architecture Preserved**: Storage backends don't need modification
   - Storage just stores/retrieves by key
   - Domain layer (TokenStore) handles key scoping
   - Application layer (OAuthManager) exposes userId API

2. **State Parameter Embedding**: userId embedded in OAuth state
   - Format: `{random_state}::{userId}`
   - Automatic extraction in `handleCallback()`
   - CSRF protection maintained
   - No database lookup needed in callback

3. **PKCE Per-User**: Each user gets their own code verifier
   - Stored in `Map<string, string>` keyed by userId
   - Cleared after token exchange (one-time use)
   - Multiple concurrent auth flows supported

4. **Backward Compatibility**: userId is optional
   - `oauth.getToken()` → single-user mode (key: `provider:clientId`)
   - `oauth.getToken('user123')` → multi-user mode (key: `provider:clientId:user123`)

**Location**:
- `src/connectors/oauth/domain/TokenStore.ts` - User-scoped key generation
- `src/connectors/oauth/flows/AuthCodePKCE.ts` - Per-user PKCE state management
- `src/connectors/oauth/OAuthManager.ts` - Multi-user API exposure
- `src/connectors/authenticatedFetch.ts` - userId parameter support

**Examples**:
- `examples/oauth-multi-user.ts` - Multi-user patterns
- `examples/oauth-multi-user-fetch.ts` - authenticatedFetch with multiple users

**Concurrency Safety** (Phase 1 Fix):

5. **Race Condition Prevention**: Per-user refresh locks prevent concurrent token refresh
   - Problem: Multiple concurrent `getToken()` calls could all trigger `refreshToken()`
   - Solution: `refreshLocks: Map<string, Promise<string>>` tracks in-progress refreshes
   - If refresh is in-progress, subsequent calls wait for the existing Promise
   - Lock cleaned up in `finally` block (even on error)
   - Result: Only ONE token refresh request per user, even with 10+ concurrent calls

6. **Token Response Validation**: All OAuth token responses validated before storage
   - Validates `access_token` field exists
   - Validates `access_token` is a string (not number, object, etc.)
   - Validates `expires_in` is positive (if provided)
   - Throws descriptive errors before storing corrupted tokens
   - Prevents silent failures from malformed OAuth provider responses

### 7. Extensibility - Custom Infrastructure Providers 🆕

**Problem Solved**: How to allow users to implement custom LLM providers, OAuth storage backends, and tool executors?

**Solution**: Export all domain interfaces and infrastructure base classes

**Clean Architecture Layers**:
```
Application → Domain (interfaces) ← Infrastructure (implementations)
```

**What Users Can Extend**:

1. **Custom LLM Providers**:
   ```typescript
   import { BaseTextProvider, ProviderErrorMapper } from '@oneringai/agents';

   class OllamaProvider extends BaseTextProvider {
     readonly name = 'ollama';

     async generate(options) {
       // Call local Ollama API
       const response = await fetch('http://localhost:11434/api/generate', {...});
       return this.convertToLLMResponse(await response.json());
     }
   }
   ```

2. **Custom OAuth Storage Backends**:
   ```typescript
   import { IOAuthTokenStorage, StoredToken } from '@oneringai/agents';

   class MongoOAuthStorage implements IOAuthTokenStorage {
     async storeToken(key: string, token: StoredToken) {
       // key is "provider:clientId:userId" (multi-user automatic!)
       await tokens.updateOne({ _id: key }, { $set: encrypt(token) }, { upsert: true });
     }
     // ... implement other methods
   }

   // Use with OAuth
   const oauth = new OAuthManager({
     storage: new MongoOAuthStorage(mongoClient)
   });
   ```

3. **Custom Tool Executors**:
   ```typescript
   import { IToolExecutor } from '@oneringai/agents';

   class RateLimitedToolExecutor implements IToolExecutor {
     async executeTool(toolCall, context) {
       // Add rate limiting, caching, audit logging, etc.
     }
   }
   ```

**Exported for Extension**:
- **Interfaces**: `IProvider`, `ITextProvider`, `IImageProvider`, `IToolExecutor`, `IOAuthTokenStorage`, `IDisposable`
- **Base Classes**: `BaseProvider`, `BaseTextProvider`, `ProviderErrorMapper`
- **Types**: All domain types needed for implementation

**Location**:
- `src/domain/interfaces/*` - All domain contracts
- `src/infrastructure/providers/base/*` - Reusable base classes
- `src/plugins/oauth/domain/ITokenStorage.ts` - OAuth storage contract

**Examples**:
- `examples/custom-infrastructure.ts` - Complete custom implementations
- Real-world examples: Cohere, Ollama, MongoDB, Redis, PostgreSQL

**Documentation**: See `EXTENSIBILITY.md` for complete guide

### 8. Built-in AI Agents 🆕

**Problem Solved**: How to provide pre-built agents for common tasks without hardcoding templates?

**Solution**: AI-powered agents that generate configurations on the fly

**Philosophy**:
- Keep agents simple
- Leverage AI's knowledge (no templates!)
- Focus on conversational UX
- Generate structured output

**ProviderConfigAgent**:
```typescript
// src/agents/ProviderConfigAgent.ts
export class ProviderConfigAgent {
  constructor(private client: OneRingAI) {}

  async run(initialInput?: string): Promise<ProviderConfigResult> {
    // Creates an agent with specialized instructions
    // AI asks questions conversationally
    // Generates JSON config when it has enough info
  }
}
```

**Key Design Decisions**:

1. **No Templates**: AI generates configs from its knowledge
   - Knows about GitHub, Google, Microsoft, Salesforce, etc.
   - Adapts to user's specific needs
   - Can handle new providers without code changes

2. **Structured Output**: Uses delimiter markers
   ```
   ===CONFIG_START===
   { "providerName": "github", ... }
   ===CONFIG_END===
   ```
   - Easy to extract from AI response
   - Validates JSON before returning
   - Fails gracefully if incomplete

3. **Conversational UX**: One question at a time
   - "Which system to connect to?"
   - "User auth or service-to-service?"
   - "What's your redirect URI?"
   - Natural, friendly tone

4. **Dependency Injection**: Takes `OneRingAI` client
   - User chooses which AI provider to use
   - Agent works with any LLM (OpenAI, Anthropic, etc.)
   - No hardcoded provider dependency

**Location**: `src/agents/ProviderConfigAgent.ts`

**Examples**:
- `examples/provider-config-generator.ts` - Interactive CLI
- `examples/provider-config-programmatic.ts` - Programmatic usage

**Future Agents** (keep simple, leverage AI):
- `SchemaGeneratorAgent` - Generate TypeScript types from API responses
- `MigrationAgent` - Help migrate OAuth flows
- `DocumentationAgent` - Generate API docs from code

**Documentation**: See `src/agents/README.md` for complete guide

## Directory Structure

```
src/
├── index.ts                          # Main entry point, all exports
├── client/                           # Client infrastructure
│   ├── OneRingAI.ts                  # Main client class
│   └── ProviderRegistry.ts           # Credential management, lazy loading
├── domain/                           # Core business logic
│   ├── entities/                     # Pure data structures
│   │   ├── Message.ts                # Message, MessageRole, InputItem, OutputItem
│   │   ├── Content.ts                # ContentType, Content unions
│   │   ├── Tool.ts                   # ToolFunction, ToolCall, ToolResult
│   │   ├── Connector.ts              # ConnectorConfig, ConnectorAuth types
│   │   └── Response.ts               # LLMResponse
│   ├── interfaces/                   # Contracts
│   │   ├── IProvider.ts              # Base provider interface
│   │   ├── ITextProvider.ts          # Text generation provider
│   │   ├── IImageProvider.ts         # Image generation provider
│   │   ├── IConnector.ts             # External system connector interface
│   │   └── IToolExecutor.ts          # Tool execution interface
│   ├── types/                        # Shared types
│   │   ├── ProviderConfig.ts         # Provider configuration types
│   │   └── CommonTypes.ts            # Logger, metadata, etc.
│   └── errors/                       # Domain errors
│       └── AIErrors.ts               # Custom error classes
├── connectors/                       # External system authentication (MOVED from plugins/oauth)
│   ├── index.ts                      # Central export point
│   ├── ConnectorRegistry.ts          # Manage all registered connectors
│   ├── authenticatedFetch.ts         # Drop-in fetch() replacement with OAuth
│   ├── toolGenerator.ts              # Auto-generate tools for connectors
│   └── oauth/                        # OAuth 2.0 implementation
│       ├── index.ts                  # OAuth exports
│       ├── OAuthConnector.ts         # IConnector implementation
│       ├── OAuthManager.ts           # OAuth flow orchestration
│       ├── flows/                    # Flow implementations
│       │   ├── AuthCodePKCE.ts       # Authorization Code + PKCE
│       │   ├── ClientCredentials.ts  # Client Credentials
│       │   ├── JWTBearer.ts          # JWT Bearer
│       │   └── StaticToken.ts        # Static API keys
│       ├── domain/                   # OAuth-specific domain
│       │   ├── TokenStore.ts         # Token management with user scoping
│       │   └── ITokenStorage.ts      # Storage interface
│       ├── infrastructure/           # Storage implementations
│       │   └── storage/
│       │       ├── MemoryStorage.ts  # Encrypted in-memory storage
│       │       └── FileStorage.ts    # Encrypted file storage
│       └── utils/                    # OAuth utilities
│           ├── pkce.ts               # PKCE generation
│           └── encryption.ts         # AES-256-GCM encryption
├── agents/                           # Built-in AI agents
│   ├── index.ts                      # Public exports
│   ├── ProviderConfigAgent.ts        # OAuth config generator
│   └── README.md                     # Agent documentation
├── capabilities/                     # Feature modules
│   ├── agents/                       # Agentic workflows with tools
│   │   ├── index.ts                  # Public exports
│   │   ├── AgentManager.ts           # Factory for agents
│   │   ├── Agent.ts                  # Agent class
│   │   ├── AgenticLoop.ts            # Tool calling loop
│   │   ├── ToolRegistry.ts           # Tool management
│   │   └── ToolExecutor.ts           # Tool execution
│   ├── text/                         # Simple text generation
│   │   ├── index.ts
│   │   └── TextManager.ts
│   └── images/                       # Image generation
│       ├── index.ts
│       └── ImageManager.ts
└── infrastructure/                   # External dependencies
    └── providers/                    # Vendor implementations
        ├── base/                     # Shared base classes
        │   ├── BaseProvider.ts
        │   └── BaseTextProvider.ts
        └── openai/                   # OpenAI implementation
            └── OpenAITextProvider.ts
```

## Implementation Status

### ✅ Implemented

**Core Infrastructure**:
- OneRingAI client with lazy-loaded capabilities
- ProviderRegistry with caching and lazy loading
- Complete domain entities and interfaces
- Comprehensive error handling
- Clean architecture (domain/application/infrastructure)

**Providers (ALL IMPLEMENTED)**:
- ✅ **OpenAI** - Native Responses API format, no conversion needed
- ✅ **Anthropic (Claude)** - Full converter, Messages API → Responses API
- ✅ **Google (Gemini)** - Full converter, Gemini API → Responses API (new @google/genai SDK)
- ✅ **Google Vertex AI** - Enterprise Gemini with SLA, IAM, tuning (same SDK as Gemini)
- ✅ **Generic OpenAI-Compatible** - Enables Grok, Groq, Together AI, Perplexity, etc.
- ✅ **7+ providers** total with single unified API

**Text Generation**:
- Simple text generation (all providers)
- Structured JSON output (all providers)
- System instructions (all providers)
- Multi-turn conversations (all providers)
- Temperature and token control

**Tool Calling**:
- Tool registry and execution
- Agentic loop with blocking tools
- Tool call state tracking (pending, executing, completed, failed)
- Works with all providers (OpenAI, Anthropic, Google, Groq, etc.)
- Multi-turn conversations with tools

**Vision/Image Input**:
- Image analysis with all vision-capable models
- Works with: GPT-4o, Claude 3.5, Gemini 1.5, Grok-2-Vision, Llama 3.2 Vision
- MessageBuilder utility for complex inputs
- Helper functions (createMessageWithImages, etc.)
- **Clipboard image paste** (Ctrl+V/Cmd+V) - just like Claude Code!
- Cross-platform clipboard support (Mac, Windows, Linux)
- Automatic base64 conversion for screenshots
- Image URL to base64 conversion (for Google)
- Multi-image support
- Image detail control (low/high/auto)

**Interactive Chat**:
- Full-featured CLI chat with readline
- Ctrl+V clipboard image paste support
- Conversation history and context preservation
- Multiple image attachment methods (Ctrl+V, /paste, [img:URL])
- Token usage tracking
- Command system (/exit, /clear, /history, /images, /help)
- Thinking animation
- Cross-platform (Mac, Windows, Linux)

**Utilities**:
- MessageBuilder for complex message construction
- Clipboard image reading (cross-platform)
- Image utilities (URL to base64, format detection, size calculation)
- Helper functions for common tasks

**Examples**:
- basic-agent.ts - Agent with tools
- simple-text.ts - Text generation
- multi-turn-conversation.ts - Context preservation
- interactive-chat.ts - Full-featured chat with vision
- vision-image-input.ts - Vision examples
- multi-provider-comparison.ts - Compare all providers
- json-manipulation-tool.ts - Pre-built JSON tool
- agent-with-hooks.ts - Hooks, events, metrics, audit trail

**Tool Library**:
- Pre-built tools in `src/tools/`
- JSON manipulator (delete/add/replace fields)
- Extensible architecture for new tools

**Hooks & Events System** (NEW):
- EventEmitter3 for async notifications
- Hook system for sync/async control
- Pause/resume/cancel execution
- ExecutionContext with metrics and audit trail
- Memory-safe (circular buffers, cleanup)
- Enterprise features (limits, degradation)
- 100% backward compatible

### 🚧 Not Yet Implemented

**Image Generation** (creating images, not analyzing):
- OpenAI DALL-E integration
- Image editing/variations
- Google Imagen

**Advanced Features**:
- Non-blocking tool execution
- Streaming responses
- Tool result caching
- Conversation persistence
- Advanced rate limiting/retry logic

**Platform Support**:
- Browser runtime (currently Node.js only)
- React Native

## Adding New Providers

### Text Provider (with conversion)

1. **Create provider class**: `src/infrastructure/providers/anthropic/AnthropicTextProvider.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { BaseTextProvider } from '../base/BaseTextProvider.js';
import { AnthropicConverter } from './AnthropicConverter.js';

export class AnthropicTextProvider extends BaseTextProvider {
  readonly name = 'anthropic';
  readonly capabilities = { text: true, images: false, videos: false, audio: false };

  private client: Anthropic;
  private converter: AnthropicConverter;

  constructor(config: AnthropicConfig) {
    super(config);
    this.client = new Anthropic({ apiKey: this.getApiKey() });
    this.converter = new AnthropicConverter();
  }

  async generate(options: TextGenerateOptions): Promise<LLMResponse> {
    // Convert our format → Anthropic format
    const anthropicRequest = this.converter.convertRequest(options);

    // Call Anthropic API
    const anthropicResponse = await this.client.messages.create(anthropicRequest);

    // Convert Anthropic format → our format
    return this.converter.convertResponse(anthropicResponse);
  }

  getModelCapabilities(model: string): ModelCapabilities { ... }
}
```

2. **Create converter**: `src/infrastructure/providers/anthropic/AnthropicConverter.ts`

```typescript
export class AnthropicConverter {
  convertRequest(options: TextGenerateOptions): Anthropic.MessageCreateParams {
    // Map our InputItem[] → Anthropic messages
    // Map our instructions → Anthropic system
    // Map our tools → Anthropic tools
  }

  convertResponse(response: Anthropic.Message): LLMResponse {
    // Map Anthropic content blocks → our Content[]
    // Map Anthropic tool_use → our ToolUseContent
    // Build our OutputItem[] structure
  }
}
```

3. **Register in ProviderRegistry**: `src/client/ProviderRegistry.ts`

```typescript
private createTextProvider(name: string, config: ProviderConfig): ITextProvider {
  switch (name) {
    case 'openai':
      return new OpenAITextProvider(config as OpenAIConfig);
    case 'anthropic':
      return new AnthropicTextProvider(config as AnthropicConfig);  // Add this
    // ...
  }
}
```

4. **Add config type**: `src/domain/types/ProviderConfig.ts`

```typescript
export interface AnthropicConfig extends BaseProviderConfig {
  anthropicVersion?: string;
}
```

## Adding New Capabilities

### Example: Audio Transcription

1. **Define interface**: `src/domain/interfaces/IAudioProvider.ts`

```typescript
export interface IAudioProvider extends IProvider {
  transcribe(options: TranscribeOptions): Promise<TranscriptResponse>;
  generateSpeech(options: SpeechOptions): Promise<AudioResponse>;
}
```

2. **Create manager**: `src/capabilities/audio/AudioManager.ts`

```typescript
export class AudioManager {
  constructor(private registry: ProviderRegistry) {}

  async transcribe(options: TranscribeOptions): Promise<TranscriptResponse> {
    const provider = this.registry.getAudioProvider(options.provider);
    return provider.transcribe(options);
  }
}
```

3. **Add to OneRingAI**: `src/client/OneRingAI.ts`

```typescript
export class OneRingAI {
  private _audio?: AudioManager;

  get audio(): AudioManager {
    if (!this._audio) {
      this._audio = new AudioManager(this.registry);
    }
    return this._audio;
  }
}
```

4. **Implement for providers**: `src/infrastructure/providers/openai/OpenAIAudioProvider.ts`

5. **Add factory method**: `src/client/ProviderRegistry.ts`

```typescript
private audioProviders: Map<string, IAudioProvider> = new Map();

getAudioProvider(name: string): IAudioProvider {
  // Lazy load and cache
}
```

6. **Export from index**: `src/index.ts`

```typescript
export { AudioManager } from './capabilities/audio/index.js';
```

## Important Conventions

### File Naming
- PascalCase for classes: `OneRingAI.ts`, `AgentManager.ts`
- camelCase for utilities: `errors.ts`, `logger.ts`
- `index.ts` for public exports from each directory

### Import Extensions
- Always use `.js` extension (not `.ts`) in imports
- TypeScript compiles `.ts` → `.js`, so imports must reference the output

```typescript
// ✅ Correct
import { Agent } from './Agent.js';

// ❌ Wrong
import { Agent } from './Agent';
import { Agent } from './Agent.ts';
```

### Type Exports
- Export enums as values when they're used at runtime
- Use `export type` for interfaces and type aliases only

```typescript
// ✅ Enum used as value
export { MessageRole } from './Message.js';

// ✅ Interface is type-only
export type { Message } from './Message.js';
```

### Error Handling
- Use custom error classes from `domain/errors/AIErrors.ts`
- Map provider-specific errors to our errors
- Include original error as `originalError` property

```typescript
try {
  const response = await provider.generate(options);
} catch (error: any) {
  if (error.status === 401) {
    throw new ProviderAuthError('openai', 'Invalid API key');
  }
  if (error.status === 429) {
    throw new ProviderRateLimitError('openai', retryAfter);
  }
  throw error; // Unknown error
}
```

### Async/Await
- All external API calls are async
- Use `Promise<T>` return types
- No callbacks, use async/await everywhere

### Null Safety
- TypeScript strict mode enabled
- Use optional chaining: `response.usage?.total_tokens`
- Use nullish coalescing: `config.timeout || 60000`
- Check with `noUncheckedIndexedAccess: true`

## Testing Strategy (TODO)

### Unit Tests
- Test domain entities and logic
- Mock external dependencies
- Use vitest

### Integration Tests
- Test with real API calls
- Use environment variables for keys
- Mark as slow tests

### Example Tests
- Run examples as smoke tests
- Verify they compile and run without errors

## Build and Development

### Commands
```bash
npm run build          # Build with tsup
npm run dev            # Watch mode
npm run typecheck      # Type check without building
npm run lint           # ESLint
npm test              # Run tests (not yet implemented)
```

### Build Output
- `dist/` directory with:
  - ESM bundles (`.js`)
  - Type definitions (`.d.ts`)
  - Source maps (`.js.map`)

### Dependencies
- **openai**: Official OpenAI SDK
- **@anthropic-ai/sdk**: Official Anthropic SDK (not yet used)
- **@google/generative-ai**: Official Google SDK (not yet used)
- **dotenv**: Environment variable loading
- **tsup**: Build tool
- **typescript**: Type checking
- **tsx**: TypeScript execution for examples

## Common Pitfalls

### 1. OpenAI SDK Type Issues
The OpenAI SDK has union types for tool calls that can cause issues:

```typescript
// ❌ May error if toolCall is CustomToolCall
toolCall.function.name

// ✅ Check type first
if (toolCall.type === 'function' && 'function' in toolCall) {
  toolCall.function.name
}
```

### 2. OutputItem vs InputItem
`OutputItem` includes `ReasoningItem` which cannot be used as input:

```typescript
// ❌ Type error
conversationHistory.push(...response.output);

// ✅ Filter to valid input types
conversationHistory.push(
  ...response.output.filter((item): item is InputItem =>
    item.type === 'message' || item.type === 'compaction'
  )
);
```

### 3. Enum Type Exports
If examples use enums as values, export as values:

```typescript
// ❌ Type-only export
export type { MessageRole };

// ✅ Value export
export { MessageRole };
```

### 4. Lazy Loading Race Conditions
Providers are lazy-loaded and cached. Be careful with concurrent access:

```typescript
// ✅ Safe - cached after first access
const provider = this.registry.getTextProvider('openai');
const provider2 = this.registry.getTextProvider('openai'); // Returns cached instance
```

### 5. OAuth Token Refresh Concurrency (FIXED in Phase 1)
**Problem (before fix)**: Concurrent `getToken()` calls could trigger multiple refresh requests:

```typescript
// ❌ Before fix: Both calls would trigger refreshToken()
await Promise.all([
  oauth.getToken('user123'),
  oauth.getToken('user123')
]);
// Result: 2 API requests to OAuth provider (wasteful, could hit rate limits)
```

**Solution (implemented)**: Refresh locks prevent concurrent refresh:

```typescript
// ✅ After fix: Only ONE refresh happens
await Promise.all([
  oauth.getToken('user123'),  // Starts refresh, locks it
  oauth.getToken('user123')   // Waits for existing refresh
]);
// Result: 1 API request, second call waits for first to complete
```

**Implementation**: `AuthCodePKCE.ts` uses `refreshLocks: Map<string, Promise<string>>` to track in-progress refreshes per user.

## Future Roadmap

### Phase 1 (MVP) - ✅ Complete
- Core architecture
- OpenAI text provider
- Agent system with blocking tools
- Simple text generation
- Examples and documentation

### Phase 2 - In Progress
- Fix remaining type issues
- Add comprehensive tests
- Improve error messages

### Phase 3 - Next Steps
- Anthropic provider with converter
- Google provider with converter
- Image generation capability
- Non-blocking tools

### Phase 4 - Advanced Features
- Streaming support
- Tool result caching
- Conversation state management
- Rate limiting strategies
- Retry logic improvements

### Phase 5 - Production Ready
- Performance optimization
- Bundle size optimization
- Comprehensive documentation
- Migration guides
- Publish to npm

## Getting Help

### Documentation
- `README.md`: User-facing documentation
- `EXAMPLES.md`: How to run examples
- `CLAUDE.md`: This file - for AI assistants
- Original design: `/Users/aantich/.claude/plans/silly-weaving-raven.md`

### Key Files to Understand
1. `src/client/OneRingAI.ts` - Entry point
2. `src/client/ProviderRegistry.ts` - Provider management
3. `src/capabilities/agents/Agent.ts` - Agent implementation
4. `src/capabilities/agents/AgenticLoop.ts` - Tool calling logic
5. `src/infrastructure/providers/openai/OpenAITextProvider.ts` - Provider example
6. `src/connectors/ConnectorRegistry.ts` - External system connector management
7. `src/connectors/oauth/flows/AuthCodePKCE.ts` - OAuth user authentication with race condition protection
8. `src/connectors/oauth/domain/TokenStore.ts` - Token management with validation and user scoping

### Original Design Document
The full architectural design is in: `/Users/aantich/.claude/plans/silly-weaving-raven.md`

This includes:
- Detailed interface designs
- Complete tool system specification
- Non-blocking tool execution design
- Event system for monitoring
- Migration path from Meteor.js

## Contact and Contribution

This is a private project. For questions or contributions, contact the project maintainer.

---

**Last Updated**: 2026-01-13
**Version**: 0.1.0
**Status**: MVP Complete, Production-Ready Architecture

**Recent Changes (2026-01-13 & 2026-01-15)**:
- 🏗️ **ARCHITECTURE**: Reorganized connector system - moved from `plugins/oauth/` to `src/connectors/`
- ✅ **Phase 0 Complete**: Clean separation of concerns for future extensibility (SAML, Kerberos, etc.)
- ⚠️ **Phase 1 Complete - Critical Fixes**:
  - **Race Condition Fix**: OAuth token refresh now uses per-user locks to prevent concurrent refresh requests
  - **Token Validation**: Added validation for OAuth token responses (access_token presence, type checking, expires_in validation)
- ✅ **Phase 2 Complete - High-Priority Improvements**:
  - **Memory Leak Fix**: PKCE data (codeVerifiers, states) now auto-cleaned after 15min TTL
  - **DRY Refactor**: Tool conversion logic extracted to shared utilities (3 providers use same code)
  - **Continue Strategy**: Tool failure mode now configurable - 'continue' mode executes all tools even if some fail
  - **Converter Safety**: Google/Anthropic converters use try-finally for guaranteed cleanup
  - **Configurable Timeout**: Tool execution timeout now configurable (default 30s)
- ✅ **Phase 2.5 Complete - Backward Compatibility Cleanup**:
  - **~400 lines removed**: Deleted all deprecated aliases, legacy format support, deprecated methods
  - **Deleted OAuthRegistry.ts**: Removed 170-line legacy class file
  - **API Cleanup**: Single consistent API - no more `oauthRegistry`, `OAuthMemoryStorage`, etc.
  - **Examples Updated**: All examples use clean, modern API
  - **Zero `@deprecated` tags**: Codebase is now clean and maintainable
- 🧪 **Phase 3.1 Complete - OAuth Test Coverage** (2026-01-15):
  - **103 tests created**: 98 passing (95% pass rate)
  - **Test infrastructure**: Vitest configured with coverage reporting
  - **Security tests**: Encryption, PKCE, CSRF protection, token validation
  - **Concurrency tests**: Race condition prevention verified
  - **Storage tests**: MemoryStorage, FileStorage with corruption handling
  - **Coverage**: OAuth layer approaching 90%+
- 🐛 **Bug Fix**: Changed `OAuthFileStorage` → `FileStorage` in all examples (was causing import errors)
- 📦 All connector code now in unified location: `src/connectors/oauth/`

**Previous Changes (2026-01-12)**:
- **BREAKING**: `AgentManager.create()` is now async and returns `Promise<Agent>`
- 🆕 **Built-in AI Agents** - Created `ProviderConfigAgent` for OAuth provider configuration (no templates, AI-generated)
- 🆕 **Multi-user OAuth support** - `userId` parameter in all OAuth methods (TokenStore, OAuthManager, authenticatedFetch)
- 🆕 **Extensibility exports** - Exported `BaseProvider`, `BaseTextProvider`, `ProviderErrorMapper` for custom implementations
- 🆕 User-scoped storage keys - Clean Architecture approach (`provider:clientId:userId`)
- 🆕 State parameter embedding - userId embedded in OAuth state for automatic routing
- Added `createExecuteJavaScriptTool(registry)` factory for dynamic OAuth provider descriptions
- Completed Phase 1-6 of codebase improvement plan (memory safety, error handling, concurrency)
- Created comprehensive extensibility documentation and examples
