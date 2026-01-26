/**
 * IHistoryManager - Interface for conversation history management
 *
 * Follows the same pattern as IMemoryStorage for pluggable implementations.
 * Users can implement this interface to use Redis, PostgreSQL, file storage, etc.
 */

import { EventEmitter } from 'eventemitter3';

/**
 * A single message in conversation history
 */
export interface HistoryMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Events emitted by IHistoryManager implementations
 */
export interface HistoryManagerEvents {
  'message:added': { message: HistoryMessage };
  'message:removed': { messageId: string };
  'history:cleared': { reason?: string };
  'history:compacted': { removedCount: number; strategy: string };
  'history:restored': { messageCount: number };
}

/**
 * Configuration for history management
 */
export interface IHistoryManagerConfig {
  /** Maximum messages to keep (for sliding window) */
  maxMessages?: number;

  /** Maximum tokens to keep (estimated) */
  maxTokens?: number;

  /** Compaction strategy when limits are reached */
  compactionStrategy?: 'truncate' | 'summarize' | 'sliding-window';

  /** Number of recent messages to always preserve */
  preserveRecentCount?: number;
}

/**
 * Serialized history state for persistence
 */
export interface SerializedHistoryState {
  version: number;
  messages: HistoryMessage[];
  summaries?: Array<{ content: string; coversCount: number; timestamp: number }>;
  metadata?: Record<string, unknown>;
}

/**
 * Interface for history storage backends
 * Implement this to use custom storage (Redis, PostgreSQL, file, etc.)
 */
export interface IHistoryStorage {
  /**
   * Store a message
   */
  addMessage(message: HistoryMessage): Promise<void>;

  /**
   * Get all messages
   */
  getMessages(): Promise<HistoryMessage[]>;

  /**
   * Get recent N messages
   */
  getRecentMessages(count: number): Promise<HistoryMessage[]>;

  /**
   * Remove a message by ID
   */
  removeMessage(id: string): Promise<void>;

  /**
   * Remove messages older than timestamp
   */
  removeOlderThan(timestamp: number): Promise<number>;

  /**
   * Clear all messages
   */
  clear(): Promise<void>;

  /**
   * Get message count
   */
  getCount(): Promise<number>;

  /**
   * Get serialized state for session persistence
   */
  getState(): Promise<SerializedHistoryState>;

  /**
   * Restore from serialized state
   */
  restoreState(state: SerializedHistoryState): Promise<void>;
}

/**
 * Interface for history manager
 * Manages conversation history with compaction and persistence support
 */
export interface IHistoryManager extends EventEmitter<HistoryManagerEvents> {
  /**
   * Add a message to history
   */
  addMessage(role: 'user' | 'assistant' | 'system', content: string, metadata?: Record<string, unknown>): Promise<HistoryMessage>;

  /**
   * Get all messages (may include summaries as system messages)
   */
  getMessages(): Promise<HistoryMessage[]>;

  /**
   * Get recent messages only
   */
  getRecentMessages(count?: number): Promise<HistoryMessage[]>;

  /**
   * Get formatted history for LLM context
   */
  formatForContext(options?: { maxTokens?: number; includeMetadata?: boolean }): Promise<string>;

  /**
   * Compact history (apply compaction strategy)
   */
  compact(): Promise<void>;

  /**
   * Clear all history
   */
  clear(): Promise<void>;

  /**
   * Get message count
   */
  getMessageCount(): Promise<number>;

  /**
   * Get state for session persistence
   */
  getState(): Promise<SerializedHistoryState>;

  /**
   * Restore from saved state
   */
  restoreState(state: SerializedHistoryState): Promise<void>;

  /**
   * Get current configuration
   */
  getConfig(): IHistoryManagerConfig;
}

/**
 * Default configuration
 */
export const DEFAULT_HISTORY_MANAGER_CONFIG: Required<IHistoryManagerConfig> = {
  maxMessages: 50,
  maxTokens: 32000,
  compactionStrategy: 'sliding-window',
  preserveRecentCount: 10,
};
