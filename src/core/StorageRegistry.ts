/**
 * StorageRegistry - Centralized storage backend registry
 *
 * Provides a single point of configuration for all storage backends
 * used across the library. Subsystems resolve their storage at execution
 * time (not construction time) via `resolve()`, which lazily creates
 * and caches a default when nothing has been configured.
 *
 * Storage types are split into two categories:
 * - **Global singletons**: customTools, media, agentDefinitions, connectorConfig, oauthTokens
 * - **Per-agent factories** (need agentId): sessions, persistentInstructions, workingMemory
 *
 * @example
 * ```typescript
 * import { StorageRegistry } from '@everworker/oneringai';
 *
 * // Configure all at once
 * StorageRegistry.configure({
 *   customTools: new MongoCustomToolStorage(),
 *   media: new S3MediaStorage(),
 *   sessions: (agentId) => new RedisContextStorage(agentId),
 * });
 *
 * // Or set individually
 * StorageRegistry.set('customTools', new MongoCustomToolStorage());
 * ```
 */

import type { ICustomToolStorage } from '../domain/interfaces/ICustomToolStorage.js';
import type { IMediaStorage } from '../domain/interfaces/IMediaStorage.js';
import type { IAgentDefinitionStorage } from '../domain/interfaces/IAgentDefinitionStorage.js';
import type { IConnectorConfigStorage } from '../domain/interfaces/IConnectorConfigStorage.js';
import type { ITokenStorage } from '../connectors/oauth/domain/ITokenStorage.js';
import type { IContextStorage } from '../domain/interfaces/IContextStorage.js';
import type { IPersistentInstructionsStorage } from '../domain/interfaces/IPersistentInstructionsStorage.js';
import type { IMemoryStorage } from '../domain/interfaces/IMemoryStorage.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Storage configuration map.
 *
 * Global singletons are stored directly.
 * Per-agent factories are functions that accept an agentId and return a storage instance.
 */
export interface StorageConfig {
  // Global singletons
  customTools: ICustomToolStorage;
  media: IMediaStorage;
  agentDefinitions: IAgentDefinitionStorage;
  connectorConfig: IConnectorConfigStorage;
  oauthTokens: ITokenStorage;

  // Per-agent factories
  sessions: (agentId: string) => IContextStorage;
  persistentInstructions: (agentId: string) => IPersistentInstructionsStorage;
  workingMemory: () => IMemoryStorage;
}

// ============================================================================
// StorageRegistry
// ============================================================================

export class StorageRegistry {
  /** Internal storage map */
  private static entries = new Map<string, unknown>();

  /**
   * Configure multiple storage backends at once.
   *
   * @example
   * ```typescript
   * StorageRegistry.configure({
   *   customTools: new MongoCustomToolStorage(),
   *   media: new S3MediaStorage(),
   *   sessions: (agentId) => new RedisContextStorage(agentId),
   * });
   * ```
   */
  static configure(config: Partial<StorageConfig>): void {
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined) {
        StorageRegistry.entries.set(key, value);
      }
    }
  }

  /**
   * Set a single storage backend.
   */
  static set<K extends keyof StorageConfig>(key: K, value: StorageConfig[K]): void {
    StorageRegistry.entries.set(key, value);
  }

  /**
   * Get a storage backend (or undefined if not configured).
   */
  static get<K extends keyof StorageConfig>(key: K): StorageConfig[K] | undefined {
    return StorageRegistry.entries.get(key) as StorageConfig[K] | undefined;
  }

  /**
   * Resolve a storage backend, lazily creating and caching a default if needed.
   *
   * If a value has been configured via `set()` or `configure()`, returns that.
   * Otherwise, calls `defaultFactory()`, caches the result, and returns it.
   */
  static resolve<K extends keyof StorageConfig>(key: K, defaultFactory: () => StorageConfig[K]): StorageConfig[K] {
    const existing = StorageRegistry.entries.get(key) as StorageConfig[K] | undefined;
    if (existing !== undefined) {
      return existing;
    }

    const value = defaultFactory();
    StorageRegistry.entries.set(key, value);
    return value;
  }

  /**
   * Check if a storage backend has been configured.
   */
  static has(key: keyof StorageConfig): boolean {
    return StorageRegistry.entries.has(key);
  }

  /**
   * Clear all configured storage backends.
   * Useful for testing.
   */
  static reset(): void {
    StorageRegistry.entries.clear();
  }
}
