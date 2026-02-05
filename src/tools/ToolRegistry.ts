/**
 * ToolRegistry - Unified registry for all tools (built-in + connector-generated)
 *
 * This class provides a single API for discovering all available tools:
 * - Built-in tools from registry.generated.ts (filesystem, shell, web, etc.)
 * - Connector tools generated at runtime by ConnectorTools
 *
 * @example
 * ```typescript
 * import { ToolRegistry } from '@everworker/oneringai';
 *
 * // Get all tools (built-in + connector)
 * const allTools = ToolRegistry.getAllTools();
 *
 * // Get only connector tools
 * const connectorTools = ToolRegistry.getAllConnectorTools();
 *
 * // Get tools for a specific connector
 * const githubTools = ToolRegistry.getConnectorTools('github');
 * ```
 */

import type { ToolFunction } from '../domain/entities/Tool.js';
import { toolRegistry, type ToolRegistryEntry, type ToolCategory } from './registry.generated.js';
import { ConnectorTools } from './connector/ConnectorTools.js';
import { Connector } from '../core/Connector.js';
import { getServiceInfo } from '../domain/entities/Services.js';

/**
 * Extended registry entry for connector-generated tools
 */
export interface ConnectorToolEntry extends ToolRegistryEntry {
  /** Name of the connector that generated this tool */
  connectorName: string;
  /** Service type (e.g., 'github', 'slack') if detected */
  serviceType?: string;
}

/**
 * Unified tool registry that combines built-in and connector tools
 */
export class ToolRegistry {
  /**
   * Get built-in tools only (from registry.generated.ts)
   *
   * @returns Array of built-in tool registry entries
   */
  static getBuiltInTools(): ToolRegistryEntry[] {
    return [...toolRegistry];
  }

  /**
   * Get tools for a specific connector
   *
   * @param connectorName - Name of the connector to get tools for
   * @returns Array of connector tool entries
   *
   * @example
   * ```typescript
   * const githubTools = ToolRegistry.getConnectorTools('github');
   * ```
   */
  static getConnectorTools(connectorName: string): ConnectorToolEntry[] {
    try {
      const tools = ConnectorTools.for(connectorName);
      return tools.map((tool) => this.toRegistryEntry(tool, connectorName));
    } catch {
      // Connector may not exist or may not have tools
      return [];
    }
  }

  /**
   * Get all connector tools from all registered service connectors
   *
   * This discovers tools from all connectors that have:
   * - Explicit serviceType, OR
   * - baseURL but no vendor (external API, not AI provider)
   *
   * @returns Array of all connector tool entries
   */
  static getAllConnectorTools(): ConnectorToolEntry[] {
    const allTools: ConnectorToolEntry[] = [];
    const discovered = ConnectorTools.discoverAll();

    for (const [connectorName, tools] of discovered) {
      for (const tool of tools) {
        allTools.push(this.toRegistryEntry(tool, connectorName));
      }
    }
    return allTools;
  }

  /**
   * Get ALL tools (built-in + connector) - main API for UIs
   *
   * This is the primary method for getting a complete list of available tools.
   *
   * @returns Array of all tool registry entries (built-in and connector)
   *
   * @example
   * ```typescript
   * const allTools = ToolRegistry.getAllTools();
   * for (const tool of allTools) {
   *   console.log(`${tool.displayName}: ${tool.description}`);
   * }
   * ```
   */
  static getAllTools(): (ToolRegistryEntry | ConnectorToolEntry)[] {
    return [...this.getBuiltInTools(), ...this.getAllConnectorTools()];
  }

  /**
   * Get tools filtered by service type
   *
   * @param serviceType - Service type to filter by (e.g., 'github', 'slack')
   * @returns Array of connector tool entries for the service
   */
  static getToolsByService(serviceType: string): ConnectorToolEntry[] {
    return this.getAllConnectorTools().filter((entry) => entry.serviceType === serviceType);
  }

  /**
   * Get tools filtered by connector name
   *
   * @param connectorName - Connector name to filter by
   * @returns Array of connector tool entries for the connector
   */
  static getToolsByConnector(connectorName: string): ConnectorToolEntry[] {
    return this.getAllConnectorTools().filter((entry) => entry.connectorName === connectorName);
  }

  /**
   * Check if a tool entry is a connector tool
   *
   * @param entry - Tool registry entry to check
   * @returns True if the entry is a connector tool
   */
  static isConnectorTool(entry: ToolRegistryEntry | ConnectorToolEntry): entry is ConnectorToolEntry {
    return 'connectorName' in entry && typeof entry.connectorName === 'string';
  }

  /**
   * Convert a ToolFunction to a ConnectorToolEntry
   */
  private static toRegistryEntry(tool: ToolFunction, connectorName: string): ConnectorToolEntry {
    let serviceType: string | undefined;

    try {
      const connector = Connector.get(connectorName);
      serviceType = ConnectorTools.detectService(connector);
    } catch {
      // Connector may not exist
    }

    const serviceInfo = serviceType ? getServiceInfo(serviceType) : undefined;
    const def = tool.definition.function;

    return {
      name: def.name,
      exportName: def.name,
      displayName: this.deriveDisplayName(def.name, serviceInfo?.name),
      category: 'connector' as ToolCategory,
      description: def.description || `API tool for ${connectorName}`,
      tool,
      safeByDefault: false,
      requiresConnector: true,
      connectorServiceTypes: serviceType ? [serviceType] : undefined,
      connectorName,
      serviceType,
    };
  }

  /**
   * Derive a human-readable display name from a tool name
   */
  private static deriveDisplayName(toolName: string, serviceName?: string): string {
    // If we have service name, use it for the prefix
    if (serviceName) {
      // "github_api" -> "GitHub API"
      const suffix = toolName.includes('_api') ? ' API' : '';
      return `${serviceName}${suffix}`;
    }

    // Convert snake_case to Title Case
    // "github_api" -> "Github Api", "slack_send_message" -> "Slack Send Message"
    const withoutSuffix = toolName.replace(/_api$/, ' API');
    return withoutSuffix
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
