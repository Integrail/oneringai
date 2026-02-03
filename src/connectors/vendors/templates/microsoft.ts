/**
 * Microsoft Vendor Template (Unified)
 *
 * Single connector for all Microsoft services via Microsoft Graph API.
 * Includes access to: 365, Teams, OneDrive, Outlook, Azure AD, etc.
 */
import type { VendorTemplate } from '../types.js';

export const microsoftTemplate: VendorTemplate = {
  id: 'microsoft',
  name: 'Microsoft',
  serviceType: 'microsoft',
  baseURL: 'https://graph.microsoft.com/v1.0',
  docsURL: 'https://learn.microsoft.com/en-us/graph/',
  credentialsSetupURL: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
  category: 'major-vendors',
  notes: 'Unified access to Microsoft 365, Teams, OneDrive, Outlook, Calendar via Microsoft Graph API',

  authTemplates: [
    {
      id: 'oauth-user',
      name: 'OAuth (Delegated Permissions)',
      type: 'oauth',
      flow: 'authorization_code',
      description: 'User signs in with Microsoft account. Best for accessing user data (mail, calendar, files)',
      requiredFields: ['clientId', 'clientSecret', 'redirectUri', 'tenantId'],
      optionalFields: ['scope'],
      defaults: {
        type: 'oauth',
        flow: 'authorization_code',
        authorizationUrl: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token',
      },
      scopes: [
        'User.Read',
        'Mail.Read',
        'Mail.Send',
        'Files.ReadWrite',
        'Calendars.ReadWrite',
        'ChannelMessage.Send',
        'Team.ReadBasic.All',
        'Chat.ReadWrite',
        'offline_access',
      ],
    },
    {
      id: 'client-credentials',
      name: 'App-Only (Client Credentials)',
      type: 'oauth',
      flow: 'client_credentials',
      description: 'App authenticates as itself - requires admin consent. Best for automation and background tasks',
      requiredFields: ['clientId', 'clientSecret', 'tenantId'],
      optionalFields: ['scope'],
      defaults: {
        type: 'oauth',
        flow: 'client_credentials',
        tokenUrl: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token',
      },
      scopes: ['https://graph.microsoft.com/.default'],
    },
  ],
};

// Legacy exports for backward compatibility (all point to unified template)
export const microsoft365Template = microsoftTemplate;
export const microsoftTeamsTemplate = microsoftTemplate;
export const azureTemplate = microsoftTemplate;
export const onedriveTemplate = microsoftTemplate;
