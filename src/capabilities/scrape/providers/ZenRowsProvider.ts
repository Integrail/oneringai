/**
 * ZenRows Scrape Provider
 *
 * Enterprise-grade web scraping with:
 * - JavaScript rendering
 * - Premium proxy rotation (residential IPs)
 * - Anti-bot bypass (pretends to be human)
 * - CAPTCHA solving
 * - Markdown conversion
 * - Screenshot capture
 *
 * @see https://docs.zenrows.com/universal-scraper-api/api-reference
 */

import type { Connector } from '../../../core/Connector.js';
import type {
  IScrapeProvider,
  ScrapeOptions,
  ScrapeResponse,
  ScrapeResult,
  ScrapeFeature,
} from '../ScrapeProvider.js';
import { registerScrapeProvider } from '../ScrapeProvider.js';
import { buildQueryString } from '../../shared/index.js';

/**
 * ZenRows-specific options
 */
export interface ZenRowsOptions {
  /** Enable JavaScript rendering (5x cost) */
  jsRender?: boolean;
  /** Use premium proxies / residential IPs (10x cost) */
  premiumProxy?: boolean;
  /** Wait time in ms before returning content (max 30000) */
  wait?: number;
  /** CSS selector to wait for before returning */
  waitFor?: string;
  /** Enable auto-parsing of structured data */
  autoparse?: boolean;
  /** CSS selectors to extract (JSON output) */
  cssExtractor?: string;
  /** Output format: 'html' or 'markdown' */
  outputFormat?: 'html' | 'markdown';
  /** Take a screenshot (returns base64) */
  screenshot?: boolean;
  /** Screenshot full page (vs viewport only) */
  screenshotFullpage?: boolean;
  /** Block specific resources: 'image', 'media', 'font', 'stylesheet' */
  blockResources?: string;
  /** Custom headers as JSON string */
  customHeaders?: boolean;
  /** Session ID for sticky sessions */
  sessionId?: number;
  /** Device type: 'desktop' or 'mobile' */
  device?: 'desktop' | 'mobile';
  /** Original status code passthrough */
  originalStatus?: boolean;
  /** Proxy country (e.g., 'us', 'gb') */
  proxyCountry?: string;
  /** JavaScript instructions to execute */
  jsInstructions?: string;
}

/**
 * ZenRows API response headers
 */
interface ZenRowsHeaders {
  'zr-final-url'?: string;
  'zr-status'?: string;
  'zr-cost'?: string;
  'content-type'?: string;
}

export class ZenRowsProvider implements IScrapeProvider {
  readonly name = 'zenrows';

  constructor(readonly connector: Connector) {}

  /**
   * Scrape a URL using ZenRows API
   *
   * By default, enables JS rendering and premium proxies for guaranteed results.
   */
  async scrape(url: string, options: ScrapeOptions = {}): Promise<ScrapeResponse> {
    const startTime = Date.now();

    try {
      // Get API key from connector auth
      const apiKey = this.getApiKey();

      // Build ZenRows-specific options
      const zenrowsOpts = options.vendorOptions as ZenRowsOptions | undefined;

      // Build query parameters
      const queryParams: Record<string, string | number | boolean> = {
        url: url,
        apikey: apiKey,
        // Default to JS rendering and premium proxy for guaranteed results
        js_render: zenrowsOpts?.jsRender ?? true,
        premium_proxy: zenrowsOpts?.premiumProxy ?? true,
      };

      // Add optional parameters
      if (options.waitForSelector || zenrowsOpts?.waitFor) {
        queryParams.wait_for = options.waitForSelector || zenrowsOpts?.waitFor || '';
      }

      if (zenrowsOpts?.wait) {
        queryParams.wait = zenrowsOpts.wait;
      }

      if (options.includeMarkdown || zenrowsOpts?.outputFormat === 'markdown') {
        queryParams.response_type = 'markdown';
      }

      if (options.includeScreenshot || zenrowsOpts?.screenshot) {
        queryParams.screenshot = true;
        if (zenrowsOpts?.screenshotFullpage) {
          queryParams.screenshot_fullpage = true;
        }
      }

      if (zenrowsOpts?.autoparse) {
        queryParams.autoparse = true;
      }

      if (zenrowsOpts?.cssExtractor) {
        queryParams.css_extractor = zenrowsOpts.cssExtractor;
      }

      if (zenrowsOpts?.blockResources) {
        queryParams.block_resources = zenrowsOpts.blockResources;
      }

      if (zenrowsOpts?.sessionId) {
        queryParams.session_id = zenrowsOpts.sessionId;
      }

      if (zenrowsOpts?.device) {
        queryParams.device = zenrowsOpts.device;
      }

      if (zenrowsOpts?.originalStatus) {
        queryParams.original_status = true;
      }

      if (zenrowsOpts?.proxyCountry) {
        queryParams.proxy_country = zenrowsOpts.proxyCountry;
      }

      if (zenrowsOpts?.jsInstructions) {
        queryParams.js_instructions = zenrowsOpts.jsInstructions;
      }

      // Add custom headers if provided
      if (options.headers && zenrowsOpts?.customHeaders !== false) {
        queryParams.custom_headers = true;
      }

      // Build full URL with query params
      const endpoint = `/?${buildQueryString(queryParams)}`;

      // Make request
      const response = await this.connector.fetch(endpoint, {
        method: 'GET',
        headers: options.headers,
        timeout: options.timeout || 60000, // ZenRows can take longer with JS rendering
      });

      // Parse headers
      const headers = Object.fromEntries(response.headers.entries()) as ZenRowsHeaders;
      const finalUrl = headers['zr-final-url'] || url;
      const statusCode = parseInt(headers['zr-status'] || '200', 10);

      // Check for errors
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          url,
          provider: this.name,
          error: `ZenRows API error (${response.status}): ${errorText}`,
          statusCode: response.status,
          durationMs: Date.now() - startTime,
        };
      }

      // Parse response based on content type
      const contentType = headers['content-type'] || '';
      const isMarkdown = queryParams.response_type === 'markdown';
      const isScreenshot = queryParams.screenshot;

      let result: ScrapeResult;

      if (isScreenshot && !isMarkdown) {
        // Screenshot response is base64 encoded
        const base64 = await response.text();
        result = {
          title: '',
          content: '',
          screenshot: base64,
        };
      } else {
        const content = await response.text();

        // Extract title from content if HTML
        let title = '';
        if (!isMarkdown && contentType.includes('text/html')) {
          const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
          title = titleMatch?.[1]?.trim() ?? '';
        } else if (isMarkdown) {
          // Try to extract title from first heading
          const headingMatch = content.match(/^#\s+(.+)$/m);
          title = headingMatch?.[1]?.trim() ?? '';
        }

        result = {
          title,
          content: isMarkdown ? content : this.extractText(content),
          html: options.includeHtml && !isMarkdown ? content : undefined,
          markdown: isMarkdown ? content : undefined,
        };

        // Extract links if requested
        if (options.includeLinks && !isMarkdown) {
          result.links = this.extractLinks(content, finalUrl);
        }

        // Extract metadata from HTML
        if (!isMarkdown) {
          result.metadata = this.extractMetadata(content);
        }
      }

      return {
        success: true,
        url,
        finalUrl,
        provider: this.name,
        result,
        statusCode,
        durationMs: Date.now() - startTime,
        requiredJS: queryParams.js_render === true,
      };
    } catch (error: any) {
      return {
        success: false,
        url,
        provider: this.name,
        error: error.message || 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if this provider supports a feature
   */
  supportsFeature(feature: ScrapeFeature): boolean {
    const supported: ScrapeFeature[] = [
      'javascript',
      'markdown',
      'screenshot',
      'links',
      'metadata',
      'proxy',
      'stealth',
      'dynamic',
    ];
    return supported.includes(feature);
  }

  /**
   * Get API key from connector
   */
  private getApiKey(): string {
    return this.connector.getApiKey();
  }

  /**
   * Extract text content from HTML
   */
  private extractText(html: string): string {
    // Remove script and style tags
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Extract links from HTML
   */
  private extractLinks(html: string, baseUrl: string): Array<{ url: string; text: string }> {
    const links: Array<{ url: string; text: string }> = [];
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      try {
        const href = match[1];
        const text = match[2]?.trim() ?? '';

        // Skip if href is missing
        if (!href) continue;

        // Resolve relative URLs
        const absoluteUrl = new URL(href, baseUrl).href;

        // Skip javascript: and mailto: links
        if (!absoluteUrl.startsWith('javascript:') && !absoluteUrl.startsWith('mailto:')) {
          links.push({ url: absoluteUrl, text: text || absoluteUrl });
        }
      } catch {
        // Skip invalid URLs
      }
    }

    return links;
  }

  /**
   * Extract metadata from HTML
   */
  private extractMetadata(
    html: string
  ): ScrapeResult['metadata'] {
    const metadata: ScrapeResult['metadata'] = {};

    // Extract meta tags
    const metaRegex = /<meta[^>]+(?:name|property)=["']([^"']+)["'][^>]+content=["']([^"']+)["']/gi;
    let match;

    while ((match = metaRegex.exec(html)) !== null) {
      const name = match[1]?.toLowerCase();
      const content = match[2];

      // Skip if no name or content
      if (!name || !content) continue;

      if (name === 'description' || name === 'og:description') {
        metadata.description = metadata.description || content;
      } else if (name === 'author') {
        metadata.author = content;
      } else if (name === 'og:site_name') {
        metadata.siteName = content;
      } else if (name === 'og:image') {
        metadata.ogImage = content;
      } else if (name === 'article:published_time') {
        metadata.publishedDate = content;
      }
    }

    // Extract favicon
    const faviconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
    if (faviconMatch) {
      metadata.favicon = faviconMatch[1];
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }
}

// Self-register when imported
registerScrapeProvider('zenrows', ZenRowsProvider);
