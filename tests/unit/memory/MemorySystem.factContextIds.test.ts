/**
 * MemorySystem.addFact — contextIds sanitation regression.
 *
 * The entity-create path has long sanitized `contextIds` (visibility-check +
 * dedupe + drop empties). The fact-create path used to skip everything except
 * visibility, so LLM extractions that emitted the subject or object
 * redundantly in `contextIds` produced noisy facts where queries like
 * `memory_list_facts({contextId: subjectId})` surfaced every fact about that
 * subject. These tests pin the post-fix behavior:
 *
 *   - duplicates collapse to a single id
 *   - empty / falsy entries are dropped
 *   - subjectId / objectId self-references are dropped
 *   - an all-self-reference array becomes `undefined` (not stored at all)
 *   - invisible context entities still throw (the visibility check survives)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { ScopeFilter } from '@/memory/types.js';

const SCOPE: ScopeFilter = { userId: 'ctx-user' };

async function seedPerson(mem: MemorySystem, email: string): Promise<string> {
  const res = await mem.upsertEntity(
    { type: 'person', displayName: email, identifiers: [{ kind: 'email', value: email }] },
    SCOPE,
  );
  return res.entity.id;
}

describe('MemorySystem.addFact — contextIds sanitation', () => {
  let mem: MemorySystem;
  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
  });
  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('dedupes repeated context ids', async () => {
    const subj = await seedPerson(mem, 'subj@a.com');
    const ctx = await seedPerson(mem, 'ctx@a.com');
    const fact = await mem.addFact(
      {
        subjectId: subj,
        predicate: 'note',
        kind: 'atomic',
        value: 'x',
        contextIds: [ctx, ctx, ctx],
      },
      SCOPE,
    );
    expect(fact.contextIds).toEqual([ctx]);
  });

  it('drops subjectId from contextIds (self-reference)', async () => {
    const subj = await seedPerson(mem, 'subj2@a.com');
    const ctx = await seedPerson(mem, 'ctx2@a.com');
    const fact = await mem.addFact(
      {
        subjectId: subj,
        predicate: 'note',
        kind: 'atomic',
        value: 'x',
        contextIds: [subj, ctx],
      },
      SCOPE,
    );
    expect(fact.contextIds).toEqual([ctx]);
  });

  it('drops objectId from contextIds (relational facts)', async () => {
    const subj = await seedPerson(mem, 'subj3@a.com');
    const obj = await seedPerson(mem, 'obj3@a.com');
    const ctx = await seedPerson(mem, 'ctx3@a.com');
    const fact = await mem.addFact(
      {
        subjectId: subj,
        objectId: obj,
        predicate: 'knows',
        kind: 'atomic',
        contextIds: [obj, ctx, subj], // both self-refs + a real anchor
      },
      SCOPE,
    );
    expect(fact.contextIds).toEqual([ctx]);
  });

  it('drops empty / falsy entries', async () => {
    const subj = await seedPerson(mem, 'subj4@a.com');
    const ctx = await seedPerson(mem, 'ctx4@a.com');
    const fact = await mem.addFact(
      {
        subjectId: subj,
        predicate: 'note',
        kind: 'atomic',
        value: 'x',
        // Cast: TS won't normally accept these holes, but LLM-marshalled
        // tool args routinely emit them.
        contextIds: ['', ctx, undefined as unknown as string, null as unknown as string],
      },
      SCOPE,
    );
    expect(fact.contextIds).toEqual([ctx]);
  });

  it('stores contextIds as undefined when all entries are self-refs or empty', async () => {
    const subj = await seedPerson(mem, 'subj5@a.com');
    const obj = await seedPerson(mem, 'obj5@a.com');
    const fact = await mem.addFact(
      {
        subjectId: subj,
        objectId: obj,
        predicate: 'knows',
        kind: 'atomic',
        contextIds: [subj, obj, ''], // nothing legitimate
      },
      SCOPE,
    );
    expect(fact.contextIds).toBeUndefined();
  });

  it('still rejects an invisible context entity (visibility check intact)', async () => {
    const subj = await seedPerson(mem, 'subj6@a.com');
    // Private entity owned by someone else.
    const otherUserScope: ScopeFilter = { userId: 'other' };
    const hidden = await mem.upsertEntity(
      {
        type: 'topic',
        displayName: 'Hidden topic',
        identifiers: [{ kind: 'slug', value: 'hidden' }],
        permissions: { world: 'none', group: 'none' },
      },
      otherUserScope,
    );
    await expect(
      mem.addFact(
        {
          subjectId: subj,
          predicate: 'note',
          kind: 'atomic',
          value: 'x',
          contextIds: [hidden.entity.id],
        },
        SCOPE,
      ),
    ).rejects.toThrow(/not visible/);
  });
});
