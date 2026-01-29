/**
 * Tests for Unified Tool Management via AgentContext
 *
 * Verifies that AgentContext is the single source of truth for ToolManager
 * across all agent types (Agent, TaskAgent, UniversalAgent).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Agent } from '../../../src/core/Agent.js';
import { Connector, Vendor } from '../../../src/core/index.js';
import { ToolFunction } from '../../../src/domain/entities/Tool.js';

// Create a test tool
const createTestTool = (name: string): ToolFunction => ({
  definition: {
    type: 'function' as const,
    function: {
      name,
      description: `Test tool: ${name}`,
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  execute: async () => ({ success: true }),
});

describe('Unified Tool Management', () => {
  beforeEach(() => {
    // Clear any existing connectors
    Connector.clear();

    // Create test connector with mock provider
    Connector.create({
      name: 'test-connector',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test-key' },
    });
  });

  afterEach(() => {
    Connector.clear();
  });

  describe('Agent Tool Management', () => {
    it('should have same ToolManager instance from agent.tools and agent.context.tools', () => {
      const agent = Agent.create({
        connector: 'test-connector',
        model: 'gpt-4',
        tools: [createTestTool('tool1')],
      });

      try {
        // The key verification: agent.tools and agent.context.tools should be the same instance
        expect(agent.tools).toBe(agent.context.tools);
      } finally {
        agent.destroy();
      }
    });

    it('should reflect tool changes via agent.tools in agent.context.tools', () => {
      const agent = Agent.create({
        connector: 'test-connector',
        model: 'gpt-4',
        tools: [createTestTool('tool1')],
      });

      try {
        // Initial state
        expect(agent.tools.listEnabled()).toContain('tool1');
        expect(agent.context.tools.listEnabled()).toContain('tool1');

        // Add tool via agent.tools
        agent.addTool(createTestTool('tool2'));
        expect(agent.tools.listEnabled()).toContain('tool2');
        expect(agent.context.tools.listEnabled()).toContain('tool2');

        // Disable tool via agent.tools
        agent.tools.disable('tool1');
        expect(agent.tools.listEnabled()).not.toContain('tool1');
        expect(agent.context.tools.listEnabled()).not.toContain('tool1');

        // Enable tool via agent.context.tools
        agent.context.tools.enable('tool1');
        expect(agent.tools.listEnabled()).toContain('tool1');
        expect(agent.context.tools.listEnabled()).toContain('tool1');
      } finally {
        agent.destroy();
      }
    });

    it('should reflect tool changes via agent.context.tools in agent.tools', () => {
      const agent = Agent.create({
        connector: 'test-connector',
        model: 'gpt-4',
        tools: [createTestTool('tool1')],
      });

      try {
        // Add tool via agent.context.tools
        agent.context.tools.register(createTestTool('tool3'));
        expect(agent.tools.listEnabled()).toContain('tool3');

        // Disable tool via agent.context.tools
        agent.context.tools.disable('tool1');
        expect(agent.tools.listEnabled()).not.toContain('tool1');

        // Check getEnabled returns same results
        const enabledFromTools = agent.tools.getEnabled();
        const enabledFromContext = agent.context.tools.getEnabled();
        expect(enabledFromTools.length).toBe(enabledFromContext.length);
        expect(enabledFromTools.map(t => t.definition.function.name).sort())
          .toEqual(enabledFromContext.map(t => t.definition.function.name).sort());
      } finally {
        agent.destroy();
      }
    });

    it('should have context always available (hasContext returns true)', () => {
      const agent = Agent.create({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      try {
        expect(agent.hasContext()).toBe(true);
        expect(agent.context).toBeDefined();
      } finally {
        agent.destroy();
      }
    });

    it('should share the same ToolManager state', () => {
      const agent = Agent.create({
        connector: 'test-connector',
        model: 'gpt-4',
        tools: [createTestTool('tool1'), createTestTool('tool2')],
      });

      try {
        // Get state from both paths
        const stateFromTools = agent.tools.getState();
        const stateFromContext = agent.context.tools.getState();

        // Should be identical
        expect(stateFromTools).toEqual(stateFromContext);
      } finally {
        agent.destroy();
      }
    });
  });
});
