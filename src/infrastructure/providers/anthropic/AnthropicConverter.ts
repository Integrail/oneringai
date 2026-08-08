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
import { transformJSONSchema } from '@anthropic-ai/sdk/lib/transform-json-schema.js';
import { BaseConverter } from '../base/BaseConverter.js';
import { TextGenerateOptions } from '../../../domain/interfaces/ITextProvider.js';
import { LLMResponse } from '../../../domain/entities/Response.js';
import { InputItem } from '../../../domain/entities/Message.js';
import { Content, ContentType } from '../../../domain/entities/Content.js';
import { Tool } from '../../../domain/entities/Tool.js';
import { getModelInfo } from '../../../domain/entities/Model.js';
import { convertToolsToStandardFormat, transformForAnthropic, ProviderToolFormat } from '../shared/ToolConversionUtils.js';
import { mapAnthropicStatus, ResponseStatus } from '../shared/ResponseBuilder.js';
import { validateThinkingConfig } from '../shared/validateThinkingConfig.js';
import { logger } from '../../observability/Logger.js';

/**
 * Last-resort `max_tokens` default when the model isn't in the registry
 * (or its entry lacks `features.output.tokens`) and the caller didn't pass
 * `max_output_tokens`. Sized for current-generation Anthropic output ceilings;
 * falling through to this value triggers a warn log so operators can audit
 * the misconfigured model.
 */
const ANTHROPIC_UNKNOWN_MODEL_MAX_TOKENS = 64_000;
const ANTHROPIC_ADAPTIVE_THINKING_MODELS = [
  /^claude-(?:opus-5|fable-5|mythos-5)(?:-|$)/,
  /^claude-opus-4-[678](?:-|$)/,
  /^claude-sonnet-(?:5|4-6)(?:-|$)/,
] as const;

function usesAdaptiveThinking(model: string): boolean {
  return ANTHROPIC_ADAPTIVE_THINKING_MODELS.some((pattern) => pattern.test(model));
}

export class AnthropicConverter extends BaseConverter<Anthropic.MessageCreateParams, Anthropic.Message> {
  readonly providerName = 'anthropic';

  /**
   * Convert our format -> Anthropic Messages API format
   */
  convertRequest(options: TextGenerateOptions): Anthropic.MessageCreateParams {
    const messages = this.convertMessages(options.input);
    const tools = [
      ...(this.convertAnthropicTools(options.tools) ?? []),
      ...this.convertNativeTools(options),
    ];

    // Anthropic's Messages API REQUIRES `max_tokens`. When the caller didn't
    // set one, use the model's capability max (from the registry) so the
    // model can emit as much as it physically can. Hardcoding a small
    // fallback (previously 4096) silently truncated long responses. Final
    // fallback for unknown models is `ANTHROPIC_UNKNOWN_MODEL_MAX_TOKENS` —
    // and when we reach it, emit a warn so operators notice the missing
    // registry entry (otherwise an Anthropic 400 would be the only signal).
    // See feedback_no_output_limits.md.
    let max_tokens: number;
    if (options.max_output_tokens !== undefined) {
      max_tokens = options.max_output_tokens;
    } else {
      const modelMax = getModelInfo(options.model)?.features?.output?.tokens;
      if (typeof modelMax === 'number') {
        max_tokens = modelMax;
      } else {
        max_tokens = ANTHROPIC_UNKNOWN_MODEL_MAX_TOKENS;
        logger.warn(
          {
            component: 'AnthropicConverter',
            model: options.model,
            fallback: ANTHROPIC_UNKNOWN_MODEL_MAX_TOKENS,
          },
          'Anthropic model not in registry (or missing features.output.tokens); defaulted max_tokens to library fallback. Register the model via Model.create() to suppress.',
        );
      }
    }

    const params: Anthropic.MessageCreateParams = {
      model: options.model,
      max_tokens,
      messages,
    };
    const vendorOptions = options.vendorOptions ?? {};
    const rawParams = params as unknown as Record<string, unknown>;
    const serviceTier = vendorOptions.serviceTier ?? vendorOptions.service_tier;
    if (serviceTier !== undefined) rawParams.service_tier = serviceTier;
    if (vendorOptions.inference_geo !== undefined) {
      rawParams.inference_geo = vendorOptions.inference_geo;
    }
    if (vendorOptions.container !== undefined) rawParams.container = vendorOptions.container;
    // Anthropic's request metadata schema contains only `user_id`. Generic
    // OneRingAI metadata may carry arbitrary host keys, so never forward the
    // full record and let the remote API reject it.
    if (options.metadata?.user_id !== undefined) {
      params.metadata = { user_id: options.metadata.user_id };
    }
    if (vendorOptions.speed !== undefined) {
      rawParams.speed = vendorOptions.speed;
      rawParams.betas = [
        ...new Set([
          ...((rawParams.betas as string[] | undefined) ?? []),
          'fast-mode-2026-02-01',
        ]),
      ];
    }

    // Add system instruction if provided
    if (options.instructions) {
      params.system = options.instructions;
    }

    // Add tools if provided
    if (tools.length > 0) {
      params.tools = tools as Anthropic.MessageCreateParams['tools'];
    }

    if (options.prompt_cache?.mode === 'auto') {
      (params as unknown as Record<string, unknown>).cache_control = {
        type: 'ephemeral',
        ...(options.prompt_cache.ttl === 'extended' ? { ttl: '1h' } : {}),
      };
    }

    const mcpServers = (options.native_tools ?? [])
      .filter((tool) => tool.capability === 'remote_mcp')
      .map((tool) => {
        const resolvedToken = (
          tool.server as typeof tool.server & { resolvedAuthorizationToken?: string }
        ).resolvedAuthorizationToken;
        return {
          type: 'url',
          name: tool.server.name,
          url: tool.server.url,
          ...(resolvedToken ? { authorization_token: resolvedToken } : {}),
          ...(tool.server.allowedTools
            ? { tool_configuration: { allowed_tools: tool.server.allowedTools } }
            : {}),
        };
      });
    if (mcpServers.length > 0) {
      (params as unknown as Record<string, unknown>).mcp_servers = mcpServers;
      rawParams.betas = [
        ...new Set([
          ...((rawParams.betas as string[] | undefined) ?? []),
          'mcp-client-2025-11-20',
        ]),
      ];
    }

    // Some models (e.g. claude-opus-4-7) deprecate the `temperature` parameter entirely.
    // Registry opt-out: features.parameters.temperature === false.
    // Default is supported — unknown / missing registry entries pass temperature through.
    const supportsTemperature =
      getModelInfo(options.model)?.features.parameters?.temperature !== false;

    // Add thinking/reasoning support
    if (options.thinking?.enabled) {
      validateThinkingConfig(options.thinking);
      if (usesAdaptiveThinking(options.model)) {
        (params as any).thinking = {
          type: 'adaptive',
          ...(vendorOptions.thinkingDisplay
            ? { display: vendorOptions.thinkingDisplay }
            : {}),
        };
      } else {
        const budgetTokens = options.thinking.budgetTokens || 10000;
        if (budgetTokens < 1024 || budgetTokens >= max_tokens) {
          throw new Error(
            `Anthropic thinking budgetTokens must be at least 1024 and less than max_output_tokens (${max_tokens})`,
          );
        }
        (params as any).thinking = {
          type: 'enabled',
          budget_tokens: budgetTokens,
        };
        // Legacy fixed-budget thinking requires temperature=1 on models that accept it.
        if (supportsTemperature) params.temperature = 1;
      }
    } else if (options.temperature !== undefined && supportsTemperature) {
      // Only set temperature if thinking is not enabled and the model accepts it
      params.temperature = options.temperature;
    }

    // `thinking.enabled` gates the provider-neutral effort field. Anthropic's
    // native effort control is independent of thinking, so callers that want
    // it without normalized thinking can still use vendorOptions.effort.
    const requestedEffort = options.thinking?.enabled
      ? (options.thinking.effort ?? vendorOptions.effort)
      : vendorOptions.effort;
    if (requestedEffort && requestedEffort !== 'none') {
      const effort = requestedEffort === 'minimal' ? 'low' : requestedEffort;
      params.output_config = { ...(params.output_config ?? {}), effort } as Anthropic.OutputConfig;
    }

    if (options.response_format?.type === 'json_schema') {
      const jsonSchema = options.response_format.json_schema;
      const schema =
        jsonSchema && typeof jsonSchema === 'object' && 'schema' in jsonSchema
          ? jsonSchema.schema
          : jsonSchema;
      if (schema && typeof schema === 'object') {
        // Raw JSON Schema can contain constraints that Anthropic's grammar
        // compiler does not support (for example minItems > 1, maxItems,
        // minLength, or numeric bounds). Use the official SDK transformer so
        // supported constraints remain structural while unsupported ones move
        // into descriptions as model guidance. The transformer deep-clones the
        // input, preserving the caller's original schema for host validation.
        const anthropicSchema = transformJSONSchema(schema as Record<string, unknown>);
        params.output_config = {
          ...(params.output_config ?? {}),
          format: { type: 'json_schema', schema: anthropicSchema },
        };
      }
    }

    return params;
  }

  /**
   * Convert Anthropic response -> our LLMResponse format
   */
  convertResponse(response: Anthropic.Message): LLMResponse {
    const cacheReadInputTokens = response.usage.cache_read_input_tokens ?? 0;
    const cacheCreationInputTokens = response.usage.cache_creation_input_tokens ?? 0;
    // Anthropic reports mutually exclusive input buckets. Normalize the shared
    // input_tokens field to the total processed input so it has the same
    // meaning as OpenAI/Google and can be priced without discarding cache hits.
    const totalInputTokens =
      response.usage.input_tokens + cacheReadInputTokens + cacheCreationInputTokens;
    const reasoningTokens = (
      response.usage as Anthropic.Usage & {
        output_tokens_details?: { thinking_tokens?: number } | null;
      }
    ).output_tokens_details?.thinking_tokens;
    const built = this.buildResponse({
      rawId: response.id,
      model: response.model,
      status: this.mapProviderStatus(response.stop_reason),
      content: this.convertProviderContent(response.content),
      messageId: response.id,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: response.usage.output_tokens,
        cachedInputTokens: response.usage.cache_read_input_tokens || undefined,
        cacheCreationInputTokens: response.usage.cache_creation_input_tokens || undefined,
        cacheCreationDetails:
          response.usage.cache_creation &&
          (response.usage.cache_creation.ephemeral_5m_input_tokens > 0 ||
            response.usage.cache_creation.ephemeral_1h_input_tokens > 0)
          ? {
              shortTtlInputTokens:
                response.usage.cache_creation.ephemeral_5m_input_tokens,
              extendedTtlInputTokens:
                response.usage.cache_creation.ephemeral_1h_input_tokens,
            }
          : undefined,
        reasoningTokens,
        nativeToolCalls:
          response.usage.server_tool_use &&
          (response.usage.server_tool_use.web_search_requests > 0 ||
            response.usage.server_tool_use.web_fetch_requests > 0)
          ? {
              web_search: response.usage.server_tool_use.web_search_requests ?? 0,
              web_fetch: response.usage.server_tool_use.web_fetch_requests ?? 0,
            }
          : undefined,
        serviceTier: response.usage.service_tier ?? undefined,
        speed: (response.usage as Anthropic.Usage & { speed?: string | null }).speed ?? undefined,
      },
    });

    // Surface stop_reason + stop_details for diagnostics. `stop_details` is
    // populated by Anthropic only for refusals and names the classifier that
    // fired; cast defensively since older SDK typings may omit it.
    if (response.stop_reason) {
      built.stop_reason = response.stop_reason;
    }
    const rawDetails = (response as {
      stop_details?: { type?: string; category?: string | null; explanation?: string | null } | null;
    }).stop_details;
    if (rawDetails) {
      built.stop_details = {
        type: rawDetails.type,
        category: rawDetails.category ?? null,
        explanation: rawDetails.explanation ?? null,
      };
    }
    const nativeToolEvents = this.extractNativeToolEvents(response.content);
    if (nativeToolEvents.length > 0) built.native_tool_events = nativeToolEvents;

    return built;
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
        const text = this.createText(block.text);
        if ('citations' in block && Array.isArray(block.citations)) {
          (text as Content & { annotations?: unknown[] }).annotations = block.citations;
        }
        content.push(text);
      } else if (block.type === 'tool_use') {
        content.push(this.createToolUse(block.id, block.name, block.input as Record<string, unknown>));
      } else if (block.type === 'thinking') {
        // Anthropic thinking block - must persist in history for round-tripping
        const thinkingBlock = block as { type: 'thinking'; thinking: string; signature: string };
        content.push({
          type: ContentType.THINKING,
          thinking: thinkingBlock.thinking || '',
          signature: thinkingBlock.signature,
          persistInHistory: true,
        });
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

        // Skip messages with empty content (Anthropic rejects these)
        if (!content || (Array.isArray(content) && content.length === 0) || content === '') {
          continue;
        }

        messages.push({
          role: role as 'user' | 'assistant',
          content,
        });
      }
    }

    // Safety net: Anthropic requires the conversation to end with a user message.
    // Some models (e.g., claude-opus-4-6) reject assistant prefill entirely.
    // If the last message is assistant (can happen after compaction or context bugs),
    // trim trailing assistant messages to prevent API errors.
    while (messages.length > 0 && messages[messages.length - 1]!.role === 'assistant') {
      messages.pop();
    }

    // If all messages were trimmed (shouldn't happen), add a minimal user message
    if (messages.length === 0) {
      messages.push({ role: 'user', content: 'Continue.' });
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
        case ContentType.OUTPUT_TEXT: {
          // Anthropic rejects empty text content blocks
          const textContent = (c as { text: string }).text;
          if (textContent && textContent.trim()) {
            blocks.push({
              type: 'text',
              text: textContent,
            });
          }
          break;
        }

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
            __images?: Array<{ base64: string; mediaType: string }>;
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

        case ContentType.THINKING: {
          // Round-trip thinking blocks back to Anthropic format.
          // Only include blocks that have a valid signature — Anthropic requires it.
          // Streaming-path thinking blocks lack signatures and cannot be round-tripped;
          // non-streaming responses (via convertResponse) always carry signatures.
          const thinkingContent = c as { thinking: string; signature?: string };
          if (thinkingContent.signature) {
            blocks.push({
              type: 'thinking',
              thinking: thinkingContent.thinking,
              signature: thinkingContent.signature,
            } as any);
          }
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
          media_type: parsed.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: parsed.data,
        },
      };
    } else {
      // URL (Claude 3.5+ supports this)
      return {
        type: 'image',
        source: {
          type: 'url',
          url,
        },
      };
    }
  }

  /**
   * Convert tool result to Anthropic block
   * Anthropic requires non-empty content when is_error is true
   * Supports __images convention: tool results with __images get multimodal content
   */
  private convertToolResultToAnthropicBlock(resultContent: {
    tool_use_id: string;
    content: string | unknown;
    error?: string;
    __images?: Array<{ base64: string; mediaType: string }>;
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

    // Read images from Content object first (set by addToolResults),
    // fall back to JSON extraction for backward compat
    const images = resultContent.__images?.length
      ? resultContent.__images
      : this.extractImages(toolResultContent);

    if (images) {
      // Strip __images and base64 from text to save tokens (needed for JSON fallback path)
      const textContent = resultContent.__images?.length
        ? toolResultContent  // Already stripped at context layer
        : this.stripImagesFromContent(toolResultContent);
      const contentBlocks: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];

      if (textContent.trim()) {
        contentBlocks.push({ type: 'text', text: textContent });
      }

      for (const img of images) {
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: (img.mediaType || 'image/png') as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
            data: img.base64,
          },
        });
      }

      return {
        type: 'tool_result',
        tool_use_id: resultContent.tool_use_id,
        content: contentBlocks.length > 0 ? contentBlocks : textContent,
        is_error: isError,
      };
    }

    return {
      type: 'tool_result',
      tool_use_id: resultContent.tool_use_id,
      content: toolResultContent,
      is_error: isError,
    };
  }

  /**
   * Extract __images from a JSON-stringified tool result content.
   * Returns null if no images found.
   */
  private extractImages(content: string): Array<{ base64: string; mediaType: string }> | null {
    try {
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.__images) && parsed.__images.length > 0) {
        return parsed.__images;
      }
    } catch {
      // Not JSON or no __images
    }
    return null;
  }

  /**
   * Strip __images and base64 fields from JSON content to reduce token usage in text.
   */
  private stripImagesFromContent(content: string): string {
    try {
      const parsed = JSON.parse(content);
      const { __images: _, base64: __, ...rest } = parsed;
      return JSON.stringify(rest);
    } catch {
      return content;
    }
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

  private convertNativeTools(options: TextGenerateOptions): unknown[] {
    return (options.native_tools ?? []).map((tool) => {
      const extra = tool.options ?? {};
      switch (tool.capability) {
        case 'web_search':
          return { ...extra, type: 'web_search_20260209', name: 'web_search' };
        case 'web_fetch':
          return { ...extra, type: 'web_fetch_20260309', name: 'web_fetch' };
        case 'code_execution':
          return { ...extra, type: 'code_execution_20260120', name: 'code_execution' };
        case 'remote_mcp':
          return {
            ...extra,
            type: 'mcp_toolset',
            mcp_server_name: tool.server.name,
            ...(tool.server.allowedTools
              ? {
                  default_config: { enabled: false },
                  configs: Object.fromEntries(
                    tool.server.allowedTools.map((name) => [name, { enabled: true }]),
                  ),
                }
              : {}),
          };
        default:
          return extra;
      }
    });
  }

  private extractNativeToolEvents(
    blocks: Anthropic.ContentBlock[],
  ): NonNullable<LLMResponse['native_tool_events']> {
    const events: NonNullable<LLMResponse['native_tool_events']> = [];
    for (const block of blocks as unknown as Array<Record<string, unknown>>) {
      const type = String(block.type ?? '');
      const capability = type.includes('web_search')
        ? 'web_search'
        : type.includes('web_fetch')
          ? 'web_fetch'
          : type.includes('code_execution')
            ? 'code_execution'
            : type.includes('mcp_') || type === 'server_tool_use' && block.name === 'mcp'
              ? 'remote_mcp'
              : type === 'server_tool_use' && typeof block.name === 'string'
                ? block.name
                : undefined;
      if (!capability) continue;
      const rawError = block.error ?? (block.is_error ? block.content : undefined);
      events.push({
        capability,
        ...(typeof block.id === 'string'
          ? { id: block.id }
          : typeof block.tool_use_id === 'string'
            ? { id: block.tool_use_id }
            : {}),
        status: rawError ? 'failed' : type.endsWith('_result') ? 'completed' : 'in_progress',
        ...(rawError
          ? {
              error: {
                message:
                  typeof rawError === 'object' && rawError && 'message' in rawError
                    ? String((rawError as { message?: unknown }).message)
                    : String(rawError),
                details: rawError,
              },
            }
          : {}),
      });
    }
    return events;
  }
}
