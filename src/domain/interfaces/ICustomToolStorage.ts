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
 * Custom tools are stored per-user to provide isolation in multi-tenant scenarios.
 *
 * Implementations:
 * - FileCustomToolStorage: File-based storage at ~/.oneringai/users/<userId>/custom-tools/
 */
export interface ICustomToolStorage {
  /**
   * Save a custom tool definition
   * @param userId - User ID for isolation
   * @param definition - Tool definition to save
   */
  save(userId: string, definition: CustomToolDefinition): Promise<void>;

  /**
   * Load a custom tool definition by name
   * @param userId - User ID for isolation
   * @param name - Tool name
   */
  load(userId: string, name: string): Promise<CustomToolDefinition | null>;

  /**
   * Delete a custom tool definition by name
   * @param userId - User ID for isolation
   * @param name - Tool name
   */
  delete(userId: string, name: string): Promise<void>;

  /**
   * Check if a custom tool exists
   * @param userId - User ID for isolation
   * @param name - Tool name
   */
  exists(userId: string, name: string): Promise<boolean>;

  /**
   * List custom tools (summaries only)
   * @param userId - User ID for isolation
   * @param options - Filtering and pagination options
   */
  list(userId: string, options?: CustomToolListOptions): Promise<CustomToolSummary[]>;

  /**
   * Update metadata without loading full definition
   * @param userId - User ID for isolation
   * @param name - Tool name
   * @param metadata - Metadata to update
   */
  updateMetadata?(userId: string, name: string, metadata: Record<string, unknown>): Promise<void>;

  /**
   * Get the storage path/location for a specific user (for display/debugging)
   * @param userId - User ID for isolation
   */
  getPath(userId: string): string;
}
