/**
 * Tests for FileCustomToolStorage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { FileCustomToolStorage } from '../../../src/infrastructure/storage/FileCustomToolStorage.js';
import type { CustomToolDefinition } from '../../../src/domain/entities/CustomToolDefinition.js';
import { CUSTOM_TOOL_DEFINITION_VERSION } from '../../../src/domain/entities/CustomToolDefinition.js';

describe('FileCustomToolStorage', () => {
  let storage: FileCustomToolStorage;
  let testDir: string;

  function makeDefinition(name: string, overrides: Partial<CustomToolDefinition> = {}): CustomToolDefinition {
    return {
      version: CUSTOM_TOOL_DEFINITION_VERSION,
      name,
      description: `Test tool: ${name}`,
      inputSchema: { type: 'object', properties: { x: { type: 'number' } } },
      code: 'output = input.x * 2;',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    testDir = join(tmpdir(), `custom-tools-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new FileCustomToolStorage({ baseDirectory: testDir });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('save + load', () => {
    it('should save and load a tool definition', async () => {
      const def = makeDefinition('my_tool');
      await storage.save(def);

      const loaded = await storage.load('my_tool');
      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('my_tool');
      expect(loaded!.code).toBe('output = input.x * 2;');
      expect(loaded!.description).toBe('Test tool: my_tool');
    });

    it('should overwrite existing tool on save', async () => {
      const def1 = makeDefinition('my_tool', { description: 'v1' });
      await storage.save(def1);

      const def2 = makeDefinition('my_tool', { description: 'v2' });
      await storage.save(def2);

      const loaded = await storage.load('my_tool');
      expect(loaded!.description).toBe('v2');
    });

    it('should return null for nonexistent tool', async () => {
      const loaded = await storage.load('nonexistent');
      expect(loaded).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an existing tool', async () => {
      await storage.save(makeDefinition('to_delete'));
      expect(await storage.exists('to_delete')).toBe(true);

      await storage.delete('to_delete');
      expect(await storage.exists('to_delete')).toBe(false);
    });

    it('should not throw when deleting nonexistent tool', async () => {
      await expect(storage.delete('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('exists', () => {
    it('should return true for existing tool', async () => {
      await storage.save(makeDefinition('exists_test'));
      expect(await storage.exists('exists_test')).toBe(true);
    });

    it('should return false for nonexistent tool', async () => {
      expect(await storage.exists('nope')).toBe(false);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await storage.save(makeDefinition('alpha', { metadata: { tags: ['math'], category: 'compute' } }));
      await storage.save(makeDefinition('beta', { metadata: { tags: ['api', 'web'], category: 'network' } }));
      await storage.save(makeDefinition('gamma', { metadata: { tags: ['math', 'api'], category: 'compute' } }));
    });

    it('should list all tools', async () => {
      const tools = await storage.list();
      expect(tools).toHaveLength(3);
    });

    it('should filter by tags', async () => {
      const tools = await storage.list({ tags: ['api'] });
      expect(tools).toHaveLength(2);
      const names = tools.map(t => t.name);
      expect(names).toContain('beta');
      expect(names).toContain('gamma');
    });

    it('should filter by category', async () => {
      const tools = await storage.list({ category: 'compute' });
      expect(tools).toHaveLength(2);
    });

    it('should filter by search text (name)', async () => {
      const tools = await storage.list({ search: 'alph' });
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('alpha');
    });

    it('should filter by search text (description)', async () => {
      const tools = await storage.list({ search: 'beta' });
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('beta');
    });

    it('should support pagination with limit', async () => {
      const tools = await storage.list({ limit: 2 });
      expect(tools).toHaveLength(2);
    });

    it('should support pagination with offset', async () => {
      const all = await storage.list();
      const offset = await storage.list({ offset: 1 });
      expect(offset).toHaveLength(all.length - 1);
    });

    it('should return empty array when no matches', async () => {
      const tools = await storage.list({ tags: ['nonexistent'] });
      expect(tools).toHaveLength(0);
    });
  });

  describe('index management', () => {
    it('should remove from index on delete', async () => {
      await storage.save(makeDefinition('a'));
      await storage.save(makeDefinition('b'));

      let list = await storage.list();
      expect(list).toHaveLength(2);

      await storage.delete('a');
      list = await storage.list();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('b');
    });

    it('should update index on overwrite', async () => {
      await storage.save(makeDefinition('a', { description: 'old' }));
      await storage.save(makeDefinition('a', { description: 'new' }));

      const list = await storage.list();
      expect(list).toHaveLength(1);
      expect(list[0].description).toBe('new');
    });
  });

  describe('atomic writes', () => {
    it('should not leave .tmp files after successful save', async () => {
      await storage.save(makeDefinition('atomic_test'));

      const files = await fs.readdir(testDir);
      const tmpFiles = files.filter(f => f.endsWith('.tmp'));
      expect(tmpFiles).toHaveLength(0);
    });
  });

  describe('getPath', () => {
    it('should return the base directory', () => {
      expect(storage.getPath()).toBe(testDir);
    });
  });
});
