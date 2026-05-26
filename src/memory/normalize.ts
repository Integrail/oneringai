/**
 * Library-internal helper that stamps the indexable normalized-name fields
 * on every entity write.
 *
 * The fields exist so EntityResolver Tier 2/3 + the atomic-upsert path in
 * `MemorySystem.upsertEntityBySurface` can perform O(1) indexed exact-match
 * lookup instead of the legacy substring-then-filter approach. See
 * `EntityResolver.ts` and the Phase A design notes.
 *
 * Single source of truth — every entity write path (adapter `createEntity` /
 * `updateEntity`) calls this helper so the stored fields can never drift
 * from `displayName` / `aliases`. The normalization rule itself is owned by
 * `normalizeSurface` in `resolution/fuzzy.ts`; reuse there is intentional so
 * resolver matching + storage stay in lockstep.
 *
 * Backward-compat for legacy data: pre-0.8.0 entities don't carry these
 * fields. Adapters' read paths return them as undefined; `findEntitiesByNormalizedName`
 * skips entities lacking the field until the host runs the backfill helper.
 */

import { normalizeSurface } from './resolution/fuzzy.js';

export interface NormalizedNameFields {
  normalizedDisplayName: string;
  normalizedAliases: string[];
}

/**
 * Compute the normalized-name fields from an entity's `displayName` + `aliases`.
 * Pure function — same input always yields the same output, no I/O. Safe to
 * call on every write (the cost is one regex pass per field).
 *
 * Both outputs are always populated:
 *  - `normalizedDisplayName` is `normalizeSurface(displayName)`, which may
 *    be the empty string if the input collapses entirely (pure punctuation /
 *    whitespace). Callers should treat empty as "no usable normalized form"
 *    when querying.
 *  - `normalizedAliases` is each alias normalized + deduped, with empties
 *    dropped. Order is stable (first-seen wins on dedupe) so the storage
 *    value remains comparable across writes.
 */
export function computeNormalizedFields(args: {
  displayName: string;
  aliases?: string[];
}): NormalizedNameFields {
  const normalizedDisplayName = normalizeSurface(args.displayName);
  const seen = new Set<string>();
  const normalizedAliases: string[] = [];
  if (args.aliases) {
    for (const a of args.aliases) {
      if (!a || a.length === 0) continue;
      const n = normalizeSurface(a);
      if (!n) continue;
      if (seen.has(n)) continue;
      seen.add(n);
      normalizedAliases.push(n);
    }
  }
  return { normalizedDisplayName, normalizedAliases };
}
