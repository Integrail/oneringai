/**
 * FileCustomToolStorage - File-based storage for custom tool definitions
 *
 * Stores custom tools as JSON files on disk.
 * Path: ~/.oneringai/custom-tools/<sanitized-name>.json
 *
 * Features:
 * - Cross-platform path handling
 * - Safe name sanitization
 * - Atomic file operations (write to .tmp then rename)
 * - Index file for fast listing
 * - Search support (case-insensitive substring on name + description)
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ICustomToolStorage, CustomToolListOptions } from '../../domain/interfaces/ICustomToolStorage.js';
import type { CustomToolDefinition, CustomToolSummary } from '../../domain/entities/CustomToolDefinition.js';

/**
 * Configuration for FileCustomToolStorage
 */
export interface FileCustomToolStorageConfig {
  /** Override the base directory (default: ~/.oneringai/custom-tools) */
  baseDirectory?: string;
  /** Pretty-print JSON (default: true) */
  prettyPrint?: boolean;
}

/**
 * Index entry for fast listing
 */
interface CustomToolIndexEntry {
  name: string;
  displayName?: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  category?: string;
}

/**
 * Index file structure
 */
interface CustomToolIndex {
  version: number;
  tools: CustomToolIndexEntry[];
  lastUpdated: string;
}

/**
 * Get the default base directory for custom tool storage
 */
function getDefaultBaseDirectory(): string {
  const platform = process.platform;

  if (platform === 'win32') {
    const appData = process.env.APPDATA || process.env.LOCALAPPDATA;
    if (appData) {
      return join(appData, 'oneringai', 'custom-tools');
    }
  }

  return join(homedir(), '.oneringai', 'custom-tools');
}

/**
 * Sanitize tool name for use as a filename
 */
function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
    || 'default';
}

/**
 * File-based storage for custom tool definitions
 */
export class FileCustomToolStorage implements ICustomToolStorage {
  private readonly baseDirectory: string;
  private readonly indexPath: string;
  private readonly prettyPrint: boolean;
  private index: CustomToolIndex | null = null;

  constructor(config: FileCustomToolStorageConfig = {}) {
    this.baseDirectory = config.baseDirectory ?? getDefaultBaseDirectory();
    this.prettyPrint = config.prettyPrint ?? true;
    this.indexPath = join(this.baseDirectory, '_index.json');
  }

  /**
   * Save a custom tool definition
   */
  async save(definition: CustomToolDefinition): Promise<void> {
    const sanitized = sanitizeName(definition.name);
    const filePath = join(this.baseDirectory, `${sanitized}.json`);

    // Ensure directory exists
    await this.ensureDirectory(this.baseDirectory);

    // Write atomically
    const data = this.prettyPrint
      ? JSON.stringify(definition, null, 2)
      : JSON.stringify(definition);

    const tempPath = `${filePath}.tmp`;
    try {
      await fs.writeFile(tempPath, data, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }

    // Update index
    await this.updateIndex(definition);
  }

  /**
   * Load a custom tool definition by name
   */
  async load(name: string): Promise<CustomToolDefinition | null> {
    const sanitized = sanitizeName(name);
    const filePath = join(this.baseDirectory, `${sanitized}.json`);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as CustomToolDefinition;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      if (error instanceof SyntaxError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a custom tool definition
   */
  async delete(name: string): Promise<void> {
    const sanitized = sanitizeName(name);
    const filePath = join(this.baseDirectory, `${sanitized}.json`);

    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    // Remove from index
    await this.removeFromIndex(name);
  }

  /**
   * Check if a custom tool exists
   */
  async exists(name: string): Promise<boolean> {
    const sanitized = sanitizeName(name);
    const filePath = join(this.baseDirectory, `${sanitized}.json`);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List custom tools (summaries only)
   */
  async list(options?: CustomToolListOptions): Promise<CustomToolSummary[]> {
    const index = await this.loadIndex();
    let entries = [...index.tools];

    // Apply tag filter
    if (options?.tags && options.tags.length > 0) {
      entries = entries.filter(e => {
        const entryTags = e.tags ?? [];
        return options.tags!.some(t => entryTags.includes(t));
      });
    }

    // Apply category filter
    if (options?.category) {
      entries = entries.filter(e => e.category === options.category);
    }

    // Apply search filter (case-insensitive substring match on name + description)
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      entries = entries.filter(e =>
        e.name.toLowerCase().includes(searchLower) ||
        e.description.toLowerCase().includes(searchLower)
      );
    }

    // Sort by updatedAt descending
    entries.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    // Apply pagination
    if (options?.offset) {
      entries = entries.slice(options.offset);
    }
    if (options?.limit) {
      entries = entries.slice(0, options.limit);
    }

    // Convert to summaries
    return entries.map(e => ({
      name: e.name,
      displayName: e.displayName,
      description: e.description,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      metadata: {
        tags: e.tags,
        category: e.category,
      },
    }));
  }

  /**
   * Update metadata without loading full definition
   */
  async updateMetadata(name: string, metadata: Record<string, unknown>): Promise<void> {
    const definition = await this.load(name);
    if (!definition) {
      throw new Error(`Custom tool '${name}' not found`);
    }

    definition.metadata = { ...definition.metadata, ...metadata };
    definition.updatedAt = new Date().toISOString();
    await this.save(definition);
  }

  /**
   * Get storage path
   */
  getPath(): string {
    return this.baseDirectory;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private async ensureDirectory(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private async loadIndex(): Promise<CustomToolIndex> {
    if (this.index) {
      return this.index;
    }

    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      this.index = JSON.parse(data) as CustomToolIndex;
      return this.index;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.index = {
          version: 1,
          tools: [],
          lastUpdated: new Date().toISOString(),
        };
        return this.index;
      }
      throw error;
    }
  }

  private async saveIndex(): Promise<void> {
    if (!this.index) return;

    await this.ensureDirectory(this.baseDirectory);
    this.index.lastUpdated = new Date().toISOString();
    const data = this.prettyPrint
      ? JSON.stringify(this.index, null, 2)
      : JSON.stringify(this.index);

    await fs.writeFile(this.indexPath, data, 'utf-8');
  }

  private async updateIndex(definition: CustomToolDefinition): Promise<void> {
    const index = await this.loadIndex();
    const entry = this.definitionToIndexEntry(definition);

    const existingIdx = index.tools.findIndex(e => e.name === definition.name);
    if (existingIdx >= 0) {
      index.tools[existingIdx] = entry;
    } else {
      index.tools.push(entry);
    }

    await this.saveIndex();
  }

  private async removeFromIndex(name: string): Promise<void> {
    const index = await this.loadIndex();
    index.tools = index.tools.filter(e => e.name !== name);
    await this.saveIndex();
  }

  private definitionToIndexEntry(definition: CustomToolDefinition): CustomToolIndexEntry {
    return {
      name: definition.name,
      displayName: definition.displayName,
      description: definition.description,
      createdAt: definition.createdAt,
      updatedAt: definition.updatedAt,
      tags: definition.metadata?.tags,
      category: definition.metadata?.category,
    };
  }
}

/**
 * Create a FileCustomToolStorage with default configuration
 */
export function createFileCustomToolStorage(
  config?: FileCustomToolStorageConfig
): FileCustomToolStorage {
  return new FileCustomToolStorage(config);
}
