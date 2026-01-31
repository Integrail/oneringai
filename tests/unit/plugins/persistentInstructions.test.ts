/**
 * Tests for PersistentInstructionsPlugin
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { PersistentInstructionsPlugin } from '../../../src/core/context/plugins/PersistentInstructionsPlugin.js';
import { FilePersistentInstructionsStorage } from '../../../src/infrastructure/storage/FilePersistentInstructionsStorage.js';
import { createPersistentInstructions, setupPersistentInstructions } from '../../../src/core/context/plugins/persistentInstructionsTools.js';
import { AgentContext } from '../../../src/core/AgentContext.js';

describe('PersistentInstructionsPlugin', () => {
  let testDir: string;
  let plugin: PersistentInstructionsPlugin;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `persistent-instructions-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create plugin with custom storage pointing to test directory
    const storage = new FilePersistentInstructionsStorage({
      agentId: 'test-agent',
      baseDirectory: testDir,
    });
    plugin = new PersistentInstructionsPlugin({
      agentId: 'test-agent',
      storage,
    });
  });

  afterEach(async () => {
    // Clean up
    plugin.destroy();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('basic operations', () => {
    it('should start with no instructions', async () => {
      await plugin.initialize();
      expect(plugin.has()).toBe(false);
      expect(plugin.get()).toBeNull();
    });

    it('should set and get instructions', async () => {
      await plugin.initialize();

      const success = await plugin.set('Test instructions');
      expect(success).toBe(true);
      expect(plugin.has()).toBe(true);
      expect(plugin.get()).toBe('Test instructions');
    });

    it('should append to instructions', async () => {
      await plugin.initialize();

      await plugin.set('First section');
      const success = await plugin.append('Second section');

      expect(success).toBe(true);
      expect(plugin.get()).toBe('First section\n\nSecond section');
    });

    it('should append to empty instructions', async () => {
      await plugin.initialize();

      const success = await plugin.append('First section');

      expect(success).toBe(true);
      expect(plugin.get()).toBe('First section');
    });

    it('should clear instructions', async () => {
      await plugin.initialize();

      await plugin.set('Test instructions');
      await plugin.clear();

      expect(plugin.has()).toBe(false);
      expect(plugin.get()).toBeNull();
    });
  });

  describe('persistence', () => {
    it('should persist instructions to disk', async () => {
      await plugin.initialize();
      await plugin.set('Persisted instructions');

      // Create a new plugin instance pointing to the same storage
      const storage2 = new FilePersistentInstructionsStorage({
        agentId: 'test-agent',
        baseDirectory: testDir,
      });
      const plugin2 = new PersistentInstructionsPlugin({
        agentId: 'test-agent',
        storage: storage2,
      });

      await plugin2.initialize();

      expect(plugin2.get()).toBe('Persisted instructions');
      plugin2.destroy();
    });

    it('should handle missing file gracefully', async () => {
      await plugin.initialize();

      // File doesn't exist, should return null
      expect(plugin.get()).toBeNull();
    });
  });

  describe('length limits', () => {
    it('should respect max length for set', async () => {
      const shortPlugin = new PersistentInstructionsPlugin({
        agentId: 'test-short',
        maxLength: 10,
        storage: new FilePersistentInstructionsStorage({
          agentId: 'test-short',
          baseDirectory: testDir,
        }),
      });

      await shortPlugin.initialize();

      const success = await shortPlugin.set('This is way too long');
      expect(success).toBe(false);
      expect(shortPlugin.get()).toBeNull();

      shortPlugin.destroy();
    });

    it('should respect max length for append', async () => {
      const shortPlugin = new PersistentInstructionsPlugin({
        agentId: 'test-short',
        maxLength: 20,
        storage: new FilePersistentInstructionsStorage({
          agentId: 'test-short',
          baseDirectory: testDir,
        }),
      });

      await shortPlugin.initialize();
      await shortPlugin.set('Hello');

      const success = await shortPlugin.append('This is a very long section');
      expect(success).toBe(false);
      expect(shortPlugin.get()).toBe('Hello'); // Original unchanged

      shortPlugin.destroy();
    });
  });

  describe('context component', () => {
    it('should return null component when no instructions', async () => {
      const component = await plugin.getComponent();
      expect(component).toBeNull();
    });

    it('should return component with instructions and explanation', async () => {
      await plugin.initialize();
      await plugin.set('Test instructions');

      const component = await plugin.getComponent();

      expect(component).not.toBeNull();
      expect(component!.name).toBe('persistent_instructions');
      expect(component!.priority).toBe(0);
      expect(component!.compactable).toBe(false);
      expect(component!.content).toContain('Test instructions');
      expect(component!.content).toContain('## Custom Instructions');
      // Should include explanation for the LLM
      expect(component!.content).toContain('persistent instructions');
      expect(component!.content).toContain('instructions_set');
      expect(component!.content).toContain('instructions_append');
      expect(component!.content).toContain('Storage path:');
    });

    it('should perform lazy initialization in getComponent', async () => {
      // Set instructions manually in storage
      const filePath = join(testDir, 'test-agent', 'custom_instructions.md');
      await fs.mkdir(join(testDir, 'test-agent'), { recursive: true });
      await fs.writeFile(filePath, 'Pre-existing instructions', 'utf-8');

      // Don't call initialize() - let getComponent do it
      const component = await plugin.getComponent();

      expect(component).not.toBeNull();
      expect(component!.content).toContain('Pre-existing instructions');
    });
  });

  describe('serialization', () => {
    it('should serialize and restore state', async () => {
      await plugin.initialize();
      await plugin.set('Serialized content');

      const state = plugin.getState();

      expect(state.content).toBe('Serialized content');
      expect(state.agentId).toBe('test-agent');

      // Create new plugin and restore
      const newPlugin = new PersistentInstructionsPlugin({
        agentId: 'test-agent',
        storage: new FilePersistentInstructionsStorage({
          agentId: 'test-agent',
          baseDirectory: testDir,
        }),
      });

      newPlugin.restoreState(state);

      expect(newPlugin.get()).toBe('Serialized content');
      newPlugin.destroy();
    });
  });
});

describe('FilePersistentInstructionsStorage', () => {
  let testDir: string;
  let storage: FilePersistentInstructionsStorage;

  beforeEach(async () => {
    testDir = join(tmpdir(), `storage-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    storage = new FilePersistentInstructionsStorage({
      agentId: 'test-agent',
      baseDirectory: testDir,
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should sanitize agent ID for directory name', () => {
    const unsafeStorage = new FilePersistentInstructionsStorage({
      agentId: 'My Agent/With\\Special:Chars?',
      baseDirectory: testDir,
    });

    const path = unsafeStorage.getPath();
    // Extract the agent directory name from the path
    const pathParts = path.split('/');
    const agentDirIndex = pathParts.findIndex(p => p.includes('agent'));
    const agentDir = pathParts[agentDirIndex] || pathParts[pathParts.length - 2];

    // The sanitized directory should only contain safe characters
    expect(agentDir).toMatch(/^[a-z0-9_-]+$/);
    // Should not contain the original unsafe characters
    expect(agentDir).not.toContain(' ');
    expect(agentDir).not.toContain('?');
    expect(agentDir).not.toContain(':');
  });

  it('should create directory on save', async () => {
    await storage.save('Content');

    const exists = await storage.exists();
    expect(exists).toBe(true);
  });

  it('should handle atomic writes', async () => {
    // Save content
    await storage.save('Content');

    // Verify no temp file remains
    const files = await fs.readdir(join(testDir, 'test-agent'));
    expect(files).toHaveLength(1);
    expect(files[0]).toBe('custom_instructions.md');
  });
});

describe('createPersistentInstructions factory', () => {
  it('should create plugin and tools', () => {
    const { plugin, tools } = createPersistentInstructions({
      agentId: 'factory-test',
    });

    expect(plugin).toBeInstanceOf(PersistentInstructionsPlugin);
    expect(tools).toHaveLength(4);

    const toolNames = tools.map(t => t.definition.function.name);
    expect(toolNames).toContain('instructions_set');
    expect(toolNames).toContain('instructions_append');
    expect(toolNames).toContain('instructions_get');
    expect(toolNames).toContain('instructions_clear');

    plugin.destroy();
  });
});

describe('AgentContext integration', () => {
  it('should enable persistentInstructions feature', () => {
    const ctx = AgentContext.create({
      model: 'gpt-4',
      agentId: 'integration-test',
      features: {
        persistentInstructions: true,
      },
    });

    expect(ctx.isFeatureEnabled('persistentInstructions')).toBe(true);
    expect(ctx.persistentInstructions).not.toBeNull();
    expect(ctx.agentId).toBe('integration-test');

    // Check tools are registered
    const toolNames = ctx.tools.getAll().map(t => t.definition.function.name);
    expect(toolNames).toContain('instructions_set');
    expect(toolNames).toContain('instructions_get');
    expect(toolNames).toContain('instructions_append');
    expect(toolNames).toContain('instructions_clear');

    ctx.destroy();
  });

  it('should not enable persistentInstructions by default', () => {
    const ctx = AgentContext.create({
      model: 'gpt-4',
    });

    expect(ctx.isFeatureEnabled('persistentInstructions')).toBe(false);
    expect(ctx.persistentInstructions).toBeNull();

    ctx.destroy();
  });

  it('should auto-generate agentId if not provided', () => {
    const ctx = AgentContext.create({
      model: 'gpt-4',
      features: {
        persistentInstructions: true,
      },
    });

    expect(ctx.agentId).toMatch(/^agent-\d+-[a-z0-9]+$/);
    ctx.destroy();
  });
});
