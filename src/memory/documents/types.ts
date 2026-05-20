/**
 * Document = an entity with `type='document'` carrying long-form content in
 * `metadata.body`. Pure convention over the IEntity/IFact model — documents
 * reuse identifiers (slug as `{kind:'canonical', value:'doc:<slug>'}`),
 * permissions, scope, the embedding queue (via `contentEmbedding`), and the
 * standard `has_document` predicate for attachment. No separate storage
 * collection, no schema fork.
 *
 * See `MemorySystem.{create,update,get,attach,detach,list,search}Document(s)`
 * for the wrapper API. The LLM-facing surface is one new tool —
 * `memory_search_documents` — plus the existing entity/fact tools used with
 * the conventions documented here.
 */

import type { EntityId, IEntity, Identifier } from '../types.js';

/**
 * Convention: entity `type` value identifying a document.
 */
export const DOCUMENT_TYPE = 'document';

/**
 * Convention: relational predicate binding any entity to a document. One
 * predicate for every attachment — the document's own `metadata.role`
 * distinguishes brief/plan/transcript/spec/notes/artifact/...
 */
export const HAS_DOCUMENT_PREDICATE = 'has_document';

/**
 * Convention: identifier kind used for slugs.
 */
export const DOCUMENT_SLUG_KIND = 'canonical';

/**
 * Convention: slug values are prefixed with `doc:` so document canonical
 * identifiers can't collide with other entity types that also use
 * `canonical` (events, tasks, etc.). See `documentSlugIdentifier`.
 */
export const DOCUMENT_SLUG_PREFIX = 'doc:';

/**
 * Default embedder input character limit. The library passes
 * `title + summary (or body.slice(0, limit))` to the embedder. Most modern
 * embedders accept ≥8K tokens; 32_000 chars ≈ 8K tokens for English. Long
 * docs should supply `metadata.summary` for better semantic search.
 */
export const DEFAULT_EMBED_SOURCE_CHAR_LIMIT = 32_000;

/**
 * Build an Identifier for a document slug — kind=`canonical`, value=`doc:<slug>`.
 * The slug must be a non-empty string; the caller is responsible for any
 * slugification (use `slugify()` from `../identifiers.ts` for the standard form).
 */
export function documentSlugIdentifier(slug: string): Identifier {
  const trimmed = slug.trim();
  if (trimmed.length === 0) {
    throw new Error('documentSlugIdentifier: slug must be a non-empty string');
  }
  return {
    kind: DOCUMENT_SLUG_KIND,
    value: `${DOCUMENT_SLUG_PREFIX}${trimmed}`,
    isPrimary: false,
  };
}

/**
 * A Document is just an IEntity with `type='document'` — same storage, same
 * API. The alias narrows the type so wrapper methods can return a precise
 * shape. There is no separate `Document` table.
 */
export type Document = IEntity & { type: typeof DOCUMENT_TYPE };

/**
 * Suggested document role vocabulary. Free-string — callers may use any
 * value in `metadata.role`. Listed here for documentation + autocomplete;
 * the memory layer does not enforce membership.
 */
export type SuggestedDocumentRole =
  | 'brief'
  | 'plan'
  | 'transcript'
  | 'spec'
  | 'notes'
  | 'artifact'
  | 'memo'
  | 'profile'
  | 'report'
  | (string & {});

/**
 * Suggested format values stored under `metadata.format`. Default is `'markdown'`.
 */
export type DocumentFormat = 'markdown' | 'plain' | 'json' | (string & {});

/**
 * Input to `MemorySystem.createDocument`.
 */
export interface CreateDocumentInput {
  /** Human-readable title — becomes `displayName`. Required. */
  title: string;
  /**
   * Slug (no `doc:` prefix — that's added automatically). Stored as
   * `{kind:'canonical', value:'doc:<slug>'}`. Optional — when omitted the
   * adapter assigns an id and resolution is by id only.
   */
  slug?: string;
  /** Long-form content. Required. */
  body: string;
  /** Free-string role marker; see `SuggestedDocumentRole`. */
  role?: SuggestedDocumentRole;
  /** Content format; default `'markdown'`. */
  format?: DocumentFormat;
  /** Optional short summary used as the embedding source when present. */
  summary?: string;
  /**
   * Additional metadata fields merged with the standard set. The standard
   * fields (`body`, `role`, `format`, `summary`, `byteSize`) win on collision.
   */
  metadata?: Record<string, unknown>;
  /** Parent entity id — when set, a `(parent, has_document, doc)` fact is created. */
  attachTo?: EntityId;
  /** Optional aliases — additional surface forms callers can search by. */
  aliases?: string[];
  /**
   * Owner override (admin path). Defaults to `scope.userId`; required at the
   * MemorySystem level because every entity must have an owner.
   */
  ownerId?: string;
  /** Group override; defaults to `scope.groupId`. */
  groupId?: string;
  /** Permission block override. */
  permissions?: IEntity['permissions'];
}

/**
 * Patch passed to `MemorySystem.updateDocument`. All fields optional — only
 * provided keys are touched (shallow `'overwrite'` semantics inside
 * `metadata`). Other metadata keys are preserved.
 */
export interface UpdateDocumentInput {
  title?: string;
  body?: string;
  role?: SuggestedDocumentRole;
  format?: DocumentFormat;
  summary?: string;
  /**
   * Extra metadata keys (shallow overwrite). Standard derived fields
   * (`byteSize`) are recomputed by MemorySystem regardless.
   */
  metadata?: Record<string, unknown>;
  /** Optional aliases — appended (no duplicates). */
  aliases?: string[];
}

/**
 * Filter shape for `listDocuments`.
 */
export interface ListDocumentsFilter {
  /** Narrow to docs attached to this parent entity (`has_document` fact). */
  attachedTo?: EntityId;
  /** Narrow by role (single value or any of). */
  role?: string | string[];
  /** Narrow by owner. */
  ownerId?: string;
  /**
   * When true, the returned documents include `metadata.body`. Default false —
   * listing typically renders titles/roles only, and bodies can be large.
   */
  includeBody?: boolean;
  /** Sort key(s). Default: `metadata.updatedAt desc` is not honored — uses adapter natural order unless overridden. */
  orderBy?: import('../types.js').EntityOrderBy | import('../types.js').EntityOrderBy[];
  /** Default 20, clamp 1..200. */
  limit?: number;
  /** Pagination cursor (adapter-defined). */
  cursor?: string;
}

/**
 * Search input for `searchDocuments`.
 */
export interface SearchDocumentsInput {
  /** Query string. Required. */
  query: string;
  /**
   * `'semantic'` (default) uses `contentEmbedding`; requires an embedder.
   * `'keyword'` runs a case-insensitive regex match over `metadata.body`
   * (in-memory page scan; scales to ~10K docs/scope).
   */
  mode?: 'semantic' | 'keyword';
  /** Narrow to docs attached to this parent (`has_document` fact). */
  attachedTo?: EntityId;
  /** Narrow by role. */
  role?: string | string[];
  /** Default 10, clamp 1..50. */
  limit?: number;
}

/**
 * One result from `searchDocuments`.
 */
export interface DocumentSearchHit {
  doc: Document;
  /** 0..1 cosine similarity for semantic; 1.0 for keyword exact match. */
  score: number;
  /** ~200 char preview. For keyword mode, centered on the first match. */
  snippet: string;
  matchedVia: 'semantic' | 'keyword';
}

/**
 * Result of `MemorySystem.detachDocument`. Reports how many matching
 * `has_document` facts were archived vs. skipped because the caller lacked
 * write access — lets callers distinguish "nothing to detach" from "had
 * matches but couldn't write any of them".
 */
export interface DetachDocumentResult {
  /** Count of `has_document` facts archived by this call. */
  archived: number;
  /** Count of matching, visible facts the caller could read but not write. */
  skippedDueToPermissions: number;
}
