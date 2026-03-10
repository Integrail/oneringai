/**
 * SentenceChunkingStrategy Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SentenceChunkingStrategy } from '@/capabilities/speech/SentenceSplitter.js';

describe('SentenceChunkingStrategy', () => {
  let chunker: SentenceChunkingStrategy;

  beforeEach(() => {
    chunker = new SentenceChunkingStrategy();
  });

  describe('basic sentence splitting', () => {
    it('should split on period followed by space', () => {
      const chunks = chunker.feed('Hello world, welcome here. This is a longer test sentence. ');
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toBe('Hello world, welcome here.');
      expect(chunks[1]).toBe('This is a longer test sentence.');
    });

    it('should split on question mark', () => {
      const chunks = chunker.feed('How are you doing today? I am doing just fine. ');
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toBe('How are you doing today?');
      expect(chunks[1]).toBe('I am doing just fine.');
    });

    it('should split on exclamation mark', () => {
      const chunks = chunker.feed('Wow, that is truly amazing! I really love it so much. ');
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toBe('Wow, that is truly amazing!');
      expect(chunks[1]).toBe('I really love it so much.');
    });

    it('should keep incomplete sentence in buffer', () => {
      const chunks1 = chunker.feed('This is an incomplete');
      expect(chunks1).toHaveLength(0);

      const chunks2 = chunker.feed(' sentence. ');
      expect(chunks2).toHaveLength(1);
      expect(chunks2[0]).toBe('This is an incomplete sentence.');
    });

    it('should flush remaining buffer', () => {
      chunker.feed('This is incomplete');
      const flushed = chunker.flush();
      expect(flushed).toBe('This is incomplete');
    });

    it('should return null on flush when buffer is empty', () => {
      expect(chunker.flush()).toBeNull();
    });
  });

  describe('incremental streaming', () => {
    it('should handle character-by-character input', () => {
      // Use sentences longer than minChunkLength (20)
      const text = 'Hello world, how are you doing today. Goodbye and see you tomorrow. ';
      const allChunks: string[] = [];

      for (const ch of text) {
        allChunks.push(...chunker.feed(ch));
      }

      expect(allChunks).toHaveLength(2);
      expect(allChunks[0]).toBe('Hello world, how are you doing today.');
      expect(allChunks[1]).toBe('Goodbye and see you tomorrow.');
    });

    it('should handle word-by-word input', () => {
      const words = ['The ', 'quick ', 'brown ', 'fox ', 'jumped ', 'over. ', 'The ', 'lazy ', 'dog ', 'slept ', 'all ', 'day. '];
      const allChunks: string[] = [];

      for (const word of words) {
        allChunks.push(...chunker.feed(word));
      }

      expect(allChunks).toHaveLength(2);
      expect(allChunks[0]).toBe('The quick brown fox jumped over.');
      expect(allChunks[1]).toBe('The lazy dog slept all day.');
    });
  });

  describe('abbreviation handling', () => {
    it('should not split on common abbreviations', () => {
      const chunks = chunker.feed('Dr. Smith went to the store. ');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('Dr. Smith went to the store.');
    });

    it('should not split on Mr./Mrs./Ms.', () => {
      const chunks = chunker.feed('Mr. and Mrs. Jones arrived early today. ');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('Mr. and Mrs. Jones arrived early today.');
    });

    it('should not split on e.g. and i.e.', () => {
      const chunks = chunker.feed('Use a language e.g. TypeScript for this project. ');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('Use a language e.g. TypeScript for this project.');
    });

    it('should not split on U.S.', () => {
      const chunks = chunker.feed('The U.S. economy grew last quarter significantly. ');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('The U.S. economy grew last quarter significantly.');
    });

    it('should handle custom abbreviations', () => {
      const custom = new SentenceChunkingStrategy({
        additionalAbbreviations: ['Corp.', 'Intl.'],
      });
      const chunks = custom.feed('Acme Corp. released a new product for consumers. ');
      expect(chunks).toHaveLength(1);
    });
  });

  describe('numeric handling', () => {
    it('should not split on decimal numbers', () => {
      const chunks = chunker.feed('The value is 3.14 which is pi. ');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('The value is 3.14 which is pi.');
    });

    it('should not split on dollar amounts', () => {
      const chunks = chunker.feed('The price is $1.50 per item today. ');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('The price is $1.50 per item today.');
    });
  });

  describe('paragraph breaks', () => {
    it('should split on double newlines', () => {
      const chunks = chunker.feed('First paragraph here\n\nSecond paragraph here\n\n');
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toBe('First paragraph here');
      expect(chunks[1]).toBe('Second paragraph here');
    });
  });

  describe('code block handling', () => {
    it('should skip content inside fenced code blocks', () => {
      const chunks = chunker.feed('Here is code:\n```\nconst x = 1;\n```\nAnd more text here today. ');
      expect(chunks).toHaveLength(1);
      // Code block content should not be in the output
      expect(chunks[0]).not.toContain('const x');
    });

    it('should handle code blocks with language identifier', () => {
      const chunks = chunker.feed('Example:\n```typescript\nconst x = 1;\n```\nDone with example now. ');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).not.toContain('const x');
    });

    it('should handle unclosed code blocks on flush', () => {
      chunker.feed('Start:\n```\nsome code here');
      const flushed = chunker.flush();
      // Unclosed code block text is discarded
      expect(flushed).toBe('Start:');
    });
  });

  describe('markdown stripping', () => {
    it('should strip bold formatting', () => {
      const chunks = chunker.feed('This is **bold** text for emphasis. ');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('This is bold text for emphasis.');
    });

    it('should strip italic formatting', () => {
      const chunks = chunker.feed('This is *italic* text for emphasis. ');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('This is italic text for emphasis.');
    });

    it('should strip links but keep text', () => {
      const chunks = chunker.feed('Visit [Google](https://google.com) for more information today. ');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('Visit Google for more information today.');
    });

    it('should strip heading markers', () => {
      const chunks = chunker.feed('## Introduction to the Topic\n\nSome text follows here. ');
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toBe('Introduction to the Topic');
    });

    it('should strip inline code backticks', () => {
      const chunks = chunker.feed('Use `const` to declare variables in JavaScript. ');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('Use const to declare variables in JavaScript.');
    });

    it('should not strip markdown when disabled', () => {
      const noStrip = new SentenceChunkingStrategy({ stripMarkdown: false });
      const chunks = noStrip.feed('This is **bold** text for emphasis. ');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('This is **bold** text for emphasis.');
    });
  });

  describe('min/max chunk length', () => {
    it('should merge short sentences below minChunkLength', () => {
      const chunker = new SentenceChunkingStrategy({ minChunkLength: 30 });
      const chunks = chunker.feed('Hi. Ok. This is a much longer sentence that exceeds the minimum. ');
      // "Hi." and "Ok." are too short, should be merged
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // The merged chunk should contain both
      expect(chunks[0]).toContain('Hi.');
      expect(chunks[0]).toContain('Ok.');
    });

    it('should split very long text without sentence terminators at clause boundaries', () => {
      const chunker = new SentenceChunkingStrategy({ maxChunkLength: 50, minChunkLength: 10 });
      // No sentence terminators — buffer grows past maxChunkLength and forces split
      const longText = 'This is a very long text that goes on and on, with many clauses and sub-clauses, covering a wide range of topics and then some more';
      chunker.feed(longText);
      const flushed = chunker.flush();
      // At minimum the buffer should have been partially split
      // (the initial feed may produce chunks, flush returns remainder)
      expect(flushed).toBeTruthy();
      expect(flushed!.length).toBeLessThan(longText.length);
    });
  });

  describe('reset', () => {
    it('should clear buffer on reset', () => {
      chunker.feed('Partial text');
      chunker.reset();
      expect(chunker.flush()).toBeNull();
    });

    it('should reset code block state', () => {
      chunker.feed('```\nsome code');
      chunker.reset();
      // After reset, should not be in code block mode
      const chunks = chunker.feed('Normal text here now. ');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('Normal text here now.');
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const chunks = chunker.feed('');
      expect(chunks).toHaveLength(0);
    });

    it('should handle whitespace-only input', () => {
      chunker.feed('   ');
      const flushed = chunker.flush();
      expect(flushed).toBeNull();
    });

    it('should handle ellipsis', () => {
      const chunks = chunker.feed('Well... I guess that is all. ');
      // Should not split on the ellipsis
      expect(chunks).toHaveLength(1);
    });

    it('should handle multiple terminators in sequence', () => {
      const chunks = chunker.feed('Really?! That is absolutely incredible. ');
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
