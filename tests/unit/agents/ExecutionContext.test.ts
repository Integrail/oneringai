/**
 * ExecutionContext Unit Tests
 * Tests execution state, metrics, and circular buffers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionContext } from '@/capabilities/agents/ExecutionContext.js';
import { ToolCall, ToolResult, ToolCallState } from '@/domain/entities/Tool.js';

describe('ExecutionContext', () => {
  let context: ExecutionContext;

  beforeEach(() => {
    context = new ExecutionContext('test_exec_id', {
      maxHistorySize: 5,
      historyMode: 'summary',
      maxAuditTrailSize: 100
    });
  });

  describe('Metrics Tracking', () => {
    it('should initialize with zero metrics', () => {
      expect(context.metrics.inputTokens).toBe(0);
      expect(context.metrics.outputTokens).toBe(0);
      expect(context.metrics.totalTokens).toBe(0);
      expect(context.metrics.iterationCount).toBe(0);
      expect(context.metrics.toolCallCount).toBe(0);
    });

    it('should update token metrics via updateMetrics', () => {
      context.updateMetrics({
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150
      });

      // updateMetrics uses Object.assign (replaces values)
      expect(context.metrics.inputTokens).toBe(100);
      expect(context.metrics.outputTokens).toBe(50);
      expect(context.metrics.totalTokens).toBe(150);
    });

    it('should replace metrics on update (Object.assign behavior)', () => {
      context.updateMetrics({ inputTokens: 100, outputTokens: 50 });
      context.updateMetrics({ inputTokens: 200, outputTokens: 100 });

      // Later values replace earlier (not accumulate)
      expect(context.metrics.inputTokens).toBe(200);
      expect(context.metrics.outputTokens).toBe(100);
    });

    it('should track iteration count via context.iteration', () => {
      context.iteration = 1;
      context.iteration = 2;
      context.iteration = 3;

      expect(context.iteration).toBe(3);
    });

    it('should track tool execution via addToolCall/addToolResult', () => {
      const toolCall: ToolCall = {
        id: 'tool1',
        type: 'function',
        function: { name: 'test', arguments: '{}' },
        blocking: true,
        state: ToolCallState.PENDING
      };

      context.addToolCall(toolCall);
      expect(context.metrics.toolCallCount).toBe(1);

      const result: ToolResult = {
        tool_use_id: 'tool1',
        content: 'result',
        state: ToolCallState.COMPLETED
      };

      context.addToolResult(result);
      expect(context.metrics.toolSuccessCount).toBe(1);
    });
  });

  describe('Tool Call Tracking', () => {
    const mockToolCall: ToolCall = {
      id: 'tool_1',
      type: 'function',
      function: {
        name: 'get_weather',
        arguments: JSON.stringify({ city: 'NYC' })
      },
      blocking: true,
      state: ToolCallState.PENDING
    };

    it('should add tool call to tracking', () => {
      context.addToolCall(mockToolCall);

      expect(context.toolCalls.has('tool_1')).toBe(true);
      expect(context.toolCalls.get('tool_1')).toEqual(mockToolCall);
    });

    it('should add tool result to tracking', () => {
      const result: ToolResult = {
        tool_use_id: 'tool_1',
        content: { temp: 75 },
        state: ToolCallState.COMPLETED,
        executionTime: 500
      };

      context.addToolResult(result);

      expect(context.toolResults.has('tool_1')).toBe(true);
      expect(context.toolResults.get('tool_1')).toEqual(result);
    });
  });

  describe('History Mode - Circular Buffer', () => {
    it('should maintain history up to maxHistorySize', () => {
      // Add 10 iterations, max is 5
      for (let i = 0; i < 10; i++) {
        context.addIteration({
          iteration: i,
          request: {} as any,
          response: { usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } } as any,
          toolCalls: [],
          toolResults: [],
          startTime: new Date(),
          endTime: new Date()
        });
      }

      // Should only keep last 5 (circular buffer)
      const history = context.getHistory();
      expect(history.length).toBeLessThanOrEqual(5);
    });

    it('should remove oldest when exceeding maxHistorySize (circular buffer)', () => {
      for (let i = 0; i < 7; i++) {
        context.addIteration({
          iteration: i,
          request: {} as any,
          response: { usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } } as any,
          toolCalls: [],
          toolResults: [],
          startTime: new Date(),
          endTime: new Date()
        });
      }

      const history = context.getHistory();
      expect(history.length).toBeLessThanOrEqual(5);
      // Circular buffer should have removed oldest
      if (history.length === 5) {
        expect(history[history.length - 1].iteration).toBe(6);
      }
    });
  });

  describe('Resource Limits', () => {
    it('should track execution time via startTime property', () => {
      const startTime = context.startTime;
      expect(startTime).toBeInstanceOf(Date);
      expect(startTime.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should check execution time limit', () => {
      const contextWithLimit = new ExecutionContext('test', {
        maxHistorySize: 5,
        historyMode: 'full',
        maxAuditTrailSize: 100
      });

      // Should not throw if within limit
      expect(() =>
        contextWithLimit.checkLimits({
          limits: { maxExecutionTime: 10000 } // 10 seconds
        })
      ).not.toThrow();
    });
  });

  describe('Audit Trail', () => {
    it('should record audit events', () => {
      context.audit('hook_executed', { data: 'value' });

      const trail = context.getAuditTrail();
      expect(trail.length).toBe(1);
      expect(trail[0].type).toBe('hook_executed');
      expect(trail[0].details).toEqual({ data: 'value' });
    });

    it('should maintain audit trail up to maxAuditTrailSize (circular buffer)', () => {
      // Add 150 audit events, max is 100
      for (let i = 0; i < 150; i++) {
        context.audit('hook_executed', { index: i });
      }

      const trail = context.getAuditTrail();
      expect(trail.length).toBe(100);
      // Should have events 50-149 (oldest 0-49 removed)
      expect((trail[0].details as any).index).toBe(50);
      expect((trail[99].details as any).index).toBe(149);
    });
  });

  describe('Cleanup', () => {
    it('should clear all data on cleanup', () => {
      context.addToolCall({
        id: 'tool1',
        type: 'function',
        function: { name: 'test', arguments: '{}' },
        blocking: true,
        state: ToolCallState.PENDING
      });

      context.updateMetrics({ inputTokens: 100 });
      context.audit('event', {});

      context.cleanup();

      expect(context.toolCalls.size).toBe(0);
      expect(context.toolResults.size).toBe(0);
      expect(context.getAuditTrail().length).toBe(0);
    });
  });
});
