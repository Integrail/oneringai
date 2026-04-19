/**
 * One-time index setup for the Mongo adapter.
 *
 * Callers invoke `ensureIndexes({ entities, facts })` once at startup. Each
 * collection must expose `createIndex`; if it does not, the call is a silent
 * no-op (users plumbing their own collections are responsible for indexes).
 *
 * Atlas Vector Search indexes are created outside this helper (via Atlas UI
 * or admin API) because they use a different definition shape.
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
