/**
 * Admin service management — service_overrides CRUD
 */
import { Hono } from 'hono';
import type { Env } from '../../env.js';
import type { ServiceOverride } from '../../types.js';
import { queryAll, queryOne, execute } from '../../db/queries.js';
import { logAdminAction } from '../../middleware/auditLog.js';

const adminServices = new Hono<{ Bindings: Env }>();

/** GET /admin/services — list all overrides */
adminServices.get('/', async (c) => {
  const overrides = await queryAll<ServiceOverride>(
    c.env.DB,
    'SELECT * FROM service_overrides ORDER BY service_id',
  );
  return c.json(overrides.map(formatOverride));
});

/** GET /admin/services/:id */
adminServices.get('/:id', async (c) => {
  const row = await queryOne<ServiceOverride>(
    c.env.DB,
    'SELECT * FROM service_overrides WHERE service_id = ?',
    c.req.param('id'),
  );
  if (!row) return c.json({ error: 'not_found', message: 'Service override not found' }, 404);
  return c.json(formatOverride(row));
});

/**
 * POST /admin/services — create service override
 */
adminServices.post('/', async (c) => {
  const body = await c.req.json<{
    serviceId: string;
    displayName?: string;
    isEnabled?: boolean;
    platformKeyEnabled?: boolean;
    pricingMultiplier?: number;
    meteringConfig?: Record<string, unknown>;
  }>();

  if (!body.serviceId) {
    return c.json({ error: 'validation', message: 'serviceId is required' }, 400);
  }

  await execute(
    c.env.DB,
    `INSERT INTO service_overrides (service_id, display_name, is_enabled, platform_key_enabled, pricing_multiplier, metering_config)
     VALUES (?, ?, ?, ?, ?, ?)`,
    body.serviceId,
    body.displayName ?? null,
    body.isEnabled !== false ? 1 : 0,
    body.platformKeyEnabled ? 1 : 0,
    body.pricingMultiplier ?? 2.0,
    JSON.stringify(body.meteringConfig ?? {}),
  );

  await logAdminAction(c.env.DB, c.get('userId'), 'service.create_override', 'service', body.serviceId);

  return c.json({ message: 'Override created' }, 201);
});

/** PUT /admin/services/:id */
adminServices.put('/:id', async (c) => {
  const serviceId = c.req.param('id');
  const body = await c.req.json<{
    displayName?: string;
    isEnabled?: boolean;
    platformKeyEnabled?: boolean;
    pricingMultiplier?: number;
    meteringConfig?: Record<string, unknown>;
  }>();

  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.displayName !== undefined) { sets.push('display_name = ?'); values.push(body.displayName); }
  if (body.isEnabled !== undefined) { sets.push('is_enabled = ?'); values.push(body.isEnabled ? 1 : 0); }
  if (body.platformKeyEnabled !== undefined) { sets.push('platform_key_enabled = ?'); values.push(body.platformKeyEnabled ? 1 : 0); }
  if (body.pricingMultiplier !== undefined) { sets.push('pricing_multiplier = ?'); values.push(body.pricingMultiplier); }
  if (body.meteringConfig !== undefined) { sets.push('metering_config = ?'); values.push(JSON.stringify(body.meteringConfig)); }

  if (sets.length === 0) return c.json({ error: 'validation', message: 'No fields to update' }, 400);

  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(serviceId);

  const result = await execute(c.env.DB, `UPDATE service_overrides SET ${sets.join(', ')} WHERE service_id = ?`, ...values);
  if ((result.meta?.changes ?? 0) === 0) return c.json({ error: 'not_found', message: 'Override not found' }, 404);

  await logAdminAction(c.env.DB, c.get('userId'), 'service.update_override', 'service', serviceId, body);

  return c.json({ message: 'Override updated' });
});

/** DELETE /admin/services/:id */
adminServices.delete('/:id', async (c) => {
  const serviceId = c.req.param('id');
  await execute(c.env.DB, 'DELETE FROM service_overrides WHERE service_id = ?', serviceId);
  await logAdminAction(c.env.DB, c.get('userId'), 'service.delete_override', 'service', serviceId);
  return c.json({ message: 'Override deleted' });
});

/**
 * PUT /admin/services/:id/platform-key — set platform API key in KV
 * Body: { apiKey }
 */
adminServices.put('/:id/platform-key', async (c) => {
  const serviceId = c.req.param('id');
  const body = await c.req.json<{ apiKey?: string }>();

  if (!body.apiKey) {
    return c.json({ error: 'validation', message: 'apiKey is required' }, 400);
  }

  await c.env.KV.put(`platform_key:${serviceId}`, body.apiKey);

  // Enable platform key in override
  await execute(
    c.env.DB,
    'UPDATE service_overrides SET platform_key_enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE service_id = ?',
    serviceId,
  );

  await logAdminAction(c.env.DB, c.get('userId'), 'service.set_platform_key', 'service', serviceId);

  return c.json({ message: 'Platform key set' });
});

/** DELETE /admin/services/:id/platform-key */
adminServices.delete('/:id/platform-key', async (c) => {
  const serviceId = c.req.param('id');
  await c.env.KV.delete(`platform_key:${serviceId}`);

  await execute(
    c.env.DB,
    'UPDATE service_overrides SET platform_key_enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE service_id = ?',
    serviceId,
  );

  await logAdminAction(c.env.DB, c.get('userId'), 'service.delete_platform_key', 'service', serviceId);

  return c.json({ message: 'Platform key deleted' });
});

function formatOverride(row: ServiceOverride) {
  return {
    serviceId: row.service_id,
    displayName: row.display_name,
    isEnabled: row.is_enabled === 1,
    platformKeyEnabled: row.platform_key_enabled === 1,
    pricingMultiplier: row.pricing_multiplier,
    meteringConfig: JSON.parse(row.metering_config || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export { adminServices };
