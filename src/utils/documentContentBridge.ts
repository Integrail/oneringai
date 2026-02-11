/**
 * Document Content Bridge
 *
 * Converts DocumentResult → Content[] for LLM consumption.
 * Provides readDocumentAsContent() as a one-call convenience.
 */

import { ContentType } from '../domain/entities/Content.js';
import type { Content, InputTextContent, InputImageContent } from '../domain/entities/Content.js';
import { DocumentReader } from '../capabilities/documents/DocumentReader.js';
import type {
  DocumentResult,
  DocumentSource,
  DocumentReadOptions,
  DocumentToContentOptions,
} from '../capabilities/documents/types.js';

/**
 * Convert a DocumentResult to Content[] for LLM input.
 *
 * - Text pieces → InputTextContent
 * - Image pieces → InputImageContent (with data URI)
 * - Adjacent text pieces merged by default
 * - Additional image filtering applied
 */
export function documentToContent(
  result: DocumentResult,
  options: DocumentToContentOptions = {}
): Content[] {
  const {
    imageDetail = 'auto',
    imageFilter,
    maxImages = 20,
    mergeAdjacentText = true,
  } = options;

  const minWidth = imageFilter?.minWidth ?? 0;
  const minHeight = imageFilter?.minHeight ?? 0;
  const minSizeBytes = imageFilter?.minSizeBytes ?? 0;
  const excludePatterns = imageFilter?.excludePatterns ?? [];

  const contents: Content[] = [];
  let imageCount = 0;
  let pendingText: string[] = [];

  const flushText = () => {
    if (pendingText.length > 0) {
      const text: InputTextContent = {
        type: ContentType.INPUT_TEXT,
        text: pendingText.join('\n\n'),
      };
      contents.push(text);
      pendingText = [];
    }
  };

  for (const piece of result.pieces) {
    if (piece.type === 'text') {
      if (mergeAdjacentText) {
        pendingText.push(piece.content);
      } else {
        const text: InputTextContent = {
          type: ContentType.INPUT_TEXT,
          text: piece.content,
        };
        contents.push(text);
      }
    } else if (piece.type === 'image') {
      // Apply image filtering
      if (piece.width !== undefined && piece.width < minWidth) continue;
      if (piece.height !== undefined && piece.height < minHeight) continue;
      if (piece.metadata.sizeBytes < minSizeBytes) continue;

      const label = piece.metadata.label || '';
      if (excludePatterns.some((p) => p.test(label))) continue;

      imageCount++;
      if (imageCount > maxImages) continue;

      // Flush pending text before inserting image
      flushText();

      const imageContent: InputImageContent = {
        type: ContentType.INPUT_IMAGE_URL,
        image_url: {
          url: `data:${piece.mimeType};base64,${piece.base64}`,
          detail: imageDetail,
        },
      };
      contents.push(imageContent);
    }
  }

  // Flush remaining text
  flushText();

  return contents;
}

/**
 * One-call convenience: read a document and convert to Content[] for LLM input.
 *
 * @example
 * ```typescript
 * const content = await readDocumentAsContent('/path/to/doc.pdf', {
 *   imageFilter: { minWidth: 100, minHeight: 100 },
 *   imageDetail: 'auto',
 * });
 *
 * agent.run([
 *   { type: 'input_text', text: 'Analyze this document:' },
 *   ...content,
 * ]);
 * ```
 */
export async function readDocumentAsContent(
  source: DocumentSource | string,
  options: DocumentReadOptions & DocumentToContentOptions = {}
): Promise<Content[]> {
  // Split options into read options and content options
  const {
    imageDetail,
    maxImages,
    mergeAdjacentText,
    // imageFilter is shared between both
    ...readOptions
  } = options;

  const contentOptions: DocumentToContentOptions = {
    imageDetail,
    imageFilter: options.imageFilter,
    maxImages,
    mergeAdjacentText,
  };

  const reader = DocumentReader.create();
  const result = await reader.read(source, readOptions);

  if (!result.success) {
    // Return error as text content
    return [
      {
        type: ContentType.INPUT_TEXT,
        text: `[Document read error: ${result.error || 'Unknown error'}]`,
      },
    ];
  }

  return documentToContent(result, contentOptions);
}
