import {
  StreamEventType,
  type StreamEvent,
} from '../../../domain/entities/StreamEvent.js';

type WireObject = Record<string, any>;

interface ToolBuffer {
  id: string;
  name: string;
  arguments: string;
  started: boolean;
}

function statusFromFinishReason(
  reason: string | null | undefined,
): 'completed' | 'incomplete' | 'failed' {
  if (reason === 'length') return 'incomplete';
  if (reason === 'content_filter' || reason === 'insufficient_system_resource') return 'failed';
  return 'completed';
}

export class DeepSeekChatStreamConverter {
  async *convertStream(
    stream: AsyncIterable<WireObject>,
    requestedModel: string,
  ): AsyncIterableIterator<StreamEvent> {
    let responseId = '';
    let created = Math.floor(Date.now() / 1000);
    let sequence = 0;
    let emittedCreated = false;
    let finishReason: string | null | undefined;
    let usage: WireObject = {};
    let reasoning = '';
    const tools = new Map<number, ToolBuffer>();

    for await (const chunk of stream) {
      responseId = chunk.id ?? responseId;
      created = chunk.created ?? created;
      if (!emittedCreated) {
        emittedCreated = true;
        yield {
          type: StreamEventType.RESPONSE_CREATED,
          response_id: responseId || `deepseek_${created}`,
          model: requestedModel,
          created_at: created,
        };
      }

      if (chunk.usage) usage = chunk.usage;
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
        finishReason = choice.finish_reason;
      }
      const delta = choice.delta ?? {};
      const reasoningDelta = delta.reasoning_content ?? delta.reasoning;
      if (typeof reasoningDelta === 'string' && reasoningDelta) {
        reasoning += reasoningDelta;
        yield {
          type: StreamEventType.REASONING_DELTA,
          response_id: responseId,
          item_id: `reasoning_${responseId}`,
          delta: reasoningDelta,
          sequence_number: sequence++,
        };
      }
      if (typeof delta.content === 'string' && delta.content) {
        yield {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          response_id: responseId,
          item_id: `message_${responseId}`,
          output_index: 0,
          content_index: 0,
          delta: delta.content,
          sequence_number: sequence++,
        };
      }

      for (const callDelta of delta.tool_calls ?? []) {
        const index = callDelta.index ?? 0;
        const existing = tools.get(index) ?? {
          id: callDelta.id ?? `call_${responseId}_${index}`,
          name: '',
          arguments: '',
          started: false,
        };
        if (callDelta.id) existing.id = callDelta.id;
        if (callDelta.function?.name) existing.name += callDelta.function.name;
        if (!existing.started && existing.name) {
          existing.started = true;
          yield {
            type: StreamEventType.TOOL_CALL_START,
            response_id: responseId,
            item_id: `tool_${existing.id}`,
            tool_call_id: existing.id,
            tool_name: existing.name,
          };
        }
        const argsDelta = callDelta.function?.arguments ?? '';
        if (argsDelta) {
          existing.arguments += argsDelta;
          yield {
            type: StreamEventType.TOOL_CALL_ARGUMENTS_DELTA,
            response_id: responseId,
            item_id: `tool_${existing.id}`,
            tool_call_id: existing.id,
            tool_name: existing.name,
            delta: argsDelta,
            sequence_number: sequence++,
          };
        }
        tools.set(index, existing);
      }
    }

    if (!emittedCreated) {
      responseId = `deepseek_${created}`;
      yield {
        type: StreamEventType.RESPONSE_CREATED,
        response_id: responseId,
        model: requestedModel,
        created_at: created,
      };
    }
    if (reasoning) {
      yield {
        type: StreamEventType.REASONING_DONE,
        response_id: responseId,
        item_id: `reasoning_${responseId}`,
        thinking: reasoning,
      };
    }
    for (const tool of tools.values()) {
      yield {
        type: StreamEventType.TOOL_CALL_ARGUMENTS_DONE,
        response_id: responseId,
        tool_call_id: tool.id,
        tool_name: tool.name,
        arguments: tool.arguments,
      };
    }
    yield {
      type: StreamEventType.RESPONSE_COMPLETE,
      response_id: responseId,
      status: statusFromFinishReason(finishReason),
      stop_reason: finishReason ?? undefined,
      usage: {
        input_tokens: usage.prompt_tokens ?? 0,
        output_tokens: usage.completion_tokens ?? 0,
        total_tokens: usage.total_tokens ??
          ((usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)),
        ...((usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details?.cached_tokens) !== undefined && {
          cached_input_tokens:
            usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details.cached_tokens,
        }),
        ...(usage.completion_tokens_details?.reasoning_tokens !== undefined && {
          output_tokens_details: {
            reasoning_tokens: usage.completion_tokens_details.reasoning_tokens,
          },
        }),
      },
      iterations: 1,
    };
  }
}
