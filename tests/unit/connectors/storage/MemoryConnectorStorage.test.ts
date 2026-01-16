/**
 * MemoryConnectorStorage Tests
 * Tests in-memory storage implementation for ConnectorConfig
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryConnectorStorage } from '@/connectors/storage/MemoryConnectorStorage.js';
import type { StoredConnectorConfig, ConnectorConfig } from '@/index.js';

describe('MemoryConnectorStorage', () => {
  let storage: MemoryConnectorStorage;

  const createTestConfig = (name: string): StoredConnectorConfig => ({
    config: {
      name,
      vendor: 'openai',
      auth: { type: 'api_key', apiKey: 'test-key' },
      displayName: `Test ${name}`,
    } as ConnectorConfig,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  });

  beforeEach(() => {
    storage = new MemoryConnectorStorage();
  });

  describe('save()', () => {
    it('should save a connector config', async () => {
      const stored = createTestConfig('test-connector');

      await storage.save('test-connector', stored);

      expect(await storage.has('test-connector')).toBe(true);
    });

    it('should overwrite existing config with same name', async () => {
      const stored1 = createTestConfig('connector');
      stored1.config.displayName = 'Original';

      const stored2 = createTestConfig('connector');
      stored2.config.displayName = 'Updated';
      stored2.updatedAt = Date.now() + 1000;

      await storage.save('connector', stored1);
      await storage.save('connector', stored2);

      const retrieved = await storage.get('connector');
      expect(retrieved?.config.displayName).toBe('Updated');
    });

    it('should deep clone data to prevent external mutation', async () => {
      const stored = createTestConfig('connector');
      await storage.save('connector', stored);

      // Mutate original
      stored.config.displayName = 'Mutated';

      const retrieved = await storage.get('connector');
      expect(retrieved?.config.displayName).toBe('Test connector');
    });
  });

  describe('get()', () => {
    it('should retrieve saved config', async () => {
      const stored = createTestConfig('my-connector');
      await storage.save('my-connector', stored);

      const retrieved = await storage.get('my-connector');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.config.name).toBe('my-connector');
      expect(retrieved?.version).toBe(1);
    });

    it('should return null for non-existent config', async () => {
      const retrieved = await storage.get('nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should return a copy to prevent external mutation', async () => {
      const stored = createTestConfig('connector');
      await storage.save('connector', stored);

      const retrieved1 = await storage.get('connector');
      retrieved1!.config.displayName = 'Mutated';

      const retrieved2 = await storage.get('connector');
      expect(retrieved2?.config.displayName).toBe('Test connector');
    });
  });

  describe('delete()', () => {
    it('should delete existing config and return true', async () => {
      await storage.save('connector', createTestConfig('connector'));

      const result = await storage.delete('connector');

      expect(result).toBe(true);
      expect(await storage.has('connector')).toBe(false);
    });

    it('should return false for non-existent config', async () => {
      const result = await storage.delete('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('has()', () => {
    it('should return true for existing config', async () => {
      await storage.save('connector', createTestConfig('connector'));
      expect(await storage.has('connector')).toBe(true);
    });

    it('should return false for non-existent config', async () => {
      expect(await storage.has('nonexistent')).toBe(false);
    });
  });

  describe('list()', () => {
    it('should return empty array when no configs', async () => {
      const names = await storage.list();
      expect(names).toEqual([]);
    });

    it('should return all connector names', async () => {
      await storage.save('connector-1', createTestConfig('connector-1'));
      await storage.save('connector-2', createTestConfig('connector-2'));
      await storage.save('connector-3', createTestConfig('connector-3'));

      const names = await storage.list();

      expect(names).toHaveLength(3);
      expect(names).toContain('connector-1');
      expect(names).toContain('connector-2');
      expect(names).toContain('connector-3');
    });
  });

  describe('listAll()', () => {
    it('should return empty array when no configs', async () => {
      const configs = await storage.listAll();
      expect(configs).toEqual([]);
    });

    it('should return all stored configs', async () => {
      await storage.save('connector-1', createTestConfig('connector-1'));
      await storage.save('connector-2', createTestConfig('connector-2'));

      const configs = await storage.listAll();

      expect(configs).toHaveLength(2);
      expect(configs.map((c) => c.config.name)).toContain('connector-1');
      expect(configs.map((c) => c.config.name)).toContain('connector-2');
    });

    it('should return copies to prevent mutation', async () => {
      await storage.save('connector', createTestConfig('connector'));

      const configs = await storage.listAll();
      configs[0].config.displayName = 'Mutated';

      const retrieved = await storage.get('connector');
      expect(retrieved?.config.displayName).toBe('Test connector');
    });
  });

  describe('clear()', () => {
    it('should remove all configs', async () => {
      await storage.save('connector-1', createTestConfig('connector-1'));
      await storage.save('connector-2', createTestConfig('connector-2'));

      storage.clear();

      expect(storage.size()).toBe(0);
      expect(await storage.list()).toEqual([]);
    });
  });

  describe('size()', () => {
    it('should return 0 when empty', () => {
      expect(storage.size()).toBe(0);
    });

    it('should return correct count', async () => {
      await storage.save('connector-1', createTestConfig('connector-1'));
      await storage.save('connector-2', createTestConfig('connector-2'));

      expect(storage.size()).toBe(2);
    });
  });
});
