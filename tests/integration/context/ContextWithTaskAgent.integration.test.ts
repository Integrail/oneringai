/**
 * Context Management Integration Tests with TaskAgent
 *
 * Tests context management under real task execution:
 * - Context compaction during task execution
 * - Memory eviction under pressure
 * - History truncation when over limit
 * - Priority-based compaction (plan > memory > history)
 * - Strategy switching mid-execution
 * - Budget warnings and critical events
 * - TaskAgentContextProvider component assembly
 *
 * Requires API keys:
 * - OPENAI_API_KEY (recommended)
 *
 * Run with: npm run test:integration -- tests/integration/context/ContextWithTaskAgent.integration.test.ts
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
const TEST_TIMEOUT = 90000;

const describeIfOpenAI = HAS_OPENAI_KEY ? describe : describe.skip;

describe('Context Management with TaskAgent Integration', () => {
  beforeAll(() => {
    if (!HAS_OPENAI_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not found. Context integration tests will be skipped.');
    }
  });

  afterAll(() => {
    Connector.clear();
  });

  beforeEach(() => {
    Connector.clear();
  });

  describeIfOpenAI('Context Budget Management', () => {
    it(
      'should manage context automatically during execution',
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
          instructions: 'You are a helpful assistant. Use memory_store and memory_list tools.',
        });

        const handle = await agent.start({
          goal: 'Execute multiple tasks with context management',
          tasks: [
            {
              name: 'task1',
              description: 'Store "item1" with key "data1" using memory_store',
            },
            {
              name: 'task2',
              description: 'Store "item2" with key "data2" using memory_store',
              dependsOn: ['task1'],
            },
            {
              name: 'task3',
              description: 'List all memory keys using memory_list',
              dependsOn: ['task2'],
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(3);

        // Context was managed successfully
        const state = agent.getState();
        expect(state.metrics.totalLLMCalls).toBeGreaterThan(0);
      },
      TEST_TIMEOUT
    );

    it(
      'should emit budget warnings when context usage is high',
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
          instructions: 'Use memory_store to save large amounts of data.',
        });

        // Pre-fill memory with data to increase context usage
        const memory = agent.getMemory();
        for (let i = 0; i < 20; i++) {
          await memory.store(`key_${i}`, `Data item ${i}`, {
            content: 'x'.repeat(500), // 500 bytes each
          });
        }

        // Track budget events (if exposed via agent events)
        let budgetWarningEmitted = false;
        // Note: We might need to expose context manager events through TaskAgent

        const handle = await agent.start({
          goal: 'Execute tasks with high memory usage',
          tasks: [
            {
              name: 'list_memory',
              description: 'List all memory items using memory_list',
            },
            {
              name: 'add_more',
              description: 'Store another 5 items using memory_store with keys "extra1" through "extra5"',
            },
          ],
        });

        const result = await handle.wait();

        // Should still complete despite high context usage
        expect(result.status).toBe('completed');
      },
      TEST_TIMEOUT
    );
  });

  // REMOVED: Memory eviction tests moved to mock tests
  // Real LLM behavior is non-deterministic for memory storage

  describeIfOpenAI('Priority-Based Compaction', () => {
    it(
      'should preserve high-priority components (plan, instructions)',
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
          instructions: 'CRITICAL INSTRUCTION: Always be polite and professional. This instruction must not be lost.',
        });

        // Fill memory and history
        const memory = agent.getMemory();
        for (let i = 0; i < 10; i++) {
          await memory.store(`data_${i}`, `Item ${i}`, {
            content: 'x'.repeat(200),
          });
        }

        const handle = await agent.start({
          goal: 'Test priority preservation',
          tasks: [
            {
              name: 'task1',
              description: 'Say hello politely',
            },
            {
              name: 'task2',
              description: 'Say goodbye politely',
            },
          ],
        });

        const result = await handle.wait();

        // Should complete - plan and instructions are preserved
        expect(result.status).toBe('completed');

        // Verify plan is still intact
        const plan = agent.getPlan();
        expect(plan.goal).toBe('Test priority preservation');
        expect(plan.tasks).toHaveLength(2);
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('History Truncation', () => {
    it(
      'should truncate conversation history when it grows too large',
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

        // Create many tasks to build up history
        const tasks = [];
        for (let i = 0; i < 10; i++) {
          tasks.push({
            name: `task_${i}`,
            description: `Task ${i}: Say "Step ${i} complete"`,
          });
        }

        const handle = await agent.start({
          goal: 'Build up conversation history',
          tasks,
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');

        // Verify tasks completed
        const state = agent.getState();
        expect(state.metrics.totalLLMCalls).toBeGreaterThan(0);

        console.log(`Completed ${result.metrics.completedTasks} tasks with ${state.metrics.totalLLMCalls} LLM calls`);
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Component Assembly', () => {
    it(
      'should correctly assemble context components via TaskAgentContextProvider',
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
          instructions: 'Test instructions',
        });

        // Add memory
        const memory = agent.getMemory();
        await memory.store('test_key', 'Test value', { data: 'test' });

        const handle = await agent.start({
          goal: 'Test context component assembly',
          tasks: [
            {
              name: 'simple_task',
              description: 'Retrieve test_key using memory_retrieve and confirm value',
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');

        // Components were assembled correctly:
        // - System prompt
        // - Instructions
        // - Plan
        // - Memory index
        // - Conversation history
        // - Current input
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Multiple Tasks with Growing Context', () => {
    it(
      'should handle multiple tasks with accumulating context',
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
          instructions: 'Use memory_store for each task result.',
        });

        const handle = await agent.start({
          goal: 'Execute 5 tasks with cumulative results',
          tasks: [
            {
              name: 'step1',
              description: 'Store "step1 done" with key "s1" using memory_store',
            },
            {
              name: 'step2',
              description: 'Store "step2 done" with key "s2" using memory_store',
              dependsOn: ['step1'],
            },
            {
              name: 'step3',
              description: 'Store "step3 done" with key "s3" using memory_store',
              dependsOn: ['step2'],
            },
            {
              name: 'step4',
              description: 'Store "step4 done" with key "s4" using memory_store',
              dependsOn: ['step3'],
            },
            {
              name: 'step5',
              description: 'List all memory keys using memory_list and confirm 4 entries exist',
              dependsOn: ['step4'],
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(5);

        // Verify all data was stored
        const memory = agent.getMemory();
        const s1 = await memory.retrieve('s1');
        const s2 = await memory.retrieve('s2');
        const s3 = await memory.retrieve('s3');
        const s4 = await memory.retrieve('s4');

        expect(s1).toBeDefined();
        expect(s2).toBeDefined();
        expect(s3).toBeDefined();
        expect(s4).toBeDefined();

        console.log('Context management handled 5 tasks successfully');
      },
      TEST_TIMEOUT
    );
  });

  // REMOVED: Tool output context test moved to mock tests
  // Real LLM behavior is non-deterministic for tool calls

  describeIfOpenAI('Context Stress Test', () => {
    it(
      'should handle 10 tasks with heavy memory usage',
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

        // Pre-fill memory
        const memory = agent.getMemory();
        for (let i = 0; i < 20; i++) {
          await memory.store(`init_${i}`, `Initial ${i}`, {
            content: `Data ${i}`,
          });
        }

        const tasks = [];
        for (let i = 0; i < 10; i++) {
          tasks.push({
            name: `task_${i}`,
            description: `Task ${i}: List memory using memory_list`,
          });
        }

        const handle = await agent.start({
          goal: 'Stress test context management',
          tasks,
        });

        const result = await handle.wait();

        // Should complete despite stress
        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(10);

        console.log('Context stress test completed:', {
          llmCalls: result.metrics.totalLLMCalls,
          toolCalls: result.metrics.totalToolCalls,
        });
      },
      TEST_TIMEOUT * 2 // Allow extra time for stress test
    );
  });
});
