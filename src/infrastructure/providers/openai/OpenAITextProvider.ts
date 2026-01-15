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
import { StreamEvent, StreamEventType } from '../../../domain/entities/StreamEvent.js';

export class OpenAITextProvider extends BaseTextProvider {
  readonly name: string = 'openai';
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
        messages: this.convertInput(options.input, options.instructions),
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
   * Stream response using OpenAI Streaming API
   */
  async *streamGenerate(options: TextGenerateOptions): AsyncIterableIterator<StreamEvent> {
    try {
      const stream = await this.client.chat.completions.create({
        model: options.model,
        messages: this.convertInput(options.input, options.instructions),
        tools: options.tools as any,
        tool_choice: options.tool_choice as any,
        temperature: options.temperature,
        max_tokens: options.max_output_tokens,
        response_format: options.response_format as any,
        stream: true,
        stream_options: { include_usage: true },
      });

      let responseId = '';
      let sequenceNumber = 0;
      let hasUsage = false;
      const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();

      for await (const chunk of stream) {
        // Debug: Check what's in the chunk
        if (process.env.DEBUG_OPENAI && chunk.usage) {
          console.error('[DEBUG] OpenAI chunk has usage:', chunk.usage);
        }

        // Initialize response ID on first chunk
        if (!responseId) {
          responseId = chunk.id;
          yield {
            type: StreamEventType.RESPONSE_CREATED,
            response_id: responseId,
            model: chunk.model,
            created_at: chunk.created,
          };
        }

        // Handle usage info FIRST (sent at the end when stream_options.include_usage is true)
        // This chunk might not have a choice, so check usage before validating choice
        if (chunk.usage) {
          hasUsage = true;

          if (process.env.DEBUG_OPENAI) {
            console.error('[DEBUG] Emitting RESPONSE_COMPLETE with usage:', {
              prompt_tokens: chunk.usage.prompt_tokens,
              completion_tokens: chunk.usage.completion_tokens,
              total_tokens: chunk.usage.total_tokens,
            });
          }

          yield {
            type: StreamEventType.RESPONSE_COMPLETE,
            response_id: responseId,
            status: 'completed',
            usage: {
              input_tokens: chunk.usage.prompt_tokens || 0,
              output_tokens: chunk.usage.completion_tokens || 0,
              total_tokens: chunk.usage.total_tokens || 0,
            },
            iterations: 1,
          };
        }

        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;

        // Handle text content deltas
        if (delta.content) {
          yield {
            type: StreamEventType.OUTPUT_TEXT_DELTA,
            response_id: responseId,
            item_id: `msg_${responseId}`,
            output_index: 0,
            content_index: 0,
            delta: delta.content,
            sequence_number: sequenceNumber++,
          };
        }

        // Handle tool calls
        if (delta.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            const index = toolCall.index;

            if (!toolCallBuffers.has(index)) {
              // Start new tool call
              const toolCallId = toolCall.id || `call_${responseId}_${index}`;
              const toolName = toolCall.function?.name || '';

              toolCallBuffers.set(index, {
                id: toolCallId,
                name: toolName,
                args: '',
              });

              yield {
                type: StreamEventType.TOOL_CALL_START,
                response_id: responseId,
                item_id: `msg_${responseId}`,
                tool_call_id: toolCallId,
                tool_name: toolName,
              };
            }

            // Accumulate tool arguments
            if (toolCall.function?.arguments) {
              const buffer = toolCallBuffers.get(index)!;
              buffer.args += toolCall.function.arguments;

              yield {
                type: StreamEventType.TOOL_CALL_ARGUMENTS_DELTA,
                response_id: responseId,
                item_id: `msg_${responseId}`,
                tool_call_id: buffer.id,
                tool_name: buffer.name,
                delta: toolCall.function.arguments,
                sequence_number: sequenceNumber++,
              };
            }
          }
        }

        // Check if tool calls are complete (finish_reason indicates end)
        if (choice.finish_reason && toolCallBuffers.size > 0) {
          for (const buffer of toolCallBuffers.values()) {
            yield {
              type: StreamEventType.TOOL_CALL_ARGUMENTS_DONE,
              response_id: responseId,
              tool_call_id: buffer.id,
              tool_name: buffer.name,
              arguments: buffer.args,
            };
          }
        }
      }

      // If no usage info was sent, emit completion event with zero usage
      if (responseId && !hasUsage) {
        yield {
          type: StreamEventType.RESPONSE_COMPLETE,
          response_id: responseId,
          status: 'completed',
          usage: {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
          },
          iterations: 1,
        };
      }
    } catch (error: any) {
      this.handleError(error);
      throw error;
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
   * @param input - Input messages
   * @param instructions - Optional system instructions (prepended as DEVELOPER message for OpenAI)
   */
  private convertInput(input: string | any[], instructions?: string): any[] {
    const messages: any[] = [];

    if (typeof input === 'string') {
      // Add instructions first as DEVELOPER role (OpenAI's system message)
      if (instructions) {
        messages.push({ role: 'developer', content: instructions });
      }
      messages.push({ role: 'user', content: input });
      return messages;
    }

    // For InputItem[], check if there's already a developer message
    const hasDeveloperMessage = Array.isArray(input) && input.some(
      item => item.type === 'message' && item.role === 'developer'
    );

    // Add instructions as DEVELOPER message if provided and no existing developer message
    if (instructions && !hasDeveloperMessage) {
      messages.push({
        role: 'developer',
        content: instructions,
      });
    }

    // Convert InputItem[] to OpenAI messages format
    for (const item of input) {
      if (item.type === 'message') {
        const message: any = {
          role: item.role, // Keep role as-is (developer, user, assistant)
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
