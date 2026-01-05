/**
 * Text generation manager - simple text generation without tools
 */

import { ProviderRegistry } from '../../client/ProviderRegistry.js';
import { InputItem } from '../../domain/entities/Message.js';
import { LLMResponse } from '../../domain/entities/Response.js';
import { TextGenerateOptions } from '../../domain/interfaces/ITextProvider.js';

export interface SimpleTextOptions {
  provider: string;
  model: string;
  instructions?: string;
  temperature?: number;
  max_output_tokens?: number;
  response_format?: {
    type: 'text' | 'json_object' | 'json_schema';
    json_schema?: any;
  };
}

export class TextManager {
  constructor(private registry: ProviderRegistry) {}

  /**
   * Generate text response
   */
  async generate(
    input: string | InputItem[],
    options: SimpleTextOptions
  ): Promise<string> {
    const provider = this.registry.getTextProvider(options.provider);

    const generateOptions: TextGenerateOptions = {
      model: options.model,
      input,
      instructions: options.instructions,
      temperature: options.temperature,
      max_output_tokens: options.max_output_tokens,
      response_format: options.response_format,
    };

    const response = await provider.generate(generateOptions);
    return this.extractTextFromResponse(response);
  }

  /**
   * Generate structured JSON output
   */
  async generateJSON<T = any>(
    input: string | InputItem[],
    options: SimpleTextOptions & { schema: any }
  ): Promise<T> {
    const provider = this.registry.getTextProvider(options.provider);

    const generateOptions: TextGenerateOptions = {
      model: options.model,
      input,
      instructions: options.instructions,
      temperature: options.temperature,
      response_format: {
        type: 'json_schema',
        json_schema: options.schema,
      },
    };

    const response = await provider.generate(generateOptions);
    const text = this.extractTextFromResponse(response);
    return JSON.parse(text) as T;
  }

  /**
   * Get full response object (not just text)
   */
  async generateRaw(
    input: string | InputItem[],
    options: SimpleTextOptions
  ): Promise<LLMResponse> {
    const provider = this.registry.getTextProvider(options.provider);

    const generateOptions: TextGenerateOptions = {
      model: options.model,
      input,
      instructions: options.instructions,
      temperature: options.temperature,
      max_output_tokens: options.max_output_tokens,
      response_format: options.response_format,
    };

    return provider.generate(generateOptions);
  }

  /**
   * Extract text from response
   */
  private extractTextFromResponse(response: LLMResponse): string {
    if (response.output_text) {
      return response.output_text;
    }

    // Extract from output items
    for (const item of response.output) {
      if (item.type === 'message' && item.role === 'assistant') {
        for (const content of item.content) {
          if (content.type === 'output_text') {
            return content.text;
          }
        }
      }
    }

    return '';
  }
}
