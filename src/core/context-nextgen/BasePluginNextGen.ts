/**
 * BasePluginNextGen - Base class for context plugins
 *
 * Provides common functionality:
 * - Token size tracking with caching
 * - Default implementations for optional methods
 * - Simple token estimation
 */

import type { IContextPluginNextGen, ITokenEstimator } from './types.js';
import type { ToolFunction } from '../../domain/entities/Tool.js';

/**
 * Simple token estimator used by plugins.
 * Uses character-based approximation (good enough for most cases).
 */
export const simpleTokenEstimator: ITokenEstimator = {
  estimateTokens(text: string): number {
    if (!text || text.length === 0) return 0;
    // ~3.5 characters per token on average for mixed content
    return Math.ceil(text.length / 3.5);
  },

  estimateDataTokens(data: unknown): number {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    return this.estimateTokens(text);
  },
};

/**
 * Base class for NextGen context plugins.
 *
 * Subclasses should:
 * 1. Override `name` property
 * 2. Implement `getInstructions()` and `getContent()`
 * 3. Call `invalidateTokenCache()` when content changes
 * 4. Optionally override other methods as needed
 */
export abstract class BasePluginNextGen implements IContextPluginNextGen {
  abstract readonly name: string;

  /** Cached token size for content */
  private _contentTokenCache: number | null = null;

  /** Cached token size for instructions */
  private _instructionsTokenCache: number | null = null;

  /** Token estimator */
  protected estimator: ITokenEstimator = simpleTokenEstimator;

  // ============================================================================
  // Abstract methods - must be implemented by subclasses
  // ============================================================================

  abstract getInstructions(): string | null;
  abstract getContent(): Promise<string | null>;
  abstract getContents(): unknown;

  // ============================================================================
  // Token size tracking
  // ============================================================================

  /**
   * Get current token size of content.
   * Uses caching - call invalidateTokenCache() when content changes.
   */
  getTokenSize(): number {
    if (this._contentTokenCache === null) {
      // We need to calculate synchronously, but getContent is async
      // For base implementation, return 0 - subclasses should override
      // or call updateTokenCache() after content changes
      return 0;
    }
    return this._contentTokenCache;
  }

  /**
   * Get token size of instructions (cached after first call).
   */
  getInstructionsTokenSize(): number {
    if (this._instructionsTokenCache === null) {
      const instructions = this.getInstructions();
      this._instructionsTokenCache = instructions
        ? this.estimator.estimateTokens(instructions)
        : 0;
    }
    return this._instructionsTokenCache;
  }

  /**
   * Invalidate token cache - call when content changes.
   */
  protected invalidateTokenCache(): void {
    this._contentTokenCache = null;
  }

  /**
   * Update token cache with new size.
   * Call this after modifying content.
   */
  protected updateTokenCache(tokens: number): void {
    this._contentTokenCache = tokens;
  }

  /**
   * Recalculate and cache token size from current content.
   */
  protected async recalculateTokenCache(): Promise<number> {
    const content = await this.getContent();
    const tokens = content ? this.estimator.estimateTokens(content) : 0;
    this._contentTokenCache = tokens;
    return tokens;
  }

  // ============================================================================
  // Default implementations
  // ============================================================================

  /**
   * Default: not compactable. Override if plugin supports compaction.
   */
  isCompactable(): boolean {
    return false;
  }

  /**
   * Default: no compaction. Override if plugin supports compaction.
   */
  async compact(_targetTokensToFree: number): Promise<number> {
    return 0;
  }

  /**
   * Default: no tools. Override to provide plugin-specific tools.
   */
  getTools(): ToolFunction[] {
    return [];
  }

  /**
   * Default: no-op cleanup. Override if plugin has resources to release.
   */
  destroy(): void {
    // No-op by default
  }

  /**
   * Default: return empty state. Override for persistence.
   */
  getState(): unknown {
    return {};
  }

  /**
   * Default: no-op restore. Override for persistence.
   */
  restoreState(_state: unknown): void {
    // No-op by default
  }
}
