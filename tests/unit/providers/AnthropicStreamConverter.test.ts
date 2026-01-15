/**
 * AnthropicStreamConverter Unit Tests
 * Tests conversion of Anthropic streaming events to our unified StreamEvent format
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AnthropicStreamConverter } from '@/infrastructure/providers/anthropic/AnthropicStreamConverter.js';
import { StreamEventType } from '@/domain/entities/StreamEvent.js';
import type Anthropic from '@anthropic-ai/sdk';

describe('AnthropicStreamConverter', () => {
  let converter: AnthropicStreamConverter;

  beforeEach(() => {
    converter = new AnthropicStreamConverter();
  });

  // Helper to create async iterable from events
  async function* createMockStream(events: Anthropic.MessageStreamEvent[]): AsyncIterable<Anthropic.MessageStreamEvent> {
    for (const event of events) {
      yield event;
    }
  }

  describe('message_start Event', () => {
    it('should convert message_start to RESPONSE_CREATED', async () => {
      const events: Anthropic.MessageStreamEvent[] = [
        {
          type: 'message_start',
          message: {
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [],
            model: 'claude-3-opus-20240229',
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 0 }
          }
        },
        { type: 'message_stop' }
      ];

      const stream = converter.convertStream(createMockStream(events), 'claude-3-opus-20240229');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      expect(results[0].type).toBe(StreamEventType.RESPONSE_CREATED);
      expect(results[0].response_id).toBe('msg_123');
      expect(results[0].model).toBe('claude-3-opus-20240229');
    });
  });

  describe('content_block_delta Event (Text)', () => {
    it('should convert text deltas to OUTPUT_TEXT_DELTA', async () => {
      const events: Anthropic.MessageStreamEvent[] = [
        {
          type: 'message_start',
          message: {
            id: 'msg_456',
            type: 'message',
            role: 'assistant',
            content: [],
            model: 'claude-3-opus-20240229',
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 0 }
          }
        },
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' }
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Hello' }
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: ' World' }
        },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_stop' }
      ];

      const stream = converter.convertStream(createMockStream(events), 'claude-3-opus-20240229');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      // Find text delta events
      const textDeltas = results.filter(e => e.type === StreamEventType.OUTPUT_TEXT_DELTA);

      expect(textDeltas).toHaveLength(2);
      expect(textDeltas[0].delta).toBe('Hello');
      expect(textDeltas[1].delta).toBe(' World');
    });

    it('should accumulate text deltas correctly', async () => {
      const events: Anthropic.MessageStreamEvent[] = [
        {
          type: 'message_start',
          message: {
            id: 'msg_acc',
            type: 'message',
            role: 'assistant',
            content: [],
            model: 'claude-3-opus',
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
          }
        },
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' }
        },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'A' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'B' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'C' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_stop' }
      ];

      const stream = converter.convertStream(createMockStream(events), 'claude-3-opus');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const textDeltas = results.filter(e => e.type === StreamEventType.OUTPUT_TEXT_DELTA);

      expect(textDeltas).toHaveLength(3);
      expect(textDeltas.map(e => e.delta).join('')).toBe('ABC');
    });
  });

  describe('Tool Use Content Blocks', () => {
    it('should convert content_block_start for tool_use to TOOL_CALL_START', async () => {
      const events: Anthropic.MessageStreamEvent[] = [
        {
          type: 'message_start',
          message: {
            id: 'msg_tool',
            type: 'message',
            role: 'assistant',
            content: [],
            model: 'claude-3-opus',
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
          }
        },
        {
          type: 'content_block_start',
          index: 0,
          content_block: {
            type: 'tool_use',
            id: 'tool_call_123',
            name: 'get_weather',
            input: {}
          }
        },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_stop' }
      ];

      const stream = converter.convertStream(createMockStream(events), 'claude-3-opus');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const toolStart = results.find(e => e.type === StreamEventType.TOOL_CALL_START);

      expect(toolStart).toBeDefined();
      expect(toolStart.tool_call_id).toBe('tool_call_123');
      expect(toolStart.tool_name).toBe('get_weather');
    });

    it('should convert input_json_delta to TOOL_CALL_ARGUMENTS_DELTA', async () => {
      const events: Anthropic.MessageStreamEvent[] = [
        {
          type: 'message_start',
          message: {
            id: 'msg_args',
            type: 'message',
            role: 'assistant',
            content: [],
            model: 'claude-3-opus',
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
          }
        },
        {
          type: 'content_block_start',
          index: 0,
          content_block: {
            type: 'tool_use',
            id: 'tool_xyz',
            name: 'calculator',
            input: {}
          }
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '{"a":' }
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '1,' }
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '"b":2}' }
        },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_stop' }
      ];

      const stream = converter.convertStream(createMockStream(events), 'claude-3-opus');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const argDeltas = results.filter(e => e.type === StreamEventType.TOOL_CALL_ARGUMENTS_DELTA);

      expect(argDeltas).toHaveLength(3);
      expect(argDeltas[0].delta).toBe('{"a":');
      expect(argDeltas[1].delta).toBe('1,');
      expect(argDeltas[2].delta).toBe('"b":2}');
    });

    it('should emit TOOL_CALL_ARGUMENTS_DONE on content_block_stop', async () => {
      const events: Anthropic.MessageStreamEvent[] = [
        {
          type: 'message_start',
          message: {
            id: 'msg_done',
            type: 'message',
            role: 'assistant',
            content: [],
            model: 'claude-3-opus',
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
          }
        },
        {
          type: 'content_block_start',
          index: 0,
          content_block: {
            type: 'tool_use',
            id: 'tool_done',
            name: 'final_tool',
            input: {}
          }
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '{"complete": true}' }
        },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_stop' }
      ];

      const stream = converter.convertStream(createMockStream(events), 'claude-3-opus');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const argsDone = results.find(e => e.type === StreamEventType.TOOL_CALL_ARGUMENTS_DONE);

      expect(argsDone).toBeDefined();
      expect(argsDone.tool_call_id).toBe('tool_done');
      expect(argsDone.arguments).toBe('{"complete": true}');
    });
  });

  describe('Usage and Completion', () => {
    it('should extract usage from message_delta event', async () => {
      const events: Anthropic.MessageStreamEvent[] = [
        {
          type: 'message_start',
          message: {
            id: 'msg_usage',
            type: 'message',
            role: 'assistant',
            content: [],
            model: 'claude-3-opus',
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 100, output_tokens: 0 }
          }
        },
        {
          type: 'message_delta',
          delta: { stop_reason: 'end_turn', stop_sequence: null },
          usage: { input_tokens: 100, output_tokens: 50 }
        } as any,
        { type: 'message_stop' }
      ];

      const stream = converter.convertStream(createMockStream(events), 'claude-3-opus');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const complete = results.find(e => e.type === StreamEventType.RESPONSE_COMPLETE);

      expect(complete).toBeDefined();
      expect(complete.usage.input_tokens).toBe(100);
      expect(complete.usage.output_tokens).toBe(50);
      expect(complete.usage.total_tokens).toBe(150);
    });

    it('should emit RESPONSE_COMPLETE on message_stop', async () => {
      const events: Anthropic.MessageStreamEvent[] = [
        {
          type: 'message_start',
          message: {
            id: 'msg_stop',
            type: 'message',
            role: 'assistant',
            content: [],
            model: 'claude-3-opus',
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
          }
        },
        { type: 'message_stop' }
      ];

      const stream = converter.convertStream(createMockStream(events), 'claude-3-opus');
      const results: any[] = [];

      for await (const event of stream) {
        results.push(event);
      }

      const complete = results.find(e => e.type === StreamEventType.RESPONSE_COMPLETE);

      expect(complete).toBeDefined();
      expect(complete.status).toBe('completed');
    });
  });

  describe('State Management', () => {
    it('should clear state after stream completes', async () => {
      const events: Anthropic.MessageStreamEvent[] = [
        {
          type: 'message_start',
          message: {
            id: 'msg_clear',
            type: 'message',
            role: 'assistant',
            content: [],
            model: 'claude-3-opus',
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
          }
        },
        { type: 'message_stop' }
      ];

      // First stream
      for await (const _ of converter.convertStream(createMockStream(events), 'claude-3-opus')) {
        // consume
      }

      // Clear and run second stream
      converter.clear();

      const secondEvents: Anthropic.MessageStreamEvent[] = [
        {
          type: 'message_start',
          message: {
            id: 'msg_second',
            type: 'message',
            role: 'assistant',
            content: [],
            model: 'claude-3-opus',
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
          }
        },
        { type: 'message_stop' }
      ];

      const results: any[] = [];
      for await (const event of converter.convertStream(createMockStream(secondEvents), 'claude-3-opus')) {
        results.push(event);
      }

      // Should have new response ID
      const responseCreated = results.find(e => e.type === StreamEventType.RESPONSE_CREATED);
      expect(responseCreated.response_id).toBe('msg_second');
    });

    it('should handle stream errors gracefully', async () => {
      async function* errorStream(): AsyncIterable<Anthropic.MessageStreamEvent> {
        yield {
          type: 'message_start',
          message: {
            id: 'msg_error',
            type: 'message',
            role: 'assistant',
            content: [],
            model: 'claude-3-opus',
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
          }
        };
        throw new Error('Stream interrupted');
      }

      const results: any[] = [];

      try {
        for await (const event of converter.convertStream(errorStream(), 'claude-3-opus')) {
          results.push(event);
        }
      } catch (error) {
        // Expected error
        expect((error as Error).message).toBe('Stream interrupted');
      }

      // Should have received RESPONSE_CREATED before error
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe(StreamEventType.RESPONSE_CREATED);
    });
  });
});
