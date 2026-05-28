/**
 * MemorySystem — input validation for addFact.
 *
 * Covers: empty predicate rejection, whitespace-only predicate rejection,
 * self-reference rejection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { ScopeFilter } from '@/memory/types.js';

const TEST_SCOPE: ScopeFilter = { userId: 'test-user' };

async function seedPerson(mem: MemorySystem, email = 'a@a.com'): Promise<string> {
  const res = await mem.upsertEntity(
    {
      type: 'person',
      displayName: 'Test',
      identifiers: [{ kind: 'email', value: email }],
    },
    TEST_SCOPE,
  );
  return res.entity.id;
}

describe('MemorySystem.addFact — input validation', () => {
  let mem: MemorySystem;

  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
  });
  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  it('rejects empty-string predicate', async () => {
    const id = await seedPerson(mem);
    await expect(
      mem.addFact({ subjectId: id, predicate: '', kind: 'atomic', value: 'x' }, TEST_SCOPE),
    ).rejects.toThrow(/non-empty string/);
  });

  it('rejects whitespace-only predicate', async () => {
    const id = await seedPerson(mem);
    await expect(
      mem.addFact({ subjectId: id, predicate: '   ', kind: 'atomic', value: 'x' }, TEST_SCOPE),
    ).rejects.toThrow(/non-empty string/);
  });

  it('rejects non-string predicate (runtime guard)', async () => {
    const id = await seedPerson(mem);
    await expect(
      mem.addFact(
        // @ts-expect-error deliberately wrong type
        { subjectId: id, predicate: null, kind: 'atomic', value: 'x' },
        TEST_SCOPE,
      ),
    ).rejects.toThrow(/non-empty string/);
  });

  it('rejects self-referential facts (subject === object)', async () => {
    const id = await seedPerson(mem);
    await expect(
      mem.addFact(
        { subjectId: id, predicate: 'knows', kind: 'atomic', objectId: id },
        TEST_SCOPE,
      ),
    ).rejects.toThrow(/self-referential/);
  });

  it('allows subjectId === objectId when objectId is omitted (attribute facts)', async () => {
    const id = await seedPerson(mem);
    // Value-based fact — no objectId at all. Should pass.
    await expect(
      mem.addFact(
        { subjectId: id, predicate: 'note', kind: 'atomic', value: 'hello' },
        TEST_SCOPE,
      ),
    ).resolves.toBeTruthy();
  });

  it('normalizes empty contextIds array to undefined on write', async () => {
    const id = await seedPerson(mem);
    const fact = await mem.addFact(
      {
        subjectId: id,
        predicate: 'note',
        kind: 'atomic',
        value: 'hello',
        contextIds: [],
      },
      TEST_SCOPE,
    );
    expect(fact.contextIds).toBeUndefined();
  });

  it('preserves non-empty contextIds on write', async () => {
    const a = await seedPerson(mem, 'a@a.com');
    const b = await seedPerson(mem, 'b@b.com');
    const fact = await mem.addFact(
      {
        subjectId: a,
        predicate: 'note',
        kind: 'atomic',
        value: 'x',
        contextIds: [b],
      },
      TEST_SCOPE,
    );
    expect(fact.contextIds).toEqual([b]);
  });
});

// ---------------------------------------------------------------------------
// updateFact ranking-input clamping — regression for the prior gap where
// addFact clamped confidence/importance to [0,1] but updateFact let any
// caller-supplied value through unmodified. LLM reconciliation passes that
// emitted `importance: 99` would silently distort retrieval ranking.
// ---------------------------------------------------------------------------

describe('MemorySystem.updateFact — clamps ranking inputs', () => {
  let mem: MemorySystem;
  beforeEach(() => {
    mem = new MemorySystem({ store: new InMemoryAdapter() });
  });
  afterEach(async () => {
    if (!mem.isDestroyed) await mem.shutdown();
  });

  async function seedFact(opts?: { confidence?: number; importance?: number }) {
    const id = await seedPerson(mem);
    const fact = await mem.addFact(
      {
        subjectId: id,
        predicate: 'note',
        kind: 'atomic',
        value: 'x',
        confidence: opts?.confidence,
        importance: opts?.importance,
      },
      TEST_SCOPE,
    );
    return fact;
  }

  it('clamps out-of-range confidence patches to [0, 1]', async () => {
    const fact = await seedFact({ confidence: 0.5 });
    // LLM-hallucinated 99 → clamped to 1.0.
    const high = await mem.updateFact(fact.id, { confidence: 99 }, TEST_SCOPE);
    expect(high.confidence).toBe(1);
    // Negative → clamped to 0.
    const low = await mem.updateFact(fact.id, { confidence: -5 }, TEST_SCOPE);
    expect(low.confidence).toBe(0);
  });

  it('clamps out-of-range importance patches to [0, 1]', async () => {
    const fact = await seedFact({ importance: 0.5 });
    const high = await mem.updateFact(fact.id, { importance: 12 }, TEST_SCOPE);
    expect(high.importance).toBe(1);
    const low = await mem.updateFact(fact.id, { importance: -0.3 }, TEST_SCOPE);
    expect(low.importance).toBe(0);
  });

  it('passes through in-range values without modification', async () => {
    const fact = await seedFact({ confidence: 0.5, importance: 0.5 });
    const updated = await mem.updateFact(
      fact.id,
      { confidence: 0.73, importance: 0.21 },
      TEST_SCOPE,
    );
    expect(updated.confidence).toBe(0.73);
    expect(updated.importance).toBe(0.21);
  });

  it('does not touch confidence/importance when the patch omits them', async () => {
    const fact = await seedFact({ confidence: 0.42, importance: 0.13 });
    // Patch only `details` — ranking fields must stay untouched.
    const updated = await mem.updateFact(fact.id, { details: 'new prose' }, TEST_SCOPE);
    expect(updated.confidence).toBe(0.42);
    expect(updated.importance).toBe(0.13);
  });
});
