/**
 * Web Scrape Tool Factory
 *
 * Creates a web_scrape tool bound to a specific Connector.
 * Follows the ConnectorTools pattern (like GitHub tools).
 *
 * Fallback chain:
 * 1. Native fetch (free/fast) via webFetch
 * 2. External API via the bound connector (e.g., ZenRows, Firecrawl)
 *
 * Usage:
 *   ConnectorTools.registerService('zenrows', (connector) => [createWebScrapeTool(connector)]);
 *   // or directly:
 *   const tool = createWebScrapeTool(myConnector);
 */

import type { Connector } from '../../core/Connector.js';
import type { ToolFunction } from '../../domain/entities/Tool.js';
import { ScrapeProvider } from '../../capabilities/scrape/index.js';
import type { ScrapeOptions, ScrapeResponse, ScrapeResult } from '../../capabilities/scrape/index.js';
import { webFetch } from './webFetch.js';
import { logger } from '../../infrastructure/observability/Logger.js';

const scrapeLogger = logger.child({ component: 'webScrape' });

/**
 * Default minimum quality score to accept from native methods
 */
const DEFAULT_MIN_QUALITY = 50;

/**
 * Strip base64 data URIs from content to prevent context overflow.
 * Removes inline images, fonts, and other embedded data.
 */
function stripBase64DataUris(content: string): string {
  if (!content) return content;

  // Strip markdown images with base64 data URIs: ![alt](data:...)
  let cleaned = content.replace(/!\[[^\]]*\]\(data:[^)]+\)/g, '[image removed]');

  // Strip CSS url() with data URIs
  cleaned = cleaned.replace(/url\(['"]?data:[^)]+['"]?\)/gi, 'url([data-uri-removed])');

  // Strip raw base64 data URIs in other contexts
  cleaned = cleaned.replace(/data:(?:image|font|application)\/[^;]+;base64,[A-Za-z0-9+/=]{100,}/g, '[base64-data-removed]');

  return cleaned;
}

/**
 * Arguments for web_scrape tool
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
  /** Method used: 'native' or external provider name */
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

/**
 * Create a web_scrape tool bound to a specific connector.
 *
 * @param connector - Connector instance providing auth for the scrape API
 * @param userId - Optional user ID for multi-user OAuth
 */
export function createWebScrapeTool(
  connector: Connector,
  _userId?: string
): ToolFunction<WebScrapeArgs, WebScrapeResult> {

  // ============ Internal Helpers ============

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

      // Strip base64 data URIs to prevent context overflow
      const cleanContent = stripBase64DataUris(result.content);

      return {
        success: result.success,
        url: args.url,
        finalUrl: args.url,
        method: 'native',
        title: result.title,
        content: cleanContent,
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

  async function tryAPI(
    args: WebScrapeArgs,
    startTime: number,
    attemptedMethods: string[]
  ): Promise<WebScrapeResult> {
    attemptedMethods.push(`api:${connector.name}`);
    scrapeLogger.debug({ url: args.url, connectorName: connector.name }, 'Trying external API');

    try {
      const provider = ScrapeProvider.create({ connector: connector.name });

      const options: ScrapeOptions = {
        timeout: args.timeout,
        waitForSelector: args.waitForSelector,
        includeHtml: args.includeHtml,
        includeMarkdown: args.includeMarkdown,
        includeLinks: args.includeLinks,
      };

      const result: ScrapeResponse = await provider.scrape(args.url, options);

      // Strip base64 data URIs to prevent context overflow
      const rawContent = result.result?.content || '';
      const rawMarkdown = result.result?.markdown;
      const cleanContent = stripBase64DataUris(rawContent);
      const cleanMarkdown = rawMarkdown ? stripBase64DataUris(rawMarkdown) : undefined;

      // Avoid returning duplicate content in both `content` and `markdown`.
      const isDuplicate = !!cleanMarkdown && cleanContent === cleanMarkdown;

      return {
        success: result.success,
        url: args.url,
        finalUrl: result.finalUrl,
        method: result.provider,
        title: result.result?.title || '',
        content: cleanContent,
        html: result.result?.html,
        markdown: isDuplicate ? undefined : cleanMarkdown,
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

  // ============ Tool Definition ============

  return {
    definition: {
      type: 'function',
      function: {
        name: 'web_scrape',
        description: `Scrape any URL with automatic fallback - guaranteed to work on most sites.

Automatically tries multiple methods in sequence:
1. Native fetch - Fast (~1s), works for blogs/docs/articles
2. External API - Handles bot protection, CAPTCHAs, SPAs (if configured)

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

      // Automatic fallback chain: native -> API

      // 1. Try native fetch first
      const native = await tryNative(args, startTime, attemptedMethods);
      if (native.success && (native.qualityScore ?? 0) >= DEFAULT_MIN_QUALITY) {
        return native;
      }

      // 2. Try external API via the bound connector
      const api = await tryAPI(args, startTime, attemptedMethods);
      if (api.success) return api;

      // Return best result we got
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
}
