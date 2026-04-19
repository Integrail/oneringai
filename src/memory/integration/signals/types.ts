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
 */
export interface ParticipantSeed {
  /** Free-form role hint, e.g. `from`, `to`, `cc`, `author`, `attendee`, `organizer`. */
  role: string;
  /** Strong identifiers. MUST be non-empty. */
  identifiers: Identifier[];
  /** Display name hint (falls back to the first identifier value). */
  displayName?: string;
  /** Additional surface forms spotted in the metadata. */
  aliases?: string[];
  /** Entity type. Default `'person'`. */
  type?: string;
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
