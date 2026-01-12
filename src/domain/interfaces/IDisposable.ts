/**
 * Interface for objects that manage resources and need explicit cleanup.
 *
 * Implementing classes should release all resources (event listeners, timers,
 * connections, etc.) when destroy() is called. After destruction, the instance
 * should not be used.
 */

export interface IDisposable {
  /**
   * Releases all resources held by this instance.
   *
   * After calling destroy():
   * - All event listeners should be removed
   * - All timers/intervals should be cleared
   * - All internal state should be cleaned up
   * - The instance should not be reused
   *
   * Multiple calls to destroy() should be safe (idempotent).
   */
  destroy(): void;

  /**
   * Returns true if destroy() has been called.
   * Methods should check this before performing operations.
   */
  readonly isDestroyed: boolean;
}

/**
 * Async version of IDisposable for resources requiring async cleanup.
 */
export interface IAsyncDisposable {
  /**
   * Asynchronously releases all resources held by this instance.
   */
  destroy(): Promise<void>;

  /**
   * Returns true if destroy() has been called.
   */
  readonly isDestroyed: boolean;
}

/**
 * Helper to check if an object is destroyed and throw if so.
 * @param obj - The disposable object to check
 * @param operation - Name of the operation being attempted
 */
export function assertNotDestroyed(obj: IDisposable | IAsyncDisposable, operation: string): void {
  if (obj.isDestroyed) {
    throw new Error(`Cannot ${operation}: instance has been destroyed`);
  }
}
