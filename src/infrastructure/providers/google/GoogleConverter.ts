/**
 * Google Gemini converter - Converts between our Responses API format and Google Gemini API
 * Works with both @google/genai SDK (for Gemini API and Vertex AI)
 */

// Import types - the new SDK may have different type names
import { randomUUID } from 'crypto';
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
import { InvalidToolArgumentsError } from '../../../domain/errors/AIErrors.js';

export class GoogleConverter {
  // Track tool call ID → tool name mapping for tool results
  private toolCallMapping: Map<string, string> = new Map();
  // Track tool call ID → thought signature for Gemini 3+
  private thoughtSignatures: Map<string, string> = new Map();

  /**
   * Convert our format → Google Gemini format
   */
  async convertRequest(options: TextGenerateOptions): Promise<any> {
    // Debug input messages
    if (process.env.DEBUG_GOOGLE && Array.isArray(options.input)) {
      console.error('[DEBUG] Input messages:', JSON.stringify(options.input.map((msg: any) => ({
        type: msg.type,
        role: msg.role,
        contentTypes: msg.content?.map((c: any) => c.type),
      })), null, 2));
    }

    const contents = await this.convertMessages(options.input);
    const tools = this.convertTools(options.tools);

    // Debug: Check final contents
    if (process.env.DEBUG_GOOGLE) {
      console.error('[DEBUG] Final contents array length:', contents.length);
    }

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

      // Add tool config to encourage tool use
      request.toolConfig = {
        functionCallingConfig: {
          mode: options.tool_choice === 'required' ? 'ANY' : 'AUTO',
        },
      };
    }

    // Add generation config
    request.generationConfig = {
      temperature: options.temperature,
      maxOutputTokens: options.max_output_tokens,
    };

    // Disable Google's code execution if we have function tools
    // (prevents model from generating code instead of calling tools)
    if (tools && tools.length > 0) {
      request.generationConfig.allowCodeExecution = false;
    }

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

        // Debug logging
        if (process.env.DEBUG_GOOGLE) {
          console.error(`[DEBUG] Converting message - role: ${item.role} → ${role}, parts: ${parts.length}`,
            parts.map((p: any) => Object.keys(p)));
        }

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
          // Store tool call ID → name mapping for later use
          this.toolCallMapping.set(c.id, c.name);

          // Safe JSON parse with error handling
          let parsedArgs: unknown;
          try {
            parsedArgs = JSON.parse(c.arguments);
          } catch (parseError) {
            throw new InvalidToolArgumentsError(
              c.name,
              c.arguments,
              parseError instanceof Error ? parseError : new Error(String(parseError))
            );
          }

          // Google uses functionCall
          const functionCallPart: any = {
            functionCall: {
              name: c.name,
              args: parsedArgs,
            },
          };

          // Add thought signature if we have one (required for Gemini 3+)
          const signature = this.thoughtSignatures.get(c.id);

          if (process.env.DEBUG_GOOGLE) {
            console.error(`[DEBUG] Looking up signature for tool ID: ${c.id}`);
            console.error(`[DEBUG] Found signature:`, signature ? 'YES' : 'NO');
            console.error(`[DEBUG] Available signatures:`, Array.from(this.thoughtSignatures.keys()));
          }

          if (signature) {
            functionCallPart.thoughtSignature = signature;
          }

          parts.push(functionCallPart);
          break;

        case ContentType.TOOL_RESULT:
          // Google uses functionResponse - look up the actual function name
          const functionName = this.toolCallMapping.get(c.tool_use_id) || this.extractToolName(c.tool_use_id);

          parts.push({
            functionResponse: {
              name: functionName, // Use actual function name from mapping
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
        parameters: this.convertParametersSchema(tool.function.parameters),
      }));
  }

  /**
   * Convert JSON Schema parameters to Google's format
   */
  private convertParametersSchema(schema: any): any {
    if (!schema) return undefined;

    const converted: any = {
      type: 'OBJECT', // Google uses uppercase 'OBJECT'
      properties: {},
    };

    // Convert property types to uppercase
    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        const prop = value as any;
        converted.properties[key] = {
          type: prop.type?.toUpperCase() || 'STRING',
          description: prop.description,
        };

        // Handle enums
        if (prop.enum) {
          converted.properties[key].enum = prop.enum;
        }

        // Handle nested objects/arrays
        if (prop.type === 'object' && prop.properties) {
          converted.properties[key] = this.convertParametersSchema(prop);
        }
        if (prop.type === 'array' && prop.items) {
          converted.properties[key].items = this.convertParametersSchema(prop.items);
        }
      }
    }

    // Add required fields
    if (schema.required) {
      converted.required = schema.required;
    }

    return converted;
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
        id: response.id || `google_msg_${randomUUID()}`,
        role: MessageRole.ASSISTANT,
        content,
      },
    ];

    const outputText = this.extractOutputText(geminiContent?.parts || []);

    // Debug output text extraction
    if (process.env.DEBUG_GOOGLE) {
      console.error('[DEBUG] Extracted output_text:', outputText);
      console.error('[DEBUG] Content array:', JSON.stringify(content, null, 2));
      console.error('[DEBUG] Raw parts:', JSON.stringify(geminiContent?.parts, null, 2));
    }

    return {
      id: `resp_google_${randomUUID()}`,
      object: 'response',
      created_at: Math.floor(Date.now() / 1000),
      status: this.mapFinishReason(candidate?.finishReason),
      model: response.modelVersion || 'gemini',
      output,
      output_text: outputText,
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
        const toolId = `google_${randomUUID()}`;
        const functionName = part.functionCall.name || '';

        // Store thought signature if present (required for Gemini 3+)
        if ('thoughtSignature' in part && part.thoughtSignature) {
          const sig = part.thoughtSignature as string;
          this.thoughtSignatures.set(toolId, sig);

          if (process.env.DEBUG_GOOGLE) {
            console.error(`[DEBUG] Captured thought signature for tool ID: ${toolId}`);
            console.error(`[DEBUG] Signature length:`, sig.length);
          }
        } else if (process.env.DEBUG_GOOGLE) {
          console.error(`[DEBUG] NO thought signature in part for ${functionName}`);
          console.error(`[DEBUG] Part keys:`, Object.keys(part));
        }

        content.push({
          type: ContentType.TOOL_USE,
          id: toolId,
          name: functionName,
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
   * Extract tool name from tool_use_id using tracked mapping
   */
  private extractToolName(toolUseId: string): string {
    const name = this.toolCallMapping.get(toolUseId);
    if (name) {
      return name;
    }
    // Fallback - log warning and return placeholder
    console.warn(`[GoogleConverter] Tool name not found for ID: ${toolUseId}`);
    return 'unknown_tool';
  }

  /**
   * Clear all internal mappings
   * Should be called after each request/response cycle to prevent memory leaks
   */
  clearMappings(): void {
    this.toolCallMapping.clear();
    this.thoughtSignatures.clear();
  }

  /**
   * Reset converter state for a new request
   * Alias for clearMappings()
   */
  reset(): void {
    this.clearMappings();
  }
}
