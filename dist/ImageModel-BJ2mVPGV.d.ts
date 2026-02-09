import { c as IProvider, b as Connector } from './IProvider-DcYJ3YE-.js';
import { V as Vendor } from './Vendor-DYh_bzwo.js';

/**
 * Shared types used across all multimodal capabilities
 * This file provides the foundation for Image, Audio, and Video model registries
 */

/**
 * Aspect ratios - normalized across all visual modalities (images, video)
 */
type AspectRatio$1 = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '3:2' | '2:3';
/**
 * Quality levels - normalized across vendors
 * Providers map these to vendor-specific quality settings
 */
type QualityLevel = 'draft' | 'standard' | 'high' | 'ultra';
/**
 * Audio output formats
 */
type AudioFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm' | 'ogg';
/**
 * Output format preference for media
 */
type OutputFormat = 'url' | 'base64' | 'buffer';
/**
 * Source links for model documentation and maintenance
 * Used to track where information came from and when it was last verified
 */
interface ISourceLinks {
    /** Official documentation URL */
    documentation: string;
    /** Pricing page URL */
    pricing?: string;
    /** API reference URL */
    apiReference?: string;
    /** Additional reference (e.g., blog post, announcement) */
    additional?: string;
    /** Last verified date (YYYY-MM-DD) */
    lastVerified: string;
}
/**
 * Vendor-specific option schema for validation and documentation
 * Used to describe vendor-specific options that fall outside semantic options
 */
interface VendorOptionSchema {
    /** Data type of the option */
    type: 'string' | 'number' | 'boolean' | 'enum' | 'array';
    /** Description of the option */
    description: string;
    /** Whether the option is required */
    required?: boolean;
    /** UI display label */
    label?: string;
    /** Valid values for enum/string types */
    enum?: string[];
    /** Default value */
    default?: unknown;
    /** Minimum value for numbers */
    min?: number;
    /** Maximum value for numbers */
    max?: number;
    /** Step value for number sliders */
    step?: number;
    /** UI control type hint */
    controlType?: 'select' | 'radio' | 'slider' | 'checkbox' | 'text' | 'textarea';
}
/**
 * Base model description - shared by all registries
 * Every model registry (Image, TTS, STT, Video) extends this
 */
interface IBaseModelDescription {
    /** Model identifier (e.g., "dall-e-3", "tts-1") */
    name: string;
    /** Display name for UI (e.g., "DALL-E 3", "TTS-1") */
    displayName: string;
    /** Vendor/provider */
    provider: Vendor;
    /** Model description */
    description?: string;
    /** Whether the model is currently available */
    isActive: boolean;
    /** Release date (YYYY-MM-DD) */
    releaseDate?: string;
    /** Deprecation date if scheduled (YYYY-MM-DD) */
    deprecationDate?: string;
    /** Documentation/pricing links for maintenance */
    sources: ISourceLinks;
}

/**
 * Image generation provider interface
 */

interface ImageGenerateOptions {
    model: string;
    prompt: string;
    size?: string;
    aspectRatio?: string;
    quality?: 'standard' | 'hd' | 'low' | 'medium' | 'high' | 'auto';
    style?: 'vivid' | 'natural';
    n?: number;
    response_format?: 'url' | 'b64_json';
}
interface ImageEditOptions {
    model: string;
    image: Buffer | string;
    prompt: string;
    mask?: Buffer | string;
    size?: string;
    n?: number;
    response_format?: 'url' | 'b64_json';
}
interface ImageVariationOptions {
    model: string;
    image: Buffer | string;
    n?: number;
    size?: string;
    response_format?: 'url' | 'b64_json';
}
interface ImageResponse {
    created: number;
    data: Array<{
        url?: string;
        b64_json?: string;
        revised_prompt?: string;
    }>;
}
interface IImageProvider extends IProvider {
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

/**
 * Options for creating an ImageGeneration instance
 */
interface ImageGenerationCreateOptions {
    /** Connector name or instance */
    connector: string | Connector;
}
/**
 * Simplified options for quick generation
 */
interface SimpleGenerateOptions {
    /** Text prompt describing the image */
    prompt: string;
    /** Model to use (defaults to vendor's best model) */
    model?: string;
    /** Image size */
    size?: string;
    /** Quality setting */
    quality?: 'standard' | 'hd';
    /** Style setting (DALL-E 3 only) */
    style?: 'vivid' | 'natural';
    /** Number of images to generate */
    n?: number;
    /** Response format */
    response_format?: 'url' | 'b64_json';
}
/**
 * ImageGeneration capability class
 */
declare class ImageGeneration {
    private provider;
    private connector;
    private defaultModel;
    private constructor();
    /**
     * Create an ImageGeneration instance
     */
    static create(options: ImageGenerationCreateOptions): ImageGeneration;
    /**
     * Generate images from a text prompt
     */
    generate(options: SimpleGenerateOptions): Promise<ImageResponse>;
    /**
     * Edit an existing image
     * Note: Not all models/vendors support this
     */
    edit(options: ImageEditOptions): Promise<ImageResponse>;
    /**
     * Create variations of an existing image
     * Note: Only DALL-E 2 supports this
     */
    createVariation(options: ImageVariationOptions): Promise<ImageResponse>;
    /**
     * List available models for this provider
     */
    listModels(): Promise<string[]>;
    /**
     * Get information about a specific model
     */
    getModelInfo(modelName: string): IImageModelDescription | undefined;
    /**
     * Get the underlying provider
     */
    getProvider(): IImageProvider;
    /**
     * Get the current connector
     */
    getConnector(): Connector;
    /**
     * Get the default model for this vendor
     */
    private getDefaultModel;
    /**
     * Get the default edit model for this vendor
     */
    private getEditModel;
}

/**
 * Image generation model registry with comprehensive metadata
 */

/**
 * Supported image sizes by model
 */
type ImageSize = '256x256' | '512x512' | '1024x1024' | '1024x1536' | '1536x1024' | '1792x1024' | '1024x1792' | 'auto';
/**
 * Supported aspect ratios
 */
type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | '3:2' | '2:3';
/**
 * Image model capabilities
 */
interface ImageModelCapabilities {
    /** Supported image sizes */
    sizes: readonly ImageSize[];
    /** Supported aspect ratios (Google) */
    aspectRatios?: readonly AspectRatio[];
    /** Maximum number of images per request */
    maxImagesPerRequest: number;
    /** Supported output formats */
    outputFormats: readonly string[];
    /** Feature support flags */
    features: {
        /** Text-to-image generation */
        generation: boolean;
        /** Image editing/inpainting */
        editing: boolean;
        /** Image variations */
        variations: boolean;
        /** Style control */
        styleControl: boolean;
        /** Quality control (standard/hd) */
        qualityControl: boolean;
        /** Transparent backgrounds */
        transparency: boolean;
        /** Prompt revision/enhancement */
        promptRevision: boolean;
    };
    /** Model limits */
    limits: {
        /** Maximum prompt length in characters */
        maxPromptLength: number;
        /** Rate limit (requests per minute) */
        maxRequestsPerMinute?: number;
    };
    /** Vendor-specific options schema */
    vendorOptions?: Record<string, VendorOptionSchema>;
}
/**
 * Image model pricing
 */
interface ImageModelPricing {
    /** Cost per image at standard quality */
    perImageStandard?: number;
    /** Cost per image at HD quality */
    perImageHD?: number;
    /** Cost per image (flat rate) */
    perImage?: number;
    currency: 'USD';
}
/**
 * Complete image model description
 */
interface IImageModelDescription extends IBaseModelDescription {
    capabilities: ImageModelCapabilities;
    pricing?: ImageModelPricing;
}
declare const IMAGE_MODELS: {
    readonly openai: {
        /** GPT-Image-1: Latest OpenAI image model with best quality */
        readonly GPT_IMAGE_1: "gpt-image-1";
        /** DALL-E 3: High quality image generation */
        readonly DALL_E_3: "dall-e-3";
        /** DALL-E 2: Fast, supports editing and variations */
        readonly DALL_E_2: "dall-e-2";
    };
    readonly google: {
        /** Imagen 4.0: Latest Google image generation model */
        readonly IMAGEN_4_GENERATE: "imagen-4.0-generate-001";
        /** Imagen 4.0 Ultra: Highest quality */
        readonly IMAGEN_4_ULTRA: "imagen-4.0-ultra-generate-001";
        /** Imagen 4.0 Fast: Optimized for speed */
        readonly IMAGEN_4_FAST: "imagen-4.0-fast-generate-001";
    };
    readonly grok: {
        /** Grok Imagine Image: xAI image generation with editing support */
        readonly GROK_IMAGINE_IMAGE: "grok-imagine-image";
        /** Grok 2 Image: xAI image generation (text-only input) */
        readonly GROK_2_IMAGE_1212: "grok-2-image-1212";
    };
};
/**
 * Complete image model registry
 * Last full audit: January 2026
 */
declare const IMAGE_MODEL_REGISTRY: Record<string, IImageModelDescription>;
declare const getImageModelInfo: (modelName: string) => IImageModelDescription | undefined;
declare const getImageModelsByVendor: (vendor: Vendor) => IImageModelDescription[];
declare const getActiveImageModels: () => IImageModelDescription[];
/**
 * Get image models that support a specific feature
 */
declare function getImageModelsWithFeature(feature: keyof IImageModelDescription['capabilities']['features']): IImageModelDescription[];
/**
 * Calculate estimated cost for image generation
 */
declare function calculateImageCost(modelName: string, imageCount: number, quality?: 'standard' | 'hd'): number | null;

export { type AudioFormat as A, type IBaseModelDescription as I, type OutputFormat as O, type QualityLevel as Q, type SimpleGenerateOptions as S, type VendorOptionSchema as V, type IImageProvider as a, ImageGeneration as b, type ImageGenerationCreateOptions as c, type IImageModelDescription as d, type ImageModelCapabilities as e, type ImageModelPricing as f, IMAGE_MODELS as g, IMAGE_MODEL_REGISTRY as h, getImageModelInfo as i, getImageModelsByVendor as j, getActiveImageModels as k, getImageModelsWithFeature as l, calculateImageCost as m, type ImageGenerateOptions as n, type ImageEditOptions as o, type ImageVariationOptions as p, type ImageResponse as q, type AspectRatio$1 as r, type ISourceLinks as s };
