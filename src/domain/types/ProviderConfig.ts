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
  // Groq-specific config
}

export type ProviderConfig =
  | OpenAIConfig
  | AnthropicConfig
  | GoogleConfig
  | GroqConfig
  | BaseProviderConfig;

export interface ProvidersConfig {
  openai?: OpenAIConfig;
  anthropic?: AnthropicConfig;
  google?: GoogleConfig;
  groq?: GroqConfig;
  [key: string]: ProviderConfig | undefined;
}
