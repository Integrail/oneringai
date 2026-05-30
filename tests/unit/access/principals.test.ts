/**
 * Principal kit — pure-function tests.
 *
 * Covers the materializer truth-table, the two mappers, filter/check
 * primitives, parsePrincipal (incl. the unknown≠world rule), the access-field
 * patch probe, and the merge-rewrite helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  PRINCIPAL_WORLD,
  principalUser,
  principalEntity,
  principalGroup,
  principalService,
  parsePrincipal,
  materializePrincipals,
  fromLibraryPermissions,
  fromNimbleAudit,
  principalsForLibraryRecord,
  readFilterForPrincipals,
  writeFilterForPrincipals,
  canByPrincipals,
  patchTouchesAccessFields,
  rewritePrincipalReferences,
  rewriteAclPrincipalReferences,
} from '@/access/principals.js';

describe('principal grammar', () => {
  it('builds canonical tokens', () => {
    expect(principalUser('u1')).toBe('user:u1');
    expect(principalEntity('e1')).toBe('entity:e1');
    expect(principalGroup('g1')).toBe('group:g1');
    expect(principalService('jarvis')).toBe('service:jarvis');
    expect(PRINCIPAL_WORLD).toBe('world');
  });
});

describe('parsePrincipal', () => {
  it('round-trips known kinds', () => {
    expect(parsePrincipal(principalUser('u1'))).toEqual({ kind: 'user', id: 'u1' });
    expect(parsePrincipal(principalEntity('e1'))).toEqual({ kind: 'entity', id: 'e1' });
    expect(parsePrincipal(principalGroup('g1'))).toEqual({ kind: 'group', id: 'g1' });
    expect(parsePrincipal(principalService('s'))).toEqual({ kind: 'service', id: 's' });
    expect(parsePrincipal(PRINCIPAL_WORLD)).toEqual({ kind: 'world' });
  });

  it('maps an unrecognized prefix to `unknown`, NOT `world`', () => {
    // Security-critical: world is the broadest read token. A malformed or
    // future-prefixed token must never be silently treated as public.
    expect(parsePrincipal('alien:x')).toEqual({ kind: 'unknown' });
    expect(parsePrincipal('garbage')).toEqual({ kind: 'unknown' });
    expect(parsePrincipal('')).toEqual({ kind: 'unknown' });
  });

  it('handles ids containing colons', () => {
    expect(parsePrincipal('entity:a:b:c')).toEqual({ kind: 'entity', id: 'a:b:c' });
  });
});

describe('materializePrincipals', () => {
  it('owner is granted read+write', () => {
    const m = materializePrincipals({ ownerId: 'u1' });
    expect(m.readPrincipals).toEqual(['user:u1']);
    expect(m.writePrincipals).toEqual(['user:u1']);
  });

  it('group read adds group to read only; group write adds to both', () => {
    expect(materializePrincipals({ ownerId: 'u1', groupId: 'g1', groupRead: true })).toEqual({
      readPrincipals: ['group:g1', 'user:u1'],
      writePrincipals: ['user:u1'],
    });
    expect(materializePrincipals({ ownerId: 'u1', groupId: 'g1', groupWrite: true })).toEqual({
      readPrincipals: ['group:g1', 'user:u1'],
      writePrincipals: ['group:g1', 'user:u1'],
    });
  });

  it('world read/write behave like group', () => {
    expect(materializePrincipals({ ownerId: 'u1', worldRead: true }).readPrincipals).toContain(
      'world',
    );
    expect(materializePrincipals({ ownerId: 'u1', worldRead: true }).writePrincipals).not.toContain(
      'world',
    );
    expect(materializePrincipals({ ownerId: 'u1', worldWrite: true }).writePrincipals).toContain(
      'world',
    );
  });

  it('acl entries land in the matching arrays', () => {
    const m = materializePrincipals({
      ownerId: 'u1',
      acl: [
        { principal: 'entity:alice', actions: ['read'] },
        { principal: 'entity:bob', actions: ['read', 'write'] },
      ],
    });
    expect(m.readPrincipals).toEqual(['entity:alice', 'entity:bob', 'user:u1']);
    expect(m.writePrincipals).toEqual(['entity:bob', 'user:u1']);
  });

  it('invariant: writePrincipals ⊆ readPrincipals; arrays are sorted', () => {
    const m = materializePrincipals({
      ownerId: 'zzz',
      groupId: 'aaa',
      groupWrite: true,
      worldWrite: true,
      acl: [{ principal: 'entity:mmm', actions: ['write'] }],
    });
    expect(m.readPrincipals).toEqual([...m.readPrincipals].sort());
    expect(m.writePrincipals).toEqual([...m.writePrincipals].sort());
    for (const w of m.writePrincipals) expect(m.readPrincipals).toContain(w);
  });

  it('group token omitted when no groupId, even if groupRead set', () => {
    const m = materializePrincipals({ ownerId: 'u1', groupRead: true });
    expect(m.readPrincipals).toEqual(['user:u1']);
  });

  it('acl entry with empty or invalid actions grants NOTHING (not a silent read)', () => {
    const m = materializePrincipals({
      ownerId: 'u1',
      acl: [
        { principal: 'entity:a', actions: [] },
        { principal: 'entity:b', actions: ['nope' as unknown as 'read'] },
        { principal: 'entity:c', actions: ['read'] },
      ],
    });
    expect(m.readPrincipals).not.toContain('entity:a');
    expect(m.readPrincipals).not.toContain('entity:b');
    expect(m.readPrincipals).toContain('entity:c');
    expect(m.writePrincipals).not.toContain('entity:a');
  });
});

describe('fromLibraryPermissions', () => {
  it('defaults: group=read when groupId set, world=read always (public-read like 644)', () => {
    const input = fromLibraryPermissions(undefined, 'u1', 'g1');
    expect(input).toMatchObject({ groupRead: true, groupWrite: false, worldRead: true });
  });

  it('group is none when no groupId', () => {
    expect(fromLibraryPermissions(undefined, 'u1', undefined).groupRead).toBe(false);
  });

  it('honors explicit none (ICOS user-private fact shape)', () => {
    const m = principalsForLibraryRecord({
      ownerId: 'u1',
      groupId: 'g1',
      permissions: { group: 'none', world: 'none' },
    });
    expect(m.readPrincipals).toEqual(['user:u1']);
    expect(m.readPrincipals).not.toContain('world');
    expect(m.readPrincipals).not.toContain('group:g1');
  });

  it('group-shared person shape → owner + group, no world', () => {
    const m = principalsForLibraryRecord({
      ownerId: 'u1',
      groupId: 'g1',
      permissions: { group: 'read', world: 'none' },
    });
    expect(m.readPrincipals.sort()).toEqual(['group:g1', 'user:u1']);
  });
});

describe('fromNimbleAudit', () => {
  it('isPublic + groupId → group-readable', () => {
    expect(fromNimbleAudit(true, 'u1', 'g1')).toMatchObject({ groupRead: true, worldRead: false });
  });
  it('isPublic + no groupId → world-readable (platform-level)', () => {
    expect(fromNimbleAudit(true, 'u1', undefined)).toMatchObject({
      groupRead: false,
      worldRead: true,
    });
  });
  it('private (isPublic false) → owner + acl only', () => {
    const m = materializePrincipals(
      fromNimbleAudit(false, 'u1', 'g1', [{ principal: 'entity:x', actions: ['read'] }]),
    );
    expect(m.readPrincipals.sort()).toEqual(['entity:x', 'user:u1']);
  });
});

describe('filter + check primitives', () => {
  it('readFilter/writeFilter shape', () => {
    expect(readFilterForPrincipals(['user:u1', 'world'])).toEqual({
      readPrincipals: { $in: ['user:u1', 'world'] },
    });
    expect(writeFilterForPrincipals(['user:u1'])).toEqual({
      writePrincipals: { $in: ['user:u1'] },
    });
  });

  it('canByPrincipals intersects', () => {
    const rec = { readPrincipals: ['group:g1', 'user:u1'], writePrincipals: ['user:u1'] };
    expect(canByPrincipals(rec, ['group:g1'], 'read')).toBe(true);
    expect(canByPrincipals(rec, ['group:g1'], 'write')).toBe(false);
    expect(canByPrincipals(rec, ['user:u1'], 'write')).toBe(true);
    expect(canByPrincipals(rec, ['user:other'], 'read')).toBe(false);
  });

  it('empty principal set denies (no grant intersects nothing)', () => {
    const rec = { readPrincipals: ['world'], writePrincipals: [] };
    expect(canByPrincipals(rec, [], 'read')).toBe(false);
  });

  it('undefined arrays deny (caller decides legacy fallback)', () => {
    expect(canByPrincipals({}, ['user:u1'], 'read')).toBe(false);
  });
});

describe('patchTouchesAccessFields', () => {
  it('true when patch carries an access-source field', () => {
    expect(patchTouchesAccessFields({ acl: [] })).toBe(true);
    expect(patchTouchesAccessFields({ permissions: {} })).toBe(true);
    expect(patchTouchesAccessFields({ ownerId: 'x' })).toBe(true);
    expect(patchTouchesAccessFields({ groupId: 'x' })).toBe(true);
  });
  it('false for non-access patches', () => {
    expect(patchTouchesAccessFields({ archived: true })).toBe(false);
    expect(patchTouchesAccessFields({ embedding: [1, 2] })).toBe(false);
    expect(patchTouchesAccessFields({ readPrincipals: ['x'] })).toBe(false);
  });
});

describe('rewritePrincipalReferences', () => {
  it('rewrites entity:from → entity:to and dedups', () => {
    expect(
      rewritePrincipalReferences(['entity:L', 'group:g', 'entity:W'], 'L', 'W'),
    ).toEqual(['entity:W', 'group:g']);
  });
  it('returns the SAME reference when from is absent (no-op fast path)', () => {
    const arr = ['user:u1', 'world'];
    expect(rewritePrincipalReferences(arr, 'L', 'W')).toBe(arr);
  });
  it('undefined passes through', () => {
    expect(rewritePrincipalReferences(undefined, 'L', 'W')).toBeUndefined();
  });
});

describe('rewriteAclPrincipalReferences', () => {
  it('rewrites the principal and merges actions on collision', () => {
    const acl = [
      { principal: 'entity:L', actions: ['read'] as Array<'read' | 'write'> },
      { principal: 'entity:W', actions: ['write'] as Array<'read' | 'write'> },
    ];
    const out = rewriteAclPrincipalReferences(acl, 'L', 'W')!;
    expect(out).toHaveLength(1);
    expect(out[0]!.principal).toBe('entity:W');
    expect([...out[0]!.actions].sort()).toEqual(['read', 'write']);
  });
  it('returns the SAME reference when from is absent', () => {
    const acl = [{ principal: 'entity:X', actions: ['read'] as Array<'read' | 'write'> }];
    expect(rewriteAclPrincipalReferences(acl, 'L', 'W')).toBe(acl);
  });
});
