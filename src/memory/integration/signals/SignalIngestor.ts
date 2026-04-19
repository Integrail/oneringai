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
import type { EntityId, IEntity, IFact, ScopeFilter, ScopeFields } from '../../types.js';
import type { PredicateRegistry } from '../../predicates/PredicateRegistry.js';
import {
  defaultExtractionPrompt,
  type ExtractionPromptContext,
  type PreResolvedBinding,
} from '../defaultExtractionPrompt.js';
import { ExtractionResolver, type IngestionError, type IngestionResult } from '../ExtractionResolver.js';
import type {
  ExtractedSignal,
  IExtractor,
  ParticipantSeed,
  SeedFact,
  SignalSourceAdapter,
} from './types.js';

export interface ContextHintsConfig {
  /**
   * Prefix the "Known entities" block with open tasks for the ingest scope.
   * Opt-in — costs a `listOpenTasks` call + prompt tokens per extraction.
   *   `true`       → default limit 20
   *   `{ limit }`  → caller-controlled limit (clamped by listOpenTasks to ≤ 200)
   */
  openTasks?: boolean | { limit?: number };
  /**
   * Prefix the "Known entities" block with recently-touched topics.
   * Same opt-in semantics as `openTasks`.
   */
  recentTopics?: boolean | { days?: number; limit?: number };
}

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
  /**
   * Opt-in: inject prior context (open tasks, recent topics) into the
   * extraction prompt so re-mentions of existing entities resolve to the
   * same row instead of creating duplicates. Off by default — token-budget
   * guardrail. Enable per-scope when ingesting a stream of related signals.
   */
  contextHints?: ContextHintsConfig;
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
  private readonly contextHints: ContextHintsConfig | undefined;

  constructor(config: SignalIngestorConfig) {
    this.memory = config.memory;
    this.extractor = config.extractor;
    this.promptFn = config.promptTemplate ?? defaultExtractionPrompt;
    this.maxPredicatesPerCategory = config.maxPredicatesPerCategory ?? 5;
    this.predicateRegistry = config.predicateRegistry;
    this.contextHints = config.contextHints;
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

    const knownEntities = await this.buildKnownEntities(input);

    const prompt = this.promptFn({
      signalText: input.extracted.signalText,
      signalSourceDescription: input.extracted.signalSourceDescription,
      targetScope: scopeToFields(input.scope),
      preResolvedBindings: bindings,
      knownEntities,
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

    const seedFacts = input.extracted.seedFacts ?? [];
    if (seedFacts.length > 0) {
      const { writtenFacts, seedFactErrors } = await this.writeSeedFacts(
        seedFacts,
        bindings,
        input.sourceSignalId,
        input.scope,
      );
      result.facts.push(...writtenFacts);
      result.unresolved.push(...seedFactErrors);
    }

    return result;
  }

  /**
   * Write deterministic facts from `ExtractedSignal.seedFacts`. Role references
   * map to resolved entities via `bindings`. When a role has multiple matching
   * seeds (e.g. many `attendee` participants), one fact per pair is written.
   *
   * Self-facts are skipped silently (subject === object). Errors per-fact are
   * collected and returned; a bad seedFact doesn't abort the rest.
   */
  private async writeSeedFacts(
    seedFacts: SeedFact[],
    bindings: PreResolvedBinding[],
    sourceSignalId: string,
    scope: ScopeFilter,
  ): Promise<{ writtenFacts: IFact[]; seedFactErrors: IngestionError[] }> {
    const byRole = new Map<string, PreResolvedBinding[]>();
    for (const b of bindings) {
      if (!b.role) continue; // roleless seeds are unreferenceable from seedFacts
      const arr = byRole.get(b.role) ?? [];
      arr.push(b);
      byRole.set(b.role, arr);
    }
    const writtenFacts: IFact[] = [];
    const seedFactErrors: IngestionError[] = [];
    for (let i = 0; i < seedFacts.length; i++) {
      const sf = seedFacts[i]!;
      const subs = byRole.get(sf.subjectRole) ?? [];
      const objs = byRole.get(sf.objectRole) ?? [];
      if (subs.length === 0 || objs.length === 0) {
        seedFactErrors.push({
          where: `seedFact:${i}`,
          reason:
            `seedFact[${i}] (${sf.subjectRole} ${sf.predicate} ${sf.objectRole}): ` +
            `role not found in resolved seeds (subjects=${subs.length}, objects=${objs.length})`,
        });
        continue;
      }
      for (const s of subs) {
        for (const o of objs) {
          if (s.entity.id === o.entity.id) continue; // addFact rejects self-facts
          try {
            // Idempotent writes — calendar syncs and similar polling ingestors
            // re-observe the same event many times. `dedup: true` matches on
            // (subject, canonicalized predicate, kind, objectId), bumps
            // observedAt on hit, and skips the insert. Without it, every sync
            // pass would accumulate duplicate `attended` / `hosted` facts.
            const fact = await this.memory.addFact(
              {
                subjectId: s.entity.id,
                predicate: sf.predicate,
                kind: 'atomic',
                objectId: o.entity.id,
                importance: sf.importance,
                confidence: sf.confidence,
                sourceSignalId,
                dedup: true,
              },
              scope,
            );
            writtenFacts.push(fact);
          } catch (err) {
            seedFactErrors.push({
              where: `seedFact:${i}`,
              reason: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }
    return { writtenFacts, seedFactErrors };
  }

  /**
   * Merge caller-supplied `knownEntities` with library-fetched hints
   * (open tasks, recent topics) when `contextHints` is enabled. Dedupes by
   * entity id. Caller-supplied entities come first so the caller's emphasis
   * is preserved; library-fetched hints fill remaining slots.
   */
  private async buildKnownEntities(input: IngestExtractedInput): Promise<IEntity[] | undefined> {
    const base = input.knownEntities ?? [];
    const hints = this.contextHints;
    if (!hints || (!hints.openTasks && !hints.recentTopics)) {
      return base.length > 0 ? base : undefined;
    }
    const seen = new Set<string>(base.map((e) => e.id));
    const merged: IEntity[] = [...base];

    if (hints.openTasks) {
      const limit = typeof hints.openTasks === 'object' ? hints.openTasks.limit ?? 20 : 20;
      try {
        const tasks = await this.memory.listOpenTasks(input.scope, { limit });
        for (const t of tasks) {
          if (!seen.has(t.id)) {
            merged.push(t);
            seen.add(t.id);
          }
        }
      } catch (err) {
        // Non-fatal — prompt still renders without the hint. Surface to avoid
        // silent blind spots during debugging.
        // eslint-disable-next-line no-console
        console.warn('[SignalIngestor] contextHints.openTasks fetch failed:', err);
      }
    }

    if (hints.recentTopics) {
      const opts =
        typeof hints.recentTopics === 'object'
          ? { days: hints.recentTopics.days, limit: hints.recentTopics.limit ?? 30 }
          : { limit: 30 };
      try {
        const topics = await this.memory.listRecentTopics(input.scope, opts);
        for (const t of topics) {
          if (!seen.has(t.id)) {
            merged.push(t);
            seen.add(t.id);
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[SignalIngestor] contextHints.recentTopics fetch failed:', err);
      }
    }

    return merged.length > 0 ? merged : undefined;
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
            metadata: seed.metadata,
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
