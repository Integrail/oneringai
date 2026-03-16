/**
 * VoiceSession - Per-call state machine
 *
 * Manages the lifecycle of a single voice call:
 * - State transitions (idle → ringing → connected → ... → ended)
 * - Turn counting
 * - Timing metrics
 * - Owns one Agent instance and one IVoicePipeline instance
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { Agent } from '../../core/Agent.js';
import type { AgentConfig } from '../../core/Agent.js';
import { logger } from '../../infrastructure/observability/Logger.js';
import type {
  SessionState,
  CallDirection,
  VoiceSessionInfo,
  CallSummary,
  CallEndReason,
  IVoicePipeline,
  IncomingCallInfo,
} from './types.js';

// =============================================================================
// Session Events
// =============================================================================

export interface VoiceSessionEvents {
  'state:change': (prev: SessionState, next: SessionState, info: VoiceSessionInfo) => void;
  'ended': (summary: CallSummary) => void;
  'error': (error: Error) => void;
}

// =============================================================================
// Valid state transitions
// =============================================================================

const VALID_TRANSITIONS: Record<SessionState, SessionState[]> = {
  idle: ['ringing', 'ended'],
  ringing: ['connected', 'ended'],
  connected: ['listening', 'speaking', 'ending', 'ended'],
  listening: ['processing', 'speaking', 'ending', 'ended'],
  processing: ['speaking', 'listening', 'ending', 'ended'],
  speaking: ['listening', 'processing', 'ending', 'ended'],
  ending: ['ended'],
  ended: [],
};

// =============================================================================
// VoiceSession
// =============================================================================

export class VoiceSession extends EventEmitter {
  readonly sessionId: string;
  readonly direction: CallDirection;
  readonly callId: string;
  readonly from: string;
  readonly to: string;
  readonly startedAt: Date;
  readonly metadata: Record<string, unknown>;

  private _state: SessionState = 'idle';
  private _endedAt?: Date;
  private _turns = 0;
  private _endReason: CallEndReason = 'caller_hangup';

  // Timing metrics
  private _totalSttMs = 0;
  private _totalTtsMs = 0;
  private _totalAgentMs = 0;

  // Owned resources
  private _agent: Agent | null = null;
  private _pipeline: IVoicePipeline | null = null;

  // Call duration timeout
  private _maxDurationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    callInfo: IncomingCallInfo,
    direction: CallDirection = 'inbound',
  ) {
    super();
    this.sessionId = randomUUID();
    this.callId = callInfo.callId;
    this.from = callInfo.from;
    this.to = callInfo.to;
    this.direction = direction;
    this.startedAt = new Date();
    this.metadata = { ...callInfo.metadata };
  }

  // ─── State Machine ───────────────────────────────────────────────

  get state(): SessionState {
    return this._state;
  }

  get turns(): number {
    return this._turns;
  }

  get agent(): Agent | null {
    return this._agent;
  }

  get pipeline(): IVoicePipeline | null {
    return this._pipeline;
  }

  /**
   * Transition to a new state. Throws if the transition is invalid.
   */
  transition(newState: SessionState): void {
    const valid = VALID_TRANSITIONS[this._state];
    if (!valid?.includes(newState)) {
      throw new Error(
        `Invalid voice session state transition: ${this._state} → ${newState}`
      );
    }

    const prev = this._state;
    this._state = newState;

    if (newState === 'ended') {
      this._endedAt = new Date();
    }

    logger.debug({ sessionId: this.sessionId, from: prev, to: newState }, '[VoiceSession] State transition');
    this.emit('state:change', prev, newState, this.getInfo());
  }

  /**
   * Increment the turn counter (called after each agent response completes)
   */
  incrementTurns(): void {
    this._turns++;
  }

  // ─── Timing Metrics ──────────────────────────────────────────────

  addSttTime(ms: number): void {
    this._totalSttMs += ms;
  }

  addTtsTime(ms: number): void {
    this._totalTtsMs += ms;
  }

  addAgentTime(ms: number): void {
    this._totalAgentMs += ms;
  }

  // ─── Resource Management ─────────────────────────────────────────

  /**
   * Create and assign the agent for this call session.
   */
  createAgent(config: AgentConfig): Agent {
    if (this._agent) {
      throw new Error('Agent already created for this session');
    }
    this._agent = Agent.create(config);
    return this._agent;
  }

  /**
   * Assign the voice pipeline for this call session.
   */
  setPipeline(pipeline: IVoicePipeline): void {
    if (this._pipeline) {
      throw new Error('Pipeline already assigned to this session');
    }
    this._pipeline = pipeline;
  }

  /**
   * Set a maximum call duration timer.
   * When it fires, the session transitions to 'ending'.
   */
  setMaxDuration(seconds: number): void {
    if (seconds <= 0) return;

    this._maxDurationTimer = setTimeout(() => {
      if (this._state !== 'ended' && this._state !== 'ending') {
        this._endReason = 'timeout';
        this.transition('ending');
      }
    }, seconds * 1000);
  }

  // ─── Info & Summary ──────────────────────────────────────────────

  /**
   * Get a read-only snapshot of the session state.
   */
  getInfo(): VoiceSessionInfo {
    return {
      sessionId: this.sessionId,
      callId: this.callId,
      direction: this.direction,
      from: this.from,
      to: this.to,
      state: this._state,
      startedAt: this.startedAt,
      endedAt: this._endedAt,
      turns: this._turns,
      metadata: { ...this.metadata },
    };
  }

  /**
   * Set the reason the call ended (before calling end()).
   */
  setEndReason(reason: CallEndReason): void {
    this._endReason = reason;
  }

  /**
   * Get the call summary. Only meaningful after the session has ended.
   */
  getSummary(): CallSummary {
    const endTime = this._endedAt ?? new Date();
    const duration = (endTime.getTime() - this.startedAt.getTime()) / 1000;

    return {
      duration,
      turns: this._turns,
      endReason: this._endReason,
      totalSttMs: this._totalSttMs,
      totalTtsMs: this._totalTtsMs,
      totalAgentMs: this._totalAgentMs,
    };
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  /**
   * End the session and clean up all resources.
   */
  async end(reason?: CallEndReason): Promise<CallSummary> {
    if (reason) {
      this._endReason = reason;
    }

    // Clear max duration timer
    if (this._maxDurationTimer) {
      clearTimeout(this._maxDurationTimer);
      this._maxDurationTimer = null;
    }

    // Transition to ended (via ending if not already)
    if (this._state !== 'ended') {
      if (this._state !== 'ending') {
        this.transition('ending');
      }
      this.transition('ended');
    }

    // Destroy pipeline
    if (this._pipeline) {
      try {
        await this._pipeline.destroy();
      } catch (error) {
        logger.warn({ sessionId: this.sessionId, error }, '[VoiceSession] Pipeline cleanup error');
      }
      this._pipeline = null;
    }

    // Destroy agent
    if (this._agent) {
      try {
        this._agent.destroy();
      } catch (error) {
        logger.warn({ sessionId: this.sessionId, error }, '[VoiceSession] Agent cleanup error');
      }
      this._agent = null;
    }

    const summary = this.getSummary();
    this.emit('ended', summary);
    this.removeAllListeners();

    return summary;
  }
}
