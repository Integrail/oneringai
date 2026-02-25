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
  /** Extra credentials required by the vendor template (e.g., tenantId for Microsoft) */
  extraCredentials?: Record<string, string>;
  /** If true, use HTTPS callback server (port 19877) instead of HTTP (port 19876). Required by Slack etc. */
  requireHttps?: boolean;
}

/**
 * Hardcoded defaults shipped with the app.
 */
const DEFAULT_OAUTH_APPS: BuiltInOAuthApp[] = [
  {
    vendorId: 'microsoft',
    displayName: 'Microsoft',
    clientId: '420e7c29-baec-4c10-b055-d5d111d0cb36',
    authTemplateId: 'oauth-user',
    scopes: ['User.Read', 'Mail.Read', 'Calendars.ReadWrite', 'Files.ReadWrite', 'offline_access'],
    extraCredentials: {
      tenantId: '6f095f41-a356-4051-95ab-e1ccf165b1a2',
    },
  },
  {
    vendorId: 'twitter',
    displayName: 'Twitter / X',
    clientId: 'R0lxMlUtVUt4R0ZqU1cxellaZVk6MTpjaQ',
    authTemplateId: 'oauth-user',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
  },
  {
    vendorId: 'hubspot',
    displayName: 'HubSpot',
    clientId: '16f0288e-d0a7-4ea9-8249-5e92f6d6adec',
    authTemplateId: 'oauth-mcp',
    scopes: [],
    extraCredentials: {
      appId: '32332286',
      clientSecret: 'ee5a2f96-2af0-4151-a036-c010ad499f85',
    },
  },
  {
    vendorId: 'slack',
    displayName: 'Slack',
    clientId: '8338321730902.10583366120594',
    authTemplateId: 'oauth-user',
    scopes: ['chat:write', 'channels:read', 'users:read', 'im:write', 'groups:read', 'files:read', 'files:write', 'reactions:read', 'reactions:write', 'team:read'],
    extraCredentials: {
      clientSecret: 'afec5ce0033bdfe00bf2b1af4ec53c9c',
      signingSecret: 'f1a50a4b7ef84e9544a43c656b40225b',
    },
    requireHttps: true,
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
