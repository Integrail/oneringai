/**
 * Context Compactor Tests
 */

import { describe, it, expect } from 'vitest';
import { TruncateCompactor } from '@/infrastructure/context/compactors/TruncateCompactor.js';
import { ApproximateTokenEstimator } from '@/infrastructure/context/estimators/ApproximateEstimator.js';
import type { IContextComponent } from '@/core/context/types.js';

describe('TruncateCompactor', () => {
  const estimator = new ApproximateTokenEstimator();
  const compactor = new TruncateCompactor(estimator);

  it('should have correct name and priority', () => {
    expect(compactor.name).toBe('truncate');
    expect(compactor.priority).toBe(10);
  });

  describe('canCompact()', () => {
    it('should compact components with truncate strategy', () => {
      const component: IContextComponent = {
        name: 'test',
        content: 'test content',
        priority: 5,
        compactable: true,
        metadata: { strategy: 'truncate' },
      };

      expect(compactor.canCompact(component)).toBe(true);
    });

    it('should compact components with truncatable flag', () => {
      const component: IContextComponent = {
        name: 'test',
        content: 'test content',
        priority: 5,
        compactable: true,
        metadata: { truncatable: true },
      };

      expect(compactor.canCompact(component)).toBe(true);
    });

    it('should not compact non-compactable components', () => {
      const component: IContextComponent = {
        name: 'test',
        content: 'test content',
        priority: 5,
        compactable: false,
      };

      expect(compactor.canCompact(component)).toBe(false);
    });

    it('should not compact without truncate metadata', () => {
      const component: IContextComponent = {
        name: 'test',
        content: 'test content',
        priority: 5,
        compactable: true,
        metadata: { strategy: 'summarize' },
      };

      expect(compactor.canCompact(component)).toBe(false);
    });
  });

  describe('compact() - string content', () => {
    it('should truncate long strings', async () => {
      const component: IContextComponent = {
        name: 'test',
        content: 'x'.repeat(1000), // 250 tokens
        priority: 5,
        compactable: true,
        metadata: { strategy: 'truncate' },
      };

      const compacted = await compactor.compact(component, 50); // Target 50 tokens

      expect(typeof compacted.content).toBe('string');
      expect((compacted.content as string).length).toBeLessThan(1000);
      expect((compacted.content as string)).toContain('[truncated...]');
      expect(compacted.metadata?.truncated).toBe(true);
    });

    it('should not truncate short strings', async () => {
      const component: IContextComponent = {
        name: 'test',
        content: 'Hello world', // ~3 tokens
        priority: 5,
        compactable: true,
        metadata: { strategy: 'truncate' },
      };

      const compacted = await compactor.compact(component, 50);

      expect(compacted.content).toBe('Hello world');
      expect(compacted.metadata?.truncated).toBeUndefined();
    });

    it('should preserve truncation metadata', async () => {
      const component: IContextComponent = {
        name: 'test',
        content: 'x'.repeat(1000),
        priority: 5,
        compactable: true,
        metadata: { strategy: 'truncate', custom: 'value' },
      };

      const compacted = await compactor.compact(component, 50);

      expect(compacted.metadata?.truncated).toBe(true);
      expect(compacted.metadata?.originalLength).toBe(1000);
      expect(compacted.metadata?.custom).toBe('value');
    });
  });

  describe('compact() - array content', () => {
    it('should truncate arrays keeping most recent items', async () => {
      const messages = Array(20)
        .fill(null)
        .map((_, i) => ({ id: i, content: 'x'.repeat(100) })); // ~25 tokens each

      const component: IContextComponent = {
        name: 'history',
        content: messages,
        priority: 5,
        compactable: true,
        metadata: { strategy: 'truncate' },
      };

      const compacted = await compactor.compact(component, 100); // Target 100 tokens (~4 messages)

      expect(Array.isArray(compacted.content)).toBe(true);
      const compactedArray = compacted.content as any[];
      expect(compactedArray.length).toBeLessThan(20);

      // Should keep most recent items
      const lastItem = compactedArray[compactedArray.length - 1];
      expect(lastItem.id).toBe(19);

      expect(compacted.metadata?.truncated).toBe(true);
      expect(compacted.metadata?.originalLength).toBe(20);
    });

    it('should not truncate small arrays', async () => {
      const messages = [{ id: 1 }, { id: 2 }];

      const component: IContextComponent = {
        name: 'history',
        content: messages,
        priority: 5,
        compactable: true,
        metadata: { strategy: 'truncate' },
      };

      const compacted = await compactor.compact(component, 1000);

      expect(compacted.content).toEqual(messages);
      expect(compacted.metadata?.truncated).toBeUndefined();
    });
  });

  describe('estimateSavings()', () => {
    it('should estimate potential savings', () => {
      const component: IContextComponent = {
        name: 'test',
        content: 'x'.repeat(400), // 100 tokens
        priority: 5,
        compactable: true,
      };

      const savings = compactor.estimateSavings(component);
      expect(savings).toBeGreaterThan(0);
      expect(savings).toBeLessThanOrEqual(100);
    });
  });
});

describe('ApproximateTokenEstimator', () => {
  const estimator = new ApproximateTokenEstimator();

  describe('estimateTokens()', () => {
    it('should estimate tokens for text', () => {
      const text = 'Hello, world!'; // 13 chars
      const tokens = estimator.estimateTokens(text);
      expect(tokens).toBe(4); // ceil(13/4)
    });

    it('should return 0 for empty string', () => {
      expect(estimator.estimateTokens('')).toBe(0);
    });

    it('should handle long text', () => {
      const text = 'a'.repeat(1000);
      const tokens = estimator.estimateTokens(text);
      expect(tokens).toBe(250); // 1000/4
    });
  });

  describe('estimateDataTokens()', () => {
    it('should estimate tokens for objects', () => {
      const obj = { name: 'John', age: 30 };
      const tokens = estimator.estimateDataTokens(obj);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should estimate tokens for arrays', () => {
      const arr = [1, 2, 3, 4, 5];
      const tokens = estimator.estimateDataTokens(arr);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle null', () => {
      const tokens = estimator.estimateDataTokens(null);
      expect(tokens).toBe(1);
    });

    it('should handle undefined', () => {
      const tokens = estimator.estimateDataTokens(undefined);
      expect(tokens).toBe(1);
    });
  });
});
