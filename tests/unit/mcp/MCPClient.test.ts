/**
 * MCPClient Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPClient } from '../../../src/core/mcp/MCPClient.js';

describe('MCPClient', () => {
  let client: MCPClient;

  beforeEach(() => {
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

  describe('destroy()', () => {
    it('should reset state to disconnected', () => {
      client.destroy();
      expect(client.state).toBe('disconnected');
    });

    it('should clear tools array', () => {
      // Access internal _tools via property
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
  });

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

  describe('isConnected()', () => {
    it('should return false when disconnected', () => {
      expect(client.isConnected()).toBe(false);
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
  });

  describe('events', () => {
    it('should emit connecting event when connect is called', async () => {
      const handler = vi.fn();
      client.on('connecting', handler);

      // connect() will fail but should emit connecting first
      try {
        await client.connect();
      } catch {
        // Expected to fail - no actual MCP server
      }

      expect(handler).toHaveBeenCalled();
    });
  });
});
