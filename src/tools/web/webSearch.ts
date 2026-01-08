/**
 * Web Search Tool - Multi-provider web search
 * Supports Serper.dev (default), Brave, and Tavily
 */

import { ToolFunction } from '../../domain/entities/Tool.js';
import { searchWithSerper, type SearchResult } from './searchProviders/serper.js';
import { searchWithBrave } from './searchProviders/brave.js';
import { searchWithTavily } from './searchProviders/tavily.js';

interface WebSearchArgs {
  query: string;
  numResults?: number;
  provider?: 'serper' | 'brave' | 'tavily';
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

This tool searches the web using a configured search provider.

SEARCH PROVIDERS:
- serper (default): Google search results via Serper.dev API. Fast (1-2s), 2,500 free queries.
- brave: Brave's independent search index. Privacy-focused, no Google.
- tavily: AI-optimized search with summaries tailored for LLMs.

RETURNS:
An array of up to 10-20 search results, each containing:
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
Basic search:
{
  query: "latest AI developments 2026",
  numResults: 5
}

With specific provider:
{
  query: "quantum computing news",
  numResults: 10,
  provider: "brave"
}

IMPORTANT:
- Requires API key to be set in environment variables
- Default provider is "serper" (requires SERPER_API_KEY)
- Returns empty results if API key not found`,

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
              'Number of results to return (default: 10, max: 20). More results = more API cost.',
          },
          provider: {
            type: 'string',
            enum: ['serper', 'brave', 'tavily'],
            description:
              'Which search provider to use. Default is "serper". Each provider requires its own API key.',
          },
        },
        required: ['query'],
      },
    },
    blocking: true,
    timeout: 10000,
  },

  execute: async (args: WebSearchArgs): Promise<WebSearchResult> => {
    const provider = args.provider || 'serper';
    const numResults = Math.min(args.numResults || 10, 20);

    // Get API key from environment
    const apiKey = getSearchAPIKey(provider);

    if (!apiKey) {
      return {
        success: false,
        query: args.query,
        provider,
        results: [],
        count: 0,
        error: `No API key found for ${provider}. Set ${getEnvVarName(provider)} in your .env file. See .env.example for details.`,
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
  },
};

/**
 * Get search API key from environment
 */
function getSearchAPIKey(provider: string): string | undefined {
  switch (provider) {
    case 'serper':
      return process.env.SERPER_API_KEY;
    case 'brave':
      return process.env.BRAVE_API_KEY;
    case 'tavily':
      return process.env.TAVILY_API_KEY;
    default:
      return undefined;
  }
}

/**
 * Get environment variable name for provider
 */
function getEnvVarName(provider: string): string {
  switch (provider) {
    case 'serper':
      return 'SERPER_API_KEY';
    case 'brave':
      return 'BRAVE_API_KEY';
    case 'tavily':
      return 'TAVILY_API_KEY';
    default:
      return 'UNKNOWN_API_KEY';
  }
}
