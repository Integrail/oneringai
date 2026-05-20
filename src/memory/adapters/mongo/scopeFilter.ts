/**
 * Translation from ScopeFilter to Mongo filter — permission-aware.
 *
 * Visibility rule (mirror of MemorySystem + InMemoryAdapter via AccessControl):
 *   record visible to caller C iff any of:
 *     (a) record.ownerId === C.userId                          — owner shortcut
 *     (b) record.groupId === C.groupId AND permissions.group !== 'none'   — group access
 *     (c) record.groupId !== C.groupId AND permissions.world !== 'none'   — world access
 *
 * Defaults: `permissions.group` missing ⇒ 'read' (visible), `permissions.world`
 * missing ⇒ 'read' (visible). So a field that's either missing or not 'none'
 * satisfies the read check.
 *
 * Recommended compound indexes (caller owns them — see `ensureIndexes`):
 *   - `(ownerId, groupId)` for the owner shortcut + group match.
 *   - Single-field on `permissions.group` and `permissions.world` so the
 *     `$ne: 'none'` branch is sargable when records carry explicit levels.
 */

import type { ScopeFilter } from '../../types.js';
import type { MongoFilter } from './IMongoCollectionLike.js';

const WORLD_ALLOWS_READ: MongoFilter = {
  $or: [
    { 'permissions.world': { $exists: false } },
    { 'permissions.world': { $ne: 'none' } },
  ],
};

const GROUP_ALLOWS_READ: MongoFilter = {
  $or: [
    { 'permissions.group': { $exists: false } },
    { 'permissions.group': { $ne: 'none' } },
  ],
};

export interface ScopeToFilterOptions {
  /**
   * When true, the "world" branch is omitted from the produced filter.
   * The world branch (`groupId: {$ne: caller.groupId}` paired with
   * `permissions.world !== 'none'`) is fundamentally not sargable — the
   * `$ne` predicate forces a scan of every other group's documents. In
   * deployments where no records carry `permissions.world: 'read'` the
   * branch costs CPU + IO for no result rows, so callers can disable it
   * here. Default false (backwards-compatible).
   */
  disableWorld?: boolean;
}

export function scopeToFilter(
  scope: ScopeFilter,
  opts: ScopeToFilterOptions = {},
): MongoFilter {
  const branches: MongoFilter[] = [];

  // (a) Owner shortcut.
  if (scope.userId !== undefined) {
    branches.push({ ownerId: scope.userId });
  }

  // (b) Group access.
  if (scope.groupId !== undefined) {
    branches.push({ $and: [{ groupId: scope.groupId }, GROUP_ALLOWS_READ] });
  }

  // (c) World access — caller is NOT in the record's group (or record has no
  //     group, which `$ne` matches since Mongo's $ne matches null/missing too).
  if (!opts.disableWorld) {
    if (scope.groupId !== undefined) {
      branches.push({ $and: [{ groupId: { $ne: scope.groupId } }, WORLD_ALLOWS_READ] });
    } else {
      // Caller has no groupId → every record is "world" for them.
      branches.push(WORLD_ALLOWS_READ);
    }
  }

  if (branches.length === 0) {
    // Caller has neither userId nor groupId AND world is disabled. Return
    // a filter that matches nothing — there's no legitimate access path.
    // The library doesn't currently emit this shape; defensive case.
    return { _id: { $exists: false } } as MongoFilter;
  }
  return branches.length === 1 ? branches[0]! : { $or: branches };
}

export function mergeFilters(...filters: Array<MongoFilter | null | undefined>): MongoFilter {
  const real = filters.filter((f): f is MongoFilter => !!f && Object.keys(f).length > 0);
  if (real.length === 0) return {};
  if (real.length === 1) return real[0]!;
  return { $and: real };
}
