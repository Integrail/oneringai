/**
 * Admin authorization middleware
 * Must be used AFTER requireAuth
 */
import { createMiddleware } from 'hono/factory';
import type { Env } from '../env.js';

/**
 * Require admin or super_admin role
 */
export const requireAdmin = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const role = c.get('userRole');
  if (role !== 'admin' && role !== 'super_admin') {
    return c.json({ error: 'forbidden', message: 'Admin access required' }, 403);
  }
  return next();
});

/**
 * Require super_admin role
 */
export const requireSuperAdmin = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const role = c.get('userRole');
  if (role !== 'super_admin') {
    return c.json({ error: 'forbidden', message: 'Super admin access required' }, 403);
  }
  return next();
});
