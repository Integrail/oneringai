/**
 * ToolCatalogRegistry Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolCatalogRegistry } from '@/core/ToolCatalogRegistry.js';
import type { ToolCategoryDefinition, CatalogToolEntry, ToolCategoryScope } from '@/core/ToolCatalogRegistry.js';
import type { ToolFunction } from '@/domain/entities/Tool.js';

// Helper to create a mock tool
function mockTool(name: string): ToolFunction {
  return {
    definition: {
      type: 'function',
      function: {
        name,
        description: `Mock tool: ${name}`,
        parameters: { type: 'object', properties: {} },
      },
    },
    execute: async () => ({ result: 'ok' }),
  };
}

function mockCatalogEntry(name: string, overrides?: Partial<CatalogToolEntry>): CatalogToolEntry {
  return {
    tool: mockTool(name),
    name,
    displayName: name.replace(/_/g, ' '),
    description: `Description for ${name}`,
    safeByDefault: true,
    ...overrides,
  };
}

describe('ToolCatalogRegistry', () => {
  beforeEach(() => {
    ToolCatalogRegistry.reset();
  });

  describe('registerCategory + query', () => {
    it('should register and retrieve a category', () => {
      ToolCatalogRegistry.registerCategory({
        name: 'test',
        displayName: 'Test',
        description: 'Test category',
      });

      expect(ToolCatalogRegistry.hasCategory('test')).toBe(true);
      expect(ToolCatalogRegistry.getCategory('test')).toEqual({
        name: 'test',
        displayName: 'Test',
        description: 'Test category',
      });
    });

    it('should return undefined for non-existent category', () => {
      expect(ToolCatalogRegistry.getCategory('nope')).toBeUndefined();
    });

    it('should update category on re-registration', () => {
      ToolCatalogRegistry.registerCategory({
        name: 'test',
        displayName: 'Test v1',
        description: 'v1',
      });
      ToolCatalogRegistry.registerCategory({
        name: 'test',
        displayName: 'Test v2',
        description: 'v2',
      });

      expect(ToolCatalogRegistry.getCategory('test')?.displayName).toBe('Test v2');
    });

    it('should list all categories', () => {
      ToolCatalogRegistry.registerCategory({ name: 'a', displayName: 'A', description: 'A' });
      ToolCatalogRegistry.registerCategory({ name: 'b', displayName: 'B', description: 'B' });

      const categories = ToolCatalogRegistry.getCategories();
      expect(categories).toHaveLength(2);
      expect(categories.map(c => c.name)).toContain('a');
      expect(categories.map(c => c.name)).toContain('b');
    });
  });

  describe('registerTools + getToolsInCategory', () => {
    it('should register tools in a category', () => {
      ToolCatalogRegistry.registerCategory({ name: 'fs', displayName: 'FS', description: 'FS' });
      ToolCatalogRegistry.registerTools('fs', [
        mockCatalogEntry('read_file'),
        mockCatalogEntry('write_file'),
      ]);

      const tools = ToolCatalogRegistry.getToolsInCategory('fs');
      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).toContain('read_file');
    });

    it('should auto-create category if not registered', () => {
      ToolCatalogRegistry.registerTools('auto', [mockCatalogEntry('tool_a')]);

      expect(ToolCatalogRegistry.hasCategory('auto')).toBe(true);
      expect(ToolCatalogRegistry.getToolsInCategory('auto')).toHaveLength(1);
    });

    it('should not duplicate tools on re-registration', () => {
      ToolCatalogRegistry.registerTools('test', [mockCatalogEntry('tool_a')]);
      ToolCatalogRegistry.registerTools('test', [mockCatalogEntry('tool_a')]);

      expect(ToolCatalogRegistry.getToolsInCategory('test')).toHaveLength(1);
    });

    it('should update existing tool on re-registration', () => {
      ToolCatalogRegistry.registerTools('test', [
        mockCatalogEntry('tool_a', { description: 'v1' }),
      ]);
      ToolCatalogRegistry.registerTools('test', [
        mockCatalogEntry('tool_a', { description: 'v2' }),
      ]);

      const tools = ToolCatalogRegistry.getToolsInCategory('test');
      expect(tools).toHaveLength(1);
      expect(tools[0].description).toBe('v2');
    });
  });

  describe('registerTool (single)', () => {
    it('should register a single tool', () => {
      ToolCatalogRegistry.registerTool('test', mockCatalogEntry('single'));

      const tools = ToolCatalogRegistry.getToolsInCategory('test');
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('single');
    });
  });

  describe('unregisterCategory', () => {
    it('should remove category and its tools', () => {
      ToolCatalogRegistry.registerTools('temp', [mockCatalogEntry('temp_tool')]);
      expect(ToolCatalogRegistry.hasCategory('temp')).toBe(true);

      const removed = ToolCatalogRegistry.unregisterCategory('temp');
      expect(removed).toBe(true);
      expect(ToolCatalogRegistry.hasCategory('temp')).toBe(false);
      expect(ToolCatalogRegistry.getToolsInCategory('temp')).toHaveLength(0);
    });

    it('should return false for non-existent category', () => {
      expect(ToolCatalogRegistry.unregisterCategory('nope')).toBe(false);
    });
  });

  describe('unregisterTool', () => {
    it('should remove a tool from a category', () => {
      ToolCatalogRegistry.registerTools('test', [
        mockCatalogEntry('a'),
        mockCatalogEntry('b'),
      ]);

      const removed = ToolCatalogRegistry.unregisterTool('test', 'a');
      expect(removed).toBe(true);
      expect(ToolCatalogRegistry.getToolsInCategory('test').map(t => t.name)).toEqual(['b']);
    });

    it('should return false for non-existent tool', () => {
      ToolCatalogRegistry.registerTools('test', [mockCatalogEntry('a')]);
      expect(ToolCatalogRegistry.unregisterTool('test', 'nope')).toBe(false);
    });
  });

  describe('findTool', () => {
    it('should find a tool across categories', () => {
      ToolCatalogRegistry.registerTools('cat1', [mockCatalogEntry('tool_x')]);
      ToolCatalogRegistry.registerTools('cat2', [mockCatalogEntry('tool_y')]);

      const found = ToolCatalogRegistry.findTool('tool_y');
      expect(found).toBeDefined();
      expect(found!.category).toBe('cat2');
      expect(found!.entry.name).toBe('tool_y');
    });

    it('should return undefined for non-existent tool', () => {
      expect(ToolCatalogRegistry.findTool('no_exist')).toBeUndefined();
    });
  });

  describe('getAllCatalogTools', () => {
    it('should return all tools across categories', () => {
      ToolCatalogRegistry.registerTools('a', [mockCatalogEntry('t1'), mockCatalogEntry('t2')]);
      ToolCatalogRegistry.registerTools('b', [mockCatalogEntry('t3')]);

      const all = ToolCatalogRegistry.getAllCatalogTools();
      expect(all).toHaveLength(3);
    });
  });

  describe('filterCategories', () => {
    beforeEach(() => {
      ToolCatalogRegistry.registerCategory({ name: 'fs', displayName: 'FS', description: 'FS' });
      ToolCatalogRegistry.registerCategory({ name: 'web', displayName: 'Web', description: 'Web' });
      ToolCatalogRegistry.registerCategory({ name: 'shell', displayName: 'Shell', description: 'Shell' });
    });

    it('should return all when scope is undefined', () => {
      expect(ToolCatalogRegistry.filterCategories()).toHaveLength(3);
    });

    it('should filter with string[] allowlist', () => {
      const result = ToolCatalogRegistry.filterCategories(['fs', 'web']);
      expect(result.map(c => c.name)).toEqual(['fs', 'web']);
    });

    it('should filter with { include } allowlist', () => {
      const result = ToolCatalogRegistry.filterCategories({ include: ['fs'] });
      expect(result.map(c => c.name)).toEqual(['fs']);
    });

    it('should filter with { exclude } blocklist', () => {
      const result = ToolCatalogRegistry.filterCategories({ exclude: ['shell'] });
      expect(result.map(c => c.name)).toEqual(['fs', 'web']);
    });
  });

  describe('isCategoryAllowed', () => {
    it('should allow all when scope is undefined', () => {
      expect(ToolCatalogRegistry.isCategoryAllowed('anything')).toBe(true);
    });

    it('should check string[] allowlist', () => {
      expect(ToolCatalogRegistry.isCategoryAllowed('fs', ['fs', 'web'])).toBe(true);
      expect(ToolCatalogRegistry.isCategoryAllowed('shell', ['fs', 'web'])).toBe(false);
    });

    it('should check { include } allowlist', () => {
      expect(ToolCatalogRegistry.isCategoryAllowed('fs', { include: ['fs'] })).toBe(true);
      expect(ToolCatalogRegistry.isCategoryAllowed('web', { include: ['fs'] })).toBe(false);
    });

    it('should check { exclude } blocklist', () => {
      expect(ToolCatalogRegistry.isCategoryAllowed('fs', { exclude: ['shell'] })).toBe(true);
      expect(ToolCatalogRegistry.isCategoryAllowed('shell', { exclude: ['shell'] })).toBe(false);
    });
  });

  describe('initializeFromRegistry', () => {
    it('should register tools from a registry array', () => {
      const fakeRegistry = [
        {
          name: 'read_file',
          exportName: 'readFile',
          displayName: 'Read File',
          category: 'filesystem',
          description: 'Read a file',
          tool: mockTool('read_file'),
          safeByDefault: true,
        },
        {
          name: 'write_file',
          exportName: 'writeFile',
          displayName: 'Write File',
          category: 'filesystem',
          description: 'Write a file',
          tool: mockTool('write_file'),
          safeByDefault: false,
        },
        {
          name: 'bash',
          exportName: 'bash',
          displayName: 'Bash',
          category: 'shell',
          description: 'Run shell commands',
          tool: mockTool('bash'),
          safeByDefault: false,
        },
      ];

      ToolCatalogRegistry.initializeFromRegistry(fakeRegistry);

      const categories = ToolCatalogRegistry.getCategories();
      expect(categories.length).toBeGreaterThanOrEqual(2);
      expect(ToolCatalogRegistry.hasCategory('filesystem')).toBe(true);
      expect(ToolCatalogRegistry.hasCategory('shell')).toBe(true);

      const fsTools = ToolCatalogRegistry.getToolsInCategory('filesystem');
      expect(fsTools).toHaveLength(2);
      expect(fsTools.some(t => t.name === 'read_file')).toBe(true);
    });
  });

  describe('resolveTools', () => {
    it('should resolve known tool names to ToolFunction[]', () => {
      ToolCatalogRegistry.registerTools('test', [
        mockCatalogEntry('resolve_me'),
      ]);

      const resolved = ToolCatalogRegistry.resolveTools(['resolve_me']);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].definition.function.name).toBe('resolve_me');
    });

    it('should skip unknown tool names with warning', () => {
      const resolved = ToolCatalogRegistry.resolveTools(['nonexistent_tool']);
      expect(resolved).toHaveLength(0);
    });

    it('should resolve multiple tools', () => {
      ToolCatalogRegistry.registerTools('cat1', [mockCatalogEntry('t1')]);
      ToolCatalogRegistry.registerTools('cat2', [mockCatalogEntry('t2')]);

      const resolved = ToolCatalogRegistry.resolveTools(['t1', 't2']);
      expect(resolved).toHaveLength(2);
    });
  });

  describe('reset', () => {
    it('should clear all categories and tools', () => {
      ToolCatalogRegistry.registerTools('test', [mockCatalogEntry('tool')]);
      expect(ToolCatalogRegistry.getCategories().length).toBeGreaterThan(0);

      ToolCatalogRegistry.reset();
      // After reset, getCategories triggers ensureInitialized which re-loads built-ins
      // To truly test reset, we check internal state before query
      // But since we can't, we test that new registrations work fresh
      ToolCatalogRegistry.registerCategory({ name: 'fresh', displayName: 'Fresh', description: 'F' });
      // 'test' should not exist (but built-ins may be re-loaded)
      expect(ToolCatalogRegistry.findTool('tool')).toBeUndefined();
    });
  });
});
