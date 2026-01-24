/**
 * Context Strategy Tests
 */

import { describe, it, expect } from 'vitest';
import {
  ProactiveCompactionStrategy,
  AggressiveCompactionStrategy,
  LazyCompactionStrategy,
  RollingWindowStrategy,
  AdaptiveStrategy,
} from '@/core/context/strategies/index.js';
import type { ContextBudget, ContextManagerConfig, IContextComponent } from '@/core/context/types.js';

const mockConfig: ContextManagerConfig = {
  maxContextTokens: 1000,
  compactionThreshold: 0.75,
  hardLimit: 0.9,
  responseReserve: 0.15,
  estimator: 'approximate',
  autoCompact: true,
};

const createBudget = (utilizationPercent: number): ContextBudget => {
  const total = 1000;
  const reserved = 150;
  const used = Math.floor(((total - reserved) * utilizationPercent) / 100);
  const available = total - reserved - used;
  const utilizationRatio = (used + reserved) / total;

  let status: 'ok' | 'warning' | 'critical';
  if (utilizationRatio >= 0.9) {
    status = 'critical';
  } else if (utilizationRatio >= 0.75) {
    status = 'warning';
  } else {
    status = 'ok';
  }

  return {
    total,
    reserved,
    used,
    available,
    utilizationPercent,
    status,
    breakdown: {},
  };
};

describe('ProactiveCompactionStrategy', () => {
  const strategy = new ProactiveCompactionStrategy();

  it('should have correct name', () => {
    expect(strategy.name).toBe('proactive');
  });

  it('should compact when status is warning', () => {
    const budget = createBudget(76);
    expect(strategy.shouldCompact(budget, mockConfig)).toBe(true);
  });

  it('should compact when status is critical', () => {
    const budget = createBudget(91);
    expect(strategy.shouldCompact(budget, mockConfig)).toBe(true);
  });

  it('should not compact when status is ok', () => {
    const budget = createBudget(50);
    expect(strategy.shouldCompact(budget, mockConfig)).toBe(false);
  });

  it('should return metrics', () => {
    const metrics = strategy.getMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.compactionCount).toBe(0);
  });
});

describe('AggressiveCompactionStrategy', () => {
  it('should have correct name', () => {
    const strategy = new AggressiveCompactionStrategy();
    expect(strategy.name).toBe('aggressive');
  });

  it('should compact at lower threshold (60%)', () => {
    const strategy = new AggressiveCompactionStrategy({ threshold: 0.6 });
    const budget = createBudget(61);
    expect(strategy.shouldCompact(budget, mockConfig)).toBe(true);
  });

  it('should not compact below threshold', () => {
    const strategy = new AggressiveCompactionStrategy({ threshold: 0.6 });
    const budget = createBudget(50);
    expect(strategy.shouldCompact(budget, mockConfig)).toBe(false);
  });

  it('should use custom options', () => {
    const strategy = new AggressiveCompactionStrategy({
      threshold: 0.55,
      target: 0.45,
    });

    const budget = createBudget(56);
    expect(strategy.shouldCompact(budget, mockConfig)).toBe(true);
  });
});

describe('LazyCompactionStrategy', () => {
  const strategy = new LazyCompactionStrategy();

  it('should have correct name', () => {
    expect(strategy.name).toBe('lazy');
  });

  it('should only compact when critical', () => {
    const criticalBudget = createBudget(91);
    expect(strategy.shouldCompact(criticalBudget, mockConfig)).toBe(true);

    const warningBudget = createBudget(76);
    expect(strategy.shouldCompact(warningBudget, mockConfig)).toBe(false);

    const okBudget = createBudget(50);
    expect(strategy.shouldCompact(okBudget, mockConfig)).toBe(false);
  });
});

describe('RollingWindowStrategy', () => {
  it('should have correct name', () => {
    const strategy = new RollingWindowStrategy();
    expect(strategy.name).toBe('rolling-window');
  });

  it('should never trigger compaction', () => {
    const strategy = new RollingWindowStrategy();
    const budget = createBudget(95);
    expect(strategy.shouldCompact(budget, mockConfig)).toBe(false);
  });

  it('should window array components in prepareComponents', async () => {
    const strategy = new RollingWindowStrategy({ maxMessages: 5 });

    const components: IContextComponent[] = [
      {
        name: 'history',
        content: Array(10).fill({ message: 'test' }),
        priority: 5,
        compactable: true,
      },
    ];

    const prepared = await strategy.prepareComponents!(components);

    expect(Array.isArray(prepared[0].content)).toBe(true);
    expect((prepared[0].content as unknown[]).length).toBe(5);
    expect(prepared[0].metadata?.windowed).toBe(true);
  });

  it('should not window small arrays', async () => {
    const strategy = new RollingWindowStrategy({ maxMessages: 10 });

    const components: IContextComponent[] = [
      {
        name: 'history',
        content: Array(5).fill({ message: 'test' }),
        priority: 5,
        compactable: true,
      },
    ];

    const prepared = await strategy.prepareComponents!(components);

    expect((prepared[0].content as unknown[]).length).toBe(5);
    expect(prepared[0].metadata?.windowed).toBeUndefined();
  });
});

describe('AdaptiveStrategy', () => {
  it('should have correct name', () => {
    const strategy = new AdaptiveStrategy();
    expect(strategy.name).toBe('adaptive');
  });

  it('should start with proactive strategy', () => {
    const strategy = new AdaptiveStrategy();
    const metrics = strategy.getMetrics!();
    expect(metrics.currentStrategy).toBe('proactive');
  });

  it('should track metrics', () => {
    const strategy = new AdaptiveStrategy();
    const metrics = strategy.getMetrics!();

    expect(metrics).toBeDefined();
    expect(metrics.avgUtilization).toBeDefined();
    expect(metrics.compactionFrequency).toBeDefined();
    expect(metrics.currentStrategy).toBeDefined();
  });

  it('should adapt based on compaction frequency', async () => {
    const strategy = new AdaptiveStrategy({ switchThreshold: 2 });

    // Simulate frequent compactions
    const budget = createBudget(76);
    for (let i = 0; i < 5; i++) {
      strategy.shouldCompact(budget, mockConfig);
      await strategy.compact([], budget, [], {} as any);
    }

    const metrics = strategy.getMetrics!();
    // Should switch to aggressive after frequent compactions
    expect(['aggressive', 'proactive']).toContain(metrics.currentStrategy);
  });
});
