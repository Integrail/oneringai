import { describe, it, expect, beforeEach } from 'vitest';
import { StorageRegistry } from '../../../src/core/StorageRegistry.js';
import type { StorageConfig } from '../../../src/core/StorageRegistry.js';

import type { ICustomToolStorage } from '../../../src/domain/interfaces/ICustomToolStorage.js';

// Minimal mocks implementing enough interface to test registry behavior
const mockCustomToolFactoryInstance = { save: async () => {}, load: async () => null, list: async () => [], delete: async () => {}, exists: async () => false, getPath: () => '/mock' } as unknown as ICustomToolStorage;
const mockCustomToolFactory = (() => mockCustomToolFactoryInstance) as StorageConfig['customTools'];
const mockMediaStorage = { save: async () => ({ path: '/mock' }), load: async () => null } as unknown as StorageConfig['media'];
const mockTokenStorage = { getToken: async () => null, saveToken: async () => {} } as unknown as StorageConfig['oauthTokens'];

describe('StorageRegistry', () => {
  beforeEach(() => {
    StorageRegistry.reset();
  });

  describe('configure()', () => {
    it('should set multiple backends at once', () => {
      StorageRegistry.configure({
        customTools: mockCustomToolFactory,
        media: mockMediaStorage,
      });

      expect(StorageRegistry.get('customTools')).toBe(mockCustomToolFactory);
      expect(StorageRegistry.get('media')).toBe(mockMediaStorage);
    });

    it('should not set undefined values', () => {
      StorageRegistry.configure({ customTools: undefined });
      expect(StorageRegistry.has('customTools')).toBe(false);
    });
  });

  describe('set() / get()', () => {
    it('should store and retrieve a value', () => {
      StorageRegistry.set('customTools', mockCustomToolFactory);
      expect(StorageRegistry.get('customTools')).toBe(mockCustomToolFactory);
    });

    it('should return undefined for unconfigured key', () => {
      expect(StorageRegistry.get('customTools')).toBeUndefined();
    });
  });

  describe('has()', () => {
    it('should return true for configured key', () => {
      StorageRegistry.set('media', mockMediaStorage);
      expect(StorageRegistry.has('media')).toBe(true);
    });

    it('should return false for unconfigured key', () => {
      expect(StorageRegistry.has('media')).toBe(false);
    });
  });

  describe('resolve()', () => {
    it('should return configured value when present', () => {
      StorageRegistry.set('customTools', mockCustomToolFactory);

      const anotherMock = { notTheSame: true } as unknown as StorageConfig['customTools'];
      const result = StorageRegistry.resolve('customTools', () => anotherMock);

      expect(result).toBe(mockCustomToolFactory);
    });

    it('should call defaultFactory and cache when nothing configured', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return mockCustomToolFactory;
      };

      const result1 = StorageRegistry.resolve('customTools', factory);
      expect(result1).toBe(mockCustomToolFactory);
      expect(callCount).toBe(1);

      // Second call should use cached value, not call factory again
      const result2 = StorageRegistry.resolve('customTools', factory);
      expect(result2).toBe(mockCustomToolFactory);
      expect(callCount).toBe(1);
    });
  });

  describe('reset()', () => {
    it('should clear all entries', () => {
      StorageRegistry.set('customTools', mockCustomToolFactory);
      StorageRegistry.set('media', mockMediaStorage);
      StorageRegistry.set('oauthTokens', mockTokenStorage);

      StorageRegistry.reset();

      expect(StorageRegistry.has('customTools')).toBe(false);
      expect(StorageRegistry.has('media')).toBe(false);
      expect(StorageRegistry.has('oauthTokens')).toBe(false);
    });
  });

  describe('per-agent factories', () => {
    it('should store and retrieve factory functions', () => {
      const sessionFactory = (agentId: string) => ({ agentId } as unknown as StorageConfig['sessions'] extends (...args: any[]) => infer R ? R : never);
      StorageRegistry.set('sessions', sessionFactory as StorageConfig['sessions']);

      const factory = StorageRegistry.get('sessions');
      expect(factory).toBe(sessionFactory);
    });

    it('should store workingMemory factory', () => {
      const memFactory = () => ({ type: 'custom' } as unknown as StorageConfig['workingMemory'] extends (...args: any[]) => infer R ? R : never);
      StorageRegistry.set('workingMemory', memFactory as StorageConfig['workingMemory']);

      const factory = StorageRegistry.get('workingMemory');
      expect(factory).toBe(memFactory);
    });
  });

  describe('setContext() / getContext()', () => {
    it('should set and get context', () => {
      StorageRegistry.setContext({ userId: 'alice', tenantId: 'acme' });
      expect(StorageRegistry.getContext()).toEqual({ userId: 'alice', tenantId: 'acme' });
    });

    it('should return undefined when no context set', () => {
      expect(StorageRegistry.getContext()).toBeUndefined();
    });

    it('should clear context on reset', () => {
      StorageRegistry.setContext({ userId: 'alice' });
      StorageRegistry.reset();
      expect(StorageRegistry.getContext()).toBeUndefined();
    });

    it('should clear context when set to undefined', () => {
      StorageRegistry.setContext({ userId: 'alice' });
      StorageRegistry.setContext(undefined);
      expect(StorageRegistry.getContext()).toBeUndefined();
    });
  });

  describe('factory context passing', () => {
    it('should pass context to session factory when invoked by consumer', () => {
      let receivedContext: unknown;
      const sessionFactory = (_agentId: string, ctx?: Record<string, unknown>) => {
        receivedContext = ctx;
        return {} as any;
      };

      StorageRegistry.set('sessions', sessionFactory);
      StorageRegistry.setContext({ userId: 'bob', tenantId: 'corp' });

      // Simulate what AgentContextNextGen does: get factory, call with context
      const factory = StorageRegistry.get('sessions')!;
      factory('agent-1', StorageRegistry.getContext());

      expect(receivedContext).toEqual({ userId: 'bob', tenantId: 'corp' });
    });

    it('should pass context to persistentInstructions factory', () => {
      let receivedArgs: unknown[];
      const piFactory = (...args: unknown[]) => {
        receivedArgs = args;
        return {} as any;
      };

      StorageRegistry.set('persistentInstructions', piFactory as any);
      StorageRegistry.setContext({ userId: 'carol' });

      const factory = StorageRegistry.get('persistentInstructions')!;
      factory('agent-2', StorageRegistry.getContext());

      expect(receivedArgs![0]).toBe('agent-2');
      expect(receivedArgs![1]).toEqual({ userId: 'carol' });
    });

    it('should pass context to workingMemory factory', () => {
      let receivedContext: unknown;
      const wmFactory = (ctx?: Record<string, unknown>) => {
        receivedContext = ctx;
        return {} as any;
      };

      StorageRegistry.set('workingMemory', wmFactory as any);
      StorageRegistry.setContext({ tenantId: 'acme' });

      const factory = StorageRegistry.get('workingMemory')!;
      factory(StorageRegistry.getContext());

      expect(receivedContext).toEqual({ tenantId: 'acme' });
    });
  });

  describe('overwrite behavior', () => {
    it('should allow overwriting a configured value', () => {
      StorageRegistry.set('customTools', mockCustomToolFactory);
      const newMock = { save: async () => {} } as unknown as StorageConfig['customTools'];
      StorageRegistry.set('customTools', newMock);
      expect(StorageRegistry.get('customTools')).toBe(newMock);
    });

    it('should allow overwriting a resolved default', () => {
      // First resolve creates a default
      StorageRegistry.resolve('customTools', () => mockCustomToolFactory);
      expect(StorageRegistry.get('customTools')).toBe(mockCustomToolFactory);

      // Overwrite the resolved default
      const newMock = { save: async () => {} } as unknown as StorageConfig['customTools'];
      StorageRegistry.set('customTools', newMock);
      expect(StorageRegistry.get('customTools')).toBe(newMock);
    });
  });
});
