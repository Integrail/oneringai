/**
 * Scheduling Vendor Templates (Cal.com, Calendly)
 */
import type { VendorTemplate } from '../types.js';

/**
 * Cal.com — open-source scheduling.
 *
 * API v1 authenticates by passing the API key as the `apiKey` query parameter
 * (injected automatically by connector.fetch), so the generic API tool works
 * with no per-request header. Keys are prefixed `cal_` (test) / `cal_live_`
 * (live). API v2 (base https://api.cal.com/v2) uses `Authorization: Bearer`
 * plus a required per-request `cal-api-version` header — see notes.
 */
export const calcomTemplate: VendorTemplate = {
  id: 'cal-com',
  name: 'Cal.com',
  serviceType: 'cal-com',
  baseURL: 'https://api.cal.com/v1',
  docsURL: 'https://cal.com/docs/api-reference',
  credentialsSetupURL: 'https://app.cal.com/settings/developer/api-keys',
  category: 'productivity',
  notes:
    'Uses Cal.com API v1: the API key is passed as the `apiKey` query parameter (handled automatically by the connector). ' +
    'Keys are prefixed `cal_` (test) / `cal_live_` (live). ' +
    'To use API v2 instead, override baseURL to https://api.cal.com/v2 and add the required `cal-api-version` header (e.g. 2024-08-13) on each request via the generic API tool.',

  authTemplates: [
    {
      id: 'api-key',
      name: 'API Key (v1)',
      type: 'api_key',
      description:
        'Cal.com API key passed as the `apiKey` query parameter. Create at Settings → Developer → API Keys.',
      requiredFields: ['apiKey'],
      defaults: {
        type: 'api_key',
        queryParamName: 'apiKey',
      },
    },
  ],
};

/**
 * Calendly — scheduling SaaS.
 *
 * Personal Access Tokens (Bearer) for single-account/internal use, plus OAuth
 * 2.0 (authorization_code, PKCE) for multi-account/public apps. Calendly issues
 * a refresh_token automatically with every OAuth grant (no special scope or
 * param required); access tokens expire in ~2h.
 */
export const calendlyTemplate: VendorTemplate = {
  id: 'calendly',
  name: 'Calendly',
  serviceType: 'calendly',
  baseURL: 'https://api.calendly.com',
  docsURL: 'https://developer.calendly.com/api-docs',
  credentialsSetupURL: 'https://calendly.com/integrations/api_webhooks',
  category: 'productivity',

  authTemplates: [
    {
      id: 'personal-token',
      name: 'Personal Access Token',
      type: 'api_key',
      description:
        'Personal access token (Bearer) for single-account/internal use. Create at Integrations → API & Webhooks.',
      requiredFields: ['apiKey'],
      defaults: {
        type: 'api_key',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      },
    },
    {
      id: 'oauth-user',
      name: 'OAuth (User Authorization)',
      type: 'oauth',
      flow: 'authorization_code',
      description:
        'OAuth 2.0 for multi-account/public apps. Create a developer app at developer.calendly.com. Provide clientSecret for web apps; omit for native/desktop apps (secured via PKCE).',
      requiredFields: ['clientId', 'redirectUri'],
      optionalFields: ['clientSecret'],
      defaults: {
        type: 'oauth',
        flow: 'authorization_code',
        authorizationUrl: 'https://auth.calendly.com/oauth/authorize',
        tokenUrl: 'https://auth.calendly.com/oauth/token',
        usePKCE: true,
      },
      // Calendly returns a refresh_token with every OAuth grant unconditionally
      // — no scope/param needed. Access tokens expire in ~2h.
      refreshStrategy: { kind: 'automatic' },
    },
  ],
};
