/**
 * Signal-reconciliation prompt — the SECOND pass.
 *
 * The design: a signal is analysed in two passes.
 *   1. EXTRACT (existing `defaultExtractionPrompt`) → produces the NEW facts +
 *      tasks observed in this signal.
 *   2. RECONCILE (this prompt) → given those newly-observed facts/tasks AND the
 *      prior facts/tasks already known (loaded deterministically from the same
 *      thread/series PLUS via semantic search, de-duplicated), decide what the
 *      new observation IMPLIES for the prior state and emit operations:
 *        - `archive` a prior fact the new info supersedes (facts are immutable —
 *          supersession = archive the stale one; the replacement was created in
 *          pass 1),
 *        - `task_update` a prior task whose state / narrative / due date changed
 *          (including marking it `done` / `cancelled` when the new content shows
 *          the work is complete or no longer relevant).
 *
 * This is source-agnostic: the same prompt runs for email conversations, meeting
 * transcripts, Slack threads, CRM streams — any signal path. The caller renders
 * the new + prior context; this prompt only decides the reconciliation ops.
 *
 * Distinct from:
 *   - `defaultExtractionPrompt`'s inline reconciliation block (per-thread, paired
 *     with NEW signal content, FACTS only).
 *   - `entityReconciliationPrompt` (cross-source, anchored on ONE entity's facts,
 *     FACTS only).
 * This prompt is signal-anchored and reconciles BOTH facts and tasks.
 *
 * Output schema: `{ "operations": [...] }` parsed by
 * `parseSignalReconciliationOpsWithStatus` and dispatched by
 * `MemorySystem.applyReconciliationOps`.
 */

import type { IEntity, IFact } from '../types.js';

export const SIGNAL_RECONCILIATION_PROMPT_VERSION = 1;

/** A newly-observed fact rendered as context (no id — it already exists). */
export interface NewFactSummary {
  predicate: string;
  value?: unknown;
  details?: string;
  /** Human label/surface for the subject (for the LLM to read; not an id). */
  subjectLabel?: string;
  objectLabel?: string;
  evidenceQuote?: string;
}

/** A newly-observed/created task rendered as context (no id needed). */
export interface NewTaskSummary {
  title: string;
  state?: string;
  dueAt?: string;
  evidenceQuote?: string;
}

export interface SignalReconciliationPromptContext {
  /** Newly observed facts from this signal (pass 1 output) — context only. */
  newFacts?: NewFactSummary[];
  /** Newly observed/created tasks from this signal (pass 1 output) — context only. */
  newTasks?: NewTaskSummary[];
  /**
   * Prior facts that MAY be superseded. Each MUST carry an `id` the LLM can put
   * in an `archive`/`update` op's `factId`. No truncation — caller controls scope.
   * Pre-decorate `evidenceQuote` / `sourceSignalDescription` for ranking.
   */
  priorFacts: Array<IFact & { sourceSignalDescription?: string }>;
  /**
   * Prior OPEN tasks that MAY need updating / closing. Each MUST carry an `id`
   * the LLM can put in a `task_update` op's `taskId`. Reads `displayName`,
   * `metadata.state`, `metadata.narrative`, `metadata.dueAt`.
   */
  priorTasks: IEntity[];
  /** Reference date for interpreting "most recent". Defaults to today. */
  referenceDate?: Date;
}

export function signalReconciliationPrompt(ctx: SignalReconciliationPromptContext): string {
  const { newFacts = [], newTasks = [], priorFacts, priorTasks, referenceDate = new Date() } = ctx;

  const newFactLines = newFacts.map((f) => renderNewFact(f));
  const newTaskLines = newTasks.map((t) => renderNewTask(t));
  const priorFactLines = priorFacts.map((f) => renderPriorFact(f));
  const priorTaskLines = priorTasks.map((t) => renderPriorTask(t));

  const newBlock =
    newFactLines.length === 0 && newTaskLines.length === 0
      ? '(nothing newly extracted this pass)'
      : [
          newFactLines.length > 0 ? `Facts:\n${newFactLines.join('\n')}` : '',
          newTaskLines.length > 0 ? `Tasks:\n${newTaskLines.join('\n')}` : '',
        ]
          .filter(Boolean)
          .join('\n');

  return `You are reconciling what a NEW signal just told us against what we already knew.

Pass 1 already extracted the new facts/tasks below. Your ONLY job now is to decide what those new observations IMPLY for the PRIOR facts and tasks: which prior facts are now superseded, and which prior tasks changed state (got done, got cancelled, were rescheduled, or their summary is now wrong).

Reference date: ${referenceDate.toISOString().slice(0, 10)}

## Newly observed (from the current signal)

${newBlock}

## Prior facts (may be superseded)

${priorFactLines.length > 0 ? priorFactLines.join('\n') : '(none)'}

## Prior tasks (may need updating or closing)

${priorTaskLines.length > 0 ? priorTaskLines.join('\n') : '(none)'}

## What to emit

Output JSON with a single key:

{
  "operations": [
    { "op": "archive", "factId": "<id from prior facts>", "evidenceQuote": "<verbatim quote from the NEW content>", "reason": "<why the new info supersedes this fact>" },
    { "op": "task_update", "taskId": "<id from prior tasks>", "newState": "done|cancelled|in_progress", "narrative": "<optional refreshed one-line summary>", "dueAt": "<optional ISO date if rescheduled>", "evidenceQuote": "<verbatim quote from the NEW content>", "reason": "<brief reasoning — REQUIRED when newState is set>" }
  ]
}

## Rules

1. **Facts are immutable — supersede by \`archive\`.** When a new fact contradicts or replaces a prior fact (status changed, value updated, commitment fulfilled, request answered), \`archive\` the prior one. Do NOT emit \`update\` or \`create\` for facts — pass 1 already created the replacement.
2. **Tasks are mutable — \`task_update\` them.** Mark \`newState: "done"\` when the new content shows the work was completed / the question was answered / the meeting occurred and produced its outcome. Mark \`newState: "cancelled"\` when the task is no longer relevant (dropped, superseded by a different decision, meeting cancelled). Use \`narrative\` to refresh a stale summary, \`dueAt\` when rescheduled.
3. **Use the literal \`id\` values shown above.** Hallucinated factId/taskId values are REJECTED. Never invent ids. Never reference a new fact/task — they aren't reconciliation targets.
4. **Every op MUST cite a verbatim \`evidenceQuote\` from the NEW content, plus a \`reason\`.** \`reason\` is mandatory on any \`task_update\` that sets \`newState\`. Ops without evidence are downgraded to no-ops.
5. **Bias conservative on terminal task states.** Only mark \`done\`/\`cancelled\` when the new content is decisive. A drive-by mention is NOT completion. When unsure, leave the task open (emit nothing for it).
6. **Silence is the right answer when nothing changed.** Return \`{"operations": []}\` if the new signal neither supersedes a prior fact nor changes a prior task.

Output ONLY the JSON. No surrounding prose, no code fences.`;
}

// =============================================================================
// Helpers
// =============================================================================

function renderNewFact(f: NewFactSummary): string {
  const subj = f.subjectLabel ? `${f.subjectLabel} ` : '';
  const obj = f.objectLabel ? ` → ${f.objectLabel}` : '';
  const val =
    f.value !== undefined ? ` = ${truncateInline(stringifyForPrompt(f.value), 120)}` : '';
  const det = f.details ? ` details="${truncateInline(escapeQuotes(f.details), 120)}"` : '';
  const ev = f.evidenceQuote ? ` evidence="${truncateInline(escapeQuotes(f.evidenceQuote), 80)}"` : '';
  return `- ${subj}[${f.predicate}]${val}${obj}${det}${ev}`;
}

function renderNewTask(t: NewTaskSummary): string {
  const state = t.state ? ` state=${t.state}` : '';
  const due = t.dueAt ? ` due=${truncateInline(escapeQuotes(t.dueAt), 24)}` : '';
  const ev = t.evidenceQuote ? ` evidence="${truncateInline(escapeQuotes(t.evidenceQuote), 80)}"` : '';
  return `- "${truncateInline(escapeQuotes(t.title), 120)}"${state}${due}${ev}`;
}

function renderPriorFact(f: IFact & { sourceSignalDescription?: string }): string {
  const valueOrObject = f.objectId
    ? ` object=${f.objectId}`
    : f.value !== undefined
      ? ` value=${truncateInline(stringifyForPrompt(f.value), 120)}`
      : '';
  const detailsBit = f.details ? ` details="${truncateInline(escapeQuotes(f.details), 100)}"` : '';
  const observedBit =
    f.observedAt instanceof Date ? ` observed=${f.observedAt.toISOString().slice(0, 10)}` : '';
  const sourceBit = f.sourceSignalDescription
    ? ` source="${truncateInline(escapeQuotes(f.sourceSignalDescription), 80)}"`
    : '';
  const evidenceBit = f.evidenceQuote
    ? ` evidence="${truncateInline(escapeQuotes(f.evidenceQuote), 80)}"`
    : '';
  return `- F[${f.id}] [${f.predicate}]${valueOrObject}${detailsBit}${observedBit}${sourceBit}${evidenceBit}`;
}

function renderPriorTask(t: IEntity): string {
  const md = (t.metadata ?? {}) as Record<string, unknown>;
  const state = typeof md.state === 'string' ? ` state=${md.state}` : '';
  const due = md.dueAt ? ` due=${truncateInline(escapeQuotes(stringifyForPrompt(md.dueAt)), 24)}` : '';
  const narrative =
    typeof md.narrative === 'string' && md.narrative.length > 0
      ? ` summary="${truncateInline(escapeQuotes(md.narrative), 140)}"`
      : '';
  return `- T[${t.id}] "${truncateInline(escapeQuotes(t.displayName), 120)}"${state}${due}${narrative}`;
}

function stringifyForPrompt(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
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
