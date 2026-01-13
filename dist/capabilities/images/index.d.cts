import { I as IDisposable, P as ProviderRegistry, a0 as ImageGenerateOptions, a3 as ImageResponse, a1 as ImageEditOptions, a2 as ImageVariationOptions } from '../../ProviderRegistry-_Vu3HZs_.cjs';

/**
 * Image generation manager
 *
 * Implements IDisposable for proper resource cleanup
 */

declare class ImageManager implements IDisposable {
    private registry;
    private _isDestroyed;
    get isDestroyed(): boolean;
    constructor(registry: ProviderRegistry);
    /**
     * Generate images from text prompt
     */
    generate(options: ImageGenerateOptions): Promise<ImageResponse>;
    /**
     * Edit an existing image
     */
    edit(options: ImageEditOptions): Promise<ImageResponse>;
    /**
     * Create variations of an image
     */
    createVariation(options: ImageVariationOptions): Promise<ImageResponse>;
    /**
     * Destroy the manager and release resources
     * Safe to call multiple times (idempotent)
     */
    destroy(): void;
}

export { ImageEditOptions, ImageGenerateOptions, ImageManager, ImageResponse, ImageVariationOptions };
