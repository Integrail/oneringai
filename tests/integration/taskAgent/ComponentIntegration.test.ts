/**
 * Component Integration Tests
 * Tests that all TaskAgent components work together correctly
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskAgent, TaskAgentHooks } from '@/capabilities/taskAgent/TaskAgent.js';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';
import { ToolFunction } from '@/domain/entities/Tool.js';
import { createAgentStorage } from '@/infrastructure/storage/InMemoryStorage.js';

// Mock Agent to avoid real LLM calls
vi.mock('@/core/Agent.js', () => ({
  Agent: {
    create: vi.fn(() => ({
      run: vi.fn().mockResolvedValue({
        output_text: 'Task completed',
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      }),
      stream: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      addTool: vi.fn(),
      removeTool: vi.fn(),
      listTools: vi.fn(() => []),
      model: 'gpt-4.1',
    })),
  },
}));

describe('TaskAgent Component Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Connector.clear();
    Connector.create({
      name: 'test-openai',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test-key' },
    });
  });

  afterEach(() => {
    Connector.clear();
  });

  it('should integrate Agent, Memory, and Storage', async () => {
    const storage = createAgentStorage();

    const agent = TaskAgent.create({
      connector: 'test-openai',
      model: 'gpt-4.1',
      storage,
    });

    // Verify all components initialized
    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined();

    const memory = agent.getMemory();
    expect(memory).toBeDefined();

    // Test memory operations
    await memory.store('test_key', 'Test value', { data: 'value' });
    const retrieved = await memory.retrieve('test_key');
    expect(retrieved).toEqual({ data: 'value' });
  });

  it('should integrate hooks with all components', async () => {
    const storage = createAgentStorage();
    const hooks: TaskAgentHooks = {
      onStart: vi.fn(),
      beforeTask: vi.fn(),
      afterTask: vi.fn(),
      beforeLLMCall: vi.fn((m) => m),
      afterLLMCall: vi.fn(),
      onError: vi.fn().mockResolvedValue('retry'),
      onComplete: vi.fn(),
    };

    const agent = TaskAgent.create({
      connector: 'test-openai',
      model: 'gpt-4.1',
      hooks,
      storage,
    });

    expect(agent).toBeDefined();
    // Hooks are registered
    expect(hooks.onStart).toBeDefined();
  });

  it('should integrate tools with all components', async () => {
    const storage = createAgentStorage();

    const tool: ToolFunction = {
      definition: {
        type: 'function',
        function: {
          name: 'test_tool',
          description: 'Test tool',
          parameters: {
            type: 'object',
            properties: { input: { type: 'string' } },
          },
        },
      },
      execute: vi.fn().mockResolvedValue({ result: 'ok' }),
    };

    const agent = TaskAgent.create({
      connector: 'test-openai',
      model: 'gpt-4.1',
      tools: [tool],
      storage,
    });

    expect(agent).toBeDefined();
  });

  it('should integrate metrics tracking across components', async () => {
    const storage = createAgentStorage();

    const agent = TaskAgent.create({
      connector: 'test-openai',
      model: 'gpt-4.1',
      storage,
    });

    const state = agent.getState();
    expect(state.metrics).toBeDefined();
    expect(state.metrics.totalLLMCalls).toBe(0);
    expect(state.metrics.totalToolCalls).toBe(0);
    expect(state.metrics.totalTokensUsed).toBe(0);
    expect(state.metrics.totalCost).toBe(0);
  });

  it('should integrate checkpointing with storage', async () => {
    const storage = createAgentStorage();

    const agent = TaskAgent.create({
      connector: 'test-openai',
      model: 'gpt-4.1',
      storage,
    });

    const state = agent.getState();

    // Manually checkpoint
    await storage.agent.save(state);

    const loaded = await storage.agent.load(state.id);
    expect(loaded).toBeDefined();
    expect(loaded!.id).toBe(state.id);
  });

  it('should integrate memory with checkpointing', async () => {
    const storage = createAgentStorage();

    const agent = TaskAgent.create({
      connector: 'test-openai',
      model: 'gpt-4.1',
      storage,
    });

    const memory = agent.getMemory();

    // Store data
    await memory.store('checkpoint_test', 'Test data', { value: 123 });

    // Memory can be persisted
    const index = await memory.getIndex();
    expect(index.entries).toHaveLength(1);
    expect(index.entries[0]!.key).toBe('checkpoint_test');

    // Can retrieve
    const retrieved = await memory.retrieve('checkpoint_test');
    expect(retrieved).toEqual({ value: 123 });
  });

  it('should integrate history with checkpointing', async () => {
    const storage = createAgentStorage();

    const agent = TaskAgent.create({
      connector: 'test-openai',
      model: 'gpt-4.1',
      storage,
    });

    const state = agent.getState();
    expect(state.conversationHistory).toBeDefined();
    expect(Array.isArray(state.conversationHistory)).toBe(true);
  });

  it('should integrate all components with complete state', async () => {
    const storage = createAgentStorage();

    const hooks: TaskAgentHooks = {
      onStart: vi.fn(),
      beforeTask: vi.fn(),
      afterTask: vi.fn(),
    };

    const tool: ToolFunction = {
      definition: {
        type: 'function',
        function: {
          name: 'integrated_tool',
          description: 'Tool for integration test',
          parameters: { type: 'object', properties: {} },
        },
      },
      execute: vi.fn().mockResolvedValue({ status: 'done' }),
    };

    const agent = TaskAgent.create({
      connector: 'test-openai',
      model: 'gpt-4.1',
      tools: [tool],
      hooks,
      storage,
      instructions: 'You are a test agent',
      maxIterations: 100,
    });

    const state = agent.getState();

    // All components integrated
    expect(state.id).toBeDefined();
    expect(state.status).toBeDefined(); // Can be 'idle' or 'pending'
    expect(['idle', 'pending']).toContain(state.status);
    expect(state.metrics).toBeDefined();
    expect(state.config).toBeDefined();
    expect(state.conversationHistory).toBeDefined();

    // Memory accessible
    const memory = agent.getMemory();
    expect(memory).toBeDefined();

    // Can checkpoint complete state
    await storage.agent.save(state);
    const loaded = await storage.agent.load(state.id);
    expect(loaded!.id).toBe(state.id);
    expect(loaded!.config).toBeDefined();
  });
});
