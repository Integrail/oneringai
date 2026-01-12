/**
 * Token storage interface (Clean Architecture - Domain Layer)
 * All implementations must encrypt tokens at rest
 */

export interface StoredToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  obtained_at: number; // Timestamp when token was obtained
}

/**
 * Token storage interface
 * All implementations MUST encrypt tokens before storing
 */
export interface ITokenStorage {
  /**
   * Store token (must be encrypted by implementation)
   *
   * @param key - Unique identifier for this token
   * @param token - Token data to store
   */
  storeToken(key: string, token: StoredToken): Promise<void>;

  /**
   * Retrieve token (must be decrypted by implementation)
   *
   * @param key - Unique identifier for the token
   * @returns Decrypted token or null if not found
   */
  getToken(key: string): Promise<StoredToken | null>;

  /**
   * Delete token
   *
   * @param key - Unique identifier for the token
   */
  deleteToken(key: string): Promise<void>;

  /**
   * Check if token exists
   *
   * @param key - Unique identifier for the token
   * @returns True if token exists
   */
  hasToken(key: string): Promise<boolean>;
}
