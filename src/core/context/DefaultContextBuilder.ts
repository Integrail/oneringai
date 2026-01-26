/**
 * DefaultContextBuilder - Default implementation of IContextBuilder
 *
 * Assembles context from multiple sources with token budget management.
 * Users can extend this or implement IContextBuilder for custom behavior.
 */

import type {
  IContextBuilder,
  ContextSource,
  BuiltContext,
  ContextBuilderConfig,
} from '../../domain/interfaces/IContextBuilder.js';
import { DEFAULT_CONTEXT_BUILDER_CONFIG } from '../../domain/interfaces/IContextBuilder.js';

/**
 * Default context builder implementation
 */
export class DefaultContextBuilder implements IContextBuilder {
  private sources: Map<string, ContextSource> = new Map();
  private config: Required<ContextBuilderConfig>;

  constructor(config: Partial<ContextBuilderConfig> = {}) {
    this.config = {
      ...DEFAULT_CONTEXT_BUILDER_CONFIG,
      ...config,
    };
  }

  /**
   * Register a context source
   */
  registerSource(source: ContextSource): void {
    this.sources.set(source.name, source);
  }

  /**
   * Unregister a context source
   */
  unregisterSource(name: string): void {
    this.sources.delete(name);
  }

  /**
   * Build context from all sources
   */
  async build(input: string, options?: Partial<ContextBuilderConfig>): Promise<BuiltContext> {
    const maxTokens = options?.maxTokens ?? this.config.maxTokens;
    const responseReserve = options?.responseReserve ?? this.config.responseReserve;
    const estimateTokens = options?.estimateTokens ?? this.config.estimateTokens;
    const separator = options?.sectionSeparator ?? this.config.sectionSeparator;

    // Available budget (minus response reserve)
    const availableBudget = Math.floor(maxTokens * (1 - responseReserve));

    // Sort sources by priority (higher first)
    const sortedSources = Array.from(this.sources.values())
      .sort((a, b) => b.priority - a.priority);

    // Estimate tokens for input
    const inputTokens = estimateTokens(input);

    // Build context
    const includedSources: string[] = [];
    const excludedSources: string[] = [];
    const tokenBreakdown: Record<string, number> = { input: inputTokens };
    const contentParts: string[] = [];

    let usedTokens = inputTokens;

    // First pass: include required sources
    for (const source of sortedSources) {
      if (!source.required) continue;

      const content = await source.getContent();
      if (!content) continue;

      const sourceTokens = estimateTokens(content);

      if (usedTokens + sourceTokens > availableBudget) {
        throw new Error(
          `Required context source "${source.name}" (${sourceTokens} tokens) ` +
          `exceeds available budget (${availableBudget - usedTokens} remaining)`
        );
      }

      contentParts.push(content);
      includedSources.push(source.name);
      tokenBreakdown[source.name] = sourceTokens;
      usedTokens += sourceTokens;
    }

    // Second pass: include optional sources by priority
    for (const source of sortedSources) {
      if (source.required) continue;

      const content = await source.getContent();
      if (!content) continue;

      const sourceTokens = estimateTokens(content);

      if (usedTokens + sourceTokens > availableBudget) {
        excludedSources.push(source.name);
        continue;
      }

      contentParts.push(content);
      includedSources.push(source.name);
      tokenBreakdown[source.name] = sourceTokens;
      usedTokens += sourceTokens;
    }

    // Add input at the end
    contentParts.push(`## Current Request\n\n${input}`);

    // Build final content
    const content = contentParts.join(separator);

    return {
      content,
      estimatedTokens: usedTokens,
      includedSources,
      excludedSources,
      tokenBreakdown,
    };
  }

  /**
   * Get registered source names
   */
  getSources(): string[] {
    return Array.from(this.sources.keys());
  }

  /**
   * Get configuration
   */
  getConfig(): ContextBuilderConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContextBuilderConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
