/**
 * Tool context interface - passed to tools during execution
 */

import type { IdempotencyCache } from '../../capabilities/taskAgent/IdempotencyCache.js';
import type { MemoryScope, MemoryPriority } from '../entities/Memory.js';
import type { InContextMemoryPlugin } from '../../core/context/plugins/InContextMemoryPlugin.js';
import type { PersistentInstructionsPlugin } from '../../core/context/plugins/PersistentInstructionsPlugin.js';
// Type-only import to avoid circular dependency
import type { AgentContext } from '../../core/AgentContext.js';

/**
 * Limited memory access for tools
 *
 * This interface is designed to work with all agent types:
 * - Basic agents: Use simple scopes ('session', 'persistent')
 * - TaskAgent: Use task-aware scopes ({ type: 'task', taskIds: [...] })
 * - UniversalAgent: Switches between simple and task-aware based on mode
 */
export interface WorkingMemoryAccess {
  get(key: string): Promise<unknown>;

  /**
   * Store a value in memory
   *
   * @param key - Unique key for the entry
   * @param description - Short description (max 150 chars)
   * @param value - Data to store
   * @param options - Optional scope, priority, and pinning
   */
  set(
    key: string,
    description: string,
    value: unknown,
    options?: {
      /** Scope determines lifecycle - defaults to 'session' */
      scope?: MemoryScope;
      /** Base priority for eviction ordering */
      priority?: MemoryPriority;
      /** If true, entry is never evicted */
      pinned?: boolean;
    }
  ): Promise<void>;

  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;

  /**
   * List all memory entries
   * Returns key, description, and computed priority info
   */
  list(): Promise<
    Array<{
      key: string;
      description: string;
      effectivePriority?: MemoryPriority;
      pinned?: boolean;
    }>
  >;
}

/**
 * Context passed to tool execute function
 */
export interface ToolContext {
  /** Agent ID (for logging/tracing) */
  agentId: string;

  /** Task ID (if running in TaskAgent) */
  taskId?: string;

  /** Working memory access (if agent has memory feature enabled) */
  memory?: WorkingMemoryAccess;

  /**
   * AgentContext - THE source of truth for all context management
   * Use this to access budget info, prepare context, manage history, etc.
   */
  agentContext?: AgentContext;

  /** Idempotency cache (if agent has memory feature enabled) */
  idempotencyCache?: IdempotencyCache;

  /** In-context memory plugin (if features.inContextMemory is enabled) */
  inContextMemory?: InContextMemoryPlugin;

  /** Persistent instructions plugin (if features.persistentInstructions is enabled) */
  persistentInstructions?: PersistentInstructionsPlugin;

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}
