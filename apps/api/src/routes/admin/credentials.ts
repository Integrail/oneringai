/**
 * Admin credential management — platform credential overview
 */
import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { queryAll } from '../../db/queries.js';

const adminCredentials = new Hono<{ Bindings: Env }>();

/** GET /admin/credentials — list all platform keys (KV) */
adminCredentials.get('/platform-keys', async (c) => {
  // List KV keys with platform_key: prefix
  const list = await c.env.KV.list({ prefix: 'platform_key:' });
  const keys = list.keys.map((k) => ({
    serviceId: k.name.replace('platform_key:', ''),
    name: k.name,
  }));
  return c.json(keys);
});

/** GET /admin/credentials/stats — credential usage stats */
adminCredentials.get('/stats', async (c) => {
  const stats = await queryAll<{ service_id: string; count: number }>(
    c.env.DB,
    `SELECT service_id, COUNT(*) as count
     FROM user_credentials
     GROUP BY service_id
     ORDER BY count DESC`,
  );
  return c.json(stats);
});

export { adminCredentials };
