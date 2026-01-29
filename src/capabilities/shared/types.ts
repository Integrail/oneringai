/**
 * Shared types for Connector-based capabilities
 *
 * This module provides common types and utilities that can be reused
 * across all capabilities that use the Connector-First architecture.
 */

import type { ConnectorFetchOptions } from '../../core/Connector.js';
import type { Connector } from '../../core/Connector.js';

// ============ Base Provider Types ============

/**
 * Base configuration for all capability providers
 */
export interface BaseProviderConfig {
  /** Connector name or instance */
  connector: string | Connector;
}

/**
 * Base response for all capability providers
 */
export interface BaseProviderResponse {
  /** Whether the operation succeeded */
  success: boolean;
  /** Provider name */
  provider: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Base interface for all capability providers
 */
export interface ICapabilityProvider {
  /** Provider name */
  readonly name: string;
  /** Connector used for authentication */
  readonly connector: Connector;
}

// ============ Extended Fetch Options ============

/**
 * Extended fetch options with JSON body and query params support
 * Usable by any capability that makes HTTP requests via Connector
 */
export interface ExtendedFetchOptions extends Omit<ConnectorFetchOptions, 'body'> {
  /** JSON body (will be stringified automatically) */
  body?: Record<string, any>;
  /** Query parameters (will be appended to URL automatically) */
  queryParams?: Record<string, string | number | boolean>;
}

// ============ Utilities ============

/**
 * Build query string from params
 * @param params - Key-value pairs to convert to query string
 * @returns URL-encoded query string (without leading ?)
 */
export function buildQueryString(params: Record<string, string | number | boolean>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  }
  return searchParams.toString();
}

/**
 * Convert ExtendedFetchOptions to standard ConnectorFetchOptions
 * Handles body stringification and query param building
 *
 * @param options - Extended options with body/queryParams
 * @returns Standard ConnectorFetchOptions ready for Connector.fetch()
 */
export function toConnectorOptions(options: ExtendedFetchOptions): ConnectorFetchOptions {
  const { body, queryParams, ...rest } = options;

  const connectorOptions: ConnectorFetchOptions = {
    ...rest,
  };

  // Stringify body if present
  if (body) {
    connectorOptions.body = JSON.stringify(body);
    // Ensure Content-Type is set
    connectorOptions.headers = {
      'Content-Type': 'application/json',
      ...rest.headers,
    };
  }

  return connectorOptions;
}

/**
 * Build endpoint URL with query parameters
 * @param endpoint - Base endpoint path
 * @param queryParams - Query parameters to append
 * @returns Endpoint with query string
 */
export function buildEndpointWithQuery(
  endpoint: string,
  queryParams?: Record<string, string | number | boolean>
): string {
  if (!queryParams || Object.keys(queryParams).length === 0) {
    return endpoint;
  }
  const queryString = buildQueryString(queryParams);
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}${queryString}`;
}

// ============ Provider Factory Helper ============

/**
 * Resolve connector from config (name or instance)
 * Shared logic for all provider factories
 *
 * @param connectorOrName - Connector name string or Connector instance
 * @returns Resolved Connector instance
 * @throws Error if connector not found
 */
export function resolveConnector(connectorOrName: string | Connector): Connector {
  // Import dynamically to avoid circular deps
  const { Connector: ConnectorClass } = require('../../core/Connector.js');

  if (typeof connectorOrName === 'string') {
    return ConnectorClass.get(connectorOrName);
  }
  return connectorOrName;
}
