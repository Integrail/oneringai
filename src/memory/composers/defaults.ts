/**
 * Default content-embedding composers shipped with the library.
 *
 * One composer per well-known entity type (per the conventions documented in
 * `src/memory/types.ts` header). Each composer produces a deterministic
 * multi-line string with:
 *
 *  - Type prefix + displayName (always)
 *  - Aliases (full list — no cap; embedders enforce their own token limits)
 *  - Type-specific metadata (state/dueAt/assignee/... for tasks etc.)
 *  - Referenced entity displayNames (resolved via ComposeContext, no cap)
 *  - Free-form narrative (`description` / `bio` / `notes` / `summary` if present)
 *  - Identifiers (full list, primary first)
 *
 * Field order is stable. Missing fields are omitted (no blank lines).
 *
 * The fact composer turns short atomic triples into semantically-rich text by
 * resolving subject/object ids to displayNames — converting opaque ids into
 * meaningful surface forms that semantic search can actually match against.
 */

import type { Identifier } from '../types.js';
import { DEFAULT_EMBED_SOURCE_CHAR_LIMIT } from '../documents/index.js';
import type { ComposeContext, EntityContentComposer, FactContentComposer } from './types.js';

/**
 * Metadata keys checked for free-form narrative content (first hit wins).
 *
 * **Why no truncation caps:** content embeddings deliberately include the full
 * alias / identifier / attendee / contextId surface area. Embedding models
 * enforce their own token limits (~8K tokens for OpenAI text-embedding-3-*),
 * and pre-capping in the composer silently destroys semantically meaningful
 * information for the common case (large orgs with many trade names; events
 * with 30+ attendees). The legacy `buildIdentityString` keeps narrow caps
 * because identity embedding is *intentionally* a name-only surface; content
 * embedding has no such constraint.
 */
const NARRATIVE_KEYS = ['description', 'bio', 'notes', 'summary', 'about'] as const;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function formatIdentifiers(identifiers: Identifier[]): string {
  if (!identifiers || identifiers.length === 0) return '';
  // Primary first, then by addition order. No cap — content embedding wants
  // the full identifier surface so semantic search can match against every
  // known surface form (an org's domain + ticker + legal_name all matter).
  const primary = identifiers.filter((i) => i.isPrimary);
  const other = identifiers.filter((i) => !i.isPrimary);
  return [...primary, ...other].map((i) => `${i.kind}:${i.value}`).join(', ');
}

function formatAliases(aliases: string[] | undefined): string {
  if (!aliases || aliases.length === 0) return '';
  // No cap — embedders enforce their own token limits, and dropping aliases
  // silently destroys semantically meaningful surface forms (an org with 8
  // trade names is normal, not pathological).
  return aliases.join(', ');
}

function formatDate(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v; // Already ISO-ish — trust caller-supplied format.
  if (typeof v === 'number') return new Date(v).toISOString();
  return null;
}

function pickNarrative(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null;
  for (const key of NARRATIVE_KEYS) {
    const v = metadata[key];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

function pickString(metadata: Record<string, unknown> | undefined, key: string): string | null {
  if (!metadata) return null;
  const v = metadata[key];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

/**
 * Resolve a metadata field that holds an entity id (e.g. `assigneeId`,
 * `projectId`) to its displayName. Returns `null` if the field is absent,
 * malformed, or refers to an invisible / missing entity.
 */
async function resolveIdField(
  metadata: Record<string, unknown> | undefined,
  key: string,
  ctx: ComposeContext,
): Promise<string | null> {
  if (!metadata) return null;
  const v = metadata[key];
  if (typeof v !== 'string' || v.trim().length === 0) return null;
  return await ctx.resolveDisplayName(v);
}

/**
 * Resolve a metadata field that holds an entity-id array (e.g.
 * `attendeeIds`, `stakeholderIds`) to a comma-joined list of displayNames.
 * Missing entries silently dropped. Empty result → empty string.
 */
async function resolveIdArrayField(
  metadata: Record<string, unknown> | undefined,
  key: string,
  ctx: ComposeContext,
): Promise<string> {
  if (!metadata) return '';
  const v = metadata[key];
  if (!Array.isArray(v)) return '';
  const ids = v.filter((x): x is string => typeof x === 'string' && x.length > 0);
  if (ids.length === 0) return '';
  const names = await ctx.resolveDisplayNames(ids);
  const present = names.filter((n): n is string => !!n);
  // No cap — see the no-truncation rationale near NARRATIVE_KEYS.
  return present.join(', ');
}

/**
 * Build the lines array into the final string. Drops empty/null lines so the
 * output has no blank rows.
 */
function joinLines(lines: Array<string | null | undefined>): string {
  const kept: string[] = [];
  for (const l of lines) {
    if (typeof l !== 'string') continue;
    const trimmed = l.trim();
    if (trimmed.length === 0) continue;
    kept.push(trimmed);
  }
  return kept.join('\n');
}

// ---------------------------------------------------------------------------
// Per-type entity composers
// ---------------------------------------------------------------------------

/**
 * Composer for `task` entities. Embeds the full operational surface — state,
 * due date, priority, assignee/reporter/project displayNames, contextIds,
 * narrative description — so semantic queries like "urgent backend work due
 * this week assigned to Bob" match the right task even when 50 tasks share
 * the same generic title (e.g. "Follow up").
 */
export const taskContentComposer: EntityContentComposer = {
  async compose(entity, ctx) {
    const md = entity.metadata as Record<string, unknown> | undefined;

    const aliases = formatAliases(entity.aliases);
    const state = pickString(md, 'state');
    const priority = pickString(md, 'priority');
    const dueAt = formatDate(md?.dueAt);
    const completedAt = formatDate(md?.completedAt);

    const [assignee, reporter, project, contextNames] = await Promise.all([
      resolveIdField(md, 'assigneeId', ctx),
      resolveIdField(md, 'reporterId', ctx),
      resolveIdField(md, 'projectId', ctx),
      entity.contextIds && entity.contextIds.length > 0
        ? ctx.resolveDisplayNames(entity.contextIds).then((names) =>
            names.filter((n): n is string => !!n).join(', '),
          )
        : Promise.resolve(''),
    ]);

    const narrative = pickNarrative(md);
    const idents = formatIdentifiers(entity.identifiers);

    return joinLines([
      `task: ${entity.displayName}`,
      aliases ? `Aliases: ${aliases}` : null,
      state ? `State: ${state}` : null,
      dueAt ? `Due: ${dueAt}` : null,
      completedAt ? `Completed: ${completedAt}` : null,
      priority ? `Priority: ${priority}` : null,
      assignee ? `Assignee: ${assignee}` : null,
      reporter ? `Reporter: ${reporter}` : null,
      project ? `Project: ${project}` : null,
      contextNames ? `Context: ${contextNames}` : null,
      narrative ? `Description: ${narrative}` : null,
      idents ? `ID: ${idents}` : null,
    ]);
  },
};

/**
 * Composer for `event` entities (calendar events, meetings). Embeds time
 * window, location, kind, attendee displayNames, and contextIds so a query
 * like "weekly Q3 planning sync with Alice and Bob next Tuesday" matches the
 * right calendar event.
 */
export const eventContentComposer: EntityContentComposer = {
  async compose(entity, ctx) {
    const md = entity.metadata as Record<string, unknown> | undefined;

    const aliases = formatAliases(entity.aliases);
    const startTime = formatDate(md?.startTime);
    const endTime = formatDate(md?.endTime);
    const location = pickString(md, 'location');
    const kind = pickString(md, 'kind');

    const [attendees, contextNames] = await Promise.all([
      resolveIdArrayField(md, 'attendeeIds', ctx),
      entity.contextIds && entity.contextIds.length > 0
        ? ctx.resolveDisplayNames(entity.contextIds).then((names) =>
            names.filter((n): n is string => !!n).join(', '),
          )
        : Promise.resolve(''),
    ]);

    let whenLine: string | null = null;
    if (startTime && endTime) whenLine = `When: ${startTime} → ${endTime}`;
    else if (startTime) whenLine = `When: ${startTime}`;
    else if (endTime) whenLine = `When: → ${endTime}`;

    const narrative = pickNarrative(md);
    const idents = formatIdentifiers(entity.identifiers);

    return joinLines([
      `event: ${entity.displayName}`,
      aliases ? `Aliases: ${aliases}` : null,
      whenLine,
      location ? `Where: ${location}` : null,
      kind ? `Kind: ${kind}` : null,
      attendees ? `Attendees: ${attendees}` : null,
      contextNames ? `Context: ${contextNames}` : null,
      narrative ? `Description: ${narrative}` : null,
      idents ? `ID: ${idents}` : null,
    ]);
  },
};

/**
 * Composer for `person` entities. Embeds name + aliases + role/title + org
 * (if `metadata.organizationId` resolves) + bio + identifiers (email,
 * slack_id, github, ...) so a query like "the senior engineer at Acme who
 * works on payments" can match. Note: relationships to other entities
 * expressed as facts (e.g. `(Sarah, works_at, Acme)`) are NOT auto-included
 * here — fact embeddings cover that. Composer only sees the entity itself.
 */
export const personContentComposer: EntityContentComposer = {
  async compose(entity, ctx) {
    const md = entity.metadata as Record<string, unknown> | undefined;

    const aliases = formatAliases(entity.aliases);
    const role = pickString(md, 'role');
    const title = pickString(md, 'title');
    const org = await resolveIdField(md, 'organizationId', ctx);

    const narrative = pickNarrative(md);
    const idents = formatIdentifiers(entity.identifiers);

    return joinLines([
      `person: ${entity.displayName}`,
      aliases ? `Aliases: ${aliases}` : null,
      role ? `Role: ${role}` : null,
      title ? `Title: ${title}` : null,
      org ? `Organization: ${org}` : null,
      narrative ? `Bio: ${narrative}` : null,
      idents ? `ID: ${idents}` : null,
    ]);
  },
};

/**
 * Composer for `organization` entities. Embeds name, aliases, domain
 * (extracted from identifiers), industry, description, and identifiers.
 */
export const organizationContentComposer: EntityContentComposer = {
  async compose(entity) {
    const md = entity.metadata as Record<string, unknown> | undefined;

    const aliases = formatAliases(entity.aliases);
    const industry = pickString(md, 'industry');

    // Pull domain straight from identifiers — it's the most semantically rich
    // single-line surface for org matching.
    const domainIdent = entity.identifiers.find((i) => i.kind === 'domain');
    const domain = domainIdent?.value;

    const narrative = pickNarrative(md);
    const idents = formatIdentifiers(entity.identifiers);

    return joinLines([
      `organization: ${entity.displayName}`,
      aliases ? `Aliases: ${aliases}` : null,
      domain ? `Domain: ${domain}` : null,
      industry ? `Industry: ${industry}` : null,
      narrative ? `Description: ${narrative}` : null,
      idents ? `ID: ${idents}` : null,
    ]);
  },
};

/**
 * Composer for `topic` entities — free-form topical anchors. Embeds name,
 * aliases, narrative, and parent contextIds.
 */
export const topicContentComposer: EntityContentComposer = {
  async compose(entity, ctx) {
    const md = entity.metadata as Record<string, unknown> | undefined;

    const aliases = formatAliases(entity.aliases);
    const narrative = pickNarrative(md);

    const contextNames =
      entity.contextIds && entity.contextIds.length > 0
        ? await ctx.resolveDisplayNames(entity.contextIds).then((names) =>
            names.filter((n): n is string => !!n).join(', '),
          )
        : '';

    return joinLines([
      `topic: ${entity.displayName}`,
      aliases ? `Aliases: ${aliases}` : null,
      contextNames ? `Context: ${contextNames}` : null,
      narrative ? `Description: ${narrative}` : null,
    ]);
  },
};

/**
 * Composer for `project` entities. Embeds name, aliases, status, description,
 * and stakeholder displayNames.
 */
export const projectContentComposer: EntityContentComposer = {
  async compose(entity, ctx) {
    const md = entity.metadata as Record<string, unknown> | undefined;

    const aliases = formatAliases(entity.aliases);
    const status = pickString(md, 'status');
    const stakeholders = await resolveIdArrayField(md, 'stakeholderIds', ctx);

    const narrative = pickNarrative(md);
    const idents = formatIdentifiers(entity.identifiers);

    return joinLines([
      `project: ${entity.displayName}`,
      aliases ? `Aliases: ${aliases}` : null,
      status ? `Status: ${status}` : null,
      stakeholders ? `Stakeholders: ${stakeholders}` : null,
      narrative ? `Description: ${narrative}` : null,
      idents ? `ID: ${idents}` : null,
    ]);
  },
};

/**
 * Composer for `document` entities. Preserves the legacy document embedding
 * shape: `title\n\n(summary OR body[:limit])`. Body is truncated at
 * `DEFAULT_EMBED_SOURCE_CHAR_LIMIT` to fit the embedder's context window —
 * this is a necessary trade-off (embedder input has a fixed token limit) and
 * NOT a lossy transformation of stored data. Pass a `metadata.summary` for
 * long documents to get a richer embedding.
 */
export const documentContentComposer: EntityContentComposer = {
  async compose(entity) {
    const md = entity.metadata as Record<string, unknown> | undefined;
    const body = typeof md?.body === 'string' ? md.body : '';
    const summary = typeof md?.summary === 'string' ? md.summary : '';
    const source = summary.length > 0 ? summary : body.slice(0, DEFAULT_EMBED_SOURCE_CHAR_LIMIT);
    if (source.length === 0 && entity.displayName.length === 0) return '';
    if (source.length === 0) return entity.displayName;
    return `${entity.displayName}\n\n${source}`;
  },
};

/**
 * Composer for `cluster` entities — type-specific anchor metadata. Embeds
 * name + aliases + anchor entity displayNames + first/last-seen timestamps.
 */
export const clusterContentComposer: EntityContentComposer = {
  async compose(entity, ctx) {
    const md = entity.metadata as Record<string, unknown> | undefined;

    const aliases = formatAliases(entity.aliases);
    const firstSeen = formatDate(md?.firstSeen);
    const lastSeen = formatDate(md?.lastSeen);
    const anchors = await resolveIdArrayField(md, 'anchorEntityIds', ctx);

    return joinLines([
      `cluster: ${entity.displayName}`,
      aliases ? `Aliases: ${aliases}` : null,
      anchors ? `Anchors: ${anchors}` : null,
      firstSeen ? `First seen: ${firstSeen}` : null,
      lastSeen ? `Last seen: ${lastSeen}` : null,
    ]);
  },
};

/**
 * Registry of default composers keyed by entity type. Hosts can override
 * specific types via `MemorySystemConfig.entityContentComposers`; unspecified
 * types fall back to these defaults. Entity types with no default composer
 * (e.g. custom host types) get no content embedding unless the host registers
 * one — this is intentional, not a bug. Free-form types can opt in by adding
 * an entry.
 */
export const DEFAULT_ENTITY_COMPOSERS: ReadonlyMap<string, EntityContentComposer> = new Map([
  ['task', taskContentComposer],
  ['event', eventContentComposer],
  ['person', personContentComposer],
  ['organization', organizationContentComposer],
  ['topic', topicContentComposer],
  ['project', projectContentComposer],
  ['document', documentContentComposer],
  ['cluster', clusterContentComposer],
]);

// ---------------------------------------------------------------------------
// Fact composer
// ---------------------------------------------------------------------------

/**
 * Default fact composer. Composes:
 *
 *  - **atomic** facts → `"<subject.displayName> <predicate> <object.displayName | value>"`
 *    plus details/summary lines when present. Replaces the legacy 80-char
 *    threshold gate — every atomic fact gets a meaningful surface form once
 *    subject/object are resolved.
 *  - **document** facts → details (or summaryForEmbedding) verbatim, matching
 *    the legacy embedding text for backwards compatibility with existing
 *    `semanticSearchFacts` consumers.
 *
 * Returns `''` only when:
 *  - The fact's subject can't be resolved AND no details exist (truly empty).
 *  - A document-kind fact has neither details nor summaryForEmbedding.
 */
export const defaultFactContentComposer: FactContentComposer = {
  async compose(fact, ctx) {
    if (fact.kind === 'document') {
      const text = fact.summaryForEmbedding ?? fact.details ?? '';
      return text.trim();
    }

    // Atomic fact: honor caller-supplied `summaryForEmbedding` as an explicit
    // override of the composed surface form. Lets hosts pre-populate richer
    // narrative text (e.g. "Sarah is a senior payments engineer at Acme")
    // for specific facts without surrendering the auto-compose path for
    // everything else. Mirrors the document-fact path above.
    if (fact.summaryForEmbedding && fact.summaryForEmbedding.trim().length > 0) {
      return fact.summaryForEmbedding.trim();
    }

    // Atomic fact: build "subject predicate object" surface form.
    const [subjectName, objectName] = await Promise.all([
      ctx.resolveDisplayName(fact.subjectId),
      fact.objectId ? ctx.resolveDisplayName(fact.objectId) : Promise.resolve(null),
    ]);

    // Subject is required by the fact contract — but defensively handle the
    // missing case (e.g. subject was archived/deleted post-write).
    const subject = subjectName ?? '[unknown subject]';
    const predicate = fact.predicate;

    let objectStr: string;
    if (objectName) {
      objectStr = objectName;
    } else if (fact.objectId) {
      // Object id present but invisible / missing — preserve the id so the
      // embedded text still mentions *something* about the object.
      objectStr = `[entity ${fact.objectId}]`;
    } else if (fact.value !== undefined && fact.value !== null) {
      objectStr = formatFactValue(fact.value);
    } else {
      objectStr = '';
    }

    const head = objectStr ? `${subject} ${predicate} ${objectStr}` : `${subject} ${predicate}`;

    const lines: string[] = [head];
    if (fact.details && fact.details.trim().length > 0) {
      lines.push(fact.details.trim());
    }
    if (
      fact.summaryForEmbedding &&
      fact.summaryForEmbedding.trim().length > 0 &&
      fact.summaryForEmbedding.trim() !== (fact.details ?? '').trim()
    ) {
      lines.push(fact.summaryForEmbedding.trim());
    }

    return lines.join('\n').trim();
  },
};

/**
 * Render a fact's `value` for embedding. Strings pass through; primitives are
 * stringified; objects/arrays go through JSON.stringify so the embedder sees
 * structured content rather than `[object Object]`.
 */
function formatFactValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value === null) return 'null';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
