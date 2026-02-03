/**
 * Context Tools Unit Tests
 * Tests context inspection tools for TaskAgent
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createContextTools,
  createContextStatsTool,
  contextStatsDefinition,
} from '@/capabilities/taskAgent/contextTools.js';
import type { ToolContext } from '@/domain/interfaces/IToolContext.js';

describe('Context Tools', () => {
  describe('createContextTools', () => {
    it('should create two context tools by default (context_stats and context_compact)', () => {
      const tools = createContextTools();

      expect(tools).toHaveLength(2);
      expect(tools[0].definition.function.name).toBe('context_stats');
      expect(tools[1].definition.function.name).toBe('context_compact');
    });

    it('should create only context_stats when includeCompact is false', () => {
      const tools = createContextTools(false);

      expect(tools).toHaveLength(1);
      expect(tools[0].definition.function.name).toBe('context_stats');
    });

    it('should mark context_stats as safe (idempotent)', () => {
      const tools = createContextTools();
      const contextStats = tools.find(t => t.definition.function.name === 'context_stats');

      expect(contextStats?.idempotency?.safe).toBe(true);
    });

    it('should mark context_compact as NOT safe (modifies context)', () => {
      const tools = createContextTools();
      const contextCompact = tools.find(t => t.definition.function.name === 'context_compact');

      expect(contextCompact?.idempotency?.safe).toBe(false);
    });
  });

  describe('context_stats', () => {
    const contextStatsTool = createContextStatsTool();

    it('should return error when agentContext not available', async () => {
      const result = await contextStatsTool.execute({}, undefined);

      expect(result).toEqual({
        error: 'AgentContext not available',
        message: 'Tool context missing agentContext',
      });
    });

    it('should return error when context is empty object', async () => {
      const result = await contextStatsTool.execute({}, {} as ToolContext);

      expect(result).toEqual({
        error: 'AgentContext not available',
        message: 'Tool context missing agentContext',
      });
    });

    it('should return message when no budget available', async () => {
      const mockContext: ToolContext = {
        agentId: 'test',
        agentContext: {
          getLastBudget: vi.fn().mockReturnValue(null),
        } as any,
      };

      const result = await contextStatsTool.execute({}, mockContext);

      // When no budget is available, it returns the status inside budget key
      expect(result.budget).toEqual({
        status: 'no_budget_data',
        message: 'No context budget calculated yet. Run prepare() first.',
      });
    });

    it('should return budget info by default', async () => {
      const mockContext: ToolContext = {
        agentId: 'test',
        agentContext: {
          getLastBudget: vi.fn().mockReturnValue({
            total: 128000,
            reserved: 10000,
            used: 50000,
            available: 68000,
            utilizationPercent: 39.06,
            status: 'ok',
            breakdown: {},
          }),
        } as any,
      };

      const result = await contextStatsTool.execute({}, mockContext);

      expect(result.budget).toEqual({
        total_tokens: 128000,
        reserved_tokens: 10000,
        used_tokens: 50000,
        available_tokens: 68000,
        utilization_percent: 39.1,
        status: 'ok',
        warning: null,
      });
    });

    it('should return warning message with warning status', async () => {
      const mockContext: ToolContext = {
        agentId: 'test',
        agentContext: {
          getLastBudget: vi.fn().mockReturnValue({
            total: 128000,
            reserved: 10000,
            used: 100000,
            available: 18000,
            utilizationPercent: 78.13,
            status: 'warning',
            breakdown: {},
          }),
        } as any,
      };

      const result = await contextStatsTool.execute({}, mockContext);

      expect(result.budget.status).toBe('warning');
      expect(result.budget.warning).toBe('Context approaching limit - automatic compaction may trigger');
      expect(result.budget.utilization_percent).toBeGreaterThan(70);
    });

    it('should return critical warning with critical status', async () => {
      const mockContext: ToolContext = {
        agentId: 'test',
        agentContext: {
          getLastBudget: vi.fn().mockReturnValue({
            total: 128000,
            reserved: 10000,
            used: 115000,
            available: 3000,
            utilizationPercent: 89.84,
            status: 'critical',
            breakdown: {},
          }),
        } as any,
      };

      const result = await contextStatsTool.execute({}, mockContext);

      expect(result.budget.status).toBe('critical');
      expect(result.budget.warning).toBe('Context at critical level - compaction will trigger');
    });

    it('should include breakdown when requested', async () => {
      const mockContext: ToolContext = {
        agentId: 'test',
        agentContext: {
          getLastBudget: vi.fn().mockReturnValue({
            total: 128000,
            used: 50000,
            available: 78000,
            reserved: 10000,
            utilizationPercent: 39.06,
            status: 'ok',
            breakdown: {
              systemPrompt: 10000,
              instructions: 5000,
              memoryIndex: 15000,
              conversationHistory: 18000,
              currentInput: 2000,
            },
          }),
        } as any,
      };

      const result = await contextStatsTool.execute({ sections: ['breakdown'] }, mockContext);

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.total_used).toBe(50000);
      expect(result.breakdown.components).toHaveLength(5);

      const systemPrompt = result.breakdown.components.find((c: any) => c.name === 'systemPrompt');
      expect(systemPrompt.tokens).toBe(10000);
      expect(systemPrompt.percent).toBe(20.0);
    });

    it('should include memory stats when requested and available', async () => {
      // memory is checked on context, not agentContext
      const mockContext: ToolContext = {
        agentId: 'test',
        agentContext: {
          getLastBudget: vi.fn().mockReturnValue({
            total: 128000,
            used: 50000,
            available: 78000,
            reserved: 10000,
            utilizationPercent: 39.06,
            status: 'ok',
            breakdown: {},
          }),
        } as any,
        memory: {
          list: vi.fn().mockResolvedValue([
            { key: 'raw.user_id', description: 'Current user ID', effectivePriority: 'normal' },
            { key: 'findings.token', description: 'Authentication token', effectivePriority: 'high' },
          ]),
        } as any,
      };

      const result = await contextStatsTool.execute({ sections: ['memory'] }, mockContext);

      expect(result.memory).toBeDefined();
      expect(result.memory.total_entries).toBe(2);
      expect(result.memory.entries).toHaveLength(2);
      expect(result.memory.by_tier).toBeDefined();
    });

    it('should indicate memory not enabled when disabled', async () => {
      const mockContext: ToolContext = {
        agentId: 'test',
        agentContext: {
          getLastBudget: vi.fn().mockReturnValue({
            total: 128000,
            used: 50000,
            available: 78000,
            reserved: 10000,
            utilizationPercent: 39.06,
            status: 'ok',
            breakdown: {},
          }),
        } as any,
        // No memory on context
      };

      const result = await contextStatsTool.execute({ sections: ['memory'] }, mockContext);

      expect(result.memory).toEqual({
        status: 'feature_disabled',
        message: 'Memory feature is not enabled.',
      });
    });

    it('should include cache stats when requested and available', async () => {
      // idempotencyCache is checked on context, not agentContext
      const mockContext: ToolContext = {
        agentId: 'test',
        agentContext: {
          getLastBudget: vi.fn().mockReturnValue({
            total: 128000,
            used: 50000,
            available: 78000,
            reserved: 10000,
            utilizationPercent: 39.06,
            status: 'ok',
            breakdown: {},
          }),
        } as any,
        idempotencyCache: {
          getStats: vi.fn().mockReturnValue({
            entries: 50,
            hits: 35,
            misses: 15,
            hitRate: 0.7,
          }),
        } as any,
      };

      const result = await contextStatsTool.execute({ sections: ['cache'] }, mockContext);

      expect(result.cache).toBeDefined();
      expect(result.cache.entries).toBe(50);
      expect(result.cache.hit_rate_percent).toBe(70);
      expect(result.cache.effectiveness).toBe('high');
    });

    it('should indicate cache not enabled when disabled', async () => {
      const mockContext: ToolContext = {
        agentId: 'test',
        agentContext: {
          getLastBudget: vi.fn().mockReturnValue({
            total: 128000,
            used: 50000,
            available: 78000,
            reserved: 10000,
            utilizationPercent: 39.06,
            status: 'ok',
            breakdown: {},
          }),
        } as any,
        // No idempotencyCache on context
      };

      const result = await contextStatsTool.execute({ sections: ['cache'] }, mockContext);

      expect(result.cache).toEqual({
        status: 'feature_disabled',
        message: 'Cache is not enabled (requires memory feature).',
      });
    });

    it('should include all sections when sections=all', async () => {
      const mockContext: ToolContext = {
        agentId: 'test',
        agentContext: {
          getLastBudget: vi.fn().mockReturnValue({
            total: 128000,
            used: 50000,
            available: 78000,
            reserved: 10000,
            utilizationPercent: 39.06,
            status: 'ok',
            breakdown: {
              systemPrompt: 10000,
            },
          }),
        } as any,
        memory: {
          list: vi.fn().mockResolvedValue([{ key: 'test', description: 'test', effectivePriority: 'normal' }]),
        } as any,
        idempotencyCache: {
          getStats: vi.fn().mockReturnValue({
            entries: 10,
            hits: 5,
            misses: 5,
            hitRate: 0.5,
          }),
        } as any,
      };

      const result = await contextStatsTool.execute({ sections: ['all'] }, mockContext);

      expect(result.budget).toBeDefined();
      expect(result.breakdown).toBeDefined();
      expect(result.memory).toBeDefined();
      expect(result.cache).toBeDefined();
    });

    it('should round utilization percent to 1 decimal place', async () => {
      const mockContext: ToolContext = {
        agentId: 'test',
        agentContext: {
          getLastBudget: vi.fn().mockReturnValue({
            total: 100000,
            reserved: 5000,
            used: 45678,
            available: 49322,
            utilizationPercent: 48.082105263157894,
            status: 'ok',
            breakdown: {},
          }),
        } as any,
      };

      const result = await contextStatsTool.execute({}, mockContext);

      expect(result.budget.utilization_percent).toBe(48.1);
    });

    it('should classify cache effectiveness correctly', async () => {
      // High effectiveness (>50%)
      let mockContext: ToolContext = {
        agentId: 'test',
        agentContext: {
          getLastBudget: vi.fn().mockReturnValue({
            total: 128000, used: 50000, available: 78000, reserved: 10000,
            utilizationPercent: 39.06, status: 'ok', breakdown: {},
          }),
        } as any,
        idempotencyCache: { getStats: vi.fn().mockReturnValue({ entries: 100, hits: 70, misses: 30, hitRate: 0.7 }) } as any,
      };
      let result = await contextStatsTool.execute({ sections: ['cache'] }, mockContext);
      expect(result.cache.effectiveness).toBe('high');

      // Medium effectiveness (20-50%)
      mockContext = {
        ...mockContext,
        idempotencyCache: { getStats: vi.fn().mockReturnValue({ entries: 100, hits: 30, misses: 70, hitRate: 0.3 }) } as any,
      };
      result = await contextStatsTool.execute({ sections: ['cache'] }, mockContext);
      expect(result.cache.effectiveness).toBe('medium');

      // Low effectiveness (>0 but <20%)
      mockContext = {
        ...mockContext,
        idempotencyCache: { getStats: vi.fn().mockReturnValue({ entries: 100, hits: 10, misses: 90, hitRate: 0.1 }) } as any,
      };
      result = await contextStatsTool.execute({ sections: ['cache'] }, mockContext);
      expect(result.cache.effectiveness).toBe('low');

      // None effectiveness (0%)
      mockContext = {
        ...mockContext,
        idempotencyCache: { getStats: vi.fn().mockReturnValue({ entries: 50, hits: 0, misses: 50, hitRate: 0 }) } as any,
      };
      result = await contextStatsTool.execute({ sections: ['cache'] }, mockContext);
      expect(result.cache.effectiveness).toBe('none');
    });
  });

  describe('contextStatsDefinition', () => {
    it('should have correct name', () => {
      expect(contextStatsDefinition.function.name).toBe('context_stats');
    });

    it('should have description', () => {
      expect(contextStatsDefinition.function.description).toBeDefined();
      expect(contextStatsDefinition.function.description!.length).toBeGreaterThan(10);
    });

    it('should have sections parameter', () => {
      const props = contextStatsDefinition.function.parameters?.properties;
      expect(props?.sections).toBeDefined();
      expect(props?.sections?.type).toBe('array');
    });

    it('should have function type', () => {
      expect(contextStatsDefinition.type).toBe('function');
    });

    it('should have no required parameters', () => {
      expect(contextStatsDefinition.function.parameters?.required).toEqual([]);
    });
  });

  describe('Tool definitions', () => {
    const tools = createContextTools();

    it('should have correct tool name', () => {
      expect(tools[0].definition.function.name).toBe('context_stats');
    });

    it('should have description', () => {
      tools.forEach((tool) => {
        expect(tool.definition.function.description).toBeTruthy();
        expect(tool.definition.function.description.length).toBeGreaterThan(10);
      });
    });

    it('should have no required parameters', () => {
      tools.forEach((tool) => {
        expect(tool.definition.function.parameters.required).toEqual([]);
      });
    });

    it('should have function type', () => {
      tools.forEach((tool) => {
        expect(tool.definition.type).toBe('function');
      });
    });

    it('should have object parameters type', () => {
      tools.forEach((tool) => {
        expect(tool.definition.function.parameters.type).toBe('object');
      });
    });
  });
});
