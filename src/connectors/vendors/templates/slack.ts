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
      description: 'Internal workspace bot - get from OAuth & Permissions page of your Slack app. For Socket Mode bots, also provide appToken and signingSecret in extra fields.',
      requiredFields: ['apiKey'],
      optionalFields: ['appToken', 'signingSecret'],
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
      description: 'Distributed app - users authorize via Slack OAuth. Provide clientSecret for web apps; omit for native/desktop apps (secured via PKCE).',
      requiredFields: ['clientId', 'redirectUri'],
      optionalFields: ['clientSecret', 'scope', 'userScope'],
      defaults: {
        type: 'oauth',
        flow: 'authorization_code',
        authorizationUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
        usePKCE: true,
      },
      scopes: ['chat:write', 'channels:read', 'users:read', 'im:write', 'groups:read', 'files:read', 'files:write', 'reactions:read', 'reactions:write', 'team:read'],
      scopeDescriptions: {
        'chat:write': 'Send messages as the app',
        'channels:read': 'View basic channel info',
        'users:read': 'View people in the workspace',
        'im:write': 'Send direct messages',
        'groups:read': 'View basic private channel info',
        'files:read': 'View files shared in channels',
        'files:write': 'Upload and manage files',
        'reactions:read': 'View emoji reactions',
        'reactions:write': 'Add and remove emoji reactions',
        'team:read': 'View workspace info',
      },
    },
  ],
};
