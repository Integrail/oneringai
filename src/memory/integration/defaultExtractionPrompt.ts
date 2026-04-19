/**
 * Default prompt template for signal → memory extraction.
 *
 * The LLM is instructed to return JSON with:
 *   - `mentions`: map of local labels → entity surface forms
 *   - `facts`: triples referencing mention labels (not entity IDs)
 *
 * The memory layer's `ExtractionResolver` then translates mention labels into
 * entity IDs (via `upsertEntityBySurface`) and writes the facts.
 *
 * Override via `ExtractionResolverOptions.promptTemplate` for custom behavior
 * (domain-specific predicate vocabularies, extra metadata, etc.).
 */

import type { PredicateRegistry } from '../predicates/PredicateRegistry.js';
import type { IEntity, ScopeFields } from '../types.js';

/**
 * A label already bound to an entity before the LLM runs. Typically produced
 * from signal metadata (email headers, calendar attendees, Slack user list) —
 * strong identifiers let us resolve deterministically and hand the LLM a
 * pre-bound vocabulary so it can reference `m1`, `m2` directly in its output
 * without re-declaring them as mentions.
 */
export interface PreResolvedBinding {
  /** Stable local label (e.g. `m1`). The LLM must use this verbatim in facts. */
  label: string;
  /** Resolved entity — surfaced in the prompt as a human-readable hint. */
  entity: IEntity;
  /** Source role (e.g. `from`, `to`, `cc`, `author`, `attendee`). Free-form. */
  role?: string;
}

export interface ExtractionPromptContext {
  /** Raw text of the signal (email body, transcript, doc content, …). */
  signalText: string;
  /** Optional hint describing where this came from, e.g. "email from john@acme.com". */
  signalSourceDescription?: string;
  /** Scope the extractor should treat as target — guides the LLM's privacy judgment. */
  targetScope?: ScopeFields;
  /** Optional pre-loaded entity candidates the extractor can reference by name. */
  knownEntities?: IEntity[];
  /** Reference date for interpreting relative dates ("next Friday"). Defaults to today. */
  referenceDate?: Date;
  /**
   * When present, the registry's vocabulary is rendered into the prompt so the
   * LLM learns the canonical predicate names + aliases + examples. The LLM may
   * still invent new predicates; unknowns canonicalize at write time and land
   * in `IngestionResult.newPredicates` for review.
   */
  predicateRegistry?: PredicateRegistry;
  /** Cap on predicates shown per category (keeps prompt token budget bounded). Default 5. */
  maxPredicatesPerCategory?: number;
  /**
   * Labels already bound to entities upstream (typically by signal metadata
   * extraction). The prompt renders them as a locked vocabulary and instructs
   * the LLM to reference them directly in facts without redeclaring them.
   */
  preResolvedBindings?: PreResolvedBinding[];
}

export function defaultExtractionPrompt(ctx: ExtractionPromptContext): string {
  const {
    signalText,
    signalSourceDescription,
    targetScope,
    knownEntities,
    referenceDate = new Date(),
    predicateRegistry,
    maxPredicatesPerCategory = 5,
    preResolvedBindings,
  } = ctx;

  const source = signalSourceDescription ? `Source: ${signalSourceDescription}\n` : '';
  const scopeDescription = describeScope(targetScope ?? {});
  const preResolvedSection = renderPreResolvedBindings(preResolvedBindings);
  const knownSection = renderKnownEntities(knownEntities);
  const predicateSection = predicateRegistry
    ? '\n\n' + predicateRegistry.renderForPrompt({ maxPerCategory: maxPredicatesPerCategory })
    : '';

  return `You are extracting structured memory from a signal (email, message, document excerpt, etc.).
Your output populates a knowledge graph of entities (people, organizations, tasks, events, projects, topics) and facts (triples) about them.

## Signal
${source}Reference date: ${referenceDate.toISOString().slice(0, 10)}
Target scope: ${scopeDescription}

<signal_content>
${signalText}
</signal_content>
${preResolvedSection}${knownSection}

## Output format
Return JSON with exactly two top-level keys:

{
  "mentions": {
    "<local_label>": {
      "surface": "<verbatim text as it appeared>",
      "type": "<person | organization | project | task | event | topic | cluster>",
      "identifiers": [{ "kind": "<email|domain|slack_id|phone|github|...>", "value": "..." }],
      "aliases": ["<alternate form nearby in text>"]
    }
  },
  "facts": [
    {
      "subject": "<local_label>",
      "predicate": "<snake_case_relation>",
      "object": "<local_label>",        // for relational facts
      "value": "<any JSON>",              // for attribute facts; set either object OR value, not both
      "details": "<optional free-text narrative>",
      "confidence": 0.0-1.0,
      "importance": 0.0-1.0,              // how much this matters long-term (0.5 default)
      "contextIds": ["<local_label>"],    // other entities this fact is "about"
      "kind": "atomic"                    // or "document" for long-form narrative
    }
  ]
}

## Guidelines
1. **Mentions, not IDs.** The LLM never sees entity IDs. Use local labels like "m1", "m2" to reference entities within this extraction. The system will resolve labels to existing entities or create new ones. If the prompt contains a "Pre-resolved labels" block, those labels are already bound — reference them directly in \`facts\` and DO NOT redeclare them in \`mentions\`.
2. **Strong identifiers.** Extract every strong identifier you can (email, domain, slack_id, github). These are the best signal for deduplication.
3. **Capture surface variants.** If the text uses "Microsoft" and "MSFT" for the same org, include both under the mention's \`aliases\`.
4. **Tasks and events are entities.** "John committed to sending the budget by Friday" is:
   - entity: { type: "task", surface: "Send budget", aliases: [] }
   - fact: { subject: "john_label", predicate: "committed_to", object: "task_label" }
   Task attributes (due date, priority) go as facts about the task entity:
   - fact: { subject: "task_label", predicate: "due_date", value: "2026-04-30" }
5. **Use contextIds for deal/project/meeting binding.** If John's commitment happens in the context of an Acme deal, add the deal's label to the fact's \`contextIds\`. The deal is not subject or object but the activity should be surfaced when querying the deal.
6. **Importance calibration.**
   - 1.0: identity-level facts ("X is CEO", "X works at Y")
   - 0.7: significant decisions, commitments, state changes
   - 0.5: default / observed topics
   - 0.2: trivial / ephemeral observations
7. **Confidence** reflects how sure you are the fact is TRUE, not how important it is.
8. **One observation = one fact.** If the same fact is stated multiple times, emit it once.
9. **Skip pleasantries, greetings, boilerplate.** Extract only what carries knowledge.
10. **Output ONLY the JSON.** No surrounding prose, no code fences.${predicateSection}`;
}

// -------------------------------------------------------------------------

function describeScope(scope: ScopeFields): string {
  if (!scope.groupId && !scope.ownerId) return 'global (visible to all)';
  if (scope.ownerId && !scope.groupId) return `user-private (owner=${scope.ownerId})`;
  if (scope.groupId && !scope.ownerId) return `group-wide (group=${scope.groupId})`;
  return `user-private within group (group=${scope.groupId}, owner=${scope.ownerId})`;
}

function renderPreResolvedBindings(bindings?: PreResolvedBinding[]): string {
  if (!bindings || bindings.length === 0) return '';
  const lines = bindings.map((b) => {
    const idStr = b.entity.identifiers
      .slice(0, 2)
      .map((i) => `${i.kind}=${i.value}`)
      .join(', ');
    const role = b.role ? `${b.role}: ` : '';
    const identity = idStr ? ` (${idStr})` : '';
    return `- \`${b.label}\` — ${role}${b.entity.type} "${b.entity.displayName}"${identity}`;
  });
  const maxIndex = bindings
    .map((b) => {
      const m = /^m(\d+)$/.exec(b.label);
      return m ? Number(m[1]) : 0;
    })
    .reduce((a, b) => (b > a ? b : a), 0);
  const nextHint =
    maxIndex > 0
      ? `When introducing NEW entities from the signal body, start labels at \`m${maxIndex + 1}\`.`
      : 'When introducing NEW entities from the signal body, choose labels that do not collide with the ones above.';
  return `\n## Pre-resolved labels
The following local labels are ALREADY bound to entities in the knowledge graph. Reference them directly in \`facts\`. DO NOT redeclare them in \`mentions\`.

${lines.join('\n')}

${nextHint}\n`;
}

function renderKnownEntities(entities?: IEntity[]): string {
  if (!entities || entities.length === 0) return '';
  const lines = entities
    .slice(0, 40)
    .map((e) => {
      const idStr = e.identifiers
        .slice(0, 2)
        .map((i) => `${i.kind}=${i.value}`)
        .join(', ');
      return `- ${e.type}: "${e.displayName}"${idStr ? ` (${idStr})` : ''}`;
    })
    .join('\n');
  return `\n## Known entities (reuse their surface forms when referring to them)\n${lines}\n`;
}
