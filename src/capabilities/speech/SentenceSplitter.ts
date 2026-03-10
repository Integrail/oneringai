/**
 * Sentence boundary detection for voice pseudo-streaming.
 * Splits streaming text deltas into speakable chunks.
 */

import type { IChunkingStrategy, ChunkingOptions } from './types.js';

/**
 * Common abbreviations that end with a period but are NOT sentence boundaries.
 */
const DEFAULT_ABBREVIATIONS = new Set([
  'dr.', 'mr.', 'mrs.', 'ms.', 'prof.', 'sr.', 'jr.',
  'st.', 'ave.', 'blvd.', 'rd.',
  'u.s.', 'u.k.', 'u.s.a.', 'u.n.',
  'e.g.', 'i.e.', 'etc.', 'vs.', 'viz.',
  'approx.', 'dept.', 'est.', 'inc.', 'ltd.', 'corp.',
  'no.', 'vol.', 'rev.', 'gen.', 'gov.',
  'jan.', 'feb.', 'mar.', 'apr.', 'jun.', 'jul.', 'aug.', 'sep.', 'oct.', 'nov.', 'dec.',
  'fig.', 'eq.', 'ref.', 'sec.', 'ch.',
  'min.', 'max.', 'avg.',
]);

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  minChunkLength: 20,
  maxChunkLength: 500,
  skipCodeBlocks: true,
  stripMarkdown: true,
  additionalAbbreviations: [],
};

/**
 * Default chunking strategy that splits text at sentence boundaries.
 *
 * Handles:
 * - Sentence terminators (. ? !) followed by whitespace
 * - Abbreviation exclusion (Dr., Mr., U.S., e.g., etc.)
 * - Numeric decimals (3.14, $1.50)
 * - Paragraph breaks (\n\n)
 * - Fenced code block tracking (``` ... ```)
 * - Markdown stripping
 * - Min/max chunk length enforcement
 */
export class SentenceChunkingStrategy implements IChunkingStrategy {
  private buffer = '';
  private inCodeBlock = false;
  private codeBlockBuffer = '';
  private options: Required<ChunkingOptions>;
  private abbreviations: Set<string>;

  constructor(options?: ChunkingOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.abbreviations = new Set([
      ...DEFAULT_ABBREVIATIONS,
      ...this.options.additionalAbbreviations.map((a) => a.toLowerCase()),
    ]);
  }

  feed(delta: string): string[] {
    this.buffer += delta;
    return this.extractChunks();
  }

  flush(): string | null {
    // If we're in a code block, discard remaining code
    if (this.inCodeBlock) {
      this.codeBlockBuffer = '';
      this.inCodeBlock = false;
    }

    const text = this.cleanForSpeech(this.buffer.trim());
    this.buffer = '';
    return text.length > 0 ? text : null;
  }

  reset(): void {
    this.buffer = '';
    this.inCodeBlock = false;
    this.codeBlockBuffer = '';
  }

  // ======================== Private Methods ========================

  private extractChunks(): string[] {
    const chunks: string[] = [];

    // Handle code block boundaries first
    if (this.options.skipCodeBlocks) {
      this.processCodeBlocks();
    }

    // Try paragraph breaks first (\n\n)
    let paragraphIdx = this.buffer.indexOf('\n\n');
    while (paragraphIdx !== -1) {
      const chunk = this.buffer.slice(0, paragraphIdx).trim();
      this.buffer = this.buffer.slice(paragraphIdx + 2);
      if (chunk.length > 0) {
        const cleaned = this.cleanForSpeech(chunk);
        if (cleaned.length > 0) {
          chunks.push(cleaned);
        }
      }
      paragraphIdx = this.buffer.indexOf('\n\n');
    }

    // Try sentence boundaries
    let sentenceEnd = this.findSentenceBoundary();
    while (sentenceEnd !== -1) {
      const sentence = this.buffer.slice(0, sentenceEnd).trim();
      this.buffer = this.buffer.slice(sentenceEnd).trimStart();

      if (sentence.length > 0) {
        const cleaned = this.cleanForSpeech(sentence);
        if (cleaned.length > 0) {
          chunks.push(cleaned);
        }
      }
      sentenceEnd = this.findSentenceBoundary();
    }

    // Enforce max chunk length on buffer if it gets too long
    if (this.buffer.length > this.options.maxChunkLength) {
      const splitChunks = this.splitLongText(this.buffer);
      // Keep the last partial chunk in the buffer
      this.buffer = splitChunks.pop() ?? '';
      for (const chunk of splitChunks) {
        const cleaned = this.cleanForSpeech(chunk.trim());
        if (cleaned.length > 0) {
          chunks.push(cleaned);
        }
      }
    }

    // Merge small chunks
    return this.mergeSmallChunks(chunks);
  }

  /**
   * Track and remove fenced code blocks from the buffer.
   * Text inside code blocks is discarded (not spoken).
   */
  private processCodeBlocks(): void {
    let idx = 0;
    let result = '';

    while (idx < this.buffer.length) {
      // Check for code fence (```)
      if (this.buffer.startsWith('```', idx)) {
        if (this.inCodeBlock) {
          // Closing fence — skip everything including the fence
          this.inCodeBlock = false;
          this.codeBlockBuffer = '';
          idx += 3;
          // Skip rest of the fence line (e.g., ```\n)
          const newline = this.buffer.indexOf('\n', idx);
          idx = newline !== -1 ? newline + 1 : this.buffer.length;
        } else {
          // Opening fence
          this.inCodeBlock = true;
          this.codeBlockBuffer = '';
          idx += 3;
          // Skip the language identifier line
          const newline = this.buffer.indexOf('\n', idx);
          idx = newline !== -1 ? newline + 1 : this.buffer.length;
        }
      } else if (this.inCodeBlock) {
        // Inside code block — accumulate but don't include in output
        this.codeBlockBuffer += this.buffer[idx];
        idx++;
      } else {
        result += this.buffer[idx];
        idx++;
      }
    }

    this.buffer = result;
  }

  /**
   * Find the position right after the next sentence boundary.
   * Returns -1 if no complete sentence boundary found.
   */
  private findSentenceBoundary(): number {
    const terminators = ['.', '?', '!'];

    for (let i = 0; i < this.buffer.length; i++) {
      const ch = this.buffer.charAt(i);

      if (!terminators.includes(ch)) continue;

      // Need at least one char after the terminator
      if (i + 1 >= this.buffer.length) return -1;

      const nextChar = this.buffer[i + 1];

      // Must be followed by whitespace or end-of-text indicator
      if (nextChar !== ' ' && nextChar !== '\n' && nextChar !== '\r' && nextChar !== '\t') {
        // Could be ellipsis (.../...) or decimal or abbreviation — skip
        continue;
      }

      // Check if it's a period that's part of an abbreviation or number
      if (ch === '.') {
        if (this.isAbbreviation(i)) continue;
        if (this.isDecimalNumber(i)) continue;
        if (this.isEllipsis(i)) continue;
      }

      // Check minimum chunk length
      const candidate = this.buffer.slice(0, i + 1).trim();
      if (candidate.length < this.options.minChunkLength) continue;

      // Found a valid sentence boundary
      return i + 1;
    }

    return -1;
  }

  /**
   * Check if the period at position `pos` is part of a known abbreviation.
   */
  private isAbbreviation(pos: number): boolean {
    // Look backwards to find the word before the period
    let wordStart = pos - 1;
    while (wordStart >= 0 && this.buffer[wordStart] !== ' ' && this.buffer[wordStart] !== '\n') {
      wordStart--;
    }
    wordStart++;

    const word = this.buffer.slice(wordStart, pos + 1).toLowerCase();
    return this.abbreviations.has(word);
  }

  /**
   * Check if the period at position `pos` is a decimal point.
   * e.g., 3.14, $1.50
   */
  private isDecimalNumber(pos: number): boolean {
    if (pos === 0 || pos + 1 >= this.buffer.length) return false;
    const before = this.buffer.charAt(pos - 1);
    const after = this.buffer.charAt(pos + 1);
    // Digit before and digit after = decimal
    return /\d/.test(before) && /\d/.test(after);
  }

  /**
   * Check if the period at position `pos` is part of an ellipsis (...).
   */
  private isEllipsis(pos: number): boolean {
    if (pos >= 2 && this.buffer[pos - 1] === '.' && this.buffer[pos - 2] === '.') return true;
    if (pos + 1 < this.buffer.length && this.buffer[pos + 1] === '.') return true;
    return false;
  }

  /**
   * Split text that exceeds maxChunkLength at clause boundaries.
   */
  private splitLongText(text: string): string[] {
    const max = this.options.maxChunkLength;
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > max) {
      // Try splitting at comma, semicolon, colon, or dash
      let splitPos = -1;
      const clauseBreaks = [',', ';', ':', ' —', ' –', ' -'];

      for (const brk of clauseBreaks) {
        // Search backwards from max position
        const searchRegion = remaining.slice(0, max);
        const lastPos = searchRegion.lastIndexOf(brk);
        if (lastPos > this.options.minChunkLength) {
          splitPos = lastPos + brk.length;
          break;
        }
      }

      // Fallback: split at last space before max
      if (splitPos === -1) {
        const searchRegion = remaining.slice(0, max);
        splitPos = searchRegion.lastIndexOf(' ');
        if (splitPos <= this.options.minChunkLength) {
          // No good split point — force at max
          splitPos = max;
        }
      }

      chunks.push(remaining.slice(0, splitPos));
      remaining = remaining.slice(splitPos);
    }

    chunks.push(remaining);
    return chunks;
  }

  /**
   * Merge chunks that are shorter than minChunkLength with the next chunk.
   */
  private mergeSmallChunks(chunks: string[]): string[] {
    if (chunks.length <= 1) return chunks;

    const merged: string[] = [];
    let accumulator = '';

    for (const chunk of chunks) {
      if (accumulator.length > 0) {
        accumulator += ' ' + chunk;
      } else {
        accumulator = chunk;
      }

      if (accumulator.length >= this.options.minChunkLength) {
        merged.push(accumulator);
        accumulator = '';
      }
    }

    // If there's leftover, merge with last chunk or add as-is
    if (accumulator.length > 0) {
      if (merged.length > 0) {
        merged[merged.length - 1] += ' ' + accumulator;
      } else {
        merged.push(accumulator);
      }
    }

    return merged;
  }

  /**
   * Strip markdown formatting from text for natural speech.
   */
  private cleanForSpeech(text: string): string {
    if (!this.options.stripMarkdown) return text;

    let cleaned = text;

    // Inline code → keep text content
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
    // Bold **text** or __text__
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
    // Italic *text* or _text_
    cleaned = cleaned.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1');
    cleaned = cleaned.replace(/(?<!_)_([^_]+)_(?!_)/g, '$1');
    // Strikethrough ~~text~~
    cleaned = cleaned.replace(/~~([^~]+)~~/g, '$1');
    // Links [text](url) → keep text
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // Images ![alt](url) → skip
    cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
    // Headings # text → text
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
    // List items - text or * text
    cleaned = cleaned.replace(/^[-*+]\s+/gm, '');
    // Numbered lists 1. text
    cleaned = cleaned.replace(/^\d+\.\s+/gm, '');
    // Blockquotes > text
    cleaned = cleaned.replace(/^>\s+/gm, '');
    // Horizontal rules
    cleaned = cleaned.replace(/^[-*_]{3,}\s*$/gm, '');
    // Collapse multiple spaces/newlines
    cleaned = cleaned.replace(/\n+/g, ' ');
    cleaned = cleaned.replace(/\s{2,}/g, ' ');

    return cleaned.trim();
  }
}
