/**
 * Admin analytics — platform overview, usage stats
 */
import { Hono } from 'hono';
import type { Env } from '../../env.js';
import {
  getPlatformOverview,
  getUsageByService,
  getTopUsers,
  getDailyUsage,
} from '../../services/analytics.js';

const adminAnalytics = new Hono<{ Bindings: Env }>();

/** GET /admin/analytics/overview */
adminAnalytics.get('/overview', async (c) => {
  const overview = await getPlatformOverview(c.env.DB);
  return c.json(overview);
});

/** GET /admin/analytics/usage/services?days=30 */
adminAnalytics.get('/usage/services', async (c) => {
  const days = Number(c.req.query('days') ?? 30);
  const usage = await getUsageByService(c.env.DB, days);
  return c.json(usage);
});

/** GET /admin/analytics/usage/users?days=30&limit=20 */
adminAnalytics.get('/usage/users', async (c) => {
  const days = Number(c.req.query('days') ?? 30);
  const limit = Number(c.req.query('limit') ?? 20);
  const users = await getTopUsers(c.env.DB, limit, days);
  return c.json(users);
});

/** GET /admin/analytics/usage/daily?days=30 */
adminAnalytics.get('/usage/daily', async (c) => {
  const days = Number(c.req.query('days') ?? 30);
  const daily = await getDailyUsage(c.env.DB, days);
  return c.json(daily);
});

export { adminAnalytics };
