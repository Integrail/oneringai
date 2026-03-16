/**
 * Voice capability types
 *
 * Defines the interfaces for voice calling integration:
 * - VoiceBridge: multi-session manager connecting telephony to agents
 * - VoiceSession: per-call state machine
 * - IVoicePipeline: strategy pattern for audio ↔ agent routing
 * - ITelephonyAdapter: abstraction over Twilio, Vonage, etc.
 */

import type { AgentConfig } from '../../core/Agent.js';

// =============================================================================
// Audio Frame — internal protocol between adapter and pipeline
// =============================================================================

/**
 * Audio encoding formats used in voice pipelines.
 * - pcm_s16le: 16-bit signed little-endian PCM (standard for STT/TTS)
 * - mulaw: μ-law companded 8-bit (Twilio telephony)
 * - alaw: A-law companded 8-bit (European telephony)
 */
export type AudioEncoding = 'pcm_s16le' | 'mulaw' | 'alaw';

/**
 * A single frame of audio data exchanged between adapter and pipeline.
 * All voice processing operates on these frames.
 */
export interface AudioFrame {
  /** Raw audio bytes */
  audio: Buffer;
  /** Sample rate in Hz (e.g., 8000 for Twilio, 16000/24000 for STT/TTS) */
  sampleRate: number;
  /** Encoding format */
  encoding: AudioEncoding;
  /** Always mono */
  channels: 1;
  /** Milliseconds from call start */
  timestamp: number;
}

// =============================================================================
// Voice Activity Detection
// =============================================================================

/** Result of VAD processing a single audio frame */
export type VADEvent = 'speech_start' | 'speech_end' | null;

/**
 * Voice Activity Detector interface.
 * Implementations detect when the caller starts and stops speaking.
 */
export interface IVoiceActivityDetector {
  /** Feed an audio frame, returns speech state change (if any) */
  process(frame: AudioFrame): VADEvent;
  /** Reset internal state (e.g., between utterances) */
  reset(): void;
}

/**
 * Configuration for the default energy-based VAD
 */
export interface EnergyVADConfig {
  /** RMS energy threshold to consider as speech (0-1 scale). Default: 0.01 */
  energyThreshold?: number;
  /** Consecutive speech frames needed to trigger speech_start. Default: 3 */
  speechFramesThreshold?: number;
  /** Silence duration in ms to trigger speech_end. Default: 1500 */
  silenceTimeout?: number;
  /** Minimum speech duration in ms to be considered valid. Default: 250 */
  minSpeechDuration?: number;
}

// =============================================================================
// Call Direction & Session State
// =============================================================================

export type CallDirection = 'inbound' | 'outbound';

export type SessionState =
  | 'idle'        // Created, not yet connected
  | 'ringing'     // Inbound call received, not yet answered
  | 'connected'   // Call active, initial state
  | 'listening'   // Agent waiting for caller to speak
  | 'processing'  // STT complete, agent thinking
  | 'speaking'    // Agent TTS playing to caller
  | 'ending'      // Hangup initiated
  | 'ended';      // Call complete, resources released

// =============================================================================
// Voice Session Info (read-only snapshot exposed to hooks & events)
// =============================================================================

/**
 * Read-only snapshot of a voice session's state.
 * Exposed to lifecycle hooks and event handlers.
 */
export interface VoiceSessionInfo {
  /** Unique session identifier */
  sessionId: string;
  /** Adapter-specific call identifier (e.g., Twilio CallSid) */
  callId: string;
  /** Whether this is an inbound or outbound call */
  direction: CallDirection;
  /** Caller identifier (phone number, SIP URI, etc.) */
  from: string;
  /** Called identifier */
  to: string;
  /** Current session state */
  state: SessionState;
  /** When the call was initiated */
  startedAt: Date;
  /** When the call ended (undefined if still active) */
  endedAt?: Date;
  /** Number of conversation turns completed */
  turns: number;
  /** Adapter-specific metadata (e.g., Twilio AccountSid, geographic info) */
  metadata: Record<string, unknown>;
}

// =============================================================================
// Call Summary (returned on call end)
// =============================================================================

export type CallEndReason = 'caller_hangup' | 'agent_hangup' | 'timeout' | 'error' | 'rejected';

export interface CallSummary {
  /** Call duration in seconds */
  duration: number;
  /** Number of conversation turns */
  turns: number;
  /** Why the call ended */
  endReason: CallEndReason;
  /** Total STT processing time in ms */
  totalSttMs: number;
  /** Total TTS processing time in ms */
  totalTtsMs: number;
  /** Total agent processing time in ms */
  totalAgentMs: number;
  // Future: transcript?: TranscriptEntry[];
  // Future: recordingPath?: string;
}

// =============================================================================
// Lifecycle Hooks
// =============================================================================

/**
 * Lifecycle hooks for voice sessions.
 * All hooks are async and called in order. Errors in hooks are logged
 * but do not terminate the call (except onCallStart returning false).
 */
export interface VoiceHooks {
  /**
   * Called when a new inbound call arrives.
   * Return `false` to reject the call. Return void or true to accept.
   */
  onCallStart?: (session: VoiceSessionInfo) => Promise<boolean | void>;

  /**
   * Called after STT produces text, before sending to agent.
   * Return modified text to alter what the agent sees.
   */
  beforeAgentResponse?: (text: string, session: VoiceSessionInfo) => Promise<string>;

  /**
   * Called after agent produces text, before TTS.
   * Return modified text to alter what the caller hears.
   */
  afterAgentResponse?: (text: string, session: VoiceSessionInfo) => Promise<string>;

  /**
   * Called when the caller interrupts agent speech.
   */
  onInterrupt?: (session: VoiceSessionInfo) => Promise<void>;

  /**
   * Called when any error occurs during the call.
   */
  onError?: (error: Error, session: VoiceSessionInfo) => Promise<void>;

  /**
   * Called when the call ends for any reason.
   */
  onCallEnd?: (session: VoiceSessionInfo, summary: CallSummary) => Promise<void>;
}

// =============================================================================
// Voice Bridge Config
// =============================================================================

/**
 * Text pipeline configuration — STT → Agent → TTS
 */
export interface TextPipelineConfig {
  pipeline: 'text';

  /** STT configuration */
  stt: {
    /** Connector name for the STT provider */
    connector: string;
    /** STT model (e.g., 'whisper-1'). Default: provider's default */
    model?: string;
    /** BCP-47 language hint (e.g., 'en'). Default: auto-detect */
    language?: string;
  };

  /** TTS configuration */
  tts: {
    /** Connector name for the TTS provider */
    connector: string;
    /** TTS model (e.g., 'tts-1', 'tts-1-hd'). Default: 'tts-1' */
    model?: string;
    /** Voice ID (e.g., 'nova', 'alloy'). Default: 'nova' */
    voice?: string;
    /** Speech speed (0.25 to 4.0). Default: 1.0 */
    speed?: number;
  };
}

// v2: export interface RealtimePipelineConfig { pipeline: 'realtime'; ... }

export type PipelineConfig = TextPipelineConfig; // v2: | RealtimePipelineConfig

/**
 * VoiceBridge configuration.
 * The bridge creates a fresh Agent per call from this config.
 */
export interface VoiceBridgeConfig extends PipelineConfig {
  /** Agent configuration — a fresh agent is created per call */
  agent: AgentConfig;

  /** Silence duration (ms) to consider end-of-utterance. Default: 1500 */
  silenceTimeout?: number;

  /** Allow caller to interrupt agent mid-speech. Default: true */
  interruptible?: boolean;

  /** First thing agent says when call connects (bypasses LLM). */
  greeting?: string;

  /** Max concurrent calls. 0 = unlimited. Default: 10 */
  maxConcurrentCalls?: number;

  /** Max call duration in seconds. 0 = unlimited. Default: 3600 */
  maxCallDuration?: number;

  /** VAD configuration (for energy-based detector) */
  vad?: EnergyVADConfig;

  /** Lifecycle hooks */
  hooks?: VoiceHooks;
}

// =============================================================================
// Voice Pipeline Interface (strategy pattern)
// =============================================================================

/**
 * Events emitted by a voice pipeline
 */
export interface VoicePipelineEvents {
  /** Audio ready to send to the caller */
  'audio:out': (frame: AudioFrame) => void;
  /** Session state changed */
  'state:change': (state: SessionState) => void;
  /** Error during processing */
  'error': (error: Error) => void;
}

/**
 * Voice pipeline strategy interface.
 * TextPipeline and RealtimePipeline both implement this.
 */
export interface IVoicePipeline {
  /** Initialize pipeline for a new call session */
  init(sessionInfo: VoiceSessionInfo): Promise<void>;

  /** Process an incoming audio frame from the caller */
  processAudio(frame: AudioFrame): void;

  /** Signal that the caller stopped speaking (silence detected by VAD) */
  onSpeechEnd(): Promise<void>;

  /** Signal that the caller started speaking (interrupt if agent is speaking) */
  onSpeechStart(): void;

  /** Interrupt current agent response (e.g., caller spoke during TTS) */
  interrupt(): void;

  /** Get current pipeline state */
  getState(): SessionState;

  /** Subscribe to pipeline events */
  on<K extends keyof VoicePipelineEvents>(event: K, handler: VoicePipelineEvents[K]): void;
  off<K extends keyof VoicePipelineEvents>(event: K, handler: VoicePipelineEvents[K]): void;

  /** Clean up all resources (agent, TTS, STT) */
  destroy(): Promise<void>;
}

// =============================================================================
// Telephony Adapter Interface
// =============================================================================

/**
 * Metadata for an incoming call from the telephony provider.
 * The adapter maps provider-specific data to this structure.
 */
export interface IncomingCallInfo {
  /** Provider-specific call ID (e.g., Twilio CallSid) */
  callId: string;
  /** Caller identifier (phone number, SIP URI) */
  from: string;
  /** Called identifier */
  to: string;
  /** Adapter-specific metadata */
  metadata: Record<string, unknown>;
}

/**
 * Telephony adapter events
 */
export interface TelephonyAdapterEvents {
  /** A new call has been established and audio is flowing */
  'call:connected': (callId: string, info: IncomingCallInfo) => void;
  /** Audio frame received from caller */
  'call:audio': (callId: string, frame: AudioFrame) => void;
  /** Call has ended */
  'call:ended': (callId: string, reason: string) => void;
  /** Adapter-level error */
  'error': (error: Error, callId?: string) => void;
}

/**
 * Abstraction over telephony providers (Twilio, Vonage, etc.).
 * The adapter handles the provider-specific protocol and exposes
 * a uniform audio frame interface to the VoiceBridge.
 */
export interface ITelephonyAdapter {
  /** Send an audio frame to the caller */
  sendAudio(callId: string, frame: AudioFrame): void;

  /** Clear all buffered outbound audio for a call (barge-in/interrupt) */
  clearAudio?(callId: string): void;

  /** End a specific call */
  hangup(callId: string): Promise<void>;

  /** Get all active call IDs */
  getActiveCalls(): string[];

  /** Subscribe to adapter events */
  on<K extends keyof TelephonyAdapterEvents>(event: K, handler: TelephonyAdapterEvents[K]): void;
  off<K extends keyof TelephonyAdapterEvents>(event: K, handler: TelephonyAdapterEvents[K]): void;

  /** Clean up all connections */
  destroy(): Promise<void>;
}

// =============================================================================
// Twilio-specific types
// =============================================================================

export interface TwilioAdapterConfig {
  /** Twilio connector name (for REST API auth) */
  connector: string;

  /**
   * WebSocket server mode:
   * - 'standalone': adapter creates its own HTTP/WS server
   * - 'external': you provide handlers for your existing server
   */
  mode?: 'standalone' | 'external';

  /** Port for standalone mode. Default: 3000 */
  port?: number;

  /** Path for voice webhook. Default: '/voice' */
  webhookPath?: string;

  /** Path for media stream WebSocket. Default: '/media-stream' */
  mediaStreamPath?: string;

  /**
   * Public URL where Twilio can reach this server.
   * Required for standalone mode. In external mode, you configure this yourself.
   * Example: 'https://myserver.com' or 'https://abc123.ngrok.io'
   */
  publicUrl?: string;
}
