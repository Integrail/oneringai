/**
 * ContextManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextManager } from '@/core/context/ContextManager.js';
import type {
  IContextProvider,
  IContextComponent,
  ITokenEstimator,
  IContextCompactor,
} from '@/core/context/types.js';

// Mock provider
class MockProvider implements IContextProvider {
  private components: IContextComponent[] = [];

  constructor(components: IContextComponent[] = []) {
    this.components = components;
  }

  async getComponents(): Promise<IContextComponent[]> {
    return this.components;
  }

  async applyCompactedComponents(components: IContextComponent[]): Promise<void> {
    this.components = components;
  }

  getMaxContextSize(): number {
    return 1000; // Small for testing
  }

  setComponents(components: IContextComponent[]): void {
    this.components = components;
  }
}

// Mock estimator
const mockEstimator: ITokenEstimator = {
  estimateTokens: (text: string) => Math.ceil(text.length / 4),
  estimateDataTokens: (data: unknown) => {
    const str = JSON.stringify(data);
    return Math.ceil(str.length / 4);
  },
};

// Mock compactor
class MockCompactor implements IContextCompactor {
  readonly name = 'mock';
  readonly priority = 10;

  canCompact(component: IContextComponent): boolean {
    return component.compactable;
  }

  async compact(component: IContextComponent, targetTokens: number): Promise<IContextComponent> {
    if (typeof component.content === 'string') {
      const targetChars = targetTokens * 4;
      return {
        ...component,
        content: component.content.substring(0, targetChars),
      };
    }
    return component;
  }

  estimateSavings(component: IContextComponent): number {
    return 100;
  }
}

describe('ContextManager', () => {
  let provider: MockProvider;
  let contextManager: ContextManager;

  beforeEach(() => {
    provider = new MockProvider();
    contextManager = new ContextManager(
      provider,
      {
        maxContextTokens: 1000,
        compactionThreshold: 0.75,
        hardLimit: 0.9,
        responseReserve: 0.15,
        estimator: mockEstimator,
        autoCompact: true,
        strategy: 'proactive',
      },
      [new MockCompactor()],
      mockEstimator
    );
  });

  describe('prepare()', () => {
    it('should prepare context without compaction when under threshold', async () => {
      const components: IContextComponent[] = [
        {
          name: 'test',
          content: 'Hello world',
          priority: 0,
          compactable: false,
        },
      ];

      provider.setComponents(components);

      const result = await contextManager.prepare();

      expect(result.compacted).toBe(false);
      expect(result.budget.status).toBe('ok');
      expect(result.components).toHaveLength(1);
    });

    it('should calculate budget correctly', async () => {
      const components: IContextComponent[] = [
        {
          name: 'test',
          content: 'x'.repeat(400), // 100 tokens
          priority: 0,
          compactable: false,
        },
      ];

      provider.setComponents(components);

      const result = await contextManager.prepare();

      expect(result.budget.total).toBe(1000);
      expect(result.budget.reserved).toBe(150); // 15%
      expect(result.budget.used).toBe(100);
      expect(result.budget.available).toBe(750);
    });

    it('should compact when over threshold', async () => {
      const components: IContextComponent[] = [
        {
          name: 'test',
          content: 'x'.repeat(3200), // 800 tokens - over 75% threshold
          priority: 10,
          compactable: true,
        },
      ];

      provider.setComponents(components);

      const result = await contextManager.prepare();

      expect(result.compacted).toBe(true);
      expect(result.compactionLog).toBeDefined();
      expect(result.compactionLog!.length).toBeGreaterThan(0);
    });

    it('should emit budget warnings', async () => {
      const components: IContextComponent[] = [
        {
          name: 'test',
          content: 'x'.repeat(2800), // 700 tokens - puts us at warning threshold with 15% reserve
          priority: 0,
          compactable: false,
        },
      ];

      provider.setComponents(components);

      const warningHandler = vi.fn();
      contextManager.on('budget_warning', warningHandler);

      await contextManager.prepare();

      expect(warningHandler).toHaveBeenCalled();
    });

    it('should emit compaction events', async () => {
      const components: IContextComponent[] = [
        {
          name: 'test',
          content: 'x'.repeat(3200),
          priority: 10,
          compactable: true,
        },
      ];

      provider.setComponents(components);

      const compactingHandler = vi.fn();
      const compactedHandler = vi.fn();

      contextManager.on('compacting', compactingHandler);
      contextManager.on('compacted', compactedHandler);

      await contextManager.prepare();

      expect(compactingHandler).toHaveBeenCalled();
      expect(compactedHandler).toHaveBeenCalled();
    });
  });

  describe('getCurrentBudget()', () => {
    it('should return null before first prepare', () => {
      const budget = contextManager.getCurrentBudget();
      expect(budget).toBeNull();
    });

    it('should return budget after prepare', async () => {
      const components: IContextComponent[] = [
        {
          name: 'test',
          content: 'Hello',
          priority: 0,
          compactable: false,
        },
      ];

      provider.setComponents(components);
      await contextManager.prepare();

      const budget = contextManager.getCurrentBudget();
      expect(budget).not.toBeNull();
      expect(budget!.total).toBe(1000);
    });
  });

  describe('setStrategy()', () => {
    it('should switch strategy', () => {
      const initialStrategy = contextManager.getStrategy();
      expect(initialStrategy.name).toBe('proactive');

      contextManager.setStrategy('aggressive');

      const newStrategy = contextManager.getStrategy();
      expect(newStrategy.name).toBe('aggressive');
    });

    it('should emit strategy_switched event', () => {
      const handler = vi.fn();
      contextManager.on('strategy_switched', handler);

      contextManager.setStrategy('lazy');

      expect(handler).toHaveBeenCalledWith({
        from: 'proactive',
        to: 'lazy',
        reason: 'manual',
      });
    });
  });

  describe('addCompactor()', () => {
    it('should add compactor', () => {
      const initialCompactors = contextManager.getCompactors();
      const initialLength = initialCompactors.length;

      contextManager.addCompactor(new MockCompactor());

      const newCompactors = contextManager.getCompactors();
      expect(newCompactors.length).toBe(initialLength + 1);
    });

    it('should sort compactors by priority', () => {
      class HighPriorityCompactor extends MockCompactor {
        readonly priority = 1;
      }

      contextManager.addCompactor(new HighPriorityCompactor());

      const compactors = contextManager.getCompactors();
      expect(compactors[0].priority).toBeLessThanOrEqual(compactors[1].priority);
    });
  });

  describe('getConfig()', () => {
    it('should return configuration', () => {
      const config = contextManager.getConfig();

      expect(config.maxContextTokens).toBe(1000);
      expect(config.compactionThreshold).toBe(0.75);
      expect(config.hardLimit).toBe(0.9);
    });
  });

  describe('updateConfig()', () => {
    it('should update configuration', () => {
      contextManager.updateConfig({
        compactionThreshold: 0.6,
      });

      const config = contextManager.getConfig();
      expect(config.compactionThreshold).toBe(0.6);
    });
  });

  describe('getStrategyMetrics()', () => {
    it('should return strategy metrics', () => {
      const metrics = contextManager.getStrategyMetrics();
      expect(metrics).toBeDefined();
    });
  });
});
