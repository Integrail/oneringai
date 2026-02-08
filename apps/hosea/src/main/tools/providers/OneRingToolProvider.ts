/**
 * OneRingToolProvider
 *
 * Wraps @everworker/oneringai ToolRegistry to provide tools to UnifiedToolCatalog
 */

import { ToolRegistry, getToolByName } from '@everworker/oneringai';
import type { ToolRegistryEntry, ConnectorToolEntry } from '@everworker/oneringai';
import type {
  IToolProvider,
  UnifiedToolEntry,
  HoseaToolCategory,
} from '../UnifiedToolCatalog.js';
import { CATEGORY_DISPLAY_NAMES } from '../UnifiedToolCatalog.js';

/**
 * Maps ToolRegistryEntry from @everworker/oneringai to UnifiedToolEntry
 */
function mapToUnifiedEntry(
  entry: ToolRegistryEntry | ConnectorToolEntry
): UnifiedToolEntry {
  // ToolCategory from @everworker/oneringai is compatible with HoseaToolCategory
  const category = entry.category as HoseaToolCategory;

  const result: UnifiedToolEntry = {
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

  // Pass through connector metadata if present
  if (ToolRegistry.isConnectorTool(entry)) {
    result.connectorName = entry.connectorName;
    result.serviceType = entry.serviceType;
  }

  return result;
}

/**
 * Provider that wraps @everworker/oneringai ToolRegistry (static methods)
 */
export class OneRingToolProvider implements IToolProvider {
  readonly name = 'oneringai';
  readonly source = 'oneringai' as const;

  private cachedEntries: UnifiedToolEntry[] | null = null;

  /**
   * Get all tools from the @everworker/oneringai registry
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
    // Use the standalone getToolByName function from @everworker/oneringai
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
