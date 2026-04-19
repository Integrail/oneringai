/**
 * Default prompt template for canonical profile generation.
 *
 * **Incremental regeneration.** The prompt expresses profile regen as an
 * *evolution* of the prior profile, not a rewrite. The generator receives:
 *   - the prior profile (if any) — the authoritative starting text
 *   - only NEW atomic facts added since the prior profile
 *   - a list of fact IDs whose claims should be dropped (archived or superseded)
 *
 * The generator is instructed to return structured JSON so parsing is reliable.
 * Consumers can override this via `ConnectorProfileGeneratorConfig.promptTemplate`
 * — their replacement must still produce `{details, summaryForEmbedding}`.
 */

import type { IFact, ProfileGeneratorInput } from '../types.js';

/**
 * Context passed to a prompt template function. This is the same shape as
 * `ProfileGeneratorInput` — alias kept for backward compatibility of custom
 * prompt authors.
 */
export type PromptContext = ProfileGeneratorInput;

export function defaultProfilePrompt(ctx: PromptContext): string {
  const { entity, newFacts, priorProfile, invalidatedFactIds, targetScope } = ctx;

  const identifiers = entity.identifiers
    .map((i) => `${i.kind}=${i.value}`)
    .join(', ');

  const factLines = newFacts
    .slice(0, 100)
    .map((f) => renderFactLine(f))
    .join('\n');

  const priorSection = priorProfile?.details
    ? `\n## Previous Profile (authoritative starting point)\n${priorProfile.details}\n\n(This is what we already know. Evolve it — fold in the new observations below, preserve what hasn't changed, stay concise.)`
    : '\n(No prior profile — this is the first generation. Synthesize from the facts below.)';

  const invalidatedSection =
    invalidatedFactIds.length > 0
      ? `\n## Invalidated Claims (DROP from previous profile)\n` +
        `These fact IDs have been archived or superseded since the previous profile was written. ` +
        `Remove any claim in the previous profile that was based solely on them. ` +
        `If the new observations below replace an invalidated claim, use the new one instead.\n\n` +
        `Invalidated fact IDs: ${invalidatedFactIds.join(', ')}\n`
      : '';

  const scopeSection = describeScope(targetScope);

  return `You are synthesizing a canonical memory profile for an entity by **incrementally updating** it with new observations.

## Entity
- Type: ${entity.type}
- Display name: ${entity.displayName}
- Aliases: ${entity.aliases?.join(', ') || '(none)'}
- Identifiers: ${identifiers || '(none)'}
- Visibility scope: ${scopeSection}
${priorSection}
${invalidatedSection}
## New Observations (facts added since previous profile, most recent first)
${factLines || '(No new facts — regenerate because invalidated claims need removing, or to refresh phrasing.)'}

## Task
Produce an **updated markdown profile** (target 300–600 words) that:
- Uses the **Previous Profile** as the authoritative starting text.
- Folds in the **New Observations** — add, refine, or correct claims.
- **Removes** any claim that was backed by a fact in **Invalidated Claims**.
- Keeps sections the new observations don't touch.
- Stays factual. Do NOT invent details. If information is thin, say so briefly.

Also produce a **single-paragraph summary** (~80 words) capturing the essence — this becomes the embedding input for vector search.

## Output Format
Return valid JSON with exactly these two fields:

{
  "details": "<updated markdown profile here>",
  "summaryForEmbedding": "<one-paragraph gist here>"
}

Output ONLY the JSON object. No surrounding prose, no code fences.`;
}

function renderFactLine(f: IFact): string {
  const scope =
    f.groupId || f.ownerId ? ` [${[f.groupId, f.ownerId].filter(Boolean).join('/')}]` : '';
  const conf = typeof f.confidence === 'number' ? ` (conf=${f.confidence.toFixed(2)})` : '';
  const when = f.observedAt ? ` @${f.observedAt.toISOString().slice(0, 10)}` : '';
  const payload =
    f.details && f.details.length > 0
      ? truncate(f.details, 160)
      : f.objectId
        ? `→ ${f.objectId}`
        : f.value !== undefined
          ? `= ${JSON.stringify(f.value).slice(0, 80)}`
          : '';
  const supersedes = f.supersedes ? ` supersedes=${f.supersedes}` : '';
  return `- [${f.id}] ${f.predicate}: ${payload}${scope}${conf}${when}${supersedes}`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function describeScope(scope: { groupId?: string; ownerId?: string }): string {
  if (!scope.groupId && !scope.ownerId) return 'global (visible to all)';
  if (scope.ownerId && !scope.groupId) return `user-private (owner=${scope.ownerId})`;
  if (scope.groupId && !scope.ownerId) return `group-wide (group=${scope.groupId})`;
  return `user-private within group (group=${scope.groupId}, owner=${scope.ownerId})`;
}
