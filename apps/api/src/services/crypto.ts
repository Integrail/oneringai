/**
 * Cryptographic utilities using Web Crypto API (CF Worker compatible)
 *
 * - Password hashing: PBKDF2 with SHA-256
 * - Encryption: AES-GCM 256-bit for credential storage
 */

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

// ============ Password Hashing ============

/**
 * Hash a password using PBKDF2-SHA256
 * Returns { hash, salt } both as hex strings
 */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );

  return {
    hash: bufToHex(new Uint8Array(bits)),
    salt: bufToHex(salt),
  };
}

/**
 * Verify a password against a stored hash + salt
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string,
): Promise<boolean> {
  const salt = hexToBuf(storedSalt);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );

  return bufToHex(new Uint8Array(bits)) === storedHash;
}

// ============ AES-GCM Encryption ============

/**
 * Encrypt a string using AES-GCM with the provided hex key
 * Returns { ciphertext, iv } both as base64 strings
 */
export async function encrypt(
  plaintext: string,
  hexKey: string,
): Promise<{ ciphertext: string; iv: string }> {
  const key = await importAESKey(hexKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );

  return {
    ciphertext: bufToBase64(new Uint8Array(cipherBuffer)),
    iv: bufToBase64(iv),
  };
}

/**
 * Decrypt a ciphertext using AES-GCM
 */
export async function decrypt(
  ciphertext: string,
  iv: string,
  hexKey: string,
): Promise<string> {
  const key = await importAESKey(hexKey);
  const cipherBuffer = base64ToBuf(ciphertext);
  const ivBuffer = base64ToBuf(iv);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    cipherBuffer,
  );

  return new TextDecoder().decode(plainBuffer);
}

// ============ Helpers ============

async function importAESKey(hexKey: string): Promise<CryptoKey> {
  const raw = hexToBuf(hexKey);
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function bufToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bufToBase64(buf: Uint8Array): string {
  let binary = '';
  for (const byte of buf) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBuf(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
