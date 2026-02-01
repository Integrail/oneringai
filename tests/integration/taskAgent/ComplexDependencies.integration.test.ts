/**
 * Complex Dependencies Integration Tests
 *
 * Tests task dependency execution order with real LLM.
 * Memory operations are tested in mock tests (ComplexDependencies.mock.test.ts).
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
      'should execute tasks in correct dependency order: A→B,C; B,C→D',
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
        });

        const handle = await agent.start({
          goal: 'Diamond dependency test',
          tasks: [
            {
              name: 'root',
              description: 'Say "root complete"',
            },
            {
              name: 'branch_left',
              description: 'Say "left complete"',
              dependsOn: ['root'],
            },
            {
              name: 'branch_right',
              description: 'Say "right complete"',
              dependsOn: ['root'],
            },
            {
              name: 'merge',
              description: 'Say "all branches merged"',
              dependsOn: ['branch_left', 'branch_right'],
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(4);

        // Verify execution order - root must be first, merge must be last
        expect(executionOrder[0]).toBe('root');
        expect(executionOrder.slice(1, 3).sort()).toEqual(['branch_left', 'branch_right'].sort());
        expect(executionOrder[3]).toBe('merge');
      },
      TEST_TIMEOUT
    );
  });

  // NOTE: Memory storage tests are in ComplexDependencies.mock.test.ts
  // Real LLM may not reliably call memory tools - use mock for deterministic testing

  describeIfOpenAI('Conditional Task Execution', () => {
    it(
      'should execute conditional task when condition is met',
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

        // Pre-set condition value
        const memory = agent.getMemory();
        await memory!.store('is_premium', 'Premium flag', true);

        const handle = await agent.start({
          goal: 'Test conditional execution',
          tasks: [
            {
              name: 'check_status',
              description: 'Say "checking premium status"',
            },
            {
              name: 'premium_only',
              description: 'Say "premium feature accessed"',
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

        // Premium task should have executed (not skipped)
        const plan = agent.getPlan();
        const premiumTask = plan.tasks.find((t) => t.name === 'premium_only');
        expect(premiumTask?.status).toBe('completed');
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

        // Pre-set condition value to false
        const memory = agent.getMemory();
        await memory!.store('is_premium', 'Premium flag', false);

        const handle = await agent.start({
          goal: 'Test conditional skip',
          tasks: [
            {
              name: 'check_status',
              description: 'Say "checking premium status"',
            },
            {
              name: 'premium_only',
              description: 'Say "premium feature accessed"',
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

        // Premium task should be skipped
        const plan = agent.getPlan();
        const premiumTask = plan.tasks.find((t) => t.name === 'premium_only');
        expect(premiumTask?.status).toBe('skipped');
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
              description: 'Say "initial task running"',
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

  // NOTE: Retry logic with tool failures is tested in mock tests
  // Real LLM may avoid calling failing tools - use mock for deterministic testing

  describeIfOpenAI('Complex Multi-Level Dependencies', () => {
    it(
      'should handle 3-level dependency chain in correct order',
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
        });

        const handle = await agent.start({
          goal: 'Multi-level dependency test',
          tasks: [
            // Level 0
            {
              name: 'init',
              description: 'Say "initialized"',
            },
            // Level 1
            {
              name: 'level1_a',
              description: 'Say "level 1a"',
              dependsOn: ['init'],
            },
            {
              name: 'level1_b',
              description: 'Say "level 1b"',
              dependsOn: ['init'],
            },
            // Level 2
            {
              name: 'level2',
              description: 'Say "level 2"',
              dependsOn: ['level1_a', 'level1_b'],
            },
            // Level 3
            {
              name: 'final',
              description: 'Say "all done"',
              dependsOn: ['level2'],
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(5);

        // Verify execution order respects dependencies
        expect(executionOrder[0]).toBe('init');
        expect(executionOrder.slice(1, 3).sort()).toEqual(['level1_a', 'level1_b'].sort());
        expect(executionOrder[3]).toBe('level2');
        expect(executionOrder[4]).toBe('final');
      },
      TEST_TIMEOUT
    );
  });
});
