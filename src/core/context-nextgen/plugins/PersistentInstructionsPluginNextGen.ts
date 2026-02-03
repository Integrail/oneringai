/**
 * PersistentInstructionsPluginNextGen - Disk-persisted instructions for NextGen context
 *
 * Stores custom instructions that persist across sessions on disk.
 * These are NEVER compacted - always included in context.
 *
 * Use cases:
 * - Agent personality/behavior customization
 * - User-specific preferences
 * - Accumulated knowledge/rules
 * - Custom tool usage guidelines
 *
 * Storage: ~/.oneringai/agents/<agentId>/custom_instructions.md
 */

import type { IContextPluginNextGen, ITokenEstimator } from '../types.js';
import type { ToolFunction } from '../../../domain/entities/Tool.js';
import type { IPersistentInstructionsStorage } from '../../../domain/interfaces/IPersistentInstructionsStorage.js';
import { FilePersistentInstructionsStorage } from '../../../infrastructure/storage/FilePersistentInstructionsStorage.js';
import { simpleTokenEstimator } from '../BasePluginNextGen.js';

// ============================================================================
// Types
// ============================================================================

export interface PersistentInstructionsConfig {
  /** Agent ID - used to determine storage path (REQUIRED) */
  agentId: string;
  /** Custom storage implementation (default: FilePersistentInstructionsStorage) */
  storage?: IPersistentInstructionsStorage;
  /** Maximum instructions length in characters (default: 50000) */
  maxLength?: number;
}

export interface SerializedPersistentInstructionsState {
  content: string | null;
  agentId: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_LENGTH = 50000;

// ============================================================================
// Instructions
// ============================================================================

const PERSISTENT_INSTRUCTIONS_INSTRUCTIONS = `Persistent Instructions are stored on disk and survive across sessions.

**To modify:**
- \`instructions_set(content)\`: Replace all instructions
- \`instructions_append(section)\`: Add a section
- \`instructions_clear(confirm: true)\`: Remove all (destructive!)

**Use for:** Agent personality, user preferences, learned rules, guidelines.`;

// ============================================================================
// Tool Definitions
// ============================================================================

const instructionsSetDefinition = {
  type: 'function' as const,
  function: {
    name: 'instructions_set',
    description: `Set or replace all custom instructions. Persists across sessions.
IMPORTANT: This replaces ALL existing instructions.`,
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Full instructions content (markdown supported)',
        },
      },
      required: ['content'],
    },
  },
};

const instructionsAppendDefinition = {
  type: 'function' as const,
  function: {
    name: 'instructions_append',
    description: 'Append a section to existing instructions.',
    parameters: {
      type: 'object',
      properties: {
        section: {
          type: 'string',
          description: 'Section to append (will add newlines before)',
        },
      },
      required: ['section'],
    },
  },
};

const instructionsGetDefinition = {
  type: 'function' as const,
  function: {
    name: 'instructions_get',
    description: 'Get current custom instructions.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const instructionsClearDefinition = {
  type: 'function' as const,
  function: {
    name: 'instructions_clear',
    description: 'Clear all custom instructions (DESTRUCTIVE). Requires confirmation.',
    parameters: {
      type: 'object',
      properties: {
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm deletion',
        },
      },
      required: ['confirm'],
    },
  },
};

// ============================================================================
// Plugin Implementation
// ============================================================================

export class PersistentInstructionsPluginNextGen implements IContextPluginNextGen {
  readonly name = 'persistent_instructions';

  private _content: string | null = null;
  private _initialized = false;
  private _destroyed = false;

  private readonly storage: IPersistentInstructionsStorage;
  private readonly maxLength: number;
  private readonly agentId: string;
  private readonly estimator: ITokenEstimator = simpleTokenEstimator;

  private _tokenCache: number | null = null;
  private _instructionsTokenCache: number | null = null;

  constructor(config: PersistentInstructionsConfig) {
    if (!config.agentId) {
      throw new Error('PersistentInstructionsPluginNextGen requires agentId');
    }

    this.agentId = config.agentId;
    this.maxLength = config.maxLength ?? DEFAULT_MAX_LENGTH;
    this.storage = config.storage ?? new FilePersistentInstructionsStorage({
      agentId: config.agentId,
    });
  }

  // ============================================================================
  // IContextPluginNextGen Implementation
  // ============================================================================

  getInstructions(): string {
    return PERSISTENT_INSTRUCTIONS_INSTRUCTIONS;
  }

  async getContent(): Promise<string | null> {
    await this.ensureInitialized();

    if (!this._content) {
      return null;
    }

    this._tokenCache = this.estimator.estimateTokens(this._content);
    return this._content;
  }

  getContents(): string | null {
    return this._content;
  }

  getTokenSize(): number {
    return this._tokenCache ?? 0;
  }

  getInstructionsTokenSize(): number {
    if (this._instructionsTokenCache === null) {
      this._instructionsTokenCache = this.estimator.estimateTokens(PERSISTENT_INSTRUCTIONS_INSTRUCTIONS);
    }
    return this._instructionsTokenCache;
  }

  isCompactable(): boolean {
    // Persistent instructions are NEVER compacted
    return false;
  }

  async compact(_targetTokensToFree: number): Promise<number> {
    // Never compacted
    return 0;
  }

  getTools(): ToolFunction[] {
    return [
      this.createInstructionsSetTool(),
      this.createInstructionsAppendTool(),
      this.createInstructionsGetTool(),
      this.createInstructionsClearTool(),
    ];
  }

  destroy(): void {
    if (this._destroyed) return;
    this._content = null;
    this._destroyed = true;
    this._tokenCache = null;
  }

  getState(): SerializedPersistentInstructionsState {
    return {
      content: this._content,
      agentId: this.agentId,
    };
  }

  restoreState(state: unknown): void {
    const s = state as SerializedPersistentInstructionsState;
    if (!s) return;

    this._content = s.content;
    this._initialized = true;
    this._tokenCache = null;
  }

  // ============================================================================
  // Content Management
  // ============================================================================

  /**
   * Initialize by loading from storage (called lazily)
   */
  async initialize(): Promise<void> {
    if (this._initialized || this._destroyed) return;

    try {
      this._content = await this.storage.load();
      this._initialized = true;
    } catch (error) {
      console.warn(`Failed to load persistent instructions for agent '${this.agentId}':`, error);
      this._content = null;
      this._initialized = true;
    }
    this._tokenCache = null;
  }

  /**
   * Set entire instructions content (replaces existing)
   */
  async set(content: string): Promise<boolean> {
    this.assertNotDestroyed();

    if (content.length > this.maxLength) {
      return false;
    }

    this._content = content.trim() || null;

    if (this._content) {
      await this.storage.save(this._content);
    } else {
      await this.storage.delete();
    }

    this._tokenCache = null;
    return true;
  }

  /**
   * Append a section to existing instructions
   */
  async append(section: string): Promise<boolean> {
    this.assertNotDestroyed();
    await this.ensureInitialized();

    const trimmedSection = section.trim();
    if (!trimmedSection) return true;

    const currentContent = this._content || '';
    const newContent = currentContent
      ? `${currentContent}\n\n${trimmedSection}`
      : trimmedSection;

    if (newContent.length > this.maxLength) {
      return false;
    }

    this._content = newContent;
    await this.storage.save(this._content);
    this._tokenCache = null;
    return true;
  }

  /**
   * Get current content
   */
  async get(): Promise<string | null> {
    this.assertNotDestroyed();
    await this.ensureInitialized();
    return this._content;
  }

  /**
   * Clear all instructions
   */
  async clear(): Promise<void> {
    this.assertNotDestroyed();
    this._content = null;
    await this.storage.delete();
    this._tokenCache = null;
  }

  /**
   * Check if initialized
   */
  get isInitialized(): boolean {
    return this._initialized;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async ensureInitialized(): Promise<void> {
    if (!this._initialized) {
      await this.initialize();
    }
  }

  private assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('PersistentInstructionsPluginNextGen is destroyed');
    }
  }

  // ============================================================================
  // Tool Factories
  // ============================================================================

  private createInstructionsSetTool(): ToolFunction {
    return {
      definition: instructionsSetDefinition,
      execute: async (args: Record<string, unknown>) => {
        const content = args.content as string;

        if (!content || content.trim().length === 0) {
          return { error: 'Content cannot be empty. Use instructions_clear to remove.' };
        }

        const success = await this.set(content);
        if (!success) {
          return { error: `Content exceeds maximum length (${this.maxLength} chars)` };
        }

        return {
          success: true,
          message: 'Custom instructions updated',
          length: content.length,
        };
      },
      permission: { scope: 'always', riskLevel: 'low' },
      describeCall: () => 'set instructions',
    };
  }

  private createInstructionsAppendTool(): ToolFunction {
    return {
      definition: instructionsAppendDefinition,
      execute: async (args: Record<string, unknown>) => {
        const section = args.section as string;

        if (!section || section.trim().length === 0) {
          return { error: 'Section cannot be empty' };
        }

        const success = await this.append(section);
        if (!success) {
          return { error: `Would exceed maximum length (${this.maxLength} chars)` };
        }

        return {
          success: true,
          message: 'Section appended to instructions',
          newLength: this._content?.length ?? 0,
        };
      },
      permission: { scope: 'always', riskLevel: 'low' },
      describeCall: () => 'append to instructions',
    };
  }

  private createInstructionsGetTool(): ToolFunction {
    return {
      definition: instructionsGetDefinition,
      execute: async () => {
        const content = await this.get();
        return {
          hasContent: content !== null,
          content: content ?? '(no custom instructions set)',
          length: content?.length ?? 0,
          agentId: this.agentId,
        };
      },
      permission: { scope: 'always', riskLevel: 'low' },
      describeCall: () => 'get instructions',
    };
  }

  private createInstructionsClearTool(): ToolFunction {
    return {
      definition: instructionsClearDefinition,
      execute: async (args: Record<string, unknown>) => {
        if (args.confirm !== true) {
          return { error: 'Must pass confirm: true to clear instructions' };
        }

        await this.clear();
        return {
          success: true,
          message: 'Custom instructions cleared',
        };
      },
      permission: { scope: 'once', riskLevel: 'medium' },
      describeCall: () => 'clear instructions',
    };
  }
}
