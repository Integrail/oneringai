/**
 * Default prompt template for canonical profile generation.
 *
 * The generator is instructed to return structured JSON so parsing is reliable.
 * Consumers can override this via ConnectorProfileGeneratorConfig.promptTemplate
 * — their replacement must still produce `{details, summaryForEmbedding}`.
 */

import type { IEntity, IFact, ScopeFields } from '../types.js';

export interface PromptContext {
  entity: IEntity;
  atomicFacts: IFact[];
  priorProfile?: IFact;
  targetScope: ScopeFields;
}

export function defaultProfilePrompt(ctx: PromptContext): string {
  const { entity, atomicFacts, priorProfile, targetScope } = ctx;

  const identifiers = entity.identifiers
    .map((i) => `${i.kind}=${i.value}`)
    .join(', ');

  const factLines = atomicFacts
    .slice(0, 100)
    .map((f) => renderFactLine(f))
    .join('\n');

  const priorSection = priorProfile?.details
    ? `\n## Previous Profile\n${priorProfile.details}\n\n(Evolve this — update what changed, preserve what hasn't, stay concise.)`
    : '\n(No prior profile — this is the first generation.)';

  const scopeSection = describeScope(targetScope);

  return `You are synthesizing a canonical memory profile for an entity based on accumulated facts.

## Entity
- Type: ${entity.type}
- Display name: ${entity.displayName}
- Aliases: ${entity.aliases?.join(', ') || '(none)'}
- Identifiers: ${identifiers || '(none)'}
- Visibility scope: ${scopeSection}

## Known Facts (most recent first)
${factLines || '(No structured facts yet.)'}
${priorSection}

## Task
Write a concise **markdown profile** (target 300–600 words) that synthesizes what we know about this entity. Focus on:
- Who/what they are (identity, role, primary affiliations)
- Key relationships and associations
- Recent significant activity or patterns
- Anything non-obvious that matters for understanding them

Do NOT invent facts. Only synthesize from what is provided. If information is thin, acknowledge it briefly.

Also produce a **single-paragraph summary** (~80 words) capturing the essence — this becomes the embedding input for vector search.

## Output Format
Return valid JSON with exactly these two fields:

{
  "details": "<markdown profile here>",
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
  return `- ${f.predicate}: ${payload}${scope}${conf}${when}`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function describeScope(scope: ScopeFields): string {
  if (!scope.groupId && !scope.ownerId) return 'global (visible to all)';
  if (scope.ownerId && !scope.groupId) return `user-private (owner=${scope.ownerId})`;
  if (scope.groupId && !scope.ownerId) return `group-wide (group=${scope.groupId})`;
  return `user-private within group (group=${scope.groupId}, owner=${scope.ownerId})`;
}
