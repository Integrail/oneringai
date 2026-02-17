/**
 * Custom tool generation system
 *
 * Meta-tools for creating, testing, iterating, and persisting reusable custom tools.
 */

// Bundle factory (creates all 6 meta-tools)
export { createCustomToolMetaTools } from './factories.js';
export type { CustomToolMetaToolsOptions } from './factories.js';

// Individual tool factories
export {
  createCustomToolDraft,
  createCustomToolTest,
  createCustomToolSave,
  createCustomToolList,
  createCustomToolLoad,
  createCustomToolDelete,
} from './factories.js';

// Hydration (CustomToolDefinition → ToolFunction)
export { hydrateCustomTool } from './hydrate.js';
export type { HydrateOptions } from './hydrate.js';

// Shared sandbox description utilities
export { buildConnectorList, buildDraftDescription, buildTestDescription, SANDBOX_API_REFERENCE } from './sandboxDescription.js';
