/**
 * Cloudflare Vendor Template
 */
import type { VendorTemplate } from '../types.js';

export const cloudflareTemplate: VendorTemplate = {
  id: 'cloudflare',
  name: 'Cloudflare',
  serviceType: 'cloudflare',
  baseURL: 'https://api.cloudflare.com/client/v4',
  docsURL: 'https://developers.cloudflare.com/api/',
  credentialsSetupURL: 'https://dash.cloudflare.com/profile/api-tokens',
  category: 'cloud',
  notes:
    'API Tokens (recommended) are scoped and more secure. Global API Key requires email and has full account access.',

  authTemplates: [
    {
      id: 'api-token',
      name: 'API Token',
      type: 'api_key',
      description:
        'Scoped API token (recommended). Create at dash.cloudflare.com > My Profile > API Tokens',
      requiredFields: ['apiKey'],
      defaults: {
        type: 'api_key',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      },
    },
    {
      id: 'global-api-key',
      name: 'Global API Key',
      type: 'api_key',
      description:
        'Legacy global API key + email. Has full account access. Prefer API Tokens for least-privilege access',
      requiredFields: ['apiKey', 'username'],
      defaults: {
        type: 'api_key',
        headerName: 'X-Auth-Key',
      },
    },
  ],
};
