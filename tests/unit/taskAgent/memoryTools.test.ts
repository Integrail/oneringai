/**
 * Memory Tools Tests
 * Tests for the built-in memory manipulation tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createMemoryTools,
  memoryStoreDefinition,
  memoryRetrieveDefinition,
  memoryDeleteDefinition,
  memoryListDefinition,
  memoryCleanupRawDefinition,
  memoryRetrieveBatchDefinition,
} from '@/capabilities/taskAgent/memoryTools.js';
import { ToolFunction } from '@/domain/entities/Tool.js';
import { ToolContext, WorkingMemoryAccess } from '@/domain/interfaces/IToolContext.js';
import { ToolExecutionError } from '@/domain/errors/AIErrors.js';

describe('Memory Tools', () => {
  let mockMemory: WorkingMemoryAccess;
  let mockContext: ToolContext;
  let memoryStore: Map<string, { description: string; value: unknown }>;

  beforeEach(() => {
    memoryStore = new Map();

    mockMemory = {
      get: vi.fn(async (key: string) => {
        const entry = memoryStore.get(key);
        return entry?.value;
      }),
      set: vi.fn(async (key: string, description: string, value: unknown, options?: any) => {
        memoryStore.set(key, { description, value });
      }),
      delete: vi.fn(async (key: string) => {
        memoryStore.delete(key);
      }),
      has: vi.fn(async (key: string) => memoryStore.has(key)),
      list: vi.fn(async () =>
        Array.from(memoryStore.entries()).map(([key, { description }]) => ({
          key,
          description,
          effectivePriority: 'normal' as const,
          pinned: false,
        }))
      ),
    };

    mockContext = {
      agentId: 'test-agent',
      taskId: 'test-task',
      memory: mockMemory,
    };
  });

  describe('createMemoryTools', () => {
    it('should return array of tool functions', () => {
      const tools = createMemoryTools();

      expect(tools).toBeInstanceOf(Array);
      expect(tools.length).toBeGreaterThanOrEqual(3);
      expect(tools.every((t) => t.definition && t.execute)).toBe(true);
    });

    it('should include memory_store tool', () => {
      const tools = createMemoryTools();
      const storeTool = tools.find((t) => t.definition.function.name === 'memory_store');

      expect(storeTool).toBeDefined();
    });

    it('should include memory_retrieve tool', () => {
      const tools = createMemoryTools();
      const retrieveTool = tools.find((t) => t.definition.function.name === 'memory_retrieve');

      expect(retrieveTool).toBeDefined();
    });

    it('should include memory_delete tool', () => {
      const tools = createMemoryTools();
      const deleteTool = tools.find((t) => t.definition.function.name === 'memory_delete');

      expect(deleteTool).toBeDefined();
    });

    it('should include memory_list tool', () => {
      const tools = createMemoryTools();
      const listTool = tools.find((t) => t.definition.function.name === 'memory_list');

      expect(listTool).toBeDefined();
    });
  });

  describe('memory_store tool', () => {
    let storeTool: ToolFunction;

    beforeEach(() => {
      const tools = createMemoryTools();
      storeTool = tools.find((t) => t.definition.function.name === 'memory_store')!;
    });

    it('should have correct definition', () => {
      expect(storeTool.definition.function.name).toBe('memory_store');
      expect(storeTool.definition.function.description).toContain('Store');
      expect(storeTool.definition.function.parameters?.properties?.key).toBeDefined();
      expect(storeTool.definition.function.parameters?.properties?.description).toBeDefined();
      expect(storeTool.definition.function.parameters?.properties?.value).toBeDefined();
      expect(storeTool.definition.function.parameters?.required).toContain('key');
      expect(storeTool.definition.function.parameters?.required).toContain('description');
      expect(storeTool.definition.function.parameters?.required).toContain('value');
    });

    it('should store data in memory', async () => {
      const result = await storeTool.execute(
        {
          key: 'user.profile',
          description: 'User profile data',
          value: { name: 'John' },
        },
        mockContext
      );

      expect(mockMemory.set).toHaveBeenCalledWith(
        'user.profile',
        'User profile data',
        { name: 'John' },
        { scope: 'session', priority: undefined, pinned: undefined }
      );
      expect(result).toEqual({
        success: true,
        key: 'user.profile',
        tier: 'none',
        scope: 'session',
        priority: 'normal',
        derivedFrom: [],
      });
    });

    it('should throw ToolExecutionError without context', async () => {
      await expect(
        storeTool.execute({
          key: 'test',
          description: 'Test',
          value: {},
        })
      ).rejects.toThrow(ToolExecutionError);
    });

    it('should throw ToolExecutionError without memory access', async () => {
      await expect(
        storeTool.execute(
          {
            key: 'test',
            description: 'Test',
            value: {},
          },
          { agentId: 'test' } // No memory
        )
      ).rejects.toThrow(ToolExecutionError);
    });

    it('should include tool name in error message', async () => {
      await expect(
        storeTool.execute({
          key: 'test',
          description: 'Test',
          value: {},
        })
      ).rejects.toThrow(/memory_store/);
    });

    it('should be marked as idempotent', () => {
      expect(storeTool.idempotency?.safe).toBe(true);
    });

    it('should have small expected output size', () => {
      expect(storeTool.output?.expectedSize).toBe('small');
    });
  });

  describe('memory_retrieve tool', () => {
    let retrieveTool: ToolFunction;

    beforeEach(() => {
      const tools = createMemoryTools();
      retrieveTool = tools.find((t) => t.definition.function.name === 'memory_retrieve')!;
    });

    it('should have correct definition', () => {
      expect(retrieveTool.definition.function.name).toBe('memory_retrieve');
      expect(retrieveTool.definition.function.description).toContain('Retrieve');
      expect(retrieveTool.definition.function.parameters?.properties?.key).toBeDefined();
      expect(retrieveTool.definition.function.parameters?.required).toContain('key');
    });

    it('should retrieve data from memory', async () => {
      memoryStore.set('user.profile', {
        description: 'User profile',
        value: { name: 'John', email: 'john@test.com' },
      });

      const result = await retrieveTool.execute({ key: 'user.profile' }, mockContext);

      expect(result).toEqual({ name: 'John', email: 'john@test.com' });
    });

    it('should return error for missing key', async () => {
      const result = await retrieveTool.execute({ key: 'nonexistent' }, mockContext);

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('not found');
    });

    it('should be marked as idempotent', () => {
      expect(retrieveTool.idempotency?.safe).toBe(true);
    });

    it('should have variable expected output size', () => {
      expect(retrieveTool.output?.expectedSize).toBe('variable');
    });
  });

  describe('memory_delete tool', () => {
    let deleteTool: ToolFunction;

    beforeEach(() => {
      const tools = createMemoryTools();
      deleteTool = tools.find((t) => t.definition.function.name === 'memory_delete')!;
    });

    it('should have correct definition', () => {
      expect(deleteTool.definition.function.name).toBe('memory_delete');
      expect(deleteTool.definition.function.description).toContain('Delete');
      expect(deleteTool.definition.function.parameters?.properties?.key).toBeDefined();
    });

    it('should delete data from memory', async () => {
      memoryStore.set('test', { description: 'Test', value: 'data' });

      const result = await deleteTool.execute({ key: 'test' }, mockContext);

      expect(mockMemory.delete).toHaveBeenCalledWith('test');
      expect(result).toEqual({ success: true, deleted: 'test' });
    });

    it('should be marked as idempotent', () => {
      expect(deleteTool.idempotency?.safe).toBe(true);
    });
  });

  describe('memory_list tool', () => {
    let listTool: ToolFunction;

    beforeEach(() => {
      const tools = createMemoryTools();
      listTool = tools.find((t) => t.definition.function.name === 'memory_list')!;
    });

    it('should have correct definition', () => {
      expect(listTool.definition.function.name).toBe('memory_list');
      expect(listTool.definition.function.description).toContain('List');
    });

    it('should list all keys with descriptions', async () => {
      memoryStore.set('user.profile', { description: 'User profile data', value: {} });
      memoryStore.set('order.items', { description: 'Order items', value: [] });

      const result = await listTool.execute({}, mockContext);

      expect(result).toEqual({
        entries: [
          { key: 'user.profile', description: 'User profile data', priority: 'normal', tier: 'none', pinned: false },
          { key: 'order.items', description: 'Order items', priority: 'normal', tier: 'none', pinned: false },
        ],
        count: 2,
        tierFilter: 'all',
      });
    });

    it('should return empty entries when memory is empty', async () => {
      const result = await listTool.execute({}, mockContext);
      expect(result).toEqual({
        entries: [],
        count: 0,
        tierFilter: 'all',
      });
    });

    it('should be marked as idempotent', () => {
      expect(listTool.idempotency?.safe).toBe(true);
    });
  });

  describe('tool definitions', () => {
    it('memoryStoreDefinition should be valid', () => {
      expect(memoryStoreDefinition.type).toBe('function');
      expect(memoryStoreDefinition.function.name).toBe('memory_store');
      expect(memoryStoreDefinition.function.parameters).toBeDefined();
    });

    it('memoryRetrieveDefinition should be valid', () => {
      expect(memoryRetrieveDefinition.type).toBe('function');
      expect(memoryRetrieveDefinition.function.name).toBe('memory_retrieve');
    });

    it('memoryDeleteDefinition should be valid', () => {
      expect(memoryDeleteDefinition.type).toBe('function');
      expect(memoryDeleteDefinition.function.name).toBe('memory_delete');
    });

    it('memoryListDefinition should be valid', () => {
      expect(memoryListDefinition.type).toBe('function');
      expect(memoryListDefinition.function.name).toBe('memory_list');
    });
  });

  describe('tool parameter validation', () => {
    it('memory_store should require key, description, and value', () => {
      const tools = createMemoryTools();
      const storeTool = tools.find((t) => t.definition.function.name === 'memory_store')!;
      const required = storeTool.definition.function.parameters?.required || [];

      expect(required).toContain('key');
      expect(required).toContain('description');
      expect(required).toContain('value');
    });

    it('memory_retrieve should require key', () => {
      const tools = createMemoryTools();
      const retrieveTool = tools.find((t) => t.definition.function.name === 'memory_retrieve')!;
      const required = retrieveTool.definition.function.parameters?.required || [];

      expect(required).toContain('key');
    });

    it('memory_delete should require key', () => {
      const tools = createMemoryTools();
      const deleteTool = tools.find((t) => t.definition.function.name === 'memory_delete')!;
      const required = deleteTool.definition.function.parameters?.required || [];

      expect(required).toContain('key');
    });

    it('memory_list should not require any parameters', () => {
      const tools = createMemoryTools();
      const listTool = tools.find((t) => t.definition.function.name === 'memory_list')!;
      const required = listTool.definition.function.parameters?.required || [];

      expect(required).toHaveLength(0);
    });
  });

  describe('memory_cleanup_raw tool', () => {
    let cleanupRawTool: ToolFunction;

    beforeEach(() => {
      const tools = createMemoryTools();
      cleanupRawTool = tools.find((t) => t.definition.function.name === 'memory_cleanup_raw')!;
    });

    it('should have correct definition', () => {
      expect(cleanupRawTool.definition.function.name).toBe('memory_cleanup_raw');
      expect(cleanupRawTool.definition.function.description).toContain('raw tier');
      expect(cleanupRawTool.definition.function.parameters?.properties?.keys).toBeDefined();
      expect(cleanupRawTool.definition.function.parameters?.required).toContain('keys');
    });

    it('should delete only raw tier entries', async () => {
      // Setup entries with different tiers
      memoryStore.set('raw.data1', { description: 'Raw data 1', value: 'content1' });
      memoryStore.set('raw.data2', { description: 'Raw data 2', value: 'content2' });
      memoryStore.set('findings.important', { description: 'Finding', value: 'finding1' });

      const result = await cleanupRawTool.execute(
        { keys: ['raw.data1', 'raw.data2', 'findings.important'] },
        mockContext
      );

      // Should only delete raw keys
      expect(mockMemory.delete).toHaveBeenCalledWith('raw.data1');
      expect(mockMemory.delete).toHaveBeenCalledWith('raw.data2');
      expect(mockMemory.delete).not.toHaveBeenCalledWith('findings.important');
      expect(result.success).toBe(true);
      expect(result.deleted).toBe(2);
      expect(result.skipped).toContain('findings.important');
    });

    it('should skip non-raw tier entries', async () => {
      memoryStore.set('summary.overview', { description: 'Summary', value: 'content' });
      memoryStore.set('findings.key1', { description: 'Finding', value: 'content' });

      const result = await cleanupRawTool.execute(
        { keys: ['summary.overview', 'findings.key1'] },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(0);
      expect(result.skipped).toHaveLength(2);
    });

    it('should handle non-existent keys gracefully', async () => {
      const result = await cleanupRawTool.execute(
        { keys: ['raw.nonexistent1', 'raw.nonexistent2'] },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(0);
    });

    it('should be marked as idempotent', () => {
      expect(cleanupRawTool.idempotency?.safe).toBe(true);
    });
  });

  describe('memory_retrieve_batch tool', () => {
    let batchTool: ToolFunction;

    beforeEach(() => {
      const tools = createMemoryTools();
      batchTool = tools.find((t) => t.definition.function.name === 'memory_retrieve_batch')!;

      // Setup test data with different tiers
      memoryStore.set('findings.topic1', { description: 'Finding 1', value: { summary: 'Topic 1 findings' } });
      memoryStore.set('findings.topic2', { description: 'Finding 2', value: { summary: 'Topic 2 findings' } });
      memoryStore.set('summary.overview', { description: 'Summary', value: { text: 'Overview text' } });
      memoryStore.set('raw.data1', { description: 'Raw data', value: { content: 'Raw content' } });
    });

    it('should have correct definition', () => {
      expect(batchTool.definition.function.name).toBe('memory_retrieve_batch');
      expect(batchTool.definition.function.description).toContain('multiple memory entries');
      expect(batchTool.definition.function.parameters?.properties?.pattern).toBeDefined();
      expect(batchTool.definition.function.parameters?.properties?.keys).toBeDefined();
      expect(batchTool.definition.function.parameters?.properties?.tier).toBeDefined();
      expect(batchTool.definition.function.parameters?.properties?.includeMetadata).toBeDefined();
    });

    it('should retrieve entries by pattern', async () => {
      const result = await batchTool.execute(
        { pattern: 'findings.*' },
        mockContext
      );

      expect(result.count).toBe(2);
      expect(result.entries['findings.topic1']).toEqual({ summary: 'Topic 1 findings' });
      expect(result.entries['findings.topic2']).toEqual({ summary: 'Topic 2 findings' });
      expect(result.filter).toBe('pattern:findings.*');
    });

    it('should retrieve entries by specific keys', async () => {
      const result = await batchTool.execute(
        { keys: ['findings.topic1', 'summary.overview'] },
        mockContext
      );

      expect(result.count).toBe(2);
      expect(result.entries['findings.topic1']).toBeDefined();
      expect(result.entries['summary.overview']).toBeDefined();
      expect(result.entries['findings.topic2']).toBeUndefined();
    });

    it('should retrieve entries by tier', async () => {
      const result = await batchTool.execute(
        { tier: 'findings' },
        mockContext
      );

      expect(result.count).toBe(2);
      expect(result.entries['findings.topic1']).toBeDefined();
      expect(result.entries['findings.topic2']).toBeDefined();
      expect(result.entries['summary.overview']).toBeUndefined();
    });

    it('should retrieve all entries when no filter provided', async () => {
      const result = await batchTool.execute({}, mockContext);

      expect(result.count).toBe(4);
      expect(result.filter).toBe('all');
    });

    it('should include metadata when requested', async () => {
      const result = await batchTool.execute(
        { pattern: 'findings.*', includeMetadata: true },
        mockContext
      );

      expect(result.metadata).toBeDefined();
      expect(result.metadata['findings.topic1']).toEqual({
        tier: 'findings',
        priority: 'normal',
        pinned: false,
        description: 'Finding 1',
      });
    });

    it('should handle non-existent keys', async () => {
      const result = await batchTool.execute(
        { keys: ['nonexistent1', 'nonexistent2', 'findings.topic1'] },
        mockContext
      );

      expect(result.count).toBe(1);
      expect(result.notFound).toContain('nonexistent1');
      expect(result.notFound).toContain('nonexistent2');
    });

    it('should support wildcard patterns', async () => {
      const result = await batchTool.execute(
        { pattern: '*.topic1' },
        mockContext
      );

      expect(result.count).toBe(1);
      expect(result.entries['findings.topic1']).toBeDefined();
    });

    it('should support complex patterns', async () => {
      const result = await batchTool.execute(
        { pattern: '*.*' },
        mockContext
      );

      // Should match all dot-separated keys
      expect(result.count).toBe(4);
    });

    it('should be marked as idempotent', () => {
      expect(batchTool.idempotency?.safe).toBe(true);
    });

    it('should have variable expected output size', () => {
      expect(batchTool.output?.expectedSize).toBe('variable');
    });

    it('should throw ToolExecutionError without context', async () => {
      await expect(batchTool.execute({ pattern: '*' })).rejects.toThrow(ToolExecutionError);
    });
  });

  describe('new tool definitions', () => {
    it('memoryCleanupRawDefinition should be valid', () => {
      expect(memoryCleanupRawDefinition.type).toBe('function');
      expect(memoryCleanupRawDefinition.function.name).toBe('memory_cleanup_raw');
      expect(memoryCleanupRawDefinition.function.parameters).toBeDefined();
    });

    it('memoryRetrieveBatchDefinition should be valid', () => {
      expect(memoryRetrieveBatchDefinition.type).toBe('function');
      expect(memoryRetrieveBatchDefinition.function.name).toBe('memory_retrieve_batch');
      expect(memoryRetrieveBatchDefinition.function.parameters).toBeDefined();
    });
  });
});
