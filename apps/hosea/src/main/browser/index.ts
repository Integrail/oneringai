/**
 * Browser Automation Module
 *
 * Exports all browser automation types and tools for Hosea.
 */

export * from './types.js';
export {
  createBrowserTools,
  BROWSER_TOOL_NAMES,
  type BrowserToolName,
  type DynamicUIEmitCallback,
  type BrowserDynamicUIContent,
} from './tools.js';
export {
  type StealthConfig,
  DEFAULT_STEALTH_CONFIG,
  getRealisticUserAgent,
  getRealisticWebGLFingerprint,
  getStealthScript,
  getStealthHeaders,
  getHeadersToRemove,
  getSecChUaHeaders,
} from './stealth.js';
export {
  type StoredCookie,
  saveCookiesToDisk,
  loadCookiesFromDisk,
  clearPersistedCookies,
  listPersistedSessions,
  saveAllCookies,
} from './persistence.js';
