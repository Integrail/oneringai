/**
 * MCP HTTP/HTTPS Transport Integration Tests
 *
 * Note: These tests require a running MCP server accessible via HTTP/HTTPS.
 * To run these tests with a local server:
 *
 * 1. Start an MCP server with HTTP support (e.g., using @modelcontextprotocol/sdk)
 * 2. Set the MCP_TEST_SERVER_URL environment variable
 * 3. Run: MCP_TEST_SERVER_URL=http://localhost:3000/mcp npm test
 *
 * The tests will be skipped if no test server is configured.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPRegistry } from '../../../src/core/mcp/MCPRegistry.js';
import { MCPConnectionError } from '../../../src/domain/errors/MCPError.js';

const TEST_SERVER_URL = process.env.MCP_TEST_SERVER_URL;
const SKIP_HTTP_TESTS = !TEST_SERVER_URL;

describe.skipIf(SKIP_HTTP_TESTS)('MCP HTTP Integration', () => {
  let client: ReturnType<typeof MCPRegistry.get>;

  beforeAll(() => {
    MCPRegistry.clear();

    client = MCPRegistry.create({
      name: 'http-test-server',
      transport: 'http',
      transportConfig: {
        url: TEST_SERVER_URL!,
        timeoutMs: 10000,
        reconnection: {
          maxRetries: 2,
          initialReconnectionDelay: 1000,
        },
      },
    });
  });

  afterAll(async () => {
    try {
      if (client.isConnected()) {
        await client.disconnect();
      }
      MCPRegistry.clear();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should connect to HTTP MCP server', async () => {
    try {
      await client.connect();
      expect(client.isConnected()).toBe(true);
      expect(client.state).toBe('connected');
    } catch (error) {
      if (error instanceof MCPConnectionError) {
        console.warn('HTTP server not available:', error.message);
        // Skip test if server is not available
        return;
      }
      throw error;
    }
  }, 15000);

  it('should discover tools from HTTP server', async () => {
    if (!client.isConnected()) {
      try {
        await client.connect();
      } catch (error) {
        console.warn('Skipping: HTTP server not available');
        return;
      }
    }

    const tools = await client.listTools();
    expect(Array.isArray(tools)).toBe(true);
    console.log(`Discovered ${tools.length} tools from HTTP server`);
  }, 15000);

  it('should handle connection timeout', async () => {
    // Create client with very short timeout
    const timeoutClient = MCPRegistry.create({
      name: 'timeout-test',
      transport: 'http',
      transportConfig: {
        url: 'http://example.com:9999/mcp', // Non-existent server
        timeoutMs: 1000,
        reconnection: {
          maxRetries: 0, // Don't retry
        },
      },
    });

    await expect(timeoutClient.connect()).rejects.toThrow();
  }, 10000);

  it('should maintain session across reconnects', async () => {
    if (!client.isConnected()) {
      try {
        await client.connect();
      } catch (error) {
        console.warn('Skipping: HTTP server not available');
        return;
      }
    }

    // Get initial state
    const initialState = client.getState();

    // Disconnect
    await client.disconnect();
    expect(client.isConnected()).toBe(false);

    // Reconnect
    await client.reconnect();
    expect(client.isConnected()).toBe(true);

    // State should be similar (though timestamps may differ)
    const newState = client.getState();
    expect(newState.name).toBe(initialState.name);
  }, 15000);

  it('should emit HTTP-specific events', async () => {
    const events: string[] = [];

    client.on('connected', () => events.push('connected'));
    client.on('disconnected', () => events.push('disconnected'));
    client.on('reconnecting', () => events.push('reconnecting'));

    if (client.isConnected()) {
      await client.disconnect();
    }

    try {
      await client.connect();
      expect(events).toContain('connected');
    } catch (error) {
      console.warn('Skipping: HTTP server not available');
      return;
    }
  }, 15000);
});

// Always run these tests (they test the client setup, not actual connection)
describe('MCP HTTP Configuration', () => {
  afterAll(() => {
    MCPRegistry.clear();
  });

  it('should accept HTTPS URLs', () => {
    const client = MCPRegistry.create({
      name: 'https-server',
      transport: 'https',
      transportConfig: {
        url: 'https://example.com/mcp',
        token: 'test-token',
      },
    });

    expect(client).toBeDefined();
    expect(client.name).toBe('https-server');
  });

  it('should accept custom headers', () => {
    const client = MCPRegistry.create({
      name: 'custom-headers',
      transport: 'http',
      transportConfig: {
        url: 'http://localhost:3000/mcp',
        headers: {
          'X-Custom-Header': 'value',
          'X-API-Version': '1.0',
        },
      },
    });

    expect(client).toBeDefined();
  });

  it('should accept reconnection options', () => {
    const client = MCPRegistry.create({
      name: 'reconnect-config',
      transport: 'http',
      transportConfig: {
        url: 'http://localhost:3000/mcp',
        reconnection: {
          maxReconnectionDelay: 60000,
          initialReconnectionDelay: 2000,
          reconnectionDelayGrowFactor: 2.0,
          maxRetries: 10,
        },
      },
    });

    expect(client).toBeDefined();
  });

  it('should support bearer token authentication', () => {
    const client = MCPRegistry.create({
      name: 'auth-test',
      transport: 'https',
      transportConfig: {
        url: 'https://api.example.com/mcp',
        token: 'my-secret-token',
      },
    });

    expect(client).toBeDefined();
  });
});
