// src/core/Vendor.ts
var Vendor = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  Google: "google",
  GoogleVertex: "google-vertex",
  Groq: "groq",
  Together: "together",
  Perplexity: "perplexity",
  Grok: "grok",
  DeepSeek: "deepseek",
  Mistral: "mistral",
  Ollama: "ollama",
  Custom: "custom"
  // OpenAI-compatible endpoint
};
var VENDORS = Object.values(Vendor);
function isVendor(value) {
  return VENDORS.includes(value);
}

// src/domain/entities/Model.ts
var LLM_MODELS = {
  [Vendor.OpenAI]: {
    // GPT-5.2 Series (Current Flagship)
    GPT_5_2: "gpt-5.2",
    GPT_5_2_PRO: "gpt-5.2-pro",
    // GPT-5 Series
    GPT_5: "gpt-5",
    GPT_5_MINI: "gpt-5-mini",
    GPT_5_NANO: "gpt-5-nano",
    // GPT-4.1 Series
    GPT_4_1: "gpt-4.1",
    GPT_4_1_MINI: "gpt-4.1-mini",
    GPT_4_1_NANO: "gpt-4.1-nano",
    // GPT-4o Series (Legacy, Audio Capable)
    GPT_4O: "gpt-4o",
    GPT_4O_MINI: "gpt-4o-mini",
    // Reasoning Models (o-series)
    O3_MINI: "o3-mini",
    O1: "o1"
  },
  [Vendor.Anthropic]: {
    // Claude 4.5 Series (Current)
    CLAUDE_OPUS_4_5: "claude-opus-4-5-20251101",
    CLAUDE_SONNET_4_5: "claude-sonnet-4-5-20250929",
    CLAUDE_HAIKU_4_5: "claude-haiku-4-5-20251001",
    // Claude 4.x Legacy
    CLAUDE_OPUS_4_1: "claude-opus-4-1-20250805",
    CLAUDE_SONNET_4: "claude-sonnet-4-20250514",
    CLAUDE_SONNET_3_7: "claude-3-7-sonnet-20250219",
    // Claude 3.x Legacy
    CLAUDE_HAIKU_3: "claude-3-haiku-20240307"
  },
  [Vendor.Google]: {
    // Gemini 3 Series (Preview)
    GEMINI_3_FLASH_PREVIEW: "gemini-3-flash-preview",
    GEMINI_3_PRO_PREVIEW: "gemini-3-pro-preview",
    GEMINI_3_PRO_IMAGE_PREVIEW: "gemini-3-pro-image-preview",
    // Gemini 2.5 Series (Production)
    GEMINI_2_5_PRO: "gemini-2.5-pro",
    GEMINI_2_5_FLASH: "gemini-2.5-flash",
    GEMINI_2_5_FLASH_LITE: "gemini-2.5-flash-lite",
    GEMINI_2_5_FLASH_IMAGE: "gemini-2.5-flash-image"
  },
  [Vendor.Grok]: {
    // Grok 4.1 Series (2M context, fast)
    GROK_4_1_FAST_REASONING: "grok-4-1-fast-reasoning",
    GROK_4_1_FAST_NON_REASONING: "grok-4-1-fast-non-reasoning",
    // Grok 4 Series
    GROK_4_FAST_REASONING: "grok-4-fast-reasoning",
    GROK_4_FAST_NON_REASONING: "grok-4-fast-non-reasoning",
    GROK_4_0709: "grok-4-0709",
    // Grok Code
    GROK_CODE_FAST_1: "grok-code-fast-1",
    // Grok 3 Series
    GROK_3: "grok-3",
    GROK_3_MINI: "grok-3-mini",
    // Grok 2 Series (Vision)
    GROK_2_VISION_1212: "grok-2-vision-1212"
  }
};
var MODEL_REGISTRY = {
  // ============================================================================
  // OpenAI Models (Verified from platform.openai.com)
  // ============================================================================
  // GPT-5.2 Series (Current Flagship)
  "gpt-5.2": {
    name: "gpt-5.2",
    provider: Vendor.OpenAI,
    description: "Flagship model for coding and agentic tasks. Reasoning.effort: none, low, medium, high, xhigh",
    isActive: true,
    releaseDate: "2025-12-01",
    knowledgeCutoff: "2025-08-31",
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
        presencePenalty: false
      },
      input: {
        tokens: 4e5,
        text: true,
        image: true,
        cpm: 1.75
      },
      output: {
        tokens: 128e3,
        text: true,
        cpm: 14
      }
    }
  },
  "gpt-5.2-pro": {
    name: "gpt-5.2-pro",
    provider: Vendor.OpenAI,
    description: "GPT-5.2 pro produces smarter and more precise responses. Reasoning.effort: medium, high, xhigh",
    isActive: true,
    releaseDate: "2025-12-01",
    knowledgeCutoff: "2025-08-31",
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
        presencePenalty: false
      },
      input: {
        tokens: 4e5,
        text: true,
        image: true,
        cpm: 21
      },
      output: {
        tokens: 128e3,
        text: true,
        cpm: 168
      }
    }
  },
  // GPT-5 Series
  "gpt-5": {
    name: "gpt-5",
    provider: Vendor.OpenAI,
    description: "Previous intelligent reasoning model for coding and agentic tasks. Reasoning.effort: minimal, low, medium, high",
    isActive: true,
    releaseDate: "2025-08-01",
    knowledgeCutoff: "2024-09-30",
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
        presencePenalty: false
      },
      input: {
        tokens: 4e5,
        text: true,
        image: true,
        cpm: 1.25
      },
      output: {
        tokens: 128e3,
        text: true,
        cpm: 10
      }
    }
  },
  "gpt-5-mini": {
    name: "gpt-5-mini",
    provider: Vendor.OpenAI,
    description: "Faster, cost-efficient version of GPT-5 for well-defined tasks and precise prompts",
    isActive: true,
    releaseDate: "2025-08-01",
    knowledgeCutoff: "2024-05-31",
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
        presencePenalty: false
      },
      input: {
        tokens: 4e5,
        text: true,
        image: true,
        cpm: 0.25
      },
      output: {
        tokens: 128e3,
        text: true,
        cpm: 2
      }
    }
  },
  "gpt-5-nano": {
    name: "gpt-5-nano",
    provider: Vendor.OpenAI,
    description: "Fastest, most cost-efficient GPT-5. Great for summarization and classification tasks",
    isActive: true,
    releaseDate: "2025-08-01",
    knowledgeCutoff: "2024-05-31",
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
        presencePenalty: false
      },
      input: {
        tokens: 4e5,
        text: true,
        image: true,
        cpm: 0.05
      },
      output: {
        tokens: 128e3,
        text: true,
        cpm: 0.4
      }
    }
  },
  // GPT-4.1 Series
  "gpt-4.1": {
    name: "gpt-4.1",
    provider: Vendor.OpenAI,
    description: "GPT-4.1 specialized for coding with 1M token context window",
    isActive: true,
    releaseDate: "2025-04-14",
    knowledgeCutoff: "2025-04-01",
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
        tokens: 1e6,
        text: true,
        image: true,
        cpm: 2
      },
      output: {
        tokens: 32768,
        text: true,
        cpm: 8
      }
    }
  },
  "gpt-4.1-mini": {
    name: "gpt-4.1-mini",
    provider: Vendor.OpenAI,
    description: "Efficient GPT-4.1 model, beats GPT-4o in many benchmarks at 83% lower cost",
    isActive: true,
    releaseDate: "2025-04-14",
    knowledgeCutoff: "2025-04-01",
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
        tokens: 1e6,
        text: true,
        image: true,
        cpm: 0.4
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 1.6
      }
    }
  },
  "gpt-4.1-nano": {
    name: "gpt-4.1-nano",
    provider: Vendor.OpenAI,
    description: "Fastest and cheapest model with 1M context. 80.1% MMLU, ideal for classification/autocompletion",
    isActive: true,
    releaseDate: "2025-04-14",
    knowledgeCutoff: "2025-04-01",
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
        tokens: 1e6,
        text: true,
        image: true,
        cpm: 0.1
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 0.4
      }
    }
  },
  // GPT-4o Series (Legacy, Audio Capable)
  "gpt-4o": {
    name: "gpt-4o",
    provider: Vendor.OpenAI,
    description: "Versatile omni model with audio support. Legacy but still available",
    isActive: true,
    releaseDate: "2024-05-13",
    knowledgeCutoff: "2024-04-01",
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
        tokens: 128e3,
        text: true,
        image: true,
        audio: true,
        cpm: 2.5
      },
      output: {
        tokens: 16384,
        text: true,
        audio: true,
        cpm: 10
      }
    }
  },
  "gpt-4o-mini": {
    name: "gpt-4o-mini",
    provider: Vendor.OpenAI,
    description: "Fast, affordable omni model with audio support",
    isActive: true,
    releaseDate: "2024-07-18",
    knowledgeCutoff: "2024-04-01",
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
        tokens: 128e3,
        text: true,
        image: true,
        audio: true,
        cpm: 0.15
      },
      output: {
        tokens: 16384,
        text: true,
        audio: true,
        cpm: 0.6
      }
    }
  },
  // Reasoning Models (o-series)
  "o3-mini": {
    name: "o3-mini",
    provider: Vendor.OpenAI,
    description: "Fast reasoning model tailored for coding, math, and science",
    isActive: true,
    releaseDate: "2025-01-31",
    knowledgeCutoff: "2024-10-01",
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
        presencePenalty: false
      },
      input: {
        tokens: 2e5,
        text: true,
        image: true,
        cpm: 1.1
      },
      output: {
        tokens: 1e5,
        text: true,
        cpm: 4.4
      }
    }
  },
  "o1": {
    name: "o1",
    provider: Vendor.OpenAI,
    description: "Advanced reasoning model for complex problems",
    isActive: true,
    releaseDate: "2024-12-17",
    knowledgeCutoff: "2024-10-01",
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
        presencePenalty: false
      },
      input: {
        tokens: 2e5,
        text: true,
        image: true,
        cpm: 15
      },
      output: {
        tokens: 1e5,
        text: true,
        cpm: 60
      }
    }
  },
  // ============================================================================
  // Anthropic Models (Verified from platform.claude.com)
  // ============================================================================
  // Claude 4.5 Series (Current)
  "claude-opus-4-5-20251101": {
    name: "claude-opus-4-5-20251101",
    provider: Vendor.Anthropic,
    description: "Premium model combining maximum intelligence with practical performance",
    isActive: true,
    releaseDate: "2025-11-01",
    knowledgeCutoff: "2025-05-01",
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
        tokens: 2e5,
        text: true,
        image: true,
        cpm: 5,
        cpmCached: 0.5
      },
      output: {
        tokens: 64e3,
        text: true,
        cpm: 25
      }
    }
  },
  "claude-sonnet-4-5-20250929": {
    name: "claude-sonnet-4-5-20250929",
    provider: Vendor.Anthropic,
    description: "Smart model for complex agents and coding. Best balance of intelligence, speed, cost",
    isActive: true,
    releaseDate: "2025-09-29",
    knowledgeCutoff: "2025-01-01",
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
        tokens: 2e5,
        text: true,
        image: true,
        cpm: 3,
        cpmCached: 0.3
      },
      output: {
        tokens: 64e3,
        text: true,
        cpm: 15
      }
    }
  },
  "claude-haiku-4-5-20251001": {
    name: "claude-haiku-4-5-20251001",
    provider: Vendor.Anthropic,
    description: "Fastest model with near-frontier intelligence. Matches Sonnet 4 on coding",
    isActive: true,
    releaseDate: "2025-10-01",
    knowledgeCutoff: "2025-02-01",
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
        tokens: 2e5,
        text: true,
        image: true,
        cpm: 1,
        cpmCached: 0.1
      },
      output: {
        tokens: 64e3,
        text: true,
        cpm: 5
      }
    }
  },
  // Claude 4.x Legacy
  "claude-opus-4-1-20250805": {
    name: "claude-opus-4-1-20250805",
    provider: Vendor.Anthropic,
    description: "Legacy Opus 4.1 focused on agentic tasks, real-world coding, and reasoning",
    isActive: true,
    releaseDate: "2025-08-05",
    knowledgeCutoff: "2025-01-01",
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
        tokens: 2e5,
        text: true,
        image: true,
        cpm: 15,
        cpmCached: 1.5
      },
      output: {
        tokens: 32e3,
        text: true,
        cpm: 75
      }
    }
  },
  "claude-sonnet-4-20250514": {
    name: "claude-sonnet-4-20250514",
    provider: Vendor.Anthropic,
    description: "Legacy Sonnet 4. Default for most users, supports 1M context beta",
    isActive: true,
    releaseDate: "2025-05-14",
    knowledgeCutoff: "2025-01-01",
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
        tokens: 2e5,
        // 1M with beta header
        text: true,
        image: true,
        cpm: 3,
        cpmCached: 0.3
      },
      output: {
        tokens: 64e3,
        text: true,
        cpm: 15
      }
    }
  },
  "claude-3-7-sonnet-20250219": {
    name: "claude-3-7-sonnet-20250219",
    provider: Vendor.Anthropic,
    description: "Claude 3.7 Sonnet with extended thinking, supports 128K output beta",
    isActive: true,
    releaseDate: "2025-02-19",
    knowledgeCutoff: "2024-10-01",
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
        tokens: 2e5,
        text: true,
        image: true,
        cpm: 3,
        cpmCached: 0.3
      },
      output: {
        tokens: 64e3,
        // 128K with beta header
        text: true,
        cpm: 15
      }
    }
  },
  // Claude 3.x Legacy
  "claude-3-haiku-20240307": {
    name: "claude-3-haiku-20240307",
    provider: Vendor.Anthropic,
    description: "Fast legacy model. Recommend migrating to Haiku 4.5",
    isActive: true,
    releaseDate: "2024-03-07",
    knowledgeCutoff: "2023-08-01",
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
        tokens: 2e5,
        text: true,
        image: true,
        cpm: 0.25,
        cpmCached: 0.03
      },
      output: {
        tokens: 4096,
        text: true,
        cpm: 1.25
      }
    }
  },
  // ============================================================================
  // Google Models (Verified from ai.google.dev)
  // ============================================================================
  // Gemini 3 Series (Preview)
  "gemini-3-flash-preview": {
    name: "gemini-3-flash-preview",
    provider: Vendor.Google,
    description: "Pro-grade reasoning with Flash-level latency and efficiency",
    isActive: true,
    releaseDate: "2025-11-18",
    knowledgeCutoff: "2025-08-01",
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
        tokens: 1e6,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 0.15
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.6
      }
    }
  },
  "gemini-3-pro-preview": {
    name: "gemini-3-pro-preview",
    provider: Vendor.Google,
    description: "Most advanced reasoning Gemini model for complex tasks",
    isActive: true,
    releaseDate: "2025-11-18",
    knowledgeCutoff: "2025-08-01",
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
        tokens: 1e6,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 1.25
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 10
      }
    }
  },
  "gemini-3-pro-image-preview": {
    name: "gemini-3-pro-image-preview",
    provider: Vendor.Google,
    description: "Highest quality image generation model",
    isActive: true,
    releaseDate: "2025-11-18",
    knowledgeCutoff: "2025-08-01",
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
        tokens: 1e6,
        text: true,
        image: true,
        cpm: 1.25
      },
      output: {
        tokens: 65536,
        text: true,
        image: true,
        cpm: 10
      }
    }
  },
  // Gemini 2.5 Series (Production)
  "gemini-2.5-pro": {
    name: "gemini-2.5-pro",
    provider: Vendor.Google,
    description: "Advanced multimodal model built for deep reasoning and agents",
    isActive: true,
    releaseDate: "2025-03-01",
    knowledgeCutoff: "2025-01-01",
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
        tokens: 1e6,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 1.25
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 10
      }
    }
  },
  "gemini-2.5-flash": {
    name: "gemini-2.5-flash",
    provider: Vendor.Google,
    description: "Fast, cost-effective model with excellent reasoning",
    isActive: true,
    releaseDate: "2025-06-17",
    knowledgeCutoff: "2025-01-01",
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
        tokens: 1e6,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 0.15
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.6
      }
    }
  },
  "gemini-2.5-flash-lite": {
    name: "gemini-2.5-flash-lite",
    provider: Vendor.Google,
    description: "Lowest latency for high-volume tasks, summarization, classification",
    isActive: true,
    releaseDate: "2025-06-17",
    knowledgeCutoff: "2025-01-01",
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
        tokens: 1e6,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 0.075
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.3
      }
    }
  },
  "gemini-2.5-flash-image": {
    name: "gemini-2.5-flash-image",
    provider: Vendor.Google,
    description: "Image generation and editing model",
    isActive: true,
    releaseDate: "2025-09-01",
    knowledgeCutoff: "2025-01-01",
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
        tokens: 1e6,
        text: true,
        image: true,
        cpm: 0.15
      },
      output: {
        tokens: 65536,
        text: true,
        image: true,
        cpm: 0.6
      }
    }
  },
  // ============================================================================
  // xAI Grok Models (Verified from docs.x.ai - January 2026)
  // ============================================================================
  // Grok 4.1 Series (2M context, fast)
  "grok-4-1-fast-reasoning": {
    name: "grok-4-1-fast-reasoning",
    provider: Vendor.Grok,
    description: "Fast Grok 4.1 with reasoning capabilities, 2M context window, vision support",
    isActive: true,
    releaseDate: "2025-11-01",
    knowledgeCutoff: "2024-11-01",
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
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 2e6,
        text: true,
        image: true,
        cpm: 0.2
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.5
      }
    }
  },
  "grok-4-1-fast-non-reasoning": {
    name: "grok-4-1-fast-non-reasoning",
    provider: Vendor.Grok,
    description: "Fast Grok 4.1 without reasoning, 2M context window, vision support",
    isActive: true,
    releaseDate: "2025-11-01",
    knowledgeCutoff: "2024-11-01",
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
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 2e6,
        text: true,
        image: true,
        cpm: 0.2
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.5
      }
    }
  },
  // Grok Code Series
  "grok-code-fast-1": {
    name: "grok-code-fast-1",
    provider: Vendor.Grok,
    description: "Specialized coding model with reasoning capabilities, 256K context",
    isActive: true,
    releaseDate: "2025-10-01",
    knowledgeCutoff: "2024-11-01",
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: false,
      audio: false,
      video: false,
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 256e3,
        text: true,
        cpm: 0.2
      },
      output: {
        tokens: 32768,
        text: true,
        cpm: 1.5
      }
    }
  },
  // Grok 4 Series
  "grok-4-fast-reasoning": {
    name: "grok-4-fast-reasoning",
    provider: Vendor.Grok,
    description: "Fast Grok 4 with reasoning capabilities, 2M context window",
    isActive: true,
    releaseDate: "2025-09-01",
    knowledgeCutoff: "2024-11-01",
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: false,
      audio: false,
      video: false,
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 2e6,
        text: true,
        cpm: 0.2
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.5
      }
    }
  },
  "grok-4-fast-non-reasoning": {
    name: "grok-4-fast-non-reasoning",
    provider: Vendor.Grok,
    description: "Fast Grok 4 without reasoning, 2M context window, vision support",
    isActive: true,
    releaseDate: "2025-09-01",
    knowledgeCutoff: "2024-11-01",
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
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 2e6,
        text: true,
        image: true,
        cpm: 0.2
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.5
      }
    }
  },
  "grok-4-0709": {
    name: "grok-4-0709",
    provider: Vendor.Grok,
    description: "Grok 4 flagship model (July 2025 release), 256K context, vision support",
    isActive: true,
    releaseDate: "2025-07-09",
    knowledgeCutoff: "2024-11-01",
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
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 256e3,
        text: true,
        image: true,
        cpm: 3
      },
      output: {
        tokens: 32768,
        text: true,
        cpm: 15
      }
    }
  },
  // Grok 3 Series
  "grok-3-mini": {
    name: "grok-3-mini",
    provider: Vendor.Grok,
    description: "Lightweight, cost-efficient model for simpler tasks, 131K context",
    isActive: true,
    releaseDate: "2025-06-01",
    knowledgeCutoff: "2024-11-01",
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
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 131072,
        text: true,
        cpm: 0.3
      },
      output: {
        tokens: 32768,
        text: true,
        cpm: 0.5
      }
    }
  },
  "grok-3": {
    name: "grok-3",
    provider: Vendor.Grok,
    description: "Production model for general-purpose tasks, 131K context",
    isActive: true,
    releaseDate: "2025-06-01",
    knowledgeCutoff: "2024-11-01",
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
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 131072,
        text: true,
        cpm: 3
      },
      output: {
        tokens: 32768,
        text: true,
        cpm: 15
      }
    }
  },
  // Grok 2 Series (Vision)
  "grok-2-vision-1212": {
    name: "grok-2-vision-1212",
    provider: Vendor.Grok,
    description: "Vision-capable model for image understanding, 32K context",
    isActive: true,
    releaseDate: "2024-12-12",
    knowledgeCutoff: "2024-11-01",
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
      batchAPI: false,
      promptCaching: false,
      input: {
        tokens: 32768,
        text: true,
        image: true,
        cpm: 2
      },
      output: {
        tokens: 8192,
        text: true,
        cpm: 10
      }
    }
  }
};
function getModelInfo(modelName) {
  return MODEL_REGISTRY[modelName];
}
function getModelsByVendor(vendor) {
  return Object.values(MODEL_REGISTRY).filter((model) => model.provider === vendor);
}
function getActiveModels() {
  return Object.values(MODEL_REGISTRY).filter((model) => model.isActive);
}
function calculateCost(model, inputTokens, outputTokens, options) {
  const modelInfo = getModelInfo(model);
  if (!modelInfo) {
    return null;
  }
  const inputCPM = options?.useCachedInput && modelInfo.features.input.cpmCached !== void 0 ? modelInfo.features.input.cpmCached : modelInfo.features.input.cpm;
  const outputCPM = modelInfo.features.output.cpm;
  const inputCost = inputTokens / 1e6 * inputCPM;
  const outputCost = outputTokens / 1e6 * outputCPM;
  return inputCost + outputCost;
}

// src/domain/entities/Services.ts
var SERVICE_DEFINITIONS = [
  // ============ Major Vendors ============
  {
    id: "microsoft",
    name: "Microsoft",
    category: "major-vendors",
    urlPattern: /graph\.microsoft\.com|login\.microsoftonline\.com/i,
    baseURL: "https://graph.microsoft.com/v1.0",
    docsURL: "https://learn.microsoft.com/en-us/graph/",
    commonScopes: ["User.Read", "Files.ReadWrite", "Mail.Read", "Calendars.ReadWrite"]
  },
  {
    id: "google",
    name: "Google",
    category: "major-vendors",
    urlPattern: /googleapis\.com|accounts\.google\.com/i,
    baseURL: "https://www.googleapis.com",
    docsURL: "https://developers.google.com/",
    commonScopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/gmail.readonly"
    ]
  },
  // ============ Communication ============
  {
    id: "slack",
    name: "Slack",
    category: "communication",
    urlPattern: /slack\.com/i,
    baseURL: "https://slack.com/api",
    docsURL: "https://api.slack.com/methods",
    commonScopes: ["chat:write", "channels:read", "users:read"]
  },
  {
    id: "discord",
    name: "Discord",
    category: "communication",
    urlPattern: /discord\.com|discordapp\.com/i,
    baseURL: "https://discord.com/api/v10",
    docsURL: "https://discord.com/developers/docs",
    commonScopes: ["bot", "messages.read"]
  },
  {
    id: "telegram",
    name: "Telegram",
    category: "communication",
    urlPattern: /api\.telegram\.org/i,
    baseURL: "https://api.telegram.org",
    docsURL: "https://core.telegram.org/bots/api"
  },
  // ============ Development & Project Management ============
  {
    id: "github",
    name: "GitHub",
    category: "development",
    urlPattern: /api\.github\.com/i,
    baseURL: "https://api.github.com",
    docsURL: "https://docs.github.com/en/rest",
    commonScopes: ["repo", "read:user", "read:org"]
  },
  {
    id: "gitlab",
    name: "GitLab",
    category: "development",
    urlPattern: /gitlab\.com|gitlab\./i,
    baseURL: "https://gitlab.com/api/v4",
    docsURL: "https://docs.gitlab.com/ee/api/",
    commonScopes: ["api", "read_user", "read_repository"]
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    category: "development",
    urlPattern: /api\.bitbucket\.org|bitbucket\.org/i,
    baseURL: "https://api.bitbucket.org/2.0",
    docsURL: "https://developer.atlassian.com/cloud/bitbucket/rest/",
    commonScopes: ["repository", "pullrequest"]
  },
  {
    id: "jira",
    name: "Jira",
    category: "development",
    urlPattern: /atlassian\.net.*jira|jira\./i,
    baseURL: "https://your-domain.atlassian.net/rest/api/3",
    docsURL: "https://developer.atlassian.com/cloud/jira/platform/rest/v3/",
    commonScopes: ["read:jira-work", "write:jira-work"]
  },
  {
    id: "linear",
    name: "Linear",
    category: "development",
    urlPattern: /api\.linear\.app/i,
    baseURL: "https://api.linear.app/graphql",
    docsURL: "https://developers.linear.app/docs",
    commonScopes: ["read", "write"]
  },
  {
    id: "asana",
    name: "Asana",
    category: "development",
    urlPattern: /api\.asana\.com/i,
    baseURL: "https://app.asana.com/api/1.0",
    docsURL: "https://developers.asana.com/docs"
  },
  {
    id: "trello",
    name: "Trello",
    category: "development",
    urlPattern: /api\.trello\.com/i,
    baseURL: "https://api.trello.com/1",
    docsURL: "https://developer.atlassian.com/cloud/trello/rest/",
    commonScopes: ["read", "write"]
  },
  // ============ Productivity & Collaboration ============
  {
    id: "notion",
    name: "Notion",
    category: "productivity",
    urlPattern: /api\.notion\.com/i,
    baseURL: "https://api.notion.com/v1",
    docsURL: "https://developers.notion.com/reference"
  },
  {
    id: "airtable",
    name: "Airtable",
    category: "productivity",
    urlPattern: /api\.airtable\.com/i,
    baseURL: "https://api.airtable.com/v0",
    docsURL: "https://airtable.com/developers/web/api",
    commonScopes: ["data.records:read", "data.records:write"]
  },
  {
    id: "confluence",
    name: "Confluence",
    category: "productivity",
    urlPattern: /atlassian\.net.*wiki|confluence\./i,
    baseURL: "https://your-domain.atlassian.net/wiki/rest/api",
    docsURL: "https://developer.atlassian.com/cloud/confluence/rest/",
    commonScopes: ["read:confluence-content.all", "write:confluence-content"]
  },
  // ============ CRM & Sales ============
  {
    id: "salesforce",
    name: "Salesforce",
    category: "crm",
    urlPattern: /salesforce\.com|force\.com/i,
    baseURL: "https://your-instance.salesforce.com/services/data/v58.0",
    docsURL: "https://developer.salesforce.com/docs/apis",
    commonScopes: ["api", "refresh_token"]
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "crm",
    urlPattern: /api\.hubapi\.com|api\.hubspot\.com/i,
    baseURL: "https://api.hubapi.com",
    docsURL: "https://developers.hubspot.com/docs/api",
    commonScopes: ["crm.objects.contacts.read", "crm.objects.contacts.write"]
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    category: "crm",
    urlPattern: /api\.pipedrive\.com/i,
    baseURL: "https://api.pipedrive.com/v1",
    docsURL: "https://developers.pipedrive.com/docs/api/v1"
  },
  // ============ Payments & Finance ============
  {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    urlPattern: /api\.stripe\.com/i,
    baseURL: "https://api.stripe.com/v1",
    docsURL: "https://stripe.com/docs/api"
  },
  {
    id: "paypal",
    name: "PayPal",
    category: "payments",
    urlPattern: /api\.paypal\.com|api-m\.paypal\.com/i,
    baseURL: "https://api-m.paypal.com/v2",
    docsURL: "https://developer.paypal.com/docs/api/"
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    category: "payments",
    urlPattern: /quickbooks\.api\.intuit\.com|intuit\.com.*quickbooks/i,
    baseURL: "https://quickbooks.api.intuit.com/v3",
    docsURL: "https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account",
    commonScopes: ["com.intuit.quickbooks.accounting"]
  },
  {
    id: "ramp",
    name: "Ramp",
    category: "payments",
    urlPattern: /api\.ramp\.com/i,
    baseURL: "https://api.ramp.com/developer/v1",
    docsURL: "https://docs.ramp.com/reference"
  },
  // ============ Cloud Providers ============
  {
    id: "aws",
    name: "Amazon Web Services",
    category: "cloud",
    urlPattern: /amazonaws\.com/i,
    baseURL: "https://aws.amazon.com",
    docsURL: "https://docs.aws.amazon.com/"
  },
  // ============ Storage ============
  {
    id: "dropbox",
    name: "Dropbox",
    category: "storage",
    urlPattern: /api\.dropboxapi\.com|dropbox\.com/i,
    baseURL: "https://api.dropboxapi.com/2",
    docsURL: "https://www.dropbox.com/developers/documentation",
    commonScopes: ["files.content.read", "files.content.write"]
  },
  {
    id: "box",
    name: "Box",
    category: "storage",
    urlPattern: /api\.box\.com/i,
    baseURL: "https://api.box.com/2.0",
    docsURL: "https://developer.box.com/reference/"
  },
  // ============ Email ============
  {
    id: "sendgrid",
    name: "SendGrid",
    category: "email",
    urlPattern: /api\.sendgrid\.com/i,
    baseURL: "https://api.sendgrid.com/v3",
    docsURL: "https://docs.sendgrid.com/api-reference"
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    category: "email",
    urlPattern: /api\.mailchimp\.com|mandrillapp\.com/i,
    baseURL: "https://server.api.mailchimp.com/3.0",
    docsURL: "https://mailchimp.com/developer/marketing/api/"
  },
  {
    id: "postmark",
    name: "Postmark",
    category: "email",
    urlPattern: /api\.postmarkapp\.com/i,
    baseURL: "https://api.postmarkapp.com",
    docsURL: "https://postmarkapp.com/developer"
  },
  // ============ Monitoring & Observability ============
  {
    id: "datadog",
    name: "Datadog",
    category: "monitoring",
    urlPattern: /api\.datadoghq\.com/i,
    baseURL: "https://api.datadoghq.com/api/v2",
    docsURL: "https://docs.datadoghq.com/api/"
  },
  {
    id: "pagerduty",
    name: "PagerDuty",
    category: "monitoring",
    urlPattern: /api\.pagerduty\.com/i,
    baseURL: "https://api.pagerduty.com",
    docsURL: "https://developer.pagerduty.com/api-reference/"
  },
  {
    id: "sentry",
    name: "Sentry",
    category: "monitoring",
    urlPattern: /sentry\.io/i,
    baseURL: "https://sentry.io/api/0",
    docsURL: "https://docs.sentry.io/api/"
  },
  // ============ Search ============
  {
    id: "serper",
    name: "Serper",
    category: "search",
    urlPattern: /serper\.dev/i,
    baseURL: "https://google.serper.dev",
    docsURL: "https://serper.dev/docs"
  },
  {
    id: "brave-search",
    name: "Brave Search",
    category: "search",
    urlPattern: /api\.search\.brave\.com/i,
    baseURL: "https://api.search.brave.com/res/v1",
    docsURL: "https://brave.com/search/api/"
  },
  {
    id: "tavily",
    name: "Tavily",
    category: "search",
    urlPattern: /api\.tavily\.com/i,
    baseURL: "https://api.tavily.com",
    docsURL: "https://tavily.com/docs"
  },
  {
    id: "rapidapi-search",
    name: "RapidAPI Search",
    category: "search",
    urlPattern: /real-time-web-search\.p\.rapidapi\.com/i,
    baseURL: "https://real-time-web-search.p.rapidapi.com",
    docsURL: "https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-web-search"
  },
  // ============ Scraping ============
  {
    id: "zenrows",
    name: "ZenRows",
    category: "scrape",
    urlPattern: /api\.zenrows\.com/i,
    baseURL: "https://api.zenrows.com/v1",
    docsURL: "https://docs.zenrows.com/universal-scraper-api/api-reference"
  },
  // ============ Other ============
  {
    id: "twilio",
    name: "Twilio",
    category: "other",
    urlPattern: /api\.twilio\.com/i,
    baseURL: "https://api.twilio.com/2010-04-01",
    docsURL: "https://www.twilio.com/docs/usage/api"
  },
  {
    id: "zendesk",
    name: "Zendesk",
    category: "other",
    urlPattern: /zendesk\.com/i,
    baseURL: "https://your-subdomain.zendesk.com/api/v2",
    docsURL: "https://developer.zendesk.com/api-reference/",
    commonScopes: ["read", "write"]
  },
  {
    id: "intercom",
    name: "Intercom",
    category: "other",
    urlPattern: /api\.intercom\.io/i,
    baseURL: "https://api.intercom.io",
    docsURL: "https://developers.intercom.com/docs/"
  },
  {
    id: "shopify",
    name: "Shopify",
    category: "other",
    urlPattern: /shopify\.com.*admin/i,
    baseURL: "https://your-store.myshopify.com/admin/api/2024-01",
    docsURL: "https://shopify.dev/docs/api",
    commonScopes: ["read_products", "write_products", "read_orders"]
  }
];
var Services = Object.fromEntries(
  SERVICE_DEFINITIONS.map((def) => [
    // Convert kebab-case to PascalCase for object key
    def.id.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(""),
    def.id
  ])
);
var SERVICE_URL_PATTERNS = SERVICE_DEFINITIONS.map((def) => ({
  service: def.id,
  pattern: def.urlPattern
}));
var SERVICE_INFO = Object.fromEntries(
  SERVICE_DEFINITIONS.map((def) => [
    def.id,
    {
      id: def.id,
      name: def.name,
      category: def.category,
      baseURL: def.baseURL,
      docsURL: def.docsURL,
      commonScopes: def.commonScopes
    }
  ])
);
var compiledPatterns = null;
function getCompiledPatterns() {
  if (!compiledPatterns) {
    compiledPatterns = SERVICE_DEFINITIONS.map((def) => ({
      service: def.id,
      pattern: def.urlPattern
    }));
  }
  return compiledPatterns;
}
function detectServiceFromURL(url) {
  const patterns = getCompiledPatterns();
  for (const { service, pattern } of patterns) {
    if (pattern.test(url)) {
      return service;
    }
  }
  return void 0;
}
function getServiceInfo(serviceType) {
  return SERVICE_INFO[serviceType];
}
function getServiceDefinition(serviceType) {
  return SERVICE_DEFINITIONS.find((def) => def.id === serviceType);
}
function getServicesByCategory(category) {
  return SERVICE_DEFINITIONS.filter((def) => def.category === category);
}
function getAllServiceIds() {
  return SERVICE_DEFINITIONS.map((def) => def.id);
}
function isKnownService(serviceId) {
  return SERVICE_DEFINITIONS.some((def) => def.id === serviceId);
}

export { LLM_MODELS, MODEL_REGISTRY, SERVICE_DEFINITIONS, SERVICE_INFO, SERVICE_URL_PATTERNS, Services, VENDORS, Vendor, calculateCost, detectServiceFromURL, getActiveModels, getAllServiceIds, getModelInfo, getModelsByVendor, getServiceDefinition, getServiceInfo, getServicesByCategory, isKnownService, isVendor };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map