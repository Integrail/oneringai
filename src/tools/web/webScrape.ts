/**
 * Web Scrape Tool - Guaranteed URL reading with automatic fallback
 *
 * This tool provides a "just works" approach to reading any URL by trying
 * multiple methods in sequence:
 *
 * 1. Native fetch (webFetch) - Fast, free, works for static sites
 * 2. JS rendering (webFetchJS) - Handles SPAs, requires Puppeteer
 * 3. External API provider - Handles bot protection, CAPTCHAs, etc.
 *
 * ARCHITECTURE:
 * - Surface API: webScrape tool (this file)
 * - Provider API: ScrapeProvider (handles external API vendors)
 * - Native fallback: Uses existing webFetch/webFetchJS tools
 *
 * The tool automatically selects the best method based on:
 * - Quality score from native fetch
 * - Whether JS rendering is required
 * - Whether external API providers are configured
 */

import { ToolFunction } from '../../domain/entities/Tool.js';
import { Connector } from '../../core/Connector.js';
import { ScrapeProvider, getRegisteredScrapeProviders } from '../../capabilities/scrape/index.js';
import type { ScrapeOptions, ScrapeResponse, ScrapeResult } from '../../capabilities/scrape/index.js';
import { webFetch } from './webFetch.js';
import { webFetchJS } from './webFetchJS.js';

// ============ Tool Args & Result ============

interface WebScrapeArgs {
  /** URL to scrape */
  url: string;

  /**
   * Scraping strategy:
   * - 'auto': Try native -> JS -> API (default)
   * - 'native': Only use native fetch
   * - 'js': Only use JS rendering
   * - 'api': Only use external API provider
   * - 'api-first': Try API first, then native
   */
  strategy?: 'auto' | 'native' | 'js' | 'api' | 'api-first';

  /**
   * Connector name for external API provider
   * Required if strategy is 'api' or 'api-first'
   * Optional for 'auto' (will be used as final fallback)
   */
  connectorName?: string;

  /**
   * Minimum quality score to accept from native fetch (0-100)
   * If native fetch returns lower score, will try next method
   * Default: 50
   */
  minQualityScore?: number;

  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Whether to include raw HTML in response */
  includeHtml?: boolean;

  /** Whether to convert to markdown (if supported by provider) */
  includeMarkdown?: boolean;

  /** Whether to extract links */
  includeLinks?: boolean;

  /** CSS selector to wait for (JS/API only) */
  waitForSelector?: string;

  /** Vendor-specific options for API provider */
  vendorOptions?: Record<string, any>;
}

interface WebScrapeResult {
  /** Whether scraping succeeded */
  success: boolean;
  /** URL that was scraped */
  url: string;
  /** Final URL after redirects */
  finalUrl?: string;
  /** Method used: 'native', 'js', or provider name */
  method: string;
  /** Page title */
  title: string;
  /** Extracted text content */
  content: string;
  /** Raw HTML (if requested) */
  html?: string;
  /** Markdown version (if requested and supported) */
  markdown?: string;
  /** Extracted metadata */
  metadata?: ScrapeResult['metadata'];
  /** Extracted links (if requested) */
  links?: ScrapeResult['links'];
  /** Quality score (0-100) for native/js methods */
  qualityScore?: number;
  /** Time taken in milliseconds */
  durationMs: number;
  /** Methods attempted before success */
  attemptedMethods: string[];
  /** Error message if failed */
  error?: string;
  /** Suggestion for improvement */
  suggestion?: string;
}

// ============ Tool Definition ============

export const webScrape: ToolFunction<WebScrapeArgs, WebScrapeResult> = {
  definition: {
    type: 'function',
    function: {
      name: 'web_scrape',
      description: `Scrape any URL with automatic fallback - guaranteed to work on most sites.

This tool combines multiple scraping methods to ensure content extraction:

SCRAPING STRATEGIES:
- auto (default): Tries native -> JS -> API until one succeeds
- native: Only native HTTP fetch (fast, free, static sites only)
- js: Only JavaScript rendering (handles SPAs, needs Puppeteer)
- api: Only external API provider (handles bot protection)
- api-first: Tries API first, then falls back to native

FALLBACK CHAIN (auto strategy):
1. Native fetch - Fast (~1s), free, works for blogs/docs/articles
2. JS rendering - Slower (~5s), handles React/Vue/Angular
3. External API - Handles bot protection, CAPTCHAs, rate limits

EXTERNAL API PROVIDERS:
Configure a connector with a scraping service:
- Jina AI Reader (free tier available)
- Firecrawl (advanced features)
- ScrapingBee (proxy rotation)
- etc.

WHEN TO USE EACH STRATEGY:
- 'auto': Most cases - let the tool figure it out
- 'native': When you know the site is static
- 'js': When you know it's a React/Vue/Angular app
- 'api': When site has bot protection or rate limits
- 'api-first': When you want best quality regardless of cost

RETURNS:
{
  success: boolean,
  url: string,
  finalUrl: string,        // After redirects
  method: string,          // 'native', 'js', or provider name
  title: string,
  content: string,         // Clean text
  html: string,            // If requested
  markdown: string,        // If requested and supported
  metadata: {...},         // Title, description, author, etc.
  links: [{url, text}],    // If requested
  qualityScore: number,    // 0-100
  durationMs: number,
  attemptedMethods: [],    // Methods tried
  error: string,           // If failed
  suggestion: string       // How to fix
}

EXAMPLES:
Basic (auto strategy):
{ "url": "https://example.com/article" }

With API fallback:
{
  "url": "https://protected-site.com",
  "connectorName": "jina-reader",
  "strategy": "auto"
}

Force API provider:
{
  "url": "https://hard-to-scrape.com",
  "connectorName": "firecrawl-main",
  "strategy": "api",
  "includeMarkdown": true
}

High quality threshold:
{
  "url": "https://example.com",
  "minQualityScore": 80,
  "strategy": "auto"
}`,

      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to scrape. Must start with http:// or https://',
          },
          strategy: {
            type: 'string',
            enum: ['auto', 'native', 'js', 'api', 'api-first'],
            description: 'Scraping strategy. Default: "auto"',
          },
          connectorName: {
            type: 'string',
            description: 'Connector name for external API provider (e.g., "jina-reader", "firecrawl-main")',
          },
          minQualityScore: {
            type: 'number',
            description: 'Minimum quality score (0-100) to accept from native methods. Default: 50',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds. Default: 30000',
          },
          includeHtml: {
            type: 'boolean',
            description: 'Include raw HTML in response. Default: false',
          },
          includeMarkdown: {
            type: 'boolean',
            description: 'Include markdown conversion (if supported). Default: false',
          },
          includeLinks: {
            type: 'boolean',
            description: 'Extract and include links. Default: false',
          },
          waitForSelector: {
            type: 'string',
            description: 'CSS selector to wait for (JS/API strategies only)',
          },
          vendorOptions: {
            type: 'object',
            description: 'Vendor-specific options for API provider',
          },
        },
        required: ['url'],
      },
    },
    blocking: true,
    timeout: 60000, // Allow time for all fallbacks
  },

  execute: async (args: WebScrapeArgs): Promise<WebScrapeResult> => {
    const startTime = Date.now();
    const strategy = args.strategy || 'auto';
    const minQuality = args.minQualityScore ?? 50;
    const attemptedMethods: string[] = [];

    // Validate URL
    try {
      new URL(args.url);
    } catch {
      return {
        success: false,
        url: args.url,
        method: 'none',
        title: '',
        content: '',
        durationMs: Date.now() - startTime,
        attemptedMethods: [],
        error: 'Invalid URL format',
      };
    }

    // Strategy execution
    switch (strategy) {
      case 'native':
        return await tryNative(args, startTime, attemptedMethods);

      case 'js':
        return await tryJS(args, startTime, attemptedMethods);

      case 'api':
        return await tryAPI(args, startTime, attemptedMethods);

      case 'api-first':
        // Try API first, then native
        if (args.connectorName) {
          const apiResult = await tryAPI(args, startTime, attemptedMethods);
          if (apiResult.success) return apiResult;
        }
        const nativeResult = await tryNative(args, startTime, attemptedMethods);
        if (nativeResult.success) return nativeResult;
        return await tryJS(args, startTime, attemptedMethods);

      case 'auto':
      default:
        // Try native -> JS -> API
        const native = await tryNative(args, startTime, attemptedMethods);
        if (native.success && (native.qualityScore ?? 0) >= minQuality) {
          return native;
        }

        const js = await tryJS(args, startTime, attemptedMethods);
        if (js.success && (js.qualityScore ?? 0) >= minQuality) {
          return js;
        }

        // Try API if configured
        if (args.connectorName || hasAvailableScrapeConnector()) {
          const api = await tryAPI(args, startTime, attemptedMethods);
          if (api.success) return api;
        }

        // Return best result we got
        if (js.success) return js;
        if (native.success) return native;

        return {
          success: false,
          url: args.url,
          method: 'none',
          title: '',
          content: '',
          durationMs: Date.now() - startTime,
          attemptedMethods,
          error: 'All scraping methods failed',
          suggestion: args.connectorName
            ? 'Check connector configuration and API key'
            : 'Configure an external scraping API connector for better results',
        };
    }
  },

  describeCall: (args: WebScrapeArgs) => {
    const strategy = args.strategy || 'auto';
    if (args.connectorName) {
      return `${args.url} (${strategy}, ${args.connectorName})`;
    }
    return `${args.url} (${strategy})`;
  },
};

// ============ Strategy Implementations ============

async function tryNative(
  args: WebScrapeArgs,
  startTime: number,
  attemptedMethods: string[]
): Promise<WebScrapeResult> {
  attemptedMethods.push('native');

  try {
    const result = await webFetch.execute({
      url: args.url,
      timeout: args.timeout || 10000,
    });

    return {
      success: result.success,
      url: args.url,
      finalUrl: args.url,
      method: 'native',
      title: result.title,
      content: result.content,
      html: args.includeHtml ? result.html : undefined,
      qualityScore: result.qualityScore,
      durationMs: Date.now() - startTime,
      attemptedMethods,
      error: result.error,
      suggestion: result.requiresJS
        ? 'Site requires JavaScript - try strategy "js" or "api"'
        : result.suggestedAction,
    };
  } catch (error: any) {
    return {
      success: false,
      url: args.url,
      method: 'native',
      title: '',
      content: '',
      durationMs: Date.now() - startTime,
      attemptedMethods,
      error: error.message,
    };
  }
}

async function tryJS(
  args: WebScrapeArgs,
  startTime: number,
  attemptedMethods: string[]
): Promise<WebScrapeResult> {
  attemptedMethods.push('js');

  try {
    const result = await webFetchJS.execute({
      url: args.url,
      timeout: args.timeout || 15000,
      waitForSelector: args.waitForSelector,
    });

    return {
      success: result.success,
      url: args.url,
      finalUrl: args.url,
      method: 'js',
      title: result.title,
      content: result.content,
      html: args.includeHtml ? result.html : undefined,
      qualityScore: result.success ? 80 : 0, // JS rendering typically gives good quality
      durationMs: Date.now() - startTime,
      attemptedMethods,
      error: result.error,
      suggestion: result.suggestion,
    };
  } catch (error: any) {
    return {
      success: false,
      url: args.url,
      method: 'js',
      title: '',
      content: '',
      durationMs: Date.now() - startTime,
      attemptedMethods,
      error: error.message,
      suggestion: error.message.includes('Puppeteer')
        ? 'Install Puppeteer: npm install puppeteer'
        : undefined,
    };
  }
}

async function tryAPI(
  args: WebScrapeArgs,
  startTime: number,
  attemptedMethods: string[]
): Promise<WebScrapeResult> {
  // Find connector to use
  const connectorName = args.connectorName || findAvailableScrapeConnector();

  if (!connectorName) {
    return {
      success: false,
      url: args.url,
      method: 'api',
      title: '',
      content: '',
      durationMs: Date.now() - startTime,
      attemptedMethods,
      error: 'No scraping API connector configured',
      suggestion: 'Create a connector with a scraping service (e.g., Jina, Firecrawl)',
    };
  }

  attemptedMethods.push(`api:${connectorName}`);

  try {
    const provider = ScrapeProvider.create({ connector: connectorName });

    const options: ScrapeOptions = {
      timeout: args.timeout,
      waitForSelector: args.waitForSelector,
      includeHtml: args.includeHtml,
      includeMarkdown: args.includeMarkdown,
      includeLinks: args.includeLinks,
      vendorOptions: args.vendorOptions,
    };

    const result: ScrapeResponse = await provider.scrape(args.url, options);

    return {
      success: result.success,
      url: args.url,
      finalUrl: result.finalUrl,
      method: result.provider,
      title: result.result?.title || '',
      content: result.result?.content || '',
      html: result.result?.html,
      markdown: result.result?.markdown,
      metadata: result.result?.metadata,
      links: result.result?.links,
      qualityScore: result.success ? 90 : 0, // API providers typically give high quality
      durationMs: Date.now() - startTime,
      attemptedMethods,
      error: result.error,
      suggestion: result.suggestedFallback,
    };
  } catch (error: any) {
    return {
      success: false,
      url: args.url,
      method: 'api',
      title: '',
      content: '',
      durationMs: Date.now() - startTime,
      attemptedMethods,
      error: error.message,
    };
  }
}

// ============ Helpers ============

/**
 * Check if any scrape connector is available
 */
function hasAvailableScrapeConnector(): boolean {
  return findAvailableScrapeConnector() !== undefined;
}

/**
 * Find an available scrape connector
 */
function findAvailableScrapeConnector(): string | undefined {
  const registeredProviders = getRegisteredScrapeProviders();
  if (registeredProviders.length === 0) return undefined;

  const allConnectors = Connector.list();

  for (const connectorName of allConnectors) {
    try {
      const connector = Connector.get(connectorName);
      if (connector?.serviceType && registeredProviders.includes(connector.serviceType)) {
        return connectorName;
      }
    } catch {
      // Ignore errors
    }
  }

  return undefined;
}
