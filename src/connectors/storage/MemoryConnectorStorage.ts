/**
 * In-memory storage for ConnectorConfig
 *
 * Simple Map-based storage. No encryption logic here -
 * encryption is handled by ConnectorConfigStore.
 *
 * Useful for:
 * - Testing
 * - Short-lived processes
 * - Development
 *
 * Note: Data is lost when process exits.
 */

import type {
  IConnectorConfigStorage,
  StoredConnectorConfig,
} from '../../domain/interfaces/IConnectorConfigStorage.js';

export class MemoryConnectorStorage implements IConnectorConfigStorage {
  private configs: Map<string, StoredConnectorConfig> = new Map();

  async save(name: string, stored: StoredConnectorConfig): Promise<void> {
    // Deep clone to prevent external mutation
    this.configs.set(name, JSON.parse(JSON.stringify(stored)));
  }

  async get(name: string): Promise<StoredConnectorConfig | null> {
    const stored = this.configs.get(name);
    if (!stored) {
      return null;
    }
    // Return a copy to prevent external mutation
    return JSON.parse(JSON.stringify(stored));
  }

  async delete(name: string): Promise<boolean> {
    return this.configs.delete(name);
  }

  async has(name: string): Promise<boolean> {
    return this.configs.has(name);
  }

  async list(): Promise<string[]> {
    return Array.from(this.configs.keys());
  }

  async listAll(): Promise<StoredConnectorConfig[]> {
    // Return copies to prevent external mutation
    return Array.from(this.configs.values()).map((stored) =>
      JSON.parse(JSON.stringify(stored))
    );
  }

  /**
   * Clear all stored configs (useful for testing)
   */
  clear(): void {
    this.configs.clear();
  }

  /**
   * Get the number of stored configs
   */
  size(): number {
    return this.configs.size;
  }
}
