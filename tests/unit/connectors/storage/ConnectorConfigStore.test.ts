/**
 * ConnectorConfigStore Tests
 * Tests the domain service that handles encryption/decryption of ConnectorConfig
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectorConfigStore } from '@/connectors/storage/ConnectorConfigStore.js';
import { MemoryConnectorStorage } from '@/connectors/storage/MemoryConnectorStorage.js';
import { generateEncryptionKey } from '@/connectors/oauth/utils/encryption.js';
import type { ConnectorConfig } from '@/index.js';

describe('ConnectorConfigStore', () => {
  let storage: MemoryConnectorStorage;
  let store: ConnectorConfigStore;
  const encryptionKey = generateEncryptionKey();

  beforeEach(() => {
    storage = new MemoryConnectorStorage();
    store = new ConnectorConfigStore(storage, encryptionKey);
  });

  describe('constructor', () => {
    it('should throw if encryption key is too short', () => {
      expect(() => new ConnectorConfigStore(storage, 'short')).toThrow(
        'encryption key of at least 16 characters'
      );
    });

    it('should throw if encryption key is empty', () => {
      expect(() => new ConnectorConfigStore(storage, '')).toThrow(
        'encryption key of at least 16 characters'
      );
    });

    it('should accept valid encryption key', () => {
      expect(
        () => new ConnectorConfigStore(storage, 'this-is-a-valid-key')
      ).not.toThrow();
    });
  });

  describe('save() with API key auth', () => {
    it('should encrypt apiKey field', async () => {
      const config: ConnectorConfig = {
        name: 'openai',
        vendor: 'openai',
        auth: {
          type: 'api_key',
          apiKey: 'sk-secret-key-12345',
        },
      };

      await store.save('openai', config);

      // Check raw storage - should be encrypted
      const stored = await storage.get('openai');
      expect(stored?.config.auth.type).toBe('api_key');

      const auth = stored?.config.auth as { type: 'api_key'; apiKey: string };
      expect(auth.apiKey).not.toBe('sk-secret-key-12345');
      expect(auth.apiKey).toMatch(/^\$ENC\$:/);
    });

    it('should decrypt apiKey on retrieval', async () => {
      const config: ConnectorConfig = {
        name: 'openai',
        vendor: 'openai',
        auth: {
          type: 'api_key',
          apiKey: 'sk-secret-key-12345',
        },
      };

      await store.save('openai', config);
      const retrieved = await store.get('openai');

      expect(retrieved?.auth.type).toBe('api_key');
      const auth = retrieved?.auth as { type: 'api_key'; apiKey: string };
      expect(auth.apiKey).toBe('sk-secret-key-12345');
    });
  });

  describe('save() with OAuth auth', () => {
    it('should encrypt clientSecret field', async () => {
      const config: ConnectorConfig = {
        name: 'github',
        auth: {
          type: 'oauth',
          flow: 'authorization_code',
          clientId: 'client-id-123',
          clientSecret: 'super-secret-client-secret',
          tokenUrl: 'https://github.com/login/oauth/access_token',
          authorizationUrl: 'https://github.com/login/oauth/authorize',
        },
      };

      await store.save('github', config);

      const stored = await storage.get('github');
      const auth = stored?.config.auth as {
        type: 'oauth';
        clientId: string;
        clientSecret: string;
      };

      expect(auth.clientId).toBe('client-id-123'); // Not encrypted
      expect(auth.clientSecret).not.toBe('super-secret-client-secret');
      expect(auth.clientSecret).toMatch(/^\$ENC\$:/);
    });

    it('should encrypt privateKey field for OAuth', async () => {
      const config: ConnectorConfig = {
        name: 'service',
        auth: {
          type: 'oauth',
          flow: 'jwt_bearer',
          clientId: 'client-id',
          tokenUrl: 'https://example.com/token',
          privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----',
        },
      };

      await store.save('service', config);

      const stored = await storage.get('service');
      const auth = stored?.config.auth as { type: 'oauth'; privateKey?: string };

      expect(auth.privateKey).toMatch(/^\$ENC\$:/);
    });

    it('should handle optional fields (no clientSecret)', async () => {
      const config: ConnectorConfig = {
        name: 'public-client',
        auth: {
          type: 'oauth',
          flow: 'authorization_code',
          clientId: 'public-client-id',
          tokenUrl: 'https://example.com/token',
          authorizationUrl: 'https://example.com/authorize',
          // No clientSecret (public client)
        },
      };

      await store.save('public-client', config);
      const retrieved = await store.get('public-client');

      expect(retrieved?.auth.type).toBe('oauth');
      const auth = retrieved?.auth as { type: 'oauth'; clientSecret?: string };
      expect(auth.clientSecret).toBeUndefined();
    });

    it('should decrypt OAuth secrets on retrieval', async () => {
      const config: ConnectorConfig = {
        name: 'github',
        auth: {
          type: 'oauth',
          flow: 'authorization_code',
          clientId: 'client-id-123',
          clientSecret: 'my-secret',
          tokenUrl: 'https://github.com/token',
          authorizationUrl: 'https://github.com/auth',
        },
      };

      await store.save('github', config);
      const retrieved = await store.get('github');

      const auth = retrieved?.auth as { type: 'oauth'; clientSecret?: string };
      expect(auth.clientSecret).toBe('my-secret');
    });
  });

  describe('save() with JWT auth', () => {
    it('should encrypt privateKey field', async () => {
      const privateKey = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...\n-----END PRIVATE KEY-----';
      const config: ConnectorConfig = {
        name: 'google-service',
        auth: {
          type: 'jwt',
          clientId: 'service-account@project.iam.gserviceaccount.com',
          tokenUrl: 'https://oauth2.googleapis.com/token',
          privateKey,
        },
      };

      await store.save('google-service', config);

      const stored = await storage.get('google-service');
      const auth = stored?.config.auth as { type: 'jwt'; privateKey: string };

      expect(auth.privateKey).not.toBe(privateKey);
      expect(auth.privateKey).toMatch(/^\$ENC\$:/);
    });

    it('should decrypt JWT privateKey on retrieval', async () => {
      const privateKey = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----';
      const config: ConnectorConfig = {
        name: 'google-service',
        auth: {
          type: 'jwt',
          clientId: 'service@example.com',
          tokenUrl: 'https://example.com/token',
          privateKey,
        },
      };

      await store.save('google-service', config);
      const retrieved = await store.get('google-service');

      const auth = retrieved?.auth as { type: 'jwt'; privateKey: string };
      expect(auth.privateKey).toBe(privateKey);
    });
  });

  describe('save() validation', () => {
    it('should throw if name is empty', async () => {
      const config: ConnectorConfig = {
        auth: { type: 'api_key', apiKey: 'key' },
      };

      await expect(store.save('', config)).rejects.toThrow('name is required');
    });

    it('should throw if name is whitespace only', async () => {
      const config: ConnectorConfig = {
        auth: { type: 'api_key', apiKey: 'key' },
      };

      await expect(store.save('   ', config)).rejects.toThrow('name is required');
    });

    it('should set name in stored config', async () => {
      const config: ConnectorConfig = {
        auth: { type: 'api_key', apiKey: 'key' },
      };

      await store.save('my-connector', config);
      const retrieved = await store.get('my-connector');

      expect(retrieved?.name).toBe('my-connector');
    });
  });

  describe('save() metadata', () => {
    it('should set createdAt on first save', async () => {
      const before = Date.now();
      await store.save('connector', {
        auth: { type: 'api_key', apiKey: 'key' },
      });
      const after = Date.now();

      const metadata = await store.getMetadata('connector');

      expect(metadata?.createdAt).toBeGreaterThanOrEqual(before);
      expect(metadata?.createdAt).toBeLessThanOrEqual(after);
    });

    it('should preserve createdAt on update', async () => {
      await store.save('connector', {
        auth: { type: 'api_key', apiKey: 'key1' },
      });

      const metadata1 = await store.getMetadata('connector');

      // Wait a bit and update
      await new Promise((r) => setTimeout(r, 10));

      await store.save('connector', {
        auth: { type: 'api_key', apiKey: 'key2' },
      });

      const metadata2 = await store.getMetadata('connector');

      expect(metadata2?.createdAt).toBe(metadata1?.createdAt);
      expect(metadata2?.updatedAt).toBeGreaterThan(metadata1?.updatedAt!);
    });

    it('should set version', async () => {
      await store.save('connector', {
        auth: { type: 'api_key', apiKey: 'key' },
      });

      const metadata = await store.getMetadata('connector');
      expect(metadata?.version).toBe(1);
    });
  });

  describe('get()', () => {
    it('should return null for non-existent config', async () => {
      const retrieved = await store.get('nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should preserve non-sensitive fields', async () => {
      const config: ConnectorConfig = {
        name: 'test',
        vendor: 'openai',
        displayName: 'Test OpenAI',
        description: 'My test connector',
        baseURL: 'https://api.openai.com',
        defaultModel: 'gpt-4',
        tags: ['ai', 'test'],
        auth: { type: 'api_key', apiKey: 'secret' },
        options: {
          timeout: 30000,
          organization: 'my-org',
        },
      };

      await store.save('test', config);
      const retrieved = await store.get('test');

      expect(retrieved?.vendor).toBe('openai');
      expect(retrieved?.displayName).toBe('Test OpenAI');
      expect(retrieved?.description).toBe('My test connector');
      expect(retrieved?.baseURL).toBe('https://api.openai.com');
      expect(retrieved?.defaultModel).toBe('gpt-4');
      expect(retrieved?.tags).toEqual(['ai', 'test']);
      expect(retrieved?.options?.timeout).toBe(30000);
      expect(retrieved?.options?.organization).toBe('my-org');
    });
  });

  describe('delete()', () => {
    it('should delete existing config', async () => {
      await store.save('connector', {
        auth: { type: 'api_key', apiKey: 'key' },
      });

      const result = await store.delete('connector');

      expect(result).toBe(true);
      expect(await store.has('connector')).toBe(false);
    });

    it('should return false for non-existent config', async () => {
      const result = await store.delete('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('has()', () => {
    it('should return true for existing config', async () => {
      await store.save('connector', {
        auth: { type: 'api_key', apiKey: 'key' },
      });

      expect(await store.has('connector')).toBe(true);
    });

    it('should return false for non-existent config', async () => {
      expect(await store.has('nonexistent')).toBe(false);
    });
  });

  describe('list()', () => {
    it('should return all connector names', async () => {
      await store.save('openai', { auth: { type: 'api_key', apiKey: 'k1' } });
      await store.save('anthropic', { auth: { type: 'api_key', apiKey: 'k2' } });
      await store.save('google', { auth: { type: 'api_key', apiKey: 'k3' } });

      const names = await store.list();

      expect(names).toHaveLength(3);
      expect(names).toContain('openai');
      expect(names).toContain('anthropic');
      expect(names).toContain('google');
    });
  });

  describe('listAll()', () => {
    it('should return all configs with decrypted secrets', async () => {
      await store.save('openai', {
        vendor: 'openai',
        auth: { type: 'api_key', apiKey: 'sk-openai' },
      });
      await store.save('anthropic', {
        vendor: 'anthropic',
        auth: { type: 'api_key', apiKey: 'sk-anthropic' },
      });

      const configs = await store.listAll();

      expect(configs).toHaveLength(2);

      const openai = configs.find((c) => c.name === 'openai');
      const anthropic = configs.find((c) => c.name === 'anthropic');

      expect((openai?.auth as { apiKey: string }).apiKey).toBe('sk-openai');
      expect((anthropic?.auth as { apiKey: string }).apiKey).toBe('sk-anthropic');
    });
  });

  describe('getMetadata()', () => {
    it('should return metadata for existing config', async () => {
      await store.save('connector', {
        auth: { type: 'api_key', apiKey: 'key' },
      });

      const metadata = await store.getMetadata('connector');

      expect(metadata).not.toBeNull();
      expect(metadata?.createdAt).toBeDefined();
      expect(metadata?.updatedAt).toBeDefined();
      expect(metadata?.version).toBe(1);
    });

    it('should return null for non-existent config', async () => {
      const metadata = await store.getMetadata('nonexistent');
      expect(metadata).toBeNull();
    });
  });

  describe('encryption key isolation', () => {
    it('should not decrypt with different key', async () => {
      const store1 = new ConnectorConfigStore(storage, generateEncryptionKey());
      const store2 = new ConnectorConfigStore(storage, generateEncryptionKey());

      await store1.save('connector', {
        auth: { type: 'api_key', apiKey: 'secret-key' },
      });

      // store2 has different key, decryption should fail
      await expect(store2.get('connector')).rejects.toThrow();
    });

    it('should decrypt with same key across instances', async () => {
      const key = generateEncryptionKey();
      const store1 = new ConnectorConfigStore(storage, key);
      const store2 = new ConnectorConfigStore(storage, key);

      await store1.save('connector', {
        auth: { type: 'api_key', apiKey: 'secret-key' },
      });

      const retrieved = await store2.get('connector');
      expect((retrieved?.auth as { apiKey: string }).apiKey).toBe('secret-key');
    });
  });

  describe('idempotent encryption', () => {
    it('should not double-encrypt already encrypted values', async () => {
      await store.save('connector', {
        auth: { type: 'api_key', apiKey: 'my-key' },
      });

      // Save again (simulating update)
      const retrieved1 = await store.get('connector');
      await store.save('connector', retrieved1!);

      // Should still decrypt correctly
      const retrieved2 = await store.get('connector');
      expect((retrieved2?.auth as { apiKey: string }).apiKey).toBe('my-key');
    });
  });
});
