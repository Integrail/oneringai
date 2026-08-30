import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockResponsesCreate,
  mockChatCreate,
  mockModelsList,
  mockPost,
  mockGet,
  mockOpenAI,
} = vi.hoisted(() => {
  const mockResponsesCreate = vi.fn();
  const mockChatCreate = vi.fn();
  const mockModelsList = vi.fn();
  const mockPost = vi.fn();
  const mockGet = vi.fn();
  const mockOpenAI = vi.fn(() => ({
    responses: { create: mockResponsesCreate },
    chat: { completions: { create: mockChatCreate } },
    completions: { create: mockPost },
    models: { list: mockModelsList },
    post: mockPost,
    get: mockGet,
  }));
  return {
    mockResponsesCreate,
    mockChatCreate,
    mockModelsList,
    mockPost,
    mockGet,
    mockOpenAI,
  };
});

vi.mock('openai', () => ({ default: mockOpenAI }));

import { DeepSeekTextProvider } from '@/infrastructure/providers/deepseek/DeepSeekTextProvider.js';
import { DeepSeekAPI } from '@/infrastructure/providers/deepseek/DeepSeekAPI.js';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';

const responsesResult = {
  id: 'resp_1',
  object: 'response',
  created_at: 10,
  status: 'completed',
  model: 'deepseek-v4-flash',
  output_text: 'Flash answer',
  output: [{
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    status: 'completed',
    content: [{ type: 'output_text', text: 'Flash answer', annotations: [] }],
  }],
  usage: { input_tokens: 2, output_tokens: 3, total_tokens: 5 },
};

describe('DeepSeekTextProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponsesCreate.mockResolvedValue(responsesResult);
    mockChatCreate.mockResolvedValue({
      id: 'chat_1',
      created: 10,
      model: 'deepseek-v4-pro',
      choices: [{
        finish_reason: 'stop',
        message: { content: 'Pro answer', reasoning_content: 'Reasoned.' },
      }],
      usage: { prompt_tokens: 2, completion_tokens: 4, total_tokens: 6 },
    });
    mockModelsList.mockResolvedValue([{ id: 'deepseek-v4-flash' }, { id: 'deepseek-v4-pro' }]);
    Connector.clear();
  });

  afterEach(() => Connector.clear());

  it('uses first-party Responses for Flash and Pro', async () => {
    const provider = new DeepSeekTextProvider({ apiKey: 'test-key' });

    const flash = await provider.generate({ model: 'deepseek-v4-flash', input: 'Hi' });
    const pro = await provider.generate({ model: 'deepseek-v4-pro', input: 'Hi' });

    expect(flash.output_text).toBe('Flash answer');
    expect(pro.output_text).toBe('Flash answer');
    expect(mockResponsesCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'deepseek-v4-flash',
      input: 'Hi',
    }));
    expect(mockResponsesCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'deepseek-v4-pro',
      input: 'Hi',
    }));
  });

  it('maps canonical models and endpoint URLs for hosted presets', async () => {
    const provider = new DeepSeekTextProvider({
      apiKey: 'test-key',
      host: 'openrouter',
    });
    await provider.generate({ model: 'deepseek-v4-pro', input: 'Hi' });

    expect(mockOpenAI).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: 'https://openrouter.ai/api/v1',
    }));
    expect(mockChatCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'deepseek/deepseek-v4-pro',
    }));
  });

  it('honors host-specific context/output limits', () => {
    const together = new DeepSeekTextProvider({ apiKey: 'key', host: 'together' });
    const nvidia = new DeepSeekTextProvider({ apiKey: 'key', host: 'nvidia-nim' });
    expect(together.getModelCapabilities('deepseek-v4-pro').maxInputTokens).toBe(512_000);
    expect(nvidia.getModelCapabilities('deepseek-v4-flash').maxOutputTokens).toBe(16_384);
  });

  it('hashes trusted user identity instead of sending PII', async () => {
    const provider = new DeepSeekTextProvider({
      apiKey: 'key',
      connectorName: 'deepseek-main',
    });
    await provider.generate({
      model: 'deepseek-v4-flash',
      input: 'Hi',
      credential_context: { userId: 'alice@example.com' },
    });
    const request = mockResponsesCreate.mock.calls[0]?.[0];
    expect(request.user_id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(request.user_id).not.toContain('alice');
  });

  it('does not forward an untrusted raw user isolation field', async () => {
    const provider = new DeepSeekTextProvider({ apiKey: 'key' });
    await provider.generate({
      model: 'deepseek-v4-flash',
      input: 'Hi',
      vendorOptions: { deepseek_user_id: 'alice@example.com' },
    });
    expect(mockResponsesCreate.mock.calls[0]?.[0].user_id).toBeUndefined();
  });

  it('reports executable transport-specific capabilities', () => {
    const provider = new DeepSeekTextProvider({ apiKey: 'key' });
    expect(provider.getAdvancedCapabilities('deepseek-v4-flash')).toMatchObject({
      reasoningHistory: 'when_tools_configured',
      structuredOutput: { jsonSchema: 'native', nativeWithTools: true },
      nativeTools: ['web_search'],
    });
    expect(provider.getAdvancedCapabilities('deepseek-v4-pro')).toMatchObject({
      structuredOutput: { jsonSchema: 'native', nativeWithTools: true },
      nativeTools: ['web_search'],
    });
    const nvidia = new DeepSeekTextProvider({ apiKey: 'key', host: 'nvidia-nim' });
    expect(nvidia.getAdvancedCapabilities('deepseek-v4-pro').promptCaching.mode)
      .toBe('unsupported');
  });

  it('rejects unsupported stateful continuation IDs', async () => {
    const provider = new DeepSeekTextProvider({ apiKey: 'key' });
    await expect(provider.generate({
      model: 'deepseek-v4-flash',
      input: 'Hi',
      previous_response_id: 'resp_previous',
    })).rejects.toThrow('previous_response_id');
  });

  it('supports model listing plus first-party FIM and balance APIs', async () => {
    const provider = new DeepSeekTextProvider({ apiKey: 'key' });
    mockPost.mockResolvedValue({ id: 'fim_1' });
    mockGet.mockResolvedValue({ is_available: true, balance_infos: [] });

    await expect(provider.listModels()).resolves.toEqual([
      'deepseek-v4-flash',
      'deepseek-v4-pro',
    ]);
    await provider.createFimCompletion({
      model: 'deepseek-v4-flash',
      prompt: 'function add(',
      suffix: ') {}',
    });
    await expect(provider.getBalance()).resolves.toMatchObject({ is_available: true });
    expect(mockPost).toHaveBeenCalledWith(expect.objectContaining({
      model: 'deepseek-v4-flash',
    }));
    expect(mockGet).toHaveBeenCalledWith('https://api.deepseek.com/user/balance');
  });

  it('routes strict first-party tools through the documented beta base URL', async () => {
    const provider = new DeepSeekTextProvider({ apiKey: 'key' });
    await provider.generate({
      model: 'deepseek-v4-pro',
      input: 'Use the tool',
      tools: [{
        type: 'function',
        function: {
          name: 'lookup',
          description: 'Lookup',
          strict: true,
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      }],
    });
    expect(mockOpenAI).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: 'https://api.deepseek.com/beta',
    }));
  });

  it('exposes account APIs through a named connector rather than raw credentials', async () => {
    Connector.create({
      name: 'deepseek-main',
      vendor: Vendor.DeepSeek,
      auth: { type: 'api_key', apiKey: 'connector-key' },
    });
    const api = DeepSeekAPI.for('deepseek-main');
    expect(api.host.profile.id).toBe('official');
    await expect(api.listModels()).resolves.toEqual([
      'deepseek-v4-flash',
      'deepseek-v4-pro',
    ]);
    api.destroy();
  });
});
