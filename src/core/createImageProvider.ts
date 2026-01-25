/**
 * Factory functions for creating image providers
 */

import { Connector } from './Connector.js';
import type { IImageProvider } from '../domain/interfaces/IImageProvider.js';
import { Vendor } from './Vendor.js';
import { OpenAIImageProvider } from '../infrastructure/providers/openai/OpenAIImageProvider.js';
import { GoogleImageProvider } from '../infrastructure/providers/google/GoogleImageProvider.js';
import type { OpenAIMediaConfig, GoogleConfig } from '../domain/types/ProviderConfig.js';

/**
 * Create an Image Generation provider from a connector
 */
export function createImageProvider(connector: Connector): IImageProvider {
  const vendor = connector.vendor;

  switch (vendor) {
    case Vendor.OpenAI:
      return new OpenAIImageProvider(extractOpenAIConfig(connector));

    case Vendor.Google:
      return new GoogleImageProvider(extractGoogleConfig(connector));

    default:
      throw new Error(
        `No Image provider available for vendor: ${vendor}. ` +
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
function extractGoogleConfig(connector: Connector): GoogleConfig {
  const auth = connector.config.auth;

  if (auth.type !== 'api_key') {
    throw new Error('Google requires API key authentication');
  }

  return {
    apiKey: auth.apiKey,
  };
}
