/**
 * createWebSearchTool Factory Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Connector } from '../../../../src/core/Connector.js';

// Mock SearchProvider
vi.mock('../../../../src/capabilities/search/index.js', () => ({
  SearchProvider: {
    create: vi.fn(),
  },
}));

import { SearchProvider } from '../../../../src/capabilities/search/index.js';
import { createWebSearchTool } from '../../../../src/tools/web/createWebSearchTool.js';

describe('createWebSearchTool', () => {
  let connector: Connector;

  beforeEach(() => {
    vi.clearAllMocks();
    Connector.clear();
    connector = Connector.create({
      name: 'test-serper',
      serviceType: 'serper',
      auth: { type: 'api_key', apiKey: 'test-key' },
      baseURL: 'https://google.serper.dev',
    });
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
      const tool = createWebSearchTool(connector);
      expect(tool.definition.function.name).toBe('web_search');
    });

    it('should have query as required parameter', () => {
      const tool = createWebSearchTool(connector);
      expect(tool.definition.function.parameters.required).toContain('query');
    });

    it('should have optional parameters', () => {
      const tool = createWebSearchTool(connector);
      const props = tool.definition.function.parameters.properties as Record<string, any>;
      expect(props.numResults).toBeDefined();
      expect(props.country).toBeDefined();
      expect(props.language).toBeDefined();
    });

    it('should be a blocking tool', () => {
      const tool = createWebSearchTool(connector);
      expect(tool.definition.blocking).toBe(true);
    });

    it('should have timeout defined', () => {
      const tool = createWebSearchTool(connector);
      expect(tool.definition.timeout).toBe(15000);
    });

    it('should have comprehensive description', () => {
      const tool = createWebSearchTool(connector);
      const desc = tool.definition.function.description;
      expect(desc).toContain('Search the web');
      expect(desc).toContain('results');
    });

    it('should define query parameter with description', () => {
      const tool = createWebSearchTool(connector);
      const props = tool.definition.function.parameters.properties as Record<string, any>;
      expect(props.query.type).toBe('string');
      expect(props.query.description).toBeDefined();
    });
  });

  // ============================================================================
  // Execute Tests
  // ============================================================================

  describe('execute', () => {
    it('should call SearchProvider with the bound connector', async () => {
      const mockSearch = vi.fn().mockResolvedValue({
        success: true,
        query: 'test query',
        provider: 'serper',
        results: [
          { title: 'Result 1', url: 'https://example.com', snippet: 'A snippet', position: 1 },
        ],
        count: 1,
      });
      (SearchProvider.create as any).mockReturnValue({ search: mockSearch });

      const tool = createWebSearchTool(connector);
      const result = await tool.execute({ query: 'test query' });

      expect(SearchProvider.create).toHaveBeenCalledWith({ connector: 'test-serper' });
      expect(mockSearch).toHaveBeenCalledWith('test query', {
        numResults: 10,
        country: undefined,
        language: undefined,
      });
      expect(result.success).toBe(true);
      expect(result.query).toBe('test query');
      expect(result.provider).toBe('serper');
      expect(result.results).toHaveLength(1);
      expect(result.count).toBe(1);
    });

    it('should pass numResults, country, language to provider', async () => {
      const mockSearch = vi.fn().mockResolvedValue({
        success: true,
        query: 'test',
        provider: 'serper',
        results: [],
        count: 0,
      });
      (SearchProvider.create as any).mockReturnValue({ search: mockSearch });

      const tool = createWebSearchTool(connector);
      await tool.execute({ query: 'test', numResults: 5, country: 'gb', language: 'en' });

      expect(mockSearch).toHaveBeenCalledWith('test', {
        numResults: 5,
        country: 'gb',
        language: 'en',
      });
    });

    it('should handle provider failure gracefully', async () => {
      const mockSearch = vi.fn().mockResolvedValue({
        success: false,
        query: 'test',
        provider: 'serper',
        results: [],
        count: 0,
        error: 'Rate limit exceeded',
      });
      (SearchProvider.create as any).mockReturnValue({ search: mockSearch });

      const tool = createWebSearchTool(connector);
      const result = await tool.execute({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });

    it('should handle thrown exceptions gracefully', async () => {
      (SearchProvider.create as any).mockReturnValue({
        search: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      const tool = createWebSearchTool(connector);
      const result = await tool.execute({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.provider).toBe('test-serper');
      expect(result.results).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('should default numResults to 10', async () => {
      const mockSearch = vi.fn().mockResolvedValue({
        success: true,
        query: 'test',
        provider: 'serper',
        results: [],
        count: 0,
      });
      (SearchProvider.create as any).mockReturnValue({ search: mockSearch });

      const tool = createWebSearchTool(connector);
      await tool.execute({ query: 'test' });

      expect(mockSearch).toHaveBeenCalledWith('test', expect.objectContaining({ numResults: 10 }));
    });
  });

  // ============================================================================
  // describeCall Tests
  // ============================================================================

  describe('describeCall', () => {
    it('should describe with query', () => {
      const tool = createWebSearchTool(connector);
      const desc = tool.describeCall!({ query: 'AI news' });
      expect(desc).toBe('"AI news"');
    });

    it('should include numResults when provided', () => {
      const tool = createWebSearchTool(connector);
      const desc = tool.describeCall!({ query: 'AI news', numResults: 5 });
      expect(desc).toBe('"AI news" (5 results)');
    });
  });
});
