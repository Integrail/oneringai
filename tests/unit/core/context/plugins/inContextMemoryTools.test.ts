/**
 * InContextMemory Tools Tests
 * Tests for the in-context memory tools
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInContextMemoryTools,
  createInContextMemory,
  contextSetDefinition,
  contextDeleteDefinition,
  contextListDefinition,
} from '../../../../../src/core/context/plugins/inContextMemoryTools.js';
import { InContextMemoryPlugin } from '../../../../../src/core/context/plugins/InContextMemoryPlugin.js';
import type { ToolFunction } from '../../../../../src/domain/entities/Tool.js';
import type { ToolContext } from '../../../../../src/domain/interfaces/IToolContext.js';

describe('InContextMemory Tools', () => {
  let plugin: InContextMemoryPlugin;
  let tools: ToolFunction[];
  let mockContext: ToolContext;

  beforeEach(() => {
    plugin = new InContextMemoryPlugin();
    tools = createInContextMemoryTools();

    // Create mock context with the plugin
    mockContext = {
      agentId: 'test-agent',
      inContextMemory: plugin,
    } as ToolContext;
  });

  // ============================================================================
  // Tool Definitions Tests
  // ============================================================================

  describe('tool definitions', () => {
    describe('contextSetDefinition', () => {
      it('should have correct name', () => {
        expect(contextSetDefinition.function.name).toBe('context_set');
      });

      it('should have description', () => {
        expect(contextSetDefinition.function.description).toBeDefined();
        expect(contextSetDefinition.function.description!.length).toBeGreaterThan(0);
      });

      it('should require key, description, and value', () => {
        expect(contextSetDefinition.function.parameters?.required).toContain('key');
        expect(contextSetDefinition.function.parameters?.required).toContain('description');
        expect(contextSetDefinition.function.parameters?.required).toContain('value');
      });

      it('should have optional priority parameter', () => {
        const props = contextSetDefinition.function.parameters?.properties;
        expect(props?.priority).toBeDefined();
        expect(props?.priority?.enum).toEqual(['low', 'normal', 'high', 'critical']);
      });
    });

    describe('contextDeleteDefinition', () => {
      it('should have correct name', () => {
        expect(contextDeleteDefinition.function.name).toBe('context_delete');
      });

      it('should require key parameter', () => {
        expect(contextDeleteDefinition.function.parameters?.required).toContain('key');
      });
    });

    describe('contextListDefinition', () => {
      it('should have correct name', () => {
        expect(contextListDefinition.function.name).toBe('context_list');
      });

      it('should not require any parameters', () => {
        expect(contextListDefinition.function.parameters?.required).toEqual([]);
      });
    });
  });

  // ============================================================================
  // createInContextMemoryTools Tests
  // ============================================================================

  describe('createInContextMemoryTools', () => {
    it('should return 3 tools', () => {
      expect(tools).toHaveLength(3);
    });

    it('should return tools with correct names', () => {
      const names = tools.map((t) => t.definition.function.name);
      expect(names).toContain('context_set');
      expect(names).toContain('context_delete');
      expect(names).toContain('context_list');
    });

    it('should NOT include context_get (removed in consolidation)', () => {
      const names = tools.map((t) => t.definition.function.name);
      expect(names).not.toContain('context_get');
    });

    it('should return tools with execute functions', () => {
      for (const tool of tools) {
        expect(typeof tool.execute).toBe('function');
      }
    });

    it('should return tools with idempotency config', () => {
      for (const tool of tools) {
        expect(tool.idempotency).toBeDefined();
      }
    });

    it('should return tools with permission config', () => {
      for (const tool of tools) {
        expect(tool.permission).toBeDefined();
        expect(tool.permission?.scope).toBe('always');
        expect(tool.permission?.riskLevel).toBe('low');
      }
    });

    it('should return tools with describeCall', () => {
      for (const tool of tools) {
        expect(tool.describeCall).toBeDefined();
      }
    });
  });

  // ============================================================================
  // context_set Tool Tests
  // ============================================================================

  describe('context_set tool', () => {
    let setTool: ToolFunction;

    beforeEach(() => {
      setTool = tools.find((t) => t.definition.function.name === 'context_set')!;
    });

    it('should store a value', async () => {
      const result = await setTool.execute(
        { key: 'test_key', description: 'Test description', value: { data: 42 } },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.key).toBe('test_key');
      expect(plugin.get('test_key')).toEqual({ data: 42 });
    });

    it('should use default priority when not specified', async () => {
      const result = await setTool.execute(
        { key: 'test_key', description: 'Test', value: 'value' },
        mockContext
      );

      expect(result.priority).toBe('normal');
    });

    it('should accept custom priority', async () => {
      const result = await setTool.execute(
        { key: 'test_key', description: 'Test', value: 'value', priority: 'high' },
        mockContext
      );

      expect(result.priority).toBe('high');
      const entries = plugin.list();
      expect(entries[0].priority).toBe('high');
    });

    it('should throw when context is missing', async () => {
      await expect(
        setTool.execute({ key: 'test', description: 'test', value: 'test' })
      ).rejects.toThrow();
    });

    it('should throw when plugin is not in context', async () => {
      const badContext = { agentId: 'test' } as ToolContext;

      await expect(
        setTool.execute({ key: 'test', description: 'test', value: 'test' }, badContext)
      ).rejects.toThrow('InContextMemory plugin not found');
    });

    it('should have correct describeCall', () => {
      const desc = setTool.describeCall!({ key: 'my_key', description: 'desc', value: 'v' });
      expect(desc).toBe('my_key');
    });
  });

  // ============================================================================
  // context_delete Tool Tests
  // ============================================================================

  describe('context_delete tool', () => {
    let deleteTool: ToolFunction;

    beforeEach(() => {
      deleteTool = tools.find((t) => t.definition.function.name === 'context_delete')!;
    });

    it('should delete existing key', async () => {
      plugin.set('test_key', 'Description', 'value');

      const result = await deleteTool.execute({ key: 'test_key' }, mockContext);

      expect(result.success).toBe(true);
      expect(result.existed).toBe(true);
      expect(plugin.has('test_key')).toBe(false);
    });

    it('should handle non-existent key gracefully', async () => {
      const result = await deleteTool.execute({ key: 'nonexistent' }, mockContext);

      expect(result.success).toBe(true);
      expect(result.existed).toBe(false);
    });

    it('should throw when context is missing', async () => {
      await expect(deleteTool.execute({ key: 'test' })).rejects.toThrow();
    });

    it('should have correct describeCall', () => {
      const desc = deleteTool.describeCall!({ key: 'my_key' });
      expect(desc).toBe('my_key');
    });
  });

  // ============================================================================
  // context_list Tool Tests
  // ============================================================================

  describe('context_list tool', () => {
    let listTool: ToolFunction;

    beforeEach(() => {
      listTool = tools.find((t) => t.definition.function.name === 'context_list')!;
    });

    it('should return empty list when no entries', async () => {
      const result = await listTool.execute({}, mockContext);

      expect(result.entries).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('should return all entries with metadata', async () => {
      plugin.set('key1', 'Description 1', 'value1', 'high');
      plugin.set('key2', 'Description 2', 'value2', 'low');

      const result = await listTool.execute({}, mockContext);

      expect(result.count).toBe(2);
      expect(result.entries).toHaveLength(2);

      const entry1 = result.entries.find((e: any) => e.key === 'key1');
      expect(entry1).toBeDefined();
      expect(entry1.description).toBe('Description 1');
      expect(entry1.priority).toBe('high');
      expect(entry1.updatedAt).toBeDefined();
    });

    it('should throw when context is missing', async () => {
      await expect(listTool.execute({})).rejects.toThrow();
    });

    it('should have cacheable idempotency', () => {
      expect(listTool.idempotency?.cacheable).toBe(true);
    });

    it('should have correct describeCall', () => {
      const desc = listTool.describeCall!({});
      expect(desc).toBe('all');
    });
  });

  // ============================================================================
  // createInContextMemory Factory Tests
  // ============================================================================

  describe('createInContextMemory', () => {
    it('should return plugin and tools', () => {
      const result = createInContextMemory();

      expect(result.plugin).toBeInstanceOf(InContextMemoryPlugin);
      expect(result.tools).toHaveLength(3);
    });

    it('should apply config to plugin', () => {
      const result = createInContextMemory({
        maxEntries: 10,
        defaultPriority: 'high',
      });

      const state = result.plugin.getState();
      expect(state.config.maxEntries).toBe(10);
      expect(state.config.defaultPriority).toBe('high');
    });

    it('should create independent instances', () => {
      const result1 = createInContextMemory();
      const result2 = createInContextMemory();

      result1.plugin.set('key', 'desc', 'value');

      expect(result1.plugin.size).toBe(1);
      expect(result2.plugin.size).toBe(0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('integration', () => {
    it('should work end-to-end: set, list, delete', async () => {
      const setTool = tools.find((t) => t.definition.function.name === 'context_set')!;
      const listTool = tools.find((t) => t.definition.function.name === 'context_list')!;
      const deleteTool = tools.find((t) => t.definition.function.name === 'context_delete')!;

      // Set some values
      await setTool.execute(
        { key: 'state', description: 'Current state', value: { step: 1 } },
        mockContext
      );
      await setTool.execute(
        { key: 'prefs', description: 'User preferences', value: { theme: 'dark' } },
        mockContext
      );

      // List
      const listResult = await listTool.execute({}, mockContext);
      expect(listResult.count).toBe(2);

      // Note: context_get was removed - values are visible directly in context
      // LLM can see values without a tool call

      // Update
      await setTool.execute(
        { key: 'state', description: 'Current state', value: { step: 2 } },
        mockContext
      );

      // Delete
      await deleteTool.execute({ key: 'prefs' }, mockContext);
      const finalList = await listTool.execute({}, mockContext);
      expect(finalList.count).toBe(1);
    });

    it('should handle various data types', async () => {
      const setTool = tools.find((t) => t.definition.function.name === 'context_set')!;

      // Set various types
      await setTool.execute({ key: 'string', description: 'String', value: 'hello' }, mockContext);
      await setTool.execute({ key: 'number', description: 'Number', value: 42 }, mockContext);
      await setTool.execute({ key: 'array', description: 'Array', value: [1, 2, 3] }, mockContext);
      await setTool.execute(
        { key: 'object', description: 'Object', value: { a: { b: 'c' } } },
        mockContext
      );
      await setTool.execute({ key: 'null', description: 'Null', value: null }, mockContext);
      await setTool.execute({ key: 'boolean', description: 'Boolean', value: true }, mockContext);

      // Verify each via plugin directly (context_get was removed)
      expect(plugin.get('string')).toBe('hello');
      expect(plugin.get('number')).toBe(42);
      expect(plugin.get('array')).toEqual([1, 2, 3]);
      expect(plugin.get('object')).toEqual({ a: { b: 'c' } });
      expect(plugin.get('null')).toBeNull();
      expect(plugin.get('boolean')).toBe(true);
    });
  });
});
