/**
 * Module-level configuration for multimedia output storage
 *
 * Provides a global default media storage used by all tool factories
 * when called through ConnectorTools.registerService().
 *
 * @example
 * ```typescript
 * import { setMediaStorage } from '@everworker/oneringai';
 *
 * // Use custom S3 storage before creating agents
 * setMediaStorage(myS3Storage);
 * ```
 */

import type { IMediaStorage } from '../../domain/interfaces/IMediaStorage.js';
import { FileMediaStorage } from '../../infrastructure/storage/FileMediaStorage.js';

let _storage: IMediaStorage | null = null;

/**
 * Get the global media storage (creates default FileMediaStorage on first access)
 */
export function getMediaStorage(): IMediaStorage {
  if (!_storage) {
    _storage = new FileMediaStorage();
  }
  return _storage;
}

/**
 * Set a custom global media storage
 *
 * Call this before agent creation to use custom storage (S3, GCS, etc.)
 */
export function setMediaStorage(storage: IMediaStorage): void {
  _storage = storage;
}

// ============================================================================
// Deprecated aliases (remove in next major version)
// ============================================================================

/** @deprecated Use `getMediaStorage()` instead */
export const getMediaOutputHandler = getMediaStorage;

/** @deprecated Use `setMediaStorage()` instead */
export const setMediaOutputHandler = setMediaStorage;
