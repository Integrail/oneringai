/**
 * GoogleStreamConverter Unit Tests
 * Tests conversion of Google Gemini streaming responses to our unified StreamEvent format
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GoogleStreamConverter } from '@/infrastructure/providers/google/GoogleStreamConverter.js';
import { StreamEventType } from '@/domain/entities/StreamEvent.js';
import type { GenerateContentResponse } from '@google/genai';

describe('GoogleStreamConverter', () => {
  let converter: GoogleStreamConverter;

  beforeEach(() => {
    converter = new GoogleStreamConverter();
  });

  // Helper to create async iterable from chunks
  async function* createMockStream(chunks: GenerateContentResponse[]): AsyncIterable<GenerateContentResponse> {
    for (const chunk of chunks) {
      yield chunk;
    }
  }

  // Helper to create a basic text chunk
  const createTextChunk = (text: string, usage?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }): GenerateContentResponse => ({
    candidates: [{
      content: {
        parts: [{ text }],
        role: 'model'
      },
      finishReason: undefined,
      index: 0,
      safetyRatings: []
    }],
    usageMetadata: usage
  } as unknown as GenerateContentResponse);

  // Helper to create a function call chunk
  const createFunctionCallChunk = (name: string, args: Record<string, any>): GenerateContentResponse => ({
    candidates: [{
      content: {
        parts: [{
          functionCall: {
            name,
            args
          }
        }],
        role: 'model'
      },
      finishReason: undefined,
      index: 0,
      safetyRatings: []
    }],
    usageMetadata: undefined
  } as unknown as GenerateContentResponse);

  describe('Response Creation', () => {
    it('should emit RESPONSE_CREATED on first chunk', async () => {
      const chunks = [
        createTextChunk('Hello')
      ];

      const stream = converter.convertStream(createMockStream(chunks), 'gemini-1.5-pro');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const responseCreated = results.find(e => e.type === StreamEventType.RESPONSE_CREATED);

      expect(responseCreated).toBeDefined();
      expect(responseCreated.model).toBe('gemini-1.5-pro');
      expect(responseCreated.response_id).toMatch(/^resp_google_/);
    });

    it('should only emit RESPONSE_CREATED once', async () => {
      const chunks = [
        createTextChunk('Hello'),
        createTextChunk(' World'),
        createTextChunk('!')
      ];

      const stream = converter.convertStream(createMockStream(chunks), 'gemini-1.5-pro');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const responseCreatedEvents = results.filter(e => e.type === StreamEventType.RESPONSE_CREATED);

      expect(responseCreatedEvents).toHaveLength(1);
    });
  });

  describe('Text Streaming', () => {
    it('should convert text chunks to OUTPUT_TEXT_DELTA', async () => {
      const chunks = [
        createTextChunk('Hello'),
        createTextChunk(' World')
      ];

      const stream = converter.convertStream(createMockStream(chunks), 'gemini-1.5-pro');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const textDeltas = results.filter(e => e.type === StreamEventType.OUTPUT_TEXT_DELTA);

      expect(textDeltas).toHaveLength(2);
      expect(textDeltas[0].delta).toBe('Hello');
      expect(textDeltas[1].delta).toBe(' World');
    });

    it('should accumulate text deltas correctly', async () => {
      const chunks = [
        createTextChunk('A'),
        createTextChunk('B'),
        createTextChunk('C'),
        createTextChunk('D')
      ];

      const stream = converter.convertStream(createMockStream(chunks), 'gemini-1.5-pro');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const textDeltas = results.filter(e => e.type === StreamEventType.OUTPUT_TEXT_DELTA);
      const fullText = textDeltas.map(e => e.delta).join('');

      expect(fullText).toBe('ABCD');
    });

    it('should assign sequential sequence numbers', async () => {
      const chunks = [
        createTextChunk('One'),
        createTextChunk('Two'),
        createTextChunk('Three')
      ];

      const stream = converter.convertStream(createMockStream(chunks), 'gemini-1.5-pro');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const textDeltas = results.filter(e => e.type === StreamEventType.OUTPUT_TEXT_DELTA);

      expect(textDeltas[0].sequence_number).toBe(0);
      expect(textDeltas[1].sequence_number).toBe(1);
      expect(textDeltas[2].sequence_number).toBe(2);
    });
  });

  describe('Function Call Streaming', () => {
    it('should emit TOOL_CALL_START for function calls', async () => {
      const chunks = [
        createFunctionCallChunk('get_weather', { city: 'NYC' })
      ];

      const stream = converter.convertStream(createMockStream(chunks), 'gemini-1.5-pro');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const toolStart = results.find(e => e.type === StreamEventType.TOOL_CALL_START);

      expect(toolStart).toBeDefined();
      expect(toolStart.tool_name).toBe('get_weather');
      expect(toolStart.tool_call_id).toMatch(/^call_resp_google_.*_get_weather$/);
    });

    it('should emit TOOL_CALL_ARGUMENTS_DELTA with JSON args', async () => {
      const chunks = [
        createFunctionCallChunk('calculator', { operation: 'add', a: 5, b: 3 })
      ];

      const stream = converter.convertStream(createMockStream(chunks), 'gemini-1.5-pro');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const argsDelta = results.find(e => e.type === StreamEventType.TOOL_CALL_ARGUMENTS_DELTA);

      expect(argsDelta).toBeDefined();
      expect(argsDelta.tool_name).toBe('calculator');
      // Args should be JSON string
      expect(JSON.parse(argsDelta.delta)).toEqual({ operation: 'add', a: 5, b: 3 });
    });

    it('should emit TOOL_CALL_ARGUMENTS_DONE at stream end', async () => {
      const chunks = [
        createFunctionCallChunk('search', { query: 'test' })
      ];

      const stream = converter.convertStream(createMockStream(chunks), 'gemini-1.5-pro');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const argsDone = results.find(e => e.type === StreamEventType.TOOL_CALL_ARGUMENTS_DONE);

      expect(argsDone).toBeDefined();
      expect(argsDone.tool_name).toBe('search');
      expect(JSON.parse(argsDone.arguments)).toEqual({ query: 'test' });
    });

    it('should handle multiple function calls', async () => {
      const chunks = [
        createFunctionCallChunk('tool_a', { x: 1 }),
        createFunctionCallChunk('tool_b', { y: 2 })
      ];

      const stream = converter.convertStream(createMockStream(chunks), 'gemini-1.5-pro');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const toolStarts = results.filter(e => e.type === StreamEventType.TOOL_CALL_START);

      expect(toolStarts).toHaveLength(2);
      expect(toolStarts[0].tool_name).toBe('tool_a');
      expect(toolStarts[1].tool_name).toBe('tool_b');
    });
  });

  describe('Usage Metadata', () => {
    it('should extract usage from final chunk', async () => {
      const chunks = [
        createTextChunk('Hello', { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }),
        createTextChunk(' World', { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 })
      ];

      const stream = converter.convertStream(createMockStream(chunks), 'gemini-1.5-pro');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const complete = results.find(e => e.type === StreamEventType.RESPONSE_COMPLETE);

      expect(complete).toBeDefined();
      expect(complete.usage.input_tokens).toBe(10);
      expect(complete.usage.output_tokens).toBe(10);
      expect(complete.usage.total_tokens).toBe(20);
    });

    it('should handle missing usage metadata', async () => {
      const chunks = [
        createTextChunk('No usage info')
      ];

      const stream = converter.convertStream(createMockStream(chunks), 'gemini-1.5-pro');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const complete = results.find(e => e.type === StreamEventType.RESPONSE_COMPLETE);

      expect(complete).toBeDefined();
      expect(complete.usage.input_tokens).toBe(0);
      expect(complete.usage.output_tokens).toBe(0);
      expect(complete.usage.total_tokens).toBe(0);
    });
  });

  describe('Completion', () => {
    it('should emit RESPONSE_COMPLETE at end of stream', async () => {
      const chunks = [
        createTextChunk('Done')
      ];

      const stream = converter.convertStream(createMockStream(chunks), 'gemini-1.5-pro');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const complete = results.find(e => e.type === StreamEventType.RESPONSE_COMPLETE);

      expect(complete).toBeDefined();
      expect(complete.status).toBe('completed');
      expect(complete.iterations).toBe(1);
    });
  });

  describe('State Management', () => {
    it('should clear state after stream', async () => {
      const chunks1 = [createTextChunk('First')];

      for await (const _ of converter.convertStream(createMockStream(chunks1), 'gemini-1.5-pro')) {
        // consume
      }

      converter.clear();

      const chunks2 = [createTextChunk('Second')];
      const results: any[] = [];

      for await (const event of converter.convertStream(createMockStream(chunks2), 'gemini-1.5-pro')) {
        results.push(event);
      }

      // Should have new response ID
      const responseCreated = results.find(e => e.type === StreamEventType.RESPONSE_CREATED);
      expect(responseCreated.response_id).toMatch(/^resp_google_/);

      // Sequence numbers should reset
      const textDelta = results.find(e => e.type === StreamEventType.OUTPUT_TEXT_DELTA);
      expect(textDelta.sequence_number).toBe(0);
    });

    it('should handle stream interruption', async () => {
      async function* errorStream(): AsyncIterable<GenerateContentResponse> {
        yield createTextChunk('Before error');
        throw new Error('Stream interrupted');
      }

      const results: any[] = [];

      try {
        for await (const event of converter.convertStream(errorStream(), 'gemini-1.5-pro')) {
          results.push(event);
        }
      } catch (error) {
        expect((error as Error).message).toBe('Stream interrupted');
      }

      // Should have received some events before error
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(e => e.type === StreamEventType.RESPONSE_CREATED)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty candidates array', async () => {
      const chunks: GenerateContentResponse[] = [{
        candidates: [],
        usageMetadata: undefined
      } as unknown as GenerateContentResponse];

      const stream = converter.convertStream(createMockStream(chunks), 'gemini-1.5-pro');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      // Should still emit RESPONSE_CREATED and RESPONSE_COMPLETE
      expect(results.some(e => e.type === StreamEventType.RESPONSE_CREATED)).toBe(true);
      expect(results.some(e => e.type === StreamEventType.RESPONSE_COMPLETE)).toBe(true);

      // But no text deltas
      expect(results.filter(e => e.type === StreamEventType.OUTPUT_TEXT_DELTA)).toHaveLength(0);
    });

    it('should handle undefined parts', async () => {
      const chunks: GenerateContentResponse[] = [{
        candidates: [{
          content: {
            parts: undefined,
            role: 'model'
          },
          finishReason: undefined,
          index: 0,
          safetyRatings: []
        }],
        usageMetadata: undefined
      } as unknown as GenerateContentResponse];

      const stream = converter.convertStream(createMockStream(chunks), 'gemini-1.5-pro');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      // Should not throw and still emit basic events
      expect(results.some(e => e.type === StreamEventType.RESPONSE_CREATED)).toBe(true);
    });

    it('should handle function call with unknown name', async () => {
      const chunks: GenerateContentResponse[] = [{
        candidates: [{
          content: {
            parts: [{
              functionCall: {
                name: undefined,
                args: { test: true }
              }
            }],
            role: 'model'
          },
          finishReason: undefined,
          index: 0,
          safetyRatings: []
        }],
        usageMetadata: undefined
      } as unknown as GenerateContentResponse];

      const stream = converter.convertStream(createMockStream(chunks), 'gemini-1.5-pro');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const toolStart = results.find(e => e.type === StreamEventType.TOOL_CALL_START);
      expect(toolStart?.tool_name).toBe('unknown');
    });
  });
});
