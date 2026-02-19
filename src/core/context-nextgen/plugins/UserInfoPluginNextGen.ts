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
 * - UserId passed at construction time from AgentContextNextGen._userId
 * - User data IS injected into context via getContent() (entries rendered as markdown)
 * - In-memory cache with lazy loading + write-through to storage
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
  /** User ID for storage isolation (resolved from AgentContextNextGen._userId) */
  userId?: string;
}

export interface SerializedUserInfoState {
  version: 1;
  entries: UserInfoEntry[];
  userId?: string;
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
User info is automatically shown in context — no need to call user_info_get every turn.

**To manage:**
- \`user_info_set(key, value, description?)\`: Store/update user information
- \`user_info_get(key?)\`: Retrieve one entry by key, or all entries if no key
- \`user_info_remove(key)\`: Remove a specific entry
- \`user_info_clear(confirm: true)\`: Remove all entries (destructive!)

**Use for:** User preferences, context, metadata (theme, language, timezone, role, etc.) It is also perfectly fine to search the web and other external sources for information about the user and then store it in user info for future use.

**Important:** Do not store sensitive information (passwords, tokens, PII) in user info. It is not encrypted and may be accessible to other parts of the system. Always follow best practices for security.

**Rules after each user message:** If the user provides new information about themselves, update user info accordingly. If they ask to change or remove existing information, do that as well. Always keep user info up to date with the latest information provided by the user. Learn about the user proactively!`;

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

/**
 * Format a value for context rendering
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

// ============================================================================
// Plugin Implementation
// ============================================================================

export class UserInfoPluginNextGen implements IContextPluginNextGen {
  readonly name = 'user_info';

  private _destroyed = false;
  private _storage: IUserInfoStorage | null = null;

  /** In-memory cache of entries */
  private _entries: Map<string, UserInfoEntry> = new Map();
  /** Whether entries have been loaded from storage */
  private _initialized = false;

  private readonly maxTotalSize: number;
  private readonly maxEntries: number;
  private readonly estimator: ITokenEstimator = simpleTokenEstimator;
  private readonly explicitStorage?: IUserInfoStorage;

  /** UserId for getContent() and lazy initialization */
  readonly userId: string | undefined;

  private _tokenCache: number | null = null;
  private _instructionsTokenCache: number | null = null;

  constructor(config?: UserInfoPluginConfig) {
    this.maxTotalSize = config?.maxTotalSize ?? DEFAULT_MAX_TOTAL_SIZE;
    this.maxEntries = config?.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.explicitStorage = config?.storage;
    this.userId = config?.userId;
  }

  // ============================================================================
  // IContextPluginNextGen Implementation
  // ============================================================================

  getInstructions(): string {
    return USER_INFO_INSTRUCTIONS;
  }

  async getContent(): Promise<string | null> {
    await this.ensureInitialized();

    if (this._entries.size === 0) {
      this._tokenCache = 0;
      return null;
    }

    const rendered = this.renderContent();
    this._tokenCache = this.estimator.estimateTokens(rendered);
    return rendered;
  }

  getContents(): Map<string, UserInfoEntry> {
    return new Map(this._entries);
  }

  getTokenSize(): number {
    return this._tokenCache ?? 0;
  }

  getInstructionsTokenSize(): number {
    if (this._instructionsTokenCache === null) {
      this._instructionsTokenCache = this.estimator.estimateTokens(USER_INFO_INSTRUCTIONS);
    }
    return this._instructionsTokenCache;
  }

  isCompactable(): boolean {
    // User info is never compacted
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
    this._entries.clear();
    this._destroyed = true;
    this._tokenCache = null;
  }

  getState(): SerializedUserInfoState {
    return {
      version: 1,
      entries: Array.from(this._entries.values()),
      userId: this.userId,
    };
  }

  restoreState(state: unknown): void {
    if (!state || typeof state !== 'object') return;

    const s = state as Record<string, unknown>;

    if ('version' in s && s.version === 1 && Array.isArray(s.entries)) {
      this._entries.clear();
      for (const entry of s.entries as UserInfoEntry[]) {
        this._entries.set(entry.id, entry);
      }
      this._initialized = true;
      this._tokenCache = null;
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Check if initialized
   */
  get isInitialized(): boolean {
    return this._initialized;
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
   * Lazy load entries from storage
   */
  private async ensureInitialized(): Promise<void> {
    if (this._initialized || this._destroyed) return;

    try {
      const storage = this.resolveStorage();
      const entries = await storage.load(this.userId);
      this._entries.clear();
      if (entries) {
        for (const entry of entries) {
          this._entries.set(entry.id, entry);
        }
      }
      this._initialized = true;
    } catch (error) {
      console.warn(`Failed to load user info for userId '${this.userId ?? 'default'}':`, error);
      this._entries.clear();
      this._initialized = true;
    }
    this._tokenCache = null;
  }

  /**
   * Render entries as markdown for context injection
   */
  private renderContent(): string {
    const sorted = Array.from(this._entries.values()).sort((a, b) => a.createdAt - b.createdAt);
    return sorted
      .map(entry => `### ${entry.id}\n${formatValue(entry.value)}`)
      .join('\n\n');
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

  /**
   * Persist current entries to storage
   */
  private async persistToStorage(userId: string | undefined): Promise<void> {
    const storage = this.resolveStorage();
    if (this._entries.size === 0) {
      await storage.delete(userId);
    } else {
      await storage.save(userId, Array.from(this._entries.values()));
    }
  }

  // ============================================================================
  // Tool Factories
  // ============================================================================

  private createUserInfoSetTool(): ToolFunction {
    return {
      definition: userInfoSetDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        this.assertNotDestroyed();
        await this.ensureInitialized();

        const userId = context?.userId ?? this.userId;

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

        // Check maxEntries (new entry only)
        if (!this._entries.has(trimmedKey) && this._entries.size >= this.maxEntries) {
          return { error: `Maximum number of entries reached (${this.maxEntries})` };
        }

        // Calculate sizes
        const valueSize = calculateValueSize(value);
        let currentTotal = 0;
        for (const e of this._entries.values()) {
          currentTotal += calculateValueSize(e.value);
        }
        const existingSize = this._entries.has(trimmedKey) ? calculateValueSize(this._entries.get(trimmedKey)!.value) : 0;
        const newTotal = currentTotal - existingSize + valueSize;

        if (newTotal > this.maxTotalSize) {
          return { error: `Total size would exceed maximum (${this.maxTotalSize} bytes)` };
        }

        // Create or update entry
        const now = Date.now();
        const existing = this._entries.get(trimmedKey);
        const entry: UserInfoEntry = {
          id: trimmedKey,
          value,
          valueType: getValueType(value),
          description,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };

        this._entries.set(trimmedKey, entry);
        this._tokenCache = null;

        // Write-through to storage
        await this.persistToStorage(userId);

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
      execute: async (args: Record<string, unknown>, _context?: ToolContext) => {
        this.assertNotDestroyed();
        await this.ensureInitialized();

        const key = args.key as string | undefined;

        if (this._entries.size === 0) {
          return { error: 'User info not found' };
        }

        // Get specific entry
        if (key !== undefined) {
          const trimmedKey = key.trim();
          const entry = this._entries.get(trimmedKey);

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
        const entries = Array.from(this._entries.values());
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
        await this.ensureInitialized();

        const userId = context?.userId ?? this.userId;

        const key = args.key as string;

        if (!key || typeof key !== 'string' || key.trim().length === 0) {
          return { error: 'Key is required' };
        }

        const trimmedKey = key.trim();

        if (!this._entries.has(trimmedKey)) {
          return { error: `User info '${trimmedKey}' not found` };
        }

        this._entries.delete(trimmedKey);
        this._tokenCache = null;

        // Write-through to storage
        await this.persistToStorage(userId);

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

        const userId = context?.userId ?? this.userId;

        if (args.confirm !== true) {
          return { error: 'Must pass confirm: true to clear user info' };
        }

        this._entries.clear();
        this._tokenCache = null;

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
