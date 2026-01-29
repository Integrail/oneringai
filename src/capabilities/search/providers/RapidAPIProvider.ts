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
import { logger } from '../../../infrastructure/observability/Logger.js';

const rapidapiLogger = logger.child({ component: 'RapidAPIProvider' });

export class RapidAPIProvider implements ISearchProvider {
  readonly name = 'rapidapi';

  constructor(readonly connector: Connector) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const numResults = Math.min(options.numResults || 10, 100);
    rapidapiLogger.debug({ query, numResults, options }, 'RapidAPI search started');

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

      // Extract host from connector's baseURL for X-RapidAPI-Host header
      const baseURL = this.connector.baseURL;
      const host = baseURL ? new URL(baseURL).host : 'real-time-web-search.p.rapidapi.com';
      rapidapiLogger.debug({ baseURL, host }, 'Using RapidAPI host');

      // Get API key from connector's auth config
      let apiKey = '';
      try {
        apiKey = this.connector.getApiKey();
        rapidapiLogger.debug({ hasApiKey: !!apiKey, keyLength: apiKey?.length }, 'Got API key');
      } catch (e: any) {
        rapidapiLogger.error({ error: e.message }, 'Failed to get API key');
        throw new Error('RapidAPI provider requires API key authentication');
      }

      const queryString = buildQueryString(queryParams);
      const requestUrl = `/search?${queryString}`;
      rapidapiLogger.debug({ requestUrl, method: 'GET' }, 'Making RapidAPI request');

      const response = await this.connector.fetchJSON<any>(requestUrl, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': host,
        },
      });

      rapidapiLogger.debug({
        hasResponse: !!response,
        hasData: !!response?.data,
        dataKeys: response?.data ? Object.keys(response.data) : [],
        hasOrganicResults: !!(response?.data?.organic_results || response?.data?.organic),
        organicResultsCount: (response?.data?.organic_results || response?.data?.organic || []).length,
      }, 'RapidAPI response received');

      // RapidAPI returns data in different formats, handle all variations
      const organicResults =
        response.data?.organic_results ||
        response.data?.organic ||
        response.organic_results ||
        response.organic ||
        [];

      if (!Array.isArray(organicResults)) {
        rapidapiLogger.error({
          responseType: typeof organicResults,
          response: JSON.stringify(response).slice(0, 500),
        }, 'Invalid response format - organic is not an array');
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

      rapidapiLogger.debug({
        success: true,
        resultCount: results.length,
        firstTitle: results[0]?.title,
      }, 'RapidAPI search completed successfully');

      return {
        success: true,
        query,
        provider: this.name,
        results,
        count: results.length,
      };
    } catch (error: any) {
      rapidapiLogger.error({
        error: error.message,
        stack: error.stack,
      }, 'RapidAPI search failed');
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
