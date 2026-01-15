/**
 * Encryption Utils Unit Tests
 * Critical security tests for AES-256-GCM encryption
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, generateEncryptionKey, getEncryptionKey } from '@/connectors/oauth/utils/encryption.js';

describe('Encryption Utils', () => {
  describe('encrypt() / decrypt() - Round-trip', () => {
    it('should encrypt and decrypt successfully', () => {
      const password = 'test-password-32-characters-long!';
      const plaintext = 'sensitive data';

      const encrypted = encrypt(plaintext, password);
      const decrypted = decrypt(encrypted, password);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same input (randomness)', () => {
      const password = 'password';
      const text = 'same text';

      const encrypted1 = encrypt(text, password);
      const encrypted2 = encrypt(text, password);

      // Different ciphertexts due to random salt/IV
      expect(encrypted1).not.toBe(encrypted2);

      // Both decrypt correctly
      expect(decrypt(encrypted1, password)).toBe(text);
      expect(decrypt(encrypted2, password)).toBe(text);
    });

    it('should handle empty string', () => {
      const password = 'password';
      const encrypted = encrypt('', password);
      const decrypted = decrypt(encrypted, password);

      expect(decrypted).toBe('');
    });

    it('should handle long plaintext (100KB)', () => {
      const password = 'password';
      const longText = 'A'.repeat(100000); // 100KB

      const encrypted = encrypt(longText, password);
      const decrypted = decrypt(encrypted, password);

      expect(decrypted).toBe(longText);
      expect(decrypted.length).toBe(100000);
    });

    it('should handle special characters and unicode', () => {
      const password = 'password';
      const text = '{"emoji":"🔐","chinese":"你好","json":true,"special":"!@#$%^&*()"}';

      const encrypted = encrypt(text, password);
      const decrypted = decrypt(encrypted, password);

      expect(decrypted).toBe(text);
    });

    it('should handle multiline text', () => {
      const password = 'password';
      const text = 'Line 1\nLine 2\nLine 3\n\nLine 5';

      const encrypted = encrypt(text, password);
      const decrypted = decrypt(encrypted, password);

      expect(decrypted).toBe(text);
    });
  });

  describe('decrypt() - Error Handling', () => {
    it('should throw error with wrong password', () => {
      const encrypted = encrypt('data', 'correct-password');

      expect(() =>
        decrypt(encrypted, 'wrong-password')
      ).toThrow();
    });

    it('should throw error with corrupted ciphertext', () => {
      const encrypted = encrypt('data', 'password');
      const corrupted = encrypted.slice(0, -10) + 'corrupted!';

      expect(() =>
        decrypt(corrupted, 'password')
      ).toThrow();
    });

    it('should throw error with truncated data', () => {
      const encrypted = encrypt('data', 'password');
      const truncated = encrypted.slice(0, 20); // Too short

      expect(() =>
        decrypt(truncated, 'password')
      ).toThrow();
    });

    it('should throw error with invalid base64', () => {
      expect(() =>
        decrypt('not-base64!@#$', 'password')
      ).toThrow();
    });

    it('should throw error with empty encrypted data', () => {
      expect(() =>
        decrypt('', 'password')
      ).toThrow();
    });
  });

  describe('generateEncryptionKey()', () => {
    it('should return 64 hex characters', () => {
      const key = generateEncryptionKey();
      expect(key).toMatch(/^[0-9a-f]{64}$/);
      expect(key.length).toBe(64);
    });

    it('should generate different keys on each call', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      const key3 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
      expect(key1).not.toBe(key3);
    });

    it('should generate cryptographically strong keys', () => {
      // Generate 100 keys, all should be unique
      const keys = new Set();
      for (let i = 0; i < 100; i++) {
        keys.add(generateEncryptionKey());
      }
      expect(keys.size).toBe(100);
    });
  });

  describe('getEncryptionKey() - Environment Integration', () => {
    let originalEnv: string | undefined;
    let consoleWarnSpy: any;

    beforeEach(() => {
      originalEnv = process.env.OAUTH_ENCRYPTION_KEY;
      // Suppress warnings unless we're specifically testing them
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy?.mockRestore();

      if (originalEnv !== undefined) {
        process.env.OAUTH_ENCRYPTION_KEY = originalEnv;
      } else {
        delete process.env.OAUTH_ENCRYPTION_KEY;
      }
      // Reset the global key cache
      (global as any).__oauthEncryptionKey = null;
    });

    it('should return OAUTH_ENCRYPTION_KEY from env if set', () => {
      const envKey = 'a'.repeat(64);
      process.env.OAUTH_ENCRYPTION_KEY = envKey;

      const key = getEncryptionKey();
      expect(key).toBe(envKey);
    });

    it('should generate and cache key if env not set', () => {
      delete process.env.OAUTH_ENCRYPTION_KEY;

      const key1 = getEncryptionKey();
      const key2 = getEncryptionKey();

      // Should return same key (cached)
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should warn when using auto-generated key', () => {
      delete process.env.OAUTH_ENCRYPTION_KEY;

      // Restore the spy temporarily to test the warning
      consoleWarnSpy.mockRestore();
      const localSpy = vi.spyOn(console, 'warn');

      getEncryptionKey();

      expect(localSpy).toHaveBeenCalledWith(
        expect.stringContaining('WARNING: Using auto-generated encryption key')
      );

      localSpy.mockRestore();
      // Re-establish the suppression spy for other tests
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
  });

  describe('Encryption Security Properties', () => {
    it('should use strong key derivation (PBKDF2)', () => {
      // Encrypt with password
      const encrypted = encrypt('data', 'password');

      // Encrypted data should contain salt
      const decoded = Buffer.from(encrypted, 'base64');
      expect(decoded.length).toBeGreaterThan(16); // At least salt + IV + tag + data
    });

    it('should authenticate ciphertext (GCM tag)', () => {
      const encrypted = encrypt('data', 'password');
      const buffer = Buffer.from(encrypted, 'base64');

      // Modify a byte in the middle (tamper with ciphertext)
      buffer[buffer.length / 2] = buffer[buffer.length / 2] ^ 0xFF;
      const tampered = buffer.toString('base64');

      // Should fail authentication
      expect(() =>
        decrypt(tampered, 'password')
      ).toThrow();
    });

    it('should resist brute force (proper iteration count)', () => {
      // PBKDF2 should use 100,000 iterations
      // We can't directly test iteration count, but we can verify
      // decryption is reasonably slow (should take >1ms per decrypt)

      const encrypted = encrypt('data', 'password');
      const start = Date.now();

      for (let i = 0; i < 10; i++) {
        decrypt(encrypted, 'password');
      }

      const elapsed = Date.now() - start;
      // 10 decrypts should take at least 5ms (accounting for modern CPUs)
      expect(elapsed).toBeGreaterThan(5);
    });
  });
});
