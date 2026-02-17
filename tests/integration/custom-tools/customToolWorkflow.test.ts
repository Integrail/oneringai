/**
 * Integration test: Full custom tool workflow
 *
 * draft → test → fix → save → list → load → hydrate → register → execute → delete
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createCustomToolDraft } from '../../../src/tools/custom-tools/customToolDraft.js';
import { createCustomToolTest } from '../../../src/tools/custom-tools/customToolTest.js';
import { createCustomToolSave } from '../../../src/tools/custom-tools/customToolSave.js';
import { createCustomToolList } from '../../../src/tools/custom-tools/customToolList.js';
import { createCustomToolLoad } from '../../../src/tools/custom-tools/customToolLoad.js';
import { createCustomToolDelete } from '../../../src/tools/custom-tools/customToolDelete.js';
import { hydrateCustomTool } from '../../../src/tools/custom-tools/hydrate.js';
import { FileCustomToolStorage } from '../../../src/infrastructure/storage/FileCustomToolStorage.js';
import { ToolManager } from '../../../src/core/ToolManager.js';

describe('Custom Tool Workflow (Integration)', () => {
  let storage: FileCustomToolStorage;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `workflow-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new FileCustomToolStorage({ baseDirectory: testDir });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('should complete full workflow: draft → test → save → list → load → hydrate → register → execute → delete', async () => {
    const draft = createCustomToolDraft();
    const test = createCustomToolTest();
    const save = createCustomToolSave(storage);
    const list = createCustomToolList(storage);
    const load = createCustomToolLoad(storage);
    const del = createCustomToolDelete(storage);

    // 1. Draft — validate tool definition
    const draftResult = await draft.execute({
      name: 'celsius_to_fahrenheit',
      description: 'Converts Celsius to Fahrenheit',
      inputSchema: {
        type: 'object',
        properties: { celsius: { type: 'number' } },
        required: ['celsius'],
      },
      code: 'output = { fahrenheit: input.celsius * 9/5 + 32 };',
      tags: ['conversion', 'temperature'],
    });
    expect(draftResult.success).toBe(true);

    // 2. Test — execute in sandbox
    const testResult = await test.execute({
      code: 'output = { fahrenheit: input.celsius * 9/5 + 32 };',
      inputSchema: draftResult.validated!.inputSchema,
      testInput: { celsius: 100 },
    });
    expect(testResult.success).toBe(true);
    expect(testResult.result).toEqual({ fahrenheit: 212 });

    // 3. Test with another input
    const testResult2 = await test.execute({
      code: 'output = { fahrenheit: input.celsius * 9/5 + 32 };',
      inputSchema: draftResult.validated!.inputSchema,
      testInput: { celsius: 0 },
    });
    expect(testResult2.success).toBe(true);
    expect(testResult2.result).toEqual({ fahrenheit: 32 });

    // 4. Save — persist to storage
    const saveResult = await save.execute({
      name: 'celsius_to_fahrenheit',
      description: 'Converts Celsius to Fahrenheit',
      inputSchema: draftResult.validated!.inputSchema,
      code: 'output = { fahrenheit: input.celsius * 9/5 + 32 };',
      tags: ['conversion', 'temperature'],
      category: 'math',
    });
    expect(saveResult.success).toBe(true);

    // 5. List — find it in storage
    const listResult = await list.execute({ search: 'celsius' });
    expect(listResult.tools).toHaveLength(1);
    expect(listResult.tools[0].name).toBe('celsius_to_fahrenheit');

    // 6. Load — get full definition back
    const loadResult = await load.execute({ name: 'celsius_to_fahrenheit' });
    expect(loadResult.success).toBe(true);
    expect(loadResult.tool!.code).toContain('celsius');

    // 7. Hydrate — convert to ToolFunction
    const toolFn = hydrateCustomTool(loadResult.tool!);
    expect(toolFn.definition.function.name).toBe('celsius_to_fahrenheit');

    // 8. Register on ToolManager
    const tm = new ToolManager();
    tm.register(toolFn, { source: 'custom', tags: ['conversion'] });
    expect(tm.has('celsius_to_fahrenheit')).toBe(true);

    // 9. Execute via ToolManager
    const execResult = await tm.execute('celsius_to_fahrenheit', { celsius: 37 });
    expect((execResult as any).fahrenheit).toBeCloseTo(98.6, 5);

    // 10. Delete from storage
    const deleteResult = await del.execute({ name: 'celsius_to_fahrenheit' });
    expect(deleteResult.success).toBe(true);

    // Verify deleted
    const listAfter = await list.execute({});
    expect(listAfter.tools).toHaveLength(0);

    // Cleanup
    tm.destroy();
  });

  it('should handle draft → fix → test cycle (validation error recovery)', async () => {
    const draft = createCustomToolDraft();
    const test = createCustomToolTest();

    // First attempt: bad name
    const bad = await draft.execute({
      name: 'BAD NAME',
      description: 'test',
      inputSchema: { type: 'object' },
      code: 'output = 1;',
    });
    expect(bad.success).toBe(false);

    // Fixed: good name
    const good = await draft.execute({
      name: 'good_name',
      description: 'test',
      inputSchema: { type: 'object' },
      code: 'output = input.value + 1;',
    });
    expect(good.success).toBe(true);

    // Test it
    const result = await test.execute({
      code: 'output = input.value + 1;',
      inputSchema: good.validated!.inputSchema,
      testInput: { value: 10 },
    });
    expect(result.success).toBe(true);
    expect(result.result).toBe(11);
  });
});
