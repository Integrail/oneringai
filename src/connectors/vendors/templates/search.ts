/**
 * Search Vendor Templates (Serper, Brave, Tavily, RapidAPI)
 */
import type { VendorTemplate } from '../types.js';

export const serperTemplate: VendorTemplate = {
  id: 'serper',
  name: 'Serper',
  serviceType: 'serper',
  baseURL: 'https://google.serper.dev',
  docsURL: 'https://serper.dev/docs',
  credentialsSetupURL: 'https://serper.dev/api-key',
  category: 'search',

  authTemplates: [
    {
      id: 'api-key',
      name: 'API Key',
      type: 'api_key',
      description: 'Serper API key for Google search. Get at serper.dev dashboard',
      requiredFields: ['apiKey'],
      defaults: {
        type: 'api_key',
        headerName: 'X-API-KEY',
        headerPrefix: '',
      },
    },
  ],
};

export const braveSearchTemplate: VendorTemplate = {
  id: 'brave-search',
  name: 'Brave Search',
  serviceType: 'brave-search',
  baseURL: 'https://api.search.brave.com/res/v1',
  docsURL: 'https://brave.com/search/api/',
  credentialsSetupURL: 'https://brave.com/search/api/',
  category: 'search',

  authTemplates: [
    {
      id: 'api-key',
      name: 'API Key',
      type: 'api_key',
      description: 'Brave Search API key. Sign up at brave.com/search/api',
      requiredFields: ['apiKey'],
      defaults: {
        type: 'api_key',
        headerName: 'X-Subscription-Token',
        headerPrefix: '',
      },
    },
  ],
};

export const tavilyTemplate: VendorTemplate = {
  id: 'tavily',
  name: 'Tavily',
  serviceType: 'tavily',
  baseURL: 'https://api.tavily.com',
  docsURL: 'https://tavily.com/docs',
  credentialsSetupURL: 'https://tavily.com/#api',
  category: 'search',

  authTemplates: [
    {
      id: 'api-key',
      name: 'API Key',
      type: 'api_key',
      description: 'Tavily API key for AI-optimized search. Get at tavily.com',
      requiredFields: ['apiKey'],
      defaults: {
        type: 'api_key',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      },
    },
  ],
};

export const rapidapiSearchTemplate: VendorTemplate = {
  id: 'rapidapi-search',
  name: 'RapidAPI Web Search',
  serviceType: 'rapidapi-search',
  baseURL: 'https://real-time-web-search.p.rapidapi.com',
  docsURL: 'https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-web-search',
  credentialsSetupURL: 'https://rapidapi.com/developer/dashboard',
  category: 'search',

  authTemplates: [
    {
      id: 'api-key',
      name: 'RapidAPI Key',
      type: 'api_key',
      description: 'RapidAPI key for web search. Subscribe at rapidapi.com',
      requiredFields: ['apiKey'],
      defaults: {
        type: 'api_key',
        headerName: 'X-RapidAPI-Key',
        headerPrefix: '',
      },
    },
  ],
};
