/**
 * Text-to-Speech model registry with comprehensive metadata
 */

import { Vendor } from '../../core/Vendor.js';
import type { IBaseModelDescription, AudioFormat, VendorOptionSchema } from '../types/SharedTypes.js';
import { createRegistryHelpers } from './RegistryUtils.js';
import { OPENAI_VOICES, GEMINI_VOICES, COMMON_LANGUAGES, AUDIO_FORMATS, type IVoiceInfo } from './SharedVoices.js';

// Re-export IVoiceInfo for public API
export type { IVoiceInfo } from './SharedVoices.js';

// =============================================================================
// Types
// =============================================================================

/**
 * TTS model capabilities
 */
export interface TTSModelCapabilities {
  /** Available voices (empty array means fetch dynamically via API) */
  voices: IVoiceInfo[];

  /** Supported output formats */
  formats: readonly AudioFormat[] | AudioFormat[];

  /** Supported languages (ISO-639-1 codes) */
  languages: readonly string[] | string[];

  /** Speed control support */
  speed: {
    supported: boolean;
    min?: number;
    max?: number;
    default?: number;
  };

  /** Feature support flags */
  features: {
    /** Real-time streaming support */
    streaming: boolean;
    /** SSML markup support */
    ssml: boolean;
    /** Emotion/style control */
    emotions: boolean;
    /** Custom voice cloning */
    voiceCloning: boolean;
    /** Word-level timestamps */
    wordTimestamps: boolean;
    /** Instruction steering (prompt-based style control) */
    instructionSteering?: boolean;
  };

  /** Model limits */
  limits: {
    /** Maximum input length in characters */
    maxInputLength: number;
    /** Rate limit (requests per minute) */
    maxRequestsPerMinute?: number;
  };

  /** Vendor-specific options schema */
  vendorOptions?: Record<string, VendorOptionSchema>;
}

/**
 * TTS model pricing
 */
export interface TTSModelPricing {
  /** Cost per 1,000 characters */
  per1kCharacters: number;
  currency: 'USD';
}

/**
 * Complete TTS model description
 */
export interface ITTSModelDescription extends IBaseModelDescription {
  capabilities: TTSModelCapabilities;
  pricing?: TTSModelPricing;
}

// =============================================================================
// Model Constants
// =============================================================================

export const TTS_MODELS = {
  [Vendor.OpenAI]: {
    /** NEW: Instruction-steerable TTS with emotional control */
    GPT_4O_MINI_TTS: 'gpt-4o-mini-tts',
    /** Fast, low-latency TTS */
    TTS_1: 'tts-1',
    /** High-definition TTS */
    TTS_1_HD: 'tts-1-hd',
  },
  [Vendor.Google]: {
    /** Gemini native TTS */
    GEMINI_TTS: 'gemini-tts',
  },
} as const;

// =============================================================================
// Shared Capability Presets (DRY)
// =============================================================================

/**
 * Base OpenAI TTS capabilities (shared across models)
 */
const OPENAI_TTS_BASE: Omit<TTSModelCapabilities, 'features' | 'limits'> = {
  voices: OPENAI_VOICES,
  formats: AUDIO_FORMATS.OPENAI_TTS,
  languages: COMMON_LANGUAGES.OPENAI_TTS,
  speed: { supported: true, min: 0.25, max: 4.0, default: 1.0 },
};

// =============================================================================
// Registry
// =============================================================================

/**
 * Complete TTS model registry
 * Last full audit: January 2026
 */
export const TTS_MODEL_REGISTRY: Record<string, ITTSModelDescription> = {
  // ======================== OpenAI ========================

  'gpt-4o-mini-tts': {
    name: 'gpt-4o-mini-tts',
    displayName: 'GPT-4o Mini TTS',
    provider: Vendor.OpenAI,
    description: 'Instruction-steerable TTS with emotional control via prompts',
    isActive: true,
    releaseDate: '2025-03-01',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/text-to-speech',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      ...OPENAI_TTS_BASE,
      features: {
        streaming: false, // Not implementing streaming in v1
        ssml: false,
        emotions: true, // Via instruction steering
        voiceCloning: true,
        wordTimestamps: false,
        instructionSteering: true,
      },
      limits: { maxInputLength: 2000 },
      vendorOptions: {
        instructions: {
          type: 'string',
          description: 'Natural language instructions for voice style (e.g., "speak like a calm meditation guide")',
        },
      },
    },
    pricing: { per1kCharacters: 0.015, currency: 'USD' },
  },

  'tts-1': {
    name: 'tts-1',
    displayName: 'TTS-1',
    provider: Vendor.OpenAI,
    description: 'Fast, low-latency text-to-speech optimized for real-time use',
    isActive: true,
    releaseDate: '2023-11-06',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/text-to-speech',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      ...OPENAI_TTS_BASE,
      features: {
        streaming: false, // Not implementing streaming in v1
        ssml: false,
        emotions: false,
        voiceCloning: false,
        wordTimestamps: false,
      },
      limits: { maxInputLength: 4096 },
    },
    pricing: { per1kCharacters: 0.015, currency: 'USD' },
  },

  'tts-1-hd': {
    name: 'tts-1-hd',
    displayName: 'TTS-1 HD',
    provider: Vendor.OpenAI,
    description: 'High-definition text-to-speech with improved audio quality',
    isActive: true,
    releaseDate: '2023-11-06',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/text-to-speech',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      ...OPENAI_TTS_BASE,
      features: {
        streaming: false, // Not implementing streaming in v1
        ssml: false,
        emotions: false,
        voiceCloning: false,
        wordTimestamps: false,
      },
      limits: { maxInputLength: 4096 },
    },
    pricing: { per1kCharacters: 0.030, currency: 'USD' },
  },

  // ======================== Google ========================

  'gemini-tts': {
    name: 'gemini-tts',
    displayName: 'Gemini TTS',
    provider: Vendor.Google,
    description: 'Google Gemini native text-to-speech',
    isActive: true,
    sources: {
      documentation: 'https://ai.google.dev/gemini-api/docs/text-to-speech',
      pricing: 'https://ai.google.dev/pricing',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      voices: GEMINI_VOICES,
      formats: AUDIO_FORMATS.GOOGLE_TTS,
      languages: COMMON_LANGUAGES.CORE,
      speed: { supported: true, min: 0.5, max: 2.0 },
      features: {
        streaming: false, // Not implementing streaming in v1
        ssml: false,
        emotions: false,
        voiceCloning: false,
        wordTimestamps: false,
      },
      limits: { maxInputLength: 8000 },
    },
  },
};

// =============================================================================
// Helper Functions (using shared utilities)
// =============================================================================

const helpers = createRegistryHelpers(TTS_MODEL_REGISTRY);

export const getTTSModelInfo = helpers.getInfo;
export const getTTSModelsByVendor = helpers.getByVendor;
export const getActiveTTSModels = helpers.getActive;

/**
 * Get TTS models that support a specific feature
 */
export function getTTSModelsWithFeature(
  feature: keyof ITTSModelDescription['capabilities']['features']
): ITTSModelDescription[] {
  return Object.values(TTS_MODEL_REGISTRY).filter(
    (model) => model.isActive && model.capabilities.features[feature]
  );
}

/**
 * Calculate estimated cost for TTS
 */
export function calculateTTSCost(modelName: string, characterCount: number): number | null {
  const model = getTTSModelInfo(modelName);
  if (!model?.pricing) return null;
  return (characterCount / 1000) * model.pricing.per1kCharacters;
}
