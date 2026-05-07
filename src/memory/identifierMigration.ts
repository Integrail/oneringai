/**
 * Identifier-case data migration.
 *
 * Background: prior to library 0.6.x, the storage adapter unconditionally
 * lowercased every identifier value at the storage boundary. This was
 * symmetric on read (lookups also lowercased the query), so the library's
 * own paths never noticed — but case-sensitive identifier kinds like
 * `system_user_id` (Meteor `Random.id()`, base57) and `canonical` had their
 * original case destroyed. Any caller hand-rolling a Mongo query against
 * `identifiers[].value` would miss matches.
 *
 * Library 0.6.x makes the normalization kind-aware: only `email`, `domain`,
 * `phone`, `url_host` are case-insensitive (see `CASE_INSENSITIVE_IDENTIFIER_KINDS`
 * in identifiers.ts). Existing data written under the old behavior may have
 * lowercased values for kinds that should preserve case.
 *
 * This module provides a one-shot migration helper that walks entities
 * matching a kind filter, calls a caller-supplied recovery function for each
 * existing (lowercased) value, and writes the original-case value back.
 *
 * The recovery function is caller-supplied because the library has no source
 * of truth for what the original case "should" be — only the application
 * does (e.g., for `system_user_id`, the original is in the application's
 * users collection; for `canonical`, the original is whatever the caller's
 * canonicalization scheme produced).
 */

import type { IEntity, IMemoryStore, ScopeFilter } from './types.js';

/**
 * Recover the original-case identifier value, or `null` to leave the entity
 * untouched (no recovery available — the migration logs and skips).
 *
 * Called once per (entity, identifier) the migration encounters.
 */
export type IdentifierRecoveryFn = (args: {
  entity: IEntity;
  identifierKind: string;
  storedValue: string;
}) => Promise<string | null>;

export interface RecaseIdentifierOptions {
  /** Restrict to entities whose identifiers include this kind. Required. */
  kind: string;
  /**
   * Adapter-level scope filter. The migration walks one scope at a time —
   * callers iterate scopes themselves to match their tenant model.
   */
  scope: ScopeFilter;
  /** Recovery function. See `IdentifierRecoveryFn`. */
  recover: IdentifierRecoveryFn;
  /**
   * Page size for the initial entity listing. Default 200.
   */
  batchSize?: number;
  /**
   * When true, log diagnostic counts but do not write. Default false.
   */
  dryRun?: boolean;
  /**
   * Optional logger — defaults to console.
   */
  logger?: { info: (msg: string) => void; warn: (msg: string) => void };
}

export interface RecaseIdentifierResult {
  scanned: number;
  recased: number;
  skipped: number;
  unchanged: number;
  errors: Array<{ entityId: string; reason: string }>;
}

/**
 * Walk entities under `scope` whose identifiers include `kind`, ask the caller
 * to recover the original-case value for each, and write back. Idempotent
 * (re-running a completed migration is a no-op because already-correct values
 * make `recover` return the same value as stored).
 *
 * The migration uses the adapter's `findEntitiesByIdentifier` to list candidates
 * efficiently. For each entity, every identifier with the given kind is
 * processed independently — a single entity can carry multiple identifiers of
 * the same kind (e.g. a Person with multiple emails) and the migration touches
 * each one.
 */
export async function recaseIdentifierValues(
  store: IMemoryStore,
  options: RecaseIdentifierOptions,
): Promise<RecaseIdentifierResult> {
  const log = options.logger ?? {
    info: (m: string) => console.log(`[identifierMigration] ${m}`),
    warn: (m: string) => console.warn(`[identifierMigration] ${m}`),
  };
  const result: RecaseIdentifierResult = {
    scanned: 0,
    recased: 0,
    skipped: 0,
    unchanged: 0,
    errors: [],
  };
  const dryRun = options.dryRun ?? false;

  // Page through ALL entities under scope and filter caller-side. The
  // EntityListFilter shape doesn't support filtering on identifiers[].kind, so
  // a full scan is the only correct option. Migrations are one-shot anyway —
  // a per-tenant scan is acceptable cost.
  const pageSize = options.batchSize ?? 200;
  let cursor: string | undefined;

  do {
    const page = await store.listEntities(
      {},
      { limit: pageSize, cursor } as never,
      options.scope,
    );
    const items: IEntity[] = (page as { items?: IEntity[] }).items ?? [];
    cursor = (page as { nextCursor?: string }).nextCursor;
    if (items.length === 0) break;

    for (const entity of items) {
      // Skip entities that don't carry the target kind.
      const hasKind = entity.identifiers.some((i) => i.kind === options.kind);
      if (!hasKind) continue;

      result.scanned += 1;
      let entityDirty = false;
      const newIdentifiers = [...entity.identifiers];

      for (let i = 0; i < newIdentifiers.length; i++) {
        const ident = newIdentifiers[i]!;
        if (ident.kind !== options.kind) continue;

        try {
          const recovered = await options.recover({
            entity,
            identifierKind: ident.kind,
            storedValue: ident.value,
          });
          if (recovered === null) {
            result.skipped += 1;
            continue;
          }
          if (recovered === ident.value) {
            result.unchanged += 1;
            continue;
          }
          newIdentifiers[i] = { ...ident, value: recovered };
          entityDirty = true;
          result.recased += 1;
        } catch (err) {
          result.errors.push({
            entityId: entity.id,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (entityDirty && !dryRun) {
        try {
          // updateEntity contract: pass the full entity with version = stored + 1.
          await store.updateEntity({
            ...entity,
            identifiers: newIdentifiers,
            version: entity.version + 1,
            updatedAt: new Date(),
          });
        } catch (err) {
          result.errors.push({
            entityId: entity.id,
            reason: `updateEntity failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    }
  } while (cursor);

  log.info(
    `recaseIdentifierValues kind=${options.kind} scanned=${result.scanned} ` +
      `recased=${result.recased} skipped=${result.skipped} unchanged=${result.unchanged} ` +
      `errors=${result.errors.length} dryRun=${dryRun}`,
  );
  return result;
}
