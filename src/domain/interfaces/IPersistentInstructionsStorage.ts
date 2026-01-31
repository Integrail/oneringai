/**
 * IPersistentInstructionsStorage - Storage interface for persistent instructions
 *
 * Abstracted storage interface following Clean Architecture principles.
 * Implementations can use file system, database, or any other storage backend.
 */

/**
 * Storage interface for persistent agent instructions
 *
 * Implementations handle the actual storage mechanism while the plugin
 * handles the business logic.
 */
export interface IPersistentInstructionsStorage {
  /**
   * Load instructions from storage
   *
   * @returns The stored instructions content, or null if none exist
   */
  load(): Promise<string | null>;

  /**
   * Save instructions to storage
   *
   * @param content - The instructions content to save
   */
  save(content: string): Promise<void>;

  /**
   * Delete instructions from storage
   */
  delete(): Promise<void>;

  /**
   * Check if instructions exist in storage
   *
   * @returns true if instructions exist
   */
  exists(): Promise<boolean>;

  /**
   * Get the storage path (for display/debugging)
   *
   * @returns Human-readable path to the storage location
   */
  getPath(): string;
}
