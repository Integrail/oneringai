/**
 * Unit tests for ToolExecutionPipeline
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolExecutionPipeline } from '../../../../src/core/tool-execution/ToolExecutionPipeline.js';
import type {
  IToolExecutionPlugin,
  PluginExecutionContext,
  BeforeExecuteResult,
} from '../../../../src/core/tool-execution/types.js';
import type { ToolFunction } from '../../../../src/domain/entities/Tool.js';

// Helper to create a mock tool
function createMockTool(name: string, executeResult: unknown = { success: true }): ToolFunction {
  return {
    definition: {
      type: 'function',
      function: {
        name,
        description: `Mock tool: ${name}`,
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    execute: vi.fn().mockResolvedValue(executeResult),
  };
}

// Helper to create a mock plugin
function createMockPlugin(
  name: string,
  options: {
    priority?: number;
    beforeExecute?: (ctx: PluginExecutionContext) => Promise<BeforeExecuteResult>;
    afterExecute?: (ctx: PluginExecutionContext, result: unknown) => Promise<unknown>;
    onError?: (ctx: PluginExecutionContext, error: Error) => Promise<unknown>;
  } = {}
): IToolExecutionPlugin {
  return {
    name,
    priority: options.priority,
    beforeExecute: options.beforeExecute,
    afterExecute: options.afterExecute,
    onError: options.onError,
  };
}

describe('ToolExecutionPipeline', () => {
  let pipeline: ToolExecutionPipeline;

  beforeEach(() => {
    pipeline = new ToolExecutionPipeline();
  });

  describe('use()', () => {
    it('should register a plugin', () => {
      const plugin = createMockPlugin('test-plugin');

      pipeline.use(plugin);

      expect(pipeline.has('test-plugin')).toBe(true);
    });

    it('should return the pipeline for chaining', () => {
      const plugin = createMockPlugin('test-plugin');

      const result = pipeline.use(plugin);

      expect(result).toBe(pipeline);
    });

    it('should replace existing plugin with same name', () => {
      const plugin1 = createMockPlugin('test-plugin', { priority: 10 });
      const plugin2 = createMockPlugin('test-plugin', { priority: 20 });

      pipeline.use(plugin1);
      pipeline.use(plugin2);

      const registered = pipeline.get('test-plugin');
      expect(registered?.priority).toBe(20);
    });

    it('should call onRegister when plugin is registered', () => {
      const onRegister = vi.fn();
      const plugin: IToolExecutionPlugin = {
        name: 'test-plugin',
        onRegister,
      };

      pipeline.use(plugin);

      expect(onRegister).toHaveBeenCalledWith(pipeline);
    });
  });

  describe('remove()', () => {
    it('should remove a registered plugin', () => {
      const plugin = createMockPlugin('test-plugin');
      pipeline.use(plugin);

      const removed = pipeline.remove('test-plugin');

      expect(removed).toBe(true);
      expect(pipeline.has('test-plugin')).toBe(false);
    });

    it('should return false for non-existent plugin', () => {
      const removed = pipeline.remove('non-existent');

      expect(removed).toBe(false);
    });

    it('should call onUnregister when plugin is removed', () => {
      const onUnregister = vi.fn();
      const plugin: IToolExecutionPlugin = {
        name: 'test-plugin',
        onUnregister,
      };
      pipeline.use(plugin);

      pipeline.remove('test-plugin');

      expect(onUnregister).toHaveBeenCalled();
    });
  });

  describe('has()', () => {
    it('should return true for registered plugin', () => {
      pipeline.use(createMockPlugin('test-plugin'));

      expect(pipeline.has('test-plugin')).toBe(true);
    });

    it('should return false for non-existent plugin', () => {
      expect(pipeline.has('non-existent')).toBe(false);
    });
  });

  describe('get()', () => {
    it('should return registered plugin', () => {
      const plugin = createMockPlugin('test-plugin');
      pipeline.use(plugin);

      const retrieved = pipeline.get('test-plugin');

      expect(retrieved).toBe(plugin);
    });

    it('should return undefined for non-existent plugin', () => {
      const retrieved = pipeline.get('non-existent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('list()', () => {
    it('should return all registered plugins', () => {
      pipeline.use(createMockPlugin('plugin-a'));
      pipeline.use(createMockPlugin('plugin-b'));
      pipeline.use(createMockPlugin('plugin-c'));

      const plugins = pipeline.list();

      expect(plugins.length).toBe(3);
      expect(plugins.map(p => p.name)).toContain('plugin-a');
      expect(plugins.map(p => p.name)).toContain('plugin-b');
      expect(plugins.map(p => p.name)).toContain('plugin-c');
    });

    it('should return plugins sorted by priority (lower first)', () => {
      pipeline.use(createMockPlugin('high-priority', { priority: 200 }));
      pipeline.use(createMockPlugin('low-priority', { priority: 10 }));
      pipeline.use(createMockPlugin('default-priority')); // priority 100

      const plugins = pipeline.list();

      expect(plugins[0].name).toBe('low-priority');
      expect(plugins[1].name).toBe('default-priority');
      expect(plugins[2].name).toBe('high-priority');
    });

    it('should return empty array when no plugins registered', () => {
      const plugins = pipeline.list();

      expect(plugins).toEqual([]);
    });
  });

  describe('execute()', () => {
    it('should execute a tool and return result', async () => {
      const tool = createMockTool('test-tool', { data: 'result' });

      const result = await pipeline.execute(tool, { input: 'test' });

      expect(result).toEqual({ data: 'result' });
      expect(tool.execute).toHaveBeenCalledWith({ input: 'test' });
    });

    it('should call beforeExecute hooks in priority order', async () => {
      const callOrder: string[] = [];

      pipeline.use(createMockPlugin('plugin-high', {
        priority: 200,
        beforeExecute: async () => { callOrder.push('high'); },
      }));
      pipeline.use(createMockPlugin('plugin-low', {
        priority: 10,
        beforeExecute: async () => { callOrder.push('low'); },
      }));
      pipeline.use(createMockPlugin('plugin-default', {
        beforeExecute: async () => { callOrder.push('default'); },
      }));

      const tool = createMockTool('test-tool');
      await pipeline.execute(tool, {});

      expect(callOrder).toEqual(['low', 'default', 'high']);
    });

    it('should call afterExecute hooks in reverse priority order', async () => {
      const callOrder: string[] = [];

      pipeline.use(createMockPlugin('plugin-high', {
        priority: 200,
        afterExecute: async (_, result) => { callOrder.push('high'); return result; },
      }));
      pipeline.use(createMockPlugin('plugin-low', {
        priority: 10,
        afterExecute: async (_, result) => { callOrder.push('low'); return result; },
      }));
      pipeline.use(createMockPlugin('plugin-default', {
        afterExecute: async (_, result) => { callOrder.push('default'); return result; },
      }));

      const tool = createMockTool('test-tool');
      await pipeline.execute(tool, {});

      expect(callOrder).toEqual(['high', 'default', 'low']);
    });

    it('should allow beforeExecute to modify args', async () => {
      pipeline.use(createMockPlugin('modifier', {
        beforeExecute: async (ctx) => {
          return { modifiedArgs: { ...ctx.mutableArgs as object, added: true } };
        },
      }));

      const tool = createMockTool('test-tool');
      await pipeline.execute(tool, { original: true });

      expect(tool.execute).toHaveBeenCalledWith({ original: true, added: true });
    });

    it('should allow beforeExecute to abort execution', async () => {
      pipeline.use(createMockPlugin('aborter', {
        beforeExecute: async () => {
          return { abort: true, result: { aborted: true } };
        },
      }));

      const tool = createMockTool('test-tool');
      const result = await pipeline.execute(tool, {});

      expect(result).toEqual({ aborted: true });
      expect(tool.execute).not.toHaveBeenCalled();
    });

    it('should allow afterExecute to transform result', async () => {
      pipeline.use(createMockPlugin('transformer', {
        afterExecute: async (_, result) => {
          return { ...result as object, transformed: true };
        },
      }));

      const tool = createMockTool('test-tool', { original: true });
      const result = await pipeline.execute(tool, {});

      expect(result).toEqual({ original: true, transformed: true });
    });

    it('should call onError hooks when tool throws', async () => {
      const error = new Error('Tool failed');
      const onError = vi.fn().mockResolvedValue(undefined);

      pipeline.use(createMockPlugin('error-handler', { onError }));

      const tool = createMockTool('test-tool');
      (tool.execute as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(pipeline.execute(tool, {})).rejects.toThrow('Tool failed');
      expect(onError).toHaveBeenCalled();
    });

    it('should allow onError to recover from error', async () => {
      const error = new Error('Tool failed');

      pipeline.use(createMockPlugin('recoverer', {
        onError: async () => ({ recovered: true }),
      }));

      const tool = createMockTool('test-tool');
      (tool.execute as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      const result = await pipeline.execute(tool, {});

      expect(result).toEqual({ recovered: true });
    });

    it('should provide correct context to plugins', async () => {
      let capturedContext: PluginExecutionContext | null = null;

      pipeline.use(createMockPlugin('context-capturer', {
        beforeExecute: async (ctx) => {
          capturedContext = ctx;
        },
      }));

      const tool = createMockTool('my-tool');
      await pipeline.execute(tool, { myArg: 'value' });

      expect(capturedContext).not.toBeNull();
      expect(capturedContext!.toolName).toBe('my-tool');
      expect(capturedContext!.args).toEqual({ myArg: 'value' });
      expect(capturedContext!.mutableArgs).toEqual({ myArg: 'value' });
      expect(capturedContext!.metadata).toBeInstanceOf(Map);
      expect(capturedContext!.startTime).toBeLessThanOrEqual(Date.now());
      expect(capturedContext!.tool).toBe(tool);
      expect(capturedContext!.executionId).toBeDefined();
    });

    it('should allow plugins to share data via metadata', async () => {
      let sharedValue: unknown;

      pipeline.use(createMockPlugin('writer', {
        priority: 10,
        beforeExecute: async (ctx) => {
          ctx.metadata.set('shared-key', 'shared-value');
        },
      }));

      pipeline.use(createMockPlugin('reader', {
        priority: 100,
        beforeExecute: async (ctx) => {
          sharedValue = ctx.metadata.get('shared-key');
        },
      }));

      const tool = createMockTool('test-tool');
      await pipeline.execute(tool, {});

      expect(sharedValue).toBe('shared-value');
    });

    it('should generate unique executionId for each execution', async () => {
      const executionIds: string[] = [];

      pipeline.use(createMockPlugin('id-collector', {
        beforeExecute: async (ctx) => {
          executionIds.push(ctx.executionId);
        },
      }));

      const tool = createMockTool('test-tool');
      await pipeline.execute(tool, {});
      await pipeline.execute(tool, {});
      await pipeline.execute(tool, {});

      expect(executionIds.length).toBe(3);
      expect(new Set(executionIds).size).toBe(3); // All unique
    });
  });

  describe('priority ordering edge cases', () => {
    it('should handle plugins with same priority', async () => {
      const callOrder: string[] = [];

      pipeline.use(createMockPlugin('plugin-a', {
        priority: 100,
        beforeExecute: async () => { callOrder.push('a'); },
      }));
      pipeline.use(createMockPlugin('plugin-b', {
        priority: 100,
        beforeExecute: async () => { callOrder.push('b'); },
      }));

      const tool = createMockTool('test-tool');
      await pipeline.execute(tool, {});

      // Both should be called (order may vary)
      expect(callOrder.length).toBe(2);
      expect(callOrder).toContain('a');
      expect(callOrder).toContain('b');
    });

    it('should use default priority (100) when not specified', async () => {
      const callOrder: string[] = [];

      pipeline.use(createMockPlugin('explicit-100', {
        priority: 100,
        beforeExecute: async () => { callOrder.push('explicit'); },
      }));
      pipeline.use(createMockPlugin('default-priority', {
        // No priority specified
        beforeExecute: async () => { callOrder.push('default'); },
      }));
      pipeline.use(createMockPlugin('priority-50', {
        priority: 50,
        beforeExecute: async () => { callOrder.push('fifty'); },
      }));

      const tool = createMockTool('test-tool');
      await pipeline.execute(tool, {});

      expect(callOrder[0]).toBe('fifty');
      // explicit and default both have priority 100, so they come after 50
      expect(callOrder.slice(1).sort()).toEqual(['default', 'explicit']);
    });
  });

  describe('error handling edge cases', () => {
    it('should propagate error if no plugin recovers', async () => {
      pipeline.use(createMockPlugin('non-recoverer', {
        onError: async () => undefined, // Doesn't recover
      }));

      const tool = createMockTool('test-tool');
      (tool.execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Fail'));

      await expect(pipeline.execute(tool, {})).rejects.toThrow('Fail');
    });

    it('should stop calling onError handlers once one recovers', async () => {
      const onError1 = vi.fn().mockResolvedValue({ recovered: 'first' });
      const onError2 = vi.fn().mockResolvedValue({ recovered: 'second' });

      pipeline.use(createMockPlugin('recoverer-1', { priority: 10, onError: onError1 }));
      pipeline.use(createMockPlugin('recoverer-2', { priority: 100, onError: onError2 }));

      const tool = createMockTool('test-tool');
      (tool.execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Fail'));

      const result = await pipeline.execute(tool, {});

      expect(result).toEqual({ recovered: 'first' });
      expect(onError1).toHaveBeenCalled();
      expect(onError2).not.toHaveBeenCalled();
    });

    it('should handle errors in plugin hooks gracefully', async () => {
      pipeline.use(createMockPlugin('bad-plugin', {
        beforeExecute: async () => {
          throw new Error('Plugin error');
        },
      }));

      const tool = createMockTool('test-tool');

      await expect(pipeline.execute(tool, {})).rejects.toThrow('Plugin error');
    });
  });

  describe('no plugins', () => {
    it('should execute tool directly when no plugins registered', async () => {
      const tool = createMockTool('test-tool', { result: 'direct' });

      const result = await pipeline.execute(tool, { arg: 'value' });

      expect(result).toEqual({ result: 'direct' });
      expect(tool.execute).toHaveBeenCalledWith({ arg: 'value' });
    });
  });
});
