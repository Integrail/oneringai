/**
 * Tests for AgentContext feature configuration
 *
 * Tests the flexible feature configuration system that allows
 * independent enabling/disabling of AgentContext features.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AgentContext,
  DEFAULT_FEATURES,
  getAgentContextTools,
} from '../../../src/core/index.js';

describe('AgentContext Feature Configuration', () => {
  let context: AgentContext | null = null;

  afterEach(() => {
    if (context) {
      context.destroy();
      context = null;
    }
  });

  describe('DEFAULT_FEATURES', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_FEATURES).toEqual({
        memory: true,
        inContextMemory: false,
        persistentInstructions: false,
        history: true,
        permissions: true,
      });
    });
  });

  describe('Feature Resolution', () => {
    it('should use default features when no config provided', () => {
      context = AgentContext.create({});

      expect(context.features.memory).toBe(true);
      expect(context.features.inContextMemory).toBe(false);
      expect(context.features.persistentInstructions).toBe(false);
      expect(context.features.history).toBe(true);
      expect(context.features.permissions).toBe(true);
    });

    it('should override specific features while keeping others at default', () => {
      context = AgentContext.create({
        features: { memory: false },
      });

      expect(context.features.memory).toBe(false);
      expect(context.features.inContextMemory).toBe(false); // Still default
      expect(context.features.history).toBe(true); // Still default
      expect(context.features.permissions).toBe(true); // Still default
    });

    it('should allow enabling inContextMemory', () => {
      context = AgentContext.create({
        features: { inContextMemory: true },
      });

      expect(context.features.inContextMemory).toBe(true);
      expect(context.inContextMemory).not.toBeNull();
    });

    it('should handle legacy cache.enabled flag', () => {
      context = AgentContext.create({
        cache: { enabled: false },
      });

      // Legacy cache.enabled: false should map to features.memory: false
      expect(context.features.memory).toBe(false);
      expect(context.memory).toBeNull();
      expect(context.cache).toBeNull();
    });
  });

  describe('Memory Feature', () => {
    it('should create WorkingMemory and IdempotencyCache when memory is enabled', () => {
      context = AgentContext.create({
        features: { memory: true },
      });

      expect(context.memory).not.toBeNull();
      expect(context.cache).not.toBeNull();
    });

    it('should not create WorkingMemory or IdempotencyCache when memory is disabled', () => {
      context = AgentContext.create({
        features: { memory: false },
      });

      expect(context.memory).toBeNull();
      expect(context.cache).toBeNull();
    });

    it('should throw when requireMemory() is called but memory is disabled', () => {
      context = AgentContext.create({
        features: { memory: false },
      });

      expect(() => context!.requireMemory()).toThrow(
        'WorkingMemory is not available. Enable the "memory" feature in AgentContextConfig.'
      );
    });

    it('should throw when requireCache() is called but memory is disabled', () => {
      context = AgentContext.create({
        features: { memory: false },
      });

      expect(() => context!.requireCache()).toThrow(
        'IdempotencyCache is not available. Enable the "memory" feature in AgentContextConfig.'
      );
    });

    it('should return WorkingMemory from requireMemory() when enabled', () => {
      context = AgentContext.create({
        features: { memory: true },
      });

      const memory = context.requireMemory();
      expect(memory).toBe(context.memory);
    });
  });

  describe('Permissions Feature', () => {
    it('should create ToolPermissionManager when permissions is enabled', () => {
      context = AgentContext.create({
        features: { permissions: true },
      });

      expect(context.permissions).not.toBeNull();
    });

    it('should not create ToolPermissionManager when permissions is disabled', () => {
      context = AgentContext.create({
        features: { permissions: false },
      });

      expect(context.permissions).toBeNull();
    });

    it('should throw when requirePermissions() is called but permissions is disabled', () => {
      context = AgentContext.create({
        features: { permissions: false },
      });

      expect(() => context!.requirePermissions()).toThrow(
        'ToolPermissionManager is not available. Enable the "permissions" feature in AgentContextConfig.'
      );
    });
  });

  describe('History Feature', () => {
    it('should add messages to history when history is enabled', async () => {
      context = AgentContext.create({
        features: { history: true },
      });

      const message = await context.addMessage('user', 'Hello');
      expect(message).not.toBeNull();
      expect(message?.content).toBe('Hello');
      expect(context.getHistory()).toHaveLength(1);
    });

    it('should return null and not add messages when history is disabled', async () => {
      context = AgentContext.create({
        features: { history: false },
      });

      const message = await context.addMessage('user', 'Hello');
      expect(message).toBeNull();
      expect(context.getHistory()).toHaveLength(0);
    });
  });

  describe('InContextMemory Feature', () => {
    it('should create InContextMemoryPlugin when inContextMemory is enabled', () => {
      context = AgentContext.create({
        features: { inContextMemory: true },
      });

      expect(context.inContextMemory).not.toBeNull();
    });

    it('should not create InContextMemoryPlugin when inContextMemory is disabled (default)', () => {
      context = AgentContext.create({});

      expect(context.inContextMemory).toBeNull();
    });

    it('should register inContextMemory tools when enabled', () => {
      context = AgentContext.create({
        features: { inContextMemory: true },
      });

      const tools = context.tools.getAll().map((t) => t.definition.function.name);
      expect(tools).toContain('context_set');
      expect(tools).toContain('context_get');
      expect(tools).toContain('context_delete');
      expect(tools).toContain('context_list');
    });

    it('should not register inContextMemory tools when disabled', () => {
      context = AgentContext.create({
        features: { inContextMemory: false },
      });

      const tools = context.tools.getAll().map((t) => t.definition.function.name);
      expect(tools).not.toContain('context_set');
      expect(tools).not.toContain('context_get');
    });
  });

  describe('PersistentInstructions Feature', () => {
    it('should create PersistentInstructionsPlugin when persistentInstructions is enabled', () => {
      context = AgentContext.create({
        agentId: 'test-agent',
        features: { persistentInstructions: true },
      });

      expect(context.persistentInstructions).not.toBeNull();
    });

    it('should not create PersistentInstructionsPlugin when persistentInstructions is disabled (default)', () => {
      context = AgentContext.create({});

      expect(context.persistentInstructions).toBeNull();
    });

    it('should register persistentInstructions tools when enabled', () => {
      context = AgentContext.create({
        agentId: 'test-agent',
        features: { persistentInstructions: true },
      });

      const tools = context.tools.getAll().map((t) => t.definition.function.name);
      expect(tools).toContain('instructions_set');
      expect(tools).toContain('instructions_get');
      expect(tools).toContain('instructions_append');
      expect(tools).toContain('instructions_clear');
    });

    it('should not register persistentInstructions tools when disabled', () => {
      context = AgentContext.create({
        features: { persistentInstructions: false },
      });

      const tools = context.tools.getAll().map((t) => t.definition.function.name);
      expect(tools).not.toContain('instructions_set');
      expect(tools).not.toContain('instructions_get');
    });

    it('should auto-generate agentId when not provided', () => {
      context = AgentContext.create({
        features: { persistentInstructions: true },
      });

      expect(context.agentId).toMatch(/^agent-\d+-[a-z0-9]+$/);
    });

    it('should use provided agentId', () => {
      context = AgentContext.create({
        agentId: 'my-custom-agent',
        features: { persistentInstructions: true },
      });

      expect(context.agentId).toBe('my-custom-agent');
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return correct values for each feature', () => {
      context = AgentContext.create({
        agentId: 'test-agent',
        features: {
          memory: false,
          inContextMemory: true,
          persistentInstructions: true,
          history: true,
          permissions: false,
        },
      });

      expect(context.isFeatureEnabled('memory')).toBe(false);
      expect(context.isFeatureEnabled('inContextMemory')).toBe(true);
      expect(context.isFeatureEnabled('persistentInstructions')).toBe(true);
      expect(context.isFeatureEnabled('history')).toBe(true);
      expect(context.isFeatureEnabled('permissions')).toBe(false);
    });
  });

  describe('getAgentContextTools', () => {
    it('should return only basic introspection tools when memory is disabled', () => {
      context = AgentContext.create({
        features: { memory: false },
      });

      const tools = getAgentContextTools(context);
      const toolNames = tools.map((t) => t.definition.function.name);

      // Basic introspection tools should always be present
      expect(toolNames).toContain('context_inspect');
      expect(toolNames).toContain('context_breakdown');

      // Memory tools should not be present
      expect(toolNames).not.toContain('memory_store');
      expect(toolNames).not.toContain('memory_retrieve');
      expect(toolNames).not.toContain('cache_stats');
      expect(toolNames).not.toContain('memory_stats');
    });

    it('should return all memory tools when memory is enabled', () => {
      context = AgentContext.create({
        features: { memory: true },
      });

      const tools = getAgentContextTools(context);
      const toolNames = tools.map((t) => t.definition.function.name);

      // Basic introspection tools
      expect(toolNames).toContain('context_inspect');
      expect(toolNames).toContain('context_breakdown');

      // Memory tools
      expect(toolNames).toContain('memory_store');
      expect(toolNames).toContain('memory_retrieve');
      expect(toolNames).toContain('memory_delete');
      expect(toolNames).toContain('memory_list');
      expect(toolNames).toContain('memory_cleanup_raw');
      expect(toolNames).toContain('memory_retrieve_batch');
      expect(toolNames).toContain('memory_stats');
      expect(toolNames).toContain('cache_stats');
    });
  });

  describe('Context Preparation', () => {
    it('should include memory_index in context when memory is enabled', async () => {
      context = AgentContext.create({
        features: { memory: true },
      });

      // Store something in memory to ensure memory_index has content
      await context.memory!.store('test', 'Test entry', 'test value');

      context.setCurrentInput('test');
      const prepared = await context.prepare();

      const componentNames = prepared.components.map((c) => c.name);
      expect(componentNames).toContain('memory_index');
    });

    it('should not include memory_index in context when memory is disabled', async () => {
      context = AgentContext.create({
        features: { memory: false },
      });

      context.setCurrentInput('test');
      const prepared = await context.prepare();

      const componentNames = prepared.components.map((c) => c.name);
      expect(componentNames).not.toContain('memory_index');
    });

    it('should include conversation_history when history is enabled', async () => {
      context = AgentContext.create({
        features: { history: true },
      });

      context.addMessageSync('user', 'Hello');
      context.setCurrentInput('test');
      const prepared = await context.prepare();

      const componentNames = prepared.components.map((c) => c.name);
      expect(componentNames).toContain('conversation_history');
    });

    it('should not include conversation_history when history is disabled', async () => {
      context = AgentContext.create({
        features: { history: false },
      });

      context.addMessageSync('user', 'Hello'); // This should be a no-op
      context.setCurrentInput('test');
      const prepared = await context.prepare();

      const componentNames = prepared.components.map((c) => c.name);
      expect(componentNames).not.toContain('conversation_history');
    });
  });

  describe('Full Feature Combinations', () => {
    it('should work with all features disabled (minimal stateless agent)', async () => {
      context = AgentContext.create({
        features: {
          memory: false,
          inContextMemory: false,
          history: false,
          permissions: false,
        },
      });

      expect(context.memory).toBeNull();
      expect(context.cache).toBeNull();
      expect(context.permissions).toBeNull();
      expect(context.inContextMemory).toBeNull();
      expect(context.features.history).toBe(false);

      // Context should still prepare without errors
      context.setCurrentInput('test');
      const prepared = await context.prepare();
      expect(prepared).toBeDefined();
    });

    it('should work with all features enabled (full-featured agent)', async () => {
      context = AgentContext.create({
        features: {
          memory: true,
          inContextMemory: true,
          history: true,
          permissions: true,
        },
      });

      expect(context.memory).not.toBeNull();
      expect(context.cache).not.toBeNull();
      expect(context.permissions).not.toBeNull();
      expect(context.inContextMemory).not.toBeNull();
      expect(context.features.history).toBe(true);

      // All should work
      await context.memory!.store('key', 'desc', 'value');
      context.addMessageSync('user', 'Hello');
      context.inContextMemory!.set('state', 'Current state', { step: 1 });

      context.setCurrentInput('test');
      const prepared = await context.prepare();
      expect(prepared).toBeDefined();
      expect(prepared.components.some((c) => c.name === 'memory_index')).toBe(true);
      expect(prepared.components.some((c) => c.name === 'conversation_history')).toBe(true);
    });
  });

  describe('Serialization/Deserialization', () => {
    it('should serialize state correctly with features disabled', async () => {
      context = AgentContext.create({
        features: { memory: false, permissions: false },
      });

      const state = await context.getState();

      expect(state.memoryStats).toBeUndefined();
      // Permissions state should have default empty values
      expect(state.permissions.approvals).toEqual({});
    });

    it('should serialize state correctly with features enabled', async () => {
      context = AgentContext.create({
        features: { memory: true, permissions: true },
      });

      await context.memory!.store('key', 'desc', 'value');

      const state = await context.getState();

      expect(state.memoryStats).toBeDefined();
      expect(state.memoryStats?.entryCount).toBe(1);
    });
  });
});
