/**
 * ConnectorEmbedder — adapts oneringai's IEmbeddingProvider (wired via a named
 * Connector) to the memory layer's IEmbedder interface.
 *
 * Initialized once at MemorySystem construction with { connector, model,
 * dimensions }. Every subsequent embed call on the memory layer routes through
 * the chosen connector + model.
 */

import type { IEmbedder } from '../types.js';
import type { IEmbeddingProvider } from '../../domain/interfaces/IEmbeddingProvider.js';
import { Connector } from '../../core/Connector.js';
import { createEmbeddingProvider } from '../../core/createEmbeddingProvider.js';
import { getEmbeddingModelInfo } from '../../domain/entities/EmbeddingModel.js';
import { ProviderContextLengthError } from '../../domain/errors/AIErrors.js';

const EMBEDDING_CHARS_PER_TOKEN = 3.5;

function estimateEmbeddingTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / EMBEDDING_CHARS_PER_TOKEN);
}

export interface OversizeEmbeddingInput {
  text: string;
  model: string;
  maxTokens: number;
  estimatedTokens: number;
}

export type OversizeEmbeddingReducer = (input: OversizeEmbeddingInput) => Promise<string>;

export interface ConnectorEmbedderConfig {
  /** Connector name — must already be registered via Connector.create(). */
  connector: string;
  /** Embedding model id, e.g. 'text-embedding-3-small' or 'text-embedding-3-large'. */
  model: string;
  /** Output dimensions. Must match the model's output (or MRL-reduced target). */
  dimensions: number;
  /** Optional dimension override passed to the provider (for MRL models). */
  requestedDimensions?: number;
  /** Optional model input-token override for custom/unknown embedding models. */
  maxInputTokens?: number;
  /**
   * Optional host-provided reducer for inputs that exceed the embedding model's
   * declared token limit. Hosts can summarize or otherwise compress text using
   * their own connector/model choices; ConnectorEmbedder validates the reduced
   * text before sending it to the embedding provider.
   */
  oversizeInputReducer?: OversizeEmbeddingReducer;
}

export class ConnectorEmbedder implements IEmbedder {
  readonly dimensions: number;
  private readonly provider: IEmbeddingProvider;
  private readonly model: string;
  private readonly requestedDimensions?: number;
  private readonly maxInputTokens?: number;
  private readonly oversizeInputReducer?: OversizeEmbeddingReducer;

  constructor(config: ConnectorEmbedderConfig) {
    const connector = Connector.get(config.connector);
    this.provider = createEmbeddingProvider(connector);
    this.model = config.model;
    this.dimensions = config.dimensions;
    this.requestedDimensions = config.requestedDimensions;
    this.maxInputTokens = config.maxInputTokens;
    this.oversizeInputReducer = config.oversizeInputReducer;
  }

  /**
   * Construct a ConnectorEmbedder from a pre-built provider instead of
   * resolving one from the Connector registry. Intended for callers that
   * already have an IEmbeddingProvider (testing, unusual plumbing).
   */
  static withProvider(args: {
    provider: IEmbeddingProvider;
    model: string;
    dimensions: number;
    requestedDimensions?: number;
    maxInputTokens?: number;
    oversizeInputReducer?: OversizeEmbeddingReducer;
  }): ConnectorEmbedder {
    const instance = Object.create(ConnectorEmbedder.prototype) as ConnectorEmbedder;
    const bag = instance as unknown as {
      provider: IEmbeddingProvider;
      model: string;
      dimensions: number;
      requestedDimensions?: number;
      maxInputTokens?: number;
      oversizeInputReducer?: OversizeEmbeddingReducer;
    };
    bag.provider = args.provider;
    bag.model = args.model;
    bag.dimensions = args.dimensions;
    bag.requestedDimensions = args.requestedDimensions;
    bag.maxInputTokens = args.maxInputTokens;
    bag.oversizeInputReducer = args.oversizeInputReducer;
    return instance;
  }

  async embed(text: string): Promise<number[]> {
    const input = await this.prepareInput(text);
    const res = await this.provider.embed({
      model: this.model,
      input,
      dimensions: this.requestedDimensions,
    });
    const vec = res.embeddings[0];
    if (!vec) {
      throw new Error('ConnectorEmbedder: provider returned no embedding');
    }
    this.assertVectorShape(vec);
    return vec;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const input = await Promise.all(texts.map((text) => this.prepareInput(text)));
    const res = await this.provider.embed({
      model: this.model,
      input,
      dimensions: this.requestedDimensions,
    });
    if (res.embeddings.length !== texts.length) {
      throw new Error(
        `ConnectorEmbedder: provider returned ${res.embeddings.length} embeddings for ${texts.length} inputs`,
      );
    }
    for (const vec of res.embeddings) this.assertVectorShape(vec);
    return res.embeddings;
  }

  private async prepareInput(text: string): Promise<string> {
    const maxTokens = this.getMaxInputTokens();
    if (!maxTokens) return text;

    const estimatedTokens = estimateEmbeddingTokens(text);
    if (estimatedTokens <= maxTokens) return text;

    if (!this.oversizeInputReducer) {
      throw new ProviderContextLengthError('ConnectorEmbedder', maxTokens, estimatedTokens);
    }

    const reduced = await this.oversizeInputReducer({
      text,
      model: this.model,
      maxTokens,
      estimatedTokens,
    });
    const reducedEstimatedTokens = estimateEmbeddingTokens(reduced);
    if (reducedEstimatedTokens > maxTokens) {
      throw new ProviderContextLengthError('ConnectorEmbedder', maxTokens, reducedEstimatedTokens);
    }
    return reduced;
  }

  private getMaxInputTokens(): number | undefined {
    return this.maxInputTokens ?? getEmbeddingModelInfo(this.model)?.capabilities.maxTokens;
  }

  /**
   * Reject vectors whose length mismatches the declared dimensions, or contain
   * NaN/Infinity. Storing a wrong-sized vector silently poisons cosine-distance
   * retrieval downstream (NaN scores, wrong ranking).
   */
  private assertVectorShape(vec: number[]): void {
    if (vec.length !== this.dimensions) {
      throw new Error(
        `ConnectorEmbedder: dimension mismatch — provider returned ${vec.length}, ` +
          `expected ${this.dimensions} (model '${this.model}' may have changed or requestedDimensions ignored)`,
      );
    }
    for (let i = 0; i < vec.length; i++) {
      const v = vec[i]!;
      if (!Number.isFinite(v)) {
        throw new Error(
          `ConnectorEmbedder: non-finite value at index ${i} (got ${v})`,
        );
      }
    }
  }
}
