/**
 * Tests for normalized Levenshtein fuzzy matching.
 */

import { describe, it, expect } from 'vitest';
import { normalizedLevenshteinRatio, normalizeSurface } from '@/memory/resolution/fuzzy.js';

describe('normalizeSurface', () => {
  it('lowercases + trims', () => {
    expect(normalizeSurface('  Hello World  ')).toBe('hello world');
  });

  it('strips corporate suffixes', () => {
    expect(normalizeSurface('Microsoft Inc.')).toBe('microsoft');
    expect(normalizeSurface('Acme Corp')).toBe('acme');
    expect(normalizeSurface('Widget LLC')).toBe('widget');
    expect(normalizeSurface('Widget Limited')).toBe('widget');
  });

  it('strips non-alphanumeric punctuation', () => {
    expect(normalizeSurface("John's Coffee")).toBe('john s coffee');
    expect(normalizeSurface('A, B & C')).toBe('a b c');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeSurface('hello   world')).toBe('hello world');
  });

  it('empty → empty', () => {
    expect(normalizeSurface('')).toBe('');
  });
});

describe('normalizedLevenshteinRatio', () => {
  it('identical strings → 1.0', () => {
    expect(normalizedLevenshteinRatio('Microsoft', 'Microsoft')).toBe(1);
  });

  it('case + punctuation differences → 1.0 after normalization', () => {
    expect(normalizedLevenshteinRatio('Microsoft Inc.', 'MICROSOFT')).toBe(1);
  });

  it('totally different → low', () => {
    expect(normalizedLevenshteinRatio('Microsoft', 'Acme')).toBeLessThan(0.3);
  });

  it('one character off → high', () => {
    expect(normalizedLevenshteinRatio('Microsoft', 'Microsft')).toBeGreaterThan(0.85);
  });

  it('Q3 Planning vs Q3 Planning Review', () => {
    const r = normalizedLevenshteinRatio('Q3 Planning', 'Q3 Planning Review');
    expect(r).toBeGreaterThan(0.5);
    expect(r).toBeLessThan(1);
  });

  it('empty vs empty → 1.0', () => {
    expect(normalizedLevenshteinRatio('', '')).toBe(1);
  });

  it('empty vs non-empty → 0', () => {
    expect(normalizedLevenshteinRatio('', 'x')).toBe(0);
    expect(normalizedLevenshteinRatio('x', '')).toBe(0);
  });

  it('MSFT vs Microsoft — low match without expansion', () => {
    // These would only match via aliases, not pure fuzzy.
    expect(normalizedLevenshteinRatio('MSFT', 'Microsoft')).toBeLessThan(0.85);
  });
});
