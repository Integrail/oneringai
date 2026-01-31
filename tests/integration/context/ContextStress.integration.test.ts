/**
 * Context Stress Integration Tests
 *
 * Minimal real-LLM smoke test:
 * - Moderate load (10-15 tasks) completes without errors
 *
 * NOTE: Detailed stress and behavior tests are in mock test files:
 * - ContextBudget.mock.test.ts
 * - ContextStrategies.mock.test.ts
 * - MemoryEviction.mock.test.ts
 * - ContextIntegration.mock.test.ts
 *
 * Requires API keys:
 * - OPENAI_API_KEY
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
const TEST_TIMEOUT = 180000; // 3 minutes for moderate load test

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

  describeIfOpenAI('Moderate Load Test', () => {
    it(
      'should complete 12 tasks with memory operations without errors',
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
          },
        });

        // Pre-fill memory to create some context pressure
        const memory = agent.getMemory();
        for (let i = 0; i < 10; i++) {
          await memory.store(`preload_${i}`, `Preloaded data ${i}`, {
            content: 'x'.repeat(200),
          });
        }

        // Create 12 tasks - moderate load
        const tasks = [];
        for (let i = 0; i < 12; i++) {
          tasks.push({
            name: `task_${i}`,
            description: `Task ${i}: Store "result_${i}" with key "out_${i}" using memory_store`,
          });
        }

        const handle = await agent.start({
          goal: 'Moderate load stress test',
          tasks,
        });

        const result = await handle.wait();

        // Should complete all tasks
        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(12);

        // Verify LLM was called and context was managed
        const state = agent.getState();
        expect(state.metrics.totalLLMCalls).toBeGreaterThan(0);

        console.log('Moderate load test completed:', {
          completedTasks: result.metrics.completedTasks,
          llmCalls: result.metrics.totalLLMCalls,
          toolCalls: result.metrics.totalToolCalls,
        });
      },
      TEST_TIMEOUT
    );
  });
});
