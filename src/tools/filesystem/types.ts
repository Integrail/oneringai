/**
 * Filesystem Tools - Shared Types
 *
 * Common types and configuration for filesystem operations.
 */

import { resolve, normalize, isAbsolute } from 'node:path';

/**
 * Configuration for filesystem tools
 */
export interface FilesystemToolConfig {
  /**
   * Base working directory for all operations.
   * All paths will be resolved relative to this directory.
   * Defaults to process.cwd()
   */
  workingDirectory?: string;

  /**
   * Allowed directories for file operations.
   * If specified, operations outside these directories will be blocked.
   * Paths can be absolute or relative to workingDirectory.
   */
  allowedDirectories?: string[];

  /**
   * Blocked directories (e.g., node_modules, .git).
   * Operations in these directories will be blocked.
   */
  blockedDirectories?: string[];

  /**
   * Maximum file size to read (in bytes).
   * Default: 10MB
   */
  maxFileSize?: number;

  /**
   * Maximum number of results for glob/grep operations.
   * Default: 1000
   */
  maxResults?: number;

  /**
   * Whether to follow symlinks.
   * Default: false
   */
  followSymlinks?: boolean;

  /**
   * File extensions to exclude from search.
   * Default: common binary extensions
   */
  excludeExtensions?: string[];
}

/**
 * Default configuration
 */
export const DEFAULT_FILESYSTEM_CONFIG: Required<FilesystemToolConfig> = {
  workingDirectory: process.cwd(),
  allowedDirectories: [],
  blockedDirectories: ['node_modules', '.git', '.svn', '.hg', '__pycache__', '.cache'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxResults: 1000,
  followSymlinks: false,
  excludeExtensions: [
    '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a',
    '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
    '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
  ],
};

/**
 * Result of a file read operation
 */
export interface ReadFileResult {
  success: boolean;
  content?: string;
  lines?: number;
  truncated?: boolean;
  encoding?: string;
  size?: number;
  error?: string;
  path?: string;
}

/**
 * Result of a file write operation
 */
export interface WriteFileResult {
  success: boolean;
  path?: string;
  bytesWritten?: number;
  created?: boolean;
  error?: string;
}

/**
 * Result of a file edit operation
 */
export interface EditFileResult {
  success: boolean;
  path?: string;
  replacements?: number;
  error?: string;
  diff?: string;
}

/**
 * Result of a glob operation
 */
export interface GlobResult {
  success: boolean;
  files?: string[];
  count?: number;
  truncated?: boolean;
  error?: string;
}

/**
 * A single grep match
 */
export interface GrepMatch {
  file: string;
  line: number;
  column?: number;
  content: string;
  context?: {
    before: string[];
    after: string[];
  };
}

/**
 * Result of a grep operation
 */
export interface GrepResult {
  success: boolean;
  matches?: GrepMatch[];
  filesSearched?: number;
  filesMatched?: number;
  totalMatches?: number;
  truncated?: boolean;
  error?: string;
}

/**
 * Validate and resolve a path within allowed boundaries
 */
export function validatePath(
  inputPath: string,
  config: FilesystemToolConfig = {}
): { valid: boolean; resolvedPath: string; error?: string } {
  const workingDir = config.workingDirectory || process.cwd();
  const allowedDirs = config.allowedDirectories || [];
  const blockedDirs = config.blockedDirectories || DEFAULT_FILESYSTEM_CONFIG.blockedDirectories;

  // Resolve the path
  let resolvedPath: string;
  if (isAbsolute(inputPath)) {
    resolvedPath = normalize(inputPath);
  } else {
    resolvedPath = resolve(workingDir, inputPath);
  }

  // Check blocked directories - check if any path segment matches a blocked directory name
  const pathSegments = resolvedPath.split('/').filter(Boolean);
  for (const blocked of blockedDirs) {
    // If blocked is a simple name (no slashes), check path segments
    if (!blocked.includes('/')) {
      if (pathSegments.includes(blocked)) {
        return {
          valid: false,
          resolvedPath,
          error: `Path is in blocked directory: ${blocked}`,
        };
      }
    } else {
      // If blocked is a path, resolve it and check prefix
      const blockedPath = isAbsolute(blocked) ? blocked : resolve(workingDir, blocked);
      if (resolvedPath.startsWith(blockedPath + '/') || resolvedPath === blockedPath) {
        return {
          valid: false,
          resolvedPath,
          error: `Path is in blocked directory: ${blocked}`,
        };
      }
    }
  }

  // Check allowed directories (if specified)
  if (allowedDirs.length > 0) {
    let isAllowed = false;
    for (const allowed of allowedDirs) {
      const allowedPath = isAbsolute(allowed) ? allowed : resolve(workingDir, allowed);
      if (resolvedPath.startsWith(allowedPath + '/') || resolvedPath === allowedPath) {
        isAllowed = true;
        break;
      }
    }
    if (!isAllowed) {
      return {
        valid: false,
        resolvedPath,
        error: `Path is outside allowed directories`,
      };
    }
  }

  return { valid: true, resolvedPath };
}

/**
 * Check if a file extension should be excluded
 */
export function isExcludedExtension(
  filePath: string,
  excludeExtensions: string[] = DEFAULT_FILESYSTEM_CONFIG.excludeExtensions
): boolean {
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
  return excludeExtensions.includes(ext);
}
