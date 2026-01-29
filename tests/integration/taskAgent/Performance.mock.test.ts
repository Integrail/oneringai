/**
 * Performance Mock Tests - Deterministic
 *
 * Tests performance metrics and calculations without requiring real LLM calls.
 * These test our accounting/metrics code, not LLM behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskAgent } from '@/capabilities/taskAgent/TaskAgent.js';
import { createAgentStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import { Connector } from '@/core/Connector.js';
import { createMockConnector, resetMockProviders } from '../../helpers/mockConnector.js';
import { mockMemoryStore, mockMemoryRetrieve, mockToolResponse, mockTextResponse } from '../../helpers/MockLLMProvider.js';
import { calculateCost, getModelInfo } from '@/domain/entities/Model.js';

describe('Performance - Mock Tests', () => {
  beforeEach(() => {
    resetMockProviders();
    Connector.clear();
  });

  afterEach(() => {
    resetMockProviders();
    Connector.clear();
  });

  it('should track token usage accurately', async () => {
    const mockProvider = createMockConnector('test-mock');

    // Each response returns 100 input + 50 output = 150 total tokens
    mockProvider.queueResponses([
      mockTextResponse('Hello from task 1'),
      mockTextResponse('Hello from task 2'),
    ]);

    const storage = createAgentStorage();
    const agent = TaskAgent.create({
      connector: 'test-mock',
      model: 'mock-model',
      storage,
    });

    const handle = await agent.start({
      goal: 'Test token tracking',
      tasks: [
        { name: 'task1', description: 'Say "Hello from task 1"' },
        { name: 'task2', description: 'Say "Hello from task 2"' },
      ],
    });

    const result = await handle.wait();

    expect(result.status).toBe('completed');

    // Verify token metrics
    const state = agent.getState();
    expect(state.metrics.totalTokensUsed).toBeGreaterThan(0);
    expect(state.metrics.totalLLMCalls).toBe(2); // 2 tasks = 2 LLM calls
  });

  it('should accumulate tokens across multiple tasks', async () => {
    const mockProvider = createMockConnector('test-mock');

    // Queue 5 responses
    mockProvider.queueResponses([
      mockTextResponse('Task 1'),
      mockTextResponse('Task 2'),
      mockTextResponse('Task 3'),
      mockTextResponse('Task 4'),
      mockTextResponse('Task 5'),
    ]);

    const storage = createAgentStorage();
    const agent = TaskAgent.create({
      connector: 'test-mock',
      model: 'mock-model',
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

    // Each task uses 150 tokens, so 5 tasks = 750 tokens
    expect(totalTokens).toBe(750);
    expect(state.metrics.totalLLMCalls).toBe(5);
    expect(result.metrics.completedTasks).toBe(5);
  });

  it('should calculate costs accurately using real model', async () => {
    const mockProvider = createMockConnector('test-mock');

    // Single response
    mockProvider.queueResponses([mockTextResponse('Done')]);

    const storage = createAgentStorage();
    // Use real model from registry for cost calculation
    const agent = TaskAgent.create({
      connector: 'test-mock',
      model: 'gpt-4.1-mini', // Real model from registry
      storage,
    });

    const handle = await agent.start({
      goal: 'Test cost calculation',
      tasks: [{ name: 't1', description: 'Complete task' }],
    });

    const result = await handle.wait();

    expect(result.status).toBe('completed');

    const state = agent.getState();

    // Verify cost was calculated
    expect(state.metrics.totalCost).toBeGreaterThan(0);

    // Verify cost matches calculateCost function
    const expectedCost = calculateCost('gpt-4.1-mini', 100, 50);
    expect(expectedCost).not.toBeNull();
    expect(state.metrics.totalCost).toBe(expectedCost);
  });

  it('should track metrics with memory operations', async () => {
    const mockProvider = createMockConnector('test-mock');

    // Queue responses with memory operations
    mockProvider.queueResponses([
      mockToolResponse(mockMemoryStore('data1', 'First data', 'value1')),
      mockTextResponse('Task 1 complete'),
      mockToolResponse(mockMemoryRetrieve('data1')),
      mockTextResponse('Task 2 complete'),
    ]);

    const storage = createAgentStorage();
    const agent = TaskAgent.create({
      connector: 'test-mock',
      model: 'mock-model',
      storage,
    });

    const handle = await agent.start({
      goal: 'Memory performance',
      tasks: [
        { name: 't1', description: 'Store data' },
        { name: 't2', description: 'Retrieve data', dependsOn: ['t1'] },
      ],
    });

    const result = await handle.wait();

    expect(result.status).toBe('completed');

    const state = agent.getState();

    // Verify metrics tracked correctly
    expect(state.metrics.totalLLMCalls).toBe(2);
    expect(state.metrics.totalTokensUsed).toBeGreaterThan(0);

    // Verify memory operations worked
    const memory = agent.getMemory();
    const stored = await memory.retrieve('data1');
    expect(stored).toBe('value1');
  });

  it('should handle metrics accumulation correctly', async () => {
    const mockProvider = createMockConnector('test-mock');

    // Queue multiple responses
    mockProvider.queueResponses([
      mockTextResponse('Task 1'),
      mockTextResponse('Task 2'),
      mockTextResponse('Task 3'),
    ]);

    const storage = createAgentStorage();
    const agent = TaskAgent.create({
      connector: 'test-mock',
      model: 'mock-model',
      storage,
    });

    const handle = await agent.start({
      goal: 'Test metrics',
      tasks: [
        { name: 't1', description: 'Task 1' },
        { name: 't2', description: 'Task 2' },
        { name: 't3', description: 'Task 3' },
      ],
    });

    const result = await handle.wait();

    // Verify execution metrics
    expect(result.status).toBe('completed');
    expect(result.metrics.completedTasks).toBe(3);
    expect(result.metrics.failedTasks).toBe(0);
    expect(result.metrics.skippedTasks).toBe(0);
    expect(result.metrics.totalTasks).toBe(3);

    // Verify state metrics
    const state = agent.getState();
    expect(state.metrics.totalLLMCalls).toBe(3);
    expect(state.metrics.totalTokensUsed).toBe(450); // 3 * 150 tokens per call
  });
});
