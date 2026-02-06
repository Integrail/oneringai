/**
 * Module-level configuration for multimedia output handling
 *
 * Provides a global default output handler used by all tool factories
 * when called through ConnectorTools.registerService().
 *
 * @example
 * ```typescript
 * import { setMediaOutputHandler } from '@everworker/oneringai';
 *
 * // Use custom S3 handler before creating agents
 * setMediaOutputHandler(myS3Handler);
 * ```
 */

import type { IMediaOutputHandler } from './IMediaOutputHandler.js';
import { FileMediaOutputHandler } from './FileMediaOutputHandler.js';

let _outputHandler: IMediaOutputHandler | null = null;

/**
 * Get the global media output handler (creates default FileMediaOutputHandler on first access)
 */
export function getMediaOutputHandler(): IMediaOutputHandler {
  if (!_outputHandler) {
    _outputHandler = new FileMediaOutputHandler();
  }
  return _outputHandler;
}

/**
 * Set a custom global media output handler
 *
 * Call this before agent creation to use custom storage (S3, GCS, etc.)
 */
export function setMediaOutputHandler(handler: IMediaOutputHandler): void {
  _outputHandler = handler;
}
