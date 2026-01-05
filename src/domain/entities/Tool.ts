/**
 * Tool entities with blocking/non-blocking execution support
 */

export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  [key: string]: any;
}

export interface FunctionToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: JSONSchema;
    strict?: boolean; // Enforce schema strictly
  };
  blocking?: boolean; // Default: true (wait for result before continuing)
  timeout?: number; // Timeout in ms (default: 30000)
}

export interface BuiltInTool {
  type: 'web_search' | 'file_search' | 'computer_use' | 'code_interpreter';
  blocking?: boolean;
}

export type Tool = FunctionToolDefinition | BuiltInTool;

export enum ToolCallState {
  PENDING = 'pending', // Tool call identified, not yet executed
  EXECUTING = 'executing', // Currently executing
  COMPLETED = 'completed', // Successfully completed
  FAILED = 'failed', // Execution failed
  TIMEOUT = 'timeout', // Execution timed out
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
  blocking: boolean; // Copied from tool definition
  state: ToolCallState;
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

export interface ToolResult {
  tool_use_id: string;
  content: any;
  error?: string;
  executionTime?: number; // ms
  state: ToolCallState;
}

/**
 * Tool execution context - tracks all tool calls in a generation
 */
export interface ToolExecutionContext {
  executionId: string; // Unique ID for this LLM generation
  toolCalls: Map<string, ToolCall>; // tool_use_id → ToolCall
  pendingNonBlocking: Set<string>; // IDs of pending non-blocking calls
  completedResults: Map<string, ToolResult>; // tool_use_id → ToolResult
}

/**
 * User-provided tool function
 */
export interface ToolFunction<TArgs = any, TResult = any> {
  definition: FunctionToolDefinition;
  execute: (args: TArgs) => Promise<TResult>;
}
