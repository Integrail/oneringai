import type { TextGenerateOptions } from '../../../domain/interfaces/ITextProvider.js';
import {
  InvalidConfigError,
  ProviderCapabilityNotSupportedError,
} from '../../../domain/errors/AIErrors.js';
import { getModelInfo } from '../../../domain/entities/Model.js';

const GPT_6_ASTRA = /^gpt-6-astra(?:-|$)/;
const EU_OPENAI_HOSTS = /^(?:eu\.api\.openai\.com|.*\.openai\.azure\.com)$/i;
const ASTRA_REASONING_EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

function isEUBaseURL(baseURL?: string): boolean {
  if (!baseURL) return false;
  try {
    const host = new URL(baseURL).hostname;
    return host === 'eu.api.openai.com'
      || host.includes('spaincentral')
      || (EU_OPENAI_HOSTS.test(host) && host.includes('eu'));
  } catch {
    return baseURL.includes('eu.api.openai.com') || baseURL.includes('spaincentral');
  }
}

function hasInputType(input: unknown, type: string): boolean {
  return Array.isArray(input)
    && input.some((item) => Boolean(item && typeof item === 'object' && (item as { type?: unknown }).type === type));
}

function inputItems(input: unknown): Array<Record<string, unknown>> {
  return Array.isArray(input)
    ? input.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    : [];
}

/** Validate OpenAI Responses constraints that cannot be represented by shared types. */
export function validateOpenAIResponsesRequest(
  options: Pick<TextGenerateOptions, 'model' | 'temperature'>,
  params: Record<string, unknown>,
  baseURL?: string,
): void {
  const model = options.model;
  const isAstra = GPT_6_ASTRA.test(model);
  const modelInfo = getModelInfo(model);
  const tools = Array.isArray(params.tools) ? params.tools as Array<Record<string, unknown>> : [];
  const asyncTools = tools.filter((tool) => tool.async === true);
  const hasAsyncTool = asyncTools.length > 0;
  const hasConfigurationUpdate = hasInputType(params.input, 'configuration_update');
  const multiAgentEnabled = Boolean(
    params.multi_agent
    && typeof params.multi_agent === 'object'
    && (params.multi_agent as { enabled?: unknown }).enabled === true,
  );
  const programmaticToolChoice = Boolean(
    params.tool_choice
    && typeof params.tool_choice === 'object'
    && (params.tool_choice as { type?: unknown }).type === 'programmatic_tool_calling',
  );

  const supportsAsyncToolCalling = modelInfo
    ? modelInfo.features.asyncToolCalling === true
    : isAstra;
  if (hasAsyncTool && !supportsAsyncToolCalling) {
    throw new ProviderCapabilityNotSupportedError('openai', model, 'async_tool_calling');
  }
  if (
    hasAsyncTool
    && (programmaticToolChoice
      || asyncTools.some((tool) => (
        Array.isArray(tool.allowed_callers) && tool.allowed_callers.includes('programmatic')
      )))
  ) {
    throw new InvalidConfigError(
      'OpenAI async tool calling cannot be combined with programmatic tool calling',
    );
  }
  if (hasAsyncTool && multiAgentEnabled && params.parallel_tool_calls !== false) {
    throw new InvalidConfigError(
      'OpenAI multi-agent requests with async tools must set parallel_tool_calls to false',
    );
  }

  const supportsConfigurationUpdates = modelInfo
    ? modelInfo.features.configurationUpdates === true
    : isAstra;
  if (hasConfigurationUpdate && !supportsConfigurationUpdates) {
    throw new ProviderCapabilityNotSupportedError('openai', model, 'configuration_update');
  }
  if (hasConfigurationUpdate && multiAgentEnabled) {
    throw new InvalidConfigError(
      'OpenAI configuration_update is supported only for single-agent responses',
    );
  }
  if (
    hasConfigurationUpdate
    && ((Array.isArray(params.context_management) && params.context_management.length > 0)
      || params.truncation === 'auto')
  ) {
    throw new InvalidConfigError(
      'OpenAI configuration_update is incompatible with automatic compaction and truncation',
    );
  }
  for (const item of inputItems(params.input)) {
    if (item.type !== 'configuration_update') continue;
    const reasoning = item.reasoning;
    const effort = reasoning && typeof reasoning === 'object'
      ? (reasoning as { effort?: unknown }).effort
      : undefined;
    if (typeof effort !== 'string' || !ASTRA_REASONING_EFFORTS.has(effort)) {
      throw new InvalidConfigError(
        'OpenAI configuration_update reasoning effort must be low, medium, high, xhigh, or max',
      );
    }
  }

  if (!isAstra) return;

  const reasoning = params.reasoning as { effort?: unknown } | undefined;
  if (reasoning?.effort === 'none' || reasoning?.effort === 'minimal') {
    throw new InvalidConfigError(
      `GPT-6 Astra does not support reasoning effort '${String(reasoning.effort)}'; use low, medium, high, xhigh, or max`,
    );
  }
  if (options.temperature !== undefined || params.temperature !== undefined) {
    throw new InvalidConfigError('GPT-6 Astra does not support temperature');
  }
  for (const parameter of ['top_p', 'top_logprobs'] as const) {
    if (params[parameter] !== undefined) {
      throw new InvalidConfigError(`GPT-6 Astra does not support ${parameter}`);
    }
  }
  if (
    Array.isArray(params.include)
    && params.include.includes('message.output_text.logprobs')
  ) {
    throw new InvalidConfigError(
      'GPT-6 Astra does not support include: message.output_text.logprobs',
    );
  }

  const serviceTier = params.service_tier;
  if (
    isEUBaseURL(baseURL)
    && (serviceTier === 'fast' || serviceTier === 'priority')
  ) {
    throw new InvalidConfigError(
      'GPT-6 Astra Fast mode is unavailable with EU data residency',
    );
  }
}
