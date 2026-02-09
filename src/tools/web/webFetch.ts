/**
 * Web Fetch Tool - Simple HTTP fetch with content quality detection
 */

import { load } from 'cheerio';
import { ToolFunction } from '../../domain/entities/Tool.js';
import { detectContentQuality } from './contentDetector.js';
import { htmlToMarkdown } from './htmlToMarkdown.js';

interface WebFetchArgs {
  url: string;
  userAgent?: string;
  timeout?: number;
}

interface WebFetchResult {
  success: boolean;
  url: string;
  title: string;
  content: string;
  contentType: 'html' | 'json' | 'text' | 'error';
  qualityScore: number;
  requiresJS: boolean;
  suggestedAction?: string;
  issues?: string[];
  error?: string;
  // Markdown conversion metadata
  excerpt?: string;
  byline?: string;
  wasReadabilityUsed?: boolean;
  wasTruncated?: boolean;
}

export const webFetch: ToolFunction<WebFetchArgs, WebFetchResult> = {
  definition: {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: `Fetch and extract text content from a web page URL.

IMPORTANT: This tool performs a simple HTTP fetch and HTML parsing. It works well for:
- Static websites (blogs, documentation, articles)
- Server-rendered HTML pages
- Content that doesn't require JavaScript

LIMITATIONS:
- Cannot execute JavaScript
- May fail on React/Vue/Angular sites (will return low quality score)
- May get blocked by bot protection
- Cannot handle dynamic content loading

QUALITY DETECTION:
The tool analyzes the fetched content and returns a quality score (0-100):
- 80-100: Excellent quality, content extracted successfully
- 50-79: Moderate quality, some content extracted
- 0-49: Low quality, likely needs JavaScript or has errors

If the quality score is low or requiresJS is true, consider using a scraping service connector for better results.

RETURNS:
{
  success: boolean,
  url: string,
  title: string,
  content: string,          // Clean markdown (converted from HTML via Readability + Turndown)
  contentType: string,      // 'html' | 'json' | 'text' | 'error'
  qualityScore: number,     // 0-100 (quality of extraction)
  requiresJS: boolean,      // True if site likely needs JavaScript
  suggestedAction: string,  // Suggestion if quality is low
  issues: string[],         // List of detected issues
  excerpt: string,          // Short summary excerpt (if extracted)
  byline: string,           // Author info (if extracted)
  wasTruncated: boolean,    // True if content was truncated
  error: string             // Error message if failed
}

EXAMPLE:
To fetch a blog post:
{
  url: "https://example.com/blog/article"
}

With custom user agent:
{
  url: "https://example.com/page",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
  timeout: 15000
}`,

      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to fetch. Must start with http:// or https://',
          },
          userAgent: {
            type: 'string',
            description: 'Optional custom user agent string. Default is a generic bot user agent.',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 10000)',
          },
        },
        required: ['url'],
      },
    },
    blocking: true,
    timeout: 15000,
  },

  execute: async (args: WebFetchArgs): Promise<WebFetchResult> => {
    try {
      // Validate URL
      try {
        new URL(args.url);
      } catch {
        return {
          success: false,
          url: args.url,
          title: '',
          content: '',
          contentType: 'error',
          qualityScore: 0,
          requiresJS: false,
          error: 'Invalid URL format',
        };
      }

      // Fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), args.timeout || 10000);

      const response = await fetch(args.url, {
        headers: {
          'User-Agent':
            args.userAgent ||
            'Mozilla/5.0 (compatible; OneRingAI/1.0; +https://github.com/oneringai/agents)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check response status
      if (!response.ok) {
        return {
          success: false,
          url: args.url,
          title: '',
          content: '',
          contentType: 'error',
          qualityScore: 0,
          requiresJS: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Get content type
      const contentType = response.headers.get('content-type') || '';

      // Handle JSON responses
      if (contentType.includes('application/json')) {
        const json = await response.json();
        return {
          success: true,
          url: args.url,
          title: 'JSON Response',
          content: JSON.stringify(json, null, 2),
          contentType: 'json',
          qualityScore: 100,
          requiresJS: false,
        };
      }

      // Handle plain text
      if (contentType.includes('text/plain')) {
        const text = await response.text();
        return {
          success: true,
          url: args.url,
          title: 'Text Response',
          content: text,
          contentType: 'text',
          qualityScore: 100,
          requiresJS: false,
        };
      }

      // Get HTML
      const html = await response.text();

      // Parse with cheerio for quality detection
      const $ = load(html);

      // Convert HTML to clean markdown
      const mdResult = await htmlToMarkdown(html, args.url);

      // Use markdown result title or fallback to cheerio extraction
      const title = mdResult.title || $('title').text() || $('h1').first().text() || 'Untitled';

      // Detect content quality (using markdown content for text analysis)
      const quality = detectContentQuality(html, mdResult.markdown, $);

      return {
        success: true,
        url: args.url,
        title,
        content: mdResult.markdown,
        contentType: 'html',
        qualityScore: quality.score,
        requiresJS: quality.requiresJS,
        suggestedAction: quality.suggestion,
        issues: quality.issues,
        excerpt: mdResult.excerpt,
        byline: mdResult.byline,
        wasReadabilityUsed: mdResult.wasReadabilityUsed,
        wasTruncated: mdResult.wasTruncated,
      };
    } catch (error: any) {
      // Handle abort errors specially
      if (error.name === 'AbortError') {
        return {
          success: false,
          url: args.url,
          title: '',
          content: '',
          contentType: 'error',
          qualityScore: 0,
          requiresJS: false,
          error: `Request timeout after ${args.timeout || 10000}ms`,
        };
      }

      return {
        success: false,
        url: args.url,
        title: '',
        content: '',
        contentType: 'error',
        qualityScore: 0,
        requiresJS: false,
        error: (error as Error).message,
      };
    }
  },
};
