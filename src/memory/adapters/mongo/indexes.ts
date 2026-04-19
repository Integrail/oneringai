/**
 * One-time index setup for the Mongo adapter.
 *
 * Callers invoke `ensureIndexes({ entities, facts })` once at startup. Each
 * collection must expose `createIndex`; if it does not, the call is a silent
 * no-op (users plumbing their own collections are responsible for indexes).
 *
 * Atlas Vector Search indexes are created outside this helper (via Atlas UI
 * or admin API) because they use a different definition shape.
 *
 * Index strategy for the permission-aware scope filter
 * ----------------------------------------------------
 * `scopeToFilter` produces an `$or` of up to three branches:
 *   (a) owner shortcut                  → `{ownerId: scope.userId}`
 *   (b) group match with group access    → `{groupId: scope.groupId, permissions.group != 'none'}`
 *   (c) world match                      → `{groupId != scope.groupId, permissions.world != 'none'}`
 *
 * Mongo's index intersection + compound indexes cover branches (a) and (b)
 * efficiently. We ship:
 *   - Group-leading compounds (`groupId, ownerId, ...`) — pre-existing; still
 *     the primary path for multi-tenant deployments.
 *   - **Owner-leading compounds** (NEW) — make the owner shortcut sargable
 *     without requiring groupId. A caller's personal records are a hot read
 *     path; before these, the owner branch either scanned or used index
 *     intersection (brittle).
 *   - The world branch uses `$ne` on groupId which is not sargable, BUT the
 *     world branch is usually paired with another selective predicate (subject
 *     id, identifier value, etc.), so index support is pulled from whichever
 *     compound covers that predicate.
 *
 * World-branch optimization (optional): operators with large cross-group
 * discovery workloads can add partial indexes filtered by
 * `{'permissions.world': {$ne: 'none'}}` — not shipped here because partial
 * indexes have Mongo version caveats and the selectivity win is deployment-
 * specific.
 */

import type { IMongoCollectionLike } from './IMongoCollectionLike.js';
import type { IEntity, IFact } from '../../types.js';

export interface EnsureIndexesArgs {
  entities: IMongoCollectionLike<IEntity>;
  facts: IMongoCollectionLike<IFact>;
}

export async function ensureIndexes(args: EnsureIndexesArgs): Promise<void> {
  const { entities, facts } = args;

  if (entities.createIndex) {
    // Identifier lookup is the hottest path — groupId/ownerId first for selectivity.
    await entities.createIndex(
      { groupId: 1, ownerId: 1, 'identifiers.kind': 1, 'identifiers.value': 1 } as Record<string, 1 | -1>,
      { name: 'memory_ent_ident' },
    );
    // List/search by type.
    await entities.createIndex(
      { groupId: 1, ownerId: 1, type: 1, archived: 1 },
      { name: 'memory_ent_list' },
    );
    // Owner-leading: covers the owner shortcut branch of scopeToFilter
    // (e.g. "all records owned by scope.userId, any group"). Pairs with
    // the existing groupId-leading indexes for multi-tenant deployments.
    await entities.createIndex(
      { ownerId: 1, archived: 1, type: 1 },
      { name: 'memory_ent_owner' },
    );
    // Owner-scoped identifier lookup (e.g. admin resolving a user's entities
    // across groups by email).
    await entities.createIndex(
      { ownerId: 1, 'identifiers.kind': 1, 'identifiers.value': 1 } as Record<string, 1 | -1>,
      { name: 'memory_ent_owner_ident' },
    );
    // No explicit id index — Mongo's built-in unique `_id` index is the primary key.
  }

  if (facts.createIndex) {
    await facts.createIndex(
      { groupId: 1, ownerId: 1, subjectId: 1, predicate: 1, archived: 1, observedAt: -1 },
      { name: 'memory_fact_by_subject' },
    );
    await facts.createIndex(
      { groupId: 1, ownerId: 1, objectId: 1, predicate: 1, archived: 1 },
      { name: 'memory_fact_by_object' },
    );
    // contextIds enables the "everything about this deal/event" queries.
    await facts.createIndex(
      { groupId: 1, ownerId: 1, contextIds: 1, archived: 1 },
      { name: 'memory_fact_by_context' },
    );
    await facts.createIndex(
      { groupId: 1, predicate: 1, observedAt: -1 },
      { name: 'memory_fact_recent_pred' },
    );
    // Owner-leading: covers the owner shortcut branch when looking up facts
    // by subject/object without constraining groupId. Essential once the
    // permission model lets owner shortcut match records across groups.
    await facts.createIndex(
      { ownerId: 1, subjectId: 1, predicate: 1, archived: 1, observedAt: -1 },
      { name: 'memory_fact_owner_subject' },
    );
    await facts.createIndex(
      { ownerId: 1, objectId: 1, predicate: 1, archived: 1 },
      { name: 'memory_fact_owner_object' },
    );
    // No explicit id index — Mongo's built-in unique `_id` index is the primary key.
  }

  if (entities.createIndex) {
    // Task-entity hot path: "my open tasks by due date"
    await entities.createIndex(
      { groupId: 1, type: 1, 'metadata.state': 1, 'metadata.dueAt': 1 } as Record<string, 1 | -1>,
      { name: 'memory_ent_tasks' },
    );
    // Event-entity hot path: "recent events in group"
    await entities.createIndex(
      { groupId: 1, type: 1, 'metadata.startTime': -1 } as Record<string, 1 | -1>,
      { name: 'memory_ent_events' },
    );
  }
}
