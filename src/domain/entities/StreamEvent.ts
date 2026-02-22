/**
 * Streaming event types for real-time LLM responses
 * Based on OpenAI Responses API event format as the internal standard
 */

import { TokenUsage } from './Response.js';

/**
 * Stream event type enum
 */
export enum StreamEventType {
  RESPONSE_CREATED = 'response.created',
  RESPONSE_IN_PROGRESS = 'response.in_progress',
  OUTPUT_TEXT_DELTA = 'response.output_text.delta',
  OUTPUT_TEXT_DONE = 'response.output_text.done',
  TOOL_CALL_START = 'response.tool_call.start',
  TOOL_CALL_ARGUMENTS_DELTA = 'response.tool_call_arguments.delta',
  TOOL_CALL_ARGUMENTS_DONE = 'response.tool_call_arguments.done',
  TOOL_EXECUTION_START = 'response.tool_execution.start',
  TOOL_EXECUTION_DONE = 'response.tool_execution.done',
  ITERATION_COMPLETE = 'response.iteration.complete',
  REASONING_DELTA = 'response.reasoning.delta',
  REASONING_DONE = 'response.reasoning.done',
  RESPONSE_COMPLETE = 'response.complete',
  ERROR = 'response.error',
}

/**
 * Base interface for all stream events
 */
interface BaseStreamEvent {
  type: StreamEventType;
  response_id: string;
}

/**
 * Response created - first event in stream
 */
export interface ResponseCreatedEvent extends BaseStreamEvent {
  type: StreamEventType.RESPONSE_CREATED;
  model: string;
  created_at: number;
}

/**
 * Response in progress
 */
export interface ResponseInProgressEvent extends BaseStreamEvent {
  type: StreamEventType.RESPONSE_IN_PROGRESS;
}

/**
 * Text delta - incremental text output
 */
export interface OutputTextDeltaEvent extends BaseStreamEvent {
  type: StreamEventType.OUTPUT_TEXT_DELTA;
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string;
  sequence_number: number;
}

/**
 * Text output complete for this item
 */
export interface OutputTextDoneEvent extends BaseStreamEvent {
  type: StreamEventType.OUTPUT_TEXT_DONE;
  item_id: string;
  output_index: number;
  text: string; // Complete accumulated text
}

/**
 * Tool call detected and starting
 */
export interface ToolCallStartEvent extends BaseStreamEvent {
  type: StreamEventType.TOOL_CALL_START;
  item_id: string;
  tool_call_id: string;
  tool_name: string;
}

/**
 * Tool call arguments delta - incremental JSON
 */
export interface ToolCallArgumentsDeltaEvent extends BaseStreamEvent {
  type: StreamEventType.TOOL_CALL_ARGUMENTS_DELTA;
  item_id: string;
  tool_call_id: string;
  tool_name: string;
  delta: string; // JSON chunk
  sequence_number: number;
}

/**
 * Tool call arguments complete
 */
export interface ToolCallArgumentsDoneEvent extends BaseStreamEvent {
  type: StreamEventType.TOOL_CALL_ARGUMENTS_DONE;
  tool_call_id: string;
  tool_name: string;
  arguments: string; // Complete JSON string
  incomplete?: boolean; // True if truncated by max_tokens
}

/**
 * Tool execution starting
 */
export interface ToolExecutionStartEvent extends BaseStreamEvent {
  type: StreamEventType.TOOL_EXECUTION_START;
  tool_call_id: string;
  tool_name: string;
  arguments: any; // Parsed arguments
}

/**
 * Tool execution complete
 */
export interface ToolExecutionDoneEvent extends BaseStreamEvent {
  type: StreamEventType.TOOL_EXECUTION_DONE;
  tool_call_id: string;
  tool_name: string;
  result: any;
  execution_time_ms: number;
  error?: string; // If tool failed
}

/**
 * Iteration complete - end of agentic loop iteration
 */
export interface IterationCompleteEvent extends BaseStreamEvent {
  type: StreamEventType.ITERATION_COMPLETE;
  iteration: number;
  tool_calls_count: number;
  has_more_iterations: boolean;
}

/**
 * Response complete - final event
 */
export interface ResponseCompleteEvent extends BaseStreamEvent {
  type: StreamEventType.RESPONSE_COMPLETE;
  status: 'completed' | 'incomplete' | 'failed';
  usage: TokenUsage;
  iterations: number;
  duration_ms?: number;
}

/**
 * Reasoning/thinking delta - incremental reasoning output
 */
export interface ReasoningDeltaEvent extends BaseStreamEvent {
  type: StreamEventType.REASONING_DELTA;
  item_id: string;
  delta: string;
  sequence_number: number;
}

/**
 * Reasoning/thinking complete for this item
 */
export interface ReasoningDoneEvent extends BaseStreamEvent {
  type: StreamEventType.REASONING_DONE;
  item_id: string;
  thinking: string; // Complete accumulated thinking
}

/**
 * Error event
 */
export interface ErrorEvent extends BaseStreamEvent {
  type: StreamEventType.ERROR;
  error: {
    type: string;
    message: string;
    code?: string;
  };
  recoverable: boolean;
}

/**
 * Union type of all stream events
 * Discriminated by 'type' field for type narrowing
 */
export type StreamEvent =
  | ResponseCreatedEvent
  | ResponseInProgressEvent
  | OutputTextDeltaEvent
  | OutputTextDoneEvent
  | ReasoningDeltaEvent
  | ReasoningDoneEvent
  | ToolCallStartEvent
  | ToolCallArgumentsDeltaEvent
  | ToolCallArgumentsDoneEvent
  | ToolExecutionStartEvent
  | ToolExecutionDoneEvent
  | IterationCompleteEvent
  | ResponseCompleteEvent
  | ErrorEvent;

/**
 * Type guard to check if event is a specific type
 */
export function isStreamEvent<T extends StreamEvent>(
  event: StreamEvent,
  type: StreamEventType
): event is T {
  return event.type === type;
}

/**
 * Type guards for specific events
 */
export function isOutputTextDelta(event: StreamEvent): event is OutputTextDeltaEvent {
  return event.type === StreamEventType.OUTPUT_TEXT_DELTA;
}

export function isToolCallStart(event: StreamEvent): event is ToolCallStartEvent {
  return event.type === StreamEventType.TOOL_CALL_START;
}

export function isToolCallArgumentsDelta(
  event: StreamEvent
): event is ToolCallArgumentsDeltaEvent {
  return event.type === StreamEventType.TOOL_CALL_ARGUMENTS_DELTA;
}

export function isToolCallArgumentsDone(
  event: StreamEvent
): event is ToolCallArgumentsDoneEvent {
  return event.type === StreamEventType.TOOL_CALL_ARGUMENTS_DONE;
}

export function isReasoningDelta(event: StreamEvent): event is ReasoningDeltaEvent {
  return event.type === StreamEventType.REASONING_DELTA;
}

export function isReasoningDone(event: StreamEvent): event is ReasoningDoneEvent {
  return event.type === StreamEventType.REASONING_DONE;
}

export function isResponseComplete(event: StreamEvent): event is ResponseCompleteEvent {
  return event.type === StreamEventType.RESPONSE_COMPLETE;
}

export function isErrorEvent(event: StreamEvent): event is ErrorEvent {
  return event.type === StreamEventType.ERROR;
}
