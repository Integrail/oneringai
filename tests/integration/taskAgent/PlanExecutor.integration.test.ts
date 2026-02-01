/**
 * PlanExecutor Integration Tests - End-to-End Execution with Real LLMs
 *
 * Tests complete task execution flow with real LLM calls:
 * - Tool execution and verification
 * - Multi-task execution with dependencies
 * - Metrics tracking (tokens, cost, calls)
 * - Conversation history management
 * - Memory integration
 * - Error handling and retries
 *
 * Requires API keys:
 * - OPENAI_API_KEY (recommended for fast/reliable testing)
 * - ANTHROPIC_API_KEY (optional)
 *
 * Run with: npm run test:integration -- tests/integration/taskAgent/PlanExecutor.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as dotenv from 'dotenv';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';
import { TaskAgent } from '@/capabilities/taskAgent/TaskAgent.js';
import { createAgentStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import { ToolFunction } from '@/domain/entities/Tool.js';
import { createTask } from '@/domain/entities/Task.js';

// Load environment variables
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const HAS_OPENAI_KEY = Boolean(OPENAI_API_KEY);
const HAS_ANTHROPIC_KEY = Boolean(ANTHROPIC_API_KEY);

// Use fast, cheap models for testing
const OPENAI_MODEL = 'gpt-4.1-mini'; // Fast and cheap
const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929'; // Alternative

// Conditional test execution
const describeIfOpenAI = HAS_OPENAI_KEY ? describe : describe.skip;
const describeIfAnthropic = HAS_ANTHROPIC_KEY ? describe : describe.skip;

// Test timeout - allow time for real LLM calls
const TEST_TIMEOUT = 60000; // 60 seconds

describe('PlanExecutor Integration - Real LLM', () => {
  beforeAll(() => {
    if (!HAS_OPENAI_KEY && !HAS_ANTHROPIC_KEY) {
      console.warn('⚠️  No API keys found. PlanExecutor integration tests will be skipped.');
      console.warn('   Set OPENAI_API_KEY or ANTHROPIC_API_KEY to run these tests.');
    }
  });

  afterAll(() => {
    Connector.clear();
  });

  beforeEach(() => {
    Connector.clear();
  });

  describeIfOpenAI('OpenAI - Single Task Execution', () => {
    it(
      'should execute single task with tool call and verify completion',
      async () => {
        // Setup connector
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        // Create test tool
        let toolCallCount = 0;
        const weatherTool: ToolFunction = {
          definition: {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get current weather for a location',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string', description: 'City name' },
                },
                required: ['location'],
              },
            },
          },
          execute: async (args: { location: string }) => {
            toolCallCount++;
            return {
              location: args.location,
              temperature: 72,
              condition: 'sunny',
            };
          },
        };

        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          tools: [weatherTool],
          storage,
          instructions: 'You are a task execution agent. Complete tasks efficiently.',
        });

        // Execute plan
        const handle = await agent.start({
          goal: 'Get weather information',
          tasks: [
            {
              name: 'fetch_weather',
              description: 'Get the weather for San Francisco using the get_weather tool',
            },
          ],
        });

        const result = await handle.wait();

        // Verify execution
        expect(result.status).toBe('completed');
        expect(result.metrics.totalTasks).toBe(1);
        expect(result.metrics.completedTasks).toBe(1);
        expect(result.metrics.failedTasks).toBe(0);

        // Verify tool was called
        expect(toolCallCount).toBeGreaterThan(0);

        // Verify metrics were tracked
        const state = agent.getState();
        expect(state.metrics.totalLLMCalls).toBeGreaterThan(0);
        // Note: totalToolCalls tracking depends on LLM actually calling tools
        // For deterministic tool call testing, use PlanExecutor.mock.test.ts
        expect(state.metrics.totalTokensUsed).toBeGreaterThan(0);
        expect(state.metrics.totalCost).toBeGreaterThan(0);

        // Verify memory is accessible
        const memory = agent.getMemory();
        const index = await memory.getIndex();
        expect(index).toBeDefined();
      },
      TEST_TIMEOUT
    );

    it(
      'should execute multiple tasks in sequence',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        const calculatorTool: ToolFunction = {
          definition: {
            type: 'function',
            function: {
              name: 'calculate',
              description: 'Perform arithmetic calculation',
              parameters: {
                type: 'object',
                properties: {
                  operation: {
                    type: 'string',
                    enum: ['add', 'multiply'],
                  },
                  a: { type: 'number' },
                  b: { type: 'number' },
                },
                required: ['operation', 'a', 'b'],
              },
            },
          },
          execute: async (args: { operation: string; a: number; b: number }) => {
            if (args.operation === 'add') {
              return { result: args.a + args.b };
            } else if (args.operation === 'multiply') {
              return { result: args.a * args.b };
            }
            throw new Error('Unknown operation');
          },
        };

        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          tools: [calculatorTool],
          storage,
        });

        const handle = await agent.start({
          goal: 'Calculate 2+2, then multiply result by 3',
          tasks: [
            {
              name: 'addition',
              description: 'Calculate 2+2 using the calculate tool',
            },
            {
              name: 'multiplication',
              description: 'Take the result from addition (should be 4) and multiply by 3 using calculate tool',
              dependsOn: ['addition'],
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(2);
        expect(result.metrics.failedTasks).toBe(0);

        // Verify both tasks executed
        const plan = agent.getPlan();
        expect(plan.tasks[0].status).toBe('completed');
        expect(plan.tasks[1].status).toBe('completed');
      },
      TEST_TIMEOUT
    );

    it(
      'should track conversation history across tasks',
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

        await agent.start({
          goal: 'Execute two simple tasks',
          tasks: [
            {
              name: 'task1',
              description: 'Respond with "Task 1 complete"',
            },
            {
              name: 'task2',
              description: 'Respond with "Task 2 complete"',
            },
          ],
        });

        // Verify conversation history exists
        const state = agent.getState();
        expect(state.conversationHistory).toBeDefined();
        expect(state.metrics.totalLLMCalls).toBeGreaterThan(0);
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('OpenAI - Task Dependencies', () => {
    it(
      'should respect task dependencies',
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

        await agent.start({
          goal: 'Execute tasks in order',
          tasks: [
            {
              name: 'task_a',
              description: 'First task',
            },
            {
              name: 'task_b',
              description: 'Second task that depends on task_a',
              dependsOn: ['task_a'],
            },
            {
              name: 'task_c',
              description: 'Third task that depends on task_b',
              dependsOn: ['task_b'],
            },
          ],
        });

        // Verify execution order
        expect(executionOrder).toEqual(['task_a', 'task_b', 'task_c']);
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('OpenAI - Memory Integration', () => {
    it(
      'should use memory tools to store and retrieve data across tasks',
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
          instructions: 'Use memory_store and memory_retrieve tools to persist data between tasks.',
        });

        const handle = await agent.start({
          goal: 'Store a number in memory and retrieve it later',
          tasks: [
            {
              name: 'store_data',
              description: 'You MUST call the memory_store tool with key="my_number", description="My number", value=42. Do NOT just say you stored the data - actually call the memory_store tool.',
              maxAttempts: 5, // Allow retries if validation fails
              validation: {
                enabled: true,
                method: 'llm_self_reflection',
                requiredMemoryKeys: ['my_number'],
                mode: 'strict', // Fail task if key is missing so it retries
              },
            },
            {
              name: 'retrieve_data',
              description: 'Retrieve the number from memory key "my_number" using memory_retrieve tool and confirm it is 42',
              dependsOn: ['store_data'],
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(2);

        // Verify memory was actually used
        const memory = agent.getMemory();
        const storedValue = await memory.retrieve('my_number');
        expect(storedValue).toBeDefined();
      },
      TEST_TIMEOUT
    );
  });

  // REMOVED: Error handling tests (retry, max retries failure) moved to mock tests
  // Real LLM may avoid calling failing tools - use ComplexDependencies.mock.test.ts
  // for deterministic failure/retry testing

  describeIfOpenAI('OpenAI - Metrics Tracking', () => {
    it(
      'should accurately track tokens and cost',
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

        await agent.start({
          goal: 'Simple task for metrics',
          tasks: [
            {
              name: 'simple',
              description: 'Say hello',
            },
          ],
        });

        const state = agent.getState();

        // Verify all metrics are tracked
        expect(state.metrics.totalLLMCalls).toBeGreaterThan(0);
        expect(state.metrics.totalTokensUsed).toBeGreaterThan(0);
        expect(state.metrics.totalCost).toBeGreaterThan(0);

        // Cost should be reasonable (not absurdly high)
        expect(state.metrics.totalCost).toBeLessThan(0.10); // Should cost less than 10 cents

        console.log('Metrics:', {
          llmCalls: state.metrics.totalLLMCalls,
          tokens: state.metrics.totalTokensUsed,
          cost: `$${state.metrics.totalCost.toFixed(4)}`,
        });
      },
      TEST_TIMEOUT
    );
  });

  describeIfAnthropic('Anthropic - Basic Execution', () => {
    it(
      'should execute tasks with Claude',
      async () => {
        Connector.create({
          name: 'anthropic-test',
          vendor: Vendor.Anthropic,
          auth: { type: 'api_key', apiKey: ANTHROPIC_API_KEY! },
        });

        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'anthropic-test',
          model: ANTHROPIC_MODEL,
          storage,
        });

        const handle = await agent.start({
          goal: 'Simple test with Claude',
          tasks: [
            {
              name: 'greet',
              description: 'Respond with a brief greeting',
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(1);
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('OpenAI - Context Management Integration', () => {
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
          instructions: 'Use memory_store to save data.',
        });

        // Fill up memory to test context management
        const memory = agent.getMemory();
        for (let i = 0; i < 5; i++) {
          await memory.store(`key_${i}`, `Data item ${i}`, {
            content: 'x'.repeat(100),
          });
        }

        const handle = await agent.start({
          goal: 'Execute tasks with memory pressure',
          tasks: [
            {
              name: 'task1',
              description: 'List all memory keys using memory_query tool',
            },
            {
              name: 'task2',
              description: 'Store a new item with key "final" using memory_store',
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');

        // Context should have been managed automatically
        const state = agent.getState();
        expect(state.metrics.totalLLMCalls).toBeGreaterThan(0);
      },
      TEST_TIMEOUT
    );
  });
});
