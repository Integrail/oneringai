/**
 * Web Search Tool - Multi-provider web search with Connector support
 * Supports Serper.dev, Brave, Tavily, and RapidAPI
 *
 * NEW: Uses Connector-First architecture for authentication
 * Backward compatible with environment variable approach
 */

import { ToolFunction } from '../../domain/entities/Tool.js';
import { Connector } from '../../core/Connector.js';
import { SearchProvider } from '../../capabilities/search/index.js';
import type { SearchResult, SearchResponse } from '../../capabilities/search/index.js';

// Backward compatibility - import old providers
import { searchWithSerper } from './searchProviders/serper.js';
import { searchWithBrave } from './searchProviders/brave.js';
import { searchWithTavily } from './searchProviders/tavily.js';

interface WebSearchArgs {
  query: string;
  numResults?: number;
  /**
   * @deprecated Use connectorName instead
   * Provider name for backward compatibility (uses environment variables)
   */
  provider?: 'serper' | 'brave' | 'tavily' | 'rapidapi';
  /**
   * Connector name to use for search
   * Example: 'serper-main', 'brave-backup', 'rapidapi-search'
   */
  connectorName?: string;
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

export const webSearch: ToolFunction<WebSearchArgs, WebSearchResult> = {
  definition: {
    type: 'function',
    function: {
      name: 'web_search',
      description: `Search the web and get relevant results with snippets.

This tool searches the web using a configured search provider via Connector.

CONNECTOR SETUP (Recommended):
Create a connector for your search provider:

// Serper (Google search)
Connector.create({
  name: 'serper-main',
  serviceType: 'serper',
  auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY! },
  baseURL: 'https://google.serper.dev',
});

// Brave (Independent index)
Connector.create({
  name: 'brave-main',
  serviceType: 'brave-search',
  auth: { type: 'api_key', apiKey: process.env.BRAVE_API_KEY! },
  baseURL: 'https://api.search.brave.com/res/v1',
});

// Tavily (AI-optimized)
Connector.create({
  name: 'tavily-main',
  serviceType: 'tavily',
  auth: { type: 'api_key', apiKey: process.env.TAVILY_API_KEY! },
  baseURL: 'https://api.tavily.com',
});

// RapidAPI (Real-time web search)
Connector.create({
  name: 'rapidapi-search',
  serviceType: 'rapidapi-search',
  auth: { type: 'api_key', apiKey: process.env.RAPIDAPI_KEY! },
  baseURL: 'https://real-time-web-search.p.rapidapi.com',
});

SEARCH PROVIDERS:
- serper: Google search results via Serper.dev. Fast (1-2s), 2,500 free queries.
- brave-search: Brave's independent search index. Privacy-focused, no Google.
- tavily: AI-optimized search with summaries tailored for LLMs.
- rapidapi-search: Real-time web search via RapidAPI. Wide coverage.

RETURNS:
An array of up to 10-100 search results (provider-specific), each containing:
- title: Page title
- url: Direct URL to the page
- snippet: Short description/excerpt from the page
- position: Search ranking position (1, 2, 3...)

USE CASES:
- Find current information on any topic
- Research multiple sources
- Discover relevant websites
- Get different perspectives on a topic
- Find URLs to fetch with web_fetch tool

WORKFLOW PATTERN:
1. Use web_search to find relevant URLs
2. Use web_fetch to get full content from top results
3. Process and summarize the information

EXAMPLE:
Using connector (recommended):
{
  query: "latest AI developments 2026",
  connectorName: "serper-main",
  numResults: 5,
  country: "us",
  language: "en"
}

Backward compatible (uses environment variables):
{
  query: "quantum computing news",
  provider: "brave",
  numResults: 10
}

IMPORTANT:
- Connector approach provides retry, circuit breaker, and timeout features
- Supports multiple keys per vendor (e.g., 'serper-main', 'serper-backup')
- Backward compatible with environment variable approach`,

      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query string. Be specific for better results.',
          },
          numResults: {
            type: 'number',
            description:
              'Number of results to return (default: 10, max: provider-specific). More results = more API cost.',
          },
          connectorName: {
            type: 'string',
            description:
              'Connector name to use for search (e.g., "serper-main", "brave-backup"). Recommended approach.',
          },
          provider: {
            type: 'string',
            enum: ['serper', 'brave', 'tavily', 'rapidapi'],
            description:
              'DEPRECATED: Use connectorName instead. Provider for backward compatibility with environment variables.',
          },
          country: {
            type: 'string',
            description: 'Country/region code (e.g., "us", "gb")',
          },
          language: {
            type: 'string',
            description: 'Language code (e.g., "en", "fr")',
          },
        },
        required: ['query'],
      },
    },
    blocking: true,
    timeout: 10000,
  },

  execute: async (args: WebSearchArgs): Promise<WebSearchResult> => {
    const numResults = args.numResults || 10;

    // NEW: Connector-based approach (preferred)
    if (args.connectorName) {
      return await executeWithConnector(args, numResults);
    }

    // OLD: Backward compatibility with environment variables
    if (args.provider) {
      return await executeWithProvider(args, numResults);
    }

    // Auto-detect: Try to find any search connector
    const availableConnector = findAvailableSearchConnector();
    if (availableConnector) {
      return await executeWithConnector(
        { ...args, connectorName: availableConnector },
        numResults
      );
    }

    // Fallback to environment variable approach
    return await executeWithProvider({ ...args, provider: 'serper' }, numResults);
  },
};

/**
 * Execute search using Connector (new approach)
 */
async function executeWithConnector(
  args: WebSearchArgs,
  numResults: number
): Promise<WebSearchResult> {
  try {
    const searchProvider = SearchProvider.create({ connector: args.connectorName! });

    const response: SearchResponse = await searchProvider.search(args.query, {
      numResults,
      country: args.country,
      language: args.language,
    });

    return {
      success: response.success,
      query: response.query,
      provider: response.provider,
      results: response.results,
      count: response.count,
      error: response.error,
    };
  } catch (error: any) {
    return {
      success: false,
      query: args.query,
      provider: args.connectorName || 'unknown',
      results: [],
      count: 0,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Execute search using provider + environment variables (backward compatibility)
 */
async function executeWithProvider(
  args: WebSearchArgs,
  numResults: number
): Promise<WebSearchResult> {
  const provider = args.provider || 'serper';

  // Get API key from environment
  const apiKey = getSearchAPIKey(provider);

  if (!apiKey) {
    return {
      success: false,
      query: args.query,
      provider,
      results: [],
      count: 0,
      error: `No API key found for ${provider}. Set ${getEnvVarName(provider)} in your .env file, or use connectorName with a Connector. See .env.example for details.`,
    };
  }

  try {
    let results: SearchResult[];

    switch (provider) {
      case 'serper':
        results = await searchWithSerper(args.query, numResults, apiKey);
        break;

      case 'brave':
        results = await searchWithBrave(args.query, numResults, apiKey);
        break;

      case 'tavily':
        results = await searchWithTavily(args.query, numResults, apiKey);
        break;

      case 'rapidapi':
        throw new Error(
          'RapidAPI provider requires Connector. Use connectorName with a rapidapi-search connector.'
        );

      default:
        throw new Error(`Unknown search provider: ${provider}`);
    }

    return {
      success: true,
      query: args.query,
      provider,
      results,
      count: results.length,
    };
  } catch (error: any) {
    return {
      success: false,
      query: args.query,
      provider,
      results: [],
      count: 0,
      error: (error as Error).message,
    };
  }
}

/**
 * Find any available search connector
 */
function findAvailableSearchConnector(): string | undefined {
  const allConnectors = Connector.list();

  // Search for connectors with search service types
  for (const connectorName of allConnectors) {
    const connector = Connector.get(connectorName);
    if (
      connector?.serviceType &&
      ['serper', 'brave-search', 'tavily', 'rapidapi-search'].includes(connector.serviceType)
    ) {
      return connectorName;
    }
  }

  return undefined;
}

/**
 * Get search API key from environment (backward compatibility)
 */
function getSearchAPIKey(provider: string): string | undefined {
  switch (provider) {
    case 'serper':
      return process.env.SERPER_API_KEY;
    case 'brave':
      return process.env.BRAVE_API_KEY;
    case 'tavily':
      return process.env.TAVILY_API_KEY;
    case 'rapidapi':
      return process.env.RAPIDAPI_KEY;
    default:
      return undefined;
  }
}

/**
 * Get environment variable name for provider (backward compatibility)
 */
function getEnvVarName(provider: string): string {
  switch (provider) {
    case 'serper':
      return 'SERPER_API_KEY';
    case 'brave':
      return 'BRAVE_API_KEY';
    case 'tavily':
      return 'TAVILY_API_KEY';
    case 'rapidapi':
      return 'RAPIDAPI_KEY';
    default:
      return 'UNKNOWN_API_KEY';
  }
}
