/**
 * Prompt v13 additions:
 *  - `extractableEntityTypes` allowlist parameterises both the mention-schema
 *    `type` enum and the human-readable intro line.
 *  - "World isn't a fact" posture explicitly bans participation/presence/vague-
 *    affect facts.
 *  - `expressed_concern` / `expressed_interest` require a priority binding via
 *    `contextIds`.
 *  - Tasks ARE the commitment record (no parallel `committed_to` emission).
 *  - Examples re-grounded on predicates that exist in `standard.ts`.
 */

import { describe, it, expect } from 'vitest';
import {
  defaultExtractionPrompt,
  DEFAULT_EXTRACTABLE_ENTITY_TYPES,
  DEFAULT_EXTRACTION_PROMPT_VERSION,
} from '@/memory/integration/defaultExtractionPrompt.js';

describe('prompt v13 — extraction surface tightening', () => {
  it('exports v13 version constant', () => {
    expect(DEFAULT_EXTRACTION_PROMPT_VERSION).toBe(13);
  });

  it('default allowlist keeps the prior 7 types (backwards-compat)', () => {
    expect(DEFAULT_EXTRACTABLE_ENTITY_TYPES).toEqual([
      'person',
      'organization',
      'project',
      'task',
      'event',
      'topic',
      'cluster',
    ]);
  });

  describe('extractableEntityTypes allowlist', () => {
    it('default — schema enum + intro use the full 7 types', () => {
      const p = defaultExtractionPrompt({ signalText: 'irrelevant' });
      // Schema enum:
      expect(p).toContain('"<person | organization | project | task | event | topic | cluster>"');
      // Intro list (Oxford-comma, pluralised):
      expect(p).toContain(
        'entities (people, organizations, projects, tasks, events, topics, and clusters)',
      );
    });

    it('shrinks both surfaces when the host passes a narrower allowlist', () => {
      const p = defaultExtractionPrompt({
        signalText: 'irrelevant',
        extractableEntityTypes: ['person', 'organization', 'task', 'topic'],
      });
      // Mention-schema enum now reflects only the 4 ICOS-emittable types:
      expect(p).toContain('"<person | organization | task | topic>"');
      // Intro list mirrors the schema:
      expect(p).toContain('entities (people, organizations, tasks, and topics)');
      // Old types must NOT appear in the schema enum (defence against partial
      // edits that leave the intro narrowed but the enum wide):
      expect(p).not.toContain('| project |');
      expect(p).not.toContain('| event |');
      expect(p).not.toContain('| cluster>');
    });

    it('narrow allowlist also hides event/project teaching content', () => {
      const p = defaultExtractionPrompt({
        signalText: 'irrelevant',
        extractableEntityTypes: ['person', 'organization', 'task', 'topic'],
      });
      // No event-shaped metadata example
      expect(p).not.toContain('"startTime": "2026-05-01T10:00:00Z"');
      expect(p).not.toContain('"attendeeIds":');
      // No "Event:" bullet in rule 4
      expect(p).not.toMatch(/^\s*- \*\*Event\*\*:/m);
      // No prepares_for(task↔event) — event missing, so this relational pair
      // shouldn't be advertised.
      expect(p).not.toContain('`prepares_for` (task↔event)');
      // Heading reflects only allowed types
      expect(p).toContain('Tasks and Topics are entities with metadata');
      // Anchor-binding hint mentions only task/topic, not event
      expect(p).toContain('Multi-entity binding via `contextIds` (task / topic)');
    });

    it('narrow allowlist hides project-as-subject example in subject-of section', () => {
      const p = defaultExtractionPrompt({
        signalText: 'irrelevant',
        subjectOfHintsEnabled: true,
        extractableEntityTypes: ['person', 'organization', 'task', 'topic'],
      });
      // The "project as subject" header + ICOS-launch example must be gone
      expect(p).not.toContain('project as subject');
      expect(p).not.toContain('ICOS launch slipped to Q3');
      // Subject-of section still renders (organization is allowed) — falls
      // back to the organization-as-subject example.
      expect(p).toContain('## Subjects beyond persons');
      expect(p).toContain('organization as subject');
    });

    it('person-only allowlist hides the subject-of section entirely', () => {
      const p = defaultExtractionPrompt({
        signalText: 'irrelevant',
        subjectOfHintsEnabled: true,
        extractableEntityTypes: ['person'],
      });
      expect(p).not.toContain('## Subjects beyond persons');
    });

    it('empty allowlist falls back to the default (treat as unset)', () => {
      const p = defaultExtractionPrompt({
        signalText: 'irrelevant',
        extractableEntityTypes: [],
      });
      // Same as no-allowlist case — defensive default.
      expect(p).toContain('"<person | organization | project | task | event | topic | cluster>"');
    });
  });

  describe('"world isn\'t a fact" posture', () => {
    it('renders the explicit-ban paragraph by default', () => {
      const p = defaultExtractionPrompt({ signalText: 'irrelevant' });
      expect(p).toContain("### The world isn't a fact");
      expect(p).toContain('cc-ed / messaged / called / met with / attended / hosted');
      expect(p).toContain('per-message participation noise');
      expect(p).toContain('vague affect with no actionable content');
      expect(p).toContain('"the exec will use this to ___"');
    });

    it('teaches that Tasks ARE the commitment record (no parallel committed_to fact)', () => {
      const p = defaultExtractionPrompt({ signalText: 'irrelevant' });
      expect(p).toContain('### Tasks ARE the commitment record');
      expect(p).toContain('Task entity IS the lineage record');
      expect(p).toContain('zero parallel facts');
    });

    it('teaches that concerns/interests must bind to a tracked priority', () => {
      const p = defaultExtractionPrompt({ signalText: 'irrelevant' });
      expect(p).toContain('### Concerns and interests must bind to a tracked priority');
      // Prompt uses backtick-quoted identifier in markdown: `contextIds`
      expect(p).toContain('`contextIds`');
      expect(p).toContain("host's restraint guard");
    });
  });

  describe('cleaned examples (dead predicates removed)', () => {
    it('negative example no longer references discussed_topic / proposed_meeting_with', () => {
      const p = defaultExtractionPrompt({ signalText: 'irrelevant' });
      expect(p).not.toContain('discussed_topic');
      expect(p).not.toContain('proposed_meeting_with');
      expect(p).not.toContain('discussed_in');
    });

    it('positive example demonstrates priority-bound expressed_concern with contextIds', () => {
      const p = defaultExtractionPrompt({ signalText: 'irrelevant' });
      // The new positive example uses a real predicate from standard.ts:
      expect(p).toContain('"predicate": "expressed_concern"');
      // v13.b: example uses a placeholder, not a hardcoded synthetic id —
      // the LLM should fill in from the rendered Active priorities block.
      expect(p).toContain('"contextIds": ["<priority_anchor_id_from_active_priorities>"]');
      // Defensive: no synthetic ids left to mimic.
      expect(p).not.toContain('"priority_q3_budget"');
      expect(p).not.toContain('"priority_q3_launch"');
    });

    it('subject-of teaching no longer cites employee_count', () => {
      const p = defaultExtractionPrompt({
        signalText: 'irrelevant',
        subjectOfHintsEnabled: true,
      });
      expect(p).not.toContain('employee_count');
    });

    it('document-kind examples use predicates that exist in standard.ts', () => {
      const p = defaultExtractionPrompt({ signalText: 'irrelevant' });
      // Killed (unregistered) doc-kind predicate names:
      expect(p).not.toContain('learned_pattern');
      expect(p).not.toContain('meeting_recap');
      // Real registry predicates the example should teach:
      expect(p).toContain('"research_note"');
      expect(p).toContain('"meeting_notes"');
      expect(p).toContain('"memo"');
    });
  });
});
