/**
 * HTML Handler
 *
 * Wraps existing htmlToMarkdown() utility.
 * No additional dependencies needed.
 */

import { DOCUMENT_DEFAULTS } from '../../../core/constants.js';
import { htmlToMarkdown } from '../../../tools/web/htmlToMarkdown.js';
import type {
  IFormatHandler,
  DocumentFormat,
  DocumentReadOptions,
  DocumentPiece,
} from '../types.js';

export class HTMLHandler implements IFormatHandler {
  readonly name = 'HTMLHandler';
  readonly supportedFormats: DocumentFormat[] = ['html'];

  async handle(
    buffer: Buffer,
    filename: string,
    format: DocumentFormat,
    options: DocumentReadOptions
  ): Promise<DocumentPiece[]> {
    const html = buffer.toString('utf-8');
    const maxLength = options.formatOptions?.html?.maxLength ?? DOCUMENT_DEFAULTS.MAX_HTML_LENGTH;

    const result = await htmlToMarkdown(html, `file://${filename}`, maxLength);

    const content = result.markdown;
    const sizeBytes = Buffer.byteLength(content, 'utf-8');

    return [
      {
        type: 'text',
        content,
        metadata: {
          sourceFilename: filename,
          format,
          index: 0,
          sizeBytes,
          estimatedTokens: Math.ceil(sizeBytes / DOCUMENT_DEFAULTS.CHARS_PER_TOKEN),
          label: result.title || undefined,
        },
      },
    ];
  }
}
