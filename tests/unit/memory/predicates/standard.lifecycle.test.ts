/**
 * New lifecycle predicates registered in STANDARD_PREDICATES.
 *
 * These back the v25 task/event reconciliation pipeline. Verify the registry
 * still loads, the predicates appear with the expected metadata, and they're
 * consumable via PredicateRegistry.standard().
 */

import { describe, it, expect } from 'vitest';
import {
  STANDARD_PREDICATES,
  PredicateRegistry,
} from '@/memory/predicates/index.js';

describe('STANDARD_PREDICATES — lifecycle additions', () => {
  const reg = PredicateRegistry.standard();

  it.each(['prepares_for', 'cancelled_due_to'] as const)(
    'has %s registered',
    (name) => {
      const def = STANDARD_PREDICATES.find((p) => p.name === name);
      expect(def, `${name} missing from STANDARD_PREDICATES`).toBeDefined();
      expect(def!.description.length).toBeGreaterThan(0);
      expect(reg.get(name)).toBeDefined();
    },
  );

  it('prepares_for is task→event with correct inverse', () => {
    const def = STANDARD_PREDICATES.find((p) => p.name === 'prepares_for')!;
    expect(def.subjectTypes).toEqual(['task']);
    expect(def.objectTypes).toEqual(['event']);
    expect(def.inverse).toBe('prepared_by');
    expect(def.payloadKind).toBe('relational');
  });

  it('cancelled_due_to allows task or event subjects', () => {
    const def = STANDARD_PREDICATES.find((p) => p.name === 'cancelled_due_to')!;
    expect(def.subjectTypes).toEqual(['task', 'event']);
    expect(def.payloadKind).toBe('relational');
  });

  it('does not register predicates removed in 2026-05-26 round-2 consolidation', () => {
    // `completed`, `has_due_date`, `has_priority`, `created`, `reviewed` were
    // duplicates of task entity metadata; `occurred_on`, `scheduled_for`,
    // `started_on`, `ended_on` were duplicates of event/task time metadata.
    // The entire `temporal` category was removed; surviving time information
    // lives on entity metadata only.
    for (const name of [
      'completed',
      'created',
      'reviewed',
      'has_due_date',
      'has_priority',
      'occurred_on',
      'scheduled_for',
      'started_on',
      'ended_on',
    ]) {
      expect(
        STANDARD_PREDICATES.find((p) => p.name === name),
        `${name} should NOT be registered (round-2 consolidation)`,
      ).toBeUndefined();
    }
  });
});
