/**
 * Provider Factory - creates the right provider from a Connector
 *
 * This is the bridge between Connectors and provider implementations.
 * It extracts credentials from the connector and instantiates the appropriate SDK.
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
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

// ---------------------------------------------------------------------------
// Vendor default base URLs — built once at module load from SDKs
// ---------------------------------------------------------------------------

/**
 * Immutable map of vendor → default API base URL, built at startup.
 * For OpenAI/Anthropic: reads from the installed SDK so we auto-track URL changes.
 * For OpenAI-compatible vendors: same URLs already in createProvider().
 * For Google/Vertex: stable API gateway endpoints.
 */
const VENDOR_DEFAULT_URLS: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();

  // Read from actual SDKs at startup
  try { map.set(Vendor.OpenAI, new OpenAI({ apiKey: '_' }).baseURL); } catch { /* SDK not installed */ }
  try { map.set(Vendor.Anthropic, new Anthropic({ apiKey: '_' }).baseURL); } catch { /* SDK not installed */ }

  // Google — SDKs don't expose a simple baseURL property
  map.set(Vendor.Google, 'https://generativelanguage.googleapis.com');
  map.set(Vendor.GoogleVertex, 'https://us-central1-aiplatform.googleapis.com');

  // OpenAI-compatible vendors — no dedicated SDKs
  map.set(Vendor.Groq, 'https://api.groq.com/openai/v1');
  map.set(Vendor.Together, 'https://api.together.xyz/v1');
  map.set(Vendor.Perplexity, 'https://api.perplexity.ai');
  map.set(Vendor.Grok, 'https://api.x.ai/v1');
  map.set(Vendor.DeepSeek, 'https://api.deepseek.com/v1');
  map.set(Vendor.Mistral, 'https://api.mistral.ai/v1');
  map.set(Vendor.Ollama, 'http://localhost:11434/v1');

  return map;
})();

/**
 * Get the default API base URL for a vendor.
 * For OpenAI/Anthropic reads from the installed SDK at runtime.
 * Returns undefined for Custom or unknown vendors.
 */
export function getVendorDefaultBaseURL(vendor: string): string | undefined {
  return VENDOR_DEFAULT_URLS.get(vendor);
}

/**
 * Create a text provider from a connector
 */
export function createProvider(connector: Connector): ITextProvider {
  // Allow injecting a provider directly for testing
  const injectedProvider = connector.getOptions().provider;
  if (injectedProvider && typeof (injectedProvider as any).generate === 'function') {
    return injectedProvider as ITextProvider;
  }

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
    case Vendor.Together:
    case Vendor.Perplexity:
    case Vendor.Grok:
    case Vendor.DeepSeek:
    case Vendor.Mistral:
    case Vendor.Ollama:
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL || getVendorDefaultBaseURL(vendor)!,
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
  } else if (auth.type === 'none') {
    // For testing/mock providers and local services like Ollama
    apiKey = 'mock-key';
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
