/**
 * SessionManager - Unified session persistence for all agent types
 *
 * Provides session management capabilities:
 * - Create, save, load, delete sessions
 * - Auto-save functionality
 * - Session metadata and filtering
 * - Pluggable storage backends
 *
 * Works with Agent, TaskAgent, and UniversalAgent
 */

import { EventEmitter } from 'events';
import type { SerializedToolState } from './ToolManager.js';
import type { SerializedApprovalState } from './permissions/types.js';

// ============================================================================
// Types
// ============================================================================

export interface Session {
  /** Unique session identifier */
  id: string;
  /** Type of agent that owns this session */
  agentType: 'agent' | 'task-agent' | 'universal-agent' | string;
  /** When the session was created */
  createdAt: Date;
  /** Last activity timestamp */
  lastActiveAt: Date;

  // --- Shared State (all agents) ---

  /** Serialized conversation history */
  history: SerializedHistory;
  /** Tool enabled/disabled state */
  toolState: SerializedToolState;

  // --- Optional State (depends on agent type) ---

  /** Working memory contents (TaskAgent, UniversalAgent) */
  memory?: SerializedMemory;
  /** Current plan (TaskAgent, UniversalAgent) */
  plan?: SerializedPlan;
  /** Current mode (UniversalAgent) */
  mode?: string;
  /** Execution metrics */
  metrics?: SessionMetrics;
  /** Tool permission approval state (all agent types) */
  approvalState?: SerializedApprovalState;

  // --- Custom State ---

  /** Agent-specific custom data */
  custom: Record<string, unknown>;

  // --- Metadata ---

  metadata: SessionMetadata;
}

export interface SessionMetadata {
  /** Optional user identifier */
  userId?: string;
  /** Human-readable title */
  title?: string;
  /** Tags for filtering */
  tags?: string[];
  /** Custom metadata */
  [key: string]: unknown;
}

export interface SessionMetrics {
  totalMessages: number;
  totalToolCalls: number;
  totalTokens: number;
  totalDurationMs: number;
}

export interface SerializedHistory {
  /** History format version */
  version: number;
  /** Serialized history entries */
  entries: SerializedHistoryEntry[];
}

export interface SerializedHistoryEntry {
  type: 'user' | 'assistant' | 'tool_result' | 'system' | 'task_event' | 'plan_event';
  content: unknown;
  timestamp: string; // ISO string
  metadata?: Record<string, unknown>;
}

export interface SerializedMemory {
  /** Memory format version */
  version: number;
  /** Serialized memory entries */
  entries: SerializedMemoryEntry[];
}

export interface SerializedMemoryEntry {
  key: string;
  description: string;
  value: unknown;
  scope: 'task' | 'persistent';
  sizeBytes: number;
}

export interface SerializedPlan {
  /** Plan format version */
  version: number;
  /** Plan data */
  data: unknown;
}

export interface SessionFilter {
  /** Filter by agent type */
  agentType?: string;
  /** Filter by user ID */
  userId?: string;
  /** Filter by tags (any match) */
  tags?: string[];
  /** Filter by creation date range */
  createdAfter?: Date;
  createdBefore?: Date;
  /** Filter by last active date range */
  activeAfter?: Date;
  activeBefore?: Date;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

export interface SessionSummary {
  id: string;
  agentType: string;
  createdAt: Date;
  lastActiveAt: Date;
  metadata: SessionMetadata;
  messageCount: number;
}

// ============================================================================
// Storage Interface
// ============================================================================

export interface ISessionStorage {
  /**
   * Save a session (create or update)
   */
  save(session: Session): Promise<void>;

  /**
   * Load a session by ID
   */
  load(sessionId: string): Promise<Session | null>;

  /**
   * Delete a session by ID
   */
  delete(sessionId: string): Promise<void>;

  /**
   * Check if a session exists
   */
  exists(sessionId: string): Promise<boolean>;

  /**
   * List sessions with optional filtering
   */
  list(filter?: SessionFilter): Promise<SessionSummary[]>;

  /**
   * Search sessions by query string (searches title, tags, metadata)
   */
  search?(query: string, filter?: SessionFilter): Promise<SessionSummary[]>;
}

// ============================================================================
// SessionManager Class
// ============================================================================

export type SessionManagerEvent =
  | 'session:created'
  | 'session:saved'
  | 'session:loaded'
  | 'session:deleted'
  | 'session:error';

export interface SessionManagerConfig {
  storage: ISessionStorage;
  /** Default metadata for new sessions */
  defaultMetadata?: Partial<SessionMetadata>;
}

export class SessionManager extends EventEmitter {
  private storage: ISessionStorage;
  private defaultMetadata: Partial<SessionMetadata>;
  private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: SessionManagerConfig) {
    super();
    this.storage = config.storage;
    this.defaultMetadata = config.defaultMetadata ?? {};
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Create a new session
   */
  create(agentType: string, metadata?: SessionMetadata): Session {
    const now = new Date();
    const session: Session = {
      id: this.generateId(),
      agentType,
      createdAt: now,
      lastActiveAt: now,
      history: { version: 1, entries: [] },
      toolState: { enabled: {}, namespaces: {}, priorities: {} },
      custom: {},
      metadata: {
        ...this.defaultMetadata,
        ...metadata,
      },
    };

    this.emit('session:created', { sessionId: session.id, agentType });
    return session;
  }

  /**
   * Save a session to storage
   */
  async save(session: Session): Promise<void> {
    try {
      session.lastActiveAt = new Date();
      await this.storage.save(session);
      this.emit('session:saved', { sessionId: session.id });
    } catch (error) {
      this.emit('session:error', { sessionId: session.id, error, operation: 'save' });
      throw error;
    }
  }

  /**
   * Load a session from storage
   */
  async load(sessionId: string): Promise<Session | null> {
    try {
      const session = await this.storage.load(sessionId);
      if (session) {
        // Ensure dates are Date objects (might be strings from JSON)
        session.createdAt = new Date(session.createdAt);
        session.lastActiveAt = new Date(session.lastActiveAt);
        this.emit('session:loaded', { sessionId });
      }
      return session;
    } catch (error) {
      this.emit('session:error', { sessionId, error, operation: 'load' });
      throw error;
    }
  }

  /**
   * Delete a session from storage
   */
  async delete(sessionId: string): Promise<void> {
    try {
      this.stopAutoSave(sessionId);
      await this.storage.delete(sessionId);
      this.emit('session:deleted', { sessionId });
    } catch (error) {
      this.emit('session:error', { sessionId, error, operation: 'delete' });
      throw error;
    }
  }

  /**
   * Check if a session exists
   */
  async exists(sessionId: string): Promise<boolean> {
    return this.storage.exists(sessionId);
  }

  // ==========================================================================
  // Query
  // ==========================================================================

  /**
   * List sessions with optional filtering
   */
  async list(filter?: SessionFilter): Promise<SessionSummary[]> {
    return this.storage.list(filter);
  }

  /**
   * Search sessions by query string
   */
  async search(query: string, filter?: SessionFilter): Promise<SessionSummary[]> {
    if (this.storage.search) {
      return this.storage.search(query, filter);
    }
    // Fallback: filter by title containing query
    const all = await this.storage.list(filter);
    const lowerQuery = query.toLowerCase();
    return all.filter(
      (s) =>
        s.metadata.title?.toLowerCase().includes(lowerQuery) ||
        s.metadata.tags?.some((t) => t.toLowerCase().includes(lowerQuery))
    );
  }

  // ==========================================================================
  // Advanced Operations
  // ==========================================================================

  /**
   * Fork a session (create a copy with new ID)
   */
  async fork(sessionId: string, newMetadata?: Partial<SessionMetadata>): Promise<Session> {
    const original = await this.load(sessionId);
    if (!original) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const forked: Session = {
      ...original,
      id: this.generateId(),
      createdAt: new Date(),
      lastActiveAt: new Date(),
      metadata: {
        ...original.metadata,
        ...newMetadata,
        forkedFrom: sessionId,
      },
      // Deep clone mutable fields
      history: JSON.parse(JSON.stringify(original.history)),
      toolState: JSON.parse(JSON.stringify(original.toolState)),
      custom: JSON.parse(JSON.stringify(original.custom)),
    };

    if (original.memory) {
      forked.memory = JSON.parse(JSON.stringify(original.memory));
    }
    if (original.plan) {
      forked.plan = JSON.parse(JSON.stringify(original.plan));
    }

    await this.save(forked);
    return forked;
  }

  /**
   * Update session metadata
   */
  async updateMetadata(
    sessionId: string,
    metadata: Partial<SessionMetadata>
  ): Promise<void> {
    const session = await this.load(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.metadata = { ...session.metadata, ...metadata };
    await this.save(session);
  }

  // ==========================================================================
  // Auto-Save
  // ==========================================================================

  /**
   * Enable auto-save for a session
   */
  enableAutoSave(
    session: Session,
    intervalMs: number,
    onSave?: (session: Session) => void
  ): void {
    this.stopAutoSave(session.id);

    const timer = setInterval(async () => {
      try {
        await this.save(session);
        onSave?.(session);
      } catch (error) {
        this.emit('session:error', {
          sessionId: session.id,
          error,
          operation: 'auto-save',
        });
      }
    }, intervalMs);

    this.autoSaveTimers.set(session.id, timer);
  }

  /**
   * Disable auto-save for a session
   */
  stopAutoSave(sessionId: string): void {
    const timer = this.autoSaveTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.autoSaveTimers.delete(sessionId);
    }
  }

  /**
   * Stop all auto-save timers
   */
  stopAllAutoSave(): void {
    for (const timer of this.autoSaveTimers.values()) {
      clearInterval(timer);
    }
    this.autoSaveTimers.clear();
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Generate a unique session ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `sess_${timestamp}_${random}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAllAutoSave();
    this.removeAllListeners();
  }
}

// ============================================================================
// Session Helpers
// ============================================================================

/**
 * Create an empty serialized history
 */
export function createEmptyHistory(): SerializedHistory {
  return { version: 1, entries: [] };
}

/**
 * Create an empty serialized memory
 */
export function createEmptyMemory(): SerializedMemory {
  return { version: 1, entries: [] };
}

/**
 * Add an entry to serialized history
 */
export function addHistoryEntry(
  history: SerializedHistory,
  type: SerializedHistoryEntry['type'],
  content: unknown,
  metadata?: Record<string, unknown>
): void {
  history.entries.push({
    type,
    content,
    timestamp: new Date().toISOString(),
    metadata,
  });
}
