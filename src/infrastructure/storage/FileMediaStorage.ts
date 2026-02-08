/**
 * FileMediaStorage - File-based media storage implementation
 *
 * Saves generated media to a configurable directory on the local filesystem.
 * Default output directory: `os.tmpdir()/oneringai-media/`
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import type {
  IMediaStorage,
  MediaStorageMetadata,
  MediaStorageResult,
  MediaStorageEntry,
  MediaStorageListOptions,
} from '../../domain/interfaces/IMediaStorage.js';

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

/**
 * Media type prefixes used in generated filenames
 */
const MEDIA_TYPE_PREFIXES = ['image', 'video', 'audio'] as const;

export interface FileMediaStorageConfig {
  /** Directory to store media files. Defaults to `os.tmpdir()/oneringai-media/` */
  outputDir?: string;
}

export class FileMediaStorage implements IMediaStorage {
  private outputDir: string;
  private initialized = false;

  constructor(config?: FileMediaStorageConfig) {
    this.outputDir = config?.outputDir ?? path.join(os.tmpdir(), 'oneringai-media');
  }

  async save(data: Buffer, metadata: MediaStorageMetadata): Promise<MediaStorageResult> {
    const dir = metadata.userId
      ? path.join(this.outputDir, metadata.userId)
      : this.outputDir;
    await fs.mkdir(dir, { recursive: true });

    const filename = metadata.suggestedFilename ?? this.generateFilename(metadata);
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, data);

    const format = metadata.format.toLowerCase();
    const mimeType = MIME_TYPES[format] ?? 'application/octet-stream';

    return {
      location: filePath,
      mimeType,
      size: data.length,
    };
  }

  async read(location: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(location);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async delete(location: string): Promise<void> {
    try {
      await fs.unlink(location);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return;
      }
      throw err;
    }
  }

  async exists(location: string): Promise<boolean> {
    try {
      await fs.access(location);
      return true;
    } catch {
      return false;
    }
  }

  async list(options?: MediaStorageListOptions): Promise<MediaStorageEntry[]> {
    await this.ensureDir();

    let entries: MediaStorageEntry[] = [];

    const files = await fs.readdir(this.outputDir);
    for (const file of files) {
      const filePath = path.join(this.outputDir, file);
      try {
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) continue;

        const ext = path.extname(file).slice(1).toLowerCase();
        const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';

        // Detect media type from filename prefix (image_*, video_*, audio_*)
        let type: 'image' | 'video' | 'audio' | undefined;
        for (const prefix of MEDIA_TYPE_PREFIXES) {
          if (file.startsWith(`${prefix}_`)) {
            type = prefix;
            break;
          }
        }

        entries.push({
          location: filePath,
          mimeType,
          size: stat.size,
          type,
          createdAt: stat.birthtime,
        });
      } catch {
        // Skip files we can't stat
      }
    }

    // Filter by type
    if (options?.type) {
      entries = entries.filter((e) => e.type === options.type);
    }

    // Sort by creation time descending
    entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? entries.length;
    return entries.slice(offset, offset + limit);
  }

  getPath(): string {
    return this.outputDir;
  }

  private generateFilename(metadata: MediaStorageMetadata): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    const indexSuffix = metadata.index != null ? `_${metadata.index}` : '';
    return `${metadata.type}_${timestamp}_${random}${indexSuffix}.${metadata.format}`;
  }

  private async ensureDir(): Promise<void> {
    if (!this.initialized) {
      await fs.mkdir(this.outputDir, { recursive: true });
      this.initialized = true;
    }
  }
}

/**
 * Factory function for creating FileMediaStorage instances
 */
export function createFileMediaStorage(config?: FileMediaStorageConfig): FileMediaStorage {
  return new FileMediaStorage(config);
}
