/**
 * ConnectorRegistry Unit Tests
 * Tests connector registration, lookup, and management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectorRegistry, connectorRegistry } from '@/connectors/ConnectorRegistry.js';
import type { ConnectorConfig, ConnectorAuth } from '@/domain/entities/Connector.js';

describe('ConnectorRegistry', () => {
  // Use the singleton but clear it between tests
  let registry: ConnectorRegistry;

  beforeEach(() => {
    registry = ConnectorRegistry.getInstance();
    registry.clear();
  });

  afterEach(() => {
    registry.clear();
  });

  // Helper to create a valid API key connector config
  const createApiKeyConfig = (overrides?: Partial<ConnectorConfig>): ConnectorConfig => ({
    displayName: 'Test API',
    description: 'A test API connector',
    baseURL: 'https://api.example.com',
    auth: {
      type: 'api_key',
      apiKey: 'test-api-key-123'
    },
    ...overrides
  });

  // Helper to create static token OAuth config
  const createStaticTokenConfig = (overrides?: Partial<ConnectorConfig>): ConnectorConfig => ({
    displayName: 'Static Token API',
    description: 'An API with static token',
    baseURL: 'https://api.static.com',
    auth: {
      type: 'oauth',
      flow: 'static_token',
      staticToken: 'sk-static-token',
      clientId: 'static-client'
    } as any,
    ...overrides
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ConnectorRegistry.getInstance();
      const instance2 = ConnectorRegistry.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should export a global singleton', () => {
      expect(connectorRegistry).toBe(ConnectorRegistry.getInstance());
    });
  });

  describe('Connector Registration', () => {
    it('should register a connector with API key auth', () => {
      registry.register('test_api', createApiKeyConfig());

      expect(registry.has('test_api')).toBe(true);
      expect(registry.size()).toBe(1);
    });

    it('should register multiple connectors', () => {
      registry.register('api1', createApiKeyConfig({ displayName: 'API 1' }));
      registry.register('api2', createApiKeyConfig({ displayName: 'API 2' }));
      registry.register('api3', createApiKeyConfig({ displayName: 'API 3' }));

      expect(registry.size()).toBe(3);
      expect(registry.listConnectorNames()).toContain('api1');
      expect(registry.listConnectorNames()).toContain('api2');
      expect(registry.listConnectorNames()).toContain('api3');
    });

    it('should throw on empty connector name', () => {
      expect(() => {
        registry.register('', createApiKeyConfig());
      }).toThrow(/cannot be empty/i);
    });

    it('should throw on whitespace-only connector name', () => {
      expect(() => {
        registry.register('   ', createApiKeyConfig());
      }).toThrow(/cannot be empty/i);
    });

    it('should warn and overwrite on duplicate registration', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      registry.register('duplicate', createApiKeyConfig({ displayName: 'Original' }));
      registry.register('duplicate', createApiKeyConfig({ displayName: 'Replacement' }));

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
      expect(registry.size()).toBe(1);

      const connector = registry.get('duplicate');
      expect(connector.displayName).toBe('Replacement');

      warnSpy.mockRestore();
    });
  });

  describe('Connector Lookup', () => {
    beforeEach(() => {
      registry.register('github', createApiKeyConfig({
        displayName: 'GitHub API',
        description: 'Access GitHub repos',
        baseURL: 'https://api.github.com'
      }));
    });

    it('should retrieve connector by name', () => {
      const connector = registry.get('github');

      expect(connector).toBeDefined();
      expect(connector.name).toBe('github');
      expect(connector.displayName).toBe('GitHub API');
      expect(connector.baseURL).toBe('https://api.github.com');
    });

    it('should throw on unknown connector with helpful error', () => {
      expect(() => {
        registry.get('nonexistent');
      }).toThrow(/not found.*Available connectors: github/);
    });

    it('should return undefined for has() on unknown connector', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('Connector Listing', () => {
    beforeEach(() => {
      registry.register('github', createApiKeyConfig({ displayName: 'GitHub' }));
      registry.register('microsoft', createApiKeyConfig({ displayName: 'Microsoft Graph' }));
      registry.register('google', createApiKeyConfig({ displayName: 'Google APIs' }));
    });

    it('should list all connector names', () => {
      const names = registry.listConnectorNames();

      expect(names).toHaveLength(3);
      expect(names).toContain('github');
      expect(names).toContain('microsoft');
      expect(names).toContain('google');
    });

    it('should list all connectors', () => {
      const connectors = registry.listConnectors();

      expect(connectors).toHaveLength(3);
      expect(connectors.map(c => c.name)).toContain('github');
    });

    it('should return connector info for tools', () => {
      const info = registry.getConnectorInfo();

      expect(Object.keys(info)).toHaveLength(3);
      expect(info.github.displayName).toBe('GitHub');
      expect(info.microsoft.displayName).toBe('Microsoft Graph');
    });

    it('should return formatted descriptions for tools', () => {
      const descriptions = registry.getConnectorDescriptionsForTools();

      expect(descriptions).toContain('github');
      expect(descriptions).toContain('GitHub');
      expect(descriptions).toContain('microsoft');
    });

    it('should handle empty registry for descriptions', () => {
      registry.clear();

      const descriptions = registry.getConnectorDescriptionsForTools();

      expect(descriptions).toContain('No connectors registered');
    });
  });

  describe('Connector Unregistration', () => {
    beforeEach(() => {
      registry.register('removable', createApiKeyConfig());
    });

    it('should unregister connector', () => {
      expect(registry.has('removable')).toBe(true);

      const result = registry.unregister('removable');

      expect(result).toBe(true);
      expect(registry.has('removable')).toBe(false);
    });

    it('should return false when unregistering non-existent connector', () => {
      const result = registry.unregister('nonexistent');

      expect(result).toBe(false);
    });

    it('should clear all connectors', () => {
      registry.register('keep1', createApiKeyConfig());
      registry.register('keep2', createApiKeyConfig());

      expect(registry.size()).toBe(3);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.listConnectorNames()).toHaveLength(0);
    });
  });

  describe('OAuth Manager Access', () => {
    it('should provide OAuthManager for connector', () => {
      registry.register('oauth_test', createApiKeyConfig());

      const manager = registry.getManager('oauth_test');

      expect(manager).toBeDefined();
      expect(typeof manager.getToken).toBe('function');
    });

    it('should throw when getting manager for unknown connector', () => {
      expect(() => {
        registry.getManager('unknown');
      }).toThrow(/not found/i);
    });
  });

  describe('Auth Type Handling', () => {
    it('should handle api_key auth type', () => {
      registry.register('apikey', {
        displayName: 'API Key Service',
        description: 'Uses API key',
        baseURL: 'https://api.example.com',
        auth: {
          type: 'api_key',
          apiKey: 'my-secret-key'
        }
      });

      const connector = registry.get('apikey');
      expect(connector).toBeDefined();
    });

    it('should handle oauth auth type (client_credentials)', () => {
      // Note: client_credentials flow requires clientSecret
      registry.register('oauth', {
        displayName: 'OAuth Service',
        description: 'Uses OAuth',
        baseURL: 'https://oauth.example.com',
        auth: {
          type: 'oauth',
          flow: 'client_credentials',
          clientId: 'client-id',
          clientSecret: 'client-secret',
          tokenUrl: 'https://oauth.example.com/token'
        }
      });

      const connector = registry.get('oauth');
      expect(connector).toBeDefined();
    });

    it('should throw on unknown auth type', () => {
      expect(() => {
        registry.register('bad_auth', {
          displayName: 'Bad Auth',
          description: 'Invalid auth type',
          baseURL: 'https://api.example.com',
          auth: {
            type: 'unknown' as any
          }
        });
      }).toThrow(/unknown.*auth type/i);
    });
  });

  describe('Size and State', () => {
    it('should report correct size', () => {
      expect(registry.size()).toBe(0);

      registry.register('a', createApiKeyConfig());
      expect(registry.size()).toBe(1);

      registry.register('b', createApiKeyConfig());
      expect(registry.size()).toBe(2);

      registry.unregister('a');
      expect(registry.size()).toBe(1);
    });
  });
});
