/**
 * Image generation tool factory
 *
 * Creates a `generate_image` ToolFunction that wraps ImageGeneration capability.
 * Parameters are built dynamically from the model registry for the connector's vendor.
 */

import type { Connector } from '../../core/Connector.js';
import type { ToolFunction } from '../../domain/entities/Tool.js';
import type { IMediaOutputHandler } from './IMediaOutputHandler.js';
import { getMediaOutputHandler } from './config.js';
import { ImageGeneration } from '../../capabilities/images/ImageGeneration.js';
import { getImageModelsByVendor, IMAGE_MODEL_REGISTRY } from '../../domain/entities/ImageModel.js';

interface GenerateImageArgs {
  prompt: string;
  model?: string;
  size?: string;
  quality?: string;
  style?: string;
  n?: number;
  aspectRatio?: string;
}

interface GenerateImageResult {
  success: boolean;
  images?: Array<{
    location: string;
    mimeType: string;
    revisedPrompt?: string;
  }>;
  error?: string;
}

export function createImageGenerationTool(
  connector: Connector,
  outputHandler?: IMediaOutputHandler
): ToolFunction<GenerateImageArgs, GenerateImageResult> {
  const vendor = connector.vendor;
  const handler = outputHandler ?? getMediaOutputHandler();

  // Build model enum from registry
  const vendorModels = vendor ? getImageModelsByVendor(vendor) : [];
  const modelNames = vendorModels.map((m) => m.name);

  // Build vendor-specific parameters
  const properties: Record<string, any> = {
    prompt: {
      type: 'string',
      description: 'Text description of the image to generate',
    },
  };

  if (modelNames.length > 0) {
    const descriptions = vendorModels
      .map((m) => `${m.name}: ${m.description || m.displayName}`)
      .join('; ');
    properties.model = {
      type: 'string',
      enum: modelNames,
      description: `Image model to use. Options: ${descriptions}`,
    };
  }

  // Size - available for OpenAI models
  const hasSizes = vendorModels.some((m) => m.capabilities.sizes.length > 1);
  if (hasSizes) {
    const allSizes = [...new Set(vendorModels.flatMap((m) => m.capabilities.sizes))];
    properties.size = {
      type: 'string',
      enum: allSizes,
      description: 'Image dimensions',
    };
  }

  // Aspect ratio - available for Google and Grok
  const hasAspectRatios = vendorModels.some((m) => m.capabilities.aspectRatios?.length);
  if (hasAspectRatios) {
    const allRatios = [...new Set(vendorModels.flatMap((m) => m.capabilities.aspectRatios ?? []))];
    properties.aspectRatio = {
      type: 'string',
      enum: allRatios,
      description: 'Image aspect ratio',
    };
  }

  // Quality - only for models that support it
  const hasQuality = vendorModels.some((m) => m.capabilities.features.qualityControl);
  if (hasQuality) {
    properties.quality = {
      type: 'string',
      enum: ['standard', 'hd'],
      description: 'Image quality level',
    };
  }

  // Style - only for models that support it (DALL-E 3)
  const hasStyle = vendorModels.some((m) => m.capabilities.features.styleControl);
  if (hasStyle) {
    properties.style = {
      type: 'string',
      enum: ['vivid', 'natural'],
      description: 'Image style (vivid for hyper-real, natural for less hyper-real)',
    };
  }

  // Number of images
  const maxN = Math.max(...vendorModels.map((m) => m.capabilities.maxImagesPerRequest));
  if (maxN > 1) {
    properties.n = {
      type: 'number',
      description: `Number of images to generate (1-${maxN})`,
      minimum: 1,
      maximum: maxN,
    };
  }

  return {
    definition: {
      type: 'function',
      function: {
        name: 'generate_image',
        description: `Generate images from text prompts using ${connector.displayName}`,
        parameters: {
          type: 'object',
          properties,
          required: ['prompt'],
        },
      },
    },

    execute: async (args: GenerateImageArgs): Promise<GenerateImageResult> => {
      try {
        const imageGen = ImageGeneration.create({ connector });
        const response = await imageGen.generate({
          prompt: args.prompt,
          model: args.model,
          size: args.size,
          quality: args.quality as 'standard' | 'hd' | undefined,
          style: args.style as 'vivid' | 'natural' | undefined,
          n: args.n,
          response_format: 'b64_json',
        });

        const images: GenerateImageResult['images'] = [];

        for (let i = 0; i < response.data.length; i++) {
          const item = response.data[i]!;
          let buffer: Buffer;

          if (item.b64_json) {
            buffer = Buffer.from(item.b64_json, 'base64');
          } else if (item.url) {
            // Fetch from URL if no base64
            const resp = await fetch(item.url);
            buffer = Buffer.from(await resp.arrayBuffer());
          } else {
            continue;
          }

          const modelName = args.model || modelNames[0] || 'unknown';
          const modelInfo = IMAGE_MODEL_REGISTRY[modelName];
          const format = modelInfo?.capabilities.outputFormats[0] === 'url' ? 'png' : (modelInfo?.capabilities.outputFormats[0] || 'png');

          const result = await handler.save(buffer, {
            type: 'image',
            format,
            model: modelName,
            vendor: vendor || 'unknown',
            index: response.data.length > 1 ? i : undefined,
          });

          images.push({
            location: result.location,
            mimeType: result.mimeType,
            revisedPrompt: item.revised_prompt,
          });
        }

        return { success: true, images };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    describeCall: (args: GenerateImageArgs) =>
      args.prompt.length > 50 ? args.prompt.slice(0, 47) + '...' : args.prompt,

    permission: {
      scope: 'session',
      riskLevel: 'medium',
      approvalMessage: `Generate image(s) using ${connector.displayName}`,
    },
  };
}
