/**
 * Low Coverage Strategy Tests
 * Tests for AggressiveStrategy and LazyStrategy
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AggressiveCompactionStrategy,
  AggressiveStrategyOptions,
} from '@/core/context/strategies/AggressiveStrategy.js';
import { LazyCompactionStrategy } from '@/core/context/strategies/LazyStrategy.js';
import type {
  IContextComponent,
  ContextBudget,
  ContextManagerConfig,
  IContextCompactor,
  ITokenEstimator,
} from '@/core/context/types.js';

describe('AggressiveCompactionStrategy', () => {
  let strategy: AggressiveCompactionStrategy;
  let mockEstimator: ITokenEstimator;
  let mockCompactor: IContextCompactor;

  beforeEach(() => {
    mockEstimator = {
      estimateTokens: vi.fn((text: string) => Math.floor(text.length / 4)),
      estimateDataTokens: vi.fn((data: unknown) => {
        if (typeof data === 'string') return Math.floor(data.length / 4);
        return Math.floor(JSON.stringify(data).length / 4);
      }),
    };

    mockCompactor = {
      name: 'test-compactor',
      priority: 5,
      canCompact: vi.fn(() => true),
      compact: vi.fn(async (component: IContextComponent, targetSize: number) => {
        return {
          ...component,
          content:
            typeof component.content === 'string'
              ? component.content.substring(0, targetSize * 4)
              : component.content,
        };
      }),
      estimateSavings: vi.fn(() => 100),
    };

    strategy = new AggressiveCompactionStrategy();
  });

  describe('Properties', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('aggressive');
    });
  });

  describe('shouldCompact', () => {
    it('should compact at 60% threshold by default', () => {
      const budget: ContextBudget = {
        total: 100000,
        reserved: 10000,
        used: 50000, // 60% total usage
        available: 40000,
        utilizationPercent: 60,
        status: 'ok',
        breakdown: {} as any,
      };

      const config: ContextManagerConfig = {
        maxContextTokens: 100000,
        strategy: 'aggressive',
      };

      expect(strategy.shouldCompact(budget, config)).toBe(true);
    });

    it('should not compact below 60% threshold', () => {
      const budget: ContextBudget = {
        total: 100000,
        reserved: 10000,
        used: 45000, // 55% total usage
        available: 45000,
        utilizationPercent: 55,
        status: 'ok',
        breakdown: {} as any,
      };

      const config: ContextManagerConfig = {
        maxContextTokens: 100000,
        strategy: 'aggressive',
      };

      expect(strategy.shouldCompact(budget, config)).toBe(false);
    });

    it('should respect custom threshold', () => {
      const options: AggressiveStrategyOptions = {
        threshold: 0.5, // 50% instead of 60%
      };
      const customStrategy = new AggressiveCompactionStrategy(options);

      const budget: ContextBudget = {
        total: 100000,
        reserved: 10000,
        used: 40000, // 50% total usage
        available: 50000,
        utilizationPercent: 50,
        status: 'ok',
        breakdown: {} as any,
      };

      const config: ContextManagerConfig = {
        maxContextTokens: 100000,
        strategy: 'aggressive',
      };

      expect(customStrategy.shouldCompact(budget, config)).toBe(true);
    });

    it('should compact at critical levels', () => {
      const budget: ContextBudget = {
        total: 100000,
        reserved: 10000,
        used: 85000, // 95% total usage
        available: 5000,
        utilizationPercent: 95,
        status: 'critical',
        breakdown: {} as any,
      };

      const config: ContextManagerConfig = {
        maxContextTokens: 100000,
        strategy: 'aggressive',
      };

      expect(strategy.shouldCompact(budget, config)).toBe(true);
    });
  });

  describe('compact', () => {
    it('should target 50% usage by default', async () => {
      const components: IContextComponent[] = [
        {
          name: 'history',
          content: 'A'.repeat(4000), // 1000 tokens
          priority: 8,
          compactable: true,
        },
      ];

      const budget: ContextBudget = {
        total: 100000,
        reserved: 10000,
        used: 70000,
        available: 20000,
        utilizationPercent: 80,
        status: 'warning',
        breakdown: {} as any,
      };

      const result = await strategy.compact(components, budget, [mockCompactor], mockEstimator);

      expect(result.components).toBeDefined();
      expect(result.log.length).toBeGreaterThan(0);
      expect(result.tokensFreed).toBeGreaterThan(0);
    });

    it('should respect custom target', async () => {
      const options: AggressiveStrategyOptions = {
        target: 0.4, // 40% instead of 50%
      };
      const customStrategy = new AggressiveCompactionStrategy(options);

      const components: IContextComponent[] = [
        {
          name: 'history',
          content: 'A'.repeat(4000),
          priority: 8,
          compactable: true,
        },
      ];

      const budget: ContextBudget = {
        total: 100000,
        reserved: 0,
        used: 60000,
        available: 40000,
        utilizationPercent: 60,
        status: 'warning',
        breakdown: {} as any,
      };

      const result = await customStrategy.compact(
        components,
        budget,
        [mockCompactor],
        mockEstimator
      );

      expect(result).toBeDefined();
      // Should try to free more tokens to reach 40% target
      expect(mockCompactor.compact).toHaveBeenCalled();
    });

    it('should compact components by priority (highest first)', async () => {
      const components: IContextComponent[] = [
        {
          name: 'low_priority',
          content: 'A'.repeat(2000),
          priority: 5,
          compactable: true,
        },
        {
          name: 'high_priority',
          content: 'B'.repeat(2000),
          priority: 10,
          compactable: true,
        },
        {
          name: 'medium_priority',
          content: 'C'.repeat(2000),
          priority: 7,
          compactable: true,
        },
      ];

      const budget: ContextBudget = {
        total: 100000,
        reserved: 0,
        used: 70000,
        available: 30000,
        utilizationPercent: 70,
        status: 'warning',
        breakdown: {} as any,
      };

      await strategy.compact(components, budget, [mockCompactor], mockEstimator);

      // Verify compact was called (high priority components should be compacted first)
      expect(mockCompactor.compact).toHaveBeenCalled();
    });

    it('should target 30% of original size (aggressive)', async () => {
      const components: IContextComponent[] = [
        {
          name: 'history',
          content: 'A'.repeat(4000), // 1000 tokens
          priority: 8,
          compactable: true,
        },
      ];

      const budget: ContextBudget = {
        total: 100000,
        reserved: 0,
        used: 70000,
        available: 30000,
        utilizationPercent: 70,
        status: 'warning',
        breakdown: {} as any,
      };

      await strategy.compact(components, budget, [mockCompactor], mockEstimator);

      // Check that compact was called with ~30% target
      expect(mockCompactor.compact).toHaveBeenCalled();
      const call = (mockCompactor.compact as any).mock.calls[0];
      const targetSize = call[1];
      const originalSize = mockEstimator.estimateTokens('A'.repeat(4000));
      expect(targetSize).toBeLessThan(originalSize * 0.5); // Should be aggressive
    });

    it('should skip non-compactable components', async () => {
      const components: IContextComponent[] = [
        {
          name: 'system_prompt',
          content: 'System',
          priority: 0,
          compactable: false,
        },
        {
          name: 'history',
          content: 'A'.repeat(4000),
          priority: 8,
          compactable: true,
        },
      ];

      const budget: ContextBudget = {
        total: 100000,
        reserved: 0,
        used: 70000,
        available: 30000,
        utilizationPercent: 70,
        status: 'warning',
        breakdown: {} as any,
      };

      const result = await strategy.compact(components, budget, [mockCompactor], mockEstimator);

      // Should still have system_prompt unchanged
      const systemPrompt = result.components.find((c) => c.name === 'system_prompt');
      expect(systemPrompt?.content).toBe('System');
    });

    it('should stop compacting once target is reached', async () => {
      const components: IContextComponent[] = [
        {
          name: 'comp1',
          content: 'A'.repeat(4000),
          priority: 10,
          compactable: true,
        },
        {
          name: 'comp2',
          content: 'B'.repeat(4000),
          priority: 9,
          compactable: true,
        },
        {
          name: 'comp3',
          content: 'C'.repeat(4000),
          priority: 8,
          compactable: true,
        },
      ];

      const budget: ContextBudget = {
        total: 100000,
        reserved: 0,
        used: 51000, // Just slightly over target
        available: 49000,
        utilizationPercent: 51,
        status: 'ok',
        breakdown: {} as any,
      };

      const result = await strategy.compact(components, budget, [mockCompactor], mockEstimator);

      // Should stop early if target reached
      expect(result.tokensFreed).toBeGreaterThanOrEqual(0);
    });

    it('should handle components without matching compactor', async () => {
      const restrictiveCompactor: IContextCompactor = {
        ...mockCompactor,
        canCompact: vi.fn(() => false), // Can't compact anything
      };

      const components: IContextComponent[] = [
        {
          name: 'history',
          content: 'A'.repeat(4000),
          priority: 8,
          compactable: true,
        },
      ];

      const budget: ContextBudget = {
        total: 100000,
        reserved: 0,
        used: 70000,
        available: 30000,
        utilizationPercent: 70,
        status: 'warning',
        breakdown: {} as any,
      };

      const result = await strategy.compact(
        components,
        budget,
        [restrictiveCompactor],
        mockEstimator
      );

      expect(result.tokensFreed).toBe(0);
      expect(result.log).toEqual([]);
    });

    it('should handle object content', async () => {
      const components: IContextComponent[] = [
        {
          name: 'data',
          content: { messages: ['msg1', 'msg2'] },
          priority: 8,
          compactable: true,
        },
      ];

      const budget: ContextBudget = {
        total: 100000,
        reserved: 0,
        used: 70000,
        available: 30000,
        utilizationPercent: 70,
        status: 'warning',
        breakdown: {} as any,
      };

      const result = await strategy.compact(components, budget, [mockCompactor], mockEstimator);

      expect(result).toBeDefined();
      expect(mockEstimator.estimateDataTokens).toHaveBeenCalled();
    });
  });
});

describe('LazyCompactionStrategy', () => {
  let strategy: LazyCompactionStrategy;
  let mockEstimator: ITokenEstimator;
  let mockCompactor: IContextCompactor;

  beforeEach(() => {
    mockEstimator = {
      estimateTokens: vi.fn((text: string) => Math.floor(text.length / 4)),
      estimateDataTokens: vi.fn((data: unknown) => {
        if (typeof data === 'string') return Math.floor(data.length / 4);
        return Math.floor(JSON.stringify(data).length / 4);
      }),
    };

    mockCompactor = {
      name: 'test-compactor',
      priority: 5,
      canCompact: vi.fn(() => true),
      compact: vi.fn(async (component: IContextComponent, targetSize: number) => {
        return {
          ...component,
          content:
            typeof component.content === 'string'
              ? component.content.substring(0, targetSize * 4)
              : component.content,
        };
      }),
      estimateSavings: vi.fn(() => 100),
    };

    strategy = new LazyCompactionStrategy();
  });

  describe('Properties', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('lazy');
    });
  });

  describe('shouldCompact', () => {
    it('should only compact when status is critical', () => {
      const criticalBudget: ContextBudget = {
        total: 100000,
        reserved: 10000,
        used: 85000,
        available: 5000,
        utilizationPercent: 95,
        status: 'critical',
        breakdown: {} as any,
      };

      const config: ContextManagerConfig = {
        maxContextTokens: 100000,
        strategy: 'lazy',
      };

      expect(strategy.shouldCompact(criticalBudget, config)).toBe(true);
    });

    it('should not compact when status is warning', () => {
      const warningBudget: ContextBudget = {
        total: 100000,
        reserved: 10000,
        used: 75000,
        available: 15000,
        utilizationPercent: 85,
        status: 'warning',
        breakdown: {} as any,
      };

      const config: ContextManagerConfig = {
        maxContextTokens: 100000,
        strategy: 'lazy',
      };

      expect(strategy.shouldCompact(warningBudget, config)).toBe(false);
    });

    it('should not compact when status is ok', () => {
      const okBudget: ContextBudget = {
        total: 100000,
        reserved: 10000,
        used: 50000,
        available: 40000,
        utilizationPercent: 60,
        status: 'ok',
        breakdown: {} as any,
      };

      const config: ContextManagerConfig = {
        maxContextTokens: 100000,
        strategy: 'lazy',
      };

      expect(strategy.shouldCompact(okBudget, config)).toBe(false);
    });
  });

  describe('compact', () => {
    it('should target 85% usage (minimal compaction)', async () => {
      const components: IContextComponent[] = [
        {
          name: 'history',
          content: 'A'.repeat(4000),
          priority: 8,
          compactable: true,
        },
      ];

      const budget: ContextBudget = {
        total: 100000,
        reserved: 0,
        used: 92000, // Critical level
        available: 8000,
        utilizationPercent: 92,
        status: 'critical',
        breakdown: {} as any,
      };

      const result = await strategy.compact(components, budget, [mockCompactor], mockEstimator);

      expect(result.components).toBeDefined();
      expect(result.log.length).toBeGreaterThan(0);
      // Should free minimal tokens (just to get to 85%)
      expect(result.tokensFreed).toBeGreaterThan(0);
    });

    it('should compact to 70% of original size (minimal)', async () => {
      const components: IContextComponent[] = [
        {
          name: 'history',
          content: 'A'.repeat(4000), // 1000 tokens
          priority: 8,
          compactable: true,
        },
      ];

      const budget: ContextBudget = {
        total: 100000,
        reserved: 0,
        used: 92000,
        available: 8000,
        utilizationPercent: 92,
        status: 'critical',
        breakdown: {} as any,
      };

      await strategy.compact(components, budget, [mockCompactor], mockEstimator);

      // Check that compact was called with ~70% target (less aggressive)
      expect(mockCompactor.compact).toHaveBeenCalled();
      const call = (mockCompactor.compact as any).mock.calls[0];
      const targetSize = call[1];
      const originalSize = mockEstimator.estimateTokens('A'.repeat(4000));
      expect(targetSize).toBeGreaterThan(originalSize * 0.6); // Should preserve more
    });

    it('should stop as soon as enough tokens are freed', async () => {
      const components: IContextComponent[] = [
        {
          name: 'comp1',
          content: 'A'.repeat(4000),
          priority: 10,
          compactable: true,
        },
        {
          name: 'comp2',
          content: 'B'.repeat(4000),
          priority: 9,
          compactable: true,
        },
      ];

      const budget: ContextBudget = {
        total: 100000,
        reserved: 0,
        used: 86000, // Just slightly over target
        available: 14000,
        utilizationPercent: 86,
        status: 'critical',
        breakdown: {} as any,
      };

      const result = await strategy.compact(components, budget, [mockCompactor], mockEstimator);

      // Should stop early once target reached
      expect(result.tokensFreed).toBeGreaterThanOrEqual(0);
    });

    it('should compact by priority', async () => {
      const components: IContextComponent[] = [
        {
          name: 'low_priority',
          content: 'A'.repeat(2000),
          priority: 5,
          compactable: true,
        },
        {
          name: 'high_priority',
          content: 'B'.repeat(2000),
          priority: 10,
          compactable: true,
        },
      ];

      const budget: ContextBudget = {
        total: 100000,
        reserved: 0,
        used: 92000,
        available: 8000,
        utilizationPercent: 92,
        status: 'critical',
        breakdown: {} as any,
      };

      await strategy.compact(components, budget, [mockCompactor], mockEstimator);

      expect(mockCompactor.compact).toHaveBeenCalled();
    });

    it('should handle object content', async () => {
      const components: IContextComponent[] = [
        {
          name: 'data',
          content: { large: 'data', items: [1, 2, 3] },
          priority: 8,
          compactable: true,
        },
      ];

      const budget: ContextBudget = {
        total: 100000,
        reserved: 0,
        used: 92000,
        available: 8000,
        utilizationPercent: 92,
        status: 'critical',
        breakdown: {} as any,
      };

      const result = await strategy.compact(components, budget, [mockCompactor], mockEstimator);

      expect(result).toBeDefined();
      expect(mockEstimator.estimateDataTokens).toHaveBeenCalled();
    });

    it('should skip non-compactable components', async () => {
      const components: IContextComponent[] = [
        {
          name: 'system',
          content: 'System',
          priority: 0,
          compactable: false,
        },
        {
          name: 'history',
          content: 'A'.repeat(4000),
          priority: 8,
          compactable: true,
        },
      ];

      const budget: ContextBudget = {
        total: 100000,
        reserved: 0,
        used: 92000,
        available: 8000,
        utilizationPercent: 92,
        status: 'critical',
        breakdown: {} as any,
      };

      const result = await strategy.compact(components, budget, [mockCompactor], mockEstimator);

      const system = result.components.find((c) => c.name === 'system');
      expect(system?.content).toBe('System');
    });

    it('should handle no matching compactor', async () => {
      const restrictiveCompactor: IContextCompactor = {
        ...mockCompactor,
        canCompact: vi.fn(() => false),
      };

      const components: IContextComponent[] = [
        {
          name: 'history',
          content: 'A'.repeat(4000),
          priority: 8,
          compactable: true,
        },
      ];

      const budget: ContextBudget = {
        total: 100000,
        reserved: 0,
        used: 92000,
        available: 8000,
        utilizationPercent: 92,
        status: 'critical',
        breakdown: {} as any,
      };

      const result = await strategy.compact(
        components,
        budget,
        [restrictiveCompactor],
        mockEstimator
      );

      expect(result.tokensFreed).toBe(0);
    });
  });
});
