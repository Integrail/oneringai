/**
 * Atlassian Vendor Templates (Jira, Confluence, Bitbucket, Trello)
 */
import type { VendorTemplate } from '../types.js';

export const jiraTemplate: VendorTemplate = {
  id: 'jira',
  name: 'Jira',
  serviceType: 'jira',
  baseURL: 'https://your-domain.atlassian.net/rest/api/3',
  docsURL: 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/',
  credentialsSetupURL: 'https://id.atlassian.com/manage-profile/security/api-tokens',
  category: 'development',
  notes: 'Replace "your-domain" in baseURL with your Atlassian domain',

  authTemplates: [
    {
      id: 'api-token',
      name: 'API Token',
      type: 'api_key',
      description: 'API token with email for Basic Auth. Create at Atlassian Account > Security > API tokens',
      requiredFields: ['apiKey', 'username'],
      defaults: {
        type: 'api_key',
        headerName: 'Authorization',
        headerPrefix: 'Basic',
      },
    },
    {
      id: 'oauth-3lo',
      name: 'OAuth 2.0 (3LO)',
      type: 'oauth',
      flow: 'authorization_code',
      description: 'Three-legged OAuth for user authorization. Create app at developer.atlassian.com',
      requiredFields: ['clientId', 'clientSecret', 'redirectUri'],
      optionalFields: ['scope'],
      defaults: {
        type: 'oauth',
        flow: 'authorization_code',
        authorizationUrl: 'https://auth.atlassian.com/authorize',
        tokenUrl: 'https://auth.atlassian.com/oauth/token',
      },
      scopes: ['read:jira-work', 'write:jira-work', 'read:jira-user'],
    },
  ],
};

export const confluenceTemplate: VendorTemplate = {
  id: 'confluence',
  name: 'Confluence',
  serviceType: 'confluence',
  baseURL: 'https://your-domain.atlassian.net/wiki/rest/api',
  docsURL: 'https://developer.atlassian.com/cloud/confluence/rest/',
  credentialsSetupURL: 'https://id.atlassian.com/manage-profile/security/api-tokens',
  category: 'productivity',
  notes: 'Replace "your-domain" in baseURL with your Atlassian domain',

  authTemplates: [
    {
      id: 'api-token',
      name: 'API Token',
      type: 'api_key',
      description: 'API token with email for Basic Auth. Create at Atlassian Account > Security > API tokens',
      requiredFields: ['apiKey', 'username'],
      defaults: {
        type: 'api_key',
        headerName: 'Authorization',
        headerPrefix: 'Basic',
      },
    },
    {
      id: 'oauth-3lo',
      name: 'OAuth 2.0 (3LO)',
      type: 'oauth',
      flow: 'authorization_code',
      description: 'Three-legged OAuth for user authorization',
      requiredFields: ['clientId', 'clientSecret', 'redirectUri'],
      optionalFields: ['scope'],
      defaults: {
        type: 'oauth',
        flow: 'authorization_code',
        authorizationUrl: 'https://auth.atlassian.com/authorize',
        tokenUrl: 'https://auth.atlassian.com/oauth/token',
      },
      scopes: ['read:confluence-content.all', 'write:confluence-content', 'read:confluence-space.summary'],
    },
  ],
};

export const bitbucketTemplate: VendorTemplate = {
  id: 'bitbucket',
  name: 'Bitbucket',
  serviceType: 'bitbucket',
  baseURL: 'https://api.bitbucket.org/2.0',
  docsURL: 'https://developer.atlassian.com/cloud/bitbucket/rest/',
  credentialsSetupURL: 'https://bitbucket.org/account/settings/app-passwords/',
  category: 'development',

  authTemplates: [
    {
      id: 'app-password',
      name: 'App Password',
      type: 'api_key',
      description: 'App password with username for Basic Auth. Create at Personal Settings > App passwords',
      requiredFields: ['apiKey', 'username'],
      defaults: {
        type: 'api_key',
        headerName: 'Authorization',
        headerPrefix: 'Basic',
      },
    },
    {
      id: 'oauth-user',
      name: 'OAuth Consumer',
      type: 'oauth',
      flow: 'authorization_code',
      description: 'OAuth consumer for user authorization. Create at Workspace Settings > OAuth consumers',
      requiredFields: ['clientId', 'clientSecret', 'redirectUri'],
      optionalFields: ['scope'],
      defaults: {
        type: 'oauth',
        flow: 'authorization_code',
        authorizationUrl: 'https://bitbucket.org/site/oauth2/authorize',
        tokenUrl: 'https://bitbucket.org/site/oauth2/access_token',
      },
      scopes: ['repository', 'pullrequest', 'account'],
    },
  ],
};

export const trelloTemplate: VendorTemplate = {
  id: 'trello',
  name: 'Trello',
  serviceType: 'trello',
  baseURL: 'https://api.trello.com/1',
  docsURL: 'https://developer.atlassian.com/cloud/trello/rest/',
  credentialsSetupURL: 'https://trello.com/power-ups/admin',
  category: 'development',

  authTemplates: [
    {
      id: 'api-key',
      name: 'API Key + Token',
      type: 'api_key',
      description: 'API key and token pair. Get key at trello.com/app-key, generate token from there',
      requiredFields: ['apiKey'],
      optionalFields: ['applicationKey'],
      defaults: {
        type: 'api_key',
        headerName: 'Authorization',
        headerPrefix: 'OAuth oauth_consumer_key="{apiKey}", oauth_token=',
      },
    },
    {
      id: 'oauth-user',
      name: 'OAuth 1.0a',
      type: 'oauth',
      flow: 'authorization_code',
      description: 'OAuth 1.0a for user authorization (legacy)',
      requiredFields: ['clientId', 'clientSecret', 'redirectUri'],
      optionalFields: ['scope'],
      defaults: {
        type: 'oauth',
        flow: 'authorization_code',
        authorizationUrl: 'https://trello.com/1/authorize',
        tokenUrl: 'https://trello.com/1/OAuthGetAccessToken',
      },
      scopes: ['read', 'write', 'account'],
    },
  ],
};
