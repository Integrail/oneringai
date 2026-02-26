/**
 * ToolCatalogPluginNextGen Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToolCatalogPluginNextGen } from '@/core/context-nextgen/plugins/ToolCatalogPluginNextGen.js';
import { ToolCatalogRegistry } from '@/core/ToolCatalogRegistry.js';
import { ToolManager } from '@/core/ToolManager.js';
import type { ToolFunction } from '@/domain/entities/Tool.js';
import type { CatalogToolEntry } from '@/core/ToolCatalogRegistry.js';

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

function mockEntry(name: string): CatalogToolEntry {
  return {
    tool: mockTool(name),
    name,
    displayName: name.replace(/_/g, ' '),
    description: `Description for ${name}`,
    safeByDefault: true,
  };
}

describe('ToolCatalogPluginNextGen', () => {
  let plugin: ToolCatalogPluginNextGen;
  let toolManager: ToolManager;

  beforeEach(() => {
    ToolCatalogRegistry.reset();

    // Register test categories
    ToolCatalogRegistry.registerCategory({ name: 'test_cat', displayName: 'Test Category', description: 'Test tools' });
    ToolCatalogRegistry.registerTools('test_cat', [
      mockEntry('test_tool_a'),
      mockEntry('test_tool_b'),
    ]);

    ToolCatalogRegistry.registerCategory({ name: 'other_cat', displayName: 'Other Category', description: 'Other tools' });
    ToolCatalogRegistry.registerTools('other_cat', [
      mockEntry('other_tool_x'),
    ]);

    plugin = new ToolCatalogPluginNextGen();
    toolManager = new ToolManager();
    plugin.setToolManager(toolManager);
  });

  afterEach(() => {
    plugin.destroy();
    toolManager.destroy();
  });

  describe('Plugin Interface', () => {
    it('should have correct name', () => {
      expect(plugin.name).toBe('tool_catalog');
    });

    it('should provide instructions', () => {
      const instructions = plugin.getInstructions();
      expect(instructions).toBeTruthy();
      expect(instructions).toContain('tool_catalog_search');
      expect(instructions).toContain('tool_catalog_load');
      expect(instructions).toContain('tool_catalog_unload');
    });

    it('should provide 3 tools', () => {
      const tools = plugin.getTools();
      expect(tools).toHaveLength(3);

      const names = tools.map(t => t.definition.function.name);
      expect(names).toContain('tool_catalog_search');
      expect(names).toContain('tool_catalog_load');
      expect(names).toContain('tool_catalog_unload');
    });

    it('should not be compactable when nothing is loaded', () => {
      expect(plugin.isCompactable()).toBe(false);
    });

    it('should be compactable when categories are loaded', async () => {
      const tools = plugin.getTools();
      const loadTool = tools.find(t => t.definition.function.name === 'tool_catalog_load')!;
      await loadTool.execute({ category: 'test_cat' });

      expect(plugin.isCompactable()).toBe(true);
    });
  });

  describe('tool_catalog_search', () => {
    it('should list all categories when no params', async () => {
      const tools = plugin.getTools();
      const searchTool = tools.find(t => t.definition.function.name === 'tool_catalog_search')!;

      const result = await searchTool.execute({}) as Record<string, unknown>;
      expect(result.categories).toBeDefined();
      const cats = result.categories as Array<{ name: string }>;
      expect(cats.some(c => c.name === 'test_cat')).toBe(true);
      expect(cats.some(c => c.name === 'other_cat')).toBe(true);
    });

    it('should list tools in a category', async () => {
      const tools = plugin.getTools();
      const searchTool = tools.find(t => t.definition.function.name === 'tool_catalog_search')!;

      const result = await searchTool.execute({ category: 'test_cat' }) as Record<string, unknown>;
      expect(result.category).toBe('test_cat');
      const toolList = result.tools as Array<{ name: string }>;
      expect(toolList).toHaveLength(2);
      expect(toolList.some(t => t.name === 'test_tool_a')).toBe(true);
    });

    it('should return error for non-existent category', async () => {
      const tools = plugin.getTools();
      const searchTool = tools.find(t => t.definition.function.name === 'tool_catalog_search')!;

      const result = await searchTool.execute({ category: 'nope' }) as Record<string, unknown>;
      expect(result.error).toBeDefined();
    });

    it('should keyword search across categories and tools', async () => {
      const tools = plugin.getTools();
      const searchTool = tools.find(t => t.definition.function.name === 'tool_catalog_search')!;

      const result = await searchTool.execute({ query: 'other' }) as Record<string, unknown>;
      expect(result.results).toBeDefined();
      const results = result.results as Array<{ category: string }>;
      expect(results.some(r => r.category === 'other_cat')).toBe(true);
    });

    it('should respect categoryScope filter', async () => {
      const scopedPlugin = new ToolCatalogPluginNextGen({
        categoryScope: ['test_cat'],
      });
      scopedPlugin.setToolManager(toolManager);

      const tools = scopedPlugin.getTools();
      const searchTool = tools.find(t => t.definition.function.name === 'tool_catalog_search')!;

      const result = await searchTool.execute({}) as Record<string, unknown>;
      const cats = result.categories as Array<{ name: string }>;
      expect(cats.some(c => c.name === 'test_cat')).toBe(true);
      expect(cats.some(c => c.name === 'other_cat')).toBe(false);

      scopedPlugin.destroy();
    });

    it('should show [LOADED] marker for loaded categories', async () => {
      const tools = plugin.getTools();
      const loadTool = tools.find(t => t.definition.function.name === 'tool_catalog_load')!;
      const searchTool = tools.find(t => t.definition.function.name === 'tool_catalog_search')!;

      await loadTool.execute({ category: 'test_cat' });

      const result = await searchTool.execute({}) as Record<string, unknown>;
      const cats = result.categories as Array<{ name: string; loaded: boolean }>;
      const testCat = cats.find(c => c.name === 'test_cat');
      expect(testCat?.loaded).toBe(true);
    });
  });

  describe('tool_catalog_load', () => {
    it('should register tools with ToolManager', async () => {
      const tools = plugin.getTools();
      const loadTool = tools.find(t => t.definition.function.name === 'tool_catalog_load')!;

      const result = await loadTool.execute({ category: 'test_cat' }) as Record<string, unknown>;
      expect(result.loaded).toBe(2);
      expect(result.tools).toEqual(['test_tool_a', 'test_tool_b']);

      // Tools should be registered in ToolManager
      expect(toolManager.getRegistration('test_tool_a')).toBeDefined();
      expect(toolManager.getRegistration('test_tool_b')).toBeDefined();
      expect(toolManager.isEnabled('test_tool_a')).toBe(true);
    });

    it('should be idempotent', async () => {
      const tools = plugin.getTools();
      const loadTool = tools.find(t => t.definition.function.name === 'tool_catalog_load')!;

      await loadTool.execute({ category: 'test_cat' });
      const result = await loadTool.execute({ category: 'test_cat' }) as Record<string, unknown>;
      expect(result.alreadyLoaded).toBe(true);
      expect(result.loaded).toBe(2);
    });

    it('should error when category is blocked by scope', async () => {
      const scopedPlugin = new ToolCatalogPluginNextGen({
        categoryScope: ['test_cat'],
      });
      scopedPlugin.setToolManager(toolManager);

      const tools = scopedPlugin.getTools();
      const loadTool = tools.find(t => t.definition.function.name === 'tool_catalog_load')!;

      const result = await loadTool.execute({ category: 'other_cat' }) as Record<string, unknown>;
      expect(result.error).toBeDefined();

      scopedPlugin.destroy();
    });

    it('should enforce scope check on connector categories too', async () => {
      // Scope only allows 'test_cat' — connector:github should be blocked
      const scopedPlugin = new ToolCatalogPluginNextGen({
        categoryScope: ['test_cat'],
      });
      scopedPlugin.setToolManager(toolManager);

      const tools = scopedPlugin.getTools();
      const loadTool = tools.find(t => t.definition.function.name === 'tool_catalog_load')!;

      const result = await loadTool.execute({ category: 'connector:github' }) as Record<string, unknown>;
      expect(result.error).toBeDefined();
      expect((result.error as string)).toContain('not available');

      scopedPlugin.destroy();
    });

    it('should error when max categories reached', async () => {
      const limitedPlugin = new ToolCatalogPluginNextGen({
        maxLoadedCategories: 1,
      });
      limitedPlugin.setToolManager(toolManager);

      const tools = limitedPlugin.getTools();
      const loadTool = tools.find(t => t.definition.function.name === 'tool_catalog_load')!;

      await loadTool.execute({ category: 'test_cat' });
      const result = await loadTool.execute({ category: 'other_cat' }) as Record<string, unknown>;
      expect(result.error).toBeDefined();
      expect((result.error as string)).toContain('Maximum loaded categories');

      limitedPlugin.destroy();
    });

    it('should error when category has no tools', async () => {
      ToolCatalogRegistry.registerCategory({ name: 'empty', displayName: 'Empty', description: 'Empty' });

      const tools = plugin.getTools();
      const loadTool = tools.find(t => t.definition.function.name === 'tool_catalog_load')!;

      const result = await loadTool.execute({ category: 'empty' }) as Record<string, unknown>;
      expect(result.error).toBeDefined();
    });
  });

  describe('tool_catalog_unload', () => {
    it('should disable tools in ToolManager', async () => {
      const tools = plugin.getTools();
      const loadTool = tools.find(t => t.definition.function.name === 'tool_catalog_load')!;
      const unloadTool = tools.find(t => t.definition.function.name === 'tool_catalog_unload')!;

      await loadTool.execute({ category: 'test_cat' });
      expect(toolManager.isEnabled('test_tool_a')).toBe(true);

      const result = await unloadTool.execute({ category: 'test_cat' }) as Record<string, unknown>;
      expect(result.unloaded).toBe(2);
      expect(toolManager.isEnabled('test_tool_a')).toBe(false);
    });

    it('should handle unload of not-loaded category gracefully', async () => {
      const tools = plugin.getTools();
      const unloadTool = tools.find(t => t.definition.function.name === 'tool_catalog_unload')!;

      const result = await unloadTool.execute({ category: 'test_cat' }) as Record<string, unknown>;
      expect(result.unloaded).toBe(0);
    });

    it('should allow re-loading after unload', async () => {
      const tools = plugin.getTools();
      const loadTool = tools.find(t => t.definition.function.name === 'tool_catalog_load')!;
      const unloadTool = tools.find(t => t.definition.function.name === 'tool_catalog_unload')!;

      await loadTool.execute({ category: 'test_cat' });
      await unloadTool.execute({ category: 'test_cat' });

      // Re-load should re-enable existing registrations
      const result = await loadTool.execute({ category: 'test_cat' }) as Record<string, unknown>;
      expect(result.loaded).toBe(2);
      expect(toolManager.isEnabled('test_tool_a')).toBe(true);
    });
  });

  describe('getContent', () => {
    it('should show loaded summary', async () => {
      const tools = plugin.getTools();
      const loadTool = tools.find(t => t.definition.function.name === 'tool_catalog_load')!;

      await loadTool.execute({ category: 'test_cat' });

      const content = await plugin.getContent();
      expect(content).toBeTruthy();
      expect(content).toContain('test_cat');
      expect(content).toContain('[LOADED]');
    });

    it('should return content even when nothing is loaded', async () => {
      const content = await plugin.getContent();
      // Should still show available categories
      expect(content).toBeTruthy();
      expect(content).toContain('Available categories');
    });
  });

  describe('compact', () => {
    it('should unload least-used categories', async () => {
      const tools = plugin.getTools();
      const loadTool = tools.find(t => t.definition.function.name === 'tool_catalog_load')!;

      await loadTool.execute({ category: 'test_cat' });
      await loadTool.execute({ category: 'other_cat' });

      const freed = await plugin.compact(10000);
      expect(freed).toBeGreaterThan(0);
      // At least one category should have been unloaded
      expect(plugin.loadedCategories.length).toBeLessThan(2);
    });
  });

  describe('getState / restoreState', () => {
    it('should round-trip loaded categories', async () => {
      const tools = plugin.getTools();
      const loadTool = tools.find(t => t.definition.function.name === 'tool_catalog_load')!;

      await loadTool.execute({ category: 'test_cat' });

      const state = plugin.getState();
      expect(state).toEqual({ loadedCategories: ['test_cat'] });

      // Create new plugin and restore
      const plugin2 = new ToolCatalogPluginNextGen();
      const tm2 = new ToolManager();
      plugin2.setToolManager(tm2);
      plugin2.restoreState(state);

      expect(plugin2.loadedCategories).toContain('test_cat');
      expect(tm2.isEnabled('test_tool_a')).toBe(true);

      plugin2.destroy();
      tm2.destroy();
    });

    it('should handle corrupted state gracefully', () => {
      const plugin2 = new ToolCatalogPluginNextGen();
      const tm2 = new ToolManager();
      plugin2.setToolManager(tm2);

      // null state
      plugin2.restoreState(null);
      expect(plugin2.loadedCategories).toHaveLength(0);

      // non-object state
      plugin2.restoreState('bad');
      expect(plugin2.loadedCategories).toHaveLength(0);

      // array with non-string entries
      plugin2.restoreState({ loadedCategories: [123, null, '', 'test_cat'] });
      // Only 'test_cat' should be loaded (123, null, '' are skipped)
      expect(plugin2.loadedCategories).toContain('test_cat');

      // Empty array
      plugin2.destroy();
      const plugin3 = new ToolCatalogPluginNextGen();
      plugin3.setToolManager(tm2);
      plugin3.restoreState({ loadedCategories: [] });
      expect(plugin3.loadedCategories).toHaveLength(0);

      plugin3.destroy();
      tm2.destroy();
    });

    it('should log warning for categories that fail to restore', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const plugin2 = new ToolCatalogPluginNextGen();
      const tm2 = new ToolManager();
      plugin2.setToolManager(tm2);

      // 'nonexistent' has no tools, executeLoad returns {error}
      plugin2.restoreState({ loadedCategories: ['nonexistent'] });
      // Category should not be loaded since it failed
      expect(plugin2.loadedCategories).not.toContain('nonexistent');

      plugin2.destroy();
      tm2.destroy();
      warnSpy.mockRestore();
    });
  });

  describe('destroyed state guard', () => {
    it('should return error from executeSearch after destroy', async () => {
      const tools = plugin.getTools();
      const searchTool = tools.find(t => t.definition.function.name === 'tool_catalog_search')!;

      plugin.destroy();

      const result = await searchTool.execute({}) as Record<string, unknown>;
      expect(result.error).toBe('Plugin destroyed');
    });

    it('should return error from executeLoad after destroy', async () => {
      const tools = plugin.getTools();
      const loadTool = tools.find(t => t.definition.function.name === 'tool_catalog_load')!;

      plugin.destroy();

      const result = await loadTool.execute({ category: 'test_cat' }) as Record<string, unknown>;
      expect(result.error).toBe('Plugin destroyed');
    });

    it('should return error from executeUnload after destroy', async () => {
      const tools = plugin.getTools();
      const unloadTool = tools.find(t => t.definition.function.name === 'tool_catalog_unload')!;

      plugin.destroy();

      const result = await unloadTool.execute({ category: 'test_cat' }) as Record<string, unknown>;
      expect(result.error).toBe('Plugin destroyed');
    });
  });

  describe('autoLoadCategories', () => {
    it('should pre-load specified categories on setToolManager', () => {
      const autoPlugin = new ToolCatalogPluginNextGen({
        autoLoadCategories: ['test_cat'],
      });
      const tm = new ToolManager();
      autoPlugin.setToolManager(tm);

      expect(autoPlugin.loadedCategories).toContain('test_cat');
      expect(tm.isEnabled('test_tool_a')).toBe(true);

      autoPlugin.destroy();
      tm.destroy();
    });

    it('should log warning for invalid auto-load categories', () => {
      const autoPlugin = new ToolCatalogPluginNextGen({
        autoLoadCategories: ['nonexistent_category'],
      });
      const tm = new ToolManager();

      // Should not throw, just log warning
      autoPlugin.setToolManager(tm);
      expect(autoPlugin.loadedCategories).not.toContain('nonexistent_category');

      autoPlugin.destroy();
      tm.destroy();
    });
  });

  describe('Integration with AgentContextNextGen', () => {
    it('should work with feature flag toolCatalog: true', async () => {
      // Importing here to avoid loading built-in tools in other tests
      const { AgentContextNextGen } = await import('@/core/context-nextgen/AgentContextNextGen.js');

      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        features: { toolCatalog: true, workingMemory: false, inContextMemory: false },
      });

      // Plugin should be registered
      const tcPlugin = ctx.getPlugin<ToolCatalogPluginNextGen>('tool_catalog');
      expect(tcPlugin).toBeDefined();

      // 3 metatools should be in ToolManager
      const toolNames = ctx.tools.listEnabled();
      expect(toolNames).toContain('tool_catalog_search');
      expect(toolNames).toContain('tool_catalog_load');
      expect(toolNames).toContain('tool_catalog_unload');

      ctx.destroy();
    });

    it('should pass toolCategories scope to plugin', async () => {
      const { AgentContextNextGen } = await import('@/core/context-nextgen/AgentContextNextGen.js');

      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        features: { toolCatalog: true, workingMemory: false, inContextMemory: false },
        toolCategories: ['test_cat'],
      });

      const tcPlugin = ctx.getPlugin<ToolCatalogPluginNextGen>('tool_catalog');
      expect(tcPlugin).toBeDefined();

      // Search should only show test_cat
      const tools = tcPlugin!.getTools();
      const searchTool = tools.find(t => t.definition.function.name === 'tool_catalog_search')!;
      const result = await searchTool.execute({}) as Record<string, unknown>;
      const cats = result.categories as Array<{ name: string }>;
      expect(cats.every(c => c.name === 'test_cat')).toBe(true);

      ctx.destroy();
    });
  });
});
