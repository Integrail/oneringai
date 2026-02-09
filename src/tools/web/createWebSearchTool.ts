/**
 * Web Search Tool Factory
 *
 * Creates a web_search tool bound to a specific Connector.
 * Follows the ConnectorTools pattern (like GitHub tools).
 *
 * Usage:
 *   ConnectorTools.registerService('serper', (connector) => [createWebSearchTool(connector)]);
 *   // or directly:
 *   const tool = createWebSearchTool(myConnector);
 */

import type { Connector } from '../../core/Connector.js';
import type { ToolFunction } from '../../domain/entities/Tool.js';
import { SearchProvider } from '../../capabilities/search/index.js';
import type { SearchResult, SearchResponse } from '../../capabilities/search/index.js';
import { logger } from '../../infrastructure/observability/Logger.js';

const searchLogger = logger.child({ component: 'webSearch' });

/**
 * Arguments for web_search tool
 */
interface WebSearchArgs {
  /** Search query string */
  query: string;
  /** Number of results to return (default: 10) */
  numResults?: number;
  /** Country/region code (e.g., 'us', 'gb') */
  country?: string;
  /** Language code (e.g., 'en', 'fr') */
  language?: string;
}

interface WebSearchResult {
  success: boolean;
  query: string;
  provider: string;
  results: SearchResult[];
  count: number;
  error?: string;
}

/**
 * Create a web_search tool bound to a specific connector.
 *
 * @param connector - Connector instance providing auth for the search API
 * @param userId - Optional user ID for multi-user OAuth
 */
export function createWebSearchTool(
  connector: Connector,
  _userId?: string
): ToolFunction<WebSearchArgs, WebSearchResult> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'web_search',
        description: `Search the web and get relevant results with snippets.

RETURNS:
An array of search results, each containing:
- title: Page title
- url: Direct URL to the page
- snippet: Short description/excerpt from the page
- position: Search ranking position (1, 2, 3...)

USE CASES:
- Find current information on any topic
- Research multiple sources
- Discover relevant websites
- Find URLs to fetch with web_fetch tool

WORKFLOW PATTERN:
1. Use web_search to find relevant URLs
2. Use web_fetch to get full content from top results
3. Process and summarize the information

EXAMPLE:
{
  "query": "latest AI developments 2026",
  "numResults": 5
}`,

        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query string. Be specific for better results.',
            },
            numResults: {
              type: 'number',
              description: 'Number of results to return (default: 10, max: 100).',
            },
            country: {
              type: 'string',
              description: 'Country/region code for localized results (e.g., "us", "gb", "de")',
            },
            language: {
              type: 'string',
              description: 'Language code for results (e.g., "en", "fr", "de")',
            },
          },
          required: ['query'],
        },
      },
      blocking: true,
      timeout: 15000,
    },

    execute: async (args: WebSearchArgs): Promise<WebSearchResult> => {
      const numResults = args.numResults || 10;

      searchLogger.debug({ connectorName: connector.name }, 'Executing search with connector');

      try {
        const searchProvider = SearchProvider.create({ connector: connector.name });

        const response: SearchResponse = await searchProvider.search(args.query, {
          numResults,
          country: args.country,
          language: args.language,
        });

        if (response.success) {
          searchLogger.debug({
            provider: response.provider,
            count: response.count,
          }, 'Search completed successfully');
        } else {
          searchLogger.warn({
            provider: response.provider,
            error: response.error,
          }, 'Search failed');
        }

        return {
          success: response.success,
          query: response.query,
          provider: response.provider,
          results: response.results,
          count: response.count,
          error: response.error,
        };
      } catch (error: any) {
        searchLogger.error({ error: error.message, connectorName: connector.name }, 'Search threw exception');
        return {
          success: false,
          query: args.query,
          provider: connector.name,
          results: [],
          count: 0,
          error: error.message || 'Unknown error',
        };
      }
    },

    describeCall: (args: WebSearchArgs) => `"${args.query}"${args.numResults ? ` (${args.numResults} results)` : ''}`,
  };
}
