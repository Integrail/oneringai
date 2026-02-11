/**
 * Format Detector
 *
 * Detects document format from filename extension and optional magic bytes.
 */

import type { DocumentFormat, DocumentFamily, FormatDetectionResult } from './types.js';

// Extension → format mapping
const EXTENSION_MAP: Record<string, { format: DocumentFormat; family: DocumentFamily; mimeType: string }> = {
  // Office
  '.docx': { format: 'docx', family: 'office', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  '.pptx': { format: 'pptx', family: 'office', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  '.odt': { format: 'odt', family: 'office', mimeType: 'application/vnd.oasis.opendocument.text' },
  '.odp': { format: 'odp', family: 'office', mimeType: 'application/vnd.oasis.opendocument.presentation' },
  '.ods': { format: 'ods', family: 'office', mimeType: 'application/vnd.oasis.opendocument.spreadsheet' },
  '.rtf': { format: 'rtf', family: 'office', mimeType: 'application/rtf' },
  // Spreadsheet
  '.xlsx': { format: 'xlsx', family: 'spreadsheet', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  '.csv': { format: 'csv', family: 'spreadsheet', mimeType: 'text/csv' },
  // PDF
  '.pdf': { format: 'pdf', family: 'pdf', mimeType: 'application/pdf' },
  // HTML
  '.html': { format: 'html', family: 'html', mimeType: 'text/html' },
  '.htm': { format: 'html', family: 'html', mimeType: 'text/html' },
  // Text
  '.txt': { format: 'txt', family: 'text', mimeType: 'text/plain' },
  '.md': { format: 'md', family: 'text', mimeType: 'text/markdown' },
  '.json': { format: 'json', family: 'text', mimeType: 'application/json' },
  '.xml': { format: 'xml', family: 'text', mimeType: 'application/xml' },
  '.yaml': { format: 'yaml', family: 'text', mimeType: 'application/yaml' },
  '.yml': { format: 'yml', family: 'text', mimeType: 'application/yaml' },
  // Image
  '.png': { format: 'png', family: 'image', mimeType: 'image/png' },
  '.jpg': { format: 'jpg', family: 'image', mimeType: 'image/jpeg' },
  '.jpeg': { format: 'jpeg', family: 'image', mimeType: 'image/jpeg' },
  '.gif': { format: 'gif', family: 'image', mimeType: 'image/gif' },
  '.webp': { format: 'webp', family: 'image', mimeType: 'image/webp' },
  '.svg': { format: 'svg', family: 'image', mimeType: 'image/svg+xml' },
};

// MIME type → format mapping (for Content-Type detection)
const MIME_MAP: Record<string, { format: DocumentFormat; family: DocumentFamily }> = {
  'application/pdf': { format: 'pdf', family: 'pdf' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { format: 'docx', family: 'office' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { format: 'pptx', family: 'office' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { format: 'xlsx', family: 'spreadsheet' },
  'application/vnd.oasis.opendocument.text': { format: 'odt', family: 'office' },
  'application/vnd.oasis.opendocument.presentation': { format: 'odp', family: 'office' },
  'application/vnd.oasis.opendocument.spreadsheet': { format: 'ods', family: 'office' },
  'application/rtf': { format: 'rtf', family: 'office' },
  'text/rtf': { format: 'rtf', family: 'office' },
  'text/csv': { format: 'csv', family: 'spreadsheet' },
  'application/csv': { format: 'csv', family: 'spreadsheet' },
};

// Binary formats that readFile shouldn't try to read as UTF-8
const BINARY_DOCUMENT_EXTENSIONS = new Set([
  '.docx', '.pptx', '.xlsx',
  '.odt', '.odp', '.ods',
  '.pdf',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
]);

/**
 * Static utility for detecting document formats
 */
export class FormatDetector {
  /**
   * Detect format from filename and optional buffer
   */
  static detect(filename: string, _buffer?: Buffer | Uint8Array): FormatDetectionResult {
    const ext = FormatDetector.getExtension(filename);
    const entry = EXTENSION_MAP[ext];

    if (!entry) {
      // Default to text for unknown extensions
      return {
        format: 'txt',
        family: 'text',
        mimeType: 'text/plain',
        confidence: 'low',
      };
    }

    return {
      format: entry.format,
      family: entry.family,
      mimeType: entry.mimeType,
      confidence: 'high',
    };
  }

  /**
   * Check if an extension is a supported document format
   * Used by readFile to detect when to use DocumentReader
   */
  static isDocumentFormat(ext: string): boolean {
    const normalizedExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    return normalizedExt in EXTENSION_MAP;
  }

  /**
   * Check if an extension is a binary document format
   * (i.e., cannot be read as UTF-8)
   */
  static isBinaryDocumentFormat(ext: string): boolean {
    const normalizedExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    return BINARY_DOCUMENT_EXTENSIONS.has(normalizedExt);
  }

  /**
   * Check if a Content-Type header indicates a document format
   * Used by webFetch to detect downloadable documents
   */
  static isDocumentMimeType(contentType: string): boolean {
    // Extract MIME type before parameters (e.g., charset)
    const mime = (contentType.split(';')[0] ?? '').trim().toLowerCase();
    return mime in MIME_MAP;
  }

  /**
   * Detect format from Content-Type header
   */
  static detectFromMimeType(contentType: string): FormatDetectionResult | null {
    const mime = (contentType.split(';')[0] ?? '').trim().toLowerCase();
    const entry = MIME_MAP[mime];
    if (!entry) return null;

    const extEntry = Object.values(EXTENSION_MAP).find(
      (e) => e.format === entry.format
    );

    return {
      format: entry.format,
      family: entry.family,
      mimeType: extEntry?.mimeType || mime,
      confidence: 'high',
    };
  }

  /**
   * Get all supported document extensions
   */
  static getSupportedExtensions(): string[] {
    return Object.keys(EXTENSION_MAP);
  }

  /**
   * Get the normalized extension from a filename
   */
  static getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1 || lastDot === filename.length - 1) return '';
    return filename.slice(lastDot).toLowerCase();
  }
}
