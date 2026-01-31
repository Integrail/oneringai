/**
 * Context Management Integration Tests with TaskAgent
 *
 * Minimal real-LLM smoke tests:
 * - Basic task execution completes without errors
 * - Different strategies can be configured
 *
 * NOTE: Detailed context behavior tests are in mock test files:
 * - ContextBudget.mock.test.ts
 * - ContextStrategies.mock.test.ts
 * - ContextCompactors.mock.test.ts
 * - ContextPlugins.mock.test.ts
 * - ContextFeatures.mock.test.ts
 * - MemoryEviction.mock.test.ts
 * - HistoryManagement.mock.test.ts
 * - ContextIntegration.mock.test.ts
 *
 * Requires API keys:
 * - OPENAI_API_KEY
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

  describeIfOpenAI('Basic Task Execution', () => {
    it(
      'should complete basic task execution with context management',
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
          instructions: 'You are a helpful assistant. Use memory_store to save data.',
        });

        const handle = await agent.start({
          goal: 'Execute simple tasks with memory',
          tasks: [
            {
              name: 'task1',
              description: 'Store "hello" with key "greeting" using memory_store',
            },
            {
              name: 'task2',
              description: 'Store "world" with key "target" using memory_store',
              dependsOn: ['task1'],
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(2);

        // Context management worked - agent completed tasks
        const state = agent.getState();
        expect(state.metrics.totalLLMCalls).toBeGreaterThan(0);
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Strategy Configuration', () => {
    it(
      'should work with different compaction strategies',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        // Test with aggressive strategy
        const storage1 = createAgentStorage();
        const agent1 = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage: storage1,
          contextConfig: {
            strategy: 'aggressive',
          },
        });

        const handle1 = await agent1.start({
          goal: 'Test aggressive strategy',
          tasks: [{ name: 'test', description: 'Say "hello"' }],
        });

        const result1 = await handle1.wait();
        expect(result1.status).toBe('completed');

        // Test with lazy strategy
        const storage2 = createAgentStorage();
        const agent2 = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage: storage2,
          contextConfig: {
            strategy: 'lazy',
          },
        });

        const handle2 = await agent2.start({
          goal: 'Test lazy strategy',
          tasks: [{ name: 'test', description: 'Say "goodbye"' }],
        });

        const result2 = await handle2.wait();
        expect(result2.status).toBe('completed');
      },
      TEST_TIMEOUT * 2
    );
  });
});
