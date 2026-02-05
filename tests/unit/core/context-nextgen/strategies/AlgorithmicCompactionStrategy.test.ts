/**
 * AlgorithmicCompactionStrategy Tests
 *
 * Tests for the algorithmic compaction strategy that:
 * - Moves large tool results to Working Memory
 * - Limits tool pairs in conversation
 * - Applies rolling window compaction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlgorithmicCompactionStrategy } from '@/core/context-nextgen/strategies/AlgorithmicCompactionStrategy.js';
import { StrategyRegistry } from '@/core/context-nextgen/strategies/StrategyRegistry.js';
import type { CompactionContext, CompactionResult, ConsolidationResult } from '@/core/context-nextgen/types.js';

// Mock Working Memory Plugin
function createMockWorkingMemory() {
  const storage = new Map<string, { description: string; value: unknown }>();

  return {
    name: 'working_memory',
    store: vi.fn(async (key: string, description: string, value: unknown) => {
      storage.set(key, { description, value });
      return { key, sizeBytes: JSON.stringify(value).length };
    }),
    retrieve: vi.fn(async (key: string) => storage.get(key)?.value),
    delete: vi.fn(async (key: string) => storage.delete(key)),
    getStorage: () => storage,
    // Plugin interface methods
    getInstructions: () => '',
    getInstructionsTokenSize: () => 0,
    getContent: () => undefined,
    getContentTokenSize: () => 0,
    getTools: () => [],
    serialize: () => ({}),
    restore: async () => {},
    isCompactable: () => true,
    compact: async () => 0,
  };
}

// Create a tool_use message
function createToolUseMessage(toolUseId: string, toolName: string, input: unknown): unknown {
  return {
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: toolUseId,
        name: toolName,
        input,
      },
    ],
  };
}

// Create a tool_result message
function createToolResultMessage(toolUseId: string, content: unknown): unknown {
  return {
    type: 'message',
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content,
      },
    ],
  };
}

// Create a regular user message
function createUserMessage(text: string): unknown {
  return {
    type: 'message',
    role: 'user',
    content: text,
  };
}

// Create a mock CompactionContext
function createMockContext(
  conversation: unknown[],
  mockMemory: ReturnType<typeof createMockWorkingMemory>
): CompactionContext {
  const removedIndices: number[] = [];

  return {
    budget: {
      maxTokens: 128000,
      responseReserve: 4096,
      systemMessageTokens: 1000,
      toolsTokens: 500,
      conversationTokens: 5000,
      currentInputTokens: 100,
      totalUsed: 6600,
      available: 121400,
      utilizationPercent: 5,
      breakdown: {
        systemPrompt: 500,
        persistentInstructions: 0,
        pluginInstructions: 300,
        pluginContents: {},
        tools: 500,
        conversation: 5000,
        currentInput: 100,
      },
    },
    conversation: conversation as ReadonlyArray<unknown>,
    currentInput: [],
    plugins: [mockMemory] as unknown[],
    strategyName: 'algorithmic',
    removeMessages: vi.fn(async (indices: number[]) => {
      removedIndices.push(...indices);
      // Estimate tokens freed (rough calculation)
      let freed = 0;
      for (const idx of indices) {
        const item = conversation[idx];
        if (item) {
          freed += JSON.stringify(item).length / 4; // Rough token estimate
        }
      }
      return freed;
    }),
    compactPlugin: vi.fn(async () => 0),
    estimateTokens: vi.fn((item: unknown) => {
      return Math.ceil(JSON.stringify(item).length / 4);
    }),
    getRemovedIndices: () => removedIndices,
  } as unknown as CompactionContext & { getRemovedIndices: () => number[] };
}

describe('AlgorithmicCompactionStrategy', () => {
  beforeEach(() => {
    StrategyRegistry._reset();
  });

  describe('Strategy Properties', () => {
    it('should have correct metadata', () => {
      const strategy = new AlgorithmicCompactionStrategy();

      expect(strategy.name).toBe('algorithmic');
      expect(strategy.displayName).toBe('Algorithmic');
      expect(strategy.description).toContain('working memory');
      expect(strategy.threshold).toBe(0.75);
      expect(strategy.requiredPlugins).toEqual(['working_memory']);
    });

    it('should accept custom configuration', () => {
      const strategy = new AlgorithmicCompactionStrategy({
        threshold: 0.80,
        toolResultSizeThreshold: 2048,
        maxToolPairs: 5,
      });

      expect(strategy.threshold).toBe(0.80);
    });

    it('should be registered as built-in strategy', () => {
      expect(StrategyRegistry.has('algorithmic')).toBe(true);

      const info = StrategyRegistry.getInfo().find(s => s.name === 'algorithmic');
      expect(info?.isBuiltIn).toBe(true);
      expect(info?.displayName).toBe('Algorithmic');
    });
  });

  describe('consolidate()', () => {
    it('should move large tool results to memory', async () => {
      const mockMemory = createMockWorkingMemory();
      const largeResult = 'x'.repeat(2000); // 2KB result

      const conversation = [
        createToolUseMessage('tool-1', 'read_file', { path: '/src/index.ts' }),
        createToolResultMessage('tool-1', largeResult),
      ];

      const context = createMockContext(conversation, mockMemory);
      const strategy = new AlgorithmicCompactionStrategy({
        toolResultSizeThreshold: 1024, // 1KB threshold
      });

      const result = await strategy.consolidate(context);

      expect(result.performed).toBe(true);
      expect(mockMemory.store).toHaveBeenCalled();

      // Check key format
      const storeCall = mockMemory.store.mock.calls[0];
      expect(storeCall[0]).toMatch(/^tool_result\.read_file\./);

      // Check description includes tool name and args
      expect(storeCall[1]).toContain('read_file');
      expect(storeCall[1]).toContain('path=');
    });

    it('should NOT move small tool results to memory', async () => {
      const mockMemory = createMockWorkingMemory();
      const smallResult = 'small result'; // < 1KB

      const conversation = [
        createToolUseMessage('tool-1', 'get_time', {}),
        createToolResultMessage('tool-1', smallResult),
      ];

      const context = createMockContext(conversation, mockMemory);
      const strategy = new AlgorithmicCompactionStrategy({
        toolResultSizeThreshold: 1024,
      });

      const result = await strategy.consolidate(context);

      expect(result.performed).toBe(false);
      expect(mockMemory.store).not.toHaveBeenCalled();
    });

    it('should remove tool pairs after storing to memory', async () => {
      const mockMemory = createMockWorkingMemory();
      const largeResult = 'x'.repeat(2000);

      const conversation = [
        createToolUseMessage('tool-1', 'read_file', { path: '/src/index.ts' }),
        createToolResultMessage('tool-1', largeResult),
      ];

      const context = createMockContext(conversation, mockMemory) as CompactionContext & {
        getRemovedIndices: () => number[];
      };
      const strategy = new AlgorithmicCompactionStrategy();

      await strategy.consolidate(context);

      expect(context.removeMessages).toHaveBeenCalled();
      const removedIndices = (context.removeMessages as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(removedIndices).toContain(0); // tool_use
      expect(removedIndices).toContain(1); // tool_result
    });

    it('should limit tool pairs to maxToolPairs', async () => {
      const mockMemory = createMockWorkingMemory();

      // Create 15 small tool pairs
      const conversation: unknown[] = [];
      for (let i = 0; i < 15; i++) {
        conversation.push(createToolUseMessage(`tool-${i}`, 'get_time', {}));
        conversation.push(createToolResultMessage(`tool-${i}`, 'result'));
      }

      const context = createMockContext(conversation, mockMemory);
      const strategy = new AlgorithmicCompactionStrategy({
        maxToolPairs: 10,
        toolResultSizeThreshold: 10000, // High threshold so nothing moved to memory
      });

      const result = await strategy.consolidate(context);

      expect(result.performed).toBe(true);
      // Should remove 5 pairs (15 - 10 = 5), which is 10 messages
      const removedIndices = (context.removeMessages as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(removedIndices.length).toBe(10);
    });

    it('should handle empty conversation', async () => {
      const mockMemory = createMockWorkingMemory();
      const context = createMockContext([], mockMemory);
      const strategy = new AlgorithmicCompactionStrategy();

      const result = await strategy.consolidate(context);

      expect(result.performed).toBe(false);
      expect(result.tokensChanged).toBe(0);
    });
  });

  describe('compact()', () => {
    it('should call consolidate first', async () => {
      const mockMemory = createMockWorkingMemory();
      const largeResult = 'x'.repeat(2000);

      const conversation = [
        createToolUseMessage('tool-1', 'read_file', { path: '/test.ts' }),
        createToolResultMessage('tool-1', largeResult),
      ];

      const context = createMockContext(conversation, mockMemory);
      const strategy = new AlgorithmicCompactionStrategy();

      const result = await strategy.compact(context, 1000);

      // Should have stored to memory (consolidate was called)
      expect(mockMemory.store).toHaveBeenCalled();
      expect(result.log.some(l => l.includes('Moved'))).toBe(true);
    });

    it('should apply rolling window if needed after consolidate', async () => {
      const mockMemory = createMockWorkingMemory();

      // Create conversation with user messages (no tool pairs)
      const conversation = [
        createUserMessage('Hello'),
        createUserMessage('How are you?'),
        createUserMessage('What is the weather?'),
      ];

      const context = createMockContext(conversation, mockMemory);
      const strategy = new AlgorithmicCompactionStrategy();

      const result = await strategy.compact(context, 1000);

      // Should have removed some messages via rolling window
      expect(context.removeMessages).toHaveBeenCalled();
      expect(result.messagesRemoved).toBeGreaterThan(0);
    });

    it('should return correct CompactionResult structure', async () => {
      const mockMemory = createMockWorkingMemory();
      const context = createMockContext([], mockMemory);
      const strategy = new AlgorithmicCompactionStrategy();

      const result = await strategy.compact(context, 100);

      expect(result).toHaveProperty('tokensFreed');
      expect(result).toHaveProperty('messagesRemoved');
      expect(result).toHaveProperty('pluginsCompacted');
      expect(result).toHaveProperty('log');
      expect(Array.isArray(result.log)).toBe(true);
    });
  });

  describe('Key and Description Generation', () => {
    it('should generate key in correct format', async () => {
      const mockMemory = createMockWorkingMemory();
      const largeResult = 'x'.repeat(2000);

      const conversation = [
        createToolUseMessage('toolu_01ABC12345678', 'read_file', { path: '/test.ts' }),
        createToolResultMessage('toolu_01ABC12345678', largeResult),
      ];

      const context = createMockContext(conversation, mockMemory);
      const strategy = new AlgorithmicCompactionStrategy();

      await strategy.consolidate(context);

      const key = mockMemory.store.mock.calls[0][0];
      // Key should be: tool_result.read_file.<last 8 chars of id>
      expect(key).toBe('tool_result.read_file.12345678');
    });

    it('should generate description with tool name and args', async () => {
      const mockMemory = createMockWorkingMemory();
      const largeResult = 'x'.repeat(2000);

      const conversation = [
        createToolUseMessage('tool-123', 'write_file', { path: '/output.txt', content: 'data' }),
        createToolResultMessage('tool-123', largeResult),
      ];

      const context = createMockContext(conversation, mockMemory);
      const strategy = new AlgorithmicCompactionStrategy();

      await strategy.consolidate(context);

      const description = mockMemory.store.mock.calls[0][1];
      expect(description).toContain('write_file');
      expect(description).toContain('path=');
    });

    it('should truncate long descriptions', async () => {
      const mockMemory = createMockWorkingMemory();
      const largeResult = 'x'.repeat(2000);

      // Create args with very long values
      const longArgs = {
        path: '/very/long/path/'.repeat(20),
        content: 'x'.repeat(500),
      };

      const conversation = [
        createToolUseMessage('tool-123', 'write_file', longArgs),
        createToolResultMessage('tool-123', largeResult),
      ];

      const context = createMockContext(conversation, mockMemory);
      const strategy = new AlgorithmicCompactionStrategy();

      await strategy.consolidate(context);

      const description = mockMemory.store.mock.calls[0][1];
      expect(description.length).toBeLessThanOrEqual(150);
    });
  });

  describe('Error Handling', () => {
    it('should throw if working_memory plugin is missing', async () => {
      // Create context without working_memory plugin
      const context = {
        budget: { maxTokens: 128000 },
        conversation: [
          createToolUseMessage('tool-1', 'read_file', {}),
          createToolResultMessage('tool-1', 'x'.repeat(2000)),
        ],
        currentInput: [],
        plugins: [], // No plugins!
        strategyName: 'algorithmic',
        removeMessages: vi.fn(),
        compactPlugin: vi.fn(),
        estimateTokens: vi.fn(),
      } as unknown as CompactionContext;

      const strategy = new AlgorithmicCompactionStrategy();

      await expect(strategy.consolidate(context)).rejects.toThrow(/working_memory/);
    });
  });
});
