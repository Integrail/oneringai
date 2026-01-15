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
│  Connector, Agent, OAuthManager                             │
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

---

## Custom LLM Providers - Full Examples

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
import { BaseTextProvider, Connector, Vendor } from '@oneringai/agents';

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

// Usage with the new Connector-First API:
Connector.create({
  name: 'ollama',
  vendor: Vendor.OpenAI, // Use OpenAI-compatible vendor
  auth: { type: 'none' }, // No auth needed for local Ollama
  baseURL: 'http://localhost:11434/v1',
});

const agent = Agent.create({
  connector: 'ollama',
  model: 'llama2',
});

const response = await agent.run('Hello!');
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
import { Connector, Agent, Vendor } from '@oneringai/agents';

// Mock provider for testing
class MockTextProvider implements ITextProvider {
  async generate(): Promise<LLMResponse> {
    return { output: [...], usage: {...} };
  }
  // ... minimal implementation
}

// Use in tests
Connector.create({
  name: 'mock',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: 'test-key' },
});

const agent = Agent.create({
  connector: 'mock',
  model: 'test',
  tools: [myTool],
});
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

**Last Updated**: 2026-01-15
