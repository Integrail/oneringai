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
  /**
   * Optional archive collection (move-on-archive deployments). When provided,
   * the same subject/object/context/predicate-led indexes are built on the
   * archive so `findFacts({archived: true})`, `countFacts({archived: true})`,
   * and the `getFact(id)` archive-fallback don't degrade to collection scans
   * as the archive grows. Legacy `groupId+ownerId`-led compounds are NOT
   * mirrored — the archive isn't on the hot path for admin tooling.
   */
  factsArchive?: IMongoCollectionLike<IFact>;
}

export async function ensureIndexes(args: EnsureIndexesArgs): Promise<void> {
  const { entities, facts, factsArchive } = args;

  if (entities.createIndex) {
    // Identifier lookup is the hottest path — groupId/ownerId first for selectivity.
    await entities.createIndex(
      { groupId: 1, ownerId: 1, 'identifiers.kind': 1, 'identifiers.value': 1 } as Record<string, 1 | -1>,
      { name: 'memory_ent_ident' },
    );
    // Access-filter-friendly identifier lookup. The access $or (ownerId /
    // groupId-eq / groupId-$ne) can never pin groupId+ownerId as a leading
    // equality across all three branches, so `memory_ent_ident` falls back
    // to wide scans on the world branch. This identifier-led variant works
    // for every branch — the planner post-filters access cheaply on the
    // tiny per-identifier candidate set.
    await entities.createIndex(
      { 'identifiers.kind': 1, 'identifiers.value': 1, archived: 1 } as Record<string, 1 | -1>,
      { name: 'memory_ent_ident_only' },
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
    // Normalized-name lookup — drives EntityResolver Tier 2/3 + the atomic
    // upsert path. Lead with groupId (most selective for multi-tenant
    // deployments), then type, then the normalized name. The Mongo planner
    // can use a prefix (groupId+type) for grouped listings too.
    // Background: true so index build doesn't lock the collection on big
    // production datasets.
    await entities.createIndex(
      { groupId: 1, type: 1, normalizedDisplayName: 1 },
      { name: 'memory_ent_norm_name', background: true },
    );
    // Alias-matching variant. Sparse: most entities have no aliases, so the
    // partial-index footprint stays small.
    await entities.createIndex(
      { groupId: 1, type: 1, normalizedAliases: 1 },
      { name: 'memory_ent_norm_aliases', background: true, sparse: true },
    );
    // No explicit id index — Mongo's built-in unique `_id` index is the primary key.
  }

  if (facts.createIndex) {
    // ── SUBJECT/OBJECT/CONTEXT-LED INDEXES (new) ──────────────────────────
    //
    // The access $or from `scopeToFilter` (ownerId / groupId-eq / groupId-$ne)
    // can never pin `groupId` or `ownerId` as a leading equality for every
    // branch — the world branch uses `$ne`, the owner branch lacks groupId,
    // and the group branch lacks ownerId. So compound indexes that LEAD with
    // groupId+ownerId (the legacy shape below) can only be used by ONE of
    // the three $or branches; the other two fall back to wider scans.
    //
    // The fix: lead with the highly-selective subject/object/context key
    // directly. The planner can then use the SAME index for ALL three
    // branches (subjectId is constrained equally for each), post-filtering
    // the cheap access $or on the few docs per subject. Empirically this
    // turns 530-second, 58k-doc-examined queries into millisecond seeks.
    //
    // Sort is included so observedAt-desc / observedAt-asc reads serve the
    // sort directly from the index — no in-memory top-K resort needed.
    await facts.createIndex(
      { subjectId: 1, observedAt: -1 },
      { name: 'memory_fact_subject_observed' },
    );
    await facts.createIndex(
      { objectId: 1, observedAt: -1 },
      { name: 'memory_fact_object_observed' },
    );
    await facts.createIndex(
      { contextIds: 1, observedAt: -1 },
      { name: 'memory_fact_context_observed' },
    );
    // getLatestForPredicate(subject, predicate) is hit on every addFact for
    // singleValued predicates — dedupe check before insert. Subject-led so
    // the access $or stays cheap.
    await facts.createIndex(
      { subjectId: 1, predicate: 1, observedAt: -1 },
      { name: 'memory_fact_subject_pred_observed' },
    );

    // ── LEGACY GROUPID-LED COMPOUNDS (retained) ───────────────────────────
    //
    // Still useful for callers that explicitly pin both `groupId` and
    // `ownerId` (admin tooling, tenant-scoped reports). The library no
    // longer drives the hot path through these — the subject-led indexes
    // above carry that load.
    await facts.createIndex(
      { groupId: 1, ownerId: 1, subjectId: 1, predicate: 1, archived: 1, observedAt: -1 },
      { name: 'memory_fact_by_subject' },
    );
    await facts.createIndex(
      { groupId: 1, ownerId: 1, objectId: 1, predicate: 1, archived: 1 },
      { name: 'memory_fact_by_object' },
    );
    await facts.createIndex(
      { groupId: 1, ownerId: 1, contextIds: 1, archived: 1 },
      { name: 'memory_fact_by_context' },
    );
    await facts.createIndex(
      { groupId: 1, predicate: 1, observedAt: -1 },
      { name: 'memory_fact_recent_pred' },
    );
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

  // ── ARCHIVE COLLECTION (move-on-archive deployments) ──────────────────────
  //
  // The archive holds every fact that has ever been archived. Its read paths:
  //   - `getFact(id)` fallback when an id misses primary (audit + supersession
  //     chain walks). Backed by Mongo's `_id` unique index.
  //   - `findFacts({archived: true}, ...)` / `countFacts({archived: true}, ...)`
  //     — subject/object/context queries against the archive. Same shape as
  //     the primary hot path, so we mirror the subject/object/context-led
  //     indexes here. We deliberately skip the legacy `groupId+ownerId`-led
  //     compounds — admin tooling that pins both keys typically targets the
  //     LIVE collection, not the archive.
  if (factsArchive?.createIndex) {
    await factsArchive.createIndex(
      { subjectId: 1, observedAt: -1 },
      { name: 'memory_fact_archive_subject_observed' },
    );
    await factsArchive.createIndex(
      { objectId: 1, observedAt: -1 },
      { name: 'memory_fact_archive_object_observed' },
    );
    await factsArchive.createIndex(
      { contextIds: 1, observedAt: -1 },
      { name: 'memory_fact_archive_context_observed' },
    );
    await factsArchive.createIndex(
      { subjectId: 1, predicate: 1, observedAt: -1 },
      { name: 'memory_fact_archive_subject_pred_observed' },
    );
  }
}

/**
 * Install the unique partial index on `{groupId, ownerId, type,
 * normalizedDisplayName}` that makes `IMemoryStore.atomicCreateOrFindByNormalizedName`
 * cross-process-safe. Host-controlled, never auto-installed.
 *
 * **Why host-controlled:** adding a unique index to a collection that already
 * contains duplicates fails immediately with E11000. The library cannot
 * safely do this for you. The correct sequence on a live deployment:
 *   1. Bump library to >=0.8.0; ship Commit 1 (adds the normalized fields to
 *      every new/updated row).
 *   2. Run `MemorySystem.backfillNormalizedFields(...)` (Commit 6) so every
 *      existing entity has the field populated.
 *   3. Run a deduplication pass (your tooling — `findDuplicateClusters` lands
 *      separately in Phase C).
 *   4. Call this helper from a migration to enforce uniqueness going forward.
 *
 * **Why partial:** archived entities don't participate in the dedup contract;
 * neither do legacy entities lacking `normalizedDisplayName`. The
 * `partialFilterExpression` restricts the index to documents where the field
 * matters, keeping the index small and avoiding spurious E11000s on archived
 * rows that share a normalized name with a live row.
 *
 * Idempotent — `createIndex` with the same `{spec, opts}` is a no-op.
 */
export async function ensureNormalizedNameUniqueIndex(
  entities: IMongoCollectionLike<IEntity>,
  opts?: { name?: string },
): Promise<void> {
  if (!entities.createIndex) return;
  await entities.createIndex(
    { groupId: 1, ownerId: 1, type: 1, normalizedDisplayName: 1 },
    {
      unique: true,
      background: true,
      name: opts?.name ?? 'memory_ent_norm_name_unique',
      partialFilterExpression: {
        archived: { $ne: true },
        normalizedDisplayName: { $exists: true, $ne: '' },
      },
    },
  );
}
