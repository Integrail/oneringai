/**
 * ToolCatalogPluginNextGen - Dynamic Tool Loading/Unloading for Agents
 *
 * When agents need 100+ tools, sending all tool definitions to the LLM wastes
 * tokens and degrades performance. This plugin provides 3 metatools that let
 * agents discover and load only the tool categories they need.
 *
 * Categories come from ToolCatalogRegistry (static global) and ConnectorTools
 * (runtime discovery). The plugin manages loaded/unloaded state via ToolManager.
 *
 * @example
 * ```typescript
 * const ctx = AgentContextNextGen.create({
 *   model: 'gpt-4',
 *   features: { toolCatalog: true },
 *   toolCategories: ['filesystem', 'web'],  // optional scope
 * });
 * ```
 */

import { BasePluginNextGen } from '../BasePluginNextGen.js';
import type { ToolFunction } from '../../../domain/entities/Tool.js';
import type { AuthIdentity } from '../types.js';
import {
  ToolCatalogRegistry,
  type ToolCategoryScope,
  type ToolCategoryDefinition,
} from '../../ToolCatalogRegistry.js';
import type { ToolManager } from '../../ToolManager.js';
import { logger } from '../../../infrastructure/observability/Logger.js';

// ============================================================================
// Types
// ============================================================================

export interface ToolCatalogPluginConfig {
  /** Scope filter for which categories are visible */
  categoryScope?: ToolCategoryScope;
  /** Categories to pre-load on initialization */
  autoLoadCategories?: string[];
  /** Maximum loaded categories at once (default: 10) */
  maxLoadedCategories?: number;
  /** Auth identities for connector filtering */
  identities?: AuthIdentity[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_LOADED = 10;

const TOOL_CATALOG_INSTRUCTIONS = `## Tool Catalog

You have access to a dynamic tool catalog. Not all tools are loaded at once — use these metatools to discover and load what you need:

**tool_catalog_search** — Browse available tool categories and search for specific tools.
  - No params → list all available categories with descriptions
  - \`category\` → list tools in that category
  - \`query\` → keyword search across categories and tools

**tool_catalog_load** — Load a category's tools so you can use them.
  - Tools become available immediately after loading.
  - If you need tools from a category, load it first.

**tool_catalog_unload** — Unload a category to free token budget.
  - Unloaded tools are no longer sent to you.
  - Use when you're done with a category.

**Best practices:**
- Search first to find the right category before loading.
- Unload categories you no longer need to keep context lean.
- Categories marked [LOADED] are already available.`;

// ============================================================================
// Tool Definitions
// ============================================================================

const catalogSearchDefinition = {
  type: 'function' as const,
  function: {
    name: 'tool_catalog_search',
    description: 'Search the tool catalog. No params lists categories. Use category to list tools in it, or query to keyword-search.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Keyword to search across category names, descriptions, and tool names',
        },
        category: {
          type: 'string',
          description: 'Category name to list its tools',
        },
      },
    },
  },
};

const catalogLoadDefinition = {
  type: 'function' as const,
  function: {
    name: 'tool_catalog_load',
    description: 'Load all tools from a category so they become available for use.',
    parameters: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Category name to load',
        },
      },
      required: ['category'],
    },
  },
};

const catalogUnloadDefinition = {
  type: 'function' as const,
  function: {
    name: 'tool_catalog_unload',
    description: 'Unload a category to free token budget. Tools from this category will no longer be available.',
    parameters: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Category name to unload',
        },
      },
      required: ['category'],
    },
  },
};

// ============================================================================
// Plugin
// ============================================================================

export class ToolCatalogPluginNextGen extends BasePluginNextGen {
  readonly name = 'tool_catalog';

  /** category name → array of tool names that were loaded */
  private _loadedCategories = new Map<string, string[]>();

  /** Reference to the ToolManager for registering/disabling tools */
  private _toolManager: ToolManager | null = null;

  private _config: Required<Pick<ToolCatalogPluginConfig, 'maxLoadedCategories'>> & ToolCatalogPluginConfig;

  constructor(config?: ToolCatalogPluginConfig) {
    super();
    this._config = {
      maxLoadedCategories: DEFAULT_MAX_LOADED,
      ...config,
    };
  }

  // ========================================================================
  // Plugin Interface
  // ========================================================================

  getInstructions(): string {
    return TOOL_CATALOG_INSTRUCTIONS;
  }

  async getContent(): Promise<string | null> {
    const categories = this.getAllowedCategories();
    if (categories.length === 0) return null;

    const lines: string[] = ['## Tool Catalog'];
    lines.push('');

    const loaded = Array.from(this._loadedCategories.keys());
    if (loaded.length > 0) {
      lines.push(`**Loaded:** ${loaded.join(', ')}`);
    }

    lines.push(`**Available categories:** ${categories.length}`);

    // Brief summary of categories
    for (const cat of categories) {
      const tools = ToolCatalogRegistry.getToolsInCategory(cat.name);
      const marker = this._loadedCategories.has(cat.name) ? ' [LOADED]' : '';
      lines.push(`- **${cat.displayName}** (${tools.length} tools)${marker}: ${cat.description}`);
    }

    // Add connector categories
    const connectorCats = this.getConnectorCategories();
    for (const cc of connectorCats) {
      const marker = this._loadedCategories.has(cc.name) ? ' [LOADED]' : '';
      lines.push(`- **${cc.displayName}** (${cc.toolCount} tools)${marker}: ${cc.description}`);
    }

    const content = lines.join('\n');
    this.updateTokenCache(this.estimator.estimateTokens(content));
    return content;
  }

  getContents(): unknown {
    return {
      loadedCategories: Array.from(this._loadedCategories.entries()).map(([name, tools]) => ({
        category: name,
        toolCount: tools.length,
        tools,
      })),
    };
  }

  getTools(): ToolFunction[] {
    const plugin = this;

    const searchTool: ToolFunction = {
      definition: catalogSearchDefinition,
      execute: async (args: Record<string, unknown>) => {
        return plugin.executeSearch(args.query as string | undefined, args.category as string | undefined);
      },
    };

    const loadTool: ToolFunction = {
      definition: catalogLoadDefinition,
      execute: async (args: Record<string, unknown>) => {
        return plugin.executeLoad(args.category as string);
      },
    };

    const unloadTool: ToolFunction = {
      definition: catalogUnloadDefinition,
      execute: async (args: Record<string, unknown>) => {
        return plugin.executeUnload(args.category as string);
      },
    };

    return [searchTool, loadTool, unloadTool];
  }

  isCompactable(): boolean {
    return this._loadedCategories.size > 0;
  }

  async compact(targetTokensToFree: number): Promise<number> {
    if (!this._toolManager || this._loadedCategories.size === 0) return 0;

    // Sort loaded categories by least recently used (based on tool metadata)
    const categoriesByLastUsed = this.getCategoriesSortedByLastUsed();
    let freed = 0;

    for (const category of categoriesByLastUsed) {
      if (freed >= targetTokensToFree) break;

      const toolNames = this._loadedCategories.get(category);
      if (!toolNames) continue;

      // Estimate tokens that will be freed (tool definitions)
      const toolTokens = this.estimateToolDefinitionTokens(toolNames);
      this._toolManager.setEnabled(toolNames, false);
      this._loadedCategories.delete(category);
      freed += toolTokens;

      logger.debug({ category, toolCount: toolNames.length, freed: toolTokens },
        `[ToolCatalogPlugin] Compacted category '${category}'`);
    }

    this.invalidateTokenCache();
    return freed;
  }

  getState(): unknown {
    return {
      loadedCategories: Array.from(this._loadedCategories.keys()),
    };
  }

  restoreState(state: unknown): void {
    const s = state as { loadedCategories?: string[] };
    if (!s.loadedCategories?.length) return;

    // Re-load categories from state
    for (const category of s.loadedCategories) {
      try {
        this.executeLoad(category);
      } catch (err) {
        logger.warn({ category, error: err instanceof Error ? err.message : String(err) },
          `[ToolCatalogPlugin] Failed to restore category '${category}'`);
      }
    }
    this.invalidateTokenCache();
  }

  destroy(): void {
    this._loadedCategories.clear();
    this._toolManager = null;
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Set the ToolManager reference. Called by AgentContextNextGen after plugin registration.
   */
  setToolManager(tm: ToolManager): void {
    this._toolManager = tm;

    // Auto-load categories if configured
    if (this._config.autoLoadCategories?.length) {
      for (const category of this._config.autoLoadCategories) {
        try {
          this.executeLoad(category);
        } catch (err) {
          logger.warn({ category, error: err instanceof Error ? err.message : String(err) },
            `[ToolCatalogPlugin] Failed to auto-load category '${category}'`);
        }
      }
    }
  }

  /** Get list of currently loaded category names */
  get loadedCategories(): string[] {
    return Array.from(this._loadedCategories.keys());
  }

  // ========================================================================
  // Metatool Implementations
  // ========================================================================

  private executeSearch(query?: string, category?: string): Record<string, unknown> {
    // List tools in a specific category
    if (category) {
      // Check if it's a connector category
      if (category.startsWith('connector:')) {
        return this.searchConnectorCategory(category);
      }

      if (!ToolCatalogRegistry.hasCategory(category)) {
        return { error: `Category '${category}' not found. Use tool_catalog_search with no params to see available categories.` };
      }

      if (!ToolCatalogRegistry.isCategoryAllowed(category, this._config.categoryScope)) {
        return { error: `Category '${category}' is not available for this agent.` };
      }

      const tools = ToolCatalogRegistry.getToolsInCategory(category);
      const loaded = this._loadedCategories.has(category);
      return {
        category,
        loaded,
        tools: tools.map(t => ({
          name: t.name,
          displayName: t.displayName,
          description: t.description,
          safeByDefault: t.safeByDefault,
        })),
      };
    }

    // Keyword search
    if (query) {
      return this.keywordSearch(query);
    }

    // No params — list all available categories
    const categories = this.getAllowedCategories();
    const connectorCats = this.getConnectorCategories();
    const result: Array<{
      name: string;
      displayName: string;
      description: string;
      toolCount: number;
      loaded: boolean;
    }> = [];

    for (const cat of categories) {
      const tools = ToolCatalogRegistry.getToolsInCategory(cat.name);
      result.push({
        name: cat.name,
        displayName: cat.displayName,
        description: cat.description,
        toolCount: tools.length,
        loaded: this._loadedCategories.has(cat.name),
      });
    }

    for (const cc of connectorCats) {
      result.push({
        name: cc.name,
        displayName: cc.displayName,
        description: cc.description,
        toolCount: cc.toolCount,
        loaded: this._loadedCategories.has(cc.name),
      });
    }

    return { categories: result };
  }

  executeLoad(category: string): Record<string, unknown> {
    if (!this._toolManager) {
      return { error: 'ToolManager not connected. Plugin not properly initialized.' };
    }

    // Check scope
    const isConnector = category.startsWith('connector:');
    if (!isConnector && !ToolCatalogRegistry.isCategoryAllowed(category, this._config.categoryScope)) {
      return { error: `Category '${category}' is not available for this agent.` };
    }

    // Already loaded — idempotent
    if (this._loadedCategories.has(category)) {
      const toolNames = this._loadedCategories.get(category)!;
      return { loaded: toolNames.length, tools: toolNames, alreadyLoaded: true };
    }

    // Check max loaded limit
    if (this._loadedCategories.size >= this._config.maxLoadedCategories) {
      return {
        error: `Maximum loaded categories (${this._config.maxLoadedCategories}) reached. Unload a category first.`,
        loaded: Array.from(this._loadedCategories.keys()),
      };
    }

    // Resolve tools
    let tools: Array<{ tool: ToolFunction; name: string }>;

    if (isConnector) {
      tools = this.resolveConnectorTools(category);
    } else {
      const entries = ToolCatalogRegistry.getToolsInCategory(category);
      if (entries.length === 0) {
        return { error: `Category '${category}' has no tools or does not exist.` };
      }
      tools = entries.map(e => ({ tool: e.tool, name: e.name }));
    }

    if (tools.length === 0) {
      return { error: `No tools found for category '${category}'.` };
    }

    // Register with ToolManager
    const toolNames: string[] = [];
    for (const { tool, name } of tools) {
      const existing = this._toolManager.getRegistration(name);
      if (existing) {
        // Already registered (maybe from a previous load) — just enable
        this._toolManager.setEnabled([name], true);
      } else {
        this._toolManager.register(tool, { category, source: `catalog:${category}` });
      }
      toolNames.push(name);
    }

    this._loadedCategories.set(category, toolNames);
    this.invalidateTokenCache();

    logger.debug({ category, toolCount: toolNames.length, tools: toolNames },
      `[ToolCatalogPlugin] Loaded category '${category}'`);

    return { loaded: toolNames.length, tools: toolNames };
  }

  private executeUnload(category: string): Record<string, unknown> {
    if (!this._toolManager) {
      return { error: 'ToolManager not connected.' };
    }

    const toolNames = this._loadedCategories.get(category);
    if (!toolNames) {
      return { unloaded: 0, message: `Category '${category}' is not loaded.` };
    }

    // Disable tools (don't unregister — cheaper to re-enable later)
    this._toolManager.setEnabled(toolNames, false);
    this._loadedCategories.delete(category);
    this.invalidateTokenCache();

    logger.debug({ category, toolCount: toolNames.length },
      `[ToolCatalogPlugin] Unloaded category '${category}'`);

    return { unloaded: toolNames.length };
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private getAllowedCategories(): ToolCategoryDefinition[] {
    return ToolCatalogRegistry.filterCategories(this._config.categoryScope);
  }

  private keywordSearch(query: string): Record<string, unknown> {
    const lq = query.toLowerCase();
    const results: Array<{
      category: string;
      categoryDisplayName: string;
      tools: Array<{ name: string; displayName: string; description: string }>;
    }> = [];

    // Search registered categories
    for (const cat of this.getAllowedCategories()) {
      const catMatch = cat.name.toLowerCase().includes(lq) ||
        cat.displayName.toLowerCase().includes(lq) ||
        cat.description.toLowerCase().includes(lq);

      const tools = ToolCatalogRegistry.getToolsInCategory(cat.name);
      const matchingTools = tools.filter(t =>
        t.name.toLowerCase().includes(lq) ||
        t.displayName.toLowerCase().includes(lq) ||
        t.description.toLowerCase().includes(lq),
      );

      if (catMatch || matchingTools.length > 0) {
        results.push({
          category: cat.name,
          categoryDisplayName: cat.displayName,
          tools: (catMatch ? tools : matchingTools).map(t => ({
            name: t.name,
            displayName: t.displayName,
            description: t.description,
          })),
        });
      }
    }

    // Search connector categories
    for (const cc of this.getConnectorCategories()) {
      if (cc.name.toLowerCase().includes(lq) ||
        cc.displayName.toLowerCase().includes(lq) ||
        cc.description.toLowerCase().includes(lq)) {
        results.push({
          category: cc.name,
          categoryDisplayName: cc.displayName,
          tools: cc.tools.map(t => ({
            name: t.definition.function.name,
            displayName: t.definition.function.name.replace(/_/g, ' '),
            description: t.definition.function.description || '',
          })),
        });
      }
    }

    return { query, results, totalMatches: results.length };
  }

  private searchConnectorCategory(category: string): Record<string, unknown> {
    const connectorName = category.replace('connector:', '');
    const tools = this.resolveConnectorTools(category);
    const loaded = this._loadedCategories.has(category);

    return {
      category,
      loaded,
      connectorName,
      tools: tools.map(t => ({
        name: t.name,
        description: t.tool.definition.function.description || '',
      })),
    };
  }

  private getConnectorCategories(): Array<{
    name: string;
    displayName: string;
    description: string;
    toolCount: number;
    tools: ToolFunction[];
  }> {
    try {
      const { ConnectorTools } = require('../../../tools/connector/ConnectorTools.js');
      const discovered: Map<string, ToolFunction[]> = ConnectorTools.discoverAll();
      const results: Array<{
        name: string;
        displayName: string;
        description: string;
        toolCount: number;
        tools: ToolFunction[];
      }> = [];

      for (const [connectorName, tools] of discovered) {
        const catName = `connector:${connectorName}`;

        // Check scope
        if (!ToolCatalogRegistry.isCategoryAllowed(catName, this._config.categoryScope)) {
          continue;
        }

        // Check identities filter
        if (this._config.identities?.length) {
          const hasIdentity = this._config.identities.some(id => id.connector === connectorName);
          if (!hasIdentity) continue;
        }

        // Check if there's a pre-registered category with better metadata
        const preRegistered = ToolCatalogRegistry.getCategory(catName);
        results.push({
          name: catName,
          displayName: preRegistered?.displayName ?? connectorName.charAt(0).toUpperCase() + connectorName.slice(1),
          description: preRegistered?.description ?? `API tools for ${connectorName}`,
          toolCount: tools.length,
          tools,
        });
      }

      return results;
    } catch {
      return [];
    }
  }

  private resolveConnectorTools(category: string): Array<{ tool: ToolFunction; name: string }> {
    const connectorName = category.replace('connector:', '');
    try {
      const { ConnectorTools } = require('../../../tools/connector/ConnectorTools.js');
      const tools: ToolFunction[] = ConnectorTools.for(connectorName);
      return tools.map(t => ({ tool: t, name: t.definition.function.name }));
    } catch {
      return [];
    }
  }

  private getCategoriesSortedByLastUsed(): string[] {
    if (!this._toolManager) return Array.from(this._loadedCategories.keys());

    const categoryLastUsed: Array<{ category: string; lastUsed: number }> = [];

    for (const [category, toolNames] of this._loadedCategories) {
      let maxLastUsed = 0;
      for (const name of toolNames) {
        const reg = this._toolManager.getRegistration(name);
        if (reg?.metadata?.lastUsed) {
          const ts = reg.metadata.lastUsed instanceof Date
            ? reg.metadata.lastUsed.getTime()
            : 0;
          if (ts > maxLastUsed) maxLastUsed = ts;
        }
      }
      categoryLastUsed.push({ category, lastUsed: maxLastUsed });
    }

    // Sort ascending — least recently used first
    categoryLastUsed.sort((a, b) => a.lastUsed - b.lastUsed);
    return categoryLastUsed.map(c => c.category);
  }

  private estimateToolDefinitionTokens(toolNames: string[]): number {
    let total = 0;
    for (const name of toolNames) {
      const reg = this._toolManager?.getRegistration(name);
      if (reg) {
        // Rough estimate: tool definition JSON stringified
        const defStr = JSON.stringify(reg.tool.definition);
        total += this.estimator.estimateTokens(defStr);
      }
    }
    return total;
  }
}
