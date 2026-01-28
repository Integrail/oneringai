/**
 * BaseAgent Unit Tests
 *
 * Tests the abstract BaseAgent class through a concrete test implementation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BaseAgent, BaseAgentConfig, BaseAgentEvents } from '@/core/BaseAgent.js';
import { Connector, Vendor } from '@/core/index.js';
import { InMemorySessionStorage } from '@/infrastructure/storage/InMemorySessionStorage.js';
import { ToolFunction } from '@/domain/entities/Tool.js';

/**
 * Concrete implementation for testing
 */
class TestAgent extends BaseAgent<BaseAgentConfig, BaseAgentEvents> {
  public destroyCalled = false;

  constructor(config: BaseAgentConfig) {
    super(config, 'TestAgent');

    // Initialize session after other setup (matches real agents)
    this.initializeSession(config.session);
  }

  protected getAgentType(): 'agent' | 'task-agent' | 'universal-agent' {
    return 'agent';
  }

  protected prepareSessionState(): void {
    // Test implementation - add custom state
    if (this._session) {
      this._session.custom['testState'] = { prepared: true };
    }
  }

  // Expose protected method for testing
  public async ensureLoaded(): Promise<void> {
    await this.ensureSessionLoaded();
  }

  destroy(): void {
    this.destroyCalled = true;
    this.baseDestroy();
    this.runCleanupCallbacks();
  }
}

describe('BaseAgent', () => {
  let testConnector: Connector;

  beforeEach(() => {
    // Create test connector
    Connector.clear();
    testConnector = Connector.create({
      name: 'test-connector',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test-key' },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    Connector.clear();
  });

  describe('Constructor', () => {
    it('should resolve connector from string', () => {
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      expect(agent.connector).toBe(testConnector);
      agent.destroy();
    });

    it('should accept connector instance', () => {
      const agent = new TestAgent({
        connector: testConnector,
        model: 'gpt-4',
      });

      expect(agent.connector).toBe(testConnector);
      agent.destroy();
    });

    it('should set name from config', () => {
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
        name: 'my-agent',
      });

      expect(agent.name).toBe('my-agent');
      agent.destroy();
    });

    it('should generate name if not provided', () => {
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      expect(agent.name).toMatch(/^agent-\d+$/);
      agent.destroy();
    });

    it('should initialize tool manager', () => {
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      expect(agent.tools).toBeDefined();
      expect(agent.tools.list()).toHaveLength(0);
      agent.destroy();
    });

    it('should register tools from config', () => {
      const tool: ToolFunction = {
        definition: {
          type: 'function',
          function: {
            name: 'test_tool',
            description: 'A test tool',
            parameters: { type: 'object', properties: {} },
          },
        },
        execute: async () => ({ result: 'test' }),
      };

      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
        tools: [tool],
      });

      expect(agent.tools.list()).toContain('test_tool');
      agent.destroy();
    });

    it('should initialize permission manager', () => {
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      expect(agent.permissions).toBeDefined();
      agent.destroy();
    });
  });

  describe('Session Management', () => {
    it('should create session when configured', async () => {
      const storage = new InMemorySessionStorage();
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
        session: { storage },
      });

      await agent.ensureLoaded();

      expect(agent.hasSession()).toBe(true);
      expect(agent.getSessionId()).toBeTruthy();
      agent.destroy();
    });

    it('should return null session ID when not configured', () => {
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      expect(agent.hasSession()).toBe(false);
      expect(agent.getSessionId()).toBeNull();
      agent.destroy();
    });

    it('should save session', async () => {
      const storage = new InMemorySessionStorage();
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
        session: { storage },
      });

      await agent.ensureLoaded();
      await agent.saveSession();

      const sessionId = agent.getSessionId()!;
      const saved = await storage.load(sessionId);
      expect(saved).toBeDefined();
      expect(saved!.custom['testState']).toEqual({ prepared: true });
      agent.destroy();
    });

    it('should throw when saving without session', async () => {
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      await expect(agent.saveSession()).rejects.toThrow('Session not enabled');
      agent.destroy();
    });

    it('should update and get session data', async () => {
      const storage = new InMemorySessionStorage();
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
        session: { storage },
      });

      await agent.ensureLoaded();
      agent.updateSessionData('myKey', { value: 42 });

      expect(agent.getSessionData<{ value: number }>('myKey')).toEqual({ value: 42 });
      agent.destroy();
    });

    it('should resume existing session', async () => {
      const storage = new InMemorySessionStorage();

      // Create and save first agent
      const agent1 = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
        session: { storage },
      });
      await agent1.ensureLoaded();
      const sessionId = agent1.getSessionId()!;
      agent1.updateSessionData('persistedKey', 'persistedValue');
      await agent1.saveSession();
      agent1.destroy();

      // Resume with second agent
      const agent2 = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
        session: { storage, id: sessionId },
      });
      await agent2.ensureLoaded();

      expect(agent2.getSessionId()).toBe(sessionId);
      expect(agent2.getSessionData('persistedKey')).toBe('persistedValue');
      agent2.destroy();
    });
  });

  describe('Lifecycle', () => {
    it('should track destroyed state', () => {
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      expect(agent.isDestroyed).toBe(false);
      agent.destroy();
      expect(agent.isDestroyed).toBe(true);
    });

    it('should run cleanup callbacks', async () => {
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();

      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      agent.onCleanup(cleanup1);
      agent.onCleanup(cleanup2);
      agent.destroy();

      // Wait for async cleanup
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(cleanup1).toHaveBeenCalled();
      expect(cleanup2).toHaveBeenCalled();
    });

    it('should not destroy twice', () => {
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      agent.destroy();
      const firstDestroyCall = agent.destroyCalled;

      // Second destroy should be no-op
      agent.destroy();

      expect(firstDestroyCall).toBe(true);
    });
  });
});
