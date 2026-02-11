/**
 * Document Reader
 *
 * Universal file-to-LLM-content converter.
 * Reads arbitrary formats and produces DocumentPiece arrays.
 */

import { readFile as fsReadFile } from 'node:fs/promises';
import { DOCUMENT_DEFAULTS } from '../../core/constants.js';
import { DocumentReadError, UnsupportedFormatError } from '../../domain/errors/AIErrors.js';
import { FormatDetector } from './FormatDetector.js';
import type {
  DocumentSource,
  DocumentResult,
  DocumentReadOptions,
  DocumentReaderConfig,
  DocumentPiece,
  DocumentImagePiece,
  DocumentMetadata,
  DocumentFamily,
  IFormatHandler,
  IDocumentTransformer,
  TransformerContext,
  ImageFilterOptions,
} from './types.js';

/**
 * Main document reader class.
 *
 * @example
 * ```typescript
 * const reader = DocumentReader.create();
 * const result = await reader.read('/path/to/doc.pdf');
 * console.log(result.pieces); // DocumentPiece[]
 * ```
 */
export class DocumentReader {
  private handlers: Map<DocumentFamily, IFormatHandler>;
  private config: DocumentReaderConfig;

  private constructor(config: DocumentReaderConfig = {}) {
    this.config = config;
    this.handlers = config.handlers ? new Map(config.handlers) : new Map();
  }

  /**
   * Create a new DocumentReader instance
   */
  static create(config: DocumentReaderConfig = {}): DocumentReader {
    const reader = new DocumentReader(config);
    reader.registerDefaultHandlers();
    return reader;
  }

  /**
   * Register all default format handlers (lazy-loaded)
   */
  private registerDefaultHandlers(): void {
    // Import default handlers on first use (they self-register)
    // Handlers are loaded lazily in getHandler() to avoid loading unused deps
  }

  /**
   * Register a custom format handler
   */
  registerHandler(family: DocumentFamily, handler: IFormatHandler): void {
    this.handlers.set(family, handler);
  }

  /**
   * Read a document from any source
   */
  async read(
    source: DocumentSource | string,
    options: DocumentReadOptions = {}
  ): Promise<DocumentResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    // Merge with default options
    const mergedOptions: DocumentReadOptions = {
      ...this.config.defaults,
      ...options,
      formatOptions: {
        ...this.config.defaults?.formatOptions,
        ...options.formatOptions,
      },
      imageFilter: {
        ...this.config.defaults?.imageFilter,
        ...options.imageFilter,
      },
    };

    try {
      // 1. Resolve source to buffer + filename
      const { buffer, filename } = await this.resolveSource(
        typeof source === 'string' ? this.parseStringSource(source) : source
      );

      // 2. Detect format
      const detection = FormatDetector.detect(filename, buffer);

      // 3. Get handler for format family
      const handler = await this.getHandler(detection.family);
      if (!handler) {
        throw new UnsupportedFormatError(detection.format, detection.family);
      }

      // 4. Run handler
      let pieces = await handler.handle(buffer, filename, detection.format, mergedOptions);

      // 5. Filter images
      if (mergedOptions.extractImages !== false) {
        pieces = this.filterImages(pieces, mergedOptions.imageFilter);
      } else {
        // Remove all image pieces if extractImages is false
        pieces = pieces.filter((p) => p.type !== 'image');
      }

      // 6. Run transformer pipeline
      const transformerContext: TransformerContext = {
        filename,
        format: detection.format,
        family: detection.family,
        options: mergedOptions,
      };
      pieces = await this.runTransformers(pieces, transformerContext, mergedOptions);

      // 7. Assemble result
      const metadata = this.assembleMetadata(pieces, filename, detection, startTime);

      return {
        success: true,
        pieces,
        metadata,
        warnings,
      };
    } catch (error) {
      if (error instanceof DocumentReadError || error instanceof UnsupportedFormatError) {
        throw error;
      }
      throw new DocumentReadError(
        typeof source === 'string' ? source : ('path' in source ? source.path : ('filename' in source ? source.filename : 'unknown')),
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Parse a string source (auto-detect path vs URL)
   */
  private parseStringSource(source: string): DocumentSource {
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return { type: 'url', url: source };
    }
    return { type: 'file', path: source };
  }

  /**
   * Resolve any source to a buffer and filename
   */
  private async resolveSource(
    source: DocumentSource
  ): Promise<{ buffer: Buffer; filename: string }> {
    switch (source.type) {
      case 'file': {
        const buffer = await fsReadFile(source.path);
        const filename = source.path.split('/').pop() || source.path;
        return { buffer, filename };
      }

      case 'url': {
        const maxSize = this.config.maxDownloadSizeBytes ?? DOCUMENT_DEFAULTS.MAX_DOWNLOAD_SIZE_BYTES;
        const timeout = this.config.downloadTimeoutMs ?? DOCUMENT_DEFAULTS.DOWNLOAD_TIMEOUT_MS;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(source.url, {
            headers: {
              ...source.headers,
              'User-Agent': 'OneRingAI-DocumentReader/1.0',
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const contentLength = response.headers.get('content-length');
          if (contentLength && parseInt(contentLength, 10) > maxSize) {
            throw new Error(`File too large: ${contentLength} bytes (max: ${maxSize})`);
          }

          const arrayBuffer = await response.arrayBuffer();
          if (arrayBuffer.byteLength > maxSize) {
            throw new Error(`Downloaded file too large: ${arrayBuffer.byteLength} bytes (max: ${maxSize})`);
          }

          const filename = this.extractFilenameFromURL(source.url, response);
          return { buffer: Buffer.from(arrayBuffer), filename };
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            throw new Error(`Download timed out after ${timeout}ms`);
          }
          throw error;
        }
      }

      case 'buffer': {
        const buffer = Buffer.isBuffer(source.buffer)
          ? source.buffer
          : Buffer.from(source.buffer);
        return { buffer, filename: source.filename };
      }

      case 'blob': {
        const arrayBuffer = await source.blob.arrayBuffer();
        return { buffer: Buffer.from(arrayBuffer), filename: source.filename };
      }
    }
  }

  /**
   * Extract filename from URL and response headers
   */
  private extractFilenameFromURL(url: string, response: Response): string {
    // Try Content-Disposition header
    const disposition = response.headers.get('content-disposition');
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]*)\1/);
      if (match?.[2]) return match[2];
    }

    // Fall back to URL path
    try {
      const pathname = new URL(url).pathname;
      const basename = pathname.split('/').pop();
      if (basename && basename.includes('.')) return basename;
    } catch {
      // ignore
    }

    return 'document';
  }

  /**
   * Get the handler for a format family, loading defaults lazily
   */
  private async getHandler(family: DocumentFamily): Promise<IFormatHandler | null> {
    // Check custom handlers first
    if (this.handlers.has(family)) {
      return this.handlers.get(family)!;
    }

    // Lazy-load default handlers
    try {
      const { getDefaultHandlers } = await import('./handlers/index.js');
      const defaults = getDefaultHandlers();
      const handler = defaults.get(family);
      if (handler) {
        this.handlers.set(family, handler);
        return handler;
      }
    } catch {
      // Handler module not available
    }

    return null;
  }

  /**
   * Filter images based on options
   */
  private filterImages(
    pieces: DocumentPiece[],
    filterOptions?: ImageFilterOptions
  ): DocumentPiece[] {
    const minWidth = filterOptions?.minWidth ?? DOCUMENT_DEFAULTS.IMAGE_FILTER.MIN_WIDTH;
    const minHeight = filterOptions?.minHeight ?? DOCUMENT_DEFAULTS.IMAGE_FILTER.MIN_HEIGHT;
    const minSizeBytes = filterOptions?.minSizeBytes ?? DOCUMENT_DEFAULTS.IMAGE_FILTER.MIN_SIZE_BYTES;
    const maxImages = filterOptions?.maxImages ?? DOCUMENT_DEFAULTS.MAX_EXTRACTED_IMAGES;
    const excludePatterns = filterOptions?.excludePatterns ?? [];

    let imageCount = 0;

    return pieces.filter((piece) => {
      if (piece.type !== 'image') return true;

      const img = piece as DocumentImagePiece;

      // Size checks
      if (img.width !== undefined && img.width < minWidth) return false;
      if (img.height !== undefined && img.height < minHeight) return false;
      if (img.metadata.sizeBytes < minSizeBytes) return false;

      // Pattern exclusions
      const label = img.metadata.label || '';
      if (excludePatterns.some((p) => p.test(label))) return false;

      // Max images
      imageCount++;
      if (imageCount > maxImages) return false;

      return true;
    });
  }

  /**
   * Run the transformer pipeline
   */
  private async runTransformers(
    pieces: DocumentPiece[],
    context: TransformerContext,
    options: DocumentReadOptions
  ): Promise<DocumentPiece[]> {
    const transformers: IDocumentTransformer[] = [];

    // Add built-in transformers unless skipped
    if (!options.skipDefaultTransformers) {
      try {
        const { getDefaultTransformers } = await import('./transformers/index.js');
        transformers.push(...getDefaultTransformers());
      } catch {
        // Transformers module not available
      }
    }

    // Add user-provided transformers
    if (options.transformers) {
      transformers.push(...options.transformers);
    }

    // Sort by priority (lower first)
    transformers.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

    // Run pipeline
    let result = pieces;
    for (const transformer of transformers) {
      // Check if transformer applies to this format
      if (
        transformer.appliesTo.length === 0 ||
        transformer.appliesTo.includes(context.format)
      ) {
        result = await transformer.transform(result, context);
      }
    }

    return result;
  }

  /**
   * Assemble metadata from pieces
   */
  private assembleMetadata(
    pieces: DocumentPiece[],
    filename: string,
    detection: { format: any; family: any; mimeType: string },
    startTime: number
  ): DocumentMetadata {
    const textPieces = pieces.filter((p) => p.type === 'text');
    const imagePieces = pieces.filter((p) => p.type === 'image');

    const totalSizeBytes = pieces.reduce((sum, p) => sum + p.metadata.sizeBytes, 0);
    const estimatedTokens = pieces.reduce((sum, p) => sum + p.metadata.estimatedTokens, 0);

    return {
      filename,
      format: detection.format,
      family: detection.family,
      mimeType: detection.mimeType,
      totalPieces: pieces.length,
      totalTextPieces: textPieces.length,
      totalImagePieces: imagePieces.length,
      totalSizeBytes,
      estimatedTokens,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Merge text pieces into a single markdown string
 */
export function mergeTextPieces(pieces: DocumentPiece[]): string {
  return pieces
    .filter((p): p is import('./types.js').DocumentTextPiece => p.type === 'text')
    .map((p) => p.content)
    .join('\n\n');
}
