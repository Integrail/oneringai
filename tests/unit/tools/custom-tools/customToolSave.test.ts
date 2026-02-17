/**
 * Tests for custom_tool_save
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createCustomToolSave } from '../../../../src/tools/custom-tools/customToolSave.js';
import { FileCustomToolStorage } from '../../../../src/infrastructure/storage/FileCustomToolStorage.js';

describe('custom_tool_save', () => {
  let storage: FileCustomToolStorage;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `save-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new FileCustomToolStorage({ baseDirectory: testDir });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('should save a tool definition', async () => {
    const tool = createCustomToolSave(storage);

    const result = await tool.execute({
      name: 'my_tool',
      description: 'A test tool',
      inputSchema: { type: 'object', properties: { x: { type: 'number' } } },
      code: 'output = input.x * 2;',
      tags: ['math'],
      category: 'compute',
    });

    expect(result.success).toBe(true);
    expect(result.name).toBe('my_tool');
    expect(result.storagePath).toBe(testDir);

    // Verify it was persisted
    const loaded = await storage.load('my_tool');
    expect(loaded).not.toBeNull();
    expect(loaded!.description).toBe('A test tool');
    expect(loaded!.metadata?.tags).toEqual(['math']);
    expect(loaded!.metadata?.category).toBe('compute');
  });

  it('should preserve createdAt on update', async () => {
    const tool = createCustomToolSave(storage);

    await tool.execute({
      name: 'my_tool',
      description: 'v1',
      inputSchema: { type: 'object' },
      code: 'output = 1;',
    });

    const first = await storage.load('my_tool');
    const createdAt = first!.createdAt;

    // Wait a bit to ensure different timestamps
    await new Promise(r => setTimeout(r, 10));

    await tool.execute({
      name: 'my_tool',
      description: 'v2',
      inputSchema: { type: 'object' },
      code: 'output = 2;',
    });

    const second = await storage.load('my_tool');
    expect(second!.createdAt).toBe(createdAt);
    expect(second!.updatedAt).not.toBe(createdAt);
    expect(second!.description).toBe('v2');
  });

  it('should save connector metadata', async () => {
    const tool = createCustomToolSave(storage);

    await tool.execute({
      name: 'api_tool',
      description: 'Uses connectors',
      inputSchema: { type: 'object' },
      code: 'output = 1;',
      connectorNames: ['github', 'slack'],
    });

    const loaded = await storage.load('api_tool');
    expect(loaded!.metadata?.connectorNames).toEqual(['github', 'slack']);
    expect(loaded!.metadata?.requiresConnector).toBe(true);
  });
});
