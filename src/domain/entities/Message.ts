/**
 * Message entity based on OpenAI Responses API format
 */

import { Content } from './Content.js';
import type { InputFileContent, InputImageContent, InputTextContent } from './Content.js';
import type { ReasoningEffort } from '../interfaces/ITextProvider.js';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  DEVELOPER = 'developer', // Responses API uses "developer" instead of "system"
}

export interface Message {
  type: 'message';
  id?: string;
  role: MessageRole;
  content: Content[]; // Always an array in Responses API
}

export interface CompactionItem {
  type: 'compaction';
  id: string;
  encrypted_content: string;
}

export interface ReasoningItem {
  type: 'reasoning';
  id: string;
  effort?: ReasoningEffort;
  summary?: string;
  encrypted_content?: string; // For o-series models
}

/** GPT-6 Astra conversation-scoped reasoning-effort update. */
export interface ConfigurationUpdateItem {
  type: 'configuration_update';
  id?: string;
  reasoning: {
    effort: Exclude<ReasoningEffort, 'none' | 'minimal'>;
  };
}

/** Explicit in-band compaction request. Must be the final input item. */
export interface CompactionTriggerItem {
  type: 'compaction_trigger';
}

/** Top-level function result item for Responses continuations. */
export type ToolCallOutputContent = InputTextContent | InputImageContent | InputFileContent;

export interface FunctionCallOutputItem {
  type: 'function_call_output';
  call_id: string;
  output: string | ToolCallOutputContent[];
}

/** Top-level custom-tool result item for Responses continuations. */
export interface CustomToolCallOutputItem {
  type: 'custom_tool_call_output';
  call_id: string;
  output: string | ToolCallOutputContent[];
}

export type InputItem =
  | Message
  | CompactionItem
  | ConfigurationUpdateItem
  | CompactionTriggerItem
  | FunctionCallOutputItem
  | CustomToolCallOutputItem;
export type OutputItem = Message | CompactionItem | ReasoningItem;
