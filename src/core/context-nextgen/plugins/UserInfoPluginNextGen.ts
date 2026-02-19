/**
 * UserInfoPluginNextGen - User information storage plugin for NextGen context
 *
 * Stores key-value information about the current user (preferences, context, metadata).
 * Data is user-scoped, not agent-scoped - different agents share the same user data.
 *
 * Use cases:
 * - User preferences (theme, language, timezone)
 * - User context (location, role, permissions)
 * - User metadata (name, email, profile info)
 *
 * Storage: ~/.oneringai/users/<userId>/user_info.json
 *
 * Design:
 * - Plugin is STATELESS regarding userId
 * - UserId resolved at tool execution time from ToolContext.userId
 * - User data NOT injected into context (getContent returns null)
 * - Tools access current user's data only (no cross-user access)
 */

import type { IContextPluginNextGen, ITokenEstimator } from '../types.js';
import type { ToolFunction, ToolContext } from '../../../domain/entities/Tool.js';
import type { IUserInfoStorage, UserInfoEntry } from '../../../domain/interfaces/IUserInfoStorage.js';
import { FileUserInfoStorage } from '../../../infrastructure/storage/FileUserInfoStorage.js';
import { simpleTokenEstimator } from '../BasePluginNextGen.js';
import { StorageRegistry } from '../../StorageRegistry.js';
import type { StorageContext } from '../../StorageRegistry.js';

// ============================================================================
// Types
// ============================================================================

export type { UserInfoEntry } from '../../../domain/interfaces/IUserInfoStorage.js';

export interface UserInfoPluginConfig {
  /** Custom storage implementation (default: FileUserInfoStorage) */
  storage?: IUserInfoStorage;
  /** Maximum total size across all entries in bytes (default: 100000 / ~100KB) */
  maxTotalSize?: number;
  /** Maximum number of entries (default: 100) */
  maxEntries?: number;
}

export interface SerializedUserInfoState {
  version: 1;
  // Plugin is stateless - no state to serialize
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_TOTAL_SIZE = 100000; // ~100KB
const DEFAULT_MAX_ENTRIES = 100;
const KEY_MAX_LENGTH = 100;
const KEY_PATTERN = /^[a-zA-Z0-9_-]+$/;

// ============================================================================
// Instructions
// ============================================================================

const USER_INFO_INSTRUCTIONS = `User Info stores key-value information about the current user.
Data is user-specific and persists across sessions and agents.

**To manage:**
- \`user_info_set(key, value, description?)\`: Store/update user information
- \`user_info_get(key?)\`: Retrieve one entry by key, or all entries if no key
- \`user_info_remove(key)\`: Remove a specific entry
- \`user_info_clear(confirm: true)\`: Remove all entries (destructive!)

**Use for:** User preferences, context, metadata (theme, language, timezone, role, etc.)`;

// ============================================================================
// Tool Definitions
// ============================================================================

const userInfoSetDefinition = {
  type: 'function' as const,
  function: {
    name: 'user_info_set',
    description: `Store or update user information by key. Data persists across sessions.
If the key exists, it will be updated. If not, a new entry is created.`,
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Unique key for the information (alphanumeric, dash, underscore; max 100 chars)',
        },
        value: {
          description: 'Value to store (any JSON-serializable data: string, number, boolean, object, array)',
        },
        description: {
          type: 'string',
          description: 'Optional description for self-documentation',
        },
      },
      required: ['key', 'value'],
    },
  },
};

const userInfoGetDefinition = {
  type: 'function' as const,
  function: {
    name: 'user_info_get',
    description: 'Retrieve user information. If key is provided, returns that entry. Otherwise returns all entries.',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Key of the entry to retrieve (optional - omit to get all entries)',
        },
      },
      required: [],
    },
  },
};

const userInfoRemoveDefinition = {
  type: 'function' as const,
  function: {
    name: 'user_info_remove',
    description: 'Remove a specific user information entry by key.',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Key of the entry to remove',
        },
      },
      required: ['key'],
    },
  },
};

const userInfoClearDefinition = {
  type: 'function' as const,
  function: {
    name: 'user_info_clear',
    description: 'Clear all user information entries (DESTRUCTIVE). Requires confirmation.',
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
// Helper Functions
// ============================================================================

/**
 * Validate key format
 */
function validateKey(key: unknown): string | null {
  if (typeof key !== 'string') return 'Key must be a string';
  const trimmed = key.trim();
  if (trimmed.length === 0) return 'Key cannot be empty';
  if (trimmed.length > KEY_MAX_LENGTH) return `Key exceeds maximum length (${KEY_MAX_LENGTH} chars)`;
  if (!KEY_PATTERN.test(trimmed)) return 'Key must contain only alphanumeric characters, dashes, and underscores';
  return null;
}

/**
 * Determine the type of a value for display
 */
function getValueType(value: unknown): UserInfoEntry['valueType'] {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as UserInfoEntry['valueType'];
}

/**
 * Calculate size of a value in bytes (approximate)
 */
function calculateValueSize(value: unknown): number {
  const json = JSON.stringify(value);
  return Buffer.byteLength(json, 'utf-8');
}

/**
 * Build StorageContext from ToolContext
 */
function buildStorageContext(toolContext?: ToolContext): StorageContext | undefined {
  const global = StorageRegistry.getContext();
  if (global) return global;
  if (toolContext?.userId) return { userId: toolContext.userId };
  return undefined;
}

// ============================================================================
// Plugin Implementation
// ============================================================================

export class UserInfoPluginNextGen implements IContextPluginNextGen {
  readonly name = 'user_info';

  private _destroyed = false;
  private _storage: IUserInfoStorage | null = null;

  private readonly maxTotalSize: number;
  private readonly maxEntries: number;
  private readonly estimator: ITokenEstimator = simpleTokenEstimator;
  private readonly explicitStorage?: IUserInfoStorage;

  private _instructionsTokenCache: number | null = null;

  constructor(config?: UserInfoPluginConfig) {
    this.maxTotalSize = config?.maxTotalSize ?? DEFAULT_MAX_TOTAL_SIZE;
    this.maxEntries = config?.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.explicitStorage = config?.storage;
  }

  // ============================================================================
  // IContextPluginNextGen Implementation
  // ============================================================================

  getInstructions(): string {
    return USER_INFO_INSTRUCTIONS;
  }

  async getContent(): Promise<string | null> {
    // User info is NOT injected into context - tools provide read access
    return null;
  }

  getContents(): null {
    // No contents to return (stateless plugin)
    return null;
  }

  getTokenSize(): number {
    // No content injected into context
    return 0;
  }

  getInstructionsTokenSize(): number {
    if (this._instructionsTokenCache === null) {
      this._instructionsTokenCache = this.estimator.estimateTokens(USER_INFO_INSTRUCTIONS);
    }
    return this._instructionsTokenCache;
  }

  isCompactable(): boolean {
    // User info is never compacted (not in context)
    return false;
  }

  async compact(_targetTokensToFree: number): Promise<number> {
    // Never compacted
    return 0;
  }

  getTools(): ToolFunction[] {
    return [
      this.createUserInfoSetTool(),
      this.createUserInfoGetTool(),
      this.createUserInfoRemoveTool(),
      this.createUserInfoClearTool(),
    ];
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
  }

  getState(): SerializedUserInfoState {
    return {
      version: 1,
      // Plugin is stateless - no state to serialize
    };
  }

  restoreState(_state: unknown): void {
    // Plugin is stateless - nothing to restore
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('UserInfoPluginNextGen is destroyed');
    }
  }

  /**
   * Resolve storage instance (lazy singleton)
   */
  private resolveStorage(context?: ToolContext): IUserInfoStorage {
    if (this._storage) return this._storage;

    // 1. Explicit storage (constructor param)
    if (this.explicitStorage) {
      this._storage = this.explicitStorage;
      return this._storage;
    }

    // 2. Registry factory
    const factory = StorageRegistry.get('userInfo');
    if (factory) {
      this._storage = factory(buildStorageContext(context));
      return this._storage;
    }

    // 3. Default file storage
    this._storage = new FileUserInfoStorage();
    return this._storage;
  }

  // ============================================================================
  // Tool Factories
  // ============================================================================

  private createUserInfoSetTool(): ToolFunction {
    return {
      definition: userInfoSetDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        this.assertNotDestroyed();

        // Validate userId
        const userId = context?.userId;
        if (!userId) {
          return { error: 'userId required - set userId at agent creation or via StorageRegistry.setContext()' };
        }

        const key = args.key as string;
        const value = args.value;
        const description = args.description as string | undefined;

        // Validate key
        const keyError = validateKey(key);
        if (keyError) {
          return { error: keyError };
        }

        const trimmedKey = key.trim();

        // Validate value
        if (value === undefined) {
          return { error: 'Value cannot be undefined. Use null for explicit null value.' };
        }

        // Load current entries
        const storage = this.resolveStorage(context);
        const entries = await storage.load(userId) || [];
        const entriesMap = new Map(entries.map(e => [e.id, e]));

        // Check maxEntries (new entry only)
        if (!entriesMap.has(trimmedKey) && entriesMap.size >= this.maxEntries) {
          return { error: `Maximum number of entries reached (${this.maxEntries})` };
        }

        // Calculate sizes
        const valueSize = calculateValueSize(value);
        const currentTotal = entries.reduce((sum, e) => sum + calculateValueSize(e.value), 0);
        const existingSize = entriesMap.has(trimmedKey) ? calculateValueSize(entriesMap.get(trimmedKey)!.value) : 0;
        const newTotal = currentTotal - existingSize + valueSize;

        if (newTotal > this.maxTotalSize) {
          return { error: `Total size would exceed maximum (${this.maxTotalSize} bytes)` };
        }

        // Create or update entry
        const now = Date.now();
        const existing = entriesMap.get(trimmedKey);
        const entry: UserInfoEntry = {
          id: trimmedKey,
          value,
          valueType: getValueType(value),
          description,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };

        entriesMap.set(trimmedKey, entry);

        // Save to storage
        await storage.save(userId, Array.from(entriesMap.values()));

        return {
          success: true,
          message: existing ? `User info '${trimmedKey}' updated` : `User info '${trimmedKey}' added`,
          key: trimmedKey,
          valueType: entry.valueType,
          valueSize,
        };
      },
      permission: { scope: 'always', riskLevel: 'low' },
      describeCall: (args) => `set user info '${args.key}'`,
    };
  }

  private createUserInfoGetTool(): ToolFunction {
    return {
      definition: userInfoGetDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        this.assertNotDestroyed();

        // Validate userId
        const userId = context?.userId;
        if (!userId) {
          return { error: 'userId required - set userId at agent creation or via StorageRegistry.setContext()' };
        }

        const key = args.key as string | undefined;
        const storage = this.resolveStorage(context);
        const entries = await storage.load(userId);

        if (!entries || entries.length === 0) {
          return { error: 'User info not found' };
        }

        // Get specific entry
        if (key !== undefined) {
          const trimmedKey = key.trim();
          const entry = entries.find(e => e.id === trimmedKey);

          if (!entry) {
            return { error: `User info '${trimmedKey}' not found` };
          }

          return {
            key: entry.id,
            value: entry.value,
            valueType: entry.valueType,
            description: entry.description,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          };
        }

        // Get all entries
        return {
          count: entries.length,
          entries: entries.map(e => ({
            key: e.id,
            value: e.value,
            valueType: e.valueType,
            description: e.description,
            createdAt: e.createdAt,
            updatedAt: e.updatedAt,
          })),
        };
      },
      permission: { scope: 'always', riskLevel: 'low' },
      describeCall: (args) => args.key ? `get user info '${args.key}'` : 'get all user info',
    };
  }

  private createUserInfoRemoveTool(): ToolFunction {
    return {
      definition: userInfoRemoveDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        this.assertNotDestroyed();

        // Validate userId
        const userId = context?.userId;
        if (!userId) {
          return { error: 'userId required - set userId at agent creation or via StorageRegistry.setContext()' };
        }

        const key = args.key as string;

        if (!key || typeof key !== 'string' || key.trim().length === 0) {
          return { error: 'Key is required' };
        }

        const trimmedKey = key.trim();
        const storage = this.resolveStorage(context);
        const entries = await storage.load(userId);

        if (!entries || entries.length === 0) {
          return { error: `User info '${trimmedKey}' not found` };
        }

        const filtered = entries.filter(e => e.id !== trimmedKey);

        if (filtered.length === entries.length) {
          return { error: `User info '${trimmedKey}' not found` };
        }

        // Save or delete
        if (filtered.length === 0) {
          await storage.delete(userId);
        } else {
          await storage.save(userId, filtered);
        }

        return {
          success: true,
          message: `User info '${trimmedKey}' removed`,
          key: trimmedKey,
        };
      },
      permission: { scope: 'always', riskLevel: 'low' },
      describeCall: (args) => `remove user info '${args.key}'`,
    };
  }

  private createUserInfoClearTool(): ToolFunction {
    return {
      definition: userInfoClearDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        this.assertNotDestroyed();

        // Validate userId
        const userId = context?.userId;
        if (!userId) {
          return { error: 'userId required - set userId at agent creation or via StorageRegistry.setContext()' };
        }

        if (args.confirm !== true) {
          return { error: 'Must pass confirm: true to clear user info' };
        }

        const storage = this.resolveStorage(context);
        await storage.delete(userId);

        return {
          success: true,
          message: 'All user information cleared',
        };
      },
      permission: { scope: 'once', riskLevel: 'medium' },
      describeCall: () => 'clear user info',
    };
  }
}
