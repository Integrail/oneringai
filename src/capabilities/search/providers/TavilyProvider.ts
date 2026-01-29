/**
 * Tavily AI Search Provider
 * AI-optimized search results with summaries
 */

import type { Connector } from '../../../core/Connector.js';
import type {
  ISearchProvider,
  SearchResult,
  SearchOptions,
  SearchResponse,
} from '../SearchProvider.js';
import { toConnectorOptions } from '../types.js';

export class TavilyProvider implements ISearchProvider {
  readonly name = 'tavily';

  constructor(readonly connector: Connector) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const numResults = Math.min(options.numResults || 10, 20);

    try {
      // Tavily requires API key in body
      const auth = this.connector.config.auth;
      const apiKey = auth.type === 'api_key' ? auth.apiKey : '';

      const fetchOptions = toConnectorOptions({
        method: 'POST',
        body: {
          api_key: apiKey,
          query,
          max_results: numResults,
          search_depth: options.vendorOptions?.search_depth || 'basic',
          include_answer: options.vendorOptions?.include_answer || false,
          include_raw_content: options.vendorOptions?.include_raw_content || false,
          ...options.vendorOptions,
        },
      });

      const response = await this.connector.fetchJSON<any>('/search', fetchOptions);

      if (!response.results || !Array.isArray(response.results)) {
        throw new Error('Invalid response from Tavily API');
      }

      const results: SearchResult[] = response.results
        .slice(0, numResults)
        .map((result: any, index: number) => ({
          title: result.title || 'Untitled',
          url: result.url || '',
          snippet: result.content || '',
          position: index + 1,
        }));

      return {
        success: true,
        query,
        provider: this.name,
        results,
        count: results.length,
      };
    } catch (error: any) {
      return {
        success: false,
        query,
        provider: this.name,
        results: [],
        count: 0,
        error: error.message || 'Unknown error',
      };
    }
  }
}
