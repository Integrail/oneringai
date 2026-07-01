/**
 * Behavior tests for structured (JSON) output wired through the public
 * Agent APIs (runDirect + run), using a mocked provider. Complements the
 * pure-function coverage in StructuredOutput.test.ts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Agent } from '@/core/Agent.js';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';
import { MessageRole } from '@/domain/entities/Message.js';
import { ContentType } from '@/domain/entities/Content.js';
import { LLMResponse } from '@/domain/entities/Response.js';
import { StructuredOutputError, type ResponseFormat } from '@/core/StructuredOutput.js';
import type { ModelCapabilities, TextGenerateOptions } from '@/domain/interfaces/ITextProvider.js';

const mockGenerate = vi.fn();
let mockCaps: ModelCapabilities;

const mockProvider = {
  name: 'openai',
  capabilities: { text: true, images: false, videos: false, audio: false },
  generate: mockGenerate,
  streamGenerate: vi.fn(),
  getModelCapabilities: vi.fn(() => mockCaps),
  listModels: vi.fn(async () => []),
};

vi.mock('@/core/createProvider.js', () => ({
  createProvider: vi.fn(() => mockProvider),
}));

function textResponse(text: string): LLMResponse {
  return {
    id: 'resp_1',
    object: 'response',
    created_at: 1,
    status: 'completed',
    model: 'gpt-4.1',
    output: [
      {
        type: 'message',
        role: MessageRole.ASSISTANT,
        content: [{ type: ContentType.OUTPUT_TEXT, text }],
      },
    ],
    output_text: text,
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
  };
}

const SCHEMA: ResponseFormat = {
  type: 'json_schema',
  name: 'contact',
  schema: {
    type: 'object',
    properties: { name: { type: 'string' } },
    required: ['name'],
    additionalProperties: false,
  },
};

function baseCaps(over: Partial<ModelCapabilities> = {}): ModelCapabilities {
  return {
    supportsTools: true,
    supportsVision: false,
    supportsJSON: true,
    supportsJSONSchema: true,
    maxTokens: 128000,
    maxOutputTokens: 16384,
    ...over,
  };
}

describe('Structured output — behavior (runDirect)', () => {
  let agent: Agent;

  beforeEach(() => {
    vi.clearAllMocks();
    Connector.clear();
    Connector.create({ name: 'c', vendor: Vendor.OpenAI, auth: { type: 'api_key', apiKey: 'k' } });
    mockCaps = baseCaps();
    agent = Agent.create({ connector: 'c', model: 'gpt-4.1' });
  });

  afterEach(() => {
    agent.destroy();
    Connector.clear();
  });

  it('native path: passes response_format and attaches output_parsed', async () => {
    mockGenerate.mockResolvedValue(textResponse('{"name":"Jane"}'));

    const res = await agent.runDirect('Extract the contact', { responseFormat: SCHEMA });

    expect(res.output_parsed).toEqual({ name: 'Jane' });
    const opts = mockGenerate.mock.calls[0][0] as TextGenerateOptions;
    expect(opts.response_format).toBeDefined();
    expect(opts.response_format?.type).toBe('json_schema');
    // native → no prompt-fallback instruction injected
    expect(opts.instructions ?? '').not.toContain('JSON Schema:');
  });

  it('prompt fallback (no native schema support): injects instruction, no response_format', async () => {
    mockCaps = baseCaps({ supportsJSONSchema: false });
    mockGenerate.mockResolvedValue(textResponse('```json\n{"name":"Jane"}\n```'));

    const res = await agent.runDirect('Extract the contact', { responseFormat: SCHEMA });

    expect(res.output_parsed).toEqual({ name: 'Jane' }); // permissive parse strips fences
    const opts = mockGenerate.mock.calls[0][0] as TextGenerateOptions;
    expect(opts.response_format).toBeUndefined();
    expect(opts.instructions ?? '').toContain('JSON Schema:');
  });

  it('parse failure triggers exactly one re-ask, then succeeds', async () => {
    mockGenerate
      .mockResolvedValueOnce(textResponse('not json at all'))
      .mockResolvedValueOnce(textResponse('{"name":"Jane"}'));

    const res = await agent.runDirect('Extract the contact', { responseFormat: SCHEMA });

    expect(res.output_parsed).toEqual({ name: 'Jane' });
    expect(mockGenerate).toHaveBeenCalledTimes(2); // initial + 1 re-ask
    // re-ask is tool-free
    const reask = mockGenerate.mock.calls[1][0] as TextGenerateOptions;
    expect(reask.tools).toBeUndefined();
    // usage accumulated across both calls
    expect(res.usage.total_tokens).toBe(30);
  });

  it('throws StructuredOutputError when JSON never parses (bounded re-ask)', async () => {
    mockGenerate.mockResolvedValue(textResponse('still not json'));

    await expect(agent.runDirect('Extract the contact', { responseFormat: SCHEMA })).rejects.toBeInstanceOf(
      StructuredOutputError,
    );
    // initial + exactly one re-ask, then give up (STRUCTURED_OUTPUT_MAX_REPAIR_ATTEMPTS = 1)
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });
});

describe('Structured output — behavior (run)', () => {
  let agent: Agent;

  beforeEach(() => {
    vi.clearAllMocks();
    Connector.clear();
    Connector.create({ name: 'c', vendor: Vendor.OpenAI, auth: { type: 'api_key', apiKey: 'k' } });
    mockCaps = baseCaps();
    agent = Agent.create({ connector: 'c', model: 'gpt-4.1' });
  });

  afterEach(() => {
    agent.destroy();
    Connector.clear();
  });

  it('native inline: final answer already JSON, no extra reformat call', async () => {
    mockGenerate.mockResolvedValue(textResponse('{"name":"Jane"}'));

    const res = await agent.run('Extract the contact', { responseFormat: SCHEMA });

    expect(res.output_parsed).toEqual({ name: 'Jane' });
    expect(mockGenerate).toHaveBeenCalledTimes(1); // no reformat pass needed
    const opts = mockGenerate.mock.calls[0][0] as TextGenerateOptions;
    expect(opts.response_format?.type).toBe('json_schema');
  });

  it('prompt fallback: prose answer is reformatted tool-free into JSON', async () => {
    mockCaps = baseCaps({ supportsJSONSchema: false });
    mockGenerate
      .mockResolvedValueOnce(textResponse('The contact is Jane.')) // loop answer (prose)
      .mockResolvedValueOnce(textResponse('{"name":"Jane"}')); // tool-free reformat

    const res = await agent.run('Extract the contact', { responseFormat: SCHEMA });

    expect(res.output_parsed).toEqual({ name: 'Jane' });
    expect(res.output_text).toBe('{"name":"Jane"}');
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    const reformat = mockGenerate.mock.calls[1][0] as TextGenerateOptions;
    expect(reformat.tools).toBeUndefined(); // reformat pass is tool-free
  });

  it('reformat is written back to conversation history (context matches the returned JSON)', async () => {
    mockCaps = baseCaps({ supportsJSONSchema: false });
    mockGenerate
      .mockResolvedValueOnce(textResponse('The contact is Jane.')) // committed to context by the loop
      .mockResolvedValueOnce(textResponse('{"name":"Jane"}')); // reformat

    const res = await agent.run('Extract the contact', { responseFormat: SCHEMA });
    expect(res.output_text).toBe('{"name":"Jane"}');

    const convo = [...agent.context.getConversation()];
    const lastAssistant = convo
      .reverse()
      .find((m): m is typeof m & { content: Array<{ text?: string }> } =>
        (m as { type?: string; role?: string }).type === 'message' &&
        (m as { role?: string }).role === MessageRole.ASSISTANT,
      );
    const text = (lastAssistant?.content ?? []).map((c) => c.text ?? '').join('');
    expect(text).toContain('{"name":"Jane"}'); // history holds the reformatted JSON
    expect(text).not.toContain('The contact is Jane.'); // not the pre-reformat prose
  });
});
