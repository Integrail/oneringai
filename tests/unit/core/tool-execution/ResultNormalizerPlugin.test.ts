/**
 * Unit tests for ResultNormalizerPlugin
 */

import { describe, it, expect, vi } from 'vitest';
import { ResultNormalizerPlugin } from '../../../../src/core/tool-execution/plugins/ResultNormalizerPlugin.js';
import type { PluginExecutionContext } from '../../../../src/core/tool-execution/types.js';
import type { ToolFunction } from '../../../../src/domain/entities/Tool.js';

// Helper to create a mock context
function createMockContext(overrides: Partial<PluginExecutionContext> = {}): PluginExecutionContext {
  const mockTool: ToolFunction = {
    definition: {
      type: 'function',
      function: {
        name: 'test_tool',
        description: 'Test tool',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    execute: vi.fn(),
  };

  return {
    toolName: 'test_tool',
    args: { input: 'test' },
    mutableArgs: { input: 'test' },
    metadata: new Map(),
    startTime: Date.now() - 100,
    tool: mockTool,
    executionId: 'exec-123',
    ...overrides,
  };
}

describe('ResultNormalizerPlugin', () => {
  describe('constructor', () => {
    it('should create plugin with default options', () => {
      const plugin = new ResultNormalizerPlugin();

      expect(plugin.name).toBe('result-normalizer');
      expect(plugin.priority).toBe(0); // Runs LAST in afterExecute
    });

    it('should accept custom options', () => {
      const plugin = new ResultNormalizerPlugin({
        wrapPrimitives: true,
        addSuccessField: true,
      });

      expect(plugin.name).toBe('result-normalizer');
    });
  });

  describe('afterExecute()', () => {
    describe('undefined/null handling', () => {
      it('should convert undefined to error object', async () => {
        const plugin = new ResultNormalizerPlugin();
        const ctx = createMockContext({ toolName: 'browser_click' });

        const result = await plugin.afterExecute(ctx, undefined);

        expect(result).toEqual({
          success: false,
          error: "Tool 'browser_click' returned no result",
        });
      });

      it('should convert null to error object', async () => {
        const plugin = new ResultNormalizerPlugin();
        const ctx = createMockContext({ toolName: 'browser_navigate' });

        const result = await plugin.afterExecute(ctx, null);

        expect(result).toEqual({
          success: false,
          error: "Tool 'browser_navigate' returned no result",
        });
      });
    });

    describe('objects with success field', () => {
      it('should pass through objects with success: true', async () => {
        const plugin = new ResultNormalizerPlugin();
        const ctx = createMockContext();
        const input = { success: true, data: 'test' };

        const result = await plugin.afterExecute(ctx, input);

        expect(result).toBe(input); // Same reference
      });

      it('should pass through objects with success: false', async () => {
        const plugin = new ResultNormalizerPlugin();
        const ctx = createMockContext();
        const input = { success: false, error: 'Something went wrong' };

        const result = await plugin.afterExecute(ctx, input);

        expect(result).toBe(input); // Same reference
      });
    });

    describe('primitive values', () => {
      it('should pass through strings by default', async () => {
        const plugin = new ResultNormalizerPlugin();
        const ctx = createMockContext();

        const result = await plugin.afterExecute(ctx, 'hello world');

        expect(result).toBe('hello world');
      });

      it('should pass through numbers by default', async () => {
        const plugin = new ResultNormalizerPlugin();
        const ctx = createMockContext();

        const result = await plugin.afterExecute(ctx, 42);

        expect(result).toBe(42);
      });

      it('should pass through booleans by default', async () => {
        const plugin = new ResultNormalizerPlugin();
        const ctx = createMockContext();

        const result = await plugin.afterExecute(ctx, true);

        expect(result).toBe(true);
      });

      it('should wrap primitives when wrapPrimitives is true', async () => {
        const plugin = new ResultNormalizerPlugin({ wrapPrimitives: true });
        const ctx = createMockContext();

        const stringResult = await plugin.afterExecute(ctx, 'hello');
        const numberResult = await plugin.afterExecute(ctx, 42);
        const boolResult = await plugin.afterExecute(ctx, false);

        expect(stringResult).toEqual({ success: true, result: 'hello' });
        expect(numberResult).toEqual({ success: true, result: 42 });
        expect(boolResult).toEqual({ success: true, result: false });
      });
    });

    describe('objects without success field', () => {
      it('should pass through objects without success field by default', async () => {
        const plugin = new ResultNormalizerPlugin();
        const ctx = createMockContext();
        const input = { data: 'test', count: 5 };

        const result = await plugin.afterExecute(ctx, input);

        expect(result).toBe(input); // Same reference
      });

      it('should add success field when addSuccessField is true', async () => {
        const plugin = new ResultNormalizerPlugin({ addSuccessField: true });
        const ctx = createMockContext();
        const input = { data: 'test', count: 5 };

        const result = await plugin.afterExecute(ctx, input);

        expect(result).toEqual({ success: true, data: 'test', count: 5 });
        expect(result).not.toBe(input); // New object
      });

      it('should pass through arrays', async () => {
        const plugin = new ResultNormalizerPlugin();
        const ctx = createMockContext();
        const input = [1, 2, 3];

        const result = await plugin.afterExecute(ctx, input);

        expect(result).toBe(input);
      });
    });
  });

  describe('onError()', () => {
    it('should convert Error to error result object', async () => {
      const plugin = new ResultNormalizerPlugin();
      const ctx = createMockContext({ toolName: 'browser_click' });
      const error = new Error('Element not found');

      const result = await plugin.onError(ctx, error);

      expect(result).toEqual({
        success: false,
        error: 'Element not found',
        errorType: 'Error',
        toolName: 'browser_click',
      });
    });

    it('should handle custom error types', async () => {
      const plugin = new ResultNormalizerPlugin();
      const ctx = createMockContext({ toolName: 'api_call' });

      class NetworkError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'NetworkError';
        }
      }

      const error = new NetworkError('Connection timeout');
      const result = await plugin.onError(ctx, error);

      expect(result).toEqual({
        success: false,
        error: 'Connection timeout',
        errorType: 'NetworkError',
        toolName: 'api_call',
      });
    });

    it('should handle TypeError', async () => {
      const plugin = new ResultNormalizerPlugin();
      const ctx = createMockContext();
      const error = new TypeError('Cannot read property of undefined');

      const result = await plugin.onError(ctx, error);

      expect(result).toEqual({
        success: false,
        error: 'Cannot read property of undefined',
        errorType: 'TypeError',
        toolName: 'test_tool',
      });
    });
  });

  describe('plugin interface', () => {
    it('should have correct name', () => {
      const plugin = new ResultNormalizerPlugin();
      expect(plugin.name).toBe('result-normalizer');
    });

    it('should have priority 0 (runs last in afterExecute)', () => {
      const plugin = new ResultNormalizerPlugin();
      expect(plugin.priority).toBe(0);
    });

    it('should implement afterExecute hook', () => {
      const plugin = new ResultNormalizerPlugin();
      expect(typeof plugin.afterExecute).toBe('function');
    });

    it('should implement onError hook', () => {
      const plugin = new ResultNormalizerPlugin();
      expect(typeof plugin.onError).toBe('function');
    });

    it('should not implement beforeExecute hook', () => {
      const plugin = new ResultNormalizerPlugin();
      expect(plugin.beforeExecute).toBeUndefined();
    });
  });

  describe('combined options', () => {
    it('should apply both wrapPrimitives and addSuccessField', async () => {
      const plugin = new ResultNormalizerPlugin({
        wrapPrimitives: true,
        addSuccessField: true,
      });
      const ctx = createMockContext();

      // Test primitive wrapping
      const primitiveResult = await plugin.afterExecute(ctx, 'hello');
      expect(primitiveResult).toEqual({ success: true, result: 'hello' });

      // Test object success field addition
      const objectResult = await plugin.afterExecute(ctx, { data: 'test' });
      expect(objectResult).toEqual({ success: true, data: 'test' });

      // Test null still becomes error
      const nullResult = await plugin.afterExecute(ctx, null);
      expect(nullResult).toEqual({
        success: false,
        error: "Tool 'test_tool' returned no result",
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty objects', async () => {
      const plugin = new ResultNormalizerPlugin();
      const ctx = createMockContext();
      const input = {};

      const result = await plugin.afterExecute(ctx, input);

      expect(result).toBe(input);
    });

    it('should handle empty arrays', async () => {
      const plugin = new ResultNormalizerPlugin();
      const ctx = createMockContext();
      const input: unknown[] = [];

      const result = await plugin.afterExecute(ctx, input);

      expect(result).toBe(input);
    });

    it('should handle nested objects', async () => {
      const plugin = new ResultNormalizerPlugin();
      const ctx = createMockContext();
      const input = {
        success: true,
        data: {
          nested: {
            value: 'deep',
          },
        },
      };

      const result = await plugin.afterExecute(ctx, input);

      expect(result).toBe(input);
    });

    it('should handle objects with success as non-boolean', async () => {
      const plugin = new ResultNormalizerPlugin();
      const ctx = createMockContext();
      // Edge case: success is present but not a boolean
      const input = { success: 'yes', data: 'test' };

      const result = await plugin.afterExecute(ctx, input);

      // Should still pass through because 'success' key exists
      expect(result).toBe(input);
    });
  });
});
