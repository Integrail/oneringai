/**
 * Pre-built tools for agents
 *
 * Import and use with your agents:
 *
 * ```typescript
 * import { tools } from '@everworker/oneringai';
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

export { webFetch, createWebSearchTool, createWebScrapeTool } from './web/index.js';

// Re-export search result type from capabilities (canonical location)
export type { SearchResult } from './web/index.js';

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
// Multimedia Tools (Auto-registered with ConnectorTools for AI vendors)
// ============================================================================

// Canonical exports
export {
  setMediaStorage,
  getMediaStorage,
  createImageGenerationTool,
  createVideoTools,
  createTextToSpeechTool,
  createSpeechToTextTool,
} from './multimedia/index.js';

// Deprecated aliases (backward compat - remove in next major version)
export {
  FileMediaOutputHandler,
  setMediaOutputHandler,
  getMediaOutputHandler,
} from './multimedia/index.js';

export type {
  IMediaOutputHandler,
  MediaOutputMetadata,
  MediaOutputResult,
} from './multimedia/index.js';

// ============================================================================
// GitHub Tools (Auto-registered with ConnectorTools for GitHub service)
// ============================================================================

export {
  // Tool factories
  createSearchFilesTool,
  createSearchCodeTool,
  createGitHubReadFileTool,
  createGetPRTool,
  createPRFilesTool,
  createPRCommentsTool,
  createCreatePRTool,
  // Utilities
  parseRepository,
  resolveRepository,
} from './github/index.js';

export type {
  GitHubRepository,
  GitHubSearchFilesResult,
  GitHubSearchCodeResult,
  GitHubReadFileResult,
  GitHubGetPRResult,
  GitHubPRFilesResult,
  GitHubPRCommentsResult,
  GitHubPRCommentEntry,
  GitHubCreatePRResult,
} from './github/index.js';

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
 * import { tools } from '@everworker/oneringai';
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

// ============================================================================
// Unified Tool Registry (Built-in + Connector Tools)
// ============================================================================

export { ToolRegistry, type ConnectorToolEntry } from './ToolRegistry.js';
