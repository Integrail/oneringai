/**
 * Web Search Tool Tests
 * Tests for web search functionality with Connector-based and env var approaches
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { webSearch } from '../../../../src/tools/web/webSearch.js';
import { Connector } from '../../../../src/core/Connector.js';
import { SearchProvider } from '../../../../src/capabilities/search/index.js';

// Mock SearchProvider
vi.mock('../../../../src/capabilities/search/index.js', () => ({
  SearchProvider: {
    create: vi.fn(),
  },
}));

// Mock search providers for backward compatibility
vi.mock('../../../../src/tools/web/searchProviders/serper.js', () => ({
  searchWithSerper: vi.fn(),
}));

vi.mock('../../../../src/tools/web/searchProviders/brave.js', () => ({
  searchWithBrave: vi.fn(),
}));

vi.mock('../../../../src/tools/web/searchProviders/tavily.js', () => ({
  searchWithTavily: vi.fn(),
}));

import { searchWithSerper } from '../../../../src/tools/web/searchProviders/serper.js';
import { searchWithBrave } from '../../../../src/tools/web/searchProviders/brave.js';
import { searchWithTavily } from '../../../../src/tools/web/searchProviders/tavily.js';

describe('webSearch', () => {
  const mockSearchResults = [
    { title: 'Result 1', url: 'https://example.com/1', snippet: 'First result', position: 1 },
    { title: 'Result 2', url: 'https://example.com/2', snippet: 'Second result', position: 2 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any connectors from previous tests
    Connector.clear();
  });

  afterEach(() => {
    Connector.clear();
    // Restore environment variables
    delete process.env.SERPER_API_KEY;
    delete process.env.BRAVE_API_KEY;
    delete process.env.TAVILY_API_KEY;
  });

  // ============================================================================
  // Tool Definition Tests
  // ============================================================================

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(webSearch.definition.function.name).toBe('web_search');
    });

    it('should have query as required parameter', () => {
      expect(webSearch.definition.function.parameters.required).toContain('query');
    });

    it('should have optional parameters', () => {
      const props = webSearch.definition.function.parameters.properties as Record<string, any>;
      expect(props.numResults).toBeDefined();
      expect(props.connectorName).toBeDefined();
      expect(props.provider).toBeDefined();
      expect(props.country).toBeDefined();
      expect(props.language).toBeDefined();
    });

    it('should be a blocking tool', () => {
      expect(webSearch.definition.blocking).toBe(true);
    });

    it('should have timeout defined', () => {
      expect(webSearch.definition.timeout).toBe(10000);
    });
  });

  // ============================================================================
  // Connector-based Execution Tests
  // ============================================================================

  describe('Connector-based execution', () => {
    it('should use SearchProvider when connectorName provided', async () => {
      const mockProvider = {
        search: vi.fn().mockResolvedValue({
          success: true,
          query: 'test query',
          provider: 'serper',
          results: mockSearchResults,
          count: 2,
        }),
      };
      (SearchProvider.create as any).mockReturnValue(mockProvider);

      const result = await webSearch.execute({
        query: 'test query',
        connectorName: 'serper-main',
      });

      expect(SearchProvider.create).toHaveBeenCalledWith({ connector: 'serper-main' });
      expect(mockProvider.search).toHaveBeenCalledWith('test query', {
        numResults: 10,
        country: undefined,
        language: undefined,
      });
      expect(result.success).toBe(true);
      expect(result.results).toEqual(mockSearchResults);
    });

    it('should pass numResults to SearchProvider', async () => {
      const mockProvider = {
        search: vi.fn().mockResolvedValue({
          success: true,
          query: 'test',
          provider: 'brave',
          results: [],
          count: 0,
        }),
      };
      (SearchProvider.create as any).mockReturnValue(mockProvider);

      await webSearch.execute({
        query: 'test',
        connectorName: 'brave-main',
        numResults: 5,
      });

      expect(mockProvider.search).toHaveBeenCalledWith('test', {
        numResults: 5,
        country: undefined,
        language: undefined,
      });
    });

    it('should pass country and language options', async () => {
      const mockProvider = {
        search: vi.fn().mockResolvedValue({
          success: true,
          query: 'test',
          provider: 'tavily',
          results: [],
          count: 0,
        }),
      };
      (SearchProvider.create as any).mockReturnValue(mockProvider);

      await webSearch.execute({
        query: 'test',
        connectorName: 'tavily-main',
        country: 'us',
        language: 'en',
      });

      expect(mockProvider.search).toHaveBeenCalledWith('test', {
        numResults: 10,
        country: 'us',
        language: 'en',
      });
    });

    it('should handle connector errors', async () => {
      (SearchProvider.create as any).mockImplementation(() => {
        throw new Error('Connector not found');
      });

      const result = await webSearch.execute({
        query: 'test',
        connectorName: 'non-existent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connector not found');
    });

    it('should handle search errors', async () => {
      const mockProvider = {
        search: vi.fn().mockRejectedValue(new Error('API rate limit exceeded')),
      };
      (SearchProvider.create as any).mockReturnValue(mockProvider);

      const result = await webSearch.execute({
        query: 'test',
        connectorName: 'serper-main',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('API rate limit exceeded');
    });
  });

  // ============================================================================
  // Environment Variable Fallback Tests
  // ============================================================================

  describe('environment variable fallback', () => {
    it('should use serper with SERPER_API_KEY', async () => {
      process.env.SERPER_API_KEY = 'test-serper-key';
      (searchWithSerper as any).mockResolvedValue(mockSearchResults);

      const result = await webSearch.execute({
        query: 'test query',
        provider: 'serper',
      });

      expect(searchWithSerper).toHaveBeenCalledWith('test query', 10, 'test-serper-key');
      expect(result.success).toBe(true);
      expect(result.provider).toBe('serper');
    });

    it('should use brave with BRAVE_API_KEY', async () => {
      process.env.BRAVE_API_KEY = 'test-brave-key';
      (searchWithBrave as any).mockResolvedValue(mockSearchResults);

      const result = await webSearch.execute({
        query: 'test query',
        provider: 'brave',
      });

      expect(searchWithBrave).toHaveBeenCalledWith('test query', 10, 'test-brave-key');
      expect(result.success).toBe(true);
      expect(result.provider).toBe('brave');
    });

    it('should use tavily with TAVILY_API_KEY', async () => {
      process.env.TAVILY_API_KEY = 'test-tavily-key';
      (searchWithTavily as any).mockResolvedValue(mockSearchResults);

      const result = await webSearch.execute({
        query: 'test query',
        provider: 'tavily',
      });

      expect(searchWithTavily).toHaveBeenCalledWith('test query', 10, 'test-tavily-key');
      expect(result.success).toBe(true);
      expect(result.provider).toBe('tavily');
    });

    it('should return error when API key missing', async () => {
      // No env vars set
      const result = await webSearch.execute({
        query: 'test query',
        provider: 'serper',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No API key found');
      expect(result.error).toContain('SERPER_API_KEY');
    });

    it('should handle provider errors', async () => {
      process.env.SERPER_API_KEY = 'test-key';
      (searchWithSerper as any).mockRejectedValue(new Error('Search API error'));

      const result = await webSearch.execute({
        query: 'test query',
        provider: 'serper',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Search API error');
    });

    it('should require connector for rapidapi provider', async () => {
      process.env.RAPIDAPI_KEY = 'test-key';

      const result = await webSearch.execute({
        query: 'test query',
        provider: 'rapidapi',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('RapidAPI provider requires Connector');
    });
  });

  // ============================================================================
  // Auto-detect Tests
  // ============================================================================

  describe('auto-detect', () => {
    it('should find available search connector', async () => {
      // Create a search connector
      Connector.create({
        name: 'my-serper',
        vendor: 'custom' as any,
        serviceType: 'serper',
        auth: { type: 'api_key', apiKey: 'test' },
        baseURL: 'https://google.serper.dev',
      });

      const mockProvider = {
        search: vi.fn().mockResolvedValue({
          success: true,
          query: 'test',
          provider: 'serper',
          results: mockSearchResults,
          count: 2,
        }),
      };
      (SearchProvider.create as any).mockReturnValue(mockProvider);

      const result = await webSearch.execute({
        query: 'test',
      });

      expect(SearchProvider.create).toHaveBeenCalledWith({ connector: 'my-serper' });
      expect(result.success).toBe(true);
    });

    it('should fallback to env var when no connector available', async () => {
      process.env.SERPER_API_KEY = 'fallback-key';
      (searchWithSerper as any).mockResolvedValue(mockSearchResults);

      const result = await webSearch.execute({
        query: 'test',
      });

      expect(searchWithSerper).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Result Formatting Tests
  // ============================================================================

  describe('result formatting', () => {
    it('should include query in result', async () => {
      process.env.SERPER_API_KEY = 'test-key';
      (searchWithSerper as any).mockResolvedValue(mockSearchResults);

      const result = await webSearch.execute({
        query: 'my test query',
        provider: 'serper',
      });

      expect(result.query).toBe('my test query');
    });

    it('should include provider name in result', async () => {
      process.env.BRAVE_API_KEY = 'test-key';
      (searchWithBrave as any).mockResolvedValue(mockSearchResults);

      const result = await webSearch.execute({
        query: 'test',
        provider: 'brave',
      });

      expect(result.provider).toBe('brave');
    });

    it('should include count in result', async () => {
      process.env.SERPER_API_KEY = 'test-key';
      (searchWithSerper as any).mockResolvedValue(mockSearchResults);

      const result = await webSearch.execute({
        query: 'test',
        provider: 'serper',
      });

      expect(result.count).toBe(2);
    });

    it('should return empty results array on error', async () => {
      const result = await webSearch.execute({
        query: 'test',
        provider: 'serper',
      });

      expect(result.success).toBe(false);
      expect(result.results).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('should format results correctly from connector', async () => {
      const mockProvider = {
        search: vi.fn().mockResolvedValue({
          success: true,
          query: 'test',
          provider: 'custom-search',
          results: [
            { title: 'A', url: 'https://a.com', snippet: 'A snippet', position: 1 },
            { title: 'B', url: 'https://b.com', snippet: 'B snippet', position: 2 },
            { title: 'C', url: 'https://c.com', snippet: 'C snippet', position: 3 },
          ],
          count: 3,
        }),
      };
      (SearchProvider.create as any).mockReturnValue(mockProvider);

      const result = await webSearch.execute({
        query: 'test',
        connectorName: 'custom',
      });

      expect(result.results).toHaveLength(3);
      expect(result.results[0]).toEqual({
        title: 'A',
        url: 'https://a.com',
        snippet: 'A snippet',
        position: 1,
      });
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('edge cases', () => {
    it('should handle unknown provider', async () => {
      // Unknown provider falls through to API key check which returns specific message
      const result = await webSearch.execute({
        query: 'test',
        provider: 'unknown' as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No API key found');
    });

    it('should use default numResults when not specified', async () => {
      process.env.SERPER_API_KEY = 'test-key';
      (searchWithSerper as any).mockResolvedValue([]);

      await webSearch.execute({
        query: 'test',
        provider: 'serper',
      });

      expect(searchWithSerper).toHaveBeenCalledWith('test', 10, 'test-key');
    });

    it('should prefer connectorName over provider', async () => {
      const mockProvider = {
        search: vi.fn().mockResolvedValue({
          success: true,
          query: 'test',
          provider: 'connector-provider',
          results: [],
          count: 0,
        }),
      };
      (SearchProvider.create as any).mockReturnValue(mockProvider);

      // Both specified - should use connector
      const result = await webSearch.execute({
        query: 'test',
        connectorName: 'my-connector',
        provider: 'serper',
      });

      expect(SearchProvider.create).toHaveBeenCalled();
      expect(searchWithSerper).not.toHaveBeenCalled();
    });
  });
});
