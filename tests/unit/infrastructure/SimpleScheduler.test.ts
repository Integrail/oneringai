import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimpleScheduler } from '../../../src/infrastructure/scheduling/SimpleScheduler.js';

describe('SimpleScheduler', () => {
  let scheduler: SimpleScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new SimpleScheduler();
  });

  afterEach(() => {
    scheduler.destroy();
    vi.useRealTimers();
  });

  describe('intervalMs', () => {
    it('fires callback at interval', () => {
      const cb = vi.fn();
      scheduler.schedule('test', { intervalMs: 1000 }, cb);

      vi.advanceTimersByTime(3500);
      expect(cb).toHaveBeenCalledTimes(3);
    });

    it('can be cancelled via handle', () => {
      const cb = vi.fn();
      const handle = scheduler.schedule('test', { intervalMs: 1000 }, cb);

      vi.advanceTimersByTime(1500);
      expect(cb).toHaveBeenCalledTimes(1);

      handle.cancel();
      vi.advanceTimersByTime(3000);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('once', () => {
    it('fires callback once at specified time', () => {
      const cb = vi.fn();
      const futureTime = Date.now() + 5000;
      scheduler.schedule('once-test', { once: futureTime }, cb);

      vi.advanceTimersByTime(4999);
      expect(cb).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(cb).toHaveBeenCalledTimes(1);

      // Should not fire again
      vi.advanceTimersByTime(10000);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('fires immediately if time is in the past', () => {
      const cb = vi.fn();
      scheduler.schedule('past', { once: Date.now() - 1000 }, cb);

      vi.advanceTimersByTime(0);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('cron', () => {
    it('throws for cron expressions', () => {
      expect(() =>
        scheduler.schedule('cron-test', { cron: '0 9 * * *' }, () => {}),
      ).toThrow(/SimpleScheduler does not support cron/);
    });
  });

  describe('cancel', () => {
    it('cancels by ID', () => {
      const cb = vi.fn();
      scheduler.schedule('x', { intervalMs: 100 }, cb);
      scheduler.cancel('x');

      vi.advanceTimersByTime(500);
      expect(cb).not.toHaveBeenCalled();
      expect(scheduler.has('x')).toBe(false);
    });

    it('cancelAll clears everything', () => {
      scheduler.schedule('a', { intervalMs: 100 }, vi.fn());
      scheduler.schedule('b', { intervalMs: 200 }, vi.fn());

      scheduler.cancelAll();
      expect(scheduler.has('a')).toBe(false);
      expect(scheduler.has('b')).toBe(false);
    });
  });

  describe('has', () => {
    it('returns true for existing schedule', () => {
      scheduler.schedule('exists', { intervalMs: 1000 }, vi.fn());
      expect(scheduler.has('exists')).toBe(true);
    });

    it('returns false for non-existing schedule', () => {
      expect(scheduler.has('nope')).toBe(false);
    });
  });

  describe('destroy', () => {
    it('clears all timers', () => {
      scheduler.schedule('a', { intervalMs: 100 }, vi.fn());
      scheduler.destroy();
      expect(scheduler.isDestroyed).toBe(true);
    });

    it('throws on schedule after destroy', () => {
      scheduler.destroy();
      expect(() =>
        scheduler.schedule('x', { intervalMs: 100 }, vi.fn()),
      ).toThrow(/destroyed/);
    });
  });

  describe('replaces existing schedule with same ID', () => {
    it('replaces previous timer', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      scheduler.schedule('dup', { intervalMs: 100 }, cb1);
      scheduler.schedule('dup', { intervalMs: 100 }, cb2);

      vi.advanceTimersByTime(150);
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  describe('no spec provided', () => {
    it('throws if no schedule type given', () => {
      expect(() =>
        scheduler.schedule('empty', {}, vi.fn()),
      ).toThrow(/must have at least one/);
    });
  });
});
