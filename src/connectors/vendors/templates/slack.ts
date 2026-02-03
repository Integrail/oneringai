/**
 * Slack Vendor Template
 */
import type { VendorTemplate } from '../types.js';

export const slackTemplate: VendorTemplate = {
  id: 'slack',
  name: 'Slack',
  serviceType: 'slack',
  baseURL: 'https://slack.com/api',
  docsURL: 'https://api.slack.com/methods',
  credentialsSetupURL: 'https://api.slack.com/apps',
  category: 'communication',

  authTemplates: [
    {
      id: 'bot-token',
      name: 'Bot Token',
      type: 'api_key',
      description: 'Internal workspace bot - get from OAuth & Permissions page of your Slack app',
      requiredFields: ['apiKey'],
      defaults: {
        type: 'api_key',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      },
    },
    {
      id: 'oauth-user',
      name: 'OAuth (User Token)',
      type: 'oauth',
      flow: 'authorization_code',
      description: 'Distributed app - users authorize via Slack OAuth',
      requiredFields: ['clientId', 'clientSecret', 'redirectUri'],
      optionalFields: ['scope', 'userScope'],
      defaults: {
        type: 'oauth',
        flow: 'authorization_code',
        authorizationUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
      },
      scopes: ['chat:write', 'channels:read', 'users:read', 'im:write', 'groups:read'],
    },
  ],
};
