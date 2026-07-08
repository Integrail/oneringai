/**
 * Sales-Engagement / Outreach Vendor Templates (EmailBison, HeyReach, Clay)
 *
 * These are all API-key services. Their agentic functionality is delivered via
 * the generic `<connector>_api` tool (ConnectorTools.for), so no service-specific
 * tool factory is required — the LLM calls documented REST endpoints directly.
 */
import type { VendorTemplate } from '../types.js';

/**
 * EmailBison — private cold-email sequencer.
 *
 * Deployed per-instance: every workspace lives on its own domain, so there is
 * NO shared default base URL. Operators MUST override `baseURL` with their
 * instance (e.g. `https://acme.emailbison.com/api`). Auth is a Bearer token
 * created under Settings → Developer API.
 */
export const emailbisonTemplate: VendorTemplate = {
  id: 'emailbison',
  name: 'EmailBison',
  serviceType: 'emailbison',
  // Placeholder — each EmailBison deployment has its own domain. Override via
  // createConnectorFromTemplate(..., { baseURL: 'https://<your-instance>/api' }).
  baseURL: 'https://your-instance.emailbison.com/api',
  docsURL: 'https://docs.emailbison.com/get-started/authentication',
  credentialsSetupURL: 'https://docs.emailbison.com/get-started/authentication',
  category: 'email',
  notes:
    'EmailBison is deployed per-instance — every workspace has its own domain, so there is no shared base URL. ' +
    'You MUST override baseURL with your instance (e.g. https://acme.emailbison.com/api). ' +
    'Create a token at Settings → Developer API → New API Token. `api-user` tokens authenticate only for the workspace they belong to.',

  authTemplates: [
    {
      id: 'api-token',
      name: 'API Token',
      type: 'api_key',
      description:
        'Developer API token (Bearer). Create at Settings → Developer API → New API Token. Endpoints include /api/campaigns, /api/campaigns/sequence-steps, leads and replies.',
      requiredFields: ['apiKey'],
      defaults: {
        type: 'api_key',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      },
    },
  ],
};

/**
 * HeyReach — LinkedIn sequencing / outreach automation.
 *
 * Authenticates with a raw API key in the `X-API-KEY` header (no `Bearer`
 * prefix). Keys never expire but can be revoked. Rate limit: 300 req/min.
 */
export const heyreachTemplate: VendorTemplate = {
  id: 'heyreach',
  name: 'HeyReach',
  serviceType: 'heyreach',
  baseURL: 'https://api.heyreach.io/api/public',
  docsURL: 'https://documenter.getpostman.com/view/23808049/2sA2xb5F75',
  credentialsSetupURL: 'https://app.heyreach.io/',
  category: 'communication',
  notes:
    'Get your API key from HeyReach → Settings → Integrations → Public API. ' +
    'Keys never expire but can be revoked. Rate limit: 300 requests/minute. ' +
    'Verify a key with GET /auth/CheckApiKey (expect HTTP 200). ' +
    'Common endpoints: POST /campaign/AddLeadsToCampaignV2, /inbox, /list.',

  authTemplates: [
    {
      id: 'api-key',
      name: 'API Key',
      type: 'api_key',
      description:
        'Public API key sent via the X-API-KEY header. Create at Settings → Integrations → Public API.',
      requiredFields: ['apiKey'],
      defaults: {
        type: 'api_key',
        // HeyReach expects the raw key in X-API-KEY with no scheme prefix.
        headerName: 'X-API-KEY',
        headerPrefix: '',
      },
    },
  ],
};

/**
 * Clay — data enrichment & buying-group sourcing.
 *
 * Clay is MCP-first and does not publish a conventional REST management API.
 * This is a best-effort Bearer template for HTTP calls + per-table webhook
 * ingestion. For richer agentic use, prefer configuring Clay via MCP
 * (MCPRegistry) rather than this connector.
 */
export const clayTemplate: VendorTemplate = {
  id: 'clay',
  name: 'Clay',
  serviceType: 'clay',
  baseURL: 'https://api.clay.com',
  docsURL: 'https://university.clay.com/docs',
  credentialsSetupURL: 'https://university.clay.com/docs/guide-find-clay-api-key',
  category: 'other',
  notes:
    'Clay is MCP-first and does not publish a conventional REST management API. ' +
    'This template provides best-effort Bearer auth using your Clay API key (Account → API key) for HTTP calls and ' +
    'per-table webhook ingestion — paste the full https://api.clay.com/v3/sources/webhook/... URL as the endpoint. ' +
    'For richer agentic sourcing/enrichment, configure Clay via MCP (MCPRegistry) instead of this connector.',

  authTemplates: [
    {
      id: 'api-key',
      name: 'API Key',
      type: 'api_key',
      description:
        'Clay API key (Bearer). Find it under Account → API key. Also works as the auth header when POSTing to Clay table webhook URLs.',
      requiredFields: ['apiKey'],
      defaults: {
        type: 'api_key',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      },
    },
  ],
};
