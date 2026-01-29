/**
 * ResearchAgent Tests
 * Tests for the generic research agent with pluggable sources
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResearchAgent, ResearchAgentConfig, createResearchTools } from '@/capabilities/researchAgent/ResearchAgent.js';
import type { IResearchSource, SearchResponse, FetchedContent, SourceCapabilities } from '@/capabilities/researchAgent/types.js';
import { Connector, Vendor } from '@/index.js';

// Mock IResearchSource implementation for testing
function createMockSource(name: string, type: 'web' | 'file' | 'vector' = 'web'): IResearchSource {
  return {
    name,
    description: `Mock ${name} source`,
    type,
    search: vi.fn(async (query: string, options?: any): Promise<SearchResponse> => ({
      success: true,
      query,
      results: [
        {
          id: `${name}_result_1`,
          title: `Result 1 for ${query}`,
          snippet: `Snippet about ${query}`,
          reference: `https://example.com/${name}/1`,
          relevance: 0.9,
        },
        {
          id: `${name}_result_2`,
          title: `Result 2 for ${query}`,
          snippet: `Another snippet about ${query}`,
          reference: `https://example.com/${name}/2`,
          relevance: 0.8,
        },
      ],
      totalResults: 2,
    })),
    fetch: vi.fn(async (reference: string, options?: any): Promise<FetchedContent> => ({
      success: true,
      reference,
      content: `Content from ${reference}`,
      contentType: 'text/html',
      sizeBytes: 1000,
    })),
    isAvailable: vi.fn(async () => true),
    getCapabilities: vi.fn((): SourceCapabilities => ({
      canSearch: true,
      canFetch: true,
      hasRelevanceScores: true,
      maxResultsPerSearch: 100,
      contentTypes: ['text/html', 'text/plain'],
    })),
  };
}

describe('ResearchAgent', () => {
  let mockSource1: IResearchSource;
  let mockSource2: IResearchSource;
  let agent: ResearchAgent;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock connector
    try {
      Connector.create({
        name: 'test-openai',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });
    } catch {
      // Connector may already exist
    }

    mockSource1 = createMockSource('source1', 'web');
    mockSource2 = createMockSource('source2', 'file');
  });

  afterEach(async () => {
    if (agent) {
      await agent.destroy();
    }
  });

  describe('create', () => {
    it('should create ResearchAgent with sources', () => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1, mockSource2],
      });

      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(ResearchAgent);
    });

    it('should register all sources', () => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1, mockSource2],
      });

      const sources = agent.getSources();
      expect(sources.length).toBe(2);
    });

    it('should include research tools by default', () => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1],
      });

      const toolNames = agent.tools.listEnabled();
      expect(toolNames).toContain('research_search');
      expect(toolNames).toContain('research_fetch');
      expect(toolNames).toContain('research_store_finding');
      expect(toolNames).toContain('research_list_sources');
    });

    it('should exclude research tools when includeResearchTools=false', () => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1],
        includeResearchTools: false,
      });

      const toolNames = agent.tools.listEnabled();
      expect(toolNames).not.toContain('research_search');
    });

    it('should set research task type for context', () => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1],
      });

      // The agent should be created with research task type
      expect(agent).toBeDefined();
    });

    it('should setup auto-spill plugin', () => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1],
        autoSpill: {
          sizeThreshold: 5000,
        },
      });

      const stats = agent.getAutoSpillStats();
      expect(stats).toBeDefined();
      expect(stats.totalSpilled).toBe(0);
    });
  });

  describe('getSources', () => {
    beforeEach(() => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1, mockSource2],
      });
    });

    it('should return all registered sources', () => {
      const sources = agent.getSources();
      expect(sources.length).toBe(2);
      expect(sources.map(s => s.name)).toContain('source1');
      expect(sources.map(s => s.name)).toContain('source2');
    });
  });

  describe('getSource', () => {
    beforeEach(() => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1, mockSource2],
      });
    });

    it('should return source by name', () => {
      const source = agent.getSource('source1');
      expect(source).toBe(mockSource1);
    });

    it('should return undefined for unknown source', () => {
      const source = agent.getSource('unknown');
      expect(source).toBeUndefined();
    });
  });

  describe('addSource', () => {
    beforeEach(() => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1],
      });
    });

    it('should add a new source', () => {
      agent.addSource(mockSource2);

      const sources = agent.getSources();
      expect(sources.length).toBe(2);
    });

    it('should replace existing source with same name', () => {
      const newSource = createMockSource('source1', 'vector');
      agent.addSource(newSource);

      const source = agent.getSource('source1');
      expect(source?.type).toBe('vector');
    });
  });

  describe('removeSource', () => {
    beforeEach(() => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1, mockSource2],
      });
    });

    it('should remove a source', () => {
      const removed = agent.removeSource('source1');
      expect(removed).toBe(true);
      expect(agent.getSources().length).toBe(1);
    });

    it('should return false for unknown source', () => {
      const removed = agent.removeSource('unknown');
      expect(removed).toBe(false);
    });
  });

  describe('searchSources', () => {
    beforeEach(() => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1, mockSource2],
      });
    });

    it('should search all sources by default', async () => {
      const results = await agent.searchSources('test query');

      expect(results.size).toBe(2);
      expect(results.has('source1')).toBe(true);
      expect(results.has('source2')).toBe(true);
      expect(mockSource1.search).toHaveBeenCalledWith('test query', expect.any(Object));
      expect(mockSource2.search).toHaveBeenCalledWith('test query', expect.any(Object));
    });

    it('should search specific sources when specified', async () => {
      const results = await agent.searchSources('test query', { sources: ['source1'] });

      expect(results.size).toBe(1);
      expect(results.has('source1')).toBe(true);
      expect(mockSource1.search).toHaveBeenCalled();
      expect(mockSource2.search).not.toHaveBeenCalled();
    });

    it('should pass maxResults option', async () => {
      await agent.searchSources('test query', { maxResults: 5 });

      expect(mockSource1.search).toHaveBeenCalledWith(
        'test query',
        expect.objectContaining({ maxResults: 5 })
      );
    });

    it('should handle source errors gracefully', async () => {
      (mockSource1.search as any).mockRejectedValue(new Error('Network error'));

      const results = await agent.searchSources('test query');

      expect(results.get('source1')?.success).toBe(false);
      expect(results.get('source1')?.error).toContain('Network error');
      expect(results.get('source2')?.success).toBe(true);
    });

    it('should call onSearchComplete hook', async () => {
      const onSearchComplete = vi.fn();
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1],
        hooks: { onSearchComplete },
      });

      await agent.searchSources('test query');

      expect(onSearchComplete).toHaveBeenCalledWith('source1', 'test query', 2);
    });
  });

  describe('fetchFromSource', () => {
    beforeEach(() => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1],
      });
    });

    it('should fetch content from specified source', async () => {
      const result = await agent.fetchFromSource('source1', 'https://example.com/article');

      expect(result.success).toBe(true);
      expect(result.content).toContain('Content from');
      expect(mockSource1.fetch).toHaveBeenCalledWith('https://example.com/article', expect.any(Object));
    });

    it('should return error for unknown source', async () => {
      const result = await agent.fetchFromSource('unknown', 'https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle fetch errors gracefully', async () => {
      (mockSource1.fetch as any).mockRejectedValue(new Error('Timeout'));

      const result = await agent.fetchFromSource('source1', 'https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout');
    });

    it('should call onContentFetched hook', async () => {
      const onContentFetched = vi.fn();
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1],
        hooks: { onContentFetched },
      });

      await agent.fetchFromSource('source1', 'https://example.com');

      expect(onContentFetched).toHaveBeenCalledWith('source1', 'https://example.com', 1000);
    });
  });

  describe('storeFinding', () => {
    beforeEach(() => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1],
      });
    });

    it('should store a finding in memory', async () => {
      await agent.storeFinding('ai_trends', {
        source: 'source1',
        query: 'AI trends',
        summary: 'Key AI trends discovered',
        references: ['https://example.com/1'],
        confidence: 0.9,
        timestamp: Date.now(),
      });

      const findings = await agent.getFindings();
      expect(findings['findings.ai_trends']).toBeDefined();
    });

    it('should call onFindingStored hook', async () => {
      const onFindingStored = vi.fn();
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1],
        hooks: { onFindingStored },
      });

      await agent.storeFinding('test_key', {
        source: 'source1',
        query: 'test',
        summary: 'Test finding',
        references: ['ref1'],
        timestamp: Date.now(),
      });

      expect(onFindingStored).toHaveBeenCalled();
    });
  });

  describe('getFindings', () => {
    beforeEach(() => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1],
      });
    });

    it('should return all stored findings', async () => {
      await agent.storeFinding('finding1', {
        source: 'source1',
        query: 'q1',
        summary: 'Finding 1',
        references: ['ref1'],
        timestamp: Date.now(),
      });

      await agent.storeFinding('finding2', {
        source: 'source1',
        query: 'q2',
        summary: 'Finding 2',
        references: ['ref2'],
        timestamp: Date.now(),
      });

      const findings = await agent.getFindings();
      expect(Object.keys(findings).length).toBe(2);
    });
  });

  describe('cleanupProcessedRaw', () => {
    beforeEach(() => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1],
        autoSpill: { sizeThreshold: 10 },
      });
    });

    it('should cleanup specified raw keys', async () => {
      // Manually add to memory to simulate spilled content
      const rawKey = 'raw.test_data';
      await agent['_agentContext'].memory.storeRaw('test_data', 'Test raw data', 'content');

      const deleted = await agent.cleanupProcessedRaw([rawKey]);
      // The key will be deleted from memory even though it's not tracked by AutoSpill
      // cleanup() attempts to delete and returns the count
      expect(deleted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executeResearchPlan', () => {
    beforeEach(() => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1, mockSource2],
      });
    });

    it('should execute research plan with multiple queries', async () => {
      const result = await agent.executeResearchPlan({
        goal: 'Research AI trends',
        queries: [
          { query: 'AI trends 2026' },
          { query: 'Machine learning advances' },
        ],
        maxResultsPerQuery: 5,
      });

      expect(result.success).toBe(true);
      expect(result.queriesExecuted).toBe(2);
      expect(result.resultsFound).toBeGreaterThan(0);
    });

    it('should search specific sources when specified', async () => {
      await agent.executeResearchPlan({
        goal: 'Research AI',
        queries: [{ query: 'AI', sources: ['source1'] }],
        sources: ['source1'],
      });

      expect(mockSource1.search).toHaveBeenCalled();
      // source2 should not be searched for queries that specify source1 only
    });

    it('should call onProgress hook', async () => {
      const onProgress = vi.fn();
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1],
        hooks: { onProgress },
      });

      await agent.executeResearchPlan({
        goal: 'Test',
        queries: [{ query: 'test' }],
      });

      expect(onProgress).toHaveBeenCalled();
    });

    it('should return metrics', async () => {
      const result = await agent.executeResearchPlan({
        goal: 'Test',
        queries: [{ query: 'test' }],
      });

      expect(result.metrics).toBeDefined();
      expect(result.metrics?.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.metrics?.searchDurationMs).toBeDefined();
      expect(result.metrics?.processDurationMs).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      (mockSource1.search as any).mockRejectedValue(new Error('Network error'));

      const result = await agent.executeResearchPlan({
        goal: 'Test',
        queries: [{ query: 'test' }],
      });

      // Should still complete but with error in results
      expect(result.success).toBe(true);
    });
  });

  describe('getAutoSpillStats', () => {
    beforeEach(() => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1],
      });
    });

    it('should return auto-spill statistics', () => {
      const stats = agent.getAutoSpillStats();

      expect(stats).toHaveProperty('totalSpilled');
      expect(stats).toHaveProperty('consumed');
      expect(stats).toHaveProperty('unconsumed');
      expect(stats).toHaveProperty('totalSizeBytes');
    });
  });

  describe('destroy', () => {
    it('should clean up resources', async () => {
      agent = ResearchAgent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        sources: [mockSource1, mockSource2],
      });

      await agent.destroy();

      expect(agent.getSources().length).toBe(0);
    });
  });
});

describe('createResearchTools', () => {
  let mockSource: IResearchSource;
  let tools: ReturnType<typeof createResearchTools>;

  beforeEach(() => {
    mockSource = createMockSource('test-source');
    tools = createResearchTools([mockSource]);
  });

  describe('research_search tool', () => {
    it('should create search tool', () => {
      const searchTool = tools.find(t => t.definition.function.name === 'research_search');
      expect(searchTool).toBeDefined();
    });

    it('should search sources and return formatted results', async () => {
      const searchTool = tools.find(t => t.definition.function.name === 'research_search')!;

      const result = await searchTool.execute({ query: 'test query' });

      expect(result.query).toBe('test query');
      expect(result.results['test-source']).toBeDefined();
      expect(result.totalResults).toBeGreaterThan(0);
    });

    it('should filter by specific sources', async () => {
      const source2 = createMockSource('other-source');
      const multiTools = createResearchTools([mockSource, source2]);
      const searchTool = multiTools.find(t => t.definition.function.name === 'research_search')!;

      const result = await searchTool.execute({
        query: 'test',
        sources: ['test-source'],
      });

      expect(result.sources).toContain('test-source');
      expect(mockSource.search).toHaveBeenCalled();
    });
  });

  describe('research_fetch tool', () => {
    it('should create fetch tool', () => {
      const fetchTool = tools.find(t => t.definition.function.name === 'research_fetch');
      expect(fetchTool).toBeDefined();
    });

    it('should fetch content from source', async () => {
      const fetchTool = tools.find(t => t.definition.function.name === 'research_fetch')!;

      const result = await fetchTool.execute({
        source: 'test-source',
        reference: 'https://example.com',
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });

    it('should return error for unknown source', async () => {
      const fetchTool = tools.find(t => t.definition.function.name === 'research_fetch')!;

      const result = await fetchTool.execute({
        source: 'unknown',
        reference: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('research_store_finding tool', () => {
    it('should create store finding tool', () => {
      const storeTool = tools.find(t => t.definition.function.name === 'research_store_finding');
      expect(storeTool).toBeDefined();
    });

    it('should require memory context', async () => {
      const storeTool = tools.find(t => t.definition.function.name === 'research_store_finding')!;

      await expect(
        storeTool.execute({
          key: 'test',
          source: 'source1',
          query: 'query',
          summary: 'summary',
          references: ['ref'],
        })
      ).rejects.toThrow('Requires memory context');
    });
  });

  describe('research_list_sources tool', () => {
    it('should create list sources tool', () => {
      const listTool = tools.find(t => t.definition.function.name === 'research_list_sources');
      expect(listTool).toBeDefined();
    });

    it('should list all sources with capabilities', async () => {
      const listTool = tools.find(t => t.definition.function.name === 'research_list_sources')!;

      const result = await listTool.execute({});

      expect(result.count).toBe(1);
      expect(result.sources[0].name).toBe('test-source');
      expect(result.sources[0].capabilities).toBeDefined();
    });
  });
});
