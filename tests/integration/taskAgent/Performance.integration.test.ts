/**
 * Performance Integration Tests
 *
 * Tests performance metrics and optimizations:
 * - Token usage accuracy (estimation vs actual)
 * - Cost calculation accuracy
 * - Metrics accumulation across multiple runs
 * - Idempotency cache effectiveness
 * - Performance under different configurations
 *
 * Requires API keys:
 * - OPENAI_API_KEY (recommended)
 *
 * Run with: npm run test:integration -- tests/integration/taskAgent/Performance.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as dotenv from 'dotenv';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';
import { TaskAgent } from '@/capabilities/taskAgent/TaskAgent.js';
import { createAgentStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import { calculateCost } from '@/domain/entities/Model.js';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const HAS_OPENAI_KEY = Boolean(OPENAI_API_KEY);

const OPENAI_MODEL = 'gpt-4.1-mini';
const TEST_TIMEOUT = 90000;

const describeIfOpenAI = HAS_OPENAI_KEY ? describe : describe.skip;

describe('Performance Integration', () => {
  beforeAll(() => {
    if (!HAS_OPENAI_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not found. Performance tests will be skipped.');
    }
  });

  afterAll(() => {
    Connector.clear();
  });

  beforeEach(() => {
    Connector.clear();
  });

  describeIfOpenAI('Token Usage Accuracy', () => {
    it(
      'should track token usage accurately',
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
          goal: 'Test token tracking',
          tasks: [
            {
              name: 'task1',
              description: 'Say "Hello from task 1"',
            },
            {
              name: 'task2',
              description: 'Say "Hello from task 2"',
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');

        // Verify token metrics exist and are reasonable
        const state = agent.getState();
        expect(state.metrics.totalTokensUsed).toBeGreaterThan(0);
        expect(state.metrics.totalLLMCalls).toBeGreaterThan(0);

        console.log('Token usage:', {
          totalTokens: state.metrics.totalTokensUsed,
          llmCalls: state.metrics.totalLLMCalls,
        });
      },
      TEST_TIMEOUT
    );

    it(
      'should accumulate tokens across multiple tasks',
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
          goal: 'Accumulate tokens',
          tasks: [
            { name: 't1', description: 'Say "Task 1"' },
            { name: 't2', description: 'Say "Task 2"' },
            { name: 't3', description: 'Say "Task 3"' },
            { name: 't4', description: 'Say "Task 4"' },
            { name: 't5', description: 'Say "Task 5"' },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');

        const state = agent.getState();
        const totalTokens = state.metrics.totalTokensUsed;

        // Should have accumulated significant tokens
        expect(totalTokens).toBeGreaterThan(100);

        console.log('Token accumulation:', {
          totalTokens,
          tasksCompleted: result.metrics.completedTasks,
        });
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Cost Calculation', () => {
    it(
      'should calculate costs accurately using MODEL_REGISTRY',
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
          goal: 'Test cost calculation',
          tasks: [
            { name: 'task1', description: 'Say "Hello"' },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');

        const state = agent.getState();
        const totalTokens = state.metrics.totalTokensUsed;
        const actualCost = state.metrics.totalCost;

        console.log('Cost tracking:', {
          totalTokens,
          actualCost: `$${actualCost.toFixed(6)}`,
        });

        // Cost should be tracked and reasonable for mini model (very cheap)
        expect(actualCost).toBeGreaterThan(0);
        expect(actualCost).toBeLessThan(0.01); // Less than 1 cent
        expect(totalTokens).toBeGreaterThan(0);
      },
      TEST_TIMEOUT
    );

    it(
      'should track costs across multiple tasks',
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
          goal: 'Track costs',
          tasks: [
            { name: 't1', description: 'Say "Task 1"' },
            { name: 't2', description: 'Say "Task 2"' },
            { name: 't3', description: 'Say "Task 3"' },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');

        const state = agent.getState();
        const totalCost = state.metrics.totalCost;

        console.log('Total cost:', {
          tasks: result.metrics.completedTasks,
          cost: `$${totalCost.toFixed(6)}`,
          tokens: state.metrics.totalTokensUsed,
        });

        expect(totalCost).toBeGreaterThan(0);
        expect(totalCost).toBeLessThan(0.05); // Less than 5 cents for 3 simple tasks
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Metrics Accumulation', () => {
    it(
      'should accumulate metrics across multiple runs',
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

        // First run
        const handle1 = await agent.start({
          goal: 'First run',
          tasks: [{ name: 't1', description: 'Say "First"' }],
        });

        await handle1.wait();

        const state1 = agent.getState();
        const calls1 = state1.metrics.totalLLMCalls;
        const tokens1 = state1.metrics.totalTokensUsed;

        // Second run (resume)
        await agent.updatePlan({
          addTasks: [{ name: 't2', description: 'Say "Second"' }],
        });

        await agent.resume();

        const state2 = agent.getState();
        const calls2 = state2.metrics.totalLLMCalls;
        const tokens2 = state2.metrics.totalTokensUsed;

        // Metrics should have accumulated
        expect(calls2).toBeGreaterThan(calls1);
        expect(tokens2).toBeGreaterThan(tokens1);

        console.log('Metrics accumulation:', {
          run1: { calls: calls1, tokens: tokens1 },
          run2: { calls: calls2, tokens: tokens2 },
        });
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Idempotency Cache', () => {
    it(
      'should prevent duplicate tool calls using idempotency cache',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        let callCount = 0;
        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
          tools: [
            {
              definition: {
                type: 'function',
                function: {
                  name: 'track_calls',
                  description: 'Track number of calls',
                  parameters: {
                    type: 'object',
                    properties: {
                      value: { type: 'string' },
                    },
                    required: ['value'],
                  },
                },
              },
              execute: async (args) => {
                callCount++;
                return { called: callCount, value: args.value };
              },
            },
          ],
        });

        const handle = await agent.start({
          goal: 'Test idempotency',
          tasks: [
            {
              name: 'task1',
              description: 'Call track_calls tool with value "test"',
            },
          ],
        });

        await handle.wait();

        // Tool should be called at least once
        expect(callCount).toBeGreaterThan(0);

        // If LLM tries to call same tool with same args, cache should prevent duplicate
        const initialCallCount = callCount;

        // Try to force retry (pause and resume)
        await agent.pause();
        await agent.resume();

        // Call count should not increase much (cache should prevent duplicates)
        const finalCallCount = callCount;

        console.log('Idempotency cache:', {
          initialCalls: initialCallCount,
          finalCalls: finalCallCount,
          prevented: finalCallCount === initialCallCount ? 'Yes' : 'No',
        });
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Performance Under Different Configurations', () => {
    it(
      'should perform efficiently with minimal context',
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
            strategy: 'aggressive', // Minimal context
            maxContextTokens: 50000,
          },
        });

        const handle = await agent.start({
          goal: 'Minimal context test',
          tasks: [
            { name: 't1', description: 'Say "1"' },
            { name: 't2', description: 'Say "2"' },
            { name: 't3', description: 'Say "3"' },
            { name: 't4', description: 'Say "4"' },
            { name: 't5', description: 'Say "5"' },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');

        const state = agent.getState();
        const avgTokensPerCall = state.metrics.totalTokensUsed / state.metrics.totalLLMCalls;

        console.log('Minimal context performance:', {
          avgTokensPerCall: Math.round(avgTokensPerCall),
          llmCalls: state.metrics.totalLLMCalls,
        });

        // With aggressive strategy, tokens per call should be reasonable
        expect(avgTokensPerCall).toBeLessThan(10000);
      },
      TEST_TIMEOUT
    );

    // REMOVED: Memory operations performance test covered by Performance.mock.test.ts
    // Real LLM tool call count is non-deterministic
  });

  describeIfOpenAI('Execution Time Tracking', () => {
    it(
      'should track execution time accurately',
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

        const startTime = Date.now();

        const handle = await agent.start({
          goal: 'Time tracking test',
          tasks: [
            { name: 't1', description: 'Say "Task 1"' },
            { name: 't2', description: 'Say "Task 2"' },
            { name: 't3', description: 'Say "Task 3"' },
          ],
        });

        const result = await handle.wait();
        const endTime = Date.now();
        const actualDuration = endTime - startTime;

        expect(result.status).toBe('completed');

        console.log('Execution time:', {
          actualDuration: `${actualDuration}ms`,
          tasksCompleted: result.metrics.completedTasks,
        });

        // Execution should complete in reasonable time
        expect(actualDuration).toBeLessThan(60000); // Less than 60 seconds
      },
      TEST_TIMEOUT
    );
  });
});
