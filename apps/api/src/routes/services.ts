/**
 * Custom services CRUD — user-defined services
 */
import { Hono } from 'hono';
import type { Env } from '../env.js';
import type { CustomService } from '../types.js';
import { requireAuth } from '../middleware/jwt.js';
import { queryAll, queryOne, execute } from '../db/queries.js';

const services = new Hono<{ Bindings: Env }>();

services.use('*', requireAuth);

/**
 * GET /services — list user's custom services
 */
services.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await queryAll<CustomService>(
    c.env.DB,
    'SELECT * FROM custom_services WHERE user_id = ? ORDER BY created_at DESC',
    userId,
  );
  return c.json(rows.map(formatService));
});

/**
 * GET /services/:id
 */
services.get('/:id', async (c) => {
  const userId = c.get('userId');
  const row = await queryOne<CustomService>(
    c.env.DB,
    'SELECT * FROM custom_services WHERE id = ? AND user_id = ?',
    c.req.param('id'), userId,
  );
  if (!row) return c.json({ error: 'not_found', message: 'Service not found' }, 404);
  return c.json(formatService(row));
});

/**
 * POST /services — create custom service
 */
services.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{
    id?: string;
    name?: string;
    baseUrl?: string;
    authType?: string;
    authConfig?: Record<string, unknown>;
    meteringConfig?: Record<string, unknown>;
  }>();

  if (!body.name || !body.baseUrl) {
    return c.json({ error: 'validation', message: 'name and baseUrl are required' }, 400);
  }

  const id = body.id ?? crypto.randomUUID();
  const authType = body.authType ?? 'bearer';

  await execute(
    c.env.DB,
    `INSERT INTO custom_services (id, user_id, name, base_url, auth_type, auth_config, metering_config)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id, userId, body.name, body.baseUrl, authType,
    JSON.stringify(body.authConfig ?? {}),
    JSON.stringify(body.meteringConfig ?? {}),
  );

  return c.json({ id, name: body.name, baseUrl: body.baseUrl }, 201);
});

/**
 * PUT /services/:id
 */
services.put('/:id', async (c) => {
  const userId = c.get('userId');
  const serviceId = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    baseUrl?: string;
    authType?: string;
    authConfig?: Record<string, unknown>;
    meteringConfig?: Record<string, unknown>;
    isActive?: boolean;
  }>();

  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) { sets.push('name = ?'); values.push(body.name); }
  if (body.baseUrl !== undefined) { sets.push('base_url = ?'); values.push(body.baseUrl); }
  if (body.authType !== undefined) { sets.push('auth_type = ?'); values.push(body.authType); }
  if (body.authConfig !== undefined) { sets.push('auth_config = ?'); values.push(JSON.stringify(body.authConfig)); }
  if (body.meteringConfig !== undefined) { sets.push('metering_config = ?'); values.push(JSON.stringify(body.meteringConfig)); }
  if (body.isActive !== undefined) { sets.push('is_active = ?'); values.push(body.isActive ? 1 : 0); }

  if (sets.length === 0) return c.json({ error: 'validation', message: 'No fields to update' }, 400);

  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(serviceId, userId);

  const result = await execute(
    c.env.DB,
    `UPDATE custom_services SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
    ...values,
  );

  if ((result.meta?.changes ?? 0) === 0) {
    return c.json({ error: 'not_found', message: 'Service not found' }, 404);
  }

  return c.json({ message: 'Updated' });
});

/**
 * DELETE /services/:id
 */
services.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const result = await execute(
    c.env.DB,
    'DELETE FROM custom_services WHERE id = ? AND user_id = ?',
    c.req.param('id'), userId,
  );

  if ((result.meta?.changes ?? 0) === 0) {
    return c.json({ error: 'not_found', message: 'Service not found' }, 404);
  }

  return c.json({ message: 'Deleted' });
});

function formatService(row: CustomService) {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    authType: row.auth_type,
    authConfig: JSON.parse(row.auth_config || '{}'),
    meteringConfig: JSON.parse(row.metering_config || '{}'),
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export { services };
