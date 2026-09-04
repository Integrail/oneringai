import { describe, expect, it } from 'vitest';
import { validateOpenAIResponsesRequest } from '@/infrastructure/providers/openai/OpenAIRequestValidator.js';
import {
  InvalidConfigError,
  ProviderCapabilityNotSupportedError,
} from '@/domain/errors/AIErrors.js';

describe('validateOpenAIResponsesRequest', () => {
  it('accepts Astra async tools and configuration updates', () => {
    expect(() => validateOpenAIResponsesRequest(
      { model: 'gpt-6-astra' },
      {
        input: [{ type: 'configuration_update', reasoning: { effort: 'high' } }],
        tools: [{ type: 'function', name: 'slow', async: true }],
        reasoning: { effort: 'low' },
      },
    )).not.toThrow();
  });

  it('accepts unregistered Astra snapshots using the family fallback', () => {
    expect(() => validateOpenAIResponsesRequest(
      { model: 'gpt-6-astra-2026-09-04' },
      {
        input: [{ type: 'configuration_update', reasoning: { effort: 'xhigh' } }],
        tools: [{ type: 'function', name: 'slow', async: true }],
      },
    )).not.toThrow();
  });

  it('rejects Astra-incompatible sampling and reasoning options', () => {
    expect(() => validateOpenAIResponsesRequest(
      { model: 'gpt-6-astra', temperature: 0.5 },
      { input: 'hi' },
    )).toThrow(InvalidConfigError);
    expect(() => validateOpenAIResponsesRequest(
      { model: 'gpt-6-astra' },
      { input: 'hi', reasoning: { effort: 'minimal' } },
    )).toThrow(/does not support reasoning effort/);
    expect(() => validateOpenAIResponsesRequest(
      { model: 'gpt-6-astra' },
      { input: 'hi', top_p: 0.9 },
    )).toThrow(/top_p/);
    expect(() => validateOpenAIResponsesRequest(
      { model: 'gpt-6-astra' },
      { input: 'hi', include: ['message.output_text.logprobs'] },
    )).toThrow(/logprobs/);
  });

  it('gates new protocol features by model capability', () => {
    expect(() => validateOpenAIResponsesRequest(
      { model: 'gpt-5.6-terra' },
      { input: 'hi', tools: [{ type: 'function', name: 'slow', async: true }] },
    )).toThrow(ProviderCapabilityNotSupportedError);
    expect(() => validateOpenAIResponsesRequest(
      { model: 'gpt-5.6-terra' },
      { input: [{ type: 'configuration_update', reasoning: { effort: 'high' } }] },
    )).toThrow(ProviderCapabilityNotSupportedError);
  });

  it('rejects configuration updates with automatic truncation', () => {
    expect(() => validateOpenAIResponsesRequest(
      { model: 'gpt-6-astra' },
      {
        input: [{ type: 'configuration_update', reasoning: { effort: 'high' } }],
        truncation: 'auto',
      },
    )).toThrow(/automatic compaction and truncation/);
  });

  it('validates configuration update effort and single-agent compatibility', () => {
    expect(() => validateOpenAIResponsesRequest(
      { model: 'gpt-6-astra' },
      { input: [{ type: 'configuration_update', reasoning: { effort: 'minimal' } }] },
    )).toThrow(/reasoning effort must be/);
    expect(() => validateOpenAIResponsesRequest(
      { model: 'gpt-6-astra' },
      {
        input: [{ type: 'configuration_update', reasoning: { effort: 'high' } }],
        multi_agent: { enabled: true },
      },
    )).toThrow(/single-agent/);
  });

  it('rejects incompatible async programmatic and multi-agent combinations', () => {
    expect(() => validateOpenAIResponsesRequest(
      { model: 'gpt-6-astra' },
      {
        input: 'hi',
        tools: [{ type: 'function', name: 'slow', async: true }],
        tool_choice: { type: 'programmatic_tool_calling' },
      },
    )).toThrow(/programmatic tool calling/);
    expect(() => validateOpenAIResponsesRequest(
      { model: 'gpt-6-astra' },
      {
        input: 'hi',
        tools: [{ type: 'function', name: 'slow', async: true }],
        multi_agent: { enabled: true },
      },
    )).toThrow(/parallel_tool_calls/);
    expect(() => validateOpenAIResponsesRequest(
      { model: 'gpt-6-astra' },
      {
        input: 'hi',
        tools: [
          { type: 'function', name: 'slow', async: true, allowed_callers: ['direct'] },
          { type: 'function', name: 'program-only', allowed_callers: ['programmatic'] },
        ],
      },
    )).not.toThrow();
  });

  it('rejects explicit Fast mode on the EU data-residency endpoint', () => {
    expect(() => validateOpenAIResponsesRequest(
      { model: 'gpt-6-astra' },
      { input: 'hi', service_tier: 'fast' },
      'https://eu.api.openai.com/v1',
    )).toThrow(/Fast mode is unavailable/);
  });
});
