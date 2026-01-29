/**
 * RapidAPI Real-Time Web Search Provider
 * Real-time web search via RapidAPI
 */

import type { Connector } from '../../../core/Connector.js';
import type {
  ISearchProvider,
  SearchResult,
  SearchOptions,
  SearchResponse,
} from '../SearchProvider.js';
import { buildQueryString } from '../types.js';

export class RapidAPIProvider implements ISearchProvider {
  readonly name = 'rapidapi';

  constructor(readonly connector: Connector) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const numResults = Math.min(options.numResults || 10, 100);

    try {
      // Build query params
      const queryParams: Record<string, string | number | boolean> = {
        q: query,
        num: numResults,
        start: 0,
        fetch_ai_overviews: false,
        deduplicate: false,
        return_organic_result_video_thumbnail: false,
        nfpr: 0,
        ...(options.country && { gl: options.country }),
        ...(options.language && { hl: options.language }),
        ...options.vendorOptions,
      };

      const queryString = buildQueryString(queryParams);
      const response = await this.connector.fetchJSON<any>(`/search?${queryString}`, {
        method: 'GET',
      });

      // RapidAPI returns data in different formats, handle both
      const organicResults = response.data?.organic || response.organic || [];

      if (!Array.isArray(organicResults)) {
        throw new Error('Invalid response from RapidAPI Search');
      }

      const results: SearchResult[] = organicResults
        .slice(0, numResults)
        .map((result: any, index: number) => ({
          title: result.title || 'Untitled',
          url: result.link || result.url || '',
          snippet: result.snippet || result.description || '',
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
