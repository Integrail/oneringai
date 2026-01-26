/**
 * Connector Tools Framework
 *
 * This module provides the infrastructure for vendor-dependent tools.
 * Tools are thin wrappers around Connector.fetch() for specific operations.
 *
 * Usage:
 * ```typescript
 * import { ConnectorTools, Services } from '@oneringai/agents';
 *
 * // Get generic API tool for any connector
 * const apiTool = ConnectorTools.genericAPI('my-connector');
 *
 * // Get all tools (generic + service-specific if registered)
 * const tools = ConnectorTools.for('slack');
 *
 * // Register custom service tools
 * ConnectorTools.registerService('my-service', (connector) => [
 *   createMyCustomTool(connector),
 * ]);
 * ```
 */

export {
  ConnectorTools,
  type ServiceToolFactory,
  type GenericAPIToolOptions,
  type GenericAPICallArgs,
  type GenericAPICallResult,
} from './ConnectorTools.js';
