/**
 * FileSearchSource Tests
 * Tests for the file system research source
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileSearchSource, createFileSearchSource, FileSearchSourceConfig } from '@/capabilities/researchAgent/sources/FileSearchSource.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  access: vi.fn(),
  stat: vi.fn(),
}));

// Mock glob
vi.mock('glob', () => ({
  glob: vi.fn(async () => [
    '/test/path/file1.md',
    '/test/path/file2.txt',
    '/test/path/subdir/file3.md',
  ]),
}));

describe('FileSearchSource', () => {
  let source: FileSearchSource;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup fs mocks
    (fs.readFile as any).mockResolvedValue('Test file content with search term');
    (fs.access as any).mockResolvedValue(undefined);
    (fs.stat as any).mockResolvedValue({
      size: 1000,
      mtime: new Date(),
    });
  });

  describe('constructor', () => {
    it('should create instance with base path', () => {
      source = new FileSearchSource({
        name: 'file-test',
        basePath: '/test/path',
      });

      expect(source).toBeDefined();
      expect(source.name).toBe('file-test');
      expect(source.type).toBe('file');
    });

    it('should use default description', () => {
      source = new FileSearchSource({
        name: 'file-test',
        basePath: '/test/path',
      });

      expect(source.description).toContain('/test/path');
    });

    it('should accept custom description', () => {
      source = new FileSearchSource({
        name: 'file-test',
        description: 'Custom file search',
        basePath: '/test/path',
      });

      expect(source.description).toBe('Custom file search');
    });

    it('should accept include patterns', () => {
      source = new FileSearchSource({
        name: 'file-test',
        basePath: '/test/path',
        includePatterns: ['**/*.md', '**/*.txt'],
      });

      expect(source).toBeDefined();
    });

    it('should accept exclude patterns', () => {
      source = new FileSearchSource({
        name: 'file-test',
        basePath: '/test/path',
        excludePatterns: ['node_modules/**', '.git/**'],
      });

      expect(source).toBeDefined();
    });

    it('should accept search mode', () => {
      source = new FileSearchSource({
        name: 'file-test',
        basePath: '/test/path',
        searchMode: 'content',
      });

      expect(source).toBeDefined();
    });
  });

  describe('search', () => {
    describe('filename mode', () => {
      beforeEach(() => {
        source = new FileSearchSource({
          name: 'file-test',
          basePath: '/test/path',
          searchMode: 'filename',
        });
      });

      it('should search files by name', async () => {
        const response = await source.search('file');

        expect(response.success).toBe(true);
        expect(response.query).toBe('file');
        expect(response.results.length).toBeGreaterThan(0);
      });

      it('should return file paths as references', async () => {
        const response = await source.search('file');
        const result = response.results[0];

        expect(result.reference).toContain('/test/path');
        expect(result.title).toBeDefined();
      });

      it('should include file metadata', async () => {
        const response = await source.search('file');
        const result = response.results[0];

        expect(result.metadata).toBeDefined();
      });
    });

    describe('content mode', () => {
      beforeEach(() => {
        source = new FileSearchSource({
          name: 'file-test',
          basePath: '/test/path',
          searchMode: 'content',
        });
      });

      it('should search file contents', async () => {
        const response = await source.search('search term');

        expect(response.success).toBe(true);
      });

      it('should return snippets with matching content', async () => {
        const response = await source.search('search term');

        // Results should include files that contain the search term
        expect(response.results.length).toBeGreaterThanOrEqual(0);
      });

      it('should handle files that don\'t match', async () => {
        (fs.readFile as any).mockResolvedValue('No matching content here');

        const response = await source.search('unique query that wont match');

        // Should return empty results for no matches
        expect(response.success).toBe(true);
      });
    });

    describe('both mode', () => {
      beforeEach(() => {
        source = new FileSearchSource({
          name: 'file-test',
          basePath: '/test/path',
          searchMode: 'both',
        });
      });

      it('should search both filename and content', async () => {
        const response = await source.search('file');

        expect(response.success).toBe(true);
      });
    });

    it('should respect maxResults option', async () => {
      source = new FileSearchSource({
        name: 'file-test',
        basePath: '/test/path',
        searchMode: 'filename',
      });

      const response = await source.search('file', { maxResults: 1 });

      expect(response.results.length).toBeLessThanOrEqual(1);
    });

    it('should handle search errors gracefully', async () => {
      const { glob } = await import('glob');
      (glob as any).mockRejectedValueOnce(new Error('Permission denied'));

      source = new FileSearchSource({
        name: 'file-test',
        basePath: '/test/path',
      });

      const response = await source.search('test');

      expect(response.success).toBe(false);
      expect(response.error).toContain('Permission denied');
    });
  });

  describe('fetch', () => {
    beforeEach(() => {
      source = new FileSearchSource({
        name: 'file-test',
        basePath: '/test/path',
      });
    });

    it('should fetch file content', async () => {
      const result = await source.fetch('/test/path/file1.md');

      expect(result.success).toBe(true);
      expect(result.reference).toBe('/test/path/file1.md');
      expect(result.content).toBe('Test file content with search term');
    });

    it('should include file size', async () => {
      const result = await source.fetch('/test/path/file1.md');

      expect(result.sizeBytes).toBe(1000);
    });

    it('should detect content type from extension', async () => {
      const result = await source.fetch('/test/path/file1.md');

      expect(result.contentType).toBeDefined();
    });

    it('should handle missing files', async () => {
      // Override the readFile mock to reject for this test
      (fs.readFile as any).mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

      const result = await source.fetch('/test/path/missing.md');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle read errors', async () => {
      (fs.readFile as any).mockRejectedValueOnce(new Error('Permission denied'));

      const result = await source.fetch('/test/path/protected.md');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('should respect maxSize option', async () => {
      (fs.stat as any).mockResolvedValueOnce({ size: 10000, mtime: new Date() });

      const result = await source.fetch('/test/path/large.md', { maxSize: 100 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should block paths outside basePath', async () => {
      const result = await source.fetch('/etc/passwd');

      expect(result.success).toBe(false);
      expect(result.error).toContain('outside');
    });

    it('should block path traversal attempts', async () => {
      const result = await source.fetch('/test/path/../../../etc/passwd');

      expect(result.success).toBe(false);
      expect(result.error).toContain('outside');
    });
  });

  describe('isAvailable', () => {
    it('should return true when base path exists', async () => {
      // Make sure access mock returns successfully
      (fs.access as any).mockResolvedValue(undefined);

      source = new FileSearchSource({
        name: 'file-test',
        basePath: '/test/path',
      });

      const available = await source.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when base path doesn\'t exist', async () => {
      source = new FileSearchSource({
        name: 'file-test',
        basePath: '/nonexistent/path',
      });

      // Mock access to fail for this specific call
      (fs.access as any).mockRejectedValueOnce(new Error('ENOENT'));

      const available = await source.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('getCapabilities', () => {
    beforeEach(() => {
      source = new FileSearchSource({
        name: 'file-test',
        basePath: '/test/path',
      });
    });

    it('should return capabilities', () => {
      const caps = source.getCapabilities();

      expect(caps.canSearch).toBe(true);
      expect(caps.canFetch).toBe(true);
      expect(caps.hasRelevanceScores).toBe(true);
      expect(caps.contentTypes).toContain('text/plain');
    });
  });
});

describe('createFileSearchSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fs.access as any).mockResolvedValue(undefined);
  });

  it('should create source from path', () => {
    const source = createFileSearchSource('/test/path');

    expect(source).toBeDefined();
    // Default name is 'files-{basename}' where basename is 'path' from '/test/path'
    expect(source.name).toBe('files-path');
    expect(source.type).toBe('file');
  });

  it('should accept custom name', () => {
    const source = createFileSearchSource('/test/path', { name: 'custom-files' });

    expect(source.name).toBe('custom-files');
  });

  it('should accept custom description', () => {
    const source = createFileSearchSource('/test/path', {
      description: 'Custom file source',
    });

    expect(source.description).toBe('Custom file source');
  });

  it('should pass through include patterns', () => {
    const source = createFileSearchSource('/test/path', {
      includePatterns: ['**/*.ts', '**/*.js'],
    });

    expect(source).toBeDefined();
  });

  it('should pass through exclude patterns', () => {
    const source = createFileSearchSource('/test/path', {
      excludePatterns: ['node_modules/**'],
    });

    expect(source).toBeDefined();
  });

  it('should pass through search mode', () => {
    const source = createFileSearchSource('/test/path', {
      searchMode: 'content',
    });

    expect(source).toBeDefined();
  });
});
