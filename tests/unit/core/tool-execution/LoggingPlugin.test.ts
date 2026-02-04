/**
 * Unit tests for LoggingPlugin
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoggingPlugin } from '../../../../src/core/tool-execution/plugins/LoggingPlugin.js';
import type { PluginExecutionContext } from '../../../../src/core/tool-execution/types.js';
import type { ToolFunction } from '../../../../src/domain/entities/Tool.js';

// Mock logger
function createMockLogger() {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
}

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
    startTime: Date.now() - 100, // 100ms ago
    tool: mockTool,
    executionId: 'exec-123',
    ...overrides,
  };
}

describe('LoggingPlugin', () => {
  describe('constructor', () => {
    it('should create plugin with default options', () => {
      const plugin = new LoggingPlugin();

      expect(plugin.name).toBe('logging');
      expect(plugin.priority).toBe(5);
    });

    it('should use provided logger', () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any });

      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'ToolExecution' });
    });

    it('should use custom component name', () => {
      const mockLogger = createMockLogger();
      new LoggingPlugin({ logger: mockLogger as any, component: 'MyComponent' });

      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'MyComponent' });
    });
  });

  describe('beforeExecute()', () => {
    it('should log tool start with args when logArgs is true', async () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any, logArgs: true });
      const ctx = createMockContext({ args: { query: 'test' } });

      await plugin.beforeExecute(ctx);

      expect(mockLogger.debug).toHaveBeenCalled();
      const [logData, message] = mockLogger.debug.mock.calls[0];
      expect(logData.tool).toBe('test_tool');
      expect(logData.executionId).toBe('exec-123');
      expect(logData.args).toBeDefined();
      expect(message).toContain('starting');
    });

    it('should not log args when logArgs is false', async () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any, logArgs: false });
      const ctx = createMockContext({ args: { secret: 'password123' } });

      await plugin.beforeExecute(ctx);

      const [logData] = mockLogger.debug.mock.calls[0];
      expect(logData.args).toBeUndefined();
    });

    it('should use configured log level', async () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any, level: 'info' });
      const ctx = createMockContext();

      await plugin.beforeExecute(ctx);

      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should return undefined (pass through)', async () => {
      const plugin = new LoggingPlugin();
      const ctx = createMockContext();

      const result = await plugin.beforeExecute(ctx);

      expect(result).toBeUndefined();
    });
  });

  describe('afterExecute()', () => {
    it('should log tool completion with duration', async () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any });
      const ctx = createMockContext();
      const result = { success: true, data: 'value' };

      await plugin.afterExecute(ctx, result);

      expect(mockLogger.debug).toHaveBeenCalled();
      const [logData, message] = mockLogger.debug.mock.calls[0];
      expect(logData.tool).toBe('test_tool');
      expect(logData.durationMs).toBeGreaterThanOrEqual(0);
      expect(message).toContain('completed');
      expect(message).toContain('ms');
    });

    it('should log result summary when logResult is true', async () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any, logResult: true });
      const ctx = createMockContext();
      const result = { success: true, count: 5 };

      await plugin.afterExecute(ctx, result);

      const [logData] = mockLogger.debug.mock.calls[0];
      expect(logData.result).toBeDefined();
      expect(logData.result.success).toBe(true);
    });

    it('should not log result when logResult is false', async () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any, logResult: false });
      const ctx = createMockContext();
      const result = { success: true };

      await plugin.afterExecute(ctx, result);

      const [logData] = mockLogger.debug.mock.calls[0];
      expect(logData.result).toBeUndefined();
    });

    it('should return the result unchanged', async () => {
      const plugin = new LoggingPlugin();
      const ctx = createMockContext();
      const originalResult = { data: 'original', nested: { key: 'value' } };

      const returnedResult = await plugin.afterExecute(ctx, originalResult);

      expect(returnedResult).toBe(originalResult);
    });
  });

  describe('onError()', () => {
    it('should log error with error level', async () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any });
      const ctx = createMockContext();
      const error = new Error('Something went wrong');

      await plugin.onError(ctx, error);

      expect(mockLogger.error).toHaveBeenCalled();
      const [logData, message] = mockLogger.error.mock.calls[0];
      expect(logData.tool).toBe('test_tool');
      expect(logData.error).toBe('Something went wrong');
      expect(logData.errorName).toBe('Error');
      expect(message).toContain('failed');
    });

    it('should use configured error level', async () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any, errorLevel: 'warn' });
      const ctx = createMockContext();
      const error = new Error('Warning-level error');

      await plugin.onError(ctx, error);

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should include duration in error log', async () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any });
      const ctx = createMockContext();
      const error = new Error('Failed');

      await plugin.onError(ctx, error);

      const [logData] = mockLogger.error.mock.calls[0];
      expect(logData.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should return undefined to not recover from error', async () => {
      const plugin = new LoggingPlugin();
      const ctx = createMockContext();
      const error = new Error('Test error');

      const result = await plugin.onError(ctx, error);

      expect(result).toBeUndefined();
    });
  });

  describe('summarize()', () => {
    it('should truncate long strings', async () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any, maxLogLength: 10, logResult: true });
      const ctx = createMockContext();
      // Pass a long string as the result (not nested in an object)
      const longString = 'This is a very long string that should be truncated';

      await plugin.afterExecute(ctx, longString);

      const [logData] = mockLogger.debug.mock.calls[0];
      expect(logData.result).toContain('...');
      expect(logData.result.length).toBeLessThanOrEqual(13); // 10 + '...'
    });

    it('should summarize arrays', async () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any, logResult: true });
      const ctx = createMockContext();
      const result = [1, 2, 3, 4, 5];

      await plugin.afterExecute(ctx, result);

      const [logData] = mockLogger.debug.mock.calls[0];
      expect(logData.result).toEqual({ type: 'array', length: 5 });
    });

    it('should summarize success/error result objects', async () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any, logResult: true });
      const ctx = createMockContext();
      const result = { success: false, error: 'Invalid input', data: 'ignored' };

      await plugin.afterExecute(ctx, result);

      const [logData] = mockLogger.debug.mock.calls[0];
      expect(logData.result.success).toBe(false);
      expect(logData.result.error).toBe('Invalid input');
    });

    it('should summarize results with count', async () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any, logResult: true });
      const ctx = createMockContext();
      const result = { success: true, count: 42, results: [1, 2, 3] };

      await plugin.afterExecute(ctx, result);

      const [logData] = mockLogger.debug.mock.calls[0];
      expect(logData.result.success).toBe(true);
      expect(logData.result.count).toBe(42);
      expect(logData.result.resultCount).toBe(3);
    });

    it('should summarize generic objects', async () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any, logResult: true });
      const ctx = createMockContext();
      const result = { foo: 1, bar: 2, baz: 3, qux: 4, quux: 5, corge: 6 };

      await plugin.afterExecute(ctx, result);

      const [logData] = mockLogger.debug.mock.calls[0];
      expect(logData.result.type).toBe('object');
      expect(logData.result.keys.length).toBe(5); // Max 5 keys shown
      expect(logData.result.keyCount).toBe(6);
    });

    it('should handle null and undefined', async () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any, logResult: true });
      const ctx = createMockContext();

      await plugin.afterExecute(ctx, null);
      await plugin.afterExecute(ctx, undefined);

      const calls = mockLogger.debug.mock.calls;
      expect(calls[0][0].result).toBeNull();
      expect(calls[1][0].result).toBeUndefined();
    });

    it('should handle primitive values', async () => {
      const mockLogger = createMockLogger();
      const plugin = new LoggingPlugin({ logger: mockLogger as any, logResult: true });
      const ctx = createMockContext();

      await plugin.afterExecute(ctx, 42);
      await plugin.afterExecute(ctx, true);

      const calls = mockLogger.debug.mock.calls;
      expect(calls[0][0].result).toBe(42);
      expect(calls[1][0].result).toBe(true);
    });
  });

  describe('log levels', () => {
    it.each(['trace', 'debug', 'info', 'warn', 'error'] as const)(
      'should use %s level when configured',
      async (level) => {
        const mockLogger = createMockLogger();
        const plugin = new LoggingPlugin({ logger: mockLogger as any, level });
        const ctx = createMockContext();

        await plugin.beforeExecute(ctx);

        expect(mockLogger[level]).toHaveBeenCalled();
      }
    );
  });

  describe('plugin interface', () => {
    it('should have correct name', () => {
      const plugin = new LoggingPlugin();
      expect(plugin.name).toBe('logging');
    });

    it('should have low priority (runs early)', () => {
      const plugin = new LoggingPlugin();
      expect(plugin.priority).toBe(5);
    });

    it('should implement all hooks', () => {
      const plugin = new LoggingPlugin();
      expect(typeof plugin.beforeExecute).toBe('function');
      expect(typeof plugin.afterExecute).toBe('function');
      expect(typeof plugin.onError).toBe('function');
    });
  });
});
