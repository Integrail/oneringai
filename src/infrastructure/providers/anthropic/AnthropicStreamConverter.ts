/**
 * Anthropic stream converter - converts Anthropic SSE events to our unified StreamEvent format
 */

import Anthropic from '@anthropic-ai/sdk';
import { StreamEvent, StreamEventType } from '../../../domain/entities/StreamEvent.js';

/**
 * Converts Anthropic streaming events to our unified StreamEvent format
 */
export class AnthropicStreamConverter {
  private responseId: string = '';
  private model: string = '';
  private sequenceNumber: number = 0;
  private contentBlockIndex: Map<number, { type: string; id?: string; name?: string; accumulatedArgs?: string }> = new Map();
  private usage: { input_tokens: number; output_tokens: number } = { input_tokens: 0, output_tokens: 0 };

  /**
   * Convert Anthropic stream to our StreamEvent format
   */
  async *convertStream(
    anthropicStream: AsyncIterable<Anthropic.MessageStreamEvent>,
    model: string
  ): AsyncIterableIterator<StreamEvent> {
    this.model = model;
    this.sequenceNumber = 0;
    this.contentBlockIndex.clear();
    this.usage = { input_tokens: 0, output_tokens: 0 };

    for await (const event of anthropicStream) {
      const converted = this.convertEvent(event);
      if (converted) {
        for (const evt of converted) {
          yield evt;
        }
      }
    }
  }

  /**
   * Convert single Anthropic event to our event(s)
   */
  private convertEvent(event: Anthropic.MessageStreamEvent): StreamEvent[] {
    const eventType = event.type;

    switch (eventType) {
      case 'message_start':
        return this.handleMessageStart(event as Anthropic.MessageStartEvent);

      case 'content_block_start':
        return this.handleContentBlockStart(event as Anthropic.ContentBlockStartEvent);

      case 'content_block_delta':
        return this.handleContentBlockDelta(event as Anthropic.ContentBlockDeltaEvent);

      case 'content_block_stop':
        return this.handleContentBlockStop(event as Anthropic.ContentBlockStopEvent);

      case 'message_delta':
        return this.handleMessageDelta(event as Anthropic.MessageDeltaEvent);

      case 'message_stop':
        return this.handleMessageStop();

      default:
        // Handle ping and other event types
        return [];
    }
  }

  /**
   * Handle message_start event
   */
  private handleMessageStart(event: Anthropic.MessageStartEvent): StreamEvent[] {
    this.responseId = event.message.id;

    // Capture input_tokens from message_start (only place it's available)
    if (event.message.usage) {
      this.usage.input_tokens = event.message.usage.input_tokens || 0;
    }

    return [
      {
        type: StreamEventType.RESPONSE_CREATED,
        response_id: this.responseId,
        model: this.model,
        created_at: Date.now(),
      },
    ];
  }

  /**
   * Handle content_block_start event
   */
  private handleContentBlockStart(event: Anthropic.ContentBlockStartEvent): StreamEvent[] {
    const index = event.index;
    const block = event.content_block;

    // Track block type
    if (block.type === 'text') {
      this.contentBlockIndex.set(index, { type: 'text' });
      return []; // No event needed, text will come in deltas
    } else if (block.type === 'tool_use') {
      this.contentBlockIndex.set(index, {
        type: 'tool_use',
        id: block.id,
        name: block.name,
        accumulatedArgs: '', // Initialize args accumulator
      });

      return [
        {
          type: StreamEventType.TOOL_CALL_START,
          response_id: this.responseId,
          item_id: `msg_${this.responseId}`,
          tool_call_id: block.id,
          tool_name: block.name,
        },
      ];
    }

    return [];
  }

  /**
   * Handle content_block_delta event
   */
  private handleContentBlockDelta(event: Anthropic.ContentBlockDeltaEvent): StreamEvent[] {
    const index = event.index;
    const delta = event.delta;
    const blockInfo = this.contentBlockIndex.get(index);

    if (!blockInfo) return [];

    if (delta.type === 'text_delta') {
      return [
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          response_id: this.responseId,
          item_id: `msg_${this.responseId}`,
          output_index: 0,
          content_index: index,
          delta: delta.text,
          sequence_number: this.sequenceNumber++,
        },
      ];
    } else if (delta.type === 'input_json_delta') {
      // Accumulate tool arguments
      if (blockInfo.accumulatedArgs !== undefined) {
        blockInfo.accumulatedArgs += delta.partial_json;
      }

      // Tool arguments delta
      return [
        {
          type: StreamEventType.TOOL_CALL_ARGUMENTS_DELTA,
          response_id: this.responseId,
          item_id: `msg_${this.responseId}`,
          tool_call_id: blockInfo.id || '',
          tool_name: blockInfo.name || '',
          delta: delta.partial_json,
          sequence_number: this.sequenceNumber++,
        },
      ];
    }

    return [];
  }

  /**
   * Handle content_block_stop event
   */
  private handleContentBlockStop(event: Anthropic.ContentBlockStopEvent): StreamEvent[] {
    const index = event.index;
    const blockInfo = this.contentBlockIndex.get(index);

    if (!blockInfo) return [];

    // If this was a tool use block, emit arguments done
    if (blockInfo.type === 'tool_use') {
      return [
        {
          type: StreamEventType.TOOL_CALL_ARGUMENTS_DONE,
          response_id: this.responseId,
          tool_call_id: blockInfo.id || '',
          tool_name: blockInfo.name || '',
          arguments: blockInfo.accumulatedArgs || '{}', // Use accumulated args
        },
      ];
    }

    return [];
  }

  /**
   * Handle message_delta event (usage info, stop_reason)
   */
  private handleMessageDelta(event: Anthropic.MessageDeltaEvent): StreamEvent[] {
    // Extract usage info (Anthropic sends output_tokens in message_delta)
    // Note: input_tokens is only available in message_start, not in delta
    if (event.usage) {
      this.usage.output_tokens = event.usage.output_tokens || 0;
    }

    // No events to emit - we'll include usage in message_stop
    return [];
  }

  /**
   * Handle message_stop event (final event)
   */
  private handleMessageStop(): StreamEvent[] {
    return [
      {
        type: StreamEventType.RESPONSE_COMPLETE,
        response_id: this.responseId,
        status: 'completed',
        usage: {
          input_tokens: this.usage.input_tokens,
          output_tokens: this.usage.output_tokens,
          total_tokens: this.usage.input_tokens + this.usage.output_tokens,
        },
        iterations: 1,
      },
    ];
  }

  /**
   * Clear all internal state
   * Should be called after each stream completes to prevent memory leaks
   */
  clear(): void {
    this.responseId = '';
    this.model = '';
    this.sequenceNumber = 0;
    this.contentBlockIndex.clear();
    this.usage = { input_tokens: 0, output_tokens: 0 };
  }

  /**
   * Reset converter state for a new stream
   * Alias for clear()
   */
  reset(): void {
    this.clear();
  }
}
