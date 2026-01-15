# OneRingAI v2: Connector-First Architecture

## Executive Summary

This document describes a complete redesign of the `@oneringai/agents` library to eliminate authentication duplication and simplify the API.

### Key Changes
1. **Eliminate `OneRingAI` class** - No more wrapper, just Connector + Agent
2. **Connectors are the ONLY auth mechanism** - LLM providers use connectors for credentials
3. **Named connectors** - Every connector must have a unique name
4. **Explicit vendor field** - No auto-detection magic
5. **One auth per connector** - Simple 1:1 mapping

---

## Current vs New API

### Before (Current - Complex)

```typescript
import { OneRingAI, MessageRole } from '@oneringai/agents';

// Step 1: Create client with provider configs
const client = new OneRingAI({
  providers: {
    openai: { apiKey: 'sk-main-key' },
    anthropic: { apiKey: 'sk-ant-key' }
  }
});

// Step 2: Create agent (provider locked at creation)
const agent = await client.agents.create({
  provider: 'openai',
  model: 'gpt-4',
  tools: [...]
});

// Problem: Can't use different OpenAI keys for different agents!
// Problem: Two auth systems (ProviderRegistry + ConnectorRegistry)
// Problem: Complex class hierarchy
```

### After (New - Simple)

```typescript
import { Connector, Agent, MessageRole } from '@oneringai/agents';

// Step 1: Create named connectors (multiple per vendor allowed!)
const openaiMain = Connector.create({
  name: 'openai-main',
  vendor: 'openai',
  auth: { type: 'api_key', apiKey: 'sk-main-key' }
});

const openaiBackup = Connector.create({
  name: 'openai-backup',
  vendor: 'openai',
  auth: { type: 'api_key', apiKey: 'sk-backup-key' }
});

const claude = Connector.create({
  name: 'claude',
  vendor: 'anthropic',
  auth: { type: 'api_key', apiKey: 'sk-ant-key' }
});

// Step 2: Create agents from connectors
const mainAgent = Agent.create({
  connector: openaiMain,  // or 'openai-main' (lookup by name)
  model: 'gpt-4',
  tools: [...]
});

const backupAgent = Agent.create({
  connector: openaiBackup,
  model: 'gpt-4'
});

// Use the agents
const response = await mainAgent.run('Hello!');
```

---

## Core Concepts

### 1. Connector

A Connector represents a single authenticated connection to a vendor API.

```typescript
interface ConnectorConfig {
  // Required
  name: string;              // Unique identifier (e.g., 'openai-main')
  vendor: Vendor;            // 'openai' | 'anthropic' | 'google' | 'groq' | ...
  auth: AuthConfig;          // Authentication configuration

  // Optional
  displayName?: string;      // Human-readable name
  baseURL?: string;          // Override default vendor URL
  defaultModel?: string;     // Default model for this connector
  options?: VendorOptions;   // Vendor-specific options (timeout, retries, etc.)
}

type Vendor =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'google-vertex'
  | 'groq'
  | 'together'
  | 'perplexity'
  | 'grok'
  | 'ollama'
  | 'custom';  // For OpenAI-compatible APIs

type AuthConfig =
  | { type: 'api_key'; apiKey: string }
  | { type: 'oauth'; flow: OAuthFlow; clientId: string; clientSecret?: string; ... }
  | { type: 'service_account'; keyFile: string }  // Google Vertex AI
  | { type: 'custom'; getCredentials: () => Promise<Credentials> };
```

### 2. Agent

An Agent is a stateful AI assistant bound to a specific Connector.

```typescript
interface AgentConfig {
  // Required
  connector: Connector | string;  // Connector instance or name
  model: string;                   // Model identifier

  // Optional
  name?: string;                   // Agent name (for logging/debugging)
  instructions?: string;           // System instructions
  tools?: ToolFunction[];          // Available tools
  maxTokens?: number;
  temperature?: number;
  // ... other generation options
}
```

### 3. ConnectorRegistry (Global)

Single global registry for all connectors.

```typescript
// Connectors auto-register on creation
const conn = Connector.create({ name: 'openai-main', ... });

// Lookup by name
const conn2 = Connector.get('openai-main');

// List all
const all = Connector.list();  // ['openai-main', 'openai-backup', 'claude']

// Check existence
if (Connector.has('openai-main')) { ... }
```

---

## Detailed Design

### Connector Class

```typescript
// src/Connector.ts

export class Connector {
  // Static registry (singleton)
  private static registry: Map<string, Connector> = new Map();

  // Instance properties
  readonly name: string;
  readonly vendor: Vendor;
  readonly auth: AuthConfig;
  readonly baseURL: string;
  readonly options: VendorOptions;

  // Private constructor (use Connector.create)
  private constructor(config: ConnectorConfig) {
    this.name = config.name;
    this.vendor = config.vendor;
    this.auth = config.auth;
    this.baseURL = config.baseURL ?? getDefaultBaseURL(config.vendor);
    this.options = config.options ?? {};
  }

  // === Static Factory Methods ===

  static create(config: ConnectorConfig): Connector {
    if (Connector.registry.has(config.name)) {
      throw new Error(`Connector '${config.name}' already exists`);
    }
    const connector = new Connector(config);
    Connector.registry.set(config.name, connector);
    return connector;
  }

  static get(name: string): Connector {
    const connector = Connector.registry.get(name);
    if (!connector) {
      throw new Error(`Connector '${name}' not found`);
    }
    return connector;
  }

  static has(name: string): boolean {
    return Connector.registry.has(name);
  }

  static list(): string[] {
    return Array.from(Connector.registry.keys());
  }

  static clear(): void {
    Connector.registry.clear();
  }

  // === Instance Methods ===

  /**
   * Get authenticated fetch function for this connector
   */
  async fetch(path: string, options?: RequestInit, userId?: string): Promise<Response> {
    const token = await this.getToken(userId);
    const url = `${this.baseURL}${path}`;

    return fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        ...this.getAuthHeaders(token)
      }
    });
  }

  /**
   * Get current auth token (handles refresh automatically)
   */
  async getToken(userId?: string): Promise<string> {
    // Delegates to internal auth manager based on auth.type
    return this.authManager.getToken(userId);
  }

  /**
   * Get the underlying SDK client (for advanced usage)
   */
  getClient<T = unknown>(): T {
    return this.clientFactory.create() as T;
  }

  // === Internal ===

  private getAuthHeaders(token: string): Record<string, string> {
    // Vendor-specific header formatting
    switch (this.vendor) {
      case 'openai':
      case 'groq':
      case 'together':
        return { 'Authorization': `Bearer ${token}` };
      case 'anthropic':
        return { 'x-api-key': token };
      case 'google':
        return { 'x-goog-api-key': token };
      // ... etc
    }
  }
}
```

### Agent Class

```typescript
// src/Agent.ts

export class Agent {
  readonly name: string;
  readonly connector: Connector;
  readonly model: string;
  readonly instructions?: string;

  private toolRegistry: ToolRegistry;
  private conversationHistory: InputItem[] = [];
  private provider: ITextProvider;

  private constructor(config: AgentConfig) {
    // Resolve connector (instance or name lookup)
    this.connector = typeof config.connector === 'string'
      ? Connector.get(config.connector)
      : config.connector;

    this.name = config.name ?? `agent-${Date.now()}`;
    this.model = config.model;
    this.instructions = config.instructions;
    this.toolRegistry = new ToolRegistry(config.tools ?? []);

    // Create vendor-specific provider from connector
    this.provider = createProvider(this.connector);
  }

  // === Static Factory ===

  static create(config: AgentConfig): Agent {
    return new Agent(config);
  }

  // === Main API ===

  /**
   * Run a single turn of conversation
   */
  async run(input: string | InputItem[]): Promise<LLMResponse> {
    // Add user input to history
    this.addToHistory(input);

    // Run agentic loop (handles tool calls)
    const response = await this.agenticLoop();

    // Add response to history
    this.addResponseToHistory(response);

    return response;
  }

  /**
   * Stream a response (returns async iterator)
   */
  async *stream(input: string | InputItem[]): AsyncGenerator<StreamChunk> {
    // ... streaming implementation
  }

  /**
   * Reset conversation history
   */
  reset(): void {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getHistory(): InputItem[] {
    return [...this.conversationHistory];
  }
}
```

### Provider Factory

```typescript
// src/providers/index.ts

export function createProvider(connector: Connector): ITextProvider {
  switch (connector.vendor) {
    case 'openai':
      return new OpenAIProvider(connector);
    case 'anthropic':
      return new AnthropicProvider(connector);
    case 'google':
      return new GoogleProvider(connector);
    case 'google-vertex':
      return new GoogleVertexProvider(connector);
    case 'groq':
    case 'together':
    case 'perplexity':
    case 'grok':
      return new OpenAICompatibleProvider(connector);
    case 'ollama':
      return new OllamaProvider(connector);
    case 'custom':
      return new OpenAICompatibleProvider(connector);
    default:
      throw new Error(`Unknown vendor: ${connector.vendor}`);
  }
}
```

### Provider Base Class

```typescript
// src/providers/BaseProvider.ts

export abstract class BaseProvider implements ITextProvider {
  protected connector: Connector;

  constructor(connector: Connector) {
    this.connector = connector;
  }

  // Get credentials from connector
  protected async getCredentials(): Promise<string> {
    return this.connector.getToken();
  }

  // Abstract methods for vendor-specific implementation
  abstract generate(options: GenerateOptions): Promise<LLMResponse>;
  abstract getModelCapabilities(model: string): ModelCapabilities;
}

// Example: OpenAI Provider
export class OpenAIProvider extends BaseProvider {
  private client: OpenAI | null = null;

  private async getClient(): Promise<OpenAI> {
    if (!this.client) {
      const apiKey = await this.getCredentials();
      this.client = new OpenAI({
        apiKey,
        baseURL: this.connector.baseURL
      });
    }
    return this.client;
  }

  async generate(options: GenerateOptions): Promise<LLMResponse> {
    const client = await this.getClient();
    // ... call OpenAI API
  }
}
```

---

## Authentication Flows

### API Key (Static Token)

```typescript
// Most common - simple API key
const openai = Connector.create({
  name: 'openai',
  vendor: 'openai',
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! }
});
```

### OAuth 2.0 (User Auth)

```typescript
// For user-authenticated APIs
const github = Connector.create({
  name: 'github',
  vendor: 'custom',
  baseURL: 'https://api.github.com',
  auth: {
    type: 'oauth',
    flow: 'authorization_code',
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'user']
  }
});

// Start OAuth flow
const authUrl = await github.startAuth('user-123');
// ... user completes auth, receives callback ...
await github.handleCallback(callbackUrl, 'user-123');

// Now fetch authenticated
const response = await github.fetch('/user', {}, 'user-123');
```

### Service Account (Google Vertex)

```typescript
const vertex = Connector.create({
  name: 'vertex',
  vendor: 'google-vertex',
  auth: {
    type: 'service_account',
    keyFile: './service-account.json',
    projectId: 'my-project'
  }
});
```

---

## Migration Guide

### Before (v1)

```typescript
import { OneRingAI } from '@oneringai/agents';

const client = new OneRingAI({
  providers: {
    openai: { apiKey: 'sk-...' }
  }
});

const agent = await client.agents.create({
  provider: 'openai',
  model: 'gpt-4',
  instructions: 'You are helpful'
});

const response = await agent.run('Hello');
```

### After (v2)

```typescript
import { Connector, Agent } from '@oneringai/agents';

Connector.create({
  name: 'openai',
  vendor: 'openai',
  auth: { type: 'api_key', apiKey: 'sk-...' }
});

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  instructions: 'You are helpful'
});

const response = await agent.run('Hello');
```

**Key differences:**
- No `OneRingAI` class
- Connector created separately with explicit `name` and `vendor`
- Agent references connector by name or instance
- Same `agent.run()` API

---

## New Directory Structure

```
src/
├── index.ts                    # Public exports
├── Connector.ts                # Connector class with registry
├── Agent.ts                    # Agent class
├── domain/
│   ├── entities/               # Pure data types
│   │   ├── Message.ts
│   │   ├── Content.ts
│   │   ├── Tool.ts
│   │   └── Response.ts
│   ├── interfaces/             # Contracts
│   │   ├── ITextProvider.ts
│   │   └── IToolExecutor.ts
│   └── errors/
│       └── AIErrors.ts
├── providers/                  # Vendor implementations (SIMPLIFIED)
│   ├── index.ts                # createProvider() factory
│   ├── BaseProvider.ts
│   ├── openai/
│   │   └── OpenAIProvider.ts
│   ├── anthropic/
│   │   └── AnthropicProvider.ts
│   ├── google/
│   │   └── GoogleProvider.ts
│   └── openai-compatible/
│       └── OpenAICompatibleProvider.ts
├── auth/                       # All auth logic (UNIFIED)
│   ├── index.ts
│   ├── AuthManager.ts          # Base auth manager
│   ├── ApiKeyAuth.ts           # Static API key
│   ├── OAuthAuth.ts            # OAuth 2.0 flows
│   ├── ServiceAccountAuth.ts   # Google service accounts
│   └── storage/
│       ├── ITokenStorage.ts
│       ├── MemoryStorage.ts
│       └── FileStorage.ts
├── tools/                      # Tool system
│   ├── ToolRegistry.ts
│   ├── ToolExecutor.ts
│   └── AgenticLoop.ts
└── utils/
    └── ...
```

### Files to DELETE

```
REMOVE:
├── src/client/                 # Entire directory
│   ├── OneRingAI.ts            # DELETE
│   └── ProviderRegistry.ts     # DELETE (replaced by Connector)
├── src/connectors/             # MERGE into src/auth/
│   ├── ConnectorRegistry.ts    # DELETE (Connector.registry replaces)
│   ├── oauth/                  # MOVE to src/auth/
│   └── ...
├── src/capabilities/           # SIMPLIFY
│   ├── agents/
│   │   └── AgentManager.ts     # DELETE (Agent.create replaces)
│   ├── text/                   # DELETE (integrated into providers)
│   └── images/                 # KEEP (future)
```

---

## Benefits of New Design

### 1. Single Source of Truth for Auth
- All authentication goes through `Connector`
- No duplicate API key storage
- Consistent token refresh across all providers

### 2. Multiple Credentials Per Vendor
```typescript
// Easy! Just create multiple connectors
Connector.create({ name: 'openai-prod', vendor: 'openai', auth: {...} });
Connector.create({ name: 'openai-dev', vendor: 'openai', auth: {...} });
Connector.create({ name: 'openai-client-a', vendor: 'openai', auth: {...} });
```

### 3. Simpler Mental Model
- Connector = authenticated connection to a service
- Agent = AI assistant using a connector
- That's it!

### 4. DRY Code
- Auth headers defined once per vendor
- Token refresh logic shared
- No duplicate configuration

### 5. Type Safety
- Explicit vendor field = no magic
- Named connectors = no typos
- Clear error messages

### 6. Extensibility
- Add new vendor: implement one provider class
- Custom auth: implement `type: 'custom'` handler
- Multiple auth per vendor: just create more connectors

---

## Example Use Cases

### Multi-Tenant SaaS

```typescript
// Each customer has their own OpenAI key
function createAgentForCustomer(customerId: string, apiKey: string) {
  Connector.create({
    name: `openai-${customerId}`,
    vendor: 'openai',
    auth: { type: 'api_key', apiKey }
  });

  return Agent.create({
    connector: `openai-${customerId}`,
    model: 'gpt-4'
  });
}
```

### Fallback Between Providers

```typescript
Connector.create({ name: 'primary', vendor: 'openai', auth: {...} });
Connector.create({ name: 'fallback', vendor: 'anthropic', auth: {...} });

async function runWithFallback(input: string) {
  try {
    const agent = Agent.create({ connector: 'primary', model: 'gpt-4' });
    return await agent.run(input);
  } catch (error) {
    const agent = Agent.create({ connector: 'fallback', model: 'claude-3-opus' });
    return await agent.run(input);
  }
}
```

### OAuth + LLM in Same Flow

```typescript
// Create OAuth connector for GitHub
Connector.create({
  name: 'github',
  vendor: 'custom',
  baseURL: 'https://api.github.com',
  auth: { type: 'oauth', flow: 'authorization_code', ... }
});

// Create LLM connector
Connector.create({
  name: 'openai',
  vendor: 'openai',
  auth: { type: 'api_key', apiKey: '...' }
});

// Agent can use GitHub connector as a tool!
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [
    {
      name: 'search_github',
      description: 'Search GitHub repositories',
      execute: async (args) => {
        const github = Connector.get('github');
        const response = await github.fetch(`/search/repositories?q=${args.query}`, {}, userId);
        return response.json();
      }
    }
  ]
});
```

---

## Open Questions

1. **Lazy client instantiation**: Should SDK clients (OpenAI, Anthropic) be created on first use or at Connector creation?
   - Recommendation: Lazy (on first use) to support OAuth flows that need token first

2. **Connector disposal**: Should connectors support cleanup (close connections, clear tokens)?
   - Recommendation: Yes, add `Connector.dispose(name)` and `connector.dispose()`

3. **Environment variable helpers**: Should we provide `Connector.fromEnv()` helpers?
   - Recommendation: Yes, for common cases:
   ```typescript
   // Auto-creates from OPENAI_API_KEY env var
   Connector.fromEnv('openai');
   ```

4. **Streaming**: How does streaming work with new design?
   - Recommendation: `agent.stream()` returns AsyncGenerator, same pattern

---

## Implementation Plan

### Phase 1: Core Classes
1. Create `src/Connector.ts` with registry
2. Create `src/Agent.ts` with basic functionality
3. Migrate auth logic to `src/auth/`

### Phase 2: Providers
1. Refactor providers to accept Connector
2. Remove ProviderRegistry
3. Create `createProvider()` factory

### Phase 3: Cleanup
1. Delete `src/client/` directory
2. Delete `src/connectors/` (merged into auth)
3. Update all exports in `src/index.ts`

### Phase 4: Examples & Tests
1. Update all examples
2. Add tests for new architecture
3. Update documentation

---

## Conclusion

This redesign simplifies the architecture by making Connector the single source of truth for authentication. The benefits include:

- **50% less code** in auth-related modules
- **Clearer mental model** (Connector → Agent)
- **Better multi-tenant support** (multiple connectors per vendor)
- **DRY principle** applied consistently
- **Future-proof** for new auth methods and vendors
