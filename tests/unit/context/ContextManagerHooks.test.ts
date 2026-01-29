/**
 * ContextManager Hooks Tests
 * Tests for beforeCompaction hook functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextManager } from '@/core/context/ContextManager.js';
import type { IContextProvider, IContextComponent, ContextBudget, ITokenEstimator, ContextManagerHooks } from '@/core/context/types.js';
import { TruncateCompactor } from '@/infrastructure/context/compactors/TruncateCompactor.js';
import { ApproximateTokenEstimator } from '@/infrastructure/context/estimators/ApproximateEstimator.js';

describe('ContextManager Hooks', () => {
  let mockProvider: IContextProvider;
  let estimator: ITokenEstimator;
  let contextManager: ContextManager;

  const createMockProvider = (components: IContextComponent[]): IContextProvider => ({
    getComponents: vi.fn().mockResolvedValue(components),
    applyCompactedComponents: vi.fn().mockResolvedValue(undefined),
    getMaxContextSize: vi.fn().mockReturnValue(1000),
  });

  beforeEach(() => {
    estimator = new ApproximateTokenEstimator();
  });

  describe('setHooks', () => {
    it('should accept hooks configuration', () => {
      const components: IContextComponent[] = [
        { name: 'system', content: 'System prompt', priority: 0, compactable: false },
      ];
      mockProvider = createMockProvider(components);

      contextManager = new ContextManager(
        mockProvider,
        { maxContextTokens: 1000 },
        [new TruncateCompactor(estimator)],
        estimator
      );

      const hooks: ContextManagerHooks = {
        beforeCompaction: vi.fn(),
      };

      // Should not throw
      expect(() => contextManager.setHooks(hooks)).not.toThrow();
    });
  });

  describe('setAgentId', () => {
    it('should set agent ID for hook context', () => {
      const components: IContextComponent[] = [
        { name: 'system', content: 'System prompt', priority: 0, compactable: false },
      ];
      mockProvider = createMockProvider(components);

      contextManager = new ContextManager(
        mockProvider,
        { maxContextTokens: 1000 },
        [new TruncateCompactor(estimator)],
        estimator
      );

      // Should not throw
      expect(() => contextManager.setAgentId('agent-123')).not.toThrow();
    });
  });

  describe('beforeCompaction hook', () => {
    it('should call beforeCompaction hook when compaction is needed', async () => {
      // Create large content that exceeds the context limit
      const largeContent = 'A'.repeat(5000); // ~1250 tokens with 4 chars/token

      const components: IContextComponent[] = [
        { name: 'system', content: 'System prompt', priority: 0, compactable: false },
        { name: 'history', content: largeContent, priority: 6, compactable: true, metadata: { strategy: 'truncate' } },
      ];

      mockProvider = createMockProvider(components);

      const beforeCompactionHook = vi.fn();

      contextManager = new ContextManager(
        mockProvider,
        { maxContextTokens: 500 }, // Small limit to trigger compaction
        [new TruncateCompactor(estimator)],
        estimator
      );

      contextManager.setHooks({ beforeCompaction: beforeCompactionHook });
      contextManager.setAgentId('test-agent');

      await contextManager.prepare();

      expect(beforeCompactionHook).toHaveBeenCalled();
    });

    it('should pass correct context to beforeCompaction hook', async () => {
      const largeContent = 'A'.repeat(5000);

      const components: IContextComponent[] = [
        { name: 'system', content: 'System prompt', priority: 0, compactable: false },
        { name: 'history', content: largeContent, priority: 6, compactable: true, metadata: { strategy: 'truncate' } },
      ];

      mockProvider = createMockProvider(components);

      const beforeCompactionHook = vi.fn();

      contextManager = new ContextManager(
        mockProvider,
        { maxContextTokens: 500 },
        [new TruncateCompactor(estimator)],
        estimator
      );

      contextManager.setHooks({ beforeCompaction: beforeCompactionHook });
      contextManager.setAgentId('test-agent');

      await contextManager.prepare();

      expect(beforeCompactionHook).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent',
          currentBudget: expect.objectContaining({
            total: expect.any(Number),
            used: expect.any(Number),
          }),
          strategy: expect.any(String),
          components: expect.any(Array),
          estimatedTokensToFree: expect.any(Number),
        })
      );
    });

    it('should not call beforeCompaction when no compaction needed', async () => {
      const smallContent = 'Small content';

      const components: IContextComponent[] = [
        { name: 'system', content: smallContent, priority: 0, compactable: false },
      ];

      mockProvider = createMockProvider(components);

      const beforeCompactionHook = vi.fn();

      contextManager = new ContextManager(
        mockProvider,
        { maxContextTokens: 10000 }, // Large limit, no compaction needed
        [new TruncateCompactor(estimator)],
        estimator
      );

      contextManager.setHooks({ beforeCompaction: beforeCompactionHook });
      contextManager.setAgentId('test-agent');

      await contextManager.prepare();

      expect(beforeCompactionHook).not.toHaveBeenCalled();
    });

    it('should include components array in hook context', async () => {
      const largeContent = 'A'.repeat(5000);

      const components: IContextComponent[] = [
        { name: 'system', content: 'System', priority: 0, compactable: false },
        { name: 'history', content: largeContent, priority: 6, compactable: true, metadata: { strategy: 'truncate' } },
        { name: 'memory', content: 'Memory data', priority: 8, compactable: true, metadata: { strategy: 'evict' } },
      ];

      mockProvider = createMockProvider(components);

      let capturedContext: any = null;
      const beforeCompactionHook = vi.fn((ctx) => {
        capturedContext = ctx;
      });

      contextManager = new ContextManager(
        mockProvider,
        { maxContextTokens: 500 },
        [new TruncateCompactor(estimator)],
        estimator
      );

      contextManager.setHooks({ beforeCompaction: beforeCompactionHook });
      contextManager.setAgentId('test-agent');

      await contextManager.prepare();

      expect(capturedContext.components).toHaveLength(3);
      expect(capturedContext.components.map((c: any) => c.name)).toContain('system');
      expect(capturedContext.components.map((c: any) => c.name)).toContain('history');
      expect(capturedContext.components.map((c: any) => c.name)).toContain('memory');
    });

    it('should handle async beforeCompaction hook', async () => {
      const largeContent = 'A'.repeat(5000);

      const components: IContextComponent[] = [
        { name: 'history', content: largeContent, priority: 6, compactable: true, metadata: { strategy: 'truncate' } },
      ];

      mockProvider = createMockProvider(components);

      let hookCalled = false;
      const asyncBeforeCompactionHook = vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 10));
        hookCalled = true;
      });

      contextManager = new ContextManager(
        mockProvider,
        { maxContextTokens: 500 },
        [new TruncateCompactor(estimator)],
        estimator
      );

      contextManager.setHooks({ beforeCompaction: asyncBeforeCompactionHook });

      await contextManager.prepare();

      expect(hookCalled).toBe(true);
    });

    it('should calculate estimatedTokensToFree correctly', async () => {
      const largeContent = 'A'.repeat(4000); // ~1000 tokens

      const components: IContextComponent[] = [
        { name: 'history', content: largeContent, priority: 6, compactable: true, metadata: { strategy: 'truncate' } },
      ];

      mockProvider = createMockProvider(components);

      let capturedContext: any = null;
      const beforeCompactionHook = vi.fn((ctx) => {
        capturedContext = ctx;
      });

      contextManager = new ContextManager(
        mockProvider,
        { maxContextTokens: 500 }, // Limit is 500, content is ~1000 tokens
        [new TruncateCompactor(estimator)],
        estimator
      );

      contextManager.setHooks({ beforeCompaction: beforeCompactionHook });

      await contextManager.prepare();

      // estimatedTokensToFree should be positive (need to free tokens)
      expect(capturedContext.estimatedTokensToFree).toBeGreaterThan(0);
    });

    it('should continue with compaction even if hook throws', async () => {
      const largeContent = 'A'.repeat(5000);

      const components: IContextComponent[] = [
        { name: 'history', content: largeContent, priority: 6, compactable: true, metadata: { strategy: 'truncate' } },
      ];

      mockProvider = createMockProvider(components);

      const errorHook = vi.fn().mockRejectedValue(new Error('Hook error'));

      contextManager = new ContextManager(
        mockProvider,
        { maxContextTokens: 500 },
        [new TruncateCompactor(estimator)],
        estimator
      );

      contextManager.setHooks({ beforeCompaction: errorHook });

      // Should not throw, compaction should continue
      const result = await contextManager.prepare();
      expect(result).toBeDefined();
    });
  });

  describe('Hook with strategy information', () => {
    it('should include strategy name in hook context', async () => {
      const largeContent = 'A'.repeat(5000);

      const components: IContextComponent[] = [
        { name: 'history', content: largeContent, priority: 6, compactable: true, metadata: { strategy: 'truncate' } },
      ];

      mockProvider = createMockProvider(components);

      let capturedStrategy: string | undefined;
      const beforeCompactionHook = vi.fn((ctx) => {
        capturedStrategy = ctx.strategy;
      });

      contextManager = new ContextManager(
        mockProvider,
        { maxContextTokens: 500, strategy: 'proactive' },
        [new TruncateCompactor(estimator)],
        estimator
      );

      contextManager.setHooks({ beforeCompaction: beforeCompactionHook });

      await contextManager.prepare();

      expect(capturedStrategy).toBe('proactive');
    });
  });
});
