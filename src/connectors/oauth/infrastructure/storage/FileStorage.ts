/**
 * File-based token storage
 * Tokens are encrypted and stored in individual files with restrictive permissions
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ITokenStorage, StoredToken } from '../../domain/ITokenStorage.js';
import { encrypt, decrypt } from '../../utils/encryption.js';

export interface FileStorageConfig {
  directory: string; // Directory to store token files
  encryptionKey: string; // Encryption key (REQUIRED - do not use auto-generated key!)
}

export class FileStorage implements ITokenStorage {
  private directory: string;
  private encryptionKey: string;

  constructor(config: FileStorageConfig) {
    if (!config.encryptionKey) {
      throw new Error(
        'FileStorage requires an encryption key. Set OAUTH_ENCRYPTION_KEY in environment or provide config.encryptionKey'
      );
    }

    this.directory = config.directory;
    this.encryptionKey = config.encryptionKey;

    // Ensure directory exists (async, don't block constructor)
    this.ensureDirectory().catch((error) => {
      console.error('Failed to create token directory:', error);
    });
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.directory, { recursive: true });
      // Set directory permissions (owner only)
      await fs.chmod(this.directory, 0o700);
    } catch (error) {
      // Directory might already exist, that's okay
    }
  }

  /**
   * Get file path for a token key (hashed for security)
   */
  private getFilePath(key: string): string {
    // Hash the key for filename (prevents exposing sensitive key names)
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return path.join(this.directory, `${hash}.token`);
  }

  async storeToken(key: string, token: StoredToken): Promise<void> {
    await this.ensureDirectory();

    const filePath = this.getFilePath(key);
    const plaintext = JSON.stringify(token);
    const encrypted = encrypt(plaintext, this.encryptionKey);

    // Write encrypted token to file
    await fs.writeFile(filePath, encrypted, 'utf8');

    // Set restrictive permissions (owner read/write only)
    await fs.chmod(filePath, 0o600);
  }

  async getToken(key: string): Promise<StoredToken | null> {
    const filePath = this.getFilePath(key);

    try {
      const encrypted = await fs.readFile(filePath, 'utf8');
      const decrypted = decrypt(encrypted, this.encryptionKey);
      return JSON.parse(decrypted) as StoredToken;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist
        return null;
      }

      console.error('Failed to read/decrypt token file:', error);

      // Remove corrupted file
      try {
        await fs.unlink(filePath);
      } catch {
        // Ignore unlink errors
      }

      return null;
    }
  }

  async deleteToken(key: string): Promise<void> {
    const filePath = this.getFilePath(key);

    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, that's okay
    }
  }

  async hasToken(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all token keys (for debugging)
   */
  async listTokens(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.directory);
      return files.filter((f) => f.endsWith('.token')).map((f) => f.replace('.token', ''));
    } catch {
      return [];
    }
  }

  /**
   * Clear all tokens
   */
  async clearAll(): Promise<void> {
    try {
      const files = await fs.readdir(this.directory);
      const tokenFiles = files.filter((f) => f.endsWith('.token'));

      await Promise.all(
        tokenFiles.map((f) => fs.unlink(path.join(this.directory, f)).catch(() => {}))
      );
    } catch {
      // Directory doesn't exist or can't read, that's okay
    }
  }
}
