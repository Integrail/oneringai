/**
 * PKCE (Proof Key for Code Exchange) utilities
 * RFC 7636 - https://tools.ietf.org/html/rfc7636
 */

import * as crypto from 'crypto';

export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
}

/**
 * Generate PKCE code verifier and challenge pair
 *
 * code_challenge = BASE64URL(SHA256(code_verifier))
 */
export function generatePKCE(): PKCEPair {
  // Generate random code verifier (43-128 characters as per RFC)
  const codeVerifier = base64URLEncode(crypto.randomBytes(32));

  // Create code challenge = BASE64URL(SHA256(code_verifier))
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = base64URLEncode(hash);

  return {
    codeVerifier,
    codeChallenge,
  };
}

/**
 * Base64 URL encode (RFC 4648 Section 5)
 * Used for PKCE code_verifier and code_challenge
 */
function base64URLEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-') // Replace + with -
    .replace(/\//g, '_') // Replace / with _
    .replace(/=/g, ''); // Remove padding
}

/**
 * Generate random state for CSRF protection
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}
