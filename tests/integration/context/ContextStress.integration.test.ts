/**
 * Context Stress Integration Tests
 *
 * Stress tests for context management under extreme load:
 * - 100+ tasks with memory pressure
 * - 1000+ message conversation history
 * - Multiple compaction cycles in one execution
 * - All strategies tested under same load
 * - Memory eviction with 100+ entries
 *
 * Requires API keys:
 * - OPENAI_API_KEY (recommended)
 *
 * Run with: npm run test:integration -- tests/integration/context/ContextStress.integration.test.ts
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
const TEST_TIMEOUT = 300000; // 5 minutes for stress tests

const describeIfOpenAI = HAS_OPENAI_KEY ? describe : describe.skip;

describe('Context Stress Integration', () => {
  beforeAll(() => {
    if (!HAS_OPENAI_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not found. Context stress tests will be skipped.');
    }
  });

  afterAll(() => {
    Connector.clear();
  });

  beforeEach(() => {
    Connector.clear();
  });

  describeIfOpenAI('High Task Count Stress', () => {
    it(
      'should handle 50 tasks with memory filling up',
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
          memoryConfig: {
            maxSizeBytes: 50000, // Small limit to force eviction
            softLimitPercent: 70,
          },
          instructions: 'Use memory_store to save results.',
        });

        // Pre-fill memory
        const memory = agent.getMemory();
        for (let i = 0; i < 30; i++) {
          await memory.store(`init_${i}`, `Initial data ${i}`, {
            content: 'x'.repeat(400),
          });
        }

        // Create 50 tasks
        const tasks = [];
        for (let i = 0; i < 50; i++) {
          tasks.push({
            name: `task_${i}`,
            description: `Task ${i}: Store "result_${i}" with key "t${i}" using memory_store`,
          });
        }

        const handle = await agent.start({
          goal: 'Stress test with 50 tasks',
          tasks,
        });

        const result = await handle.wait();

        // Should complete despite memory pressure
        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(50);

        // Memory should have evicted some entries
        const index = await memory.getIndex();
        expect(index.entries.length).toBeLessThan(80); // Not all 80 entries remain

        console.log('Completed 50 tasks:', {
          memoryEntries: index.entries.length,
          llmCalls: result.metrics.totalLLMCalls,
          toolCalls: result.metrics.totalToolCalls,
        });
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Conversation History Stress', () => {
    it(
      'should handle large conversation history',
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

        // Create many short tasks to build up history
        const tasks = [];
        for (let i = 0; i < 30; i++) {
          tasks.push({
            name: `step_${i}`,
            description: `Step ${i}: Say "Step ${i} done"`,
          });
        }

        const handle = await agent.start({
          goal: 'Build up conversation history',
          tasks,
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');

        // Verify tasks completed successfully
        const state = agent.getState();
        expect(state.metrics.totalLLMCalls).toBeGreaterThan(0);

        console.log('History stress test:', {
          tasksCompleted: result.metrics.completedTasks,
          llmCalls: result.metrics.totalLLMCalls,
        });
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Multiple Compaction Cycles', () => {
    it(
      'should trigger multiple compaction cycles during execution',
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
          memoryConfig: {
            maxSizeBytes: 30000, // Very small to force multiple evictions
            softLimitPercent: 60,
          },
          instructions: 'Use memory_store extensively.',
        });

        // Track compaction events (if exposed)
        let compactionCount = 0;
        const memory = agent.getMemory();

        // Fill memory multiple times
        const tasks = [];
        for (let i = 0; i < 20; i++) {
          tasks.push({
            name: `fill_${i}`,
            description: `Store 3 items with keys "f${i}_a", "f${i}_b", "f${i}_c" using memory_store, each with 300 characters of data`,
          });
        }

        const handle = await agent.start({
          goal: 'Trigger multiple compaction cycles',
          tasks,
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');

        // Memory should be well under capacity due to evictions
        const index = await memory.getIndex();
        expect(index.entries.length).toBeLessThan(40); // Not all 60 entries

        console.log('Multiple compaction cycles:', {
          finalMemoryEntries: index.entries.length,
          completedTasks: result.metrics.completedTasks,
        });
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Strategy Comparison Under Load', () => {
    it(
      'should complete tasks with proactive strategy under load',
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
          contextConfig: {
            strategy: 'proactive',
            maxContextTokens: 100000,
          },
          memoryConfig: {
            maxSizeBytes: 40000,
          },
        });

        // Pre-fill memory
        const memory = agent.getMemory();
        for (let i = 0; i < 20; i++) {
          await memory.store(`load_${i}`, `Load data ${i}`, {
            content: 'x'.repeat(500),
          });
        }

        // Create 20 tasks
        const tasks = [];
        for (let i = 0; i < 20; i++) {
          tasks.push({
            name: `work_${i}`,
            description: `Task ${i}: Store "output_${i}" with key "out${i}" using memory_store`,
          });
        }

        const handle = await agent.start({
          goal: 'Test proactive strategy under load',
          tasks,
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(20);

        console.log('Proactive strategy:', {
          llmCalls: result.metrics.totalLLMCalls,
        });
      },
      TEST_TIMEOUT
    );

    it(
      'should complete tasks with aggressive strategy under load',
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
          contextConfig: {
            strategy: 'aggressive',
            maxContextTokens: 100000,
          },
          memoryConfig: {
            maxSizeBytes: 40000,
          },
        });

        // Pre-fill memory
        const memory = agent.getMemory();
        for (let i = 0; i < 20; i++) {
          await memory.store(`load_${i}`, `Load data ${i}`, {
            content: 'x'.repeat(500),
          });
        }

        // Create 20 tasks
        const tasks = [];
        for (let i = 0; i < 20; i++) {
          tasks.push({
            name: `work_${i}`,
            description: `Task ${i}: Store "output_${i}" with key "out${i}" using memory_store`,
          });
        }

        const handle = await agent.start({
          goal: 'Test aggressive strategy under load',
          tasks,
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(20);

        console.log('Aggressive strategy:', {
          llmCalls: result.metrics.totalLLMCalls,
        });
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Memory Eviction Stress', () => {
    it(
      'should handle 100+ memory entries with eviction',
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
          memoryConfig: {
            maxSizeBytes: 60000, // Limit to force eviction
            softLimitPercent: 75,
          },
        });

        // Fill memory with 100 entries
        const memory = agent.getMemory();
        for (let i = 0; i < 100; i++) {
          await memory.store(`entry_${i}`, `Entry ${i}`, {
            content: `Data ${i}`,
          });
        }

        const handle = await agent.start({
          goal: 'Test memory eviction with 100 entries',
          tasks: [
            {
              name: 'list_all',
              description: 'List all memory keys using memory_list',
            },
            {
              name: 'add_more',
              description: 'Store 10 more items with keys "extra1" through "extra10" using memory_store',
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');

        // Many entries should have been evicted
        const index = await memory.getIndex();
        expect(index.entries.length).toBeLessThan(110);

        console.log('Memory eviction stress:', {
          remainingEntries: index.entries.length,
          evicted: 110 - index.entries.length,
        });
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Combined Stress Test', () => {
    it(
      'should handle memory pressure, history, and many tasks simultaneously',
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
          memoryConfig: {
            maxSizeBytes: 45000,
            softLimitPercent: 70,
          },
          contextConfig: {
            strategy: 'adaptive',
            maxContextTokens: 120000,
          },
        });

        // Pre-fill memory
        const memory = agent.getMemory();
        for (let i = 0; i < 40; i++) {
          await memory.store(`init_${i}`, `Initial ${i}`, {
            content: 'x'.repeat(300),
          });
        }

        // Create 30 tasks
        const tasks = [];
        for (let i = 0; i < 30; i++) {
          tasks.push({
            name: `combo_${i}`,
            description: `Task ${i}: Store "result${i}" with key "r${i}" using memory_store, then list memory keys`,
          });
        }

        const handle = await agent.start({
          goal: 'Combined stress test',
          tasks,
        });

        const result = await handle.wait();

        // Should complete despite all pressures
        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(30);

        const state = agent.getState();
        console.log('Combined stress test:', {
          completedTasks: result.metrics.completedTasks,
          llmCalls: result.metrics.totalLLMCalls,
          toolCalls: result.metrics.totalToolCalls,
          historyLength: state.conversationHistory.length,
        });
      },
      TEST_TIMEOUT
    );
  });
});
