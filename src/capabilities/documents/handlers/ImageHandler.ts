/**
 * Image Handler
 *
 * Handles image formats: png, jpg, jpeg, gif, webp, svg.
 * Pass-through as base64 image pieces; SVG also included as text.
 */

import { DOCUMENT_DEFAULTS } from '../../../core/constants.js';
import type {
  IFormatHandler,
  DocumentFormat,
  DocumentReadOptions,
  DocumentPiece,
} from '../types.js';

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

export class ImageHandler implements IFormatHandler {
  readonly name = 'ImageHandler';
  readonly supportedFormats: DocumentFormat[] = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

  async handle(
    buffer: Buffer,
    filename: string,
    format: DocumentFormat,
    _options: DocumentReadOptions
  ): Promise<DocumentPiece[]> {
    const pieces: DocumentPiece[] = [];
    const mimeType = MIME_TYPES[format] || 'application/octet-stream';

    // Add image piece
    pieces.push({
      type: 'image',
      base64: buffer.toString('base64'),
      mimeType,
      metadata: {
        sourceFilename: filename,
        format,
        index: 0,
        sizeBytes: buffer.length,
        estimatedTokens: DOCUMENT_DEFAULTS.IMAGE_TOKENS_AUTO,
        label: filename,
      },
    });

    // For SVG, also add the text representation
    if (format === 'svg') {
      const svgText = buffer.toString('utf-8');
      const sizeBytes = Buffer.byteLength(svgText, 'utf-8');
      pieces.push({
        type: 'text',
        content: `\`\`\`svg\n${svgText}\n\`\`\``,
        metadata: {
          sourceFilename: filename,
          format,
          index: 1,
          section: 'SVG source',
          sizeBytes,
          estimatedTokens: Math.ceil(sizeBytes / DOCUMENT_DEFAULTS.CHARS_PER_TOKEN),
        },
      });
    }

    return pieces;
  }
}
