/**
 * Web Scrape Tool Tests
 * Tests for guaranteed URL reading with automatic fallback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webScrape } from '../../../../src/tools/web/webScrape.js';
import { Connector } from '../../../../src/core/Connector.js';

// Mock webFetch
vi.mock('../../../../src/tools/web/webFetch.js', () => ({
  webFetch: {
    execute: vi.fn(),
  },
}));

// Mock webFetchJS
vi.mock('../../../../src/tools/web/webFetchJS.js', () => ({
  webFetchJS: {
    execute: vi.fn(),
  },
}));

// Mock ScrapeProvider
vi.mock('../../../../src/capabilities/scrape/index.js', () => ({
  ScrapeProvider: {
    create: vi.fn(),
  },
  getRegisteredScrapeProviders: vi.fn().mockReturnValue([]),
}));

import { webFetch } from '../../../../src/tools/web/webFetch.js';
import { webFetchJS } from '../../../../src/tools/web/webFetchJS.js';
import { ScrapeProvider, getRegisteredScrapeProviders } from '../../../../src/capabilities/scrape/index.js';

describe('webScrape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Connector.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    Connector.clear();
  });

  // ============================================================================
  // Tool Definition Tests
  // ============================================================================

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(webScrape.definition.function.name).toBe('web_scrape');
    });

    it('should have url as required parameter', () => {
      expect(webScrape.definition.function.parameters.required).toContain('url');
    });

    it('should have optional parameters', () => {
      const props = webScrape.definition.function.parameters.properties as Record<string, any>;
      expect(props.strategy).toBeDefined();
      expect(props.connectorName).toBeDefined();
      expect(props.minQualityScore).toBeDefined();
      expect(props.timeout).toBeDefined();
      expect(props.includeHtml).toBeDefined();
      expect(props.includeMarkdown).toBeDefined();
      expect(props.includeLinks).toBeDefined();
      expect(props.waitForSelector).toBeDefined();
      expect(props.vendorOptions).toBeDefined();
    });

    it('should list valid strategies in enum', () => {
      const props = webScrape.definition.function.parameters.properties as Record<string, any>;
      expect(props.strategy.enum).toEqual(['auto', 'native', 'js', 'api', 'api-first']);
    });

    it('should be a blocking tool', () => {
      expect(webScrape.definition.blocking).toBe(true);
    });

    it('should have 60 second timeout', () => {
      expect(webScrape.definition.timeout).toBe(60000);
    });
  });

  // ============================================================================
  // URL Validation Tests
  // ============================================================================

  describe('URL validation', () => {
    it('should reject invalid URLs', async () => {
      const result = await webScrape.execute({ url: 'not-a-url' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid URL format');
      expect(result.method).toBe('none');
      expect(result.attemptedMethods).toEqual([]);
    });

    it('should reject empty URLs', async () => {
      const result = await webScrape.execute({ url: '' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid URL format');
    });

    it('should accept valid HTTP URLs', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Test',
        content: 'Content',
        qualityScore: 80,
      });

      const result = await webScrape.execute({ url: 'http://example.com' });
      expect(webFetch.execute).toHaveBeenCalled();
    });

    it('should accept valid HTTPS URLs', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Test',
        content: 'Content',
        qualityScore: 80,
      });

      const result = await webScrape.execute({ url: 'https://example.com' });
      expect(webFetch.execute).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Native Strategy Tests
  // ============================================================================

  describe('native strategy', () => {
    it('should only use native fetch', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Native Page',
        content: 'Native content',
        qualityScore: 85,
        html: '<html>test</html>',
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'native',
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('native');
      expect(result.title).toBe('Native Page');
      expect(result.content).toBe('Native content');
      expect(result.qualityScore).toBe(85);
      expect(result.attemptedMethods).toEqual(['native']);
      expect(webFetchJS.execute).not.toHaveBeenCalled();
    });

    it('should return error if native fails', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: false,
        error: 'Network error',
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'native',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should include HTML when requested', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Test',
        content: 'Content',
        html: '<html><body>Test</body></html>',
        qualityScore: 80,
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'native',
        includeHtml: true,
      });

      expect(result.html).toBe('<html><body>Test</body></html>');
    });

    it('should suggest JS when requiresJS is true', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'SPA',
        content: '',
        qualityScore: 20,
        requiresJS: true,
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'native',
      });

      expect(result.suggestion).toContain('JavaScript');
    });
  });

  // ============================================================================
  // JS Strategy Tests
  // ============================================================================

  describe('js strategy', () => {
    it('should only use JS rendering', async () => {
      (webFetchJS.execute as any).mockResolvedValue({
        success: true,
        title: 'JS Page',
        content: 'Rendered content',
        html: '<html>rendered</html>',
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'js',
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('js');
      expect(result.title).toBe('JS Page');
      expect(result.content).toBe('Rendered content');
      expect(result.qualityScore).toBe(80); // Default for JS
      expect(result.attemptedMethods).toEqual(['js']);
      expect(webFetch.execute).not.toHaveBeenCalled();
    });

    it('should pass waitForSelector to webFetchJS', async () => {
      (webFetchJS.execute as any).mockResolvedValue({
        success: true,
        title: 'Test',
        content: 'Content',
      });

      await webScrape.execute({
        url: 'https://example.com',
        strategy: 'js',
        waitForSelector: '.content-loaded',
      });

      expect(webFetchJS.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          waitForSelector: '.content-loaded',
        })
      );
    });

    it('should suggest Puppeteer installation on error', async () => {
      (webFetchJS.execute as any).mockRejectedValue(new Error('Puppeteer not installed'));

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'js',
      });

      expect(result.success).toBe(false);
      expect(result.suggestion).toContain('Puppeteer');
    });
  });

  // ============================================================================
  // API Strategy Tests
  // ============================================================================

  describe('api strategy', () => {
    it('should use API provider when connector specified', async () => {
      const mockProvider = {
        scrape: vi.fn().mockResolvedValue({
          success: true,
          provider: 'zenrows',
          finalUrl: 'https://example.com/final',
          result: {
            title: 'API Page',
            content: 'API content',
            markdown: '# API Page',
          },
        }),
      };
      (ScrapeProvider.create as any).mockReturnValue(mockProvider);

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'api',
        connectorName: 'zenrows-main',
      });

      expect(ScrapeProvider.create).toHaveBeenCalledWith({ connector: 'zenrows-main' });
      expect(result.success).toBe(true);
      expect(result.method).toBe('zenrows');
      expect(result.title).toBe('API Page');
      expect(result.content).toBe('API content');
      expect(result.markdown).toBe('# API Page');
      expect(result.finalUrl).toBe('https://example.com/final');
      expect(result.qualityScore).toBe(90); // Default for API
    });

    it('should return error when no connector and no available provider', async () => {
      (getRegisteredScrapeProviders as any).mockReturnValue([]);

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'api',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No scraping API connector');
      expect(result.suggestion).toContain('connector');
    });

    it('should pass options to ScrapeProvider', async () => {
      const mockProvider = {
        scrape: vi.fn().mockResolvedValue({
          success: true,
          provider: 'zenrows',
          result: { title: '', content: '' },
        }),
      };
      (ScrapeProvider.create as any).mockReturnValue(mockProvider);

      await webScrape.execute({
        url: 'https://example.com',
        strategy: 'api',
        connectorName: 'zenrows',
        includeMarkdown: true,
        includeLinks: true,
        timeout: 5000,
        vendorOptions: { premiumProxy: true },
      });

      expect(mockProvider.scrape).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          includeMarkdown: true,
          includeLinks: true,
          timeout: 5000,
          vendorOptions: { premiumProxy: true },
        })
      );
    });

    it('should include links and metadata from API response', async () => {
      const mockProvider = {
        scrape: vi.fn().mockResolvedValue({
          success: true,
          provider: 'firecrawl',
          result: {
            title: 'Test',
            content: 'Content',
            links: [{ url: 'https://link1.com', text: 'Link 1' }],
            metadata: { author: 'Test Author', description: 'Test desc' },
          },
        }),
      };
      (ScrapeProvider.create as any).mockReturnValue(mockProvider);

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'api',
        connectorName: 'firecrawl',
        includeLinks: true,
      });

      expect(result.links).toEqual([{ url: 'https://link1.com', text: 'Link 1' }]);
      expect(result.metadata).toEqual({ author: 'Test Author', description: 'Test desc' });
    });

    it('should handle API provider errors', async () => {
      (ScrapeProvider.create as any).mockImplementation(() => {
        throw new Error('API key invalid');
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'api',
        connectorName: 'bad-connector',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API key invalid');
    });
  });

  // ============================================================================
  // API-First Strategy Tests
  // ============================================================================

  describe('api-first strategy', () => {
    it('should try API first, then native', async () => {
      const mockProvider = {
        scrape: vi.fn().mockResolvedValue({
          success: true,
          provider: 'zenrows',
          result: { title: 'API', content: 'API content' },
        }),
      };
      (ScrapeProvider.create as any).mockReturnValue(mockProvider);

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'api-first',
        connectorName: 'zenrows',
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('zenrows');
      expect(webFetch.execute).not.toHaveBeenCalled();
    });

    it('should fall back to native when API fails', async () => {
      const mockProvider = {
        scrape: vi.fn().mockResolvedValue({
          success: false,
          error: 'API error',
        }),
      };
      (ScrapeProvider.create as any).mockReturnValue(mockProvider);
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Native',
        content: 'Native content',
        qualityScore: 75,
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'api-first',
        connectorName: 'zenrows',
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('native');
      expect(result.attemptedMethods).toContain('api:zenrows');
      expect(result.attemptedMethods).toContain('native');
    });

    it('should fall back to JS when API and native fail', async () => {
      const mockProvider = {
        scrape: vi.fn().mockResolvedValue({ success: false }),
      };
      (ScrapeProvider.create as any).mockReturnValue(mockProvider);
      (webFetch.execute as any).mockResolvedValue({ success: false });
      (webFetchJS.execute as any).mockResolvedValue({
        success: true,
        title: 'JS',
        content: 'JS content',
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'api-first',
        connectorName: 'zenrows',
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('js');
    });
  });

  // ============================================================================
  // Auto Strategy Tests (Fallback Chain)
  // ============================================================================

  describe('auto strategy (fallback chain)', () => {
    it('should use native when quality is good', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Native',
        content: 'Good content',
        qualityScore: 80,
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'auto',
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('native');
      expect(result.attemptedMethods).toEqual(['native']);
      expect(webFetchJS.execute).not.toHaveBeenCalled();
    });

    it('should fall back to JS when native quality is low', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Poor Native',
        content: '',
        qualityScore: 30,
      });
      (webFetchJS.execute as any).mockResolvedValue({
        success: true,
        title: 'JS Page',
        content: 'Good JS content',
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'auto',
        minQualityScore: 50,
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('js');
      expect(result.attemptedMethods).toContain('native');
      expect(result.attemptedMethods).toContain('js');
    });

    it('should fall back to API when native and JS quality is low', async () => {
      // Note: tryJS returns qualityScore: 80 for successful JS, so we need minQualityScore > 80
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        qualityScore: 20,
      });
      (webFetchJS.execute as any).mockResolvedValue({
        success: true,
        title: 'JS Page',
        content: 'JS content',
        // Note: tryJS ignores this and uses 80 for success
      });

      const mockProvider = {
        scrape: vi.fn().mockResolvedValue({
          success: true,
          provider: 'zenrows',
          result: { title: 'API', content: 'API content' },
        }),
      };
      (ScrapeProvider.create as any).mockReturnValue(mockProvider);

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'auto',
        connectorName: 'zenrows',
        minQualityScore: 85, // Higher than JS default of 80
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('zenrows');
    });

    it('should return best result if all methods fail quality threshold', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Native Low',
        content: 'Some content',
        qualityScore: 40,
      });
      (webFetchJS.execute as any).mockResolvedValue({
        success: true,
        title: 'JS Better',
        content: 'Better content',
        qualityScore: 45,
      });
      (getRegisteredScrapeProviders as any).mockReturnValue([]);

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'auto',
        minQualityScore: 80,
      });

      // Should return JS result as it's better
      expect(result.success).toBe(true);
      expect(result.method).toBe('js');
    });

    it('should use available connector when no connectorName provided', async () => {
      // Setup available connector
      (getRegisteredScrapeProviders as any).mockReturnValue(['zenrows']);
      Connector.create({
        name: 'my-zenrows',
        vendor: 'custom' as any,
        serviceType: 'zenrows',
        auth: { type: 'api_key', apiKey: 'test' },
        baseURL: 'https://api.zenrows.com',
      });

      (webFetch.execute as any).mockResolvedValue({
        success: true,
        qualityScore: 20,
      });
      // Note: tryJS returns qualityScore: 80 for successful JS, so we need minQualityScore > 80
      (webFetchJS.execute as any).mockResolvedValue({
        success: true,
        title: 'JS Page',
        content: 'JS content',
      });

      const mockProvider = {
        scrape: vi.fn().mockResolvedValue({
          success: true,
          provider: 'zenrows',
          result: { title: 'API', content: 'content' },
        }),
      };
      (ScrapeProvider.create as any).mockReturnValue(mockProvider);

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'auto',
        minQualityScore: 85, // Higher than JS default of 80
      });

      expect(result.method).toBe('zenrows');
    });

    it('should return failure with suggestion when all methods fail', async () => {
      (webFetch.execute as any).mockResolvedValue({ success: false });
      (webFetchJS.execute as any).mockResolvedValue({ success: false });
      (getRegisteredScrapeProviders as any).mockReturnValue([]);

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'auto',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('All scraping methods failed');
      expect(result.suggestion).toContain('connector');
    });
  });

  // ============================================================================
  // Quality Threshold Tests
  // ============================================================================

  describe('quality threshold', () => {
    it('should use default minQualityScore of 50', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Test',
        content: 'Content',
        qualityScore: 50,
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'auto',
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('native');
    });

    it('should respect custom minQualityScore', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        qualityScore: 70,
      });
      (webFetchJS.execute as any).mockResolvedValue({
        success: true,
        title: 'JS',
        content: 'content',
        qualityScore: 85,
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'auto',
        minQualityScore: 80,
      });

      expect(result.method).toBe('js');
    });

    it('should handle missing qualityScore as 0', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'No Score',
        content: 'content',
        // No qualityScore
      });
      (webFetchJS.execute as any).mockResolvedValue({
        success: true,
        title: 'JS',
        content: 'JS content',
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'auto',
        minQualityScore: 50,
      });

      // Should fall back since qualityScore defaults to 0
      expect(result.method).toBe('js');
    });
  });

  // ============================================================================
  // Timing Tracking Tests
  // ============================================================================

  describe('timing tracking', () => {
    it('should track duration in milliseconds', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Test',
        content: 'Content',
        qualityScore: 80,
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
      });

      expect(result.durationMs).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include duration even on failure', async () => {
      const result = await webScrape.execute({
        url: 'invalid-url',
      });

      expect(result.success).toBe(false);
      expect(result.durationMs).toBeDefined();
    });

    it('should track total time across multiple attempts', async () => {
      (webFetch.execute as any).mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 10));
        return { success: true, qualityScore: 20 };
      });
      (webFetchJS.execute as any).mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 10));
        return { success: true, title: 'Test', content: 'Content', qualityScore: 80 };
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'auto',
        minQualityScore: 50,
      });

      expect(result.durationMs).toBeGreaterThanOrEqual(20);
    });
  });

  // ============================================================================
  // Timeout Tests
  // ============================================================================

  describe('timeout handling', () => {
    it('should pass timeout to native fetch', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Test',
        content: 'Content',
        qualityScore: 80,
      });

      await webScrape.execute({
        url: 'https://example.com',
        strategy: 'native',
        timeout: 5000,
      });

      expect(webFetch.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5000,
        })
      );
    });

    it('should pass timeout to JS fetch', async () => {
      (webFetchJS.execute as any).mockResolvedValue({
        success: true,
        title: 'Test',
        content: 'Content',
      });

      await webScrape.execute({
        url: 'https://example.com',
        strategy: 'js',
        timeout: 20000,
      });

      expect(webFetchJS.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 20000,
        })
      );
    });

    it('should use default timeout for native (10s)', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        qualityScore: 80,
      });

      await webScrape.execute({
        url: 'https://example.com',
        strategy: 'native',
      });

      expect(webFetch.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 10000,
        })
      );
    });

    it('should use default timeout for JS (15s)', async () => {
      (webFetchJS.execute as any).mockResolvedValue({
        success: true,
      });

      await webScrape.execute({
        url: 'https://example.com',
        strategy: 'js',
      });

      expect(webFetchJS.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 15000,
        })
      );
    });
  });

  // ============================================================================
  // describeCall Tests
  // ============================================================================

  describe('describeCall', () => {
    it('should describe with URL and strategy', () => {
      const desc = webScrape.describeCall!({ url: 'https://example.com', strategy: 'auto' });
      expect(desc).toBe('https://example.com (auto)');
    });

    it('should include connector name when provided', () => {
      const desc = webScrape.describeCall!({
        url: 'https://example.com',
        strategy: 'api',
        connectorName: 'zenrows',
      });
      expect(desc).toBe('https://example.com (api, zenrows)');
    });

    it('should use auto as default strategy', () => {
      const desc = webScrape.describeCall!({ url: 'https://example.com' });
      expect(desc).toBe('https://example.com (auto)');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should handle native fetch exception', async () => {
      (webFetch.execute as any).mockRejectedValue(new Error('Connection refused'));

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'native',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('should handle JS fetch exception', async () => {
      (webFetchJS.execute as any).mockRejectedValue(new Error('Browser crashed'));

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'js',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser crashed');
    });

    it('should handle API provider exception', async () => {
      (ScrapeProvider.create as any).mockReturnValue({
        scrape: vi.fn().mockRejectedValue(new Error('Rate limit exceeded')),
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'api',
        connectorName: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });

    it('should include suggestedFallback from API response', async () => {
      const mockProvider = {
        scrape: vi.fn().mockResolvedValue({
          success: false,
          error: 'Bot protection detected',
          suggestedFallback: 'Try with premium proxy enabled',
        }),
      };
      (ScrapeProvider.create as any).mockReturnValue(mockProvider);

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'api',
        connectorName: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.suggestion).toBe('Try with premium proxy enabled');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty content from native', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Empty Page',
        content: '',
        qualityScore: 10,
      });
      (webFetchJS.execute as any).mockResolvedValue({
        success: true,
        title: 'JS Empty',
        content: 'Rendered content',
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
      });

      // Should fall back due to low quality
      expect(result.method).toBe('js');
    });

    it('should handle undefined title gracefully', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        content: 'Content only',
        qualityScore: 80,
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'native',
      });

      expect(result.success).toBe(true);
      expect(result.title).toBeUndefined();
    });

    it('should handle API returning empty result object', async () => {
      const mockProvider = {
        scrape: vi.fn().mockResolvedValue({
          success: true,
          provider: 'zenrows',
          result: null,
        }),
      };
      (ScrapeProvider.create as any).mockReturnValue(mockProvider);

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'api',
        connectorName: 'zenrows',
      });

      expect(result.success).toBe(true);
      expect(result.title).toBe('');
      expect(result.content).toBe('');
    });

    it('should track all attempted methods in order', async () => {
      (webFetch.execute as any).mockResolvedValue({ success: false });
      (webFetchJS.execute as any).mockResolvedValue({ success: false });
      (getRegisteredScrapeProviders as any).mockReturnValue(['zenrows']);

      Connector.create({
        name: 'my-zenrows',
        vendor: 'custom' as any,
        serviceType: 'zenrows',
        auth: { type: 'api_key', apiKey: 'test' },
        baseURL: 'https://api.zenrows.com',
      });

      const mockProvider = {
        scrape: vi.fn().mockResolvedValue({ success: false }),
      };
      (ScrapeProvider.create as any).mockReturnValue(mockProvider);

      const result = await webScrape.execute({
        url: 'https://example.com',
        strategy: 'auto',
      });

      expect(result.attemptedMethods[0]).toBe('native');
      expect(result.attemptedMethods[1]).toBe('js');
      expect(result.attemptedMethods[2]).toContain('api:');
    });
  });
});
