/**
 * Search capability exports
 */

export { SearchProvider } from './SearchProvider.js';
export type {
  ISearchProvider,
  SearchResult,
  SearchOptions,
  SearchResponse,
  SearchProviderConfig,
} from './SearchProvider.js';

// Provider exports (for advanced usage)
export { SerperProvider } from './providers/SerperProvider.js';
export { BraveProvider } from './providers/BraveProvider.js';
export { TavilyProvider } from './providers/TavilyProvider.js';
export { RapidAPIProvider } from './providers/RapidAPIProvider.js';
