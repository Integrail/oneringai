/**
 * ContextManager Tests
 * Tests for context window management and compaction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ContextManager,
  ContextManagerConfig,
  ContextComponents,
  ContextBudget,
  CompactionStrategy,
  DEFAULT_CONTEXT_CONFIG,
  DEFAULT_COMPACTION_STRATEGY,
} from '@/capabilities/taskAgent/ContextManager.js';

describe('ContextManager', () => {
  let manager: ContextManager;

  const defaultConfig: ContextManagerConfig = {
    maxContextTokens: 1000, // Small for testing
    compactionThreshold: 0.75,
    hardLimit: 0.9,
    responseReserve: 0.15,
    tokenEstimator: 'approximate',
  };

  const defaultStrategy: CompactionStrategy = {
    priority: ['toolOutputs', 'history', 'memory'],
    historyStrategy: 'truncate',
    memoryStrategy: 'lru',
    toolOutputMaxSize: 100,
  };

  beforeEach(() => {
    manager = new ContextManager(defaultConfig, defaultStrategy);
  });

  describe('constructor', () => {
    it('should create instance with config and strategy', () => {
      expect(manager).toBeDefined();
    });

    it('should use defaults when not provided', () => {
      const mgr = new ContextManager();
      expect(mgr).toBeDefined();
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for string (approximate)', () => {
      const text = 'Hello, world!'; // 13 chars
      const tokens = manager.estimateTokens(text);
      // Default is 'mixed' which uses 3.5 chars/token
      expect(tokens).toBe(4); // ceil(13/3.5)
    });

    it('should handle empty string', () => {
      expect(manager.estimateTokens('')).toBe(0);
    });

    it('should handle long text', () => {
      const text = 'a'.repeat(1000);
      // 'mixed' uses 3.5 chars/token
      expect(manager.estimateTokens(text)).toBe(286); // ceil(1000/3.5)
    });

    it('should handle text with special characters', () => {
      const text = '{"key": "value", "nested": {"a": 1}}';
      const tokens = manager.estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle unicode text', () => {
      const text = '你好世界'; // Chinese characters
      const tokens = manager.estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should use 3 chars/token for code content', () => {
      const code = 'function foo() { return "bar"; }'; // 33 chars
      const tokens = manager.estimateTokens(code, 'code');
      expect(tokens).toBe(11); // ceil(33/3)
    });

    it('should use 4 chars/token for prose content', () => {
      const prose = 'The quick brown fox jumps over the lazy dog.'; // 44 chars
      const tokens = manager.estimateTokens(prose, 'prose');
      expect(tokens).toBe(11); // ceil(44/4)
    });

    it('should use 3.5 chars/token for mixed content', () => {
      const mixed = 'Call function foo() to process the data.'; // 41 chars
      const tokens = manager.estimateTokens(mixed, 'mixed');
      expect(tokens).toBe(12); // ceil(41/3.5)
    });

    it('should estimate more tokens for code than prose with same text length', () => {
      const text = 'a'.repeat(100);
      const codeTokens = manager.estimateTokens(text, 'code');
      const proseTokens = manager.estimateTokens(text, 'prose');

      expect(codeTokens).toBeGreaterThan(proseTokens);
      expect(codeTokens).toBe(34); // ceil(100/3)
      expect(proseTokens).toBe(25); // ceil(100/4)
    });

    it('should default to mixed content type for backward compatibility', () => {
      const text = 'a'.repeat(100);
      const defaultTokens = manager.estimateTokens(text);
      const mixedTokens = manager.estimateTokens(text, 'mixed');

      expect(defaultTokens).toBe(mixedTokens);
    });
  });

  describe('estimateBudget', () => {
    it('should calculate budget correctly', () => {
      const components: ContextComponents = {
        systemPrompt: 'You are a helpful assistant.',
        instructions: 'Be concise.',
        memoryIndex: 'Memory: empty',
        conversationHistory: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
        currentInput: 'What is 2+2?',
      };

      const budget = manager.estimateBudget(components);

      expect(budget.total).toBe(1000);
      expect(budget.reserved).toBe(150); // 15% of 1000
      expect(budget.used).toBeGreaterThan(0);
      expect(budget.available).toBe(budget.total - budget.reserved - budget.used);
      expect(budget.breakdown).toBeDefined();
      expect(budget.breakdown.systemPrompt).toBeGreaterThan(0);
      expect(budget.breakdown.conversationHistory).toBeGreaterThan(0);
    });

    it('should return ok status when under threshold', () => {
      const components: ContextComponents = {
        systemPrompt: 'Short.',
        instructions: '',
        memoryIndex: '',
        conversationHistory: [],
        currentInput: 'Hi',
      };

      const budget = manager.estimateBudget(components);
      expect(budget.status).toBe('ok');
    });

    it('should return warning status when over soft limit', () => {
      const components: ContextComponents = {
        systemPrompt: 'x'.repeat(600), // 150 tokens
        instructions: 'x'.repeat(400), // 100 tokens
        memoryIndex: 'x'.repeat(400), // 100 tokens
        conversationHistory: [],
        currentInput: 'x'.repeat(1000), // 250 tokens = 600 total, over 75%
      };

      const budget = manager.estimateBudget(components);
      expect(budget.status).toBe('warning');
    });

    it('should return critical status when over hard limit', () => {
      const components: ContextComponents = {
        systemPrompt: 'x'.repeat(2000), // 500 tokens
        instructions: 'x'.repeat(1000), // 250 tokens
        memoryIndex: 'x'.repeat(400), // 100 tokens
        conversationHistory: [],
        currentInput: 'x'.repeat(400), // 100 tokens = 950, over 90%
      };

      const budget = manager.estimateBudget(components);
      expect(budget.status).toBe('critical');
    });

    it('should handle empty components', () => {
      const components: ContextComponents = {
        systemPrompt: '',
        instructions: '',
        memoryIndex: '',
        conversationHistory: [],
        currentInput: '',
      };

      const budget = manager.estimateBudget(components);
      expect(budget.status).toBe('ok');
      expect(budget.used).toBe(0);
    });

    it('should include utilization percentage', () => {
      const components: ContextComponents = {
        systemPrompt: 'x'.repeat(400), // ~100 tokens
        instructions: '',
        memoryIndex: '',
        conversationHistory: [],
        currentInput: '',
      };

      const budget = manager.estimateBudget(components);
      expect(budget.utilizationPercent).toBeGreaterThan(0);
      expect(budget.utilizationPercent).toBeLessThan(100);
    });
  });

  describe('prepareContext', () => {
    it('should pass through when under threshold', async () => {
      const components: ContextComponents = {
        systemPrompt: 'Hello',
        instructions: '',
        memoryIndex: '',
        conversationHistory: [],
        currentInput: 'Hi',
      };

      const mockMemory = { evictLRU: vi.fn(async () => []) };
      const mockHistory = { summarize: vi.fn(async () => {}) };

      const result = await manager.prepareContext(
        components,
        mockMemory as any,
        mockHistory as any
      );

      expect(result.compacted).toBe(false);
      expect(result.components).toEqual(components);
      expect(mockMemory.evictLRU).not.toHaveBeenCalled();
      expect(mockHistory.summarize).not.toHaveBeenCalled();
    });

    it('should compact when over threshold', async () => {
      // With 3.5 chars/token (mixed):
      // 1400/3.5 = 400 tokens, 700/3.5 = 200 tokens, 350/3.5 = 100 tokens (x2)
      // Total: ~800 tokens, which is over 75% threshold (750) but under hard limit
      const components: ContextComponents = {
        systemPrompt: 'x'.repeat(1400), // ~400 tokens
        instructions: 'x'.repeat(700), // ~200 tokens
        memoryIndex: '',
        conversationHistory: [
          { role: 'user', content: 'x'.repeat(350) }, // ~100 tokens
          { role: 'assistant', content: 'x'.repeat(350) }, // ~100 tokens
        ],
        currentInput: 'Hi',
      };

      const mockMemory = { evictLRU: vi.fn(async () => ['key1']) };
      const mockHistory = {
        summarize: vi.fn(async () => {}),
        truncate: vi.fn(async (msgs: any[], limit: number) => msgs.slice(-1)),
      };

      const result = await manager.prepareContext(
        components,
        mockMemory as any,
        mockHistory as any
      );

      expect(result.compacted).toBe(true);
      expect(result.compactionLog).toBeDefined();
      expect(result.compactionLog!.length).toBeGreaterThan(0);
    });

    it('should truncate tool outputs first based on strategy', async () => {
      const largeToolOutput = 'TOOL OUTPUT: ' + 'x'.repeat(2000);
      const components: ContextComponents = {
        systemPrompt: 'System',
        instructions: '',
        memoryIndex: '',
        conversationHistory: [{ role: 'assistant', content: largeToolOutput }],
        currentInput: 'x'.repeat(2000), // Push over limit
      };

      const mockMemory = { evictLRU: vi.fn(async () => []) };
      const mockHistory = { summarize: vi.fn(async () => {}) };

      const result = await manager.prepareContext(
        components,
        mockMemory as any,
        mockHistory as any
      );

      expect(result.compacted).toBe(true);
      if (result.compactionLog) {
        expect(result.compactionLog.some((log) => log.includes('tool output'))).toBe(true);
      }
    });

    it('should throw when cannot fit within limits', async () => {
      const components: ContextComponents = {
        systemPrompt: 'x'.repeat(4000), // Way over limit
        instructions: 'x'.repeat(4000),
        memoryIndex: '',
        conversationHistory: [],
        currentInput: '',
      };

      const mockMemory = { evictLRU: vi.fn(async () => []) };
      const mockHistory = { summarize: vi.fn(async () => {}) };

      await expect(
        manager.prepareContext(components, mockMemory as any, mockHistory as any)
      ).rejects.toThrow('Cannot fit context within limits');
    });

    it('should emit events during compaction', async () => {
      const components: ContextComponents = {
        systemPrompt: 'x'.repeat(3000),
        instructions: '',
        memoryIndex: '',
        conversationHistory: [],
        currentInput: '',
      };

      const onCompacting = vi.fn();
      manager.on('compacting', onCompacting);

      const mockMemory = { evictLRU: vi.fn(async () => []) };
      const mockHistory = { summarize: vi.fn(async () => {}) };

      try {
        await manager.prepareContext(components, mockMemory as any, mockHistory as any);
      } catch {
        // May throw if can't compact enough
      }

      expect(onCompacting).toHaveBeenCalled();
    });
  });

  describe('truncateToolOutput', () => {
    it('should truncate output over max size', () => {
      const largeOutput = { data: 'x'.repeat(2000) };
      const truncated = manager.truncateToolOutput(largeOutput, 100);

      expect(manager.estimateTokens(JSON.stringify(truncated))).toBeLessThanOrEqual(150); // Some buffer
    });

    it('should preserve small outputs', () => {
      const smallOutput = { data: 'hello' };
      const result = manager.truncateToolOutput(smallOutput, 100);

      expect(result).toEqual(smallOutput);
    });

    it('should add truncation indicator', () => {
      const largeOutput = { data: 'x'.repeat(2000) };
      const truncated = manager.truncateToolOutput(largeOutput, 50);

      expect(JSON.stringify(truncated)).toContain('truncated');
    });

    it('should preserve object structure info for large objects', () => {
      const largeOutput = {
        users: Array(100).fill({ id: 1, name: 'Test' }),
        meta: { total: 100 },
      };
      const truncated = manager.truncateToolOutput(largeOutput, 50);

      // Should mention it's an object with keys
      const str = JSON.stringify(truncated);
      expect(str).toMatch(/users|meta|object/i);
    });

    it('should preserve array info for large arrays', () => {
      const largeOutput = Array(100).fill({ id: 1 });
      const truncated = manager.truncateToolOutput(largeOutput, 50);

      // Should mention it's an array
      const str = JSON.stringify(truncated);
      expect(str).toMatch(/array|items|100/i);
    });
  });

  describe('createOutputSummary', () => {
    it('should summarize arrays', () => {
      const arr = Array(50).fill({ id: 1, name: 'test' });
      const summary = manager.createOutputSummary(arr, 50);

      expect(summary).toContain('50');
      expect(summary).toMatch(/array|items/i);
    });

    it('should summarize objects with key info', () => {
      const obj = { name: 'John', email: 'john@test.com', orders: [] };
      const summary = manager.createOutputSummary(obj, 50);

      expect(summary).toMatch(/name|email|orders/);
    });

    it('should truncate primitive strings', () => {
      const longString = 'x'.repeat(1000);
      const summary = manager.createOutputSummary(longString, 50);

      expect(summary.length).toBeLessThan(250); // tokens * 4 + buffer
    });

    it('should handle null', () => {
      const summary = manager.createOutputSummary(null, 50);
      expect(summary).toBeDefined();
    });

    it('should handle undefined', () => {
      const summary = manager.createOutputSummary(undefined, 50);
      expect(summary).toBeDefined();
    });
  });

  describe('shouldAutoStore', () => {
    it('should return true for large outputs', () => {
      const largeOutput = { data: 'x'.repeat(10000) };
      expect(manager.shouldAutoStore(largeOutput, 2000)).toBe(true);
    });

    it('should return false for small outputs', () => {
      const smallOutput = { data: 'hello' };
      expect(manager.shouldAutoStore(smallOutput, 2000)).toBe(false);
    });

    it('should respect custom threshold', () => {
      const output = { data: 'x'.repeat(500) };
      expect(manager.shouldAutoStore(output, 100)).toBe(true);
      expect(manager.shouldAutoStore(output, 1000)).toBe(false);
    });
  });

  describe('compaction strategies', () => {
    it('should follow priority order', async () => {
      const customStrategy: CompactionStrategy = {
        priority: ['memory', 'history', 'toolOutputs'], // Different order
        historyStrategy: 'truncate',
        memoryStrategy: 'lru',
        toolOutputMaxSize: 100,
      };

      const mgr = new ContextManager(defaultConfig, customStrategy);

      const components: ContextComponents = {
        systemPrompt: 'x'.repeat(3000),
        instructions: '',
        memoryIndex: 'memory data',
        conversationHistory: [],
        currentInput: '',
      };

      const mockMemory = { evictLRU: vi.fn(async () => ['evicted']) };
      const mockHistory = { summarize: vi.fn(async () => {}) };

      try {
        await mgr.prepareContext(components, mockMemory as any, mockHistory as any);
      } catch {
        // May throw
      }

      // Memory should be attempted first based on strategy
      expect(mockMemory.evictLRU).toHaveBeenCalled();
    });
  });

  describe('DEFAULT_CONTEXT_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_CONTEXT_CONFIG.compactionThreshold).toBe(0.75);
      expect(DEFAULT_CONTEXT_CONFIG.hardLimit).toBe(0.9);
      expect(DEFAULT_CONTEXT_CONFIG.responseReserve).toBe(0.15);
      expect(DEFAULT_CONTEXT_CONFIG.tokenEstimator).toBe('approximate');
    });
  });

  describe('DEFAULT_COMPACTION_STRATEGY', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_COMPACTION_STRATEGY.priority).toEqual(['toolOutputs', 'history', 'memory']);
      expect(DEFAULT_COMPACTION_STRATEGY.historyStrategy).toBe('summarize');
      expect(DEFAULT_COMPACTION_STRATEGY.memoryStrategy).toBe('lru');
      expect(DEFAULT_COMPACTION_STRATEGY.toolOutputMaxSize).toBeGreaterThan(0);
    });
  });

  describe('updateConfig', () => {
    it('should allow updating configuration', () => {
      manager.updateConfig({ compactionThreshold: 0.6 });

      // Test that new threshold is used
      const components: ContextComponents = {
        systemPrompt: 'x'.repeat(2400), // 600 tokens = 60% of 1000
        instructions: '',
        memoryIndex: '',
        conversationHistory: [],
        currentInput: '',
      };

      const budget = manager.estimateBudget(components);
      expect(budget.status).toBe('warning'); // 60% > 60% threshold
    });
  });
});
