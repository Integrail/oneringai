/**
 * ToolRegistry Unit Tests
 * Tests tool registration, lookup, and execution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolRegistry } from '@/capabilities/agents/ToolRegistry.js';
import { ToolFunction } from '@/domain/entities/Tool.js';
import { ToolNotFoundError, ToolExecutionError } from '@/domain/errors/AIErrors.js';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  // Helper to create a tool function
  const createTool = (name: string, fn: (args: any) => any): ToolFunction => ({
    definition: {
      type: 'function',
      function: {
        name,
        description: `Tool: ${name}`,
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        }
      }
    },
    execute: fn
  });

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('Tool Registration', () => {
    it('should register a tool function', () => {
      const tool = createTool('my_tool', async () => 'result');
      registry.registerTool(tool);

      expect(registry.hasToolFunction('my_tool')).toBe(true);
      expect(registry.listTools()).toContain('my_tool');
    });

    it('should overwrite tool with same name', () => {
      const tool1 = createTool('same_name', async () => 'first');
      const tool2 = createTool('same_name', async () => 'second');

      registry.registerTool(tool1);
      registry.registerTool(tool2);

      // Only one tool with that name
      expect(registry.listTools().filter(t => t === 'same_name').length).toBe(1);
    });

    it('should unregister tool by name', () => {
      const tool = createTool('removable', async () => 'result');
      registry.registerTool(tool);

      expect(registry.hasToolFunction('removable')).toBe(true);

      registry.unregisterTool('removable');

      expect(registry.hasToolFunction('removable')).toBe(false);
    });

    it('should list all registered tools', () => {
      registry.registerTool(createTool('tool1', async () => 1));
      registry.registerTool(createTool('tool2', async () => 2));
      registry.registerTool(createTool('tool3', async () => 3));

      const tools = registry.listTools();

      expect(tools).toHaveLength(3);
      expect(tools).toContain('tool1');
      expect(tools).toContain('tool2');
      expect(tools).toContain('tool3');
    });

    it('should clear all registered tools', () => {
      registry.registerTool(createTool('tool1', async () => 1));
      registry.registerTool(createTool('tool2', async () => 2));

      registry.clear();

      expect(registry.listTools()).toHaveLength(0);
    });
  });

  describe('Tool Lookup', () => {
    it('should return tool definition for registered tool', () => {
      const tool = createTool('lookup_test', async () => 'result');
      registry.registerTool(tool);

      const definition = registry.getToolDefinition('lookup_test');

      expect(definition).toBeDefined();
      expect(definition?.function.name).toBe('lookup_test');
      expect(definition?.function.description).toBe('Tool: lookup_test');
    });

    it('should return undefined for unknown tool', () => {
      const definition = registry.getToolDefinition('nonexistent');

      expect(definition).toBeUndefined();
    });

    it('should return correct hasToolFunction boolean', () => {
      registry.registerTool(createTool('exists', async () => 'yes'));

      expect(registry.hasToolFunction('exists')).toBe(true);
      expect(registry.hasToolFunction('does_not_exist')).toBe(false);
    });
  });

  describe('Tool Execution', () => {
    it('should execute tool with arguments', async () => {
      const executeFn = vi.fn().mockResolvedValue({ result: 'success' });
      registry.registerTool(createTool('exec_test', executeFn));

      const result = await registry.execute('exec_test', { input: 'hello' });

      expect(executeFn).toHaveBeenCalledWith({ input: 'hello' });
      expect(result).toEqual({ result: 'success' });
    });

    it('should throw ToolNotFoundError for unknown tool', async () => {
      await expect(
        registry.execute('unknown_tool', {})
      ).rejects.toThrow(ToolNotFoundError);
    });

    it('should wrap tool errors in ToolExecutionError', async () => {
      registry.registerTool(createTool('failing_tool', async () => {
        throw new Error('Internal tool failure');
      }));

      try {
        await registry.execute('failing_tool', {});
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ToolExecutionError);
        expect((error as ToolExecutionError).message).toContain('Internal tool failure');
      }
    });

    it('should pass complex arguments correctly', async () => {
      const executeFn = vi.fn().mockResolvedValue('done');
      registry.registerTool(createTool('complex_args', executeFn));

      const complexArgs = {
        nested: {
          deep: {
            value: 123
          }
        },
        array: [1, 2, 3],
        boolean: true,
        nullValue: null
      };

      await registry.execute('complex_args', complexArgs);

      expect(executeFn).toHaveBeenCalledWith(complexArgs);
    });

    it('should handle async tool execution', async () => {
      registry.registerTool(createTool('async_tool', async (args) => {
        await new Promise(r => setTimeout(r, 50));
        return `Processed: ${args.input}`;
      }));

      const result = await registry.execute('async_tool', { input: 'test' });

      expect(result).toBe('Processed: test');
    });

    it('should handle sync tool execution', async () => {
      registry.registerTool(createTool('sync_tool', (args) => {
        return `Sync result: ${args.input}`;
      }));

      const result = await registry.execute('sync_tool', { input: 'test' });

      expect(result).toBe('Sync result: test');
    });

    it('should execute multiple tools independently', async () => {
      registry.registerTool(createTool('add', async (args) => args.a + args.b));
      registry.registerTool(createTool('multiply', async (args) => args.a * args.b));

      const addResult = await registry.execute('add', { a: 5, b: 3 });
      const multiplyResult = await registry.execute('multiply', { a: 5, b: 3 });

      expect(addResult).toBe(8);
      expect(multiplyResult).toBe(15);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arguments', async () => {
      const executeFn = vi.fn().mockResolvedValue('ok');
      registry.registerTool(createTool('no_args', executeFn));

      await registry.execute('no_args', {});

      expect(executeFn).toHaveBeenCalledWith({});
    });

    it('should handle undefined arguments', async () => {
      const executeFn = vi.fn().mockResolvedValue('ok');
      registry.registerTool(createTool('undef_args', executeFn));

      await registry.execute('undef_args', undefined);

      expect(executeFn).toHaveBeenCalledWith(undefined);
    });

    it('should handle tool that returns undefined', async () => {
      registry.registerTool(createTool('void_tool', async () => undefined));

      const result = await registry.execute('void_tool', {});

      expect(result).toBeUndefined();
    });

    it('should handle tool that returns null', async () => {
      registry.registerTool(createTool('null_tool', async () => null));

      const result = await registry.execute('null_tool', {});

      expect(result).toBeNull();
    });

    it('should unregister non-existent tool without error', () => {
      // Should not throw
      registry.unregisterTool('never_existed');

      expect(registry.hasToolFunction('never_existed')).toBe(false);
    });
  });
});
