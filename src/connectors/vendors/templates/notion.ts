/**
 * Notion Vendor Template
 */
import type { VendorTemplate } from '../types.js';

export const notionTemplate: VendorTemplate = {
  id: 'notion',
  name: 'Notion',
  serviceType: 'notion',
  baseURL: 'https://api.notion.com/v1',
  docsURL: 'https://developers.notion.com/reference',
  credentialsSetupURL: 'https://www.notion.so/my-integrations',
  category: 'productivity',

  authTemplates: [
    {
      id: 'internal-token',
      name: 'Internal Integration Token',
      type: 'api_key',
      description: 'Internal integration token for workspace access. Create at notion.so/my-integrations',
      requiredFields: ['apiKey'],
      defaults: {
        type: 'api_key',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      },
    },
    {
      id: 'oauth-user',
      name: 'Public Integration (OAuth)',
      type: 'oauth',
      flow: 'authorization_code',
      description: 'Public integration for multi-workspace access',
      requiredFields: ['clientId', 'clientSecret', 'redirectUri'],
      optionalFields: ['scope'],
      defaults: {
        type: 'oauth',
        flow: 'authorization_code',
        authorizationUrl: 'https://api.notion.com/v1/oauth/authorize',
        tokenUrl: 'https://api.notion.com/v1/oauth/token',
      },
    },
  ],
};
