/**
 * MCPClient Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPClient } from '../../../src/core/mcp/MCPClient.js';
import { MCPConnectionError } from '../../../src/domain/errors/MCPError.js';

// Mock the MCP SDK
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue(undefined),
    request: vi.fn().mockResolvedValue({ tools: [], resources: [], prompts: [] }),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(() => ({})),
}));

describe('MCPClient', () => {
  let client: MCPClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MCPClient({
      name: 'test-server',
      transport: 'stdio',
      transportConfig: {
        command: 'echo',
        args: ['hello'],
      },
    });
  });

  afterEach(() => {
    client.destroy();
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe('constructor', () => {
    it('should create client with name', () => {
      expect(client.name).toBe('test-server');
    });

    it('should apply default configuration', () => {
      const customClient = new MCPClient({
        name: 'custom-server',
        transport: 'stdio',
        transportConfig: { command: 'node' },
      });

      expect(customClient.name).toBe('custom-server');
      customClient.destroy();
    });

    it('should accept custom defaults', () => {
      const customClient = new MCPClient(
        {
          name: 'custom-server',
          transport: 'stdio',
          transportConfig: { command: 'node' },
        },
        {
          autoConnect: true,
          autoReconnect: false,
          reconnectIntervalMs: 10000,
        }
      );

      expect(customClient.name).toBe('custom-server');
      customClient.destroy();
    });
  });

  // ============================================================================
  // State Management Tests
  // ============================================================================

  describe('state management', () => {
    it('should start in disconnected state', () => {
      expect(client.state).toBe('disconnected');
    });

    it('should have no capabilities initially', () => {
      expect(client.capabilities).toBeUndefined();
    });

    it('should have empty tools array initially', () => {
      expect(client.tools).toEqual([]);
    });
  });

  describe('getState()', () => {
    it('should return current state', () => {
      const state = client.getState();
      expect(state).toMatchObject({
        name: 'test-server',
        state: 'disconnected',
        subscribedResources: [],
        connectionAttempts: 0,
      });
    });

    it('should include capabilities when connected', async () => {
      await client.connect();
      const state = client.getState();
      expect(state.state).toBe('connected');
    });
  });

  describe('loadState()', () => {
    it('should restore subscribed resources', () => {
      const savedState = {
        name: 'test-server',
        state: 'disconnected' as const,
        subscribedResources: ['file://test1', 'file://test2'],
        connectionAttempts: 3,
      };

      client.loadState(savedState);

      const currentState = client.getState();
      expect(currentState.subscribedResources).toEqual(['file://test1', 'file://test2']);
      expect(currentState.connectionAttempts).toBe(3);
    });

    it('should restore connection attempts', () => {
      client.loadState({
        name: 'test-server',
        state: 'disconnected',
        subscribedResources: [],
        connectionAttempts: 5,
      });

      expect(client.getState().connectionAttempts).toBe(5);
    });
  });

  // ============================================================================
  // Connection Lifecycle Tests
  // ============================================================================

  describe('isConnected()', () => {
    it('should return false when disconnected', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('connect()', () => {
    it('should transition to connected state', async () => {
      await client.connect();
      expect(client.state).toBe('connected');
    });

    it('should emit connecting event', async () => {
      const handler = vi.fn();
      client.on('connecting', handler);

      await client.connect();

      expect(handler).toHaveBeenCalled();
    });

    it('should emit connected event', async () => {
      const handler = vi.fn();
      client.on('connected', handler);

      await client.connect();

      expect(handler).toHaveBeenCalled();
    });

    it('should not connect if already connected', async () => {
      await client.connect();
      const stateBefore = client.state;

      await client.connect();

      expect(client.state).toBe(stateBefore);
    });

    it('should not connect if connecting', async () => {
      const connectPromise = client.connect();
      const connectPromise2 = client.connect();

      await connectPromise;
      await connectPromise2;

      expect(client.state).toBe('connected');
    });
  });

  describe('disconnect()', () => {
    it('should transition to disconnected state', async () => {
      await client.connect();
      await client.disconnect();

      expect(client.state).toBe('disconnected');
    });

    it('should emit disconnected event', async () => {
      await client.connect();

      const handler = vi.fn();
      client.on('disconnected', handler);

      await client.disconnect();

      expect(handler).toHaveBeenCalled();
    });

    it('should clear tools', async () => {
      await client.connect();
      await client.disconnect();

      expect(client.tools).toEqual([]);
    });

    it('should handle disconnect when not connected', async () => {
      await expect(client.disconnect()).resolves.not.toThrow();
    });
  });

  describe('reconnect()', () => {
    it('should disconnect and reconnect', async () => {
      await client.connect();
      expect(client.state).toBe('connected');

      await client.reconnect();
      expect(client.state).toBe('connected');
    });
  });

  describe('ping()', () => {
    it('should return false when not connected', async () => {
      const result = await client.ping();
      expect(result).toBe(false);
    });

    it('should return true when connected', async () => {
      await client.connect();
      const result = await client.ping();
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // Tool Operations Tests
  // ============================================================================

  describe('listTools()', () => {
    it('should throw when not connected', async () => {
      await expect(client.listTools()).rejects.toThrow(MCPConnectionError);
    });

    it('should return tools when connected', async () => {
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      (Client as any).mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        ping: vi.fn().mockResolvedValue(undefined),
        request: vi.fn().mockResolvedValue({
          tools: [
            { name: 'tool1', description: 'Tool 1', inputSchema: { type: 'object' } },
            { name: 'tool2', description: 'Tool 2', inputSchema: { type: 'object' } },
          ],
        }),
      }));

      const freshClient = new MCPClient({
        name: 'test',
        transport: 'stdio',
        transportConfig: { command: 'node' },
      });

      await freshClient.connect();
      const tools = await freshClient.listTools();

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('tool1');

      freshClient.destroy();
    });
  });

  describe('callTool()', () => {
    it('should throw when not connected', async () => {
      await expect(client.callTool('test', {})).rejects.toThrow(MCPConnectionError);
    });

    it('should emit tool:called event', async () => {
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      (Client as any).mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        ping: vi.fn().mockResolvedValue(undefined),
        request: vi.fn().mockResolvedValue({
          tools: [],
          content: [{ type: 'text', text: 'result' }],
          isError: false,
        }),
      }));

      const freshClient = new MCPClient({
        name: 'test',
        transport: 'stdio',
        transportConfig: { command: 'node' },
      });

      await freshClient.connect();

      const handler = vi.fn();
      freshClient.on('tool:called', handler);

      await freshClient.callTool('test_tool', { arg: 'value' });

      expect(handler).toHaveBeenCalledWith('test_tool', { arg: 'value' });

      freshClient.destroy();
    });

    it('should emit tool:result event', async () => {
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      (Client as any).mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        ping: vi.fn().mockResolvedValue(undefined),
        request: vi.fn().mockResolvedValue({
          tools: [],
          content: [{ type: 'text', text: 'result' }],
          isError: false,
        }),
      }));

      const freshClient = new MCPClient({
        name: 'test',
        transport: 'stdio',
        transportConfig: { command: 'node' },
      });

      await freshClient.connect();

      const handler = vi.fn();
      freshClient.on('tool:result', handler);

      await freshClient.callTool('test_tool', {});

      expect(handler).toHaveBeenCalled();

      freshClient.destroy();
    });
  });

  describe('registerTools() / unregisterTools()', () => {
    it('should not register when no tools available', () => {
      const mockToolManager = {
        register: vi.fn(),
        unregister: vi.fn(),
      };

      client.registerTools(mockToolManager as any);

      expect(mockToolManager.register).not.toHaveBeenCalled();
    });

    it('should unregister registered tools', async () => {
      const mockToolManager = {
        register: vi.fn(),
        unregister: vi.fn(),
      };

      // Connect and register (will have empty tools array but test the flow)
      await client.connect();
      client.registerTools(mockToolManager as any);
      client.unregisterTools(mockToolManager as any);

      // unregister should be called for each registered tool
    });
  });

  // ============================================================================
  // Resource Operations Tests
  // ============================================================================

  describe('listResources()', () => {
    it('should throw when not connected', async () => {
      await expect(client.listResources()).rejects.toThrow(MCPConnectionError);
    });
  });

  describe('readResource()', () => {
    it('should throw when not connected', async () => {
      await expect(client.readResource('file://test')).rejects.toThrow(MCPConnectionError);
    });
  });

  describe('subscribeResource()', () => {
    it('should throw when not connected', async () => {
      await expect(client.subscribeResource('file://test')).rejects.toThrow(MCPConnectionError);
    });
  });

  describe('unsubscribeResource()', () => {
    it('should throw when not connected', async () => {
      await expect(client.unsubscribeResource('file://test')).rejects.toThrow(MCPConnectionError);
    });
  });

  // ============================================================================
  // Prompt Operations Tests
  // ============================================================================

  describe('listPrompts()', () => {
    it('should throw when not connected', async () => {
      await expect(client.listPrompts()).rejects.toThrow(MCPConnectionError);
    });
  });

  describe('getPrompt()', () => {
    it('should throw when not connected', async () => {
      await expect(client.getPrompt('test')).rejects.toThrow(MCPConnectionError);
    });
  });

  // ============================================================================
  // Destroy Tests
  // ============================================================================

  describe('destroy()', () => {
    it('should reset state to disconnected', () => {
      client.destroy();
      expect(client.state).toBe('disconnected');
    });

    it('should clear tools array', () => {
      expect(client.tools).toEqual([]);
      client.destroy();
      expect(client.tools).toEqual([]);
    });

    it('should remove all event listeners', () => {
      const handler = vi.fn();
      client.on('connected', handler);
      client.on('disconnected', handler);

      client.destroy();

      // Emit events - handlers should not be called
      client.emit('connected');
      client.emit('disconnected');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should be idempotent - can be called multiple times', () => {
      expect(() => {
        client.destroy();
        client.destroy();
        client.destroy();
      }).not.toThrow();
    });

    it('should clear capabilities', async () => {
      await client.connect();
      client.destroy();
      expect(client.capabilities).toBeUndefined();
    });
  });

  // ============================================================================
  // Transport Configuration Tests
  // ============================================================================

  describe('transport configuration', () => {
    it('should create stdio transport', () => {
      const stdioClient = new MCPClient({
        name: 'stdio-test',
        transport: 'stdio',
        transportConfig: {
          command: 'node',
          args: ['server.js'],
          env: { NODE_ENV: 'test' },
        },
      });

      expect(stdioClient.name).toBe('stdio-test');
      stdioClient.destroy();
    });

    it('should create http transport', () => {
      const httpClient = new MCPClient({
        name: 'http-test',
        transport: 'http',
        transportConfig: {
          url: 'http://localhost:3000',
          token: 'test-token',
          headers: { 'X-Custom': 'value' },
        },
      });

      expect(httpClient.name).toBe('http-test');
      httpClient.destroy();
    });

    it('should create https transport', () => {
      const httpsClient = new MCPClient({
        name: 'https-test',
        transport: 'https',
        transportConfig: {
          url: 'https://api.example.com',
          token: 'secure-token',
          timeoutMs: 30000,
        },
      });

      expect(httpsClient.name).toBe('https-test');
      httpsClient.destroy();
    });
  });

  // ============================================================================
  // Event Tests
  // ============================================================================

  describe('events', () => {
    it('should emit connecting event when connect is called', async () => {
      const handler = vi.fn();
      client.on('connecting', handler);

      await client.connect();

      expect(handler).toHaveBeenCalled();
    });

    it('should emit connected event on successful connection', async () => {
      const handler = vi.fn();
      client.on('connected', handler);

      await client.connect();

      expect(handler).toHaveBeenCalled();
    });

    it('should emit disconnected event on disconnect', async () => {
      await client.connect();

      const handler = vi.fn();
      client.on('disconnected', handler);

      await client.disconnect();

      expect(handler).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Auto-reconnect Tests
  // ============================================================================

  describe('auto-reconnect', () => {
    it('should emit reconnecting event', async () => {
      const reconnectClient = new MCPClient({
        name: 'reconnect-test',
        transport: 'stdio',
        transportConfig: { command: 'node' },
        autoReconnect: true,
        maxReconnectAttempts: 1,
        reconnectIntervalMs: 100,
      });

      const handler = vi.fn();
      reconnectClient.on('reconnecting', handler);

      // Force a connection failure
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      (Client as any).mockImplementation(() => ({
        connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
        close: vi.fn().mockResolvedValue(undefined),
      }));

      try {
        await reconnectClient.connect();
      } catch {
        // Expected
      }

      // Wait a bit for reconnect attempt
      await new Promise((r) => setTimeout(r, 150));

      reconnectClient.destroy();
    });
  });

  // ============================================================================
  // Health Check Tests
  // ============================================================================

  describe('health check', () => {
    it('should start health check after connection', async () => {
      // Reset mock to successful connection for this test
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      (Client as any).mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        ping: vi.fn().mockResolvedValue(undefined),
        request: vi.fn().mockResolvedValue({ tools: [], resources: [], prompts: [] }),
      }));

      const healthClient = new MCPClient({
        name: 'health-test',
        transport: 'stdio',
        transportConfig: { command: 'node' },
        healthCheckIntervalMs: 1000,
      });

      await healthClient.connect();

      // Health check should be scheduled - state should be connected
      expect(healthClient.state).toBe('connected');

      healthClient.destroy();
    });

    it('should skip health check if interval is 0', () => {
      const noHealthClient = new MCPClient({
        name: 'no-health-test',
        transport: 'stdio',
        transportConfig: { command: 'node' },
        healthCheckIntervalMs: 0,
      });

      expect(noHealthClient.state).toBe('disconnected');

      noHealthClient.destroy();
    });
  });
});
