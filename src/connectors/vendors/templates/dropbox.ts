/**
 * Dropbox Vendor Template
 */
import type { VendorTemplate } from '../types.js';

export const dropboxTemplate: VendorTemplate = {
  id: 'dropbox',
  name: 'Dropbox',
  serviceType: 'dropbox',
  baseURL: 'https://api.dropboxapi.com/2',
  docsURL: 'https://www.dropbox.com/developers/documentation',
  credentialsSetupURL: 'https://www.dropbox.com/developers/apps',
  category: 'storage',

  authTemplates: [
    {
      id: 'oauth-user',
      name: 'OAuth (User Authorization)',
      type: 'oauth',
      flow: 'authorization_code',
      description: 'OAuth app for user authorization. Create app at dropbox.com/developers/apps',
      requiredFields: ['clientId', 'clientSecret', 'redirectUri'],
      optionalFields: ['scope'],
      defaults: {
        type: 'oauth',
        flow: 'authorization_code',
        authorizationUrl: 'https://www.dropbox.com/oauth2/authorize',
        tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
        usePKCE: true,
      },
      scopes: ['files.content.read', 'files.content.write', 'files.metadata.read'],
    },
  ],
};
