/**
 * Anthropic converter - Converts between our Responses API format and Anthropic Messages API
 */

import Anthropic from '@anthropic-ai/sdk';
import { TextGenerateOptions } from '../../../domain/interfaces/ITextProvider.js';
import { LLMResponse } from '../../../domain/entities/Response.js';
import { InputItem, MessageRole, OutputItem } from '../../../domain/entities/Message.js';
import { Content, ContentType } from '../../../domain/entities/Content.js';
import { Tool, FunctionToolDefinition } from '../../../domain/entities/Tool.js';
import { InvalidToolArgumentsError } from '../../../domain/errors/AIErrors.js';

export class AnthropicConverter {
  /**
   * Convert our format → Anthropic Messages API format
   */
  convertRequest(options: TextGenerateOptions): Anthropic.MessageCreateParams {
    const messages = this.convertMessages(options.input);
    const tools = this.convertTools(options.tools);

    const params: Anthropic.MessageCreateParams = {
      model: options.model,
      max_tokens: options.max_output_tokens || 4096,
      messages,
    };

    // Add system instruction if provided
    if (options.instructions) {
      params.system = options.instructions;
    }

    // Add tools if provided
    if (tools && tools.length > 0) {
      params.tools = tools;
    }

    // Add temperature if provided
    if (options.temperature !== undefined) {
      params.temperature = options.temperature;
    }

    return params;
  }

  /**
   * Convert our InputItem[] → Anthropic messages
   */
  private convertMessages(input: string | InputItem[]): Anthropic.MessageParam[] {
    if (typeof input === 'string') {
      return [{ role: 'user', content: input }];
    }

    const messages: Anthropic.MessageParam[] = [];

    for (const item of input) {
      if (item.type === 'message') {
        // Map roles: 'developer' → 'user' (Anthropic doesn't have developer role)
        const role = item.role === MessageRole.DEVELOPER ? 'user' : item.role;

        // Convert content
        const content = this.convertContent(item.content);

        messages.push({
          role: role as 'user' | 'assistant',
          content,
        });
      }
    }

    return messages;
  }

  /**
   * Convert our Content[] → Anthropic content blocks
   */
  private convertContent(content: Content[]): Anthropic.MessageParam['content'] {
    const blocks: any[] = [];

    for (const c of content) {
      switch (c.type) {
        case ContentType.INPUT_TEXT:
        case ContentType.OUTPUT_TEXT:
          blocks.push({
            type: 'text',
            text: c.text,
          });
          break;

        case ContentType.INPUT_IMAGE_URL:
          // Anthropic supports image URLs in Claude 3.5+
          // Try URL first, will fall back to base64 if needed
          if (c.image_url.url.startsWith('data:')) {
            // Parse data URI
            const matches = c.image_url.url.match(/^data:image\/(\w+);base64,(.+)$/);
            if (matches) {
              const mediaType = `image/${matches[1]}` as Anthropic.ImageBlockParam['source']['media_type'];
              const data = matches[2];
              blocks.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data,
                },
              });
            }
          } else {
            // Use URL (Claude 3.5+ supports this)
            blocks.push({
              type: 'image',
              source: {
                type: 'url',
                url: c.image_url.url,
              },
            });
          }
          break;

        case ContentType.TOOL_RESULT:
          blocks.push({
            type: 'tool_result',
            tool_use_id: c.tool_use_id,
            content: typeof c.content === 'string' ? c.content : JSON.stringify(c.content),
            is_error: !!c.error,
          });
          break;

        case ContentType.TOOL_USE:
          // This appears in assistant messages
          // Safe JSON parse with error handling
          let parsedInput: unknown;
          try {
            parsedInput = JSON.parse(c.arguments);
          } catch (parseError) {
            throw new InvalidToolArgumentsError(
              c.name,
              c.arguments,
              parseError instanceof Error ? parseError : new Error(String(parseError))
            );
          }
          blocks.push({
            type: 'tool_use',
            id: c.id,
            name: c.name,
            input: parsedInput,
          });
          break;
      }
    }

    // If only one text block, return as string
    if (blocks.length === 1 && blocks[0]?.type === 'text') {
      return (blocks[0] as Anthropic.TextBlock).text;
    }

    return blocks;
  }

  /**
   * Convert our Tool[] → Anthropic tools
   */
  private convertTools(tools?: Tool[]): Anthropic.Tool[] | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    return tools
      .filter((t): t is FunctionToolDefinition => t.type === 'function')
      .map((tool) => ({
        name: tool.function.name,
        description: tool.function.description || '',
        input_schema: {
          type: 'object',
          ...tool.function.parameters,
        } as any,
      }));
  }

  /**
   * Convert Anthropic response → our LLMResponse format
   */
  convertResponse(response: Anthropic.Message): LLMResponse {
    const output: OutputItem[] = [
      {
        type: 'message',
        id: response.id,
        role: MessageRole.ASSISTANT,
        content: this.convertAnthropicContent(response.content),
      },
    ];

    return {
      id: `resp_anthropic_${response.id}`,
      object: 'response',
      created_at: Math.floor(Date.now() / 1000),
      status: this.mapStopReason(response.stop_reason),
      model: response.model,
      output,
      output_text: this.extractOutputText(response.content),
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  /**
   * Convert Anthropic content blocks → our Content[]
   */
  private convertAnthropicContent(
    blocks: Array<Anthropic.ContentBlock>
  ): Content[] {
    const content: Content[] = [];

    for (const block of blocks) {
      if (block.type === 'text') {
        content.push({
          type: ContentType.OUTPUT_TEXT,
          text: block.text,
          annotations: [],
        });
      } else if (block.type === 'tool_use') {
        content.push({
          type: ContentType.TOOL_USE,
          id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input), // Convert object to JSON string
        });
      }
    }

    return content;
  }

  /**
   * Extract output text from Anthropic content blocks
   */
  private extractOutputText(blocks: Array<Anthropic.ContentBlock>): string {
    const textBlocks = blocks.filter(
      (b): b is Anthropic.TextBlock => b.type === 'text'
    );
    return textBlocks.map((b) => b.text).join('\n');
  }

  /**
   * Map Anthropic stop_reason → our status
   */
  private mapStopReason(
    stopReason: string | null
  ): 'completed' | 'incomplete' | 'failed' {
    switch (stopReason) {
      case 'end_turn':
        return 'completed';
      case 'tool_use':
        return 'completed'; // Tool use is normal completion
      case 'max_tokens':
        return 'incomplete';
      case 'stop_sequence':
        return 'completed';
      default:
        return 'incomplete';
    }
  }
}
