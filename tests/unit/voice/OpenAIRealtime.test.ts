import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent } from '../../../src/core/Agent.js';
import { Connector } from '../../../src/core/Connector.js';
import { Vendor } from '../../../src/core/Vendor.js';
import { OpenAIRealtimeAPI } from '../../../src/capabilities/voice/openai/OpenAIRealtimeAPI.js';
import { OpenAIRealtimeSession } from '../../../src/capabilities/voice/openai/OpenAIRealtimeSession.js';
import { RealtimePipeline } from '../../../src/capabilities/voice/pipelines/RealtimePipeline.js';
import { VoiceSession } from '../../../src/capabilities/voice/VoiceSession.js';

class MockSocket extends EventEmitter {
  readyState = 1;
  sent: Array<Record<string, unknown>> = [];
  close = vi.fn(() => { this.readyState = 3; });

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
}

function createConnector(): Connector {
  return Connector.create({
    name: 'realtime-test',
    vendor: Vendor.OpenAI,
    baseURL: 'https://api.openai.com/v1',
    auth: { type: 'api_key', apiKey: 'test-key' },
  });
}

function connectedFactory(socket: MockSocket) {
  return async () => {
    setTimeout(() => socket.emit('message', JSON.stringify({
      type: 'session.created',
      session: { id: 'sess_test' },
    })), 0);
    return socket;
  };
}

describe('OpenAI Realtime GA support', () => {
  beforeEach(() => Connector.clear());

  it('connects without the beta header and sends GA conversation events', async () => {
    const connector = createConnector();
    const socket = new MockSocket();
    let requestedURL = '';
    let requestedHeaders: Record<string, string> = {};
    const client = new OpenAIRealtimeSession({
      connector,
      model: 'gpt-realtime-2.1',
      safetyIdentifier: 'hashed-user-id',
      webSocketFactory: async (url, options) => {
        requestedURL = url;
        requestedHeaders = options.headers;
        return connectedFactory(socket)();
      },
    });
    client.on('error', () => undefined);

    await client.connect();
    client.updateSession({
      reasoning: { effort: 'low' },
      parallel_tool_calls: true,
      audio: { output: { format: { type: 'audio/pcmu' }, voice: 'marin' } },
    });
    client.sendText('hello');
    client.sendImage('https://example.com/image.png');

    expect(requestedURL).toBe('wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1');
    expect(requestedHeaders.Authorization).toBe('Bearer test-key');
    expect(requestedHeaders['OpenAI-Safety-Identifier']).toBe('hashed-user-id');
    expect(requestedHeaders).not.toHaveProperty('OpenAI-Beta');
    expect(socket.sent[0]).toMatchObject({
      type: 'session.update',
      session: {
        type: 'realtime',
        reasoning: { effort: 'low' },
        parallel_tool_calls: true,
        audio: { output: { format: { type: 'audio/pcmu' }, voice: 'marin' } },
      },
    });
    expect(socket.sent[1]).toMatchObject({ type: 'conversation.item.create' });
    expect(socket.sent[2]).toMatchObject({ type: 'conversation.item.create' });
  });

  it('uses connector-defined WebSocket authentication', async () => {
    const headerConnector = Connector.create({
      name: 'realtime-custom-header',
      vendor: Vendor.OpenAI,
      baseURL: 'https://example.openai.azure.com/openai/v1',
      auth: {
        type: 'api_key',
        apiKey: 'azure-key',
        headerName: 'api-key',
        headerPrefix: '',
      },
    });
    const queryConnector = Connector.create({
      name: 'realtime-query-auth',
      vendor: Vendor.OpenAI,
      baseURL: 'https://example.test/v1',
      auth: { type: 'api_key', apiKey: 'query-key', queryParamName: 'key' },
    });
    const headerSocket = new MockSocket();
    const querySocket = new MockSocket();
    let headerRequest: { url: string; headers: Record<string, string> } | undefined;
    let queryRequest: { url: string; headers: Record<string, string> } | undefined;

    const headerClient = new OpenAIRealtimeSession({
      connector: headerConnector,
      headers: { 'api-key': 'must-not-win' },
      webSocketFactory: async (url, options) => {
        headerRequest = { url, headers: options.headers };
        return connectedFactory(headerSocket)();
      },
    });
    const queryClient = new OpenAIRealtimeSession({
      connector: queryConnector,
      webSocketFactory: async (url, options) => {
        queryRequest = { url, headers: options.headers };
        return connectedFactory(querySocket)();
      },
    });
    headerClient.on('error', () => undefined);
    queryClient.on('error', () => undefined);

    await headerClient.connect();
    await queryClient.connect();

    expect(headerRequest?.headers).toMatchObject({ 'api-key': 'azure-key' });
    expect(headerRequest?.headers).not.toHaveProperty('Authorization');
    expect(queryRequest?.url).toBe(
      'wss://example.test/v1/realtime?model=gpt-realtime-2.1&key=query-key',
    );
    expect(queryRequest?.headers).not.toHaveProperty('Authorization');
  });

  it('preserves the GA transcription-session schema and streaming events', async () => {
    const connector = createConnector();
    const socket = new MockSocket();
    let requestedURL = '';
    const client = new OpenAIRealtimeSession({
      connector,
      session: {
        type: 'transcription',
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24000 },
            transcription: {
              model: 'gpt-live-transcribe',
              languages: ['en', 'de'],
              keywords: ['OneRingAI'],
              delay: 'low',
            },
            turn_detection: null,
          },
        },
      },
      webSocketFactory: async (url) => {
        requestedURL = url;
        return connectedFactory(socket)();
      },
    });
    client.on('error', () => undefined);

    await client.connect();
    client.appendAudio(Buffer.from([1, 2, 3]));
    client.commitAudio();

    expect(requestedURL).toBe('wss://api.openai.com/v1/realtime?intent=transcription');
    expect(socket.sent).toEqual([
      {
        type: 'session.update',
        session: {
          type: 'transcription',
          audio: {
            input: {
              format: { type: 'audio/pcm', rate: 24000 },
              transcription: {
                model: 'gpt-live-transcribe',
                languages: ['en', 'de'],
                keywords: ['OneRingAI'],
                delay: 'low',
              },
              turn_detection: null,
            },
          },
        },
      },
      { type: 'input_audio_buffer.append', audio: 'AQID' },
      { type: 'input_audio_buffer.commit' },
    ]);
  });

  it('uses the dedicated continuous-stream translation protocol', async () => {
    const connector = createConnector();
    const socket = new MockSocket();
    let requestedURL = '';
    const client = new OpenAIRealtimeSession({
      connector,
      model: 'gpt-realtime-translate',
      session: {
        audio: { output: { language: 'es' } },
      },
      webSocketFactory: async (url) => {
        requestedURL = url;
        return connectedFactory(socket)();
      },
    });
    client.on('error', () => undefined);

    await client.connect();
    client.appendAudio(Buffer.from([1, 2, 3]));
    client.closeTranslation();

    expect(requestedURL).toBe(
      'wss://api.openai.com/v1/realtime/translations?model=gpt-realtime-translate',
    );
    expect(socket.sent).toEqual([
      {
        type: 'session.update',
        session: {
          audio: { output: { language: 'es' } },
        },
      },
      { type: 'session.input_audio_buffer.append', audio: 'AQID' },
      { type: 'session.close' },
    ]);
  });

  it('creates browser credentials and controls SIP calls through the connector', async () => {
    const connector = createConnector();
    const fetchMock = vi.spyOn(connector, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: 'ek_test', expires_at: 123, session: { type: 'realtime' },
      }), { status: 200 }))
      .mockResolvedValue(new Response(null, { status: 204 }));
    const api = new OpenAIRealtimeAPI(connector);

    const secret = await api.createClientSecret({
      session: { type: 'realtime', model: 'gpt-realtime-2.1' },
      expiresAfterSeconds: 600,
      safetyIdentifier: 'hashed-user-id',
    });
    await api.acceptCall('call/1', { model: 'gpt-realtime-2.1' });
    await api.referCall('call/1', 'tel:+14155550123');
    await api.rejectCall('call/1', 603);
    await api.hangupCall('call/1');

    expect(secret.value).toBe('ek_test');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/realtime/client_secrets');
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      session: { type: 'realtime', model: 'gpt-realtime-2.1' },
      expires_after: { anchor: 'created_at', seconds: 600 },
    });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      'OpenAI-Safety-Identifier': 'hashed-user-id',
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://api.openai.com/v1/realtime/calls/call%2F1/accept',
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      'https://api.openai.com/v1/realtime/calls/call%2F1/refer',
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      'https://api.openai.com/v1/realtime/calls/call%2F1/reject',
    );
    expect(fetchMock.mock.calls[4]?.[0]).toBe(
      'https://api.openai.com/v1/realtime/calls/call%2F1/hangup',
    );
  });

  it('creates WebRTC client secrets for the dedicated translation endpoint', async () => {
    const connector = createConnector();
    const fetchMock = vi.spyOn(connector, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      value: 'ek_translate',
      expires_at: 123,
      session: { model: 'gpt-realtime-translate', audio: { output: { language: 'fr' } } },
    }), { status: 200 }));
    const api = new OpenAIRealtimeAPI(connector);

    const secret = await api.createTranslationClientSecret({
      session: {
        model: 'gpt-realtime-translate',
        audio: { output: { language: 'fr' } },
      },
    });

    expect(secret.value).toBe('ek_translate');
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.openai.com/v1/realtime/translations/client_secrets',
    );
  });

  it('configures the telephony pipeline with nested GA audio fields and handles GA output events', async () => {
    const connector = createConnector();
    const socket = new MockSocket();
    const agent = Agent.create({
      connector,
      model: 'gpt-realtime-2.1',
      instructions: 'Be concise.',
    });
    const voiceSession = new VoiceSession({
      callId: 'call-1', from: '+1000', to: '+2000', metadata: {},
    });
    const pipeline = new RealtimePipeline({
      agent,
      session: voiceSession,
      turnDetection: 'semantic_vad',
      semanticVADEagerness: 'high',
      noiseReduction: 'far_field',
      realtime: {
        instructions: 'Use the caller context.',
        reasoning: { effort: 'low' },
        tracing: 'auto',
        truncation: { type: 'retention_ratio', retention_ratio: 0.8 },
        audio: { input: { transcription: { prompt: 'OneRingAI AC-42' } } },
      },
      realtimeSessionFactory: (options) => new OpenAIRealtimeSession({
        ...options,
        webSocketFactory: connectedFactory(socket),
      }),
    });
    const audioOut = vi.fn();
    const transcripts: string[] = [];
    pipeline.on('audio:out', audioOut);
    pipeline.on('transcript', (entry) => transcripts.push(`${entry.role}:${entry.text}`));
    pipeline.on('error', () => undefined);

    await pipeline.init(voiceSession.getInfo());
    const update = socket.sent.find((event) => event.type === 'session.update');
    expect(update).toMatchObject({
      session: {
        type: 'realtime',
        instructions: expect.stringContaining('Be concise.'),
        parallel_tool_calls: true,
        output_modalities: ['audio'],
        reasoning: { effort: 'low' },
        tracing: 'auto',
        audio: {
          input: {
            format: { type: 'audio/pcmu' },
            noise_reduction: { type: 'far_field' },
            turn_detection: { type: 'semantic_vad', eagerness: 'high' },
            transcription: {
              model: 'gpt-4o-transcribe',
              prompt: 'OneRingAI AC-42',
            },
          },
          output: { format: { type: 'audio/pcmu' }, voice: 'marin' },
        },
      },
    });
    expect((update?.session as { instructions?: string }).instructions)
      .toContain('Use the caller context.');

    socket.emit('message', JSON.stringify({
      type: 'conversation.item.input_audio_transcription.completed', transcript: 'Hi there',
    }));
    socket.emit('message', JSON.stringify({ type: 'response.created', response: { id: 'resp_1' } }));
    socket.emit('message', JSON.stringify({
      type: 'response.output_item.added',
      item: { type: 'message', role: 'assistant', id: 'item_1' },
    }));
    socket.emit('message', JSON.stringify({
      type: 'response.output_audio.delta', delta: Buffer.from([1, 2, 3]).toString('base64'),
    }));
    socket.emit('message', JSON.stringify({
      type: 'response.output_audio_transcript.done', transcript: 'Hello!',
    }));

    expect(audioOut).toHaveBeenCalledOnce();
    expect(transcripts).toEqual(['caller:Hi there', 'agent:Hello!']);
    expect(voiceSession.turns).toBe(1);

    await pipeline.destroy();
    agent.destroy();
  });
});
