/**
 * Complex Dependencies Mock Tests - Deterministic
 *
 * Uses MockLLMProvider for fast, deterministic testing of complex dependency scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskAgent } from '@/capabilities/taskAgent/TaskAgent.js';
import { createAgentStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import { Connector } from '@/core/Connector.js';
import { createMockConnector, resetMockProviders } from '../../helpers/mockConnector.js';
import { mockMemoryStore, mockMemoryQuery, mockToolResponse, mockTextResponse } from '../../helpers/MockLLMProvider.js';

describe('Complex Dependencies - Mock LLM Tests', () => {
  beforeEach(() => {
    resetMockProviders();
    Connector.clear();
  });

  afterEach(() => {
    resetMockProviders();
    Connector.clear();
  });

  it('should handle diamond pattern: A→B,C; B,C→D', async () => {
    const mockProvider = createMockConnector('test-mock');

    // Queue responses for diamond pattern tasks
    mockProvider.queueResponses([
      // Task: root
      mockToolResponse(mockMemoryStore('root', 'Root complete', 'root complete')),
      mockTextResponse('Root task complete'),

      // Task: branch_left (after root)
      mockToolResponse(mockMemoryStore('left', 'Left complete', 'left complete')),
      mockTextResponse('Left branch complete'),

      // Task: branch_right (after root)
      mockToolResponse(mockMemoryStore('right', 'Right complete', 'right complete')),
      mockTextResponse('Right branch complete'),

      // Task: merge (after both branches)
      mockToolResponse(mockMemoryQuery()),
      mockTextResponse('All keys confirmed: root, left, right'),
    ]);

    const executionOrder: string[] = [];
    const storage = createAgentStorage();
    const agent = TaskAgent.create({
      connector: 'test-mock',
      model: 'mock-model',
      storage,
      hooks: {
        beforeTask: async (task) => {
          executionOrder.push(task.name);
        },
      },
    });

    const handle = await agent.start({
      goal: 'Diamond dependency test',
      tasks: [
        {
          name: 'root',
          description: 'Store "root complete" with key "root"',
        },
        {
          name: 'branch_left',
          description: 'Store "left complete" with key "left"',
          dependsOn: ['root'],
        },
        {
          name: 'branch_right',
          description: 'Store "right complete" with key "right"',
          dependsOn: ['root'],
        },
        {
          name: 'merge',
          description: 'List all memory keys',
          dependsOn: ['branch_left', 'branch_right'],
        },
      ],
    });

    const result = await handle.wait();

    // Verify completion
    expect(result.status).toBe('completed');
    expect(result.metrics.completedTasks).toBe(4);

    // Verify execution order - root must be first, merge must be last
    expect(executionOrder[0]).toBe('root');
    expect(executionOrder[executionOrder.length - 1]).toBe('merge');

    // Verify branches executed after root but before merge
    const rootIndex = executionOrder.indexOf('root');
    const leftIndex = executionOrder.indexOf('branch_left');
    const rightIndex = executionOrder.indexOf('branch_right');
    const mergeIndex = executionOrder.indexOf('merge');

    expect(leftIndex).toBeGreaterThan(rootIndex);
    expect(rightIndex).toBeGreaterThan(rootIndex);
    expect(mergeIndex).toBeGreaterThan(leftIndex);
    expect(mergeIndex).toBeGreaterThan(rightIndex);

    // Verify memory contents
    const memory = agent.getMemory();
    expect(await memory.retrieve('root')).toBe('root complete');
    expect(await memory.retrieve('left')).toBe('left complete');
    expect(await memory.retrieve('right')).toBe('right complete');
  });

  it('should handle failure in one parallel branch', async () => {
    const mockProvider = createMockConnector('test-mock');

    // Queue responses
    mockProvider.queueResponses([
      // Task: root
      mockToolResponse(mockMemoryStore('root', 'Root', 'data')),
      mockTextResponse('Root done'),

      // Task: branch_left (succeeds)
      mockToolResponse(mockMemoryStore('left', 'Left', 'data')),
      mockTextResponse('Left done'),

      // Task: branch_right (will be marked as failed by validator)
      mockToolResponse(mockMemoryStore('right', 'Right', 'bad_data')),
      mockTextResponse('Right done but with error'),
    ]);

    const storage = createAgentStorage();
    const agent = TaskAgent.create({
      connector: 'test-mock',
      model: 'mock-model',
      storage,
      hooks: {
        // Use validateTask hook to fail branch_right
        validateTask: async (task, result, memory) => {
          if (task.name === 'branch_right') {
            return {
              isComplete: false,
              completionScore: 0,
              explanation: 'Simulated failure in branch_right',
              requiresUserApproval: false,
            };
          }
          return {
            isComplete: true,
            completionScore: 100,
            explanation: 'Task completed successfully',
            requiresUserApproval: false,
          };
        },
      },
    });

    const handle = await agent.start({
      goal: 'Test parallel failure',
      tasks: [
        {
          name: 'root',
          description: 'Store root data',
          validation: { mode: 'strict', skipReflection: false }, // Enable strict validation
        },
        {
          name: 'branch_left',
          description: 'Store left data',
          dependsOn: ['root'],
          validation: { mode: 'strict', skipReflection: false },
        },
        {
          name: 'branch_right',
          description: 'Store right data',
          dependsOn: ['root'],
          validation: { mode: 'strict', skipReflection: false },
        },
        {
          name: 'merge',
          description: 'Merge results',
          dependsOn: ['branch_left', 'branch_right'],
          validation: { mode: 'strict', skipReflection: false },
        },
      ],
    });

    const result = await handle.wait();

    // Should fail because branch_right validation failed
    expect(result.status).toBe('failed');

    // Root and left should complete, right should fail
    expect(result.metrics.completedTasks).toBe(2); // root, branch_left
    expect(result.metrics.failedTasks).toBe(1); // branch_right
    // Note: merge task may be skipped or not attempted depending on execution order
    expect(result.metrics.totalTasks).toBe(4);
  });

  it('should skip dependent tasks when parent fails', async () => {
    const mockProvider = createMockConnector('test-mock');

    // Queue responses - parent will fail via validation
    mockProvider.queueResponses([
      // Task: parent (will fail validation)
      mockTextResponse('Parent task attempted'),
    ]);

    const storage = createAgentStorage();
    const agent = TaskAgent.create({
      connector: 'test-mock',
      model: 'mock-model',
      storage,
      hooks: {
        // Use validateTask hook to fail parent task
        validateTask: async (task, result, memory) => {
          if (task.name === 'parent') {
            return {
              isComplete: false,
              completionScore: 0,
              explanation: 'Simulated parent task failure',
              requiresUserApproval: false,
            };
          }
          return {
            isComplete: true,
            completionScore: 100,
            explanation: 'Task completed successfully',
            requiresUserApproval: false,
          };
        },
      },
    });

    const handle = await agent.start({
      goal: 'Test cascading failure',
      tasks: [
        {
          name: 'parent',
          description: 'Parent task that will fail',
          validation: { mode: 'strict', skipReflection: false }, // Enable strict validation
        },
        {
          name: 'child1',
          description: 'Child 1',
          dependsOn: ['parent'],
          validation: { mode: 'strict', skipReflection: false },
        },
        {
          name: 'child2',
          description: 'Child 2',
          dependsOn: ['parent'],
          validation: { mode: 'strict', skipReflection: false },
        },
        {
          name: 'grandchild',
          description: 'Grandchild',
          dependsOn: ['child1', 'child2'],
          validation: { mode: 'strict', skipReflection: false },
        },
      ],
    });

    const result = await handle.wait();

    // Should fail with skipped children
    expect(result.status).toBe('failed');
    expect(result.metrics.failedTasks).toBe(1); // parent task failed
    expect(result.metrics.completedTasks).toBe(0); // no tasks completed
    // Dependent tasks (child1, child2, grandchild) may be skipped or not attempted
    expect(result.metrics.totalTasks).toBe(4);
  });
});
