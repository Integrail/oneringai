/**
 * OpenAI text provider using Responses API
 */

import OpenAI from 'openai';
import { BaseTextProvider } from '../base/BaseTextProvider.js';
import { TextGenerateOptions, ModelCapabilities } from '../../../domain/interfaces/ITextProvider.js';
import { LLMResponse } from '../../../domain/entities/Response.js';
import { MessageRole } from '../../../domain/entities/Message.js';
import { ProviderCapabilities } from '../../../domain/interfaces/IProvider.js';
import { OpenAIConfig } from '../../../domain/types/ProviderConfig.js';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderContextLengthError,
} from '../../../domain/errors/AIErrors.js';

export class OpenAITextProvider extends BaseTextProvider {
  readonly name = 'openai';
  readonly capabilities: ProviderCapabilities = {
    text: true,
    images: true,
    videos: false,
    audio: true,
  };

  private client: OpenAI;

  constructor(config: OpenAIConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: this.getApiKey(),
      baseURL: this.getBaseURL(),
      organization: config.organization,
      timeout: this.getTimeout(),
      maxRetries: this.getMaxRetries(),
    });
  }

  /**
   * Generate response using OpenAI Responses API
   */
  async generate(options: TextGenerateOptions): Promise<LLMResponse> {
    try {
      // OpenAI Responses API format matches our internal format!
      const response = await this.client.chat.completions.create({
        model: options.model,
        messages: this.convertInput(options.input),
        tools: options.tools as any,
        tool_choice: options.tool_choice as any,
        temperature: options.temperature,
        max_tokens: options.max_output_tokens,
        response_format: options.response_format as any,
      });

      return this.convertResponse(response);
    } catch (error: any) {
      this.handleError(error);
      throw error; // TypeScript needs this
    }
  }

  /**
   * Get model capabilities
   */
  getModelCapabilities(model: string): ModelCapabilities {
    // GPT-4 models
    if (model.startsWith('gpt-4')) {
      return {
        supportsTools: true,
        supportsVision: model.includes('vision') || !model.includes('0613'),
        supportsJSON: true,
        supportsJSONSchema: true,
        maxTokens: model.includes('turbo') ? 128000 : 8192,
        maxOutputTokens: 16384,
      };
    }

    // GPT-3.5
    if (model.startsWith('gpt-3.5')) {
      return {
        supportsTools: true,
        supportsVision: false,
        supportsJSON: true,
        supportsJSONSchema: false,
        maxTokens: 16385,
        maxOutputTokens: 4096,
      };
    }

    // o-series (reasoning models)
    if (model.startsWith('o1') || model.startsWith('o3')) {
      return {
        supportsTools: false,
        supportsVision: true,
        supportsJSON: false,
        supportsJSONSchema: false,
        maxTokens: 200000,
        maxOutputTokens: 100000,
      };
    }

    // Default
    return {
      supportsTools: false,
      supportsVision: false,
      supportsJSON: false,
      supportsJSONSchema: false,
      maxTokens: 4096,
      maxOutputTokens: 4096,
    };
  }

  /**
   * Convert our input format to OpenAI messages format
   */
  private convertInput(input: string | any[]): any[] {
    if (typeof input === 'string') {
      return [{ role: 'user', content: input }];
    }

    // Convert InputItem[] to OpenAI messages format
    const messages: any[] = [];

    for (const item of input) {
      if (item.type === 'message') {
        const message: any = {
          role: item.role === 'developer' ? 'system' : item.role,
          content: [],
        };

        // Convert content array
        for (const content of item.content) {
          switch (content.type) {
            case 'input_text':
              message.content.push({ type: 'text', text: content.text });
              break;
            case 'input_image_url':
              message.content.push({
                type: 'image_url',
                image_url: content.image_url,
              });
              break;
            case 'output_text':
              message.content.push({ type: 'text', text: content.text });
              break;
            case 'tool_use':
              // OpenAI uses tool_calls at message level, not in content
              if (!message.tool_calls) {
                message.tool_calls = [];
              }
              message.tool_calls.push({
                id: content.id,
                type: 'function',
                function: {
                  name: content.name,
                  arguments: content.arguments,
                },
              });
              // Remove content array if we have tool calls
              if (message.tool_calls.length > 0 && message.content.length === 0) {
                message.content = null;
              }
              break;
            case 'tool_result':
              // Tool results are separate messages in OpenAI
              messages.push({
                role: 'tool',
                tool_call_id: content.tool_use_id,
                content: typeof content.content === 'string' ? content.content : JSON.stringify(content.content),
              });
              continue;
          }
        }

        // Flatten content if it's a single text item
        if (Array.isArray(message.content) && message.content.length === 1 && message.content[0].type === 'text') {
          message.content = message.content[0].text;
        }

        messages.push(message);
      }
    }

    return messages;
  }

  /**
   * Convert OpenAI response to our LLMResponse format
   */
  private convertResponse(response: OpenAI.Chat.Completions.ChatCompletion): LLMResponse {
    const choice = response.choices[0];
    const message = choice?.message;

    // Build content array
    const content: any[] = [];

    if (message?.content) {
      content.push({
        type: 'output_text',
        text: message.content,
        annotations: [],
      });
    }

    // Add tool calls if present
    if (message?.tool_calls) {
      for (const toolCall of message.tool_calls) {
        // Only process function type tool calls
        if (toolCall.type === 'function' && 'function' in toolCall) {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: toolCall.function.arguments,
          });
        }
      }
    }

    return {
      id: response.id,
      object: 'response',
      created_at: response.created,
      status: choice?.finish_reason === 'stop' ? 'completed' : 'incomplete',
      model: response.model,
      output: [
        {
          type: 'message' as const,
          id: response.id,
          role: MessageRole.ASSISTANT,
          content,
        },
      ],
      output_text: message?.content || '',
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Handle OpenAI-specific errors
   */
  private handleError(error: any): never {
    if (error.status === 401) {
      throw new ProviderAuthError('openai', 'Invalid API key');
    }

    if (error.status === 429) {
      const retryAfter = error.headers?.['retry-after'];
      throw new ProviderRateLimitError(
        'openai',
        retryAfter ? parseInt(retryAfter) * 1000 : undefined
      );
    }

    if (error.code === 'context_length_exceeded' || error.status === 413) {
      throw new ProviderContextLengthError('openai', 128000);
    }

    // Re-throw other errors
    throw error;
  }
}
