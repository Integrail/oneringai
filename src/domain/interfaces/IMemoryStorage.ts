/**
 * Memory storage interface for working memory persistence.
 *
 * Implement this interface to provide custom persistence:
 * - Redis for distributed agents
 * - Database for durability
 * - File system for simple persistence
 *
 * Default implementation: InMemoryStorage (no persistence)
 */

import { MemoryEntry, MemoryScope } from '../entities/Memory.js';

export interface IMemoryStorage {
  /**
   * Get entry by key
   */
  get(key: string): Promise<MemoryEntry | undefined>;

  /**
   * Set/update entry
   */
  set(key: string, entry: MemoryEntry): Promise<void>;

  /**
   * Delete entry
   */
  delete(key: string): Promise<void>;

  /**
   * Check if key exists
   */
  has(key: string): Promise<boolean>;

  /**
   * Get all entries
   */
  getAll(): Promise<MemoryEntry[]>;

  /**
   * Get entries by scope
   */
  getByScope(scope: MemoryScope): Promise<MemoryEntry[]>;

  /**
   * Clear all entries with given scope
   */
  clearScope(scope: MemoryScope): Promise<void>;

  /**
   * Clear everything
   */
  clear(): Promise<void>;

  /**
   * Get total size in bytes
   */
  getTotalSize(): Promise<number>;
}
