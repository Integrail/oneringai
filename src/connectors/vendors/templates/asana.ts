/**
 * Asana Vendor Template
 */
import type { VendorTemplate } from '../types.js';

export const asanaTemplate: VendorTemplate = {
  id: 'asana',
  name: 'Asana',
  serviceType: 'asana',
  baseURL: 'https://app.asana.com/api/1.0',
  docsURL: 'https://developers.asana.com/docs',
  credentialsSetupURL: 'https://app.asana.com/0/developer-console',
  category: 'development',

  authTemplates: [
    {
      id: 'pat',
      name: 'Personal Access Token',
      type: 'api_key',
      description: 'Personal access token for API access. Create at My Profile Settings > Apps > Developer Apps',
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
      description: 'OAuth application for user authorization. Create at developer console',
      requiredFields: ['clientId', 'clientSecret', 'redirectUri'],
      optionalFields: ['scope'],
      defaults: {
        type: 'oauth',
        flow: 'authorization_code',
        authorizationUrl: 'https://app.asana.com/-/oauth_authorize',
        tokenUrl: 'https://app.asana.com/-/oauth_token',
      },
      scopes: ['default'],
    },
  ],
};
