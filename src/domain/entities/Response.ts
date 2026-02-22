/**
 * LLM Response entity based on OpenAI Responses API format
 */

import { OutputItem } from './Message.js';

// Re-export OutputItem for convenience
export type { OutputItem } from './Message.js';

/**
 * Token usage statistics
 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  output_tokens_details?: {
    reasoning_tokens: number;
  };
}

export interface LLMResponse {
  id: string;
  object: 'response';
  created_at: number;
  status: 'completed' | 'failed' | 'in_progress' | 'cancelled' | 'queued' | 'incomplete';
  model: string;
  output: OutputItem[];
  output_text?: string; // Aggregated text output (SDK convenience)
  thinking?: string;   // Aggregated thinking/reasoning text (convenience, parallel to output_text)
  usage: TokenUsage;
  error?: {
    type: string;
    message: string;
  };
  metadata?: Record<string, string>;
}

export type AgentResponse = LLMResponse;
