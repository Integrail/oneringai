import { describe, expect, it } from 'vitest';
import { BaseTextProvider } from '@/infrastructure/providers/base/BaseTextProvider.js';
import { ProviderMisalignmentError } from '@/domain/errors/AIErrors.js';

class TestTextProvider extends BaseTextProvider {
  readonly name = 'test';
  readonly capabilities = { text: true, images: false, videos: false, audio: false };

  async generate(): Promise<any> { return {}; }
  async *streamGenerate(): AsyncIterableIterator<any> { /* empty */ }
  getModelCapabilities(): any {
    return {
      supportsTools: false,
      supportsVision: false,
      supportsJSON: false,
      supportsJSONSchema: false,
      maxTokens: 4096,
    };
  }

  runWithCircuitBreaker(operation: () => Promise<unknown>): Promise<unknown> {
    return this.executeWithCircuitBreaker(operation);
  }
}

describe('BaseTextProvider circuit breaker', () => {
  it('does not count misalignment policy violations as provider failures', async () => {
    const provider = new TestTextProvider({
      circuitBreaker: { isRetryable: () => true },
    });
    const error = new ProviderMisalignmentError('openai', 'stopped');

    for (let attempt = 0; attempt < 6; attempt++) {
      await expect(provider.runWithCircuitBreaker(async () => { throw error; })).rejects.toBe(error);
    }

    expect(provider.getCircuitBreakerMetrics()).toMatchObject({
      state: 'closed',
      failureCount: 0,
      recentFailures: 0,
    });
  });
});
