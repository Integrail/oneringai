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

const FALLBACK_EMBEDDING_MAX_TOKENS = 8191;
const EMBEDDING_TOKEN_MARGIN = 512;
const EMBEDDING_CHARS_PER_TOKEN = 3;
const EMBEDDING_TAIL_FRACTION = 0.3;

export interface ConnectorEmbedderConfig {
  /** Connector name — must already be registered via Connector.create(). */
  connector: string;
  /** Embedding model id, e.g. 'text-embedding-3-small' or 'text-embedding-3-large'. */
  model: string;
  /** Output dimensions. Must match the model's output (or MRL-reduced target). */
  dimensions: number;
  /** Optional dimension override passed to the provider (for MRL models). */
  requestedDimensions?: number;
}

export class ConnectorEmbedder implements IEmbedder {
  readonly dimensions: number;
  private readonly provider: IEmbeddingProvider;
  private readonly model: string;
  private readonly requestedDimensions?: number;

  constructor(config: ConnectorEmbedderConfig) {
    const connector = Connector.get(config.connector);
    this.provider = createEmbeddingProvider(connector);
    this.model = config.model;
    this.dimensions = config.dimensions;
    this.requestedDimensions = config.requestedDimensions;
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
  }): ConnectorEmbedder {
    const instance = Object.create(ConnectorEmbedder.prototype) as ConnectorEmbedder;
    const bag = instance as unknown as {
      provider: IEmbeddingProvider;
      model: string;
      dimensions: number;
      requestedDimensions?: number;
    };
    bag.provider = args.provider;
    bag.model = args.model;
    bag.dimensions = args.dimensions;
    bag.requestedDimensions = args.requestedDimensions;
    return instance;
  }

  async embed(text: string): Promise<number[]> {
    const input = this.limitInput(text);
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
    const input = texts.map((text) => this.limitInput(text));
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

  private limitInput(text: string): string {
    const maxTokens =
      getEmbeddingModelInfo(this.model)?.capabilities.maxTokens ?? FALLBACK_EMBEDDING_MAX_TOKENS;
    const reserveTokens = Math.min(EMBEDDING_TOKEN_MARGIN, Math.floor(maxTokens / 4));
    const usableTokens = Math.max(1, maxTokens - reserveTokens);
    const maxChars = Math.floor(usableTokens * EMBEDDING_CHARS_PER_TOKEN);
    if (text.length <= maxChars) return text;

    const tailChars = Math.floor(maxChars * EMBEDDING_TAIL_FRACTION);
    const separator = '\n\n';
    const headChars = Math.max(0, maxChars - tailChars - separator.length);
    if (headChars <= 0) return text.slice(0, maxChars);

    return `${text.slice(0, headChars)}${separator}${text.slice(text.length - tailChars)}`;
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
