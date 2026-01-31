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
  memoryQueryDefinition,
  memoryCleanupRawDefinition,
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
      expect(tools.length).toBe(5); // store, retrieve, delete, query, cleanup_raw
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

    it('should include memory_query tool', () => {
      const tools = createMemoryTools();
      const queryTool = tools.find((t) => t.definition.function.name === 'memory_query');

      expect(queryTool).toBeDefined();
    });

    it('should include memory_cleanup_raw tool', () => {
      const tools = createMemoryTools();
      const cleanupTool = tools.find((t) => t.definition.function.name === 'memory_cleanup_raw');

      expect(cleanupTool).toBeDefined();
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

  describe('memory_query tool', () => {
    let queryTool: ToolFunction;

    beforeEach(() => {
      const tools = createMemoryTools();
      queryTool = tools.find((t) => t.definition.function.name === 'memory_query')!;

      // Setup test data with different tiers
      memoryStore.set('findings.topic1', { description: 'Finding 1', value: { summary: 'Topic 1 findings' } });
      memoryStore.set('findings.topic2', { description: 'Finding 2', value: { summary: 'Topic 2 findings' } });
      memoryStore.set('summary.overview', { description: 'Summary', value: { text: 'Overview text' } });
      memoryStore.set('raw.data1', { description: 'Raw data', value: { content: 'Raw content' } });
    });

    it('should have correct definition', () => {
      expect(queryTool.definition.function.name).toBe('memory_query');
      expect(queryTool.definition.function.description).toContain('Query');
      expect(queryTool.definition.function.parameters?.properties?.pattern).toBeDefined();
      expect(queryTool.definition.function.parameters?.properties?.tier).toBeDefined();
      expect(queryTool.definition.function.parameters?.properties?.includeValues).toBeDefined();
      expect(queryTool.definition.function.parameters?.properties?.includeMetadata).toBeDefined();
      expect(queryTool.definition.function.parameters?.properties?.includeStats).toBeDefined();
    });

    it('should list all keys by default', async () => {
      const result = await queryTool.execute({}, mockContext);

      expect(result.count).toBe(4);
      expect(result.entries).toHaveLength(4);
      expect(result.filter).toBe('all');
    });

    it('should list entries by pattern', async () => {
      const result = await queryTool.execute(
        { pattern: 'findings.*' },
        mockContext
      );

      expect(result.count).toBe(2);
      expect(result.filter).toBe('pattern:findings.*');
    });

    it('should list entries by tier', async () => {
      const result = await queryTool.execute(
        { tier: 'findings' },
        mockContext
      );

      expect(result.count).toBe(2);
    });

    it('should include values when requested', async () => {
      const result = await queryTool.execute(
        { pattern: 'findings.*', includeValues: true },
        mockContext
      );

      expect(result.count).toBe(2);
      expect(result.entries['findings.topic1']).toEqual({ summary: 'Topic 1 findings' });
      expect(result.entries['findings.topic2']).toEqual({ summary: 'Topic 2 findings' });
    });

    it('should include metadata when requested', async () => {
      const result = await queryTool.execute(
        { pattern: 'findings.*', includeValues: true, includeMetadata: true },
        mockContext
      );

      expect(result.metadata).toBeDefined();
      expect(result.metadata['findings.topic1']).toBeDefined();
    });

    it('should be marked as idempotent', () => {
      expect(queryTool.idempotency?.safe).toBe(true);
    });

    it('should have variable expected output size', () => {
      expect(queryTool.output?.expectedSize).toBe('variable');
    });

    it('should throw ToolExecutionError without context', async () => {
      await expect(queryTool.execute({ pattern: '*' })).rejects.toThrow(ToolExecutionError);
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

    it('memoryQueryDefinition should be valid', () => {
      expect(memoryQueryDefinition.type).toBe('function');
      expect(memoryQueryDefinition.function.name).toBe('memory_query');
      expect(memoryQueryDefinition.function.parameters).toBeDefined();
    });

    it('memoryCleanupRawDefinition should be valid', () => {
      expect(memoryCleanupRawDefinition.type).toBe('function');
      expect(memoryCleanupRawDefinition.function.name).toBe('memory_cleanup_raw');
      expect(memoryCleanupRawDefinition.function.parameters).toBeDefined();
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

    it('memory_query should not require any parameters', () => {
      const tools = createMemoryTools();
      const queryTool = tools.find((t) => t.definition.function.name === 'memory_query')!;
      const required = queryTool.definition.function.parameters?.required || [];

      expect(required).toHaveLength(0);
    });
  });
});
