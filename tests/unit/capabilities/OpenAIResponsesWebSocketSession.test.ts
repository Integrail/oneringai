import { afterEach, describe, expect, it, vi } from 'vitest';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';
import {
  OpenAIResponsesWebSocketSession,
  type OpenAIResponsesWebSocketTransport,
} from '@/capabilities/openai/OpenAIResponsesWebSocketSession.js';

function fakeTransport(): OpenAIResponsesWebSocketTransport & { sent: any[] } {
  const listeners = new Map<string, Array<(...args: any[]) => void>>();
  return {
    sent: [],
    socket: {
      readyState: 1,
      on: vi.fn(),
      off: vi.fn(),
    },
    on(event, listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      return this;
    },
    send(event) { this.sent.push(event); },
    async *stream() { /* no events */ },
    close: vi.fn(),
  };
}

describe('OpenAIResponsesWebSocketSession', () => {
  afterEach(() => Connector.clear());

  it('uses a named connector and sends create plus steering events', async () => {
    Connector.create({
      name: 'openai-ws-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'secret-test-key' },
      options: { project: 'proj_123' },
    });
    const transport = fakeTransport();
    const factory = vi.fn(() => transport);
    const session = new OpenAIResponsesWebSocketSession({
      connector: 'openai-ws-test',
      transportFactory: factory,
    });

    await session.connect();
    session.createResponse({
      model: 'gpt-6-astra',
      input: 'start',
      stream_id: 'lane-1',
      tools: [{
        type: 'function',
        function: { name: 'slow_job', parameters: { type: 'object' } },
        async: true,
      }],
    });
    session.steer('resp_1', 'change direction');

    expect(factory).toHaveBeenCalledOnce();
    expect(transport.sent).toEqual([
      expect.objectContaining({
        type: 'response.create', model: 'gpt-6-astra', input: 'start', stream_id: 'lane-1',
        tools: [expect.objectContaining({ name: 'slow_job', async: true })],
      }),
      { type: 'response.steer', previous_response_id: 'resp_1', input: 'change direction' },
    ]);
  });

  it('validates WebSocket stream IDs before sending', async () => {
    const connector = Connector.create({
      name: 'openai-ws-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'secret-test-key' },
    });
    const transport = fakeTransport();
    const session = new OpenAIResponsesWebSocketSession({
      connector,
      transportFactory: () => transport,
    });
    await session.connect();

    expect(() => session.createResponse({
      model: 'gpt-6-astra', input: 'start', stream_id: 'spaces are invalid',
    })).toThrow(/stream_id/);
    expect(transport.sent).toHaveLength(0);
  });

  it('rejects steering payloads that the protocol cannot accept', async () => {
    const connector = Connector.create({
      name: 'openai-ws-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'secret-test-key' },
    });
    const transport = fakeTransport();
    const session = new OpenAIResponsesWebSocketSession({
      connector,
      transportFactory: () => transport,
    });
    await session.connect();

    expect(() => session.steer('resp_1', [] as any)).toThrow(/at least one user message/);
    expect(() => session.steer('resp_1', [{
      type: 'message', role: 'assistant', content: 'No',
    }] as any)).toThrow(/role user/);
    expect(() => session.steer('resp_1', [{
      type: 'message', role: 'user', content: 'Valid', id: 'msg_not_allowed',
    }] as any)).toThrow(/only type, role, and content/);
    expect(() => session.steer('resp_1', [{
      type: 'function_call_output', call_id: 'call_1', output: 'done',
    }] as any)).toThrow(/role user/);
    expect(transport.sent).toHaveLength(0);
  });

  it('accepts non-empty user-message steering input', async () => {
    const connector = Connector.create({
      name: 'openai-ws-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'secret-test-key' },
    });
    const transport = fakeTransport();
    const session = new OpenAIResponsesWebSocketSession({
      connector,
      transportFactory: () => transport,
    });
    await session.connect();

    session.steer('resp_1', [{
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: 'Change direction.' }],
    }]);

    expect(transport.sent).toEqual([{
      type: 'response.steer',
      previous_response_id: 'resp_1',
      input: [{
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Change direction.' }],
      }],
    }]);
  });
});
