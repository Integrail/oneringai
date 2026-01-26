/**
 * Glob Tool
 *
 * Fast file pattern matching for finding files by name patterns.
 * Supports standard glob patterns like **\/*.ts, src/**\/*.tsx, etc.
 *
 * Features:
 * - Standard glob pattern syntax
 * - Recursive directory traversal
 * - Results sorted by modification time
 * - Configurable result limits
 * - Excludes common non-code directories by default
 */

import { readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { ToolFunction } from '../../domain/entities/Tool.js';
import {
  type FilesystemToolConfig,
  type GlobResult,
  DEFAULT_FILESYSTEM_CONFIG,
  validatePath,
} from './types.js';

/**
 * Arguments for the glob tool
 */
export interface GlobArgs {
  /** The glob pattern to match files against (e.g., "**\/*.ts", "src/**\/*.tsx") */
  pattern: string;
  /** The directory to search in. Defaults to current working directory. */
  path?: string;
}

/**
 * Simple glob pattern matcher
 */
function matchGlobPattern(pattern: string, filePath: string): boolean {
  // Convert glob pattern to regex
  let regexPattern = pattern
    // Escape special regex characters except * and ?
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    // Convert ** to match any path
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    // Convert * to match any characters except /
    .replace(/\*/g, '[^/]*')
    // Convert ? to match single character
    .replace(/\?/g, '.')
    // Restore **
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  // Anchor the pattern
  regexPattern = '^' + regexPattern + '$';

  try {
    const regex = new RegExp(regexPattern);
    return regex.test(filePath);
  } catch {
    return false;
  }
}

/**
 * Recursively find files matching a pattern
 */
async function findFiles(
  dir: string,
  pattern: string,
  baseDir: string,
  config: Required<FilesystemToolConfig>,
  results: { path: string; mtime: number }[] = [],
  depth: number = 0
): Promise<{ path: string; mtime: number }[]> {
  // Prevent infinite recursion
  if (depth > 50 || results.length >= config.maxResults) {
    return results;
  }

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= config.maxResults) break;

      const fullPath = join(dir, entry.name);
      const relativePath = relative(baseDir, fullPath);

      // Check if directory is blocked
      if (entry.isDirectory()) {
        const isBlocked = config.blockedDirectories.some(
          blocked => entry.name === blocked || relativePath.includes(`/${blocked}/`) || relativePath.startsWith(`${blocked}/`)
        );
        if (isBlocked) continue;

        // Recurse into subdirectories
        await findFiles(fullPath, pattern, baseDir, config, results, depth + 1);
      } else if (entry.isFile()) {
        // Check if file matches pattern
        if (matchGlobPattern(pattern, relativePath)) {
          try {
            const stats = await stat(fullPath);
            results.push({
              path: relativePath,
              mtime: stats.mtimeMs,
            });
          } catch {
            // Skip files we can't stat
          }
        }
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return results;
}

/**
 * Create a Glob tool with the given configuration
 */
export function createGlobTool(config: FilesystemToolConfig = {}): ToolFunction<GlobArgs, GlobResult> {
  const mergedConfig = { ...DEFAULT_FILESYSTEM_CONFIG, ...config };

  return {
    definition: {
      type: 'function',
      function: {
        name: 'glob',
        description: `Fast file pattern matching tool that finds files by name patterns.

USAGE:
- Supports glob patterns like "**/*.js", "src/**/*.ts", "*.{ts,tsx}"
- Returns matching file paths sorted by modification time (newest first)
- Use this tool when you need to find files by name patterns

PATTERN SYNTAX:
- * matches any characters except /
- ** matches any characters including /
- ? matches a single character
- {a,b} matches either a or b

EXAMPLES:
- Find all TypeScript files: { "pattern": "**/*.ts" }
- Find files in src folder: { "pattern": "src/**/*.{ts,tsx}" }
- Find test files: { "pattern": "**/*.test.ts" }
- Find specific file type in path: { "pattern": "src/components/**/*.tsx", "path": "/project" }

WHEN TO USE:
- To find files by extension or name pattern
- To explore project structure
- To find related files (tests, types, etc.)
- Before using grep when you know the file pattern`,
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'The glob pattern to match files against (e.g., "**/*.ts", "src/**/*.tsx")',
            },
            path: {
              type: 'string',
              description: 'The directory to search in. If not specified, uses the current working directory. IMPORTANT: Omit this field to use the default directory.',
            },
          },
          required: ['pattern'],
        },
      },
    },

    execute: async (args: GlobArgs): Promise<GlobResult> => {
      const { pattern, path } = args;

      // Determine search directory
      const searchDir = path || mergedConfig.workingDirectory;

      // Validate path
      const validation = validatePath(searchDir, {
        ...mergedConfig,
        blockedDirectories: [], // Allow searching from any valid directory
      });
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      const resolvedDir = validation.resolvedPath;

      // Check if directory exists
      if (!existsSync(resolvedDir)) {
        return {
          success: false,
          error: `Directory not found: ${searchDir}`,
        };
      }

      try {
        // Find matching files
        const results = await findFiles(resolvedDir, pattern, resolvedDir, mergedConfig);

        // Sort by modification time (newest first)
        results.sort((a, b) => b.mtime - a.mtime);

        // Check if we hit the limit
        const truncated = results.length >= mergedConfig.maxResults;

        return {
          success: true,
          files: results.map(r => r.path),
          count: results.length,
          truncated,
        };
      } catch (error) {
        return {
          success: false,
          error: `Glob search failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}

/**
 * Default Glob tool instance
 */
export const glob = createGlobTool();
