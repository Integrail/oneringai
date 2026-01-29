/**
 * Brave Search Provider
 * Independent search index (privacy-focused)
 */

import type { Connector } from '../../../core/Connector.js';
import type {
  ISearchProvider,
  SearchResult,
  SearchOptions,
  SearchResponse,
} from '../SearchProvider.js';
import { buildQueryString } from '../types.js';

export class BraveProvider implements ISearchProvider {
  readonly name = 'brave';

  constructor(readonly connector: Connector) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const numResults = Math.min(options.numResults || 10, 20);

    try {
      const queryParams: Record<string, string | number | boolean> = {
        q: query,
        count: numResults,
        ...(options.country && { country: options.country }),
        ...(options.language && { search_lang: options.language }),
        ...options.vendorOptions,
      };

      const queryString = buildQueryString(queryParams);
      const response = await this.connector.fetchJSON<any>(`/web/search?${queryString}`, {
        method: 'GET',
      });

      if (!response.web?.results || !Array.isArray(response.web.results)) {
        throw new Error('Invalid response from Brave API');
      }

      const results: SearchResult[] = response.web.results
        .slice(0, numResults)
        .map((result: any, index: number) => ({
          title: result.title || 'Untitled',
          url: result.url || '',
          snippet: result.description || '',
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
