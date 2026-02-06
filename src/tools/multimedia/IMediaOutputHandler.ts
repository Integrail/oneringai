/**
 * Interface for handling multimedia output storage
 *
 * Allows library consumers to plug in custom storage backends (S3, GCS, etc.)
 * Default implementation: FileMediaOutputHandler (local filesystem)
 */

export interface MediaOutputMetadata {
  /** Type of media being saved */
  type: 'image' | 'video' | 'audio';
  /** File format (png, mp4, mp3, etc.) */
  format: string;
  /** Model used for generation */
  model: string;
  /** Vendor that produced the output */
  vendor: string;
  /** Index for multi-image results */
  index?: number;
  /** Suggested filename (without path) */
  suggestedFilename?: string;
}

export interface MediaOutputResult {
  /** Location of the saved file (file path, URL, S3 key - depends on handler) */
  location: string;
  /** MIME type of the saved file */
  mimeType: string;
  /** File size in bytes */
  size: number;
}

export interface IMediaOutputHandler {
  /**
   * Save media data to storage
   *
   * @param data - Raw media data as Buffer
   * @param metadata - Information about the media for naming/organization
   * @returns Location and metadata of the saved file
   */
  save(data: Buffer, metadata: MediaOutputMetadata): Promise<MediaOutputResult>;
}
