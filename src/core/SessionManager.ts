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

import { EventEmitter } from 'eventemitter3';
import type { SerializedToolState } from './ToolManager.js';
import type { SerializedApprovalState } from './permissions/types.js';
import type { MemoryScope, MemoryPriority } from '../domain/entities/Memory.js';

// ============================================================================
// Version Constants
// ============================================================================

/** Current session format version */
export const SESSION_FORMAT_VERSION = 1;
/** Current history format version */
export const HISTORY_FORMAT_VERSION = 1;
/** Current memory format version */
export const MEMORY_FORMAT_VERSION = 1;
/** Current plan format version */
export const PLAN_FORMAT_VERSION = 1;

// ============================================================================
// Validation Types
// ============================================================================

export interface SessionValidationResult {
  /** Whether the session is valid */
  valid: boolean;
  /** Validation errors (critical issues) */
  errors: string[];
  /** Validation warnings (non-critical issues) */
  warnings: string[];
  /** Whether the session can be migrated to fix issues */
  canMigrate: boolean;
  /** Suggested migrations */
  migrations: SessionMigration[];
}

export interface SessionMigration {
  /** Field to migrate */
  field: string;
  /** Type of migration */
  type: 'add_default' | 'upgrade_version' | 'fix_type';
  /** Description of the migration */
  description: string;
  /** Function to apply the migration */
  apply: (session: Partial<Session>) => void;
}

/**
 * Error thrown when session validation fails
 */
export class SessionValidationError extends Error {
  constructor(
    public readonly sessionId: string,
    public readonly errors: string[]
  ) {
    super(`Session validation failed for ${sessionId}: ${errors.join(', ')}`);
    this.name = 'SessionValidationError';
  }
}

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
  scope: MemoryScope;
  sizeBytes: number;
  basePriority?: MemoryPriority;
  pinned?: boolean;
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
  | 'session:error'
  | 'session:warning'
  | 'session:migrated';

export interface SessionManagerConfig {
  storage: ISessionStorage;
  /** Default metadata for new sessions */
  defaultMetadata?: Partial<SessionMetadata>;
  /** Validate sessions on load (default: true) */
  validateOnLoad?: boolean;
  /** Auto-migrate sessions with fixable issues (default: true) */
  autoMigrate?: boolean;
}

// ============================================================================
// Session Validation
// ============================================================================

/**
 * Validate a session object and return validation results
 */
export function validateSession(session: unknown): SessionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const migrations: SessionMigration[] = [];

  // Check if session is an object
  if (!session || typeof session !== 'object') {
    return {
      valid: false,
      errors: ['Session is not an object'],
      warnings: [],
      canMigrate: false,
      migrations: [],
    };
  }

  const s = session as Partial<Session>;

  // Required fields check
  if (!s.id || typeof s.id !== 'string') {
    errors.push('Missing or invalid session id');
  }

  if (!s.agentType || typeof s.agentType !== 'string') {
    errors.push('Missing or invalid agentType');
  }

  // Date fields (can be strings from JSON)
  if (!s.createdAt) {
    warnings.push('Missing createdAt, will use current time');
    migrations.push({
      field: 'createdAt',
      type: 'add_default',
      description: 'Add default createdAt timestamp',
      apply: (sess) => {
        sess.createdAt = new Date();
      },
    });
  }

  if (!s.lastActiveAt) {
    warnings.push('Missing lastActiveAt, will use current time');
    migrations.push({
      field: 'lastActiveAt',
      type: 'add_default',
      description: 'Add default lastActiveAt timestamp',
      apply: (sess) => {
        sess.lastActiveAt = new Date();
      },
    });
  }

  // History validation
  if (!s.history) {
    warnings.push('Missing history, will create empty history');
    migrations.push({
      field: 'history',
      type: 'add_default',
      description: 'Add empty history',
      apply: (sess) => {
        sess.history = { version: HISTORY_FORMAT_VERSION, entries: [] };
      },
    });
  } else if (typeof s.history === 'object') {
    const historyVersion = (s.history as SerializedHistory).version;
    if (historyVersion === undefined) {
      warnings.push('History missing version, assuming version 1');
      migrations.push({
        field: 'history.version',
        type: 'add_default',
        description: 'Add history version',
        apply: (sess) => {
          if (sess.history) {
            (sess.history as SerializedHistory).version = 1;
          }
        },
      });
    } else if (historyVersion > HISTORY_FORMAT_VERSION) {
      errors.push(
        `History version ${historyVersion} is newer than supported version ${HISTORY_FORMAT_VERSION}`
      );
    }
  }

  // ToolState validation
  if (!s.toolState) {
    warnings.push('Missing toolState, will create empty toolState');
    migrations.push({
      field: 'toolState',
      type: 'add_default',
      description: 'Add empty toolState',
      apply: (sess) => {
        sess.toolState = { enabled: {}, namespaces: {}, priorities: {}, permissions: {} };
      },
    });
  }

  // Custom object validation
  if (!s.custom || typeof s.custom !== 'object') {
    warnings.push('Missing custom object, will create empty object');
    migrations.push({
      field: 'custom',
      type: 'add_default',
      description: 'Add empty custom object',
      apply: (sess) => {
        sess.custom = {};
      },
    });
  }

  // Metadata validation
  if (!s.metadata || typeof s.metadata !== 'object') {
    warnings.push('Missing metadata, will create empty metadata');
    migrations.push({
      field: 'metadata',
      type: 'add_default',
      description: 'Add empty metadata',
      apply: (sess) => {
        sess.metadata = {};
      },
    });
  }

  // Optional: Memory validation (if present)
  if (s.memory && typeof s.memory === 'object') {
    const memoryVersion = (s.memory as SerializedMemory).version;
    if (memoryVersion === undefined) {
      warnings.push('Memory missing version, assuming version 1');
      migrations.push({
        field: 'memory.version',
        type: 'add_default',
        description: 'Add memory version',
        apply: (sess) => {
          if (sess.memory) {
            (sess.memory as SerializedMemory).version = 1;
          }
        },
      });
    } else if (memoryVersion > MEMORY_FORMAT_VERSION) {
      errors.push(
        `Memory version ${memoryVersion} is newer than supported version ${MEMORY_FORMAT_VERSION}`
      );
    }
  }

  // Optional: Plan validation (if present)
  if (s.plan && typeof s.plan === 'object') {
    const planVersion = (s.plan as SerializedPlan).version;
    if (planVersion === undefined) {
      warnings.push('Plan missing version, assuming version 1');
      migrations.push({
        field: 'plan.version',
        type: 'add_default',
        description: 'Add plan version',
        apply: (sess) => {
          if (sess.plan) {
            (sess.plan as SerializedPlan).version = 1;
          }
        },
      });
    } else if (planVersion > PLAN_FORMAT_VERSION) {
      errors.push(
        `Plan version ${planVersion} is newer than supported version ${PLAN_FORMAT_VERSION}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    canMigrate: errors.length === 0 && migrations.length > 0,
    migrations,
  };
}

/**
 * Apply migrations to a session
 */
export function migrateSession(
  session: Partial<Session>,
  migrations: SessionMigration[]
): Session {
  for (const migration of migrations) {
    migration.apply(session);
  }
  return session as Session;
}

export class SessionManager extends EventEmitter {
  private storage: ISessionStorage;
  private defaultMetadata: Partial<SessionMetadata>;
  private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map();
  private validateOnLoad: boolean;
  private autoMigrate: boolean;

  // Track in-flight saves to prevent race conditions
  private savesInFlight: Set<string> = new Set();
  private pendingSaves: Set<string> = new Set();

  constructor(config: SessionManagerConfig) {
    super();
    this.storage = config.storage;
    this.defaultMetadata = config.defaultMetadata ?? {};
    this.validateOnLoad = config.validateOnLoad ?? true;
    this.autoMigrate = config.autoMigrate ?? true;
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
      let session = await this.storage.load(sessionId);
      if (!session) {
        return null;
      }

      // Validate session if enabled
      if (this.validateOnLoad) {
        const validation = validateSession(session);

        // Log warnings
        if (validation.warnings.length > 0) {
          this.emit('session:warning', {
            sessionId,
            warnings: validation.warnings,
          });
        }

        // Handle validation errors
        if (!validation.valid) {
          throw new SessionValidationError(sessionId, validation.errors);
        }

        // Apply migrations if needed and enabled
        if (validation.canMigrate && this.autoMigrate) {
          session = migrateSession(session, validation.migrations);
          this.emit('session:migrated', {
            sessionId,
            migrations: validation.migrations.map((m) => m.description),
          });
        }
      }

      // Ensure dates are Date objects (might be strings from JSON)
      session.createdAt = new Date(session.createdAt);
      session.lastActiveAt = new Date(session.lastActiveAt);

      this.emit('session:loaded', { sessionId });
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
      const sessionId = session.id;

      // Skip if a save is already in-flight for this session
      if (this.savesInFlight.has(sessionId)) {
        this.pendingSaves.add(sessionId);
        return;
      }

      this.savesInFlight.add(sessionId);

      try {
        await this.save(session);
        onSave?.(session);
      } catch (error) {
        this.emit('session:error', {
          sessionId,
          error,
          operation: 'auto-save',
        });
      } finally {
        this.savesInFlight.delete(sessionId);

        // If a save was pending while we were saving, do another save
        if (this.pendingSaves.has(sessionId)) {
          this.pendingSaves.delete(sessionId);
          // Schedule an immediate save (async, don't await)
          this.save(session).catch((error) => {
            this.emit('session:error', {
              sessionId,
              error,
              operation: 'auto-save-retry',
            });
          });
        }
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
