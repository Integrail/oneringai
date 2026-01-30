/**
 * ResearchAgent - Generic research agent supporting any data sources
 *
 * Extends TaskAgent with research-specific capabilities:
 * - Multiple configurable sources (web, vector, file, API, etc.)
 * - Automatic memory management (spill large outputs, cleanup raw data)
 * - Research-specific tools for source interaction
 * - Built-in research protocol with search → process → synthesize phases
 *
 * Design principles:
 * - DRY: Reuses TaskAgent, AgentContext, WorkingMemory
 * - Generic: Works with any IResearchSource implementation
 * - LLM-driven: Agent decides how to use sources, not hardcoded flow
 */

import { TaskAgent, TaskAgentConfig, TaskAgentHooks } from '../taskAgent/TaskAgent.js';
import { ToolFunction, FunctionToolDefinition } from '../../domain/entities/Tool.js';
import { ToolContext } from '../../domain/interfaces/IToolContext.js';
import { ToolExecutionError } from '../../domain/errors/AIErrors.js';
import { AutoSpillPlugin, AutoSpillConfig } from '../../core/context/plugins/AutoSpillPlugin.js';
import { addTierPrefix } from '../../domain/entities/Memory.js';
import type {
  IResearchSource,
  SearchOptions,
  FetchOptions,
  ResearchPlan,
  ResearchResult,
  ResearchProgress,
  ResearchFinding,
} from './types.js';

/**
 * Research-specific hooks
 */
export interface ResearchAgentHooks extends TaskAgentHooks {
  /** Called when a source search completes */
  onSearchComplete?: (source: string, query: string, resultCount: number) => Promise<void>;

  /** Called when content is fetched */
  onContentFetched?: (source: string, reference: string, sizeBytes: number) => Promise<void>;

  /** Called when a finding is stored */
  onFindingStored?: (key: string, finding: ResearchFinding) => Promise<void>;

  /** Called on research progress updates */
  onProgress?: (progress: ResearchProgress) => Promise<void>;
}

/**
 * ResearchAgent configuration
 */
export interface ResearchAgentConfig extends Omit<TaskAgentConfig, 'hooks'> {
  /** Research sources to use */
  sources: IResearchSource[];

  /** Default search options for all sources */
  defaultSearchOptions?: SearchOptions;

  /** Default fetch options for all sources */
  defaultFetchOptions?: FetchOptions;

  /** Auto-spill configuration */
  autoSpill?: AutoSpillConfig;

  /** Research-specific hooks */
  hooks?: ResearchAgentHooks;

  /** Auto-summarize fetched content above this size (bytes). Default: 20KB */
  autoSummarizeThreshold?: number;

  /** Include research-specific tools. Default: true */
  includeResearchTools?: boolean;
}

/**
 * ResearchAgent - extends TaskAgent with research capabilities
 */
export class ResearchAgent extends TaskAgent {
  private sources: Map<string, IResearchSource> = new Map();
  private autoSpillPlugin?: AutoSpillPlugin;
  private researchHooks?: ResearchAgentHooks;
  private defaultSearchOptions: SearchOptions = { maxResults: 10 };
  private defaultFetchOptions: FetchOptions = { maxSize: 1024 * 1024 };
  // Note: autoSummarizeThreshold is configured but not yet used - planned for future enhancement

  // ===== Static Factory =====

  /**
   * Create a new ResearchAgent
   */
  static override create(config: ResearchAgentConfig): ResearchAgent {
    // Create research-specific tools
    const researchTools = config.includeResearchTools !== false
      ? createResearchTools(config.sources)
      : [];

    // Merge tools
    const allTools = [...(config.tools ?? []), ...researchTools];

    // Build TaskAgent config with research task type
    const taskAgentConfig: TaskAgentConfig = {
      ...config,
      tools: allTools,
      hooks: config.hooks,
      // Force research task type for optimal context management
      context: {
        ...(config.context ?? {}),
        taskType: 'research',
      },
    };

    // Create base TaskAgent
    const baseAgent = TaskAgent.create(taskAgentConfig);

    // Upgrade to ResearchAgent
    const researchAgent = Object.setPrototypeOf(baseAgent, ResearchAgent.prototype) as ResearchAgent;

    // Initialize research-specific state
    researchAgent.initializeResearch(config);

    return researchAgent;
  }

  /**
   * Initialize research-specific components
   */
  private initializeResearch(config: ResearchAgentConfig): void {
    // Initialize instance properties (needed because Object.setPrototypeOf doesn't run field initializers)
    this.sources = new Map();
    this.defaultSearchOptions = { maxResults: 10 };
    this.defaultFetchOptions = { maxSize: 1024 * 1024 };

    // Register sources
    for (const source of config.sources) {
      this.sources.set(source.name, source);
    }

    // Store config
    this.researchHooks = config.hooks;
    this.defaultSearchOptions = config.defaultSearchOptions ?? { maxResults: 10 };
    this.defaultFetchOptions = config.defaultFetchOptions ?? { maxSize: 1024 * 1024 }; // 1MB
    // Note: autoSummarizeThreshold from config is reserved for future auto-summarization feature

    // Setup auto-spill plugin
    const autoSpillConfig: AutoSpillConfig = {
      sizeThreshold: 10 * 1024, // 10KB
      toolPatterns: [/^research_fetch/, /^web_fetch/, /^web_scrape/],
      ...config.autoSpill,
    };

    // Only set up auto-spill if memory feature is enabled
    if (this._agentContext.memory) {
      this.autoSpillPlugin = new AutoSpillPlugin(this._agentContext.memory, autoSpillConfig);
      this._agentContext.registerPlugin(this.autoSpillPlugin);
    }

    // Wire up research hooks to auto-memory management
    this.setupAutoMemoryManagement();
  }

  /**
   * Setup automatic memory management
   */
  private setupAutoMemoryManagement(): void {
    // Listen for tool executions to auto-spill large outputs
    // This is handled by the AutoSpillPlugin via afterToolExecution hook
  }

  // ===== Public API =====

  /**
   * Get all registered sources
   */
  getSources(): IResearchSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Get a specific source by name
   */
  getSource(name: string): IResearchSource | undefined {
    return this.sources.get(name);
  }

  /**
   * Add a source at runtime
   */
  addSource(source: IResearchSource): void {
    this.sources.set(source.name, source);
  }

  /**
   * Remove a source
   */
  removeSource(name: string): boolean {
    return this.sources.delete(name);
  }

  /**
   * Search across all sources (or specified sources)
   */
  async searchSources(
    query: string,
    options?: SearchOptions & { sources?: string[] }
  ): Promise<Map<string, Awaited<ReturnType<IResearchSource['search']>>>> {
    const results = new Map<string, Awaited<ReturnType<IResearchSource['search']>>>();
    const targetSources = options?.sources
      ? options.sources.map((name) => this.sources.get(name)).filter(Boolean) as IResearchSource[]
      : this.getSources();

    const searchOptions = { ...this.defaultSearchOptions, ...options };

    await Promise.all(
      targetSources.map(async (source) => {
        try {
          const response = await source.search(query, searchOptions);
          results.set(source.name, response);

          // Emit hook
          if (this.researchHooks?.onSearchComplete) {
            await this.researchHooks.onSearchComplete(source.name, query, response.results.length);
          }
        } catch (error) {
          results.set(source.name, {
            success: false,
            query,
            results: [],
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })
    );

    return results;
  }

  /**
   * Fetch content from a specific source
   */
  async fetchFromSource(
    sourceName: string,
    reference: string,
    options?: FetchOptions
  ): Promise<ReturnType<IResearchSource['fetch']>> {
    const source = this.sources.get(sourceName);
    if (!source) {
      return {
        success: false,
        reference,
        content: null,
        error: `Source "${sourceName}" not found`,
      };
    }

    const fetchOptions = { ...this.defaultFetchOptions, ...options };

    try {
      const result = await source.fetch(reference, fetchOptions);

      // Auto-spill large content
      if (result.success && result.sizeBytes && result.sizeBytes > (this.autoSpillPlugin?.['config']?.sizeThreshold ?? 10240)) {
        const spillKey = await this.autoSpillPlugin?.onToolOutput(`research_fetch_${sourceName}`, result.content);
        if (spillKey) {
          // Modify result to reference spilled data
          (result as any).spilledKey = spillKey;
        }
      }

      // Emit hook
      if (this.researchHooks?.onContentFetched) {
        await this.researchHooks.onContentFetched(sourceName, reference, result.sizeBytes ?? 0);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        reference,
        content: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Store a research finding in memory
   * Requires memory feature to be enabled
   */
  async storeFinding(
    key: string,
    finding: ResearchFinding
  ): Promise<void> {
    const memory = this._agentContext.memory;
    if (!memory) {
      throw new Error('ResearchAgent.storeFinding requires memory feature to be enabled');
    }

    const fullKey = addTierPrefix(key, 'findings');

    await memory.storeFindings(
      key,
      `${finding.source}: ${finding.summary.slice(0, 100)}...`,
      finding
    );

    // Emit hook
    if (this.researchHooks?.onFindingStored) {
      await this.researchHooks.onFindingStored(fullKey, finding);
    }
  }

  /**
   * Get all stored findings
   * Returns empty object if memory feature is disabled
   */
  async getFindings(): Promise<Record<string, ResearchFinding>> {
    const memory = this._agentContext.memory;
    if (!memory) {
      return {};
    }

    const entries = await memory.getByTier('findings');
    const findings: Record<string, ResearchFinding> = {};

    for (const entry of entries) {
      findings[entry.key] = entry.value as ResearchFinding;
    }

    return findings;
  }

  /**
   * Cleanup raw data that has been processed
   * Call this after creating summaries/findings from raw content
   */
  async cleanupProcessedRaw(rawKeys: string[]): Promise<number> {
    // Mark as consumed in auto-spill
    for (const key of rawKeys) {
      this.autoSpillPlugin?.markConsumed(key, 'manual-cleanup');
    }

    // Cleanup via auto-spill plugin
    const deleted = await this.autoSpillPlugin?.cleanup(rawKeys) ?? [];
    return deleted.length;
  }

  /**
   * Execute a research plan
   * This is a high-level orchestration method that can be used
   * for structured research, or the LLM can drive research via tools
   */
  async executeResearchPlan(plan: ResearchPlan): Promise<ResearchResult> {
    const startTime = Date.now();
    const metrics = {
      searchDurationMs: 0,
      processDurationMs: 0,
      synthesizeDurationMs: 0,
      totalDurationMs: 0,
    };

    let queriesExecuted = 0;
    let resultsFound = 0;
    let resultsProcessed = 0;

    try {
      // Phase 1: Search
      const searchStart = Date.now();
      const allResults: Array<{ source: string; query: string; results: any[] }> = [];

      for (const querySpec of plan.queries) {
        const searchResults = await this.searchSources(querySpec.query, {
          maxResults: plan.maxResultsPerQuery,
          sources: querySpec.sources ?? plan.sources,
        });

        queriesExecuted++;

        for (const [source, response] of searchResults) {
          if (response.success) {
            allResults.push({
              source,
              query: querySpec.query,
              results: response.results,
            });
            resultsFound += response.results.length;
          }
        }

        // Emit progress
        if (this.researchHooks?.onProgress) {
          await this.researchHooks.onProgress({
            phase: 'searching',
            currentQuery: querySpec.query,
            queriesCompleted: queriesExecuted,
            totalQueries: plan.queries.length,
            resultsProcessed: 0,
            totalResults: resultsFound,
            findingsGenerated: 0,
          });
        }
      }

      metrics.searchDurationMs = Date.now() - searchStart;

      // Phase 2: Process (fetch and store)
      const processStart = Date.now();
      for (const resultSet of allResults) {
        for (const result of resultSet.results) {
          // Fetch content
          const content = await this.fetchFromSource(resultSet.source, result.reference);
          resultsProcessed++;

          if (content.success) {
            // Store in raw tier if memory is enabled
            if (this._agentContext.memory) {
              const rawKey = `${resultSet.source}_${result.id}`;
              await this._agentContext.memory.storeRaw(
                rawKey,
                `Raw content from ${resultSet.source}: ${result.title}`,
                content.content
              );
            }
          }

          // Emit progress
          if (this.researchHooks?.onProgress) {
            await this.researchHooks.onProgress({
              phase: 'processing',
              currentSource: resultSet.source,
              queriesCompleted: queriesExecuted,
              totalQueries: plan.queries.length,
              resultsProcessed,
              totalResults: resultsFound,
              findingsGenerated: 0,
            });
          }

          // Check if we've hit the limit
          if (plan.maxTotalFindings && resultsProcessed >= plan.maxTotalFindings) {
            break;
          }
        }
      }

      metrics.processDurationMs = Date.now() - processStart;

      // Phase 3: Synthesize (let the LLM do this via the agentic loop)
      // The agent will use memory_retrieve_batch to get all findings
      // and create a synthesis

      const findings = await this.getFindings();
      const findingsCount = Object.keys(findings).length;

      metrics.totalDurationMs = Date.now() - startTime;

      return {
        success: true,
        goal: plan.goal,
        queriesExecuted,
        resultsFound,
        resultsProcessed,
        findingsCount,
        metrics,
      };
    } catch (error) {
      metrics.totalDurationMs = Date.now() - startTime;

      return {
        success: false,
        goal: plan.goal,
        queriesExecuted,
        resultsFound,
        resultsProcessed,
        findingsCount: 0,
        error: error instanceof Error ? error.message : String(error),
        metrics,
      };
    }
  }

  /**
   * Get auto-spill statistics
   */
  getAutoSpillStats(): {
    totalSpilled: number;
    consumed: number;
    unconsumed: number;
    totalSizeBytes: number;
  } {
    if (!this.autoSpillPlugin) {
      return { totalSpilled: 0, consumed: 0, unconsumed: 0, totalSizeBytes: 0 };
    }

    const entries = this.autoSpillPlugin.getEntries();
    const consumed = entries.filter((e) => e.consumed);
    const unconsumed = entries.filter((e) => !e.consumed);

    return {
      totalSpilled: entries.length,
      consumed: consumed.length,
      unconsumed: unconsumed.length,
      totalSizeBytes: entries.reduce((sum, e) => sum + e.sizeBytes, 0),
    };
  }

  // ===== Override cleanup =====

  override async destroy(): Promise<void> {
    this.sources.clear();
    await super.destroy();
  }
}

// ============================================================================
// Research Tools Factory
// ============================================================================

/**
 * Research tools context - extends ToolContext with research-specific access
 */
interface ResearchToolContext {
  sourcesMap: Map<string, IResearchSource>;
  defaultSearchOptions: SearchOptions;
  defaultFetchOptions: FetchOptions;
  autoSpillPlugin?: AutoSpillPlugin;
}

/**
 * Create research-specific tools for source interaction
 * These tools use closure over the sources and config rather than accessing agent from context
 */
function createResearchTools(sources: IResearchSource[]): ToolFunction[] {
  // Create a sources map for lookup
  const sourcesMap = new Map<string, IResearchSource>();
  for (const source of sources) {
    sourcesMap.set(source.name, source);
  }

  const sourceNames = sources.map((s) => s.name);
  const sourceDescriptions = sources.map((s) => `- ${s.name} (${s.type}): ${s.description}`).join('\n');

  return [
    // research_search - Search across sources
    {
      definition: {
        type: 'function',
        function: {
          name: 'research_search',
          description: `Search for information across configured research sources.

Available sources:
${sourceDescriptions}

Returns search results with references that can be fetched for full content.`,
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              sources: {
                type: 'array',
                items: { type: 'string', enum: sourceNames },
                description: 'Specific sources to search (empty = all sources)',
              },
              maxResults: {
                type: 'number',
                description: 'Maximum results per source (default: 10)',
              },
            },
            required: ['query'],
          },
        },
      } as FunctionToolDefinition,
      execute: async (args: Record<string, unknown>) => {
        const query = args.query as string;
        const requestedSources = args.sources as string[] | undefined;
        const maxResults = (args.maxResults as number) ?? 10;

        // Get target sources
        const targetSources = requestedSources && requestedSources.length > 0
          ? requestedSources.map((name) => sourcesMap.get(name)).filter(Boolean) as IResearchSource[]
          : sources;

        // Search all sources in parallel
        const results = new Map<string, Awaited<ReturnType<IResearchSource['search']>>>();

        await Promise.all(
          targetSources.map(async (source) => {
            try {
              const response = await source.search(query, { maxResults });
              results.set(source.name, response);
            } catch (error) {
              results.set(source.name, {
                success: false,
                query,
                results: [],
                error: error instanceof Error ? error.message : String(error),
              });
            }
          })
        );

        // Format results
        const formatted: Record<string, unknown> = {};
        for (const [source, response] of results) {
          formatted[source] = {
            success: response.success,
            count: response.results.length,
            results: response.results.map((r) => ({
              id: r.id,
              title: r.title,
              snippet: r.snippet,
              reference: r.reference,
              relevance: r.relevance,
            })),
            error: response.error,
          };
        }

        return {
          query,
          sources: Object.keys(formatted),
          results: formatted,
          totalResults: Object.values(formatted).reduce((sum: number, r: any) => sum + r.count, 0),
        };
      },
      idempotency: { safe: false },
      output: { expectedSize: 'medium' },
      describeCall: (args) => `"${args.query}" in ${(args.sources as string[])?.join(', ') || 'all sources'}`,
    },

    // research_fetch - Fetch full content
    {
      definition: {
        type: 'function',
        function: {
          name: 'research_fetch',
          description: `Fetch full content for a search result.

Use the reference from research_search results.
Large content will be auto-stored in memory (raw tier) - use memory_retrieve to access.`,
          parameters: {
            type: 'object',
            properties: {
              source: {
                type: 'string',
                enum: sourceNames,
                description: 'Source to fetch from',
              },
              reference: {
                type: 'string',
                description: 'Reference from search result (URL, path, ID, etc.)',
              },
            },
            required: ['source', 'reference'],
          },
        },
      } as FunctionToolDefinition,
      execute: async (args: Record<string, unknown>) => {
        const sourceName = args.source as string;
        const reference = args.reference as string;

        const source = sourcesMap.get(sourceName);
        if (!source) {
          return {
            success: false,
            reference,
            error: `Source "${sourceName}" not found`,
          };
        }

        try {
          const result = await source.fetch(reference, { maxSize: 1024 * 1024 });

          return {
            success: result.success,
            reference: result.reference,
            contentType: result.contentType,
            sizeBytes: result.sizeBytes,
            content: result.success ? result.content : null,
            error: result.error,
          };
        } catch (error) {
          return {
            success: false,
            reference,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      idempotency: { safe: false },
      output: { expectedSize: 'large' },
      describeCall: (args) => `${args.source}:${args.reference}`,
    },

    // research_store_finding - Store a research finding (uses standard memory tools)
    {
      definition: {
        type: 'function',
        function: {
          name: 'research_store_finding',
          description: `Store a research finding in memory (findings tier, high priority).

Use this to save important insights discovered during research.
Findings are preserved during context compaction.

Note: This is a convenience wrapper around memory_store with tier="findings".`,
          parameters: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
                description: 'Unique key for this finding (e.g., "ai_employment_impact")',
              },
              source: {
                type: 'string',
                description: 'Source that provided this finding',
              },
              query: {
                type: 'string',
                description: 'Query that led to this finding',
              },
              summary: {
                type: 'string',
                description: 'Brief summary of the finding (1-2 sentences)',
              },
              details: {
                type: 'string',
                description: 'Additional details or supporting information',
              },
              references: {
                type: 'array',
                items: { type: 'string' },
                description: 'References used (URLs, file paths, etc.)',
              },
              confidence: {
                type: 'number',
                description: 'Confidence level 0-1 (optional)',
              },
            },
            required: ['key', 'source', 'query', 'summary', 'references'],
          },
        },
      } as FunctionToolDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        if (!context?.memory) {
          throw new ToolExecutionError('research_store_finding', 'Requires memory context (use with TaskAgent or ResearchAgent)');
        }

        const finding: ResearchFinding = {
          source: args.source as string,
          query: args.query as string,
          summary: args.summary as string,
          details: args.details as string | undefined,
          references: args.references as string[],
          confidence: args.confidence as number | undefined,
          timestamp: Date.now(),
        };

        const fullKey = addTierPrefix(args.key as string, 'findings');
        const description = `${finding.source}: ${finding.summary.slice(0, 100)}${finding.summary.length > 100 ? '...' : ''}`;

        await context.memory.set(fullKey, description, finding, {
          scope: { type: 'plan' },
          priority: 'high',
        });

        return {
          success: true,
          key: fullKey,
          finding,
        };
      },
      idempotency: { safe: true },
      output: { expectedSize: 'small' },
      describeCall: (args) => args.key as string,
    },

    // research_list_sources - List available sources
    {
      definition: {
        type: 'function',
        function: {
          name: 'research_list_sources',
          description: 'List all available research sources and their capabilities.',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      } as FunctionToolDefinition,
      execute: async () => {
        return {
          count: sources.length,
          sources: sources.map((s) => ({
            name: s.name,
            type: s.type,
            description: s.description,
            capabilities: s.getCapabilities?.() ?? {
              canSearch: true,
              canFetch: true,
              hasRelevanceScores: false,
            },
          })),
        };
      },
      idempotency: { safe: true },
      output: { expectedSize: 'small' },
      describeCall: () => 'sources',
    },
  ];
}

export { createResearchTools };
export type { ResearchToolContext };
