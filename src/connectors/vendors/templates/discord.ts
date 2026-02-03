/**
 * Discord Vendor Template
 */
import type { VendorTemplate } from '../types.js';

export const discordTemplate: VendorTemplate = {
  id: 'discord',
  name: 'Discord',
  serviceType: 'discord',
  baseURL: 'https://discord.com/api/v10',
  docsURL: 'https://discord.com/developers/docs',
  credentialsSetupURL: 'https://discord.com/developers/applications',
  category: 'communication',

  authTemplates: [
    {
      id: 'bot-token',
      name: 'Bot Token',
      type: 'api_key',
      description: 'Bot token for Discord bots - get from Bot section of your application',
      requiredFields: ['apiKey'],
      defaults: {
        type: 'api_key',
        headerName: 'Authorization',
        headerPrefix: 'Bot',
      },
    },
    {
      id: 'oauth-user',
      name: 'OAuth (User Token)',
      type: 'oauth',
      flow: 'authorization_code',
      description: 'OAuth2 for user authorization - users grant permissions to your app',
      requiredFields: ['clientId', 'clientSecret', 'redirectUri'],
      optionalFields: ['scope'],
      defaults: {
        type: 'oauth',
        flow: 'authorization_code',
        authorizationUrl: 'https://discord.com/api/oauth2/authorize',
        tokenUrl: 'https://discord.com/api/oauth2/token',
      },
      scopes: ['identify', 'guilds', 'guilds.members.read', 'messages.read'],
    },
  ],
};
