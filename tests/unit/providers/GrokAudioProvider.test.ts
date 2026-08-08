import { afterEach, describe, expect, it, vi } from 'vitest';
import { GrokSTTProvider } from '@/infrastructure/providers/grok/GrokSTTProvider.js';
import { GrokTTSProvider } from '@/infrastructure/providers/grok/GrokTTSProvider.js';

type Listener = (...args: any[]) => void;

class FakeSocket {
  readyState = 1;
  sent: Array<string | Buffer> = [];
  listeners = new Map<string, Listener[]>();

  on(event: string, listener: Listener): void {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  send(data: string | Buffer): void {
    this.sent.push(data);
  }

  close(): void {}

  emit(event: string, ...args: any[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }
}

describe('xAI audio providers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('decodes the documented JSON/base64 TTS response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      audio: Buffer.from('speech').toString('base64'),
      duration: 0.5,
    }), { headers: { 'content-type': 'application/json' } })));
    const provider = new GrokTTSProvider({ auth: { type: 'api_key', apiKey: 'test' } });

    const response = await provider.synthesize({ model: 'xai-tts', input: 'hello', voice: 'eve' });

    expect(response.audio.toString()).toBe('speech');
    expect(response.durationSeconds).toBe(0.5);
  });

  it('reports the xAI response codec when output_format overrides the normalized format', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(Buffer.from('RIFFwave'), {
      headers: { 'content-type': 'audio/wav' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GrokTTSProvider({ auth: { type: 'api_key', apiKey: 'test' } });

    const response = await provider.synthesize({
      model: 'xai-tts',
      input: 'hello',
      voice: 'eve',
      format: 'mp3',
      vendorOptions: { output_format: { codec: 'wav', sample_rate: 44100 } },
    });

    expect(response.format).toBe('wav');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      output_format: { codec: 'wav', sample_rate: 44100 },
    });
  });

  it('uses content_type from timestamped xAI JSON responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      audio: Buffer.from('wave').toString('base64'),
      content_type: 'audio/wav',
    }), { headers: { 'content-type': 'application/json' } })));
    const provider = new GrokTTSProvider({ auth: { type: 'api_key', apiKey: 'test' } });

    const response = await provider.synthesize({
      model: 'xai-tts', input: 'hello', voice: 'eve', format: 'mp3',
    });

    expect(response.format).toBe('wav');
  });

  it('streams TTS with the current delta event contract', async () => {
    const socket = new FakeSocket();
    socket.send = (data) => {
      socket.sent.push(data);
      if (typeof data === 'string' && JSON.parse(data).type === 'text.done') {
        queueMicrotask(() => {
          socket.emit('message', JSON.stringify({ type: 'audio.delta', delta: Buffer.from('a').toString('base64') }));
          socket.emit('message', JSON.stringify({ type: 'audio.done' }));
        });
      }
    };
    const provider = new GrokTTSProvider({ auth: { type: 'api_key', apiKey: 'test' } });
    const chunks = [];
    for await (const chunk of provider.synthesizeStream({
      model: 'xai-tts',
      input: 'hello',
      voice: 'eve',
      vendorOptions: { webSocketFactory: () => socket },
    })) chunks.push(chunk);

    expect(JSON.parse(socket.sent[0] as string)).toEqual({ type: 'text.delta', delta: 'hello' });
    expect(chunks.map((chunk) => [chunk.audio.toString(), chunk.isFinal])).toEqual([
      ['a', false],
      ['', true],
    ]);
  });

  it('maps xAI REST transcription words', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      text: 'hello',
      language: 'en',
      duration: 0.4,
      words: [{ text: 'hello', start: 0, end: 0.4, speaker: 1 }],
    }), { headers: { 'content-type': 'application/json' } })));
    const provider = new GrokSTTProvider({ auth: { type: 'api_key', apiKey: 'test' } });

    const response = await provider.transcribe({ model: 'xai-stt', audio: Buffer.from([0, 1]) });

    expect(response.text).toBe('hello');
    expect(response.words?.[0]).toMatchObject({ word: 'hello', speaker: 1 });
  });

  it('sends the normalized raw-audio sample rate for telephony PCM', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'hello' }), {
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GrokSTTProvider({ auth: { type: 'api_key', apiKey: 'test' } });

    await provider.transcribe({
      model: 'xai-stt',
      audio: Buffer.from([0, 1]),
      encoding: 'pcm',
      sampleRate: 8000,
    });

    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.get('audio_format')).toBe('pcm');
    expect(form.get('sample_rate')).toBe('8000');
  });

  it('streams raw STT audio only after transcript.created and normalizes transcript events', async () => {
    const socket = new FakeSocket();
    let requestedUrl = '';
    socket.on = (event, listener) => {
      FakeSocket.prototype.on.call(socket, event, listener);
      if (event === 'message' && (socket.listeners.get(event)?.length ?? 0) === 1) {
        queueMicrotask(() => socket.emit('message', JSON.stringify({ type: 'transcript.created' })));
      }
    };
    socket.send = (data) => {
      socket.sent.push(data);
      if (typeof data === 'string' && JSON.parse(data).type === 'audio.done') {
        queueMicrotask(() => {
          socket.emit('message', JSON.stringify({
            type: 'transcript.partial', text: 'hello', is_final: true,
            speech_final: true, end_of_turn_confidence: 0.92,
          }));
          socket.emit('message', JSON.stringify({ type: 'transcript.done', text: 'hello', duration: 0.1 }));
        });
      }
    };
    const provider = new GrokSTTProvider({ auth: { type: 'api_key', apiKey: 'test' } });
    const events = [];
    for await (const event of provider.transcribeStream({
      model: 'xai-stt',
      audio: [Buffer.from([1, 2]), { type: 'finalize' as const }],
      sampleRate: 16000,
      interimResults: true,
      vendorOptions: {
        smart_turn: 0.7,
        keyterms: ['OneRingAI'],
        webSocketFactory: (url: string) => {
          requestedUrl = url;
          return socket;
        },
      },
    })) events.push(event);

    expect(requestedUrl).toContain('interim_results=true');
    expect(requestedUrl).toContain('smart_turn=0.7');
    expect(requestedUrl).toContain('keyterm=OneRingAI');
    expect(Buffer.isBuffer(socket.sent[0])).toBe(true);
    expect(JSON.parse(socket.sent[1] as string)).toEqual({ type: 'Finalize' });
    expect(events.map((event) => event.type)).toEqual(['created', 'transcript', 'done']);
    expect(events[1]).toMatchObject({ text: 'hello', speechFinal: true, endOfTurnConfidence: 0.92 });
  });

  it('waits for every xAI multichannel transcript.done event', async () => {
    const socket = new FakeSocket();
    socket.on = (event, listener) => {
      FakeSocket.prototype.on.call(socket, event, listener);
      if (event === 'message' && (socket.listeners.get(event)?.length ?? 0) === 1) {
        queueMicrotask(() => socket.emit('message', JSON.stringify({ type: 'transcript.created' })));
      }
    };
    socket.send = (data) => {
      socket.sent.push(data);
      if (typeof data === 'string' && JSON.parse(data).type === 'audio.done') {
        queueMicrotask(() => {
          socket.emit('message', JSON.stringify({
            type: 'transcript.done', text: 'left', channel_index: 0,
          }));
          socket.emit('message', JSON.stringify({
            type: 'transcript.done', text: 'right', channel_index: 1,
          }));
        });
      }
    };
    const provider = new GrokSTTProvider({ auth: { type: 'api_key', apiKey: 'test' } });
    const events = [];

    for await (const event of provider.transcribeStream({
      model: 'xai-stt',
      audio: [Buffer.from([1, 2])],
      vendorOptions: {
        multichannel: true,
        channels: 2,
        webSocketFactory: () => socket,
      },
    })) events.push(event);

    expect(events.filter((event) => event.type === 'done')).toMatchObject([
      { text: 'left', channel: 0 },
      { text: 'right', channel: 1 },
    ]);
  });
});
