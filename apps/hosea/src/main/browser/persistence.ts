/**
 * Browser Cookie Persistence
 *
 * Saves and loads cookies to disk to maintain sessions across app restarts.
 * This helps avoid re-authentication and reduces bot detection by maintaining
 * a consistent browser profile.
 */

import { app, session } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Cookie store directory
const COOKIE_STORE_DIR = path.join(app.getPath('userData'), 'browser_cookies');

/**
 * Simplified cookie data for storage (Electron.Cookie with only serializable fields)
 */
export interface StoredCookie {
  name: string;
  value: string;
  domain?: string;
  hostOnly?: boolean;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'unspecified' | 'no_restriction' | 'lax' | 'strict';
  expirationDate?: number;
  session?: boolean;
}

/**
 * Ensure the cookie store directory exists
 */
function ensureCookieStoreDir(): void {
  if (!fs.existsSync(COOKIE_STORE_DIR)) {
    fs.mkdirSync(COOKIE_STORE_DIR, { recursive: true });
  }
}

/**
 * Get the cookie file path for a session partition
 */
function getCookieFilePath(partition: string): string {
  // Sanitize partition name for use as filename
  const sanitized = partition.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(COOKIE_STORE_DIR, `${sanitized}.json`);
}

/**
 * Convert Electron.Cookie to StoredCookie (remove non-serializable fields)
 */
function toStoredCookie(cookie: Electron.Cookie): StoredCookie {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    hostOnly: cookie.hostOnly,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    expirationDate: cookie.expirationDate,
    session: cookie.session,
  };
}

/**
 * Save cookies from a session partition to disk
 */
export async function saveCookiesToDisk(
  partition: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    ensureCookieStoreDir();

    const ses = session.fromPartition(partition);
    const cookies = await ses.cookies.get({});

    // Filter out session-only cookies (they shouldn't persist)
    const persistableCookies = cookies
      .filter((c) => !c.session)
      .map(toStoredCookie);

    const filePath = getCookieFilePath(partition);
    fs.writeFileSync(filePath, JSON.stringify(persistableCookies, null, 2));

    console.log(`[Persistence] Saved ${persistableCookies.length} cookies for ${partition}`);
    return { success: true, count: persistableCookies.length };
  } catch (error) {
    console.error(`[Persistence] Failed to save cookies for ${partition}:`, error);
    return { success: false, count: 0, error: String(error) };
  }
}

/**
 * Load cookies from disk into a session partition
 */
export async function loadCookiesFromDisk(
  partition: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const filePath = getCookieFilePath(partition);

    if (!fs.existsSync(filePath)) {
      console.log(`[Persistence] No saved cookies for ${partition}`);
      return { success: true, count: 0 };
    }

    const data = fs.readFileSync(filePath, 'utf-8');
    const storedCookies: StoredCookie[] = JSON.parse(data);

    const ses = session.fromPartition(partition);
    let importedCount = 0;

    for (const cookie of storedCookies) {
      try {
        // Build the URL for the cookie
        const protocol = cookie.secure ? 'https' : 'http';
        const domain = cookie.domain?.replace(/^\./, '') || 'localhost';
        const url = `${protocol}://${domain}${cookie.path || '/'}`;

        // Set the cookie
        await ses.cookies.set({
          url,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          expirationDate: cookie.expirationDate,
        });
        importedCount++;
      } catch (err) {
        // Some cookies may fail to import (e.g., expired) - that's OK
        console.warn(`[Persistence] Failed to import cookie ${cookie.name}:`, err);
      }
    }

    console.log(`[Persistence] Loaded ${importedCount}/${storedCookies.length} cookies for ${partition}`);
    return { success: true, count: importedCount };
  } catch (error) {
    console.error(`[Persistence] Failed to load cookies for ${partition}:`, error);
    return { success: false, count: 0, error: String(error) };
  }
}

/**
 * Clear persisted cookies for a session partition
 */
export function clearPersistedCookies(partition: string): { success: boolean; error?: string } {
  try {
    const filePath = getCookieFilePath(partition);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Persistence] Cleared persisted cookies for ${partition}`);
    }
    return { success: true };
  } catch (error) {
    console.error(`[Persistence] Failed to clear cookies for ${partition}:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * List all persisted cookie files
 */
export function listPersistedSessions(): string[] {
  try {
    ensureCookieStoreDir();
    const files = fs.readdirSync(COOKIE_STORE_DIR);
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  } catch {
    return [];
  }
}

/**
 * Save all browser sessions' cookies to disk
 * Call this on app quit
 */
export async function saveAllCookies(
  partitions: string[]
): Promise<{ success: boolean; saved: number }> {
  let saved = 0;
  for (const partition of partitions) {
    const result = await saveCookiesToDisk(partition);
    if (result.success && result.count > 0) {
      saved++;
    }
  }
  return { success: true, saved };
}
