/**
 * Google Gemini text provider (using new unified SDK)
 */

import { GoogleGenAI } from '@google/genai';
import { BaseTextProvider } from '../base/BaseTextProvider.js';
import { TextGenerateOptions, ModelCapabilities } from '../../../domain/interfaces/ITextProvider.js';
import { LLMResponse } from '../../../domain/entities/Response.js';
import { ProviderCapabilities } from '../../../domain/interfaces/IProvider.js';
import { GoogleConfig } from '../../../domain/types/ProviderConfig.js';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderContextLengthError,
} from '../../../domain/errors/AIErrors.js';
import { GoogleConverter } from './GoogleConverter.js';
import { GoogleStreamConverter } from './GoogleStreamConverter.js';
import { StreamEvent } from '../../../domain/entities/StreamEvent.js';

export class GoogleTextProvider extends BaseTextProvider {
  readonly name = 'google';
  readonly capabilities: ProviderCapabilities = {
    text: true,
    images: true, // Gemini supports vision
    videos: false,
    audio: false,
  };

  private client: GoogleGenAI;
  private converter: GoogleConverter;

  constructor(config: GoogleConfig) {
    super(config);
    // New SDK uses object config
    this.client = new GoogleGenAI({
      apiKey: this.getApiKey(),
    });
    this.converter = new GoogleConverter();
  }

  /**
   * Generate response using Google Gemini API
   */
  async generate(options: TextGenerateOptions): Promise<LLMResponse> {
    try {
      // Convert our format → Google format
      const googleRequest = await this.converter.convertRequest(options);

      // Debug logging
      if (process.env.DEBUG_GOOGLE) {
        console.error('[DEBUG] Google Request:', JSON.stringify({
          model: options.model,
          tools: googleRequest.tools,
          toolConfig: googleRequest.toolConfig,
          contents: googleRequest.contents?.slice(0, 1), // First message only
        }, null, 2));
      }

      // Call Google API using new SDK structure
      // Note: contents goes at top level, tools/generationConfig go in config
      const result = await this.client.models.generateContent({
        model: options.model,
        contents: googleRequest.contents,
        config: {
          systemInstruction: googleRequest.systemInstruction,
          tools: googleRequest.tools,
          toolConfig: googleRequest.toolConfig,
          generationConfig: googleRequest.generationConfig,
        },
      });

      // Debug logging for response
      if (process.env.DEBUG_GOOGLE) {
        console.error('[DEBUG] Google Response:', JSON.stringify({
          candidates: result.candidates?.map((c: any) => ({
            finishReason: c.finishReason,
            content: c.content,
          })),
          usageMetadata: result.usageMetadata,
        }, null, 2));
      }

      // Convert Google response → our format
      return this.converter.convertResponse(result);
    } catch (error: any) {
      this.handleError(error);
      throw error; // TypeScript needs this
    }
  }

  /**
   * Stream response using Google Gemini API
   */
  async *streamGenerate(options: TextGenerateOptions): AsyncIterableIterator<StreamEvent> {
    try {
      // Convert our format → Google format
      const googleRequest = await this.converter.convertRequest(options);

      // Create stream using new SDK
      // Note: contents goes at top level, tools/generationConfig go in config
      const stream = await this.client.models.generateContentStream({
        model: options.model,
        contents: googleRequest.contents,
        config: {
          systemInstruction: googleRequest.systemInstruction,
          tools: googleRequest.tools,
          toolConfig: googleRequest.toolConfig,
          generationConfig: googleRequest.generationConfig,
        },
      });

      // Convert Google stream → our StreamEvent format
      const streamConverter = new GoogleStreamConverter();
      yield* streamConverter.convertStream(stream, options.model);
    } catch (error: any) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Get model capabilities
   */
  getModelCapabilities(model: string): ModelCapabilities {
    // All modern Gemini models (3.x, 2.5, 2.0, 1.5) have similar capabilities
    if (
      model.includes('gemini-3') ||
      model.includes('gemini-2.5') ||
      model.includes('gemini-2.0') ||
      model.includes('gemini-1.5') ||
      model.includes('gemini-pro') ||
      model.includes('gemini-flash')
    ) {
      return {
        supportsTools: true,
        supportsVision: true,
        supportsJSON: true,
        supportsJSONSchema: false,
        maxTokens: 1048576, // 1M tokens
        maxOutputTokens: 8192,
      };
    }

    // Default for unknown models
    return {
      supportsTools: true,
      supportsVision: true,
      supportsJSON: true,
      supportsJSONSchema: false,
      maxTokens: 1048576,
      maxOutputTokens: 8192,
    };
  }

  /**
   * Handle Google-specific errors
   */
  private handleError(error: any): never {
    const errorMessage = error.message || '';

    if (error.status === 401 || errorMessage.includes('API key not valid')) {
      throw new ProviderAuthError('google', 'Invalid API key');
    }

    if (error.status === 429 || errorMessage.includes('Resource exhausted')) {
      throw new ProviderRateLimitError('google');
    }

    if (errorMessage.includes('context length') || errorMessage.includes('too long')) {
      throw new ProviderContextLengthError('google', 1048576);
    }

    // Re-throw other errors
    throw error;
  }
}
