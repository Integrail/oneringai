/**
 * Tests for scope filter translation — verifies the Mongo-side expression of
 * our visibility rule matches the in-memory behavior.
 */

import { describe, it, expect } from 'vitest';
import { scopeToFilter, mergeFilters } from '@/memory/adapters/mongo/scopeFilter.js';

describe('scopeToFilter', () => {
  it('returns both clauses for a fully-specified caller', () => {
    const f = scopeToFilter({ groupId: 'g1', userId: 'u1' });
    expect(f).toHaveProperty('$and');
    const andClauses = (f as { $and: unknown[] }).$and;
    expect(andClauses).toHaveLength(2);
  });

  it('allows null groupId and matching groupId when scope.groupId set', () => {
    const f = scopeToFilter({ groupId: 'g1' });
    const serialized = JSON.stringify(f);
    expect(serialized).toContain('g1');
    expect(serialized).toContain('null');
  });

  it('when scope.groupId absent, only null/missing groupId accepted', () => {
    const f = scopeToFilter({ userId: 'u1' });
    const serialized = JSON.stringify(f);
    // Shouldn't match any specific groupId value — only allow missing/null.
    expect(serialized).not.toMatch(/"groupId":"[^n]/);
  });

  it('when scope empty, only global records allowed', () => {
    const f = scopeToFilter({});
    const s = JSON.stringify(f);
    expect(s).toContain('null');
    expect(s).not.toMatch(/groupId":"[^n]/);
    expect(s).not.toMatch(/ownerId":"[^n]/);
  });
});

describe('mergeFilters', () => {
  it('returns empty object for all empty inputs', () => {
    expect(mergeFilters()).toEqual({});
    expect(mergeFilters(null, undefined, {})).toEqual({});
  });

  it('returns a single filter directly when only one real filter given', () => {
    const single = { id: '123' };
    expect(mergeFilters(single, null)).toBe(single);
  });

  it('wraps multiple filters in $and', () => {
    const merged = mergeFilters({ a: 1 }, { b: 2 });
    expect(merged).toHaveProperty('$and');
    expect((merged as { $and: unknown[] }).$and).toHaveLength(2);
  });
});
