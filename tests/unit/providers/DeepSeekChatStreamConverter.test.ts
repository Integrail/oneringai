import { describe, expect, it } from 'vitest';
import { StreamEventType } from '@/domain/entities/StreamEvent.js';
import { DeepSeekChatStreamConverter } from '@/infrastructure/providers/deepseek/DeepSeekChatStreamConverter.js';

async function* chunks() {
  yield {
    id: 'chat_1',
    created: 10,
    model: 'deepseek-v4-pro',
    choices: [{ delta: { reasoning_content: 'Think ' }, finish_reason: null }],
  };
  yield {
    id: 'chat_1',
    choices: [{
      delta: {
        reasoning_content: 'first.',
        tool_calls: [{
          index: 0,
          id: 'call_1',
          function: { name: 'lookup', arguments: '{"id":' },
        }],
      },
      finish_reason: null,
    }],
  };
  yield {
    id: 'chat_1',
    choices: [{
      delta: { tool_calls: [{ index: 0, function: { arguments: '1}' } }] },
      finish_reason: 'tool_calls',
    }],
  };
  yield {
    id: 'chat_1',
    choices: [],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
      prompt_cache_hit_tokens: 7,
    },
  };
}

describe('DeepSeekChatStreamConverter', () => {
  it('normalizes reasoning, fragmented tools, usage, and terminal status', async () => {
    const events = [];
    for await (const event of new DeepSeekChatStreamConverter().convertStream(
      chunks(),
      'deepseek-v4-pro',
    )) {
      events.push(event);
    }

    expect(events.filter((event) => event.type === StreamEventType.REASONING_DELTA))
      .toHaveLength(2);
    expect(events).toContainEqual(expect.objectContaining({
      type: StreamEventType.REASONING_DONE,
      thinking: 'Think first.',
    }));
    expect(events).toContainEqual(expect.objectContaining({
      type: StreamEventType.TOOL_CALL_ARGUMENTS_DONE,
      tool_call_id: 'call_1',
      arguments: '{"id":1}',
    }));
    expect(events.at(-1)).toMatchObject({
      type: StreamEventType.RESPONSE_COMPLETE,
      status: 'completed',
      stop_reason: 'tool_calls',
      usage: { input_tokens: 10, output_tokens: 5, cached_input_tokens: 7 },
    });
  });
});
