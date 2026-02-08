/**
 * OneRingAI API — Cloudflare Worker entry point
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './env.js';
import { auth, registry, services, credentials, proxy, billing, admin } from './routes/index.js';

const app = new Hono<{ Bindings: Env }>();

// ============ Global Middleware ============

app.use('*', cors({
  origin: '*', // TODO: restrict in production
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Use-Platform-Key', 'X-Credential-Id'],
  maxAge: 86400,
}));

// ============ Health Check ============

app.get('/', (c) => c.json({
  name: 'OneRingAI API',
  version: '0.1.0',
  status: 'ok',
}));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ============ Routes ============

app.route('/auth', auth);
app.route('/registry', registry);
app.route('/services', services);
app.route('/credentials', credentials);
app.route('/proxy', proxy);
app.route('/billing', billing);
app.route('/admin', admin);

// ============ Global Error Handler ============

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: 'internal_error',
      message: c.env.ENVIRONMENT === 'production' ? 'Internal server error' : err.message,
    },
    500,
  );
});

app.notFound((c) => c.json({ error: 'not_found', message: 'Route not found' }, 404));

export default app;
