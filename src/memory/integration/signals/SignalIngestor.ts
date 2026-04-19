/**
 * SignalIngestor — the library-level "raw signal → facts" pipeline.
 *
 * Responsibilities:
 *   1. Dispatch to a registered `SignalSourceAdapter` to normalize the raw
 *      signal into `{ signalText, participants }`.
 *   2. Seed phase: for each participant seed with strong identifiers, call
 *      `memory.upsertEntityBySurface` deterministically. No LLM, no ambiguity.
 *   3. Prompt phase: build the extraction prompt with pre-resolved labels +
 *      optional predicate-registry rendering + optional known-entities block.
 *   4. Extract phase: call the pluggable `IExtractor` (default
 *      `ConnectorExtractor`) for the LLM output.
 *   5. Resolve phase: hand the output + preResolved map to
 *      `ExtractionResolver.resolveAndIngest`, which writes facts.
 *
 * Callers who already have `ExtractedSignal` (or just raw text + participants)
 * can bypass the adapter via `ingestText` / `ingestExtracted`.
 */

import type { MemorySystem } from '../../MemorySystem.js';
import type { EntityId, IEntity, ScopeFilter, ScopeFields } from '../../types.js';
import type { PredicateRegistry } from '../../predicates/PredicateRegistry.js';
import {
  defaultExtractionPrompt,
  type ExtractionPromptContext,
  type PreResolvedBinding,
} from '../defaultExtractionPrompt.js';
import { ExtractionResolver, type IngestionError, type IngestionResult } from '../ExtractionResolver.js';
import type { ExtractedSignal, IExtractor, ParticipantSeed, SignalSourceAdapter } from './types.js';

export interface SignalIngestorConfig {
  memory: MemorySystem;
  extractor: IExtractor;
  /** Adapters registered at construction time. More can be added via `registerAdapter`. */
  adapters?: SignalSourceAdapter<unknown>[];
  /**
   * Optional override of the extraction prompt builder. When omitted the
   * library's `defaultExtractionPrompt` is used.
   */
  promptTemplate?: (ctx: ExtractionPromptContext) => string;
  /** Cap on predicates rendered per category in the prompt. Default 5. */
  maxPredicatesPerCategory?: number;
  /**
   * When present, the registry is handed to the prompt builder so the LLM
   * sees canonical predicate names. Defaults to `memory`'s registry if one
   * was configured, otherwise undefined.
   */
  predicateRegistry?: PredicateRegistry;
}

export interface IngestSignalInput<TRaw> {
  /** Kind matching a registered adapter, e.g. `'email'`, `'text'`. */
  kind: string;
  /** Raw source-specific payload. */
  raw: TRaw;
  /** Opaque id for the originating signal — attached to every written fact. */
  sourceSignalId: string;
  scope: ScopeFilter;
  /** Optional override of the auto-resolve threshold for this ingest only. */
  autoResolveThreshold?: number;
  /**
   * Known entities to hint to the LLM (appears as "Known entities" block).
   * Useful when the caller has pre-fetched likely candidates (e.g. by thread
   * participants) but doesn't want to seed them as hard bindings.
   */
  knownEntities?: IEntity[];
}

export interface IngestTextInput {
  text: string;
  signalSourceDescription?: string;
  participants?: ParticipantSeed[];
  sourceSignalId: string;
  scope: ScopeFilter;
  autoResolveThreshold?: number;
  knownEntities?: IEntity[];
}

export interface IngestExtractedInput {
  extracted: ExtractedSignal;
  sourceSignalId: string;
  scope: ScopeFilter;
  autoResolveThreshold?: number;
  knownEntities?: IEntity[];
}

export class SignalIngestor {
  private readonly memory: MemorySystem;
  private readonly extractor: IExtractor;
  private readonly adapters = new Map<string, SignalSourceAdapter<unknown>>();
  private readonly promptFn: (ctx: ExtractionPromptContext) => string;
  private readonly maxPredicatesPerCategory: number;
  private readonly predicateRegistry: PredicateRegistry | undefined;

  constructor(config: SignalIngestorConfig) {
    this.memory = config.memory;
    this.extractor = config.extractor;
    this.promptFn = config.promptTemplate ?? defaultExtractionPrompt;
    this.maxPredicatesPerCategory = config.maxPredicatesPerCategory ?? 5;
    this.predicateRegistry = config.predicateRegistry;
    for (const a of config.adapters ?? []) this.registerAdapter(a);
  }

  /** Register (or replace) an adapter for a given `kind`. */
  registerAdapter(adapter: SignalSourceAdapter<unknown>): this {
    this.adapters.set(adapter.kind, adapter);
    return this;
  }

  hasAdapter(kind: string): boolean {
    return this.adapters.has(kind);
  }

  /** Typed ingest by adapter kind. */
  async ingest<TRaw>(input: IngestSignalInput<TRaw>): Promise<IngestionResult> {
    const adapter = this.adapters.get(input.kind);
    if (!adapter) {
      throw new Error(`SignalIngestor.ingest: no adapter registered for kind '${input.kind}'`);
    }
    const extracted = (adapter as SignalSourceAdapter<TRaw>).extract(input.raw);
    return this.ingestExtracted({
      extracted,
      sourceSignalId: input.sourceSignalId,
      scope: input.scope,
      autoResolveThreshold: input.autoResolveThreshold,
      knownEntities: input.knownEntities,
    });
  }

  /** Bypass adapters — caller provides raw text + optional participant seeds directly. */
  async ingestText(input: IngestTextInput): Promise<IngestionResult> {
    return this.ingestExtracted({
      extracted: {
        signalText: input.text,
        signalSourceDescription: input.signalSourceDescription,
        participants: input.participants ?? [],
      },
      sourceSignalId: input.sourceSignalId,
      scope: input.scope,
      autoResolveThreshold: input.autoResolveThreshold,
      knownEntities: input.knownEntities,
    });
  }

  /** Lowest-level entry point — for callers with their own adapter logic. */
  async ingestExtracted(input: IngestExtractedInput): Promise<IngestionResult> {
    const { bindings, seedErrors } = await this.seedParticipants(
      input.extracted.participants,
      input.scope,
    );

    const prompt = this.promptFn({
      signalText: input.extracted.signalText,
      signalSourceDescription: input.extracted.signalSourceDescription,
      targetScope: scopeToFields(input.scope),
      preResolvedBindings: bindings,
      knownEntities: input.knownEntities,
      predicateRegistry: this.predicateRegistry,
      maxPredicatesPerCategory: this.maxPredicatesPerCategory,
    });

    const extractionOutput = await this.extractor.extract(prompt);

    const preResolved: Record<string, EntityId> = {};
    for (const b of bindings) preResolved[b.label] = b.entity.id;

    const resolver = new ExtractionResolver(this.memory);
    const result = await resolver.resolveAndIngest(
      extractionOutput,
      input.sourceSignalId,
      input.scope,
      {
        autoResolveThreshold: input.autoResolveThreshold,
        preResolved,
      },
    );

    if (seedErrors.length > 0) {
      result.unresolved.push(...seedErrors);
    }

    for (const b of bindings) {
      if (result.entities.some((e) => e.label === b.label)) continue;
      result.entities.push({
        label: b.label,
        entity: b.entity,
        resolved: true,
        mergeCandidates: [],
      });
    }

    return result;
  }

  private async seedParticipants(
    seeds: ParticipantSeed[],
    scope: ScopeFilter,
  ): Promise<{ bindings: PreResolvedBinding[]; seedErrors: IngestionError[] }> {
    const bindings: PreResolvedBinding[] = [];
    const seedErrors: IngestionError[] = [];
    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i]!;
      if (!seed.identifiers || seed.identifiers.length === 0) {
        seedErrors.push({
          where: `seed:${i}`,
          reason: 'participant seed has no strong identifiers — weak-name seeding is not allowed',
        });
        continue;
      }
      try {
        const surface = seed.displayName ?? seed.identifiers[0]!.value;
        const { entity } = await this.memory.upsertEntityBySurface(
          {
            surface,
            type: seed.type ?? 'person',
            identifiers: seed.identifiers,
            aliases: seed.aliases ?? [],
          },
          scope,
        );
        bindings.push({
          label: `m${bindings.length + 1}`,
          entity,
          role: seed.role,
        });
      } catch (err) {
        seedErrors.push({
          where: `seed:${i}`,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { bindings, seedErrors };
  }
}

function scopeToFields(scope: ScopeFilter): ScopeFields {
  return {
    groupId: scope.groupId,
    ownerId: scope.userId,
  };
}
