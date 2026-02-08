import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: {
          configPath: './wrangler.toml',
        },
        miniflare: {
          d1Databases: {
            DB: {
              // Apply schema on test startup
              migrationsPath: '.',
              migrationsTable: '__migrations',
            },
          },
          kvNamespaces: ['KV'],
          bindings: {
            JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
            ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            ENVIRONMENT: 'test',
          },
        },
      },
    },
  },
});
