/**
 * Video generation tool factories
 *
 * Creates `generate_video` and `video_status` ToolFunctions
 * that wrap VideoGeneration capability. Video generation is async,
 * so two tools are needed: one to start and one to check status/download.
 */

import type { Connector } from '../../core/Connector.js';
import type { ToolFunction } from '../../domain/entities/Tool.js';
import type { IMediaStorage } from '../../domain/interfaces/IMediaStorage.js';
import { getMediaStorage } from './config.js';
import { VideoGeneration } from '../../capabilities/video/VideoGeneration.js';
import { getVideoModelsByVendor } from '../../domain/entities/VideoModel.js';

interface GenerateVideoArgs {
  prompt: string;
  model?: string;
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
  seed?: number;
}

interface GenerateVideoResult {
  success: boolean;
  jobId?: string;
  status?: string;
  error?: string;
}

interface VideoStatusArgs {
  jobId: string;
}

interface VideoStatusResult {
  success: boolean;
  status?: string;
  progress?: number;
  location?: string;
  mimeType?: string;
  error?: string;
}

// Shared map of VideoGeneration instances keyed by connector name
const videoGenInstances = new Map<string, VideoGeneration>();

export function createVideoTools(
  connector: Connector,
  storage?: IMediaStorage
): ToolFunction[] {
  const vendor = connector.vendor;
  const handler = storage ?? getMediaStorage();

  // Build model enum from registry
  const vendorModels = vendor ? getVideoModelsByVendor(vendor) : [];
  const modelNames = vendorModels.map((m) => m.name);

  // Build vendor-specific parameters for generate
  const generateProperties: Record<string, any> = {
    prompt: {
      type: 'string',
      description: 'Text description of the video to generate',
    },
  };

  if (modelNames.length > 0) {
    const descriptions = vendorModels
      .map((m) => `${m.name}: ${m.displayName}`)
      .join('; ');
    generateProperties.model = {
      type: 'string',
      enum: modelNames,
      description: `Video model to use. Options: ${descriptions}`,
    };
  }

  // Duration
  const allDurations = [...new Set(vendorModels.flatMap((m) => m.capabilities.durations))].sort(
    (a, b) => a - b
  );
  if (allDurations.length > 0) {
    generateProperties.duration = {
      type: 'number',
      description: `Video duration in seconds. Supported: ${allDurations.join(', ')}`,
    };
  }

  // Resolution
  const allResolutions = [...new Set(vendorModels.flatMap((m) => m.capabilities.resolutions))];
  if (allResolutions.length > 0) {
    generateProperties.resolution = {
      type: 'string',
      enum: allResolutions,
      description: 'Video resolution',
    };
  }

  // Aspect ratio
  const allAspectRatios = [
    ...new Set(vendorModels.flatMap((m) => m.capabilities.aspectRatios ?? [])),
  ];
  if (allAspectRatios.length > 0) {
    generateProperties.aspectRatio = {
      type: 'string',
      enum: allAspectRatios,
      description: 'Video aspect ratio',
    };
  }

  // Seed
  const hasSeed = vendorModels.some((m) => m.capabilities.features.seed);
  if (hasSeed) {
    generateProperties.seed = {
      type: 'number',
      description: 'Random seed for reproducible generation',
    };
  }

  const generateTool: ToolFunction<GenerateVideoArgs, GenerateVideoResult> = {
    definition: {
      type: 'function',
      function: {
        name: 'generate_video',
        description: `Start video generation from a text prompt using ${connector.displayName}. Returns a jobId to check status with video_status.`,
        parameters: {
          type: 'object',
          properties: generateProperties,
          required: ['prompt'],
        },
      },
    },

    execute: async (args: GenerateVideoArgs): Promise<GenerateVideoResult> => {
      try {
        const videoGen = VideoGeneration.create({ connector });
        // Store instance for status checks
        const response = await videoGen.generate({
          prompt: args.prompt,
          model: args.model,
          duration: args.duration,
          resolution: args.resolution,
          aspectRatio: args.aspectRatio as any,
          seed: args.seed,
        });

        // Store the instance keyed by jobId for later status/download
        videoGenInstances.set(response.jobId, videoGen);

        return {
          success: true,
          jobId: response.jobId,
          status: response.status,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    describeCall: (args: GenerateVideoArgs) =>
      args.prompt.length > 50 ? args.prompt.slice(0, 47) + '...' : args.prompt,

    permission: {
      scope: 'session',
      riskLevel: 'medium',
      approvalMessage: `Generate video using ${connector.displayName}`,
    },
  };

  const statusTool: ToolFunction<VideoStatusArgs, VideoStatusResult> = {
    definition: {
      type: 'function',
      function: {
        name: 'video_status',
        description:
          'Check the status of a video generation job. If completed, downloads and saves the video.',
        parameters: {
          type: 'object',
          properties: {
            jobId: {
              type: 'string',
              description: 'The job ID returned by generate_video',
            },
          },
          required: ['jobId'],
        },
      },
    },

    execute: async (args: VideoStatusArgs): Promise<VideoStatusResult> => {
      try {
        let videoGen = videoGenInstances.get(args.jobId);
        if (!videoGen) {
          // Recreate if not in cache (e.g., after restart)
          videoGen = VideoGeneration.create({ connector });
        }

        const status = await videoGen.getStatus(args.jobId);

        if (status.status === 'completed') {
          // Download and save
          let buffer: Buffer | undefined;

          if (status.video?.b64_json) {
            buffer = Buffer.from(status.video.b64_json, 'base64');
          } else if (status.video?.url) {
            const resp = await fetch(status.video.url);
            buffer = Buffer.from(await resp.arrayBuffer());
          } else if (videoGen.download) {
            try {
              buffer = await videoGen.download(args.jobId);
            } catch {
              // Download not supported - return status without file
            }
          }

          if (buffer) {
            const format = status.video?.format || 'mp4';
            const modelName = modelNames[0] || 'unknown';

            const result = await handler.save(buffer, {
              type: 'video',
              format,
              model: modelName,
              vendor: vendor || 'unknown',
            });

            // Clean up instance
            videoGenInstances.delete(args.jobId);

            return {
              success: true,
              status: 'completed',
              location: result.location,
              mimeType: result.mimeType,
            };
          }

          // No downloadable video data
          videoGenInstances.delete(args.jobId);
          return {
            success: true,
            status: 'completed',
            location: status.video?.url,
          };
        }

        if (status.status === 'failed') {
          videoGenInstances.delete(args.jobId);
          return {
            success: false,
            status: 'failed',
            error: status.error || 'Video generation failed',
          };
        }

        // Still processing
        return {
          success: true,
          status: status.status,
          progress: status.progress,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    describeCall: (args: VideoStatusArgs) => `job ${args.jobId}`,

    permission: {
      scope: 'session',
      riskLevel: 'low',
      approvalMessage: 'Check video generation status',
    },
  };

  return [generateTool, statusTool];
}
