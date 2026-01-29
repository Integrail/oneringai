/**
 * Search provider types and utilities
 *
 * Re-exports shared utilities for backward compatibility
 */

// Re-export from shared module (DRY)
export {
  type ExtendedFetchOptions as SearchFetchOptions,
  buildQueryString,
  toConnectorOptions,
  buildEndpointWithQuery,
} from '../shared/index.js';
