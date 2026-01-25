/**
 * Video generation provider interface
 */

import { IProvider } from './IProvider.js';

/**
 * Options for generating a video
 */
export interface VideoGenerateOptions {
  /** Model to use */
  model: string;
  /** Text prompt describing the video */
  prompt: string;
  /** Duration in seconds */
  duration?: number;
  /** Output resolution (e.g., '1280x720', '1920x1080') */
  resolution?: string;
  /** Aspect ratio (alternative to resolution) */
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  /** Reference image for image-to-video */
  image?: Buffer | string;
  /** Seed for reproducibility */
  seed?: number;
  /** Vendor-specific options */
  vendorOptions?: Record<string, unknown>;
}

/**
 * Options for extending an existing video
 */
export interface VideoExtendOptions {
  /** Model to use */
  model: string;
  /** The video to extend */
  video: Buffer | string;
  /** Optional prompt for the extension */
  prompt?: string;
  /** Duration to add in seconds */
  extendDuration: number;
  /** Extend from beginning or end */
  direction?: 'start' | 'end';
}

/**
 * Video generation status (for async operations)
 */
export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Video generation job
 */
export interface VideoJob {
  /** Job ID */
  id: string;
  /** Current status */
  status: VideoStatus;
  /** Timestamp when created */
  createdAt: number;
  /** Timestamp when completed (if applicable) */
  completedAt?: number;
  /** Error message if failed */
  error?: string;
  /** Progress percentage (0-100) */
  progress?: number;
}

/**
 * Video generation response
 */
export interface VideoResponse {
  /** Job ID for tracking */
  jobId: string;
  /** Current status */
  status: VideoStatus;
  /** Timestamp when created */
  created: number;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Generated video data (when complete) */
  video?: {
    /** URL to download the video (if available) */
    url?: string;
    /** Base64 encoded video data */
    b64_json?: string;
    /** Duration in seconds */
    duration?: number;
    /** Resolution */
    resolution?: string;
    /** Format (e.g., 'mp4', 'webm') */
    format?: string;
  };
  /** Audio track info (if separate) */
  audio?: {
    url?: string;
    b64_json?: string;
  };
  /** Error if failed */
  error?: string;
}

/**
 * Video provider interface
 */
export interface IVideoProvider extends IProvider {
  /**
   * Generate a video from a text prompt
   * Returns a job that can be polled for completion
   */
  generateVideo(options: VideoGenerateOptions): Promise<VideoResponse>;

  /**
   * Get the status of a video generation job
   */
  getVideoStatus(jobId: string): Promise<VideoResponse>;

  /**
   * Download a completed video
   */
  downloadVideo?(jobId: string): Promise<Buffer>;

  /**
   * Extend an existing video (optional)
   */
  extendVideo?(options: VideoExtendOptions): Promise<VideoResponse>;

  /**
   * List available video models
   */
  listModels?(): Promise<string[]>;

  /**
   * Cancel a pending video generation job
   */
  cancelJob?(jobId: string): Promise<boolean>;
}
