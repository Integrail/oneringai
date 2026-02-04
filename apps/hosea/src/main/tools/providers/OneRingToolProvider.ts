/**
 * OneRingToolProvider
 *
 * Wraps @oneringai/agents ToolRegistry to provide tools to UnifiedToolCatalog
 */

import { ToolRegistry, getToolByName } from '@oneringai/agents';
import type { ToolRegistryEntry, ConnectorToolEntry } from '@oneringai/agents';
import type {
  IToolProvider,
  UnifiedToolEntry,
  HoseaToolCategory,
} from '../UnifiedToolCatalog.js';
import { CATEGORY_DISPLAY_NAMES } from '../UnifiedToolCatalog.js';

/**
 * Maps ToolRegistryEntry from @oneringai/agents to UnifiedToolEntry
 */
function mapToUnifiedEntry(
  entry: ToolRegistryEntry | ConnectorToolEntry
): UnifiedToolEntry {
  // ToolCategory from @oneringai/agents is compatible with HoseaToolCategory
  const category = entry.category as HoseaToolCategory;

  return {
    name: entry.name,
    exportName: entry.exportName,
    displayName: entry.displayName,
    category,
    categoryDisplayName: CATEGORY_DISPLAY_NAMES[category] || category,
    description: entry.description,
    safeByDefault: entry.safeByDefault,
    requiresConnector: entry.requiresConnector,
    connectorServiceTypes: entry.connectorServiceTypes,
    source: 'oneringai',
    // Direct tool reference - these tools are static
    tool: entry.tool,
  };
}

/**
 * Provider that wraps @oneringai/agents ToolRegistry (static methods)
 */
export class OneRingToolProvider implements IToolProvider {
  readonly name = 'oneringai';
  readonly source = 'oneringai' as const;

  private cachedEntries: UnifiedToolEntry[] | null = null;

  /**
   * Get all tools from the @oneringai/agents registry
   */
  getTools(): UnifiedToolEntry[] {
    if (this.cachedEntries) {
      return this.cachedEntries;
    }

    // Get all entries from the registry (built-in + connector tools)
    // Note: ToolRegistry has static methods
    const registryEntries = ToolRegistry.getAllTools();

    // Map to unified format
    this.cachedEntries = registryEntries.map(mapToUnifiedEntry);

    return this.cachedEntries;
  }

  /**
   * Get a specific tool by name
   */
  getToolByName(name: string): UnifiedToolEntry | undefined {
    // Use the standalone getToolByName function from @oneringai/agents
    const entry = getToolByName(name);
    if (!entry) {
      return undefined;
    }
    return mapToUnifiedEntry(entry);
  }

  /**
   * Invalidate the cache (call if registry changes)
   */
  invalidateCache(): void {
    this.cachedEntries = null;
  }
}
