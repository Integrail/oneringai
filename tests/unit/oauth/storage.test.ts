/**
 * Storage Implementation Tests
 * Tests MemoryStorage and FileStorage with encryption
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStorage } from '@/connectors/oauth/infrastructure/storage/MemoryStorage.js';
import { FileStorage } from '@/connectors/oauth/infrastructure/storage/FileStorage.js';
import { generateEncryptionKey } from '@/connectors/oauth/utils/encryption.js';
import { tmpdir } from 'os';
import { join } from 'path';
import fs from 'fs/promises';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;
  let consoleWarnSpy: any;

  beforeEach(() => {
    // Suppress encryption key warning in tests
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    storage = new MemoryStorage();
  });

  afterEach(() => {
    consoleWarnSpy?.mockRestore();
  });

  describe('storeToken() / getToken()', () => {
    it('should store and retrieve token with encryption', async () => {
      const token = {
        access_token: 'test_token',
        refresh_token: 'refresh',
        expires_in: 3600,
        token_type: 'Bearer' as const,
        scope: 'read',
        obtained_at: Date.now(),
      };

      await storage.storeToken('key1', token);
      const retrieved = await storage.getToken('key1');

      expect(retrieved).toEqual(token);
    });

    it('should return null for non-existent key', async () => {
      const token = await storage.getToken('nonexistent');
      expect(token).toBeNull();
    });

    it('should handle multiple tokens with different keys', async () => {
      await storage.storeToken('key1', {
        access_token: 'token1',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'read',
        obtained_at: Date.now(),
      });

      await storage.storeToken('key2', {
        access_token: 'token2',
        expires_in: 7200,
        token_type: 'Bearer',
        scope: 'write',
        obtained_at: Date.now(),
      });

      const token1 = await storage.getToken('key1');
      const token2 = await storage.getToken('key2');

      expect(token1?.access_token).toBe('token1');
      expect(token2?.access_token).toBe('token2');
      expect(token1?.expires_in).toBe(3600);
      expect(token2?.expires_in).toBe(7200);
    });

    it('should encrypt tokens (not stored as plaintext)', async () => {
      await storage.storeToken('key1', {
        access_token: 'secret_token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'read',
        obtained_at: Date.now(),
      });

      // Access internal storage to verify encryption
      const encrypted = (storage as any).tokens.get('key1');
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toContain('secret_token'); // Should be encrypted
    });
  });

  describe('deleteToken()', () => {
    it('should delete token by key', async () => {
      await storage.storeToken('key1', {
        access_token: 'token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'read',
        obtained_at: Date.now(),
      });

      await storage.deleteToken('key1');

      const token = await storage.getToken('key1');
      expect(token).toBeNull();
    });

    it('should not throw if deleting non-existent key', async () => {
      await expect(
        storage.deleteToken('nonexistent')
      ).resolves.not.toThrow();
    });
  });
});

describe('FileStorage', () => {
  let storage: FileStorage;
  let testDir: string;
  const encryptionKey = generateEncryptionKey();
  let consoleErrorSpy: any;

  beforeEach(async () => {
    // Suppress expected error logs during tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    testDir = join(tmpdir(), `oneringai-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });

    storage = new FileStorage({
      directory: testDir,
      encryptionKey,
    });
  });

  afterEach(async () => {
    consoleErrorSpy?.mockRestore();

    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('storeToken() / getToken()', () => {
    it('should store token to file with encryption', async () => {
      const token = {
        access_token: 'file_token',
        refresh_token: 'refresh',
        expires_in: 3600,
        token_type: 'Bearer' as const,
        scope: 'read',
        obtained_at: Date.now(),
      };

      await storage.storeToken('key1', token);

      // Verify file was created
      const files = await fs.readdir(testDir);
      expect(files.length).toBe(1);

      // Retrieve and verify
      const retrieved = await storage.getToken('key1');
      expect(retrieved).toEqual(token);
    });

    it('should hash filename (no sensitive data in filename)', async () => {
      await storage.storeToken('sensitive-api-key-name', {
        access_token: 'token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'read',
        obtained_at: Date.now(),
      });

      const files = await fs.readdir(testDir);
      expect(files[0]).not.toContain('sensitive');
      expect(files[0]).not.toContain('api-key');
      expect(files[0]).toMatch(/^[a-f0-9]{64}\.token$/); // SHA-256 hash + .token extension
    });

    it('should set file permissions to 0o600 (owner-only)', async () => {
      await storage.storeToken('key1', {
        access_token: 'token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'read',
        obtained_at: Date.now(),
      });

      const files = await fs.readdir(testDir);
      const stats = await fs.stat(join(testDir, files[0]));

      // Extract permission bits (last 3 octal digits)
      const permissions = (stats.mode & 0o777).toString(8);
      expect(permissions).toBe('600');
    });

    it('should persist across FileStorage instances', async () => {
      const token = {
        access_token: 'persistent_token',
        expires_in: 3600,
        token_type: 'Bearer' as const,
        scope: 'read',
        obtained_at: Date.now(),
      };

      // Store with first instance
      await storage.storeToken('key1', token);

      // Create new instance
      const storage2 = new FileStorage({
        directory: testDir,
        encryptionKey,
      });

      // Should retrieve token
      const retrieved = await storage2.getToken('key1');
      expect(retrieved).toEqual(token);
    });

    it('should return null for non-existent file (ENOENT)', async () => {
      const token = await storage.getToken('nonexistent');
      expect(token).toBeNull();
    });

    it('should handle corrupted file data gracefully', async () => {
      await storage.storeToken('key1', {
        access_token: 'token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'read',
        obtained_at: Date.now(),
      });

      // Corrupt the file
      const files = await fs.readdir(testDir);
      await fs.writeFile(join(testDir, files[0]), 'corrupted data');

      // Should return null and delete corrupted file
      const token = await storage.getToken('key1');
      expect(token).toBeNull();

      const filesAfter = await fs.readdir(testDir);
      expect(filesAfter.length).toBe(0);
    });

    it('should fail decryption with wrong encryption key', async () => {
      const wrongKeyStorage = new FileStorage({
        directory: testDir,
        encryptionKey: generateEncryptionKey(), // Different key
      });

      await storage.storeToken('key1', {
        access_token: 'token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'read',
        obtained_at: Date.now(),
      });

      // Try to decrypt with wrong key
      const token = await wrongKeyStorage.getToken('key1');

      // Should return null (decryption failed, file deleted)
      expect(token).toBeNull();
    });
  });

  describe('deleteToken()', () => {
    it('should delete file from disk', async () => {
      await storage.storeToken('key1', {
        access_token: 'token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'read',
        obtained_at: Date.now(),
      });

      const filesBefore = await fs.readdir(testDir);
      expect(filesBefore.length).toBe(1);

      await storage.deleteToken('key1');

      const filesAfter = await fs.readdir(testDir);
      expect(filesAfter.length).toBe(0);
    });

    it('should not throw if file does not exist', async () => {
      await expect(
        storage.deleteToken('nonexistent')
      ).resolves.not.toThrow();
    });
  });
});
