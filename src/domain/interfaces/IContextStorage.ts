/**
 * IContextStorage - Storage interface for AgentContext persistence
 *
 * Provides persistence operations for AgentContext sessions.
 * Implementations can use filesystem, database, cloud storage, etc.
 *
 * This follows Clean Architecture - the interface is in domain layer,
 * implementations are in infrastructure layer.
 */

import type { InputItem } from '../entities/Message.js';

/**
 * Serialized context state for persistence.
 * This is the canonical definition - core layer re-exports this type.
 */
export interface SerializedContextState {
  /** Conversation history */
  conversation: InputItem[];
  /** Plugin states (keyed by plugin name) */
  pluginStates: Record<string, unknown>;
  /** System prompt */
  systemPrompt?: string;
  /** Metadata */
  metadata: {
    savedAt: number;
    agentId?: string;
    userId?: string;
    model: string;
  };
  /** Agent-specific state (for TaskAgent, UniversalAgent, etc.) */
  agentState?: Record<string, unknown>;
}


/**
 * Session summary for listing (lightweight, no full state)
 */
export interface ContextSessionSummary {
  /** Session identifier */
  sessionId: string;

  /** When the session was created */
  createdAt: Date;

  /** When the session was last saved */
  lastSavedAt: Date;

  /** Number of messages in history */
  messageCount: number;

  /** Number of memory entries */
  memoryEntryCount: number;

  /** Optional metadata */
  metadata?: ContextSessionMetadata;
}

/**
 * Session metadata (stored with session)
 */
export interface ContextSessionMetadata {
  /** Human-readable title */
  title?: string;

  /** Auto-generated or user-provided description */
  description?: string;

  /** Tags for filtering */
  tags?: string[];

  /** Custom key-value data */
  [key: string]: unknown;
}

/**
 * Full session state wrapper (includes metadata)
 */
export interface StoredContextSession {
  /** Format version for migration support */
  version: number;

  /** Session identifier */
  sessionId: string;

  /** When the session was created */
  createdAt: string; // ISO string

  /** When the session was last saved */
  lastSavedAt: string; // ISO string

  /** The serialized AgentContext state */
  state: SerializedContextState;

  /** Session metadata */
  metadata: ContextSessionMetadata;
}

/**
 * Current format version for stored sessions
 */
export const CONTEXT_SESSION_FORMAT_VERSION = 1;

/**
 * Storage interface for AgentContext persistence
 *
 * Implementations:
 * - FileContextStorage: File-based storage at ~/.oneringai/agents/<agentId>/sessions/
 * - (Future) RedisContextStorage, PostgresContextStorage, S3ContextStorage, etc.
 */
export interface IContextStorage {
  /**
   * Save context state to a session
   *
   * @param sessionId - Unique session identifier
   * @param state - Serialized AgentContext state
   * @param metadata - Optional session metadata
   */
  save(
    sessionId: string,
    state: SerializedContextState,
    metadata?: ContextSessionMetadata
  ): Promise<void>;

  /**
   * Load context state from a session
   *
   * @param sessionId - Session identifier to load
   * @returns The stored session, or null if not found
   */
  load(sessionId: string): Promise<StoredContextSession | null>;

  /**
   * Delete a session
   *
   * @param sessionId - Session identifier to delete
   */
  delete(sessionId: string): Promise<void>;

  /**
   * Check if a session exists
   *
   * @param sessionId - Session identifier to check
   */
  exists(sessionId: string): Promise<boolean>;

  /**
   * List all sessions (summaries only, not full state)
   *
   * @param options - Optional filtering and pagination
   * @returns Array of session summaries, sorted by lastSavedAt descending
   */
  list(options?: ContextStorageListOptions): Promise<ContextSessionSummary[]>;

  /**
   * Update session metadata without loading full state
   *
   * @param sessionId - Session identifier
   * @param metadata - Metadata to merge (existing keys preserved unless overwritten)
   */
  updateMetadata?(
    sessionId: string,
    metadata: Partial<ContextSessionMetadata>
  ): Promise<void>;

  /**
   * Get the storage path/location (for display/debugging)
   */
  getPath(): string;
}

/**
 * Options for listing sessions
 */
export interface ContextStorageListOptions {
  /** Filter by tags (any match) */
  tags?: string[];

  /** Filter by creation date range */
  createdAfter?: Date;
  createdBefore?: Date;

  /** Filter by last saved date range */
  savedAfter?: Date;
  savedBefore?: Date;

  /** Maximum number of results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}
