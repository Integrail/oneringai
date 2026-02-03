/**
 * PersistentInstructionsPluginNextGen Unit Tests
 *
 * Tests for the NextGen persistent instructions plugin covering:
 * - Core operations (set, append, get, clear)
 * - Maximum length enforcement
 * - Lazy initialization
 * - Non-compactable behavior
 * - Serialization/deserialization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PersistentInstructionsPluginNextGen } from '@/core/context-nextgen/plugins/PersistentInstructionsPluginNextGen.js';
import type { PersistentInstructionsConfig } from '@/core/context-nextgen/plugins/PersistentInstructionsPluginNextGen.js';
import type { IPersistentInstructionsStorage } from '@/domain/interfaces/IPersistentInstructionsStorage.js';

/**
 * Create a mock storage implementation for testing
 */
function createMockStorage(): IPersistentInstructionsStorage & { _content: string | null } {
  return {
    _content: null,
    async load(): Promise<string | null> {
      return this._content;
    },
    async save(content: string): Promise<void> {
      this._content = content;
    },
    async delete(): Promise<void> {
      this._content = null;
    },
    async exists(): Promise<boolean> {
      return this._content !== null;
    },
    getPath(): string {
      return '/mock/path/instructions.md';
    },
  };
}

describe('PersistentInstructionsPluginNextGen', () => {
  let plugin: PersistentInstructionsPluginNextGen;
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    plugin = new PersistentInstructionsPluginNextGen({
      agentId: 'test-agent',
      storage: mockStorage,
    });
  });

  afterEach(() => {
    plugin.destroy();
  });

  describe('Plugin Interface', () => {
    it('should have correct name', () => {
      expect(plugin.name).toBe('persistent_instructions');
    });

    it('should provide instructions', () => {
      const instructions = plugin.getInstructions();
      expect(instructions).toContain('Persistent Instructions');
      expect(instructions).toContain('instructions_set');
    });

    it('should NOT be compactable', () => {
      expect(plugin.isCompactable()).toBe(false);
    });

    it('should return 0 tokens freed on compact', async () => {
      await plugin.set('Some content');
      const freed = await plugin.compact(1000);
      expect(freed).toBe(0);
    });

    it('should provide 4 tools', () => {
      const tools = plugin.getTools();
      expect(tools).toHaveLength(4);

      const toolNames = tools.map(t => t.definition.function.name);
      expect(toolNames).toContain('instructions_set');
      expect(toolNames).toContain('instructions_append');
      expect(toolNames).toContain('instructions_get');
      expect(toolNames).toContain('instructions_clear');
    });

    it('should require agentId', () => {
      expect(() => {
        // @ts-expect-error - Testing invalid config
        new PersistentInstructionsPluginNextGen({});
      }).toThrow('requires agentId');
    });
  });

  describe('Set Operation', () => {
    it('should set content', async () => {
      const success = await plugin.set('My custom instructions');
      expect(success).toBe(true);

      const content = await plugin.get();
      expect(content).toBe('My custom instructions');
    });

    it('should replace existing content', async () => {
      await plugin.set('First content');
      await plugin.set('Second content');

      const content = await plugin.get();
      expect(content).toBe('Second content');
    });

    it('should trim whitespace', async () => {
      await plugin.set('  Content with whitespace  ');

      const content = await plugin.get();
      expect(content).toBe('Content with whitespace');
    });

    it('should set null for empty content', async () => {
      await plugin.set('Some content');
      await plugin.set('   ');

      const content = await plugin.get();
      expect(content).toBeNull();
    });

    it('should enforce max length', async () => {
      const longContent = 'x'.repeat(60000);
      const success = await plugin.set(longContent);

      expect(success).toBe(false);
    });

    it('should persist to storage', async () => {
      await plugin.set('Persisted content');

      expect(mockStorage._content).toBe('Persisted content');
    });
  });

  describe('Append Operation', () => {
    it('should append to existing content', async () => {
      await plugin.set('First section');
      await plugin.append('Second section');

      const content = await plugin.get();
      expect(content).toBe('First section\n\nSecond section');
    });

    it('should start fresh when no existing content', async () => {
      await plugin.append('New section');

      const content = await plugin.get();
      expect(content).toBe('New section');
    });

    it('should trim appended content', async () => {
      await plugin.set('Base');
      await plugin.append('  Appended  ');

      const content = await plugin.get();
      expect(content).toBe('Base\n\nAppended');
    });

    it('should return true for empty append', async () => {
      await plugin.set('Base');
      const success = await plugin.append('   ');

      expect(success).toBe(true);
    });

    it('should enforce max length on append', async () => {
      await plugin.set('Short');
      const longAppend = 'x'.repeat(60000);
      const success = await plugin.append(longAppend);

      expect(success).toBe(false);
    });
  });

  describe('Get Operation', () => {
    it('should return null when no content', async () => {
      const content = await plugin.get();
      expect(content).toBeNull();
    });

    it('should return content after set', async () => {
      await plugin.set('My content');

      const content = await plugin.get();
      expect(content).toBe('My content');
    });
  });

  describe('Clear Operation', () => {
    it('should clear content', async () => {
      await plugin.set('Content to clear');
      await plugin.clear();

      const content = await plugin.get();
      expect(content).toBeNull();
    });

    it('should delete from storage', async () => {
      await plugin.set('Will be deleted');
      await plugin.clear();

      expect(mockStorage._content).toBeNull();
    });
  });

  describe('Lazy Initialization', () => {
    it('should initialize from storage on first access', async () => {
      mockStorage._content = 'Preloaded content';

      // New plugin should load from storage
      const newPlugin = new PersistentInstructionsPluginNextGen({
        agentId: 'test-agent',
        storage: mockStorage,
      });

      expect(newPlugin.isInitialized).toBe(false);

      const content = await newPlugin.get();
      expect(content).toBe('Preloaded content');
      expect(newPlugin.isInitialized).toBe(true);

      newPlugin.destroy();
    });

    it('should handle storage errors gracefully', async () => {
      const errorStorage: IPersistentInstructionsStorage = {
        async load(): Promise<string | null> {
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

      const errorPlugin = new PersistentInstructionsPluginNextGen({
        agentId: 'test-agent',
        storage: errorStorage,
      });

      const content = await errorPlugin.get();
      expect(content).toBeNull();

      consoleSpy.mockRestore();
      errorPlugin.destroy();
    });
  });

  describe('Content for Context', () => {
    it('should return null when no content', async () => {
      const content = await plugin.getContent();
      expect(content).toBeNull();
    });

    it('should return content when set', async () => {
      await plugin.set('Instructions content');

      const content = await plugin.getContent();
      expect(content).toBe('Instructions content');
    });

    it('should track token size', async () => {
      expect(plugin.getTokenSize()).toBe(0);

      await plugin.set('Some instructions content here');
      await plugin.getContent(); // Triggers token calculation

      expect(plugin.getTokenSize()).toBeGreaterThan(0);
    });
  });

  describe('Serialization', () => {
    it('should serialize state', async () => {
      await plugin.set('Serialized content');

      const state = plugin.getState();

      expect(state.content).toBe('Serialized content');
      expect(state.agentId).toBe('test-agent');
    });

    it('should serialize null content', async () => {
      const state = plugin.getState();
      expect(state.content).toBeNull();
    });

    it('should restore state', async () => {
      const state = {
        content: 'Restored content',
        agentId: 'test-agent',
      };

      plugin.restoreState(state);

      const content = await plugin.get();
      expect(content).toBe('Restored content');
      expect(plugin.isInitialized).toBe(true);
    });
  });

  describe('Lifecycle', () => {
    it('should throw when destroyed', async () => {
      plugin.destroy();

      await expect(plugin.set('content')).rejects.toThrow('destroyed');
      await expect(plugin.get()).rejects.toThrow('destroyed');
      await expect(plugin.clear()).rejects.toThrow('destroyed');
    });
  });

  describe('Tool Execution', () => {
    it('should execute instructions_set tool', async () => {
      const tools = plugin.getTools();
      const setTool = tools.find(t => t.definition.function.name === 'instructions_set')!;

      const result = await setTool.execute({
        content: 'Tool-set content',
      });

      expect(result.success).toBe(true);
      expect(result.length).toBe('Tool-set content'.length);

      const content = await plugin.get();
      expect(content).toBe('Tool-set content');
    });

    it('should reject empty content in instructions_set', async () => {
      const tools = plugin.getTools();
      const setTool = tools.find(t => t.definition.function.name === 'instructions_set')!;

      const result = await setTool.execute({ content: '' });
      expect(result.error).toContain('empty');
    });

    it('should execute instructions_append tool', async () => {
      await plugin.set('Base content');

      const tools = plugin.getTools();
      const appendTool = tools.find(t => t.definition.function.name === 'instructions_append')!;

      const result = await appendTool.execute({
        section: 'Appended section',
      });

      expect(result.success).toBe(true);

      const content = await plugin.get();
      expect(content).toContain('Base content');
      expect(content).toContain('Appended section');
    });

    it('should execute instructions_get tool', async () => {
      await plugin.set('Get this content');

      const tools = plugin.getTools();
      const getTool = tools.find(t => t.definition.function.name === 'instructions_get')!;

      const result = await getTool.execute({});

      expect(result.hasContent).toBe(true);
      expect(result.content).toBe('Get this content');
      expect(result.length).toBe('Get this content'.length);
    });

    it('should execute instructions_clear tool with confirmation', async () => {
      await plugin.set('Content to clear');

      const tools = plugin.getTools();
      const clearTool = tools.find(t => t.definition.function.name === 'instructions_clear')!;

      // Without confirmation
      const failResult = await clearTool.execute({ confirm: false });
      expect(failResult.error).toContain('confirm');

      // With confirmation
      const successResult = await clearTool.execute({ confirm: true });
      expect(successResult.success).toBe(true);

      const content = await plugin.get();
      expect(content).toBeNull();
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom max length', async () => {
      const customPlugin = new PersistentInstructionsPluginNextGen({
        agentId: 'test-agent',
        storage: mockStorage,
        maxLength: 100,
      });

      const longContent = 'x'.repeat(150);
      const success = await customPlugin.set(longContent);
      expect(success).toBe(false);

      const shortContent = 'x'.repeat(50);
      const successShort = await customPlugin.set(shortContent);
      expect(successShort).toBe(true);

      customPlugin.destroy();
    });
  });
});
