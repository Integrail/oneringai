/**
 * Anthropic Stream Converter - Converts Anthropic SSE events to our unified StreamEvent format
 *
 * Extends BaseStreamConverter for common patterns:
 * - State management (response ID, sequence numbers)
 * - Tool call buffering
 * - Usage tracking
 * - Resource cleanup
 */

import Anthropic from '@anthropic-ai/sdk';
import { StreamEvent } from '../../../domain/entities/StreamEvent.js';
import { BaseStreamConverter } from '../base/BaseStreamConverter.js';

/**
 * Block info tracked during streaming
 */
interface ContentBlockInfo {
  type: string;
  id?: string;
  name?: string;
}

/**
 * Converts Anthropic streaming events to our unified StreamEvent format
 */
export class AnthropicStreamConverter extends BaseStreamConverter<Anthropic.MessageStreamEvent> {
  readonly providerName = 'anthropic';

  /** Map of content block index to block info */
  private contentBlockIndex: Map<number, ContentBlockInfo> = new Map();

  /**
   * Convert a single Anthropic event to our StreamEvent(s)
   */
  protected convertEvent(event: Anthropic.MessageStreamEvent): StreamEvent[] {
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
   * Clear all internal state
   */
  override clear(): void {
    super.clear();
    this.contentBlockIndex.clear();
  }

  // ==========================================================================
  // Anthropic-Specific Event Handlers
  // ==========================================================================

  /**
   * Handle message_start event
   */
  private handleMessageStart(event: Anthropic.MessageStartEvent): StreamEvent[] {
    this.responseId = event.message.id;

    // Capture input_tokens from message_start (only place it's available)
    if (event.message.usage) {
      this.updateUsage(event.message.usage.input_tokens, undefined);
    }

    return [this.emitResponseCreated(this.responseId)];
  }

  /**
   * Handle content_block_start event
   */
  private handleContentBlockStart(event: Anthropic.ContentBlockStartEvent): StreamEvent[] {
    const index = event.index;
    const block = event.content_block;

    // Track block type
    if (block.type === 'thinking') {
      this.contentBlockIndex.set(index, { type: 'thinking' });
      return []; // No event needed, thinking will come in deltas
    } else if (block.type === 'text') {
      this.contentBlockIndex.set(index, { type: 'text' });
      return []; // No event needed, text will come in deltas
    } else if (block.type === 'tool_use') {
      this.contentBlockIndex.set(index, {
        type: 'tool_use',
        id: block.id,
        name: block.name,
      });

      return [this.emitToolCallStart(block.id, block.name, `msg_${this.responseId}`)];
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

    if (delta.type === 'thinking_delta') {
      // Anthropic thinking delta
      const thinkingDelta = delta as { type: 'thinking_delta'; thinking: string };
      return [
        this.emitReasoningDelta(thinkingDelta.thinking || '', `thinking_${this.responseId}`),
      ];
    } else if (delta.type === 'text_delta') {
      return [
        this.emitTextDelta(delta.text, {
          itemId: `msg_${this.responseId}`,
          contentIndex: index,
        }),
      ];
    } else if (delta.type === 'input_json_delta') {
      const toolCallId = blockInfo.id || '';
      return [this.emitToolCallArgsDelta(toolCallId, delta.partial_json, blockInfo.name)];
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

    // If this was a thinking block, emit reasoning done
    if (blockInfo.type === 'thinking') {
      return [this.emitReasoningDone(`thinking_${this.responseId}`)];
    }

    // If this was a tool use block, emit arguments done
    if (blockInfo.type === 'tool_use') {
      return [this.emitToolCallArgsDone(blockInfo.id || '', blockInfo.name)];
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
      this.updateUsage(undefined, event.usage.output_tokens);
    }

    // No events to emit - we'll include usage in message_stop
    return [];
  }

  /**
   * Handle message_stop event (final event)
   */
  private handleMessageStop(): StreamEvent[] {
    return [this.emitResponseComplete('completed')];
  }
}
