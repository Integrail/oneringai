/**
 * BaseAgent Unit Tests
 *
 * Tests the abstract BaseAgent class through a concrete test implementation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BaseAgent, BaseAgentConfig, BaseAgentEvents } from '@/core/BaseAgent.js';
import { Connector, Vendor } from '@/core/index.js';
import type { ToolFunction } from '@/domain/entities/Tool.js';
import type { IContextStorage, StoredContextSession, ContextSessionSummary, ContextSessionMetadata } from '@/domain/interfaces/IContextStorage.js';
import type { SerializedAgentContextState } from '@/core/AgentContext.js';

/**
 * Create a mock IContextStorage for testing
 */
function createMockStorage(): IContextStorage & { sessions: Map<string, StoredContextSession> } {
  const sessions = new Map<string, StoredContextSession>();

  return {
    sessions,
    async save(sessionId: string, state: SerializedAgentContextState, metadata?: ContextSessionMetadata): Promise<void> {
      const now = new Date().toISOString();
      const existing = sessions.get(sessionId);
      sessions.set(sessionId, {
        version: 1,
        sessionId,
        createdAt: existing?.createdAt ?? now,
        lastSavedAt: now,
        state,
        metadata: metadata ?? {},
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
      return Array.from(sessions.values()).map(s => ({
        sessionId: s.sessionId,
        createdAt: new Date(s.createdAt),
        lastSavedAt: new Date(s.lastSavedAt),
        messageCount: s.state.core?.history?.length ?? 0,
        memoryEntryCount: s.state.memory?.entries?.length ?? 0,
        metadata: s.metadata,
      }));
    },
    getPath(): string {
      return '/mock/storage';
    },
  };
}

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
      // AgentContext auto-registers feature-aware tools (introspection + memory tools)
      // so even with no user tools, there are auto-registered tools
      expect(agent.tools.list().length).toBeGreaterThan(0);
      expect(agent.tools.has('context_stats')).toBe(true);
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
      const storage = createMockStorage();
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
        session: { storage },
      });

      await agent.ensureLoaded();

      expect(agent.hasSession()).toBe(true);
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

    it('should save session with explicit session ID', async () => {
      const storage = createMockStorage();
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
        session: { storage },
      });

      await agent.ensureLoaded();
      await agent.saveSession('test-session-001');

      const sessionId = agent.getSessionId()!;
      expect(sessionId).toBe('test-session-001');
      const saved = await storage.load(sessionId);
      expect(saved).toBeDefined();
      expect(saved!.state).toBeDefined();
      expect(saved!.state.core).toBeDefined();
      agent.destroy();
    });

    it('should throw when saving without session storage', async () => {
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      await expect(agent.saveSession()).rejects.toThrow();
      agent.destroy();
    });

    it('should resume existing session', async () => {
      const storage = createMockStorage();

      // Create and save first agent
      const agent1 = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
        session: { storage },
      });
      await agent1.ensureLoaded();
      const sessionId = 'test-session-resume';

      // Add a message to history so we can verify it persists
      await agent1.context.addMessage('user', 'Hello from agent1');
      await agent1.saveSession(sessionId);
      const history1 = agent1.context.getHistory();
      expect(history1.length).toBe(1);
      agent1.destroy();

      // Resume with second agent
      const agent2 = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
        session: { storage, id: sessionId },
      });
      await agent2.ensureLoaded();

      expect(agent2.getSessionId()).toBe(sessionId);
      // History should be restored
      // getHistory() now returns InputItem[] where content is Content[]
      const history2 = agent2.context.getHistory();
      expect(history2.length).toBe(1);
      expect(history2[0].role).toBe('user');
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

  describe('Direct LLM Access', () => {
    it('should call runDirect with string input', async () => {
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      // Mock the provider
      const mockGenerate = vi.fn().mockResolvedValue({
        output_text: 'Hello, world!',
        output: [],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      });

      // Access private provider and mock it
      (agent as any)._provider = {
        generate: mockGenerate,
        streamGenerate: vi.fn(),
      };

      const response = await agent.runDirect('Hello');

      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          input: 'Hello',
          tools: undefined,
        })
      );
      expect(response.output_text).toBe('Hello, world!');

      agent.destroy();
    });

    it('should call runDirect with options', async () => {
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      const mockGenerate = vi.fn().mockResolvedValue({
        output_text: 'Response',
        output: [],
      });

      (agent as any)._provider = {
        generate: mockGenerate,
        streamGenerate: vi.fn(),
      };

      await agent.runDirect('Test input', {
        instructions: 'Be concise',
        temperature: 0.5,
        maxOutputTokens: 100,
      });

      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          input: 'Test input',
          instructions: 'Be concise',
          temperature: 0.5,
          max_output_tokens: 100,
        })
      );

      agent.destroy();
    });

    it('should include tools when includeTools is true', async () => {
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

      const mockGenerate = vi.fn().mockResolvedValue({
        output_text: 'Response',
        output: [],
      });

      (agent as any)._provider = {
        generate: mockGenerate,
        streamGenerate: vi.fn(),
      };

      await agent.runDirect('Test', { includeTools: true });

      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({
              function: expect.objectContaining({ name: 'test_tool' }),
            }),
          ]),
        })
      );

      agent.destroy();
    });

    it('should NOT include tools by default', async () => {
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

      const mockGenerate = vi.fn().mockResolvedValue({
        output_text: 'Response',
        output: [],
      });

      (agent as any)._provider = {
        generate: mockGenerate,
        streamGenerate: vi.fn(),
      };

      await agent.runDirect('Test');

      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: undefined,
        })
      );

      agent.destroy();
    });

    it('should support multimodal input (InputItem[])', async () => {
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      const mockGenerate = vi.fn().mockResolvedValue({
        output_text: 'I see an image',
        output: [],
      });

      (agent as any)._provider = {
        generate: mockGenerate,
        streamGenerate: vi.fn(),
      };

      const inputItems = [
        {
          type: 'message' as const,
          role: 'user' as const,
          content: [
            { type: 'input_text', text: 'What is in this image?' },
            { type: 'input_image', image_url: 'https://example.com/image.png' },
          ],
        },
      ];

      const response = await agent.runDirect(inputItems);

      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          input: inputItems,
        })
      );
      expect(response.output_text).toBe('I see an image');

      agent.destroy();
    });

    it('should throw when agent is destroyed', async () => {
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      agent.destroy();

      await expect(agent.runDirect('Hello')).rejects.toThrow('Agent has been destroyed');
    });

    it('should stream with streamDirect', async () => {
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      const mockEvents = [
        { type: 'output_text_delta', delta: 'Hello' },
        { type: 'output_text_delta', delta: ' world' },
        { type: 'response.done' },
      ];

      const mockStreamGenerate = async function* () {
        for (const event of mockEvents) {
          yield event;
        }
      };

      (agent as any)._provider = {
        generate: vi.fn(),
        streamGenerate: mockStreamGenerate,
      };

      const events: any[] = [];
      for await (const event of agent.streamDirect('Tell me something')) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      expect(events[0]).toEqual({ type: 'output_text_delta', delta: 'Hello' });
      expect(events[1]).toEqual({ type: 'output_text_delta', delta: ' world' });

      agent.destroy();
    });

    it('should NOT track messages in history when using runDirect', async () => {
      const agent = new TestAgent({
        connector: 'test-connector',
        model: 'gpt-4',
      });

      const mockGenerate = vi.fn().mockResolvedValue({
        output_text: 'Response',
        output: [],
      });

      (agent as any)._provider = {
        generate: mockGenerate,
        streamGenerate: vi.fn(),
      };

      // Make a direct call
      await agent.runDirect('Hello');

      // Check that history is NOT affected
      const history = agent.context.getHistory();
      expect(history).toHaveLength(0);

      agent.destroy();
    });
  });
});
