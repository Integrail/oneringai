/**
 * WebSearchSource - Web search research source using SearchProvider
 *
 * Bridges the existing SearchProvider/webFetch infrastructure to IResearchSource.
 */

import { Connector } from '../../../core/Connector.js';
import { SearchProvider, ISearchProvider } from '../../search/SearchProvider.js';
import type {
  IResearchSource,
  SearchResponse,
  FetchedContent,
  SearchOptions,
  FetchOptions,
  SourceCapabilities,
} from '../types.js';

/**
 * Web search source configuration
 */
export interface WebSearchSourceConfig {
  /** Source name (e.g., 'web-serper', 'web-brave') */
  name: string;
  /** Description */
  description?: string;
  /** Connector name or instance for search */
  searchConnector: string | Connector;
  /** Optional: Connector for fetching (if different from search) */
  fetchConnector?: string | Connector;
  /** Default country code */
  defaultCountry?: string;
  /** Default language */
  defaultLanguage?: string;
}

/**
 * WebSearchSource - Uses SearchProvider for web search
 */
export class WebSearchSource implements IResearchSource {
  readonly name: string;
  readonly description: string;
  readonly type = 'web' as const;

  private searchProvider: ISearchProvider;
  private defaultCountry?: string;
  private defaultLanguage?: string;

  constructor(config: WebSearchSourceConfig) {
    this.name = config.name;
    this.description = config.description ?? `Web search via ${config.name}`;
    this.defaultCountry = config.defaultCountry;
    this.defaultLanguage = config.defaultLanguage;

    // Create search provider
    this.searchProvider = SearchProvider.create({
      connector: config.searchConnector,
    });

    // Note: fetchConnector is reserved for future authenticated fetch support
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResponse> {
    try {
      const response = await this.searchProvider.search(query, {
        numResults: options?.maxResults ?? 10,
        language: this.defaultLanguage,
        country: this.defaultCountry,
        ...options?.sourceOptions,
      });

      return {
        success: response.success,
        query: response.query,
        results: response.results.map((r, index) => ({
          id: `${this.name}_${index}_${Date.now()}`,
          title: r.title,
          snippet: r.snippet,
          reference: r.url,
          relevance: 1 - (r.position / (response.results.length + 1)), // Convert position to relevance
          metadata: { position: r.position },
        })),
        totalResults: response.count,
        error: response.error,
      };
    } catch (error) {
      return {
        success: false,
        query,
        results: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async fetch(reference: string, options?: FetchOptions): Promise<FetchedContent> {
    try {
      // Use built-in fetch with optional connector
      const controller = new AbortController();
      const timeout = options?.timeoutMs ?? 30000;

      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (compatible; ResearchAgent/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      };

      // Note: For authenticated fetch, configure a fetch connector with appropriate headers
      // The connector auth is handled at request time by the connector's request method

      const response = await fetch(reference, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          reference,
          content: null,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const contentType = response.headers.get('content-type') ?? 'text/html';
      const buffer = await response.arrayBuffer();
      const sizeBytes = buffer.byteLength;

      // Check size limit
      if (options?.maxSize && sizeBytes > options.maxSize) {
        return {
          success: false,
          reference,
          content: null,
          error: `Content too large: ${sizeBytes} bytes (max: ${options.maxSize})`,
          sizeBytes,
        };
      }

      // Decode content
      const decoder = new TextDecoder();
      const content = decoder.decode(buffer);

      return {
        success: true,
        reference,
        content,
        contentType,
        sizeBytes,
        metadata: {
          statusCode: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        },
      };
    } catch (error) {
      return {
        success: false,
        reference,
        content: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Try a simple search to check availability
      const response = await this.search('test', { maxResults: 1 });
      return response.success;
    } catch {
      return false;
    }
  }

  getCapabilities(): SourceCapabilities {
    return {
      canSearch: true,
      canFetch: true,
      hasRelevanceScores: true,
      maxResultsPerSearch: 100,
      contentTypes: ['text/html', 'text/plain', 'application/json'],
    };
  }
}

/**
 * Create a web search source from a connector name
 */
export function createWebSearchSource(
  connectorName: string,
  options?: Partial<WebSearchSourceConfig>
): WebSearchSource {
  return new WebSearchSource({
    name: options?.name ?? `web-${connectorName}`,
    description: options?.description ?? `Web search via ${connectorName}`,
    searchConnector: connectorName,
    ...options,
  });
}
