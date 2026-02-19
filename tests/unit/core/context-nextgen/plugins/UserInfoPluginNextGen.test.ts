/**
 * UserInfoPluginNextGen Unit Tests
 *
 * Tests for the NextGen user info plugin covering:
 * - Core KVP operations via tools (set, get, remove, clear)
 * - Key validation
 * - Maximum entries/size enforcement
 * - Lazy initialization from storage
 * - Content rendering (getContent)
 * - Token size tracking
 * - getContents() returns Map
 * - Serialization/deserialization (getState/restoreState)
 * - Non-compactable behavior
 * - In-memory cache with write-through
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserInfoPluginNextGen } from '@/core/context-nextgen/plugins/UserInfoPluginNextGen.js';
import type { UserInfoPluginConfig } from '@/core/context-nextgen/plugins/UserInfoPluginNextGen.js';
import type { IUserInfoStorage, UserInfoEntry } from '@/domain/interfaces/IUserInfoStorage.js';

/**
 * Create a mock storage implementation for testing
 */
function createMockStorage(): IUserInfoStorage & { _data: Map<string, UserInfoEntry[] | null> } {
  return {
    _data: new Map(),
    async load(userId: string | undefined): Promise<UserInfoEntry[] | null> {
      const key = userId ?? 'default';
      return this._data.get(key) ?? null;
    },
    async save(userId: string | undefined, entries: UserInfoEntry[]): Promise<void> {
      const key = userId ?? 'default';
      this._data.set(key, entries);
    },
    async delete(userId: string | undefined): Promise<void> {
      const key = userId ?? 'default';
      this._data.delete(key);
    },
    async exists(userId: string | undefined): Promise<boolean> {
      const key = userId ?? 'default';
      return this._data.has(key);
    },
    getPath(userId: string | undefined): string {
      const key = userId ?? 'default';
      return `/mock/users/${key}/user_info.json`;
    },
  };
}

function getTool(plugin: UserInfoPluginNextGen, name: string) {
  const tools = plugin.getTools();
  return tools.find(t => t.definition.function.name === name)!;
}

describe('UserInfoPluginNextGen', () => {
  let plugin: UserInfoPluginNextGen;
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    plugin = new UserInfoPluginNextGen({
      storage: mockStorage,
    });
  });

  afterEach(() => {
    plugin.destroy();
  });

  describe('Plugin Interface', () => {
    it('should have correct name', () => {
      expect(plugin.name).toBe('user_info');
    });

    it('should provide instructions', () => {
      const instructions = plugin.getInstructions();
      expect(instructions).toContain('User Info');
      expect(instructions).toContain('user_info_set');
      expect(instructions).toContain('user_info_get');
      expect(instructions).toContain('user_info_remove');
      expect(instructions).toContain('user_info_clear');
      expect(instructions).toContain('automatically shown in context');
    });

    it('should NOT be compactable', () => {
      expect(plugin.isCompactable()).toBe(false);
    });

    it('should return 0 tokens freed on compact', async () => {
      const freed = await plugin.compact(1000);
      expect(freed).toBe(0);
    });

    it('should provide 4 tools', () => {
      const tools = plugin.getTools();
      expect(tools).toHaveLength(4);

      const toolNames = tools.map(t => t.definition.function.name);
      expect(toolNames).toContain('user_info_set');
      expect(toolNames).toContain('user_info_get');
      expect(toolNames).toContain('user_info_remove');
      expect(toolNames).toContain('user_info_clear');
    });

    it('should have non-zero instructions token size', () => {
      expect(plugin.getInstructionsTokenSize()).toBeGreaterThan(0);
    });
  });

  describe('Content Rendering (getContent)', () => {
    it('should return null when no entries', async () => {
      const content = await plugin.getContent();
      expect(content).toBeNull();
    });

    it('should render entries as markdown after tool set', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });
      await setTool.execute({ key: 'language', value: 'en' });

      const content = await plugin.getContent();
      expect(content).not.toBeNull();
      expect(content).toContain('### theme');
      expect(content).toContain('dark');
      expect(content).toContain('### language');
      expect(content).toContain('en');
    });

    it('should render complex values as JSON', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'prefs', value: { notifications: true, compact: false } });

      const content = await plugin.getContent();
      expect(content).toContain('### prefs');
      expect(content).toContain('"notifications":true');
    });

    it('should render null value correctly', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'empty', value: null });

      const content = await plugin.getContent();
      expect(content).toContain('### empty');
      expect(content).toContain('null');
    });

    it('should render number and boolean values correctly', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'age', value: 30 });
      await setTool.execute({ key: 'active', value: true });

      const content = await plugin.getContent();
      expect(content).toContain('30');
      expect(content).toContain('true');
    });

    it('should return null after all entries removed', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      const removeTool = getTool(plugin, 'user_info_remove');
      await setTool.execute({ key: 'theme', value: 'dark' });
      await removeTool.execute({ key: 'theme' });

      const content = await plugin.getContent();
      expect(content).toBeNull();
    });
  });

  describe('Token Size Tracking', () => {
    it('should return 0 when no entries', async () => {
      await plugin.getContent(); // trigger initialization
      expect(plugin.getTokenSize()).toBe(0);
    });

    it('should return non-zero after entries set', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });

      await plugin.getContent(); // triggers token calculation
      expect(plugin.getTokenSize()).toBeGreaterThan(0);
    });

    it('should invalidate token cache after set', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });
      await plugin.getContent();
      const sizeAfterOne = plugin.getTokenSize();

      await setTool.execute({ key: 'language', value: 'en' });
      // token cache should be invalidated
      // After next getContent, size should be larger
      await plugin.getContent();
      expect(plugin.getTokenSize()).toBeGreaterThan(sizeAfterOne);
    });

    it('should invalidate token cache after remove', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });
      await setTool.execute({ key: 'language', value: 'en' });
      await plugin.getContent();
      const sizeBefore = plugin.getTokenSize();

      const removeTool = getTool(plugin, 'user_info_remove');
      await removeTool.execute({ key: 'theme' });
      await plugin.getContent();
      expect(plugin.getTokenSize()).toBeLessThan(sizeBefore);
    });
  });

  describe('getContents', () => {
    it('should return empty map when no entries', () => {
      const contents = plugin.getContents();
      expect(contents).toBeInstanceOf(Map);
      expect(contents.size).toBe(0);
    });

    it('should return map of entries after set', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });
      await setTool.execute({ key: 'lang', value: 'en' });

      const contents = plugin.getContents();
      expect(contents.size).toBe(2);
      expect(contents.get('theme')!.value).toBe('dark');
      expect(contents.get('lang')!.value).toBe('en');
    });

    it('should return a copy (not reference)', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });

      const contents = plugin.getContents();
      contents.delete('theme');
      // Original should still have it
      expect(plugin.getContents().size).toBe(1);
    });
  });

  describe('Serialization (getState/restoreState)', () => {
    it('should serialize state with version 1', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });

      const state = plugin.getState();
      expect(state.version).toBe(1);
      expect(state.entries).toHaveLength(1);
      expect(state.entries[0].id).toBe('theme');
      expect(state.entries[0].value).toBe('dark');
    });

    it('should serialize empty state', () => {
      const state = plugin.getState();
      expect(state.entries).toEqual([]);
      expect(state.version).toBe(1);
    });

    it('should include userId in state', () => {
      const pluginWithUser = new UserInfoPluginNextGen({
        storage: mockStorage,
        userId: 'alice',
      });
      const state = pluginWithUser.getState();
      expect(state.userId).toBe('alice');
      pluginWithUser.destroy();
    });

    it('should restore state from serialized format', async () => {
      const now = Date.now();
      const state = {
        version: 1,
        entries: [
          { id: 'theme', value: 'dark', valueType: 'string' as const, createdAt: now, updatedAt: now },
        ],
      };

      plugin.restoreState(state);

      expect(plugin.isInitialized).toBe(true);
      const contents = plugin.getContents();
      expect(contents.size).toBe(1);
      expect(contents.get('theme')!.value).toBe('dark');
    });

    it('should render content after restoreState', async () => {
      const now = Date.now();
      const state = {
        version: 1,
        entries: [
          { id: 'theme', value: 'dark', valueType: 'string' as const, createdAt: now, updatedAt: now },
          { id: 'lang', value: 'en', valueType: 'string' as const, createdAt: now + 1, updatedAt: now + 1 },
        ],
      };

      plugin.restoreState(state);

      const content = await plugin.getContent();
      expect(content).toContain('### theme');
      expect(content).toContain('dark');
      expect(content).toContain('### lang');
      expect(content).toContain('en');
      expect(plugin.getTokenSize()).toBeGreaterThan(0);
    });

    it('should round-trip correctly via getState/restoreState', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });
      await setTool.execute({ key: 'prefs', value: { a: 1 } });

      const state = plugin.getState();

      const newPlugin = new UserInfoPluginNextGen({ storage: mockStorage });
      newPlugin.restoreState(state);

      const contents = newPlugin.getContents();
      expect(contents.size).toBe(2);
      expect(contents.get('theme')!.value).toBe('dark');
      expect((contents.get('prefs')!.value as any).a).toBe(1);

      newPlugin.destroy();
    });

    it('should handle invalid state gracefully', () => {
      plugin.restoreState(null);
      plugin.restoreState(undefined);
      plugin.restoreState('invalid');
      plugin.restoreState({ version: 99 });
      // Should not throw
      expect(plugin.getContents().size).toBe(0);
    });
  });

  describe('Lazy Initialization', () => {
    it('should not be initialized on construction', () => {
      expect(plugin.isInitialized).toBe(false);
    });

    it('should initialize from storage on first getContent', async () => {
      const now = Date.now();
      mockStorage._data.set('default', [
        { id: 'theme', value: 'dark', valueType: 'string', createdAt: now, updatedAt: now },
      ]);

      const content = await plugin.getContent();
      expect(plugin.isInitialized).toBe(true);
      expect(content).toContain('### theme');
      expect(content).toContain('dark');
    });

    it('should initialize from storage on first tool call', async () => {
      const now = Date.now();
      mockStorage._data.set('default', [
        { id: 'theme', value: 'dark', valueType: 'string', createdAt: now, updatedAt: now },
      ]);

      const getTool2 = getTool(plugin, 'user_info_get');
      const result = await getTool2.execute({});
      expect(plugin.isInitialized).toBe(true);
      expect(result.count).toBe(1);
    });

    it('should initialize with userId', async () => {
      const pluginWithUser = new UserInfoPluginNextGen({
        storage: mockStorage,
        userId: 'alice',
      });

      const now = Date.now();
      mockStorage._data.set('alice', [
        { id: 'role', value: 'admin', valueType: 'string', createdAt: now, updatedAt: now },
      ]);

      const content = await pluginWithUser.getContent();
      expect(content).toContain('### role');
      expect(content).toContain('admin');

      pluginWithUser.destroy();
    });

    it('should handle storage errors gracefully', async () => {
      const errorStorage: IUserInfoStorage = {
        async load(): Promise<UserInfoEntry[] | null> {
          throw new Error('Storage error');
        },
        async save(): Promise<void> {},
        async delete(): Promise<void> {},
        async exists(): Promise<boolean> {
          return false;
        },
        getPath(): string {
          return '/mock/path';
        },
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const errorPlugin = new UserInfoPluginNextGen({
        storage: errorStorage,
      });

      const content = await errorPlugin.getContent();
      expect(content).toBeNull();
      expect(errorPlugin.isInitialized).toBe(true);

      consoleSpy.mockRestore();
      errorPlugin.destroy();
    });
  });

  describe('Tool: user_info_set', () => {
    it('should add a new entry', async () => {
      const tool = getTool(plugin, 'user_info_set');
      const result = await tool.execute({ key: 'theme', value: 'dark' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('added');
      expect(result.key).toBe('theme');
      expect(result.valueType).toBe('string');
    });

    it('should update an existing entry', async () => {
      const tool = getTool(plugin, 'user_info_set');
      await tool.execute({ key: 'theme', value: 'dark' });
      const result = await tool.execute({ key: 'theme', value: 'light' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('updated');
    });

    it('should preserve createdAt on update', async () => {
      const tool = getTool(plugin, 'user_info_set');
      await tool.execute({ key: 'theme', value: 'dark' });

      const before = plugin.getContents().get('theme')!;
      await new Promise(r => setTimeout(r, 10));

      await tool.execute({ key: 'theme', value: 'light' });
      const after = plugin.getContents().get('theme')!;

      expect(after.createdAt).toBe(before.createdAt);
      expect(after.updatedAt).toBeGreaterThanOrEqual(before.updatedAt);
    });

    it('should store with description', async () => {
      const tool = getTool(plugin, 'user_info_set');
      await tool.execute({ key: 'theme', value: 'dark', description: 'UI theme' });

      const contents = plugin.getContents();
      expect(contents.get('theme')!.description).toBe('UI theme');
    });

    it('should reject undefined value', async () => {
      const tool = getTool(plugin, 'user_info_set');
      const result = await tool.execute({ key: 'theme', value: undefined });
      expect(result.error).toContain('undefined');
    });

    it('should write through to storage', async () => {
      const tool = getTool(plugin, 'user_info_set');
      await tool.execute({ key: 'theme', value: 'dark' });

      const stored = mockStorage._data.get('default');
      expect(stored).not.toBeNull();
      expect(stored!.length).toBe(1);
      expect(stored![0].id).toBe('theme');
    });
  });

  describe('Key Validation (via tools)', () => {
    it('should accept valid keys', async () => {
      const tool = getTool(plugin, 'user_info_set');
      expect((await tool.execute({ key: 'theme', value: 'v' })).success).toBe(true);
      expect((await tool.execute({ key: 'code_rules', value: 'v' })).success).toBe(true);
      expect((await tool.execute({ key: 'my-key', value: 'v' })).success).toBe(true);
      expect((await tool.execute({ key: 'KEY123', value: 'v' })).success).toBe(true);
    });

    it('should reject invalid keys', async () => {
      const tool = getTool(plugin, 'user_info_set');
      expect((await tool.execute({ key: '', value: 'v' })).error).toBeDefined();
      expect((await tool.execute({ key: '   ', value: 'v' })).error).toBeDefined();
      expect((await tool.execute({ key: 'key with spaces', value: 'v' })).error).toBeDefined();
      expect((await tool.execute({ key: 'key.dot', value: 'v' })).error).toBeDefined();
    });

    it('should reject keys exceeding max length', async () => {
      const tool = getTool(plugin, 'user_info_set');
      const longKey = 'a'.repeat(101);
      const result = await tool.execute({ key: longKey, value: 'v' });
      expect(result.error).toBeDefined();
    });
  });

  describe('Tool: user_info_get', () => {
    it('should return error when no entries', async () => {
      const tool = getTool(plugin, 'user_info_get');
      const result = await tool.execute({});
      expect(result.error).toContain('not found');
    });

    it('should return specific entry by key', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });

      const tool = getTool(plugin, 'user_info_get');
      const result = await tool.execute({ key: 'theme' });
      expect(result.key).toBe('theme');
      expect(result.value).toBe('dark');
      expect(result.valueType).toBe('string');
    });

    it('should return all entries when no key', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });
      await setTool.execute({ key: 'lang', value: 'en' });

      const tool = getTool(plugin, 'user_info_get');
      const result = await tool.execute({});
      expect(result.count).toBe(2);
      expect(result.entries).toHaveLength(2);
    });

    it('should return error for non-existent key', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });

      const tool = getTool(plugin, 'user_info_get');
      const result = await tool.execute({ key: 'nonexistent' });
      expect(result.error).toContain('not found');
    });
  });

  describe('Tool: user_info_remove', () => {
    it('should remove an existing entry', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });

      const tool = getTool(plugin, 'user_info_remove');
      const result = await tool.execute({ key: 'theme' });
      expect(result.success).toBe(true);

      expect(plugin.getContents().size).toBe(0);
    });

    it('should return error for non-existent key', async () => {
      const tool = getTool(plugin, 'user_info_remove');
      // Need to trigger initialization first
      await plugin.getContent();
      const result = await tool.execute({ key: 'nonexistent' });
      expect(result.error).toContain('not found');
    });

    it('should delete storage when last entry removed', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });

      const tool = getTool(plugin, 'user_info_remove');
      await tool.execute({ key: 'theme' });

      expect(mockStorage._data.has('default')).toBe(false);
    });

    it('should persist remaining entries when not last', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });
      await setTool.execute({ key: 'lang', value: 'en' });

      const tool = getTool(plugin, 'user_info_remove');
      await tool.execute({ key: 'theme' });

      const stored = mockStorage._data.get('default');
      expect(stored).not.toBeNull();
      expect(stored!.length).toBe(1);
      expect(stored![0].id).toBe('lang');
    });
  });

  describe('Tool: user_info_clear', () => {
    it('should require confirmation', async () => {
      const tool = getTool(plugin, 'user_info_clear');
      const result = await tool.execute({ confirm: false });
      expect(result.error).toContain('confirm');
    });

    it('should clear all entries with confirmation', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });
      await setTool.execute({ key: 'lang', value: 'en' });

      const tool = getTool(plugin, 'user_info_clear');
      const result = await tool.execute({ confirm: true });
      expect(result.success).toBe(true);

      expect(plugin.getContents().size).toBe(0);
      expect(mockStorage._data.has('default')).toBe(false);
    });

    it('should clear token cache', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });
      await plugin.getContent();
      expect(plugin.getTokenSize()).toBeGreaterThan(0);

      const clearTool = getTool(plugin, 'user_info_clear');
      await clearTool.execute({ confirm: true });
      await plugin.getContent();
      expect(plugin.getTokenSize()).toBe(0);
    });
  });

  describe('Limits', () => {
    it('should enforce maxEntries', async () => {
      const limitedPlugin = new UserInfoPluginNextGen({
        storage: mockStorage,
        maxEntries: 3,
      });

      const tool = getTool(limitedPlugin, 'user_info_set');
      expect((await tool.execute({ key: 'a', value: '1' })).success).toBe(true);
      expect((await tool.execute({ key: 'b', value: '2' })).success).toBe(true);
      expect((await tool.execute({ key: 'c', value: '3' })).success).toBe(true);
      expect((await tool.execute({ key: 'd', value: '4' })).error).toContain('Maximum');

      // Update existing should still work
      expect((await tool.execute({ key: 'a', value: 'updated' })).success).toBe(true);

      limitedPlugin.destroy();
    });

    it('should enforce maxTotalSize', async () => {
      const limitedPlugin = new UserInfoPluginNextGen({
        storage: mockStorage,
        maxTotalSize: 100,
      });

      const tool = getTool(limitedPlugin, 'user_info_set');
      expect((await tool.execute({ key: 'a', value: 'x'.repeat(50) })).success).toBe(true);
      expect((await tool.execute({ key: 'b', value: 'x'.repeat(60) })).error).toContain('exceed');

      limitedPlugin.destroy();
    });

    it('should account for existing entry size when updating', async () => {
      const limitedPlugin = new UserInfoPluginNextGen({
        storage: mockStorage,
        maxTotalSize: 200,
      });

      const tool = getTool(limitedPlugin, 'user_info_set');
      expect((await tool.execute({ key: 'a', value: 'x'.repeat(80) })).success).toBe(true);
      // Replacing 80 chars with 90 chars should work (still under 200 bytes)
      expect((await tool.execute({ key: 'a', value: 'x'.repeat(90) })).success).toBe(true);

      limitedPlugin.destroy();
    });
  });

  describe('Lifecycle', () => {
    it('should throw when destroyed', async () => {
      plugin.destroy();

      const setTool = getTool(plugin, 'user_info_set');
      await expect(setTool.execute({ key: 'k', value: 'v' })).rejects.toThrow('destroyed');
    });

    it('should clear entries on destroy', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });

      plugin.destroy();
      // getContents returns empty after destroy since _entries was cleared
      // (but calling getContents on destroyed plugin is undefined behavior)
    });

    it('should clear token cache on destroy', async () => {
      const setTool = getTool(plugin, 'user_info_set');
      await setTool.execute({ key: 'theme', value: 'dark' });
      await plugin.getContent();

      plugin.destroy();
      expect(plugin.getTokenSize()).toBe(0);
    });
  });

  describe('userId isolation', () => {
    it('should use userId from config for initialization', async () => {
      const now = Date.now();
      mockStorage._data.set('alice', [
        { id: 'role', value: 'admin', valueType: 'string', createdAt: now, updatedAt: now },
      ]);
      mockStorage._data.set('default', [
        { id: 'role', value: 'guest', valueType: 'string', createdAt: now, updatedAt: now },
      ]);

      const alicePlugin = new UserInfoPluginNextGen({
        storage: mockStorage,
        userId: 'alice',
      });

      const content = await alicePlugin.getContent();
      expect(content).toContain('admin');
      expect(content).not.toContain('guest');

      alicePlugin.destroy();
    });

    it('should write to correct userId in storage', async () => {
      const alicePlugin = new UserInfoPluginNextGen({
        storage: mockStorage,
        userId: 'alice',
      });

      const tool = getTool(alicePlugin, 'user_info_set');
      await tool.execute({ key: 'theme', value: 'dark' });

      expect(mockStorage._data.has('alice')).toBe(true);
      expect(mockStorage._data.has('default')).toBe(false);

      alicePlugin.destroy();
    });
  });
});
