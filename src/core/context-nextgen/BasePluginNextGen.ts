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
import { TOKEN_ESTIMATION } from '../constants.js';

/**
 * Simple token estimator used by plugins.
 *
 * Uses character-based approximation (~3.5 chars/token) which is
 * accurate enough for budget management purposes. For precise
 * tokenization, you can provide a custom estimator via the
 * `estimator` protected property.
 *
 * @example
 * ```typescript
 * const tokens = simpleTokenEstimator.estimateTokens("Hello world");
 * // ~4 tokens
 *
 * const dataTokens = simpleTokenEstimator.estimateDataTokens({ key: "value" });
 * // Stringifies and estimates
 * ```
 */
export const simpleTokenEstimator: ITokenEstimator = {
  estimateTokens(text: string): number {
    if (!text || text.length === 0) return 0;
    return Math.ceil(text.length / TOKEN_ESTIMATION.MIXED_CHARS_PER_TOKEN);
  },

  estimateDataTokens(data: unknown): number {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    return this.estimateTokens(text);
  },

  estimateImageTokens(width?: number, height?: number, detail?: string): number {
    // Low detail images are always ~85 tokens (OpenAI pricing model)
    if (detail === 'low') return 85;

    // If dimensions known, use tile-based estimation (OpenAI model):
    // 85 base + 170 per 512x512 tile
    if (width && height) {
      const tiles = Math.ceil(width / 512) * Math.ceil(height / 512);
      return 85 + 170 * tiles;
    }

    // Unknown dimensions — conservative default
    return 1000;
  },
};

/**
 * Base class for NextGen context plugins.
 *
 * Provides:
 * - **Token cache management** - `invalidateTokenCache()`, `updateTokenCache()`, `recalculateTokenCache()`
 * - **Simple token estimator** - `this.estimator` (can be overridden)
 * - **Default implementations** - for optional interface methods
 *
 * ## Implementing a Plugin
 *
 * ```typescript
 * class MyPlugin extends BasePluginNextGen {
 *   readonly name = 'my_plugin';
 *   private _data = new Map<string, string>();
 *
 *   // 1. Return static instructions (cached automatically)
 *   getInstructions(): string {
 *     return '## My Plugin\n\nUse my_plugin_set to store data...';
 *   }
 *
 *   // 2. Return formatted content (update token cache!)
 *   async getContent(): Promise<string | null> {
 *     if (this._data.size === 0) return null;
 *     const content = this.formatEntries();
 *     this.updateTokenCache(this.estimator.estimateTokens(content));
 *     return content;
 *   }
 *
 *   // 3. Return raw data for inspection
 *   getContents(): unknown {
 *     return Object.fromEntries(this._data);
 *   }
 *
 *   // 4. Invalidate cache when data changes
 *   set(key: string, value: string): void {
 *     this._data.set(key, value);
 *     this.invalidateTokenCache();  // <-- Important!
 *   }
 * }
 * ```
 *
 * ## Token Cache Lifecycle
 *
 * The token cache is used for budget calculation. Follow this pattern:
 *
 * 1. **When state changes** → Call `invalidateTokenCache()` to clear the cache
 * 2. **In getContent()** → Call `updateTokenCache(tokens)` before returning
 * 3. **For async recalc** → Use `recalculateTokenCache()` helper
 *
 * ```typescript
 * // Pattern 1: Invalidate on change, update in getContent
 * store(key: string, value: unknown): void {
 *   this._entries.set(key, value);
 *   this.invalidateTokenCache();  // Clear cache
 * }
 *
 * async getContent(): Promise<string | null> {
 *   const content = this.formatContent();
 *   this.updateTokenCache(this.estimator.estimateTokens(content));  // Update cache
 *   return content;
 * }
 *
 * // Pattern 2: Recalculate immediately after change
 * async store(key: string, value: unknown): Promise<void> {
 *   this._entries.set(key, value);
 *   await this.recalculateTokenCache();  // Recalc and cache
 * }
 * ```
 *
 * ## Compaction Support
 *
 * To make your plugin compactable:
 *
 * ```typescript
 * isCompactable(): boolean {
 *   return this._entries.size > 0;
 * }
 *
 * async compact(targetTokensToFree: number): Promise<number> {
 *   // Remove low-priority entries
 *   let freed = 0;
 *   for (const [key, entry] of this._entries) {
 *     if (entry.priority !== 'critical' && freed < targetTokensToFree) {
 *       freed += entry.tokens;
 *       this._entries.delete(key);
 *     }
 *   }
 *   this.invalidateTokenCache();
 *   return freed;
 * }
 * ```
 */
export abstract class BasePluginNextGen implements IContextPluginNextGen {
  abstract readonly name: string;

  /**
   * Cached token size for content.
   * Updated via updateTokenCache(), cleared via invalidateTokenCache().
   */
  private _contentTokenCache: number | null = null;

  /**
   * Cached token size for instructions.
   * Computed once on first call to getInstructionsTokenSize().
   */
  private _instructionsTokenCache: number | null = null;

  /**
   * Token estimator instance.
   * Override this in subclass to use a custom estimator (e.g., tiktoken).
   *
   * @example
   * ```typescript
   * class MyPlugin extends BasePluginNextGen {
   *   protected estimator = myCustomTiktokenEstimator;
   * }
   * ```
   */
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
   *
   * Returns the cached value from the last `updateTokenCache()` call.
   * Returns 0 if cache is null (content hasn't been calculated yet).
   *
   * **Note:** This is synchronous but `getContent()` is async. Plugins
   * should call `updateTokenCache()` in their `getContent()` implementation
   * to keep the cache accurate.
   *
   * @returns Cached token count (0 if cache not set)
   */
  getTokenSize(): number {
    if (this._contentTokenCache === null) {
      // Cache not set - return 0
      // Subclasses should call updateTokenCache() in getContent()
      return 0;
    }
    return this._contentTokenCache;
  }

  /**
   * Get token size of instructions (cached after first call).
   *
   * Instructions are static, so this is computed once and cached permanently.
   * The cache is never invalidated since instructions don't change.
   *
   * @returns Token count for instructions (0 if no instructions)
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
   * Invalidate the content token cache.
   *
   * Call this when plugin state changes in a way that affects content size.
   * The next call to `getTokenSize()` will return 0 until `updateTokenCache()`
   * is called (typically in `getContent()`).
   *
   * @example
   * ```typescript
   * delete(key: string): boolean {
   *   const deleted = this._entries.delete(key);
   *   if (deleted) {
   *     this.invalidateTokenCache();  // Content changed
   *   }
   *   return deleted;
   * }
   * ```
   */
  protected invalidateTokenCache(): void {
    this._contentTokenCache = null;
  }

  /**
   * Update the content token cache with a new value.
   *
   * Call this in `getContent()` after formatting content, passing the
   * estimated token count. This keeps budget calculations accurate.
   *
   * @param tokens - New token count to cache
   *
   * @example
   * ```typescript
   * async getContent(): Promise<string | null> {
   *   const content = this.formatEntries();
   *   this.updateTokenCache(this.estimator.estimateTokens(content));
   *   return content;
   * }
   * ```
   */
  protected updateTokenCache(tokens: number): void {
    this._contentTokenCache = tokens;
  }

  /**
   * Recalculate and cache token size from current content.
   *
   * Convenience method that calls `getContent()`, estimates tokens,
   * and updates the cache. Use this when you need to immediately
   * refresh the cache after a state change.
   *
   * @returns Calculated token count
   *
   * @example
   * ```typescript
   * async store(key: string, value: unknown): Promise<void> {
   *   this._entries.set(key, value);
   *   await this.recalculateTokenCache();  // Refresh immediately
   * }
   * ```
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
   * Default: not compactable.
   *
   * Override to return `true` if your plugin can reduce its content size
   * when context is tight. Also implement `compact()` to handle the actual
   * compaction logic.
   *
   * @returns false by default
   */
  isCompactable(): boolean {
    return false;
  }

  /**
   * Default: no compaction (returns 0).
   *
   * Override to implement compaction logic. Should attempt to free
   * approximately `targetTokensToFree` tokens. Remember to call
   * `invalidateTokenCache()` after modifying content.
   *
   * @param _targetTokensToFree - Approximate tokens to free (best effort)
   * @returns 0 by default (no tokens freed)
   *
   * @example
   * ```typescript
   * async compact(targetTokensToFree: number): Promise<number> {
   *   let freed = 0;
   *   // Remove entries by priority until target reached
   *   for (const [key, entry] of this.sortedByPriority()) {
   *     if (entry.priority === 'critical') continue;
   *     if (freed >= targetTokensToFree) break;
   *     freed += entry.tokens;
   *     this._entries.delete(key);
   *   }
   *   this.invalidateTokenCache();
   *   return freed;
   * }
   * ```
   */
  async compact(_targetTokensToFree: number): Promise<number> {
    return 0;
  }

  /**
   * Default: no tools (returns empty array).
   *
   * Override to provide plugin-specific tools. Tools are auto-registered
   * with ToolManager when the plugin is added to the context.
   *
   * Use a consistent naming convention: `<prefix>_<action>`
   * - `memory_store`, `memory_retrieve`, `memory_delete`
   * - `context_set`, `context_delete`, `context_list`
   *
   * @returns Empty array by default
   */
  getTools(): ToolFunction[] {
    return [];
  }

  /**
   * Default: no-op cleanup.
   *
   * Override if your plugin has resources to release (file handles,
   * timers, connections, etc.). Called when context is destroyed.
   */
  destroy(): void {
    // No-op by default
  }

  /**
   * Default: returns empty object.
   *
   * Override to serialize plugin state for session persistence.
   * Return a JSON-serializable object. Consider including a version
   * number for future migration support.
   *
   * @returns Empty object by default
   *
   * @example
   * ```typescript
   * getState(): unknown {
   *   return {
   *     version: 1,
   *     entries: [...this._entries].map(([k, v]) => ({ key: k, ...v })),
   *   };
   * }
   * ```
   */
  getState(): unknown {
    return {};
  }

  /**
   * Default: no-op (ignores state).
   *
   * Override to restore plugin state from saved session. The state
   * comes from a previous `getState()` call.
   *
   * **IMPORTANT:** Call `invalidateTokenCache()` after restoring state
   * to ensure token counts are recalculated on next `getContent()` call.
   *
   * @param _state - Previously serialized state from getState()
   *
   * @example
   * ```typescript
   * restoreState(state: unknown): void {
   *   const s = state as { entries: Array<{ key: string; value: unknown }> };
   *   this._entries.clear();
   *   for (const entry of s.entries || []) {
   *     this._entries.set(entry.key, entry);
   *   }
   *   this.invalidateTokenCache();  // Don't forget this!
   * }
   * ```
   */
  restoreState(_state: unknown): void {
    // No-op by default
  }
}
