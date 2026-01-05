/**
 * Image generation manager
 */

import { ProviderRegistry } from '../../client/ProviderRegistry.js';
import {
  ImageGenerateOptions,
  ImageEditOptions,
  ImageVariationOptions,
  ImageResponse,
} from '../../domain/interfaces/IImageProvider.js';

export class ImageManager {
  constructor(private registry: ProviderRegistry) {}

  /**
   * Generate images from text prompt
   */
  async generate(options: ImageGenerateOptions): Promise<ImageResponse> {
    const provider = this.registry.getImageProvider(options.model.split('/')[0] || 'openai');
    return provider.generateImage(options);
  }

  /**
   * Edit an existing image
   */
  async edit(options: ImageEditOptions): Promise<ImageResponse> {
    const providerName = options.model.split('/')[0] || 'openai';
    const provider = this.registry.getImageProvider(providerName);

    if (!provider.editImage) {
      throw new Error(`Provider ${providerName} does not support image editing`);
    }

    return provider.editImage(options);
  }

  /**
   * Create variations of an image
   */
  async createVariation(options: ImageVariationOptions): Promise<ImageResponse> {
    const providerName = options.model.split('/')[0] || 'openai';
    const provider = this.registry.getImageProvider(providerName);

    if (!provider.createVariation) {
      throw new Error(`Provider ${providerName} does not support image variations`);
    }

    return provider.createVariation(options);
  }
}
