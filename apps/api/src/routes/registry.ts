/**
 * Registry routes — public model + service listings (cached)
 */
import { Hono } from 'hono';
import type { Env } from '../env.js';
import { requireAuth } from '../middleware/jwt.js';
import { listModels, listModelsByVendor, getModel } from '../services/modelRegistry.js';
import { listServices, resolveService } from '../services/serviceRegistry.js';

const KV_CACHE_TTL = 300; // 5 minutes

const registry = new Hono<{ Bindings: Env }>();

// All registry routes require auth
registry.use('*', requireAuth);

/**
 * GET /registry/models
 * Query: ?vendor=openai
 */
registry.get('/models', async (c) => {
  const vendor = c.req.query('vendor');
  const cacheKey = vendor ? `registry:models:${vendor}` : 'registry:models:all';

  // Check KV cache
  const cached = await c.env.KV.get(cacheKey, 'json');
  if (cached) {
    return c.json(cached);
  }

  const models = vendor
    ? await listModelsByVendor(c.env.DB, vendor)
    : await listModels(c.env.DB);

  // Cache in KV
  await c.env.KV.put(cacheKey, JSON.stringify(models), { expirationTtl: KV_CACHE_TTL });

  return c.json(models);
});

/**
 * GET /registry/models/:id
 */
registry.get('/models/:id', async (c) => {
  const model = await getModel(c.env.DB, c.req.param('id'));
  if (!model) {
    return c.json({ error: 'not_found', message: 'Model not found' }, 404);
  }
  return c.json(model);
});

/**
 * GET /registry/services
 */
registry.get('/services', async (c) => {
  const userId = c.get('userId');
  const cacheKey = `registry:services:${userId}`;

  const cached = await c.env.KV.get(cacheKey, 'json');
  if (cached) {
    return c.json(cached);
  }

  const services = await listServices(c.env.DB, userId);

  await c.env.KV.put(cacheKey, JSON.stringify(services), { expirationTtl: KV_CACHE_TTL });

  return c.json(services);
});

/**
 * GET /registry/services/:id
 */
registry.get('/services/:id', async (c) => {
  const userId = c.get('userId');
  const service = await resolveService(c.env.DB, c.req.param('id'), userId);
  if (!service) {
    return c.json({ error: 'not_found', message: 'Service not found' }, 404);
  }
  return c.json(service);
});

export { registry };
