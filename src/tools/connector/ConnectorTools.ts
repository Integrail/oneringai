/**
 * ConnectorTools - Generate tools from Connectors
 *
 * This is the main API for vendor-dependent tools.
 * Tools are thin wrappers around Connector.fetch() for specific operations.
 */

import { Connector } from '../../core/Connector.js';
import { ToolFunction, ToolPermissionConfig } from '../../domain/entities/Tool.js';
import { detectServiceFromURL } from '../../domain/entities/Services.js';

/**
 * Factory function type for creating service-specific tools
 * Takes a Connector and returns an array of tools that use it
 */
export type ServiceToolFactory = (connector: Connector, userId?: string) => ToolFunction[];

/**
 * Options for generating the generic API tool
 */
export interface GenericAPIToolOptions {
  /** Override the tool name (default: `${connectorName}_api`) */
  toolName?: string;
  /** Override the description */
  description?: string;
  /** User ID for multi-user OAuth */
  userId?: string;
  /** Permission config for the tool */
  permission?: ToolPermissionConfig;
}

/**
 * Arguments for the generic API call tool
 */
export interface GenericAPICallArgs {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  body?: Record<string, unknown>;
  queryParams?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
}

/**
 * Result from the generic API call tool
 */
export interface GenericAPICallResult {
  success: boolean;
  status?: number;
  data?: unknown;
  error?: string;
}

/**
 * ConnectorTools - Main API for vendor-dependent tools
 *
 * Usage:
 * ```typescript
 * // Get all tools for a connector
 * const tools = ConnectorTools.for('slack');
 *
 * // Get just the generic API tool
 * const apiTool = ConnectorTools.genericAPI('github');
 *
 * // Discover all available connector tools
 * const allTools = ConnectorTools.discoverAll();
 * ```
 */
export class ConnectorTools {
  /** Registry of service-specific tool factories */
  private static factories = new Map<string, ServiceToolFactory>();

  /**
   * Register a tool factory for a service type
   *
   * @param serviceType - Service identifier (e.g., 'slack', 'github')
   * @param factory - Function that creates tools from a Connector
   *
   * @example
   * ```typescript
   * ConnectorTools.registerService('slack', (connector) => [
   *   createSlackSendMessageTool(connector),
   *   createSlackListChannelsTool(connector),
   * ]);
   * ```
   */
  static registerService(serviceType: string, factory: ServiceToolFactory): void {
    this.factories.set(serviceType, factory);
  }

  /**
   * Unregister a service tool factory
   */
  static unregisterService(serviceType: string): boolean {
    return this.factories.delete(serviceType);
  }

  /**
   * Get ALL tools for a connector (generic API + service-specific)
   * This is the main entry point
   *
   * @param connectorOrName - Connector instance or name
   * @param userId - Optional user ID for multi-user OAuth
   * @returns Array of tools
   *
   * @example
   * ```typescript
   * const tools = ConnectorTools.for('slack');
   * // Returns: [slack_api, slack_send_message, slack_list_channels, ...]
   * ```
   */
  static for(connectorOrName: Connector | string, userId?: string): ToolFunction[] {
    const connector = this.resolveConnector(connectorOrName);
    const tools: ToolFunction[] = [];

    // 1. Always include generic API tool if baseURL exists
    if (connector.baseURL) {
      tools.push(this.createGenericAPITool(connector, { userId }));
    }

    // 2. Add service-specific tools if factory exists
    const serviceType = this.detectService(connector);
    if (serviceType && this.factories.has(serviceType)) {
      const factory = this.factories.get(serviceType)!;
      tools.push(...factory(connector, userId));
    }

    return tools;
  }

  /**
   * Get just the generic API tool for a connector
   *
   * @param connectorOrName - Connector instance or name
   * @param options - Optional configuration
   * @returns Generic API tool
   *
   * @example
   * ```typescript
   * const apiTool = ConnectorTools.genericAPI('github');
   * ```
   */
  static genericAPI(
    connectorOrName: Connector | string,
    options?: GenericAPIToolOptions
  ): ToolFunction<GenericAPICallArgs, GenericAPICallResult> {
    const connector = this.resolveConnector(connectorOrName);
    return this.createGenericAPITool(connector, options);
  }

  /**
   * Get only service-specific tools (no generic API tool)
   *
   * @param connectorOrName - Connector instance or name
   * @param userId - Optional user ID for multi-user OAuth
   * @returns Service-specific tools only
   */
  static serviceTools(connectorOrName: Connector | string, userId?: string): ToolFunction[] {
    const connector = this.resolveConnector(connectorOrName);
    const serviceType = this.detectService(connector);

    if (!serviceType || !this.factories.has(serviceType)) {
      return [];
    }

    return this.factories.get(serviceType)!(connector, userId);
  }

  /**
   * Discover tools for ALL registered connectors with external services
   * Skips AI provider connectors (those with vendor but no serviceType)
   *
   * @param userId - Optional user ID for multi-user OAuth
   * @returns Map of connector name to tools
   *
   * @example
   * ```typescript
   * const allTools = ConnectorTools.discoverAll();
   * for (const [name, tools] of allTools) {
   *   agent.tools.registerMany(tools, { namespace: name });
   * }
   * ```
   */
  static discoverAll(userId?: string): Map<string, ToolFunction[]> {
    const result = new Map<string, ToolFunction[]>();

    for (const connector of Connector.listAll()) {
      // Include connectors that:
      // 1. Have explicit serviceType, OR
      // 2. Have baseURL but no vendor (external API, not AI provider)
      const hasServiceType = !!connector.config.serviceType;
      const isExternalAPI = connector.baseURL && !connector.vendor;

      if (hasServiceType || isExternalAPI) {
        const tools = this.for(connector, userId);
        if (tools.length > 0) {
          result.set(connector.name, tools);
        }
      }
    }

    return result;
  }

  /**
   * Find a connector by service type
   * Returns the first connector matching the service type
   *
   * @param serviceType - Service identifier
   * @returns Connector or undefined
   */
  static findConnector(serviceType: string): Connector | undefined {
    return Connector.listAll().find((c) => this.detectService(c) === serviceType);
  }

  /**
   * Find all connectors for a service type
   * Useful when you have multiple connectors for the same service
   *
   * @param serviceType - Service identifier
   * @returns Array of matching connectors
   */
  static findConnectors(serviceType: string): Connector[] {
    return Connector.listAll().filter((c) => this.detectService(c) === serviceType);
  }

  /**
   * List services that have registered tool factories
   */
  static listSupportedServices(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Check if a service has dedicated tool factory
   */
  static hasServiceTools(serviceType: string): boolean {
    return this.factories.has(serviceType);
  }

  /**
   * Detect the service type for a connector
   * Uses explicit serviceType if set, otherwise infers from baseURL
   */
  static detectService(connector: Connector): string | undefined {
    // 1. Explicit serviceType takes precedence
    if (connector.config.serviceType) {
      return connector.config.serviceType;
    }

    // 2. Infer from baseURL patterns
    if (connector.baseURL) {
      return detectServiceFromURL(connector.baseURL);
    }

    return undefined;
  }

  // ============ Private Methods ============

  private static resolveConnector(connectorOrName: Connector | string): Connector {
    return typeof connectorOrName === 'string' ? Connector.get(connectorOrName) : connectorOrName;
  }

  private static createGenericAPITool(
    connector: Connector,
    options?: GenericAPIToolOptions
  ): ToolFunction<GenericAPICallArgs, GenericAPICallResult> {
    const toolName = options?.toolName ?? `${connector.name}_api`;
    const userId = options?.userId;

    const description =
      options?.description ??
      `Make an authenticated API call to ${connector.displayName}.` +
        (connector.baseURL ? ` Base URL: ${connector.baseURL}` : ' Provide full URL in endpoint.');

    return {
      definition: {
        type: 'function',
        function: {
          name: toolName,
          description,
          parameters: {
            type: 'object',
            properties: {
              method: {
                type: 'string',
                enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                description: 'HTTP method',
              },
              endpoint: {
                type: 'string',
                description: 'API endpoint (relative to base URL) or full URL',
              },
              body: {
                type: 'object',
                description: 'Request body (for POST/PUT/PATCH)',
              },
              queryParams: {
                type: 'object',
                description: 'URL query parameters',
              },
              headers: {
                type: 'object',
                description: 'Additional request headers',
              },
            },
            required: ['method', 'endpoint'],
          },
        },
      },

      execute: async (args: GenericAPICallArgs): Promise<GenericAPICallResult> => {
        let url = args.endpoint;

        // Add query params if provided
        if (args.queryParams && Object.keys(args.queryParams).length > 0) {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(args.queryParams)) {
            params.append(key, String(value));
          }
          url += (url.includes('?') ? '&' : '?') + params.toString();
        }

        try {
          const response = await connector.fetch(
            url,
            {
              method: args.method,
              headers: {
                'Content-Type': 'application/json',
                ...args.headers,
              },
              body: args.body ? JSON.stringify(args.body) : undefined,
            },
            userId
          );

          // Try to parse as JSON
          const text = await response.text();
          let data: unknown;

          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }

          return {
            success: response.ok,
            status: response.status,
            data: response.ok ? data : undefined,
            error: response.ok ? undefined : typeof data === 'string' ? data : JSON.stringify(data),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },

      describeCall: (args: GenericAPICallArgs) => `${args.method} ${args.endpoint}`,

      permission: options?.permission ?? {
        scope: 'session',
        riskLevel: 'medium',
        approvalMessage: `This will make an API call to ${connector.displayName}`,
      },
    };
  }
}
