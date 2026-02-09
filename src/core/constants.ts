/**
 * Core Constants - Centralized configuration defaults
 *
 * This file provides a single source of truth for all default values
 * used throughout the framework. Import from here instead of hardcoding.
 */

// ============ Task Execution Defaults ============

/**
 * Default task execution settings
 */
export const TASK_DEFAULTS = {
  /** Default timeout for task execution in milliseconds (5 minutes) */
  TIMEOUT_MS: 300_000,

  /** Maximum retry attempts for failed tasks */
  MAX_RETRIES: 3,

  /** Default delay between retries in milliseconds */
  RETRY_DELAY_MS: 1_000,

  /** Maximum consecutive errors before stopping */
  MAX_CONSECUTIVE_ERRORS: 3,
} as const;

// ============ Context Management Defaults ============

/**
 * Default context management settings
 */
export const CONTEXT_DEFAULTS = {
  /** Default maximum context tokens (128K) */
  MAX_TOKENS: 128_000,

  /** Reserve percentage for response generation (15%) */
  RESPONSE_RESERVE: 0.15,

  /** Threshold to trigger compaction warning (75%) */
  COMPACTION_THRESHOLD: 0.75,

  /** Hard limit before forced compaction (90%) */
  HARD_LIMIT: 0.90,
} as const;

// ============ Memory Defaults ============

/**
 * Working memory configuration
 */
export const MEMORY_DEFAULTS = {
  /** Default maximum memory size in bytes (25MB) */
  MAX_SIZE_BYTES: 25 * 1024 * 1024,

  /** Soft limit percentage to trigger warnings */
  SOFT_LIMIT_PERCENT: 80,

  /** Default eviction count when memory is full */
  DEFAULT_EVICTION_COUNT: 5,
} as const;

// ============ Session Defaults ============

/**
 * Session management configuration
 */
export const SESSION_DEFAULTS = {
  /** Default auto-save interval in milliseconds (30 seconds) */
  AUTO_SAVE_INTERVAL_MS: 30_000,

  /** Maximum session age before cleanup (24 hours) */
  MAX_SESSION_AGE_MS: 86_400_000,
} as const;

// ============ Agent Defaults ============

/**
 * Agent execution configuration
 */
export const AGENT_DEFAULTS = {
  /** Default maximum iterations for agentic loop */
  MAX_ITERATIONS: 50,

  /** Default temperature for LLM calls */
  DEFAULT_TEMPERATURE: 0.7,

  /** Message injected when max iterations is reached */
  MAX_ITERATIONS_MESSAGE: `You have reached the maximum iteration limit for this execution. Please:
1. Summarize what you have accomplished so far
2. Explain what remains to be done (if anything)
3. Ask the user if they would like you to continue

Do NOT use any tools in this response - just provide a clear summary and ask for confirmation to proceed.`,
} as const;

// ============ Circuit Breaker Defaults ============

/**
 * Circuit breaker configuration
 */
export const CIRCUIT_BREAKER_DEFAULTS = {
  /** Failures before opening circuit */
  FAILURE_THRESHOLD: 5,

  /** Successes in half-open before closing */
  SUCCESS_THRESHOLD: 2,

  /** Time before trying half-open (1 minute) */
  RESET_TIMEOUT_MS: 60_000,

  /** Window for tracking failures (5 minutes) */
  WINDOW_MS: 300_000,
} as const;

// ============ History Defaults ============

/**
 * Conversation history configuration
 */
export const HISTORY_DEFAULTS = {
  /** Maximum messages to keep in history */
  MAX_MESSAGES: 50,

  /** Preserve this many recent messages during compaction */
  PRESERVE_RECENT_COUNT: 10,

  /** Default compaction strategy */
  COMPACTION_STRATEGY: 'sliding-window' as const,
} as const;

// ============ Token Estimation ============

/**
 * Token estimation ratios (characters per token)
 */
export const TOKEN_ESTIMATION = {
  /** Characters per token for code */
  CODE_CHARS_PER_TOKEN: 3,

  /** Characters per token for prose */
  PROSE_CHARS_PER_TOKEN: 4,

  /** Characters per token for mixed content */
  MIXED_CHARS_PER_TOKEN: 3.5,

  /** Default characters per token */
  DEFAULT_CHARS_PER_TOKEN: 4,
} as const;

// ============ Strategy-Dependent Thresholds ============

/**
 * Strategy-specific thresholds (percentages of maxContextTokens).
 * These adapt context management behavior to the chosen compaction strategy.
 */
export const STRATEGY_THRESHOLDS = {
  proactive: {
    // Most balanced - good for general use
    compactionTrigger: 0.75,        // Start compaction at 75%
    compactionTarget: 0.65,         // Reduce to 65%
    smartCompactionTrigger: 0.70,   // Trigger smart compaction at 70%
    maxToolResultsPercent: 0.30,    // Tool results can use up to 30% of context
    protectedContextPercent: 0.10,  // Protect at least 10% of context (recent messages)
  },
  aggressive: {
    // Memory-constrained - compact early and often
    compactionTrigger: 0.60,
    compactionTarget: 0.50,
    smartCompactionTrigger: 0.55,
    maxToolResultsPercent: 0.25,
    protectedContextPercent: 0.08,
  },
  lazy: {
    // Preserve context - only compact when critical
    compactionTrigger: 0.90,
    compactionTarget: 0.85,
    smartCompactionTrigger: 0.85,
    maxToolResultsPercent: 0.40,    // Allow more tool results
    protectedContextPercent: 0.15,  // Protect more recent context
  },
  adaptive: {
    // Starts with proactive, adjusts based on performance
    compactionTrigger: 0.75,
    compactionTarget: 0.65,
    smartCompactionTrigger: 0.70,
    maxToolResultsPercent: 0.30,
    protectedContextPercent: 0.10,
  },
  'rolling-window': {
    // Fixed window, similar to lazy but with message count focus
    compactionTrigger: 0.85,
    compactionTarget: 0.75,
    smartCompactionTrigger: 0.80,
    maxToolResultsPercent: 0.35,
    protectedContextPercent: 0.12,
  },
} as const;

export type StrategyName = keyof typeof STRATEGY_THRESHOLDS;

/**
 * High count caps as safety limits (not primary triggers).
 * These act as last-resort limits when percentage-based thresholds aren't enough.
 */
export const SAFETY_CAPS = {
  /** Safety cap for max tool results (only triggers if percentage doesn't) */
  MAX_FULL_RESULTS: 100,
  /** Safety cap for max age iterations */
  MAX_AGE_ITERATIONS: 50,
  /** Always keep at least this many messages */
  MIN_PROTECTED_MESSAGES: 10,
} as const;

/**
 * Tool retention multipliers by strategy (base iterations × multiplier).
 * Allows strategy to influence how long tool results are kept.
 */
export const TOOL_RETENTION_MULTIPLIERS: Record<StrategyName, number> = {
  proactive: 1.0,
  aggressive: 0.7,
  lazy: 1.5,
  adaptive: 1.0,
  'rolling-window': 1.2,
};

// ============ Tool Result Eviction Defaults ============

/**
 * Tool result eviction configuration.
 * Controls when and how old tool results are moved from context to memory.
 *
 * NOTE: These are LEGACY defaults. The newer STRATEGY_THRESHOLDS provide
 * percentage-based limits that adapt to different context sizes and strategies.
 * ToolResultEvictionPlugin should prefer percentage-based limits when available.
 */
export const TOOL_RESULT_EVICTION_DEFAULTS = {
  /** Keep last N tool result pairs in conversation (LEGACY - use SAFETY_CAPS instead) */
  MAX_FULL_RESULTS: 10,

  /** Evict results after N iterations (LEGACY - use percentage-based) */
  MAX_AGE_ITERATIONS: 5,

  /** Only evict results larger than this (bytes, default: 1KB) */
  MIN_SIZE_TO_EVICT: 1024,

  /** Trigger size-based eviction when total exceeds this (bytes, default: 100KB) */
  MAX_TOTAL_SIZE_BYTES: 100 * 1024,
} as const;

/**
 * Base per-tool iteration retention (before strategy multiplier).
 * Tools not listed use TOOL_RESULT_EVICTION_DEFAULTS.MAX_AGE_ITERATIONS.
 *
 * Higher values = keep results longer in conversation.
 * Final retention = base × TOOL_RETENTION_MULTIPLIERS[strategy]
 *
 * Common patterns:
 * - File/code tools: Keep longer (often referenced later)
 * - Web tools: Keep shorter (can re-fetch if needed)
 */
export const DEFAULT_TOOL_RETENTION: Record<string, number> = {
  // Long retention - outputs often referenced later
  read_file: 20,
  bash: 15,
  grep: 15,
  glob: 12,
  edit_file: 12,

  // Medium retention
  memory_retrieve: 10,
  list_directory: 10,
  autospill_process: 8,

  // Short retention - web content can be re-fetched
  web_fetch: 6,
  web_search: 6,
  web_scrape: 6,
};

