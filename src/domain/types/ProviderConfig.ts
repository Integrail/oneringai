/**
 * Provider configuration types
 */

export interface BaseProviderConfig {
  apiKey: string;
  baseURL?: string;
  organization?: string;
  timeout?: number; // Request timeout in ms
  maxRetries?: number; // Max retry attempts
}

export interface OpenAIConfig extends BaseProviderConfig {
  organization?: string;
  project?: string;
}

export interface AnthropicConfig extends BaseProviderConfig {
  anthropicVersion?: string;
}

export interface GoogleConfig extends BaseProviderConfig {
  // Google-specific config
}

export interface GroqConfig extends BaseProviderConfig {
  baseURL?: string; // Usually https://api.groq.com/openai/v1
}

export interface GrokConfig extends BaseProviderConfig {
  baseURL?: string; // xAI Grok API endpoint
}

export interface TogetherAIConfig extends BaseProviderConfig {
  baseURL?: string; // Usually https://api.together.xyz/v1
}

export interface GenericOpenAIConfig extends BaseProviderConfig {
  baseURL: string; // Required for generic providers
  providerName?: string; // Display name
}

export type ProviderConfig =
  | OpenAIConfig
  | AnthropicConfig
  | GoogleConfig
  | GroqConfig
  | GrokConfig
  | TogetherAIConfig
  | GenericOpenAIConfig
  | BaseProviderConfig;

export interface ProvidersConfig {
  openai?: OpenAIConfig;
  anthropic?: AnthropicConfig;
  google?: GoogleConfig;
  groq?: GroqConfig; // Groq (different from Grok)
  grok?: GrokConfig; // xAI Grok
  'together-ai'?: TogetherAIConfig;
  perplexity?: GenericOpenAIConfig;
  [key: string]: ProviderConfig | undefined;
}
