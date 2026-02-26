/**
 * Scheduler interface for running routines on a timer.
 *
 * Supports interval, one-time (timestamp), and cron schedules.
 * Implementations may support all or a subset of schedule types.
 */

import type { IDisposable } from './IDisposable.js';

export interface ScheduleHandle {
  id: string;
  cancel(): void;
}

export interface ScheduleSpec {
  /** Cron expression (e.g. '0 9 * * 1-5'). Not all implementations support this. */
  cron?: string;
  /** Repeat every N milliseconds. */
  intervalMs?: number;
  /** Fire once at this Unix timestamp (ms). */
  once?: number;
  /** IANA timezone for cron expressions (e.g. 'America/New_York'). */
  timezone?: string;
}

export interface IScheduler extends IDisposable {
  /** Schedule a callback. Returns a handle to cancel it. */
  schedule(id: string, spec: ScheduleSpec, callback: () => void | Promise<void>): ScheduleHandle;
  /** Cancel a scheduled callback by ID. */
  cancel(id: string): void;
  /** Cancel all scheduled callbacks. */
  cancelAll(): void;
  /** Check if a schedule exists by ID. */
  has(id: string): boolean;
}
