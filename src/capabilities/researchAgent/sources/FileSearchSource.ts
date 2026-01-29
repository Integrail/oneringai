/**
 * FileSearchSource - File system research source
 *
 * Enables research across local or remote file systems using glob patterns and grep.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
// @ts-ignore - glob types may not be available in all environments
import { glob } from 'glob';
import type {
  IResearchSource,
  SourceResult,
  SearchResponse,
  FetchedContent,
  SearchOptions,
  FetchOptions,
  SourceCapabilities,
} from '../types.js';

/**
 * File search source configuration
 */
export interface FileSearchSourceConfig {
  /** Source name */
  name: string;
  /** Description */
  description?: string;
  /** Base directory for searches */
  basePath: string;
  /** File patterns to include (glob) */
  includePatterns?: string[];
  /** File patterns to exclude (glob) */
  excludePatterns?: string[];
  /** Maximum file size to read (bytes) */
  maxFileSize?: number;
  /** Search mode: 'filename' (match filenames), 'content' (grep-like), 'both' */
  searchMode?: 'filename' | 'content' | 'both';
}

/**
 * FileSearchSource - Search and read files
 */
export class FileSearchSource implements IResearchSource {
  readonly name: string;
  readonly description: string;
  readonly type = 'file' as const;

  private basePath: string;
  private includePatterns: string[];
  private excludePatterns: string[];
  private maxFileSize: number;
  private searchMode: 'filename' | 'content' | 'both';

  constructor(config: FileSearchSourceConfig) {
    this.name = config.name;
    this.description = config.description ?? `File search in ${config.basePath}`;
    this.basePath = path.resolve(config.basePath);
    this.includePatterns = config.includePatterns ?? ['**/*'];
    this.excludePatterns = config.excludePatterns ?? ['**/node_modules/**', '**/.git/**'];
    this.maxFileSize = config.maxFileSize ?? 1024 * 1024; // 1MB default
    this.searchMode = config.searchMode ?? 'both';
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResponse> {
    try {
      const results: SourceResult[] = [];
      const maxResults = options?.maxResults ?? 20;

      // Get all matching files
      const files = await glob(this.includePatterns, {
        cwd: this.basePath,
        ignore: this.excludePatterns,
        nodir: true,
        absolute: true,
      });

      // Search through files
      for (const filePath of files) {
        if (results.length >= maxResults) break;

        const relativePath = path.relative(this.basePath, filePath);
        const filename = path.basename(filePath);

        // Filename search
        if (this.searchMode === 'filename' || this.searchMode === 'both') {
          if (this.matchesQuery(filename, query)) {
            results.push({
              id: `file_${Buffer.from(relativePath).toString('base64').slice(0, 20)}`,
              title: filename,
              snippet: `File: ${relativePath}`,
              reference: filePath,
              relevance: this.calculateRelevance(filename, query),
              metadata: { type: 'filename_match', relativePath },
            });
            continue; // Don't also content-search this file
          }
        }

        // Content search
        if (this.searchMode === 'content' || this.searchMode === 'both') {
          try {
            const stat = await fs.stat(filePath);
            if (stat.size > this.maxFileSize) continue;

            const content = await fs.readFile(filePath, 'utf-8');
            const match = this.findContentMatch(content, query);

            if (match) {
              results.push({
                id: `file_${Buffer.from(relativePath).toString('base64').slice(0, 20)}`,
                title: filename,
                snippet: match.snippet,
                reference: filePath,
                relevance: match.relevance,
                metadata: {
                  type: 'content_match',
                  relativePath,
                  lineNumber: match.lineNumber,
                },
              });
            }
          } catch {
            // Skip files that can't be read
          }
        }
      }

      // Sort by relevance
      results.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));

      return {
        success: true,
        query,
        results: results.slice(0, maxResults),
        totalResults: results.length,
      };
    } catch (error) {
      return {
        success: false,
        query,
        results: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async fetch(reference: string, options?: FetchOptions): Promise<FetchedContent> {
    try {
      // Validate path is within base path
      const absolutePath = path.resolve(reference);
      if (!absolutePath.startsWith(this.basePath)) {
        return {
          success: false,
          reference,
          content: null,
          error: 'Path is outside allowed base directory',
        };
      }

      const stat = await fs.stat(absolutePath);
      const maxSize = options?.maxSize ?? this.maxFileSize;

      if (stat.size > maxSize) {
        return {
          success: false,
          reference,
          content: null,
          error: `File too large: ${stat.size} bytes (max: ${maxSize})`,
          sizeBytes: stat.size,
        };
      }

      const content = await fs.readFile(absolutePath, 'utf-8');
      const ext = path.extname(absolutePath).toLowerCase();

      return {
        success: true,
        reference,
        content,
        contentType: this.getContentType(ext),
        sizeBytes: stat.size,
        metadata: {
          filename: path.basename(absolutePath),
          extension: ext,
          modifiedAt: stat.mtime.toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        reference,
        content: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await fs.access(this.basePath);
      return true;
    } catch {
      return false;
    }
  }

  getCapabilities(): SourceCapabilities {
    return {
      canSearch: true,
      canFetch: true,
      hasRelevanceScores: true,
      maxResultsPerSearch: 1000,
      contentTypes: ['text/plain', 'application/json', 'text/markdown', 'text/javascript'],
    };
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private matchesQuery(text: string, query: string): boolean {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Simple substring match
    if (lowerText.includes(lowerQuery)) return true;

    // Word-based match
    const queryWords = lowerQuery.split(/\s+/);
    return queryWords.every((word) => lowerText.includes(word));
  }

  private calculateRelevance(text: string, query: string): number {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Exact match
    if (lowerText === lowerQuery) return 1.0;

    // Starts with query
    if (lowerText.startsWith(lowerQuery)) return 0.9;

    // Contains query
    if (lowerText.includes(lowerQuery)) return 0.7;

    // Word match
    const queryWords = lowerQuery.split(/\s+/);
    const matchedWords = queryWords.filter((w) => lowerText.includes(w));
    return (matchedWords.length / queryWords.length) * 0.6;
  }

  private findContentMatch(
    content: string,
    query: string
  ): { snippet: string; relevance: number; lineNumber: number } | null {
    const lines = content.split('\n');
    const lowerQuery = query.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lowerLine = line.toLowerCase();

      if (lowerLine.includes(lowerQuery)) {
        // Get context (line before and after)
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length, i + 2);
        const context = lines.slice(start, end).join('\n');

        return {
          snippet: context.length > 200 ? context.slice(0, 200) + '...' : context,
          relevance: 0.8,
          lineNumber: i + 1,
        };
      }
    }

    return null;
  }

  private getContentType(ext: string): string {
    const types: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.py': 'text/x-python',
      '.html': 'text/html',
      '.css': 'text/css',
      '.xml': 'application/xml',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
    };
    return types[ext] ?? 'text/plain';
  }
}

/**
 * Create a file search source
 */
export function createFileSearchSource(
  basePath: string,
  options?: Partial<FileSearchSourceConfig>
): FileSearchSource {
  return new FileSearchSource({
    name: options?.name ?? `files-${path.basename(basePath)}`,
    basePath,
    ...options,
  });
}
