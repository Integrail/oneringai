/**
 * Encryption utilities for OAuth tokens
 * Uses AES-256-GCM for secure token storage
 */

import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Encrypt data using AES-256-GCM with PBKDF2 key derivation
 *
 * @param text - Plaintext to encrypt
 * @param password - Encryption key/password
 * @returns Base64-encoded encrypted data
 */
export function encrypt(text: string, password: string): string {
  // Generate random salt
  const salt = crypto.randomBytes(SALT_LENGTH);

  // Derive key from password using PBKDF2
  const key = crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha512');

  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get authentication tag
  const tag = cipher.getAuthTag();

  // Combine: salt + iv + tag + encrypted
  const result = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'hex')]);

  // Return as base64
  return result.toString('base64');
}

/**
 * Decrypt data using AES-256-GCM
 *
 * @param encryptedData - Base64-encoded encrypted data
 * @param password - Encryption key/password
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: string, password: string): string {
  const buffer = Buffer.from(encryptedData, 'base64');

  // Extract components
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  // Derive key from password
  const key = crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha512');

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  // Decrypt
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Get encryption key from environment or generate temporary one
 *
 * For production, always set OAUTH_ENCRYPTION_KEY environment variable!
 */
export function getEncryptionKey(): string {
  // Use environment variable if available (RECOMMENDED)
  if (process.env.OAUTH_ENCRYPTION_KEY) {
    return process.env.OAUTH_ENCRYPTION_KEY;
  }

  // For in-memory storage: use process-specific key (not persistent across restarts)
  // This is acceptable for MemoryStorage but NOT for FileStorage or DatabaseStorage!
  if (!(global as any).__oauthEncryptionKey) {
    (global as any).__oauthEncryptionKey = crypto.randomBytes(32).toString('hex');

    console.warn(
      'WARNING: Using auto-generated encryption key. Tokens will not persist across restarts. ' +
        'Set OAUTH_ENCRYPTION_KEY environment variable for production!'
    );
  }

  return (global as any).__oauthEncryptionKey;
}

/**
 * Generate a secure random encryption key
 * Use this to generate OAUTH_ENCRYPTION_KEY for your .env file
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
