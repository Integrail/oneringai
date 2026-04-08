/**
 * Tests for the pre-flight context limit guardrail.
 */

import { describe, it, expect, vi } from 'vitest';
import { enforceContextLimit } from '@/infrastructure/providers/shared/enforceContextLimit.js';
import type { TextGenerateOptions, ModelCapabilities } from '@/domain/interfaces/ITextProvider.js';
import type { InputItem } from '@/domain/entities/Message.js';
import { MessageRole } from '@/domain/entities/Message.js';
import { ContentType } from '@/domain/entities/Content.js';

// ─── Helpers ──────────────────────────────────────────────────────────

function makeCapabilities(overrides: Partial<ModelCapabilities> = {}): ModelCapabilities {
  return {
    supportsTools: true,
    supportsVision: false,
    supportsJSON: false,
    supportsJSONSchema: false,
    maxTokens: 128_000,
    maxInputTokens: 128_000,
    maxOutputTokens: 4_096,
    ...overrides,
  };
}

function makeOptions(overrides: Partial<TextGenerateOptions> = {}): TextGenerateOptions {
  return {
    model: 'test-model',
    input: 'Hello world',
    ...overrides,
  };
}

function makeMessage(role: MessageRole, text: string): InputItem {
  return {
    type: 'message',
    role,
    content: [{ type: ContentType.INPUT_TEXT, text }],
  };
}

function makeLongString(tokens: number): string {
  // ~3.5 chars per token
  return 'x'.repeat(Math.ceil(tokens * 3.5));
}

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => mockLogger),
  fatal: vi.fn(),
  trace: vi.fn(),
  silent: vi.fn(),
  level: 'debug' as const,
} as any;

// ─── Tests ────────────────────────────────────────────────────────────

describe('enforceContextLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('happy path (within budget)', () => {
    it('returns the same options reference when input fits', () => {
      const options = makeOptions({ input: 'short input' });
      const caps = makeCapabilities();
      const result = enforceContextLimit(options, caps, mockLogger);
      expect(result).toBe(options); // identity check — zero allocation
    });

    it('does not log a warning when within budget', () => {
      const options = makeOptions({ input: 'short input' });
      enforceContextLimit(options, makeCapabilities(), mockLogger);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('handles empty string input', () => {
      const options = makeOptions({ input: '' });
      const result = enforceContextLimit(options, makeCapabilities(), mockLogger);
      expect(result).toBe(options);
    });

    it('handles empty array input', () => {
      const options = makeOptions({ input: [] });
      const result = enforceContextLimit(options, makeCapabilities(), mockLogger);
      expect(result).toBe(options);
    });
  });

  describe('string input over budget', () => {
    it('truncates from the beginning, preserving the tail', () => {
      const caps = makeCapabilities({ maxInputTokens: 100, maxOutputTokens: 20 });
      // Budget = 100 - 20 = 80 tokens for everything
      const longInput = makeLongString(200); // way over budget
      const options = makeOptions({ input: longInput });

      const result = enforceContextLimit(options, caps, mockLogger);

      expect(result).not.toBe(options);
      expect(typeof result.input).toBe('string');
      expect((result.input as string).length).toBeLessThan(longInput.length);
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    it('adds truncation marker', () => {
      const caps = makeCapabilities({ maxInputTokens: 100, maxOutputTokens: 20 });
      const longInput = makeLongString(200);
      const options = makeOptions({ input: longInput });

      const result = enforceContextLimit(options, caps, mockLogger);
      expect((result.input as string)).toContain('[...truncated');
    });
  });

  describe('InputItem[] over budget', () => {
    it('removes oldest items from the middle, keeps first and last', () => {
      const caps = makeCapabilities({ maxInputTokens: 200, maxOutputTokens: 50 });
      // Budget = 200 - 50 = 150 tokens

      const items: InputItem[] = [
        makeMessage(MessageRole.DEVELOPER, makeLongString(30)),  // first: keep
        makeMessage(MessageRole.USER, makeLongString(50)),       // middle: removable
        makeMessage(MessageRole.ASSISTANT, makeLongString(50)),  // middle: removable
        makeMessage(MessageRole.USER, makeLongString(50)),       // middle: removable
        makeMessage(MessageRole.USER, makeLongString(30)),       // last: keep
      ];

      const options = makeOptions({ input: items });
      const result = enforceContextLimit(options, caps, mockLogger);

      expect(result).not.toBe(options);
      const resultItems = result.input as InputItem[];
      // Should have removed some middle items
      expect(resultItems.length).toBeLessThan(items.length);
      // First and last preserved
      expect(resultItems[0]).toBe(items[0]);
      expect(resultItems[resultItems.length - 1]).toBe(items[items.length - 1]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('truncates last item text when removing middle items is insufficient', () => {
      const caps = makeCapabilities({ maxInputTokens: 100, maxOutputTokens: 20 });
      // Budget = 80 tokens

      const items: InputItem[] = [
        makeMessage(MessageRole.DEVELOPER, makeLongString(20)),
        makeMessage(MessageRole.USER, makeLongString(200)), // huge last item
      ];

      const options = makeOptions({ input: items });
      const result = enforceContextLimit(options, caps, mockLogger);

      const resultItems = result.input as InputItem[];
      expect(resultItems.length).toBe(2); // both kept (nothing in between to remove)
      // Last item should have been truncated
      const lastMsg = resultItems[1] as any;
      expect(lastMsg.content[0].text).toContain('[...truncated');
    });

    it('handles single-item array', () => {
      const caps = makeCapabilities({ maxInputTokens: 100, maxOutputTokens: 20 });

      const items: InputItem[] = [
        makeMessage(MessageRole.USER, makeLongString(200)),
      ];

      const options = makeOptions({ input: items });
      const result = enforceContextLimit(options, caps, mockLogger);

      const resultItems = result.input as InputItem[];
      expect(resultItems.length).toBe(1);
    });
  });

  describe('budget calculation', () => {
    it('accounts for instructions tokens in budget', () => {
      const caps = makeCapabilities({ maxInputTokens: 100, maxOutputTokens: 20 });
      const instructions = makeLongString(50); // 50 tokens of instructions
      const input = makeLongString(40); // 40 tokens of input, total = 90 > 80 budget

      const options = makeOptions({ input, instructions });
      const result = enforceContextLimit(options, caps, mockLogger);

      expect(result).not.toBe(options);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('accounts for tools tokens in budget', () => {
      const caps = makeCapabilities({ maxInputTokens: 200, maxOutputTokens: 20 });
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'big_tool',
            description: makeLongString(100), // huge tool description
            parameters: { type: 'object', properties: {} },
          },
        },
      ];
      const input = makeLongString(100);

      const options = makeOptions({ input, tools });
      const result = enforceContextLimit(options, caps, mockLogger);

      expect(result).not.toBe(options);
    });

    it('uses max_output_tokens from options when provided', () => {
      const caps = makeCapabilities({ maxInputTokens: 200, maxOutputTokens: 10 });
      const input = makeLongString(120);

      // With default maxOutputTokens=10, budget=190, should fit
      const optionsFit = makeOptions({ input });
      expect(enforceContextLimit(optionsFit, caps, mockLogger)).toBe(optionsFit);

      // With explicit max_output_tokens=100, budget=100, should NOT fit
      const optionsNoFit = makeOptions({ input, max_output_tokens: 100 });
      expect(enforceContextLimit(optionsNoFit, caps, mockLogger)).not.toBe(optionsNoFit);
    });

    it('falls back to maxTokens when maxInputTokens is undefined', () => {
      const caps = makeCapabilities({ maxInputTokens: undefined, maxTokens: 100, maxOutputTokens: 20 });
      const input = makeLongString(200);

      const options = makeOptions({ input });
      const result = enforceContextLimit(options, caps, mockLogger);

      expect(result).not.toBe(options);
    });

    it('defaults to 4096 response reserve when maxOutputTokens is undefined', () => {
      const caps = makeCapabilities({ maxInputTokens: 10000, maxOutputTokens: undefined });
      // Budget = 10000 - 4096 = 5904

      const input = makeLongString(6000); // over 5904 budget
      const options = makeOptions({ input });
      const result = enforceContextLimit(options, caps, mockLogger);

      expect(result).not.toBe(options);
    });
  });

  describe('edge cases', () => {
    it('skips guardrail when budget cannot be determined (maxAllowed <= 0)', () => {
      const caps = makeCapabilities({ maxInputTokens: 10, maxOutputTokens: 100 });
      // maxAllowed = 10 - 100 = -90
      const options = makeOptions({ input: makeLongString(1000) });

      const result = enforceContextLimit(options, caps, mockLogger);
      expect(result).toBe(options); // returned as-is
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('returns as-is when instructions + tools alone exceed budget', () => {
      const caps = makeCapabilities({ maxInputTokens: 100, maxOutputTokens: 20 });
      const instructions = makeLongString(90); // instructions alone fill budget

      const options = makeOptions({ input: 'hi', instructions });
      const result = enforceContextLimit(options, caps, mockLogger);

      // Can't help — returns original
      expect(result).toBe(options);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('preserves all other options fields in the returned object', () => {
      const caps = makeCapabilities({ maxInputTokens: 100, maxOutputTokens: 20 });
      const options = makeOptions({
        input: makeLongString(200),
        temperature: 0.5,
        instructions: 'Be helpful',
        model: 'my-model',
      });

      const result = enforceContextLimit(options, caps, mockLogger);

      expect(result.temperature).toBe(0.5);
      expect(result.instructions).toBe('Be helpful');
      expect(result.model).toBe('my-model');
    });
  });
});
