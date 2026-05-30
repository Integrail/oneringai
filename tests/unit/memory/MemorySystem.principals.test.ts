/**
 * Principal access model — MemorySystem + InMemoryAdapter integration.
 *
 * Covers: write-time materialization, principal-scoped reads, the
 * empty-principals "see nothing" rule, legacy backward-compat, merge-time ACL
 * rewrite (the "account links later" substrate), setAccess, updateFact
 * recompute, and the backfillAccessPrincipals migration path.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import { canAccess } from '@/memory/AccessControl.js';
import { principalEntity } from '@/access/principals.js';
import type { IEntity, IFact, NewFact, ScopeFilter } from '@/memory/types.js';

const OWNER = 'owner1';
const GROUP = 'g1';
const SCOPE: ScopeFilter = { userId: OWNER, groupId: GROUP };
const PRIVATE = { group: 'none', world: 'none' } as const;

function buildMem(): MemorySystem {
  return new MemorySystem({ store: new InMemoryAdapter() });
}

async function seedSubject(mem: MemorySystem): Promise<string> {
  const r = await mem.upsertEntity(
    { type: 'topic', displayName: 'Topic', identifiers: [] },
    SCOPE,
  );
  return r.entity.id;
}

describe('write-time materialization', () => {
  let mem: MemorySystem;
  beforeEach(() => {
    mem = buildMem();
  });

  it('group-shared entity → owner + group, no world', async () => {
    const { entity } = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'P',
        identifiers: [{ kind: 'email', value: 'p@x.com' }],
        permissions: { group: 'read', world: 'none' },
      },
      SCOPE,
    );
    const stored = (await mem.getEntity(entity.id, SCOPE))!;
    expect([...stored.readPrincipals!].sort()).toEqual([`group:${GROUP}`, `user:${OWNER}`]);
    expect(stored.writePrincipals).toEqual([`user:${OWNER}`]);
  });

  it('user-private fact → owner only', async () => {
    const subj = await seedSubject(mem);
    const fact = await mem.addFact(
      { subjectId: subj, predicate: 'note', kind: 'atomic', details: 'x', permissions: PRIVATE },
      SCOPE,
    );
    expect(fact.readPrincipals).toEqual([`user:${OWNER}`]);
  });

  it('acl grant lands in readPrincipals', async () => {
    const subj = await seedSubject(mem);
    const fact = await mem.addFact(
      {
        subjectId: subj,
        predicate: 'note',
        kind: 'atomic',
        details: 'x',
        permissions: PRIVATE,
        acl: [{ principal: principalEntity('alice'), actions: ['read'] }],
      },
      SCOPE,
    );
    expect([...fact.readPrincipals!].sort()).toEqual(['entity:alice', `user:${OWNER}`]);
  });
});

describe('principal-scoped reads', () => {
  let mem: MemorySystem;
  let factId: string;
  beforeEach(async () => {
    mem = buildMem();
    const subj = await seedSubject(mem);
    const f = await mem.addFact(
      {
        subjectId: subj,
        predicate: 'note',
        kind: 'atomic',
        details: 'secret',
        permissions: PRIVATE,
        acl: [{ principal: principalEntity('alice'), actions: ['read'] }],
      },
      SCOPE,
    );
    factId = f.id;
  });

  it('a holder of the granted entity principal can read', async () => {
    const seen = await mem.getFact(factId, { principals: [principalEntity('alice')] });
    expect(seen).not.toBeNull();
  });

  it('a non-holder cannot read', async () => {
    const notSeen = await mem.getFact(factId, { principals: [principalEntity('bob')] });
    expect(notSeen).toBeNull();
  });

  it('empty principals set sees nothing (authoritative empty)', async () => {
    expect(await mem.getFact(factId, { principals: [] })).toBeNull();
  });

  it('legacy caller (no principals) still reads own records — backward compat', async () => {
    const seen = await mem.getFact(factId, { userId: OWNER, groupId: GROUP });
    expect(seen).not.toBeNull();
  });
});

describe('canAccess — principal presence is authoritative, no legacy fallback', () => {
  // World-readable by the LEGACY default (no readPrincipals materialized).
  const unmaterialized = { ownerId: 'u1', groupId: 'g1' };

  it('empty principals deny even an un-materialized world-readable row', () => {
    expect(canAccess(unmaterialized, { principals: [] }, 'read')).toBe(false);
  });

  it('non-empty principals deny an un-materialized row (must backfill first)', () => {
    expect(canAccess(unmaterialized, { principals: ['user:u1'] }, 'read')).toBe(false);
  });

  it('a materialized row is authorized only by an intersecting principal', () => {
    const mat = { ownerId: 'u1', readPrincipals: ['user:u1'], writePrincipals: ['user:u1'] };
    expect(canAccess(mat, { principals: ['user:u1'] }, 'read')).toBe(true);
    expect(canAccess(mat, { principals: ['user:other'] }, 'read')).toBe(false);
  });

  it('a caller with no principals uses the unchanged legacy path', () => {
    expect(canAccess(unmaterialized, { userId: 'u1' }, 'read')).toBe(true);
  });
});

describe('merge rewrites ACL grants (account-links-later substrate)', () => {
  it('a grant to the loser becomes a grant to the winner after merge', async () => {
    const mem = buildMem();
    const w = (
      await mem.upsertEntity(
        { type: 'person', displayName: 'Winner', identifiers: [{ kind: 'email', value: 'w@x.com' }] },
        SCOPE,
      )
    ).entity.id;
    const l = (
      await mem.upsertEntity(
        { type: 'person', displayName: 'Loser', identifiers: [{ kind: 'email', value: 'l@x.com' }] },
        SCOPE,
      )
    ).entity.id;
    const subj = await seedSubject(mem);
    const f = await mem.addFact(
      {
        subjectId: subj,
        predicate: 'note',
        kind: 'atomic',
        details: 're loser',
        permissions: PRIVATE,
        acl: [{ principal: principalEntity(l), actions: ['read'] }],
      },
      SCOPE,
    );

    // Pre-merge: winner principal can't see it; loser principal can.
    expect(await mem.getFact(f.id, { principals: [principalEntity(w)] })).toBeNull();
    expect(await mem.getFact(f.id, { principals: [principalEntity(l)] })).not.toBeNull();

    await mem.mergeEntities(w, l, SCOPE);

    const after = await mem.getFact(f.id, { principals: [principalEntity(w)] });
    expect(after).not.toBeNull();
    expect(after!.readPrincipals).toContain(principalEntity(w));
    expect(after!.readPrincipals).not.toContain(principalEntity(l));
  });
});

describe('setAccess', () => {
  it('grants a principal read and re-materializes the arrays', async () => {
    const mem = buildMem();
    const subj = await seedSubject(mem);
    const f = await mem.addFact(
      { subjectId: subj, predicate: 'note', kind: 'atomic', details: 'p', permissions: PRIVATE },
      SCOPE,
    );
    expect(await mem.getFact(f.id, { principals: [principalEntity('bob')] })).toBeNull();

    await mem.setAccess('fact', f.id, [{ principal: principalEntity('bob'), actions: ['read'] }], SCOPE);

    const seen = (await mem.getFact(f.id, { principals: [principalEntity('bob')] })) as IFact | null;
    expect(seen).not.toBeNull();
    expect(seen!.readPrincipals).toContain(principalEntity('bob'));
    expect(seen!.writePrincipals).not.toContain(principalEntity('bob'));
  });
});

describe('updateFact recompute on access-field patch (adapter level)', () => {
  it('patching acl re-materializes readPrincipals', async () => {
    const adapter = new InMemoryAdapter();
    const f = await adapter.createFact({
      subjectId: 's',
      predicate: 'p',
      kind: 'atomic',
      ownerId: OWNER,
      permissions: PRIVATE,
    } as NewFact);
    expect(f.readPrincipals).toEqual([`user:${OWNER}`]);

    await adapter.updateFact(
      f.id,
      { acl: [{ principal: principalEntity('bob'), actions: ['read'] }] },
      { userId: OWNER },
    );
    const got = (await adapter.getFact(f.id, { userId: OWNER }))!;
    expect([...got.readPrincipals!].sort()).toEqual(['entity:bob', `user:${OWNER}`]);
  });

  it('a non-access patch leaves the arrays untouched', async () => {
    const adapter = new InMemoryAdapter();
    const f = await adapter.createFact({
      subjectId: 's',
      predicate: 'p',
      kind: 'atomic',
      ownerId: OWNER,
      permissions: PRIVATE,
    } as NewFact);
    await adapter.updateFact(f.id, { importance: 0.9 }, { userId: OWNER });
    const got = (await adapter.getFact(f.id, { userId: OWNER }))!;
    expect(got.readPrincipals).toEqual([`user:${OWNER}`]);
  });
});

describe('backfillAccessPrincipals', () => {
  function seedRows(): { adapter: InMemoryAdapter } {
    // Seeded via the constructor → indexed WITHOUT materialization (no
    // readPrincipals), exactly like pre-migration rows.
    const entity: IEntity = {
      id: 'e-seed',
      type: 'person',
      displayName: 'Seed',
      identifiers: [{ kind: 'email', value: 's@x.com' }],
      ownerId: OWNER,
      groupId: GROUP,
      permissions: { group: 'read', world: 'none' },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const fact: IFact = {
      id: 'f-seed',
      subjectId: 'e-seed',
      predicate: 'note',
      kind: 'atomic',
      details: 'x',
      ownerId: OWNER,
      groupId: GROUP,
      permissions: { group: 'none', world: 'none' },
      acl: [{ principal: principalEntity('alice'), actions: ['read'] }],
      createdAt: new Date(),
    };
    return { adapter: new InMemoryAdapter({ entities: [entity], facts: [fact] }) };
  }

  it('populates arrays so a principal caller can see a previously-invisible row', async () => {
    const { adapter } = seedRows();
    const mem = new MemorySystem({ store: adapter });

    // Pre-backfill: principal caller falls back to legacy on the un-materialized
    // fact → alice is not owner → denied.
    expect(await mem.getFact('f-seed', { principals: [principalEntity('alice')] })).toBeNull();

    const res = await mem.backfillAccessPrincipals(SCOPE);
    expect(res.entitiesUpdated).toBe(1);
    expect(res.factsUpdated).toBe(1);

    // Post-backfill: alice's grant is now materialized → visible.
    expect(await mem.getFact('f-seed', { principals: [principalEntity('alice')] })).not.toBeNull();
  });

  it('is idempotent (second run updates nothing)', async () => {
    const { adapter } = seedRows();
    const mem = new MemorySystem({ store: adapter });
    await mem.backfillAccessPrincipals(SCOPE);
    const res2 = await mem.backfillAccessPrincipals(SCOPE);
    expect(res2.entitiesUpdated).toBe(0);
    expect(res2.factsUpdated).toBe(0);
  });

  it('force rewrites every row', async () => {
    const { adapter } = seedRows();
    const mem = new MemorySystem({ store: adapter });
    await mem.backfillAccessPrincipals(SCOPE);
    const res = await mem.backfillAccessPrincipals(SCOPE, { force: true });
    expect(res.entitiesUpdated).toBe(1);
    expect(res.factsUpdated).toBe(1);
  });

  it('materializes every fact across pages even when createdAt ties (no boundary skip)', async () => {
    // All facts share ONE createdAt instant — the bulk-ingest case that made
    // offset pagination over a non-unique `createdAt` sort fragile. The backfill
    // now pages by the unique `_id`, so a small batchSize (multiple pages) must
    // still touch every fact exactly once.
    const sharedTs = new Date('2026-01-01T00:00:00.000Z');
    const facts: IFact[] = Array.from({ length: 7 }, (_, i) => ({
      id: `f-${i}`,
      subjectId: 's',
      predicate: 'note',
      kind: 'atomic',
      details: `d${i}`,
      ownerId: OWNER,
      groupId: GROUP,
      permissions: { group: 'none', world: 'none' },
      createdAt: sharedTs,
    }));
    const adapter = new InMemoryAdapter({ facts });
    const mem = new MemorySystem({ store: adapter });

    const res = await mem.backfillAccessPrincipals(SCOPE, { batchSize: 2 });
    expect(res.factsScanned).toBe(7);
    expect(res.factsUpdated).toBe(7);

    // Every fact is now visible to the owner principal — none skipped at a
    // page boundary.
    for (let i = 0; i < 7; i++) {
      const seen = await mem.getFact(`f-${i}`, { principals: [`user:${OWNER}`] });
      expect(seen, `fact f-${i} should be materialized`).not.toBeNull();
    }
  });

  it('backfills archived entities too (not just live)', async () => {
    const mkEntity = (id: string, archived: boolean): IEntity => ({
      id,
      type: 'person',
      displayName: id,
      identifiers: [{ kind: 'email', value: `${id}@x.com` }],
      ownerId: OWNER,
      groupId: GROUP,
      permissions: { group: 'read', world: 'none' },
      archived,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const adapter = new InMemoryAdapter({
      entities: [mkEntity('e-live', false), mkEntity('e-arch', true)],
    });
    const mem = new MemorySystem({ store: adapter });

    const res = await mem.backfillAccessPrincipals(SCOPE);
    expect(res.entitiesUpdated).toBe(2); // both live AND archived

    const archived = await adapter.listEntities(
      { archived: true },
      { limit: 50, orderBy: { field: '_id', direction: 'asc' } },
      SCOPE,
    );
    const arch = archived.items.find((e) => e.id === 'e-arch')!;
    expect(arch.readPrincipals).toEqual([`group:${GROUP}`, `user:${OWNER}`]);
  });
});
