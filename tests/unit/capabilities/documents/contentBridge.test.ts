/**
 * Unit tests for Document Content Bridge
 */

import { describe, it, expect } from 'vitest';
import { documentToContent } from '../../../../src/utils/documentContentBridge.js';
import { ContentType } from '../../../../src/domain/entities/Content.js';
import type { DocumentResult, DocumentPiece } from '../../../../src/capabilities/documents/types.js';

function makeResult(pieces: DocumentPiece[]): DocumentResult {
  return {
    success: true,
    pieces,
    metadata: {
      filename: 'test.txt',
      format: 'txt',
      family: 'text',
      mimeType: 'text/plain',
      totalPieces: pieces.length,
      totalTextPieces: pieces.filter((p) => p.type === 'text').length,
      totalImagePieces: pieces.filter((p) => p.type === 'image').length,
      totalSizeBytes: 100,
      estimatedTokens: 25,
      processingTimeMs: 10,
    },
    warnings: [],
  };
}

function makeTextPiece(content: string, index: number = 0): DocumentPiece {
  return {
    type: 'text',
    content,
    metadata: {
      sourceFilename: 'test.txt',
      format: 'txt',
      index,
      sizeBytes: content.length,
      estimatedTokens: Math.ceil(content.length / 4),
    },
  };
}

function makeImagePiece(index: number = 0): DocumentPiece {
  return {
    type: 'image',
    base64: 'dGVzdA==', // "test" in base64
    mimeType: 'image/png',
    metadata: {
      sourceFilename: 'test.txt',
      format: 'txt',
      index,
      sizeBytes: 5000,
      estimatedTokens: 765,
    },
  };
}

describe('documentToContent', () => {
  it('should convert text pieces to InputTextContent', () => {
    const result = makeResult([makeTextPiece('Hello')]);
    const content = documentToContent(result);

    expect(content).toHaveLength(1);
    expect(content[0]!.type).toBe(ContentType.INPUT_TEXT);
    if (content[0]!.type === ContentType.INPUT_TEXT) {
      expect(content[0]!.text).toBe('Hello');
    }
  });

  it('should convert image pieces to InputImageContent', () => {
    const result = makeResult([makeImagePiece()]);
    const content = documentToContent(result);

    expect(content).toHaveLength(1);
    expect(content[0]!.type).toBe(ContentType.INPUT_IMAGE_URL);
    if (content[0]!.type === ContentType.INPUT_IMAGE_URL) {
      expect(content[0]!.image_url.url).toContain('data:image/png;base64,');
      expect(content[0]!.image_url.detail).toBe('auto');
    }
  });

  it('should merge adjacent text pieces by default', () => {
    const result = makeResult([
      makeTextPiece('First', 0),
      makeTextPiece('Second', 1),
    ]);
    const content = documentToContent(result);

    expect(content).toHaveLength(1);
    if (content[0]!.type === ContentType.INPUT_TEXT) {
      expect(content[0]!.text).toBe('First\n\nSecond');
    }
  });

  it('should not merge text pieces when mergeAdjacentText is false', () => {
    const result = makeResult([
      makeTextPiece('First', 0),
      makeTextPiece('Second', 1),
    ]);
    const content = documentToContent(result, { mergeAdjacentText: false });

    expect(content).toHaveLength(2);
  });

  it('should flush text before image', () => {
    const result = makeResult([
      makeTextPiece('Before image', 0),
      makeImagePiece(1),
      makeTextPiece('After image', 2),
    ]);
    const content = documentToContent(result);

    expect(content).toHaveLength(3);
    expect(content[0]!.type).toBe(ContentType.INPUT_TEXT);
    expect(content[1]!.type).toBe(ContentType.INPUT_IMAGE_URL);
    expect(content[2]!.type).toBe(ContentType.INPUT_TEXT);
  });

  it('should limit number of images', () => {
    const pieces: DocumentPiece[] = [];
    for (let i = 0; i < 30; i++) {
      pieces.push(makeImagePiece(i));
    }
    const result = makeResult(pieces);
    const content = documentToContent(result, { maxImages: 5 });

    const imageCount = content.filter((c) => c.type === ContentType.INPUT_IMAGE_URL).length;
    expect(imageCount).toBe(5);
  });

  it('should apply image detail setting', () => {
    const result = makeResult([makeImagePiece()]);
    const content = documentToContent(result, { imageDetail: 'low' });

    if (content[0]!.type === ContentType.INPUT_IMAGE_URL) {
      expect(content[0]!.image_url.detail).toBe('low');
    }
  });

  it('should filter images by size', () => {
    const smallImage: DocumentPiece = {
      type: 'image',
      base64: 'abc',
      mimeType: 'image/png',
      metadata: {
        sourceFilename: 'test.txt',
        format: 'txt',
        index: 0,
        sizeBytes: 50, // very small
        estimatedTokens: 765,
      },
    };

    const result = makeResult([smallImage]);
    const content = documentToContent(result, {
      imageFilter: { minSizeBytes: 1000 },
    });

    const imageCount = content.filter((c) => c.type === ContentType.INPUT_IMAGE_URL).length;
    expect(imageCount).toBe(0);
  });

  it('should filter images by dimensions', () => {
    const tinyImage: DocumentPiece = {
      type: 'image',
      base64: 'abc',
      mimeType: 'image/png',
      width: 10,
      height: 10,
      metadata: {
        sourceFilename: 'test.txt',
        format: 'txt',
        index: 0,
        sizeBytes: 5000,
        estimatedTokens: 765,
      },
    };

    const result = makeResult([tinyImage]);
    const content = documentToContent(result, {
      imageFilter: { minWidth: 50, minHeight: 50 },
    });

    expect(content.filter((c) => c.type === ContentType.INPUT_IMAGE_URL)).toHaveLength(0);
  });

  it('should handle empty result', () => {
    const result = makeResult([]);
    const content = documentToContent(result);
    expect(content).toHaveLength(0);
  });
});
