/**
 * Context Tools Unit Tests
 * Tests context inspection tools for TaskAgent
 */

import { describe, it, expect, vi } from 'vitest';
import { createContextTools } from '@/capabilities/taskAgent/contextTools.js';
import type { ToolContext } from '@/domain/interfaces/IToolContext.js';

describe('Context Tools', () => {
  describe('createContextTools', () => {
    it('should create all four context tools', () => {
      const tools = createContextTools();

      expect(tools).toHaveLength(4);
      expect(tools[0].definition.function.name).toBe('context_inspect');
      expect(tools[1].definition.function.name).toBe('context_breakdown');
      expect(tools[2].definition.function.name).toBe('cache_stats');
      expect(tools[3].definition.function.name).toBe('memory_stats');
    });

    it('should mark all tools as safe (idempotent)', () => {
      const tools = createContextTools();

      tools.forEach((tool) => {
        expect(tool.idempotency?.safe).toBe(true);
      });
    });
  });

  describe('context_inspect', () => {
    const [contextInspect] = createContextTools();

    it('should return error when context manager not available', async () => {
      const result = await contextInspect.execute({}, undefined);

      expect(result).toEqual({
        error: 'Context manager not available',
        message: 'This tool is only available within TaskAgent execution',
      });
    });

    it('should return error when context is empty object', async () => {
      const result = await contextInspect.execute({}, {} as ToolContext);

      expect(result).toEqual({
        error: 'Context manager not available',
        message: 'This tool is only available within TaskAgent execution',
      });
    });

    it('should return error when no budget available', async () => {
      const mockContext: ToolContext = {
        contextManager: {
          getCurrentBudget: vi.fn().mockReturnValue(null),
        } as any,
      };

      const result = await contextInspect.execute({}, mockContext);

      expect(result).toEqual({
        error: 'No context budget available',
        message: 'Context has not been prepared yet',
      });
    });

    it('should return context budget with ok status', async () => {
      const mockContext: ToolContext = {
        contextManager: {
          getCurrentBudget: vi.fn().mockReturnValue({
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

      const result = await contextInspect.execute({}, mockContext);

      expect(result).toEqual({
        total_tokens: 128000,
        reserved_tokens: 10000,
        used_tokens: 50000,
        available_tokens: 68000,
        utilization_percent: 39.1, // Rounded to 1 decimal
        status: 'ok',
        warning: null,
      });
    });

    it('should return warning message with warning status', async () => {
      const mockContext: ToolContext = {
        contextManager: {
          getCurrentBudget: vi.fn().mockReturnValue({
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

      const result = await contextInspect.execute({}, mockContext);

      expect(result.status).toBe('warning');
      expect(result.warning).toBe('Context approaching limit - automatic compaction may trigger');
      expect(result.utilization_percent).toBeGreaterThan(70);
    });

    it('should return critical warning with critical status', async () => {
      const mockContext: ToolContext = {
        contextManager: {
          getCurrentBudget: vi.fn().mockReturnValue({
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

      const result = await contextInspect.execute({}, mockContext);

      expect(result.status).toBe('critical');
      expect(result.warning).toBe('Context at critical level - compaction will trigger');
    });

    it('should round utilization percent to 1 decimal place', async () => {
      const mockContext: ToolContext = {
        contextManager: {
          getCurrentBudget: vi.fn().mockReturnValue({
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

      const result = await contextInspect.execute({}, mockContext);

      expect(result.utilization_percent).toBe(48.1);
    });
  });

  describe('context_breakdown', () => {
    const [, contextBreakdown] = createContextTools();

    it('should return error when context manager not available', async () => {
      const result = await contextBreakdown.execute({}, undefined);

      expect(result).toEqual({
        error: 'Context manager not available',
        message: 'This tool is only available within TaskAgent execution',
      });
    });

    it('should return error when no budget available', async () => {
      const mockContext: ToolContext = {
        contextManager: {
          getCurrentBudget: vi.fn().mockReturnValue(null),
        } as any,
      };

      const result = await contextBreakdown.execute({}, mockContext);

      expect(result).toEqual({
        error: 'No context budget available',
        message: 'Context has not been prepared yet',
      });
    });

    it('should return detailed breakdown with percentages', async () => {
      const mockContext: ToolContext = {
        contextManager: {
          getCurrentBudget: vi.fn().mockReturnValue({
            total: 128000,
            used: 50000,
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

      const result = await contextBreakdown.execute({}, mockContext);

      expect(result.total_used).toBe(50000);
      expect(result.breakdown).toEqual({
        systemPrompt: 10000,
        instructions: 5000,
        memoryIndex: 15000,
        conversationHistory: 18000,
        currentInput: 2000,
      });
      expect(result.components).toHaveLength(5);

      // Check system prompt component
      const systemPrompt = result.components.find((c: any) => c.name === 'system_prompt');
      expect(systemPrompt.tokens).toBe(10000);
      expect(systemPrompt.percent).toBe(20.0); // 10000/50000 = 20%

      // Check conversation history component
      const history = result.components.find((c: any) => c.name === 'conversation_history');
      expect(history.tokens).toBe(18000);
      expect(history.percent).toBe(36.0); // 18000/50000 = 36%
    });

    it('should handle zero values in breakdown', async () => {
      const mockContext: ToolContext = {
        contextManager: {
          getCurrentBudget: vi.fn().mockReturnValue({
            total: 128000,
            used: 10000,
            breakdown: {
              systemPrompt: 10000,
              instructions: 0,
              memoryIndex: 0,
              conversationHistory: 0,
              currentInput: 0,
            },
          }),
        } as any,
      };

      const result = await contextBreakdown.execute({}, mockContext);

      const instructions = result.components.find((c: any) => c.name === 'instructions');
      expect(instructions.tokens).toBe(0);
      expect(instructions.percent).toBe(0);
    });

    it('should calculate percentages correctly with rounding', async () => {
      const mockContext: ToolContext = {
        contextManager: {
          getCurrentBudget: vi.fn().mockReturnValue({
            total: 100000,
            used: 30000,
            breakdown: {
              systemPrompt: 10001, // Should be 33.337% -> 33.3%
              instructions: 10001,
              memoryIndex: 5000,
              conversationHistory: 3000,
              currentInput: 1998,
            },
          }),
        } as any,
      };

      const result = await contextBreakdown.execute({}, mockContext);

      const systemPrompt = result.components.find((c: any) => c.name === 'system_prompt');
      expect(systemPrompt.percent).toBe(33.3);
    });
  });

  describe('cache_stats', () => {
    const [, , cacheStats] = createContextTools();

    it('should return error when cache not available', async () => {
      const result = await cacheStats.execute({}, undefined);

      expect(result).toEqual({
        error: 'Idempotency cache not available',
        message: 'This tool is only available within TaskAgent execution',
      });
    });

    it('should return cache statistics with high effectiveness', async () => {
      const mockContext: ToolContext = {
        idempotencyCache: {
          getStats: vi.fn().mockReturnValue({
            entries: 50,
            hits: 35,
            misses: 15,
            hitRate: 0.7,
          }),
        } as any,
      };

      const result = await cacheStats.execute({}, mockContext);

      expect(result).toEqual({
        entries: 50,
        hits: 35,
        misses: 15,
        hit_rate: 70.0,
        hit_rate_percent: '70%',
        effectiveness: 'high',
      });
    });

    it('should classify medium effectiveness (20-50% hit rate)', async () => {
      const mockContext: ToolContext = {
        idempotencyCache: {
          getStats: vi.fn().mockReturnValue({
            entries: 100,
            hits: 30,
            misses: 70,
            hitRate: 0.3,
          }),
        } as any,
      };

      const result = await cacheStats.execute({}, mockContext);

      expect(result.effectiveness).toBe('medium');
      expect(result.hit_rate_percent).toBe('30%');
    });

    it('should classify low effectiveness (0-20% hit rate)', async () => {
      const mockContext: ToolContext = {
        idempotencyCache: {
          getStats: vi.fn().mockReturnValue({
            entries: 100,
            hits: 10,
            misses: 90,
            hitRate: 0.1,
          }),
        } as any,
      };

      const result = await cacheStats.execute({}, mockContext);

      expect(result.effectiveness).toBe('low');
      expect(result.hit_rate).toBe(10.0);
    });

    it('should classify none effectiveness (0% hit rate)', async () => {
      const mockContext: ToolContext = {
        idempotencyCache: {
          getStats: vi.fn().mockReturnValue({
            entries: 50,
            hits: 0,
            misses: 50,
            hitRate: 0,
          }),
        } as any,
      };

      const result = await cacheStats.execute({}, mockContext);

      expect(result.effectiveness).toBe('none');
      expect(result.hit_rate).toBe(0);
    });

    it('should handle perfect hit rate (100%)', async () => {
      const mockContext: ToolContext = {
        idempotencyCache: {
          getStats: vi.fn().mockReturnValue({
            entries: 25,
            hits: 25,
            misses: 0,
            hitRate: 1.0,
          }),
        } as any,
      };

      const result = await cacheStats.execute({}, mockContext);

      expect(result.hit_rate).toBe(100.0);
      expect(result.hit_rate_percent).toBe('100%');
      expect(result.effectiveness).toBe('high');
    });

    it('should round hit rate to 1 decimal place', async () => {
      const mockContext: ToolContext = {
        idempotencyCache: {
          getStats: vi.fn().mockReturnValue({
            entries: 77,
            hits: 48,
            misses: 29,
            hitRate: 0.6233766233766234,
          }),
        } as any,
      };

      const result = await cacheStats.execute({}, mockContext);

      expect(result.hit_rate).toBe(62.3);
      expect(result.hit_rate_percent).toBe('62%');
    });
  });

  describe('memory_stats', () => {
    const [, , , memoryStats] = createContextTools();

    it('should return error when memory not available', async () => {
      const result = await memoryStats.execute({}, undefined);

      expect(result).toEqual({
        error: 'Working memory not available',
        message: 'This tool is only available within TaskAgent execution',
      });
    });

    it('should return memory statistics with entries', async () => {
      const mockContext: ToolContext = {
        memory: {
          list: vi.fn().mockResolvedValue([
            { key: 'user_id', description: 'Current user ID' },
            { key: 'session_token', description: 'Authentication token' },
            { key: 'preferences', description: 'User preferences' },
          ]),
        } as any,
      };

      const result = await memoryStats.execute({}, mockContext);

      expect(result.entry_count).toBe(3);
      expect(result.entries_by_scope.total).toBe(3);
      expect(result.entries).toHaveLength(3);
      expect(result.entries[0]).toEqual({
        key: 'user_id',
        description: 'Current user ID',
      });
    });

    it('should handle empty memory', async () => {
      const mockContext: ToolContext = {
        memory: {
          list: vi.fn().mockResolvedValue([]),
        } as any,
      };

      const result = await memoryStats.execute({}, mockContext);

      expect(result.entry_count).toBe(0);
      expect(result.entries).toEqual([]);
    });

    it('should handle memory entries without descriptions', async () => {
      const mockContext: ToolContext = {
        memory: {
          list: vi.fn().mockResolvedValue([
            { key: 'simple_key' },
            { key: 'another_key', description: 'Has description' },
          ]),
        } as any,
      };

      const result = await memoryStats.execute({}, mockContext);

      expect(result.entry_count).toBe(2);
      expect(result.entries[0].key).toBe('simple_key');
      expect(result.entries[0].description).toBeUndefined();
      expect(result.entries[1].description).toBe('Has description');
    });

    it('should handle large number of memory entries', async () => {
      const largeIndex = Array.from({ length: 1000 }, (_, i) => ({
        key: `key_${i}`,
        description: `Description ${i}`,
      }));

      const mockContext: ToolContext = {
        memory: {
          list: vi.fn().mockResolvedValue(largeIndex),
        } as any,
      };

      const result = await memoryStats.execute({}, mockContext);

      expect(result.entry_count).toBe(1000);
      expect(result.entries).toHaveLength(1000);
    });
  });

  describe('Tool definitions', () => {
    const tools = createContextTools();

    it('should have correct tool names', () => {
      expect(tools[0].definition.function.name).toBe('context_inspect');
      expect(tools[1].definition.function.name).toBe('context_breakdown');
      expect(tools[2].definition.function.name).toBe('cache_stats');
      expect(tools[3].definition.function.name).toBe('memory_stats');
    });

    it('should have descriptions', () => {
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
