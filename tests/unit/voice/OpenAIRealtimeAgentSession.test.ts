import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent } from '../../../src/core/Agent.js';
import { Connector } from '../../../src/core/Connector.js';
import { Vendor } from '../../../src/core/Vendor.js';
import type { ToolFunction } from '../../../src/domain/entities/Tool.js';
import { ContentType } from '../../../src/domain/entities/Content.js';
import { OpenAIRealtimeAgentSession } from '../../../src/capabilities/voice/openai/OpenAIRealtimeAgentSession.js';
import { OpenAIRealtimeSession } from '../../../src/capabilities/voice/openai/OpenAIRealtimeSession.js';

class MockSocket extends EventEmitter {
  readyState = 1;
  bufferedAmount = 0;
  sent: Array<Record<string, any>> = [];
  close = vi.fn(() => { this.readyState = 3; });

  send(data: string | Buffer): void {
    if (!Buffer.isBuffer(data)) this.sent.push(JSON.parse(data));
  }
}

class AudioForwardingTransport extends EventEmitter {
  isConnected = true;
  readonly emitsOutputAudioFromEvents = true;
  sent: Array<Record<string, any>> = [];

  updateSession(session: Record<string, any>): void {
    this.sent.push({ type: 'session.update', session });
  }

  send(event: Record<string, any>): void {
    this.sent.push(event);
  }

  close(): void {
    this.isConnected = false;
  }
}

function createConnector(): Connector {
  return Connector.create({
    name: 'realtime-agent-test',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey: 'test-key' },
  });
}

function functionOutputEvents(socket: MockSocket): Array<Record<string, any>> {
  return socket.sent.filter(
    (event) => event.type === 'conversation.item.create'
      && event.item?.type === 'function_call_output',
  );
}

describe('OpenAIRealtimeAgentSession', () => {
  beforeEach(() => Connector.clear());

  it('refreshes Agent context before each audio turn and manages response creation', async () => {
    const socket = new MockSocket();
    const connector = createConnector();
    const agent = Agent.create({
      connector,
      model: 'gpt-realtime-2.1',
      instructions: 'Use the current executive context.',
      permissions: { autoApproveAll: true },
    });
    const prepare = vi.spyOn(agent.context, 'prepare');
    const transport = new OpenAIRealtimeSession({
      connector,
      webSocketFactory: async () => {
        setTimeout(() => socket.emit('message', JSON.stringify({ type: 'session.created' })), 0);
        return socket;
      },
    });
    const session = new OpenAIRealtimeAgentSession({
      agent,
      transport,
      session: {
        instructions: 'Speak briefly.',
        audio: {
          input: { turn_detection: { type: 'semantic_vad', eagerness: 'high' } },
        },
      },
    });
    session.on('error', () => undefined);

    await session.connect();

    expect(socket.sent[0]).toMatchObject({
      type: 'session.update',
      session: {
        model: 'gpt-realtime-2.1',
        instructions: expect.stringContaining('Use the current executive context.'),
        audio: {
          input: {
            turn_detection: { type: 'semantic_vad', eagerness: 'high', create_response: false },
            transcription: { model: 'gpt-4o-transcribe' },
          },
          output: { voice: 'marin' },
        },
      },
    });
    expect((socket.sent[0]?.session.instructions as string)).toContain('Speak briefly.');

    socket.emit('message', JSON.stringify({
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'What changed today?',
    }));

    await vi.waitFor(() => expect(prepare).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(socket.sent.some((event) => event.type === 'response.create')).toBe(true));
    const updates = socket.sent.filter((event) => event.type === 'session.update');
    expect(updates).toHaveLength(2);
    expect(updates[1]?.session.instructions).toContain('Speak briefly.');

    await session.close();
    agent.destroy();
  });

  it('continues synchronizing later turns after one context refresh fails', async () => {
    const socket = new MockSocket();
    const connector = createConnector();
    const agent = Agent.create({ connector, model: 'gpt-realtime-2.1' });
    const session = new OpenAIRealtimeAgentSession({
      agent,
      transport: new OpenAIRealtimeSession({
        connector,
        webSocketFactory: async () => {
          setTimeout(() => socket.emit('message', JSON.stringify({ type: 'session.created' })), 0);
          return socket;
        },
      }),
    });
    const errors: Error[] = [];
    session.on('error', (error) => errors.push(error));
    await session.connect();

    const prepare = vi.spyOn(agent.context, 'prepare');
    prepare.mockRejectedValueOnce(new Error('transient context refresh failure'));
    socket.emit('message', JSON.stringify({
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'First turn',
    }));
    await vi.waitFor(() => expect(errors).toHaveLength(1));
    expect(socket.sent.filter((event) => event.type === 'response.create')).toHaveLength(0);

    socket.emit('message', JSON.stringify({
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'Second turn',
    }));
    await vi.waitFor(() => {
      expect(socket.sent.filter((event) => event.type === 'response.create')).toHaveLength(1);
    });
    expect(prepare).toHaveBeenCalledTimes(2);

    await session.close();
    agent.destroy();
  });

  it('executes parallel local functions through Agent hooks and preserves the result batch', async () => {
    const socket = new MockSocket();
    const execute = vi.fn(async ({ value }: { value: number }) => ({ doubled: value * 2 }));
    const tool: ToolFunction = {
      definition: {
        type: 'function',
        function: {
          name: 'double_value',
          description: 'Double a number.',
          parameters: {
            type: 'object',
            properties: { value: { type: 'number' } },
            required: ['value'],
          },
        },
      },
      execute,
    };
    const beforeTool = vi.fn(() => ({}));
    const approveTool = vi.fn(() => ({ approved: true }));
    const afterTool = vi.fn(() => ({}));
    const connector = createConnector();
    const agent = Agent.create({
      connector,
      model: 'gpt-realtime-2.1',
      tools: [tool],
      permissions: { autoApproveAll: true },
      limits: { maxToolCalls: 2 },
      hooks: {
        'before:tool': beforeTool,
        'approve:tool': approveTool,
        'after:tool': afterTool,
      },
    });
    const session = new OpenAIRealtimeAgentSession({
      agent,
      transport: new OpenAIRealtimeSession({
        connector,
        webSocketFactory: async () => {
          setTimeout(() => socket.emit('message', JSON.stringify({ type: 'session.created' })), 0);
          return socket;
        },
      }),
    });
    session.on('error', () => undefined);
    await session.connect();

    socket.emit('message', JSON.stringify({ type: 'response.created', response: { id: 'resp_tools' } }));
    for (const [callId, value] of [['call_1', 2], ['call_2', 3]] as const) {
      socket.emit('message', JSON.stringify({
        type: 'response.output_item.added',
        item: { type: 'function_call', call_id: callId, name: 'double_value', arguments: '' },
      }));
      socket.emit('message', JSON.stringify({
        type: 'response.function_call_arguments.done',
        call_id: callId,
        name: 'double_value',
        arguments: JSON.stringify({ value }),
      }));
    }
    socket.emit('message', JSON.stringify({
      type: 'response.done',
      response: { status: 'completed', usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 } },
    }));

    await vi.waitFor(() => expect(functionOutputEvents(socket)).toHaveLength(2));
    await vi.waitFor(() => {
      const responses = socket.sent.filter((event) => event.type === 'response.create');
      expect(responses).toHaveLength(1);
    });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(beforeTool).toHaveBeenCalledTimes(2);
    expect(approveTool).toHaveBeenCalledTimes(2);
    expect(afterTool).toHaveBeenCalledTimes(2);

    const currentInput = agent.context.getCurrentInput();
    const resultContents = currentInput
      .filter((item) => item.type === 'message')
      .flatMap((item) => item.type === 'message' ? item.content : [])
      .filter((content) => content.type === ContentType.TOOL_RESULT);
    expect(resultContents).toHaveLength(2);
    expect(agent.getMetrics()).toMatchObject({
      toolCallCount: 2,
      toolSuccessCount: 2,
      inputTokens: 10,
      outputTokens: 4,
      totalTokens: 14,
    });

    await session.close();
    agent.destroy();
  });

  it('answers remote MCP approval requests and fails closed without approval', async () => {
    const socket = new MockSocket();
    const connector = createConnector();
    const agent = Agent.create({ connector, model: 'gpt-realtime-2.1' });
    const approveMCP = vi.fn((request: { name: string }) => ({
      approve: request.name === 'read_calendar',
      reason: 'Write access is not approved',
    }));
    const session = new OpenAIRealtimeAgentSession({
      agent,
      transport: new OpenAIRealtimeSession({
        connector,
        webSocketFactory: async () => {
          setTimeout(() => socket.emit('message', JSON.stringify({ type: 'session.created' })), 0);
          return socket;
        },
      }),
      approveMCP,
      session: {
        tools: [{ type: 'mcp', server_label: 'calendar', connector_id: 'connector_calendar' }],
      },
    });
    session.on('error', () => undefined);
    await session.connect();

    socket.emit('message', JSON.stringify({
      type: 'conversation.item.done',
      item: {
        type: 'mcp_approval_request',
        id: 'approval_read',
        server_label: 'calendar',
        name: 'read_calendar',
        arguments: '{}',
      },
    }));
    socket.emit('message', JSON.stringify({
      type: 'conversation.item.done',
      item: {
        type: 'mcp_approval_request',
        id: 'approval_write',
        server_label: 'calendar',
        name: 'delete_event',
        arguments: '{}',
      },
    }));

    await vi.waitFor(() => {
      const responses = socket.sent.filter(
        (event) => event.item?.type === 'mcp_approval_response',
      );
      expect(responses).toHaveLength(2);
      expect(responses[0]?.item).toMatchObject({
        approval_request_id: 'approval_read',
        approve: true,
      });
      expect(responses[1]?.item).toMatchObject({
        approval_request_id: 'approval_write',
        approve: false,
        reason: 'Write access is not approved',
      });
    });

    await session.close();
    agent.destroy();

    Connector.clear();
    const deniedSocket = new MockSocket();
    const deniedConnector = createConnector();
    const deniedAgent = Agent.create({ connector: deniedConnector, model: 'gpt-realtime-2.1' });
    const deniedSession = new OpenAIRealtimeAgentSession({
      agent: deniedAgent,
      transport: new OpenAIRealtimeSession({
        connector: deniedConnector,
        webSocketFactory: async () => {
          setTimeout(() => deniedSocket.emit('message', JSON.stringify({ type: 'session.created' })), 0);
          return deniedSocket;
        },
      }),
    });
    deniedSession.on('error', () => undefined);
    await deniedSession.connect();
    deniedSocket.emit('message', JSON.stringify({
      type: 'conversation.item.done',
      item: { type: 'mcp_approval_request', id: 'approval_default', name: 'anything', arguments: '{}' },
    }));
    await vi.waitFor(() => expect(deniedSocket.sent).toContainEqual(expect.objectContaining({
      item: expect.objectContaining({
        approval_request_id: 'approval_default',
        approve: false,
      }),
    })));
    await deniedSession.close();
    deniedAgent.destroy();
  });

  it('tracks modality-specific usage and protects audio sends with backpressure', async () => {
    const socket = new MockSocket();
    const connector = createConnector();
    const transport = new OpenAIRealtimeSession({
      connector,
      maxBufferedAmountBytes: 100,
      webSocketFactory: async () => {
        setTimeout(() => socket.emit('message', JSON.stringify({ type: 'session.created' })), 0);
        return socket;
      },
    });
    const agent = Agent.create({ connector, model: 'gpt-realtime-2.1' });
    const session = new OpenAIRealtimeAgentSession({ agent, transport });
    const backpressure = vi.fn();
    const audio = vi.fn();
    session.on('error', () => undefined);
    session.on('backpressure', backpressure);
    session.on('audio', audio);
    await session.connect();

    socket.bufferedAmount = 100;
    expect(session.appendAudio(Buffer.from([1, 2, 3]))).toBe(false);
    expect(backpressure).toHaveBeenCalledWith({ bufferedAmount: 100, limit: 100 });
    const outputAudio = Buffer.from([4, 5, 6]);
    socket.emit('message', JSON.stringify({
      type: 'response.output_audio.delta',
      delta: outputAudio.toString('base64'),
    }));
    await vi.waitFor(() => expect(audio).toHaveBeenCalledWith(outputAudio));
    socket.emit('message', JSON.stringify({
      type: 'response.done',
      response: {
        status: 'completed',
        usage: {
          input_tokens: 40,
          output_tokens: 20,
          total_tokens: 60,
          input_token_details: { audio_tokens: 30, text_tokens: 10, cached_tokens: 5 },
          output_token_details: { audio_tokens: 18, text_tokens: 2, reasoning_tokens: 3 },
        },
      },
    }));
    await vi.waitFor(() => expect(session.getUsage()).toMatchObject({
      input_tokens: 40,
      output_tokens: 20,
      total_tokens: 60,
      input_audio_tokens: 30,
      input_text_tokens: 10,
      output_audio_tokens: 18,
      output_text_tokens: 2,
      cached_input_tokens: 5,
      output_tokens_details: { reasoning_tokens: 3 },
    }));

    await session.close();
    agent.destroy();
  });

  it('does not duplicate audio already decoded by a custom transport', async () => {
    const connector = createConnector();
    const afterExecution = vi.fn(() => ({}));
    const agent = Agent.create({
      connector,
      model: 'gpt-realtime-2.1',
      hooks: { 'after:execution': afterExecution },
    });
    const transport = new AudioForwardingTransport();
    const session = new OpenAIRealtimeAgentSession({ agent, transport });
    const audio = vi.fn();
    session.on('error', () => undefined);
    session.on('audio', audio);
    await session.connect();

    const chunk = Buffer.from([7, 8, 9]);
    transport.emit('event', {
      type: 'response.output_audio.delta',
      delta: chunk.toString('base64'),
    });
    transport.emit('audio', chunk);

    await vi.waitFor(() => expect(audio).toHaveBeenCalledTimes(1));
    expect(audio).toHaveBeenCalledWith(chunk);

    await session.close();
    expect(afterExecution.mock.calls[0]![0].response.status).toBe('completed');
    agent.destroy();
  });

  it('keeps identical replies from separate responses while deduplicating one response', async () => {
    const socket = new MockSocket();
    const connector = createConnector();
    const agent = Agent.create({ connector, model: 'gpt-realtime-2.1' });
    const session = new OpenAIRealtimeAgentSession({
      agent,
      transport: new OpenAIRealtimeSession({
        connector,
        webSocketFactory: async () => {
          setTimeout(() => socket.emit('message', JSON.stringify({ type: 'session.created' })), 0);
          return socket;
        },
      }),
    });
    const transcripts: string[] = [];
    session.on('error', () => undefined);
    session.on('transcript:output', (text) => transcripts.push(text));
    await session.connect();

    for (const responseId of ['response_1', 'response_2']) {
      socket.emit('message', JSON.stringify({
        type: 'response.created', response: { id: responseId },
      }));
      socket.emit('message', JSON.stringify({
        type: 'response.output_audio_transcript.done',
        response_id: responseId,
        transcript: 'Certainly.',
      }));
      socket.emit('message', JSON.stringify({
        type: 'response.output_text.done',
        response_id: responseId,
        text: 'Certainly.',
      }));
      socket.emit('message', JSON.stringify({
        type: 'response.done', response: { id: responseId, status: 'completed' },
      }));
      await vi.waitFor(() => expect(transcripts).toHaveLength(
        responseId === 'response_1' ? 1 : 2,
      ));
    }

    expect(transcripts).toEqual(['Certainly.', 'Certainly.']);
    await session.close();
    agent.destroy();
  });

  it('reports the current external input and cancellation status to lifecycle hooks', async () => {
    const socket = new MockSocket();
    const connector = createConnector();
    const afterExecution = vi.fn(() => ({}));
    const agent = Agent.create({
      connector,
      model: 'gpt-realtime-2.1',
      hooks: { 'after:execution': afterExecution },
    });
    agent.context.setCurrentInput('stale text input');
    const session = new OpenAIRealtimeAgentSession({
      agent,
      transport: new OpenAIRealtimeSession({
        connector,
        webSocketFactory: async () => {
          setTimeout(() => socket.emit('message', JSON.stringify({ type: 'session.created' })), 0);
          return socket;
        },
      }),
    });
    session.on('error', () => undefined);
    await session.connect();
    socket.emit('message', JSON.stringify({
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'fresh voice input',
    }));
    await vi.waitFor(() => expect(socket.sent.some((event) => event.type === 'response.create')).toBe(true));

    agent.cancel('caller ended the session');
    await session.close();

    expect(afterExecution).toHaveBeenCalledOnce();
    const lifecycle = afterExecution.mock.calls[0]![0] as {
      response: { status: string };
      input: Array<{ content?: Array<{ text?: string }> }>;
    };
    expect(lifecycle.response.status).toBe('cancelled');
    expect(lifecycle.input.flatMap((item) => item.content ?? []).map((content) => content.text))
      .toEqual(['fresh voice input']);
    agent.destroy();
  });

  it('marks an unexpected remote close as failed even when the close code is 1000', async () => {
    const socket = new MockSocket();
    const connector = createConnector();
    const afterExecution = vi.fn(() => ({}));
    const agent = Agent.create({
      connector,
      model: 'gpt-realtime-2.1',
      hooks: { 'after:execution': afterExecution },
    });
    const session = new OpenAIRealtimeAgentSession({
      agent,
      transport: new OpenAIRealtimeSession({
        connector,
        webSocketFactory: async () => {
          setTimeout(() => socket.emit('message', JSON.stringify({ type: 'session.created' })), 0);
          return socket;
        },
      }),
    });
    const errors: Error[] = [];
    session.on('error', (error) => errors.push(error));
    await session.connect();

    socket.emit('close', 1000, Buffer.from('server shutdown'));

    await vi.waitFor(() => expect(afterExecution).toHaveBeenCalledOnce());
    expect(afterExecution.mock.calls[0]![0].response.status).toBe('failed');
    expect(errors[0]?.message).toContain('closed unexpectedly: 1000');
    await session.close();
    agent.destroy();
  });
});
