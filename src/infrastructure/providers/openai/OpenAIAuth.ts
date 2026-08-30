import { InvalidConfigError } from '../../../domain/errors/AIErrors.js';
import type {
  APIKeyProviderAuth,
  OpenAIMediaConfig,
} from '../../../domain/types/ProviderConfig.js';

export type OpenAISDKAPIKey = string | (() => Promise<string>);

/** Resolve static or rotating OpenAI credentials for SDK construction. */
export function resolveOpenAISDKAPIKey(config: OpenAIMediaConfig): OpenAISDKAPIKey {
  if (config.auth.type === 'api_key') return config.auth.apiKey;
  return createValidatedOpenAIAPIKeyProvider(config.auth.getApiKey);
}

/** Placeholder used only by BaseProvider's synchronous validation plumbing. */
export function resolveOpenAIBaseProviderKey(config: OpenAIMediaConfig): string {
  return config.auth.type === 'api_key' ? config.auth.apiKey : 'runtime-key-provider';
}

/** Keep direct provider construction as strict as connector-backed construction. */
export function createValidatedOpenAIAPIKeyProvider(
  getApiKey: APIKeyProviderAuth['getApiKey'],
): () => Promise<string> {
  return async () => {
    const apiKey = await getApiKey();
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      throw new InvalidConfigError('OpenAI API key provider returned an empty key');
    }
    return apiKey;
  };
}
