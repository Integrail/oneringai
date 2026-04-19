/**
 * Tests for scope filter translation — verifies the Mongo-side expression of
 * our permission-aware visibility rule encodes the three access branches
 * (owner / group-with-read / world-with-read).
 */

import { describe, it, expect } from 'vitest';
import { scopeToFilter, mergeFilters } from '@/memory/adapters/mongo/scopeFilter.js';

describe('scopeToFilter', () => {
  it('produces three $or branches for a fully-specified caller', () => {
    const f = scopeToFilter({ groupId: 'g1', userId: 'u1' });
    expect(f).toHaveProperty('$or');
    const branches = (f as { $or: unknown[] }).$or;
    expect(branches).toHaveLength(3);
    const serialized = JSON.stringify(f);
    expect(serialized).toContain('u1');        // owner branch
    expect(serialized).toContain('g1');        // group branch + world branch uses $ne: 'g1'
    expect(serialized).toContain('permissions.world');
    expect(serialized).toContain('permissions.group');
  });

  it('omits the owner branch when scope has no userId', () => {
    const f = scopeToFilter({ groupId: 'g1' });
    const s = JSON.stringify(f);
    expect(s).not.toContain('"ownerId"');
    expect(s).toContain('g1');
  });

  it('collapses to a single world branch for a scopeless caller', () => {
    const f = scopeToFilter({});
    // Only the world-read branch is emitted. The WORLD_ALLOWS_READ expression
    // itself uses $or (missing-or-not-'none'), so the top-level filter carries
    // a single $or.
    const s = JSON.stringify(f);
    expect(s).toContain('permissions.world');
    expect(s).not.toContain('ownerId');
    expect(s).not.toContain('groupId');
  });

  it('when only userId is set, produces owner + world branches', () => {
    const f = scopeToFilter({ userId: 'u1' });
    const branches = (f as { $or: unknown[] }).$or;
    expect(branches).toHaveLength(2);
    const s = JSON.stringify(f);
    expect(s).toContain('u1');
    expect(s).toContain('permissions.world');
  });

  it('world branch requires "not in record group" when caller is in a group', () => {
    const f = scopeToFilter({ groupId: 'g1', userId: 'u1' });
    const s = JSON.stringify(f);
    // The $ne expresses the "not in record's group" constraint.
    expect(s).toContain('"$ne"');
  });

  it('permissions.world missing is treated as readable (default "read")', () => {
    const f = scopeToFilter({});
    const s = JSON.stringify(f);
    expect(s).toContain('$exists');
    expect(s).toContain('"none"');
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
