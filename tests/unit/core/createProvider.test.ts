/**
 * createProvider Unit Tests
 * Tests the provider factory function
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProvider, createProviderAsync } from '@/core/createProvider.js';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';

// Mock all provider classes
vi.mock('@/infrastructure/providers/openai/OpenAITextProvider.js', () => ({
  OpenAITextProvider: vi.fn().mockImplementation((config) => ({
    name: 'openai',
    config,
  })),
}));

vi.mock('@/infrastructure/providers/anthropic/AnthropicTextProvider.js', () => ({
  AnthropicTextProvider: vi.fn().mockImplementation((config) => ({
    name: 'anthropic',
    config,
  })),
}));

vi.mock('@/infrastructure/providers/google/GoogleTextProvider.js', () => ({
  GoogleTextProvider: vi.fn().mockImplementation((config) => ({
    name: 'google',
    config,
  })),
}));

vi.mock('@/infrastructure/providers/vertex/VertexAITextProvider.js', () => ({
  VertexAITextProvider: vi.fn().mockImplementation((config) => ({
    name: 'vertex-ai',
    config,
  })),
}));

vi.mock('@/infrastructure/providers/generic/GenericOpenAIProvider.js', () => ({
  GenericOpenAIProvider: vi.fn().mockImplementation((name, config) => ({
    name,
    config,
  })),
}));

describe('createProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Connector.clear();
  });

  afterEach(() => {
    Connector.clear();
  });

  describe('vendor routing', () => {
    it('should create OpenAITextProvider for OpenAI vendor', () => {
      Connector.create({
        name: 'openai-test',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'sk-test' },
      });

      const provider = createProvider(Connector.get('openai-test'));

      expect(provider.name).toBe('openai');
    });

    it('should create AnthropicTextProvider for Anthropic vendor', () => {
      Connector.create({
        name: 'anthropic-test',
        vendor: Vendor.Anthropic,
        auth: { type: 'api_key', apiKey: 'sk-ant-test' },
      });

      const provider = createProvider(Connector.get('anthropic-test'));

      expect(provider.name).toBe('anthropic');
    });

    it('should create GoogleTextProvider for Google vendor', () => {
      Connector.create({
        name: 'google-test',
        vendor: Vendor.Google,
        auth: { type: 'api_key', apiKey: 'google-key' },
      });

      const provider = createProvider(Connector.get('google-test'));

      expect(provider.name).toBe('google');
    });

    it('should create VertexAITextProvider for GoogleVertex vendor', () => {
      Connector.create({
        name: 'vertex-test',
        vendor: Vendor.GoogleVertex,
        auth: { type: 'api_key', apiKey: '' },
        options: {
          projectId: 'my-project',
          location: 'us-central1',
        },
      });

      const provider = createProvider(Connector.get('vertex-test'));

      expect(provider.name).toBe('vertex-ai');
    });

    it('should create GenericOpenAIProvider for Groq vendor', () => {
      Connector.create({
        name: 'groq-test',
        vendor: Vendor.Groq,
        auth: { type: 'api_key', apiKey: 'groq-key' },
      });

      const provider = createProvider(Connector.get('groq-test'));

      expect(provider.name).toBe('groq-test');
    });

    it('should create GenericOpenAIProvider for Together vendor', () => {
      Connector.create({
        name: 'together-test',
        vendor: Vendor.Together,
        auth: { type: 'api_key', apiKey: 'together-key' },
      });

      const provider = createProvider(Connector.get('together-test'));

      expect(provider.name).toBe('together-test');
    });

    it('should create GenericOpenAIProvider for Perplexity vendor', () => {
      Connector.create({
        name: 'perplexity-test',
        vendor: Vendor.Perplexity,
        auth: { type: 'api_key', apiKey: 'pplx-key' },
      });

      const provider = createProvider(Connector.get('perplexity-test'));

      expect(provider.name).toBe('perplexity-test');
    });

    it('should create GenericOpenAIProvider for Grok vendor', () => {
      Connector.create({
        name: 'grok-test',
        vendor: Vendor.Grok,
        auth: { type: 'api_key', apiKey: 'xai-key' },
      });

      const provider = createProvider(Connector.get('grok-test'));

      expect(provider.name).toBe('grok-test');
    });

    it('should create GenericOpenAIProvider for DeepSeek vendor', () => {
      Connector.create({
        name: 'deepseek-test',
        vendor: Vendor.DeepSeek,
        auth: { type: 'api_key', apiKey: 'deepseek-key' },
      });

      const provider = createProvider(Connector.get('deepseek-test'));

      expect(provider.name).toBe('deepseek-test');
    });

    it('should create GenericOpenAIProvider for Mistral vendor', () => {
      Connector.create({
        name: 'mistral-test',
        vendor: Vendor.Mistral,
        auth: { type: 'api_key', apiKey: 'mistral-key' },
      });

      const provider = createProvider(Connector.get('mistral-test'));

      expect(provider.name).toBe('mistral-test');
    });

    it('should create GenericOpenAIProvider for Ollama vendor', () => {
      Connector.create({
        name: 'ollama-test',
        vendor: Vendor.Ollama,
        auth: { type: 'api_key', apiKey: 'ollama' },
      });

      const provider = createProvider(Connector.get('ollama-test'));

      expect(provider.name).toBe('ollama-test');
    });

    it('should create GenericOpenAIProvider for Custom vendor with baseURL', () => {
      Connector.create({
        name: 'custom-test',
        vendor: Vendor.Custom,
        baseURL: 'https://my-custom-api.com/v1',
        auth: { type: 'api_key', apiKey: 'custom-key' },
      });

      const provider = createProvider(Connector.get('custom-test'));

      expect(provider.name).toBe('custom-test');
    });
  });

  describe('error handling', () => {
    it('should throw if connector has no vendor', () => {
      Connector.create({
        name: 'no-vendor',
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      expect(() => {
        createProvider(Connector.get('no-vendor'));
      }).toThrow(/no vendor/i);
    });

    it('should throw for Custom vendor without baseURL', () => {
      Connector.create({
        name: 'custom-no-url',
        vendor: Vendor.Custom,
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      expect(() => {
        createProvider(Connector.get('custom-no-url'));
      }).toThrow(/baseURL/i);
    });

    it('should throw for OAuth auth type', () => {
      Connector.create({
        name: 'oauth-connector',
        vendor: Vendor.OpenAI,
        auth: {
          type: 'oauth',
          flow: 'authorization_code',
          clientId: 'client-id',
          tokenUrl: 'https://auth.example.com/token',
        },
      });

      expect(() => {
        createProvider(Connector.get('oauth-connector'));
      }).toThrow(/OAuth/i);
    });

    it('should throw for JWT auth type', () => {
      Connector.create({
        name: 'jwt-connector',
        vendor: Vendor.OpenAI,
        auth: {
          type: 'jwt',
          clientId: 'client-id',
          tokenUrl: 'https://auth.example.com/token',
          privateKey: 'key',
        },
      });

      expect(() => {
        createProvider(Connector.get('jwt-connector'));
      }).toThrow(/JWT/i);
    });
  });

  describe('config extraction', () => {
    it('should pass API key from connector', () => {
      const { OpenAITextProvider } = require('@/infrastructure/providers/openai/OpenAITextProvider.js');

      Connector.create({
        name: 'openai-config',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'sk-my-secret-key' },
      });

      createProvider(Connector.get('openai-config'));

      expect(OpenAITextProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-my-secret-key',
        })
      );
    });

    it('should pass baseURL from connector', () => {
      const { OpenAITextProvider } = require('@/infrastructure/providers/openai/OpenAITextProvider.js');

      Connector.create({
        name: 'openai-baseurl',
        vendor: Vendor.OpenAI,
        baseURL: 'https://custom.openai.com/v1',
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      createProvider(Connector.get('openai-baseurl'));

      expect(OpenAITextProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://custom.openai.com/v1',
        })
      );
    });

    it('should pass timeout from options', () => {
      const { OpenAITextProvider } = require('@/infrastructure/providers/openai/OpenAITextProvider.js');

      Connector.create({
        name: 'openai-timeout',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
        options: { timeout: 30000 },
      });

      createProvider(Connector.get('openai-timeout'));

      expect(OpenAITextProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        })
      );
    });

    it('should pass maxRetries from options', () => {
      const { OpenAITextProvider } = require('@/infrastructure/providers/openai/OpenAITextProvider.js');

      Connector.create({
        name: 'openai-retries',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
        options: { maxRetries: 5 },
      });

      createProvider(Connector.get('openai-retries'));

      expect(OpenAITextProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          maxRetries: 5,
        })
      );
    });

    it('should pass organization for OpenAI', () => {
      const { OpenAITextProvider } = require('@/infrastructure/providers/openai/OpenAITextProvider.js');

      Connector.create({
        name: 'openai-org',
        vendor: Vendor.OpenAI,
        auth: { type: 'api_key', apiKey: 'test-key' },
        options: { organization: 'org-123' },
      });

      createProvider(Connector.get('openai-org'));

      expect(OpenAITextProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          organization: 'org-123',
        })
      );
    });

    it('should pass anthropicVersion for Anthropic', () => {
      const { AnthropicTextProvider } = require('@/infrastructure/providers/anthropic/AnthropicTextProvider.js');

      Connector.create({
        name: 'anthropic-version',
        vendor: Vendor.Anthropic,
        auth: { type: 'api_key', apiKey: 'test-key' },
        options: { anthropicVersion: '2024-01-01' },
      });

      createProvider(Connector.get('anthropic-version'));

      expect(AnthropicTextProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          anthropicVersion: '2024-01-01',
        })
      );
    });

    it('should pass projectId and location for Vertex AI', () => {
      const { VertexAITextProvider } = require('@/infrastructure/providers/vertex/VertexAITextProvider.js');

      Connector.create({
        name: 'vertex-config',
        vendor: Vendor.GoogleVertex,
        auth: { type: 'api_key', apiKey: '' },
        options: {
          projectId: 'my-gcp-project',
          location: 'europe-west1',
        },
      });

      createProvider(Connector.get('vertex-config'));

      expect(VertexAITextProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'my-gcp-project',
          location: 'europe-west1',
        })
      );
    });
  });

  describe('default baseURLs for generic providers', () => {
    it('should use default Groq baseURL', () => {
      const { GenericOpenAIProvider } = require('@/infrastructure/providers/generic/GenericOpenAIProvider.js');

      Connector.create({
        name: 'groq-default',
        vendor: Vendor.Groq,
        auth: { type: 'api_key', apiKey: 'groq-key' },
      });

      createProvider(Connector.get('groq-default'));

      expect(GenericOpenAIProvider).toHaveBeenCalledWith(
        'groq-default',
        expect.objectContaining({
          baseURL: 'https://api.groq.com/openai/v1',
        })
      );
    });

    it('should use default Together baseURL', () => {
      const { GenericOpenAIProvider } = require('@/infrastructure/providers/generic/GenericOpenAIProvider.js');

      Connector.create({
        name: 'together-default',
        vendor: Vendor.Together,
        auth: { type: 'api_key', apiKey: 'together-key' },
      });

      createProvider(Connector.get('together-default'));

      expect(GenericOpenAIProvider).toHaveBeenCalledWith(
        'together-default',
        expect.objectContaining({
          baseURL: 'https://api.together.xyz/v1',
        })
      );
    });

    it('should use default Ollama baseURL', () => {
      const { GenericOpenAIProvider } = require('@/infrastructure/providers/generic/GenericOpenAIProvider.js');

      Connector.create({
        name: 'ollama-default',
        vendor: Vendor.Ollama,
        auth: { type: 'api_key', apiKey: 'ollama' },
      });

      createProvider(Connector.get('ollama-default'));

      expect(GenericOpenAIProvider).toHaveBeenCalledWith(
        'ollama-default',
        expect.objectContaining({
          baseURL: 'http://localhost:11434/v1',
        })
      );
    });
  });
});

describe('createProviderAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Connector.clear();
  });

  afterEach(() => {
    Connector.clear();
  });

  it('should work for API key auth (delegates to sync version)', async () => {
    Connector.create({
      name: 'openai-async',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test-key' },
    });

    const provider = await createProviderAsync(Connector.get('openai-async'));

    expect(provider.name).toBe('openai');
  });
});
