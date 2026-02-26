/**
 * SimpleScheduler — built-in scheduler using setInterval / setTimeout.
 *
 * Supports `intervalMs` and `once` schedule types.
 * Throws for `cron` — use a cron-capable implementation instead.
 */

import type { IScheduler, ScheduleHandle, ScheduleSpec } from '../../domain/interfaces/IScheduler.js';

export class SimpleScheduler implements IScheduler {
  private timers = new Map<string, { timer: ReturnType<typeof setTimeout>; type: 'interval' | 'timeout' }>();
  private _isDestroyed = false;

  schedule(id: string, spec: ScheduleSpec, callback: () => void | Promise<void>): ScheduleHandle {
    if (this._isDestroyed) throw new Error('Scheduler has been destroyed');

    if (spec.cron) {
      throw new Error(
        `SimpleScheduler does not support cron expressions. ` +
        `Use a cron-capable scheduler implementation (e.g. node-cron, croner) or ` +
        `convert to intervalMs.`,
      );
    }

    if (this.timers.has(id)) {
      this.cancel(id);
    }

    if (spec.intervalMs != null) {
      const timer = setInterval(() => {
        try {
          const result = callback();
          if (result && typeof (result as Promise<void>).catch === 'function') {
            (result as Promise<void>).catch(() => {});
          }
        } catch { /* swallow */ }
      }, spec.intervalMs);
      this.timers.set(id, { timer, type: 'interval' });
    } else if (spec.once != null) {
      const delay = Math.max(0, spec.once - Date.now());
      const timer = setTimeout(() => {
        this.timers.delete(id);
        try {
          const result = callback();
          if (result && typeof (result as Promise<void>).catch === 'function') {
            (result as Promise<void>).catch(() => {});
          }
        } catch { /* swallow */ }
      }, delay);
      this.timers.set(id, { timer, type: 'timeout' });
    } else {
      throw new Error('ScheduleSpec must have at least one of: cron, intervalMs, once');
    }

    return {
      id,
      cancel: () => this.cancel(id),
    };
  }

  cancel(id: string): void {
    const entry = this.timers.get(id);
    if (!entry) return;

    if (entry.type === 'interval') {
      clearInterval(entry.timer);
    } else {
      clearTimeout(entry.timer);
    }
    this.timers.delete(id);
  }

  cancelAll(): void {
    for (const [id] of this.timers) {
      this.cancel(id);
    }
  }

  has(id: string): boolean {
    return this.timers.has(id);
  }

  destroy(): void {
    if (this._isDestroyed) return;
    this.cancelAll();
    this._isDestroyed = true;
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }
}
