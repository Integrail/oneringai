/**
 * Admin user management
 */
import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { listUsers, getUserById, updateUser } from '../../services/users.js';
import { logAdminAction } from '../../middleware/auditLog.js';
import { queryOne } from '../../db/queries.js';
import type { TokenBalance, Subscription } from '../../types.js';

const adminUsers = new Hono<{ Bindings: Env }>();

/** GET /admin/users */
adminUsers.get('/', async (c) => {
  const limit = Number(c.req.query('limit') ?? 50);
  const offset = Number(c.req.query('offset') ?? 0);
  const status = c.req.query('status');
  const users = await listUsers(c.env.DB, { limit, offset, status });
  return c.json(users);
});

/** GET /admin/users/:id */
adminUsers.get('/:id', async (c) => {
  const user = await getUserById(c.env.DB, c.req.param('id'));
  if (!user) return c.json({ error: 'not_found', message: 'User not found' }, 404);

  const [balance, subscription] = await Promise.all([
    queryOne<TokenBalance>(c.env.DB, 'SELECT * FROM token_balances WHERE user_id = ?', user.id),
    queryOne<Subscription>(c.env.DB, 'SELECT * FROM subscriptions WHERE user_id = ?', user.id),
  ]);

  return c.json({ ...user, balance, subscription });
});

/** PUT /admin/users/:id — update role, status, name */
adminUsers.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ role?: string; status?: string; name?: string }>();
  const updated = await updateUser(c.env.DB, id, body);

  if (!updated) return c.json({ error: 'not_found', message: 'User not found or no changes' }, 404);

  await logAdminAction(c.env.DB, c.get('userId'), 'user.update', 'user', id, body);
  return c.json({ message: 'Updated' });
});

/** PUT /admin/users/:id/suspend */
adminUsers.put('/:id/suspend', async (c) => {
  const id = c.req.param('id');
  await updateUser(c.env.DB, id, { status: 'suspended' });
  await logAdminAction(c.env.DB, c.get('userId'), 'user.suspend', 'user', id);
  return c.json({ message: 'User suspended' });
});

/** PUT /admin/users/:id/activate */
adminUsers.put('/:id/activate', async (c) => {
  const id = c.req.param('id');
  await updateUser(c.env.DB, id, { status: 'active' });
  await logAdminAction(c.env.DB, c.get('userId'), 'user.activate', 'user', id);
  return c.json({ message: 'User activated' });
});

export { adminUsers };
