/**
 * PR 2 (Phase B) — defaultExtractionPrompt subject-of hints.
 *
 * Production data (oneringai memory: project_prod_dedup_audit_2026_05_26)
 * shows organizations have ~0 atomic facts per entity, projects ~2.5%, events
 * ~5% — extraction is the structural bottleneck for non-person subjects.
 *
 * Opt-in via `subjectOfHintsEnabled: true`. Default off keeps every existing
 * caller bit-identical.
 */

import { describe, it, expect } from 'vitest';
import {
  defaultExtractionPrompt,
  DEFAULT_EXTRACTION_PROMPT_VERSION,
} from '@/memory/integration/defaultExtractionPrompt.js';
import { PredicateRegistry } from '@/memory/predicates/index.js';

const baseRegistry = PredicateRegistry.empty().registerAll([
  {
    name: 'works_at',
    description: 'Person-to-organization employment.',
    category: 'identity',
    subjectTypes: ['person'],
    defaultImportance: 1.0,
  },
  {
    name: 'status_summary',
    description: 'One-sentence current status of the entity.',
    category: 'narrative',
    subjectTypes: ['project'],
    defaultImportance: 0.8,
  },
]);

describe('defaultExtractionPrompt — subject-of hints (opt-in)', () => {
  it('exports prompt version 9', () => {
    expect(DEFAULT_EXTRACTION_PROMPT_VERSION).toBe(9);
  });

  it('default (no flag) does NOT include the subject-of section', () => {
    const p = defaultExtractionPrompt({
      signalText: 'irrelevant',
      predicateRegistry: baseRegistry,
    });
    expect(p).not.toContain('Subjects beyond persons');
    expect(p).not.toContain('When the subject is a `project`');
    expect(p).not.toContain('project as subject');
  });

  it('subjectOfHintsEnabled: true renders the guidance section', () => {
    const p = defaultExtractionPrompt({
      signalText: 'irrelevant',
      predicateRegistry: baseRegistry,
      subjectOfHintsEnabled: true,
    });
    expect(p).toContain('## Subjects beyond persons');
    expect(p).toContain('Positive example — project as subject');
  });

  it('subjectOfHintsEnabled: true switches predicate registry to subjectType grouping', () => {
    const p = defaultExtractionPrompt({
      signalText: 'irrelevant',
      predicateRegistry: baseRegistry,
      subjectOfHintsEnabled: true,
    });
    expect(p).toContain('When the subject is a `person`');
    expect(p).toContain('When the subject is a `project`');
    // Category headers (`### identity`, `### narrative`) should NOT appear
    // since grouping switched to subjectType.
    expect(p).not.toMatch(/### identity\n/);
  });

  it('subjectOfHintsEnabled: true mentions restraint is still required', () => {
    const p = defaultExtractionPrompt({
      signalText: 'irrelevant',
      predicateRegistry: baseRegistry,
      subjectOfHintsEnabled: true,
    });
    // The hints section explicitly tells the LLM not to spam subject-of
    // facts on casual mentions. Failing this assertion means the section was
    // edited to be too permissive — push back before merging.
    expect(p).toContain('Restraint still applies');
  });

  it('without a predicate registry the section still renders if flag is on', () => {
    // The narrative section + example are independent of the registry.
    // Hosts without a registry still benefit from the guidance text.
    const p = defaultExtractionPrompt({
      signalText: 'irrelevant',
      subjectOfHintsEnabled: true,
    });
    expect(p).toContain('## Subjects beyond persons');
    expect(p).toContain('Positive example — project as subject');
  });
});
