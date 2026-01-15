/**
 * BaseProvider Unit Tests
 * Tests the base provider class functionality
 */

import { describe, it, expect } from 'vitest';
import { BaseProvider } from '@/infrastructure/providers/base/BaseProvider.js';
import { ProviderCapabilities } from '@/domain/interfaces/IProvider.js';
import { InvalidConfigError } from '@/domain/errors/AIErrors.js';

// Create a concrete implementation for testing
class TestProvider extends BaseProvider {
  readonly name = 'test-provider';
  readonly capabilities: ProviderCapabilities = {
    text: true,
    images: false,
    videos: false,
    audio: false,
  };
}

describe('BaseProvider', () => {
  describe('constructor', () => {
    it('should store config', () => {
      const provider = new TestProvider({
        apiKey: 'test-key',
      });

      // Provider should be created without errors
      expect(provider).toBeDefined();
      expect(provider.name).toBe('test-provider');
    });
  });

  describe('getApiKey()', () => {
    it('should return config API key', () => {
      const provider = new TestProvider({
        apiKey: 'my-secret-key',
      });

      // Access protected method via subclass
      expect((provider as any).getApiKey()).toBe('my-secret-key');
    });
  });

  describe('getBaseURL()', () => {
    it('should return config baseURL', () => {
      const provider = new TestProvider({
        apiKey: 'test-key',
        baseURL: 'https://custom.api.com',
      });

      expect((provider as any).getBaseURL()).toBe('https://custom.api.com');
    });

    it('should return undefined if baseURL not set', () => {
      const provider = new TestProvider({
        apiKey: 'test-key',
      });

      expect((provider as any).getBaseURL()).toBeUndefined();
    });
  });

  describe('getTimeout()', () => {
    it('should return config timeout', () => {
      const provider = new TestProvider({
        apiKey: 'test-key',
        timeout: 30000,
      });

      expect((provider as any).getTimeout()).toBe(30000);
    });

    it('should return default 60000 if timeout not set', () => {
      const provider = new TestProvider({
        apiKey: 'test-key',
      });

      expect((provider as any).getTimeout()).toBe(60000);
    });
  });

  describe('getMaxRetries()', () => {
    it('should return config maxRetries', () => {
      const provider = new TestProvider({
        apiKey: 'test-key',
        maxRetries: 5,
      });

      expect((provider as any).getMaxRetries()).toBe(5);
    });

    it('should return default 3 if maxRetries not set', () => {
      const provider = new TestProvider({
        apiKey: 'test-key',
      });

      expect((provider as any).getMaxRetries()).toBe(3);
    });
  });

  describe('validateApiKey()', () => {
    it('should reject empty API keys', () => {
      const provider = new TestProvider({
        apiKey: '',
      });

      const result = (provider as any).validateApiKey();
      expect(result.isValid).toBe(false);
    });

    it('should reject whitespace-only API keys', () => {
      const provider = new TestProvider({
        apiKey: '   ',
      });

      const result = (provider as any).validateApiKey();
      expect(result.isValid).toBe(false);
    });

    it('should reject placeholder values', () => {
      const placeholders = [
        'your-api-key',
        'YOUR_API_KEY',
        'sk-xxx',
        'api-key-here',
        'REPLACE_ME',
        '<your-key>',
      ];

      for (const placeholder of placeholders) {
        const provider = new TestProvider({
          apiKey: placeholder,
        });

        const result = (provider as any).validateApiKey();
        expect(result.isValid).toBe(false);
        expect(result.warning).toContain('placeholder');
      }
    });

    it('should accept valid API keys', () => {
      const provider = new TestProvider({
        apiKey: 'sk-proj-abcdefghijklmnop',
      });

      const result = (provider as any).validateApiKey();
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateConfig()', () => {
    it('should return true for valid config', async () => {
      const provider = new TestProvider({
        apiKey: 'valid-api-key-123',
      });

      const isValid = await provider.validateConfig();
      expect(isValid).toBe(true);
    });

    it('should return false for invalid config', async () => {
      const provider = new TestProvider({
        apiKey: '',
      });

      const isValid = await provider.validateConfig();
      expect(isValid).toBe(false);
    });
  });

  describe('assertValidConfig()', () => {
    it('should not throw for valid config', () => {
      const provider = new TestProvider({
        apiKey: 'valid-key-123',
      });

      expect(() => {
        (provider as any).assertValidConfig();
      }).not.toThrow();
    });

    it('should throw InvalidConfigError for invalid config', () => {
      const provider = new TestProvider({
        apiKey: '',
      });

      expect(() => {
        (provider as any).assertValidConfig();
      }).toThrow(InvalidConfigError);
    });

    it('should include provider name in error message', () => {
      const provider = new TestProvider({
        apiKey: '',
      });

      expect(() => {
        (provider as any).assertValidConfig();
      }).toThrow(/test-provider/);
    });

    it('should include warning in error message if available', () => {
      const provider = new TestProvider({
        apiKey: 'your-api-key',
      });

      expect(() => {
        (provider as any).assertValidConfig();
      }).toThrow(/placeholder/);
    });
  });

  describe('capabilities property', () => {
    it('should have required capability fields', () => {
      const provider = new TestProvider({
        apiKey: 'test-key',
      });

      expect(provider.capabilities).toHaveProperty('text');
      expect(provider.capabilities).toHaveProperty('images');
      expect(provider.capabilities).toHaveProperty('videos');
      expect(provider.capabilities).toHaveProperty('audio');
    });
  });
});
