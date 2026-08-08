import { EventEmitter } from 'events';
import { Connector } from '../../../core/Connector.js';
import { Vendor } from '../../../core/Vendor.js';
import type {
  OpenAIRealtimeClientEvent,
  OpenAIRealtimeModel,
  OpenAIRealtimeServerEvent,
  OpenAIRealtimeSessionConfig,
  OpenAIRealtimeTranscriptionSessionConfig,
  OpenAIRealtimeTranslationSessionConfig,
} from './RealtimeTypes.js';
import { assertOpenAIRealtimePCMRates } from './RealtimeTypes.js';

interface WebSocketLike {
  readyState: number;
  on(event: string, listener: (...args: any[]) => void): void;
  removeAllListeners(event?: string): void;
  send(data: string | Buffer): void;
  close(code?: number, reason?: string): void;
}

export interface OpenAIRealtimeSessionOptions {
  connector: string | Connector;
  model?: OpenAIRealtimeModel;
  /** Dedicated translation sessions use `realtime/translations`. */
  endpoint?: 'realtime' | 'realtime/translations';
  /** xAI SIP call to join. When set, the model query parameter is omitted. */
  callId?: string;
  /** xAI conversation ID to resume after reconnecting. */
  conversationId?: string;
  /** xAI voice reasoning mode selected during the WebSocket handshake. */
  reasoningEffort?: 'none' | 'high';
  session?: OpenAIRealtimeSessionConfig
    | OpenAIRealtimeTranscriptionSessionConfig
    | OpenAIRealtimeTranslationSessionConfig;
  /** Stable, privacy-preserving end-user identifier sent as a header. */
  safetyIdentifier?: string;
  headers?: Record<string, string>;
  connectTimeoutMs?: number;
  /** Test/custom-runtime hook. Normal callers should leave this unset. */
  webSocketFactory?: (url: string, options: { headers: Record<string, string> }) => Promise<WebSocketLike> | WebSocketLike;
}

export interface OpenAIRealtimeSessionEvents {
  event: (event: OpenAIRealtimeServerEvent) => void;
  /** Raw assistant audio when xAI binary output transport is enabled. */
  audio: (audio: Buffer) => void;
  error: (error: Error) => void;
  close: (code: number, reason: string) => void;
}

/**
 * Connector-first, server-side WebSocket client for OpenAI's GA Realtime API.
 * It intentionally exposes the raw event stream while providing helpers for
 * the common conversation, audio, and response events.
 */
export class OpenAIRealtimeSession extends EventEmitter {
  readonly connector: Connector;
  readonly model: OpenAIRealtimeModel;
  readonly initialSession?: OpenAIRealtimeSessionOptions['session'];

  private readonly options: OpenAIRealtimeSessionOptions;
  private socket: WebSocketLike | null = null;
  private connected = false;
  private inputAudioTransport: 'json' | 'binary' = 'json';

  constructor(options: OpenAIRealtimeSessionOptions) {
    super();
    this.options = options;
    this.connector = typeof options.connector === 'string'
      ? Connector.get(options.connector)
      : options.connector;
    if (this.connector.vendor !== Vendor.Grok) {
      assertOpenAIRealtimePCMRates(options.session);
    }
    const sessionModel = options.session && 'model' in options.session
      ? options.session.model
      : undefined;
    this.model = options.model
      ?? sessionModel
      ?? (options.endpoint === 'realtime/translations'
        ? 'gpt-realtime-translate'
        : 'gpt-realtime-2.1');
    this.initialSession = options.session;
    this.inputAudioTransport = this.getInputAudioTransport(options.session) ?? 'json';
  }

  get isConnected(): boolean {
    return this.connected && this.socket?.readyState === 1;
  }

  async connect(): Promise<OpenAIRealtimeServerEvent> {
    if (this.socket) throw new Error('Realtime session is already connected');

    const token = await this.connector.getToken();
    let url = this.buildWebSocketURL();
    const headers: Record<string, string> = {
      ...this.options.headers,
      ...(this.options.safetyIdentifier
        ? { 'OpenAI-Safety-Identifier': this.options.safetyIdentifier }
        : {}),
    };
    const auth = this.connector.config.auth;
    if (auth.type === 'api_key' && auth.queryParamName) {
      const authenticatedURL = new URL(url);
      authenticatedURL.searchParams.set(auth.queryParamName, token);
      url = authenticatedURL.toString();
    } else {
      const headerName = auth.type === 'api_key'
        ? auth.headerName || 'Authorization'
        : 'Authorization';
      const prefix = auth.type === 'api_key' ? auth.headerPrefix ?? 'Bearer' : 'Bearer';
      headers[headerName] = prefix ? `${prefix} ${token}` : token;
    }
    const socket = this.options.webSocketFactory
      ? await this.options.webSocketFactory(url, { headers })
      : await this.createDefaultSocket(url, headers);
    this.socket = socket;

    const created = await new Promise<OpenAIRealtimeServerEvent>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        settled = true;
        reject(new Error(`Timeout waiting for ${this.providerLabel} Realtime session.created`));
      }, this.options.connectTimeoutMs ?? 15_000);

      const rejectOnce = (error: Error): void => {
        if (settled) {
          this.emit('error', error);
          return;
        }
        settled = true;
        clearTimeout(timeout);
        reject(error);
      };

      socket.on('message', (data: Buffer | string, isBinary?: boolean) => {
        if (isBinary) {
          this.emit('audio', Buffer.isBuffer(data) ? data : Buffer.from(data));
          return;
        }
        const event = this.parseEvent(data);
        if (!event) return;
        this.emitServerEvent(event);
        if (event.type === 'session.created') {
          settled = true;
          clearTimeout(timeout);
          this.connected = true;
          resolve(event);
        } else if (event.type === 'error') {
          const detail = event.error as { message?: string } | undefined;
          rejectOnce(new Error(detail?.message ?? `${this.providerLabel} Realtime session creation failed`));
        }
      });
      socket.on('error', (error: Error) => rejectOnce(error));
      socket.on('close', (code: number, reason: Buffer | string) => {
        this.connected = false;
        if (!settled) rejectOnce(new Error(`${this.providerLabel} Realtime WebSocket closed during connect: ${code}`));
        this.emit('close', code, reason?.toString() ?? '');
      });
    });

    if (this.initialSession) this.updateSession(this.initialSession);
    return created;
  }

  updateSession(session: NonNullable<OpenAIRealtimeSessionOptions['session']>): void {
    if (this.connector.vendor !== Vendor.Grok) {
      assertOpenAIRealtimePCMRates(session);
    }
    let normalized: Record<string, unknown>;
    if (this.isTranslationSession()) {
      // Translation selects its model in the WebSocket URL. Unlike the
      // translation client-secret body, session.update rejects `model`.
      const { model: _model, ...translationSession } = session as typeof session & { model?: string };
      normalized = translationSession;
    } else {
      normalized = { ...session, type: 'type' in session ? session.type : 'realtime' };
    }
    this.inputAudioTransport = this.getInputAudioTransport(session) ?? this.inputAudioTransport;
    this.send({ type: 'session.update', session: normalized });
  }

  appendAudio(audio: Buffer | string): void {
    if (this.inputAudioTransport === 'binary') {
      if (!this.socket || this.socket.readyState !== 1) {
        throw new Error(`${this.providerLabel} Realtime WebSocket is not open`);
      }
      this.socket.send(typeof audio === 'string' ? Buffer.from(audio, 'base64') : audio);
      return;
    }
    this.send({
      type: this.isTranslationSession()
        ? 'session.input_audio_buffer.append'
        : 'input_audio_buffer.append',
      audio: typeof audio === 'string' ? audio : audio.toString('base64'),
    });
  }

  commitAudio(): void { this.send({ type: 'input_audio_buffer.commit' }); }
  clearAudio(): void { this.send({ type: 'input_audio_buffer.clear' }); }
  createResponse(response: Record<string, unknown> = {}): void {
    this.send({ type: 'response.create', ...(Object.keys(response).length ? { response } : {}) });
  }
  cancelResponse(): void { this.send({ type: 'response.cancel' }); }

  /** Flush and close a translation stream after handling `session.closed`. */
  closeTranslation(): void {
    if (!this.isTranslationSession()) {
      throw new Error('session.close is only supported for realtime translation sessions');
    }
    this.send({ type: 'session.close' });
  }

  sendText(text: string): void {
    this.send({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
    });
  }

  sendImage(imageUrl: string): void {
    this.send({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_image', image_url: imageUrl }] },
    });
  }

  truncateItem(itemId: string, audioEndMs: number, contentIndex = 0): void {
    this.send({
      type: 'conversation.item.truncate',
      item_id: itemId,
      content_index: contentIndex,
      audio_end_ms: Math.max(0, Math.round(audioEndMs)),
    });
  }

  send(event: OpenAIRealtimeClientEvent): void {
    if (!this.socket || this.socket.readyState !== 1) {
      throw new Error(`${this.providerLabel} Realtime WebSocket is not open`);
    }
    this.socket.send(JSON.stringify(event));
  }

  close(code = 1000, reason = 'OK'): void {
    const socket = this.socket;
    this.socket = null;
    this.connected = false;
    if (!socket) return;
    socket.removeAllListeners();
    if (socket.readyState === 0 || socket.readyState === 1) socket.close(code, reason);
  }

  on<K extends keyof OpenAIRealtimeSessionEvents>(event: K, handler: OpenAIRealtimeSessionEvents[K]): this {
    return super.on(event, handler);
  }

  private async createDefaultSocket(url: string, headers: Record<string, string>): Promise<WebSocketLike> {
    const { default: WebSocket } = await import('ws' as string);
    return new WebSocket(url, { headers }) as WebSocketLike;
  }

  private buildWebSocketURL(): string {
    const base = this.connector.baseURL
      || (this.connector.vendor === 'grok' ? 'https://api.x.ai/v1' : 'https://api.openai.com/v1');
    const url = new URL(base);
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
    const endpoint = this.options.endpoint
      ?? (this.model === 'gpt-realtime-translate' ? 'realtime/translations' : 'realtime');
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${endpoint}`;
    if (this.options.callId) {
      url.searchParams.set('call_id', this.options.callId);
    } else if (this.initialSession
      && 'type' in this.initialSession
      && this.initialSession.type === 'transcription') {
      // Select the transcription protocol; its model is configured inside
      // session.audio.input.transcription rather than in the query string.
      url.searchParams.set('intent', 'transcription');
    } else {
      url.searchParams.set('model', this.model);
    }
    if (this.options.conversationId) {
      url.searchParams.set('conversation_id', this.options.conversationId);
    }
    if (this.options.reasoningEffort) {
      url.searchParams.set('reasoning.effort', this.options.reasoningEffort);
    }
    return url.toString();
  }

  private get providerLabel(): string {
    return this.connector.vendor === 'grok' ? 'xAI' : 'OpenAI';
  }

  private getInputAudioTransport(
    session: OpenAIRealtimeSessionOptions['session']
  ): 'json' | 'binary' | undefined {
    if (!session || !('audio' in session) || !session.audio || !('input' in session.audio)) {
      return undefined;
    }
    const input = session.audio.input;
    return input && 'transport' in input ? input.transport : undefined;
  }

  private isTranslationSession(): boolean {
    return this.options.endpoint === 'realtime/translations'
      || this.model === 'gpt-realtime-translate';
  }

  private parseEvent(data: Buffer | string): OpenAIRealtimeServerEvent | null {
    try {
      return JSON.parse(typeof data === 'string' ? data : data.toString()) as OpenAIRealtimeServerEvent;
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  private emitServerEvent(event: OpenAIRealtimeServerEvent): void {
    this.emit('event', event);
    // Node reserves the `error` event for Error instances. API error payloads
    // remain available on the raw `event` stream and are not re-emitted under
    // that reserved name.
    if (event.type !== 'error') this.emit(event.type, event);
  }
}
