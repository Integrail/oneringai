/**
 * IHistoryJournal - Interface for append-only conversation history logging
 *
 * Provides a durable, append-only log of all conversation messages,
 * independent of context compaction. While the agent's working window
 * (_conversation) may be compacted to fit the LLM context, the journal
 * preserves the full conversation history on disk/database.
 *
 * The journal is a companion capability of IContextStorage — storage
 * implementations that support history logging expose it via the
 * `journal` property. Consumers never configure the journal separately;
 * it comes for free with the storage backend.
 *
 * Access patterns:
 * - **Write**: append-only, per-message, fire-and-forget (non-blocking)
 * - **Read**: on-demand, explicit (never loaded automatically)
 *
 * @example
 * ```typescript
 * // File storage → FileHistoryJournal (JSONL files)
 * const storage = new FileContextStorage({ agentId: 'my-agent' });
 * storage.journal.append('session-1', [entry]);
 *
 * // Mongo storage → MongoHistoryJournal (collection)
 * const storage = new MongoContextStorage({ agentId: 'my-agent', db });
 * storage.journal.append('session-1', [entry]);
 *
 * // Reading history (on-demand, explicit)
 * const entries = await storage.journal.read('session-1', { limit: 50 });
 * const total = await storage.journal.count('session-1');
 * ```
 */

import type { InputItem } from '../entities/Message.js';

// ============================================================================
// History Entry
// ============================================================================

/**
 * Type of history entry, derived from the message's role/purpose.
 */
export type HistoryEntryType = 'user' | 'assistant' | 'tool_result' | 'system';

/**
 * A single entry in the history journal.
 *
 * Wraps an InputItem with metadata for ordering and filtering.
 * The `item` field is the exact InputItem as it was added to the conversation,
 * preserving full fidelity (including __images, tool_use_id, etc.).
 */
export interface HistoryEntry {
  /** When this entry was recorded (epoch ms) */
  timestamp: number;

  /** Entry type for filtering */
  type: HistoryEntryType;

  /** The actual conversation item (Message or CompactionItem) */
  item: InputItem;

  /**
   * Monotonically increasing turn counter.
   * A "turn" is one user message + one assistant response (+ any tool calls in between).
   * Useful for grouping related messages and pagination.
   */
  turnIndex: number;
}

// ============================================================================
// Read Options
// ============================================================================

/**
 * Options for reading history entries.
 */
export interface HistoryReadOptions {
  /** Skip this many entries from the start */
  offset?: number;

  /** Maximum number of entries to return */
  limit?: number;

  /** Filter by entry type(s) */
  types?: HistoryEntryType[];

  /** Only entries after this timestamp (epoch ms, inclusive) */
  after?: number;

  /** Only entries before this timestamp (epoch ms, inclusive) */
  before?: number;

  /** Only entries from this turn index onwards (inclusive) */
  fromTurn?: number;

  /** Only entries up to this turn index (inclusive) */
  toTurn?: number;
}

// ============================================================================
// History Journal Interface
// ============================================================================

/**
 * Append-only history journal for conversation persistence.
 *
 * Implementations:
 * - FileHistoryJournal: JSONL files at ~/.oneringai/agents/<agentId>/sessions/<sessionId>.history.jsonl
 * - (Future) MongoHistoryJournal: MongoDB collection
 * - (Future) RedisHistoryJournal: Redis Streams
 */
export interface IHistoryJournal {
  /**
   * Append entries to the journal.
   *
   * This is the primary write operation, called on every addUserMessage(),
   * addAssistantResponse(), and addToolResults(). Should be fast (append-only).
   *
   * @param sessionId - Session to append to
   * @param entries - One or more history entries to append
   */
  append(sessionId: string, entries: HistoryEntry[]): Promise<void>;

  /**
   * Read history entries with optional filtering and pagination.
   *
   * Entries are returned in chronological order (oldest first).
   *
   * @param sessionId - Session to read from
   * @param options - Filtering and pagination options
   * @returns Array of history entries
   */
  read(sessionId: string, options?: HistoryReadOptions): Promise<HistoryEntry[]>;

  /**
   * Get the total number of entries in the journal.
   *
   * @param sessionId - Session to count
   * @returns Number of entries (0 if session has no journal)
   */
  count(sessionId: string): Promise<number>;

  /**
   * Delete all history for a session.
   *
   * Called when a session is deleted via IContextStorage.delete().
   *
   * @param sessionId - Session to clear
   */
  clear(sessionId: string): Promise<void>;

  /**
   * Stream history entries for large histories.
   *
   * Optional — implementations may omit this if streaming isn't practical
   * (e.g., in-memory storage). Callers should fall back to read() with
   * pagination if stream() is not available.
   *
   * @param sessionId - Session to stream
   * @param options - Same filtering options as read()
   * @returns AsyncIterable of history entries in chronological order
   */
  stream?(sessionId: string, options?: HistoryReadOptions): AsyncIterable<HistoryEntry>;

  /**
   * Get a human-readable location string for debugging/display.
   *
   * @param sessionId - Session ID
   * @returns Location string (file path, MongoDB URI, etc.)
   */
  getLocation?(sessionId: string): string;
}
