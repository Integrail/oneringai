/**
 * memory_search — semantic text search across visible facts. Uses
 * `memory.semanticSearch` which requires an embedder to be configured;
 * otherwise returns a clear error.
 */

import type { ToolFunction } from '../../domain/entities/Tool.js';
import type { FactFilter } from '../../memory/index.js';
import type { MemoryToolDeps, SubjectRef } from './types.js';
import { clamp, resolveScope, toErrorMessage } from './types.js';

export interface SearchArgs {
  /** Natural-language query. Embedded and matched against fact embeddings. */
  query: string;
  /** Number of results. Default 10, max 100. */
  topK?: number;
  /** Optional fact filter — predicate, subject, observedAfter, etc. */
  filter?: {
    /** SubjectRef — accepts "me", "this_agent", entity id, {identifier}, {surface}. Preferred over subjectId. */
    subject?: SubjectRef;
    /** SubjectRef — same as subject but constrains the object side of relational facts. */
    object?: SubjectRef;
    /** Escape hatch when you already have the raw entity id — otherwise prefer `subject`. */
    subjectId?: string;
    /** Escape hatch when you already have the raw entity id — otherwise prefer `object`. */
    objectId?: string;
    predicate?: string;
    predicates?: string[];
    minConfidence?: number;
    /** ISO-8601 string. Invalid values return a structured error. */
    observedAfter?: string;
    observedBefore?: string;
  };
}

const DESCRIPTION = `Semantic text search across facts visible to you. Best when the user asks "find anything about X" and you don't know the entity or predicate upfront. Requires an embedder; will report "not available" otherwise.

filter.subject / filter.object accept any SubjectRef form (SubjectRef: "me", "this_agent", entity id, {id}, {identifier:{kind,value}}, {surface:"..."}) — you don't have to resolve the entity first. Use subjectId/objectId only when you already have the raw id.

Examples:
- {"query":"deployment incidents last quarter","topK":10}
- {"query":"Alice's preferences","filter":{"subject":{"surface":"Alice"}}}
- {"query":"my preferences","filter":{"subject":"me"}}
- {"query":"budget approvals","filter":{"predicate":"approved","observedAfter":"2025-01-01"}}

Returns ranked {fact, score} pairs; score is cosine similarity (0..1).`;

export function createSearchTool(deps: MemoryToolDeps): ToolFunction<SearchArgs> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'memory_search',
        description: DESCRIPTION,
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            topK: { type: 'number' },
            filter: { type: 'object' },
          },
          required: ['query'],
        },
      },
    },

    describeCall: (args) => args.query?.slice(0, 60) ?? 'search',

    execute: async (args, context) => {
      if (!args.query || typeof args.query !== 'string' || args.query.trim().length === 0) {
        return { error: 'query is required and must be a non-empty string' };
      }
      const scope = resolveScope(context?.userId, deps.defaultUserId, deps.defaultGroupId);

      const filter: FactFilter = {};
      if (args.filter) {
        // SubjectRef preferred over raw id; subjectId stays as an escape hatch.
        if (args.filter.subject) {
          const res = await deps.resolve(args.filter.subject, scope);
          if (!res.ok) {
            return { error: `filter.subject: ${res.message}`, candidates: res.candidates };
          }
          filter.subjectId = res.entity.id;
        } else if (args.filter.subjectId) {
          filter.subjectId = args.filter.subjectId;
        }
        if (args.filter.object) {
          const res = await deps.resolve(args.filter.object, scope);
          if (!res.ok) {
            return { error: `filter.object: ${res.message}`, candidates: res.candidates };
          }
          filter.objectId = res.entity.id;
        } else if (args.filter.objectId) {
          filter.objectId = args.filter.objectId;
        }
        if (args.filter.predicate) filter.predicate = args.filter.predicate;
        if (args.filter.predicates?.length) filter.predicates = args.filter.predicates;
        if (typeof args.filter.minConfidence === 'number') {
          filter.minConfidence = args.filter.minConfidence;
        }
        if (args.filter.observedAfter !== undefined) {
          const d = new Date(args.filter.observedAfter);
          if (isNaN(d.valueOf())) {
            return { error: 'invalid observedAfter — expected ISO-8601 string' };
          }
          filter.observedAfter = d;
        }
        if (args.filter.observedBefore !== undefined) {
          const d = new Date(args.filter.observedBefore);
          if (isNaN(d.valueOf())) {
            return { error: 'invalid observedBefore — expected ISO-8601 string' };
          }
          filter.observedBefore = d;
        }
      }

      try {
        const results = await deps.memory.semanticSearch(
          args.query,
          filter,
          scope,
          clamp(args.topK, 10, 100),
        );
        return {
          query: args.query,
          results: results.map((r) => ({
            score: r.score,
            fact: {
              id: r.fact.id,
              subjectId: r.fact.subjectId,
              predicate: r.fact.predicate,
              kind: r.fact.kind,
              objectId: r.fact.objectId,
              value: r.fact.value,
              details: r.fact.details,
              confidence: r.fact.confidence,
              observedAt: r.fact.observedAt,
            },
          })),
        };
      } catch (err) {
        return { error: `memory_search unavailable: ${toErrorMessage(err)}` };
      }
    },
  };
}
