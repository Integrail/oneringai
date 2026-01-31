/**
 * ContextFeatures Mock Tests
 *
 * Deterministic tests for the feature flag system:
 * - Feature defaults and resolution
 * - Tool auto-registration per feature
 * - Feature-aware APIs (isFeatureEnabled, requireMemory, etc.)
 * - Feature instructions injection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentContext, DEFAULT_FEATURES } from '@/core/AgentContext.js';
import type { AgentContextFeatures } from '@/core/AgentContext.js';
import {
  buildFeatureInstructions,
  getAllInstructions,
  INTROSPECTION_INSTRUCTIONS,
  WORKING_MEMORY_INSTRUCTIONS,
  IN_CONTEXT_MEMORY_INSTRUCTIONS,
  PERSISTENT_INSTRUCTIONS_INSTRUCTIONS,
} from '@/core/context/FeatureInstructions.js';
import {
  createMinimalContext,
  createFullContext,
  createContextWithFeatures,
  FEATURE_PRESETS,
  safeDestroy,
} from '../../helpers/contextTestHelpers.js';

// ============================================================================
// Feature Defaults Tests
// ============================================================================

describe('Feature Defaults', () => {
  it('should have correct default feature values', () => {
    expect(DEFAULT_FEATURES).toEqual({
      memory: true,
      inContextMemory: false,
      history: true,
      permissions: true,
      persistentInstructions: false,
    });
  });

  it('should apply defaults when no features specified', () => {
    const ctx = AgentContext.create({ model: 'gpt-4' });

    expect(ctx.isFeatureEnabled('memory')).toBe(true);
    expect(ctx.isFeatureEnabled('inContextMemory')).toBe(false);
    expect(ctx.isFeatureEnabled('history')).toBe(true);
    expect(ctx.isFeatureEnabled('permissions')).toBe(true);

    ctx.destroy();
  });

  it('should allow partial feature overrides', () => {
    const ctx = AgentContext.create({
      model: 'gpt-4',
      features: { memory: false }, // Only override memory
    });

    expect(ctx.isFeatureEnabled('memory')).toBe(false);
    expect(ctx.isFeatureEnabled('history')).toBe(true); // Still default

    ctx.destroy();
  });
});

// ============================================================================
// Feature Resolution Tests
// ============================================================================

describe('Feature Resolution', () => {
  describe('Memory Feature', () => {
    it('should create WorkingMemory when memory=true', () => {
      const ctx = createContextWithFeatures({ memory: true });
      expect(ctx.memory).not.toBeNull();
      ctx.destroy();
    });

    it('should NOT create WorkingMemory when memory=false', () => {
      const ctx = createContextWithFeatures({ memory: false });
      expect(ctx.memory).toBeNull();
      ctx.destroy();
    });

    it('should create IdempotencyCache when memory=true', () => {
      const ctx = createContextWithFeatures({ memory: true });
      expect(ctx.cache).not.toBeNull();
      ctx.destroy();
    });

    it('should NOT create IdempotencyCache when memory=false', () => {
      const ctx = createContextWithFeatures({ memory: false });
      expect(ctx.cache).toBeNull();
      ctx.destroy();
    });
  });

  describe('InContextMemory Feature', () => {
    it('should create InContextMemoryPlugin when inContextMemory=true', () => {
      const ctx = createContextWithFeatures({ inContextMemory: true });
      expect(ctx.inContextMemory).not.toBeNull();
      ctx.destroy();
    });

    it('should NOT create InContextMemoryPlugin when inContextMemory=false', () => {
      const ctx = createContextWithFeatures({ inContextMemory: false });
      expect(ctx.inContextMemory).toBeNull();
      ctx.destroy();
    });
  });

  describe('History Feature', () => {
    it('should track history when history=true', () => {
      const ctx = createContextWithFeatures({ history: true });
      ctx.addMessageSync('user', 'Hello');
      ctx.addMessageSync('assistant', 'Hi');

      expect(ctx.getHistory().length).toBe(2);
      ctx.destroy();
    });

    it('should NOT track history when history=false', () => {
      const ctx = createContextWithFeatures({ history: false });
      ctx.addMessageSync('user', 'Hello');
      ctx.addMessageSync('assistant', 'Hi');

      expect(ctx.getHistory().length).toBe(0);
      ctx.destroy();
    });
  });

  describe('Permissions Feature', () => {
    it('should create ToolPermissionManager when permissions=true', () => {
      const ctx = createContextWithFeatures({ permissions: true });
      expect(ctx.permissions).not.toBeNull();
      ctx.destroy();
    });

    it('should NOT create ToolPermissionManager when permissions=false', () => {
      const ctx = createContextWithFeatures({ permissions: false });
      expect(ctx.permissions).toBeNull();
      ctx.destroy();
    });
  });

  describe('PersistentInstructions Feature', () => {
    it('should create PersistentInstructionsPlugin when persistentInstructions=true', () => {
      const ctx = createContextWithFeatures(
        { persistentInstructions: true },
        { agentId: 'test-agent' }
      );
      expect(ctx.persistentInstructions).not.toBeNull();
      ctx.destroy();
    });

    it('should NOT create PersistentInstructionsPlugin when persistentInstructions=false', () => {
      const ctx = createContextWithFeatures({ persistentInstructions: false });
      expect(ctx.persistentInstructions).toBeNull();
      ctx.destroy();
    });
  });
});

// ============================================================================
// Tool Auto-Registration Tests
// ============================================================================

describe('Tool Auto-Registration', () => {
  describe('context_stats Tool (Always Available)', () => {
    it('should be registered regardless of features', () => {
      const minCtx = createMinimalContext();
      const fullCtx = createFullContext({ agentId: 'test' });

      // tools.list() returns string[] directly
      expect(minCtx.tools.list()).toContain('context_stats');
      expect(fullCtx.tools.list()).toContain('context_stats');

      minCtx.destroy();
      fullCtx.destroy();
    });
  });

  describe('Memory Tools (memory=true)', () => {
    const memoryTools = [
      'memory_store',
      'memory_retrieve',
      'memory_delete',
      'memory_query',
      'memory_cleanup_raw',
    ];

    it('should register memory tools when memory=true', () => {
      const ctx = createContextWithFeatures({ memory: true });
      const toolNames = ctx.tools.list();

      for (const tool of memoryTools) {
        expect(toolNames).toContain(tool);
      }

      ctx.destroy();
    });

    it('should NOT register memory tools when memory=false', () => {
      const ctx = createContextWithFeatures({ memory: false });
      const toolNames = ctx.tools.list();

      for (const tool of memoryTools) {
        expect(toolNames).not.toContain(tool);
      }

      ctx.destroy();
    });
  });

  describe('InContextMemory Tools (inContextMemory=true)', () => {
    const inContextTools = ['context_set', 'context_delete', 'context_list'];

    it('should register in-context tools when inContextMemory=true', () => {
      const ctx = createContextWithFeatures({ inContextMemory: true });
      const toolNames = ctx.tools.list();

      for (const tool of inContextTools) {
        expect(toolNames).toContain(tool);
      }

      ctx.destroy();
    });

    it('should NOT register in-context tools when inContextMemory=false', () => {
      const ctx = createContextWithFeatures({ inContextMemory: false });
      const toolNames = ctx.tools.list();

      for (const tool of inContextTools) {
        expect(toolNames).not.toContain(tool);
      }

      ctx.destroy();
    });
  });

  describe('PersistentInstructions Tools (persistentInstructions=true)', () => {
    const instructionsTools = [
      'instructions_set',
      'instructions_append',
      'instructions_get',
      'instructions_clear',
    ];

    it('should register instructions tools when persistentInstructions=true', () => {
      const ctx = createContextWithFeatures(
        { persistentInstructions: true },
        { agentId: 'test-agent' }
      );
      const toolNames = ctx.tools.list();

      for (const tool of instructionsTools) {
        expect(toolNames).toContain(tool);
      }

      ctx.destroy();
    });

    it('should NOT register instructions tools when persistentInstructions=false', () => {
      const ctx = createContextWithFeatures({ persistentInstructions: false });
      const toolNames = ctx.tools.list();

      for (const tool of instructionsTools) {
        expect(toolNames).not.toContain(tool);
      }

      ctx.destroy();
    });
  });
});

// ============================================================================
// Feature-Aware API Tests
// ============================================================================

describe('Feature-Aware APIs', () => {
  describe('isFeatureEnabled', () => {
    it('should return true for enabled features', () => {
      const ctx = createContextWithFeatures({
        memory: true,
        inContextMemory: true,
      });

      expect(ctx.isFeatureEnabled('memory')).toBe(true);
      expect(ctx.isFeatureEnabled('inContextMemory')).toBe(true);

      ctx.destroy();
    });

    it('should return false for disabled features', () => {
      const ctx = createContextWithFeatures({
        memory: false,
        inContextMemory: false,
      });

      expect(ctx.isFeatureEnabled('memory')).toBe(false);
      expect(ctx.isFeatureEnabled('inContextMemory')).toBe(false);

      ctx.destroy();
    });
  });

  describe('requireMemory', () => {
    it('should return memory when enabled', () => {
      const ctx = createContextWithFeatures({ memory: true });
      expect(() => ctx.requireMemory()).not.toThrow();
      expect(ctx.requireMemory()).not.toBeNull();
      ctx.destroy();
    });

    it('should throw when memory disabled', () => {
      const ctx = createContextWithFeatures({ memory: false });
      expect(() => ctx.requireMemory()).toThrow();
      ctx.destroy();
    });
  });

  describe('requireCache', () => {
    it('should return cache when enabled', () => {
      const ctx = createContextWithFeatures({ memory: true });
      expect(() => ctx.requireCache()).not.toThrow();
      expect(ctx.requireCache()).not.toBeNull();
      ctx.destroy();
    });

    it('should throw when cache disabled (memory=false)', () => {
      const ctx = createContextWithFeatures({ memory: false });
      expect(() => ctx.requireCache()).toThrow();
      ctx.destroy();
    });
  });

  describe('requirePermissions', () => {
    it('should return permissions when enabled', () => {
      const ctx = createContextWithFeatures({ permissions: true });
      expect(() => ctx.requirePermissions()).not.toThrow();
      expect(ctx.requirePermissions()).not.toBeNull();
      ctx.destroy();
    });

    it('should throw when permissions disabled', () => {
      const ctx = createContextWithFeatures({ permissions: false });
      expect(() => ctx.requirePermissions()).toThrow();
      ctx.destroy();
    });
  });
});

// ============================================================================
// Feature Instructions Tests
// ============================================================================

describe('Feature Instructions', () => {
  describe('getAllInstructions', () => {
    it('should return all instruction constants', () => {
      const instructions = getAllInstructions();

      expect(instructions.introspection).toBe(INTROSPECTION_INSTRUCTIONS);
      expect(instructions.workingMemory).toBe(WORKING_MEMORY_INSTRUCTIONS);
      expect(instructions.inContextMemory).toBe(IN_CONTEXT_MEMORY_INSTRUCTIONS);
      expect(instructions.persistentInstructions).toBe(PERSISTENT_INSTRUCTIONS_INSTRUCTIONS);
    });
  });

  describe('buildFeatureInstructions', () => {
    it('should always include introspection instructions', () => {
      const component = buildFeatureInstructions({
        memory: false,
        inContextMemory: false,
        history: false,
        permissions: false,
        persistentInstructions: false,
      });

      expect(component).not.toBeNull();
      expect(component?.content).toContain('Context Budget Management');
    });

    it('should include memory instructions when memory=true', () => {
      const component = buildFeatureInstructions({
        memory: true,
        inContextMemory: false,
        history: false,
        permissions: false,
        persistentInstructions: false,
      });

      expect(component?.content).toContain('Working Memory Usage');
      expect(component?.metadata?.memoryEnabled).toBe(true);
    });

    it('should include in-context memory instructions when inContextMemory=true', () => {
      const component = buildFeatureInstructions({
        memory: false,
        inContextMemory: true,
        history: false,
        permissions: false,
        persistentInstructions: false,
      });

      expect(component?.content).toContain('In-Context Memory Usage');
      expect(component?.metadata?.inContextMemoryEnabled).toBe(true);
    });

    it('should include persistent instructions when persistentInstructions=true', () => {
      const component = buildFeatureInstructions({
        memory: false,
        inContextMemory: false,
        history: false,
        permissions: false,
        persistentInstructions: true,
      });

      expect(component?.content).toContain('Persistent Instructions Usage');
      expect(component?.metadata?.persistentInstructionsEnabled).toBe(true);
    });

    it('should include all instructions when all features enabled', () => {
      const component = buildFeatureInstructions({
        memory: true,
        inContextMemory: true,
        history: true,
        permissions: true,
        persistentInstructions: true,
      });

      expect(component?.content).toContain('Context Budget Management');
      expect(component?.content).toContain('Working Memory Usage');
      expect(component?.content).toContain('In-Context Memory Usage');
      expect(component?.content).toContain('Persistent Instructions Usage');
      expect(component?.metadata?.featureCount).toBe(4);
    });

    it('should have high priority (1)', () => {
      const component = buildFeatureInstructions({
        memory: true,
        inContextMemory: false,
        history: true,
        permissions: true,
        persistentInstructions: false,
      });

      expect(component?.priority).toBe(1);
    });

    it('should be compactable', () => {
      const component = buildFeatureInstructions({
        memory: true,
        inContextMemory: false,
        history: true,
        permissions: true,
        persistentInstructions: false,
      });

      expect(component?.compactable).toBe(true);
    });
  });
});

// ============================================================================
// Feature Presets Tests
// ============================================================================

describe('Feature Presets', () => {
  describe('Minimal Preset', () => {
    it('should disable all features', () => {
      expect(FEATURE_PRESETS.minimal).toEqual({
        memory: false,
        inContextMemory: false,
        history: false,
        permissions: false,
        persistentInstructions: false,
      });
    });

    it('should create context with only context_stats tool', () => {
      const ctx = createMinimalContext();
      const toolNames = ctx.tools.list();

      expect(toolNames).toContain('context_stats');
      expect(toolNames).not.toContain('memory_store');
      expect(toolNames).not.toContain('context_set');

      ctx.destroy();
    });
  });

  describe('Default Preset', () => {
    it('should have standard features enabled', () => {
      expect(FEATURE_PRESETS.default).toEqual({
        memory: true,
        inContextMemory: false,
        history: true,
        permissions: true,
        persistentInstructions: false,
      });
    });
  });

  describe('Full Preset', () => {
    it('should enable all features', () => {
      expect(FEATURE_PRESETS.full).toEqual({
        memory: true,
        inContextMemory: true,
        history: true,
        permissions: true,
        persistentInstructions: true,
      });
    });

    it('should create context with all tools', () => {
      const ctx = createFullContext({ agentId: 'test' });
      const toolNames = ctx.tools.list();

      // Check key tools from each feature
      expect(toolNames).toContain('context_stats');
      expect(toolNames).toContain('memory_store');
      expect(toolNames).toContain('context_set');
      expect(toolNames).toContain('instructions_set');

      ctx.destroy();
    });
  });

  describe('MemoryOnly Preset', () => {
    it('should enable only memory feature', () => {
      expect(FEATURE_PRESETS.memoryOnly).toEqual({
        memory: true,
        inContextMemory: false,
        history: false,
        permissions: false,
        persistentInstructions: false,
      });
    });
  });

  describe('HistoryOnly Preset', () => {
    it('should enable only history feature', () => {
      expect(FEATURE_PRESETS.historyOnly).toEqual({
        memory: false,
        inContextMemory: false,
        history: true,
        permissions: false,
        persistentInstructions: false,
      });
    });
  });

  describe('InContextOnly Preset', () => {
    it('should enable only inContextMemory feature', () => {
      expect(FEATURE_PRESETS.inContextOnly).toEqual({
        memory: false,
        inContextMemory: true,
        history: false,
        permissions: false,
        persistentInstructions: false,
      });
    });
  });
});

// ============================================================================
// Feature Isolation Tests
// ============================================================================

describe('Feature Isolation', () => {
  it('should not affect other features when one is disabled', () => {
    const ctx = createContextWithFeatures({
      memory: false,  // Disabled
      inContextMemory: true,  // Enabled
      history: true,  // Enabled
      permissions: true,  // Enabled
    });

    // Memory disabled
    expect(ctx.memory).toBeNull();

    // InContextMemory should still work
    expect(ctx.inContextMemory).not.toBeNull();
    ctx.inContextMemory!.set('test', 'desc', 'value');
    expect(ctx.inContextMemory!.get('test')).toBe('value');

    // History should still work
    ctx.addMessageSync('user', 'Hello');
    expect(ctx.getHistory().length).toBe(1);

    // Permissions should still work
    expect(ctx.permissions).not.toBeNull();

    ctx.destroy();
  });

  it('should have independent tool lists per feature', () => {
    // Explicitly specify all features to avoid default memory=true
    const memoryCtx = createContextWithFeatures({
      memory: true,
      inContextMemory: false,
      history: false,
      permissions: false,
      persistentInstructions: false,
    });
    const inContextCtx = createContextWithFeatures({
      memory: false,  // Explicitly disable memory
      inContextMemory: true,
      history: false,
      permissions: false,
      persistentInstructions: false,
    });

    // tools.list() returns string[] directly
    const memoryTools = memoryCtx.tools.list();
    const inContextTools = inContextCtx.tools.list();

    // Memory tools only in memory context
    expect(memoryTools).toContain('memory_store');
    expect(inContextTools).not.toContain('memory_store');

    // In-context tools only in in-context context
    expect(inContextTools).toContain('context_set');
    expect(memoryTools).not.toContain('context_set');

    memoryCtx.destroy();
    inContextCtx.destroy();
  });
});

// ============================================================================
// AgentId and Feature Configuration Tests
// ============================================================================

describe('AgentId and Feature Configuration', () => {
  it('should auto-generate agentId if not provided', () => {
    const ctx = AgentContext.create({ model: 'gpt-4' });
    expect(ctx.agentId).toBeDefined();
    expect(ctx.agentId.length).toBeGreaterThan(0);
    ctx.destroy();
  });

  it('should use provided agentId', () => {
    const ctx = AgentContext.create({
      model: 'gpt-4',
      agentId: 'my-custom-agent',
    });
    expect(ctx.agentId).toBe('my-custom-agent');
    ctx.destroy();
  });

  it('should require agentId for persistentInstructions', () => {
    // With agentId, should work
    const ctx = createContextWithFeatures(
      { persistentInstructions: true },
      { agentId: 'test-agent' }
    );
    expect(ctx.persistentInstructions).not.toBeNull();
    ctx.destroy();
  });
});
