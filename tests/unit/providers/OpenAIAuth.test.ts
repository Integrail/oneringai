import { describe, expect, it, vi } from 'vitest';
import {
  resolveOpenAIBaseProviderKey,
  resolveOpenAISDKAPIKey,
} from '../../../src/infrastructure/providers/openai/OpenAIAuth.js';

describe('OpenAI rotating authentication', () => {
  it('returns static API keys unchanged', () => {
    const config = { auth: { type: 'api_key' as const, apiKey: 'static-key' } };
    expect(resolveOpenAISDKAPIKey(config)).toBe('static-key');
    expect(resolveOpenAIBaseProviderKey(config)).toBe('static-key');
  });

  it('resolves and validates a fresh key for every SDK request', async () => {
    const getApiKey = vi.fn()
      .mockResolvedValueOnce('first-key')
      .mockResolvedValueOnce('second-key')
      .mockResolvedValueOnce('   ');
    const config = { auth: { type: 'api_key_provider' as const, getApiKey } };
    const apiKey = resolveOpenAISDKAPIKey(config);

    expect(apiKey).toEqual(expect.any(Function));
    if (typeof apiKey !== 'function') throw new Error('Expected an API key provider');
    await expect(apiKey()).resolves.toBe('first-key');
    await expect(apiKey()).resolves.toBe('second-key');
    await expect(apiKey()).rejects.toThrow('OpenAI API key provider returned an empty key');
    expect(getApiKey).toHaveBeenCalledTimes(3);
    expect(resolveOpenAIBaseProviderKey(config)).toBe('runtime-key-provider');
  });
});
