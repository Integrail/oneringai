/**
 * HookManager Unit Tests
 * Tests hook registration, execution, error handling, and lifecycle
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { HookManager } from '@/capabilities/agents/HookManager.js';
import { HookConfig, HookName } from '@/capabilities/agents/types/HookTypes.js';

describe('HookManager', () => {
  let emitter: EventEmitter;
  let hookManager: HookManager;

  beforeEach(() => {
    emitter = new EventEmitter();
    hookManager = new HookManager({}, emitter);
  });

  describe('Hook Registration', () => {
    it('should register a hook successfully', () => {
      const hook = vi.fn();
      hookManager.register('before:execution', hook);

      expect(hookManager.hasHooks('before:execution')).toBe(true);
      expect(hookManager.getHookCount('before:execution')).toBe(1);
    });

    it('should register multiple hooks for the same event', () => {
      const hook1 = vi.fn();
      const hook2 = vi.fn();
      const hook3 = vi.fn();

      hookManager.register('before:execution', hook1);
      hookManager.register('before:execution', hook2);
      hookManager.register('before:execution', hook3);

      expect(hookManager.getHookCount('before:execution')).toBe(3);
    });

    it('should enforce 10-hook limit per event type', () => {
      // Register 10 hooks
      for (let i = 0; i < 10; i++) {
        hookManager.register('before:execution', vi.fn());
      }

      expect(hookManager.getHookCount('before:execution')).toBe(10);

      // 11th hook should throw
      expect(() => {
        hookManager.register('before:execution', vi.fn());
      }).toThrow(/too many hooks/i);
    });

    it('should throw when registering non-function as hook', () => {
      expect(() => {
        hookManager.register('before:execution', 'not a function' as any);
      }).toThrow(/hook must be a function/i);
    });

    it('should return total hook count across all event types', () => {
      hookManager.register('before:execution', vi.fn());
      hookManager.register('after:execution', vi.fn());
      hookManager.register('before:tool', vi.fn());
      hookManager.register('before:tool', vi.fn());

      expect(hookManager.getHookCount()).toBe(4);
    });

    it('should clear all hooks', () => {
      hookManager.register('before:execution', vi.fn());
      hookManager.register('after:execution', vi.fn());
      hookManager.register('before:tool', vi.fn());

      hookManager.clear();

      expect(hookManager.getHookCount()).toBe(0);
      expect(hookManager.hasHooks('before:execution')).toBe(false);
      expect(hookManager.hasHooks('after:execution')).toBe(false);
    });
  });

  describe('Hook Execution - Sequential', () => {
    it('should execute sync hooks in order', async () => {
      const order: number[] = [];

      hookManager.register('before:execution', () => { order.push(1); return {}; });
      hookManager.register('before:execution', () => { order.push(2); return {}; });
      hookManager.register('before:execution', () => { order.push(3); return {}; });

      await hookManager.executeHooks('before:execution', {
        executionId: 'test',
        config: {} as any,
        timestamp: new Date()
      }, {});

      expect(order).toEqual([1, 2, 3]);
    });

    it('should execute async hooks in order', async () => {
      const order: number[] = [];

      hookManager.register('before:execution', async () => {
        await new Promise(r => setTimeout(r, 30));
        order.push(1);
        return {};
      });
      hookManager.register('before:execution', async () => {
        await new Promise(r => setTimeout(r, 10));
        order.push(2);
        return {};
      });
      hookManager.register('before:execution', async () => {
        order.push(3);
        return {};
      });

      await hookManager.executeHooks('before:execution', {
        executionId: 'test',
        config: {} as any,
        timestamp: new Date()
      }, {});

      // Sequential execution means order is preserved despite different delays
      expect(order).toEqual([1, 2, 3]);
    });

    it('should merge hook results', async () => {
      hookManager.register('before:llm', () => ({ modified: { temperature: 0.5 } }));
      hookManager.register('before:llm', () => ({ modified: { max_tokens: 1000 } }));

      const result = await hookManager.executeHooks('before:llm', {
        executionId: 'test',
        iteration: 0,
        options: {} as any,
        context: {} as any,
        timestamp: new Date()
      }, { modified: {} });

      // Results should be merged
      expect(result.modified).toBeDefined();
    });

    it('should stop execution when skip=true is returned', async () => {
      const secondHook = vi.fn().mockReturnValue({});

      hookManager.register('before:tool', () => ({ skip: true, reason: 'Test skip' }));
      hookManager.register('before:tool', secondHook);

      await hookManager.executeHooks('before:tool', {
        executionId: 'test',
        iteration: 0,
        toolCall: {} as any,
        context: {} as any,
        timestamp: new Date()
      }, {});

      // Second hook should not be called due to early exit
      expect(secondHook).not.toHaveBeenCalled();
    });
  });

  describe('Hook Execution - Parallel', () => {
    it('should execute hooks in parallel when configured', async () => {
      const parallelManager = new HookManager({ parallelHooks: true }, emitter);
      const order: number[] = [];

      parallelManager.register('before:execution', async () => {
        await new Promise(r => setTimeout(r, 50));
        order.push(1);
        return {};
      });
      parallelManager.register('before:execution', async () => {
        await new Promise(r => setTimeout(r, 10));
        order.push(2);
        return {};
      });
      parallelManager.register('before:execution', () => {
        order.push(3);
        return {};
      });

      await parallelManager.executeHooks('before:execution', {
        executionId: 'test',
        config: {} as any,
        timestamp: new Date()
      }, {});

      // Parallel execution: fastest completes first
      expect(order).toEqual([3, 2, 1]);
    });
  });

  describe('Hook Timeout', () => {
    it('should respect timeout for slow hooks', async () => {
      const shortTimeoutManager = new HookManager({ hookTimeout: 50 }, emitter);
      const errorSpy = vi.fn();
      emitter.on('hook:error', errorSpy);

      shortTimeoutManager.register('before:execution', async () => {
        // This hook takes too long
        await new Promise(r => setTimeout(r, 200));
        return {};
      });

      await shortTimeoutManager.executeHooks('before:execution', {
        executionId: 'test',
        config: {} as any,
        timestamp: new Date()
      }, {});

      // Error event should be emitted for timeout
      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy.mock.calls[0][0].error.message).toContain('timeout');
    });
  });

  describe('Hook Error Handling', () => {
    it('should isolate hook errors (does not crash loop)', async () => {
      const errorSpy = vi.fn();
      emitter.on('hook:error', errorSpy);

      const goodHook = vi.fn().mockReturnValue({ value: 'success' });

      hookManager.register('before:execution', () => {
        throw new Error('Hook failed!');
      });
      hookManager.register('before:execution', goodHook);

      // Should not throw
      await hookManager.executeHooks('before:execution', {
        executionId: 'test',
        config: {} as any,
        timestamp: new Date()
      }, {});

      // Good hook should still be called
      expect(goodHook).toHaveBeenCalled();
      // Error should be emitted
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should disable hook after 3 consecutive errors', async () => {
      const errorSpy = vi.fn();
      emitter.on('hook:error', errorSpy);

      const failingHook = vi.fn().mockImplementation(() => {
        throw new Error('Always fails');
      });

      hookManager.register('before:execution', failingHook);

      const context = {
        executionId: 'test',
        config: {} as any,
        timestamp: new Date()
      };

      // Execute 3 times to hit threshold
      await hookManager.executeHooks('before:execution', context, {});
      await hookManager.executeHooks('before:execution', context, {});
      await hookManager.executeHooks('before:execution', context, {});

      // Hook should be called 3 times
      expect(failingHook).toHaveBeenCalledTimes(3);

      // 4th execution - hook should be disabled
      await hookManager.executeHooks('before:execution', context, {});

      // Still only 3 calls - hook is disabled
      expect(failingHook).toHaveBeenCalledTimes(3);

      // Check disabled hooks list
      expect(hookManager.getDisabledHooks().length).toBeGreaterThan(0);
    });

    it('should reset error counter on successful execution', async () => {
      let shouldFail = true;

      const flakyHook = vi.fn().mockImplementation(() => {
        if (shouldFail) {
          throw new Error('Flaky failure');
        }
        return {};
      });

      hookManager.register('before:execution', flakyHook);

      const context = {
        executionId: 'test',
        config: {} as any,
        timestamp: new Date()
      };

      // Fail twice
      await hookManager.executeHooks('before:execution', context, {});
      await hookManager.executeHooks('before:execution', context, {});

      // Succeed once - should reset counter
      shouldFail = false;
      await hookManager.executeHooks('before:execution', context, {});

      // Fail twice more - should NOT be disabled (counter was reset)
      shouldFail = true;
      await hookManager.executeHooks('before:execution', context, {});
      await hookManager.executeHooks('before:execution', context, {});

      // Hook should still be active (5 total calls)
      expect(flakyHook).toHaveBeenCalledTimes(5);
      expect(hookManager.getDisabledHooks().length).toBe(0);
    });

    it('should handle async hook rejection', async () => {
      const errorSpy = vi.fn();
      emitter.on('hook:error', errorSpy);

      hookManager.register('before:execution', async () => {
        throw new Error('Async rejection');
      });

      await hookManager.executeHooks('before:execution', {
        executionId: 'test',
        config: {} as any,
        timestamp: new Date()
      }, {});

      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy.mock.calls[0][0].error.message).toBe('Async rejection');
    });
  });

  describe('Hook Lifecycle', () => {
    it('should pass correct context to hooks', async () => {
      const capturedContext = vi.fn();

      hookManager.register('before:execution', (ctx) => {
        capturedContext(ctx);
        return {};
      });

      const testConfig = { model: 'gpt-4', input: 'test', tools: [], maxIterations: 5 };
      const testTimestamp = new Date();

      await hookManager.executeHooks('before:execution', {
        executionId: 'exec_123',
        config: testConfig as any,
        timestamp: testTimestamp
      }, {});

      expect(capturedContext).toHaveBeenCalledWith({
        executionId: 'exec_123',
        config: testConfig,
        timestamp: testTimestamp
      });
    });

    it('should return default result when no hooks registered', async () => {
      const defaultResult = { approved: true, reason: 'default' };

      const result = await hookManager.executeHooks('approve:tool', {
        executionId: 'test',
        iteration: 0,
        toolCall: {} as any,
        context: {} as any,
        timestamp: new Date()
      }, defaultResult);

      expect(result).toEqual(defaultResult);
    });
  });

  describe('approve:tool Hook', () => {
    it('should allow tool execution when approved', async () => {
      hookManager.register('approve:tool', () => ({
        approved: true,
        reason: 'Looks safe'
      }));

      const result = await hookManager.executeHooks('approve:tool', {
        executionId: 'test',
        iteration: 0,
        toolCall: { id: 't1', type: 'function', function: { name: 'test_tool', arguments: '{}' } } as any,
        context: {} as any,
        timestamp: new Date()
      }, { approved: true });

      expect(result.approved).toBe(true);
    });

    it('should reject tool execution when not approved', async () => {
      hookManager.register('approve:tool', () => ({
        approved: false,
        reason: 'Dangerous tool detected'
      }));

      const result = await hookManager.executeHooks('approve:tool', {
        executionId: 'test',
        iteration: 0,
        toolCall: { id: 't1', type: 'function', function: { name: 'rm_rf', arguments: '{"path": "/"}' } } as any,
        context: {} as any,
        timestamp: new Date()
      }, { approved: true });

      expect(result.approved).toBe(false);
      expect(result.reason).toBe('Dangerous tool detected');
    });
  });

  describe('pause:check Hook', () => {
    it('should trigger pause when hook returns shouldPause=true', async () => {
      hookManager.register('pause:check', () => ({
        shouldPause: true,
        reason: 'Rate limit approaching'
      }));

      const result = await hookManager.executeHooks('pause:check', {
        executionId: 'test',
        iteration: 5,
        context: {} as any,
        timestamp: new Date()
      }, { shouldPause: false });

      expect(result.shouldPause).toBe(true);
      expect(result.reason).toBe('Rate limit approaching');
    });

    it('should continue execution when hook returns shouldPause=false', async () => {
      hookManager.register('pause:check', () => ({
        shouldPause: false
      }));

      const result = await hookManager.executeHooks('pause:check', {
        executionId: 'test',
        iteration: 5,
        context: {} as any,
        timestamp: new Date()
      }, { shouldPause: false });

      expect(result.shouldPause).toBe(false);
    });
  });

  describe('Hook Re-enabling', () => {
    it('should re-enable a disabled hook', async () => {
      const failingHook = vi.fn().mockImplementation(() => {
        throw new Error('Always fails');
      });

      hookManager.register('before:execution', failingHook);

      const context = {
        executionId: 'test',
        config: {} as any,
        timestamp: new Date()
      };

      // Disable the hook by failing 3 times
      await hookManager.executeHooks('before:execution', context, {});
      await hookManager.executeHooks('before:execution', context, {});
      await hookManager.executeHooks('before:execution', context, {});

      expect(hookManager.getDisabledHooks().length).toBe(1);

      // Re-enable
      const disabledKey = hookManager.getDisabledHooks()[0];
      hookManager.enableHook(disabledKey);

      expect(hookManager.getDisabledHooks().length).toBe(0);

      // Hook should be called again
      await hookManager.executeHooks('before:execution', context, {});
      expect(failingHook).toHaveBeenCalledTimes(4);
    });
  });

  describe('Config-based Registration', () => {
    it('should register hooks from config', () => {
      const config: HookConfig = {
        'before:execution': vi.fn(),
        'after:execution': vi.fn(),
        'before:tool': vi.fn()
      };

      const configManager = new HookManager(config, emitter);

      expect(configManager.hasHooks('before:execution')).toBe(true);
      expect(configManager.hasHooks('after:execution')).toBe(true);
      expect(configManager.hasHooks('before:tool')).toBe(true);
      expect(configManager.hasHooks('approve:tool')).toBe(false);
    });

    it('should use custom maxConsecutiveErrors', async () => {
      const errorSpy = vi.fn();
      emitter.on('hook:error', errorSpy);

      // Only allow 1 consecutive error
      const strictManager = new HookManager({}, emitter, { maxConsecutiveErrors: 1 });

      const failingHook = vi.fn().mockImplementation(() => {
        throw new Error('Fails');
      });

      strictManager.register('before:execution', failingHook);

      const context = {
        executionId: 'test',
        config: {} as any,
        timestamp: new Date()
      };

      // First call - fails, hook should be disabled after 1 error
      await strictManager.executeHooks('before:execution', context, {});

      // Second call - hook should be disabled
      await strictManager.executeHooks('before:execution', context, {});

      // Only called once before being disabled
      expect(failingHook).toHaveBeenCalledTimes(1);
    });
  });
});
