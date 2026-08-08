import { Connector } from '../../../core/Connector.js';

export interface GrokRealtimeClientSecret {
  value: string;
  expires_at: number;
}

/** REST helpers for xAI browser credentials and SIP call control. */
export class GrokRealtimeAPI {
  readonly connector: Connector;

  constructor(connector: string | Connector) {
    this.connector = typeof connector === 'string' ? Connector.get(connector) : connector;
  }

  async createClientSecret(expiresAfterSeconds = 300): Promise<GrokRealtimeClientSecret> {
    if (!Number.isInteger(expiresAfterSeconds) || expiresAfterSeconds <= 0) {
      throw new RangeError('expiresAfterSeconds must be a positive integer');
    }
    return this.request('/realtime/client_secrets', {
      expires_after: { seconds: expiresAfterSeconds },
    }) as Promise<GrokRealtimeClientSecret>;
  }

  async hangupCall(callId: string): Promise<void> {
    await this.request(`/realtime/calls/${encodeURIComponent(callId)}/hangup`);
  }

  async referCall(callId: string, targetUri: string): Promise<void> {
    await this.request(`/realtime/calls/${encodeURIComponent(callId)}/refer`, {
      target_uri: targetUri,
    });
  }

  private async request(path: string, body?: Record<string, unknown>): Promise<unknown> {
    const base = this.connector.baseURL || 'https://api.x.ai/v1';
    const response = await this.connector.fetch(
      `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`xAI Realtime API ${response.status}: ${detail || response.statusText}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
  }
}
