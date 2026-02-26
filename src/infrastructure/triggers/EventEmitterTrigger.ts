/**
 * EventEmitterTrigger — simple typed event emitter for routine triggers.
 *
 * Consumers call `emit()` from their webhook/queue/signal handlers
 * to trigger routine execution.
 */

import type { IDisposable } from '../../domain/interfaces/IDisposable.js';

export class EventEmitterTrigger implements IDisposable {
  private listeners = new Map<string, Set<(payload: unknown) => void | Promise<void>>>();
  private _isDestroyed = false;

  /**
   * Register a listener for an event. Returns an unsubscribe function.
   */
  on(event: string, callback: (payload: unknown) => void | Promise<void>): () => void {
    if (this._isDestroyed) throw new Error('EventEmitterTrigger has been destroyed');

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit an event to all registered listeners.
   */
  emit(event: string, payload?: unknown): void {
    if (this._isDestroyed) return;

    const callbacks = this.listeners.get(event);
    if (!callbacks) return;

    for (const cb of callbacks) {
      try {
        const result = cb(payload);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(() => {});
        }
      } catch { /* swallow listener errors */ }
    }
  }

  destroy(): void {
    if (this._isDestroyed) return;
    this.listeners.clear();
    this._isDestroyed = true;
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }
}
