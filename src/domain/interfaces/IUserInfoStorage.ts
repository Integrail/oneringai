/**
 * IUserInfoStorage - Storage interface for user information
 *
 * Abstracted storage interface following Clean Architecture principles.
 * Implementations can use file system, database, or any other storage backend.
 *
 * User information is stored per userId - each user has their own isolated data.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * A single user info entry, independently addressable by key.
 */
export interface UserInfoEntry {
  /** User-supplied key (e.g., "theme", "language") */
  id: string;
  /** Value (any JSON-serializable data) */
  value: unknown;
  /** Type of the value for display/debugging */
  valueType: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  /** Optional description for self-documentation */
  description?: string;
  /** Timestamp when entry was first created */
  createdAt: number;
  /** Timestamp when entry was last updated */
  updatedAt: number;
}

// ============================================================================
// Storage Interface
// ============================================================================

/**
 * Storage interface for user information
 *
 * Implementations handle the actual storage mechanism while the plugin
 * handles the business logic.
 *
 * Design: Single storage instance handles ALL users. UserId is passed to
 * each method, allowing efficient multi-tenant storage.
 */
export interface IUserInfoStorage {
  /**
   * Load user info entries from storage for a specific user
   *
   * @param userId - The user ID to load data for
   * @returns The stored user info entries, or null if none exist
   */
  load(userId: string): Promise<UserInfoEntry[] | null>;

  /**
   * Save user info entries to storage for a specific user
   *
   * @param userId - The user ID to save data for
   * @param entries - The user info entries to save
   */
  save(userId: string, entries: UserInfoEntry[]): Promise<void>;

  /**
   * Delete user info from storage for a specific user
   *
   * @param userId - The user ID to delete data for
   */
  delete(userId: string): Promise<void>;

  /**
   * Check if user info exists in storage for a specific user
   *
   * @param userId - The user ID to check
   * @returns true if user info exists
   */
  exists(userId: string): Promise<boolean>;

  /**
   * Get the storage path for a specific user (for display/debugging)
   *
   * @param userId - The user ID to get path for
   * @returns Human-readable path to the storage location
   */
  getPath(userId: string): string;
}
