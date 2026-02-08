/**
 * GitHub Connector Tools
 *
 * Auto-registers GitHub tool factories with ConnectorTools.
 * When imported, this module registers factories so that `ConnectorTools.for('github')`
 * automatically includes GitHub-specific tools alongside the generic API tool.
 *
 * Tools provided:
 * - search_files — Search files by glob pattern
 * - search_code — Search code content
 * - read_file — Read file content with line ranges
 * - get_pr — Get pull request details
 * - pr_files — Get PR changed files with diffs
 * - pr_comments — Get PR comments and reviews
 * - create_pr — Create a pull request
 */

// Side-effect: register GitHub tool factories with ConnectorTools
import { registerGitHubTools } from './register.js';
registerGitHubTools();

// Types
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
  GitHubAPIError,
} from './types.js';

// Utility functions
export { parseRepository, resolveRepository } from './types.js';

// Tool factories (for direct use with custom options)
export { createSearchFilesTool } from './searchFiles.js';
export { createSearchCodeTool } from './searchCode.js';
export { createGitHubReadFileTool } from './readFile.js';
export { createGetPRTool } from './getPR.js';
export { createPRFilesTool } from './prFiles.js';
export { createPRCommentsTool } from './prComments.js';
export { createCreatePRTool } from './createPR.js';
