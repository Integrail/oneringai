import { I as IProvider } from './IProvider-BP49c93d.js';

/**
 * Supported AI Vendors
 *
 * Use this enum instead of string literals for type safety.
 * These map to specific provider implementations.
 */
declare const Vendor: {
    readonly OpenAI: "openai";
    readonly Anthropic: "anthropic";
    readonly Google: "google";
    readonly GoogleVertex: "google-vertex";
    readonly Groq: "groq";
    readonly Together: "together";
    readonly Perplexity: "perplexity";
    readonly Grok: "grok";
    readonly DeepSeek: "deepseek";
    readonly Mistral: "mistral";
    readonly Ollama: "ollama";
    readonly Custom: "custom";
};
type Vendor = (typeof Vendor)[keyof typeof Vendor];
/**
 * All vendor values as array (useful for validation)
 */
declare const VENDORS: ("openai" | "anthropic" | "google" | "google-vertex" | "groq" | "together" | "perplexity" | "grok" | "deepseek" | "mistral" | "ollama" | "custom")[];
/**
 * Check if a string is a valid vendor
 */
declare function isVendor(value: string): value is Vendor;

/**
 * Connector - Represents authenticated connection to ANY API
 *
 * Connectors handle authentication for:
 * - AI providers (OpenAI, Anthropic, Google, etc.)
 * - External APIs (GitHub, Microsoft, Salesforce, etc.)
 *
 * This is the SINGLE source of truth for authentication.
 */

/**
 * Connector authentication configuration
 * Supports OAuth 2.0, API keys, and JWT bearer tokens
 */
type ConnectorAuth = OAuthConnectorAuth | APIKeyConnectorAuth | JWTConnectorAuth;
/**
 * OAuth 2.0 authentication for connectors
 * Supports multiple OAuth flows
 */
interface OAuthConnectorAuth {
    type: 'oauth';
    flow: 'authorization_code' | 'client_credentials' | 'jwt_bearer';
    clientId: string;
    clientSecret?: string;
    tokenUrl: string;
    authorizationUrl?: string;
    redirectUri?: string;
    scope?: string;
    usePKCE?: boolean;
    privateKey?: string;
    privateKeyPath?: string;
    issuer?: string;
    subject?: string;
    audience?: string;
    refreshBeforeExpiry?: number;
    storageKey?: string;
}
/**
 * Static API key authentication
 * For services like OpenAI, Anthropic, many SaaS APIs
 */
interface APIKeyConnectorAuth {
    type: 'api_key';
    apiKey: string;
    headerName?: string;
    headerPrefix?: string;
}
/**
 * JWT Bearer token authentication
 * For service accounts (Google, Salesforce)
 */
interface JWTConnectorAuth {
    type: 'jwt';
    privateKey: string;
    privateKeyPath?: string;
    tokenUrl: string;
    clientId: string;
    scope?: string;
    issuer?: string;
    subject?: string;
    audience?: string;
}
/**
 * Complete connector configuration
 * Used for BOTH AI providers AND external APIs
 */
interface ConnectorConfig {
    name?: string;
    vendor?: Vendor;
    serviceType?: string;
    auth: ConnectorAuth;
    displayName?: string;
    description?: string;
    baseURL?: string;
    defaultModel?: string;
    apiVersion?: string;
    rateLimit?: {
        requestsPerMinute?: number;
        requestsPerDay?: number;
    };
    documentation?: string;
    tags?: string[];
    options?: {
        organization?: string;
        project?: string;
        anthropicVersion?: string;
        location?: string;
        projectId?: string;
        [key: string]: unknown;
    };
    /**
     * Request timeout in milliseconds
     * @default 30000 (30 seconds)
     */
    timeout?: number;
    /**
     * Retry configuration for transient failures
     */
    retry?: {
        /** Maximum number of retry attempts @default 3 */
        maxRetries?: number;
        /** HTTP status codes that trigger retry @default [429, 500, 502, 503, 504] */
        retryableStatuses?: number[];
        /** Base delay in ms for exponential backoff @default 1000 */
        baseDelayMs?: number;
        /** Maximum delay in ms @default 30000 */
        maxDelayMs?: number;
    };
    /**
     * Circuit breaker configuration for failing services
     */
    circuitBreaker?: {
        /** Enable circuit breaker @default true */
        enabled?: boolean;
        /** Number of failures before opening circuit @default 5 */
        failureThreshold?: number;
        /** Number of successes to close circuit @default 2 */
        successThreshold?: number;
        /** Time in ms before attempting to close circuit @default 30000 */
        resetTimeoutMs?: number;
    };
    /**
     * Logging configuration for requests/responses
     */
    logging?: {
        /** Enable request/response logging @default false */
        enabled?: boolean;
        /** Log request/response bodies (security risk) @default false */
        logBody?: boolean;
        /** Log request/response headers (security risk) @default false */
        logHeaders?: boolean;
    };
}
/**
 * Result from ProviderConfigAgent
 * Includes setup instructions and environment variables
 */
interface ConnectorConfigResult {
    name: string;
    config: ConnectorConfig;
    setupInstructions: string;
    envVariables: string[];
    setupUrl?: string;
}

/**
 * Token storage interface (Clean Architecture - Domain Layer)
 * All implementations must encrypt tokens at rest
 */
interface StoredToken {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope?: string;
    obtained_at: number;
}
/**
 * Token storage interface
 * All implementations MUST encrypt tokens before storing
 */
interface ITokenStorage {
    /**
     * Store token (must be encrypted by implementation)
     *
     * @param key - Unique identifier for this token
     * @param token - Token data to store
     */
    storeToken(key: string, token: StoredToken): Promise<void>;
    /**
     * Retrieve token (must be decrypted by implementation)
     *
     * @param key - Unique identifier for the token
     * @returns Decrypted token or null if not found
     */
    getToken(key: string): Promise<StoredToken | null>;
    /**
     * Delete token
     *
     * @param key - Unique identifier for the token
     */
    deleteToken(key: string): Promise<void>;
    /**
     * Check if token exists
     *
     * @param key - Unique identifier for the token
     * @returns True if token exists
     */
    hasToken(key: string): Promise<boolean>;
}

/**
 * Connector - The single source of truth for authentication
 *
 * Manages authenticated connections to:
 * - AI providers (OpenAI, Anthropic, Google, etc.)
 * - External APIs (GitHub, Salesforce, etc.)
 *
 * Enterprise features:
 * - Request timeout with AbortController
 * - Circuit breaker for failing services
 * - Retry with exponential backoff
 * - Request/response logging
 */

/**
 * Default configuration values for resilience features
 */
declare const DEFAULT_CONNECTOR_TIMEOUT = 30000;
declare const DEFAULT_MAX_RETRIES = 3;
declare const DEFAULT_RETRYABLE_STATUSES: number[];
declare const DEFAULT_BASE_DELAY_MS = 1000;
declare const DEFAULT_MAX_DELAY_MS = 30000;
/**
 * Fetch options with additional connector-specific settings
 */
interface ConnectorFetchOptions extends RequestInit {
    /** Override timeout for this request */
    timeout?: number;
    /** Skip retry for this request */
    skipRetry?: boolean;
    /** Skip circuit breaker for this request */
    skipCircuitBreaker?: boolean;
}
/**
 * Connector class - represents a single authenticated connection
 */
declare class Connector {
    private static registry;
    private static defaultStorage;
    /**
     * Create and register a new connector
     * @param config - Must include `name` field
     */
    static create(config: ConnectorConfig & {
        name: string;
    }): Connector;
    /**
     * Get a connector by name
     */
    static get(name: string): Connector;
    /**
     * Check if a connector exists
     */
    static has(name: string): boolean;
    /**
     * List all registered connector names
     */
    static list(): string[];
    /**
     * Remove a connector
     */
    static remove(name: string): boolean;
    /**
     * Clear all connectors (useful for testing)
     */
    static clear(): void;
    /**
     * Set default token storage for OAuth connectors
     */
    static setDefaultStorage(storage: ITokenStorage): void;
    /**
     * Get all registered connectors
     */
    static listAll(): Connector[];
    /**
     * Get number of registered connectors
     */
    static size(): number;
    /**
     * Get connector descriptions formatted for tool parameters
     * Useful for generating dynamic tool descriptions
     */
    static getDescriptionsForTools(): string;
    /**
     * Get connector info (for tools and documentation)
     */
    static getInfo(): Record<string, {
        displayName: string;
        description: string;
        baseURL: string;
    }>;
    readonly name: string;
    readonly vendor?: Vendor;
    readonly config: ConnectorConfig;
    private oauthManager?;
    private circuitBreaker?;
    private disposed;
    private requestCount;
    private successCount;
    private failureCount;
    private totalLatencyMs;
    private constructor();
    /**
     * Initialize circuit breaker with config or defaults
     */
    private initCircuitBreaker;
    /**
     * Human-readable display name
     */
    get displayName(): string;
    /**
     * API base URL for this connector
     */
    get baseURL(): string;
    /**
     * Get the API key (for api_key auth type)
     */
    getApiKey(): string;
    /**
     * Get the current access token (for OAuth, JWT, or API key)
     * Handles automatic refresh if needed
     */
    getToken(userId?: string): Promise<string>;
    /**
     * Start OAuth authorization flow
     * Returns the URL to redirect the user to
     */
    startAuth(userId?: string): Promise<string>;
    /**
     * Handle OAuth callback
     * Call this after user is redirected back from OAuth provider
     */
    handleCallback(callbackUrl: string, userId?: string): Promise<void>;
    /**
     * Check if the connector has a valid token
     */
    hasValidToken(userId?: string): Promise<boolean>;
    /**
     * Get vendor-specific options from config
     */
    getOptions(): Record<string, unknown>;
    /**
     * Get the service type (explicit or undefined)
     */
    get serviceType(): string | undefined;
    /**
     * Get connector metrics
     */
    getMetrics(): {
        requestCount: number;
        successCount: number;
        failureCount: number;
        avgLatencyMs: number;
        circuitBreakerState?: string;
    };
    /**
     * Reset circuit breaker (force close)
     */
    resetCircuitBreaker(): void;
    /**
     * Make an authenticated fetch request using this connector
     * This is the foundation for all vendor-dependent tools
     *
     * Features:
     * - Timeout with AbortController
     * - Circuit breaker protection
     * - Retry with exponential backoff
     * - Request/response logging
     *
     * @param endpoint - API endpoint (relative to baseURL) or full URL
     * @param options - Fetch options with connector-specific settings
     * @param userId - Optional user ID for multi-user OAuth
     * @returns Fetch Response
     */
    fetch(endpoint: string, options?: ConnectorFetchOptions, userId?: string): Promise<Response>;
    /**
     * Make an authenticated fetch request and parse JSON response
     * Throws on non-OK responses
     *
     * @param endpoint - API endpoint (relative to baseURL) or full URL
     * @param options - Fetch options with connector-specific settings
     * @param userId - Optional user ID for multi-user OAuth
     * @returns Parsed JSON response
     */
    fetchJSON<T = unknown>(endpoint: string, options?: ConnectorFetchOptions, userId?: string): Promise<T>;
    private sleep;
    private logRequest;
    private logResponse;
    /**
     * Dispose of resources
     */
    dispose(): void;
    /**
     * Check if connector is disposed
     */
    isDisposed(): boolean;
    private initOAuthManager;
    private initJWTManager;
}

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
    quality?: 'standard' | 'hd';
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
 * Supported aspect ratios (Google Imagen)
 */
type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
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

export { type AudioFormat as A, type AspectRatio$1 as B, Connector as C, type OutputFormat as D, type ISourceLinks as E, DEFAULT_CONNECTOR_TIMEOUT as F, DEFAULT_MAX_RETRIES as G, DEFAULT_RETRYABLE_STATUSES as H, type IBaseModelDescription as I, type JWTConnectorAuth as J, DEFAULT_BASE_DELAY_MS as K, DEFAULT_MAX_DELAY_MS as L, type ConnectorFetchOptions as M, type OAuthConnectorAuth as O, type QualityLevel as Q, type StoredToken as S, type VendorOptionSchema as V, Vendor as a, type IImageProvider as b, type ITokenStorage as c, type ConnectorConfig as d, type ConnectorConfigResult as e, VENDORS as f, ImageGeneration as g, type ImageGenerationCreateOptions as h, isVendor as i, type SimpleGenerateOptions as j, type ConnectorAuth as k, type APIKeyConnectorAuth as l, type IImageModelDescription as m, type ImageModelCapabilities as n, type ImageModelPricing as o, IMAGE_MODELS as p, IMAGE_MODEL_REGISTRY as q, getImageModelInfo as r, getImageModelsByVendor as s, getActiveImageModels as t, getImageModelsWithFeature as u, calculateImageCost as v, type ImageGenerateOptions as w, type ImageEditOptions as x, type ImageVariationOptions as y, type ImageResponse as z };
