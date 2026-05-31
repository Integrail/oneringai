/**
 * memory_search_documents — search long-form documents (entities of
 * `type='document'`) by content. Semantic mode embeds the query and matches
 * against `contentEmbedding`; keyword mode does a case-insensitive scan over
 * `metadata.body` + `displayName`. Returns ranked `{doc, score, snippet}`
 * results. Use existing tools for the rest of the document lifecycle —
 * `memory_upsert_entity` to create/update, `memory_link` to attach, etc.
 * (See the "Documents" section in the read-plugin instructions.)
 */

import type { ToolFunction } from '../../domain/entities/Tool.js';
import type { EntityId } from '../../memory/index.js';
import type { MemoryToolDeps, SubjectRef } from './types.js';
import { clamp, resolveScope, toErrorMessage } from './types.js';

export interface SearchDocumentsArgs {
  /** Free-text query. Required. */
  query: string;
  /**
   * `'semantic'` (default) → embed the query, match against
   * `contentEmbedding`. Requires an embedder; returns empty results when
   * none is configured.
   * `'keyword'` → case-insensitive substring match over `metadata.body` and
   * `displayName`. Cheap and dependency-free; degrades >~10k docs/scope.
   */
  mode?: 'semantic' | 'keyword';
  /**
   * SubjectRef — narrow to documents attached to this parent entity via the
   * canonical `has_document` predicate. Same forms accepted as elsewhere
   * (`"me"`, `"this_agent"`, raw id, `{id}`, `{identifier}`, `{surface}`).
   */
  attachedTo?: SubjectRef;
  /** Narrow by `metadata.role` (e.g. `"brief"`). Single value or list. */
  role?: string | string[];
  /** Result cap. Default 10, max 50. */
  limit?: number;
}

const DESCRIPTION = `Search long-form documents (entities of type='document') by content. Returns ranked {doc, score, snippet, matchedVia} results.

Use this tool when you need to FIND documents by their content. Use \`memory_find_entity\` when you already know the doc's id or slug. Use \`memory_graph\` / \`memory_list_facts\` when you want to traverse \`has_document\` attachment links from a specific entity (this tool's \`attachedTo\` filter is a shorthand for that).

Modes:
- "semantic" (default): embeds the query, matches against contentEmbedding. Best for natural-language queries — "the brief about Q3 launch", "notes from yesterday's planning meeting".
- "keyword": case-insensitive substring match over body + title. Best for exact strings — error codes, IDs, verbatim quotes.

Examples:
- {"query":"Q3 planning brief"} → semantic match across all visible docs
- {"query":"send budget by friday","mode":"keyword"} → docs literally containing the phrase
- {"query":"sprint retrospective","attachedTo":{"surface":"NA Launch project"},"limit":5} → docs attached to a specific project
- {"query":"weekly status","role":"report"} → only docs tagged metadata.role='report'
- {"query":"design spec","role":["spec","plan"]} → docs in either role

Returns: \`{results: [{doc: {id, type, displayName, identifiers, metadata, ownerId, groupId, permissions}, score: 0..1, snippet: string, matchedVia: 'semantic'|'keyword'}]}\`.`;

export function createSearchDocumentsTool(
  deps: MemoryToolDeps,
): ToolFunction<SearchDocumentsArgs> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'memory_search_documents',
        description: DESCRIPTION,
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            mode: { type: 'string', enum: ['semantic', 'keyword'] },
            attachedTo: { description: 'SubjectRef — see description.' },
            role: {
              oneOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } },
              ],
            },
            limit: { type: 'number' },
          },
          required: ['query'],
        },
      },
    },

    describeCall: (args) => args.query?.slice(0, 60) ?? 'search documents',

    execute: async (args, context) => {
      if (!args.query || typeof args.query !== 'string' || args.query.trim().length === 0) {
        return { error: 'query is required and must be a non-empty string' };
      }
      const scope = resolveScope(
        context?.userId,
        deps.defaultUserId,
        deps.defaultGroupId,
        deps.defaultPrincipals,
      );

      let attachedToId: EntityId | undefined;
      if (args.attachedTo !== undefined) {
        const resolved = await deps.resolve(args.attachedTo, scope);
        if (!resolved.ok) {
          return { error: `attachedTo: ${resolved.message}`, candidates: resolved.candidates };
        }
        attachedToId = resolved.entity.id;
      }

      try {
        const hits = await deps.memory.searchDocuments(
          {
            query: args.query,
            mode: args.mode,
            attachedTo: attachedToId,
            role: args.role,
            limit: clamp(args.limit, 10, 50),
          },
          scope,
        );
        return {
          query: args.query,
          mode: args.mode ?? 'semantic',
          results: hits.map((h) => ({
            doc: {
              id: h.doc.id,
              type: h.doc.type,
              displayName: h.doc.displayName,
              identifiers: h.doc.identifiers,
              metadata: h.doc.metadata,
              ownerId: h.doc.ownerId,
              groupId: h.doc.groupId,
              permissions: h.doc.permissions,
            },
            score: h.score,
            snippet: h.snippet,
            matchedVia: h.matchedVia,
          })),
        };
      } catch (err) {
        return { error: `memory_search_documents failed: ${toErrorMessage(err)}` };
      }
    },
  };
}
