/**
 * Default Document Transformers
 *
 * Built-in transformers that run on every document read:
 * 1. documentHeaderTransformer - Prepends document header
 * 2. tableFormattingTransformer - Normalizes markdown tables
 * 3. truncationTransformer - Enforces token limits
 */

import { DOCUMENT_DEFAULTS } from '../../../core/constants.js';
import type {
  IDocumentTransformer,
  DocumentPiece,
  DocumentTextPiece,
  TransformerContext,
  DocumentFormat,
} from '../types.js';

/**
 * Prepends a document header with filename, format, and size info
 */
export const documentHeaderTransformer: IDocumentTransformer = {
  name: 'documentHeaderTransformer',
  appliesTo: [], // applies to all formats
  priority: 10,

  async transform(pieces: DocumentPiece[], context: TransformerContext): Promise<DocumentPiece[]> {
    if (pieces.length === 0) return pieces;

    const totalSize = pieces.reduce((sum, p) => sum + p.metadata.sizeBytes, 0);
    const sizeStr = totalSize > 1024 * 1024
      ? `${(totalSize / 1024 / 1024).toFixed(1)}MB`
      : `${(totalSize / 1024).toFixed(1)}KB`;

    const header = `# Document: ${context.filename}\n_Format: ${context.format.toUpperCase()} | Size: ${sizeStr}_`;
    const headerBytes = Buffer.byteLength(header, 'utf-8');

    const headerPiece: DocumentTextPiece = {
      type: 'text',
      content: header,
      metadata: {
        sourceFilename: context.filename,
        format: context.format,
        index: -1, // will be re-indexed
        section: 'Header',
        sizeBytes: headerBytes,
        estimatedTokens: Math.ceil(headerBytes / DOCUMENT_DEFAULTS.CHARS_PER_TOKEN),
      },
    };

    // Re-index all pieces
    const result = [headerPiece, ...pieces];
    result.forEach((p, i) => {
      p.metadata.index = i;
    });

    return result;
  },
};

/**
 * Normalizes markdown table alignment for spreadsheet formats
 */
export const tableFormattingTransformer: IDocumentTransformer = {
  name: 'tableFormattingTransformer',
  appliesTo: ['xlsx', 'csv'] as DocumentFormat[],
  priority: 50,

  async transform(pieces: DocumentPiece[], _context: TransformerContext): Promise<DocumentPiece[]> {
    return pieces.map((piece) => {
      if (piece.type !== 'text') return piece;

      // Normalize table column widths for better readability
      let content = piece.content;

      // Find markdown tables and normalize them
      content = content.replace(
        /(\|[^\n]+\|\n\|[\s\-:|]+\|\n(?:\|[^\n]+\|\n?)*)/g,
        (table) => normalizeTable(table)
      );

      if (content === piece.content) return piece;

      const sizeBytes = Buffer.byteLength(content, 'utf-8');
      return {
        ...piece,
        content,
        metadata: {
          ...piece.metadata,
          sizeBytes,
          estimatedTokens: Math.ceil(sizeBytes / DOCUMENT_DEFAULTS.CHARS_PER_TOKEN),
        },
      };
    });
  },
};

/**
 * Normalize a markdown table's column widths
 */
function normalizeTable(table: string): string {
  const lines = table.trim().split('\n');
  if (lines.length < 2) return table;

  // Parse columns
  const rows = lines.map((line) =>
    line
      .split('|')
      .slice(1, -1) // remove empty first/last from leading/trailing |
      .map((cell) => cell.trim())
  );

  // Calculate max column widths
  const colCount = Math.max(...rows.map((r) => r.length));
  const colWidths = new Array(colCount).fill(3); // minimum 3 for ---

  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      // Skip separator row for width calculation
      const cell = row[i] ?? '';
      if (cell.match(/^[-:]+$/)) continue;
      colWidths[i] = Math.max(colWidths[i] ?? 3, cell.length);
    }
  }

  // Rebuild table with aligned columns
  const result = rows.map((row, rowIndex) => {
    const cells = [];
    for (let i = 0; i < colCount; i++) {
      const cell = row[i] || '';
      if (rowIndex === 1) {
        // Separator row
        cells.push('-'.repeat(colWidths[i]));
      } else {
        cells.push(cell.padEnd(colWidths[i]));
      }
    }
    return `| ${cells.join(' | ')} |`;
  });

  return result.join('\n');
}

/**
 * Enforces maxTokens limit by truncating at paragraph boundaries
 */
export const truncationTransformer: IDocumentTransformer = {
  name: 'truncationTransformer',
  appliesTo: [], // applies to all formats
  priority: 1000, // runs last

  async transform(pieces: DocumentPiece[], context: TransformerContext): Promise<DocumentPiece[]> {
    const maxTokens = context.options.maxTokens ?? DOCUMENT_DEFAULTS.MAX_OUTPUT_TOKENS;
    const maxBytes = context.options.maxOutputBytes ?? DOCUMENT_DEFAULTS.MAX_OUTPUT_BYTES;

    let totalTokens = 0;
    let totalBytes = 0;
    const result: DocumentPiece[] = [];

    for (const piece of pieces) {
      totalTokens += piece.metadata.estimatedTokens;
      totalBytes += piece.metadata.sizeBytes;

      if (totalTokens > maxTokens || totalBytes > maxBytes) {
        // Need to truncate
        if (piece.type === 'text') {
          const remainingTokens = maxTokens - (totalTokens - piece.metadata.estimatedTokens);
          const remainingChars = remainingTokens * DOCUMENT_DEFAULTS.CHARS_PER_TOKEN;

          if (remainingChars > 100) {
            // Truncate at paragraph boundary
            const content = piece.content;
            const truncateAt = content.lastIndexOf('\n\n', remainingChars);
            const cutPoint = truncateAt > remainingChars * 0.3 ? truncateAt : remainingChars;
            const truncated = content.slice(0, cutPoint) + '\n\n..._[content truncated]_';

            const sizeBytes = Buffer.byteLength(truncated, 'utf-8');
            result.push({
              ...piece,
              content: truncated,
              metadata: {
                ...piece.metadata,
                sizeBytes,
                estimatedTokens: Math.ceil(sizeBytes / DOCUMENT_DEFAULTS.CHARS_PER_TOKEN),
              },
            });
          }
        }
        // Drop remaining pieces (images counted against limit too)
        break;
      }

      result.push(piece);
    }

    return result;
  },
};

/**
 * Get all default transformers
 */
export function getDefaultTransformers(): IDocumentTransformer[] {
  return [
    documentHeaderTransformer,
    tableFormattingTransformer,
    truncationTransformer,
  ];
}
