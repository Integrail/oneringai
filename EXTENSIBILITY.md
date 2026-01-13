# Extensibility Guide

Complete guide to extending `@oneringai/agents` with custom infrastructure implementations.

## Table of Contents

- [Overview](#overview)
- [Clean Architecture Principles](#clean-architecture-principles)
- [Available Interfaces](#available-interfaces)
- [Custom LLM Providers](#custom-llm-providers)
- [Custom OAuth Storage](#custom-oauth-storage)
- [Custom Tool Executors](#custom-tool-executors)
- [Examples](#examples)

---

## Overview

`@oneringai/agents` follows **Clean Architecture** principles, which means:

✅ **Domain Layer** defines contracts (interfaces)
✅ **Infrastructure Layer** implements those contracts
✅ **Application Layer** uses implementations via interfaces

**This means**: You can freely implement custom infrastructure providers without modifying library code!

### What You Can Extend

| Component | Interface | Base Class | Use Case |
|-----------|-----------|------------|----------|
| **LLM Providers** | `ITextProvider` | `BaseTextProvider` | Add Cohere, Replicate, local models |
| **Image Providers** | `IImageProvider` | - | Add DALL-E, Imagen, custom generators |
| **OAuth Storage** | `IOAuthTokenStorage` | - | MongoDB, Redis, PostgreSQL, AWS Secrets |
| **Tool Executors** | `IToolExecutor` | - | Rate limiting, caching, permission control |

---

## Clean Architecture Principles

### Dependency Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                          │
│  AgentManager, TextManager, OAuthManager                    │
│  Depends on: Domain interfaces                              │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Uses via interface
                              │
┌─────────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                            │
│  ITextProvider, IImageProvider, IOAuthTokenStorage          │
│  Pure interfaces - no dependencies                          │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Implements
                              │
┌─────────────────────────────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                        │
│  OpenAIProvider, AnthropicProvider, FileStorage             │
│  YOUR CUSTOM IMPLEMENTATIONS GO HERE!                       │
│  Depends on: Domain interfaces                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Principle

**"Depend on abstractions, not concretions"**

- Application code uses `ITextProvider`, not `OpenAIProvider`
- Your custom `MyAIProvider` works seamlessly
- No library changes required!

---

## Available Interfaces

### Exported from `@oneringai/agents`

```typescript
import {
  // Domain Interfaces
  IProvider,
  ITextProvider,
  IImageProvider,
  IToolExecutor,
  IDisposable,
  IOAuthTokenStorage,

  // Base Classes (for easier implementation)
  BaseProvider,
  BaseTextProvider,
  ProviderErrorMapper,

  // Types needed for implementation
  TextGenerateOptions,
  ModelCapabilities,
  LLMResponse,
  StreamEvent,
  ToolCall,
  ToolResult,
  StoredToken,
} from '@oneringai/agents';
```

---

## Custom LLM Providers

### Approach 1: Extend BaseTextProvider (Recommended)

```typescript
import {
  BaseTextProvider,
  TextGenerateOptions,
  LLMResponse,
  StreamEvent,
  ModelCapabilities,
  ProviderErrorMapper,
} from '@oneringai/agents';

class MyAIProvider extends BaseTextProvider {
  readonly name = 'myai';
  readonly capabilities = {
    text: true,
    images: false,
    videos: false,
    audio: false,
  };

  private apiKey: string;
  private baseURL: string;

  constructor(config: any) {
    super(config);
    this.apiKey = this.getApiKey(); // From BaseProvider
    this.baseURL = config.baseURL || 'https://api.myai.com/v1';
  }

  /**
   * Required: Implement text generation
   */
  async generate(options: TextGenerateOptions): Promise<LLMResponse> {
    try {
      // 1. Call your API
      const response = await fetch(`${this.baseURL}/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages: this.convertInput(options.input),
          temperature: options.temperature,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw ProviderErrorMapper.mapError(error, this.name);
      }

      const data = await response.json();

      // 2. Convert to our standard format
      return this.convertToLLMResponse(data);
    } catch (error) {
      throw ProviderErrorMapper.mapError(error, this.name);
    }
  }

  /**
   * Required: Implement streaming
   */
  async *streamGenerate(
    options: TextGenerateOptions
  ): AsyncIterableIterator<StreamEvent> {
    // Implement based on your provider's streaming API
    throw new Error('Streaming not implemented');
  }

  /**
   * Required: Define model capabilities
   */
  getModelCapabilities(model: string): ModelCapabilities {
    return {
      maxInputTokens: 128000,
      maxOutputTokens: 4096,
      supportsTools: true,
      supportsVision: false,
      supportsStreaming: false,
      supportsJSON: true,
    };
  }

  // Helper methods
  private convertInput(input: string | any[]): any {
    if (typeof input === 'string') {
      return [{ role: 'user', content: input }];
    }
    // Convert InputItem[] to your format
    return input;
  }

  private convertToLLMResponse(data: any): LLMResponse {
    return {
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: data.choices[0].message.content,
            },
          ],
        },
      ],
      usage: {
        input_tokens: data.usage.prompt_tokens,
        output_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
      },
      stop_reason: data.choices[0].finish_reason,
    };
  }
}
```

**Benefits of extending BaseTextProvider**:
- ✅ API key validation (built-in)
- ✅ Config access helpers (`getApiKey()`)
- ✅ Input normalization utilities
- ✅ Common error handling patterns

### Approach 2: Implement Interface Directly

```typescript
import { ITextProvider } from '@oneringai/agents';

class SimpleProvider implements ITextProvider {
  readonly name = 'simple';
  readonly capabilities = { text: true, images: false, videos: false, audio: false };

  async generate(options: TextGenerateOptions): Promise<LLMResponse> {
    // Full implementation from scratch
  }

  async *streamGenerate(options: TextGenerateOptions): AsyncIterableIterator<StreamEvent> {
    // Streaming implementation
  }

  getModelCapabilities(model: string): ModelCapabilities {
    // Model capabilities
  }

  async validateConfig(): Promise<boolean> {
    return true;
  }
}
```

**Use when**: You need full control or the base class doesn't fit your needs.

---

## Custom OAuth Storage

### Interface Definition

```typescript
interface IOAuthTokenStorage {
  storeToken(key: string, token: StoredToken): Promise<void>;
  getToken(key: string): Promise<StoredToken | null>;
  deleteToken(key: string): Promise<void>;
  hasToken(key: string): Promise<boolean>;
}
```

### Example: MongoDB Storage

```typescript
import { IOAuthTokenStorage, StoredToken } from '@oneringai/agents';
import { MongoClient } from 'mongodb';
import * as crypto from 'crypto';

class MongoOAuthStorage implements IOAuthTokenStorage {
  private collection: any;
  private encryptionKey: Buffer;

  constructor(mongoClient: MongoClient, encryptionKey: string) {
    this.collection = mongoClient.db('oauth').collection('tokens');
    this.encryptionKey = Buffer.from(encryptionKey, 'hex');

    // Create index for efficient queries
    this.collection.createIndex({ _id: 1 });
    this.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  }

  async storeToken(key: string, token: StoredToken): Promise<void> {
    const encrypted = this.encrypt(token);

    await this.collection.updateOne(
      { _id: key },
      {
        $set: {
          ...encrypted,
          expiresAt: new Date(token.obtained_at + token.expires_in * 1000),
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  async getToken(key: string): Promise<StoredToken | null> {
    const doc = await this.collection.findOne({ _id: key });
    return doc ? this.decrypt(doc) : null;
  }

  async deleteToken(key: string): Promise<void> {
    await this.collection.deleteOne({ _id: key });
  }

  async hasToken(key: string): Promise<boolean> {
    return (await this.collection.countDocuments({ _id: key })) > 0;
  }

  // Encryption (use Node.js crypto for AES-256-GCM)
  private encrypt(token: StoredToken): any {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(token), 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  private decrypt(doc: any): StoredToken {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(doc.iv, 'base64')
    );

    decipher.setAuthTag(Buffer.from(doc.authTag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(doc.encrypted, 'base64')),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString('utf8'));
  }
}
```

**Usage**:

```typescript
import { OAuthManager } from '@oneringai/agents';
import { MongoClient } from 'mongodb';

const mongoClient = await MongoClient.connect(process.env.MONGO_URL!);
const storage = new MongoOAuthStorage(mongoClient, process.env.OAUTH_ENCRYPTION_KEY!);

const oauth = new OAuthManager({
  flow: 'authorization_code',
  clientId: 'your-id',
  // ...
  storage  // Use your custom storage!
});

// Works automatically with multi-user!
const token1 = await oauth.getToken('user123');
const token2 = await oauth.getToken('user456');
```

### Example: Redis Storage

```typescript
import { IOAuthTokenStorage, StoredToken } from '@oneringai/agents';
import Redis from 'ioredis';

class RedisOAuthStorage implements IOAuthTokenStorage {
  private redis: Redis;
  private encryptionKey: Buffer;

  constructor(redisClient: Redis, encryptionKey: string) {
    this.redis = redisClient;
    this.encryptionKey = Buffer.from(encryptionKey, 'hex');
  }

  async storeToken(key: string, token: StoredToken): Promise<void> {
    const encrypted = this.encrypt(token);

    // Store with automatic expiration (TTL)
    await this.redis.setex(
      key,
      token.expires_in,
      JSON.stringify(encrypted)
    );
  }

  async getToken(key: string): Promise<StoredToken | null> {
    const data = await this.redis.get(key);
    return data ? this.decrypt(JSON.parse(data)) : null;
  }

  async deleteToken(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async hasToken(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) > 0;
  }

  private encrypt(token: StoredToken): any {
    // Same AES-256-GCM encryption as FileStorage
    // See src/plugins/oauth/infrastructure/storage/FileStorage.ts
    return token;
  }

  private decrypt(doc: any): StoredToken {
    return doc;
  }
}
```

**Benefits**:
- ✅ Built-in TTL (auto-expires old tokens)
- ✅ High performance (in-memory)
- ✅ Works with Redis Cluster (scalable)
- ✅ Perfect for multi-server deployments

### Example: PostgreSQL Storage

```typescript
import { IOAuthTokenStorage, StoredToken } from '@oneringai/agents';
import { Pool } from 'pg';

class PostgresOAuthStorage implements IOAuthTokenStorage {
  private pool: Pool;
  private encryptionKey: Buffer;

  constructor(pool: Pool, encryptionKey: string) {
    this.pool = pool;
    this.encryptionKey = Buffer.from(encryptionKey, 'hex');
  }

  async storeToken(key: string, token: StoredToken): Promise<void> {
    const encrypted = this.encrypt(token);
    const expiresAt = new Date(token.obtained_at + token.expires_in * 1000);

    await this.pool.query(
      `INSERT INTO oauth_tokens (key, encrypted_data, iv, auth_tag, expires_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (key) DO UPDATE
       SET encrypted_data = $2, iv = $3, auth_tag = $4, expires_at = $5, updated_at = NOW()`,
      [key, encrypted.data, encrypted.iv, encrypted.authTag, expiresAt]
    );
  }

  async getToken(key: string): Promise<StoredToken | null> {
    const result = await this.pool.query(
      'SELECT encrypted_data, iv, auth_tag FROM oauth_tokens WHERE key = $1 AND expires_at > NOW()',
      [key]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.decrypt(result.rows[0]);
  }

  async deleteToken(key: string): Promise<void> {
    await this.pool.query('DELETE FROM oauth_tokens WHERE key = $1', [key]);
  }

  async hasToken(key: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM oauth_tokens WHERE key = $1 AND expires_at > NOW()',
      [key]
    );
    return result.rows.length > 0;
  }

  private encrypt(token: StoredToken): any {
    // AES-256-GCM encryption
    return { data: '', iv: '', authTag: '' };
  }

  private decrypt(doc: any): StoredToken {
    // Decrypt
    return {} as StoredToken;
  }
}
```

**SQL Schema**:

```sql
CREATE TABLE oauth_tokens (
  key VARCHAR(255) PRIMARY KEY,
  encrypted_data TEXT NOT NULL,
  iv VARCHAR(24) NOT NULL,
  auth_tag VARCHAR(24) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Auto-cleanup expired tokens
CREATE INDEX idx_expires_at ON oauth_tokens(expires_at);
```

---

## Custom LLM Providers

### Example: Cohere Provider

```typescript
import {
  BaseTextProvider,
  TextGenerateOptions,
  LLMResponse,
  StreamEvent,
  ModelCapabilities,
  ProviderErrorMapper,
  MessageRole,
  ContentType,
} from '@oneringai/agents';

class CohereProvider extends BaseTextProvider {
  readonly name = 'cohere';
  readonly capabilities = {
    text: true,
    images: false,
    videos: false,
    audio: false,
  };

  private client: any; // CohereClient

  constructor(config: any) {
    super(config);
    // Initialize Cohere SDK
    // this.client = new CohereClient({ apiKey: this.getApiKey() });
  }

  async generate(options: TextGenerateOptions): Promise<LLMResponse> {
    try {
      // Convert our format to Cohere format
      const cohereRequest = {
        model: options.model,
        message: this.extractMessage(options.input),
        temperature: options.temperature,
        max_tokens: options.max_output_tokens,
      };

      // Call Cohere API
      // const response = await this.client.chat(cohereRequest);

      // Convert Cohere response to our format
      return {
        output: [
          {
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [
              {
                type: ContentType.OUTPUT_TEXT,
                text: 'response.text', // response.text
              },
            ],
          },
        ],
        usage: {
          input_tokens: 0, // response.meta.tokens.input_tokens
          output_tokens: 0, // response.meta.tokens.output_tokens
          total_tokens: 0,
        },
        stop_reason: 'complete',
      };
    } catch (error) {
      throw ProviderErrorMapper.mapError(error, this.name);
    }
  }

  async *streamGenerate(
    options: TextGenerateOptions
  ): AsyncIterableIterator<StreamEvent> {
    // Implement streaming
    throw new Error('Not implemented');
  }

  getModelCapabilities(model: string): ModelCapabilities {
    // Define Cohere model capabilities
    const capabilities: Record<string, ModelCapabilities> = {
      'command-r-plus': {
        maxInputTokens: 128000,
        maxOutputTokens: 4096,
        supportsTools: true,
        supportsVision: false,
        supportsStreaming: true,
        supportsJSON: true,
      },
      'command-r': {
        maxInputTokens: 128000,
        maxOutputTokens: 4096,
        supportsTools: true,
        supportsVision: false,
        supportsStreaming: true,
        supportsJSON: true,
      },
    };

    return capabilities[model] || capabilities['command-r']!;
  }

  private extractMessage(input: string | any[]): string {
    if (typeof input === 'string') {
      return input;
    }
    // Extract from InputItem[]
    return this.normalizeInputToString(input); // From BaseTextProvider
  }
}
```

### Example: Local Ollama Provider

```typescript
import { BaseTextProvider } from '@oneringai/agents';

class OllamaProvider extends BaseTextProvider {
  readonly name = 'ollama';
  readonly capabilities = {
    text: true,
    images: false,
    videos: false,
    audio: false,
  };

  private baseURL: string;

  constructor(config: any) {
    super(config);
    this.baseURL = config.baseURL || 'http://localhost:11434';
  }

  async generate(options: TextGenerateOptions): Promise<LLMResponse> {
    const response = await fetch(`${this.baseURL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        prompt: this.normalizeInputToString(options.input),
        stream: false,
      }),
    });

    const data = await response.json();

    return {
      output: [
        {
          type: 'message',
          role: 'assistant' as any,
          content: [
            {
              type: 'output_text',
              text: data.response,
            },
          ],
        },
      ],
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      },
      stop_reason: 'complete',
    };
  }

  async *streamGenerate(options: TextGenerateOptions): AsyncIterableIterator<StreamEvent> {
    throw new Error('Not implemented');
  }

  getModelCapabilities(model: string): ModelCapabilities {
    return {
      maxInputTokens: 2048,
      maxOutputTokens: 2048,
      supportsTools: false,
      supportsVision: false,
      supportsStreaming: true,
      supportsJSON: false,
    };
  }
}
```

**Usage**:

```typescript
const client = new OneRingAI({
  providers: {
    ollama: new OllamaProvider({ baseURL: 'http://localhost:11434' })
  }
});

// Use like any other provider!
const response = await client.text.generate('Hello!', {
  provider: 'ollama',
  model: 'llama2'
});
```

---

## Custom Tool Executors

### Interface Definition

```typescript
interface IToolExecutor {
  executeTool(toolCall: ToolCall, context: ToolExecutionContext): Promise<ToolResult>;
}
```

### Example: Rate-Limited Executor

```typescript
import { IToolExecutor, ToolCall, ToolResult, ToolExecutionContext } from '@oneringai/agents';

class RateLimitedToolExecutor implements IToolExecutor {
  private callCounts: Map<string, number> = new Map();
  private windowStart: number = Date.now();
  private maxCallsPerMinute = 10;

  async executeTool(
    toolCall: ToolCall,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    // Check rate limit
    const count = this.callCounts.get(toolCall.function.name) || 0;

    if (count >= this.maxCallsPerMinute) {
      return {
        tool_call_id: toolCall.id,
        output: JSON.stringify({
          error: `Rate limit exceeded: ${this.maxCallsPerMinute} calls/minute`,
        }),
        error: true,
      };
    }

    // Reset window
    if (Date.now() - this.windowStart > 60000) {
      this.callCounts.clear();
      this.windowStart = Date.now();
    }

    // Increment counter
    this.callCounts.set(toolCall.function.name, count + 1);

    // Find and execute tool
    const tool = context.tools.find(
      (t) => t.definition.function.name === toolCall.function.name
    );

    if (!tool) {
      return {
        tool_call_id: toolCall.id,
        output: JSON.stringify({ error: 'Tool not found' }),
        error: true,
      };
    }

    try {
      const result = await tool.execute(toolCall.function.arguments);
      return {
        tool_call_id: toolCall.id,
        output: JSON.stringify(result),
      };
    } catch (error) {
      return {
        tool_call_id: toolCall.id,
        output: JSON.stringify({ error: (error as Error).message }),
        error: true,
      };
    }
  }
}
```

### Example: Caching Executor

```typescript
class CachingToolExecutor implements IToolExecutor {
  private cache: Map<string, any> = new Map();

  async executeTool(
    toolCall: ToolCall,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    // Generate cache key from tool name + arguments
    const cacheKey = this.getCacheKey(toolCall);

    // Check cache
    if (this.cache.has(cacheKey)) {
      console.log(`✅ Cache hit for ${toolCall.function.name}`);
      return {
        tool_call_id: toolCall.id,
        output: this.cache.get(cacheKey),
      };
    }

    // Execute tool
    const tool = context.tools.find(
      (t) => t.definition.function.name === toolCall.function.name
    );

    if (!tool) {
      return {
        tool_call_id: toolCall.id,
        output: JSON.stringify({ error: 'Tool not found' }),
        error: true,
      };
    }

    const result = await tool.execute(toolCall.function.arguments);
    const output = JSON.stringify(result);

    // Cache result
    this.cache.set(cacheKey, output);

    return {
      tool_call_id: toolCall.id,
      output,
    };
  }

  private getCacheKey(toolCall: ToolCall): string {
    return `${toolCall.function.name}:${JSON.stringify(toolCall.function.arguments)}`;
  }
}
```

---

## Examples

### Run the Example

```bash
npm run example:custom-infrastructure
```

### Real-World Use Cases

**Custom LLM Providers**:
- Cohere (Command R)
- AI21 Labs (Jurassic)
- Replicate (hosted models)
- Hugging Face Inference API
- Local models (Ollama, LM Studio)
- Enterprise internal LLMs
- Fine-tuned custom models

**Custom OAuth Storage**:
- MongoDB (multi-server apps)
- PostgreSQL (relational data)
- Redis (high performance)
- AWS Secrets Manager (cloud)
- Azure Key Vault (enterprise)
- SQLite (embedded apps)
- Custom distributed cache

**Custom Tool Executors**:
- Rate limiting per user/tool
- Tool result caching (Redis, CDN)
- Audit logging to database
- Permission-based filtering
- Cost tracking per call
- Usage analytics
- Retry logic with backoff

---

## Architecture Benefits

### 1. Dependency Inversion Principle

```typescript
// Application code depends on interface
function processData(provider: ITextProvider) {
  const response = await provider.generate({ ... });
}

// Works with ANY implementation!
processData(new OpenAIProvider(config));   // Built-in
processData(new MyAIProvider(config));     // Your custom provider
processData(new OllamaProvider(config));   // Local model
```

### 2. Open/Closed Principle

- **Open for extension**: Add new providers by implementing interfaces
- **Closed for modification**: No library changes required

### 3. Interface Segregation

- `IProvider` - Base capabilities
- `ITextProvider` - Text generation only
- `IImageProvider` - Image generation only
- `IToolExecutor` - Tool execution only

Implement only what you need!

### 4. Testability

```typescript
// Mock provider for testing
class MockTextProvider implements ITextProvider {
  async generate(): Promise<LLMResponse> {
    return { output: [...], usage: {...} };
  }
  // ... minimal implementation
}

// Use in tests
const agent = await client.agents.create({
  provider: 'mock',
  model: 'test',
  tools: [myTool]
});
```

---

## Exported Interfaces & Base Classes

### Domain Interfaces (Contracts)

```typescript
import {
  // Provider interfaces
  IProvider,
  ITextProvider,
  IImageProvider,
  IToolExecutor,

  // Lifecycle
  IDisposable,
  IAsyncDisposable,

  // OAuth
  IOAuthTokenStorage,

  // Types for implementation
  ProviderCapabilities,
  TextGenerateOptions,
  ModelCapabilities,
  LLMResponse,
  StreamEvent,
  ToolCall,
  ToolResult,
  ToolExecutionContext,
  StoredToken,
} from '@oneringai/agents';
```

### Infrastructure Base Classes

```typescript
import {
  // Base classes with reusable logic
  BaseProvider,
  BaseTextProvider,

  // Utilities
  ProviderErrorMapper,
} from '@oneringai/agents';
```

**Base Class Benefits**:
- ✅ Common validation logic
- ✅ API key handling
- ✅ Input normalization helpers
- ✅ Error mapping utilities
- ✅ Less boilerplate

---

## Implementation Checklist

### For Custom LLM Provider:

- [ ] Extend `BaseTextProvider` or implement `ITextProvider`
- [ ] Implement `generate(options)` - main text generation
- [ ] Implement `streamGenerate(options)` - streaming (can throw if not supported)
- [ ] Implement `getModelCapabilities(model)` - model metadata
- [ ] Convert between your API format and our standard format
- [ ] Use `ProviderErrorMapper` for consistent error handling
- [ ] Test with `client.text.generate()` and `client.agents.create()`

### For Custom OAuth Storage:

- [ ] Implement `IOAuthTokenStorage` interface
- [ ] Implement all 4 methods: `storeToken`, `getToken`, `deleteToken`, `hasToken`
- [ ] MUST encrypt tokens at rest (use Node.js crypto AES-256-GCM)
- [ ] Handle multi-user keys automatically (key includes userId)
- [ ] Pass to OAuthManager: `storage: new YourStorage()`
- [ ] Test with `oauth.getToken(userId)` for multiple users

### For Custom Tool Executor:

- [ ] Implement `IToolExecutor` interface
- [ ] Implement `executeTool(toolCall, context)`
- [ ] Add your custom logic (rate limiting, caching, etc.)
- [ ] Return `ToolResult` with proper error handling
- [ ] Pass to ToolRegistry (advanced usage)

---

## Production Best Practices

### 1. Implement IDisposable

```typescript
class MyProvider extends BaseTextProvider implements IDisposable {
  private _isDestroyed = false;

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;

    // Cleanup resources
    this.client?.close();
  }
}
```

### 2. Use ProviderErrorMapper

```typescript
try {
  const response = await yourAPI.call();
} catch (error) {
  // Maps to: ProviderAuthError, ProviderRateLimitError, etc.
  throw ProviderErrorMapper.mapError(error, this.name);
}
```

### 3. Handle Multi-User in Storage

```typescript
// Storage keys are already user-scoped by TokenStore
// Just implement the interface - multi-user works automatically!
async storeToken(key: string, token: StoredToken): Promise<void> {
  // key is "provider:clientId:userId" for multi-user
  // key is "provider:clientId" for single-user
  await this.db.save(key, encrypt(token));
}
```

### 4. Add Proper Validation

```typescript
class MyProvider extends BaseTextProvider {
  protected validateProviderSpecificKeyFormat(apiKey: string) {
    if (!apiKey.startsWith('myai_')) {
      return {
        isValid: false,
        warning: 'MyAI keys should start with myai_',
      };
    }
    return { isValid: true };
  }
}
```

---

## Summary

✅ **YES!** Users can freely implement custom infrastructure providers

✅ **Exported Interfaces**: All domain interfaces exported as types

✅ **Exported Base Classes**: `BaseProvider`, `BaseTextProvider`, `ProviderErrorMapper`

✅ **Clean Architecture**: Infrastructure is pluggable, testable, swappable

✅ **Examples Provided**: Cohere, Ollama, MongoDB, Redis, PostgreSQL

✅ **Multi-User Ready**: All custom implementations work with multi-user OAuth automatically

**Try it**: `npm run example:custom-infrastructure`

---

**Last Updated**: 2026-01-12
