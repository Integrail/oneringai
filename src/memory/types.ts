/**
 * Memory layer — core types and interfaces.
 *
 * The memory layer is self-contained. It depends only on IDisposable from domain/interfaces.
 * Everything else (LLM, persistence, embedding) is injected by the caller.
 */

import type { IDisposable } from '../domain/interfaces/IDisposable.js';

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

/**
 * Visibility scope on an entity or fact.
 *
 * - (none, none)       → global (visible to all)
 * - (groupId, none)    → group-wide
 * - (none, ownerId)    → user-private across all groups
 * - (groupId, ownerId) → user-private within a specific group
 */
export interface ScopeFields {
  groupId?: string;
  ownerId?: string;
}

/**
 * Caller's scope context. A record is visible iff:
 *   (!record.groupId || record.groupId === filter.groupId)
 *   AND
 *   (!record.ownerId || record.ownerId === filter.userId)
 */
export interface ScopeFilter {
  groupId?: string;
  userId?: string;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export type EntityId = string;

/**
 * A strong, uniqueness-bearing identifier for an entity.
 * Aliases (on IEntity) are display hints — NOT identifiers.
 */
export interface Identifier {
  /** e.g. 'email' | 'slack_id' | 'phone' | 'domain' | 'github' | 'legal_name' | 'ticker' | 'duns' */
  kind: string;
  value: string;
  isPrimary?: boolean;
  verified?: boolean;
  /** Which signal/source added this identifier. */
  source?: string;
  addedAt?: Date;
}

export interface IEntity extends ScopeFields {
  id: EntityId;
  /** 'person' | 'organization' | 'project' | 'topic' | 'private_contact' | ... */
  type: string;
  displayName: string;
  aliases?: string[];
  identifiers: Identifier[];
  metadata?: Record<string, unknown>;
  archived?: boolean;
  /** Optimistic concurrency token — incremented on every write. */
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

export type FactId = string;

/**
 * - 'atomic'   → short triple: (subject, predicate, objectId | value), optional short `details`.
 * - 'document' → long-form narrative in `details` (profiles, memos, notes, bios).
 */
export type FactKind = 'atomic' | 'document';

export interface IFact extends ScopeFields {
  id: FactId;
  subjectId: EntityId;
  predicate: string;
  kind: FactKind;

  // Payload — atomic uses objectId XOR value; document uses details.
  objectId?: EntityId;
  value?: unknown;
  details?: string;

  // Retrieval
  /** Short gist used as the embedding input for document facts. */
  summaryForEmbedding?: string;
  embedding?: number[];
  /** Computed at write-time. Gates embedding eligibility. */
  isSemantic?: boolean;

  // Quality + provenance
  confidence?: number;
  sourceSignalIds?: string[];
  /** Rule id if the fact was inferred by the rule engine. */
  derivedBy?: string;

  // Lifecycle
  supersedes?: FactId;
  archived?: boolean;
  /** Numeric aggregates update in place; never supersede. */
  isAggregate?: boolean;

  // Temporal
  observedAt?: Date;
  validFrom?: Date;
  validUntil?: Date;

  metadata?: Record<string, unknown>;

  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Retrieval shapes
// ---------------------------------------------------------------------------

export interface EntityView {
  entity: IEntity;
  /** Most-specific visible document fact with predicate='profile', or null if none. */
  profile: IFact | null;
  /** Atomic facts ranked by confidence × recency × predicate weight. */
  topFacts: IFact[];
  documents?: IFact[];
  semantic?: Array<{ fact: IFact; score: number }>;
  neighbors?: Neighborhood;
}

export interface ContextOptions {
  topFactsLimit?: number;
  include?: Array<'documents' | 'semantic' | 'neighbors'>;
  documentPredicates?: string[];
  semanticQuery?: string;
  semanticTopK?: number;
  neighborPredicates?: string[];
  neighborDepth?: number;
  asOf?: Date;
}

export interface Neighborhood {
  nodes: Array<{ entity: IEntity; depth: number }>;
  edges: Array<{ fact: IFact; from: EntityId; to: EntityId; depth: number }>;
}

export interface TraversalOptions {
  predicates?: string[];
  direction: 'out' | 'in' | 'both';
  /** Required hard bound — no unbounded traversals. */
  maxDepth: number;
  limit?: number;
  asOf?: Date;
}

export interface UpsertEntityResult {
  entity: IEntity;
  created: boolean;
  /** How many new identifiers were added to an existing entity. */
  mergedIdentifiers: number;
  /** Other entities that matched by some identifiers but were not chosen. */
  mergeCandidates: EntityId[];
}

export interface FactFilter {
  subjectId?: EntityId;
  objectId?: EntityId;
  predicate?: string;
  predicates?: string[];
  kind?: FactKind;
  /** Defaults to false (archived rows hidden). Pass true to include only archived, or undefined for default. */
  archived?: boolean;
  minConfidence?: number;
  observedAfter?: Date;
  observedBefore?: Date;
  /** Temporal filter: validFrom ≤ asOf ≤ (validUntil ?? ∞) AND createdAt ≤ asOf. */
  asOf?: Date;
}

export interface FactOrderBy {
  field: 'observedAt' | 'createdAt' | 'confidence';
  direction: 'asc' | 'desc';
}

export interface Page<T> {
  items: T[];
  nextCursor?: string;
}

// ---------------------------------------------------------------------------
// Store contract (pluggable backend)
// ---------------------------------------------------------------------------

export interface EntityListFilter {
  type?: string;
  ids?: EntityId[];
  archived?: boolean;
}

export interface EntitySearchOptions {
  types?: string[];
  limit?: number;
  cursor?: string;
}

export interface ListOptions {
  limit?: number;
  cursor?: string;
}

export interface FactQueryOptions {
  orderBy?: FactOrderBy;
  limit?: number;
  cursor?: string;
}

export interface SemanticSearchOptions {
  topK: number;
}

/**
 * Storage contract. Required methods are the minimum capability; optional
 * methods (`traverse`, `semanticSearch`) are discovered by duck-typing.
 *
 * **Adapter responsibilities:**
 *  - Apply `ScopeFilter` to every read — MemorySystem also filters, but the
 *    adapter must provide defence-in-depth.
 *  - Enforce optimistic concurrency on entity writes: reject `putEntity` if
 *    incoming `version !== stored.version + 1` (or 1 for new entities).
 *  - Hide archived records by default; return them only when an explicit
 *    `archived: true` filter is passed.
 *  - Support `asOf` on fact queries (`validFrom ≤ asOf ≤ validUntil ?? ∞`
 *    AND `createdAt ≤ asOf`).
 *  - When possible, expose a transactional primitive for supersession —
 *    MemorySystem currently writes the new fact before archiving the
 *    predecessor (crash-safe ordering) but adapters with native transactions
 *    may promote this to a single atomic operation.
 */
export interface IMemoryStore {
  // ----- Entities (required) -----
  putEntity(entity: IEntity): Promise<void>;
  putEntities(entities: IEntity[]): Promise<void>;
  getEntity(id: EntityId, scope: ScopeFilter): Promise<IEntity | null>;
  findEntitiesByIdentifier(kind: string, value: string, scope: ScopeFilter): Promise<IEntity[]>;
  searchEntities(query: string, opts: EntitySearchOptions, scope: ScopeFilter): Promise<Page<IEntity>>;
  listEntities(filter: EntityListFilter, opts: ListOptions, scope: ScopeFilter): Promise<Page<IEntity>>;
  archiveEntity(id: EntityId, scope: ScopeFilter): Promise<void>;
  /** Hard delete — MemorySystem gates this with an explicit flag. */
  deleteEntity(id: EntityId, scope: ScopeFilter): Promise<void>;

  // ----- Facts (required) -----
  putFact(fact: IFact): Promise<void>;
  putFacts(facts: IFact[]): Promise<void>;
  getFact(id: FactId, scope: ScopeFilter): Promise<IFact | null>;
  findFacts(filter: FactFilter, opts: FactQueryOptions, scope: ScopeFilter): Promise<Page<IFact>>;
  updateFact(id: FactId, patch: Partial<IFact>, scope: ScopeFilter): Promise<void>;
  countFacts(filter: FactFilter, scope: ScopeFilter): Promise<number>;

  // ----- Graph (optional capability) -----
  traverse?(startId: EntityId, opts: TraversalOptions, scope: ScopeFilter): Promise<Neighborhood>;

  // ----- Vector (optional capability) -----
  semanticSearch?(
    queryVector: number[],
    filter: FactFilter,
    opts: SemanticSearchOptions,
    scope: ScopeFilter,
  ): Promise<Array<{ fact: IFact; score: number }>>;

  // ----- Lifecycle -----
  destroy(): void;
  shutdown?(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Extension points
// ---------------------------------------------------------------------------

export interface IEmbedder {
  embed(text: string): Promise<number[]>;
  embedBatch?(texts: string[]): Promise<number[][]>;
  dimensions: number;
}

export interface IProfileGenerator {
  generate(
    entity: IEntity,
    atomicFacts: IFact[],
    priorProfile: IFact | undefined,
    targetScope: ScopeFields,
  ): Promise<{ details: string; summaryForEmbedding: string }>;
}

/**
 * Read-only view scoped to a specific caller, passed to the rule engine.
 * Rules CANNOT write through this view — they return partial IFact specs
 * that MemorySystem validates and persists.
 */
export interface IScopedMemoryView {
  getEntity(id: EntityId): Promise<IEntity | null>;
  findFacts(filter: FactFilter, opts?: { limit?: number }): Promise<IFact[]>;
}

export interface IRuleEngine {
  deriveFor(
    entityId: EntityId,
    view: IScopedMemoryView,
    scope: ScopeFilter,
  ): Promise<Array<Partial<IFact>>>;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type ChangeEvent =
  | { type: 'entity.upsert'; entity: IEntity; created: boolean }
  | { type: 'entity.archive'; entityId: EntityId }
  | { type: 'entity.merge'; winnerId: EntityId; loserId: EntityId }
  | { type: 'fact.add'; fact: IFact }
  | { type: 'fact.archive'; factId: FactId }
  | { type: 'fact.supersede'; oldId: FactId; newId: FactId }
  | { type: 'profile.regenerate'; entityId: EntityId; scope: ScopeFields; factId: FactId };

// ---------------------------------------------------------------------------
// Ranking config
// ---------------------------------------------------------------------------

export interface RankingConfig {
  predicateWeights?: Record<string, number>;
  recencyHalfLifeDays?: number;
  minConfidence?: number;
}

// ---------------------------------------------------------------------------
// MemorySystem config
// ---------------------------------------------------------------------------

export interface EmbeddingQueueConfig {
  concurrency?: number;
  retries?: number;
}

export interface MemorySystemConfig {
  store: IMemoryStore;
  embedder?: IEmbedder;
  profileGenerator?: IProfileGenerator;
  ruleEngine?: IRuleEngine;
  /** Number of new atomic facts since last profile regen that triggers auto-regeneration. */
  profileRegenerationThreshold?: number;
  topFactsRanking?: RankingConfig;
  embeddingQueue?: EmbeddingQueueConfig;
  onChange?: (event: ChangeEvent) => void;
}

// Re-export IDisposable so consumers can use the same symbol.
export type { IDisposable };
