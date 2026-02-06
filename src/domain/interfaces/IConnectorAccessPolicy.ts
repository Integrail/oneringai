/**
 * IConnectorAccessPolicy - Pluggable access control for connector registry
 *
 * Policies are sync-only for performance — access checks must be fast
 * and policy data should be in-memory.
 */

import type { Connector } from '../../core/Connector.js';

/**
 * Opaque context passed to access policy checks.
 * Library imposes no structure — consumers define their own shape
 * (e.g., { userId, tenantId, roles }).
 */
export type ConnectorAccessContext = Record<string, unknown>;

export interface IConnectorAccessPolicy {
  /**
   * Check if a connector is accessible in the given context.
   * Receives the full Connector instance so it can inspect
   * config.tags, vendor, serviceType, etc.
   */
  canAccess(connector: Connector, context: ConnectorAccessContext): boolean;
}
