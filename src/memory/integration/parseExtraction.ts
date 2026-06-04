/**
 * Pure parser for LLM extraction output → `ExtractionOutput`.
 *
 * Lives outside `ConnectorExtractor` so callers (e.g. `SessionIngestorPluginNextGen`)
 * can parse without importing `Agent` (which would introduce an
 * Agent ↔ plugins cycle at module-load time).
 *
 * Two entry points:
 *
 *   - `parseExtractionWithStatus(raw)` returns a rich
 *     `{ status, mentions, facts, reason?, rawExcerpt? }` result so callers
 *     can distinguish "LLM said nothing useful" (status=ok, empty) from
 *     "parser couldn't make sense of the output" (status=parse_error /
 *     shape_error). This is the preferred form inside the library — every
 *     internal call site logs a structured warn on non-ok so transient LLM
 *     hiccups are observable rather than silent.
 *
 *   - `parseExtractionResponse(raw)` is the tolerant back-compat wrapper that
 *     returns only `ExtractionOutput`. Kept for public-API stability; new
 *     callers should prefer the rich form.
 */

import type {
  ExtractionOutput,
  ReconciliationOp,
  SignalReconciliationOp,
  TaskReconciliationOp,
} from './ExtractionResolver.js';
import { parseJsonPermissive } from '../../utils/jsonRepair.js';

/** Outcome of a parse attempt. `ok` is the only shape callers can trust the
 *  mentions/facts fields on (though they may still be empty). */
export type ParseStatus = 'ok' | 'parse_error' | 'shape_error';

/** Rich parse result. `rawExcerpt` is the first ~500 chars of the raw input
 *  — useful for logs without bloating them. */
export interface ParseExtractionResult {
  status: ParseStatus;
  mentions: ExtractionOutput['mentions'];
  facts: ExtractionOutput['facts'];
  /**
   * Reconciliation operations emitted against `priorFacts` (per-conversation
   * reconciliation mode). Captured opportunistically — always populated when
   * the LLM output contained an `operations` array, regardless of whether the
   * prompt was in reconciliation mode. The resolver decides what to do with
   * it (apply if reconciliation mode, log+ignore otherwise).
   */
  operations?: ReconciliationOp[];
  /**
   * One-sentence justification for emitting non-empty output, when the prompt
   * required it (`EagernessProfile.requireJustification = true`). Always
   * captured when present in the LLM output, even under chatty profiles —
   * existence is harmless, absence is what restraint enforces upstream.
   */
  whyActionable?: string;
  /** Short human-readable reason when status !== 'ok'. */
  reason?: string;
  /** Truncated sample of the raw input for logging. */
  rawExcerpt?: string;
}

const RAW_EXCERPT_MAX = 500;

/**
 * Rich parser. Never throws — failures surface as non-ok status.
 *
 * - `status: 'parse_error'` — input didn't contain any valid JSON object.
 * - `status: 'shape_error'` — JSON parsed, but `mentions` was not an object
 *   (e.g. LLM emitted an array) or `facts` was not an array. Whichever
 *   fields *did* match the expected shape are still returned; the other is
 *   filled with the empty default so the caller can partial-commit if it
 *   wants to.
 * - `status: 'ok'` — parse succeeded; `mentions` + `facts` may still be
 *   empty if the LLM genuinely had nothing to extract.
 */
export function parseExtractionWithStatus(raw: string): ParseExtractionResult {
  const rawExcerpt = raw.length > RAW_EXCERPT_MAX ? raw.slice(0, RAW_EXCERPT_MAX) + '…' : raw;

  if (!raw || raw.trim().length === 0) {
    // Explicitly treat empty output as parse_error — an empty string is not
    // a valid "nothing to extract" signal (that would be `{"mentions":{},"facts":[]}`).
    return {
      status: 'parse_error',
      mentions: {},
      facts: [],
      reason: 'LLM returned empty output',
      rawExcerpt,
    };
  }

  // `parseJsonPermissive` runs 5 repair strategies: direct parse → fence/bracket
  // extraction → conservative repair → aggressive repair → verbatim-field strip.
  // Extraction facts carry `details` (verbatim transcript/email quotes) which is
  // the #1 cause of residual parse failures — strip it as a last resort rather
  // than lose the entire extraction for one bad escape.
  let parsed: unknown;
  try {
    parsed = parseJsonPermissive(raw, { stripFieldsAsLastResort: ['details'] });
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return {
      status: 'parse_error',
      mentions: {},
      facts: [],
      reason: 'could not parse JSON from LLM output',
      rawExcerpt,
    };
  }

  const obj = parsed as Record<string, unknown>;
  const mentionsOk =
    obj.mentions !== undefined &&
    typeof obj.mentions === 'object' &&
    obj.mentions !== null &&
    !Array.isArray(obj.mentions);
  const factsOk = obj.facts === undefined || Array.isArray(obj.facts);
  const operationsOk = obj.operations === undefined || Array.isArray(obj.operations);

  const mentions = mentionsOk
    ? sanitizeMentions(obj.mentions as Record<string, unknown>)
    : {};
  const facts = factsOk && Array.isArray(obj.facts) ? (obj.facts as ExtractionOutput['facts']) : [];
  const operations = operationsOk && Array.isArray(obj.operations)
    ? filterValidOperations(obj.operations)
    : undefined;
  const whyActionable =
    typeof obj.whyActionable === 'string' && obj.whyActionable.trim().length > 0
      ? obj.whyActionable.trim()
      : undefined;

  if (!mentionsOk || !factsOk || !operationsOk) {
    const shapeIssues: string[] = [];
    if (!mentionsOk) shapeIssues.push('mentions is not an object');
    if (!factsOk) shapeIssues.push('facts is not an array');
    if (!operationsOk) shapeIssues.push('operations is not an array');
    return {
      status: 'shape_error',
      mentions,
      facts,
      ...(operations !== undefined ? { operations } : {}),
      ...(whyActionable !== undefined ? { whyActionable } : {}),
      reason: shapeIssues.join('; '),
      rawExcerpt,
    };
  }

  return {
    status: 'ok',
    mentions,
    facts,
    ...(operations !== undefined ? { operations } : {}),
    ...(whyActionable !== undefined ? { whyActionable } : {}),
  };
}

/**
 * Validate the shape of each mention object. `contextIds`, if present, MUST be
 * an array of strings — anything else is dropped (would otherwise persist
 * label placeholders or arbitrary junk into the entity's contextIds union
 * helper, which is strictly opt-in to receive label strings).
 *
 * Everything else passes through opaquely — `metadata` is free-form, and
 * adapter-level coercion handles type discipline downstream.
 */
function sanitizeMentions(
  raw: Record<string, unknown>,
): ExtractionOutput['mentions'] {
  const out: ExtractionOutput['mentions'] = {};
  for (const [label, mentionRaw] of Object.entries(raw)) {
    if (!mentionRaw || typeof mentionRaw !== 'object' || Array.isArray(mentionRaw)) {
      continue;
    }
    const m = mentionRaw as Record<string, unknown>;
    if (typeof m.surface !== 'string' || typeof m.type !== 'string') {
      continue;
    }
    const sanitized: Record<string, unknown> = { surface: m.surface, type: m.type };
    if (Array.isArray(m.identifiers)) sanitized.identifiers = m.identifiers;
    if (Array.isArray(m.aliases)) {
      sanitized.aliases = m.aliases.filter((a): a is string => typeof a === 'string');
    }
    if (m.metadata !== undefined && typeof m.metadata === 'object' && m.metadata !== null && !Array.isArray(m.metadata)) {
      sanitized.metadata = m.metadata;
    }
    if (Array.isArray(m.contextIds)) {
      const filtered = m.contextIds.filter(
        (cid): cid is string => typeof cid === 'string' && cid.length > 0,
      );
      // Omit the field when the filtered list is empty — keeps the parsed
      // shape free of meaningless `contextIds: []` entries. Downstream code
      // in `ExtractionResolver` checks `!labels || labels.length === 0` so
      // undefined and empty array are observationally equivalent there.
      if (filtered.length > 0) sanitized.contextIds = filtered;
    }
    out[label] = sanitized as unknown as ExtractionOutput['mentions'][string];
  }
  return out;
}

/**
 * Validate raw LLM ops into the `ReconciliationOp` shape. Drops anything that
 * doesn't match: missing `op`, missing required fields for that op kind, wrong
 * types. We log NOTHING here — caller logs after dispatch with full context.
 * The dispatcher does the real factId-validity check against the priorFacts
 * set.
 */
function parseOneFactOp(o: Record<string, unknown>): ReconciliationOp | null {
  const op = o.op;
  if (op === 'create') {
    if (typeof o.subject !== 'string' || typeof o.predicate !== 'string') return null;
    const kind = o.kind === 'document' ? 'document' : 'atomic';
    return {
      op: 'create',
      subject: o.subject,
      predicate: o.predicate,
      kind,
      object: typeof o.object === 'string' ? o.object : undefined,
      objectId: typeof o.objectId === 'string' ? o.objectId : undefined,
      value: 'value' in o ? o.value : undefined,
      details: typeof o.details === 'string' ? o.details : undefined,
      contextIds: Array.isArray(o.contextIds)
        ? o.contextIds.filter((x): x is string => typeof x === 'string')
        : undefined,
      evidenceQuote: typeof o.evidenceQuote === 'string' ? o.evidenceQuote : undefined,
      importance: typeof o.importance === 'number' ? o.importance : undefined,
      confidence: typeof o.confidence === 'number' ? o.confidence : undefined,
    };
  }
  if (op === 'update') {
    if (typeof o.factId !== 'string') return null;
    if (!('newValue' in o) && typeof o.details !== 'string') return null;
    return {
      op: 'update',
      factId: o.factId,
      newValue: 'newValue' in o ? o.newValue : undefined,
      details: typeof o.details === 'string' ? o.details : undefined,
      evidenceQuote: typeof o.evidenceQuote === 'string' ? o.evidenceQuote : undefined,
      reason: typeof o.reason === 'string' ? o.reason : undefined,
    };
  }
  if (op === 'archive') {
    if (typeof o.factId !== 'string') return null;
    return {
      op: 'archive',
      factId: o.factId,
      evidenceQuote: typeof o.evidenceQuote === 'string' ? o.evidenceQuote : undefined,
      reason: typeof o.reason === 'string' ? o.reason : undefined,
    };
  }
  return null;
}

/**
 * Validate a `task_update` op (signal-reconciliation pass). Requires a string
 * `taskId` AND at least one mutating field (`newState` / `narrative` / `dueAt` /
 * `assigneeId`) — an op that changes nothing is dropped. `reason` and
 * `evidenceQuote` pass through opaquely; the dispatcher enforces the
 * "reason required when newState is set" provenance rule.
 */
function parseOneTaskOp(o: Record<string, unknown>): TaskReconciliationOp | null {
  if (o.op !== 'task_update') return null;
  if (typeof o.taskId !== 'string' || o.taskId.length === 0) return null;
  const newState = typeof o.newState === 'string' && o.newState.trim().length > 0 ? o.newState : undefined;
  const narrative = typeof o.narrative === 'string' ? o.narrative : undefined;
  const dueAt = typeof o.dueAt === 'string' ? o.dueAt : undefined;
  const assigneeId = typeof o.assigneeId === 'string' ? o.assigneeId : undefined;
  if (newState === undefined && narrative === undefined && dueAt === undefined && assigneeId === undefined) {
    return null;
  }
  return {
    op: 'task_update',
    taskId: o.taskId,
    ...(newState !== undefined ? { newState } : {}),
    ...(narrative !== undefined ? { narrative } : {}),
    ...(dueAt !== undefined ? { dueAt } : {}),
    ...(assigneeId !== undefined ? { assigneeId } : {}),
    evidenceQuote: typeof o.evidenceQuote === 'string' ? o.evidenceQuote : undefined,
    reason: typeof o.reason === 'string' ? o.reason : undefined,
  };
}

function filterValidOperations(raw: unknown[]): ReconciliationOp[] {
  const out: ReconciliationOp[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const parsed = parseOneFactOp(item as Record<string, unknown>);
    if (parsed) out.push(parsed);
  }
  return out;
}

/**
 * Validate the signal-reconciliation pass output — both fact ops
 * (`create`/`update`/`archive`) AND `task_update` ops. Unknown ops are dropped.
 */
function filterValidSignalOperations(raw: unknown[]): SignalReconciliationOp[] {
  const out: SignalReconciliationOp[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const parsed: SignalReconciliationOp | null = o.op === 'task_update'
      ? parseOneTaskOp(o)
      : parseOneFactOp(o);
    if (parsed) out.push(parsed);
  }
  return out;
}

/**
 * Resilient to code fences + leading/trailing prose. Returns an empty shape
 * rather than throwing so ingest pipelines can continue.
 *
 * **Prefer `parseExtractionWithStatus` for new code** — this wrapper cannot
 * distinguish "no extractable content" from "parse failure".
 */
export function parseExtractionResponse(raw: string): ExtractionOutput {
  const { mentions, facts } = parseExtractionWithStatus(raw);
  return { mentions, facts };
}

/** Outcome of a reconciliation-ops parse. Mirrors `ParseExtractionResult`
 *  but only validates the `operations` field — `mentions`/`facts` are not
 *  expected from reconciliation prompts. */
export interface ParseReconciliationOpsResult {
  status: ParseStatus;
  operations: ReconciliationOp[];
  reason?: string;
  rawExcerpt?: string;
}

/**
 * Parser for entity-reconciliation prompt output. The reconciliation prompt
 * (`entityReconciliationPrompt`) returns ONLY `{"operations": [...]}` — no
 * `mentions`, no `facts`. Using `parseExtractionWithStatus` here trips a
 * spurious `mentions is not an object` shape_error on every call.
 *
 * - `status: 'parse_error'` — input wasn't valid JSON.
 * - `status: 'shape_error'` — JSON parsed but `operations` wasn't an array.
 * - `status: 'ok'` — `operations` parsed; may be empty (silence is valid).
 */
export function parseReconciliationOpsWithStatus(raw: string): ParseReconciliationOpsResult {
  const rawExcerpt = raw.length > RAW_EXCERPT_MAX ? raw.slice(0, RAW_EXCERPT_MAX) + '…' : raw;

  if (!raw || raw.trim().length === 0) {
    return {
      status: 'parse_error',
      operations: [],
      reason: 'LLM returned empty output',
      rawExcerpt,
    };
  }

  let parsed: unknown;
  try {
    parsed = parseJsonPermissive(raw);
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return {
      status: 'parse_error',
      operations: [],
      reason: 'could not parse JSON from LLM output',
      rawExcerpt,
    };
  }

  const obj = parsed as Record<string, unknown>;
  // `operations` may be omitted entirely — that's the "no conflicts" signal
  // per the reconciliation prompt (`{"operations": []}` or just `{}`).
  const operationsRaw = obj.operations;
  if (operationsRaw !== undefined && !Array.isArray(operationsRaw)) {
    return {
      status: 'shape_error',
      operations: [],
      reason: 'operations is not an array',
      rawExcerpt,
    };
  }

  const operations = Array.isArray(operationsRaw) ? filterValidOperations(operationsRaw) : [];
  return { status: 'ok', operations };
}

/** Outcome of a signal-reconciliation parse — fact ops + `task_update` ops. */
export interface ParseSignalReconciliationOpsResult {
  status: ParseStatus;
  operations: SignalReconciliationOp[];
  reason?: string;
  rawExcerpt?: string;
}

/**
 * Parser for the signal-reconciliation pass (`signalReconciliationPrompt`). The
 * pass returns ONLY `{"operations": [...]}` — no `mentions`, no `facts` — but
 * the ops may be fact ops (`archive`/`update`/`create`) AND `task_update` ops.
 *
 * - `status: 'parse_error'` — input wasn't valid JSON.
 * - `status: 'shape_error'` — JSON parsed but `operations` wasn't an array.
 * - `status: 'ok'` — `operations` parsed; may be empty (silence is valid).
 */
export function parseSignalReconciliationOpsWithStatus(
  raw: string,
): ParseSignalReconciliationOpsResult {
  const rawExcerpt = raw.length > RAW_EXCERPT_MAX ? raw.slice(0, RAW_EXCERPT_MAX) + '…' : raw;

  if (!raw || raw.trim().length === 0) {
    return { status: 'parse_error', operations: [], reason: 'LLM returned empty output', rawExcerpt };
  }

  let parsed: unknown;
  try {
    parsed = parseJsonPermissive(raw);
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return {
      status: 'parse_error',
      operations: [],
      reason: 'could not parse JSON from LLM output',
      rawExcerpt,
    };
  }

  const obj = parsed as Record<string, unknown>;
  const operationsRaw = obj.operations;
  if (operationsRaw !== undefined && !Array.isArray(operationsRaw)) {
    return { status: 'shape_error', operations: [], reason: 'operations is not an array', rawExcerpt };
  }

  const operations = Array.isArray(operationsRaw) ? filterValidSignalOperations(operationsRaw) : [];
  return { status: 'ok', operations };
}

