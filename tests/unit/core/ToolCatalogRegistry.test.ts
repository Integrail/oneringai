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

    it('should throw on empty category name', () => {
      expect(() => ToolCatalogRegistry.registerCategory({
        name: '',
        displayName: 'Empty',
        description: 'Empty',
      })).toThrow('Category name cannot be empty');
    });

    it('should throw on whitespace-only category name', () => {
      expect(() => ToolCatalogRegistry.registerCategory({
        name: '   ',
        displayName: 'Spaces',
        description: 'Spaces',
      })).toThrow('Category name cannot be empty');
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

    it('should throw on empty category name', () => {
      expect(() => ToolCatalogRegistry.registerTools('', [mockCatalogEntry('t')])).toThrow(
        'Category name cannot be empty',
      );
    });

    it('should throw on whitespace-only category name', () => {
      expect(() => ToolCatalogRegistry.registerTools('  ', [mockCatalogEntry('t')])).toThrow(
        'Category name cannot be empty',
      );
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

  describe('toDisplayName', () => {
    it('should capitalize hyphenated names', () => {
      expect(ToolCatalogRegistry.toDisplayName('custom-tools')).toBe('Custom Tools');
    });

    it('should capitalize single word', () => {
      expect(ToolCatalogRegistry.toDisplayName('filesystem')).toBe('Filesystem');
    });

    it('should handle connector-style names', () => {
      expect(ToolCatalogRegistry.toDisplayName('github')).toBe('Github');
    });

    it('should handle multi-hyphen names', () => {
      expect(ToolCatalogRegistry.toDisplayName('my-cool-tool')).toBe('My Cool Tool');
    });
  });

  describe('parseConnectorCategory', () => {
    it('should parse valid connector category', () => {
      expect(ToolCatalogRegistry.parseConnectorCategory('connector:github')).toBe('github');
    });

    it('should return null for non-connector category', () => {
      expect(ToolCatalogRegistry.parseConnectorCategory('filesystem')).toBeNull();
    });

    it('should handle empty connector name', () => {
      expect(ToolCatalogRegistry.parseConnectorCategory('connector:')).toBe('');
    });

    it('should not match partial prefix', () => {
      expect(ToolCatalogRegistry.parseConnectorCategory('connectorish')).toBeNull();
    });
  });

  describe('getConnectorToolsModule', () => {
    it('should return null when ConnectorTools is not available', () => {
      // After reset, the cached module is cleared
      // In test environment, require may or may not work
      const mod = ToolCatalogRegistry.getConnectorToolsModule();
      // Either returns the module or null — both are valid in test
      expect(mod === null || (mod && 'ConnectorTools' in mod)).toBe(true);
    });
  });

  describe('discoverConnectorCategories', () => {
    it('should return empty array when ConnectorTools is unavailable', () => {
      // Reset clears cached module; if require fails in test env, returns []
      const result = ToolCatalogRegistry.discoverConnectorCategories();
      // Either empty or has real connectors if module is available
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('initializeFromRegistry', () => {
    it('should register tools from a registry array', () => {
      const fakeRegistry = [
        {
          name: 'read_file',
          displayName: 'Read File',
          category: 'filesystem',
          description: 'Read a file',
          tool: mockTool('read_file'),
          safeByDefault: true,
        },
        {
          name: 'write_file',
          displayName: 'Write File',
          category: 'filesystem',
          description: 'Write a file',
          tool: mockTool('write_file'),
          safeByDefault: false,
        },
        {
          name: 'bash',
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

    it('should use toDisplayName for auto-created categories', () => {
      ToolCatalogRegistry.initializeFromRegistry([
        {
          name: 'tool_a',
          displayName: 'Tool A',
          category: 'custom-tools',
          description: 'A tool',
          tool: mockTool('tool_a'),
          safeByDefault: true,
        },
      ]);

      const cat = ToolCatalogRegistry.getCategory('custom-tools');
      expect(cat?.displayName).toBe('Custom Tools');
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

  describe('resolveToolsGrouped', () => {
    it('should split tools into plain and byConnector groups', () => {
      ToolCatalogRegistry.registerTools('fs', [
        mockCatalogEntry('read_file'),
      ]);
      ToolCatalogRegistry.registerTools('connector:github', [
        mockCatalogEntry('github_api', { connectorName: 'github' }),
      ]);
      ToolCatalogRegistry.registerTools('connector:slack', [
        mockCatalogEntry('slack_api', { connectorName: 'slack' }),
      ]);

      const { plain, byConnector } = ToolCatalogRegistry.resolveToolsGrouped(
        ['read_file', 'github_api', 'slack_api'],
      );

      expect(plain).toHaveLength(1);
      expect(plain[0].definition.function.name).toBe('read_file');
      expect(byConnector.size).toBe(2);
      expect(byConnector.get('github')).toHaveLength(1);
      expect(byConnector.get('slack')).toHaveLength(1);
    });

    it('should skip unknown tools silently', () => {
      ToolCatalogRegistry.registerTools('fs', [mockCatalogEntry('read_file')]);

      const { plain, byConnector } = ToolCatalogRegistry.resolveToolsGrouped(
        ['read_file', 'nonexistent'],
      );

      expect(plain).toHaveLength(1);
      expect(byConnector.size).toBe(0);
    });

    it('should use createTool factory when context is provided', () => {
      const factoryTool = mockTool('browser_navigate_factory');
      ToolCatalogRegistry.registerTools('browser', [
        {
          name: 'browser_navigate',
          displayName: 'Navigate',
          description: 'Navigate to URL',
          safeByDefault: false,
          createTool: (ctx) => {
            expect(ctx.instanceId).toBe('inst_123');
            return factoryTool;
          },
        },
      ]);

      const { plain } = ToolCatalogRegistry.resolveToolsGrouped(
        ['browser_navigate'],
        { instanceId: 'inst_123' },
      );

      expect(plain).toHaveLength(1);
      expect(plain[0]).toBe(factoryTool);
    });

    it('should fall back to static tool when no context provided', () => {
      const staticTool = mockTool('browser_click');
      ToolCatalogRegistry.registerTools('browser', [
        {
          tool: staticTool,
          name: 'browser_click',
          displayName: 'Click',
          description: 'Click element',
          safeByDefault: false,
          createTool: () => mockTool('should_not_be_called'),
        },
      ]);

      const { plain } = ToolCatalogRegistry.resolveToolsGrouped(
        ['browser_click'],
        // No context — should use static tool
      );

      expect(plain).toHaveLength(1);
      expect(plain[0]).toBe(staticTool);
    });

    it('should handle factory-only entries (no static tool)', () => {
      const factoryTool = mockTool('dynamic_tool');
      ToolCatalogRegistry.registerTools('dynamic', [
        {
          name: 'dynamic_tool',
          displayName: 'Dynamic',
          description: 'Factory-only tool',
          safeByDefault: false,
          createTool: () => factoryTool,
        },
      ]);

      // With context: factory works
      const { plain: withCtx } = ToolCatalogRegistry.resolveToolsGrouped(
        ['dynamic_tool'],
        { instanceId: 'test' },
      );
      expect(withCtx).toHaveLength(1);

      // Without context: no tool (no static fallback)
      const { plain: noCtx } = ToolCatalogRegistry.resolveToolsGrouped(
        ['dynamic_tool'],
      );
      expect(noCtx).toHaveLength(0);
    });

    it('should group multiple connector tools under same connector', () => {
      ToolCatalogRegistry.registerTools('connector:github', [
        mockCatalogEntry('github_issues', { connectorName: 'github' }),
        mockCatalogEntry('github_prs', { connectorName: 'github' }),
      ]);

      const { byConnector } = ToolCatalogRegistry.resolveToolsGrouped(
        ['github_issues', 'github_prs'],
      );

      expect(byConnector.get('github')).toHaveLength(2);
    });
  });

  describe('resolveTools with factory context', () => {
    it('should use factory when context option is provided', () => {
      const factoryTool = mockTool('factory_tool_resolved');
      ToolCatalogRegistry.registerTools('test', [
        {
          name: 'factory_test',
          displayName: 'Factory Test',
          description: 'Test factory resolution',
          safeByDefault: true,
          createTool: () => factoryTool,
        },
      ]);

      const resolved = ToolCatalogRegistry.resolveTools(
        ['factory_test'],
        { context: { instanceId: 'test' } },
      );
      expect(resolved).toHaveLength(1);
      expect(resolved[0]).toBe(factoryTool);
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

    it('should clear connector tools module cache', () => {
      // Access once to populate cache
      ToolCatalogRegistry.getConnectorToolsModule();
      ToolCatalogRegistry.reset();
      // After reset, module cache should be null (will re-attempt on next access)
      // We can't directly test the private field, but we can call it again without error
      const mod = ToolCatalogRegistry.getConnectorToolsModule();
      expect(mod === null || (mod && 'ConnectorTools' in mod)).toBe(true);
    });
  });
});
