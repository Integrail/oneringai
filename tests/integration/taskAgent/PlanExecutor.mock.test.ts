/**
 * PlanExecutor Mock Tests - Deterministic
 *
 * Uses MockLLMProvider for deterministic, fast testing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskAgent } from '@/capabilities/taskAgent/TaskAgent.js';
import { createAgentStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import { Connector } from '@/core/Connector.js';
import { createMockConnector, resetMockProviders } from '../../helpers/mockConnector.js';
import { mockMemoryStore, mockMemoryRetrieve, mockToolResponse, mockTextResponse } from '../../helpers/MockLLMProvider.js';

describe('PlanExecutor - Mock LLM Tests', () => {
  beforeEach(() => {
    resetMockProviders();
    Connector.clear();
  });

  afterEach(() => {
    resetMockProviders();
    Connector.clear();
  });

  it('should execute task with memory_store tool call', async () => {
    const mockProvider = createMockConnector('test-mock');

    // Queue mock responses
    mockProvider.queueResponses([
      // Response 1: Call memory_store tool
      mockToolResponse(mockMemoryStore('my_data', 'Test data', { value: 42 })),
      // Response 2: Acknowledge completion
      mockTextResponse('Task completed successfully'),
    ]);

    const storage = createAgentStorage();
    const agent = TaskAgent.create({
      connector: 'test-mock',
      model: 'mock-model',
      storage,
    });

    const handle = await agent.start({
      goal: 'Store data in memory',
      tasks: [
        {
          name: 'store_data',
          description: 'Store some data using memory_store',
        },
      ],
    });

    const result = await handle.wait();

    // Verify completion
    expect(result.status).toBe('completed');
    expect(result.metrics.completedTasks).toBe(1);

    // Verify memory was actually stored
    const memory = agent.getMemory();
    const stored = await memory.retrieve('my_data');
    expect(stored).toEqual({ value: 42 });

    // Verify metrics
    const state = agent.getState();
    expect(state.metrics.totalLLMCalls).toBeGreaterThan(0);
    expect(state.metrics.totalTokensUsed).toBeGreaterThan(0);
  });

  it('should execute multiple tasks with dependencies', async () => {
    const mockProvider = createMockConnector('test-mock');

    // Queue responses for 2 tasks
    mockProvider.queueResponses([
      // Task 1: Store data
      mockToolResponse(mockMemoryStore('step1', 'First step', 'done')),
      mockTextResponse('Step 1 complete'),
      // Task 2: Retrieve and use data
      mockToolResponse(mockMemoryRetrieve('step1')),
      mockTextResponse('Retrieved step1, task complete'),
    ]);

    const storage = createAgentStorage();
    const agent = TaskAgent.create({
      connector: 'test-mock',
      model: 'mock-model',
      storage,
    });

    const handle = await agent.start({
      goal: 'Multi-step task',
      tasks: [
        {
          name: 'task1',
          description: 'Store data in step1',
        },
        {
          name: 'task2',
          description: 'Retrieve step1 data',
          dependsOn: ['task1'],
        },
      ],
    });

    const result = await handle.wait();

    expect(result.status).toBe('completed');
    expect(result.metrics.completedTasks).toBe(2);

    // Verify both steps executed
    const memory = agent.getMemory();
    const step1 = await memory.retrieve('step1');
    expect(step1).toBe('done');
  });

  it('should track metrics accurately', async () => {
    const mockProvider = createMockConnector('test-mock');

    mockProvider.queueResponses([
      mockToolResponse(mockMemoryStore('data', 'Test', 123)),
      mockTextResponse('Done'),
    ]);

    const storage = createAgentStorage();
    const agent = TaskAgent.create({
      connector: 'test-mock',
      model: 'mock-model',
      storage,
    });

    await agent.start({
      goal: 'Track metrics',
      tasks: [{ name: 't1', description: 'Store data' }],
    });

    const state = agent.getState();

    // Verify metrics
    expect(state.metrics.totalLLMCalls).toBeGreaterThan(0);
    // Note: totalToolCalls not tracked by PlanExecutor yet
    expect(state.metrics.totalTokensUsed).toBeGreaterThan(0);
    // Note: totalCost will be 0 for mock model (not in registry)
    expect(state.metrics.totalCost).toBeGreaterThanOrEqual(0);
  });
});
