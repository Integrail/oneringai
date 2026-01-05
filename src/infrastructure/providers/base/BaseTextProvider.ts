/**
 * Base text provider with common text generation functionality
 */

import { BaseProvider } from './BaseProvider.js';
import { ITextProvider, ModelCapabilities, TextGenerateOptions } from '../../../domain/interfaces/ITextProvider.js';
import { LLMResponse } from '../../../domain/entities/Response.js';

export abstract class BaseTextProvider extends BaseProvider implements ITextProvider {
  abstract generate(options: TextGenerateOptions): Promise<LLMResponse>;
  abstract getModelCapabilities(model: string): ModelCapabilities;

  /**
   * Normalize input to string (helper for providers that don't support complex input)
   */
  protected normalizeInputToString(input: string | any[]): string {
    if (typeof input === 'string') {
      return input;
    }

    // Extract text from InputItem array
    const textParts: string[] = [];
    for (const item of input) {
      if (item.type === 'message') {
        for (const content of item.content) {
          if (content.type === 'input_text') {
            textParts.push(content.text);
          } else if (content.type === 'output_text') {
            textParts.push(content.text);
          }
        }
      }
    }

    return textParts.join('\n');
  }

  /**
   * List available models (optional)
   */
  async listModels?(): Promise<string[]>;
}
