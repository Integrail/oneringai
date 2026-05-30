/**
 * Shared ACL test matrix — record permission configs × caller identities × an
 * INDEPENDENT access oracle.
 *
 * The oracle (`expectedAccess`) is a from-scratch reimplementation of the
 * documented spec, reasoning in identity-space ("is this caller the owner / a
 * member of the record's group / a holder of an acl-granted principal?"). It
 * deliberately shares NO code with `materializePrincipals` / `canByPrincipals`
 * / `scopeToFilter`, so it cross-checks the real pipeline rather than testing it
 * against itself.
 *
 * Consumed by:
 *   - access/principals.matrix.test.ts        (pure: principalsForLibraryRecord + canByPrincipals)
 *   - memory/MemorySystem.acl.matrix.test.ts  (end-to-end: both adapters, entities + facts)
 */

import {
  principalUser,
  principalEntity,
  principalGroup,
  principalService,
  PRINCIPAL_WORLD,
  type ACLEntry,
} from '@/access/principals.js';
import type { AccessLevel, Permissions } from '@/memory/AccessControl.js';

// Fixed ids ------------------------------------------------------------------
export const OWNER = 'u-owner'; // every record in the matrix is owned by OWNER
export const MEMBER = 'u-member';
export const OTHER = 'u-other';
export const ALICE = 'u-alice';
export const STRANGER = 'u-stranger';
export const G1 = 'g-one'; // the record's group (for grouped configs)
export const G2 = 'g-two';
export const GX = 'g-x';
export const E = 'ent-alice'; // acl entity-grant target
export const S = 'jarvis'; // acl service-grant target

// Record permission configs --------------------------------------------------
export interface AclConfig {
  name: string;
  groupId?: string;
  permissions?: Permissions;
  acl?: ACLEntry[];
}

export const CONFIGS: AclConfig[] = [
  // owner/group/world combinations
  { name: 'default-grouped', groupId: G1 }, // → group:read, world:read
  { name: 'group-private', groupId: G1, permissions: { group: 'read', world: 'none' } },
  { name: 'owner-private', groupId: G1, permissions: { group: 'none', world: 'none' } },
  { name: 'group-write', groupId: G1, permissions: { group: 'write', world: 'none' } },
  { name: 'world-write', groupId: G1, permissions: { group: 'none', world: 'write' } },
  { name: 'world-read-nogroup' }, // no groupId, no perms → world:read only
  // explicit acl grants on an otherwise owner-private base
  {
    name: 'acl-entity-read',
    groupId: G1,
    permissions: { group: 'none', world: 'none' },
    acl: [{ principal: principalEntity(E), actions: ['read'] }],
  },
  {
    name: 'acl-entity-write',
    groupId: G1,
    permissions: { group: 'none', world: 'none' },
    acl: [{ principal: principalEntity(E), actions: ['write'] }],
  },
  {
    name: 'acl-service-read',
    groupId: G1,
    permissions: { group: 'none', world: 'none' },
    acl: [{ principal: principalService(S), actions: ['read'] }],
  },
  {
    name: 'acl-group2-read',
    groupId: G1,
    permissions: { group: 'none', world: 'none' },
    acl: [{ principal: principalGroup(G2), actions: ['read'] }],
  },
  // layered: group can read, a named participant can also write
  {
    name: 'group-read+acl-entity-write',
    groupId: G1,
    permissions: { group: 'read', world: 'none' },
    acl: [{ principal: principalEntity(E), actions: ['write'] }],
  },
  // a user-principal write grant to STRANGER on an otherwise owner-private record
  {
    name: 'acl-user-write',
    groupId: G1,
    permissions: { group: 'none', world: 'none' },
    acl: [{ principal: principalUser(STRANGER), actions: ['write'] }],
  },
];

// Caller identities ----------------------------------------------------------
export interface Caller {
  name: string;
  userId?: string;
  groups: string[];
  entityIds: string[];
  services: string[];
  world: boolean;
}

export const CALLERS: Caller[] = [
  { name: 'owner', userId: OWNER, groups: [G1], entityIds: [], services: [], world: true },
  { name: 'group-member', userId: MEMBER, groups: [G1], entityIds: [], services: [], world: true },
  // same group, but the host forgot the world token — must still fail closed on world-only grants
  { name: 'group-member-no-world', userId: MEMBER, groups: [G1], entityIds: [], services: [], world: false },
  { name: 'other-group', userId: OTHER, groups: [G2], entityIds: [], services: [], world: true },
  { name: 'world-only', groups: [], entityIds: [], services: [], world: true },
  { name: 'alice-entity', userId: ALICE, groups: [], entityIds: [E], services: [], world: true },
  { name: 'jarvis-service', groups: [], entityIds: [], services: [S], world: true },
  { name: 'stranger', userId: STRANGER, groups: [GX], entityIds: [], services: [], world: true },
  // no tokens at all — must see/do nothing anywhere
  { name: 'empty', groups: [], entityIds: [], services: [], world: false },
];

/** The principal token set a host would build for this caller. */
export function callerTokens(c: Caller): string[] {
  const t: string[] = [];
  if (c.userId) t.push(principalUser(c.userId));
  for (const g of c.groups) t.push(principalGroup(g));
  for (const e of c.entityIds) t.push(principalEntity(e));
  for (const s of c.services) t.push(principalService(s));
  if (c.world) t.push(PRINCIPAL_WORLD);
  return t;
}

function callerHolds(c: Caller, token: string): boolean {
  return callerTokens(c).includes(token);
}

/**
 * Independent oracle: does `caller` have `need` access to a record built from
 * `config` (owned by OWNER)? Reimplements the spec from identities, sharing no
 * code with the system under test.
 */
export function expectedAccess(config: AclConfig, caller: Caller, need: 'read' | 'write'): boolean {
  // Owner always has full access.
  if (caller.userId === OWNER) return true;

  // Library defaulting (mirrors fromLibraryPermissions): group is meaningful
  // only with a groupId and defaults to 'read'; world defaults to 'read'.
  const groupLevel: AccessLevel = config.groupId ? config.permissions?.group ?? 'read' : 'none';
  const worldLevel: AccessLevel = config.permissions?.world ?? 'read';
  const grants = (level: AccessLevel): boolean =>
    need === 'read' ? level === 'read' || level === 'write' : level === 'write';

  if (config.groupId && caller.groups.includes(config.groupId) && grants(groupLevel)) return true;
  if (caller.world && grants(worldLevel)) return true;

  for (const entry of config.acl ?? []) {
    if (!callerHolds(caller, entry.principal)) continue;
    if (need === 'read' && (entry.actions.includes('read') || entry.actions.includes('write'))) {
      return true;
    }
    if (need === 'write' && entry.actions.includes('write')) return true;
  }
  return false;
}
