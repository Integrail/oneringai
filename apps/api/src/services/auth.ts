/**
 * Authentication service — user creation, JWT signing/verification
 */
import type { JWTPayload, User } from '../types.js';
import { hashPassword, verifyPassword } from './crypto.js';

const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days

// ============ User Management ============

export async function createUser(
  db: D1Database,
  email: string,
  password: string,
  name?: string,
): Promise<{ id: string; email: string; role: string }> {
  const id = crypto.randomUUID();
  const { hash, salt } = await hashPassword(password);
  const subId = crypto.randomUUID();

  // D1 doesn't support RETURNING — use batch to insert then select
  const results = await db.batch([
    db.prepare(
      'INSERT INTO users (id, email, password_hash, password_salt, name) VALUES (?, ?, ?, ?, ?)',
    ).bind(id, email.toLowerCase(), hash, salt, name ?? null),
    db.prepare(
      'INSERT INTO token_balances (user_id) VALUES (?)',
    ).bind(id),
    db.prepare(
      'INSERT INTO subscriptions (id, user_id) VALUES (?, ?)',
    ).bind(subId, id),
    db.prepare('SELECT id, email, role FROM users WHERE id = ?').bind(id),
  ]);

  const user = results[3]?.results?.[0] as { id: string; email: string; role: string } | undefined;
  if (!user) throw new Error('Failed to create user');
  return user;
}

export async function authenticateUser(
  db: D1Database,
  email: string,
  password: string,
): Promise<User | null> {
  const user = await db
    .prepare('SELECT * FROM users WHERE email = ? AND status = ?')
    .bind(email.toLowerCase(), 'active')
    .first<User>();

  if (!user) return null;

  const valid = await verifyPassword(password, user.password_hash, user.password_salt);
  return valid ? user : null;
}

// ============ JWT ============

export async function signAccessToken(
  user: { id: string; email: string; role: string },
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    sub: user.id,
    email: user.email,
    role: user.role as JWTPayload['role'],
    iat: now,
    exp: now + ACCESS_TOKEN_TTL,
  };
  return signJWT(payload as unknown as Record<string, unknown>, secret);
}

export async function signRefreshToken(
  userId: string,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    type: 'refresh',
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + REFRESH_TOKEN_TTL,
  };
  return signJWT(payload, secret);
}

export async function verifyJWT<T = JWTPayload>(
  token: string,
  secret: string,
): Promise<T | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const key = await getHMACKey(secret);

    // Verify signature
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = base64urlDecode(parts[2]!);
    const valid = await crypto.subtle.verify('HMAC', key, signature, data);
    if (!valid) return null;

    // Decode payload
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1]!))) as T & { exp?: number };

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

// ============ Refresh Token Storage ============

export async function storeRefreshToken(
  db: D1Database,
  userId: string,
  token: string,
): Promise<void> {
  const id = crypto.randomUUID();
  const hash = await sha256(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000).toISOString();

  await db
    .prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .bind(id, userId, hash, expiresAt)
    .run();
}

export async function validateRefreshToken(
  db: D1Database,
  token: string,
): Promise<string | null> {
  const hash = await sha256(token);
  const row = await db
    .prepare('SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = ?')
    .bind(hash)
    .first<{ user_id: string; expires_at: string }>();

  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    await db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').bind(hash).run();
    return null;
  }
  return row.user_id;
}

export async function revokeRefreshToken(db: D1Database, token: string): Promise<void> {
  const hash = await sha256(token);
  await db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').bind(hash).run();
}

export async function revokeAllRefreshTokens(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(userId).run();
}

// ============ Internal Helpers ============

async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const key = await getHMACKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, data);

  return `${headerB64}.${payloadB64}.${base64urlEncodeBuffer(new Uint8Array(sig))}`;
}

async function getHMACKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function base64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlEncodeBuffer(buf: Uint8Array): string {
  let binary = '';
  for (const byte of buf) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
