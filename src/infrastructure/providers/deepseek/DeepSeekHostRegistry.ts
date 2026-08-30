import { InvalidConfigError } from '../../../domain/errors/AIErrors.js';

/** Known OpenAI-compatible hosts that serve DeepSeek models. */
export const DEEPSEEK_HOSTS = {
  Official: 'official',
  OpenRouter: 'openrouter',
  Together: 'together',
  Fireworks: 'fireworks',
  DeepInfra: 'deepinfra',
  NvidiaNim: 'nvidia-nim',
  AzureFoundry: 'azure-foundry',
  Custom: 'custom',
} as const;

export type DeepSeekHost = (typeof DEEPSEEK_HOSTS)[keyof typeof DEEPSEEK_HOSTS];
export type DeepSeekTransport = 'auto' | 'responses' | 'chat_completions';

export interface DeepSeekHostProfile {
  id: DeepSeekHost;
  displayName: string;
  baseURL?: string;
  /** Azure and custom deployments must provide a connector baseURL. */
  requiresBaseURL?: boolean;
  defaultTransport: Exclude<DeepSeekTransport, 'auto'>;
  promptCaching: { mode: 'implicit' | 'unsupported'; reportsCacheUsage: boolean };
  modelIds: Readonly<Record<string, string>>;
  /** Host-specific limits take precedence over the first-party model registry. */
  modelLimits?: Readonly<Record<string, { inputTokens?: number; outputTokens?: number }>>;
  documentation: string;
}

const FLASH = 'deepseek-v4-flash';
const PRO = 'deepseek-v4-pro';
const FLASH_VISION_EXP = 'deepseek-v4-flash-vision-exp';

/**
 * Provider presets intentionally describe only bearer-token, OpenAI-compatible
 * endpoints. Bedrock and Vertex require their own signed/authenticated
 * transports and are not represented as misleading URL aliases here.
 */
export const DEEPSEEK_HOST_REGISTRY: Readonly<Record<DeepSeekHost, DeepSeekHostProfile>> = {
  official: {
    id: 'official',
    displayName: 'DeepSeek Platform',
    baseURL: 'https://api.deepseek.com/v1',
    defaultTransport: 'responses',
    promptCaching: { mode: 'implicit', reportsCacheUsage: true },
    modelIds: { [FLASH]: FLASH, [PRO]: PRO, [FLASH_VISION_EXP]: FLASH_VISION_EXP },
    documentation: 'https://api-docs.deepseek.com/',
  },
  openrouter: {
    id: 'openrouter',
    displayName: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    defaultTransport: 'chat_completions',
    promptCaching: { mode: 'implicit', reportsCacheUsage: true },
    modelIds: {
      [FLASH]: 'deepseek/deepseek-v4-flash',
      [PRO]: 'deepseek/deepseek-v4-pro',
    },
    documentation: 'https://openrouter.ai/deepseek',
  },
  together: {
    id: 'together',
    displayName: 'Together AI',
    baseURL: 'https://api.together.xyz/v1',
    defaultTransport: 'chat_completions',
    promptCaching: { mode: 'implicit', reportsCacheUsage: true },
    modelIds: { [PRO]: 'deepseek-ai/DeepSeek-V4-Pro' },
    modelLimits: { [PRO]: { inputTokens: 512_000 } },
    documentation: 'https://docs.together.ai/docs/deepseek-v4-quickstart',
  },
  fireworks: {
    id: 'fireworks',
    displayName: 'Fireworks AI',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    defaultTransport: 'chat_completions',
    promptCaching: { mode: 'implicit', reportsCacheUsage: true },
    modelIds: {
      [FLASH]: 'accounts/fireworks/models/deepseek-v4-flash',
      [PRO]: 'accounts/fireworks/models/deepseek-v4-pro',
    },
    modelLimits: {
      [FLASH]: { inputTokens: 1_048_576 },
      [PRO]: { inputTokens: 1_048_576 },
    },
    documentation: 'https://fireworks.ai/models',
  },
  deepinfra: {
    id: 'deepinfra',
    displayName: 'DeepInfra',
    baseURL: 'https://api.deepinfra.com/v1/openai',
    defaultTransport: 'chat_completions',
    promptCaching: { mode: 'implicit', reportsCacheUsage: true },
    modelIds: {
      [FLASH]: 'deepseek-ai/DeepSeek-V4-Flash',
      [PRO]: 'deepseek-ai/DeepSeek-V4-Pro',
    },
    modelLimits: {
      [FLASH]: { inputTokens: 1_024_000 },
      [PRO]: { inputTokens: 1_024_000 },
    },
    documentation: 'https://docs.deepinfra.com/api-reference/introduction',
  },
  'nvidia-nim': {
    id: 'nvidia-nim',
    displayName: 'NVIDIA NIM',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    defaultTransport: 'chat_completions',
    promptCaching: { mode: 'unsupported', reportsCacheUsage: false },
    modelIds: {
      [FLASH]: 'deepseek-ai/deepseek-v4-flash',
      [PRO]: 'deepseek-ai/deepseek-v4-pro',
    },
    modelLimits: {
      [FLASH]: { outputTokens: 16_384 },
      [PRO]: { outputTokens: 16_384 },
    },
    documentation: 'https://docs.api.nvidia.com/nim/reference/llm-apis',
  },
  'azure-foundry': {
    id: 'azure-foundry',
    displayName: 'Azure AI Foundry',
    requiresBaseURL: true,
    defaultTransport: 'chat_completions',
    promptCaching: { mode: 'unsupported', reportsCacheUsage: false },
    modelIds: {},
    documentation: 'https://learn.microsoft.com/azure/foundry/foundry-models/concepts/endpoints',
  },
  custom: {
    id: 'custom',
    displayName: 'Custom OpenAI-compatible DeepSeek host',
    requiresBaseURL: true,
    defaultTransport: 'chat_completions',
    promptCaching: { mode: 'unsupported', reportsCacheUsage: false },
    modelIds: {},
    documentation: 'https://api-docs.deepseek.com/',
  },
};

export interface ResolveDeepSeekHostOptions {
  host?: DeepSeekHost;
  baseURL?: string;
  transport?: DeepSeekTransport;
}

export interface ResolvedDeepSeekHost {
  profile: DeepSeekHostProfile;
  baseURL: string;
  transport: DeepSeekTransport;
}

export function resolveDeepSeekHost(options: ResolveDeepSeekHostOptions = {}): ResolvedDeepSeekHost {
  const host = options.host ?? 'official';
  const profile = DEEPSEEK_HOST_REGISTRY[host];
  if (!profile) {
    throw new InvalidConfigError(
      `Unknown DeepSeek host '${String(host)}'. Supported hosts: ${Object.keys(DEEPSEEK_HOST_REGISTRY).join(', ')}`,
    );
  }
  const baseURL = options.baseURL ?? profile.baseURL;
  if (!baseURL) {
    throw new InvalidConfigError(
      `DeepSeek host '${host}' requires connector.baseURL`,
    );
  }
  return {
    profile,
    baseURL: baseURL.replace(/\/$/, ''),
    transport: options.transport ?? 'auto',
  };
}

export interface ResolvedDeepSeekModel {
  requestedModel: string;
  canonicalModel?: string;
  apiModel: string;
  transport: Exclude<DeepSeekTransport, 'auto'>;
  inputTokens?: number;
  outputTokens?: number;
}

export function resolveDeepSeekModel(
  model: string,
  host: ResolvedDeepSeekHost,
): ResolvedDeepSeekModel {
  const canonicalModel = model === FLASH || model === PRO || model === FLASH_VISION_EXP
    ? model
    : undefined;
  if (
    canonicalModel &&
    !host.profile.modelIds[canonicalModel] &&
    host.profile.id !== 'custom' &&
    host.profile.id !== 'azure-foundry'
  ) {
    throw new InvalidConfigError(
      `DeepSeek host '${host.profile.id}' does not advertise model '${canonicalModel}'. ` +
        `Use a supported canonical model or pass the host's model/deployment ID directly.`,
    );
  }
  const apiModel = canonicalModel ? (host.profile.modelIds[canonicalModel] ?? model) : model;

  let transport: Exclude<DeepSeekTransport, 'auto'>;
  if (host.transport !== 'auto') {
    transport = host.transport;
  } else if (host.profile.id === 'official') {
    transport = 'responses';
  } else {
    transport = host.profile.defaultTransport;
  }

  const limits = canonicalModel ? host.profile.modelLimits?.[canonicalModel] : undefined;
  return {
    requestedModel: model,
    canonicalModel,
    apiModel,
    transport,
    inputTokens: limits?.inputTokens,
    outputTokens: limits?.outputTokens,
  };
}
