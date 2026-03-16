/**
 * VoiceBridge - Multi-session voice call manager
 *
 * Connects a telephony adapter to agents via voice pipelines.
 * Creates a fresh Agent and pipeline per call, manages concurrent sessions,
 * and fires lifecycle hooks.
 *
 * @example
 * ```typescript
 * const bridge = VoiceBridge.create({
 *   agent: { connector: 'anthropic', model: 'claude-sonnet-4-6', tools: [...] },
 *   pipeline: 'text',
 *   stt: { connector: 'openai', model: 'whisper-1' },
 *   tts: { connector: 'openai', model: 'tts-1', voice: 'nova' },
 *   greeting: 'Hello! How can I help you today?',
 *   hooks: {
 *     onCallStart: async (session) => { console.log('Call from', session.from); },
 *     onCallEnd: async (session, summary) => { console.log('Duration:', summary.duration); },
 *   },
 * });
 *
 * // Attach to a telephony adapter
 * bridge.attach(twilioAdapter);
 * ```
 */

import { EventEmitter } from 'events';
import { logger } from '../../infrastructure/observability/Logger.js';
import { VoiceSession } from './VoiceSession.js';
import { TextPipeline } from './pipelines/TextPipeline.js';
import { RealtimePipeline } from './pipelines/RealtimePipeline.js';
import { EnergyVAD } from './EnergyVAD.js';
import type {
  VoiceBridgeConfig,
  ITelephonyAdapter,
  IncomingCallInfo,
  AudioFrame,
  VoiceSessionInfo,
  CallSummary,
  CallDirection,
  TranscriptMessage,
  IVoicePipeline,
} from './types.js';

// =============================================================================
// Bridge Events
// =============================================================================

export interface VoiceBridgeEvents {
  'session:created': (info: VoiceSessionInfo) => void;
  'session:ended': (info: VoiceSessionInfo, summary: CallSummary) => void;
  'transcript': (info: VoiceSessionInfo, entry: TranscriptMessage) => void;
  'error': (error: Error, sessionId?: string) => void;
}

// =============================================================================
// Defaults
// =============================================================================

const DEFAULT_MAX_CONCURRENT = 10;
const DEFAULT_MAX_DURATION = 3600;
const DEFAULT_SILENCE_TIMEOUT = 1500;

// =============================================================================
// VoiceBridge
// =============================================================================

export class VoiceBridge extends EventEmitter {
  private config: VoiceBridgeConfig;
  private sessions = new Map<string, VoiceSession>();
  private callToSession = new Map<string, string>();
  private pendingOutbound = new Map<string, CallDirection>();
  private cleanupTimers = new Set<ReturnType<typeof setTimeout>>();
  private endingSessions = new Set<string>();
  private adapter: ITelephonyAdapter | null = null;
  private destroyed = false;

  static create(config: VoiceBridgeConfig): VoiceBridge {
    return new VoiceBridge(config);
  }

  private constructor(config: VoiceBridgeConfig) {
    super();
    this.config = config;
  }

  // ─── Adapter Attachment ──────────────────────────────────────────

  attach(adapter: ITelephonyAdapter): void {
    if (this.adapter) {
      throw new Error('Adapter already attached. Call detach() first.');
    }

    this.adapter = adapter;

    adapter.on('call:connected', this.handleCallConnected);
    adapter.on('call:audio', this.handleCallAudio);
    adapter.on('call:media_timestamp', this.handleMediaTimestamp);
    adapter.on('call:ended', this.handleCallEnded);
    adapter.on('error', this.handleAdapterError);

    logger.info('[VoiceBridge] Adapter attached');
  }

  detach(): void {
    if (!this.adapter) return;

    this.adapter.off('call:connected', this.handleCallConnected);
    this.adapter.off('call:audio', this.handleCallAudio);
    this.adapter.off('call:media_timestamp', this.handleMediaTimestamp);
    this.adapter.off('call:ended', this.handleCallEnded);
    this.adapter.off('error', this.handleAdapterError);

    this.adapter = null;
    logger.debug('[VoiceBridge] Adapter detached');
  }

  // ─── Session Access ──────────────────────────────────────────────

  getActiveSessions(): VoiceSessionInfo[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.state !== 'ended')
      .map((s) => s.getInfo());
  }

  getSession(sessionId: string): VoiceSessionInfo | null {
    return this.sessions.get(sessionId)?.getInfo() ?? null;
  }

  get activeSessionCount(): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.state !== 'ended') count++;
    }
    return count;
  }

  async hangup(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.state === 'ended') return;

    session.setEndReason('agent_hangup');
    await this.endSession(session);

    if (this.adapter) {
      await this.adapter.hangup(session.callId);
    }
  }

  // ─── Outbound Calls ────────────────────────────────────────────

  /**
   * Initiate an outbound call.
   * The adapter places the call via the telephony provider. When the callee
   * answers and the media stream connects, the normal session lifecycle
   * (agent creation, pipeline, hooks) kicks in automatically.
   *
   * @returns callId from the telephony provider
   */
  async makeCall(to: string, from: string): Promise<string> {
    if (this.destroyed) {
      throw new Error('VoiceBridge is destroyed');
    }
    if (!this.adapter) {
      throw new Error('No adapter attached');
    }
    if (!this.adapter.makeCall) {
      throw new Error('Adapter does not support outbound calls');
    }

    const maxConcurrent = this.config.maxConcurrentCalls ?? DEFAULT_MAX_CONCURRENT;
    if (maxConcurrent > 0 && this.activeSessionCount >= maxConcurrent) {
      throw new Error('Max concurrent calls reached');
    }

    const callId = await this.adapter.makeCall({ to, from });
    this.pendingOutbound.set(callId, 'outbound');

    logger.info({ callId, to, from }, '[VoiceBridge] Outbound call initiated');
    return callId;
  }

  // ─── Adapter Event Handlers ──────────────────────────────────────

  private handleCallConnected = async (callId: string, info: IncomingCallInfo): Promise<void> => {
    try {
      await this.onCallConnected(callId, info);
    } catch (error) {
      logger.error({ callId, error }, '[VoiceBridge] Error handling call connected');
      this.emit('error', error instanceof Error ? error : new Error(String(error)), undefined);
    }
  };

  private handleCallAudio = (callId: string, frame: AudioFrame): void => {
    const sessionId = this.callToSession.get(callId);
    if (!sessionId) return;

    const session = this.sessions.get(sessionId);
    if (!session?.pipeline) return;

    session.pipeline.processAudio(frame);
  };

  private handleCallEnded = async (callId: string, _reason: string): Promise<void> => {
    const sessionId = this.callToSession.get(callId);
    if (!sessionId) return;

    const session = this.sessions.get(sessionId);
    if (!session || session.state === 'ended') return;

    session.setEndReason('caller_hangup');
    await this.endSession(session);
  };

  private handleMediaTimestamp = (callId: string, info: { timestamp: number }): void => {
    const sessionId = this.callToSession.get(callId);
    if (!sessionId) return;

    const session = this.sessions.get(sessionId);
    const pipeline = session?.pipeline as (IVoicePipeline & {
      onTelephonyTimestamp?: (timestamp: number) => void;
    }) | undefined;
    pipeline?.onTelephonyTimestamp?.(info.timestamp);
  };

  private handleAdapterError = (error: Error, callId?: string): void => {
    if (callId) {
      const sessionId = this.callToSession.get(callId);
      if (sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
          this.fireHook('onError', error, session.getInfo());
        }
      }
    }
    this.emit('error', error, callId ? this.callToSession.get(callId) : undefined);
  };

  // ─── Call Lifecycle ──────────────────────────────────────────────

  private async onCallConnected(callId: string, info: IncomingCallInfo): Promise<void> {
    if (this.destroyed) return;

    const maxConcurrent = this.config.maxConcurrentCalls ?? DEFAULT_MAX_CONCURRENT;
    if (maxConcurrent > 0 && this.activeSessionCount >= maxConcurrent) {
      logger.warn({ callId }, '[VoiceBridge] Max concurrent calls reached, rejecting');
      if (this.adapter) {
        await this.adapter.hangup(callId);
      }
      return;
    }

    // Detect if this is an outbound call we initiated
    const direction: CallDirection = this.pendingOutbound.has(callId)
      || info.metadata?.direction === 'outbound'
      ? 'outbound'
      : 'inbound';
    if (this.pendingOutbound.has(callId)) {
      this.pendingOutbound.delete(callId);
    }

    const session = new VoiceSession(info, direction);
    this.sessions.set(session.sessionId, session);
    this.callToSession.set(callId, session.sessionId);

    session.transition('ringing');

    const accepted = await this.fireHook('onCallStart', session.getInfo());
    if (accepted === false) {
      session.setEndReason('rejected');
      await this.endSession(session);
      if (this.adapter) {
        await this.adapter.hangup(callId);
      }
      return;
    }

    // Only create Agent for text pipeline (realtime handles LLM internally via WebSocket)
    if (this.config.pipeline !== 'realtime') {
      session.createAgent(this.config.agent);
    }

    const pipeline = this.createPipeline(session);
    session.setPipeline(pipeline);

    // Wire pipeline events → adapter.
    // These listeners are cleaned up by pipeline.destroy() → removeAllListeners()
    pipeline.on('audio:out', (frame: AudioFrame) => {
      if (this.adapter && session.state !== 'ended') {
        this.adapter.sendAudio(callId, frame);
      }
    });

    pipeline.on('error', (error: Error) => {
      logger.error({ sessionId: session.sessionId, error }, '[VoiceBridge] Pipeline error');
      this.fireHook('onError', error, session.getInfo());
      this.emit('error', error, session.sessionId);
    });

    // Clear Twilio's audio buffer on actual barge-in interrupt only
    pipeline.on('interrupt', () => {
      if (this.adapter?.clearAudio) {
        this.adapter.clearAudio(callId);
      }
      this.fireHook('onInterrupt', session.getInfo());
    });

    // Forward transcript events (used by realtime pipeline, and optionally text pipeline)
    pipeline.on('transcript', (entry: TranscriptMessage) => {
      this.emit('transcript', session.getInfo(), entry);
    });

    const maxDuration = this.config.maxCallDuration ?? DEFAULT_MAX_DURATION;
    session.setMaxDuration(maxDuration);

    session.on('state:change', async (_prev: unknown, next: string) => {
      if (next === 'ending' && session.state === 'ending') {
        await this.endSession(session);
        if (this.adapter) {
          await this.adapter.hangup(callId);
        }
      }
    });

    session.transition('connected');
    await pipeline.init(session.getInfo());

    this.emit('session:created', session.getInfo());
    logger.info(
      { sessionId: session.sessionId, callId, from: info.from, to: info.to, activeSessions: this.activeSessionCount },
      '[VoiceBridge] Call connected'
    );
  }

  private async endSession(session: VoiceSession): Promise<void> {
    if (session.state === 'ended' || this.endingSessions.has(session.sessionId)) return;
    this.endingSessions.add(session.sessionId);
    try {
      const summary = await session.end();

      await this.fireHook('onCallEnd', session.getInfo(), summary);

      this.emit('session:ended', session.getInfo(), summary);

      this.callToSession.delete(session.callId);
      // Delay removal so late lookups can find the ended session
      const timer = setTimeout(() => {
        this.sessions.delete(session.sessionId);
        this.endingSessions.delete(session.sessionId);
        this.cleanupTimers.delete(timer);
      }, 2000);
      this.cleanupTimers.add(timer);

      logger.info(
        { sessionId: session.sessionId, duration: summary.duration, turns: summary.turns, reason: summary.endReason },
        '[VoiceBridge] Call ended'
      );
    } catch (error) {
      this.endingSessions.delete(session.sessionId);
      throw error;
    }
  }

  // ─── Pipeline Factory ────────────────────────────────────────────

  private createPipeline(session: VoiceSession): IVoicePipeline {
    const { pipeline } = this.config;

    // Resolve greeting based on call direction
    const greeting = session.direction === 'outbound'
      ? this.config.greetingOutbound   // undefined = no greeting on outbound
      : this.config.greeting;

    if (pipeline === 'text') {
      const cfg = this.config as VoiceBridgeConfig & { pipeline: 'text' };
      const vad = new EnergyVAD({
        silenceTimeout: cfg.silenceTimeout ?? DEFAULT_SILENCE_TIMEOUT,
        ...cfg.vad,
      });

      return new TextPipeline({
        agent: session.agent!,
        session,
        stt: cfg.stt,
        tts: cfg.tts,
        vad,
        interruptible: cfg.interruptible ?? true,
        greeting,
        hooks: cfg.hooks,
      });
    }

    if (pipeline === 'realtime') {
      const cfg = this.config as VoiceBridgeConfig & { pipeline: 'realtime' };
      return new RealtimePipeline({
        agentConfig: cfg.agent,
        session,
        voice: cfg.voice,
        turnDetection: cfg.turnDetection,
        vadThreshold: cfg.vadThreshold,
        silenceDurationMs: cfg.silenceDurationMs,
        inputTranscription: cfg.inputTranscription,
        transcriptionModel: cfg.transcriptionModel,
        greeting,
        interruptible: cfg.interruptible ?? true,
        hooks: cfg.hooks,
      });
    }

    throw new Error(`Unknown pipeline type: ${pipeline}`);
  }

  // ─── Hook Helpers ────────────────────────────────────────────────

  private async fireHook(name: 'onCallStart', session: VoiceSessionInfo): Promise<boolean | void>;
  private async fireHook(name: 'onCallEnd', session: VoiceSessionInfo, summary: CallSummary): Promise<void>;
  private async fireHook(name: 'onError', error: Error, session: VoiceSessionInfo): Promise<void>;
  private async fireHook(name: 'onInterrupt', session: VoiceSessionInfo): Promise<void>;
  private async fireHook(name: string, ...args: unknown[]): Promise<unknown> {
    const hooks = this.config.hooks;
    if (!hooks) return undefined;

    const hook = (hooks as Record<string, (...a: unknown[]) => Promise<unknown>>)[name];
    if (!hook) return undefined;

    try {
      return await hook(...args);
    } catch (error) {
      logger.error({ hookName: name, error }, '[VoiceBridge] Hook threw');
      return undefined;
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;

    const endings: Promise<void>[] = [];
    for (const session of this.sessions.values()) {
      if (session.state !== 'ended') {
        session.setEndReason('error');
        endings.push(this.endSession(session));
      }
    }
    await Promise.allSettled(endings);

    // Clear all pending cleanup timers
    for (const timer of this.cleanupTimers) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();

    this.detach();
    this.sessions.clear();
    this.callToSession.clear();
    this.pendingOutbound.clear();
    this.removeAllListeners();

    logger.info('[VoiceBridge] Destroyed');
  }
}
