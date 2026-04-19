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
});
