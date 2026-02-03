/**
 * Salesforce Vendor Template
 */
import type { VendorTemplate } from '../types.js';

export const salesforceTemplate: VendorTemplate = {
  id: 'salesforce',
  name: 'Salesforce',
  serviceType: 'salesforce',
  baseURL: 'https://login.salesforce.com/services/data/v59.0',
  docsURL: 'https://developer.salesforce.com/docs/apis',
  credentialsSetupURL: 'https://login.salesforce.com/lightning/setup/ConnectedApplication/home',
  category: 'crm',
  notes: 'After OAuth, baseURL changes to instance URL (e.g., yourinstance.salesforce.com)',

  authTemplates: [
    {
      id: 'oauth-user',
      name: 'OAuth (User Authorization)',
      type: 'oauth',
      flow: 'authorization_code',
      description: 'User logs in via Salesforce. Create Connected App in Setup',
      requiredFields: ['clientId', 'clientSecret', 'redirectUri'],
      optionalFields: ['scope'],
      defaults: {
        type: 'oauth',
        flow: 'authorization_code',
        authorizationUrl: 'https://login.salesforce.com/services/oauth2/authorize',
        tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
      },
      scopes: ['api', 'refresh_token', 'offline_access'],
    },
    {
      id: 'jwt-bearer',
      name: 'JWT Bearer (Server-to-Server)',
      type: 'oauth',
      flow: 'jwt_bearer',
      description: 'Automated server integration - requires certificate setup in Connected App',
      requiredFields: ['clientId', 'privateKey', 'username'],
      defaults: {
        type: 'oauth',
        flow: 'jwt_bearer',
        tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
        audience: 'https://login.salesforce.com',
      },
    },
  ],
};
