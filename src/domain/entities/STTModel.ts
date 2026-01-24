/**
 * Speech-to-Text model registry with comprehensive metadata
 */

import { Vendor } from '../../core/Vendor.js';
import type { IBaseModelDescription, VendorOptionSchema } from '../types/SharedTypes.js';
import { createRegistryHelpers } from './RegistryUtils.js';
import { AUDIO_FORMATS } from './SharedVoices.js';

// =============================================================================
// Types
// =============================================================================

/**
 * STT output format types
 */
export type STTOutputFormat = 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';

/**
 * STT model capabilities
 */
export interface STTModelCapabilities {
  /** Supported input audio formats */
  inputFormats: readonly string[] | string[];

  /** Supported output formats */
  outputFormats: STTOutputFormat[];

  /** Supported languages (empty = auto-detect all) */
  languages: string[];

  /** Timestamp support */
  timestamps: {
    supported: boolean;
    granularities?: ('word' | 'segment')[];
  };

  /** Feature support flags */
  features: {
    /** Translation to English */
    translation: boolean;
    /** Speaker identification */
    diarization: boolean;
    /** Real-time streaming (not implemented in v1) */
    streaming: boolean;
    /** Automatic punctuation */
    punctuation: boolean;
    /** Profanity filtering */
    profanityFilter: boolean;
  };

  /** Model limits */
  limits: {
    /** Maximum file size in MB */
    maxFileSizeMB: number;
    /** Maximum duration in seconds */
    maxDurationSeconds?: number;
  };

  /** Vendor-specific options schema */
  vendorOptions?: Record<string, VendorOptionSchema>;
}

/**
 * STT model pricing
 */
export interface STTModelPricing {
  /** Cost per minute of audio */
  perMinute: number;
  currency: 'USD';
}

/**
 * Complete STT model description
 */
export interface ISTTModelDescription extends IBaseModelDescription {
  capabilities: STTModelCapabilities;
  pricing?: STTModelPricing;
}

// =============================================================================
// Model Constants
// =============================================================================

export const STT_MODELS = {
  [Vendor.OpenAI]: {
    /** NEW: GPT-4o based transcription */
    GPT_4O_TRANSCRIBE: 'gpt-4o-transcribe',
    /** NEW: GPT-4o with speaker diarization */
    GPT_4O_TRANSCRIBE_DIARIZE: 'gpt-4o-transcribe-diarize',
    /** Classic Whisper */
    WHISPER_1: 'whisper-1',
  },
  [Vendor.Groq]: {
    /** Ultra-fast Whisper on Groq LPUs */
    WHISPER_LARGE_V3: 'whisper-large-v3',
    /** Faster English-only variant */
    DISTIL_WHISPER: 'distil-whisper-large-v3-en',
  },
} as const;

// =============================================================================
// Shared Capability Presets (DRY)
// =============================================================================

/**
 * Base Whisper capabilities (shared across OpenAI/Groq models)
 */
const WHISPER_BASE_CAPABILITIES: Omit<STTModelCapabilities, 'features' | 'limits'> = {
  inputFormats: AUDIO_FORMATS.STT_INPUT,
  outputFormats: ['json', 'text', 'srt', 'vtt', 'verbose_json'],
  languages: [], // Auto-detect, 50+ languages
  timestamps: { supported: true, granularities: ['word', 'segment'] },
};

// =============================================================================
// Registry
// =============================================================================

/**
 * Complete STT model registry
 * Last full audit: January 2026
 */
export const STT_MODEL_REGISTRY: Record<string, ISTTModelDescription> = {
  // ======================== OpenAI ========================

  'gpt-4o-transcribe': {
    name: 'gpt-4o-transcribe',
    displayName: 'GPT-4o Transcribe',
    provider: Vendor.OpenAI,
    description: 'GPT-4o based transcription with superior accuracy and context understanding',
    isActive: true,
    releaseDate: '2025-04-01',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/speech-to-text',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      ...WHISPER_BASE_CAPABILITIES,
      features: {
        translation: true,
        diarization: false,
        streaming: false, // Not implementing streaming in v1
        punctuation: true,
        profanityFilter: false,
      },
      limits: { maxFileSizeMB: 25, maxDurationSeconds: 7200 },
    },
    pricing: { perMinute: 0.006, currency: 'USD' },
  },

  'gpt-4o-transcribe-diarize': {
    name: 'gpt-4o-transcribe-diarize',
    displayName: 'GPT-4o Transcribe + Diarization',
    provider: Vendor.OpenAI,
    description: 'GPT-4o transcription with speaker identification',
    isActive: true,
    releaseDate: '2025-04-01',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/speech-to-text',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      ...WHISPER_BASE_CAPABILITIES,
      outputFormats: ['json', 'verbose_json'],
      features: {
        translation: true,
        diarization: true, // Built-in speaker identification
        streaming: false,
        punctuation: true,
        profanityFilter: false,
      },
      limits: { maxFileSizeMB: 25, maxDurationSeconds: 7200 },
      vendorOptions: {
        max_speakers: {
          type: 'number',
          description: 'Maximum number of speakers to detect',
          min: 2,
          max: 10,
          default: 4,
        },
      },
    },
    pricing: { perMinute: 0.012, currency: 'USD' }, // 2x for diarization
  },

  'whisper-1': {
    name: 'whisper-1',
    displayName: 'Whisper',
    provider: Vendor.OpenAI,
    description: "OpenAI's general-purpose speech recognition model",
    isActive: true,
    releaseDate: '2023-03-01',
    sources: {
      documentation: 'https://platform.openai.com/docs/guides/speech-to-text',
      pricing: 'https://openai.com/pricing',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      ...WHISPER_BASE_CAPABILITIES,
      inputFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'],
      features: {
        translation: true,
        diarization: false,
        streaming: false,
        punctuation: true,
        profanityFilter: false,
      },
      limits: { maxFileSizeMB: 25 },
    },
    pricing: { perMinute: 0.006, currency: 'USD' },
  },

  // ======================== Groq ========================

  'whisper-large-v3': {
    name: 'whisper-large-v3',
    displayName: 'Whisper Large v3 (Groq)',
    provider: Vendor.Groq,
    description: 'Ultra-fast Whisper on Groq LPUs - 12x cheaper than OpenAI',
    isActive: true,
    releaseDate: '2024-04-01',
    sources: {
      documentation: 'https://console.groq.com/docs/speech-text',
      pricing: 'https://groq.com/pricing/',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      ...WHISPER_BASE_CAPABILITIES,
      timestamps: { supported: true, granularities: ['segment'] },
      outputFormats: ['json', 'text', 'verbose_json'],
      features: {
        translation: true,
        diarization: false,
        streaming: false,
        punctuation: true,
        profanityFilter: false,
      },
      limits: { maxFileSizeMB: 25 },
    },
    pricing: { perMinute: 0.0005, currency: 'USD' }, // 12x cheaper!
  },

  'distil-whisper-large-v3-en': {
    name: 'distil-whisper-large-v3-en',
    displayName: 'Distil Whisper (Groq)',
    provider: Vendor.Groq,
    description: 'Faster English-only Whisper variant on Groq',
    isActive: true,
    releaseDate: '2024-04-01',
    sources: {
      documentation: 'https://console.groq.com/docs/speech-text',
      pricing: 'https://groq.com/pricing/',
      lastVerified: '2026-01-24',
    },
    capabilities: {
      inputFormats: AUDIO_FORMATS.STT_INPUT,
      outputFormats: ['json', 'text', 'verbose_json'],
      languages: ['en'], // English only
      timestamps: { supported: true, granularities: ['segment'] },
      features: {
        translation: false,
        diarization: false,
        streaming: false,
        punctuation: true,
        profanityFilter: false,
      },
      limits: { maxFileSizeMB: 25 },
    },
    pricing: { perMinute: 0.00033, currency: 'USD' },
  },
};

// =============================================================================
// Helper Functions (using shared utilities)
// =============================================================================

const helpers = createRegistryHelpers(STT_MODEL_REGISTRY);

export const getSTTModelInfo = helpers.getInfo;
export const getSTTModelsByVendor = helpers.getByVendor;
export const getActiveSTTModels = helpers.getActive;

/**
 * Get STT models that support a specific feature
 */
export function getSTTModelsWithFeature(
  feature: keyof ISTTModelDescription['capabilities']['features']
): ISTTModelDescription[] {
  return Object.values(STT_MODEL_REGISTRY).filter(
    (model) => model.isActive && model.capabilities.features[feature]
  );
}

/**
 * Calculate estimated cost for STT
 */
export function calculateSTTCost(modelName: string, durationSeconds: number): number | null {
  const model = getSTTModelInfo(modelName);
  if (!model?.pricing) return null;
  return (durationSeconds / 60) * model.pricing.perMinute;
}
