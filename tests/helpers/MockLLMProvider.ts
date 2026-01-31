/**
 * MockLLMProvider - Deterministic LLM for testing
 *
 * Allows tests to control exact LLM responses and tool calls
 */

import { ITextProvider } from '@/domain/interfaces/ITextProvider.js';
import { TextGenerateOptions, TextStreamOptions } from '@/domain/interfaces/ITextProvider.js';
import { LLMResponse } from '@/domain/entities/Response.js';
import { OutputItem } from '@/domain/entities/Message.js';
import { ToolCall } from '@/domain/entities/Tool.js';

export interface MockToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MockResponse {
  text?: string;
  toolCalls?: MockToolCall[];
  stopReason?: 'end_turn' | 'tool_use' | 'max_tokens';
}

/**
 * Mock LLM Provider for deterministic testing
 */
export class MockLLMProvider implements ITextProvider {
  readonly name = 'mock';
  private responseQueue: MockResponse[] = [];
  private callCount = 0;
  public capturedCalls: Array<{
    messages: any[];
    options: TextGenerateOptions;
  }> = [];

  /**
   * Queue responses to return in order
   */
  queueResponses(responses: MockResponse[]): void {
    this.responseQueue = [...responses];
    this.callCount = 0;
  }

  /**
   * Queue a single response
   */
  queueResponse(response: MockResponse): void {
    this.responseQueue.push(response);
  }

  /**
   * Reset the mock
   */
  reset(): void {
    this.responseQueue = [];
    this.callCount = 0;
    this.capturedCalls = [];
  }

  async generate(
    messages: any[],
    options: TextGenerateOptions
  ): Promise<LLMResponse> {
    // Capture the call
    this.capturedCalls.push({ messages, options });

    // Get next response from queue
    const response = this.responseQueue[this.callCount] || {
      text: 'Mock response',
      stopReason: 'end_turn',
    };
    this.callCount++;

    // Build output item
    const outputItem: OutputItem = {
      type: 'message',
      role: 'assistant',
      content: [],
    };

    // Add text if present
    if (response.text) {
      outputItem.content.push({
        type: 'text',
        text: response.text,
      });
    }

    // Add tool calls if present
    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const tc of response.toolCalls) {
        const toolCall: ToolCall = {
          type: 'function',
          id: `call_${Date.now()}_${Math.random()}`,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        };
        outputItem.content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: JSON.stringify(tc.arguments), // Must be JSON string, not object
        });
      }
    }

    return {
      output: [outputItem],
      stopReason: response.stopReason || (response.toolCalls ? 'tool_use' : 'end_turn'),
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      },
    };
  }

  async *stream(
    messages: any[],
    options: TextStreamOptions
  ): AsyncIterable<any> {
    // Simple stream implementation - just yield the full response
    const response = await this.generate(messages, options);

    for (const item of response.output) {
      yield {
        type: 'output_item',
        outputItem: item,
      };
    }

    yield {
      type: 'message_complete',
      stopReason: response.stopReason,
    };
  }

  /**
   * Get number of generate calls made
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Get the last captured call
   */
  getLastCall(): { messages: any[]; options: TextGenerateOptions } | undefined {
    return this.capturedCalls[this.capturedCalls.length - 1];
  }
}

/**
 * Helper to create memory_store tool call
 */
export function mockMemoryStore(key: string, description: string, value: unknown): MockToolCall {
  return {
    name: 'memory_store',
    arguments: { key, description, value },
  };
}

/**
 * Helper to create memory_retrieve tool call
 */
export function mockMemoryRetrieve(key: string): MockToolCall {
  return {
    name: 'memory_retrieve',
    arguments: { key },
  };
}

/**
 * Helper to create memory_query tool call
 */
export function mockMemoryQuery(): MockToolCall {
  return {
    name: 'memory_query',
    arguments: {},
  };
}

/**
 * Helper to create a text response
 */
export function mockTextResponse(text: string): MockResponse {
  return {
    text,
    stopReason: 'end_turn',
  };
}

/**
 * Helper to create a tool call response
 */
export function mockToolResponse(...toolCalls: MockToolCall[]): MockResponse {
  return {
    toolCalls,
    stopReason: 'tool_use',
  };
}
