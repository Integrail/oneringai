/**
 * Factory for creating video providers from connectors
 */

import { Connector } from './Connector.js';
import { Vendor } from './Vendor.js';
import type { IVideoProvider } from '../domain/interfaces/IVideoProvider.js';
import type { OpenAIMediaConfig, GoogleMediaConfig } from '../domain/types/ProviderConfig.js';
import { OpenAISoraProvider } from '../infrastructure/providers/openai/OpenAISoraProvider.js';
import { GoogleVeoProvider } from '../infrastructure/providers/google/GoogleVeoProvider.js';
/**
 * Create a video provider from a connector
 */
export function createVideoProvider(connector: Connector): IVideoProvider {
  const vendor = connector.vendor;

  switch (vendor) {
    case Vendor.OpenAI:
      return new OpenAISoraProvider(extractOpenAIConfig(connector));

    case Vendor.Google:
      return new GoogleVeoProvider(extractGoogleConfig(connector));

    default:
      throw new Error(
        `Video generation not supported for vendor: ${vendor}. ` +
          `Supported vendors: ${Vendor.OpenAI}, ${Vendor.Google}`
      );
  }
}

/**
 * Extract OpenAI configuration from connector
 */
function extractOpenAIConfig(connector: Connector): OpenAIMediaConfig {
  const auth = connector.config.auth;

  if (auth.type !== 'api_key') {
    throw new Error('OpenAI requires API key authentication');
  }

  const options = connector.getOptions();

  return {
    auth: {
      type: 'api_key',
      apiKey: auth.apiKey,
    },
    baseURL: connector.baseURL,
    organization: options.organization as string | undefined,
    timeout: options.timeout as number | undefined,
    maxRetries: options.maxRetries as number | undefined,
  };
}

/**
 * Extract Google configuration from connector
 */
function extractGoogleConfig(connector: Connector): GoogleMediaConfig {
  const auth = connector.config.auth;

  if (auth.type !== 'api_key') {
    throw new Error('Google requires API key authentication');
  }

  const options = connector.getOptions();

  return {
    auth: {
      type: 'api_key',
      apiKey: auth.apiKey,
    },
    timeout: options.timeout as number | undefined,
    maxRetries: options.maxRetries as number | undefined,
  };
}
