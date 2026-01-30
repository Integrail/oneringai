/**
 * Web Scrape Tool - Clean interface for LLM
 *
 * ARCHITECTURE:
 * - LLM sees simple interface: { url, timeout, includeHtml, includeMarkdown, includeLinks, waitForSelector }
 * - Connector configuration is INTERNAL (auto-detected by serviceType)
 * - Uses shared findConnectorByServiceTypes() utility
 * - Automatic fallback chain: native fetch -> JS rendering -> external API
 *
 * Supports: ZenRows, Jina Reader, Firecrawl, ScrapingBee
 */

import { ToolFunction } from '../../domain/entities/Tool.js';
import { ScrapeProvider } from '../../capabilities/scrape/index.js';
import { findConnectorByServiceTypes } from '../../capabilities/shared/index.js';
import type { ScrapeOptions, ScrapeResponse, ScrapeResult } from '../../capabilities/scrape/index.js';
import { webFetch } from './webFetch.js';
import { webFetchJS } from './webFetchJS.js';
import { logger } from '../../infrastructure/observability/Logger.js';

const scrapeLogger = logger.child({ component: 'webScrape' });

// ============ Internal Configuration (NOT exposed to LLM) ============

/**
 * Service types this tool supports for external API fallback
 * Used for auto-detecting available connectors
 */
const SCRAPE_SERVICE_TYPES = ['zenrows', 'jina-reader', 'firecrawl', 'scrapingbee'];

/**
 * Default minimum quality score to accept from native methods
 */
const DEFAULT_MIN_QUALITY = 50;

// ============ Tool Interface (what LLM sees) ============

/**
 * Arguments for web_scrape tool
 * CLEAN and SIMPLE - no connector/strategy details exposed
 */
interface WebScrapeArgs {
  /** URL to scrape */
  url: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to include raw HTML in response */
  includeHtml?: boolean;
  /** Whether to convert to markdown (if supported) */
  includeMarkdown?: boolean;
  /** Whether to extract links */
  includeLinks?: boolean;
  /** CSS selector to wait for (for JS-heavy sites) */
  waitForSelector?: string;
}

interface WebScrapeResult {
  /** Whether scraping succeeded */
  success: boolean;
  /** URL that was scraped */
  url: string;
  /** Final URL after redirects */
  finalUrl?: string;
  /** Method used: 'native', 'js', or external provider name */
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
  /** Quality score (0-100) */
  qualityScore?: number;
  /** Time taken in milliseconds */
  durationMs: number;
  /** Methods attempted before success */
  attemptedMethods: string[];
  /** Error message if failed */
  error?: string;
}

// ============ Tool Definition ============

export const webScrape: ToolFunction<WebScrapeArgs, WebScrapeResult> = {
  definition: {
    type: 'function',
    function: {
      name: 'web_scrape',
      description: `Scrape any URL with automatic fallback - guaranteed to work on most sites.

Automatically tries multiple methods in sequence:
1. Native fetch - Fast (~1s), works for blogs/docs/articles
2. JS rendering - Handles React/Vue/Angular SPAs
3. External API - Handles bot protection, CAPTCHAs (if configured)

RETURNS:
{
  success: boolean,
  url: string,
  finalUrl: string,        // After redirects
  method: string,          // 'native', 'js', or provider name
  title: string,
  content: string,         // Clean text
  html: string,            // If requested
  markdown: string,        // If requested
  metadata: {...},         // Title, description, author, etc.
  links: [{url, text}],    // If requested
  qualityScore: number,    // 0-100
  durationMs: number,
  attemptedMethods: []     // Methods tried
}

EXAMPLES:
Basic:
{ "url": "https://example.com/article" }

With options:
{
  "url": "https://example.com",
  "includeMarkdown": true,
  "includeLinks": true
}

For JS-heavy sites:
{
  "url": "https://spa-app.com",
  "waitForSelector": ".main-content"
}`,

      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to scrape. Must start with http:// or https://',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 30000)',
          },
          includeHtml: {
            type: 'boolean',
            description: 'Include raw HTML in response (default: false)',
          },
          includeMarkdown: {
            type: 'boolean',
            description: 'Include markdown conversion (default: false)',
          },
          includeLinks: {
            type: 'boolean',
            description: 'Extract and include links (default: false)',
          },
          waitForSelector: {
            type: 'string',
            description: 'CSS selector to wait for before scraping (for JS-heavy sites)',
          },
        },
        required: ['url'],
      },
    },
    blocking: true,
    timeout: 60000,
  },

  execute: async (args: WebScrapeArgs): Promise<WebScrapeResult> => {
    const startTime = Date.now();
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

    // Automatic fallback chain: native -> JS -> API

    // 1. Try native fetch first
    const native = await tryNative(args, startTime, attemptedMethods);
    if (native.success && (native.qualityScore ?? 0) >= DEFAULT_MIN_QUALITY) {
      return native;
    }

    // 2. Try JS rendering
    const js = await tryJS(args, startTime, attemptedMethods);
    if (js.success && (js.qualityScore ?? 0) >= DEFAULT_MIN_QUALITY) {
      return js;
    }

    // 3. Try external API if available
    const connector = findConnectorByServiceTypes(SCRAPE_SERVICE_TYPES);
    if (connector) {
      const api = await tryAPI(connector.name, args, startTime, attemptedMethods);
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
      error: 'All scraping methods failed. Site may have bot protection.',
    };
  },

  describeCall: (args: WebScrapeArgs) => args.url,
};

// ============ Internal Execution Functions ============

async function tryNative(
  args: WebScrapeArgs,
  startTime: number,
  attemptedMethods: string[]
): Promise<WebScrapeResult> {
  attemptedMethods.push('native');
  scrapeLogger.debug({ url: args.url }, 'Trying native fetch');

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
      // Note: raw HTML not available with native method (returns markdown instead)
      markdown: args.includeMarkdown ? result.content : undefined,
      qualityScore: result.qualityScore,
      durationMs: Date.now() - startTime,
      attemptedMethods,
      error: result.error,
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
  scrapeLogger.debug({ url: args.url }, 'Trying JS rendering');

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
      // Note: raw HTML not available with JS method (returns markdown instead)
      markdown: args.includeMarkdown ? result.content : undefined,
      qualityScore: result.success ? 80 : 0,
      durationMs: Date.now() - startTime,
      attemptedMethods,
      error: result.error,
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
    };
  }
}

async function tryAPI(
  connectorName: string,
  args: WebScrapeArgs,
  startTime: number,
  attemptedMethods: string[]
): Promise<WebScrapeResult> {
  attemptedMethods.push(`api:${connectorName}`);
  scrapeLogger.debug({ url: args.url, connectorName }, 'Trying external API');

  try {
    const provider = ScrapeProvider.create({ connector: connectorName });

    const options: ScrapeOptions = {
      timeout: args.timeout,
      waitForSelector: args.waitForSelector,
      includeHtml: args.includeHtml,
      includeMarkdown: args.includeMarkdown,
      includeLinks: args.includeLinks,
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
      qualityScore: result.success ? 90 : 0,
      durationMs: Date.now() - startTime,
      attemptedMethods,
      error: result.error,
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
