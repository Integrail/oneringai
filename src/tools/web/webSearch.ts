/**
 * Web Search Tool - Clean interface for LLM
 *
 * ARCHITECTURE:
 * - LLM sees simple interface: { query, numResults, country, language }
 * - Connector configuration is INTERNAL (auto-detected by serviceType)
 * - Uses shared findConnectorByServiceTypes() utility
 * - Fallback to environment variables if no connector configured
 *
 * Supports: Serper.dev, Brave, Tavily, RapidAPI
 */

import { ToolFunction } from '../../domain/entities/Tool.js';
import { SearchProvider } from '../../capabilities/search/index.js';
import { findConnectorByServiceTypes } from '../../capabilities/shared/index.js';
import type { SearchResult, SearchResponse } from '../../capabilities/search/index.js';
import { logger } from '../../infrastructure/observability/Logger.js';

// Backward compatibility - import old providers for env var fallback
import { searchWithSerper } from './searchProviders/serper.js';
import { searchWithBrave } from './searchProviders/brave.js';
import { searchWithTavily } from './searchProviders/tavily.js';

const searchLogger = logger.child({ component: 'webSearch' });

// ============ Internal Configuration (NOT exposed to LLM) ============

/**
 * Service types this tool supports, in order of preference
 * Used for auto-detecting available connectors
 */
const SEARCH_SERVICE_TYPES = ['serper', 'brave-search', 'tavily', 'rapidapi-search'];

// ============ Tool Interface (what LLM sees) ============

/**
 * Arguments for web_search tool
 * CLEAN and SIMPLE - no connector details exposed
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

// ============ Tool Definition ============

export const webSearch: ToolFunction<WebSearchArgs, WebSearchResult> = {
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

    // 1. Try to find a configured search connector (auto-detect by serviceType)
    const connector = findConnectorByServiceTypes(SEARCH_SERVICE_TYPES);

    if (connector) {
      return await executeWithConnector(connector.name, args, numResults);
    }

    // 2. Fallback to environment variables
    return await executeWithEnvVar(args, numResults);
  },

  describeCall: (args: WebSearchArgs) => `"${args.query}"${args.numResults ? ` (${args.numResults} results)` : ''}`,
};

// ============ Internal Execution Functions ============

/**
 * Execute search using a configured Connector
 */
async function executeWithConnector(
  connectorName: string,
  args: WebSearchArgs,
  numResults: number
): Promise<WebSearchResult> {
  searchLogger.debug({ connectorName }, 'Executing search with connector');

  try {
    const searchProvider = SearchProvider.create({ connector: connectorName });

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
    searchLogger.error({ error: error.message, connectorName }, 'Search threw exception');
    return {
      success: false,
      query: args.query,
      provider: connectorName,
      results: [],
      count: 0,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Execute search using environment variables (backward compatibility)
 * Tries providers in order: Serper -> Brave -> Tavily
 */
async function executeWithEnvVar(
  args: WebSearchArgs,
  numResults: number
): Promise<WebSearchResult> {
  // Try each provider in order based on available API keys
  const providers = [
    { name: 'serper', key: process.env.SERPER_API_KEY, fn: searchWithSerper },
    { name: 'brave', key: process.env.BRAVE_API_KEY, fn: searchWithBrave },
    { name: 'tavily', key: process.env.TAVILY_API_KEY, fn: searchWithTavily },
  ];

  for (const provider of providers) {
    if (provider.key) {
      searchLogger.debug({ provider: provider.name }, 'Using environment variable fallback');

      try {
        const results = await provider.fn(args.query, numResults, provider.key);
        return {
          success: true,
          query: args.query,
          provider: provider.name,
          results,
          count: results.length,
        };
      } catch (error: any) {
        searchLogger.warn({ provider: provider.name, error: error.message }, 'Provider failed, trying next');
        // Continue to next provider
      }
    }
  }

  // No provider available
  return {
    success: false,
    query: args.query,
    provider: 'none',
    results: [],
    count: 0,
    error: 'No search provider configured. Set up a search connector (serper, brave-search, tavily) or set SERPER_API_KEY, BRAVE_API_KEY, or TAVILY_API_KEY environment variable.',
  };
}
