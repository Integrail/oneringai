/**
 * Google Gemini converter - Converts between our Responses API format and Google Gemini API
 * Works with both @google/genai SDK (for Gemini API and Vertex AI)
 */

// Import types - the new SDK may have different type names
import type {
  Content as GeminiContent,
  Part,
  FunctionDeclaration,
} from '@google/genai';
import { TextGenerateOptions } from '../../../domain/interfaces/ITextProvider.js';
import { LLMResponse } from '../../../domain/entities/Response.js';
import { InputItem, MessageRole, OutputItem } from '../../../domain/entities/Message.js';
import { Content, ContentType } from '../../../domain/entities/Content.js';
import { Tool, FunctionToolDefinition } from '../../../domain/entities/Tool.js';
import { fetchImageAsBase64 } from '../../../utils/imageUtils.js';

export class GoogleConverter {
  /**
   * Convert our format → Google Gemini format
   */
  async convertRequest(options: TextGenerateOptions): Promise<any> {
    const contents = await this.convertMessages(options.input);
    const tools = this.convertTools(options.tools);

    const request: any = {
      contents,
    };

    // Add system instruction if provided
    if (options.instructions) {
      request.systemInstruction = { parts: [{ text: options.instructions }] };
    }

    // Add tools if provided
    if (tools && tools.length > 0) {
      request.tools = [{ functionDeclarations: tools }];
    }

    // Add generation config
    request.generationConfig = {
      temperature: options.temperature,
      maxOutputTokens: options.max_output_tokens,
    };

    // Handle JSON output
    if (options.response_format) {
      if (options.response_format.type === 'json_object') {
        request.generationConfig.responseMimeType = 'application/json';
      } else if (options.response_format.type === 'json_schema') {
        request.generationConfig.responseMimeType = 'application/json';
        // Google doesn't support full JSON schema - would need to add to system instruction
      }
    }

    return request;
  }

  /**
   * Convert our InputItem[] → Google contents
   */
  private async convertMessages(input: string | InputItem[]): Promise<GeminiContent[]> {
    if (typeof input === 'string') {
      return [
        {
          role: 'user',
          parts: [{ text: input }],
        },
      ];
    }

    const contents: GeminiContent[] = [];

    for (const item of input) {
      if (item.type === 'message') {
        // Map roles
        const role = item.role === MessageRole.USER || item.role === MessageRole.DEVELOPER ? 'user' : 'model';

        // Convert content to parts
        const parts = await this.convertContentToParts(item.content);

        if (parts.length > 0) {
          contents.push({
            role,
            parts,
          });
        }
      }
    }

    return contents;
  }

  /**
   * Convert our Content[] → Google parts
   */
  private async convertContentToParts(content: Content[]): Promise<Part[]> {
    const parts: Part[] = [];

    for (const c of content) {
      switch (c.type) {
        case ContentType.INPUT_TEXT:
        case ContentType.OUTPUT_TEXT:
          parts.push({ text: c.text });
          break;

        case ContentType.INPUT_IMAGE_URL:
          // Google requires inline data (base64), not URLs
          try {
            const imageData = await fetchImageAsBase64(c.image_url.url);
            parts.push({
              inlineData: {
                mimeType: imageData.mimeType,
                data: imageData.base64Data,
              },
            });
          } catch (error: any) {
            // If image fetch fails, skip it and add error as text
            console.error(`Failed to fetch image: ${error.message}`);
            parts.push({
              text: `[Error: Could not load image from ${c.image_url.url}]`,
            });
          }
          break;

        case ContentType.TOOL_USE:
          // Google uses functionCall
          parts.push({
            functionCall: {
              name: c.name,
              args: JSON.parse(c.arguments),
            },
          });
          break;

        case ContentType.TOOL_RESULT:
          // Google uses functionResponse
          parts.push({
            functionResponse: {
              name: this.extractToolName(c.tool_use_id), // Google needs the function name
              response: {
                result: typeof c.content === 'string' ? c.content : c.content,
              },
            },
          });
          break;
      }
    }

    return parts;
  }

  /**
   * Convert our Tool[] → Google function declarations
   */
  private convertTools(tools?: Tool[]): FunctionDeclaration[] | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    return tools
      .filter((t): t is FunctionToolDefinition => t.type === 'function')
      .map((tool) => ({
        name: tool.function.name,
        description: tool.function.description || '',
        parameters: {
          type: 'OBJECT' as any,
          ...tool.function.parameters,
        } as any,
      }));
  }

  /**
   * Convert Google response → our LLMResponse format
   */
  convertResponse(response: any): LLMResponse {
    const candidate = response.candidates?.[0];
    const geminiContent = candidate?.content;

    // Convert Google parts to our content
    const content = this.convertGeminiPartsToContent(geminiContent?.parts || []);

    const output: OutputItem[] = [
      {
        type: 'message',
        id: response.id || `google_${Date.now()}`,
        role: MessageRole.ASSISTANT,
        content,
      },
    ];

    return {
      id: `resp_google_${Date.now()}`,
      object: 'response',
      created_at: Math.floor(Date.now() / 1000),
      status: this.mapFinishReason(candidate?.finishReason),
      model: response.modelVersion || 'gemini',
      output,
      output_text: this.extractOutputText(geminiContent?.parts || []),
      usage: {
        input_tokens: response.usageMetadata?.promptTokenCount || 0,
        output_tokens: response.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: response.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  /**
   * Convert Google parts → our Content[]
   */
  private convertGeminiPartsToContent(parts: Part[]): Content[] {
    const content: Content[] = [];

    for (const part of parts) {
      if ('text' in part && part.text) {
        content.push({
          type: ContentType.OUTPUT_TEXT,
          text: part.text,
          annotations: [],
        });
      } else if ('functionCall' in part && part.functionCall) {
        content.push({
          type: ContentType.TOOL_USE,
          id: `google_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args || {}),
        });
      }
    }

    return content;
  }

  /**
   * Extract output text from Google parts
   */
  private extractOutputText(parts: Part[]): string {
    return parts
      .filter((p): p is { text: string } => 'text' in p && typeof p.text === 'string')
      .map((p) => p.text)
      .join('\n');
  }

  /**
   * Map Google finish reason → our status
   */
  private mapFinishReason(finishReason: string | undefined): 'completed' | 'incomplete' | 'failed' {
    switch (finishReason) {
      case 'STOP':
        return 'completed';
      case 'MAX_TOKENS':
        return 'incomplete';
      case 'SAFETY':
      case 'RECITATION':
        return 'failed';
      case 'OTHER':
      default:
        return 'incomplete';
    }
  }

  /**
   * Extract tool name from tool_use_id (hacky but needed for Google)
   * In practice, we'd need to track this mapping
   */
  private extractToolName(_toolUseId: string): string {
    // This is a limitation - Google needs the function name for responses
    // In a real implementation, we'd track tool call ID → name mapping
    // For now, return a placeholder
    return 'tool_result';
  }
}
