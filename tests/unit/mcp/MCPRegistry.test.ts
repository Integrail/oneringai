/**
 * MCPRegistry Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MCPRegistry } from '../../../src/core/mcp/MCPRegistry.js';
import { MCPError } from '../../../src/domain/errors/MCPError.js';

describe('MCPRegistry', () => {
  beforeEach(() => {
    MCPRegistry.clear();
  });

  afterEach(() => {
    MCPRegistry.clear();
  });

  describe('create()', () => {
    it('should create and register an MCP client', () => {
      const client = MCPRegistry.create({
        name: 'test-server',
        transport: 'stdio',
        transportConfig: {
          command: 'echo',
          args: ['hello'],
        },
      });

      expect(client).toBeDefined();
      expect(client.name).toBe('test-server');
      expect(MCPRegistry.has('test-server')).toBe(true);
    });

    it('should throw error if server name already exists', () => {
      MCPRegistry.create({
        name: 'test-server',
        transport: 'stdio',
        transportConfig: { command: 'echo' },
      });

      expect(() => {
        MCPRegistry.create({
          name: 'test-server',
          transport: 'stdio',
          transportConfig: { command: 'echo' },
        });
      }).toThrow(MCPError);
    });

    it('should apply defaults to server config', () => {
      const client = MCPRegistry.create(
        {
          name: 'test-server',
          transport: 'stdio',
          transportConfig: { command: 'echo' },
        },
        {
          autoConnect: true,
          autoReconnect: false,
          reconnectIntervalMs: 10000,
        }
      );

      expect(client).toBeDefined();
    });
  });

  describe('get()', () => {
    it('should retrieve a registered client', () => {
      const created = MCPRegistry.create({
        name: 'test-server',
        transport: 'stdio',
        transportConfig: { command: 'echo' },
      });

      const retrieved = MCPRegistry.get('test-server');
      expect(retrieved).toBe(created);
    });

    it('should throw error if client not found', () => {
      expect(() => MCPRegistry.get('non-existent')).toThrow(MCPError);
    });
  });

  describe('has()', () => {
    it('should return true for existing client', () => {
      MCPRegistry.create({
        name: 'test-server',
        transport: 'stdio',
        transportConfig: { command: 'echo' },
      });

      expect(MCPRegistry.has('test-server')).toBe(true);
    });

    it('should return false for non-existing client', () => {
      expect(MCPRegistry.has('non-existent')).toBe(false);
    });
  });

  describe('list()', () => {
    it('should return empty array when no clients', () => {
      expect(MCPRegistry.list()).toEqual([]);
    });

    it('should return all registered client names', () => {
      MCPRegistry.create({
        name: 'server-1',
        transport: 'stdio',
        transportConfig: { command: 'echo' },
      });

      MCPRegistry.create({
        name: 'server-2',
        transport: 'stdio',
        transportConfig: { command: 'echo' },
      });

      const names = MCPRegistry.list();
      expect(names).toContain('server-1');
      expect(names).toContain('server-2');
      expect(names).toHaveLength(2);
    });
  });

  describe('getInfo()', () => {
    it('should return client info', () => {
      MCPRegistry.create({
        name: 'test-server',
        transport: 'stdio',
        transportConfig: { command: 'echo' },
      });

      const info = MCPRegistry.getInfo('test-server');
      expect(info).toMatchObject({
        name: 'test-server',
        state: 'disconnected',
        connected: false,
        toolCount: 0,
      });
    });

    it('should throw if client not found', () => {
      expect(() => MCPRegistry.getInfo('non-existent')).toThrow(MCPError);
    });
  });

  describe('getAllInfo()', () => {
    it('should return info for all clients', () => {
      MCPRegistry.create({
        name: 'server-1',
        transport: 'stdio',
        transportConfig: { command: 'echo' },
      });

      MCPRegistry.create({
        name: 'server-2',
        transport: 'stdio',
        transportConfig: { command: 'echo' },
      });

      const allInfo = MCPRegistry.getAllInfo();
      expect(allInfo).toHaveLength(2);
      expect(allInfo[0]).toHaveProperty('name');
      expect(allInfo[0]).toHaveProperty('state');
      expect(allInfo[0]).toHaveProperty('connected');
      expect(allInfo[0]).toHaveProperty('toolCount');
    });
  });

  describe('clear()', () => {
    it('should remove all clients', () => {
      MCPRegistry.create({
        name: 'server-1',
        transport: 'stdio',
        transportConfig: { command: 'echo' },
      });

      MCPRegistry.create({
        name: 'server-2',
        transport: 'stdio',
        transportConfig: { command: 'echo' },
      });

      expect(MCPRegistry.list()).toHaveLength(2);

      MCPRegistry.clear();

      expect(MCPRegistry.list()).toHaveLength(0);
      expect(MCPRegistry.has('server-1')).toBe(false);
      expect(MCPRegistry.has('server-2')).toBe(false);
    });
  });

  describe('createFromConfig()', () => {
    it('should create multiple clients from config', () => {
      const clients = MCPRegistry.createFromConfig({
        servers: [
          {
            name: 'server-1',
            transport: 'stdio',
            transportConfig: { command: 'echo' },
          },
          {
            name: 'server-2',
            transport: 'http',
            transportConfig: { url: 'http://localhost:3000' },
          },
        ],
      });

      expect(clients).toHaveLength(2);
      expect(MCPRegistry.has('server-1')).toBe(true);
      expect(MCPRegistry.has('server-2')).toBe(true);
    });

    it('should apply global defaults', () => {
      const clients = MCPRegistry.createFromConfig({
        servers: [
          {
            name: 'server-1',
            transport: 'stdio',
            transportConfig: { command: 'echo' },
          },
        ],
        defaults: {
          autoConnect: true,
          reconnectIntervalMs: 10000,
        },
      });

      expect(clients).toHaveLength(1);
    });
  });
});
