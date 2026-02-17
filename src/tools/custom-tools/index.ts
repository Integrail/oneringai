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

// Default tool instances (auto-registered via tool registry)
export { customToolDraft } from './customToolDraft.js';
export { customToolTest } from './customToolTest.js';
export { customToolSave } from './customToolSave.js';
export { customToolList } from './customToolList.js';
export { customToolLoad } from './customToolLoad.js';
export { customToolDelete } from './customToolDelete.js';

// Hydration (CustomToolDefinition → ToolFunction)
export { hydrateCustomTool } from './hydrate.js';
export type { HydrateOptions } from './hydrate.js';

// Shared sandbox description utilities
export { buildConnectorList, buildDraftDescription, buildTestDescription, SANDBOX_API_REFERENCE } from './sandboxDescription.js';
