/**
 * Authenticated Fetch - Drop-in replacement for fetch() with connector-based authentication
 *
 * Supports all auth schemes configured on connectors:
 * - Bearer tokens (OAuth, JWT)
 * - Bot tokens (Discord)
 * - Basic auth (Twilio, Zendesk)
 * - Custom headers (e.g., X-Shopify-Access-Token)
 */

import { Connector } from '../core/Connector.js';

/**
 * Fetch with automatic authentication using connector's configured auth scheme
 *
 * Same API as standard fetch(), but with additional authProvider and optional userId parameters.
 * Authentication is handled automatically based on the connector's configuration:
 * - Bearer tokens (GitHub, Slack, Stripe)
 * - Bot tokens (Discord)
 * - Basic auth (Twilio, Zendesk)
 * - Custom headers (e.g., X-Shopify-Access-Token)
 *
 * @param url - URL to fetch (string or URL object). Can be relative if connector has baseURL.
 * @param options - Standard fetch options (DO NOT set Authorization header - it's added automatically)
 * @param authProvider - Name of registered connector (e.g., 'github', 'slack')
 * @param userId - Optional user identifier for multi-user support (omit for single-user mode)
 * @returns Promise<Response> - Same as standard fetch
 *
 * @example Single-user mode:
 * ```typescript
 * const response = await authenticatedFetch(
 *   'https://graph.microsoft.com/v1.0/me',
 *   { method: 'GET' },
 *   'microsoft'
 * );
 * const data = await response.json();
 * ```
 *
 * @example With relative URL (uses connector's baseURL):
 * ```typescript
 * const response = await authenticatedFetch(
 *   '/user/repos',  // Resolves to https://api.github.com/user/repos
 *   { method: 'GET' },
 *   'github'
 * );
 * const repos = await response.json();
 * ```
 *
 * @example Multi-user mode:
 * ```typescript
 * const response = await authenticatedFetch(
 *   '/user/repos',
 *   { method: 'GET' },
 *   'github',
 *   'user123'  // Get token for specific user
 * );
 * const repos = await response.json();
 * ```
 */
export async function authenticatedFetch(
  url: string | URL,
  options: RequestInit | undefined,
  authProvider: string,
  userId?: string
): Promise<Response> {
  const connector = Connector.get(authProvider);

  // Delegate to connector.fetch() which handles all auth schemes correctly:
  // - OAuth/JWT: Authorization: Bearer <token>
  // - API Key: Uses configured headerName and headerPrefix
  //   (e.g., "Authorization: Bot <token>" or "X-Shopify-Access-Token: <token>")
  // Also provides: retry logic, timeout handling, circuit breaker protection
  return connector.fetch(url.toString(), options, userId);
}

/**
 * Create an authenticated fetch function bound to a specific connector and optionally a user
 *
 * Useful for creating reusable fetch functions for a specific API and/or user.
 * Uses connector's configured auth scheme (Bearer, Bot, Basic, custom headers).
 *
 * @param authProvider - Name of registered connector
 * @param userId - Optional user identifier to bind to (omit for single-user mode)
 * @returns Fetch function bound to that connector (and user)
 *
 * @example Single-user mode:
 * ```typescript
 * const msftFetch = createAuthenticatedFetch('microsoft');
 *
 * // Use like normal fetch (auth automatic)
 * const me = await msftFetch('https://graph.microsoft.com/v1.0/me');
 * const emails = await msftFetch('https://graph.microsoft.com/v1.0/me/messages');
 * ```
 *
 * @example With relative URLs:
 * ```typescript
 * const githubFetch = createAuthenticatedFetch('github');
 *
 * // Relative URLs resolved against connector's baseURL
 * const repos = await githubFetch('/user/repos');
 * const issues = await githubFetch('/user/issues');
 * ```
 *
 * @example Multi-user mode:
 * ```typescript
 * // Create fetch functions for different users
 * const aliceFetch = createAuthenticatedFetch('github', 'user123');
 * const bobFetch = createAuthenticatedFetch('github', 'user456');
 *
 * // Each uses their own token
 * const aliceRepos = await aliceFetch('/user/repos');
 * const bobRepos = await bobFetch('/user/repos');
 * ```
 */
export function createAuthenticatedFetch(
  authProvider: string,
  userId?: string
): (url: string | URL, options?: RequestInit) => Promise<Response> {
  // Validate connector exists at creation time
  const connector = Connector.get(authProvider);

  return async (url: string | URL, options?: RequestInit) => {
    // Delegate to connector.fetch() for proper auth handling
    return connector.fetch(url.toString(), options, userId);
  };
}
