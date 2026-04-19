/**
 * Fuzzy name matching — normalized Levenshtein ratio.
 *
 * Returns 0..1 where 1.0 = identical after normalization, 0 = no similarity.
 * Used by EntityResolver to find entities whose display name or aliases are
 * close-but-not-exact matches for the surface text the LLM extracted.
 */

const CORP_SUFFIXES_RE =
  /\b(inc\.?|incorporated|corp\.?|corporation|llc|ltd\.?|limited|co\.?|company|gmbh|s\.?a\.?|plc)\b/gi;
const WHITESPACE_RE = /\s+/g;
const NON_ALPHANUM_RE = /[^\p{L}\p{N}\s]/gu;

/**
 * Normalize a surface form for comparison:
 *   - lowercase
 *   - strip non-alphanumeric except whitespace (apostrophes, commas, dashes, etc.)
 *   - strip common corporate suffixes (Inc, Corp, LLC, etc.)
 *   - collapse whitespace
 *   - trim
 */
export function normalizeSurface(s: string): string {
  return s
    .toLowerCase()
    .replace(NON_ALPHANUM_RE, ' ')
    .replace(CORP_SUFFIXES_RE, ' ')
    .replace(WHITESPACE_RE, ' ')
    .trim();
}

/**
 * Normalized Levenshtein ratio on two surface forms.
 * Returns 0..1. Empty / both-empty returns 1 (identical).
 */
export function normalizedLevenshteinRatio(a: string, b: string): number {
  const na = normalizeSurface(a);
  const nb = normalizeSurface(b);
  if (na.length === 0 && nb.length === 0) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  if (na === nb) return 1;

  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

/** Plain Levenshtein edit distance. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Two-row rolling buffer.
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1]! + 1, // insertion
        prev[j]! + 1, // deletion
        prev[j - 1]! + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n]!;
}
