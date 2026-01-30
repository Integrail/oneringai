/**
 * Shared utilities for Connector-based capabilities
 */

export {
  // Types
  type BaseProviderConfig,
  type BaseProviderResponse,
  type ICapabilityProvider,
  type ExtendedFetchOptions,
  // Utilities
  buildQueryString,
  toConnectorOptions,
  buildEndpointWithQuery,
  resolveConnector,
  // Service type auto-detection (for external API-dependent tools)
  findConnectorByServiceTypes,
  listConnectorsByServiceTypes,
} from './types.js';
