/**
 * Shared adapter-layer guard: warn when a paginated read is issued with a
 * `limit` but no `orderBy`. Without a sort, the adapter's natural order
 * (Mongo `_id` asc, InMemory insertion order) decides which items survive
 * the cap — that's silent, biased data loss the caller is unlikely to notice.
 *
 * Suppress with env var `ONERINGAI_SUPPRESS_ORDER_WARNINGS=1`. Useful when a
 * caller genuinely wants natural order (e.g., one-off audit dump) and is
 * willing to vouch for it.
 *
 * The warning is fired at WARN level (console.warn) once per call. We do NOT
 * dedupe — every offending call site should be heard until fixed.
 */

import { makeEnvFlag } from '../envFlag.js';

const suppression = makeEnvFlag('ONERINGAI_SUPPRESS_ORDER_WARNINGS');

/**
 * Reset the suppression cache. Tests override the env var per case and need
 * the flag re-read on the next call.
 */
export function _resetOrderWarningSuppression(): void {
  suppression.reset();
}

export function warnIfLimitWithoutOrder(
  adapter: string,
  method: 'listEntities' | 'findFacts' | 'searchEntities',
  opts: { limit?: number; orderBy?: unknown },
): void {
  if (suppression.isSet()) return;
  if (opts.limit === undefined) return;
  if (opts.orderBy !== undefined) return;
  // Capture a stack so the caller site is visible in the log.
  const stack = new Error().stack ?? '<no stack>';
  // Drop the first two frames (this function + the adapter wrapper) so the
  // user-visible head of the trace points at the offending call site.
  const trimmed = stack.split('\n').slice(3).join('\n');
  console.warn(
    `[oneringai] ${adapter}.${method} called with limit=${opts.limit} but no orderBy. ` +
      `Results will use the adapter's natural order (insertion / _id asc), which silently ` +
      `drops items past the cap based on storage position rather than relevance. Pass an ` +
      `orderBy explicitly, or suppress with ONERINGAI_SUPPRESS_ORDER_WARNINGS=1.\n${trimmed}`,
  );
}
