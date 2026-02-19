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
 * When userId is undefined, defaults to 'default' user.
 */
export interface IUserInfoStorage {
  /**
   * Load user info entries from storage for a specific user
   *
   * @param userId - Optional user ID for isolation (defaults to 'default')
   * @returns The stored user info entries, or null if none exist
   */
  load(userId: string | undefined): Promise<UserInfoEntry[] | null>;

  /**
   * Save user info entries to storage for a specific user
   *
   * @param userId - Optional user ID for isolation (defaults to 'default')
   * @param entries - The user info entries to save
   */
  save(userId: string | undefined, entries: UserInfoEntry[]): Promise<void>;

  /**
   * Delete user info from storage for a specific user
   *
   * @param userId - Optional user ID for isolation (defaults to 'default')
   */
  delete(userId: string | undefined): Promise<void>;

  /**
   * Check if user info exists in storage for a specific user
   *
   * @param userId - Optional user ID for isolation (defaults to 'default')
   * @returns true if user info exists
   */
  exists(userId: string | undefined): Promise<boolean>;

  /**
   * Get the storage path for a specific user (for display/debugging)
   *
   * @param userId - Optional user ID for isolation (defaults to 'default')
   * @returns Human-readable path to the storage location
   */
  getPath(userId: string | undefined): string;
}
