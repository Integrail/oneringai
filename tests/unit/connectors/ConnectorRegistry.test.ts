/**
 * Connector Unit Tests
 * Tests connector registration, lookup, and management using the unified Connector class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Connector } from '@/core/Connector.js';
import type { ConnectorConfig } from '@/domain/entities/Connector.js';

describe('Connector', () => {
  beforeEach(() => {
    Connector.clear();
  });

  afterEach(() => {
    Connector.clear();
  });

  // Helper to create a valid API key connector config
  const createApiKeyConfig = (name: string, overrides?: Partial<ConnectorConfig>): ConnectorConfig & { name: string } => ({
    name,
    displayName: 'Test API',
    description: 'A test API connector',
    baseURL: 'https://api.example.com',
    auth: {
      type: 'api_key',
      apiKey: 'test-api-key-123'
    },
    ...overrides
  });

  describe('Static Registry', () => {
    it('should use static registry pattern', () => {
      Connector.create(createApiKeyConfig('test1'));
      Connector.create(createApiKeyConfig('test2'));

      expect(Connector.list()).toContain('test1');
      expect(Connector.list()).toContain('test2');
    });
  });

  describe('Connector Registration', () => {
    it('should register a connector with API key auth', () => {
      Connector.create(createApiKeyConfig('test_api'));

      expect(Connector.has('test_api')).toBe(true);
      expect(Connector.size()).toBe(1);
    });

    it('should register multiple connectors', () => {
      Connector.create(createApiKeyConfig('api1', { displayName: 'API 1' }));
      Connector.create(createApiKeyConfig('api2', { displayName: 'API 2' }));
      Connector.create(createApiKeyConfig('api3', { displayName: 'API 3' }));

      expect(Connector.size()).toBe(3);
      expect(Connector.list()).toContain('api1');
      expect(Connector.list()).toContain('api2');
      expect(Connector.list()).toContain('api3');
    });

    it('should throw on empty connector name', () => {
      expect(() => {
        Connector.create({ ...createApiKeyConfig(''), name: '' });
      }).toThrow(/required/i);
    });

    it('should throw on whitespace-only connector name', () => {
      expect(() => {
        Connector.create({ ...createApiKeyConfig('   '), name: '   ' });
      }).toThrow(/required/i);
    });

    it('should throw on duplicate registration', () => {
      Connector.create(createApiKeyConfig('duplicate', { displayName: 'Original' }));

      expect(() => {
        Connector.create(createApiKeyConfig('duplicate', { displayName: 'Replacement' }));
      }).toThrow(/already exists/i);
    });
  });

  describe('Connector Lookup', () => {
    beforeEach(() => {
      Connector.create(createApiKeyConfig('github', {
        displayName: 'GitHub API',
        description: 'Access GitHub repos',
        baseURL: 'https://api.github.com'
      }));
    });

    it('should retrieve connector by name', () => {
      const connector = Connector.get('github');

      expect(connector).toBeDefined();
      expect(connector.name).toBe('github');
      expect(connector.displayName).toBe('GitHub API');
      expect(connector.baseURL).toBe('https://api.github.com');
    });

    it('should throw on unknown connector with helpful error', () => {
      expect(() => {
        Connector.get('nonexistent');
      }).toThrow(/not found.*Available: github/);
    });

    it('should return false for has() on unknown connector', () => {
      expect(Connector.has('nonexistent')).toBe(false);
    });
  });

  describe('Connector Listing', () => {
    beforeEach(() => {
      Connector.create(createApiKeyConfig('github', { displayName: 'GitHub' }));
      Connector.create(createApiKeyConfig('microsoft', { displayName: 'Microsoft Graph' }));
      Connector.create(createApiKeyConfig('google', { displayName: 'Google APIs' }));
    });

    it('should list all connector names', () => {
      const names = Connector.list();

      expect(names).toHaveLength(3);
      expect(names).toContain('github');
      expect(names).toContain('microsoft');
      expect(names).toContain('google');
    });

    it('should list all connectors', () => {
      const connectors = Connector.listAll();

      expect(connectors).toHaveLength(3);
      expect(connectors.map(c => c.name)).toContain('github');
    });

    it('should return connector info for tools', () => {
      const info = Connector.getInfo();

      expect(Object.keys(info)).toHaveLength(3);
      expect(info.github.displayName).toBe('GitHub');
      expect(info.microsoft.displayName).toBe('Microsoft Graph');
    });

    it('should return formatted descriptions for tools', () => {
      const descriptions = Connector.getDescriptionsForTools();

      expect(descriptions).toContain('github');
      expect(descriptions).toContain('GitHub');
      expect(descriptions).toContain('microsoft');
    });

    it('should handle empty registry for descriptions', () => {
      Connector.clear();

      const descriptions = Connector.getDescriptionsForTools();

      expect(descriptions).toContain('No connectors registered');
    });
  });

  describe('Connector Removal', () => {
    beforeEach(() => {
      Connector.create(createApiKeyConfig('removable'));
    });

    it('should remove connector', () => {
      expect(Connector.has('removable')).toBe(true);

      const result = Connector.remove('removable');

      expect(result).toBe(true);
      expect(Connector.has('removable')).toBe(false);
    });

    it('should return false when removing non-existent connector', () => {
      const result = Connector.remove('nonexistent');

      expect(result).toBe(false);
    });

    it('should clear all connectors', () => {
      Connector.create(createApiKeyConfig('keep1'));
      Connector.create(createApiKeyConfig('keep2'));

      expect(Connector.size()).toBe(3);

      Connector.clear();

      expect(Connector.size()).toBe(0);
      expect(Connector.list()).toHaveLength(0);
    });
  });

  describe('Token Access', () => {
    it('should return API key via getToken()', async () => {
      Connector.create(createApiKeyConfig('apikey_test'));

      const connector = Connector.get('apikey_test');
      const token = await connector.getToken();

      expect(token).toBe('test-api-key-123');
    });

    it('should return API key via getApiKey()', () => {
      Connector.create(createApiKeyConfig('apikey_test2'));

      const connector = Connector.get('apikey_test2');
      const apiKey = connector.getApiKey();

      expect(apiKey).toBe('test-api-key-123');
    });
  });

  describe('Auth Type Handling', () => {
    it('should handle api_key auth type', () => {
      Connector.create({
        name: 'apikey',
        displayName: 'API Key Service',
        description: 'Uses API key',
        baseURL: 'https://api.example.com',
        auth: {
          type: 'api_key',
          apiKey: 'my-secret-key'
        }
      });

      const connector = Connector.get('apikey');
      expect(connector).toBeDefined();
    });

    it('should handle oauth auth type (client_credentials)', () => {
      Connector.create({
        name: 'oauth',
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

      const connector = Connector.get('oauth');
      expect(connector).toBeDefined();
    });
  });

  describe('Size and State', () => {
    it('should report correct size', () => {
      expect(Connector.size()).toBe(0);

      Connector.create(createApiKeyConfig('a'));
      expect(Connector.size()).toBe(1);

      Connector.create(createApiKeyConfig('b'));
      expect(Connector.size()).toBe(2);

      Connector.remove('a');
      expect(Connector.size()).toBe(1);
    });
  });

  describe('Instance Properties', () => {
    it('should expose displayName getter', () => {
      Connector.create(createApiKeyConfig('display_test', { displayName: 'My Display Name' }));

      const connector = Connector.get('display_test');
      expect(connector.displayName).toBe('My Display Name');
    });

    it('should fallback to name for displayName', () => {
      Connector.create({
        name: 'no_display',
        auth: { type: 'api_key', apiKey: 'key' }
      });

      const connector = Connector.get('no_display');
      expect(connector.displayName).toBe('no_display');
    });

    it('should expose baseURL getter', () => {
      Connector.create(createApiKeyConfig('base_test', { baseURL: 'https://custom.api.com' }));

      const connector = Connector.get('base_test');
      expect(connector.baseURL).toBe('https://custom.api.com');
    });

    it('should return empty string for missing baseURL', () => {
      Connector.create({
        name: 'no_base',
        auth: { type: 'api_key', apiKey: 'key' }
      });

      const connector = Connector.get('no_base');
      expect(connector.baseURL).toBe('');
    });
  });
});
