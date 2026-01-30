/**
 * Pre-built tools for agents
 *
 * Import and use with your agents:
 *
 * ```typescript
 * import { tools } from '@oneringai/agents';
 *
 * const agent = Agent.create({
 *   connector: 'openai',
 *   model: 'gpt-4',
 *   tools: [
 *     // Filesystem tools
 *     tools.readFile,
 *     tools.writeFile,
 *     tools.editFile,
 *     tools.glob,
 *     tools.grep,
 *     tools.listDirectory,
 *     // Shell tools
 *     tools.bash,
 *     // Web tools
 *     tools.webFetch,
 *     tools.webSearch,
 *   ]
 * });
 * ```
 */

// ============================================================================
// Filesystem Tools
// ============================================================================

export {
  // Tools
  readFile,
  writeFile,
  editFile,
  glob,
  grep,
  listDirectory,
  // Factory functions
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createGlobTool,
  createGrepTool,
  createListDirectoryTool,
  // Types and utilities
  DEFAULT_FILESYSTEM_CONFIG,
  validatePath,
  isExcludedExtension,
  expandTilde,
} from './filesystem/index.js';

export type {
  FilesystemToolConfig,
  ReadFileResult,
  WriteFileResult,
  EditFileResult,
  GlobResult,
  GrepResult,
  GrepMatch,
} from './filesystem/index.js';

// ============================================================================
// Shell Tools
// ============================================================================

export {
  // Tools
  bash,
  // Factory functions
  createBashTool,
  // Utilities
  getBackgroundOutput,
  killBackgroundProcess,
  // Config
  DEFAULT_SHELL_CONFIG,
  isBlockedCommand,
} from './shell/index.js';

export type {
  ShellToolConfig,
  BashResult,
} from './shell/index.js';

// ============================================================================
// JSON Tools
// ============================================================================

export { jsonManipulator } from './json/jsonManipulator.js';

// ============================================================================
// Web Tools
// ============================================================================

export { webFetch, webFetchJS, webSearch, webScrape } from './web/index.js';

// Re-export search result type
export type { SearchResult } from './web/searchProviders/serper.js';

// ============================================================================
// Code Execution Tools
// ============================================================================

export { executeJavaScript, createExecuteJavaScriptTool } from './code/index.js';

// ============================================================================
// Connector Tools (Vendor-Dependent Tools Framework)
// ============================================================================

export {
  ConnectorTools,
  type ServiceToolFactory,
  type GenericAPIToolOptions,
  type GenericAPICallArgs,
  type GenericAPICallResult,
} from './connector/index.js';

// ============================================================================
// Convenience: All Developer Tools Bundle
// ============================================================================

import { readFile } from './filesystem/index.js';
import { writeFile } from './filesystem/index.js';
import { editFile } from './filesystem/index.js';
import { glob } from './filesystem/index.js';
import { grep } from './filesystem/index.js';
import { listDirectory } from './filesystem/index.js';
import { bash } from './shell/index.js';

/**
 * A bundle of all developer tools commonly used for coding tasks.
 * Includes: readFile, writeFile, editFile, glob, grep, listDirectory, bash
 *
 * @example
 * ```typescript
 * import { tools } from '@oneringai/agents';
 *
 * const agent = Agent.create({
 *   connector: 'openai',
 *   model: 'gpt-4',
 *   tools: tools.developerTools,
 * });
 * ```
 */
export const developerTools = [
  readFile,
  writeFile,
  editFile,
  glob,
  grep,
  listDirectory,
  bash,
];

// ============================================================================
// Tool Registry (Auto-Generated)
// ============================================================================

export {
  toolRegistry,
  getAllBuiltInTools,
  getToolRegistry,
  getToolsByCategory,
  getToolByName,
  getToolsRequiringConnector,
  getToolCategories,
  type ToolCategory,
  type ToolRegistryEntry,
} from './registry.generated.js';
