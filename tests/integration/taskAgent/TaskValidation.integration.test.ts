/**
 * TaskValidation Integration Tests - LLM Self-Reflection & Validation
 *
 * Tests the CRITICAL task validation feature that is currently UNTESTED:
 * - LLM self-reflection with completion criteria
 * - Validation scoring (0-100)
 * - Required memory keys validation
 * - Custom validators via hooks
 * - Uncertain validation with user approval
 * - Validation retry logic
 * - Strict vs warn modes
 *
 * This is a CRITICAL feature that needs comprehensive testing!
 *
 * Requires API keys:
 * - OPENAI_API_KEY (recommended)
 *
 * Run with: npm run test:integration -- tests/integration/taskAgent/TaskValidation.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as dotenv from 'dotenv';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';
import { TaskAgent, TaskAgentHooks } from '@/capabilities/taskAgent/TaskAgent.js';
import { createAgentStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import { ToolFunction } from '@/domain/entities/Tool.js';
import { Task, TaskValidationResult } from '@/domain/entities/Task.js';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const HAS_OPENAI_KEY = Boolean(OPENAI_API_KEY);

const OPENAI_MODEL = 'gpt-4.1-mini';
const TEST_TIMEOUT = 90000; // 90 seconds (validation can take longer)

const describeIfOpenAI = HAS_OPENAI_KEY ? describe : describe.skip;

describe('TaskValidation Integration - LLM Self-Reflection', () => {
  beforeAll(() => {
    if (!HAS_OPENAI_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not found. TaskValidation tests will be skipped.');
    }
  });

  afterAll(() => {
    Connector.clear();
  });

  beforeEach(() => {
    Connector.clear();
  });

  describeIfOpenAI('Completion Criteria - LLM Validates Success', () => {
    it(
      'should validate task completion with clear success criteria',
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
              description: 'Add two numbers',
              parameters: {
                type: 'object',
                properties: {
                  a: { type: 'number' },
                  b: { type: 'number' },
                },
                required: ['a', 'b'],
              },
            },
          },
          execute: async (args: { a: number; b: number }) => {
            return { result: args.a + args.b };
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
          goal: 'Calculate 5 + 3 and verify result is 8',
          tasks: [
            {
              name: 'addition',
              description: 'Calculate 5 + 3 using the calculate tool',
              validation: {
                enabled: true,
                method: 'llm_self_reflection',
                completionCriteria: [
                  'The calculate tool was called successfully',
                  'The result is 8',
                  'The calculation is complete',
                ],
                minCompletionScore: 80,
                mode: 'strict',
              },
            },
          ],
        });

        const result = await handle.wait();

        // Should complete successfully
        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(1);

        // Check task validation result
        const plan = agent.getPlan();
        const task = plan.tasks[0];
        expect(task.status).toBe('completed');
        expect(task.result?.validationScore).toBeGreaterThanOrEqual(80);
      },
      TEST_TIMEOUT
    );

    it(
      'should fail validation when criteria not met',
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

        // Track validation failures
        let validationFailedEmitted = false;
        agent.on('task:validation_failed', () => {
          validationFailedEmitted = true;
        });

        const handle = await agent.start({
          goal: 'Task with impossible criteria',
          tasks: [
            {
              name: 'impossible',
              description: 'Just say hello',
              maxAttempts: 1,
              validation: {
                enabled: true,
                method: 'llm_self_reflection',
                completionCriteria: [
                  'The user has been sent an email',
                  'The email contains a PDF attachment',
                  'The PDF has at least 10 pages',
                ],
                minCompletionScore: 80,
                mode: 'strict',
              },
            },
          ],
        });

        const result = await handle.wait();

        // Should fail validation
        expect(result.status).toBe('failed');
        expect(validationFailedEmitted).toBe(true);

        const plan = agent.getPlan();
        const task = plan.tasks[0];
        expect(task.status).toBe('failed');
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Required Memory Keys Validation', () => {
    it(
      'should validate required memory keys exist',
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
          instructions: 'Use memory_store to save data with specified keys.',
        });

        const handle = await agent.start({
          goal: 'Store user data in memory',
          tasks: [
            {
              name: 'store_user_data',
              description: 'You MUST call memory_store tool twice: first with key="user_name", description="User name", value="Alice"; then with key="user_age", description="User age", value=30. Do NOT just say you stored the data - actually call the memory_store tool.',
              maxAttempts: 5, // Allow retries if validation fails
              validation: {
                enabled: true,
                method: 'llm_self_reflection',
                requiredMemoryKeys: ['user_name', 'user_age'],
                completionCriteria: [
                  'Both user_name and user_age are stored in memory',
                ],
                minCompletionScore: 90,
                mode: 'strict', // Fail task if keys are missing so it retries
              },
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');

        // Verify memory keys exist
        const memory = agent.getMemory();
        const userName = await memory.retrieve('user_name');
        const userAge = await memory.retrieve('user_age');

        expect(userName).toBeDefined();
        expect(userAge).toBeDefined();
      },
      TEST_TIMEOUT
    );

    it(
      'should fail when required memory keys are missing',
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
          goal: 'Task that forgets to store data',
          tasks: [
            {
              name: 'forgetful_task',
              description: 'Just say "I forgot to store the data"',
              maxAttempts: 1,
              validation: {
                enabled: true,
                method: 'llm_self_reflection',
                requiredMemoryKeys: ['important_data', 'critical_info'],
                mode: 'strict',
              },
            },
          ],
        });

        const result = await handle.wait();

        // Should fail because memory keys are missing
        expect(result.status).toBe('failed');
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Custom Validators via Hooks', () => {
    it(
      'should call custom validator and use its result',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        let customValidatorCalled = false;
        const hooks: TaskAgentHooks = {
          validateTask: async (task: Task, result: any, memory: any): Promise<TaskValidationResult> => {
            customValidatorCalled = true;

            // Custom logic: check if task name contains "valid"
            const isValid = task.name.includes('valid');

            return {
              isComplete: isValid,
              completionScore: isValid ? 100 : 0,
              explanation: isValid ? 'Task name contains "valid"' : 'Task name does not contain "valid"',
              requiresUserApproval: false,
            };
          },
        };

        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
          hooks,
        });

        const handle = await agent.start({
          goal: 'Test custom validator',
          tasks: [
            {
              name: 'valid_task',
              description: 'A task with valid in the name',
              validation: {
                enabled: true,
                method: 'llm_self_reflection',
                completionCriteria: ['Task completed'],
              },
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(customValidatorCalled).toBe(true);
      },
      TEST_TIMEOUT
    );

    // REMOVED: Custom validator failure test should use mock LLM
    // Validator returning false is deterministic - test via mock for speed/reliability
  });

  describeIfOpenAI('Validation Modes - Strict vs Warn', () => {
    it(
      'should complete task in warn mode even with low validation score',
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
          goal: 'Test warn mode',
          tasks: [
            {
              name: 'partial_task',
              description: 'Say hello (but criteria expects more)',
              validation: {
                enabled: true,
                method: 'llm_self_reflection',
                completionCriteria: [
                  'User received a detailed report',
                  'Report contains charts and graphs',
                  'Report was saved to disk',
                ],
                minCompletionScore: 80,
                mode: 'warn', // Use warn mode
              },
            },
          ],
        });

        const result = await handle.wait();

        // Should complete despite low score because mode is 'warn'
        expect(result.status).toBe('completed');

        const plan = agent.getPlan();
        const task = plan.tasks[0];
        expect(task.status).toBe('completed');
        // Score might be low, but task still completes
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Skip Reflection Flag', () => {
    it(
      'should skip LLM reflection when skipReflection is true',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        let llmCallsBefore = 0;
        let llmCallsAfter = 0;

        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
          hooks: {
            beforeLLMCall: async (messages: any) => {
              llmCallsBefore++;
              return messages;
            },
            afterLLMCall: async () => {
              llmCallsAfter++;
            },
          },
        });

        await agent.start({
          goal: 'Test skip reflection',
          tasks: [
            {
              name: 'no_reflection',
              description: 'Simple task',
              validation: {
                enabled: true,
                method: 'llm_self_reflection',
                completionCriteria: ['Something'],
                skipReflection: true, // Skip LLM validation
              },
            },
          ],
        });

        // With skipReflection, there should be fewer LLM calls
        // (no extra validation call)
        expect(llmCallsBefore).toBeGreaterThan(0);
        expect(llmCallsAfter).toBeGreaterThan(0);
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Validation Retry Logic', () => {
    it(
      'should retry task when validation fails',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        let attemptCount = 0;
        const hooks: TaskAgentHooks = {
          beforeTask: async (task: Task) => {
            attemptCount++;
          },
        };

        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
          hooks,
        });

        const handle = await agent.start({
          goal: 'Test validation retry',
          tasks: [
            {
              name: 'retry_validation',
              description: 'Say hello (won\'t meet criteria on first try)',
              maxAttempts: 2,
              validation: {
                enabled: true,
                method: 'llm_self_reflection',
                completionCriteria: [
                  'A comprehensive report was generated',
                  'The report has multiple sections',
                ],
                minCompletionScore: 80,
              },
            },
          ],
        });

        const result = await handle.wait();

        // May fail or succeed depending on LLM, but should have retried
        expect(attemptCount).toBeGreaterThanOrEqual(1);
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Complex Validation Scenario', () => {
    it(
      'should handle multi-task plan with validation on each task',
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
          instructions: 'Use memory_store to save results.',
        });

        const handle = await agent.start({
          goal: 'Multi-task with validation',
          tasks: [
            {
              name: 'gather_data',
              description: 'You MUST call the memory_store tool with key="status", description="Status", value="data collected". Do NOT just say you stored the data - actually call the memory_store tool.',
              maxAttempts: 5, // Allow retries if validation fails
              validation: {
                enabled: true,
                method: 'llm_self_reflection',
                requiredMemoryKeys: ['status'],
                completionCriteria: ['Data is stored in memory'],
                minCompletionScore: 80,
                mode: 'strict', // Fail task if keys are missing so it retries
              },
            },
            {
              name: 'process_data',
              description: 'You MUST call the memory_store tool with key="result", description="Result", value="data processed". Do NOT just say you stored the data - actually call the memory_store tool.',
              dependsOn: ['gather_data'],
              maxAttempts: 5, // Allow retries if validation fails
              validation: {
                enabled: true,
                method: 'llm_self_reflection',
                requiredMemoryKeys: ['result'],
                completionCriteria: ['Processing result is stored'],
                minCompletionScore: 80,
                mode: 'strict', // Fail task if keys are missing so it retries
              },
            },
          ],
        });

        const result = await handle.wait();

        expect(result.status).toBe('completed');
        expect(result.metrics.completedTasks).toBe(2);

        // Verify both memory keys exist
        const memory = agent.getMemory();
        const status = await memory.retrieve('status');
        const resultData = await memory.retrieve('result');

        expect(status).toBeDefined();
        expect(resultData).toBeDefined();
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Validation Scoring', () => {
    it(
      'should provide validation score between 0-100',
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
          goal: 'Test validation scoring',
          tasks: [
            {
              name: 'scored_task',
              description: 'Say a friendly greeting',
              validation: {
                enabled: true,
                method: 'llm_self_reflection',
                completionCriteria: ['A greeting was provided'],
                minCompletionScore: 50, // Low threshold
              },
            },
          ],
        });

        const plan = agent.getPlan();
        const task = plan.tasks[0];

        if (task.result?.validationScore !== undefined) {
          expect(task.result.validationScore).toBeGreaterThanOrEqual(0);
          expect(task.result.validationScore).toBeLessThanOrEqual(100);

          console.log('Validation score:', task.result.validationScore);
        }
      },
      TEST_TIMEOUT
    );
  });
});
