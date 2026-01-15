/**
 * Authenticated Fetch - Drop-in replacement for fetch() with OAuth authentication
 */

import { Connector } from '../core/Connector.js';

/**
 * Fetch with automatic OAuth authentication
 *
 * Same API as standard fetch(), but with additional authProvider and optional userId parameters.
 * The OAuth token is automatically retrieved and injected into the Authorization header.
 *
 * @param url - URL to fetch (string or URL object)
 * @param options - Standard fetch options
 * @param authProvider - Name of registered OAuth provider (e.g., 'microsoft', 'google')
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
 * @example Multi-user mode:
 * ```typescript
 * const response = await authenticatedFetch(
 *   'https://api.github.com/user/repos',
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
  // Get connector from registry
  const connector = Connector.get(authProvider);

  // Get OAuth token for the user (automatically refreshed if needed)
  const token = await connector.getToken(userId);

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
 * Create an authenticated fetch function bound to a specific provider and optionally a user
 *
 * Useful for creating reusable fetch functions for a specific API and/or user.
 *
 * @param authProvider - Name of registered OAuth provider
 * @param userId - Optional user identifier to bind to (omit for single-user mode)
 * @returns Fetch function bound to that provider (and user)
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
 * @example Multi-user mode (bound to specific user):
 * ```typescript
 * // Create fetch function for Alice
 * const aliceFetch = createAuthenticatedFetch('github', 'user123');
 *
 * // All calls automatically use Alice's token
 * const repos = await aliceFetch('https://api.github.com/user/repos');
 * const issues = await aliceFetch('https://api.github.com/user/issues');
 *
 * // Create fetch function for Bob (separate tokens!)
 * const bobFetch = createAuthenticatedFetch('github', 'user456');
 * const bobRepos = await bobFetch('https://api.github.com/user/repos');
 * ```
 *
 * @example Multi-user mode (userId per-call):
 * ```typescript
 * // Create fetch function NOT bound to a user
 * const githubFetch = createAuthenticatedFetch('github');
 *
 * // Specify userId at call time
 * const aliceRepos = await githubFetch(
 *   'https://api.github.com/user/repos',
 *   { userId: 'user123' }  // Pass as custom option
 * );
 * ```
 */
export function createAuthenticatedFetch(
  authProvider: string,
  userId?: string
): (url: string | URL, options?: RequestInit) => Promise<Response> {
  // Validate provider exists at creation time
  Connector.get(authProvider);

  return async (url: string | URL, options?: RequestInit) => {
    return authenticatedFetch(url, options, authProvider, userId);
  };
}
