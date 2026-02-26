/**
 * PDF Handler
 *
 * Handles PDF format using unpdf (lazy-loaded).
 * Extracts text per page and optionally images.
 */

import { DOCUMENT_DEFAULTS } from '../../../core/constants.js';
import type {
  IFormatHandler,
  DocumentFormat,
  DocumentReadOptions,
  DocumentPiece,
} from '../types.js';

// Lazy-loaded unpdf functions
let unpdfModule: {
  extractText: (data: any, options?: any) => Promise<any>;
  extractImages: (data: any, options?: any) => Promise<any>;
  getMeta: (data: any) => Promise<any>;
} | null = null;

async function getUnpdf() {
  if (!unpdfModule) {
    const mod = await import('unpdf');
    unpdfModule = {
      extractText: mod.extractText,
      extractImages: mod.extractImages,
      getMeta: mod.getMeta,
    };
  }
  return unpdfModule;
}

export class PDFHandler implements IFormatHandler {
  readonly name = 'PDFHandler';
  readonly supportedFormats: DocumentFormat[] = ['pdf'];

  async handle(
    buffer: Buffer,
    filename: string,
    format: DocumentFormat,
    options: DocumentReadOptions
  ): Promise<DocumentPiece[]> {
    const unpdf = await getUnpdf();
    const pieces: DocumentPiece[] = [];
    let pieceIndex = 0;

    // unpdf wraps pdf.js which transfers ArrayBuffers to workers via postMessage().
    // Node.js Buffer uses a shared/pooled ArrayBuffer that can't be transferred.
    // new Uint8Array(buffer) copies into a fresh standalone ArrayBuffer.
    const data = new Uint8Array(buffer);

    // Extract metadata
    let metadata: any = {};
    const includeMetadata = options.formatOptions?.pdf?.includeMetadata !== false;
    if (includeMetadata) {
      try {
        metadata = await unpdf.getMeta(data);
      } catch {
        // Metadata extraction failed, continue without
      }
    }

    // Extract text (per page)
    const textResult = await unpdf.extractText(data, { mergePages: false });
    const pages: string[] = textResult?.pages || textResult?.text
      ? (Array.isArray(textResult.text) ? textResult.text : [textResult.text])
      : [];

    // Filter to requested pages
    const requestedPages = options.pages;
    const pageEntries = pages.map((text: string, i: number) => ({ text, pageNum: i + 1 }));

    const filteredPages = requestedPages && requestedPages.length > 0
      ? pageEntries.filter((p) =>
          requestedPages.some((rp) => {
            const num = typeof rp === 'string' ? parseInt(rp, 10) : rp;
            return num === p.pageNum;
          })
        )
      : pageEntries;

    // Add metadata piece if available
    if (includeMetadata && metadata?.info) {
      const metaParts: string[] = [];
      if (metadata.info.Title) metaParts.push(`**Title:** ${metadata.info.Title}`);
      if (metadata.info.Author) metaParts.push(`**Author:** ${metadata.info.Author}`);
      if (metadata.info.Subject) metaParts.push(`**Subject:** ${metadata.info.Subject}`);
      if (metadata.info.Creator) metaParts.push(`**Creator:** ${metadata.info.Creator}`);
      if (pages.length) metaParts.push(`**Pages:** ${pages.length}`);

      if (metaParts.length > 0) {
        const metaContent = metaParts.join('\n');
        const sizeBytes = Buffer.byteLength(metaContent, 'utf-8');
        pieces.push({
          type: 'text',
          content: metaContent,
          metadata: {
            sourceFilename: filename,
            format,
            index: pieceIndex++,
            section: 'Metadata',
            sizeBytes,
            estimatedTokens: Math.ceil(sizeBytes / DOCUMENT_DEFAULTS.CHARS_PER_TOKEN),
          },
        });
      }
    }

    // Add text pieces per page
    for (const page of filteredPages) {
      const text = page.text.trim();
      if (!text) continue;

      const sizeBytes = Buffer.byteLength(text, 'utf-8');
      pieces.push({
        type: 'text',
        content: text,
        metadata: {
          sourceFilename: filename,
          format,
          index: pieceIndex++,
          section: `Page ${page.pageNum}`,
          sizeBytes,
          estimatedTokens: Math.ceil(sizeBytes / DOCUMENT_DEFAULTS.CHARS_PER_TOKEN),
        },
      });
    }

    // Extract images if requested
    if (options.extractImages !== false) {
      try {
        const imagesResult = await unpdf.extractImages(data, {});
        const images: any[] = imagesResult?.images || [];

        for (const img of images) {
          if (!img.data) continue;

          const base64 = typeof img.data === 'string'
            ? img.data
            : Buffer.from(img.data).toString('base64');
          const sizeBytes = Math.ceil(base64.length * 0.75);

          pieces.push({
            type: 'image',
            base64,
            mimeType: img.mimeType || 'image/png',
            width: img.width,
            height: img.height,
            metadata: {
              sourceFilename: filename,
              format,
              index: pieceIndex++,
              sizeBytes,
              estimatedTokens: DOCUMENT_DEFAULTS.IMAGE_TOKENS_AUTO,
              label: img.name || undefined,
            },
          });
        }
      } catch {
        // Image extraction failed, continue without images
      }
    }

    return pieces;
  }
}
