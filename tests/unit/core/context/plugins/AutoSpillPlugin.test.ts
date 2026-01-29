/**
 * AutoSpillPlugin Tests
 * Tests for automatic large output spilling to memory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutoSpillPlugin, AutoSpillConfig, SpilledEntry } from '@/core/context/plugins/AutoSpillPlugin.js';
import { WorkingMemory } from '@/capabilities/taskAgent/WorkingMemory.js';
import { InMemoryStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import type { WorkingMemoryConfig } from '@/domain/entities/Memory.js';

describe('AutoSpillPlugin', () => {
  let memory: WorkingMemory;
  let plugin: AutoSpillPlugin;

  const defaultConfig: WorkingMemoryConfig = {
    maxSizeBytes: 100 * 1024, // 100KB for testing
    descriptionMaxLength: 150,
    softLimitPercent: 80,
    contextAllocationPercent: 20,
  };

  beforeEach(() => {
    const storage = new InMemoryStorage();
    memory = new WorkingMemory(storage, defaultConfig);
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      plugin = new AutoSpillPlugin(memory);
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('auto_spill_tracker');
    });

    it('should create instance with custom config', () => {
      plugin = new AutoSpillPlugin(memory, {
        sizeThreshold: 5000,
        tools: ['web_fetch'],
        maxTrackedEntries: 50,
      });
      expect(plugin).toBeDefined();
    });

    it('should have correct priority', () => {
      plugin = new AutoSpillPlugin(memory);
      expect(plugin.priority).toBe(9);
    });

    it('should be compactable', () => {
      plugin = new AutoSpillPlugin(memory);
      expect(plugin.compactable).toBe(true);
    });
  });

  describe('shouldSpill', () => {
    it('should return false for outputs below threshold', () => {
      plugin = new AutoSpillPlugin(memory, { sizeThreshold: 10000 });
      expect(plugin.shouldSpill('any_tool', 5000)).toBe(false);
    });

    it('should return true for outputs above threshold when no tool filter', () => {
      plugin = new AutoSpillPlugin(memory, { sizeThreshold: 10000 });
      expect(plugin.shouldSpill('any_tool', 15000)).toBe(true);
    });

    it('should check tool names when tools array is provided', () => {
      plugin = new AutoSpillPlugin(memory, {
        sizeThreshold: 1000,
        tools: ['web_fetch', 'web_scrape'],
      });

      expect(plugin.shouldSpill('web_fetch', 2000)).toBe(true);
      expect(plugin.shouldSpill('web_scrape', 2000)).toBe(true);
      expect(plugin.shouldSpill('other_tool', 2000)).toBe(false);
    });

    it('should check tool patterns when toolPatterns is provided', () => {
      plugin = new AutoSpillPlugin(memory, {
        sizeThreshold: 1000,
        toolPatterns: [/^web_/, /^research_/],
      });

      expect(plugin.shouldSpill('web_fetch', 2000)).toBe(true);
      expect(plugin.shouldSpill('web_scrape', 2000)).toBe(true);
      expect(plugin.shouldSpill('research_search', 2000)).toBe(true);
      expect(plugin.shouldSpill('other_tool', 2000)).toBe(false);
    });

    it('should spill all large outputs when no tools or patterns configured', () => {
      plugin = new AutoSpillPlugin(memory, { sizeThreshold: 1000 });

      expect(plugin.shouldSpill('any_tool', 2000)).toBe(true);
      expect(plugin.shouldSpill('another_tool', 2000)).toBe(true);
    });
  });

  describe('onToolOutput', () => {
    beforeEach(() => {
      plugin = new AutoSpillPlugin(memory, { sizeThreshold: 100 });
    });

    it('should spill large string outputs', async () => {
      const largeContent = 'x'.repeat(200);
      const key = await plugin.onToolOutput('web_fetch', largeContent);

      expect(key).toBeDefined();
      expect(key).toMatch(/^raw\.autospill_web_fetch_/);
    });

    it('should spill large object outputs', async () => {
      const largeObject = { data: 'x'.repeat(200) };
      const key = await plugin.onToolOutput('web_fetch', largeObject);

      expect(key).toBeDefined();
    });

    it('should not spill small outputs', async () => {
      const smallContent = 'small';
      const key = await plugin.onToolOutput('web_fetch', smallContent);

      expect(key).toBeUndefined();
    });

    it('should track spilled entries', async () => {
      const largeContent = 'x'.repeat(200);
      await plugin.onToolOutput('web_fetch', largeContent);

      const entries = plugin.getEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].sourceTool).toBe('web_fetch');
      expect(entries[0].consumed).toBe(false);
    });

    it('should emit spilled event', async () => {
      const onSpilled = vi.fn();
      plugin.on('spilled', onSpilled);

      const largeContent = 'x'.repeat(200);
      await plugin.onToolOutput('web_fetch', largeContent);

      expect(onSpilled).toHaveBeenCalledWith(
        expect.objectContaining({
          tool: 'web_fetch',
          sizeBytes: expect.any(Number),
          key: expect.any(String),
        })
      );
    });

    it('should generate unique keys for multiple outputs', async () => {
      const content = 'x'.repeat(200);

      const key1 = await plugin.onToolOutput('web_fetch', content);
      const key2 = await plugin.onToolOutput('web_fetch', content);

      expect(key1).not.toBe(key2);
    });
  });

  describe('markConsumed', () => {
    beforeEach(() => {
      plugin = new AutoSpillPlugin(memory, { sizeThreshold: 100 });
    });

    it('should mark entry as consumed', async () => {
      const largeContent = 'x'.repeat(200);
      const key = await plugin.onToolOutput('web_fetch', largeContent);

      plugin.markConsumed(key!, 'summary.key1');

      const entries = plugin.getEntries();
      expect(entries[0].consumed).toBe(true);
      expect(entries[0].derivedSummaries).toContain('summary.key1');
    });

    it('should emit consumed event', async () => {
      const onConsumed = vi.fn();
      plugin.on('consumed', onConsumed);

      const largeContent = 'x'.repeat(200);
      const key = await plugin.onToolOutput('web_fetch', largeContent);
      plugin.markConsumed(key!, 'summary.key1');

      expect(onConsumed).toHaveBeenCalledWith({
        key,
        summaryKey: 'summary.key1',
      });
    });

    it('should handle marking non-existent key', () => {
      expect(() => {
        plugin.markConsumed('nonexistent', 'summary.key1');
      }).not.toThrow();
    });

    it('should allow multiple summaries from same raw entry', async () => {
      const largeContent = 'x'.repeat(200);
      const key = await plugin.onToolOutput('web_fetch', largeContent);

      plugin.markConsumed(key!, 'summary.key1');
      plugin.markConsumed(key!, 'summary.key2');

      const entry = plugin.getSpillInfo(key!);
      expect(entry?.derivedSummaries).toHaveLength(2);
    });
  });

  describe('getEntries', () => {
    beforeEach(() => {
      plugin = new AutoSpillPlugin(memory, { sizeThreshold: 100 });
    });

    it('should return all tracked entries', async () => {
      await plugin.onToolOutput('tool1', 'x'.repeat(200));
      await plugin.onToolOutput('tool2', 'y'.repeat(200));

      const entries = plugin.getEntries();
      expect(entries.length).toBe(2);
    });

    it('should return empty array when no entries', () => {
      const entries = plugin.getEntries();
      expect(entries).toEqual([]);
    });
  });

  describe('getUnconsumed', () => {
    beforeEach(() => {
      plugin = new AutoSpillPlugin(memory, { sizeThreshold: 100 });
    });

    it('should return only unconsumed entries', async () => {
      const key1 = await plugin.onToolOutput('tool1', 'x'.repeat(200));
      await plugin.onToolOutput('tool2', 'y'.repeat(200));

      plugin.markConsumed(key1!, 'summary.key1');

      const unconsumed = plugin.getUnconsumed();
      expect(unconsumed.length).toBe(1);
      expect(unconsumed[0].sourceTool).toBe('tool2');
    });
  });

  describe('getConsumed', () => {
    beforeEach(() => {
      plugin = new AutoSpillPlugin(memory, { sizeThreshold: 100 });
    });

    it('should return only consumed entries', async () => {
      const key1 = await plugin.onToolOutput('tool1', 'x'.repeat(200));
      await plugin.onToolOutput('tool2', 'y'.repeat(200));

      plugin.markConsumed(key1!, 'summary.key1');

      const consumed = plugin.getConsumed();
      expect(consumed.length).toBe(1);
      expect(consumed[0].sourceTool).toBe('tool1');
    });
  });

  describe('cleanupConsumed', () => {
    beforeEach(() => {
      plugin = new AutoSpillPlugin(memory, { sizeThreshold: 100 });
    });

    it('should delete consumed entries from memory', async () => {
      const key1 = await plugin.onToolOutput('tool1', 'x'.repeat(200));
      await plugin.onToolOutput('tool2', 'y'.repeat(200));

      plugin.markConsumed(key1!, 'summary.key1');

      const deleted = await plugin.cleanupConsumed();

      expect(deleted).toContain(key1);
      expect(deleted.length).toBe(1);
    });

    it('should emit cleaned event', async () => {
      const onCleaned = vi.fn();
      plugin.on('cleaned', onCleaned);

      const key = await plugin.onToolOutput('tool1', 'x'.repeat(200));
      plugin.markConsumed(key!, 'summary.key1');

      await plugin.cleanupConsumed();

      expect(onCleaned).toHaveBeenCalledWith({
        keys: [key],
        reason: 'consumed',
      });
    });

    it('should remove entries from tracking', async () => {
      const key = await plugin.onToolOutput('tool1', 'x'.repeat(200));
      plugin.markConsumed(key!, 'summary.key1');

      await plugin.cleanupConsumed();

      expect(plugin.getEntries().length).toBe(0);
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      plugin = new AutoSpillPlugin(memory, { sizeThreshold: 100 });
    });

    it('should delete specific keys', async () => {
      const key1 = await plugin.onToolOutput('tool1', 'x'.repeat(200));
      const key2 = await plugin.onToolOutput('tool2', 'y'.repeat(200));

      const deleted = await plugin.cleanup([key1!]);

      expect(deleted).toContain(key1);
      expect(plugin.getEntries().length).toBe(1);
    });

    it('should emit cleaned event with manual reason', async () => {
      const onCleaned = vi.fn();
      plugin.on('cleaned', onCleaned);

      const key = await plugin.onToolOutput('tool1', 'x'.repeat(200));
      await plugin.cleanup([key!]);

      expect(onCleaned).toHaveBeenCalledWith({
        keys: [key],
        reason: 'manual',
      });
    });
  });

  describe('cleanupAll', () => {
    beforeEach(() => {
      plugin = new AutoSpillPlugin(memory, { sizeThreshold: 100 });
    });

    it('should delete all tracked entries', async () => {
      await plugin.onToolOutput('tool1', 'x'.repeat(200));
      await plugin.onToolOutput('tool2', 'y'.repeat(200));
      await plugin.onToolOutput('tool3', 'z'.repeat(200));

      const deleted = await plugin.cleanupAll();

      expect(deleted.length).toBe(3);
      expect(plugin.getEntries().length).toBe(0);
    });
  });

  describe('onIteration', () => {
    it('should auto-cleanup after configured iterations', async () => {
      plugin = new AutoSpillPlugin(memory, {
        sizeThreshold: 100,
        autoCleanupAfterIterations: 2,
      });

      const key = await plugin.onToolOutput('tool1', 'x'.repeat(200));
      plugin.markConsumed(key!, 'summary.key1');

      // First iteration - no cleanup
      await plugin.onIteration();
      expect(plugin.getEntries().length).toBe(1);

      // Second iteration - should cleanup
      await plugin.onIteration();
      expect(plugin.getEntries().length).toBe(0);
    });
  });

  describe('getSpillInfo', () => {
    beforeEach(() => {
      plugin = new AutoSpillPlugin(memory, { sizeThreshold: 100 });
    });

    it('should return entry info by key', async () => {
      const key = await plugin.onToolOutput('tool1', 'x'.repeat(200));

      const info = plugin.getSpillInfo(key!);

      expect(info).toBeDefined();
      expect(info?.sourceTool).toBe('tool1');
      expect(info?.key).toBe(key);
    });

    it('should return undefined for unknown key', () => {
      const info = plugin.getSpillInfo('unknown');
      expect(info).toBeUndefined();
    });
  });

  describe('getComponent', () => {
    beforeEach(() => {
      plugin = new AutoSpillPlugin(memory, { sizeThreshold: 100 });
    });

    it('should return null when no unconsumed entries', async () => {
      const component = await plugin.getComponent();
      expect(component).toBeNull();
    });

    it('should return component when unconsumed entries exist', async () => {
      await plugin.onToolOutput('tool1', 'x'.repeat(200));

      const component = await plugin.getComponent();

      expect(component).not.toBeNull();
      expect(component?.name).toBe('auto_spill_tracker');
      expect(component?.content).toContain('Auto-Spilled Data');
    });

    it('should include entry info in component', async () => {
      await plugin.onToolOutput('web_fetch', 'x'.repeat(200));

      const component = await plugin.getComponent();

      expect(component?.content).toContain('web_fetch');
    });
  });

  describe('compact', () => {
    beforeEach(() => {
      plugin = new AutoSpillPlugin(memory, { sizeThreshold: 100 });
    });

    it('should cleanup consumed entries during compaction', async () => {
      const key = await plugin.onToolOutput('tool1', 'x'.repeat(200));
      plugin.markConsumed(key!, 'summary.key1');

      const tokensSaved = await plugin.compact(1000, { estimateTokens: (s: string) => s.length / 4 });

      expect(tokensSaved).toBeGreaterThan(0);
      expect(plugin.getEntries().length).toBe(0);
    });
  });

  describe('getState/restoreState', () => {
    beforeEach(() => {
      plugin = new AutoSpillPlugin(memory, { sizeThreshold: 100 });
    });

    it('should serialize and restore state', async () => {
      await plugin.onToolOutput('tool1', 'x'.repeat(200));
      await plugin.onToolOutput('tool2', 'y'.repeat(200));

      const state = plugin.getState();

      // Create new plugin and restore
      const newPlugin = new AutoSpillPlugin(memory, { sizeThreshold: 100 });
      newPlugin.restoreState(state);

      expect(newPlugin.getEntries().length).toBe(2);
    });

    it('should handle empty state', () => {
      const newPlugin = new AutoSpillPlugin(memory, { sizeThreshold: 100 });
      expect(() => newPlugin.restoreState({})).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should clear all state', async () => {
      plugin = new AutoSpillPlugin(memory, { sizeThreshold: 100 });
      await plugin.onToolOutput('tool1', 'x'.repeat(200));

      plugin.destroy();

      expect(plugin.getEntries().length).toBe(0);
    });
  });

  describe('entry pruning', () => {
    it('should prune oldest entries when maxTrackedEntries exceeded', async () => {
      plugin = new AutoSpillPlugin(memory, {
        sizeThreshold: 100,
        maxTrackedEntries: 3,
      });

      // Add 5 entries
      for (let i = 0; i < 5; i++) {
        await plugin.onToolOutput(`tool${i}`, 'x'.repeat(200));
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const entries = plugin.getEntries();
      expect(entries.length).toBe(3);

      // Should keep the newest entries
      const tools = entries.map((e) => e.sourceTool);
      expect(tools).toContain('tool4');
      expect(tools).toContain('tool3');
      expect(tools).toContain('tool2');
    });
  });
});
