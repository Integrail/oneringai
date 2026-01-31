/**
 * Agent Unit Tests
 * Tests the main Agent class - the primary public API
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Agent, AgentConfig } from '@/core/Agent.js';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';
import { ToolFunction } from '@/domain/entities/Tool.js';
import { MessageRole } from '@/domain/entities/Message.js';
import { ContentType } from '@/domain/entities/Content.js';

// Mock the createProvider function
const mockGenerate = vi.fn();
const mockStreamGenerate = vi.fn();
const mockProvider = {
  name: 'openai',
  capabilities: { text: true, images: true, videos: false, audio: false },
  generate: mockGenerate,
  streamGenerate: mockStreamGenerate,
  getModelCapabilities: vi.fn(() => ({
    supportsTools: true,
    supportsVision: true,
    supportsJSON: true,
    supportsJSONSchema: true,
    maxTokens: 128000,
    maxOutputTokens: 16384,
  })),
};

vi.mock('@/core/createProvider.js', () => ({
  createProvider: vi.fn(() => mockProvider),
}));

describe('Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Connector.clear();

    // Create a test connector
    Connector.create({
      name: 'test-openai',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test-key' },
    });
  });

  afterEach(() => {
    Connector.clear();
  });

  describe('Agent.create()', () => {
    it('should create an agent with connector name', () => {
      const agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
      });

      expect(agent).toBeDefined();
      expect(agent.model).toBe('gpt-4');
    });

    it('should create an agent with connector instance', () => {
      const connector = Connector.get('test-openai');
      const agent = Agent.create({
        connector,
        model: 'gpt-4',
      });

      expect(agent).toBeDefined();
      expect(agent.connector).toBe(connector);
    });

    it('should throw if connector not found', () => {
      expect(() => {
        Agent.create({
          connector: 'non-existent',
          model: 'gpt-4',
        });
      }).toThrow(/not found/i);
    });

    it('should generate default name if not provided', () => {
      const agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
      });

      expect(agent.name).toMatch(/^agent-\d+$/);
    });

    it('should use provided name', () => {
      const agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        name: 'my-custom-agent',
      });

      expect(agent.name).toBe('my-custom-agent');
    });

    it('should store instructions', () => {
      const agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        instructions: 'You are a helpful assistant',
      });

      expect(agent).toBeDefined();
    });

    it('should register tools', () => {
      const tool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'test_tool',
            description: 'A test tool',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: async () => ({ result: 'ok' }),
      };

      const agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        tools: [tool],
      });

      expect(agent.listTools()).toContain('test_tool');
    });
  });

  describe('run()', () => {
    let agent: Agent;

    beforeEach(() => {
      agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
      });

      mockGenerate.mockResolvedValue({
        id: 'resp_123',
        object: 'response',
        created_at: Date.now(),
        status: 'completed',
        model: 'gpt-4',
        output: [
          {
            type: 'message',
            id: 'msg_123',
            role: MessageRole.ASSISTANT,
            content: [
              {
                type: ContentType.OUTPUT_TEXT,
                text: 'Hello! How can I help you?',
                annotations: [],
              },
            ],
          },
        ],
        output_text: 'Hello! How can I help you?',
        usage: { input_tokens: 10, output_tokens: 8, total_tokens: 18 },
      });
    });

    it('should run with string input', async () => {
      const response = await agent.run('Hello');

      expect(mockGenerate).toHaveBeenCalled();
      expect(response.output_text).toBe('Hello! How can I help you?');
    });

    it('should run with InputItem array', async () => {
      const response = await agent.run([
        {
          type: 'message',
          role: MessageRole.USER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'Hello' }],
        },
      ]);

      expect(response.output_text).toBe('Hello! How can I help you?');
    });

    it('should include usage information', async () => {
      const response = await agent.run('Hello');

      expect(response.usage).toEqual({
        input_tokens: 10,
        output_tokens: 8,
        total_tokens: 18,
      });
    });

    it('should throw if agent is destroyed', async () => {
      agent.destroy();

      await expect(agent.run('Hello')).rejects.toThrow(/destroyed/i);
    });
  });

  describe('stream()', () => {
    let agent: Agent;

    beforeEach(() => {
      agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
      });
    });

    it('should throw if agent is destroyed', async () => {
      agent.destroy();

      const stream = agent.stream('Hello');
      await expect(stream.next()).rejects.toThrow(/destroyed/i);
    });
  });

  describe('tool management', () => {
    let agent: Agent;

    beforeEach(() => {
      agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
      });
    });

    it('should add tool dynamically', () => {
      const tool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'new_tool',
            description: 'A new tool',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: async () => ({ result: 'ok' }),
      };

      agent.addTool(tool);

      expect(agent.listTools()).toContain('new_tool');
    });

    it('should remove tool', () => {
      const tool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'removable_tool',
            description: 'A tool to remove',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: async () => ({ result: 'ok' }),
      };

      agent.addTool(tool);
      expect(agent.listTools()).toContain('removable_tool');

      agent.removeTool('removable_tool');
      expect(agent.listTools()).not.toContain('removable_tool');
    });

    it('should list all tools', () => {
      const tool1: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'tool_a',
            description: 'Tool A',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: async () => ({}),
      };

      const tool2: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'tool_b',
            description: 'Tool B',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: async () => ({}),
      };

      agent.addTool(tool1);
      agent.addTool(tool2);

      const tools = agent.listTools();
      expect(tools).toContain('tool_a');
      expect(tools).toContain('tool_b');
    });
  });

  describe('control methods', () => {
    let agent: Agent;

    beforeEach(() => {
      agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
      });
    });

    it('should have pause method', () => {
      expect(typeof agent.pause).toBe('function');
      // Should not throw
      agent.pause('test pause');
    });

    it('should have resume method', () => {
      expect(typeof agent.resume).toBe('function');
    });

    it('should have cancel method', () => {
      expect(typeof agent.cancel).toBe('function');
    });
  });

  describe('introspection', () => {
    let agent: Agent;

    beforeEach(() => {
      agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
      });
    });

    it('should return null context before running', () => {
      expect(agent.getContext()).toBeNull();
    });

    it('should return null metrics before running', () => {
      expect(agent.getMetrics()).toBeNull();
    });

    it('should return null summary before running', () => {
      expect(agent.getSummary()).toBeNull();
    });

    it('should return empty audit trail before running', () => {
      expect(agent.getAuditTrail()).toEqual([]);
    });

    it('should report not running initially', () => {
      expect(agent.isRunning()).toBe(false);
    });

    it('should report not paused initially', () => {
      expect(agent.isPaused()).toBe(false);
    });

    it('should report not cancelled initially', () => {
      expect(agent.isCancelled()).toBe(false);
    });
  });

  describe('cleanup and lifecycle', () => {
    let agent: Agent;

    beforeEach(() => {
      agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
      });
    });

    it('should register cleanup callbacks', () => {
      const callback = vi.fn();
      agent.onCleanup(callback);

      agent.destroy();

      expect(callback).toHaveBeenCalled();
    });

    it('should call all cleanup callbacks on destroy', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      agent.onCleanup(callback1);
      agent.onCleanup(callback2);

      agent.destroy();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should handle cleanup callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Cleanup error');
      });
      const normalCallback = vi.fn();

      agent.onCleanup(errorCallback);
      agent.onCleanup(normalCallback);

      // Should not throw
      expect(() => agent.destroy()).not.toThrow();

      // Both callbacks should have been attempted
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });

    it('should track destroyed state', () => {
      expect(agent.isDestroyed).toBe(false);

      agent.destroy();

      expect(agent.isDestroyed).toBe(true);
    });

    it('should handle multiple destroy calls gracefully', () => {
      agent.destroy();
      expect(() => agent.destroy()).not.toThrow();
    });
  });

  describe('event forwarding', () => {
    let agent: Agent;

    beforeEach(() => {
      agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
      });
    });

    it('should be an EventEmitter', () => {
      expect(typeof agent.on).toBe('function');
      expect(typeof agent.off).toBe('function');
      expect(typeof agent.emit).toBe('function');
    });

    it('should allow subscribing to events', () => {
      const handler = vi.fn();

      agent.on('execution:start', handler);

      // Emit manually to test
      agent.emit('execution:start', { agentName: 'test' });

      expect(handler).toHaveBeenCalled();
    });

    it('should not emit events after destroy', () => {
      const handler = vi.fn();
      agent.on('execution:start', handler);

      agent.destroy();

      // The emit is blocked internally, but we can still call it
      // The agent checks _isDestroyed before emitting
      agent.emit('execution:start', { agentName: 'test' });

      // Handler should not be called since we removed listeners
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('configuration methods', () => {
    let agent: Agent;

    beforeEach(() => {
      agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        temperature: 0.5,
      });
    });

    describe('setModel()', () => {
      it('should change the model', () => {
        expect(agent.model).toBe('gpt-4');

        agent.setModel('gpt-4-turbo');

        expect(agent.model).toBe('gpt-4-turbo');
      });

      it('should use new model in subsequent runs', async () => {
        mockGenerate.mockResolvedValue({
          id: 'resp_123',
          object: 'response',
          created_at: Date.now(),
          status: 'completed',
          model: 'gpt-4-turbo',
          output: [
            {
              type: 'message',
              id: 'msg_123',
              role: MessageRole.ASSISTANT,
              content: [
                {
                  type: ContentType.OUTPUT_TEXT,
                  text: 'Hello!',
                  annotations: [],
                },
              ],
            },
          ],
          output_text: 'Hello!',
          usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        });

        agent.setModel('gpt-4-turbo');
        await agent.run('Hello');

        expect(mockGenerate).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'gpt-4-turbo',
          })
        );
      });
    });

    describe('setTemperature() and getTemperature()', () => {
      it('should return initial temperature', () => {
        expect(agent.getTemperature()).toBe(0.5);
      });

      it('should return undefined if temperature not set', () => {
        const agentNoTemp = Agent.create({
          connector: 'test-openai',
          model: 'gpt-4',
        });

        expect(agentNoTemp.getTemperature()).toBeUndefined();
      });

      it('should change the temperature', () => {
        agent.setTemperature(0.9);

        expect(agent.getTemperature()).toBe(0.9);
      });

      it('should use new temperature in subsequent runs', async () => {
        mockGenerate.mockResolvedValue({
          id: 'resp_123',
          object: 'response',
          created_at: Date.now(),
          status: 'completed',
          model: 'gpt-4',
          output: [
            {
              type: 'message',
              id: 'msg_123',
              role: MessageRole.ASSISTANT,
              content: [
                {
                  type: ContentType.OUTPUT_TEXT,
                  text: 'Hello!',
                  annotations: [],
                },
              ],
            },
          ],
          output_text: 'Hello!',
          usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        });

        agent.setTemperature(0.9);
        await agent.run('Hello');

        expect(mockGenerate).toHaveBeenCalledWith(
          expect.objectContaining({
            temperature: 0.9,
          })
        );
      });
    });

    describe('setTools()', () => {
      const tool1: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'tool_one',
            description: 'First tool',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: async () => ({ result: 'one' }),
      };

      const tool2: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'tool_two',
            description: 'Second tool',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: async () => ({ result: 'two' }),
      };

      const tool3: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'tool_three',
            description: 'Third tool',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: async () => ({ result: 'three' }),
      };

      it('should replace all tools with new array', () => {
        agent.addTool(tool1);
        agent.addTool(tool2);
        expect(agent.listTools()).toContain('tool_one');
        expect(agent.listTools()).toContain('tool_two');

        agent.setTools([tool3]);

        expect(agent.listTools()).not.toContain('tool_one');
        expect(agent.listTools()).not.toContain('tool_two');
        expect(agent.listTools()).toContain('tool_three');
      });

      it('should handle empty array (clear all tools)', () => {
        // AgentContext auto-registers feature-aware tools
        const initialCount = agent.listTools().length;
        expect(initialCount).toBeGreaterThan(0); // Auto-registered tools exist

        agent.addTool(tool1);
        agent.addTool(tool2);
        expect(agent.listTools().length).toBe(initialCount + 2);

        // setTools([]) clears ALL tools including auto-registered ones
        agent.setTools([]);

        expect(agent.listTools().length).toBe(0);
      });

      it('should replace with multiple tools', () => {
        // AgentContext auto-registers feature-aware tools
        expect(agent.listTools().length).toBeGreaterThan(0);

        agent.addTool(tool1);
        expect(agent.listTools()).toContain('tool_one');

        // setTools replaces ALL tools (clears everything, then adds specified tools)
        agent.setTools([tool2, tool3]);

        expect(agent.listTools()).toContain('tool_two');
        expect(agent.listTools()).toContain('tool_three');
        expect(agent.listTools()).not.toContain('tool_one');
        // Only the 2 specified tools remain (auto-registered tools were cleared)
        expect(agent.listTools().length).toBe(2);
      });

      it('should use new tools in subsequent runs', async () => {
        mockGenerate.mockResolvedValue({
          id: 'resp_123',
          object: 'response',
          created_at: Date.now(),
          status: 'completed',
          model: 'gpt-4',
          output: [
            {
              type: 'message',
              id: 'msg_123',
              role: MessageRole.ASSISTANT,
              content: [
                {
                  type: ContentType.OUTPUT_TEXT,
                  text: 'Hello!',
                  annotations: [],
                },
              ],
            },
          ],
          output_text: 'Hello!',
          usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        });

        agent.setTools([tool1, tool2]);
        await agent.run('Hello');

        expect(mockGenerate).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: [tool1.definition, tool2.definition],
          })
        );
      });
    });
  });

  describe('configuration options', () => {
    it('should accept temperature', () => {
      const agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        temperature: 0.7,
      });

      expect(agent).toBeDefined();
    });

    it('should accept maxIterations', () => {
      const agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        maxIterations: 5,
      });

      expect(agent).toBeDefined();
    });

    it('should accept hooks configuration', () => {
      const agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        hooks: {
          onToolCall: [async () => {}],
        },
      });

      expect(agent).toBeDefined();
    });

    it('should accept limits configuration', () => {
      const agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        limits: {
          maxExecutionTime: 30000,
          maxToolCalls: 10,
        },
      });

      expect(agent).toBeDefined();
    });

    it('should accept errorHandling configuration', () => {
      const agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        errorHandling: {
          hookFailureMode: 'warn',
          toolFailureMode: 'continue',
        },
      });

      expect(agent).toBeDefined();
    });
  });

  describe('Session Loading Race Condition', () => {
    it('should wait for session load before run()', async () => {
      // Create a mock storage that simulates slow loading
      let resolveLoad: () => void;
      const loadPromise = new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });

      const mockStorage = {
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockImplementation(async () => {
          await loadPromise;
          return {
            id: 'test-session',
            agentType: 'agent',
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            metadata: { name: 'Test' },
            history: { messages: [], summaries: [] },
            toolState: { enabled: {}, namespaces: {}, priorities: {}, permissions: {} },
            custom: {},
            metrics: { totalTokens: 0, totalCalls: 0, totalCost: 0 },
          };
        }),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        list: vi.fn().mockResolvedValue([]),
      };

      // Mock response
      mockGenerate.mockResolvedValue({
        output_text: 'Hello!',
        output: [],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      });

      const agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        session: {
          storage: mockStorage,
          id: 'test-session', // Resume existing session
        },
      });

      // Start run immediately (before session loads)
      const runPromise = agent.run('Hello');

      // Verify load was called
      expect(mockStorage.load).toHaveBeenCalledWith('test-session');

      // Resolve the load after a delay
      await new Promise((r) => setTimeout(r, 10));
      resolveLoad!();

      // Run should complete successfully
      const response = await runPromise;
      expect(response.output_text).toBe('Hello!');
    });

    it('should wait for session load before stream()', async () => {
      let resolveLoad: () => void;
      const loadPromise = new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });

      const mockStorage = {
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockImplementation(async () => {
          await loadPromise;
          return {
            id: 'test-session',
            agentType: 'agent',
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            metadata: { name: 'Test' },
            history: { messages: [], summaries: [] },
            toolState: { enabled: {}, namespaces: {}, priorities: {}, permissions: {} },
            custom: {},
            metrics: { totalTokens: 0, totalCalls: 0, totalCost: 0 },
          };
        }),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        list: vi.fn().mockResolvedValue([]),
      };

      // Mock streaming response
      async function* mockStream() {
        yield { type: 'text_delta', delta: 'Hello' };
        yield { type: 'done' };
      }
      mockStreamGenerate.mockReturnValue(mockStream());

      const agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        session: {
          storage: mockStorage,
          id: 'test-session',
        },
      });

      // Start stream immediately
      const streamIterator = agent.stream('Hello');

      // Verify load was called
      expect(mockStorage.load).toHaveBeenCalledWith('test-session');

      // Resolve the load
      await new Promise((r) => setTimeout(r, 10));
      resolveLoad!();

      // Stream should work
      const events = [];
      for await (const event of streamIterator) {
        events.push(event);
      }
      expect(events.length).toBeGreaterThan(0);
    });

    it('should wait for session load before saveSession()', async () => {
      let resolveLoad: () => void;
      const loadPromise = new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });

      const mockStorage = {
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockImplementation(async () => {
          await loadPromise;
          return {
            id: 'test-session',
            agentType: 'agent',
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            metadata: { name: 'Test' },
            history: { messages: [], summaries: [] },
            toolState: { enabled: {}, namespaces: {}, priorities: {}, permissions: {} },
            custom: {},
            metrics: { totalTokens: 0, totalCalls: 0, totalCost: 0 },
          };
        }),
        delete: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        list: vi.fn().mockResolvedValue([]),
      };

      const agent = Agent.create({
        connector: 'test-openai',
        model: 'gpt-4',
        session: {
          storage: mockStorage,
          id: 'test-session',
        },
      });

      // Start save immediately
      const savePromise = agent.saveSession();

      // Resolve the load
      await new Promise((r) => setTimeout(r, 10));
      resolveLoad!();

      // Save should complete without error
      await expect(savePromise).resolves.toBeUndefined();
      expect(mockStorage.save).toHaveBeenCalled();
    });
  });
});
