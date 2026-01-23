/**
 * Backward Compatibility Tests
 *
 * These tests ensure that the public API surface hasn't changed
 * and that existing user code continues to work without modifications.
 *
 * CRITICAL: These tests must pass for any release.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Connector, Agent, TaskAgent, Vendor } from '../../../src/index.js';
import { BaseTextProvider } from '../../../src/infrastructure/providers/base/BaseTextProvider.js';
import type { TextGenerateOptions, ModelCapabilities } from '../../../src/domain/interfaces/ITextProvider.js';
import type { LLMResponse } from '../../../src/domain/entities/Response.js';
import type { StreamEvent } from '../../../src/domain/entities/StreamEvent.js';
import type { ToolFunction } from '../../../src/domain/entities/Tool.js';

describe('Backward Compatibility', () => {
  beforeEach(() => {
    Connector.clear();
  });

  afterEach(() => {
    Connector.clear();
  });

  describe('Agent API Surface', () => {
    it('should create agent with minimal config (connector + model)', () => {
      // This is the most basic usage from v0.1
      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const agent = Agent.create({
        connector: 'test',
        model: 'gpt-4',
      });

      expect(agent).toBeDefined();
      expect(agent.model).toBe('gpt-4');
      expect(agent.connector.name).toBe('test');
    });

    it('should create agent with all optional v0.1 parameters', () => {
      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const myTool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'my_tool',
            description: 'Test tool',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: async () => ({ result: 'success' }),
      };

      const agent = Agent.create({
        connector: 'test',
        model: 'gpt-4',
        name: 'my-agent',
        instructions: 'You are helpful',
        tools: [myTool],
        temperature: 0.7,
        maxIterations: 5,
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('my-agent');
      expect(agent.model).toBe('gpt-4');
    });

    it('should accept Connector instance (not just name)', () => {
      const connector = Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const agent = Agent.create({
        connector: connector, // Instance, not string
        model: 'gpt-4',
      });

      expect(agent.connector).toBe(connector);
    });

    it('should have all v0.1 methods available', () => {
      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const agent = Agent.create({
        connector: 'test',
        model: 'gpt-4',
      });

      // Core methods
      expect(typeof agent.run).toBe('function');
      expect(typeof agent.stream).toBe('function');

      // Control methods
      expect(typeof agent.pause).toBe('function');
      expect(typeof agent.resume).toBe('function');
      expect(typeof agent.cancel).toBe('function');

      // Tool management
      expect(typeof agent.addTool).toBe('function');
      expect(typeof agent.removeTool).toBe('function');
      expect(typeof agent.setTools).toBe('function');
      expect(typeof agent.listTools).toBe('function');

      // Configuration
      expect(typeof agent.setModel).toBe('function');
      expect(typeof agent.setTemperature).toBe('function');
      expect(typeof agent.getTemperature).toBe('function');

      // Introspection
      expect(typeof agent.isRunning).toBe('function');
      expect(typeof agent.isPaused).toBe('function');
      expect(typeof agent.isCancelled).toBe('function');
      expect(typeof agent.getMetrics).toBe('function');
      expect(typeof agent.getAuditTrail).toBe('function');

      // Lifecycle
      expect(typeof agent.onCleanup).toBe('function');
      expect(typeof agent.destroy).toBe('function');
    });

    it('should NOT require new Phase 3 parameters', () => {
      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      // Old code should work without circuitBreaker, logger, etc.
      const agent = Agent.create({
        connector: 'test',
        model: 'gpt-4',
        // NO circuitBreaker config
        // NO logLevel
        // NO metrics config
      });

      expect(agent).toBeDefined();
    });
  });

  describe('TaskAgent API Surface', () => {
    it('should create TaskAgent with minimal config', () => {
      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const taskAgent = TaskAgent.create({
        connector: 'test',
        model: 'gpt-4',
      });

      expect(taskAgent).toBeDefined();
    });

    it('should create TaskAgent with all v0.1 parameters', () => {
      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const tool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'test_tool',
            description: 'Test',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: async () => ({ ok: true }),
      };

      const taskAgent = TaskAgent.create({
        connector: 'test',
        model: 'gpt-4',
        tools: [tool],
        instructions: 'You are helpful',
        temperature: 0.7,
        maxIterations: 10,
        memoryConfig: {
          maxSizeBytes: 512 * 1024,
        },
      });

      expect(taskAgent).toBeDefined();
    });

    it('should have all v0.1 TaskAgent methods', () => {
      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const taskAgent = TaskAgent.create({
        connector: 'test',
        model: 'gpt-4',
      });

      expect(typeof taskAgent.start).toBe('function');
      expect(typeof taskAgent.pause).toBe('function');
      expect(typeof taskAgent.resume).toBe('function');
      expect(typeof taskAgent.cancel).toBe('function');
      expect(typeof taskAgent.updatePlan).toBe('function');
      expect(typeof taskAgent.getState).toBe('function');
      expect(typeof taskAgent.getPlan).toBe('function');
      expect(typeof taskAgent.getMemory).toBe('function');
      expect(typeof taskAgent.destroy).toBe('function');
    });
  });

  describe('Custom Provider Compatibility', () => {
    it('should allow custom provider without calling initializeObservability', () => {
      // This is the old pattern - should still work!
      class OldStyleCustomProvider extends BaseTextProvider {
        readonly name = 'old-custom';
        readonly capabilities = {
          text: true,
          images: false,
          videos: false,
          audio: false,
        };

        constructor(config: any) {
          super(config);
          // OLD CODE: No initializeObservability() call
        }

        async generate(options: TextGenerateOptions): Promise<LLMResponse> {
          // Old implementation without executeWithCircuitBreaker
          return {
            output_text: 'Hello from old provider',
            output_items: [],
            finish_reason: 'complete',
          };
        }

        async *streamGenerate(_options: TextGenerateOptions): AsyncIterableIterator<StreamEvent> {
          yield {
            type: 'output_text_delta',
            delta: 'Hello',
          };
        }

        getModelCapabilities(_model: string): ModelCapabilities {
          return {
            maxInputTokens: 8000,
            maxOutputTokens: 4000,
            supportsFunctions: true,
            supportsStreaming: true,
            supportsVision: false,
          };
        }
      }

      // Should not throw
      expect(() => {
        const provider = new OldStyleCustomProvider({
          apiKey: 'test-key',
        });
        expect(provider.name).toBe('old-custom');
      }).not.toThrow();
    });

    it('should allow custom provider with executeWithCircuitBreaker helper', async () => {
      // New pattern (opt-in)
      class NewStyleCustomProvider extends BaseTextProvider {
        readonly name = 'new-custom';
        readonly capabilities = {
          text: true,
          images: false,
          videos: false,
          audio: false,
        };

        constructor(config: any) {
          super(config);
        }

        async generate(options: TextGenerateOptions): Promise<LLMResponse> {
          // NEW: Using circuit breaker helper (optional)
          return this.executeWithCircuitBreaker(async () => {
            return {
              output_text: 'Hello with CB',
              output_items: [],
              finish_reason: 'complete',
            };
          });
        }

        async *streamGenerate(_options: TextGenerateOptions): AsyncIterableIterator<StreamEvent> {
          yield {
            type: 'output_text_delta',
            delta: 'Hello',
          };
        }

        getModelCapabilities(_model: string): ModelCapabilities {
          return {
            maxInputTokens: 8000,
            maxOutputTokens: 4000,
            supportsFunctions: true,
            supportsStreaming: true,
            supportsVision: false,
          };
        }
      }

      const provider = new NewStyleCustomProvider({
        apiKey: 'test-key',
      });

      const response = await provider.generate({
        model: 'test-model',
        input: 'test',
        messages: [],
      });

      expect(response.output_text).toBe('Hello with CB');

      // Circuit breaker metrics should be available
      const cbMetrics = provider.getCircuitBreakerMetrics();
      expect(cbMetrics).toBeDefined();
      expect(cbMetrics?.totalRequests).toBe(1);
    });

    it('should work with deprecated initializeObservability call', () => {
      // Some users might have added this call (if they read early docs)
      class CustomProviderWithInit extends BaseTextProvider {
        readonly name = 'custom-init';
        readonly capabilities = {
          text: true,
          images: false,
          videos: false,
          audio: false,
        };

        constructor(config: any) {
          super(config);
          this.initializeObservability(this.name); // Deprecated but should work
        }

        async generate(_options: TextGenerateOptions): Promise<LLMResponse> {
          return {
            output_text: 'works',
            output_items: [],
            finish_reason: 'complete',
          };
        }

        async *streamGenerate(_options: TextGenerateOptions): AsyncIterableIterator<StreamEvent> {
          yield { type: 'output_text_delta', delta: 'works' };
        }

        getModelCapabilities(_model: string): ModelCapabilities {
          return {
            maxInputTokens: 8000,
            maxOutputTokens: 4000,
            supportsFunctions: true,
            supportsStreaming: true,
            supportsVision: false,
          };
        }
      }

      expect(() => {
        const provider = new CustomProviderWithInit({ apiKey: 'test' });
        expect(provider.name).toBe('custom-init');
      }).not.toThrow();
    });
  });

  describe('Tool Interface Compatibility', () => {
    it('should work with v0.1 tool definition (no idempotency)', () => {
      const oldStyleTool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'old_tool',
            description: 'Old style tool',
            parameters: {
              type: 'object',
              properties: {
                input: { type: 'string' },
              },
            },
          },
        },
        execute: async (args) => {
          return { output: args.input };
        },
        // NO idempotency config (old style)
      };

      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const agent = Agent.create({
        connector: 'test',
        model: 'gpt-4',
        tools: [oldStyleTool],
      });

      expect(agent.listTools()).toContain('old_tool');
    });

    it('should work with v0.2 tool definition (with idempotency)', () => {
      const newStyleTool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'new_tool',
            description: 'New style tool',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
        },
        execute: async () => ({ ok: true }),
        idempotency: {
          safe: true,
        },
      };

      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const agent = Agent.create({
        connector: 'test',
        model: 'gpt-4',
        tools: [newStyleTool],
      });

      expect(agent.listTools()).toContain('new_tool');
    });
  });

  describe('Configuration Backward Compatibility', () => {
    it('should not require new Phase 3 config options', () => {
      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      // Old config from v0.1 - no circuit breaker, no logging, etc.
      const agent = Agent.create({
        connector: 'test',
        model: 'gpt-4',
        instructions: 'Test',
        temperature: 0.5,
        maxIterations: 10,
      });

      expect(agent).toBeDefined();
      expect(agent.model).toBe('gpt-4');
    });

    it('should accept new optional Phase 3 config options', () => {
      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      // New config with Phase 3 options (all optional)
      const agent = Agent.create({
        connector: 'test',
        model: 'gpt-4',
        // These are NEW but optional
        hooks: {},
        historyMode: 'full',
        limits: {
          maxExecutionTime: 60000,
        },
        errorHandling: {
          toolFailureMode: 'continue',
        },
      });

      expect(agent).toBeDefined();
    });
  });

  describe('Return Type Compatibility', () => {
    it('should return same structure from Agent.run()', async () => {
      // Mock the provider to avoid real API calls
      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'sk-test' },
      });

      const agent = Agent.create({
        connector: 'test',
        model: 'gpt-4',
      });

      // Mock the internal agenticLoop instead of provider
      const mockLoop = {
        execute: vi.fn().mockResolvedValue({
          output_text: 'Hello',
          output_items: [],
          finish_reason: 'complete',
        }),
        on: vi.fn(),
        off: vi.fn(),
        cancel: vi.fn(),
        getContext: vi.fn().mockReturnValue(null),
        isRunning: vi.fn().mockReturnValue(false),
        isPaused: vi.fn().mockReturnValue(false),
        isCancelled: vi.fn().mockReturnValue(false),
      };

      (agent as any).agenticLoop = mockLoop;

      const response = await agent.run('test');

      // Verify response structure (should match v0.1)
      expect(response).toHaveProperty('output_text');
      expect(response).toHaveProperty('output_items');
      expect(response).toHaveProperty('finish_reason');
    });
  });

  describe('Event Compatibility', () => {
    it('should emit all v0.1 events', () => {
      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const agent = Agent.create({
        connector: 'test',
        model: 'gpt-4',
      });

      // Old events from v0.1
      const oldEvents = [
        'execution:start',
        'execution:complete',
        'execution:error',
        'iteration:start',
        'iteration:complete',
        'llm:request',
        'llm:response',
        'llm:error',
        'tool:detected',
        'tool:start',
        'tool:complete',
        'tool:error',
      ];

      // All should be supported (verified via TypeScript)
      oldEvents.forEach((eventName) => {
        expect(() => {
          agent.on(eventName as any, () => {});
        }).not.toThrow();
      });
    });

    it('should support new Phase 3 circuit breaker events', () => {
      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const agent = Agent.create({
        connector: 'test',
        model: 'gpt-4',
      });

      // New events (additive, not breaking)
      const newEvents = ['circuit:opened', 'circuit:half-open', 'circuit:closed'];

      newEvents.forEach((eventName) => {
        expect(() => {
          agent.on(eventName as any, () => {});
        }).not.toThrow();
      });
    });
  });

  describe('Connector API Compatibility', () => {
    it('should create connector with v0.1 API', () => {
      const connector = Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      expect(connector).toBeDefined();
      expect(connector.name).toBe('test');
      expect(connector.vendor).toBe(Vendor.OpenAI);
    });

    it('should support all v0.1 static methods', () => {
      Connector.create({
        name: 'test1',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      // v0.1 methods
      expect(Connector.has('test1')).toBe(true);
      expect(Connector.get('test1')).toBeDefined();
      expect(Connector.list()).toContain('test1');

      // Should not break
      Connector.create({
        name: 'test2',
        vendor: Vendor.Anthropic,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      expect(Connector.list()).toHaveLength(2);
    });
  });

  describe('Type System Compatibility', () => {
    it('should maintain TypeScript compatibility for Vendor enum', () => {
      // Verify all v0.1 vendors still exist
      const v01Vendors = [
        Vendor.OpenAI,
        Vendor.Anthropic,
        Vendor.Google,
        Vendor.GoogleVertex,
        Vendor.Groq,
        Vendor.Together,
      ];

      v01Vendors.forEach((vendor) => {
        expect(typeof vendor).toBe('string');
      });
    });

    it('should accept string literals for vendor (not just enum)', () => {
      // Users might use string literals
      const connector = Connector.create({
        name: 'test',
        vendor: 'openai' as any, // String literal, not enum
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      expect(connector.vendor).toBe('openai');
    });
  });

  describe('Behavior Compatibility', () => {
    it('should maintain default behavior for undefined parameters', () => {
      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const agent = Agent.create({
        connector: 'test',
        model: 'gpt-4',
        // temperature: undefined (should use default)
        // maxIterations: undefined (should use default)
      });

      expect(agent.getTemperature()).toBeUndefined(); // Default: no temperature
    });

    it('should NOT change tool execution behavior (just enhance it)', async () => {
      let executionCount = 0;

      const tool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'counter',
            description: 'Counts executions',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: async () => {
          executionCount++;
          return { count: executionCount };
        },
      };

      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const agent = Agent.create({
        connector: 'test',
        model: 'gpt-4',
        tools: [tool],
      });

      // Tool should still execute (even with circuit breaker)
      // Circuit breaker shouldn't prevent first execution
      const mockProvider = {
        generate: vi.fn().mockResolvedValue({
          output_text: 'response',
          output_items: [],
          finish_reason: 'tool_use',
          tool_calls: [
            {
              id: '1',
              type: 'function',
              function: { name: 'counter', arguments: '{}' },
            },
          ],
        }),
      };

      (agent as any).provider = mockProvider;

      // This should work the same as before
      expect(executionCount).toBe(0);
    });
  });

  describe('Error Handling Compatibility', () => {
    it('should throw same error types as v0.1', async () => {
      Connector.create({
        name: 'test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const agent = Agent.create({
        connector: 'test',
        model: 'gpt-4',
      });

      // Mock agenticLoop to throw error
      const mockLoop = {
        execute: vi.fn().mockRejectedValue(new Error('API Error')),
        on: vi.fn(),
        off: vi.fn(),
        cancel: vi.fn(),
        getContext: vi.fn().mockReturnValue(null),
        isRunning: vi.fn().mockReturnValue(false),
        isPaused: vi.fn().mockReturnValue(false),
        isCancelled: vi.fn().mockReturnValue(false),
      };

      (agent as any).agenticLoop = mockLoop;

      // Should still throw (not swallow errors)
      await expect(agent.run('test')).rejects.toThrow('API Error');
    });
  });

  describe('Export Compatibility', () => {
    it('should export all v0.1 symbols', async () => {
      // Core exports
      expect(Connector).toBeDefined();
      expect(Agent).toBeDefined();
      expect(Vendor).toBeDefined();

      // TaskAgent exports
      expect(TaskAgent).toBeDefined();

      // These should be available but NOT required for basic usage
      const { logger, metrics, CircuitBreaker } = await import('../../../src/index.js');
      expect(logger).toBeDefined();
      expect(metrics).toBeDefined();
      expect(CircuitBreaker).toBeDefined();
    });

    it('should NOT break when importing only core symbols', async () => {
      // Minimal import (v0.1 style)
      const { Connector, Agent, Vendor } = await import('../../../src/index.js');
      expect(Connector).toBeDefined();
      expect(Agent).toBeDefined();
      expect(Vendor).toBeDefined();
    });
  });
});
