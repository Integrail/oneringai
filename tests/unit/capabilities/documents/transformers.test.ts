/**
 * Unit tests for Document Transformers
 */

import { describe, it, expect } from 'vitest';
import {
  documentHeaderTransformer,
  tableFormattingTransformer,
  truncationTransformer,
  getDefaultTransformers,
} from '../../../../src/capabilities/documents/transformers/DefaultTransformers.js';
import type {
  DocumentPiece,
  TransformerContext,
} from '../../../../src/capabilities/documents/types.js';

function makeContext(overrides: Partial<TransformerContext> = {}): TransformerContext {
  return {
    filename: 'test.txt',
    format: 'txt',
    family: 'text',
    options: {},
    ...overrides,
  };
}

function makeTextPiece(content: string, index: number = 0): DocumentPiece {
  const sizeBytes = Buffer.byteLength(content, 'utf-8');
  return {
    type: 'text',
    content,
    metadata: {
      sourceFilename: 'test.txt',
      format: 'txt',
      index,
      sizeBytes,
      estimatedTokens: Math.ceil(sizeBytes / 4),
    },
  };
}

describe('documentHeaderTransformer', () => {
  it('should prepend document header', async () => {
    const pieces = [makeTextPiece('Hello')];
    const result = await documentHeaderTransformer.transform(pieces, makeContext());

    expect(result.length).toBe(2);
    expect(result[0]!.type).toBe('text');
    if (result[0]!.type === 'text') {
      expect(result[0]!.content).toContain('# Document: test.txt');
      expect(result[0]!.content).toContain('TXT');
    }
  });

  it('should re-index pieces after prepending', async () => {
    const pieces = [makeTextPiece('A', 0), makeTextPiece('B', 1)];
    const result = await documentHeaderTransformer.transform(pieces, makeContext());

    expect(result[0]!.metadata.index).toBe(0); // header
    expect(result[1]!.metadata.index).toBe(1); // original A
    expect(result[2]!.metadata.index).toBe(2); // original B
  });

  it('should not modify empty pieces', async () => {
    const result = await documentHeaderTransformer.transform([], makeContext());
    expect(result.length).toBe(0);
  });

  it('should show human-readable size', async () => {
    // Large content to show MB
    const content = 'x'.repeat(2 * 1024 * 1024); // 2MB
    const pieces = [makeTextPiece(content)];
    const result = await documentHeaderTransformer.transform(pieces, makeContext());

    if (result[0]!.type === 'text') {
      expect(result[0]!.content).toContain('MB');
    }
  });
});

describe('tableFormattingTransformer', () => {
  it('should apply only to xlsx and csv', () => {
    expect(tableFormattingTransformer.appliesTo).toContain('xlsx');
    expect(tableFormattingTransformer.appliesTo).toContain('csv');
    expect(tableFormattingTransformer.appliesTo).not.toContain('txt');
  });

  it('should normalize markdown table', async () => {
    const table = '| A | B |\n| --- | --- |\n| short | much longer value |';
    const pieces = [makeTextPiece(table)];
    const ctx = makeContext({ format: 'xlsx' });
    const result = await tableFormattingTransformer.transform(pieces, ctx);

    // Should still be a valid table
    if (result[0]!.type === 'text') {
      expect(result[0]!.content).toContain('|');
      expect(result[0]!.content.split('\n').length).toBeGreaterThanOrEqual(3);
    }
  });

  it('should pass through non-table content', async () => {
    const pieces = [makeTextPiece('Just regular text')];
    const ctx = makeContext({ format: 'xlsx' });
    const result = await tableFormattingTransformer.transform(pieces, ctx);

    if (result[0]!.type === 'text') {
      expect(result[0]!.content).toBe('Just regular text');
    }
  });
});

describe('truncationTransformer', () => {
  it('should truncate when exceeding maxTokens', async () => {
    // 4000 chars ≈ 1000 tokens
    const longContent = 'word '.repeat(800); // ~4000 chars
    const pieces = [makeTextPiece(longContent)];
    const ctx = makeContext({ options: { maxTokens: 100 } });
    const result = await truncationTransformer.transform(pieces, ctx);

    const totalTokens = result.reduce((sum, p) => sum + p.metadata.estimatedTokens, 0);
    expect(totalTokens).toBeLessThan(200); // should be truncated near 100
  });

  it('should not truncate small content', async () => {
    const pieces = [makeTextPiece('Small content')];
    const ctx = makeContext({ options: { maxTokens: 100000 } });
    const result = await truncationTransformer.transform(pieces, ctx);

    expect(result.length).toBe(1);
    if (result[0]!.type === 'text') {
      expect(result[0]!.content).toBe('Small content');
    }
  });

  it('should drop extra pieces that exceed limit', async () => {
    const pieces = [
      makeTextPiece('a'.repeat(400000), 0), // ~100K tokens
      makeTextPiece('second piece', 1),
    ];
    const ctx = makeContext({ options: { maxTokens: 50000 } });
    const result = await truncationTransformer.transform(pieces, ctx);

    // Second piece should be dropped
    expect(result.length).toBe(1);
  });
});

describe('getDefaultTransformers', () => {
  it('should return all three default transformers', () => {
    const transformers = getDefaultTransformers();
    expect(transformers).toHaveLength(3);
  });

  it('should have correct priorities', () => {
    const transformers = getDefaultTransformers();
    const priorities = transformers.map((t) => t.priority);
    expect(priorities).toContain(10);   // header
    expect(priorities).toContain(50);   // table
    expect(priorities).toContain(1000); // truncation
  });
});
