/**
 * Generic OpenAI-compatible provider
 * Works with any service that implements the OpenAI Chat Completions API
 * Examples: Together AI, Groq, Perplexity, Grok (xAI), local models, etc.
 */

import { OpenAITextProvider } from '../openai/OpenAITextProvider.js';
import { ModelCapabilities } from '../../../domain/interfaces/ITextProvider.js';
import { ProviderCapabilities } from '../../../domain/interfaces/IProvider.js';

export interface GenericOpenAIConfig {
  apiKey: string;
  baseURL: string; // Required - the API endpoint
  organization?: string;
  timeout?: number;
  maxRetries?: number;
  defaultModel?: string;
}

export class GenericOpenAIProvider extends OpenAITextProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  constructor(
    name: string,
    config: GenericOpenAIConfig,
    capabilities?: Partial<ProviderCapabilities>
  ) {
    super(config as any);
    this.name = name;

    // Set capabilities
    if (capabilities) {
      this.capabilities = {
        text: capabilities.text ?? true,
        images: capabilities.images ?? false,
        videos: capabilities.videos ?? false,
        audio: capabilities.audio ?? false,
      };
    } else {
      // Default generic capabilities
      this.capabilities = {
        text: true,
        images: false, // Conservative default
        videos: false,
        audio: false,
      };
    }
  }

  /**
   * Override model capabilities for generic providers
   * Can be customized per provider
   */
  getModelCapabilities(model: string): ModelCapabilities {
    // Check for vision in model name (heuristic)
    const hasVision =
      model.toLowerCase().includes('vision') ||
      model.toLowerCase().includes('llava') ||
      model.toLowerCase().includes('llama-3.2-90b'); // Llama 3.2 90B has vision

    // Check for large context models
    const isLargeContext =
      model.includes('128k') ||
      model.includes('200k') ||
      model.toLowerCase().includes('longtext');

    return {
      supportsTools: true, // Most OpenAI-compatible APIs support tools
      supportsVision: hasVision,
      supportsJSON: true, // Most support JSON mode
      supportsJSONSchema: false, // Conservative - not all support schema
      maxTokens: isLargeContext ? 128000 : 32000, // Conservative default
      maxOutputTokens: 4096, // Common default
    };
  }
}
