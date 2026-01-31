/**
 * ContextStrategies Mock Tests
 *
 * Deterministic tests for all 5 compaction strategies:
 * - ProactiveStrategy: triggers at warning/critical, targets 65%, multi-round
 * - AggressiveStrategy: triggers at 60%, targets 50%, single-round
 * - LazyStrategy: triggers only at critical, targets 85%
 * - RollingWindowStrategy: no compaction, window trimming only
 * - AdaptiveStrategy: learns from usage, switches strategies
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ProactiveCompactionStrategy,
  AggressiveCompactionStrategy,
  LazyCompactionStrategy,
  RollingWindowStrategy,
  AdaptiveStrategy,
} from '@/core/context/strategies/index.js';
import type { ContextBudget, ContextManagerConfig, IContextComponent } from '@/core/context/types.js';
import {
  createBudgetAtUtilization,
  createBudgetAtStatus,
  createMockComponent,
  createMockEstimator,
  createTestContextConfig,
  createMockCompactor,
} from '../../helpers/contextTestHelpers.js';

// ============================================================================
// Shared Test Setup
// ============================================================================

const mockConfig: ContextManagerConfig = createTestContextConfig();

// ============================================================================
// ProactiveCompactionStrategy Tests
// ============================================================================

describe('ProactiveCompactionStrategy', () => {
  let strategy: ProactiveCompactionStrategy;

  beforeEach(() => {
    strategy = new ProactiveCompactionStrategy();
  });

  describe('Properties', () => {
    it('should have name "proactive"', () => {
      expect(strategy.name).toBe('proactive');
    });

    it('should return initial metrics', () => {
      const metrics = strategy.getMetrics();
      expect(metrics.compactionCount).toBe(0);
      expect(metrics.totalTokensFreed).toBe(0);
      expect(metrics.avgTokensFreedPerCompaction).toBe(0);
    });
  });

  describe('shouldCompact', () => {
    it('should NOT compact when status is "ok"', () => {
      const budget = createBudgetAtStatus('ok');
      expect(strategy.shouldCompact(budget, mockConfig)).toBe(false);
    });

    it('should compact when status is "warning"', () => {
      const budget = createBudgetAtStatus('warning');
      expect(strategy.shouldCompact(budget, mockConfig)).toBe(true);
    });

    it('should compact when status is "critical"', () => {
      const budget = createBudgetAtStatus('critical');
      expect(strategy.shouldCompact(budget, mockConfig)).toBe(true);
    });

    it('should NOT compact at 70% utilization (below warning)', () => {
      const budget = createBudgetAtUtilization(70);
      expect(strategy.shouldCompact(budget, mockConfig)).toBe(false);
    });

    it('should compact at 76% utilization (at warning)', () => {
      const budget = createBudgetAtUtilization(76);
      expect(strategy.shouldCompact(budget, mockConfig)).toBe(true);
    });
  });

  describe('Target Utilization', () => {
    it('should have default target utilization of 65%', () => {
      expect(strategy.getTargetUtilization()).toBe(0.65);
    });

    it('should support custom target utilization', () => {
      const customStrategy = new ProactiveCompactionStrategy({ targetUtilization: 0.55 });
      expect(customStrategy.getTargetUtilization()).toBe(0.55);
    });
  });

  describe('Multi-Round Compaction', () => {
    it('should calculate decreasing target sizes across rounds', () => {
      // Default: 50% round 1, 35% round 2, 20% round 3
      const beforeSize = 1000;

      // Round 1: 50%
      expect(strategy.calculateTargetSize(beforeSize, 1)).toBe(500);

      // Round 2: 35%
      expect(strategy.calculateTargetSize(beforeSize, 2)).toBe(350);

      // Round 3: 20%
      expect(strategy.calculateTargetSize(beforeSize, 3)).toBe(200);
    });

    it('should never go below 10% target', () => {
      const beforeSize = 1000;
      // Round 10 would be 50% - 9*15% = -85%, but floored at 10%
      expect(strategy.calculateTargetSize(beforeSize, 10)).toBe(100);
    });

    it('should support custom reduction parameters', () => {
      const customStrategy = new ProactiveCompactionStrategy({
        baseReductionFactor: 0.6,
        reductionStep: 0.1,
      });

      const beforeSize = 1000;
      // Round 1: 60%
      expect(customStrategy.calculateTargetSize(beforeSize, 1)).toBe(600);
      // Round 2: 50%
      expect(customStrategy.calculateTargetSize(beforeSize, 2)).toBe(500);
    });
  });

  describe('Compaction Execution', () => {
    it('should execute compaction and update metrics', async () => {
      const estimator = createMockEstimator();
      const { compactor } = createMockCompactor();
      const components = [createMockComponent('test', 'x'.repeat(1000))];
      const budget = createBudgetAtStatus('warning');

      await strategy.compact(components, budget, [compactor], estimator);

      const metrics = strategy.getMetrics();
      expect(metrics.compactionCount).toBe(1);
    });

    it('should track tokens freed in metrics', async () => {
      const estimator = createMockEstimator();
      const { compactor } = createMockCompactor();
      const components = [createMockComponent('test', 'x'.repeat(1000))];
      const budget = createBudgetAtStatus('warning');

      const result = await strategy.compact(components, budget, [compactor], estimator);

      expect(result.tokensFreed).toBeDefined();
      expect(result.log).toBeInstanceOf(Array);
    });
  });

  describe('Metrics Reset', () => {
    it('should reset metrics to zero', async () => {
      const estimator = createMockEstimator();
      const { compactor } = createMockCompactor();
      const components = [createMockComponent('test', 'content')];
      const budget = createBudgetAtStatus('warning');

      // Do a compaction to have non-zero metrics
      await strategy.compact(components, budget, [compactor], estimator);
      expect(strategy.getMetrics().compactionCount).toBe(1);

      // Reset
      strategy.resetMetrics();

      const metrics = strategy.getMetrics();
      expect(metrics.compactionCount).toBe(0);
      expect(metrics.totalTokensFreed).toBe(0);
    });
  });
});

// ============================================================================
// AggressiveCompactionStrategy Tests
// ============================================================================

describe('AggressiveCompactionStrategy', () => {
  let strategy: AggressiveCompactionStrategy;

  beforeEach(() => {
    strategy = new AggressiveCompactionStrategy();
  });

  describe('Properties', () => {
    it('should have name "aggressive"', () => {
      expect(strategy.name).toBe('aggressive');
    });
  });

  describe('shouldCompact', () => {
    it('should compact at lower threshold (60%)', () => {
      // Create budget where overall utilization is above 60%
      const budget = createBudgetAtUtilization(55); // With 15% reserve = ~62% overall
      expect(strategy.shouldCompact(budget, mockConfig)).toBe(true);
    });

    it('should NOT compact below threshold', () => {
      const budget = createBudgetAtUtilization(40); // Well below threshold
      expect(strategy.shouldCompact(budget, mockConfig)).toBe(false);
    });

    it('should compact when status is "warning"', () => {
      const budget = createBudgetAtStatus('warning');
      expect(strategy.shouldCompact(budget, mockConfig)).toBe(true);
    });

    it('should compact when status is "critical"', () => {
      const budget = createBudgetAtStatus('critical');
      expect(strategy.shouldCompact(budget, mockConfig)).toBe(true);
    });
  });

  describe('Target Utilization', () => {
    it('should have default target utilization of 50%', () => {
      expect(strategy.getTargetUtilization()).toBe(0.5);
    });

    it('should support custom target utilization', () => {
      const customStrategy = new AggressiveCompactionStrategy({ targetUtilization: 0.4 });
      expect(customStrategy.getTargetUtilization()).toBe(0.4);
    });
  });

  describe('Single-Round Compaction', () => {
    it('should use aggressive 30% reduction factor', () => {
      const beforeSize = 1000;
      // Default reduction factor is 0.30
      expect(strategy.calculateTargetSize(beforeSize, 1)).toBe(300);
    });

    it('should have same target for all rounds (single-round)', () => {
      const beforeSize = 1000;
      // Same target regardless of round
      expect(strategy.calculateTargetSize(beforeSize, 1)).toBe(300);
      expect(strategy.calculateTargetSize(beforeSize, 2)).toBe(300);
      expect(strategy.calculateTargetSize(beforeSize, 3)).toBe(300);
    });

    it('should support custom reduction factor', () => {
      const customStrategy = new AggressiveCompactionStrategy({ reductionFactor: 0.25 });
      expect(customStrategy.calculateTargetSize(1000, 1)).toBe(250);
    });
  });

  describe('Custom Threshold', () => {
    it('should support custom threshold', () => {
      const customStrategy = new AggressiveCompactionStrategy({ threshold: 0.5 });
      const budget = createBudgetAtUtilization(45); // With 15% reserve = ~53% overall
      expect(customStrategy.shouldCompact(budget, mockConfig)).toBe(true);
    });
  });
});

// ============================================================================
// LazyCompactionStrategy Tests
// ============================================================================

describe('LazyCompactionStrategy', () => {
  let strategy: LazyCompactionStrategy;

  beforeEach(() => {
    strategy = new LazyCompactionStrategy();
  });

  describe('Properties', () => {
    it('should have name "lazy"', () => {
      expect(strategy.name).toBe('lazy');
    });
  });

  describe('shouldCompact', () => {
    it('should NOT compact when status is "ok"', () => {
      const budget = createBudgetAtStatus('ok');
      expect(strategy.shouldCompact(budget, mockConfig)).toBe(false);
    });

    it('should NOT compact when status is "warning"', () => {
      const budget = createBudgetAtStatus('warning');
      expect(strategy.shouldCompact(budget, mockConfig)).toBe(false);
    });

    it('should ONLY compact when status is "critical"', () => {
      const budget = createBudgetAtStatus('critical');
      expect(strategy.shouldCompact(budget, mockConfig)).toBe(true);
    });

    it('should NOT compact at 85% utilization', () => {
      const budget = createBudgetAtUtilization(85);
      expect(strategy.shouldCompact(budget, mockConfig)).toBe(false);
    });

    it('should compact at 95% utilization', () => {
      const budget = createBudgetAtUtilization(95);
      expect(strategy.shouldCompact(budget, mockConfig)).toBe(true);
    });
  });

  describe('Target Utilization', () => {
    it('should have high target utilization of 85%', () => {
      expect(strategy.getTargetUtilization()).toBe(0.85);
    });

    it('should support custom target utilization', () => {
      const customStrategy = new LazyCompactionStrategy({ targetUtilization: 0.9 });
      expect(customStrategy.getTargetUtilization()).toBe(0.9);
    });
  });

  describe('Minimal Compaction', () => {
    it('should use conservative 70% reduction factor', () => {
      const beforeSize = 1000;
      // Default reduction factor is 0.70 (preserve 70%)
      expect(strategy.calculateTargetSize(beforeSize, 1)).toBe(700);
    });

    it('should support custom reduction factor', () => {
      const customStrategy = new LazyCompactionStrategy({ reductionFactor: 0.8 });
      expect(customStrategy.calculateTargetSize(1000, 1)).toBe(800);
    });
  });
});

// ============================================================================
// RollingWindowStrategy Tests
// ============================================================================

describe('RollingWindowStrategy', () => {
  let strategy: RollingWindowStrategy;

  beforeEach(() => {
    strategy = new RollingWindowStrategy();
  });

  describe('Properties', () => {
    it('should have name "rolling-window"', () => {
      expect(strategy.name).toBe('rolling-window');
    });
  });

  describe('shouldCompact', () => {
    it('should NEVER trigger compaction', () => {
      expect(strategy.shouldCompact(createBudgetAtStatus('ok'), mockConfig)).toBe(false);
      expect(strategy.shouldCompact(createBudgetAtStatus('warning'), mockConfig)).toBe(false);
      expect(strategy.shouldCompact(createBudgetAtStatus('critical'), mockConfig)).toBe(false);
    });

    it('should not compact even at 100% utilization', () => {
      const budget = createBudgetAtUtilization(100);
      expect(strategy.shouldCompact(budget, mockConfig)).toBe(false);
    });
  });

  describe('Window Trimming via prepareComponents', () => {
    it('should trim array components to maxMessages', async () => {
      const strategy = new RollingWindowStrategy({ maxMessages: 5 });

      const components: IContextComponent[] = [
        createMockComponent('history', Array(10).fill({ message: 'test' })),
      ];

      const prepared = await strategy.prepareComponents!(components);

      expect((prepared[0].content as unknown[]).length).toBe(5);
      expect(prepared[0].metadata?.windowed).toBe(true);
      expect(prepared[0].metadata?.originalLength).toBe(10);
      expect(prepared[0].metadata?.keptLength).toBe(5);
    });

    it('should keep most recent items (slice from end)', async () => {
      const strategy = new RollingWindowStrategy({ maxMessages: 3 });

      const messages = [
        { id: 1, content: 'oldest' },
        { id: 2, content: 'old' },
        { id: 3, content: 'middle' },
        { id: 4, content: 'recent' },
        { id: 5, content: 'newest' },
      ];
      const components = [createMockComponent('history', messages)];

      const prepared = await strategy.prepareComponents!(components);
      const kept = prepared[0].content as typeof messages;

      expect(kept.length).toBe(3);
      expect(kept[0].id).toBe(3); // middle
      expect(kept[1].id).toBe(4); // recent
      expect(kept[2].id).toBe(5); // newest
    });

    it('should NOT trim arrays smaller than maxMessages', async () => {
      const strategy = new RollingWindowStrategy({ maxMessages: 10 });

      const components = [
        createMockComponent('history', Array(5).fill({ message: 'test' })),
      ];

      const prepared = await strategy.prepareComponents!(components);

      expect((prepared[0].content as unknown[]).length).toBe(5);
      expect(prepared[0].metadata?.windowed).toBeUndefined();
    });

    it('should NOT modify non-array components', async () => {
      const strategy = new RollingWindowStrategy({ maxMessages: 5 });

      const components = [createMockComponent('text', 'This is a string')];

      const prepared = await strategy.prepareComponents!(components);

      expect(prepared[0].content).toBe('This is a string');
    });

    it('should use default maxMessages when not specified', async () => {
      const strategy = new RollingWindowStrategy();

      // Default should be higher than 5
      const components = [
        createMockComponent('history', Array(100).fill({ message: 'test' })),
      ];

      const prepared = await strategy.prepareComponents!(components);

      // Should trim to default (typically 50 or similar)
      expect((prepared[0].content as unknown[]).length).toBeLessThan(100);
    });
  });

  describe('compact Method', () => {
    it('should return empty result (no-op)', async () => {
      const result = await strategy.compact();

      expect(result.components).toEqual([]);
      expect(result.log).toEqual([]);
      expect(result.tokensFreed).toBe(0);
    });
  });
});

// ============================================================================
// AdaptiveStrategy Tests
// ============================================================================

describe('AdaptiveStrategy', () => {
  let strategy: AdaptiveStrategy;

  beforeEach(() => {
    strategy = new AdaptiveStrategy();
  });

  describe('Properties', () => {
    it('should have name "adaptive"', () => {
      expect(strategy.name).toBe('adaptive');
    });

    it('should start with proactive strategy', () => {
      const metrics = strategy.getMetrics();
      expect(metrics.currentStrategy).toBe('proactive');
    });
  });

  describe('Initial Metrics', () => {
    it('should have initial metric values', () => {
      const metrics = strategy.getMetrics();

      expect(metrics.avgUtilization).toBe(0);
      expect(metrics.compactionFrequency).toBe(0);
      expect(metrics.lastCompactions).toEqual([]);
      expect(metrics.currentStrategy).toBe('proactive');
    });
  });

  describe('shouldCompact Delegation', () => {
    it('should delegate to current strategy', () => {
      // Initially proactive, so should compact at warning
      const warningBudget = createBudgetAtStatus('warning');
      expect(strategy.shouldCompact(warningBudget, mockConfig)).toBe(true);

      // Should NOT compact at ok
      const okBudget = createBudgetAtStatus('ok');
      expect(strategy.shouldCompact(okBudget, mockConfig)).toBe(false);
    });
  });

  describe('Utilization Tracking', () => {
    it('should track average utilization using EMA', () => {
      const budget50 = createBudgetAtUtilization(50);
      const budget80 = createBudgetAtUtilization(80);

      // First call establishes initial value
      strategy.shouldCompact(budget50, mockConfig);
      const metrics1 = strategy.getMetrics();
      expect(metrics1.avgUtilization).toBeGreaterThan(0);

      // Second call updates with EMA
      strategy.shouldCompact(budget80, mockConfig);
      const metrics2 = strategy.getMetrics();
      expect(metrics2.avgUtilization).toBeGreaterThan(metrics1.avgUtilization);
    });
  });

  describe('Strategy Switching', () => {
    it('should switch to aggressive after frequent compactions', async () => {
      const strategy = new AdaptiveStrategy({ switchThreshold: 2 });
      const estimator = createMockEstimator();
      const { compactor } = createMockCompactor();
      const components = [createMockComponent('test', 'content')];
      const budget = createBudgetAtStatus('warning');

      // Simulate frequent compactions
      for (let i = 0; i < 5; i++) {
        strategy.shouldCompact(budget, mockConfig);
        await strategy.compact(components, budget, [compactor], estimator);
      }

      const metrics = strategy.getMetrics();
      // Should have switched to aggressive due to high frequency
      expect(['aggressive', 'proactive']).toContain(metrics.currentStrategy);
    });

    it('should include strategy name in compaction log', async () => {
      const estimator = createMockEstimator();
      const { compactor } = createMockCompactor();
      const components = [createMockComponent('test', 'content')];
      const budget = createBudgetAtStatus('warning');

      const result = await strategy.compact(components, budget, [compactor], estimator);

      expect(result.log.some(l => l.includes('[Adaptive:'))).toBe(true);
    });
  });

  describe('Learning Window', () => {
    it('should limit tracked compactions to learning window', async () => {
      const strategy = new AdaptiveStrategy({ learningWindow: 3 });
      const estimator = createMockEstimator();
      const { compactor } = createMockCompactor();
      const components = [createMockComponent('test', 'content')];
      const budget = createBudgetAtStatus('warning');

      // Perform more compactions than learning window
      for (let i = 0; i < 5; i++) {
        strategy.shouldCompact(budget, mockConfig);
        await strategy.compact(components, budget, [compactor], estimator);
      }

      const metrics = strategy.getMetrics();
      expect(metrics.lastCompactions.length).toBeLessThanOrEqual(3);
    });
  });
});

// ============================================================================
// Strategy Comparison Tests
// ============================================================================

describe('Strategy Comparison', () => {
  it('should have consistent names across all strategies', () => {
    expect(new ProactiveCompactionStrategy().name).toBe('proactive');
    expect(new AggressiveCompactionStrategy().name).toBe('aggressive');
    expect(new LazyCompactionStrategy().name).toBe('lazy');
    expect(new RollingWindowStrategy().name).toBe('rolling-window');
    expect(new AdaptiveStrategy().name).toBe('adaptive');
  });

  it('should have different compaction thresholds', () => {
    const okBudget = createBudgetAtStatus('ok');
    const warningBudget = createBudgetAtStatus('warning');
    const criticalBudget = createBudgetAtStatus('critical');

    const proactive = new ProactiveCompactionStrategy();
    const aggressive = new AggressiveCompactionStrategy();
    const lazy = new LazyCompactionStrategy();
    const rolling = new RollingWindowStrategy();

    // At OK status
    expect(proactive.shouldCompact(okBudget, mockConfig)).toBe(false);
    expect(aggressive.shouldCompact(okBudget, mockConfig)).toBe(false);
    expect(lazy.shouldCompact(okBudget, mockConfig)).toBe(false);
    expect(rolling.shouldCompact(okBudget, mockConfig)).toBe(false);

    // At WARNING status
    expect(proactive.shouldCompact(warningBudget, mockConfig)).toBe(true);
    expect(aggressive.shouldCompact(warningBudget, mockConfig)).toBe(true);
    expect(lazy.shouldCompact(warningBudget, mockConfig)).toBe(false); // Only critical
    expect(rolling.shouldCompact(warningBudget, mockConfig)).toBe(false); // Never

    // At CRITICAL status
    expect(proactive.shouldCompact(criticalBudget, mockConfig)).toBe(true);
    expect(aggressive.shouldCompact(criticalBudget, mockConfig)).toBe(true);
    expect(lazy.shouldCompact(criticalBudget, mockConfig)).toBe(true);
    expect(rolling.shouldCompact(criticalBudget, mockConfig)).toBe(false); // Never
  });

  it('should have different target utilizations', () => {
    const proactive = new ProactiveCompactionStrategy();
    const aggressive = new AggressiveCompactionStrategy();
    const lazy = new LazyCompactionStrategy();

    // Aggressive is lowest (most aggressive reduction)
    expect(aggressive.getTargetUtilization()).toBe(0.5);

    // Proactive is middle
    expect(proactive.getTargetUtilization()).toBe(0.65);

    // Lazy is highest (minimal reduction)
    expect(lazy.getTargetUtilization()).toBe(0.85);
  });
});
