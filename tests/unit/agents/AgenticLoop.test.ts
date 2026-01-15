/**
 * AgenticLoop Unit Tests
 * Tests core agentic execution with tools, hooks, pause/resume
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgenticLoop } from '@/capabilities/agents/AgenticLoop.js';
import { MockTextProvider, MockToolExecutor } from '../../fixtures/mockProviders.js';
import { MessageRole } from '@/domain/entities/Message.js';
import { ContentType } from '@/domain/entities/Content.js';
import { ToolCallState } from '@/domain/entities/Tool.js';

describe('AgenticLoop', () => {
  let mockProvider: MockTextProvider;
  let mockToolExecutor: MockToolExecutor;
  let loop: AgenticLoop;

  const weatherTool = {
    type: 'function' as const,
    function: {
      name: 'get_weather',
      description: 'Get weather for a city',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string' }
        },
        required: ['city']
      }
    }
  };

  beforeEach(() => {
    mockProvider = new MockTextProvider();
    mockToolExecutor = new MockToolExecutor();
    loop = new AgenticLoop(mockProvider, mockToolExecutor);
  });

  describe('execute() - Basic Flow', () => {
    it('should execute simple completion without tools', async () => {
      mockProvider.setResponse({
        text: 'Hello! I am an AI assistant.',
        status: 'completed'
      });

      const response = await loop.execute({
        model: 'gpt-4',
        input: 'Say hello',
        tools: [],
        maxIterations: 5
      });

      expect(response.status).toBe('completed');
      expect(response.output[0].type).toBe('message');
      expect(mockProvider.callCount).toBe(1);
    });

    it('should respect maxIterations limit', async () => {
      // Provider always returns tool calls
      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: 'tool1',
              name: 'get_weather',
              arguments: JSON.stringify({ city: 'NYC' })
            }]
          }],
          status: 'tool_calls'
        },
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: 'tool2',
              name: 'get_weather',
              arguments: JSON.stringify({ city: 'LA' })
            }]
          }],
          status: 'tool_calls'
        },
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: 'tool3',
              name: 'get_weather',
              arguments: JSON.stringify({ city: 'SF' })
            }]
          }],
          status: 'tool_calls'
        },
      ]);

      mockToolExecutor.registerTool('get_weather', async (args) => ({
        temp: 75,
        city: args.city
      }));

      await expect(
        loop.execute({
          model: 'gpt-4',
          input: 'Get weather for cities',
          tools: [weatherTool],
          maxIterations: 3
        })
      ).rejects.toThrow('Max iterations');
    });

    it('should stop when LLM returns no tool calls', async () => {
      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: 'tool1',
              name: 'get_weather',
              arguments: JSON.stringify({ city: 'NYC' })
            }]
          }],
          status: 'tool_calls'
        },
        {
          text: 'The weather in NYC is 75°F and sunny.',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('get_weather', async () => ({
        temp: 75,
        condition: 'sunny'
      }));

      const response = await loop.execute({
        model: 'gpt-4',
        input: 'Whats the weather in NYC?',
        tools: [weatherTool],
        maxIterations: 10
      });

      expect(response.status).toBe('completed');
      expect(mockProvider.callCount).toBe(2); // Called twice
    });
  });

  describe('Tool Execution', () => {
    it('should execute tool and pass result back to LLM', async () => {
      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: 'tool1',
              name: 'get_weather',
              arguments: JSON.stringify({ city: 'NYC' })
            }]
          }],
          status: 'tool_calls'
        },
        {
          text: 'The weather in NYC is sunny and 75°F',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('get_weather', async (args) => {
        expect(args.city).toBe('NYC');
        return { temp: 75, condition: 'sunny' };
      });

      const response = await loop.execute({
        model: 'gpt-4',
        input: 'Get weather in NYC',
        tools: [weatherTool],
        maxIterations: 5
      });

      expect(mockToolExecutor.getCallCount('get_weather')).toBe(1);
      expect(response.status).toBe('completed');
    });

    it('should execute multiple tools in single iteration', async () => {
      const tools = [
        {
          type: 'function' as const,
          function: { name: 'tool1', description: 'Tool 1', parameters: { type: 'object' } }
        },
        {
          type: 'function' as const,
          function: { name: 'tool2', description: 'Tool 2', parameters: { type: 'object' } }
        },
        {
          type: 'function' as const,
          function: { name: 'tool3', description: 'Tool 3', parameters: { type: 'object' } }
        }
      ];

      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [
              {
                type: ContentType.TOOL_USE,
                id: 't1',
                name: 'tool1',
                arguments: '{}'
              },
              {
                type: ContentType.TOOL_USE,
                id: 't2',
                name: 'tool2',
                arguments: '{}'
              },
              {
                type: ContentType.TOOL_USE,
                id: 't3',
                name: 'tool3',
                arguments: '{}'
              }
            ]
          }],
          status: 'tool_calls'
        },
        {
          text: 'All tools executed',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('tool1', async () => 'result1');
      mockToolExecutor.registerTool('tool2', async () => 'result2');
      mockToolExecutor.registerTool('tool3', async () => 'result3');

      await loop.execute({
        model: 'gpt-4',
        input: 'test',
        tools,
        maxIterations: 5
      });

      expect(mockToolExecutor.getCallCount('tool1')).toBe(1);
      expect(mockToolExecutor.getCallCount('tool2')).toBe(1);
      expect(mockToolExecutor.getCallCount('tool3')).toBe(1);
    });
  });

  describe('Tool Failure Modes', () => {
    it('should continue executing remaining tools in continue mode (default)', async () => {
      const tools = [
        {
          type: 'function' as const,
          function: { name: 'tool1', description: 'Tool 1', parameters: { type: 'object' } }
        },
        {
          type: 'function' as const,
          function: { name: 'tool2', description: 'Tool 2', parameters: { type: 'object' } }
        },
        {
          type: 'function' as const,
          function: { name: 'tool3', description: 'Tool 3', parameters: { type: 'object' } }
        }
      ];

      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [
              { type: ContentType.TOOL_USE, id: 't1', name: 'tool1', arguments: '{}' },
              { type: ContentType.TOOL_USE, id: 't2', name: 'tool2', arguments: '{}' },
              { type: ContentType.TOOL_USE, id: 't3', name: 'tool3', arguments: '{}' }
            ]
          }],
          status: 'tool_calls'
        },
        {
          text: 'Processed results from tool1 and tool3. Tool2 failed but continuing.',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('tool1', async () => 'success1');
      mockToolExecutor.registerTool('tool2', async () => {
        throw new Error('Tool2 failed!');
      });
      mockToolExecutor.registerTool('tool3', async () => 'success3');

      const response = await loop.execute({
        model: 'gpt-4',
        input: 'test',
        tools,
        maxIterations: 5,
        errorHandling: { toolFailureMode: 'continue' } // Default
      });

      // All 3 tools should be called
      expect(mockToolExecutor.getCallCount('tool1')).toBe(1);
      expect(mockToolExecutor.getCallCount('tool2')).toBe(1);
      expect(mockToolExecutor.getCallCount('tool3')).toBe(1);

      // Execution should complete (not throw)
      expect(response.status).toBe('completed');
    });

    it('should stop on first failure in fail mode', async () => {
      const tools = [
        {
          type: 'function' as const,
          function: { name: 'tool1', description: 'Tool 1', parameters: { type: 'object' } }
        },
        {
          type: 'function' as const,
          function: { name: 'tool2', description: 'Tool 2', parameters: { type: 'object' } }
        },
        {
          type: 'function' as const,
          function: { name: 'tool3', description: 'Tool 3', parameters: { type: 'object' } }
        }
      ];

      mockProvider.setResponse({
        output: [{
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [
            { type: ContentType.TOOL_USE, id: 't1', name: 'tool1', arguments: '{}' },
            { type: ContentType.TOOL_USE, id: 't2', name: 'tool2', arguments: '{}' },
            { type: ContentType.TOOL_USE, id: 't3', name: 'tool3', arguments: '{}' }
          ]
        }],
        status: 'tool_calls'
      });

      mockToolExecutor.registerTool('tool1', async () => 'success');
      mockToolExecutor.registerTool('tool2', async () => {
        throw new Error('Tool2 failed!');
      });
      mockToolExecutor.registerTool('tool3', async () => 'success3');

      await expect(
        loop.execute({
          model: 'gpt-4',
          input: 'test',
          tools,
          maxIterations: 5,
          errorHandling: { toolFailureMode: 'fail' }
        })
      ).rejects.toThrow('Tool2 failed!');

      // Only tool1 and tool2 should be called (fail-fast)
      expect(mockToolExecutor.getCallCount('tool1')).toBe(1);
      expect(mockToolExecutor.getCallCount('tool2')).toBe(1);
      expect(mockToolExecutor.getCallCount('tool3')).toBe(0);
    });
  });

  describe('Configurable Timeout', () => {
    it('should use custom tool timeout', async () => {
      mockProvider.setResponse({
        output: [{
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [{
            type: ContentType.TOOL_USE,
            id: 'tool1',
            name: 'slow_tool',
            arguments: '{}'
          }]
        }],
        status: 'tool_calls'
      });

      mockToolExecutor.registerTool('slow_tool', async () => {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds
        return 'result';
      });

      const slowTool = {
        type: 'function' as const,
        function: {
          name: 'slow_tool',
          description: 'Slow tool',
          parameters: { type: 'object' }
        }
      };

      // Should timeout with 1s timeout
      await expect(
        loop.execute({
          model: 'gpt-4',
          input: 'test',
          tools: [slowTool],
          maxIterations: 1,
          toolTimeout: 1000 // 1 second timeout
        })
      ).rejects.toThrow();
    });
  });

  describe('Pause/Resume', () => {
    it('should pause and resume execution', async () => {
      mockProvider.setResponse({
        text: 'Response after pause',
        status: 'completed'
      });

      const executePromise = loop.execute({
        model: 'gpt-4',
        input: 'test',
        tools: [],
        maxIterations: 1
      });

      // Pause and resume happen asynchronously
      // Wait a bit for pause to take effect
      await new Promise(resolve => setTimeout(resolve, 10));

      loop.pause('Test pause');

      // Wait for pause to be processed
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should be paused
      expect(loop.isPaused()).toBe(true);

      // Resume
      loop.resume();

      const response = await executePromise;
      expect(response.status).toBe('completed');
      expect(loop.isPaused()).toBe(false);
    });

    it('should handle cancel during execution', async () => {
      mockProvider.setResponse({
        text: 'This should not complete',
        status: 'completed'
      });

      const executePromise = loop.execute({
        model: 'gpt-4',
        input: 'test',
        tools: [],
        maxIterations: 1
      });

      // Cancel immediately
      loop.cancel('Test cancellation');

      await expect(executePromise).rejects.toThrow('cancelled');
    });
  });

  describe('Event Emission', () => {
    it('should emit execution:start event', async () => {
      const eventSpy = vi.fn();
      loop.on('execution:start', eventSpy);

      mockProvider.setResponse({ text: 'test', status: 'completed' });

      await loop.execute({
        model: 'gpt-4',
        input: 'test',
        tools: [],
        maxIterations: 1
      });

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit tool:start and tool:complete events', async () => {
      const toolStartSpy = vi.fn();
      const toolCompleteSpy = vi.fn();

      loop.on('tool:start', toolStartSpy);
      loop.on('tool:complete', toolCompleteSpy);

      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: 'tool1',
              name: 'get_weather',
              arguments: JSON.stringify({ city: 'NYC' })
            }]
          }],
          status: 'tool_calls'
        },
        {
          text: 'Weather retrieved',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('get_weather', async () => ({ temp: 75 }));

      await loop.execute({
        model: 'gpt-4',
        input: 'test',
        tools: [weatherTool],
        maxIterations: 5
      });

      expect(toolStartSpy).toHaveBeenCalledTimes(1);
      expect(toolCompleteSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Scenarios (Realistic)', () => {
    it('should handle malformed tool arguments (invalid JSON)', async () => {
      mockProvider.setErrorSimulation({ malformedJson: true });
      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: 'tool1',
              name: 'get_weather',
              arguments: JSON.stringify({ city: 'NYC' })
            }]
          }],
          status: 'tool_calls'
        },
        {
          text: 'Handled error',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('get_weather', async () => ({ temp: 75 }));

      // In continue mode, malformed JSON should result in tool error but continue
      const response = await loop.execute({
        model: 'gpt-4',
        input: 'test',
        tools: [weatherTool],
        maxIterations: 5,
        errorHandling: { toolFailureMode: 'continue' }
      });

      // Should complete (error was caught and continued)
      expect(response.status).toBe('completed');
    });

    it('should handle tool name not found in registry', async () => {
      mockProvider.setErrorSimulation({ unknownToolName: 'nonexistent_tool' });
      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: 'tool1',
              name: 'get_weather',
              arguments: JSON.stringify({ city: 'NYC' })
            }]
          }],
          status: 'tool_calls'
        },
        {
          text: 'Handled missing tool',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('get_weather', async () => ({ temp: 75 }));

      // Tool "nonexistent_tool" doesn't exist - should fail in fail mode
      await expect(
        loop.execute({
          model: 'gpt-4',
          input: 'test',
          tools: [weatherTool],
          maxIterations: 5,
          errorHandling: { toolFailureMode: 'fail' }
        })
      ).rejects.toThrow();
    });

    it('should handle network errors during LLM call', async () => {
      mockProvider.setErrorSimulation({ networkError: true });

      await expect(
        loop.execute({
          model: 'gpt-4',
          input: 'test',
          tools: [],
          maxIterations: 1
        })
      ).rejects.toThrow('Network error');
    });

    it('should handle rate limit errors', async () => {
      mockProvider.setErrorSimulation({ rateLimitError: true });

      await expect(
        loop.execute({
          model: 'gpt-4',
          input: 'test',
          tools: [],
          maxIterations: 1
        })
      ).rejects.toThrow(/rate limit/i);
    });

    it('should handle empty response output', async () => {
      mockProvider.setErrorSimulation({ emptyResponse: true });
      mockProvider.setResponse({ text: 'test', status: 'completed' });

      // Empty output should complete (no tool calls detected)
      const response = await loop.execute({
        model: 'gpt-4',
        input: 'test',
        tools: [],
        maxIterations: 1
      });

      expect(response.status).toBe('completed');
      expect(response.output).toHaveLength(0);
    });

    it('should handle empty content in message', async () => {
      mockProvider.setErrorSimulation({ emptyContent: true });
      mockProvider.setResponse({ text: 'test', status: 'completed' });

      const response = await loop.execute({
        model: 'gpt-4',
        input: 'test',
        tools: [],
        maxIterations: 1
      });

      // Should complete - empty content means no tool calls
      expect(response.status).toBe('completed');
    });

    it('should continue with partial tool failures in continue mode', async () => {
      const tools = [
        {
          type: 'function' as const,
          function: { name: 'good_tool', description: 'Works', parameters: { type: 'object' } }
        },
        {
          type: 'function' as const,
          function: { name: 'bad_tool', description: 'Fails', parameters: { type: 'object' } }
        }
      ];

      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [
              { type: ContentType.TOOL_USE, id: 't1', name: 'good_tool', arguments: '{}' },
              { type: ContentType.TOOL_USE, id: 't2', name: 'bad_tool', arguments: '{}' }
            ]
          }],
          status: 'tool_calls'
        },
        {
          text: 'Completed with partial failures',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('good_tool', async () => 'success');
      mockToolExecutor.registerTool('bad_tool', async () => {
        throw new Error('Tool failed intentionally');
      });

      const response = await loop.execute({
        model: 'gpt-4',
        input: 'test',
        tools,
        maxIterations: 5,
        errorHandling: { toolFailureMode: 'continue' }
      });

      // Both tools should be called
      expect(mockToolExecutor.getCallCount('good_tool')).toBe(1);
      expect(mockToolExecutor.getCallCount('bad_tool')).toBe(1);
      expect(response.status).toBe('completed');
    });

    it('should fail fast with tool failure in fail mode', async () => {
      const tools = [
        {
          type: 'function' as const,
          function: { name: 'fail_first', description: 'Fails', parameters: { type: 'object' } }
        },
        {
          type: 'function' as const,
          function: { name: 'never_called', description: 'Never', parameters: { type: 'object' } }
        }
      ];

      mockProvider.setResponse({
        output: [{
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [
            { type: ContentType.TOOL_USE, id: 't1', name: 'fail_first', arguments: '{}' },
            { type: ContentType.TOOL_USE, id: 't2', name: 'never_called', arguments: '{}' }
          ]
        }],
        status: 'tool_calls'
      });

      mockToolExecutor.registerTool('fail_first', async () => {
        throw new Error('Fail fast error');
      });
      mockToolExecutor.registerTool('never_called', async () => 'should not run');

      await expect(
        loop.execute({
          model: 'gpt-4',
          input: 'test',
          tools,
          maxIterations: 5,
          errorHandling: { toolFailureMode: 'fail' }
        })
      ).rejects.toThrow('Fail fast error');

      expect(mockToolExecutor.getCallCount('fail_first')).toBe(1);
      expect(mockToolExecutor.getCallCount('never_called')).toBe(0);
    });

    it('should handle tool timeout gracefully', async () => {
      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: 'tool1',
              name: 'slow_tool',
              arguments: '{}'
            }]
          }],
          status: 'tool_calls'
        },
        {
          text: 'Completed after timeout',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('slow_tool', async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return 'too slow';
      });

      const slowTool = {
        type: 'function' as const,
        function: { name: 'slow_tool', description: 'Slow', parameters: { type: 'object' } }
      };

      // In continue mode, timeout should be caught
      const response = await loop.execute({
        model: 'gpt-4',
        input: 'test',
        tools: [slowTool],
        maxIterations: 5,
        toolTimeout: 100, // 100ms timeout
        errorHandling: { toolFailureMode: 'continue' }
      });

      expect(response.status).toBe('completed');
    });

    it('should emit tool:error event on failure', async () => {
      const errorSpy = vi.fn();
      loop.on('tool:error', errorSpy);

      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: 'tool1',
              name: 'failing_tool',
              arguments: '{}'
            }]
          }],
          status: 'tool_calls'
        },
        {
          text: 'Handled error',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('failing_tool', async () => {
        throw new Error('Tool error for testing');
      });

      const failingTool = {
        type: 'function' as const,
        function: { name: 'failing_tool', description: 'Fails', parameters: { type: 'object' } }
      };

      await loop.execute({
        model: 'gpt-4',
        input: 'test',
        tools: [failingTool],
        maxIterations: 5,
        errorHandling: { toolFailureMode: 'continue' }
      });

      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy.mock.calls[0][0].error.message).toBe('Tool error for testing');
    });
  });
});
