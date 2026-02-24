/**
 * Built-in OAuth App Registry
 *
 * Stores default Client IDs for zero-config OAuth connections.
 * Users can click a vendor logo on the Connections page and authorize immediately
 * without needing to set up their own OAuth application.
 *
 * Override via config file: ~/.everworker/hosea/built-in-oauth-apps.json
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface BuiltInOAuthApp {
  /** Matches vendor template ID (e.g., 'microsoft', 'twitter') */
  vendorId: string;
  /** Display name shown on Connections page */
  displayName: string;
  /** Our registered OAuth Client ID */
  clientId: string;
  /** Which auth template to use (e.g., 'oauth-user') */
  authTemplateId: string;
  /** Default scopes to request */
  scopes: string[];
}

/**
 * Hardcoded defaults shipped with the app.
 * Client IDs should be replaced with actual registered app credentials.
 */
const DEFAULT_OAUTH_APPS: BuiltInOAuthApp[] = [
  {
    vendorId: 'microsoft',
    displayName: 'Microsoft',
    clientId: 'PLACEHOLDER_MICROSOFT_CLIENT_ID',
    authTemplateId: 'oauth-user',
    scopes: ['User.Read', 'Mail.Read', 'Calendars.ReadWrite', 'Files.ReadWrite', 'offline_access'],
  },
  {
    vendorId: 'twitter',
    displayName: 'Twitter / X',
    clientId: 'PLACEHOLDER_TWITTER_CLIENT_ID',
    authTemplateId: 'oauth-user',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
  },
];

/**
 * Config file path for overrides.
 * File format: array of BuiltInOAuthApp objects.
 * If present, entries override defaults by vendorId (file wins).
 */
function getConfigPath(): string {
  return join(homedir(), '.everworker', 'hosea', 'built-in-oauth-apps.json');
}

/**
 * Load built-in OAuth apps, merging file overrides with hardcoded defaults.
 */
export function loadBuiltInOAuthApps(): BuiltInOAuthApp[] {
  const configPath = getConfigPath();
  let fileApps: BuiltInOAuthApp[] = [];

  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        fileApps = parsed;
      }
    } catch (error) {
      console.warn('[BuiltInOAuth] Failed to parse config file:', error);
    }
  }

  if (fileApps.length === 0) {
    return [...DEFAULT_OAUTH_APPS];
  }

  // File overrides defaults by vendorId
  const merged = new Map<string, BuiltInOAuthApp>();
  for (const app of DEFAULT_OAUTH_APPS) {
    merged.set(app.vendorId, app);
  }
  for (const app of fileApps) {
    merged.set(app.vendorId, app);
  }

  return Array.from(merged.values());
}

/**
 * Get a specific built-in OAuth app by vendor ID.
 */
export function getBuiltInOAuthApp(vendorId: string): BuiltInOAuthApp | undefined {
  const apps = loadBuiltInOAuthApps();
  return apps.find(a => a.vendorId === vendorId);
}
