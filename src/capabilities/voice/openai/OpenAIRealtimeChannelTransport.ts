import { EventEmitter } from 'events';
import type { OpenAIRealtimeAgentTransport } from './OpenAIRealtimeAgentSession.js';
import type {
  OpenAIRealtimeClientEvent,
  OpenAIRealtimeServerEvent,
  OpenAIRealtimeSessionConfig,
} from './RealtimeTypes.js';
import type { RealtimeMessageChannel } from './RealtimeChannel.js';

export interface OpenAIRealtimeChannelTransportOptions {
  channel: RealtimeMessageChannel;
  connectTimeoutMs?: number;
  /** Stop accepting sends when channel buffering reaches this size. Default: 1 MiB. */
  maxBufferedAmountBytes?: number;
  /** Maximum event count retained until connect() begins. Default: 256. */
  maxPendingEvents?: number;
  /** Maximum UTF-8 bytes retained until connect() begins. Default: 1 MiB. */
  maxPendingEventBytes?: number;
}

/**
 * Adapts a browser data channel or cross-process text bridge to the transport
 * consumed by OpenAIRealtimeAgentSession. Audio may remain on WebRTC media tracks.
 */
export class OpenAIRealtimeChannelTransport extends EventEmitter implements OpenAIRealtimeAgentTransport {
  readonly emitsOutputAudioFromEvents = false;
  private readonly channel: RealtimeMessageChannel;
  private readonly options: OpenAIRealtimeChannelTransportOptions;
  private connected = false;
  private destroyed = false;
  private createdEvent: OpenAIRealtimeServerEvent | null = null;
  private eventsReady = false;
  private pendingEvents: Array<{ event: OpenAIRealtimeServerEvent; bytes: number }> = [];
  private pendingEventBytes = 0;
  private pendingError: Error | null = null;
  private readonly unsubscribe: Array<() => void>;

  constructor(options: OpenAIRealtimeChannelTransportOptions) {
    super();
    this.options = options;
    this.channel = options.channel;
    this.unsubscribe = [
      this.channel.onMessage((message) => this.handleMessage(message)),
      this.channel.onClose((code, reason) => {
        this.connected = false;
        this.createdEvent = null;
        this.pendingEvents = [];
        this.pendingEventBytes = 0;
        this.emit('close', code, reason);
      }),
      this.channel.onError((error) => this.reportError(error)),
    ];
    const createdMessage = this.channel.getSessionCreatedMessage?.();
    if (createdMessage && !this.createdEvent) this.handleMessage(createdMessage);
  }

  get isConnected(): boolean {
    return !this.destroyed && this.connected && this.channel.isOpen;
  }

  async connect(options: { signal?: AbortSignal } = {}): Promise<OpenAIRealtimeServerEvent> {
    if (this.destroyed) throw new Error('Realtime channel transport is destroyed');
    if (this.connected) throw new Error('Realtime channel transport is already connected');
    if (this.pendingError) throw this.pendingError;
    if (this.channel.open) await this.channel.open(options);
    if (this.pendingError) throw this.pendingError;
    if (!this.channel.isOpen) throw new Error('Realtime message channel did not open');
    if (this.createdEvent) {
      this.connected = true;
      this.eventsReady = true;
      this.flushPendingEvents();
      return this.createdEvent;
    }

    this.eventsReady = true;
    this.flushPendingEvents();

    const created = await new Promise<OpenAIRealtimeServerEvent>((resolve, reject) => {
      let settled = false;
      const settle = (action: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', onAbort);
        this.off('event', onEvent);
        this.off('error', onError);
        this.off('close', onClose);
        action();
      };
      const onEvent = (event: OpenAIRealtimeServerEvent): void => {
        if (event.type === 'session.created') settle(() => resolve(event));
        if (event.type === 'error') {
          const detail = event.error as { message?: string } | undefined;
          settle(() => reject(new Error(detail?.message ?? 'OpenAI Realtime session creation failed')));
        }
      };
      const onError = (error: Error): void => settle(() => reject(error));
      const onClose = (code: number, reason: string): void => settle(() => reject(
        new Error(`Realtime message channel closed during connect: ${code} ${reason}`.trim()),
      ));
      const onAbort = (): void => settle(() => reject(abortError(options.signal?.reason)));
      const timeout = setTimeout(() => settle(() => reject(
        new Error('Timeout waiting for OpenAI Realtime session.created'),
      )), this.options.connectTimeoutMs ?? 15_000);

      this.on('event', onEvent);
      this.on('error', onError);
      this.on('close', onClose);
      options.signal?.addEventListener('abort', onAbort, { once: true });
      if (options.signal?.aborted) onAbort();
    });
    this.connected = true;
    return created;
  }

  updateSession(session: OpenAIRealtimeSessionConfig): void {
    this.send({
      type: 'session.update',
      session: { ...session, type: session.type ?? 'realtime' },
    });
  }

  appendAudio(audio: Buffer | string): boolean {
    if (!this.canSend()) return false;
    this.send({
      type: 'input_audio_buffer.append',
      audio: typeof audio === 'string' ? audio : audio.toString('base64'),
    });
    return true;
  }

  send(event: OpenAIRealtimeClientEvent): void {
    if (this.destroyed || !this.channel.isOpen) {
      throw new Error('Realtime message channel is not open');
    }
    if (!this.canSend()) throw new Error('Realtime message channel is backpressured');
    this.channel.send(JSON.stringify(event));
  }

  close(code = 1000, reason = 'Client closed'): void {
    if (this.destroyed) return;
    this.connected = false;
    this.destroyed = true;
    this.pendingEvents = [];
    this.pendingEventBytes = 0;
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.channel.close(code, reason);
    this.removeAllListeners();
  }

  private canSend(): boolean {
    const limit = this.options.maxBufferedAmountBytes ?? 1024 * 1024;
    const bufferedAmount = this.channel.bufferedAmount ?? 0;
    if (limit > 0 && bufferedAmount >= limit) {
      this.emit('backpressure', { bufferedAmount, limit });
      return false;
    }
    return true;
  }

  private handleMessage(message: string): void {
    if (this.destroyed) return;
    try {
      const event = JSON.parse(message) as OpenAIRealtimeServerEvent;
      if (!event || typeof event !== 'object' || typeof event.type !== 'string') {
        throw new TypeError('Realtime channel message is not a server event');
      }
      if (event.type === 'session.created') {
        this.createdEvent = event;
        if (this.eventsReady && this.channel.isOpen) this.connected = true;
      }
      if (!this.eventsReady) {
        const bytes = new TextEncoder().encode(message).byteLength;
        const maxEvents = this.options.maxPendingEvents ?? 256;
        const maxBytes = this.options.maxPendingEventBytes ?? 1024 * 1024;
        if (maxEvents <= 0
          || maxBytes <= 0
          || this.pendingEvents.length >= maxEvents
          || this.pendingEventBytes + bytes > maxBytes) {
          const error = new Error('Realtime channel pending event buffer exceeded its limit');
          this.pendingError = error;
          this.channel.close(1009, 'Pending event buffer exceeded');
          this.reportError(error);
          return;
        }
        this.pendingEvents.push({ event, bytes });
        this.pendingEventBytes += bytes;
        return;
      }
      this.emit('event', event);
    } catch (error) {
      this.reportError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private flushPendingEvents(): void {
    const pending = this.pendingEvents;
    this.pendingEvents = [];
    this.pendingEventBytes = 0;
    for (const { event } of pending) this.emit('event', event);
  }

  private reportError(error: Error): void {
    if (this.listenerCount('error') > 0) this.emit('error', error);
    else this.pendingError ??= error;
  }
}

function abortError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  const error = new Error(typeof reason === 'string' && reason ? reason : 'Realtime connection aborted');
  error.name = 'AbortError';
  return error;
}
