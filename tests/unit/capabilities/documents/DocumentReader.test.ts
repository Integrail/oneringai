/**
 * Unit tests for DocumentReader
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DocumentReader, mergeTextPieces } from '../../../../src/capabilities/documents/DocumentReader.js';

describe('DocumentReader', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `oneringai-docreader-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('should create a DocumentReader instance', () => {
      const reader = DocumentReader.create();
      expect(reader).toBeInstanceOf(DocumentReader);
    });

    it('should accept config with defaults', () => {
      const reader = DocumentReader.create({
        defaults: { maxTokens: 50_000 },
      });
      expect(reader).toBeInstanceOf(DocumentReader);
    });
  });

  describe('read - text files', () => {
    it('should read a plain text file', async () => {
      const filePath = join(testDir, 'hello.txt');
      await writeFile(filePath, 'Hello, World!');

      const reader = DocumentReader.create();
      const result = await reader.read({ type: 'file', path: filePath });

      expect(result.success).toBe(true);
      expect(result.pieces.length).toBeGreaterThan(0);
      expect(result.metadata.format).toBe('txt');
      expect(result.metadata.family).toBe('text');

      const text = mergeTextPieces(result.pieces);
      expect(text).toContain('Hello, World!');
    });

    it('should read a JSON file with code fence', async () => {
      const filePath = join(testDir, 'data.json');
      await writeFile(filePath, '{"key": "value"}');

      const reader = DocumentReader.create();
      const result = await reader.read(filePath);

      const text = mergeTextPieces(result.pieces);
      expect(text).toContain('```json');
      expect(text).toContain('"key": "value"');
    });

    it('should read a markdown file', async () => {
      const filePath = join(testDir, 'readme.md');
      await writeFile(filePath, '# Title\n\nSome content');

      const reader = DocumentReader.create();
      const result = await reader.read(filePath);

      const text = mergeTextPieces(result.pieces);
      expect(text).toContain('# Title');
      expect(text).toContain('Some content');
    });
  });

  describe('read - string source parsing', () => {
    it('should parse file paths from string', async () => {
      const filePath = join(testDir, 'test.txt');
      await writeFile(filePath, 'content');

      const reader = DocumentReader.create();
      const result = await reader.read(filePath);

      expect(result.success).toBe(true);
    });
  });

  describe('read - buffer source', () => {
    it('should read from buffer', async () => {
      const reader = DocumentReader.create();
      const result = await reader.read({
        type: 'buffer',
        buffer: Buffer.from('Buffer content'),
        filename: 'test.txt',
      });

      expect(result.success).toBe(true);
      const text = mergeTextPieces(result.pieces);
      expect(text).toContain('Buffer content');
    });

    it('should read from Uint8Array', async () => {
      const reader = DocumentReader.create();
      const result = await reader.read({
        type: 'buffer',
        buffer: new Uint8Array(Buffer.from('Array content')),
        filename: 'test.txt',
      });

      expect(result.success).toBe(true);
      const text = mergeTextPieces(result.pieces);
      expect(text).toContain('Array content');
    });
  });

  describe('read - image files', () => {
    it('should read an image file', async () => {
      const filePath = join(testDir, 'image.png');
      // Create a fake PNG large enough to pass the default image filter (>1024 bytes)
      const pngData = Buffer.alloc(2048, 0xFF);
      await writeFile(filePath, pngData);

      const reader = DocumentReader.create();
      const result = await reader.read(filePath, {
        imageFilter: { minSizeBytes: 0, minWidth: 0, minHeight: 0 },
      });

      expect(result.success).toBe(true);
      // Should have at least an image piece (header transformer adds a text piece too)
      const imagePieces = result.pieces.filter((p) => p.type === 'image');
      expect(imagePieces.length).toBeGreaterThanOrEqual(1);
    });

    it('should exclude images when extractImages is false', async () => {
      const filePath = join(testDir, 'image.png');
      await writeFile(filePath, Buffer.from('fake-png-data'));

      const reader = DocumentReader.create();
      const result = await reader.read(filePath, { extractImages: false });

      const imagePieces = result.pieces.filter((p) => p.type === 'image');
      expect(imagePieces.length).toBe(0);
    });
  });

  describe('read - CSV files', () => {
    it('should read a CSV file', async () => {
      const filePath = join(testDir, 'data.csv');
      await writeFile(filePath, 'Name,Age,City\nAlice,30,NYC\nBob,25,LA');

      const reader = DocumentReader.create();
      const result = await reader.read(filePath);

      expect(result.success).toBe(true);
      expect(result.metadata.format).toBe('csv');
      expect(result.metadata.family).toBe('spreadsheet');

      const text = mergeTextPieces(result.pieces);
      expect(text).toContain('Alice');
      expect(text).toContain('Bob');
    });
  });

  describe('read - HTML files', () => {
    it('should read an HTML file', async () => {
      const filePath = join(testDir, 'page.html');
      await writeFile(filePath, '<html><body><h1>Hello</h1><p>World</p></body></html>');

      const reader = DocumentReader.create();
      const result = await reader.read(filePath);

      expect(result.success).toBe(true);
      expect(result.metadata.format).toBe('html');

      const text = mergeTextPieces(result.pieces);
      expect(text).toContain('Hello');
    });
  });

  describe('read - options', () => {
    it('should apply maxTokens via truncation transformer', async () => {
      const filePath = join(testDir, 'large.txt');
      // 10000 chars ≈ 2500 tokens
      await writeFile(filePath, 'x'.repeat(10000));

      const reader = DocumentReader.create();
      const result = await reader.read(filePath, { maxTokens: 100 });

      expect(result.success).toBe(true);
      const text = mergeTextPieces(result.pieces);
      // Should be truncated to roughly 100 tokens = ~400 chars
      expect(text.length).toBeLessThan(1000);
    });

    it('should skip default transformers when requested', async () => {
      const filePath = join(testDir, 'test.txt');
      await writeFile(filePath, 'content');

      const reader = DocumentReader.create();
      const result = await reader.read(filePath, { skipDefaultTransformers: true });

      expect(result.success).toBe(true);
      // Without header transformer, first piece shouldn't start with "# Document:"
      const firstText = result.pieces.find((p) => p.type === 'text');
      if (firstText && firstText.type === 'text') {
        expect(firstText.content).not.toMatch(/^# Document:/);
      }
    });
  });

  describe('image filtering', () => {
    it('should filter small images by size', async () => {
      const reader = DocumentReader.create();
      const result = await reader.read({
        type: 'buffer',
        buffer: Buffer.from('tiny'),
        filename: 'tiny.png',
      }, {
        imageFilter: { minSizeBytes: 100000 },
      });

      // Image should be filtered out (buffer is only 4 bytes)
      const imagePieces = result.pieces.filter((p) => p.type === 'image');
      expect(imagePieces.length).toBe(0);
    });
  });

  describe('metadata', () => {
    it('should include processing time', async () => {
      const filePath = join(testDir, 'test.txt');
      await writeFile(filePath, 'content');

      const reader = DocumentReader.create();
      const result = await reader.read(filePath);

      expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should count pieces correctly', async () => {
      const filePath = join(testDir, 'test.txt');
      await writeFile(filePath, 'content');

      const reader = DocumentReader.create();
      const result = await reader.read(filePath);

      expect(result.metadata.totalPieces).toBe(result.pieces.length);
      expect(result.metadata.totalTextPieces).toBe(
        result.pieces.filter((p) => p.type === 'text').length
      );
      expect(result.metadata.totalImagePieces).toBe(
        result.pieces.filter((p) => p.type === 'image').length
      );
    });
  });

  describe('error handling', () => {
    it('should throw DocumentReadError for non-existent files', async () => {
      const reader = DocumentReader.create();

      await expect(
        reader.read('/nonexistent/path/file.txt')
      ).rejects.toThrow();
    });
  });
});

describe('mergeTextPieces', () => {
  it('should merge text pieces', () => {
    const pieces = [
      {
        type: 'text' as const,
        content: 'First',
        metadata: { sourceFilename: 'test.txt', format: 'txt' as const, index: 0, sizeBytes: 5, estimatedTokens: 1 },
      },
      {
        type: 'text' as const,
        content: 'Second',
        metadata: { sourceFilename: 'test.txt', format: 'txt' as const, index: 1, sizeBytes: 6, estimatedTokens: 1 },
      },
    ];

    expect(mergeTextPieces(pieces)).toBe('First\n\nSecond');
  });

  it('should skip image pieces', () => {
    const pieces = [
      {
        type: 'text' as const,
        content: 'Text',
        metadata: { sourceFilename: 'test.txt', format: 'txt' as const, index: 0, sizeBytes: 4, estimatedTokens: 1 },
      },
      {
        type: 'image' as const,
        base64: 'abc',
        mimeType: 'image/png',
        metadata: { sourceFilename: 'test.txt', format: 'txt' as const, index: 1, sizeBytes: 3, estimatedTokens: 765 },
      },
    ];

    expect(mergeTextPieces(pieces)).toBe('Text');
  });

  it('should handle empty array', () => {
    expect(mergeTextPieces([])).toBe('');
  });
});
