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
});
