/**
 * Vendor Templates - Re-export all templates
 *
 * This file exports all vendor templates for use by the registry generator
 * and for direct access.
 */

// Major Vendors (unified)
export { microsoftTemplate } from './microsoft.js';
export { googleTemplate } from './google.js';

// Communication
export { slackTemplate } from './slack.js';
export { discordTemplate } from './discord.js';
export { telegramTemplate } from './telegram.js';

// Development
export { githubTemplate } from './github.js';
export { gitlabTemplate } from './gitlab.js';
export { jiraTemplate, confluenceTemplate, bitbucketTemplate, trelloTemplate } from './atlassian.js';
export { linearTemplate } from './linear.js';
export { asanaTemplate } from './asana.js';

// Productivity
export { notionTemplate } from './notion.js';
export { airtableTemplate } from './airtable.js';

// CRM
export { salesforceTemplate } from './salesforce.js';
export { hubspotTemplate } from './hubspot.js';
export { pipedriveTemplate } from './pipedrive.js';

// Payments
export { stripeTemplate } from './stripe.js';
export { paypalTemplate } from './paypal.js';
export { quickbooksTemplate } from './quickbooks.js';
export { rampTemplate } from './ramp.js';

// Cloud
export { awsTemplate } from './aws.js';

// Storage
export { dropboxTemplate } from './dropbox.js';
export { boxTemplate } from './box.js';

// Email
export { sendgridTemplate, mailchimpTemplate, postmarkTemplate } from './email.js';

// Monitoring
export { datadogTemplate, pagerdutyTemplate, sentryTemplate } from './monitoring.js';

// Search
export {
  serperTemplate,
  braveSearchTemplate,
  tavilyTemplate,
  rapidapiSearchTemplate,
} from './search.js';

// Scrape
export { zenrowsTemplate } from './scrape.js';

// Other
export { twilioTemplate, zendeskTemplate, intercomTemplate, shopifyTemplate } from './other.js';

// Legacy exports (backward compatibility)
export {
  microsoft365Template,
  microsoftTeamsTemplate,
  azureTemplate,
  onedriveTemplate,
} from './microsoft.js';
export { googleWorkspaceTemplate, googleDriveTemplate, gcpTemplate } from './google.js';

/**
 * Array of all vendor templates
 * Used by the registry generator
 */
import { microsoftTemplate } from './microsoft.js';
import { googleTemplate } from './google.js';
import { slackTemplate } from './slack.js';
import { discordTemplate } from './discord.js';
import { telegramTemplate } from './telegram.js';
import { githubTemplate } from './github.js';
import { gitlabTemplate } from './gitlab.js';
import { jiraTemplate, confluenceTemplate, bitbucketTemplate, trelloTemplate } from './atlassian.js';
import { linearTemplate } from './linear.js';
import { asanaTemplate } from './asana.js';
import { notionTemplate } from './notion.js';
import { airtableTemplate } from './airtable.js';
import { salesforceTemplate } from './salesforce.js';
import { hubspotTemplate } from './hubspot.js';
import { pipedriveTemplate } from './pipedrive.js';
import { stripeTemplate } from './stripe.js';
import { paypalTemplate } from './paypal.js';
import { quickbooksTemplate } from './quickbooks.js';
import { rampTemplate } from './ramp.js';
import { awsTemplate } from './aws.js';
import { dropboxTemplate } from './dropbox.js';
import { boxTemplate } from './box.js';
import { sendgridTemplate, mailchimpTemplate, postmarkTemplate } from './email.js';
import { datadogTemplate, pagerdutyTemplate, sentryTemplate } from './monitoring.js';
import {
  serperTemplate,
  braveSearchTemplate,
  tavilyTemplate,
  rapidapiSearchTemplate,
} from './search.js';
import { zenrowsTemplate } from './scrape.js';
import { twilioTemplate, zendeskTemplate, intercomTemplate, shopifyTemplate } from './other.js';
import type { VendorTemplate } from '../types.js';

export const allVendorTemplates: VendorTemplate[] = [
  // Major Vendors (first for visibility)
  microsoftTemplate,
  googleTemplate,

  // Communication
  slackTemplate,
  discordTemplate,
  telegramTemplate,

  // Development
  githubTemplate,
  gitlabTemplate,
  bitbucketTemplate,
  jiraTemplate,
  linearTemplate,
  asanaTemplate,
  trelloTemplate,

  // Productivity
  notionTemplate,
  airtableTemplate,
  confluenceTemplate,

  // CRM
  salesforceTemplate,
  hubspotTemplate,
  pipedriveTemplate,

  // Payments
  stripeTemplate,
  paypalTemplate,
  quickbooksTemplate,
  rampTemplate,

  // Cloud
  awsTemplate,

  // Storage
  dropboxTemplate,
  boxTemplate,

  // Email
  sendgridTemplate,
  mailchimpTemplate,
  postmarkTemplate,

  // Monitoring
  datadogTemplate,
  pagerdutyTemplate,
  sentryTemplate,

  // Search
  serperTemplate,
  braveSearchTemplate,
  tavilyTemplate,
  rapidapiSearchTemplate,

  // Scrape
  zenrowsTemplate,

  // Other
  twilioTemplate,
  zendeskTemplate,
  intercomTemplate,
  shopifyTemplate,
];
