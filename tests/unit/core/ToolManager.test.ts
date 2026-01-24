/**
 * Tests for ToolManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolManager } from '../../../src/core/ToolManager.js';
import type { ToolFunction } from '../../../src/domain/entities/Tool.js';

describe('ToolManager', () => {
  let toolManager: ToolManager;
  let testTool1: ToolFunction;
  let testTool2: ToolFunction;
  let testTool3: ToolFunction;

  beforeEach(() => {
    toolManager = new ToolManager();

    testTool1 = {
      definition: {
        type: 'function',
        function: {
          name: 'test_tool_1',
          description: 'Test tool 1',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      execute: vi.fn(async () => ({ result: 'tool1' })),
    };

    testTool2 = {
      definition: {
        type: 'function',
        function: {
          name: 'test_tool_2',
          description: 'Test tool 2',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      execute: vi.fn(async () => ({ result: 'tool2' })),
    };

    testTool3 = {
      definition: {
        type: 'function',
        function: {
          name: 'test_tool_3',
          description: 'Test tool 3',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      execute: vi.fn(async () => ({ result: 'tool3' })),
    };
  });

  describe('register', () => {
    it('should register a tool', () => {
      toolManager.register(testTool1);
      expect(toolManager.has('test_tool_1')).toBe(true);
    });

    it('should register a tool with options', () => {
      toolManager.register(testTool1, {
        namespace: 'test',
        priority: 100,
        enabled: true,
      });

      expect(toolManager.has('test_tool_1')).toBe(true);
      expect(toolManager.isEnabled('test_tool_1')).toBe(true);
    });

    it('should emit tool:registered event', () => {
      const listener = vi.fn();
      toolManager.on('tool:registered', listener);

      toolManager.register(testTool1, { namespace: 'test', enabled: true });

      expect(listener).toHaveBeenCalledWith({
        name: 'test_tool_1',
        namespace: 'test',
        enabled: true,
      });
    });

    it('should replace existing tool with same name', () => {
      toolManager.register(testTool1);
      const firstTool = toolManager.get('test_tool_1');

      const updatedTool = { ...testTool1 };
      toolManager.register(updatedTool);
      const secondTool = toolManager.get('test_tool_1');

      expect(secondTool).toBe(updatedTool);
      expect(secondTool).not.toBe(firstTool);
    });

    it('should register disabled tool', () => {
      toolManager.register(testTool1, { enabled: false });
      expect(toolManager.has('test_tool_1')).toBe(true);
      expect(toolManager.isEnabled('test_tool_1')).toBe(false);
    });
  });

  describe('unregister', () => {
    it('should unregister a tool', () => {
      toolManager.register(testTool1);
      expect(toolManager.has('test_tool_1')).toBe(true);

      toolManager.unregister('test_tool_1');
      expect(toolManager.has('test_tool_1')).toBe(false);
    });

    it('should emit tool:unregistered event', () => {
      const listener = vi.fn();
      toolManager.on('tool:unregistered', listener);

      toolManager.register(testTool1);
      toolManager.unregister('test_tool_1');

      expect(listener).toHaveBeenCalledWith({ name: 'test_tool_1' });
    });

    it('should not throw when unregistering non-existent tool', () => {
      expect(() => toolManager.unregister('non_existent')).not.toThrow();
    });
  });

  describe('enable/disable', () => {
    beforeEach(() => {
      toolManager.register(testTool1);
    });

    it('should enable a tool', () => {
      toolManager.disable('test_tool_1');
      expect(toolManager.isEnabled('test_tool_1')).toBe(false);

      const result = toolManager.enable('test_tool_1');
      expect(result).toBe(true);
      expect(toolManager.isEnabled('test_tool_1')).toBe(true);
    });

    it('should disable a tool', () => {
      expect(toolManager.isEnabled('test_tool_1')).toBe(true);

      const result = toolManager.disable('test_tool_1');
      expect(result).toBe(true);
      expect(toolManager.isEnabled('test_tool_1')).toBe(false);
    });

    it('should emit tool:enabled event', () => {
      const listener = vi.fn();
      toolManager.on('tool:enabled', listener);

      toolManager.disable('test_tool_1');
      toolManager.enable('test_tool_1');

      expect(listener).toHaveBeenCalledWith({ name: 'test_tool_1' });
    });

    it('should emit tool:disabled event', () => {
      const listener = vi.fn();
      toolManager.on('tool:disabled', listener);

      toolManager.disable('test_tool_1');

      expect(listener).toHaveBeenCalledWith({ name: 'test_tool_1' });
    });

    it('should return false when enabling non-existent tool', () => {
      const result = toolManager.enable('non_existent');
      expect(result).toBe(false);
    });

    it('should return false when disabling non-existent tool', () => {
      const result = toolManager.disable('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('should get a tool by name', () => {
      toolManager.register(testTool1);
      const tool = toolManager.get('test_tool_1');
      expect(tool).toBe(testTool1);
    });

    it('should return undefined for non-existent tool', () => {
      const tool = toolManager.get('non_existent');
      expect(tool).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered tool', () => {
      toolManager.register(testTool1);
      expect(toolManager.has('test_tool_1')).toBe(true);
    });

    it('should return false for non-existent tool', () => {
      expect(toolManager.has('non_existent')).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('should return true for enabled tool', () => {
      toolManager.register(testTool1, { enabled: true });
      expect(toolManager.isEnabled('test_tool_1')).toBe(true);
    });

    it('should return false for disabled tool', () => {
      toolManager.register(testTool1, { enabled: false });
      expect(toolManager.isEnabled('test_tool_1')).toBe(false);
    });

    it('should return false for non-existent tool', () => {
      expect(toolManager.isEnabled('non_existent')).toBe(false);
    });
  });

  describe('list', () => {
    it('should list all tool names', () => {
      toolManager.register(testTool1);
      toolManager.register(testTool2);
      toolManager.register(testTool3);

      const names = toolManager.list();
      expect(names).toHaveLength(3);
      expect(names).toContain('test_tool_1');
      expect(names).toContain('test_tool_2');
      expect(names).toContain('test_tool_3');
    });

    it('should return empty array when no tools', () => {
      const names = toolManager.list();
      expect(names).toEqual([]);
    });
  });

  describe('listEnabled', () => {
    it('should list only enabled tools', () => {
      toolManager.register(testTool1, { enabled: true });
      toolManager.register(testTool2, { enabled: false });
      toolManager.register(testTool3, { enabled: true });

      const names = toolManager.listEnabled();
      expect(names).toHaveLength(2);
      expect(names).toContain('test_tool_1');
      expect(names).toContain('test_tool_3');
      expect(names).not.toContain('test_tool_2');
    });

    it('should return empty array when no enabled tools', () => {
      toolManager.register(testTool1, { enabled: false });
      const names = toolManager.listEnabled();
      expect(names).toEqual([]);
    });
  });

  describe('getEnabled', () => {
    it('should return enabled tools', () => {
      toolManager.register(testTool1, { enabled: true });
      toolManager.register(testTool2, { enabled: false });
      toolManager.register(testTool3, { enabled: true });

      const tools = toolManager.getEnabled();
      expect(tools).toHaveLength(2);
      expect(tools).toContainEqual(testTool1);
      expect(tools).toContainEqual(testTool3);
      expect(tools).not.toContainEqual(testTool2);
    });

    it('should return empty array when no enabled tools', () => {
      toolManager.register(testTool1, { enabled: false });
      const tools = toolManager.getEnabled();
      expect(tools).toEqual([]);
    });
  });

  describe('getAll', () => {
    it('should return all tools', () => {
      toolManager.register(testTool1);
      toolManager.register(testTool2);
      toolManager.register(testTool3);

      const tools = toolManager.getAll();
      expect(tools).toHaveLength(3);
      expect(tools).toContainEqual(testTool1);
      expect(tools).toContainEqual(testTool2);
      expect(tools).toContainEqual(testTool3);
    });

    it('should return empty array when no tools', () => {
      const tools = toolManager.getAll();
      expect(tools).toEqual([]);
    });
  });

  describe('selectForContext', () => {
    it('should select tools based on condition', () => {
      const conditionalTool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'conditional_tool',
            description: 'Conditional tool',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        },
        execute: vi.fn(async () => ({ result: 'conditional' })),
      };

      toolManager.register(testTool1);
      toolManager.register(conditionalTool, {
        conditions: [
          {
            type: 'mode',
            predicate: (context) => context.mode === 'admin',
          },
        ],
      });

      // Without admin mode
      const tools1 = toolManager.selectForContext({ mode: 'user' });
      expect(tools1).toHaveLength(1);
      expect(tools1).toContainEqual(testTool1);

      // With admin mode
      const tools2 = toolManager.selectForContext({ mode: 'admin' });
      expect(tools2).toHaveLength(2);
      expect(tools2).toContainEqual(testTool1);
      expect(tools2).toContainEqual(conditionalTool);
    });

    it('should only return enabled tools', () => {
      toolManager.register(testTool1, { enabled: true });
      toolManager.register(testTool2, { enabled: false });

      const tools = toolManager.selectForContext({});
      expect(tools).toHaveLength(1);
      expect(tools).toContainEqual(testTool1);
    });

    it('should sort by priority descending', () => {
      toolManager.register(testTool1, { priority: 10 });
      toolManager.register(testTool2, { priority: 100 });
      toolManager.register(testTool3, { priority: 50 });

      const tools = toolManager.selectForContext({});
      expect(tools[0]).toBe(testTool2); // Priority 100
      expect(tools[1]).toBe(testTool3); // Priority 50
      expect(tools[2]).toBe(testTool1); // Priority 10
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      toolManager.register(testTool1, { enabled: true });
      toolManager.register(testTool2, { enabled: false });
      toolManager.register(testTool3, { enabled: true });

      const stats = toolManager.getStats();
      expect(stats.totalTools).toBe(3);
      expect(stats.enabledTools).toBe(2);
      expect(stats.disabledTools).toBe(1);
    });

    it('should include namespace counts', () => {
      toolManager.register(testTool1, { namespace: 'api' });
      toolManager.register(testTool2, { namespace: 'api' });
      toolManager.register(testTool3, { namespace: 'db' });

      const stats = toolManager.getStats();
      expect(stats.toolsByNamespace.api).toBe(2);
      expect(stats.toolsByNamespace.db).toBe(1);
    });
  });

  describe('getState / loadState', () => {
    it('should serialize and deserialize state', () => {
      toolManager.register(testTool1, {
        namespace: 'test',
        priority: 100,
        enabled: true,
      });
      toolManager.register(testTool2, {
        namespace: 'test',
        priority: 50,
        enabled: false,
      });

      const state = toolManager.getState();

      // Create new manager and load state
      const newManager = new ToolManager();
      newManager.register(testTool1); // Tools must exist
      newManager.register(testTool2);
      newManager.loadState(state);

      expect(newManager.isEnabled('test_tool_1')).toBe(true);
      expect(newManager.isEnabled('test_tool_2')).toBe(false);
    });

    it('should handle missing tools in state', () => {
      toolManager.register(testTool1);
      const state = toolManager.getState();

      const newManager = new ToolManager();
      // Don't register testTool1
      expect(() => newManager.loadState(state)).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all tools', () => {
      toolManager.register(testTool1);
      toolManager.register(testTool2);
      toolManager.register(testTool3);

      expect(toolManager.list()).toHaveLength(3);

      toolManager.clear();
      expect(toolManager.list()).toHaveLength(0);
    });
  });
});
