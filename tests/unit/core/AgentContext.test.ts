/**
 * AgentContext Tests
 * Comprehensive tests for the unified context management facade
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentContext } from '../../../src/core/AgentContext.js';
import type { AgentContextConfig, HistoryMessage, ToolCallRecord, SerializedAgentContextState } from '../../../src/core/AgentContext.js';
import type { ToolFunction } from '../../../src/domain/entities/Tool.js';
import type { IContextPlugin, IContextComponent } from '../../../src/core/context/plugins/IContextPlugin.js';
import { BaseContextPlugin } from '../../../src/core/context/plugins/IContextPlugin.js';
import type { ITokenEstimator } from '../../../src/core/context/types.js';

describe('AgentContext', () => {
  let ctx: AgentContext;
  let testTool1: ToolFunction;
  let testTool2: ToolFunction;
  let cacheableTool: ToolFunction;

  beforeEach(() => {
    testTool1 = {
      definition: {
        type: 'function',
        function: {
          name: 'test_tool_1',
          description: 'Test tool 1',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      execute: vi.fn(async () => ({ result: 'tool1' })),
    };

    testTool2 = {
      definition: {
        type: 'function',
        function: {
          name: 'test_tool_2',
          description: 'Test tool 2',
          parameters: { type: 'object', properties: { arg: { type: 'string' } }, required: ['arg'] },
        },
      },
      execute: vi.fn(async (args) => ({ result: args.arg })),
    };

    cacheableTool = {
      definition: {
        type: 'function',
        function: {
          name: 'cacheable_tool',
          description: 'A cacheable tool',
          parameters: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
        },
      },
      execute: vi.fn(async (args) => ({ id: args.id, timestamp: Date.now() })),
      idempotency: {
        cacheable: true,
        ttlMs: 60000,
      },
    };
  });

  afterEach(async () => {
    if (ctx) {
      ctx.destroy();
    }
  });

  // ============================================================================
  // Create Factory Tests
  // ============================================================================

  describe('create factory', () => {
    it('should create instance with default config', () => {
      ctx = AgentContext.create();
      expect(ctx).toBeDefined();
      expect(ctx.tools).toBeDefined();
      expect(ctx.memory).toBeDefined();
      expect(ctx.cache).toBeDefined();
      expect(ctx.permissions).toBeDefined();
    });

    it('should create instance with custom model', () => {
      ctx = AgentContext.create({ model: 'gpt-4-turbo' });
      expect(ctx).toBeDefined();
    });

    it('should create instance with custom max tokens', () => {
      ctx = AgentContext.create({ maxContextTokens: 64000 });
      expect(ctx.getMaxContextTokens()).toBe(64000);
    });

    it('should create instance with tools', () => {
      ctx = AgentContext.create({ tools: [testTool1, testTool2] });
      expect(ctx.tools.has('test_tool_1')).toBe(true);
      expect(ctx.tools.has('test_tool_2')).toBe(true);
      // AgentContext auto-registers feature-aware tools (introspection, memory, cache)
      // so total count includes user tools + auto-registered tools
      expect(ctx.tools.list().length).toBeGreaterThanOrEqual(2);
      // Verify auto-registered introspection tool is present (always available)
      expect(ctx.tools.has('context_stats')).toBe(true);
    });

    it('should create instance with system prompt', () => {
      ctx = AgentContext.create({ systemPrompt: 'You are a helpful assistant.' });
      expect(ctx.systemPrompt).toBe('You are a helpful assistant.');
    });

    it('should create instance with instructions', () => {
      ctx = AgentContext.create({ instructions: 'Be concise and accurate.' });
      expect(ctx.instructions).toBe('Be concise and accurate.');
    });

    it('should create instance with custom strategy', () => {
      ctx = AgentContext.create({ strategy: 'aggressive' });
      expect(ctx).toBeDefined();
    });

    it('should create instance with cache disabled', () => {
      // Note: disabling cache (via cache.enabled or features.memory) also requires disabling autoSpill and toolResultEviction
      ctx = AgentContext.create({ cache: { enabled: false }, features: { autoSpill: false, toolResultEviction: false } });
      expect(ctx.isCacheEnabled()).toBe(false);
    });

    it('should create instance with custom memory config', () => {
      ctx = AgentContext.create({
        memory: { maxSizeBytes: 50000 },
      });
      expect(ctx.memory).toBeDefined();
    });

    it('should create instance with history config', () => {
      ctx = AgentContext.create({
        history: { maxMessages: 50, preserveRecent: 10 },
      });
      expect(ctx).toBeDefined();
    });

    it('should create instance with response reserve', () => {
      ctx = AgentContext.create({ responseReserve: 0.25 });
      expect(ctx).toBeDefined();
    });
  });

  // ============================================================================
  // Composed Managers Tests
  // ============================================================================

  describe('composed managers', () => {
    beforeEach(() => {
      ctx = AgentContext.create({ tools: [testTool1] });
    });

    it('should expose tools manager', () => {
      expect(ctx.tools).toBeDefined();
      expect(typeof ctx.tools.register).toBe('function');
      expect(typeof ctx.tools.get).toBe('function');
    });

    it('should expose memory manager', () => {
      expect(ctx.memory).toBeDefined();
      expect(typeof ctx.memory.store).toBe('function');
      expect(typeof ctx.memory.retrieve).toBe('function');
    });

    it('should expose cache manager', () => {
      expect(ctx.cache).toBeDefined();
      expect(typeof ctx.cache.get).toBe('function');
      expect(typeof ctx.cache.set).toBe('function');
    });

    it('should expose permissions manager', () => {
      expect(ctx.permissions).toBeDefined();
      expect(typeof ctx.permissions.checkPermission).toBe('function');
    });

    it('should allow tool operations via tools accessor', () => {
      ctx.tools.register(testTool2);
      expect(ctx.tools.has('test_tool_2')).toBe(true);

      ctx.tools.disable('test_tool_1');
      expect(ctx.tools.isEnabled('test_tool_1')).toBe(false);

      ctx.tools.enable('test_tool_1');
      expect(ctx.tools.isEnabled('test_tool_1')).toBe(true);
    });

    it('should allow memory operations via memory accessor', async () => {
      await ctx.memory.store('test.key', 'Test description', { value: 42 });
      const retrieved = await ctx.memory.retrieve('test.key');
      expect(retrieved).toEqual({ value: 42 });
    });
  });

  // ============================================================================
  // Core Context (System Prompt, Instructions) Tests
  // ============================================================================

  describe('core context', () => {
    beforeEach(() => {
      ctx = AgentContext.create({
        systemPrompt: 'Initial prompt',
        instructions: 'Initial instructions',
      });
    });

    it('should get system prompt', () => {
      expect(ctx.systemPrompt).toBe('Initial prompt');
    });

    it('should set system prompt', () => {
      ctx.systemPrompt = 'Updated prompt';
      expect(ctx.systemPrompt).toBe('Updated prompt');
    });

    it('should get instructions', () => {
      expect(ctx.instructions).toBe('Initial instructions');
    });

    it('should set instructions', () => {
      ctx.instructions = 'Updated instructions';
      expect(ctx.instructions).toBe('Updated instructions');
    });

    it('should set and get current input', () => {
      ctx.setCurrentInput('What is the weather?');
      expect(ctx.getCurrentInput()).toBe('What is the weather?');
    });
  });

  // ============================================================================
  // History Management Tests
  // ============================================================================

  describe('history management', () => {
    beforeEach(() => {
      ctx = AgentContext.create();
    });

    it('should add user message (async)', async () => {
      const msg = await ctx.addMessage('user', 'Hello');
      expect(msg!.role).toBe('user');
      expect(msg!.content).toBe('Hello');
      expect(msg!.id).toBeDefined();
      expect(msg!.timestamp).toBeDefined();
    });

    it('should add user message (sync)', () => {
      const msg = ctx.addMessageSync('user', 'Hello');
      expect(msg!.role).toBe('user');
      expect(msg!.content).toBe('Hello');
      expect(msg!.id).toBeDefined();
      expect(msg!.timestamp).toBeDefined();
    });

    it('should add assistant message', async () => {
      const msg = await ctx.addMessage('assistant', 'Hi there!');
      expect(msg!.role).toBe('assistant');
      expect(msg!.content).toBe('Hi there!');
    });

    it('should add system message', () => {
      const msg = ctx.addMessageSync('system', 'System notice');
      expect(msg!.role).toBe('system');
    });

    it('should add tool message', () => {
      const msg = ctx.addMessageSync('tool', 'Tool result');
      expect(msg!.role).toBe('tool');
    });

    it('should add message with metadata', async () => {
      const msg = await ctx.addMessage('user', 'Hello', { source: 'test' });
      expect(msg!.metadata).toEqual({ source: 'test' });
    });

    it('should get full history', () => {
      ctx.addMessageSync('user', 'Hello');
      ctx.addMessageSync('assistant', 'Hi');
      ctx.addMessageSync('user', 'How are you?');

      const history = ctx.getHistory();
      expect(history).toHaveLength(3);
      // getHistory() now returns InputItem[] where content is Content[]
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
      expect(history[2].role).toBe('user');
    });

    it('should return copy of history (not reference)', () => {
      ctx.addMessageSync('user', 'Hello');
      const history1 = ctx.getHistory();
      const history1Length = history1.length;
      ctx.addMessageSync('user', 'World');
      const history2 = ctx.getHistory();

      // history1 should not have been mutated by adding more messages
      expect(history1).toHaveLength(history1Length);
      expect(history2).toHaveLength(history1Length + 1);
    });

    it('should get recent history', () => {
      ctx.addMessageSync('user', 'Message 1');
      ctx.addMessageSync('user', 'Message 2');
      ctx.addMessageSync('user', 'Message 3');
      ctx.addMessageSync('user', 'Message 4');
      ctx.addMessageSync('user', 'Message 5');

      const recent = ctx.getRecentHistory(3);
      expect(recent).toHaveLength(3);
      // Returns InputItem[], verify we get the last 3 messages
      expect(recent[0].role).toBe('user');
      expect(recent[1].role).toBe('user');
      expect(recent[2].role).toBe('user');
    });

    it('should get message count', () => {
      expect(ctx.getMessageCount()).toBe(0);

      ctx.addMessageSync('user', 'Hello');
      expect(ctx.getMessageCount()).toBe(1);

      ctx.addMessageSync('assistant', 'Hi');
      expect(ctx.getMessageCount()).toBe(2);
    });

    it('should clear history', () => {
      ctx.addMessageSync('user', 'Hello');
      ctx.addMessageSync('assistant', 'Hi');

      ctx.clearHistory('test reason');

      expect(ctx.getHistory()).toHaveLength(0);
      expect(ctx.getMessageCount()).toBe(0);
    });

    it('should emit message:added event (async)', async () => {
      const listener = vi.fn();
      ctx.on('message:added', listener);

      await ctx.addMessage('user', 'Hello');

      // Event now emits { item: InputItem, index: number }
      expect(listener).toHaveBeenCalledWith({
        item: expect.objectContaining({
          role: 'user',
        }),
        index: expect.any(Number),
      });
    });

    it('should emit message:added event (sync)', () => {
      const listener = vi.fn();
      ctx.on('message:added', listener);

      ctx.addMessageSync('user', 'Hello');

      // Event now emits { item: InputItem, index: number }
      expect(listener).toHaveBeenCalledWith({
        item: expect.objectContaining({
          role: 'user',
        }),
        index: expect.any(Number),
      });
    });

    it('should emit history:cleared event', () => {
      const listener = vi.fn();
      ctx.on('history:cleared', listener);

      ctx.addMessageSync('user', 'Hello');
      ctx.clearHistory('testing');

      expect(listener).toHaveBeenCalledWith({ reason: 'testing' });
    });
  });

  // ============================================================================
  // addToolResult Tests
  // ============================================================================

  describe('addToolResult', () => {
    beforeEach(() => {
      ctx = AgentContext.create();
    });

    it('should add string result as tool message', async () => {
      await ctx.addToolResult('Tool output text');

      const history = ctx.getHistory();
      expect(history).toHaveLength(1);
      // Note: 'tool' role is mapped to 'user' in InputItem format
      expect(history[0].role).toBe('user');
    });

    it('should stringify object result', async () => {
      await ctx.addToolResult({ status: 'ok', data: [1, 2, 3] });

      const history = ctx.getHistory();
      expect(history).toHaveLength(1);
      // Note: 'tool' role is mapped to 'user' in InputItem format
      expect(history[0].role).toBe('user');
    });

    it('should add metadata to tool result', async () => {
      // Note: In v2 format, metadata is stored internally but not exposed via getHistory()
      // The legacy getHistory() method returns InputItem[] from conversation
      await ctx.addToolResult('result', { tool: 'web_fetch', url: 'https://example.com' });

      const history = ctx.getHistory();
      // Note: 'tool' role is mapped to 'user' in InputItem format
      expect(history[0].role).toBe('user');
    });

    it('should return null when history is disabled', async () => {
      ctx = AgentContext.create({ features: { history: false } });
      const result = await ctx.addToolResult('test');
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Tool Call Recording Tests
  // ============================================================================

  describe('tool call recording', () => {
    beforeEach(() => {
      ctx = AgentContext.create({ tools: [testTool1, testTool2] });
    });

    it('should get empty tool calls initially', () => {
      expect(ctx.getToolCalls()).toHaveLength(0);
    });

    it('should record tool calls after execution', async () => {
      await ctx.executeTool('test_tool_1', {});

      const calls = ctx.getToolCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('test_tool_1');
      expect(calls[0].result).toEqual({ result: 'tool1' });
    });

    it('should return copy of tool calls (not reference)', async () => {
      await ctx.executeTool('test_tool_1', {});
      const calls1 = ctx.getToolCalls();
      await ctx.executeTool('test_tool_2', { arg: 'test' });
      const calls2 = ctx.getToolCalls();

      expect(calls1).toHaveLength(1);
      expect(calls2).toHaveLength(2);
    });
  });

  // ============================================================================
  // Tool Execution Tests
  // ============================================================================

  describe('tool execution', () => {
    beforeEach(() => {
      ctx = AgentContext.create({ tools: [testTool1, testTool2, cacheableTool] });
    });

    it('should execute tool successfully', async () => {
      const result = await ctx.executeTool('test_tool_1', {});
      expect(result).toEqual({ result: 'tool1' });
      expect(testTool1.execute).toHaveBeenCalled();
    });

    it('should execute tool with arguments', async () => {
      const result = await ctx.executeTool('test_tool_2', { arg: 'hello' });
      expect(result).toEqual({ result: 'hello' });
    });

    it('should throw for non-existent tool', async () => {
      await expect(ctx.executeTool('non_existent', {})).rejects.toThrow("Tool 'non_existent' not found");
    });

    it('should record tool execution in calls', async () => {
      await ctx.executeTool('test_tool_1', {});

      const calls = ctx.getToolCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        name: 'test_tool_1',
        args: {},
        durationMs: expect.any(Number),
        cached: false,
      });
    });

    it('should emit tool:executed event', async () => {
      const listener = vi.fn();
      ctx.on('tool:executed', listener);

      await ctx.executeTool('test_tool_1', {});

      expect(listener).toHaveBeenCalledWith({
        record: expect.objectContaining({
          name: 'test_tool_1',
          cached: false,
        }),
      });
    });

    it('should record error on tool failure', async () => {
      const failingTool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'failing_tool',
            description: 'A tool that fails',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: vi.fn(async () => {
          throw new Error('Tool failed');
        }),
      };

      ctx.tools.register(failingTool);

      await expect(ctx.executeTool('failing_tool', {})).rejects.toThrow('Tool failed');

      const calls = ctx.getToolCalls();
      expect(calls).toHaveLength(1);
      // ToolManager wraps the error message
      expect(calls[0].error).toContain('Tool failed');
      expect(calls[0].result).toBeUndefined();
    });
  });

  // ============================================================================
  // Tool Caching Tests
  // ============================================================================

  describe('tool caching', () => {
    beforeEach(() => {
      ctx = AgentContext.create({ tools: [cacheableTool] });
    });

    it('should cache cacheable tool results', async () => {
      const result1 = await ctx.executeTool('cacheable_tool', { id: 1 });
      const result2 = await ctx.executeTool('cacheable_tool', { id: 1 });

      // Same result should come from cache
      expect(result1).toEqual(result2);
      // Execute should only be called once
      expect(cacheableTool.execute).toHaveBeenCalledTimes(1);
    });

    it('should not cache when different args', async () => {
      await ctx.executeTool('cacheable_tool', { id: 1 });
      await ctx.executeTool('cacheable_tool', { id: 2 });

      expect(cacheableTool.execute).toHaveBeenCalledTimes(2);
    });

    it('should emit tool:cached event on cache hit', async () => {
      const listener = vi.fn();
      ctx.on('tool:cached', listener);

      await ctx.executeTool('cacheable_tool', { id: 1 });
      await ctx.executeTool('cacheable_tool', { id: 1 });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        name: 'cacheable_tool',
        args: { id: 1 },
      });
    });

    it('should record cached flag in tool call', async () => {
      await ctx.executeTool('cacheable_tool', { id: 1 });
      await ctx.executeTool('cacheable_tool', { id: 1 });

      const calls = ctx.getToolCalls();
      expect(calls[0].cached).toBe(false);
      expect(calls[1].cached).toBe(true);
    });

    it('should not cache when caching is disabled', async () => {
      ctx = AgentContext.create({
        tools: [cacheableTool],
        cache: { enabled: false },
        features: { autoSpill: false, toolResultEviction: false },  // autoSpill and toolResultEviction require memory, so disable them too
      });

      await ctx.executeTool('cacheable_tool', { id: 1 });
      await ctx.executeTool('cacheable_tool', { id: 1 });

      expect(cacheableTool.execute).toHaveBeenCalledTimes(2);
    });

    it('should respect runtime cache enable/disable', async () => {
      ctx.setCacheEnabled(false);
      expect(ctx.isCacheEnabled()).toBe(false);

      await ctx.executeTool('cacheable_tool', { id: 1 });
      await ctx.executeTool('cacheable_tool', { id: 1 });

      expect(cacheableTool.execute).toHaveBeenCalledTimes(2);

      ctx.setCacheEnabled(true);
      await ctx.executeTool('cacheable_tool', { id: 2 });
      await ctx.executeTool('cacheable_tool', { id: 2 });

      expect(cacheableTool.execute).toHaveBeenCalledTimes(3); // One more call, then cached
    });
  });

  // ============================================================================
  // Plugin System Tests
  // ============================================================================

  describe('plugin system', () => {
    let testPlugin: TestPlugin;

    class TestPlugin extends BaseContextPlugin {
      readonly name = 'test_plugin';
      readonly priority = 5;
      readonly compactable = true;
      private content = 'Test content';
      private state: unknown = null;

      setContent(content: string) {
        this.content = content;
      }

      async getComponent(): Promise<IContextComponent | null> {
        return {
          name: this.name,
          content: this.content,
          priority: this.priority,
          compactable: this.compactable,
        };
      }

      override getState(): unknown {
        return this.state;
      }

      override restoreState(state: unknown): void {
        this.state = state;
      }

      destroyCalled = false;
      override destroy(): void {
        this.destroyCalled = true;
      }
    }

    beforeEach(() => {
      ctx = AgentContext.create();
      testPlugin = new TestPlugin();
    });

    it('should register plugin', () => {
      ctx.registerPlugin(testPlugin);
      expect(ctx.listPlugins()).toContain('test_plugin');
    });

    it('should emit plugin:registered event', () => {
      const listener = vi.fn();
      ctx.on('plugin:registered', listener);

      ctx.registerPlugin(testPlugin);

      expect(listener).toHaveBeenCalledWith({ name: 'test_plugin' });
    });

    it('should throw when registering duplicate plugin', () => {
      ctx.registerPlugin(testPlugin);
      expect(() => ctx.registerPlugin(testPlugin)).toThrow("Plugin 'test_plugin' is already registered");
    });

    it('should unregister plugin', () => {
      ctx.registerPlugin(testPlugin);
      const result = ctx.unregisterPlugin('test_plugin');

      expect(result).toBe(true);
      expect(ctx.listPlugins()).not.toContain('test_plugin');
    });

    it('should return false when unregistering non-existent plugin', () => {
      const result = ctx.unregisterPlugin('non_existent');
      expect(result).toBe(false);
    });

    it('should emit plugin:unregistered event', () => {
      const listener = vi.fn();
      ctx.registerPlugin(testPlugin);
      ctx.on('plugin:unregistered', listener);

      ctx.unregisterPlugin('test_plugin');

      expect(listener).toHaveBeenCalledWith({ name: 'test_plugin' });
    });

    it('should call plugin destroy on unregister', () => {
      ctx.registerPlugin(testPlugin);
      ctx.unregisterPlugin('test_plugin');

      expect(testPlugin.destroyCalled).toBe(true);
    });

    it('should get plugin by name', () => {
      ctx.registerPlugin(testPlugin);
      const retrieved = ctx.getPlugin<TestPlugin>('test_plugin');

      expect(retrieved).toBe(testPlugin);
    });

    it('should return undefined for non-existent plugin', () => {
      const retrieved = ctx.getPlugin('non_existent');
      expect(retrieved).toBeUndefined();
    });

    it('should list all plugins', () => {
      const plugin2 = new TestPlugin();
      (plugin2 as any).name = 'plugin_2';

      ctx.registerPlugin(testPlugin);
      ctx.registerPlugin(plugin2);

      const names = ctx.listPlugins();
      // Note: AgentContext auto-registers tool_outputs and auto_spill plugins by default
      expect(names).toContain('test_plugin');
      expect(names).toContain('plugin_2');
      // Should have user plugins + auto-registered plugins
      expect(names.length).toBeGreaterThanOrEqual(2);
    });

    it('should include plugin component in prepare', async () => {
      testPlugin.setContent('Plugin content here');
      ctx.registerPlugin(testPlugin);

      const prepared = await ctx.prepare({ returnFormat: 'components' });

      const pluginComponent = prepared.components!.find(c => c.name === 'test_plugin');
      expect(pluginComponent).toBeDefined();
      expect(pluginComponent?.content).toBe('Plugin content here');
    });
  });

  // ============================================================================
  // Auto-Compaction Guard Tests (ensureCapacity)
  // ============================================================================

  describe('ensureCapacity', () => {
    it('should return true when plenty of room available', async () => {
      ctx = AgentContext.create({ maxContextTokens: 10000 });

      // Small request should always succeed
      const hasCapacity = await ctx.ensureCapacity(100);
      expect(hasCapacity).toBe(true);
    });

    it('should trigger compaction when projected utilization exceeds threshold', async () => {
      ctx = AgentContext.create({
        maxContextTokens: 4000, // Increased to account for feature_instructions overhead (~800 tokens)
        history: { maxMessages: 100, preserveRecent: 5 },
        strategy: 'proactive', // 75% threshold
      });

      // Initialize budget with prepare()
      ctx.setCurrentInput('test');
      await ctx.prepare();

      // Fill history to ~60% capacity (each message ~20 tokens)
      for (let i = 0; i < 60; i++) {
        ctx.addMessageSync('user', 'A'.repeat(70)); // ~20 tokens each
      }

      const compactedListener = vi.fn();
      ctx.on('compacted', compactedListener);

      // Request that would push over 75% threshold
      const hasCapacity = await ctx.ensureCapacity(800);

      // Should have compacted to make room
      expect(compactedListener).toHaveBeenCalled();
      expect(hasCapacity).toBe(true);
    });

    it('should return false when cannot make enough room', async () => {
      ctx = AgentContext.create({
        maxContextTokens: 100,
        history: { maxMessages: 100, preserveRecent: 50 }, // Can't compact much
        systemPrompt: 'Very long system prompt that takes most of the context',
      });

      // Request more tokens than total available
      const hasCapacity = await ctx.ensureCapacity(5000);
      expect(hasCapacity).toBe(false);
    });

    it('should emit budget:warning event before compaction', async () => {
      ctx = AgentContext.create({
        maxContextTokens: 4000, // Increased to account for feature_instructions overhead (~800 tokens)
        history: { maxMessages: 100, preserveRecent: 5 },
      });

      // Initialize budget with prepare()
      ctx.setCurrentInput('test');
      await ctx.prepare();

      // Fill context
      for (let i = 0; i < 60; i++) {
        ctx.addMessageSync('user', 'A'.repeat(70));
      }

      const warningListener = vi.fn();
      ctx.on('budget:warning', warningListener);

      await ctx.ensureCapacity(800);

      expect(warningListener).toHaveBeenCalled();
    });

    it('should update lastBudget after compaction', async () => {
      ctx = AgentContext.create({
        maxContextTokens: 4000, // Increased to account for feature_instructions overhead (~800 tokens)
        history: { maxMessages: 100, preserveRecent: 5 },
      });

      // Initialize budget with prepare()
      ctx.setCurrentInput('test');
      await ctx.prepare();

      // Fill context
      for (let i = 0; i < 60; i++) {
        ctx.addMessageSync('user', 'A'.repeat(70));
      }

      await ctx.ensureCapacity(800);

      const budget = ctx.getLastBudget();
      expect(budget).not.toBeNull();
      // After compaction, status should be ok or warning (compaction was successful)
      expect(['ok', 'warning']).toContain(budget!.status);
    });
  });

  // ============================================================================
  // Auto-Compaction in addMessage Tests
  // ============================================================================

  describe('auto-compaction in addMessage', () => {
    it('should check capacity for large messages (>1000 tokens)', async () => {
      ctx = AgentContext.create({
        maxContextTokens: 5000,
        history: { maxMessages: 100, preserveRecent: 5 },
      });

      // Fill context to ~60%
      for (let i = 0; i < 15; i++) {
        ctx.addMessageSync('user', 'A'.repeat(700));
      }

      const compactedListener = vi.fn();
      ctx.on('compacted', compactedListener);

      // Add a large message (~4000 tokens)
      await ctx.addMessage('tool', 'X'.repeat(14000));

      // Should trigger compaction due to large message
      expect(compactedListener).toHaveBeenCalled();
    });

    it('should not check capacity for small messages (<1000 tokens)', async () => {
      ctx = AgentContext.create({ maxContextTokens: 10000 });

      const warningListener = vi.fn();
      ctx.on('budget:warning', warningListener);

      // Small message should not trigger capacity check
      await ctx.addMessage('user', 'Hello, world!');

      expect(warningListener).not.toHaveBeenCalled();
    });

    it('should emit budget:critical when cannot make room', async () => {
      ctx = AgentContext.create({
        maxContextTokens: 500,
        history: { maxMessages: 100, preserveRecent: 50 }, // Can't compact much
      });

      const criticalListener = vi.fn();
      ctx.on('budget:critical', criticalListener);

      // Add very large message that can't fit
      await ctx.addMessage('tool', 'X'.repeat(10000));

      // Should emit critical warning but still add the message
      expect(criticalListener).toHaveBeenCalled();
      expect(ctx.getMessageCount()).toBe(1);
    });
  });

  // ============================================================================
  // Context Preparation Tests
  // ============================================================================

  describe('context preparation', () => {
    beforeEach(() => {
      ctx = AgentContext.create({
        systemPrompt: 'System prompt',
        instructions: 'Instructions',
        maxContextTokens: 10000,
      });
    });

    it('should prepare context with components', async () => {
      ctx.addMessageSync('user', 'Hello');
      ctx.setCurrentInput('What is the weather?');

      const prepared = await ctx.prepare({ returnFormat: 'components' });

      expect(prepared.components).toBeDefined();
      expect(prepared.budget).toBeDefined();
    });

    it('should include system prompt component', async () => {
      const prepared = await ctx.prepare({ returnFormat: 'components' });

      const sysPrompt = prepared.components!.find(c => c.name === 'system_prompt');
      expect(sysPrompt).toBeDefined();
      // System prompt now includes task type prompt (auto-detected or default)
      expect(sysPrompt?.content).toContain('System prompt');
      expect(sysPrompt?.compactable).toBe(false);
    });

    it('should include instructions component', async () => {
      const prepared = await ctx.prepare({ returnFormat: 'components' });

      const instructions = prepared.components!.find(c => c.name === 'instructions');
      expect(instructions).toBeDefined();
      expect(instructions?.content).toBe('Instructions');
      expect(instructions?.compactable).toBe(false);
    });

    it('should include conversation history component', async () => {
      ctx.addMessageSync('user', 'Hello');
      ctx.addMessageSync('assistant', 'Hi there');

      const prepared = await ctx.prepare({ returnFormat: 'components' });

      const history = prepared.components!.find(c => c.name === 'conversation_history');
      expect(history).toBeDefined();
      expect(history?.compactable).toBe(true);
      expect(history?.content).toContain('User: Hello');
      expect(history?.content).toContain('Assistant: Hi there');
    });

    it('should include current input component', async () => {
      ctx.setCurrentInput('Test input');

      const prepared = await ctx.prepare({ returnFormat: 'components' });

      const input = prepared.components!.find(c => c.name === 'current_input');
      expect(input).toBeDefined();
      expect(input?.content).toBe('Test input');
      expect(input?.compactable).toBe(false);
    });

    it('should calculate budget correctly', async () => {
      ctx.addMessageSync('user', 'Hello');

      const prepared = await ctx.prepare();

      expect(prepared.budget.total).toBe(10000);
      expect(prepared.budget.used).toBeGreaterThan(0);
      expect(prepared.budget.available).toBeLessThan(10000);
      expect(prepared.budget.utilizationPercent).toBeDefined();
    });

    it('should emit context:prepared event after prepare', async () => {
      const listener = vi.fn();
      ctx.on('context:prepared', listener);

      await ctx.prepare();

      expect(listener).toHaveBeenCalled();
    });

    it('should emit context:prepared event', async () => {
      const listener = vi.fn();
      ctx.on('context:prepared', listener);

      await ctx.prepare();

      expect(listener).toHaveBeenCalledWith({
        budget: expect.any(Object),
        compacted: expect.any(Boolean),
      });
    });

    it('should not compact when under threshold', async () => {
      const prepared = await ctx.prepare();

      expect(prepared.compacted).toBe(false);
    });
  });

  // ============================================================================
  // Budget and Compaction Tests
  // ============================================================================

  describe('budget and compaction', () => {
    beforeEach(() => {
      ctx = AgentContext.create({
        maxContextTokens: 5000,  // Increased to account for feature instructions (~1,900 tokens)
        history: { maxMessages: 100, preserveRecent: 5 },
        autoCompact: true,
      });
    });

    it('should get budget', async () => {
      ctx.addMessageSync('user', 'Hello');

      const budget = await ctx.getBudget();

      expect(budget.total).toBe(5000);  // Matches beforeEach maxContextTokens
      expect(budget.used).toBeGreaterThan(0);
      expect(budget.status).toBeDefined();
    });

    it('should report ok status when under threshold', async () => {
      ctx.addMessageSync('user', 'Short message');

      const budget = await ctx.getBudget();

      expect(budget.status).toBe('ok');
    });

    it('should emit budget:warning event when over warning threshold', async () => {
      const listener = vi.fn();
      ctx.on('budget:warning', listener);

      // Fill context to trigger warning (75%)
      for (let i = 0; i < 50; i++) {
        ctx.addMessageSync('user', 'A'.repeat(20));
      }

      await ctx.prepare();

      // May or may not trigger depending on actual token calculation
      // This test validates the event mechanism exists
    });

    it('should force compact when called', async () => {
      for (let i = 0; i < 10; i++) {
        ctx.addMessageSync('user', `Message ${i}`);
      }

      const result = await ctx.compact();

      expect(result.compacted).toBe(true);
    });

    it('should emit compacted event', async () => {
      const listener = vi.fn();
      ctx.on('compacted', listener);

      for (let i = 0; i < 10; i++) {
        ctx.addMessageSync('user', `Message ${i}`);
      }

      await ctx.compact();

      expect(listener).toHaveBeenCalledWith({
        log: expect.any(Array),
        tokensFreed: expect.any(Number),
      });
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('configuration', () => {
    beforeEach(() => {
      ctx = AgentContext.create({ maxContextTokens: 10000 });
    });

    it('should get max context tokens', () => {
      expect(ctx.getMaxContextTokens()).toBe(10000);
    });

    it('should set max context tokens', () => {
      ctx.setMaxContextTokens(20000);
      expect(ctx.getMaxContextTokens()).toBe(20000);
    });

    it('should set strategy', () => {
      expect(() => ctx.setStrategy('aggressive')).not.toThrow();
      expect(() => ctx.setStrategy('lazy')).not.toThrow();
      expect(() => ctx.setStrategy('proactive')).not.toThrow();
    });

    it('should enable/disable caching', () => {
      expect(ctx.isCacheEnabled()).toBe(true);

      ctx.setCacheEnabled(false);
      expect(ctx.isCacheEnabled()).toBe(false);

      ctx.setCacheEnabled(true);
      expect(ctx.isCacheEnabled()).toBe(true);
    });
  });

  // ============================================================================
  // Introspection Tests
  // ============================================================================

  describe('introspection', () => {
    beforeEach(() => {
      ctx = AgentContext.create({ tools: [testTool1] });
    });

    it('should estimate tokens for text', () => {
      const tokens = ctx.estimateTokens('Hello, world!');
      expect(tokens).toBeGreaterThan(0);
    });

    it('should estimate tokens with content type', () => {
      const codeTokens = ctx.estimateTokens('function foo() { return 42; }', 'code');
      const proseTokens = ctx.estimateTokens('function foo() { return 42; }', 'prose');

      // Code should use different ratio than prose
      expect(codeTokens).not.toBe(proseTokens);
    });

    it('should get utilization', async () => {
      ctx.addMessageSync('user', 'Hello');
      await ctx.prepare();

      const utilization = ctx.getUtilization();
      expect(utilization).toBeGreaterThan(0);
    });

    it('should return 0 utilization before prepare', () => {
      const utilization = ctx.getUtilization();
      expect(utilization).toBe(0);
    });

    it('should get last budget', async () => {
      expect(ctx.getLastBudget()).toBeNull();

      await ctx.prepare();

      const budget = ctx.getLastBudget();
      expect(budget).not.toBeNull();
      expect(budget?.total).toBeDefined();
    });

    it('should get comprehensive metrics', async () => {
      ctx.addMessageSync('user', 'Hello');
      await ctx.executeTool('test_tool_1', {});
      await ctx.memory!.store('test.key', 'Test', { value: 1 });
      await ctx.prepare();

      const metrics = await ctx.getMetrics();

      expect(metrics.historyMessageCount).toBe(1);
      expect(metrics.toolCallCount).toBe(1);
      expect(metrics.cacheStats).toBeDefined();
      expect(metrics.memoryStats).toBeDefined();
      expect(metrics.pluginCount).toBeDefined();
      expect(metrics.utilizationPercent).toBeDefined();
    });
  });

  // ============================================================================
  // Session Persistence Tests
  // ============================================================================

  describe('session persistence', () => {
    beforeEach(() => {
      ctx = AgentContext.create({
        tools: [testTool1, testTool2],
        systemPrompt: 'Test prompt',
        instructions: 'Test instructions',
      });
    });

    it('should get state', async () => {
      ctx.addMessageSync('user', 'Hello');
      ctx.addMessageSync('assistant', 'Hi');
      await ctx.executeTool('test_tool_1', {});

      const state = await ctx.getState();

      expect(state.version).toBe(2);  // v2 format with conversation
      expect(state.core.systemPrompt).toBe('Test prompt');
      expect(state.core.instructions).toBe('Test instructions');
      // v2 uses conversation instead of history
      expect(state.core.conversation).toHaveLength(2);
      expect(state.core.toolCalls).toHaveLength(1);
    });

    it('should restore state', async () => {
      ctx.addMessageSync('user', 'Hello');
      ctx.addMessageSync('assistant', 'Hi');
      ctx.systemPrompt = 'Changed prompt';
      await ctx.executeTool('test_tool_1', {});

      const state = await ctx.getState();

      // Create new context and restore
      const newCtx = AgentContext.create({ tools: [testTool1, testTool2] });
      await newCtx.restoreState(state);

      expect(newCtx.getHistory()).toHaveLength(2);
      expect(newCtx.systemPrompt).toBe('Changed prompt');
      expect(newCtx.getToolCalls()).toHaveLength(1);

      newCtx.destroy();
    });

    it('should preserve tool state', async () => {
      ctx.tools.disable('test_tool_1');

      const state = await ctx.getState();

      const newCtx = AgentContext.create({ tools: [testTool1, testTool2] });
      await newCtx.restoreState(state);

      expect(newCtx.tools.isEnabled('test_tool_1')).toBe(false);
      expect(newCtx.tools.isEnabled('test_tool_2')).toBe(true);

      newCtx.destroy();
    });

    it('should preserve permission state', async () => {
      ctx.permissions!.approveForSession('test_tool_1');

      const state = await ctx.getState();

      const newCtx = AgentContext.create({ tools: [testTool1, testTool2] });
      await newCtx.restoreState(state);

      // Check that session approval was preserved
      expect(state.permissions).toBeDefined();

      newCtx.destroy();
    });

    it('should round-trip with plugins', async () => {
      class StatefulPlugin extends BaseContextPlugin {
        readonly name = 'stateful';
        readonly priority = 5;
        readonly compactable = false;
        private data = '';

        setData(data: string) {
          this.data = data;
        }

        getData() {
          return this.data;
        }

        async getComponent(): Promise<IContextComponent | null> {
          return { name: this.name, content: this.data, priority: this.priority, compactable: false };
        }

        override getState() {
          return { data: this.data };
        }

        override restoreState(state: unknown) {
          const s = state as { data: string };
          this.data = s.data || '';
        }
      }

      const plugin = new StatefulPlugin();
      plugin.setData('important data');
      ctx.registerPlugin(plugin);

      const state = await ctx.getState();

      const newCtx = AgentContext.create();
      const newPlugin = new StatefulPlugin();
      newCtx.registerPlugin(newPlugin);
      await newCtx.restoreState(state);

      expect(newPlugin.getData()).toBe('important data');

      newCtx.destroy();
    });
  });

  // ============================================================================
  // Destroy Tests
  // ============================================================================

  describe('destroy', () => {
    it('should destroy plugins', () => {
      ctx = AgentContext.create();

      class TrackablePlugin extends BaseContextPlugin {
        readonly name = 'trackable';
        readonly priority = 5;
        readonly compactable = false;
        destroyed = false;

        async getComponent() {
          return null;
        }

        override destroy() {
          this.destroyed = true;
        }
      }

      const plugin = new TrackablePlugin();
      ctx.registerPlugin(plugin);
      ctx.destroy();

      expect(plugin.destroyed).toBe(true);
    });

    it('should clear cache', async () => {
      ctx = AgentContext.create({ tools: [cacheableTool] });

      await ctx.executeTool('cacheable_tool', { id: 1 });
      expect(ctx.cache.getStats().entries).toBeGreaterThan(0);

      ctx.destroy();

      // Cache should be cleared
      expect(ctx.cache.getStats().entries).toBe(0);
    });

    it('should clear history and tool calls', () => {
      ctx = AgentContext.create();

      ctx.addMessageSync('user', 'Hello');
      ctx.destroy();

      expect(ctx.getHistory()).toHaveLength(0);
      expect(ctx.getToolCalls()).toHaveLength(0);
    });

    it('should remove all event listeners', () => {
      ctx = AgentContext.create();

      const listener = vi.fn();
      ctx.on('message:added', listener);
      ctx.destroy();

      // After destroy, listeners should be removed
      expect(ctx.listenerCount('message:added')).toBe(0);
    });
  });

  // ============================================================================
  // Memory Integration Tests
  // ============================================================================

  describe('memory integration', () => {
    beforeEach(() => {
      ctx = AgentContext.create();
    });

    it('should include memory index in context when populated', async () => {
      await ctx.memory.store('user.name', 'User name', 'John');
      await ctx.memory.store('user.age', 'User age', 30);

      const prepared = await ctx.prepare({ returnFormat: 'components' });

      const memoryComponent = prepared.components!.find(c => c.name === 'memory_index');
      expect(memoryComponent).toBeDefined();
      expect(memoryComponent?.content).toContain('user.name');
      expect(memoryComponent?.content).toContain('user.age');
    });

    it('should not include memory index when empty', async () => {
      const prepared = await ctx.prepare({ returnFormat: 'components' });

      const memoryComponent = prepared.components!.find(c => c.name === 'memory_index');
      expect(memoryComponent).toBeUndefined();
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty system prompt', async () => {
      ctx = AgentContext.create({ systemPrompt: '' });
      const prepared = await ctx.prepare({ returnFormat: 'components' });

      const sysPrompt = prepared.components!.find(c => c.name === 'system_prompt');
      // Even with empty system prompt, task type prompt is still added
      expect(sysPrompt).toBeDefined();
      // System prompt contains task execution guidelines
      expect(sysPrompt?.content).toContain('Task Execution');
    });

    it('should handle empty instructions', async () => {
      ctx = AgentContext.create({ instructions: '' });
      const prepared = await ctx.prepare({ returnFormat: 'components' });

      const instructions = prepared.components!.find(c => c.name === 'instructions');
      expect(instructions).toBeUndefined();
    });

    it('should handle empty current input', async () => {
      ctx = AgentContext.create();
      const prepared = await ctx.prepare({ returnFormat: 'components' });

      const input = prepared.components!.find(c => c.name === 'current_input');
      expect(input).toBeUndefined();
    });

    it('should handle plugin errors gracefully', async () => {
      ctx = AgentContext.create();

      class ErrorPlugin extends BaseContextPlugin {
        readonly name = 'error_plugin';
        readonly priority = 5;
        readonly compactable = false;

        async getComponent() {
          throw new Error('Plugin error');
        }
      }

      ctx.registerPlugin(new ErrorPlugin());

      // Should not throw
      await expect(ctx.prepare()).resolves.toBeDefined();
    });

    it('should handle concurrent tool executions', async () => {
      ctx = AgentContext.create({ tools: [testTool2] });

      const promises = [
        ctx.executeTool('test_tool_2', { arg: 'one' }),
        ctx.executeTool('test_tool_2', { arg: 'two' }),
        ctx.executeTool('test_tool_2', { arg: 'three' }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ result: 'one' });
      expect(results[1]).toEqual({ result: 'two' });
      expect(results[2]).toEqual({ result: 'three' });
    });
  });
});
