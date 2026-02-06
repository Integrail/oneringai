/**
 * Default filesystem-based media output handler
 *
 * Saves generated media to a configurable directory on the local filesystem.
 * Default output directory: `os.tmpdir()/oneringai-media/`
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import type { IMediaOutputHandler, MediaOutputMetadata, MediaOutputResult } from './IMediaOutputHandler.js';

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  opus: 'audio/opus',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  pcm: 'audio/pcm',
};

export class FileMediaOutputHandler implements IMediaOutputHandler {
  private outputDir: string;
  private initialized = false;

  constructor(outputDir?: string) {
    this.outputDir = outputDir ?? path.join(os.tmpdir(), 'oneringai-media');
  }

  async save(data: Buffer, metadata: MediaOutputMetadata): Promise<MediaOutputResult> {
    if (!this.initialized) {
      await fs.mkdir(this.outputDir, { recursive: true });
      this.initialized = true;
    }

    const filename = metadata.suggestedFilename ?? this.generateFilename(metadata);
    const filePath = path.join(this.outputDir, filename);
    await fs.writeFile(filePath, data);

    const format = metadata.format.toLowerCase();
    const mimeType = MIME_TYPES[format] ?? `application/octet-stream`;

    return {
      location: filePath,
      mimeType,
      size: data.length,
    };
  }

  private generateFilename(metadata: MediaOutputMetadata): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    const indexSuffix = metadata.index != null ? `_${metadata.index}` : '';
    return `${metadata.type}_${timestamp}_${random}${indexSuffix}.${metadata.format}`;
  }
}
