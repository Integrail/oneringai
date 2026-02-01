/**
 * Image generation provider interface
 */

import { IProvider } from './IProvider.js';

export interface ImageGenerateOptions {
  model: string;
  prompt: string;
  size?: string;
  aspectRatio?: string; // e.g., '16:9', '4:3' - used by xAI and Google
  quality?: 'standard' | 'hd' | 'low' | 'medium' | 'high' | 'auto';
  style?: 'vivid' | 'natural';
  n?: number; // Number of images to generate
  response_format?: 'url' | 'b64_json';
}

export interface ImageEditOptions {
  model: string;
  image: Buffer | string; // Buffer or file path
  prompt: string;
  mask?: Buffer | string;
  size?: string;
  n?: number;
  response_format?: 'url' | 'b64_json';
}

export interface ImageVariationOptions {
  model: string;
  image: Buffer | string;
  n?: number;
  size?: string;
  response_format?: 'url' | 'b64_json';
}

export interface ImageResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

export interface IImageProvider extends IProvider {
  /**
   * Generate images from text prompt
   */
  generateImage(options: ImageGenerateOptions): Promise<ImageResponse>;

  /**
   * Edit an existing image (optional - not all providers support)
   */
  editImage?(options: ImageEditOptions): Promise<ImageResponse>;

  /**
   * Create variations of an image (optional)
   */
  createVariation?(options: ImageVariationOptions): Promise<ImageResponse>;

  /**
   * List available models
   */
  listModels?(): Promise<string[]>;
}
