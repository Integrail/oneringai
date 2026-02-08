/**
 * Text-to-speech tool factory
 *
 * Creates a `text_to_speech` ToolFunction that wraps TextToSpeech capability.
 * Parameters are built dynamically from the TTS model registry for the connector's vendor.
 */

import type { Connector } from '../../core/Connector.js';
import type { ToolFunction } from '../../domain/entities/Tool.js';
import type { IMediaStorage } from '../../domain/interfaces/IMediaStorage.js';
import { getMediaStorage } from './config.js';
import { TextToSpeech } from '../../core/TextToSpeech.js';
import { getTTSModelsByVendor } from '../../domain/entities/TTSModel.js';

interface TextToSpeechArgs {
  text: string;
  model?: string;
  voice?: string;
  format?: string;
  speed?: number;
}

interface TextToSpeechResult {
  success: boolean;
  location?: string;
  format?: string;
  mimeType?: string;
  error?: string;
}

export function createTextToSpeechTool(
  connector: Connector,
  storage?: IMediaStorage
): ToolFunction<TextToSpeechArgs, TextToSpeechResult> {
  const vendor = connector.vendor;
  const handler = storage ?? getMediaStorage();

  // Build model enum from registry
  const vendorModels = vendor ? getTTSModelsByVendor(vendor) : [];
  const modelNames = vendorModels.map((m) => m.name);

  // Build parameters
  const properties: Record<string, any> = {
    text: {
      type: 'string',
      description: 'Text to convert to speech',
    },
  };

  if (modelNames.length > 0) {
    const descriptions = vendorModels
      .map((m) => `${m.name}: ${m.description || m.displayName}`)
      .join('; ');
    properties.model = {
      type: 'string',
      enum: modelNames,
      description: `TTS model to use. Options: ${descriptions}`,
    };
  }

  // Voices - collect unique voices across all models
  const allVoices = [
    ...new Map(
      vendorModels
        .flatMap((m) => m.capabilities.voices)
        .map((v) => [v.id, v])
    ).values(),
  ];

  if (allVoices.length > 0) {
    const voiceDescriptions = allVoices
      .slice(0, 10) // Limit to avoid overly long descriptions
      .map((v) => `${v.id}${v.name !== v.id ? ` (${v.name})` : ''}`)
      .join(', ');
    properties.voice = {
      type: 'string',
      enum: allVoices.map((v) => v.id),
      description: `Voice to use. Options include: ${voiceDescriptions}${allVoices.length > 10 ? `, and ${allVoices.length - 10} more` : ''}`,
    };
  }

  // Audio formats
  const allFormats = [...new Set(vendorModels.flatMap((m) => [...m.capabilities.formats]))];
  if (allFormats.length > 0) {
    properties.format = {
      type: 'string',
      enum: allFormats,
      description: `Output audio format: ${allFormats.join(', ')}`,
    };
  }

  // Speed control
  const hasSpeed = vendorModels.some((m) => m.capabilities.speed.supported);
  if (hasSpeed) {
    const speedModel = vendorModels.find((m) => m.capabilities.speed.supported);
    properties.speed = {
      type: 'number',
      description: `Speech speed (${speedModel?.capabilities.speed.min ?? 0.25} to ${speedModel?.capabilities.speed.max ?? 4.0})`,
      minimum: speedModel?.capabilities.speed.min ?? 0.25,
      maximum: speedModel?.capabilities.speed.max ?? 4.0,
    };
  }

  return {
    definition: {
      type: 'function',
      function: {
        name: 'text_to_speech',
        description: `Convert text to speech audio using ${connector.displayName}`,
        parameters: {
          type: 'object',
          properties,
          required: ['text'],
        },
      },
    },

    execute: async (args: TextToSpeechArgs): Promise<TextToSpeechResult> => {
      try {
        const tts = TextToSpeech.create({
          connector,
          model: args.model,
          voice: args.voice,
          format: args.format as any,
          speed: args.speed,
        });

        const response = await tts.synthesize(args.text);
        const format = response.format || args.format || 'mp3';

        const result = await handler.save(response.audio, {
          type: 'audio',
          format,
          model: args.model || modelNames[0] || 'unknown',
          vendor: vendor || 'unknown',
        });

        return {
          success: true,
          location: result.location,
          format,
          mimeType: result.mimeType,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    describeCall: (args: TextToSpeechArgs) =>
      args.text.length > 50 ? args.text.slice(0, 47) + '...' : args.text,

    permission: {
      scope: 'session',
      riskLevel: 'medium',
      approvalMessage: `Convert text to speech using ${connector.displayName}`,
    },
  };
}
