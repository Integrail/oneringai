/**
 * TwilioAdapter - Telephony adapter for Twilio Voice
 *
 * Handles:
 * - Inbound call webhooks (returns TwiML to connect Media Stream)
 * - Twilio Media Stream WebSocket protocol
 * - μ-law ↔ PCM transcoding
 * - Maps Twilio protocol to ITelephonyAdapter interface
 *
 * Usage modes:
 * 1. Standalone: adapter creates its own HTTP/WS server
 * 2. External: you get webhook/media handlers for your existing server
 *
 * @example Standalone
 * ```typescript
 * const adapter = TwilioAdapter.createStandalone({
 *   connector: 'twilio',
 *   port: 3000,
 *   publicUrl: 'https://abc123.ngrok.io',
 * });
 * await adapter.start();
 * ```
 *
 * @example External (Express + ws)
 * ```typescript
 * const adapter = TwilioAdapter.create({ connector: 'twilio' });
 * app.post('/voice', adapter.webhookHandler());
 * wss.on('connection', (ws, req) => {
 *   if (req.url === '/media-stream') adapter.handleMediaSocket(ws);
 * });
 * ```
 */

import { EventEmitter } from 'events';
import { Connector } from '../../../../core/Connector.js';
import { logger } from '../../../../infrastructure/observability/Logger.js';
import { mulawToPcm, pcmToMulaw, resamplePcm } from './codecs.js';
import type {
  ITelephonyAdapter,
  TelephonyAdapterEvents,
  TwilioAdapterConfig,
  AudioFrame,
  IncomingCallInfo,
} from '../../types.js';

// =============================================================================
// Twilio Media Stream Protocol Types
// =============================================================================

/** Twilio → Server messages */
interface TwilioMediaMessage {
  event: 'connected' | 'start' | 'media' | 'stop' | 'mark';
  sequenceNumber?: string;
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
    customParameters?: Record<string, string>;
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
  mark?: {
    name: string;
  };
}

/** Server → Twilio messages */
interface TwilioOutboundMessage {
  event: 'media' | 'mark' | 'clear';
  streamSid: string;
  media?: {
    payload: string;
  };
  mark?: {
    name: string;
  };
}

// =============================================================================
// Per-call WebSocket state
// =============================================================================

interface MediaStreamState {
  callId: string;
  streamSid: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws: any;
  startTime: number;
  info: IncomingCallInfo;
}

// =============================================================================
// TwilioAdapter
// =============================================================================

export class TwilioAdapter extends EventEmitter implements ITelephonyAdapter {
  private config: TwilioAdapterConfig;
  private connector: Connector;
  private streams = new Map<string, MediaStreamState>();
  private streamSidToCallId = new Map<string, string>();
  private destroyed = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private server: any = null;

  static create(config: TwilioAdapterConfig): TwilioAdapter {
    return new TwilioAdapter({ ...config, mode: 'external' });
  }

  static createStandalone(config: TwilioAdapterConfig & { publicUrl: string; port?: number }): TwilioAdapter {
    return new TwilioAdapter({ ...config, mode: 'standalone' });
  }

  private constructor(config: TwilioAdapterConfig) {
    super();
    this.config = {
      mode: 'external',
      port: 3000,
      webhookPath: '/voice',
      mediaStreamPath: '/media-stream',
      ...config,
    };
    this.connector = typeof config.connector === 'string'
      ? Connector.get(config.connector)
      : config.connector as unknown as Connector;
  }

  // ─── Standalone Server ───────────────────────────────────────────

  async start(): Promise<void> {
    if (this.config.mode !== 'standalone') {
      throw new Error('start() is only available in standalone mode.');
    }

    const http = await import('http');
    // Dynamic import — ws is an optional peer dependency
    const { WebSocketServer } = await import('ws' as string);

    const port = this.config.port ?? 3000;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.server = http.createServer((req: any, res: any) => {
      if (req.method === 'POST' && req.url === this.config.webhookPath) {
        this.handleWebhookRequest(req, res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    const wss = new WebSocketServer({
      server: this.server,
      path: this.config.mediaStreamPath,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wss.on('connection', (ws: any) => {
      this.handleMediaSocket(ws);
    });

    return new Promise((resolve) => {
      this.server.listen(port, () => {
        logger.info({ port, webhookPath: this.config.webhookPath }, '[TwilioAdapter] Standalone server started');
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      });
    }
  }

  // ─── External Server Integration ─────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webhookHandler(): (req: any, res: any) => void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (req: any, res: any) => {
      this.handleWebhookRequest(req, res);
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleMediaSocket(ws: any): void {
    let streamState: MediaStreamState | null = null;

    ws.on('message', (data: string | Buffer) => {
      try {
        const msg: TwilioMediaMessage = JSON.parse(
          typeof data === 'string' ? data : data.toString()
        );

        switch (msg.event) {
          case 'connected':
            logger.debug('Media stream WebSocket connected');
            break;

          case 'start':
            streamState = this.handleStreamStart(msg, ws);
            break;

          case 'media':
            if (streamState && msg.media) {
              this.handleStreamMedia(streamState, msg.media);
            }
            break;

          case 'stop':
            if (streamState) {
              this.handleStreamStop(streamState);
              streamState = null;
            }
            break;

          case 'mark':
            break;
        }
      } catch (error) {
        logger.error({ error }, '[TwilioAdapter] Error processing media message');
      }
    });

    ws.on('close', () => {
      if (streamState) {
        this.handleStreamStop(streamState);
      }
    });

    ws.on('error', (error: Error) => {
      logger.error({ error }, '[TwilioAdapter] WebSocket error');
      this.emit('error', error, streamState?.callId);
    });
  }

  // ─── ITelephonyAdapter Implementation ────────────────────────────

  sendAudio(callId: string, frame: AudioFrame): void {
    const state = this.streams.get(callId);
    if (!state) return;

    try {
      let mulaw: Buffer;
      if (frame.encoding === 'mulaw' && frame.sampleRate === 8000) {
        mulaw = frame.audio;
      } else if (frame.encoding === 'pcm_s16le') {
        const pcm8k = frame.sampleRate !== 8000
          ? resamplePcm(frame.audio, frame.sampleRate, 8000)
          : frame.audio;
        mulaw = pcmToMulaw(pcm8k);
      } else {
        logger.warn({ encoding: frame.encoding }, '[TwilioAdapter] Unsupported audio encoding');
        return;
      }

      const outMsg: TwilioOutboundMessage = {
        event: 'media',
        streamSid: state.streamSid,
        media: {
          payload: mulaw.toString('base64'),
        },
      };

      if (state.ws.readyState === 1) {
        state.ws.send(JSON.stringify(outMsg));
      }
    } catch (error) {
      logger.error({ callId, error }, '[TwilioAdapter] Error sending audio');
    }
  }

  async hangup(callId: string): Promise<void> {
    const state = this.streams.get(callId);
    if (!state) return;

    try {
      if (state.ws.readyState === 1) {
        state.ws.close();
      }
    } catch {
      // Ignore close errors
    }

    this.cleanupStream(callId);

    try {
      const accountSid = (state.info.metadata.accountSid as string) || '';
      if (accountSid) {
        await this.connector.fetch(
          `/Accounts/${accountSid}/Calls/${callId}.json`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'Status=completed',
          }
        );
      }
    } catch (error) {
      logger.debug({ callId, error }, '[TwilioAdapter] REST hangup failed');
    }
  }

  getActiveCalls(): string[] {
    return Array.from(this.streams.keys());
  }

  on<K extends keyof TelephonyAdapterEvents>(event: K, handler: TelephonyAdapterEvents[K]): this {
    return super.on(event, handler);
  }

  off<K extends keyof TelephonyAdapterEvents>(event: K, handler: TelephonyAdapterEvents[K]): this {
    return super.off(event, handler);
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;

    for (const [callId, state] of this.streams) {
      try {
        if (state.ws.readyState === 1) {
          state.ws.close();
        }
      } catch {
        // Ignore
      }
      this.emit('call:ended', callId, 'adapter_destroyed');
    }
    this.streams.clear();
    this.streamSidToCallId.clear();

    await this.stop();
    this.removeAllListeners();

    logger.info('TwilioAdapter destroyed');
  }

  // ─── Internal: Webhook ───────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleWebhookRequest(req: any, res: any): void {
    let body = '';
    req.on('data', (chunk: string | Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const params = new URLSearchParams(body);

      const callSid = params.get('CallSid') || 'unknown';
      const from = params.get('From') || 'unknown';
      const to = params.get('To') || 'unknown';

      logger.info({ callSid, from, to }, '[TwilioAdapter] Incoming call');

      const wsUrl = this.config.publicUrl
        ? `${this.config.publicUrl.replace(/^http/, 'ws')}${this.config.mediaStreamPath}`
        : `wss://localhost:${this.config.port}${this.config.mediaStreamPath}`;

      const twiml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Response>',
        '  <Connect>',
        `    <Stream url="${wsUrl}">`,
        `      <Parameter name="callSid" value="${callSid}" />`,
        `      <Parameter name="from" value="${from}" />`,
        `      <Parameter name="to" value="${to}" />`,
        '    </Stream>',
        '  </Connect>',
        '</Response>',
      ].join('\n');

      res.writeHead(200, { 'Content-Type': 'text/xml' });
      res.end(twiml);
    });
  }

  // ─── Internal: Media Stream Protocol ─────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleStreamStart(msg: TwilioMediaMessage, ws: any): MediaStreamState {
    const start = msg.start!;
    const callId = start.customParameters?.callSid || start.callSid;

    const info: IncomingCallInfo = {
      callId,
      from: start.customParameters?.from || 'unknown',
      to: start.customParameters?.to || 'unknown',
      metadata: {
        accountSid: start.accountSid,
        streamSid: start.streamSid,
        tracks: start.tracks,
        mediaFormat: start.mediaFormat,
      },
    };

    const state: MediaStreamState = {
      callId,
      streamSid: start.streamSid,
      ws,
      startTime: Date.now(),
      info,
    };

    this.streams.set(callId, state);
    this.streamSidToCallId.set(start.streamSid, callId);

    logger.info({ callId, streamSid: start.streamSid }, '[TwilioAdapter] Media stream started');

    this.emit('call:connected', callId, info);

    return state;
  }

  private handleStreamMedia(
    state: MediaStreamState,
    media: NonNullable<TwilioMediaMessage['media']>
  ): void {
    const mulawAudio = Buffer.from(media.payload, 'base64');
    const pcmAudio = mulawToPcm(mulawAudio);

    const frame: AudioFrame = {
      audio: pcmAudio,
      sampleRate: 8000,
      encoding: 'pcm_s16le',
      channels: 1,
      timestamp: parseInt(media.timestamp, 10),
    };

    this.emit('call:audio', state.callId, frame);
  }

  private handleStreamStop(state: MediaStreamState): void {
    logger.info({ callId: state.callId }, '[TwilioAdapter] Media stream stopped');
    this.emit('call:ended', state.callId, 'stream_stopped');
    this.cleanupStream(state.callId);
  }

  private cleanupStream(callId: string): void {
    const state = this.streams.get(callId);
    if (state) {
      this.streamSidToCallId.delete(state.streamSid);
      this.streams.delete(callId);
    }
  }
}
