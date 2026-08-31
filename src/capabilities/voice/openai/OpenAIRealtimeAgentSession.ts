import { EventEmitter } from 'events';
import type { Agent } from '../../../core/Agent.js';
import { Vendor } from '../../../core/Vendor.js';
import { ContentType } from '../../../domain/entities/Content.js';
import { getModelInfo } from '../../../domain/entities/Model.js';
import { MessageRole, type InputItem, type OutputItem } from '../../../domain/entities/Message.js';
import { ToolCallState, type ToolResult } from '../../../domain/entities/Tool.js';
import type { TokenUsage } from '../../../domain/entities/Response.js';
import { logger } from '../../../infrastructure/observability/Logger.js';
import { OpenAIRealtimeSession } from './OpenAIRealtimeSession.js';
import type {
  OpenAIRealtimeClientEvent,
  OpenAIRealtimeServerEvent,
  OpenAIRealtimeSessionConfig,
  OpenAIRealtimeTool,
} from './RealtimeTypes.js';

/** Transport contract implemented by WebSocket, WebRTC data-channel, and SIP control adapters. */
export interface OpenAIRealtimeAgentTransport {
  readonly isConnected: boolean;
  /** Set when the transport already converts JSON output-audio events to `audio`. */
  readonly emitsOutputAudioFromEvents?: boolean;
  connect?(options?: { signal?: AbortSignal }): Promise<OpenAIRealtimeServerEvent>;
  updateSession?(session: OpenAIRealtimeSessionConfig): void;
  appendAudio?(audio: Buffer | string): boolean;
  send(event: OpenAIRealtimeClientEvent): void;
  close(code?: number, reason?: string): void;
  on(event: 'event', handler: (event: OpenAIRealtimeServerEvent) => void): unknown;
  on(event: 'audio', handler: (audio: Buffer) => void): unknown;
  on(event: 'error', handler: (error: Error) => void): unknown;
  on(event: 'close', handler: (code: number, reason: string) => void): unknown;
  on(event: 'backpressure', handler: (info: { bufferedAmount: number; limit: number }) => void): unknown;
  off?(event: string, handler: (...args: any[]) => void): unknown;
}

export interface OpenAIRealtimeMCPApprovalRequest {
  id: string;
  serverLabel?: string;
  name: string;
  arguments: string;
}

export interface OpenAIRealtimeMCPApprovalDecision {
  approve: boolean;
  reason?: string;
}

export interface OpenAIRealtimeAgentSessionOptions {
  agent: Agent;
  /** Existing WebRTC/SIP call to join through the default server-side WebSocket transport. */
  callId?: string;
  /** Base Realtime session options. Agent instructions and local tools are merged into this object. */
  session?: Omit<OpenAIRealtimeSessionConfig, 'type' | 'model'>;
  /** Custom transport for WebRTC/SIP bridges and tests. Defaults to the connector-first WebSocket transport. */
  transport?: OpenAIRealtimeAgentTransport;
  /** Factory used when a custom WebSocket implementation is required. */
  realtimeSessionFactory?: (
    options: ConstructorParameters<typeof OpenAIRealtimeSession>[0],
  ) => OpenAIRealtimeSession;
  safetyIdentifier?: string;
  /**
   * `per_turn` refreshes plugin/memory instructions before every model response
   * and therefore manages response.create itself. `initial` keeps server VAD's
   * automatic response behavior. Default: `per_turn`.
   */
  contextSync?: 'per_turn' | 'initial';
  /** Called for provider-hosted MCP tools. Missing handlers reject approval requests. */
  approveMCP?: (
    request: OpenAIRealtimeMCPApprovalRequest,
  ) => Promise<OpenAIRealtimeMCPApprovalDecision> | OpenAIRealtimeMCPApprovalDecision;
  /** Emit session:expiring before OpenAI's hard 60-minute limit. Default: 55 minutes. */
  sessionExpiryWarningMs?: number;
  /** Maximum time to wait for OpenAI to acknowledge a session update. Default: 10 seconds. */
  sessionUpdateTimeoutMs?: number;
  /** Maximum time to drain active local tools during shutdown. Default: 5 seconds. */
  toolDrainTimeoutMs?: number;
}

export interface OpenAIRealtimeAgentUsage extends TokenUsage {
  input_audio_tokens: number;
  output_audio_tokens: number;
  input_text_tokens: number;
  output_text_tokens: number;
}

export interface OpenAIRealtimeAgentSessionEvents {
  event: (event: OpenAIRealtimeServerEvent) => void;
  audio: (audio: Buffer) => void;
  'transcript:input': (transcript: string) => void;
  'transcript:output': (transcript: string) => void;
  'tool:start': (call: { callId: string; name: string }) => void;
  'tool:complete': (result: ToolResult) => void;
  'mcp:approval': (
    request: OpenAIRealtimeMCPApprovalRequest,
    decision: OpenAIRealtimeMCPApprovalDecision,
  ) => void;
  'mcp:tools': (event: OpenAIRealtimeServerEvent) => void;
  'mcp:call': (event: OpenAIRealtimeServerEvent) => void;
  usage: (usage: OpenAIRealtimeAgentUsage) => void;
  'rate_limits': (rateLimits: unknown) => void;
  'session:expiring': () => void;
  backpressure: (info: { bufferedAmount: number; limit: number }) => void;
  error: (error: Error) => void;
  close: (code: number, reason: string) => void;
}

const EMPTY_USAGE = (): OpenAIRealtimeAgentUsage => ({
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
  input_audio_tokens: 0,
  output_audio_tokens: 0,
  input_text_tokens: 0,
  output_text_tokens: 0,
  cached_input_tokens: 0,
  cache_creation_input_tokens: 0,
  output_tokens_details: { reasoning_tokens: 0 },
  native_tool_calls: {},
});

const DEFAULT_SESSION_UPDATE_TIMEOUT_MS = 10_000;
const DEFAULT_TOOL_DRAIN_TIMEOUT_MS = 5_000;
const realtimeLogger = logger.child({ component: 'OpenAIRealtimeAgentSession' });

interface PendingSessionUpdate {
  eventId: string;
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  abort?: () => void;
}

/**
 * Agent-aware controller for OpenAI Realtime voice sessions.
 *
 * It is deliberately transport-neutral: the default transport is the server
 * WebSocket client, while browsers can provide a WebRTC data-channel adapter.
 * Local functions execute through Agent (not ToolManager directly), remote MCP
 * approvals fail closed, AgentContext is synchronized per turn, and usage is
 * accumulated into both this session and Agent metrics.
 */
export class OpenAIRealtimeAgentSession extends EventEmitter {
  readonly agent: Agent;
  readonly transport: OpenAIRealtimeAgentTransport;

  private readonly options: OpenAIRealtimeAgentSessionOptions;
  private readonly contextSync: 'per_turn' | 'initial';
  private started = false;
  private closing = false;
  private destroyed = false;
  private responseActive = false;
  private waitingForToolContinuation = false;
  private pendingToolCalls = new Map<string, { name: string; arguments: string }>();
  private activeToolExecutions = new Set<Promise<void>>();
  private pendingContextResults: ToolResult[] = [];
  private assistantTranscripts: string[] = [];
  private assistantTranscriptBuffer = '';
  private currentResponseId: string | null = null;
  private responseSequence = 0;
  private recordedTranscriptsByResponse = new Map<string, Set<string>>();
  private usage = EMPTY_USAGE();
  private syncChain: Promise<void> = Promise.resolve();
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private configuredInstructions = '';
  private lastToolsSignature = '';
  private completionPromise: Promise<void> | null = null;
  private sessionUpdateSequence = 0;
  private pendingSessionUpdates: PendingSessionUpdate[] = [];

  private readonly onTransportEvent = (event: OpenAIRealtimeServerEvent): void => {
    void this.handleServerEvent(event).catch((error) => this.emitError(error));
  };
  private readonly onTransportAudio = (audio: Buffer): void => { this.emit('audio', audio); };
  private readonly onTransportError = (error: Error): void => {
    realtimeLogger.debug({ errorName: error.name }, 'Realtime agent transport error');
    this.emitError(error);
  };
  private readonly onTransportClose = (code: number, reason: string): void => {
    realtimeLogger.debug({ code, reasonCharacters: reason.length }, 'Realtime agent transport closed');
    this.rejectPendingSessionUpdates(
      new Error(`OpenAI Realtime transport closed before session setup completed: ${code} ${reason}`.trim()),
    );
    this.emit('close', code, reason);
    if (!this.destroyed && !this.closing && this.started) {
      const message = `OpenAI Realtime transport closed unexpectedly: ${code} ${reason}`.trim();
      this.emitError(new Error(message));
      if (!this.completionPromise) {
        this.completionPromise = this.finish(code || 1011, message, 'unexpected');
      }
      void this.completionPromise.catch((error) => this.emitError(error));
    }
  };
  private readonly onTransportBackpressure = (
    info: { bufferedAmount: number; limit: number },
  ): void => { this.emit('backpressure', info); };

  constructor(options: OpenAIRealtimeAgentSessionOptions) {
    super();
    this.options = options;
    this.agent = options.agent;
    this.contextSync = options.contextSync ?? 'per_turn';
    const factory = options.realtimeSessionFactory
      ?? ((sessionOptions) => new OpenAIRealtimeSession(sessionOptions));
    this.transport = options.transport ?? factory({
      connector: this.agent.connector,
      model: this.agent.model,
      callId: options.callId,
      safetyIdentifier: options.safetyIdentifier,
    });
    this.transport.on('event', this.onTransportEvent);
    this.transport.on('audio', this.onTransportAudio);
    this.transport.on('error', this.onTransportError);
    this.transport.on('close', this.onTransportClose);
    this.transport.on('backpressure', this.onTransportBackpressure);
  }

  get isConnected(): boolean { return this.started && this.transport.isConnected; }

  async connect(options: { signal?: AbortSignal } = {}): Promise<OpenAIRealtimeServerEvent | undefined> {
    if (this.started) throw new Error('Realtime agent session is already started');
    if (this.destroyed || this.closing) throw new Error('Realtime agent session is destroyed');
    this.validateAgent();

    let created: OpenAIRealtimeServerEvent | undefined;
    let executionStarted = false;
    try {
      realtimeLogger.debug({
        model: this.agent.model,
        contextSync: this.contextSync,
        sideband: Boolean(this.options.callId),
      }, 'Connecting Realtime agent session');
      if (!this.transport.isConnected) {
        if (!this.transport.connect) throw new Error('Realtime transport is not connected');
        created = await this.transport.connect(options);
      }
      await this.agent.beginExternalExecution({ source: 'openai-realtime' });
      executionStarted = true;
      const prepared = await this.prepareSession();
      realtimeLogger.debug({
        model: this.agent.model,
        instructionCharacters: prepared.session.instructions?.length ?? 0,
        toolCount: prepared.session.tools?.length ?? 0,
        historyItems: prepared.history.length,
      }, 'Prepared Realtime agent context');
      await this.updateSessionAcknowledged(prepared.session, options.signal);
      const replayedItems = this.replayContext(prepared.history);
      if (replayedItems > 0) {
        // Realtime control events are ordered. A second acknowledged update is
        // therefore a barrier proving the preceding context replay was applied.
        await this.updateSessionAcknowledged({ type: 'realtime' }, options.signal);
      }
      this.started = true;
      realtimeLogger.debug({ model: this.agent.model }, 'Realtime agent session ready');
      const warningMs = this.options.sessionExpiryWarningMs ?? 55 * 60 * 1000;
      if (warningMs > 0) {
        this.expiryTimer = setTimeout(() => this.emit('session:expiring'), warningMs);
        this.expiryTimer.unref?.();
      }
      return created;
    } catch (error) {
      realtimeLogger.debug({
        model: this.agent.model,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      }, 'Realtime agent session setup failed');
      this.transport.close(1011, 'Realtime agent setup failed');
      try {
        if (executionStarted) {
          await this.agent.completeExternalExecution({
            status: 'failed',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      } catch {
        // Preserve the setup error.
      }
      throw error;
    }
  }

  appendAudio(audio: Buffer | string): boolean {
    if (this.transport.appendAudio) return this.transport.appendAudio(audio);
    this.send({
      type: 'input_audio_buffer.append',
      audio: typeof audio === 'string' ? audio : audio.toString('base64'),
    });
    return true;
  }

  commitAudio(): void { this.send({ type: 'input_audio_buffer.commit' }); }
  clearAudio(): void { this.send({ type: 'input_audio_buffer.clear' }); }
  cancelResponse(): void { this.send({ type: 'response.cancel' }); }
  createResponse(response: Record<string, unknown> = {}): void {
    this.send({ type: 'response.create', ...(Object.keys(response).length ? { response } : {}) });
  }
  truncateItem(itemId: string, audioEndMs: number, contentIndex = 0): void {
    this.send({
      type: 'conversation.item.truncate',
      item_id: itemId,
      content_index: contentIndex,
      audio_end_ms: Math.max(0, Math.round(audioEndMs)),
    });
  }

  async sendText(text: string, response: Record<string, unknown> = {}): Promise<void> {
    this.send({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
    });
    this.agent.recordExternalUserInput(text);
    this.emit('transcript:input', text);
    if (this.contextSync === 'per_turn') await this.syncContextAndCreateResponse(response);
    else this.createResponse(response);
  }

  async sendImage(imageUrl: string, response: Record<string, unknown> = {}): Promise<void> {
    this.send({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_image', image_url: imageUrl }] },
    });
    this.agent.recordExternalUserInput([{
      type: ContentType.INPUT_IMAGE_URL,
      image_url: { url: imageUrl },
    }]);
    if (this.contextSync === 'per_turn') await this.syncContextAndCreateResponse(response);
    else this.createResponse(response);
  }

  getUsage(): OpenAIRealtimeAgentUsage {
    return {
      ...this.usage,
      output_tokens_details: { ...this.usage.output_tokens_details! },
      native_tool_calls: { ...this.usage.native_tool_calls },
    };
  }

  /** Public for custom transports that cannot expose EventEmitter-style events. */
  async handleServerEvent(event: OpenAIRealtimeServerEvent): Promise<void> {
    if (this.destroyed || this.closing) return;
    if (typeof event.type === 'string' && !event.type.endsWith('.delta')) {
      realtimeLogger.debug({ eventType: event.type }, 'Realtime server event');
    }
    this.handleSessionUpdateEvent(event);
    this.emit('event', event);

    switch (event.type) {
      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = String(event.transcript ?? '').trim();
        if (transcript) {
          this.agent.recordExternalUserInput(transcript);
          this.emit('transcript:input', transcript);
        }
        if (this.contextSync === 'per_turn') await this.syncContextAndCreateResponse();
        break;
      }
      case 'conversation.item.input_audio_transcription.failed':
        // The provider still has the original audio item. Do not deadlock a
        // managed turn merely because the optional transcript failed.
        if (this.contextSync === 'per_turn') await this.syncContextAndCreateResponse();
        break;
      case 'response.created':
        this.responseActive = true;
        this.currentResponseId = String(
          event.response?.id ?? event.event_id ?? `response_${++this.responseSequence}`,
        );
        this.recordedTranscriptsByResponse.set(this.currentResponseId, new Set());
        this.assistantTranscriptBuffer = '';
        break;
      case 'response.output_audio.delta':
      case 'response.audio.delta':
        if (!this.transport.emitsOutputAudioFromEvents && typeof event.delta === 'string') {
          this.emit('audio', Buffer.from(event.delta, 'base64'));
        }
        break;
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta':
        this.assistantTranscriptBuffer += String(event.delta ?? '');
        break;
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done': {
        const transcript = String(event.transcript ?? this.assistantTranscriptBuffer).trim();
        if (transcript) this.recordAssistantTranscript(transcript, event.response_id);
        this.assistantTranscriptBuffer = '';
        break;
      }
      case 'response.output_text.done': {
        const text = String(event.text ?? '').trim();
        if (text) this.recordAssistantTranscript(text, event.response_id);
        break;
      }
      case 'response.output_item.added':
        if (event.item?.type === 'function_call' && event.item.call_id && event.item.name) {
          this.pendingToolCalls.set(event.item.call_id, {
            name: event.item.name,
            arguments: event.item.arguments ?? '',
          });
        }
        break;
      case 'response.function_call_arguments.delta': {
        const pending = this.pendingToolCalls.get(event.call_id);
        if (pending) pending.arguments += String(event.delta ?? '');
        break;
      }
      case 'response.function_call_arguments.done':
        this.startLocalToolCall(event);
        break;
      case 'conversation.item.done':
        if (event.item?.type === 'mcp_approval_request') await this.answerMCPApproval(event.item);
        else if (event.item?.type === 'mcp_list_tools') this.emit('mcp:tools', event);
        break;
      case 'mcp_list_tools.in_progress':
      case 'mcp_list_tools.completed':
      case 'mcp_list_tools.failed':
        this.emit('mcp:tools', event);
        break;
      case 'response.mcp_call_arguments.delta':
      case 'response.mcp_call_arguments.done':
      case 'response.mcp_call.in_progress':
      case 'response.mcp_call.completed':
      case 'response.mcp_call.failed':
        this.emit('mcp:call', event);
        break;
      case 'response.output_item.done':
        if (event.item?.type === 'mcp_call') {
          this.recordProviderTool(event.item);
          this.emit('mcp:call', event);
        }
        break;
      case 'response.done': {
        const completedResponseId = String(event.response?.id ?? this.currentResponseId ?? '');
        this.responseActive = false;
        if (event.response?.usage) this.addUsage(event.response.usage);
        await this.maybeContinueAfterTools();
        if (completedResponseId) {
          this.recordedTranscriptsByResponse.delete(completedResponseId);
        }
        if (this.currentResponseId === completedResponseId) {
          this.currentResponseId = null;
        }
        break;
      }
      case 'rate_limits.updated':
        this.emit('rate_limits', event.rate_limits);
        break;
      case 'error':
        this.emitError(new Error(String(event.error?.message ?? 'OpenAI Realtime error')));
        break;
      default:
        break;
    }
  }

  async close(code = 1000, reason = 'OK'): Promise<void> {
    if (this.completionPromise) return this.completionPromise;
    this.completionPromise = this.finish(code, reason, 'normal');
    return this.completionPromise;
  }

  on<K extends keyof OpenAIRealtimeAgentSessionEvents>(
    event: K,
    handler: OpenAIRealtimeAgentSessionEvents[K],
  ): this {
    return super.on(event, handler);
  }

  private async finish(
    code: number,
    reason: string,
    outcome: 'normal' | 'unexpected',
  ): Promise<void> {
    if (this.destroyed || this.closing) return;
    this.closing = true;
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    const toolsDrained = await this.drainActiveTools();
    if (!toolsDrained && !this.agent.isCancelled()) {
      this.agent.cancel('Realtime tool drain deadline exceeded');
    }
    this.destroyed = true;
    this.rejectPendingSessionUpdates(new Error('OpenAI Realtime session closed during setup'));
    this.flushContextResults();
    this.transport.close(code, reason);

    if (this.started) {
      const outputText = this.assistantTranscripts.join('\n\n');
      const status = outcome === 'unexpected'
        ? 'failed'
        : this.agent.isCancelled()
          ? 'cancelled'
          : code === 1000
            ? 'completed'
            : 'failed';
      await this.agent.completeExternalExecution({
        status,
        outputText,
        usage: this.usage,
        ...(status === 'failed' ? { error: new Error(reason) } : {}),
      });
    }
    this.started = false;
    this.closing = false;
    this.detachTransport();
    this.removeAllListeners();
  }

  private validateAgent(): void {
    if (this.agent.connector.vendor !== Vendor.OpenAI) {
      throw new Error('OpenAIRealtimeAgentSession requires an OpenAI connector');
    }
    const model = getModelInfo(this.agent.model);
    if (model && (!model.features.realtime
      || !model.features.input.audio
      || !model.features.output.audio)) {
      throw new Error(`Model "${this.agent.model}" does not support realtime audio input and output`);
    }
    if (this.agent.getToolDefinitions().length > 0 && model && !model.features.functionCalling) {
      throw new Error(`Model "${this.agent.model}" does not support function calling`);
    }
  }

  private async prepareSession(): Promise<{ session: OpenAIRealtimeSessionConfig; history: InputItem[] }> {
    const prepared = await this.agent.context.prepare();
    const dynamicInstructions = this.extractInstructions(prepared.input);
    this.configuredInstructions = this.options.session?.instructions ?? '';
    const instructions = [dynamicInstructions, this.configuredInstructions]
      .filter((part) => part.trim())
      .join('\n\n');
    const configured = this.options.session ?? {};
    const tools = this.getCurrentTools();
    this.lastToolsSignature = JSON.stringify(tools);
    const configuredInput = configured.audio?.input ?? {};
    const turnDetection = configuredInput.turn_detection;
    const managedTurnDetection = this.contextSync === 'per_turn'
      ? turnDetection === null
        ? null
        : { ...(turnDetection ?? { type: 'server_vad' as const }), create_response: false }
      : turnDetection;
    if (this.contextSync === 'per_turn' && configuredInput.transcription === null) {
      throw new Error('per_turn context synchronization requires input audio transcription');
    }

    return {
      session: {
        ...configured,
        type: 'realtime',
        model: this.agent.model,
        instructions,
        tools,
        tool_choice: configured.tool_choice ?? 'auto',
        parallel_tool_calls: configured.parallel_tool_calls ?? true,
        output_modalities: configured.output_modalities ?? ['audio'],
        audio: {
          ...configured.audio,
          input: {
            ...configuredInput,
            transcription: configuredInput.transcription === undefined
              ? { model: 'gpt-4o-transcribe' }
              : configuredInput.transcription,
            ...(managedTurnDetection === undefined ? {} : { turn_detection: managedTurnDetection }),
          },
          output: {
            voice: 'marin',
            ...configured.audio?.output,
          },
        },
      },
      history: prepared.input.filter(
        (item) => item.type === 'message' && item.role !== MessageRole.DEVELOPER,
      ),
    };
  }

  private mergeTools(
    local: OpenAIRealtimeTool[],
    configured: OpenAIRealtimeTool[],
  ): OpenAIRealtimeTool[] {
    const merged = new Map<string, OpenAIRealtimeTool>();
    for (const tool of [...local, ...configured]) {
      const key = tool.type === 'function' ? `function:${tool.name}` : `mcp:${tool.server_label}`;
      if (merged.has(key)) throw new Error(`Duplicate Realtime tool: ${key}`);
      merged.set(key, tool);
    }
    return [...merged.values()];
  }

  private getCurrentTools(): OpenAIRealtimeTool[] {
    const local = this.agent.getToolDefinitions().map((tool) => ({
      type: 'function' as const,
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters ?? { type: 'object', properties: {} },
    }));
    return this.mergeTools(local, this.options.session?.tools ?? []);
  }

  private extractInstructions(input: readonly InputItem[]): string {
    return input
      .filter((item) => item.type === 'message' && item.role === MessageRole.DEVELOPER)
      .flatMap((item) => item.type === 'message' ? item.content : [])
      .filter((content) => content.type === ContentType.INPUT_TEXT)
      .map((content) => content.type === ContentType.INPUT_TEXT ? content.text : '')
      .join('\n\n');
  }

  private replayContext(history: readonly InputItem[]): number {
    let replayedItems = 0;
    for (const item of history) {
      if (item.type !== 'message') continue;
      const text = item.content
        .filter((content) => content.type === ContentType.INPUT_TEXT || content.type === ContentType.OUTPUT_TEXT)
        .map((content) => 'text' in content ? content.text : '')
        .join('\n');
      if (text) {
        this.send({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: item.role,
            content: [{ type: item.role === MessageRole.ASSISTANT ? 'output_text' : 'input_text', text }],
          },
        });
        replayedItems += 1;
      }
      for (const content of item.content) {
        if (content.type === ContentType.TOOL_USE) {
          this.send({
            type: 'conversation.item.create',
            item: {
              type: 'function_call',
              call_id: content.id,
              name: content.name,
              arguments: content.arguments,
            },
          });
          replayedItems += 1;
        } else if (content.type === ContentType.TOOL_RESULT) {
          this.send({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: content.tool_use_id,
              output: this.serialize(content.error ? { error: content.error } : content.content),
            },
          });
          replayedItems += 1;
        }
      }
    }
    return replayedItems;
  }

  private startLocalToolCall(event: OpenAIRealtimeServerEvent): void {
    const callId = String(event.call_id ?? '');
    const pending = this.pendingToolCalls.get(callId);
    const name = String(event.name ?? pending?.name ?? '');
    const args = String(event.arguments ?? pending?.arguments ?? '');
    this.pendingToolCalls.delete(callId);
    if (!callId || !name) {
      this.emitError(new Error('OpenAI Realtime returned an incomplete function call'));
      return;
    }

    this.recordToolUse(callId, name, args);
    this.waitingForToolContinuation = true;
    this.emit('tool:start', { callId, name });
    let task!: Promise<void>;
    task = this.executeLocalTool(callId, name, args)
      .catch((error) => this.emitError(error))
      .finally(async () => {
        this.activeToolExecutions.delete(task);
        await this.maybeContinueAfterTools();
      });
    this.activeToolExecutions.add(task);
  }

  private async executeLocalTool(callId: string, name: string, args: string): Promise<void> {
    let result: ToolResult;
    try {
      result = await this.agent.executeExternalToolCall({ id: callId, name, arguments: args || '{}' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = {
        tool_use_id: callId,
        tool_name: name,
        content: { error: message },
        error: message,
        state: ToolCallState.FAILED,
      };
    }
    if (this.destroyed) return;
    this.pendingContextResults.push(result);
    this.emit('tool:complete', result);
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: this.serialize(result.error ? { error: result.error } : result.content),
      },
    });
  }

  private async maybeContinueAfterTools(): Promise<void> {
    if (this.destroyed || this.closing) return;
    if (this.responseActive || this.activeToolExecutions.size > 0) return;
    this.flushContextResults();
    if (!this.waitingForToolContinuation) return;
    this.waitingForToolContinuation = false;
    if (this.contextSync === 'per_turn') await this.syncContextAndCreateResponse();
    else this.createResponse();
  }

  private recordToolUse(callId: string, name: string, args: string): void {
    const output: OutputItem[] = [{
      type: 'message',
      role: MessageRole.ASSISTANT,
      content: [{ type: ContentType.TOOL_USE, id: callId, name, arguments: args }],
    }];
    this.agent.context.addAssistantResponse(output);
  }

  private recordProviderTool(item: Record<string, any>): void {
    const callId = String(item.id ?? item.call_id ?? '');
    const name = [item.server_label, item.name].filter(Boolean).join('.') || 'mcp_tool';
    if (!callId) return;
    const metricName = `mcp:${name}`;
    this.usage.native_tool_calls = {
      ...this.usage.native_tool_calls,
      [metricName]: (this.usage.native_tool_calls?.[metricName] ?? 0) + 1,
    };
    this.agent.recordExternalUsage({ native_tool_calls: { [metricName]: 1 } });
    this.recordToolUse(callId, name, this.serialize(item.arguments ?? {}));
    this.pendingContextResults.push({
      tool_use_id: callId,
      tool_name: name,
      content: item.output ?? '',
      ...(item.error ? { error: this.serialize(item.error) } : {}),
      state: item.error ? ToolCallState.FAILED : ToolCallState.COMPLETED,
    });
  }

  private flushContextResults(): void {
    if (this.pendingContextResults.length === 0) return;
    const results = this.pendingContextResults.splice(0);
    this.agent.context.addToolResults(results);
  }

  private recordAssistantTranscript(transcript: string, responseId?: string): void {
    this.flushContextResults();
    const key = responseId ?? this.currentResponseId ?? 'unscoped';
    const recorded = this.recordedTranscriptsByResponse.get(key) ?? new Set<string>();
    if (recorded.has(transcript)) return;
    recorded.add(transcript);
    this.recordedTranscriptsByResponse.set(key, recorded);
    this.assistantTranscripts.push(transcript);
    this.agent.context.addAssistantResponse([{
      type: 'message',
      role: MessageRole.ASSISTANT,
      content: [{ type: ContentType.OUTPUT_TEXT, text: transcript }],
    }]);
    this.emit('transcript:output', transcript);
  }

  private async answerMCPApproval(item: Record<string, any>): Promise<void> {
    const request: OpenAIRealtimeMCPApprovalRequest = {
      id: String(item.id ?? ''),
      serverLabel: item.server_label,
      name: String(item.name ?? ''),
      arguments: String(item.arguments ?? ''),
    };
    let decision: OpenAIRealtimeMCPApprovalDecision = {
      approve: false,
      reason: 'No MCP approval handler is configured',
    };
    if (this.options.approveMCP) {
      try {
        decision = await this.options.approveMCP(request);
      } catch (error) {
        decision = {
          approve: false,
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    }
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'mcp_approval_response',
        approval_request_id: request.id,
        approve: decision.approve,
        ...(!decision.approve && decision.reason ? { reason: decision.reason } : {}),
      },
    });
    this.emit('mcp:approval', request, decision);
  }

  private syncContextAndCreateResponse(response: Record<string, unknown> = {}): Promise<void> {
    const sync = this.syncChain.then(async () => {
      if (this.destroyed) return;
      const prepared = await this.agent.context.prepare();
      if (this.destroyed || !this.transport.isConnected) return;
      const instructions = [this.extractInstructions(prepared.input), this.configuredInstructions]
        .filter((part) => part.trim())
        .join('\n\n');
      const tools = this.getCurrentTools();
      const toolsSignature = JSON.stringify(tools);
      const toolsChanged = toolsSignature !== this.lastToolsSignature;
      await this.updateSessionAcknowledged({
        type: 'realtime',
        instructions,
        ...(toolsChanged ? { tools } : {}),
      });
      if (toolsChanged) this.lastToolsSignature = toolsSignature;
      this.createResponse(response);
    });
    // Keep the serialization tail fulfilled so one transient turn failure does
    // not prevent later turns, while returning the original rejection to the
    // caller so the failed turn is still reported.
    this.syncChain = sync.catch(() => undefined);
    return sync;
  }

  private addUsage(raw: Record<string, any>): void {
    const inputDetails = raw.input_token_details ?? raw.input_tokens_details ?? {};
    const outputDetails = raw.output_token_details ?? raw.output_tokens_details ?? {};
    const inputTokens = Number(raw.input_tokens ?? 0);
    const outputTokens = Number(raw.output_tokens ?? 0);
    const delta: OpenAIRealtimeAgentUsage = {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: Number(raw.total_tokens ?? inputTokens + outputTokens),
      input_audio_tokens: Number(inputDetails.audio_tokens ?? 0),
      output_audio_tokens: Number(outputDetails.audio_tokens ?? 0),
      input_text_tokens: Number(inputDetails.text_tokens ?? 0),
      output_text_tokens: Number(outputDetails.text_tokens ?? 0),
      cached_input_tokens: Number(inputDetails.cached_tokens ?? 0),
      cache_creation_input_tokens: 0,
      output_tokens_details: { reasoning_tokens: Number(outputDetails.reasoning_tokens ?? 0) },
      native_tool_calls: {},
    };
    this.usage.input_tokens += delta.input_tokens;
    this.usage.output_tokens += delta.output_tokens;
    this.usage.total_tokens += delta.total_tokens;
    this.usage.input_audio_tokens += delta.input_audio_tokens;
    this.usage.output_audio_tokens += delta.output_audio_tokens;
    this.usage.input_text_tokens += delta.input_text_tokens;
    this.usage.output_text_tokens += delta.output_text_tokens;
    this.usage.cached_input_tokens = (this.usage.cached_input_tokens ?? 0)
      + (delta.cached_input_tokens ?? 0);
    this.usage.output_tokens_details!.reasoning_tokens +=
      delta.output_tokens_details?.reasoning_tokens ?? 0;
    this.agent.recordExternalUsage(delta);
    this.emit('usage', this.getUsage());
  }

  /** Apply a partial/complete Realtime session update. */
  updateSession(session: OpenAIRealtimeSessionConfig): void {
    if (this.transport.updateSession) this.transport.updateSession(session);
    else this.send({ type: 'session.update', session });
  }

  private updateSessionAcknowledged(
    session: OpenAIRealtimeSessionConfig,
    signal?: AbortSignal,
  ): Promise<void> {
    if (signal?.aborted) {
      return Promise.reject(signal.reason instanceof Error ? signal.reason : new Error('Aborted'));
    }
    const eventId = `oneringai_session_update_${++this.sessionUpdateSequence}`;
    const timeoutMs = this.options.sessionUpdateTimeoutMs ?? DEFAULT_SESSION_UPDATE_TIMEOUT_MS;
    realtimeLogger.debug({
      eventId,
      instructionCharacters: session.instructions?.length ?? 0,
      toolCount: session.tools?.length ?? 0,
    }, 'Sending acknowledged Realtime session update');
    return new Promise<void>((resolve, reject) => {
      const pending: PendingSessionUpdate = {
        eventId,
        resolve: () => {
          this.removePendingSessionUpdate(pending);
          resolve();
        },
        reject: (error) => {
          this.removePendingSessionUpdate(pending);
          reject(error);
        },
        timer: setTimeout(() => {
          pending.reject(new Error('OpenAI Realtime session update was not acknowledged in time'));
        }, Math.max(1, timeoutMs)),
        ...(signal ? { signal } : {}),
      };
      pending.timer.unref?.();
      if (signal) {
        pending.abort = () => pending.reject(
          signal.reason instanceof Error ? signal.reason : new Error('Aborted'),
        );
        signal.addEventListener('abort', pending.abort, { once: true });
      }
      this.pendingSessionUpdates.push(pending);
      try {
        this.send({ type: 'session.update', event_id: eventId, session });
      } catch (error) {
        pending.reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private handleSessionUpdateEvent(event: OpenAIRealtimeServerEvent): void {
    if (event.type === 'session.updated') {
      realtimeLogger.debug({
        pendingUpdates: this.pendingSessionUpdates.length,
      }, 'Realtime session update acknowledged');
      this.pendingSessionUpdates[0]?.resolve();
      return;
    }
    if (event.type !== 'error') return;
    const eventId = String(event.error?.event_id ?? event.event_id ?? '');
    const pending = this.pendingSessionUpdates.find((item) => item.eventId === eventId);
    if (pending) {
      pending.reject(new Error(String(event.error?.message ?? 'OpenAI rejected the session update')));
    }
  }

  private removePendingSessionUpdate(pending: PendingSessionUpdate): void {
    const index = this.pendingSessionUpdates.indexOf(pending);
    if (index >= 0) this.pendingSessionUpdates.splice(index, 1);
    clearTimeout(pending.timer);
    if (pending.signal && pending.abort) {
      pending.signal.removeEventListener('abort', pending.abort);
    }
  }

  private rejectPendingSessionUpdates(error: Error): void {
    for (const pending of [...this.pendingSessionUpdates]) pending.reject(error);
  }

  private async drainActiveTools(): Promise<boolean> {
    const active = [...this.activeToolExecutions];
    if (active.length === 0) return true;
    const timeoutMs = this.options.toolDrainTimeoutMs ?? DEFAULT_TOOL_DRAIN_TIMEOUT_MS;
    if (timeoutMs <= 0) return false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const drained = await Promise.race([
      Promise.allSettled(active).then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
        timer.unref?.();
      }),
    ]);
    if (timer) clearTimeout(timer);
    return drained;
  }

  /** Send an advanced Realtime client event through the configured transport. */
  send(event: OpenAIRealtimeClientEvent): void {
    if (!this.transport.isConnected) throw new Error('OpenAI Realtime transport is not connected');
    this.transport.send(event);
  }

  private serialize(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return JSON.stringify({ error: 'Tool output is not serializable' });
    }
  }

  private emitError(error: unknown): void {
    if (this.destroyed) return;
    this.emit('error', error instanceof Error ? error : new Error(String(error)));
  }

  private detachTransport(): void {
    this.transport.off?.('event', this.onTransportEvent);
    this.transport.off?.('audio', this.onTransportAudio);
    this.transport.off?.('error', this.onTransportError);
    this.transport.off?.('close', this.onTransportClose);
    this.transport.off?.('backpressure', this.onTransportBackpressure);
  }
}
