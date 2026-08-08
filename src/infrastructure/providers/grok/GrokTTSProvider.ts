import { BaseMediaProvider } from '../base/BaseMediaProvider.js';
import type {
  IStreamingTextToSpeechProvider,
  TTSOptions,
  TTSResponse,
  TTSStreamChunk,
} from '../../../domain/interfaces/IAudioProvider.js';
import type { AudioFormat } from '../../../domain/types/SharedTypes.js';
import type { ProviderCapabilities } from '../../../domain/interfaces/IProvider.js';
import type { GrokMediaConfig } from '../../../domain/types/ProviderConfig.js';
import type { IVoiceInfo } from '../../../domain/entities/SharedVoices.js';
import { XAI_VOICES } from '../../../domain/entities/SharedVoices.js';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderError,
} from '../../../domain/errors/AIErrors.js';

/** xAI's dedicated TTS endpoint is not OpenAI-compatible. */
export class GrokTTSProvider extends BaseMediaProvider implements IStreamingTextToSpeechProvider {
  readonly name = 'grok-tts';
  readonly vendor = 'grok' as const;
  readonly capabilities: ProviderCapabilities = {
    text: false,
    images: false,
    videos: false,
    audio: true,
    features: { textToSpeech: true },
  };

  private readonly apiKey: string;
  private readonly baseURL: string;

  constructor(config: GrokMediaConfig) {
    super({ apiKey: config.auth.apiKey, ...config });
    this.apiKey = config.auth.apiKey;
    this.baseURL = (config.baseURL || 'https://api.x.ai/v1').replace(/\/$/, '');
  }

  async synthesize(options: TTSOptions): Promise<TTSResponse> {
    return this.executeWithCircuitBreaker(async () => {
      const response = await this.request(options);
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('json')) {
        const audio = Buffer.from(await response.arrayBuffer());
        return {
          audio,
          format: this.resolveResponseFormat(contentType, options),
          charactersUsed: options.input.length,
        };
      }
      const payload = await response.json() as {
        audio: string;
        content_type?: string;
        duration?: number;
        audio_timestamps?: { graph_chars?: string[]; graph_times?: Array<[number, number]> };
      };
      const chars = payload.audio_timestamps?.graph_chars ?? [];
      const times = payload.audio_timestamps?.graph_times ?? [];
      return {
        audio: Buffer.from(payload.audio, 'base64'),
        format: this.resolveResponseFormat(payload.content_type, options),
        durationSeconds: payload.duration,
        charactersUsed: options.input.length,
        ...(chars.length > 0 && {
          characterTimestamps: chars.map((character, index) => ({
            character,
            start: times[index]?.[0] ?? 0,
            end: times[index]?.[1] ?? 0,
          })),
        }),
      };
    }, 'tts.synthesize', { model: options.model, voice: options.voice });
  }

  supportsStreaming(format?: AudioFormat): boolean {
    return !format || ['mp3', 'wav', 'pcm', 'mulaw', 'alaw'].includes(format);
  }

  async *synthesizeStream(options: TTSOptions): AsyncIterableIterator<TTSStreamChunk> {
    const vendor = options.vendorOptions ?? {};
    const url = new URL(`${this.baseURL}/tts`);
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
    url.searchParams.set('voice', options.voice || 'eve');
    url.searchParams.set('language', String(vendor.language ?? 'auto'));
    url.searchParams.set('codec', this.resolveRequestedFormat(options));
    url.searchParams.set('sample_rate', String(vendor.sample_rate ?? 24000));
    if (options.speed !== undefined) url.searchParams.set('speed', String(options.speed));
    for (const key of ['bit_rate', 'optimize_streaming_latency', 'text_normalization', 'with_timestamps']) {
      if (vendor[key] !== undefined) url.searchParams.set(key, String(vendor[key]));
    }

    type Socket = {
      readyState: number;
      on(event: string, listener: (...args: any[]) => void): void;
      send(data: string): void;
      close(): void;
    };
    const factory = vendor.webSocketFactory as
      | ((url: string, options: { headers: Record<string, string> }) => Socket | Promise<Socket>)
      | undefined;
    const socket = factory
      ? await factory(url.toString(), { headers: { Authorization: `Bearer ${this.apiKey}` } })
      : await this.createSocket(url.toString());
    const queued: Array<Record<string, any>> = [];
    const waiters: Array<(event: Record<string, any>) => void> = [];
    let socketError: Error | undefined;
    const push = (event: Record<string, any>): void => {
      const waiter = waiters.shift();
      if (waiter) waiter(event);
      else queued.push(event);
    };
    socket.on('message', (data: Buffer | string) => {
      try {
        push(JSON.parse(typeof data === 'string' ? data : data.toString()) as Record<string, any>);
      } catch (error) {
        socketError = error instanceof Error ? error : new Error(String(error));
        push({ type: 'error', message: socketError.message });
      }
    });
    socket.on('error', (error: Error) => {
      socketError = error;
      push({ type: 'error', message: error.message });
    });
    socket.on('close', () => push({ type: 'closed' }));
    if (socket.readyState !== 1) {
      await new Promise<void>((resolve, reject) => {
        socket.on('open', resolve);
        socket.on('error', reject);
      });
    }
    socket.send(JSON.stringify({ type: 'text.delta', delta: options.input }));
    socket.send(JSON.stringify({ type: 'text.done' }));

    try {
      while (true) {
        const event = queued.shift() ?? await new Promise<Record<string, any>>((resolve) => waiters.push(resolve));
        if (event.type === 'audio.delta') {
          yield { audio: Buffer.from(event.delta ?? event.audio ?? '', 'base64'), isFinal: false };
        } else if (event.type === 'audio.done') {
          break;
        } else if (event.type === 'error') {
          throw socketError ?? new ProviderError('grok', event.message ?? 'xAI streaming TTS failed');
        } else if (event.type === 'closed') {
          throw new ProviderError('grok', 'xAI streaming TTS connection closed before audio.done');
        }
      }
    } finally {
      socket.close();
    }
    yield { audio: Buffer.alloc(0), isFinal: true };
  }

  async listVoices(): Promise<IVoiceInfo[]> {
    const response = await fetch(`${this.baseURL}/tts/voices`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) await this.throwResponseError(response);
    const payload = await response.json() as {
      voices?: Array<{ voice_id: string; name: string; language?: string }>;
    };
    return payload.voices?.map((voice) => ({
      id: voice.voice_id,
      name: voice.name,
      language: voice.language ?? 'multi',
      gender: XAI_VOICES.find((known) => known.id === voice.voice_id)?.gender ?? 'neutral',
      isDefault: voice.voice_id === 'eve',
    })) ?? XAI_VOICES;
  }

  private async createSocket(url: string): Promise<{
    readyState: number;
    on(event: string, listener: (...args: any[]) => void): void;
    send(data: string): void;
    close(): void;
  }> {
    const { default: WebSocket } = await import('ws' as string);
    return new WebSocket(url, { headers: { Authorization: `Bearer ${this.apiKey}` } });
  }

  private async request(options: TTSOptions): Promise<Response> {
    const vendorOptions = options.vendorOptions ?? {};
    const response = await fetch(`${this.baseURL}/tts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...vendorOptions,
        text: options.input,
        voice_id: options.voice || 'eve',
        language: vendorOptions.language ?? 'auto',
        speed: options.speed,
        output_format: vendorOptions.output_format ?? { codec: this.resolveRequestedFormat(options) },
      }),
    });
    if (!response.ok) await this.throwResponseError(response);
    return response;
  }

  private resolveRequestedFormat(options: TTSOptions): AudioFormat {
    const configured = options.vendorOptions?.output_format;
    const codec = configured && typeof configured === 'object'
      ? (configured as { codec?: unknown }).codec
      : undefined;
    return this.toAudioFormat(codec) ?? options.format ?? 'mp3';
  }

  private resolveResponseFormat(contentType: string | undefined, options: TTSOptions): AudioFormat {
    const normalized = contentType?.split(';', 1)[0]?.trim().toLowerCase();
    const fromContentType: Partial<Record<string, AudioFormat>> = {
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/pcm': 'pcm',
      'audio/basic': 'mulaw',
      'audio/alaw': 'alaw',
      'audio/opus': 'opus',
      'audio/aac': 'aac',
      'audio/flac': 'flac',
      'audio/ogg': 'ogg',
    };
    return (normalized ? fromContentType[normalized] : undefined)
      ?? this.resolveRequestedFormat(options);
  }

  private toAudioFormat(value: unknown): AudioFormat | undefined {
    return typeof value === 'string'
      && ['mp3', 'wav', 'pcm', 'mulaw', 'alaw', 'opus', 'aac', 'flac', 'ogg'].includes(value)
      ? value as AudioFormat
      : undefined;
  }

  private async throwResponseError(response: Response): Promise<never> {
    const message = await response.text();
    if (response.status === 401) throw new ProviderAuthError('grok', 'Invalid API key');
    if (response.status === 429) throw new ProviderRateLimitError('grok');
    throw new ProviderError('grok', `xAI TTS error ${response.status}: ${message}`);
  }
}
