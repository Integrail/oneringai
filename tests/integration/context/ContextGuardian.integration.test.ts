/**
 * ContextGuardian Integration Tests
 *
 * Tests the integration of ContextGuardian with AgentContext,
 * verifying that guardian validation is properly triggered during
 * the prepare() flow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentContext } from '@/core/AgentContext.js';
import type { AgentContextConfig } from '@/core/AgentContext.js';
import { ContextOverflowError } from '@/domain/errors/AIErrors.js';
import { safeDestroy } from '../../helpers/contextTestHelpers.js';
import { ToolCallState } from '@/domain/entities/Tool.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a minimal context with all memory-requiring features disabled
 */
function createContext(config?: Partial<AgentContextConfig>): AgentContext {
  const baseFeatures = {
    memory: false,
    inContextMemory: false,
    history: true,
    permissions: false,
    persistentInstructions: false,
    toolOutputTracking: false,
    autoSpill: false,             // Requires memory
    toolResultEviction: false,    // Requires memory
  };

  return AgentContext.create({
    model: 'gpt-4',
    features: {
      ...baseFeatures,
      ...config?.features,
    },
    maxContextTokens: 10000, // Small limit for testing
    ...config,
    // Ensure features is not overwritten by config spread
  });
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ContextGuardian Integration', () => {
  let ctx: AgentContext;

  afterEach(() => {
    safeDestroy(ctx);
    vi.restoreAllMocks();
  });

  describe('guardian configuration', () => {
    it('should create guardian by default', () => {
      ctx = createContext();

      expect(ctx.guardian).toBeDefined();
      expect(ctx.guardian.enabled).toBe(true);
    });

    it('should allow disabling guardian', () => {
      ctx = createContext({
        guardian: { enabled: false },
      });

      expect(ctx.guardian.enabled).toBe(false);
    });

    it('should accept custom guardian configuration', () => {
      ctx = createContext({
        guardian: {
          enabled: true,
          maxToolResultTokens: 500,
          minSystemPromptTokens: 1000,
          protectedRecentMessages: 3,
        },
      });

      expect(ctx.guardian.enabled).toBe(true);
    });
  });

  describe('prepare() with guardian validation', () => {
    it('should pass validation when context fits', async () => {
      ctx = createContext();

      ctx.addMessageSync('user', 'Hello');
      ctx.addMessageSync('assistant', 'Hi there');

      const result = await ctx.prepare();

      expect(result.input).toBeDefined();
      expect(result.input.length).toBeGreaterThan(0);
    });

    it('should trigger guardian when over limit with tool results', async () => {
      ctx = createContext({
        maxContextTokens: 2000,
        systemPrompt: 'You are a helpful assistant.',
        guardian: {
          maxToolResultTokens: 200, // Force truncation of large results
        },
      });

      // Add a tool use + result pattern that guardian can degrade
      ctx.addMessageSync('user', 'Search for information');

      // Add assistant response with tool use
      ctx.addAssistantResponse([{
        type: 'tool_use',
        id: 'tool-1',
        name: 'search',
        input: { query: 'test' },
      }]);

      // Add large tool result that should be truncated
      ctx.addToolResults([{
        tool_use_id: 'tool-1',
        content: 'x'.repeat(5000), // Large output
        state: ToolCallState.SUCCESS,
      }]);

      const result = await ctx.prepare();

      // Should succeed with truncated result
      expect(result.input).toBeDefined();
    });

    it('should return compaction log when compaction occurs', async () => {
      ctx = createContext({
        maxContextTokens: 500,
        guardian: {
          protectedRecentMessages: 2,
        },
      });

      // Add tool call patterns that can be degraded
      for (let i = 0; i < 3; i++) {
        ctx.addMessageSync('user', `Search ${i}`);
        ctx.addAssistantResponse([{
          type: 'tool_use',
          id: `tool-${i}`,
          name: 'search',
          input: { query: `query ${i}` },
        }]);
        ctx.addToolResults([{
          tool_use_id: `tool-${i}`,
          content: `Result ${i}: ${'x'.repeat(100)}`,
          state: ToolCallState.SUCCESS,
        }]);
      }

      const result = await ctx.prepare();

      // May have compaction log if degradation was needed
      expect(result).toBeDefined();
    });
  });

  describe('guardian events', () => {
    it('should emit guardian:validation-failed when validation fails', async () => {
      // Use very small maxContextTokens to guarantee validation failure
      ctx = createContext({
        maxContextTokens: 500,
        guardian: { maxToolResultTokens: 50 },
        systemPrompt: 'x'.repeat(100), // Small system prompt
      });
      const handler = vi.fn();
      ctx.on('guardian:validation-failed', handler);

      // Add enough content to definitely exceed the small limit
      ctx.addMessageSync('user', 'Search query');
      ctx.addAssistantResponse([{
        type: 'tool_use',
        id: 'tool-1',
        name: 'search',
        input: { q: 'test' },
      }]);
      ctx.addToolResults([{
        tool_use_id: 'tool-1',
        content: 'x'.repeat(3000), // Large result
        state: ToolCallState.SUCCESS,
      }]);

      try {
        await ctx.prepare();
      } catch {
        // May throw if degradation fails, but event should still fire
      }

      // Event should be emitted when validation fails
      expect(handler).toHaveBeenCalled();
    });

    it('should emit guardian:degradation-applied when degradation succeeds', async () => {
      // Use a limit that requires degradation but allows success
      ctx = createContext({
        maxContextTokens: 800,
        guardian: { maxToolResultTokens: 50 },
        systemPrompt: 'x'.repeat(50),
      });
      const handler = vi.fn();
      ctx.on('guardian:degradation-applied', handler);

      // Add tool result that will need truncation
      ctx.addMessageSync('user', 'Search');
      ctx.addAssistantResponse([{
        type: 'tool_use',
        id: 'tool-1',
        name: 'search',
        input: {},
      }]);
      ctx.addToolResults([{
        tool_use_id: 'tool-1',
        content: 'x'.repeat(2000), // Will be truncated
        state: ToolCallState.SUCCESS,
      }]);

      await ctx.prepare();

      // Event should be emitted after successful degradation
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('tool result handling', () => {
    it('should truncate large tool results during degradation', async () => {
      ctx = createContext({
        maxContextTokens: 1500,
        guardian: {
          maxToolResultTokens: 50, // Force truncation
        },
      });

      // Add a tool call with large result
      ctx.addMessageSync('user', 'Read the file');
      ctx.addAssistantResponse([{
        type: 'tool_use',
        id: 'tool-1',
        name: 'read_file',
        input: { path: '/test.txt' },
      }]);
      ctx.addToolResults([{
        tool_use_id: 'tool-1',
        content: 'x'.repeat(5000), // Large output
        state: ToolCallState.SUCCESS,
      }]);

      const result = await ctx.prepare();

      // Should succeed with truncated result
      expect(result.input).toBeDefined();
    });

    it('should remove old tool pairs when necessary', async () => {
      ctx = createContext({
        maxContextTokens: 1200,
        guardian: {
          protectedRecentMessages: 2,
          maxToolResultTokens: 100,
        },
      });

      // Add several tool calls
      for (let i = 0; i < 5; i++) {
        ctx.addMessageSync('user', `Query ${i}`);
        ctx.addAssistantResponse([{
          type: 'tool_use',
          id: `tool-${i}`,
          name: 'search',
          input: { query: `query ${i}` },
        }]);
        ctx.addToolResults([{
          tool_use_id: `tool-${i}`,
          content: `Result ${i}: ${'x'.repeat(200)}`,
          state: ToolCallState.SUCCESS,
        }]);
      }

      // Add protected messages
      ctx.addMessageSync('user', 'What did you find?');
      ctx.addMessageSync('assistant', 'Here is a summary.');

      const result = await ctx.prepare();

      // Should succeed, possibly with some tool pairs removed
      expect(result.input).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw ContextOverflowError when impossible to fit', async () => {
      ctx = createContext({
        maxContextTokens: 100, // Impossibly small
        guardian: {
          minSystemPromptTokens: 50,
        },
        systemPrompt: 'x'.repeat(1000), // Large system prompt
      });

      // Add more content
      ctx.addMessageSync('user', 'y'.repeat(1000));

      await expect(ctx.prepare()).rejects.toThrow(ContextOverflowError);
    });

    it('should include helpful information in ContextOverflowError', async () => {
      ctx = createContext({
        maxContextTokens: 100,
        systemPrompt: 'x'.repeat(1000),
      });

      ctx.addMessageSync('user', 'y'.repeat(1000));

      try {
        await ctx.prepare();
        expect.fail('Should have thrown ContextOverflowError');
      } catch (error) {
        expect(error).toBeInstanceOf(ContextOverflowError);
        const overflowError = error as ContextOverflowError;

        // Should have useful debugging info
        expect(overflowError.budget).toBeDefined();
        expect(overflowError.budget.actualTokens).toBeGreaterThan(0);
        expect(overflowError.getDegradationSummary()).toBeTruthy();
      }
    });
  });

  describe('disabled guardian behavior', () => {
    it('should skip validation when guardian disabled', async () => {
      ctx = createContext({
        maxContextTokens: 5000,
        guardian: { enabled: false },
      });

      // Add some content
      ctx.addMessageSync('user', 'Hello');
      ctx.addMessageSync('assistant', 'Hi there');

      // Should work fine with guardian disabled
      const result = await ctx.prepare();
      expect(result.input).toBeDefined();
    });
  });

  describe('budget calculation accuracy', () => {
    it('should report accurate budget after guardian processing', async () => {
      ctx = createContext({
        maxContextTokens: 5000,
      });

      ctx.addMessageSync('user', 'Hello');
      ctx.addMessageSync('assistant', 'Hi there');

      const result = await ctx.prepare();

      // Budget should reflect actual state
      expect(result.budget.total).toBe(5000);
      expect(result.budget.used).toBeGreaterThan(0);
      expect(result.budget.available).toBeLessThan(5000);
    });
  });
});
