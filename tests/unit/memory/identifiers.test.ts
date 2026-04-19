/**
 * canonicalIdentifier + slugify helpers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { canonicalIdentifier, slugify } from '@/memory/identifiers.js';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { ScopeFilter } from '@/memory/types.js';

describe('slugify', () => {
  it('basic: lowercases, replaces spaces with dashes', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips punctuation + collapses runs', () => {
    expect(slugify('Q3 Planning!! (urgent)')).toBe('q3-planning-urgent');
  });

  it('trims leading/trailing dashes', () => {
    expect(slugify('--foo bar--')).toBe('foo-bar');
  });

  it('strips diacritics', () => {
    expect(slugify('Café München')).toBe('cafe-munchen');
  });

  it('truncates at max length, prefers word boundary', () => {
    const s = slugify('This is a very long title about budget planning and strategy', {
      maxLength: 30,
    });
    expect(s.length).toBeLessThanOrEqual(30);
    expect(s.endsWith('-')).toBe(false);
  });

  it('stable: same input → same output', () => {
    const a = slugify('Send budget by Friday');
    const b = slugify('Send budget by Friday');
    expect(a).toBe(b);
  });

  it('empty input → empty string', () => {
    expect(slugify('')).toBe('');
    expect(slugify('   ')).toBe('');
  });

  it('maxLength 0 → empty', () => {
    expect(slugify('anything', { maxLength: 0 })).toBe('');
  });
});

describe('canonicalIdentifier', () => {
  it('builds canonical kind with joined parts', () => {
    const id = canonicalIdentifier('task', {
      assignee: 'user_123',
      context: 'topic_erp',
      title: 'Send budget by Friday',
    });
    expect(id.kind).toBe('canonical');
    expect(id.value).toBe('task:user_123:topic_erp:send-budget-by-friday');
    expect(id.isPrimary).toBe(false);
  });

  it('drops undefined parts', () => {
    const id = canonicalIdentifier('task', {
      assignee: undefined,
      context: 'topic_erp',
      title: 'Review',
    });
    expect(id.value).toBe('task:topic_erp:review');
  });

  it('drops empty-string parts', () => {
    const id = canonicalIdentifier('event', {
      source: 'gcal',
      id: '',
      title: 'Q3',
    });
    expect(id.value).toBe('event:gcal:q3');
  });

  it('only slugifies the last part', () => {
    // Earlier parts preserved verbatim (they're typically entity ids)
    const id = canonicalIdentifier('task', {
      assignee: 'user_UPPER_123',
      title: 'Hello World',
    });
    expect(id.value).toBe('task:user_UPPER_123:hello-world');
  });

  it('throws on empty type', () => {
    expect(() => canonicalIdentifier('', { title: 'x' })).toThrow(/non-empty/);
  });

  it('slugifies the last NON-EMPTY value, not the last positional key', () => {
    // Regression: trailing undefined used to leave the surviving last value
    // un-slugified, producing values like "task:User X" with a space.
    const id = canonicalIdentifier('task', {
      assignee: 'user_1',
      context: 'topic_erp',
      title: 'User X',
      externalId: undefined, // trailing undefined — must not suppress slugging
    });
    expect(id.value).toBe('task:user_1:topic_erp:user-x');
  });

  it('still-slugifies when only ONE value survives after filtering', () => {
    // Single surviving value — must be slugified.
    const id = canonicalIdentifier('task', {
      assignee: undefined,
      title: 'Send Budget',
      extra: undefined,
    });
    expect(id.value).toBe('task:send-budget');
  });

  it('throws when no parts resolve to non-empty values', () => {
    expect(() => canonicalIdentifier('task', { a: undefined, b: '' })).toThrow(/at least one/);
  });

  it('round-trip: findEntitiesByIdentifier finds entity by canonical id', async () => {
    const scope: ScopeFilter = { userId: 'test-user' };
    const store = new InMemoryAdapter();
    const mem = new MemorySystem({ store });

    const id = canonicalIdentifier('task', { assignee: 'u1', title: 'Q3 plan' });
    const { entity } = await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Review Q3 plan',
        identifiers: [id],
      },
      scope,
    );

    const found = await store.findEntitiesByIdentifier('canonical', id.value, scope);
    expect(found).toHaveLength(1);
    expect(found[0]!.id).toBe(entity.id);

    // Re-extraction with the same canonical id converges on the same entity.
    const res = await mem.upsertEntityBySurface(
      { surface: 'Q3 planning review', type: 'task', identifiers: [id] },
      scope,
    );
    expect(res.resolved).toBe(true);
    expect(res.entity.id).toBe(entity.id);

    await mem.shutdown();
  });
});
