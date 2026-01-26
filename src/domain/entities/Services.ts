/**
 * Services - Constants for well-known external services
 *
 * These are just helpful constants for serviceType, not a type system.
 * You can use any string as serviceType - these are for convenience.
 */

/**
 * Well-known external service identifiers
 * Use with ConnectorConfig.serviceType
 */
export const Services = {
  // Communication
  Slack: 'slack',
  Discord: 'discord',
  MicrosoftTeams: 'microsoft-teams',
  Telegram: 'telegram',

  // Development & Project Management
  GitHub: 'github',
  GitLab: 'gitlab',
  Bitbucket: 'bitbucket',
  Jira: 'jira',
  Linear: 'linear',
  Asana: 'asana',
  Trello: 'trello',

  // Productivity & Collaboration
  Notion: 'notion',
  Airtable: 'airtable',
  GoogleWorkspace: 'google-workspace',
  Microsoft365: 'microsoft-365',
  Confluence: 'confluence',

  // CRM & Sales
  Salesforce: 'salesforce',
  HubSpot: 'hubspot',
  Pipedrive: 'pipedrive',

  // Payments & Finance
  Stripe: 'stripe',
  PayPal: 'paypal',

  // Cloud Providers
  AWS: 'aws',
  GCP: 'gcp',
  Azure: 'azure',

  // Storage
  Dropbox: 'dropbox',
  Box: 'box',
  GoogleDrive: 'google-drive',
  OneDrive: 'onedrive',

  // Email
  SendGrid: 'sendgrid',
  Mailchimp: 'mailchimp',
  Postmark: 'postmark',

  // Monitoring & Observability
  Datadog: 'datadog',
  PagerDuty: 'pagerduty',
  Sentry: 'sentry',

  // Other
  Twilio: 'twilio',
  Zendesk: 'zendesk',
  Intercom: 'intercom',
  Shopify: 'shopify',
} as const;

export type ServiceType = (typeof Services)[keyof typeof Services];

/**
 * URL patterns for auto-detecting service type from baseURL
 * Order matters - more specific patterns should come first
 */
export const SERVICE_URL_PATTERNS: Array<{ service: string; pattern: RegExp }> = [
  // Communication
  { service: Services.Slack, pattern: /slack\.com/i },
  { service: Services.Discord, pattern: /discord\.com|discordapp\.com/i },
  { service: Services.MicrosoftTeams, pattern: /teams\.microsoft\.com|graph\.microsoft\.com.*teams/i },
  { service: Services.Telegram, pattern: /api\.telegram\.org/i },

  // Development & Project Management
  { service: Services.GitHub, pattern: /api\.github\.com/i },
  { service: Services.GitLab, pattern: /gitlab\.com|gitlab\./i },
  { service: Services.Bitbucket, pattern: /api\.bitbucket\.org|bitbucket\.org/i },
  { service: Services.Jira, pattern: /atlassian\.net.*jira|jira\./i },
  { service: Services.Linear, pattern: /api\.linear\.app/i },
  { service: Services.Asana, pattern: /api\.asana\.com/i },
  { service: Services.Trello, pattern: /api\.trello\.com/i },

  // Productivity & Collaboration
  { service: Services.Notion, pattern: /api\.notion\.com/i },
  { service: Services.Airtable, pattern: /api\.airtable\.com/i },
  { service: Services.Confluence, pattern: /atlassian\.net.*wiki|confluence\./i },
  { service: Services.GoogleWorkspace, pattern: /googleapis\.com.*(drive|docs|sheets|calendar)/i },
  { service: Services.Microsoft365, pattern: /graph\.microsoft\.com/i },

  // CRM & Sales
  { service: Services.Salesforce, pattern: /salesforce\.com|force\.com/i },
  { service: Services.HubSpot, pattern: /api\.hubapi\.com|api\.hubspot\.com/i },
  { service: Services.Pipedrive, pattern: /api\.pipedrive\.com/i },

  // Payments & Finance
  { service: Services.Stripe, pattern: /api\.stripe\.com/i },
  { service: Services.PayPal, pattern: /api\.paypal\.com|api-m\.paypal\.com/i },

  // Cloud Providers
  { service: Services.AWS, pattern: /amazonaws\.com/i },
  { service: Services.GCP, pattern: /googleapis\.com/i },
  { service: Services.Azure, pattern: /azure\.com|microsoft\.com.*azure/i },

  // Storage
  { service: Services.Dropbox, pattern: /api\.dropboxapi\.com|dropbox\.com/i },
  { service: Services.Box, pattern: /api\.box\.com/i },
  { service: Services.GoogleDrive, pattern: /googleapis\.com.*drive/i },
  { service: Services.OneDrive, pattern: /graph\.microsoft\.com.*drive/i },

  // Email
  { service: Services.SendGrid, pattern: /api\.sendgrid\.com/i },
  { service: Services.Mailchimp, pattern: /api\.mailchimp\.com|mandrillapp\.com/i },
  { service: Services.Postmark, pattern: /api\.postmarkapp\.com/i },

  // Monitoring & Observability
  { service: Services.Datadog, pattern: /api\.datadoghq\.com/i },
  { service: Services.PagerDuty, pattern: /api\.pagerduty\.com/i },
  { service: Services.Sentry, pattern: /sentry\.io/i },

  // Other
  { service: Services.Twilio, pattern: /api\.twilio\.com/i },
  { service: Services.Zendesk, pattern: /zendesk\.com/i },
  { service: Services.Intercom, pattern: /api\.intercom\.io/i },
  { service: Services.Shopify, pattern: /shopify\.com.*admin/i },
];

/**
 * Detect service type from a URL
 * @param url - Base URL or full URL to check
 * @returns Service type string or undefined if not recognized
 */
export function detectServiceFromURL(url: string): string | undefined {
  const normalizedUrl = url.toLowerCase();

  for (const { service, pattern } of SERVICE_URL_PATTERNS) {
    if (pattern.test(normalizedUrl)) {
      return service;
    }
  }

  return undefined;
}

/**
 * Service metadata for documentation and tooling
 */
export interface ServiceInfo {
  id: string;
  name: string;
  category:
    | 'communication'
    | 'development'
    | 'productivity'
    | 'crm'
    | 'payments'
    | 'cloud'
    | 'storage'
    | 'email'
    | 'monitoring'
    | 'other';
  baseURL: string;
  docsURL?: string;
}

/**
 * Metadata for well-known services
 * Useful for documentation, UI generation, and tooling
 */
export const SERVICE_INFO: Record<string, ServiceInfo> = {
  [Services.Slack]: {
    id: Services.Slack,
    name: 'Slack',
    category: 'communication',
    baseURL: 'https://slack.com/api',
    docsURL: 'https://api.slack.com/methods',
  },
  [Services.GitHub]: {
    id: Services.GitHub,
    name: 'GitHub',
    category: 'development',
    baseURL: 'https://api.github.com',
    docsURL: 'https://docs.github.com/en/rest',
  },
  [Services.Jira]: {
    id: Services.Jira,
    name: 'Jira',
    category: 'development',
    baseURL: 'https://your-domain.atlassian.net/rest/api/3',
    docsURL: 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/',
  },
  [Services.Notion]: {
    id: Services.Notion,
    name: 'Notion',
    category: 'productivity',
    baseURL: 'https://api.notion.com/v1',
    docsURL: 'https://developers.notion.com/reference',
  },
  [Services.Stripe]: {
    id: Services.Stripe,
    name: 'Stripe',
    category: 'payments',
    baseURL: 'https://api.stripe.com/v1',
    docsURL: 'https://stripe.com/docs/api',
  },
  // Add more as needed
};

/**
 * Get service info by service type
 */
export function getServiceInfo(serviceType: string): ServiceInfo | undefined {
  return SERVICE_INFO[serviceType];
}
