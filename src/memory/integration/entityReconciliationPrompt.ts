/**
 * Entity-anchored cross-source reconciliation prompt.
 *
 * Pillar 2 of the fact-reconciliation design (see ICOS plan
 * `.claude/plans/thread-fact-reconciliation.md`). Distinct from
 * `defaultExtractionPrompt`'s reconciliation block — that one is per-thread
 * (Pillar 1) and is paired with NEW signal content. This prompt is
 * cross-source: it shows ALL non-archived facts on ONE entity (regardless of
 * source) and asks the LLM to find genuine conflicts.
 *
 * Output schema: same `operations` array as the default prompt, restricted to
 * `update` / `archive` only — Pillar 2 reconciles, never creates.
 */

import type { IEntity, IFact } from '../types.js';

export const ENTITY_RECONCILIATION_PROMPT_VERSION = 1;

export interface EntityReconciliationPromptContext {
  /** The entity whose facts we are reconciling. */
  entity: IEntity;
  /**
   * All non-archived facts on this entity for the calling user. No
   * truncation, no cap — the caller is responsible for scope.
   *
   * Each fact MUST carry an `id` that the LLM can reference in op
   * `factId`. Caller should pre-decorate `evidenceQuote` and any
   * `sourceSignalDescription` it wants the LLM to see for ranking.
   */
  facts: Array<
    IFact & {
      /** Human-readable source description (e.g. "email from anton on 2026-05-15"). */
      sourceSignalDescription?: string;
    }
  >;
  /** Reference date for interpreting "most recent". Defaults to today. */
  referenceDate?: Date;
}

export function entityReconciliationPrompt(ctx: EntityReconciliationPromptContext): string {
  const { entity, facts, referenceDate = new Date() } = ctx;
  // Group by (predicate, objectIdKey) so the LLM sees conflict candidates
  // clustered. This is the same grouping the V25 cheap gate uses.
  const groups = groupByPredicateAndObject(facts);

  const groupBlocks: string[] = [];
  for (const [groupKey, members] of groups) {
    const [predicate, objKey] = parseGroupKey(groupKey);
    const head = objKey === '' ? `predicate=${predicate}` : `predicate=${predicate} object=${objKey}`;
    const lines = members.map((f) => renderFactLine(f));
    groupBlocks.push(`### ${head}\n${lines.join('\n')}`);
  }

  return `You are reconciling facts about a single entity that come from MULTIPLE different sources.

Your job is to find GENUINE conflicts and resolve them, NOT to clean up parallel observations.

## Entity
- id: ${entity.id}
- type: ${entity.type}
- displayName: ${escapeQuotes(entity.displayName)}

Reference date: ${referenceDate.toISOString().slice(0, 10)}

## Facts on this entity (grouped by predicate)

${groupBlocks.join('\n\n')}

## What to emit

For each GENUINE conflict — same predicate, same object (if any), contradictory values across different sources — decide which fact is current and emit ops on the older/superseded ones.

Output JSON with a single key:

{
  "operations": [
    { "op": "archive", "factId": "<id from list above>", "evidenceQuote": "<verbatim quote from the WINNING fact's source>", "reason": "<short why this is superseded>" },
    { "op": "update", "factId": "<id from list above>", "newValue": "<replacement value>", "evidenceQuote": "<verbatim quote>", "reason": "<short reason>" }
  ]
}

## Rules

1. **No \`create\` ops.** Entity reconciliation only resolves existing conflicts. Brand-new facts come from signal extraction, not this prompt.
2. **Use the literal \`id\` values shown above.** Hallucinated factIds will be REJECTED. Do not invent ids.
3. **Every \`archive\`/\`update\` MUST cite \`evidenceQuote\` and \`reason\`.** Ops without evidence will be downgraded to no-ops.
4. **Prefer the most recent + most decisive evidence.** When two facts disagree, the later observation usually wins — but only when the later source actually addresses the same state. A drive-by mention does NOT override a structured update.
5. **If two facts cover DIFFERENT aspects, emit nothing.** Different predicates, different objectIds, or genuinely parallel observations are NOT conflicts.
6. **Silence is the right answer when there are no conflicts.** Return \`{"operations": []}\` if everything is consistent.

Output ONLY the JSON. No surrounding prose, no code fences.`;
}

// =============================================================================
// Helpers
// =============================================================================

const GROUP_KEY_SEP = '';

function groupByPredicateAndObject(
  facts: Array<IFact & { sourceSignalDescription?: string }>,
): Map<string, Array<IFact & { sourceSignalDescription?: string }>> {
  const groups = new Map<string, Array<IFact & { sourceSignalDescription?: string }>>();
  for (const f of facts) {
    const key = `${f.predicate}${GROUP_KEY_SEP}${f.objectId ?? ''}`;
    const existing = groups.get(key);
    if (existing) existing.push(f);
    else groups.set(key, [f]);
  }
  // Sort each group by observedAt ascending so the LLM sees oldest → newest.
  for (const [, list] of groups) {
    list.sort((a, b) => toMillis(a.observedAt) - toMillis(b.observedAt));
  }
  return groups;
}

function parseGroupKey(key: string): [string, string] {
  const idx = key.indexOf(GROUP_KEY_SEP);
  if (idx < 0) return [key, ''];
  return [key.slice(0, idx), key.slice(idx + 1)];
}

function toMillis(d: Date | undefined): number {
  if (!d) return 0;
  if (d instanceof Date) return d.getTime();
  // Defensive: ISO string slipped through coercion. Don't crash.
  const t = new Date(d as unknown as string).getTime();
  return Number.isFinite(t) ? t : 0;
}

function renderFactLine(f: IFact & { sourceSignalDescription?: string }): string {
  const valueOrObject = f.objectId
    ? ` object=${f.objectId}`
    : f.value !== undefined
      ? ` value=${truncateInline(stringifyForPrompt(f.value), 120)}`
      : '';
  const detailsBit = f.details
    ? ` details="${truncateInline(escapeQuotes(f.details), 100)}"`
    : '';
  const observedBit = f.observedAt instanceof Date
    ? ` observed=${f.observedAt.toISOString().slice(0, 10)}`
    : '';
  const sourceBit = f.sourceSignalDescription
    ? ` source="${truncateInline(escapeQuotes(f.sourceSignalDescription), 80)}"`
    : f.sourceSignalId
      ? ` source=${f.sourceSignalId}`
      : '';
  const evidenceBit = f.evidenceQuote
    ? ` evidence="${truncateInline(escapeQuotes(f.evidenceQuote), 80)}"`
    : '';
  return `- F[${f.id}]${valueOrObject}${detailsBit}${observedBit}${sourceBit}${evidenceBit}`;
}

function stringifyForPrompt(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function truncateInline(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function escapeQuotes(s: unknown): string {
  // Runtime guard: callers pass `entity.displayName` / `f.details` /
  // `f.sourceSignalDescription` / `f.evidenceQuote`, all typed `string` —
  // but MongoDB-sourced data can legitimately violate that (undefined
  // displayName, object/number details from older writes). Coerce defensively
  // so one bad field never kills the whole entity reconciliation.
  if (typeof s === 'string') {
    return s.replace(/[\r\n]+/g, ' ').replace(/"/g, '\\"');
  }
  if (s === undefined || s === null) return '';
  try {
    return JSON.stringify(s).replace(/[\r\n]+/g, ' ').replace(/"/g, '\\"');
  } catch {
    return String(s).replace(/[\r\n]+/g, ' ').replace(/"/g, '\\"');
  }
}
