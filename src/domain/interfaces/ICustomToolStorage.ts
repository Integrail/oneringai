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
 * Implementations:
 * - FileCustomToolStorage: File-based storage at ~/.oneringai/custom-tools/
 */
export interface ICustomToolStorage {
  /**
   * Save a custom tool definition
   */
  save(definition: CustomToolDefinition): Promise<void>;

  /**
   * Load a custom tool definition by name
   */
  load(name: string): Promise<CustomToolDefinition | null>;

  /**
   * Delete a custom tool definition by name
   */
  delete(name: string): Promise<void>;

  /**
   * Check if a custom tool exists
   */
  exists(name: string): Promise<boolean>;

  /**
   * List custom tools (summaries only)
   */
  list(options?: CustomToolListOptions): Promise<CustomToolSummary[]>;

  /**
   * Update metadata without loading full definition
   */
  updateMetadata?(name: string, metadata: Record<string, unknown>): Promise<void>;

  /**
   * Get the storage path/location (for display/debugging)
   */
  getPath(): string;
}
