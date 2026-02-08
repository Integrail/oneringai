/**
 * Register multimedia tool factories with ConnectorTools
 *
 * Maps vendors to their supported multimedia capabilities and registers
 * composite factories that produce the appropriate tools for each vendor.
 */

import { ConnectorTools } from '../connector/ConnectorTools.js';
import { Vendor } from '../../core/Vendor.js';
import type { Connector } from '../../core/Connector.js';
import type { ToolFunction } from '../../domain/entities/Tool.js';
import type { IMediaStorage } from '../../domain/interfaces/IMediaStorage.js';
import { getMediaStorage } from './config.js';
import { createImageGenerationTool } from './imageGeneration.js';
import { createVideoTools } from './videoGeneration.js';
import { createTextToSpeechTool } from './textToSpeech.js';
import { createSpeechToTextTool } from './speechToText.js';

type Capability = 'image' | 'video' | 'tts' | 'stt';

/**
 * Vendor to capability mapping (single source of truth)
 * Matches createImageProvider/createVideoProvider/createTTSProvider/createSTTProvider
 */
const VENDOR_CAPABILITIES: Record<string, readonly Capability[]> = {
  [Vendor.OpenAI]: ['image', 'video', 'tts', 'stt'],
  [Vendor.Google]: ['image', 'video', 'tts'],
  [Vendor.Grok]: ['image', 'video'],
};

/**
 * Register multimedia tool factories for all supported vendors
 *
 * @param storage - Optional media storage override; defaults to global `getMediaStorage()`
 */
export function registerMultimediaTools(storage?: IMediaStorage): void {
  for (const [vendor, capabilities] of Object.entries(VENDOR_CAPABILITIES)) {
    ConnectorTools.registerService(vendor, (connector: Connector, _userId?: string) => {
      const handler = storage ?? getMediaStorage();
      const tools: ToolFunction[] = [];

      if (capabilities.includes('image')) {
        tools.push(createImageGenerationTool(connector, handler));
      }
      if (capabilities.includes('video')) {
        tools.push(...createVideoTools(connector, handler));
      }
      if (capabilities.includes('tts')) {
        tools.push(createTextToSpeechTool(connector, handler));
      }
      if (capabilities.includes('stt')) {
        tools.push(createSpeechToTextTool(connector, handler));
      }

      return tools;
    });
  }
}
