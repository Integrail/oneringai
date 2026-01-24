/**
 * Shared types used across all multimodal capabilities
 * This file provides the foundation for Image, Audio, and Video model registries
 */

import type { Vendor as VendorType } from '../../core/Vendor.js';

// =============================================================================
// Semantic Types - Normalized across vendors
// =============================================================================

/**
 * Aspect ratios - normalized across all visual modalities (images, video)
 */
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '3:2' | '2:3';

/**
 * Quality levels - normalized across vendors
 * Providers map these to vendor-specific quality settings
 */
export type QualityLevel = 'draft' | 'standard' | 'high' | 'ultra';

/**
 * Audio output formats
 */
export type AudioFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm' | 'ogg';

/**
 * Output format preference for media
 */
export type OutputFormat = 'url' | 'base64' | 'buffer';

// =============================================================================
// Model Registry Base Types
// =============================================================================

/**
 * Source links for model documentation and maintenance
 * Used to track where information came from and when it was last verified
 */
export interface ISourceLinks {
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
export interface VendorOptionSchema {
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
  min?: number;
  max?: number;
  default?: unknown;
}

/**
 * Base model description - shared by all registries
 * Every model registry (Image, TTS, STT, Video) extends this
 */
export interface IBaseModelDescription {
  /** Model identifier (e.g., "dall-e-3", "tts-1") */
  name: string;

  /** Display name for UI (e.g., "DALL-E 3", "TTS-1") */
  displayName: string;

  /** Vendor/provider */
  provider: VendorType;

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
