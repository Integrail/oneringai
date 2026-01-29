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

// ============ Strategy Defaults ============

/**
 * Proactive strategy configuration
 */
export const PROACTIVE_STRATEGY_DEFAULTS = {
  /** Target utilization after compaction */
  TARGET_UTILIZATION: 0.65,

  /** Base reduction factor for round 1 */
  BASE_REDUCTION_FACTOR: 0.50,

  /** Reduction step per round (more aggressive each round) */
  REDUCTION_STEP: 0.15,

  /** Maximum compaction rounds */
  MAX_ROUNDS: 3,
} as const;

/**
 * Aggressive strategy configuration
 */
export const AGGRESSIVE_STRATEGY_DEFAULTS = {
  /** Threshold to trigger compaction */
  THRESHOLD: 0.60,

  /** Target utilization after compaction */
  TARGET_UTILIZATION: 0.50,

  /** Reduction factor (keep 30% of original) */
  REDUCTION_FACTOR: 0.30,
} as const;

/**
 * Lazy strategy configuration
 */
export const LAZY_STRATEGY_DEFAULTS = {
  /** Target utilization after compaction */
  TARGET_UTILIZATION: 0.85,

  /** Reduction factor (keep 70% of original) */
  REDUCTION_FACTOR: 0.70,
} as const;

/**
 * Adaptive strategy configuration
 */
export const ADAPTIVE_STRATEGY_DEFAULTS = {
  /** Number of compactions to learn from */
  LEARNING_WINDOW: 10,

  /** Compactions per minute threshold to switch to aggressive */
  SWITCH_THRESHOLD: 5,

  /** Low utilization threshold to switch to lazy */
  LOW_UTILIZATION_THRESHOLD: 70,

  /** Low frequency threshold to switch to lazy */
  LOW_FREQUENCY_THRESHOLD: 0.5,
} as const;

/**
 * Rolling window strategy configuration
 */
export const ROLLING_WINDOW_DEFAULTS = {
  /** Default maximum messages to keep */
  MAX_MESSAGES: 20,
} as const;

// ============ Memory Defaults ============

/**
 * Working memory configuration
 */
export const MEMORY_DEFAULTS = {
  /** Default maximum memory size in bytes (1MB) */
  MAX_SIZE_BYTES: 1_048_576,

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
  MAX_ITERATIONS: 10,

  /** Default temperature for LLM calls */
  DEFAULT_TEMPERATURE: 0.7,
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
