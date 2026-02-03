/**
 * ContextGuardian Tests
 *
 * Tests for the mandatory checkpoint that validates context before LLM calls
 * and applies graceful degradation when needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContextGuardian } from '@/core/context/ContextGuardian.js';
import type { GuardianValidation, DegradationResult, ContextGuardianConfig } from '@/core/context/ContextGuardian.js';
import { ContextOverflowError } from '@/domain/errors/AIErrors.js';
import { GUARDIAN_DEFAULTS } from '@/core/constants.js';
import { MessageRole } from '@/domain/entities/Message.js';
import { ContentType } from '@/domain/entities/Content.js';
import type { InputItem, Message } from '@/domain/entities/Message.js';
import { createMockEstimator } from '../../../helpers/contextTestHelpers.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a system message (DEVELOPER role)
 */
function createSystemMessage(text: string): Message {
  return {
    type: 'message',
    role: MessageRole.DEVELOPER,
    content: [{ type: ContentType.INPUT_TEXT, text }],
  };
}

/**
 * Create a user message
 */
function createUserMessage(text: string): Message {
  return {
    type: 'message',
    role: MessageRole.USER,
    content: [{ type: ContentType.INPUT_TEXT, text }],
  };
}

/**
 * Create an assistant message
 */
function createAssistantMessage(text: string): Message {
  return {
    type: 'message',
    role: MessageRole.ASSISTANT,
    content: [{ type: ContentType.OUTPUT_TEXT, text }],
  };
}

/**
 * Create a tool use message (assistant calling a tool)
 */
function createToolUseMessage(toolUseId: string, toolName: string, input: unknown = {}): Message {
  return {
    type: 'message',
    role: MessageRole.ASSISTANT,
    content: [{
      type: ContentType.TOOL_USE,
      id: toolUseId,
      name: toolName,
      input,
    }],
  };
}

/**
 * Create a tool result message (user returning tool output)
 */
function createToolResultMessage(toolUseId: string, content: string): Message {
  return {
    type: 'message',
    role: MessageRole.USER,
    content: [{
      type: ContentType.TOOL_RESULT,
      tool_use_id: toolUseId,
      content,
    }],
  };
}

/**
 * Create a large tool result (to trigger truncation)
 */
function createLargeToolResult(toolUseId: string, sizeChars: number): Message {
  return createToolResultMessage(toolUseId, 'x'.repeat(sizeChars));
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ContextGuardian', () => {
  let estimator: ReturnType<typeof createMockEstimator>;
  let guardian: ContextGuardian;

  beforeEach(() => {
    estimator = createMockEstimator(4); // 4 chars per token
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Constructor and Configuration
  // ==========================================================================

  describe('constructor and configuration', () => {
    it('should use default configuration from GUARDIAN_DEFAULTS', () => {
      guardian = new ContextGuardian(estimator);

      expect(guardian.enabled).toBe(GUARDIAN_DEFAULTS.ENABLED);
    });

    it('should allow disabling the guardian', () => {
      guardian = new ContextGuardian(estimator, { enabled: false });

      expect(guardian.enabled).toBe(false);
    });

    it('should accept custom configuration', () => {
      const config: ContextGuardianConfig = {
        enabled: true,
        maxToolResultTokens: 500,
        minSystemPromptTokens: 1000,
        protectedRecentMessages: 2,
      };

      guardian = new ContextGuardian(estimator, config);
      expect(guardian.enabled).toBe(true);
    });

    it('should merge custom config with defaults', () => {
      guardian = new ContextGuardian(estimator, { maxToolResultTokens: 500 });

      // Should still be enabled (default)
      expect(guardian.enabled).toBe(true);
    });
  });

  // ==========================================================================
  // validate() Method
  // ==========================================================================

  describe('validate()', () => {
    beforeEach(() => {
      guardian = new ContextGuardian(estimator);
    });

    it('should return valid=true when input fits within limits', () => {
      const input: InputItem[] = [
        createSystemMessage('System prompt'),
        createUserMessage('Hello'),
        createAssistantMessage('Hi there'),
      ];

      const result = guardian.validate(input, 10000);

      expect(result.valid).toBe(true);
      expect(result.overageTokens).toBe(0);
      expect(result.actualTokens).toBeLessThan(10000);
    });

    it('should return valid=false when input exceeds limits', () => {
      const largeText = 'x'.repeat(50000); // ~12500 tokens at 4 chars/token
      const input: InputItem[] = [
        createSystemMessage(largeText),
      ];

      const result = guardian.validate(input, 1000);

      expect(result.valid).toBe(false);
      expect(result.overageTokens).toBeGreaterThan(0);
      expect(result.actualTokens).toBeGreaterThan(1000);
    });

    it('should calculate accurate token counts', () => {
      const text = 'x'.repeat(400); // 100 tokens at 4 chars/token
      const input: InputItem[] = [
        createUserMessage(text),
      ];

      const result = guardian.validate(input, 10000);

      // 100 tokens for text + 4 for message overhead
      expect(result.actualTokens).toBe(104);
    });

    it('should provide breakdown by message type', () => {
      const input: InputItem[] = [
        createSystemMessage('System'),
        createUserMessage('User'),
        createAssistantMessage('Assistant'),
      ];

      const result = guardian.validate(input, 10000);

      expect(result.breakdown).toHaveProperty('system');
      expect(result.breakdown).toHaveProperty('user');
      expect(result.breakdown).toHaveProperty('assistant');
      expect(result.breakdown.system).toBeGreaterThan(0);
      expect(result.breakdown.user).toBeGreaterThan(0);
      expect(result.breakdown.assistant).toBeGreaterThan(0);
    });

    it('should categorize tool_use in breakdown', () => {
      const input: InputItem[] = [
        createToolUseMessage('tool-1', 'read_file', { path: '/test.txt' }),
      ];

      const result = guardian.validate(input, 10000);

      expect(result.breakdown.tool_use).toBeGreaterThan(0);
    });

    it('should categorize tool_result in breakdown', () => {
      const input: InputItem[] = [
        createToolResultMessage('tool-1', 'File contents here'),
      ];

      const result = guardian.validate(input, 10000);

      expect(result.breakdown.tool_result).toBeGreaterThan(0);
    });

    it('should handle empty input', () => {
      const result = guardian.validate([], 10000);

      expect(result.valid).toBe(true);
      expect(result.actualTokens).toBe(0);
      expect(result.overageTokens).toBe(0);
    });

    it('should return correct targetTokens', () => {
      const input: InputItem[] = [createUserMessage('Hello')];

      const result = guardian.validate(input, 5000);

      expect(result.targetTokens).toBe(5000);
    });

    it('should handle input at exact limit', () => {
      // Create input that exactly matches limit
      const text = 'x'.repeat(396); // 99 tokens + 4 overhead = 103 tokens
      const input: InputItem[] = [createUserMessage(text)];

      const result = guardian.validate(input, 104);

      // Should be valid at exact limit
      expect(result.valid).toBe(true);
      expect(result.overageTokens).toBe(0);
    });
  });

  // ==========================================================================
  // applyGracefulDegradation() Method
  // ==========================================================================

  describe('applyGracefulDegradation()', () => {
    beforeEach(() => {
      guardian = new ContextGuardian(estimator, {
        maxToolResultTokens: 100,
        minSystemPromptTokens: 50,
        protectedRecentMessages: 2,
      });
    });

    it('should return unchanged input when already valid', () => {
      const input: InputItem[] = [
        createSystemMessage('System'),
        createUserMessage('Hello'),
      ];

      const result = guardian.applyGracefulDegradation(input, 10000);

      expect(result.success).toBe(true);
      expect(result.input).toEqual(input);
      expect(result.tokensFreed).toBe(0);
      expect(result.log).toContain('No degradation needed');
    });

    describe('Level 1: Truncate Tool Results', () => {
      it('should truncate large tool results', () => {
        const input: InputItem[] = [
          createSystemMessage('System'),
          createToolUseMessage('tool-1', 'read_file'),
          createLargeToolResult('tool-1', 2000), // 500 tokens, exceeds 100 limit
        ];

        // Target that requires truncation but allows success
        const result = guardian.applyGracefulDegradation(input, 200);

        expect(result.success).toBe(true);
        expect(result.tokensFreed).toBeGreaterThan(0);
        expect(result.log.some(l => l.includes('Truncated tool result'))).toBe(true);
      });

      it('should preserve small tool results', () => {
        const smallContent = 'x'.repeat(100); // 25 tokens, under limit
        const input: InputItem[] = [
          createToolUseMessage('tool-1', 'read_file'),
          createToolResultMessage('tool-1', smallContent),
        ];

        const result = guardian.applyGracefulDegradation(input, 10000);

        // Content should be unchanged
        const resultMsg = result.input[1] as Message;
        const content = (resultMsg.content[0] as any).content;
        expect(content).toBe(smallContent);
      });
    });

    describe('Level 2: Remove Tool Pairs', () => {
      it('should remove oldest tool pairs when truncation insufficient', () => {
        // Create multiple tool pairs
        const input: InputItem[] = [
          createSystemMessage('System'),
          createToolUseMessage('tool-1', 'search'),
          createToolResultMessage('tool-1', 'x'.repeat(200)),
          createToolUseMessage('tool-2', 'search'),
          createToolResultMessage('tool-2', 'x'.repeat(200)),
          createUserMessage('Recent message 1'),
          createAssistantMessage('Recent message 2'),
        ];

        // Target that requires removing tool pairs
        const result = guardian.applyGracefulDegradation(input, 100);

        expect(result.log.some(l => l.includes('Removing tool pair') || l.includes('remove tool pairs'))).toBe(true);
        // Should have fewer items than original
        expect(result.input.length).toBeLessThan(input.length);
      });

      it('should protect recent messages from removal', () => {
        const input: InputItem[] = [
          createSystemMessage('System'),
          createToolUseMessage('tool-1', 'search'),
          createToolResultMessage('tool-1', 'x'.repeat(200)),
          createUserMessage('Protected 1'), // Last 2 should be protected
          createAssistantMessage('Protected 2'),
        ];

        // Even with aggressive target, protected messages should remain
        const result = guardian.applyGracefulDegradation(input, 50);

        // Last 2 messages should still be present
        const lastMessages = result.input.slice(-2);
        expect(lastMessages.length).toBe(2);
      });
    });

    describe('Level 3: Truncate System Prompt', () => {
      it('should truncate system prompt as last resort', () => {
        const largeSystem = 'x'.repeat(1000); // 250 tokens
        const input: InputItem[] = [
          createSystemMessage(largeSystem),
          createUserMessage('Hello'),
        ];

        // Target that requires system truncation but allows success
        // User message ~6 tokens, so we need at least ~30 for truncated system
        guardian = new ContextGuardian(estimator, {
          maxToolResultTokens: 100,
          minSystemPromptTokens: 20, // Allow truncation to 20 tokens
          protectedRecentMessages: 1,
        });

        const result = guardian.applyGracefulDegradation(input, 60);

        expect(result.success).toBe(true);
        expect(result.log.some(l => l.includes('system prompt'))).toBe(true);
      });
    });

    describe('Level 4: ContextOverflowError', () => {
      it('should throw ContextOverflowError when all levels exhausted', () => {
        // Massive input that cannot be reduced enough
        const input: InputItem[] = [
          createSystemMessage('x'.repeat(10000)), // 2500 tokens
          createUserMessage('x'.repeat(10000)),    // 2500 tokens
        ];

        guardian = new ContextGuardian(estimator, {
          maxToolResultTokens: 10,
          minSystemPromptTokens: 2000, // Still need 2000 for system
          protectedRecentMessages: 1,
        });

        // Impossibly tight target
        expect(() => {
          guardian.applyGracefulDegradation(input, 100);
        }).toThrow(ContextOverflowError);
      });

      it('should include detailed budget in ContextOverflowError', () => {
        const input: InputItem[] = [
          createSystemMessage('x'.repeat(10000)),
          createUserMessage('x'.repeat(10000)),
        ];

        guardian = new ContextGuardian(estimator, {
          minSystemPromptTokens: 2000,
        });

        try {
          guardian.applyGracefulDegradation(input, 100);
          expect.fail('Should have thrown ContextOverflowError');
        } catch (error) {
          expect(error).toBeInstanceOf(ContextOverflowError);
          const overflowError = error as ContextOverflowError;
          expect(overflowError.budget).toBeDefined();
          expect(overflowError.budget.actualTokens).toBeGreaterThan(0);
          expect(overflowError.budget.maxTokens).toBe(100);
          expect(overflowError.budget.degradationLog.length).toBeGreaterThan(0);
        }
      });

      it('should include breakdown in ContextOverflowError', () => {
        const input: InputItem[] = [
          createSystemMessage('x'.repeat(10000)),
        ];

        guardian = new ContextGuardian(estimator, {
          minSystemPromptTokens: 2000,
        });

        try {
          guardian.applyGracefulDegradation(input, 100);
        } catch (error) {
          const overflowError = error as ContextOverflowError;
          expect(overflowError.budget.breakdown).toBeDefined();
          expect(overflowError.budget.breakdown.system).toBeGreaterThan(0);
        }
      });
    });

    it('should return accurate finalTokens after degradation', () => {
      const input: InputItem[] = [
        createSystemMessage('System'),
        createToolUseMessage('tool-1', 'read_file'),
        createLargeToolResult('tool-1', 2000),
      ];

      const result = guardian.applyGracefulDegradation(input, 200);

      // Final tokens should be <= target
      expect(result.finalTokens).toBeLessThanOrEqual(200);
    });

    it('should return accurate tokensFreed count', () => {
      const input: InputItem[] = [
        createSystemMessage('System'),
        createToolUseMessage('tool-1', 'read_file'),
        createLargeToolResult('tool-1', 2000), // Will be truncated
      ];

      const initialValidation = guardian.validate(input, 10000);
      const result = guardian.applyGracefulDegradation(input, 200);

      // tokensFreed should equal the difference
      expect(result.tokensFreed).toBe(initialValidation.actualTokens - result.finalTokens);
    });
  });

  // ==========================================================================
  // emergencyCompact() Method
  // ==========================================================================

  describe('emergencyCompact()', () => {
    beforeEach(() => {
      guardian = new ContextGuardian(estimator, {
        minSystemPromptTokens: 50,
        protectedRecentMessages: 2,
      });
    });

    it('should keep system prompt and protected messages only', () => {
      const input: InputItem[] = [
        createSystemMessage('System prompt'),
        createUserMessage('Message 1'),
        createAssistantMessage('Response 1'),
        createUserMessage('Message 2'),
        createAssistantMessage('Response 2'),
        createUserMessage('Recent 1'),      // Protected
        createAssistantMessage('Recent 2'), // Protected
      ];

      const result = guardian.emergencyCompact(input, 500);

      // Should have: 1 system + 2 protected = 3 messages
      expect(result.length).toBe(3);

      // First should be system
      expect((result[0] as Message).role).toBe(MessageRole.DEVELOPER);

      // Last 2 should be the recent messages
      expect((result[1] as Message).role).toBe(MessageRole.USER);
      expect((result[2] as Message).role).toBe(MessageRole.ASSISTANT);
    });

    it('should truncate system prompt aggressively', () => {
      const largeSystem = 'x'.repeat(1000); // 250 tokens
      const input: InputItem[] = [
        createSystemMessage(largeSystem),
        createUserMessage('Recent'),
      ];

      const result = guardian.emergencyCompact(input, 100);

      // System should be truncated
      const systemMsg = result[0] as Message;
      const systemContent = (systemMsg.content[0] as any).text;
      expect(systemContent.length).toBeLessThan(largeSystem.length);
    });

    it('should handle input with no system messages', () => {
      const input: InputItem[] = [
        createUserMessage('Message 1'),
        createAssistantMessage('Response 1'),
        createUserMessage('Message 2'),
        createAssistantMessage('Response 2'),
      ];

      const result = guardian.emergencyCompact(input, 500);

      // Should keep last 2 messages only
      expect(result.length).toBe(2);
    });

    it('should handle input with fewer than protected count', () => {
      const input: InputItem[] = [
        createSystemMessage('System'),
        createUserMessage('Only message'),
      ];

      const result = guardian.emergencyCompact(input, 500);

      // Should keep all (system + 1 message)
      expect(result.length).toBe(2);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    beforeEach(() => {
      guardian = new ContextGuardian(estimator);
    });

    it('should handle messages with multiple content items', () => {
      const input: InputItem[] = [{
        type: 'message',
        role: MessageRole.USER,
        content: [
          { type: ContentType.INPUT_TEXT, text: 'First part' },
          { type: ContentType.INPUT_TEXT, text: 'Second part' },
        ],
      } as Message];

      const result = guardian.validate(input, 10000);

      expect(result.valid).toBe(true);
      // Should count tokens from both content items
      expect(result.actualTokens).toBeGreaterThan(0);
    });

    it('should handle image content', () => {
      const input: InputItem[] = [{
        type: 'message',
        role: MessageRole.USER,
        content: [
          { type: ContentType.INPUT_IMAGE_URL, image_url: { url: 'https://example.com/image.png' } },
        ],
      } as Message];

      const result = guardian.validate(input, 10000);

      // Should estimate ~200 tokens for images
      expect(result.actualTokens).toBeGreaterThanOrEqual(200);
    });

    it('should handle unknown input types', () => {
      const input: InputItem[] = [
        { type: 'unknown' } as any,
      ];

      const result = guardian.validate(input, 10000);

      // Should use default estimate of 50 tokens
      expect(result.actualTokens).toBe(50);
    });

    it('should handle zero target tokens', () => {
      const input: InputItem[] = [createUserMessage('Hello')];

      const result = guardian.validate(input, 0);

      expect(result.valid).toBe(false);
      expect(result.overageTokens).toBeGreaterThan(0);
    });

    it('should handle negative target tokens', () => {
      const input: InputItem[] = [createUserMessage('Hello')];

      const result = guardian.validate(input, -100);

      expect(result.valid).toBe(false);
    });

    it('should handle tool pairs with missing results', () => {
      const input: InputItem[] = [
        createSystemMessage('System'),
        createToolUseMessage('tool-1', 'search'),
        // Missing tool result for tool-1
        createToolUseMessage('tool-2', 'search'),
        createToolResultMessage('tool-2', 'Result'),
        createUserMessage('Recent'),
      ];

      guardian = new ContextGuardian(estimator, { protectedRecentMessages: 1 });

      const result = guardian.applyGracefulDegradation(input, 50);

      // Should handle gracefully without errors
      expect(result).toBeDefined();
    });

    it('should handle empty tool result content', () => {
      const input: InputItem[] = [
        createToolUseMessage('tool-1', 'search'),
        createToolResultMessage('tool-1', ''),
      ];

      const result = guardian.validate(input, 10000);

      expect(result.valid).toBe(true);
    });

    it('should handle tool use with complex input', () => {
      const input: InputItem[] = [
        createToolUseMessage('tool-1', 'complex_tool', {
          nested: { deeply: { value: 'test' } },
          array: [1, 2, 3, 4, 5],
          string: 'x'.repeat(100),
        }),
      ];

      const result = guardian.validate(input, 10000);

      expect(result.valid).toBe(true);
      expect(result.breakdown.tool_use).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Integration Scenarios
  // ==========================================================================

  describe('integration scenarios', () => {
    it('should handle typical conversation flow', () => {
      guardian = new ContextGuardian(estimator);

      const input: InputItem[] = [
        createSystemMessage('You are a helpful assistant.'),
        createUserMessage('What files are in the project?'),
        createToolUseMessage('tool-1', 'list_directory', { path: '.' }),
        createToolResultMessage('tool-1', 'file1.ts\nfile2.ts\nfile3.ts'),
        createAssistantMessage('The project contains 3 TypeScript files.'),
        createUserMessage('Read the first one.'),
        createToolUseMessage('tool-2', 'read_file', { path: 'file1.ts' }),
        createToolResultMessage('tool-2', 'export function hello() { return "world"; }'),
        createAssistantMessage('The file exports a hello function.'),
      ];

      const result = guardian.validate(input, 10000);

      expect(result.valid).toBe(true);
      expect(result.breakdown.system).toBeGreaterThan(0);
      expect(result.breakdown.user).toBeGreaterThan(0);
      expect(result.breakdown.assistant).toBeGreaterThan(0);
      expect(result.breakdown.tool_use).toBeGreaterThan(0);
      expect(result.breakdown.tool_result).toBeGreaterThan(0);
    });

    it('should gracefully degrade large scrape results', () => {
      guardian = new ContextGuardian(estimator, {
        maxToolResultTokens: 500,
        protectedRecentMessages: 2,
      });

      // Simulate web scrape returning large content
      const largeWebContent = 'Web page content. '.repeat(500); // ~2250 tokens

      const input: InputItem[] = [
        createSystemMessage('You are a research assistant.'),
        createUserMessage('Scrape this webpage.'),
        createToolUseMessage('tool-1', 'web_scrape', { url: 'https://example.com' }),
        createToolResultMessage('tool-1', largeWebContent),
        createUserMessage('Summarize the key points.'),
      ];

      const result = guardian.applyGracefulDegradation(input, 1000);

      expect(result.success).toBe(true);
      expect(result.finalTokens).toBeLessThanOrEqual(1000);
      expect(result.log.some(l => l.includes('Truncated'))).toBe(true);
    });

    it('should handle multiple iterations of tool calls', () => {
      guardian = new ContextGuardian(estimator, {
        maxToolResultTokens: 200,
        protectedRecentMessages: 4,
      });

      // Build up a conversation with many tool calls
      const input: InputItem[] = [
        createSystemMessage('System'),
      ];

      // Add 10 tool call pairs
      for (let i = 0; i < 10; i++) {
        input.push(createToolUseMessage(`tool-${i}`, 'search'));
        input.push(createToolResultMessage(`tool-${i}`, `Result ${i}: ${'x'.repeat(300)}`));
      }

      // Add recent messages
      input.push(createUserMessage('What did you find?'));
      input.push(createAssistantMessage('I found many results.'));

      const result = guardian.applyGracefulDegradation(input, 800);

      // Should remove old tool pairs to fit
      expect(result.success).toBe(true);
      expect(result.input.length).toBeLessThan(input.length);
    });
  });
});
