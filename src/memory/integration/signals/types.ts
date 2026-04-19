/**
 * Signal-ingestion pluggable types.
 *
 * A "signal" is any inbound document carrying knowledge worth extracting:
 * email, chat message, calendar event, ticket body, meeting transcript, etc.
 * Rather than hand-coding each source shape into the memory layer, the pipeline
 * is split into two pluggable pieces:
 *
 *   1. `SignalSourceAdapter<TRaw>` — knows how to normalize ONE source shape
 *      into `ExtractedSignal`: body text + deterministic participant seeds
 *      (derived from metadata like email headers, not from the LLM).
 *
 *   2. `IExtractor` — runs the LLM call that produces `ExtractionOutput` from
 *      the prompt. Default implementation wraps an oneringai Connector; custom
 *      extractors can route through a proxy, use a different provider, or mock
 *      the call in tests.
 *
 * `SignalIngestor` wires them together:
 *   raw signal → adapter.extract → seed phase (upsertEntityBySurface per seed)
 *   → prompt rendering (with pre-resolved labels) → extractor.extract
 *   → ExtractionResolver.resolveAndIngest → IngestionResult.
 */

import type { Identifier } from '../../types.js';
import type { ExtractionOutput } from '../ExtractionResolver.js';

/**
 * Metadata-derived entity seed. The adapter emits these from deterministic
 * fields (email headers, calendar attendee lists, DB joins) — no LLM required.
 *
 * Seeds MUST carry at least one strong identifier. Seeding on weak names would
 * bind ambiguously — `SignalIngestor` rejects seeds with empty `identifiers`
 * rather than silently skip them. If you only have a display name, don't seed:
 * let the LLM surface the mention and resolve via surface form.
 *
 * Despite the historical name "participant", seeds can be ANY entity type —
 * events, tasks, projects. The role field is a free-form hint used by
 * `seedFacts` (below) for deterministic relational-fact writes.
 */
export interface ParticipantSeed {
  /** Free-form role hint, e.g. `from`, `to`, `cc`, `author`, `attendee`, `organizer`, `event`. */
  role: string;
  /** Strong identifiers. MUST be non-empty. */
  identifiers: Identifier[];
  /** Display name hint (falls back to the first identifier value). */
  displayName?: string;
  /** Additional surface forms spotted in the metadata. */
  aliases?: string[];
  /** Entity type. Default `'person'`. */
  type?: string;
  /**
   * Type-specific fields to set on the entity (e.g. event `startTime`/`endTime`,
   * task `state`/`dueAt`). Merge semantics follow `upsertEntityBySurface.metadata`:
   * verbatim on create, `fillMissing` on resolve.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Deterministic relational fact the adapter wants written after seed entities
 * are resolved. Roles refer to `ParticipantSeed.role` values; `SignalIngestor`
 * resolves them to entity ids and calls `memory.addFact`.
 *
 * When the referenced role appears multiple times among seeds (e.g. many
 * attendees), one fact is written per matching seed. Unresolved roles produce
 * an `IngestionError` entry rather than silently failing.
 */
export interface SeedFact {
  /** Role of the subject entity among `participants`. */
  subjectRole: string;
  /** Canonical predicate (snake_case). */
  predicate: string;
  /** Role of the object entity among `participants`. */
  objectRole: string;
  /** Optional salience. Defaults to predicate registry / addFact defaults. */
  importance?: number;
  /** Optional per-fact confidence override. */
  confidence?: number;
}

/**
 * Normalized signal shape — adapters reduce every source format to this.
 */
export interface ExtractedSignal {
  /** Body text handed to the LLM. Strip out headers / noise if they don't carry knowledge. */
  signalText: string;
  /** Short human description, e.g. "Email from anton@everworker.ai to sarah@everworker.ai". */
  signalSourceDescription?: string;
  /** Deterministic entity seeds derived from metadata. May be empty. */
  participants: ParticipantSeed[];
  /**
   * Deterministic facts derived from signal metadata, written after seed
   * entities are resolved. Useful when the relationship is guaranteed by the
   * source (e.g. calendar organizer/attendee) and shouldn't depend on the
   * LLM extracting it. Unresolved role references produce `IngestionError`
   * entries; the rest still write. Optional.
   */
  seedFacts?: SeedFact[];
}

/**
 * Adapter contract. Implementations are pure: `raw → ExtractedSignal` with no
 * I/O. Side effects (fetching attachments, querying a thread index) should be
 * done by the caller and the results passed into `raw` so the adapter stays
 * deterministic + testable.
 */
export interface SignalSourceAdapter<TRaw = unknown> {
  /** Unique kind string, e.g. `'email'`, `'text'`, `'slack'`. */
  readonly kind: string;
  extract(raw: TRaw): ExtractedSignal;
}

/**
 * LLM extractor contract. `prompt` is the fully-rendered extraction prompt;
 * returns the parsed JSON output. Implementations are responsible for calling
 * the LLM, requesting JSON response format, parsing, and fallback handling.
 */
export interface IExtractor {
  extract(prompt: string): Promise<ExtractionOutput>;
}
