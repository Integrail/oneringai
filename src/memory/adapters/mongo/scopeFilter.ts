/**
 * Translation from ScopeFilter to Mongo filter.
 *
 * Visibility rule (mirror of MemorySystem + InMemoryAdapter):
 *   record visible iff
 *     (!record.groupId || record.groupId === filter.groupId) AND
 *     (!record.ownerId || record.ownerId === filter.userId)
 *
 * Convention: scope fields stored as `null` when absent (NOT undefined), so the
 * index behaves consistently. Missing fields are treated as null via $exists.
 */

import type { ScopeFilter } from '../../types.js';
import type { MongoFilter } from './IMongoCollectionLike.js';

export function scopeToFilter(scope: ScopeFilter): MongoFilter {
  const clauses: MongoFilter[] = [];

  // groupId clause
  if (scope.groupId !== undefined) {
    clauses.push({
      $or: [
        { groupId: null },
        { groupId: { $exists: false } },
        { groupId: scope.groupId },
      ],
    });
  } else {
    clauses.push({
      $or: [{ groupId: null }, { groupId: { $exists: false } }],
    });
  }

  // ownerId clause
  if (scope.userId !== undefined) {
    clauses.push({
      $or: [
        { ownerId: null },
        { ownerId: { $exists: false } },
        { ownerId: scope.userId },
      ],
    });
  } else {
    clauses.push({
      $or: [{ ownerId: null }, { ownerId: { $exists: false } }],
    });
  }

  return clauses.length === 1 ? clauses[0]! : { $and: clauses };
}

export function mergeFilters(...filters: Array<MongoFilter | null | undefined>): MongoFilter {
  const real = filters.filter((f): f is MongoFilter => !!f && Object.keys(f).length > 0);
  if (real.length === 0) return {};
  if (real.length === 1) return real[0]!;
  return { $and: real };
}
