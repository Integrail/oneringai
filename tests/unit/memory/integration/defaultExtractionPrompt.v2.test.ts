/**
 * Prompt v2 additions — parsimony section, metadata-on-mentions, type-aware
 * known-entities rendering.
 */

import { describe, it, expect } from 'vitest';
import {
  defaultExtractionPrompt,
  DEFAULT_EXTRACTION_PROMPT_VERSION,
} from '@/memory/integration/defaultExtractionPrompt.js';
import type { IEntity } from '@/memory/types.js';

function makeEntity(overrides: Partial<IEntity> & Pick<IEntity, 'type' | 'displayName'>): IEntity {
  const now = new Date();
  return {
    id: overrides.id ?? `e_${Math.random().toString(36).slice(2, 8)}`,
    type: overrides.type,
    displayName: overrides.displayName,
    identifiers: overrides.identifiers ?? [],
    aliases: overrides.aliases,
    metadata: overrides.metadata,
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as IEntity;
}

describe('prompt v2', () => {
  it('version constant is exported and >= 2', () => {
    expect(DEFAULT_EXTRACTION_PROMPT_VERSION).toBeGreaterThanOrEqual(2);
  });

  it('includes the Parsimony section with negative + positive examples', () => {
    const p = defaultExtractionPrompt({ signalText: 'x' });
    expect(p).toContain('## Parsimony');
    expect(p).toContain('AT MOST ONE fact');
    expect(p).toContain('Zero facts is a valid');
    expect(p).toContain('DO NOT DO THIS');
    expect(p).toContain('Positive example');
  });

  it('includes expected fact count calibration by signal type', () => {
    const p = defaultExtractionPrompt({ signalText: 'x' });
    expect(p).toMatch(/Trivial.+0 facts/);
    expect(p).toMatch(/Substantive single-topic.+1 fact/);
  });

  it('schema example shows metadata field with task + event examples', () => {
    const p = defaultExtractionPrompt({ signalText: 'x' });
    expect(p).toContain('"metadata":');
    expect(p).toContain('"state":');
    expect(p).toContain('"dueAt":');
    expect(p).toContain('"startTime":');
    expect(p).toContain('"attendeeIds":');
  });

  it('guideline #4 emphasizes metadata on mentions, not separate facts', () => {
    const p = defaultExtractionPrompt({ signalText: 'x' });
    expect(p).toContain('metadata`');
    expect(p).toContain('carries the structural fields');
    expect(p).toContain('Do NOT restate them as separate facts');
  });

  it('guideline #4 points at state_changed for routing', () => {
    const p = defaultExtractionPrompt({ signalText: 'x' });
    expect(p).toContain('state_changed');
    expect(p).toContain('routes it through the task-state machine');
  });

  it('renders type-aware detail for tasks in knownEntities (state + dueAt)', () => {
    const p = defaultExtractionPrompt({
      signalText: 'x',
      knownEntities: [
        makeEntity({
          type: 'task',
          displayName: 'Send budget',
          metadata: { state: 'in_progress', dueAt: '2026-04-30' },
        }),
      ],
    });
    expect(p).toContain('task: "Send budget"');
    expect(p).toContain('state: in_progress');
    expect(p).toContain('due: 2026-04-30');
  });

  it('renders type-aware detail for events in knownEntities (startTime)', () => {
    const p = defaultExtractionPrompt({
      signalText: 'x',
      knownEntities: [
        makeEntity({
          type: 'event',
          displayName: 'Q3 Planning',
          metadata: { startTime: '2026-05-01T10:00:00Z' },
        }),
      ],
    });
    expect(p).toContain('event: "Q3 Planning"');
    expect(p).toContain('start: 2026-05-01T10:00:00Z');
  });

  it('non-task/non-event entities use the generic rendering (no type-specific detail)', () => {
    const p = defaultExtractionPrompt({
      signalText: 'x',
      knownEntities: [
        makeEntity({
          type: 'topic',
          displayName: 'ERP Renewal',
          metadata: { state: 'irrelevant' }, // state only surfaces on tasks
        }),
      ],
    });
    expect(p).toContain('topic: "ERP Renewal"');
    expect(p).not.toContain('state: irrelevant');
  });

  it('task entity with no metadata still renders cleanly', () => {
    const p = defaultExtractionPrompt({
      signalText: 'x',
      knownEntities: [makeEntity({ type: 'task', displayName: 'Plain task' })],
    });
    expect(p).toContain('task: "Plain task"');
    expect(p).not.toContain('(state');
  });

  it('known-entities block mentions the resolver will converge', () => {
    const p = defaultExtractionPrompt({
      signalText: 'x',
      knownEntities: [makeEntity({ type: 'person', displayName: 'P' })],
    });
    expect(p).toContain('resolver will converge');
  });
});
