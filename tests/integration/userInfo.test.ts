/**
 * UserInfo Plugin Integration Tests
 *
 * Tests the full UserInfo plugin functionality including:
 * - Single-user scenarios
 * - Multi-user isolation
 * - StorageRegistry integration
 * - Cross-agent data sharing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentContextNextGen } from '../../src/core/context-nextgen/AgentContextNextGen.js';
import { UserInfoPluginNextGen } from '../../src/core/context-nextgen/plugins/UserInfoPluginNextGen.js';
import { FileUserInfoStorage } from '../../src/infrastructure/storage/FileUserInfoStorage.js';
import { StorageRegistry } from '../../src/core/StorageRegistry.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const TEST_USER_ID_1 = 'test-user-1';
const TEST_USER_ID_2 = 'test-user-2';

// Helper to get storage path
function getUserInfoPath(userId: string): string {
  const sanitized = userId.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  return join(homedir(), '.oneringai', 'users', sanitized, 'user_info.json');
}

// Helper to clean up test data
async function cleanupTestUser(userId: string): Promise<void> {
  try {
    await fs.unlink(getUserInfoPath(userId));
  } catch {
    // Ignore if doesn't exist
  }
}

describe('UserInfo Plugin Integration', () => {
  beforeEach(() => {
    StorageRegistry.reset();
  });

  afterEach(async () => {
    StorageRegistry.reset();
    await cleanupTestUser(TEST_USER_ID_1);
    await cleanupTestUser(TEST_USER_ID_2);
    await cleanupTestUser('default');
  });

  describe('Single User Flow', () => {
    it('should store and retrieve user information', async () => {
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        features: { userInfo: true },
        userId: TEST_USER_ID_1,
      });

      const plugin = ctx.getPlugin<UserInfoPluginNextGen>('user_info');
      expect(plugin).toBeDefined();

      // Get tools
      const tools = plugin!.getTools();
      expect(tools.length).toBe(4);
      const toolNames = tools.map(t => t.definition.function.name);
      expect(toolNames).toContain('user_info_set');
      expect(toolNames).toContain('user_info_get');
      expect(toolNames).toContain('user_info_remove');
      expect(toolNames).toContain('user_info_clear');

      // Set user info
      const setTool = tools.find(t => t.definition.function.name === 'user_info_set')!;
      const setResult = await setTool.execute(
        { key: 'theme', value: 'dark', description: 'User preferred theme' },
        { userId: TEST_USER_ID_1 }
      );
      expect(setResult).toHaveProperty('success', true);

      // Get user info
      const getTool = tools.find(t => t.definition.function.name === 'user_info_get')!;
      const getResult = await getTool.execute(
        { key: 'theme' },
        { userId: TEST_USER_ID_1 }
      );
      expect(getResult).toHaveProperty('key', 'theme');
      expect(getResult).toHaveProperty('value', 'dark');
      expect(getResult).toHaveProperty('valueType', 'string');
      expect(getResult).toHaveProperty('description', 'User preferred theme');

      // Remove user info
      const removeTool = tools.find(t => t.definition.function.name === 'user_info_remove')!;
      const removeResult = await removeTool.execute(
        { key: 'theme' },
        { userId: TEST_USER_ID_1 }
      );
      expect(removeResult).toHaveProperty('success', true);

      // Verify removed
      const getResult2 = await getTool.execute(
        { key: 'theme' },
        { userId: TEST_USER_ID_1 }
      );
      expect(getResult2).toHaveProperty('error');

      ctx.destroy();
    });

    it('should handle multiple entries', async () => {
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        features: { userInfo: true },
        userId: TEST_USER_ID_1,
      });

      const plugin = ctx.getPlugin<UserInfoPluginNextGen>('user_info')!;
      const tools = plugin.getTools();
      const setTool = tools.find(t => t.definition.function.name === 'user_info_set')!;
      const getTool = tools.find(t => t.definition.function.name === 'user_info_get')!;

      // Set multiple entries
      await setTool.execute({ key: 'theme', value: 'dark' }, { userId: TEST_USER_ID_1 });
      await setTool.execute({ key: 'language', value: 'en' }, { userId: TEST_USER_ID_1 });
      await setTool.execute({ key: 'timezone', value: 'UTC' }, { userId: TEST_USER_ID_1 });

      // Get all entries
      const allResult = await getTool.execute({}, { userId: TEST_USER_ID_1 });
      expect(allResult).toHaveProperty('count', 3);
      expect(allResult).toHaveProperty('entries');
      expect((allResult as any).entries).toHaveLength(3);

      ctx.destroy();
    });

    it('should persist data across context instances', async () => {
      // First context - write data
      const ctx1 = AgentContextNextGen.create({
        model: 'gpt-4',
        features: { userInfo: true },
        userId: TEST_USER_ID_1,
      });

      const plugin1 = ctx1.getPlugin<UserInfoPluginNextGen>('user_info')!;
      const setTool = plugin1.getTools().find(t => t.definition.function.name === 'user_info_set')!;
      await setTool.execute({ key: 'theme', value: 'dark' }, { userId: TEST_USER_ID_1 });
      ctx1.destroy();

      // Second context - read data
      const ctx2 = AgentContextNextGen.create({
        model: 'gpt-4',
        features: { userInfo: true },
        userId: TEST_USER_ID_1,
      });

      const plugin2 = ctx2.getPlugin<UserInfoPluginNextGen>('user_info')!;
      const getTool = plugin2.getTools().find(t => t.definition.function.name === 'user_info_get')!;
      const result = await getTool.execute({ key: 'theme' }, { userId: TEST_USER_ID_1 });
      expect(result).toHaveProperty('value', 'dark');

      ctx2.destroy();
    });
  });

  describe('Multi-User Isolation', () => {
    it('should isolate data between users', async () => {
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        features: { userInfo: true },
      });

      const plugin = ctx.getPlugin<UserInfoPluginNextGen>('user_info')!;
      const tools = plugin.getTools();
      const setTool = tools.find(t => t.definition.function.name === 'user_info_set')!;
      const getTool = tools.find(t => t.definition.function.name === 'user_info_get')!;

      // User 1 sets theme to dark
      await setTool.execute({ key: 'theme', value: 'dark' }, { userId: TEST_USER_ID_1 });

      // User 2 sets theme to light
      await setTool.execute({ key: 'theme', value: 'light' }, { userId: TEST_USER_ID_2 });

      // Verify User 1 still has dark
      const result1 = await getTool.execute({ key: 'theme' }, { userId: TEST_USER_ID_1 });
      expect(result1).toHaveProperty('value', 'dark');

      // Verify User 2 has light
      const result2 = await getTool.execute({ key: 'theme' }, { userId: TEST_USER_ID_2 });
      expect(result2).toHaveProperty('value', 'light');

      ctx.destroy();
    });
  });

  describe('StorageRegistry Integration', () => {
    it('should use custom storage from registry', async () => {
      let saveCalled = false;
      let loadCalled = false;

      class MockStorage extends FileUserInfoStorage {
        async save(userId: string, entries: any[]): Promise<void> {
          saveCalled = true;
          return super.save(userId, entries);
        }

        async load(userId: string): Promise<any> {
          loadCalled = true;
          return super.load(userId);
        }
      }

      StorageRegistry.configure({
        userInfo: () => new MockStorage(),
      });

      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        features: { userInfo: true },
        userId: TEST_USER_ID_1,
      });

      const plugin = ctx.getPlugin<UserInfoPluginNextGen>('user_info')!;
      const setTool = plugin.getTools().find(t => t.definition.function.name === 'user_info_set')!;

      await setTool.execute({ key: 'test', value: 'value' }, { userId: TEST_USER_ID_1 });

      expect(loadCalled).toBe(true);
      expect(saveCalled).toBe(true);

      ctx.destroy();
    });
  });

  describe('Cross-Agent Data Sharing', () => {
    it('should share user data across different agents', async () => {
      // Agent 1 writes data
      const ctx1 = AgentContextNextGen.create({
        model: 'gpt-4',
        agentId: 'agent-1',
        features: { userInfo: true },
        userId: TEST_USER_ID_1,
      });

      const plugin1 = ctx1.getPlugin<UserInfoPluginNextGen>('user_info')!;
      const setTool = plugin1.getTools().find(t => t.definition.function.name === 'user_info_set')!;
      await setTool.execute({ key: 'theme', value: 'dark' }, { userId: TEST_USER_ID_1 });
      ctx1.destroy();

      // Agent 2 reads data (different agentId, same userId)
      const ctx2 = AgentContextNextGen.create({
        model: 'gpt-4',
        agentId: 'agent-2',
        features: { userInfo: true },
        userId: TEST_USER_ID_1,
      });

      const plugin2 = ctx2.getPlugin<UserInfoPluginNextGen>('user_info')!;
      const getTool = plugin2.getTools().find(t => t.definition.function.name === 'user_info_get')!;
      const result = await getTool.execute({ key: 'theme' }, { userId: TEST_USER_ID_1 });
      expect(result).toHaveProperty('value', 'dark');

      ctx2.destroy();
    });
  });

  describe('Default User Behavior', () => {
    it('should work without userId (defaults to "default" user)', async () => {
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        features: { userInfo: true },
      });

      const plugin = ctx.getPlugin<UserInfoPluginNextGen>('user_info')!;
      const tools = plugin.getTools();
      const setTool = tools.find(t => t.definition.function.name === 'user_info_set')!;
      const getTool = tools.find(t => t.definition.function.name === 'user_info_get')!;

      // Call without userId — should work, using 'default' user
      const setResult = await setTool.execute({ key: 'test_default', value: 'value' });
      expect(setResult).toHaveProperty('success', true);

      // Retrieve without userId — should find the entry
      const getResult = await getTool.execute({ key: 'test_default' });
      expect(getResult).toHaveProperty('value', 'value');

      // Clean up
      const clearTool = tools.find(t => t.definition.function.name === 'user_info_clear')!;
      await clearTool.execute({ confirm: true });

      ctx.destroy();
    });

    it('should validate key format', async () => {
      const ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        features: { userInfo: true },
        userId: TEST_USER_ID_1,
      });

      const plugin = ctx.getPlugin<UserInfoPluginNextGen>('user_info')!;
      const setTool = plugin.getTools().find(t => t.definition.function.name === 'user_info_set')!;

      // Invalid key (has spaces)
      const result = await setTool.execute(
        { key: 'invalid key', value: 'value' },
        { userId: TEST_USER_ID_1 }
      );
      expect(result).toHaveProperty('error');

      ctx.destroy();
    });
  });
});
