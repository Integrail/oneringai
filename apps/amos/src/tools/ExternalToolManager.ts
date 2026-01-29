/**
 * ExternalToolManager - Manages external tools that require API connectors
 *
 * This manager handles tools that depend on external services:
 * - Search tools (web_search) - Serper, Brave, Tavily, RapidAPI
 * - Scrape tools (web_scrape) - ZenRows
 * - Fetch tools (web_fetch) - No connector needed (native)
 */

import { Connector } from '@oneringai/agents';
import type { ToolFunction } from '@oneringai/agents';
import type {
  ExternalToolsConfig,
  ExternalProviderConfig,
  ExternalProviderType,
  ExternalToolInfo,
  SearchProvider,
  ScrapeProvider,
  IConnectorManager,
} from '../config/types.js';

// Re-export for convenience
export type { ExternalToolInfo };

export interface ConnectorRequirement {
  providerType: ExternalProviderType;
  serviceType: string;
  displayName: string;
  baseURL: string;
  envVarHint: string;
}

// Provider metadata for each external tool type
const SEARCH_PROVIDERS: Record<SearchProvider, ConnectorRequirement> = {
  serper: {
    providerType: 'search',
    serviceType: 'serper',
    displayName: 'Serper (Google Search)',
    baseURL: 'https://google.serper.dev',
    envVarHint: 'SERPER_API_KEY',
  },
  brave: {
    providerType: 'search',
    serviceType: 'brave-search',
    displayName: 'Brave Search',
    baseURL: 'https://api.search.brave.com/res/v1',
    envVarHint: 'BRAVE_API_KEY',
  },
  tavily: {
    providerType: 'search',
    serviceType: 'tavily',
    displayName: 'Tavily (AI-Optimized)',
    baseURL: 'https://api.tavily.com',
    envVarHint: 'TAVILY_API_KEY',
  },
  rapidapi: {
    providerType: 'search',
    serviceType: 'rapidapi-search',
    displayName: 'RapidAPI Real-Time Search',
    baseURL: 'https://real-time-web-search.p.rapidapi.com',
    envVarHint: 'RAPIDAPI_KEY',
  },
};

const SCRAPE_PROVIDERS: Record<ScrapeProvider, ConnectorRequirement> = {
  zenrows: {
    providerType: 'scrape',
    serviceType: 'zenrows',
    displayName: 'ZenRows (Anti-Bot)',
    baseURL: 'https://api.zenrows.com/v1',
    envVarHint: 'ZENROWS_API_KEY',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ExternalToolManager
// ─────────────────────────────────────────────────────────────────────────────

export class ExternalToolManager {
  private config: ExternalToolsConfig;
  private connectorManager: IConnectorManager;

  constructor(config: ExternalToolsConfig, connectorManager: IConnectorManager) {
    this.config = config;
    this.connectorManager = connectorManager;
  }

  /**
   * Update configuration
   */
  updateConfig(config: ExternalToolsConfig): void {
    this.config = config;
  }

  /**
   * Get current configuration
   */
  getConfig(): ExternalToolsConfig {
    return this.config;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Tool Info & Status
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get info about all external tools
   */
  getAllToolInfo(): ExternalToolInfo[] {
    return [
      this.getSearchToolInfo(),
      this.getScrapeToolInfo(),
      this.getFetchToolInfo(),
    ];
  }

  /**
   * Get info about search tool
   */
  getSearchToolInfo(): ExternalToolInfo {
    const providerConfig = this.config.search;
    const hasConnector = !!(providerConfig?.enabled && providerConfig.connectorName);
    const connectorName = providerConfig?.connectorName || null;

    return {
      name: 'web_search',
      displayName: 'Web Search',
      description: 'Search the web using Google, Brave, Tavily, or RapidAPI',
      providerType: 'search',
      requiresConnector: true,
      available: this.config.enabled && hasConnector,
      connectorName,
      supportedProviders: Object.keys(SEARCH_PROVIDERS),
    };
  }

  /**
   * Get info about scrape tool
   */
  getScrapeToolInfo(): ExternalToolInfo {
    const providerConfig = this.config.scrape;
    const hasConnector = !!(providerConfig?.enabled && providerConfig.connectorName);
    const connectorName = providerConfig?.connectorName || null;

    return {
      name: 'web_scrape',
      displayName: 'Web Scrape',
      description: 'Scrape web pages with anti-bot protection via ZenRows',
      providerType: 'scrape',
      requiresConnector: true,
      available: this.config.enabled && hasConnector,
      connectorName,
      supportedProviders: Object.keys(SCRAPE_PROVIDERS),
    };
  }

  /**
   * Get info about fetch tool (no connector needed)
   */
  getFetchToolInfo(): ExternalToolInfo {
    return {
      name: 'web_fetch',
      displayName: 'Web Fetch',
      description: 'Fetch web page content (free, no API key needed)',
      providerType: null,
      requiresConnector: false,
      available: this.config.enabled && this.config.webFetchEnabled,
      connectorName: null,
      supportedProviders: [],
    };
  }

  /**
   * Check if a provider type is configured
   */
  isProviderConfigured(type: ExternalProviderType): boolean {
    const config = type === 'search' ? this.config.search : this.config.scrape;
    return !!config?.enabled && !!config.connectorName;
  }

  /**
   * Get connector name for a provider type
   */
  getConnectorName(type: ExternalProviderType): string | null {
    const config = type === 'search' ? this.config.search : this.config.scrape;
    return config?.enabled ? config.connectorName : null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Provider Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get available providers for a type
   */
  getProvidersForType(type: ExternalProviderType): ConnectorRequirement[] {
    if (type === 'search') {
      return Object.values(SEARCH_PROVIDERS);
    } else {
      return Object.values(SCRAPE_PROVIDERS);
    }
  }

  /**
   * Get provider info by name
   */
  getProviderInfo(type: ExternalProviderType, providerName: string): ConnectorRequirement | null {
    if (type === 'search') {
      return SEARCH_PROVIDERS[providerName as SearchProvider] || null;
    } else {
      return SCRAPE_PROVIDERS[providerName as ScrapeProvider] || null;
    }
  }

  /**
   * Configure a provider
   */
  configureProvider(type: ExternalProviderType, connectorName: string): ExternalProviderConfig {
    return {
      connectorName,
      enabled: true,
    };
  }

  /**
   * Disable a provider
   */
  disableProvider(type: ExternalProviderType): ExternalProviderConfig | null {
    const current = type === 'search' ? this.config.search : this.config.scrape;
    if (!current) return null;
    return {
      ...current,
      enabled: false,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Connector Validation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if a connector exists and is valid for a provider type
   */
  validateConnector(connectorName: string, type: ExternalProviderType): { valid: boolean; error?: string } {
    // Check if connector exists
    const connector = this.connectorManager.get(connectorName);
    if (!connector) {
      return { valid: false, error: `Connector '${connectorName}' not found` };
    }

    // Check if connector is registered with the library
    if (!this.connectorManager.isRegistered(connectorName)) {
      return { valid: false, error: `Connector '${connectorName}' is not registered` };
    }

    // Check if it's registered in the global Connector registry
    if (!Connector.has(connectorName)) {
      return { valid: false, error: `Connector '${connectorName}' is not active` };
    }

    return { valid: true };
  }

  /**
   * Get connectors that are suitable for a provider type
   */
  getSuitableConnectors(type: ExternalProviderType): string[] {
    const providers = type === 'search' ? SEARCH_PROVIDERS : SCRAPE_PROVIDERS;
    const serviceTypes = Object.values(providers).map(p => p.serviceType);

    // Find connectors with matching service types
    const allConnectors = this.connectorManager.list();
    const suitable: string[] = [];

    for (const connector of allConnectors) {
      // Check if connector is registered and has a matching vendor/service type
      if (this.connectorManager.isRegistered(connector.name)) {
        // For now, just return connectors that are registered
        // In a more sophisticated implementation, we'd check serviceType
        suitable.push(connector.name);
      }
    }

    return suitable;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Tool Creation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a configured version of the web_search tool
   */
  createSearchTool(baseTool: ToolFunction): ToolFunction | null {
    if (!this.config.enabled) {
      return null;
    }
    if (!this.config.search?.enabled) {
      return null;
    }
    if (!this.config.search.connectorName) {
      return null;
    }

    const connectorName = this.config.search.connectorName;

    // Wrap the tool to inject the connector name
    return {
      ...baseTool,
      execute: async (args: any) => {
        return baseTool.execute({
          ...args,
          connectorName: args.connectorName || connectorName,
        });
      },
    };
  }

  /**
   * Create a configured version of the web_scrape tool
   */
  createScrapeTool(baseTool: ToolFunction): ToolFunction | null {
    if (!this.config.enabled) return null;
    if (!this.config.scrape?.enabled) return null;
    if (!this.config.scrape.connectorName) return null;

    const connectorName = this.config.scrape.connectorName;

    // Wrap the tool to inject the connector name
    return {
      ...baseTool,
      execute: async (args: any) => {
        return baseTool.execute({
          ...args,
          connectorName: args.connectorName || connectorName,
        });
      },
    };
  }

  /**
   * Get the web_fetch tool if enabled
   */
  getFetchTool(baseTool: ToolFunction): ToolFunction | null {
    if (!this.config.enabled) return null;
    if (!this.config.webFetchEnabled) return null;
    return baseTool;
  }
}

// Export provider metadata for external use
export { SEARCH_PROVIDERS, SCRAPE_PROVIDERS };
