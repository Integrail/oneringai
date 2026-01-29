/**
 * Scrape capability exports
 *
 * Provides unified web scraping with multiple vendor support.
 * Uses Connector-First architecture.
 */

export { ScrapeProvider, registerScrapeProvider, getRegisteredScrapeProviders } from './ScrapeProvider.js';
export type {
  IScrapeProvider,
  ScrapeResult,
  ScrapeOptions,
  ScrapeResponse,
  ScrapeFeature,
  ScrapeProviderConfig,
  ScrapeProviderFallbackConfig,
} from './ScrapeProvider.js';

// Provider implementations - import to auto-register with the factory
export { ZenRowsProvider } from './providers/ZenRowsProvider.js';
export type { ZenRowsOptions } from './providers/ZenRowsProvider.js';
