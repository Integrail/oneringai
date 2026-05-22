# oneringai — Eliminate Silent Caps on Read APIs

**Status:** shipped (Layer 0 + Layer 1 + Layer 2 land together). Layer 3 deferred.

## The problem

Every high-level "list" method on `MemorySystem` silently clamped to a hard cap and returned a flat array. Sort order biased what was dropped.

| Method | Default | Hard cap | Sort | Silently dropped |
|---|---|---|---|---|
| `listOpenTasks` | 50 | 200 | dueAt asc, nulls-last | Future/undated tasks past 200 |
| `listRecentTopics` | 50 | 200 | updatedAt desc | Older topics past 200 |
| `resolveRelatedItems` | 50 | 200 | per-bucket FIFO | Items past cap per bucket |
| `findSimilarOpenTasks` | topK 10 | 100 | score desc | Lower-scored past topK |
| `getContext` topFacts | 15 | (over-fetches *3 then slices) | confidence/recency | Lower-ranked past 15 |
| `resolveRelatedTasks` (private) | 15 | — | role-loop FIFO | Tasks past 15 |
| `resolveRelatedEvents` (private) | 15 | 200/100 sub | dedup+FIFO | Events past 15, outside 90d |

The audit also surfaced that **`resolveRelatedTasks`, `resolveRelatedEvents`, `PredicateRegistry.renderForPrompt`** all paired their caps with NO sort — every result feeding `getContext` for LLM consumption was effectively random within the cap. A meeting tomorrow could be silently dropped from "related events" while a 89-day-old one stayed, depending on insertion order.

## Layer 0 — Sort fixes (correctness, no API change)

### `resolveRelatedTasks` (`MemorySystem.ts:2089`)

- Per-role `listEntities` calls (assigneeId / reporterId / projectId): `orderBy = [{field:'metadata.dueAt', direction:'asc'}, {field:'updatedAt', direction:'desc'}, {field:'id', direction:'asc'}]`. Same nulls-last semantics as `listOpenTasks`.
- Fact-context fallback (`findFacts({contextId: entityId})`): `orderBy = {field:'observedAt', direction:'desc'}`. Recent context wins.
- After both sources accumulate into the Map, **final sort by `compareTaskByDueThenRecency` before the slice** — without this, merge order biases by source (all assignee first, then reporter, then context_of last) regardless of dueAt.

### `resolveRelatedEvents` (`MemorySystem.ts:2153`)

- First-tier `listEntities({type:'event'})`: `orderBy = [{field:'metadata.startTime', direction:'desc'}, {field:'id', direction:'asc'}]`. Most-recent events first; the 90-day window filter becomes a tail trim instead of a near-random sample.
- Fact-context fallback: `orderBy = {field:'observedAt', direction:'desc'}`.
- Tier-3 `attended`/`hosted` fact loops: `orderBy = {field:'observedAt', direction:'desc'}`.
- Final dedup'd values sorted by `compareEventByWhenDesc` (when desc, nulls-last, id tiebreak) before slice.
- **Known limitation deferred:** the 90-day window filter is still applied client-side because adapters don't yet support range queries on `metadata.startTime`. With sort fixed, the bias goes from "random 200" to "most-recent 200" — adequate. Filed as follow-up to push the range into `metadataFilter`.

### `getContext` topFacts (`MemorySystem.ts:1853`)

- Over-fetch ratio bumped from `topFactsLimit * 3` to `topFactsLimit * 10` via new `TOP_FACTS_OVERFETCH_MULTIPLIER` constant. At 3×, a high-importance fact at storage position 46 never reaches the ranker. At 10×, the ranker sees 150 candidates and produces the actual top 15 by confidence × recency × predicate weight × importance.

### `PredicateRegistry.renderForPrompt`

- Each category sorted by `(defaultImportance desc, name asc)` before `.slice(0, maxPerCategory)`. Highest-importance predicates within each category survive the cap. Tie-break by name for deterministic prompt output.

### Adapter contract hardening

- `MongoMemoryAdapter.listEntities` + `findFacts` and `InMemoryAdapter.listEntities` + `findFacts` emit one `console.warn` per call when `limit` is set but `orderBy` is undefined. Warning text quotes the method, includes a stack trace pointing at the offending call site, recommends fixing.
- Suppress with `ONERINGAI_SUPPRESS_ORDER_WARNINGS=1` (e.g., for audit-dump callers that genuinely want natural order).
- New file: `src/memory/adapters/orderByWarning.ts` (shared helper, both adapters import).

## Layer 1 — Async iterators (no silent caps, ever)

Four new methods on `MemorySystem`. Each is a thin cursor-pagination wrapper over the existing adapter-level `Page<T>` support. Use when you need EVERY matching row (audit sweeps, status refresh across all open tasks, backfills); use the existing flat-array `listX` methods when you need a small bounded slice (prompt injection).

```ts
async *iterateOpenTasks(scope, { assigneeId?, projectId?, batchSize?, startAfter? }): AsyncIterable<IEntity[]>;
async *iterateRecentTopics(scope, { days?, batchSize?, startAfter? }): AsyncIterable<IEntity[]>;
async *iterateEntitiesByFilter(filter, scope, { batchSize?, startAfter?, orderBy }): AsyncIterable<IEntity[]>;
async *iterateFacts(query, scope, { batchSize?, startAfter?, orderBy }): AsyncIterable<IFact[]>;
```

- `batchSize` default 200, max 1000. Tunes memory pressure vs round-trip count.
- `startAfter` exposes the cursor for resumable jobs — checkpoint mid-stream, resume from same position on restart.
- The two generic iterators (`iterateEntitiesByFilter`, `iterateFacts`) REQUIRE the caller to pass `orderBy` — they don't have a sensible default and we won't degrade silently.
- `iterateOpenTasks` mirrors `listOpenTasks` sort (dueAt asc nulls-last, updatedAt desc, id asc).
- `iterateRecentTopics` early-terminates once a batch contains topics older than the cutoff — no point fetching deeper.

## Layer 2 — Truncation warnings on flat-array list methods

- `listOpenTasks` and `listRecentTopics` emit a `console.warn` when:
  - the result length equals the requested limit AND
  - the underlying `Page` has `nextCursor` set (more rows exist).
- Warning text recommends the matching `iterateX` for full-coverage cases.
- Suppress with `ONERINGAI_SUPPRESS_CAP_WARNINGS=1` for genuine prompt-budget callers (they've opted into the cap).
- Helper: module-level `warnIfTruncated()` in `MemorySystem.ts`. Test-only `_resetCapWarningSuppression()` exported for vitest env-var swap.

## Tests

New file: `tests/unit/memory/MemorySystem.pagination-no-silent-caps.test.ts` — 18 tests, all passing:

- `resolveRelatedItems` regression: 20 tasks seeded reverse-relevance order → cap=5 → asserts the 5 earliest-due (1-5d out) survive, not the first-inserted. Plus nulls-last verification (dated tasks all rank before undated).
- `resolveRelatedItems` events: 10 events seeded oldest-first → cap=5 → asserts the 5 newest survive (day-9 .. day-5).
- `PredicateRegistry.renderForPrompt`: importance-ordered output; tie-break by name; high-importance survives under cap.
- `iterateOpenTasks`: 500 tasks → consumed via cursor → all 500 returned. dueAt-asc-nulls-last ordering preserved across batches. assigneeId filter honored mid-iteration. Empty set completes without yielding.
- `iterateEntitiesByFilter` + `iterateFacts`: 350 events / 300 facts → all walked.
- Adapter limit-without-orderBy warning: fires, doesn't fire when orderBy set, doesn't fire when limit omitted, suppressed by env var.
- `listOpenTasks` cap warning: fires at limit-reached + nextCursor present, silent when result < limit, suppressed by env var.

One pre-existing test updated: `MemorySystem.lifecycle.test.ts` `includeExcluded: true surfaces them` now passes `maxPerCategory: 50` — it was implicitly relying on the broken insertion-order sort to surface `mentioned` (importance 0.3, correctly demoted under default cap of 5 by 0.4-tier predicates).

Full memory suite: **1063 passed, 0 regressions** caused by these changes. (Four pre-existing failures in unrelated files — Google tools, OAuth, image generation, vendorHelpers — verified to pre-exist on clean main via `git stash` + re-run.)

## What's NOT in scope (separate follow-ups)

- `defaultExtractionPrompt.ts` prompt-budget caps (`.slice(0, 40)` entities, `.slice(0, 2)` aliases, `.slice(0, 5)` examples). Legitimate token-budget controls. Document, don't change.
- `DEFAULT_EMBED_SOURCE_CHAR_LIMIT = 32_000`. Real data-quality issue (embeddings miss content past 32k chars) — separate plan.
- `DEFAULT_STATE_HISTORY_CAP = 200`. Write-side cap with documented escape hatch (the immutable `state_changed` fact graph keeps full history). Not a read-API issue. Optional follow-up: emit a getter so apps can see the configured cap.
- Pushing `metadata.startTime` range filter into adapter `metadataFilter` for `resolveRelatedEvents` — eliminates the client-side window filter pass entirely. Requires adapter range-query support.
- Layer 3 (deferred): caller migration + default audit. Once apps adopt iterators broadly, audit every `listOpenTasks` / `listRecentTopics` call site, force explicit `limit`, then drop the defaults. TypeScript-level enforcement of "orderBy required when limit set" comes with this.

## Library version

Bumped to next patch (0.7.2) so icos can pin and pull the fixes.
