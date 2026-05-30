/**
 * Principal-based access primitives — the storage-agnostic kit.
 *
 * A *principal* is an opaque canonical token describing an access identity:
 *   `user:<id>` `entity:<id>` `group:<id>` `service:<name>` `world`
 *
 * Records (entities, facts, or host-owned documents) carry two materialized
 * arrays — `readPrincipals` / `writePrincipals` — derived deterministically
 * from their owner/group/world permissions plus an optional explicit `acl`.
 * A caller is authorized iff their principal set intersects the record's.
 *
 * This module is the LOWEST layer in the access dependency graph:
 *   - It imports nothing from `AccessControl` / `types` at runtime (the
 *     `'read' | 'write'` action union is inlined to avoid any coupling).
 *   - `AccessControl.canAccess` and the Mongo `scopeToFilter` import *from
 *     here* (one-directional).
 *
 * It is exported from the package root so a host can authorize its OWN
 * collections with the same grammar and the same materializer — no further
 * library change required to extend coverage to new collections.
 */

export type Principal = string;

/** The single principal that matches every caller. */
export const PRINCIPAL_WORLD: Principal = 'world';

export const principalUser = (id: string): Principal => `user:${id}`;
/** The Person-as-principal token — the key to "account links later" visibility. */
export const principalEntity = (id: string): Principal => `entity:${id}`;
export const principalGroup = (id: string): Principal => `group:${id}`;
export const principalService = (name: string): Principal => `service:${name}`;

export type PrincipalKind = 'user' | 'entity' | 'group' | 'service' | 'world' | 'unknown';

export interface ParsedPrincipal {
  kind: PrincipalKind;
  /** Undefined for `world` and `unknown`. */
  id?: string;
}

/**
 * Split a token into kind + id. An unrecognized prefix parses as
 * `kind: 'unknown'` — NEVER `world`. `world` is the BROADEST read token, so
 * silently mapping a malformed or future-prefixed token to it would treat it
 * as public; a host validating tokens via this helper must be able to tell
 * "unknown/invalid" apart from "public". Does not throw (forward-compatible
 * with tokens a newer host might write).
 */
export function parsePrincipal(p: Principal): ParsedPrincipal {
  if (p === PRINCIPAL_WORLD) return { kind: 'world' };
  const idx = p.indexOf(':');
  const prefix = idx === -1 ? p : p.slice(0, idx);
  const id = idx === -1 ? undefined : p.slice(idx + 1);
  switch (prefix) {
    case 'user':
      return { kind: 'user', id };
    case 'entity':
      return { kind: 'entity', id };
    case 'group':
      return { kind: 'group', id };
    case 'service':
      return { kind: 'service', id };
    default:
      return { kind: 'unknown' };
  }
}

/** Explicit grant beyond owner/group/world. `actions` aligns with `Permission`. */
export interface ACLEntry {
  principal: Principal;
  actions: Array<'read' | 'write'>;
}

/**
 * Normalized, storage-agnostic input to `materializePrincipals`. Both the
 * library (`fromLibraryPermissions`) and host code (`fromNimbleAudit`) project
 * their native shapes into this so a single materializer serves every caller.
 */
export interface AccessInput {
  ownerId?: string;
  groupId?: string;
  groupRead?: boolean;
  groupWrite?: boolean;
  worldRead?: boolean;
  worldWrite?: boolean;
  acl?: ACLEntry[];
}

export interface MaterializedPrincipals {
  readPrincipals: string[];
  writePrincipals: string[];
}

/**
 * Deterministically project an `AccessInput` into the two principal arrays.
 * Invariant: `writePrincipals ⊆ readPrincipals` (write implies read). Output
 * arrays are sorted so identical inputs yield byte-identical arrays (stable
 * diffs, idempotent backfills).
 */
export function materializePrincipals(input: AccessInput): MaterializedPrincipals {
  const read = new Set<string>();
  const write = new Set<string>();

  // Owner ⇒ full access (subsumes the legacy "owner always has access" rule).
  if (input.ownerId) {
    const t = principalUser(input.ownerId);
    read.add(t);
    write.add(t);
  }
  if (input.groupId) {
    const t = principalGroup(input.groupId);
    if (input.groupWrite) {
      read.add(t);
      write.add(t);
    } else if (input.groupRead) {
      read.add(t);
    }
  }
  if (input.worldWrite) {
    read.add(PRINCIPAL_WORLD);
    write.add(PRINCIPAL_WORLD);
  } else if (input.worldRead) {
    read.add(PRINCIPAL_WORLD);
  }
  for (const entry of input.acl ?? []) {
    // Only a 'read' or 'write' action grants anything. An empty or
    // unrecognized `actions` array is a no-op (NOT a silent read grant) — this
    // matters for grant/revoke surfaces where `actions: []` means "no access".
    const grantsWrite = entry.actions.includes('write');
    const grantsRead = grantsWrite || entry.actions.includes('read');
    if (grantsRead) read.add(entry.principal);
    if (grantsWrite) write.add(entry.principal);
  }

  return {
    readPrincipals: [...read].sort(),
    writePrincipals: [...write].sort(),
  };
}

/**
 * Map the library's `Permissions {group, world}` (+ owner/group ids) into an
 * `AccessInput`. Mirrors `AccessControl.effectivePermissions`: `group` defaults
 * to `'read'` when a `groupId` is present, `world` defaults to `'read'`.
 *
 * `acl` is NOT taken here — call sites union it in explicitly (see
 * `principalsForLibraryRecord`) so this mapper stays a pure permissions→input
 * projection.
 */
export function fromLibraryPermissions(
  perms: { group?: 'none' | 'read' | 'write'; world?: 'none' | 'read' | 'write' } | undefined,
  ownerId: string | undefined,
  groupId: string | undefined,
): AccessInput {
  const group = groupId ? perms?.group ?? 'read' : 'none';
  const world = perms?.world ?? 'read';
  return {
    ownerId: ownerId || undefined,
    groupId: groupId || undefined,
    groupRead: group !== 'none',
    groupWrite: group === 'write',
    worldRead: world !== 'none',
    worldWrite: world === 'write',
  };
}

/**
 * Map a NimbleAudit-style `{isPublic, ownerId, groupId}` (+ host-translated
 * `acl`) into an `AccessInput`. Exported for hosts authorizing their OWN
 * collections; the library itself never calls this.
 *
 *   isPublic && groupId  → group-readable
 *   isPublic && !groupId → world-readable (platform-level)
 *   !isPublic            → private (owner + acl only)
 *
 * NimbleAudit groups are read-level only (group writes go through owner/acl),
 * so `groupWrite`/`worldWrite` are always false here.
 */
export function fromNimbleAudit(
  isPublic: boolean | undefined,
  ownerId: string | undefined,
  groupId: string | undefined,
  acl?: ACLEntry[],
): AccessInput {
  return {
    ownerId: ownerId || undefined,
    groupId: groupId || undefined,
    groupRead: !!isPublic && !!groupId,
    groupWrite: false,
    worldRead: !!isPublic && !groupId,
    worldWrite: false,
    acl,
  };
}

/**
 * Convenience used at the storage boundary: compute the principal arrays for a
 * library record (entity or fact) from its `permissions` + owner/group + `acl`.
 */
export function principalsForLibraryRecord(rec: {
  ownerId?: string;
  groupId?: string;
  permissions?: { group?: 'none' | 'read' | 'write'; world?: 'none' | 'read' | 'write' };
  acl?: ACLEntry[];
}): MaterializedPrincipals {
  return materializePrincipals({
    ...fromLibraryPermissions(rec.permissions, rec.ownerId, rec.groupId),
    acl: rec.acl,
  });
}

/** Mongo read filter for a caller's principal set. */
export function readFilterForPrincipals(principals: string[]): {
  readPrincipals: { $in: string[] };
} {
  return { readPrincipals: { $in: principals } };
}

/** Mongo write filter for a caller's principal set. */
export function writeFilterForPrincipals(principals: string[]): {
  writePrincipals: { $in: string[] };
} {
  return { writePrincipals: { $in: principals } };
}

/**
 * In-process access check. Returns false when the record carries no
 * materialized arrays — callers (e.g. `AccessControl.canAccess`) decide whether
 * to fall back to the legacy owner/group/world check in that case.
 */
export function canByPrincipals(
  record: { readPrincipals?: string[]; writePrincipals?: string[] },
  principals: string[],
  need: 'read' | 'write',
): boolean {
  const arr = need === 'write' ? record.writePrincipals : record.readPrincipals;
  if (!arr) return false;
  return principals.some((p) => arr.includes(p));
}

/**
 * Does a partial-record patch touch any field that feeds principal
 * materialization (`acl`, `permissions`, `ownerId`, `groupId`)? Adapters call
 * this on `updateFact`/`updateEntity` patches to decide whether the
 * materialized arrays must be recomputed (keeps the "recomputed on every write"
 * invariant true even for direct partial updates).
 */
export function patchTouchesAccessFields(patch: object): boolean {
  return (
    'acl' in patch || 'permissions' in patch || 'ownerId' in patch || 'groupId' in patch
  );
}

/**
 * Rewrite `entity:<from>` → `entity:<to>` in a principal array, dedup, drop
 * nothing else. Returns the SAME array reference when `from` is absent (cheap
 * no-op for the common case). Used by entity-merge identity convergence.
 */
export function rewritePrincipalReferences(
  arr: string[] | undefined,
  fromEntityId: string,
  toEntityId: string,
): string[] | undefined {
  if (!arr) return arr;
  const fromTok = principalEntity(fromEntityId);
  if (!arr.includes(fromTok)) return arr;
  const toTok = principalEntity(toEntityId);
  const out = new Set<string>();
  for (const t of arr) out.add(t === fromTok ? toTok : t);
  return [...out].sort();
}

/**
 * Rewrite `entity:<from>` → `entity:<to>` across an `acl[]`, merging actions
 * when the target principal is already granted. Returns the SAME reference when
 * `from` is absent.
 */
export function rewriteAclPrincipalReferences(
  acl: ACLEntry[] | undefined,
  fromEntityId: string,
  toEntityId: string,
): ACLEntry[] | undefined {
  if (!acl) return acl;
  const fromTok = principalEntity(fromEntityId);
  if (!acl.some((e) => e.principal === fromTok)) return acl;
  const toTok = principalEntity(toEntityId);
  const byPrincipal = new Map<string, Set<'read' | 'write'>>();
  for (const e of acl) {
    const principal = e.principal === fromTok ? toTok : e.principal;
    const acts = byPrincipal.get(principal) ?? new Set<'read' | 'write'>();
    for (const a of e.actions) acts.add(a);
    byPrincipal.set(principal, acts);
  }
  return [...byPrincipal.entries()].map(([principal, acts]) => ({
    principal,
    actions: [...acts],
  }));
}
