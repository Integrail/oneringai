/**
 * canonicalIdentifier + slugify helpers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  canonicalIdentifier,
  slugify,
  normalizeIdentifierValue,
  identifierValuesEqual,
  CASE_INSENSITIVE_IDENTIFIER_KINDS,
} from '@/memory/identifiers.js';
import { MemorySystem } from '@/memory/MemorySystem.js';
import { InMemoryAdapter } from '@/memory/adapters/inmemory/InMemoryAdapter.js';
import type { ScopeFilter } from '@/memory/types.js';

describe('slugify', () => {
  it('basic: lowercases, replaces spaces with dashes', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips punctuation + collapses runs', () => {
    expect(slugify('Q3 Planning!! (urgent)')).toBe('q3-planning-urgent');
  });

  it('trims leading/trailing dashes', () => {
    expect(slugify('--foo bar--')).toBe('foo-bar');
  });

  it('strips diacritics', () => {
    expect(slugify('Café München')).toBe('cafe-munchen');
  });

  it('truncates at max length, prefers word boundary', () => {
    const s = slugify('This is a very long title about budget planning and strategy', {
      maxLength: 30,
    });
    expect(s.length).toBeLessThanOrEqual(30);
    expect(s.endsWith('-')).toBe(false);
  });

  it('stable: same input → same output', () => {
    const a = slugify('Send budget by Friday');
    const b = slugify('Send budget by Friday');
    expect(a).toBe(b);
  });

  it('empty input → empty string', () => {
    expect(slugify('')).toBe('');
    expect(slugify('   ')).toBe('');
  });

  it('maxLength 0 → empty', () => {
    expect(slugify('anything', { maxLength: 0 })).toBe('');
  });
});

describe('canonicalIdentifier', () => {
  it('builds canonical kind with joined parts', () => {
    const id = canonicalIdentifier('task', {
      assignee: 'user_123',
      context: 'topic_erp',
      title: 'Send budget by Friday',
    });
    expect(id.kind).toBe('canonical');
    expect(id.value).toBe('task:user_123:topic_erp:send-budget-by-friday');
    expect(id.isPrimary).toBe(false);
  });

  it('drops undefined parts', () => {
    const id = canonicalIdentifier('task', {
      assignee: undefined,
      context: 'topic_erp',
      title: 'Review',
    });
    expect(id.value).toBe('task:topic_erp:review');
  });

  it('drops empty-string parts', () => {
    const id = canonicalIdentifier('event', {
      source: 'gcal',
      id: '',
      title: 'Q3',
    });
    expect(id.value).toBe('event:gcal:q3');
  });

  it('only slugifies the last part', () => {
    // Earlier parts preserved verbatim (they're typically entity ids)
    const id = canonicalIdentifier('task', {
      assignee: 'user_UPPER_123',
      title: 'Hello World',
    });
    expect(id.value).toBe('task:user_UPPER_123:hello-world');
  });

  it('throws on empty type', () => {
    expect(() => canonicalIdentifier('', { title: 'x' })).toThrow(/non-empty/);
  });

  it('slugifies the last NON-EMPTY value, not the last positional key', () => {
    // Regression: trailing undefined used to leave the surviving last value
    // un-slugified, producing values like "task:User X" with a space.
    const id = canonicalIdentifier('task', {
      assignee: 'user_1',
      context: 'topic_erp',
      title: 'User X',
      externalId: undefined, // trailing undefined — must not suppress slugging
    });
    expect(id.value).toBe('task:user_1:topic_erp:user-x');
  });

  it('still-slugifies when only ONE value survives after filtering', () => {
    // Single surviving value — must be slugified.
    const id = canonicalIdentifier('task', {
      assignee: undefined,
      title: 'Send Budget',
      extra: undefined,
    });
    expect(id.value).toBe('task:send-budget');
  });

  it('throws when no parts resolve to non-empty values', () => {
    expect(() => canonicalIdentifier('task', { a: undefined, b: '' })).toThrow(/at least one/);
  });

  it('round-trip: findEntitiesByIdentifier finds entity by canonical id', async () => {
    const scope: ScopeFilter = { userId: 'test-user' };
    const store = new InMemoryAdapter();
    const mem = new MemorySystem({ store });

    const id = canonicalIdentifier('task', { assignee: 'u1', title: 'Q3 plan' });
    const { entity } = await mem.upsertEntity(
      {
        type: 'task',
        displayName: 'Review Q3 plan',
        identifiers: [id],
      },
      scope,
    );

    const found = await store.findEntitiesByIdentifier('canonical', id.value, scope);
    expect(found).toHaveLength(1);
    expect(found[0]!.id).toBe(entity.id);

    // Re-extraction with the same canonical id converges on the same entity.
    const res = await mem.upsertEntityBySurface(
      { surface: 'Q3 planning review', type: 'task', identifiers: [id] },
      scope,
    );
    expect(res.resolved).toBe(true);
    expect(res.entity.id).toBe(entity.id);

    await mem.shutdown();
  });
});

describe('normalizeIdentifierValue (kind-aware case normalization)', () => {
  it('lowercases case-insensitive kinds', () => {
    expect(normalizeIdentifierValue('email', 'Anton@Example.com')).toBe('anton@example.com');
    expect(normalizeIdentifierValue('domain', 'EXAMPLE.com')).toBe('example.com');
    expect(normalizeIdentifierValue('phone', '+1-555-FOO')).toBe('+1-555-foo');
    expect(normalizeIdentifierValue('url_host', 'API.Stripe.COM')).toBe('api.stripe.com');
  });

  it('preserves case for case-sensitive kinds', () => {
    // Meteor Random.id() is base57 — case-sensitive. Lowercasing destroys identity.
    expect(normalizeIdentifierValue('system_user_id', 'JsTx8jbywjpL7dK8B')).toBe(
      'JsTx8jbywjpL7dK8B',
    );
    expect(normalizeIdentifierValue('canonical', 'Task:User_123:Send-Budget')).toBe(
      'Task:User_123:Send-Budget',
    );
    expect(normalizeIdentifierValue('slack_id', 'U04XYZ789')).toBe('U04XYZ789');
    expect(normalizeIdentifierValue('github', 'OctoCat')).toBe('OctoCat');
    expect(normalizeIdentifierValue('hash', 'AbC123==')).toBe('AbC123==');
  });

  it('CASE_INSENSITIVE_IDENTIFIER_KINDS contains the expected baseline kinds', () => {
    expect(CASE_INSENSITIVE_IDENTIFIER_KINDS.has('email')).toBe(true);
    expect(CASE_INSENSITIVE_IDENTIFIER_KINDS.has('domain')).toBe(true);
    expect(CASE_INSENSITIVE_IDENTIFIER_KINDS.has('phone')).toBe(true);
    expect(CASE_INSENSITIVE_IDENTIFIER_KINDS.has('url_host')).toBe(true);
    expect(CASE_INSENSITIVE_IDENTIFIER_KINDS.has('system_user_id')).toBe(false);
    expect(CASE_INSENSITIVE_IDENTIFIER_KINDS.has('canonical')).toBe(false);
  });
});

describe('identifierValuesEqual (kind-aware equality)', () => {
  it('case-insensitive kinds compare ignoring case', () => {
    expect(identifierValuesEqual('email', 'Anton@example.com', 'email', 'anton@EXAMPLE.com')).toBe(
      true,
    );
  });

  it('case-sensitive kinds compare strictly', () => {
    expect(
      identifierValuesEqual('system_user_id', 'JsTx8jbywjpL7dK8B', 'system_user_id', 'jstx8jbywjpl7dk8b'),
    ).toBe(false);
    expect(
      identifierValuesEqual('system_user_id', 'JsTx8jbywjpL7dK8B', 'system_user_id', 'JsTx8jbywjpL7dK8B'),
    ).toBe(true);
  });

  it('different kinds are never equal', () => {
    expect(identifierValuesEqual('email', 'foo@bar.com', 'domain', 'foo@bar.com')).toBe(false);
  });
});

describe('storage layer: kind-aware case behavior end-to-end', () => {
  it('preserves system_user_id case on write and lookup', async () => {
    const scope: ScopeFilter = { userId: 'test-user' };
    const store = new InMemoryAdapter();
    const mem = new MemorySystem({ store });

    const userId = 'JsTx8jbywjpL7dK8B'; // mixed-case base57 Meteor id
    const { entity } = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Anton',
        identifiers: [{ kind: 'system_user_id', value: userId }],
      },
      scope,
    );

    // The stored identifier must preserve original case.
    const got = await store.getEntity(entity.id, scope);
    expect(got).not.toBeNull();
    const storedIdent = got!.identifiers.find((i) => i.kind === 'system_user_id');
    expect(storedIdent?.value).toBe(userId);

    // Lookup with original case — finds it.
    const foundExact = await store.findEntitiesByIdentifier('system_user_id', userId, scope);
    expect(foundExact).toHaveLength(1);
    expect(foundExact[0]!.id).toBe(entity.id);

    // Lookup with wrong case — does NOT find it (case is meaningful for this kind).
    const foundLower = await store.findEntitiesByIdentifier(
      'system_user_id',
      userId.toLowerCase(),
      scope,
    );
    expect(foundLower).toHaveLength(0);

    await mem.shutdown();
  });

  it('lowercases email on write and matches lookup ignoring case', async () => {
    const scope: ScopeFilter = { userId: 'test-user' };
    const store = new InMemoryAdapter();
    const mem = new MemorySystem({ store });

    const { entity } = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Anton',
        identifiers: [{ kind: 'email', value: 'Anton@Example.COM' }],
      },
      scope,
    );

    const got = await store.getEntity(entity.id, scope);
    const storedIdent = got!.identifiers.find((i) => i.kind === 'email');
    expect(storedIdent?.value).toBe('anton@example.com');

    // Lookup with any case finds it.
    const a = await store.findEntitiesByIdentifier('email', 'Anton@Example.COM', scope);
    expect(a).toHaveLength(1);
    const b = await store.findEntitiesByIdentifier('email', 'anton@example.com', scope);
    expect(b).toHaveLength(1);
    const c = await store.findEntitiesByIdentifier('email', 'ANTON@EXAMPLE.COM', scope);
    expect(c).toHaveLength(1);

    await mem.shutdown();
  });

  it('dedup on identifier add is kind-aware (same case → dedup, different case → not dedup)', async () => {
    const scope: ScopeFilter = { userId: 'test-user' };
    const store = new InMemoryAdapter();
    const mem = new MemorySystem({ store });

    // Seed Anton with a mixed-case system_user_id.
    const userId = 'JsTx8jbywjpL7dK8B';
    const { entity } = await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Anton',
        identifiers: [{ kind: 'system_user_id', value: userId }],
      },
      scope,
    );

    // Re-upsert with the SAME case — library matches by identifier and dedups.
    await mem.upsertEntity(
      {
        type: 'person',
        displayName: 'Anton',
        identifiers: [{ kind: 'system_user_id', value: userId }],
      },
      scope,
    );
    let got = await store.getEntity(entity.id, scope);
    const sameCaseCount = got!.identifiers.filter(
      (i) => i.kind === 'system_user_id' && i.value === userId,
    ).length;
    expect(sameCaseCount).toBe(1);

    // Test the in-process dedup comparator directly: appending a duplicate
    // identifier in a single update should be deduped, but appending a
    // case-DIFFERENT one should NOT be (kind is case-sensitive).
    const fresh = (await store.getEntity(entity.id, scope))!;
    const next = [
      ...fresh.identifiers,
      { kind: 'system_user_id', value: userId }, // duplicate of existing — should be filtered
      { kind: 'system_user_id', value: userId.toLowerCase() }, // different value — should remain
    ];
    // Manually simulate the dedup the library does on update:
    const seen: Array<{ kind: string; value: string }> = [];
    for (const i of next) {
      if (
        !seen.some(
          (s) => identifierValuesEqual(s.kind, s.value, i.kind, i.value),
        )
      ) {
        seen.push(i);
      }
    }
    const dedupedSysIds = seen.filter((i) => i.kind === 'system_user_id');
    // Should retain exactly two: the original mixed-case one AND the new lowercase one.
    expect(dedupedSysIds).toHaveLength(2);
    expect(dedupedSysIds.map((i) => i.value).sort()).toEqual(
      [userId, userId.toLowerCase()].sort(),
    );

    await mem.shutdown();
  });
});
