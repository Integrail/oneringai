/**
 * HubSpot Vendor Template
 */
import type { VendorTemplate } from '../types.js';

export const hubspotTemplate: VendorTemplate = {
  id: 'hubspot',
  name: 'HubSpot',
  serviceType: 'hubspot',
  baseURL: 'https://api.hubapi.com',
  docsURL: 'https://developers.hubspot.com/docs/api',
  credentialsSetupURL: 'https://developers.hubspot.com/get-started',
  category: 'crm',

  authTemplates: [
    {
      id: 'api-key',
      name: 'Private App Token',
      type: 'api_key',
      description: 'Private app access token. Create at Settings > Integrations > Private Apps',
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
      description: 'Public app OAuth for multi-portal access. Create app at developers.hubspot.com',
      requiredFields: ['clientId', 'clientSecret', 'redirectUri'],
      optionalFields: ['scope'],
      defaults: {
        type: 'oauth',
        flow: 'authorization_code',
        authorizationUrl: 'https://app.hubspot.com/oauth/authorize',
        tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
      },
      scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.companies.read'],
    },
  ],
};
