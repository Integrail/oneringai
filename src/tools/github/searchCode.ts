/**
 * GitHub Search Code Tool
 *
 * Search for code content across a GitHub repository.
 * Mirrors the local `grep` tool for remote GitHub repos.
 *
 * Uses the GitHub Code Search API with text-match support.
 *
 * Note: GitHub's code search API has a rate limit of 30 requests/minute.
 */

import type { Connector } from '../../core/Connector.js';
import type { ToolFunction, ToolContext } from '../../domain/entities/Tool.js';
import {
  type GitHubSearchCodeResult,
  type GitHubSearchCodeResponse,
  resolveRepository,
  githubFetch,
} from './types.js';

/**
 * Arguments for the search_code tool
 */
export interface SearchCodeArgs {
  /** Repository in "owner/repo" format or full GitHub URL */
  repository?: string;
  /** Search query (keyword or phrase) */
  query: string;
  /** Filter by programming language (e.g., "typescript", "python") */
  language?: string;
  /** Filter by file path (e.g., "src/", "lib/utils") */
  path?: string;
  /** Filter by file extension (e.g., "ts", "py") */
  extension?: string;
  /** Maximum number of results (default: 30, max: 100) */
  limit?: number;
}

/**
 * Create a GitHub search_code tool
 */
export function createSearchCodeTool(
  connector: Connector,
  userId?: string
): ToolFunction<SearchCodeArgs, GitHubSearchCodeResult> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'search_code',
        description: `Search for code content across a GitHub repository.

USAGE:
- Search by keyword, function name, class name, or any text
- Filter by language, path, or file extension
- Returns matching files with text fragments showing context

RATE LIMITS:
- GitHub's code search API is limited to 30 requests per minute
- Results may be incomplete for very large repositories

EXAMPLES:
- Find function: { "query": "function handleAuth", "language": "typescript" }
- Find imports: { "query": "import React", "extension": "tsx" }
- Search in path: { "query": "TODO", "path": "src/utils" }
- Limit results: { "query": "console.log", "limit": 10 }`,
        parameters: {
          type: 'object',
          properties: {
            repository: {
              type: 'string',
              description:
                'Repository in "owner/repo" format or full GitHub URL. Optional if connector has a default repository.',
            },
            query: {
              type: 'string',
              description: 'Search query — keyword, function name, or any text to find in code',
            },
            language: {
              type: 'string',
              description: 'Filter by programming language (e.g., "typescript", "python", "go")',
            },
            path: {
              type: 'string',
              description: 'Filter by file path prefix (e.g., "src/", "lib/utils")',
            },
            extension: {
              type: 'string',
              description: 'Filter by file extension without dot (e.g., "ts", "py", "go")',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 30, max: 100)',
            },
          },
          required: ['query'],
        },
      },
    },

    describeCall: (args: SearchCodeArgs): string => {
      const parts = [`"${args.query}"`];
      if (args.language) parts.push(`lang:${args.language}`);
      if (args.repository) parts.push(`in ${args.repository}`);
      return parts.join(' ');
    },

    permission: {
      scope: 'session',
      riskLevel: 'low',
      approvalMessage: `Search code in a GitHub repository via ${connector.displayName}`,
    },

    execute: async (args: SearchCodeArgs, context?: ToolContext): Promise<GitHubSearchCodeResult> => {
      const effectiveUserId = context?.userId ?? userId;
      const effectiveAccountId = context?.accountId;
      const resolved = resolveRepository(args.repository, connector);
      if (!resolved.success) {
        return { success: false, error: resolved.error };
      }
      const { owner, repo } = resolved.repo;

      try {
        // Build search query with qualifiers
        const qualifiers = [`repo:${owner}/${repo}`];
        if (args.language) qualifiers.push(`language:${args.language}`);
        if (args.path) qualifiers.push(`path:${args.path}`);
        if (args.extension) qualifiers.push(`extension:${args.extension}`);

        const q = `${args.query} ${qualifiers.join(' ')}`;
        const perPage = Math.min(args.limit ?? 30, 100);

        const result = await githubFetch<GitHubSearchCodeResponse>(
          connector,
          `/search/code`,
          {
            userId: effectiveUserId,
            accountId: effectiveAccountId,
            // Request text-match fragments
            accept: 'application/vnd.github.text-match+json',
            queryParams: { q, per_page: perPage },
          }
        );

        const matches = result.items.map((item) => ({
          file: item.path,
          fragment: item.text_matches?.[0]?.fragment,
        }));

        return {
          success: true,
          matches,
          count: result.total_count,
          truncated: result.incomplete_results || result.total_count > perPage,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to search code: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}
