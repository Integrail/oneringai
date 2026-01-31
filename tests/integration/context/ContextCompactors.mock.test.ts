/**
 * ContextCompactors Mock Tests
 *
 * Deterministic tests for all 3 compactors:
 * - TruncateCompactor: string/array truncation with "[truncated...]" suffix
 * - MemoryEvictionCompactor: LRU eviction with callback invocation
 * - SummarizeCompactor: content-type detection, fallback behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TruncateCompactor } from '@/infrastructure/context/compactors/TruncateCompactor.js';
import { MemoryEvictionCompactor } from '@/infrastructure/context/compactors/MemoryEvictionCompactor.js';
import { SummarizeCompactor } from '@/infrastructure/context/compactors/SummarizeCompactor.js';
import type { IContextComponent, ITokenEstimator } from '@/core/context/types.js';
import type { ITextProvider } from '@/domain/interfaces/ITextProvider.js';
import {
  createMockComponent,
  createTruncatableComponent,
  createEvictableComponent,
  createSummarizableComponent,
  createMockEstimator,
} from '../../helpers/contextTestHelpers.js';

// ============================================================================
// TruncateCompactor Tests
// ============================================================================

describe('TruncateCompactor', () => {
  let compactor: TruncateCompactor;
  let estimator: ITokenEstimator;

  beforeEach(() => {
    estimator = createMockEstimator();
    compactor = new TruncateCompactor(estimator);
  });

  describe('Properties', () => {
    it('should have name "truncate"', () => {
      expect(compactor.name).toBe('truncate');
    });

    it('should have priority 10', () => {
      expect(compactor.priority).toBe(10);
    });
  });

  describe('canCompact', () => {
    it('should return true for components with truncate strategy', () => {
      const component = createMockComponent('test', 'content', {
        compactable: true,
        metadata: { strategy: 'truncate' },
      });
      expect(compactor.canCompact(component)).toBe(true);
    });

    it('should return true for components with truncatable flag', () => {
      const component = createMockComponent('test', 'content', {
        compactable: true,
        metadata: { truncatable: true },
      });
      expect(compactor.canCompact(component)).toBe(true);
    });

    it('should return false for non-compactable components', () => {
      const component = createMockComponent('test', 'content', {
        compactable: false,
        metadata: { strategy: 'truncate' },
      });
      expect(compactor.canCompact(component)).toBe(false);
    });

    it('should return false for components without truncate metadata', () => {
      const component = createMockComponent('test', 'content', {
        compactable: true,
      });
      expect(compactor.canCompact(component)).toBe(false);
    });
  });

  describe('String Truncation', () => {
    it('should truncate long strings to target size', async () => {
      const content = 'x'.repeat(1000);
      const component = createTruncatableComponent('test', 1000);

      // 1000 chars = ~250 tokens, target 50 tokens = ~200 chars
      const result = await compactor.compact(component, 50);

      expect(typeof result.content).toBe('string');
      expect((result.content as string).length).toBeLessThan(1000);
      expect((result.content as string)).toContain('[truncated...]');
    });

    it('should add "[truncated...]" suffix', async () => {
      const component = createTruncatableComponent('test', 1000);
      const result = await compactor.compact(component, 50);

      expect((result.content as string).endsWith('[truncated...]')).toBe(true);
    });

    it('should set truncated metadata', async () => {
      const component = createTruncatableComponent('test', 1000);
      const result = await compactor.compact(component, 50);

      expect(result.metadata?.truncated).toBe(true);
      expect(result.metadata?.originalLength).toBe(1000);
      expect(result.metadata?.truncatedLength).toBeDefined();
    });

    it('should not truncate strings already under target', async () => {
      const component = createTruncatableComponent('test', 100); // ~25 tokens
      const result = await compactor.compact(component, 50); // 50 tokens target

      expect(result).toBe(component); // Unchanged
    });
  });

  describe('Array Truncation', () => {
    it('should keep most recent items from arrays', async () => {
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i, data: `item_${i}` }));
      const component = createMockComponent('history', items, {
        compactable: true,
        metadata: { strategy: 'truncate' },
      });

      const result = await compactor.compact(component, 50);
      const resultArray = result.content as typeof items;

      // Should keep items from the end (most recent)
      expect(resultArray.length).toBeLessThan(20);
      // Last item should be the original last item
      expect(resultArray[resultArray.length - 1].id).toBe(19);
    });

    it('should set windowed metadata for arrays', async () => {
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
      const component = createMockComponent('history', items, {
        compactable: true,
        metadata: { strategy: 'truncate' },
      });

      const result = await compactor.compact(component, 30);

      expect(result.metadata?.truncated).toBe(true);
      expect(result.metadata?.originalLength).toBe(20);
      expect(result.metadata?.keptLength).toBeDefined();
      expect(result.metadata?.droppedLength).toBeDefined();
    });

    it('should not truncate arrays already under target', async () => {
      const items = [{ id: 1 }, { id: 2 }];
      const component = createMockComponent('history', items, {
        compactable: true,
        metadata: { strategy: 'truncate' },
      });

      const result = await compactor.compact(component, 1000);

      expect((result.content as unknown[]).length).toBe(2);
      expect(result.metadata?.truncated).toBeUndefined();
    });
  });

  describe('estimateSavings', () => {
    it('should estimate 50% reduction for string content', () => {
      const component = createTruncatableComponent('test', 1000);
      const savings = compactor.estimateSavings(component);

      // 1000 chars = ~250 tokens, 50% = 125 tokens
      expect(savings).toBe(125);
    });

    it('should estimate savings for array content', () => {
      const items = Array.from({ length: 10 }, () => ({ data: 'test' }));
      const component = createMockComponent('history', items, {
        compactable: true,
        metadata: { strategy: 'truncate' },
      });

      const savings = compactor.estimateSavings(component);
      expect(savings).toBeGreaterThan(0);
    });
  });

  describe('Non-Truncatable Types', () => {
    it('should return unchanged for non-string/array content', async () => {
      const component = createMockComponent('test', { complex: { nested: 'object' } }, {
        compactable: true,
        metadata: { strategy: 'truncate' },
      });

      const result = await compactor.compact(component, 10);

      expect(result).toBe(component);
    });
  });
});

// ============================================================================
// MemoryEvictionCompactor Tests
// ============================================================================

describe('MemoryEvictionCompactor', () => {
  let compactor: MemoryEvictionCompactor;
  let estimator: ITokenEstimator;

  beforeEach(() => {
    estimator = createMockEstimator();
    compactor = new MemoryEvictionCompactor(estimator);
  });

  describe('Properties', () => {
    it('should have name "memory-eviction"', () => {
      expect(compactor.name).toBe('memory-eviction');
    });

    it('should have priority 8', () => {
      expect(compactor.priority).toBe(8);
    });
  });

  describe('canCompact', () => {
    it('should return true for memory_index component', () => {
      const component = createMockComponent('memory_index', 'content', {
        compactable: true,
      });
      expect(compactor.canCompact(component)).toBe(true);
    });

    it('should return true for components with evict strategy', () => {
      const component = createMockComponent('custom', 'content', {
        compactable: true,
        metadata: { strategy: 'evict' },
      });
      expect(compactor.canCompact(component)).toBe(true);
    });

    it('should return false for non-compactable components', () => {
      const component = createMockComponent('memory_index', 'content', {
        compactable: false,
      });
      expect(compactor.canCompact(component)).toBe(false);
    });

    it('should return false for components with different strategy', () => {
      const component = createMockComponent('other', 'content', {
        compactable: true,
        metadata: { strategy: 'truncate' },
      });
      expect(compactor.canCompact(component)).toBe(false);
    });
  });

  describe('Eviction Callback Invocation', () => {
    it('should call evict callback with correct count', async () => {
      const evictFn = vi.fn().mockResolvedValue(undefined);
      const getUpdatedContentFn = vi.fn().mockResolvedValue('Updated content');

      const component = createEvictableComponent(
        'memory_index',
        'x'.repeat(1000), // ~250 tokens
        evictFn,
        getUpdatedContentFn
      );

      // Target 50 tokens, need to free ~200 tokens
      // With avgEntrySize 100, should evict 2 entries
      await compactor.compact(component, 50);

      expect(evictFn).toHaveBeenCalled();
      expect(evictFn.mock.calls[0][0]).toBeGreaterThan(0);
    });

    it('should call getUpdatedContent after eviction', async () => {
      const evictFn = vi.fn().mockResolvedValue(undefined);
      const getUpdatedContentFn = vi.fn().mockResolvedValue('New content');

      const component = createEvictableComponent(
        'memory_index',
        'x'.repeat(1000),
        evictFn,
        getUpdatedContentFn
      );

      const result = await compactor.compact(component, 50);

      expect(getUpdatedContentFn).toHaveBeenCalled();
      expect(result.content).toBe('New content');
    });

    it('should set evicted metadata', async () => {
      const evictFn = vi.fn().mockResolvedValue(undefined);
      const getUpdatedContentFn = vi.fn().mockResolvedValue('Updated');

      const component = createEvictableComponent(
        'memory_index',
        'x'.repeat(1000),
        evictFn,
        getUpdatedContentFn
      );

      const result = await compactor.compact(component, 50);

      expect(result.metadata?.evicted).toBe(true);
      expect(result.metadata?.evictedCount).toBeGreaterThan(0);
    });
  });

  describe('Entry Count Calculation', () => {
    it('should use avgEntrySize from metadata', async () => {
      const evictFn = vi.fn().mockResolvedValue(undefined);
      const getUpdatedContentFn = vi.fn().mockResolvedValue('Updated');

      const component = createMockComponent('memory_index', 'x'.repeat(1000), {
        compactable: true,
        metadata: {
          strategy: 'evict',
          avgEntrySize: 50, // 50 tokens per entry
          evict: evictFn,
          getUpdatedContent: getUpdatedContentFn,
        },
      });

      // 1000 chars = 250 tokens, target 50, need to free 200
      // 200 / 50 = 4 entries
      await compactor.compact(component, 50);

      expect(evictFn).toHaveBeenCalledWith(4);
    });

    it('should use default avgEntrySize of 100 if not provided', async () => {
      const evictFn = vi.fn().mockResolvedValue(undefined);
      const getUpdatedContentFn = vi.fn().mockResolvedValue('Updated');

      const component = createMockComponent('memory_index', 'x'.repeat(1000), {
        compactable: true,
        metadata: {
          strategy: 'evict',
          // No avgEntrySize - should use default 100
          evict: evictFn,
          getUpdatedContent: getUpdatedContentFn,
        },
      });

      // 250 tokens, target 50, need 200, 200/100 = 2 entries
      await compactor.compact(component, 50);

      expect(evictFn).toHaveBeenCalledWith(2);
    });
  });

  describe('No Eviction Needed', () => {
    it('should not evict if already under target', async () => {
      const evictFn = vi.fn();

      const component = createMockComponent('memory_index', 'small', {
        compactable: true,
        metadata: {
          strategy: 'evict',
          avgEntrySize: 100,
          evict: evictFn,
        },
      });

      const result = await compactor.compact(component, 1000);

      expect(evictFn).not.toHaveBeenCalled();
      expect(result).toBe(component);
    });
  });

  describe('Missing Callbacks', () => {
    it('should return unchanged if no evict callback', async () => {
      const component = createMockComponent('memory_index', 'content', {
        compactable: true,
        metadata: { strategy: 'evict' },
      });

      const result = await compactor.compact(component, 10);

      expect(result).toBe(component);
    });

    it('should return unchanged if no getUpdatedContent callback', async () => {
      const evictFn = vi.fn().mockResolvedValue(undefined);

      const component = createMockComponent('memory_index', 'x'.repeat(1000), {
        compactable: true,
        metadata: {
          strategy: 'evict',
          avgEntrySize: 50,
          evict: evictFn,
          // No getUpdatedContent
        },
      });

      const result = await compactor.compact(component, 50);

      expect(evictFn).toHaveBeenCalled();
      expect(result).toBe(component); // Returns original
    });
  });

  describe('estimateSavings', () => {
    it('should estimate savings based on avgEntrySize', () => {
      const component = createMockComponent('memory_index', 'content', {
        compactable: true,
        metadata: { avgEntrySize: 150 },
      });

      const savings = compactor.estimateSavings(component);
      expect(savings).toBe(300); // 150 * 2
    });

    it('should use default avgEntrySize for estimation', () => {
      const component = createMockComponent('memory_index', 'content', {
        compactable: true,
      });

      const savings = compactor.estimateSavings(component);
      expect(savings).toBe(200); // 100 * 2
    });
  });
});

// ============================================================================
// SummarizeCompactor Tests
// ============================================================================

describe('SummarizeCompactor', () => {
  let compactor: SummarizeCompactor;
  let estimator: ITokenEstimator;
  let mockTextProvider: {
    generate: ReturnType<typeof vi.fn>;
    name: string;
  };

  beforeEach(() => {
    estimator = createMockEstimator();
    mockTextProvider = {
      name: 'mock',
      generate: vi.fn().mockResolvedValue({
        output_text: 'Summarized content.',
      }),
    };

    compactor = new SummarizeCompactor(estimator, {
      textProvider: mockTextProvider as unknown as ITextProvider,
      fallbackToTruncate: true,
    });
  });

  describe('Properties', () => {
    it('should have name "summarize"', () => {
      expect(compactor.name).toBe('summarize');
    });

    it('should have priority 5', () => {
      expect(compactor.priority).toBe(5);
    });
  });

  describe('canCompact', () => {
    it('should return true for components with summarize strategy', () => {
      const component = createSummarizableComponent('test', 'content');
      expect(compactor.canCompact(component)).toBe(true);
    });

    it('should return false for non-compactable components', () => {
      const component = createMockComponent('test', 'content', {
        compactable: false,
        metadata: { strategy: 'summarize' },
      });
      expect(compactor.canCompact(component)).toBe(false);
    });

    it('should return false for components with different strategy', () => {
      const component = createMockComponent('test', 'content', {
        compactable: true,
        metadata: { strategy: 'truncate' },
      });
      expect(compactor.canCompact(component)).toBe(false);
    });
  });

  describe('LLM Summarization', () => {
    it('should call LLM for large content', async () => {
      const component = createSummarizableComponent('test', 'x'.repeat(2000));

      await compactor.compact(component, 50);

      expect(mockTextProvider.generate).toHaveBeenCalled();
    });

    it('should not call LLM for small content', async () => {
      const component = createSummarizableComponent('test', 'small');

      await compactor.compact(component, 1000);

      expect(mockTextProvider.generate).not.toHaveBeenCalled();
    });

    it('should set summarized metadata on success', async () => {
      const component = createSummarizableComponent('test', 'x'.repeat(2000));

      const result = await compactor.compact(component, 50);

      expect(result.metadata?.summarized).toBe(true);
      expect(result.metadata?.summarizedFrom).toBeDefined();
      expect(result.metadata?.summarizedTo).toBeDefined();
      expect(result.metadata?.reductionPercent).toBeDefined();
    });
  });

  describe('Content Type Detection', () => {
    it('should detect conversation type from name', async () => {
      const component = createMockComponent('conversation_history', 'x'.repeat(2000), {
        compactable: true,
        metadata: { strategy: 'summarize' },
      });

      await compactor.compact(component, 50);

      expect(mockTextProvider.generate).toHaveBeenCalled();
      const callArgs = mockTextProvider.generate.mock.calls[0][0];
      expect(callArgs.input).toContain('conversation');
    });

    it('should detect search_results type from name', async () => {
      const component = createMockComponent('web_search_results', 'x'.repeat(2000), {
        compactable: true,
        metadata: { strategy: 'summarize' },
      });

      await compactor.compact(component, 50);

      expect(mockTextProvider.generate).toHaveBeenCalled();
      const callArgs = mockTextProvider.generate.mock.calls[0][0];
      expect(callArgs.input).toContain('search');
    });

    it('should use contentType from metadata if provided', async () => {
      const component = createMockComponent('custom', 'x'.repeat(2000), {
        compactable: true,
        metadata: { strategy: 'summarize', contentType: 'tool_output' },
      });

      await compactor.compact(component, 50);

      const result = await compactor.compact(component, 50);
      expect(result.metadata?.contentType).toBe('tool_output');
    });
  });

  describe('Fallback to Truncation', () => {
    it('should fallback to truncation on LLM failure', async () => {
      mockTextProvider.generate.mockRejectedValueOnce(new Error('LLM error'));

      const component = createSummarizableComponent('test', 'x'.repeat(2000));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await compactor.compact(component, 50);

      expect(result.metadata?.truncated).toBe(true);
      expect(result.metadata?.summarizationFailed).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should throw if fallbackToTruncate is false', async () => {
      const noFallbackCompactor = new SummarizeCompactor(estimator, {
        textProvider: mockTextProvider as unknown as ITextProvider,
        fallbackToTruncate: false,
      });

      mockTextProvider.generate.mockRejectedValueOnce(new Error('LLM error'));

      const component = createSummarizableComponent('test', 'x'.repeat(2000));

      await expect(noFallbackCompactor.compact(component, 50)).rejects.toThrow('LLM error');
    });

    it('should fallback if summarization achieves less than 10% reduction', async () => {
      // Return almost the same content
      mockTextProvider.generate.mockResolvedValueOnce({
        output_text: 'x'.repeat(1900), // Only ~5% smaller
      });

      const component = createSummarizableComponent('test', 'x'.repeat(2000));

      const result = await compactor.compact(component, 50);

      // Should have fallen back to truncation
      expect(result.metadata?.truncated).toBe(true);
    });
  });

  describe('Content Stringification', () => {
    it('should stringify array content (messages)', async () => {
      // Make messages large enough to trigger summarization
      const messages = [
        { role: 'user', content: 'Hello '.repeat(300) },
        { role: 'assistant', content: 'Hi there! '.repeat(300) },
      ];
      const component = createMockComponent('history', messages, {
        compactable: true,
        metadata: { strategy: 'summarize' },
      });

      await compactor.compact(component, 50);

      expect(mockTextProvider.generate).toHaveBeenCalled();
      const callArgs = mockTextProvider.generate.mock.calls[0][0];
      expect(callArgs.input).toContain('[user]');
      expect(callArgs.input).toContain('[assistant]');
    });

    it('should handle tool output format', async () => {
      // Make outputs large enough to trigger summarization
      const outputs = [
        { tool: 'read_file', output: { content: 'file data '.repeat(500) } },
      ];
      const component = createMockComponent('tool_outputs', outputs, {
        compactable: true,
        metadata: { strategy: 'summarize' },
      });

      await compactor.compact(component, 50);

      expect(mockTextProvider.generate).toHaveBeenCalled();
      const callArgs = mockTextProvider.generate.mock.calls[0][0];
      expect(callArgs.input).toContain('[read_file]');
    });

    it('should JSON stringify complex objects', async () => {
      // Make object large enough to trigger summarization
      const component = createMockComponent('data', { complex: { nested: 'value '.repeat(500) } }, {
        compactable: true,
        metadata: { strategy: 'summarize' },
      });

      await compactor.compact(component, 5);

      expect(mockTextProvider.generate).toHaveBeenCalled();
      const callArgs = mockTextProvider.generate.mock.calls[0][0];
      expect(callArgs.input).toContain('nested');
    });
  });

  describe('estimateSavings', () => {
    it('should estimate 80% reduction', () => {
      const component = createSummarizableComponent('test', 'x'.repeat(1000));
      const savings = compactor.estimateSavings(component);

      // 1000 chars = 250 tokens, 80% = 200 tokens
      expect(savings).toBe(200);
    });
  });
});

// ============================================================================
// Compactor Priority Order Tests
// ============================================================================

describe('Compactor Priority Order', () => {
  let estimator: ITokenEstimator;

  beforeEach(() => {
    estimator = createMockEstimator();
  });

  it('should have SummarizeCompactor run before TruncateCompactor', () => {
    const mockProvider = { name: 'mock', generate: vi.fn() };
    const summarize = new SummarizeCompactor(estimator, {
      textProvider: mockProvider as unknown as ITextProvider,
    });
    const truncate = new TruncateCompactor(estimator);

    // Lower priority = runs first
    expect(summarize.priority).toBeLessThan(truncate.priority);
  });

  it('should have MemoryEvictionCompactor run before TruncateCompactor', () => {
    const memoryEviction = new MemoryEvictionCompactor(estimator);
    const truncate = new TruncateCompactor(estimator);

    expect(memoryEviction.priority).toBeLessThan(truncate.priority);
  });

  it('should have consistent priority ordering', () => {
    const mockProvider = { name: 'mock', generate: vi.fn() };
    const summarize = new SummarizeCompactor(estimator, {
      textProvider: mockProvider as unknown as ITextProvider,
    });
    const memoryEviction = new MemoryEvictionCompactor(estimator);
    const truncate = new TruncateCompactor(estimator);

    // Order: summarize (5), memory-eviction (8), truncate (10)
    expect(summarize.priority).toBe(5);
    expect(memoryEviction.priority).toBe(8);
    expect(truncate.priority).toBe(10);
  });
});
