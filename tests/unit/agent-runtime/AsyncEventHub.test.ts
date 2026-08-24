import { describe, expect, it } from 'vitest';
import { AsyncEventHub } from '@/agent-runtime/AsyncEventHub.js';
import {
  AgentEventHistoryExpiredError,
  AgentEventSubscriberOverflowError,
} from '@/agent-runtime/index.js';

describe('AsyncEventHub', () => {
  it('clones and freezes events so publishers and subscribers cannot corrupt replay', async () => {
    const hub = new AsyncEventHub('run-immutable', 'session-1', 4096);
    const source = { nested: { value: 'original' } };
    const published = hub.publish('diagnostic', source);
    source.nested.value = 'changed';
    hub.complete();

    expect(published.data).toEqual({ nested: { value: 'original' } });
    expect(Object.isFrozen(published)).toBe(true);
    expect(Object.isFrozen(published.data.nested)).toBe(true);
    expect(() => {
      (published.data.nested as { value: string }).value = 'subscriber-change';
    }).toThrow();
    expect((await collect(hub.subscribe()))[0]?.data).toEqual({ nested: { value: 'original' } });
  });

  it('rejects journal budgets too small to contain an event envelope', () => {
    expect(() => new AsyncEventHub('run-small', 'session-1', 1023)).toThrow(/at least 1024/);
  });

  it('delivers the same ordered live events to multiple subscribers', async () => {
    const hub = new AsyncEventHub('run-1', 'session-1', 4096);
    const first = collect(hub.subscribe());
    const second = collect(hub.subscribe());
    hub.publish('run.started', { driver: 'test' });
    hub.publish('agent.message.delta', { text: 'hello' });
    hub.publish('run.finished', { status: 'completed' });
    hub.complete();

    expect(await first).toEqual(await second);
    expect((await collect(hub.subscribe())).map((event) => event.sequence)).toEqual([1, 2, 3]);
  });

  it('fails only a slow overflowing subscriber and keeps retained history available', async () => {
    const hub = new AsyncEventHub('run-overflow', 'session-1', 4096, 128);
    const slow = collect(hub.subscribe());
    await Promise.resolve();
    hub.publish('diagnostic', { message: 'x'.repeat(300) });
    hub.complete();

    await expect(slow).rejects.toBeInstanceOf(AgentEventSubscriberOverflowError);
    expect((await collect(hub.subscribe())).some((event) => event.type === 'diagnostic')).toBe(true);
  });

  it('drops retained deltas under pressure, emits a gap diagnostic, and bounds large payloads', async () => {
    const hub = new AsyncEventHub('run-bounded', 'session-1', 1024);
    for (let index = 0; index < 20; index++) {
      hub.publish('agent.message.delta', { text: `${index}:${'x'.repeat(300)}` });
    }
    hub.publish('tool.completed', { id: 'tool-1', result: 'y'.repeat(10_000) });
    hub.publish('run.finished', { status: 'completed' });
    hub.complete();

    const retained = await collect(hub.subscribe());
    const gap = retained.find((event) => event.data.code === 'EVENTS_DROPPED');
    const tool = retained.find((event) => event.type === 'tool.completed');
    expect(gap?.data.droppedEvents).toBeTypeOf('number');
    expect(tool?.data).toMatchObject({ id: 'tool-1', truncated: true });
    expect(hub.retainedBytes).toBeLessThanOrEqual(1024);
  });

  it('publishes immutable replacement diagnostics as additional events are dropped', async () => {
    const hub = new AsyncEventHub('run-gap-updates', 'session-1', 1024, 64 * 1024);
    const live = collect(hub.subscribe());
    await Promise.resolve();
    for (let index = 0; index < 30; index++) {
      hub.publish('agent.message.delta', { text: `${index}:${'x'.repeat(300)}` });
    }
    hub.complete();

    const diagnostics = (await live).filter((event) => event.data.code === 'EVENTS_DROPPED');
    expect(diagnostics.length).toBeGreaterThan(1);
    const counts = diagnostics.map((event) => event.data.droppedEvents as number);
    expect(counts).toEqual([...counts].sort((left, right) => left - right));
    expect(new Set(diagnostics.map((event) => event.sequence)).size).toBe(diagnostics.length);
  });

  it('fails new subscriptions after retained history expires', () => {
    const hub = new AsyncEventHub('run-expired', 'session-1', 4096);
    hub.complete();
    hub.expire();
    expect(() => hub.subscribe()).toThrow(AgentEventHistoryExpiredError);
  });

  it('bounds non-delta floods and supports replay from a sequence cursor', async () => {
    const hub = new AsyncEventHub('run-cursor', 'session-1', 1024);
    for (let index = 0; index < 50; index++) {
      hub.publish('diagnostic', { code: `D${index}`, message: 'x'.repeat(200) });
    }
    hub.publish('run.finished', { status: 'completed' });
    hub.complete();

    expect(hub.retainedBytes).toBeLessThanOrEqual(1024);
    const retained = await collect(hub.subscribe());
    const cursor = retained.at(-2)?.sequence;
    expect(cursor).toBeDefined();
    expect((await collect(hub.subscribe({ afterSequence: cursor }))).every(
      (event) => event.sequence > cursor!,
    )).toBe(true);
    await expect(collect(hub.subscribe({ afterSequence: 0 })))
      .rejects.toBeInstanceOf(AgentEventHistoryExpiredError);
  });
});

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of source) result.push(item);
  return result;
}
