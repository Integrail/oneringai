import { Vendor } from '../../core/Vendor.js';
import type { Vendor as VendorType } from '../../core/Vendor.js';

/**
 * Complete description of an LLM model including capabilities, pricing, and features
 */
export interface ILLMDescription {
  /** Model identifier (e.g., "gpt-5.2-instant") */
  name: string;

  /** Vendor/provider (Vendor.OpenAI, Vendor.Anthropic, etc.) */
  provider: string;

  /** Optional description of the model */
  description?: string;

  /** Whether the model is currently available for use */
  isActive: boolean;

  /** Release date (YYYY-MM-DD format) */
  releaseDate?: string;

  /** Knowledge cutoff date */
  knowledgeCutoff?: string;

  /** Model capabilities and pricing */
  features: {
    /** Supports extended reasoning/thinking */
    reasoning?: boolean;

    /** Supports streaming responses */
    streaming: boolean;

    /** Supports structured output (JSON mode) */
    structuredOutput?: boolean;

    /** Supports function/tool calling */
    functionCalling?: boolean;

    /** Supports fine-tuning */
    fineTuning?: boolean;

    /** Supports predicted outputs */
    predictedOutputs?: boolean;

    /** Supports realtime API */
    realtime?: boolean;

    /** Supports image input (vision) */
    vision?: boolean;

    /** Supports audio input/output */
    audio?: boolean;

    /** Supports video input */
    video?: boolean;

    /** Supports extended thinking (Claude-specific) */
    extendedThinking?: boolean;

    /** Supports batch API */
    batchAPI?: boolean;

    /** Supports prompt caching */
    promptCaching?: boolean;

    /** Parameter support - indicates which sampling parameters are supported */
    parameters?: {
      /** Supports temperature parameter */
      temperature?: boolean;
      /** Supports top_p parameter */
      topP?: boolean;
      /** Supports frequency_penalty parameter */
      frequencyPenalty?: boolean;
      /** Supports presence_penalty parameter */
      presencePenalty?: boolean;
    };

    /** Input specifications */
    input: {
      /** Maximum input context window (in tokens) */
      tokens: number;

      /** Supports text input */
      text: boolean;

      /** Supports image input */
      image?: boolean;

      /** Supports audio input */
      audio?: boolean;

      /** Supports video input */
      video?: boolean;

      /** Cost per million tokens (input) */
      cpm: number;

      /** Cost per million cached tokens (if prompt caching supported) */
      cpmCached?: number;
    };

    /** Output specifications */
    output: {
      /** Maximum output tokens */
      tokens: number;

      /** Supports text output */
      text: boolean;

      /** Supports image output */
      image?: boolean;

      /** Supports audio output */
      audio?: boolean;

      /** Cost per million tokens (output) */
      cpm: number;
    };
  };
}

/**
 * Model name constants organized by vendor
 * Updated: January 2026 - Contains only verified, currently available models
 */
export const LLM_MODELS = {
  [Vendor.OpenAI]: {
    // GPT-5.2 Series (Current Flagship)
    GPT_5_2: 'gpt-5.2',
    GPT_5_2_PRO: 'gpt-5.2-pro',
    // GPT-5 Series
    GPT_5: 'gpt-5',
    GPT_5_MINI: 'gpt-5-mini',
    GPT_5_NANO: 'gpt-5-nano',
    // GPT-4.1 Series
    GPT_4_1: 'gpt-4.1',
    GPT_4_1_MINI: 'gpt-4.1-mini',
    GPT_4_1_NANO: 'gpt-4.1-nano',
    // GPT-4o Series (Legacy, Audio Capable)
    GPT_4O: 'gpt-4o',
    GPT_4O_MINI: 'gpt-4o-mini',
    // Reasoning Models (o-series)
    O3_MINI: 'o3-mini',
    O1: 'o1',
  },
  [Vendor.Anthropic]: {
    // Claude 4.5 Series (Current)
    CLAUDE_OPUS_4_5: 'claude-opus-4-5-20251101',
    CLAUDE_SONNET_4_5: 'claude-sonnet-4-5-20250929',
    CLAUDE_HAIKU_4_5: 'claude-haiku-4-5-20251001',
    // Claude 4.x Legacy
    CLAUDE_OPUS_4_1: 'claude-opus-4-1-20250805',
    CLAUDE_SONNET_4: 'claude-sonnet-4-20250514',
    CLAUDE_SONNET_3_7: 'claude-3-7-sonnet-20250219',
    // Claude 3.x Legacy
    CLAUDE_HAIKU_3: 'claude-3-haiku-20240307',
  },
  [Vendor.Google]: {
    // Gemini 3 Series (Preview)
    GEMINI_3_FLASH_PREVIEW: 'gemini-3-flash-preview',
    GEMINI_3_PRO_PREVIEW: 'gemini-3-pro-preview',
    GEMINI_3_PRO_IMAGE_PREVIEW: 'gemini-3-pro-image-preview',
    // Gemini 2.5 Series (Production)
    GEMINI_2_5_PRO: 'gemini-2.5-pro',
    GEMINI_2_5_FLASH: 'gemini-2.5-flash',
    GEMINI_2_5_FLASH_LITE: 'gemini-2.5-flash-lite',
    GEMINI_2_5_FLASH_IMAGE: 'gemini-2.5-flash-image',
  },
} as const;

/**
 * Complete model registry with all model metadata
 * Updated: January 2026 - Verified from official vendor documentation
 */
export const MODEL_REGISTRY: Record<string, ILLMDescription> = {
  // ============================================================================
  // OpenAI Models (Verified from platform.openai.com)
  // ============================================================================

  // GPT-5.2 Series (Current Flagship)
  'gpt-5.2': {
    name: 'gpt-5.2',
    provider: Vendor.OpenAI,
    description: 'Flagship model for coding and agentic tasks. Reasoning.effort: none, low, medium, high, xhigh',
    isActive: true,
    releaseDate: '2025-12-01',
    knowledgeCutoff: '2025-08-31',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false,
      },
      input: {
        tokens: 400000,
        text: true,
        image: true,
        cpm: 1.75,
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 14,
      },
    },
  },

  'gpt-5.2-pro': {
    name: 'gpt-5.2-pro',
    provider: Vendor.OpenAI,
    description: 'GPT-5.2 pro produces smarter and more precise responses. Reasoning.effort: medium, high, xhigh',
    isActive: true,
    releaseDate: '2025-12-01',
    knowledgeCutoff: '2025-08-31',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false,
      },
      input: {
        tokens: 400000,
        text: true,
        image: true,
        cpm: 21,
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 168,
      },
    },
  },

  // GPT-5 Series
  'gpt-5': {
    name: 'gpt-5',
    provider: Vendor.OpenAI,
    description: 'Previous intelligent reasoning model for coding and agentic tasks. Reasoning.effort: minimal, low, medium, high',
    isActive: true,
    releaseDate: '2025-08-01',
    knowledgeCutoff: '2024-09-30',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false,
      },
      input: {
        tokens: 400000,
        text: true,
        image: true,
        cpm: 1.25,
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 10,
      },
    },
  },

  'gpt-5-mini': {
    name: 'gpt-5-mini',
    provider: Vendor.OpenAI,
    description: 'Faster, cost-efficient version of GPT-5 for well-defined tasks and precise prompts',
    isActive: true,
    releaseDate: '2025-08-01',
    knowledgeCutoff: '2024-05-31',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false,
      },
      input: {
        tokens: 400000,
        text: true,
        image: true,
        cpm: 0.25,
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 2,
      },
    },
  },

  'gpt-5-nano': {
    name: 'gpt-5-nano',
    provider: Vendor.OpenAI,
    description: 'Fastest, most cost-efficient GPT-5. Great for summarization and classification tasks',
    isActive: true,
    releaseDate: '2025-08-01',
    knowledgeCutoff: '2024-05-31',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false,
      },
      input: {
        tokens: 400000,
        text: true,
        image: true,
        cpm: 0.05,
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 0.4,
      },
    },
  },

  // GPT-4.1 Series
  'gpt-4.1': {
    name: 'gpt-4.1',
    provider: Vendor.OpenAI,
    description: 'GPT-4.1 specialized for coding with 1M token context window',
    isActive: true,
    releaseDate: '2025-04-14',
    knowledgeCutoff: '2025-04-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        cpm: 2,
      },
      output: {
        tokens: 32768,
        text: true,
        cpm: 8,
      },
    },
  },

  'gpt-4.1-mini': {
    name: 'gpt-4.1-mini',
    provider: Vendor.OpenAI,
    description: 'Efficient GPT-4.1 model, beats GPT-4o in many benchmarks at 83% lower cost',
    isActive: true,
    releaseDate: '2025-04-14',
    knowledgeCutoff: '2025-04-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        cpm: 0.4,
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 1.6,
      },
    },
  },

  'gpt-4.1-nano': {
    name: 'gpt-4.1-nano',
    provider: Vendor.OpenAI,
    description: 'Fastest and cheapest model with 1M context. 80.1% MMLU, ideal for classification/autocompletion',
    isActive: true,
    releaseDate: '2025-04-14',
    knowledgeCutoff: '2025-04-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        cpm: 0.1,
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 0.4,
      },
    },
  },

  // GPT-4o Series (Legacy, Audio Capable)
  'gpt-4o': {
    name: 'gpt-4o',
    provider: Vendor.OpenAI,
    description: 'Versatile omni model with audio support. Legacy but still available',
    isActive: true,
    releaseDate: '2024-05-13',
    knowledgeCutoff: '2024-04-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: true,
      realtime: true,
      vision: true,
      audio: true,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 128000,
        text: true,
        image: true,
        audio: true,
        cpm: 2.5,
      },
      output: {
        tokens: 16384,
        text: true,
        audio: true,
        cpm: 10,
      },
    },
  },

  'gpt-4o-mini': {
    name: 'gpt-4o-mini',
    provider: Vendor.OpenAI,
    description: 'Fast, affordable omni model with audio support',
    isActive: true,
    releaseDate: '2024-07-18',
    knowledgeCutoff: '2024-04-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: true,
      predictedOutputs: false,
      realtime: true,
      vision: true,
      audio: true,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 128000,
        text: true,
        image: true,
        audio: true,
        cpm: 0.15,
      },
      output: {
        tokens: 16384,
        text: true,
        audio: true,
        cpm: 0.6,
      },
    },
  },

  // Reasoning Models (o-series)
  'o3-mini': {
    name: 'o3-mini',
    provider: Vendor.OpenAI,
    description: 'Fast reasoning model tailored for coding, math, and science',
    isActive: true,
    releaseDate: '2025-01-31',
    knowledgeCutoff: '2024-10-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: false,
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false,
      },
      input: {
        tokens: 200000,
        text: true,
        image: true,
        cpm: 1.1,
      },
      output: {
        tokens: 100000,
        text: true,
        cpm: 4.4,
      },
    },
  },

  'o1': {
    name: 'o1',
    provider: Vendor.OpenAI,
    description: 'Advanced reasoning model for complex problems',
    isActive: true,
    releaseDate: '2024-12-17',
    knowledgeCutoff: '2024-10-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: false,
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false,
      },
      input: {
        tokens: 200000,
        text: true,
        image: true,
        cpm: 15,
      },
      output: {
        tokens: 100000,
        text: true,
        cpm: 60,
      },
    },
  },

  // ============================================================================
  // Anthropic Models (Verified from platform.claude.com)
  // ============================================================================

  // Claude 4.5 Series (Current)
  'claude-opus-4-5-20251101': {
    name: 'claude-opus-4-5-20251101',
    provider: Vendor.Anthropic,
    description: 'Premium model combining maximum intelligence with practical performance',
    isActive: true,
    releaseDate: '2025-11-01',
    knowledgeCutoff: '2025-05-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 200000,
        text: true,
        image: true,
        cpm: 5,
        cpmCached: 0.5,
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 25,
      },
    },
  },

  'claude-sonnet-4-5-20250929': {
    name: 'claude-sonnet-4-5-20250929',
    provider: Vendor.Anthropic,
    description: 'Smart model for complex agents and coding. Best balance of intelligence, speed, cost',
    isActive: true,
    releaseDate: '2025-09-29',
    knowledgeCutoff: '2025-01-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 200000,
        text: true,
        image: true,
        cpm: 3,
        cpmCached: 0.3,
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 15,
      },
    },
  },

  'claude-haiku-4-5-20251001': {
    name: 'claude-haiku-4-5-20251001',
    provider: Vendor.Anthropic,
    description: 'Fastest model with near-frontier intelligence. Matches Sonnet 4 on coding',
    isActive: true,
    releaseDate: '2025-10-01',
    knowledgeCutoff: '2025-02-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 200000,
        text: true,
        image: true,
        cpm: 1,
        cpmCached: 0.1,
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 5,
      },
    },
  },

  // Claude 4.x Legacy
  'claude-opus-4-1-20250805': {
    name: 'claude-opus-4-1-20250805',
    provider: Vendor.Anthropic,
    description: 'Legacy Opus 4.1 focused on agentic tasks, real-world coding, and reasoning',
    isActive: true,
    releaseDate: '2025-08-05',
    knowledgeCutoff: '2025-01-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 200000,
        text: true,
        image: true,
        cpm: 15,
        cpmCached: 1.5,
      },
      output: {
        tokens: 32000,
        text: true,
        cpm: 75,
      },
    },
  },

  'claude-sonnet-4-20250514': {
    name: 'claude-sonnet-4-20250514',
    provider: Vendor.Anthropic,
    description: 'Legacy Sonnet 4. Default for most users, supports 1M context beta',
    isActive: true,
    releaseDate: '2025-05-14',
    knowledgeCutoff: '2025-01-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 200000, // 1M with beta header
        text: true,
        image: true,
        cpm: 3,
        cpmCached: 0.3,
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 15,
      },
    },
  },

  'claude-3-7-sonnet-20250219': {
    name: 'claude-3-7-sonnet-20250219',
    provider: Vendor.Anthropic,
    description: 'Claude 3.7 Sonnet with extended thinking, supports 128K output beta',
    isActive: true,
    releaseDate: '2025-02-19',
    knowledgeCutoff: '2024-10-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 200000,
        text: true,
        image: true,
        cpm: 3,
        cpmCached: 0.3,
      },
      output: {
        tokens: 64000, // 128K with beta header
        text: true,
        cpm: 15,
      },
    },
  },

  // Claude 3.x Legacy
  'claude-3-haiku-20240307': {
    name: 'claude-3-haiku-20240307',
    provider: Vendor.Anthropic,
    description: 'Fast legacy model. Recommend migrating to Haiku 4.5',
    isActive: true,
    releaseDate: '2024-03-07',
    knowledgeCutoff: '2023-08-01',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 200000,
        text: true,
        image: true,
        cpm: 0.25,
        cpmCached: 0.03,
      },
      output: {
        tokens: 4096,
        text: true,
        cpm: 1.25,
      },
    },
  },

  // ============================================================================
  // Google Models (Verified from ai.google.dev)
  // ============================================================================

  // Gemini 3 Series (Preview)
  'gemini-3-flash-preview': {
    name: 'gemini-3-flash-preview',
    provider: Vendor.Google,
    description: 'Pro-grade reasoning with Flash-level latency and efficiency',
    isActive: true,
    releaseDate: '2025-11-18',
    knowledgeCutoff: '2025-08-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: true,
      video: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 0.15,
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.6,
      },
    },
  },

  'gemini-3-pro-preview': {
    name: 'gemini-3-pro-preview',
    provider: Vendor.Google,
    description: 'Most advanced reasoning Gemini model for complex tasks',
    isActive: true,
    releaseDate: '2025-11-18',
    knowledgeCutoff: '2025-08-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: true,
      video: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 1.25,
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 10,
      },
    },
  },

  'gemini-3-pro-image-preview': {
    name: 'gemini-3-pro-image-preview',
    provider: Vendor.Google,
    description: 'Highest quality image generation model',
    isActive: true,
    releaseDate: '2025-11-18',
    knowledgeCutoff: '2025-08-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: false,
      functionCalling: false,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        cpm: 1.25,
      },
      output: {
        tokens: 65536,
        text: true,
        image: true,
        cpm: 10,
      },
    },
  },

  // Gemini 2.5 Series (Production)
  'gemini-2.5-pro': {
    name: 'gemini-2.5-pro',
    provider: Vendor.Google,
    description: 'Advanced multimodal model built for deep reasoning and agents',
    isActive: true,
    releaseDate: '2025-03-01',
    knowledgeCutoff: '2025-01-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: true,
      video: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 1.25,
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 10,
      },
    },
  },

  'gemini-2.5-flash': {
    name: 'gemini-2.5-flash',
    provider: Vendor.Google,
    description: 'Fast, cost-effective model with excellent reasoning',
    isActive: true,
    releaseDate: '2025-06-17',
    knowledgeCutoff: '2025-01-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: true,
      video: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 0.15,
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.6,
      },
    },
  },

  'gemini-2.5-flash-lite': {
    name: 'gemini-2.5-flash-lite',
    provider: Vendor.Google,
    description: 'Lowest latency for high-volume tasks, summarization, classification',
    isActive: true,
    releaseDate: '2025-06-17',
    knowledgeCutoff: '2025-01-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: true,
      video: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 0.075,
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.3,
      },
    },
  },

  'gemini-2.5-flash-image': {
    name: 'gemini-2.5-flash-image',
    provider: Vendor.Google,
    description: 'Image generation and editing model',
    isActive: true,
    releaseDate: '2025-09-01',
    knowledgeCutoff: '2025-01-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: false,
      functionCalling: false,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1000000,
        text: true,
        image: true,
        cpm: 0.15,
      },
      output: {
        tokens: 65536,
        text: true,
        image: true,
        cpm: 0.6,
      },
    },
  },
};

/**
 * Get model information by name
 * @param modelName The model identifier
 * @returns Model description or undefined if not found
 */
export function getModelInfo(modelName: string): ILLMDescription | undefined {
  return MODEL_REGISTRY[modelName];
}

/**
 * Get all models for a specific vendor
 * @param vendor The vendor to filter by
 * @returns Array of model descriptions for the vendor
 */
export function getModelsByVendor(vendor: VendorType): ILLMDescription[] {
  return Object.values(MODEL_REGISTRY).filter((model) => model.provider === vendor);
}

/**
 * Get all currently active models
 * @returns Array of active model descriptions
 */
export function getActiveModels(): ILLMDescription[] {
  return Object.values(MODEL_REGISTRY).filter((model) => model.isActive);
}

/**
 * Calculate the cost for a given model and token usage
 * @param model Model name
 * @param inputTokens Number of input tokens
 * @param outputTokens Number of output tokens
 * @param options Optional calculation options
 * @returns Total cost in dollars, or null if model not found
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  options?: { useCachedInput?: boolean }
): number | null {
  const modelInfo = getModelInfo(model);
  if (!modelInfo) {
    return null;
  }

  const inputCPM = options?.useCachedInput && modelInfo.features.input.cpmCached !== undefined
    ? modelInfo.features.input.cpmCached
    : modelInfo.features.input.cpm;

  const outputCPM = modelInfo.features.output.cpm;

  const inputCost = (inputTokens / 1_000_000) * inputCPM;
  const outputCost = (outputTokens / 1_000_000) * outputCPM;

  return inputCost + outputCost;
}
