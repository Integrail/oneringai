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
import { ContentType } from '../../../domain/entities/Content.js';
import { MessageRole } from '../../../domain/entities/Message.js';
import { Vendor } from '../../../core/Vendor.js';
import { logger } from '../../../infrastructure/observability/Logger.js';
import { pcmToMulaw, resamplePcm } from '../adapters/twilio/codecs.js';
import { OpenAIRealtimeSession } from '../openai/OpenAIRealtimeSession.js';
import type { Agent } from '../../../core/Agent.js';
import type { ToolManager } from '../../../core/ToolManager.js';
import { ToolCallState, type ToolFunction, type ToolResult } from '../../../domain/entities/Tool.js';
import type { OutputItem } from '../../../domain/entities/Message.js';
import type {
  OpenAIRealtimeServerEvent,
  OpenAIRealtimeSessionConfig,
  OpenAIRealtimeTurnDetection,
  OpenAIRealtimeVoice,
} from '../openai/RealtimeTypes.js';
import type { VoiceSession } from '../VoiceSession.js';
import type {
  IVoicePipeline,
  AudioFrame,
  SessionState,
  VoiceSessionInfo,
  VoicePipelineEvents,
  VoiceHooks,
  TranscriptMessage,
  IVoiceActivityDetector,
} from '../types.js';

// =============================================================================
// Configuration
// =============================================================================

export interface RealtimePipelineInitConfig {
  agent: Agent;
  session: VoiceSession;
  voice?: OpenAIRealtimeVoice;
  speed?: number;
  turnDetection?: 'server_vad' | 'semantic_vad' | 'none';
  vadThreshold?: number;
  silenceDurationMs?: number;
  prefixPaddingMs?: number;
  idleTimeoutMs?: number;
  semanticVADEagerness?: 'low' | 'medium' | 'high' | 'auto';
  noiseReduction?: 'near_field' | 'far_field' | 'none';
  inputTranscription?: boolean;
  transcriptionModel?: string;
  transcriptionLanguage?: string;
  realtime?: Omit<OpenAIRealtimeSessionConfig, 'type' | 'model'>;
  safetyIdentifier?: string;
  greeting?: string;
  interruptible?: boolean;
  hooks?: VoiceHooks;
  manualVAD?: IVoiceActivityDetector;
  realtimeSessionFactory?: (options: ConstructorParameters<typeof OpenAIRealtimeSession>[0]) => OpenAIRealtimeSession;
}

// =============================================================================
// OpenAI Realtime API event types (subset we use)
// =============================================================================

type RealtimeServerEvent = OpenAIRealtimeServerEvent;

// =============================================================================
// RealtimePipeline
// =============================================================================

export class RealtimePipeline extends EventEmitter implements IVoicePipeline {
  private config: RealtimePipelineInitConfig;
  private session: VoiceSession;
  private agent: Agent;
  private toolManager: ToolManager;
  private tools: ToolFunction[];
  private realtime: OpenAIRealtimeSession | null = null;
  private state: SessionState = 'idle';
  private destroyed = false;
  private ignoringEvents = false;
  private sessionInfo: VoiceSessionInfo | null = null;
  private transcript: TranscriptMessage[] = [];
  private agentTranscriptBuffer = '';
  private pendingToolCalls = new Map<string, { name: string; arguments: string }>();
  private activeToolExecutions = 0;
  private awaitingToolContinuation = false;
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
    this.agent = config.agent;
    this.toolManager = config.agent.tools;
    this.tools = this.toolManager.getEnabled();
  }

  // ─── IVoicePipeline Implementation ────────────────────────────────

  async init(sessionInfo: VoiceSessionInfo): Promise<void> {
    if (this.agent.connector.vendor !== Vendor.OpenAI) {
      throw new Error('RealtimePipeline requires an OpenAI connector');
    }
    if (this.config.speed !== undefined && (this.config.speed < 0.25 || this.config.speed > 1.5)) {
      throw new RangeError('Realtime voice speed must be between 0.25 and 1.5');
    }
    this.sessionInfo = sessionInfo;
    this.setState('connected');

    const model = this.agent.model;

    logger.info({
      model,
      sessionId: sessionInfo.sessionId,
      voice: this.config.voice ?? 'marin',
      turnDetection: this.config.turnDetection ?? 'server_vad',
      toolCount: this.tools.length,
    }, '[RealtimePipeline] Connecting to OpenAI Realtime API');

    const factory = this.config.realtimeSessionFactory ?? ((options) => new OpenAIRealtimeSession(options));
    this.realtime = factory({
      connector: this.agent.connector,
      model,
      safetyIdentifier: this.config.safetyIdentifier,
    });
    this.realtime.on('event', (event) => this.handleServerEvent(event));
    this.realtime.on('close', (code, reason) => {
      logger.info({ code, reason: reason?.toString() }, '[RealtimePipeline] WebSocket closed');
      if (!this.destroyed) {
        this.emitError(new Error(`WebSocket closed unexpectedly: ${code}`));
      }
    });
    this.realtime.on('error', (error) => {
      logger.error({ error: error.message }, '[RealtimePipeline] WebSocket error');
      this.emitError(error);
    });
    const created = await this.realtime.connect();
    logger.info({
      sessionId: sessionInfo.sessionId,
      realtimeSessionId: (created.session as { id?: string } | undefined)?.id,
    }, '[RealtimePipeline] Session created');

    // Send session.update with instructions, tools, audio config
    await this.sendSessionUpdate();

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
    if (this.destroyed || !this.realtime?.isConnected) return;

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

    if (this.config.turnDetection === 'none' && this.config.manualVAD) {
      const event = this.config.manualVAD.process(frame);
      if (event === 'speech_start') this.onSpeechStart();
      if (event === 'speech_end') void this.onSpeechEnd();
    }
  }

  async onSpeechEnd(): Promise<void> {
    // When using server VAD, this is handled by OpenAI
    if (this.config.turnDetection !== 'none') return;

    // Manual mode: commit buffer and request response
    this.sendEvent({ type: 'input_audio_buffer.commit' });
    this.sendEvent({ type: 'response.create' });
  }

  onSpeechStart(): void {
    if (this.config.turnDetection === 'none' && this.isAssistantPlaybackActive()) {
      this.handleBargeIn('manual_interrupt');
    }
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

    const realtime = this.realtime;
    this.realtime = null;
    try {
      realtime?.close();
    } catch (error) {
      logger.debug({ error }, '[RealtimePipeline] WebSocket close error during destroy');
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
    this.config.manualVAD?.reset();

    this.setState('ended');
    this.removeAllListeners();

    logger.info({
      sessionId: this.sessionInfo?.sessionId,
      transcriptEntries: this.transcript.length,
    }, '[RealtimePipeline] Destroyed');
  }

  // ─── Session Update ───────────────────────────────────────────────

  private async sendSessionUpdate(): Promise<void> {
    // Convert tools to Realtime API format (flattened)
    const tools = this.tools.map(t => ({
      type: 'function' as const,
      name: t.definition.function.name,
      description: t.definition.function.description ?? '',
      parameters: t.definition.function.parameters ?? { type: 'object', properties: {} },
    }));

    const configured = this.config.realtime ?? {};
    const configuredInput = configured.audio?.input ?? {};
    const configuredOutput = configured.audio?.output ?? {};

    let turnDetection: OpenAIRealtimeTurnDetection = configuredInput.turn_detection ?? null;
    if (this.config.turnDetection === 'semantic_vad') {
      turnDetection = {
        type: 'semantic_vad',
        eagerness: this.config.semanticVADEagerness ?? 'auto',
        create_response: true,
        interrupt_response: this.config.interruptible !== false,
      };
    } else if (this.config.turnDetection === 'none') {
      turnDetection = null;
    } else if (this.config.turnDetection === 'server_vad'
      || configuredInput.turn_detection === undefined) {
      turnDetection = {
        type: 'server_vad',
        threshold: this.config.vadThreshold ?? 0.5,
        silence_duration_ms: this.config.silenceDurationMs ?? 500,
        prefix_padding_ms: this.config.prefixPaddingMs ?? 400,
        ...(this.config.idleTimeoutMs === undefined ? {} : { idle_timeout_ms: this.config.idleTimeoutMs }),
        create_response: true,
        interrupt_response: this.config.interruptible !== false,
      };
    }

    const agentInstructions = await this.buildAgentInstructions();
    const instructions = [agentInstructions, configured.instructions]
      .filter((value): value is string => Boolean(value?.trim()))
      .join('\n\n');
    const noiseReduction = this.config.noiseReduction === 'none'
      ? null
      : this.config.noiseReduction
        ? { type: this.config.noiseReduction }
        : configuredInput.noise_reduction ?? { type: 'near_field' as const };
    const session: OpenAIRealtimeSessionConfig = {
      ...configured,
      type: 'realtime',
      instructions,
      tools: [...tools, ...(configured.tools ?? [])],
      tool_choice: configured.tool_choice ?? 'auto',
      parallel_tool_calls: configured.parallel_tool_calls ?? true,
      output_modalities: configured.output_modalities ?? ['audio'],
      audio: {
        input: {
          ...configuredInput,
          // VoiceBridge's telephony protocol is G.711 mu-law at 8 kHz.
          format: { type: 'audio/pcmu' },
          noise_reduction: noiseReduction,
          turn_detection: turnDetection,
        },
        output: {
          ...configuredOutput,
          format: { type: 'audio/pcmu' },
          voice: this.config.voice ?? configuredOutput.voice ?? 'marin',
          ...(this.config.speed === undefined ? {} : { speed: this.config.speed }),
        },
      },
    };

    // Enable input transcription for hooks/logging
    if (this.config.inputTranscription === false
      || (this.config.inputTranscription === undefined && configuredInput.transcription === null)) {
      session.audio!.input!.transcription = null;
    } else {
      const configuredTranscription = configuredInput.transcription ?? {};
      session.audio!.input!.transcription = {
        ...configuredTranscription,
        model: this.config.transcriptionModel
          ?? configuredTranscription.model
          ?? 'gpt-4o-transcribe',
        ...(this.config.transcriptionLanguage
          ? { language: this.config.transcriptionLanguage }
          : {}),
      };
    }

    this.realtime?.updateSession(session);

    logger.info({
      toolCount: tools.length,
      voice: session.audio?.output?.voice,
      turnDetection: turnDetection?.type ?? 'none',
      inputTranscription: this.config.inputTranscription !== false,
    }, '[RealtimePipeline] Session updated');
  }

  private async buildAgentInstructions(): Promise<string> {
    const prepared = await this.agent.context.prepare();
    return prepared.input
      .filter((item) => item.type === 'message' && item.role === MessageRole.DEVELOPER)
      .flatMap((item) => item.type === 'message' ? item.content : [])
      .filter((content) => content.type === ContentType.INPUT_TEXT)
      .map((content) => content.type === ContentType.INPUT_TEXT ? content.text : '')
      .join('\n\n');
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
          this.agent.context.addUserMessage(callerText);
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
      case 'response.output_audio.delta':
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

      case 'response.output_audio.done':
      case 'response.audio.done':
        logger.debug({
          latestMediaTimestamp: this.latestMediaTimestamp,
          responseStartTimestamp: this.responseStartTimestamp,
          elapsedPlaybackMs: this.getElapsedPlaybackMs(),
        }, '[RealtimePipeline] Audio output complete');
        break;

      // ── Agent transcript ────────────────────────────────────
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta':
        this.agentTranscriptBuffer += event.delta ?? '';
        break;

      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done': {
        const agentText = event.transcript ?? this.agentTranscriptBuffer;
        if (agentText.trim()) {
          this.addTranscript('agent', agentText);
          const output: OutputItem[] = [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{ type: ContentType.OUTPUT_TEXT, text: agentText }],
          }];
          this.agent.context.addAssistantResponse(output);
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
            arguments: event.item.arguments ?? '',
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
        const pending = this.pendingToolCalls.get(callId);
        const toolName = event.name ?? pending?.name;
        const argsStr = event.arguments ?? pending?.arguments ?? '';

        if (!callId || !toolName) {
          this.emitError(new Error('Realtime API returned an incomplete function call'));
          break;
        }

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
        this.maybeContinueAfterTools();
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
    this.activeToolExecutions++;
    this.recordToolUse(callId, toolName, argsStr);
    try {
      const args = JSON.parse(argsStr || '{}');
      logger.info({ callId, toolName, args }, '[RealtimePipeline] Executing tool');

      const result = await this.toolManager.execute(toolName, args);
      const resultStr = typeof result === 'string' ? result : JSON.stringify(result);

      this.addTranscript('tool_result', resultStr, toolName, callId);
      this.recordToolResult({
        tool_use_id: callId,
        tool_name: toolName,
        tool_args: args,
        content: result,
        state: ToolCallState.COMPLETED,
      });

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

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error({ callId, toolName, error: errorMsg }, '[RealtimePipeline] Tool execution failed');

      this.addTranscript('tool_result', `Error: ${errorMsg}`, toolName, callId);
      this.recordToolResult({
        tool_use_id: callId,
        tool_name: toolName,
        content: { error: errorMsg },
        error: errorMsg,
        state: ToolCallState.FAILED,
      });

      // Send error as function output so the model can handle gracefully
      this.sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify({ error: errorMsg }),
        },
      });

    } finally {
      this.activeToolExecutions--;
      this.awaitingToolContinuation = true;
      this.maybeContinueAfterTools();
    }
  }

  private maybeContinueAfterTools(): void {
    if (!this.awaitingToolContinuation || this.isResponseActive || this.activeToolExecutions > 0) return;
    this.awaitingToolContinuation = false;
    this.sendEvent({ type: 'response.create' });
  }

  private recordToolUse(callId: string, toolName: string, argsStr: string): void {
    if (this.destroyed) return;
    try {
      this.agent.context.addAssistantResponse([{
        type: 'message',
        role: MessageRole.ASSISTANT,
        content: [{
          type: ContentType.TOOL_USE,
          id: callId,
          name: toolName,
          arguments: argsStr,
        }],
      }]);
    } catch (error) {
      logger.debug({ error }, '[RealtimePipeline] Could not record tool use in agent context');
    }
  }

  private recordToolResult(result: ToolResult): void {
    if (this.destroyed) return;
    try {
      this.agent.context.addToolResults([result]);
    } catch (error) {
      logger.debug({ error }, '[RealtimePipeline] Could not record tool result in agent context');
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sendEvent(event: Record<string, any>): void {
    if (!this.realtime?.isConnected) {
      logger.warn({ eventType: event.type }, '[RealtimePipeline] Cannot send — WebSocket not open');
      return;
    }
    try {
      this.realtime.send(event as { type: string; [key: string]: unknown });
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
