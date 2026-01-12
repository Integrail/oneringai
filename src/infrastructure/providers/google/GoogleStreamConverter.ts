/**
 * Google Gemini stream converter - converts Google streaming responses to our unified StreamEvent format
 */

import { randomUUID } from 'crypto';
import { GenerateContentResponse } from '@google/genai';
import { StreamEvent, StreamEventType } from '../../../domain/entities/StreamEvent.js';

/**
 * Converts Google Gemini streaming responses to our unified StreamEvent format
 */
export class GoogleStreamConverter {
  private responseId: string = '';
  private model: string = '';
  private sequenceNumber: number = 0;
  private isFirst: boolean = true;
  private toolCallBuffers: Map<string, { name: string; args: string }> = new Map();

  /**
   * Convert Google stream to our StreamEvent format
   */
  async *convertStream(
    googleStream: AsyncIterable<GenerateContentResponse>,
    model: string
  ): AsyncIterableIterator<StreamEvent> {
    this.model = model;
    this.sequenceNumber = 0;
    this.isFirst = true;
    this.toolCallBuffers.clear();

    let lastUsage: { input_tokens: number; output_tokens: number; total_tokens: number } = {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    };

    for await (const chunk of googleStream) {
      if (this.isFirst) {
        this.responseId = this.generateResponseId();
        yield {
          type: StreamEventType.RESPONSE_CREATED,
          response_id: this.responseId,
          model: this.model,
          created_at: Date.now(),
        };
        this.isFirst = false;
      }

      // Extract usage from chunk (Google includes it in every chunk)
      const usage = this.extractUsage(chunk);
      if (usage) {
        lastUsage = usage;
      }

      const events = this.convertChunk(chunk);
      for (const event of events) {
        yield event;
      }
    }

    // Emit completion for any pending tool calls
    if (this.toolCallBuffers.size > 0) {
      for (const [toolCallId, buffer] of this.toolCallBuffers) {
        yield {
          type: StreamEventType.TOOL_CALL_ARGUMENTS_DONE,
          response_id: this.responseId,
          tool_call_id: toolCallId,
          tool_name: buffer.name,
          arguments: buffer.args,
        };
      }
    }

    // Final completion event with actual usage
    yield {
      type: StreamEventType.RESPONSE_COMPLETE,
      response_id: this.responseId,
      status: 'completed',
      usage: lastUsage,
      iterations: 1,
    };
  }

  /**
   * Extract usage from Google chunk
   */
  private extractUsage(chunk: GenerateContentResponse): { input_tokens: number; output_tokens: number; total_tokens: number } | null {
    const usage = chunk.usageMetadata;
    if (!usage) return null;

    return {
      input_tokens: usage.promptTokenCount || 0,
      output_tokens: usage.candidatesTokenCount || 0,
      total_tokens: usage.totalTokenCount || 0,
    };
  }

  /**
   * Convert single Google chunk to our event(s)
   */
  private convertChunk(chunk: GenerateContentResponse): StreamEvent[] {
    const events: StreamEvent[] = [];

    const candidate = chunk.candidates?.[0];
    if (!candidate?.content?.parts) return events;

    for (const part of candidate.content.parts) {
      if (part.text) {
        // Text delta
        events.push({
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          response_id: this.responseId,
          item_id: `msg_${this.responseId}`,
          output_index: 0,
          content_index: 0,
          delta: part.text,
          sequence_number: this.sequenceNumber++,
        });
      } else if (part.functionCall) {
        // Function call (tool use)
        const functionCall = part.functionCall;
        const toolName = functionCall.name || 'unknown';
        const toolCallId = `call_${this.responseId}_${toolName}`;

        // Check if this is a new tool call
        if (!this.toolCallBuffers.has(toolCallId)) {
          this.toolCallBuffers.set(toolCallId, {
            name: toolName,
            args: '',
          });

          events.push({
            type: StreamEventType.TOOL_CALL_START,
            response_id: this.responseId,
            item_id: `msg_${this.responseId}`,
            tool_call_id: toolCallId,
            tool_name: toolName,
          });
        }

        // Convert args object to JSON string
        if (functionCall.args) {
          const argsJson = JSON.stringify(functionCall.args);
          const buffer = this.toolCallBuffers.get(toolCallId)!;

          // Check if this is new content (Google sends complete args each time)
          if (argsJson !== buffer.args) {
            const delta = argsJson.slice(buffer.args.length);
            buffer.args = argsJson;

            if (delta) {
              events.push({
                type: StreamEventType.TOOL_CALL_ARGUMENTS_DELTA,
                response_id: this.responseId,
                item_id: `msg_${this.responseId}`,
                tool_call_id: toolCallId,
                tool_name: toolName,
                delta,
                sequence_number: this.sequenceNumber++,
              });
            }
          }
        }
      }
    }

    return events;
  }

  /**
   * Generate unique response ID using cryptographically secure UUID
   */
  private generateResponseId(): string {
    return `resp_google_${randomUUID()}`;
  }

  /**
   * Clear all internal state
   * Should be called after each stream completes to prevent memory leaks
   */
  clear(): void {
    this.responseId = '';
    this.model = '';
    this.sequenceNumber = 0;
    this.isFirst = true;
    this.toolCallBuffers.clear();
  }

  /**
   * Reset converter state for a new stream
   * Alias for clear()
   */
  reset(): void {
    this.clear();
  }
}
