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

// Mock ScrapeProvider
vi.mock('../../../../src/capabilities/scrape/index.js', () => ({
  ScrapeProvider: {
    create: vi.fn(),
  },
  getRegisteredScrapeProviders: vi.fn().mockReturnValue([]),
}));

// Mock shared utilities
vi.mock('../../../../src/capabilities/shared/index.js', () => ({
  findConnectorByServiceTypes: vi.fn().mockReturnValue(null),
}));

import { webFetch } from '../../../../src/tools/web/webFetch.js';
import { ScrapeProvider } from '../../../../src/capabilities/scrape/index.js';
import { findConnectorByServiceTypes } from '../../../../src/capabilities/shared/index.js';

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
      expect(props.timeout).toBeDefined();
      expect(props.includeHtml).toBeDefined();
      expect(props.includeMarkdown).toBeDefined();
      expect(props.includeLinks).toBeDefined();
      expect(props.waitForSelector).toBeDefined();
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
  // Automatic Fallback Tests
  // ============================================================================

  describe('automatic fallback', () => {
    it('should use native when quality is good', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Native Page',
        content: 'Native content',
        qualityScore: 80,
      });

      const result = await webScrape.execute({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.method).toBe('native');
      expect(result.title).toBe('Native Page');
      expect(result.content).toBe('Native content');
      expect(result.qualityScore).toBe(80);
      expect(result.attemptedMethods).toEqual(['native']);
    });

    it('should fall back to API when native quality is low', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Poor Native',
        content: '',
        qualityScore: 30,
      });

      const mockProvider = {
        scrape: vi.fn().mockResolvedValue({
          success: true,
          provider: 'zenrows',
          result: { title: 'API Page', content: 'API content', markdown: 'API markdown' },
        }),
      };
      (ScrapeProvider.create as any).mockReturnValue(mockProvider);
      (findConnectorByServiceTypes as any).mockReturnValue({ name: 'my-zenrows' });

      const result = await webScrape.execute({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.attemptedMethods).toContain('native');
      expect(result.attemptedMethods.some((m: string) => m.startsWith('api:'))).toBe(true);
    });

    it('should return failure when all methods fail', async () => {
      (webFetch.execute as any).mockResolvedValue({ success: false });
      (findConnectorByServiceTypes as any).mockReturnValue(null);

      const result = await webScrape.execute({ url: 'https://example.com' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('All scraping methods failed');
    });

    it('should return native result if below threshold but no API available', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Native Low',
        content: 'Some content',
        qualityScore: 40,
      });
      (findConnectorByServiceTypes as any).mockReturnValue(null);

      const result = await webScrape.execute({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.method).toBe('native');
    });
  });

  // ============================================================================
  // Markdown Content Tests
  // ============================================================================

  describe('markdown content', () => {
    it('should return markdown in content field from native fetch (no duplicate markdown field)', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Test',
        content: '# Heading\n\nSome **bold** text',
        qualityScore: 80,
        wasReadabilityUsed: true,
        wasTruncated: false,
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        includeMarkdown: true,
      });

      expect(result.success).toBe(true);
      // Native fetch already returns markdown-like content in the content field
      // No separate markdown field to avoid token-wasting duplication
      expect(result.content).toContain('# Heading');
      expect(result.markdown).toBeUndefined();
    });

    it('should not include markdown when not requested', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        title: 'Test',
        content: 'Some content',
        qualityScore: 80,
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
        includeMarkdown: false,
      });

      expect(result.markdown).toBeUndefined();
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
        timeout: 5000,
      });

      expect(webFetch.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5000,
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
      });

      expect(webFetch.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 10000,
        })
      );
    });
  });

  // ============================================================================
  // describeCall Tests
  // ============================================================================

  describe('describeCall', () => {
    it('should describe with URL', () => {
      const desc = webScrape.describeCall!({ url: 'https://example.com' });
      expect(desc).toBe('https://example.com');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should handle native fetch exception', async () => {
      (webFetch.execute as any).mockRejectedValue(new Error('Connection refused'));
      (findConnectorByServiceTypes as any).mockReturnValue(null);

      const result = await webScrape.execute({
        url: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.attemptedMethods).toContain('native');
    });

    it('should handle API provider exception', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        qualityScore: 30,
      });
      (findConnectorByServiceTypes as any).mockReturnValue({ name: 'test-connector' });
      (ScrapeProvider.create as any).mockReturnValue({
        scrape: vi.fn().mockRejectedValue(new Error('Rate limit exceeded')),
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
      });

      // Native returned success=true, so best result is native
      expect(result.success).toBe(true);
      expect(result.method).toBe('native');
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
      (findConnectorByServiceTypes as any).mockReturnValue(null);

      const result = await webScrape.execute({
        url: 'https://example.com',
      });

      // Low quality but native is the only method, so returns native result
      expect(result.success).toBe(true);
      expect(result.method).toBe('native');
    });

    it('should handle undefined title gracefully', async () => {
      (webFetch.execute as any).mockResolvedValue({
        success: true,
        content: 'Content only',
        qualityScore: 80,
      });

      const result = await webScrape.execute({
        url: 'https://example.com',
      });

      expect(result.success).toBe(true);
      expect(result.title).toBeUndefined();
    });

    it('should track all attempted methods in order', async () => {
      (webFetch.execute as any).mockResolvedValue({ success: false });
      (findConnectorByServiceTypes as any).mockReturnValue({ name: 'my-zenrows' });

      const mockProvider = {
        scrape: vi.fn().mockResolvedValue({ success: false }),
      };
      (ScrapeProvider.create as any).mockReturnValue(mockProvider);

      const result = await webScrape.execute({
        url: 'https://example.com',
      });

      expect(result.attemptedMethods[0]).toBe('native');
      expect(result.attemptedMethods[1]).toContain('api:');
    });
  });
});
