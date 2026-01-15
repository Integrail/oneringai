/**
 * PKCE Utils Unit Tests
 * Tests PKCE (Proof Key for Code Exchange) RFC 7636 implementation
 */

import { describe, it, expect } from 'vitest';
import { generatePKCE, generateState } from '@/connectors/oauth/utils/pkce.js';
import crypto from 'crypto';

describe('PKCE Utils', () => {
  describe('generatePKCE()', () => {
    it('should generate code_verifier with 43-128 characters', () => {
      const { codeVerifier } = generatePKCE();

      expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
      expect(codeVerifier.length).toBeLessThanOrEqual(128);
    });

    it('should generate base64url-safe code_verifier', () => {
      const { codeVerifier } = generatePKCE();

      // Only A-Z, a-z, 0-9, -, _ (no +, /, =)
      expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(codeVerifier).not.toContain('+');
      expect(codeVerifier).not.toContain('/');
      expect(codeVerifier).not.toContain('=');
    });

    it('should generate code_challenge = BASE64URL(SHA256(verifier))', () => {
      const { codeVerifier, codeChallenge } = generatePKCE();

      // Manually compute expected challenge
      const hash = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      expect(codeChallenge).toBe(hash);
    });

    it('should generate different verifiers on each call', () => {
      const { codeVerifier: v1 } = generatePKCE();
      const { codeVerifier: v2 } = generatePKCE();
      const { codeVerifier: v3 } = generatePKCE();

      expect(v1).not.toBe(v2);
      expect(v2).not.toBe(v3);
      expect(v1).not.toBe(v3);
    });

    it('should generate unique verifiers (100 iterations)', () => {
      const verifiers = new Set();

      for (let i = 0; i < 100; i++) {
        const { codeVerifier } = generatePKCE();
        verifiers.add(codeVerifier);
      }

      // All 100 should be unique
      expect(verifiers.size).toBe(100);
    });

    it('should generate valid S256 challenge that OAuth server can verify', () => {
      const { codeVerifier, codeChallenge } = generatePKCE();

      // Simulate what OAuth server does to verify
      const serverComputedChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      expect(codeChallenge).toBe(serverComputedChallenge);
    });
  });

  describe('generateState()', () => {
    it('should return 32 hex characters', () => {
      const state = generateState();

      expect(state).toMatch(/^[0-9a-f]{32}$/);
      expect(state.length).toBe(32);
    });

    it('should generate different states on each call', () => {
      const s1 = generateState();
      const s2 = generateState();
      const s3 = generateState();

      expect(s1).not.toBe(s2);
      expect(s2).not.toBe(s3);
      expect(s1).not.toBe(s3);
    });

    it('should generate cryptographically strong state values', () => {
      // Generate 100 states, all should be unique
      const states = new Set();

      for (let i = 0; i < 100; i++) {
        states.add(generateState());
      }

      expect(states.size).toBe(100);
    });

    it('should use only lowercase hex characters', () => {
      const state = generateState();

      expect(state).toBe(state.toLowerCase());
      expect(state).not.toMatch(/[A-F]/);
    });
  });

  describe('PKCE Security Properties', () => {
    it('should generate high-entropy verifiers', () => {
      // Test entropy by ensuring wide distribution of characters
      const { codeVerifier } = generatePKCE();
      const charSet = new Set(codeVerifier.split(''));

      // Should use diverse character set (not just 'a' repeated)
      expect(charSet.size).toBeGreaterThan(10);
    });

    it('should resist collision attacks', () => {
      // Generate 1000 PKCE pairs, ensure no collisions
      const challenges = new Set();

      for (let i = 0; i < 1000; i++) {
        const { codeChallenge } = generatePKCE();
        challenges.add(codeChallenge);
      }

      expect(challenges.size).toBe(1000);
    });
  });
});
