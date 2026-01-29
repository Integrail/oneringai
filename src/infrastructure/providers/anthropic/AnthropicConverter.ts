/**
 * Anthropic Converter - Converts between our Responses API format and Anthropic Messages API
 *
 * Extends BaseConverter for common patterns:
 * - Input normalization
 * - Tool conversion
 * - Response building
 * - Resource cleanup
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseConverter } from '../base/BaseConverter.js';
import { TextGenerateOptions } from '../../../domain/interfaces/ITextProvider.js';
import { LLMResponse } from '../../../domain/entities/Response.js';
import { InputItem } from '../../../domain/entities/Message.js';
import { Content, ContentType } from '../../../domain/entities/Content.js';
import { Tool } from '../../../domain/entities/Tool.js';
import { convertToolsToStandardFormat, transformForAnthropic, ProviderToolFormat } from '../shared/ToolConversionUtils.js';
import { mapAnthropicStatus, ResponseStatus } from '../shared/ResponseBuilder.js';

export class AnthropicConverter extends BaseConverter<Anthropic.MessageCreateParams, Anthropic.Message> {
  readonly providerName = 'anthropic';

  /**
   * Convert our format -> Anthropic Messages API format
   */
  convertRequest(options: TextGenerateOptions): Anthropic.MessageCreateParams {
    const messages = this.convertMessages(options.input);
    const tools = this.convertAnthropicTools(options.tools);

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
   * Convert Anthropic response -> our LLMResponse format
   */
  convertResponse(response: Anthropic.Message): LLMResponse {
    return this.buildResponse({
      rawId: response.id,
      model: response.model,
      status: this.mapProviderStatus(response.stop_reason),
      content: this.convertProviderContent(response.content),
      messageId: response.id,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    });
  }

  // ==========================================================================
  // BaseConverter Abstract Method Implementations
  // ==========================================================================

  /**
   * Transform standardized tool to Anthropic format
   */
  protected transformTool(tool: ProviderToolFormat): Anthropic.Tool {
    return {
      ...transformForAnthropic(tool),
      input_schema: {
        type: 'object',
        ...tool.parameters,
      } as Anthropic.Tool.InputSchema,
    };
  }

  /**
   * Convert Anthropic content blocks to our Content[]
   */
  protected convertProviderContent(blocks: unknown[]): Content[] {
    const content: Content[] = [];

    for (const block of blocks as Anthropic.ContentBlock[]) {
      if (block.type === 'text') {
        content.push(this.createText(block.text));
      } else if (block.type === 'tool_use') {
        content.push(this.createToolUse(block.id, block.name, block.input as Record<string, unknown>));
      }
    }

    return content;
  }

  /**
   * Map Anthropic stop_reason to ResponseStatus
   */
  protected mapProviderStatus(status: unknown): ResponseStatus {
    return mapAnthropicStatus(status as string | null);
  }

  // ==========================================================================
  // Anthropic-Specific Conversion Methods
  // ==========================================================================

  /**
   * Convert our InputItem[] -> Anthropic messages
   */
  private convertMessages(input: string | InputItem[]): Anthropic.MessageParam[] {
    if (typeof input === 'string') {
      return [{ role: 'user', content: input }];
    }

    const messages: Anthropic.MessageParam[] = [];

    for (const item of input) {
      if (item.type === 'message') {
        // Map roles: 'developer' -> 'user' (Anthropic doesn't have developer role)
        const role = this.mapRole(item.role);

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
   * Convert our Content[] -> Anthropic content blocks
   */
  private convertContent(content: Content[]): Anthropic.MessageParam['content'] {
    const blocks: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam> = [];

    for (const c of content) {
      switch (c.type) {
        case ContentType.INPUT_TEXT:
        case ContentType.OUTPUT_TEXT:
          blocks.push({
            type: 'text',
            text: (c as { text: string }).text,
          });
          break;

        case ContentType.INPUT_IMAGE_URL: {
          const imgContent = c as { image_url: { url: string } };
          const block = this.convertImageToAnthropicBlock(imgContent.image_url.url);
          if (block) {
            blocks.push(block);
          }
          break;
        }

        case ContentType.TOOL_RESULT: {
          const resultContent = c as {
            tool_use_id: string;
            content: string | unknown;
            error?: string;
          };
          blocks.push(this.convertToolResultToAnthropicBlock(resultContent));
          break;
        }

        case ContentType.TOOL_USE: {
          const toolContent = c as { id: string; name: string; arguments: string };
          const parsedInput = this.parseToolArguments(toolContent.name, toolContent.arguments);
          blocks.push({
            type: 'tool_use',
            id: toolContent.id,
            name: toolContent.name,
            input: parsedInput as Record<string, unknown>,
          });
          break;
        }
      }
    }

    // If only one text block, return as string
    if (blocks.length === 1 && blocks[0]?.type === 'text') {
      return (blocks[0] as Anthropic.TextBlockParam).text;
    }

    return blocks;
  }

  /**
   * Convert image URL to Anthropic image block
   */
  private convertImageToAnthropicBlock(url: string): Anthropic.ImageBlockParam | null {
    const parsed = this.parseDataUri(url);

    if (parsed) {
      // Base64 data URI
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: parsed.mediaType as Anthropic.ImageBlockParam['source']['media_type'],
          data: parsed.data,
        },
      };
    } else {
      // URL (Claude 3.5+ supports this)
      // Note: Anthropic SDK types may not include 'url' source type yet
      return {
        type: 'image',
        source: {
          type: 'url',
          url,
        },
      } as unknown as Anthropic.ImageBlockParam;
    }
  }

  /**
   * Convert tool result to Anthropic block
   * Anthropic requires non-empty content when is_error is true
   */
  private convertToolResultToAnthropicBlock(resultContent: {
    tool_use_id: string;
    content: string | unknown;
    error?: string;
  }): Anthropic.ToolResultBlockParam {
    const isError = !!resultContent.error;
    let toolResultContent: string;

    if (typeof resultContent.content === 'string') {
      // For error cases with empty content, use the error message
      toolResultContent = resultContent.content || (isError ? resultContent.error! : '');
    } else {
      toolResultContent = JSON.stringify(resultContent.content);
    }

    // Anthropic API rejects empty content when is_error is true
    if (isError && !toolResultContent) {
      toolResultContent = resultContent.error || 'Tool execution failed';
    }

    return {
      type: 'tool_result',
      tool_use_id: resultContent.tool_use_id,
      content: toolResultContent,
      is_error: isError,
    };
  }

  /**
   * Convert our Tool[] -> Anthropic tools
   * Uses shared conversion utilities (DRY)
   */
  private convertAnthropicTools(tools?: Tool[]): Anthropic.Tool[] | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    const standardTools = convertToolsToStandardFormat(tools);
    return standardTools.map((tool) => this.transformTool(tool));
  }
}
