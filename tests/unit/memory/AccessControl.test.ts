/**
 * AccessControl — pure evaluator tests.
 *
 * Exhaustive table of principal × level × need combinations, plus defaults
 * and error classes.
 */

import { describe, it, expect } from 'vitest';
import {
  canAccess,
  effectivePermissions,
  assertCanAccess,
  levelGrants,
  PermissionDeniedError,
  OwnerRequiredError,
  DEFAULT_GROUP_LEVEL,
  DEFAULT_WORLD_LEVEL,
} from '@/memory/AccessControl.js';
import type { AccessLevel, Permissions } from '@/memory/AccessControl.js';

describe('levelGrants', () => {
  const cases: Array<[AccessLevel, 'read' | 'write', boolean]> = [
    ['none', 'read', false],
    ['none', 'write', false],
    ['read', 'read', true],
    ['read', 'write', false],
    ['write', 'read', true],
    ['write', 'write', true],
  ];
  for (const [level, need, expected] of cases) {
    it(`level=${level}, need=${need} → ${expected}`, () => {
      expect(levelGrants(level, need)).toBe(expected);
    });
  }
});

describe('effectivePermissions — defaults', () => {
  it('defaults world to "read" when permissions omitted', () => {
    const { world } = effectivePermissions({ ownerId: 'u1' });
    expect(world).toBe(DEFAULT_WORLD_LEVEL);
    expect(world).toBe('read');
  });

  it('defaults group to "read" when groupId set and permissions.group omitted', () => {
    const { group } = effectivePermissions({ ownerId: 'u1', groupId: 'g1' });
    expect(group).toBe(DEFAULT_GROUP_LEVEL);
    expect(group).toBe('read');
  });

  it('group collapses to "none" when record has no groupId (no group principal)', () => {
    const { group } = effectivePermissions({ ownerId: 'u1' });
    expect(group).toBe('none');
  });

  it('honors explicit group/world values over defaults', () => {
    const perms: Permissions = { group: 'write', world: 'none' };
    const eff = effectivePermissions({ ownerId: 'u1', groupId: 'g1', permissions: perms });
    expect(eff.group).toBe('write');
    expect(eff.world).toBe('none');
  });

  it('ignores explicit group level when record has no groupId', () => {
    // Defensive: group principal is undefined when there's no groupId, so the
    // stored group value has no meaning. We always return 'none' in that case.
    const eff = effectivePermissions({
      ownerId: 'u1',
      permissions: { group: 'write', world: 'read' },
    });
    expect(eff.group).toBe('none');
    expect(eff.world).toBe('read');
  });
});

describe('canAccess — owner shortcut', () => {
  it('owner always has read', () => {
    const ok = canAccess(
      { ownerId: 'u1', permissions: { world: 'none', group: 'none' } },
      { userId: 'u1' },
      'read',
    );
    expect(ok).toBe(true);
  });

  it('owner always has write even when world/group are "none"', () => {
    const ok = canAccess(
      { ownerId: 'u1', permissions: { world: 'none', group: 'none' } },
      { userId: 'u1' },
      'write',
    );
    expect(ok).toBe(true);
  });

  it('non-owner without read permission is denied even with same groupId', () => {
    const ok = canAccess(
      { ownerId: 'u1', groupId: 'g1', permissions: { group: 'none', world: 'none' } },
      { userId: 'u2', groupId: 'g1' },
      'read',
    );
    expect(ok).toBe(false);
  });
});

describe('canAccess — group branch', () => {
  it('group member with default group=read can read', () => {
    const ok = canAccess(
      { ownerId: 'u1', groupId: 'g1' },
      { userId: 'u2', groupId: 'g1' },
      'read',
    );
    expect(ok).toBe(true);
  });

  it('group member with group=read cannot write', () => {
    const ok = canAccess(
      { ownerId: 'u1', groupId: 'g1' },
      { userId: 'u2', groupId: 'g1' },
      'write',
    );
    expect(ok).toBe(false);
  });

  it('group member with group=write can write', () => {
    const ok = canAccess(
      { ownerId: 'u1', groupId: 'g1', permissions: { group: 'write' } },
      { userId: 'u2', groupId: 'g1' },
      'write',
    );
    expect(ok).toBe(true);
  });

  it('non-matching groupId falls through to world branch', () => {
    // record: groupId=g1, world=none → caller in g2 is denied.
    const denied = canAccess(
      { ownerId: 'u1', groupId: 'g1', permissions: { world: 'none' } },
      { userId: 'u2', groupId: 'g2' },
      'read',
    );
    expect(denied).toBe(false);
  });
});

describe('canAccess — world branch', () => {
  it('default world=read lets anyone read', () => {
    const ok = canAccess({ ownerId: 'u1' }, { userId: 'u2' }, 'read');
    expect(ok).toBe(true);
  });

  it('explicit world=none denies a random caller', () => {
    const ok = canAccess(
      { ownerId: 'u1', permissions: { world: 'none' } },
      { userId: 'u2' },
      'read',
    );
    expect(ok).toBe(false);
  });

  it('explicit world=write lets anyone write', () => {
    const ok = canAccess(
      { ownerId: 'u1', permissions: { world: 'write' } },
      { userId: 'u2' },
      'write',
    );
    expect(ok).toBe(true);
  });

  it('caller with no scope at all still falls into world', () => {
    const ok = canAccess({ ownerId: 'u1' }, {}, 'read');
    expect(ok).toBe(true);
  });

  it('world=write does NOT enable group-branch access when caller is in group (write perm check is on group)', () => {
    // A record with groupId=g1, group=none, world=write. Caller in g1.
    // Caller falls into GROUP branch (matches), not world → denied.
    const denied = canAccess(
      { ownerId: 'u1', groupId: 'g1', permissions: { group: 'none', world: 'write' } },
      { userId: 'u2', groupId: 'g1' },
      'write',
    );
    expect(denied).toBe(false);
  });
});

describe('canAccess — edge cases', () => {
  it('caller matches groupId but has no userId — group branch applies', () => {
    const ok = canAccess(
      { ownerId: 'u1', groupId: 'g1' },
      { groupId: 'g1' },
      'read',
    );
    expect(ok).toBe(true);
  });

  it('record has no ownerId at all — world branch controls (no owner shortcut fires)', () => {
    // Should never exist at MemorySystem level (invariant), but the evaluator
    // handles it: ownerless record → owner branch short-circuits false, world
    // default read → visible.
    const ok = canAccess({ groupId: 'g1' }, {}, 'read');
    expect(ok).toBe(true);
  });
});

describe('assertCanAccess', () => {
  it('does not throw when permitted', () => {
    expect(() =>
      assertCanAccess({ id: 'e1', ownerId: 'u1' }, { userId: 'u1' }, 'write', 'entity'),
    ).not.toThrow();
  });

  it('throws PermissionDeniedError with recordId/kind/operation on denial', () => {
    try {
      assertCanAccess(
        { id: 'e1', ownerId: 'u1', permissions: { world: 'none', group: 'none' } },
        { userId: 'u2' },
        'write',
        'entity',
      );
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PermissionDeniedError);
      const pde = err as PermissionDeniedError;
      expect(pde.recordId).toBe('e1');
      expect(pde.recordKind).toBe('entity');
      expect(pde.operation).toBe('write');
    }
  });

  it('falls back to "<unknown>" when record has no id', () => {
    try {
      assertCanAccess(
        { ownerId: 'u1', permissions: { world: 'none' } },
        { userId: 'u2' },
        'read',
        'fact',
      );
      expect.fail('expected throw');
    } catch (err) {
      expect((err as PermissionDeniedError).recordId).toBe('<unknown>');
    }
  });
});

describe('OwnerRequiredError', () => {
  it('has a readable message and the correct recordKind', () => {
    const e = new OwnerRequiredError('fact');
    expect(e).toBeInstanceOf(Error);
    expect(e.recordKind).toBe('fact');
    expect(e.message).toMatch(/without an ownerId/);
  });
});
