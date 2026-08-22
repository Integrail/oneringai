import { describe, expect, it } from 'vitest';
import { ContentType } from '@/domain/entities/Content.js';
import { MessageRole } from '@/domain/entities/Message.js';
import { DeepSeekConverter } from '@/infrastructure/providers/deepseek/DeepSeekConverter.js';
import {
  resolveDeepSeekHost,
  resolveDeepSeekModel,
} from '@/infrastructure/providers/deepseek/DeepSeekHostRegistry.js';

describe('DeepSeekConverter', () => {
  const converter = new DeepSeekConverter();
  const official = resolveDeepSeekHost();

  it('builds first-party Chat reasoning and replays reasoning before tool results', () => {
    const model = resolveDeepSeekModel('deepseek-v4-pro', official);
    const request = converter.convertChatRequest({
      model: 'deepseek-v4-pro',
      input: [
        {
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [
            {
              type: ContentType.THINKING,
              thinking: 'I should call the tool.',
              persistInHistory: true,
            },
            {
              type: ContentType.TOOL_USE,
              id: 'call_1',
              name: 'lookup',
              arguments: '{"id":1}',
            },
          ],
        },
        {
          type: 'message',
          role: MessageRole.USER,
          content: [
            {
              type: ContentType.TOOL_RESULT,
              tool_use_id: 'call_1',
              content: '{"ok":true}',
            },
          ],
        },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'lookup',
          description: 'Lookup',
          parameters: { type: 'object', properties: {} },
        },
      }],
      thinking: { enabled: true, effort: 'max' },
    }, model, official);

    expect(request.model).toBe('deepseek-v4-pro');
    expect(request.thinking).toEqual({ type: 'enabled' });
    expect(request.reasoning_effort).toBe('max');
    expect(request.tool_choice).toBeUndefined();
    expect(request.messages[0]).toMatchObject({
      role: 'assistant',
      content: '',
      reasoning_content: 'I should call the tool.',
    });
    expect(request.messages[1]).toEqual({
      role: 'tool',
      tool_call_id: 'call_1',
      content: '{"ok":true}',
    });
  });

  it('converts Chat response reasoning, tool calls, cache usage, and stop reason', () => {
    const response = converter.convertChatResponse({
      id: 'chat_1',
      created: 42,
      choices: [{
        finish_reason: 'tool_calls',
        message: {
          content: '',
          reasoning_content: 'Need current data.',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'lookup', arguments: '{"id":1}' },
          }],
        },
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
        prompt_cache_hit_tokens: 8,
        completion_tokens_details: { reasoning_tokens: 3 },
      },
    }, 'deepseek-v4-pro', true);

    expect(response.thinking).toBe('Need current data.');
    expect(response.stop_reason).toBe('tool_calls');
    expect(response.usage.cached_input_tokens).toBe(8);
    expect(response.usage.output_tokens_details?.reasoning_tokens).toBe(3);
    const message = response.output[0];
    expect(message?.type).toBe('message');
    if (message?.type !== 'message') throw new Error('expected message');
    expect(message.content).toContainEqual(expect.objectContaining({
      type: ContentType.THINKING,
      persistInHistory: true,
    }));
    expect(message.content).toContainEqual(expect.objectContaining({
      type: ContentType.TOOL_USE,
      id: 'call_1',
    }));
  });

  it('normalizes OpenAI-compatible cached-token usage from hosted providers', () => {
    const response = converter.convertChatResponse({
      id: 'hosted_1',
      choices: [{ finish_reason: 'stop', message: { content: 'ok' } }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 2,
        prompt_tokens_details: { cached_tokens: 6 },
      },
    }, 'deepseek-v4-flash', false);
    expect(response.usage.cached_input_tokens).toBe(6);
  });

  it('round-trips OpenRouter reasoning details for tool continuations', () => {
    const reasoningDetails = [{ type: 'reasoning.text', text: 'opaque trace' }];
    const response = converter.convertChatResponse({
      id: 'chat_or',
      choices: [{
        finish_reason: 'tool_calls',
        message: {
          content: '',
          reasoning: 'Need a lookup.',
          reasoning_details: reasoningDetails,
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'lookup', arguments: '{}' },
          }],
        },
      }],
      usage: {},
    }, 'deepseek-v4-pro', true);
    const message = response.output[0];
    if (message?.type !== 'message') throw new Error('expected message');
    const request = converter.convertChatRequest({
      model: 'deepseek-v4-pro',
      input: [message],
      tools: [{
        type: 'function',
        function: { name: 'lookup', description: 'Lookup', parameters: {} },
      }],
    }, resolveDeepSeekModel(
      'deepseek-v4-pro',
      resolveDeepSeekHost({ host: 'openrouter' }),
    ), resolveDeepSeekHost({ host: 'openrouter' }));

    expect(request.messages[0].reasoning_details).toEqual(reasoningDetails);
  });

  it('sends an executable hosted-provider reasoning disable control', () => {
    const together = resolveDeepSeekHost({ host: 'together' });
    const request = converter.convertChatRequest({
      model: 'deepseek-v4-pro',
      input: 'No thinking',
      thinking: { enabled: false },
    }, resolveDeepSeekModel('deepseek-v4-pro', together), together);
    expect(request.reasoning).toEqual({ enabled: false });
    expect(request.reasoning_effort).toBeUndefined();
  });

  it('extracts full Responses reasoning_content rather than empty summaries', () => {
    const response = converter.convertResponsesResponse({
      id: 'resp_1',
      object: 'response',
      created_at: 42,
      status: 'completed',
      model: 'deepseek-v4-flash',
      output_text: 'Done',
      output: [
        {
          id: 'rs_1',
          type: 'reasoning',
          summary: [],
          content: [{ type: 'reasoning_text', text: 'Full thought.' }],
        },
        {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'Done', annotations: [] }],
        },
      ],
      usage: { input_tokens: 2, output_tokens: 3, total_tokens: 5 },
    }, 'deepseek-v4-flash', true);

    expect(response.thinking).toBe('Full thought.');
    const message = response.output[0];
    if (message?.type !== 'message') throw new Error('expected message');
    expect(message.content[0]).toMatchObject({
      type: ContentType.THINKING,
      thinking: 'Full thought.',
      providerItemId: 'rs_1',
      persistInHistory: true,
    });
  });
});
