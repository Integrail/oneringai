/**
 * Context Compactors Unit Tests
 * Tests MemoryEvictionCompactor and SummarizeCompactor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryEvictionCompactor } from '@/infrastructure/context/compactors/MemoryEvictionCompactor.js';
import { SummarizeCompactor } from '@/infrastructure/context/compactors/SummarizeCompactor.js';
import type { IContextComponent, ITokenEstimator } from '@/core/context/types.js';

describe('MemoryEvictionCompactor', () => {
  let compactor: MemoryEvictionCompactor;
  let mockEstimator: ITokenEstimator;

  beforeEach(() => {
    mockEstimator = {
      estimateTokens: vi.fn((text: string) => Math.floor(text.length / 4)),
      estimateDataTokens: vi.fn((data: unknown) => {
        if (typeof data === 'string') {
          return Math.floor(data.length / 4);
        }
        return Math.floor(JSON.stringify(data).length / 4);
      }),
    };

    compactor = new MemoryEvictionCompactor(mockEstimator);
  });

  describe('Properties', () => {
    it('should have correct name and priority', () => {
      expect(compactor.name).toBe('memory-eviction');
      expect(compactor.priority).toBe(8);
    });
  });

  describe('canCompact', () => {
    it('should return true for memory_index component', () => {
      const component: IContextComponent = {
        name: 'memory_index',
        content: 'Memory content',
        priority: 8,
        compactable: true,
      };

      expect(compactor.canCompact(component)).toBe(true);
    });

    it('should return true for components with evict strategy', () => {
      const component: IContextComponent = {
        name: 'custom_memory',
        content: 'Content',
        priority: 5,
        compactable: true,
        metadata: {
          strategy: 'evict',
        },
      };

      expect(compactor.canCompact(component)).toBe(true);
    });

    it('should return false for non-compactable components', () => {
      const component: IContextComponent = {
        name: 'system_prompt',
        content: 'System',
        priority: 0,
        compactable: false,
      };

      expect(compactor.canCompact(component)).toBe(false);
    });

    it('should return false for components without evict strategy', () => {
      const component: IContextComponent = {
        name: 'history',
        content: 'History',
        priority: 6,
        compactable: true,
        metadata: {
          strategy: 'truncate',
        },
      };

      expect(compactor.canCompact(component)).toBe(false);
    });
  });

  describe('compact', () => {
    it('should evict entries and return updated component', async () => {
      const evictFn = vi.fn().mockResolvedValue(undefined);
      const getUpdatedContentFn = vi.fn().mockResolvedValue('Updated memory content');

      const component: IContextComponent = {
        name: 'memory_index',
        content: 'Memory: key1, key2, key3, key4, key5',
        priority: 8,
        compactable: true,
        metadata: {
          strategy: 'evict',
          avgEntrySize: 100,
          evict: evictFn,
          getUpdatedContent: getUpdatedContentFn,
        },
      };

      const targetTokens = 5; // Very small target to force eviction
      const result = await compactor.compact(component, targetTokens);

      expect(evictFn).toHaveBeenCalled();
      expect(getUpdatedContentFn).toHaveBeenCalled();
      expect(result.content).toBe('Updated memory content');
      expect(result.metadata?.evicted).toBe(true);
      expect(result.metadata?.evictedCount).toBeGreaterThan(0);
    });

    it('should calculate entries to evict based on token difference', async () => {
      const evictFn = vi.fn().mockResolvedValue(undefined);
      const getUpdatedContentFn = vi.fn().mockResolvedValue('Updated');

      const component: IContextComponent = {
        name: 'memory_index',
        content: 'A'.repeat(1000), // 250 tokens
        priority: 8,
        compactable: true,
        metadata: {
          strategy: 'evict',
          avgEntrySize: 50, // 50 tokens per entry
          evict: evictFn,
          getUpdatedContent: getUpdatedContentFn,
        },
      };

      const targetTokens = 100; // Need to free 150 tokens = 3 entries
      await compactor.compact(component, targetTokens);

      expect(evictFn).toHaveBeenCalledWith(3);
    });

    it('should use default avgEntrySize if not provided', async () => {
      const evictFn = vi.fn().mockResolvedValue(undefined);
      const getUpdatedContentFn = vi.fn().mockResolvedValue('Updated');

      const component: IContextComponent = {
        name: 'memory_index',
        content: 'A'.repeat(1000),
        priority: 8,
        compactable: true,
        metadata: {
          strategy: 'evict',
          evict: evictFn,
          getUpdatedContent: getUpdatedContentFn,
          // No avgEntrySize - should use default 100
        },
      };

      const targetTokens = 50;
      await compactor.compact(component, targetTokens);

      expect(evictFn).toHaveBeenCalled();
      // Should evict at least 1 entry
      expect(evictFn.mock.calls[0][0]).toBeGreaterThan(0);
    });

    it('should not evict if already under target', async () => {
      const evictFn = vi.fn().mockResolvedValue(undefined);

      const component: IContextComponent = {
        name: 'memory_index',
        content: 'Small content',
        priority: 8,
        compactable: true,
        metadata: {
          strategy: 'evict',
          avgEntrySize: 100,
          evict: evictFn,
        },
      };

      const targetTokens = 1000; // Target is much larger than content
      const result = await compactor.compact(component, targetTokens);

      expect(evictFn).not.toHaveBeenCalled();
      expect(result).toBe(component); // Returns unchanged
    });

    it('should return unchanged component if no evict callback', async () => {
      const component: IContextComponent = {
        name: 'memory_index',
        content: 'Memory content',
        priority: 8,
        compactable: true,
        metadata: {
          strategy: 'evict',
          // No evict callback
        },
      };

      const result = await compactor.compact(component, 10);

      expect(result).toBe(component);
    });

    it('should return unchanged if getUpdatedContent not available', async () => {
      const evictFn = vi.fn().mockResolvedValue(undefined);

      const component: IContextComponent = {
        name: 'memory_index',
        content: 'A'.repeat(1000),
        priority: 8,
        compactable: true,
        metadata: {
          strategy: 'evict',
          avgEntrySize: 50,
          evict: evictFn,
          // No getUpdatedContent
        },
      };

      const result = await compactor.compact(component, 10);

      expect(evictFn).toHaveBeenCalled();
      expect(result).toBe(component); // Returns unchanged without updated content
    });
  });

  describe('estimateSavings', () => {
    it('should estimate savings based on avgEntrySize', () => {
      const component: IContextComponent = {
        name: 'memory_index',
        content: 'Memory',
        priority: 8,
        compactable: true,
        metadata: {
          avgEntrySize: 150,
        },
      };

      const savings = compactor.estimateSavings(component);

      expect(savings).toBe(300); // 150 * 2
    });

    it('should use default avgEntrySize if not provided', () => {
      const component: IContextComponent = {
        name: 'memory_index',
        content: 'Memory',
        priority: 8,
        compactable: true,
      };

      const savings = compactor.estimateSavings(component);

      expect(savings).toBe(200); // 100 * 2
    });
  });
});

describe('SummarizeCompactor', () => {
  let compactor: SummarizeCompactor;
  let mockEstimator: ITokenEstimator;
  let mockTextProvider: { generate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockEstimator = {
      estimateTokens: vi.fn((text: string) => Math.floor(text.length / 4)),
      estimateDataTokens: vi.fn((data: unknown) => {
        if (typeof data === 'string') {
          return Math.floor(data.length / 4);
        }
        return Math.floor(JSON.stringify(data).length / 4);
      }),
    };

    // Mock text provider for LLM summarization
    mockTextProvider = {
      generate: vi.fn().mockResolvedValue({
        output_text: 'Summarized content here.',
      }),
    };

    compactor = new SummarizeCompactor(mockEstimator, {
      textProvider: mockTextProvider as unknown as import('@/domain/interfaces/ITextProvider.js').ITextProvider,
      fallbackToTruncate: true,
    });
  });

  describe('Properties', () => {
    it('should have correct name and priority', () => {
      expect(compactor.name).toBe('summarize');
      expect(compactor.priority).toBe(5);
    });
  });

  describe('canCompact', () => {
    it('should return true for components with summarize strategy', () => {
      const component: IContextComponent = {
        name: 'conversation_history',
        content: 'Long conversation',
        priority: 6,
        compactable: true,
        metadata: {
          strategy: 'summarize',
        },
      };

      expect(compactor.canCompact(component)).toBe(true);
    });

    it('should return false for non-compactable components', () => {
      const component: IContextComponent = {
        name: 'system_prompt',
        content: 'System',
        priority: 0,
        compactable: false,
      };

      expect(compactor.canCompact(component)).toBe(false);
    });

    it('should return false for components without summarize strategy', () => {
      const component: IContextComponent = {
        name: 'memory_index',
        content: 'Memory',
        priority: 8,
        compactable: true,
        metadata: {
          strategy: 'evict',
        },
      };

      expect(compactor.canCompact(component)).toBe(false);
    });
  });

  describe('compact', () => {
    it('should return component unchanged if already under target', async () => {
      const component: IContextComponent = {
        name: 'conversation_history',
        content: 'Short', // Only ~1 token
        priority: 6,
        compactable: true,
        metadata: {
          strategy: 'summarize',
        },
      };

      const result = await compactor.compact(component, 100);

      // Should return unchanged since content is already under target
      expect(result).toBe(component);
      // Should NOT call LLM
      expect(mockTextProvider.generate).not.toHaveBeenCalled();
    });

    it('should summarize large content using LLM', async () => {
      const longContent = 'A'.repeat(2000); // ~500 tokens
      const component: IContextComponent = {
        name: 'conversation_history',
        content: longContent,
        priority: 6,
        compactable: true,
        metadata: {
          strategy: 'summarize',
        },
      };

      const result = await compactor.compact(component, 50);

      // Should call LLM for summarization
      expect(mockTextProvider.generate).toHaveBeenCalled();
      // Result should have summarized flag
      expect(result.metadata?.summarized).toBe(true);
    });

    it('should fallback to truncation on LLM failure', async () => {
      mockTextProvider.generate.mockRejectedValueOnce(new Error('LLM error'));

      const longContent = 'A'.repeat(2000);
      const component: IContextComponent = {
        name: 'conversation_history',
        content: longContent,
        priority: 6,
        compactable: true,
        metadata: {
          strategy: 'summarize',
        },
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await compactor.compact(component, 50);

      // Should have truncated flag
      expect(result.metadata?.truncated).toBe(true);
      expect(result.metadata?.summarizationFailed).toBe(true);
      consoleSpy.mockRestore();
    });
  });

  describe('estimateSavings', () => {
    it('should estimate 80% savings for string content', () => {
      const component: IContextComponent = {
        name: 'conversation_history',
        content: 'A'.repeat(1000), // 250 tokens
        priority: 6,
        compactable: true,
        metadata: {
          strategy: 'summarize',
        },
      };

      const savings = compactor.estimateSavings(component);

      expect(savings).toBe(200); // 250 * 0.8 = 200
    });

    it('should estimate 80% savings for object content', () => {
      const component: IContextComponent = {
        name: 'conversation_history',
        content: { messages: ['msg1', 'msg2', 'msg3'] },
        priority: 6,
        compactable: true,
        metadata: {
          strategy: 'summarize',
        },
      };

      const savings = compactor.estimateSavings(component);

      expect(savings).toBeGreaterThan(0);
      // Verifies it calls estimateDataTokens and applies 80% reduction
      expect(mockEstimator.estimateDataTokens).toHaveBeenCalled();
    });

    it('should floor the savings value', () => {
      const component: IContextComponent = {
        name: 'history',
        content: 'A'.repeat(100), // 25 tokens -> 20 saved (floored)
        priority: 6,
        compactable: true,
      };

      const savings = compactor.estimateSavings(component);

      expect(Number.isInteger(savings)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty content', () => {
      const component: IContextComponent = {
        name: 'history',
        content: '',
        priority: 6,
        compactable: true,
        metadata: { strategy: 'summarize' },
      };

      const savings = compactor.estimateSavings(component);

      expect(savings).toBe(0);
    });

    it('should handle complex nested objects', () => {
      const component: IContextComponent = {
        name: 'history',
        content: {
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
          metadata: { timestamp: 123456 },
        },
        priority: 6,
        compactable: true,
      };

      const savings = compactor.estimateSavings(component);

      expect(savings).toBeGreaterThan(0);
      expect(Number.isInteger(savings)).toBe(true);
    });
  });
});
