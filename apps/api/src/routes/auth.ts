/**
 * Auth routes — signup, signin, refresh, logout
 */
import { Hono } from 'hono';
import type { Env } from '../env.js';
import {
  createUser,
  authenticateUser,
  signAccessToken,
  signRefreshToken,
  storeRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  verifyJWT,
} from '../services/auth.js';
import { requireAuth } from '../middleware/jwt.js';

const auth = new Hono<{ Bindings: Env }>();

/**
 * POST /auth/signup
 * Body: { email, password, name? }
 */
auth.post('/signup', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string; name?: string }>();

  if (!body.email || !body.password) {
    return c.json({ error: 'validation', message: 'Email and password are required' }, 400);
  }

  if (body.password.length < 8) {
    return c.json({ error: 'validation', message: 'Password must be at least 8 characters' }, 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return c.json({ error: 'validation', message: 'Invalid email format' }, 400);
  }

  try {
    const user = await createUser(c.env.DB, body.email, body.password, body.name);
    const accessToken = await signAccessToken(user, c.env.JWT_SECRET);
    const refreshToken = await signRefreshToken(user.id, c.env.JWT_SECRET);
    await storeRefreshToken(c.env.DB, user.id, refreshToken);

    return c.json({
      user: { id: user.id, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('UNIQUE constraint failed') || message.includes('users.email')) {
      return c.json({ error: 'conflict', message: 'Email already registered' }, 409);
    }
    throw err;
  }
});

/**
 * POST /auth/signin
 * Body: { email, password }
 */
auth.post('/signin', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();

  if (!body.email || !body.password) {
    return c.json({ error: 'validation', message: 'Email and password are required' }, 400);
  }

  const user = await authenticateUser(c.env.DB, body.email, body.password);
  if (!user) {
    return c.json({ error: 'unauthorized', message: 'Invalid email or password' }, 401);
  }

  const accessToken = await signAccessToken(user, c.env.JWT_SECRET);
  const refreshToken = await signRefreshToken(user.id, c.env.JWT_SECRET);
  await storeRefreshToken(c.env.DB, user.id, refreshToken);

  return c.json({
    user: { id: user.id, email: user.email, role: user.role, name: user.name },
    accessToken,
    refreshToken,
  });
});

/**
 * POST /auth/refresh
 * Body: { refreshToken }
 */
auth.post('/refresh', async (c) => {
  const body = await c.req.json<{ refreshToken?: string }>();

  if (!body.refreshToken) {
    return c.json({ error: 'validation', message: 'Refresh token is required' }, 400);
  }

  // Verify the JWT signature and expiry
  const payload = await verifyJWT<{ sub: string; type: string }>(body.refreshToken, c.env.JWT_SECRET);
  if (!payload || payload.type !== 'refresh') {
    return c.json({ error: 'unauthorized', message: 'Invalid refresh token' }, 401);
  }

  // Verify it exists in DB (not revoked)
  const userId = await validateRefreshToken(c.env.DB, body.refreshToken);
  if (!userId) {
    return c.json({ error: 'unauthorized', message: 'Refresh token revoked or expired' }, 401);
  }

  // Get current user data for new access token
  const user = await c.env.DB
    .prepare('SELECT id, email, role FROM users WHERE id = ? AND status = ?')
    .bind(userId, 'active')
    .first<{ id: string; email: string; role: string }>();

  if (!user) {
    return c.json({ error: 'unauthorized', message: 'User not found or inactive' }, 401);
  }

  // Rotate refresh token
  await revokeRefreshToken(c.env.DB, body.refreshToken);
  const newAccessToken = await signAccessToken(user, c.env.JWT_SECRET);
  const newRefreshToken = await signRefreshToken(userId, c.env.JWT_SECRET);
  await storeRefreshToken(c.env.DB, userId, newRefreshToken);

  return c.json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
});

/**
 * POST /auth/logout (requires auth)
 * Body: { refreshToken? }
 * If refreshToken provided, revokes just that one. Otherwise revokes all.
 */
auth.post('/logout', requireAuth, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ refreshToken?: string }>().catch(() => ({} as { refreshToken?: string }));

  if (body.refreshToken) {
    await revokeRefreshToken(c.env.DB, body.refreshToken);
  } else {
    await revokeAllRefreshTokens(c.env.DB, userId);
  }

  return c.json({ message: 'Logged out successfully' });
});

export { auth };
