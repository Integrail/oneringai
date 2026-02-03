/**
 * PayPal Vendor Template
 */
import type { VendorTemplate } from '../types.js';

export const paypalTemplate: VendorTemplate = {
  id: 'paypal',
  name: 'PayPal',
  serviceType: 'paypal',
  baseURL: 'https://api-m.paypal.com/v2',
  docsURL: 'https://developer.paypal.com/docs/api/',
  credentialsSetupURL: 'https://developer.paypal.com/dashboard/applications',
  category: 'payments',
  notes: 'Use sandbox URL (api-m.sandbox.paypal.com) for testing',

  authTemplates: [
    {
      id: 'oauth-client-credentials',
      name: 'OAuth (Client Credentials)',
      type: 'oauth',
      flow: 'client_credentials',
      description: 'App-level authentication. Create REST API app at developer.paypal.com',
      requiredFields: ['clientId', 'clientSecret'],
      defaults: {
        type: 'oauth',
        flow: 'client_credentials',
        tokenUrl: 'https://api-m.paypal.com/v1/oauth2/token',
      },
    },
  ],
};
