/**
 * Tests for custom_tool_delete
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createCustomToolDelete } from '../../../../src/tools/custom-tools/customToolDelete.js';
import { FileCustomToolStorage } from '../../../../src/infrastructure/storage/FileCustomToolStorage.js';
import { CUSTOM_TOOL_DEFINITION_VERSION } from '../../../../src/domain/entities/CustomToolDefinition.js';

describe('custom_tool_delete', () => {
  let storage: FileCustomToolStorage;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `delete-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new FileCustomToolStorage({ baseDirectory: testDir });
    await storage.save('test-user', {
      version: CUSTOM_TOOL_DEFINITION_VERSION,
      name: 'to_delete',
      description: 'Will be deleted',
      inputSchema: { type: 'object' },
      code: 'output = 1;',
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

  it('should delete an existing tool', async () => {
    const tool = createCustomToolDelete(storage);
    const result = await tool.execute({ name: 'to_delete' }, { userId: 'test-user' });

    expect(result.success).toBe(true);
    expect(result.name).toBe('to_delete');
    expect(await storage.exists('test-user', 'to_delete')).toBe(false);
  });

  it('should return error for nonexistent tool', async () => {
    const tool = createCustomToolDelete(storage);
    const result = await tool.execute({ name: 'nonexistent' }, { userId: 'test-user' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should require userId', async () => {
    const tool = createCustomToolDelete(storage);
    const result = await tool.execute({ name: 'to_delete' });  // No context

    expect(result.success).toBe(false);
    expect(result.error).toContain('userId required');
  });
});
