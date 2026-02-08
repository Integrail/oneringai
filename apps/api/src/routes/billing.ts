/**
 * Billing routes — balance, usage, transactions (no Stripe yet)
 */
import { Hono } from 'hono';
import type { Env } from '../env.js';
import { requireAuth } from '../middleware/jwt.js';
import { getBalance, getTransactions } from '../services/tokens.js';
import { queryAll } from '../db/queries.js';
import type { UsageLogEntry, Subscription } from '../types.js';

const billing = new Hono<{ Bindings: Env }>();

billing.use('*', requireAuth);

/** GET /billing/balance */
billing.get('/balance', async (c) => {
  const balance = await getBalance(c.env.DB, c.get('userId'));
  if (!balance) return c.json({ error: 'not_found', message: 'Balance not found' }, 404);
  return c.json(balance);
});

/** GET /billing/subscription */
billing.get('/subscription', async (c) => {
  const sub = await c.env.DB
    .prepare('SELECT * FROM subscriptions WHERE user_id = ?')
    .bind(c.get('userId'))
    .first<Subscription>();
  if (!sub) return c.json({ error: 'not_found', message: 'Subscription not found' }, 404);
  return c.json(sub);
});

/** GET /billing/transactions?limit=50&offset=0&type=usage */
billing.get('/transactions', async (c) => {
  const limit = Number(c.req.query('limit') ?? 50);
  const offset = Number(c.req.query('offset') ?? 0);
  const type = c.req.query('type');
  const txns = await getTransactions(c.env.DB, c.get('userId'), { limit, offset, type });
  return c.json(txns);
});

/** GET /billing/usage?days=30 */
billing.get('/usage', async (c) => {
  const days = Number(c.req.query('days') ?? 30);
  const usage = await queryAll<UsageLogEntry>(
    c.env.DB,
    `SELECT * FROM usage_log
     WHERE user_id = ? AND created_at >= date('now', '-' || ? || ' days')
     ORDER BY created_at DESC LIMIT 100`,
    c.get('userId'), days,
  );
  return c.json(usage);
});

export { billing };
