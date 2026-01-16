/**
 * File-based storage for ConnectorConfig
 *
 * Stores each connector config as a JSON file with restrictive permissions.
 * No encryption logic here - encryption is handled by ConnectorConfigStore.
 *
 * File structure:
 * - {directory}/{hash}.connector.json - individual connector files
 * - {directory}/_index.json - maps hashes to names for list()
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  IConnectorConfigStorage,
  StoredConnectorConfig,
} from '../../domain/interfaces/IConnectorConfigStorage.js';

export interface FileConnectorStorageConfig {
  /** Directory to store connector files */
  directory: string;
}

interface IndexFile {
  /** Maps hash -> name for reverse lookup */
  connectors: Record<string, string>;
}

export class FileConnectorStorage implements IConnectorConfigStorage {
  private directory: string;
  private indexPath: string;
  private initialized = false;

  constructor(config: FileConnectorStorageConfig) {
    if (!config.directory) {
      throw new Error('FileConnectorStorage requires a directory path');
    }
    this.directory = config.directory;
    this.indexPath = path.join(this.directory, '_index.json');
  }

  async save(name: string, stored: StoredConnectorConfig): Promise<void> {
    await this.ensureDirectory();

    const filePath = this.getFilePath(name);
    const json = JSON.stringify(stored, null, 2);

    // Write config file
    await fs.writeFile(filePath, json, 'utf8');
    await fs.chmod(filePath, 0o600); // Owner read/write only

    // Update index
    await this.updateIndex(name, 'add');
  }

  async get(name: string): Promise<StoredConnectorConfig | null> {
    const filePath = this.getFilePath(name);

    try {
      const json = await fs.readFile(filePath, 'utf8');
      return JSON.parse(json) as StoredConnectorConfig;
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async delete(name: string): Promise<boolean> {
    const filePath = this.getFilePath(name);

    try {
      await fs.unlink(filePath);
      await this.updateIndex(name, 'remove');
      return true;
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async has(name: string): Promise<boolean> {
    const filePath = this.getFilePath(name);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<string[]> {
    const index = await this.loadIndex();
    return Object.values(index.connectors);
  }

  async listAll(): Promise<StoredConnectorConfig[]> {
    const names = await this.list();
    const results: StoredConnectorConfig[] = [];

    for (const name of names) {
      const stored = await this.get(name);
      if (stored) {
        results.push(stored);
      }
    }

    return results;
  }

  /**
   * Clear all stored configs (useful for testing)
   */
  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.directory);
      const connectorFiles = files.filter(
        (f) => f.endsWith('.connector.json') || f === '_index.json'
      );

      await Promise.all(
        connectorFiles.map((f) =>
          fs.unlink(path.join(this.directory, f)).catch(() => {})
        )
      );
    } catch {
      // Directory doesn't exist, that's okay
    }
  }

  // ============ Private Helpers ============

  /**
   * Get file path for a connector (hashed for security)
   */
  private getFilePath(name: string): string {
    const hash = this.hashName(name);
    return path.join(this.directory, `${hash}.connector.json`);
  }

  /**
   * Hash connector name to prevent enumeration
   */
  private hashName(name: string): string {
    return crypto.createHash('sha256').update(name).digest('hex').slice(0, 16);
  }

  /**
   * Ensure storage directory exists with proper permissions
   */
  private async ensureDirectory(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.directory, { recursive: true });
      await fs.chmod(this.directory, 0o700); // Owner only
      this.initialized = true;
    } catch {
      // Directory might already exist
      this.initialized = true;
    }
  }

  /**
   * Load the index file
   */
  private async loadIndex(): Promise<IndexFile> {
    try {
      const json = await fs.readFile(this.indexPath, 'utf8');
      return JSON.parse(json) as IndexFile;
    } catch {
      return { connectors: {} };
    }
  }

  /**
   * Update the index file
   */
  private async updateIndex(
    name: string,
    action: 'add' | 'remove'
  ): Promise<void> {
    const index = await this.loadIndex();
    const hash = this.hashName(name);

    if (action === 'add') {
      index.connectors[hash] = name;
    } else {
      delete index.connectors[hash];
    }

    const json = JSON.stringify(index, null, 2);
    await fs.writeFile(this.indexPath, json, 'utf8');
    await fs.chmod(this.indexPath, 0o600);
  }
}
