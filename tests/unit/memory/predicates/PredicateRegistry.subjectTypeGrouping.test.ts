/**
 * PR 2 (Phase B) — PredicateRegistry.renderForPrompt({ groupBy: 'subjectType' }).
 *
 * Default behavior (`groupBy: 'category'`, the historical default) stays
 * intact; the new mode buckets predicates by their `subjectTypes` hint so
 * extraction prompts can surface non-person-subject vocabulary first-class.
 */

import { describe, it, expect } from 'vitest';
import { PredicateRegistry } from '@/memory/predicates/index.js';
import type { PredicateDefinition } from '@/memory/predicates/index.js';

const worksAt: PredicateDefinition = {
  name: 'works_at',
  description: 'Person-to-organization employment.',
  category: 'identity',
  subjectTypes: ['person'],
  defaultImportance: 1.0,
};
const statusSummary: PredicateDefinition = {
  name: 'status_summary',
  description: 'One-sentence current status of the entity.',
  category: 'narrative',
  subjectTypes: ['project'],
  defaultImportance: 0.8,
};
const employeeCount: PredicateDefinition = {
  name: 'employee_count',
  description: 'How many people work at this organization.',
  category: 'attribute',
  subjectTypes: ['organization'],
  defaultImportance: 0.7,
};
const noted: PredicateDefinition = {
  // Multi-typed — should appear under EACH subject-type bucket.
  name: 'noted',
  description: 'A passing observation made by the subject.',
  category: 'narrative',
  subjectTypes: ['person', 'project'],
  defaultImportance: 0.3,
};
const untyped: PredicateDefinition = {
  // No subjectTypes — lands in the `generic` bucket.
  name: 'discussed_topic',
  description: 'Subject discussed the given topic.',
  category: 'narrative',
  defaultImportance: 0.4,
};

function makeRegistry(): PredicateRegistry {
  return PredicateRegistry.empty().registerAll([
    worksAt,
    statusSummary,
    employeeCount,
    noted,
    untyped,
  ]);
}

describe('PredicateRegistry.renderForPrompt — groupBy: subjectType', () => {
  it('buckets predicates under each declared subject type', () => {
    const out = makeRegistry().renderForPrompt({ groupBy: 'subjectType' });

    expect(out).toContain('### When the subject is a `person`');
    expect(out).toContain('### When the subject is a `project`');
    expect(out).toContain('### When the subject is a `organization`');

    // works_at appears only under person.
    const personIdx = out.indexOf('### When the subject is a `person`');
    const projectIdx = out.indexOf('### When the subject is a `project`');
    const worksAtIdx = out.indexOf('`works_at`');
    expect(worksAtIdx).toBeGreaterThan(personIdx);
    expect(worksAtIdx).toBeLessThan(projectIdx);
  });

  it('renders multi-typed predicates under EVERY listed subject', () => {
    const out = makeRegistry().renderForPrompt({ groupBy: 'subjectType' });
    // `noted` has subjectTypes: ['person', 'project']. It must appear at
    // least twice in the rendered output.
    const matches = out.match(/`noted`/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('puts predicates without subjectTypes in a `generic` bucket, rendered last', () => {
    const out = makeRegistry().renderForPrompt({ groupBy: 'subjectType' });
    expect(out).toContain('### When the subject is a `generic`');
    // Generic header must come after every type-specific header in the output.
    const genericIdx = out.indexOf('### When the subject is a `generic`');
    const personIdx = out.indexOf('### When the subject is a `person`');
    const projectIdx = out.indexOf('### When the subject is a `project`');
    const orgIdx = out.indexOf('### When the subject is a `organization`');
    expect(genericIdx).toBeGreaterThan(personIdx);
    expect(genericIdx).toBeGreaterThan(projectIdx);
    expect(genericIdx).toBeGreaterThan(orgIdx);
  });

  it('still respects maxPerCategory cap inside each subject-type bucket', () => {
    // Three person-subject predicates, cap to 2 — drop the lowest-importance.
    const r = PredicateRegistry.empty().registerAll([
      { name: 'a', description: 'x', category: 'x', subjectTypes: ['person'], defaultImportance: 0.9 },
      { name: 'b', description: 'x', category: 'x', subjectTypes: ['person'], defaultImportance: 0.5 },
      { name: 'c', description: 'x', category: 'x', subjectTypes: ['person'], defaultImportance: 0.1 },
    ]);
    const out = r.renderForPrompt({ groupBy: 'subjectType', maxPerCategory: 2 });
    expect(out).toContain('`a`');
    expect(out).toContain('`b`');
    expect(out).not.toContain('`c`');
  });

  it('default (no groupBy) preserves historical category grouping', () => {
    // Smoke test: omitting groupBy must render the original `### identity`
    // / `### narrative` / `### attribute` shape, not subject-type headers.
    const out = makeRegistry().renderForPrompt();
    expect(out).toContain('### identity');
    expect(out).toContain('### narrative');
    expect(out).not.toContain('When the subject is a');
  });

  it('explicit groupBy: "category" matches default behavior', () => {
    const a = makeRegistry().renderForPrompt();
    const b = makeRegistry().renderForPrompt({ groupBy: 'category' });
    expect(a).toBe(b);
  });
});
