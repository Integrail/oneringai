import { describe, expect, it } from 'vitest';
import {
  DEEPSEEK_HOST_REGISTRY,
  resolveDeepSeekHost,
  resolveDeepSeekModel,
} from '@/infrastructure/providers/deepseek/DeepSeekHostRegistry.js';

describe('DeepSeek host registry', () => {
  it('covers the known bearer-token OpenAI-compatible hosts', () => {
    expect(Object.keys(DEEPSEEK_HOST_REGISTRY)).toEqual([
      'official',
      'openrouter',
      'together',
      'fireworks',
      'deepinfra',
      'nvidia-nim',
      'azure-foundry',
      'custom',
    ]);
  });

  it('auto-routes current first-party models to Responses', () => {
    const host = resolveDeepSeekHost();
    expect(resolveDeepSeekModel('deepseek-v4-flash', host).transport).toBe('responses');
    expect(resolveDeepSeekModel('deepseek-v4-pro', host).transport).toBe('responses');
    expect(resolveDeepSeekModel('deepseek-v4-flash-vision-exp', host).transport).toBe('responses');
  });

  it('maps canonical model IDs for hosted providers', () => {
    const host = resolveDeepSeekHost({ host: 'deepinfra' });
    expect(resolveDeepSeekModel('deepseek-v4-pro', host).apiModel).toBe(
      'deepseek-ai/DeepSeek-V4-Pro',
    );
  });

  it('applies host-specific limits', () => {
    const together = resolveDeepSeekHost({ host: 'together' });
    const nvidia = resolveDeepSeekHost({ host: 'nvidia-nim' });
    expect(resolveDeepSeekModel('deepseek-v4-pro', together).inputTokens).toBe(512_000);
    expect(resolveDeepSeekModel('deepseek-v4-flash', nvidia).outputTokens).toBe(16_384);
    expect(resolveDeepSeekModel(
      'deepseek-v4-flash',
      resolveDeepSeekHost({ host: 'fireworks' }),
    ).inputTokens).toBe(1_048_576);
  });

  it('requires a base URL for custom and Azure deployments', () => {
    expect(() => resolveDeepSeekHost({ host: 'custom' })).toThrow('requires connector.baseURL');
    expect(() => resolveDeepSeekHost({ host: 'azure-foundry' })).toThrow('requires connector.baseURL');
  });

  it('does not silently send an unavailable canonical model to a preset', () => {
    const together = resolveDeepSeekHost({ host: 'together' });
    expect(() => resolveDeepSeekModel('deepseek-v4-flash', together)).toThrow(
      "does not advertise model 'deepseek-v4-flash'",
    );
  });
});
