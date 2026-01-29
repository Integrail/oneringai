/**
 * External Dependencies Integration Tests
 *
 * Tests external dependency handling:
 * - Webhook wait and completion
 * - Polling with timeout
 * - Manual approval tasks
 * - Multiple external dependencies
 * - Timeout handling
 *
 * Requires API keys:
 * - OPENAI_API_KEY (recommended)
 *
 * Run with: npm run test:integration -- tests/integration/taskAgent/ExternalDependencies.integration.test.ts
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

describe('External Dependencies Integration', () => {
  beforeAll(() => {
    if (!HAS_OPENAI_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not found. External dependency tests will be skipped.');
    }
  });

  afterAll(() => {
    Connector.clear();
  });

  beforeEach(() => {
    Connector.clear();
  });

  describeIfOpenAI('Webhook Completion', () => {
    it(
      'should wait for webhook and complete after trigger',
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

        // Track waiting event
        let waitingEmitted = false;
        agent.on('task:waiting', () => {
          waitingEmitted = true;
        });

        const handle = await agent.start({
          goal: 'Test webhook wait',
          tasks: [
            {
              name: 'before_webhook',
              description: 'Say "Preparing for webhook"',
            },
            {
              name: 'webhook_wait',
              description: 'Wait for external webhook',
              dependsOn: ['before_webhook'],
              externalDependency: {
                type: 'webhook',
                webhookId: 'test-webhook-123',
                state: 'waiting',
              },
            },
            {
              name: 'after_webhook',
              description: 'Say "Webhook received"',
              dependsOn: ['webhook_wait'],
            },
          ],
        });

        // Simulate webhook trigger after short delay
        setTimeout(async () => {
          await agent.triggerExternal('test-webhook-123', {
            message: 'Webhook payload received',
            timestamp: Date.now(),
          });
        }, 3000);

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(3);
        expect(waitingEmitted).toBe(true);

        // Verify webhook data was received
        const plan = agent.getPlan();
        const webhookTask = plan.tasks.find((t) => t.name === 'webhook_wait');
        expect(webhookTask?.externalDependency?.state).toBe('received');
        expect(webhookTask?.externalDependency?.receivedData).toBeDefined();
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Manual Approval', () => {
    it(
      'should wait for manual approval and continue',
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
          goal: 'Test manual approval',
          tasks: [
            {
              name: 'generate_report',
              description: 'Say "Report generated"',
            },
            {
              name: 'manual_review',
              description: 'Wait for manual approval',
              dependsOn: ['generate_report'],
              externalDependency: {
                type: 'manual',
                manualDescription: 'Please review the report and approve',
                state: 'waiting',
              },
            },
            {
              name: 'publish',
              description: 'Say "Report published"',
              dependsOn: ['manual_review'],
            },
          ],
        });

        // Get the manual task
        const plan = agent.getPlan();
        const manualTask = plan.tasks.find((t) => t.name === 'manual_review');

        // Simulate manual approval after delay
        setTimeout(async () => {
          await agent.completeTaskManually(manualTask!.id, {
            approved: true,
            reviewer: 'test-user',
            notes: 'Looks good',
          });
          await agent.resume();
        }, 3000);

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(3);

        // Verify approval data
        const updatedTask = agent.getPlan().tasks.find((t) => t.name === 'manual_review');
        expect(updatedTask?.externalDependency?.state).toBe('received');
        expect(updatedTask?.externalDependency?.receivedData).toMatchObject({
          approved: true,
        });
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Polling Dependency', () => {
    it(
      'should handle polling for external state',
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

        let pollingCallCount = 0;
        const pollingFunction = async () => {
          pollingCallCount++;
          // Return success after 2 polls
          return pollingCallCount >= 2 ? { ready: true } : { ready: false };
        };

        const handle = await agent.start({
          goal: 'Test polling',
          tasks: [
            {
              name: 'start_job',
              description: 'Say "Job started"',
            },
            {
              name: 'wait_for_completion',
              description: 'Wait for job completion',
              dependsOn: ['start_job'],
              externalDependency: {
                type: 'polling',
                pollIntervalMs: 2000,
                maxAttempts: 5,
                state: 'waiting',
                pollingFunction,
              },
            },
            {
              name: 'process_results',
              description: 'Say "Results processed"',
              dependsOn: ['wait_for_completion'],
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(pollingCallCount).toBeGreaterThanOrEqual(2);
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Multiple External Dependencies', () => {
    it(
      'should handle multiple webhooks in parallel',
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
          goal: 'Test multiple webhooks',
          tasks: [
            {
              name: 'webhook_a',
              description: 'Wait for webhook A',
              externalDependency: {
                type: 'webhook',
                webhookId: 'webhook-a',
                state: 'waiting',
              },
            },
            {
              name: 'webhook_b',
              description: 'Wait for webhook B',
              externalDependency: {
                type: 'webhook',
                webhookId: 'webhook-b',
                state: 'waiting',
              },
            },
            {
              name: 'combine',
              description: 'Say "Both webhooks received"',
              dependsOn: ['webhook_a', 'webhook_b'],
            },
          ],
          allowParallelExecution: true,
        });

        // Trigger both webhooks
        setTimeout(async () => {
          await agent.triggerExternal('webhook-a', { data: 'A' });
        }, 2000);

        setTimeout(async () => {
          await agent.triggerExternal('webhook-b', { data: 'B' });
        }, 3000);

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(3);
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Timeout Handling', () => {
    it(
      'should timeout polling after max attempts',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        const pollingFunction = async () => {
          // Always return not ready
          return { ready: false };
        };

        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
        });

        const handle = await agent.start({
          goal: 'Test polling timeout',
          tasks: [
            {
              name: 'timeout_test',
              description: 'Will timeout',
              maxAttempts: 1,
              externalDependency: {
                type: 'polling',
                pollIntervalMs: 1000,
                maxAttempts: 2, // Very short for testing
                state: 'waiting',
                pollingFunction,
              },
            },
          ],
        });

        const result = await handle.wait();

        // Should fail due to timeout
        expect(result.status).toBe('failed');

        const plan = agent.getPlan();
        const task = plan.tasks[0];
        expect(task.status).toBe('failed');
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('External Dependency with Task Chain', () => {
    it(
      'should execute task chain with external dependency in middle',
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
          goal: 'Task chain with external dependency',
          tasks: [
            {
              name: 'prepare',
              description: 'Store "prepared" with key "step1" using memory_store',
            },
            {
              name: 'submit',
              description: 'Store "submitted" with key "step2" using memory_store',
              dependsOn: ['prepare'],
            },
            {
              name: 'await_approval',
              description: 'Wait for external approval',
              dependsOn: ['submit'],
              externalDependency: {
                type: 'manual',
                manualDescription: 'Approve submission',
                state: 'waiting',
              },
            },
            {
              name: 'finalize',
              description: 'Store "finalized" with key "step4" using memory_store',
              dependsOn: ['await_approval'],
            },
          ],
        });

        // Approve after delay
        setTimeout(async () => {
          const plan = agent.getPlan();
          const approvalTask = plan.tasks.find((t) => t.name === 'await_approval');
          await agent.completeTaskManually(approvalTask!.id, { approved: true });
          await agent.resume();
        }, 3000);

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(4);

        // Verify all steps executed
        const memory = agent.getMemory();
        const step1 = await memory.retrieve('step1');
        const step2 = await memory.retrieve('step2');
        const step4 = await memory.retrieve('step4');

        expect(step1).toBeDefined();
        expect(step2).toBeDefined();
        expect(step4).toBeDefined();
      },
      TEST_TIMEOUT
    );
  });
});
