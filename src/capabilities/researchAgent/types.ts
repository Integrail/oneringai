/**
 * ResearchAgent Types
 *
 * Generic interfaces for research sources that work with any data provider:
 * - Web search (Serper, Brave, Tavily)
 * - Vector databases (Pinecone, Weaviate, Qdrant)
 * - File systems (local, S3, GCS)
 * - APIs (REST, GraphQL)
 * - Databases (SQL, MongoDB)
 */

/**
 * A single search result from any source
 */
export interface SourceResult {
  /** Unique identifier for this result */
  id: string;
  /** Human-readable title */
  title: string;
  /** Brief description or snippet */
  snippet: string;
  /** Reference for fetching full content (URL, path, ID, etc.) */
  reference: string;
  /** Relevance score (0-1, higher is better) */
  relevance?: number;
  /** Source-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Response from a search operation
 */
export interface SearchResponse {
  /** Whether the search succeeded */
  success: boolean;
  /** Original query */
  query: string;
  /** Results found */
  results: SourceResult[];
  /** Total results available (may be more than returned) */
  totalResults?: number;
  /** Error message if failed */
  error?: string;
  /** Source-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Fetched content from a source
 */
export interface FetchedContent {
  /** Whether fetch succeeded */
  success: boolean;
  /** Reference that was fetched */
  reference: string;
  /** The actual content */
  content: unknown;
  /** Content type hint (text, html, json, binary, etc.) */
  contentType?: string;
  /** Size in bytes */
  sizeBytes?: number;
  /** Error message if failed */
  error?: string;
  /** Source-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for search operations
 */
export interface SearchOptions {
  /** Maximum results to return */
  maxResults?: number;
  /** Minimum relevance score (0-1) */
  minRelevance?: number;
  /** Source-specific options */
  sourceOptions?: Record<string, unknown>;
}

/**
 * Options for fetch operations
 */
export interface FetchOptions {
  /** Maximum content size to fetch (bytes) */
  maxSize?: number;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Source-specific options */
  sourceOptions?: Record<string, unknown>;
}

/**
 * Generic research source interface
 *
 * Implement this interface to add any data source to ResearchAgent:
 * - Web: search queries, fetch URLs
 * - Vector DB: similarity search, fetch documents
 * - File system: glob patterns, read files
 * - API: query endpoints, fetch resources
 */
export interface IResearchSource {
  /** Unique name for this source */
  readonly name: string;

  /** Human-readable description */
  readonly description: string;

  /** Type of source (for categorization) */
  readonly type: 'web' | 'vector' | 'file' | 'api' | 'database' | 'custom';

  /**
   * Search this source for relevant results
   *
   * @param query - Search query (interpreted by source)
   * @param options - Search options
   * @returns Search response with results
   */
  search(query: string, options?: SearchOptions): Promise<SearchResponse>;

  /**
   * Fetch full content for a result
   *
   * @param reference - Reference from SourceResult
   * @param options - Fetch options
   * @returns Fetched content
   */
  fetch(reference: string, options?: FetchOptions): Promise<FetchedContent>;

  /**
   * Optional: Check if source is available/configured
   */
  isAvailable?(): Promise<boolean>;

  /**
   * Optional: Get source capabilities
   */
  getCapabilities?(): SourceCapabilities;
}

/**
 * Source capabilities for discovery
 */
export interface SourceCapabilities {
  /** Whether source supports search */
  canSearch: boolean;
  /** Whether source supports fetch */
  canFetch: boolean;
  /** Whether results include relevance scores */
  hasRelevanceScores: boolean;
  /** Maximum results per search */
  maxResultsPerSearch?: number;
  /** Supported content types */
  contentTypes?: string[];
}

/**
 * Research finding stored in memory
 */
export interface ResearchFinding {
  /** Source that provided this finding */
  source: string;
  /** Original query that found this */
  query: string;
  /** Key insight or summary */
  summary: string;
  /** Supporting details */
  details?: string;
  /** References used */
  references: string[];
  /** Confidence level (0-1) */
  confidence?: number;
  /** When this was found */
  timestamp: number;
}

/**
 * Research plan for systematic research
 */
export interface ResearchPlan {
  /** Research goal/question */
  goal: string;
  /** Queries to execute */
  queries: ResearchQuery[];
  /** Sources to use (empty = all available) */
  sources?: string[];
  /** Maximum results per query */
  maxResultsPerQuery?: number;
  /** Maximum total findings */
  maxTotalFindings?: number;
}

/**
 * A query in the research plan
 */
export interface ResearchQuery {
  /** Query string */
  query: string;
  /** Specific sources for this query (empty = all) */
  sources?: string[];
  /** Priority (higher = more important) */
  priority?: number;
}

/**
 * Research execution result
 */
export interface ResearchResult {
  /** Whether research completed successfully */
  success: boolean;
  /** Original goal */
  goal: string;
  /** Queries executed */
  queriesExecuted: number;
  /** Results found */
  resultsFound: number;
  /** Results processed */
  resultsProcessed: number;
  /** Findings generated */
  findingsCount: number;
  /** Final synthesis (if generated) */
  synthesis?: string;
  /** Error if failed */
  error?: string;
  /** Execution metrics */
  metrics?: {
    totalDurationMs: number;
    searchDurationMs: number;
    processDurationMs: number;
    synthesizeDurationMs: number;
  };
}

/**
 * Research progress event
 */
export interface ResearchProgress {
  phase: 'searching' | 'processing' | 'synthesizing' | 'complete';
  currentQuery?: string;
  currentSource?: string;
  queriesCompleted: number;
  totalQueries: number;
  resultsProcessed: number;
  totalResults: number;
  findingsGenerated: number;
}
