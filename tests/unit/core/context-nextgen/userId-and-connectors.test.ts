/**
 * Tests for userId auto-threading and connectors allowlist.
 *
 * Covers:
 * - userId flows from config → AgentContextNextGen → ToolContext
 * - userId setter updates ToolContext reactively
 * - userId persisted in session metadata
 * - connectors allowlist filters ToolContext.connectorRegistry
 * - connectorRegistry built from string names resolves correctly
 * - userId scoping via access policy
 * - combination: connectors allowlist + access policy + userId
 * - descriptionFactory receives ToolContext
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentContextNextGen } from '@/core/context-nextgen/AgentContextNextGen.js';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';
import type { IConnectorAccessPolicy } from '@/domain/interfaces/IConnectorAccessPolicy.js';
import type { IContextStorage, StoredContextSession, ContextSessionSummary, SerializedContextState } from '@/domain/interfaces/IContextStorage.js';

// ============================================================================
// Helpers
// ============================================================================

function createMockStorage(): IContextStorage & { sessions: Map<string, StoredContextSession> } {
  const sessions = new Map<string, StoredContextSession>();
  return {
    sessions,
    async save(sessionId: string, state: SerializedContextState): Promise<void> {
      const now = new Date().toISOString();
      const existing = sessions.get(sessionId);
      sessions.set(sessionId, {
        version: 1,
        sessionId,
        createdAt: existing?.createdAt ?? now,
        lastSavedAt: now,
        state,
        metadata: {},
      });
    },
    async load(sessionId: string): Promise<StoredContextSession | null> {
      return sessions.get(sessionId) ?? null;
    },
    async delete(sessionId: string): Promise<void> {
      sessions.delete(sessionId);
    },
    async exists(sessionId: string): Promise<boolean> {
      return sessions.has(sessionId);
    },
    async list(): Promise<ContextSessionSummary[]> {
      return [];
    },
    getPath(): string {
      return '/mock';
    },
  };
}

/** Register test connectors for use in tests. */
function registerTestConnectors(): void {
  Connector.create({
    name: 'github-test',
    serviceType: 'github',
    displayName: 'GitHub Test',
    description: 'GitHub API',
    baseURL: 'https://api.github.com',
    auth: { type: 'api_key', apiKey: 'gh-key' },
    tags: ['tenant-a'],
  });
  Connector.create({
    name: 'slack-test',
    serviceType: 'slack',
    displayName: 'Slack Test',
    description: 'Slack API',
    baseURL: 'https://slack.com/api',
    auth: { type: 'api_key', apiKey: 'slack-key' },
    tags: ['tenant-a', 'tenant-b'],
  });
  Connector.create({
    name: 'stripe-test',
    serviceType: 'stripe',
    displayName: 'Stripe Test',
    description: 'Stripe API',
    baseURL: 'https://api.stripe.com',
    auth: { type: 'api_key', apiKey: 'stripe-key' },
    tags: ['tenant-b'],
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('userId and connectors', () => {
  let ctx: AgentContextNextGen;

  beforeEach(() => {
    Connector.clear();
    Connector.setAccessPolicy(null);
  });

  afterEach(() => {
    ctx?.destroy();
    Connector.clear();
    Connector.setAccessPolicy(null);
  });

  // ==========================================================================
  // userId threading
  // ==========================================================================

  describe('userId threading', () => {
    it('should flow userId from config to ToolContext', () => {
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        userId: 'user-42',
      });

      const tc = ctx.tools.getToolContext();
      expect(tc?.userId).toBe('user-42');
    });

    it('should expose userId via getter', () => {
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        userId: 'user-42',
      });

      expect(ctx.userId).toBe('user-42');
    });

    it('should update ToolContext when userId setter is called', () => {
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
      });

      expect(ctx.tools.getToolContext()?.userId).toBeUndefined();

      ctx.userId = 'user-99';
      expect(ctx.userId).toBe('user-99');
      expect(ctx.tools.getToolContext()?.userId).toBe('user-99');
    });

    it('should clear userId when set to undefined', () => {
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        userId: 'user-42',
      });

      ctx.userId = undefined;
      expect(ctx.tools.getToolContext()?.userId).toBeUndefined();
    });

    it('should preserve agentId when userId changes', () => {
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        agentId: 'my-agent',
        userId: 'user-1',
      });

      expect(ctx.tools.getToolContext()?.agentId).toBe('my-agent');

      ctx.userId = 'user-2';
      expect(ctx.tools.getToolContext()?.agentId).toBe('my-agent');
      expect(ctx.tools.getToolContext()?.userId).toBe('user-2');
    });

    it('should include userId in session metadata on save', async () => {
      const storage = createMockStorage();
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        userId: 'user-42',
        storage,
      });

      await ctx.save('session-1');

      const stored = await storage.load('session-1');
      expect(stored?.state.metadata.userId).toBe('user-42');
    });

    it('should save undefined userId in metadata when not set', async () => {
      const storage = createMockStorage();
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        storage,
      });

      await ctx.save('session-1');

      const stored = await storage.load('session-1');
      expect(stored?.state.metadata.userId).toBeUndefined();
    });
  });

  // ==========================================================================
  // connectorRegistry on ToolContext
  // ==========================================================================

  describe('connectorRegistry on ToolContext', () => {
    it('should provide global registry when no connectors or policy set', () => {
      registerTestConnectors();
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
      });

      const registry = ctx.tools.getToolContext()?.connectorRegistry;
      expect(registry).toBeDefined();
      expect(registry!.list().sort()).toEqual(['github-test', 'slack-test', 'stripe-test']);
    });

    it('should list all connectors from registry', () => {
      registerTestConnectors();
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
      });

      const registry = ctx.tools.getToolContext()?.connectorRegistry;
      const all = registry!.listAll();
      expect(all.length).toBe(3);
      expect(all.map(c => c.name).sort()).toEqual(['github-test', 'slack-test', 'stripe-test']);
    });
  });

  // ==========================================================================
  // connectors allowlist
  // ==========================================================================

  describe('connectors allowlist', () => {
    it('should filter registry to only allowed connector names', () => {
      registerTestConnectors();
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        connectors: ['github-test', 'slack-test'],
      });

      const registry = ctx.tools.getToolContext()?.connectorRegistry;
      expect(registry!.list().sort()).toEqual(['github-test', 'slack-test']);
      expect(registry!.has('stripe-test')).toBe(false);
    });

    it('should allow get() for allowed connectors', () => {
      registerTestConnectors();
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        connectors: ['github-test'],
      });

      const registry = ctx.tools.getToolContext()?.connectorRegistry;
      const connector = registry!.get('github-test');
      expect(connector.name).toBe('github-test');
      expect(connector.displayName).toBe('GitHub Test');
    });

    it('should throw on get() for non-allowed connectors', () => {
      registerTestConnectors();
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        connectors: ['github-test'],
      });

      const registry = ctx.tools.getToolContext()?.connectorRegistry;
      expect(() => registry!.get('stripe-test')).toThrow(/not found/);
    });

    it('should return correct size', () => {
      registerTestConnectors();
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        connectors: ['github-test', 'slack-test'],
      });

      const registry = ctx.tools.getToolContext()?.connectorRegistry;
      expect(registry!.size()).toBe(2);
    });

    it('should return descriptions only for allowed connectors', () => {
      registerTestConnectors();
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        connectors: ['slack-test'],
      });

      const registry = ctx.tools.getToolContext()?.connectorRegistry;
      const desc = registry!.getDescriptionsForTools();
      expect(desc).toContain('slack-test');
      expect(desc).not.toContain('github-test');
      expect(desc).not.toContain('stripe-test');
    });

    it('should return info only for allowed connectors', () => {
      registerTestConnectors();
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        connectors: ['github-test'],
      });

      const registry = ctx.tools.getToolContext()?.connectorRegistry;
      const info = registry!.getInfo();
      expect(Object.keys(info)).toEqual(['github-test']);
      expect(info['github-test'].displayName).toBe('GitHub Test');
    });

    it('should handle non-existent connector names in allowlist gracefully', () => {
      registerTestConnectors();
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        connectors: ['github-test', 'nonexistent'],
      });

      const registry = ctx.tools.getToolContext()?.connectorRegistry;
      // Only the existing connector should be listed
      expect(registry!.list()).toEqual(['github-test']);
      expect(registry!.has('nonexistent')).toBe(false);
    });

    it('should update registry when connectors setter is called', () => {
      registerTestConnectors();
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        connectors: ['github-test'],
      });

      expect(ctx.tools.getToolContext()?.connectorRegistry!.list()).toEqual(['github-test']);

      ctx.connectors = ['slack-test', 'stripe-test'];
      const registry = ctx.tools.getToolContext()?.connectorRegistry;
      expect(registry!.list().sort()).toEqual(['slack-test', 'stripe-test']);
      expect(registry!.has('github-test')).toBe(false);
    });

    it('should return full registry when connectors cleared to undefined', () => {
      registerTestConnectors();
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        connectors: ['github-test'],
      });

      expect(ctx.tools.getToolContext()?.connectorRegistry!.list()).toEqual(['github-test']);

      ctx.connectors = undefined;
      expect(ctx.tools.getToolContext()?.connectorRegistry!.list().sort())
        .toEqual(['github-test', 'slack-test', 'stripe-test']);
    });
  });

  // ==========================================================================
  // userId scoping via access policy
  // ==========================================================================

  describe('userId scoping via access policy', () => {
    it('should scope connectors by userId when access policy is set', () => {
      registerTestConnectors();

      // Policy: only connectors tagged with tenant matching userId
      const policy: IConnectorAccessPolicy = {
        canAccess: (connector, context) => {
          const tags = connector.config?.tags as string[] | undefined;
          return !!tags && tags.includes(context.userId as string);
        },
      };
      Connector.setAccessPolicy(policy);

      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        userId: 'tenant-a',
      });

      const registry = ctx.tools.getToolContext()?.connectorRegistry;
      // tenant-a tagged connectors: github-test, slack-test
      expect(registry!.list().sort()).toEqual(['github-test', 'slack-test']);
      expect(registry!.has('stripe-test')).toBe(false);
    });

    it('should update scoped registry when userId changes', () => {
      registerTestConnectors();

      const policy: IConnectorAccessPolicy = {
        canAccess: (connector, context) => {
          const tags = connector.config?.tags as string[] | undefined;
          return !!tags && tags.includes(context.userId as string);
        },
      };
      Connector.setAccessPolicy(policy);

      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        userId: 'tenant-a',
      });

      expect(ctx.tools.getToolContext()?.connectorRegistry!.list().sort())
        .toEqual(['github-test', 'slack-test']);

      // Switch to tenant-b
      ctx.userId = 'tenant-b';
      expect(ctx.tools.getToolContext()?.connectorRegistry!.list().sort())
        .toEqual(['slack-test', 'stripe-test']);
    });

    it('should return full registry when no access policy and no userId', () => {
      registerTestConnectors();

      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
      });

      const registry = ctx.tools.getToolContext()?.connectorRegistry;
      expect(registry!.list().sort()).toEqual(['github-test', 'slack-test', 'stripe-test']);
    });
  });

  // ==========================================================================
  // combination: connectors allowlist + access policy
  // ==========================================================================

  describe('connectors allowlist + access policy', () => {
    it('should apply allowlist on top of access-policy-scoped view', () => {
      registerTestConnectors();

      // Policy: tenant-a sees github-test and slack-test
      const policy: IConnectorAccessPolicy = {
        canAccess: (connector, context) => {
          const tags = connector.config?.tags as string[] | undefined;
          return !!tags && tags.includes(context.userId as string);
        },
      };
      Connector.setAccessPolicy(policy);

      // Allowlist further restricts to just github-test
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        userId: 'tenant-a',
        connectors: ['github-test'],
      });

      const registry = ctx.tools.getToolContext()?.connectorRegistry;
      expect(registry!.list()).toEqual(['github-test']);
      expect(registry!.has('slack-test')).toBe(false);
    });

    it('should not allow access to connectors in allowlist but denied by policy', () => {
      registerTestConnectors();

      // Policy: tenant-a sees github-test and slack-test (not stripe-test)
      const policy: IConnectorAccessPolicy = {
        canAccess: (connector, context) => {
          const tags = connector.config?.tags as string[] | undefined;
          return !!tags && tags.includes(context.userId as string);
        },
      };
      Connector.setAccessPolicy(policy);

      // Allowlist includes stripe-test, but policy denies it for tenant-a
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        userId: 'tenant-a',
        connectors: ['github-test', 'stripe-test'],
      });

      const registry = ctx.tools.getToolContext()?.connectorRegistry;
      // stripe-test denied by policy even though it's in the allowlist
      expect(registry!.list()).toEqual(['github-test']);
      expect(registry!.has('stripe-test')).toBe(false);
    });
  });

  // ==========================================================================
  // descriptionFactory receives ToolContext
  // ==========================================================================

  describe('descriptionFactory receives ToolContext', () => {
    it('should call descriptionFactory with current ToolContext', () => {
      registerTestConnectors();
      ctx = AgentContextNextGen.create({
        model: 'gpt-4',
        userId: 'user-42',
        connectors: ['github-test'],
      });

      let receivedContext: any = null;
      const tool = {
        definition: {
          type: 'function' as const,
          function: {
            name: 'test_tool',
            description: 'static fallback',
            parameters: { type: 'object', properties: {} },
          },
        },
        descriptionFactory: (context: any) => {
          receivedContext = context;
          return 'dynamic description';
        },
        execute: async () => ({ ok: true }),
      };

      ctx.tools.register(tool);

      // getEnabled returns tools; descriptionFactory is available for callers
      const enabled = ctx.tools.getEnabled();
      const found = enabled.find(t => t.definition.function.name === 'test_tool');
      expect(found?.descriptionFactory).toBeDefined();

      // Call it with current ToolContext (as BaseAgent.getEnabledToolDefinitions does)
      const tc = ctx.tools.getToolContext();
      const desc = found!.descriptionFactory!(tc);

      expect(desc).toBe('dynamic description');
      expect(receivedContext?.userId).toBe('user-42');
      expect(receivedContext?.agentId).toBeDefined();
      expect(receivedContext?.connectorRegistry).toBeDefined();
      // The registry should be scoped to allowed connectors
      expect(receivedContext.connectorRegistry.list()).toEqual(['github-test']);
    });
  });
});
