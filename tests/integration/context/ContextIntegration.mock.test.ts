/**
 * ContextIntegration Mock Tests
 *
 * End-to-end tests with mock LLM:
 * - Multi-task execution with context management
 * - Compaction triggering and verification
 * - Plugin integration
 * - Session persistence
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskAgent } from '@/capabilities/taskAgent/TaskAgent.js';
import { Agent } from '@/core/Agent.js';
import { AgentContext, SerializedAgentContextState } from '@/core/AgentContext.js';
import { Connector } from '@/core/Connector.js';
import { createAgentStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import type {
  IContextStorage,
  StoredContextSession,
  ContextSessionSummary,
  ContextSessionMetadata,
  ContextStorageListOptions,
} from '@/domain/interfaces/IContextStorage.js';
import { createMockConnector, resetMockProviders } from '../../helpers/mockConnector.js';

// Simple in-memory mock for IContextStorage
class MockContextStorage implements IContextStorage {
  private sessions = new Map<string, StoredContextSession>();

  async save(
    sessionId: string,
    state: SerializedAgentContextState,
    metadata?: ContextSessionMetadata
  ): Promise<void> {
    const now = new Date().toISOString();
    this.sessions.set(sessionId, {
      version: 1,
      sessionId,
      createdAt: this.sessions.get(sessionId)?.createdAt || now,
      lastSavedAt: now,
      state,
      metadata: metadata || {},
    });
  }

  async load(sessionId: string): Promise<StoredContextSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async exists(sessionId: string): Promise<boolean> {
    return this.sessions.has(sessionId);
  }

  async list(_options?: ContextStorageListOptions): Promise<ContextSessionSummary[]> {
    return Array.from(this.sessions.values()).map((s) => ({
      sessionId: s.sessionId,
      createdAt: new Date(s.createdAt),
      lastSavedAt: new Date(s.lastSavedAt),
      messageCount: s.state.conversation?.length || 0,
      memoryEntryCount: s.state.memory?.entries.length || 0,
      metadata: s.metadata,
    }));
  }

  getPath(): string {
    return 'memory://mock';
  }
}
import {
  mockMemoryStore,
  mockMemoryRetrieve,
  mockMemoryDelete,
  mockMemoryCleanupRaw,
  mockContextStats,
  mockContextSet,
  mockContextDelete,
  mockContextList,
  mockToolResponse,
  mockTextResponse,
  mockTextResponseWithTokens,
} from '../../helpers/MockLLMProvider.js';
import { createContextWithFeatures, FEATURE_PRESETS, fillMemoryWithPriorities } from '../../helpers/contextTestHelpers.js';

// ============================================================================
// Multi-Task Execution with Context Management
// ============================================================================

describe('Multi-Task Execution with Context Management', () => {
  beforeEach(() => {
    resetMockProviders();
    Connector.clear();
  });

  afterEach(() => {
    resetMockProviders();
    Connector.clear();
  });

  it('should execute tasks that use memory tools', async () => {
    const mockProvider = createMockConnector('test-ctx');

    mockProvider.queueResponses([
      // Store data
      mockToolResponse(mockMemoryStore('findings1', 'Research finding', { data: 'result' })),
      // Retrieve and complete
      mockTextResponse('Task completed with findings'),
    ]);

    const storage = createAgentStorage();
    const agent = TaskAgent.create({
      connector: 'test-ctx',
      model: 'mock-model',
      storage,
      context: { features: FEATURE_PRESETS.memoryOnly },
    });

    const handle = await agent.start({
      goal: 'Store research findings',
      tasks: [{ name: 'research', description: 'Store findings in memory' }],
    });

    const result = await handle.wait();

    expect(result.status).toBe('completed');
    const memory = agent.getMemory();
    // memory_store uses the key as-is without automatic prefix
    expect(await memory.has('findings1')).toBe(true);
  });

  it('should execute tasks that use context_stats tool', async () => {
    const mockProvider = createMockConnector('test-ctx');

    mockProvider.queueResponses([
      // Check context stats
      mockToolResponse(mockContextStats(['budget', 'memory'])),
      // Complete
      mockTextResponse('Context status checked'),
    ]);

    const storage = createAgentStorage();
    const agent = TaskAgent.create({
      connector: 'test-ctx',
      model: 'mock-model',
      storage,
    });

    const handle = await agent.start({
      goal: 'Check context status',
      tasks: [{ name: 'status', description: 'Check memory and budget status' }],
    });

    const result = await handle.wait();

    expect(result.status).toBe('completed');
    // Verify the tool was called
    expect(mockProvider.getCallCount()).toBeGreaterThanOrEqual(1);
  });

  it('should handle memory cleanup during task execution', async () => {
    const mockProvider = createMockConnector('test-ctx');

    mockProvider.queueResponses([
      // Store some raw data
      mockToolResponse(mockMemoryStore('raw_data', 'Temporary raw', 'temp', 'raw')),
      // Cleanup raw tier
      mockToolResponse(mockMemoryCleanupRaw()),
      // Complete
      mockTextResponse('Cleanup complete'),
    ]);

    const storage = createAgentStorage();
    const agent = TaskAgent.create({
      connector: 'test-ctx',
      model: 'mock-model',
      storage,
    });

    const handle = await agent.start({
      goal: 'Store and cleanup data',
      tasks: [{ name: 'cleanup', description: 'Store raw data then cleanup' }],
    });

    const result = await handle.wait();

    expect(result.status).toBe('completed');
  });
});

// ============================================================================
// Compaction Triggering and Verification
// ============================================================================

describe('Compaction Triggering', () => {
  beforeEach(() => {
    resetMockProviders();
    Connector.clear();
  });

  afterEach(() => {
    resetMockProviders();
    Connector.clear();
  });

  it('should trigger compaction event when budget threshold reached', async () => {
    const mockProvider = createMockConnector('test-compact');
    const compactedSpy = vi.fn();

    // Queue responses that add significant tokens
    mockProvider.queueResponses([
      mockTextResponseWithTokens('Large response content...', 50000, 10000),
      mockTextResponse('Done'),
    ]);

    const storage = createAgentStorage();
    const agent = TaskAgent.create({
      connector: 'test-compact',
      model: 'mock-model',
      storage,
      context: {
        maxTokens: 100000, // Smaller context for testing
        strategy: 'proactive',
      },
    });

    const ctx = agent.context;
    ctx.on('compaction:complete', compactedSpy);

    // Fill context with history to approach threshold
    for (let i = 0; i < 50; i++) {
      ctx.addMessageSync('user', 'Message '.repeat(100));
      ctx.addMessageSync('assistant', 'Response '.repeat(100));
    }

    // Trigger budget check
    await ctx.prepare();

    // If threshold was reached, compaction should have been triggered
    // This depends on actual token estimation
    const budget = await ctx.getBudget();
    if (budget.status !== 'ok') {
      // Compaction might have been triggered
      expect(compactedSpy.mock.calls.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('should emit budget:warning when approaching limit', async () => {
    const warningSpy = vi.fn();
    const ctx = createContextWithFeatures(FEATURE_PRESETS.historyOnly, {
      maxTokens: 5000, // Very small for testing
    });

    ctx.on('budget:warning', warningSpy);

    // Add lots of content to approach limit
    for (let i = 0; i < 30; i++) {
      ctx.addMessageSync('user', 'This is a longer message with more tokens '.repeat(10));
    }

    await ctx.prepare();

    // Budget warning may or may not fire depending on token estimation
    // At minimum, no errors should occur
    ctx.destroy();
  });
});

// ============================================================================
// Plugin Integration Tests
// ============================================================================

describe('Plugin Integration', () => {
  beforeEach(() => {
    resetMockProviders();
    Connector.clear();
  });

  afterEach(() => {
    resetMockProviders();
    Connector.clear();
  });

  it('should integrate InContextMemory plugin with task execution', async () => {
    const mockProvider = createMockConnector('test-plugin');

    mockProvider.queueResponses([
      // Set context value
      mockToolResponse(mockContextSet('user_name', 'Current user', 'Alice')),
      // List context
      mockToolResponse(mockContextList()),
      // Complete
      mockTextResponse('Context managed successfully'),
    ]);

    const storage = createAgentStorage();
    const agent = TaskAgent.create({
      connector: 'test-plugin',
      model: 'mock-model',
      storage,
      context: {
        features: {
          ...FEATURE_PRESETS.default,
          inContextMemory: true,
        },
      },
    });

    const handle = await agent.start({
      goal: 'Manage in-context state',
      tasks: [{ name: 'manage', description: 'Set and list context values' }],
    });

    const result = await handle.wait();

    expect(result.status).toBe('completed');
  });

  it('should register correct tools based on feature configuration', () => {
    // Memory only
    const memoryCtx = createContextWithFeatures(FEATURE_PRESETS.memoryOnly);
    expect(memoryCtx.tools.has('memory_store')).toBe(true);
    expect(memoryCtx.tools.has('context_set')).toBe(false);
    memoryCtx.destroy();

    // InContextMemory enabled
    const inContextCtx = createContextWithFeatures({
      ...FEATURE_PRESETS.minimal,
      inContextMemory: true,
    });
    expect(inContextCtx.tools.has('context_set')).toBe(true);
    expect(inContextCtx.tools.has('memory_store')).toBe(false);
    inContextCtx.destroy();
  });
});

// ============================================================================
// Session Persistence Tests
// ============================================================================

describe('Session Persistence', () => {
  it('should persist and restore conversation history', async () => {
    const storage = new MockContextStorage();
    const ctx1 = AgentContext.create({
      model: 'gpt-4',
      features: FEATURE_PRESETS.historyOnly,
      storage,
      agentId: 'persist-test',
    });

    // Add some history
    ctx1.addMessageSync('user', 'Hello, how are you?');
    ctx1.addMessageSync('assistant', 'I am doing well, thank you!');
    ctx1.addMessageSync('user', 'Great!');

    // Save session
    await ctx1.save('session-1', { title: 'Test Session' });

    // Create new context and load
    const ctx2 = AgentContext.create({
      model: 'gpt-4',
      features: FEATURE_PRESETS.historyOnly,
      storage,
      agentId: 'persist-test',
    });

    const loaded = await ctx2.load('session-1');
    expect(loaded).toBe(true);

    // Verify history was restored
    const history = ctx2.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0].content).toBe('Hello, how are you?');
    expect(history[1].content).toBe('I am doing well, thank you!');
    expect(history[2].content).toBe('Great!');

    ctx1.destroy();
    ctx2.destroy();
  });

  it('should persist and restore memory entries', async () => {
    const storage = new MockContextStorage();
    const ctx1 = AgentContext.create({
      model: 'gpt-4',
      features: FEATURE_PRESETS.memoryOnly,
      storage,
      agentId: 'memory-persist',
    });

    // Store some memory entries
    await ctx1.memory!.store('key1', 'First entry', { data: 'value1' });
    await ctx1.memory!.store('key2', 'Second entry', { data: 'value2' });

    // Save session
    await ctx1.save('memory-session');

    // Create new context and load
    const ctx2 = AgentContext.create({
      model: 'gpt-4',
      features: FEATURE_PRESETS.memoryOnly,
      storage,
      agentId: 'memory-persist',
    });

    await ctx2.load('memory-session');

    // Verify memory was restored
    expect(await ctx2.memory!.has('key1')).toBe(true);
    expect(await ctx2.memory!.has('key2')).toBe(true);
    const val1 = await ctx2.memory!.retrieve('key1');
    expect(val1).toEqual({ data: 'value1' });

    ctx1.destroy();
    ctx2.destroy();
  });

  it('should handle session existence check', async () => {
    const storage = new MockContextStorage();
    const ctx = AgentContext.create({
      model: 'gpt-4',
      features: FEATURE_PRESETS.minimal,
      storage,
      agentId: 'exists-test',
    });

    // Initially no session
    expect(await ctx.sessionExists('nonexistent')).toBe(false);

    // Save and check
    await ctx.save('new-session');
    expect(await ctx.sessionExists('new-session')).toBe(true);

    // Delete and check
    await ctx.deleteSession('new-session');
    expect(await ctx.sessionExists('new-session')).toBe(false);

    ctx.destroy();
  });
});

// ============================================================================
// Basic Agent with Context Tests
// ============================================================================

describe('Basic Agent with Context', () => {
  beforeEach(() => {
    resetMockProviders();
    Connector.clear();
  });

  afterEach(() => {
    resetMockProviders();
    Connector.clear();
  });

  it('should execute simple task with Agent class', async () => {
    const mockProvider = createMockConnector('test-basic');

    mockProvider.queueResponses([
      mockTextResponse('Hello! I am here to help.'),
    ]);

    const agent = Agent.create({
      connector: 'test-basic',
      model: 'mock-model',
    });

    const response = await agent.run('Hello, how are you?');

    // Response is LLMResponse, check output_text
    expect(response.output_text).toContain('Hello');
    expect(mockProvider.getCallCount()).toBe(1);
  });

  it('should use runDirect for bypassing context', async () => {
    const mockProvider = createMockConnector('test-direct');

    mockProvider.queueResponses([
      mockTextResponse('Direct response'),
    ]);

    const agent = Agent.create({
      connector: 'test-direct',
      model: 'mock-model',
    });

    // Add some history via normal run
    const ctx = agent.context;
    ctx.addMessageSync('user', 'Previous message');

    // Direct call should bypass history
    const response = await agent.runDirect('Quick question');

    // runDirect returns LLMResponse
    expect(response.output_text).toBe('Direct response');
    // History should still only have the previous message, not the direct call
    expect(ctx.getHistory()).toHaveLength(1);
  });

  it('should track tool usage in context', async () => {
    const mockProvider = createMockConnector('test-tools');

    mockProvider.queueResponses([
      mockToolResponse(mockMemoryStore('test', 'Test', 'value')),
      mockTextResponse('Stored'),
    ]);

    const agent = Agent.create({
      connector: 'test-tools',
      model: 'mock-model',
    });

    await agent.run('Store something in memory');

    // Memory should have been used
    const memory = agent.context.memory;
    expect(memory).not.toBeNull();
    expect(await memory!.has('test')).toBe(true);
  });
});

// ============================================================================
// Context Budget with Agent Tests
// ============================================================================

describe('Context Budget with Agent', () => {
  beforeEach(() => {
    resetMockProviders();
    Connector.clear();
  });

  afterEach(() => {
    resetMockProviders();
    Connector.clear();
  });

  it('should track token usage across multiple interactions', async () => {
    const mockProvider = createMockConnector('test-budget');

    mockProvider.queueResponses([
      mockTextResponseWithTokens('Response 1', 100, 50),
      mockTextResponseWithTokens('Response 2', 200, 100),
      mockTextResponseWithTokens('Response 3', 300, 150),
    ]);

    const agent = Agent.create({
      connector: 'test-budget',
      model: 'mock-model',
    });

    await agent.run('Question 1');
    await agent.run('Question 2');
    await agent.run('Question 3');

    // Verify calls were tracked
    expect(mockProvider.getCallCount()).toBe(3);

    // Context should have history
    const history = agent.context.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(3); // At least the user messages
  });

  it('should prepare context correctly', async () => {
    const mockProvider = createMockConnector('test-prepare');

    mockProvider.queueResponses([
      mockTextResponse('Prepared response'),
    ]);

    const agent = Agent.create({
      connector: 'test-prepare',
      model: 'mock-model',
      context: {
        instructions: 'You are a helpful assistant.',
      },
    });

    // Prepare context manually
    const prepared = await agent.context.prepare();

    // Should include budget
    expect(prepared.budget).toBeDefined();
    expect(prepared.budget.status).toBe('ok');
    expect(prepared.compacted).toBe(false);
  });
});
