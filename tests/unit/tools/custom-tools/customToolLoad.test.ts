/**
 * Tests for custom_tool_load
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createCustomToolLoad } from '../../../../src/tools/custom-tools/customToolLoad.js';
import { FileCustomToolStorage } from '../../../../src/infrastructure/storage/FileCustomToolStorage.js';
import { CUSTOM_TOOL_DEFINITION_VERSION } from '../../../../src/domain/entities/CustomToolDefinition.js';

describe('custom_tool_load', () => {
  let storage: FileCustomToolStorage;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `load-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new FileCustomToolStorage({ baseDirectory: testDir });
    await storage.save('test-user', {
      version: CUSTOM_TOOL_DEFINITION_VERSION,
      name: 'existing_tool',
      description: 'An existing tool',
      inputSchema: { type: 'object' },
      code: 'output = 42;',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('should load an existing tool with full definition including code', async () => {
    const tool = createCustomToolLoad(storage);
    const result = await tool.execute({ name: 'existing_tool' }, { userId: 'test-user' });

    expect(result.success).toBe(true);
    expect(result.tool).toBeDefined();
    expect(result.tool!.name).toBe('existing_tool');
    expect(result.tool!.code).toBe('output = 42;');
  });

  it('should return error for nonexistent tool', async () => {
    const tool = createCustomToolLoad(storage);
    const result = await tool.execute({ name: 'nonexistent' }, { userId: 'test-user' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should work without userId (defaults to "default" user)', async () => {
    // Save a tool without userId (goes to default user)
    await storage.save(undefined, {
      version: CUSTOM_TOOL_DEFINITION_VERSION,
      name: 'default_tool',
      description: 'Default user tool',
      inputSchema: { type: 'object' },
      code: 'output = 99;',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const tool = createCustomToolLoad(storage);
    const result = await tool.execute({ name: 'default_tool' });  // No context

    expect(result.success).toBe(true);
    expect(result.tool).toBeDefined();
    expect(result.tool!.name).toBe('default_tool');
    expect(result.tool!.code).toBe('output = 99;');
  });
});
