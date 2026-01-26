/**
 * IContextBuilder - Interface for building LLM context from multiple sources
 *
 * Allows users to customize how context is assembled from:
 * - Conversation history
 * - Plan state
 * - Working memory
 * - Custom sources
 */

/**
 * A source that can contribute to context
 */
export interface ContextSource {
  /** Unique name for this source */
  name: string;

  /** Priority (higher = included first if space is limited) */
  priority: number;

  /** Whether this source is required (error if can't fit) */
  required: boolean;

  /** Get content for this source */
  getContent(): Promise<string>;

  /** Estimate tokens for this source */
  estimateTokens(): Promise<number>;
}

/**
 * Built context ready for LLM
 */
export interface BuiltContext {
  /** The full context string */
  content: string;

  /** Estimated token count */
  estimatedTokens: number;

  /** Which sources were included */
  includedSources: string[];

  /** Which sources were excluded (due to space) */
  excludedSources: string[];

  /** Token breakdown by source */
  tokenBreakdown: Record<string, number>;
}

/**
 * Configuration for context building
 */
export interface ContextBuilderConfig {
  /** Maximum tokens for context */
  maxTokens?: number;

  /** Reserve space for response */
  responseReserve?: number;

  /** Token estimator function */
  estimateTokens?: (text: string) => number;

  /** Header/separator between sections */
  sectionSeparator?: string;
}

/**
 * Interface for context builder
 * Assembles context from multiple sources with token budget management
 */
export interface IContextBuilder {
  /**
   * Register a context source
   */
  registerSource(source: ContextSource): void;

  /**
   * Unregister a context source
   */
  unregisterSource(name: string): void;

  /**
   * Build context from all registered sources
   */
  build(input: string, options?: Partial<ContextBuilderConfig>): Promise<BuiltContext>;

  /**
   * Get registered source names
   */
  getSources(): string[];

  /**
   * Get current configuration
   */
  getConfig(): ContextBuilderConfig;

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContextBuilderConfig>): void;
}

/**
 * Default configuration
 */
export const DEFAULT_CONTEXT_BUILDER_CONFIG: Required<ContextBuilderConfig> = {
  maxTokens: 128000,
  responseReserve: 0.15,
  estimateTokens: (text: string) => Math.ceil(text.length / 4),
  sectionSeparator: '\n\n---\n\n',
};
