/**
 * Entity-level `contextIds` — Phase 1-7 of the contextIds-on-entity feature.
 *
 * Covers:
 *   - Round-trip create/read/filter via `EntityListFilter.contextId`.
 *   - `addEntityContextIds` semantics: visibility-validation, dedupe,
 *     self-reference filter, union merge, optimistic-concurrency retry.
 *   - `upsertEntityBySurface` / extraction path: union on resolve, verbatim on
 *     create.
 *   - `mergeEntities` rewrites entity-level `contextIds` (loser → winner).
 *   - `archiveEntity` / `deleteEntity` tombstone rule — references untouched.
 *   - `resolveRelatedTasks` tier 1.5 (entity-contextIds, indexed path).
 *   - `ENTITIES_FILTER_PATHS` smoke test — guards against future filter-path
 *     omissions on the Atlas vector index (the recent FACTS_FILTER_PATHS
 *     lesson, applied to entities).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { EntityId, ScopeFilter } from '@/memory/types.js';

const USER = 'ec-test-user';
const SCOPE: ScopeFilter = { userId: USER };

async function makeTaskEntity(
  mem: MemorySystem,
  surface: string,
  contextIds?: EntityId[],
  metadata?: Record<string, unknown>,
): Promise<EntityId> {
  const res = await mem.upsertEntityBySurface(
    {
      surface,
      type: 'task',
      identifiers: [{ kind: 'canonical', value: `task:${surface.toLowerCase().replace(/\s+/g, '-')}` }],
      contextIds,
      metadata: metadata ?? { state: 'pending' },
    },
    SCOPE,
  );
  return res.entity.id;
}

async function makeAnchor(
  mem: MemorySystem,
  surface: string,
  type = 'project',
): Promise<EntityId> {
  const res = await mem.upsertEntityBySurface(
    {
      surface,
      type,
      identifiers: [{ kind: 'canonical', value: `${type}:${surface.toLowerCase().replace(/\s+/g, '-')}` }],
    },
    SCOPE,
  );
  return res.entity.id;
}

describe('entity contextIds — round-trip', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  it('creates an entity with contextIds set verbatim', async () => {
    const projectId = await makeAnchor(mem, 'Q3 Roadmap');
    const taskId = await makeTaskEntity(mem, 'Send budget', [projectId]);
    const task = await mem.getEntity(taskId, SCOPE);
    expect(task?.contextIds).toEqual([projectId]);
  });

  it('lists entities by contextId via EntityListFilter.contextId', async () => {
    const projectId = await makeAnchor(mem, 'Q3 Roadmap');
    const dealId = await makeAnchor(mem, 'Acme Deal', 'organization');
    const taskA = await makeTaskEntity(mem, 'Send budget', [projectId]);
    const taskB = await makeTaskEntity(mem, 'Merge PRs', [projectId, dealId]);
    const taskC = await makeTaskEntity(mem, 'Standalone task', []);

    const projectTasks = await mem.listEntities(
      { type: 'task', contextId: projectId },
      {},
      SCOPE,
    );
    const projectIds = projectTasks.items.map((e) => e.id).sort();
    expect(projectIds).toEqual([taskA, taskB].sort());

    const dealTasks = await mem.listEntities(
      { type: 'task', contextId: dealId },
      {},
      SCOPE,
    );
    expect(dealTasks.items.map((e) => e.id)).toEqual([taskB]);

    void taskC; // standalone task should appear in neither contextId filter result
  });

  it('contextIds=[] on input does not store empty array', async () => {
    const taskId = await makeTaskEntity(mem, 'Bare task', []);
    const task = await mem.getEntity(taskId, SCOPE);
    expect(task?.contextIds).toBeUndefined();
  });
});

describe('addEntityContextIds — write helper', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  it('unions new ids into existing contextIds (dedupe + order preserved)', async () => {
    const proj = await makeAnchor(mem, 'P');
    const deal = await makeAnchor(mem, 'D', 'organization');
    const taskId = await makeTaskEntity(mem, 'T', [proj]);

    const updated = await mem.addEntityContextIds(taskId, [proj, deal], SCOPE);
    expect(updated.entity.contextIds).toEqual([proj, deal]); // proj already present, deal appended
    expect(updated.added).toBe(1); // only deal was new
  });

  it('drops self-references silently', async () => {
    const taskId = await makeTaskEntity(mem, 'T');
    const updated = await mem.addEntityContextIds(taskId, [taskId], SCOPE);
    expect(updated.entity.contextIds).toBeUndefined(); // no-op
    expect(updated.added).toBe(0);
  });

  it('throws when an addition is not visible to caller scope', async () => {
    const otherUser: ScopeFilter = { userId: 'someone-else' };
    const taskId = await makeTaskEntity(mem, 'T');
    // Owned by `otherUser` AND permissions block cross-owner reads. The
    // default permissions (`world: 'read'`) would let USER see it; setting
    // both `world: 'none'` and `group: 'none'` makes it strictly owner-private.
    const otherProj = await mem.upsertEntity(
      {
        displayName: 'P',
        type: 'project',
        identifiers: [{ kind: 'canonical', value: 'project:p-other' }],
        permissions: { world: 'none', group: 'none' },
      },
      otherUser,
    );
    // Sanity: USER's scope cannot see it.
    const visibleFromUser = await mem.getEntity(otherProj.entity.id, SCOPE);
    expect(visibleFromUser).toBeNull();
    // addEntityContextIds refuses to write a contextId for an entity the
    // caller cannot see — the visibility check inside the helper throws.
    await expect(
      mem.addEntityContextIds(taskId, [otherProj.entity.id], SCOPE),
    ).rejects.toThrow(/not visible|not found/);
  });

  it('idempotent on re-add of the same ids', async () => {
    const proj = await makeAnchor(mem, 'P');
    const taskId = await makeTaskEntity(mem, 'T', [proj]);
    const v1 = await mem.getEntity(taskId, SCOPE);
    const after1 = await mem.addEntityContextIds(taskId, [proj], SCOPE);
    const after2 = await mem.addEntityContextIds(taskId, [proj], SCOPE);
    // No new writes for already-present ids — version unchanged, added=0.
    expect(after1.entity.version).toEqual(v1!.version);
    expect(after2.entity.version).toEqual(v1!.version);
    expect(after2.entity.contextIds).toEqual([proj]);
    expect(after1.added).toBe(0);
    expect(after2.added).toBe(0);
  });
});

describe('upsertEntityBySurface — union on resolve', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  it('union-merges contextIds on re-resolve via canonical id', async () => {
    const proj = await makeAnchor(mem, 'P');
    const deal = await makeAnchor(mem, 'D', 'organization');
    const taskId = await makeTaskEntity(mem, 'T', [proj]);

    // Second extraction with the same canonical id but a DIFFERENT context.
    const r2 = await mem.upsertEntityBySurface(
      {
        surface: 'T',
        type: 'task',
        identifiers: [{ kind: 'canonical', value: 'task:t' }],
        contextIds: [deal],
        metadata: { state: 'pending' },
      },
      SCOPE,
    );
    expect(r2.entity.id).toBe(taskId); // resolved to same task
    expect(r2.entity.contextIds?.sort()).toEqual([proj, deal].sort());
  });
});

describe('mergeEntities — rewrites entity-level contextIds', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  it('rewrites loser → winner on every entity that referenced loser', async () => {
    // Two near-duplicate "Acme" deals. Tasks bound to the loser must rebind.
    const acme1 = await makeAnchor(mem, 'Acme1', 'organization');
    const acme2 = await makeAnchor(mem, 'Acme2', 'organization');
    const taskA = await makeTaskEntity(mem, 'Send budget', [acme1]);
    const taskB = await makeTaskEntity(mem, 'Schedule call', [acme1]);
    const taskC = await makeTaskEntity(mem, 'Untouched task', [acme2]);

    await mem.mergeEntities(acme2, acme1, SCOPE);

    const a = await mem.getEntity(taskA, SCOPE);
    const b = await mem.getEntity(taskB, SCOPE);
    const c = await mem.getEntity(taskC, SCOPE);
    expect(a?.contextIds).toEqual([acme2]); // rewritten
    expect(b?.contextIds).toEqual([acme2]);
    expect(c?.contextIds).toEqual([acme2]); // already there, untouched
  });

  it('dedupes when the winner already exists in contextIds', async () => {
    const w = await makeAnchor(mem, 'Winner');
    const l = await makeAnchor(mem, 'Loser');
    const taskId = await makeTaskEntity(mem, 'T', [w, l]);
    await mem.mergeEntities(w, l, SCOPE);
    const t = await mem.getEntity(taskId, SCOPE);
    expect(t?.contextIds).toEqual([w]); // loser removed, winner not duplicated
  });

  it('suppresses self-reference when the entity itself happens to be the winner', async () => {
    const w = await makeAnchor(mem, 'WinnerProj');
    const l = await makeAnchor(mem, 'LoserProj');
    // Edge case: an entity with itself's eventual winner in contextIds (e.g.
    // pre-existing semantic noise). Merge must drop self.
    await mem.upsertEntityBySurface(
      {
        surface: 'WinnerProj',
        type: 'project',
        identifiers: [{ kind: 'canonical', value: 'project:winnerproj' }],
        contextIds: [l],
      },
      SCOPE,
    );
    await mem.mergeEntities(w, l, SCOPE);
    const winnerEntity = await mem.getEntity(w, SCOPE);
    expect(winnerEntity?.contextIds ?? []).not.toContain(w); // no self-reference
  });
});

describe('archive / delete — tombstone rule (no cascade through contextIds)', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  it('archiveEntity does NOT touch entities that reference it via contextIds', async () => {
    const proj = await makeAnchor(mem, 'P');
    const taskId = await makeTaskEntity(mem, 'T', [proj]);
    await mem.archiveEntity(proj, SCOPE);

    const task = await mem.getEntity(taskId, SCOPE);
    expect(task?.contextIds).toEqual([proj]); // still pointing — tombstone
    expect(task?.archived ?? false).toBe(false);
  });

  it('hard delete leaves entity-level contextIds references untouched', async () => {
    const proj = await makeAnchor(mem, 'P');
    const taskId = await makeTaskEntity(mem, 'T', [proj]);
    await mem.deleteEntity(proj, SCOPE, { hard: true });

    const task = await mem.getEntity(taskId, SCOPE);
    expect(task?.contextIds).toEqual([proj]); // dangling pointer — by design
  });
});

describe('resolveRelatedTasks — tier 1.5 (entity contextIds)', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  it('surfaces tasks bound to the subject via entity contextIds', async () => {
    const proj = await makeAnchor(mem, 'P');
    const taskA = await makeTaskEntity(mem, 'TA', [proj], { state: 'pending' });
    const taskB = await makeTaskEntity(mem, 'TB', [proj], { state: 'in_progress' });
    // A task in a different context — must NOT appear.
    const other = await makeAnchor(mem, 'X');
    await makeTaskEntity(mem, 'TC', [other], { state: 'pending' });

    const view = await mem.getContext(proj, {}, SCOPE);
    const related = view.relatedTasks ?? [];
    const ids = related.map((r) => r.task.id).sort();
    expect(ids).toEqual([taskA, taskB].sort());
    expect(related.every((r) => r.role === 'context_of')).toBe(true);
  });

  it('skips terminal-state tasks (state !== active)', async () => {
    const proj = await makeAnchor(mem, 'P');
    await makeTaskEntity(mem, 'TA', [proj], { state: 'done' });
    await makeTaskEntity(mem, 'TB', [proj], { state: 'cancelled' });

    const view = await mem.getContext(proj, {}, SCOPE);
    expect(view.relatedTasks ?? []).toEqual([]);
  });
});

describe('extraction-style two-pass with forward references', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  it('addEntityContextIds bridges Pass 1a → Pass 1b (forward ref works)', async () => {
    // Simulates the resolver's two-pass: task created BEFORE its contextIds
    // anchor exists in label→id map. Pass 1b backfills after all mentions
    // have been resolved.
    const taskId = await makeTaskEntity(mem, 'T'); // no contextIds at create
    const projId = await makeAnchor(mem, 'P'); // later

    const updated = await mem.addEntityContextIds(taskId, [projId], SCOPE);
    expect(updated.entity.contextIds).toEqual([projId]);
    expect(updated.added).toBe(1);

    // Filter sees it.
    const found = await mem.listEntities(
      { type: 'task', contextId: projId },
      {},
      SCOPE,
    );
    expect(found.items.map((e) => e.id)).toEqual([taskId]);
  });
});

describe('mergeEntities — large-scale pagination correctness (>200 referencing items)', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  it('rewrites ALL entity-level contextIds references when count exceeds 200', async () => {
    // The cursor-pagination shape used pre-fix would silently skip every
    // item past position 200: page 1 rewrites items 0..199, then cursor
    // advances to skip 200 — but the filter set has shrunk by 200, so
    // skip:200 lands past the remaining 50 unrewritten items → empty page
    // → loop exits with 50 entities still pointing at the loser. The fixed
    // shape re-queries from offset 0 each iteration; the rewrite drops items
    // from the filter so the next pass picks up the remainder.
    const loser = await makeAnchor(mem, 'Loser');
    const winner = await makeAnchor(mem, 'Winner');
    const N = 250;
    const ids: EntityId[] = [];
    for (let i = 0; i < N; i++) {
      ids.push(await makeTaskEntity(mem, `T${i}`, [loser]));
    }
    await mem.mergeEntities(winner, loser, SCOPE);
    let stillPointingAtLoser = 0;
    let pointingAtWinner = 0;
    for (const id of ids) {
      const e = await mem.getEntity(id, SCOPE);
      if (!e) continue;
      if (e.contextIds?.includes(loser)) stillPointingAtLoser++;
      if (e.contextIds?.includes(winner)) pointingAtWinner++;
    }
    expect(stillPointingAtLoser).toBe(0);
    expect(pointingAtWinner).toBe(N);
  });

  it('rewrites ALL fact-level subjectId references when count exceeds 200', async () => {
    // Same regression in pre-existing `rewriteFactReferences` (subject loop).
    // Reproduces by creating 250 facts whose subject is the loser, then
    // merging. Without the fix only the first 200 would be rewritten.
    const loser = await makeAnchor(mem, 'L', 'person');
    const winner = await makeAnchor(mem, 'W', 'person');
    const topic = await makeAnchor(mem, 'TOPIC', 'topic');
    const N = 250;
    for (let i = 0; i < N; i++) {
      await mem.addFact(
        {
          subjectId: loser,
          predicate: 'observed',
          kind: 'atomic',
          objectId: topic,
        },
        SCOPE,
      );
    }
    await mem.mergeEntities(winner, loser, SCOPE);
    const loserFacts = await mem.findFacts(
      { subjectId: loser },
      { limit: 300, orderBy: { field: 'createdAt', direction: 'asc' } },
      SCOPE,
    );
    const winnerFacts = await mem.findFacts(
      { subjectId: winner },
      { limit: 300, orderBy: { field: 'createdAt', direction: 'asc' } },
      SCOPE,
    );
    expect(loserFacts.items.length).toBe(0);
    expect(winnerFacts.items.length).toBe(N);
  });

  it('rewrites ALL fact-level contextIds references when count exceeds 200', async () => {
    // Same regression in pre-existing `rewriteFactReferences` (contextIds loop).
    const loser = await makeAnchor(mem, 'L', 'topic');
    const winner = await makeAnchor(mem, 'W', 'topic');
    const subj = await makeAnchor(mem, 'S', 'person');
    const obj = await makeAnchor(mem, 'O', 'organization');
    const N = 250;
    for (let i = 0; i < N; i++) {
      await mem.addFact(
        {
          subjectId: subj,
          predicate: 'observed',
          kind: 'atomic',
          objectId: obj,
          contextIds: [loser],
        },
        SCOPE,
      );
    }
    await mem.mergeEntities(winner, loser, SCOPE);
    const loserCtxFacts = await mem.findFacts(
      { contextId: loser },
      { limit: 300, orderBy: { field: 'createdAt', direction: 'asc' } },
      SCOPE,
    );
    const winnerCtxFacts = await mem.findFacts(
      { contextId: winner },
      { limit: 300, orderBy: { field: 'createdAt', direction: 'asc' } },
      SCOPE,
    );
    expect(loserCtxFacts.items.length).toBe(0);
    expect(winnerCtxFacts.items.length).toBe(N);
  });
});

describe('hoistContextIdsFromFactsToEntities — large-scale pagination', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  it('hoists contextIds from > 200 facts onto target entities (archiveSource: true)', async () => {
    // archiveSource:true triggers the same kind of bug rewriteFactReferences
    // had: archive removes facts from the `archived:false` filter, so
    // cursor-skip lands past the remainder. The fix loops without cursor.
    const proj = await makeAnchor(mem, 'P');
    const person = await makeAnchor(mem, 'Person', 'person');
    const N = 250;
    const taskIds: EntityId[] = [];
    for (let i = 0; i < N; i++) {
      const tid = await makeTaskEntity(mem, `T${i}`);
      taskIds.push(tid);
      await mem.addFact(
        {
          subjectId: person,
          predicate: 'committed_to',
          kind: 'atomic',
          objectId: tid,
          contextIds: [proj],
        },
        SCOPE,
      );
    }
    const result = await mem.hoistContextIdsFromFactsToEntities(
      {
        predicate: 'committed_to',
        entitySide: 'object',
        entityType: 'task',
        archiveSource: true,
        batchSize: 200,
      },
      SCOPE,
    );
    expect(result.scannedFacts).toBe(N);
    expect(result.hoistedEntities).toBe(N);
    expect(result.archivedFacts).toBe(N);
    expect(result.errors).toBe(0);
    // Every task got the project in its contextIds.
    let hoisted = 0;
    for (const tid of taskIds) {
      const t = await mem.getEntity(tid, SCOPE);
      if (t?.contextIds?.includes(proj)) hoisted++;
    }
    expect(hoisted).toBe(N);
  });
});

describe('optimistic-concurrency retry on resolve paths', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  it('upsertEntity dirty-merge path converges under concurrent identifier-match resolves', async () => {
    // Pre-fix: two concurrent `upsertEntity` calls resolving the same
    // entity by canonical identifier would race on `version + 1` writes —
    // the loser would throw `OptimisticConcurrencyError`. Post-fix: the
    // RMW retry loop re-reads `best` and converges.
    const projId = await makeAnchor(mem, 'P');
    const dealId = await makeAnchor(mem, 'D', 'organization');
    const taskRes = await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'T',
        identifiers: [{ kind: 'canonical', value: 'task:t' }],
      },
      SCOPE,
    );
    const taskId = taskRes.entity.id;
    // Two concurrent re-upserts of the same task, each adding a DIFFERENT
    // contextId. Without retry, one would throw.
    const [a, b] = await Promise.all([
      mem.upsertEntity(
        {
          type: 'task',
          displayName: 'T',
          identifiers: [{ kind: 'canonical', value: 'task:t' }],
          contextIds: [projId],
        },
        SCOPE,
      ),
      mem.upsertEntity(
        {
          type: 'task',
          displayName: 'T',
          identifiers: [{ kind: 'canonical', value: 'task:t' }],
          contextIds: [dealId],
        },
        SCOPE,
      ),
    ]);
    // Both calls succeeded — neither threw.
    expect(a.entity.id).toBe(taskId);
    expect(b.entity.id).toBe(taskId);
    // Both contextIds are present (union of the two writes).
    const finalTask = await mem.getEntity(taskId, SCOPE);
    const ctx = (finalTask?.contextIds ?? []).sort();
    expect(ctx).toEqual([projId, dealId].sort());
  });

  it('upsertEntityBySurface (appendAliasesAndIdentifiers) converges under concurrent resolves', async () => {
    // The resolver path goes through appendAliasesAndIdentifiers when a
    // surface resolves to an existing entity. Same RMW retry need.
    const projId = await makeAnchor(mem, 'P');
    const dealId = await makeAnchor(mem, 'D', 'organization');
    const taskId = await makeTaskEntity(mem, 'T');
    const [r1, r2] = await Promise.all([
      mem.upsertEntityBySurface(
        {
          surface: 'T',
          type: 'task',
          identifiers: [{ kind: 'canonical', value: 'task:t' }],
          contextIds: [projId],
        },
        SCOPE,
      ),
      mem.upsertEntityBySurface(
        {
          surface: 'T',
          type: 'task',
          identifiers: [{ kind: 'canonical', value: 'task:t' }],
          contextIds: [dealId],
        },
        SCOPE,
      ),
    ]);
    expect(r1.entity.id).toBe(taskId);
    expect(r2.entity.id).toBe(taskId);
    const final = await mem.getEntity(taskId, SCOPE);
    const ctx = (final?.contextIds ?? []).sort();
    expect(ctx).toEqual([projId, dealId].sort());
  });
});

describe('hoist migration counters', () => {
  let store: InMemoryAdapter;
  let mem: MemorySystem;

  beforeEach(() => {
    store = new InMemoryAdapter();
    mem = new MemorySystem({ store });
  });

  it('skippedAlreadyHoisted counts facts whose target already has every contextId', async () => {
    // Hoist twice. First run: all entities mutated → hoistedEntities = N.
    // Second run: every target already has the contextId → skippedAlreadyHoisted = N,
    // hoistedEntities = 0.
    const projId = await makeAnchor(mem, 'P');
    const personId = await makeAnchor(mem, 'Person', 'person');
    const N = 5;
    for (let i = 0; i < N; i++) {
      const tid = await makeTaskEntity(mem, `T${i}`);
      await mem.addFact(
        {
          subjectId: personId,
          predicate: 'committed_to',
          kind: 'atomic',
          objectId: tid,
          contextIds: [projId],
        },
        SCOPE,
      );
    }
    const first = await mem.hoistContextIdsFromFactsToEntities(
      {
        predicate: 'committed_to',
        entitySide: 'object',
        entityType: 'task',
      },
      SCOPE,
    );
    expect(first.hoistedEntities).toBe(N);
    expect(first.skippedAlreadyHoisted).toBe(0);

    const second = await mem.hoistContextIdsFromFactsToEntities(
      {
        predicate: 'committed_to',
        entitySide: 'object',
        entityType: 'task',
      },
      SCOPE,
    );
    expect(second.hoistedEntities).toBe(0);
    expect(second.skippedAlreadyHoisted).toBe(N);
    expect(second.scannedFacts).toBe(N);
  });

  it('dryRun reflects would-hoist accurately (skips no-ops)', async () => {
    // Mixed scenario: half the targets already have the contextId, half don't.
    // Dry-run should report hoistedEntities = half, skippedAlreadyHoisted = half.
    const projId = await makeAnchor(mem, 'P');
    const personId = await makeAnchor(mem, 'Person', 'person');
    const N = 4;
    for (let i = 0; i < N; i++) {
      // Half are created with the contextId already in place.
      const tid = i < N / 2
        ? await makeTaskEntity(mem, `T${i}`, [projId])
        : await makeTaskEntity(mem, `T${i}`);
      await mem.addFact(
        {
          subjectId: personId,
          predicate: 'committed_to',
          kind: 'atomic',
          objectId: tid,
          contextIds: [projId],
        },
        SCOPE,
      );
    }
    const dry = await mem.hoistContextIdsFromFactsToEntities(
      {
        predicate: 'committed_to',
        entitySide: 'object',
        entityType: 'task',
        dryRun: true,
      },
      SCOPE,
    );
    expect(dry.scannedFacts).toBe(N);
    expect(dry.hoistedEntities).toBe(N / 2);
    expect(dry.skippedAlreadyHoisted).toBe(N / 2);
    // No actual writes happened.
    const reCheck = await mem.hoistContextIdsFromFactsToEntities(
      {
        predicate: 'committed_to',
        entitySide: 'object',
        entityType: 'task',
        dryRun: true,
      },
      SCOPE,
    );
    expect(reCheck.hoistedEntities).toBe(N / 2);
    expect(reCheck.skippedAlreadyHoisted).toBe(N / 2);
  });
});

describe('ENTITIES_FILTER_PATHS smoke', () => {
  it("declares 'contextIds' so Atlas Vector Search honors the filter clause", async () => {
    // Re-imports the literal — regression guard against accidental removal.
    const mod = await import('@/memory/adapters/mongo/MongoMemoryAdapter.js');
    // The const is module-private (not exported). Use ensureVectorSearchIndexes
    // wrapper observability instead: confirm at least the entity vector index
    // builder logic includes contextIds via a snapshot of the module source.
    // Light-weight regex check; if someone removes the line the test fails.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'src',
      'memory',
      'adapters',
      'mongo',
      'MongoMemoryAdapter.ts',
    );
    const src = fs.readFileSync(file, 'utf8');
    const sliceStart = src.indexOf('const ENTITIES_FILTER_PATHS');
    expect(sliceStart).toBeGreaterThan(-1);
    const sliceEnd = src.indexOf('];', sliceStart);
    const block = src.slice(sliceStart, sliceEnd);
    expect(block).toContain("'contextIds'");
    // Sanity — module loads without error too.
    expect(mod).toBeDefined();
  });
});
