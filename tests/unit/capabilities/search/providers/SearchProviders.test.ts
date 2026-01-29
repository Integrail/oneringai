/**
 * Search Provider Tests
 * Tests for SerperProvider, BraveProvider, TavilyProvider, RapidAPIProvider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SerperProvider } from '../../../../../src/capabilities/search/providers/SerperProvider.js';
import { BraveProvider } from '../../../../../src/capabilities/search/providers/BraveProvider.js';
import { TavilyProvider } from '../../../../../src/capabilities/search/providers/TavilyProvider.js';
import { RapidAPIProvider } from '../../../../../src/capabilities/search/providers/RapidAPIProvider.js';
import type { Connector } from '../../../../../src/core/Connector.js';

// Create mock connector factory
function createMockConnector(mockFetchJSON: any): Connector {
  return {
    fetchJSON: mockFetchJSON,
    config: {
      auth: {
        type: 'api_key',
        apiKey: 'test-api-key',
      },
    },
  } as unknown as Connector;
}

// Helper to get parsed body from mock call
function getBodyFromCall(mockFetchJSON: any): any {
  const call = mockFetchJSON.mock.calls[0];
  if (call && call[1] && call[1].body) {
    return JSON.parse(call[1].body);
  }
  return null;
}

// ============================================================================
// SerperProvider Tests
// ============================================================================

describe('SerperProvider', () => {
  let mockFetchJSON: ReturnType<typeof vi.fn>;
  let provider: SerperProvider;

  beforeEach(() => {
    mockFetchJSON = vi.fn();
    provider = new SerperProvider(createMockConnector(mockFetchJSON));
  });

  describe('name', () => {
    it('should have correct name', () => {
      expect(provider.name).toBe('serper');
    });
  });

  describe('search', () => {
    it('should return successful results', async () => {
      mockFetchJSON.mockResolvedValue({
        organic: [
          { title: 'Result 1', link: 'https://example.com/1', snippet: 'Snippet 1' },
          { title: 'Result 2', link: 'https://example.com/2', snippet: 'Snippet 2' },
        ],
      });

      const result = await provider.search('test query');

      expect(result.success).toBe(true);
      expect(result.query).toBe('test query');
      expect(result.provider).toBe('serper');
      expect(result.count).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toEqual({
        title: 'Result 1',
        url: 'https://example.com/1',
        snippet: 'Snippet 1',
        position: 1,
      });
    });

    it('should call fetchJSON with POST method', async () => {
      mockFetchJSON.mockResolvedValue({ organic: [] });

      await provider.search('test');

      expect(mockFetchJSON).toHaveBeenCalledWith(
        '/search',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should include query and numResults in body', async () => {
      mockFetchJSON.mockResolvedValue({ organic: [] });

      await provider.search('test query', { numResults: 5 });

      const body = getBodyFromCall(mockFetchJSON);
      expect(body.q).toBe('test query');
      expect(body.num).toBe(5);
    });

    it('should pass country and language options', async () => {
      mockFetchJSON.mockResolvedValue({ organic: [] });

      await provider.search('test', { country: 'us', language: 'en' });

      const body = getBodyFromCall(mockFetchJSON);
      expect(body.gl).toBe('us');
      expect(body.hl).toBe('en');
    });

    it('should cap numResults at 100', async () => {
      mockFetchJSON.mockResolvedValue({ organic: [] });

      await provider.search('test', { numResults: 500 });

      const body = getBodyFromCall(mockFetchJSON);
      expect(body.num).toBe(100);
    });

    it('should default numResults to 10', async () => {
      mockFetchJSON.mockResolvedValue({ organic: [] });

      await provider.search('test');

      const body = getBodyFromCall(mockFetchJSON);
      expect(body.num).toBe(10);
    });

    it('should handle empty results', async () => {
      mockFetchJSON.mockResolvedValue({ organic: [] });

      const result = await provider.search('obscure query');

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should handle missing title/snippet gracefully', async () => {
      mockFetchJSON.mockResolvedValue({
        organic: [
          { link: 'https://example.com' },
        ],
      });

      const result = await provider.search('test');

      expect(result.results[0].title).toBe('Untitled');
      expect(result.results[0].snippet).toBe('');
    });

    it('should handle invalid response (no organic)', async () => {
      mockFetchJSON.mockResolvedValue({ results: [] }); // Wrong format

      const result = await provider.search('test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid response');
    });

    it('should handle API errors', async () => {
      mockFetchJSON.mockRejectedValue(new Error('API rate limit'));

      const result = await provider.search('test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API rate limit');
      expect(result.results).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('should pass vendor options', async () => {
      mockFetchJSON.mockResolvedValue({ organic: [] });

      await provider.search('test', {
        vendorOptions: { location: 'New York' },
      });

      const body = getBodyFromCall(mockFetchJSON);
      expect(body.location).toBe('New York');
    });
  });
});

// ============================================================================
// BraveProvider Tests
// ============================================================================

describe('BraveProvider', () => {
  let mockFetchJSON: ReturnType<typeof vi.fn>;
  let provider: BraveProvider;

  beforeEach(() => {
    mockFetchJSON = vi.fn();
    provider = new BraveProvider(createMockConnector(mockFetchJSON));
  });

  describe('name', () => {
    it('should have correct name', () => {
      expect(provider.name).toBe('brave');
    });
  });

  describe('search', () => {
    it('should return successful results', async () => {
      mockFetchJSON.mockResolvedValue({
        web: {
          results: [
            { title: 'Brave Result 1', url: 'https://example.com/1', description: 'Desc 1' },
            { title: 'Brave Result 2', url: 'https://example.com/2', description: 'Desc 2' },
          ],
        },
      });

      const result = await provider.search('test query');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('brave');
      expect(result.count).toBe(2);
      expect(result.results[0]).toEqual({
        title: 'Brave Result 1',
        url: 'https://example.com/1',
        snippet: 'Desc 1',
        position: 1,
      });
    });

    it('should use GET method with query string', async () => {
      mockFetchJSON.mockResolvedValue({ web: { results: [] } });

      await provider.search('test query', { numResults: 5 });

      expect(mockFetchJSON).toHaveBeenCalledWith(
        expect.stringContaining('/web/search?'),
        expect.objectContaining({ method: 'GET' })
      );
      // URLSearchParams uses + for spaces
      expect(mockFetchJSON.mock.calls[0][0]).toContain('q=test+query');
      expect(mockFetchJSON.mock.calls[0][0]).toContain('count=5');
    });

    it('should pass country and language', async () => {
      mockFetchJSON.mockResolvedValue({ web: { results: [] } });

      await provider.search('test', { country: 'gb', language: 'en' });

      const url = mockFetchJSON.mock.calls[0][0];
      expect(url).toContain('country=gb');
      expect(url).toContain('search_lang=en');
    });

    it('should cap numResults at 20', async () => {
      mockFetchJSON.mockResolvedValue({ web: { results: [] } });

      await provider.search('test', { numResults: 100 });

      expect(mockFetchJSON.mock.calls[0][0]).toContain('count=20');
    });

    it('should handle missing web.results', async () => {
      mockFetchJSON.mockResolvedValue({ web: null });

      const result = await provider.search('test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid response');
    });

    it('should handle API errors', async () => {
      mockFetchJSON.mockRejectedValue(new Error('Brave API error'));

      const result = await provider.search('test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Brave API error');
    });

    it('should handle missing description gracefully', async () => {
      mockFetchJSON.mockResolvedValue({
        web: {
          results: [{ title: 'Test', url: 'https://test.com' }],
        },
      });

      const result = await provider.search('test');

      expect(result.results[0].snippet).toBe('');
    });
  });
});

// ============================================================================
// TavilyProvider Tests
// ============================================================================

describe('TavilyProvider', () => {
  let mockFetchJSON: ReturnType<typeof vi.fn>;
  let provider: TavilyProvider;

  beforeEach(() => {
    mockFetchJSON = vi.fn();
    provider = new TavilyProvider(createMockConnector(mockFetchJSON));
  });

  describe('name', () => {
    it('should have correct name', () => {
      expect(provider.name).toBe('tavily');
    });
  });

  describe('search', () => {
    it('should return successful results', async () => {
      mockFetchJSON.mockResolvedValue({
        results: [
          { title: 'Tavily 1', url: 'https://example.com/1', content: 'Content 1' },
          { title: 'Tavily 2', url: 'https://example.com/2', content: 'Content 2' },
        ],
      });

      const result = await provider.search('test query');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('tavily');
      expect(result.count).toBe(2);
      expect(result.results[0]).toEqual({
        title: 'Tavily 1',
        url: 'https://example.com/1',
        snippet: 'Content 1',
        position: 1,
      });
    });

    it('should use POST method', async () => {
      mockFetchJSON.mockResolvedValue({ results: [] });

      await provider.search('test');

      expect(mockFetchJSON).toHaveBeenCalledWith(
        '/search',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should include api_key in body', async () => {
      mockFetchJSON.mockResolvedValue({ results: [] });

      await provider.search('test');

      const body = getBodyFromCall(mockFetchJSON);
      expect(body.api_key).toBe('test-api-key');
    });

    it('should pass query and max_results', async () => {
      mockFetchJSON.mockResolvedValue({ results: [] });

      await provider.search('my query', { numResults: 15 });

      const body = getBodyFromCall(mockFetchJSON);
      expect(body.query).toBe('my query');
      expect(body.max_results).toBe(15);
    });

    it('should cap numResults at 20', async () => {
      mockFetchJSON.mockResolvedValue({ results: [] });

      await provider.search('test', { numResults: 50 });

      const body = getBodyFromCall(mockFetchJSON);
      expect(body.max_results).toBe(20);
    });

    it('should pass search_depth from vendorOptions', async () => {
      mockFetchJSON.mockResolvedValue({ results: [] });

      await provider.search('test', {
        vendorOptions: { search_depth: 'advanced' },
      });

      const body = getBodyFromCall(mockFetchJSON);
      expect(body.search_depth).toBe('advanced');
    });

    it('should default search_depth to basic', async () => {
      mockFetchJSON.mockResolvedValue({ results: [] });

      await provider.search('test');

      const body = getBodyFromCall(mockFetchJSON);
      expect(body.search_depth).toBe('basic');
    });

    it('should pass include_answer option', async () => {
      mockFetchJSON.mockResolvedValue({ results: [] });

      await provider.search('test', {
        vendorOptions: { include_answer: true },
      });

      const body = getBodyFromCall(mockFetchJSON);
      expect(body.include_answer).toBe(true);
    });

    it('should handle invalid response', async () => {
      mockFetchJSON.mockResolvedValue({ organic: [] }); // Wrong format

      const result = await provider.search('test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid response');
    });

    it('should handle API errors', async () => {
      mockFetchJSON.mockRejectedValue(new Error('Tavily API error'));

      const result = await provider.search('test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tavily API error');
    });

    it('should use content field for snippet', async () => {
      mockFetchJSON.mockResolvedValue({
        results: [{ title: 'Test', url: 'https://test.com', content: 'AI summary' }],
      });

      const result = await provider.search('test');

      expect(result.results[0].snippet).toBe('AI summary');
    });
  });
});

// ============================================================================
// RapidAPIProvider Tests
// ============================================================================

describe('RapidAPIProvider', () => {
  let mockFetchJSON: ReturnType<typeof vi.fn>;
  let provider: RapidAPIProvider;

  beforeEach(() => {
    mockFetchJSON = vi.fn();
    provider = new RapidAPIProvider(createMockConnector(mockFetchJSON));
  });

  describe('name', () => {
    it('should have correct name', () => {
      expect(provider.name).toBe('rapidapi');
    });
  });

  describe('search', () => {
    it('should return successful results with data.organic format', async () => {
      mockFetchJSON.mockResolvedValue({
        data: {
          organic: [
            { title: 'Rapid 1', link: 'https://example.com/1', snippet: 'Snippet 1' },
            { title: 'Rapid 2', link: 'https://example.com/2', snippet: 'Snippet 2' },
          ],
        },
      });

      const result = await provider.search('test query');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('rapidapi');
      expect(result.count).toBe(2);
      expect(result.results[0]).toEqual({
        title: 'Rapid 1',
        url: 'https://example.com/1',
        snippet: 'Snippet 1',
        position: 1,
      });
    });

    it('should handle organic format (without data wrapper)', async () => {
      mockFetchJSON.mockResolvedValue({
        organic: [
          { title: 'Result', url: 'https://example.com', description: 'Desc' },
        ],
      });

      const result = await provider.search('test');

      expect(result.success).toBe(true);
      expect(result.results[0].url).toBe('https://example.com');
      expect(result.results[0].snippet).toBe('Desc');
    });

    it('should use GET method with query string', async () => {
      mockFetchJSON.mockResolvedValue({ organic: [] });

      await provider.search('test query', { numResults: 5 });

      expect(mockFetchJSON).toHaveBeenCalledWith(
        expect.stringContaining('/search?'),
        expect.objectContaining({ method: 'GET' })
      );
      // URLSearchParams uses + for spaces
      expect(mockFetchJSON.mock.calls[0][0]).toContain('q=test+query');
      expect(mockFetchJSON.mock.calls[0][0]).toContain('num=5');
    });

    it('should include default query params', async () => {
      mockFetchJSON.mockResolvedValue({ organic: [] });

      await provider.search('test');

      const url = mockFetchJSON.mock.calls[0][0];
      expect(url).toContain('start=0');
      expect(url).toContain('fetch_ai_overviews=false');
      expect(url).toContain('deduplicate=false');
    });

    it('should pass country and language', async () => {
      mockFetchJSON.mockResolvedValue({ organic: [] });

      await provider.search('test', { country: 'de', language: 'de' });

      const url = mockFetchJSON.mock.calls[0][0];
      expect(url).toContain('gl=de');
      expect(url).toContain('hl=de');
    });

    it('should cap numResults at 100', async () => {
      mockFetchJSON.mockResolvedValue({ organic: [] });

      await provider.search('test', { numResults: 500 });

      expect(mockFetchJSON.mock.calls[0][0]).toContain('num=100');
    });

    it('should handle link OR url field', async () => {
      mockFetchJSON.mockResolvedValue({
        organic: [
          { title: 'Test', url: 'https://via-url.com' },
        ],
      });

      const result = await provider.search('test');

      expect(result.results[0].url).toBe('https://via-url.com');
    });

    it('should handle snippet OR description field', async () => {
      mockFetchJSON.mockResolvedValue({
        organic: [
          { title: 'Test', link: 'https://test.com', description: 'From description' },
        ],
      });

      const result = await provider.search('test');

      expect(result.results[0].snippet).toBe('From description');
    });

    it('should handle invalid response (non-array)', async () => {
      mockFetchJSON.mockResolvedValue({ data: { organic: 'not an array' } });

      const result = await provider.search('test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid response');
    });

    it('should handle API errors', async () => {
      mockFetchJSON.mockRejectedValue(new Error('RapidAPI error'));

      const result = await provider.search('test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('RapidAPI error');
    });

    it('should pass vendor options', async () => {
      mockFetchJSON.mockResolvedValue({ organic: [] });

      await provider.search('test', {
        vendorOptions: { custom_param: 'value' },
      });

      expect(mockFetchJSON.mock.calls[0][0]).toContain('custom_param=value');
    });
  });
});
