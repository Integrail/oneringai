import { describe, expect, it } from 'vitest';
import { resolveAmosModelRuntimeOptions } from '../../../../apps/amos/src/agent/AgentRunner.js';

describe('resolveAmosModelRuntimeOptions', () => {
  it('omits temperature and enables supported reasoning for GPT-6 Astra', () => {
    expect(resolveAmosModelRuntimeOptions('gpt-6-astra', 0.7, 'high')).toEqual({
      thinking: { enabled: true, effort: 'high' },
    });
  });

  it('falls back from Astra-incompatible reasoning efforts', () => {
    expect(resolveAmosModelRuntimeOptions('gpt-6-astra', 0.7, 'minimal')).toEqual({
      thinking: { enabled: true, effort: 'medium' },
    });
  });

  it('preserves temperature for unregistered custom models', () => {
    expect(resolveAmosModelRuntimeOptions('custom-chat-model', 0.35, 'medium')).toEqual({
      temperature: 0.35,
    });
  });
});
