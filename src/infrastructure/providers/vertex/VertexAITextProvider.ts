/**
 * Google Vertex AI text provider (enterprise features)
 * Uses the same unified @google/genai SDK as GoogleTextProvider
 */

import { GoogleGenAI } from '@google/genai';
import { BaseTextProvider } from '../base/BaseTextProvider.js';
import { TextGenerateOptions, ModelCapabilities } from '../../../domain/interfaces/ITextProvider.js';
import { LLMResponse } from '../../../domain/entities/Response.js';
import { ProviderCapabilities } from '../../../domain/interfaces/IProvider.js';
import { VertexAIConfig } from '../../../domain/types/ProviderConfig.js';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderContextLengthError,
  InvalidConfigError,
} from '../../../domain/errors/AIErrors.js';
import { GoogleConverter } from '../google/GoogleConverter.js';
import { GoogleStreamConverter } from '../google/GoogleStreamConverter.js';
import { StreamEvent } from '../../../domain/entities/StreamEvent.js';

export class VertexAITextProvider extends BaseTextProvider {
  readonly name = 'vertex-ai';
  readonly capabilities: ProviderCapabilities = {
    text: true,
    images: true,
    videos: true, // Vertex AI supports video input
    audio: true, // Vertex AI supports audio input
  };

  private client: GoogleGenAI;
  private converter: GoogleConverter;
  private config: VertexAIConfig;

  constructor(config: VertexAIConfig) {
    super(config);
    this.config = config;

    // Validate required config
    if (!config.projectId) {
      throw new InvalidConfigError('Vertex AI requires projectId');
    }
    if (!config.location) {
      throw new InvalidConfigError('Vertex AI requires location (e.g., "us-central1")');
    }

    // Configure environment for Vertex AI
    process.env.GOOGLE_GENAI_USE_VERTEXAI = 'True';
    process.env.GOOGLE_CLOUD_PROJECT = config.projectId;
    process.env.GOOGLE_CLOUD_LOCATION = config.location;

    // If credentials provided, set them
    if (config.credentials) {
      // Note: The SDK will use credentials from the environment or ADC
      // Service account JSON can be passed via GOOGLE_APPLICATION_CREDENTIALS env var
    }

    // Initialize client for Vertex AI
    this.client = new GoogleGenAI({
      // No API key for Vertex AI - uses Application Default Credentials
    });

    // Reuse Google converter - same API format!
    this.converter = new GoogleConverter();
  }

  /**
   * Generate response using Vertex AI
   */
  async generate(options: TextGenerateOptions): Promise<LLMResponse> {
    try {
      // Convert our format → Google format (same as regular Gemini API)
      const googleRequest = await this.converter.convertRequest(options);

      // Call Vertex AI using new SDK structure
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

      // Convert response → our format (same as regular Gemini API)
      return this.converter.convertResponse(result);
    } catch (error: any) {
      this.handleError(error);
      throw error; // TypeScript needs this
    }
  }

  /**
   * Stream response using Vertex AI
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
    // Same models as regular Gemini, but enterprise features
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

    // Default
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
   * Handle Vertex AI-specific errors
   */
  private handleError(error: any): never {
    const errorMessage = error.message || '';

    // Authentication errors
    if (
      error.status === 401 ||
      error.status === 403 ||
      errorMessage.includes('not authenticated') ||
      errorMessage.includes('permission denied')
    ) {
      throw new ProviderAuthError(
        'vertex-ai',
        'Authentication failed. Make sure you have set up Application Default Credentials or provided service account credentials.'
      );
    }

    if (error.status === 429 || errorMessage.includes('Resource exhausted')) {
      throw new ProviderRateLimitError('vertex-ai');
    }

    if (errorMessage.includes('context length') || errorMessage.includes('too long')) {
      throw new ProviderContextLengthError('vertex-ai', 1048576);
    }

    // Re-throw other errors
    throw error;
  }
}
