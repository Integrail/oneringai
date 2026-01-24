/**
 * StreamHelpers Unit Tests
 * Tests stream processing utilities with comprehensive coverage
 */

import { describe, it, expect } from 'vitest';
import { StreamHelpers } from '@/capabilities/agents/StreamHelpers.js';
import {
  StreamEvent,
  StreamEventType,
  OutputTextDeltaEvent,
  ResponseCreatedEvent,
  ResponseCompleteEvent,
  ToolCallStartEvent,
  ToolCallArgumentsDeltaEvent,
  ToolCallArgumentsDoneEvent,
  ToolExecutionDoneEvent,
  IterationCompleteEvent,
} from '@/domain/entities/StreamEvent.js';
import { MessageRole } from '@/domain/entities/Message.js';
import { ContentType } from '@/domain/entities/Content.js';

describe('StreamHelpers', () => {
  // Helper function to create async generator from array
  async function* createStreamFromEvents(events: StreamEvent[]): AsyncIterableIterator<StreamEvent> {
    for (const event of events) {
      yield event;
    }
  }

  describe('collectResponse', () => {
    it('should collect complete response from stream with text only', async () => {
      const events: StreamEvent[] = [
        {
          type: StreamEventType.RESPONSE_CREATED,
          response_id: 'resp_123',
          model: 'gpt-4',
          created_at: Date.now(),
        } as ResponseCreatedEvent,
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: 'Hello',
        } as OutputTextDeltaEvent,
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: ' World',
        } as OutputTextDeltaEvent,
        {
          type: StreamEventType.RESPONSE_COMPLETE,
          status: 'completed',
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            total_tokens: 15,
          },
        } as ResponseCompleteEvent,
      ];

      const stream = createStreamFromEvents(events);
      const response = await StreamHelpers.collectResponse(stream);

      expect(response.id).toBe('resp_123');
      expect(response.model).toBe('gpt-4');
      expect(response.status).toBe('completed');
      expect(response.output_text).toBe('Hello World');
      expect(response.usage).toEqual({
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
      });
      expect(response.output).toHaveLength(1);
      expect(response.output[0].type).toBe('message');
    });

    it('should handle tool call events in stream', async () => {
      // Note: Tool calls are buffered but not added to output in current implementation
      // This tests that tool call events are processed without errors
      const events: StreamEvent[] = [
        {
          type: StreamEventType.RESPONSE_CREATED,
          response_id: 'resp_456',
          model: 'gpt-4',
          created_at: Date.now(),
        } as ResponseCreatedEvent,
        {
          type: StreamEventType.TOOL_CALL_START,
          tool_call_id: 'tc_1',
          tool_name: 'get_weather',
        } as ToolCallStartEvent,
        {
          type: StreamEventType.TOOL_CALL_ARGUMENTS_DELTA,
          tool_call_id: 'tc_1',
          delta: '{"location":',
        } as ToolCallArgumentsDeltaEvent,
        {
          type: StreamEventType.TOOL_CALL_ARGUMENTS_DELTA,
          tool_call_id: 'tc_1',
          delta: '"Paris"}',
        } as ToolCallArgumentsDeltaEvent,
        {
          type: StreamEventType.TOOL_CALL_ARGUMENTS_DONE,
          tool_call_id: 'tc_1',
        } as ToolCallArgumentsDoneEvent,
        {
          type: StreamEventType.TOOL_EXECUTION_DONE,
          tool_call_id: 'tc_1',
          result: { temp: 22, condition: 'sunny' },
        } as ToolExecutionDoneEvent,
        {
          type: StreamEventType.RESPONSE_COMPLETE,
          status: 'completed',
          usage: {
            input_tokens: 20,
            output_tokens: 10,
            total_tokens: 30,
          },
        } as ResponseCompleteEvent,
      ];

      const stream = createStreamFromEvents(events);
      const response = await StreamHelpers.collectResponse(stream);

      // Tool calls are processed but not in output (current implementation limitation)
      expect(response.id).toBe('resp_456');
      expect(response.status).toBe('completed');
      expect(response.usage.total_tokens).toBe(30);
    });

    it('should handle multiple iterations', async () => {
      const events: StreamEvent[] = [
        {
          type: StreamEventType.RESPONSE_CREATED,
          response_id: 'resp_789',
          model: 'gpt-4',
          created_at: Date.now(),
        } as ResponseCreatedEvent,
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: 'First',
        } as OutputTextDeltaEvent,
        {
          type: StreamEventType.ITERATION_COMPLETE,
        } as IterationCompleteEvent,
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_2',
          delta: 'Second',
        } as OutputTextDeltaEvent,
        {
          type: StreamEventType.ITERATION_COMPLETE,
        } as IterationCompleteEvent,
        {
          type: StreamEventType.RESPONSE_COMPLETE,
          status: 'completed',
          usage: {
            input_tokens: 15,
            output_tokens: 8,
            total_tokens: 23,
          },
        } as ResponseCompleteEvent,
      ];

      const stream = createStreamFromEvents(events);
      const response = await StreamHelpers.collectResponse(stream);

      expect(response.status).toBe('completed');
    });

    it('should throw error when no events received', async () => {
      async function* emptyStream(): AsyncIterableIterator<StreamEvent> {
        // Empty stream
      }

      await expect(StreamHelpers.collectResponse(emptyStream())).rejects.toThrow(
        'No stream events received'
      );
    });

    it('should handle stream with text and tool calls combined', async () => {
      const events: StreamEvent[] = [
        {
          type: StreamEventType.RESPONSE_CREATED,
          response_id: 'resp_combo',
          model: 'gpt-4',
          created_at: Date.now(),
        } as ResponseCreatedEvent,
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: 'Let me check the weather. ',
        } as OutputTextDeltaEvent,
        {
          type: StreamEventType.TOOL_CALL_START,
          tool_call_id: 'tc_1',
          tool_name: 'get_weather',
        } as ToolCallStartEvent,
        {
          type: StreamEventType.TOOL_CALL_ARGUMENTS_DELTA,
          tool_call_id: 'tc_1',
          delta: '{"location":"NYC"}',
        } as ToolCallArgumentsDeltaEvent,
        {
          type: StreamEventType.TOOL_CALL_ARGUMENTS_DONE,
          tool_call_id: 'tc_1',
        } as ToolCallArgumentsDoneEvent,
        {
          type: StreamEventType.RESPONSE_COMPLETE,
          status: 'completed',
          usage: {
            input_tokens: 25,
            output_tokens: 12,
            total_tokens: 37,
          },
        } as ResponseCompleteEvent,
      ];

      const stream = createStreamFromEvents(events);
      const response = await StreamHelpers.collectResponse(stream);

      expect(response.output_text).toContain('Let me check the weather');
      expect(response.output[0].type).toBe('message');
      if (response.output[0].type === 'message') {
        // Text content exists
        expect(response.output[0].content.length).toBeGreaterThanOrEqual(1);
        expect(response.output[0].content[0].type).toBe(ContentType.OUTPUT_TEXT);
      }
    });
  });

  describe('textOnly', () => {
    it('should yield only text deltas', async () => {
      const events: StreamEvent[] = [
        {
          type: StreamEventType.RESPONSE_CREATED,
          response_id: 'resp_1',
          model: 'gpt-4',
          created_at: Date.now(),
        } as ResponseCreatedEvent,
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: 'Hello',
        } as OutputTextDeltaEvent,
        {
          type: StreamEventType.TOOL_CALL_START,
          tool_call_id: 'tc_1',
          tool_name: 'test',
        } as ToolCallStartEvent,
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: ' World',
        } as OutputTextDeltaEvent,
      ];

      const stream = createStreamFromEvents(events);
      const texts: string[] = [];

      for await (const text of StreamHelpers.textOnly(stream)) {
        texts.push(text);
      }

      expect(texts).toEqual(['Hello', ' World']);
    });

    it('should handle stream with no text deltas', async () => {
      const events: StreamEvent[] = [
        {
          type: StreamEventType.RESPONSE_CREATED,
          response_id: 'resp_1',
          model: 'gpt-4',
          created_at: Date.now(),
        } as ResponseCreatedEvent,
        {
          type: StreamEventType.TOOL_CALL_START,
          tool_call_id: 'tc_1',
          tool_name: 'test',
        } as ToolCallStartEvent,
      ];

      const stream = createStreamFromEvents(events);
      const texts: string[] = [];

      for await (const text of StreamHelpers.textOnly(stream)) {
        texts.push(text);
      }

      expect(texts).toEqual([]);
    });
  });

  describe('filterByType', () => {
    it('should filter events by type', async () => {
      const events: StreamEvent[] = [
        {
          type: StreamEventType.RESPONSE_CREATED,
          response_id: 'resp_1',
          model: 'gpt-4',
          created_at: Date.now(),
        } as ResponseCreatedEvent,
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: 'Hello',
        } as OutputTextDeltaEvent,
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: ' World',
        } as OutputTextDeltaEvent,
        {
          type: StreamEventType.TOOL_CALL_START,
          tool_call_id: 'tc_1',
          tool_name: 'test',
        } as ToolCallStartEvent,
      ];

      const stream = createStreamFromEvents(events);
      const textEvents: StreamEvent[] = [];

      for await (const event of StreamHelpers.filterByType(
        stream,
        StreamEventType.OUTPUT_TEXT_DELTA
      )) {
        textEvents.push(event);
      }

      expect(textEvents).toHaveLength(2);
      expect(textEvents.every((e) => e.type === StreamEventType.OUTPUT_TEXT_DELTA)).toBe(true);
    });
  });

  describe('accumulateText', () => {
    it('should accumulate all text deltas into single string', async () => {
      const events: StreamEvent[] = [
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: 'Hello',
        } as OutputTextDeltaEvent,
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: ' ',
        } as OutputTextDeltaEvent,
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: 'World',
        } as OutputTextDeltaEvent,
        {
          type: StreamEventType.TOOL_CALL_START,
          tool_call_id: 'tc_1',
          tool_name: 'test',
        } as ToolCallStartEvent,
      ];

      const stream = createStreamFromEvents(events);
      const text = await StreamHelpers.accumulateText(stream);

      expect(text).toBe('Hello World');
    });

    it('should return empty string when no text deltas', async () => {
      const events: StreamEvent[] = [
        {
          type: StreamEventType.RESPONSE_CREATED,
          response_id: 'resp_1',
          model: 'gpt-4',
          created_at: Date.now(),
        } as ResponseCreatedEvent,
      ];

      const stream = createStreamFromEvents(events);
      const text = await StreamHelpers.accumulateText(stream);

      expect(text).toBe('');
    });
  });

  describe('bufferEvents', () => {
    it('should buffer events into batches', async () => {
      const events: StreamEvent[] = Array.from({ length: 10 }, (_, i) => ({
        type: StreamEventType.OUTPUT_TEXT_DELTA,
        item_id: 'msg_1',
        delta: `chunk${i}`,
      })) as OutputTextDeltaEvent[];

      const stream = createStreamFromEvents(events);
      const batches: StreamEvent[][] = [];

      for await (const batch of StreamHelpers.bufferEvents(stream, 3)) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(4); // 3 + 3 + 3 + 1
      expect(batches[0]).toHaveLength(3);
      expect(batches[1]).toHaveLength(3);
      expect(batches[2]).toHaveLength(3);
      expect(batches[3]).toHaveLength(1);
    });

    it('should yield remaining events in final batch', async () => {
      const events: StreamEvent[] = Array.from({ length: 5 }, (_, i) => ({
        type: StreamEventType.OUTPUT_TEXT_DELTA,
        item_id: 'msg_1',
        delta: `chunk${i}`,
      })) as OutputTextDeltaEvent[];

      const stream = createStreamFromEvents(events);
      const batches: StreamEvent[][] = [];

      for await (const batch of StreamHelpers.bufferEvents(stream, 2)) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(3); // 2 + 2 + 1
      expect(batches[2]).toHaveLength(1);
    });
  });

  describe('tap', () => {
    it('should call callback without consuming stream', async () => {
      const events: StreamEvent[] = [
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: 'Hello',
        } as OutputTextDeltaEvent,
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: ' World',
        } as OutputTextDeltaEvent,
      ];

      const stream = createStreamFromEvents(events);
      const tappedEvents: StreamEvent[] = [];
      const passedEvents: StreamEvent[] = [];

      const tappedStream = StreamHelpers.tap(stream, (event) => {
        tappedEvents.push(event);
      });

      for await (const event of tappedStream) {
        passedEvents.push(event);
      }

      expect(tappedEvents).toEqual(passedEvents);
      expect(tappedEvents).toHaveLength(2);
    });

    it('should support async callbacks', async () => {
      const events: StreamEvent[] = [
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: 'Test',
        } as OutputTextDeltaEvent,
      ];

      const stream = createStreamFromEvents(events);
      let callbackExecuted = false;

      const tappedStream = StreamHelpers.tap(stream, async (event) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        callbackExecuted = true;
      });

      for await (const event of tappedStream) {
        // Consume stream
      }

      expect(callbackExecuted).toBe(true);
    });
  });

  describe('take', () => {
    it('should take first N events', async () => {
      const events: StreamEvent[] = Array.from({ length: 10 }, (_, i) => ({
        type: StreamEventType.OUTPUT_TEXT_DELTA,
        item_id: 'msg_1',
        delta: `chunk${i}`,
      })) as OutputTextDeltaEvent[];

      const stream = createStreamFromEvents(events);
      const taken: StreamEvent[] = [];

      for await (const event of StreamHelpers.take(stream, 3)) {
        taken.push(event);
      }

      expect(taken).toHaveLength(3);
    });

    it('should handle count larger than stream length', async () => {
      const events: StreamEvent[] = [
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: 'Test',
        } as OutputTextDeltaEvent,
      ];

      const stream = createStreamFromEvents(events);
      const taken: StreamEvent[] = [];

      for await (const event of StreamHelpers.take(stream, 10)) {
        taken.push(event);
      }

      expect(taken).toHaveLength(1);
    });

    it('should take zero events', async () => {
      const events: StreamEvent[] = [
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: 'Test',
        } as OutputTextDeltaEvent,
      ];

      const stream = createStreamFromEvents(events);
      const taken: StreamEvent[] = [];

      for await (const event of StreamHelpers.take(stream, 0)) {
        taken.push(event);
      }

      expect(taken).toHaveLength(0);
    });
  });

  describe('skip', () => {
    it('should skip first N events', async () => {
      const events: StreamEvent[] = Array.from({ length: 5 }, (_, i) => ({
        type: StreamEventType.OUTPUT_TEXT_DELTA,
        item_id: 'msg_1',
        delta: `chunk${i}`,
      })) as OutputTextDeltaEvent[];

      const stream = createStreamFromEvents(events);
      const remaining: StreamEvent[] = [];

      for await (const event of StreamHelpers.skip(stream, 2)) {
        remaining.push(event);
      }

      expect(remaining).toHaveLength(3);
      expect((remaining[0] as OutputTextDeltaEvent).delta).toBe('chunk2');
    });

    it('should handle skip count larger than stream length', async () => {
      const events: StreamEvent[] = [
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: 'Test',
        } as OutputTextDeltaEvent,
      ];

      const stream = createStreamFromEvents(events);
      const remaining: StreamEvent[] = [];

      for await (const event of StreamHelpers.skip(stream, 10)) {
        remaining.push(event);
      }

      expect(remaining).toHaveLength(0);
    });

    it('should skip zero events', async () => {
      const events: StreamEvent[] = [
        {
          type: StreamEventType.OUTPUT_TEXT_DELTA,
          item_id: 'msg_1',
          delta: 'Test',
        } as OutputTextDeltaEvent,
      ];

      const stream = createStreamFromEvents(events);
      const remaining: StreamEvent[] = [];

      for await (const event of StreamHelpers.skip(stream, 0)) {
        remaining.push(event);
      }

      expect(remaining).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty stream for textOnly', async () => {
      async function* emptyStream(): AsyncIterableIterator<StreamEvent> {
        // Empty
      }

      const texts: string[] = [];
      for await (const text of StreamHelpers.textOnly(emptyStream())) {
        texts.push(text);
      }

      expect(texts).toEqual([]);
    });

    it('should handle combined stream operations', async () => {
      const events: StreamEvent[] = Array.from({ length: 20 }, (_, i) => ({
        type: StreamEventType.OUTPUT_TEXT_DELTA,
        item_id: 'msg_1',
        delta: `chunk${i}`,
      })) as OutputTextDeltaEvent[];

      const stream = createStreamFromEvents(events);

      // Skip first 5, take next 10, buffer into groups of 3
      const skipped = StreamHelpers.skip(stream, 5);
      const taken = StreamHelpers.take(skipped, 10);
      const buffered: StreamEvent[][] = [];

      for await (const batch of StreamHelpers.bufferEvents(taken, 3)) {
        buffered.push(batch);
      }

      expect(buffered).toHaveLength(4); // 3 + 3 + 3 + 1
      expect((buffered[0][0] as OutputTextDeltaEvent).delta).toBe('chunk5');
    });
  });
});
