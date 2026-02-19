/**
 * ICustomToolStorage - Storage interface for custom tool definitions
 *
 * Provides persistence operations for user-created custom tools.
 * Follows Clean Architecture - interface in domain layer,
 * implementations in infrastructure layer.
 */

import type { CustomToolDefinition, CustomToolSummary } from '../entities/CustomToolDefinition.js';

/**
 * Options for listing custom tools
 */
export interface CustomToolListOptions {
  /** Filter by tags (any match) */
  tags?: string[];
  /** Filter by category */
  category?: string;
  /** Search string (case-insensitive substring match on name + description) */
  search?: string;
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Storage interface for custom tool definitions
 *
 * Custom tools support optional per-user isolation for multi-tenant scenarios.
 * When userId is not provided, defaults to 'default' user.
 *
 * Implementations:
 * - FileCustomToolStorage: File-based storage at ~/.oneringai/users/<userId>/custom-tools/
 */
export interface ICustomToolStorage {
  /**
   * Save a custom tool definition
   * @param userId - Optional user ID for isolation (defaults to 'default')
   * @param definition - Tool definition to save
   */
  save(userId: string | undefined, definition: CustomToolDefinition): Promise<void>;

  /**
   * Load a custom tool definition by name
   * @param userId - Optional user ID for isolation (defaults to 'default')
   * @param name - Tool name
   */
  load(userId: string | undefined, name: string): Promise<CustomToolDefinition | null>;

  /**
   * Delete a custom tool definition by name
   * @param userId - Optional user ID for isolation (defaults to 'default')
   * @param name - Tool name
   */
  delete(userId: string | undefined, name: string): Promise<void>;

  /**
   * Check if a custom tool exists
   * @param userId - Optional user ID for isolation (defaults to 'default')
   * @param name - Tool name
   */
  exists(userId: string | undefined, name: string): Promise<boolean>;

  /**
   * List custom tools (summaries only)
   * @param userId - Optional user ID for isolation (defaults to 'default')
   * @param options - Filtering and pagination options
   */
  list(userId: string | undefined, options?: CustomToolListOptions): Promise<CustomToolSummary[]>;

  /**
   * Update metadata without loading full definition
   * @param userId - Optional user ID for isolation (defaults to 'default')
   * @param name - Tool name
   * @param metadata - Metadata to update
   */
  updateMetadata?(userId: string | undefined, name: string, metadata: Record<string, unknown>): Promise<void>;

  /**
   * Get the storage path/location for a specific user (for display/debugging)
   * @param userId - Optional user ID for isolation (defaults to 'default')
   */
  getPath(userId: string | undefined): string;
}
