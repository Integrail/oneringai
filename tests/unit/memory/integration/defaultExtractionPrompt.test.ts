/**
 * Tests for defaultExtractionPrompt — structural assertions on the prompt.
 */

import { describe, it, expect } from 'vitest';
import { defaultExtractionPrompt } from '@/memory/integration/defaultExtractionPrompt.js';

describe('defaultExtractionPrompt', () => {
  it('includes the signal text', () => {
    const p = defaultExtractionPrompt({
      signalText: 'Hello John, about the Acme deal...',
    });
    expect(p).toContain('Hello John, about the Acme deal');
  });

  it('includes source description when provided', () => {
    const p = defaultExtractionPrompt({
      signalText: 'body',
      signalSourceDescription: 'email from john@acme.com',
    });
    expect(p).toContain('email from john@acme.com');
  });

  it('describes scope correctly', () => {
    const global = defaultExtractionPrompt({ signalText: 'x', targetScope: {} });
    expect(global).toContain('global');
    const group = defaultExtractionPrompt({
      signalText: 'x',
      targetScope: { groupId: 'acme' },
    });
    expect(group).toContain('group-wide');
    expect(group).toContain('acme');
    const user = defaultExtractionPrompt({
      signalText: 'x',
      targetScope: { ownerId: 'u1' },
    });
    expect(user).toContain('user-private');
  });

  it('renders knownEntities section when provided', () => {
    const now = new Date();
    const p = defaultExtractionPrompt({
      signalText: 'x',
      knownEntities: [
        {
          id: 'e1',
          type: 'person',
          displayName: 'John Doe',
          identifiers: [{ kind: 'email', value: 'john@x.com' }],
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    expect(p).toContain('John Doe');
    expect(p).toContain('email=john@x.com');
    expect(p).toContain('Known entities');
  });

  it('omits knownEntities section when none provided', () => {
    const p = defaultExtractionPrompt({ signalText: 'x' });
    expect(p).not.toContain('Known entities');
  });

  it('specifies the required JSON shape', () => {
    const p = defaultExtractionPrompt({ signalText: 'x' });
    expect(p).toContain('"mentions"');
    expect(p).toContain('"facts"');
    expect(p).toContain('"subject"');
    expect(p).toContain('"predicate"');
    expect(p).toContain('contextIds');
  });

  it('instructs JSON-only output', () => {
    const p = defaultExtractionPrompt({ signalText: 'x' });
    expect(p).toContain('ONLY the JSON');
  });

  it('includes reference date for relative date resolution', () => {
    const p = defaultExtractionPrompt({
      signalText: 'x',
      referenceDate: new Date('2026-04-17'),
    });
    expect(p).toContain('2026-04-17');
  });

  it('explains tasks-as-entities convention', () => {
    const p = defaultExtractionPrompt({ signalText: 'x' });
    expect(p).toMatch(/task/i);
    expect(p).toContain('entity');
  });

  it('explains contextIds usage', () => {
    const p = defaultExtractionPrompt({ signalText: 'x' });
    expect(p).toContain('contextIds');
    expect(p).toMatch(/context/i);
  });

  it('provides importance calibration guidance', () => {
    const p = defaultExtractionPrompt({ signalText: 'x' });
    expect(p).toMatch(/importance/i);
    expect(p).toContain('1.0');
    expect(p).toContain('0.5');
  });

  describe('reconciliation section — non-string fact fields', () => {
    const now = new Date();
    const makeFact = (overrides: Record<string, unknown>) =>
      ({
        id: 'F1',
        subjectId: 'e1',
        predicate: 'rescheduled',
        kind: 'atomic',
        observedAt: now,
        ...overrides,
      }) as never;

    it('does not throw when a prior fact carries an object `details` (regression)', () => {
      // Deterministic v25 writers (event-change diffs) store structured
      // `details` objects. `sanitizeInlineString` previously called
      // String.prototype.replace directly → "e.replace is not a function".
      const objectDetails = makeFact({
        details: {
          startTime: { before: now, after: now },
          temporal: { before: 'upcoming', after: 'past' },
        },
      });
      expect(() =>
        defaultExtractionPrompt({ signalText: 'x', priorFacts: [objectDetails] }),
      ).not.toThrow();
    });

    it('serializes object `details` into the rendered prior-fact line', () => {
      const p = defaultExtractionPrompt({
        signalText: 'x',
        priorFacts: [makeFact({ details: { temporal: { before: 'upcoming', after: 'past' } } })],
      });
      expect(p).toContain('F[F1]');
      expect(p).toContain('details=');
      // The object is JSON-stringified rather than crashing.
      expect(p).toContain('temporal');
    });

    it('tolerates undefined / null details and value', () => {
      expect(() =>
        defaultExtractionPrompt({
          signalText: 'x',
          priorFacts: [
            makeFact({ details: undefined, value: undefined }),
            makeFact({ id: 'F2', details: null }),
          ],
        }),
      ).not.toThrow();
    });
  });
});
