/**
 * ToolCatalogRegistry - Static Global Registry for Tool Categories
 *
 * The single source of truth for all tool categories and their tools.
 * Library users register their own categories and tools at app startup.
 *
 * Built-in tools are auto-registered from registry.generated.ts on first access.
 *
 * @example
 * ```typescript
 * // Register custom category
 * ToolCatalogRegistry.registerCategory({
 *   name: 'knowledge',
 *   displayName: 'Knowledge Graph',
 *   description: 'Search entities, get facts, manage references',
 * });
 *
 * // Register tools in category
 * ToolCatalogRegistry.registerTools('knowledge', [
 *   { name: 'entity_search', displayName: 'Entity Search', description: 'Search people/orgs', tool: entitySearch, safeByDefault: true },
 * ]);
 *
 * // Query
 * const categories = ToolCatalogRegistry.getCategories();
 * const tools = ToolCatalogRegistry.getToolsInCategory('knowledge');
 * const found = ToolCatalogRegistry.findTool('entity_search');
 * ```
 */

import type { ToolFunction } from '../domain/entities/Tool.js';
import { logger } from '../infrastructure/observability/Logger.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Definition of a tool category in the catalog.
 */
export interface ToolCategoryDefinition {
  /** Unique category name (e.g., 'filesystem', 'knowledge', 'connector:github') */
  name: string;
  /** Human-readable display name (e.g., 'File System') */
  displayName: string;
  /** Description shown in catalog metatool display */
  description: string;
}

/**
 * A single tool entry in the catalog.
 */
export interface CatalogToolEntry {
  /** The actual tool function */
  tool: ToolFunction;
  /** Tool name (matches definition.function.name) */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Brief description */
  description: string;
  /** Whether this tool is safe to execute without user approval */
  safeByDefault: boolean;
  /** Whether this tool requires a connector to function */
  requiresConnector?: boolean;
}

/**
 * Scope for filtering which categories are visible/allowed.
 *
 * - `string[]` — shorthand allowlist (only these categories)
 * - `{ include: string[] }` — explicit allowlist
 * - `{ exclude: string[] }` — blocklist (all except these)
 * - `undefined` — all categories allowed
 */
export type ToolCategoryScope =
  | string[]                  // shorthand allowlist
  | { include: string[] }     // explicit allowlist
  | { exclude: string[] };    // blocklist
  // undefined = all allowed

// ============================================================================
// ToolCatalogRegistry
// ============================================================================

/**
 * Static global registry for tool categories and their tools.
 *
 * Like Connector and StorageRegistry, this is a static class that acts
 * as a single source of truth. App code registers categories at startup,
 * and plugins/agents query them at runtime.
 */
export class ToolCatalogRegistry {
  /** Category definitions: name → definition */
  private static _categories = new Map<string, ToolCategoryDefinition>();

  /** Tools per category: category name → tool entries */
  private static _tools = new Map<string, CatalogToolEntry[]>();

  /** Whether built-in tools have been registered */
  private static _initialized = false;

  // --- Built-in category descriptions ---
  private static readonly BUILTIN_DESCRIPTIONS: Record<string, string> = {
    filesystem: 'Read, write, edit, search, and list files and directories',
    shell: 'Execute bash/shell commands',
    web: 'Fetch and process web content',
    code: 'Execute JavaScript code in sandboxed VM',
    json: 'Parse, query, and transform JSON data',
    desktop: 'Screenshot, mouse, keyboard, and window desktop automation',
    'custom-tools': 'Create, save, load, and test custom tool definitions',
    routines: 'Generate and manage agent routines',
    other: 'Miscellaneous tools',
  };

  // ========================================================================
  // Registration
  // ========================================================================

  /**
   * Register a tool category.
   * If the category already exists, updates its metadata.
   */
  static registerCategory(def: ToolCategoryDefinition): void {
    this._categories.set(def.name, def);
    if (!this._tools.has(def.name)) {
      this._tools.set(def.name, []);
    }
  }

  /**
   * Register multiple tools in a category.
   * The category is auto-created if it doesn't exist (with a generic description).
   */
  static registerTools(category: string, tools: CatalogToolEntry[]): void {
    if (!this._categories.has(category)) {
      this._categories.set(category, {
        name: category,
        displayName: category.charAt(0).toUpperCase() + category.slice(1),
        description: this.BUILTIN_DESCRIPTIONS[category] ?? `Tools in the ${category} category`,
      });
    }
    const existing = this._tools.get(category) ?? [];
    // Deduplicate: replace existing tools with same name
    const existingNames = new Set(existing.map(t => t.name));
    const newTools = tools.filter(t => !existingNames.has(t.name));
    const updated = existing.map(t => {
      const replacement = tools.find(nt => nt.name === t.name);
      return replacement ?? t;
    });
    this._tools.set(category, [...updated, ...newTools]);
  }

  /**
   * Register a single tool in a category.
   */
  static registerTool(category: string, tool: CatalogToolEntry): void {
    this.registerTools(category, [tool]);
  }

  /**
   * Unregister a category and all its tools.
   */
  static unregisterCategory(category: string): boolean {
    const hadCategory = this._categories.delete(category);
    this._tools.delete(category);
    return hadCategory;
  }

  /**
   * Unregister a single tool from a category.
   */
  static unregisterTool(category: string, toolName: string): boolean {
    const tools = this._tools.get(category);
    if (!tools) return false;
    const idx = tools.findIndex(t => t.name === toolName);
    if (idx === -1) return false;
    tools.splice(idx, 1);
    return true;
  }

  // ========================================================================
  // Query
  // ========================================================================

  /**
   * Get all registered categories.
   */
  static getCategories(): ToolCategoryDefinition[] {
    this.ensureInitialized();
    return Array.from(this._categories.values());
  }

  /**
   * Get a single category by name.
   */
  static getCategory(name: string): ToolCategoryDefinition | undefined {
    this.ensureInitialized();
    return this._categories.get(name);
  }

  /**
   * Check if a category exists.
   */
  static hasCategory(name: string): boolean {
    this.ensureInitialized();
    return this._categories.has(name);
  }

  /**
   * Get all tools in a category.
   */
  static getToolsInCategory(category: string): CatalogToolEntry[] {
    this.ensureInitialized();
    return this._tools.get(category) ?? [];
  }

  /**
   * Get all catalog tools across all categories.
   */
  static getAllCatalogTools(): CatalogToolEntry[] {
    this.ensureInitialized();
    const all: CatalogToolEntry[] = [];
    for (const tools of this._tools.values()) {
      all.push(...tools);
    }
    return all;
  }

  /**
   * Find a tool by name across all categories.
   */
  static findTool(name: string): { category: string; entry: CatalogToolEntry } | undefined {
    this.ensureInitialized();
    for (const [category, tools] of this._tools) {
      const entry = tools.find(t => t.name === name);
      if (entry) return { category, entry };
    }
    return undefined;
  }

  // ========================================================================
  // Filtering
  // ========================================================================

  /**
   * Filter categories by scope.
   */
  static filterCategories(scope?: ToolCategoryScope): ToolCategoryDefinition[] {
    const all = this.getCategories();
    if (!scope) return all;
    return all.filter(cat => this.isCategoryAllowed(cat.name, scope));
  }

  /**
   * Check if a category is allowed by a scope.
   */
  static isCategoryAllowed(name: string, scope?: ToolCategoryScope): boolean {
    if (!scope) return true;

    if (Array.isArray(scope)) {
      // Shorthand allowlist
      return scope.includes(name);
    }

    if ('include' in scope) {
      return scope.include.includes(name);
    }

    if ('exclude' in scope) {
      return !scope.exclude.includes(name);
    }

    return true;
  }

  // ========================================================================
  // Resolution
  // ========================================================================

  /**
   * Resolve tool names to ToolFunction[].
   *
   * Searches registered categories and (optionally) connector tools.
   * Used by app-level executors (e.g., V25's OneRingAgentExecutor).
   *
   * @param toolNames - Array of tool names to resolve
   * @param options - Resolution options
   * @returns Resolved tool functions (skips unresolvable names with warning)
   */
  static resolveTools(
    toolNames: string[],
    options?: { includeConnectors?: boolean; userId?: string },
  ): ToolFunction[] {
    this.ensureInitialized();
    const resolved: ToolFunction[] = [];
    const missing: string[] = [];

    for (const name of toolNames) {
      // 1. Search registered categories
      const found = this.findTool(name);
      if (found) {
        resolved.push(found.entry.tool);
        continue;
      }

      // 2. Search connector tools (if enabled)
      if (options?.includeConnectors) {
        const connectorTool = this.findConnectorTool(name);
        if (connectorTool) {
          resolved.push(connectorTool);
          continue;
        }
      }

      missing.push(name);
    }

    if (missing.length > 0) {
      logger.warn(
        { missing, resolved: resolved.length, total: toolNames.length },
        `[ToolCatalogRegistry.resolveTools] Could not resolve ${missing.length} tool(s): ${missing.join(', ')}`,
      );
    }

    return resolved;
  }

  /**
   * Search connector tools by name (lazy import to avoid circular deps).
   */
  private static findConnectorTool(name: string): ToolFunction | undefined {
    try {
      // Dynamic import not feasible in static sync method — use require-style pattern
      // ConnectorTools is available at runtime since it's already loaded
      const { ConnectorTools } = require('../../tools/connector/ConnectorTools.js');
      const allConnectorTools: Map<string, ToolFunction[]> = ConnectorTools.discoverAll();
      for (const [, tools] of allConnectorTools) {
        for (const tool of tools) {
          if (tool.definition.function.name === name) {
            return tool;
          }
        }
      }
    } catch {
      // ConnectorTools not available — skip
    }
    return undefined;
  }

  // ========================================================================
  // Built-in initialization
  // ========================================================================

  /**
   * Ensure built-in tools from registry.generated.ts are registered.
   * Called lazily on first query.
   *
   * In ESM environments, call `initializeFromRegistry(toolRegistry)` explicitly
   * from your app startup instead of relying on auto-initialization.
   */
  static ensureInitialized(): void {
    if (this._initialized) return;
    this._initialized = true;

    try {
      // Try to dynamically require the generated registry
      // This works in CommonJS and in Node.js ESM with --experimental-require-module
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../../tools/registry.generated.js');
      const registry = mod?.toolRegistry ?? mod?.default?.toolRegistry;
      if (Array.isArray(registry)) {
        this.registerFromToolRegistry(registry);
      }
    } catch {
      // ESM environment or registry not available — app must call initializeFromRegistry() explicitly
    }
  }

  /**
   * Explicitly initialize from the generated tool registry.
   * Call this at app startup in ESM environments where lazy require() doesn't work.
   *
   * @example
   * ```typescript
   * import { toolRegistry } from './tools/registry.generated.js';
   * ToolCatalogRegistry.initializeFromRegistry(toolRegistry);
   * ```
   */
  static initializeFromRegistry(registry: Array<{
    name: string;
    displayName: string;
    category: string;
    description: string;
    tool: ToolFunction;
    safeByDefault: boolean;
    requiresConnector?: boolean;
  }>): void {
    this._initialized = true;
    this.registerFromToolRegistry(registry);
  }

  /**
   * Internal: register tools from a tool registry array.
   */
  private static registerFromToolRegistry(registry: Array<{
    name: string;
    displayName: string;
    category: string;
    description: string;
    tool: ToolFunction;
    safeByDefault: boolean;
    requiresConnector?: boolean;
  }>): void {
    for (const entry of registry) {
      const category = entry.category;

      // Register category if not already registered
      if (!this._categories.has(category)) {
        const displayName = category
          .split('-')
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        this.registerCategory({
          name: category,
          displayName,
          description: this.BUILTIN_DESCRIPTIONS[category] ?? `Built-in ${category} tools`,
        });
      }

      // Register tool
      const catalogEntry: CatalogToolEntry = {
        tool: entry.tool,
        name: entry.name,
        displayName: entry.displayName,
        description: entry.description,
        safeByDefault: entry.safeByDefault,
        requiresConnector: entry.requiresConnector,
      };

      const existing = this._tools.get(category) ?? [];
      // Don't duplicate
      if (!existing.some(t => t.name === catalogEntry.name)) {
        existing.push(catalogEntry);
        this._tools.set(category, existing);
      }
    }
  }

  /**
   * Reset the registry. Primarily for testing.
   */
  static reset(): void {
    this._categories.clear();
    this._tools.clear();
    this._initialized = false;
  }
}
