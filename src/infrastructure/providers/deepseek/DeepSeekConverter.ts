import type { InputItem } from '../../../domain/entities/Message.js';
import { MessageRole } from '../../../domain/entities/Message.js';
import type { Content } from '../../../domain/entities/Content.js';
import { ContentType } from '../../../domain/entities/Content.js';
import type { Tool } from '../../../domain/entities/Tool.js';
import type { LLMResponse } from '../../../domain/entities/Response.js';
import type { TextGenerateOptions, ReasoningEffort } from '../../../domain/interfaces/ITextProvider.js';
import { buildLLMResponse } from '../shared/ResponseBuilder.js';
import { OpenAIResponsesConverter } from '../openai/OpenAIResponsesConverter.js';
import type { ResolvedDeepSeekHost, ResolvedDeepSeekModel } from './DeepSeekHostRegistry.js';

type WireObject = Record<string, any>;

function normalizeEffort(
  effort: ReasoningEffort | undefined,
  model: ResolvedDeepSeekModel,
): 'low' | 'high' | 'max' {
  if (effort === 'max' || effort === 'xhigh') return 'max';
  if (effort === 'minimal' || effort === 'low') {
    // Chat Completions maps low/medium to high. Responses exposes a true low
    // setting for V4 Flash.
    return model.transport === 'responses' ? 'low' : 'high';
  }
  return 'high';
}

function mapFinishStatus(
  reason: string | null | undefined,
): 'completed' | 'incomplete' | 'failed' {
  switch (reason) {
    case 'stop':
    case 'tool_calls':
      return 'completed';
    case 'length':
      return 'incomplete';
    case 'content_filter':
    case 'insufficient_system_resource':
      return 'failed';
    default:
      return 'completed';
  }
}

export class DeepSeekConverter {
  private readonly responses = new OpenAIResponsesConverter();

  convertChatRequest(
    options: TextGenerateOptions,
    model: ResolvedDeepSeekModel,
    host: ResolvedDeepSeekHost,
  ): WireObject {
    const messages = this.convertChatMessages(options.input, options.instructions);
    const reasoningEnabled = options.thinking?.enabled !== false;
    const params: WireObject = {
      model: model.apiModel,
      messages,
      ...(options.max_output_tokens !== undefined && { max_tokens: options.max_output_tokens }),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.parallel_tool_calls !== undefined && {
        parallel_tool_calls: options.parallel_tool_calls,
      }),
    };

    if (options.tools?.length) {
      params.tools = this.convertChatTools(options.tools);
      // First-party thinking mode does not accept tool_choice. Auto is also the
      // framework default, so omitting it preserves the intended behavior.
      if (options.tool_choice && options.tool_choice !== 'auto' && !reasoningEnabled) {
        params.tool_choice = options.tool_choice;
      }
    }

    if (options.response_format?.type === 'json_object') {
      params.response_format = { type: 'json_object' };
      this.ensureJsonInstruction(messages);
    }

    const effort = normalizeEffort(options.thinking?.effort, model);
    if (host.profile.id === 'official') {
      params.thinking = { type: reasoningEnabled ? 'enabled' : 'disabled' };
      if (reasoningEnabled) params.reasoning_effort = effort;
    } else if (host.profile.id === 'openrouter' || host.profile.id === 'together') {
      params.reasoning = reasoningEnabled ? { enabled: true, effort } : { enabled: false };
      if (reasoningEnabled) params.reasoning_effort = effort;
    } else {
      // NVIDIA and the remaining OpenAI-compatible hosts use `none` to disable
      // reasoning rather than DeepSeek's `thinking` object.
      params.reasoning_effort = reasoningEnabled ? effort : 'none';
    }

    if (options.vendorOptions?.deepseek_user_id) {
      params.user_id = options.vendorOptions.deepseek_user_id;
    }
    return { ...params, ...this.safeChatVendorOptions(options.vendorOptions) };
  }

  convertChatResponse(
    response: WireObject,
    requestedModel: string,
    persistReasoning: boolean,
  ): LLMResponse {
    const choice = response.choices?.[0] ?? {};
    const message = choice.message ?? {};
    const content: Content[] = [];
    const reasoning = message.reasoning_content ?? message.reasoning;
    if (typeof reasoning === 'string' && reasoning) {
      content.push({
        type: ContentType.THINKING,
        thinking: reasoning,
        ...(Array.isArray(message.reasoning_details) && {
          providerMetadata: { reasoning_details: message.reasoning_details },
        }),
        persistInHistory: persistReasoning,
      });
    }
    if (typeof message.content === 'string' && message.content) {
      content.push({ type: ContentType.OUTPUT_TEXT, text: message.content });
    }
    for (const call of message.tool_calls ?? []) {
      if (call.type !== 'function' || !call.function) continue;
      content.push({
        type: ContentType.TOOL_USE,
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments ?? '{}',
      });
    }

    const usage = response.usage ?? {};
    const result = buildLLMResponse({
      provider: 'deepseek',
      rawId: response.id,
      model: requestedModel,
      status: mapFinishStatus(choice.finish_reason),
      content,
      usage: {
        inputTokens: usage.prompt_tokens ?? 0,
        outputTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens,
        cachedInputTokens:
          usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details?.cached_tokens,
        reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
      },
      createdAt: response.created,
    });
    result.stop_reason = choice.finish_reason ?? undefined;
    return result;
  }

  convertResponsesRequest(
    options: TextGenerateOptions,
    model: ResolvedDeepSeekModel,
  ): WireObject {
    const converted = this.convertResponsesInput(options.input, options.instructions);
    const params: WireObject = {
      model: model.apiModel,
      input: converted.input,
      ...(converted.instructions && { instructions: converted.instructions }),
      ...(options.max_output_tokens !== undefined && {
        max_output_tokens: options.max_output_tokens,
      }),
    };
    const tools = [
      ...(options.tools?.length ? this.responses.convertTools(options.tools) : []),
      ...(options.native_tools?.length
        ? this.responses.convertNativeTools(options.native_tools)
        : []),
    ];
    if (tools.length) {
      params.tools = tools;
      if (options.tool_choice) {
        params.tool_choice = this.responses.convertToolChoice(options.tool_choice);
      }
    }
    if (options.response_format) {
      params.text = this.responses.convertResponseFormat(options.response_format);
    }
    if (options.thinking?.enabled !== false) {
      params.reasoning = { effort: normalizeEffort(options.thinking?.effort, model) };
    }
    if (options.vendorOptions?.deepseek_user_id) {
      params.user_id = options.vendorOptions.deepseek_user_id;
    }
    return { ...params, ...this.safeResponsesVendorOptions(options.vendorOptions) };
  }

  convertResponsesResponse(
    response: WireObject,
    requestedModel: string,
    persistReasoning: boolean,
  ): LLMResponse {
    const converted = this.responses.convertResponse(response as never);
    converted.model = requestedModel;
    const assistant = converted.output.find(
      (item): item is Extract<(typeof converted.output)[number], { type: 'message' }> =>
        item.type === 'message',
    );
    if (!assistant) return converted;

    // DeepSeek returns full reasoning in reasoning.content[]. OpenAI's native
    // converter reads summary[], which is intentionally empty on DeepSeek.
    const reasoningBlocks: Content[] = [];
    for (const item of response.output ?? []) {
      if (item.type !== 'reasoning') continue;
      const thinking = Array.isArray(item.content)
        ? item.content
            .filter((part: WireObject) => part.type === 'reasoning_text')
            .map((part: WireObject) => part.text ?? '')
            .filter(Boolean)
            .join('\n')
        : '';
      if (thinking) {
        reasoningBlocks.push({
          type: ContentType.THINKING,
          thinking,
          providerItemId: item.id,
          persistInHistory: persistReasoning,
        });
      }
    }
    if (reasoningBlocks.length) {
      assistant.content = [
        ...reasoningBlocks,
        ...assistant.content.filter((part) => part.type !== ContentType.THINKING),
      ];
      converted.thinking = reasoningBlocks
        .map((part) => part.type === ContentType.THINKING ? part.thinking : '')
        .filter(Boolean)
        .join('\n');
    }
    return converted;
  }

  private convertChatMessages(
    input: string | InputItem[],
    instructions?: string,
  ): WireObject[] {
    const messages: WireObject[] = [];
    if (instructions) messages.push({ role: 'system', content: instructions });
    if (typeof input === 'string') {
      messages.push({ role: 'user', content: input });
      return messages;
    }

    for (const item of input) {
      if (item.type !== 'message') continue;
      if (item.role === MessageRole.ASSISTANT) {
        const text = item.content
          .filter((part) => part.type === ContentType.OUTPUT_TEXT || part.type === ContentType.INPUT_TEXT)
          .map((part) => 'text' in part ? part.text : '')
          .join('');
        const thinking = item.content
          .filter((part) => part.type === ContentType.THINKING)
          .map((part) => part.type === ContentType.THINKING ? part.thinking : '')
          .join('');
        const reasoningDetails = item.content
          .filter((part) => part.type === ContentType.THINKING)
          .map((part) => part.type === ContentType.THINKING
            ? part.providerMetadata?.reasoning_details
            : undefined)
          .find(Array.isArray);
        const toolCalls = item.content
          .filter((part) => part.type === ContentType.TOOL_USE)
          .map((part) => part.type === ContentType.TOOL_USE ? {
            id: part.id,
            type: 'function',
            function: { name: part.name, arguments: part.arguments },
          } : undefined)
          .filter(Boolean);
        messages.push({
          role: 'assistant',
          content: text,
          ...(thinking && { reasoning_content: thinking }),
          ...(reasoningDetails && { reasoning_details: reasoningDetails }),
          ...(toolCalls.length && { tool_calls: toolCalls }),
        });
        continue;
      }

      const role = item.role === MessageRole.DEVELOPER ? 'system' : 'user';
      const textParts = item.content
        .filter((part) => part.type === ContentType.INPUT_TEXT || part.type === ContentType.OUTPUT_TEXT)
        .map((part) => 'text' in part ? part.text : '');
      if (textParts.length) messages.push({ role, content: textParts.join('') });
      for (const part of item.content) {
        if (part.type === ContentType.TOOL_RESULT) {
          messages.push({
            role: 'tool',
            tool_call_id: part.tool_use_id,
            content: typeof part.content === 'string' ? part.content : JSON.stringify(part.content),
          });
        }
      }
    }
    return messages;
  }

  private convertResponsesInput(
    input: string | InputItem[],
    instructions?: string,
  ): { input: string | WireObject[]; instructions?: string } {
    if (typeof input === 'string') return { input, instructions };
    const wireItems: WireObject[] = [];
    for (let index = 0; index < input.length; index++) {
      const item = input[index]!;
      if (item.type === 'message' && item.role === MessageRole.ASSISTANT) {
        for (const part of item.content) {
          if (part.type !== ContentType.THINKING) continue;
          wireItems.push({
            type: 'reasoning',
            ...(part.providerItemId ? { id: part.providerItemId } : {}),
            content: [{ type: 'reasoning_text', text: part.thinking }],
            summary: [],
          });
        }
      }
      const converted = this.responses.convertInput([item]);
      if (Array.isArray(converted.input)) wireItems.push(...converted.input as WireObject[]);
    }
    return { input: wireItems, instructions };
  }

  private convertChatTools(tools: Tool[]): WireObject[] {
    return tools
      .filter((tool) => tool.type === 'function')
      .map((tool) => ({
        type: 'function',
        function: {
          name: tool.function.name,
          description: tool.function.description ?? '',
          parameters: tool.function.parameters ?? { type: 'object', properties: {} },
          ...(tool.function.strict === true && { strict: true }),
        },
      }));
  }

  private ensureJsonInstruction(messages: WireObject[]): void {
    if (messages.some((message) =>
      typeof message.content === 'string' && /json/i.test(message.content)
    )) return;
    messages.unshift({ role: 'system', content: 'Return valid JSON.' });
  }

  private safeChatVendorOptions(options?: Record<string, any>): WireObject {
    const allowed = ['top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'logprobs', 'top_logprobs'];
    return this.pick(options, allowed);
  }

  private safeResponsesVendorOptions(options?: Record<string, any>): WireObject {
    const allowed = ['max_tool_calls', 'background'];
    return this.pick(options, allowed);
  }

  private pick(options: Record<string, any> | undefined, keys: string[]): WireObject {
    const result: WireObject = {};
    for (const key of keys) {
      if (options?.[key] !== undefined) result[key] = options[key];
    }
    return result;
  }
}
