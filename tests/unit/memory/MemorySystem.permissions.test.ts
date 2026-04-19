/**
 * MemorySystem — permissions end-to-end.
 *
 * Covers:
 *   - Owner-required invariant at entity + fact creation (OwnerRequiredError).
 *   - Admin delegation: caller with scope.userId=A may create records with
 *     ownerId=B (admin setting ownership on behalf of another user).
 *   - Write-path authorization: mutation methods throw PermissionDeniedError
 *     when the caller has read access but not write access.
 *   - Read-path filtering: world=none records hidden from non-owner, non-group
 *     callers via the adapter's native visibility filter.
 *   - Merge / archive cascade respects write permissions (skips unwritable).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MemorySystem,
  OwnerRequiredError,
  PermissionDeniedError,
} from '@/memory/index.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { Permissions, ScopeFilter } from '@/memory/types.js';

function makeSystem() {
  return { store: new InMemoryAdapter(), mem: new MemorySystem({ store: new InMemoryAdapter() }) };
}

describe('MemorySystem — owner-required invariant', () => {
  let mem: MemorySystem;
  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
  });
  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('throws OwnerRequiredError on entity create when scope.userId and input.ownerId both absent', async () => {
    await expect(
      mem.upsertEntity(
        {
          type: 'person',
          displayName: 'Anon',
          identifiers: [{ kind: 'email', value: 'a@a.com' }],
        },
        {},
      ),
    ).rejects.toBeInstanceOf(OwnerRequiredError);
  });

  it('defaults ownerId from scope.userId when not specified', async () => {
    const res = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'A',
        identifiers: [{ kind: 'email', value: 'a@a.com' }],
      },
      { userId: 'u1' },
    );
    expect(res.entity.ownerId).toBe('u1');
  });

  it('admin delegation: explicit input.ownerId is honored even when different from scope.userId', async () => {
    const res = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Delegated',
        identifiers: [{ kind: 'email', value: 'd@d.com' }],
        ownerId: 'other-user',
      },
      { userId: 'admin-user' },
    );
    expect(res.entity.ownerId).toBe('other-user');
  });

  it('throws OwnerRequiredError on fact when subject has no ownerId AND caller passes none', async () => {
    // Backdoor into the store to insert a legacy ownerless entity.
    const store = (mem as unknown as { store: InMemoryAdapter }).store;
    const legacy = await store.createEntity({
      type: 'person',
      displayName: 'Legacy',
      identifiers: [],
    });
    await expect(
      mem.addFact(
        { subjectId: legacy.id, predicate: 'note', kind: 'atomic', value: 'x' },
        {},
      ),
    ).rejects.toBeInstanceOf(OwnerRequiredError);
  });

  it('fact auto-inherits ownerId from subject entity', async () => {
    const res = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'P',
        identifiers: [{ kind: 'email', value: 'p@p.com' }],
      },
      { userId: 'u1' },
    );
    const fact = await mem.addFact(
      { subjectId: res.entity.id, predicate: 'note', kind: 'atomic', value: 'hi' },
      { userId: 'u1' },
    );
    expect(fact.ownerId).toBe('u1');
  });
});

// -----------------------------------------------------------------------------

describe('MemorySystem — write-path authorization', () => {
  let mem: MemorySystem;
  let ownerScope: ScopeFilter;
  let intruderScope: ScopeFilter;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
    ownerScope = { userId: 'owner' };
    intruderScope = { userId: 'intruder' };
  });
  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  async function seedEntity(permissions?: Permissions) {
    const r = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Victim',
        identifiers: [{ kind: 'email', value: 'v@v.com' }],
        permissions,
      },
      ownerScope,
    );
    return r.entity;
  }

  async function seedFact(subjectId: string, permissions?: Permissions) {
    return mem.addFact(
      {
        subjectId,
        predicate: 'note',
        kind: 'atomic',
        value: 'x',
        permissions,
      },
      ownerScope,
    );
  }

  it('archiveEntity throws PermissionDeniedError for a caller without write access', async () => {
    const ent = await seedEntity(); // default world=read → intruder can read, not write
    await expect(mem.archiveEntity(ent.id, intruderScope)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });

  it('deleteEntity (soft) throws PermissionDeniedError for read-only caller', async () => {
    const ent = await seedEntity();
    await expect(mem.deleteEntity(ent.id, intruderScope)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });

  it('deleteEntity (hard) throws PermissionDeniedError for read-only caller', async () => {
    const ent = await seedEntity();
    await expect(
      mem.deleteEntity(ent.id, intruderScope, { hard: true }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('archiveFact throws PermissionDeniedError for read-only caller', async () => {
    const ent = await seedEntity();
    const fact = await seedFact(ent.id);
    await expect(mem.archiveFact(fact.id, intruderScope)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });

  it('supersedeFact requires write access to the predecessor', async () => {
    const ent = await seedEntity();
    const predecessor = await seedFact(ent.id);
    await expect(
      mem.supersedeFact(
        predecessor.id,
        { subjectId: ent.id, predicate: 'note', kind: 'atomic', value: 'new' },
        intruderScope,
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('mergeEntities requires write on both winner and loser', async () => {
    const winner = await seedEntity();
    const loser = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Loser',
        identifiers: [{ kind: 'email', value: 'l@l.com' }],
      },
      ownerScope,
    );
    await expect(
      mem.mergeEntities(winner.id, loser.entity.id, intruderScope),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('owner can archive their own entity', async () => {
    const ent = await seedEntity();
    await expect(mem.archiveEntity(ent.id, ownerScope)).resolves.toBeUndefined();
  });

  it('group=write lets a group member perform writes', async () => {
    const ent = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Shared',
        identifiers: [{ kind: 'email', value: 's@s.com' }],
        groupId: 'team-a',
        permissions: { group: 'write' },
      },
      { userId: 'owner', groupId: 'team-a' },
    );
    await expect(
      mem.archiveEntity(ent.entity.id, { userId: 'other', groupId: 'team-a' }),
    ).resolves.toBeUndefined();
  });

  it('world=write lets anyone perform writes', async () => {
    const ent = await mem.upsertEntity(
      {
        type: 'topic',
        displayName: 'Public wiki',
        identifiers: [{ kind: 'slug', value: 'wiki' }],
        permissions: { world: 'write' },
      },
      ownerScope,
    );
    await expect(
      mem.archiveEntity(ent.entity.id, { userId: 'random' }),
    ).resolves.toBeUndefined();
  });

  it('upsertEntity dirty path (adding identifier to existing) requires write access', async () => {
    const ent = await seedEntity();
    await expect(
      mem.upsertEntity(
        {
          type: 'person',
          displayName: 'Victim',
          identifiers: [
            { kind: 'email', value: 'v@v.com' },
            { kind: 'slack_id', value: 'U999' }, // new identifier → dirty
          ],
        },
        intruderScope,
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

// -----------------------------------------------------------------------------

describe('MemorySystem — read visibility follows permissions', () => {
  let mem: MemorySystem;
  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
  });
  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('world=none hides record from callers outside the owner + group', async () => {
    const secret = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Secret',
        identifiers: [{ kind: 'email', value: 'secret@s.com' }],
        groupId: 'team-a',
        permissions: { world: 'none' },
      },
      { userId: 'alice', groupId: 'team-a' },
    );
    // Outside caller — cannot see.
    expect(await mem.getEntity(secret.entity.id, { userId: 'bob', groupId: 'team-b' })).toBeNull();
    // Group member — can see (default group=read).
    expect(
      await mem.getEntity(secret.entity.id, { userId: 'charlie', groupId: 'team-a' }),
    ).not.toBeNull();
  });

  it('default permissions make a record publicly readable', async () => {
    const res = await mem.upsertEntity(
      {
        type: 'organization',
        displayName: 'Public',
        identifiers: [{ kind: 'domain', value: 'public.com' }],
      },
      { userId: 'alice' },
    );
    expect(await mem.getEntity(res.entity.id, { userId: 'stranger' })).not.toBeNull();
    expect(await mem.getEntity(res.entity.id, {})).not.toBeNull();
  });

  it('fact inherits subject scope; world=none on fact hides it from non-group callers', async () => {
    const subject = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'P',
        identifiers: [{ kind: 'email', value: 'p@p.com' }],
      },
      { userId: 'alice' },
    );
    const privateFact = await mem.addFact(
      {
        subjectId: subject.entity.id,
        predicate: 'note',
        kind: 'atomic',
        value: 'confidential',
        permissions: { world: 'none', group: 'none' },
      },
      { userId: 'alice' },
    );
    const publicFact = await mem.addFact(
      {
        subjectId: subject.entity.id,
        predicate: 'title',
        kind: 'atomic',
        value: 'CTO',
      },
      { userId: 'alice' },
    );
    const store = (mem as unknown as { store: InMemoryAdapter }).store;
    expect(await store.getFact(privateFact.id, { userId: 'bob' })).toBeNull();
    expect(await store.getFact(publicFact.id, { userId: 'bob' })).not.toBeNull();
  });
});

// -----------------------------------------------------------------------------

describe('MemorySystem — cascade respects permissions', () => {
  let mem: MemorySystem;
  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
  });
  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('archiveEntity cascade skips facts the caller cannot write (no throw, best-effort)', async () => {
    const subject = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Shared',
        identifiers: [{ kind: 'email', value: 'sh@sh.com' }],
        groupId: 'team-a',
        permissions: { group: 'write' },
      },
      { userId: 'alice', groupId: 'team-a' },
    );
    // Fact owned by alice — bob doesn't have write.
    const aliceFact = await mem.addFact(
      {
        subjectId: subject.entity.id,
        predicate: 'note',
        kind: 'atomic',
        value: 'alice-only',
        permissions: { group: 'none', world: 'none' },
      },
      { userId: 'alice', groupId: 'team-a' },
    );
    // Bob archives the SUBJECT. group=write means bob has write on the subject;
    // but alice's fact's permissions lock bob out. Cascade skips the fact.
    await mem.archiveEntity(subject.entity.id, { userId: 'bob', groupId: 'team-a' });
    const store = (mem as unknown as { store: InMemoryAdapter }).store;
    // alice fact still active because bob couldn't archive it.
    const fact = await store.getFact(aliceFact.id, { userId: 'alice', groupId: 'team-a' });
    expect(fact?.archived).toBeFalsy();
  });
});

// -----------------------------------------------------------------------------

describe('MemorySystem — profile regeneration inherits permissions', () => {
  let mem: MemorySystem;
  beforeEach(() => {
    // Mock profile generator — returns canned content on each call.
    const generate = async () => ({
      details: 'new profile body',
      summaryForEmbedding: 'new profile summary',
    });
    mem = new MemorySystem({
      store: new InMemoryAdapter(),
      profileGenerator: { generate },
    });
  });
  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('regenerated profile inherits prior profile permissions (privacy preserved)', async () => {
    const subject = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Alice',
        identifiers: [{ kind: 'email', value: 'alice@a.com' }],
      },
      { userId: 'alice' },
    );
    // Private prior profile — not world-readable.
    await mem.addFact(
      {
        subjectId: subject.entity.id,
        predicate: 'profile',
        kind: 'document',
        details: 'old private body',
        summaryForEmbedding: 'old summary',
        permissions: { world: 'none', group: 'none' },
      },
      { userId: 'alice' },
    );

    const regenerated = await mem.regenerateProfile(subject.entity.id, {
      ownerId: 'alice',
    });

    // Inherited permissions — privacy preserved across regen.
    expect(regenerated.permissions).toEqual({ world: 'none', group: 'none' });
  });

  it('regenerated profile with no prior profile uses library defaults', async () => {
    const subject = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Bob',
        identifiers: [{ kind: 'email', value: 'bob@b.com' }],
      },
      { userId: 'bob' },
    );

    const regenerated = await mem.regenerateProfile(subject.entity.id, {
      ownerId: 'bob',
    });

    // Undefined → falls back to library defaults at read time.
    expect(regenerated.permissions).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------

describe('MemorySystem.addFact — supersedes subject invariant', () => {
  let mem: MemorySystem;
  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
  });
  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('rejects a supersedes chain that crosses subjects', async () => {
    // Two public-world entities owned by 'admin' so the caller can write both.
    const subjectA = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Subject A',
        identifiers: [{ kind: 'email', value: 'a@x.com' }],
        permissions: { world: 'write' },
      },
      { userId: 'admin' },
    );
    const subjectB = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Subject B',
        identifiers: [{ kind: 'email', value: 'b@x.com' }],
        permissions: { world: 'write' },
      },
      { userId: 'admin' },
    );
    // Fact F1 on subject A (world-writable, so any caller can archive it).
    const f1 = await mem.addFact(
      {
        subjectId: subjectA.entity.id,
        predicate: 'note',
        kind: 'atomic',
        value: 'on A',
        permissions: { world: 'write' },
      },
      { userId: 'admin' },
    );

    // Attacker tries to archive F1 by adding a fact on subject B pointing at F1.
    await expect(
      mem.addFact(
        {
          subjectId: subjectB.entity.id,
          predicate: 'note',
          kind: 'atomic',
          value: 'on B',
          supersedes: f1.id,
        },
        { userId: 'admin' },
      ),
    ).rejects.toThrow(/supersession chains are per-subject/);
  });

  it('supersedes on the same subject still works (regression guard)', async () => {
    const subject = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Subject',
        identifiers: [{ kind: 'email', value: 's@x.com' }],
      },
      { userId: 'alice' },
    );
    const predecessor = await mem.addFact(
      { subjectId: subject.entity.id, predicate: 'title', kind: 'atomic', value: 'Engineer' },
      { userId: 'alice' },
    );
    const successor = await mem.supersedeFact(
      predecessor.id,
      { subjectId: subject.entity.id, predicate: 'title', kind: 'atomic', value: 'Senior Engineer' },
      { userId: 'alice' },
    );
    expect(successor.supersedes).toBe(predecessor.id);
    const store = (mem as unknown as { store: InMemoryAdapter }).store;
    const old = await store.getFact(
      predecessor.id,
      { userId: 'alice' },
    );
    expect(old?.archived).toBe(true);
  });
});
