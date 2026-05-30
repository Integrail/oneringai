/**
 * Principal ACL — end-to-end matrix through MemorySystem.
 *
 * For every (record permission config × caller identity), on BOTH adapters and
 * for BOTH record kinds (entity + fact), this asserts:
 *   - READ:  getEntity/getFact visibility matches the independent oracle.
 *   - WRITE: the setAccess write-gate resolves / denies / not-founds exactly as
 *            the oracle predicts — i.e. a caller can mutate iff it has write,
 *            gets PermissionDeniedError if it can read-but-not-write, and a
 *            not-found error if it cannot even see the record.
 *
 * Running the SAME matrix on InMemoryAdapter and MongoMemoryAdapter(fake)
 * proves the two stores are observationally identical (the read filter is
 * enforced in-process for one and as a `readPrincipals: {$in}` query for the
 * other). A focused real-mutation block confirms the write gate is wired into
 * actual operations (archiveFact / archiveEntity / mergeEntities), not just
 * setAccess.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import { MongoMemoryAdapter } from '@/memory/adapters/mongo/MongoMemoryAdapter.js';
import { PermissionDeniedError } from '@/memory/AccessControl.js';
import type { IMemoryStore, ScopeFilter } from '@/memory/types.js';
import { FakeMongoCollection } from './adapters/mongo/FakeMongoCollection.js';
import {
  CONFIGS,
  CALLERS,
  OWNER,
  callerTokens,
  expectedAccess,
  type AclConfig,
  type Caller,
} from '../access/aclMatrix.fixtures.js';

type Kind = 'entity' | 'fact';

function makeMongo(): IMemoryStore {
  return new MongoMemoryAdapter({
    entities: new FakeMongoCollection('entities'),
    facts: new FakeMongoCollection('facts'),
    factsCollectionName: 'facts',
  });
}

// Create a record owned by OWNER, in config.groupId, with config's permissions
// + acl. `key` must be unique so entity upserts never dedupe across cells.
async function createRecord(
  mem: MemorySystem,
  kind: Kind,
  config: AclConfig,
  key: string,
  subjectId: string,
): Promise<string> {
  const ownerScope: ScopeFilter = { userId: OWNER, groupId: config.groupId };
  if (kind === 'fact') {
    const fact = await mem.addFact(
      {
        subjectId,
        predicate: 'note',
        kind: 'atomic',
        details: key,
        permissions: config.permissions,
        acl: config.acl,
      },
      ownerScope,
    );
    return fact.id;
  }
  const res = await mem.upsertEntity(
    {
      type: 'organization',
      displayName: `org-${key}`,
      identifiers: [{ kind: 'domain', value: `${key}.example` }],
      permissions: config.permissions,
      acl: config.acl,
    },
    ownerScope,
  );
  return res.entity.id;
}

async function readRecord(mem: MemorySystem, kind: Kind, id: string, principals: string[]) {
  return kind === 'fact'
    ? mem.getFact(id, { principals })
    : mem.getEntity(id, { principals });
}

async function attemptSetAccess(
  mem: MemorySystem,
  kind: Kind,
  id: string,
  principals: string[],
): Promise<'ok' | 'denied' | 'notfound'> {
  try {
    await mem.setAccess(kind, id, [], { principals });
    return 'ok';
  } catch (e) {
    // setAccess reads first (scope-filtered), then asserts write:
    //   readable + writable   → resolves            → 'ok'
    //   readable + NOT writable → PermissionDeniedError → 'denied'
    //   NOT readable          → "not found" Error   → 'notfound'
    return e instanceof PermissionDeniedError ? 'denied' : 'notfound';
  }
}

const ADAPTERS: Array<{ label: string; make: () => IMemoryStore; callers: Caller[] }> = [
  { label: 'InMemoryAdapter', make: () => new InMemoryAdapter(), callers: CALLERS },
  // FakeMongoCollection docs carry no `_id`, so the empty-principals
  // "match nothing" filter ({_id:{$exists:false}}) would wrongly match
  // everything on the fake. Real-Mongo empty behavior is covered by
  // MongoMemoryAdapter.principals.test.ts (scopeToFilter) + the InMemory matrix.
  { label: 'MongoMemoryAdapter(fake)', make: makeMongo, callers: CALLERS.filter((c) => c.name !== 'empty') },
];

for (const adapter of ADAPTERS) {
  for (const kind of ['entity', 'fact'] as const) {
    describe(`${adapter.label} — ${kind} ACL matrix`, () => {
      let mem: MemorySystem;
      let subjectId: string;

      beforeEach(async () => {
        mem = new MemorySystem({ store: adapter.make() });
        // World-readable, owner-owned, groupless subject for facts to hang off
        // (its own groupId being unset lets facts adopt any config groupId).
        const subj = await mem.upsertEntity(
          { type: 'topic', displayName: 'subject', identifiers: [{ kind: 'canonical', value: 'subj' }] },
          { userId: OWNER },
        );
        subjectId = subj.entity.id;
      });

      describe('reads — visibility matches the oracle', () => {
        it.each(CONFIGS.map((c) => [c.name, c] as const))('%s', async (_name, config) => {
          const id = await createRecord(mem, kind, config, `r-${config.name}`, subjectId);
          for (const caller of adapter.callers) {
            const got = await readRecord(mem, kind, id, callerTokens(caller));
            expect(
              got !== null,
              `${adapter.label}/${kind} READ ${config.name} / ${caller.name}`,
            ).toBe(expectedAccess(config, caller, 'read'));
          }
        });
      });

      describe('writes — setAccess gate matches the oracle', () => {
        it.each(CONFIGS.map((c) => [c.name, c] as const))('%s', async (_name, config) => {
          for (const caller of adapter.callers) {
            // Fresh record per caller — setAccess mutates the acl.
            const id = await createRecord(mem, kind, config, `w-${config.name}-${caller.name}`, subjectId);
            const outcome = await attemptSetAccess(mem, kind, id, callerTokens(caller));
            const wantWrite = expectedAccess(config, caller, 'write');
            const wantRead = expectedAccess(config, caller, 'read');
            const expectedOutcome = wantWrite ? 'ok' : wantRead ? 'denied' : 'notfound';
            expect(
              outcome,
              `${adapter.label}/${kind} WRITE ${config.name} / ${caller.name}`,
            ).toBe(expectedOutcome);
          }
        });
      });
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Real mutations enforce the write gate in principal mode (not just setAccess).
// ───────────────────────────────────────────────────────────────────────────
describe('principal mode — real mutations enforce write (InMemoryAdapter)', () => {
  const byName = (n: string): Caller => CALLERS.find((c) => c.name === n)!;
  const cfg = (n: string): AclConfig => CONFIGS.find((c) => c.name === n)!;
  let mem: MemorySystem;
  let subjectId: string;

  beforeEach(async () => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
    const subj = await mem.upsertEntity(
      { type: 'topic', displayName: 'subject', identifiers: [{ kind: 'canonical', value: 'subj' }] },
      { userId: OWNER },
    );
    subjectId = subj.entity.id;
  });

  it('archiveFact: read-only acl grantee is denied; owner succeeds', async () => {
    const alice = { principals: callerTokens(byName('alice-entity')) };
    const owner = { principals: callerTokens(byName('owner')) };

    const denyId = await createRecord(mem, 'fact', cfg('acl-entity-read'), 'arch-deny', subjectId);
    await expect(mem.archiveFact(denyId, alice)).rejects.toBeInstanceOf(PermissionDeniedError);
    // …and it really wasn't archived: still visible to the grantee.
    expect(await mem.getFact(denyId, alice)).not.toBeNull();

    const okId = await createRecord(mem, 'fact', cfg('acl-entity-read'), 'arch-ok', subjectId);
    await expect(mem.archiveFact(okId, owner)).resolves.toBeUndefined();
  });

  it('archiveFact: a write-acl grantee CAN archive', async () => {
    const alice = { principals: callerTokens(byName('alice-entity')) };
    const id = await createRecord(mem, 'fact', cfg('acl-entity-write'), 'arch-w', subjectId);
    await expect(mem.archiveFact(id, alice)).resolves.toBeUndefined();
  });

  it('archiveEntity: group member denied on group-read, allowed on group-write', async () => {
    const member = { principals: callerTokens(byName('group-member')) };

    const ro = await createRecord(mem, 'entity', cfg('group-private'), 'ent-ro', subjectId);
    await expect(mem.archiveEntity(ro, member)).rejects.toBeInstanceOf(PermissionDeniedError);

    const rw = await createRecord(mem, 'entity', cfg('group-write'), 'ent-rw', subjectId);
    await expect(mem.archiveEntity(rw, member)).resolves.toBeUndefined();
  });

  it('mergeEntities: denied when the caller lacks write on the loser', async () => {
    const member = { principals: callerTokens(byName('group-member')) };
    // Winner is group-writable (member CAN write); loser is group-read only
    // (member can read but NOT write) → the merge must be denied.
    const winner = await createRecord(mem, 'entity', cfg('group-write'), 'merge-win', subjectId);
    const loser = await createRecord(mem, 'entity', cfg('group-private'), 'merge-lose', subjectId);
    await expect(mem.mergeEntities(winner, loser, member)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    // Loser survived the denied merge.
    expect(await mem.getEntity(loser, member)).not.toBeNull();
  });

  it('mergeEntities: owner (write on both) succeeds', async () => {
    const owner = { principals: callerTokens(byName('owner')) };
    const winner = await createRecord(mem, 'entity', cfg('group-private'), 'm2-win', subjectId);
    const loser = await createRecord(mem, 'entity', cfg('group-private'), 'm2-lose', subjectId);
    await expect(mem.mergeEntities(winner, loser, owner)).resolves.toBeDefined();
  });
});
