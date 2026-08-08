/**
 * Factory functions for creating audio providers (TTS and STT)
 */

import { Connector } from './Connector.js';
import type { ITextToSpeechProvider } from '../domain/interfaces/IAudioProvider.js';
import type { ISpeechToTextProvider } from '../domain/interfaces/IAudioProvider.js';
import { Vendor } from './Vendor.js';
import { OpenAITTSProvider } from '../infrastructure/providers/openai/OpenAITTSProvider.js';
import { OpenAISTTProvider } from '../infrastructure/providers/openai/OpenAISTTProvider.js';
import { GoogleTTSProvider } from '../infrastructure/providers/google/GoogleTTSProvider.js';
import { GoogleSTTProvider } from '../infrastructure/providers/google/GoogleSTTProvider.js';
import { GrokTTSProvider } from '../infrastructure/providers/grok/GrokTTSProvider.js';
import { GrokSTTProvider } from '../infrastructure/providers/grok/GrokSTTProvider.js';
import { extractOpenAICompatConfig, extractGoogleConfig, extractGrokMediaConfig } from './extractProviderConfig.js';

/**
 * Create a Text-to-Speech provider from a connector
 */
export function createTTSProvider(connector: Connector): ITextToSpeechProvider {
  const vendor = connector.vendor;

  switch (vendor) {
    case Vendor.OpenAI:
      return new OpenAITTSProvider(extractOpenAICompatConfig(connector, 'OpenAI'));

    case Vendor.Google:
      return new GoogleTTSProvider(extractGoogleConfig(connector));

    case Vendor.Grok:
      return new GrokTTSProvider(extractGrokMediaConfig(connector));

    default:
      throw new Error(
        `No TTS provider available for vendor: ${vendor}. ` +
        `Supported vendors: ${Vendor.OpenAI}, ${Vendor.Google}, ${Vendor.Grok}`
      );
  }
}

/**
 * Create a Speech-to-Text provider from a connector
 */
export function createSTTProvider(connector: Connector): ISpeechToTextProvider {
  const vendor = connector.vendor;

  switch (vendor) {
    case Vendor.OpenAI:
      return new OpenAISTTProvider(extractOpenAICompatConfig(connector, 'OpenAI'));

    case Vendor.Groq:
      // TODO: Implement GroqSTTProvider (Whisper on Groq)
      throw new Error(`Groq STT provider not yet implemented`);

    case Vendor.Google:
      return new GoogleSTTProvider(extractGoogleConfig(connector));

    case Vendor.Grok:
      return new GrokSTTProvider(extractGrokMediaConfig(connector));

    default:
      throw new Error(
        `No STT provider available for vendor: ${vendor}. ` +
        `Supported vendors: ${Vendor.OpenAI}, ${Vendor.Google}, ${Vendor.Grok}`
      );
  }
}
