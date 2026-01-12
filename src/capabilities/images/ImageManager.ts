/**
 * Image generation manager
 *
 * Implements IDisposable for proper resource cleanup
 */

import { ProviderRegistry } from '../../client/ProviderRegistry.js';
import { IDisposable, assertNotDestroyed } from '../../domain/interfaces/IDisposable.js';
import {
  ImageGenerateOptions,
  ImageEditOptions,
  ImageVariationOptions,
  ImageResponse,
} from '../../domain/interfaces/IImageProvider.js';

export class ImageManager implements IDisposable {
  private _isDestroyed = false;

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  constructor(private registry: ProviderRegistry) {}

  /**
   * Generate images from text prompt
   */
  async generate(options: ImageGenerateOptions): Promise<ImageResponse> {
    assertNotDestroyed(this, 'generate image');

    const provider = await this.registry.getImageProvider(options.model.split('/')[0] || 'openai');
    return provider.generateImage(options);
  }

  /**
   * Edit an existing image
   */
  async edit(options: ImageEditOptions): Promise<ImageResponse> {
    assertNotDestroyed(this, 'edit image');

    const providerName = options.model.split('/')[0] || 'openai';
    const provider = await this.registry.getImageProvider(providerName);

    if (!provider.editImage) {
      throw new Error(`Provider ${providerName} does not support image editing`);
    }

    return provider.editImage(options);
  }

  /**
   * Create variations of an image
   */
  async createVariation(options: ImageVariationOptions): Promise<ImageResponse> {
    assertNotDestroyed(this, 'create image variation');

    const providerName = options.model.split('/')[0] || 'openai';
    const provider = await this.registry.getImageProvider(providerName);

    if (!provider.createVariation) {
      throw new Error(`Provider ${providerName} does not support image variations`);
    }

    return provider.createVariation(options);
  }

  /**
   * Destroy the manager and release resources
   * Safe to call multiple times (idempotent)
   */
  destroy(): void {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;
    // ImageManager has no internal resources to clean up
    // but follows the IDisposable pattern for consistency
  }
}
