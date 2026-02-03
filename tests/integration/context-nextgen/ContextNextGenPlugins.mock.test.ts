/**
 * AgentContextNextGen Plugins Integration Tests (Mock LLM)
 *
 * Tests plugin integration with AgentContextNextGen:
 * - WorkingMemoryPluginNextGen
 * - InContextMemoryPluginNextGen
 * - PersistentInstructionsPluginNextGen
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { AgentContextNextGen } from '../../../src/core/context-nextgen/AgentContextNextGen.js';
import type { WorkingMemoryPluginNextGen } from '../../../src/core/context-nextgen/plugins/WorkingMemoryPluginNextGen.js';
import type { InContextMemoryPluginNextGen } from '../../../src/core/context-nextgen/plugins/InContextMemoryPluginNextGen.js';
import type { PersistentInstructionsPluginNextGen } from '../../../src/core/context-nextgen/plugins/PersistentInstructionsPluginNextGen.js';
import {
  createContextWithFeatures,
  safeDestroy,
  FEATURE_PRESETS,
} from '../../helpers/contextTestHelpers.js';

describe('AgentContextNextGen Plugins Integration (Mock)', () => {
  let ctx: AgentContextNextGen | null = null;
  let tempDir: string | null = null;

  beforeEach(async () => {
    // Create temp directory for persistent instructions tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'context-test-'));
    process.env.ONERINGAI_DATA_DIR = tempDir;
  });

  afterEach(async () => {
    safeDestroy(ctx);
    ctx = null;

    // Clean up temp directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      tempDir = null;
    }
    delete process.env.ONERINGAI_DATA_DIR;
  });

  // ============================================================================
  // WorkingMemoryPluginNextGen
  // ============================================================================

  describe('WorkingMemoryPluginNextGen', () => {
    beforeEach(() => {
      ctx = createContextWithFeatures(FEATURE_PRESETS.memoryOnly);
    });

    it('should have memory plugin accessible via ctx.memory', () => {
      expect(ctx!.memory).not.toBeNull();
      expect(ctx!.memory?.name).toBe('working_memory');
    });

    it('should store and retrieve data', async () => {
      const memory = ctx!.memory!;

      await memory.store('user.name', 'User name', 'Alice');
      const value = await memory.retrieve('user.name');

      expect(value).toBe('Alice');
    });

    it('should store data with tiers', async () => {
      const memory = ctx!.memory!;

      // Store in different tiers
      await memory.store('topic', 'Raw data', { raw: true }, { tier: 'raw' });
      await memory.store('topic', 'Summary', { summary: true }, { tier: 'summary' });
      await memory.store('topic', 'Finding', { finding: true }, { tier: 'findings' });

      // Query by tier
      const rawQuery = await memory.query({ tier: 'raw' });
      const summaryQuery = await memory.query({ tier: 'summary' });
      const findingsQuery = await memory.query({ tier: 'findings' });

      expect(rawQuery.entries.length).toBe(1);
      expect(summaryQuery.entries.length).toBe(1);
      expect(findingsQuery.entries.length).toBe(1);
    });

    it('should delete entries', async () => {
      const memory = ctx!.memory!;

      await memory.store('key1', 'Test', 'value1');
      await memory.store('key2', 'Test', 'value2');

      const deleted = await memory.delete('key1');
      expect(deleted).toBe(true);

      const value = await memory.retrieve('key1');
      expect(value).toBeUndefined();
    });

    it('should provide memory index in context', async () => {
      const memory = ctx!.memory!;

      await memory.store('key1', 'Description 1', 'value1');
      await memory.store('key2', 'Description 2', 'value2');

      const content = await memory.getContent();

      expect(content).not.toBeNull();
      expect(content).toContain('key1');
      expect(content).toContain('Description 1');
      expect(content).toContain('key2');
      expect(content).toContain('Description 2');
    });

    it('should provide memory tools', async () => {
      const toolNames = ctx!.tools.getEnabled().map(t => t.definition.function.name);

      expect(toolNames).toContain('memory_store');
      expect(toolNames).toContain('memory_retrieve');
      expect(toolNames).toContain('memory_delete');
      expect(toolNames).toContain('memory_query');
      expect(toolNames).toContain('memory_cleanup_raw');
    });

    it('should execute memory_store tool', async () => {
      const result = await ctx!.tools.execute('memory_store', {
        key: 'test_key',
        description: 'Test description',
        value: { data: 'test' },
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('key', 'test_key');

      // Verify stored
      const retrieved = await ctx!.memory!.retrieve('test_key');
      expect(retrieved).toEqual({ data: 'test' });
    });

    it('should execute memory_retrieve tool', async () => {
      await ctx!.memory!.store('my_key', 'My data', { foo: 'bar' });

      const result = await ctx!.tools.execute('memory_retrieve', { key: 'my_key' });

      expect(result).toHaveProperty('found', true);
      expect(result).toHaveProperty('value', { foo: 'bar' });
    });

    it('should cleanup raw tier entries', async () => {
      const memory = ctx!.memory!;

      await memory.store('item1', 'Raw item', 'value1', { tier: 'raw' });
      await memory.store('item2', 'Raw item', 'value2', { tier: 'raw' });
      await memory.store('item3', 'Summary', 'value3', { tier: 'summary' });

      const result = await memory.cleanupRaw();

      expect(result.deleted).toBe(2);

      // Raw items should be gone
      const rawQuery = await memory.query({ tier: 'raw' });
      expect(rawQuery.entries.length).toBe(0);

      // Summary should remain
      const summaryQuery = await memory.query({ tier: 'summary' });
      expect(summaryQuery.entries.length).toBe(1);
    });

    it('should include instructions in system message', async () => {
      ctx!.addUserMessage('test');
      const { input } = await ctx!.prepare();

      // Get system message content
      const systemMsg = input[0] as any;
      const text = systemMsg.content[0].text;

      expect(text).toContain('Working Memory');
      expect(text).toContain('memory_store');
      expect(text).toContain('memory_retrieve');
    });
  });

  // ============================================================================
  // InContextMemoryPluginNextGen
  // ============================================================================

  describe('InContextMemoryPluginNextGen', () => {
    beforeEach(() => {
      ctx = createContextWithFeatures(FEATURE_PRESETS.inContextOnly);
    });

    it('should get plugin via getPlugin', () => {
      const plugin = ctx!.getPlugin<InContextMemoryPluginNextGen>('in_context_memory');
      expect(plugin).not.toBeNull();
      expect(plugin?.name).toBe('in_context_memory');
    });

    it('should store values directly in context', async () => {
      const plugin = ctx!.getPlugin<InContextMemoryPluginNextGen>('in_context_memory')!;

      plugin.set('state', 'Current state', { step: 1, status: 'running' });

      const content = await plugin.getContent();

      expect(content).not.toBeNull();
      expect(content).toContain('state');
      expect(content).toContain('Current state');
      // Value should be visible directly (unlike WorkingMemory which shows only index)
      expect(content).toContain('step');
      expect(content).toContain('running');
    });

    it('should get and has methods work', () => {
      const plugin = ctx!.getPlugin<InContextMemoryPluginNextGen>('in_context_memory')!;

      plugin.set('key1', 'Test', 'value1');

      expect(plugin.has('key1')).toBe(true);
      expect(plugin.has('nonexistent')).toBe(false);
      expect(plugin.get('key1')).toBe('value1');
      expect(plugin.get('nonexistent')).toBeUndefined();
    });

    it('should delete entries', () => {
      const plugin = ctx!.getPlugin<InContextMemoryPluginNextGen>('in_context_memory')!;

      plugin.set('key1', 'Test', 'value1');
      expect(plugin.delete('key1')).toBe(true);
      expect(plugin.has('key1')).toBe(false);
      expect(plugin.delete('key1')).toBe(false); // Already deleted
    });

    it('should list entries', () => {
      const plugin = ctx!.getPlugin<InContextMemoryPluginNextGen>('in_context_memory')!;

      plugin.set('key1', 'Desc 1', 'value1', 'high');
      plugin.set('key2', 'Desc 2', 'value2', 'low');

      const list = plugin.list();

      expect(list.length).toBe(2);
      expect(list.find(e => e.key === 'key1')?.priority).toBe('high');
      expect(list.find(e => e.key === 'key2')?.priority).toBe('low');
    });

    it('should clear all entries', () => {
      const plugin = ctx!.getPlugin<InContextMemoryPluginNextGen>('in_context_memory')!;

      plugin.set('key1', 'Test', 'value1');
      plugin.set('key2', 'Test', 'value2');

      plugin.clear();

      expect(plugin.list().length).toBe(0);
    });

    it('should provide context tools', () => {
      const toolNames = ctx!.tools.getEnabled().map(t => t.definition.function.name);

      expect(toolNames).toContain('context_set');
      expect(toolNames).toContain('context_delete');
      expect(toolNames).toContain('context_list');
    });

    it('should execute context_set tool', async () => {
      const result = await ctx!.tools.execute('context_set', {
        key: 'my_state',
        description: 'Application state',
        value: { mode: 'active' },
        priority: 'high',
      });

      expect(result).toHaveProperty('success', true);

      const plugin = ctx!.getPlugin<InContextMemoryPluginNextGen>('in_context_memory')!;
      expect(plugin.get('my_state')).toEqual({ mode: 'active' });
    });

    it('should execute context_delete tool', async () => {
      const plugin = ctx!.getPlugin<InContextMemoryPluginNextGen>('in_context_memory')!;
      plugin.set('to_delete', 'Will be deleted', 'value');

      const result = await ctx!.tools.execute('context_delete', { key: 'to_delete' });

      expect(result).toHaveProperty('deleted', true);
      expect(plugin.has('to_delete')).toBe(false);
    });

    it('should execute context_list tool', async () => {
      const plugin = ctx!.getPlugin<InContextMemoryPluginNextGen>('in_context_memory')!;
      plugin.set('key1', 'Desc 1', 'value1');
      plugin.set('key2', 'Desc 2', 'value2');

      const result = await ctx!.tools.execute('context_list', {});

      expect(result).toHaveProperty('entries');
      expect(result.entries.length).toBe(2);
    });

    it('should include values in prepared context', async () => {
      const plugin = ctx!.getPlugin<InContextMemoryPluginNextGen>('in_context_memory')!;
      plugin.set('live_data', 'Live data entry', { count: 42 });

      ctx!.addUserMessage('test');
      const { input } = await ctx!.prepare();

      const systemMsg = input[0] as any;
      const text = systemMsg.content[0].text;

      expect(text).toContain('live_data');
      expect(text).toContain('42');
    });
  });

  // ============================================================================
  // PersistentInstructionsPluginNextGen
  // ============================================================================

  describe('PersistentInstructionsPluginNextGen', () => {
    beforeEach(() => {
      ctx = createContextWithFeatures(
        { workingMemory: false, inContextMemory: false, persistentInstructions: true },
        { agentId: 'test-agent-instructions' }
      );
    });

    it('should auto-generate agentId if not provided for persistent instructions', () => {
      // AgentContextNextGen auto-generates an agentId if not provided
      // So creating context with persistentInstructions=true without agentId should work
      const testCtx = AgentContextNextGen.create({
        model: 'gpt-4',
        features: { workingMemory: false, inContextMemory: false, persistentInstructions: true },
        // No agentId provided - should auto-generate
      });

      // Should have generated an agentId
      expect(testCtx.agentId).toBeTruthy();
      expect(testCtx.hasPlugin('persistent_instructions')).toBe(true);

      safeDestroy(testCtx);
    });

    it('should get plugin via getPlugin', () => {
      const plugin = ctx!.getPlugin<PersistentInstructionsPluginNextGen>('persistent_instructions');
      expect(plugin).not.toBeNull();
      expect(plugin?.name).toBe('persistent_instructions');
    });

    it('should set and get instructions', async () => {
      const plugin = ctx!.getPlugin<PersistentInstructionsPluginNextGen>('persistent_instructions')!;

      await plugin.set('Always be helpful and concise.');
      const instructions = await plugin.get();

      expect(instructions).toBe('Always be helpful and concise.');
    });

    it('should append to instructions', async () => {
      const plugin = ctx!.getPlugin<PersistentInstructionsPluginNextGen>('persistent_instructions')!;

      await plugin.set('Rule 1: Be helpful.');
      await plugin.append('Rule 2: Be concise.');

      const instructions = await plugin.get();

      expect(instructions).toContain('Rule 1');
      expect(instructions).toContain('Rule 2');
    });

    it('should clear instructions', async () => {
      const plugin = ctx!.getPlugin<PersistentInstructionsPluginNextGen>('persistent_instructions')!;

      await plugin.set('Some instructions');
      await plugin.clear();

      const instructions = await plugin.get();

      // clear() sets content to null (not empty string)
      expect(instructions).toBeNull();
    });

    it('should provide instructions tools', () => {
      const toolNames = ctx!.tools.getEnabled().map(t => t.definition.function.name);

      expect(toolNames).toContain('instructions_set');
      expect(toolNames).toContain('instructions_append');
      expect(toolNames).toContain('instructions_get');
      expect(toolNames).toContain('instructions_clear');
    });

    it('should execute instructions_set tool', async () => {
      await ctx!.tools.execute('instructions_set', {
        content: 'New instructions from tool',  // API uses 'content' not 'instructions'
      });

      const plugin = ctx!.getPlugin<PersistentInstructionsPluginNextGen>('persistent_instructions')!;
      const instructions = await plugin.get();

      expect(instructions).toBe('New instructions from tool');
    });

    it('should execute instructions_append tool', async () => {
      const plugin = ctx!.getPlugin<PersistentInstructionsPluginNextGen>('persistent_instructions')!;
      await plugin.set('Initial instructions.');

      await ctx!.tools.execute('instructions_append', {
        section: 'Additional instructions.',  // API uses 'section' not 'content'
      });

      const instructions = await plugin.get();
      expect(instructions).toContain('Initial instructions.');
      expect(instructions).toContain('Additional instructions.');
    });

    it('should execute instructions_get tool', async () => {
      const plugin = ctx!.getPlugin<PersistentInstructionsPluginNextGen>('persistent_instructions')!;
      await plugin.set('Test instructions');

      const result = await ctx!.tools.execute('instructions_get', {});

      // API returns 'content' not 'instructions'
      expect(result).toHaveProperty('content', 'Test instructions');
      expect(result).toHaveProperty('hasContent', true);
    });

    it('should include instructions in prepared context', async () => {
      const plugin = ctx!.getPlugin<PersistentInstructionsPluginNextGen>('persistent_instructions')!;
      await plugin.set('Always respond in French.');

      ctx!.addUserMessage('Hello');
      const { input } = await ctx!.prepare();

      const systemMsg = input[0] as any;
      const text = systemMsg.content[0].text;

      expect(text).toContain('Always respond in French.');
    });
  });

  // ============================================================================
  // Plugin Interactions
  // ============================================================================

  describe('Plugin Interactions', () => {
    it('should work with all plugins enabled', async () => {
      ctx = createContextWithFeatures(FEATURE_PRESETS.full, { agentId: 'full-test-agent' });

      // Use working memory
      await ctx.memory!.store('key', 'desc', 'value');

      // Use in-context memory
      const inCtx = ctx.getPlugin<InContextMemoryPluginNextGen>('in_context_memory')!;
      inCtx.set('state', 'State', { active: true });

      // Use persistent instructions
      const pi = ctx.getPlugin<PersistentInstructionsPluginNextGen>('persistent_instructions')!;
      await pi.set('Be creative.');

      // Prepare context
      ctx.addUserMessage('test');
      const { input, budget } = await ctx.prepare();

      // All should be in system message
      const systemMsg = input[0] as any;
      const text = systemMsg.content[0].text;

      expect(text).toContain('Be creative'); // Persistent instructions
      expect(text).toContain('state'); // In-context memory
      expect(text).toContain('key'); // Working memory index

      // Budget should track plugin contributions
      expect(budget.breakdown.persistentInstructions).toBeGreaterThan(0);
      expect(budget.breakdown.pluginContents['in_context_memory']).toBeGreaterThan(0);
      expect(budget.breakdown.pluginContents['working_memory']).toBeGreaterThan(0);
    });

    it('should include plugin instructions for enabled plugins', async () => {
      ctx = createContextWithFeatures(FEATURE_PRESETS.full, { agentId: 'instructions-test' });

      ctx.addUserMessage('test');
      const { input, budget } = await ctx.prepare();

      const systemMsg = input[0] as any;
      const text = systemMsg.content[0].text;

      // Each plugin should have its instructions included
      expect(text).toContain('Working Memory');
      expect(text).toContain('In-Context Memory');

      // Plugin instructions tokens should be tracked
      expect(budget.breakdown.pluginInstructions).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Plugin State Serialization
  // ============================================================================

  describe('Plugin State Serialization', () => {
    it('should serialize and restore working memory state', async () => {
      ctx = createContextWithFeatures(FEATURE_PRESETS.memoryOnly);

      // Store some data
      await ctx.memory!.store('key1', 'Desc 1', 'value1');
      await ctx.memory!.store('key2', 'Desc 2', { nested: 'data' });

      // Get state
      const state = await ctx.memory!.getStateAsync();

      // Create new context and restore
      const ctx2 = createContextWithFeatures(FEATURE_PRESETS.memoryOnly);
      ctx2.memory!.restoreState(state);

      // Verify restored
      const value1 = await ctx2.memory!.retrieve('key1');
      const value2 = await ctx2.memory!.retrieve('key2');

      expect(value1).toBe('value1');
      expect(value2).toEqual({ nested: 'data' });

      safeDestroy(ctx2);
    });

    it('should serialize in-context memory state', () => {
      ctx = createContextWithFeatures(FEATURE_PRESETS.inContextOnly);
      const plugin = ctx.getPlugin<InContextMemoryPluginNextGen>('in_context_memory')!;

      plugin.set('key1', 'Desc 1', 'value1', 'high');
      plugin.set('key2', 'Desc 2', 'value2', 'low');

      const state = plugin.getState() as any;

      expect(state.entries).toHaveLength(2);
      expect(state.entries.find((e: any) => e.key === 'key1')).toBeDefined();
    });
  });
});
