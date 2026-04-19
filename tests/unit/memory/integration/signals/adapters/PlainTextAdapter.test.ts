import { describe, it, expect } from 'vitest';
import { PlainTextAdapter } from '@/memory/integration/signals/adapters/PlainTextAdapter.js';

describe('PlainTextAdapter', () => {
  it('hands text through unchanged with no participants', () => {
    const adapter = new PlainTextAdapter();
    const out = adapter.extract({ text: 'hello world', source: 'ticket-42' });
    expect(out.signalText).toBe('hello world');
    expect(out.signalSourceDescription).toBe('ticket-42');
    expect(out.participants).toEqual([]);
  });

  it('leaves signalSourceDescription undefined when no source is passed', () => {
    const adapter = new PlainTextAdapter();
    const out = adapter.extract({ text: 'body-only' });
    expect(out.signalSourceDescription).toBeUndefined();
  });

  it('advertises kind = text', () => {
    expect(new PlainTextAdapter().kind).toBe('text');
  });
});
