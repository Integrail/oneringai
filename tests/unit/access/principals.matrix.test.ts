/**
 * Principal access — exhaustive pure-logic matrix.
 *
 * Drives `principalsForLibraryRecord` (materialization) + `canByPrincipals`
 * (the in-process decision) across every (record config × caller × read/write)
 * combination, and asserts each against the INDEPENDENT oracle in
 * aclMatrix.fixtures.ts. This is the "can do what they should / cannot do what
 * they shouldn't" truth table at the lowest layer — fast and complete.
 */

import { describe, it, expect } from 'vitest';
import { principalsForLibraryRecord, canByPrincipals } from '@/access/principals.js';
import {
  CONFIGS,
  CALLERS,
  OWNER,
  callerTokens,
  expectedAccess,
  type AclConfig,
} from './aclMatrix.fixtures.js';

function materialize(config: AclConfig): { readPrincipals: string[]; writePrincipals: string[] } {
  return principalsForLibraryRecord({
    ownerId: OWNER,
    groupId: config.groupId,
    permissions: config.permissions,
    acl: config.acl,
  });
}

describe('principal ACL matrix (canByPrincipals vs independent oracle)', () => {
  describe.each(CONFIGS.map((c) => [c.name, c] as const))('config: %s', (_name, config) => {
    const record = materialize(config);

    it.each(CALLERS.map((c) => [c.name, c] as const))(
      'caller %s — read & write match the oracle',
      (_callerName, caller) => {
        const tokens = callerTokens(caller);
        for (const need of ['read', 'write'] as const) {
          const got = canByPrincipals(record, tokens, need);
          const want = expectedAccess(config, caller, need);
          expect(got, `${config.name} / ${caller.name} / ${need}`).toBe(want);
        }
      },
    );
  });

  it('the matrix is non-degenerate (a healthy spread of allow AND deny)', () => {
    // Guards against a refactor that makes the oracle (or impl) collapse to
    // all-true/all-false, which would let the per-cell asserts pass vacuously.
    let allow = 0;
    let deny = 0;
    for (const config of CONFIGS) {
      const record = materialize(config);
      for (const caller of CALLERS) {
        for (const need of ['read', 'write'] as const) {
          const want = expectedAccess(config, caller, need);
          // impl and oracle must also agree here (belt-and-suspenders with the
          // describe.each cells above).
          expect(canByPrincipals(record, callerTokens(caller), need)).toBe(want);
          if (want) allow++;
          else deny++;
        }
      }
    }
    expect(allow).toBeGreaterThan(30);
    expect(deny).toBeGreaterThan(30);
  });

  it('write access always implies read access (writePrincipals ⊆ readPrincipals)', () => {
    // Restated end-to-end across the matrix: any caller granted write is also
    // granted read — there is no write-without-read hole.
    for (const config of CONFIGS) {
      for (const caller of CALLERS) {
        if (expectedAccess(config, caller, 'write')) {
          expect(
            expectedAccess(config, caller, 'read'),
            `${config.name} / ${caller.name}: write without read`,
          ).toBe(true);
        }
      }
    }
  });
});

describe('principal ACL matrix — explicit truth-table anchors (oracle self-check)', () => {
  // A handful of HAND-asserted rows. If a bug ever crept into the oracle itself,
  // the data-driven matrix above would silently agree with it; these do not.
  const record = (name: string) => materialize(CONFIGS.find((c) => c.name === name)!);

  it('owner-private: only the owner, nobody else', () => {
    const r = record('owner-private');
    expect(canByPrincipals(r, ['user:u-owner'], 'write')).toBe(true);
    expect(canByPrincipals(r, ['user:u-owner'], 'read')).toBe(true);
    expect(canByPrincipals(r, ['group:g-one', 'world'], 'read')).toBe(false);
    expect(canByPrincipals(r, ['user:u-member', 'group:g-one', 'world'], 'read')).toBe(false);
  });

  it('group-private: group member reads, cannot write; world cannot read', () => {
    const r = record('group-private');
    expect(canByPrincipals(r, ['user:u-member', 'group:g-one'], 'read')).toBe(true);
    expect(canByPrincipals(r, ['user:u-member', 'group:g-one'], 'write')).toBe(false);
    expect(canByPrincipals(r, ['world'], 'read')).toBe(false);
  });

  it('acl-entity-read: only the granted entity (read), not write', () => {
    const r = record('acl-entity-read');
    expect(canByPrincipals(r, ['entity:ent-alice', 'world'], 'read')).toBe(true);
    expect(canByPrincipals(r, ['entity:ent-alice', 'world'], 'write')).toBe(false);
    expect(canByPrincipals(r, ['entity:somebody-else', 'world'], 'read')).toBe(false);
  });

  it('world-write: any world holder writes; a caller missing the world token cannot', () => {
    const r = record('world-write');
    expect(canByPrincipals(r, ['user:u-stranger', 'group:g-x', 'world'], 'write')).toBe(true);
    expect(canByPrincipals(r, ['user:u-member', 'group:g-one'], 'write')).toBe(false); // no world token
  });

  it('un-materialized record denies any principal caller (must backfill first)', () => {
    expect(canByPrincipals({}, ['user:u-owner'], 'read')).toBe(false);
    expect(canByPrincipals({ readPrincipals: undefined }, ['world'], 'read')).toBe(false);
  });
});
