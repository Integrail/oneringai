/**
 * ScrapeProvider - Unified web scraping interface with connector support
 *
 * Provides a consistent API for web scraping across multiple vendors.
 * Uses Connector-First architecture for authentication.
 *
 * This is the surface API - actual scraping is delegated to vendor-specific
 * providers based on the Connector's serviceType.
 *
 * DESIGN PATTERN:
 * - IScrapeProvider: Interface all providers implement
 * - ScrapeProvider.create(): Factory that returns the right provider
 * - ScrapeProvider.createWithFallback(): Factory with fallback chain
 *
 * FALLBACK STRATEGY:
 * The webScrape tool uses this provider with a fallback chain:
 * 1. Try native fetch (webFetch) - fastest, free
 * 2. Try JS rendering (webFetchJS) - handles SPAs
 * 3. Try external API provider - handles bot protection, etc.
 */

import { Connector } from '../../core/Connector.js';
import { resolveConnector, type BaseProviderResponse } from '../shared/index.js';

// ============ Result Types ============

/**
 * Scraped content result
 */
export interface ScrapeResult {
  /** Page title */
  title: string;
  /** Extracted text content (cleaned) */
  content: string;
  /** Raw HTML (if available) */
  html?: string;
  /** Markdown version (if provider supports it) */
  markdown?: string;
  /** Metadata extracted from the page */
  metadata?: {
    description?: string;
    author?: string;
    publishedDate?: string;
    siteName?: string;
    favicon?: string;
    ogImage?: string;
    [key: string]: any;
  };
  /** Screenshot as base64 (if requested and supported) */
  screenshot?: string;
  /** Links found on the page */
  links?: Array<{ url: string; text: string }>;
}

/**
 * Scrape options
 */
export interface ScrapeOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to wait for JavaScript to render (if supported) */
  waitForJS?: boolean;
  /** CSS selector to wait for before scraping */
  waitForSelector?: string;
  /** Whether to include raw HTML in response */
  includeHtml?: boolean;
  /** Whether to convert to markdown (if supported) */
  includeMarkdown?: boolean;
  /** Whether to extract links */
  includeLinks?: boolean;
  /** Whether to take a screenshot (if supported) */
  includeScreenshot?: boolean;
  /** Custom headers to send */
  headers?: Record<string, string>;
  /** Vendor-specific options */
  vendorOptions?: Record<string, any>;
}

/**
 * Scrape response
 */
export interface ScrapeResponse extends BaseProviderResponse {
  /** The URL that was scraped */
  url: string;
  /** Final URL after redirects */
  finalUrl?: string;
  /** Scraped content */
  result?: ScrapeResult;
  /** HTTP status code */
  statusCode?: number;
  /** Time taken in milliseconds */
  durationMs?: number;
  /** Whether the content required JavaScript rendering */
  requiredJS?: boolean;
  /** Suggested fallback if this provider failed */
  suggestedFallback?: string;
}

// ============ Provider Interface ============

/**
 * Base ScrapeProvider interface
 * All scraping providers must implement this interface
 */
export interface IScrapeProvider {
  /** Provider name (e.g., 'jina', 'firecrawl', 'scrapingbee') */
  readonly name: string;

  /** Connector used for authentication */
  readonly connector: Connector;

  /**
   * Scrape a URL and extract content
   * @param url - URL to scrape
   * @param options - Scrape options
   * @returns Scrape response with content or error
   */
  scrape(url: string, options?: ScrapeOptions): Promise<ScrapeResponse>;

  /**
   * Check if this provider supports a specific feature
   * @param feature - Feature name
   */
  supportsFeature?(feature: ScrapeFeature): boolean;
}

/**
 * Features that scrape providers may support
 */
export type ScrapeFeature =
  | 'javascript'      // Can render JavaScript
  | 'markdown'        // Can convert to markdown
  | 'screenshot'      // Can take screenshots
  | 'links'           // Can extract links
  | 'metadata'        // Can extract metadata
  | 'proxy'           // Uses proxy rotation
  | 'stealth'         // Has anti-bot detection bypass
  | 'pdf'             // Can scrape PDFs
  | 'dynamic';        // Can handle dynamic content

// ============ Provider Registry ============

/**
 * Provider constructor type
 */
type ProviderConstructor = new (connector: Connector) => IScrapeProvider;

/**
 * Registry of service types to provider constructors
 * Providers register themselves here
 */
const providerRegistry = new Map<string, ProviderConstructor>();

/**
 * Register a scrape provider for a service type
 * Called by provider implementations to register themselves
 *
 * @param serviceType - Service type (e.g., 'jina', 'firecrawl')
 * @param providerClass - Provider constructor
 */
export function registerScrapeProvider(
  serviceType: string,
  providerClass: ProviderConstructor
): void {
  providerRegistry.set(serviceType, providerClass);
}

/**
 * Get registered service types
 */
export function getRegisteredScrapeProviders(): string[] {
  return Array.from(providerRegistry.keys());
}

// ============ Factory Configuration ============

/**
 * ScrapeProvider factory configuration
 */
export interface ScrapeProviderConfig {
  /** Connector name or instance */
  connector: string | Connector;
}

/**
 * Fallback chain configuration
 */
export interface ScrapeProviderFallbackConfig {
  /** Primary connector to try first */
  primary: string | Connector;
  /** Fallback connectors to try in order */
  fallbacks?: Array<string | Connector>;
  /** Whether to try native fetch before API providers */
  tryNativeFirst?: boolean;
}

// ============ Factory Class ============

/**
 * ScrapeProvider factory
 *
 * Creates the appropriate provider based on Connector's serviceType.
 * Use createWithFallback() for automatic fallback on failure.
 */
export class ScrapeProvider {
  /**
   * Create a scrape provider from a connector
   *
   * @param config - Provider configuration
   * @returns Scrape provider instance
   * @throws Error if connector not found or service type not supported
   *
   * @example
   * ```typescript
   * const scraper = ScrapeProvider.create({ connector: 'jina-main' });
   * const result = await scraper.scrape('https://example.com');
   * ```
   */
  static create(config: ScrapeProviderConfig): IScrapeProvider {
    const connector = resolveConnector(config.connector);
    const serviceType = connector.serviceType;

    if (!serviceType) {
      throw new Error(
        `Connector '${connector.name}' has no serviceType. ` +
        `Set serviceType when creating the connector.`
      );
    }

    const ProviderClass = providerRegistry.get(serviceType);

    if (!ProviderClass) {
      const registered = getRegisteredScrapeProviders();
      throw new Error(
        `No scrape provider registered for service type '${serviceType}'. ` +
        `Registered providers: ${registered.length > 0 ? registered.join(', ') : 'none'}. ` +
        `Make sure to import the provider module.`
      );
    }

    return new ProviderClass(connector);
  }

  /**
   * Check if a service type has a registered provider
   */
  static hasProvider(serviceType: string): boolean {
    return providerRegistry.has(serviceType);
  }

  /**
   * List all registered provider service types
   */
  static listProviders(): string[] {
    return getRegisteredScrapeProviders();
  }

  /**
   * Create a scrape provider with fallback chain
   *
   * Returns a provider that will try each connector in order until one succeeds.
   *
   * @param config - Fallback configuration
   * @returns Scrape provider with fallback support
   *
   * @example
   * ```typescript
   * const scraper = ScrapeProvider.createWithFallback({
   *   primary: 'jina-main',
   *   fallbacks: ['firecrawl-backup', 'scrapingbee'],
   * });
   * // Will try jina first, then firecrawl, then scrapingbee
   * const result = await scraper.scrape('https://example.com');
   * ```
   */
  static createWithFallback(config: ScrapeProviderFallbackConfig): IScrapeProvider {
    const providers: IScrapeProvider[] = [];

    // Add primary
    providers.push(ScrapeProvider.create({ connector: config.primary }));

    // Add fallbacks
    if (config.fallbacks) {
      for (const fallback of config.fallbacks) {
        try {
          providers.push(ScrapeProvider.create({ connector: fallback }));
        } catch {
          // Skip invalid connectors in fallback chain
        }
      }
    }

    return new FallbackScrapeProvider(providers);
  }
}

// ============ Fallback Provider ============

/**
 * Internal provider that implements fallback chain
 */
class FallbackScrapeProvider implements IScrapeProvider {
  readonly name = 'fallback';
  readonly connector: Connector;

  constructor(private providers: IScrapeProvider[]) {
    if (providers.length === 0) {
      throw new Error('At least one provider required for fallback chain');
    }
    // Use first provider's connector as the "main" one
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.connector = providers[0]!.connector;
  }

  async scrape(url: string, options?: ScrapeOptions): Promise<ScrapeResponse> {
    let lastError: string | undefined;
    const attemptedProviders: string[] = [];

    for (const provider of this.providers) {
      attemptedProviders.push(provider.name);

      try {
        const result = await provider.scrape(url, options);

        if (result.success) {
          return {
            ...result,
            provider: `fallback(${provider.name})`,
          };
        }

        lastError = result.error;
      } catch (error: any) {
        lastError = error.message;
      }
    }

    return {
      success: false,
      url,
      provider: 'fallback',
      error: `All providers failed. Tried: ${attemptedProviders.join(' -> ')}. Last error: ${lastError}`,
    };
  }

  supportsFeature(feature: ScrapeFeature): boolean {
    // Returns true if ANY provider supports the feature
    return this.providers.some(p => p.supportsFeature?.(feature));
  }
}
