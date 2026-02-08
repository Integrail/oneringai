import { V as Vendor } from '../Vendor-DYh_bzwo.cjs';
export { a as VENDORS, i as isVendor } from '../Vendor-DYh_bzwo.cjs';

/**
 * Complete description of an LLM model including capabilities, pricing, and features
 */
interface ILLMDescription {
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
declare const LLM_MODELS: {
    readonly openai: {
        readonly GPT_5_2: "gpt-5.2";
        readonly GPT_5_2_PRO: "gpt-5.2-pro";
        readonly GPT_5: "gpt-5";
        readonly GPT_5_MINI: "gpt-5-mini";
        readonly GPT_5_NANO: "gpt-5-nano";
        readonly GPT_4_1: "gpt-4.1";
        readonly GPT_4_1_MINI: "gpt-4.1-mini";
        readonly GPT_4_1_NANO: "gpt-4.1-nano";
        readonly GPT_4O: "gpt-4o";
        readonly GPT_4O_MINI: "gpt-4o-mini";
        readonly O3_MINI: "o3-mini";
        readonly O1: "o1";
    };
    readonly anthropic: {
        readonly CLAUDE_OPUS_4_5: "claude-opus-4-5-20251101";
        readonly CLAUDE_SONNET_4_5: "claude-sonnet-4-5-20250929";
        readonly CLAUDE_HAIKU_4_5: "claude-haiku-4-5-20251001";
        readonly CLAUDE_OPUS_4_1: "claude-opus-4-1-20250805";
        readonly CLAUDE_SONNET_4: "claude-sonnet-4-20250514";
        readonly CLAUDE_SONNET_3_7: "claude-3-7-sonnet-20250219";
        readonly CLAUDE_HAIKU_3: "claude-3-haiku-20240307";
    };
    readonly google: {
        readonly GEMINI_3_FLASH_PREVIEW: "gemini-3-flash-preview";
        readonly GEMINI_3_PRO_PREVIEW: "gemini-3-pro-preview";
        readonly GEMINI_3_PRO_IMAGE_PREVIEW: "gemini-3-pro-image-preview";
        readonly GEMINI_2_5_PRO: "gemini-2.5-pro";
        readonly GEMINI_2_5_FLASH: "gemini-2.5-flash";
        readonly GEMINI_2_5_FLASH_LITE: "gemini-2.5-flash-lite";
        readonly GEMINI_2_5_FLASH_IMAGE: "gemini-2.5-flash-image";
    };
    readonly grok: {
        readonly GROK_4_1_FAST_REASONING: "grok-4-1-fast-reasoning";
        readonly GROK_4_1_FAST_NON_REASONING: "grok-4-1-fast-non-reasoning";
        readonly GROK_4_FAST_REASONING: "grok-4-fast-reasoning";
        readonly GROK_4_FAST_NON_REASONING: "grok-4-fast-non-reasoning";
        readonly GROK_4_0709: "grok-4-0709";
        readonly GROK_CODE_FAST_1: "grok-code-fast-1";
        readonly GROK_3: "grok-3";
        readonly GROK_3_MINI: "grok-3-mini";
        readonly GROK_2_VISION_1212: "grok-2-vision-1212";
    };
};
/**
 * Complete model registry with all model metadata
 * Updated: January 2026 - Verified from official vendor documentation
 */
declare const MODEL_REGISTRY: Record<string, ILLMDescription>;
/**
 * Get model information by name
 * @param modelName The model identifier
 * @returns Model description or undefined if not found
 */
declare function getModelInfo(modelName: string): ILLMDescription | undefined;
/**
 * Get all models for a specific vendor
 * @param vendor The vendor to filter by
 * @returns Array of model descriptions for the vendor
 */
declare function getModelsByVendor(vendor: Vendor): ILLMDescription[];
/**
 * Get all currently active models
 * @returns Array of active model descriptions
 */
declare function getActiveModels(): ILLMDescription[];
/**
 * Calculate the cost for a given model and token usage
 * @param model Model name
 * @param inputTokens Number of input tokens
 * @param outputTokens Number of output tokens
 * @param options Optional calculation options
 * @returns Total cost in dollars, or null if model not found
 */
declare function calculateCost(model: string, inputTokens: number, outputTokens: number, options?: {
    useCachedInput?: boolean;
}): number | null;

/**
 * Services - Single source of truth for external service definitions
 *
 * All service metadata is defined in one place (SERVICE_DEFINITIONS).
 * Other exports are derived from this to maintain DRY principles.
 */
/**
 * Service category type
 */
type ServiceCategory = 'major-vendors' | 'communication' | 'development' | 'productivity' | 'crm' | 'payments' | 'cloud' | 'storage' | 'email' | 'monitoring' | 'search' | 'scrape' | 'other';
/**
 * Complete service definition - single source of truth
 */
interface ServiceDefinition {
    /** Unique identifier (e.g., 'slack', 'github') */
    id: string;
    /** Human-readable name (e.g., 'Slack', 'GitHub') */
    name: string;
    /** Service category */
    category: ServiceCategory;
    /** URL pattern for auto-detection from baseURL */
    urlPattern: RegExp;
    /** Default base URL for API calls */
    baseURL: string;
    /** Documentation URL */
    docsURL?: string;
    /** Common OAuth scopes */
    commonScopes?: string[];
}
/**
 * Master list of all service definitions
 * This is the SINGLE SOURCE OF TRUTH - all other exports derive from this
 */
declare const SERVICE_DEFINITIONS: readonly ServiceDefinition[];
/**
 * Service type - union of all service IDs
 */
type ServiceType = (typeof SERVICE_DEFINITIONS)[number]['id'];
/**
 * Services constant object for easy access
 * Usage: Services.Slack, Services.GitHub, etc.
 */
declare const Services: { [K in string]: ServiceType; };
/**
 * URL patterns for auto-detection (derived from SERVICE_DEFINITIONS)
 */
declare const SERVICE_URL_PATTERNS: ReadonlyArray<{
    service: string;
    pattern: RegExp;
}>;
/**
 * Service info lookup (derived from SERVICE_DEFINITIONS)
 */
interface ServiceInfo {
    id: string;
    name: string;
    category: ServiceCategory;
    baseURL: string;
    docsURL?: string;
    commonScopes?: string[];
}
/**
 * Service info map (derived from SERVICE_DEFINITIONS)
 */
declare const SERVICE_INFO: Record<string, ServiceInfo>;
/**
 * Detect service type from a URL
 * @param url - Base URL or full URL to check
 * @returns Service type string or undefined if not recognized
 */
declare function detectServiceFromURL(url: string): string | undefined;
/**
 * Get service info by service type
 */
declare function getServiceInfo(serviceType: string): ServiceInfo | undefined;
/**
 * Get service definition by service type
 */
declare function getServiceDefinition(serviceType: string): ServiceDefinition | undefined;
/**
 * Get all services in a category
 */
declare function getServicesByCategory(category: ServiceCategory): ServiceDefinition[];
/**
 * Get all service IDs
 */
declare function getAllServiceIds(): string[];
/**
 * Check if a service ID is known
 */
declare function isKnownService(serviceId: string): boolean;

export { type ILLMDescription, LLM_MODELS, MODEL_REGISTRY, SERVICE_DEFINITIONS, SERVICE_INFO, SERVICE_URL_PATTERNS, type ServiceCategory, type ServiceDefinition, type ServiceInfo, type ServiceType, Services, Vendor, Vendor as VendorType, calculateCost, detectServiceFromURL, getActiveModels, getAllServiceIds, getModelInfo, getModelsByVendor, getServiceDefinition, getServiceInfo, getServicesByCategory, isKnownService };
