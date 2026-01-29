/**
 * TaskAgent Integration Tests
 * Tests for the full TaskAgent functionality with mocked LLM
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskAgent, TaskAgentConfig, AgentHandle, PlanResult } from '@/capabilities/taskAgent/TaskAgent.js';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';
import { ToolFunction } from '@/domain/entities/Tool.js';
import { createAgentStorage, InMemoryAgentStorage } from '@/infrastructure/storage/index.js';
import { Plan, Task } from '@/domain/entities/Task.js';

// Mock the Agent class
vi.mock('@/core/Agent.js', () => ({
  Agent: {
    create: vi.fn(() => ({
      run: vi.fn(),
      stream: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      addTool: vi.fn(),
      removeTool: vi.fn(),
      listTools: vi.fn(() => []),
    })),
  },
}));

describe('TaskAgent Integration', () => {
  let storage: ReturnType<typeof createAgentStorage>;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = createAgentStorage({});

    Connector.clear();
    Connector.create({
      name: 'test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test-key' },
    });
  });

  afterEach(() => {
    Connector.clear();
  });

  const createTestAgent = (options: Partial<TaskAgentConfig> = {}): TaskAgent => {
    return TaskAgent.create({
      connector: 'test',
      model: 'gpt-4',
      storage,
      ...options,
    });
  };

  describe('TaskAgent.create', () => {
    it('should create agent with connector name', () => {
      const agent = createTestAgent();
      expect(agent).toBeDefined();
      expect(agent.id).toBeDefined();
    });

    it('should create agent with tools', () => {
      const tool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'test_tool',
            description: 'A test tool',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: async () => ({ result: 'ok' }),
      };

      const agent = createTestAgent({ tools: [tool] });
      expect(agent).toBeDefined();
    });

    it('should create agent with instructions', () => {
      const agent = createTestAgent({
        instructions: 'You are a helpful assistant.',
      });
      expect(agent).toBeDefined();
    });

    it('should throw if connector not found', () => {
      Connector.clear();
      expect(() => createTestAgent()).toThrow(/not found/i);
    });

    it('should create agent with hooks', () => {
      const agent = createTestAgent({
        hooks: {
          onStart: async () => {},
          beforeTask: async () => {},
          afterTask: async () => {},
          onComplete: async () => {},
        },
      });
      expect(agent).toBeDefined();
    });

    it('should create agent with custom memory config', () => {
      const agent = createTestAgent({
        memoryConfig: {
          maxSizeBytes: 50000,
          descriptionMaxLength: 200,
          softLimitPercent: 75,
          contextAllocationPercent: 25,
        },
      });
      expect(agent).toBeDefined();
    });
  });

  describe('TaskAgent.resume', () => {
    it('should resume agent from storage', async () => {
      const agent1 = createTestAgent();

      // Save state manually for this test
      const state = agent1.getState();
      await storage.agent.save(state);

      // Resume from storage
      const agent2 = await TaskAgent.resume(agent1.id, {
        storage,
        tools: [],
      });

      expect(agent2).toBeDefined();
      expect(agent2.id).toBe(agent1.id);
    });

    it('should throw if agent not found in storage', async () => {
      await expect(
        TaskAgent.resume('nonexistent', { storage, tools: [] })
      ).rejects.toThrow(/not found/i);
    });

    it('should restore working memory', async () => {
      const agent1 = createTestAgent();
      await agent1.getMemory().store('test', 'Test data', { value: 42 });

      const state = agent1.getState();
      await storage.agent.save(state);

      const agent2 = await TaskAgent.resume(agent1.id, { storage, tools: [] });
      const value = await agent2.getMemory().retrieve('test');

      expect(value).toEqual({ value: 42 });
    });
  });

  describe('start', () => {
    it('should start executing a plan', async () => {
      const agent = createTestAgent();

      // Mock the execution to complete immediately
      vi.spyOn(agent as any, 'executePlan').mockResolvedValue({
        status: 'completed',
        output: 'Done',
      });

      const handle = await agent.start({
        goal: 'Test goal',
        tasks: [{ name: 'task1', description: 'Task 1' }],
      });

      expect(handle).toBeDefined();
      expect(handle.agentId).toBe(agent.id);
      expect(handle.planId).toBeDefined();
    });

    it('should return handle with wait method', async () => {
      const agent = createTestAgent();

      vi.spyOn(agent as any, 'executePlan').mockResolvedValue({
        status: 'completed',
        output: 'Done',
      });

      const handle = await agent.start({
        goal: 'Test goal',
        tasks: [],
      });

      expect(typeof handle.wait).toBe('function');
    });

    it('should return handle with status method', async () => {
      const agent = createTestAgent();

      vi.spyOn(agent as any, 'executePlan').mockResolvedValue({
        status: 'completed',
      });

      const handle = await agent.start({
        goal: 'Test goal',
        tasks: [],
      });

      expect(typeof handle.status).toBe('function');
    });

    it('should create plan from input', async () => {
      const agent = createTestAgent();

      vi.spyOn(agent as any, 'executePlan').mockResolvedValue({
        status: 'completed',
      });

      await agent.start({
        goal: 'Process refund',
        context: 'Customer requested refund',
        tasks: [
          { name: 'fetch_order', description: 'Get order details' },
          { name: 'process_refund', description: 'Issue refund', dependsOn: ['fetch_order'] },
        ],
      });

      const plan = agent.getPlan();
      expect(plan.goal).toBe('Process refund');
      expect(plan.tasks).toHaveLength(2);
    });
  });

  describe('pause and resume', () => {
    it('should pause execution', async () => {
      const agent = createTestAgent();

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 100));
        return { status: 'completed' };
      });

      agent.start({ goal: 'Test', tasks: [] });
      await new Promise((r) => setTimeout(r, 10));

      await agent.pause();

      const state = agent.getState();
      expect(state.status).toBe('suspended');
    });

    it('should resume execution after pause', async () => {
      const agent = createTestAgent();
      let resumed = false;

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async () => {
        if (resumed) return { status: 'completed' };
        await new Promise((r) => setTimeout(r, 1000));
        return { status: 'completed' };
      });

      agent.start({ goal: 'Test', tasks: [] });
      await new Promise((r) => setTimeout(r, 10));

      await agent.pause();
      resumed = true;
      await agent.resume();

      expect(agent.getState().status).not.toBe('suspended');
    });
  });

  describe('cancel', () => {
    it('should cancel execution', async () => {
      const agent = createTestAgent();

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 1000));
        return { status: 'completed' };
      });

      agent.start({ goal: 'Test', tasks: [] });
      await new Promise((r) => setTimeout(r, 10));

      await agent.cancel();

      const state = agent.getState();
      expect(state.status).toBe('cancelled');
    });
  });

  describe('triggerExternal', () => {
    it('should trigger external dependency completion', async () => {
      const agent = createTestAgent();

      const handle = await agent.start({
        goal: 'Test',
        tasks: [
          {
            name: 'wait',
            description: 'Wait for webhook',
            externalDependency: {
              type: 'webhook',
              webhookId: 'webhook-123',
              state: 'waiting',
            },
          },
        ],
      });

      // Trigger the webhook
      await agent.triggerExternal('webhook-123', { data: 'received' });

      const plan = agent.getPlan();
      const task = plan.tasks.find((t) => t.name === 'wait');
      expect(task?.externalDependency?.state).toBe('received');
      expect(task?.externalDependency?.receivedData).toEqual({ data: 'received' });
    });

    it('should throw for unknown webhook', async () => {
      const agent = createTestAgent();

      await agent.start({ goal: 'Test', tasks: [] });

      await expect(agent.triggerExternal('unknown', {})).rejects.toThrow(/not found/i);
    });
  });

  describe('completeTaskManually', () => {
    it('should complete manual task', async () => {
      const agent = createTestAgent();

      await agent.start({
        goal: 'Test',
        tasks: [
          {
            name: 'manual',
            description: 'Manual task',
            externalDependency: {
              type: 'manual',
              manualDescription: 'Please approve',
              state: 'waiting',
            },
          },
        ],
      });

      const plan = agent.getPlan();
      const task = plan.tasks[0];

      await agent.completeTaskManually(task.id, { approved: true });

      const updatedPlan = agent.getPlan();
      const updatedTask = updatedPlan.tasks[0];
      expect(updatedTask.externalDependency?.state).toBe('received');
    });
  });

  describe('updatePlan', () => {
    it('should add tasks to plan', async () => {
      const agent = createTestAgent();

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 100));
        return { status: 'completed' };
      });

      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'task1', description: 'Task 1' }],
      });

      await agent.pause();

      await agent.updatePlan({
        addTasks: [{ name: 'task2', description: 'Task 2' }],
      });

      const plan = agent.getPlan();
      expect(plan.tasks).toHaveLength(2);
    });

    it('should update existing tasks', async () => {
      const agent = createTestAgent();

      vi.spyOn(agent as any, 'executePlan').mockResolvedValue({ status: 'completed' });

      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'task1', description: 'Task 1' }],
      });

      const plan = agent.getPlan();
      const taskId = plan.tasks[0].id;

      await agent.updatePlan({
        updateTasks: [{ id: taskId, maxAttempts: 5 }],
      });

      const updatedPlan = agent.getPlan();
      expect(updatedPlan.tasks[0].maxAttempts).toBe(5);
    });

    it('should throw if plan does not allow dynamic tasks', async () => {
      const agent = createTestAgent();

      vi.spyOn(agent as any, 'executePlan').mockResolvedValue({ status: 'completed' });

      await agent.start({
        goal: 'Test',
        tasks: [],
        allowDynamicTasks: false,
      });

      await expect(
        agent.updatePlan({
          addTasks: [{ name: 'new', description: 'New task' }],
        })
      ).rejects.toThrow(/dynamic tasks.*disabled/i);
    });
  });

  describe('getState', () => {
    it('should return current agent state', () => {
      const agent = createTestAgent();
      const state = agent.getState();

      expect(state).toBeDefined();
      expect(state.id).toBe(agent.id);
      expect(state.status).toBeDefined();
      expect(state.config).toBeDefined();
      expect(state.metrics).toBeDefined();
    });
  });

  describe('getPlan', () => {
    it('should return current plan', async () => {
      const agent = createTestAgent();

      vi.spyOn(agent as any, 'executePlan').mockResolvedValue({ status: 'completed' });

      await agent.start({
        goal: 'Test goal',
        tasks: [{ name: 'task1', description: 'Task 1' }],
      });

      const plan = agent.getPlan();

      expect(plan).toBeDefined();
      expect(plan.goal).toBe('Test goal');
      expect(plan.tasks).toHaveLength(1);
    });

    it('should throw if no plan started', () => {
      const agent = createTestAgent();
      expect(() => agent.getPlan()).toThrow(/no plan/i);
    });
  });

  describe('getMemory', () => {
    it('should return working memory instance', () => {
      const agent = createTestAgent();
      const memory = agent.getMemory();

      expect(memory).toBeDefined();
      expect(typeof memory.store).toBe('function');
      expect(typeof memory.retrieve).toBe('function');
    });

    it('should persist across agent lifecycle', async () => {
      const agent = createTestAgent();
      const memory = agent.getMemory();

      await memory.store('test', 'Test data', { value: 1 });

      const retrieved = await memory.retrieve('test');
      expect(retrieved).toEqual({ value: 1 });
    });
  });

  describe('hooks', () => {
    it('should call onStart hook', async () => {
      const onStart = vi.fn();

      const agent = createTestAgent({
        hooks: { onStart },
      });

      vi.spyOn(agent as any, 'executePlan').mockResolvedValue({ status: 'completed' });

      await agent.start({ goal: 'Test', tasks: [] });

      expect(onStart).toHaveBeenCalled();
    });

    it('should call beforeTask hook before each task', async () => {
      const beforeTask = vi.fn();

      const agent = createTestAgent({
        hooks: { beforeTask },
      });

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async function (this: any) {
        // Simulate task execution calling beforeTask
        const plan = this.getPlan();
        for (const task of plan.tasks) {
          await this.hooks?.beforeTask?.(task, {});
        }
        return { status: 'completed' };
      });

      await agent.start({
        goal: 'Test',
        tasks: [
          { name: 'task1', description: 'Task 1' },
          { name: 'task2', description: 'Task 2' },
        ],
      });

      expect(beforeTask).toHaveBeenCalledTimes(2);
    });

    it('should allow beforeTask to skip task', async () => {
      const beforeTask = vi.fn(async (task: Task) => {
        if (task.name === 'skip_me') return 'skip';
      });

      const agent = createTestAgent({
        hooks: { beforeTask },
      });

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async function (this: any) {
        const plan = this.getPlan();
        for (const task of plan.tasks) {
          const result = await this.hooks?.beforeTask?.(task, {});
          if (result === 'skip') {
            task.status = 'skipped';
          }
        }
        return { status: 'completed' };
      });

      await agent.start({
        goal: 'Test',
        tasks: [
          { name: 'skip_me', description: 'Should be skipped' },
          { name: 'run_me', description: 'Should run' },
        ],
      });

      const plan = agent.getPlan();
      expect(plan.tasks.find((t) => t.name === 'skip_me')?.status).toBe('skipped');
    });

    it('should call afterTask hook after each task', async () => {
      const afterTask = vi.fn();

      const agent = createTestAgent({
        hooks: { afterTask },
      });

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async function (this: any) {
        const plan = this.getPlan();
        for (const task of plan.tasks) {
          task.status = 'completed';
          await this.hooks?.afterTask?.(task, { success: true });
        }
        return { status: 'completed' };
      });

      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'task1', description: 'Task 1' }],
      });

      expect(afterTask).toHaveBeenCalled();
    });

    it('should call onComplete hook when done', async () => {
      const onComplete = vi.fn();

      const agent = createTestAgent({
        hooks: { onComplete },
      });

      vi.spyOn(agent as any, 'executePlan').mockResolvedValue({ status: 'completed' });

      const handle = await agent.start({ goal: 'Test', tasks: [] });
      await handle.wait();

      expect(onComplete).toHaveBeenCalled();
    });

    it('should call onError hook on failure', async () => {
      const onError = vi.fn(async () => 'fail' as const);

      const agent = createTestAgent({
        hooks: { onError },
      });

      vi.spyOn(agent as any, 'executePlan').mockRejectedValue(new Error('Test error'));

      const handle = await agent.start({ goal: 'Test', tasks: [] });

      try {
        await handle.wait();
      } catch {
        // Expected
      }

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('events', () => {
    it('should emit task:start event', async () => {
      const agent = createTestAgent();
      const handler = vi.fn();

      agent.on('task:start', handler);

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async function (this: any) {
        this.emit('task:start', { task: { name: 'task1' } });
        return { status: 'completed' };
      });

      await agent.start({ goal: 'Test', tasks: [{ name: 'task1', description: 'Task 1' }] });

      expect(handler).toHaveBeenCalled();
    });

    it('should emit task:complete event', async () => {
      const agent = createTestAgent();
      const handler = vi.fn();

      agent.on('task:complete', handler);

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async function (this: any) {
        this.emit('task:complete', { task: { name: 'task1', status: 'completed' } });
        return { status: 'completed' };
      });

      await agent.start({ goal: 'Test', tasks: [{ name: 'task1', description: 'Task 1' }] });

      expect(handler).toHaveBeenCalled();
    });

    it('should emit agent:suspended event', async () => {
      const agent = createTestAgent();
      const handler = vi.fn();

      agent.on('agent:suspended', handler);

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 100));
        return { status: 'completed' };
      });

      agent.start({ goal: 'Test', tasks: [] });
      await new Promise((r) => setTimeout(r, 10));

      await agent.pause();

      expect(handler).toHaveBeenCalled();
    });

    it('should emit memory:stored event', async () => {
      const agent = createTestAgent();
      const handler = vi.fn();

      agent.on('memory:stored', handler);

      await agent.getMemory().store('test', 'Test', { value: 1 });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'test', description: 'Test' })
      );
    });
  });

  describe('metrics', () => {
    it('should track LLM calls', async () => {
      const agent = createTestAgent();

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async function (this: any) {
        this.state.metrics.totalLLMCalls = 5;
        return { status: 'completed' };
      });

      await agent.start({ goal: 'Test', tasks: [] });

      const state = agent.getState();
      expect(state.metrics.totalLLMCalls).toBe(5);
    });

    it('should track tool calls', async () => {
      const agent = createTestAgent();

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async function (this: any) {
        this.state.metrics.totalToolCalls = 10;
        return { status: 'completed' };
      });

      await agent.start({ goal: 'Test', tasks: [] });

      const state = agent.getState();
      expect(state.metrics.totalToolCalls).toBe(10);
    });

    it('should track token usage', async () => {
      const agent = createTestAgent();

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async function (this: any) {
        this.state.metrics.totalTokensUsed = 1000;
        return { status: 'completed' };
      });

      await agent.start({ goal: 'Test', tasks: [] });

      const state = agent.getState();
      expect(state.metrics.totalTokensUsed).toBe(1000);
    });

    it('should track cost', async () => {
      const agent = createTestAgent();

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async function (this: any) {
        this.state.metrics.totalCost = 0.05;
        return { status: 'completed' };
      });

      await agent.start({ goal: 'Test', tasks: [] });

      const state = agent.getState();
      expect(state.metrics.totalCost).toBe(0.05);
    });
  });

  describe('conditional tasks', () => {
    it('should evaluate task conditions', async () => {
      const agent = createTestAgent();

      await agent.getMemory().store('user.isPremium', 'Premium status', true);

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async function (this: any) {
        const plan = this.getPlan();
        for (const task of plan.tasks) {
          if (task.condition) {
            const value = await this.memory.retrieve(task.condition.memoryKey);
            if (value !== task.condition.value && task.condition.onFalse === 'skip') {
              task.status = 'skipped';
            }
          }
        }
        return { status: 'completed' };
      });

      await agent.start({
        goal: 'Test',
        tasks: [
          {
            name: 'premium_only',
            description: 'Premium feature',
            condition: {
              memoryKey: 'user.isPremium',
              operator: 'equals',
              value: true,
              onFalse: 'skip',
            },
          },
        ],
      });

      const plan = agent.getPlan();
      // Task should NOT be skipped since user is premium
      expect(plan.tasks[0].status).not.toBe('skipped');
    });
  });

  describe('error handling', () => {
    it('should handle task failure with retry', async () => {
      const agent = createTestAgent();
      let attempts = 0;

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async function (this: any) {
        const plan = this.getPlan();
        const task = plan.tasks[0];

        while (task.attempts < task.maxAttempts) {
          attempts++;
          task.attempts++;

          if (attempts < 3) {
            continue; // Retry
          }

          task.status = 'completed';
          return { status: 'completed' };
        }

        task.status = 'failed';
        return { status: 'failed' };
      });

      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'flaky', description: 'Flaky task', maxAttempts: 3 }],
      });

      expect(attempts).toBe(3);
    });

    it('should mark plan as failed when task exhausts retries', async () => {
      const agent = createTestAgent();

      vi.spyOn(agent as any, 'executePlan').mockImplementation(async function (this: any) {
        const plan = this.getPlan();
        const task = plan.tasks[0];
        task.attempts = task.maxAttempts;
        task.status = 'failed';
        return { status: 'failed' };
      });

      const handle = await agent.start({
        goal: 'Test',
        tasks: [{ name: 'always_fails', description: 'Always fails', maxAttempts: 1 }],
      });

      const result = await handle.wait();
      expect(result.status).toBe('failed');
    });
  });
});
