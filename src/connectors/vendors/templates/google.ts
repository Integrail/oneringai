/**
 * Google Vendor Template (Unified)
 *
 * Single connector for all Google services via Google APIs.
 * Includes access to: Workspace (Drive, Docs, Sheets, Calendar), Gmail, GCP, etc.
 */
import type { VendorTemplate } from '../types.js';

export const googleTemplate: VendorTemplate = {
  id: 'google',
  name: 'Google',
  serviceType: 'google',
  baseURL: 'https://www.googleapis.com',
  docsURL: 'https://developers.google.com/',
  credentialsSetupURL: 'https://console.cloud.google.com/apis/credentials',
  category: 'major-vendors',
  notes: 'Unified access to Google Workspace (Drive, Docs, Sheets, Calendar), Gmail, and Cloud APIs',

  authTemplates: [
    {
      id: 'oauth-user',
      name: 'OAuth (User Consent)',
      type: 'oauth',
      flow: 'authorization_code',
      description: 'User logs in with Google account. Best for accessing user data (Drive, Gmail, Calendar)',
      requiredFields: ['clientId', 'clientSecret', 'redirectUri'],
      optionalFields: ['scope'],
      defaults: {
        type: 'oauth',
        flow: 'authorization_code',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
      },
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/documents',
      ],
    },
    {
      id: 'service-account',
      name: 'Service Account (JWT Bearer)',
      type: 'oauth',
      flow: 'jwt_bearer',
      description: 'Server-to-server auth without user. Download JSON key from GCP Console. Can impersonate users with domain-wide delegation',
      requiredFields: ['clientId', 'privateKey'],
      optionalFields: ['scope', 'subject'],
      defaults: {
        type: 'oauth',
        flow: 'jwt_bearer',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        audience: 'https://oauth2.googleapis.com/token',
      },
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/drive',
      ],
    },
  ],
};

// Legacy exports for backward compatibility (all point to unified template)
export const googleWorkspaceTemplate = googleTemplate;
export const googleDriveTemplate = googleTemplate;
export const gcpTemplate = googleTemplate;
