/**
 * Unit tests for listModels() across all providers
 */

import { describe, it, expect, vi } from 'vitest';
import { OpenAITextProvider } from '../../../src/infrastructure/providers/openai/OpenAITextProvider.js';
import { AnthropicTextProvider } from '../../../src/infrastructure/providers/anthropic/AnthropicTextProvider.js';
import { GoogleTextProvider } from '../../../src/infrastructure/providers/google/GoogleTextProvider.js';
import { GenericOpenAIProvider } from '../../../src/infrastructure/providers/generic/GenericOpenAIProvider.js';
import { BaseTextProvider } from '../../../src/infrastructure/providers/base/BaseTextProvider.js';

// ============================================================================
// Helper: access private client via cast
// ============================================================================

function setPrivateClient(provider: any, client: any): void {
  provider.client = client;
}

// ============================================================================
// OpenAITextProvider.listModels()
// ============================================================================

describe('OpenAITextProvider.listModels', () => {
  it('should return sorted model IDs from OpenAI API', async () => {
    const provider = new OpenAITextProvider({ apiKey: 'test-key' });

    const mockModels = [
      { id: 'gpt-4', object: 'model' },
      { id: 'gpt-3.5-turbo', object: 'model' },
      { id: 'gpt-4o', object: 'model' },
    ];

    // Replace the client's models.list with a mock async iterable
    setPrivateClient(provider, {
      models: {
        list: () => ({
          [Symbol.asyncIterator]: async function* () {
            for (const m of mockModels) yield m;
          },
        }),
      },
    });

    const models = await provider.listModels();
    expect(models).toEqual(['gpt-3.5-turbo', 'gpt-4', 'gpt-4o']);
  });

  it('should return empty array when no models available', async () => {
    const provider = new OpenAITextProvider({ apiKey: 'test-key' });

    setPrivateClient(provider, {
      models: {
        list: () => ({
          [Symbol.asyncIterator]: async function* () {
            // empty
          },
        }),
      },
    });

    const models = await provider.listModels();
    expect(models).toEqual([]);
  });
});

// ============================================================================
// AnthropicTextProvider.listModels()
// ============================================================================

describe('AnthropicTextProvider.listModels', () => {
  it('should return sorted model IDs from Anthropic API', async () => {
    const provider = new AnthropicTextProvider({ apiKey: 'test-key' });

    const mockModels = [
      { id: 'claude-3-opus-20240229', type: 'model' },
      { id: 'claude-3-haiku-20240307', type: 'model' },
      { id: 'claude-3-sonnet-20240229', type: 'model' },
    ];

    setPrivateClient(provider, {
      models: {
        list: () => ({
          [Symbol.asyncIterator]: async function* () {
            for (const m of mockModels) yield m;
          },
        }),
      },
    });

    const models = await provider.listModels();
    expect(models).toEqual([
      'claude-3-haiku-20240307',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
    ]);
  });
});

// ============================================================================
// GoogleTextProvider.listModels()
// ============================================================================

describe('GoogleTextProvider.listModels', () => {
  it('should return sorted model names with models/ prefix stripped', async () => {
    const provider = new GoogleTextProvider({ apiKey: 'test-key' });

    const mockModels = [
      { name: 'models/gemini-2.0-flash' },
      { name: 'models/gemini-1.5-pro' },
      { name: 'models/gemini-2.5-pro' },
    ];

    const mockPager = {
      [Symbol.asyncIterator]: async function* () {
        for (const m of mockModels) yield m;
      },
    };

    setPrivateClient(provider, {
      models: {
        list: () => mockPager,
      },
    });

    const models = await provider.listModels();
    expect(models).toEqual(['gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.5-pro']);
  });

  it('should handle models without names gracefully', async () => {
    const provider = new GoogleTextProvider({ apiKey: 'test-key' });

    const mockModels = [
      { name: 'models/gemini-2.0-flash' },
      { name: undefined },
      { name: '' },
    ];

    const mockPager = {
      [Symbol.asyncIterator]: async function* () {
        for (const m of mockModels) yield m;
      },
    };

    setPrivateClient(provider, {
      models: {
        list: () => mockPager,
      },
    });

    const models = await provider.listModels();
    expect(models).toEqual(['gemini-2.0-flash']);
  });
});

// ============================================================================
// GenericOpenAIProvider.listModels() — error safety
// ============================================================================

describe('GenericOpenAIProvider.listModels', () => {
  it('should catch errors and return empty array', async () => {
    const provider = new GenericOpenAIProvider('test-generic', {
      apiKey: 'test-key',
      baseURL: 'http://localhost:8080/v1',
    });

    setPrivateClient(provider, {
      models: {
        list: () => {
          throw new Error('404 Not Found');
        },
      },
    });

    const models = await provider.listModels();
    expect(models).toEqual([]);
  });

  it('should return models when endpoint is supported', async () => {
    const provider = new GenericOpenAIProvider('test-generic', {
      apiKey: 'mock-key',
      baseURL: 'http://localhost:11434/v1',
    });

    const mockModels = [
      { id: 'llama3.2:latest', object: 'model' },
      { id: 'qwen3:8b', object: 'model' },
    ];

    setPrivateClient(provider, {
      models: {
        list: () => ({
          [Symbol.asyncIterator]: async function* () {
            for (const m of mockModels) yield m;
          },
        }),
      },
    });

    const models = await provider.listModels();
    expect(models).toEqual(['llama3.2:latest', 'qwen3:8b']);
  });
});

// ============================================================================
// BaseTextProvider default listModels()
// ============================================================================

describe('BaseTextProvider.listModels (default)', () => {
  it('should return empty array by default', async () => {
    // Create a minimal concrete subclass that doesn't override listModels
    class TestProvider extends BaseTextProvider {
      readonly name = 'test';
      readonly capabilities = { text: true, images: false, videos: false, audio: false };
      async generate(): Promise<any> { return {}; }
      async *streamGenerate(): any { /* empty */ }
      getModelCapabilities(): any {
        return { supportsTools: false, supportsVision: false, supportsJSON: false, supportsJSONSchema: false, maxTokens: 4096 };
      }
    }

    const provider = new TestProvider({});
    const models = await provider.listModels();
    expect(models).toEqual([]);
  });
});
