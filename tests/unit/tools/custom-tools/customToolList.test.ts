/**
 * Tests for custom_tool_list
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createCustomToolList } from '../../../../src/tools/custom-tools/customToolList.js';
import { FileCustomToolStorage } from '../../../../src/infrastructure/storage/FileCustomToolStorage.js';
import type { CustomToolDefinition } from '../../../../src/domain/entities/CustomToolDefinition.js';
import { CUSTOM_TOOL_DEFINITION_VERSION } from '../../../../src/domain/entities/CustomToolDefinition.js';

describe('custom_tool_list', () => {
  let storage: FileCustomToolStorage;
  let testDir: string;

  function makeDef(name: string, meta?: Record<string, unknown>): CustomToolDefinition {
    return {
      version: CUSTOM_TOOL_DEFINITION_VERSION,
      name,
      description: `Tool: ${name}`,
      inputSchema: { type: 'object' },
      code: 'output = 1;',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: meta as any,
    };
  }

  beforeEach(async () => {
    testDir = join(tmpdir(), `list-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new FileCustomToolStorage({ baseDirectory: testDir });
    await storage.save(makeDef('alpha', { tags: ['math'], category: 'compute' }));
    await storage.save(makeDef('beta', { tags: ['api'], category: 'network' }));
    await storage.save(makeDef('gamma', { tags: ['math', 'api'], category: 'compute' }));
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('should list all tools', async () => {
    const tool = createCustomToolList(storage);
    const result = await tool.execute({});

    expect(result.tools).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it('should filter by search', async () => {
    const tool = createCustomToolList(storage);
    const result = await tool.execute({ search: 'alpha' });

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe('alpha');
  });

  it('should filter by tags', async () => {
    const tool = createCustomToolList(storage);
    const result = await tool.execute({ tags: ['api'] });

    expect(result.tools).toHaveLength(2);
  });

  it('should filter by category', async () => {
    const tool = createCustomToolList(storage);
    const result = await tool.execute({ category: 'network' });

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe('beta');
  });

  it('should support limit', async () => {
    const tool = createCustomToolList(storage);
    const result = await tool.execute({ limit: 1 });

    expect(result.tools).toHaveLength(1);
  });
});
