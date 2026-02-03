/**
 * AgentContextNextGen - Type Definitions
 *
 * Clean, minimal type definitions for the next-generation context manager.
 */

import type { InputItem } from '../../domain/entities/Message.js';
import type { ToolFunction } from '../../domain/entities/Tool.js';

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Token estimator interface - used for conversation and input estimation
 * Plugins handle their own token estimation internally.
 */
export interface ITokenEstimator {
  /** Estimate tokens for a string */
  estimateTokens(text: string): number;

  /** Estimate tokens for arbitrary data (will be JSON stringified) */
  estimateDataTokens(data: unknown): number;
}

// ============================================================================
// Plugin Interface
// ============================================================================

/**
 * Next-generation context plugin interface.
 *
 * Plugins provide:
 * 1. Instructions (how to use the plugin) - added to system message, NEVER compacted
 * 2. Content (actual plugin data) - added to system message, may be compacted
 * 3. Tools (optional) - registered with ToolManager
 *
 * Each plugin is responsible for:
 * - Tracking its own token size
 * - Providing its full contents for inspection
 * - Compacting itself when requested
 */
export interface IContextPluginNextGen {
  /** Unique plugin name */
  readonly name: string;

  /**
   * Get instructions explaining how to use this plugin.
   * These are added to the system message and NEVER compacted.
   * Return null if no instructions needed.
   */
  getInstructions(): string | null;

  /**
   * Get the formatted content to include in the system message.
   * For example: InContextMemory returns formatted KVPs, WorkingMemory returns formatted index.
   * Return null if no content to add (e.g., empty memory).
   */
  getContent(): Promise<string | null>;

  /**
   * Get the full raw contents of this plugin for inspection.
   * Used by library clients to inspect plugin state.
   * Returns the actual data structure, not formatted string.
   */
  getContents(): unknown;

  /**
   * Get current token size of this plugin's content.
   * Each plugin is responsible for tracking its own size.
   * This should return the token count for getContent() output.
   */
  getTokenSize(): number;

  /**
   * Get token size of instructions (cached, rarely changes).
   */
  getInstructionsTokenSize(): number;

  /**
   * Whether this plugin's content can be compacted when context is tight.
   */
  isCompactable(): boolean;

  /**
   * Compact the plugin's content to free up tokens.
   * Only called if isCompactable() returns true.
   *
   * @param targetTokensToFree - Approximate tokens we'd like to free
   * @returns Actual tokens freed
   */
  compact(targetTokensToFree: number): Promise<number>;

  /**
   * Get tools provided by this plugin.
   * Tools are automatically registered with ToolManager.
   */
  getTools(): ToolFunction[];

  /**
   * Cleanup resources when context is destroyed.
   */
  destroy(): void;

  /**
   * Get serializable state for session persistence.
   */
  getState(): unknown;

  /**
   * Restore state from saved session.
   */
  restoreState(state: unknown): void;
}

// ============================================================================
// Compaction Strategy
// ============================================================================

/**
 * Strategy names - determine when compaction triggers
 */
export type CompactionStrategyName = 'proactive' | 'balanced' | 'lazy';

/**
 * Strategy thresholds (percentage of context used before compaction triggers)
 */
export const STRATEGY_THRESHOLDS: Record<CompactionStrategyName, number> = {
  proactive: 0.70, // Compact at 70% usage
  balanced: 0.80, // Compact at 80% usage
  lazy: 0.90, // Compact at 90% usage
};

// ============================================================================
// Context Budget
// ============================================================================

/**
 * Token budget breakdown - clear and simple
 */
export interface ContextBudget {
  /** Maximum context tokens for the model */
  maxTokens: number;

  /** Tokens reserved for LLM response */
  responseReserve: number;

  /** Tokens used by system message (prompt + instructions + plugin content) */
  systemMessageTokens: number;

  /** Tokens used by tool definitions (NEVER compacted) */
  toolsTokens: number;

  /** Tokens used by conversation history */
  conversationTokens: number;

  /** Tokens used by current input (user message or tool results) */
  currentInputTokens: number;

  /** Total tokens used */
  totalUsed: number;

  /** Available tokens (maxTokens - responseReserve - totalUsed) */
  available: number;

  /** Usage percentage (totalUsed / (maxTokens - responseReserve)) */
  utilizationPercent: number;

  /** Breakdown by component for debugging */
  breakdown: {
    systemPrompt: number;
    persistentInstructions: number;
    pluginInstructions: number;
    pluginContents: Record<string, number>;
    tools: number;
    conversation: number;
    currentInput: number;
  };
}

// ============================================================================
// Prepared Context
// ============================================================================

/**
 * Result of prepare() - ready for LLM call
 */
export interface PreparedContext {
  /** Final input items array for LLM */
  input: InputItem[];

  /** Token budget breakdown */
  budget: ContextBudget;

  /** Whether compaction was performed */
  compacted: boolean;

  /** Log of compaction actions taken */
  compactionLog: string[];
}

// ============================================================================
// Current Input Handling
// ============================================================================

/**
 * Result of handling oversized current input
 */
export interface OversizedInputResult {
  /** Whether the input was accepted (possibly truncated) */
  accepted: boolean;

  /** Processed content (truncated if needed) */
  content: string;

  /** Error message if rejected */
  error?: string;

  /** Warning message if truncated */
  warning?: string;

  /** Original size in bytes */
  originalSize: number;

  /** Final size in bytes */
  finalSize: number;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Feature flags for enabling/disabling plugins
 */
export interface ContextFeatures {
  /** Enable WorkingMemory plugin (default: true) */
  workingMemory?: boolean;

  /** Enable InContextMemory plugin (default: false) */
  inContextMemory?: boolean;

  /** Enable PersistentInstructions plugin (default: false) */
  persistentInstructions?: boolean;
}

/**
 * Default feature configuration
 */
export const DEFAULT_FEATURES: Required<ContextFeatures> = {
  workingMemory: true,
  inContextMemory: false,
  persistentInstructions: false,
};

/**
 * AgentContextNextGen configuration
 */
export interface AgentContextNextGenConfig {
  /** Model name (used for context window lookup) */
  model: string;

  /** Maximum context tokens (auto-detected from model if not provided) */
  maxContextTokens?: number;

  /** Tokens to reserve for response (default: 4096) */
  responseReserve?: number;

  /** System prompt provided by user */
  systemPrompt?: string;

  /** Compaction strategy (default: 'balanced') */
  strategy?: CompactionStrategyName;

  /** Feature flags */
  features?: ContextFeatures;

  /** Agent ID (required for PersistentInstructions) */
  agentId?: string;

  /** Initial tools to register */
  tools?: ToolFunction[];

  /** Storage for session persistence */
  storage?: IContextStorage;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  responseReserve: 4096,
  strategy: 'balanced' as CompactionStrategyName,
};

// ============================================================================
// Storage Interface
// ============================================================================

/**
 * Storage interface for session persistence
 */
export interface IContextStorage {
  save(sessionId: string, state: SerializedContextState): Promise<void>;
  load(sessionId: string): Promise<SerializedContextState | null>;
  delete(sessionId: string): Promise<void>;
  exists(sessionId: string): Promise<boolean>;
}

/**
 * Serialized context state for persistence
 */
export interface SerializedContextState {
  conversation: InputItem[];
  pluginStates: Record<string, unknown>;
  systemPrompt?: string;
  metadata: {
    savedAt: number;
    agentId?: string;
    model: string;
  };
}

// ============================================================================
// Events
// ============================================================================

/**
 * Events emitted by AgentContextNextGen
 */
export interface ContextEvents {
  /** Emitted when context is prepared */
  'context:prepared': { budget: ContextBudget; compacted: boolean };

  /** Emitted when compaction is performed */
  'context:compacted': { tokensFreed: number; log: string[] };

  /** Emitted when budget reaches warning threshold (>70%) */
  'budget:warning': { budget: ContextBudget };

  /** Emitted when budget reaches critical threshold (>90%) */
  'budget:critical': { budget: ContextBudget };

  /** Emitted when current input is too large */
  'input:oversized': { result: OversizedInputResult };

  /** Emitted when a message is added */
  'message:added': { role: string; index: number };

  /** Emitted when conversation is cleared */
  'conversation:cleared': { reason?: string };
}
