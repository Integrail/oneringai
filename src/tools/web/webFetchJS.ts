/**
 * Web Fetch with JavaScript - Uses Puppeteer for JS-rendered sites
 * Optional tool - requires puppeteer to be installed
 */

import { load } from 'cheerio';
import { ToolFunction } from '../../domain/entities/Tool.js';

// Lazy-load Puppeteer (optional dependency)
let puppeteerModule: any = null;
let browserInstance: any = null;

interface WebFetchJSArgs {
  url: string;
  waitForSelector?: string;
  timeout?: number;
  takeScreenshot?: boolean;
}

interface WebFetchJSResult {
  success: boolean;
  url: string;
  title: string;
  content: string;
  html: string;
  screenshot?: string;
  loadTime: number;
  error?: string;
  suggestion?: string;
}

/**
 * Load Puppeteer dynamically (only when needed)
 */
async function loadPuppeteer(): Promise<any> {
  if (!puppeteerModule) {
    try {
      puppeteerModule = await import('puppeteer');
    } catch (error) {
      throw new Error('Puppeteer not installed');
    }
  }
  return puppeteerModule;
}

/**
 * Get or create browser instance (reuse for performance)
 */
async function getBrowser(): Promise<any> {
  if (!browserInstance) {
    const puppeteer = await loadPuppeteer();

    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    // Cleanup on process exit
    process.on('exit', async () => {
      if (browserInstance) {
        await browserInstance.close();
      }
    });
  }
  return browserInstance;
}

export const webFetchJS: ToolFunction<WebFetchJSArgs, WebFetchJSResult> = {
  definition: {
    type: 'function',
    function: {
      name: 'web_fetch_js',
      description: `Fetch and extract content from JavaScript-rendered websites using a headless browser (Puppeteer).

USE THIS TOOL WHEN:
- The web_fetch tool returned a low quality score (<50)
- The web_fetch tool suggested using JavaScript rendering
- You know the website is built with React/Vue/Angular/Next.js
- Content loads dynamically via JavaScript
- The page requires interaction (though this tool doesn't support interaction yet)

HOW IT WORKS:
- Launches a headless Chrome browser
- Navigates to the URL
- Waits for JavaScript to execute and content to load
- Extracts the rendered HTML and text content
- Optionally captures a screenshot

CAPABILITIES:
- Executes all JavaScript on the page
- Waits for network to be idle (all resources loaded)
- Can wait for specific CSS selectors to appear
- Handles React, Vue, Angular, Next.js, and other SPAs
- Returns content after full JavaScript execution

LIMITATIONS:
- Slower than web_fetch (typically 3-10 seconds vs <1 second)
- Uses more system resources (runs a full browser)
- May still fail on sites with aggressive bot detection
- Requires puppeteer to be installed (npm install puppeteer)

PERFORMANCE:
- First call: Slower (launches browser ~1-2s)
- Subsequent calls: Faster (reuses browser instance)

RETURNS:
{
  success: boolean,
  url: string,
  title: string,
  content: string,         // Extracted text after JS execution
  html: string,            // Full HTML after JS execution
  screenshot: string,      // Base64 PNG screenshot (if requested)
  loadTime: number,        // Time taken in milliseconds
  error: string           // Error message if failed
}

EXAMPLES:
Basic usage:
{
  url: "https://react-app.com/page"
}

Wait for specific content:
{
  url: "https://app.com/dashboard",
  waitForSelector: "#main-content",  // Wait for this element
  timeout: 20000
}

With screenshot:
{
  url: "https://site.com",
  takeScreenshot: true
}`,

      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to fetch. Must start with http:// or https://',
          },
          waitForSelector: {
            type: 'string',
            description:
              'Optional CSS selector to wait for before extracting content. Example: "#main-content" or ".article-body"',
          },
          timeout: {
            type: 'number',
            description: 'Max wait time in milliseconds (default: 15000)',
          },
          takeScreenshot: {
            type: 'boolean',
            description:
              'Whether to capture a screenshot of the page (default: false). Screenshot returned as base64 PNG.',
          },
        },
        required: ['url'],
      },
    },
    blocking: true,
    timeout: 30000, // Allow extra time for browser operations
  },

  execute: async (args: WebFetchJSArgs): Promise<WebFetchJSResult> => {
    let page: any = null;

    try {
      // Try to get browser (will throw if Puppeteer not installed)
      const browser = await getBrowser();
      page = await browser.newPage();

      // Set viewport
      await page.setViewport({ width: 1280, height: 800 });

      // Set user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      const startTime = Date.now();

      // Navigate to URL
      await page.goto(args.url, {
        waitUntil: 'networkidle2', // Wait until network is mostly idle
        timeout: args.timeout || 15000,
      });

      // Wait for selector if provided
      if (args.waitForSelector) {
        await page.waitForSelector(args.waitForSelector, {
          timeout: args.timeout || 15000,
        });
      }

      // Get HTML after JS execution
      const html = await page.content();

      // Extract text content using cheerio
      const $ = load(html);

      // Remove unwanted elements
      $('script, style, noscript, iframe, nav, footer, header, aside').remove();

      // Extract text
      const content = $('body').text().trim();

      // Get title
      const title = await page.title();

      const loadTime = Date.now() - startTime;

      // Take screenshot if requested
      let screenshot: string | undefined;
      if (args.takeScreenshot) {
        const buffer = await page.screenshot({
          type: 'png',
          fullPage: false, // Just viewport
        });
        screenshot = buffer.toString('base64');
      }

      await page.close();

      return {
        success: true,
        url: args.url,
        title,
        content,
        html,
        screenshot,
        loadTime,
      };
    } catch (error: any) {
      if (page) {
        try {
          await page.close();
        } catch {
          // Ignore close errors
        }
      }

      // Check if it's a Puppeteer not installed error
      if ((error as Error).message === 'Puppeteer not installed') {
        return {
          success: false,
          url: args.url,
          title: '',
          content: '',
          html: '',
          loadTime: 0,
          error: 'Puppeteer is not installed',
          suggestion:
            'Install Puppeteer with: npm install puppeteer (note: downloads ~50MB Chrome binary)',
        };
      }

      return {
        success: false,
        url: args.url,
        title: '',
        content: '',
        html: '',
        loadTime: 0,
        error: (error as Error).message,
      };
    }
  },
};
