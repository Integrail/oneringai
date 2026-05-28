/**
 * PredicateRegistry — the pluggable vocabulary.
 *
 * Holds a set of PredicateDefinitions. Supports canonicalization
 * (camelCase/dash/alias → snake_case), lookup, LLM-prompt rendering, and
 * ranking-weight derivation.
 *
 * Usage patterns:
 *   - `PredicateRegistry.standard()` — ship-with-the-library 45-predicate set
 *     across 10 categories. Authoritative count lives in `standard.ts`'s
 *     header — update both when the standard set grows.
 *   - `PredicateRegistry.empty().registerAll([...])` — build your own vocab.
 *   - `PredicateRegistry.standard().register(...).register(...)` — extend.
 *
 * The registry is OPTIONAL on MemorySystem. When absent, predicates remain
 * free-form strings.
 */

import type { PredicateDefinition } from './types.js';
import { STANDARD_PREDICATES } from './standard.js';
import { editDistance } from '../resolution/fuzzy.js';

export class PredicateRegistry {
  private byName = new Map<string, PredicateDefinition>();
  private byAlias = new Map<string, string>();

  /**
   * Returns a fresh registry seeded with the standard 45-predicate set
   * (10 categories). Called as a factory — each invocation produces an
   * independent instance, so mutations never leak between MemorySystems
   * or tests. The authoritative count lives in `standard.ts`'s header.
   */
  static standard(): PredicateRegistry {
    const registry = new PredicateRegistry();
    registry.registerAll(STANDARD_PREDICATES);
    return registry;
  }

  /** Returns an empty registry. Use for fully custom vocabularies. */
  static empty(): PredicateRegistry {
    return new PredicateRegistry();
  }

  register(def: PredicateDefinition): this {
    if (def.isAggregate && def.singleValued) {
      throw new Error(
        `PredicateRegistry.register: '${def.name}' cannot be both isAggregate and singleValued`,
      );
    }
    if (this.byName.has(def.name)) {
      throw new Error(`PredicateRegistry.register: duplicate predicate name '${def.name}'`);
    }
    if (this.byAlias.has(def.name)) {
      throw new Error(
        `PredicateRegistry.register: name '${def.name}' collides with existing alias`,
      );
    }
    for (const rawAlias of def.aliases ?? []) {
      const alias = rawAlias.toLowerCase();
      if (this.byName.has(alias)) {
        throw new Error(
          `PredicateRegistry.register: alias '${alias}' of '${def.name}' collides with existing predicate name`,
        );
      }
      if (this.byAlias.has(alias)) {
        throw new Error(
          `PredicateRegistry.register: alias '${alias}' of '${def.name}' already belongs to '${this.byAlias.get(alias)}'`,
        );
      }
    }
    this.byName.set(def.name, def);
    for (const rawAlias of def.aliases ?? []) {
      this.byAlias.set(rawAlias.toLowerCase(), def.name);
    }
    return this;
  }

  registerAll(defs: PredicateDefinition[]): this {
    for (const def of defs) this.register(def);
    return this;
  }

  unregister(name: string): this {
    const def = this.byName.get(name);
    if (!def) return this;
    this.byName.delete(name);
    for (const alias of def.aliases ?? []) {
      this.byAlias.delete(alias.toLowerCase());
    }
    return this;
  }

  /**
   * Resolve an input name (already-canonical, alias, camelCase, or dashed
   * form) to the canonical definition, or null.
   */
  get(nameOrAlias: string): PredicateDefinition | null {
    const canonical = this.canonicalize(nameOrAlias);
    return this.byName.get(canonical) ?? null;
  }

  has(nameOrAlias: string): boolean {
    return this.get(nameOrAlias) !== null;
  }

  /**
   * Normalize an input string to the canonical predicate name.
   *   - 'worksAt' → 'works_at'        (camelCase → snake)
   *   - 'works-at' → 'works_at'       (dash → snake)
   *   - 'Works At' → 'works_at'       (whitespace → snake)
   *   - 'employed_by' → 'works_at'    (alias lookup)
   *   - 'unknown_thing' → 'unknown_thing'  (unchanged — registry is permissive)
   */
  canonicalize(input: string): string {
    const normalized = normalize(input);
    if (this.byName.has(normalized)) return normalized;
    const viaAlias = this.byAlias.get(normalized);
    if (viaAlias) return viaAlias;
    return normalized;
  }

  /**
   * Best-effort near-match for an unknown predicate. Returns the canonical
   * name of the closest known predicate within a length-aware edit-distance
   * budget, or `null` if nothing is close enough.
   *
   * Used by `ExtractionResolver`'s H5 drift policy to snap LLM typos like
   * `"work_at"` onto the registered `"works_at"`. Does NOT help with pure
   * semantic mismatches (`"discussed_topic"` ↛ `"mentioned"`) — those need
   * human-in-the-loop review of the `newPredicates` report.
   *
   * **F3 — length-aware distance budget.** A flat distance-2 threshold is too
   * loose for long predicates where 2-char swaps flip meaning
   * (`talks_at` ↔ `works_at`). The effective budget is:
   *
   *   effectiveMax = min(maxDistance, max(1, floor(min(lenA, lenB) / 4)))
   *
   * So short predicates allow distance 1, 8-char predicates allow 2, 12+ char
   * predicates allow 3 — matching how typos scale with word length. Callers
   * can tighten with `opts.maxDistance` (absolute cap) or override entirely
   * by passing a very low value.
   */
  findClosest(
    input: string,
    opts?: { maxDistance?: number },
  ): { name: string; distance: number } | null {
    const maxDistance = opts?.maxDistance ?? 2;
    const normalized = normalize(input);
    let best: { name: string; distance: number } | null = null;
    const consider = (candidate: string, canonical: string): void => {
      // F3: length-aware clamp. Use the shorter length so padding a short
      // unknown onto a long registered name doesn't get an inflated budget.
      const minLen = Math.min(normalized.length, candidate.length);
      const lengthBudget = Math.max(1, Math.floor(minLen / 4));
      const effectiveMax = Math.min(maxDistance, lengthBudget);
      const d = editDistance(normalized, candidate);
      if (d > effectiveMax) return;
      if (best === null || d < best.distance) best = { name: canonical, distance: d };
    };
    for (const name of this.byName.keys()) consider(name, name);
    for (const [alias, canonical] of this.byAlias.entries()) consider(alias, canonical);
    return best;
  }

  /**
   * List definitions, optionally filtered by category or subject-type hint.
   *
   * This is the general enumeration API — it returns every registered
   * definition. To get the LLM-facing subset (excluding noise predicates
   * tagged `excludeFromExtractionPrompt`), use `renderForPrompt` or filter
   * the result yourself on `excludeFromExtractionPrompt`.
   */
  list(filter?: { categories?: string[]; subjectType?: string }): PredicateDefinition[] {
    const all = Array.from(this.byName.values());
    if (!filter) return all;
    return all.filter((def) => {
      if (filter.categories && !filter.categories.includes(def.category)) return false;
      if (
        filter.subjectType &&
        def.subjectTypes &&
        def.subjectTypes.length > 0 &&
        !def.subjectTypes.includes(filter.subjectType)
      ) {
        return false;
      }
      return true;
    });
  }

  categories(): string[] {
    const set = new Set<string>();
    for (const def of this.byName.values()) set.add(def.category);
    return Array.from(set).sort();
  }

  /**
   * Render the registry as a markdown block suitable for injection into an
   * LLM extraction prompt. Chunked by category; capped by `maxPerCategory`
   * to keep the prompt token budget bounded.
   *
   * ⚠️ **Default-filter behavior change (lifecycle rollout).** Predicates
   * flagged `excludeFromExtractionPrompt: true` are omitted by default. In
   * the standard registry that hides per-message communication noise from
   * the LLM vocabulary: `emailed`, `called`, `messaged`, `cc_ed`,
   * `mentioned`, `responded_to`, `acknowledged`, `noted`,
   * `interaction_count`. These predicates remain fully valid for direct
   * callers (calendar adapters, comms aggregators, extractors that emit
   * them programmatically) — only the LLM's view of the vocabulary
   * narrows.
   *
   * **If your host previously embedded the full `renderForPrompt()` output
   * into a custom prompt and relied on those names being present, pass
   * `includeExcluded: true` to preserve the prior surface.** Default-mode
   * callers that just want a cleaner extraction prompt need do nothing.
   *
   * Use `list()` (or filter on `excludeFromExtractionPrompt` yourself) when
   * you need the full registered set for non-prompt purposes.
   */
  renderForPrompt(opts?: {
    categories?: string[];
    subjectType?: string;
    maxPerCategory?: number;
    /** When true, include `excludeFromExtractionPrompt` predicates. */
    includeExcluded?: boolean;
    /**
     * Bucketing dimension for the rendered vocabulary.
     *
     * - `'category'` (default) — groups by `def.category`. Original behavior.
     * - `'subjectType'` — groups by the `subjectTypes` hint, with predicates
     *   appearing under EACH of their listed types. Predicates without
     *   `subjectTypes` land in a `### generic` bucket. Used by hosts that
     *   want the LLM to extract subject-of facts for non-person subjects
     *   (projects, organizations, events) without a person being the actor.
     *   Pair with `ExtractionPromptContext.subjectOfHintsEnabled` to render
     *   the matching narrative section in `defaultExtractionPrompt`.
     */
    groupBy?: 'category' | 'subjectType';
  }): string {
    const max = opts?.maxPerCategory ?? 5;
    const filter = { categories: opts?.categories, subjectType: opts?.subjectType };
    const includeExcluded = opts?.includeExcluded === true;
    const defs = this.list(filter).filter(
      (d) => includeExcluded || !d.excludeFromExtractionPrompt,
    );
    if (defs.length === 0) return '';

    const groupBy = opts?.groupBy ?? 'category';
    const buckets = new Map<string, PredicateDefinition[]>();
    const pushTo = (key: string, def: PredicateDefinition): void => {
      const bucket = buckets.get(key) ?? [];
      bucket.push(def);
      buckets.set(key, bucket);
    };
    for (const def of defs) {
      if (groupBy === 'subjectType') {
        const subjectTypes = def.subjectTypes ?? [];
        if (subjectTypes.length === 0) {
          pushTo('generic', def);
        } else {
          for (const t of subjectTypes) pushTo(t, def);
        }
      } else {
        pushTo(def.category, def);
      }
    }

    const lines: string[] = [];
    lines.push('## Predicate vocabulary');
    if (groupBy === 'subjectType') {
      lines.push(
        'Use these predicate names where applicable, organized by the subject type they describe. ' +
          'Predicates listed under `generic` accept any subject. ' +
          'Most facts have a person as the subject, but the non-person buckets exist for facts whose subject is a project, organization, event, etc.',
      );
    } else {
      lines.push(
        'Use these predicate names where applicable. If none fits, invent a snake_case one.',
      );
    }
    lines.push('');

    // Header order: alphabetical when grouping by category; subjectType
    // grouping puts the special `generic` bucket last so type-specific
    // buckets surface first and the LLM sees them as the primary mental model.
    const keys = Array.from(buckets.keys()).sort((a, b) => {
      if (groupBy === 'subjectType') {
        if (a === 'generic') return 1;
        if (b === 'generic') return -1;
      }
      return a < b ? -1 : a > b ? 1 : 0;
    });

    for (const key of keys) {
      const header = groupBy === 'subjectType' ? `When the subject is a \`${key}\`` : key;
      lines.push(`### ${header}`);
      // Sort each bucket by (defaultImportance desc, name asc) so the
      // most-important predicates surface within the `max`-per-bucket cap.
      // Without this, `.slice(0, max)` keeps whatever order the predicates
      // were registered in (Map insertion order via `byName.values()`),
      // silently dropping high-importance predicates registered later.
      // Stable tie-break by name keeps the prompt output deterministic.
      const sorted = buckets.get(key)!.slice().sort((a, b) => {
        const ia = a.defaultImportance ?? 0;
        const ib = b.defaultImportance ?? 0;
        if (ia !== ib) return ib - ia; // desc
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      });
      const items = sorted.slice(0, max);
      for (const def of items) {
        const parts: string[] = [`- \`${def.name}\` — ${def.description}`];
        if (def.inverse) parts.push(`(inverse: \`${def.inverse}\`)`);
        if (def.aliases && def.aliases.length > 0) {
          parts.push(`(aliases: ${def.aliases.map((a) => `\`${a}\``).join(', ')})`);
        }
        lines.push(parts.join(' '));
        if (def.examples && def.examples.length > 0) {
          lines.push(`  e.g. ${def.examples.slice(0, 2).join('; ')}`);
        }
      }
      lines.push('');
    }
    return lines.join('\n').trimEnd();
  }

  /**
   * Produce a new RankingConfig.predicateWeights map merging the registry's
   * weights with the caller-supplied `base`. **`base` wins on collision** so
   * user configuration always trumps the registry default. Returns a NEW
   * object; never mutates inputs.
   */
  toRankingWeights(base?: Record<string, number>): Record<string, number> {
    const merged: Record<string, number> = {};
    for (const def of this.byName.values()) {
      if (typeof def.rankingWeight === 'number') {
        merged[def.name] = def.rankingWeight;
      }
    }
    if (base) {
      for (const [k, v] of Object.entries(base)) merged[k] = v;
    }
    return merged;
  }
}

// ---------------------------------------------------------------------------
// Canonicalization helper
// ---------------------------------------------------------------------------

/**
 * String → snake_case normalizer.
 *   - Lowercases
 *   - Converts - and whitespace runs to _
 *   - Inserts _ between lowercase→uppercase boundaries (camelCase split)
 *   - Collapses repeated _
 *   - Strips leading/trailing _
 */
function normalize(input: string): string {
  if (!input) return '';
  const withCamelSplit = input.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
  const lowered = withCamelSplit.toLowerCase();
  const replaced = lowered.replace(/[\s-]+/g, '_');
  const collapsed = replaced.replace(/_+/g, '_');
  return collapsed.replace(/^_+|_+$/g, '');
}
