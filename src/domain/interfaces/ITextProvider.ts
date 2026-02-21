/**
 * Text generation provider interface
 */

import { IProvider } from './IProvider.js';
import { LLMResponse } from '../entities/Response.js';
import { InputItem } from '../entities/Message.js';
import { Tool } from '../entities/Tool.js';
import { StreamEvent } from '../entities/StreamEvent.js';

export interface TextGenerateOptions {
  model: string;
  input: string | InputItem[];
  instructions?: string;
  tools?: Tool[];
  tool_choice?: 'auto' | 'required' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_output_tokens?: number;
  response_format?: {
    type: 'text' | 'json_object' | 'json_schema';
    json_schema?: any;
  };
  parallel_tool_calls?: boolean;
  previous_response_id?: string;
  metadata?: Record<string, string>;
  /** Vendor-specific options (e.g., Google's thinkingLevel, OpenAI's reasoning_effort) */
  vendorOptions?: Record<string, any>;
}

export interface ModelCapabilities {
  supportsTools: boolean;
  supportsVision: boolean;
  supportsJSON: boolean;
  supportsJSONSchema: boolean;
  maxTokens: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
}

export interface ITextProvider extends IProvider {
  /**
   * Generate text response
   */
  generate(options: TextGenerateOptions): Promise<LLMResponse>;

  /**
   * Stream text response with real-time events
   * Returns an async iterator of streaming events
   */
  streamGenerate(options: TextGenerateOptions): AsyncIterableIterator<StreamEvent>;

  /**
   * Get model capabilities
   */
  getModelCapabilities(model: string): ModelCapabilities;

  /**
   * List available models from the provider's API
   */
  listModels(): Promise<string[]>;
}
