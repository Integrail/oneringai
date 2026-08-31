import type {
  OpenAIRealtimeClientEvent,
  OpenAIRealtimeServerEvent,
} from '../capabilities/voice/openai/RealtimeTypes.js';
import type {
  OpenAIRealtimeWebRTCCall,
  RealtimeMessageChannel,
} from '../capabilities/voice/openai/RealtimeChannel.js';

interface MediaStreamTrackLike { stop(): void }
interface MediaStreamLike { getTracks(): MediaStreamTrackLike[] }
interface DataChannelLike {
  readonly readyState: string;
  readonly bufferedAmount: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: (() => void) | null;
  send(data: string): void;
  close(): void;
}
interface PeerConnectionLike {
  localDescription?: { sdp?: string } | null;
  connectionState?: string;
  ontrack: ((event: { streams?: unknown[]; track?: unknown }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  addTrack(track: MediaStreamTrackLike, stream: MediaStreamLike): unknown;
  createDataChannel(label: string): DataChannelLike;
  createOffer(): Promise<{ type?: string; sdp?: string }>;
  setLocalDescription(description: { type?: string; sdp?: string }): Promise<void>;
  setRemoteDescription(description: { type: 'answer'; sdp: string }): Promise<void>;
  close(): void;
}

export interface OpenAIRealtimeWebRTCPeerOptions {
  exchangeSdp: (
    offer: string,
    options: { signal?: AbortSignal },
  ) => Promise<OpenAIRealtimeWebRTCCall>;
  /** Trusted host callback that terminates a provider call after close or failed setup. */
  releaseCall?: (callId: string) => void | Promise<void>;
  rtcConfiguration?: unknown;
  mediaConstraints?: unknown;
  localStream?: MediaStreamLike;
  acquireMedia?: (constraints: unknown) => Promise<MediaStreamLike>;
  peerConnectionFactory?: (configuration?: unknown) => PeerConnectionLike;
  dataChannelLabel?: string;
  connectTimeoutMs?: number;
  maxBufferedAmountBytes?: number;
  /** Maximum event count retained before the first raw-message or parsed-event subscriber. Default: 256. */
  maxPendingMessages?: number;
  /** Maximum UTF-8 bytes retained before the first raw-message or parsed-event subscriber. Default: 1 MiB. */
  maxPendingMessageBytes?: number;
  stopLocalTracksOnClose?: boolean;
  onRemoteTrack?: (streamOrTrack: unknown) => void;
}

export interface OpenAIRealtimeWebRTCPeerEvents {
  message: (message: string) => void;
  event: (event: OpenAIRealtimeServerEvent) => void;
  state: (state: string) => void;
  error: (error: Error) => void;
  close: (code: number, reason: string) => void;
  backpressure: (info: { bufferedAmount: number; limit: number }) => void;
}

/** Browser-safe WebRTC media peer and Realtime data-channel endpoint. */
export class OpenAIRealtimeWebRTCPeer implements RealtimeMessageChannel {
  private readonly handlers = new Map<keyof OpenAIRealtimeWebRTCPeerEvents, Set<(...args: never[]) => void>>();
  private readonly options: OpenAIRealtimeWebRTCPeerOptions;
  private peer: PeerConnectionLike | null = null;
  private dataChannel: DataChannelLike | null = null;
  private localStream: MediaStreamLike | null = null;
  private opening: Promise<OpenAIRealtimeWebRTCCall> | null = null;
  private call: OpenAIRealtimeWebRTCCall | null = null;
  private sessionCreatedMessage: string | null = null;
  private pendingMessages: string[] = [];
  private pendingMessageBytes = 0;
  private readonly releaseCallPromises = new Map<string, Promise<void>>();
  private shutdownReleasePromise: Promise<void> | null = null;
  private closed = false;

  constructor(options: OpenAIRealtimeWebRTCPeerOptions) {
    this.options = options;
  }

  get isOpen(): boolean { return !this.closed && this.dataChannel?.readyState === 'open'; }
  get bufferedAmount(): number { return this.dataChannel?.bufferedAmount ?? 0; }
  get callId(): string | undefined { return this.call?.callId || undefined; }
  getSessionCreatedMessage(): string | undefined {
    return this.sessionCreatedMessage ?? undefined;
  }

  async open(options: { signal?: AbortSignal } = {}): Promise<void> {
    await this.connect(options);
  }

  async connect(options: { signal?: AbortSignal } = {}): Promise<OpenAIRealtimeWebRTCCall> {
    if (this.closed) throw new Error('Realtime WebRTC peer is closed');
    if (this.call && this.isOpen) return this.call;
    if (this.opening) return this.opening;
    this.opening = this.connectInternal(options.signal).finally(() => { this.opening = null; });
    return this.opening;
  }

  send(message: string | OpenAIRealtimeClientEvent): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('OpenAI Realtime data channel is not open');
    }
    const limit = this.options.maxBufferedAmountBytes ?? 1024 * 1024;
    if (limit > 0 && this.dataChannel.bufferedAmount >= limit) {
      this.emit('backpressure', { bufferedAmount: this.dataChannel.bufferedAmount, limit });
      throw new Error('OpenAI Realtime data channel is backpressured');
    }
    this.dataChannel.send(typeof message === 'string' ? message : JSON.stringify(message));
  }

  close(code = 1000, reason = 'Client closed'): void {
    this.shutdown(code, reason, true);
  }

  /** Close local media and wait for the trusted host to terminate the provider call. */
  async closeAndRelease(code = 1000, reason = 'Client closed'): Promise<void> {
    const opening = this.opening;
    this.shutdown(code, reason, true);
    if (opening) await opening.catch(() => undefined);
    if (this.shutdownReleasePromise) await this.shutdownReleasePromise;
  }

  on<K extends keyof OpenAIRealtimeWebRTCPeerEvents>(
    event: K,
    handler: OpenAIRealtimeWebRTCPeerEvents[K],
  ): () => void {
    let handlers = this.handlers.get(event);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(event, handlers);
    }
    handlers.add(handler as (...args: never[]) => void);
    return () => handlers?.delete(handler as (...args: never[]) => void);
  }

  onMessage(handler: (message: string) => void): () => void {
    const unsubscribe = this.on('message', handler);
    if (this.pendingMessages.length > 0) {
      const pending = this.pendingMessages;
      this.pendingMessages = [];
      this.pendingMessageBytes = 0;
      this.sessionCreatedMessage = null;
      for (const message of pending) handler(message);
    }
    return unsubscribe;
  }
  onClose(handler: (code: number, reason: string) => void): () => void { return this.on('close', handler); }
  onError(handler: (error: Error) => void): () => void { return this.on('error', handler); }

  private async connectInternal(signal?: AbortSignal): Promise<OpenAIRealtimeWebRTCCall> {
    throwIfAborted(signal);
    const peer = this.createPeerConnection();
    let stream: MediaStreamLike | null = null;
    let channel: DataChannelLike | null = null;
    let createdCallId: string | null = null;
    let streamAttached = false;
    this.peer = peer;
    try {
      peer.ontrack = (event) => {
        this.options.onRemoteTrack?.(event.streams?.[0] ?? event.track);
      };
      peer.onconnectionstatechange = () => {
        const state = peer.connectionState ?? 'unknown';
        this.emit('state', state);
        if (state === 'failed') {
          this.emit('error', new Error(`OpenAI Realtime peer connection ${state}`));
          this.shutdown(1006, 'Peer connection failed', true);
        } else if (state === 'disconnected') {
          this.emit('error', new Error(`OpenAI Realtime peer connection ${state}`));
        }
      };

      stream = this.options.localStream ?? await this.acquireMedia();
      this.assertOpen(signal);
      this.localStream = stream;
      streamAttached = true;
      for (const track of stream.getTracks()) peer.addTrack(track, stream);

      channel = peer.createDataChannel(this.options.dataChannelLabel ?? 'oai-events');
      this.dataChannel = channel;
      this.wireDataChannel(channel);

      const offer = await peer.createOffer();
      this.assertOpen(signal);
      await peer.setLocalDescription(offer);
      this.assertOpen(signal);
      const sdp = peer.localDescription?.sdp ?? offer.sdp;
      if (!sdp) throw new Error('WebRTC offer did not contain SDP');
      const exchanged = await this.options.exchangeSdp(sdp, { signal });
      if (exchanged && typeof exchanged === 'object'
        && typeof exchanged.callId === 'string'
        && exchanged.callId.trim()) {
        createdCallId = exchanged.callId;
      }
      if (!createdCallId || typeof exchanged.sdp !== 'string') {
        throw new TypeError('WebRTC SDP exchange must return a non-empty sdp and callId');
      }
      this.call = exchanged;
      this.assertOpen(signal);
      if (!exchanged.sdp.trim()) throw new Error('WebRTC SDP exchange returned an empty answer');
      await peer.setRemoteDescription({ type: 'answer', sdp: exchanged.sdp });
      this.assertOpen(signal);
      await this.waitForDataChannelOpen(channel, signal);
      this.assertOpen(signal);
      return exchanged;
    } catch (error) {
      this.cleanupAttempt(peer, channel, stream, streamAttached);
      if (createdCallId) {
        try {
          await this.releaseCallOnce(createdCallId);
        } catch (releaseError) {
          this.emit('error', toError(releaseError, 'Failed to release OpenAI Realtime call'));
        }
      }
      throw error;
    }
  }

  private createPeerConnection(): PeerConnectionLike {
    if (this.options.peerConnectionFactory) {
      return this.options.peerConnectionFactory(this.options.rtcConfiguration);
    }
    const ctor = (globalThis as unknown as {
      RTCPeerConnection?: new (configuration?: unknown) => PeerConnectionLike;
    }).RTCPeerConnection;
    if (!ctor) throw new Error('RTCPeerConnection is not available in this environment');
    return new ctor(this.options.rtcConfiguration);
  }

  private async acquireMedia(): Promise<MediaStreamLike> {
    const constraints = this.options.mediaConstraints ?? { audio: true };
    if (this.options.acquireMedia) return this.options.acquireMedia(constraints);
    const mediaDevices = (globalThis as unknown as {
      navigator?: { mediaDevices?: { getUserMedia(value: unknown): Promise<MediaStreamLike> } };
    }).navigator?.mediaDevices;
    if (!mediaDevices) throw new Error('navigator.mediaDevices.getUserMedia is not available');
    return mediaDevices.getUserMedia(constraints);
  }

  private wireDataChannel(channel: DataChannelLike): void {
    channel.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        this.emit('error', new TypeError('OpenAI Realtime data channel emitted non-text data'));
        return;
      }
      const hasRawMessageConsumer = (this.handlers.get('message')?.size ?? 0) > 0;
      const hasParsedEventConsumer = (this.handlers.get('event')?.size ?? 0) > 0;
      if (hasRawMessageConsumer) {
        this.emit('message', event.data);
      } else if (!hasParsedEventConsumer && !this.bufferPendingMessage(event.data)) {
        const error = new Error('OpenAI Realtime pending event buffer exceeded its limit');
        this.emit('error', error);
        this.shutdown(1009, 'Pending event buffer exceeded', true);
        return;
      }
      try {
        const parsed = JSON.parse(event.data) as OpenAIRealtimeServerEvent;
        if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
          if (parsed.type === 'session.created') this.sessionCreatedMessage = event.data;
          this.emit('event', parsed);
        }
      } catch (error) {
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      }
    };
    channel.onerror = (event) => {
      this.emit('error', event instanceof Error ? event : new Error('OpenAI Realtime data channel error'));
    };
    channel.onclose = () => this.shutdown(1000, 'Data channel closed', false);
  }

  private async waitForDataChannelOpen(channel: DataChannelLike, signal?: AbortSignal): Promise<void> {
    if (channel.readyState === 'open') return;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (action: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal?.removeEventListener('abort', onAbort);
        unsubscribeClose();
        action();
      };
      const onAbort = (): void => settle(() => reject(abortError(signal?.reason)));
      const unsubscribeClose = this.on('close', (_code, reason) => settle(() => reject(
        new Error(`OpenAI Realtime data channel closed during connect: ${reason}`),
      )));
      const timeout = setTimeout(() => settle(() => reject(
        new Error('Timeout waiting for OpenAI Realtime data channel to open'),
      )), this.options.connectTimeoutMs ?? 15_000);
      channel.onopen = () => settle(resolve);
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });
  }

  private emit<K extends keyof OpenAIRealtimeWebRTCPeerEvents>(
    event: K,
    ...args: Parameters<OpenAIRealtimeWebRTCPeerEvents[K]>
  ): void {
    for (const handler of this.handlers.get(event) ?? []) {
      (handler as unknown as (...values: Parameters<OpenAIRealtimeWebRTCPeerEvents[K]>) => void)(...args);
    }
  }

  private assertOpen(signal?: AbortSignal): void {
    throwIfAborted(signal);
    if (this.closed) throw new Error('Realtime WebRTC peer is closed');
  }

  private shutdown(code: number, reason: string, closeChannel: boolean): void {
    if (this.closed) return;
    this.closed = true;
    const channel = this.dataChannel;
    const peer = this.peer;
    const stream = this.localStream;
    const callId = this.call?.callId;
    if (callId && !this.shutdownReleasePromise) {
      this.shutdownReleasePromise = this.releaseCallOnce(callId);
      void this.shutdownReleasePromise.catch((error) => {
        this.emit('error', toError(error, 'Failed to release OpenAI Realtime call'));
      });
    }
    this.dataChannel = null;
    this.peer = null;
    this.localStream = null;
    this.call = null;
    this.sessionCreatedMessage = null;
    this.pendingMessages = [];
    this.pendingMessageBytes = 0;
    if (channel) {
      channel.onopen = null;
      channel.onmessage = null;
      channel.onerror = null;
      channel.onclose = null;
      if (closeChannel && channel.readyState !== 'closed') channel.close();
    }
    if (peer) {
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.close();
    }
    this.stopTracks(stream);
    this.emit('close', code, reason);
  }

  private bufferPendingMessage(message: string): boolean {
    const messageBytes = new TextEncoder().encode(message).byteLength;
    const maxMessages = this.options.maxPendingMessages ?? 256;
    const maxBytes = this.options.maxPendingMessageBytes ?? 1024 * 1024;
    if (maxMessages <= 0
      || maxBytes <= 0
      || this.pendingMessages.length >= maxMessages
      || this.pendingMessageBytes + messageBytes > maxBytes) {
      return false;
    }
    this.pendingMessages.push(message);
    this.pendingMessageBytes += messageBytes;
    return true;
  }

  private cleanupAttempt(
    peer: PeerConnectionLike,
    channel: DataChannelLike | null,
    stream: MediaStreamLike | null,
    streamAttached: boolean,
  ): void {
    // A concurrent close or remote data-channel close already released every
    // resource that had been attached. Only media acquired after that close
    // still needs cleanup.
    if (this.closed) {
      if (!streamAttached) this.stopTracks(stream);
      return;
    }
    peer.ontrack = null;
    peer.onconnectionstatechange = null;
    if (channel) {
      channel.onopen = null;
      channel.onmessage = null;
      channel.onerror = null;
      channel.onclose = null;
      if (channel.readyState !== 'closed') channel.close();
    }
    peer.close();
    this.stopTracks(stream);
    if (this.peer === peer) this.peer = null;
    if (this.dataChannel === channel) this.dataChannel = null;
    if (this.localStream === stream) this.localStream = null;
    this.call = null;
  }

  private stopTracks(stream: MediaStreamLike | null): void {
    if (this.options.stopLocalTracksOnClose === false) return;
    for (const track of stream?.getTracks() ?? []) track.stop();
  }

  private async releaseCallOnce(callId: string): Promise<void> {
    if (!this.options.releaseCall) return;
    const existing = this.releaseCallPromises.get(callId);
    if (existing) return existing;
    const release = Promise.resolve().then(async () => {
      await this.options.releaseCall?.(callId);
    });
    this.releaseCallPromises.set(callId, release);
    try {
      await release;
    } catch (error) {
      this.releaseCallPromises.delete(callId);
      throw error;
    }
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal.reason);
}

function abortError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  const error = new Error(typeof reason === 'string' && reason ? reason : 'WebRTC connection aborted');
  error.name = 'AbortError';
  return error;
}

function toError(value: unknown, fallback: string): Error {
  return value instanceof Error ? value : new Error(fallback);
}
