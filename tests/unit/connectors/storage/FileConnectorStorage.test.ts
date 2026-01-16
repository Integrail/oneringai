/**
 * FileConnectorStorage Tests
 * Tests file-based storage implementation for ConnectorConfig
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileConnectorStorage } from '@/connectors/storage/FileConnectorStorage.js';
import type { StoredConnectorConfig, ConnectorConfig } from '@/index.js';
import { tmpdir } from 'os';
import { join } from 'path';
import fs from 'fs/promises';

describe('FileConnectorStorage', () => {
  let storage: FileConnectorStorage;
  let testDir: string;

  const createTestConfig = (name: string): StoredConnectorConfig => ({
    config: {
      name,
      vendor: 'openai',
      auth: { type: 'api_key', apiKey: 'test-key-123' },
      displayName: `Test ${name}`,
      description: 'Test connector',
    } as ConnectorConfig,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  });

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `oneringai-connector-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(testDir, { recursive: true });

    storage = new FileConnectorStorage({ directory: testDir });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should throw if directory not provided', () => {
      expect(() => new FileConnectorStorage({ directory: '' })).toThrow(
        'FileConnectorStorage requires a directory path'
      );
    });
  });

  describe('save()', () => {
    it('should save config to file', async () => {
      const stored = createTestConfig('test-connector');

      await storage.save('test-connector', stored);

      // Verify file was created
      const files = await fs.readdir(testDir);
      const connectorFiles = files.filter((f) => f.endsWith('.connector.json'));
      expect(connectorFiles).toHaveLength(1);
    });

    it('should create index file', async () => {
      await storage.save('connector', createTestConfig('connector'));

      const indexPath = join(testDir, '_index.json');
      const indexContent = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(indexContent);

      expect(Object.values(index.connectors)).toContain('connector');
    });

    it('should hash filename to prevent enumeration', async () => {
      await storage.save('sensitive-connector-name', createTestConfig('sensitive-connector-name'));

      const files = await fs.readdir(testDir);
      const connectorFile = files.find((f) => f.endsWith('.connector.json'));

      expect(connectorFile).toBeDefined();
      expect(connectorFile).not.toContain('sensitive');
      expect(connectorFile).not.toContain('connector-name');
      expect(connectorFile).toMatch(/^[a-f0-9]{16}\.connector\.json$/);
    });

    it('should set file permissions to 0o600', async () => {
      await storage.save('connector', createTestConfig('connector'));

      const files = await fs.readdir(testDir);
      const connectorFile = files.find((f) => f.endsWith('.connector.json'));
      const stats = await fs.stat(join(testDir, connectorFile!));

      const permissions = (stats.mode & 0o777).toString(8);
      expect(permissions).toBe('600');
    });

    it('should update existing config (upsert)', async () => {
      const stored1 = createTestConfig('connector');
      stored1.config.displayName = 'Original';

      const stored2 = createTestConfig('connector');
      stored2.config.displayName = 'Updated';
      stored2.updatedAt = Date.now() + 1000;

      await storage.save('connector', stored1);
      await storage.save('connector', stored2);

      const retrieved = await storage.get('connector');
      expect(retrieved?.config.displayName).toBe('Updated');

      // Should still be only one file
      const files = await fs.readdir(testDir);
      const connectorFiles = files.filter((f) => f.endsWith('.connector.json'));
      expect(connectorFiles).toHaveLength(1);
    });
  });

  describe('get()', () => {
    it('should retrieve saved config', async () => {
      const stored = createTestConfig('my-connector');
      await storage.save('my-connector', stored);

      const retrieved = await storage.get('my-connector');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.config.name).toBe('my-connector');
      expect(retrieved?.config.displayName).toBe('Test my-connector');
      expect(retrieved?.version).toBe(1);
    });

    it('should return null for non-existent config', async () => {
      const retrieved = await storage.get('nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should persist across FileConnectorStorage instances', async () => {
      const stored = createTestConfig('persistent-connector');
      await storage.save('persistent-connector', stored);

      // Create new instance
      const storage2 = new FileConnectorStorage({ directory: testDir });

      const retrieved = await storage2.get('persistent-connector');
      expect(retrieved?.config.name).toBe('persistent-connector');
    });
  });

  describe('delete()', () => {
    it('should delete existing config and return true', async () => {
      await storage.save('connector', createTestConfig('connector'));

      const result = await storage.delete('connector');

      expect(result).toBe(true);
      expect(await storage.has('connector')).toBe(false);

      // Verify file is deleted
      const files = await fs.readdir(testDir);
      const connectorFiles = files.filter((f) => f.endsWith('.connector.json'));
      expect(connectorFiles).toHaveLength(0);
    });

    it('should update index on delete', async () => {
      await storage.save('connector', createTestConfig('connector'));
      await storage.delete('connector');

      const indexPath = join(testDir, '_index.json');
      const indexContent = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(indexContent);

      expect(Object.values(index.connectors)).not.toContain('connector');
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
  });

  describe('clear()', () => {
    it('should remove all connector files and index', async () => {
      await storage.save('connector-1', createTestConfig('connector-1'));
      await storage.save('connector-2', createTestConfig('connector-2'));

      await storage.clear();

      const files = await fs.readdir(testDir);
      const relevantFiles = files.filter(
        (f) => f.endsWith('.connector.json') || f === '_index.json'
      );
      expect(relevantFiles).toHaveLength(0);
    });
  });

  describe('directory creation', () => {
    it('should create directory if it does not exist', async () => {
      const newDir = join(testDir, 'nested', 'subdir');
      const newStorage = new FileConnectorStorage({ directory: newDir });

      await newStorage.save('connector', createTestConfig('connector'));

      const retrieved = await newStorage.get('connector');
      expect(retrieved?.config.name).toBe('connector');
    });

    it('should set directory permissions to 0o700', async () => {
      const newDir = join(testDir, 'secure-dir');
      const newStorage = new FileConnectorStorage({ directory: newDir });
      await newStorage.save('connector', createTestConfig('connector'));

      const stats = await fs.stat(newDir);
      const permissions = (stats.mode & 0o777).toString(8);
      expect(permissions).toBe('700');
    });
  });
});
