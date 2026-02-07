/**
 * IPersistentInstructionsStorage - Storage interface for persistent instructions
 *
 * Abstracted storage interface following Clean Architecture principles.
 * Implementations can use file system, database, or any other storage backend.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * A single instruction entry, independently addressable by key.
 */
export interface InstructionEntry {
  /** User-supplied key (e.g., "style", "code_rules") */
  id: string;
  /** Instruction text (markdown) */
  content: string;
  /** Timestamp when entry was first created */
  createdAt: number;
  /** Timestamp when entry was last updated */
  updatedAt: number;
}

// ============================================================================
// Storage Interface
// ============================================================================

/**
 * Storage interface for persistent agent instructions
 *
 * Implementations handle the actual storage mechanism while the plugin
 * handles the business logic.
 */
export interface IPersistentInstructionsStorage {
  /**
   * Load instruction entries from storage
   *
   * @returns The stored instruction entries, or null if none exist
   */
  load(): Promise<InstructionEntry[] | null>;

  /**
   * Save instruction entries to storage
   *
   * @param entries - The instruction entries to save
   */
  save(entries: InstructionEntry[]): Promise<void>;

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
