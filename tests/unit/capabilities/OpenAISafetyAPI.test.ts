import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';

const { mockOpenAI, mockRetrieve } = vi.hoisted(() => {
  const mockRetrieve = vi.fn();
  const mockOpenAI = vi.fn(() => ({
    safety: { alerts: { retrieve: mockRetrieve } },
  }));
  return { mockOpenAI, mockRetrieve };
});

vi.mock('openai', () => ({ default: mockOpenAI }));

import { OpenAISafetyAPI } from '@/capabilities/openai/OpenAISafetyAPI.js';
import { ProviderAuthError } from '@/domain/errors/AIErrors.js';

describe('OpenAISafetyAPI', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => Connector.clear());

  it('retrieves an alert through the named connector project', async () => {
    Connector.create({
      name: 'openai-safety-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'secret-test-key' },
      options: { project: 'proj_123' },
    });
    const alert = {
      id: 'alert_123',
      object: 'safety.alert',
      created_at: 1,
      error_type: 'other',
      model: 'gpt-6-astra',
      reason: 'review required',
      request_id: 'req_123',
      request_paused: true,
      response_id: 'resp_123',
    };
    mockRetrieve.mockResolvedValue(alert);

    await expect(new OpenAISafetyAPI('openai-safety-test').retrieveAlert('alert_123'))
      .resolves.toEqual(alert);
    expect(mockRetrieve).toHaveBeenCalledWith('alert_123');
    expect(mockOpenAI).toHaveBeenCalledWith(expect.objectContaining({ project: 'proj_123' }));
    await expect(mockOpenAI.mock.calls[0]![0].apiKey()).resolves.toBe('secret-test-key');
  });

  it('maps project-permission failures through the provider error contract', async () => {
    const connector = Connector.create({
      name: 'openai-safety-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'secret-test-key' },
    });
    mockRetrieve.mockRejectedValue({ status: 403, message: 'permission denied' });

    await expect(new OpenAISafetyAPI(connector).retrieveAlert('alert_123'))
      .rejects.toBeInstanceOf(ProviderAuthError);
  });
});

