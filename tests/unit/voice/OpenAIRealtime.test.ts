import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent } from '../../../src/core/Agent.js';
import { Connector } from '../../../src/core/Connector.js';
import { Vendor } from '../../../src/core/Vendor.js';
import { OpenAIRealtimeAPI } from '../../../src/capabilities/voice/openai/OpenAIRealtimeAPI.js';
import { OpenAIRealtimeSession } from '../../../src/capabilities/voice/openai/OpenAIRealtimeSession.js';
import { GrokRealtimeAPI } from '../../../src/capabilities/voice/grok/GrokRealtimeAPI.js';
import { GrokRealtimeSession } from '../../../src/capabilities/voice/grok/GrokRealtimeSession.js';
import { RealtimePipeline } from '../../../src/capabilities/voice/pipelines/RealtimePipeline.js';
import { VoiceSession } from '../../../src/capabilities/voice/VoiceSession.js';

class MockSocket extends EventEmitter {
  readyState = 1;
  sent: Array<Record<string, unknown>> = [];
  binarySent: Buffer[] = [];
  close = vi.fn(() => { this.readyState = 3; });

  send(data: string | Buffer): void {
    if (Buffer.isBuffer(data)) this.binarySent.push(data);
    else {
      const event = JSON.parse(data) as Record<string, unknown>;
      this.sent.push(event);
      if (event.type === 'session.update') {
        setTimeout(() => this.emit('message', JSON.stringify({
          type: 'session.updated',
          session: { id: 'sess_test' },
        })), 0);
      }
    }
  }
}

class OpeningMockSocket extends MockSocket {
  override readyState = 0;

  open(): void {
    this.readyState = 1;
    this.emit('open');
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

  it('rejects non-24 kHz OpenAI PCM at compile time and at the runtime boundary', () => {
    const connector = createConnector();
    expect(() => new OpenAIRealtimeSession({
      connector,
      session: {
        audio: {
          input: {
            format: {
              type: 'audio/pcm',
              // @ts-expect-error OpenAI Realtime PCM is fixed at 24 kHz.
              rate: 16000,
            },
          },
        },
      },
    })).toThrow('OpenAI Realtime input PCM rate must be 24000 Hz');
  });

  it('rejects non-24 kHz OpenAI PCM in later session updates', () => {
    const client = new OpenAIRealtimeSession({ connector: createConnector() });

    expect(() => client.updateSession({
      audio: { output: { format: { type: 'audio/pcm', rate: 16000 } } },
    } as any)).toThrow('OpenAI Realtime output PCM rate must be 24000 Hz');
  });

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

  it('joins a WebRTC sideband after open without waiting for session.created', async () => {
    const socket = new OpeningMockSocket();
    let requestedURL = '';
    const client = new OpenAIRealtimeSession({
      connector: createConnector(),
      callId: 'call/123',
      webSocketFactory: async (url) => {
        requestedURL = url;
        return socket;
      },
    });
    client.on('error', () => undefined);

    const connecting = client.connect();
    await vi.waitFor(() => expect(requestedURL).not.toBe(''));
    expect(socket.sent).toEqual([]);

    socket.open();
    expect(client.isConnected).toBe(false);
    await expect(connecting).resolves.toMatchObject({ type: 'session.updated' });
    expect(client.isConnected).toBe(true);

    expect(requestedURL).toBe('wss://api.openai.com/v1/realtime?call_id=call%2F123');
    expect(socket.sent).toEqual([{
      type: 'session.update',
      session: { type: 'realtime' },
    }]);
  });

  it('cancels an in-flight connection when close is called before token resolution', async () => {
    const connector = createConnector();
    let resolveToken!: (token: string) => void;
    vi.spyOn(connector, 'getToken').mockReturnValue(new Promise((resolve) => {
      resolveToken = resolve;
    }));
    const factory = vi.fn();
    const client = new OpenAIRealtimeSession({ connector, webSocketFactory: factory });

    const connecting = client.connect();
    client.close(1000, 'Caller disconnected');
    resolveToken('test-key');

    await expect(connecting).rejects.toMatchObject({ name: 'AbortError' });
    expect(factory).not.toHaveBeenCalled();
  });

  it('aborts immediately and closes a socket returned by a late async factory', async () => {
    const socket = new MockSocket();
    let resolveSocket!: (socket: MockSocket) => void;
    const factory = vi.fn(() => new Promise<MockSocket>((resolve) => {
      resolveSocket = resolve;
    }));
    const client = new OpenAIRealtimeSession({
      connector: createConnector(),
      webSocketFactory: factory,
    });
    const controller = new AbortController();
    const connecting = client.connect({ signal: controller.signal });
    await vi.waitFor(() => expect(factory).toHaveBeenCalledOnce());

    controller.abort();
    await expect(connecting).rejects.toMatchObject({ name: 'AbortError' });
    resolveSocket(socket);
    await vi.waitFor(() => expect(socket.close).toHaveBeenCalledWith(1000, 'Connect cancelled'));
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
      .mockResolvedValueOnce(new Response('v=0\r\ns=OpenAI Realtime\r\n', {
        status: 200,
        headers: { Location: '/v1/realtime/calls/call_123' },
      }))
      .mockResolvedValue(new Response(null, { status: 204 }));
    const api = new OpenAIRealtimeAPI(connector);

    const secret = await api.createClientSecret({
      session: { type: 'realtime', model: 'gpt-realtime-2.1' },
      expiresAfterSeconds: 600,
      safetyIdentifier: 'hashed-user-id',
    });
    const sdpAnswer = await api.createWebRTCCallWithMetadata({
      sdp: 'v=0\r\ns=Browser offer\r\n',
      session: { model: 'gpt-realtime-2.1' },
      safetyIdentifier: 'hashed-user-id',
    });
    await api.acceptCall('call/1', { model: 'gpt-realtime-2.1' });
    await api.referCall('call/1', 'tel:+14155550123');
    await api.rejectCall('call/1', 603);
    await api.hangupCall('call/1');

    expect(secret.value).toBe('ek_test');
    expect(sdpAnswer).toEqual({
      sdp: 'v=0\r\ns=OpenAI Realtime\r\n',
      callId: 'call_123',
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/realtime/client_secrets');
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      session: { type: 'realtime', model: 'gpt-realtime-2.1' },
      expires_after: { anchor: 'created_at', seconds: 600 },
    });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      'OpenAI-Safety-Identifier': 'hashed-user-id',
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.openai.com/v1/realtime/calls');
    const callBody = fetchMock.mock.calls[1]?.[1]?.body;
    expect(callBody).toBeInstanceOf(FormData);
    expect((callBody as FormData).get('sdp')).toBe('v=0\r\ns=Browser offer\r\n');
    expect(JSON.parse(String((callBody as FormData).get('session')))).toMatchObject({
      type: 'realtime', model: 'gpt-realtime-2.1',
    });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      'OpenAI-Safety-Identifier': 'hashed-user-id',
    });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).not.toHaveProperty('Content-Type');
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      'https://api.openai.com/v1/realtime/calls/call%2F1/accept',
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      'https://api.openai.com/v1/realtime/calls/call%2F1/refer',
    );
    expect(fetchMock.mock.calls[4]?.[0]).toBe(
      'https://api.openai.com/v1/realtime/calls/call%2F1/reject',
    );
    expect(fetchMock.mock.calls[5]?.[0]).toBe(
      'https://api.openai.com/v1/realtime/calls/call%2F1/hangup',
    );
  });

  it('rejects WebRTC setup when OpenAI omits the sideband call ID', async () => {
    const connector = createConnector();
    vi.spyOn(connector, 'fetch').mockResolvedValue(new Response('v=0\r\ns=answer\r\n', {
      status: 200,
    }));
    const api = new OpenAIRealtimeAPI(connector);

    await expect(api.createWebRTCCallWithMetadata({ sdp: 'v=0\r\ns=offer\r\n' }))
      .rejects.toThrow('did not include a call ID');
  });

  it('treats an already-closed Realtime call as a successful idempotent hangup', async () => {
    const connector = createConnector();
    vi.spyOn(connector, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'call_id_not_found' },
    }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
    const api = new OpenAIRealtimeAPI(connector);

    await expect(api.hangupCall('rtc_already_closed')).resolves.toBeUndefined();
  });

  it('keeps createWebRTCCall backward compatible with its SDP string return', async () => {
    const connector = createConnector();
    vi.spyOn(connector, 'fetch').mockResolvedValue(new Response('v=0\r\ns=answer\r\n', {
      status: 200,
    }));
    const api = new OpenAIRealtimeAPI(connector);

    await expect(api.createWebRTCCall({ sdp: 'v=0\r\ns=offer\r\n' }))
      .resolves.toBe('v=0\r\ns=answer\r\n');
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

  it('reports a socket-close race while appending telephony audio without throwing', async () => {
    const connector = createConnector();
    const socket = new MockSocket();
    const agent = Agent.create({ connector, model: 'gpt-realtime-2.1' });
    const voiceSession = new VoiceSession({
      callId: 'call-audio-race', from: '+1000', to: '+2000', metadata: {},
    });
    const pipeline = new RealtimePipeline({
      agent,
      session: voiceSession,
      realtimeSessionFactory: (options) => new OpenAIRealtimeSession({
        ...options,
        webSocketFactory: connectedFactory(socket),
      }),
    });
    const errors: Error[] = [];
    pipeline.on('error', (error) => errors.push(error));
    await pipeline.init(voiceSession.getInfo());

    const realtime = (pipeline as unknown as {
      realtime: { appendAudio(audio: Buffer): boolean };
    }).realtime;
    vi.spyOn(realtime, 'appendAudio').mockImplementationOnce(() => {
      throw new Error('OpenAI Realtime WebSocket is not open');
    });

    expect(() => pipeline.processAudio({
      audio: Buffer.from([1, 2, 3]),
      sampleRate: 8000,
      encoding: 'mulaw',
      channels: 1,
      timestamp: 20,
    })).not.toThrow();
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain('WebSocket is not open');

    await pipeline.destroy();
    agent.destroy();
  });

  it('keeps manual turn responses working when input transcription is disabled', async () => {
    const connector = createConnector();
    const socket = new MockSocket();
    const agent = Agent.create({ connector, model: 'gpt-realtime-2.1' });
    const voiceSession = new VoiceSession({
      callId: 'call-no-transcription', from: '+1000', to: '+2000', metadata: {},
    });
    const pipeline = new RealtimePipeline({
      agent,
      session: voiceSession,
      turnDetection: 'none',
      inputTranscription: false,
      realtimeSessionFactory: (options) => new OpenAIRealtimeSession({
        ...options,
        webSocketFactory: connectedFactory(socket),
      }),
    });
    pipeline.on('error', () => undefined);

    await pipeline.init(voiceSession.getInfo());
    await pipeline.onSpeechEnd();

    const update = socket.sent.find((event) => event.type === 'session.update');
    expect((update?.session as any).audio.input.transcription).toBeNull();
    expect(socket.sent.slice(-2).map((event) => event.type)).toEqual([
      'input_audio_buffer.commit',
      'response.create',
    ]);

    await pipeline.destroy();
    agent.destroy();
  });
});

describe('xAI Realtime compatibility', () => {
  beforeEach(() => Connector.clear());

  it('rejects OpenAI-only semantic VAD before opening an xAI session', async () => {
    const connector = Connector.create({
      name: 'xai-semantic-vad-test',
      vendor: Vendor.Grok,
      auth: { type: 'api_key', apiKey: 'xai-test-key' },
    });
    const agent = Agent.create({ connector, model: 'grok-voice-latest' });
    const voiceSession = new VoiceSession({
      callId: 'xai-semantic-call', from: '+1000', to: '+2000', metadata: {},
    });
    const factory = vi.fn();
    const pipeline = new RealtimePipeline({
      agent,
      session: voiceSession,
      turnDetection: 'semantic_vad',
      realtimeSessionFactory: factory,
    });

    await expect(pipeline.init(voiceSession.getInfo())).rejects.toThrow(
      'semantic_vad is OpenAI-only',
    );
    expect(factory).not.toHaveBeenCalled();
    agent.destroy();
  });

  it('uses xAI root session fields and language_hint in the telephony pipeline', async () => {
    const connector = Connector.create({
      name: 'xai-pipeline-test',
      vendor: Vendor.Grok,
      auth: { type: 'api_key', apiKey: 'xai-test-key' },
    });
    const socket = new MockSocket();
    const agent = Agent.create({
      connector,
      model: 'grok-voice-latest',
      instructions: 'Be concise.',
    });
    const voiceSession = new VoiceSession({
      callId: 'xai-call-1', from: '+1000', to: '+2000', metadata: {},
    });
    const pipeline = new RealtimePipeline({
      agent,
      session: voiceSession,
      realtime: {
        voice: { id: 'custom_voice_1' },
        turn_detection: { type: 'server_vad', threshold: 0.7 },
        audio: {
          input: {
            noise_reduction: { type: 'far_field' },
            transcription: { language: 'de', keyterms: ['OneRingAI'] },
          },
          output: { voice: 'eve' },
        },
      },
      realtimeSessionFactory: (options) => new OpenAIRealtimeSession({
        ...options,
        webSocketFactory: connectedFactory(socket),
      }),
    });
    pipeline.on('error', () => undefined);

    await pipeline.init(voiceSession.getInfo());

    const update = socket.sent.find((event) => event.type === 'session.update');
    expect(update).toMatchObject({
      session: {
        voice: { id: 'custom_voice_1' },
        turn_detection: { type: 'server_vad', threshold: 0.7 },
        audio: {
          input: {
            format: { type: 'audio/pcmu' },
            transcription: { language_hint: 'de', keyterms: ['OneRingAI'] },
          },
          output: { format: { type: 'audio/pcmu' } },
        },
      },
    });
    expect((update?.session as any).audio.input).not.toHaveProperty('turn_detection');
    expect((update?.session as any).audio.input).not.toHaveProperty('noise_reduction');
    expect((update?.session as any).audio.output).not.toHaveProperty('voice');
    expect((update?.session as any).audio.input.transcription).not.toHaveProperty('language');
    expect((update?.session as any).audio.input.transcription).not.toHaveProperty('model');

    await pipeline.destroy();
    agent.destroy();
  });

  it('uses the xAI endpoint and current voice query parameters', async () => {
    const connector = Connector.create({
      name: 'xai-realtime-test',
      vendor: Vendor.Grok,
      auth: { type: 'api_key', apiKey: 'xai-test-key' },
    });
    const socket = new MockSocket();
    let requestedURL = '';
    const client = new GrokRealtimeSession({
      connector,
      model: 'grok-voice-latest',
      reasoningEffort: 'high',
      conversationId: 'conversation-1',
      webSocketFactory: async (url) => {
        requestedURL = url;
        return connectedFactory(socket)();
      },
    });
    client.on('error', () => undefined);

    await client.connect();

    expect(requestedURL).toBe(
      'wss://api.x.ai/v1/realtime?model=grok-voice-latest&conversation_id=conversation-1&reasoning.effort=high',
    );
  });

  it('supports xAI raw binary input and output audio transport', async () => {
    const connector = Connector.create({
      name: 'xai-binary-test',
      vendor: Vendor.Grok,
      auth: { type: 'api_key', apiKey: 'xai-test-key' },
    });
    const socket = new MockSocket();
    const output: Buffer[] = [];
    const client = new GrokRealtimeSession({
      connector,
      model: 'grok-voice-latest',
      session: {
        audio: {
          input: { transport: 'binary', format: { type: 'audio/pcm', rate: 16000 } },
          output: { transport: 'binary', format: { type: 'audio/pcm', rate: 32000 } },
        },
      },
      webSocketFactory: connectedFactory(socket),
    });
    client.on('error', () => undefined);
    client.on('audio', (audio) => output.push(audio));

    await client.connect();
    client.appendAudio(Buffer.from([1, 2, 3]));
    socket.emit('message', Buffer.from([4, 5, 6]), true);

    expect(socket.binarySent).toEqual([Buffer.from([1, 2, 3])]);
    expect(output).toEqual([Buffer.from([4, 5, 6])]);
    expect(socket.sent[0]).toMatchObject({
      session: {
        audio: {
          input: { format: { type: 'audio/pcm', rate: 16000 } },
          output: { format: { type: 'audio/pcm', rate: 32000 } },
        },
      },
    });

    client.updateSession({
      audio: {
        input: { format: { type: 'audio/pcm', rate: 48000 } },
        output: { format: { type: 'audio/pcm', rate: 44100 } },
      },
    });
    expect(socket.sent[1]).toMatchObject({
      type: 'session.update',
      session: {
        audio: {
          input: { format: { type: 'audio/pcm', rate: 48000 } },
          output: { format: { type: 'audio/pcm', rate: 44100 } },
        },
      },
    });
  });

  it('creates browser credentials and controls xAI SIP calls', async () => {
    const connector = Connector.create({
      name: 'xai-realtime-api-test',
      vendor: Vendor.Grok,
      auth: { type: 'api_key', apiKey: 'xai-test-key' },
    });
    const fetchMock = vi.spyOn(connector, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 'xai-secret', expires_at: 123 }), { status: 200 }))
      .mockResolvedValue(new Response(null, { status: 204 }));
    const api = new GrokRealtimeAPI(connector);

    expect((await api.createClientSecret(120)).value).toBe('xai-secret');
    await api.referCall('call/1', 'tel:+14155550123');
    await api.hangupCall('call/1');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.x.ai/v1/realtime/client_secrets');
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      expires_after: { seconds: 120 },
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.x.ai/v1/realtime/calls/call%2F1/refer');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('https://api.x.ai/v1/realtime/calls/call%2F1/hangup');
  });
});
