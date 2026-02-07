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
  inputTokens?: number;
  outputTokens?: number;
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

    const inputTokens = response.inputTokens ?? 100;
    const outputTokens = response.outputTokens ?? 50;

    // Aggregate text output for SDK convenience
    const outputText = response.text || '';

    return {
      output: [outputItem],
      output_text: outputText,
      stopReason: response.stopReason || (response.toolCalls ? 'tool_use' : 'end_turn'),
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
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

/**
 * Helper to create context_stats tool call
 */
export function mockContextStats(sections?: ('budget' | 'breakdown' | 'memory' | 'cache' | 'all')[]): MockToolCall {
  return {
    name: 'context_stats',
    arguments: sections ? { sections } : {},
  };
}

/**
 * Helper to create context_set tool call
 */
export function mockContextSet(
  key: string,
  description: string,
  value: unknown,
  priority?: 'low' | 'normal' | 'high' | 'critical'
): MockToolCall {
  return {
    name: 'context_set',
    arguments: priority ? { key, description, value, priority } : { key, description, value },
  };
}

/**
 * Helper to create context_delete tool call
 */
export function mockContextDelete(key: string): MockToolCall {
  return {
    name: 'context_delete',
    arguments: { key },
  };
}

/**
 * Helper to create context_list tool call
 */
export function mockContextList(): MockToolCall {
  return {
    name: 'context_list',
    arguments: {},
  };
}

/**
 * Helper to create memory_delete tool call
 */
export function mockMemoryDelete(key: string): MockToolCall {
  return {
    name: 'memory_delete',
    arguments: { key },
  };
}

/**
 * Helper to create memory_cleanup_raw tool call
 */
export function mockMemoryCleanupRaw(): MockToolCall {
  return {
    name: 'memory_cleanup_raw',
    arguments: {},
  };
}

/**
 * Helper to create instructions_set tool call
 */
export function mockInstructionsSet(key: string, content: string): MockToolCall {
  return {
    name: 'instructions_set',
    arguments: { key, content },
  };
}

/**
 * Helper to create instructions_remove tool call
 */
export function mockInstructionsRemove(key: string): MockToolCall {
  return {
    name: 'instructions_remove',
    arguments: { key },
  };
}

/**
 * Helper to create instructions_list tool call
 */
export function mockInstructionsList(): MockToolCall {
  return {
    name: 'instructions_list',
    arguments: {},
  };
}

/**
 * Helper to create instructions_clear tool call
 */
export function mockInstructionsClear(): MockToolCall {
  return {
    name: 'instructions_clear',
    arguments: {},
  };
}

/**
 * Helper to create a text response with custom token counts
 */
export function mockTextResponseWithTokens(
  text: string,
  inputTokens: number,
  outputTokens: number
): MockResponse {
  return {
    text,
    stopReason: 'end_turn',
    inputTokens,
    outputTokens,
  };
}

/**
 * Helper to create a tool call response with custom token counts
 */
export function mockToolResponseWithTokens(
  inputTokens: number,
  outputTokens: number,
  ...toolCalls: MockToolCall[]
): MockResponse {
  return {
    toolCalls,
    stopReason: 'tool_use',
    inputTokens,
    outputTokens,
  };
}
