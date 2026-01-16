/**
 * ConnectorConfigStore - Domain service for storing ConnectorConfig with encryption
 *
 * Handles encryption/decryption of sensitive fields uniformly,
 * regardless of which storage backend is used.
 */

import type { ConnectorConfig, ConnectorAuth } from '../../domain/entities/Connector.js';
import type {
  IConnectorConfigStorage,
  StoredConnectorConfig,
} from '../../domain/interfaces/IConnectorConfigStorage.js';
import { CONNECTOR_CONFIG_VERSION } from '../../domain/interfaces/IConnectorConfigStorage.js';
import { encrypt, decrypt } from '../oauth/utils/encryption.js';

/** Prefix for encrypted values */
const ENCRYPTED_PREFIX = '$ENC$:';

/**
 * ConnectorConfigStore - manages connector configs with automatic encryption
 *
 * Usage:
 * ```typescript
 * const storage = new MemoryConnectorStorage();
 * const store = new ConnectorConfigStore(storage, process.env.ENCRYPTION_KEY!);
 *
 * await store.save('openai', { auth: { type: 'api_key', apiKey: 'sk-xxx' } });
 * const config = await store.get('openai'); // apiKey is decrypted
 * ```
 */
export class ConnectorConfigStore {
  constructor(
    private storage: IConnectorConfigStorage,
    private encryptionKey: string
  ) {
    if (!encryptionKey || encryptionKey.length < 16) {
      throw new Error(
        'ConnectorConfigStore requires an encryption key of at least 16 characters'
      );
    }
  }

  /**
   * Save a connector configuration (secrets are encrypted automatically)
   *
   * @param name - Unique identifier for this connector
   * @param config - The connector configuration
   */
  async save(name: string, config: ConnectorConfig): Promise<void> {
    if (!name || name.trim().length === 0) {
      throw new Error('Connector name is required');
    }

    const existing = await this.storage.get(name);
    const now = Date.now();

    const encryptedConfig = this.encryptSecrets(config);

    const stored: StoredConnectorConfig = {
      config: { ...encryptedConfig, name },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      version: CONNECTOR_CONFIG_VERSION,
    };

    await this.storage.save(name, stored);
  }

  /**
   * Retrieve a connector configuration (secrets are decrypted automatically)
   *
   * @param name - Unique identifier for the connector
   * @returns The decrypted config or null if not found
   */
  async get(name: string): Promise<ConnectorConfig | null> {
    const stored = await this.storage.get(name);
    if (!stored) {
      return null;
    }

    return this.decryptSecrets(stored.config);
  }

  /**
   * Delete a connector configuration
   *
   * @param name - Unique identifier for the connector
   * @returns True if deleted, false if not found
   */
  async delete(name: string): Promise<boolean> {
    return this.storage.delete(name);
  }

  /**
   * Check if a connector configuration exists
   *
   * @param name - Unique identifier for the connector
   * @returns True if exists
   */
  async has(name: string): Promise<boolean> {
    return this.storage.has(name);
  }

  /**
   * List all connector names
   *
   * @returns Array of connector names
   */
  async list(): Promise<string[]> {
    return this.storage.list();
  }

  /**
   * Get all connector configurations (secrets are decrypted automatically)
   *
   * @returns Array of decrypted configs
   */
  async listAll(): Promise<ConnectorConfig[]> {
    const stored = await this.storage.listAll();
    return stored.map((s) => this.decryptSecrets(s.config));
  }

  /**
   * Get stored metadata for a connector
   *
   * @param name - Unique identifier for the connector
   * @returns Metadata (createdAt, updatedAt, version) or null
   */
  async getMetadata(
    name: string
  ): Promise<{ createdAt: number; updatedAt: number; version: number } | null> {
    const stored = await this.storage.get(name);
    if (!stored) {
      return null;
    }
    return {
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      version: stored.version,
    };
  }

  // ============ Encryption Helpers ============

  /**
   * Encrypt sensitive fields in a ConnectorConfig
   * Fields encrypted: apiKey, clientSecret, privateKey
   */
  private encryptSecrets(config: ConnectorConfig): ConnectorConfig {
    const result = { ...config };

    if (result.auth) {
      result.auth = this.encryptAuthSecrets(result.auth);
    }

    return result;
  }

  /**
   * Decrypt sensitive fields in a ConnectorConfig
   */
  private decryptSecrets(config: ConnectorConfig): ConnectorConfig {
    const result = { ...config };

    if (result.auth) {
      result.auth = this.decryptAuthSecrets(result.auth);
    }

    return result;
  }

  /**
   * Encrypt secrets in ConnectorAuth based on auth type
   */
  private encryptAuthSecrets(auth: ConnectorAuth): ConnectorAuth {
    switch (auth.type) {
      case 'api_key':
        return {
          ...auth,
          apiKey: this.encryptValue(auth.apiKey),
        };

      case 'oauth':
        return {
          ...auth,
          clientSecret: auth.clientSecret
            ? this.encryptValue(auth.clientSecret)
            : undefined,
          privateKey: auth.privateKey
            ? this.encryptValue(auth.privateKey)
            : undefined,
        };

      case 'jwt':
        return {
          ...auth,
          privateKey: this.encryptValue(auth.privateKey),
        };

      default:
        return auth;
    }
  }

  /**
   * Decrypt secrets in ConnectorAuth based on auth type
   */
  private decryptAuthSecrets(auth: ConnectorAuth): ConnectorAuth {
    switch (auth.type) {
      case 'api_key':
        return {
          ...auth,
          apiKey: this.decryptValue(auth.apiKey),
        };

      case 'oauth':
        return {
          ...auth,
          clientSecret: auth.clientSecret
            ? this.decryptValue(auth.clientSecret)
            : undefined,
          privateKey: auth.privateKey
            ? this.decryptValue(auth.privateKey)
            : undefined,
        };

      case 'jwt':
        return {
          ...auth,
          privateKey: this.decryptValue(auth.privateKey),
        };

      default:
        return auth;
    }
  }

  /**
   * Encrypt a single value if not already encrypted
   */
  private encryptValue(value: string): string {
    if (this.isEncrypted(value)) {
      return value; // Already encrypted
    }
    const encrypted = encrypt(value, this.encryptionKey);
    return `${ENCRYPTED_PREFIX}${encrypted}`;
  }

  /**
   * Decrypt a single value if encrypted
   */
  private decryptValue(value: string): string {
    if (!this.isEncrypted(value)) {
      return value; // Not encrypted (legacy or plaintext)
    }
    const encryptedData = value.slice(ENCRYPTED_PREFIX.length);
    return decrypt(encryptedData, this.encryptionKey);
  }

  /**
   * Check if a value is encrypted (has the $ENC$: prefix)
   */
  private isEncrypted(value: string): boolean {
    return value.startsWith(ENCRYPTED_PREFIX);
  }
}
