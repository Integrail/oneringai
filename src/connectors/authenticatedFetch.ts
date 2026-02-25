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
 * Same API as standard fetch(), but with additional authProvider and optional userId/accountId parameters.
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
 * @param accountId - Optional account alias for multi-account OAuth (e.g., 'work', 'personal')
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
 * @example Multi-account mode:
 * ```typescript
 * const response = await authenticatedFetch(
 *   'https://graph.microsoft.com/v1.0/me',
 *   { method: 'GET' },
 *   'microsoft',
 *   'alice',
 *   'work'  // Use Alice's work Microsoft account
 * );
 * ```
 */
export async function authenticatedFetch(
  url: string | URL,
  options: RequestInit | undefined,
  authProvider: string,
  userId?: string,
  accountId?: string
): Promise<Response> {
  const connector = Connector.get(authProvider);

  // Delegate to connector.fetch() which handles all auth schemes correctly:
  // - OAuth/JWT: Authorization: Bearer <token>
  // - API Key: Uses configured headerName and headerPrefix
  //   (e.g., "Authorization: Bot <token>" or "X-Shopify-Access-Token: <token>")
  // Also provides: retry logic, timeout handling, circuit breaker protection
  return connector.fetch(url.toString(), options, userId, accountId);
}

/**
 * Create an authenticated fetch function bound to a specific connector and optionally a user/account
 *
 * Useful for creating reusable fetch functions for a specific API and/or user.
 * Uses connector's configured auth scheme (Bearer, Bot, Basic, custom headers).
 *
 * @param authProvider - Name of registered connector
 * @param userId - Optional user identifier to bind to (omit for single-user mode)
 * @param accountId - Optional account alias for multi-account OAuth (e.g., 'work', 'personal')
 * @returns Fetch function bound to that connector (and user/account)
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
 * @example Multi-account mode:
 * ```typescript
 * // Create fetch for Alice's work Microsoft account
 * const workFetch = createAuthenticatedFetch('microsoft', 'alice', 'work');
 * const personalFetch = createAuthenticatedFetch('microsoft', 'alice', 'personal');
 *
 * const workEmails = await workFetch('/me/messages');
 * const personalEmails = await personalFetch('/me/messages');
 * ```
 */
export function createAuthenticatedFetch(
  authProvider: string,
  userId?: string,
  accountId?: string
): (url: string | URL, options?: RequestInit) => Promise<Response> {
  // Validate connector exists at creation time
  const connector = Connector.get(authProvider);

  return async (url: string | URL, options?: RequestInit) => {
    // Delegate to connector.fetch() for proper auth handling
    return connector.fetch(url.toString(), options, userId, accountId);
  };
}
