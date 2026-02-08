/**
 * JWT authentication middleware
 */
import { createMiddleware } from 'hono/factory';
import type { Env } from '../env.js';
import type { JWTPayload } from '../types.js';
import { verifyJWT } from '../services/auth.js';

// Extend Hono context with user info
declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    userEmail: string;
    userRole: 'user' | 'admin' | 'super_admin';
    jwtPayload: JWTPayload;
  }
}

/**
 * Middleware that requires a valid JWT access token.
 * Sets userId, userEmail, userRole on context.
 */
export const requireAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized', message: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyJWT<JWTPayload>(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json({ error: 'unauthorized', message: 'Invalid or expired token' }, 401);
  }

  c.set('userId', payload.sub);
  c.set('userEmail', payload.email);
  c.set('userRole', payload.role);
  c.set('jwtPayload', payload);

  return next();
});
