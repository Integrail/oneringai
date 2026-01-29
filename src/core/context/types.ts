/**
 * Core types for context management system
 */

/**
 * Context component that can be compacted
 */
export interface IContextComponent {
  /** Unique name for this component */
  name: string;

  /** The actual content (string or structured data) */
  content: string | unknown;

  /** Priority for compaction (higher = compact first) */
  priority: number;

  /** Whether this component can be compacted */
  compactable: boolean;

  /** Additional metadata for compaction strategies */
  metadata?: Record<string, unknown>;
}

/**
 * Context budget information
 */
export interface ContextBudget {
  /** Total available tokens */
  total: number;

  /** Reserved tokens for response */
  reserved: number;

  /** Currently used tokens */
  used: number;

  /** Available tokens remaining */
  available: number;

  /** Utilization percentage (used / (total - reserved)) */
  utilizationPercent: number;

  /** Budget status */
  status: 'ok' | 'warning' | 'critical';

  /** Token breakdown by component */
  breakdown: Record<string, number>;
}

/**
 * Context preparation result
 */
export interface PreparedContext {
  /** Prepared components */
  components: IContextComponent[];

  /** Current budget */
  budget: ContextBudget;

  /** Whether compaction occurred */
  compacted: boolean;

  /** Compaction log if compacted */
  compactionLog?: string[];
}

/**
 * Context manager configuration
 */
export interface ContextManagerConfig {
  /** Maximum context tokens for the model */
  maxContextTokens: number;

  /** Threshold to trigger compaction (0.0 - 1.0) */
  compactionThreshold: number;

  /** Hard limit - must compact before this (0.0 - 1.0) */
  hardLimit: number;

  /** Reserve space for response (0.0 - 1.0) */
  responseReserve: number;

  /** Token estimator to use */
  estimator: 'approximate' | 'tiktoken' | ITokenEstimator;

  /** Enable automatic compaction */
  autoCompact: boolean;

  /** Strategy to use */
  strategy?: 'proactive' | 'aggressive' | 'lazy' | 'rolling-window' | 'adaptive' | IContextStrategy;

  /** Strategy-specific options */
  strategyOptions?: Record<string, unknown>;
}

/**
 * Default configuration
 */
export const DEFAULT_CONTEXT_CONFIG: ContextManagerConfig = {
  maxContextTokens: 128000,
  compactionThreshold: 0.75,
  hardLimit: 0.9,
  responseReserve: 0.15,
  estimator: 'approximate',
  autoCompact: true,
  strategy: 'proactive',
  strategyOptions: {},
};

/**
 * Abstract interface for providing context components.
 * Each agent type implements this to define what goes into context.
 */
export interface IContextProvider {
  /**
   * Get current context components
   */
  getComponents(): Promise<IContextComponent[]>;

  /**
   * Update components after compaction
   */
  applyCompactedComponents(components: IContextComponent[]): Promise<void>;

  /**
   * Get max context size for this agent/model
   */
  getMaxContextSize(): number;
}

/**
 * Content type for more accurate token estimation
 * Named differently from TokenContentType in Content.ts to avoid conflicts
 */
export type TokenContentType = 'code' | 'prose' | 'mixed';

/**
 * Abstract interface for token estimation
 */
export interface ITokenEstimator {
  /**
   * Estimate token count for text
   *
   * @param text - The text to estimate
   * @param contentType - Type of content for more accurate estimation:
   *   - 'code': Code is typically denser (~3 chars/token)
   *   - 'prose': Natural language text (~4 chars/token)
   *   - 'mixed': Mix of code and prose (~3.5 chars/token)
   */
  estimateTokens(text: string, contentType?: TokenContentType): number;

  /**
   * Estimate tokens for structured data
   */
  estimateDataTokens(data: unknown, contentType?: TokenContentType): number;
}

/**
 * Hook context for beforeCompaction callback
 */
export interface CompactionHookContext {
  /** Agent identifier (if available) */
  agentId?: string;
  /** Current context budget info */
  currentBudget: ContextBudget;
  /** Compaction strategy being used */
  strategy: string;
  /** Current context components (read-only summaries) */
  components: ReadonlyArray<{
    name: string;
    priority: number;
    compactable: boolean;
  }>;
  /** Estimated tokens to be freed */
  estimatedTokensToFree: number;
}

/**
 * Hooks for context management events
 */
export interface ContextManagerHooks {
  /**
   * Called before compaction occurs.
   * Use this to save important data before it gets compacted.
   * This is the last chance to preserve critical information.
   */
  beforeCompaction?: (context: CompactionHookContext) => Promise<void>;
}

/**
 * Abstract interface for compaction strategies
 */
export interface IContextCompactor {
  /** Compactor name */
  readonly name: string;

  /** Priority order (lower = run first) */
  readonly priority: number;

  /**
   * Check if this compactor can handle the component
   */
  canCompact(component: IContextComponent): boolean;

  /**
   * Compact the component to target size
   */
  compact(component: IContextComponent, targetTokens: number): Promise<IContextComponent>;

  /**
   * Estimate savings from compaction
   */
  estimateSavings(component: IContextComponent): number;
}

/**
 * Context management strategy - defines the overall approach to managing context
 */
export interface IContextStrategy {
  /** Strategy name */
  readonly name: string;

  /**
   * Decide if compaction is needed based on current budget
   */
  shouldCompact(budget: ContextBudget, config: ContextManagerConfig): boolean;

  /**
   * Execute compaction using available compactors
   */
  compact(
    components: IContextComponent[],
    budget: ContextBudget,
    compactors: IContextCompactor[],
    estimator: ITokenEstimator
  ): Promise<{
    components: IContextComponent[];
    log: string[];
    tokensFreed: number;
  }>;

  /**
   * Optional: Prepare components before budget calculation
   * Use this for strategies that pre-process context (e.g., rolling window)
   */
  prepareComponents?(components: IContextComponent[]): Promise<IContextComponent[]>;

  /**
   * Optional: Post-process after compaction
   * Use this for strategies that need cleanup or optimization
   */
  postProcess?(
    components: IContextComponent[],
    budget: ContextBudget
  ): Promise<IContextComponent[]>;

  /**
   * Optional: Get strategy-specific metrics
   */
  getMetrics?(): Record<string, unknown>;
}
