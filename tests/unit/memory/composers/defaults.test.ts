/**
 * Unit tests for the default per-type content composers. Each composer must
 * produce deterministic, diff-friendly text that includes all the semantically
 * meaningful fields for its entity type. References to other entities resolve
 * to displayNames so the embedded text reflects meaning rather than ids.
 */

import { describe, it, expect } from 'vitest';
import type { ComposeContext } from '@/memory/composers/types.js';
import {
  taskContentComposer,
  eventContentComposer,
  personContentComposer,
  organizationContentComposer,
  topicContentComposer,
  projectContentComposer,
  documentContentComposer,
  clusterContentComposer,
  defaultFactContentComposer,
} from '@/memory/composers/defaults.js';
import type { IEntity, IFact } from '@/memory/types.js';

/**
 * Test-only ComposeContext that resolves ids from a fixed map. No store needed.
 */
function makeCtx(displayNames: Record<string, string>): ComposeContext {
  const entities = new Map<string, IEntity>(
    Object.entries(displayNames).map(([id, name]) => [
      id,
      {
        id,
        type: 'person',
        displayName: name,
        identifiers: [],
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as IEntity,
    ]),
  );
  return {
    async resolveEntity(id) {
      return entities.get(id) ?? null;
    },
    async resolveEntities(ids) {
      return ids.map((id) => entities.get(id) ?? null);
    },
    async resolveDisplayName(id) {
      return entities.get(id)?.displayName ?? null;
    },
    async resolveDisplayNames(ids) {
      return ids.map((id) => entities.get(id)?.displayName ?? null);
    },
  };
}

function makeEntity(overrides: Partial<IEntity>): IEntity {
  return {
    id: 'ent-1',
    type: 'task',
    displayName: 'Untitled',
    identifiers: [],
    version: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('taskContentComposer', () => {
  it('embeds minimal task with just displayName', async () => {
    const e = makeEntity({ type: 'task', displayName: 'Buy flowers' });
    const text = await taskContentComposer.compose(e, makeCtx({}));
    expect(text).toBe('task: Buy flowers');
  });

  it('includes state, priority, due date when present', async () => {
    const e = makeEntity({
      type: 'task',
      displayName: 'Deploy frontend',
      metadata: {
        state: 'in_progress',
        priority: 'high',
        dueAt: new Date('2026-05-29T00:00:00Z'),
      },
    });
    const text = await taskContentComposer.compose(e, makeCtx({}));
    expect(text).toContain('task: Deploy frontend');
    expect(text).toContain('State: in_progress');
    expect(text).toContain('Priority: high');
    expect(text).toContain('Due: 2026-05-29T00:00:00.000Z');
  });

  it('resolves assigneeId / reporterId / projectId to displayNames', async () => {
    const e = makeEntity({
      type: 'task',
      displayName: 'Follow up',
      metadata: {
        assigneeId: 'p-1',
        reporterId: 'p-2',
        projectId: 'proj-1',
      },
    });
    const ctx = makeCtx({ 'p-1': 'Bob Smith', 'p-2': 'Alice Jones', 'proj-1': 'Q3 Release' });
    const text = await taskContentComposer.compose(e, ctx);
    expect(text).toContain('Assignee: Bob Smith');
    expect(text).toContain('Reporter: Alice Jones');
    expect(text).toContain('Project: Q3 Release');
  });

  it('resolves contextIds to displayName list', async () => {
    const e = makeEntity({
      type: 'task',
      displayName: 'Generic',
      contextIds: ['c-1', 'c-2'],
    });
    const ctx = makeCtx({ 'c-1': 'Acme Corp', 'c-2': 'Q3 Plan' });
    const text = await taskContentComposer.compose(e, ctx);
    expect(text).toContain('Context: Acme Corp, Q3 Plan');
  });

  it('silently omits missing/invisible reference entities', async () => {
    const e = makeEntity({
      type: 'task',
      displayName: 'Orphan refs',
      metadata: { assigneeId: 'gone' },
      contextIds: ['also-gone'],
    });
    const text = await taskContentComposer.compose(e, makeCtx({}));
    expect(text).not.toContain('Assignee:');
    expect(text).not.toContain('Context:');
    expect(text).toContain('task: Orphan refs');
  });

  it('includes free-form narrative from metadata.description', async () => {
    const e = makeEntity({
      type: 'task',
      displayName: 'Investigate bug',
      metadata: { description: 'Users report 500 errors when uploading PNG > 5MB' },
    });
    const text = await taskContentComposer.compose(e, makeCtx({}));
    expect(text).toContain('Description: Users report 500 errors when uploading PNG > 5MB');
  });

  it('produces deterministic output (same input → same string)', async () => {
    const e = makeEntity({
      type: 'task',
      displayName: 'Recurring',
      aliases: ['x', 'y'],
      metadata: { state: 'pending', priority: 'medium', assigneeId: 'p-1' },
      contextIds: ['c-1', 'c-2'],
    });
    const ctx = makeCtx({ 'p-1': 'Bob', 'c-1': 'A', 'c-2': 'B' });
    const t1 = await taskContentComposer.compose(e, ctx);
    const t2 = await taskContentComposer.compose(e, makeCtx({ 'p-1': 'Bob', 'c-1': 'A', 'c-2': 'B' }));
    expect(t1).toBe(t2);
  });

  it('two tasks with identical title but different metadata produce different text', async () => {
    const a = makeEntity({
      type: 'task',
      displayName: 'Follow up',
      metadata: { state: 'pending', assigneeId: 'alice' },
    });
    const b = makeEntity({
      id: 'ent-2',
      type: 'task',
      displayName: 'Follow up',
      metadata: { state: 'pending', assigneeId: 'bob' },
    });
    const ctx = makeCtx({ alice: 'Alice', bob: 'Bob' });
    const ta = await taskContentComposer.compose(a, ctx);
    const tb = await taskContentComposer.compose(b, ctx);
    expect(ta).not.toBe(tb);
  });
});

describe('eventContentComposer', () => {
  it('embeds when window, location, attendees, context', async () => {
    const e = makeEntity({
      type: 'event',
      displayName: 'Q3 Planning Sync',
      metadata: {
        startTime: new Date('2026-05-29T15:00:00Z'),
        endTime: new Date('2026-05-29T16:00:00Z'),
        location: 'Conference Room B',
        kind: 'meeting',
        attendeeIds: ['a-1', 'a-2'],
      },
      contextIds: ['proj-1'],
    });
    const ctx = makeCtx({ 'a-1': 'Alice', 'a-2': 'Bob', 'proj-1': 'Q3 Release' });
    const text = await eventContentComposer.compose(e, ctx);
    expect(text).toContain('event: Q3 Planning Sync');
    expect(text).toContain('When: 2026-05-29T15:00:00.000Z → 2026-05-29T16:00:00.000Z');
    expect(text).toContain('Where: Conference Room B');
    expect(text).toContain('Kind: meeting');
    expect(text).toContain('Attendees: Alice, Bob');
    expect(text).toContain('Context: Q3 Release');
  });

  it('handles only startTime (no endTime)', async () => {
    const e = makeEntity({
      type: 'event',
      displayName: 'All-day',
      metadata: { startTime: new Date('2026-05-29T00:00:00Z') },
    });
    const text = await eventContentComposer.compose(e, makeCtx({}));
    expect(text).toContain('When: 2026-05-29T00:00:00.000Z');
    expect(text).not.toContain('→');
  });
});

describe('personContentComposer', () => {
  it('embeds role + org + bio + identifiers', async () => {
    const e = makeEntity({
      type: 'person',
      displayName: 'Sarah Chen',
      aliases: ['Sarah'],
      identifiers: [
        { kind: 'email', value: 'sarah@acme.com' },
        { kind: 'slack_id', value: 'U123' },
      ],
      metadata: {
        role: 'Senior Engineer',
        organizationId: 'org-1',
        bio: 'Works on payments infra.',
      },
    });
    const ctx = makeCtx({ 'org-1': 'Acme Corp' });
    const text = await personContentComposer.compose(e, ctx);
    expect(text).toContain('person: Sarah Chen');
    expect(text).toContain('Aliases: Sarah');
    expect(text).toContain('Role: Senior Engineer');
    expect(text).toContain('Organization: Acme Corp');
    expect(text).toContain('Bio: Works on payments infra.');
    expect(text).toContain('email:sarah@acme.com');
  });
});

describe('organizationContentComposer', () => {
  it('extracts domain from identifiers', async () => {
    const e = makeEntity({
      type: 'organization',
      displayName: 'Acme Corp',
      identifiers: [
        { kind: 'domain', value: 'acme.com' },
        { kind: 'ticker', value: 'ACME' },
      ],
      metadata: { industry: 'Software', description: 'B2B SaaS company.' },
    });
    const text = await organizationContentComposer.compose(e, makeCtx({}));
    expect(text).toContain('organization: Acme Corp');
    expect(text).toContain('Domain: acme.com');
    expect(text).toContain('Industry: Software');
    expect(text).toContain('Description: B2B SaaS company.');
  });
});

describe('topicContentComposer', () => {
  it('embeds context parents', async () => {
    const e = makeEntity({
      type: 'topic',
      displayName: 'Payments infra',
      contextIds: ['p-1'],
      metadata: { description: 'Core payments processing systems.' },
    });
    const ctx = makeCtx({ 'p-1': 'Engineering' });
    const text = await topicContentComposer.compose(e, ctx);
    expect(text).toContain('topic: Payments infra');
    expect(text).toContain('Context: Engineering');
    expect(text).toContain('Description: Core payments processing systems.');
  });
});

describe('projectContentComposer', () => {
  it('embeds status + stakeholders', async () => {
    const e = makeEntity({
      type: 'project',
      displayName: 'Q3 Release',
      metadata: {
        status: 'active',
        stakeholderIds: ['p-1', 'p-2'],
        description: 'Quarterly feature rollout.',
      },
    });
    const ctx = makeCtx({ 'p-1': 'Alice', 'p-2': 'Bob' });
    const text = await projectContentComposer.compose(e, ctx);
    expect(text).toContain('project: Q3 Release');
    expect(text).toContain('Status: active');
    expect(text).toContain('Stakeholders: Alice, Bob');
    expect(text).toContain('Description: Quarterly feature rollout.');
  });
});

describe('documentContentComposer', () => {
  it('uses summary when present', async () => {
    const e = makeEntity({
      type: 'document',
      displayName: 'Q3 Plan',
      metadata: { body: 'Long body...', summary: 'Short summary.' },
    });
    const text = await documentContentComposer.compose(e, makeCtx({}));
    expect(text).toBe('Q3 Plan\n\nShort summary.');
  });

  it('falls back to body when no summary', async () => {
    const e = makeEntity({
      type: 'document',
      displayName: 'Spec',
      metadata: { body: 'Full text body.' },
    });
    const text = await documentContentComposer.compose(e, makeCtx({}));
    expect(text).toBe('Spec\n\nFull text body.');
  });

  it('returns just displayName when neither body nor summary exists', async () => {
    const e = makeEntity({ type: 'document', displayName: 'Empty doc' });
    const text = await documentContentComposer.compose(e, makeCtx({}));
    expect(text).toBe('Empty doc');
  });
});

describe('clusterContentComposer', () => {
  it('embeds anchors + first/last seen', async () => {
    const e = makeEntity({
      type: 'cluster',
      displayName: 'Person cluster #42',
      metadata: {
        anchorEntityIds: ['p-1'],
        firstSeen: new Date('2026-01-01'),
        lastSeen: new Date('2026-05-01'),
      },
    });
    const ctx = makeCtx({ 'p-1': 'Pavel' });
    const text = await clusterContentComposer.compose(e, ctx);
    expect(text).toContain('cluster: Person cluster #42');
    expect(text).toContain('Anchors: Pavel');
    expect(text).toContain('First seen: 2026-01-01T00:00:00.000Z');
    expect(text).toContain('Last seen: 2026-05-01T00:00:00.000Z');
  });
});

// =============================================================================
// Fact composer
// =============================================================================

function makeFact(overrides: Partial<IFact>): IFact {
  return {
    id: 'f-1',
    subjectId: 's-1',
    predicate: 'works_at',
    kind: 'atomic',
    confidence: 1.0,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  } as IFact;
}

describe('defaultFactContentComposer', () => {
  it('atomic fact with objectId resolves both entities to displayNames', async () => {
    const f = makeFact({ subjectId: 's-1', predicate: 'works_at', objectId: 'o-1' });
    const ctx = makeCtx({ 's-1': 'Sarah Chen', 'o-1': 'Acme Corp' });
    const text = await defaultFactContentComposer.compose(f, ctx);
    expect(text).toBe('Sarah Chen works_at Acme Corp');
  });

  it('atomic fact with scalar value', async () => {
    const f = makeFact({ subjectId: 's-1', predicate: 'has_email', value: 'sarah@acme.com' });
    const ctx = makeCtx({ 's-1': 'Sarah Chen' });
    const text = await defaultFactContentComposer.compose(f, ctx);
    expect(text).toBe('Sarah Chen has_email sarah@acme.com');
  });

  it('atomic fact with object value (JSON.stringify)', async () => {
    const f = makeFact({
      subjectId: 's-1',
      predicate: 'has_address',
      value: { street: '123 Main', city: 'SF' },
    });
    const ctx = makeCtx({ 's-1': 'Sarah' });
    const text = await defaultFactContentComposer.compose(f, ctx);
    expect(text).toContain('Sarah has_address {');
    expect(text).toContain('"city":"SF"');
  });

  it('atomic fact appends details when present', async () => {
    const f = makeFact({
      subjectId: 's-1',
      predicate: 'works_at',
      objectId: 'o-1',
      details: 'Started as Senior, promoted to Staff in 2025.',
    });
    const ctx = makeCtx({ 's-1': 'Sarah', 'o-1': 'Acme' });
    const text = await defaultFactContentComposer.compose(f, ctx);
    expect(text).toBe('Sarah works_at Acme\nStarted as Senior, promoted to Staff in 2025.');
  });

  it('document fact uses summaryForEmbedding when present', async () => {
    const f = makeFact({
      kind: 'document',
      subjectId: 's-1',
      predicate: 'profile',
      details: 'Long full bio...',
      summaryForEmbedding: 'Brief gist.',
    });
    const ctx = makeCtx({ 's-1': 'Sarah' });
    const text = await defaultFactContentComposer.compose(f, ctx);
    expect(text).toBe('Brief gist.');
  });

  it('document fact falls back to details when no summary', async () => {
    const f = makeFact({ kind: 'document', subjectId: 's-1', predicate: 'notes', details: 'Body text.' });
    const ctx = makeCtx({ 's-1': 'Sarah' });
    const text = await defaultFactContentComposer.compose(f, ctx);
    expect(text).toBe('Body text.');
  });

  it('atomic fact with missing object renders placeholder, not silently drops', async () => {
    const f = makeFact({ subjectId: 's-1', predicate: 'reports_to', objectId: 'missing' });
    const ctx = makeCtx({ 's-1': 'Sarah' });
    const text = await defaultFactContentComposer.compose(f, ctx);
    expect(text).toContain('Sarah reports_to');
    expect(text).toContain('missing');
  });

  it('replaces legacy 80-char threshold — short relationship triples are now embeddable', async () => {
    // Pre-composer: this fact had details.length === 0, isSemantic was false,
    // never embedded. Post-composer: composes to meaningful surface text.
    const f = makeFact({ subjectId: 's-1', predicate: 'works_at', objectId: 'o-1' });
    const ctx = makeCtx({ 's-1': 'Sarah', 'o-1': 'Acme' });
    const text = await defaultFactContentComposer.compose(f, ctx);
    expect(text.length).toBeGreaterThan(0);
  });

  it('honors caller-supplied summaryForEmbedding on atomic facts as an explicit override', async () => {
    const override = 'Sarah is a senior payments engineer at Acme working on the new checkout flow.';
    const f = makeFact({
      subjectId: 's-1',
      predicate: 'works_at',
      objectId: 'o-1',
      summaryForEmbedding: override,
    });
    const ctx = makeCtx({ 's-1': 'Sarah', 'o-1': 'Acme' });
    const text = await defaultFactContentComposer.compose(f, ctx);
    // Should be the override verbatim, NOT the composed "Sarah works_at Acme".
    expect(text).toBe(override);
  });

  it('ignores empty/whitespace-only summaryForEmbedding (falls through to composed surface)', async () => {
    const f = makeFact({
      subjectId: 's-1',
      predicate: 'works_at',
      objectId: 'o-1',
      summaryForEmbedding: '   ',
    });
    const ctx = makeCtx({ 's-1': 'Sarah', 'o-1': 'Acme' });
    const text = await defaultFactContentComposer.compose(f, ctx);
    expect(text).toBe('Sarah works_at Acme');
  });
});

// =============================================================================
// No-truncation guarantees — composers include the full surface area.
// =============================================================================

describe('content composers — no silent truncation', () => {
  it('person composer includes ALL aliases (no MAX_ALIASES cap)', async () => {
    const aliases = Array.from({ length: 12 }, (_, i) => `Alias-${i}`);
    const e = makeEntity({
      type: 'person',
      displayName: 'Polynymous Pavel',
      aliases,
    });
    const text = await personContentComposer.compose(e, makeCtx({}));
    for (const a of aliases) expect(text).toContain(a);
  });

  it('organization composer includes ALL identifiers (no MAX_IDENTIFIERS cap)', async () => {
    const e = makeEntity({
      type: 'organization',
      displayName: 'Conglom',
      identifiers: [
        { kind: 'domain', value: 'conglom.com', isPrimary: true },
        { kind: 'legal_name', value: 'Conglom Industries, Inc.' },
        { kind: 'ticker', value: 'CGLM' },
        { kind: 'duns', value: '123456789' },
        { kind: 'lei', value: 'LEI-XYZ' },
      ],
    });
    const text = await organizationContentComposer.compose(e, makeCtx({}));
    expect(text).toContain('domain:conglom.com');
    expect(text).toContain('legal_name:');
    expect(text).toContain('ticker:CGLM');
    expect(text).toContain('duns:123456789');
    expect(text).toContain('lei:LEI-XYZ');
  });

  it('event composer includes ALL attendees (no MAX_REFERENCED_NAMES_PER_LINE cap)', async () => {
    const attendeeIds = Array.from({ length: 35 }, (_, i) => `a-${i}`);
    const dnMap: Record<string, string> = {};
    attendeeIds.forEach((id, i) => {
      dnMap[id] = `Person ${i}`;
    });
    const e = makeEntity({
      type: 'event',
      displayName: 'All-hands',
      metadata: { attendeeIds, startTime: new Date('2026-05-29T15:00:00Z') },
    });
    const text = await eventContentComposer.compose(e, makeCtx(dnMap));
    // Every attendee's displayName should appear.
    for (let i = 0; i < attendeeIds.length; i++) {
      expect(text).toContain(`Person ${i}`);
    }
  });

  it('task composer includes ALL contextIds (no slice cap)', async () => {
    const contextIds = Array.from({ length: 25 }, (_, i) => `c-${i}`);
    const dnMap: Record<string, string> = {};
    contextIds.forEach((id, i) => {
      dnMap[id] = `Context ${i}`;
    });
    const e = makeEntity({
      type: 'task',
      displayName: 'Wide-context task',
      contextIds,
    });
    const text = await taskContentComposer.compose(e, makeCtx(dnMap));
    for (let i = 0; i < contextIds.length; i++) {
      expect(text).toContain(`Context ${i}`);
    }
  });
});
