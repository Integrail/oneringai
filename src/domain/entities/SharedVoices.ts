/**
 * Shared voice definitions and language constants
 * Eliminates duplication across TTS model registries
 */

/**
 * Voice information structure
 * Used consistently across all TTS providers
 */
export interface IVoiceInfo {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  style?: string;
  previewUrl?: string;
  isDefault?: boolean;
  accent?: string;
  age?: 'child' | 'young' | 'adult' | 'senior';
}

// =============================================================================
// Voice Definitions
// =============================================================================

/**
 * OpenAI TTS voices (shared across tts-1, tts-1-hd, gpt-4o-mini-tts)
 * Source: https://platform.openai.com/docs/guides/text-to-speech
 * Note: 'multi' language means the voice supports multiple languages
 * Last verified: 2026-01-24
 */
export const OPENAI_VOICES: IVoiceInfo[] = [
  { id: 'alloy', name: 'Alloy', language: 'multi', gender: 'neutral', isDefault: true },
  { id: 'ash', name: 'Ash', language: 'multi', gender: 'male' },
  { id: 'ballad', name: 'Ballad', language: 'multi', gender: 'male' },
  { id: 'coral', name: 'Coral', language: 'multi', gender: 'female' },
  { id: 'echo', name: 'Echo', language: 'multi', gender: 'male' },
  { id: 'fable', name: 'Fable', language: 'multi', gender: 'neutral', accent: 'british' },
  { id: 'nova', name: 'Nova', language: 'multi', gender: 'female' },
  { id: 'onyx', name: 'Onyx', language: 'multi', gender: 'male' },
  { id: 'sage', name: 'Sage', language: 'multi', gender: 'female' },
  { id: 'shimmer', name: 'Shimmer', language: 'multi', gender: 'female' },
  { id: 'verse', name: 'Verse', language: 'multi', gender: 'neutral' },
  { id: 'marin', name: 'Marin', language: 'multi', gender: 'female' },
  { id: 'cedar', name: 'Cedar', language: 'multi', gender: 'male' },
];

/**
 * Google Gemini TTS voices (30 total)
 * Source: https://ai.google.dev/gemini-api/docs/speech-generation
 * Last verified: 2026-01-25
 */
export const GEMINI_VOICES: IVoiceInfo[] = [
  // Default voice
  { id: 'Kore', name: 'Kore', language: 'multi', gender: 'female', isDefault: true },
  // Primary voices
  { id: 'Puck', name: 'Puck', language: 'multi', gender: 'neutral' },
  { id: 'Charon', name: 'Charon', language: 'multi', gender: 'male' },
  { id: 'Fenrir', name: 'Fenrir', language: 'multi', gender: 'male' },
  { id: 'Zephyr', name: 'Zephyr', language: 'multi', gender: 'neutral' },
  { id: 'Leda', name: 'Leda', language: 'multi', gender: 'female' },
  { id: 'Orus', name: 'Orus', language: 'multi', gender: 'male' },
  { id: 'Aoede', name: 'Aoede', language: 'multi', gender: 'female' },
  // Extended voices (celestial/astronomical naming)
  { id: 'Callirrhoe', name: 'Callirrhoe', language: 'multi', gender: 'female' },
  { id: 'Autonoe', name: 'Autonoe', language: 'multi', gender: 'female' },
  { id: 'Enceladus', name: 'Enceladus', language: 'multi', gender: 'male' },
  { id: 'Iapetus', name: 'Iapetus', language: 'multi', gender: 'male' },
  { id: 'Umbriel', name: 'Umbriel', language: 'multi', gender: 'neutral' },
  { id: 'Algieba', name: 'Algieba', language: 'multi', gender: 'male' },
  { id: 'Despina', name: 'Despina', language: 'multi', gender: 'female' },
  { id: 'Erinome', name: 'Erinome', language: 'multi', gender: 'female' },
  { id: 'Algenib', name: 'Algenib', language: 'multi', gender: 'male' },
  { id: 'Rasalgethi', name: 'Rasalgethi', language: 'multi', gender: 'male' },
  { id: 'Laomedeia', name: 'Laomedeia', language: 'multi', gender: 'female' },
  { id: 'Achernar', name: 'Achernar', language: 'multi', gender: 'male' },
  { id: 'Alnilam', name: 'Alnilam', language: 'multi', gender: 'male' },
  { id: 'Schedar', name: 'Schedar', language: 'multi', gender: 'female' },
  { id: 'Gacrux', name: 'Gacrux', language: 'multi', gender: 'male' },
  { id: 'Pulcherrima', name: 'Pulcherrima', language: 'multi', gender: 'female' },
  { id: 'Achird', name: 'Achird', language: 'multi', gender: 'male' },
  { id: 'Zubenelgenubi', name: 'Zubenelgenubi', language: 'multi', gender: 'male' },
  { id: 'Vindemiatrix', name: 'Vindemiatrix', language: 'multi', gender: 'female' },
  { id: 'Sadachbia', name: 'Sadachbia', language: 'multi', gender: 'male' },
  { id: 'Sadaltager', name: 'Sadaltager', language: 'multi', gender: 'male' },
  { id: 'Sulafat', name: 'Sulafat', language: 'multi', gender: 'female' },
];

/**
 * Google Gemini TTS supported languages (24)
 * Source: https://ai.google.dev/gemini-api/docs/speech-generation
 */
export const GEMINI_TTS_LANGUAGES = [
  'ar-EG',  // Arabic (Egyptian)
  'bn',     // Bengali
  'de-DE',  // German (Germany)
  'en-US',  // English (US)
  'en-IN',  // English (India)
  'es',     // Spanish
  'fr-FR',  // French (France)
  'hi',     // Hindi
  'id',     // Indonesian
  'it',     // Italian
  'ja',     // Japanese
  'ko',     // Korean
  'mr',     // Marathi
  'nl',     // Dutch
  'pl',     // Polish
  'pt-BR',  // Portuguese (Brazil)
  'ro',     // Romanian
  'ru',     // Russian
  'ta',     // Tamil
  'te',     // Telugu
  'th',     // Thai
  'tr',     // Turkish
  'uk',     // Ukrainian
  'vi',     // Vietnamese
] as const;

// =============================================================================
// Language Constants
// =============================================================================

/**
 * Common language codes (ISO-639-1) supported by multiple vendors
 * Centralized to avoid duplication in model registries
 */
export const COMMON_LANGUAGES = {
  /**
   * Languages supported by OpenAI TTS models (50+)
   * Source: https://platform.openai.com/docs/guides/text-to-speech
   */
  OPENAI_TTS: [
    'en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi',
    'nl', 'sv', 'tr', 'af', 'hy', 'az', 'be', 'bs', 'bg', 'ca', 'hr', 'cs', 'da',
    'et', 'fi', 'gl', 'el', 'he', 'hu', 'is', 'id', 'lv', 'lt', 'mk', 'ms', 'mi',
    'ne', 'no', 'fa', 'ro', 'sr', 'sk', 'sl', 'sw', 'tl', 'ta', 'th', 'uk', 'ur',
    'vi', 'cy',
  ] as const,

  /**
   * Core languages supported by most vendors
   */
  CORE: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru', 'ar', 'hi'] as const,

  /**
   * ElevenLabs supported languages
   * Source: https://elevenlabs.io/docs
   */
  ELEVENLABS: [
    'en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi',
    'nl', 'sv', 'tr', 'cs', 'da', 'fi', 'el', 'he', 'hu', 'id', 'ms', 'no', 'ro',
    'sk', 'th', 'uk', 'vi',
  ] as const,

  /**
   * AssemblyAI Universal model languages
   * Source: https://www.assemblyai.com/docs
   */
  ASSEMBLYAI: [
    'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ja', 'ko', 'zh',
    'ru', 'ar', 'hi', 'pl', 'tr', 'uk', 'vi',
  ] as const,
} as const;

// =============================================================================
// Audio Format Constants
// =============================================================================

/**
 * Common audio formats by use case
 */
export const AUDIO_FORMATS = {
  /**
   * OpenAI TTS output formats
   * Source: https://platform.openai.com/docs/guides/text-to-speech
   */
  OPENAI_TTS: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'] as const,

  /**
   * ElevenLabs output formats
   */
  ELEVENLABS: ['mp3', 'pcm', 'ogg', 'wav'] as const,

  /**
   * Google TTS output formats
   */
  GOOGLE_TTS: ['mp3', 'wav', 'ogg'] as const,

  /**
   * Common STT input formats (widely supported)
   */
  STT_INPUT: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'flac', 'ogg'] as const,
} as const;
