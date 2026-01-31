/**
 * PersistentInstructionsPlugin - Store agent-level custom instructions in files
 *
 * Unlike InContextMemory (volatile key-value pairs), this plugin stores
 * INSTRUCTIONS that persist across sessions in files on disk.
 *
 * Use cases:
 * - Agent personality/behavior customization
 * - User-specific preferences
 * - Accumulated knowledge/rules
 * - Custom tool usage guidelines
 *
 * Storage: ~/.oneringai/agents/<agentId>/custom_instructions.md
 *
 * Key Behaviors:
 * - Loaded automatically when feature is enabled
 * - Never compacted (priority 0)
 * - Session serialization tracks dirty state
 */

import { BaseContextPlugin } from './IContextPlugin.js';
import type { IContextComponent, ITokenEstimator } from '../types.js';
import type { IPersistentInstructionsStorage } from '../../../domain/interfaces/IPersistentInstructionsStorage.js';
import { FilePersistentInstructionsStorage } from '../../../infrastructure/storage/FilePersistentInstructionsStorage.js';

/**
 * Configuration for PersistentInstructionsPlugin
 */
export interface PersistentInstructionsConfig {
  /** Agent ID - used to determine storage path */
  agentId: string;
  /** Custom storage implementation (default: FilePersistentInstructionsStorage) */
  storage?: IPersistentInstructionsStorage;
  /** Maximum instructions length in characters (default: 50000) */
  maxLength?: number;
}

/**
 * Serialized state for session persistence
 */
export interface SerializedPersistentInstructionsState {
  content: string | null;
  dirty: boolean;
  agentId: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  maxLength: 50000,
};

/**
 * Build the context explanation that appears before the instructions
 */
function buildContextExplanation(path: string): string {
  return `## Custom Instructions

These are your persistent instructions that apply across all sessions.
They are stored on disk and automatically loaded when you start.

**To modify:** Use \`instructions_set\` (replace all), \`instructions_append\` (add section), or \`instructions_clear\` (remove all).
**Storage path:** ${path}

---
`;
}

/**
 * PersistentInstructionsPlugin - Persists custom instructions across sessions
 *
 * This plugin manages custom instructions that:
 * - Are stored on disk (survive process restarts)
 * - Can be modified by the LLM during execution
 * - Are never compacted (always included in context)
 * - Support append operations for incremental updates
 */
export class PersistentInstructionsPlugin extends BaseContextPlugin {
  readonly name = 'persistent_instructions';
  readonly priority = 0; // Never compact
  readonly compactable = false;

  private _content: string | null = null;
  private _dirty = false;
  private _initialized = false;
  private _destroyed = false;

  private readonly storage: IPersistentInstructionsStorage;
  private readonly maxLength: number;
  private readonly agentId: string;

  /**
   * Create a PersistentInstructionsPlugin
   *
   * @param config - Configuration options (agentId is required)
   */
  constructor(config: PersistentInstructionsConfig) {
    super();
    this.agentId = config.agentId;
    this.maxLength = config.maxLength ?? DEFAULT_CONFIG.maxLength;

    // Use provided storage or create default file storage
    this.storage = config.storage ?? new FilePersistentInstructionsStorage({
      agentId: config.agentId,
    });
  }

  /**
   * Check if plugin is destroyed
   */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Check if plugin has been initialized (loaded from disk)
   */
  get isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Check if content has been modified since last save
   */
  get isDirty(): boolean {
    return this._dirty;
  }

  // ============ Initialization ============

  /**
   * Initialize by loading instructions from storage
   * Called lazily on first getComponent() call
   */
  async initialize(): Promise<void> {
    if (this._initialized || this._destroyed) {
      return;
    }

    try {
      this._content = await this.storage.load();
      this._initialized = true;
      this._dirty = false;
    } catch (error) {
      // Log but don't fail - treat as no instructions
      console.warn(`Failed to load persistent instructions for agent '${this.agentId}':`, error);
      this._content = null;
      this._initialized = true;
    }
  }

  // ============ Content Management ============

  /**
   * Set the entire instructions content (replaces existing)
   *
   * @param content - New instructions content
   * @returns true if set successfully, false if content exceeds max length
   */
  async set(content: string): Promise<boolean> {
    this.assertNotDestroyed();

    if (content.length > this.maxLength) {
      return false;
    }

    this._content = content.trim() || null;
    this._dirty = true;

    // Save to disk
    if (this._content) {
      await this.storage.save(this._content);
    } else {
      await this.storage.delete();
    }

    this._dirty = false;
    return true;
  }

  /**
   * Append a section to existing instructions
   *
   * @param section - Section to append (will add newlines before)
   * @returns true if appended successfully, false if would exceed max length
   */
  async append(section: string): Promise<boolean> {
    this.assertNotDestroyed();

    const trimmedSection = section.trim();
    if (!trimmedSection) {
      return true; // Nothing to append
    }

    const currentContent = this._content || '';
    const newContent = currentContent
      ? `${currentContent}\n\n${trimmedSection}`
      : trimmedSection;

    if (newContent.length > this.maxLength) {
      return false;
    }

    this._content = newContent;
    this._dirty = true;

    // Save to disk
    await this.storage.save(this._content);
    this._dirty = false;

    return true;
  }

  /**
   * Get current instructions content
   *
   * @returns Instructions content, or null if none
   */
  get(): string | null {
    this.assertNotDestroyed();
    return this._content;
  }

  /**
   * Check if instructions exist
   */
  has(): boolean {
    this.assertNotDestroyed();
    return this._content !== null && this._content.length > 0;
  }

  /**
   * Clear all instructions
   */
  async clear(): Promise<void> {
    this.assertNotDestroyed();

    this._content = null;
    this._dirty = true;

    await this.storage.delete();
    this._dirty = false;
  }

  /**
   * Get storage path (for display/debugging)
   */
  getPath(): string {
    return this.storage.getPath();
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Get current content length
   */
  getLength(): number {
    return this._content?.length ?? 0;
  }

  /**
   * Get maximum allowed content length
   */
  getMaxLength(): number {
    return this.maxLength;
  }

  // ============ IContextPlugin Implementation ============

  /**
   * Get the context component for this plugin
   * Performs lazy initialization on first call
   */
  async getComponent(): Promise<IContextComponent | null> {
    this.assertNotDestroyed();

    // Lazy initialization
    if (!this._initialized) {
      await this.initialize();
    }

    if (!this._content) {
      return null;
    }

    // Build full content with explanation header
    const explanation = buildContextExplanation(this.storage.getPath());
    const content = `${explanation}\n${this._content}`;

    return {
      name: this.name,
      content,
      priority: this.priority,
      compactable: this.compactable,
      metadata: {
        agentId: this.agentId,
        length: this._content.length,
        path: this.storage.getPath(),
      },
    };
  }

  /**
   * Compact - not applicable (compactable is false)
   */
  override async compact(_targetTokens: number, _estimator: ITokenEstimator): Promise<number> {
    // Never compact instructions - they are critical
    return 0;
  }

  /**
   * Get serialized state for session persistence
   */
  override getState(): SerializedPersistentInstructionsState {
    return {
      content: this._content,
      dirty: this._dirty,
      agentId: this.agentId,
    };
  }

  /**
   * Restore state from serialization
   * Note: This restores in-memory state, not disk state
   */
  override restoreState(state: unknown): void {
    this.assertNotDestroyed();

    if (!state || typeof state !== 'object') {
      return;
    }

    const typedState = state as SerializedPersistentInstructionsState;

    if ('content' in typedState) {
      this._content = typedState.content;
    }
    if ('dirty' in typedState) {
      this._dirty = typedState.dirty;
    }

    // Mark as initialized since we're restoring from session
    this._initialized = true;
  }

  /**
   * Clean up resources
   */
  override destroy(): void {
    this._content = null;
    this._initialized = false;
    this._destroyed = true;
  }

  // ============ Private Methods ============

  /**
   * Assert that the plugin hasn't been destroyed
   */
  private assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('PersistentInstructionsPlugin has been destroyed');
    }
  }
}
