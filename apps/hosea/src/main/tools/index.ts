/**
 * Hosea Tools Module
 *
 * Registers Hosea-specific tool categories with the core ToolCatalogRegistry.
 */

export { registerHoseaTools, updateBrowserService, invalidateHoseaTools } from './registration.js';

// Re-export core types for convenience
export { ToolCatalogRegistry } from '@everworker/oneringai';
export type { CatalogToolEntry, ToolCategoryDefinition } from '@everworker/oneringai';
