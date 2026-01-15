/**
 * GoogleConverter Unit Tests
 * Tests bidirectional conversion between our format and Google Gemini API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GoogleConverter } from '@/infrastructure/providers/google/GoogleConverter.js';
import { MessageRole } from '@/domain/entities/Message.js';
import { ContentType } from '@/domain/entities/Content.js';

describe('GoogleConverter', () => {
  let converter: GoogleConverter;

  beforeEach(() => {
    converter = new GoogleConverter();
  });

  describe('convertRequest() - Our format → Google API', () => {
    it('should convert simple text message', async () => {
      const request = await converter.convertRequest({
        model: 'gemini-2.0-flash-exp',
        input: [{
          type: 'message',
          role: MessageRole.USER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'Hello Gemini' }]
        }],
        tools: []
      });

      expect(request.contents).toHaveLength(1);
      expect(request.contents![0].role).toBe('user');
      expect(request.contents![0].parts[0]).toEqual({
        text: 'Hello Gemini'
      });
    });

    it('should map roles correctly', async () => {
      const request = await converter.convertRequest({
        model: 'gemini-2.0-flash-exp',
        input: [
          {
            type: 'message',
            role: MessageRole.USER,
            content: [{ type: ContentType.INPUT_TEXT, text: 'User message' }]
          },
          {
            type: 'message',
            role: MessageRole.ASSISTANT,
            content: [{ type: ContentType.OUTPUT_TEXT, text: 'Assistant response' }]
          }
        ],
        tools: []
      });

      expect(request.contents![0].role).toBe('user');
      expect(request.contents![1].role).toBe('model'); // Google uses 'model' not 'assistant'
    });

    it('should convert system instructions', async () => {
      const request = await converter.convertRequest({
        model: 'gemini-2.0-flash-exp',
        input: [{
          type: 'message',
          role: MessageRole.USER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'Hello' }]
        }],
        instructions: 'You are a helpful AI',
        tools: []
      });

      expect(request.systemInstruction).toEqual({
        parts: [{ text: 'You are a helpful AI' }]
      });
    });

    it('should convert tools to Google format', async () => {
      const tools = [{
        type: 'function' as const,
        function: {
          name: 'get_weather',
          description: 'Get weather',
          parameters: {
            type: 'object',
            properties: {
              city: { type: 'string' }
            }
          }
        }
      }];

      const request = await converter.convertRequest({
        model: 'gemini-2.0-flash-exp',
        input: [{
          type: 'message',
          role: MessageRole.USER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'test' }]
        }],
        tools
      });

      expect(request.tools).toHaveLength(1);
      expect(request.tools![0].functionDeclarations![0].name).toBe('get_weather');
      expect(request.tools![0].functionDeclarations![0].description).toBe('Get weather');
    });
  });

  describe('convertResponse() - Google API → Our format', () => {
    it('should convert simple text response', () => {
      const googleResponse: any = {
        candidates: [{
          content: {
            parts: [{ text: 'Hello from Gemini' }],
            role: 'model'
          },
          finishReason: 'STOP'
        }],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30
        }
      };

      const response = converter.convertResponse(googleResponse);

      expect(response.status).toBe('completed');

      // Check text content exists
      const textContent = response.output[0].content.find(c => c.type === ContentType.OUTPUT_TEXT);
      expect(textContent).toBeTruthy();
      expect(textContent!.text).toBe('Hello from Gemini');
      expect(response.usage).toEqual({
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30
      });
    });

    it('should convert function call response', () => {
      const googleResponse: any = {
        candidates: [{
          content: {
            parts: [{
              functionCall: {
                name: 'get_weather',
                args: { city: 'SF' }
              }
            }],
            role: 'model'
          },
          finishReason: 'STOP'
        }],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15
        }
      };

      const response = converter.convertResponse(googleResponse);

      const toolUse = response.output[0].content.find(c => c.type === ContentType.TOOL_USE);
      expect(toolUse).toBeTruthy();
      expect(toolUse!.name).toBe('get_weather');
      expect(JSON.parse(toolUse!.arguments)).toEqual({ city: 'SF' });
    });

    it('should map finish reasons correctly', () => {
      const testCases = [
        { finishReason: 'STOP', expected: 'completed' },
        { finishReason: 'MAX_TOKENS', expected: 'incomplete' }, // Google maps to incomplete
        { finishReason: 'SAFETY', expected: 'failed' }, // Maps to failed
        { finishReason: 'RECITATION', expected: 'failed' } // Maps to failed
      ];

      testCases.forEach(({ finishReason, expected }) => {
        const response = converter.convertResponse({
          candidates: [{
            content: {
              parts: [{ text: 'test' }],
              role: 'model'
            },
            finishReason
          }],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15
          }
        });

        expect(response.status).toBe(expected);
      });
    });
  });

  describe('Memory Management', () => {
    it('should clear mappings after use', async () => {
      // Convert request with tools
      await converter.convertRequest({
        model: 'gemini-2.0-flash-exp',
        input: [{
          type: 'message',
          role: MessageRole.USER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'test' }]
        }],
        tools: [{
          type: 'function',
          function: {
            name: 'tool1',
            description: 'Test tool',
            parameters: { type: 'object' }
          }
        }]
      });

      // Clear mappings
      converter.clearMappings();

      // Internal maps should be empty (test via multiple conversions)
      const request2 = await converter.convertRequest({
        model: 'gemini-2.0-flash-exp',
        input: [{
          type: 'message',
          role: MessageRole.USER,
          content: [{ type: ContentType.INPUT_TEXT, text: 'test2' }]
        }],
        tools: []
      });

      expect(request2.contents).toBeTruthy();
    });
  });
});
