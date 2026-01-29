/**
 * Web tools for fetching, searching, and scraping
 */

export { webFetch } from './webFetch.js';
export { webFetchJS } from './webFetchJS.js';
export { webSearch } from './webSearch.js';
export { webScrape } from './webScrape.js';

// Re-export search result type
export type { SearchResult } from './searchProviders/serper.js';
