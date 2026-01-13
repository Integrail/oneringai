/**
 * Anthropic (Claude) text provider
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseTextProvider } from '../base/BaseTextProvider.js';
import { TextGenerateOptions, ModelCapabilities } from '../../../domain/interfaces/ITextProvider.js';
import { LLMResponse } from '../../../domain/entities/Response.js';
import { ProviderCapabilities } from '../../../domain/interfaces/IProvider.js';
import { AnthropicConfig } from '../../../domain/types/ProviderConfig.js';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderContextLengthError,
} from '../../../domain/errors/AIErrors.js';
import { AnthropicConverter } from './AnthropicConverter.js';
import { AnthropicStreamConverter } from './AnthropicStreamConverter.js';
import { StreamEvent } from '../../../domain/entities/StreamEvent.js';

export class AnthropicTextProvider extends BaseTextProvider {
  readonly name = 'anthropic';
  readonly capabilities: ProviderCapabilities = {
    text: true,
    images: true, // Claude 3+ supports vision
    videos: false,
    audio: false,
  };

  private client: Anthropic;
  private converter: AnthropicConverter;
  private streamConverter: AnthropicStreamConverter;

  constructor(config: AnthropicConfig) {
    super(config);
    this.client = new Anthropic({
      apiKey: this.getApiKey(),
      baseURL: this.getBaseURL(),
      maxRetries: this.getMaxRetries(),
    });
    this.converter = new AnthropicConverter();
    this.streamConverter = new AnthropicStreamConverter();
  }

  /**
   * Generate response using Anthropic Messages API
   */
  async generate(options: TextGenerateOptions): Promise<LLMResponse> {
    try {
      // Convert our format → Anthropic Messages API format
      const anthropicRequest = this.converter.convertRequest(options);

      // Call Anthropic API (not stream)
      const anthropicResponse = await this.client.messages.create({
        ...anthropicRequest,
        stream: false,
      });

      // Convert Anthropic response → our format
      return this.converter.convertResponse(anthropicResponse);
    } catch (error: any) {
      this.handleError(error);
      throw error; // TypeScript needs this
    }
  }

  /**
   * Stream response using Anthropic Messages API
   */
  async *streamGenerate(options: TextGenerateOptions): AsyncIterableIterator<StreamEvent> {
    try {
      // Convert our format → Anthropic Messages API format
      const anthropicRequest = this.converter.convertRequest(options);

      // Create stream
      const stream = await this.client.messages.create({
        ...anthropicRequest,
        stream: true,
      });

      // Reset stream converter for reuse
      this.streamConverter.reset();

      // Convert Anthropic events → our StreamEvent format
      yield* this.streamConverter.convertStream(stream, options.model);
    } catch (error: any) {
      this.handleError(error);
      throw error;
    } finally {
      // ALWAYS clear stream converter to prevent memory leaks
      // Use finally block to ensure cleanup even on exception
      this.streamConverter.clear();
    }
  }

  /**
   * Get model capabilities
   */
  getModelCapabilities(model: string): ModelCapabilities {
    // Claude 4.5 and Claude 4 (Sonnet, Opus, Haiku)
    if (model.includes('claude-sonnet-4') || model.includes('claude-opus-4') || model.includes('claude-haiku-4')) {
      return {
        supportsTools: true,
        supportsVision: true,
        supportsJSON: true,
        supportsJSONSchema: false, // Use prompt engineering
        maxTokens: 200000,
        maxOutputTokens: 8192,
      };
    }

    // Claude 3.5 Sonnet
    if (model.includes('claude-3-5-sonnet') || model.includes('claude-3-7-sonnet')) {
      return {
        supportsTools: true,
        supportsVision: true,
        supportsJSON: true,
        supportsJSONSchema: false,
        maxTokens: 200000,
        maxOutputTokens: 8192,
      };
    }

    // Claude 3 Opus
    if (model.includes('claude-3-opus')) {
      return {
        supportsTools: true,
        supportsVision: true,
        supportsJSON: true,
        supportsJSONSchema: false,
        maxTokens: 200000,
        maxOutputTokens: 4096,
      };
    }

    // Claude 3 Sonnet
    if (model.includes('claude-3-sonnet')) {
      return {
        supportsTools: true,
        supportsVision: true,
        supportsJSON: true,
        supportsJSONSchema: false,
        maxTokens: 200000,
        maxOutputTokens: 4096,
      };
    }

    // Claude 3 Haiku
    if (model.includes('claude-3-haiku')) {
      return {
        supportsTools: true,
        supportsVision: true,
        supportsJSON: true,
        supportsJSONSchema: false,
        maxTokens: 200000,
        maxOutputTokens: 4096,
      };
    }


    // Default for unknown models
    return {
      supportsTools: true,
      supportsVision: true,
      supportsJSON: true,
      supportsJSONSchema: false,
      maxTokens: 200000,
      maxOutputTokens: 4096,
    };
  }

  /**
   * Handle Anthropic-specific errors
   */
  private handleError(error: any): never {
    if (error.status === 401) {
      throw new ProviderAuthError('anthropic', 'Invalid API key');
    }

    if (error.status === 429) {
      const retryAfter = error.headers?.['retry-after'];
      throw new ProviderRateLimitError(
        'anthropic',
        retryAfter ? parseInt(retryAfter) * 1000 : undefined
      );
    }

    if (
      error.type === 'invalid_request_error' &&
      (error.message?.includes('prompt is too long') ||
        error.message?.includes('maximum context length'))
    ) {
      throw new ProviderContextLengthError('anthropic', 200000);
    }

    // Re-throw other errors
    throw error;
  }
}
