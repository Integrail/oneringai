/**
 * Scrape Vendor Templates (ZenRows)
 */
import type { VendorTemplate } from '../types.js';

export const zenrowsTemplate: VendorTemplate = {
  id: 'zenrows',
  name: 'ZenRows',
  serviceType: 'zenrows',
  baseURL: 'https://api.zenrows.com/v1',
  docsURL: 'https://docs.zenrows.com/universal-scraper-api/api-reference',
  credentialsSetupURL: 'https://www.zenrows.com/register',
  category: 'scrape',

  authTemplates: [
    {
      id: 'api-key',
      name: 'API Key',
      type: 'api_key',
      description: 'ZenRows API key for web scraping. Get at zenrows.com dashboard',
      requiredFields: ['apiKey'],
      defaults: {
        type: 'api_key',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      },
    },
  ],
};
