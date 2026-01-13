/**
 * Custom Infrastructure Example
 *
 * Demonstrates how to implement custom infrastructure providers
 * following Clean Architecture principles
 *
 * Users can implement:
 * 1. Custom LLM providers (ITextProvider, IImageProvider)
 * 2. Custom OAuth storage backends (IOAuthTokenStorage)
 * 3. Custom tool executors (IToolExecutor)
 */

import 'dotenv/config';
import {
  // Domain Interfaces (contracts)
  ITextProvider,
  IImageProvider,
  IOAuthTokenStorage,
  IToolExecutor,
  IDisposable,

  // Base Classes (reusable infrastructure)
  BaseProvider,
  BaseTextProvider,
  ProviderErrorMapper,

  // Domain Types
  TextGenerateOptions,
  ModelCapabilities,
  LLMResponse,
  StreamEvent,
  ToolCall,
  ToolResult,
  ProviderCapabilities,
  ToolExecutionContext,

  // OAuth Types
  StoredToken,

  // For registration
  OneRingAI,
  OAuthManager,
} from '../src/index.js';

// ==================== Example 1: Custom LLM Provider ====================
console.log('Example 1: Custom LLM Provider');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

/**
 * Custom provider for a hypothetical "MyAI" service
 * Extends BaseTextProvider to get common functionality
 */
class MyAIProvider extends BaseTextProvider {
  readonly name = 'myai';
  readonly capabilities: ProviderCapabilities = {
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
   * Implement generate() - required by ITextProvider
   */
  async generate(options: TextGenerateOptions): Promise<LLMResponse> {
    try {
      // Call your custom API
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages: this.convertToMyAIFormat(options.input),
          temperature: options.temperature,
          max_tokens: options.max_output_tokens,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        // Use ProviderErrorMapper for consistent error handling!
        throw ProviderErrorMapper.mapError(error, this.name);
      }

      const data = await response.json();

      // Convert response to our standard LLMResponse format
      return this.convertFromMyAIFormat(data);
    } catch (error) {
      throw ProviderErrorMapper.mapError(error, this.name);
    }
  }

  /**
   * Implement streamGenerate() - required by ITextProvider
   */
  async *streamGenerate(options: TextGenerateOptions): AsyncIterableIterator<StreamEvent> {
    // Implementation depends on your provider's streaming API
    // For now, throw not implemented
    throw new Error('Streaming not yet implemented for MyAI provider');
  }

  /**
   * Implement getModelCapabilities() - required by ITextProvider
   */
  getModelCapabilities(model: string): ModelCapabilities {
    // Define capabilities for your models
    return {
      maxInputTokens: 128000,
      maxOutputTokens: 4096,
      supportsTools: true,
      supportsVision: false,
      supportsStreaming: false,
      supportsJSON: true,
    };
  }

  /**
   * Convert our standard format to MyAI format
   */
  private convertToMyAIFormat(input: string | any[]): any[] {
    // If your provider uses OpenAI-compatible format, just return
    // Otherwise, implement conversion logic
    if (typeof input === 'string') {
      return [{ role: 'user', content: input }];
    }

    // Convert InputItem[] to your provider's format
    // ... conversion logic ...
    return [];
  }

  /**
   * Convert MyAI format to our standard LLMResponse
   */
  private convertFromMyAIFormat(data: any): LLMResponse {
    // Convert your provider's response to our standard format
    return {
      output: [
        {
          type: 'message',
          role: 'assistant' as any,
          content: [
            {
              type: 'output_text',
              text: data.choices[0].message.content,
            },
          ],
        },
      ],
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0,
      },
      stop_reason: data.choices[0].finish_reason,
    };
  }
}

console.log('✅ Custom LLM provider implemented: MyAIProvider');
console.log('   Extends: BaseTextProvider');
console.log('   Implements: ITextProvider');
console.log('   Features: API key validation, error mapping, format conversion');
console.log('');

// ==================== Example 2: Custom OAuth Storage Backend ====================
console.log('\nExample 2: Custom OAuth Storage Backend');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

/**
 * Custom MongoDB storage for OAuth tokens
 * Implements IOAuthTokenStorage interface
 */
class MongoTokenStorage implements IOAuthTokenStorage {
  private collection: any; // MongoDB collection

  constructor(mongoClient: any) {
    this.collection = mongoClient.db('oauth').collection('tokens');
  }

  /**
   * Store token - MUST encrypt before storing
   */
  async storeToken(key: string, token: StoredToken): Promise<void> {
    // Encrypt token before storing (use built-in encryption utilities)
    const encrypted = this.encrypt(token);

    await this.collection.updateOne(
      { _id: key },
      {
        $set: {
          ...encrypted,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    console.log(`   ✅ Stored token for key: ${key}`);
  }

  /**
   * Get token - MUST decrypt after retrieving
   */
  async getToken(key: string): Promise<StoredToken | null> {
    const doc = await this.collection.findOne({ _id: key });

    if (!doc) {
      return null;
    }

    // Decrypt token before returning
    return this.decrypt(doc);
  }

  /**
   * Delete token
   */
  async deleteToken(key: string): Promise<void> {
    await this.collection.deleteOne({ _id: key });
    console.log(`   ✅ Deleted token for key: ${key}`);
  }

  /**
   * Check if token exists
   */
  async hasToken(key: string): Promise<boolean> {
    const count = await this.collection.countDocuments({ _id: key });
    return count > 0;
  }

  // Encryption helpers (simplified - use proper crypto in production!)
  private encrypt(token: StoredToken): any {
    // Use Node.js crypto for AES-256-GCM encryption
    // See src/plugins/oauth/infrastructure/storage/FileStorage.ts for reference
    return { ...token, encrypted: true };
  }

  private decrypt(doc: any): StoredToken {
    // Decrypt using Node.js crypto
    return doc as StoredToken;
  }
}

console.log('✅ Custom OAuth storage implemented: MongoTokenStorage');
console.log('   Implements: IOAuthTokenStorage');
console.log('   Features: MongoDB storage, encryption, multi-user support');
console.log('   Usage:');
console.log('   ```typescript');
console.log('   const storage = new MongoTokenStorage(mongoClient);');
console.log('   const oauth = new OAuthManager({');
console.log('     flow: "authorization_code",');
console.log('     storage  // Use custom storage!');
console.log('   });');
console.log('   ```');
console.log('');

// ==================== Example 3: Custom Redis Storage ====================
console.log('\nExample 3: Custom Redis Storage Backend');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

/**
 * Redis storage for OAuth tokens
 * High-performance caching with built-in TTL
 */
class RedisTokenStorage implements IOAuthTokenStorage {
  private redis: any; // Redis client

  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async storeToken(key: string, token: StoredToken): Promise<void> {
    const encrypted = this.encrypt(token);

    // Store with TTL = token expiry
    await this.redis.setex(
      key,
      token.expires_in,
      JSON.stringify(encrypted)
    );

    console.log(`   ✅ Stored in Redis with TTL: ${token.expires_in}s`);
  }

  async getToken(key: string): Promise<StoredToken | null> {
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return this.decrypt(JSON.parse(data));
  }

  async deleteToken(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async hasToken(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) > 0;
  }

  private encrypt(token: StoredToken): any {
    return { ...token, encrypted: true };
  }

  private decrypt(doc: any): StoredToken {
    return doc as StoredToken;
  }
}

console.log('✅ Custom Redis storage implemented: RedisTokenStorage');
console.log('   Implements: IOAuthTokenStorage');
console.log('   Features: Auto-expiring tokens (TTL), high performance');
console.log('   Best for: Multi-server deployments, high-traffic apps');
console.log('');

// ==================== Example 4: Custom Tool Executor ====================
console.log('\nExample 4: Custom Tool Executor');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

/**
 * Custom tool executor with rate limiting
 * Implements IToolExecutor interface
 */
class RateLimitedToolExecutor implements IToolExecutor {
  private callCounts: Map<string, number> = new Map();
  private windowStart: number = Date.now();
  private readonly maxCallsPerMinute = 10;

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

    // Increment counter
    this.callCounts.set(toolCall.function.name, count + 1);

    // Reset window every minute
    if (Date.now() - this.windowStart > 60000) {
      this.callCounts.clear();
      this.windowStart = Date.now();
    }

    // Find and execute the tool
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

console.log('✅ Custom tool executor implemented: RateLimitedToolExecutor');
console.log('   Implements: IToolExecutor');
console.log('   Features: Rate limiting (10 calls/min per tool)');
console.log('');

// ==================== Summary ====================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📚 Available Interfaces for Custom Implementation');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('🔌 Provider Interfaces:');
console.log('   IProvider            - Base provider contract');
console.log('   ITextProvider        - LLM text generation');
console.log('   IImageProvider       - Image generation (DALL-E, Imagen, etc.)');
console.log('   IToolExecutor        - Custom tool execution logic');
console.log('   IDisposable          - Resource cleanup contract');
console.log('');

console.log('📦 OAuth Interfaces:');
console.log('   IOAuthTokenStorage   - Custom token storage backend');
console.log('');

console.log('🏗️ Base Classes (extend these for easier implementation):');
console.log('   BaseProvider         - Common provider functionality');
console.log('   BaseTextProvider     - Common text provider functionality');
console.log('   ProviderErrorMapper  - Unified error mapping');
console.log('');

console.log('✨ All interfaces follow Clean Architecture:');
console.log('   • Domain Layer: Interfaces define contracts');
console.log('   • Infrastructure Layer: You implement the contract');
console.log('   • Application Layer: Uses your implementation via interface');
console.log('');

console.log('📖 Implementation Checklist:');
console.log('');
console.log('For Custom LLM Provider:');
console.log('  1. Extend BaseTextProvider (or implement ITextProvider)');
console.log('  2. Implement generate(), streamGenerate(), getModelCapabilities()');
console.log('  3. Convert between your API format and our standard format');
console.log('  4. Use ProviderErrorMapper for consistent errors');
console.log('  5. Register with ProviderRegistry (TODO: make this public API)');
console.log('');

console.log('For Custom OAuth Storage:');
console.log('  1. Implement IOAuthTokenStorage interface');
console.log('  2. Implement storeToken(), getToken(), deleteToken(), hasToken()');
console.log('  3. MUST encrypt tokens at rest (use Node crypto)');
console.log('  4. Pass to OAuthManager: storage: new YourStorage()');
console.log('  5. Works automatically with multi-user support!');
console.log('');

console.log('For Custom Tool Executor:');
console.log('  1. Implement IToolExecutor interface');
console.log('  2. Implement executeTool(toolCall, context)');
console.log('  3. Add custom logic (rate limiting, caching, logging, etc.)');
console.log('  4. Pass to ToolRegistry (advanced usage)');
console.log('');

console.log('💡 Benefits of Clean Architecture:');
console.log('   ✅ Swap implementations without changing application code');
console.log('   ✅ Test with mock implementations');
console.log('   ✅ Add new providers without modifying existing code');
console.log('   ✅ Infrastructure details hidden behind interfaces');
console.log('   ✅ Domain layer stays pure and testable');
console.log('');

console.log('🚀 Real-World Examples:');
console.log('');
console.log('Custom LLM Providers:');
console.log('   • Cohere, AI21, Replicate, Hugging Face Inference');
console.log('   • Local models (Ollama, LM Studio, llama.cpp)');
console.log('   • Custom fine-tuned models');
console.log('   • Enterprise internal LLMs');
console.log('');

console.log('Custom OAuth Storage:');
console.log('   • PostgreSQL, MySQL, SQLite');
console.log('   • Redis, Memcached');
console.log('   • AWS Secrets Manager, Azure Key Vault');
console.log('   • Encrypted S3 buckets');
console.log('   • Your own distributed cache');
console.log('');

console.log('Custom Tool Executors:');
console.log('   • Rate limiting per user/tool');
console.log('   • Tool result caching');
console.log('   • Audit logging to database');
console.log('   • Permission-based tool filtering');
console.log('   • Cost tracking per tool call');
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('✨ Your library follows Clean Architecture principles!');
console.log('   Users can implement any infrastructure they need.');
console.log('');
