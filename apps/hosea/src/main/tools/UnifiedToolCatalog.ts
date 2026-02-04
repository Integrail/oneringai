/**
 * UnifiedToolCatalog
 *
 * A wrapper over @oneringai/agents ToolRegistry with pluggable architecture
 * for combining tools from multiple sources (oneringai, hosea, custom).
 */

import type { ToolFunction, ToolCategory } from '@oneringai/agents';

/**
 * Extended category type for Hosea (adds 'browser')
 */
export type HoseaToolCategory = ToolCategory | 'browser';

/**
 * Context provided when creating tool instances at runtime
 */
export interface ToolCreationContext {
  /** Agent instance ID */
  instanceId: string;
  /** Any additional context needed by the tool factory */
  [key: string]: unknown;
}

/**
 * Extended entry with Hosea category and source tracking
 */
export interface UnifiedToolEntry {
  /** Tool name (matches definition.function.name) */
  name: string;
  /** Export variable name */
  exportName: string;
  /** Human-readable display name */
  displayName: string;
  /** Category for grouping */
  category: HoseaToolCategory;
  /** Human-readable category name */
  categoryDisplayName: string;
  /** Brief description */
  description: string;
  /** Whether this tool is safe without explicit approval */
  safeByDefault: boolean;
  /** Whether this tool requires a connector */
  requiresConnector?: boolean;
  /** Supported connector service types (if requiresConnector) */
  connectorServiceTypes?: string[];
  /** Source of the tool */
  source: 'oneringai' | 'hosea' | 'custom';
  /** Factory for runtime tool creation (for Hosea tools that need context) */
  createTool?: (ctx: ToolCreationContext) => ToolFunction;
  /** Direct tool reference (for oneringai tools or static hosea tools) */
  tool?: ToolFunction;
}

/**
 * Interface for tool providers that contribute tools to the catalog
 */
export interface IToolProvider {
  /** Unique provider name */
  readonly name: string;
  /** Source identifier */
  readonly source: 'oneringai' | 'hosea' | 'custom';
  /** Get all tools from this provider */
  getTools(): UnifiedToolEntry[];
  /** Get a specific tool by name */
  getToolByName(name: string): UnifiedToolEntry | undefined;
}

/**
 * Category metadata for UI display
 */
export interface CategoryInfo {
  /** Category ID */
  id: HoseaToolCategory;
  /** Human-readable display name */
  displayName: string;
  /** Number of tools in this category */
  count: number;
}

/**
 * Mapping of category IDs to display names
 */
export const CATEGORY_DISPLAY_NAMES: Record<HoseaToolCategory, string> = {
  filesystem: 'Filesystem',
  shell: 'Shell',
  web: 'Web',
  code: 'Code Execution',
  json: 'JSON',
  connector: 'Connectors',
  other: 'Other',
  browser: 'Browser Automation',
};

/**
 * UnifiedToolCatalog - Central registry for all tools from multiple sources
 */
export class UnifiedToolCatalog {
  private providers: Map<string, IToolProvider> = new Map();
  private toolCache: Map<string, UnifiedToolEntry> = new Map();
  private cacheValid = false;

  /**
   * Register a tool provider
   */
  registerProvider(provider: IToolProvider): void {
    if (this.providers.has(provider.name)) {
      console.warn(`Tool provider '${provider.name}' is already registered, replacing...`);
    }
    this.providers.set(provider.name, provider);
    this.invalidateCache();
  }

  /**
   * Unregister a tool provider
   */
  unregisterProvider(name: string): void {
    if (this.providers.delete(name)) {
      this.invalidateCache();
    }
  }

  /**
   * Get all tools from all providers
   */
  getAllTools(): UnifiedToolEntry[] {
    this.ensureCache();
    return Array.from(this.toolCache.values());
  }

  /**
   * Get a tool by name
   */
  getToolByName(name: string): UnifiedToolEntry | undefined {
    this.ensureCache();
    return this.toolCache.get(name);
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: HoseaToolCategory): UnifiedToolEntry[] {
    this.ensureCache();
    return Array.from(this.toolCache.values()).filter(
      (entry) => entry.category === category
    );
  }

  /**
   * Get all unique categories with metadata
   */
  getCategories(): CategoryInfo[] {
    this.ensureCache();
    const categoryCounts = new Map<HoseaToolCategory, number>();

    for (const entry of this.toolCache.values()) {
      const count = categoryCounts.get(entry.category) || 0;
      categoryCounts.set(entry.category, count + 1);
    }

    return Array.from(categoryCounts.entries()).map(([id, count]) => ({
      id,
      displayName: CATEGORY_DISPLAY_NAMES[id] || id,
      count,
    }));
  }

  /**
   * Get tools that require connector configuration
   */
  getToolsRequiringConnector(): UnifiedToolEntry[] {
    this.ensureCache();
    return Array.from(this.toolCache.values()).filter(
      (entry) => entry.requiresConnector
    );
  }

  /**
   * Resolve a tool for agent creation
   * Returns the ToolFunction, creating it if necessary using the factory
   */
  resolveToolForAgent(
    name: string,
    context: ToolCreationContext
  ): ToolFunction | null {
    const entry = this.getToolByName(name);
    if (!entry) {
      return null;
    }

    // If there's a factory, use it to create the tool
    if (entry.createTool) {
      return entry.createTool(context);
    }

    // Otherwise return the static tool reference
    return entry.tool || null;
  }

  /**
   * Resolve multiple tools for agent creation
   */
  resolveToolsForAgent(
    names: string[],
    context: ToolCreationContext
  ): ToolFunction[] {
    const tools: ToolFunction[] = [];
    for (const name of names) {
      const tool = this.resolveToolForAgent(name, context);
      if (tool) {
        tools.push(tool);
      }
    }
    return tools;
  }

  /**
   * Check if a provider is registered
   */
  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Get list of registered provider names
   */
  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Invalidate the cache (called when providers change)
   */
  private invalidateCache(): void {
    this.cacheValid = false;
    this.toolCache.clear();
  }

  /**
   * Rebuild the cache from all providers
   */
  private ensureCache(): void {
    if (this.cacheValid) {
      return;
    }

    this.toolCache.clear();

    for (const provider of this.providers.values()) {
      const tools = provider.getTools();
      for (const tool of tools) {
        if (this.toolCache.has(tool.name)) {
          console.warn(
            `Duplicate tool name '${tool.name}' from provider '${provider.name}', ` +
              `overwriting previous entry`
          );
        }
        this.toolCache.set(tool.name, tool);
      }
    }

    this.cacheValid = true;
  }
}

/**
 * Singleton instance for global access
 */
let catalogInstance: UnifiedToolCatalog | null = null;

/**
 * Get the global UnifiedToolCatalog instance
 */
export function getUnifiedToolCatalog(): UnifiedToolCatalog {
  if (!catalogInstance) {
    catalogInstance = new UnifiedToolCatalog();
  }
  return catalogInstance;
}

/**
 * Reset the global catalog (mainly for testing)
 */
export function resetUnifiedToolCatalog(): void {
  catalogInstance = null;
}
