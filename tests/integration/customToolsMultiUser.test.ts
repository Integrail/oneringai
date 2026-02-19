/**
 * Integration test for Custom Tools multi-user isolation
 *
 * Verifies that custom tools are properly isolated between users,
 * preventing cross-user access and data leakage.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { FileCustomToolStorage } from '../../src/infrastructure/storage/FileCustomToolStorage.js';
import { createCustomToolSave } from '../../src/tools/custom-tools/customToolSave.js';
import { createCustomToolLoad } from '../../src/tools/custom-tools/customToolLoad.js';
import { createCustomToolList } from '../../src/tools/custom-tools/customToolList.js';
import { createCustomToolDelete } from '../../src/tools/custom-tools/customToolDelete.js';

describe('Custom Tools - Multi-User Isolation', () => {
  let storage: FileCustomToolStorage;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `custom-tools-multiuser-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new FileCustomToolStorage({ baseDirectory: testDir });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should isolate custom tools between users', async () => {
    const saveTool = createCustomToolSave(storage);
    const listTool = createCustomToolList(storage);
    const loadTool = createCustomToolLoad(storage);

    // Alice creates her tools
    await saveTool.execute({
      name: 'alice_weather',
      description: 'Alice weather tool',
      inputSchema: { type: 'object', properties: { city: { type: 'string' } } },
      code: 'output = `Weather in ${input.city}`;',
      tags: ['weather'],
    }, { userId: 'alice' });

    await saveTool.execute({
      name: 'alice_stocks',
      description: 'Alice stocks tool',
      inputSchema: { type: 'object', properties: { symbol: { type: 'string' } } },
      code: 'output = `Stock price for ${input.symbol}`;',
      tags: ['finance'],
    }, { userId: 'alice' });

    // Bob creates his tools
    await saveTool.execute({
      name: 'bob_calculator',
      description: 'Bob calculator tool',
      inputSchema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } },
      code: 'output = input.x + input.y;',
      tags: ['math'],
    }, { userId: 'bob' });

    // Alice should only see her tools
    const aliceList = await listTool.execute({}, { userId: 'alice' });
    expect(aliceList.tools).toHaveLength(2);
    const aliceNames = aliceList.tools.map(t => t.name);
    expect(aliceNames).toContain('alice_weather');
    expect(aliceNames).toContain('alice_stocks');
    expect(aliceNames).not.toContain('bob_calculator');

    // Bob should only see his tools
    const bobList = await listTool.execute({}, { userId: 'bob' });
    expect(bobList.tools).toHaveLength(1);
    expect(bobList.tools[0].name).toBe('bob_calculator');

    // Alice can load her tools but not Bob's
    const aliceWeather = await loadTool.execute({ name: 'alice_weather' }, { userId: 'alice' });
    expect(aliceWeather.success).toBe(true);
    expect(aliceWeather.tool?.name).toBe('alice_weather');

    const aliceTriesBob = await loadTool.execute({ name: 'bob_calculator' }, { userId: 'alice' });
    expect(aliceTriesBob.success).toBe(false);
    expect(aliceTriesBob.error).toContain('not found');

    // Bob can load his tools but not Alice's
    const bobCalculator = await loadTool.execute({ name: 'bob_calculator' }, { userId: 'bob' });
    expect(bobCalculator.success).toBe(true);
    expect(bobCalculator.tool?.name).toBe('bob_calculator');

    const bobTriesAlice = await loadTool.execute({ name: 'alice_weather' }, { userId: 'bob' });
    expect(bobTriesAlice.success).toBe(false);
    expect(bobTriesAlice.error).toContain('not found');
  });

  it('should allow same tool name for different users', async () => {
    const saveTool = createCustomToolSave(storage);
    const loadTool = createCustomToolLoad(storage);

    // Both Alice and Bob create a tool with the same name
    await saveTool.execute({
      name: 'shared_tool',
      description: 'Alice version',
      inputSchema: { type: 'object' },
      code: 'output = "Alice implementation";',
    }, { userId: 'alice' });

    await saveTool.execute({
      name: 'shared_tool',
      description: 'Bob version',
      inputSchema: { type: 'object' },
      code: 'output = "Bob implementation";',
    }, { userId: 'bob' });

    // Each user gets their own version
    const aliceTool = await loadTool.execute({ name: 'shared_tool' }, { userId: 'alice' });
    expect(aliceTool.success).toBe(true);
    expect(aliceTool.tool?.description).toBe('Alice version');
    expect(aliceTool.tool?.code).toBe('output = "Alice implementation";');

    const bobTool = await loadTool.execute({ name: 'shared_tool' }, { userId: 'bob' });
    expect(bobTool.success).toBe(true);
    expect(bobTool.tool?.description).toBe('Bob version');
    expect(bobTool.tool?.code).toBe('output = "Bob implementation";');
  });

  it('should not affect other users when deleting tools', async () => {
    const saveTool = createCustomToolSave(storage);
    const deleteTool = createCustomToolDelete(storage);
    const listTool = createCustomToolList(storage);

    // Both users create a tool with the same name
    await saveTool.execute({
      name: 'common_tool',
      description: 'Alice version',
      inputSchema: { type: 'object' },
      code: 'output = 1;',
    }, { userId: 'alice' });

    await saveTool.execute({
      name: 'common_tool',
      description: 'Bob version',
      inputSchema: { type: 'object' },
      code: 'output = 2;',
    }, { userId: 'bob' });

    // Alice deletes her tool
    const deleteResult = await deleteTool.execute({ name: 'common_tool' }, { userId: 'alice' });
    expect(deleteResult.success).toBe(true);

    // Alice's tool should be gone
    const aliceList = await listTool.execute({}, { userId: 'alice' });
    expect(aliceList.tools).toHaveLength(0);

    // Bob's tool should still exist
    const bobList = await listTool.execute({}, { userId: 'bob' });
    expect(bobList.tools).toHaveLength(1);
    expect(bobList.tools[0].name).toBe('common_tool');
    expect(bobList.tools[0].description).toBe('Bob version');
  });

  it('should filter tools by tags within user scope', async () => {
    const saveTool = createCustomToolSave(storage);
    const listTool = createCustomToolList(storage);

    // Alice creates tools with different tags
    await saveTool.execute({
      name: 'alice_math',
      description: 'Math tool',
      inputSchema: { type: 'object' },
      code: 'output = 1;',
      tags: ['math'],
    }, { userId: 'alice' });

    await saveTool.execute({
      name: 'alice_api',
      description: 'API tool',
      inputSchema: { type: 'object' },
      code: 'output = 1;',
      tags: ['api'],
    }, { userId: 'alice' });

    // Bob creates a tool with same tag as Alice
    await saveTool.execute({
      name: 'bob_math',
      description: 'Bob math tool',
      inputSchema: { type: 'object' },
      code: 'output = 1;',
      tags: ['math'],
    }, { userId: 'bob' });

    // Alice filters by 'math' tag - should only see her math tool
    const aliceMath = await listTool.execute({ tags: ['math'] }, { userId: 'alice' });
    expect(aliceMath.tools).toHaveLength(1);
    expect(aliceMath.tools[0].name).toBe('alice_math');

    // Bob filters by 'math' tag - should only see his math tool
    const bobMath = await listTool.execute({ tags: ['math'] }, { userId: 'bob' });
    expect(bobMath.tools).toHaveLength(1);
    expect(bobMath.tools[0].name).toBe('bob_math');
  });

  it('should store tools in separate directories per user', async () => {
    const saveTool = createCustomToolSave(storage);

    await saveTool.execute({
      name: 'alice_tool',
      description: 'Alice tool',
      inputSchema: { type: 'object' },
      code: 'output = 1;',
    }, { userId: 'alice' });

    await saveTool.execute({
      name: 'bob_tool',
      description: 'Bob tool',
      inputSchema: { type: 'object' },
      code: 'output = 1;',
    }, { userId: 'bob' });

    // Verify separate directory structure
    const aliceDir = join(testDir, 'alice', 'custom-tools');
    const bobDir = join(testDir, 'bob', 'custom-tools');

    const aliceDirExists = await fs.access(aliceDir).then(() => true).catch(() => false);
    const bobDirExists = await fs.access(bobDir).then(() => true).catch(() => false);

    expect(aliceDirExists).toBe(true);
    expect(bobDirExists).toBe(true);

    // Verify files exist in correct directories
    const aliceFiles = await fs.readdir(aliceDir);
    const bobFiles = await fs.readdir(bobDir);

    expect(aliceFiles.some(f => f.includes('alice_tool'))).toBe(true);
    expect(bobFiles.some(f => f.includes('bob_tool'))).toBe(true);

    // Verify cross-contamination doesn't exist
    expect(aliceFiles.some(f => f.includes('bob_tool'))).toBe(false);
    expect(bobFiles.some(f => f.includes('alice_tool'))).toBe(false);
  });

  it('should default to "default" user when userId not provided', async () => {
    const saveTool = createCustomToolSave(storage);
    const loadTool = createCustomToolLoad(storage);
    const listTool = createCustomToolList(storage);

    // Save without userId should default to 'default' user
    const saveResult = await saveTool.execute({
      name: 'default_tool',
      description: 'Test tool',
      inputSchema: { type: 'object' },
      code: 'output = 1;',
    });
    expect(saveResult.success).toBe(true);

    // Load without userId should use 'default' user
    const loadResult = await loadTool.execute({ name: 'default_tool' });
    expect(loadResult.success).toBe(true);
    expect(loadResult.tool?.name).toBe('default_tool');

    // List without userId should show 'default' user's tools
    const listResult = await listTool.execute({});
    expect(listResult.tools).toHaveLength(1);
    expect(listResult.tools[0].name).toBe('default_tool');

    // Verify tools under different userId are separate
    await saveTool.execute({
      name: 'alice_tool',
      description: 'Alice tool',
      inputSchema: { type: 'object' },
      code: 'output = 2;',
    }, { userId: 'alice' });

    // Default user should only see their tool
    const defaultList = await listTool.execute({});
    expect(defaultList.tools).toHaveLength(1);
    expect(defaultList.tools[0].name).toBe('default_tool');

    // Alice should only see her tool
    const aliceList = await listTool.execute({}, { userId: 'alice' });
    expect(aliceList.tools).toHaveLength(1);
    expect(aliceList.tools[0].name).toBe('alice_tool');
  });
});
