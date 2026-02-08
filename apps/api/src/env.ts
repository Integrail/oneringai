/**
 * Cloudflare Worker environment bindings
 */
export interface Env {
  // D1 Database
  DB: D1Database;

  // KV Namespace (caching, rate limiting, platform keys)
  KV: KVNamespace;

  // Secrets
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;

  // Vars
  ENVIRONMENT: string;
}
