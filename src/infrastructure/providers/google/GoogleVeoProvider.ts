/**
 * Google Veo Video Generation Provider
 * Supports: veo-2.0, veo-3.0, veo-3.0-fast, veo-3.1
 */

import { GoogleGenAI } from '@google/genai';
import { BaseMediaProvider } from '../base/BaseMediaProvider.js';
import type {
  IVideoProvider,
  VideoGenerateOptions,
  VideoExtendOptions,
  VideoResponse,
  VideoStatus,
} from '../../../domain/interfaces/IVideoProvider.js';
import type { ProviderCapabilities } from '../../../domain/interfaces/IProvider.js';
import type { GoogleMediaConfig } from '../../../domain/types/ProviderConfig.js';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderError,
} from '../../../domain/errors/AIErrors.js';

/**
 * Google Veo-specific options
 */
export interface GoogleVeoOptions {
  /** Negative prompt (what to avoid) */
  negativePrompt?: string;
  /** Last frame image for interpolation */
  lastFrame?: Buffer | string;
  /** Person generation mode */
  personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all';
  /** Safety filter level */
  safetyFilterLevel?: 'block_low_and_above' | 'block_medium_and_above' | 'block_only_high';
}

export class GoogleVeoProvider extends BaseMediaProvider implements IVideoProvider {
  readonly name: string = 'google-video';
  readonly vendor = 'google' as const;
  readonly capabilities: ProviderCapabilities = {
    text: false,
    images: false,
    videos: true,
    audio: false,
    features: {
      videoGeneration: true,
      imageToVideo: true,
      videoExtension: true,
    },
  };

  private client: GoogleGenAI;
  private pendingOperations: Map<string, any> = new Map();

  constructor(config: GoogleMediaConfig) {
    super({ apiKey: config.auth.apiKey, ...config });

    this.client = new GoogleGenAI({
      apiKey: config.auth.apiKey,
    });
  }

  /**
   * Generate a video from a text prompt
   */
  async generateVideo(options: VideoGenerateOptions): Promise<VideoResponse> {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart('video.generate', {
            model: options.model,
            duration: options.duration,
            resolution: options.resolution,
          });

          const model = options.model || 'veo-3.1-generate-preview';
          const googleOptions = (options.vendorOptions || {}) as GoogleVeoOptions;

          // Build config
          const config: any = {};

          // Aspect ratio
          if (options.aspectRatio) {
            config.aspectRatio = options.aspectRatio;
          }

          // Resolution
          if (options.resolution) {
            config.resolution = options.resolution;
          }

          // Duration - must be a number, not string
          if (options.duration) {
            config.durationSeconds = options.duration;
          }

          // Seed
          if (options.seed !== undefined) {
            config.seed = options.seed;
          }

          // Negative prompt
          if (googleOptions.negativePrompt) {
            config.negativePrompt = googleOptions.negativePrompt;
          }

          // Person generation setting
          if (googleOptions.personGeneration) {
            config.personGeneration = googleOptions.personGeneration;
          }

          // Safety filter level
          if (googleOptions.safetyFilterLevel) {
            config.safetyFilterLevel = googleOptions.safetyFilterLevel;
          }

          // Build request
          const request: any = {
            model,
            prompt: options.prompt,
            config,
          };

          // Add image for image-to-video
          if (options.image) {
            request.image = await this.prepareImageInput(options.image);
          }

          // Add last frame if specified
          if (googleOptions.lastFrame) {
            request.lastFrame = await this.prepareImageInput(googleOptions.lastFrame);
          }

          // Start video generation (returns an operation)
          const operation = await (this.client.models as any).generateVideos(request);

          // Store operation for polling
          const jobId = this.extractJobId(operation);
          this.pendingOperations.set(jobId, operation);

          this.logOperationComplete('video.generate', {
            model,
            jobId,
            status: 'pending',
          });

          return {
            jobId,
            status: 'pending',
            created: Math.floor(Date.now() / 1000),
          };
        } catch (error: any) {
          this.handleError(error);
          throw error;
        }
      },
      'video.generate',
      { model: options.model }
    );
  }

  /**
   * Get the status of a video generation job
   */
  async getVideoStatus(jobId: string): Promise<VideoResponse> {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart('video.status', { jobId });

          // Get stored operation
          let operation = this.pendingOperations.get(jobId);

          if (!operation) {
            // Try to retrieve by operation name
            try {
              operation = await (this.client as any).operations.getVideosOperation({
                operation: { name: jobId },
              });
            } catch {
              throw new ProviderError('google', `Video job not found: ${jobId}`);
            }
          }

          // Poll for status update
          operation = await (this.client as any).operations.getVideosOperation({
            operation,
          });

          // Update stored operation
          this.pendingOperations.set(jobId, operation);

          const response = this.mapResponse(jobId, operation);

          this.logOperationComplete('video.status', {
            jobId,
            status: response.status,
          });

          // Clean up completed operations
          if (response.status === 'completed' || response.status === 'failed') {
            this.pendingOperations.delete(jobId);
          }

          return response;
        } catch (error: any) {
          if (error instanceof ProviderError) throw error;
          this.handleError(error);
          throw error;
        }
      },
      'video.status',
      { jobId }
    );
  }

  /**
   * Download a completed video
   */
  async downloadVideo(jobId: string): Promise<Buffer> {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart('video.download', { jobId });

          // Get status to ensure completion
          const status = await this.getVideoStatus(jobId);
          if (status.status !== 'completed') {
            throw new ProviderError('google', `Video not ready. Status: ${status.status}`);
          }

          // Get the operation
          const operation = this.pendingOperations.get(jobId);
          if (!operation?.response?.generatedVideos?.[0]?.video) {
            throw new ProviderError('google', 'No video available for download');
          }

          // Download using the files API
          const videoFile = operation.response.generatedVideos[0].video;
          const downloadResponse = await (this.client.files as any).download({
            file: videoFile,
          });

          let buffer: Buffer;
          if (downloadResponse instanceof Buffer) {
            buffer = downloadResponse;
          } else if (downloadResponse.data) {
            buffer = Buffer.from(downloadResponse.data);
          } else {
            throw new ProviderError('google', 'Unexpected download response format');
          }

          this.logOperationComplete('video.download', {
            jobId,
            size: buffer.length,
          });

          return buffer;
        } catch (error: any) {
          if (error instanceof ProviderError) throw error;
          this.handleError(error);
          throw error;
        }
      },
      'video.download',
      { jobId }
    );
  }

  /**
   * Extend an existing video (Veo 3.1 supports this)
   */
  async extendVideo(options: VideoExtendOptions): Promise<VideoResponse> {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart('video.extend', {
            model: options.model,
            extendDuration: options.extendDuration,
          });

          const model = options.model || 'veo-3.1-generate-preview';

          // Video extension in Veo is done by providing the last frame
          // of the existing video and generating a continuation
          const request: any = {
            model,
            prompt: options.prompt || 'Continue the video seamlessly',
            config: {
              durationSeconds: String(options.extendDuration),
            },
          };

          // Extract last frame from video or use video as input
          if (Buffer.isBuffer(options.video)) {
            // For buffer input, we'd need to extract the last frame
            // This is a simplified implementation
            request.image = {
              imageBytes: options.video.toString('base64'),
            };
          } else {
            request.video = { uri: options.video };
          }

          const operation = await (this.client.models as any).generateVideos(request);

          const jobId = this.extractJobId(operation);
          this.pendingOperations.set(jobId, operation);

          this.logOperationComplete('video.extend', {
            jobId,
            status: 'pending',
          });

          return {
            jobId,
            status: 'pending',
            created: Math.floor(Date.now() / 1000),
          };
        } catch (error: any) {
          this.handleError(error);
          throw error;
        }
      },
      'video.extend',
      { model: options.model }
    );
  }

  /**
   * List available video models
   */
  async listModels(): Promise<string[]> {
    return [
      'veo-2.0-generate-001',
      'veo-3-generate-preview',
      'veo-3.1-fast-generate-preview',
      'veo-3.1-generate-preview',
    ];
  }

  /**
   * Wait for video completion with polling
   */
  async waitForCompletion(jobId: string, timeoutMs: number = 600000): Promise<VideoResponse> {
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getVideoStatus(jobId);

      if (status.status === 'completed' || status.status === 'failed') {
        return status;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new ProviderError('google', `Video generation timed out after ${timeoutMs}ms`);
  }

  /**
   * Extract job ID from operation
   */
  private extractJobId(operation: any): string {
    if (operation.name) {
      return operation.name;
    }
    // Generate a unique ID if not available
    return `veo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Prepare image input for API
   */
  private async prepareImageInput(image: Buffer | string): Promise<any> {
    if (Buffer.isBuffer(image)) {
      return {
        imageBytes: image.toString('base64'),
      };
    }

    // Check if it's a URL or file path
    if (image.startsWith('http://') || image.startsWith('https://')) {
      return { imageUri: image };
    }

    // Read from file path
    const fs = await import('fs/promises');
    const data = await fs.readFile(image);
    return {
      imageBytes: data.toString('base64'),
    };
  }

  /**
   * Map operation to VideoResponse
   */
  private mapResponse(jobId: string, operation: any): VideoResponse {
    const result: VideoResponse = {
      jobId,
      status: this.mapStatus(operation),
      created: Math.floor(Date.now() / 1000),
    };

    if (operation.done && operation.response?.generatedVideos?.[0]) {
      const video = operation.response.generatedVideos[0];
      result.video = {
        duration: video.video?.duration,
        format: 'mp4',
      };

      // URL may be available through the file reference
      if (video.video?.uri) {
        result.video.url = video.video.uri;
      }
    }

    if (operation.error) {
      result.error = operation.error.message || 'Video generation failed';
      result.status = 'failed';
    }

    return result;
  }

  /**
   * Map operation status to our status type
   */
  private mapStatus(operation: any): VideoStatus {
    if (operation.error) {
      return 'failed';
    }
    if (operation.done) {
      return 'completed';
    }
    if (operation.metadata?.state === 'ACTIVE' || operation.metadata?.state === 'PROCESSING') {
      return 'processing';
    }
    return 'pending';
  }

  /**
   * Handle Google API errors
   */
  private handleError(error: any): never {
    const message = error.message || 'Unknown Google API error';
    const status = error.status || error.code;

    if (status === 401 || status === 403 || message.includes('API key')) {
      throw new ProviderAuthError('google', 'Invalid API key');
    }

    if (status === 429 || message.includes('quota') || message.includes('rate')) {
      throw new ProviderRateLimitError('google', message);
    }

    if (status === 400) {
      if (message.includes('safety') || message.includes('blocked')) {
        throw new ProviderError('google', `Content policy violation: ${message}`);
      }
      throw new ProviderError('google', `Bad request: ${message}`);
    }

    throw new ProviderError('google', message);
  }
}
