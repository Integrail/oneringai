import { describe, it, expect, vi } from 'vitest';
import { EventEmitterTrigger } from '../../../src/infrastructure/triggers/EventEmitterTrigger.js';

describe('EventEmitterTrigger', () => {
  it('delivers events to listeners', () => {
    const trigger = new EventEmitterTrigger();
    const cb = vi.fn();

    trigger.on('test-event', cb);
    trigger.emit('test-event', { data: 42 });

    expect(cb).toHaveBeenCalledWith({ data: 42 });
    trigger.destroy();
  });

  it('supports multiple listeners per event', () => {
    const trigger = new EventEmitterTrigger();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    trigger.on('evt', cb1);
    trigger.on('evt', cb2);
    trigger.emit('evt', 'hello');

    expect(cb1).toHaveBeenCalledWith('hello');
    expect(cb2).toHaveBeenCalledWith('hello');
    trigger.destroy();
  });

  it('returns unsubscribe function', () => {
    const trigger = new EventEmitterTrigger();
    const cb = vi.fn();

    const unsub = trigger.on('evt', cb);
    trigger.emit('evt');
    expect(cb).toHaveBeenCalledTimes(1);

    unsub();
    trigger.emit('evt');
    expect(cb).toHaveBeenCalledTimes(1);
    trigger.destroy();
  });

  it('does not emit after destroy', () => {
    const trigger = new EventEmitterTrigger();
    const cb = vi.fn();

    trigger.on('evt', cb);
    trigger.destroy();
    trigger.emit('evt');

    expect(cb).not.toHaveBeenCalled();
    expect(trigger.isDestroyed).toBe(true);
  });

  it('throws on subscribe after destroy', () => {
    const trigger = new EventEmitterTrigger();
    trigger.destroy();

    expect(() => trigger.on('evt', vi.fn())).toThrow(/destroyed/);
  });

  it('handles emit with no listeners gracefully', () => {
    const trigger = new EventEmitterTrigger();
    expect(() => trigger.emit('nonexistent')).not.toThrow();
    trigger.destroy();
  });

  it('swallows listener errors', () => {
    const trigger = new EventEmitterTrigger();
    const good = vi.fn();

    trigger.on('evt', () => { throw new Error('boom'); });
    trigger.on('evt', good);
    trigger.emit('evt');

    expect(good).toHaveBeenCalled();
    trigger.destroy();
  });

  it('emits with undefined payload when no payload given', () => {
    const trigger = new EventEmitterTrigger();
    const cb = vi.fn();

    trigger.on('evt', cb);
    trigger.emit('evt');

    expect(cb).toHaveBeenCalledWith(undefined);
    trigger.destroy();
  });
});
