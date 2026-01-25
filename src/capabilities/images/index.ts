/**
 * Images capability exports
 */

// Main capability class
export { ImageGeneration } from './ImageGeneration.js';
export type { ImageGenerationCreateOptions, SimpleGenerateOptions } from './ImageGeneration.js';

// Types from interfaces
export type {
  ImageGenerateOptions,
  ImageEditOptions,
  ImageVariationOptions,
  ImageResponse,
} from '../../domain/interfaces/IImageProvider.js';
