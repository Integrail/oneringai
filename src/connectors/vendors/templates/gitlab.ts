/**
 * GitLab Vendor Template
 */
import type { VendorTemplate } from '../types.js';

export const gitlabTemplate: VendorTemplate = {
  id: 'gitlab',
  name: 'GitLab',
  serviceType: 'gitlab',
  baseURL: 'https://gitlab.com/api/v4',
  docsURL: 'https://docs.gitlab.com/ee/api/',
  credentialsSetupURL: 'https://gitlab.com/-/profile/personal_access_tokens',
  category: 'development',
  notes: 'For self-hosted GitLab, replace baseURL with your instance URL',

  authTemplates: [
    {
      id: 'pat',
      name: 'Personal Access Token',
      type: 'api_key',
      description: 'Personal access token for API access. Create at User Settings > Access Tokens',
      requiredFields: ['apiKey'],
      defaults: {
        type: 'api_key',
        headerName: 'PRIVATE-TOKEN',
        headerPrefix: '',
      },
    },
    {
      id: 'oauth-user',
      name: 'OAuth (User Authorization)',
      type: 'oauth',
      flow: 'authorization_code',
      description: 'OAuth2 application for user authorization. Provide clientSecret for web apps; omit for native/desktop apps (secured via PKCE).',
      requiredFields: ['clientId', 'redirectUri'],
      optionalFields: ['clientSecret', 'scope'],
      defaults: {
        type: 'oauth',
        flow: 'authorization_code',
        authorizationUrl: 'https://gitlab.com/oauth/authorize',
        tokenUrl: 'https://gitlab.com/oauth/token',
        usePKCE: true,
      },
      scopes: ['api', 'read_user', 'read_repository', 'write_repository'],
      scopeDescriptions: {
        'api': 'Full API access',
        'read_user': 'Read user profile',
        'read_repository': 'Read repository contents',
        'write_repository': 'Write to repositories',
      },
    },
  ],
};
