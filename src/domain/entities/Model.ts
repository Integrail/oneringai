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
 */
export const LLM_MODELS = {
  [Vendor.OpenAI]: {
    GPT_5_2_INSTANT: 'gpt-5.2-instant',
    GPT_5_2_THINKING: 'gpt-5.2-thinking',
    GPT_5_2_PRO: 'gpt-5.2-pro',
    GPT_5_2_CODEX: 'gpt-5.2-codex',
    GPT_5_1: 'gpt-5.1',
    GPT_5: 'gpt-5',
    GPT_5_MINI: 'gpt-5-mini',
    GPT_5_NANO: 'gpt-5-nano',
    GPT_4_1: 'gpt-4.1',
    GPT_4_1_MINI: 'gpt-4.1-mini',
    O3_MINI: 'o3-mini',
  },
  [Vendor.Anthropic]: {
    CLAUDE_OPUS_4_5: 'claude-opus-4-5-20251101',
    CLAUDE_SONNET_4_5: 'claude-sonnet-4-5-20250929',
    CLAUDE_HAIKU_4_5: 'claude-haiku-4-5-20251001',
    CLAUDE_OPUS_4_1: 'claude-opus-4-1-20250805',
    CLAUDE_SONNET_4: 'claude-sonnet-4-20250514',
  },
  [Vendor.Google]: {
    GEMINI_3_FLASH_PREVIEW: 'gemini-3-flash-preview',
    GEMINI_3_PRO: 'gemini-3-pro',
    GEMINI_3_PRO_IMAGE: 'gemini-3-pro-image',
    GEMINI_2_5_PRO: 'gemini-2.5-pro',
    GEMINI_2_5_FLASH: 'gemini-2.5-flash',
    GEMINI_2_5_FLASH_LITE: 'gemini-2.5-flash-lite',
    GEMINI_2_5_FLASH_IMAGE: 'gemini-2.5-flash-image',
  },
} as const;

/**
 * Complete model registry with all model metadata
 * Updated: January 2026
 */
export const MODEL_REGISTRY: Record<string, ILLMDescription> = {
  // ============================================================================
  // OpenAI Models (11 total)
  // ============================================================================

  'gpt-5.2-instant': {
    name: 'gpt-5.2-instant',
    provider: Vendor.OpenAI,
    description: 'Fast variant of GPT-5.2 with minimal reasoning step',
    isActive: true,
    releaseDate: '2025-12-11',
    knowledgeCutoff: '2025-08-31',
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
        tokens: 400000,
        text: true,
        image: true,
        cpm: 1.75,
        cpmCached: 0.025, // 90% discount
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 14,
      },
    },
  },

  'gpt-5.2-thinking': {
    name: 'gpt-5.2-thinking',
    provider: Vendor.OpenAI,
    description: 'GPT-5.2 with extended reasoning capabilities and xhigh reasoning effort',
    isActive: true,
    releaseDate: '2025-12-11',
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
      input: {
        tokens: 400000,
        text: true,
        image: true,
        cpm: 1.75,
        cpmCached: 0.025,
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
    description: 'Flagship GPT-5.2 model with advanced reasoning and highest quality',
    isActive: true,
    releaseDate: '2025-12-11',
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
      input: {
        tokens: 400000,
        text: true,
        image: true,
        cpm: 21,
        cpmCached: 0.025,
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 168,
      },
    },
  },

  'gpt-5.2-codex': {
    name: 'gpt-5.2-codex',
    provider: Vendor.OpenAI,
    description: 'Most advanced agentic coding model for complex software engineering',
    isActive: true,
    releaseDate: '2026-01-14',
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
      input: {
        tokens: 400000,
        text: true,
        image: true,
        cpm: 1.75,
        cpmCached: 0.025,
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 14,
      },
    },
  },

  'gpt-5.1': {
    name: 'gpt-5.1',
    provider: Vendor.OpenAI,
    description: 'Balanced GPT-5.1 model with expanded context window',
    isActive: true,
    releaseDate: '2025-11-13',
    knowledgeCutoff: '2025-08-31',
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
        tokens: 272000,
        text: true,
        image: true,
        cpm: 1.25,
        cpmCached: 0.025,
      },
      output: {
        tokens: 128000,
        text: true,
        cpm: 10,
      },
    },
  },

  'gpt-5': {
    name: 'gpt-5',
    provider: Vendor.OpenAI,
    description: 'Standard GPT-5 model with large context window',
    isActive: true,
    releaseDate: '2025-08-07',
    knowledgeCutoff: '2025-08-31',
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
        tokens: 400000,
        text: true,
        image: true,
        cpm: 1.25,
        cpmCached: 0.025,
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 10,
      },
    },
  },

  'gpt-5-mini': {
    name: 'gpt-5-mini',
    provider: Vendor.OpenAI,
    description: 'Fast, cost-efficient version of GPT-5',
    isActive: true,
    releaseDate: '2025-08-07',
    knowledgeCutoff: '2025-08-31',
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
        tokens: 200000,
        text: true,
        image: true,
        cpm: 0.25,
        cpmCached: 0.025,
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 2,
      },
    },
  },

  'gpt-5-nano': {
    name: 'gpt-5-nano',
    provider: Vendor.OpenAI,
    description: 'Fastest, most cost-effective version of GPT-5',
    isActive: true,
    releaseDate: '2025-08-07',
    knowledgeCutoff: '2025-08-31',
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: false,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 128000,
        text: true,
        cpm: 0.05,
        cpmCached: 0.025,
      },
      output: {
        tokens: 4096,
        text: true,
        cpm: 0.4,
      },
    },
  },

  'gpt-4.1': {
    name: 'gpt-4.1',
    provider: Vendor.OpenAI,
    description: 'GPT-4.1 specialized for coding with large context window',
    isActive: true,
    releaseDate: '2025-06-01',
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
        cpm: 0.5,
        cpmCached: 0.025,
      },
      output: {
        tokens: 32768,
        text: true,
        cpm: 2,
      },
    },
  },

  'gpt-4.1-mini': {
    name: 'gpt-4.1-mini',
    provider: Vendor.OpenAI,
    description: 'Efficient GPT-4.1 model with excellent instruction following',
    isActive: true,
    releaseDate: '2025-06-01',
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
        cpmCached: 0.025,
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 1.6,
      },
    },
  },

  'o3-mini': {
    name: 'o3-mini',
    provider: Vendor.OpenAI,
    description: 'Fast reasoning model tailored for coding, math, and science',
    isActive: true,
    releaseDate: '2025-01-01',
    knowledgeCutoff: '2023-10-01',
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: false,
      functionCalling: false,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: false,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: false,
      input: {
        tokens: 200000,
        text: true,
        cpm: 0.4,
      },
      output: {
        tokens: 100000,
        text: true,
        cpm: 1.6,
      },
    },
  },

  // ============================================================================
  // Anthropic Models (5 total)
  // ============================================================================

  'claude-opus-4-5-20251101': {
    name: 'claude-opus-4-5-20251101',
    provider: Vendor.Anthropic,
    description: 'Flagship Claude model with extended thinking and 80.9% SWE-bench score',
    isActive: true,
    releaseDate: '2025-11-24',
    knowledgeCutoff: '2025-03-01',
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
        cpmCached: 0.5, // 10x reduction for cache read
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
    description: 'Balanced Claude model with computer use and extended thinking',
    isActive: true,
    releaseDate: '2025-09-29',
    knowledgeCutoff: '2025-03-01',
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
    description: 'Fastest Claude model with extended thinking and lowest latency',
    isActive: true,
    releaseDate: '2025-10-01',
    knowledgeCutoff: '2025-03-01',
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

  'claude-opus-4-1-20250805': {
    name: 'claude-opus-4-1-20250805',
    provider: Vendor.Anthropic,
    description: 'Legacy Claude Opus 4.1 (67% more expensive than 4.5)',
    isActive: true,
    releaseDate: '2025-08-05',
    knowledgeCutoff: '2025-03-01',
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
        cpm: 15,
        cpmCached: 1.5,
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 75,
      },
    },
  },

  'claude-sonnet-4-20250514': {
    name: 'claude-sonnet-4-20250514',
    provider: Vendor.Anthropic,
    description: 'Legacy Claude Sonnet 4 with optional 1M token context',
    isActive: true,
    releaseDate: '2025-05-14',
    knowledgeCutoff: '2025-03-01',
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
        tokens: 1000000, // Up to 1M with premium pricing beyond 200K
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

  // ============================================================================
  // Google Models (7 total)
  // ============================================================================

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
        cpm: 0.5,
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 3,
      },
    },
  },

  'gemini-3-pro': {
    name: 'gemini-3-pro',
    provider: Vendor.Google,
    description: 'Most advanced reasoning Gemini model with 1M token context',
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
        cpm: 2, // $2 up to 200K, $4 beyond
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 12, // $12 up to 200K, $18 beyond
      },
    },
  },

  'gemini-3-pro-image': {
    name: 'gemini-3-pro-image',
    provider: Vendor.Google,
    description: 'Highest quality image generation model (Nano Banana Pro)',
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
        cpm: 2,
      },
      output: {
        tokens: 64000,
        text: true,
        image: true,
        cpm: 120, // For image output
      },
    },
  },

  'gemini-2.5-pro': {
    name: 'gemini-2.5-pro',
    provider: Vendor.Google,
    description: 'Balanced multimodal model built for agents',
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
        tokens: 64000,
        text: true,
        cpm: 10,
      },
    },
  },

  'gemini-2.5-flash': {
    name: 'gemini-2.5-flash',
    provider: Vendor.Google,
    description: 'Cost-effective model with upgraded reasoning',
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
        cpm: 0.1,
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 0.4,
      },
    },
  },

  'gemini-2.5-flash-lite': {
    name: 'gemini-2.5-flash-lite',
    provider: Vendor.Google,
    description: 'Lowest latency Gemini model with 1M context',
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
        cpm: 0.1,
      },
      output: {
        tokens: 64000,
        text: true,
        cpm: 0.4,
      },
    },
  },

  'gemini-2.5-flash-image': {
    name: 'gemini-2.5-flash-image',
    provider: Vendor.Google,
    description: 'State-of-the-art image generation and editing (1290 tokens per image)',
    isActive: true,
    releaseDate: '2026-01-01',
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
        cpm: 0.1,
      },
      output: {
        tokens: 64000,
        text: true,
        image: true,
        cpm: 30, // For image output
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
