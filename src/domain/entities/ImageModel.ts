/**
 * Image generation model registry with comprehensive metadata
 */

import { Vendor } from '../../core/Vendor.js';
import type { IBaseModelDescription, VendorOptionSchema } from '../types/SharedTypes.js';
import { createRegistryHelpers } from './RegistryUtils.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Supported image sizes by model
 */
export type ImageSize =
  | '256x256'
  | '512x512'
  | '1024x1024'
  | '1024x1536'
  | '1536x1024'
  | '1792x1024'
  | '1024x1792'
  | 'auto';

/**
 * Supported aspect ratios (Google Imagen)
 */
export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

/**
 * Image model capabilities
 */
export interface ImageModelCapabilities {
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
export interface ImageModelPricing {
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
export interface IImageModelDescription extends IBaseModelDescription {
  capabilities: ImageModelCapabilities;
  pricing?: ImageModelPricing;
}

// =============================================================================
// Model Constants
// =============================================================================

export const IMAGE_MODELS = {
  [Vendor.OpenAI]: {
    /** GPT-Image-1: Latest OpenAI image model with best quality */
    GPT_IMAGE_1: 'gpt-image-1',
    /** DALL-E 3: High quality image generation */
    DALL_E_3: 'dall-e-3',
    /** DALL-E 2: Fast, supports editing and variations */
    DALL_E_2: 'dall-e-2',
  },
  [Vendor.Google]: {
    /** Imagen 4.0: Latest Google image generation model */
    IMAGEN_4_GENERATE: 'imagen-4.0-generate-001',
    /** Imagen 4.0 Ultra: Highest quality */
    IMAGEN_4_ULTRA: 'imagen-4.0-ultra-generate-001',
    /** Imagen 4.0 Fast: Optimized for speed */
    IMAGEN_4_FAST: 'imagen-4.0-fast-generate-001',
  },
} as const;

// =============================================================================
// Registry
// =============================================================================

/**
 * Complete image model registry
 * Last full audit: January 2026
 */
export const IMAGE_MODEL_REGISTRY: Record<string, IImageModelDescription> = {
  // ======================== OpenAI ========================

  'gpt-image-1': {
    name: 'gpt-image-1',
    displayName: 'GPT-Image-1',
    provider: Vendor.OpenAI,
    description: 'OpenAI latest image generation model with best quality and features',
    isActive: true,
    releaseDate: '2025-04-01',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/images',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-25',
    },
    capabilities: {
      sizes: ['1024x1024', '1024x1536', '1536x1024', 'auto'],
      maxImagesPerRequest: 1,
      outputFormats: ['png', 'webp', 'jpeg'],
      features: {
        generation: true,
        editing: true,
        variations: false,
        styleControl: false,
        qualityControl: true,
        transparency: true,
        promptRevision: false,
      },
      limits: { maxPromptLength: 32000 },
      vendorOptions: {
        background: {
          type: 'string',
          description: 'Background setting: transparent, opaque, or auto',
        },
        output_format: {
          type: 'string',
          description: 'Output format: png, webp, or jpeg',
        },
      },
    },
    pricing: {
      perImageStandard: 0.011,
      perImageHD: 0.042,
      currency: 'USD',
    },
  },

  'dall-e-3': {
    name: 'dall-e-3',
    displayName: 'DALL-E 3',
    provider: Vendor.OpenAI,
    description: 'High quality image generation with prompt revision',
    isActive: true,
    releaseDate: '2023-11-06',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/images',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-25',
    },
    capabilities: {
      sizes: ['1024x1024', '1024x1792', '1792x1024'],
      maxImagesPerRequest: 1,
      outputFormats: ['png', 'url'],
      features: {
        generation: true,
        editing: false,
        variations: false,
        styleControl: true,
        qualityControl: true,
        transparency: false,
        promptRevision: true,
      },
      limits: { maxPromptLength: 4000 },
      vendorOptions: {
        style: {
          type: 'string',
          description: 'Style: vivid (hyper-real) or natural (more natural)',
        },
      },
    },
    pricing: {
      perImageStandard: 0.040,
      perImageHD: 0.080,
      currency: 'USD',
    },
  },

  'dall-e-2': {
    name: 'dall-e-2',
    displayName: 'DALL-E 2',
    provider: Vendor.OpenAI,
    description: 'Fast image generation with editing and variation support',
    isActive: true,
    releaseDate: '2022-11-03',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/images',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-25',
    },
    capabilities: {
      sizes: ['256x256', '512x512', '1024x1024'],
      maxImagesPerRequest: 10,
      outputFormats: ['png', 'url'],
      features: {
        generation: true,
        editing: true,
        variations: true,
        styleControl: false,
        qualityControl: false,
        transparency: false,
        promptRevision: false,
      },
      limits: { maxPromptLength: 1000 },
    },
    pricing: {
      perImage: 0.020,
      currency: 'USD',
    },
  },

  // ======================== Google ========================

  'imagen-4.0-generate-001': {
    name: 'imagen-4.0-generate-001',
    displayName: 'Imagen 4.0 Generate',
    provider: Vendor.Google,
    description: 'Google Imagen 4.0 - standard quality image generation',
    isActive: true,
    releaseDate: '2025-06-01',
    sources: {
      documentation: 'https://ai.google.dev/gemini-api/docs/imagen',
      pricing: 'https://ai.google.dev/pricing',
      lastVerified: '2026-01-25',
    },
    capabilities: {
      sizes: ['1024x1024'],
      aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
      maxImagesPerRequest: 4,
      outputFormats: ['png', 'jpeg'],
      features: {
        generation: true,
        editing: false,
        variations: false,
        styleControl: false,
        qualityControl: false,
        transparency: false,
        promptRevision: false,
      },
      limits: { maxPromptLength: 480 },
      vendorOptions: {
        negativePrompt: {
          type: 'string',
          description: 'Description of what to avoid in the image',
        },
        seed: {
          type: 'number',
          description: 'Random seed for reproducible generation',
        },
        aspectRatio: {
          type: 'string',
          description: 'Aspect ratio: 1:1, 3:4, 4:3, 9:16, or 16:9',
        },
      },
    },
    pricing: {
      perImage: 0.04,
      currency: 'USD',
    },
  },

  'imagen-4.0-ultra-generate-001': {
    name: 'imagen-4.0-ultra-generate-001',
    displayName: 'Imagen 4.0 Ultra',
    provider: Vendor.Google,
    description: 'Google Imagen 4.0 Ultra - highest quality image generation',
    isActive: true,
    releaseDate: '2025-06-01',
    sources: {
      documentation: 'https://ai.google.dev/gemini-api/docs/imagen',
      pricing: 'https://ai.google.dev/pricing',
      lastVerified: '2026-01-25',
    },
    capabilities: {
      sizes: ['1024x1024'],
      aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
      maxImagesPerRequest: 4,
      outputFormats: ['png', 'jpeg'],
      features: {
        generation: true,
        editing: false,
        variations: false,
        styleControl: false,
        qualityControl: true,
        transparency: false,
        promptRevision: false,
      },
      limits: { maxPromptLength: 480 },
    },
    pricing: {
      perImage: 0.08,
      currency: 'USD',
    },
  },

  'imagen-4.0-fast-generate-001': {
    name: 'imagen-4.0-fast-generate-001',
    displayName: 'Imagen 4.0 Fast',
    provider: Vendor.Google,
    description: 'Google Imagen 4.0 Fast - optimized for speed',
    isActive: true,
    releaseDate: '2025-06-01',
    sources: {
      documentation: 'https://ai.google.dev/gemini-api/docs/imagen',
      pricing: 'https://ai.google.dev/pricing',
      lastVerified: '2026-01-25',
    },
    capabilities: {
      sizes: ['1024x1024'],
      aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
      maxImagesPerRequest: 4,
      outputFormats: ['png', 'jpeg'],
      features: {
        generation: true,
        editing: false,
        variations: false,
        styleControl: false,
        qualityControl: false,
        transparency: false,
        promptRevision: false,
      },
      limits: { maxPromptLength: 480 },
    },
    pricing: {
      perImage: 0.02,
      currency: 'USD',
    },
  },
};

// =============================================================================
// Helper Functions (using shared utilities)
// =============================================================================

const helpers = createRegistryHelpers(IMAGE_MODEL_REGISTRY);

export const getImageModelInfo = helpers.getInfo;
export const getImageModelsByVendor = helpers.getByVendor;
export const getActiveImageModels = helpers.getActive;

/**
 * Get image models that support a specific feature
 */
export function getImageModelsWithFeature(
  feature: keyof IImageModelDescription['capabilities']['features']
): IImageModelDescription[] {
  return Object.values(IMAGE_MODEL_REGISTRY).filter(
    (model) => model.isActive && model.capabilities.features[feature]
  );
}

/**
 * Calculate estimated cost for image generation
 */
export function calculateImageCost(
  modelName: string,
  imageCount: number,
  quality: 'standard' | 'hd' = 'standard'
): number | null {
  const model = getImageModelInfo(modelName);
  if (!model?.pricing) return null;

  if (model.pricing.perImage) {
    return imageCount * model.pricing.perImage;
  }

  const pricePerImage =
    quality === 'hd' ? model.pricing.perImageHD : model.pricing.perImageStandard;

  if (!pricePerImage) return null;
  return imageCount * pricePerImage;
}
