/**
 * AnthropicConverter Unit Tests
 * Tests bidirectional conversion between our format and Anthropic Messages API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AnthropicConverter } from '@/infrastructure/providers/anthropic/AnthropicConverter.js';
import { MessageRole } from '@/domain/entities/Message.js';
import { ContentType } from '@/domain/entities/Content.js';

describe('AnthropicConverter', () => {
  let converter: AnthropicConverter;

  beforeEach(() => {
    converter = new AnthropicConverter();
  });

  describe('convertRequest() - Our format → Anthropic API', () => {
    it('should convert simple text message', () => {
      const request = converter.convertRequest({
        model: 'claude-3-5-sonnet-20241022',
        input: [{
          type: 'message',
          role: MessageRole.USER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'Hello Claude' }]
        }],
        tools: []
      });

      expect(request.messages).toHaveLength(1);
      expect(request.messages[0].role).toBe('user');
      // Anthropic accepts string or array for content
      expect(request.messages[0].content).toBe('Hello Claude');
      expect(request.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should map DEVELOPER role to user role', () => {
      const request = converter.convertRequest({
        model: 'claude-3-5-sonnet-20241022',
        input: [{
          type: 'message',
          role: MessageRole.DEVELOPER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'System instruction' }]
        }],
        tools: []
      });

      expect(request.messages[0].role).toBe('user');
    });

    it('should convert system instructions', () => {
      const request = converter.convertRequest({
        model: 'claude-3-5-sonnet-20241022',
        input: [{
          type: 'message',
          role: MessageRole.USER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'Hello' }]
        }],
        instructions: 'You are a helpful assistant',
        tools: []
      });

      expect(request.system).toBe('You are a helpful assistant');
    });

    it('forwards only Anthropic-supported user_id request metadata', () => {
      const request = converter.convertRequest({
        model: 'claude-sonnet-5',
        input: 'Hello',
        metadata: { user_id: 'user-hash-123', workflow: 'must-not-leak' },
      });

      expect(request.metadata).toEqual({ user_id: 'user-hash-123' });
      expect(request.metadata).not.toHaveProperty('workflow');

      const unsupportedOnly = converter.convertRequest({
        model: 'claude-sonnet-5',
        input: 'Hello',
        metadata: { workflow: 'ignored' },
      });
      expect(unsupportedOnly.metadata).toBeUndefined();
    });

    it('should convert tools to Anthropic format', () => {
      const tools = [{
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
      }];

      const request = converter.convertRequest({
        model: 'claude-3-5-sonnet-20241022',
        input: [{
          type: 'message',
          role: MessageRole.USER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'test' }]
        }],
        tools
      });

      expect(request.tools).toHaveLength(1);
      expect(request.tools![0]).toEqual({
        name: 'get_weather',
        description: 'Get weather for a city',
        input_schema: {
          type: 'object',
          properties: {
            city: { type: 'string' }
          },
          required: ['city']
        }
      });
    });

    it('should convert image content (data URI)', () => {
      const request = converter.convertRequest({
        model: 'claude-3-5-sonnet-20241022',
        input: [{
          type: 'message',
          role: MessageRole.USER,
          content: [{
            type: ContentType.INPUT_IMAGE_URL,
            image_url: {
              url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
            }
          }]
        }],
        tools: []
      });

      expect(request.messages[0].content).toEqual([{
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        }
      }]);
    });

    it('should convert image content (URL)', () => {
      const request = converter.convertRequest({
        model: 'claude-3-5-sonnet-20241022',
        input: [{
          type: 'message',
          role: MessageRole.USER,
          content: [{
            type: ContentType.INPUT_IMAGE_URL,
            image_url: {
              url: 'https://example.com/image.png'
            }
          }]
        }],
        tools: []
      });

      expect(request.messages[0].content).toEqual([{
        type: 'image',
        source: {
          type: 'url',
          url: 'https://example.com/image.png'
        }
      }]);
    });

    it('should convert multi-turn conversation', () => {
      const request = converter.convertRequest({
        model: 'claude-3-5-sonnet-20241022',
        input: [
          {
            type: 'message',
            role: MessageRole.USER,
            content: [{ type: ContentType.INPUT_TEXT, text: 'First message' }]
          },
          {
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{ type: ContentType.OUTPUT_TEXT, text: 'First response' }]
          },
          {
            type: 'message',
            role: MessageRole.USER,
            content: [{ type: ContentType.INPUT_TEXT, text: 'Second message' }]
          }
        ],
        tools: []
      });

      expect(request.messages).toHaveLength(3);
      expect(request.messages[0].role).toBe('user');
      expect(request.messages[1].role).toBe('assistant');
      expect(request.messages[2].role).toBe('user');
    });

    it('should set temperature if provided', () => {
      const request = converter.convertRequest({
        model: 'claude-3-5-sonnet-20241022',
        input: [{
          type: 'message',
          role: MessageRole.USER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'test' }]
        }],
        temperature: 0.7,
        tools: []
      });

      expect(request.temperature).toBe(0.7);
    });

    it('should drop temperature for models that do not support it (Opus 4.7)', () => {
      const request = converter.convertRequest({
        model: 'claude-opus-4-7',
        input: [{
          type: 'message',
          role: MessageRole.USER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'test' }]
        }],
        temperature: 0.7,
        tools: []
      });

      expect(request.temperature).toBeUndefined();
    });

    it('should not force temperature=1 on thinking-enabled if model does not support temperature', () => {
      const request = converter.convertRequest({
        model: 'claude-opus-4-7',
        input: [{
          type: 'message',
          role: MessageRole.USER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'test' }]
        }],
        thinking: { enabled: true, budgetTokens: 5000 },
        tools: []
      });

      expect(request.temperature).toBeUndefined();
    });

    it('should set max_tokens if provided', () => {
      const request = converter.convertRequest({
        model: 'claude-3-5-sonnet-20241022',
        input: [{
          type: 'message',
          role: MessageRole.USER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'test' }]
        }],
        max_output_tokens: 1000,
        tools: []
      });

      expect(request.max_tokens).toBe(1000);
    });

    it('should transform unsupported native structured-output constraints', () => {
      const schema = {
        type: 'object',
        additionalProperties: false,
        required: ['steps', 'confidence'],
        properties: {
          steps: {
            type: 'array',
            minItems: 2,
            maxItems: 5,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['body'],
              properties: {
                body: { type: 'string', minLength: 1 },
              },
            },
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      };

      const request = converter.convertRequest({
        model: 'claude-sonnet-4-6',
        input: 'test',
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'answer', schema },
        },
      });

      const outputSchema = request.output_config?.format?.schema as any;
      expect(outputSchema.properties.steps.minItems).toBeUndefined();
      expect(outputSchema.properties.steps.maxItems).toBeUndefined();
      expect(outputSchema.properties.steps.description).toContain('minItems: 2');
      expect(outputSchema.properties.steps.description).toContain('maxItems: 5');
      expect(outputSchema.properties.steps.items.properties.body.minLength).toBeUndefined();
      expect(outputSchema.properties.steps.items.properties.body.description).toContain(
        'minLength: 1',
      );
      expect(outputSchema.properties.confidence.minimum).toBeUndefined();
      expect(outputSchema.properties.confidence.maximum).toBeUndefined();
      expect(outputSchema.properties.confidence.description).toContain('minimum: 0');
      expect(outputSchema.properties.confidence.description).toContain('maximum: 1');
    });

    it('should preserve supported constraints without mutating the caller schema', () => {
      const schema = {
        type: 'object',
        properties: {
          values: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', format: 'email' },
          },
        },
      };
      const original = structuredClone(schema);

      const request = converter.convertRequest({
        model: 'claude-sonnet-4-6',
        input: 'test',
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'answer', schema },
        },
      });

      const outputSchema = request.output_config?.format?.schema as any;
      expect(outputSchema.properties.values.minItems).toBe(1);
      expect(outputSchema.properties.values.items.format).toBe('email');
      expect(schema).toEqual(original);
    });
  });

  describe('convertResponse() - Anthropic API → Our format', () => {
    it('should convert simple text response', () => {
      const anthropicResponse: any = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello there!' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 20
        }
      };

      const response = converter.convertResponse(anthropicResponse);

      expect(response.id).toBe('resp_anthropic_msg_123'); // ID is prefixed
      expect(response.model).toBe('claude-3-5-sonnet-20241022');
      expect(response.status).toBe('completed');
      expect(response.output[0].type).toBe('message');

      // Check text content exists
      const textContent = response.output[0].content.find(c => c.type === ContentType.OUTPUT_TEXT);
      expect(textContent).toBeTruthy();
      expect(textContent!.text).toBe('Hello there!');
    });

    it('should convert tool_use content blocks', () => {
      const anthropicResponse: any = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me check the weather' },
          {
            type: 'tool_use',
            id: 'tool_abc123',
            name: 'get_weather',
            input: { city: 'NYC', units: 'fahrenheit' }
          }
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 20 }
      };

      const response = converter.convertResponse(anthropicResponse);

      expect(response.status).toBe('completed'); // Anthropic maps tool_use → completed

      // Check text content
      const textContent = response.output[0].content.find(c => c.type === ContentType.OUTPUT_TEXT);
      expect(textContent).toBeTruthy();
      expect(textContent!.text).toBe('Let me check the weather');

      // Check tool use content
      const toolUse = response.output[0].content.find(c => c.type === ContentType.TOOL_USE);
      expect(toolUse).toBeTruthy();
      expect(toolUse!.id).toBe('tool_abc123');
      expect(toolUse!.name).toBe('get_weather');
      expect(toolUse!.arguments).toBe(JSON.stringify({ city: 'NYC', units: 'fahrenheit' }));
    });

    it('should map stop_reason correctly', () => {
      const testCases = [
        { stop_reason: 'end_turn', expected: 'completed' },
        { stop_reason: 'tool_use', expected: 'completed' }, // Anthropic maps to completed
        { stop_reason: 'max_tokens', expected: 'incomplete' }, // Maps to incomplete
        { stop_reason: 'stop_sequence', expected: 'completed' }
      ];

      testCases.forEach(({ stop_reason, expected }) => {
        const response = converter.convertResponse({
          id: 'msg',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'test' }],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: stop_reason as any,
          usage: { input_tokens: 10, output_tokens: 5 }
        });

        expect(response.status).toBe(expected);
      });
    });

    it('should preserve usage metrics', () => {
      const anthropicResponse: any = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'test' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 100,
          output_tokens: 50
        }
      };

      const response = converter.convertResponse(anthropicResponse);

      expect(response.usage).toEqual({
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150
      });
    });
  });

  describe('Round-trip Conversion', () => {
    it('should preserve tool information through request → response cycle', () => {
      const tools = [{
        type: 'function' as const,
        function: {
          name: 'calculator',
          description: 'Perform calculations',
          parameters: {
            type: 'object',
            properties: {
              expression: { type: 'string' }
            }
          }
        }
      }];

      // Convert request
      const request = converter.convertRequest({
        model: 'claude-3-5-sonnet-20241022',
        input: [{
          type: 'message',
          role: MessageRole.USER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'Calculate 2+2' }]
        }],
        tools
      });

      // Simulate Anthropic response with tool use
      const anthropicResponse: any = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'tool_1',
          name: 'calculator',
          input: { expression: '2+2' }
        }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 5 }
      };

      // Convert response back
      const response = converter.convertResponse(anthropicResponse);

      // Tool name should match
      const toolUse = response.output[0].content.find(c => c.type === ContentType.TOOL_USE);
      expect(toolUse).toBeTruthy();
      expect(toolUse!.name).toBe('calculator');
      expect(JSON.parse(toolUse!.arguments)).toEqual({ expression: '2+2' });
    });
  });
});
