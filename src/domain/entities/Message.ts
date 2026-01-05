/**
 * Message entity based on OpenAI Responses API format
 */

import { Content } from './Content.js';

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
  effort?: 'low' | 'medium' | 'high';
  summary?: string;
  encrypted_content?: string; // For o-series models
}

export type InputItem = Message | CompactionItem;
export type OutputItem = Message | CompactionItem | ReasoningItem;
