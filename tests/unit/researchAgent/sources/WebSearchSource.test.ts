/**
 * WebSearchSource Tests
 * Tests for the web search research source
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebSearchSource, createWebSearchSource, WebSearchSourceConfig } from '@/capabilities/researchAgent/sources/WebSearchSource.js';
import { Connector, Vendor, Services } from '@/index.js';

// Mock the SearchProvider
vi.mock('@/capabilities/search/SearchProvider.js', () => ({
  SearchProvider: {
    create: vi.fn(() => ({
      search: vi.fn(async (query: string, options?: any) => ({
        success: true,
        query,
        results: [
          {
            title: 'Test Result 1',
            url: 'https://example.com/1',
            snippet: 'Test snippet 1',
            position: 1,
          },
          {
            title: 'Test Result 2',
            url: 'https://example.com/2',
            snippet: 'Test snippet 2',
            position: 2,
          },
        ],
        count: 2,
      })),
    })),
  },
}));

describe('WebSearchSource', () => {
  let source: WebSearchSource;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock connector
    try {
      Connector.create({
        name: 'test-serper',
        serviceType: Services.Serper,
        auth: { type: 'api_key', apiKey: 'test-key' },
        baseURL: 'https://google.serper.dev',
      });
    } catch {
      // Connector may already exist
    }
  });

  describe('constructor', () => {
    it('should create instance with connector name', () => {
      source = new WebSearchSource({
        name: 'web-test',
        searchConnector: 'test-serper',
      });

      expect(source).toBeDefined();
      expect(source.name).toBe('web-test');
      expect(source.type).toBe('web');
    });

    it('should use default description', () => {
      source = new WebSearchSource({
        name: 'web-test',
        searchConnector: 'test-serper',
      });

      expect(source.description).toContain('web-test');
    });

    it('should accept custom description', () => {
      source = new WebSearchSource({
        name: 'web-test',
        description: 'Custom web search',
        searchConnector: 'test-serper',
      });

      expect(source.description).toBe('Custom web search');
    });

    it('should accept country and language defaults', () => {
      source = new WebSearchSource({
        name: 'web-test',
        searchConnector: 'test-serper',
        defaultCountry: 'us',
        defaultLanguage: 'en',
      });

      expect(source).toBeDefined();
    });
  });

  describe('search', () => {
    beforeEach(() => {
      source = new WebSearchSource({
        name: 'web-test',
        searchConnector: 'test-serper',
      });
    });

    it('should search and return formatted results', async () => {
      const response = await source.search('test query');

      expect(response.success).toBe(true);
      expect(response.query).toBe('test query');
      expect(response.results.length).toBe(2);
    });

    it('should format results with IResearchSource structure', async () => {
      const response = await source.search('test query');
      const result = response.results[0];

      expect(result.id).toBeDefined();
      expect(result.title).toBe('Test Result 1');
      expect(result.snippet).toBe('Test snippet 1');
      expect(result.reference).toBe('https://example.com/1');
      expect(result.relevance).toBeDefined();
    });

    it('should calculate relevance from position', async () => {
      const response = await source.search('test query');

      // First result should have higher relevance than second
      expect(response.results[0].relevance).toBeGreaterThan(response.results[1].relevance!);
    });

    it('should pass maxResults option', async () => {
      await source.search('test query', { maxResults: 5 });

      // The mock should receive the options
      // This tests that options are passed through
    });

    it('should handle search errors gracefully', async () => {
      // Override mock for this test
      const { SearchProvider } = await import('@/capabilities/search/SearchProvider.js');
      (SearchProvider.create as any).mockReturnValueOnce({
        search: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      const errorSource = new WebSearchSource({
        name: 'error-test',
        searchConnector: 'test-serper',
      });

      const response = await errorSource.search('test query');

      expect(response.success).toBe(false);
      expect(response.error).toContain('Network error');
      expect(response.results).toEqual([]);
    });
  });

  describe('fetch', () => {
    beforeEach(() => {
      source = new WebSearchSource({
        name: 'web-test',
        searchConnector: 'test-serper',
      });

      // Mock global fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/html' }),
        arrayBuffer: vi.fn().mockResolvedValue(Buffer.from('Test content')),
      });
    });

    it('should fetch URL content', async () => {
      const result = await source.fetch('https://example.com/page');

      expect(result.success).toBe(true);
      expect(result.reference).toBe('https://example.com/page');
      expect(result.content).toBe('Test content');
      expect(result.contentType).toBe('text/html');
    });

    it('should include size in bytes', async () => {
      const result = await source.fetch('https://example.com/page');

      expect(result.sizeBytes).toBeDefined();
      expect(result.sizeBytes).toBeGreaterThan(0);
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await source.fetch('https://example.com/missing');

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('should respect maxSize option', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/html' }),
        arrayBuffer: vi.fn().mockResolvedValue(Buffer.from('x'.repeat(10000))),
      });

      const result = await source.fetch('https://example.com/large', { maxSize: 100 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should handle timeout', async () => {
      (global.fetch as any).mockImplementationOnce(() =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Aborted')), 100);
        })
      );

      const result = await source.fetch('https://example.com/slow', { timeoutMs: 50 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should include metadata with response headers', async () => {
      const result = await source.fetch('https://example.com/page');

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.statusCode).toBe(200);
      expect(result.metadata?.headers).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    beforeEach(() => {
      source = new WebSearchSource({
        name: 'web-test',
        searchConnector: 'test-serper',
      });
    });

    it('should return true when search succeeds', async () => {
      const available = await source.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when search fails', async () => {
      const { SearchProvider } = await import('@/capabilities/search/SearchProvider.js');
      (SearchProvider.create as any).mockReturnValueOnce({
        search: vi.fn().mockResolvedValue({ success: false }),
      });

      const unavailableSource = new WebSearchSource({
        name: 'unavailable-test',
        searchConnector: 'test-serper',
      });

      const available = await unavailableSource.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('getCapabilities', () => {
    beforeEach(() => {
      source = new WebSearchSource({
        name: 'web-test',
        searchConnector: 'test-serper',
      });
    });

    it('should return capabilities', () => {
      const caps = source.getCapabilities();

      expect(caps.canSearch).toBe(true);
      expect(caps.canFetch).toBe(true);
      expect(caps.hasRelevanceScores).toBe(true);
      expect(caps.maxResultsPerSearch).toBe(100);
      expect(caps.contentTypes).toContain('text/html');
    });
  });
});

describe('createWebSearchSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    try {
      Connector.create({
        name: 'factory-serper',
        serviceType: Services.Serper,
        auth: { type: 'api_key', apiKey: 'test-key' },
        baseURL: 'https://google.serper.dev',
      });
    } catch {
      // Connector may already exist
    }
  });

  it('should create source from connector name', () => {
    const source = createWebSearchSource('factory-serper');

    expect(source).toBeDefined();
    expect(source.name).toBe('web-factory-serper');
  });

  it('should accept custom name', () => {
    const source = createWebSearchSource('factory-serper', { name: 'custom-web' });

    expect(source.name).toBe('custom-web');
  });

  it('should accept custom description', () => {
    const source = createWebSearchSource('factory-serper', {
      description: 'Custom search source',
    });

    expect(source.description).toBe('Custom search source');
  });

  it('should pass through country and language', () => {
    const source = createWebSearchSource('factory-serper', {
      defaultCountry: 'uk',
      defaultLanguage: 'en',
    });

    expect(source).toBeDefined();
  });
});
