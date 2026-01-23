/**
 * Event types for agentic loop execution
 * These events are emitted asynchronously for notifications (UI updates, logging, etc.)
 */

import { AgenticLoopConfig } from '../AgenticLoop.js';
import { AgentResponse } from '../../../domain/entities/Response.js';
import { TextGenerateOptions } from '../../../domain/interfaces/ITextProvider.js';
import { ToolCall, ToolResult } from '../../../domain/entities/Tool.js';

export interface ExecutionStartEvent {
  executionId: string;
  config: AgenticLoopConfig;
  timestamp: Date;
}

export interface ExecutionCompleteEvent {
  executionId: string;
  response: AgentResponse;
  timestamp: Date;
  duration: number;
}

export interface ExecutionErrorEvent {
  executionId: string;
  error: Error;
  timestamp: Date;
}

export interface ExecutionPausedEvent {
  executionId: string;
  reason?: string;
  timestamp: Date;
}

export interface ExecutionResumedEvent {
  executionId: string;
  timestamp: Date;
}

export interface ExecutionCancelledEvent {
  executionId: string;
  reason?: string;
  timestamp: Date;
}

export interface IterationStartEvent {
  executionId: string;
  iteration: number;
  timestamp: Date;
}

export interface IterationCompleteEvent {
  executionId: string;
  iteration: number;
  response: AgentResponse;
  timestamp: Date;
  duration: number;
}

export interface LLMRequestEvent {
  executionId: string;
  iteration: number;
  options: TextGenerateOptions;
  timestamp: Date;
}

export interface LLMResponseEvent {
  executionId: string;
  iteration: number;
  response: AgentResponse;
  timestamp: Date;
  duration: number;
}

export interface LLMErrorEvent {
  executionId: string;
  iteration: number;
  error: Error;
  timestamp: Date;
}

export interface ToolDetectedEvent {
  executionId: string;
  iteration: number;
  toolCalls: ToolCall[];
  timestamp: Date;
}

export interface ToolStartEvent {
  executionId: string;
  iteration: number;
  toolCall: ToolCall;
  timestamp: Date;
}

export interface ToolCompleteEvent {
  executionId: string;
  iteration: number;
  toolCall: ToolCall;
  result: ToolResult;
  timestamp: Date;
}

export interface ToolErrorEvent {
  executionId: string;
  iteration: number;
  toolCall: ToolCall;
  error: Error;
  timestamp: Date;
}

export interface ToolTimeoutEvent {
  executionId: string;
  iteration: number;
  toolCall: ToolCall;
  timeout: number;
  timestamp: Date;
}

export interface HookErrorEvent {
  executionId: string;
  hookName: string;
  error: Error;
  timestamp: Date;
}

export interface CircuitOpenedEvent {
  executionId: string;
  breakerName: string;
  failureCount: number;
  lastError: string;
  nextRetryTime: number;
  timestamp: Date;
}

export interface CircuitHalfOpenEvent {
  executionId: string;
  breakerName: string;
  timestamp: Date;
}

export interface CircuitClosedEvent {
  executionId: string;
  breakerName: string;
  successCount: number;
  timestamp: Date;
}

/**
 * Map of all event names to their payload types
 */
export interface AgenticLoopEvents {
  'execution:start': ExecutionStartEvent;
  'execution:complete': ExecutionCompleteEvent;
  'execution:error': ExecutionErrorEvent;
  'execution:paused': ExecutionPausedEvent;
  'execution:resumed': ExecutionResumedEvent;
  'execution:cancelled': ExecutionCancelledEvent;

  'iteration:start': IterationStartEvent;
  'iteration:complete': IterationCompleteEvent;

  'llm:request': LLMRequestEvent;
  'llm:response': LLMResponseEvent;
  'llm:error': LLMErrorEvent;

  'tool:detected': ToolDetectedEvent;
  'tool:start': ToolStartEvent;
  'tool:complete': ToolCompleteEvent;
  'tool:error': ToolErrorEvent;
  'tool:timeout': ToolTimeoutEvent;

  'hook:error': HookErrorEvent;

  'circuit:opened': CircuitOpenedEvent;
  'circuit:half-open': CircuitHalfOpenEvent;
  'circuit:closed': CircuitClosedEvent;
}

export type AgenticLoopEventName = keyof AgenticLoopEvents;
