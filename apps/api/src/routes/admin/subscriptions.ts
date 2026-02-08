/**
 * Admin subscription management — change plans, view status
 */
import { Hono } from 'hono';
import type { Env } from '../../env.js';
import type { Subscription } from '../../types.js';
import { queryAll, queryOne, execute } from '../../db/queries.js';
import { grantTokens } from '../../services/tokens.js';
import { logAdminAction } from '../../middleware/auditLog.js';

const PLAN_TOKEN_GRANTS: Record<string, number> = {
  free: 500,
  pro: 10_000,
  enterprise: 50_000,
};

const adminSubscriptions = new Hono<{ Bindings: Env }>();

/** GET /admin/subscriptions — list all */
adminSubscriptions.get('/', async (c) => {
  const limit = Number(c.req.query('limit') ?? 50);
  const offset = Number(c.req.query('offset') ?? 0);
  const subs = await queryAll<Subscription>(
    c.env.DB,
    `SELECT s.*, u.email FROM subscriptions s
     JOIN users u ON u.id = s.user_id
     ORDER BY s.updated_at DESC LIMIT ? OFFSET ?`,
    limit, offset,
  );
  return c.json(subs);
});

/** GET /admin/subscriptions/:userId */
adminSubscriptions.get('/:userId', async (c) => {
  const sub = await queryOne<Subscription>(
    c.env.DB,
    'SELECT * FROM subscriptions WHERE user_id = ?',
    c.req.param('userId'),
  );
  if (!sub) return c.json({ error: 'not_found', message: 'Subscription not found' }, 404);
  return c.json(sub);
});

/**
 * PUT /admin/subscriptions/:userId/plan
 * Body: { plan: 'free' | 'pro' | 'enterprise', grantTokens?: boolean }
 * Changes plan and optionally grants the monthly token amount
 */
adminSubscriptions.put('/:userId/plan', async (c) => {
  const userId = c.req.param('userId');
  const body = await c.req.json<{ plan?: string; grantTokens?: boolean }>();

  if (!body.plan || !['free', 'pro', 'enterprise'].includes(body.plan)) {
    return c.json({ error: 'validation', message: "plan must be 'free', 'pro', or 'enterprise'" }, 400);
  }

  const now = new Date().toISOString();
  await execute(
    c.env.DB,
    `UPDATE subscriptions
     SET plan = ?, status = 'active', current_period_start = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    body.plan, now, userId,
  );

  // Optionally grant the monthly tokens for the new plan
  if (body.grantTokens !== false) {
    const grant = PLAN_TOKEN_GRANTS[body.plan] ?? 500;
    await grantTokens(c.env.DB, userId, grant, 'grant', `Plan changed to ${body.plan}`);
  }

  await logAdminAction(c.env.DB, c.get('userId'), 'subscription.change_plan', 'user', userId, {
    plan: body.plan, grantTokens: body.grantTokens !== false,
  });

  return c.json({ message: `Plan changed to ${body.plan}`, plan: body.plan });
});

/**
 * PUT /admin/subscriptions/:userId/status
 * Body: { status: 'active' | 'canceled' | 'past_due' }
 */
adminSubscriptions.put('/:userId/status', async (c) => {
  const userId = c.req.param('userId');
  const body = await c.req.json<{ status?: string }>();

  if (!body.status || !['active', 'canceled', 'past_due', 'trialing'].includes(body.status)) {
    return c.json({ error: 'validation', message: 'Invalid status' }, 400);
  }

  await execute(
    c.env.DB,
    'UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    body.status, userId,
  );

  await logAdminAction(c.env.DB, c.get('userId'), 'subscription.change_status', 'user', userId, {
    status: body.status,
  });

  return c.json({ message: 'Status updated', status: body.status });
});

export { adminSubscriptions };
