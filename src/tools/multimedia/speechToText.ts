/**
 * Speech-to-text tool factory
 *
 * Creates a `speech_to_text` ToolFunction that wraps SpeechToText capability.
 * Parameters are built dynamically from the STT model registry for the connector's vendor.
 */

import type { Connector } from '../../core/Connector.js';
import type { ToolFunction } from '../../domain/entities/Tool.js';
import type { IMediaStorage } from '../../domain/interfaces/IMediaStorage.js';
import type { ToolContext } from '../../domain/interfaces/IToolContext.js';
import { getMediaStorage } from './config.js';
import { SpeechToText } from '../../core/SpeechToText.js';
import { getSTTModelsByVendor } from '../../domain/entities/STTModel.js';

interface SpeechToTextArgs {
  audioSource: string;
  model?: string;
  language?: string;
  prompt?: string;
}

interface SpeechToTextResult {
  success: boolean;
  text?: string;
  language?: string;
  durationSeconds?: number;
  error?: string;
}

export function createSpeechToTextTool(
  connector: Connector,
  storage?: IMediaStorage,
  _userId?: string
): ToolFunction<SpeechToTextArgs, SpeechToTextResult> {
  const vendor = connector.vendor;
  const handler = storage ?? getMediaStorage();

  // Build model enum from registry
  const vendorModels = vendor ? getSTTModelsByVendor(vendor) : [];
  const modelNames = vendorModels.map((m) => m.name);

  // Build parameters
  const properties: Record<string, any> = {
    audioSource: {
      type: 'string',
      description: 'Path or location of the audio file to transcribe (file path, storage location, etc.)',
    },
  };

  if (modelNames.length > 0) {
    const descriptions = vendorModels
      .map((m) => `${m.name}: ${m.description || m.displayName}`)
      .join('; ');
    properties.model = {
      type: 'string',
      enum: modelNames,
      description: `STT model to use. Options: ${descriptions}`,
    };
  }

  properties.language = {
    type: 'string',
    description: 'Language code (ISO-639-1, e.g., "en", "es", "fr"). Optional for auto-detection.',
  };

  properties.prompt = {
    type: 'string',
    description: 'Optional context hint to guide transcription (e.g., domain-specific terms)',
  };

  return {
    definition: {
      type: 'function',
      function: {
        name: 'speech_to_text',
        description: `Transcribe audio to text using ${connector.displayName}`,
        parameters: {
          type: 'object',
          properties,
          required: ['audioSource'],
        },
      },
    },

    execute: async (args: SpeechToTextArgs, _context?: ToolContext): Promise<SpeechToTextResult> => {
      try {
        const audioBuffer = await handler.read(args.audioSource);

        if (!audioBuffer) {
          return {
            success: false,
            error: `Audio not found at: ${args.audioSource}`,
          };
        }

        const stt = SpeechToText.create({
          connector,
          model: args.model,
          language: args.language,
        });

        const response = await stt.transcribe(audioBuffer, {
          prompt: args.prompt,
        });

        return {
          success: true,
          text: response.text,
          language: response.language,
          durationSeconds: response.durationSeconds,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    describeCall: (args: SpeechToTextArgs) => args.audioSource,

    permission: {
      scope: 'session',
      riskLevel: 'low',
      approvalMessage: `Transcribe audio using ${connector.displayName}`,
    },
  };
}
