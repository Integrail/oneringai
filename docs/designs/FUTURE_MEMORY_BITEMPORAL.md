# Future Memory Design: Bitemporal Facts and Graphs

**Status:** proposed future design; not implemented.
**Date captured:** 2026-08-09
**Target:** post-1.0 memory evolution
**Scope:** `src/memory/`, memory tools, in-memory storage, MongoDB, and Atlas Vector Search

> Important: the current implementation provides valid-time filtering, record-time
> filtering, and preserved supersession chains. It is not yet a complete bitemporal
> implementation. Until this proposal is implemented, public documentation should say
> **"valid-time point-in-time queries with preserved supersession history"**, not
> **"bitemporal history."**

## Decision summary

Implement genuine bitemporal semantics for **facts and graph edges** while keeping
entities as current canonical identity records.

This is the practical boundary because graph edges are facts, and most durable knowledge
already lives in facts. `IEntity`, by contrast, contains mutable task/event metadata and
is deeply coupled to identity resolution, optimistic concurrency, and entity embeddings.
Versioning the entity subsystem in the same project would approximately double the work
and complicate every existing entity API.

The initial implementation will therefore guarantee temporal correctness for:

- atomic and document facts;
- corrections, revisions, and supersession;
- valid-time state transitions;
- fact retrieval and ranking;
- graph traversal;
- semantic fact search;
- fact-backed profiles by knowledge time;
- in-memory and MongoDB storage, including the optional fact archive collection;
- agent-facing memory tools.

It will not initially guarantee a complete historical snapshot of mutable entities,
task/event metadata, or entity-level semantic search. Public claims should be scoped to
**bitemporal fact and graph memory**.

## Goals

1. Answer independently:
   - What was true at external-world time `V`?
   - What did the system believe at knowledge time `K` about external-world time `V`?
2. Preserve corrections without rewriting history.
3. Represent state changes without treating previously true claims as errors.
4. Keep current non-temporal reads fast.
5. Preserve existing scope, ownership, permission, and ACL guarantees.
6. Work with both the in-memory adapter and MongoDB's live/archive collection layout.
7. Make incomplete backend support fail explicitly rather than return plausible but
   incorrect results.
8. Provide a conservative, resumable migration for existing deployments.

## Non-goals

1. Version every `IEntity` mutation in the first release.
2. Reconstruct historical aliases, display names, task metadata, or event metadata.
3. Make access control historical. Present-day authorization must govern access to all
   historical versions.
4. Replace the existing signal store. `sourceSignalId` remains an opaque reference.
5. Build a general-purpose temporal database abstraction unrelated to agent memory.
6. Guarantee cross-process atomicity on backends that cannot provide it; such backends
   retain crash-safe ordering plus repair.

## Current implementation

Facts currently contain:

```ts
interface IFact {
  supersedes?: FactId;
  archived?: boolean;
  observedAt?: Date;
  validFrom?: Date;
  validUntil?: Date;
  createdAt: Date;
}
```

`FactFilter.asOf` currently applies one timestamp to both axes:

```text
createdAt <= asOf
AND (validFrom is absent OR validFrom <= asOf)
AND (validUntil is absent OR validUntil >= asOf)
```

Relevant implementation points:

- Fact fields and `FactFilter.asOf`: `src/memory/types.ts`
- Supersession write path: `src/memory/MemorySystem.ts`
- Mongo temporal filter: `src/memory/adapters/mongo/queries.ts`
- In-memory temporal filter: `src/memory/adapters/inmemory/InMemoryAdapter.ts`
- Mongo live/archive routing: `src/memory/adapters/mongo/MongoMemoryAdapter.ts`
- Generic traversal: `src/memory/GenericTraversal.ts`

Limitations of the current behavior:

- `asOf` is one combined timestamp, not independent valid and system times.
- Archived versions are hidden by normal queries even when they were active at the
  requested historical time.
- `archivedAt` exists only as an untyped Mongo archive detail and is not part of
  temporal filtering.
- `updateFact`, `updateFactDetails`, and deduplication can mutate semantic or temporal
  fields in place.
- `getContext({asOf})` still returns the current entity and current profile.
- Related tasks and events read mutable entity metadata.
- Native Mongo graph traversal and vector search only query the live fact collection.

## Temporal model

Every fact version has two independent intervals.

| Axis | Meaning | Fields |
|---|---|---|
| Valid time | When the assertion was true in the external world | `validFrom`, `validUntil` |
| System time | When OneRingAI considered this version authoritative | `createdAt`, `retiredAt` |

A version matches a bitemporal point when:

```text
createdAt <= knownAt < retiredAt
AND
validFrom <= validAt < validUntil
```

Missing starts are treated as unbounded in the past where the existing model permits
them. Missing ends are treated as infinity.

Use half-open intervals, `[from, until)`, for both axes. Half-open intervals make an
instantaneous transition unambiguous: the old state ends at `T`, and the new state starts
at `T`.

### Example: late discovery of a real state transition

1. On January 1, the system records `Alice current_role Engineer`.
2. On March 5, the system learns that Alice became Manager on March 1.

The resulting versions are:

```text
Engineer v1
  valid:  [Jan 1, infinity)
  system: [Jan 1, Mar 5)

Engineer v2
  valid:  [Jan 1, Mar 1)
  system: [Mar 5, infinity)

Manager v1
  valid:  [Mar 1, infinity)
  system: [Mar 5, infinity)
```

This answers:

- What did we believe on February 15? `Engineer v1`.
- What do we now believe was true on February 15? `Engineer v2`.
- What do we now believe was true on March 3? `Manager v1`.

## Fact schema changes

Extend `IFact` with the following fields:

```ts
export type FactRetirementReason =
  | 'corrected'
  | 'revised'
  | 'manually_archived'
  | 'entity_archived'
  | 'profile_replaced';

export type FactArchiveReason =
  | 'expired'
  | 'historical'
  | 'retired'
  | 'storage_compaction';

interface IFact {
  // Existing valid-time and record fields
  createdAt: Date;
  observedAt?: Date;
  validFrom?: Date;
  validUntil?: Date;

  // New system-time end
  retiredAt?: Date;
  retirementReason?: FactRetirementReason;

  // Version lineage
  lineageId?: FactId;
  revision?: number;
  supersedes?: FactId;

  // Physical storage lifecycle
  archived?: boolean;
  archivedAt?: Date;
  archiveReason?: FactArchiveReason;

  // Mutable reinforcement timestamp; does not rewrite the first observation
  lastObservedAt?: Date;
}
```

### Why `retiredAt` and `archived` are separate

`retiredAt` means the system stopped accepting that semantic version.

`archived` means the row is excluded from the hot/current dataset or physically moved to
the archive collection. It is a storage and default-visibility concern.

An expired fact can be physically archived while remaining accepted knowledge about the
past. Such a fact has:

```ts
{
  archived: true,
  archiveReason: 'expired',
  retiredAt: undefined,
}
```

A manually rejected fact has both:

```ts
{
  archived: true,
  archiveReason: 'retired',
  retiredAt: now,
  retirementReason: 'manually_archived',
}
```

### Lineage identity

- A root fact's effective lineage id is `fact.lineageId ?? fact.id`.
- New roots should persist `lineageId = id` after the adapter assigns the id.
- Revisions inherit the predecessor's effective lineage id.
- Revisions increment `revision`, starting at 1.
- `supersedes` remains the immediate backward link.

The optional-on-read fallback keeps pre-migration records usable.

## Query API

Add an explicit temporal query:

```ts
export interface TemporalQuery {
  /** External-world time being asked about. */
  validAt: Date;

  /** Knowledge snapshot. Defaults to now. */
  knownAt?: Date;
}

export interface FactFilter {
  temporal?: TemporalQuery;

  /**
   * @deprecated Shorthand for temporal: {validAt: asOf, knownAt: asOf}.
   */
  asOf?: Date;
}
```

Semantics:

- No `temporal`: preserve current archived-hidden behavior and hot paths.
- `{validAt: V}`: current knowledge about external-world time `V`.
- `{validAt: V, knownAt: K}`: knowledge at `K` about external-world time `V`.
- `{asOf: T}`: compatibility shorthand for `validAt=T, knownAt=T`.

Reject or explicitly define ambiguous combinations of `temporal` and `archived`. The
recommended public behavior is to reject them: temporal activity is not equivalent to
current physical archive status.

Add:

```ts
MemorySystem.getFactHistory(
  factId: FactId,
  scope: ScopeFilter,
): Promise<IFact[]>;
```

It returns the complete lineage from oldest to newest, including retired versions,
validity revisions, and retirement reasons.

## Write operations

### Correction or semantic revision

Add:

```ts
MemorySystem.reviseFact(
  oldId: FactId,
  patch: SemanticFactPatch,
  options: {
    reason: 'corrected' | 'revised';
    sourceSignalId?: string;
    evidenceQuote?: string;
    observedAt?: Date;
  },
  scope: ScopeFilter,
): Promise<IFact>;
```

Algorithm:

1. Load the predecessor and enforce write access.
2. Create a complete new fact version.
3. Inherit the effective lineage id and scope/access fields.
4. Increment `revision` and set `supersedes`.
5. Use the successor's `createdAt` as the predecessor's exclusive `retiredAt`.
6. Move the predecessor to archive storage.
7. Emit the existing supersession event plus a version-specific event if needed.

The new-version-first ordering remains crash-safe: a crash can temporarily leave two
visible versions, but never an interval with neither version. A repair pass can close the
predecessor using the successor's `createdAt`.

### Real-world state transition

Correction and transition must not be conflated.

- Correction: the old assertion was wrong or incomplete.
- Transition: the old assertion was true and later stopped being true.

Add:

```ts
MemorySystem.transitionFact(
  oldId: FactId,
  next: NewStateFactInput,
  options: {
    effectiveAt: Date;
    sourceSignalId?: string;
    evidenceQuote?: string;
  },
  scope: ScopeFilter,
): Promise<{
  boundedPrevious: IFact;
  current: IFact;
}>;
```

Algorithm:

1. Retire the previously unbounded version in system time.
2. Create a revised version of the old assertion with
   `validUntil = effectiveAt`.
3. Keep that bounded version system-active, because it remains accepted knowledge about
   the past.
4. Physically archive the bounded version with `archiveReason:'historical'`.
5. Create a new root assertion with `validFrom = effectiveAt`.
6. Inherit the predecessor's scope and access settings.

For predicate definitions with `lifecycle:'stateful'` and `singleValued:true`, automatic
conflict handling should use transition semantics when an effective time is available.
An explicit `supersedes` input continues to mean correction/revision for compatibility.

When a stateful input omits `validFrom`, use the authoritative signal observation time,
falling back to the write time. Callers may explicitly select correction semantics for
statements such as "Actually, my title was CTO, not CEO."

### Repeated observation and deduplication

The current deduplication path updates `observedAt`. Change it to:

- keep `observedAt` immutable as the first authoritative observation;
- update `lastObservedAt` monotonically;
- rank by `lastObservedAt ?? observedAt ?? createdAt`;
- avoid creating a version when the semantic assertion is identical.

### Manual archive

`archiveFact()` retires the semantic version and archives it physically:

```ts
{
  retiredAt: now,
  retirementReason: 'manually_archived',
  archived: true,
  archivedAt: now,
  archiveReason: 'retired',
}
```

### Validity expiry

`expireFacts()` is storage maintenance, not a knowledge correction:

```ts
{
  archived: true,
  archivedAt: now,
  archiveReason: 'expired',
  // retiredAt remains absent
}
```

The fact remains available to a temporal query whose `validAt` is inside its validity
interval.

### Restore

Do not clear `archived` on an old row. Doing so would erase the period in which it was
retired.

`restoreFact()` creates and returns a new revision:

```ts
const restored = await memory.restoreFact(oldId, scope);
// restored.id !== oldId
```

The prior version remains historical. If its valid interval has already ended, restoring
without a revised valid interval should warn or return a structured no-current-effect
result.

### Semantic in-place mutation

Deprecate public semantic use of `updateFact()` and `updateFactDetails()` in favor of
`reviseFact()`.

The low-level store patch primitive remains necessary for operational fields:

- embeddings and embedding input text;
- materialized read/write principals;
- ACL maintenance;
- canonical entity-reference rewrites after an entity merge;
- physical archive fields;
- `lastObservedAt`.

During the 1.x line, legacy `updateFact()` may remain available with documentation that
it bypasses temporal history. OneRingAI's own extraction and reconciliation paths should
move to versioned writes immediately. A future major release may make semantic in-place
mutation unavailable.

Aggregate facts remain explicitly outside full bitemporal guarantees until they are
versioned or modeled as append-only events.

## Adapter behavior

### In-memory adapter

- Store every version in the existing fact map.
- For temporal queries, ignore current `archived` state and evaluate valid/system
  intervals.
- For non-temporal queries, retain archived-hidden behavior.
- Semantic search applies the same temporal predicate before cosine scoring.
- Generic graph traversal automatically inherits the temporal behavior through
  `findFacts`.

### MongoDB live/archive union

Mongo deployments may move archived rows into `factsArchive`. A temporal query must
therefore query both collections.

Implementation:

1. Build identical permission, valid-time, and system-time filters for both collections.
2. Query live and archive collections independently.
3. Merge the sorted results.
4. Add an immutable-id tie-breaker to all temporal ordering.
5. Return an opaque composite cursor containing the consumed offset/cursor for each
   collection.

For existing offset cursors, fetch enough rows from both sources to select the next
page, count how many selected rows came from each source, and encode the two advanced
offsets in the returned cursor. Do not simply advance both sources by the fetched amount;
that would skip unconsumed rows.

Recommended indexes on both live and archive collections:

```text
subjectId + createdAt
objectId + createdAt
contextIds + createdAt
subjectId + predicate + createdAt
lineageId + revision
supersedes
```

Retain the current subject/object/context-led indexes for current hot-path reads.

### Historical graph traversal

Mongo `$graphLookup` can only traverse one collection at a time. Do not build a complex
multi-collection native graph pipeline initially.

- Current, non-temporal outbound/inbound traversal keeps the native fast path.
- Every temporal traversal uses the existing bounded generic BFS.
- BFS reads through the dual-collection temporal `findFacts` implementation.

Historical graph traversal is capped at five hops and 500 edges, so this is a reasonable
performance trade-off for a less frequent operation.

### Historical semantic search

To make temporal semantic search complete:

1. Create a vector index for `factsArchive`.
2. Declare `createdAt`, `retiredAt`, `validFrom`, and `validUntil` as vector filter paths.
3. Search live and archive indexes independently.
4. Request `topK` from each source.
5. Merge by score and take the global `topK`.

`ensureVectorSearchIndexes()` must create and verify the archive index and detect drift
in existing index definitions.

If the archive vector index is unavailable, throw a dedicated error such as
`HistoricalSemanticSearchUnavailableError`. Do not silently scan a capped subset or
return only live matches.

## `getContext` and profile behavior

`getContext()` currently mixes temporal fact filtering with the current entity, current
profile, and mutable task/event metadata.

Add `temporal?: TemporalQuery` to `ContextOptions`, and use these defaults for temporal
requests:

- `entity`: current canonical entity identity;
- `topFacts`: bitemporal;
- `neighbors`: bitemporal;
- `semantic`: bitemporal when historical vector search is available;
- `profile`: omitted by default, with an opt-in to select the profile active at
  `knownAt`;
- `relatedTasks` and `relatedEvents`: omitted by default because their entity metadata
  is mutable.

Return explicit coverage metadata:

```ts
interface TemporalCoverage {
  facts: 'bitemporal';
  graph: 'bitemporal';
  entity: 'current';
  profile: 'omitted' | 'knownAt';
  relatedEntities: 'omitted' | 'current';
}
```

This prevents callers from treating a partial temporal view as a complete database
snapshot.

`getProfile(entityId, scope)` should accept an optional `knownAt`. Profiles are document
facts and already form supersession chains, so selecting the system-active profile at a
knowledge time is possible. A profile is not automatically valid-time-specific; omit it
when the caller asks about a different valid time unless explicitly requested.

## Entity and task/event boundary

`IEntity` has `version`, `createdAt`, and `updatedAt`, but no retained versions.
`updateEntityMetadata()` overwrites metadata, and `transitionTaskState()` keeps a bounded
`metadata.stateHistory` whose `at` field is the effective transition time.

For the fact-level implementation:

- Entity IDs and display surfaces are resolved using the current canonical entity.
- Entity merges remain retroactive identity normalization; past facts are rewritten to
  the current canonical entity id.
- Temporal `getContext` omits task/event tiers by default.
- Task state history remains the current audit mechanism.

A later entity-temporal project would need:

- immutable entity revisions or an entity-history collection;
- separate effective and recorded times for task state transitions;
- temporal entity listing and semantic search;
- historical entity reference resolution;
- explicit interaction with entity merges and aliases.

That is not part of this design's initial implementation estimate.

## Agent-facing tools

Add `validAt` and `knownAt` to:

- `memory_recall`;
- `memory_graph`;
- `memory_search`;
- `memory_list_facts`.

Keep `asOf` as a deprecated shorthand.

Tool guidance must distinguish:

```text
"What was true on V?"
  -> validAt=V

"What did we know on K?"
  -> validAt=K, knownAt=K

"What did we know on K about date V?"
  -> validAt=V, knownAt=K
```

`archivedOnly` must no longer be described as the complete history view. Archived
storage and temporal history are different dimensions.

`memory_restore` must return the id of the new restored version. `memory_forget` should
continue to mean soft retirement unless a future, separately authorized purge tool is
introduced.

## Security, access, and deletion

Authorization is deliberately not bitemporal. A permission revoked today must not allow
the caller to read an old version merely because they could read it in the past.

Rules:

1. Every revision inherits current owner, group, permissions, and ACL fields.
2. Historical queries always apply current access policy.
3. `setAccess()` on a fact must update every version in the lineage.
4. Materialized principal backfills and entity-principal rewrites must include live and
   archive collections.
5. Scope boundaries remain enforced before temporal selection.

Retirement is not deletion. Add an explicit admin-only operation for privacy/compliance:

```ts
MemorySystem.purgeFactLineage(
  lineageId: FactId,
  scope: ScopeFilter,
): Promise<{deleted: number}>;
```

It hard-deletes every version from live and archive storage. It must be separately
authorized and must not be exposed as a normal LLM write tool by default.

## Atomicity and repair

The current supersession order is new-first, then predecessor archive. Preserve this
ordering because a crash produces a recoverable overlap rather than an invisible gap.

The current `IMongoCollectionLike.withTransaction` hook is not sufficient for claiming
atomicity: the raw wrapper starts a session, but collection operations do not currently
receive that session, and `MongoMemoryAdapter` does not wrap supersession through the
hook. A production transaction implementation must propagate a shared Mongo session to
every operation in the revision/transition unit.

Recommended rollout:

1. Ship correct crash-safe, repairable semantics first.
2. Add a repair operation that detects:
   - a successor whose predecessor lacks `retiredAt`;
   - inconsistent lineage/revision numbering;
   - overlapping active versions in one lineage;
   - orphaned archive rows.
3. Add a real adapter-level transaction/session primitive for raw Mongo.
4. Keep Meteor on crash-safe ordering plus repair unless its host supplies a safe
   transactional implementation.

Cross-process single-valued writes are already subject to a race in the current system.
Bitemporal support should not silently claim to solve it. A later hardening step may add
a compare-and-swap fact-head record or a host-installed uniqueness strategy.

## Migration

Provide an idempotent, resumable migration:

```ts
await memory.backfillTemporalMetadata(scope, {
  legacyArchivedPolicy: 'conservative',
});
```

Migration rules:

1. Live fact: leave `retiredAt` unset.
2. Archived fact with a successor: set `retiredAt = successor.createdAt` and infer a
   retirement reason.
3. Archived Mongo fact with `archivedAt`: use it when no more precise successor time
   exists.
4. Unknown legacy archived fact: in conservative mode, set
   `retiredAt = createdAt`, preventing forgotten data from unexpectedly reappearing in
   temporal queries.
5. Existing `observedAt` remains the first observation; initialize
   `lastObservedAt = observedAt` where appropriate.
6. Reconstruct lineage ids and revision numbers from supersession chains.
7. Backfill both live and archive collections.
8. Install temporal and lineage indexes after validating the backfill.

Offer an opt-in approximate policy for deployments that prefer richer legacy history,
for example using the migration time as an unknown retirement boundary or treating
archived facts with an already-ended `validUntil` as expiry archives. Conservative mode
must remain the default because it does not resurrect data that may have been explicitly
forgotten.

Migration reports should include:

- live facts inspected;
- archive facts inspected;
- exact retirement times inferred;
- approximate/unknown retirements;
- repaired chains;
- conflicts requiring operator review.

## Backward compatibility

1. `asOf` remains accepted as an alias for equal valid/knowledge times.
2. Non-temporal queries retain current archived-hidden behavior.
3. `archived` remains stored for current tools and physical archive routing.
4. Missing `lineageId` means the fact's own `id`.
5. Missing `revision` means revision 1.
6. Missing `retiredAt` means the version is system-active unless conservative migration
   metadata says otherwise.
7. Custom stores compile because additions to `FactFilter` are additive, but temporal
   capability must be explicit so an unsupported store cannot silently ignore the new
   filter.

Add a capability declaration or probe, for example:

```ts
interface MemoryStoreCapabilities {
  bitemporalFacts?: boolean;
  historicalSemanticSearch?: boolean;
}
```

`MemorySystem` must throw a structured unsupported-capability error when a requested
temporal operation cannot be implemented correctly.

## Testing strategy

Add parity tests for InMemory and Mongo covering at least:

1. Independent `validAt` and `knownAt` values.
2. Late discovery of a state transition.
3. Correction versus transition semantics.
4. Exact half-open boundary behavior.
5. Manual archive versus validity expiry.
6. Restore as a new version.
7. Dedup updating `lastObservedAt` without changing the first observation.
8. Live/archive merged pagination with ties.
9. Historical graph traversal across both collections.
10. Historical vector search and global top-K merging.
11. Current ACL enforcement across old versions.
12. Lineage-wide access changes.
13. Conservative legacy migration.
14. Crash repair after successor creation but before predecessor retirement.
15. Profile selection by `knownAt`.
16. Temporal `getContext` omitting mutable entity tiers.
17. Unsupported custom-store capability errors.

The implementation should add focused unit tests plus real Mongo integration coverage.
Atlas vector-index behavior requires either a dedicated Atlas test environment or an
explicit manual verification checklist in addition to mocked pipeline tests.

## Delivery phases

### Phase 0: terminology correction

- Replace current claims of full bitemporality with valid-time/supersession wording.
- Document current `asOf` behavior accurately.

### Phase 1: temporal fact core

- Add schema fields and query types.
- Implement independent valid/system filtering in InMemory and Mongo.
- Implement live/archive merged reads and composite cursors.
- Add `getFactHistory`.
- Preserve `asOf` compatibility.

### Phase 2: versioned writes

- Add `reviseFact` and `transitionFact`.
- Update supersession, archive, expiry, restore, and dedup semantics.
- Move internal extraction/reconciliation away from semantic in-place updates.
- Add lineage-wide ACL maintenance.

### Phase 3: graph, context, and tools

- Force temporal graph traversal through generic BFS.
- Add temporal `getContext` coverage behavior.
- Add `validAt`/`knownAt` to memory tools.
- Select historical profiles by knowledge time.

### Phase 4: historical vector search

- Add archive vector index creation and validation.
- Search and merge live/archive top-K results.
- Add explicit unsupported errors.

### Phase 5: migration and operational hardening

- Add resumable backfill and migration reporting.
- Add lineage repair.
- Add real Mongo session propagation and atomic revision support where available.
- Complete documentation, examples, and deployment checklist.

## Effort estimate

Assumption: one senior engineer already familiar with the memory subsystem, including
unit/integration tests and documentation.

| Work | Estimate |
|---|---:|
| Types, temporal semantics, compatibility aliases | 2–3 days |
| Versioned writes, transitions, restore, and expiry | 3–5 days |
| In-memory adapter and generic traversal | 1–2 days |
| Mongo dual-collection queries, cursors, and indexes | 4–6 days |
| Historical Atlas vector search | 2–3 days |
| `getContext`, profiles, and tools | 2–3 days |
| Migration, repair, and ACL lineage handling | 2–4 days |
| Tests, documentation, examples, and release work | 4–6 days |
| **Total** | **20–32 engineer-days** |

Expected calendar time for one engineer: approximately **4–6 weeks**.

A reduced MVP containing independent temporal filtering, correction history,
live/archive union, and historical graph traversal—but excluding historical semantic
search and state-transition rewriting—is approximately **8–12 engineer-days**.

Full bitemporal entities, tasks, events, and entity semantic search would add an
estimated **12–18 engineer-days** and should be designed as a separate project.

## Acceptance criteria

The fact-level design is complete when:

1. Callers can independently specify `validAt` and `knownAt`.
2. Corrections and state transitions produce different, correct histories.
3. Temporal queries include matching versions regardless of live/archive location.
4. InMemory and Mongo return equivalent results.
5. Historical graph traversal is complete and permission-safe.
6. Historical semantic search either returns complete merged results or fails
   explicitly.
7. Current reads retain their existing hot path and performance profile.
8. Restore does not rewrite the old system interval.
9. Access revocation applies to every historical version.
10. Existing deployments can migrate conservatively and resumably.
11. Documentation distinguishes fact/graph temporal guarantees from current entity
    state.
12. The project can accurately claim **bitemporal fact and graph memory**.

