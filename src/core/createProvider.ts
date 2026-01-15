/**
 * Provider Factory - creates the right provider from a Connector
 *
 * This is the bridge between Connectors and provider implementations.
 * It extracts credentials from the connector and instantiates the appropriate SDK.
 */

import { Connector } from './Connector.js';
import { Vendor } from './Vendor.js';
import { ITextProvider } from '../domain/interfaces/ITextProvider.js';
import { ProviderConfig } from '../domain/types/ProviderConfig.js';

// Import providers
import { OpenAITextProvider } from '../infrastructure/providers/openai/OpenAITextProvider.js';
import { AnthropicTextProvider } from '../infrastructure/providers/anthropic/AnthropicTextProvider.js';
import { GoogleTextProvider } from '../infrastructure/providers/google/GoogleTextProvider.js';
import { VertexAITextProvider } from '../infrastructure/providers/vertex/VertexAITextProvider.js';
import { GenericOpenAIProvider } from '../infrastructure/providers/generic/GenericOpenAIProvider.js';

/**
 * Create a text provider from a connector
 */
export function createProvider(connector: Connector): ITextProvider {
  const vendor = connector.vendor;

  if (!vendor) {
    throw new Error(
      `Connector '${connector.name}' has no vendor specified. ` +
        `Set vendor to create an AI provider.`
    );
  }

  // Extract config from connector
  const config = extractProviderConfig(connector);

  switch (vendor) {
    case Vendor.OpenAI:
      return new OpenAITextProvider({
        ...config,
        organization: connector.getOptions().organization as string | undefined,
        project: connector.getOptions().project as string | undefined,
      });

    case Vendor.Anthropic:
      return new AnthropicTextProvider({
        ...config,
        anthropicVersion: connector.getOptions().anthropicVersion as string | undefined,
      });

    case Vendor.Google:
      return new GoogleTextProvider(config);

    case Vendor.GoogleVertex:
      return new VertexAITextProvider({
        ...config,
        projectId: connector.getOptions().projectId as string || '',
        location: connector.getOptions().location as string || 'us-central1',
      });

    // OpenAI-compatible providers (use connector.name for unique identification)
    case Vendor.Groq:
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL || 'https://api.groq.com/openai/v1',
      });

    case Vendor.Together:
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL || 'https://api.together.xyz/v1',
      });

    case Vendor.Perplexity:
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL || 'https://api.perplexity.ai',
      });

    case Vendor.Grok:
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL || 'https://api.x.ai/v1',
      });

    case Vendor.DeepSeek:
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL || 'https://api.deepseek.com/v1',
      });

    case Vendor.Mistral:
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL || 'https://api.mistral.ai/v1',
      });

    case Vendor.Ollama:
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL || 'http://localhost:11434/v1',
      });

    case Vendor.Custom:
      if (!config.baseURL) {
        throw new Error(
          `Connector '${connector.name}' with Custom vendor requires baseURL`
        );
      }
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL,
      });

    default:
      throw new Error(`Unknown vendor: ${vendor}`);
  }
}

/**
 * Extract ProviderConfig from a Connector
 */
function extractProviderConfig(connector: Connector): ProviderConfig {
  const auth = connector.config.auth;

  // Get API key based on auth type
  let apiKey: string;

  if (auth.type === 'api_key') {
    apiKey = auth.apiKey;
  } else if (auth.type === 'oauth') {
    // For OAuth, we'd need to get the token asynchronously
    // For now, throw an error - OAuth providers need special handling
    throw new Error(
      `Connector '${connector.name}' uses OAuth. ` +
        `Call connector.getToken() to get the access token first.`
    );
  } else if (auth.type === 'jwt') {
    throw new Error(
      `Connector '${connector.name}' uses JWT auth. ` +
        `JWT auth for AI providers is not yet supported.`
    );
  } else {
    throw new Error(`Unknown auth type for connector '${connector.name}'`);
  }

  return {
    apiKey,
    baseURL: connector.config.baseURL,
    timeout: connector.getOptions().timeout as number | undefined,
    maxRetries: connector.getOptions().maxRetries as number | undefined,
  };
}

/**
 * Create a text provider from a Connector with async token support
 * Use this for OAuth connectors
 */
export async function createProviderAsync(
  connector: Connector,
  userId?: string
): Promise<ITextProvider> {
  const auth = connector.config.auth;

  // For API key auth, use sync version
  if (auth.type === 'api_key') {
    return createProvider(connector);
  }

  // For OAuth, get the token first
  const token = await connector.getToken(userId);

  // Create a temporary config with the token as API key
  // (Most providers accept Bearer tokens the same way as API keys)
  const tempConnector = {
    ...connector,
    config: {
      ...connector.config,
      auth: {
        type: 'api_key' as const,
        apiKey: token,
      },
    },
  } as Connector;

  return createProvider(tempConnector);
}
