/**
 * Web Fetch Tool Tests
 * Tests for simple HTTP fetch with content quality detection and markdown conversion
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webFetch } from '../../../../src/tools/web/webFetch.js';

// Mock the global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock contentDetector
vi.mock('../../../../src/tools/web/contentDetector.js', () => ({
  detectContentQuality: vi.fn().mockReturnValue({
    score: 80,
    requiresJS: false,
    suggestion: undefined,
    issues: [],
  }),
}));

// Mock htmlToMarkdown
vi.mock('../../../../src/tools/web/htmlToMarkdown.js', () => ({
  htmlToMarkdown: vi.fn().mockReturnValue({
    markdown: '# Test Page\n\nContent here',
    title: 'Test Page',
    excerpt: 'Content excerpt',
    byline: 'Author Name',
    wasReadabilityUsed: true,
    wasTruncated: false,
  }),
}));

import { detectContentQuality } from '../../../../src/tools/web/contentDetector.js';
import { htmlToMarkdown } from '../../../../src/tools/web/htmlToMarkdown.js';

describe('webFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Tool Definition Tests
  // ============================================================================

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(webFetch.definition.function.name).toBe('web_fetch');
    });

    it('should have url as required parameter', () => {
      expect(webFetch.definition.function.parameters.required).toContain('url');
    });

    it('should have optional parameters', () => {
      const props = webFetch.definition.function.parameters.properties as Record<string, any>;
      expect(props.userAgent).toBeDefined();
      expect(props.timeout).toBeDefined();
    });

    it('should be a blocking tool', () => {
      expect(webFetch.definition.blocking).toBe(true);
    });

    it('should have 15 second timeout', () => {
      expect(webFetch.definition.timeout).toBe(15000);
    });
  });

  // ============================================================================
  // URL Validation Tests
  // ============================================================================

  describe('URL validation', () => {
    it('should reject invalid URLs', async () => {
      const result = await webFetch.execute({ url: 'not-a-url' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid URL format');
      expect(result.contentType).toBe('error');
    });

    it('should reject empty URLs', async () => {
      const result = await webFetch.execute({ url: '' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid URL format');
    });

    it('should accept valid HTTP URLs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: vi.fn().mockResolvedValue('<html><head><title>Test</title></head><body></body></html>'),
      });

      const result = await webFetch.execute({ url: 'http://example.com' });
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should accept valid HTTPS URLs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: vi.fn().mockResolvedValue('<html><head><title>Test</title></head><body></body></html>'),
      });

      const result = await webFetch.execute({ url: 'https://example.com' });
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // HTML Response Tests
  // ============================================================================

  describe('HTML response handling', () => {
    it('should fetch and parse HTML content as markdown', async () => {
      const html = '<html><head><title>Test Page</title></head><body><p>Content</p></body></html>';
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: vi.fn().mockResolvedValue(html),
      });

      const result = await webFetch.execute({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.contentType).toBe('html');
      expect(result.title).toBe('Test Page');
      // Content is now markdown, not raw HTML
      expect(result.content).toContain('# Test Page');
    });

    it('should use htmlToMarkdown for content conversion', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
      });

      const result = await webFetch.execute({ url: 'https://example.com' });

      expect(htmlToMarkdown).toHaveBeenCalled();
      expect(result.content).toBe('# Test Page\n\nContent here');
    });

    it('should include markdown metadata fields', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
      });

      const result = await webFetch.execute({ url: 'https://example.com' });

      expect(result.wasReadabilityUsed).toBe(true);
      expect(result.wasTruncated).toBe(false);
      expect(result.excerpt).toBe('Content excerpt');
      expect(result.byline).toBe('Author Name');
    });

    it('should use detectContentQuality', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
      });

      const result = await webFetch.execute({ url: 'https://example.com' });

      expect(detectContentQuality).toHaveBeenCalled();
      expect(result.qualityScore).toBe(80);
      expect(result.requiresJS).toBe(false);
    });

    it('should include quality issues and suggestion', async () => {
      (detectContentQuality as any).mockReturnValue({
        score: 40,
        requiresJS: true,
        suggestion: 'Use web_scrape for JavaScript-rendered content',
        issues: ['No main content found', 'React app detected'],
      });

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: vi.fn().mockResolvedValue('<html><div id="root"></div></html>'),
      });

      const result = await webFetch.execute({ url: 'https://example.com' });

      expect(result.qualityScore).toBe(40);
      expect(result.requiresJS).toBe(true);
      expect(result.suggestedAction).toBe('Use web_scrape for JavaScript-rendered content');
      expect(result.issues).toContain('No main content found');
    });
  });

  // ============================================================================
  // JSON Response Tests
  // ============================================================================

  describe('JSON response handling', () => {
    it('should handle JSON responses', async () => {
      const jsonData = { key: 'value', nested: { data: [1, 2, 3] } };
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: vi.fn().mockResolvedValue(jsonData),
      });

      const result = await webFetch.execute({ url: 'https://api.example.com/data' });

      expect(result.success).toBe(true);
      expect(result.contentType).toBe('json');
      expect(result.title).toBe('JSON Response');
      expect(result.qualityScore).toBe(100);
      expect(result.requiresJS).toBe(false);
      expect(JSON.parse(result.content)).toEqual(jsonData);
    });

    it('should format JSON with indentation', async () => {
      const jsonData = { a: 1, b: 2 };
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: vi.fn().mockResolvedValue(jsonData),
      });

      const result = await webFetch.execute({ url: 'https://api.example.com/data' });

      expect(result.content).toContain('\n'); // Should be formatted
      expect(result.content).toBe(JSON.stringify(jsonData, null, 2));
    });
  });

  // ============================================================================
  // Plain Text Response Tests
  // ============================================================================

  describe('plain text response handling', () => {
    it('should handle plain text responses', async () => {
      const text = 'This is plain text content.';
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/plain']]),
        text: vi.fn().mockResolvedValue(text),
      });

      const result = await webFetch.execute({ url: 'https://example.com/file.txt' });

      expect(result.success).toBe(true);
      expect(result.contentType).toBe('text');
      expect(result.title).toBe('Text Response');
      expect(result.content).toBe(text);
      expect(result.qualityScore).toBe(100);
    });
  });

  // ============================================================================
  // HTTP Error Tests
  // ============================================================================

  describe('HTTP error handling', () => {
    it('should handle 404 errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await webFetch.execute({ url: 'https://example.com/missing' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 404: Not Found');
      expect(result.qualityScore).toBe(0);
    });

    it('should handle 500 errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await webFetch.execute({ url: 'https://example.com' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 500: Internal Server Error');
    });

    it('should handle 403 forbidden', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      const result = await webFetch.execute({ url: 'https://example.com/private' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 403: Forbidden');
    });
  });

  // ============================================================================
  // Timeout Tests
  // ============================================================================

  describe('timeout handling', () => {
    it('should handle timeout', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const result = await webFetch.execute({
        url: 'https://slow.example.com',
        timeout: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timeout after 5000ms');
    });

    it('should use default timeout', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const result = await webFetch.execute({ url: 'https://slow.example.com' });

      expect(result.error).toBe('Request timeout after 10000ms');
    });
  });

  // ============================================================================
  // Network Error Tests
  // ============================================================================

  describe('network error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error: Unable to connect'));

      const result = await webFetch.execute({ url: 'https://unreachable.example.com' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error: Unable to connect');
      expect(result.contentType).toBe('error');
    });

    it('should handle DNS resolution failures', async () => {
      mockFetch.mockRejectedValue(new Error('getaddrinfo ENOTFOUND unknown.domain'));

      const result = await webFetch.execute({ url: 'https://unknown.domain' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOTFOUND');
    });
  });

  // ============================================================================
  // Custom Options Tests
  // ============================================================================

  describe('custom options', () => {
    it('should use custom user agent', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: vi.fn().mockResolvedValue('<html></html>'),
      });

      await webFetch.execute({
        url: 'https://example.com',
        userAgent: 'CustomBot/1.0',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'CustomBot/1.0',
          }),
        })
      );
    });

    it('should use default user agent when not specified', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: vi.fn().mockResolvedValue('<html></html>'),
      });

      await webFetch.execute({ url: 'https://example.com' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('OneRingAI'),
          }),
        })
      );
    });

    it('should send Accept headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: vi.fn().mockResolvedValue('<html></html>'),
      });

      await webFetch.execute({ url: 'https://example.com' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: expect.stringContaining('text/html'),
            'Accept-Language': 'en-US,en;q=0.9',
          }),
        })
      );
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty HTML', async () => {
      (htmlToMarkdown as any).mockReturnValue({
        markdown: '',
        title: '',
        wasReadabilityUsed: false,
        wasTruncated: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: vi.fn().mockResolvedValue(''),
      });

      const result = await webFetch.execute({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.title).toBe('Untitled');
    });

    it('should handle missing content-type header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map(), // No content-type
        text: vi.fn().mockResolvedValue('<html><title>Test</title></html>'),
      });

      const result = await webFetch.execute({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.contentType).toBe('html');
    });

    it('should return url in result', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: vi.fn().mockResolvedValue('<html></html>'),
      });

      const result = await webFetch.execute({ url: 'https://example.com/page' });

      expect(result.url).toBe('https://example.com/page');
    });

    it('should handle truncated content', async () => {
      (htmlToMarkdown as any).mockReturnValue({
        markdown: 'Truncated content...[content truncated]',
        title: 'Long Article',
        wasReadabilityUsed: true,
        wasTruncated: true,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: vi.fn().mockResolvedValue('<html><body>Very long content...</body></html>'),
      });

      const result = await webFetch.execute({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.wasTruncated).toBe(true);
      expect(result.content).toContain('[content truncated]');
    });
  });
});
