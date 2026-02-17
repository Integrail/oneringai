/**
 * Tests for ToolManager tags, category, source fields
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolManager } from '../../../src/core/ToolManager.js';
import type { ToolFunction } from '../../../src/domain/entities/Tool.js';

describe('ToolManager metadata (tags, category, source)', () => {
  let tm: ToolManager;
  let tool: ToolFunction;

  beforeEach(() => {
    tm = new ToolManager();
    tool = {
      definition: {
        type: 'function',
        function: {
          name: 'test_tool',
          description: 'A test tool',
          parameters: { type: 'object', properties: {} },
        },
      },
      execute: vi.fn(async () => ({ ok: true })),
    };
  });

  describe('register with metadata', () => {
    it('should register tool with tags, category, source', () => {
      tm.register(tool, {
        tags: ['api', 'web'],
        category: 'network',
        source: 'custom',
      });

      const reg = tm.getRegistration('test_tool');
      expect(reg?.tags).toEqual(['api', 'web']);
      expect(reg?.category).toBe('network');
      expect(reg?.source).toBe('custom');
    });

    it('should update metadata on re-register', () => {
      tm.register(tool, { tags: ['v1'], category: 'old', source: 'built-in' });
      tm.register(tool, { tags: ['v2'], category: 'new', source: 'custom' });

      const reg = tm.getRegistration('test_tool');
      expect(reg?.tags).toEqual(['v2']);
      expect(reg?.category).toBe('new');
      expect(reg?.source).toBe('custom');
    });
  });

  describe('getState / loadState with metadata', () => {
    it('should serialize tags, categories, sources', () => {
      tm.register(tool, { tags: ['math'], category: 'compute', source: 'custom' });

      const state = tm.getState();
      expect(state.tags).toEqual({ test_tool: ['math'] });
      expect(state.categories).toEqual({ test_tool: 'compute' });
      expect(state.sources).toEqual({ test_tool: 'custom' });
    });

    it('should restore tags, categories, sources', () => {
      tm.register(tool);

      tm.loadState({
        enabled: { test_tool: true },
        namespaces: { test_tool: 'default' },
        priorities: { test_tool: 0 },
        tags: { test_tool: ['restored'] },
        categories: { test_tool: 'restored_cat' },
        sources: { test_tool: 'mcp' },
      });

      const reg = tm.getRegistration('test_tool');
      expect(reg?.tags).toEqual(['restored']);
      expect(reg?.category).toBe('restored_cat');
      expect(reg?.source).toBe('mcp');
    });

    it('should handle state without optional metadata fields', () => {
      tm.register(tool);

      // Old-format state without tags/categories/sources
      tm.loadState({
        enabled: { test_tool: true },
        namespaces: { test_tool: 'default' },
        priorities: { test_tool: 5 },
      });

      expect(tm.getPriority('test_tool')).toBe(5);
      // Should not crash, metadata stays undefined
      const reg = tm.getRegistration('test_tool');
      expect(reg?.tags).toBeUndefined();
    });

    it('should not serialize undefined metadata', () => {
      tm.register(tool); // No tags/category/source

      const state = tm.getState();
      expect(state.tags).toEqual({});
      expect(state.categories).toEqual({});
      expect(state.sources).toEqual({});
    });
  });
});
