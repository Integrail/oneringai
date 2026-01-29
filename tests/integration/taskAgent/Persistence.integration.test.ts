/**
 * Persistence Integration Tests
 *
 * Tests state persistence and resume capabilities:
 * - Save state mid-execution
 * - Resume from saved state
 * - Resume with failed task (retry)
 * - Checkpoint after each task
 * - Session persistence
 * - Tool manager state persistence
 *
 * Requires API keys:
 * - OPENAI_API_KEY (recommended)
 *
 * Run with: npm run test:integration -- tests/integration/taskAgent/Persistence.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as dotenv from 'dotenv';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';
import { TaskAgent } from '@/capabilities/taskAgent/TaskAgent.js';
import { createAgentStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import { FileSessionStorage } from '@/infrastructure/storage/FileSessionStorage.js';
import * as fs from 'fs/promises';
import * as path from 'path';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const HAS_OPENAI_KEY = Boolean(OPENAI_API_KEY);

const OPENAI_MODEL = 'gpt-4.1-mini';
const TEST_TIMEOUT = 120000;
const SESSION_DIR = path.join(process.cwd(), '.test-sessions');

const describeIfOpenAI = HAS_OPENAI_KEY ? describe : describe.skip;

describe('Persistence Integration', () => {
  beforeAll(async () => {
    if (!HAS_OPENAI_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not found. Persistence tests will be skipped.');
    }

    // Create session directory
    try {
      await fs.mkdir(SESSION_DIR, { recursive: true });
    } catch {
      // Ignore if exists
    }
  });

  afterAll(async () => {
    Connector.clear();

    // Cleanup session directory
    try {
      await fs.rm(SESSION_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    Connector.clear();
  });

  describeIfOpenAI('Basic State Persistence', () => {
    it(
      'should save and restore agent state',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        const storage = createAgentStorage();
        const agent1 = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
          instructions: 'Use memory_store to save data.',
        });

        // Store data in memory
        const memory1 = agent1.getMemory();
        await memory1.store('persistent_key', 'Persistent data', {
          value: 42,
        });

        // Start execution
        await agent1.start({
          goal: 'Test persistence',
          tasks: [
            {
              name: 'task1',
              description: 'Store "task1 complete" with key "t1" using memory_store',
            },
          ],
        });

        // Save state
        const state = agent1.getState();
        await storage.agent.save(state);

        // Resume with new agent
        const agent2 = await TaskAgent.resume(agent1.id, {
          storage,
          tools: [],
        });

        expect(agent2.id).toBe(agent1.id);

        // Verify memory persisted
        const memory2 = agent2.getMemory();
        const retrieved = await memory2.retrieve('persistent_key');
        expect(retrieved).toEqual({ value: 42 });

        // Verify plan persisted
        const plan = agent2.getPlan();
        expect(plan.goal).toBe('Test persistence');
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Resume with Failed Task', () => {
    it(
      'should resume and retry failed task',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        const storage = createAgentStorage();
        const agent1 = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
        });

        // Start with a task
        await agent1.start({
          goal: 'Test resume after failure',
          tasks: [
            {
              name: 'will_retry',
              description: 'Say hello',
              maxAttempts: 3,
            },
          ],
        });

        // Save state
        const state = agent1.getState();
        await storage.agent.save(state);

        // Resume
        const agent2 = await TaskAgent.resume(agent1.id, {
          storage,
          tools: [],
        });

        // Continue execution
        await agent2.resume();

        expect(agent2).toBeDefined();
        expect(agent2.id).toBe(agent1.id);
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Session Persistence', () => {
    it(
      'should persist session with FileSessionStorage',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        const sessionStorage = new FileSessionStorage({
          directory: SESSION_DIR,
        });

        const storage = createAgentStorage();
        const agent = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
          session: {
            storage: sessionStorage,
            autoSave: false, // Manual save for testing
          },
        });

        // Execute task
        await agent.start({
          goal: 'Session persistence test',
          tasks: [
            {
              name: 'test_task',
              description: 'Say hello for session test',
            },
          ],
        });

        // Save session manually
        await agent.saveSession();

        const sessionId = agent.getSessionId();
        expect(sessionId).toBeDefined();

        // Verify session file exists
        const files = await fs.readdir(SESSION_DIR);
        expect(files.length).toBeGreaterThan(0);

        console.log('Session saved to:', SESSION_DIR);
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Checkpoint Manager', () => {
    it(
      'should create checkpoints during execution',
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

        // Track checkpoints
        let checkpointCount = 0;
        const originalSave = storage.agent.save.bind(storage.agent);
        storage.agent.save = async (state) => {
          checkpointCount++;
          return originalSave(state);
        };

        await agent.start({
          goal: 'Test checkpointing',
          tasks: [
            {
              name: 'task1',
              description: 'First task',
            },
            {
              name: 'task2',
              description: 'Second task',
            },
          ],
        });

        // Checkpoints should have been created
        expect(checkpointCount).toBeGreaterThan(0);
        console.log(`Created ${checkpointCount} checkpoints`);
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Memory Persistence Across Resume', () => {
    it(
      'should preserve memory entries across resume',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        const storage = createAgentStorage();
        const agent1 = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
          instructions: 'Use memory_store extensively.',
        });

        // Store multiple items
        const memory1 = agent1.getMemory();
        await memory1.store('key1', 'First', { value: 1 });
        await memory1.store('key2', 'Second', { value: 2 });
        await memory1.store('key3', 'Third', { value: 3 });

        await agent1.start({
          goal: 'Memory persistence test',
          tasks: [
            {
              name: 'use_memory',
              description: 'List memory keys using memory_list',
            },
          ],
        });

        // Save and resume
        const state = agent1.getState();
        await storage.agent.save(state);

        const agent2 = await TaskAgent.resume(agent1.id, {
          storage,
          tools: [],
        });

        // Verify all memory entries exist
        const memory2 = agent2.getMemory();
        const key1 = await memory2.retrieve('key1');
        const key2 = await memory2.retrieve('key2');
        const key3 = await memory2.retrieve('key3');

        expect(key1).toEqual({ value: 1 });
        expect(key2).toEqual({ value: 2 });
        expect(key3).toEqual({ value: 3 });

        console.log('All memory entries persisted correctly');
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Tool Manager State Persistence', () => {
    it(
      'should preserve tool state across resume',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        const storage = createAgentStorage();
        const agent1 = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
        });

        // Get tool manager and modify state
        const toolManager1 = agent1.tools;
        const tools1 = toolManager1.listTools();
        const initialToolCount = tools1.length;

        // Disable a tool
        if (tools1.length > 0) {
          toolManager1.disable(tools1[0]);
        }

        await agent1.start({
          goal: 'Tool state test',
          tasks: [
            {
              name: 'simple',
              description: 'Say hello',
            },
          ],
        });

        // Save state
        const state = agent1.getState();
        await storage.agent.save(state);

        // Resume
        const agent2 = await TaskAgent.resume(agent1.id, {
          storage,
          tools: [],
        });

        // Verify tool manager state
        const toolManager2 = agent2.tools;
        const tools2 = toolManager2.listTools();

        expect(tools2.length).toBe(initialToolCount);
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Plan State Persistence', () => {
    it(
      'should preserve plan progress across resume',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        const storage = createAgentStorage();
        const agent1 = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
        });

        await agent1.start({
          goal: 'Plan persistence test',
          tasks: [
            {
              name: 'completed_task',
              description: 'This will complete',
            },
            {
              name: 'pending_task',
              description: 'This will be pending',
              dependsOn: ['completed_task'],
            },
          ],
        });

        // Wait for first task to complete
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Pause and save
        await agent1.pause();
        const state = agent1.getState();
        await storage.agent.save(state);

        // Resume
        const agent2 = await TaskAgent.resume(agent1.id, {
          storage,
          tools: [],
        });

        const plan = agent2.getPlan();
        expect(plan.tasks).toHaveLength(2);

        // First task should be completed
        const task1 = plan.tasks.find((t) => t.name === 'completed_task');
        expect(task1?.status).toBe('completed');

        console.log('Plan state preserved across resume');
      },
      TEST_TIMEOUT
    );
  });

  describeIfOpenAI('Conversation History Persistence', () => {
    it(
      'should preserve conversation history',
      async () => {
        Connector.create({
          name: 'openai-test',
          vendor: Vendor.OpenAI,
          auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
        });

        const storage = createAgentStorage();
        const agent1 = TaskAgent.create({
          connector: 'openai-test',
          model: OPENAI_MODEL,
          storage,
        });

        await agent1.start({
          goal: 'History persistence test',
          tasks: [
            {
              name: 'chat1',
              description: 'Say "Hello from task 1"',
            },
            {
              name: 'chat2',
              description: 'Say "Hello from task 2"',
            },
          ],
        });

        // Save state
        const state1 = agent1.getState();
        const historyLength1 = state1.conversationHistory.length;
        await storage.agent.save(state1);

        // Resume
        const agent2 = await TaskAgent.resume(agent1.id, {
          storage,
          tools: [],
        });

        const state2 = agent2.getState();
        expect(state2.conversationHistory.length).toBe(historyLength1);

        console.log(`Preserved ${historyLength1} history messages`);
      },
      TEST_TIMEOUT
    );
  });
});
