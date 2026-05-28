/**
 * Standard predicate library — 45 predicates across 10 categories.
 *
 * Shipped with the memory layer; opt-in via `PredicateRegistry.standard()`.
 * Users can extend (`.register(...)`), override, or replace entirely with
 * `PredicateRegistry.empty().registerAll(...)`.
 *
 * Weights and defaultImportance values are seed values — tune via RankingConfig
 * or by overriding specific predicates.
 *
 * Note: `profile` is consumed by MemorySystem.getContext (document fact with
 * predicate='profile' is the canonical per-entity profile). Renaming it would
 * break retrieval.
 *
 * **Lifecycle policy (added 2026-05).** Every predicate carries a
 * `lifecycle` tag plus optional `defaultValidityDays`. `MemorySystem.addFact`
 * auto-stamps `validUntil` from `defaultValidityDays` so old commitments,
 * observations, and per-message comms naturally expire while identity,
 * structural, and decision facts remain.
 *
 * Per-message communication predicates (`emailed`, `cc_ed`, `mentioned`,
 * `responded_to`, `noted`, `acknowledged`, `interaction_count`) are tagged
 * `excludeFromExtractionPrompt: true` — they remain valid for callers that
 * emit them programmatically (calendar adapters, comms aggregators) but the
 * default extraction prompt no longer advertises them to the LLM. This is
 * deliberate: per-message metadata belongs in aggregation, not in the
 * extracted-fact stream.
 *
 * **Predicate consolidation (2026-05-25, breaking).** Six predicates were
 * deleted outright — their information lives more naturally on entity metadata
 * or in the new first-class `decision_made` predicate:
 *   - `approved` → use `decision_made` (approvals are decisions).
 *   - `assigned_task`, `delegated_to` → assignment lives on `task.metadata.assigneeId`.
 *     (Round-2 update: `committed_to` is *also* deprecated as a parallel emission
 *     alongside extracted tasks — `metadata.evidenceQuote` on the task carries
 *     the verbatim grounding directly. The predicate is kept in the registry
 *     for back-compat fact queries but hidden from the extraction prompt.)
 *   - `state_changed` → task state lives on `task.metadata.state`; transitions
 *     are host-driven via `MemorySystem.transitionTaskState`. LLM extraction no
 *     longer transitions task state from facts.
 *   - `has_status`, `current_status` → status narrative belongs on entity
 *     metadata (e.g. `metadata.jarvis.narrative`), not as facts.
 *
 * **Round 2 consolidation (2026-05-26, breaking).** Nine more predicates
 * deleted — pure duplicates of entity metadata that survived round 1:
 *   - `completed` → `task.metadata.state='done'` + `completedAt` + `stateHistory`.
 *   - `created` → `entity.createdBy` + `createdAt`.
 *   - `reviewed` → when review IS the task, `task.metadata.state='done'`; otherwise
 *     entity metadata on the artifact reviewed.
 *   - `has_due_date` → `task.metadata.dueAt`.
 *   - `has_priority` → `task.metadata.priority`.
 *   - `occurred_on` → `event.metadata.startTime`.
 *   - `scheduled_for` → `event.metadata.startTime` / `task.metadata.dueAt`.
 *   - `started_on` → entity metadata.
 *   - `ended_on` → entity metadata.
 * The entire `temporal` category is gone — time facts on an entity are now
 * carried by the entity itself, never re-emitted as parallel facts.
 *
 * Callers persisting any of these 15 names in legacy data must migrate or accept that
 * canonicalization will no longer match — `PredicateRegistry.canonicalize`
 * returns the raw string when the predicate isn't registered.
 */

import type { PredicateDefinition } from './types.js';

export const STANDARD_PREDICATES: PredicateDefinition[] = [
  // ---------------------------------------------------------------------------
  // identity
  // ---------------------------------------------------------------------------
  {
    name: 'works_at',
    description: 'Person-to-organization employment relationship.',
    category: 'identity',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['organization'],
    inverse: 'employs',
    aliases: ['worksAt', 'employed_by', 'employee_of'],
    defaultImportance: 1.0,
    rankingWeight: 1.5,
    examples: ['(John, works_at, Acme)'],
    lifecycle: 'stable',
  },
  {
    name: 'reports_to',
    description: 'Management chain — subject reports to object.',
    category: 'identity',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['person'],
    inverse: 'manages',
    defaultImportance: 0.9,
    rankingWeight: 1.4,
    examples: ['(John, reports_to, Jane)'],
    lifecycle: 'stable',
  },
  {
    name: 'current_title',
    description: 'Current job title held by the person.',
    category: 'identity',
    payloadKind: 'attribute',
    subjectTypes: ['person'],
    defaultImportance: 1.0,
    rankingWeight: 1.5,
    singleValued: true,
    examples: ['(John, current_title, "VP of Engineering")'],
    lifecycle: 'stateful',
  },
  {
    name: 'current_role',
    description: 'Current functional role within an organization or project.',
    category: 'identity',
    payloadKind: 'attribute',
    subjectTypes: ['person'],
    aliases: ['current_position'],
    defaultImportance: 1.0,
    rankingWeight: 1.5,
    singleValued: true,
    lifecycle: 'stateful',
  },
  {
    name: 'located_in',
    description: 'Geographic or logical location of the subject.',
    category: 'identity',
    payloadKind: 'relational',
    inverse: 'location_of',
    defaultImportance: 0.6,
    rankingWeight: 1.0,
    lifecycle: 'stable',
  },
  {
    name: 'is_member_of',
    description: 'Person belongs to an organization, team, or group.',
    category: 'identity',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['organization'],
    inverse: 'has_member',
    defaultImportance: 0.8,
    rankingWeight: 1.2,
    lifecycle: 'stable',
  },
  {
    name: 'founded',
    description: 'Person founded an organization.',
    category: 'identity',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['organization'],
    inverse: 'founded_by',
    defaultImportance: 1.0,
    rankingWeight: 1.3,
    lifecycle: 'stable',
  },

  // ---------------------------------------------------------------------------
  // organizational
  // ---------------------------------------------------------------------------
  {
    name: 'part_of',
    description: 'Organizational containment — subject is a division/unit of object.',
    category: 'organizational',
    payloadKind: 'relational',
    inverse: 'has_part',
    defaultImportance: 0.7,
    rankingWeight: 1.1,
    lifecycle: 'stable',
  },
  {
    name: 'subsidiary_of',
    description: 'Corporate ownership — subject is a subsidiary of object.',
    category: 'organizational',
    payloadKind: 'relational',
    subjectTypes: ['organization'],
    objectTypes: ['organization'],
    inverse: 'parent_of',
    defaultImportance: 0.9,
    rankingWeight: 1.2,
    lifecycle: 'stable',
  },
  {
    name: 'manages',
    description: 'Subject manages object (direct reporting line, inverse of reports_to).',
    category: 'organizational',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['person'],
    inverse: 'reports_to',
    defaultImportance: 0.9,
    rankingWeight: 1.4,
    lifecycle: 'stable',
  },
  {
    name: 'owns',
    description: 'Subject owns object (asset, company, property).',
    category: 'organizational',
    payloadKind: 'relational',
    inverse: 'owned_by',
    defaultImportance: 0.8,
    rankingWeight: 1.1,
    lifecycle: 'stable',
  },
  {
    name: 'acquired',
    description: 'Subject acquired object (M&A event).',
    category: 'organizational',
    payloadKind: 'relational',
    subjectTypes: ['organization'],
    objectTypes: ['organization'],
    inverse: 'acquired_by',
    defaultImportance: 0.9,
    rankingWeight: 1.2,
    lifecycle: 'stable',
  },
  {
    name: 'merged_with',
    description: 'Subject merged with object to form a combined entity.',
    category: 'organizational',
    payloadKind: 'relational',
    subjectTypes: ['organization'],
    objectTypes: ['organization'],
    inverse: 'merged_with',
    defaultImportance: 0.9,
    rankingWeight: 1.1,
    lifecycle: 'stable',
  },

  // ---------------------------------------------------------------------------
  // task
  // ---------------------------------------------------------------------------
  {
    name: 'committed_to',
    description:
      'DEPRECATED as a parallel fact alongside extracted tasks. The task entity ' +
      'itself carries WHO (`metadata.assigneeId`) + verbatim grounding ' +
      '(`metadata.evidenceQuote`). Predicate retained for backward-compat fact ' +
      'queries and for the strict-no-priorities migration path; hidden from the ' +
      'extraction prompt so the LLM no longer emits it.',
    category: 'task',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['task'],
    inverse: 'committer_of',
    aliases: ['committed', 'promised'],
    defaultImportance: 0.9,
    rankingWeight: 1.3,
    examples: ['(John, committed_to, "Send budget by Friday")'],
    lifecycle: 'ephemeral',
    defaultValidityDays: 90,
    excludeFromExtractionPrompt: true,
  },
  {
    name: 'blocked_by',
    description: 'Task or item is blocked by another task or condition.',
    category: 'task',
    payloadKind: 'relational',
    subjectTypes: ['task'],
    inverse: 'blocks',
    defaultImportance: 0.9,
    rankingWeight: 1.3,
    lifecycle: 'ephemeral',
    defaultValidityDays: 60,
  },
  {
    name: 'depends_on',
    description: 'Task or item depends on another.',
    category: 'task',
    payloadKind: 'relational',
    inverse: 'dependency_of',
    defaultImportance: 0.8,
    rankingWeight: 1.2,
    lifecycle: 'ephemeral',
    defaultValidityDays: 90,
  },
  {
    name: 'prepares_for',
    description:
      'Task is prep for an event — completing the task readies the user for the event. ' +
      'Used to propagate event cancellation/reschedule onto bound prep tasks.',
    category: 'task',
    payloadKind: 'relational',
    subjectTypes: ['task'],
    objectTypes: ['event'],
    inverse: 'prepared_by',
    aliases: ['prep_for', 'preparation_for'],
    defaultImportance: 0.8,
    rankingWeight: 1.3,
    examples: ['(task_456, prepares_for, event_789) — "Prepare slides for JP Morgan meeting"'],
    lifecycle: 'ephemeral',
    defaultValidityDays: 90,
  },
  {
    name: 'cancelled_due_to',
    description:
      'Task or event was cancelled because of another item — typically the cancellation of an ' +
      'underlying event (meeting cancelled → prep task cancelled) or supersession by a newer signal.',
    category: 'task',
    payloadKind: 'relational',
    subjectTypes: ['task', 'event'],
    inverse: 'cancellation_cause_for',
    aliases: ['cancelled_because_of'],
    defaultImportance: 0.9,
    rankingWeight: 1.3,
    examples: ['(task_456, cancelled_due_to, event_789) — meeting was cancelled'],
    lifecycle: 'ephemeral',
    defaultValidityDays: 180,
  },

  // ---------------------------------------------------------------------------
  // decision
  //
  // First-class capture of decisions — choices, approvals, vendor selections,
  // scope cuts, strategy resolutions, multi-party agreements. The verbatim
  // decision text lives in `value` (this is an attribute predicate — fact
  // storage forbids `value` + `objectId` together). Entities the decision
  // is ABOUT (the deal, vendor, project, task) belong in `contextIds`.
  // Subsumes the prior narrower `approved` predicate (now deprecated).
  // ---------------------------------------------------------------------------
  {
    name: 'decision_made',
    description:
      'A decision was made — by a person, in a meeting/event, or about a topic. Captures choices, ' +
      'approvals, vendor selections, scope cuts, strategy resolutions, and multi-party agreements. ' +
      'Subject = the decider (person) OR the venue (event/topic). Value = the verbatim decision. ' +
      'This is an attribute predicate — do NOT set `objectId`; use `contextIds` to link the entities ' +
      'the decision is about (deals, vendors, projects, tasks).',
    category: 'decision',
    payloadKind: 'attribute',
    subjectTypes: ['person', 'event', 'topic'],
    aliases: ['decided', 'chose', 'agreed_on', 'agreed_to'],
    defaultImportance: 0.85,
    rankingWeight: 1.4,
    examples: [
      '(meeting_2026_05_25, decision_made, "Go with Oracle for ERP renewal", contextIds:[vendor_oracle])',
      '(anton, decision_made, "Approve $15k purchase of icas.ai domain", contextIds:[domain_icas])',
      '(anton, decision_made, "Cut scope to Phase 1 only", contextIds:[deal_acme])',
    ],
    lifecycle: 'stable',
  },

  // ---------------------------------------------------------------------------
  // communication
  //
  // Per-message comms (`emailed`, `called`, `messaged`, `cc_ed`, `mentioned`,
  // `responded_to`) are episodic AND excluded from extraction prompts — they
  // belong in metadata aggregation (counts, last_communication_at), not in
  // the LLM's extracted-fact stream. Programmatic callers (calendar adapters,
  // comms aggregators) can still emit them directly.
  // ---------------------------------------------------------------------------
  {
    name: 'emailed',
    description: 'Subject sent an email to object.',
    category: 'communication',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['person'],
    defaultImportance: 0.4,
    rankingWeight: 0.8,
    lifecycle: 'episodic',
    defaultValidityDays: 30,
    excludeFromExtractionPrompt: true,
  },
  {
    name: 'called',
    description: 'Subject called object (phone, video).',
    category: 'communication',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['person'],
    defaultImportance: 0.4,
    rankingWeight: 0.8,
    lifecycle: 'episodic',
    defaultValidityDays: 30,
    excludeFromExtractionPrompt: true,
  },
  {
    name: 'messaged',
    description: 'Subject messaged object (chat, DM).',
    category: 'communication',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['person'],
    defaultImportance: 0.4,
    rankingWeight: 0.8,
    lifecycle: 'episodic',
    defaultValidityDays: 30,
    excludeFromExtractionPrompt: true,
  },
  {
    name: 'met_with',
    description: 'Subject met with object (in-person or virtual meeting).',
    category: 'communication',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['person'],
    defaultImportance: 0.6,
    rankingWeight: 1.0,
    lifecycle: 'episodic',
    defaultValidityDays: 90,
  },
  {
    name: 'mentioned',
    description: 'Subject referenced object in a communication or document.',
    category: 'communication',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    defaultImportance: 0.3,
    rankingWeight: 0.6,
    lifecycle: 'episodic',
    defaultValidityDays: 30,
    excludeFromExtractionPrompt: true,
  },
  {
    name: 'cc_ed',
    description: 'Subject CC-ed object on a communication.',
    category: 'communication',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['person'],
    defaultImportance: 0.2,
    rankingWeight: 0.5,
    lifecycle: 'episodic',
    defaultValidityDays: 30,
    excludeFromExtractionPrompt: true,
  },
  {
    name: 'responded_to',
    description: 'Subject responded to a prior communication.',
    category: 'communication',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    defaultImportance: 0.4,
    rankingWeight: 0.7,
    lifecycle: 'episodic',
    defaultValidityDays: 30,
    excludeFromExtractionPrompt: true,
  },
  {
    name: 'interaction_count',
    description: 'Aggregate interaction counter for an entity pair. Value is a number.',
    category: 'communication',
    payloadKind: 'attribute',
    defaultImportance: 0.5,
    rankingWeight: 1.0,
    isAggregate: true,
    lifecycle: 'stable',
    excludeFromExtractionPrompt: true,
  },

  // ---------------------------------------------------------------------------
  // observation
  // ---------------------------------------------------------------------------
  {
    name: 'observed_topic',
    description: 'Person was observed discussing a topic.',
    category: 'observation',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['topic'],
    defaultImportance: 0.5,
    rankingWeight: 0.8,
    lifecycle: 'episodic',
    defaultValidityDays: 60,
  },
  {
    name: 'expressed_concern',
    description: 'Person expressed concern about an entity, topic, or situation.',
    category: 'observation',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    defaultImportance: 0.8,
    rankingWeight: 1.1,
    lifecycle: 'ephemeral',
    defaultValidityDays: 90,
  },
  {
    name: 'expressed_interest',
    description: 'Person expressed interest in an entity, topic, or situation.',
    category: 'observation',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    defaultImportance: 0.7,
    rankingWeight: 1.0,
    lifecycle: 'ephemeral',
    defaultValidityDays: 90,
  },
  {
    name: 'acknowledged',
    description: 'Person acknowledged a fact, statement, or situation.',
    category: 'observation',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    defaultImportance: 0.4,
    rankingWeight: 0.7,
    lifecycle: 'episodic',
    defaultValidityDays: 30,
    excludeFromExtractionPrompt: true,
  },
  {
    name: 'noted',
    description: 'Person made a passing observation.',
    category: 'observation',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    defaultImportance: 0.3,
    rankingWeight: 0.6,
    lifecycle: 'episodic',
    defaultValidityDays: 30,
    excludeFromExtractionPrompt: true,
  },

  // ---------------------------------------------------------------------------
  // temporal — REMOVED 2026-05-26
  //
  // The four predicates that lived here (`occurred_on`, `scheduled_for`,
  // `started_on`, `ended_on`) were pure duplicates of entity metadata:
  //   - Event time → `event.metadata.startTime` / `endTime`.
  //   - Task due date → `task.metadata.dueAt`.
  //   - Project / engagement spans → entity metadata.
  // Storing the same instant as both an entity field AND a fact created
  // two query paths for one piece of information, both of which had to be
  // kept in sync. Empirically the LLM also misused `scheduled_for` with
  // `person` subjects ("Anna is scheduled for ..."). The category is gone
  // entirely; LLM extraction routes time information to entity metadata.
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // event  (attendance relationships — seeded by CalendarSignalAdapter)
  // ---------------------------------------------------------------------------
  {
    name: 'attended',
    description: 'Person attended an event (meeting, call, conference).',
    category: 'event',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['event'],
    inverse: 'attended_by',
    defaultImportance: 0.5,
    rankingWeight: 0.9,
    examples: ['(Alice, attended, Q3-planning-review)'],
    lifecycle: 'episodic',
    defaultValidityDays: 90,
  },
  {
    name: 'hosted',
    description: 'Person hosted or organized an event.',
    category: 'event',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['event'],
    inverse: 'hosted_by',
    defaultImportance: 0.7,
    rankingWeight: 1.0,
    examples: ['(Alice, hosted, Q3-planning-review)'],
    lifecycle: 'episodic',
    defaultValidityDays: 90,
  },

  // ---------------------------------------------------------------------------
  // priority  (Chief-of-Staff goal tracking; surfaces "what is this user
  // working toward?" via memory_graph walks)
  // ---------------------------------------------------------------------------
  {
    name: 'tracks_priority',
    description:
      'Person tracks a long-term priority (quarterly/yearly goal). Multi-valued — a user typically tracks several priorities.',
    category: 'priority',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['priority'],
    inverse: 'tracked_by',
    defaultImportance: 0.9,
    rankingWeight: 1.4,
    examples: ['(me, tracks_priority, "Ship NA launch Q2 2026")'],
    lifecycle: 'stable',
  },
  {
    name: 'priority_affects',
    description:
      'Priority bears on / governs another entity (project, deal, person, topic). Used to answer "is X relevant to a current priority?".',
    category: 'priority',
    payloadKind: 'relational',
    subjectTypes: ['priority'],
    inverse: 'affected_by_priority',
    defaultImportance: 0.8,
    rankingWeight: 1.2,
    examples: ['("Ship NA launch", priority_affects, "NA Launch project")'],
    lifecycle: 'stable',
  },

  // ---------------------------------------------------------------------------
  // document  (narrative facts; details is long-form)
  // ---------------------------------------------------------------------------
  {
    name: 'profile',
    description:
      'Canonical long-form profile for an entity. Consumed by MemorySystem.getContext. Keep the name as-is.',
    category: 'document',
    payloadKind: 'narrative',
    defaultImportance: 1.0,
    rankingWeight: 1.0,
    lifecycle: 'stable',
  },
  {
    name: 'biography',
    description: 'Background narrative about a person.',
    category: 'document',
    payloadKind: 'narrative',
    subjectTypes: ['person'],
    defaultImportance: 0.8,
    rankingWeight: 1.0,
    lifecycle: 'stable',
  },
  {
    name: 'memo',
    description: 'Short written memo or note.',
    category: 'document',
    payloadKind: 'narrative',
    defaultImportance: 0.6,
    rankingWeight: 1.0,
    lifecycle: 'stable',
  },
  {
    name: 'meeting_notes',
    description: 'Notes captured during a meeting.',
    category: 'document',
    payloadKind: 'narrative',
    defaultImportance: 0.7,
    rankingWeight: 1.0,
    lifecycle: 'stable',
  },
  {
    name: 'research_note',
    description: 'Research or investigation note.',
    category: 'document',
    payloadKind: 'narrative',
    defaultImportance: 0.6,
    rankingWeight: 1.0,
    lifecycle: 'stable',
  },
  {
    name: 'has_document',
    description:
      'Canonical relational predicate binding any entity (event, project, task, person, …) to a long-form document entity (type=\'document\'). One predicate for every kind of attached doc — distinguish by the document\'s own metadata.role (brief, plan, transcript, spec, notes, artifact, …).',
    category: 'document',
    payloadKind: 'relational',
    objectTypes: ['document'],
    inverse: 'document_of',
    aliases: ['has_doc', 'attached_document'],
    defaultImportance: 0.7,
    rankingWeight: 1.0,
    examples: [
      '(event_q3-planning, has_document, doc_brief-q3-planning)',
      '(project_na-launch, has_document, doc_plan-na-launch)',
    ],
    lifecycle: 'stable',
    // Programmatic only — emitted by attachDocument/detachDocument, not by the
    // extraction pipeline. Authoring attachments belongs to the wrapper API.
    excludeFromExtractionPrompt: true,
  },

  // ---------------------------------------------------------------------------
  // social
  // ---------------------------------------------------------------------------
  {
    name: 'knows',
    description: 'Subject knows object personally or professionally.',
    category: 'social',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['person'],
    defaultImportance: 0.5,
    rankingWeight: 0.8,
    lifecycle: 'stable',
  },
  {
    name: 'works_with',
    description: 'Ongoing working relationship (colleague, collaborator).',
    category: 'social',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['person'],
    defaultImportance: 0.6,
    rankingWeight: 0.9,
    lifecycle: 'stable',
  },
  {
    name: 'colleague_of',
    description: 'Peer relationship within the same organization.',
    category: 'social',
    payloadKind: 'relational',
    subjectTypes: ['person'],
    objectTypes: ['person'],
    defaultImportance: 0.5,
    rankingWeight: 0.8,
    lifecycle: 'stable',
  },
];
