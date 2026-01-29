/**
 * Complex Dependencies Integration Tests
 *
 * Tests intricate task dependency scenarios:
 * - Diamond dependency patterns (A→B,C; B,C→D)
 * - Parallel execution with failures
 * - Cascading failures
 * - Conditional task execution
 * - Dynamic task addition
 * - Retry logic with dependencies
 *
 * Requires API keys:
 * - OPENAI_API_KEY (recommended)
 *
 * Run with: npm run test:integration -- tests/integration/taskAgent/ComplexDependencies.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as dotenv from 'dotenv';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';
import { TaskAgent } from '@/capabilities/taskAgent/TaskAgent.js';
import { createAgentStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import { ToolFunction } from '@/domain/entities/Tool.js';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const HAS_OPENAI_KEY = Boolean(OPENAI_API_KEY);

const OPENAI_MODEL = 'gpt-4.1-mini';
const TEST_TIMEOUT = 120000; // 2 minutes for complex scenarios

const describeIfOpenAI = HAS_OPENAI_KEY ? describe : describe.skip;

describe('Complex Dependencies Integration', () => {
  beforeAll(() => {
    if (!HAS_OPENAI_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not found. Complex dependency tests will be skipped.');
    }
  });

  afterAll(() => {
    Connector.clear();
  });

  beforeEach(() => {
    Connector.clear();
  });

  describeIfOpenAI('Diamond Dependency Pattern', () => {
    it(
      'should handle diamond pattern: A→B,C; B,C→D',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        const executionOrder: string[] = [];

        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
          hooks: {
            beforeTask: async (task) => {
              executionOrder.push(task.name);
            },
          },
          instructions: 'Use memory_store to save results.',
        });

        const handle = await agent.start({
          goal: 'Diamond dependency test',
          tasks: [
            {
              name: 'root',
              description: 'Store "root complete" with key "root" using memory_store',
            },
            {
              name: 'branch_left',
              description: 'Store "left complete" with key "left" using memory_store',
              dependsOn: ['root'],
            },
            {
              name: 'branch_right',
              description: 'Store "right complete" with key "right" using memory_store',
              dependsOn: ['root'],
            },
            {
              name: 'merge',
              description: 'List all memory keys using memory_list and confirm root, left, right exist',
              dependsOn: ['branch_left', 'branch_right'],
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(4);

        // Verify execution order
        expect(executionOrder[0]).toBe('root');
        expect(executionOrder.slice(1, 3).sort()).toEqual(['branch_left', 'branch_right'].sort());
        expect(executionOrder[3]).toBe('merge');

        // Verify all data exists
        const memory = agent.getMemory();
        const root = await memory.retrieve('root');
        const left = await memory.retrieve('left');
        const right = await memory.retrieve('right');

        expect(root).toBeDefined();
        expect(left).toBeDefined();
        expect(right).toBeDefined();
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Parallel Execution with Failure', () => {
    it(
      'should handle failure in one parallel branch',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        let toolCalled = false;
        const failingTool: ToolFunction = {
          definition: {
            type: 'function',
            function: {
              name: 'fail_always',
              description: 'Process data (this tool will fail)',
              parameters: { type: 'object', properties: {} },
            },
          },
          execute: async () => {
            toolCalled = true;
            throw new Error('Intentional failure');
          },
        };

        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          tools: [failingTool],
          storage,
        });

        const handle = await agent.start({
          goal: 'Test parallel with failure',
          tasks: [
            {
              name: 'success_branch',
              description: 'Say "I succeeded"',
            },
            {
              name: 'fail_branch',
              description: 'Call fail_always tool',
              maxAttempts: 1,
            },
          ],
          allowParallelExecution: true,
        });

        const result = await handle.wait();

        // If tool was called and failed, plan should fail
        // If LLM avoided calling the failing tool, plan might complete
        if (toolCalled) {
          expect(result.status).toBe('failed');
          expect(result.metrics.failedTasks).toBeGreaterThan(0);
          const plan = agent.getPlan();
          const failTask = plan.tasks.find((t) => t.name === 'fail_branch');
          expect(failTask?.status).toBe('failed');
        } else {
          // LLM was smart enough to avoid the failing tool
          console.log('LLM avoided calling the failing tool');
        }

        // Success task should always complete
        const plan = agent.getPlan();
        const successTask = plan.tasks.find((t) => t.name === 'success_branch');
        expect(successTask?.status).toBe('completed');
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Cascading Failures', () => {
    it(
      'should skip dependent tasks when parent fails',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        let toolCalled = false;
        const failingTool: ToolFunction = {
          definition: {
            type: 'function',
            function: {
              name: 'must_fail',
              description: 'Process data (this tool will fail)',
              parameters: { type: 'object', properties: {} },
            },
          },
          execute: async () => {
            toolCalled = true;
            throw new Error('Cascade test failure');
          },
        };

        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          tools: [failingTool],
          storage,
        });

        const handle = await agent.start({
          goal: 'Test cascading failure',
          tasks: [
            {
              name: 'will_fail',
              description: 'Call must_fail tool',
              maxAttempts: 1,
            },
            {
              name: 'depends_on_failure',
              description: 'This should be skipped',
              dependsOn: ['will_fail'],
            },
            {
              name: 'also_depends',
              description: 'This should also be skipped',
              dependsOn: ['depends_on_failure'],
            },
          ],
        });

        const result = await handle.wait();

        // If tool was called, task should fail and dependents should be skipped
        // If LLM avoided the tool, it might complete differently
        if (toolCalled) {
          expect(result.status).toBe('failed');
          const plan = agent.getPlan();
          expect(plan.tasks[0].status).toBe('failed');
          expect(plan.tasks[1].status).toBe('skipped');
          expect(plan.tasks[2].status).toBe('skipped');
        } else {
          console.log('LLM avoided calling the failing tool');
          // Just verify execution completed
          expect(['completed', 'failed']).toContain(result.status);
        }
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Conditional Task Execution', () => {
    it(
      'should execute task only when condition is met',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
          instructions: 'Use memory_store and memory_retrieve.',
        });

        // Set condition value
        const memory = agent.getMemory();
        await memory.store('is_premium', 'Premium flag', true);

        const handle = await agent.start({
          goal: 'Test conditional execution',
          tasks: [
            {
              name: 'check_status',
              description: 'Retrieve "is_premium" from memory using memory_retrieve',
            },
            {
              name: 'premium_only',
              description: 'Store "premium feature accessed" with key "feature" using memory_store',
              dependsOn: ['check_status'],
              condition: {
                memoryKey: 'is_premium',
                operator: 'equals',
                value: true,
                onFalse: 'skip',
              },
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');

        // Premium task should have executed
        const plan = agent.getPlan();
        const premiumTask = plan.tasks.find((t) => t.name === 'premium_only');
        expect(premiumTask?.status).toBe('completed');

        // Verify feature was accessed
        const feature = await memory.retrieve('feature');
        expect(feature).toBeDefined();
      },
      TEST_TIMEOUT
    );

    it(
      'should skip task when condition is not met',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
        });

        // Set condition value to false
        const memory = agent.getMemory();
        await memory.store('is_admin', 'Admin flag', false);

        const handle = await agent.start({
          goal: 'Test conditional skip',
          tasks: [
            {
              name: 'check_admin',
              description: 'Check admin status',
            },
            {
              name: 'admin_only',
              description: 'Admin-only operation',
              condition: {
                memoryKey: 'is_admin',
                operator: 'equals',
                value: true,
                onFalse: 'skip',
              },
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');

        // Admin task should be skipped
        const plan = agent.getPlan();
        const adminTask = plan.tasks.find((t) => t.name === 'admin_only');
        expect(adminTask?.status).toBe('skipped');
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Dynamic Task Addition', () => {
    it(
      'should allow adding tasks during execution',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
        });

        const handle = await agent.start({
          goal: 'Test dynamic task addition',
          tasks: [
            {
              name: 'initial_task',
              description: 'Say "Initial task complete"',
            },
          ],
          allowDynamicTasks: true,
        });

        // Add task after execution starts
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait a bit

        await agent.updatePlan({
          addTasks: [
            {
              name: 'dynamic_task',
              description: 'Say "Dynamic task added"',
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');

        const plan = agent.getPlan();
        expect(plan.tasks).toHaveLength(2);
        expect(plan.tasks.some((t) => t.name === 'dynamic_task')).toBe(true);
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Retry Logic with Dependencies', () => {
    it(
      'should wait for retrying parent before executing child',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        let parentAttempts = 0;
        const flakyTool: ToolFunction = {
          definition: {
            type: 'function',
            function: {
              name: 'flaky',
              description: 'Fails first time, succeeds second',
              parameters: { type: 'object', properties: {} },
            },
          },
          execute: async () => {
            parentAttempts++;
            if (parentAttempts === 1) {
              throw new Error('First attempt fails');
            }
            return { success: true };
          },
        };

        let childExecuted = false;
        const childTool: ToolFunction = {
          definition: {
            type: 'function',
            function: {
              name: 'child_op',
              description: 'Child operation',
              parameters: { type: 'object', properties: {} },
            },
          },
          execute: async () => {
            childExecuted = true;
            return { success: true };
          },
        };

        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          tools: [flakyTool, childTool],
          storage,
        });

        const handle = await agent.start({
          goal: 'Test retry with dependency',
          tasks: [
            {
              name: 'parent',
              description: 'Call flaky tool',
              maxAttempts: 3,
            },
            {
              name: 'child',
              description: 'Call child_op tool',
              dependsOn: ['parent'],
            },
          ],
        });

        const result = await handle.wait();

        // Should complete after retry
        expect(result.status).toBe('completed');
        expect(parentAttempts).toBeGreaterThan(1);
        expect(childExecuted).toBe(true);
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Complex Multi-Level Dependencies', () => {
    it(
      'should handle 3-level dependency chain',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
          instructions: 'Use memory_store to track progress.',
        });

        const handle = await agent.start({
          goal: 'Multi-level dependency test',
          tasks: [
            // Level 0
            {
              name: 'init',
              description: 'Store "initialized" with key "level0" using memory_store',
            },
            // Level 1
            {
              name: 'level1_a',
              description: 'Store "level1a" with key "l1a" using memory_store',
              dependsOn: ['init'],
            },
            {
              name: 'level1_b',
              description: 'Store "level1b" with key "l1b" using memory_store',
              dependsOn: ['init'],
            },
            // Level 2
            {
              name: 'level2',
              description: 'Store "level2" with key "l2" using memory_store',
              dependsOn: ['level1_a', 'level1_b'],
            },
            // Level 3
            {
              name: 'final',
              description: 'List all memory keys using memory_list and verify all levels',
              dependsOn: ['level2'],
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(5);

        // Verify all levels executed
        const memory = agent.getMemory();
        const level0 = await memory.retrieve('level0');
        const l1a = await memory.retrieve('l1a');
        const l1b = await memory.retrieve('l1b');
        const l2 = await memory.retrieve('l2');

        expect(level0).toBeDefined();
        expect(l1a).toBeDefined();
        expect(l1b).toBeDefined();
        expect(l2).toBeDefined();
      },
      TEST_TIMEOUT
    );
  });
});
