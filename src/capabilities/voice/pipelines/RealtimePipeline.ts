/**
 * RealtimePipeline - OpenAI Realtime WebSocket voice-to-voice pipeline
 *
 * Connects directly to OpenAI's Realtime API for native audio-to-audio streaming.
 * Instead of STT → Agent → TTS, audio goes directly to/from the model over WebSocket.
 *
 * Features:
 * - Native voice-to-voice with <200ms latency
 * - Built-in server-side VAD (no EnergyVAD needed)
 * - Function calling via the same WebSocket
 * - Conversation transcript maintained for UI display
 * - G.711 μ-law 8kHz audio format (matches Twilio native)
 */

import { EventEmitter } from 'events';
import { Connector } from '../../../core/Connector.js';
import { ToolManager } from '../../../core/ToolManager.js';
import { logger } from '../../../infrastructure/observability/Logger.js';
import { pcmToMulaw, resamplePcm } from '../adapters/twilio/codecs.js';
import type { AgentConfig } from '../../../core/Agent.js';
import type { ToolFunction } from '../../../domain/entities/Tool.js';
import type { VoiceSession } from '../VoiceSession.js';
import type {
  IVoicePipeline,
  AudioFrame,
  SessionState,
  VoiceSessionInfo,
  VoicePipelineEvents,
  VoiceHooks,
  TranscriptMessage,
} from '../types.js';

// =============================================================================
// Configuration
// =============================================================================

export interface RealtimePipelineInitConfig {
  agentConfig: AgentConfig;
  session: VoiceSession;
  voice?: string;
  turnDetection?: 'server_vad' | 'none';
  vadThreshold?: number;
  silenceDurationMs?: number;
  inputTranscription?: boolean;
  transcriptionModel?: string;
  greeting?: string;
  interruptible?: boolean;
  hooks?: VoiceHooks;
}

// =============================================================================
// OpenAI Realtime API event types (subset we use)
// =============================================================================

interface RealtimeServerEvent {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// =============================================================================
// RealtimePipeline
// =============================================================================

export class RealtimePipeline extends EventEmitter implements IVoicePipeline {
  private config: RealtimePipelineInitConfig;
  private session: VoiceSession;
  private toolManager: ToolManager;
  private tools: ToolFunction[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ws: any = null;
  private state: SessionState = 'idle';
  private destroyed = false;
  private ignoringEvents = false;
  private sessionInfo: VoiceSessionInfo | null = null;
  private transcript: TranscriptMessage[] = [];
  private agentTranscriptBuffer = '';
  private pendingToolCalls = new Map<string, { name: string; arguments: string }>();
  private isResponseActive = false;
  private currentResponseId: string | null = null;
  private currentAssistantItemId: string | null = null;
  private currentAssistantContentIndex = 0;
  private responseStartTimestamp: number | null = null;
  private latestMediaTimestamp = 0;
  private hasStartedAudioForCurrentResponse = false;
  private interruptingResponseId: string | null = null;
  private tailResponseId: string | null = null;
  private tailAssistantItemId: string | null = null;
  private tailAssistantContentIndex = 0;
  private tailResponseStartTimestamp: number | null = null;
  private tailExpiresAt = 0;

  constructor(config: RealtimePipelineInitConfig) {
    super();
    this.config = config;
    this.session = config.session;
    this.tools = (config.agentConfig.tools ?? []) as ToolFunction[];

    // Create standalone ToolManager and register all tools
    this.toolManager = new ToolManager();
    for (const tool of this.tools) {
      this.toolManager.register(tool);
    }
  }

  // ─── IVoicePipeline Implementation ────────────────────────────────

  async init(sessionInfo: VoiceSessionInfo): Promise<void> {
    this.sessionInfo = sessionInfo;
    this.setState('connected');

    const { agentConfig } = this.config;

    // Resolve connector to get API key
    const connector = typeof agentConfig.connector === 'string'
      ? Connector.get(agentConfig.connector)
      : agentConfig.connector as unknown as Connector;
    const apiKey = connector.getApiKey();
    const model = agentConfig.model;

    const wsUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;

    logger.info({
      model,
      sessionId: sessionInfo.sessionId,
      voice: this.config.voice ?? 'alloy',
      turnDetection: this.config.turnDetection ?? 'server_vad',
      toolCount: this.tools.length,
    }, '[RealtimePipeline] Connecting to OpenAI Realtime API');

    // Dynamic import — ws is an optional peer dependency
    const { default: WebSocket } = await import('ws' as string);

    this.ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    // Wait for connection + session.created
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for OpenAI Realtime session.created'));
      }, 15000);

      this.ws.on('open', () => {
        logger.debug({ sessionId: sessionInfo.sessionId }, '[RealtimePipeline] WebSocket connected');
      });

      this.ws.on('message', (data: Buffer | string) => {
        const event = JSON.parse(typeof data === 'string' ? data : data.toString()) as RealtimeServerEvent;
        if (event.type === 'session.created') {
          clearTimeout(timeout);
          logger.info({
            sessionId: sessionInfo.sessionId,
            realtimeSessionId: event.session?.id,
          }, '[RealtimePipeline] Session created');
          resolve();
        } else if (event.type === 'error') {
          clearTimeout(timeout);
          logger.error({ event }, '[RealtimePipeline] Error during init');
          reject(new Error(`Realtime API error: ${JSON.stringify(event.error)}`));
        }
      });

      this.ws.on('error', (error: Error) => {
        clearTimeout(timeout);
        logger.error({ error: error.message }, '[RealtimePipeline] WebSocket connection error');
        reject(error);
      });
    });

    // Wire up ongoing message handler
    this.ws.on('message', (data: Buffer | string) => {
      this.handleServerEvent(JSON.parse(typeof data === 'string' ? data : data.toString()));
    });

    this.ws.on('close', (code: number, reason: string) => {
      logger.info({ code, reason: reason?.toString() }, '[RealtimePipeline] WebSocket closed');
      if (!this.destroyed) {
        this.emitError(new Error(`WebSocket closed unexpectedly: ${code}`));
      }
    });

    this.ws.on('error', (error: Error) => {
      logger.error({ error: error.message }, '[RealtimePipeline] WebSocket error');
      this.emitError(error);
    });

    // Send session.update with instructions, tools, audio config
    this.sendSessionUpdate();

    // If greeting, trigger initial response
    if (this.config.greeting) {
      this.sendEvent({
        type: 'response.create',
        response: {
          input: [],
          instructions: `Greet the caller with exactly this: "${this.config.greeting}"`,
        },
      });
    }

    this.setState('listening');
  }

  processAudio(frame: AudioFrame): void {
    if (this.destroyed || !this.ws || this.ws.readyState !== 1) return;

    let mulaw: Buffer;
    if (frame.encoding === 'mulaw' && frame.sampleRate === 8000) {
      mulaw = frame.audio;
    } else if (frame.encoding === 'pcm_s16le') {
      // Resample to 8kHz if needed, then encode to μ-law
      const pcm8k = frame.sampleRate !== 8000
        ? resamplePcm(frame.audio, frame.sampleRate, 8000)
        : frame.audio;
      mulaw = pcmToMulaw(pcm8k);
    } else {
      return;
    }

    this.sendEvent({
      type: 'input_audio_buffer.append',
      audio: mulaw.toString('base64'),
    });
  }

  async onSpeechEnd(): Promise<void> {
    // When using server VAD, this is handled by OpenAI
    if (this.config.turnDetection !== 'none') return;

    // Manual mode: commit buffer and request response
    this.sendEvent({ type: 'input_audio_buffer.commit' });
    this.sendEvent({ type: 'response.create' });
  }

  onSpeechStart(): void {
    // Server VAD handles this automatically
  }

  interrupt(): void {
    this.handleBargeIn('manual_interrupt');
  }

  onPlaybackAck(_ack: { name: string; playedMs: number }): void {
    // Playback mark acknowledgements are no longer used for interruption timing.
  }

  onTelephonyTimestamp(timestamp: number): void {
    this.latestMediaTimestamp = timestamp;
  }

  getState(): SessionState {
    return this.state;
  }

  on<K extends keyof VoicePipelineEvents>(event: K, handler: VoicePipelineEvents[K]): this {
    return super.on(event, handler);
  }

  off<K extends keyof VoicePipelineEvents>(event: K, handler: VoicePipelineEvents[K]): this {
    return super.off(event, handler);
  }

  /**
   * Get the full conversation transcript for this session.
   */
  getTranscript(): TranscriptMessage[] {
    return [...this.transcript];
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    this.ignoringEvents = true;

    const ws = this.ws;
    this.ws = null;

    if (ws) {
      try {
        ws.removeAllListeners('message');
        ws.removeAllListeners('close');
        ws.removeAllListeners('error');
        if (ws.readyState === 1 || ws.readyState === 0) {
          ws.close();
        }
      } catch (error) {
        logger.debug({ error }, '[RealtimePipeline] WebSocket close error during destroy');
      }
    }

    this.currentResponseId = null;
    this.currentAssistantItemId = null;
    this.interruptingResponseId = null;
    this.tailResponseId = null;
    this.tailAssistantItemId = null;
    this.tailAssistantContentIndex = 0;
    this.tailResponseStartTimestamp = null;
    this.tailExpiresAt = 0;
    this.isResponseActive = false;
    this.responseStartTimestamp = null;
    this.latestMediaTimestamp = 0;
    this.hasStartedAudioForCurrentResponse = false;

    this.toolManager.destroy();
    this.setState('ended');
    this.removeAllListeners();

    logger.info({
      sessionId: this.sessionInfo?.sessionId,
      transcriptEntries: this.transcript.length,
    }, '[RealtimePipeline] Destroyed');
  }

  // ─── Session Update ───────────────────────────────────────────────

  private sendSessionUpdate(): void {
    const { agentConfig } = this.config;

    // Convert tools to Realtime API format (flattened)
    const tools = this.tools.map(t => ({
      type: 'function' as const,
      name: t.definition.function.name,
      description: t.definition.function.description ?? '',
      parameters: t.definition.function.parameters ?? { type: 'object', properties: {} },
    }));

    // Build turn detection config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let turnDetection: any = null;
    if (this.config.turnDetection !== 'none') {
      turnDetection = {
        type: 'server_vad',
        threshold: this.config.vadThreshold ?? 0.6,
        silence_duration_ms: this.config.silenceDurationMs ?? 500,
        prefix_padding_ms: 400,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionUpdate: any = {
      type: 'session.update',
      session: {
        instructions: agentConfig.instructions || '',
        tools,
        tool_choice: 'auto',
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        voice: this.config.voice ?? 'alloy',
        turn_detection: turnDetection,
      },
    };

    // Enable input transcription for hooks/logging
    if (this.config.inputTranscription !== false) {
      sessionUpdate.session.input_audio_transcription = {
        model: this.config.transcriptionModel ?? 'gpt-4o-transcribe',
      };
    }

    this.sendEvent(sessionUpdate);

    logger.info({
      toolCount: tools.length,
      voice: sessionUpdate.session.voice,
      turnDetection: turnDetection?.type ?? 'none',
      inputTranscription: this.config.inputTranscription !== false,
    }, '[RealtimePipeline] Session updated');
  }

  // ─── Server Event Handler ─────────────────────────────────────────

  private handleServerEvent(event: RealtimeServerEvent): void {
    if (this.destroyed || this.ignoringEvents) {
      return;
    }
    switch (event.type) {
      case 'session.created':
        // Already handled during init — ignore subsequent
        break;

      case 'session.updated':
        logger.debug('[RealtimePipeline] Session config confirmed');
        break;

      // ── Caller speech detection ─────────────────────────────
      case 'input_audio_buffer.speech_started': {
        const playbackActive = this.isAssistantPlaybackActive();
        logger.info({
          state: this.state,
          isResponseActive: this.isResponseActive,
          currentResponseId: this.currentResponseId,
          assistantItemId: this.currentAssistantItemId,
          interruptible: this.config.interruptible !== false,
          latestMediaTimestamp: this.latestMediaTimestamp,
          responseStartTimestamp: this.responseStartTimestamp,
          playbackActive,
        }, '[RealtimePipeline] Caller speech started');
        if (playbackActive) {
          this.handleBargeIn('vad_speech_started');
        }
        break;
      }

      case 'input_audio_buffer.speech_stopped':
        logger.debug('[RealtimePipeline] Caller speech stopped');
        break;

      case 'input_audio_buffer.committed':
        logger.debug('[RealtimePipeline] Audio buffer committed');
        break;

      // ── Caller transcript (streaming deltas + final) ────────
      case 'conversation.item.input_audio_transcription.delta':
        // Streaming partial transcript — ignore (we use the .completed event)
        break;

      case 'conversation.item.input_audio_transcription.completed': {
        const callerText = event.transcript ?? '';
        if (callerText.trim()) {
          this.addTranscript('caller', callerText);
          this.fireHookSafe('beforeAgentResponse', callerText);
        }
        break;
      }

      case 'conversation.item.input_audio_transcription.failed':
        logger.warn({ error: event.error }, '[RealtimePipeline] Input transcription failed');
        break;

      // ── Response lifecycle ──────────────────────────────────
      case 'response.created':
        this.isResponseActive = true;
        this.currentResponseId = event.response?.id ?? null;
        this.interruptingResponseId = null;
        this.currentAssistantItemId = null;
        this.currentAssistantContentIndex = 0;
        this.responseStartTimestamp = null;
        this.hasStartedAudioForCurrentResponse = false;
        this.clearPlaybackTailContext();
        this.setState('processing');
        this.agentTranscriptBuffer = '';
        break;

      // ── Audio output ────────────────────────────────────────
      case 'response.audio.delta': {
        if (!this.hasStartedAudioForCurrentResponse) {
          this.responseStartTimestamp = this.latestMediaTimestamp;
          this.hasStartedAudioForCurrentResponse = true;
        }
        if (this.state !== 'speaking') {
          this.setState('speaking');
          logger.info({
            responseId: this.currentResponseId,
            assistantItemId: this.currentAssistantItemId,
            responseStartTimestamp: this.responseStartTimestamp,
            latestMediaTimestamp: this.latestMediaTimestamp,
          }, '[RealtimePipeline] Agent started speaking');
        }
        const audioBytes = Buffer.from(event.delta, 'base64');
        const frame: AudioFrame = {
          audio: audioBytes,
          sampleRate: 8000,
          encoding: 'mulaw',
          channels: 1,
          timestamp: Date.now() - (this.sessionInfo?.startedAt.getTime() ?? Date.now()),
        };
        this.emit('audio:out', frame);
        break;
      }

      case 'response.audio.done':
        logger.debug({
          latestMediaTimestamp: this.latestMediaTimestamp,
          responseStartTimestamp: this.responseStartTimestamp,
          elapsedPlaybackMs: this.getElapsedPlaybackMs(),
        }, '[RealtimePipeline] Audio output complete');
        break;

      // ── Agent transcript ────────────────────────────────────
      case 'response.audio_transcript.delta':
        this.agentTranscriptBuffer += event.delta ?? '';
        break;

      case 'response.audio_transcript.done': {
        const agentText = event.transcript ?? this.agentTranscriptBuffer;
        if (agentText.trim()) {
          this.addTranscript('agent', agentText);
          this.fireHookSafe('afterAgentResponse', agentText);
          this.session.incrementTurns();
        }
        this.agentTranscriptBuffer = '';
        break;
      }

      // ── Function calling ────────────────────────────────────
      case 'response.function_call_arguments.delta': {
        const callId = event.call_id;
        if (callId) {
          const existing = this.pendingToolCalls.get(callId);
          if (existing) {
            existing.arguments += event.delta ?? '';
          }
        }
        break;
      }

      case 'response.output_item.added': {
        if (event.item?.type === 'function_call') {
          this.pendingToolCalls.set(event.item.call_id, {
            name: event.item.name,
            arguments: '',
          });
        }
        if (event.item?.type === 'message' && event.item?.role === 'assistant' && event.item?.id) {
          this.currentAssistantItemId = event.item.id;
          this.currentAssistantContentIndex = 0;
        }
        break;
      }

      case 'response.function_call_arguments.done': {
        const callId = event.call_id;
        const toolName = event.name;
        const argsStr = event.arguments ?? '';

        logger.info({ callId, toolName }, '[RealtimePipeline] Tool call received');

        this.addTranscript('tool_use', argsStr, toolName, callId);
        this.executeToolCall(callId, toolName, argsStr);
        this.pendingToolCalls.delete(callId);
        break;
      }

      // ── Response complete ───────────────────────────────────
      case 'response.done': {
        this.isResponseActive = false;
        const status = event.response?.status;
        if (status === 'cancelled') {
          logger.debug('[RealtimePipeline] Response cancelled (barge-in)');
        } else if (status === 'failed') {
          logger.error({ error: event.response?.status_details },
            '[RealtimePipeline] Response failed');
        }

        // Echo flush: clear any residual echo from the audio buffer.
        // While the agent was speaking, Twilio's media stream sent back
        // the agent's own audio as echo. This accumulated in OpenAI's
        // input buffer and could trigger false speech detection.
        // Clearing it now prevents ghost "caller speech" after agent stops.
        if (status !== 'cancelled') {
          this.sendEvent({ type: 'input_audio_buffer.clear' });
        }

        if (status !== 'cancelled' && this.currentAssistantItemId && this.responseStartTimestamp != null) {
          this.tailResponseId = this.currentResponseId;
          this.tailAssistantItemId = this.currentAssistantItemId;
          this.tailAssistantContentIndex = this.currentAssistantContentIndex;
          this.tailResponseStartTimestamp = this.responseStartTimestamp;
          this.tailExpiresAt = Date.now() + 8000;
        } else if (status === 'cancelled') {
          this.clearPlaybackTailContext();
        }

        this.currentResponseId = null;
        this.interruptingResponseId = null;
        this.currentAssistantItemId = null;
        this.currentAssistantContentIndex = 0;
        this.responseStartTimestamp = null;
        this.hasStartedAudioForCurrentResponse = false;
        if (this.state !== 'ended') {
          this.setState('listening');
        }
        break;
      }

      // ── Errors ──────────────────────────────────────────────
      case 'error': {
        const errorCode = event.error?.code;
        const errorMsg = event.error?.message ?? 'Unknown error';

        // Non-fatal errors: log as warning, don't propagate to bridge
        if (errorCode === 'response_cancel_not_active') {
          logger.debug({ errorCode }, '[RealtimePipeline] Non-fatal: cancel with no active response');
          break;
        }

        logger.error({
          errorType: event.error?.type,
          errorCode,
          errorMessage: errorMsg,
        }, '[RealtimePipeline] Server error');
        this.emitError(new Error(`Realtime API: ${errorMsg}`));
        break;
      }

      // ── Rate limits ─────────────────────────────────────────
      case 'rate_limits.updated':
        logger.debug({ rateLimits: event.rate_limits }, '[RealtimePipeline] Rate limits');
        break;

      // ── Known events we intentionally don't handle ──────────
      case 'response.content_part.added':
        if (event.part?.type === 'audio' && typeof event.content_index === 'number') {
          this.currentAssistantContentIndex = event.content_index;
        }
        break;

      case 'response.content_part.done':
      case 'response.output_item.done':
      case 'response.output_text.delta':
      case 'response.output_text.done':
      case 'conversation.item.created':
      case 'conversation.item.added':
      case 'conversation.item.done':
        break;

      default:
        logger.debug({ type: event.type }, '[RealtimePipeline] Unhandled event');
        break;
    }
  }

  // ─── Tool Execution ───────────────────────────────────────────────

  private async executeToolCall(callId: string, toolName: string, argsStr: string): Promise<void> {
    try {
      const args = JSON.parse(argsStr || '{}');
      logger.info({ callId, toolName, args }, '[RealtimePipeline] Executing tool');

      const result = await this.toolManager.execute(toolName, args);
      const resultStr = typeof result === 'string' ? result : JSON.stringify(result);

      this.addTranscript('tool_result', resultStr, toolName, callId);

      logger.info({ callId, toolName, resultLength: resultStr.length },
        '[RealtimePipeline] Tool executed successfully');

      // Send function output back to OpenAI
      this.sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: resultStr,
        },
      });

      // Trigger continuation
      this.sendEvent({ type: 'response.create' });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error({ callId, toolName, error: errorMsg }, '[RealtimePipeline] Tool execution failed');

      this.addTranscript('tool_result', `Error: ${errorMsg}`, toolName, callId);

      // Send error as function output so the model can handle gracefully
      this.sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify({ error: errorMsg }),
        },
      });

      this.sendEvent({ type: 'response.create' });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sendEvent(event: Record<string, any>): void {
    if (!this.ws || this.ws.readyState !== 1) {
      logger.warn({ eventType: event.type }, '[RealtimePipeline] Cannot send — WebSocket not open');
      return;
    }
    try {
      this.ws.send(JSON.stringify(event));
    } catch (error) {
      logger.error({ eventType: event.type, error: (error as Error).message },
        '[RealtimePipeline] Failed to send event');
    }
  }

  private setState(newState: SessionState): void {
    if (this.state === newState) return;
    const prev = this.state;
    this.state = newState;
    this.emit('state:change', newState);
    logger.debug({ from: prev, to: newState }, '[RealtimePipeline] State transition');
  }

  private getElapsedPlaybackMs(): number {
    if (this.responseStartTimestamp == null) return 0;
    return Math.max(0, this.latestMediaTimestamp - this.responseStartTimestamp);
  }

  private getTailElapsedPlaybackMs(): number {
    if (this.tailResponseStartTimestamp == null) return 0;
    return Math.max(0, this.latestMediaTimestamp - this.tailResponseStartTimestamp);
  }

  private clearPlaybackTailContext(): void {
    this.tailResponseId = null;
    this.tailAssistantItemId = null;
    this.tailAssistantContentIndex = 0;
    this.tailResponseStartTimestamp = null;
    this.tailExpiresAt = 0;
  }

  private handleBargeIn(source: 'vad_speech_started' | 'manual_interrupt'): void {
    if (!this.config.interruptible) {
      logger.debug({ source }, '[RealtimePipeline] Ignoring barge-in because interruptible=false');
      return;
    }
    const activePlayback = this.isAssistantPlaybackActive();
    const tailPlayback = this.isPlaybackTailActive();
    if (!activePlayback && !tailPlayback) {
      logger.debug({
        source,
        state: this.state,
        isResponseActive: this.isResponseActive,
        latestMediaTimestamp: this.latestMediaTimestamp,
        responseStartTimestamp: this.responseStartTimestamp,
        tailResponseStartTimestamp: this.tailResponseStartTimestamp,
        elapsedPlaybackMs: this.getElapsedPlaybackMs(),
        tailElapsedPlaybackMs: this.getTailElapsedPlaybackMs(),
      }, '[RealtimePipeline] Ignoring barge-in because agent is not actively speaking');
      return;
    }

    const interruptTargetResponseId = activePlayback ? this.currentResponseId : this.tailResponseId;
    if (this.interruptingResponseId === interruptTargetResponseId) {
      logger.debug({ source, responseId: interruptTargetResponseId }, '[RealtimePipeline] Duplicate barge-in ignored');
      return;
    }

    this.interruptingResponseId = interruptTargetResponseId;
    if (this.isResponseActive) {
      this.sendEvent({ type: 'response.cancel' });
    }
    this.emit('interrupt');
    this.truncateAssistantAudio(activePlayback ? 'active' : 'tail');
    this.clearPlaybackTailContext();

    logger.info({
      source,
      responseId: interruptTargetResponseId,
      assistantItemId: activePlayback ? this.currentAssistantItemId : this.tailAssistantItemId,
      latestMediaTimestamp: this.latestMediaTimestamp,
      responseStartTimestamp: activePlayback ? this.responseStartTimestamp : this.tailResponseStartTimestamp,
      elapsedPlaybackMs: activePlayback ? this.getElapsedPlaybackMs() : this.getTailElapsedPlaybackMs(),
      playbackPhase: activePlayback ? 'active' : 'tail',
    }, '[RealtimePipeline] Barge-in: cancelled, cleared, and truncated agent response');
  }

  private isAssistantPlaybackActive(): boolean {
    return this.isResponseActive && this.responseStartTimestamp != null;
  }

  private isPlaybackTailActive(): boolean {
    return this.tailAssistantItemId != null
      && this.tailResponseStartTimestamp != null
      && Date.now() <= this.tailExpiresAt;
  }

  private truncateAssistantAudio(phase: 'active' | 'tail'): void {
    const itemId = phase === 'active' ? this.currentAssistantItemId : this.tailAssistantItemId;
    const contentIndex = phase === 'active' ? this.currentAssistantContentIndex : this.tailAssistantContentIndex;
    const responseId = phase === 'active' ? this.currentResponseId : this.tailResponseId;
    const responseStartTimestamp = phase === 'active' ? this.responseStartTimestamp : this.tailResponseStartTimestamp;
    const audioEndMs = phase === 'active' ? this.getElapsedPlaybackMs() : this.getTailElapsedPlaybackMs();

    if (!itemId) {
      logger.warn({
        responseId,
        latestMediaTimestamp: this.latestMediaTimestamp,
        responseStartTimestamp,
        phase,
      }, '[RealtimePipeline] Cannot truncate assistant audio because no assistant item is tracked');
      return;
    }

    logger.info({
      itemId,
      contentIndex,
      audioEndMs,
      latestMediaTimestamp: this.latestMediaTimestamp,
      responseStartTimestamp,
      phase,
    }, '[RealtimePipeline] Truncating assistant audio');
    this.sendEvent({
      type: 'conversation.item.truncate',
      item_id: itemId,
      content_index: contentIndex,
      audio_end_ms: audioEndMs,
    });
  }

  private emitError(error: Error): void {
    this.emit('error', error);
    if (this.config.hooks?.onError && this.sessionInfo) {
      this.config.hooks.onError(error, this.sessionInfo).catch(e => {
        logger.error({ error: (e as Error).message }, '[RealtimePipeline] onError hook threw');
      });
    }
  }

  private addTranscript(role: TranscriptMessage['role'], text: string, toolName?: string, toolCallId?: string): void {
    const entry: TranscriptMessage = {
      role,
      text,
      timestamp: Date.now(),
      ...(toolName ? { toolName } : {}),
      ...(toolCallId ? { toolCallId } : {}),
    };
    this.transcript.push(entry);
    this.emit('transcript', entry);
  }

  private fireHookSafe(hookName: 'beforeAgentResponse' | 'afterAgentResponse', text: string): void {
    const hook = this.config.hooks?.[hookName];
    if (!hook || !this.sessionInfo) return;

    hook(text, this.sessionInfo).catch(error => {
      logger.error({ hookName, error: (error as Error).message },
        '[RealtimePipeline] Hook threw');
    });
  }
}
