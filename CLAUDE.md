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
client.agents.create({ provider: 'openai', ... });
client.images.generate({ provider: 'openai', ... });
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
│   │   └── Response.ts               # LLMResponse
│   ├── interfaces/                   # Contracts
│   │   ├── IProvider.ts              # Base provider interface
│   │   ├── ITextProvider.ts          # Text generation provider
│   │   ├── IImageProvider.ts         # Image generation provider
│   │   └── IToolExecutor.ts          # Tool execution interface
│   ├── types/                        # Shared types
│   │   ├── ProviderConfig.ts         # Provider configuration types
│   │   └── CommonTypes.ts            # Logger, metadata, etc.
│   └── errors/                       # Domain errors
│       └── AIErrors.ts               # Custom error classes
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
- ProviderRegistry with caching
- Complete domain entities and interfaces
- Comprehensive error handling

**OpenAI Provider**:
- Text generation using Chat Completions API
- Tool calling support
- Vision support (via image URLs in content)
- JSON output with schema validation
- Error mapping (auth, rate limit, context length)

**Agent System**:
- Agent creation and management
- Tool registry and execution
- Agentic loop with blocking tools
- Multi-turn conversations
- Tool call state tracking

**Text Generation**:
- Simple text generation
- Structured JSON output
- System instructions
- Multi-turn conversations

### 🚧 Not Yet Implemented

**Providers**:
- Anthropic (Claude) - needs converter
- Google (Gemini) - needs converter
- Groq - similar to OpenAI

**Image Generation**:
- OpenAI DALL-E integration
- Image editing/variations
- Google Imagen

**Advanced Features**:
- Non-blocking tool execution
- Streaming responses
- Tool result caching
- Conversation persistence
- Rate limiting/retry logic (beyond SDK defaults)

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

**Last Updated**: 2025-01-05
**Version**: 0.1.0
**Status**: MVP Complete, Production-Ready Architecture
