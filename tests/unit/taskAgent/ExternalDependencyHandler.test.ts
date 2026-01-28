/**
 * ExternalDependencyHandler Tests
 * Tests for handling external task dependencies (webhooks, polling, scheduling)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExternalDependencyHandler } from '@/capabilities/taskAgent/ExternalDependencyHandler.js';
import { createTask } from '@/domain/entities/Task.js';
import { ToolFunction } from '@/domain/entities/Tool.js';

describe('ExternalDependencyHandler', () => {
  let handler: ExternalDependencyHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (handler) {
      handler.cleanup();
    }
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance without tools', () => {
      handler = new ExternalDependencyHandler();
      expect(handler).toBeDefined();
    });

    it('should create instance with tools', () => {
      const mockTool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'test_tool',
            description: 'Test tool',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: vi.fn(),
      };

      handler = new ExternalDependencyHandler([mockTool]);
      expect(handler).toBeDefined();
    });
  });

  describe('webhook dependencies', () => {
    it('should handle webhook dependency', async () => {
      handler = new ExternalDependencyHandler();

      const task = createTask({
        name: 'Webhook Task',
        description: 'Waits for webhook',
        dependsOn: [],
        externalDependency: {
          type: 'webhook',
          webhookUrl: '/webhook/test',
        },
      });

      await expect(handler.startWaiting(task)).resolves.not.toThrow();
    });

    it('should emit event when webhook is triggered', async () => {
      handler = new ExternalDependencyHandler();

      const webhookSpy = vi.fn();
      handler.on('webhook:received', webhookSpy);

      await handler.triggerWebhook('test-webhook', { foo: 'bar' });

      expect(webhookSpy).toHaveBeenCalledWith({
        webhookId: 'test-webhook',
        data: { foo: 'bar' },
      });
    });

    it('should handle multiple webhook triggers', async () => {
      handler = new ExternalDependencyHandler();

      const webhookSpy = vi.fn();
      handler.on('webhook:received', webhookSpy);

      await handler.triggerWebhook('webhook1', { data: 1 });
      await handler.triggerWebhook('webhook2', { data: 2 });
      await handler.triggerWebhook('webhook3', { data: 3 });

      expect(webhookSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('manual dependencies', () => {
    it('should handle manual dependency', async () => {
      handler = new ExternalDependencyHandler();

      const task = createTask({
        name: 'Manual Task',
        description: 'Needs manual completion',
        dependsOn: [],
        externalDependency: {
          type: 'manual',
        },
      });

      await expect(handler.startWaiting(task)).resolves.not.toThrow();
    });

    it('should emit event when manually completed', async () => {
      handler = new ExternalDependencyHandler();

      const manualSpy = vi.fn();
      handler.on('manual:completed', manualSpy);

      await handler.completeManual('task-123', { result: 'done' });

      expect(manualSpy).toHaveBeenCalledWith({
        taskId: 'task-123',
        data: { result: 'done' },
      });
    });

    it('should handle multiple manual completions', async () => {
      handler = new ExternalDependencyHandler();

      const manualSpy = vi.fn();
      handler.on('manual:completed', manualSpy);

      await handler.completeManual('task-1', { result: 1 });
      await handler.completeManual('task-2', { result: 2 });

      expect(manualSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('poll dependencies', () => {
    it('should start polling when task has poll dependency', async () => {
      const mockTool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'check_status',
            description: 'Check status',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: vi.fn().mockResolvedValue(null), // Not ready yet
      };

      handler = new ExternalDependencyHandler([mockTool]);

      const task = createTask({
        name: 'Poll Task',
        description: 'Polls for completion',
        dependsOn: [],
        externalDependency: {
          type: 'poll',
          pollConfig: {
            toolName: 'check_status',
            toolArgs: {},
            intervalMs: 1000,
            maxAttempts: 5,
          },
        },
      });

      await handler.startWaiting(task);

      // Initial poll should happen immediately
      expect(mockTool.execute).toHaveBeenCalledTimes(1);
    });

    it('should emit success when poll returns truthy result', async () => {
      const mockTool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'check_status',
            description: 'Check status',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: vi.fn()
          .mockResolvedValueOnce(null) // First poll - not ready
          .mockResolvedValueOnce({ status: 'complete' }), // Second poll - ready
      };

      handler = new ExternalDependencyHandler([mockTool]);

      const successSpy = vi.fn();
      handler.on('poll:success', successSpy);

      const task = createTask({
        id: 'poll-task-1',
        name: 'Poll Task',
        description: 'Polls for completion',
        dependsOn: [],
        externalDependency: {
          type: 'poll',
          pollConfig: {
            toolName: 'check_status',
            toolArgs: {},
            intervalMs: 1000,
            maxAttempts: 5,
          },
        },
      });

      await handler.startWaiting(task);

      // With async polling loop, we need to advance timers and flush promises multiple times
      // to let the async code execute between timer ticks
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(500);

      expect(successSpy).toHaveBeenCalledWith({
        taskId: 'poll-task-1',
        data: { status: 'complete' },
      });
    });

    it('should emit timeout when max attempts reached', async () => {
      const mockTool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'check_status',
            description: 'Check status',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: vi.fn().mockResolvedValue(null), // Always not ready
      };

      handler = new ExternalDependencyHandler([mockTool]);

      const timeoutSpy = vi.fn();
      handler.on('poll:timeout', timeoutSpy);

      const task = createTask({
        id: 'poll-task-2',
        name: 'Poll Task',
        description: 'Will timeout',
        dependsOn: [],
        externalDependency: {
          type: 'poll',
          pollConfig: {
            toolName: 'check_status',
            toolArgs: {},
            intervalMs: 100,
            maxAttempts: 3,
          },
        },
      });

      await handler.startWaiting(task);

      // With exponential backoff: 100ms, 200ms, 400ms (capped at 400)
      // Total for 3 attempts: 100+200 = 300ms of waiting after first 2 attempts
      // Need to advance enough time for all attempts plus processing
      // Use runAllTimersAsync to let all async operations complete
      await vi.runAllTimersAsync();

      expect(timeoutSpy).toHaveBeenCalledWith({ taskId: 'poll-task-2' });
    });

    it('should stop polling after success', async () => {
      const mockTool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'check_status',
            description: 'Check status',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: vi.fn().mockResolvedValue({ status: 'done' }),
      };

      handler = new ExternalDependencyHandler([mockTool]);

      const task = createTask({
        id: 'poll-task-3',
        name: 'Poll Task',
        description: 'Completes immediately',
        dependsOn: [],
        externalDependency: {
          type: 'poll',
          pollConfig: {
            toolName: 'check_status',
            toolArgs: {},
            intervalMs: 1000,
            maxAttempts: 10,
          },
        },
      });

      await handler.startWaiting(task);

      // First poll succeeds
      expect(mockTool.execute).toHaveBeenCalledTimes(1);

      // Advance time - should not poll again
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockTool.execute).toHaveBeenCalledTimes(1);
    });

    it('should handle missing poll tool gracefully', async () => {
      handler = new ExternalDependencyHandler([]);

      const task = createTask({
        name: 'Poll Task',
        description: 'Tool not found',
        dependsOn: [],
        externalDependency: {
          type: 'poll',
          pollConfig: {
            toolName: 'missing_tool',
            toolArgs: {},
            intervalMs: 1000,
            maxAttempts: 3,
          },
        },
      });

      // Should not throw
      await expect(handler.startWaiting(task)).resolves.not.toThrow();
    });

    it('should pass tool args to poll tool', async () => {
      const mockTool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'check_status',
            description: 'Check status',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: vi.fn().mockResolvedValue({ status: 'done' }),
      };

      handler = new ExternalDependencyHandler([mockTool]);

      const task = createTask({
        name: 'Poll Task',
        description: 'With args',
        dependsOn: [],
        externalDependency: {
          type: 'poll',
          pollConfig: {
            toolName: 'check_status',
            toolArgs: { jobId: '12345', checkDetail: true },
            intervalMs: 1000,
            maxAttempts: 3,
          },
        },
      });

      await handler.startWaiting(task);

      expect(mockTool.execute).toHaveBeenCalledWith({
        jobId: '12345',
        checkDetail: true,
      });
    });
  });

  describe('scheduled dependencies', () => {
    it('should trigger scheduled task at correct time', async () => {
      handler = new ExternalDependencyHandler();

      const scheduledSpy = vi.fn();
      handler.on('scheduled:triggered', scheduledSpy);

      const futureTime = Date.now() + 5000;

      const task = createTask({
        id: 'scheduled-task-1',
        name: 'Scheduled Task',
        description: 'Scheduled in future',
        dependsOn: [],
        externalDependency: {
          type: 'scheduled',
          scheduledAt: futureTime,
        },
      });

      await handler.startWaiting(task);

      // Not triggered yet
      expect(scheduledSpy).not.toHaveBeenCalled();

      // Advance time to trigger
      await vi.advanceTimersByTimeAsync(5000);

      expect(scheduledSpy).toHaveBeenCalledWith({ taskId: 'scheduled-task-1' });
    });

    it('should trigger immediately if scheduled time is in past', async () => {
      handler = new ExternalDependencyHandler();

      const scheduledSpy = vi.fn();
      handler.on('scheduled:triggered', scheduledSpy);

      const pastTime = Date.now() - 5000;

      const task = createTask({
        id: 'scheduled-task-2',
        name: 'Scheduled Task',
        description: 'Already past',
        dependsOn: [],
        externalDependency: {
          type: 'scheduled',
          scheduledAt: pastTime,
        },
      });

      await handler.startWaiting(task);

      // Should trigger immediately
      expect(scheduledSpy).toHaveBeenCalledWith({ taskId: 'scheduled-task-2' });
    });

    it('should handle multiple scheduled tasks', async () => {
      handler = new ExternalDependencyHandler();

      const scheduledSpy = vi.fn();
      handler.on('scheduled:triggered', scheduledSpy);

      const task1 = createTask({
        id: 'scheduled-1',
        name: 'Task 1',
        description: 'First',
        dependsOn: [],
        externalDependency: {
          type: 'scheduled',
          scheduledAt: Date.now() + 1000,
        },
      });

      const task2 = createTask({
        id: 'scheduled-2',
        name: 'Task 2',
        description: 'Second',
        dependsOn: [],
        externalDependency: {
          type: 'scheduled',
          scheduledAt: Date.now() + 2000,
        },
      });

      await handler.startWaiting(task1);
      await handler.startWaiting(task2);

      await vi.advanceTimersByTimeAsync(1000);
      expect(scheduledSpy).toHaveBeenCalledTimes(1);
      expect(scheduledSpy).toHaveBeenCalledWith({ taskId: 'scheduled-1' });

      await vi.advanceTimersByTimeAsync(1000);
      expect(scheduledSpy).toHaveBeenCalledTimes(2);
      expect(scheduledSpy).toHaveBeenCalledWith({ taskId: 'scheduled-2' });
    });
  });

  describe('stopWaiting', () => {
    it('should stop polling', async () => {
      const mockTool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'check_status',
            description: 'Check status',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: vi.fn().mockResolvedValue(null),
      };

      handler = new ExternalDependencyHandler([mockTool]);

      const task = createTask({
        id: 'poll-task',
        name: 'Poll Task',
        description: 'Will be stopped',
        dependsOn: [],
        externalDependency: {
          type: 'poll',
          pollConfig: {
            toolName: 'check_status',
            toolArgs: {},
            intervalMs: 1000,
            maxAttempts: 10,
          },
        },
      });

      await handler.startWaiting(task);
      expect(mockTool.execute).toHaveBeenCalledTimes(1);

      // Stop immediately after first poll
      handler.stopWaiting(task);

      // With the async loop, stopWaiting clears the timer which causes the loop to exit
      // Let any pending timers complete
      await vi.runAllTimersAsync();

      // Should not have reached maxAttempts (10)
      expect(mockTool.execute.mock.calls.length).toBeLessThan(10);
    });

    it('should stop scheduled task', async () => {
      handler = new ExternalDependencyHandler();

      const scheduledSpy = vi.fn();
      handler.on('scheduled:triggered', scheduledSpy);

      const task = createTask({
        id: 'scheduled-task',
        name: 'Scheduled Task',
        description: 'Will be stopped',
        dependsOn: [],
        externalDependency: {
          type: 'scheduled',
          scheduledAt: Date.now() + 5000,
        },
      });

      await handler.startWaiting(task);
      handler.stopWaiting(task);

      // Advance time - should not trigger
      await vi.advanceTimersByTimeAsync(5000);
      expect(scheduledSpy).not.toHaveBeenCalled();
    });

    it('should be safe to call on task without dependency', () => {
      handler = new ExternalDependencyHandler();

      const task = createTask({
        name: 'Normal Task',
        description: 'No dependency',
        dependsOn: [],
      });

      expect(() => handler.stopWaiting(task)).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should clear all polling timers', async () => {
      const mockTool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'check_status',
            description: 'Check status',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: vi.fn().mockResolvedValue(null),
      };

      handler = new ExternalDependencyHandler([mockTool]);

      const task = createTask({
        name: 'Poll Task',
        description: 'Will be cleaned up',
        dependsOn: [],
        externalDependency: {
          type: 'poll',
          pollConfig: {
            toolName: 'check_status',
            toolArgs: {},
            intervalMs: 1000,
            maxAttempts: 10,
          },
        },
      });

      await handler.startWaiting(task);

      // Let first poll complete, then call cleanup
      // The first poll happens immediately, so advance a bit and let promises settle
      await vi.advanceTimersByTimeAsync(100);

      handler.cleanup();

      // Let any pending timers run to completion
      await vi.runAllTimersAsync();

      // Should not have reached maxAttempts (10)
      // First poll happens immediately, cleanup cancels before more can happen
      expect(mockTool.execute.mock.calls.length).toBeLessThan(10);
    });

    it('should clear all scheduled timers', async () => {
      handler = new ExternalDependencyHandler();

      const scheduledSpy = vi.fn();
      handler.on('scheduled:triggered', scheduledSpy);

      const task = createTask({
        name: 'Scheduled Task',
        description: 'Will be cleaned up',
        dependsOn: [],
        externalDependency: {
          type: 'scheduled',
          scheduledAt: Date.now() + 5000,
        },
      });

      await handler.startWaiting(task);

      handler.cleanup();

      await vi.advanceTimersByTimeAsync(5000);
      expect(scheduledSpy).not.toHaveBeenCalled();
    });

    it('should be safe to call multiple times', () => {
      handler = new ExternalDependencyHandler();

      handler.cleanup();
      expect(() => handler.cleanup()).not.toThrow();
    });
  });

  describe('updateTools', () => {
    it('should update available tools', () => {
      handler = new ExternalDependencyHandler();

      const newTool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'new_tool',
            description: 'New tool',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: vi.fn(),
      };

      expect(() => handler.updateTools([newTool])).not.toThrow();
    });

    it('should replace existing tools', async () => {
      const tool1: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'tool1',
            description: 'Tool 1',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: vi.fn().mockResolvedValue({ data: 'tool1' }),
      };

      const tool2: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'tool2',
            description: 'Tool 2',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: vi.fn().mockResolvedValue({ data: 'tool2' }),
      };

      handler = new ExternalDependencyHandler([tool1]);

      const task = createTask({
        name: 'Poll Task',
        description: 'Uses tool1',
        dependsOn: [],
        externalDependency: {
          type: 'poll',
          pollConfig: {
            toolName: 'tool1',
            toolArgs: {},
            intervalMs: 1000,
            maxAttempts: 1,
          },
        },
      });

      await handler.startWaiting(task);
      expect(tool1.execute).toHaveBeenCalled();

      // Update to tool2
      handler.updateTools([tool2]);

      // New task should use tool2
      const task2 = createTask({
        name: 'Poll Task 2',
        description: 'Uses tool2',
        dependsOn: [],
        externalDependency: {
          type: 'poll',
          pollConfig: {
            toolName: 'tool2',
            toolArgs: {},
            intervalMs: 1000,
            maxAttempts: 1,
          },
        },
      });

      await handler.startWaiting(task2);
      expect(tool2.execute).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle task without external dependency', async () => {
      handler = new ExternalDependencyHandler();

      const task = createTask({
        name: 'Normal Task',
        description: 'No dependency',
        dependsOn: [],
      });

      await expect(handler.startWaiting(task)).resolves.not.toThrow();
    });

    it('should handle poll tool execution errors', async () => {
      const mockTool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'check_status',
            description: 'Check status',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: vi.fn().mockRejectedValue(new Error('Tool error')),
      };

      handler = new ExternalDependencyHandler([mockTool]);

      const task = createTask({
        name: 'Poll Task',
        description: 'Tool will error',
        dependsOn: [],
        externalDependency: {
          type: 'poll',
          pollConfig: {
            toolName: 'check_status',
            toolArgs: {},
            intervalMs: 1000,
            maxAttempts: 3,
          },
        },
      });

      // Should not throw
      await expect(handler.startWaiting(task)).resolves.not.toThrow();

      // First attempt happens immediately (1 call so far)
      expect(mockTool.execute).toHaveBeenCalledTimes(1);

      // Should continue polling despite errors (with exponential backoff)
      // After first failure, wait ~1000ms for second attempt
      await vi.advanceTimersByTimeAsync(1500); // Allow for jitter
      expect(mockTool.execute.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle concurrent poll and scheduled tasks', async () => {
      const mockTool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'check_status',
            description: 'Check status',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: vi.fn().mockResolvedValue(null),
      };

      handler = new ExternalDependencyHandler([mockTool]);

      const pollTask = createTask({
        id: 'poll-task',
        name: 'Poll Task',
        description: 'Polling',
        dependsOn: [],
        externalDependency: {
          type: 'poll',
          pollConfig: {
            toolName: 'check_status',
            toolArgs: {},
            intervalMs: 500, // Shorter interval for more polls in test window
            maxAttempts: 10,
          },
        },
      });

      const scheduledTask = createTask({
        id: 'scheduled-task',
        name: 'Scheduled Task',
        description: 'Scheduled',
        dependsOn: [],
        externalDependency: {
          type: 'scheduled',
          scheduledAt: Date.now() + 2000,
        },
      });

      await handler.startWaiting(pollTask);
      await handler.startWaiting(scheduledTask);

      const scheduledSpy = vi.fn();
      handler.on('scheduled:triggered', scheduledSpy);

      await vi.advanceTimersByTimeAsync(2500);

      // With exponential backoff (starting at 500ms, max 2000ms), we should have at least 2 polls
      // Attempt 1: immediate
      // Attempt 2: after ~500ms
      // Attempt 3: after ~1000ms (total ~1500ms)
      expect(mockTool.execute.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(scheduledSpy).toHaveBeenCalled();
    });
  });
});
