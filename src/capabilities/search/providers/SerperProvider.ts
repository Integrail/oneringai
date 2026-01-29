/**
 * Serper.dev Search Provider
 * Google search results via Serper.dev API
 */

import type { Connector } from '../../../core/Connector.js';
import type {
  ISearchProvider,
  SearchResult,
  SearchOptions,
  SearchResponse,
} from '../SearchProvider.js';
import { toConnectorOptions } from '../types.js';

export class SerperProvider implements ISearchProvider {
  readonly name = 'serper';

  constructor(readonly connector: Connector) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const numResults = Math.min(options.numResults || 10, 100);

    try {
      const fetchOptions = toConnectorOptions({
        method: 'POST',
        body: {
          q: query,
          num: numResults,
          ...(options.country && { gl: options.country }),
          ...(options.language && { hl: options.language }),
          ...options.vendorOptions,
        },
      });

      const response = await this.connector.fetchJSON<any>('/search', fetchOptions);

      if (!response.organic || !Array.isArray(response.organic)) {
        throw new Error('Invalid response from Serper API');
      }

      const results: SearchResult[] = response.organic
        .slice(0, numResults)
        .map((result: any, index: number) => ({
          title: result.title || 'Untitled',
          url: result.link || '',
          snippet: result.snippet || '',
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
