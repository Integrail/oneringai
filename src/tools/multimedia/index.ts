/**
 * Multimedia Tools - Image, Video, TTS, STT tool factories
 *
 * Auto-registers multimedia tool factories with ConnectorTools for AI vendors.
 * When imported, this module registers factories so that `ConnectorTools.for('openai')`
 * automatically includes multimedia tools alongside the generic API tool.
 */

// Side-effect: register multimedia tool factories with ConnectorTools
import { registerMultimediaTools } from './register.js';
registerMultimediaTools();

// ============================================================================
// Canonical exports (new names - prefer these)
// ============================================================================

// Media storage config
export { setMediaStorage, getMediaStorage } from './config.js';

// ============================================================================
// Deprecated aliases (backward compat - remove in next major version)
// ============================================================================

// Types (deprecated aliases re-exported from the shim)
export type {
  IMediaOutputHandler,
  MediaOutputMetadata,
  MediaOutputResult,
} from './IMediaOutputHandler.js';

// Default output handler (deprecated alias)
export { FileMediaOutputHandler } from './FileMediaOutputHandler.js';

// Config functions (deprecated aliases)
export { setMediaOutputHandler, getMediaOutputHandler } from './config.js';

// ============================================================================
// Tool factories (for direct use with custom options)
// ============================================================================

export { createImageGenerationTool } from './imageGeneration.js';
export { createVideoTools } from './videoGeneration.js';
export { createTextToSpeechTool } from './textToSpeech.js';
export { createSpeechToTextTool } from './speechToText.js';
