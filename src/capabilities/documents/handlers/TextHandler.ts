/**
 * Text Handler
 *
 * Handles plain text formats: txt, md, json, xml, yaml, yml.
 * No external dependencies needed.
 */

import { DOCUMENT_DEFAULTS } from '../../../core/constants.js';
import type {
  IFormatHandler,
  DocumentFormat,
  DocumentReadOptions,
  DocumentPiece,
} from '../types.js';

const CODE_FENCE_FORMATS: Record<string, string> = {
  json: 'json',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
};

export class TextHandler implements IFormatHandler {
  readonly name = 'TextHandler';
  readonly supportedFormats: DocumentFormat[] = ['txt', 'md', 'json', 'xml', 'yaml', 'yml'];

  async handle(
    buffer: Buffer,
    filename: string,
    format: DocumentFormat,
    _options: DocumentReadOptions
  ): Promise<DocumentPiece[]> {
    const text = buffer.toString('utf-8');
    const fenceLanguage = CODE_FENCE_FORMATS[format];

    const content = fenceLanguage
      ? `\`\`\`${fenceLanguage}\n${text}\n\`\`\``
      : text;

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
        },
      },
    ];
  }
}
