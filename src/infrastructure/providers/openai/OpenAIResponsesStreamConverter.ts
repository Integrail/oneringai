/**
 * OpenAI Responses API Streaming Converter
 *
 * Converts streaming events from OpenAI's Responses API to our internal StreamEvent format.
 *
 * Responses API streaming events:
 * - response.created
 * - response.output_item.added
 * - response.output_item.content.added
 * - response.output_item.content.delta (text/arguments)
 * - response.output_item.done
 * - response.reasoning_text.delta / response.reasoning_text.done
 * - response.reasoning_summary_text.delta / response.reasoning_summary_text.done
 * - response.done
 */

import * as ResponsesAPI from 'openai/resources/responses/responses.js';
import { StreamEvent, StreamEventType, ReasoningDeltaEvent, ReasoningDoneEvent } from '../../../domain/entities/StreamEvent.js';

type ResponseStreamEvent = ResponsesAPI.ResponseStreamEvent;

export class OpenAIResponsesStreamConverter {
  /**
   * Convert Responses API stream to our StreamEvent format
   */
  async *convertStream(
    stream: AsyncIterable<ResponseStreamEvent>
  ): AsyncIterableIterator<StreamEvent> {
    let responseId = '';
    let sequenceNumber = 0;

    // Track active items and tool calls
    const activeItems = new Map<string, { type: string; toolCallId?: string; toolName?: string }>();
    const toolCallBuffers = new Map<string, { id: string; name: string; args: string }>();
    // Track reasoning content
    const reasoningBuffers = new Map<string, string[]>();
    // Track items that already emitted REASONING_DONE (avoid duplicates)
    const reasoningDoneEmitted = new Set<string>();

    for await (const event of stream) {
      // Debug logging
      if (process.env.DEBUG_OPENAI) {
        console.error('[DEBUG] Responses API event:', event.type);
      }

      switch (event.type) {
        case 'response.created': {
          responseId = event.response.id;
          yield {
            type: StreamEventType.RESPONSE_CREATED,
            response_id: responseId,
            model: event.response.model,
            created_at: event.response.created_at,
          };
          break;
        }

        case 'response.output_item.added': {
          const addedEvent = event as ResponsesAPI.ResponseOutputItemAddedEvent;
          const item = addedEvent.item;
          activeItems.set(addedEvent.output_index.toString(), {
            type: item.type,
          });

          // If it's a reasoning item, track it
          if (item.type === 'reasoning') {
            activeItems.set(addedEvent.output_index.toString(), {
              type: 'reasoning',
            });
            reasoningBuffers.set(addedEvent.output_index.toString(), []);
          }

          // If it's a function call, track it
          if (item.type === 'function_call') {
            const functionCall = item as ResponsesAPI.ResponseFunctionToolCall;
            const toolCallId = functionCall.call_id;
            const toolName = functionCall.name;

            activeItems.set(addedEvent.output_index.toString(), {
              type: 'function_call',
              toolCallId,
              toolName,
            });

            toolCallBuffers.set(toolCallId, {
              id: toolCallId,
              name: toolName,
              args: '',
            });

            yield {
              type: StreamEventType.TOOL_CALL_START,
              response_id: responseId,
              item_id: `item_${addedEvent.output_index}`,
              tool_call_id: toolCallId,
              tool_name: toolName,
            };
          }
          break;
        }

        case 'response.output_text.delta': {
          const textEvent = event as ResponsesAPI.ResponseTextDeltaEvent;
          yield {
            type: StreamEventType.OUTPUT_TEXT_DELTA,
            response_id: responseId,
            item_id: textEvent.item_id,
            output_index: textEvent.output_index,
            content_index: textEvent.content_index,
            delta: textEvent.delta || '',
            sequence_number: sequenceNumber++,
          };
          break;
        }

        case 'response.function_call_arguments.delta': {
          const argsEvent = event as ResponsesAPI.ResponseFunctionCallArgumentsDeltaEvent;
          const itemInfo = activeItems.get(argsEvent.output_index.toString());

          if (itemInfo?.toolCallId) {
            const buffer = toolCallBuffers.get(itemInfo.toolCallId);
            if (buffer) {
              buffer.args += argsEvent.delta || '';

              yield {
                type: StreamEventType.TOOL_CALL_ARGUMENTS_DELTA,
                response_id: responseId,
                item_id: argsEvent.item_id,
                tool_call_id: buffer.id,
                tool_name: buffer.name,
                delta: argsEvent.delta || '',
                sequence_number: sequenceNumber++,
              };
            }
          }
          break;
        }

        case 'response.reasoning_summary_text.delta':
        case 'response.reasoning_text.delta': {
          // Reasoning delta from OpenAI (both full reasoning text and summary)
          const reasoningEvent = event as {
            type: string;
            output_index?: number;
            item_id?: string;
            delta?: string;
          };
          const outputIdx = reasoningEvent.output_index?.toString();
          const buffer = outputIdx ? reasoningBuffers.get(outputIdx) : undefined;
          if (buffer) {
            buffer.push(reasoningEvent.delta || '');
          }

          yield {
            type: StreamEventType.REASONING_DELTA,
            response_id: responseId,
            item_id: reasoningEvent.item_id || `reasoning_${responseId}`,
            delta: reasoningEvent.delta || '',
            sequence_number: sequenceNumber++,
          } as ReasoningDeltaEvent;
          break;
        }

        case 'response.reasoning_text.done': {
          // Full reasoning text completed — emit reasoning done
          const doneEvent = event as ResponsesAPI.ResponseReasoningTextDoneEvent;
          const outputIdx = doneEvent.output_index.toString();
          const rBuf = reasoningBuffers.get(outputIdx);
          const thinkingText = rBuf ? rBuf.join('') : doneEvent.text || '';
          reasoningDoneEmitted.add(outputIdx);

          yield {
            type: StreamEventType.REASONING_DONE,
            response_id: responseId,
            item_id: doneEvent.item_id || `reasoning_${responseId}`,
            thinking: thinkingText,
          } as ReasoningDoneEvent;
          break;
        }

        case 'response.output_item.done': {
          const doneEvent = event as ResponsesAPI.ResponseOutputItemDoneEvent;
          const item = doneEvent.item;

          // If reasoning item is done, emit reasoning done (only if not already emitted by reasoning_text.done)
          if (item.type === 'reasoning') {
            const outputIdx = doneEvent.output_index.toString();
            if (!reasoningDoneEmitted.has(outputIdx)) {
              const rBuf = reasoningBuffers.get(outputIdx);
              const thinkingText = rBuf ? rBuf.join('') : '';

              yield {
                type: StreamEventType.REASONING_DONE,
                response_id: responseId,
                item_id: (item as any).id || `reasoning_${responseId}`,
                thinking: thinkingText,
              } as ReasoningDoneEvent;
            }
          }

          // If function call is done, emit arguments complete
          if (item.type === 'function_call') {
            const functionCall = item as ResponsesAPI.ResponseFunctionToolCall;
            const buffer = toolCallBuffers.get(functionCall.call_id);

            if (buffer) {
              yield {
                type: StreamEventType.TOOL_CALL_ARGUMENTS_DONE,
                response_id: responseId,
                tool_call_id: buffer.id,
                tool_name: buffer.name,
                arguments: buffer.args || functionCall.arguments,
              };
            }
          }
          break;
        }

        case 'response.completed': {
          const completedEvent = event as ResponsesAPI.ResponseCompletedEvent;
          const response = completedEvent.response;

          // Map ResponseStatus to our status type
          let status: 'completed' | 'failed' | 'incomplete' = 'completed';
          if (response.status === 'failed') {
            status = 'failed';
          } else if (response.status === 'incomplete') {
            status = 'incomplete';
          }

          yield {
            type: StreamEventType.RESPONSE_COMPLETE,
            response_id: responseId,
            status,
            usage: {
              input_tokens: response.usage?.input_tokens || 0,
              output_tokens: response.usage?.output_tokens || 0,
              total_tokens: response.usage?.total_tokens || 0,
              ...((response.usage as any)?.output_tokens_details?.reasoning_tokens != null && {
                output_tokens_details: {
                  reasoning_tokens: (response.usage as any).output_tokens_details.reasoning_tokens,
                },
              }),
            },
            iterations: 1,
          };
          break;
        }

        // Handle other event types if needed
        default:
          if (process.env.DEBUG_OPENAI) {
            console.error('[DEBUG] Unhandled Responses API event type:', (event as any).type);
          }
      }
    }
  }
}
