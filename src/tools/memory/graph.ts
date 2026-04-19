/**
 * memory_graph — N-hop traversal from a starting entity. Backend picks the
 * best implementation: Mongo uses native `$graphLookup` when enabled;
 * in-memory + other adapters fall back to iterative BFS via
 * `genericTraverse`. Plugin just calls `memory.traverse()`.
 */

import type { ToolFunction } from '../../domain/entities/Tool.js';
import type { TraversalOptions } from '../../memory/index.js';
import type { MemoryToolDeps, SubjectRef } from './types.js';
import { clamp, resolveScope, toErrorMessage } from './types.js';

export interface GraphArgs {
  /** Starting entity. See SubjectRef forms. */
  start: SubjectRef;
  /** 'out' = outgoing edges (subject→object), 'in' = incoming, 'both' = bidirectional. Default 'both'. */
  direction?: 'out' | 'in' | 'both';
  /** Hard hop limit. Keep small (1–3) to stay responsive. Default 2, max 5. */
  maxDepth?: number;
  /** Filter edges to these predicate names. Omit to include all. */
  predicates?: string[];
  /** Max total edges returned. Default 100, max 500. */
  limit?: number;
  /** Point-in-time traversal — only facts valid at this timestamp. */
  asOf?: string;
}

const DESCRIPTION = `Walk the knowledge graph from a starting entity and return the connected subgraph as {nodes, edges}. This is the primary tool for answering RELATIONSHIP questions — "who works with X", "who attended what", "what is connected to what", "show me the network around Y". Use it whenever \`memory_recall\` alone isn't enough because the answer lives in the shape of edges between entities, not in the attributes of one.

## How the graph is modelled

Every fact is a directed edge: \`subject —predicate→ object\` (e.g. \`Anton —works_at→ Everworker\`). This tool walks those edges starting from \`start\` (any SubjectRef: "me", "this_agent", entity id, {identifier}, {surface}).

Direction controls which edges you follow from each node:
- \`"out"\` — only subject-to-object edges (OUTBOUND). Anton's out-edges are the things HE relates TO.
- \`"in"\` — only object-to-subject edges (INBOUND). Anton's in-edges are the things that POINT TO him.
- \`"both"\` — BOTH at every hop. This is the one to use for "who shares a relation with X" — see the co-subject pattern below.

## Query patterns — pick the right shape for the question

**A note on \`start\`:** In the examples below, \`{"surface":"Alice"}\` means "fuzzy-resolve the name Alice". A bare string like \`"ent_abc123"\` is interpreted as a raw entity ID (not a name) — only \`"me"\` and \`"this_agent"\` are special string tokens. If you don't have an entity ID, always use the \`{"surface":"..."}\` form for name-based lookups.

### Pattern A — "What does X relate to via predicate P?" (one hop, outbound)
Use when the question asks for the OBJECT of a relation. The subject is the start, the object(s) are in the result.
- "Where does Anton work?" → \`{"start":{"surface":"Anton"},"direction":"out","maxDepth":1,"predicates":["works_at"]}\`. Result nodes: Everworker.
- "What meetings did Alice attend?" → \`{"start":{"surface":"Alice"},"direction":"out","maxDepth":1,"predicates":["attended"]}\`.
- "Who does Alice report to?" → \`{"start":{"surface":"Alice"},"direction":"out","maxDepth":1,"predicates":["reports_to"]}\`.

### Pattern B — "Who/what relates to X via predicate P?" (one hop, inbound)
The inverse of pattern A. X is the OBJECT of the relation, the subjects are in the result.
- "Who attended Q3 planning?" → \`{"start":{"surface":"Q3 planning"},"direction":"in","maxDepth":1,"predicates":["attended"]}\`.
- "Who works at Everworker?" → \`{"start":{"surface":"Everworker"},"direction":"in","maxDepth":1,"predicates":["works_at"]}\`.
- "Who reports to Alice?" → \`{"start":{"surface":"Alice"},"direction":"in","maxDepth":1,"predicates":["reports_to"]}\`.

### Pattern C — CO-SUBJECT: "Who shares a P-relation with X?" (two hops, both)
**This is the most important pattern and requires \`direction:"both"\` with \`maxDepth:2\`.** It walks OUT from X to reach the shared object, then IN to discover everyone else who relates to that same object. Returned nodes at \`depth:2\` are your answer (filter out X itself).
- "Who works with Anton?" → \`{"start":{"surface":"Anton"},"direction":"both","maxDepth":2,"predicates":["works_at"]}\`. The walk goes Anton —works_at→ Everworker —←works_at— {John, Maria, …}. Your answer: nodes at depth 2 minus Anton.
- "Who attended the same meetings as Alice?" → \`{"start":{"surface":"Alice"},"direction":"both","maxDepth":2,"predicates":["attended"]}\`. Co-attendees show up at depth 2.
- "Who reports to the same manager as Alice?" → \`{"start":{"surface":"Alice"},"direction":"both","maxDepth":2,"predicates":["reports_to"]}\`. Siblings-in-hierarchy.
- "What other projects are tagged with the same topic as project-X?" → \`{"start":{"surface":"project-X"},"direction":"both","maxDepth":2,"predicates":["tagged_topic"]}\`.

### Pattern D — TRANSITIVE CHAIN: "Follow P repeatedly from X"
Multi-hop along a single-direction chain. Use \`direction:"out"\` (or "in") with larger \`maxDepth\`.
- "Full management chain above Alice" → \`{"start":{"surface":"Alice"},"direction":"out","maxDepth":6,"predicates":["reports_to"]}\`. Walks Alice → Bob → Carol → CEO.
- "Everyone below Alice in the hierarchy" → \`{"start":{"surface":"Alice"},"direction":"in","maxDepth":6,"predicates":["reports_to"]}\`.
- "Ancestor projects this task rolls up to" → \`{"start":{"surface":"task-123"},"direction":"out","maxDepth":5,"predicates":["part_of"]}\`.

### Pattern E — NEIGHBORHOOD: "Everything connected to X, any predicate, up to N hops"
Omit \`predicates\` to include ALL edges. Use sparingly — this can be large.
- "Show the full network around deal-42 within 3 hops" → \`{"start":{"surface":"deal-42"},"direction":"both","maxDepth":3,"limit":200}\`.
- "Everyone/everything directly linked to me" → \`{"start":"me","direction":"both","maxDepth":1}\`.

### Pattern F — FILTERED MULTI-PREDICATE: "Show me the work graph"
Combine several predicates with \`predicates: [...]\`.
- "Professional network around Alice" → \`{"start":{"surface":"Alice"},"direction":"both","maxDepth":2,"predicates":["works_at","reports_to","collaborated_with"]}\`.

### Pattern G — POINT-IN-TIME: "What was the graph as of date X?"
Use \`asOf\` to filter to facts valid at that instant. Facts created after, or with a \`validUntil\` before that date, are excluded.
- "Who worked at Everworker on 2024-06-01?" → \`{"start":{"surface":"Everworker"},"direction":"in","predicates":["works_at"],"asOf":"2024-06-01T00:00:00Z","maxDepth":1}\`.

## How to read the result

\`\`\`
{
  "start": {"id": "...", "displayName": "Anton"},
  "nodes": [
    {"id": "...", "displayName": "Anton", "depth": 0},       // the start entity
    {"id": "...", "displayName": "Everworker", "depth": 1},   // reached in 1 hop
    {"id": "...", "displayName": "John", "depth": 2},         // reached in 2 hops (co-subject!)
    ...
  ],
  "edges": [
    {"from": "<Anton>", "to": "<Everworker>", "predicate": "works_at", "depth": 1},
    {"from": "<John>",  "to": "<Everworker>", "predicate": "works_at", "depth": 2},
    ...
  ]
}
\`\`\`

- \`depth\` on nodes = minimum hop count from \`start\`. 0 = start, 1 = direct neighbors, 2 = their neighbors, etc.
- To answer "who works with Anton": take nodes at depth=2 and exclude Anton himself.
- To see the EDGES that lead to a node: filter \`edges\` where \`to\` (outbound chain) or \`from\` (inbound chain) matches that node's id.
- Each edge carries its \`predicate\` — you can recover the SEMANTIC path from start to any node by chaining edges.

## Defaults + limits

- \`direction\`: \`"both"\` (widest net; narrow to "out"/"in" when you know).
- \`maxDepth\`: 2 (enough for co-subject queries), capped at 5.
- \`limit\`: 100 total edges, capped at 500. Applies to edges; nodes are resolved for every endpoint of the surviving edges, so node count is naturally bounded at \`2 * limit + 1\`.
- \`predicates\`: unset = all predicates (noisy; prefer naming them).
- \`asOf\`: strict ISO-8601 — malformed values return an error.

## Backend dispatch (for the curious)

\`direction:"out"\` and \`direction:"in"\` on a Mongo-backed store with \`useNativeGraphLookup:true\` run as a single \`$graphLookup\` aggregation — fast. \`direction:"both"\` ALWAYS uses iterative BFS because per-hop direction-flipping (the co-subject pattern) isn't expressible in one \`$graphLookup\` pipeline. You don't need to think about this; results are equivalent either way.

## When NOT to use this tool

- Looking up an entity's PROFILE (attributes, top facts) → \`memory_recall\`.
- Finding facts by free-text query without knowing the entity → \`memory_search\` (semantic).
- Listing ALL facts about a subject → \`memory_list_facts\`.`;

export function createGraphTool(deps: MemoryToolDeps): ToolFunction<GraphArgs> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'memory_graph',
        description: DESCRIPTION,
        parameters: {
          type: 'object',
          properties: {
            start: { description: 'Starting entity — see SubjectRef forms.' },
            direction: { type: 'string', enum: ['out', 'in', 'both'] },
            maxDepth: { type: 'number' },
            predicates: { type: 'array', items: { type: 'string' } },
            limit: { type: 'number' },
            asOf: { type: 'string' },
          },
          required: ['start'],
        },
      },
    },

    describeCall: (args) =>
      `graph from ${typeof args.start === 'string' ? args.start : JSON.stringify(args.start)}`,

    execute: async (args, context) => {
      if (!args.start) return { error: 'start is required' };
      const scope = resolveScope(context?.userId, deps.defaultUserId, deps.defaultGroupId);
      const resolved = await deps.resolve(args.start, scope);
      if (!resolved.ok) {
        return { error: resolved.message, candidates: resolved.candidates };
      }

      const opts: TraversalOptions = {
        direction: args.direction ?? 'both',
        maxDepth: clamp(args.maxDepth, 2, 5),
        limit: clamp(args.limit, 100, 500),
      };
      if (args.predicates?.length) opts.predicates = args.predicates;
      if (args.asOf !== undefined) {
        const d = new Date(args.asOf);
        if (isNaN(d.valueOf())) {
          return { error: 'invalid asOf — expected ISO-8601 string' };
        }
        opts.asOf = d;
      }

      try {
        const neighborhood = await deps.memory.traverse(resolved.entity.id, opts, scope);
        return {
          start: { id: resolved.entity.id, displayName: resolved.entity.displayName },
          nodes: neighborhood.nodes.map((n) => ({
            id: n.entity.id,
            type: n.entity.type,
            displayName: n.entity.displayName,
            depth: n.depth,
          })),
          edges: neighborhood.edges.map((e) => ({
            from: e.from,
            to: e.to,
            predicate: e.fact.predicate,
            factId: e.fact.id,
            depth: e.depth,
          })),
        };
      } catch (err) {
        return { error: `memory_graph failed: ${toErrorMessage(err)}` };
      }
    },
  };
}
