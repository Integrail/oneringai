/**
 * Speech-to-text tool factory
 *
 * Creates a `speech_to_text` ToolFunction that wraps SpeechToText capability.
 * Parameters are built dynamically from the STT model registry for the connector's vendor.
 */

import * as fs from 'fs/promises';
import type { Connector } from '../../core/Connector.js';
import type { ToolFunction } from '../../domain/entities/Tool.js';
import { SpeechToText } from '../../core/SpeechToText.js';
import { getSTTModelsByVendor } from '../../domain/entities/STTModel.js';

interface SpeechToTextArgs {
  audioFilePath: string;
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
  connector: Connector
): ToolFunction<SpeechToTextArgs, SpeechToTextResult> {
  const vendor = connector.vendor;

  // Build model enum from registry
  const vendorModels = vendor ? getSTTModelsByVendor(vendor) : [];
  const modelNames = vendorModels.map((m) => m.name);

  // Build parameters
  const properties: Record<string, any> = {
    audioFilePath: {
      type: 'string',
      description: 'Path to the audio file to transcribe',
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
          required: ['audioFilePath'],
        },
      },
    },

    execute: async (args: SpeechToTextArgs): Promise<SpeechToTextResult> => {
      try {
        const audioBuffer = await fs.readFile(args.audioFilePath);

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

    describeCall: (args: SpeechToTextArgs) => args.audioFilePath,

    permission: {
      scope: 'session',
      riskLevel: 'low',
      approvalMessage: `Transcribe audio using ${connector.displayName}`,
    },
  };
}
