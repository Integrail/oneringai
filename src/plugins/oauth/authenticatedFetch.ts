/**
 * Authenticated Fetch - Drop-in replacement for fetch() with OAuth authentication
 */

import { oauthRegistry } from './OAuthRegistry.js';

/**
 * Fetch with automatic OAuth authentication
 *
 * Same API as standard fetch(), but with an additional authProvider parameter.
 * The OAuth token is automatically retrieved and injected into the Authorization header.
 *
 * @param url - URL to fetch (string or URL object)
 * @param options - Standard fetch options
 * @param authProvider - Name of registered OAuth provider (e.g., 'microsoft', 'google')
 * @returns Promise<Response> - Same as standard fetch
 *
 * @example
 * ```typescript
 * const response = await authenticatedFetch(
 *   'https://graph.microsoft.com/v1.0/me',
 *   { method: 'GET' },
 *   'microsoft'
 * );
 * const data = await response.json();
 * ```
 */
export async function authenticatedFetch(
  url: string | URL,
  options: RequestInit | undefined,
  authProvider: string
): Promise<Response> {
  // Get provider from registry
  const provider = oauthRegistry.get(authProvider);

  // Get OAuth token (automatically refreshed if needed)
  const token = await provider.oauthManager.getToken();

  // Merge headers (don't mutate original options)
  const authOptions: RequestInit = {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  };

  // Call standard fetch with authenticated headers
  return fetch(url, authOptions);
}

/**
 * Create an authenticated fetch function bound to a specific provider
 *
 * Useful for creating reusable fetch functions for a specific API.
 *
 * @param authProvider - Name of registered OAuth provider
 * @returns Fetch function bound to that provider
 *
 * @example
 * ```typescript
 * const msftFetch = createAuthenticatedFetch('microsoft');
 *
 * // Use like normal fetch (auth automatic)
 * const me = await msftFetch('https://graph.microsoft.com/v1.0/me');
 * const emails = await msftFetch('https://graph.microsoft.com/v1.0/me/messages');
 * ```
 */
export function createAuthenticatedFetch(
  authProvider: string
): (url: string | URL, options?: RequestInit) => Promise<Response> {
  // Validate provider exists at creation time
  oauthRegistry.get(authProvider);

  return async (url: string | URL, options?: RequestInit) => {
    return authenticatedFetch(url, options, authProvider);
  };
}
