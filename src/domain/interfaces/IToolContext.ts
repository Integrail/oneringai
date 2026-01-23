/**
 * Tool context interface - passed to tools during execution
 */

import type { ContextManager } from '../../capabilities/taskAgent/ContextManager.js';
import type { IdempotencyCache } from '../../capabilities/taskAgent/IdempotencyCache.js';

/**
 * Limited memory access for tools
 */
export interface WorkingMemoryAccess {
  get(key: string): Promise<unknown>;
  set(key: string, description: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  list(): Promise<Array<{ key: string; description: string }>>;
}

/**
 * Context passed to tool execute function
 */
export interface ToolContext {
  /** Agent ID (for logging/tracing) */
  agentId: string;

  /** Task ID (if running in TaskAgent) */
  taskId?: string;

  /** Working memory access (if running in TaskAgent) */
  memory?: WorkingMemoryAccess;

  /** Context manager (if running in TaskAgent) */
  contextManager?: ContextManager;

  /** Idempotency cache (if running in TaskAgent) */
  idempotencyCache?: IdempotencyCache;

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}
