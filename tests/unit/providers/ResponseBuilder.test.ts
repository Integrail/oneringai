/**
 * Tests for Shared Response Builder Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  buildLLMResponse,
  extractTextFromContent,
  createTextContent,
  createToolUseContent,
  mapAnthropicStatus,
  mapGoogleStatus,
  mapOpenAIStatus,
  generateToolCallId,
} from '../../../src/infrastructure/providers/shared/ResponseBuilder.js';
import { ContentType } from '../../../src/domain/entities/Content.js';
import { MessageRole } from '../../../src/domain/entities/Message.js';

describe('ResponseBuilder', () => {
  describe('buildLLMResponse', () => {
    it('should build a complete LLMResponse', () => {
      const content = [createTextContent('Hello, world!')];

      const response = buildLLMResponse({
        provider: 'test',
        rawId: '123',
        model: 'test-model',
        status: 'completed',
        content,
        usage: {
          inputTokens: 10,
          outputTokens: 5,
        },
      });

      expect(response.id).toBe('resp_test_123');
      expect(response.object).toBe('response');
      expect(response.status).toBe('completed');
      expect(response.model).toBe('test-model');
      expect(response.output_text).toBe('Hello, world!');
      expect(response.usage.input_tokens).toBe(10);
      expect(response.usage.output_tokens).toBe(5);
      expect(response.usage.total_tokens).toBe(15);
    });

    it('should generate ID when rawId not provided', () => {
      const response = buildLLMResponse({
        provider: 'anthropic',
        model: 'claude',
        status: 'completed',
        content: [],
        usage: { inputTokens: 0, outputTokens: 0 },
      });

      expect(response.id).toMatch(/^resp_anthropic_/);
    });

    it('should use provided totalTokens when given', () => {
      const response = buildLLMResponse({
        provider: 'test',
        model: 'test',
        status: 'completed',
        content: [],
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 20, // Custom total (e.g., includes cached tokens)
        },
      });

      expect(response.usage.total_tokens).toBe(20);
    });

    it('should include assistant message in output', () => {
      const content = [createTextContent('Test')];

      const response = buildLLMResponse({
        provider: 'test',
        model: 'test',
        status: 'completed',
        content,
        usage: { inputTokens: 0, outputTokens: 0 },
      });

      expect(response.output).toHaveLength(1);
      expect(response.output[0].type).toBe('message');
      expect(response.output[0].role).toBe(MessageRole.ASSISTANT);
      expect(response.output[0].content).toEqual(content);
    });
  });

  describe('extractTextFromContent', () => {
    it('should extract text from content array', () => {
      const content = [
        createTextContent('Hello'),
        createToolUseContent('1', 'test_tool', {}),
        createTextContent('World'),
      ];

      const text = extractTextFromContent(content);
      expect(text).toBe('Hello\nWorld');
    });

    it('should return empty string for empty content', () => {
      const text = extractTextFromContent([]);
      expect(text).toBe('');
    });

    it('should return empty string for content with no text', () => {
      const content = [createToolUseContent('1', 'tool', {})];
      const text = extractTextFromContent(content);
      expect(text).toBe('');
    });
  });

  describe('createTextContent', () => {
    it('should create text content with annotations', () => {
      const content = createTextContent('Hello');

      expect(content.type).toBe(ContentType.OUTPUT_TEXT);
      expect(content.text).toBe('Hello');
      expect(content.annotations).toEqual([]);
    });
  });

  describe('createToolUseContent', () => {
    it('should create tool_use content from object args', () => {
      const content = createToolUseContent('tool-123', 'get_weather', {
        location: 'Paris',
      });

      expect(content.type).toBe(ContentType.TOOL_USE);
      expect(content.id).toBe('tool-123');
      expect(content.name).toBe('get_weather');
      expect(content.arguments).toBe('{"location":"Paris"}');
    });

    it('should create tool_use content from string args', () => {
      const content = createToolUseContent(
        'tool-456',
        'calculate',
        '{"a":1,"b":2}'
      );

      expect(content.arguments).toBe('{"a":1,"b":2}');
    });
  });

  describe('mapOpenAIStatus', () => {
    it('should map completed status', () => {
      expect(mapOpenAIStatus('completed')).toBe('completed');
    });

    it('should map incomplete status', () => {
      expect(mapOpenAIStatus('incomplete')).toBe('incomplete');
    });

    it('should map failed status', () => {
      expect(mapOpenAIStatus('failed')).toBe('failed');
      expect(mapOpenAIStatus('cancelled')).toBe('failed');
    });

    it('should default to completed for unknown status', () => {
      expect(mapOpenAIStatus(undefined)).toBe('completed');
      expect(mapOpenAIStatus('unknown')).toBe('completed');
    });
  });

  describe('mapAnthropicStatus', () => {
    it('should map end_turn to completed', () => {
      expect(mapAnthropicStatus('end_turn')).toBe('completed');
    });

    it('should map tool_use to completed', () => {
      expect(mapAnthropicStatus('tool_use')).toBe('completed');
    });

    it('should map stop_sequence to completed', () => {
      expect(mapAnthropicStatus('stop_sequence')).toBe('completed');
    });

    it('should map max_tokens to incomplete', () => {
      expect(mapAnthropicStatus('max_tokens')).toBe('incomplete');
    });

    it('should default to incomplete for unknown', () => {
      expect(mapAnthropicStatus(null)).toBe('incomplete');
      expect(mapAnthropicStatus('unknown')).toBe('incomplete');
    });
  });

  describe('mapGoogleStatus', () => {
    it('should map STOP to completed', () => {
      expect(mapGoogleStatus('STOP')).toBe('completed');
    });

    it('should map MAX_TOKENS to incomplete', () => {
      expect(mapGoogleStatus('MAX_TOKENS')).toBe('incomplete');
    });

    it('should map SAFETY to failed', () => {
      expect(mapGoogleStatus('SAFETY')).toBe('failed');
    });

    it('should map RECITATION to failed', () => {
      expect(mapGoogleStatus('RECITATION')).toBe('failed');
    });

    it('should default to incomplete for unknown', () => {
      expect(mapGoogleStatus(undefined)).toBe('incomplete');
      expect(mapGoogleStatus('OTHER')).toBe('incomplete');
    });
  });

  describe('generateToolCallId', () => {
    it('should generate ID with provider prefix', () => {
      const id = generateToolCallId('google');
      expect(id).toMatch(/^google_[0-9a-f-]+$/);
    });

    it('should generate ID without prefix when no provider', () => {
      const id = generateToolCallId();
      expect(id).toMatch(/^[0-9a-f-]+$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateToolCallId('test');
      const id2 = generateToolCallId('test');
      expect(id1).not.toBe(id2);
    });
  });
});
