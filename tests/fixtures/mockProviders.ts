/**
 * Mock Providers for Testing
 * Simulates LLM providers without making real API calls
 */

import { ITextProvider, TextGenerateOptions, ModelCapabilities } from '../../src/domain/interfaces/ITextProvider.js';
import { LLMResponse } from '../../src/domain/entities/Response.js';
import { MessageRole, OutputItem } from '../../src/domain/entities/Message.js';
import { ContentType } from '../../src/domain/entities/Content.js';
import { StreamEvent, StreamEventType } from '../../src/domain/entities/StreamEvent.js';
import { ProviderRateLimitError, ProviderError } from '../../src/domain/errors/AIErrors.js';

/**
 * Error simulation configuration for realistic testing
 */
export interface MockErrorConfig {
  /** Return invalid JSON in tool arguments */
  malformedJson?: boolean;
  /** Use a tool name that doesn't exist in the registry */
  unknownToolName?: string;
  /** Return tool call with undefined/missing arguments */
  missingArguments?: boolean;
  /** Throw a network error */
  networkError?: boolean;
  /** Throw a rate limit error */
  rateLimitError?: boolean;
  /** Return empty output array */
  emptyResponse?: boolean;
  /** Return response with no content in message */
  emptyContent?: boolean;
  /** Custom error to throw */
  customError?: Error;
  /** Delay before responding (ms) */
  delay?: number;
}

export class MockTextProvider implements ITextProvider {
  name = 'mock';
  capabilities = { text: true, images: false, videos: false, audio: false };

  private responses: LLMResponse[] = [];
  private callIndex = 0;
  public lastRequest: TextGenerateOptions | null = null;
  public callCount = 0;

  /** Error simulation configuration */
  private errorConfig: MockErrorConfig | null = null;
  /** Per-call error configs for sequence testing */
  private errorSequence: (MockErrorConfig | null)[] = [];

  setResponse(response: Partial<LLMResponse>) {
    this.responses = [this.buildResponse(response)];
    this.callIndex = 0;
  }

  setResponseSequence(responses: Partial<LLMResponse>[]) {
    this.responses = responses.map(r => this.buildResponse(r));
    this.callIndex = 0;
  }

  /**
   * Configure error simulation for the next call(s)
   * @param config Error configuration to simulate
   */
  setErrorSimulation(config: MockErrorConfig | null): void {
    this.errorConfig = config;
  }

  /**
   * Configure error simulation sequence (per-call)
   * @param sequence Array of error configs (null = no error for that call)
   */
  setErrorSequence(sequence: (MockErrorConfig | null)[]): void {
    this.errorSequence = sequence;
  }

  async generate(options: TextGenerateOptions): Promise<LLMResponse> {
    this.lastRequest = options;
    this.callCount++;

    // Get error config for this call (callIndex is 0-based at this point)
    const errorConfig = this.errorSequence[this.callIndex] ?? this.errorConfig;

    // Simulate delay if configured
    if (errorConfig?.delay) {
      await new Promise(resolve => setTimeout(resolve, errorConfig.delay));
    }

    // Simulate network error
    if (errorConfig?.networkError) {
      throw new Error('Network error: Connection refused');
    }

    // Simulate rate limit error
    if (errorConfig?.rateLimitError) {
      throw new ProviderRateLimitError('mock', 60);
    }

    // Simulate custom error
    if (errorConfig?.customError) {
      throw errorConfig.customError;
    }

    if (this.responses.length === 0) {
      throw new Error('MockTextProvider: No responses configured. Call setResponse() first.');
    }

    const response = this.responses[this.callIndex] || this.responses[this.responses.length - 1];
    this.callIndex++;

    // Apply error transformations to response
    return this.applyErrorTransformations(response, errorConfig);
  }

  /**
   * Apply error transformations to response based on config
   */
  private applyErrorTransformations(response: LLMResponse, errorConfig: MockErrorConfig | null): LLMResponse {
    if (!errorConfig) return response;

    // Return empty response
    if (errorConfig.emptyResponse) {
      return { ...response, output: [] };
    }

    // Return empty content in message
    if (errorConfig.emptyContent) {
      return {
        ...response,
        output: [{
          type: 'message',
          id: 'mock_msg',
          role: MessageRole.ASSISTANT,
          content: []
        }]
      };
    }

    // Transform tool calls if any
    const transformedOutput = response.output.map(item => {
      if (item.type !== 'message' || item.role !== MessageRole.ASSISTANT) {
        return item;
      }

      const transformedContent = item.content.map(content => {
        if (content.type !== ContentType.TOOL_USE) {
          return content;
        }

        // Malformed JSON in tool arguments
        if (errorConfig.malformedJson) {
          return {
            ...content,
            arguments: '{ invalid json: "missing quotes }'
          };
        }

        // Unknown tool name
        if (errorConfig.unknownToolName) {
          return {
            ...content,
            name: errorConfig.unknownToolName
          };
        }

        // Missing arguments
        if (errorConfig.missingArguments) {
          return {
            ...content,
            arguments: undefined as any
          };
        }

        return content;
      });

      return { ...item, content: transformedContent };
    });

    return { ...response, output: transformedOutput };
  }

  async *streamGenerate(options: TextGenerateOptions): AsyncIterableIterator<StreamEvent> {
    this.lastRequest = options;
    this.callCount++;

    // Simple mock streaming - just yield response created and complete
    yield {
      type: StreamEventType.RESPONSE_CREATED,
      response_id: 'mock_response_id',
      model: options.model,
    };

    yield {
      type: StreamEventType.OUTPUT_TEXT_DELTA,
      response_id: 'mock_response_id',
      delta: 'Mock response',
    };

    yield {
      type: StreamEventType.RESPONSE_COMPLETE,
      response_id: 'mock_response_id',
      status: 'completed',
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    };
  }

  getModelCapabilities(model: string): ModelCapabilities {
    return {
      supportsTools: true,
      supportsVision: true,
      supportsJSON: true,
      supportsJSONSchema: true,
      maxTokens: 100000,
      maxOutputTokens: 4096,
    };
  }

  private buildResponse(partial: Partial<LLMResponse>): LLMResponse {
    const output: OutputItem[] = partial.output || [{
      type: 'message',
      id: 'mock_msg_id',
      role: MessageRole.ASSISTANT,
      content: partial.text ? [{
        type: ContentType.OUTPUT_TEXT,
        text: partial.text,
        annotations: []
      }] : []
    }];

    return {
      id: partial.id || 'mock_response_id',
      object: 'response',
      created_at: Math.floor(Date.now() / 1000),
      model: partial.model || 'mock-model',
      status: partial.status || 'completed',
      output,
      output_text: partial.text,
      usage: partial.usage || {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15
      }
    };
  }

  reset() {
    this.callIndex = 0;
    this.callCount = 0;
    this.lastRequest = null;
    this.errorConfig = null;
    this.errorSequence = [];
  }
}

export class MockToolExecutor {
  private tools = new Map<string, (args: any) => Promise<any>>();
  private callCounts = new Map<string, number>();
  private callHistory: Array<{ toolName: string; args: any; timestamp: number }> = [];

  registerTool(name: string, fn: (args: any) => Promise<any>) {
    this.tools.set(name, fn);
    this.callCounts.set(name, 0);
  }

  async execute(toolName: string, args: any): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    this.callCounts.set(toolName, (this.callCounts.get(toolName) || 0) + 1);
    this.callHistory.push({ toolName, args, timestamp: Date.now() });

    return await tool(args);
  }

  getCallCount(toolName: string): number {
    return this.callCounts.get(toolName) || 0;
  }

  getCallHistory(): Array<{ toolName: string; args: any; timestamp: number }> {
    return [...this.callHistory];
  }

  reset() {
    this.callCounts.clear();
    this.callHistory = [];
  }

  clear() {
    this.tools.clear();
    this.reset();
  }
}
