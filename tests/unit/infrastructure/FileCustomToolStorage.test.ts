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
      await storage.save('test-user', def);

      const loaded = await storage.load('test-user', 'my_tool');
      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('my_tool');
      expect(loaded!.code).toBe('output = input.x * 2;');
      expect(loaded!.description).toBe('Test tool: my_tool');
    });

    it('should overwrite existing tool on save', async () => {
      const def1 = makeDefinition('my_tool', { description: 'v1' });
      await storage.save('test-user', def1);

      const def2 = makeDefinition('my_tool', { description: 'v2' });
      await storage.save('test-user', def2);

      const loaded = await storage.load('test-user', 'my_tool');
      expect(loaded!.description).toBe('v2');
    });

    it('should return null for nonexistent tool', async () => {
      const loaded = await storage.load('test-user', 'nonexistent');
      expect(loaded).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an existing tool', async () => {
      await storage.save('test-user', makeDefinition('to_delete'));
      expect(await storage.exists('test-user', 'to_delete')).toBe(true);

      await storage.delete('test-user', 'to_delete');
      expect(await storage.exists('test-user', 'to_delete')).toBe(false);
    });

    it('should not throw when deleting nonexistent tool', async () => {
      await expect(storage.delete('test-user', 'nonexistent')).resolves.not.toThrow();
    });
  });

  describe('exists', () => {
    it('should return true for existing tool', async () => {
      await storage.save('test-user', makeDefinition('exists_test'));
      expect(await storage.exists('test-user', 'exists_test')).toBe(true);
    });

    it('should return false for nonexistent tool', async () => {
      expect(await storage.exists('test-user', 'nope')).toBe(false);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await storage.save('test-user', makeDefinition('alpha', { metadata: { tags: ['math'], category: 'compute' } }));
      await storage.save('test-user', makeDefinition('beta', { metadata: { tags: ['api', 'web'], category: 'network' } }));
      await storage.save('test-user', makeDefinition('gamma', { metadata: { tags: ['math', 'api'], category: 'compute' } }));
    });

    it('should list all tools', async () => {
      const tools = await storage.list('test-user');
      expect(tools).toHaveLength(3);
    });

    it('should filter by tags', async () => {
      const tools = await storage.list('test-user', { tags: ['api'] });
      expect(tools).toHaveLength(2);
      const names = tools.map(t => t.name);
      expect(names).toContain('beta');
      expect(names).toContain('gamma');
    });

    it('should filter by category', async () => {
      const tools = await storage.list('test-user', { category: 'compute' });
      expect(tools).toHaveLength(2);
    });

    it('should filter by search text (name)', async () => {
      const tools = await storage.list('test-user', { search: 'alph' });
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('alpha');
    });

    it('should filter by search text (description)', async () => {
      const tools = await storage.list('test-user', { search: 'beta' });
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('beta');
    });

    it('should support pagination with limit', async () => {
      const tools = await storage.list('test-user', { limit: 2 });
      expect(tools).toHaveLength(2);
    });

    it('should support pagination with offset', async () => {
      const all = await storage.list('test-user');
      const offset = await storage.list('test-user', { offset: 1 });
      expect(offset).toHaveLength(all.length - 1);
    });

    it('should return empty array when no matches', async () => {
      const tools = await storage.list('test-user', { tags: ['nonexistent'] });
      expect(tools).toHaveLength(0);
    });
  });

  describe('index management', () => {
    it('should remove from index on delete', async () => {
      await storage.save('test-user', makeDefinition('a'));
      await storage.save('test-user', makeDefinition('b'));

      let list = await storage.list('test-user');
      expect(list).toHaveLength(2);

      await storage.delete('test-user', 'a');
      list = await storage.list('test-user');
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('b');
    });

    it('should update index on overwrite', async () => {
      await storage.save('test-user', makeDefinition('a', { description: 'old' }));
      await storage.save('test-user', makeDefinition('a', { description: 'new' }));

      const list = await storage.list('test-user');
      expect(list).toHaveLength(1);
      expect(list[0].description).toBe('new');
    });
  });

  describe('atomic writes', () => {
    it('should not leave .tmp files after successful save', async () => {
      await storage.save('test-user', makeDefinition('atomic_test'));

      // Check the user's custom-tools directory
      const userDir = join(testDir, 'test-user', 'custom-tools');
      const files = await fs.readdir(userDir);
      const tmpFiles = files.filter(f => f.endsWith('.tmp'));
      expect(tmpFiles).toHaveLength(0);
    });
  });

  describe('getPath', () => {
    it('should return the user-specific custom-tools directory', () => {
      const path = storage.getPath('test-user');
      expect(path).toBe(join(testDir, 'test-user', 'custom-tools'));
    });
  });

  describe('multi-user isolation', () => {
    it('should isolate custom tools between users', async () => {
      const aliceTool = makeDefinition('alice_tool', { description: 'Alice tool' });
      const bobTool = makeDefinition('bob_tool', { description: 'Bob tool' });
      const sharedName = makeDefinition('shared_name', { description: 'Alice version' });

      await storage.save('alice', aliceTool);
      await storage.save('bob', bobTool);
      await storage.save('alice', sharedName);

      // Alice should only see her tools
      const aliceTools = await storage.list('alice');
      expect(aliceTools).toHaveLength(2);
      const aliceNames = aliceTools.map(t => t.name);
      expect(aliceNames).toContain('alice_tool');
      expect(aliceNames).toContain('shared_name');
      expect(aliceNames).not.toContain('bob_tool');

      // Bob should only see his tools
      const bobTools = await storage.list('bob');
      expect(bobTools).toHaveLength(1);
      expect(bobTools[0].name).toBe('bob_tool');

      // Alice can load her tools, but not Bob's
      expect(await storage.load('alice', 'alice_tool')).not.toBeNull();
      expect(await storage.load('alice', 'bob_tool')).toBeNull();

      // Bob can load his tools, but not Alice's
      expect(await storage.load('bob', 'bob_tool')).not.toBeNull();
      expect(await storage.load('bob', 'alice_tool')).toBeNull();
    });

    it('should allow same tool name for different users', async () => {
      const aliceVersion = makeDefinition('shared_tool', { description: 'Alice version' });
      const bobVersion = makeDefinition('shared_tool', { description: 'Bob version' });

      await storage.save('alice', aliceVersion);
      await storage.save('bob', bobVersion);

      const aliceTool = await storage.load('alice', 'shared_tool');
      const bobTool = await storage.load('bob', 'shared_tool');

      expect(aliceTool!.description).toBe('Alice version');
      expect(bobTool!.description).toBe('Bob version');
    });

    it('should not affect other users when deleting', async () => {
      await storage.save('alice', makeDefinition('tool_a'));
      await storage.save('bob', makeDefinition('tool_a'));

      await storage.delete('alice', 'tool_a');

      expect(await storage.exists('alice', 'tool_a')).toBe(false);
      expect(await storage.exists('bob', 'tool_a')).toBe(true);
    });
  });
});
