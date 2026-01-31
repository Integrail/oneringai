/**
 * FilePersistentInstructionsStorage - File-based storage for persistent instructions
 *
 * Stores custom agent instructions as markdown files on disk.
 * Path: ~/.oneringai/agents/<agentId>/custom_instructions.md
 * Windows: %APPDATA%/oneringai/agents/<agentId>/custom_instructions.md
 *
 * Features:
 * - Cross-platform path handling
 * - Safe agent ID sanitization
 * - Atomic file operations
 * - Automatic directory creation
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { IPersistentInstructionsStorage } from '../../domain/interfaces/IPersistentInstructionsStorage.js';

/**
 * Configuration for FilePersistentInstructionsStorage
 */
export interface FilePersistentInstructionsStorageConfig {
  /** Agent ID (used to create unique storage path) */
  agentId: string;
  /** Override the base directory (default: ~/.oneringai/agents) */
  baseDirectory?: string;
  /** Override the filename (default: custom_instructions.md) */
  filename?: string;
}

/**
 * Get the default base directory for persistent instructions
 * Uses ~/.oneringai/agents on Unix-like systems
 * Uses %APPDATA%/oneringai/agents on Windows
 */
function getDefaultBaseDirectory(): string {
  const platform = process.platform;

  if (platform === 'win32') {
    // Windows: Use APPDATA if available, otherwise fall back to home
    const appData = process.env.APPDATA || process.env.LOCALAPPDATA;
    if (appData) {
      return join(appData, 'oneringai', 'agents');
    }
  }

  // Unix-like (Linux, macOS) and fallback: Use home directory
  return join(homedir(), '.oneringai', 'agents');
}

/**
 * Sanitize agent ID for use as a directory name
 * Removes or replaces characters that are not safe for filenames
 */
function sanitizeAgentId(agentId: string): string {
  // Replace any character that isn't alphanumeric, dash, or underscore
  // Also collapse multiple consecutive safe characters into one
  return agentId
    .replace(/[^a-zA-Z0-9_-]/g, '_')  // Replace unsafe chars with underscore
    .replace(/_+/g, '_')               // Collapse multiple underscores
    .replace(/^_|_$/g, '')             // Remove leading/trailing underscores
    .toLowerCase()                      // Normalize to lowercase
    || 'default';                       // Fallback if empty
}

/**
 * File-based storage for persistent agent instructions
 */
export class FilePersistentInstructionsStorage implements IPersistentInstructionsStorage {
  private readonly directory: string;
  private readonly filePath: string;
  private readonly agentId: string;

  constructor(config: FilePersistentInstructionsStorageConfig) {
    this.agentId = config.agentId;
    const sanitizedId = sanitizeAgentId(config.agentId);
    const baseDir = config.baseDirectory ?? getDefaultBaseDirectory();
    const filename = config.filename ?? 'custom_instructions.md';

    this.directory = join(baseDir, sanitizedId);
    this.filePath = join(this.directory, filename);
  }

  /**
   * Load instructions from file
   */
  async load(): Promise<string | null> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      return content.trim() || null;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Save instructions to file
   * Creates directory if it doesn't exist
   */
  async save(content: string): Promise<void> {
    // Ensure directory exists
    await this.ensureDirectory();

    // Write atomically: write to temp file, then rename
    const tempPath = `${this.filePath}.tmp`;
    try {
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.rename(tempPath, this.filePath);
    } catch (error) {
      // Clean up temp file if rename failed
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Delete instructions file
   */
  async delete(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // Ignore if file doesn't exist
    }
  }

  /**
   * Check if instructions file exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the file path (for display/debugging)
   */
  getPath(): string {
    return this.filePath;
  }

  /**
   * Get the agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Ensure the directory exists
   */
  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.directory, { recursive: true });
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }
}
