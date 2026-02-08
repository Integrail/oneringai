/**
 * Admin token management — grant, adjust, view balances
 */
import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { getBalance, grantTokens, getTransactions } from '../../services/tokens.js';
import { logAdminAction } from '../../middleware/auditLog.js';

const adminTokens = new Hono<{ Bindings: Env }>();

/** GET /admin/tokens/:userId/balance */
adminTokens.get('/:userId/balance', async (c) => {
  const balance = await getBalance(c.env.DB, c.req.param('userId'));
  if (!balance) return c.json({ error: 'not_found', message: 'User not found' }, 404);
  return c.json(balance);
});

/** GET /admin/tokens/:userId/transactions */
adminTokens.get('/:userId/transactions', async (c) => {
  const limit = Number(c.req.query('limit') ?? 50);
  const offset = Number(c.req.query('offset') ?? 0);
  const type = c.req.query('type');
  const txns = await getTransactions(c.env.DB, c.req.param('userId'), { limit, offset, type });
  return c.json(txns);
});

/**
 * POST /admin/tokens/:userId/grant
 * Body: { amount, description? }
 */
adminTokens.post('/:userId/grant', async (c) => {
  const userId = c.req.param('userId');
  const body = await c.req.json<{ amount?: number; description?: string }>();

  if (!body.amount || body.amount <= 0) {
    return c.json({ error: 'validation', message: 'amount must be a positive number' }, 400);
  }

  const newBalance = await grantTokens(
    c.env.DB, userId, body.amount, 'grant',
    body.description ?? `Admin grant by ${c.get('userEmail')}`,
  );

  await logAdminAction(c.env.DB, c.get('userId'), 'tokens.grant', 'user', userId, {
    amount: body.amount, newBalance,
  });

  return c.json({ newBalance, granted: body.amount });
});

/**
 * POST /admin/tokens/:userId/adjust
 * Body: { amount (positive or negative), description }
 */
adminTokens.post('/:userId/adjust', async (c) => {
  const userId = c.req.param('userId');
  const body = await c.req.json<{ amount?: number; description?: string }>();

  if (body.amount === undefined || body.amount === 0) {
    return c.json({ error: 'validation', message: 'amount is required and must be non-zero' }, 400);
  }

  const type = body.amount > 0 ? 'adjustment' : 'adjustment';
  const newBalance = await grantTokens(
    c.env.DB, userId, body.amount, type,
    body.description ?? `Admin adjustment by ${c.get('userEmail')}`,
  );

  await logAdminAction(c.env.DB, c.get('userId'), 'tokens.adjust', 'user', userId, {
    amount: body.amount, newBalance,
  });

  return c.json({ newBalance, adjusted: body.amount });
});

export { adminTokens };
