/**
 * SearchProvider - Unified search interface with connector support
 *
 * Provides a consistent API for web search across multiple vendors.
 * Uses Connector-First architecture for authentication.
 */

import { Connector } from '../../core/Connector.js';
import { SerperProvider } from './providers/SerperProvider.js';
import { BraveProvider } from './providers/BraveProvider.js';
import { TavilyProvider } from './providers/TavilyProvider.js';
import { RapidAPIProvider } from './providers/RapidAPIProvider.js';

/**
 * Search result interface
 */
export interface SearchResult {
  /** Page title */
  title: string;
  /** Direct URL to the page */
  url: string;
  /** Short description/excerpt */
  snippet: string;
  /** Search ranking position */
  position: number;
}

/**
 * Search options
 */
export interface SearchOptions {
  /** Number of results to return (default: 10, max provider-specific) */
  numResults?: number;
  /** Language code (e.g., 'en', 'fr') */
  language?: string;
  /** Country/region code (e.g., 'us', 'gb') */
  country?: string;
  /** Time range filter (e.g., 'day', 'week', 'month', 'year') */
  timeRange?: string;
  /** Vendor-specific options */
  vendorOptions?: Record<string, any>;
}

/**
 * Search response
 */
export interface SearchResponse {
  /** Whether the search succeeded */
  success: boolean;
  /** Search query */
  query: string;
  /** Provider name */
  provider: string;
  /** Search results */
  results: SearchResult[];
  /** Number of results */
  count: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Base SearchProvider interface
 */
export interface ISearchProvider {
  /** Provider name */
  readonly name: string;

  /** Connector used for authentication */
  readonly connector: Connector;

  /**
   * Search the web
   * @param query - Search query string
   * @param options - Search options
   */
  search(query: string, options?: SearchOptions): Promise<SearchResponse>;
}

/**
 * SearchProvider factory configuration
 */
export interface SearchProviderConfig {
  /** Connector name or instance */
  connector: string | Connector;
}

/**
 * SearchProvider factory
 */
export class SearchProvider {
  /**
   * Create a search provider from a connector
   * @param config - Provider configuration
   * @returns Search provider instance
   */
  static create(config: SearchProviderConfig): ISearchProvider {
    // Get connector
    const connector =
      typeof config.connector === 'string'
        ? Connector.get(config.connector)
        : config.connector;

    if (!connector) {
      throw new Error(
        `Connector not found: ${typeof config.connector === 'string' ? config.connector : 'unknown'}`
      );
    }

    // Detect provider from serviceType or baseURL
    const serviceType = connector.serviceType;

    // Map service type to provider
    switch (serviceType) {
      case 'serper':
        return new SerperProvider(connector);

      case 'brave-search':
        return new BraveProvider(connector);

      case 'tavily':
        return new TavilyProvider(connector);

      case 'rapidapi-search':
        return new RapidAPIProvider(connector);

      default:
        throw new Error(
          `Unknown search service type: ${serviceType}. Supported: serper, brave-search, tavily, rapidapi-search`
        );
    }
  }
}
