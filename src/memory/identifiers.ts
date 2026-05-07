/**
 * Canonical identifier helpers.
 *
 * Some entity types (tasks, events, topics, clusters) lack a natural external
 * strong key — there's no `email` for a task. Without a deterministic identifier
 * the resolver falls back to fuzzy display-name matching, which drifts quickly
 * across re-extractions: "Send budget by Friday" one day, "Budget deliverable
 * for sarah" the next. The LLM phrases the same task ten ways.
 *
 * A canonical identifier fixes this. Callers construct a deterministic value
 * from the entity's structural invariants (assignee + context + slugged title
 * for a task, source + external id for a calendar event) and wrap it as
 * `{ kind: 'canonical', value }`. Tier-1 identifier match in `EntityResolver`
 * converges re-extractions to the same entity for free.
 *
 * **Convention (not enforcement):** the resolver treats `canonical` like any
 * other identifier kind. Nothing stops you from using a custom kind — but
 * using `'canonical'` uniformly lets tooling (debug UI, audit queries, bulk
 * cleanup scripts) recognize the pattern.
 */

import type { Identifier } from './types.js';

// ---------------------------------------------------------------------------
// Kind-aware identifier-value normalization
// ---------------------------------------------------------------------------

/**
 * Identifier kinds whose values are semantically case-insensitive — i.e. the
 * domain-level identity is preserved when you uppercase or lowercase the value.
 * For these, the storage layer normalizes to lowercase so equality comparisons
 * are stable across casual typing variations.
 *
 * **Examples**
 *   - `email`        — RFC 5321 treats the local part as case-sensitive in
 *                      principle, but every mail system in practice treats it
 *                      case-insensitively. Lowercasing is universally safe.
 *   - `domain`       — DNS is case-insensitive (RFC 4343).
 *   - `phone`        — already digits + symbols.
 *   - `url_host`     — same as `domain`.
 *
 * **NOT case-insensitive (preserve original case):**
 *   - `system_user_id` — Meteor `Random.id()` is base57 (case-sensitive).
 *                        `JsTx8jbywjpL7dK8B` ≠ `jstx8jbywjpl7dk8b`.
 *   - `canonical`    — caller-controlled convention; canonicalIdentifier()
 *                      already lowercases the slug it builds, but external
 *                      callers may use their own scheme.
 *   - `slack_id`, `github`, `ticker`, `duns`, hashes, tokens, etc. — case
 *                      may be load-bearing.
 *
 * To extend: add the kind to this set. Doing so retroactively requires data
 * migration of any existing values stored in the OPPOSITE case — see the
 * library README's section on "Identifier case migration" for the helper.
 */
export const CASE_INSENSITIVE_IDENTIFIER_KINDS: ReadonlySet<string> = new Set([
  'email',
  'domain',
  'phone',
  'url_host',
]);

/**
 * Apply the kind's case-normalization rule to a raw identifier value. This is
 * the SINGLE source of truth used by both the storage write path (so all
 * persisted values are normalized identically) and the lookup path (so query
 * keys match the stored shape). Adding a new case-insensitive kind without
 * updating this function is a bug — it'll write one shape and look up another.
 */
export function normalizeIdentifierValue(kind: string, value: string): string {
  if (CASE_INSENSITIVE_IDENTIFIER_KINDS.has(kind)) return value.toLowerCase();
  return value;
}

/**
 * Compare two identifier values under their kind-specific normalization rule.
 * Used by dedup comparators (does this entity already have an identifier
 * matching the one we're about to add?) and by exact-match lookups.
 */
export function identifierValuesEqual(
  kindA: string,
  valueA: string,
  kindB: string,
  valueB: string,
): boolean {
  if (kindA !== kindB) return false;
  return normalizeIdentifierValue(kindA, valueA) === normalizeIdentifierValue(kindB, valueB);
}

export interface SlugifyOptions {
  /** Max length of the slug (default 40). Truncation drops whole words where possible. */
  maxLength?: number;
}

/**
 * Deterministic URL-safe slug. Lowercase, ASCII alphanumerics + dashes, no
 * leading/trailing dashes, collapsed dash runs. Stable across calls for the
 * same input — that's the whole point.
 */
export function slugify(text: string, opts: SlugifyOptions = {}): string {
  const maxLength = opts.maxLength ?? 40;
  if (maxLength <= 0) return '';

  const normalized = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (normalized.length <= maxLength) return normalized;

  const truncated = normalized.slice(0, maxLength);
  const lastDash = truncated.lastIndexOf('-');
  if (lastDash > 0 && lastDash >= maxLength - 12) {
    return truncated.slice(0, lastDash);
  }
  return truncated.replace(/-$/, '');
}

export interface CanonicalIdentifierOptions {
  /** Max length of the final slug portion (default 40). */
  slugMaxLength?: number;
}

/**
 * Build a canonical identifier for an entity that lacks a natural external key.
 *
 * The resulting value is `<type>:<part>:<part>:...` where undefined/empty
 * parts are dropped. The last part is slugified; earlier parts are used as-is
 * (they're typically entity ids or identifier kinds, already safe). If you
 * want all parts slugified, slugify them before calling.
 *
 * @example
 *   canonicalIdentifier('task', {
 *     assignee: 'user_123',
 *     context: 'topic_erp_renewal',
 *     title: 'Send budget by Friday',
 *   })
 *   // → { kind: 'canonical', value: 'task:user_123:topic_erp_renewal:send-budget-by-friday' }
 *
 * @example  Calendar event
 *   canonicalIdentifier('event', { source: 'gcal', id: '3k9f...abc' })
 *   // → { kind: 'canonical', value: 'event:gcal:3k9f-abc' }
 */
export function canonicalIdentifier(
  type: string,
  parts: Record<string, string | undefined>,
  opts: CanonicalIdentifierOptions = {},
): Identifier {
  if (!type || type.trim().length === 0) {
    throw new Error('canonicalIdentifier: type must be a non-empty string');
  }

  // Pre-pass: collect non-empty trimmed values in iteration order. The LAST
  // surviving value is what gets slugified — NOT the last positional key.
  // Positional last-slugging would silently skip slugification when trailing
  // keys resolve to undefined / empty-string, leaving spaces / uppercase in
  // the final canonical value and breaking identity stability.
  const keys = Object.keys(parts);
  const collected: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    const raw = parts[keys[i]!];
    if (raw === undefined || raw === null) continue;
    const trimmed = String(raw).trim();
    if (trimmed.length === 0) continue;
    collected.push(trimmed);
  }

  if (collected.length === 0) {
    throw new Error('canonicalIdentifier: at least one non-empty part required');
  }

  const values: string[] = collected.map((v, i) =>
    i === collected.length - 1 ? slugify(v, { maxLength: opts.slugMaxLength }) : v,
  );

  return {
    kind: 'canonical',
    value: `${type}:${values.join(':')}`,
    isPrimary: false,
  };
}
