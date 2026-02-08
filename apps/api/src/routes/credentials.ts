/**
 * Credentials CRUD — encrypted user API key storage
 */
import { Hono } from 'hono';
import type { Env } from '../env.js';
import type { UserCredential } from '../types.js';
import { requireAuth } from '../middleware/jwt.js';
import { encrypt, decrypt } from '../services/crypto.js';
import { queryAll, queryOne, execute } from '../db/queries.js';

const credentials = new Hono<{ Bindings: Env }>();

credentials.use('*', requireAuth);

/**
 * GET /credentials — list user credentials (no secrets)
 */
credentials.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await queryAll<UserCredential>(
    c.env.DB,
    'SELECT id, user_id, service_id, label, is_default, created_at, updated_at FROM user_credentials WHERE user_id = ? ORDER BY service_id, created_at',
    userId,
  );
  return c.json(rows.map((r) => ({
    id: r.id,
    serviceId: r.service_id,
    label: r.label,
    isDefault: r.is_default === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  })));
});

/**
 * GET /credentials/:serviceId — list credentials for a service
 */
credentials.get('/:serviceId', async (c) => {
  const userId = c.get('userId');
  const serviceId = c.req.param('serviceId');
  const rows = await queryAll<UserCredential>(
    c.env.DB,
    'SELECT id, user_id, service_id, label, is_default, created_at, updated_at FROM user_credentials WHERE user_id = ? AND service_id = ? ORDER BY created_at',
    userId, serviceId,
  );
  return c.json(rows.map((r) => ({
    id: r.id,
    serviceId: r.service_id,
    label: r.label,
    isDefault: r.is_default === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  })));
});

/**
 * POST /credentials — store encrypted API key
 * Body: { serviceId, apiKey, label?, isDefault? }
 */
credentials.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{
    serviceId?: string;
    apiKey?: string;
    label?: string;
    isDefault?: boolean;
  }>();

  if (!body.serviceId || !body.apiKey) {
    return c.json({ error: 'validation', message: 'serviceId and apiKey are required' }, 400);
  }

  const id = crypto.randomUUID();
  const { ciphertext, iv } = await encrypt(body.apiKey, c.env.ENCRYPTION_KEY);

  // If setting as default, unset other defaults for this service
  if (body.isDefault) {
    await execute(
      c.env.DB,
      'UPDATE user_credentials SET is_default = 0 WHERE user_id = ? AND service_id = ?',
      userId, body.serviceId,
    );
  }

  await execute(
    c.env.DB,
    `INSERT INTO user_credentials (id, user_id, service_id, label, encrypted_key, iv, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id, userId, body.serviceId, body.label ?? null, ciphertext, iv, body.isDefault ? 1 : 0,
  );

  return c.json({ id, serviceId: body.serviceId, label: body.label ?? null }, 201);
});

/**
 * PUT /credentials/:id — update label or default status
 */
credentials.put('/:id', async (c) => {
  const userId = c.get('userId');
  const credId = c.req.param('id');
  const body = await c.req.json<{ label?: string; isDefault?: boolean; apiKey?: string }>();

  // If updating the key itself, re-encrypt
  if (body.apiKey) {
    const { ciphertext, iv } = await encrypt(body.apiKey, c.env.ENCRYPTION_KEY);
    await execute(
      c.env.DB,
      'UPDATE user_credentials SET encrypted_key = ?, iv = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      ciphertext, iv, credId, userId,
    );
  }

  if (body.isDefault) {
    // Get service_id first
    const cred = await queryOne<UserCredential>(
      c.env.DB,
      'SELECT service_id FROM user_credentials WHERE id = ? AND user_id = ?',
      credId, userId,
    );
    if (cred) {
      await execute(
        c.env.DB,
        'UPDATE user_credentials SET is_default = 0 WHERE user_id = ? AND service_id = ?',
        userId, cred.service_id,
      );
    }
    await execute(
      c.env.DB,
      'UPDATE user_credentials SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      credId, userId,
    );
  }

  if (body.label !== undefined) {
    await execute(
      c.env.DB,
      'UPDATE user_credentials SET label = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      body.label, credId, userId,
    );
  }

  return c.json({ message: 'Updated' });
});

/**
 * DELETE /credentials/:id
 */
credentials.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const result = await execute(
    c.env.DB,
    'DELETE FROM user_credentials WHERE id = ? AND user_id = ?',
    c.req.param('id'), userId,
  );

  if ((result.meta?.changes ?? 0) === 0) {
    return c.json({ error: 'not_found', message: 'Credential not found' }, 404);
  }

  return c.json({ message: 'Deleted' });
});

/**
 * Decrypt a credential (internal use by proxy)
 */
export async function decryptCredential(
  db: D1Database,
  credentialId: string,
  userId: string,
  encryptionKey: string,
): Promise<string | null> {
  const cred = await queryOne<UserCredential>(
    db,
    'SELECT * FROM user_credentials WHERE id = ? AND user_id = ?',
    credentialId, userId,
  );
  if (!cred) return null;
  return decrypt(cred.encrypted_key, cred.iv, encryptionKey);
}

/**
 * Get and decrypt default credential for a service (internal use by proxy)
 */
export async function getDefaultCredential(
  db: D1Database,
  userId: string,
  serviceId: string,
  encryptionKey: string,
): Promise<string | null> {
  const cred = await queryOne<UserCredential>(
    db,
    'SELECT * FROM user_credentials WHERE user_id = ? AND service_id = ? AND is_default = 1',
    userId, serviceId,
  );
  if (!cred) {
    // Fallback to any credential for this service
    const anyCred = await queryOne<UserCredential>(
      db,
      'SELECT * FROM user_credentials WHERE user_id = ? AND service_id = ? ORDER BY created_at DESC LIMIT 1',
      userId, serviceId,
    );
    if (!anyCred) return null;
    return decrypt(anyCred.encrypted_key, anyCred.iv, encryptionKey);
  }
  return decrypt(cred.encrypted_key, cred.iv, encryptionKey);
}

export { credentials };
