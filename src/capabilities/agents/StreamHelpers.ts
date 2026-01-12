/**
 * Stream helper utilities for consuming and processing streaming events
 */

import {
  StreamEvent,
  StreamEventType,
  isOutputTextDelta,
} from '../../domain/entities/StreamEvent.js';
import { StreamState } from '../../domain/entities/StreamState.js';
import { LLMResponse, OutputItem } from '../../domain/entities/Response.js';
import { MessageRole } from '../../domain/entities/Message.js';
import { ContentType } from '../../domain/entities/Content.js';

/**
 * Helper class for consuming and processing streams
 */
export class StreamHelpers {
  /**
   * Collect complete response from stream
   * Accumulates all events and reconstructs final LLMResponse
   */
  static async collectResponse(
    stream: AsyncIterableIterator<StreamEvent>
  ): Promise<LLMResponse> {
    let state: StreamState | null = null;

    for await (const event of stream) {
      // Initialize state on first event
      if (!state && event.type === StreamEventType.RESPONSE_CREATED) {
        state = new StreamState(event.response_id, event.model, event.created_at);
      }

      if (!state) continue;

      // Update state from events
      this.updateStateFromEvent(state, event);
    }

    if (!state) {
      throw new Error('No stream events received');
    }

    return this.reconstructLLMResponse(state);
  }

  /**
   * Get only text deltas from stream (for simple text streaming)
   * Filters out all other event types
   */
  static async *textOnly(
    stream: AsyncIterableIterator<StreamEvent>
  ): AsyncIterableIterator<string> {
    for await (const event of stream) {
      if (isOutputTextDelta(event)) {
        yield event.delta;
      }
    }
  }

  /**
   * Filter stream events by type
   */
  static async *filterByType<T extends StreamEvent>(
    stream: AsyncIterableIterator<StreamEvent>,
    eventType: StreamEventType
  ): AsyncIterableIterator<T> {
    for await (const event of stream) {
      if (event.type === eventType) {
        yield event as T;
      }
    }
  }

  /**
   * Accumulate text from stream into a single string
   */
  static async accumulateText(
    stream: AsyncIterableIterator<StreamEvent>
  ): Promise<string> {
    const chunks: string[] = [];

    for await (const event of stream) {
      if (isOutputTextDelta(event)) {
        chunks.push(event.delta);
      }
    }

    return chunks.join('');
  }

  /**
   * Buffer stream events into batches
   */
  static async *bufferEvents(
    stream: AsyncIterableIterator<StreamEvent>,
    batchSize: number
  ): AsyncIterableIterator<StreamEvent[]> {
    let buffer: StreamEvent[] = [];

    for await (const event of stream) {
      buffer.push(event);

      if (buffer.length >= batchSize) {
        yield buffer;
        buffer = [];
      }
    }

    // Yield remaining events
    if (buffer.length > 0) {
      yield buffer;
    }
  }

  /**
   * Tap into stream without consuming it
   * Useful for logging or side effects
   */
  static async *tap(
    stream: AsyncIterableIterator<StreamEvent>,
    callback: (event: StreamEvent) => void | Promise<void>
  ): AsyncIterableIterator<StreamEvent> {
    for await (const event of stream) {
      await callback(event);
      yield event;
    }
  }

  /**
   * Take first N events from stream
   */
  static async *take(
    stream: AsyncIterableIterator<StreamEvent>,
    count: number
  ): AsyncIterableIterator<StreamEvent> {
    let taken = 0;

    for await (const event of stream) {
      if (taken >= count) break;
      yield event;
      taken++;
    }
  }

  /**
   * Skip first N events from stream
   */
  static async *skip(
    stream: AsyncIterableIterator<StreamEvent>,
    count: number
  ): AsyncIterableIterator<StreamEvent> {
    let skipped = 0;

    for await (const event of stream) {
      if (skipped < count) {
        skipped++;
        continue;
      }
      yield event;
    }
  }

  /**
   * Update StreamState from event
   * @private
   */
  private static updateStateFromEvent(state: StreamState, event: StreamEvent): void {
    switch (event.type) {
      case StreamEventType.OUTPUT_TEXT_DELTA:
        state.accumulateTextDelta(event.item_id, event.delta);
        break;

      case StreamEventType.TOOL_CALL_START:
        state.startToolCall(event.tool_call_id, event.tool_name);
        break;

      case StreamEventType.TOOL_CALL_ARGUMENTS_DELTA:
        state.accumulateToolArguments(event.tool_call_id, event.delta);
        break;

      case StreamEventType.TOOL_CALL_ARGUMENTS_DONE:
        state.completeToolCall(event.tool_call_id);
        break;

      case StreamEventType.TOOL_EXECUTION_DONE:
        state.setToolResult(event.tool_call_id, event.result);
        break;

      case StreamEventType.ITERATION_COMPLETE:
        state.incrementIteration();
        break;

      case StreamEventType.RESPONSE_COMPLETE:
        // Debug: Log usage when received
        if (process.env.DEBUG_STREAMING) {
          console.error('[DEBUG] RESPONSE_COMPLETE event:', event.usage);
        }
        state.updateUsage(event.usage);
        state.markComplete(event.status);
        break;
    }
  }

  /**
   * Reconstruct LLMResponse from StreamState
   * @private
   */
  private static reconstructLLMResponse(state: StreamState): LLMResponse {
    const output: OutputItem[] = [];

    // Add text messages
    if (state.hasText()) {
      const textContent = state.getAllText();
      if (textContent) {
        output.push({
          type: 'message' as const,
          role: MessageRole.ASSISTANT,
          content: [
            {
              type: ContentType.OUTPUT_TEXT,
              text: textContent,
            },
          ],
        });
      }
    }

    // Add tool calls to output
    const toolCalls = state.getCompletedToolCalls();
    if (toolCalls.length > 0) {
      // Tool calls should be part of assistant message content
      const toolUseContent = toolCalls.map((tc) => ({
        type: ContentType.TOOL_USE as const,
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

      const firstOutput = output[0];
      if (firstOutput && firstOutput.type === 'message') {
        // Append to existing message
        firstOutput.content.push(...toolUseContent);
      } else {
        // Create new message with tool calls
        output.push({
          type: 'message' as const,
          role: MessageRole.ASSISTANT,
          content: toolUseContent,
        });
      }
    }

    // Extract output text
    const outputText = this.extractOutputText(output);

    return {
      id: state.responseId,
      object: 'response',
      created_at: state.createdAt,
      status: state.status,
      model: state.model,
      output,
      output_text: outputText,
      usage: state.usage,
    };
  }

  /**
   * Extract text from output items
   * @private
   */
  private static extractOutputText(output: OutputItem[]): string {
    const texts: string[] = [];

    for (const item of output) {
      if (item.type === 'message') {
        for (const content of item.content) {
          if (content.type === ContentType.OUTPUT_TEXT) {
            texts.push(content.text);
          }
        }
      }
    }

    return texts.join(' ').trim();
  }
}
