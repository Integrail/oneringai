/**
 * Context Behavior Tests
 *
 * These tests verify that context (message history) is properly managed across
 * iterations in the agentic loop. This includes:
 * - History preservation: original user message + all assistant/tool messages
 * - Sliding window: prevents unbounded growth while preserving system messages
 * - Consistency: execute() and executeStreaming() should build context the same way
 * - Tool error handling: both paths respect toolFailureMode
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgenticLoop } from '@/capabilities/agents/AgenticLoop.js';
import { MockTextProvider, MockToolExecutor } from '../../fixtures/mockProviders.js';
import { MessageRole, InputItem } from '@/domain/entities/Message.js';
import { ContentType } from '@/domain/entities/Content.js';
import { StreamEventType } from '@/domain/entities/StreamEvent.js';

describe('Context Behavior', () => {
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

  describe('execute() - History Preservation', () => {
    it('should preserve original user message across iterations', async () => {
      // Setup: 2 iterations - first with tool call, second with final response
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
          status: 'completed'
        },
        {
          text: 'The weather in NYC is 75°F',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('get_weather', async () => ({ temp: 75 }));

      await loop.execute({
        model: 'gpt-4',
        input: 'What is the weather in NYC?',
        tools: [weatherTool],
        maxIterations: 5
      });

      // Verify: Check what was passed to the LLM on iteration 2
      expect(mockProvider.callCount).toBe(2);

      const secondCallInput = mockProvider.getRequestInput(1);
      expect(Array.isArray(secondCallInput)).toBe(true);

      // The input should contain the original user message (converted to array format)
      const inputArray = secondCallInput as InputItem[];

      // Find user messages in the input
      const userMessages = inputArray.filter(
        item => item.type === 'message' && item.role === MessageRole.USER
      );

      // Should have at least 2 user messages:
      // 1. Original: "What is the weather in NYC?"
      // 2. Tool result message
      expect(userMessages.length).toBeGreaterThanOrEqual(2);

      // First user message should contain original text
      const firstUserMessage = inputArray.find(
        item => item.type === 'message' &&
                item.role === MessageRole.USER &&
                item.content.some((c: any) => c.type === ContentType.INPUT_TEXT)
      );
      expect(firstUserMessage).toBeDefined();
    });

    it('should include assistant response with tool_use in context', async () => {
      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: 'tool1',
              name: 'get_weather',
              arguments: JSON.stringify({ city: 'Paris' })
            }]
          }],
          status: 'completed'
        },
        {
          text: 'Paris is sunny',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('get_weather', async () => ({ temp: 22 }));

      await loop.execute({
        model: 'gpt-4',
        input: 'Weather in Paris?',
        tools: [weatherTool],
        maxIterations: 5
      });

      const secondCallInput = mockProvider.getRequestInput(1) as InputItem[];

      // Should include assistant message with tool_use
      const assistantMessages = secondCallInput.filter(
        item => item.type === 'message' && item.role === MessageRole.ASSISTANT
      );
      expect(assistantMessages.length).toBeGreaterThanOrEqual(1);

      // Assistant message should have tool_use content
      const hasToolUse = assistantMessages.some(msg =>
        msg.content.some((c: any) => c.type === ContentType.TOOL_USE)
      );
      expect(hasToolUse).toBe(true);
    });

    it('should include tool results in context', async () => {
      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: 'tool1',
              name: 'get_weather',
              arguments: JSON.stringify({ city: 'London' })
            }]
          }],
          status: 'completed'
        },
        {
          text: 'London weather retrieved',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('get_weather', async () => ({ temp: 15, condition: 'rainy' }));

      await loop.execute({
        model: 'gpt-4',
        input: 'London weather?',
        tools: [weatherTool],
        maxIterations: 5
      });

      const secondCallInput = mockProvider.getRequestInput(1) as InputItem[];

      // Should include tool result in a user message
      const toolResultMessages = secondCallInput.filter(
        item => item.type === 'message' &&
                item.role === MessageRole.USER &&
                item.content.some((c: any) => c.type === ContentType.TOOL_RESULT)
      );
      expect(toolResultMessages.length).toBe(1);

      // Verify tool result content
      const toolResult = toolResultMessages[0].content.find(
        (c: any) => c.type === ContentType.TOOL_RESULT
      ) as any;
      expect(toolResult.tool_use_id).toBe('tool1');
    });

    it('should accumulate context across multiple tool call iterations', async () => {
      // 3 iterations: tool call -> tool call -> final response
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
          status: 'completed'
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
          status: 'completed'
        },
        {
          text: 'NYC: 75°F, LA: 85°F',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('get_weather', async (args) => ({
        temp: args.city === 'NYC' ? 75 : 85
      }));

      await loop.execute({
        model: 'gpt-4',
        input: 'Compare NYC and LA weather',
        tools: [weatherTool],
        maxIterations: 5
      });

      expect(mockProvider.callCount).toBe(3);

      // Check iteration 3 input has accumulated context
      const thirdCallInput = mockProvider.getRequestInput(2) as InputItem[];

      // Should have: original user + assistant1 + tool_result1 + assistant2 + tool_result2
      expect(thirdCallInput.length).toBeGreaterThanOrEqual(5);

      // Count tool results - should be 2
      const toolResults = thirdCallInput.filter(
        item => item.type === 'message' &&
                item.content.some((c: any) => c.type === ContentType.TOOL_RESULT)
      );
      expect(toolResults.length).toBe(2);
    });
  });

  describe('execute() - Sliding Window', () => {
    it('should apply sliding window when context exceeds maxInputMessages', async () => {
      // Create many iterations to exceed the limit
      const iterations = 30;
      const responses: any[] = [];

      for (let i = 0; i < iterations - 1; i++) {
        responses.push({
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: `tool${i}`,
              name: 'get_weather',
              arguments: JSON.stringify({ city: `City${i}` })
            }]
          }],
          status: 'completed'
        });
      }
      responses.push({ text: 'All done!', status: 'completed' });

      mockProvider.setResponseSequence(responses);
      mockToolExecutor.registerTool('get_weather', async () => ({ temp: 70 }));

      await loop.execute({
        model: 'gpt-4',
        input: 'Get weather for many cities',
        tools: [weatherTool],
        maxIterations: iterations,
        limits: { maxInputMessages: 10 }
      });

      // Last call should have limited input size
      const lastCallInput = mockProvider.getRequestInput(iterations - 1) as InputItem[];
      expect(lastCallInput.length).toBeLessThanOrEqual(10);
    });

    it('should preserve system/developer message when sliding window is applied', async () => {
      const iterations = 15;
      const responses: any[] = [];

      for (let i = 0; i < iterations - 1; i++) {
        responses.push({
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: `tool${i}`,
              name: 'get_weather',
              arguments: JSON.stringify({ city: `City${i}` })
            }]
          }],
          status: 'completed'
        });
      }
      responses.push({ text: 'Done', status: 'completed' });

      mockProvider.setResponseSequence(responses);
      mockToolExecutor.registerTool('get_weather', async () => ({ temp: 70 }));

      // Use InputItem array with developer message
      const inputWithDeveloper: InputItem[] = [
        {
          type: 'message',
          role: MessageRole.DEVELOPER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'You are a weather assistant' }]
        },
        {
          type: 'message',
          role: MessageRole.USER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'Get weather' }]
        }
      ];

      await loop.execute({
        model: 'gpt-4',
        input: inputWithDeveloper,
        tools: [weatherTool],
        maxIterations: iterations,
        limits: { maxInputMessages: 6 }
      });

      // Check that developer message is preserved in the last call
      const lastCallInput = mockProvider.getRequestInput(iterations - 1) as InputItem[];

      // First message should be developer message
      expect(lastCallInput[0].type).toBe('message');
      expect(lastCallInput[0].role).toBe(MessageRole.DEVELOPER);
      expect(lastCallInput.length).toBeLessThanOrEqual(6);
    });
  });

  describe('executeStreaming() - History Preservation', () => {
    it('should preserve original user message across streaming iterations', async () => {
      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: 'tool1',
              name: 'get_weather',
              arguments: JSON.stringify({ city: 'Tokyo' })
            }]
          }],
          status: 'completed'
        },
        {
          text: 'Tokyo weather: 25°C',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('get_weather', async () => ({ temp: 25 }));

      // Consume the stream
      const events = [];
      for await (const event of loop.executeStreaming({
        model: 'gpt-4',
        input: 'Tokyo weather?',
        tools: [weatherTool],
        maxIterations: 5
      })) {
        events.push(event);
      }

      expect(mockProvider.callCount).toBe(2);

      // Verify second call has preserved context
      const secondCallInput = mockProvider.getRequestInput(1) as InputItem[];
      expect(Array.isArray(secondCallInput)).toBe(true);

      // Should have original user message
      const userMessages = secondCallInput.filter(
        item => item.type === 'message' &&
                item.role === MessageRole.USER &&
                item.content.some((c: any) => c.type === ContentType.INPUT_TEXT)
      );
      expect(userMessages.length).toBeGreaterThanOrEqual(1);
    });

    it('should build same context structure as execute()', async () => {
      // Same scenario for both execute and streaming
      const toolCallResponse = {
        output: [{
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [{
            type: ContentType.TOOL_USE,
            id: 'tool1',
            name: 'get_weather',
            arguments: JSON.stringify({ city: 'Berlin' })
          }]
        }],
        status: 'completed'
      };
      const finalResponse = { text: 'Berlin: 18°C', status: 'completed' };

      // Run execute()
      mockProvider.reset();
      mockProvider.setResponseSequence([toolCallResponse, finalResponse]);
      mockToolExecutor.registerTool('get_weather', async () => ({ temp: 18 }));

      await loop.execute({
        model: 'gpt-4',
        input: 'Berlin weather?',
        tools: [weatherTool],
        maxIterations: 5
      });

      const executeSecondInput = mockProvider.getRequestInput(1) as InputItem[];

      // Run executeStreaming()
      mockProvider.reset();
      mockToolExecutor.reset();
      mockProvider.setResponseSequence([toolCallResponse, finalResponse]);
      mockToolExecutor.registerTool('get_weather', async () => ({ temp: 18 }));

      const events = [];
      for await (const event of loop.executeStreaming({
        model: 'gpt-4',
        input: 'Berlin weather?',
        tools: [weatherTool],
        maxIterations: 5
      })) {
        events.push(event);
      }

      const streamSecondInput = mockProvider.getRequestInput(1) as InputItem[];

      // Compare structure (not exact content since text accumulation differs)
      expect(executeSecondInput.length).toBe(streamSecondInput.length);

      // Both should have same message types in same order
      for (let i = 0; i < executeSecondInput.length; i++) {
        expect(executeSecondInput[i].type).toBe(streamSecondInput[i].type);
        expect(executeSecondInput[i].role).toBe(streamSecondInput[i].role);
      }
    });
  });

  describe('executeStreaming() - Tool Error Handling', () => {
    it('should respect toolFailureMode: continue in streaming', async () => {
      const tools = [
        { type: 'function' as const, function: { name: 'good_tool', description: 'Works', parameters: { type: 'object' } } },
        { type: 'function' as const, function: { name: 'bad_tool', description: 'Fails', parameters: { type: 'object' } } }
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
          status: 'completed'
        },
        {
          text: 'Handled partial failure',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('good_tool', async () => 'success');
      mockToolExecutor.registerTool('bad_tool', async () => {
        throw new Error('Tool failed!');
      });

      const events = [];
      for await (const event of loop.executeStreaming({
        model: 'gpt-4',
        input: 'test',
        tools,
        maxIterations: 5,
        errorHandling: { toolFailureMode: 'continue' }
      })) {
        events.push(event);
      }

      // Both tools should be called
      expect(mockToolExecutor.getCallCount('good_tool')).toBe(1);
      expect(mockToolExecutor.getCallCount('bad_tool')).toBe(1);

      // Should complete (not throw)
      const completeEvent = events.find(e => e.type === StreamEventType.RESPONSE_COMPLETE);
      expect(completeEvent).toBeDefined();
    });

    it('should respect toolFailureMode: fail in streaming', async () => {
      const tools = [
        { type: 'function' as const, function: { name: 'fail_first', description: 'Fails', parameters: { type: 'object' } } },
        { type: 'function' as const, function: { name: 'never_called', description: 'Never', parameters: { type: 'object' } } }
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
        status: 'completed'
      });

      mockToolExecutor.registerTool('fail_first', async () => {
        throw new Error('Fail fast!');
      });
      mockToolExecutor.registerTool('never_called', async () => 'should not run');

      // Should throw
      await expect(async () => {
        for await (const _ of loop.executeStreaming({
          model: 'gpt-4',
          input: 'test',
          tools,
          maxIterations: 5,
          errorHandling: { toolFailureMode: 'fail' }
        })) {
          // consume
        }
      }).rejects.toThrow('Fail fast!');

      // Second tool should not be called
      expect(mockToolExecutor.getCallCount('fail_first')).toBe(1);
      expect(mockToolExecutor.getCallCount('never_called')).toBe(0);
    });
  });

  describe('executeStreaming() - Sliding Window', () => {
    it('should apply sliding window in streaming mode', async () => {
      const iterations = 15;
      const responses: any[] = [];

      for (let i = 0; i < iterations - 1; i++) {
        responses.push({
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: `tool${i}`,
              name: 'get_weather',
              arguments: JSON.stringify({ city: `City${i}` })
            }]
          }],
          status: 'completed'
        });
      }
      responses.push({ text: 'Done streaming', status: 'completed' });

      mockProvider.setResponseSequence(responses);
      mockToolExecutor.registerTool('get_weather', async () => ({ temp: 70 }));

      const events = [];
      for await (const event of loop.executeStreaming({
        model: 'gpt-4',
        input: 'Many cities',
        tools: [weatherTool],
        maxIterations: iterations,
        limits: { maxInputMessages: 8 }
      })) {
        events.push(event);
      }

      // Last call should have limited context
      const lastCallInput = mockProvider.getRequestInput(iterations - 1) as InputItem[];
      expect(lastCallInput.length).toBeLessThanOrEqual(8);
    });
  });

  describe('Edge Cases', () => {
    it('should handle string input conversion to array format', async () => {
      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: 'tool1',
              name: 'get_weather',
              arguments: JSON.stringify({ city: 'Miami' })
            }]
          }],
          status: 'completed'
        },
        {
          text: 'Miami is hot',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('get_weather', async () => ({ temp: 90 }));

      await loop.execute({
        model: 'gpt-4',
        input: 'Miami weather', // String input
        tools: [weatherTool],
        maxIterations: 5
      });

      // First call should receive string
      const firstInput = mockProvider.getRequestInput(0);
      expect(firstInput).toBe('Miami weather');

      // Second call should receive array (converted)
      const secondInput = mockProvider.getRequestInput(1);
      expect(Array.isArray(secondInput)).toBe(true);
    });

    it('should handle empty tool results', async () => {
      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: 'tool1',
              name: 'get_weather',
              arguments: JSON.stringify({ city: 'Empty' })
            }]
          }],
          status: 'completed'
        },
        {
          text: 'Handled empty result',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('get_weather', async () => null);

      const response = await loop.execute({
        model: 'gpt-4',
        input: 'Test empty',
        tools: [weatherTool],
        maxIterations: 5
      });

      expect(response.status).toBe('completed');
    });

    it('should handle tools returning complex objects', async () => {
      mockProvider.setResponseSequence([
        {
          output: [{
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{
              type: ContentType.TOOL_USE,
              id: 'tool1',
              name: 'get_weather',
              arguments: JSON.stringify({ city: 'Complex' })
            }]
          }],
          status: 'completed'
        },
        {
          text: 'Processed complex data',
          status: 'completed'
        }
      ]);

      mockToolExecutor.registerTool('get_weather', async () => ({
        current: { temp: 75, humidity: 60 },
        forecast: [
          { day: 'Mon', high: 80, low: 65 },
          { day: 'Tue', high: 82, low: 67 }
        ],
        metadata: { source: 'weather-api', updated: new Date().toISOString() }
      }));

      const response = await loop.execute({
        model: 'gpt-4',
        input: 'Complex weather',
        tools: [weatherTool],
        maxIterations: 5
      });

      expect(response.status).toBe('completed');

      // Verify the complex object was passed to LLM
      const secondInput = mockProvider.getRequestInput(1) as InputItem[];
      const toolResult = secondInput.find(
        item => item.type === 'message' &&
                item.content.some((c: any) => c.type === ContentType.TOOL_RESULT)
      );
      expect(toolResult).toBeDefined();
    });
  });
});
