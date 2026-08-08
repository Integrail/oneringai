/**
 * Google Embedding provider
 * Uses the Gemini embedding API (different from OpenAI-compatible format)
 */

import { BaseMediaProvider } from '../base/BaseMediaProvider.js';
import * as fs from 'fs';
import * as path from 'path';
import type {
  IEmbeddingProvider,
  EmbeddingContentPart,
  EmbeddingOptions,
  EmbeddingResponse,
} from '../../../domain/interfaces/IEmbeddingProvider.js';
import type { ProviderCapabilities } from '../../../domain/interfaces/IProvider.js';
import type { GoogleConfig } from '../../../domain/types/ProviderConfig.js';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderError,
} from '../../../domain/errors/AIErrors.js';
import { detectAudioContainer } from '../../../utils/audioUtils.js';

const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com';
const GOOGLE_INLINE_MEDIA_LIMIT_BYTES = 100 * 1024 * 1024;
const GOOGLE_INLINE_PDF_LIMIT_BYTES = 50 * 1024 * 1024;
const DEFAULT_MEDIA_DOWNLOAD_TIMEOUT_MS = 30_000;

interface InlineMediaBudget {
  usedBytes: number;
  readonly maxBytes: number;
}

interface GoogleEmbedContentResponse {
  embedding: {
    values: number[];
  };
}

interface GoogleBatchEmbedResponse {
  embeddings: Array<{
    values: number[];
  }>;
}

export class GoogleEmbeddingProvider extends BaseMediaProvider implements IEmbeddingProvider {
  readonly name: string = 'google-embedding';
  readonly vendor = 'google' as const;
  readonly capabilities: ProviderCapabilities = {
    text: false,
    images: false,
    videos: false,
    audio: false,
    embeddings: true,
  };

  private apiKey: string;

  constructor(config: GoogleConfig) {
    super(config);
    this.apiKey = config.apiKey;
  }

  /**
   * Generate embeddings using Google's embedContent / batchEmbedContents API
   */
  async embed(options: EmbeddingOptions): Promise<EmbeddingResponse> {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          const inputs = Array.isArray(options.input) ? options.input : [options.input];

          this.logOperationStart('embedding.embed', {
            model: options.model,
            inputCount: inputs.length,
            dimensions: options.dimensions,
          });

          let embeddings: number[][];

          if (options.content) {
            embeddings = [await this.embedMultimodal(options)];
          } else if (inputs.length === 1) {
            embeddings = [await this.embedSingle(options.model, inputs[0]!, options.dimensions, options.vendorOptions)];
          } else {
            embeddings = await this.embedBatch(options.model, inputs, options.dimensions, options.vendorOptions);
          }

          const result: EmbeddingResponse = {
            embeddings,
            model: options.model,
            usage: {
              // Google doesn't return token usage in embedding responses
              promptTokens: 0,
              totalTokens: 0,
            },
          };

          this.logOperationComplete('embedding.embed', {
            model: options.model,
            embeddingsCount: result.embeddings.length,
            dimensions: result.embeddings[0]?.length,
          });

          return result;
        } catch (error: any) {
          if (error instanceof ProviderError) throw error;
          this.handleError(error);
          throw error;
        }
      },
      'embedding.embed',
      { model: options.model }
    );
  }

  async listModels(): Promise<string[]> {
    return ['gemini-embedding-2', 'gemini-embedding-001'];
  }

  private async embedSingle(
    model: string,
    text: string,
    dimensions?: number,
    vendorOptions?: Record<string, unknown>
  ): Promise<number[]> {
    const url = `${GOOGLE_API_BASE}/v1beta/models/${model}:embedContent?key=${this.apiKey}`;

    const body: Record<string, unknown> = {
      content: {
        parts: [{ text }],
      },
    };

    if (dimensions !== undefined) {
      body.outputDimensionality = dimensions;
    }
    if (vendorOptions?.taskType) body.taskType = vendorOptions.taskType;
    if (vendorOptions?.title) body.title = vendorOptions.title;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      await this.handleHttpError(response);
    }

    const data = (await response.json()) as GoogleEmbedContentResponse;
    return data.embedding.values;
  }

  private async embedBatch(
    model: string,
    texts: string[],
    dimensions?: number,
    vendorOptions?: Record<string, unknown>
  ): Promise<number[][]> {
    const url = `${GOOGLE_API_BASE}/v1beta/models/${model}:batchEmbedContents?key=${this.apiKey}`;

    const requests = texts.map((text) => {
      const req: Record<string, unknown> = {
        model: `models/${model}`,
        content: {
          parts: [{ text }],
        },
      };
      if (dimensions !== undefined) {
        req.outputDimensionality = dimensions;
      }
      if (vendorOptions?.taskType) req.taskType = vendorOptions.taskType;
      if (vendorOptions?.title) req.title = vendorOptions.title;
      return req;
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      await this.handleHttpError(response);
    }

    const data = (await response.json()) as GoogleBatchEmbedResponse;
    return data.embeddings.map((e) => e.values);
  }

  private async embedMultimodal(options: EmbeddingOptions): Promise<number[]> {
    if (options.model !== 'gemini-embedding-2') {
      throw new ProviderError('google', `${options.model} does not support multimodal embeddings`);
    }
    const budget: InlineMediaBudget = {
      usedBytes: 0,
      maxBytes: GOOGLE_INLINE_MEDIA_LIMIT_BYTES,
    };
    const configuredTimeout = options.vendorOptions?.mediaDownloadTimeoutMs;
    const mediaDownloadTimeoutMs = typeof configuredTimeout === 'number'
      && Number.isFinite(configuredTimeout)
      && configuredTimeout > 0
      ? configuredTimeout
      : DEFAULT_MEDIA_DOWNLOAD_TIMEOUT_MS;
    const parts: Record<string, unknown>[] = [];
    for (const part of options.content ?? []) {
      parts.push(await this.toGooglePart(part, budget, mediaDownloadTimeoutMs));
    }
    const body: Record<string, unknown> = { content: { parts } };
    if (options.dimensions !== undefined) body.outputDimensionality = options.dimensions;
    if (options.vendorOptions?.taskType) body.taskType = options.vendorOptions.taskType;
    if (options.vendorOptions?.title) body.title = options.vendorOptions.title;
    const url = `${GOOGLE_API_BASE}/v1beta/models/${options.model}:embedContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) await this.handleHttpError(response);
    return ((await response.json()) as GoogleEmbedContentResponse).embedding.values;
  }

  private async toGooglePart(
    part: EmbeddingContentPart,
    budget: InlineMediaBudget,
    mediaDownloadTimeoutMs: number,
  ): Promise<Record<string, unknown>> {
    if (part.type === 'text') return { text: part.text };
    if (typeof part.data === 'string' && this.isGoogleHostedUri(part.data)) {
      const mimeType = part.mimeType ?? this.inferMimeType(part.data, part.type);
      return { fileData: { fileUri: part.data, mimeType } };
    }
    if (typeof part.data === 'string' && /^data:/.test(part.data)) {
      const match = /^data:([^;,]+);base64,(.+)$/s.exec(part.data);
      if (!match) throw new ProviderError('google', 'Embedding media data URI must be base64 encoded');
      const mimeType = part.mimeType
        ?? match[1]
        ?? this.inferMimeType(part.data, part.type);
      const bytes = this.decodeInlineBase64(match[2]!, mimeType, budget);
      this.consumeInlineBudget(bytes.length, mimeType, budget);
      return { inlineData: { data: bytes.toString('base64'), mimeType } };
    }
    if (typeof part.data === 'string' && /^https?:\/\//.test(part.data)) {
      const { bytes, mimeType } = await this.fetchExternalMedia(
        part.data,
        part.type,
        part.mimeType,
        budget,
        mediaDownloadTimeoutMs,
      );
      return { inlineData: { data: bytes.toString('base64'), mimeType } };
    }
    if (typeof part.data === 'string') {
      const stat = await fs.promises.stat(part.data);
      const provisionalMimeType = part.mimeType ?? this.inferMimeType(part.data, part.type);
      this.assertInlineSize(stat.size, provisionalMimeType, budget);
    }
    const bytes = Buffer.isBuffer(part.data) ? part.data : await fs.promises.readFile(part.data);
    const mimeType = part.mimeType
      ?? this.detectMediaMimeType(bytes, part.type)
      ?? this.inferMimeType(part.data, part.type);
    this.consumeInlineBudget(bytes.length, mimeType, budget);
    return { inlineData: { data: bytes.toString('base64'), mimeType } };
  }

  private decodeInlineBase64(
    encoded: string,
    mimeType: string,
    budget: InlineMediaBudget,
  ): Buffer {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      throw new ProviderError('google', 'Embedding media data URI contains invalid base64');
    }

    const unpadded = encoded.replace(/=+$/, '');
    const suppliedPadding = encoded.length - unpadded.length;
    const remainder = unpadded.length % 4;
    const requiredPadding = remainder === 0 ? 0 : 4 - remainder;
    if (remainder === 1 || (suppliedPadding !== 0 && suppliedPadding !== requiredPadding)) {
      throw new ProviderError('google', 'Embedding media data URI contains invalid base64');
    }

    // Reject over-budget payloads from their encoded length before allocating
    // the decoded buffer. Unpadded base64 contains exactly six bits per byte.
    const decodedLength = Math.floor((unpadded.length * 6) / 8);
    this.assertInlineSize(decodedLength, mimeType, budget);
    const canonical = `${unpadded}${'='.repeat(requiredPadding)}`;
    const bytes = Buffer.from(canonical, 'base64');
    if (bytes.length !== decodedLength
      || bytes.toString('base64').replace(/=+$/, '') !== unpadded) {
      throw new ProviderError('google', 'Embedding media data URI contains invalid base64');
    }
    return bytes;
  }

  private async fetchExternalMedia(
    uri: string,
    type: Exclude<EmbeddingContentPart['type'], 'text'>,
    explicitMimeType: string | undefined,
    budget: InlineMediaBudget,
    timeoutMs: number,
  ): Promise<{ bytes: Buffer; mimeType: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(uri, { signal: controller.signal });
      if (!response.ok) {
        throw new ProviderError(
          'google',
          `Failed to fetch embedding media: HTTP ${response.status} ${response.statusText}`,
        );
      }

      const responseMimeType = this.getCompatibleResponseMimeType(
        response.headers.get('content-type'),
        type,
      );
      const provisionalMimeType = explicitMimeType
        ?? responseMimeType
        ?? this.inferMimeType(uri, type);
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength >= 0) {
        this.assertInlineSize(contentLength, provisionalMimeType, budget);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const bytes = Buffer.alloc(0);
        const mimeType = explicitMimeType ?? responseMimeType ?? this.inferMimeType(uri, type);
        this.consumeInlineBudget(0, mimeType, budget);
        return { bytes, mimeType };
      }

      const chunks: Buffer[] = [];
      let byteLength = 0;
      const maximumReadableBytes = Math.min(
        this.getMimeLimit(provisionalMimeType),
        budget.maxBytes - budget.usedBytes,
      );
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        byteLength += value.byteLength;
        if (byteLength > maximumReadableBytes) {
          await reader.cancel().catch(() => undefined);
          throw this.createInlineLimitError(provisionalMimeType);
        }
        chunks.push(Buffer.from(value));
      }

      const bytes = Buffer.concat(chunks, byteLength);
      const mimeType = explicitMimeType
        ?? this.detectMediaMimeType(bytes, type)
        ?? responseMimeType
        ?? this.inferMimeType(uri, type);
      this.consumeInlineBudget(bytes.length, mimeType, budget);
      return { bytes, mimeType };
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ProviderError(
          'google',
          `Embedding media download timed out after ${timeoutMs} ms`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private assertInlineSize(
    byteLength: number,
    mimeType: string,
    budget: InlineMediaBudget,
  ): void {
    if (byteLength > this.getMimeLimit(mimeType)
      || byteLength > budget.maxBytes - budget.usedBytes) {
      throw this.createInlineLimitError(mimeType);
    }
  }

  private consumeInlineBudget(
    byteLength: number,
    mimeType: string,
    budget: InlineMediaBudget,
  ): void {
    this.assertInlineSize(byteLength, mimeType, budget);
    budget.usedBytes += byteLength;
  }

  private getMimeLimit(mimeType: string): number {
    return mimeType === 'application/pdf'
      ? GOOGLE_INLINE_PDF_LIMIT_BYTES
      : GOOGLE_INLINE_MEDIA_LIMIT_BYTES;
  }

  private createInlineLimitError(mimeType: string): ProviderError {
    const maximumMb = this.getMimeLimit(mimeType) / (1024 * 1024);
    return new ProviderError(
      'google',
      `Embedding media exceeds Google's ${maximumMb} MB inline limit`,
    );
  }

  private getCompatibleResponseMimeType(
    contentType: string | null,
    type: Exclude<EmbeddingContentPart['type'], 'text'>,
  ): string | undefined {
    const mimeType = contentType?.split(';')[0]?.trim().toLowerCase();
    if (!mimeType) return undefined;
    if (type === 'image' && mimeType.startsWith('image/')) return mimeType;
    if (type === 'audio' && mimeType.startsWith('audio/')) return mimeType;
    if (type === 'video' && mimeType.startsWith('video/')) return mimeType;
    if (type === 'document' && mimeType === 'application/pdf') return mimeType;
    return undefined;
  }

  private isGoogleHostedUri(uri: string): boolean {
    if (uri.startsWith('gs://')) return true;
    try {
      const url = new URL(uri);
      return url.hostname === 'generativelanguage.googleapis.com'
        && /\/files\//.test(url.pathname);
    } catch {
      return false;
    }
  }

  private inferMimeType(
    data: Buffer | string,
    type: Exclude<EmbeddingContentPart['type'], 'text'>
  ): string {
    if (Buffer.isBuffer(data)) {
      return this.detectMediaMimeType(data, type) ?? this.defaultMimeType(type);
    }
    let extension = '';
    try {
      extension = path.extname(new URL(data).pathname).toLowerCase();
    } catch {
      extension = path.extname(data).toLowerCase();
    }
    if (extension === '.bmp') return 'image/bmp';
    if (extension === '.png') return 'image/png';
    if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
    if (extension === '.webp') return 'image/webp';
    if (extension === '.mp3') return 'audio/mpeg';
    if (extension === '.wav') return 'audio/wav';
    if (extension === '.aac') return 'audio/aac';
    if (extension === '.flac') return 'audio/flac';
    if (extension === '.ogg' || extension === '.opus') return 'audio/ogg';
    if (extension === '.aif' || extension === '.aiff') return 'audio/aiff';
    if (extension === '.mp4') return type === 'audio' ? 'audio/mp4' : 'video/mp4';
    if (extension === '.m4a') return 'audio/mp4';
    if (extension === '.mov') return 'video/quicktime';
    if (extension === '.avi') return 'video/avi';
    if (extension === '.webm') return type === 'audio' ? 'audio/webm' : 'video/webm';
    if (extension === '.mpeg' || extension === '.mpg') return 'video/mpeg';
    if (extension === '.3gp') return 'video/3gpp';
    if (extension === '.pdf') return 'application/pdf';
    return this.defaultMimeType(type);
  }

  private defaultMimeType(type: Exclude<EmbeddingContentPart['type'], 'text'>): string {
    return type === 'image' ? 'image/png'
      : type === 'audio' ? 'audio/wav'
        : type === 'video' ? 'video/mp4'
          : 'application/pdf';
  }

  private detectMediaMimeType(
    data: Buffer,
    type: Exclude<EmbeddingContentPart['type'], 'text'>,
  ): string | undefined {
    if (data.length >= 4
      && data[0] === 0x89
      && data.subarray(1, 4).toString('ascii') === 'PNG') return 'image/png';
    if (data.length >= 3
      && data[0] === 0xff
      && data[1] === 0xd8
      && data[2] === 0xff) return 'image/jpeg';
    if (data.subarray(0, 2).toString('ascii') === 'BM') return 'image/bmp';
    if (data.length >= 12
      && data.subarray(0, 4).toString('ascii') === 'RIFF'
      && data.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    if (data.subarray(0, 4).toString('ascii') === '%PDF') return 'application/pdf';

    if (type === 'audio') return detectAudioContainer(data)?.mimeType;
    if (type === 'video') {
      if (data.length >= 12 && data.subarray(4, 8).toString('ascii') === 'ftyp') {
        const brand = data.subarray(8, 12).toString('ascii');
        if (brand === 'qt  ') return 'video/quicktime';
        if (brand.startsWith('3g')) return 'video/3gpp';
        return 'video/mp4';
      }
      if (data.length >= 12
        && data.subarray(0, 4).toString('ascii') === 'RIFF'
        && data.subarray(8, 12).toString('ascii') === 'AVI ') return 'video/avi';
      if (data.length >= 4
        && data[0] === 0x1a
        && data[1] === 0x45
        && data[2] === 0xdf
        && data[3] === 0xa3) return 'video/webm';
      if (data.length >= 4
        && data[0] === 0x00
        && data[1] === 0x00
        && data[2] === 0x01
        && (data[3] === 0xba || data[3] === 0xb3)) return 'video/mpeg';
    }
    return undefined;
  }

  private async handleHttpError(response: Response): Promise<never> {
    const text = await response.text().catch(() => '');
    const status = response.status;

    if (status === 401 || status === 403) {
      throw new ProviderAuthError('google', 'Invalid API key');
    }

    if (status === 429) {
      throw new ProviderRateLimitError('google', undefined);
    }

    throw new ProviderError('google', `HTTP ${status}: ${text}`);
  }

  private handleError(error: any): never {
    const message = error.message || 'Unknown Google embedding error';
    throw new ProviderError('google', message);
  }
}
